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
import { getTasks, patchTask, ensurePolling, isPolling, stopPolling } from '../store/taskStore.ts'
import { publishTaskCompleted } from '../store/taskCompletionBus.ts'
import { relayAttachUntilDone } from './relayProxy.ts'
import { showToast } from '../core/toastStore.ts'
import { logger } from '../core/logger.ts'

// 恢复轮询总超时兜底：单任务最多 attach 多久，到点 relayAttachUntilDone 强停防挂起
const POLL_TIMEOUT_MS: number = 600_000
// 补扫周期：周期发现"启动扫描后新变为 running"的迟达候选并接管
const SCAN_INTERVAL: number = 5000

/** 可轮询的异步任务形状（taskStore 持久任务字段子集；type/status 为 string） */
interface PollableTask {
  id: string
  nodeId: string
  type: string
  status: string
  progress?: number
  resultUrl?: string
}

let lastRun: number = 0
let timer: ReturnType<typeof setInterval> | null = null

/** 构造完整 relayAttachUntilDone（阻塞到终态）恢复器：由外部 once 驱动，不再周期 ensurePolling 嵌套。 */
function attachRecoveryOnce(task: PollableTask): Promise<boolean> {
  return pollOneTaskAttach(task)
}

/**
 * 恢复单任务的完整 attach 闭环（阻塞到终态或失败）：复用 relayAttachUntilDone 同款循环，
 * 一次调用即收敛——不复用 ensurePolling 周期驱动（避免「内嵌 while + 外层定时」嵌套轮询）。
 */
async function pollOneTaskAttach(task: PollableTask): Promise<boolean> {
  const frontTaskId = task.id
  if (!frontTaskId) return false
  logger.debug('任务', '[恢复轮询] attach', { taskId: task.id, nodeId: task.nodeId, frontTaskId, type: task.type }, { module: 'image' })
  let st
  try {
    st = await relayAttachUntilDone({
      frontTaskId,
      timeoutMs: POLL_TIMEOUT_MS,
      cancelOnAbort: false, // 恢复不取消，让后端句柄续跑到终态
      onProgress: (p) => { if (p !== undefined) patchTask(task.id, { status: 'running', progress: p }) },
    })
  } catch (e) {
    logger.debug('任务', '[恢复轮询] 网络失败，下轮重试', { taskId: task.id, error: e?.message }, { module: 'image' })
    return false
  }
  if (st.ok && st.url) {
    // 完成：结果 url = 后端已落盘 /files/，直接回填
    patchTask(task.id, { status: 'completed', progress: 100, resultUrl: st.url })
    publishTaskCompleted({ taskId: task.id, nodeId: task.nodeId, resultUrl: st.url, type: task.type, status: 'completed' })
    logger.debug('任务', '[恢复轮询] 完成', { taskId: task.id, nodeId: task.nodeId, hasResult: true }, { module: 'image' })
    return true
  }
  if (!st.ok && st.error) {
    const msg = st.error || '任务失败'
    patchTask(task.id, { status: 'failed', errorMsg: msg })
    // A8：后端异步失败（relay-poll upsertFailed → attach 终态）原只进任务中心面板，不弹 toast；
    // 此处弹错误 toast，让后台生图/视频失败对前端用户实时可见（live 路径已由 useNodeGeneration 弹，
    // 本恢复路径经 isPolling 占位与候选仅含 running/pending 去重，不会与 live 双 toast、也不会重复弹）。
    showToast(msg, { type: 'error' })
    logger.debug('任务', '[恢复轮询] 失败', { taskId: task.id, nodeId: task.nodeId, error: msg }, { module: 'image' })
    return true
  }
  return false
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
    (t) => (t.status === 'running' || t.status === 'pending') && (t.type === 'image' || t.type === 'video') && t.id
  ) as PollableTask[]
  if (candidates.length === 0) return
  for (const t of candidates) {
    // 已被 in-flight 占位(occupyOnly)或已被本轮/既往 attach 接管 → 跳过，杜绝双恢复
    if (isPolling(t.id)) continue
    // 占位：让 in-flight 与其它扫描看到「该 taskId 在恢复中」，attach 结束(终态/失败)后释放
    ensurePolling(t.id, { register: async () => true, occupyOnly: true })
    logger.debug('任务', '[恢复轮询] 接管', { taskId: t.id, nodeId: t.nodeId, type: t.type }, { module: 'image' })
    void attachRecoveryOnce(t).finally(() => stopPolling(t.id))
  }
}

/**
 * 启动全局任务恢复轮询（App 挂载后调用一次）。
 * - 首次：启动扫描，对 running 任务逐个发起完整 attach 闭环（relayAttachUntilDone 低频 attach 到终态）。
 * - 周期补扫：迟达候选(启动扫描后新变为 running 的)也会被接管；isPolling 去重保证同 taskId 不重复接管。
 * 只对异步任务生效；文本/生图 sync 无异步句柄（attach 查 running），天然不恢复（chat 走 /api/generate capability=chat 同步）。
 */
export function initTaskRecovery(): void {
  if (timer) return // 防重复启动
  startRecoveryRound()
  timer = setInterval(() => {
    const now = Date.now()
    if (now - lastRun < SCAN_INTERVAL) return
    lastRun = now
    startRecoveryRound()
  }, 2000) // 2s 检查 + 5s 补扫节流，兼顾即时与频率
}
