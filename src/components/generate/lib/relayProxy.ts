/**
 * relayProxy — 前端「异步任务 relay 后端化」客户端（docs/90 R5 双轨的 client 半边）。
 *
 * 【角色】前端只发意图 + GET attach，不再自轮询/自落盘/自写 result_url：
 *   - relaySubmit：POST /api/generate 提交 → 后端 relay-poll 立即返 taskId（任务在 localTool 进程跑）
 *   - relayPoll：  GET  /api/generate/:frontTaskId attach 同一句柄 → running(progress) / completed(/files/ url) / failed
 *   - relayGenerate（组合）：submit 后低频 GET attach 直到终态，返回 {ok,url}（url 已是后端落盘 /files/）
 *
 * 【为什么 GET 也算轮询却安全】后端句柄生命周期 = localTool 进程且落库；前端刷新 = 重新 attach 到
 *   同一句柄，任务继续跑完落盘不丢。旧模型的「丢结果」根因（result_url 写库真源在前端一次性窗口）已消除——
 *   result_url 由后端写，前端 GET 只是读。
 *
 * 【唯一出口纪律】传输统一 httpClient；协议执行在 localTool（ai-relay kit + relay-poll），本文件无字段抽取。
 */

import type { GenerationResult } from '@/types';
import {
  API_BASE,
  GEN_POLL_INTERVAL,
  CHAT_TOTAL_TIMEOUT,
  LOCAL_TOOL_PING_TIMEOUT,
} from '@/components/base/core/config';
import { httpRequest } from '@/components/base/api/httpClient';
import { logger } from '@/components/base/core/log/logger';
import { timeoutMessage } from '@/components/base/utils/genErrors';

/**
 * 连续 N 轮 attach 均报 transport 错误即 fail-loud。
 * 动机：relayPoll 为「网络抖动下轮续查」把错误折成 running，但错误**不得**一路被吞到
 * 「生成超时」——那样真实根因（连不上 localTool / HTTP 错）会丢，排障只能靠猜。
 */
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

/**
 * relay 生成最终结果信封 —— 别名对齐 GenerationResult（单一真源 src/types/provider.ts，L3c，禁另立 interface）。
 * 原独立 interface 已收口为别名，字段改动会在本别名处编译期爆红。
 */
export type RelayGenerationResult = GenerationResult;

/** relay 能力（对齐 /api/generate 的 capability） */
export type RelayCapability = 'image' | 'video' | 'chat';

/** relay 提交意图（与 /api/generate body 对齐） */
export interface RelayIntent {
  /** 前端自造任务 id（taskStore task_id，贯穿链路主键） */
  frontTaskId: string;
  /** 归属节点 id（任务行 node_id 由 taskStore.reportGenerate 写；此字段可省略） */
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
  duration?: number | string;
}

/** relay GET attach 返回（/api/generate/:id 的 data 子集） */
export interface RelayPollData {
  /** 【TD-08-24】`unknown` = 提交结果未知（**可能已在跑**），与 `failed`（确定没跑）区分 —— 勿合并。 */
  status: 'running' | 'completed' | 'failed' | 'unknown' | 'not-found';
  progress?: number;
  url?: string;
  error?: string;
  /** 【143 · S3′】后端实际生效的任务预算（ms）。前端据此设等待上限，**不自持数值**。 */
  budgetMs?: number;
}

/** 信封解析：localTool 端点 { code, data } */
interface CodeData<T> {
  code?: number;
  data?: T;
}

