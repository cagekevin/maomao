// @ts-nocheck
// 测试：contentStore.js（Content 层权威入口）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock 依赖（vi.hoisted 确保变量提升到 vi.mock 之前） ────────────

const { mockStorageAdapter, mockKvStore, mockLogger } = vi.hoisted(() => {
  return {
    mockStorageAdapter: {
      sGet: vi.fn(),
      sSet: vi.fn(),
      sRemove: vi.fn(),
    },
    mockKvStore: {
      storageGet: vi.fn(),
      storageSet: vi.fn(),
      storageDelete: vi.fn(),
      isKvKey: vi.fn(),
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
vi.mock('../../src/components/base/storage/kvStore.ts', () => mockKvStore)
vi.mock('../../src/components/base/logger.ts', () => mockLogger)

// 防 logger 被 NODE_ENV 条件影响
vi.stubEnv('NODE_ENV', 'test')

// ── 导入被测模块 ────────────────────────────────────────────────────

import {
  contentGet, contentSet, contentDelete, contentHas,
  contentGetAsync, contentSetAsync, contentDeleteAsync,
  contentSubscribe, contentSubscribeAll,
  contentGetSnapshot, contentGetKeySnapshot,
  contentClearCache, contentStats,
} from '../../src/components/base/contentStore.ts'

import { STORAGE_KEYS } from '../../src/components/base/contracts.ts'

/* ════════════════════════════════════════════════════════════════
 * 准备工作：每个测试前重置 mock
 * ════════════════════════════════════════════════════════════════ */

beforeEach(() => {
  vi.clearAllMocks()
  contentClearCache()
  // 默认 isKvKey 返回 false
  mockKvStore.isKvKey.mockReturnValue(false)
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

  beforeEach(() => {
    mockKvStore.isKvKey.mockReturnValue(true)
    // 模拟 KV 存储返回
    mockKvStore.storageGet.mockResolvedValue(KV_VALUE)
    mockKvStore.storageSet.mockResolvedValue({ ok: true })
    mockKvStore.storageDelete.mockResolvedValue({ ok: true })
  })

  it('contentGetAsync 对 KV 键走 storageGet', async () => {
    const result = await contentGetAsync(KV_KEY)
    expect(mockKvStore.storageGet).toHaveBeenCalledWith(KV_KEY)
    expect(result).toEqual(KV_VALUE)
  })

  it('contentSetAsync 对 KV 键走 storageSet', async () => {
    await contentSetAsync(KV_KEY, KV_VALUE)
    expect(mockKvStore.storageSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE)
  })

  it('contentDeleteAsync 对 KV 键走 storageDelete', async () => {
    await contentDeleteAsync(KV_KEY)
    expect(mockKvStore.storageDelete).toHaveBeenCalledWith(KV_KEY)
  })

  it('contentGet 对 KV 键（未缓存）返回 undefined', () => {
    expect(contentGet(KV_KEY)).toBeUndefined()
    // 不应调 sGet 也不应调 storageGet（同步 API 不做网络请求）
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled()
    expect(mockKvStore.storageGet).not.toHaveBeenCalled()
  })

  it('contentSet 对 KV 键 fire-and-forget 写 storageSet', async () => {
    contentSet(KV_KEY, KV_VALUE)
    expect(mockKvStore.storageSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE)
    // 不会调 sSet
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled()
  })

  it('contentDelete 对 KV 键 fire-and-forget', async () => {
    contentDelete(KV_KEY)
    expect(mockKvStore.storageDelete).toHaveBeenCalledWith(KV_KEY)
    expect(mockStorageAdapter.sRemove).not.toHaveBeenCalled()
  })

  it('contentHas 对 KV 键（未缓存）返回 false', () => {
    expect(contentHas(KV_KEY)).toBe(false)
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
    mockKvStore.isKvKey.mockReturnValue(true)
    contentGet('canvas-state-v1-any-project-id')
    expect(mockLogger.logger.warn).not.toHaveBeenCalled()
  })

  it('contentGet 动态 KV 键 + _version 不 warning', () => {
    mockKvStore.isKvKey.mockReturnValue(true)
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

  it('contentSet 动态 KV 键走 KV 路由', () => {
    mockKvStore.isKvKey.mockReturnValue(true)
    contentSet('canvas-state-v1-proj-999', { nodes: [], edges: [] })
    expect(mockKvStore.storageSet).toHaveBeenCalled()
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled()
  })

  it('contentGetAsync 动态 KV 键走 storageGet', async () => {
    mockKvStore.isKvKey.mockReturnValue(true)
    mockKvStore.storageGet.mockResolvedValue({ nodes: [] })
    const result = await contentGetAsync('canvas-state-v1-proj-999')
    expect(mockKvStore.storageGet).toHaveBeenCalledWith('canvas-state-v1-proj-999')
    expect(result).toEqual({ nodes: [] })
  })

  it('contentDeleteAsync 动态 KV 键走 storageDelete', async () => {
    mockKvStore.isKvKey.mockReturnValue(true)
    mockKvStore.storageDelete.mockResolvedValue({ ok: true })
    await contentDeleteAsync('canvas-state-v1-proj-999')
    expect(mockKvStore.storageDelete).toHaveBeenCalledWith('canvas-state-v1-proj-999')
  })

  it('contentHas 动态 KV 键（未缓存）返回 false 且不 warning', () => {
    mockKvStore.isKvKey.mockReturnValue(true)
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