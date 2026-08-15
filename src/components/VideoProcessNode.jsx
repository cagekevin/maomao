import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Clapperboard, Play, Pause, Scissors, Trash2, Upload,
  Loader2, Music, X, Volume2, VolumeX, Plus, Film, AlertCircle, X as XIcon
} from 'lucide-react'
import { useReactFlow, NodeResizer } from '@xyflow/react'
import NodeTitle from './NodeTitle.jsx'
import CustomHandle from './CustomHandle.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeResize } from './base/hooks.js'
import { showToast } from './base/toastStore.js'
import {
  readVideoMetadata,
  processVideo,
  concatVideos,
  videoToGif,
  formatBytes,
  uploadResult,
  ProgressController,
  ConversionCanceled
} from './base/videoEngine.js'

/* ════════════════════════════════════════════════════════════════
 * 视频处理节点（复刻官方 Gc.jsx + fc.jsx 合并的 videoProcessNode）
 *
 * 五种模式（tab）：
 *  - trim          视频截取（时间轴修剪：入点[ 出点] 分割S 删除Delete，拖动片段/入出点）
 *  - extractAudio  提取音频（m4a / wav / mp3）
 *  - sizeFrameRate 尺寸帧率（480p/720p/1080p 预设 + 宽高 + fps）
 *  - concat        视频拼接（多轨时间线，片段拖动 + 轨道静音 + 新增轨道 + 导出顺序）
 *  - toGif         视频转 GIF（清晰度/帧率/速度/色彩 + 裁剪区间，gifenc 编码）
 *
 * 引擎：mediabunny（WebCodecs）做 trim/extractAudio/sizeFrameRate/concat；
 * gifenc 做视频转 GIF。上传用本地 object URL。
 *
 * 视频来源：上传文件 或 连接上游（connected.videos / images 里的视频）。
 * 端口：target(左) + source main-output(右)。
 * ════════════════════════════════════════════════════════════════ */

const MODES = [
  { value: 'trim', label: '视频截取' },
  { value: 'extractAudio', label: '提取音频' },
  { value: 'sizeFrameRate', label: '尺寸帧率' },
  { value: 'concat', label: '视频拼接' },
  { value: 'toGif', label: '视频转GIF' }
]
const AUDIO_FORMATS = [
  { value: 'm4a', label: 'M4A', hint: '体积小' },
  { value: 'wav', label: 'WAV', hint: '无损' },
  { value: 'mp3', label: 'MP3', hint: '通用' }
]
const SIZE_PRESETS = [
  { label: '480p', width: 854, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 }
]
const FPS_OPTIONS = [24, 25, 30, 60]
const GIF_SIZES = [240, 360, 480, 640, 720] // 清晰度（复刻官方 oc）
const GIF_FPS = [0.5, 1, 2, 3, 5, 8, 10, 12, 15, 20] // 帧率（复刻官方 sc）
const GIF_SPEEDS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 }
]
const GIF_COLORS = [
  { label: '高清 (256色)', value: 256 },
  { label: '标准 (128色)', value: 128 },
  { label: '压缩 (64色)', value: 64 }
]
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v|ogg)(?:$|[?#])/i
const PX_PER_SEC = 36 // 时间线像素比例

const normalizeMode = (m) => {
  if (m === 'resize' || m === 'frameRate') return 'sizeFrameRate'
  if (m === 'trim' || m === 'extractAudio' || m === 'sizeFrameRate' || m === 'concat' || m === 'toGif') return m
  return 'trim'
}
const stripExt = (name) => (name || '').replace(/\.[^.]+$/, '') || 'video'
const formatDuration = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00')
const evenRound = (v) => Math.max(2, Math.round(v / 2) * 2)
const round2 = (v) => Number(v.toFixed(2))
const makeId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const nameFromUrl = (url) => {
  if (url.startsWith('data:')) return 'video.mp4'
  if (url.startsWith('blob:')) return 'local-video.mp4'
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'video.mp4')
  } catch {
    return 'video.mp4'
  }
}

/** 连接源 → 名称（复刻官方 Lc） */
const sourceName = (node, url) => {
  const n = node?.data?.sourceVideoName || node?.data?.videoName || node?.data?.fileName || node?.data?.label || node?.id
  return typeof n === 'string' && n ? n : nameFromUrl(url)
}

/** canvas 抽一帧（复刻官方 _cmp_mc） */
function captureFrame(url, atTime, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = url
    let done = false
    const fail = (msg) => {
      if (done) return
      done = true
      video.removeAttribute('src')
      try { video.load() } catch {}
      reject(new Error(msg))
    }
    const ok = (blob) => {
      if (done) return
      done = true
      video.removeAttribute('src')
      try { video.load() } catch {}
      resolve(blob)
    }
    const grab = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return fail('captureFrame: zero dimensions')
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return fail('captureFrame: no 2d context')
        ctx.drawImage(video, 0, 0, w, h)
        canvas.toBlob((b) => (b ? ok(b) : fail('captureFrame: toBlob null')), 'image/jpeg', quality)
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e))
      }
    }
    video.onerror = () => fail('captureFrame: load error')
    video.onloadeddata = () => {
      const target = Math.min(atTime, Math.max(0, (video.duration || atTime) - 0.01))
      if (Math.abs(video.currentTime - target) < 0.001) grab()
      else {
        video.onseeked = grab
        try { video.currentTime = target } catch { grab() }
      }
    }
  })
}

