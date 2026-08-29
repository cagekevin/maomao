// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deepClone, formatTime, debounce, throttle, useDebouncedEffect, createImeInput, createRafBatch, mergeRefImages, buildEffectivePrompt, clampSeconds, clamp, assetLabel, dataUrlToBlob, safeFileName } from '../../src/components/base/utils.js'
import { renderHook } from '@testing-library/react'

describe('deepClone', () => {
  it('深拷贝普通对象，不共享引用', () => {
    const src = { a: 1, b: { c: 2 }, list: [1, 2] }
    const copy = deepClone(src)
    expect(copy).toEqual(src)
    expect(copy).not.toBe(src)
    expect(copy.b).not.toBe(src.b)
    expect(copy.list).not.toBe(src.list)
  })

  it('返回 undefined 时保持 undefined', () => {
    expect(deepClone(undefined)).toBe(undefined)
  })
})

describe('clamp（通用数值钳制）', () => {
  it('区间内原样、越界钳到边界', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
  it('lo/hi 可缺省（半开钳制）', () => {
    expect(clamp(5, 4)).toBe(5) // 缺 hi = +∞
    expect(clamp(3, 4)).toBe(4) // 低于 lo
    expect(clamp(5, undefined, 4)).toBe(4) // 缺 lo = -∞
    expect(clamp(99, undefined, 4)).toBe(4)
  })
})

describe('safeFileName（文件名安全化统一出口）', () => {
  // 行为与 assetStore.safeAssetBase 同源（stripExt + 空白归一 + 非法字符 + 回退）
  it('后续非法字符替换、空白归一', () => {
    expect(safeFileName('a/b\\c')).toBe('a_b_c')
    expect(safeFileName('猫 狗')).toBe('猫_狗')
  })
  it('stripExt 去尾部扩展名；fallback 空回退', () => {
    expect(safeFileName('猫.png', { stripExt: true })).toBe('猫')
    expect(safeFileName('', { fallback: 'asset' })).toBe('asset')
    expect(safeFileName('   ')).toBe('')
  })
})

describe('dataUrlToBlob（dataURL → Blob 统一出口）', () => {
  // jsdom 的 Blob 无 arrayBuffer()，用 FileReader.readAsText 精确读回字节核对
  const blobToText = (bl) =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = reject
      r.readAsText(bl)
    })

  it('base64 dataURL → Blob，type 从 meta 解析、字节精确还原', async () => {
    // 'TQ==' base64 = 单个字节 0x4D('M')
    const bl = dataUrlToBlob('data:image/png;base64,TQ==')
    expect(bl).toBeInstanceOf(Blob)
    expect(bl.type).toBe('image/png')
    expect(bl.size).toBe(1)
    expect(await blobToText(bl)).toBe('M')
  })

  it('显式 mime 覆盖 meta 解析', () => {
    const bl = dataUrlToBlob('data:image/png;base64,TQ==', 'image/jpeg')
    expect(bl.type).toBe('image/jpeg')
  })

  it('meta 无 mime 时回退 octet-stream', () => {
    expect(dataUrlToBlob('data:;base64,TQ==').type).toBe('application/octet-stream')
  })
})

describe('mergeRefImages（多路图片源去重）', () => {
  it('同 id 图片两路进入 → 去重后仅 1 张（保留首次出现）', () => {
    const a = [{ id: 'script-asset-1', url: '/files/a.png' }]
    const b = [{ id: 'script-asset-1', url: '/files/a.png' }, { id: 'script-asset-2', url: '/files/b.png' }]
    expect(mergeRefImages(a, b)).toEqual([
      { id: 'script-asset-1', url: '/files/a.png' },
      { id: 'script-asset-2', url: '/files/b.png' },
    ])
  })

  it('无 id 时按 url 去重；id/url 皆空的项丢弃', () => {
    const g = [{ url: '/x.png' }, { url: '/x.png' }, {}, { url: '/y.png' }]
    expect(mergeRefImages(g)).toEqual([{ url: '/x.png' }, { url: '/y.png' }])
  })

  it('空/非数组入参安全（不抛）', () => {
    expect(mergeRefImages(null, undefined, [])).toEqual([])
    expect(mergeRefImages([], [])).toEqual([])
  })
})

describe('buildEffectivePrompt（本地 prompt + 上游文本合并）', () => {
  it('本地 prompt 在前 + 上游文本去空追加在后，用换行连接', () => {
    expect(buildEffectivePrompt('小猫', [{ text: '白天' }, { text: '  ' }, { text: '草地' }])).toBe('小猫\n白天\n草地')
  })

  it('空文本被 filter；全部为空 → 返回空串', () => {
    expect(buildEffectivePrompt('小猫', [{ text: '  ' }, { text: '' }])).toBe('小猫')
    expect(buildEffectivePrompt('', [{ text: '' }])).toBe('')
    expect(buildEffectivePrompt(undefined, [])).toBe('')
  })

  it('上游文本自身 trim（首尾空格去除）', () => {
    expect(buildEffectivePrompt('', [{ text: '  白天  ' }])).toBe('白天')
  })
})

