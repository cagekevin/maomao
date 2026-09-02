/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 本文件含两张自建监听/注册：① listeners（任务中心 store 订阅，initTasks/notify 用）；
 * ② retryRegistry（registerTaskRetry，按 nodeId 的键控回调注册表）。
 * ②与 toolRegistry.js 同为「运行时注册 + 查询」形态——兄弟，禁止再开第三种注册形态；
 * ①为 store 自带订阅（非广播通道），与 eventBus.js / promptHubStore.js 的同构订阅并列为兄弟。
 *
 * 任务中心 store —— 后端化（对齐官方，数据落 localTool /api/tasks → SQLite）。
 *
 * 职责：
 *  - 内存态 `tasks` 是唯一数据源（供 useTasks / 任务中心 UI 实时订阅）。
 *  - 启动时从 /api/tasks 加载历史任务（刷新/重启不丢）。
 *  - 增删改（reportGenerate / progress / done / fail / removeTask / clearTasksBy）
 *    同步调用后端持久化（fire-and-forget，不阻塞 UI；失败降级为仅内存）。
 *
 * 任务字段（对齐官方 Ln.jsx / jn.jsx）：
 *  { id(=taskId), nodeId, type, prompt, modelName, channelName,
 *    status:'pending'|'running'|'completed'|'failed', progress, errorMsg, resultUrl, createdAt }
 */
import { useSyncExternalStore } from 'react'
import { logger } from './logger.ts'
import { createDebouncedPersist } from './contentStore.ts'
import { fetchTasks, saveTask, deleteTask, batchDeleteTasks, clearAllTasksApi } from './api/localToolApi.ts'
import { publishTaskCompleted } from './taskCompletionBus.ts'
import { generateId } from './idGen.ts'
import { GEN_MAX_CONCURRENT } from './config.ts'
// 用命名空间调用而非 `subscribe` 具名导入：本模块内部已有同名 `subscribe`（任务监听器），
// 具名导入会遮蔽。且 check-events.mjs 只识别 `publish/subscribe/subscribeOnce` 三个函数名，
// 用别名（onEvent）会让这条订阅逃出事件契约登记的反向校验 —— 必须用能被门禁扫描到的写法。
import * as eventBus from './eventBus.ts'
import { buildUrlRewritePairs } from './imageUrl.ts'

/** 任务状态机：pending(待跑) → running(进行中) → completed / failed */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 任务记录（对齐官方 Ln.jsx / jn.jsx 字段） */
export interface Task {
  /** 前端自造任务 id（= 贯穿链路主键，经 run ctx 透传给 generateImage opts.taskId） */
  id: string
  /** 归属节点 id；空则视为网关占位垃圾行，不进任务中心展示 */
  nodeId: string
  type: string
  prompt?: string
  modelName?: string
  channelName?: string
  status: TaskStatus
  progress?: number
  errorMsg?: string
  resultUrl?: string
  createdAt?: number
  /** 当前进行到哪一步的文案（如「已转发到生成网关…」） */
  stageLabel?: string
  /** 异步任务的可轮询网关 task_id（= task_<thread_id>），同步任务无此字段 */
  pollTaskId?: string
  [key: string]: unknown
}

/**
 * reportGenerate 返回的任务控制器。
 * 这是权威定义：useNodeGeneration 等下游直接复用本类型，不再各写一份。
 */
export interface TaskController {
  /** 请求级贯穿主键，经 run ctx 透传给 generateImage/generateVideo 的 opts.taskId */
  taskId: string
  progress: (percent: number, stage?: string) => void
  done: (resultUrl: string) => void
  fail: (errorMsg?: string) => void
}

/** 左侧面板状态 */
export interface PanelState {
  expanded: boolean
  /** 'tasks' = 任务中心 | 'assets' = 素材库 */
  activeTab: string
  /** 钉住后点击面板外部不再自动收起 */
  pinned: boolean
}

let tasks: Task[] = []
const listeners = new Set<() => void>()

