// @vitest-environment node
/**
 * previewUrl 单测 —— 本地预览 URL 生命周期管理器。
 * 覆盖：create 空安全 / 同 blob 复用 / release 引用计数 / 幂等 / clear 全量回收 /
 *       activeCount 追踪 / 构造注入 urlFactory 的可测性。
 *
 * node 环境无全局 URL：均通过 createPreviewUrlManager(fakeUrl) 注入 fake 工厂断言 create/revoke。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPreviewUrlManager } from '../../src/components/base/utils/previewUrl.ts'

/** fake URL 工厂：记录 create/revoke 调用，模拟真实 URL.createObjectURL（每次返回新 url）。 */
function makeFakeUrl() {
  let seq = 0
  return {
    createObjectURL: vi.fn((blob) => {
      const key = blob?._tag || blob?.name || blob?.type || 'blob'
      return `blob:fake-${key}-${++seq}`
    }),
    revokeObjectURL: vi.fn(),
  }
}

const makeBlob = (tag) => ({ _tag: tag || 'b', name: `b_${tag || 'b'}.png`, type: 'image/png' })

describe('previewUrl — createPreviewUrlManager', () => {
  let fake
  let mgr

  beforeEach(() => {
    fake = makeFakeUrl()
    mgr = createPreviewUrlManager(fake)
  })

  it('create(blob) 返回非空 url 并记 1 次引用', () => {
    const url = mgr.create(makeBlob('a'))
    expect(url).toMatch(/^blob:fake-a-1$/)
    expect(fake.createObjectURL).toHaveBeenCalledTimes(1)
    expect(mgr.activeCount()).toBe(1)
  })

  it('不同 create 各自生成独立 url（方案 A 不做同 blob 去重）', () => {
    const blob = makeBlob('same')
    const u1 = mgr.create(blob)
    const u2 = mgr.create(blob)
    expect(u1).not.toBe(u2) // 真实 URL.createObjectURL 每次返回新 url
    expect(fake.createObjectURL).toHaveBeenCalledTimes(2)
    expect(mgr.activeCount()).toBe(2)
  })

  it('release 使引用减到 0 才真正 revoke（单次 create 首次 release 即归零回收）', () => {
    const u = mgr.create(makeBlob('x'))
    mgr.release(u)
    expect(fake.revokeObjectURL).toHaveBeenCalledWith(u)
    expect(mgr.activeCount()).toBe(0)
  })

  it('同一 url 多次 release → 幂等，仅首次真正 revoke', () => {
    const u = mgr.create(makeBlob('x'))
    mgr.release(u)
    const calls = fake.revokeObjectURL.mock.calls.length
    mgr.release(u) // 已归零删除，幂等不重复 revoke
    expect(fake.revokeObjectURL).toHaveBeenCalledTimes(calls)
  })

  it('未登记 / 已 revoke 的 url 再 release → 幂等不抛', () => {
    mgr.release('blob:not-registered')
    expect(fake.revokeObjectURL).not.toHaveBeenCalled()
    const u = mgr.create(makeBlob('y'))
    mgr.release(u)
    mgr.release(u)
    const callsBefore = fake.revokeObjectURL.mock.calls.length
    mgr.release(u) // 已归零删除
    expect(fake.revokeObjectURL).toHaveBeenCalledTimes(callsBefore)
  })

  it('clear() 一次释放全部并清空 registry', () => {
    mgr.create(makeBlob('a'))
    mgr.create(makeBlob('b'))
    mgr.clear()
    expect(fake.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(mgr.activeCount()).toBe(0)
  })

  it('activeCount 精确反映未释放到 0 的预览数', () => {
    const u1 = mgr.create(makeBlob('a'))
    mgr.create(makeBlob('b'))
    expect(mgr.activeCount()).toBe(2)
    mgr.release(u1)
    expect(mgr.activeCount()).toBe(1) // a 引用数 1 未归零，仍存活
  })
})
