// @vitest-environment node
/**
 * tasksApi 单测（批 2，API 封装层）。
 * 覆盖：fetchTasks/saveTask/batchSaveTasks/deleteTask/batchDeleteTasks/clearAllTasksApi
 * 的成功路径与 HTTP 错误抛出。策略：node + vi.stubGlobal('fetch')。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 全局 fetch 已在 tests/setup.mjs 强制 mock 为 vi.fn()，此处取共享实例。
const fetchMock = globalThis.fetch

const api = await import('../../src/components/base/tasksApi.js')

function jsonResp(obj, ok = true, status = 200) {
  return { ok, status, json: async () => obj }
}

beforeEach(() => fetchMock.mockReset())
afterEach(() => vi.unstubAllGlobals())

describe('tasksApi — 成功路径', () => {
  it('fetchTasks 解析分页响应', async () => {
    fetchMock.mockResolvedValue(jsonResp({ items: [{ id: 't1' }], total: 1 }))
    const res = await api.fetchTasks({ keyword: '视频' })
    expect(res.items).toHaveLength(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tasks?')
    expect(fetchMock.mock.calls[0][0]).toContain('keyword=%E8%A7%86%E9%A2%91')
  })

  it('saveTask 发送 POST JSON', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }))
    const task = { task_id: 't1', prompt: 'x' }
    await api.saveTask(task)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(task)
  })

  it('batchSaveTasks 空数组直接返回 ok 不请求', async () => {
    const res = await api.batchSaveTasks([])
    expect(res).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deleteTask 带 encodeURIComponent 的 id', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }))
    await api.deleteTask('a/b')
    expect(fetchMock.mock.calls[0][0]).toContain('delete?id=a%2Fb')
  })

  it('batchDeleteTasks 空数组返回 deleted:0', async () => {
    const res = await api.batchDeleteTasks([])
    expect(res).toEqual({ deleted: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clearAllTasksApi 发送 POST', async () => {
    fetchMock.mockResolvedValue(jsonResp({ deleted: 3 }))
    const res = await api.clearAllTasksApi()
    expect(res.deleted).toBe(3)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tasks/clear')
  })
})

describe('tasksApi — 错误路径', () => {
  it('fetchTasks 非 2xx 抛带 HTTP 状态的错误', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500))
    await expect(api.fetchTasks()).rejects.toThrow('HTTP 500')
  })

  it('saveTask 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 400))
    await expect(api.saveTask({})).rejects.toThrow('saveTask failed: HTTP 400')
  })

  it('batchSaveTasks 非空数组但 2xx 失败抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500))
    await expect(api.batchSaveTasks([{ task_id: 'a' }])).rejects.toThrow('batchSaveTasks failed: HTTP 500')
  })

  it('deleteTask 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500))
    await expect(api.deleteTask('t1')).rejects.toThrow('deleteTask failed: HTTP 500')
  })

  it('batchDeleteTasks 非空 ids 但失败抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500))
    await expect(api.batchDeleteTasks(['a'])).rejects.toThrow('batchDeleteTasks failed: HTTP 500')
  })

  it('clearAllTasksApi 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500))
    await expect(api.clearAllTasksApi()).rejects.toThrow('clearTasks failed: HTTP 500')
  })
})