/** 提交到 /api/generate（不等终态），后端立即返 taskId。 */
export async function relaySubmit(
  intent: RelayIntent,
): Promise<{ ok: boolean; taskId?: string; error?: string; budgetMs?: number }> {
  try {
    const body = {
      frontTaskId: intent.frontTaskId,
      nodeId: intent.nodeId,
      type: intent.type,
      providerId: intent.providerId,
      capability: intent.capability,
      model: intent.model,
      ...(intent.prompt !== undefined ? { prompt: intent.prompt } : {}),
      ...(intent.size !== undefined ? { size: intent.size } : {}),
      ...(intent.images && intent.images.length > 0 ? { images: intent.images } : {}),
      ...(intent.messages ? { messages: intent.messages } : {}),
      ...(intent.resolution !== undefined ? { resolution: intent.resolution } : {}),
      ...(intent.duration !== undefined ? { duration: String(intent.duration) } : {}),
    };
    // httpRequest 默认 parseJson:true → 成功返纯 data 对象（无 .json()）；非 2xx 抛 HttpError 被下层 catch。
    // localTool 端点恒 200 + {code,data} 信封，故 res.ok 恒真；业务失败走 code:-1 + data.error。
    // 【根治·2026-09-04】POST 提交只负责「接受任务入队」，localTool 端已提交即返回（出站挪进后台句柄），
    // 响应近瞬回，无需默认 15s 掐点——去掉本层超时（timeoutMs:0=禁用），杜绝「已发到 lovart 却被 15s 误报超时」。
    const env = (await httpRequest(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      retries: 0,
      timeoutMs: 0,
      label: 'relaySubmit',
    })) as CodeData<{ taskId?: string; budgetMs?: number }>;
    // 【143 · S4′】`budgetMs` = 后端**实际生效**的任务预算（生产者给全）⇒ 前端据此设等待上限，
    // 不再自持 `GEN_TIMEOUT`/`VIDEO_TIMEOUT`（消费者不许替生产者定真相）。
    // ⚠️ **它是必给字段**（143 §2.2）：POST 返回时任务**尚未出站**（后端"提交即返回"，出站由句柄首轮
    //   后台执行）⇒ 缺了就是**契约违约**，此处 fail-fast **不会**撞"重复计费"红线（上游还没收到）。
    //   **不编默认值**（编一个数 = 默认值兜底，形态④）—— 拒收并留痕（TD-08-52）。
    if (env?.data?.taskId) {
      if (typeof env.data.budgetMs !== 'number') {
        logger.warn('relayProxy', '[relay] 提交响应缺 budgetMs（后端契约违约）⇒ 拒收', {
          frontTaskId: intent.frontTaskId,
        });
        return { ok: false, error: '提交响应缺 budgetMs（后端契约违约）' };
      }
      return { ok: true, taskId: env.data.taskId, budgetMs: env.data.budgetMs };
    }
    const msg = (env?.data as { error?: string } | undefined)?.error || `提交失败 (HTTP 200)`;
    return { ok: false, error: msg };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '提交失败' };
  }
}

/** 单次 GET attach：查某 frontTaskId 当前进度/结果。 */
export async function relayPoll(frontTaskId: string): Promise<RelayPollData> {
  try {
    // parseJson:true 默认 → 返纯 data；非 2xx 抛 HttpError 进 catch → 返回 running 下轮续查
    // 【根治·2026-09-04】单次 GET attach 只读 localTool 内存/DB 句柄，近瞬回；
    // 真正的长等待由外层 relayAttachUntilDone 的等待上限兜底（143 S4′ 起 = 后端告知的 `budgetMs`），
    // 故去掉本层 15s 掐点，
    // 避免后端忙时单次 attach 误超时被降级为 running 空转。
    const env = (await httpRequest(`${API_BASE}/api/generate/${encodeURIComponent(frontTaskId)}`, {
      method: 'GET',
      retries: 0,
      timeoutMs: 0,
      label: 'relayPoll',
    })) as CodeData<RelayPollData>;
    const d = env?.data;
    if (d?.status === 'completed') return { status: 'completed', url: d.url, progress: 100 };
    if (d?.status === 'failed') return { status: 'failed', error: d.error || '生成失败' };
    // 【TD-08-24】unknown 是终态，必须原样透出 —— 折成 running 会让前端空等到超时，
    // 把「可能已生成」误报成「还在生成」，用户等满超时后才看到失败，更容易误重提。
    if (d?.status === 'unknown') return { status: 'unknown', error: d.error || '提交结果未知' };
    // 【143 · S3′】`not-found` = **后端明确说"我这儿没这个任务"**（生产者给全）——
    // 后端已由 404 改为 200 + 该状态。此前它被折成 `running` ⇒ 与「连不上」同形 ⇒ 空等到超时。
    // ⚠️ 与 `unknown` 不同：`unknown` 是"可能已生成"；这里是"无从判断，后端无记录"。
    if (d?.status === 'not-found') {
      return { status: 'not-found', error: '后端无此任务记录（句柄与任务行都不存在）' };
    }
    return { status: 'running', progress: d?.progress ?? 0, budgetMs: d?.budgetMs };
  } catch (e) {
    return { status: 'running', error: e instanceof Error ? e.message : '查询异常' }; // 网络抖动/HTTP错：下轮续查
  }
}

