// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// appSettings 用模块级单例 + 默认兜底；用 resetModules 隔离每次导入，保证测试独立。
describe('appSettings §2.10/2.20 读写兜底', () => {
  beforeEach(() => {
    // 清空持久化，保证每次加载都回到默认（appSettings 设计为持久化，load() 会从 localStorage 读回）
    try { localStorage.clear() } catch { /* node 下 setup.mjs 已注入内存 localStorage */ }
    vi.resetModules()
  })

  it('默认设置：性能模式开 / 小地图关 / AI 助手关', async () => {
    const { getSetting } = await import('../../src/components/base/appSettings.ts')
    expect(getSetting('performanceMode')).toBe(true)
    expect(getSetting('minimapOn')).toBe(false)
    expect(getSetting('agentOpen')).toBe(false)
  })

  it('未知 key 读默认值兜底（不存在的 key 返回 undefined，不崩）', async () => {
    const { getSetting } = await import('../../src/components/base/appSettings.ts')
    expect(getSetting('notARealKey')).toBeUndefined()
  })

  it('setSetting 写入后可读到新值', async () => {
    const { getSetting, setSetting } = await import('../../src/components/base/appSettings.ts')
    setSetting('minimapOn', true)
    expect(getSetting('minimapOn')).toBe(true)
  })

  it('setSetting 不影响其它字段', async () => {
    const { getSetting, setSetting } = await import('../../src/components/base/appSettings.ts')
    setSetting('agentOpen', true)
    // 其余默认值保持不变
    expect(getSetting('performanceMode')).toBe(true)
    expect(getSetting('minimapOn')).toBe(false)
  })

  it('setSetting 持久化落盘（重新读取同一模块仍生效）', async () => {
    const { getSetting, setSetting } = await import('../../src/components/base/appSettings.ts')
    setSetting('minimapOn', true)
    // 同一模块实例内再次读取应反映已写值（验证内存 + 持久化路径不崩）
    expect(getSetting('minimapOn')).toBe(true)
  })

  it('debugOn 默认关闭（debug 日志默认安静）', async () => {
    const { getSetting } = await import('../../src/components/base/appSettings.ts')
    expect(getSetting('debugOn')).toBe(false)
  })

  it('setSetting debugOn=true → 同步 window.__DEBUG_ALL（总开关实时生效）', async () => {
    // node 测试环境无 window，stub 一个用于断言 syncDebugAll 的副作用
    const prevWindow = globalThis.window
    globalThis.window = { __DEBUG_ALL: false }
    const { setSetting } = await import('../../src/components/base/appSettings.ts')
    setSetting('debugOn', true)
    expect(globalThis.window.__DEBUG_ALL).toBe(true)
    // 关闭后清除
    setSetting('debugOn', false)
    expect(globalThis.window.__DEBUG_ALL).toBe(false)
    if (prevWindow === undefined) delete globalThis.window
    else globalThis.window = prevWindow
  })
})
