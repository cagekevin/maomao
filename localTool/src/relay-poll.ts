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
 *
 * 更新(2026-09-16 · TD-08-24)：新增**第三终态 `unknown`**（提交结果未知）——
 *  - `runDirectSubmit` 拆三级容错：① 前置失败（未出站）→ `failed`；② `submitLovartTask` 失败
 *    （POST /chat 已发出、响应可能丢失）→ `unknown`；③ 落库失败（上游已受理但本地没记下）→ `unknown`。
 *  - **提交成功写库的顺序**改为「先落库 thread_id／清 pendingSubmit，再改内存」——
 *    否则崩溃窗口里 DB 仍留 `pendingSubmit` 快照，重启会**再提交一次**（Lovart 无幂等 → 重复计费）。
 *  - 恢复扫描（initRelayPoller）仍只接管 `running`/`pending`：`unknown` 是终态，**不得自动重提**。
 */

import { protocol } from './ai-relay/index.js';
import type {
  ModelProtocol,
  ModelProtocolSubmitResult,
  ResolvedPollConfig,
  ModelProtocolProfile,
} from './ai-relay/types.js';
import { submitLovartTask, pollLovartTaskOnce } from './ai-relay/providers/lovart/index.js';
import { budgetMsFor } from './budget.js';
import { isRelayCapability, type RelayCapability } from './capability.js';
import { resolveLocalImages, resolveImagesForEgress } from './utils/resolveLocalImages.js';
import { saveRemoteUrl } from './routes/files.js';
import { upsertTask } from './routes/tasks.js';
import {
  readProviderConfigFile,
  resolveProviderBaseUrl,
  resolveProviderApiKey,
  buildLovartDirectProfile,
} from './providerConfigStore.js';
import { getDb, queryAll, debouncedSaveDb, flushSaveDb } from './db/database.js';
import { readRelaySnapshot } from './db/relaySnapshot.js';

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

/**
 * 任务句柄状态成员集合（**唯一真源**）。
 *
 * 【为什么抽成常量】`RelayTaskStatus` 是**判别联合**（每个状态带自己的必需载荷），无法直接由数组派生；
 * 但「有哪些状态」这个**成员集合**必须单点 —— 前端 `RelayTaskStatusValue`（relayProxy.ts）是同一判据的
 * 跨栈另一份（两栈无共享模块 ⇒ 结构必然），由 `check:arch` 的 `CROSS_STACK_UNIONS` 逐字对账（ADR-0057。
 * 判别联合与本表的一致性由下方**编译期断言**锁死：漏登记 / 多登记均编译报错（TD-01-29）。
 */
export const RELAY_TASK_STATUSES = [
  'running',
  'completed',
  'failed',
  'unknown',
  'not-found',
] as const;

/** 任务句柄状态取值（由值派生；跨栈与前端 `RelayTaskStatusValue` 同集合）。 */
export type RelayTaskStatusValue = (typeof RELAY_TASK_STATUSES)[number];

/** 任务查询结果（GET attach / status） */
export type RelayTaskStatus =
  | { status: 'running'; progress?: number; budgetMs?: number }
  | { status: 'completed'; url: string; type: string; budgetMs?: number }
  | { status: 'failed'; error: string; budgetMs?: number }
  /**
   * 【TD-08-24 · 2026-09-16】提交结果未知（付费任务专属第三终态）。
   *
   * 【为什么需要】`sendLovartChat` 是「POST /chat 等响应」——请求**已发出**但响应丢失（超时/断连/
   * 解析失败）时必抛错，而**上游 thread 可能已创建并在跑**。原实现一律置 `failed` ⇒ 任务中心显示
   * 「失败」⇒ 用户手动重提 ⇒ **重复计费**（且旧任务仍在跑，白花钱）。
   * 对齐外部 AIFISHER B.1 铁律：**提交确认丢失绝不直接重提，须 unknown + 远端核对**。
   *
   * 【与 failed 的差别（务必区分，勿合并）】`failed` = 确定没跑（本地前置失败/上游明确报错）；
   *   **"已取消"不属此档** —— 取消时上游可能仍在跑，不得与"确定没跑"同档。
   *   `unknown` = **可能已在跑**，判 failed 会诱导重复付费。前端据此给「需确认」语义而非「红失败」。
   */
  // 【TD-08-55】**保留** `threadId?`，并把缺的**生产者**补上（原先是"消费方在、生产者缺"）：
  //   · `threadId` = lovart 上游任务号（`sendLovartChat` 返回 → 落 `tasks.poll_task_id` / 写句柄 `handle.taskId`）；
  //   · **消费方一直在**：`routes/generate.ts` 的 GET 响应把它透给前端（`data.threadId`）；
  //   · 原先两个返回口都不填它 ⇒ 消费者永远拿到 `undefined`。
  //   ⇒ 按 Step 4：**消费者要而生产者没给 ⇒ 回生产者补契约**（禁止改消费端/删字段）。
  //   可选是因为它**本就可能未知**（sendChat 失败时拿不到 threadId，见 `upsertUnknown` 注释）。
  | { status: 'unknown'; error: string; threadId?: string }
  /**
   * 【D16】`not-found` = 后端**没有可跟踪的记录**。带可选 `error` 给**可展示文案**（生产者给全）——
   * 它有两种成因（"行根本不存在" vs "行存在但后端从未持有"），各自文案不同，
   * 前端原样透出，**不自己拼错误文案**（三铁律：消费者只转发）。
   */
  | { status: 'not-found'; error?: string };

// 【编译期一致性守卫】判别联合的 status 集合 ⟷ `RELAY_TASK_STATUSES` 必须**双向相等**：
// 任一侧多/少一个状态 ⇒ 下面类型约束不满足 ⇒ **编译报错**（比任何运行时断言都早、且不可绕过）。
// 反证：往判别联合加一个 `| { status: 'cancelled' }` 而不入常量表 ⇒ 第一条守卫红；
//       往常量表加 'cancelled' 而不入判别联合 ⇒ 第二条守卫红。
type _AssertTrue<T extends true> = T;
type _TaskStatusAllRegistered = _AssertTrue<
  Exclude<RelayTaskStatus['status'], RelayTaskStatusValue> extends never ? true : false
