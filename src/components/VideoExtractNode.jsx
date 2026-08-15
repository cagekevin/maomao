import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clapperboard, Copy, Download, Settings, Camera, AlertCircle, Upload, Loader2 } from 'lucide-react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import NodeTitle from './NodeTitle.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { showToast } from './base/toastStore.js'
import { sSet } from './base/storageAdapter.js'

/**
 * 视频抽帧节点（复刻官方 ec.jsx / videoExtractNode）。
 *
 * 结构（与官方 ec.jsx 一致 —— 单容器，无 NodeShell 双层）：
 *   <div relative group/node w-full h-full min-w-[280px]>          ← 根（最外层）
 *     <NodeTitle floating />                                       ← 标题，漂浮在节点顶部（_Component8）
 *     <NodeResizer />                                              ← 缩放手柄（_Component9）
 *     <div bg-surface-raised rounded-xl overflow-hidden border ... flex flex-col>  ← 主容器（Component1463）
 *       <Handle target />                                          ← 端口在主容器内、Component1462 之前
 *       <input type=file hidden />
 *       <div flex-1 flex flex-col overflow-hidden relative>         ← 内容+底部 一体（Component1462）
 *         <div flex-1 bg-surface-black p-4 ...>                           ← 内容区（Component1428）
 *         <div p-4 bg-surface ...>                               ← 底部（Component1461）
 *       </div>
 *       <Handle source />
 *     </div>
 *   </div>
 *
 * 功能：
 *  - 视频来源：上传视频文件 或 从直接上游节点自动获取（videoUrl / imageUrl / text 里的视频链接）
 *  - 5 种抽帧模式：固定数量 / 等距 / 智能转场 / 首尾帧 / 手动截取
 *  - 用 canvas.drawImage 抽帧，输出 JPEG base64 缩略图网格
 *  - 单帧/全部复制（mutiwindow-images 格式，可 Ctrl+V 粘贴成图片节点）
 *  - 带进度条、错误提示
 */
