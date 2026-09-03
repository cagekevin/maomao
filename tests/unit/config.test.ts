import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert'

/**
 * config —— 集中配置契约测试。
 * config.ts 是 env 变量的唯一读取入口，业务代码不得散落 import.meta.env。
 * 这里锁两类契约：
 *  1) 默认值（无 env 时各常量取文档化默认）；
 *  2) env 覆盖（VITE_AGENT_DEMO 等能正确改写输出）。
 * 若有人绕过 config 直接读 env 或在别处新增 env 读取，本文件守护的默认/覆盖契约仍保持生效。
 * 2026-09-04：AGENT_MODELS 已随「AI 助手模型改用厂商 chat_models」退役删除，相关 2 条单测一并移除。
 */

/**
 * 补齐调试开关的全局类型。
 * src 侧用 `window[`__DEBUG_${upper}`]` 动态索引读取（noImplicitAny:false 下合法，故未显式声明），
 * 测试侧需要显式读写具体开关，故在此声明，省掉 8 处 `as any`。
 * 附带收益：去掉 `(globalThis.window as any).x = ...` 的括号前缀后，
 * handoff 踩坑 #18 的 ASI 续行陷阱也一并消失。
 */
declare global {
  interface Window {
    __DEBUG_ALL?: boolean
    __DEBUG_IMAGE?: boolean
    __DEBUG_ASSET?: boolean
  }
}

/** 重新加载 config 模块（顶层 const 在 import 时求值，需 resetModules 使 env 覆盖生效）。 */
async function loadConfig() {
  vi.resetModules()
  return await import('../../src/components/base/core/config.ts')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('config — 默认值契约（无 env）', () => {
  it('LLM 配置默认值', async () => {
    const c = await loadConfig()
    expect(c.LLM_CHAT_BASE_URL).toBe('')
    expect(c.LLM_CHAT_API_KEY).toBe('')
    expect(c.LLM_CHAT_MODEL).toBe('gpt-4o-mini')
  })

  it('AGENT_DEMO_MODE 默认关闭，仅 VITE_AGENT_DEMO==="1" 才开启', async () => {
    expect((await loadConfig()).AGENT_DEMO_MODE).toBe(false)
  })

  it('超时/轮询/并发默认值', async () => {
    const c = await loadConfig()
    expect(c.HTTP_DEFAULT_TIMEOUT).toBe(15000)
    expect(c.LOCAL_TOOL_PING_TIMEOUT).toBe(5000)
    expect(c.IMAGE_FETCH_TIMEOUT).toBe(10000)
    expect(c.IMAGE_LOAD_TIMEOUT).toBe(10000)
    expect(c.DOWNLOAD_TIMEOUT).toBe(30000)
    expect(c.VIDEO_DOWNLOAD_TIMEOUT).toBe(60000)
    expect(c.UPLOAD_TIMEOUT).toBe(30000)
    expect(c.GEN_TIMEOUT).toBe(300000)
    expect(c.VIDEO_TIMEOUT).toBe(600000)
    expect(c.GEN_POLL_INTERVAL).toBe(3000)
    expect(c.VIDEO_POLL_INTERVAL).toBe(5000)
    expect(c.GEN_MAX_CONCURRENT).toBe(6)
  })
})

describe('config — env 覆盖契约', () => {
  it('VITE_AGENT_DEMO="1" 开启演示模式', async () => {
    vi.stubEnv('VITE_AGENT_DEMO', '1')
    expect((await loadConfig()).AGENT_DEMO_MODE).toBe(true)
  })

  it('VITE_AGENT_DEMO 非 "1"（如 "0"）不开启演示模式', async () => {
    vi.stubEnv('VITE_AGENT_DEMO', '0')
    expect((await loadConfig()).AGENT_DEMO_MODE).toBe(false)
  })

  it('LLM 配置可被 env 覆盖', async () => {
    vi.stubEnv('VITE_LLM_CHAT_BASE_URL', 'https://llm.example.com')
    vi.stubEnv('VITE_LLM_CHAT_MODEL', 'deepseek-r1')
    const c = await loadConfig()
    expect(c.LLM_CHAT_BASE_URL).toBe('https://llm.example.com')
    expect(c.LLM_CHAT_MODEL).toBe('deepseek-r1')
  })
})

describe('config — isDebugModuleOn（调试开关实时判断）', () => {
  beforeEach(() => {
    // 每次干净：清空 window.__DEBUG_*（node 环境无 window，用空对象模拟）
    globalThis.window = globalThis.window || ({} as unknown as Window & typeof globalThis)
    delete globalThis.window.__DEBUG_ALL
    delete globalThis.window.__DEBUG_IMAGE
    delete globalThis.window.__DEBUG_ASSET
  })

  it('默认关闭：未设任何开关时全部 debug 关闭', async () => {
    const c = await loadConfig()
    expect(c.isDebugModuleOn('image')).toBe(false)
    expect(c.isDebugModuleOn('asset')).toBe(false)
    expect(c.isDebugModuleOn('agent')).toBe(false)
  })

  it('运行时设 window.__DEBUG_ALL=true → 总开关全开（任意模块都开）', async () => {
    const c = await loadConfig();
    globalThis.window.__DEBUG_ALL = true
    // 总开关实时生效：image/asset/agent 全开，无需重载模块
    expect(c.isDebugModuleOn('image')).toBe(true)
    expect(c.isDebugModuleOn('asset')).toBe(true)
    expect(c.isDebugModuleOn('agent')).toBe(true)
  })

  it('关闭总开关（false）→ 恢复关闭', async () => {
    const c = await loadConfig();
    globalThis.window.__DEBUG_ALL = true
    const onTrue = c.isDebugModuleOn('image')
    assert.strictEqual(onTrue, true)
    globalThis.window.__DEBUG_ALL = false
    const onFalse = c.isDebugModuleOn('image')
    assert.strictEqual(onFalse, false)
  })

  it('运行时设 window.__DEBUG_IMAGE=true → 只开 image，不开其它模块（AI 细粒度）', async () => {
    const c = await loadConfig();
    globalThis.window.__DEBUG_IMAGE = true
    expect(c.isDebugModuleOn('image')).toBe(true)
    expect(c.isDebugModuleOn('asset')).toBe(false)
    expect(c.isDebugModuleOn('agent')).toBe(false)
  })

  it('未开总开关时未知模块名 → 关闭', async () => {
    const c = await loadConfig()
    expect(c.isDebugModuleOn('unknown')).toBe(false)
  })
})
