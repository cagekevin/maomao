/**
 * 【集成契约】KV 降级链 → persist:failed（「部分数据保存失败」toast 来源）。
 *
 * 背景：直连生图/任何画布变化 → saveCanvasState → contentSetAsync(canvas-state-*  KV 键)
 *   → writeKvWithFallback（contentStore 折叠后内联，2026-09-04 自 kvStore.storageSet 折叠）→ kvSet(/api/kv/set) 失败
 *   → 降级 sSet 写 localStorage → localStorage.setItem 也失败 → reportPersistFailure → publish('persist:failed')
 *   → App 节流 toast「部分数据保存失败」。
 *
 * 【2026-09-04 折叠】原驱动入口 storageSet（kvStore 中间层）已删除，改从真实生产链路入口
 *   contentSetAsync 驱动，比原来更贴近真实（contentStore → contentSetAsync → resolveBackend 判 KV → writeKvWithFallback）。
 *   storageSet 曾返回的 { ok, degraded } 随之消失；降级副本断言改查 localStorage 真实落盘（注意 storageAdapter 的 yimao: 前缀）。
 *
 * 本测试用【真实 storageAdapter.sSet】（不 mock），模拟 localStorage.setItem 抛错，
 * 验证「降级写 localStorage 失败 → 发布 persist:failed 事件」这条链确实成立，
 * 并确认 KV 失败本身【不】直接发 persist:failed（只降级 + warn），
 * 从而把「部分数据保存失败」的准确触发条件标准化（避免再靠猜）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 用真实 contentStore/kvStore/storageAdapter；只替换最小外部依赖（fetch 可控、logger 静默）。
// contentStore 折叠后 kvGet/kvSet/kvDelete 来自 real localToolApi.ts（经 httpClient fetch 真实发出，由本文件 stub 控制）。
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

import { contentSetAsync } from '@/components/base/core/contentStore.ts'
import { publish, subscribe, clearEvent } from '../../src/components/base/core/eventBus.ts'
import { CANVAS_STATE_PREFIX } from '@/components/base/storage/kvStore.ts' // 保留：kvStore 壳仍 re-export 前缀

// 真实 storageAdapter：让 localStorage.setItem 可注入异常/可恢复
// 方法：beforeEach 里 stub localStorage.setItem，验证失败时 reportPersistFailure 发事件

/** ok / 非ok 响应 */
function notOk(status = 500) {
  return { ok: false, status, json: async () => { throw new Error('parse fail') }, text: async () => '' }
}

let fetchImpl
let persistEvts = []
let offPersist

const CONTENT_STATE_KEY = CANVAS_STATE_PREFIX + 'proj_1'

beforeEach(() => {
  vi.clearAllMocks()
  fetchImpl = vi.fn()
  vi.stubGlobal('fetch', fetchImpl)
  persistEvts = []
  offPersist = subscribe('persist:failed', (p) => persistEvts.push(p))
})
afterEach(() => {
  offPersist?.()
  clearEvent('persist:failed')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('KV 降级链 → persist:failed（兼容真实 storageAdapter 行为）', () => {
  it('KV 失败但 localStorage 降级写成功 → 只降级 + 不发 persist:failed（数据未丢，不报「保存失败」）', async () => {
    fetchImpl.mockResolvedValue(notOk(500)) // KV /api/kv/set 失败 → 触发降级分支写 local
    await contentSetAsync(CONTENT_STATE_KEY, { nodes: [{ id: '1' }] })
    // storageSet 的 { ok, degraded } 返回值随中间层消失 → 改为断言「降级副本确实落到 localStorage」。
    // 注意 storageAdapter.sSet 带 yimao: 前缀，故按拼接后的真实 key 读。
    expect(JSON.parse(localStorage.getItem('yimao:' + CONTENT_STATE_KEY))).toEqual({ nodes: [{ id: '1' }] })
    expect(persistEvts).toHaveLength(0) // 数据落 local 成功，不报失败
  })

  it('KV 失败 且 localStorage 降级写也失败 → 发布 persist:failed（「部分数据保存失败」来源）', async () => {
    fetchImpl.mockResolvedValue(notOk(500)) // KV 失败 → 触发降级分支
    // 降级写 localStorage 失败（模拟配额满/隐私禁用 localStorage.setItem 抛错）
    const setItemSpy = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: 存储空间不足')
    })
    try {
      await contentSetAsync(CONTENT_STATE_KEY, { nodes: [{ id: '1' }] })
      expect(persistEvts).toHaveLength(1) // storageAdapter 内部已发 persist:failed
      expect(persistEvts[0].key).toBe(CONTENT_STATE_KEY)
    } finally {
      setItemSpy.mockRestore()
    }
  })
})