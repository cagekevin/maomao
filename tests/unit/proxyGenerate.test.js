// @vitest-environment node
/**
 * proxyGenerate 单测（补测试缺口，不重复 imageApi/chatApi/videoApi 已覆盖路径）。
 * imageApi.test.js 已覆盖 imageProxy sync SSE 取 url；chatApi/videoApi 已覆盖成功/错误路径。
 * 本文件只锁 proxyGenerate.js 独有的红线：
 *  - chatProxy「信封永不抛错」：非2xx 取嵌套 message（不误加「网络错误」前缀）、content 空分支、网络/Abort 分支
 *  - imageProxy 路由分支：image_mode==='async' 走 pollUntilDone（提交拿 task_id + 轮询拿结果）
 *    （videoProxy 与 imageProxy async 同走 pollUntilDone，源码无条件调用，肉眼可证，不重复测）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { jsonResp } from './_testUtils.mjs'

const mod = await import('../../src/components/base/proxyGenerate.js')
const { chatProxy, imageProxy } = mod
const { GEN_TIMEOUT } = await import('../../src/components/base/config.js')
const { timeoutMessage } = await import('../../src/components/base/genErrors.ts')

vi.stubGlobal('fetch', vi.fn())

const provider = {
  id: 'openai',
  baseUrl: 'http://127.0.0.1:18080/v1',
  image_mode: 'sync',
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('chatProxy 红线：信封永不抛错', () => {
  it('成功：取 json.data.choices[0].message.content', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResp({ data: { choices: [{ message: { content: 'hi' } }] } }))
    const r = await chatProxy({ provider, body: {} })
    expect(r).toEqual({ ok: true, content: 'hi' })
  })

  it('成功：json 顶层无 data 也兼容（取 json.choices）', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResp({ choices: [{ message: { content: 'x' } }] }))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(true)
    expect(r.content).toBe('x')
  })

  it('非2xx：返回嵌套 message，不抛、不误加「网络错误」前缀', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResp({ error: { message: '余额不足' } }, false, 402))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(false)
    // 关键红线：业务错误取上游嵌套 message，且不得被 __proxyFetch 误加「网络错误」前缀
    expect(r.error).toBe('余额不足')
    expect(r.error.startsWith('网络错误')).toBe(false)
  })

  it('非2xx：无嵌套 message 时回退 HTTP status', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResp({}, false, 500))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('HTTP 500')
  })

  it('content 为空字符串：返回「上游未返回文本内容」', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResp({ data: { choices: [{ message: { content: '   ' } }] } }))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('上游未返回文本内容')
  })

  it('网络错误：返回 {ok:false,error:"网络错误:..."}（真网络错用 TypeError，保留可重试标记）', async () => {
    // fetch 断网以 TypeError 拒绝（生产真实网络错误形态）；仅真网络错才加「网络错误」前缀
    globalThis.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(false)
    expect(r.error.startsWith('网络错误')).toBe(true)
  })

  it('非网络异常（普通 Error）不再被自加「网络错误」前缀 → 下游归 business、不可自动重试', async () => {
    // 修复红线：旧实现无条件加「网络错误：」前缀，会把真正的业务/意外错误误判为网络、可自动重试
    globalThis.fetch.mockRejectedValueOnce(new Error('JSON 解析失败'))
    const r = await chatProxy({ provider, body: {} })
    expect(r.ok).toBe(false)
    expect(r.error.startsWith('网络错误')).toBe(false)
    expect(r.error).toBe('JSON 解析失败')
  })

  it('AbortError：返回 {ok:false,aborted:true,error:"已停止"}', async () => {
    const e = new Error('aborted')
    e.name = 'AbortError'
    globalThis.fetch.mockRejectedValueOnce(e)
    const r = await chatProxy({ provider, body: {} })
    expect(r).toEqual({ ok: false, aborted: true, error: '已停止' })
  })
})

describe('imageProxy 路由分支红线', () => {
  it('image_mode==="async" 走 pollUntilDone（提交拿 task_id + 轮询拿结果）', async () => {
    // pollUntilDone 内有真实 setTimeout(3s)，用 fake timers 加速，避免真等 3s
    vi.useFakeTimers()
    try {
      globalThis.fetch
        .mockResolvedValueOnce(jsonResp({ data: [{ task_id: 't1', status: 'submitted' }] }))
        .mockResolvedValueOnce(jsonResp({ data: { result: { images: [{ url: 'p' }] } } }))
      const p = imageProxy({ provider: { ...provider, image_mode: 'async' }, genBody: {} })
      await vi.advanceTimersByTimeAsync(3000) // 触发首个轮询 sleep
      const r = await p
      expect(r).toEqual({ ok: true, url: 'p' })
    } finally {
      vi.useRealTimers() // 还原，避免污染后续用例（restoreAllMocks 不重置 fake timer）
    }
  })

  it('responses 模式：响应体永久悬挂 → GEN_TIMEOUT 后返回「生图超时」，不无限挂起', async () => {
    // 回归防线：__proxyFetch 为长生成设了 timeoutMs:0，若响应体读取不加总超时，
    // 上游只回响应头、body 悬挂时会永久挂起（生图节点 loading 永不复位）。
    vi.useFakeTimers()
    try {
      globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(() => {}) })
      const p = imageProxy({ provider: { ...provider, image_request_mode: 'openai-responses' }, genBody: {} })
      await vi.advanceTimersByTimeAsync(GEN_TIMEOUT)
      const r = await p
      expect(r).toEqual({ ok: false, error: timeoutMessage(GEN_TIMEOUT) })
    } finally {
      vi.useRealTimers()
    }
  })
})