// ── 启动时从后端加载历史任务 ──
let loaded = false
export function initTasks(): void {
  if (loaded) return
  loaded = true
  fetchTasks({ pageSize: 500 })
    .then((data) => {
      const items = Array.isArray(data?.data?.items) ? (data.data.items as Task[]) : []
      if (items.length > 0) {
        tasks = items
        notify()
      }
    })
    .catch((e) => logger.warn('taskStore', '加载历史任务失败（localTool 未连？）', e?.message))
}

// 后端保存（fire-and-forget，失败仅降级为内存态，前端流程不受影响）
function persist(task: Task): void {
  saveTask(task).catch((e) => logger.warn('task', 'persist-fail', { taskId: task?.id, error: e?.message }))
}

// 状态 → 圆点/文字 颜色（对齐官方 An）
export function statusDotClass(status?: string): string {
  if (status === 'completed') return 'bg-emerald-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-blue-400'
}

// 状态 → 文案（对齐官方 On）
export function statusLabel(status?: string, progress = 0): string {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'pending') return '生成中'
  if (status === 'running') return progress > 0 ? `${Math.round(progress)}%` : '生成中'
  return status || ''
}

// 类型 → 文案（对齐官方 Tn 映射 + 补充）
export function typeLabel(type?: string): string {
  const MAP: Record<string, string> = {
    text: '文本',
    image: '生图',
    video: '视频',
    sd2Video: 'SD2视频',
    discountVideo: '视频生成',
    custom: '万能',
    rhWebapp: 'AI应用',
  }
  return (type && MAP[type]) || type || '任务'
}

function genId(): string {
  return generateId('task')
}

