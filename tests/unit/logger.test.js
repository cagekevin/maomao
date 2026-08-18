// 回归测试：logger.js、config.js 中的 API_BASE
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { API_BASE } from '../../src/components/base/config.js'

// logger 内部有模块级单例去重状态 _lastReport，跨测试会污染。
// 每个测试前 resetModules + 动态 import 拿干净实例，保证去重计时从零开始。
let log, logger
beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../src/components/base/logger.js')
  log = mod.log
  logger = mod.logger
})

describe('config.js §API_BASE 日志与配置', () => {
  it('API_BASE 是字符串且以 http 开头', () => {
    expect(typeof API_BASE).toBe('string')
    expect(API_BASE.startsWith('http')).toBe(true)
  })

  it('API_BASE 指向 localTool 默认地址 127.0.0.1:18080', () => {
    expect(API_BASE).toBe('http://127.0.0.1:18080')
  })

  it('所有 API 层统一从这里取 API_BASE（被引用）', async () => {
    // 硬证据：直接读 API 层源码，断言其 import 语句确实引用了 config.js
    // （videoApi.js 已薄壳化，config 消费方收敛到深模块 proxyGenerate.js）
    const apiFiles = [
      'proxyGenerate.js',
      'tasksApi.js',
      'filesApi.js',
      'kvStore.js',
      'logger.js',
    ]
    for (const f of apiFiles) {
      const src = readFileSync(`src/components/base/${f}`, 'utf8')
      expect(src).toMatch(/config\.js/)
    }
    // 软证据：衍生 API 层能成功 import（依赖解析未断）
    const videoApi = await import('../../src/components/base/videoApi.js')
    const tasksApi = await import('../../src/components/base/tasksApi.js')
    const filesApi = await import('../../src/components/base/filesApi.js')
    expect(videoApi).toBeTruthy()
    expect(tasksApi).toBeTruthy()
    expect(filesApi).toBeTruthy()
  })
})

describe('logger §日志格式', () => {
  let infoSpy, warnSpy, errorSpy, fetchMock

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('level=info 调 console.log，输出含 category/action', () => {
    log('生成', 'start', { nodeId: 'n1' }, 'info')
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const out = infoSpy.mock.calls[0][0]
    expect(out).toContain('[info]')
    expect(out).toContain('生成')
    expect(out).toContain('start')
  })

  it('level=warn 调 console.warn', () => {
    log('项目', 'switch', 'default', 'warn')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('项目')
  })

  it('level=error 调 console.error', () => {
    log('生成', 'fail', 'boom', 'error')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy.mock.calls[0][0]).toContain('fail')
  })

  it('detail 为字符串时直接拼接到输出', () => {
    log('项目', 'new', '定制项目A')
    expect(infoSpy.mock.calls[0][0]).toContain('定制项目A')
  })

  it('detail 为对象时 JSON 序列化拼接', () => {
    log('生成', 'success', { nodeId: 'n1', type: 'image' })
    const out = infoSpy.mock.calls[0][0]
    expect(out).toContain('"nodeId"')
    expect(out).toContain('n1')
  })

  it('detail 为 null/undefined 时不拼接 detail 段', () => {
    log('项目', 'switch', null)
    expect(infoSpy.mock.calls[0][0]).not.toContain(' | undefined')
    log('项目', 'switch', undefined)
    expect(infoSpy.mock.calls[1][0]).not.toContain(' | undefined')
  })

  it('detail 为不可序列化对象时降级为 String（不抛错）', () => {
    const circular = {}
    circular.self = circular
    expect(() => log('生成', 'loop', circular)).not.toThrow()
    expect(infoSpy).toHaveBeenCalledTimes(1)
  })

  it('logger.info/warn/error 便捷方法指向正确 level', () => {
    logger.info('c', 'a', 'x')
    logger.warn('c', 'a', 'y')
    logger.error('c', 'a', 'z')
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('logger §taskId/nodeId 提取', () => {
  let infoSpy, fetchMock

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('从 detail.taskId 提取并上报', () => {
    log('生成', 'start', { taskId: 't-1' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.taskId).toBe('t-1')
  })

  it('从 detail.task_id 提取并上报', () => {
    log('生成', 'start', { task_id: 't-2' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.taskId).toBe('t-2')
  })

  it('从 detail.nodeId 提取并上报', () => {
    log('生成', 'start', { nodeId: 'n-9' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.nodeId).toBe('n-9')
  })

  it('从 detail.node_id 提取并上报', () => {
    log('生成', 'start', { node_id: 'n-8' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.nodeId).toBe('n-8')
  })

  it('无 taskId/nodeId 时上报空串', () => {
    log('项目', 'switch', 'default')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.taskId).toBe('')
    expect(body.nodeId).toBe('')
  })
})

describe('logger §上报去重', () => {
  let infoSpy, fetchMock

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('同一 (category:action:detail) 在 200ms 内只上报一次', () => {
    log('生成', 'start', { nodeId: 'n1' })
    log('生成', 'start', { nodeId: 'n1' })
    log('生成', 'start', { nodeId: 'n1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('不同 detail 不去重，分别上报', () => {
    log('生成', 'start', { nodeId: 'n1' })
    log('生成', 'start', { nodeId: 'n2' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('间隔超过 200ms 后重复 key 会再次上报', () => {
    vi.useFakeTimers()
    log('生成', 'start', { nodeId: 'n1' })
    // 推进时间越过去重窗口（模块内 Date.now 受 fake timers 控制）
    vi.advanceTimersByTime(250)
    log('生成', 'start', { nodeId: 'n1' })
    vi.useRealTimers()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('logger §上报失败静默', () => {
  let infoSpy, errorSpy

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('fetch 拒绝时不抛错（catch 吞掉）', () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')))
    vi.stubGlobal('fetch', fetchMock)
    expect(() => log('生成', 'start', { nodeId: 'n1' })).not.toThrow()
    // 同步即已调用 fetch（fire-and-forget），catch 异步吞掉不冒泡
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetch 抛出同步异常时不抛错', () => {
    const fetchMock = vi.fn(() => { throw new Error('sync boom') })
    vi.stubGlobal('fetch', fetchMock)
    expect(() => log('生成', 'start', { nodeId: 'n1' })).not.toThrow()
  })
})

describe('logger §上报地址与内容', () => {
  let infoSpy, fetchMock

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('上报 POST 到 API_BASE/api/logs，body 含 level/category/action/detail', () => {
    log('生成', 'success', { nodeId: 'n1' }, 'info')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/logs`)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(opts.body)
    expect(body.level).toBe('info')
    expect(body.category).toBe('生成')
    expect(body.action).toBe('success')
    expect(body.detail).toEqual({ nodeId: 'n1' })
  })
})
