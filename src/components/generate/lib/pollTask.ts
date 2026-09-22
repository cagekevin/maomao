/**
 * 异步任务恢复轮询（R6，2026-09-03 收敛到 relay attach）。
 *
 * 【为什么做】
 * 前端刷新网页 ≠ 网关重启。异步任务（生图 / 视频）提交后，后端 relay-poll 常驻句柄在
 * localTool 进程继续跑，DB 是真相；前端刷新只是丢了「等结果回填」的动作。本模块刷新后从
 * 任务记录读 running（有 id=frontTaskId 即后端句柄键）→ 统一走 relay attach(/api/generate/:id)
 * 拿到终态 → 把持久 /files/ url 回填任务记录并广播节点。
 *
 * 【唯一查询协议】恢复不再自建轮询/落盘：复用 relayProxy.relayAttachUntilDone（和 in-flight
 * relayGenerate 同一 attach 循环），只 attach 不 cancel。结果 url = 后端已落盘 /files/，
 * 前端无需再 saveResultToTasks（旧网关 task 协议分支已删，恢复统一走 GET /api/generate/:id attach）。
 *
 * 【候选判定】旧实现依赖 pollTaskId（需 setTaskPollId 写入，relay 下无人写 → 候选空、恢复失效）。
 * 现改为 running 任务即可（task.id = frontTaskId = 后端句柄键），不再依赖 pollTaskId 字段。
 *
 * 【为什么不做文本 / 生图 sync】文本（chatCompletions）走 /api/generate（capability=chat）同步、生图 sync 无异步句柄，
 * 前端刷新即断，官方同此（reference-1mao shared.js Pt hook 也只对视频异步任务恢复）。
 */
import {
  getTasks,
  patchTask,
  ensurePolling,
  isPolling,
  stopPolling,
  completeTask,
  failTask,
} from '@/components/base/store/taskStore';
import { relayAttachUntilDone } from '@/components/generate/lib/relayProxy';
import { showToast } from '@/components/base/core/event/toastStore';
import { logger } from '@/components/base/core/log/logger';

// 【143 · S4′】原 `POLL_TIMEOUT_MS = 600_000`（本文件自持的恢复预算）**已删** ——
// 恢复路径的等待上限改为**从后端 attach 响应学**（`relayAttachUntilDone` 读 `st.budgetMs`）：
// 该路径本来就没有 POST 响应可读，而 attach 响应里后端会告知本任务的生效预算（S3′）⇒ 不必自持数值。
// 补扫周期：周期发现"启动扫描后新变为 running"的迟达候选并接管
const SCAN_INTERVAL: number = 5000;

/** 可轮询的异步任务形状（taskStore 持久任务字段子集；type/status 为 string） */
interface PollableTask {
  id: string;
  nodeId: string;
  type: string;
  status: string;
  progress?: number;
  resultUrl?: string;
}

let lastRun: number = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** 构造完整 relayAttachUntilDone（阻塞到终态）恢复器：由外部 once 驱动，不再周期 ensurePolling 嵌套。 */
function attachRecoveryOnce(task: PollableTask): Promise<boolean> {
  return pollOneTaskAttach(task);
}

/**
 * 恢复单任务的完整 attach 闭环（阻塞到终态或失败）：复用 relayAttachUntilDone 同款循环，
 * 一次调用即收敛——不复用 ensurePolling 周期驱动（避免「内嵌 while + 外层定时」嵌套轮询）。
 */
