/**
 * 异步任务恢复轮询（方案A：能查的才查，不能查的不查）
 *
 * 【为什么做】（取舍，与后端注释一一对应）
 * 前端刷新网页 ≠ 网关重启。异步任务（生图 async 模式 / 视频）提交后，任务在
 * 网关/Lovart 继续跑，只是前端刷新丢了「等结果」的请求。本模块靠已落库的
 * pollTaskId（网关返回的 task_id，见 taskStore.setTaskPollId）重新发起查询，
 * 把任务状态/结果补回任务记录，实现「刷新后任务继续跑直到返回」。
 *
 * 【为什么不做文本 / 生图 sync】
 * 文本（chatCompletions）与生图 sync(SSE) 是同步阻塞请求，前端刷新即断、无
 * task_id 可查。官方（reference-1mao shared.js Pt hook）也只对视频异步任务做
 * 刷新轮询，对文本/同步直接「仅支持刷新视频任务状态」。故这里只轮询有
 * pollTaskId 的异步任务；要恢复文本需网关 chat 异步化（方案B，暂不做，见下）。
 *
 * 【为什么走 localTool /api/v1/gateway/task 而非具体 provider】
 * 该入口是 localTool 统一转发网关的固定查询端点（system.ts handleGatewayTask），
 * 按 task_id 查，不依赖具体 provider 的 base_url → 换 API 也有效，前端无感。
 *
 * 【方案B（未实施）】文本恢复需让网关 chat 也「提交返回 task_id」+ 前端轮询，
 * 工作量大且要动网关，本期不做。若后续需要，在网关 chat_completions 加异步
 * 分支 + 本模块放开 type 限制即可。
 */
import { httpRequest } from './httpClient.ts'
import { API_BASE } from '../config.ts'
import { getTasks, patchTask, ensurePolling, isPolling } from '../taskStore.ts'
import { publishTaskCompleted } from '../taskCompletionBus.ts'
import { extractResultUrl as extractResult } from '../resultUrlExtractor.ts'
import { isLocalFileUrl } from '../imageUrl.ts'
import { logger } from '../logger.ts'

// 恢复轮询单轮间隔（与旧全量扫描节流一致）
const POLL_INTERVAL: number = 5000
// 恢复轮询总超时兜底：单任务最多恢复轮询多久，到点强停防挂起
const POLL_TIMEOUT_MS: number = 600_000
// 补扫周期：周期发现"启动扫描后新变为 running&&有 pollTaskId"的迟达候选并接管
const SCAN_INTERVAL: number = 5000

/** 可轮询的异步任务形状（taskStore 持久任务字段子集；type/status 为 string） */
interface PollableTask {
  id: string
  nodeId: string
  type: string
  status: string
  pollTaskId?: string
  progress?: number
  /** 任务记录里已持久化的 resultUrl（若 in-flight 阶段已落盘 /files/ 则非空） */
  resultUrl?: string
}

let lastRun: number = 0
let timer: ReturnType<typeof setInterval> | null = null

