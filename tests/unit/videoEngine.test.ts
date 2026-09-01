/**
 * videoEngine 单元测试（阶段一·算法与逻辑层）
 * 按 C1 可测性优先：WebCodecs/mediabunny 重环境不跑，只测纯逻辑剥离的：
 *  - ProgressController：取消状态、attach/attachOutput 的取消传播
 *  - ConversionCanceled：错误类型
 */
import { describe, it, expect, vi } from 'vitest'
import { ProgressController, ConversionCanceled } from '../../src/components/base/videoEngine.ts'

describe('ConversionCanceled', () => {
  it('是 Error 子类且可携带信息', () => {
    const e = new ConversionCanceled('已取消')
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('已取消')
  })
})

describe('ProgressController - 取消状态', () => {
  it('初始 isCanceled 为 false', () => {
    const c = new ProgressController()
    expect(c.isCanceled).toBe(false)
  })

  it('cancel() 后 isCanceled 为 true', async () => {
    const c = new ProgressController()
    await c.cancel()
    expect(c.isCanceled).toBe(true)
  })
})

describe('ProgressController - attach 取消传播', () => {
  it('attach 时若已取消则立即调用 conversion.cancel()', () => {
    const c = new ProgressController()
    const conv = { cancel: vi.fn() }
    c.canceled = true
    c.attach(conv)
    expect(conv.cancel).toHaveBeenCalled()
  })

  it('attach 时未取消则不调用 cancel', () => {
    const c = new ProgressController()
    const conv = { cancel: vi.fn() }
    c.attach(conv)
    expect(conv.cancel).not.toHaveBeenCalled()
  })

  it('attachOutput 时若已取消则立即调用 output.cancel()', () => {
    const c = new ProgressController()
    const out = { cancel: vi.fn() }
    c.canceled = true
    c.attachOutput(out)
    expect(out.cancel).toHaveBeenCalled()
  })

  it('cancel() 会 await conversion.cancel + output.cancel', async () => {
    const c = new ProgressController()
    const conv = { cancel: vi.fn(async () => 'c') }
    const out = { cancel: vi.fn(async () => 'o') }
    c.attach(conv)
    c.attachOutput(out)
    await c.cancel()
    expect(conv.cancel).toHaveBeenCalled()
    expect(out.cancel).toHaveBeenCalled()
    expect(c.isCanceled).toBe(true)
  })
})