>;
type _TaskStatusNoExtraMember = _AssertTrue<
  Exclude<RelayTaskStatusValue, RelayTaskStatus['status']> extends never ? true : false
>;

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
  if (entry == null || typeof entry !== 'object') return null;
  // 兼容两种落盘形态：完整 ModelProtocolProfile（含 preset）或裸 ModelProtocol（按 custom 封装）
  const profile: ModelProtocolProfile =
    typeof entry === 'object' &&
    entry !== null &&
    'preset' in entry &&
    (entry as ModelProtocolProfile).preset
      ? (entry as ModelProtocolProfile)
      : { preset: 'custom', protocol: entry as ModelProtocol };
  return protocol.resolveModelExecutionProfile(profile);
}

// 平台 baseUrl / apiKey 唯一实现已收口 providerConfigStore（resolveProviderBaseUrl /
// resolveProviderApiKey），本文件不再持有副本（2026-09-11 单一规则收口）。
// 历史（2026-09-03 修复）：只读内置目录会忽略用户配置 → 报「未配置接口地址」，
// 该语义已完整迁移至 resolveProviderBaseUrl，勿在此处恢复第二份实现。

/** 判断是否为 lovart（原生直连，走 providers/lovart adapter）。 */
function isLovartDirect(providerId: string): boolean {
  return providerId === 'lovart';
}

// ── 轮询时序默认值 ──
const DEFAULT_POLL_INTERVAL_MS = 3000; // 单轮间隔（异步任务轮询默认）
// 【143 · S2′-b】原 `DEFAULT_TOTAL_TIMEOUT_MS = 10 分钟` 已删 —— 总预算**唯一真源** =
// `budgetMsFor(capability, override?)`（`src/budget.ts`）。本文件不再自持默认值：
// 默认由真源给，调用方只能给 `override`（"我这次只等 N 秒"）。
/** direct(lovart) 单次出站请求超时兜底（后台补提交/轮询的底层**单请求**上限，防无限挂）。
 *  注：① 只兜「连不上/单步卡死」，**绝不**替代任务总预算（生成本身可远超此值）；
 *      ② 它与 `LOVART_DEFAULT_TIMEOUT_MS` 同值但**判据不同**（这里是"单请求"、那里是"lovart 出站默认"）
 *      —— 同值不是同义，**不许**按"统一"合并（ADR-0031：判据重复禁合并）。 */
const DIRECT_SUBMIT_TIMEOUT_MS = 180_000;
// 连续单轮异常达此阈值 → 立即 failed 透传（默认 3s×30≈90s），避免未知持续异常静默挂起至总超时
const MAX_CONSECUTIVE_POLL_ERRORS = 30;

/** 落盘 /files/tasks/ 归属子目录（对齐 relay.ts RELAY_UPLOAD_SUBFOLDER）。 */
const RELAY_UPLOAD_SUBFOLDER = 'tasks';

/**
 * lovart 直连 profile 的类型（由 `buildLovartDirectProfile` 推导）。
 * 用途：同一轮 runOnce 内「补提交」与「轮询」共用同一个 profile，需作为参数传递。
 * 用 ReturnType 推导而非从 providers 内部 import 类型，避免 relay-poll 反向依赖 adapter 内部文件。
 */
type LovartDirectProfile = ReturnType<typeof buildLovartDirectProfile>;

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
  /**
   * 参考图原始 url 列表（/files/ 或外链）。**存库保留原值**（避免 base64 膨胀 DB），
   * 真正的出站归一推迟到后台提交时由 runDirectSubmit **就地**决定（本通道走回环 URL，不是 base64）。
   */
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
  taskId: string; // 上游 task_id（异步网关=网关 task_id；lovart=thread_id）；direct 待提交阶段为空串
  poll: ResolvedPollConfig | null; // 自包含、可 JSON 快照；不含 key。direct 任务为 null
  apiKey: string; // 驻内存；重启重建时按 providerId 重读（direct 任务可为空串）
  providerId: string;
  capability: RelayCapability;
  /**
   * 【143 · S3′】本句柄**实际生效**的任务预算（由 `registerHandle` 从真源算好后回填，不手填）。
   * 用途：`getGenerateStatus` 把它透给前端 ⇒ 前端不必自持等待上限（消费者不许替生产者定真相）。
   * 可选是因为它由 registerHandle 赋值（不要求 4 处字面量各写一遍）。
   */
  budgetMs?: number;
  model: string;
  type: string;
  baseUrl: string;
  /** true = lovart 原生直连任务（经 providers/lovart adapter 轮询，无声明式 poll） */
  direct?: boolean;
  /** direct 待提交入参：非空=尚未出站，首轮先 submit 再轮询；空/undefined=已完成提交进入轮询（根治·提交即返回） */
  pendingDirectSubmit?: DirectSubmitInput | null;
  startedAt: number;
  /**
   * 【段边界 · 2026-09-21】交出 thread_id / 上游 task_id 的时刻（= `submit_ack_at` 的写入点）。
   * `undefined` = 仍在「我们段」（提交 + 素材出站）；有值 = 已交出，**上游段的预算从这里起算**。
   *
   * 为什么必须有它：原先**一个**总超时同时装了这两段 —— 素材出站（实测 3s↔69s：adapter 下载回环
   * +传 CDN+建 project）的耗时被记在上游账上，超时还统一报成"生成超时"（责任与文案双错位：
   * 上游最终成功落盘的任务，前端/后端已按"生成超时"判死）。
   */
  upstreamStartedAt?: number;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean; // 单轮执行中防重入
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
  if (h.timer) {
    clearInterval(h.timer);
    h.timer = null;
  }
  if (handles.get(h.frontTaskId) === h) handles.delete(h.frontTaskId);
}