/** 查询单个异步任务最新状态并回写任务记录。返回是否达到终态（completed/failed）。 */
export async function pollOneTask(task: PollableTask): Promise<boolean> {
  const pollTaskId = task.pollTaskId
  if (!pollTaskId) return false
  // 【P0 埋点】恢复轮询：开始查询网关（排查「刷新后任务/节点没恢复」：确认轮询是否发起）
  logger.debug('任务', '[恢复轮询] 查询', { taskId: task.id, nodeId: task.nodeId, pollTaskId, type: task.type }, { module: 'image' })
  let res
  try {
    res = await httpRequest(`${API_BASE}/api/v1/gateway/task/${encodeURIComponent(pollTaskId)}`, { parseJson: false })
  } catch (e) {
    // 网络抖动/网关未起：不误判失败，下轮再试（保持 running，避免刷新后误报 failed）
    logger.debug('任务', '[恢复轮询] 网络失败，下轮重试', { taskId: task.id, error: e?.message }, { module: 'image' })
    return false
  }
  let body
  try { body = await res.json() } catch {
    logger.debug('任务', '[恢复轮询] 响应非 JSON，下轮重试', { taskId: task.id, pollTaskId }, { module: 'image' })
    return false
  }
  // 网关任务查询返回 {code, data:{id,status,progress,result,error,video_url}}
  const data = body?.data
  if (!data) return false
  const status = data.status
  if (status === 'completed') {
    // 【S2-b 修根因 C：恢复不得覆盖已持久结果】任务记录里若已有已持久 /files/ resultUrl
    //（in-flight 阶段经 useNodeGeneration 落盘过），恢复轮询必须保留它，不能再用网关提取的
    // 原始上游外链覆盖——否则刷新后节点把持久 URL 换成会过期的外链 → 丢图。
    // 仅当任务记录无 resultUrl（如进程崩在落盘前、刷新后从未落盘）才回源网关拿原始 URL 兜底
    // （宁可显示外链也不丢图；此极端边界彻底根治留 S4 撤销 P0-C）。
    const existingPersisted = task.resultUrl && isLocalFileUrl(task.resultUrl)
    const resultUrl = existingPersisted
      ? task.resultUrl!
      : (extractResult({ data, type: task.type as 'image' | 'video' | 'audio' }) || '')
    // patchTask 是合并式更新：仅当兜底取到 URL 或要修正空值时才带 resultUrl 字段；
    // 若任务记录已有持久 URL 且网关兜底为空，仍保留原持久 URL 不回退成空。
    const finalResultUrl = resultUrl || task.resultUrl || ''
    patchTask(task.id, { status: 'completed', progress: 100, resultUrl: finalResultUrl })
    // 广播完成事件（统一入口 publishTaskCompleted）：节点监听 agent:task-completed 回写（经 eventBus，解耦 window）
    publishTaskCompleted({ taskId: task.id, nodeId: task.nodeId, resultUrl: finalResultUrl, type: task.type, status: 'completed' })
    logger.debug('任务', '[恢复轮询] 完成', { taskId: task.id, nodeId: task.nodeId, hasResult: !!finalResultUrl, reusedPersisted: !!existingPersisted }, { module: 'image' })
    return true
  }
  if (status === 'failed' || status === 'error') {
    const msg = data.error?.message || data.error || '任务失败'
    patchTask(task.id, { status: 'failed', errorMsg: typeof msg === 'object' ? JSON.stringify(msg) : msg })
    logger.debug('任务', '[恢复轮询] 失败', { taskId: task.id, nodeId: task.nodeId, error: typeof msg === 'object' ? JSON.stringify(msg) : msg }, { module: 'image' })
    return true
  }
  // 还在跑：更新进度（processing/pending）
  const progress = typeof data.progress === 'number' ? data.progress : undefined
  if (progress !== undefined) {
    patchTask(task.id, { status: 'running', progress })
  } else {
    patchTask(task.id, { status: 'running' })
  }
  logger.debug('任务', '[恢复轮询] 进行中', { taskId: task.id, nodeId: task.nodeId, progress: progress ?? 'n/a' }, { module: 'image' })
  return false
}

/**
 * 【S2-c】为单个恢复任务构造 ensurePolling 的单轮回调。
 * 每次 ensurePolling 驱动时，按 taskId 从任务记录取最新任务再跑 pollOneTask 单轮：
 * - 任务已不存在 → 视为终态(true)让 poller 停，避免对已删任务空转
 * - 否则 pollOneTask(fresh) 单轮查询网关，completed/failed 返回 true(poller 自停)
 */
function registerPollRound(seed: PollableTask): (taskId: string) => Promise<boolean> {
  return async (taskId) => {
    const fresh = getTasks().find((t) => t.id === taskId) as PollableTask | undefined
    if (!fresh) return true // 任务已删/已清 → 恢复轮询没必要继续，收敛
    return pollOneTask(fresh)
  }
}

/** 启动扫描：找 running/pending 且有 pollTaskId 的任务，逐个 ensurePolling 接管。 */
function startRecoveryRound(): void {
  const candidates = getTasks().filter(
    (t) => (t.status === 'running' || t.status === 'pending') && t.pollTaskId
  ) as PollableTask[]
  if (candidates.length === 0) return
  for (const t of candidates) {
    // 已被 in-flight 占位(occupyOnly)或已被本轮/既往 ensurePolling 注册 → 跳过，杜绝双轮询
    if (isPolling(t.id)) continue
    // 未接管 → 注册恢复 poller（ensurePolling 内部保证同 taskId 只有一个，定时驱动 register 到终态）
    ensurePolling(t.id, {
      register: registerPollRound(t),
      pollIntervalMs: POLL_INTERVAL,
      timeoutMs: POLL_TIMEOUT_MS,
    })
    logger.debug('任务', '[恢复轮询] 接管', { taskId: t.id, nodeId: t.nodeId, pollTaskId: t.pollTaskId, type: t.type }, { module: 'image' })
  }
}

/**
 * 启动全局任务恢复轮询（App 挂载后调用一次）。
 * - 首次：启动扫描，对 running/pending && pollTaskId 且未占位/未驱动的任务注册 ensurePolling 接管。
 * - 周期补扫：迟达候选(启动扫描后新变为 running&&有 pollTaskId 的)也会被接管；
 *   ensurePolling/isPolling 去重保证同 taskId 不重复注册，故周期重扫安全、无双轮询。
 * 只对有 pollTaskId 的异步任务生效；文本/生图 sync 无 pollTaskId，天然跳过。
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
