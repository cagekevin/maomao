/**
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
import { logger } from './logger.js'
import { fetchTasks, saveTask, deleteTask, batchDeleteTasks, clearAllTasksApi } from './tasksApi.js'
import { saveResultToTasks } from './filesApi.js'
import { publish } from './eventBus.js'
import { generateId } from './idGen.js'
import { GEN_MAX_CONCURRENT } from './config.js'

let tasks = []
const listeners = new Set()

// ── 当前任务贯穿 ID（打通前端 task_id → 网关 thread_id 的关联查询）──
// 前端自造 task_id 是任务主键，但它从不传给 localTool/网关，导致和 Lovart thread_id 断链。
// 这里用模块级变量暂存「当前正在生成的前端 task_id」，imageApi/videoApi 的 proxyRequest
// 读取它并加 X-Task-Id header 贯穿到链路，localTool/网关据此把前端 task_id ↔ thread_id 关联落库。
let currentTaskId = ''
export function setCurrentTaskId(id) { currentTaskId = typeof id === 'string' ? id : '' }
export function getCurrentTaskId() { return currentTaskId }

// ── 启动时从后端加载历史任务 ──
let loaded = false
export function initTasks() {
  if (loaded) return
  loaded = true
  fetchTasks({ pageSize: 500 })
    .then((data) => {
      const items = Array.isArray(data?.items) ? data.items : []
      if (items.length > 0) {
        tasks = items
        notify()
      }
    })
    .catch((e) => logger.warn('taskStore', '加载历史任务失败（localTool 未连？）', e?.message))
}

// 后端保存（fire-and-forget，失败仅降级为内存态，前端流程不受影响）
function persist(task) {
  saveTask(task).catch((e) => logger.warn('task', 'persist-fail', { taskId: task?.id, error: e?.message }))
}

// 状态 → 圆点/文字 颜色（对齐官方 An）
export function statusDotClass(status) {
  if (status === 'completed') return 'bg-emerald-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-blue-400'
}

// 状态 → 文案（对齐官方 On）
export function statusLabel(status, progress = 0) {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'pending') return '生成中'
  if (status === 'running') return progress > 0 ? `${Math.round(progress)}%` : '生成中'
  return status
}

// 类型 → 文案（对齐官方 Tn 映射 + 补充）
export function typeLabel(type) {
  return {
    text: '文本',
    image: '生图',
    video: '视频',
    sd2Video: 'SD2视频',
    discountVideo: '特惠视频',
    custom: '万能',
    rhWebapp: 'AI应用'
  }[type] || type || '任务'
}

function genId() {
  return generateId('task')
}

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// 展示用快照（供 useTasks / 任务中心 UI）：过滤掉 nodeId 为空的无效任务。
// 这类任务是网关占位垃圾行（persistThreadId 旧逻辑为网关 task_id 单独建的空行），
// 没有归属节点，不应在任务中心展示。用快照缓存保证引用稳定，避免 useSyncExternalStore 无限重渲染。
// 注意：轮询用的 getTasks() 仍返回完整原始数组（含无 nodeId 的行），不影响异步任务恢复逻辑。
let snapshotCache = null
function getSnapshot() {
  if (!snapshotCache || snapshotCache.source !== tasks) {
    snapshotCache = { source: tasks, list: tasks.filter((t) => t.nodeId) }
  }
  return snapshotCache.list
}

/** 非 React 环境读取当前任务列表（供轮询/脚本等模块级使用）。 */
export function getTasks() {
  return tasks
}

