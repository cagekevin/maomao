/**
 * relay-poll —— relay 生成任务的「轮询句柄后端化」管理器。
 *
 * 【目标态（90-生成链路-relay-轮询后端化-执行方案 R1~R4）】
 *   轮询句柄生命周期归 localTool 进程（而非浏览器页面），可 attach：
 *     POST /api/generate               提交 → localTool 用 kit submit 拿 task_id，
 *                                      起后台轮询(句柄落库) → 立即返 {code:0,data:{taskId}}（不 await 终态）
 *     GET  /api/generate/:frontTaskId  查进度/结果，可重复 attach 到同一句柄：
 *                                      running   → {code:0,data:{status:'processing', progress}}
 *                                      completed → {code:0,data:{status:'completed', url:'/files/...'}}
 *                                      failed    → {code:0,data:{status:'failed', error}}
 *   前端刷新 = GET 重新 attach 到同一句柄；任务在 localTool 后台继续跑完并落盘 /files/，不丢图。
 *
 * 【复用 kit，不做外层重抄】本模块不自己拼请求/鉴权/抽字段——所有协议行为都交给
 *   relay-engine 的轮询驱动原语：
 *     - 提交：kit `submitModelProtocol` → 返回 { taskId, poll: ResolvedModelProtocolPoll }。
 *     - 单轮打点：kit `buildModelProtocolPollDriver(poll, apiKey).pollOnce()`
 *         → { phase:'processing'|'completed'|'failed', progress?, result?, error? }。
 *       kit 负责单轮查询 + 单轮内重试退避 + 状态/进度/结果/错误抽取 + 鉴权(query/bearer/header)。
 *     - 本模块只负责「何时打、打到终态后怎么落库/落盘」这一层生命周期。
 *   （driver 由 executor 抽出，pollResolvedModelProtocol 与外部共用同一套逻辑，见 executor.ts）
 *   意图 → kit 上下文组装与结果落盘复刻自 relay-common（buildRelayContext/persistResultUrl），
 *   与 /api/relay 同步链路共享一份平台知识，不各自漂移。
 *
 * 【句柄持久化 + 重启恢复】tasks 表 status 用 processing/pending，request_data 存协议快照（无密钥，
 *   直接存 submitModelProtocol 返回的 poll 对象，auth 只含方式不含 key），poll_task_id 存网关 task_id。
 *   apiKey 不入库（红线），重启后按 providerId 从 .env 重读，重建 driver。localTool 启动
 *   initRelayPoller() 从库读未终态任务重新起轮询。
 *
 * 【日志】沿用 [relay] 前缀体系：stage=submit/poll/extract/error，脱敏不打印 key。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readProviderKey } from './routes/providers.js';
import { parseJsonBody, sendError, json } from './utils/helpers.js';
import { submitModelProtocol, buildModelProtocolPollDriver } from './relay-engine/2-engine/executor.js';
import type { ModelProtocolPollDriver, ModelProtocolPollRound } from './relay-engine/2-engine/executor.js';
import type { ResolvedModelProtocolPoll } from './relay-engine/4-types/protocol.js';
import type { ModelProtocolVariables } from './relay-engine/2-engine/contract.js';
import { resolveRelayContext, persistResultUrl } from './relay-common.js';
import { getDb, queryAll, queryOne, run, debouncedSaveDb } from './db/database.js';

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** 总超时兜底：单任务从提交起最多跑 5min，对齐现有 PROXY_TIMEOUT / 前端 GEN_TIMEOUT */
const POLL_MAX_DURATION_MS = 5 * 60 * 1000;

/** tasks 表里与轮询相关的状态（后端自维护 processing/pending；completed/failed 为终态） */
type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** 单任务持久化快照（存 request_data JSON，无密钥）：协议 + 上下文，供重启恢复重建 driver */
interface PollRequestSnapshot {
  providerId: string;
  capability: string;
  model: string;
  /** submitModelProtocol 返回的 ResolvedModelProtocolPoll 整份（JSON 可序列化；auth 只含方式不含密钥） */
  poll: ResolvedModelProtocolPoll;
}

