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
  getModelProtocolPreset,
  getProviderDefinition,
} from './ai-relay/index.js';
import type {
  ModelProtocol,
  ModelProtocolPresetName,
  ModelProtocolSubmitResult,
  ResolvedPollConfig,
  AuthConfig,
} from './ai-relay/types.js';
import {
  submitLovartTask,
  pollLovartTaskOnce,
} from './ai-relay/providers/lovart/index.js';
import { stableRequest } from './ai-relay/httpTransport.js';
import { LOVART_DIRECT_BASE_URL } from './ai-relay/providerEndpoints.js';
import type { LovartDirectProfile, LovartTransport } from './ai-relay/providers/lovart/lovart_contract.js';
import { fetchWithProxy } from './utils/netProxy.js';
import { resolveLocalImages } from './utils/resolveLocalImages.js';
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

/** capability → ai-relay preset 名（lovart 第 13 平台） */
function presetNameFor(capability: RelayCapability): ModelProtocolPresetName {
  switch (capability) {
    case 'image': return 'lovart-image';
    case 'video': return 'lovart-video';
    default: return 'lovart-chat';
  }
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

/** 判断是否为 lovart（原生直连，走 providers/lovart adapter，无 9004 网关）。 */
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
 * 凭证真源 = localTool 启动时从 apimart-gateway/.env 注入的 process.env.LOVART_ACCESS_KEY/SECRET_KEY
 * （见 src/index.ts loadDotEnv 处）。仅驻内存，不入 DB。
 * transport：注入走代理的 stableRequest（lovart.ai 域名必须经代理，见 netProxy.ts）。
 */
function lovartDirectProfile(baseUrl: string, signal?: AbortSignal, timeoutMs?: number): LovartDirectProfile {
  const accessKey = process.env.LOVART_ACCESS_KEY || '';
  const secretKey = process.env.LOVART_SECRET_KEY || '';
  if (!accessKey || !secretKey) {
    throw new Error('lovart 需要 LOVART_ACCESS_KEY 与 LOVART_SECRET_KEY（apimart-gateway/.env）');
  }
  const auth: AuthConfig = { type: 'hmac', accessKey, secretKey };
  return { baseUrl: baseUrl || LOVART_DIRECT_BASE_URL, auth, signal, timeoutMs, transport: lovartProxyTransport() };
}

// ── 轮询时序默认值（对齐前端 config.ts GEN_TIMEOUT/VIDEO_TIMEOUT 语义）──
const DEFAULT_POLL_INTERVAL_MS = 3000;   // 单轮间隔（lovart preset 也是 3s）
const DEFAULT_TOTAL_TIMEOUT_MS = 10 * 60 * 1000; // 总超时兜底，防无限挂（对齐 relay.ts 10min）
// 连续单轮异常达此阈值 → 立即 failed 透传（默认 3s×30≈90s），避免未知持续异常静默挂起至总超时
const MAX_CONSECUTIVE_POLL_ERRORS = 30;

/** 落盘 /files/tasks/ 归属子目录（对齐 relay.ts RELAY_UPLOAD_SUBFOLDER）。 */
const RELAY_UPLOAD_SUBFOLDER = 'tasks';

/** 内存句柄（key 不入库） */
interface PollHandle {
  frontTaskId: string;
  taskId: string;        // 上游 task_id（9004=网关 task_id；lovart=thread_id）
  poll: ResolvedPollConfig | null; // 自包含、可 JSON 快照；不含 key。direct 任务为 null
  apiKey: string;        // 驻内存；重启重建时按 providerId 重读（direct 任务可为空串）
  providerId: string;
  capability: RelayCapability;
  model: string;
  type: string;
  baseUrl: string;
  /** true = lovart 原生直连任务（经 providers/lovart adapter 轮询，无声明式 poll） */
  direct?: boolean;
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
    if (isLovartDirect(providerId)) {
      // 参考图归一：/files/ 磁盘图 → data:base64（唯一出站口纪律，与 preset 路一致）
      const images = input.images && input.images.length > 0
        ? ((await resolveLocalImages(input.images)) as string[])
        : undefined;
      const profile = lovartDirectProfile(baseUrl);
      const cap = capability === 'image' ? 'IMAGE' : 'VIDEO';
      const handle = await submitLovartTask(profile, {
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        images,
        resolution: input.resolution,
        duration: input.duration,
        capability: cap as 'IMAGE' | 'VIDEO',
      });
      const threadId = handle.threadId;
      // 落库在途行（与 preset 路同结构，direct 标记 + poll=null）
      await upsertTask(await getDb(), {
        task_id: frontTaskId,
        type: input.type || capability,
        model_name: input.model,
        status: 'running',
        progress: 0,
        created_at: Date.now(),
        submit_ack_at: Date.now(),
        poll_task_id: threadId,
        request_data: JSON.stringify({
          _relayPoll: {
            taskId: threadId,
            poll: null,
            providerId,
            capability,
            model: input.model,
            type: input.type || capability,
            baseUrl,
            direct: true,
            startedAt: Date.now(),
          } satisfies RelayPollSnapshot['_relayPoll'],
        } satisfies RelayPollSnapshot),
      });
      debouncedSaveDb();
      registerHandle(frontTaskId, {
        frontTaskId,
        taskId: threadId,
        poll: null,
        apiKey: '',
        providerId,
        capability,
        model: input.model,
        type: input.type || capability,
        baseUrl,
        direct: true,
        startedAt: Date.now(),
        timer: null,
        running: false,
        stopped: false,
        consecutiveErrors: 0,
      }, timeoutMs);
      return { ok: true, frontTaskId };
    }

    const protocolDef: ModelProtocol = structuredClone(getModelProtocolPreset(presetNameFor(capability)));

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
      // direct（原生直连）→ adapter 单次轮询；其余 → 声明式 preset 轮询
      if (handle.direct) {
        const profile = lovartDirectProfile(handle.baseUrl);
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
    const rows = queryAll(db,
      `SELECT task_id, status, poll_task_id, request_data FROM tasks WHERE status IN ('running','pending') AND poll_task_id IS NOT NULL AND poll_task_id != ''`);
    for (const row of rows) {
      const frontTaskId = row.task_id as string;
      if (handles.has(frontTaskId)) continue;
      let snap: RelayPollSnapshot | undefined;
      try { snap = typeof row.request_data === 'string' ? JSON.parse(row.request_data) : row.request_data; } catch { snap = undefined; }
      const core = snap?._relayPoll;
      // direct 任务（lovart）：允许 poll 为 null，仅需 thread_id(=taskId)
      if (!core || !core.taskId) continue; // 无轮询快照（旧数据），跳过
      if (!core.poll && !core.direct) continue; // 非 direct 但缺 poll → 旧/脏数据，跳过
      const apiKey = resolveApiKey(core.providerId);
      const remaining = Math.max(0, timeoutMs - (Date.now() - core.startedAt));
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
