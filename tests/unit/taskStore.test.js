import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 隔离 taskStore 的 IO 依赖（localToolApi/filesApi 走 fetch → localTool），
// 只验证纯逻辑：状态映射、类型映射、面板状态、任务清理、重试注册、进度落库节流。
vi.mock('../../src/components/base/localToolApi.ts', () => ({
  fetchTasks: vi.fn(async () => ({ items: [] })),
  saveTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  batchDeleteTasks: vi.fn(async () => {}),
  clearAllTasksApi: vi.fn(async () => {}),
}))
import { saveTask } from '../../src/components/base/localToolApi.ts'
import { publish } from '../../src/components/base/eventBus.ts'

const {
  statusLabel,
  getPanel,
  setPanel,
  openTaskCenter,
  openAssetLibrary,
  togglePin,
  clearTasksBy,
  clearAllTasks,
  registerTaskRetry,
  unregisterTaskRetry,
  retryTask,
  isNodeRegistered,
  reportGenerate,
  getTasks,
} = await import('../../src/components/base/taskStore.js')

beforeEach(() => {
  // 任务清理依赖内部 tasks 数组，逐测试前清空（clearAllTasks 会触发事件但不影响断言）
  clearAllTasks()
})

describe('taskStore §2.6 状态映射', () => {
  it('statusLabel：完成/失败/生成中/带进度百分比', () => {
    expect(statusLabel('completed')).toBe('已完成')
    expect(statusLabel('failed')).toBe('失败')
    expect(statusLabel('pending')).toBe('生成中')
    expect(statusLabel('running')).toBe('生成中')
    expect(statusLabel('running', 42)).toBe('42%')
    expect(statusLabel('unknown')).toBe('unknown')
  })

})

describe('taskStore §2.6 面板状态', () => {
  it('openTaskCenter 展开面板并切到任务中心 tab', () => {
    setPanel({ expanded: false, activeTab: 'generated' })
    openTaskCenter()
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'tasks', pinned: false })
  })

  it('setPanel 保留未指定字段', () => {
    setPanel({ expanded: true })
    expect(getPanel().activeTab).toBe('tasks')
    expect(getPanel().expanded).toBe(true)
  })

  it('togglePin 切换钉住状态，且 openTaskCenter/openAssetLibrary 保留 pinned', () => {
    setPanel({ expanded: false, activeTab: 'generated', pinned: false })
    togglePin()
    expect(getPanel().pinned).toBe(true)
    // 自动弹出任务中心不应清除钉住态
    openTaskCenter()
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'tasks', pinned: true })
    // 自动弹出素材库同样保留钉住态
    setPanel({ activeTab: 'assets' })
    openAssetLibrary()
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'assets', pinned: true })
    togglePin()
    expect(getPanel().pinned).toBe(false)
  })
})

describe('taskStore §2.6 任务清理', () => {
  it('clearTasksBy 按条件删除任务', () => {
    reportGenerate('n1', 'image', 'p1')
    reportGenerate('n2', 'image', 'p2')
    clearTasksBy((t) => t.nodeId === 'n1')
    const remaining = getTasks()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].nodeId).toBe('n2')
  })

  it('clearAllTasks 清空全部任务', () => {
    reportGenerate('n1', 'image', 'p1')
    reportGenerate('n2', 'video', 'p2')
    clearAllTasks()
    const remaining = require('../../src/components/base/taskStore.js').getTasks()
    expect(remaining).toHaveLength(0)
  })
})

describe('taskStore §2.6 重试注册/触发', () => {
  it('registerTaskRetry → isNodeRegistered 为真', () => {
    registerTaskRetry('nodeX', () => {})
    expect(isNodeRegistered('nodeX')).toBe(true)
    expect(isNodeRegistered('nodeY')).toBe(false)
  })

  it('retryTask 触发已注册回调返回 true，未注册返回 false', () => {
    let called = 0
    registerTaskRetry('nodeX', () => { called++ })
    expect(retryTask('some-task-id')).toBe(false) // 任务不存在 → 找不到 nodeId
    expect(called).toBe(0)
    // 先建一个归属于 nodeX 的任务再重试
    reportGenerate('nodeX', 'image', 'p')
    const tasksNow = getTasks()
    const id = tasksNow[0].id
    expect(retryTask(id)).toBe(true)
    expect(called).toBe(1)
  })

  it('unregisterTaskRetry 注销后 isNodeRegistered 为假', () => {
    registerTaskRetry('nodeZ', () => {})
    expect(isNodeRegistered('nodeZ')).toBe(true)
    unregisterTaskRetry('nodeZ')
    expect(isNodeRegistered('nodeZ')).toBe(false)
  })
})