function notify(): void {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

// 展示用快照（供 useTasks / 任务中心 UI）：过滤掉 nodeId 为空的无效任务。
// 这类任务是网关占位垃圾行（persistThreadId 旧逻辑为网关 task_id 单独建的空行），
// 没有归属节点，不应在任务中心展示。用快照缓存保证引用稳定，避免 useSyncExternalStore 无限重渲染。
// 注意：轮询用的 getTasks() 仍返回完整原始数组（含无 nodeId 的行），不影响异步任务恢复逻辑。
let snapshotCache: { source: Task[]; list: Task[] } | null = null
function getSnapshot(): Task[] {
  if (!snapshotCache || snapshotCache.source !== tasks) {
    snapshotCache = { source: tasks, list: tasks.filter((t) => t.nodeId) }
  }
  return snapshotCache.list
}

/** 非 React 环境读取当前任务列表（供轮询/脚本等模块级使用）。 */
export function getTasks(): Task[] {
  return tasks
}

// ── 素材 url 变更（改名 / 移动）→ 同步内存任务的 resultUrl ──
// 后端已改写 tasks 表（rewriteUrlReferences），这里同步「当前页面内存」：
// 否则任务中心卡片（缩略图渲染 / 下载 / 拖拽建节点）仍指旧路径 → 破图，刷新页面才恢复（清单 #8）。
// 改写工具与 App.jsx（画布 / 脚本箱节点）共用 imageUrl.js 的同一份实现，不另写一套。
eventBus.subscribe('resource:renamed', (payload) => {
  const { oldUrl, newUrl } = (payload || {}) as { oldUrl?: string; newUrl?: string }
  if (!oldUrl || !newUrl || oldUrl === newUrl) return
  const pairs = buildUrlRewritePairs(oldUrl, newUrl)
  let changed = false
  const next = tasks.map((t) => {
    let resultUrl = t.resultUrl
    if (typeof resultUrl === 'string') {
      for (const [from, to] of pairs) {
        if (resultUrl.includes(from)) resultUrl = resultUrl.split(from).join(to)
      }
    }
    if (resultUrl === t.resultUrl) return t
    changed = true
    return { ...t, resultUrl }
  })
  // 只有真变了才换引用 + 通知，避免无谓重渲染
  if (changed) {
    tasks = next
    notify()
  }
})

// ── 左侧面板全局状态（对齐官方 setShowTaskList：生成任务时自动弹出任务中心）──
// 官方 H_.jsx 在每次提交生成任务时调用 H?.(true)（即 setShowTaskList(true)）弹出任务中心。
// 我们统一契约里所有生成节点都走 reportGenerate，故在这里触发 openTaskCenter()，覆盖面最全
// （节点生成 / Agent generate_node / 任务中心重试 提交任务都会自动弹面板切到任务中心）。
let panel: PanelState = { expanded: false, activeTab: 'tasks', pinned: false }
const panelListeners = new Set<() => void>()
function notifyPanel(): void {
  panelListeners.forEach((l) => l())
}
function panelSubscribe(cb: () => void): () => void {
  panelListeners.add(cb)
  return () => { panelListeners.delete(cb) }
}
function getPanelSnapshot(): PanelState {
  return panel
}
/** 读取当前面板状态（供非 React 环境/持久化使用） */
export function getPanel(): PanelState {
  return panel
}
/** 设置面板状态（保留未指定字段） */
export function setPanel(next: Partial<PanelState>): void {
  panel = { ...panel, ...next }
  notifyPanel()
}
/** 自动弹出任务中心（展开面板 + 切到「任务中心」tab） */
export function openTaskCenter() {
  setPanel({ expanded: true, activeTab: 'tasks' })
}
/** 自动弹出素材库（展开面板 + 切到「素材」tab），供节点「发送到素材库」后联动 */
export function openAssetLibrary() {
  setPanel({ expanded: true, activeTab: 'assets' })
}
/** 切换面板钉住状态（钉住后点击面板外部不再自动收起） */
export function togglePin() {
  setPanel({ pinned: !panel.pinned })
}
/** 订阅面板状态（LeftPanel 使用） */
export function usePanel() {
  return useSyncExternalStore(panelSubscribe, getPanelSnapshot)
}

// 节点生成时上报任务（生成中 → 完成/失败）。返回更新函数。
export function reportGenerate(
  nodeId: string,
  type: string,
  prompt?: string,
  meta: { modelName?: string; channelName?: string } = {}
): TaskController {
  // 对齐官方：提交生成任务时自动弹出任务中心
  openTaskCenter()
  // 结束同 nodeId 之前未完成的任务
  const old = tasks.find((t) => t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending'))
  tasks = tasks.filter((t) => t !== old)
  const task: Task = {
    id: genId(), nodeId, type, prompt,
    modelName: meta.modelName || '', channelName: meta.channelName || '',
    status: 'running', progress: 0, errorMsg: '', resultUrl: '', stageLabel: '',
    createdAt: Date.now()
  }
  tasks = [task, ...tasks]
  notify()
  persist(task) // 后端持久化
  // P4 进度落库节流：progress 高频（流式/轮询/拖拽）触发，防抖合并成最终态一次落库。
  // write 是「读当前内存任务」的 thunk——flush 时若任务已被删除则跳过（避免误重建）。
  // 创建(done/fail) 保持即时落库，仅中间进度被合并；done/fail 先 cancel 防晚到的进度覆盖终态。
  const progressPersist = createDebouncedPersist(() => {
    const cur = tasks.find((t) => t.id === task.id)
    if (cur) persist(cur)
  }, 200)
  return {
    // 前端自造任务 id（贯穿链路主键，P0-A 请求级上下文）：useNodeGeneration/scriptBox 由 run ctx 透传给 generateImage opts，
    // 经 payload.taskId 带给 localTool/网关（不再经全局 currentTaskId）。
    taskId: task.id,
    // 更新进度（可带阶段文案，如「已转发到生成网关…」，供任务中心展示当前进行到哪一步）
    progress: (p: number, stage?: string) => {
      const stageLabel = typeof stage === 'string' && stage ? stage : task.stageLabel || ''
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: p, stageLabel } : t))
      notify()
      progressPersist.schedule() // 合并高频进度落库（窗口内只写最终态）
    },
    // 标记完成（resultUrl 应为已持久 /files/ URL；调用方先落盘再 done，见 P0-C 单向落盘契约）
    done: (resultUrl: string) => {
      // 防御：resultUrl 必须是字符串（历史 bug：上游偶发返回对象/undefined，导致 .startsWith 崩）
      const safeUrl = typeof resultUrl === 'string' ? resultUrl : ''
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100, resultUrl: safeUrl } : t))
      notify()
      progressPersist.cancel() // 取消未落的进度写，避免晚于 completed 覆盖终态
      persist({ ...task, status: 'completed', progress: 100, resultUrl: safeUrl })
      // 【画布同步】任务完成广播（统一入口 publishTaskCompleted，经 eventBus，解耦 window）：
      // 节点监听 agent:task-completed 回写结果，刷新场景靠任务中心的持久 resultUrl 恢复节点显示
      //（落盘由调用方完成，done 不再负责；空 resultUrl 的文本类任务不广播）。
      publishTaskCompleted({ taskId: task.id, nodeId: task.nodeId, resultUrl: safeUrl, type: task.type, status: 'completed' })
    },
    // 标记失败
    fail: (errorMsg?: string) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'failed', errorMsg: errorMsg || '生成失败' } : t))
      notify()
      progressPersist.cancel() // 同 done：取消未落的进度写
      persist({ ...task, status: 'failed', errorMsg: errorMsg || '生成失败' })
    }
  }
}