/** 进程内活跃句柄：taskId → 恢复重建上下文（含 poll + apiKey，key 只驻内存不落库） */
interface ActiveHandle {
  request: PollRequestSnapshot;
  apiKey: string;
  /** 重建 driver 的 poll（JSON.parse 一次后复用，避免每轮解析） */
  poll: ResolvedModelProtocolPoll;
  /** 单轮查询失败连续次数（做轻量退避，避免上游抖动时刷屏） */
  consecutiveErrors: number;
  /** 提交/恢复起始时间（越界判超时） */
  startedAt: number;
  /** 该句柄的调度定时器（setTimeout，单轮完成后视状态决定是否续期） */
  timer: ReturnType<typeof setTimeout> | null;
  /** 轮询计数（落库 poll_count） */
  pollCount: number;
}

/** 进程内句柄表：taskId(frontTaskId) → ActiveHandle */
const handles = new Map<string, ActiveHandle>();
/** 兜底扫描 ticker 是否已启动（initRelayPoller 幂等） */
let pollerStarted = false;

/* ══════════════════════════════════════════════════════════════════
 * 1. 提交端点  POST /api/generate
 * ══════════════════════════════════════════════════════════════════ */

/** POST /api/generate：提交(不 await 终态) → 返 taskId */
export async function handleGenerateSubmit(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;

  const ctx = await resolveRelayContext(body);
  if ('error' in ctx) {
    return json(res, { code: -1, data: { error: ctx.error, stage: 'submit', providerId: ctx.providerId, capability: ctx.capability } });
  }
  const { providerId, capability, model, protocol, baseUrl, apiKey, prompt, size, imageUrls } = ctx;

  // 前端贯穿的 task_id（可选）：用它做 tasks 主键 + GET 查询键，刷新后前端仍拿同一个 id attach。
  // 未提供则后端自造一个稳定 frontTaskId。
  const frontTaskId = typeof body?.taskId === 'string' && body.taskId
    ? body.taskId
    : `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[relay] ${ts()} | providerId=${providerId} capability=${capability} model=${model} stage=submit frontTaskId=${frontTaskId}`);

  try {
    // 异步提交走 kit lowLevel(submitModelProtocol)，需把语义字段收敛成 kit 协议变量
    const variables: ModelProtocolVariables = {
      model,
      prompt,
      ...(size ? { size } : {}),
      ...(imageUrls?.length ? { imageUrls } : {}),
    };
    const submitted = await submitModelProtocol({ apiKey, baseUrl, protocol, variables });
    // chat(sync)/text 无 poll → 本管理器只管异步 poll 任务；同步结果此链路不适用，报清晰错
    if (!submitted.poll) {
      return json(res, {
        code: -1,
        data: { error: '该模型是同步返回、无异步任务，请走 /api/relay 同步链路', stage: 'submit', providerId, capability },
      });
    }
    const request: PollRequestSnapshot = {
      providerId, capability, model,
      poll: submitted.poll, // 整份 poll（JSON 安全，无密钥）
    };

    // 落库（句柄持久化，重启恢复依据）：status=processing 即「需继续轮询」
    const db = await getDb();
    const now = Date.now();
    run(db,
      `INSERT INTO tasks (task_id, type, status, channel_name, model_name, prompt, progress,
        poll_task_id, created_at, submit_ack_at, request_data, poll_count)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0)
       ON CONFLICT(task_id) DO UPDATE SET
        type=excluded.type, status=excluded.status, channel_name=excluded.channel_name,
        model_name=excluded.model_name, prompt=excluded.prompt, progress=excluded.progress,
        poll_task_id=excluded.poll_task_id, submit_ack_at=excluded.submit_ack_at,
        request_data=excluded.request_data, error_msg=NULL, result_url=NULL, completed_at=NULL`,
      [frontTaskId, capability, 'processing', providerId, model,
        prompt, submitted.taskId ?? '', now, now, JSON.stringify(request)]);
    debouncedSaveDb();

    // 注册后台轮询（若已有同 id 句柄则先停旧的，防重复轮询双倍消耗积分）
    const existing = handles.get(frontTaskId);
    if (existing?.timer) clearTimeout(existing.timer);
    handles.set(frontTaskId, {
      request,
      apiKey,
      poll: submitted.poll,
      consecutiveErrors: 0,
      startedAt: Date.now(),
      timer: null,
      pollCount: 0,
    });
    armPoll(frontTaskId);

    return json(res, { code: 0, data: { taskId: frontTaskId } });
  } catch (e) {
    console.error(`[relay] ${ts()} | ${providerId}/${capability} submit 失败: ${(e as Error)?.message || String(e)}`);
    return json(res, {
      code: -1,
      data: { error: (e as Error)?.message || '提交失败', stage: 'submit', providerId, capability },
    });
  }
}