/** request_data 里内嵌的 relay 轮询快照（可 JSON 序列化，key 不入库） */
interface RelayPollSnapshot {
  _relayPoll: {
    taskId: string; // 上游 task_id（direct=thread_id）
    poll: ResolvedPollConfig | null; // 自包含轮询配置；direct 任务为 null
    providerId: string;
    capability: RelayCapability;
    model: string;
    type: string;
    baseUrl: string;
    direct?: boolean; // true = lovart 原生直连
    /** direct 待提交入参快照（重启后重建句柄续跑提交用）；提交完成后清除。非 direct 无此字段 */
    pendingSubmit?: DirectSubmitInput;
    startedAt: number;
  };
  /** 段①（发送 Lovart 成功前）子步骤耗时（毫秒），仅观测用、不影响行为。 */
  submitTiming?: {
    queueMs: number; // 进队 -> 真正开始提交（含轮询首跳延迟）
    egressMs: number; // resolveImagesForEgress（cdn 形态：仅改 URL，几乎为 0）
    modeMs: number; // setLovartMode
    attachmentsMs: number; // 下载本机回环参考图 + 传 Lovart CDN（重灾区候选）
    sendChatMs: number; // sendLovartChatWithProject
    imageCount: number; // 参考图张数
    totalMs: number; // 段① 总长 = submit_ack_at − startedAt
  };
}

/**
 * 提交一个异步任务：经 kit submitModelProtocol 拿上游 task_id + 自包含轮询配置，
 * 落库在途行(status=running) → 注册句柄 → 返回 frontTaskId（不等终态）。
 */
export async function submitGenerateTask(
  input: RelaySubmitInput,
): Promise<{ ok: boolean; frontTaskId: string; error?: string; budgetMs: number }> {
  const { frontTaskId } = input;
  // 【143 · S2′-b + S3′】预算在此**解析一次**，然后两用：① 作为 override 交给 registerHandle
  // （保证"响应里告知的值"与"句柄实际生效的值"**同一个数**，不可能分叉）；② 随响应回给前端。
  // `input.timeoutMs` 只是 override；缺省由真源 `budgetMsFor(capability)` 给。
  const budgetMs = budgetMsFor(input.capability, input.timeoutMs);
  try {
    // 已存在句柄 → 视为幂等重放，直接返回（防重复提交双轮询）。预算取**在册句柄的**（那才是生效值）。
    if (handles.has(frontTaskId)) {
      return { ok: true, frontTaskId, budgetMs: handles.get(frontTaskId)?.budgetMs ?? budgetMs };
    }

    const providerId = input.providerId || 'lovart';
    const capability = input.capability;
    const baseUrl = resolveProviderBaseUrl(providerId, input.baseUrl);
    // 注：apiKey 仅「非 direct（声明式协议）」出站需要，故延后到该分支再解析——
    // lovart 直连走 buildLovartDirectProfile 自取 LOVART_* 凭证，此前无条件先算一次是死调用。

    // ── lovart 原生直连：走 providers/lovart adapter（HMAC + chat-thread），不进声明式 preset ──
    // 【视频 / 音频为什么在这条通道上能过、在通用通道上过不了 —— 不是形态问题，是**能力**问题】
    //   图片能内联；视频 / 音频将来要**抽帧转图**（拆成多张图片再发）。设计留痕见
    //   src/components/agent/runtime/agentCore.ts:56-63（「其它平台：由后端抽帧转图 … ⚠️ 目前未实现」）。
    //   本分支把素材交给 adapter 自取字节再上传 ⇒ **全程不经 Jimp** ⇒ mp4 天然能过；
    //   通用通道（下方非 direct 分支）今天没有抽帧 ⇒ mp4 内联必失败、只能保留原 URL
    //   （那里的 error 是**真警**，不是噪音）。
    //   ⚠️ 抽帧未实现前**不建抽象**（Step 3：只有"原样透传"一种实现 = 假接缝）。
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
      // 【TD-08-39】提交**前**的「可能已出站」快照必须立刻落盘：否则窗口内崩机 ⇒ 重启按旧文件
      // 看不到这行（任务凭空消失），用户重发 ⇒ 上游其实可能已在跑 = 重复计费。
      flushSaveDb();
      registerHandle(
        frontTaskId,
        {
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
        },
        budgetMs, // 已解析的生效预算（同一数回给前端，见函数头注释）
      );
      return { ok: true, frontTaskId, budgetMs };
    }

    // ── 非 lovart（非 direct）：按 per-provider 自定义异步协议提交（方案①，docs/105 §阶段 C）──
    // 旧声明式 lovart-* preset 已删；该平台若未在配置文件 `model_protocols[capability]` 里自备协议，
    // 直接返回明确错误（平台暂不支持异步生成），不静默错抽、不误发 9004 信封。
    const apiKey = resolveProviderApiKey(providerId);
    const rawProtocol = resolveProviderAsyncProtocol(providerId, capability);
    if (!rawProtocol) {
      return {
        ok: false,
        frontTaskId,
        budgetMs,
        error: `供应商 ${providerId} 暂不支持异步${capability === 'video' ? '视频' : '图片'}生成：请在平台配置文件中为 ${capability} 配置自定义调用协议（model_protocols.${capability}）`,
      };
    }
    const protocolDef: ModelProtocol = structuredClone(rawProtocol);

    // video 附参（resolution/duration）非模板字段：引擎对顶层 body 缺变量的模板字符串会抛错，
    // 故此处按「input 有值才把字面量补进 submit.body」，无值则不发（不污染通用 preset）。
    if (
      capability === 'video' &&
      protocolDef.submit?.body &&
      typeof protocolDef.submit.body === 'object' &&
      !Array.isArray(protocolDef.submit.body)
    ) {
      if (input.resolution)
        (protocolDef.submit.body as Record<string, unknown>).resolution = input.resolution;
      if (input.duration)
        (protocolDef.submit.body as Record<string, unknown>).duration = String(input.duration);
    }

    // 参考图归一：/files/ 磁盘图 → data:base64（唯一出站口纪律，跨平台通用——外部平台无法访问 localTool 本机地址）
    const images =
      input.images && input.images.length > 0
        ? ((await resolveLocalImages(input.images)) as string[])
        : undefined;

    // 【2026-09-22 收口】参考图「怎么发」归【协议】所有，调度器只负责「给全信息」。
    //
    // 【旧形态与它挡死的能力】原实现把参考图硬编码塞进 `body.image_urls`（OpenAI 形态），
    // 且 `variables.imageUrls` 的赋值反向挂在「body 里有没有 image_urls」上 —— 两处互相纠缠，
    // 后果是【非 OpenAI 形态的平台根本表达不出参考图】：
    //   ① 平台不认 `image_urls`（如豆包只认 `referenceImage` 文件字段 / `referenceImageUrl`）
    //      ⇒ 参考图被静默丢弃、退化成文生视频（违反「绝不静默降级为无参考图」）；
    //   ② 因 `body.image_urls` 已被注入，`variables.imageUrls` 反而不赋值
    //      ⇒ 协议模板拿不到参考图，写不出 multipart `$file`。
    //
    // 【现形态】调度器只把参考素材放进**引擎钦定的那一个变量** `referenceImageUrls`
    // （名字唯一来源：`protocol/shared.ts` 的 `FOR_EACH_VARIABLE_ROOTS` —— `$forEach` 只信它；
    //  同义的 `imageUrls` 属第二份名字，已在此路径停用，不再赋值）。
    // 至于放进请求体的哪个字段（`image_urls` / `$file` 文件字段 / `referenceImageUrl`），
    // 由各平台协议模板自己声明 —— 调度器不再替所有平台决定字段名。
    //
    // 【爆炸半径 = 0 的凭证】出厂种子无 model_protocols；运行期 17 份 provider 配置的
    // `model_protocols` 全为空对象（非空命中 0 个 / 空对象命中 17 个）⇒ 无任何存量消费方。
    const variables: Record<string, unknown> = { model: input.model };
    if (input.prompt !== undefined) variables.prompt = input.prompt;
    if (input.size !== undefined) variables.size = input.size;
    if (input.messages !== undefined) variables.messages = input.messages;
    if (images !== undefined) variables.referenceImageUrls = images;

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
    // 【TD-08-38 · 2026-09-17 定契】归属已按写方分层：node_id / type / model_name / prompt 等**归属与展示列**
    // 归前端（`owner:'client'` 可写），而 status / progress / result_url / request_data 等**执行态列**归本文件
    // （`owner:'poller'`）——前端来路写不动它们（见 `routes/tasks.ts::EXECUTION_OWNED_COLUMNS`）。
    // 【段边界】上游 task_id 已拿到 = 已交出 ⇒ 段② 从这里起算（与 submit_ack_at 同一时刻，单一来源）
    const upstreamStartedAt = Date.now();
    await upsertTask(await getDb(), {
      task_id: frontTaskId,
      type: input.type || capability,
      model_name: input.model,
      status: 'running',
      progress: 0,
      created_at: Date.now(),
      submit_ack_at: upstreamStartedAt,
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
    // 【TD-08-39】「已出站」这一事实必须落到磁盘才继续：内存写完就往下走、磁盘仍是旧文件时被杀，
    // 重启会看不到已提交的 taskId（该任务在本地"从未存在"）⇒ 用户重发 = 重复计费。
    flushSaveDb();

    registerHandle(
      frontTaskId,
      {
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
        upstreamStartedAt,
        timer: null,
        running: false,
        stopped: false,
        consecutiveErrors: 0,
      },
      budgetMs, // 已解析的生效预算（同一数回给前端）
    );
    return { ok: true, frontTaskId, budgetMs };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, frontTaskId, budgetMs, error: err };
  }
}