/** 取消：POST /api/generate/:frontTaskId/cancel（后端停句柄 → 置 failed）。 */
export async function relayCancel(frontTaskId: string): Promise<{ ok: boolean }> {
  try {
    // parseJson:true 默认 → 成功返纯 data（非 2xx 抛 HttpError 进 catch → ok:false）；无异常视为成功
    await httpRequest(`${API_BASE}/api/generate/${encodeURIComponent(frontTaskId)}/cancel`, {
      method: 'POST',
      retries: 0,
      // 取消是本机端点的即时操作，用短时限即可（原不掐点 ⇒ 后端假死时取消也会永久挂起）
      timeoutMs: LOCAL_TOOL_PING_TIMEOUT,
      label: 'relayCancel',
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export interface RelayGenerateOptions {
  intent: RelayIntent;
  signal?: AbortSignal;
  onProgress?: (percent: number, message?: string) => void;
}

export interface RelayAttachOptions {
  frontTaskId: string;
  /**
   * 等待上限（ms）——**可选**，两级来源，**都不自持数值**（143 · S4′）：
   *   ① 本字段 = 调用方的显式覆盖（"本次只等 N 秒"），优先级最高；
   *   ② 缺省 ⇒ 从**后端 attach 响应里的 `budgetMs`** 学（生产者给全）。
   * ⚠️ **两级都拿不到时不掐点** —— 不是"忘了兜底"，而是有意的：
   *   后端**必有**自己的预算并最终写终态 ⇒ 前端的不确定等待**由生产者的终态封顶**；
   *   而"后端真死了"这一情形由 `MAX_CONSECUTIVE_POLL_ERRORS`（连续查询失败）负责 fail-loud，
   *   不该再编一个数字来假装它是业务预算（ADR-0035：不掐点 ≠ 无风险，但风险要有**对的那道**防线）。
   */
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number, message?: string) => void;
  /** 起始进度（放弃初始 submit 后的 20；恢复时直接开始映射后端 progress） */
  startProgress?: number;
  /** 是否在 abort 时通知后端 cancel（image/video in-flight 置 failed 停句柄；刷新恢复不 cancel） */
  cancelOnAbort?: boolean;
}

/**
 * 统一「低频 GET attach 直到终态」循环（2026-09-03 收敛）。
 * 后端 relay-poll 常驻句柄在 localTool 进程，DB 是真相；本循环只是「重 attach 拿状态」。
 *  - 返回 { ok:true, url }（url = 后端已落盘 /files/，前端无需 saveResultToTasks）｜{ ok:false, error }；
 *  - signal abort：cancelOnAbort=true 时先通知后端 cancel（置 failed 停句柄）再抛 AbortError。
 * 供 relayGenerate（in-flight，cancelOnAbort=true）与刷新恢复（pollTask，不 cancel）复用，
 * 保证「唯一查询协议 = /api/generate/:id attach」，不再各写一套轮询。
 */
export async function relayAttachUntilDone(
  opts: RelayAttachOptions,
): Promise<RelayGenerationResult> {
  const { frontTaskId, signal } = opts;
  // 【143 · S4′】等待上限**不自持数值**：优先调用方显式覆盖，否则从后端 attach 响应的 `budgetMs` 学。
  // `undefined` = 尚未学到 ⇒ **不掐点**（理由见 RelayAttachOptions.timeoutMs 的三条说明）。
  let budgetMs = opts.timeoutMs;
  const pollInterval = Math.max(1000, GEN_POLL_INTERVAL);
  const startedAt = Date.now();

  // 取消对齐：signal abort 时按需通知后端 cancel（置 failed 停句柄），否则后端句柄续跑到终态。
  // settled 守卫：终态返回后即使 signal 晚到 abort 也不再 cancel（不误杀已完成任务）。
  let settled = false;
  const onAbort = () => {
    if (settled || !opts.cancelOnAbort) return;
    settled = true;
    // 【失败可见 TD-02-16】取消失败留痕：后端句柄会续跑到终态（用户已中止却仍烧算力）
    void relayCancel(frontTaskId).catch((e) => {
      logger.warn('relayProxy', '中止后通知后端 cancel 失败（后端句柄可能续跑）', {
        taskId: frontTaskId,
        reason: e?.message || e,
      });
    });
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const finish = (r: RelayGenerationResult): RelayGenerationResult => {
    settled = true;
    signal?.removeEventListener('abort', onAbort);
    return r;
  };

  // 低频 GET attach（后端句柄在 localTool 进程，前端刷新=重 attach，不丢）
  let lastProgress = opts.startProgress ?? 30;
  // 【失败可见】transport 层错误（连不上/HTTP 错）在 relayPoll 里被折成 running 以便续查；
  // 但绝不能因此把「连不上」一路吞到「生成超时」——记下真实原因 + 连续错误数，达阈值即 fail-loud。
  let lastTransportError = '';
  let consecutiveErrors = 0;
  while (true) {
    if (signal?.aborted) {
      onAbort();
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    await new Promise((r) => setTimeout(r, pollInterval));
    const st = await relayPoll(frontTaskId);
    // 【143 · S4′】第一次拿到后端告知的预算即固定（生产者给全；不回退本地常量）
    if (budgetMs === undefined && typeof st.budgetMs === 'number') budgetMs = st.budgetMs;
    // 【等待预算用尽 · 2026-09-21】前台**只是不再等**，不是任务终态 —— 故带 `pending` 判别字段返回。
    // 依据：终态只能由后端写（localTool tasks.ts 的 EXECUTION_OWNED_COLUMNS 只许 poller 写执行态列）；
    //   本函数是**消费者**，唯一权利是「声明我不再等」，无权替生产者判死。
    // 消费方（generationOrchestration / pollTask / agent generate_node）据此保持任务 running，
    //   交给既有恢复轮询续 attach 到真终态。
    // error 文案走 `timeoutMessage`（本仓超时文案唯一出口，禁自写「生成超时」变体）；它只是排障字段。
    if (budgetMs !== undefined && Date.now() - startedAt >= budgetMs) {
      const budgetMsg = timeoutMessage(budgetMs);
      return finish({
        ok: false,
        pending: true,
        error: lastTransportError
          ? `${budgetMsg}（最后一次错误：${lastTransportError}）`
          : budgetMsg,
      });
    }
    if (st.status === 'completed' && st.url) {
      opts.onProgress?.(100, '完成');
      logger.debug(
        '生成',
        '[relay] 完成',
        { frontTaskId, urlHead: st.url.slice(0, 80) },
        { module: 'image' },
      );
      return finish({ ok: true, url: st.url });
    }
    if (st.status === 'failed') {
      logger.debug('生成', '[relay] 失败', { frontTaskId, error: st.error }, { module: 'image' });
      return finish({ ok: false, error: st.error || '生成失败' });
    }
    // 【TD-08-24】unknown = 终态且**可能已生成**：立即结束（不再空等超时），错误文案由后端给
    // （含「可能已开始生成…请到任务中心确认」），前端原样透出，不以「生成失败」误导用户重提。
    if (st.status === 'unknown') {
      logger.warn('生成', '[relay] 提交结果未知', { frontTaskId, error: st.error });
      return finish({ ok: false, error: st.error || '提交结果未知，请到任务中心确认' });
    }
    // 【143 · S3′】`not-found` = 后端明确无此任务 ⇒ **立即终态**，不再空等到超时。
    // 判据：它是**生产者给的确定事实**（后端查过句柄与任务行都没有），不是"查询失败" ⇒ 不许当 transport 错误续查。
    if (st.status === 'not-found') {
      logger.warn('生成', '[relay] 任务不存在', { frontTaskId, error: st.error });
      return finish({ ok: false, error: st.error || '后端无此任务记录' });
    }
    if (st.error) {
      // transport 错误：续查但留痕；连续到阈值 → 直接以真实原因失败（不再等到超时误报）
      lastTransportError = st.error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        logger.debug(
          '生成',
          '[relay] 连续查询失败，终止',
          { frontTaskId, error: lastTransportError },
          { module: 'image' },
        );
        return finish({ ok: false, error: lastTransportError });
      }
    } else {
      consecutiveErrors = 0;
    }
    if (st.progress !== undefined && st.progress !== lastProgress) {
      lastProgress = st.progress;
      opts.onProgress?.(30 + Math.min(60, Math.round(lastProgress)), '上游生成中…');
    }
  }
}

/**
 * 组合：relaySubmit → 低频 GET attach 直到终态。
 * - 返回 { ok:true, url }（url = 后端已落盘 /files/，前端无需再 saveResultToTasks）；
 * - 失败返回 { ok:false, error }；取消抛 AbortError（调用方按既有契约处理）。
 */
export async function relayGenerate(opts: RelayGenerateOptions): Promise<RelayGenerationResult> {
  const { intent, signal } = opts;
  opts.onProgress?.(10, '正在连接本地服务…');
  const sub = await relaySubmit(intent);
  if (!sub.ok || !sub.taskId) {
    return { ok: false, error: sub.error || '提交失败' };
  }
  opts.onProgress?.(20, '已提交到生成网关…');
  try {
    const r = await relayAttachUntilDone({
      frontTaskId: sub.taskId,
      // 【143 · S4′】等待上限 = **后端在 POST 响应里告知的预算**（生产者给全）。
      // 前端不再自持 `GEN_TIMEOUT`/`VIDEO_TIMEOUT`：那正是"消费者替生产者定真相"。
      // `sub.budgetMs` 在此**必然有值** —— `relaySubmit` 已对缺失 fail-fast（TD-08-52），
      // 故本字段不再存在"缺了就是不掐点"的隐式分支。
      timeoutMs: sub.budgetMs,
      signal,
      onProgress: opts.onProgress,
      startProgress: 20,
      cancelOnAbort: true, // in-flight：用户停止 → 通知后端 cancel 停句柄
    });
    return r;
  } catch (e) {
    // attach 阶段 AbortError（cancelOnAbort 已通知后端 cancel）——透传给调用方按既有契约处理
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return { ok: false, error: e instanceof Error ? e.message : '生成失败' };
  }
}

/**
 * chat：经统一入口 POST /api/generate（capability=chat）同步调用（后端 relayGenerate 出站）。返回 { ok, content? | error?, aborted? }。
 * 流式与否由后端按 config/providers 里该 provider 的 streaming 决定（前端不传 stream）。
 * 【2026-09-03 收口】统一生成入口，chat 与 image/video 同打 /api/generate（旧 /api/relay 已并入）；
 * frontTaskId 透传
 * 任务中心同一 task_id（聊天也贯穿任务中心，见 taskStore.reportGenerate），后端接收但不建轮询句柄。
 */
export async function relayChat(
  intent: RelayIntent,
  opts: {
    signal?: AbortSignal;
    timeoutMs?: number;
    temperature?: number;
    responseFormat?: string;
  } = {},
): Promise<RelayGenerationResult> {
  const { signal } = opts;
  // 【143 · S5′ · 修语义错位】此前**一个** `timeoutMs` 同时当两件事用：① 写进 `body.timeoutMs`
  // （后端按**任务总预算**用）② 掐本层 `httpRequest`（前端等这次 POST 返回）。而它取的是
  // `CHAT_TIMEOUT`（120s）= 「等上游响应」**段**的值 ⇒ **段值被当成总预算传给了后端**。
  // 现按判据分层（ADR-0031：判据不同不合并）：
  //   · `totalBudgetMs` = **任务总预算**（`CHAT_TOTAL_TIMEOUT`）→ 进 `body.timeoutMs`（后端据此掐上游）；
  //   · 本层 `httpRequest` 也等满**同一总预算** —— 同步 chat 的响应只在**整件事做完**才回来，
  //     它等的是「任务」而不是「某一段」⇒ 与总预算同源，不是段值。
  const totalBudgetMs = opts.timeoutMs ?? CHAT_TOTAL_TIMEOUT;
  const body: Record<string, unknown> = {
    frontTaskId: intent.frontTaskId,
    providerId: intent.providerId,
    capability: 'chat',
    model: intent.model,
    ...(intent.messages ? { messages: intent.messages } : {}),
    ...(intent.prompt !== undefined ? { prompt: intent.prompt } : {}),
    ...(intent.images && intent.images.length > 0 ? { images: intent.images } : {}),
    // 【TD-01-24 · 口径贯通】把**本次实际预算**写进请求体 —— 此前它只用来掐本层 fetch，
    // 后端**根本不知道**这个数，于是按自己的默认（180s）继续跑上游 ⇒ 前端先放弃、上游白跑。
    // 现在「生产者给全 · 消费者只转发」：后端读它、原样交给上游，前后端口径天然一致。
    timeoutMs: totalBudgetMs,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.responseFormat) body.response_format = opts.responseFormat;
  try {
    // 统一入口：chat 走同步快路径，后端立即返 {code:0,data:{status:'completed',text}}。
    // httpRequest 默认 parseJson:true → 成功返纯 data 对象；非 2xx 抛 HttpError 进 catch。
    const env = (await httpRequest(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      retries: 0,
      timeoutMs: totalBudgetMs,
      label: 'relayChat',
    })) as CodeData<{ status?: string; text?: string; error?: string }>;
    const d = env?.data;
    if (d?.text) return { ok: true, content: d.text };
    if (d?.error) return { ok: false, error: d.error };
    return { ok: false, error: '上游未返回文本内容' };
  } catch (e) {
    // 【中止判定】真·用户取消（AbortError）或 信号已中止（signal 先中止、后续步骤连带抛错）。
    // 括号不可省：旧写法 `(A && B) || C` 靠读者自推优先级，后续改动极易写错。
    // 【L3c】error 字段仍给 UI 中文文案（useNodeGeneration:270 不检查 aborted 就直接 toast，改英文会造成 UX 退化）；
    //       真实原因改由 debug 日志承载，不再被 '已停止' 覆盖丢失。
    const aborted = (e instanceof Error && e.name === 'AbortError') || !!signal?.aborted;
    if (aborted) {
      logger.debug(
        '生成',
        '[relay] chat 中止',
        { error: e instanceof Error ? e.message : String(e) },
        { module: 'image' },
      );
      return { ok: false, aborted: true, error: '已停止' };
    }
    return { ok: false, error: e instanceof Error ? e.message : '聊天失败' };
  }
}

/**
 * chat 流式出站（SSE，AI 助手专用）。打统一生成入口 POST /api/generate（capability=chat）。
 * 返回**未消费 body** 的原始 Response，SSE 逐块解析交给调用方（agentRuntime.resolveBody）。
 *  - stream 默认 true：后端透传 SSE（打字机 + tool_calls delta）；传 false 走同步 JSON。
 *    （后端以 `body.stream===true || hasTools` 自动判定是否流式，故非流式须显式 stream:false 且不带 tools。）
 *  - 非 2xx 抛 HttpError（httpClient 语义）；错误文案归一不在本层，交给 generate.chatStream 的 parseAgentError。
 *  - timeoutMs:0 不在此掐点——流式 body 读取的总超时由调用方 withTimeout 兜底（对齐失败可见/异步总超时）。
 */
export async function relayChatStream(opts: {
  intent: Pick<RelayIntent, 'frontTaskId' | 'providerId' | 'model'> & {
    messages?: unknown[];
    prompt?: string;
    images?: string[];
  };
  tools?: unknown[];
  stream?: boolean;
  signal?: AbortSignal;
  label?: string;
}): Promise<Response> {
  const { intent, tools, signal, label } = opts;
  const stream = opts.stream !== false;
  const body: Record<string, unknown> = {
    frontTaskId: intent.frontTaskId || '',
    providerId: intent.providerId,
    capability: 'chat',
    model: intent.model,
    ...(intent.messages ? { messages: intent.messages } : {}),
    ...(intent.prompt !== undefined ? { prompt: intent.prompt } : {}),
    ...(intent.images && intent.images.length > 0 ? { images: intent.images } : {}),
    ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    // 显式标注流式形态：stream=true 也写进 body（后端以 stream===true || hasTools 判流式），
    // 保持「前端要什么形态就声明什么」的确定性契约。
    ...(stream ? { stream: true } : { stream: false }),
    // 【TD-01-24 · 口径贯通】流式路径的**总预算**（等响应 + 响应体读取/解析）——
    // 与调用方总闸同源（`config.CHAT_TOTAL_TIMEOUT`），后端据此掐上游，避免"前端放弃、上游白跑"。
    timeoutMs: CHAT_TOTAL_TIMEOUT,
  };
  // parseJson:false → 返未消费 body 的原始 Response；非 2xx 抛 HttpError 由上层 chatStream 归一。
  return httpRequest(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(body),
    signal,
    retries: 0,
    timeoutMs: 0,
    parseJson: false,
    label: label || 'relayChatStream',
  });
}
