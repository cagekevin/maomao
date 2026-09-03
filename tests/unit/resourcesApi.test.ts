/**
 * resourcesApi 单元测试（阶段一·算法与逻辑层）
 * 覆盖：资源分页查询/重扫/删除/保存/重命名/打开目录，以及 URL→相对路径纯解析。
 * fetch 全部 mock。
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { API_BASE } from '../../src/components/base/core/config.ts'
import * as ra from '@/components/base/api/localToolApi.ts'

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  const res = { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
  // vi.fn() 的 mock.calls 会被推断为无参空元组（[]），导致 calls[0][0]/[1] 报 TS2493/TS18048；
  // 测试需按调用实参断言 URL 与 init，故标注为 any 保留完整调用记录访问。
  const fetchMock = vi.fn(async () => res) as unknown as ReturnType<typeof vi.fn>
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchResources', () => {
  it('按默认分页拼参数并解析结果', async () => {
    const data = { items: [{ id: '1' }], total: 1, page: 1, pageSize: 60, totalPages: 1 }
    const fetchMock = mockFetchOnce(data)
    const r = await ra.fetchResources()
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/resources?page=1&pageSize=60`)
    expect(r).toEqual(data)
  })

  it('folder/type 写入 filters JSON（folder 精确匹配当前层级，不含子孙目录）', async () => {
    const fetchMock = mockFetchOnce({ items: [] })
    await ra.fetchResources({ folder: 'tasks', type: 'image', page: 2, pageSize: 10 })
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('page=2&pageSize=10')
    const m = url.match(/filters=([^&]+)/)
    const filters = JSON.parse(decodeURIComponent(m[1]))
    expect(filters.folder).toBe('tasks')
    expect(filters.type).toBe('image')
  })

  it('HTTP 非 2xx 抛 HttpError，message 取业务文案', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 500 })
    await expect(ra.fetchResources()).rejects.toMatchObject({ name: 'HttpError', status: 500, message: 'x' })
  })
})

describe('rescanResources', () => {
  it('POST rescan 并返回 json', async () => {
    const fetchMock = mockFetchOnce({ data: { scanned: 3 } })
    const r = await ra.rescanResources()
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/resources/rescan`)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(r.data.scanned).toBe(3)
  })

  it('非 2xx 抛 HttpError', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 500 })
    await expect(ra.rescanResources()).rejects.toMatchObject({ name: 'HttpError', status: 500, message: 'x' })
  })
})

describe('deleteResource', () => {
  it('id 被 encodeURIComponent', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await ra.deleteResource('a/b c')
    expect(fetchMock.mock.calls[0][0]).toContain('delete?id=' + encodeURIComponent('a/b c'))
  })

  it('非 2xx 抛 HttpError', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 500 })
    await expect(ra.deleteResource('id1')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: 'x' })
  })
})

describe('saveResource', () => {
  it('POST JSON body', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    const res = await ra.saveResource({ id: '1', isFavorite: true })
    const [reqUrl, init] = fetchMock.mock.calls[0]
    expect(reqUrl).toBe(`${API_BASE}/api/resources/save`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ id: '1', isFavorite: true })
  })

  it('非 2xx 抛 HttpError', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 400 })
    await expect(ra.saveResource({ id: '1' })).rejects.toMatchObject({ name: 'HttpError', status: 400, message: 'x' })
  })
})

describe('renameResource', () => {
  it('id 与 name 都进 query 且被编码', async () => {
    const fetchMock = mockFetchOnce({ data: { ok: true, id: '1', url: 'u', name: '新名' } })
    const r = await ra.renameResource('1', '新名')
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('id=' + encodeURIComponent('1'))
    expect(url).toContain('name=' + encodeURIComponent('新名'))
    expect(r.data.name).toBe('新名')
  })

  it('失败时优先用后端 error 文案', async () => {
    mockFetchOnce({ error: '重名冲突' }, { ok: false, status: 409 })
    await expect(ra.renameResource('1', 'x')).rejects.toThrow(/重名冲突/)
  })
})

describe('openLocalFolder / openFileDir', () => {
  it('openLocalFolder 默认 subfolder=tasks', async () => {
    const fetchMock = mockFetchOnce({ path: '/tmp' })
    await ra.openLocalFolder()
    expect(fetchMock.mock.calls[0][0]).toContain('open?subfolder=tasks')
    await ra.openLocalFolder('gen')
    expect(fetchMock.mock.calls[1][0]).toContain('open?subfolder=gen')
  })

  it('openFileDir 空路径直接返回 undefined', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await ra.openFileDir('')
    expect(r).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('openFileDir 正常请求 open-dir', async () => {
    const fetchMock = mockFetchOnce({ path: '/d' })
    await ra.openFileDir('tasks/a.png')
    expect(fetchMock.mock.calls[0][0]).toContain('open-dir?filepath=' + encodeURIComponent('tasks/a.png'))
  })

  it('openLocalFolder 非 2xx 抛 HttpError', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 500 })
    await expect(ra.openLocalFolder('tasks')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: 'x' })
  })

  it('openFileDir 非 2xx 抛 HttpError', async () => {
    mockFetchOnce({ error: 'x' }, { ok: false, status: 500 })
    await expect(ra.openFileDir('tasks/a.png')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: 'x' })
  })
})

describe('relativePathFromUrl', () => {
  it('去掉 /files/ 前缀并解码', () => {
    expect(ra.relativePathFromUrl('http://127.0.0.1:18080/files/tasks/a%20b.png')).toBe('tasks/a b.png')
  })

  it('非 /files/ 前缀原样返回 pathname（含前导斜杠）', () => {
    expect(ra.relativePathFromUrl('http://127.0.0.1:18080/other/x.png')).toBe('/other/x.png')
  })

  it('非法 url 返回 null', () => {
    expect(ra.relativePathFromUrl('not a url')).toBeNull()
  })
})