/**
 * 通用任务字段更新：按 id 合并 patch，同步内存 + 后端落库。
 * 用途：异步任务恢复轮询（见 pollTask.js）拿到新状态/结果后回写任务记录。
 * 【取舍】不新建 setter，统一走这里，避免散落多处改 tasks 的写法。
 */
export function patchTask(id: string, patch: Partial<Task>): void {
  if (!id || !patch) return
  let changed = false
  tasks = tasks.map((t) => {
    if (t.id === id) { changed = true; return { ...t, ...patch } }
    return t
  })
  if (changed) {
    notify()
    const cur = tasks.find((t) => t.id === id)
    if (cur) persist(cur)
  }
}

/**
 * 异步任务（生图/视频）提交后回填「可轮询查询的网关 task_id」。
 * @param {string} taskId 前端自造任务 id（taskStore 主键）
 * @param {string} pollTaskId 网关返回的 task_id（= task_<thread_id>），用于 /api/v1/gateway/task 查询
 * 【取舍】只对异步任务写它；文本/生图 sync 同步阻塞无 task_id，不写（写了也查不了）。
 */
export function setTaskPollId(taskId: string, pollTaskId: string): void {
  if (!taskId || !pollTaskId) return
  patchTask(taskId, { pollTaskId })
}

export function removeTask(id: string): void {
  tasks = tasks.filter((t) => t.id !== id)
  notify()
  deleteTask(id).catch(() => {}) // 后端删除
}

/**
 * 【兄弟声明 · 2026-08-30】retryRegistry 是「按 nodeId 的键控回调注册表」（registerTaskRetry /
 * unregisterTaskRetry / isNodeRegistered），与 toolRegistry.js 的数组 push 注册表同为「运行时注册 + 查询」
 * 形态——兄弟。语义是「注册 + 按 key 查询」（canvasPlanExecutor 靠 isNodeRegistered 同步轮询等注册完成），
 * 与 eventBus 广播不同（非事件通道、不走 EVENTS 登记）。禁止再开第三种注册形态。
 */
// ── 「再来一次/刷新」真正触发节点重新生成 ──
/**
 * 节点重生成回调（节点 registerTaskRetry 注册）。
 * 返回值跨代不统一：旧版同步返回 boolean、新版 start 返回 promise，故声明为 unknown，
 * 由 runNodeGenerationNow 在调用处做 thenable 判定（P2 兼容逻辑，勿简化成统一 Promise）。
 */
export type TaskRetryFn = () => unknown

const retryRegistry = new Map<string, TaskRetryFn>()