export default function VideoExtractNode({ id, data, selected }) {
  const connected = useConnectedInputs(id)
  const { isHidden } = useMediaDegrade()
  const hideVideo = isHidden('video')

  // 模式与参数
  const [mode, setMode] = useState(data.mode || 'count')
  const [frameCount, setFrameCount] = useState(data.frameCount || 9)
  const [intervalSec, setIntervalSec] = useState(data.intervalSec || 2)
  const [sensitivity, setSensitivity] = useState(data.sensitivity || 30)

  // 视频来源
  const [file, setFile] = useState(null) // 上传的 File
  const [videoUrl, setVideoUrl] = useState(data.videoUrl || '')
  const [videoName, setVideoName] = useState(data.videoName || '')

  // 抽帧结果
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [extractedImages, setExtractedImages] = useState(data.extractedImages || [])

  // 手动模式：播放器 + 帧轨道
  const videoRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const fileInputRef = useRef(null)

  // 从上游自动获取视频链接（对齐官方 ec.jsx 的连接检测）
  const upstreamVideo = connected.videos?.[0]?.url || ''
  useEffect(() => {
    if (file) return // 手动上传优先
    const detected = upstreamVideo || ''
    if (detected && detected !== videoUrl) {
      setVideoUrl(detected)
      setVideoName(extractName(detected))
      setErrorMessage('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamVideo])

  function extractName(url) {
    if (url.startsWith('data:video/')) return 'base64_video.mp4'
    try {
      const u = new URL(url)
      const n = u.pathname.split('/').pop()
      return n && n.includes('.') ? n + u.search : url
    } catch {
      return url
    }
  }

  const onUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setVideoUrl(URL.createObjectURL(f))
    setVideoName(f.name)
    setErrorMessage('')
    setExtractedImages([])
    setProgress(0)
    e.target.value = ''
  }

  // 抽一帧（seek 后 drawImage 到 canvas → base64）
  const seekTo = useCallback((video, time) => {
    return new Promise((resolve, reject) => {
      let done = false
      const onSeeked = () => {
        if (done) return
        done = true
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onErr)
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('Canvas not supported')
          let w = video.videoWidth
          let h = video.videoHeight
          if (w === 0 || h === 0) throw new Error('Video dimensions not available')
          // 限制最大 800，保持比例
          if (w > 800 || h > 800) {
            if (w > h) { h = Math.round(h * 800 / w); w = 800 }
            else { w = Math.round(w * 800 / h); h = 800 }
          }
          canvas.width = w
          canvas.height = h
          ctx.drawImage(video, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        } catch (err) {
          reject(err)
        }
      }
      const onErr = () => {
        if (done) return
        done = true
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onErr)
        reject(new Error('Video load failed'))
      }
      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', onErr)
      video.currentTime = time
    })
  }, [])

  // 智能检测：16×16 缩略图像素差
  const smartCapture = useCallback((video, time) => {
    return new Promise((resolve, reject) => {
      let done = false
      const onSeeked = () => {
        if (done) return
        done = true
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onErr)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 16
          canvas.height = 16
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('Canvas not supported')
          ctx.drawImage(video, 0, 0, 16, 16)
          resolve(ctx.getImageData(0, 0, 16, 16).data)
        } catch (err) { reject(err) }
      }
      const onErr = () => {
        if (done) return
        done = true
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onErr)
        reject(new Error('Video load failed'))
      }
      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', onErr)
      video.currentTime = time
    })
  }, [])

  // 计算抽帧时间点列表
  function computeTimes(duration, mode, count, interval, sens) {
    const times = []
    if (mode === 'count') {
      const n = Math.max(1, count)
      const step = duration / (n + 1)
      for (let i = 1; i <= n; i++) times.push(i * step)
    } else if (mode === 'interval') {
      const step = Math.max(0.5, interval)
      for (let t = step; t < duration; t += step) times.push(t)
    } else if (mode === 'first_last') {
      times.push(0, Math.max(0, duration - 0.1))
    } else if (mode === 'smart') {
      // 0.5s 步进扫描 16×16 像素差
      const threshold = (0.01 + Math.pow((100 - sens) / 100, 2) * 0.24) * 195840
      // 智能模式在主流程里单独处理（需要边扫描边截帧），这里返回空由调用方特殊处理
      return { smart: true, duration, threshold }
    }
    return { smart: false, times }
  }

  const startExtract = async () => {
    if (!videoUrl && !file) {
      showToast('请先上传视频或连接包含视频的节点')
      return
    }
    const src = file ? URL.createObjectURL(file) : videoUrl
    setLoading(true)
    setErrorMessage('')
    setProgress(0)
    setExtractedImages([])
    try {
      const video = document.createElement('video')
      video.src = src
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      await new Promise((res, rej) => {
        video.onloadedmetadata = res
        video.onerror = () => rej(new Error('无法加载视频'))
      })
      const dur = video.duration
      if (!dur || isNaN(dur) || dur === Infinity) throw new Error('无法获取视频时长')

      // 手动模式：引导在播放器中截取
      if (mode === 'manual') {
        setLoading(false)
        showToast('手动模式请直接在上方播放器中截取')
        return
      }

      const times = computeTimes(dur, mode, frameCount, intervalSec, sensitivity)
      const frames = []
      if (times.smart) {
        // 智能转场检测
        const threshold = times.threshold
        let prev = null
        const allTimes = []
        for (let t = 0.5; t < times.duration; t += 0.5) {
          setProgress(Math.round(t / times.duration * 50))
          const data = await smartCapture(video, t)
          if (prev) {
            let diff = 0
            for (let i = 0; i < data.length; i += 4) {
              diff += Math.abs(data[i] - prev[i])
              diff += Math.abs(data[i + 1] - prev[i + 1])
              diff += Math.abs(data[i + 2] - prev[i + 2])
            }
            if (diff > threshold) {
              allTimes.push(t)
              t += 1
              prev = await smartCapture(video, t)
              continue
            }
          }
          prev = data
        }
        if (allTimes.length === 0) allTimes.push(times.duration / 2)
        for (let i = 0; i < allTimes.length; i++) {
          setProgress(50 + Math.round(i / allTimes.length * 50))
          frames.push(await seekTo(video, allTimes[i]))
          setExtractedImages([...frames])
        }
      } else {
        for (let i = 0; i < times.times.length; i++) {
          setProgress(50 + Math.round(i / times.times.length * 50))
          frames.push(await seekTo(video, times.times[i]))
          setExtractedImages([...frames])
        }
      }
      setProgress(100)
      setLoading(false)
      showToast(`抽帧完成！共提取 ${frames.length} 张图片`)
      video.src = ''
      video.load()
    } catch (err) {
      console.error('Frame extraction failed:', err)
      setLoading(false)
      setErrorMessage(err.message || '抽帧失败，可能是视频格式或跨域限制')
    }
  }

  const manualCapture = async () => {
    const v = videoRef.current
    if (!v) return
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas not supported')
      let w = v.videoWidth
      let h = v.videoHeight
      if (w > 800 || h > 800) {
        if (w > h) { h = Math.round(h * 800 / w); w = 800 }
        else { w = Math.round(w * 800 / h); h = 800 }
      }
      canvas.width = w
      canvas.height = h
      ctx.drawImage(v, 0, 0, w, h)
      const img = canvas.toDataURL('image/jpeg', 0.8)
      setExtractedImages((prev) => [...prev, img])
      showToast('已截取当前帧')
    } catch {
      showToast('截取失败，可能是跨域限制或视频未就绪')
    }
  }

  const copySingle = async (img) => {
    try {
      const payload = JSON.stringify({ type: 'mutiwindow-images', images: [img] })
      try { await navigator.clipboard.writeText(payload) }
      catch { sSet('mutiwindow-clipboard', payload) }
      showToast('已复制当前帧，请在空白处粘贴 (Ctrl+V)')
    } catch { showToast('复制失败') }
  }

  const copyAll = async () => {
    if (!extractedImages.length) { showToast('没有提取出的图片可复制'); return }
    try {
      const payload = JSON.stringify({ type: 'mutiwindow-images', images: extractedImages })
      try { await navigator.clipboard.writeText(payload) }
      catch { sSet('mutiwindow-clipboard', payload) }
      showToast(`已复制 ${extractedImages.length} 张图片`)
    } catch { showToast('复制失败') }
  }

  return (
    <div
      className={`relative group/node w-full h-full min-w-[280px] ${mode === 'manual' ? 'min-h-[380px]' : 'min-h-[220px]'}`}
      data-node-id={id}
    >
      {/* 标题（漂浮在节点顶部，不占主容器空间 —— 对齐官方 _Component8） */}
      <NodeTitle defaultTitle="视频抽帧" icon={<Clapperboard size={11} className="text-gray-500" />} floating />

      {/* 缩放手柄（对齐官方 _Component9） */}
      <NodeResizer
        minWidth={280}
        minHeight={mode === 'manual' ? 380 : 220}
        isVisible={!!selected}
        color="#ffffff80"
        lineClassName="opacity-0"
        handleClassName="!text-white/60 hover:!text-blue-400"
      />

      {/* 主容器（单层，对齐官方 Component1463）—— 包住内容+底部+端口 */}
      <div
        className={`w-full h-full bg-surface-raised rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col ${selected ? 'border-edge-strong' : 'border-edge hover:border-edge-muted'}`}
      >
        {/* 左侧输入端口（端口在主容器内、Component1462 之前） */}
        <Handle type="target" position={Position.Left} />

        {/* 隐藏文件输入 */}
        <input type="file" ref={fileInputRef} accept="video/*" style={{ display: 'none' }} onChange={onUpload} />

        {/* 内容+底部 一体容器（对齐官方 Component1462） */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 内容区（对齐官方 Component1428） */}
          <div className="flex-1 bg-surface-black p-4 overflow-y-auto relative border-b border-edge-faint custom-scrollbar nowheel nopan nodrag flex flex-col gap-4">
            {extractedImages.length > 0 && (
              <button
                onClick={copyAll}
                className="absolute top-2 right-2 z-10 text-caption text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded bg-surface-1/90 hover:bg-surface-hover-strong transition-colors cursor-pointer border-none"
              >
                <Copy size={12} /> 复制全部
              </button>
            )}

            {errorMessage && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400 p-4 text-center">
                <AlertCircle size={24} />
                <span className="text-xs break-words">{errorMessage}</span>
              </div>
            )}

            {mode === 'manual' && videoUrl && !errorMessage && (
              <div className="flex flex-col gap-3 bg-surface p-3 rounded-lg border border-edge flex-shrink-0">
                {!hideVideo && (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    crossOrigin="anonymous"
                    className="w-full aspect-video bg-black rounded"
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    playsInline
                    muted
                    controls
                  />
                )}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 0.033) }}
                    className="px-2 py-1.5 bg-surface-hover rounded-md hover:bg-surface-hover-strong text-gray-300 transition-colors cursor-pointer border-none"
                    title="后退1帧"
                  >
                    -1帧
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value) }}
                    className="flex-1 accent-white min-w-0"
                  />
                  <button
                    onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 0.033) }}
                    className="px-2 py-1.5 bg-surface-hover rounded-md hover:bg-surface-hover-strong text-gray-300 transition-colors cursor-pointer border-none"
                    title="前进1帧"
                  >
                    +1帧
                  </button>
                  <button
                    onClick={manualCapture}
                    className="px-4 py-1.5 bg-white hover:bg-gray-200 rounded-md text-black font-medium ml-2 flex-shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer border-none"
                  >
                    <Camera size={14} /> 截取
                  </button>
                </div>
              </div>
            )}

            {!errorMessage && extractedImages.length > 0 ? (
              <div className="flex flex-col h-full gap-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-gray-400 font-medium">已提取 {extractedImages.length} 帧</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 auto-rows-max">
                  {extractedImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="aspect-video bg-black rounded-lg border relative group/img border-edge overflow-hidden"
                    >
                      <img src={img} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); copySingle(img) }}
                          className="p-2 bg-surface-1 hover:bg-white rounded-full text-gray-300 hover:text-black transition-all shadow-lg cursor-pointer border-none"
                          title="复制为新节点 (Ctrl+V粘贴)"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            try {
                              const a = document.createElement('a')
                              a.href = img
                              a.download = `frame-${idx + 1}.jpg`
                              a.click()
                            } catch {}
                          }}
                          className="p-2 bg-surface-1 hover:bg-white rounded-full text-gray-300 hover:text-black transition-all shadow-lg cursor-pointer border-none"
                          title="下载"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !errorMessage && (mode !== 'manual' || !videoUrl) ? (
              <div className="flex items-center justify-center h-full min-h-[120px]">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">正在处理... {progress}%</span>
                    <div className="w-32 h-1 bg-surface-hover-strong rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">等待提取</span>
                )}
              </div>
            ) : null}
          </div>

          {/* 底部（对齐官方 Component1461） */}
          <div className="p-4 bg-surface flex flex-col gap-4 nodrag border-t border-edge-faint">
            {videoUrl ? (
              <div className="w-full flex items-center justify-between bg-surface-black rounded-lg px-3 py-2.5 border border-edge">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Clapperboard size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300 truncate" title={videoName}>{videoName || '已连接视频'}</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-gray-400 hover:text-white flex-shrink-0 ml-2 px-3 py-1.5 bg-surface-1 rounded-md hover:bg-surface-hover-strong transition-colors cursor-pointer border-none"
                >
                  替换视频
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 rounded-xl border-2 border-dashed border-edge bg-surface-black hover:bg-surface hover:border-edge-strong flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
              >
                <div className="p-3 bg-surface-1 rounded-full">
                  <Upload size={18} className="text-gray-400" />
                </div>
                <span className="text-xs text-gray-400 font-medium">点击上传视频或连接节点</span>
              </div>
            )}

            {showConfig && (
              <div className="flex flex-col gap-4 bg-surface-black border border-edge rounded-lg p-4 mt-1">
                <div className="flex flex-col gap-2">
                  <span className="text-caption-sm text-gray-400 font-medium">抽帧模式</span>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors"
                  >
                    <option value="count">固定数量 (均匀分布)</option>
                    <option value="interval">等距抽帧 (间隔秒数)</option>
                    <option value="smart">智能转场检测</option>
                    <option value="first_last">首尾帧 (第一帧和最后一帧)</option>
                    <option value="manual">手动截取 (拖动轨道截取)</option>
                  </select>
                </div>
                {mode === 'count' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-caption-sm text-gray-400 font-medium">提取总张数</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={frameCount}
                      onChange={(e) => setFrameCount(Number(e.target.value))}
                      className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors"
                    />
                  </div>
                )}
                {mode === 'interval' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-caption-sm text-gray-400 font-medium">间隔秒数 (秒)</span>
                    <input
                      type="number"
                      min="0.5"
                      max="3600"
                      step="0.5"
                      value={intervalSec}
                      onChange={(e) => setIntervalSec(Number(e.target.value))}
                      className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors"
                    />
                  </div>
                )}
                {mode === 'smart' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-caption-sm text-gray-400 font-medium">检测敏感度</span>
                      <span className="text-caption-sm text-gray-500">{sensitivity}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={sensitivity}
                      onChange={(e) => setSensitivity(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <span className="text-caption text-gray-500">数值越高越容易触发截图</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center mt-1">
              <button
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border-none ${showConfig ? 'text-white bg-surface-hover-strong' : 'text-gray-400 hover:bg-surface-hover-strong hover:text-white'}`}
                onClick={() => setShowConfig(!showConfig)}
                title="参数配置"
              >
                <Settings size={14} />
                <span className="text-xs font-medium">{showConfig ? '收起配置' : '配置'}</span>
              </button>
              {mode !== 'manual' && (
                <button
                  className={`px-5 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border-none ${!videoUrl || loading ? 'bg-surface-hover text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 shadow-md'}`}
                  onClick={(e) => { e.stopPropagation(); if (videoUrl && !loading) startExtract(); else if (!videoUrl) showToast('请先上传或连接视频') }}
                >
                  {loading ? '正在处理...' : '开始处理'}
                  <Camera size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右侧输出端口 */}
        <Handle type="source" position={Position.Right} id="main-output" />
      </div>
    </div>
  )
}