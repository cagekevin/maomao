/**
 * 视频处理引擎层（复刻官方 shared.js 的 Ec / Dc / Oc / bc）。
 *
 * 官方用 mediabunny（浏览器 WebCodecs 媒体工具包）做视频处理，而非 ffmpeg.wasm / 本地引擎：
 *  - _c()   → import('mediabunny') 主库
 *  - Ec     → 读视频元数据（时长/宽高/fps）
 *  - Dc     → 单输入处理：trim / extractAudio / sizeFrameRate
 *  - Oc     → 多输入拼接（多轨视频 + 音频，按片段区间 + 静音）
 *  - bc     → 进度控制器（attach conversion/output，cancel）
 *  - hi     → 上传；原型无后端，改为 URL.createObjectURL 生成本地 URL
 *
 * 用法与官方保持一致：返回 { blob, metadata:{duration,width,height,fps}, mimeType, extension }。
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp3OutputFormat,
  Mp4OutputFormat,
  Output,
  WavOutputFormat,
  AudioBufferSource,
  AudioSampleSink,
  VideoSampleSink,
  VideoSampleSource
} from 'mediabunny'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

/** clamp：保证是偶数且 ≥2 */
function Sc(v) {
  return Math.max(2, Math.round(v / 2) * 2)
}
/** clamp：合法 fps（1~120）否则 30 */
function Cc(v) {
  if (Number.isFinite(v) && v >= 1 && v <= 120) return v
  return 30
}
/** 构建 48000Hz 双声道空音频缓冲（用于拼接时补齐静音轨） */
function wc(duration, sampleRate = 48000, channels = 2) {
  return new AudioBuffer({
    length: Math.max(1, Math.round(duration * sampleRate)),
    numberOfChannels: channels,
    sampleRate
  })
}
/** 重采样到目标采样率/声道（官方 Tc） */
async function Tc(audioBuffer, sampleRate = 48000, channels = 2) {
  if (audioBuffer.sampleRate === sampleRate && audioBuffer.numberOfChannels === channels) return audioBuffer
  const ctx = new OfflineAudioContext(channels, Math.max(1, Math.round(audioBuffer.duration * sampleRate)), sampleRate)
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)
  source.start()
  return ctx.startRendering()
}

/** 用 Blob 构建 mediabunny Input（官方 xc） */
async function xc(blob) {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
}

/** 转换取消错误（官方 yc） */
export class ConversionCanceled extends Error {
  constructor(message = '视频处理已取消') {
    super(message)
    this.name = 'ConversionCanceledError'
  }
}

/** 进度控制器（官方 bc）：attach conversion / output，支持 cancel */
export class ProgressController {
  conversion = null
  output = null
  canceled = false
  get isCanceled() {
    return this.canceled
  }
  attach(conversion) {
    this.conversion = conversion
    if (this.canceled) conversion.cancel()
  }
  attachOutput(output) {
    this.output = output
    if (this.canceled) output.cancel()
  }
  async cancel() {
    this.canceled = true
    await Promise.allSettled([this.conversion?.cancel(), this.output?.cancel()].filter((e) => e))
  }
}