export function registerTaskRetry(nodeId: string, fn: TaskRetryFn): void {
  if (nodeId) retryRegistry.set(nodeId, fn)
}
export function unregisterTaskRetry(nodeId: string): void {
  if (nodeId) retryRegistry.delete(nodeId)
}

/**
 * 重试任务：触发对应节点的重新生成（若节点已注册回调）。
 * 返回是否成功触发（true=已触发，false=找不到节点回调）。
 */
export function retryTask(id: string): boolean {
  const t = tasks.find((x) => x.id === id)
  const fn = t ? retryRegistry.get(t.nodeId) : undefined
  if (fn) {
    try { fn() } catch (e) { logger.error('gen', 'retry-trigger-fail', { nodeId: t?.nodeId, error: e?.message }) }
    return true
  }
  logger.warn('gen', 'retry-callback-missing', { taskId: id, nodeId: t?.nodeId })
  return false
}

/**
 * 检查某节点是否已注册生成契约（供多步执行器在 addNodes 后等待节点渲染 + effect 注册）。
 * 场景：执行器用 ctx.addNodes 直接建节点，React 异步渲染后 PromptNode 才在 useNodeGeneration
 * effect 里 registerTaskRetry。执行器需轮询本函数确认注册完成，再 runNodeGeneration，否则
 * runNodeGeneration 会因找不到回调返回 false（见 canvasPlanExecutor.ts）。
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isNodeRegistered(nodeId: string): boolean {
  return !!nodeId && retryRegistry.has(nodeId)
}

/* ── 生图并发上限（限制同时真正在跑的生成数）──
 * 无论 AI 一次批量生成多少个节点/任务（execute_plan 可能规划 13 张），
 * 同一时刻最多只有 MAX_CONCURRENT_GEN 个会真正触发（点开始）。
 * 超出上限的第 N 个【不自动触发、不排队】——直接跳过，让节点保持「待生成」，
 * 由用户手动点击该节点发起。避免设计「排队中」按钮，也避免一次打爆上游。
 */
const MAX_CONCURRENT_GEN = GEN_MAX_CONCURRENT
let genActive = 0

// 【P1-E · 跨发起方并发锁】单节点互斥。
// 任何发起方（Agent runNodeGeneration / 用户手动 start / 「再来一次」retryTask）最终都汇聚到
// useNodeGeneration.start()。start 进入时经本 Map 占位、finally 释放；同节点已有进行中 →
// claim 返回 { ok:false, inFlight:true }（明确"进行中"，不静默、不并发生成）。
// 与 genActive（全局并发数）分层：genActive 先占全局任务槽，本 Map 管单节点互斥，两层不冲突。
const nodeRunning = new Map<string, boolean>() // nodeId -> true（仅作互斥位，不存 promise）
/** 占单节点互斥锁的结果：ok=true 取得；ok=false + inFlight=true 表示同节点生成中 */
export interface NodeRunClaim {
  ok: boolean
  inFlight?: boolean
}
/** 占单节点互斥锁。返回 { ok:true } 取得；或 { ok:false, inFlight:true } 同节点生成中。 */
export function claimNodeRun(nodeId: string): NodeRunClaim {
  if (!nodeId) return { ok: true }
  if (nodeRunning.has(nodeId)) return { ok: false, inFlight: true }
  nodeRunning.set(nodeId, true)
  return { ok: true }
}
/** 释放单节点互斥锁（start 的 finally 调用，务必保证每个 claim 后都 release）。 */
export function releaseNodeRun(nodeId: string): void {
  if (nodeId) nodeRunning.delete(nodeId)
}