/* ══════════════════════════════════════════════════════════════════
 * 2. 轮询管理器（R2）—— 打点驱动
 * ══════════════════════════════════════════════════════════════════ */

/**
 * 做一轮打点：基于句柄的 poll 重建 driver 并 pollOnce。每次重建一个临时 driver，
 * 让「可 attach 的外部打点」天然隔离：GET 过来打一轮就丢，不共享可变轮询状态。
 */
async function pollOnceRound(handle: ActiveHandle): Promise<ModelProtocolPollRound> {
  const driver: ModelProtocolPollDriver = buildModelProtocolPollDriver(handle.poll, handle.apiKey);
  return driver.pollOnce();
}

/** 落库一个任务字段；fire-and-forget，失败不打断轮询 */
function persistTask(taskId: string, fields: Record<string, string | number | null>): void {
  getDb().then((db) => {
    try {
      const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
      run(db, `UPDATE tasks SET ${sets} WHERE task_id = ?`, [...Object.values(fields), taskId]);
      debouncedSaveDb();
    } catch (e) {
      console.error(`[relay] ${ts()} | 任务落库失败 ${taskId}: ${(e as Error)?.message}`);
    }
  }).catch(() => { /* db 未就绪忽略 */ });
}

/** 调度的核心：对单个句柄执行一轮打点，据结果落库并决定是否续期/清理 */
async function runPollRound(taskId: string): Promise<void> {
  const handle = handles.get(taskId);
  if (!handle) return;
  // 总超时兜底：超 POLL_MAX_DURATION_MS 判失败，防僵尸任务永不结束（对齐 §7.5.4 轮询上限）
  if (Date.now() - handle.startedAt > POLL_MAX_DURATION_MS) {
    console.log(`[relay] ${ts()} | ${taskId} poll 超时(>${POLL_MAX_DURATION_MS / 1000}s)，判失败`);
    finishTask(taskId, 'failed', '模型任务轮询超时');
    return;
  }

  try {
    const round = await pollOnceRound(handle);
    if (round.phase === 'completed') {
      // 完成：把 kit 返回的上游 url 落盘成 /files/（对齐 relay-common / 既有生成结果规范）
      const url = await persistResultUrl(round.result?.urls?.[0]);
      finishTask(taskId, 'completed', undefined, url);
      return;
    }
    if (round.phase === 'failed') {
      finishTask(taskId, 'failed', round.error ?? '未知错误');
      return;
    }
    // processing：更新进度 + poll_count，续期下一轮
    handle.pollCount += 1;
    const progressInt = round.progress === undefined ? undefined
      : Math.max(0, Math.min(100, Math.round(round.progress)));
    persistTask(taskId, {
      status: 'processing',
      ...(progressInt === undefined ? {} : { progress: progressInt }),
      poll_count: handle.pollCount,
    });
    if (progressInt !== undefined && progressInt % 25 === 0) {
      console.log(`[relay] ${ts()} | ${taskId} stage=poll status=processing progress=${progressInt}`);
    }
    handle.consecutiveErrors = 0;
    armPoll(taskId);
  } catch (e) {
    // 单轮失败（含 kit 单轮内重试耗尽后抛错）：连续失败做轻量退避，过长判失败，防死循环刷上游
    handle.consecutiveErrors += 1;
    const errMsg = (e as Error)?.message || String(e);
    if (handle.consecutiveErrors >= 5) {
      console.error(`[relay] ${ts()} | ${taskId} 连续查询失败，判失败: ${errMsg}`);
      finishTask(taskId, 'failed', errMsg);
      return;
    }
    console.log(`[relay] ${ts()} | ${taskId} stage=poll attempt=${handle.consecutiveErrors} 查询失败，稍后退避重试`);
    const backoff = (handle.poll.intervalMs > 0 ? handle.poll.intervalMs : 3000)
      * Math.min(handle.consecutiveErrors, 4);
    scheduleRound(taskId, backoff);
  }
}

