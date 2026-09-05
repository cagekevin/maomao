/**
 * relay-poll — localTool 后端「异步任务轮询句柄管理器」（可 attach + 落库 + 重启恢复）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【目标】把「轮询 + 结果落盘 + result_url 写库」责任从浏览器前端搬到 localTool 常驻进程，
 *  句柄生命周期 = localTool 进程（非浏览器页面）。前端刷新 → GET attach 到同一句柄，
 *  任务继续跑完落盘，不丢图/不丢积分（docs/90 R1~R4、docs/91 M3）。
 *
 * 【唯一出口纪律（91 PRD C0/C1，用户确认）】
 *  - 协议执行（提交/轮询/取结果）一律经 ai-relay kit（protocol.submitModelProtocol /
 *    pollModelProtocolOnce），不自写 fetch/鉴权/字段抽取。
 *  - 落盘 /files/ 走既有 saveRemoteUrl（不依赖 kit）。
 *  - DB 写库走 routes/tasks.ts 导出的 upsertTask（唯一写库路径，禁裸 UPDATE）。
 *  - key 只驻内存、不入库；重启按 providerId 重读 .env。
 * ════════════════════════════════════════════════════════════════
 *
 * 数据模型：
 *  - 内存句柄 Map<frontTaskId, Handle>；一个 frontTaskId 只一个 poller。
 *  - DB 真相：tasks 表按 task_id(=frontTaskId) 行，request_data 内嵌 { _relayPoll }
 *    （含 ResolvedPollConfig 快照 + providerId/capability/baseUrl），供重启恢复重建句柄；
 *    poll_task_id = 上游 task_id；result_url 终态落 /files/。
 */

import {
  protocol,
  getProviderDefinition,
} from './ai-relay/index.js';
import type {
  ModelProtocol,
  ModelProtocolSubmitResult,
  ResolvedPollConfig,
  AuthConfig,
  ModelProtocolProfile,
} from './ai-relay/types.js';
import {
  submitLovartTask,
  pollLovartTaskOnce,
} from './ai-relay/providers/lovart/index.js';
import { stableRequest } from './ai-relay/httpTransport.js';
import { LOVART_DIRECT_BASE_URL } from './ai-relay/providerEndpoints.js';
import type { LovartDirectProfile, LovartTransport } from './ai-relay/providers/lovart/lovart_contract.js';
import { fetchWithProxy } from './utils/netProxy.js';
import { resolveLocalImages, resolveImagesForEgress } from './utils/resolveLocalImages.js';
import { saveRemoteUrl } from './routes/files.js';
import { upsertTask } from './routes/tasks.js';
import { readProviderConfigFile } from './providerConfigStore.js';
import { getDb, queryAll, debouncedSaveDb } from './db/database.js';

export type RelayCapability = 'image' | 'video' | 'chat';

/** /api/generate 提交意图（与 /api/relay body 同源 + frontTaskId/nodeId/type 关联） */
export interface RelaySubmitInput {
  /** 前端自造任务 id（taskStore task_id，贯穿链路主键，= tasks.task_id） */
  frontTaskId: string;
  /** 归属节点 id（任务行 node_id 由前端 taskStore 写，此处可不传；仅建行兜底用） */
  nodeId?: string;
  type: string;
  providerId: string;
  capability: RelayCapability;
  model: string;
  prompt?: string;
  size?: string;
  images?: string[];
  messages?: unknown[];
  /** video：清晰度（如 '1080p'） */
  resolution?: string;
  /** video：时长（秒） */
  duration?: string;
  /** 连接覆盖：存在则优先于 providers.json / .env */
  baseUrl?: string;
  timeoutMs?: number;
}

/** 任务查询结果（GET attach / status） */
export type RelayTaskStatus =
  | { status: 'running'; progress?: number }
  | { status: 'completed'; url: string; type: string }
  | { status: 'failed'; error: string }
  | { status: 'not-found' };

/**
 * 解析某平台 capability 对应的异步调用协议（方案① per-provider 自定义协议）。
 * 旧声明式 lovart-* preset 已随 lovart-old 9004 旧轨退役删除（docs/105 §阶段 C）。
 * 非 lovart 平台如需异步 image/video 生成，须在 provider 配置文件
 * `model_protocols[capability]` 中自备 ModelProtocol（或完整 ModelProtocolProfile）；未配置 → 返回 null，
 * 由提交方给出明确报错（不再静默错抽）。
 */
