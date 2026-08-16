import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离 taskStore 的 IO 依赖（tasksApi/filesApi 走 fetch → localTool），
// 只验证纯逻辑：状态映射、类型映射、面板状态、任务清理、重试注册。
vi.mock('../../src/components/base/tasksApi.js', () => ({
  fetchTasks: vi.fn(async () => ({ items: [] })),
  saveTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  batchDeleteTasks: vi.fn(async () => {}),
  clearAllTasksApi: vi.fn(async () => {}),
}))
vi.mock('../../src/components/base/filesApi.js', () => ({
  saveResultToTasks: vi.fn(async () => null),
}))

const {
  statusDotClass,
  statusLabel,
  typeLabel,
  getPanel,
  setPanel,
  openTaskCenter,
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
  it('statusDotClass：completed→emerald / failed→red / 其余→blue', () => {
    expect(statusDotClass('completed')).toBe('bg-emerald-400')
    expect(statusDotClass('failed')).toBe('bg-red-400')
    expect(statusDotClass('running')).toBe('bg-blue-400')
    expect(statusDotClass('pending')).toBe('bg-blue-400')
  })

  it('statusLabel：完成/失败/生成中/带进度百分比', () => {
    expect(statusLabel('completed')).toBe('已完成')
    expect(statusLabel('failed')).toBe('失败')
    expect(statusLabel('pending')).toBe('生成中')
    expect(statusLabel('running')).toBe('生成中')
    expect(statusLabel('running', 42)).toBe('42%')
    expect(statusLabel('unknown')).toBe('unknown')
  })

  it('typeLabel：内置类型映射 + 未知回退', () => {
    expect(typeLabel('text')).toBe('文本')
    expect(typeLabel('image')).toBe('生图')
    expect(typeLabel('video')).toBe('视频')
    expect(typeLabel('discountVideo')).toBe('特惠视频')
    expect(typeLabel('custom')).toBe('万能')
    expect(typeLabel(null)).toBe('任务')
    expect(typeLabel('weird')).toBe('weird')
  })
})

describe('taskStore §2.6 面板状态', () => {
  it('openTaskCenter 展开面板并切到任务中心 tab', () => {
    setPanel({ expanded: false, activeTab: 'generated' })
    openTaskCenter()
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'tasks' })
  })

  it('setPanel 保留未指定字段', () => {
    setPanel({ expanded: true })
    expect(getPanel().activeTab).toBe('tasks')
    expect(getPanel().expanded).toBe(true)
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