/** 续期：默认按 poll.intervalMs 排下一轮 */
function armPoll(taskId: string): void {
  const handle = handles.get(taskId);
  if (!handle) return;
  const interval = handle.poll.intervalMs > 0 ? handle.poll.intervalMs : 3000;
  scheduleRound(taskId, interval);
}

function scheduleRound(taskId: string, delayMs: number): void {
  const handle = handles.get(taskId);
  if (!handle) return;
  if (handle.timer) clearTimeout(handle.timer);
  handle.timer = setTimeout(() => { runPollRound(taskId); }, delayMs);
}

/** 终态落库 + 清理进程内句柄 */
function finishTask(taskId: string, status: TaskStatus, error?: string, url?: string): void {
  const handle = handles.get(taskId);
  if (handle?.timer) clearTimeout(handle.timer);
  handles.delete(taskId);
  console.log(`[relay] ${ts()} | ${taskId} stage=${status === 'completed' ? 'extract' : 'error'} status=${status}${url ? ` url=${url}` : ''}`);
  persistTask(taskId, {
    status,
    ...(url ? { result_url: url } : {}),
    ...(error ? { error_msg: error } : {}),
    completed_at: Date.now(),
  });
}

/* ══════════════════════════════════════════════════════════════════
 * 3. 查询端点  GET /api/generate/:frontTaskId（R3，可重复 attach）
 * ══════════════════════════════════════════════════════════════════ */
export async function handleGenerateGet(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const m = url.pathname.match(/^\/api\/generate\/([^/]+)$/);
  const taskId = m ? decodeURIComponent(m[1]) : '';
  if (!taskId) return sendError(res, 'Missing task id', 400);

  // 进程内句柄存在 → 正在轮询（processing/pending）
  if (handles.has(taskId)) {
    const db = await getDb();
    const row = queryOne(db, `SELECT progress FROM tasks WHERE task_id = ?`, [taskId]);
    const progress = typeof row?.progress === 'number' ? row.progress : 0;
    return json(res, { code: 0, data: { status: 'processing', progress } });
  }

  // 无句柄：从库查终态（completed → /files/ url；failed → error）
  const db = await getDb();
  const row = queryOne(db,
    `SELECT status, result_url, error_msg, progress FROM tasks WHERE task_id = ?`, [taskId]);
  if (!row) return sendError(res, 'Task not found', 404);

  if (row.status === 'completed') {
    return json(res, { code: 0, data: { status: 'completed', url: row.result_url } });
  }
  if (row.status === 'failed') {
    return json(res, { code: 0, data: { status: 'failed', error: row.error_msg || '生成失败' } });
  }
  // processing/pending 但进程内无句柄：通常是进程重启后恢复扫描尚未建档，或句柄失联；
  // 前台 GET 到此先触发一次重启恢复扫描（幂等），再返回当前进度让前端稍后重试
  if (!pollerStarted) {
    void initRelayPoller();
  }
  return json(res, { code: 0, data: { status: 'processing', progress: typeof row?.progress === 'number' ? row.progress : 0 } });
}

/* ══════════════════════════════════════════════════════════════════
 * 3.5 取消端点  POST /api/generate/:frontTaskId/cancel（能力零退化：前端可中止生成）
 * ══════════════════════════════════════════════════════════════════ */

/**
 * 取消一个后端轮询任务：停掉句柄定时器、清理进程内句柄，并把 DB 里仍 processing/pending 的行
 * 标为 failed(error_msg='生成被中止')，避免重启恢复又把它捞起来续轮询。幂等：任务不存在 /
 * 已终态也返回 ok（无句柄可停，DB 已终态则不动），前端取消无需关心具体在哪一段。
 */