/**
 * 按 nodeId 直接触发节点生成（供 Agent generate_node / 测试 / 脚本调用）。
 * 复用 useNodeGeneration 注册到 retryRegistry 的回调（即该节点的 start）。
 *
 * 【生图并发上限】本函数限制同时真正在跑的生成数：
 *  - 当前活跃 < MAX_CONCURRENT_GEN(6) → 占槽、真正触发、完成后释放；
 *  - 当前活跃已到上限 → 直接返回 false（= 未触发），节点保持待生成，由用户手动点。
 *    不新增状态/字段，调用方按「未触发」处理（executePlan 标 ready，不报失败）。
 *
 * 【异步执行器地基】透传 start() 的 promise 结果：
 *  - 节点用新版 useNodeGeneration（start 返回 { ok, resultUrl }）→ 本函数返回该 promise，
 *    调用方可 `await runNodeGeneration(id)` 拿到已落盘的 resultUrl（供前序依赖/多图编排）。
 *  - 旧版回调（返回 true/false）→ 透传原返回值，向后兼容。
 *
 * @param {string} nodeId
 * @returns {Promise<false | true | {ok:boolean, resultUrl?:string, error?:string}>}
 */
export async function runNodeGeneration(
  nodeId: string
): Promise<boolean | NodeGenerationRunResult> {
  if (!nodeId) return false
  // 并发上限：已满则返回 false（未触发），节点保持待生成，用户手动点
  if (genActive >= MAX_CONCURRENT_GEN) {
    logger.warn('gen', 'concurrency-limit-skip', { nodeId, limit: MAX_CONCURRENT_GEN })
    return false
  }
  genActive++
  try {
    return await runNodeGenerationNow(nodeId)
  } finally {
    genActive = Math.max(0, genActive - 1)
  }
}

/** runNodeGeneration 的结果：触发成功返回 ok:true（含已落盘 resultUrl）；失败返回 ok:false + error */
export interface NodeGenerationRunResult {
  ok: boolean
  resultUrl?: string
  error?: string
}

async function runNodeGenerationNow(nodeId: string): Promise<boolean | NodeGenerationRunResult> {
  const fn = retryRegistry.get(nodeId)
  if (fn) {
    try {
      // thenable 判定（兼容旧版同步返回 boolean / 新版返回 promise），行为与原逻辑逐字一致
      const p = fn()
      const thenable = p && typeof (p as PromiseLike<unknown>).then === 'function'
        ? (p as Promise<boolean | NodeGenerationRunResult>)
        : null
      return thenable ? await thenable : true
    } catch (e) {
      logger.error('gen', 'run-trigger-fail', { nodeId, error: e?.message })
      return { ok: false, error: e?.message || '触发失败' }
    }
  }
  logger.warn('gen', 'run-callback-missing', { nodeId })
  return false
}

/**
 * 按 nodeId 等待该节点最近一次生成任务完成（done/fail 时 resolve）。
 *
 * 用途：Agent 多步编排 / 测试 / 脚本在需要「生成完再继续」时调用。
 * 注意：Agent 的 SSE 工具循环是同步逐轮的，本函数按需等待，不会阻塞主循环；
 *      若未来 Agent 循环支持真正的异步编排，可直接 awaitTask 拿到最终 resultUrl。
 *
 * @param {string} nodeId 节点 id
 * @param {number} [timeout] 超时 ms，默认 60s
 * @returns {Promise<{status:'completed'|'failed'|'timeout', resultUrl:string, errorMsg:string}>}
 */
/** awaitTask 的等待结果：completed / failed / timeout 三态 */
export interface AwaitTaskResult {
  status: 'completed' | 'failed' | 'timeout'
  resultUrl: string
  errorMsg: string
}

export function awaitTask(nodeId: string, timeout = 60000): Promise<AwaitTaskResult> {
  return new Promise((resolve) => {
    let unsub: (() => void) | null = null
    let done = false
    const finish = (r: AwaitTaskResult) => {
      if (done) return
      done = true
      if (unsub) unsub()
      resolve(r)
    }
    const startedAt = Date.now()
    const check = () => {
      const t = tasks.find((x) => x.nodeId === nodeId)
      if (t && (t.status === 'completed' || t.status === 'failed')) {
        finish({ status: t.status, resultUrl: t.resultUrl || '', errorMsg: t.errorMsg || '' })
        return
      }
      if (Date.now() - startedAt > timeout) {
        finish({ status: 'timeout', resultUrl: '', errorMsg: '等待生成超时' })
      }
    }
    unsub = subscribe(check)
    check()
  })
}