/** 读视频元数据（官方 Ec）→ { duration, width, height, fps } */
export async function readVideoMetadata(blob) {
  const input = await xc(blob)
  try {
    if (!(await input.canRead())) throw new Error('无法识别视频格式')
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error('输入文件不包含视频轨道')
    const [duration, width, height, stats] = await Promise.all([
      input.getDurationFromMetadata(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.computePacketStats(120).catch(() => null)
    ])
    const dur = duration ?? (await input.computeDuration())
    return {
      duration: Number.isFinite(dur) ? dur : 0,
      width,
      height,
      fps: Cc(stats?.averagePacketRate ?? 0)
    }
  } finally {
    input.dispose()
  }
}

/**
 * 单输入处理（官方 Dc）：trim / extractAudio / sizeFrameRate。
 * @param {Blob} blob 输入视频
 * @param {object} t { mode, start, end, format, width, height, fps, controller, onProgress }
 * @returns {{ blob, metadata, mimeType, extension }}
 */
export async function processVideo(blob, t) {
  const input = await xc(blob)
  const target = new BufferTarget()
  try {
    if (!(await input.canRead())) throw new Error('无法识别视频格式')
    const videoTrack = await input.getPrimaryVideoTrack()
    const audioTrack = await input.getPrimaryAudioTrack()
    if (!videoTrack) throw new Error('输入文件不包含视频轨道')
    if (t.mode === 'extractAudio' && !audioTrack) throw new Error('该视频不包含可提取的音频轨道')
    if (t.controller?.isCanceled) throw new ConversionCanceled()

    const init = {
      input,
      output: new Output({
        format:
          t.mode !== 'extractAudio' || t.format === 'm4a'
            ? new Mp4OutputFormat({ fastStart: 'in-memory' })
            : t.format === 'wav'
              ? new WavOutputFormat()
              : new Mp3OutputFormat(),
        target
      }),
      tracks: 'primary',
      showWarnings: false
    }
    if (t.mode === 'trim') {
      init.trim = { start: t.start, end: t.end }
      init.video = {}
      init.audio = {}
    } else if (t.mode === 'extractAudio') {
      init.video = { discard: true }
      if (t.format === 'm4a') {
        init.audio = { codec: 'aac' }
      } else if (t.format === 'wav') {
        init.audio = { codec: 'pcm-s16' }
      } else {
        init.audio = { codec: 'mp3', bitrate: 192000 }
      }
    } else {
      // sizeFrameRate
      init.video = { codec: 'avc', width: t.width, height: t.height, fit: 'contain', frameRate: t.fps }
      init.audio = { codec: 'aac' }
    }

    const conversion = await Conversion.init(init)
    t.controller?.attach(conversion)
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((e) => e.reason).join('、')
      throw new Error(reasons ? `当前浏览器无法完成此处理：${reasons}` : '当前浏览器无法完成此处理')
    }
    conversion.onProgress = (e) => t.onProgress?.(e)
    await conversion.execute()
    if (!target.buffer) throw new Error('视频处理未生成输出文件')

    const duration = t.mode === 'trim' ? t.end - t.start : (await input.getDurationFromMetadata()) ?? (await input.computeDuration())
    const width = t.mode === 'sizeFrameRate' ? t.width : await videoTrack.getDisplayWidth()
    const height = t.mode === 'sizeFrameRate' ? t.height : await videoTrack.getDisplayHeight()
    const fps = Cc((await videoTrack.computePacketStats(120).catch(() => null))?.averagePacketRate ?? 0)
    const finalFps = t.mode === 'sizeFrameRate' ? t.fps : fps
    const mimeType =
      t.mode === 'extractAudio' ? (t.format === 'm4a' ? 'audio/mp4' : t.format === 'wav' ? 'audio/wav' : 'audio/mpeg') : 'video/mp4'
    const extension = t.mode === 'extractAudio' ? t.format : 'mp4'
    return {
      blob: new Blob([target.buffer], { type: mimeType }),
      metadata: { duration, width, height, fps: finalFps },
      mimeType,
      extension
    }
  } catch (e) {
    throw e instanceof ConversionCanceledError ? new ConversionCanceled(e.message) : e
  } finally {
    input.dispose()
  }
}

/**
 * 多输入拼接（官方 Oc）。至少 2 个视频，取最大宽高 + 目标 fps，逐段写入。
 * @param {Blob[]} blobs 输入视频（顺序=导出顺序）
 * @param {object} t { segments:[{start,end,muted}], controller, onProgress, width, height, fps }
 * @returns {{ blob, metadata, mimeType, extension }}
 */
