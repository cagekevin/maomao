import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// mock eventBus.publish：捕获 persist:failed 事件
const publishMock = vi.fn()
vi.mock('../../src/components/base/eventBus.js', () => ({
  publish: (...args) => publishMock(...args),
  subscribe: () => () => {},
}))

// mock isChromeExtension：默认非插件（走 localStorage 分支）
let isExt = false
vi.mock('../../src/components/base/storageAdapter.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isChromeExtension: () => isExt,
  }
})

import { sSet, sRemove } from '../../src/components/base/storageAdapter.js'

beforeEach(() => {
  publishMock.mockClear()
  isExt = false
})

afterEach(() => {
  vi.restoreAllMocks()
  // 恢复真实 localStorage
  vi.unstubAllGlobals()
})

describe('storageAdapter R1 写入失败事件化', () => {
  it('sSet 正常写入：不发布 persist:failed', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {})
    sSet('k1', 'v1')
    expect(publishMock).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('sSet 写入抛错（配额满/隐私模式）：发布 persist:failed 且带 key', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    sSet('k_big', 'x'.repeat(10000))
    expect(publishMock).toHaveBeenCalledTimes(1)
    expect(publishMock.mock.calls[0][0]).toBe('persist:failed')
    expect(publishMock.mock.calls[0][1].key).toBe('k_big')
    expect(publishMock.mock.calls[0][1].error).toContain('QuotaExceededError')
    spy.mockRestore()
  })

  it('sRemove 删除抛错：发布 persist:failed', () => {
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('SecurityError') })
    sRemove('k2')
    expect(publishMock).toHaveBeenCalledTimes(1)
    expect(publishMock.mock.calls[0][0]).toBe('persist:failed')
    spy.mockRestore()
  })

  it('sSet 正常删除不发布', () => {
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {})
    sRemove('k3')
    expect(publishMock).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
