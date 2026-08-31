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
import { API_BASE } from './config.js'
import { getTasks, patchTask } from './taskStore.ts'
import { publishTaskCompleted } from './taskCompletionBus.ts'
import { extractResultUrl as extractResult } from './resultUrlExtractor.ts'
import { logger } from './logger.ts'

// 轮询节流：单进程内两次全量扫描最小间隔（ms）
const POLL_INTERVAL: number = 5000
// 每轮最多并发查询的任务数（避免一次刷新几十个任务打爆网关）
const MAX_PER_ROUND: number = 5

/** 可轮询的异步任务形状（taskStore 持久任务字段子集；type/status 为 string） */
interface PollableTask {
  id: string
  nodeId: string
  type: string
  status: string
  pollTaskId?: string
  progress?: number
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
    // 提取结果 URL（直达统一解析器 resultUrlExtractor；|| '' 兜底空值，避免 undefined 落进任务记录）
    const resultUrl = extractResult({ data, type: task.type as 'image' | 'video' | 'audio' }) || ''
    patchTask(task.id, { status: 'completed', progress: 100, resultUrl })
    // 广播完成事件（统一入口 publishTaskCompleted）：节点监听 agent:task-completed 回写（经 eventBus，解耦 window）
    publishTaskCompleted({ taskId: task.id, nodeId: task.nodeId, resultUrl, type: task.type, status: 'completed' })
    logger.debug('任务', '[恢复轮询] 完成', { taskId: task.id, nodeId: task.nodeId, hasResult: !!resultUrl }, { module: 'image' })
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

/** 一轮扫描：找 running/pending 且有 pollTaskId 的任务，逐个查询。 */
async function runRound(): Promise<void> {
  const tasks = getTasks() as PollableTask[]
  const candidates = tasks.filter(
    (t) => (t.status === 'running' || t.status === 'pending') && t.pollTaskId
  )
  if (candidates.length === 0) return
  // 每轮最多查 MAX_PER_ROUND 个，防止一次刷新几十个任务打爆网关；超出的下轮再查
  const slice = candidates.slice(0, MAX_PER_ROUND)
  // 【P0 埋点】本轮待恢复任务数（排查「刷新后任务没恢复」：确认有候选且每轮扫到）
  logger.debug('任务', '[恢复轮询] 本轮', { candidates: candidates.length, querying: slice.length }, { module: 'image' })
  await Promise.all(slice.map((t) => pollOneTask(t).catch(() => false)))
}

/**
 * 启动全局任务恢复轮询（App 挂载后调用一次）。
 * 只对有 pollTaskId 的异步任务生效；文本/生图 sync 无 pollTaskId，天然跳过。
 */
export function initTaskRecovery(): void {
  if (timer) return // 防重复启动
  timer = setInterval(() => {
    const now = Date.now()
    if (now - lastRun < POLL_INTERVAL) return
    lastRun = now
    runRound()
  }, 2000) // 用 2s 检查 + 5s 节流，兼顾即时性与频率
}