export async function concatVideos(blobs, t = {}) {
  if (blobs.length < 2) throw new Error('视频拼接至少需要 2 个输入视频')
  const inputs = []
  let outputTarget = null
  try {
    for (const b of blobs) inputs.push(await xc(b))
    const items = []
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      if (!(await input.canRead())) throw new Error(`第 ${i + 1} 个视频格式无法识别`)
      const v = await input.getPrimaryVideoTrack()
      if (!v) throw new Error(`第 ${i + 1} 个输入不包含视频轨道`)
      const sourceDuration = (await v.getDurationFromMetadata()) ?? (await v.computeDuration())
      if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) throw new Error(`第 ${i + 1} 个视频时长无效`)
      const seg = t.segments?.[i]
      const start = Math.max(0, Math.min(seg?.start ?? 0, sourceDuration))
      const end = Math.max(start, Math.min(seg?.end ?? sourceDuration, sourceDuration))
      const duration = end - start
      if (duration <= 0) throw new Error(`第 ${i + 1} 个片段范围无效`)
      items.push({ video: v, audio: await input.getPrimaryAudioTrack(), sourceDuration, start, end, duration, muted: !!seg?.muted })
    }
    if (t.controller?.isCanceled) throw new ConversionCanceled()

    const stats = await items[0].video.computePacketStats(120).catch(() => null)
    let maxW = 0
    let maxH = 0
    for (const it of items) {
      const w = await it.video.getDisplayWidth()
      const h = await it.video.getDisplayHeight()
      if (w > maxW) maxW = w
      if (h > maxH) maxH = h
    }
    const outW = Sc(t.width ?? maxW)
    const outH = Sc(t.height ?? maxH)
    const outFps = Cc(t.fps ?? stats?.averagePacketRate ?? 30)
    const totalDur = items.reduce((s, it) => s + it.duration, 0)

    const target = new BufferTarget()
    outputTarget = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target
    })
    t.controller?.attachOutput(outputTarget)

    const videoSink = new VideoSampleSink({
      codec: 'avc',
      bitrate: 5000000,
      sizeChangeBehavior: 'contain',
      transform: { width: outW, height: outH, fit: 'contain', frameRate: outFps }
    })
    const audioSink = new AudioBufferSource({
      codec: 'aac',
      bitrate: 192000,
      transform: { sampleRate: 48000, numberOfChannels: 2 }
    })
    outputTarget.addVideoTrack(videoSink, { frameRate: outFps })
    outputTarget.addAudioTrack(audioSink)
    await outputTarget.start()

    let progressMax = 0
    const report = (e) => {
      const p = Math.max(progressMax, Math.min(1, e))
      progressMax = p
      t.onProgress?.(p)
    }
    let timeline = 0
    for (let i = 0; i < items.length; i++) {
      if (t.controller?.isCanceled) throw new ConversionCanceled()
      const it = items[i]
      const source = new VideoSampleSource(it.video)
      for await (const sample of source.samples(it.start, it.end)) {
        try {
          if (t.controller?.isCanceled) throw new ConversionCanceled()
          const rel = sample.timestamp - it.start
          if (rel < 0) continue
          if (rel >= it.duration) break
          sample.setTimestamp(timeline + rel)
          if (rel + sample.duration > it.duration) sample.setDuration(it.duration - rel)
          await videoSink.add(sample)
          report((timeline + Math.min(it.duration, rel)) / totalDur)
        } finally {
          sample.close()
        }
      }
      if (it.audio && !it.muted) {
        const audioSource = new AudioSampleSink(it.audio)
        const firstTs = (await it.audio.getFirstTimestamp()) + it.start
        const rate = await it.audio.getSampleRate()
        const ch = await it.audio.getNumberOfChannels()
        const buf = new AudioBuffer({ length: Math.max(1, Math.round(it.duration * rate)), numberOfChannels: ch, sampleRate: rate })
        for await (const sample of audioSource.samples(firstTs, firstTs + it.duration)) {
          try {
            if (t.controller?.isCanceled) throw new ConversionCanceled()
            const rel = sample.timestamp - firstTs
            if (rel >= it.duration) break
            const sampleBuf = sample.toAudioBuffer()
            const l = Math.max(0, Math.round(rel * rate))
            const u = Math.max(0, Math.round(-rel * rate))
            const d = Math.min(sampleBuf.length - u, buf.length - l)
            if (d <= 0) continue
            for (let c = 0; c < ch; c++) {
              const data = sampleBuf.getChannelData(Math.min(c, sampleBuf.numberOfChannels - 1))
              buf.copyToChannel(data.subarray(u, u + d), c, l)
            }
          } finally {
            sample.close()
          }
        }
        await audioSink.add(await Tc(buf))
      } else {
        await audioSink.add(wc(it.duration))
      }
      timeline += it.duration
      report(timeline / totalDur)
    }
    videoSink.close()
    audioSink.close()
    await outputTarget.finalize()
    if (!target.buffer) throw new Error('视频拼接未生成输出文件')
    return {
      blob: new Blob([target.buffer], { type: 'video/mp4' }),
      metadata: { duration: totalDur, width: outW, height: outH, fps: outFps },
      mimeType: 'video/mp4',
      extension: 'mp4'
    }
  } catch (e) {
    if (outputTarget && outputTarget.state !== 'canceled' && outputTarget.state !== 'finalized') {
      await outputTarget.cancel().catch(() => undefined)
    }
    throw t.controller?.isCanceled ? new ConversionCanceled() : e
  } finally {
    for (const i of inputs) i.dispose()
  }
}

