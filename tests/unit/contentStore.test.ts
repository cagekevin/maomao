// 测试：contentStore.js（Content 层权威入口）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖（vi.hoisted 确保变量提升到 vi.mock 之前） ────────────

const { mockStorageAdapter, mockLocalToolApi, mockLogger } = vi.hoisted(() => {
  return {
    mockStorageAdapter: {
      sGet: vi.fn(),
      sSet: vi.fn(),
      sRemove: vi.fn(),
    },
    // 2026-09-04 中间层折叠后 contentStore 不再 import kvStore，directly 调 localToolApi 的 kv 三件套。
    // 工厂整体替换：缺任一符号即 undefined 崩溃，故三件套必须齐。
    mockLocalToolApi: {
      kvGet: vi.fn(async () => null),
      kvSet: vi.fn(async () => ({ ok: true })),
      kvDelete: vi.fn(async () => ({ ok: true })),
    },
    mockLogger: {
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
  }
})

vi.mock('../../src/components/base/storage/storageAdapter.ts', () => mockStorageAdapter)
vi.mock('../../src/components/base/api/localToolApi.ts', () => mockLocalToolApi)
vi.mock('../../src/components/base/core/logger.ts', () => mockLogger)

// 防 logger 被 NODE_ENV 条件影响
vi.stubEnv('NODE_ENV', 'test')

// ── 导入被测模块 ────────────────────────────────────────────────────

import {
  contentGet, contentSet, contentDelete, contentHas,
  contentGetAsync, contentSetAsync, contentDeleteAsync,
  contentSubscribe, contentSubscribeAll,
  contentGetSnapshot, contentGetKeySnapshot,
  contentClearCache, contentStats, contentReadThrough,
} from '../../src/components/base/core/contentStore.ts'

import { STORAGE_KEYS } from '../../src/components/base/core/contracts.ts'

/* ════════════════════════════════════════════════════════════════
 * 准备工作：每个测试前重置 mock
 * ════════════════════════════════════════════════════════════════ */

beforeEach(() => {
  vi.clearAllMocks()
  contentClearCache()
  // 默认 sGet 返回 null（不存在）
  mockStorageAdapter.sGet.mockReturnValue(null)
})

afterEach(() => {
  contentClearCache()
})

/* ════════════════════════════════════════════════════════════════
 * 同步 API：get / set / delete / has
 * ════════════════════════════════════════════════════════════════ */

describe('contentGet / contentSet / contentDelete / contentHas', () => {
  const KEY = 'projects'
  const VALUE = [{ id: 'p1', name: 'test' }]

  it('contentGet 未设置的键返回 undefined', () => {
    expect(contentGet(KEY)).toBeUndefined()
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith(KEY)
  })

  it('contentGet 返回已设置的键值', () => {
    contentSet(KEY, VALUE)
    expect(contentGet(KEY)).toEqual(VALUE)
  })

  it('contentGet 从 localStorage 惰性加载', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE))
    expect(contentGet(KEY)).toEqual(VALUE)
    // 第二次读取应走缓存，不再调 sGet
    mockStorageAdapter.sGet.mockClear()
    expect(contentGet(KEY)).toEqual(VALUE)
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled()
  })

  it('contentSet 写入缓存并持久化', () => {
    contentSet(KEY, VALUE)
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE))
  })

  it('contentSet 字符串值原样持久化', () => {
    contentSet('agent_draft', 'hello')
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith('agent_draft', 'hello')
  })

  it('sSet 抛错时 contentSet 向上传播（不吞错；真实 sSet 抛错前已 publish persist:failed，事件不被阻断）', () => {
    mockStorageAdapter.sSet.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
    expect(() => contentSet(KEY, VALUE)).toThrow('QuotaExceededError')
  })

  it('contentDelete 删除缓存并持久化', () => {
    contentSet(KEY, VALUE)
    contentDelete(KEY)
    expect(contentGet(KEY)).toBeUndefined()
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KEY)
  })

  it('contentHas 检查存在的键', () => {
    contentSet(KEY, VALUE)
    expect(contentHas(KEY)).toBe(true)
  })

  it('contentHas 检查不存在的键', () => {
    expect(contentHas(KEY)).toBe(false)
  })

  it('contentHas 对未加载的 local 键读 localStorage', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE))
    expect(contentHas(KEY)).toBe(true)
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith(KEY)
  })
})

/* ════════════════════════════════════════════════════════════════
 * 异步 API：getAsync / setAsync / deleteAsync
 * ════════════════════════════════════════════════════════════════ */