async function pollOneTaskAttach(task: PollableTask): Promise<boolean> {
  const frontTaskId = task.id;
  if (!frontTaskId) return false;
  logger.debug(
    '任务',
    '[恢复轮询] attach',
    { taskId: task.id, nodeId: task.nodeId, frontTaskId, type: task.type },
    { module: 'image' },
  );
  let st;
  try {
    st = await relayAttachUntilDone({
      frontTaskId,
      // 【143 · S4′】不传 `timeoutMs` ⇒ 由 attach 循环从后端 `budgetMs` 学（本路径无 POST 响应可读）。
      cancelOnAbort: false, // 恢复不取消，让后端句柄续跑到终态
      onProgress: (p) => {
        if (p !== undefined) patchTask(task.id, { status: 'running', progress: p });
      },
    });
  } catch (e) {
    logger.debug(
      '任务',
      '[恢复轮询] 网络失败，下轮重试',
      { taskId: task.id, error: (e as { message?: string })?.message },
      { module: 'image' },
    );
    return false;
  }
  if (st.ok && st.url) {
    // 完成：结果 url = 后端已落盘 /files/，直接回填
    // 【TD-01-20】终态走**唯一原语**（此前这里手写 patchTask + publishTaskCompleted，
    // 于是 live 路径的「非字符串防御 + 排障埋点 + 取消未落的进度写」三项在恢复路径全缺 —— 同一件事两套）。
    completeTask(task.id, st.url);
    logger.debug(
      '任务',
      '[恢复轮询] 完成',
      { taskId: task.id, nodeId: task.nodeId, hasResult: true },
      { module: 'image' },
    );
    return true;
  }
  // 【停止等待 ≠ 失败 · 2026-09-21】本轮 attach 的等待预算用尽（`pending`）只表示「这一轮没等到」，
  // 不是终态判据（终态归后端）。故**不 failTask**：任务行保持 running + 本函数返回 false →
  // 占位在 finally 释放 → 5s 补扫的下一轮继续 attach，直到后端写出真终态（completed/failed/unknown）。
  // 副作用（有意）：后端句柄彻底丢失且永不写终态时，任务行会一直 running —— 这是**后端的事**
  // （其 relay 句柄自带预算，到点必写终态），前端不再越权替它判死。
  if (st.pending) {
    logger.debug(
      '任务',
      '[恢复轮询] 本轮未等到终态，下轮续 attach',
      { taskId: task.id, nodeId: task.nodeId, error: st.error },
      { module: 'image' },
    );
    return false;
  }
  if (!st.ok && st.error) {
    const msg = st.error || '任务失败';
    failTask(task.id, msg);
    // A8：后端异步失败（relay-poll upsertFailed → attach 终态）原只进任务中心面板，不弹 toast；
    // 此处弹错误 toast，让后台生图/视频失败对前端用户实时可见（live 路径已由 useNodeGeneration 弹，
    // 本恢复路径经 isPolling 占位与候选仅含 running/pending 去重，不会与 live 双 toast、也不会重复弹）。
    showToast(msg, { type: 'error' });
    logger.debug(
      '任务',
      '[恢复轮询] 失败',
      { taskId: task.id, nodeId: task.nodeId, error: msg },
      { module: 'image' },
    );
    return true;
  }
  return false;
}

/**
 * 【启动扫描后接管】对「有后端异步句柄」的 running 任务发起完整 attach 闭环。
 * 关键：只接管 image/video（relay-poll 期已 submitGenerateTask 注册句柄）；文本（type:text 走
 * /api/generate（capability=chat）同步，从未 submit）无视 attach 句柄 → 若 attach 会因 relayPoll 恒 running 而空转推进
 * 进度到 90 封顶、永不结束（2026-09-03 bug：曾对所有 running 任务 attach，文本卡 90）。故按 type 过滤。
 * 用 isPolling 占位去重：同一 taskId 只接管一次；attach 结束后 release。
 */
function startRecoveryRound(): void {
  const candidates = getTasks().filter(
    (t) =>
      (t.status === 'running' || t.status === 'pending') &&
      (t.type === 'image' || t.type === 'video') &&
      t.id,
  ) as PollableTask[];
  if (candidates.length === 0) return;
  for (const t of candidates) {
    // 已被 in-flight 占位(occupyOnly)或已被本轮/既往 attach 接管 → 跳过，杜绝双恢复
    if (isPolling(t.id)) continue;
    // 占位：让 in-flight 与其它扫描看到「该 taskId 在恢复中」，attach 结束(终态/失败)后释放
    ensurePolling(t.id, { register: async () => true, occupyOnly: true });
    logger.debug(
      '任务',
      '[恢复轮询] 接管',
      { taskId: t.id, nodeId: t.nodeId, type: t.type },
      { module: 'image' },
    );
    void attachRecoveryOnce(t).finally(() => stopPolling(t.id));
  }
}

/**
 * 启动全局任务恢复轮询（App 挂载后调用一次）。
 * - 首次：启动扫描，对 running 任务逐个发起完整 attach 闭环（relayAttachUntilDone 低频 attach 到终态）。
 * - 周期补扫：迟达候选(启动扫描后新变为 running 的)也会被接管；isPolling 去重保证同 taskId 不重复接管。
 * 只对异步任务生效；文本/生图 sync 无异步句柄（attach 查 running），天然不恢复（chat 走 /api/generate capability=chat 同步）。
 */
export function initTaskRecovery(): void {
  if (timer) return; // 防重复启动
  startRecoveryRound();
  timer = setInterval(() => {
    const now = Date.now();
    if (now - lastRun < SCAN_INTERVAL) return;
    lastRun = now;
    startRecoveryRound();
  }, 2000); // 2s 检查 + 5s 补扫节流，兼顾即时与频率
}