/**
 * 后台补执行 lovart 原生直连出站（「提交即返回」的落地点，runOnce 首轮调用）。
 * 参考图归一 → submitLovartTask(ensureProject/mode/upload/sendChat) → 回填 thread_id、清 pending、落库。
 *
 * 【TD-08-24 · 2026-09-16 · 两级 try：失败可归因】本函数的失败分两类，**必须分开处置**：
 *   ① **前置失败**（参考图归一异常）→ 请求**根本没出站** → 确定没跑 → `failed` 正确；
 *   ② **`submitLovartTask` 内 `sendLovartChat` 失败** → POST /chat **已发出**、响应可能丢失 →
 *      **上游 thread 可能已建并在跑** → 判 `unknown`（不判 failed，防诱导用户重提 → 重复计费）。
 *   注：`submitLovartTask` 内部步骤（setMode / 附件上传 / ensureProject）失败时同样「可能已部分出站」，
 *   无远端核对手段 ⇒ **一律归入 ② 的 unknown**（宁 unknown 不 failed —— 代价是用户多看一眼，
 *   而误判 failed 的代价是**重复付费**）。
 * @returns true=提交成功（可继续进入轮询）；false=提交失败（已置 failed/unknown + 停句柄，错误原样透传）。
 */
async function runDirectSubmit(handle: PollHandle, profile: LovartDirectProfile): Promise<boolean> {
  const p = handle.pendingDirectSubmit;
  if (!p) return true;
  // 段① 观测：进队 -> 真正开始提交 的排队耗时（含轮询首跳延迟）。
  const qStart = Date.now();
  let submitTiming: RelayPollSnapshot['submitTiming'];
  // ① 前置阶段（纯本机，未出站）：失败 ⇒ 确定没跑 ⇒ failed。
  let images: string[] | undefined;
  let egressMs = 0;
  try {
    // 参考图形态按 lovart 直连（cdn）：不预压 base64，转回环可下载 URL 交给 adapter
    // resolveLovartAttachments 自取（下载→传 CDN），省掉 encode→decode 两遍。见 resolveLocalImages.ts 头。
    // **只有这一个平台走这条，且只是为了省这一步** —— 妥协，不是架构维度：
    // 就地决定，不设判据层、不写 ADR、不据此切文件或建"通道 / 平台"层。
    const tEg0 = Date.now();
    images =
      p.images && p.images.length > 0
        ? ((await resolveImagesForEgress(p.images, 'cdn')) as string[])
        : undefined;
    egressMs = Date.now() - tEg0;
  } catch (e) {
    stopHandle(handle);
    await upsertFailed(handle, e instanceof Error ? e.message : String(e));
    return false;
  }
  // ② 提交阶段（可能已出站）：失败 ⇒ unknown（远端可能已在跑），**绝不判 failed**。
  let threadId: string;
  try {
    const out = await submitLovartTask(profile, {
      model: p.model,
      prompt: p.prompt,
      size: p.size,
      images,
      resolution: p.resolution,
      duration: p.duration,
      capability: p.capability,
    });
    threadId = out.threadId;
    const t = out.timing;
    const queueMs = qStart - handle.startedAt;
    submitTiming = {
      queueMs,
      egressMs,
      modeMs: t?.modeMs ?? -1,
      attachmentsMs: t?.attachmentsMs ?? -1,
      sendChatMs: t?.sendChatMs ?? -1,
      imageCount: t?.imageCount ?? 0,
      totalMs: Date.now() - handle.startedAt,
    };
    console.log(
      `[relay:段①] ${handle.frontTaskId} 发送前 ${submitTiming.totalMs}ms ` +
        `(queue=${queueMs} egress=${egressMs} mode=${submitTiming.modeMs} ` +
        `attach=${submitTiming.attachmentsMs} send=${submitTiming.sendChatMs} imgs=${submitTiming.imageCount})`,
    );
  } catch (e) {
    stopHandle(handle);
    // 消息里带「可能已提交」+ 原文（上游返回什么就透传什么，不翻译不静默）。
    await upsertUnknown(handle, e instanceof Error ? e.message : String(e));
    return false;
  }
  try {
    // 【TD-08-24 修复 2026-09-16 · 顺序即正确性】**先落库（DB 真相），再改内存** —— 原实现反了：
    //   先进内存(`handle.taskId=…` / `pendingDirectSubmit=null`)→ 再 `await upsertTask`；若在两者之间进程崩溃
    //   （或被 kill / 断电），DB 里 `pendingSubmit` **快照仍在** ⇒ 重启 `initRelayPoller` 判定「尚未出站」⇒
    //   **再提交一次**（Lovart 无客户端幂等 → 新 thread → **重复计费**）。
    //   现改为先写库：崩溃只会发生在「DB 已记 thread_id + 已清 pendingSubmit」之后 ⇒ 重启走**续轮询**分支，
    //   `core.taskId` 非空且无 `pendingSubmit` ⇒ 绝不重提交。落库本身失败（异常）则由 catch 兜底，
    //   此时内存未改、句柄已停，语义仍一致（见下方 catch 的 unknown 处置）。
    //   【TD-08-39 补 · 2026-09-17】当时只做到「写内存 DB 再改内存」，**磁盘仍差 500ms**（`debouncedSaveDb`）
    //   ⇒ 重启 `getDb` 从文件加载，读到的还是含 `pendingSubmit` 的旧快照 ⇒ 窗口照旧。故本处落库后必须
    //   `flushSaveDb()`（同步原子落盘）——「先落库」只有在**落到磁盘**之后才算数。
    // 落库回填：thread_id + submit_ack_at + 清 pendingSubmit 快照（DB 真相，供 attach/恢复读取）
    // 【段边界】交出 thread_id 的时刻 —— 段② 起算点，与 submit_ack_at 同一时刻（单一来源）
    const ackAt = Date.now();
    await upsertTask(await getDb(), {
      task_id: handle.frontTaskId,
      thread_id: threadId,
      submit_ack_at: ackAt,
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
        ...(submitTiming ? { submitTiming } : {}),
      } satisfies RelayPollSnapshot),
    });
    // 【TD-08-39】**本处是重复计费窗口的正门**：上面已写 `thread_id` + 清 `pendingSubmit` 快照，
    // 必须同步落盘才能保证"崩溃后重启读到的是已出站"（TD-08-24 的"先落库再改内存"只保证了**内存**顺序，
    // 磁盘仍差 500ms ⇒ 重启按旧文件读到 pendingSubmit ⇒ 重提交）。改 `flushSaveDb()` 后，
    // 只有"DB 已记 thread_id 且无 pendingSubmit"才会走到下面改内存。
    flushSaveDb();
    // 落库成功后才改内存：提交完成，转入轮询阶段（段边界与上面落库的 submit_ack_at 同刻）
    handle.taskId = threadId;
    handle.upstreamStartedAt = ackAt;
    handle.pendingDirectSubmit = null;
    return true;
  } catch (e) {
    // ③ 落库失败：**上游已受理**（threadId 已拿到）但本地没记下 ⇒ 也是「结果未知」，
    //    不能判 failed（那会诱导重提 → 重复计费）。unknown 文案带上 threadId 便于人工核对。
    stopHandle(handle);
    await upsertUnknown(handle, e instanceof Error ? e.message : String(e), threadId);
    return false;
  }
}

