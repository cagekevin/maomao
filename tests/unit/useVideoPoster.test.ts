// @vitest-environment jsdom
// @ts-nocheck
/**
 * useVideoPoster 单测（批 3）。
 * 覆盖 useVideoPoster(url, enabled)：
 *   - enabled=false → 不创建 <video>，posterUrl 保持 ''
 *   - enabled=true → 加载视频并 seek 后通过 canvas.toDataURL 产出 poster dataURL
 * 通过 mock document.createElement('video'|'canvas') 触发 onloadeddata→onseeked 时序。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { useVideoPoster } = await import('../../src/hooks/useVideoPoster.ts')

// 仅取一次原生 createElement，避免 beforeEach 重复包装使 orig 指向 wrapper 造成递归
const nativeCreate = document.createElement.bind(document)
let lastVideo = null

beforeEach(() => {
  lastVideo = null
  // jsdom 未实现 media load/play，stub 避免 Not implemented 报错中断 effect
  HTMLMediaElement.prototype.load = function () {}
  HTMLMediaElement.prototype.play = function () { return Promise.resolve() }
  // 全局 canvas mock
  HTMLCanvasElement.prototype.getContext = function () {
    return { fillStyle: '', fillRect() {}, drawImage() {} }
  }
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    return `data:${type || 'image/jpeg'};base64,${btoa('posterframe')}`
  }
  // video 工厂：元素创建后，在下一 tick 触发 loadeddata 再 seeked
  document.createElement = function (tag) {
    if (tag === 'video') {
      const v = nativeCreate('video')
      Object.defineProperty(v, 'src', {
        set(_val) {
          queueMicrotask(() => {
            if (v.onloadeddata) v.onloadeddata({})
          })
        },
        get() { return '' },
        configurable: true,
      })
      const seek = () => { if (v.onseeked) v.onseeked({}) }
      Object.defineProperty(v, 'currentTime', {
        set(_t) { queueMicrotask(seek) },
        get() { return 0 },
        configurable: true,
      })
      lastVideo = v
      return v
    }
    return nativeCreate(tag)
  }
})

describe('useVideoPoster', () => {
  it('enabled=false → 不创建 video，poster 为空串', () => {
    const { result } = renderHook(() => useVideoPoster('http://x/v.mp4', false))
    // hook 直接返回 posterUrl 字符串（非对象）
    expect(result.current).toBe('')
    expect(lastVideo).toBeNull()
  })

  it('enabled=true → seek 后产出 poster dataURL', async () => {
    const { result } = renderHook(() => useVideoPoster('http://x/v.mp4', true))
    // 等待 microtask 链：loadeddata → currentTime setter → seeked → draw → toDataURL
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
    // hook 直接返回 posterUrl 字符串（非对象）
    expect(result.current).toMatch(/^data:image/)
  })
})
