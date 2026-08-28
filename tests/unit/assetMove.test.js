/**
 * assetsMove 单元测试（阶段三·算法与逻辑层）
 * 覆盖：moveFile 端点透传、canMoveAsset 边界、resolveMovePaths 相对路径推导。
 * fetch 全部 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { API_BASE } from '../../src/components/base/config.js'
import { moveFile, canMoveAsset, resolveMovePaths } from '../../src/components/base/localToolApi.js'

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  const res = { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
  const fetchMock = vi.fn(async () => res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('moveFile', () => {
  it('POST /api/files/move，body 传相对 uploadDir 的 src/dst，且不重试', async () => {
    const fetchMock = mockFetchOnce({ code: 0, data: { ok: true } })
    const r = await moveFile('migrated/a.png', 'migrated/主题/a.png')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/files/move`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ src: 'migrated/a.png', dst: 'migrated/主题/a.png' })
    expect(r).toEqual({ code: 0, data: { ok: true } })
  })

  it('非 2xx 抛 HttpError 且透传后端业务 message（不回退误报）', async () => {
    mockFetchOnce({ error: '目标文件已存在' }, { ok: false, status: 409 })
    await expect(moveFile('a.png', 'b/a.png')).rejects.toMatchObject({ name: 'HttpError', status: 409, message: '目标文件已存在' })
  })
})

describe('canMoveAsset', () => {
  it('local-tool + 非文件夹 → 可移动', () => {
    expect(canMoveAsset({ source: 'local-tool', type: 'image' })).toBe(true)
  })

  it('文件夹 → 不可移动', () => {
    expect(canMoveAsset({ source: 'local-tool', type: 'folder' })).toBe(false)
  })

  it('远程/收藏（非 local-tool）→ 不可移动', () => {
    expect(canMoveAsset({ source: 'remote', type: 'image' })).toBe(false)
    expect(canMoveAsset({ source: undefined, type: 'image' })).toBe(false)
  })
})

describe('resolveMovePaths', () => {
  it('子目录资源 → src=源folder/name，dst=目标/name，非同一目录', () => {
    const { src, dst, sameDir } = resolveMovePaths({ folder: 'migrated/人物', name: 'a.png' }, 'migrated/人物/主题A')
    expect(src).toBe('migrated/人物/a.png')
    expect(dst).toBe('migrated/人物/主题A/a.png')
    expect(sameDir).toBe(false)
  })

  it('目标与源同目录 → sameDir=true（dst 仍拼出，由调用方拦截）', () => {
    const { src, dst, sameDir } = resolveMovePaths({ folder: 'tasks', name: 'a.png' }, 'tasks')
    expect(sameDir).toBe(true)
    expect(src).toBe('tasks/a.png')
    expect(dst).toBe('tasks/a.png')
  })

  it('顶层（folder 为空）→ src=name，非同一目录', () => {
    const { src, sameDir } = resolveMovePaths({ folder: '', name: 'x.png' }, 'x')
    expect(src).toBe('x.png')
    expect(sameDir).toBe(false)
  })
})