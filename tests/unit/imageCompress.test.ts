// @vitest-environment jsdom
/**
 * imageCompress 单测（批 1）。
 * 覆盖：compressImage 等比缩放（maxSize clamp）、质量/格式入参、白底 JPEG 兜底、
 *       失败路径（无 URL / 图片加载失败 / 解码尺寸缺失 / toDataURL 跨域污染）。
 *
 * 关键：compressImage 真实签名是 compressImage(url, opts) —— 第二个参数为
 *       { quality, format, maxSize }，并非字符串档位（'high'/'low'）。
 * 解码链路走 loadImageWithTimeout(new Image())，故需 mock HTMLImageElement；
 * 输出走 canvas.toDataURL（非 toBlob）；结尾 fetch(src) 取原图体积，
 * 在 jsdom 下需 mock fetch 使 blob 分支快速走 atob 兜底，避免 20s 超时挂起。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { compressImage } = await import('../../src/components/base/utils/imageCompress.ts')

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

// mock HTMLImageElement：onload 同步触发，并带 naturalWidth/Height
let imgSize = { w: 2000, h: 1000 }
let imgFail = false
function installImageMock() {
  // @ts-ignore
  globalThis.Image = class {
    set src(_v) {
      if (imgFail) {
        queueMicrotask(() => this.onerror && this.onerror(new Error('load failed')))
      } else {
        this.naturalWidth = imgSize.w
        this.naturalHeight = imgSize.h
        queueMicrotask(() => this.onload && this.onload())
      }
    }
    get src() { return '' }
    crossOrigin = null
    onload = null
    onerror = null
    naturalWidth = 0
    naturalHeight = 0
  }
}

// mock canvas：getContext 返回含 drawImage/fillRect 的 2d ctx；toDataURL 返回合法 JPEG dataURL
function installCanvasMock() {
  HTMLCanvasElement.prototype.getContext = (function () {
    return {
      fillStyle: '',
      fillRect() {},
      drawImage() {},
    } as unknown as CanvasRenderingContext2D
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    // 返回一段合法 data:image/jpeg;base64, 头 + 占位内容，供 dataUrlToBlob 解析
    return `data:${type || 'image/jpeg'};base64,${btoa('fakeimagedata')}`
  }
}

beforeEach(() => {
  imgSize = { w: 2000, h: 1000 }
  imgFail = false
  fetchMock.mockClear()
  // 让结尾 fetch(src) 快速 reject（src 是 blob: 时 jsdom 无法解析），
  // 触发 atob(src.split(',')[1]) 兜底（blob 无逗号 data 部分 → atob('') → 0）。
  fetchMock.mockRejectedValue(new Error('no fetch in test'))
  installImageMock()
  installCanvasMock()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('imageCompress — 输入校验', () => {
  it('空 URL → reject（无图片可压缩）', async () => {
    await expect(compressImage('', {})).rejects.toThrow(/无图片可压缩/)
  })

  it('图片加载失败 → reject', async () => {
    imgFail = true
    await expect(compressImage('blob:x', { maxSize: 1024 })).rejects.toThrow()
  })

  it('解码后无尺寸 → reject', async () => {
    imgSize = { w: 0, h: 0 }
    await expect(compressImage('blob:x', { maxSize: 1024 })).rejects.toThrow()
  })
})

describe('imageCompress — 等比缩放', () => {
  it('maxSize=1024：最大边 2000 → 缩到 1024，比例保持 512', async () => {
    imgSize = { w: 2000, h: 1000 }
    const res = await compressImage('blob:x', { maxSize: 1024, quality: 0.6 })
    expect(res.width).toBe(1024)
    expect(res.height).toBe(512)
  })

  it('maxSize=1920：2000 → 1920，保持 960', async () => {
    imgSize = { w: 2000, h: 1000 }
    const res = await compressImage('blob:x', { maxSize: 1920 })
    expect(res.width).toBe(1920)
    expect(res.height).toBe(960)
  })

  it('maxSize=2560：4000×2000 → 2560×1280', async () => {
    imgSize = { w: 4000, h: 2000 }
    const res = await compressImage('blob:x', { maxSize: 2560 })
    expect(res.width).toBe(2560)
    expect(res.height).toBe(1280)
  })

  it('小图不放大：原尺寸小于 maxSize 则保持原样', async () => {
    imgSize = { w: 800, h: 600 }
    const res = await compressImage('blob:x', { maxSize: 1024 })
    expect(res.width).toBe(800)
    expect(res.height).toBe(600)
  })

  it('未传 maxSize（默认 0）→ 不缩放，保持原尺寸', async () => {
    imgSize = { w: 1500, h: 900 }
    const res = await compressImage('blob:x', {})
    expect(res.width).toBe(1500)
    expect(res.height).toBe(900)
  })
})

describe('imageCompress — 输出格式', () => {
  it('输出 Blob 且为 image/jpeg（dataURL→Blob 解析）', async () => {
    imgSize = { w: 1000, h: 500 }
    const res = await compressImage('blob:x', { maxSize: 800, format: 'image/jpeg' })
    expect(res.blob).toBeInstanceOf(Blob)
    expect(res.blob.type).toBe('image/jpeg')
    expect(res.width).toBe(800)
    expect(res.height).toBe(400)
  })

  it('toDataURL 跨域污染 → throw 明确错误', async () => {
    HTMLCanvasElement.prototype.toDataURL = function () {
      const err = new Error('tainted')
      err.name = 'SecurityError'
      throw err
    }
    await expect(compressImage('blob:x', { maxSize: 1024 })).rejects.toThrow(/跨域污染/)
  })

  // ── keepOriginalFormat：保持原格式、仅缩尺寸（发送链路压缩专用，避免 JPEG 丢透明）──
  it('keepOriginalFormat=true：/files/*.png → 输出 image/png（保持原格式，不转 JPEG）', async () => {
    imgSize = { w: 3000, h: 1500 }
    // 捕获 canvas.toDataURL 收到的 type，验证沿用 png
    let usedType = ''
    const orig = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type) {
      usedType = type
      return orig.call(this, type)
    }
    const res = await compressImage('/files/a.png', { maxSize: 1920, keepOriginalFormat: true })
    expect(res.width).toBe(1920)
    expect(res.height).toBe(960)
    expect(usedType).toBe('image/png')
    expect(res.dataUrl.startsWith('data:image/png')).toBe(true)
  })

  it('keepOriginalFormat=true：/files/*.jpg → 输出 image/jpeg（按扩展名推断原格式）', async () => {
    imgSize = { w: 2000, h: 1000 }
    let usedType = ''
    const orig = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type) {
      usedType = type
      return orig.call(this, type)
    }
    await compressImage('/files/b.jpg', { maxSize: 1920, keepOriginalFormat: true })
    expect(usedType).toBe('image/jpeg')
  })

  it('keepOriginalFormat=true：data:image/png → 沿用 png；推断不出（blob:）→ 回退 png', async () => {
    imgSize = { w: 1000, h: 500 }
    let usedType = ''
    const orig = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type) {
      usedType = type
      return orig.call(this, type)
    }
    await compressImage('data:image/png;base64,xxx', { maxSize: 1920, keepOriginalFormat: true })
    expect(usedType).toBe('image/png')
    // blob: 无法推断格式 → 回退 png（避免 JPEG 丢透明）
    await compressImage('blob:http://x/abc', { maxSize: 1920, keepOriginalFormat: true })
    expect(usedType).toBe('image/png')
  })

  it('keepOriginalFormat 默认 false → 保持旧行为转 image/jpeg', async () => {
    imgSize = { w: 1000, h: 500 }
    let usedType = ''
    const orig = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type) {
      usedType = type
      return orig.call(this, type)
    }
    await compressImage('/files/a.png', { maxSize: 800 })
    expect(usedType).toBe('image/jpeg')
  })
})