describe('contentGetAsync / contentSetAsync / contentDeleteAsync', () => {
  const KEY = 'app_settings'
  const VALUE = { performanceMode: true }

  it('contentGetAsync 读取 localStorage 键', async () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE))
    const result = await contentGetAsync(KEY)
    expect(result).toEqual(VALUE)
  })

  it('contentGetAsync 不存在的键返回 undefined', async () => {
    mockStorageAdapter.sGet.mockReturnValue(null)
    const result = await contentGetAsync(KEY)
    expect(result).toBeUndefined()
  })

  it('contentSetAsync 写入并等待持久化', async () => {
    await contentSetAsync(KEY, VALUE)
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE))
  })

  it('contentDeleteAsync 删除并等待持久化', async () => {
    await contentSetAsync(KEY, VALUE)
    await contentDeleteAsync(KEY)
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KEY)
    expect(await contentGetAsync(KEY)).toBeUndefined()
  })
})

/* ════════════════════════════════════════════════════════════════
 * KV 路由
 * ════════════════════════════════════════════════════════════════ */

describe('KV 键路由', () => {
  const KV_KEY = 'canvas-state-v1-test-project'
  const KV_VALUE = { nodes: [], edges: [] }

  // 路由由 resolveBackend 读真实 STORAGE_KEYS 决定（canvas-state-v1-{projectId} pattern 登记为 kv），
  // 不再由 mock 注入 isKvKey（2026-09-04 折叠）。这里只预设 kv 底层返回值。
  beforeEach(() => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE)
    mockLocalToolApi.kvSet.mockResolvedValue({ ok: true })
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true })
  })

  it('contentGetAsync 对 KV 键走 kvGet', async () => {
    const result = await contentGetAsync(KV_KEY)
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledWith(KV_KEY)
    expect(result).toEqual(KV_VALUE)
  })

  it('contentSetAsync 对 KV 键走 kvSet', async () => {
    await contentSetAsync(KV_KEY, KV_VALUE)
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE)
  })

  it('contentDeleteAsync 对 KV 键走 kvDelete', async () => {
    await contentDeleteAsync(KV_KEY)
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith(KV_KEY)
  })

  it('contentGet 对 KV 键（未缓存）返回 undefined', () => {
    expect(contentGet(KV_KEY)).toBeUndefined()
    // 不应调 sGet 也不应调 kvGet（同步 API 不做网络请求）
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled()
    expect(mockLocalToolApi.kvGet).not.toHaveBeenCalled()
  })

  it('contentSet 对 KV 键 fire-and-forget 写 kvSet', async () => {
    contentSet(KV_KEY, KV_VALUE)
    await Promise.resolve()
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE)
    // 不会调 sSet
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled()
  })

  it('contentDelete 对 KV 键 fire-and-forget', async () => {
    contentDelete(KV_KEY)
    await Promise.resolve()
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith(KV_KEY)
    expect(mockStorageAdapter.sRemove).not.toHaveBeenCalled()
  })

  it('contentHas 对 KV 键（未缓存）返回 false', () => {
    expect(contentHas(KV_KEY)).toBe(false)
  })
})

/* ════════════════════════════════════════════════════════════════
 * 折叠回归（2026-09-04 中间层折叠）：KV 降级行为/路由只判 1 次/native
 * ════════════════════════════════════════════════════════════════ */

