// @vitest-environment jsdom
/**
 * clipboard 单测（批 1-2）。
 * 覆盖：sanitizePastedText 清洗规则（纯函数，重点）、copyText、copyImageToClipboard（含跨域 fallback）、
 * downloadUrl（含 fetch 失败分支）。
 * 策略：jsdom 环境 + vi.stubGlobal 拦截 navigator.clipboard / fetch / URL.createObjectURL / Image。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { sanitizePastedText, copyText, copyImageToClipboard, downloadUrl, downloadBlob } = await import(
  '../../src/components/base/clipboard.js'
)

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

// 不可见字符常量（用 unicode 转义，避免源码中出现裸控制字符）
const ZWSP = '​'      // 零宽空格
const LRM = '‏'       // 左到右标记
const RLM = '‎'       // 右到左标记
const SOFT = '­'     // 软连字符
const BOM = '﻿'       // BOM
const NBSP = ' '     // 不间断空格（全角风格）

describe('clipboard — sanitizePastedText（纯函数）', () => {
  it('空值/假值返回空串', () => {
    expect(sanitizePastedText('')).toBe('')
    expect(sanitizePastedText(null)).toBe('')
    expect(sanitizePastedText(undefined)).toBe('')
  })

  it('去除零宽/不可见字符（BOM/零宽空格/LRM/RLM/软连字符）', () => {
    const raw = 'a' + BOM + ZWSP + 'b' + LRM + 'c' + RLM + 'd' + SOFT
    expect(sanitizePastedText(raw)).toBe('abcd')
  })

  it('统一换行符 → LF', () => {
    expect(sanitizePastedText('a\r\nb')).toBe('a\nb')
    expect(sanitizePastedText('a\rb')).toBe('a\nb')
  })

  it('表格 Tab 分隔 → 空格', () => {
    expect(sanitizePastedText('a\t\tb')).toBe('a b')
  })

  it('连续空格（含全角空格）→ 单个半角空格', () => {
    expect(sanitizePastedText('a   b')).toBe('a b')
    expect(sanitizePastedText('a\u3000\u3000b')).toBe('a b')
  })

  it('行首/行尾多余空格去除', () => {
    expect(sanitizePastedText('  a \n b ')).toBe('a\nb')
  })

  it('压缩 3+ 空行 → 2 个', () => {
    expect(sanitizePastedText('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('整体 trim', () => {
    expect(sanitizePastedText('  hello  ')).toBe('hello')
  })
})

describe('clipboard — copyText', () => {
  it('成功写剪贴板返回 ok', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const res = await copyText('hi')
    expect(res.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hi')
  })

  it('权限失败返回 ok=false 带提示', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const res = await copyText('hi')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('失败')
  })
})

describe('clipboard — copyImageToClipboard', () => {
  function mockImage(ok) {
    vi.stubGlobal('Image', class {
      set src(_v) {
        if (ok) queueMicrotask(() => this.onload && this.onload())
        else queueMicrotask(() => this.onerror && this.onerror(new Error('x')))
      }
      get width() { return 10 }
      get height() { return 10 }
    })
  }

  it('无 url 直接失败', async () => {
    const res = await copyImageToClipboard('')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('没有图片')
  })

  it('成功：canvas→toBlob→ClipboardItem 写入', async () => {
    mockImage(true)
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } })
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} })
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      cb(new Blob(['x'], { type: 'image/png' }))
    }
    globalThis.ClipboardItem = class { constructor(d) { this.items = d } }
    const res = await copyImageToClipboard('http://x/y.png')
    expect(res.ok).toBe(true)
    expect(write).toHaveBeenCalled()
  })

  it('图片加载失败：退化为复制链接（writeText 成功则 ok:true）', async () => {
    mockImage(false)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn(), writeText } })
    const res = await copyImageToClipboard('http://x/y.png')
    expect(res.ok).toBe(true)
    expect(res.msg).toContain('图片链接已复制')
    expect(writeText).toHaveBeenCalledWith('http://x/y.png')
  })
})

describe('clipboard — downloadUrl', () => {
  it('fetch 成功：创建 blob 链接并触发下载', async () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
    vi.stubGlobal('fetch', fetchSpy)
    const createEl = vi.spyOn(document, 'createElement')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: revoke })
    const res = await downloadUrl('http://x/f', 'file.txt')
    expect(fetchSpy).toHaveBeenCalledWith('http://x/f')
    expect(createEl).toHaveBeenCalledWith('a')
    expect(revoke).toHaveBeenCalledWith('blob:u')
    expect(res.ok).toBe(true)
  })

  it('fetch 失败：返回 ok:false 且不抛', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: vi.fn() })
    const res = await downloadUrl('http://x/f')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('下载失败')
  })
})

describe('clipboard — downloadBlob（直接下载已有 Blob）', () => {
  it('有 Blob：创建 a 链接触发下载并释放 URL', async () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    const createEl = vi.spyOn(document, 'createElement')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: revoke })
    const res = await downloadBlob(blob, 'out.txt')
    expect(createEl).toHaveBeenCalledWith('a')
    expect(revoke).toHaveBeenCalledWith('blob:u')
    expect(res.ok).toBe(true)
  })

  it('无 Blob：返回 ok:false 不抛', async () => {
    const res = await downloadBlob(null, 'x.txt')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('没有可下载的内容')
  })

  it('默认文件名 download（未传 filename）', async () => {
    const createEl = vi.spyOn(document, 'createElement')
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: vi.fn() })
    const res = await downloadBlob(new Blob(['x']))
    expect(res.ok).toBe(true)
    const anchor = createEl.mock.results[0]?.value
    expect(anchor?.download).toBe('download')
  })
})