describe('taskStore §P4 进度落库节流', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('高频 progress 在防抖窗口内只落库 1 次（创建即时 + 进度合并为最终态）', () => {
    saveTask.mockClear()
    const handle = reportGenerate('n1', 'image', 'p1')
    expect(saveTask).toHaveBeenCalledTimes(1) // 创建即时
    handle.progress(10, '阶段A')
    handle.progress(40, '阶段B')
    handle.progress(70, '阶段C')
    expect(saveTask).toHaveBeenCalledTimes(1) // 窗口内未落
    vi.advanceTimersByTime(200)
    expect(saveTask).toHaveBeenCalledTimes(2) // 合并落 1 次，写最终态
    const last = saveTask.mock.calls.at(-1)[0]
    expect(last.id).toBe(handle.taskId)
    expect(last.progress).toBe(70)
    expect(last.stageLabel).toBe('阶段C')
  })

  it('done 取消未落进度写，即时落完成态且不被晚到的进度覆盖', () => {
    saveTask.mockClear()
    const handle = reportGenerate('n2', 'image', 'p2')
    saveTask.mockClear() // 只统计完成路径的落库
    handle.progress(30, '阶段')
    handle.done('/result.png')
    expect(saveTask).toHaveBeenCalledTimes(1)
    const last = saveTask.mock.calls.at(-1)[0]
    expect(last.status).toBe('completed')
    expect(last.progress).toBe(100)
    expect(last.resultUrl).toBe('/result.png')
    vi.advanceTimersByTime(400)
    expect(saveTask).toHaveBeenCalledTimes(1) // 无晚到的进度覆盖终态
  })

  it('fail 同 done：取消未落进度写，即时落失败态', () => {
    saveTask.mockClear()
    const handle = reportGenerate('n3', 'image', 'p3')
    saveTask.mockClear()
    handle.progress(50, '阶段')
    handle.fail('网络错误')
    expect(saveTask).toHaveBeenCalledTimes(1)
    const last = saveTask.mock.calls.at(-1)[0]
    expect(last.status).toBe('failed')
    expect(last.errorMsg).toBe('网络错误')
    vi.advanceTimersByTime(400)
    expect(saveTask).toHaveBeenCalledTimes(1)
  })
})

// ════════════════════════════════════════════════════════════════
// 素材 url 变更（改名 / 移动）→ 同步内存任务的 resultUrl（清单 #8）
//
// 后端已改写 tasks 表（rewriteUrlReferences），这里同步「当前页面内存」：
// 否则任务中心卡片（缩略图 / 下载 / 拖拽建节点）仍指旧路径 → 破图，刷新页面才恢复。
// 改写工具与 App.jsx 共用 imageUrl.js 的同一份，禁止各写一套。
// ════════════════════════════════════════════════════════════════
describe('taskStore · resource:renamed 同步 resultUrl', () => {
  it('改名后内存任务的 resultUrl 改写为新 url（原样态）', () => {
    const oldUrl = 'http://127.0.0.1:18080/files/migrated/a.png'
    const newUrl = 'http://127.0.0.1:18080/files/migrated/b.png'
    reportGenerate('n-rename-1', 'image', 'p').done(oldUrl)
    expect(getTasks()[0].resultUrl).toBe(oldUrl)

    publish('resource:renamed', { oldUrl, newUrl })
    expect(getTasks()[0].resultUrl).toBe(newUrl)
  })

  it('编码态引用同样改写（中文文件名场景，只替 raw 会漏）', () => {
    const oldRel = 'migrated/角色.png'
    const newRel = 'migrated/人物/角色.png'
    const stored = `http://127.0.0.1:18080/files/${encodeURI(oldRel)}`
    reportGenerate('n-rename-2', 'image', 'p').done(stored)

    publish('resource:renamed', {
      oldUrl: `http://127.0.0.1:18080/files/${oldRel}`,
      newUrl: `http://127.0.0.1:18080/files/${newRel}`,
    })
    expect(getTasks()[0].resultUrl).toBe(`http://127.0.0.1:18080/files/${encodeURI(newRel)}`)
  })

  it('无关事件不动内存（引用不变 → 不触发无谓重渲染）', () => {
    reportGenerate('n-rename-3', 'image', 'p').done('http://127.0.0.1:18080/files/other/x.png')
    const before = getTasks()
    publish('resource:renamed', {
      oldUrl: 'http://127.0.0.1:18080/files/migrated/a.png',
      newUrl: 'http://127.0.0.1:18080/files/migrated/b.png',
    })
    expect(getTasks()).toBe(before)
  })
})