/* ──────────────────────────────────────────────────────────────
 * 轮询调度注册表（S2 · ensurePolling）—— 消双轮询的地基（纯新增，暂不接调用方）
 *
 * 【为什么存在】image/video 异步任务有两个轮询源头会查同一 taskId：
 *   ① in-flight（当前页 proxyGenerate while，实时进度，生命周期=页面）
 *   ② 恢复（刷新后 pollTask，捞回结果，生命周期=数据/localTool）
 * 二者触发时机/生命周期不同不能删一套，但同一时刻必须只有一个在管——
 * 本注册表保证"一个 taskId 只有一个 poller"：in-flight 先注册占位；
 * 刷新后注册表(运行时态)清空，启动扫描对未注册任务重新注册恢复 poller。
 *
 * 【职责】只做"调度 + 单轮驱动 + 终态收敛"，不掺 provider/传输知识。
 *  单轮"怎么查"由调用方经 register 回调提供(proxyGenerate 走 /api/proxy、
 *  pollTask 走 gateway/task 各自保留)；taskStore 不统一传输、不硬编码超时。
 *
 * 【S2-a 状态】本段只落地注册表骨架与 ensurePolling/stopPolling/isPolling，
 *  不接任何调用方(proxyGenerate/pollTask 的接入在 S2-c)，故当前无生产调用。
 *  ────────────────────────────────────────────────────────────── */

/** 轮询句柄：注册后持有，可 stop 中止。 */
export interface PollerHandle {
  /** 句柄对应 taskId */
  taskId: string
  /** 中止轮询：清定时器 + 移除注册。终态收敛 / 取消 / 超时时调用。 */
  stop: () => void
}

/** ensurePolling 入参 */
export interface EnsurePollingOptions {
  /**
   * 单轮回调：查一次任务状态，到终态(completed/failed)返回 true 停止；未到返回 false 继续。
   * 由 ensurePolling 定时驱动（每 pollIntervalMs 调一次）。**occupyOnly 时忽略**。
   */
  register: (taskId: string) => Promise<boolean>
  /** 单轮间隔 ms（调用方按类型传：image GEN_POLL_INTERVAL / video VIDEO_POLL_INTERVAL） */
  pollIntervalMs?: number
  /** 总超时 ms（到点强停，防止轮询无限挂起，铁律：异步必须带总超时） */
  timeoutMs?: number
  /** 可选取消信号：abort 时 stop */
  signal?: AbortSignal
  /**
   * 纯占位模式（in-flight 自驱动轮询用）：只登记"该 taskId 已被接管"的标记，
   * 不让 ensurePolling 起定时器/驱动 register（in-flight 自己有 while 循环驱动）。
   * 目的：让恢复扫描看到 isPolling(taskId) 为真 → 不对同一 taskId 重复起恢复 poller。
   * 调用方自己负责在轮询结束/取消时 stopPolling(taskId) 释放占位。
   */
  occupyOnly?: boolean
}

/** 注册表条目内部态 */
interface PollerEntry {
  taskId: string
  stop: () => void
  timer: ReturnType<typeof setInterval> | null
  stopped: boolean
}

// taskId -> 轮询条目。一个 taskId 只可能有一个 entry（ensurePolling 保证）。
const pollers = new Map<string, PollerEntry>()

const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_TIMEOUT_MS = 300_000

/**
 * 唯一轮询入口：为 taskId 注册一个轮询器，保证同一 taskId 只有一个 poller。
 * - taskId 已注册 → 返回已有句柄，不起第二个（双轮询在构造上不可能，无需去重判断）。
 * - 未注册 → 注册并立即启动首轮，随后按 pollIntervalMs 定时驱动 register 单轮回调，
 *   直到 register 返回 true(终态)/超时/stop 为止。
 * @param {string} taskId 前端自造任务 id（taskStore 主键，非网关 task_id）
 * @param {EnsurePollingOptions} opts register 为必填单轮回调
 * @returns {PollerHandle}
 */
