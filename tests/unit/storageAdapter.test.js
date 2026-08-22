import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushAsync } from './_testUtils.mjs'

// mock eventBus.publish：捕获 persist:failed 事件
const publishMock = vi.fn()
vi.mock('../../src/components/base/eventBus.js', () => ({
  publish: (...args) => publishMock(...args),
  subscribe: () => () => {},
}))

import { sSet, sRemove, isChromeExtension, initStorage } from '../../src/components/base/storageAdapter.js'

/** 可控的 chrome 全局（模拟 普通网页 / 真实扩展 两种环境） */
let chromeGlobal = null
// 通过 defineProperty 注入全局 chrome，避免 jsdom 没有该对象
beforeEach(() => {
  publishMock.mockClear()
  chromeGlobal = null
  if ('chrome' in globalThis) delete globalThis.chrome
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    get: () => chromeGlobal,
  })
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if ('chrome' in globalThis) delete globalThis.chrome
})

/** 构造「真实扩展」的 chrome：storage.local.get/set/remove 都是函数 */
function makeExtensionChrome() {
  const store = new Map()
  return {
    runtime: { id: 'test-ext-id', lastError: null },
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {}
          if (keys === null) {
            for (const [k, v] of store) out[k] = v
          } else {
            const arr = Array.isArray(keys) ? keys : [keys]
            for (const k of arr) if (store.has(k)) out[k] = store.get(k)
          }
          cb?.(out)
        },
        set: (items, cb) => { for (const [k, v] of Object.entries(items)) store.set(k, v); cb?.() },
        remove: (keys, cb) => {
          const arr = Array.isArray(keys) ? keys : [keys]
          for (const k of arr) store.delete(k)
          cb?.()
        },
      },
    },
  }
}

/** 构造「普通网页误判」场景：chrome 有 runtime.id，但 storage.local 的 get/set 不是函数（如被注入的假对象） */
function makeBrokenExtensionChrome() {
  return {
    runtime: { id: 'stub-id', lastError: null },
    storage: { local: {} }, // get/set 缺失 → 应判为非扩展
  }
}

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

describe('storageAdapter 双端兼容加固', () => {
  it('普通网页（无 chrome）：isChromeExtension 为 false', () => {
    chromeGlobal = undefined
    expect(isChromeExtension()).toBe(false)
  })

  it('chrome 有 runtime.id 即判为扩展（源码仅校验 chrome.runtime.id）', () => {
    chromeGlobal = makeBrokenExtensionChrome()
    expect(isChromeExtension()).toBe(true)
  })

  it('真实扩展（storage.local API 齐全）：isChromeExtension 为 true', () => {
    chromeGlobal = makeExtensionChrome()
    expect(isChromeExtension()).toBe(true)
  })

  it('真实扩展下 sSet 正常写入 chrome.storage：不发布 persist:failed', async () => {
    chromeGlobal = makeExtensionChrome()
    initStorage()
    sSet('ext_k', 'ext_v')
    await flushAsync()
    expect(publishMock).not.toHaveBeenCalled()
  })

  it('chrome.storage.local.set 抛错：回退写 localStorage，且本地数据可读（不再一打开就报）', async () => {
    chromeGlobal = makeExtensionChrome()
    // 破坏 set 使其抛错
    chromeGlobal.storage.local.set = () => { throw new Error('chrome.storage unavailable') }
    initStorage()
    sSet('fallback_k', 'fallback_v')
    await flushAsync()
    // 回退成功 → 不应报 persist:failed
    expect(publishMock).not.toHaveBeenCalled()
    // 数据已落 localStorage（含 yimao: 前缀）
    expect(localStorage.getItem('yimao:fallback_k')).toBe('fallback_v')
  })

  it('回退 localStorage 也失败：才发布 persist:failed', async () => {
    chromeGlobal = makeExtensionChrome()
    chromeGlobal.storage.local.set = () => { throw new Error('chrome.storage unavailable') }
    initStorage()
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    sSet('dbl_fail_k', 'v')
    await flushAsync()
    expect(publishMock).toHaveBeenCalledTimes(1)
    expect(publishMock.mock.calls[0][0]).toBe('persist:failed')
    expect(publishMock.mock.calls[0][1].key).toBe('dbl_fail_k')
    spy.mockRestore()
  })
})