export async function handleGenerateCancel(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const m = url.pathname.match(/^\/api\/generate\/([^/]+)\/cancel$/);
  const taskId = m ? decodeURIComponent(m[1]) : '';
  if (!taskId) return sendError(res, 'Missing task id', 400);

  // 停进程内句柄（若存在）：清定时器 + 从 handles 移除，确保后台轮询立即停止、不再续打/落盘
  const handle = handles.get(taskId);
  if (handle?.timer) clearTimeout(handle.timer);
  if (handle) {
    handles.delete(taskId);
    console.log(`[relay] ${ts()} | ${taskId} stage=error status=failed 用户取消，已停轮询`);
  }

  // DB 落终态：仅当仍 processing/pending 时标 failed('生成被中止')；已完成/已失败/不存在则不改动
  const db = await getDb();
  const row = queryOne(db, `SELECT status FROM tasks WHERE task_id = ?`, [taskId]);
  if (row && (row.status === 'processing' || row.status === 'pending')) {
    persistTask(taskId, {
      status: 'failed',
      error_msg: '生成被中止',
      completed_at: Date.now(),
    });
  }
  return json(res, { code: 0, data: { ok: true } });
}

/* ══════════════════════════════════════════════════════════════════
 * 4. 句柄恢复 + 启动（R4）
 * ══════════════════════════════════════════════════════════════════ */

/** 从落库的 request_data 快照重建一个句柄（key 重读 .env，绝无密钥落库）。失败返回 null */
function rebuildHandle(taskId: string, row: Record<string, unknown>): ActiveHandle | null {
  let snap: PollRequestSnapshot | null = null;
  const raw = row.request_data;
  if (typeof raw === 'string') {
    try { snap = JSON.parse(raw); } catch { snap = null; }
  } else if (raw && typeof raw === 'object') {
    snap = raw as PollRequestSnapshot;
  }
  if (!snap?.poll?.url || !snap.poll.statusPath) return null;
  return {
    request: snap,
    apiKey: readProviderKey(snap.providerId), // key 真源 .env（红线：不入库），重启后重读
    poll: snap.poll,
    consecutiveErrors: 0,
    startedAt: Date.now(), // 重启后重新计时（避免把上次的累计时长算进本轮）
    timer: null,
    pollCount: typeof row.poll_count === 'number' ? row.poll_count : 0,
  };
}

/**
 * 启动恢复：读 tasks 表里 status='processing'(或 pending) 且有协议快照的行，
 * 重建句柄并续轮询。幂等（多次调用只起一次兜底 ticker）。在 localTool 启动后调用一次。
 */
export async function initRelayPoller(): Promise<void> {
  const db = await getDb();
  const rows = queryAll(db,
    `SELECT task_id, request_data, poll_count FROM tasks WHERE status IN ('processing','pending') AND request_data IS NOT NULL`);
  const recovered: string[] = [];
  for (const row of rows) {
    const taskId = String(row.task_id ?? '');
    if (!taskId || handles.has(taskId)) continue;
    const handle = rebuildHandle(taskId, row);
    if (!handle) {
      // 快照损坏/provider 缺失：无法续轮询，标 failed 防止永久悬挂
      finishTask(taskId, 'failed', '任务句柄不可恢复(快照或 provider 缺失)');
      continue;
    }
    handles.set(taskId, handle);
    recovered.push(taskId);
  }
  if (recovered.length) {
    console.log(`[relay] ${ts()} | 重启恢复 ${recovered.length} 个未完成任务: ${recovered.join(', ')}`);
    recovered.forEach((id) => armPoll(id));
  }

  if (!pollerStarted) {
    pollerStarted = true;
    // 定时兜底扫描：确保任何原因漏排的活跃句柄仍会被打一轮（防御性，正常走各自 setTimeout）
    const guardian = setInterval(() => {
      for (const taskId of handles.keys()) {
        const h = handles.get(taskId);
        if (h && !h.timer) armPoll(taskId);
      }
    }, 6000);
    // guardian 不阻止进程退出；进程关闭时 handles 随进程销毁，无需 clear（sql.js 内存库由 closeDb 兜底）
    void guardian;
  }
}
