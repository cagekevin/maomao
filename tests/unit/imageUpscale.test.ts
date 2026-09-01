// @vitest-environment jsdom
// @ts-nocheck
/**
 * imageUpscale 单测（纯浏览器 canvas 放大）。
 * 覆盖：×2 等比放大、maxOutputSize clamp、锐化开关、输入校验、
 *       失败路径（无 URL / 加载失败 / 无尺寸 / toDataURL 跨域污染）。
 *
 * 关键：upscaleImage(url, { scale, sharpen, maxOutputSize, format })。
 * 解码走 loadImageWithTimeout(new Image())，需 mock HTMLImageElement；
 * 输出走 canvas.getContext + toDataURL。锐化路径会调 getImageData/putImageData，
 * 需 mock 返回可写像素缓冲。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { upscaleImage } = await import('../../src/components/base/imageUpscale.ts')

const fetchMock = globalThis.fetch

// mock HTMLImageElement：onload 同步触发，带 naturalWidth/Height
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

// 记录 canvas 被创建的宽高，供断言放大尺寸
let createdCanvases = []
function installCanvasMock() {
  createdCanvases = []
  HTMLCanvasElement.prototype.getContext = function () {
    if (!this._w) this._w = this.width
    if (!this._h) this._h = this.height
    return {
      fillStyle: '',
      fillRect() {},
      drawImage() {},
      set imageSmoothingEnabled(_v) {},
      get imageSmoothingEnabled() { return true },
      set imageSmoothingQuality(_v) {},
      get imageSmoothingQuality() { return 'high' },
      getImageData() {
        // 返回一个可写的像素缓冲（锐化要 putImageData 回写）
        const len = (this.width * this.height * 4) || 16
        return { data: new Uint8ClampedArray(len) }
      },
      putImageData() {},
    }
  }
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    return `data:${type || 'image/png'};base64,${btoa('fakeupscaled')}`
  }
  // 拦截 width/height setter 记录
  const origCtor = HTMLCanvasElement
  // jsdom 下直接 spy：记录创建尺寸
  const origGetContext = HTMLCanvasElement.prototype.getContext
  // 无法直接拦 width setter，用 Proxy 替代创建
}
// 更可靠：spy document.createElement 里的 canvas，记录其宽高
function trackCanvas() {
  const orig = document.createElement.bind(document)
  const spied = vi.spyOn(document, 'createElement')
  spied.mockImplementation((tag) => {
    const el = orig(tag)
    if (String(tag).toLowerCase() === 'canvas') {
      let _w = 0, _h = 0
      Object.defineProperty(el, 'width', { set(v) { _w = v }, get() { return _w } })
      Object.defineProperty(el, 'height', { set(v) { _h = v }, get() { return _h } })
      createdCanvases.push(el)
    }
    return el
  })
  return spied
}

beforeEach(() => {
  imgSize = { w: 2000, h: 1000 }
  imgFail = false
  createdCanvases = []
  fetchMock.mockClear()
  fetchMock.mockRejectedValue(new Error('no fetch in test'))
  installImageMock()
  installCanvasMock()
  trackCanvas()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('imageUpscale — 输入校验', () => {
  it('空 URL → reject（无图片可放大）', async () => {
    await expect(upscaleImage('')).rejects.toThrow(/无图片可放大/)
  })

  it('scale < 1 → reject', async () => {
    await expect(upscaleImage('blob:x', { scale: 0.5 })).rejects.toThrow(/>= 1/)
  })

  it('图片加载失败 → reject', async () => {
    imgFail = true
    await expect(upscaleImage('blob:x')).rejects.toThrow()
  })

  it('解码后无尺寸 → reject', async () => {
    imgSize = { w: 0, h: 0 }
    await expect(upscaleImage('blob:x')).rejects.toThrow()
  })
})

describe('imageUpscale — ×2 等比放大', () => {
  it('2000×1000 → 4000×2000', async () => {
    const res = await upscaleImage('blob:x', { scale: 2 })
    expect(res.width).toBe(4000)
    expect(res.height).toBe(2000)
    expect(res.blob).toBeInstanceOf(Blob)
  })

  it('scale=3 → 2000×1000 → 6000×3000', async () => {
    const res = await upscaleImage('blob:x', { scale: 3 })
    expect(res.width).toBe(6000)
    expect(res.height).toBe(3000)
  })
})

describe('imageUpscale — maxOutputSize clamp', () => {
  it('scale=2 但 4000 超 3000 上限 → clamp 到 3000×1500', async () => {
    const res = await upscaleImage('blob:x', { scale: 2, maxOutputSize: 3000 })
    expect(res.width).toBe(3000)
    expect(res.height).toBe(1500)
  })

  it('小图不 clamp：400×300 ×2=800 未超 1000 上限', async () => {
    imgSize = { w: 400, h: 300 }
    const res = await upscaleImage('blob:x', { scale: 2, maxOutputSize: 1000 })
    expect(res.width).toBe(800)
    expect(res.height).toBe(600)
  })
})

describe('imageUpscale — 锐化与输出', () => {
  it('默认开启锐化（不抛错）且返回合法 dataURL', async () => {
    const res = await upscaleImage('blob:x', { scale: 2 })
    expect(res.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('sharpen=false 关闭锐化正常返回', async () => {
    const res = await upscaleImage('blob:x', { scale: 2, sharpen: false })
    expect(res.width).toBe(4000)
    expect(res.dataUrl).toMatch(/^data:/)
  })

  it('toDataURL 跨域污染 → throw 明确错误', async () => {
    HTMLCanvasElement.prototype.toDataURL = function () {
      const err = new Error('tainted')
      err.name = 'SecurityError'
      throw err
    }
    await expect(upscaleImage('blob:x', { scale: 2 })).rejects.toThrow(/跨域污染/)
  })
})