/**
 * 注册句柄并启动定时器驱动单轮。
 *
 * 【143 · S2′-b】预算**不再由调用方传**（原先第 3 参 `timeoutMs`）—— 改为在此按
 * `handle.capability` 向**真源**取（`budgetMsFor`）。这样：
 *   · 默认值只有一处（`src/budget.ts`），4 个调用点不必各记一个数；
 *   · `overrideMs` 仍是**输入**（调用方本次耐心），非法值由 `budgetMsFor` 兜回默认。
 */
function registerHandle(frontTaskId: string, handle: PollHandle, overrideMs?: number): void {
  const timeoutMs = budgetMsFor(handle.capability, overrideMs);
  handle.budgetMs = timeoutMs; // 回填：GET attach 要把它透给前端（S3′）
  handles.set(frontTaskId, handle);
  const interval = Math.max(
    500,
    // 【S0 · `poll.*` 的消费点清单（2026-09-22 二次复核修正）】
    //   · **本行**：句柄侧只读 `poll.intervalMs`（单轮间隔）。
    //   · **本文件另一处**：`runOnce` 把整个 `poll` 交给 `pollModelProtocolOnce`，但该函数是**单轮打点**，
    //     **不消费 `maxDurationMs`**（`ai-relay/protocol/poll.ts:114-178` 体内**无 `pollTask` 调用**）⇒
    //     **本路径的任务超时只由上一行的 `budgetMsFor` 管**。
    //   · `maxDurationMs` 真正的消费者 = sync 链（`pollResolvedModelProtocol` ← `executeModelProtocol`），
    //     那是**协议执行层**超时，与任务预算**不同判据、作用域不相交**。
    //   ⚠️ 本轮曾误改成"两条链都消费"——根因是**行号归属误判**（`maxDuration:` 在 `pollResolvedModelProtocol` 内）；
    //     教训：**"搜到一行"也要确认那行属于哪个函数**。留痕：`daily/架构日志/08-跨区-TD-08-60改判-2026-09-22.md`。
    handle.direct ? DEFAULT_POLL_INTERVAL_MS : handle.poll?.intervalMs || DEFAULT_POLL_INTERVAL_MS,
  );
  const runOnce = async (): Promise<void> => {
    if (handle.stopped) return;
    if (handle.running) return; // 单轮进行中，跳过本轮防重入
    // ══ 分段计时（2026-09-21 · 责任与文案归位）══════════════════════════════════════
    // 一个总超时曾同时装「我们段」与「上游段」⇒ 素材出站（实测 3s↔69s）被记在上游账上，
    // 超时还统一报成"生成超时"。现按**交出 thread_id 那一刻**（upstreamStartedAt）分段：
    //   段①（我们：提交 + 素材出站）从 handle.startedAt 起算；
    //   段②（上游：出图）从交出那一刻起算。
    // 两段的界都沿用同一个 `timeoutMs`（取值见**预算真源** `budgetMsFor` —— **本文件不复述数值**，
    // 见 TD-08-49「禁复述已移出的数值」）⇒ 今天能成功的改后仍能成功，只是两段不再互相挤占预算。
    if (handle.upstreamStartedAt === undefined) {
      if (Date.now() - handle.startedAt > timeoutMs) {
        stopHandle(handle);
        // 段① 卡住 = 提交/素材出站未完成，而 adapter 内部步骤（mode/附件上传/ensureProject）**可能已部分出站**
        // ⇒ 按 TD-08-24 既有铁律「宁 unknown 不 failed」（误判 failed 会诱导重提 → 重复计费）。
        await upsertUnknown(
          handle,
          `提交阶段超时：参考素材出站/建任务在 ${Math.round(timeoutMs / 1000)}s 内未完成`,
        );
        return;
      }
    } else if (Date.now() - handle.upstreamStartedAt > timeoutMs) {
      stopHandle(handle);
      await upsertFailed(
        handle,
        `上游生成超时（交出上游后 ${Math.round(timeoutMs / 1000)}s 未返回）`,
      );
      return;
    }
    handle.running = true;
    try {
      // direct（原生直连）→ adapter 单次轮询；其余 → 走快照中的自定义异步协议轮询
      if (handle.direct) {
        // profile 本轮只构造一次：原实现「补提交」与「轮询」各构造一次，入参完全相同 → 纯重复。
        // 单请求超时兜底（防底层出站单步卡死无限挂；任务总时长仍由 handle 总超时约束）
        const profile = buildLovartDirectProfile(handle.baseUrl, {
          timeoutMs: DIRECT_SUBMIT_TIMEOUT_MS,
        });
        // 【根治·2026-09-04】待提交阶段：先补后台出站（提交即返回的「真正提交」），
        // 成功回填 thread_id 后本轮继续轮询；失败已在 runDirectSubmit 内置 failed + 停句柄。
        if (handle.pendingDirectSubmit) {
          const okSubmit = await runDirectSubmit(handle, profile);
          if (!okSubmit || handle.stopped) return;
        }
        const r = await pollLovartTaskOnce(profile, {
          handle: { threadId: handle.taskId, projectId: '' },
        });
        handle.consecutiveErrors = 0; // 本轮有响应（未抛异常）→ 重置连续失败计数
        if (handle.stopped) return;
        if (r.status === 'completed') {
          stopHandle(handle);
          await upsertCompleted(handle, r.urls ?? []);
        } else if (r.status === 'failed') {
          stopHandle(handle);
          await upsertFailed(handle, r.error || 'Lovart 任务失败');
        } else if (r.error) {
          // 【空写库删除】direct 单轮无 progress 语义，且首轮提交时已写入 running 行 ⇒
          // 无 error 时这次 upsert 写入的内容（status:'running'）与库中现值完全相同，零信息量。
          // 有 error 时必须写：error_msg 是「单轮异常」的唯一落库通道（失败可见，不静默）。
          await updateProgress(handle, undefined, r.error);
        }
        return;
      }
      const r = await protocol.pollModelProtocolOnce(
        handle.poll!,
        handle.apiKey,
        undefined,
        handle.baseUrl,
      );
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
        await upsertFailed(
          handle,
          `轮询持续异常（${handle.consecutiveErrors} 次）：${handle.lastError}`,
        );
        return;
      }
      await updateProgress(handle, undefined, handle.lastError);
    } finally {
      handle.running = false;
    }
  };
  handle.timer = setInterval(() => {
    void runOnce();
  }, interval);
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
  flushSaveDb(); // 【TD-08-39】终态：不落盘则重启后任务卡 running、结果消失
}