function resolveProviderAsyncProtocol(
  providerId: string,
  capability: RelayCapability,
): ModelProtocol | null {
  const file = readProviderConfigFile(providerId);
  const protocols = (file as { model_protocols?: unknown } | null)?.model_protocols;
  if (!protocols || typeof protocols !== 'object' || Array.isArray(protocols)) return null;
  const entry = (protocols as Record<string, unknown>)[capability];
  if (entry == null || (typeof entry !== 'object')) return null;
  // 兼容两种落盘形态：完整 ModelProtocolProfile（含 preset）或裸 ModelProtocol（按 custom 封装）
  const profile: ModelProtocolProfile =
    typeof entry === 'object' && entry !== null && 'preset' in entry && (entry as ModelProtocolProfile).preset
      ? (entry as ModelProtocolProfile)
      : { preset: 'custom', protocol: entry as ModelProtocol };
  return protocol.resolveModelExecutionProfile(profile);
}

/** 平台 baseUrl 真源 = ai-relay 内置目录（第 13 平台 lovart 含 defaultBaseUrl） */
function resolveBaseUrl(providerId: string, override?: string): string {
  if (override && override.trim()) return override.trim().replace(/\/+$/, '');
  // 唯一出站地址真源 = 用户配置文件 base_url（modelscope/apimart 等在内置目录无 defaultBaseUrl 的厂商）。
  // 只读内置目录会忽略用户配置 → 报「未配置接口地址」（2026-09-03 修复，与 relay.ts 对齐）。
  const file = readProviderConfigFile(providerId);
  const fileBase = typeof (file as { base_url?: unknown } | null)?.base_url === 'string'
    && (file as { base_url?: string }).base_url!.trim()
    ? (file as { base_url: string }).base_url
    : '';
  if (fileBase) return fileBase.replace(/\/+$/, '');
  const def = getProviderDefinition(providerId);
  const baseUrl = (def?.defaultBaseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error(`Provider ${providerId} 未配置接口地址`);
  return baseUrl;
}

/** key 只驻内存、不入库：提交时从 .env 取，重启按 providerId 重读（91 M3-C5）。 */
function resolveApiKey(providerId: string, override?: string): string {
  return override || process.env[`API_PROVIDER_${providerId.toUpperCase()}_KEY`] || '';
}

/** 判断是否为 lovart（原生直连，走 providers/lovart adapter）。 */
function isLovartDirect(providerId: string): boolean {
  return providerId === 'lovart';
}

/**
 * lovart.ai 出站传输：经代理（fetchWithProxy）。lovart 系域名本机必须经代理才能访问。
 * adapter 的 transport 是稳定请求签名，这里包一层 stableRequest + 代理 fetch。
 */
function lovartProxyTransport(): LovartTransport {
  // fetchWithProxy 只收 string|URL，与 typeof fetch 签名略有差异，此处断言注入（stableRequest 传的是 string url）
  return (opts) => stableRequest({ ...opts, fetchImpl: fetchWithProxy as typeof fetch });
}

/**
 * 构造 lovart 的 HMAC profile。
 * 凭证真源 = localTool/.env（由 src/index.ts 顶部 loadDotEnv() 注入 process.env.LOVART_ACCESS_KEY/SECRET_KEY）。
 * 仅驻内存，不入 DB。
 * transport：注入走代理的 stableRequest（lovart.ai 域名必须经代理，见 netProxy.ts）。
 */
function lovartDirectProfile(baseUrl: string, signal?: AbortSignal, timeoutMs?: number): LovartDirectProfile {
  const accessKey = process.env.LOVART_ACCESS_KEY || '';
  const secretKey = process.env.LOVART_SECRET_KEY || '';
  if (!accessKey || !secretKey) {
    throw new Error('lovart 需要 LOVART_ACCESS_KEY 与 LOVART_SECRET_KEY（请在 localTool/.env 配置）');
  }
  const auth: AuthConfig = { type: 'hmac', accessKey, secretKey };
  return { baseUrl: baseUrl || LOVART_DIRECT_BASE_URL, auth, signal, timeoutMs, transport: lovartProxyTransport() };
}

// ── 轮询时序默认值（对齐前端 config.ts GEN_TIMEOUT/VIDEO_TIMEOUT 语义）──
const DEFAULT_POLL_INTERVAL_MS = 3000;   // 单轮间隔（异步任务轮询默认）
const DEFAULT_TOTAL_TIMEOUT_MS = 10 * 60 * 1000; // 总超时兜底，防无限挂（对齐 relay.ts 10min）
/** direct(lovart) 单次出站请求超时兜底（后台补提交/轮询的底层单请求上限，防无限挂，对齐 ai-relay 180s）。
 *  注：只兜「连不上/单步卡死」，绝不替代总超时 DEFAULT_TOTAL_TIMEOUT_MS（生成本身可远超此值）。 */
const DIRECT_SUBMIT_TIMEOUT_MS = 180_000;
// 连续单轮异常达此阈值 → 立即 failed 透传（默认 3s×30≈90s），避免未知持续异常静默挂起至总超时
const MAX_CONSECUTIVE_POLL_ERRORS = 30;

/** 落盘 /files/tasks/ 归属子目录（对齐 relay.ts RELAY_UPLOAD_SUBFOLDER）。 */
const RELAY_UPLOAD_SUBFOLDER = 'tasks';

/**
 * lovart 原生直连任务的「提交入参」快照（可 JSON 序列化，供「提交即返回」后在后台/重启后补提交）。
 * 根治·2026-09-04：POST /api/generate 不再同步 await 出站；任务先落库(running)+注册待提交句柄即返回，
 * 真正的 submitLovartTask（ensureProject/mode/upload/sendChat）由句柄首轮在后台执行。此快照持久化待提交入参，
 * 重启后 initRelayPoller 据此重建句柄续跑提交，不丢任务。
 */
export interface DirectSubmitInput {
  model: string;
  prompt?: string;
  /** IMAGE：像素；VIDEO：比例（16:9） */
  size?: string;
  /** 参考图原始 url 列表（/files/ 或外链），后台提交时经 resolveLocalImages 归一为 data:base64 */
  images?: string[];
  /** video：清晰度 */
  resolution?: string;
  /** video：时长（秒） */
  duration?: string;
  capability: 'IMAGE' | 'VIDEO';
}

/** 内存句柄（key 不入库） */
interface PollHandle {
  frontTaskId: string;
  taskId: string;        // 上游 task_id（异步网关=网关 task_id；lovart=thread_id）；direct 待提交阶段为空串
  poll: ResolvedPollConfig | null; // 自包含、可 JSON 快照；不含 key。direct 任务为 null
  apiKey: string;        // 驻内存；重启重建时按 providerId 重读（direct 任务可为空串）
  providerId: string;
  capability: RelayCapability;
  model: string;
  type: string;
  baseUrl: string;
  /** true = lovart 原生直连任务（经 providers/lovart adapter 轮询，无声明式 poll） */
  direct?: boolean;
  /** direct 待提交入参：非空=尚未出站，首轮先 submit 再轮询；空/undefined=已完成提交进入轮询（根治·提交即返回） */
  pendingDirectSubmit?: DirectSubmitInput | null;
  startedAt: number;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;      // 单轮执行中防重入
  stopped: boolean;
  lastError?: string;
  /** 连续单轮异常计数：达到阈值立即 failed 透传，避免未知持续异常静默挂起至总超时 */
  consecutiveErrors: number;
}

// 进程单例：frontTaskId -> handle。一个 frontTaskId 只一个 poller。
const handles = new Map<string, PollHandle>();

function stopHandle(h: PollHandle): void {
  if (h.stopped) return;
  h.stopped = true;
  if (h.timer) { clearInterval(h.timer); h.timer = null; }
  if (handles.get(h.frontTaskId) === h) handles.delete(h.frontTaskId);
}

/** request_data 里内嵌的 relay 轮询快照（可 JSON 序列化，key 不入库） */
interface RelayPollSnapshot {
  _relayPoll: {
    taskId: string;                 // 上游 task_id（direct=thread_id）
    poll: ResolvedPollConfig | null; // 自包含轮询配置；direct 任务为 null
    providerId: string;
    capability: RelayCapability;
    model: string;
    type: string;
    baseUrl: string;
    direct?: boolean;               // true = lovart 原生直连
    /** direct 待提交入参快照（重启后重建句柄续跑提交用）；提交完成后清除。非 direct 无此字段 */
    pendingSubmit?: DirectSubmitInput;
    startedAt: number;
  };
}

/**
 * 提交一个异步任务：经 kit submitModelProtocol 拿上游 task_id + 自包含轮询配置，
 * 落库在途行(status=running) → 注册句柄 → 返回 frontTaskId（不等终态）。
 */
export async function submitGenerateTask(input: RelaySubmitInput): Promise<{ ok: boolean; frontTaskId: string; error?: string }> {
  const { frontTaskId } = input;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  try {
    // 已存在句柄 → 视为幂等重放，直接返回（防重复提交双轮询）
    if (handles.has(frontTaskId)) return { ok: true, frontTaskId };

    const providerId = input.providerId || 'lovart';
    const capability = input.capability;
    const baseUrl = resolveBaseUrl(providerId, input.baseUrl);
    const apiKey = resolveApiKey(providerId);

    // ── lovart 原生直连：走 providers/lovart adapter（HMAC + chat-thread），不进声明式 preset ──
    // 【根治·2026-09-04】提交即返回：不再同步 await submitLovartTask 出站（ensureProject/mode/upload/sendChat
    //  可因网络/上传参考图慢而拖慢 POST，前端 15s 曾被误掐断）。改为先落库(running)+注册「待提交」句柄即返回
    //  taskId；真正出站由句柄首轮 runOnce 在后台执行（runSubmit），失败转 failed 透传，不丢任务、不受 HTTP 超时约束。
    if (isLovartDirect(providerId)) {
      const cap = capability === 'image' ? 'IMAGE' : 'VIDEO';
      // 待提交入参快照（原始参考图 url 存库；后台提交时经 resolveLocalImages 归一为 data:base64，避免 base64 膨胀 DB）
      const pending: DirectSubmitInput = {
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        images: input.images && input.images.length > 0 ? input.images : undefined,
        resolution: input.resolution,
        duration: input.duration,
        capability: cap as 'IMAGE' | 'VIDEO',
      };
      // 落库在途行（direct 标记 + poll=null + pendingSubmit 待提交快照；taskId 暂空，提交完成后回填）
      await upsertTask(await getDb(), {
        task_id: frontTaskId,
        type: input.type || capability,
        model_name: input.model,
        status: 'running',
        progress: 0,
        created_at: Date.now(),
        request_data: JSON.stringify({
          _relayPoll: {
            taskId: '',
            poll: null,
            providerId,
            capability,
            model: input.model,
            type: input.type || capability,
            baseUrl,
            direct: true,
            pendingSubmit: pending,
            startedAt: Date.now(),
          } satisfies RelayPollSnapshot['_relayPoll'],
        } satisfies RelayPollSnapshot),
      });
      debouncedSaveDb();
      registerHandle(frontTaskId, {
        frontTaskId,
        taskId: '',
        poll: null,
        apiKey: '',
        providerId,
        capability,
        model: input.model,
        type: input.type || capability,
        baseUrl,
        direct: true,
        pendingDirectSubmit: pending,
        startedAt: Date.now(),
        timer: null,
        running: false,
        stopped: false,
        consecutiveErrors: 0,
      }, timeoutMs);
      return { ok: true, frontTaskId };
    }

    // ── 非 lovart（非 direct）：按 per-provider 自定义异步协议提交（方案①，docs/105 §阶段 C）──
    // 旧声明式 lovart-* preset 已删；该平台若未在配置文件 `model_protocols[capability]` 里自备协议，
    // 直接返回明确错误（平台暂不支持异步生成），不静默错抽、不误发 9004 信封。
    const rawProtocol = resolveProviderAsyncProtocol(providerId, capability);
    if (!rawProtocol) {
      return {
        ok: false,
        frontTaskId,
        error: `供应商 ${providerId} 暂不支持异步${capability === 'video' ? '视频' : '图片'}生成：请在平台配置文件中为 ${capability} 配置自定义调用协议（model_protocols.${capability}）`,
      };
    }
    const protocolDef: ModelProtocol = structuredClone(rawProtocol);

    // video 附参（resolution/duration）非模板字段：引擎对顶层 body 缺变量的模板字符串会抛错，
    // 故此处按「input 有值才把字面量补进 submit.body」，无值则不发（不污染通用 preset）。
    if (capability === 'video' && protocolDef.submit?.body && typeof protocolDef.submit.body === 'object' && !Array.isArray(protocolDef.submit.body)) {
      if (input.resolution) (protocolDef.submit.body as Record<string, unknown>).resolution = input.resolution;
      if (input.duration) (protocolDef.submit.body as Record<string, unknown>).duration = String(input.duration);
    }

    // 参考图归一：/files/ 磁盘图 → data:base64（唯一出站口纪律，跨平台通用——外部平台无法访问 localTool 本机地址）
    const images = input.images && input.images.length > 0
      ? ((await resolveLocalImages(input.images)) as string[])
      : undefined;

    // 【图文/图生视频修复 · 2026-09-03】image/video preset body 缺 image_url 字段，参考图只进
    // variables.imageUrls 会被引擎忽略（preset 不消费）→ 上游收不到图 → 退化文生图/文生视频。
    // 统一把 data:base64 补进 body.image_urls（所有 OpenAI 兼容平台普遍认的形态），与 chat 同一归一机制。
    if ((capability === 'image' || capability === 'video') && images && images.length > 0
        && protocolDef.submit?.body && typeof protocolDef.submit.body === 'object' && !Array.isArray(protocolDef.submit.body)) {
      (protocolDef.submit.body as Record<string, unknown>).image_urls = images;
    }

    const variables: Record<string, unknown> = { model: input.model };
    if (input.prompt !== undefined) variables.prompt = input.prompt;
    if (input.size !== undefined) variables.size = input.size;
    if (input.messages !== undefined) variables.messages = input.messages;
    if (images !== undefined && !((capability === 'image' || capability === 'video') && protocolDef.submit?.body && (protocolDef.submit.body as Record<string, unknown>).image_urls)) {
      variables.imageUrls = images; // 兼容仍需 imageUrls 变量的 preset（参考图已由 body.image_urls 携带）
    }

    const submitted: ModelProtocolSubmitResult = await protocol.submitModelProtocol({
      protocol: protocolDef,
      apiKey,
      baseUrl,
      variables,
    });
    const taskId = submitted.taskId;
    const poll = submitted.poll;
    if (!taskId || !poll) throw new Error(`提交成功但未返回可轮询句柄（${capability}）`);

    // 落库在途行（DB 真相）。node_id 归前端 taskStore.reportGenerate 写（它 create 行时带 node_id）；
    // 此处【不写 node_id】——upsert merge 会保留前端已写的正确 node_id，避免被覆盖成 providerId 等脏值。
    await upsertTask(await getDb(), {
      task_id: frontTaskId,
      type: input.type || capability,
      model_name: input.model,
      status: 'running',
      progress: 0,
      created_at: Date.now(),
      submit_ack_at: Date.now(),
      poll_task_id: taskId,
      request_data: JSON.stringify({
        _relayPoll: {
          taskId,
          poll,
          providerId,
          capability,
          model: input.model,
          type: input.type || capability,
          baseUrl,
          startedAt: Date.now(),
        } satisfies RelayPollSnapshot['_relayPoll'],
      } satisfies RelayPollSnapshot),
    });
    debouncedSaveDb();

    registerHandle(frontTaskId, {
      frontTaskId,
      taskId,
      poll,
      apiKey,
      providerId,
      capability,
      model: input.model,
      type: input.type || capability,
      baseUrl,
      startedAt: Date.now(),
      timer: null,
      running: false,
      stopped: false,
      consecutiveErrors: 0,
    }, timeoutMs);
    return { ok: true, frontTaskId };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, frontTaskId, error: err };
  }
}