export function ensurePolling(taskId: string, opts: EnsurePollingOptions): PollerHandle {
  const existing = pollers.get(taskId)
  if (existing) return { taskId: existing.taskId, stop: existing.stop } // 已有 poller → 复用，杜绝双重轮询

  const intervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()
  let timer: ReturnType<typeof setInterval> | null = null

  // 先造 entry 再赋值 stop/timer（runOnce/stop 引用 entry，需先有可闭包引用对象）
  const entry: PollerEntry = { taskId, stop: () => {}, timer: null, stopped: false }

  // 单次驱动：跑一轮 register，到终态/超时/中止则收敛清理
  const runOnce = async () => {
    if (entry.stopped) return
    // 总超时：到点强停，防无限挂起
    if (Date.now() - startedAt > timeoutMs) {
      logger.warn('task', 'poll-timeout-stop', { taskId, elapsedMs: Date.now() - startedAt })
      entry.stop()
      return
    }
    try {
      const done = await opts.register(taskId)
      if (done || entry.stopped) entry.stop()
    } catch (e) {
      // 单轮异常(网络抖动等)：不误判失败，下轮再试；连续异常仍受总超时约束
      logger.warn('task', 'poll-round-error', { taskId, error: e?.message })
    }
  }

  // stop 里清理 signal 监听：避免正常终态 stop 后，signal 上仍挂着该 poller 的 abort 监听
  const onAbort = () => stop()
  const stop = () => {
    if (entry.stopped) return
    entry.stopped = true
    if (timer) { clearInterval(timer); timer = null }
    pollers.delete(taskId) // 释放注册，stop 后同 taskId 可被重新 ensurePolling
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort)
    logger.debug('任务', '[轮询] stop', { taskId }, { module: 'image' })
  }
  entry.stop = stop

  // 先注册（occupyOnly 与驱动模式都要在注册表占位，保证恢复扫描能 isPolling 命中）
  pollers.set(taskId, entry)

  if (opts.occupyOnly) {
    // 【纯占位】in-flight 自驱动轮询用：只登记"该 taskId 已被接管"，不起定时器/不驱动 register。
    // register 单轮回调不会被调用（in-flight 自己有 while 驱动）。调用方结束/取消时自行 stopPolling。
    if (opts.signal) {
      if (opts.signal.aborted) stop()
      else opts.signal.addEventListener('abort', onAbort, { once: true })
    }
    return { taskId: entry.taskId, stop: entry.stop }
  }

  // 立即跑首轮（异步），再挂定时器驱动后续轮
  void runOnce()
  timer = setInterval(() => { void runOnce() }, intervalMs)
  entry.timer = timer

  // 外部取消信号：abort → stop
  if (opts.signal) {
    if (opts.signal.aborted) {
      stop()
    } else {
      opts.signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  return { taskId: entry.taskId, stop: entry.stop }
}

/** 显式中止某 taskId 的轮询（终态收敛/取消时调用）。 */
export function stopPolling(taskId: string): void {
  const entry = pollers.get(taskId)
  if (entry) entry.stop()
}

/** 诊断/测试：该 taskId 当前是否已被注册轮询。 */
export function isPolling(taskId: string): boolean {
  return pollers.has(taskId)
}

/** 诊断：当前注册的轮询任务数（防泄漏检查用）。 */
export function pollingCount(): number {
  return pollers.size
}

// 清理：按条件批量删除（同步后端）
export function clearTasksBy(predicate: (t: Task) => boolean): void {
  const removed = tasks.filter((t) => predicate(t))
  if (removed.length > 0) {
    tasks = tasks.filter((t) => !predicate(t))
    notify()
    batchDeleteTasks(removed.map((t) => t.id)).catch(() => {}) // fire-and-forget，后端删除失败不影响前端
  }
}
export function clearAllTasks(): void {
  if (tasks.length > 0) {
    tasks = []
    notify()
    clearAllTasksApi().catch(() => {}) // fire-and-forget，后端清空失败下次再清
  }
}

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