/** 任务失败/超时：写库 failed + error_msg。 */
async function upsertFailed(handle: PollHandle, error: string): Promise<void> {
  await upsertTask(await getDb(), {
    task_id: handle.frontTaskId,
    status: 'failed',
    progress: 0,
    error_msg: error || '生成失败',
  });
  flushSaveDb(); // 【TD-08-39】终态（同 completed）：失败也必须立刻可见，不能停在 running
}

/**
 * 【TD-08-24 · 2026-09-16】提交结果未知：写库 `unknown` + 用户可读文案 + 原文透传。
 *
 * 【与 upsertFailed 的分工（勿合并）】`failed` = 确定没跑（可安全重提）；`unknown` = **可能已在跑**
 * （重提有重复计费风险）。前端据此显示「需确认」而非红「失败」，并引导用户到任务中心核实后再决定。
 * @param threadId 已知的上游 thread_id（落库失败分支能拿到；sendChat 失败时未知 → undefined）
 */
async function upsertUnknown(handle: PollHandle, error: string, threadId?: string): Promise<void> {
  const hint = threadId
    ? `提交结果未知（可能已开始生成，上游任务号 ${threadId}），请到任务中心确认后再决定是否重新生成`
    : '提交结果未知（请求已发出但未收到确认，可能已开始生成），请到任务中心确认后再决定是否重新生成';
  await upsertTask(await getDb(), {
    task_id: handle.frontTaskId,
    status: 'unknown',
    progress: 0,
    error_msg: `${hint}${error ? `｜上游原文：${error}` : ''}`,
  });
  flushSaveDb(); // 【TD-08-39】终态（unknown）：这一态正是给"崩溃/断连后人工对账"用的，尤其不能只留在内存
}