describe('折叠回归（KV 降级 / 路由 / native）', () => {
  const KV_KEY = 'canvas-state-v1-test-project'
  const KV_VALUE = { nodes: [], edges: [] }

  // clearAllMocks 只清调用不清实现（mockRejectedValue 会跨用例残留），故在此统一重置 kv 三件套为成功默认。
  beforeEach(() => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE)
    mockLocalToolApi.kvSet.mockResolvedValue({ ok: true })
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true })
  })

  it('路由只判 1 次（kvGet 仅触发 1 次，不重复遍历登记表）', async () => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE)
    await contentGetAsync(KV_KEY)
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledTimes(1)
  })

  it('KV 写失败 → 降级写本地副本 + reportDegrade（layer 保留 kvStore）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValue(new Error('kv down'))
    await contentSetAsync(KV_KEY, KV_VALUE)
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KV_KEY, JSON.stringify(KV_VALUE))
    // reportDegrade 内部走 logger.warn(layer='kvStore', '降级: ${key}', e)（degrade.ts:43）
    expect(mockLogger.logger.warn).toHaveBeenCalledWith('kvStore', expect.stringContaining(KV_KEY), expect.anything())
  })

  it('KV 写成功 → sRemove 清历史降级副本（P2-F1，防旧值复活）', async () => {
    // kvSet 默认 mock resolve({ ok:true })，KV 成功路径
    await contentSetAsync(KV_KEY, KV_VALUE)
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE)
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY)
  })

  it('KV 删成功 → 不清本地副本（A3 回归锁：无条件 sRemove 会改行为）', async () => {
    // kvDelete 默认 mock resolve({ ok:true })，KV 成功路径
    await contentDeleteAsync(KV_KEY)
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith(KV_KEY)
    expect(mockStorageAdapter.sRemove).not.toHaveBeenCalled()
  })

  it('KV 删失败 → 清本地降级副本（修 R3，防副本残留）', async () => {
    mockLocalToolApi.kvDelete.mockRejectedValue(new Error('kv down'))
    await contentDeleteAsync(KV_KEY)
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY)
  })

  it('native 键走 sGet，不触 KV/网络', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ a: 1 }))
    const r = contentGet('director3d-custom-poses')
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith('director3d-custom-poses')
    expect(mockLocalToolApi.kvGet).not.toHaveBeenCalled()
    expect(r).toEqual({ a: 1 })
  })

  it('contentReadThrough 写后直读底层真值（绕过缓存，防自证式验证）', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ id: 'p1' }))
    contentSet('projects', [{ id: 'p1' }]) // 写缓存
    // contentReadThrough 读底层 sGet（非缓存），用于落盘确认类场景
    expect(contentReadThrough('projects')).toBe(JSON.stringify({ id: 'p1' }))
  })

  it('contentReadThrough 对 kv 键返回 null（kv 无法同步读）', () => {
    expect(contentReadThrough('canvas-state-v1-test-project')).toBeNull()
  })
})

/* ════════════════════════════════════════════════════════════════
 * 订阅
 * ════════════════════════════════════════════════════════════════ */

describe('contentSubscribe', () => {
  const KEY = 'app_settings'
  const VALUE = { performanceMode: true }

  it('订阅者收到 set 通知', () => {
    const cb = vi.fn()
    contentSubscribe(KEY, cb)
    contentSet(KEY, VALUE)
    expect(cb).toHaveBeenCalledWith(VALUE)
  })

  it('订阅者收到 delete 通知', () => {
    const cb = vi.fn()
    contentSet(KEY, VALUE)
    contentSubscribe(KEY, cb)
    contentDelete(KEY)
    expect(cb).toHaveBeenCalledWith(undefined)
  })

  it('返回的取消函数停止订阅', () => {
    const cb = vi.fn()
    const unsub = contentSubscribe(KEY, cb)
    unsub()
    contentSet(KEY, VALUE)
    expect(cb).not.toHaveBeenCalled()
  })

  it('多个订阅者分别收到通知', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    contentSubscribe(KEY, cb1)
    contentSubscribe(KEY, cb2)
    contentSet(KEY, VALUE)
    expect(cb1).toHaveBeenCalledWith(VALUE)
    expect(cb2).toHaveBeenCalledWith(VALUE)
  })
})

describe('contentSubscribeAll', () => {
  it('全局订阅者收到任何键的变更', () => {
    const cb = vi.fn()
    contentSubscribeAll(cb)
    contentSet('projects', [{ id: 'p1' }])
    expect(cb).toHaveBeenCalledWith('projects', [{ id: 'p1' }])
  })

  it('全局订阅者支持取消', () => {
    const cb = vi.fn()
    const unsub = contentSubscribeAll(cb)
    unsub()
    contentSet('projects', [{ id: 'p1' }])
    expect(cb).not.toHaveBeenCalled()
  })
})

/* ════════════════════════════════════════════════════════════════
 * 快照
 * ════════════════════════════════════════════════════════════════ */

describe('contentGetSnapshot', () => {
  it('快照包含已设置的键值', () => {
    contentSet('projects', [{ id: 'p1' }])
    contentSet('app_settings', { performanceMode: true })
    const snapshot = contentGetSnapshot()
    expect(snapshot.projects).toEqual([{ id: 'p1' }])
    expect(snapshot.app_settings).toEqual({ performanceMode: true })
  })

  it('快照不包含动态键（pattern: true）', () => {
    contentSet('projects', [{ id: 'p1' }])
    const snapshot = contentGetSnapshot()
    // 不包含 KV 动态键
    expect(snapshot['canvas-state-v1-{projectId}']).toBeUndefined()
  })

  it('快照已被冻结（不可变）', () => {
    contentSet('projects', [{ id: 'p1' }])
    const snapshot = contentGetSnapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
  })

  it('快照不含未设置的键', () => {
    const snapshot = contentGetSnapshot()
    expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(0)
  })
})

