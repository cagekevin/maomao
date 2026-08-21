// 回归测试：kvStore.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 内存实现 storageAdapter（仅模拟外部依赖，不掩盖 kvStore 真实逻辑）
vi.mock('../../src/components/base/storageAdapter.js', () => ({
  sGet: vi.fn(),
  sSet: vi.fn(),
  sRemove: vi.fn(),
}))

// kvStore 内部 logger.warn 会 fire-and-forget 调 fetch(/api/logs)，
// 为避免污染 fetch 断言，mock 掉 logger（属可 mock 的外部依赖/浏览器 API 封装）。
vi.mock('../../src/components/base/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))

import {
  kvGet,
  kvSet,
  kvDelete,
  storageGet,
  storageSet,
  storageDelete,
  isKvKey,
  CANVAS_STATE_PREFIX,
} from '../../src/components/base/kvStore.js'
import { sGet, sSet, sRemove } from '../../src/components/base/storageAdapter.js'
import { logger } from '../../src/components/base/logger.js'

const API_BASE = 'http://127.0.0.1:18080'

// 可变 fetch mock，每个用例自行设置实现
let fetchImpl
beforeEach(() => {
  fetchImpl = vi.fn()
  vi.stubGlobal('fetch', fetchImpl)
  sGet.mockReset()
  sSet.mockReset()
  sRemove.mockReset()
  logger.warn.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 构造一个 ok 的 fetch 响应 */
function okJson(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
}
/** 构造一个非 ok 的 fetch 响应（无 json 方法也安全，因为 kv 层只判 res.ok） */
function notOk(status = 500) {
  return { ok: false, status, json: async () => { throw new Error('parse fail') }, text: async () => '' }
}

describe('kvStore isKvKey', () => {
  it('canvas-state-v1- 前缀返回 true', () => {
    expect(isKvKey(CANVAS_STATE_PREFIX + 'snap1')).toBe(true)
    expect(isKvKey('canvas-state-v1-')).toBe(true) // 正好前缀
  })
  it('其他前缀/无前缀返回 false', () => {
    expect(isKvKey('projects')).toBe(false)
    expect(isKvKey('canvas-state-')).toBe(false) // 旧前缀不算
    expect(isKvKey('users/abc')).toBe(false)
  })
  it('非字符串输入返回 false（边界/异常输入）', () => {
    expect(isKvKey(null)).toBe(false)
    expect(isKvKey(undefined)).toBe(false)
    expect(isKvKey(123)).toBe(false)
    expect(isKvKey({})).toBe(false)
  })
})

describe('kvStore kvGet', () => {
  it('构造正确的 URL（GET + encodeURIComponent）并解析返回值', async () => {
    const key = 'snap 1/2'
    fetchImpl.mockResolvedValue(okJson({ a: 1 }))
    const r = await kvGet(key)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${API_BASE}/api/kv/get?key=${encodeURIComponent(key)}`
    )
    expect(r).toEqual({ a: 1 })
  })
  it('key 不存在时返回 null', async () => {
    fetchImpl.mockResolvedValue(okJson(null))
    const r = await kvGet('missing')
    expect(r).toBeNull()
  })
  it('非 ok 响应抛 HttpError（含 status，message 兜底空）', async () => {
    fetchImpl.mockResolvedValue(notOk(500))
    await expect(kvGet('x')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: '' })
  })
  it('fetch 网络异常透传 reject', async () => {
    fetchImpl.mockRejectedValue(new Error('network down'))
    await expect(kvGet('x')).rejects.toThrow('network down')
  })
})

describe('kvStore kvSet', () => {
  it('构造正确的 URL/方法/body（POST + JSON.stringify({key,value})）', async () => {
    const key = 'k1'
    const value = { nodes: [], edges: [] }
    fetchImpl.mockResolvedValue(okJson({ ok: true }))
    const r = await kvSet(key, value)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, opt] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/kv/set`)
    expect(opt.method).toBe('POST')
    expect(opt.headers['Content-Type']).toBe('application/json')
    expect(opt.body).toBe(JSON.stringify({ key, value }))
    expect(r).toEqual({ ok: true })
  })
  it('非 ok 响应抛 HttpError', async () => {
    fetchImpl.mockResolvedValue(notOk(503))
    await expect(kvSet('k1', 1)).rejects.toMatchObject({ name: 'HttpError', status: 503, message: '' })
  })
})

describe('kvStore kvDelete', () => {
  it('构造正确的删除 URL（GET + encodeURIComponent）', async () => {
    const key = 'del/me'
    fetchImpl.mockResolvedValue(okJson({ ok: true }))
    const r = await kvDelete(key)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${API_BASE}/api/kv/delete?key=${encodeURIComponent(key)}`
    )
    expect(r).toEqual({ ok: true })
  })
  it('非 ok 响应抛 HttpError', async () => {
    fetchImpl.mockResolvedValue(notOk(500))
    await expect(kvDelete('k1')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: '' })
  })
  it('删不存在的 key 仍返回 ok（契约约定）', async () => {
    fetchImpl.mockResolvedValue(okJson({ ok: true }))
    const r = await kvDelete('not-exist')
    expect(r).toEqual({ ok: true })
  })
})

describe('kvStore storageGet', () => {
  it('KV 前缀走 kvGet（fetch 请求 /api/kv/get）', async () => {
    const key = CANVAS_STATE_PREFIX + 'snap'
    fetchImpl.mockResolvedValue(okJson({ v: 1 }))
    const r = await storageGet(key)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/kv/get')
    expect(sGet).not.toHaveBeenCalled()
    expect(r).toEqual({ v: 1 })
  })
  it('非 KV 前缀走 sGet，并 JSON.parse 解析', async () => {
    const key = 'projects'
    const value = { id: 'p1', list: [1, 2] }
    sGet.mockReturnValue(JSON.stringify(value))
    const r = await storageGet(key)
    expect(sGet).toHaveBeenCalledWith('projects')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toEqual(value)
  })
  it('非 KV 前缀 sGet 返回 null → storageGet 返回 null', async () => {
    sGet.mockReturnValue(null)
    const r = await storageGet('missing')
    expect(r).toBeNull()
  })
  it('非 KV 前缀 sGet 返回非 JSON 字符串 → 原样返回（解析失败兜底）', async () => {
    sGet.mockReturnValue('plain-string')
    const r = await storageGet('plain')
    expect(r).toBe('plain-string')
  })
})

describe('kvStore storageSet', () => {
  it('KV 前缀走 kvSet，成功返回 {ok:true}', async () => {
    const key = CANVAS_STATE_PREFIX + 'snap'
    const value = { nodes: [] }
    fetchImpl.mockResolvedValue(okJson({ ok: true }))
    const r = await storageSet(key, value)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe(`${API_BASE}/api/kv/set`)
    expect(sSet).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: true })
  })
  it('KV 前缀但 kvSet 失败 → 降级 localStorage(sSet) 并返回 {ok:true, degraded:true}', async () => {
    const key = CANVAS_STATE_PREFIX + 'snap'
    const value = { nodes: [1, 2] }
    fetchImpl.mockResolvedValue(notOk(500))
    const r = await storageSet(key, value)
    // 降级：kv 失败，走 sSet
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(sSet).toHaveBeenCalledTimes(1)
    // storageSet 内部 stringify 后写入
    expect(sSet.mock.calls[0][0]).toBe(key)
    expect(sSet.mock.calls[0][1]).toBe(JSON.stringify(value))
    // 记录降级 warn 日志
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: true, degraded: true })
  })
  it('KV 前缀 kvSet 网络异常同样降级', async () => {
    const key = CANVAS_STATE_PREFIX + 'snap'
    fetchImpl.mockRejectedValue(new Error('net'))
    const r = await storageSet(key, 'abc')
    expect(sSet).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: true, degraded: true })
  })
  it('非 KV 前缀走 sSet（对象被 stringify）', async () => {
    const key = 'projects'
    const value = { a: 1 }
    const r = await storageSet(key, value)
    expect(sSet).toHaveBeenCalledWith('projects', JSON.stringify(value))
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: true })
  })
  it('非 KV 前缀传入字符串值走 sSet（原样写入，不二次 stringify）', async () => {
    const key = 'plain'
    const r = await storageSet(key, 'raw-string')
    expect(sSet).toHaveBeenCalledWith('plain', 'raw-string')
    expect(r).toEqual({ ok: true })
  })
})

describe('kvStore storageDelete', () => {
  it('KV 前缀走 kvDelete（fetch 请求 /api/kv/delete）', async () => {
    const key = CANVAS_STATE_PREFIX + 'snap'
    fetchImpl.mockResolvedValue(okJson({ ok: true }))
    const r = await storageDelete(key)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/kv/delete')
    expect(sRemove).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: true })
  })
  it('非 KV 前缀走 sRemove', async () => {
    const key = 'projects'
    const r = await storageDelete(key)
    expect(sRemove).toHaveBeenCalledWith('projects')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: true })
  })
})
