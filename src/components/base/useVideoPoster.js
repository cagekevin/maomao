import { useState, useEffect } from 'react'

/**
 * 视频首帧封面 hook。
 *
 * 【为什么抽成 hook】
 * 视频节点未播放时要显示「封面」而非破图。官方用 localTool 生成 _frame1.jpg 首帧图；
 * 原型无后端，改为前端本地抓帧：加载视频 → seek 到首帧 → 画到 canvas → 得 dataURL 作封面。
 * 这是独立能力，抽出来供任何视频节点复用（ImageNode / 未来的视频节点）。
 *
 * 【跨域注意】
 * 对无 CORS 头的跨域视频，canvas.toDataURL 会抛「Tainted canvases」→ 抓帧失败，此时
 * 返回空串，调用方回退到视频图标占位。本地上传的 dataURL 视频无此问题。
 *
 * @param {string} url 视频 URL
 * @param {boolean} enabled 是否启用（如视频且非播放态时才抓）
 * @returns {string} posterUrl 首帧封面 dataURL；未就绪/失败为空串
 */
export function useVideoPoster(url, enabled) {
  const [posterUrl, setPosterUrl] = useState('')

  useEffect(() => {
    if (!enabled || !url) { setPosterUrl(''); return }
    let cancelled = false
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    v.onloadeddata = () => {
      try { v.currentTime = 0.05 /* 微调到首帧，部分视频首帧是黑的 */ } catch {}
    }
    v.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        if (!cancelled && dataUrl) setPosterUrl(dataUrl)
      } catch {} // 跨域 canvas 污染时静默失败，回退占位
    }
    v.src = url
    v.load()
    return () => { cancelled = true; v.src = '' }
  }, [url, enabled])

  return posterUrl
}