describe('assetLabel（MaterialStrip onInsert 对象/字符串兼容）', () => {
  it('对象 → 取 label', () => {
    expect(assetLabel({ id: 'img-1', label: '人物', kind: 'image' })).toBe('人物')
  })

  it('字符串 → 原样返回', () => {
    expect(assetLabel('人物')).toBe('人物')
  })

  it('对象缺 label / 空值 → 空串', () => {
    expect(assetLabel({ id: 'img-1' })).toBe('')
    expect(assetLabel(null)).toBe('')
    expect(assetLabel(undefined)).toBe('')
  })
})

describe('clampSeconds（视频时长钳制）', () => {
  it('范围内原样；越界钳到 [4,15]；非法/0 → 下界 4 兜底', () => {
    expect(clampSeconds(10)).toBe(10)
    expect(clampSeconds(3)).toBe(4)
    expect(clampSeconds(99)).toBe(15)
    expect(clampSeconds('abc')).toBe(4)
    expect(clampSeconds('0')).toBe(4)
  })
})

describe('formatTime', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('默认 zh-CN locale（TaskCenter 语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 45))
    const out = formatTime(Date.now())
    expect(out).toContain('2026')
    expect(out).toContain('14:30:45')
  })

  it('mode=time 返回 HH:mm:ss（logger 语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 45))
    expect(formatTime(Date.now(), { mode: 'time' })).toBe('14:30:45')
  })

  it('mode=file 返回 yyyymmdd_HHmmss（filesApi 文件名语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 5))
    expect(formatTime(Date.now(), { mode: 'file' })).toBe('20260818_143005')
  })

  it('非法时间戳返回空串', () => {
    expect(formatTime('invalid', { mode: 'time' })).toBe('')
  })
})

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('延迟执行，多次调用只触发一次', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    d()
    d()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 取消未执行的定时器', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush 立即执行最后一次待提交（失焦/卸载落盘兜底）', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1)
    d(2)
    d(3)
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
    // flush 后再推进窗口：不再重复触发
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('无待提交时 flush 不调用 fn', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d.flush()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('createImeInput（P2/P12 输入提交 IME 门控）', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('连续非组字输入：防抖窗口内只提交 1 次，提交最新值', () => {
    const submit = vi.fn()
    const i = createImeInput(submit, 200)
    i.onChange('a', false)
    i.onChange('ab', false)
    i.onChange('abc', false)
    expect(submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(199)
    expect(submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('abc')
  })

  it('compositionstart~compositionend 组字期间：不提交（即使窗口过了）', () => {
    const submit = vi.fn()
    const i = createImeInput(submit, 200)
    i.onChange('你', true)
    i.onChange('你们', true)
    i.onChange('你们好', true)
    vi.advanceTimersByTime(500)
    expect(submit).not.toHaveBeenCalled()
  })

  it('compositionend 后补提交 1 次（组字完成不丢）', () => {
    const submit = vi.fn()
    const i = createImeInput(submit, 200)
    i.onChange('你', true)
    i.onChange('你们好', true)
    i.onCompositionEnd('你们好')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('你们好')
  })

  it('组字中会取消此前非组字的待提交，结束后只提交组字最终值', () => {
    const submit = vi.fn()
    const i = createImeInput(submit, 200)
    i.onChange('a', false) // 排了一个待提交 'a'
    i.onChange('a你', true) // 组字开始 → 取消 'a' 的待提交
    vi.advanceTimersByTime(500)
    expect(submit).not.toHaveBeenCalled()
    i.onCompositionEnd('a你好')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('a你好')
  })

  it('cancel 取消未执行的提交', () => {
    const submit = vi.fn()
    const i = createImeInput(submit, 200)
    i.onChange('x', false)
    i.cancel()
    vi.advanceTimersByTime(300)
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('立即触发一次，间隔内后续调用节流', () => {
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t()
    expect(fn).toHaveBeenCalledTimes(1)
    t()
    t()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel 取消尾部定时器', () => {
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t()
    t()
    t.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('useDebouncedEffect', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('依赖变化后延迟触发回调', async () => {
    const fn = vi.fn()
    renderHook(() => useDebouncedEffect(fn, [1], 100))
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('condition=false 时跳过，不触发', async () => {
    const fn = vi.fn()
    renderHook(() => useDebouncedEffect(fn, [1], 100, false))
    await vi.advanceTimersByTimeAsync(200)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('createRafBatch（P3 高频事件 rAF 合并原语）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'] })
  })
  afterEach(() => { vi.useRealTimers() })

  it('一帧内多次调用：只执行 1 次，用最后一次入参', () => {
    const fn = vi.fn()
    const b = createRafBatch(fn)
    b(1)
    b(2)
    b(3)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('跨多帧：每帧只执行 1 次，未触发时不重复执行', () => {
    const fn = vi.fn()
    const b = createRafBatch(fn)
    b(1)
    vi.advanceTimersByTime(16)
    b(2)
    b(3)
    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(3)
    // 无新调用的一帧：不再触发
    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('flush：立即执行最后一次（拖拽松手不差一帧）', () => {
    const fn = vi.fn()
    const b = createRafBatch(fn)
    b(1)
    b(2)
    b.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
    // flush 后不再有待执行帧
    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel：丢弃未执行的最后一帧', () => {
    const fn = vi.fn()
    const b = createRafBatch(fn)
    b(1)
    b.cancel()
    vi.advanceTimersByTime(16)
    expect(fn).not.toHaveBeenCalled()
  })
})