/**
 * 后台补执行 lovart 原生直连出站（「提交即返回」的落地点，runOnce 首轮调用）。
 * 参考图归一 → submitLovartTask(ensureProject/mode/upload/sendChat) → 回填 thread_id、清 pending、落库。
 * @returns true=提交成功（可继续进入轮询）；false=提交失败（已置 failed + 停句柄，错误原样透传）。
 */
async function runDirectSubmit(handle: PollHandle): Promise<boolean> {
  const p = handle.pendingDirectSubmit;
  if (!p) return true;
  try {
    // 单请求超时兜底（防底层出站单步卡死无限挂；任务总时长仍由 handle 总超时约束）
    const profile = lovartDirectProfile(handle.baseUrl, undefined, DIRECT_SUBMIT_TIMEOUT_MS);
    // 参考图形态按 lovart 直连（cdn）：不预压 base64，转回环可下载 URL 交给 adapter
    // resolveLovartAttachments 自取（下载→传 CDN），省掉 encode→decode 两遍。见 resolveLocalImages.ts 头。
    const images = p.images && p.images.length > 0
      ? ((await resolveImagesForEgress(p.images, 'cdn')) as string[])
      : undefined;
    const out = await submitLovartTask(profile, {
      model: p.model,
      prompt: p.prompt,
      size: p.size,
      images,
      resolution: p.resolution,
      duration: p.duration,
      capability: p.capability,
    });
    const threadId = out.threadId;
    handle.taskId = threadId;
    handle.pendingDirectSubmit = null; // 提交完成，转入轮询阶段
    // 落库回填：thread_id + submit_ack_at + 清 pendingSubmit 快照（DB 真相，供 attach/恢复读取）
    await upsertTask(await getDb(), {
      task_id: handle.frontTaskId,
      thread_id: threadId,
      submit_ack_at: Date.now(),
      request_data: JSON.stringify({
        _relayPoll: {
          taskId: threadId,
          poll: null,
          providerId: handle.providerId,
          capability: handle.capability,
          model: handle.model,
          type: handle.type,
          baseUrl: handle.baseUrl,
          direct: true,
          startedAt: handle.startedAt,
        } satisfies RelayPollSnapshot['_relayPoll'],
      } satisfies RelayPollSnapshot),
    });
    debouncedSaveDb();
    return true;
  } catch (e) {
    // 提交失败：透传错误置 failed + 停句柄（前端经 GET attach 读到 failed，失败可见不静默）
    stopHandle(handle);
    await upsertFailed(handle, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** 注册句柄并启动定时器驱动单轮。 */
function registerHandle(frontTaskId: string, handle: PollHandle, timeoutMs: number): void {
  handles.set(frontTaskId, handle);
  const interval = Math.max(500, handle.direct
    ? DEFAULT_POLL_INTERVAL_MS
    : (handle.poll?.intervalMs || DEFAULT_POLL_INTERVAL_MS));
  const runOnce = async (): Promise<void> => {
    if (handle.stopped) return;
    if (handle.running) return; // 单轮进行中，跳过本轮防重入
    // 总超时收口：到点不再续查 → 置 failed（失败可见，不静默挂起）
    if (Date.now() - handle.startedAt > timeoutMs) {
      stopHandle(handle);
      await upsertFailed(handle, `生成超时（${Math.round(timeoutMs / 1000)}s）`);
      return;
    }
    handle.running = true;
    try {
      // direct（原生直连）→ adapter 单次轮询；其余 → 走快照中的自定义异步协议轮询
      if (handle.direct) {
        // 【根治·2026-09-04】待提交阶段：先补后台出站（提交即返回的「真正提交」），
        // 成功回填 thread_id 后本轮继续轮询；失败已在 runDirectSubmit 内置 failed + 停句柄。
        if (handle.pendingDirectSubmit) {
          const okSubmit = await runDirectSubmit(handle);
          if (!okSubmit || handle.stopped) return;
        }
        const profile = lovartDirectProfile(handle.baseUrl, undefined, DIRECT_SUBMIT_TIMEOUT_MS);
        const r = await pollLovartTaskOnce(profile, { handle: { threadId: handle.taskId, projectId: '' } });
        handle.consecutiveErrors = 0; // 本轮有响应（未抛异常）→ 重置连续失败计数
        if (handle.stopped) return;
        if (r.status === 'completed') {
          stopHandle(handle);
          await upsertCompleted(handle, r.urls ?? []);
        } else if (r.status === 'failed') {
          stopHandle(handle);
          await upsertFailed(handle, r.error || 'Lovart 任务失败');
        } else {
          await updateProgress(handle, undefined, r.error);
        }
        return;
      }
      const r = await protocol.pollModelProtocolOnce(handle.poll!, handle.apiKey, undefined, handle.baseUrl);
      handle.consecutiveErrors = 0; // 本轮有响应（未抛异常）→ 重置连续失败计数
      if (handle.stopped) return;
      if (r.status === 'completed') {
        stopHandle(handle);
        await upsertCompleted(handle, r.urls);
      } else if (r.status === 'failed') {
        stopHandle(handle);
        await upsertFailed(handle, r.error);
      } else {
        // processing：写进度；错误留痕不静默（retryable 由 manager 下轮续查）
        // 单轮异常的 error 必须透传落库，否则只写进度会把真实原因吞掉。
        await updateProgress(handle, r.progress, r.error);
      }
    } catch (e) {
      // 单轮异常（如解析失败/DB 写入异常）：不误判终态，记日志，下轮续查（受总超时约束）
      handle.lastError = e instanceof Error ? e.message : String(e);
      handle.consecutiveErrors = (handle.consecutiveErrors || 0) + 1;
      // 连续异常达阈值：实时失败透传，不再静默挂起至总超时（失败可见，不掩盖）
      if (handle.consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        stopHandle(handle);
        await upsertFailed(handle, `轮询持续异常（${handle.consecutiveErrors} 次）：${handle.lastError}`);
        return;
      }
      await updateProgress(handle, undefined, handle.lastError);
    } finally {
      handle.running = false;
    }
  };
  handle.timer = setInterval(() => { void runOnce(); }, interval);
  // 立即跑首轮
  void runOnce();
}

/** 上游已完成：落盘 /files/ → 写库 completed + result_url。 */
async function upsertCompleted(handle: PollHandle, urls: string[]): Promise<void> {
  const remoteUrl = urls && urls.length > 0 ? urls[0] : undefined;
  if (!remoteUrl) {
    await upsertFailed(handle, '任务完成但未返回可落盘的结果 URL');
    return;
  }
  let finalUrl = remoteUrl;
  let errorMsg = '';
  try {
    // 落盘归属 saveRemoteUrl（M4-C1：不依赖 kit）；落盘失败回退原 url（宁显示外链不丢）
    const saved = await saveRemoteUrl(RELAY_UPLOAD_SUBFOLDER, remoteUrl);
    finalUrl = saved?.url || remoteUrl;
  } catch (e) {
    errorMsg = `落盘失败，已回退原 URL：${e instanceof Error ? e.message : String(e)}`;
  }
  await upsertTask(await getDb(), {
    task_id: handle.frontTaskId,
    status: 'completed',
    progress: 100,
    result_url: finalUrl,
    completed_at: Date.now(),
    ...(errorMsg ? { error_msg: errorMsg } : {}),
  });
  debouncedSaveDb();
}

/** 任务失败/超时：写库 failed + error_msg。 */
async function upsertFailed(handle: PollHandle, error: string): Promise<void> {
  await upsertTask(await getDb(), {
    task_id: handle.frontTaskId,
    status: 'failed',
    progress: 0,
    error_msg: error || '生成失败',
  });
  debouncedSaveDb();
}

/** 写进度（进行中）。 */
async function updateProgress(handle: PollHandle, progress?: number, stageError?: string): Promise<void> {
  const p = typeof progress === 'number' && progress >= 0 ? Math.min(100, Math.round(progress)) : undefined;
  const patch: Record<string, unknown> = { status: 'running' };
  if (p !== undefined) patch.progress = p;
  if (stageError) patch.error_msg = stageError;
  await upsertTask(await getDb(), { task_id: handle.frontTaskId, ...patch });
  debouncedSaveDb();
}

/**
 * GET attach：查某 frontTaskId 的状态。内存句柄优先；不在内存则回库读终态。
 * 重启后句柄未重建时走 initRelayPoller 自动重建，此处回库兜底。
 */
export async function getGenerateStatus(frontTaskId: string): Promise<RelayTaskStatus> {
  const h = handles.get(frontTaskId);
  if (h) {
    const db = await getDb();
    const row = queryAll(db, 'SELECT status, progress, result_url FROM tasks WHERE task_id = ?', [frontTaskId])[0];
    if (row && row.status === 'completed' && row.result_url) {
      return { status: 'completed', url: row.result_url, type: h.type };
    }
    if (row && row.status === 'failed') {
      return { status: 'failed', error: row.error_msg || '生成失败' };
    }
    return { status: 'running', progress: typeof row?.progress === 'number' ? row.progress : undefined };
  }
  // 句柄不在内存：回库判断（可能是历史已完成/失败，或重启后尚未被扫描接管）
  const db = await getDb();
  const row = queryAll(db, 'SELECT status, progress, result_url, error_msg, poll_task_id FROM tasks WHERE task_id = ?', [frontTaskId])[0];
  if (!row) return { status: 'not-found' };
  if (row.status === 'completed' && row.result_url) {
    return { status: 'completed', url: row.result_url, type: row.type || '' };
  }
  if (row.status === 'failed') return { status: 'failed', error: row.error_msg || '生成失败' };
  if (row.status === 'running' && row.poll_task_id) {
    // 在途且句柄不在内存 → 交给扫描（若启动扫描还没跑则提示 running）
    return { status: 'running', progress: typeof row.progress === 'number' ? row.progress : undefined };
  }
  return { status: 'running', progress: typeof row.progress === 'number' ? row.progress : undefined };
}

/** cancel：停句柄 → 置 failed（供前端取消，不静默）。 */
export async function cancelGenerateTask(frontTaskId: string): Promise<{ ok: boolean }> {
  const h = handles.get(frontTaskId);
  if (h) {
    stopHandle(h);
    await upsertFailed(h, '已取消');
    return { ok: true };
  }
  return { ok: false };
}

/**
 * 启动恢复扫描（localTool 启动后调用一次）：从 DB 读在途行(status=running && poll_task_id 非空
 * && request_data._relayPoll 可解析) → 按 providerId 重读 .env key → 重建句柄续跑。
 * DB 持久态即真相，不依赖内存（docs/90 R4）。
 */
export async function initRelayPoller(opts: { timeoutMs?: number } = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  try {
    const db = await getDb();
    // 在途 relay 任务 = 有 poll_task_id（存量/新近已提交）或 request_data 内含 _relayPoll 快照的行
    // （普通前端 running 任务既无 poll_task_id 也不含此键，天然排除）。
    // 兼容待提交任务（poll_task_id 为空但快照含 _relayPoll.pendingSubmit，提交即返回后未及出站即重启）→ 一并纳入。
    const rows = queryAll(db,
      `SELECT task_id, status, poll_task_id, request_data FROM tasks WHERE status IN ('running','pending')
        AND ( (poll_task_id IS NOT NULL AND poll_task_id != '') OR request_data LIKE '%_relayPoll%' )`);
    for (const row of rows) {
      const frontTaskId = row.task_id as string;
      if (handles.has(frontTaskId)) continue;
      let snap: RelayPollSnapshot | undefined;
      try { snap = typeof row.request_data === 'string' ? JSON.parse(row.request_data) : row.request_data; } catch { snap = undefined; }
      const core = snap?._relayPoll;
      if (!core) continue; // 无 relay 快照，跳过
      const remaining = Math.max(0, timeoutMs - (Date.now() - core.startedAt));
      // 【根治·2026-09-04】待提交任务（direct 提交即返回后重启、尚未出站拿到 thread_id）：
      // 重建「待提交」句柄，首轮 runOnce 会补执行 runDirectSubmit 续跑提交，不丢任务。
      if (core.direct && !core.taskId && core.pendingSubmit) {
        registerHandle(frontTaskId, {
          frontTaskId,
          taskId: '',
          poll: null,
          apiKey: '',
          providerId: core.providerId,
          capability: core.capability,
          model: core.model,
          type: core.type,
          baseUrl: core.baseUrl,
          direct: true,
          pendingDirectSubmit: core.pendingSubmit,
          startedAt: core.startedAt,
          timer: null,
          running: false,
          stopped: false,
          consecutiveErrors: 0,
        }, Math.max(1000, remaining));
        continue;
      }
      // 已提交任务：需 thread_id(=taskId) 才能续轮询
      if (!core.taskId) continue; // 无 taskId（脏数据），跳过
      if (!core.poll && !core.direct) continue; // 非 direct 但缺 poll → 旧/脏数据，跳过
      const apiKey = resolveApiKey(core.providerId);
      registerHandle(frontTaskId, {
        frontTaskId,
        taskId: core.taskId,
        poll: core.poll ?? null,
        apiKey,
        providerId: core.providerId,
        capability: core.capability,
        model: core.model,
        type: core.type,
        baseUrl: core.baseUrl,
        direct: !!core.direct,
        startedAt: core.startedAt,
        timer: null,
        running: false,
        stopped: false,
        consecutiveErrors: 0,
      }, Math.max(1000, remaining));
    }
  } catch (e) {
    // 恢复扫描失败不阻塞服务；日志可见（失败可见，不静默）
    console.error(`[relay-poll] 恢复扫描失败：${e instanceof Error ? e.message : String(e)}`);
  }
}