// ── 左侧面板全局状态（对齐官方 setShowTaskList：生成任务时自动弹出任务中心）──
// 官方 H_.jsx 在每次提交生成任务时调用 H?.(true)（即 setShowTaskList(true)）弹出任务中心。
// 我们统一契约里所有生成节点都走 reportGenerate，故在这里触发 openTaskCenter()，覆盖面最全
// （节点生成 / Agent generate_node / 任务中心重试 提交任务都会自动弹面板切到任务中心）。
let panel = { expanded: false, activeTab: 'tasks', pinned: false }
const panelListeners = new Set()
function notifyPanel() {
  panelListeners.forEach((l) => l())
}
function panelSubscribe(cb) {
  panelListeners.add(cb)
  return () => panelListeners.delete(cb)
}
function getPanelSnapshot() {
  return panel
}
/** 读取当前面板状态（供非 React 环境/持久化使用） */
export function getPanel() {
  return panel
}
/** 设置面板状态（保留未指定字段） */
export function setPanel(next) {
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
export function reportGenerate(nodeId, type, prompt, meta = {}) {
  // 对齐官方：提交生成任务时自动弹出任务中心
  openTaskCenter()
  // 结束同 nodeId 之前未完成的任务
  const old = tasks.find((t) => t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending'))
  tasks = tasks.filter((t) => t !== old)
  const task = {
    id: genId(), nodeId, type, prompt,
    modelName: meta.modelName || '', channelName: meta.channelName || '',
    status: 'running', progress: 0, errorMsg: '', resultUrl: '', stageLabel: '',
    createdAt: Date.now()
  }
  tasks = [task, ...tasks]
  notify()
  persist(task) // 后端持久化
  return {
    // 前端自造任务 id（贯穿链路主键），供 useNodeGeneration 传给 proxyRequest 加 X-Task-Id header
    taskId: task.id,
    // 更新进度（可带阶段文案，如「已转发到生成网关…」，供任务中心展示当前进行到哪一步）
    progress: (p, stage) => {
      const stageLabel = typeof stage === 'string' && stage ? stage : task.stageLabel || ''
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: p, stageLabel } : t))
      notify()
      persist({ ...task, status: 'running', progress: p, stageLabel }) // 同步后端进度
    },
    // 标记完成（可带结果缩略图）
    done: (resultUrl) => {
      // 防御：resultUrl 必须是字符串（历史 bug：上游偶发返回对象/undefined，导致 .startsWith 崩）
      const safeUrl = typeof resultUrl === 'string' ? resultUrl : ''
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100, resultUrl: safeUrl } : t))
      notify()
      persist({ ...task, status: 'completed', progress: 100, resultUrl: safeUrl })
      // 生成结果落盘 tasks 目录（对齐官方 Ce.uploadFile），使「生成」面板能收录。
      // 异步执行，失败不影响主流程（节点显示/任务中心仍用原始 url）。
      if (safeUrl && !safeUrl.startsWith('blob:')) {
        saveResultToTasks(resultUrl, task.type).then((persistedUrl) => {
          if (persistedUrl) {
            tasks = tasks.map((t) => (t.id === task.id ? { ...t, resultUrl: persistedUrl } : t))
            notify()
            persist({ ...task, status: 'completed', progress: 100, resultUrl: persistedUrl })
            // 【画布同步】落盘成功 → 把持久化 URL 广播给对应节点（PromptNode 等监听后写回 data.imageUrl）。
            // 否则节点 data.imageUrl 只存「上游原始 URL」，刷新后若该 URL 失效/是临时地址 → 画布丢图，
            // 而任务中心读的是已落盘的 /files/tasks/ URL → 任务中心有图、画布没图的错位。
            // 任务完成广播（经 eventBus，解耦 window）：节点监听 agent:task-completed 回写结果
            publish('agent:task-completed', { taskId: task.id, nodeId: task.nodeId, resultUrl: persistedUrl, type: task.type, status: 'completed' })
          }
        })
      }
    },
    // 标记失败
    fail: (errorMsg) => {
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, status: 'failed', errorMsg: errorMsg || '生成失败' } : t))
      notify()
      persist({ ...task, status: 'failed', errorMsg: errorMsg || '生成失败' })
    }
  }
}

/**
 * 通用任务字段更新：按 id 合并 patch，同步内存 + 后端落库。
 * 用途：异步任务恢复轮询（见 pollTask.js）拿到新状态/结果后回写任务记录。
 * 【取舍】不新建 setter，统一走这里，避免散落多处改 tasks 的写法。
 */
export function patchTask(id, patch) {
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
export function setTaskPollId(taskId, pollTaskId) {
  if (!taskId || !pollTaskId) return
  patchTask(taskId, { pollTaskId })
}

export function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id)
  notify()
  deleteTask(id).catch(() => {}) // 后端删除
}

// ── 「再来一次/刷新」真正触发节点重新生成 ──
const retryRegistry = new Map()

export function registerTaskRetry(nodeId, fn) {
  if (nodeId) retryRegistry.set(nodeId, fn)
}
export function unregisterTaskRetry(nodeId) {
  if (nodeId) retryRegistry.delete(nodeId)
}

/**
 * 重试任务：触发对应节点的重新生成（若节点已注册回调）。
 * 返回是否成功触发（true=已触发，false=找不到节点回调）。
 */
export function retryTask(id) {
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
 * runNodeGeneration 会因找不到回调返回 false（见 canvasPlanExecutor.js）。
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isNodeRegistered(nodeId) {
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
export async function runNodeGeneration(nodeId) {
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

async function runNodeGenerationNow(nodeId) {
  const fn = retryRegistry.get(nodeId)
  if (fn) {
    try {
      const p = fn()
      return p && typeof p.then === 'function' ? await p : true
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
export function awaitTask(nodeId, timeout = 60000) {
  return new Promise((resolve) => {
    let unsub = null
    let done = false
    const finish = (r) => {
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

// 清理：按条件批量删除（同步后端）
export function clearTasksBy(predicate) {
  const removed = tasks.filter((t) => predicate(t))
  if (removed.length > 0) {
    tasks = tasks.filter((t) => !predicate(t))
    notify()
    batchDeleteTasks(removed.map((t) => t.id)).catch(() => {}) // fire-and-forget，后端删除失败不影响前端
  }
}
export function clearAllTasks() {
  if (tasks.length > 0) {
    tasks = []
    notify()
    clearAllTasksApi().catch(() => {}) // fire-and-forget，后端清空失败下次再清
  }
}

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