/** 写进度（进行中）。 */
async function updateProgress(
  handle: PollHandle,
  progress?: number,
  stageError?: string,
): Promise<void> {
  const p =
    typeof progress === 'number' && progress >= 0 ? Math.min(100, Math.round(progress)) : undefined;
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
/**
 * 【143 · S3′】从任务行快照取 capability —— **只在句柄不在内存时用**（重启后扫描尚未接管的那段窗口）。
 * ⚠️ 不用 `row.type`：那是**节点类型**（`RelayIntent.type` 是自由字符串，如 `imageGenerate`），不是 capability。
 * ⚠️ 该路径**取不到本次任务的 override**（快照不存它）⇒ 报的是 capability 默认值。
 *   两个方向的偏差都无害：报小了 ⇒ 前端只声明"我不再等"（`pending` 非终态）+ 恢复轮询续接；
 *   报大了 ⇒ 前端多等一会儿。**都不会造成任务被判死**。
 * ⚠️ 取快照走 `readRelaySnapshot`（db 层唯一实现，ADR-0057）—— 本文件不再自写 JSON.parse。
 */
function capabilityFromRow(row: { request_data?: unknown }): RelayCapability | undefined {
  const r = readRelaySnapshot<{ capability?: unknown }>(row);
  if (!r.ok) return undefined;
  const cap = r.snapshot.capability;
  return isRelayCapability(cap) ? cap : undefined;
}

export async function getGenerateStatus(frontTaskId: string): Promise<RelayTaskStatus> {
  const h = handles.get(frontTaskId);
  if (h) {
    const db = await getDb();
    const row = queryAll(db, 'SELECT status, progress, result_url FROM tasks WHERE task_id = ?', [
      frontTaskId,
    ])[0];
    if (row && row.status === 'completed' && row.result_url) {
      return { status: 'completed', url: row.result_url, type: h.type, budgetMs: h.budgetMs };
    }
    if (row && row.status === 'failed') {
      return { status: 'failed', error: row.error_msg || '生成失败', budgetMs: h.budgetMs };
    }
    // 【TD-08-24】unknown 是终态（句柄已 stopHandle 移除，此处为兜底），必须原样透出 ——
    // 若折成 running，前端会一直等到超时才报错，把「可能已生成」误导成「还在生成」。
    if (row && row.status === 'unknown') {
      // 【TD-08-55】补生产者：上游任务号（句柄内存里是最近的真源；pendingSubmit 阶段为空串 ⇒ 归一为 undefined）
      return {
        status: 'unknown',
        error: row.error_msg || '提交结果未知',
        threadId: h.taskId || undefined,
      };
    }
    return {
      status: 'running',
      progress: typeof row?.progress === 'number' ? row.progress : undefined,
      budgetMs: h.budgetMs,
    };
  }
  // 句柄不在内存：回库判断（可能是历史已完成/失败/未知，或重启后尚未被扫描接管）
  const db = await getDb();
  const row = queryAll(
    db,
    'SELECT status, progress, result_url, error_msg, poll_task_id, request_data FROM tasks WHERE task_id = ?',
    [frontTaskId],
  )[0];
  if (!row) return { status: 'not-found', error: '后端无此任务记录' };
  // 【143 · S3′】无句柄时按快照 capability 报默认预算（取不到 override，见 capabilityFromRow 注释）
  const cap = capabilityFromRow(row);
  const rowBudgetMs = cap ? budgetMsFor(cap) : undefined;
  if (row.status === 'completed' && row.result_url) {
    return {
      status: 'completed',
      url: row.result_url,
      type: row.type || '',
      budgetMs: rowBudgetMs,
    };
  }
  if (row.status === 'failed') {
    return { status: 'failed', error: row.error_msg || '生成失败', budgetMs: rowBudgetMs };
  }
  if (row.status === 'unknown') {
    // 【TD-08-55】补生产者：回库分支的真源 = `poll_task_id`（= 上游 task_id / lovart thread_id）
    return {
      status: 'unknown',
      error: row.error_msg || '提交结果未知',
      threadId:
        typeof row.poll_task_id === 'string' && row.poll_task_id ? row.poll_task_id : undefined,
    };
  }
  if (row.status === 'running' && row.poll_task_id) {
    // 在途且句柄不在内存 → 交给扫描（若启动扫描还没跑则提示 running）
    return {
      status: 'running',
      progress: typeof row.progress === 'number' ? row.progress : undefined,
      budgetMs: rowBudgetMs,
    };
  }
  // 【D16】后端**从未持有**该行（无上游 task_id、也无 relay 快照）⇒ 它不归后端跟踪，永远不会有终态。
  // 报 running 会让前端 `pollTask` 无限 attach（幽灵行）；报 not-found 让它立即收敛为 failed。
  // ⚠️ 必须放在上面的终态分支（completed/failed/unknown）**之后** —— 历史行可能既无 task_id 也无快照。
  // ⚠️ 判据收口：`readRelaySnapshot`（db 层）是"有无快照"的唯一实现（与 capabilityFromRow / 恢复扫描共用）。
  if (!row.poll_task_id && !readRelaySnapshot(row).ok) {
    return {
      status: 'not-found',
      error: '后端未持有此任务（可能未提交成功），已标记失败',
    };
  }
  return {
    status: 'running',
    progress: typeof row.progress === 'number' ? row.progress : undefined,
    budgetMs: rowBudgetMs,
  };
}

/**
 * cancel：停句柄 → 置 failed。
 * ⚠️ **无生产调用方** —— 前端取消入口与对外 HTTP 端点已删（ADR-0061）。
 *   保留仅供测试观测「停句柄」语义（recovery/segment 用例）；不再对用户暴露。
 */
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
 * 【D17】"我再也跟踪不了它"必须写下来 —— 否则该行永久 `running`（幽灵），用户零出口。
 * 落 `unknown`（而非 `failed`）：上游**可能已生成**，判 failed 会诱导重提 ⇒ 重复计费（TD-08-24）。
 * ⚠️ 这些路径**没有 handle**（正因如此才跳过）⇒ 只能直接 `upsertTask`，不能走 `upsertUnknown(handle, …)`；
 *    与 `upsertUnknown`/`upsertFailed` 同口径：终态必须 `flushSaveDb`（TD-08-39，不能停在内存）。
 */
async function markUnrecoverable(
  db: Awaited<ReturnType<typeof getDb>>,
  frontTaskId: string,
  reason: string,
): Promise<void> {
  await upsertTask(db, {
    task_id: frontTaskId,
    status: 'unknown',
    progress: 0,
    error_msg: `重启后无法恢复该任务（${reason}），可能已生成，请到任务中心确认`,
  });
  flushSaveDb();
}

/**
 * 启动恢复扫描（localTool 启动后调用一次）：从 DB 读在途行(status=running && poll_task_id 非空
 * && request_data._relayPoll 可解析) → 按 providerId 重读 .env key → 重建句柄续跑。
 * DB 持久态即真相，不依赖内存（docs/90 R4）。
 */
export async function initRelayPoller(opts: { overrideMs?: number } = {}): Promise<void> {
  // 【143 · S2′-b】原为「一个全局 timeoutMs 套所有重建句柄」⇒ 与"按 capability 定预算"矛盾。
  // 现逐句柄取：默认由 `registerHandle` 按 `core.capability` 向真源算；`opts.overrideMs` 只是
  // **override**（当前消费方：`test/relay-poll-segment.test.js` 注入短预算，生产不传）。
  try {
    const db = await getDb();
    // 在途 relay 任务 = 有 poll_task_id（存量/新近已提交）或 request_data 内含 _relayPoll 快照的行
    // （普通前端 running 任务既无 poll_task_id 也不含此键，天然排除）。
    // 兼容待提交任务（poll_task_id 为空但快照含 _relayPoll.pendingSubmit，提交即返回后未及出站即重启）→ 一并纳入。
    const rows = queryAll(
      db,
      `SELECT task_id, status, poll_task_id, request_data, submit_ack_at FROM tasks WHERE status IN ('running','pending')
        AND ( (poll_task_id IS NOT NULL AND poll_task_id != '') OR request_data LIKE '%_relayPoll%' )`,
    );
    for (const row of rows) {
      const frontTaskId = row.task_id as string;
      if (handles.has(frontTaskId)) continue;
      // 【D16 收口】"有无快照"只经 db 层 `readRelaySnapshot` 判一次（此处原自写一份 JSON.parse + 取 _relayPoll）。
      const snapRead = readRelaySnapshot<RelayPollSnapshot['_relayPoll']>(row);
      if (!snapRead.ok) {
        // 【D17】跳过 = "我再也跟踪不了它" ⇒ 必须写终态，否则该行永久 running（幽灵），用户零出口。
        await markUnrecoverable(db, frontTaskId, '无 relay 快照');
        continue;
      }
      const core = snapRead.snapshot;
      // 【TD-08-51】快照 `capability` 必须过守卫才能进 `registerHandle` —— 它来自 `JSON.parse`，
      //   类型层（`RelayPollSnapshot`）管不到运行时。域外值会让 `budgetMsFor` 返 `undefined`
      //   ⇒ `handle.budgetMs = undefined` ⇒ `runOnce` 的 `now - startedAt > timeoutMs` **恒 false**
      //   ⇒ 任务**永不判死**（且 GET 同报 undefined ⇒ 前端也不掐点 = 双侧静默互等）。
      //   处置：**不重建**（重建出来就是个空转的僵尸句柄），但**必须写终态** —— 见下方 D17。
      if (!isRelayCapability(core.capability)) {
        console.warn(
          `[relay-poll] 恢复跳过 ${frontTaskId}：快照 capability 非法（${String(core.capability)}）—— 重建也只会得到一个永不判死的句柄`,
        );
        // 【D17】原「留痕跳过」只 `continue` ⇒ 该行永久 running。改为写终态 unknown：
        // 跳过 = "我再也跟踪不了它"；unknown（非 failed）= 上游**可能已生成**，避免用户重提 ⇒ 重复计费。
        await markUnrecoverable(db, frontTaskId, '快照不完整/能力非法');
        continue;
      }
      // 【段边界恢复】已交出（taskId 非空）⇒ 段② 从 `submit_ack_at` 起算；未交出 ⇒ 段① 从 `startedAt` 起算。
      // 传**完整** timeoutMs（不再预先扣减）：原 `remaining` 与 runOnce 的 `now - startedAt` 会把
      // 已耗时间**扣两次** ⇒ 重启后的任务被提前判死（同一处发现的第二处缺陷，随分段一并改对）。
      const upstreamStartedAt = core.taskId
        ? ((row.submit_ack_at as number | null) ?? core.startedAt)
        : undefined;
      // 【根治·2026-09-04】待提交任务（direct 提交即返回后重启、尚未出站拿到 thread_id）：
      // 重建「待提交」句柄，首轮 runOnce 会补执行 runDirectSubmit 续跑提交，不丢任务。
      if (core.direct && !core.taskId && core.pendingSubmit) {
        registerHandle(
          frontTaskId,
          {
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
          },
          opts.overrideMs, // 缺省 ⇒ 由 registerHandle 按 core.capability 取真源
        );
        continue;
      }
      // 已提交任务：需 thread_id(=taskId) 才能续轮询
      if (!core.taskId) {
        // 【D17】无 taskId（脏数据）⇒ 跟踪不了 ⇒ 写终态（理由同上方 unknown）。
        await markUnrecoverable(db, frontTaskId, '快照缺上游任务号');
        continue;
      }
      if (!core.poll && !core.direct) {
        // 【D17】非 direct 但缺 poll（旧/脏数据）⇒ 跟踪不了 ⇒ 写终态（理由同上方 unknown）。
        await markUnrecoverable(db, frontTaskId, '快照缺轮询配置');
        continue;
      }
      const apiKey = resolveProviderApiKey(core.providerId);
      registerHandle(
        frontTaskId,
        {
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
          upstreamStartedAt,
          timer: null,
          running: false,
          stopped: false,
          consecutiveErrors: 0,
        },
        opts.overrideMs, // 缺省 ⇒ 由 registerHandle 按 core.capability 取真源
      );
    }
  } catch (e) {
    // 恢复扫描失败不阻塞服务；日志可见（失败可见，不静默）
    console.error(`[relay-poll] 恢复扫描失败：${e instanceof Error ? e.message : String(e)}`);
  }
}