/** 加载 video 元素（复刻官方 nc.jsx）：onloadedmetadata 后 resolve，带超时 */
function loadVideoElement(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = url
    const timer = window.setTimeout(() => {
      reject(new Error('视频加载超时'))
    }, timeoutMs)
    video.onloadedmetadata = () => {
      window.clearTimeout(timer)
      resolve(video)
    }
    video.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('视频加载失败（可能是跨域或格式不支持）'))
    }
  })
}

/** seek 视频并等待 seeked（复刻官方 rc） */
function seekVideo(video, t) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = t
  })
}

/** 格式化文件大小（复刻官方 uc）：B / KB / MB */
export function formatBytes(e) {
  if (e < 1024) return `${e} B`
  if (e < 1048576) return `${(e / 1024).toFixed(1)} KB`
  return `${(e / 1048576).toFixed(2)} MB`
}

/**
 * 视频转 GIF（复刻官方 ic.jsx）。
 * @param {string} url 视频地址（blob / http / data）
 * @param {object} t { fps=10, maxSize=480, colors=256, startTime=0, endTime, speed=1, timeoutMs=30000, onProgress }
 * @returns {Promise<{blob, width, height, frameCount, size}>}
 */
export async function videoToGif(url, t = {}) {
  const { fps = 10, maxSize = 480, colors = 256, startTime = 0, endTime, speed = 1, timeoutMs = 30000, onProgress } = t
  const video = await loadVideoElement(url, timeoutMs)
  const duration = video.duration
  if (!duration || isNaN(duration) || duration === Infinity) throw new Error('无法获取视频时长')
  let start = Math.max(0, startTime)
  let end = Math.min(endTime ?? duration, duration)
  const span = Math.max(0.1, end - start)
  let w = video.videoWidth
  let h = video.videoHeight
  if (!w || !h) throw new Error('无法获取视频尺寸')
  // 等比缩放至 maxSize 内（长边 = maxSize）
  if (w > maxSize || h > maxSize) {
    if (w >= h) {
      h = Math.round((h * maxSize) / w)
      w = maxSize
    } else {
      w = Math.round((w * maxSize) / h)
      h = maxSize
    }
  }
  w = Math.max(2, w - (w % 2))
  h = Math.max(2, h - (h % 2))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D 不可用')
  const realFps = Math.max(0.5, Math.min(30, fps))
  const realSpeed = Math.max(0.1, Math.min(8, speed))
  const frameCount = Math.max(1, Math.round(span * realFps))
  const delay = Math.max(20, Math.round(1000 / realFps / realSpeed))
  const paletteSize = Math.max(2, Math.min(256, colors))
  const encoder = GIFEncoder()
  for (let i = 0; i < frameCount; i++) {
    const time = start + i / realFps
    await seekVideo(video, Math.min(time, end))
    ctx.drawImage(video, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const palette = quantize(data, paletteSize)
    const index = applyPalette(data, palette)
    encoder.writeFrame(index, w, h, { palette, delay })
    onProgress?.((i + 1) / frameCount)
    await new Promise((r) => setTimeout(r, 0))
  }
  encoder.finish()
  video.removeAttribute('src')
  try { video.load() } catch {}
  const bytes = encoder.bytes()
  const arr = new Uint8Array(bytes.length)
  arr.set(bytes)
  const blob = new Blob([arr], { type: 'image/gif' })
  return { blob, width: w, height: h, frameCount, size: blob.size }
}

/**
 * 上传/持久化（官方 hi）。原型无后端，直接生成本地 object URL（与 ImageNode spawn 一致）。
 * @returns {{ url: string, thumbnailUrl?: string }}
 */
export async function uploadResult(blob, _opts = {}) {
  if (typeof blob === 'string') return { url: blob }
  return { url: URL.createObjectURL(blob) }
}