describe('contentGetKeySnapshot', () => {
  it('返回指定键的冻结值', () => {
    const val = [{ id: 'p1' }]
    contentSet('projects', val)
    const snapshot = contentGetKeySnapshot('projects')
    expect(snapshot).toEqual(val)
    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})

/* ════════════════════════════════════════════════════════════════
 * 维护工具
 * ════════════════════════════════════════════════════════════════ */

describe('contentClearCache / contentStats', () => {
  it('contentStats 返回正确统计', () => {
    contentSet('projects', [{ id: 'p1' }])
    const stats = contentStats()
    expect(stats.cachedKeys).toBeGreaterThanOrEqual(1)
    expect(stats.listeners).toBeGreaterThanOrEqual(0)
  })

  it('contentClearCache 清除缓存', () => {
    contentSet('projects', [{ id: 'p1' }])
    // 确认缓存中有值
    expect(contentGet('projects')).toEqual([{ id: 'p1' }])
    contentClearCache()
    // 清除后缓存为空，sGet 返回 null → 结果为 undefined
    mockStorageAdapter.sGet.mockReturnValue(null)
    expect(contentGet('projects')).toBeUndefined()
  })
})

/* ════════════════════════════════════════════════════════════════
 * 动态键模式匹配
 * ════════════════════════════════════════════════════════════════ */

describe('动态键模式匹配', () => {
  it('contentGet 动态 KV 键不 warning（匹配 pattern）', () => {
    contentGet('canvas-state-v1-any-project-id')
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })

  it('contentGet 动态 KV 键 + _version 不 warning', () => {
    contentGet('canvas-state-v1-any-project-id_version')
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })

  it('contentGet 动态会话键不 warning（匹配 pattern）', () => {
    contentGet('agent_conversations_canvas-assistant-proj-123')
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })

  it('contentGet 动态会话 id 键不 warning', () => {
    contentGet('agent_active_conversation_id_canvas-assistant-proj-123')
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })

  it('contentSet 动态 KV 键走 KV 路由', async () => {
    contentSet('canvas-state-v1-proj-999', { nodes: [], edges: [] })
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith('canvas-state-v1-proj-999', { nodes: [], edges: [] })
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled()
  })

  it('contentGetAsync 动态 KV 键走 kvGet', async () => {
    mockLocalToolApi.kvGet.mockResolvedValue({ nodes: [] })
    const result = await contentGetAsync('canvas-state-v1-proj-999')
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledWith('canvas-state-v1-proj-999')
    expect(result).toEqual({ nodes: [] })
  })

  it('contentDeleteAsync 动态 KV 键走 kvDelete', async () => {
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true })
    await contentDeleteAsync('canvas-state-v1-proj-999')
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith('canvas-state-v1-proj-999')
  })

  it('contentHas 动态 KV 键（未缓存）返回 false 且不 warning', () => {
    const result = contentHas('canvas-state-v1-proj-999')
    expect(result).toBe(false)
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })
})

/* ════════════════════════════════════════════════════════════════
 * 未登记键 warning
 * ════════════════════════════════════════════════════════════════ */

describe('未登记键 编译期拦截（开发环境）', () => {
  // 本块默认 NODE_ENV='test'（见文件顶部 vi.stubEnv），非 production → 应抛错拦截
  it('contentGet 未登记字面量键直接抛错（开发环境）', () => {
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/)
  })

  it('contentSet 未登记字面量键直接抛错（开发环境）', () => {
    expect(() => contentSet('unknown-key', 'value')).toThrow(/未登记的存储键/)
  })

  it('未登记字面量键重复调用每次都抛（开发环境硬拦截）', () => {
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/)
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/)
  })
})

describe('未登记键 生产环境降级（仅 warning 不抛）', () => {
  // 模拟生产：NODE_ENV=production 时即便未登记字面量键也不抛，保持线上兼容
  beforeEach(() => vi.stubEnv('NODE_ENV', 'production'))
  afterEach(() => vi.stubEnv('NODE_ENV', 'test'))

  it('contentGet 未登记字面量键在生产环境仅 warning 不抛', () => {
    expect(contentGet('unknown-key')).toBeUndefined()
    expect(mockLogger.logger.warn).toHaveBeenCalled()
    // logger.warn 契约为 (category, action, detail?)：键名现在落在第 2 参 action 上
    expect(mockLogger.logger.warn.mock.calls[0][1]).toContain('unknown-key')
  })

  it('contentSet 未登记字面量键在生产环境仅 warning 不抛', () => {
    expect(() => contentSet('unknown-key', 'value')).not.toThrow()
    expect(mockLogger.logger.warn).toHaveBeenCalled()
  })
})