export default function VideoProcessNode({ id, data, selected }) {
  const { setNodes, getNodes, setEdges } = useReactFlow()
  const { isHidden } = useMediaDegrade()
  const { onMainBoxResize } = useNodeResize(id)
  const contentRef = useRef(null)

  /* ---------- 状态（复刻官方 1-41 行） ---------- */
  const [mode, setMode] = useState(() => normalizeMode(data.mode))
  const [audioFormat, setAudioFormat] = useState(data.audioFormat || 'm4a')
  const [resizeWidth, setResizeWidth] = useState(data.resizeWidth ?? 1280)
  const [resizeHeight, setResizeHeight] = useState(data.resizeHeight ?? 720)
  const [targetFps, setTargetFps] = useState(data.targetFps ?? 30)
  // GIF 参数（复刻官方 fc.jsx：o fps=10 / c maxSize=480 / u colors=256 / f speed=1 / m,g,v 裁剪）
  const [gifFps, setGifFps] = useState(data.gifFps ?? 10)
  const [gifMaxSize, setGifMaxSize] = useState(data.gifMaxSize ?? 480)
  const [gifColors, setGifColors] = useState(data.gifColors ?? 256)
  const [gifSpeed, setGifSpeed] = useState(data.gifSpeed ?? 1)
  const [gifCrop, setGifCrop] = useState(data.gifCrop ?? 0) // m
  const [gifStart, setGifStart] = useState(data.gifStart ?? 0) // g
  const [gifEnd, setGifEnd] = useState(data.gifEnd ?? 0) // v
  const [gifDuration, setGifDuration] = useState(data.gifDuration ?? 0) // h（视频总时长）
  const [gifResult, setGifResult] = useState(data.gifResult || null) // E（resultInfo）
  const [sourceMetadata, setSourceMetadata] = useState(data.sourceMetadata || {})
  const [selectedClipId, setSelectedClipId] = useState(null) // F
  const [playheadTime, setPlayheadTime] = useState(0) // j
  const [isPlaying, setIsPlaying] = useState(false) // N
  const [thumbnails, setThumbnails] = useState({}) // ee {sourceId:[url]}
  const [editingClipId, setEditingClipId] = useState(null) // k
  const [localFile, setLocalFile] = useState(null) // o
  const [localUrl, setLocalUrl] = useState('') // s
  const [timelineTracks, setTimelineTracks] = useState(data.timelineTracks || [])
  const [errorMessage, setErrorMessage] = useState(data.errorMessage || '')

  // refs
  const videoRef = useRef(null) // u
  const scrubRef = useRef(null) // d
  const fileRef = useRef(null) // a
  const metaInFlight = useRef(new Set()) // f
  const thumbUrls = useRef([]) // p
  const isScrubbing = useRef(false) // m
  const controllerRef = useRef(null) // c
  const abortRef = useRef(null) // l
  const timelineWrapRef = useRef(null) // Ne

  /* ---------- 输入源（复刻官方 42-89 行） ---------- */
  const connected = useConnectedInputs(id)
  // 连接源：videos + images 里的视频
  const connectedSources = useMemo(() => {
    const list = []
    const seen = new Set()
    for (const v of connected.videos || []) {
      if (!v?.url) continue
      if (seen.has(v.url)) continue
      seen.add(v.url)
      list.push({ url: v.url })
    }
    for (const im of connected.images || []) {
      if (!im?.url) continue
      const u = im.url
      if (u.startsWith('data:video/') || u.startsWith('blob:') || VIDEO_EXT.test(u)) {
        if (seen.has(u)) continue
        seen.add(u)
        list.push({ url: u })
      }
    }
    return list
  }, [connected])

  // 连接源对象（sourceId = url 去重后的唯一标识）
  const ne = useMemo(() => {
    const srcNodes = new Map()
    for (const n of getNodes()) {
      for (const v of connected.videos || []) if (v.url && n.id === v.id) srcNodes.set(v.url, n)
      for (const im of connected.images || []) if (im.url && n.id === im.id) srcNodes.set(im.url, n)
    }
    const map = new Map()
    for (const s of connectedSources) {
      if (map.has(s.url)) continue
      const node = srcNodes.get(s.url)
      map.set(s.url, { sourceId: s.url, url: s.url, name: sourceName(node, s.url) })
    }
    return Array.from(map.values())
  }, [connectedSources, connected.videos, connected.images, getNodes])

  // 本地上传源（复刻官方 B）
  const localSource = useMemo(() => {
    if (data.sourceVideoUrl && (localUrl || ne.length === 0)) {
      return { sourceId: `local-${id}`, url: data.sourceVideoUrl, name: data.sourceVideoName || nameFromUrl(data.sourceVideoUrl) }
    }
    return null
  }, [data.sourceVideoUrl, data.sourceVideoName, localUrl, ne.length, id])

  // 全部源
  const sources = useMemo(() => {
    if (localSource) return [...ne, localSource]
    return ne
  }, [ne, localSource])

  /* ---------- 时间线轨道（复刻官方 Wc） ---------- */
  const tracks = useMemo(() => {
    const sourceMap = new Map(sources.map((s) => [s.sourceId, s]))
    const usedSourceIds = new Set()
    const built = (timelineTracks || []).map((tr, idx) => {
      const kind = tr.kind || tr.type || 'video'
      const trackId = tr.id || `${kind}-track-${idx + 1}`
      let cursor = 0
      const clips = (tr.clips || tr.segments || []).map((cl) => {
        const src = sourceMap.get(cl.sourceId)
        let dur = sourceMetadata[cl.sourceId]?.duration || cl.duration || cl.sourceEnd || cl.end || 0
        let start = Math.max(0, cl.sourceStart ?? cl.start ?? 0)
        let end = cl.sourceEnd ?? cl.end
        if ((end === 0 || end === cl.duration) && dur > 0 && (cl.duration || 0) === 0) end = dur
        const validEnd = Number.isFinite(end) && end < Number.MAX_SAFE_INTEGER ? Math.min(end, dur || end) : dur
        usedSourceIds.add(cl.sourceId)
        const clipDur = Math.max(0, validEnd - start)
        const tlStart = cl.timelineStart ?? cursor
        cursor = tlStart + clipDur
        return {
          id: cl.id || makeId('clip'),
          sourceId: cl.sourceId,
          url: src?.url || cl.url || cl.sourceUrl || '',
          name: src?.name || cl.name || cl.sourceName || '视频片段',
          sourceStart: start,
          sourceEnd: Math.max(start, validEnd),
          duration: clipDur,
          timelineStart: tlStart,
          muted: !!cl.muted,
          trackId
        }
      })
      return { id: trackId, name: tr.name || tr.label || `${kind === 'video' ? '视频' : '音频'} ${idx + 1}`, kind, clips, muted: !!tr.muted }
    })
    // 确保有视频轨道
    let videoTrack = built.find((t) => t.kind === 'video')
    if (!videoTrack) {
      videoTrack = { id: 'video-track-1', name: '视频 1', kind: 'video', clips: [] }
      built.push(videoTrack)
    }
    // 把有元数据的未用源自动加入视频轨（复刻官方 5443-5466）
    for (const s of sources) {
      if (usedSourceIds.has(s.sourceId)) continue
      const dur = sourceMetadata[s.sourceId]?.duration || 0
      if (dur === 0) continue
      const base = videoTrack.clips.length > 0 ? Math.max(...videoTrack.clips.map((c) => c.timelineStart + c.duration)) : 0
      videoTrack.clips.push({
        id: makeId('clip'),
        sourceId: s.sourceId,
        url: s.url,
        name: s.name,
        sourceStart: 0,
        sourceEnd: dur,
        duration: dur,
        timelineStart: base,
        muted: false,
        trackId: videoTrack.id
      })
    }
    return built
  }, [timelineTracks, sources, sourceMetadata])

  /* 选中片段 + 其所在轨道（复刻官方 ie） */
  const selectedClipInfo = useMemo(() => {
    for (const tr of tracks) {
      const clip = tr.clips.find((c) => c.id === selectedClipId)
      if (clip) return { track: tr, clip }
    }
    return null
  }, [selectedClipId, tracks])

  // 可见视频片段（导出用，复刻官方 ae）：按 timelineStart 排序
  const exportClips = useMemo(
    () =>
      tracks
        .filter((t) => t.kind === 'video')
        .flatMap((t) =>
          [...t.clips]
            .sort((a, b) => a.timelineStart - b.timelineStart)
            .filter((c) => c.url && c.duration > 0)
            .map((c) => ({ ...c, muted: !!t.muted || c.muted }))
        ),
    [tracks]
  )

  const firstVideoClip = tracks.find((t) => t.kind === 'video')?.clips[0] // oe
  const currentClip = selectedClipInfo?.clip || firstVideoClip // H
  const currentUrl = currentClip?.url || sources[0]?.url || ''
  const currentName = currentClip?.name || sources[0]?.name || ''
  const currentMeta = currentClip ? sourceMetadata[currentClip.sourceId] : undefined // U
  const totalDuration = currentMeta?.duration || currentClip?.sourceEnd || 0 // W

  /* ---------- 写回 data（复刻官方 128-162 行） ---------- */
  const updateTracks = useCallback(
    (t) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  timelineTracks: t,
                  sourceOrder: t
                    .filter((e) => e.kind === 'video')
                    .flatMap((e) => e.clips.map((c) => c.sourceId))
                }
              }
            : n
        )
      )
      setTimelineTracks(t)
    },
    [id, setNodes]
  )

  const mutateTracks = useCallback(
    (mutator) => {
      const next = tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c })) }))
      mutator(next)
      updateTracks(next)
    },
    [tracks, updateTracks]
  )

  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? {
              ...n,
              data: { ...n.data, mode, audioFormat, resizeWidth, resizeHeight, targetFps, gifFps, gifMaxSize, gifColors, gifSpeed, gifCrop, gifStart, gifEnd }
            }
          : n
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, audioFormat, resizeWidth, resizeHeight, targetFps, gifFps, gifMaxSize, gifColors, gifSpeed, gifCrop, gifStart, gifEnd, id, setNodes])

  /* ---------- 读元数据（复刻官方 176-209 行） ---------- */
  useEffect(() => {
    for (const s of sources) {
      if (sourceMetadata[s.sourceId] || metaInFlight.current.has(s.sourceId)) continue
      metaInFlight.current.add(s.sourceId)
      ;(async () => {
        try {
          const blob = await fetch(s.url).then((r) => {
            if (!r.ok) throw new Error(`视频读取失败 (${r.status})`)
            return r.blob()
          })
          const meta = await readVideoMetadata(blob)
          setSourceMetadata((prev) => {
            const next = { ...prev, [s.sourceId]: meta }
            setNodes((ns) =>
              ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, sourceMetadata: next, errorMessage: undefined } } : n))
            )
            return next
          })
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : '无法读取视频信息')
        } finally {
          metaInFlight.current.delete(s.sourceId)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sources, setNodes])

  /* ---------- GIF 时长同步（复刻官方 fc.jsx 60-76 行） ---------- */
  const gifSourceMeta = useMemo(() => sources.map((s) => sourceMetadata[s.sourceId]).find(Boolean), [sources, sourceMetadata])
  useEffect(() => {
    const dur = gifSourceMeta?.duration || 0
    if (!dur) return
    setGifDuration(dur)
    if (!gifEnd || gifEnd <= 0 || gifEnd > dur) setGifEnd(dur)
    if (gifStart >= dur - 0.1) setGifStart(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifSourceMeta?.duration])

  /* ---------- 抽缩略图（复刻官方 210-254 行） ---------- */
  useEffect(() => {
    const withMeta = Array.from(
      new Map(sources.filter((s) => sourceMetadata[s.sourceId]?.duration).map((s) => [s.sourceId, s])).values()
    )
    let cancelled = false
    ;(async () => {
      for (const s of withMeta) {
        if (thumbnails[s.sourceId]) continue
        const meta = sourceMetadata[s.sourceId]
        const urls = []
        for (let i = 0; i < 6; i++) {
          try {
            const blob = await captureFrame(s.url, Math.max(0.05, (meta.duration * (i + 0.5)) / 6), 0.55)
            if (cancelled) return
            const u = URL.createObjectURL(blob)
            thumbUrls.current.push(u)
            urls.push(u)
          } catch {
            break
          }
        }
        if (!cancelled && urls.length) setThumbnails((prev) => ({ ...prev, [s.sourceId]: urls }))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sources, setNodes])

  useEffect(() => {
    if (!selectedClipId && firstVideoClip) setSelectedClipId(firstVideoClip.id)
    if (selectedClipId && !selectedClipInfo && firstVideoClip) setSelectedClipId(firstVideoClip.id)
  }, [firstVideoClip, selectedClipId, selectedClipInfo])

  /* ---------- 清理（复刻官方 255-266 行） ---------- */
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      controllerRef.current?.cancel()
      if (localUrl) URL.revokeObjectURL(localUrl)
      thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [localUrl])

  /* ---------- 片段操作（复刻官方 267-362 行） ---------- */
  const updateClip = useCallback(
    (clipId, patch) => {
      mutateTracks((t) => {
        let clip
        let track
        for (const tr of t) {
          const idx = tr.clips.findIndex((c) => c.id === clipId)
          if (idx >= 0) {
            clip = tr.clips[idx]
            track = tr
            break
          }
        }
        Object.assign(clip, patch)
        clip.duration = Math.max(0, clip.sourceEnd - clip.sourceStart)
        if (clip && track && patch.trackId && patch.trackId !== track.id) {
          const target = t.find((e) => e.id === patch.trackId)
          if (target) {
            track.clips = track.clips.filter((c) => c.id !== clipId)
            target.clips.push(clip)
          }
        }
      })
    },
    [mutateTracks]
  )

  const setInPoint = useCallback(() => {
    if (!currentClip) return
    const v = round2(Math.max(0, Math.min(playheadTime, currentClip.sourceEnd - 0.05)))
    updateClip(currentClip.id, { sourceStart: v })
  }, [currentClip, playheadTime, updateClip])

  const setOutPoint = useCallback(() => {
    if (!currentClip) return
    const meta = sourceMetadata[currentClip.sourceId]?.duration || currentClip.sourceEnd
    const v = round2(Math.min(meta, Math.max(playheadTime, currentClip.sourceStart + 0.05)))
    updateClip(currentClip.id, { sourceEnd: v })
  }, [currentClip, playheadTime, sourceMetadata, updateClip])

  const splitAtPlayhead = useCallback(() => {
    if (!currentClip || playheadTime <= currentClip.sourceStart + 0.01 || playheadTime >= currentClip.sourceEnd - 0.01) return
    const v = round2(playheadTime)
    mutateTracks((t) => {
      const track = t.find((e) => e.clips.some((c) => c.id === currentClip.id))
      if (!track) return
      const idx = track.clips.findIndex((c) => c.id === currentClip.id)
      const original = track.clips[idx]
      const a = { ...original, sourceEnd: v, duration: v - original.sourceStart }
      const b = { ...original, id: makeId('clip'), sourceStart: v, duration: original.sourceEnd - v }
      track.clips.splice(idx, 1, a, b)
      setSelectedClipId(b.id)
    })
  }, [currentClip, playheadTime, mutateTracks])

  const removeClip = useCallback(() => {
    if (selectedClipInfo) {
      mutateTracks((t) => {
        const track = t.find((e) => e.id === selectedClipInfo.track.id)
        if (track) track.clips = track.clips.filter((c) => c.id !== selectedClipInfo.clip.id)
      })
      setSelectedClipId('')
    }
  }, [selectedClipInfo, mutateTracks])

  /* ---------- 键盘快捷键（复刻官方 363-388 行） ---------- */
  useEffect(() => {
    if (mode !== 'trim' && mode !== 'concat') return
    const onKey = (e) => {
      if (e.target?.matches('input, textarea, select')) return
      if (e.key === '[') {
        e.preventDefault()
        setInPoint()
      } else if (e.key === ']') {
        e.preventDefault()
        setOutPoint()
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        splitAtPlayhead()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeClip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setInPoint, setOutPoint, splitAtPlayhead, removeClip])

  /* ---------- 播放头 / scrubber（复刻官方 389-454 行） ---------- */
  const snapTolerance = Math.max(0.08, totalDuration * 0.012)
  const snapTo = useCallback(
    (v, targets) => {
      let best = null
      for (const t of targets) {
        const dist = Math.abs(t - v)
        if (!best || dist < best.distance) best = { value: t, distance: dist }
      }
      if (best && best.distance <= snapTolerance) return best.value
      return v
    },
    [snapTolerance]
  )

  const setPlayhead = useCallback(
    (v) => {
      const targets = currentClip ? [currentClip.sourceStart, currentClip.sourceEnd] : []
      const clamped = Math.max(0, Math.min(totalDuration, snapTo(v, targets)))
      setPlayheadTime(clamped)
      if (videoRef.current && videoRef.current.src === currentUrl) videoRef.current.currentTime = clamped
    },
    [currentClip, totalDuration, snapTo, currentUrl]
  )

  const onScrubPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPlayhead(((e.clientX - rect.left) / rect.width) * totalDuration)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onDragTrimHandle = (e, side) => {
    e.preventDefault()
    e.stopPropagation()
    const clip = currentClip
    const rect = scrubRef.current?.getBoundingClientRect()
    if (!rect || !clip || !totalDuration) return
    const move = (ev) => {
      const v = round2(snapTo(Math.max(0, Math.min(totalDuration, ((ev.clientX - rect.left) / rect.width) * totalDuration)), [playheadTime]))
      if (side === 'start') updateClip(clip.id, { sourceStart: Math.min(v, clip.sourceEnd - 0.05) })
      else updateClip(clip.id, { sourceEnd: Math.max(v, clip.sourceStart + 0.05) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    move(e.nativeEvent)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    window.addEventListener('pointercancel', up, { once: true })
  }

  /* ---------- 片段拖动（复刻官方 455-508 行） ---------- */
  const onDragClip = (e, clipId) => {
    e.preventDefault()
    e.stopPropagation()
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
    if (!clip) return
    const startX = e.clientX
    const startTimeline = clip.timelineStart
    const move = (ev) => {
      const dx = (ev.clientX - startX) / PX_PER_SEC
      const candidate = Math.max(0, startTimeline + dx)
      const snapTargets = [0, playheadTime, ...tracks.flatMap((t) => t.clips.filter((c) => c.id !== clipId).flatMap((c) => [c.timelineStart, c.timelineStart + c.duration]))]
      const a = snapTo(candidate, snapTargets)
      const b = snapTo(candidate + clip.duration, snapTargets)
      const moved = Math.abs(a - candidate) <= Math.abs(b - (candidate + clip.duration)) ? a : b - clip.duration
      const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.getAttribute('data-track-id'))
      const newTrackId = el ? el.getAttribute('data-track-id') : undefined
      updateClip(clipId, {
        timelineStart: round2(Math.max(0, moved)),
        ...(newTrackId ? { trackId: newTrackId } : {})
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    window.addEventListener('pointercancel', up, { once: true })
  }

  /* ---------- 播放 / 上传 / 新增轨道（复刻官方 509-545 行） ---------- */
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play()
      else videoRef.current.pause()
    }
  }

  const addTrack = () => {
    updateTracks([
      ...tracks,
      { id: makeId('video-track'), name: `视频 ${tracks.filter((t) => t.kind === 'video').length + 1}`, kind: 'video', clips: [] }
    ])
  }

  const onUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (localUrl) URL.revokeObjectURL(localUrl)
    const url = URL.createObjectURL(file)
    setLocalFile(file)
    setLocalUrl(url)
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, sourceVideoUrl: url, sourceVideoName: file.name, errorMessage: undefined } } : n
      )
    )
    e.target.value = ''
  }

  /* ---------- 处理（复刻官方 546-707 行） ---------- */
  const fail = useCallback(
    (msg) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, loading: false, errorMessage: msg } } : n)))
      showToast(msg)
    },
    [id, setNodes]
  )

  const spawnVideoNode = useCallback(
    (url, name) => {
      const me = getNodes().find((n) => n.id === id)
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60
      const baseY = me?.position.y ?? 100
      const nid = `video-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setNodes((ns) =>
        ns.concat([
          {
            id: nid,
            type: 'discountVideoNode',
            position: { x: baseX, y: baseY },
            data: { videoUrl: url, label: name, expanded: true, prompt: '' },
            style: { width: 420, height: 380 }
          }
        ])
      )
      setEdges((es) => es.concat([{ id: `e-${id}-${nid}`, source: id, target: nid, sourceHandle: 'main-output' }]))
    },
    [id, getNodes, setNodes, setEdges]
  )

  const spawnAudioNode = useCallback(
    (url, name) => {
      const me = getNodes().find((n) => n.id === id)
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60
      const baseY = me?.position.y ?? 100
      const nid = `audio-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setNodes((ns) =>
        ns.concat([
          {
            id: nid,
            type: 'imageNode',
            position: { x: baseX, y: baseY },
            // mediaType:'audio'：blob 音频 URL 无扩展名/前缀，靠显式类型让 imageNode 正确渲染音频
            data: { imageUrl: url, mediaType: 'audio', label: name, expanded: false },
            style: { width: 320, height: 200 }
          }
        ])
      )
      setEdges((es) => es.concat([{ id: `e-${id}-${nid}`, source: id, target: nid, sourceHandle: 'main-output' }]))
    },
    [id, getNodes, setNodes, setEdges]
  )

  // GIF 结果 spawn 成图片节点（gif 是图片，mediaType:'image'）
  const spawnGifNode = useCallback(
    (url, name) => {
      const me = getNodes().find((n) => n.id === id)
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60
      const baseY = me?.position.y ?? 100
      const nid = `gif-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setNodes((ns) =>
        ns.concat([
          {
            id: nid,
            type: 'imageNode',
            position: { x: baseX, y: baseY },
            data: { imageUrl: url, mediaType: 'image', label: name, expanded: false },
            style: { width: 360, height: 260 }
          }
        ])
      )
      setEdges((es) => es.concat([{ id: `e-${id}-${nid}`, source: id, target: nid, sourceHandle: 'main-output' }]))
    },
    [id, getNodes, setNodes, setEdges]
  )

  const handleProcess = useCallback(async () => {
    const isConcat = mode === 'concat'
    const clips = mode === 'trim' ? exportClips.filter((c) => c.sourceId === currentClip?.sourceId) : exportClips
    if (isConcat && clips.length < 2) {
      fail('视频拼接至少需要 2 个可见视频片段')
      return
    }
    if (mode === 'trim' && clips.length === 0) {
      fail('时间线中没有可导出的片段')
      return
    }
    if (mode !== 'concat' && mode !== 'trim' && !currentUrl) {
      fail('请先上传视频或连接包含视频的节点')
      return
    }
    if (mode === 'sizeFrameRate' && (resizeWidth <= 0 || resizeHeight <= 0 || targetFps <= 0)) {
      fail('宽度、高度和帧率必须为正数')
      return
    }
    if (mode === 'toGif') {
      if (!currentUrl) {
        fail('请先上传视频或连接包含视频的节点')
        return
      }
      if (gifCrop && gifStart >= gifEnd) {
        fail('裁剪区间无效：开始时间必须小于结束时间')
        return
      }
    }

    const outW = evenRound(resizeWidth)
    const outH = evenRound(resizeHeight)
    const controller = new ProgressController()
    const abort = new AbortController()
    controllerRef.current = controller
    abortRef.current = abort
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, loading: true, progress: 0, errorMessage: undefined, videoUrl: undefined, audioUrl: undefined } }
          : n
      )
    )
    try {
      let result
      if (mode === 'toGif') {
        // 视频转 GIF：输入是 URL（videoToGif 内部用 video 元素加载），无需 blob 下载
        const gif = await videoToGif(currentUrl, {
          fps: gifFps,
          maxSize: gifMaxSize,
          colors: gifColors,
          speed: gifSpeed,
          startTime: gifCrop ? gifStart : 0,
          endTime: gifCrop ? gifEnd : undefined,
          onProgress: (p) =>
            setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, progress: Math.round(p * 100) } } : n)))
        })
        const url = URL.createObjectURL(gif.blob)
        const outputName = `${stripExt(currentName || 'video')}_gif.gif`
        setNodes((ns) =>
          ns.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    loading: false,
                    progress: 100,
                    errorMessage: undefined,
                    gifResult: { width: gif.width, height: gif.height, frameCount: gif.frameCount, size: gif.size },
                    outputName
                  }
                }
              : n
          )
        )
        setGifResult({ width: gif.width, height: gif.height, frameCount: gif.frameCount, size: gif.size })
        spawnGifNode(url, outputName)
        showToast('GIF 生成完成')
        return
      } else if (isConcat) {
        const blobs = []
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i]
          const blob = localFile && clip.url === localUrl ? localFile : await fetch(clip.url, { signal: abort.signal }).then((r) => {
            if (!r.ok) throw new Error(`第 ${i + 1} 个片段下载失败 (${r.status})`)
            return r.blob()
          })
          blobs.push(blob)
          setNodes((ns) =>
            ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, progress: Math.round(((i + 1) / clips.length) * 20) } } : n))
          )
        }
        result = await concatVideos(blobs, {
          segments: clips.map((c) => ({ start: c.sourceStart, end: c.sourceEnd, muted: c.muted })),
          controller,
          onProgress: (p) =>
            setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, progress: 20 + Math.round(p * 80) } } : n)))
        })
      } else {
        const clip = mode === 'trim' ? clips[0] : undefined
        const src = currentUrl
        const blob = localFile && src === localUrl ? localFile : await fetch(src, { signal: abort.signal }).then((r) => {
          if (!r.ok) throw new Error('视频下载失败')
          return r.blob()
        })
        const baseOpts = {
          controller,
          onProgress: (p) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, progress: Math.round(p * 100) } } : n)))
        }
        let opts
        if (mode === 'trim') opts = { mode, start: clip.sourceStart, end: clip.sourceEnd, ...baseOpts }
        else if (mode === 'extractAudio') opts = { mode, format: audioFormat, ...baseOpts }
        else opts = { mode, width: outW, height: outH, fps: targetFps, ...baseOpts }
        result = await processVideo(blob, opts)
      }

      const uploaded = await uploadResult(result.blob, { subfolder: 'canvas/video-process' })
      const count = clips.length
      const suffix = mode === 'trim' ? (count > 1 ? `trimmed_${count}_clips` : 'trimmed') : mode === 'extractAudio' ? 'audio' : mode === 'sizeFrameRate' ? `${outW}x${outH}_${targetFps}fps` : `merged_${count}_clips`
      const outputName = `${stripExt(currentName || 'video')}_${suffix}.${result.extension}`
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  loading: false,
                  progress: 100,
                  errorMessage: undefined,
                  videoUrl: undefined,
                  audioUrl: undefined,
                  outputName,
                  outputInfo: {
                    duration: result.metadata.duration,
                    width: mode === 'extractAudio' ? undefined : result.metadata.width,
                    height: mode === 'extractAudio' ? undefined : result.metadata.height,
                    fps: mode === 'extractAudio' ? undefined : result.metadata.fps,
                    size: result.blob.size
                  }
                }
              }
            : n
        )
      )
      if (mode === 'extractAudio') {
        spawnAudioNode(uploaded.url, outputName)
        showToast('音频提取完成')
      } else {
        spawnVideoNode(uploaded.url, outputName)
        showToast(mode === 'concat' ? '视频拼接完成' : '视频处理完成')
      }
    } catch (e) {
      if (e instanceof ConversionCanceled || abort.signal.aborted || controller.isCanceled) {
        setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, loading: false, progress: 0, errorMessage: undefined } } : n)))
      } else {
        fail(e instanceof Error ? e.message : '视频处理失败')
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (abortRef.current === abort) abortRef.current = null
    }
  }, [mode, exportClips, currentClip, currentUrl, resizeWidth, resizeHeight, targetFps, audioFormat, gifFps, gifMaxSize, gifColors, gifSpeed, gifCrop, gifStart, gifEnd, localFile, localUrl, currentName, id, setNodes, fail, spawnVideoNode, spawnAudioNode, spawnGifNode])

  const loading = data.loading
  const inputCls = 'nodrag nowheel w-full h-8 bg-surface-1 border border-edge-raised rounded-md px-2 text-caption-sm text-gray-200 outline-none focus:border-[#777]'
  const presetCls = 'nodrag h-8 px-2 rounded-md border border-edge-raised bg-surface-active text-caption text-gray-300 hover:bg-[#303030] transition-colors disabled:opacity-35 disabled:cursor-not-allowed'
  const smallBtnCls = 'nodrag h-7 min-w-7 px-1.5 rounded border border-[#3b3b3b] bg-[#272727] text-gray-400 flex items-center justify-center hover:text-white disabled:opacity-30'

  const playheadPct = totalDuration ? (playheadTime / totalDuration) * 100 : 0
  const inPct = totalDuration && currentClip ? (currentClip.sourceStart / totalDuration) * 100 : 0
  const outPct = totalDuration && currentClip ? (currentClip.sourceEnd / totalDuration) * 100 : 100
  const canRun = mode === 'concat' ? exportClips.length >= 2 : mode === 'trim' ? exportClips.length > 0 : !!currentUrl

  /* ---------- 时间线总长（复刻官方 Me） ---------- */
  const timelineTotal = useMemo(() => {
    let max = 0
    for (const t of tracks) for (const c of t.clips) {
      const end = c.timelineStart + c.duration
      if (end > max) max = end
    }
    return max
  }, [tracks])

  const timelineWidth = Math.max(100, timelineTotal * PX_PER_SEC + 100)
  const playheadX = playheadTime * PX_PER_SEC

  /* 同步横向滚动（复刻官方 Pe） */
  const syncScroll = (e) => {
    const left = e.currentTarget.scrollLeft
    if (timelineWrapRef.current) {
      timelineWrapRef.current.querySelectorAll('.timeline-container').forEach((el) => {
        if (el !== e.currentTarget) el.scrollLeft = left
      })
    }
  }

  /* 点击时间线定位（复刻官方 Le） */
  const onTimelinePointer = (e) => {
    if (!videoRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = Math.max(0, (e.clientX - rect.left) / PX_PER_SEC)
    for (const tr of tracks) {
      if (tr.kind !== 'video') continue
      const clip = tr.clips.find((c) => t >= c.timelineStart && t <= c.timelineStart + c.duration)
      if (clip) {
        if (selectedClipId !== clip.id) {
          setSelectedClipId(clip.id)
          const srcT = clip.sourceStart + (t - clip.timelineStart)
          if (videoRef.current.src !== clip.url) {
            videoRef.current.src = clip.url
            const setTime = () => {
              if (videoRef.current) {
                videoRef.current.currentTime = srcT
                videoRef.current.removeEventListener('loadedmetadata', setTime)
              }
            }
            videoRef.current.addEventListener('loadedmetadata', setTime)
          } else {
            videoRef.current.currentTime = srcT
          }
        } else {
          videoRef.current.currentTime = clip.sourceStart + (t - clip.timelineStart)
        }
        setPlayheadTime(t)
        return
      }
    }
    setPlayheadTime(t)
  }

  /* 时间线片段缩略图组件（复刻官方 Re） */
  const renderClipThumb = (clip) => {
    const imgs = thumbnails[clip.sourceId] || []
    return (
      <div
        key={clip.id}
        className="absolute top-1 h-12 z-10"
        style={{ left: clip.timelineStart * PX_PER_SEC, width: clip.duration * PX_PER_SEC }}
        onPointerDown={(e) => {
          e.stopPropagation()
          setSelectedClipId(clip.id)
          onDragClip(e, clip.id)
        }}
      >
        <div
          onDoubleClick={() => {
            setEditingClipId(clip.id)
            setSelectedClipId(clip.id)
          }}
          className={`nodrag relative w-full h-full overflow-hidden border cursor-grab active:cursor-grabbing ${selectedClipId === clip.id ? 'border-white z-10' : 'border-[#505050]'}`}
        >
          <div className="absolute inset-0 flex">
            {(imgs.length ? imgs : [undefined, undefined, undefined]).map((u, i) =>
              u ? (
                <img key={u} src={u} draggable={false} onDragStart={(e) => e.preventDefault()} className="h-full min-w-0 flex-1 object-cover pointer-events-none select-none" />
              ) : (
                <div key={i} className="flex-1 bg-[#383838]" />
              )
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-5 px-1 flex items-center gap-1 bg-black/70 text-meta text-white">
            <span className="truncate">{clip.name}</span>
            <span className="ml-auto shrink-0 tabular-nums">{clip.duration.toFixed(1)}s</span>
          </div>
        </div>
      </div>
    )
  }

  /* 高度自适应（复刻 GridMergeNode 用法） */
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      if (!h) return
      const n = getNodes().find((x) => x.id === id)
      const curH = n?.height ?? n?.style?.height ?? 0
      if (Math.abs(h - curH) < 4) return
      const curW = n?.width ?? n?.style?.width ?? 540
      onMainBoxResize(Math.round(curW), Math.max(620, Math.round(h)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [id, getNodes, onMainBoxResize])

  /* ---------- trim 模式的入出点 scrubber（复刻官方 ze） ---------- */
  const trimScrubber = currentClip && (
    <div className="p-2">
      <div
        ref={scrubRef}
        className="relative h-16 overflow-hidden bg-[#303030] cursor-crosshair touch-none select-none"
        onPointerDown={onScrubPointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) onScrubPointer(e)
        }}
      >
        <div className="absolute inset-0 flex">
          {(thumbnails[currentClip.sourceId] || []).map((u) => (
            <img key={u} src={u} draggable={false} onDragStart={(e) => e.preventDefault()} className="min-w-0 flex-1 object-cover pointer-events-none select-none" />
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 bg-black/65 pointer-events-none" style={{ width: `${inPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/65 pointer-events-none" style={{ width: `${100 - outPct}%` }} />
        <div className="absolute inset-y-0 border-y-2 border-white/90 pointer-events-none" style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }} />
        <button
          type="button"
          aria-label="拖动入点"
          title="拖动片段头部设置入点；靠近播放头时自动吸附"
          onPointerDown={(e) => onDragTrimHandle(e, 'start')}
          className="nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40"
          style={{ left: `${inPct}%` }}
        >
          <span className="absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60" />
        </button>
        <button
          type="button"
          aria-label="拖动出点"
          title="拖动片段尾部设置出点；靠近播放头时自动吸附"
          onPointerDown={(e) => onDragTrimHandle(e, 'end')}
          className="nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40"
          style={{ left: `${outPct}%` }}
        >
          <span className="absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60" />
        </button>
        <div className="absolute inset-y-0 z-10 w-px bg-red-400 pointer-events-none" style={{ left: `${playheadPct}%` }}>
          <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400" />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-meta text-gray-500 tabular-nums">
        <span>入点 {currentClip.sourceStart.toFixed(2)}s</span>
        <span>片段 {currentClip.duration.toFixed(2)}s</span>
        <span>出点 {currentClip.sourceEnd.toFixed(2)}s</span>
      </div>
    </div>
  )

  return (
    <div className={`relative group/node w-full h-full min-w-[520px] min-h-[620px]`} data-node-id={id}>
      <NodeTitle defaultTitle="视频处理" icon={<Clapperboard size={11} className="text-gray-500" />} floating />
      <NodeResizer
        minWidth={520}
        minHeight={620}
        isVisible={!!selected}
        color="#ffffff80"
        lineClassName="opacity-0"
        handleClassName="!text-white/60 hover:!text-blue-400"
      />
      <CustomHandle position="left" handleId="default" variant="small" />
      <div
        className={`w-full h-full bg-[#1b1b1b] rounded-lg overflow-hidden border shadow-xl flex flex-col drag-handle cursor-move ${selected ? 'border-[#666]' : 'border-[#343434] hover:border-[#484848]'}`}
      >
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onUpload} />
        <div ref={contentRef} className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar nowheel">
          {/* 模式切换 */}
          <div className="grid grid-cols-5 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                disabled={loading}
                className={`nodrag h-8 rounded-md border text-caption leading-tight px-0.5 ${mode === m.value ? 'bg-inverse text-inverse-strong border-[#ededed]' : 'bg-surface-subtle text-gray-400 border-edge-raised hover:text-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 视频预览 */}
          {currentUrl ? (
            <div className="relative bg-black rounded-md overflow-hidden border border-[#303030]">
              {!isHidden('video') && (
                <video
                  ref={videoRef}
                  src={currentUrl}
                  controls={mode !== 'trim' && mode !== 'concat'}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={(e) => {
                    if (!isScrubbing.current) {
                      if (mode === 'concat') {
                        if (isPlaying && currentClip) setPlayheadTime(currentClip.timelineStart + Math.max(0, e.currentTarget.currentTime - currentClip.sourceStart))
                      } else {
                        setPlayheadTime(e.currentTarget.currentTime)
                      }
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="nodrag nowheel w-full aspect-video object-contain"
                />
              )}
              {mode !== 'concat' && (
                <button
                  onClick={() => fileRef.current?.click()}
                  title="替换视频"
                  className="nodrag absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded bg-black/75 text-gray-200"
                >
                  <Upload size={13} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="nodrag aspect-video rounded-md border border-dashed border-edge-raised flex items-center justify-center gap-2 text-gray-500 hover:text-gray-200"
            >
              <Upload size={18} />
              <span className="text-caption-sm">上传视频或连接视频节点</span>
            </button>
          )}

          {/* 视频信息 */}
          {currentUrl && (
            <div className="flex justify-between gap-2 text-caption text-gray-500">
              <span className="truncate">{currentName}</span>
              <span className="shrink-0 tabular-nums">
                {currentMeta ? `${formatDuration(currentMeta.duration)} · ${currentMeta.width}×${currentMeta.height} · ${currentMeta.fps.toFixed(2)} fps` : '读取信息中...'}
              </span>
            </div>
          )}

          {/* 时间线面板（trim/concat） */}
          {(mode === 'trim' || mode === 'concat') && (
            <div className="nodrag nowheel rounded-md border border-edge bg-[#202020] overflow-hidden flex flex-col min-h-0 shrink-0">
              {/* 控制栏 */}
              <div className="h-9 px-2 flex shrink-0 items-center gap-1 border-b border-edge">
                <button className={smallBtnCls} title={isPlaying ? '暂停' : '播放'} onClick={togglePlay} disabled={!currentUrl}>
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button className={smallBtnCls} title="在播放头设置入点 ([" onClick={setInPoint} disabled={!currentClip}>[</button>
                <button className={smallBtnCls} title="在播放头设置出点 (])" onClick={setOutPoint} disabled={!currentClip}>]</button>
                <button className={smallBtnCls} title="在播放头分割 (S)" onClick={splitAtPlayhead} disabled={!currentClip}>
                  <Scissors size={13} />
                </button>
                <button className={smallBtnCls} title="删除选中片段 (Delete)" onClick={removeClip} disabled={!selectedClipInfo}>
                  <Trash2 size={13} />
                </button>
                <span className="ml-auto text-caption text-gray-400 tabular-nums">{playheadTime.toFixed(2)}s</span>
              </div>

              {/* trim：入出点 scrubber */}
              {mode === 'trim' && trimScrubber}

              {/* concat：多轨时间线 */}
              {mode === 'concat' && (
                <div ref={timelineWrapRef} className="max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 space-y-1 relative">
                  {/* 播放头（绝对定位到滚动容器） */}
                  <div
                    className="absolute top-1.5 bottom-0 z-20 w-px bg-red-400 pointer-events-none transition-transform duration-75"
                    style={{ transform: `translateX(${playheadX}px)`, left: '102px' }}
                  >
                    <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400" />
                  </div>
                  {tracks.map((tr) => (
                    <div key={tr.id} data-track-id={tr.id} className="flex min-h-16 border border-[#303030] bg-surface-subtle relative">
                      <div className="w-24 shrink-0 p-1.5 border-r border-edge flex flex-col gap-1 text-meta text-gray-400 z-30 bg-surface-subtle">
                        <div className="flex items-center gap-1">
                          <span className="truncate" title={tr.name}>{tr.name}</span>
                          <button
                            className="ml-auto"
                            title="轨道静音"
                            onClick={() =>
                              mutateTracks((t) => {
                                const n = t.find((x) => x.id === tr.id)
                                if (n) n.muted = !n.muted
                              })
                            }
                          >
                            {tr.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden timeline-container custom-scrollbar pb-1" onScroll={syncScroll}>
                        <div
                          className="relative h-14 min-w-full cursor-crosshair"
                          style={{ width: timelineWidth }}
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId)
                            isScrubbing.current = true
                            onTimelinePointer(e)
                          }}
                          onPointerMove={(e) => {
                            if (isScrubbing.current) onTimelinePointer(e)
                          }}
                          onPointerUp={(e) => {
                            isScrubbing.current = false
                            e.currentTarget.releasePointerCapture(e.pointerId)
                          }}
                          onPointerCancel={() => {
                            isScrubbing.current = false
                          }}
                        >
                          {tr.clips.map((c) => renderClipThumb(c))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-1 mt-2">
                    <span className="text-meta text-gray-500">导出顺序：视频轨从上到下，片段从左到右</span>
                    <button
                      className="flex items-center gap-1 text-caption text-gray-400 hover:text-white px-2 py-1 rounded bg-surface-hover border border-edge-raised hover:bg-[#3a3a3a] transition-colors"
                      onClick={addTrack}
                    >
                      <Plus size={11} />
                      新增轨道
                    </button>
                  </div>
                </div>
              )}

              {/* 选中片段信息 */}
              {selectedClipInfo && (
                <div className="h-9 px-2 border-t border-edge flex items-center gap-2 text-meta text-gray-400">
                  <span className="truncate max-w-32">{selectedClipInfo.clip.name}</span>
                  <span className="tabular-nums">
                    {selectedClipInfo.clip.sourceStart.toFixed(2)} - {selectedClipInfo.clip.sourceEnd.toFixed(2)}s
                  </span>
                  <button
                    className="ml-auto"
                    title="片段静音"
                    onClick={() => updateClip(selectedClipInfo.clip.id, { muted: !selectedClipInfo.clip.muted })}
                  >
                    {selectedClipInfo.clip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* extractAudio：格式选择 */}
          {mode === 'extractAudio' && (
            <div className="grid grid-cols-3 gap-2">
              {AUDIO_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAudioFormat(f.value)}
                  className={`nodrag h-11 rounded-md border flex flex-col items-center justify-center ${audioFormat === f.value ? 'border-[#ededed] bg-inverse text-inverse-strong' : 'border-edge-raised bg-surface-active text-gray-300'}`}
                >
                  <span className="text-caption-sm">{f.label}</span>
                  <span className="text-meta opacity-60">{f.hint}</span>
                </button>
              ))}
            </div>
          )}

          {/* sizeFrameRate：预设 + 宽高 + fps */}
          {mode === 'sizeFrameRate' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setResizeWidth(p.width)
                      setResizeHeight(p.height)
                    }}
                    className={presetCls}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-caption text-gray-500">
                  宽度
                  <input type="number" min={2} step={2} value={resizeWidth} onChange={(e) => setResizeWidth(Number(e.target.value))} className={`${inputCls} mt-1`} />
                </label>
                <label className="text-caption text-gray-500">
                  高度
                  <input type="number" min={2} step={2} value={resizeHeight} onChange={(e) => setResizeHeight(Number(e.target.value))} className={`${inputCls} mt-1`} />
                </label>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {FPS_OPTIONS.map((f) => (
                  <button key={f} onClick={() => setTargetFps(f)} className={`${presetCls} ${targetFps === f ? 'border-[#ddd] text-white' : ''}`}>
                    {f} fps
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* toGif：视频转 GIF（复刻官方 fc.jsx） */}
          {mode === 'toGif' && (
            <div className="flex flex-col gap-3">
              {/* 清晰度 / 帧率 / 速度 / 色彩 四列下拉 */}
              <div className="grid grid-cols-4 gap-2">
                <label className="nodrag flex flex-col gap-1 text-caption text-gray-500">
                  清晰度
                  <select value={gifMaxSize} onChange={(e) => setGifMaxSize(Number(e.target.value))} className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-gray-200 outline-none focus:border-edge-strong">
                    {GIF_SIZES.map((v) => (
                      <option key={v} value={v}>{v}p</option>
                    ))}
                  </select>
                </label>
                <label className="nodrag flex flex-col gap-1 text-caption text-gray-500">
                  帧率
                  <select value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))} className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-gray-200 outline-none focus:border-edge-strong">
                    {GIF_FPS.map((v) => (
                      <option key={v} value={v}>{v} fps</option>
                    ))}
                  </select>
                </label>
                <label className="nodrag flex flex-col gap-1 text-caption text-gray-500">
                  速度
                  <select value={gifSpeed} onChange={(e) => setGifSpeed(Number(e.target.value))} className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-gray-200 outline-none focus:border-edge-strong">
                    {GIF_SPEEDS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </label>
                <label className="nodrag flex flex-col gap-1 text-caption text-gray-500">
                  色彩
                  <select value={gifColors} onChange={(e) => setGifColors(Number(e.target.value))} className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-gray-200 outline-none focus:border-edge-strong">
                    {GIF_COLORS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 裁剪开关 + 双 range */}
              {gifDuration > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setGifCrop((c) => (c ? 0 : 1))}
                    className={`nodrag h-6 px-2 rounded text-caption border ${gifCrop ? 'bg-inverse text-inverse-strong border-[#ededed]' : 'bg-surface-active text-gray-400 border-edge-raised'}`}
                  >
                    {gifCrop ? '裁剪已开' : '裁剪'}
                  </button>
                  {gifCrop === 1 ? (
                    <div className="nodrag flex flex-1 items-center gap-2 text-caption text-gray-400 min-w-0">
                      <input type="range" min={0} max={gifDuration} step={0.1} value={gifStart} onChange={(e) => setGifStart(Math.min(parseFloat(e.target.value), gifEnd - 0.1))} className="nodrag flex-1 accent-blue-500 min-w-0" />
                      <input type="range" min={0} max={gifDuration} step={0.1} value={gifEnd} onChange={(e) => setGifEnd(Math.max(parseFloat(e.target.value), gifStart + 0.1))} className="nodrag flex-1 accent-blue-500 min-w-0" />
                      <span className="shrink-0 tabular-nums w-24 text-right">
                        {gifStart.toFixed(1)} - {gifEnd.toFixed(1)}s
                      </span>
                    </div>
                  ) : (
                    <span className="text-meta text-gray-600">默认整段视频</span>
                  )}
                </div>
              )}

              {/* 结果信息（复刻官方 fc.jsx resultInfo） */}
              {gifResult && (
                <div className="text-caption text-gray-400 flex items-center gap-2 flex-wrap">
                  <span>{gifResult.width}×{gifResult.height}</span>
                  <span>·</span>
                  <span>{gifResult.frameCount} 帧</span>
                  <span>·</span>
                  <span className="text-blue-400">{formatBytes(gifResult.size)}</span>
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {errorMessage && (
            <div className="flex items-start gap-1.5 text-caption-sm text-red-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 底部操作 */}
          <div className="mt-auto pt-2 flex gap-2 sticky bottom-0 bg-[#1b1b1b]">
            <button
              onClick={handleProcess}
              disabled={!canRun || loading}
              className={`nodrag flex-1 h-9 rounded-md bg-inverse text-inverse-strong text-body-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40`}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  处理中 {data.progress || 0}%
                </>
              ) : (
                <>
                  <Play size={13} />
                  {mode === 'concat' ? '按时间线拼接' : mode === 'toGif' ? (gifResult ? '重新生成GIF' : '生成GIF') : '开始处理'}
                </>
              )}
            </button>
            {loading && (
              <button
                onClick={() => {
                  abortRef.current?.abort()
                  controllerRef.current?.cancel()
                }}
                title="取消处理"
                className="nodrag h-9 w-9 rounded-md border border-edge-muted bg-[#292929] text-gray-300 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <CustomHandle position="right" handleId="main-output" variant="small" />

        {/* 编辑片段截取弹层 */}
        {editingClipId && currentClip && (
          <div className="absolute inset-0 z-50 bg-[#1b1b1b]/95 backdrop-blur-sm flex flex-col p-3 nodrag nowheel rounded-lg">
            <div className="flex items-center justify-between mb-3 text-white">
              <span className="text-sm font-medium">编辑片段截取</span>
              <button onClick={() => setEditingClipId(null)} className="text-gray-400 hover:text-white">
                <XIcon size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div className="relative bg-black rounded-md overflow-hidden border border-[#303030]">
                {!isHidden('video') && (
                  <video
                    ref={videoRef}
                    src={currentClip.url}
                    playsInline
                    preload="metadata"
                    onTimeUpdate={(e) => setPlayheadTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="nodrag nowheel w-full aspect-video object-contain"
                  />
                )}
              </div>
              <div className="nodrag nowheel rounded-md border border-edge bg-[#202020] overflow-hidden flex flex-col shrink-0">
                <div className="h-9 px-2 flex shrink-0 items-center gap-1 border-b border-edge">
                  <button className={smallBtnCls} title={isPlaying ? '暂停' : '播放'} onClick={togglePlay}>
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button className={smallBtnCls} title="在播放头设置入点 ([" onClick={setInPoint}>[</button>
                  <button className={smallBtnCls} title="在播放头设置出点 (])" onClick={setOutPoint}>]</button>
                  <button className={smallBtnCls} title="在播放头分割 (S)" onClick={splitAtPlayhead}>
                    <Scissors size={13} />
                  </button>
                  <span className="ml-auto text-caption text-gray-400 tabular-nums">{playheadTime.toFixed(2)}s</span>
                </div>
                {trimScrubber}
              </div>
              <button onClick={() => setEditingClipId(null)} className="mt-auto shrink-0 h-9 w-full rounded-md bg-inverse text-inverse-strong text-body-xs font-medium">
                完成截取
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
