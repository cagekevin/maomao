/**
 * 深度转视频弹窗（无 iframe，直接渲染转换面板）。
 *
 * 依据集成设计稿 §4/§5.2/§6：把 Downloads `depth-video-converter` 的独立页 UI + 转换逻辑 port 成一个
 * 与宿主解耦的 React 组件，去掉 <iframe> 与 postMessage。props 仅 videoUrl / name / onClose / onSave。
 *
 * 分层（高内聚低耦合）：
 *  - 纯计算：engine.ts（灰度/对比度/混合/格式探测/命名/下游节点规格）——已单测，本组件只调用不内联。
 *  - 运行时加载：loader.ts（ensureModel/disposeModel，G1 动态 import + G2 时机 + G3 释放）。
 *  - 本组件：视频装载 / canvas 逐帧采集 / MediaRecorder 录像 / 停止与取消 / 上传回调。
 *
 * 三道闸门：
 *  - G1 代码按需：transformers/onnxruntime 只在本文件内 `import(/* @vite-ignore *\/ URL)`，无任何静态 import。
 *  - G2 时机按需：仅在 engine==='ai' 且用户点击「开始转换」才调 ensureModel；fast 模式完全不加载模型。
 *  - G3 释放：转换结束 / 关弹窗 / 切到 fast 时 disposeModel() + revoke objectURL + abort 录像。
 *
 * 失败可见：所有失败（WebGPU 不可用 / 模型缺失 / 上传 null / mp4 不可用 / 取消）如实上报到内联状态条，
 * 不静默降级、不抛未捕获异常（弹窗内拦截并提示），错误文本走 classifyError 口径。
 *
 * 上传唯一入口：filesApi.uploadFileToLocal(blob, UPLOAD_DIRS.videoProcess, filename)：
 * 返回 string|null，null 即失败必须报错（不用 videoEngine.uploadResult 的静默 blob 兜底）。
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowUp } from 'lucide-react'
import { RUNTIME_MODELS } from './path.ts'
import {
  grayFromRaw,
  grayFromTensor,
  fastDepthFromSource,
  blendFrames,
  pickRecordingFormat,
  depthOutputName,
} from './engine.ts'
import { ensureModel, disposeModel, ensureRuntimeImportMap } from './loader.ts'
import { uploadFileToLocal } from '../api/filesApi.ts'
import { UPLOAD_DIRS } from '../utils/uploadDirs.ts'
import { withTimeout, isTimeoutError } from '../utils/asyncGuard.ts'
import { classifyError } from '../utils/genErrors.ts'
import { showToast } from '../core/toastStore.ts'
import { logger } from '../core/logger.ts'

export interface DepthVideoModalProps {
  /** 本节点当前视频 URL（绝对 URL，已是 toAbsoluteFileUrl 后） */
  videoUrl: string
  /** 视频名（用于派生输出文件名） */
  name?: string
  onClose: () => void
  /** 转换产物落盘 url（深度视频），由宿主 spawn 下游节点 */
  onSave: (url: string, outputName: string) => void
}

/** 运行位置选项（webgpu 不可用时校验禁用） */
const DEVICE_OPTIONS = [
  { value: 'webgpu', label: 'WebGPU（显卡）' },
  { value: 'wasm', label: 'CPU（WASM）' },
] as const

const MODEL_OPTIONS = [
  { value: 'onnx-community/depth-anything-v2-small', label: 'Depth Anything V2 Small' },
  { value: 'Xenova/depth-anything-small-hf', label: 'Depth Anything Small' },
  { value: 'Xenova/dpt-hybrid-midas', label: 'DPT Hybrid MiDaS' },
] as const

const INPUT_CLS =
  'w-full bg-surface-2 border border-edge rounded text-caption-sm px-2 py-1 text-body outline-none focus:border-primary'

const LABEL_CLS = 'text-caption text-muted mb-1'

export function DepthVideoModal({ videoUrl, name, onClose, onSave }: DepthVideoModalProps) {
  // ── 参数（弹窗内 React state，单次会话保活，不做跨会话记忆，对应设计稿 D3）──
  const [engine, setEngine] = useState<'ai' | 'fast'>('ai')
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value)
  const [device, setDevice] = useState<'webgpu' | 'wasm'>('webgpu')
  const [fps, setFps] = useState(25)
  const [maxWidth, setMaxWidth] = useState(512)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [contrast, setContrast] = useState(1.0)
  const [smooth, setSmooth] = useState(0.25)
  const [invert, setInvert] = useState(false)
  const [outputFormat, setOutputFormat] = useState<'auto' | 'mp4' | 'webm'>('auto')

  // ── 状态/进度（弹窗内自持，不进节点 loading / 任务中心，对应 D2）──
  const [status, setStatus] = useState('正在载入视频…')
  const [badge, setBadge] = useState('')
  const [progress, setProgress] = useState(0)
  const [converting, setConverting] = useState(false)
  const [gpuAvailable] = useState(() => typeof navigator !== 'undefined' && 'gpu' in navigator)

  // ── refs（媒体/录制/模型句柄）──
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const abortRef = useRef(false)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)

  // 弹窗打开即装载视频（一次）
  useEffect(() => {
    void loadVideoAndPreview()
    return () => {
      // 卸载（关弹窗）：G3 释放 + abort，防卸载竞态（R4）
      abortRef.current = true
      disposeModel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 遮罩弹窗：Esc 关闭（对齐摄影棚面板 CameraStudioPanel 交互）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 装载视频 + 绘制源帧 + 快速预览帧 */
  async function loadVideoAndPreview() {
    if (!videoUrl) {
      setStatus('没有可转换的视频。')
      return
    }
    const video = videoRef.current
    if (!video) return
    // 跨域读回（画布 getImageData）需 anonymous；localTool 全开 CORS（*）
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.load()
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('浏览器无法读取这个视频。'))
      })
    } catch (e) {
      setStatus(`视频读取失败：${(e as Error).message}`)
      return
    }
    resizeCanvases(maxWidth)
    await seekVideo(0)
    drawSourceFrame()
    drawPreviewFrame()
    setStatus('视频已载入，可以开始转换。')
    setBadge('就绪')
    // WebGPU 探测失败如实告知，让用户主动选择（对应 D5）
    if (device === 'webgpu' && !gpuAvailable) {
      setDevice('wasm')
      setStatus('此浏览器未开启 GPU 通道，当前使用 CPU（WASM）。')
    }
  }

  /** 缩放画布到目标宽度（保持源像素比） */
  function resizeCanvases(targetWidth: number) {
    const video = videoRef.current
    const source = sourceCanvasRef.current
    const depth = depthCanvasRef.current
    if (!video || !source || !depth) return
    const ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9
    const width = Math.max(1, Math.round(Math.min(targetWidth, video.videoWidth || targetWidth)))
    const height = Math.max(1, Math.round(width / ratio))
    source.width = width
    source.height = height
    depth.width = width
    depth.height = height
    previousFrameRef.current = null
  }

  /** 等待视频 seek 完成（事件 + 超时兜底防挂起） */
  function seekVideo(time: number): Promise<void> {
    const video = videoRef.current
    if (!video) return Promise.reject(new Error('视频不可用'))
    const target = Math.min(Math.max(0, time), Math.max(0, (video.duration || 0) - 0.001))
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        const onSeeked = () => { cleanup(); resolve() }
        const onError = () => { cleanup(); reject(new Error('读取视频帧失败。')) }
        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        video.addEventListener('error', onError, { once: true })
        video.currentTime = target
      }),
      10000,
      '视频帧读取超时'
    )
  }

  function drawSourceFrame() {
    const video = videoRef.current
    const canvas = sourceCanvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (video && canvas && ctx && video.videoWidth) ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  /** fast 快速预览帧（绘制到深度 canvas，也用于引擎切换时的即时预览） */
  function drawPreviewFrame() {
    const source = sourceCanvasRef.current
    const depth = depthCanvasRef.current
    const srcCtx = source?.getContext('2d', { willReadFrequently: true })
    const dstCtx = depth?.getContext('2d', { willReadFrequently: true })
    if (!source || !depth || !srcCtx || !dstCtx) return
    if (!srcCtx) return
    const rgba = srcCtx.getImageData(0, 0, source.width, source.height)
    const gray = fastDepthFromSource(rgba.data, source.width, source.height, { contrast, invert })
    putGray(depth, dstCtx, gray)
  }

  /** 深度灰度（Float32Array 0..255）→ 深度 canvas，含帧间平滑混合（smooth） */
  function putGray(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, gray: Float32Array) {
    const img = ctx.createImageData(canvas.width, canvas.height)
    let raw: Float32Array | Uint8ClampedArray = gray
    const n = canvas.width * canvas.height
    if (smooth > 0 && previousFrameRef.current) {
      raw = blendFrames(previousFrameRef.current, gray, n, smooth)
    }
    for (let i = 0, p = 0; i < n; i += 1, p += 4) {
      const v = raw[i] ?? 0
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
    previousFrameRef.current = new Uint8ClampedArray(raw)
    ctx.putImageData(img, 0, 0)
  }

  /** ai 单帧推理并绘制（tfjs 管线输出 tensor / RawImage） */
  async function drawAiFrame(runtime: { pipe: any; RawImage: any }) {
    const source = sourceCanvasRef.current
    const depth = depthCanvasRef.current
    const ctx = depth?.getContext('2d', { willReadFrequently: true })
    if (!source || !depth || !ctx) return
    const input = runtime.RawImage?.fromCanvas?.(source) ?? source
    const result = await runtime.pipe(input)
    const dep = result?.depth || result?.predicted_depth || result
    if (dep?.data && dep?.width && dep?.height) {
      const gray = grayFromRaw(dep, { contrast, invert })
      putGray(depth, ctx, gray)
    } else if (dep?.data && dep?.dims) {
      const w = dep.dims[dep.dims.length - 1] || depth.width
      const h = dep.dims[dep.dims.length - 2] || depth.height
      const gray = grayFromTensor(dep.data, dep.dims, { contrast, invert })
      const tmp = ctx.createImageData(w, h)
      for (let i = 0; i < w * h; i += 1) {
        const v = Math.round(gray[i])
        tmp.data[i * 4] = v
        tmp.data[i * 4 + 1] = v
        tmp.data[i * 4 + 2] = v
        tmp.data[i * 4 + 3] = 255
      }
      ctx.putImageData(tmp, 0, 0)
    } else {
      throw new Error('深度模型输出格式无法识别。')
    }
  }

  /** 录像录制句柄（captureStream + requestFrame 逐帧驱动） */
  function createRecorder() {
    const depth = depthCanvasRef.current
    if (!depth) throw new Error('深度画布不可用')
    const format = pickRecordingFormat(outputFormat, (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
    const stream = depth.captureStream(0)
    const track = stream.getVideoTracks()[0]
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    return { recorder, track, chunks, format, stream }
  }

  async function captureOneFrame(rec: { recorder: MediaRecorder; track: MediaStreamTrack }) {
    const frameMs = 1000 / fps
    rec.recorder.resume()
    ;(rec.track as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
    await new Promise((r) => setTimeout(r, frameMs))
    ;(rec.track as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
    rec.recorder.pause()
  }

  function finishRecording(rec: { recorder: MediaRecorder; track: MediaStreamTrack; chunks: BlobPart[]; format: { mimeType: string }; stream: MediaStream }): Promise<Blob> {
    return withTimeout(
      new Promise<Blob>((resolve) => {
        rec.recorder.onstop = () => resolve(new Blob(rec.chunks, { type: rec.recorder.mimeType || rec.format.mimeType }))
        rec.recorder.resume()
        ;(rec.track as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
        rec.recorder.stop()
        rec.stream.getTracks().forEach((t) => t.stop())
      }),
      15000,
      '录像封装超时'
    )
  }

  /** 开始转换（长任务，abortRef 停止；after ai 走 G2 才加载模型） */
  async function startConvert() {
    if (!videoRef.current || !Number.isFinite(videoRef.current.duration)) {
      setStatus('请先载入视频。')
      return
    }
    const options = {
      engine,
      fps: Math.max(1, Math.min(60, Math.round(fps || 25))),
      maxWidth: Math.max(128, Math.min(1280, Math.round(maxWidth || 512))),
      start: Math.max(0, Number(start) || 0),
      end: end > 0 ? end : videoRef.current.duration,
    }
    options.end = Math.min(Math.max(options.end, options.start + 1 / options.fps), videoRef.current.duration)
    if (options.end <= options.start) {
      setStatus('结束秒数必须大于开始秒数。')
      return
    }

    abortRef.current = false
    previousFrameRef.current = null
    setProgress(0)
    setConverting(true)
    setBadge('转换中')

    // 纪录录制状态（供 finally/卸载时 abort）
    let rec: { recorder: MediaRecorder; track: MediaStreamTrack; chunks: BlobPart[]; format: { mimeType: string; fellBackToWebm: boolean }; stream: MediaStream } | null = null

    try {
      resizeCanvases(options.maxWidth)

      // ── G2 闸门：仅 ai + 点击转换才加载模型；fast 完全不加载 ──
      let runtime: { pipe: any; RawImage: any } | null = null
      if (options.engine === 'ai') {
        setStatus('正在加载深度模型…')
        // G1：运行时动态 import 绝对同源 URL（模型资源由 localTool /depth-video/ 静态托管）
        // 先注入 import map：transformers 内部裸导入 onnxruntime-web/webgpu / onnxruntime-common，
        // 没有映射浏览器无法解析（报 "Failed to resolve module specifier"）。
        ensureRuntimeImportMap(RUNTIME_MODELS)
        const T: any = await withTimeout(
          import(/* @vite-ignore */ RUNTIME_MODELS.transformers),
          120000,
          '深度模型运行时加载超时'
        )
        const loaded = await withTimeout(
          ensureModel(T, { model, device }, RUNTIME_MODELS, {
            onProgress: setProgress,
            onStatus: (t) => setStatus(t),
          }),
          5 * 60 * 1000,
          '深度模型下载超时'
        )
        runtime = { pipe: loaded.pipe, RawImage: loaded.RawImage }
      }

      const totalFrames = Math.max(1, Math.ceil((options.end - options.start) * options.fps))
      rec = createRecorder()
      if (rec.format.fellBackToWebm) {
        // mp4 显式但浏览器不支持 → 如实告知（D5 不静默）：结果扩展名按实际 webm 标注
        setStatus('当前浏览器不支持 MP4 封装，已改用 WebM。')
        setBadge('格式调整')
      }
      rec.recorder.start()
      rec.recorder.pause()

      setStatus('正在转换视频。')
      for (let frame = 0; frame < totalFrames; frame += 1) {
        if (abortRef.current) throw new Error('已停止转换。')
        const time = options.start + frame / options.fps
        await seekVideo(time)
        drawSourceFrame()
        if (options.engine === 'ai' && runtime) {
          await drawAiFrame(runtime)
        } else {
          drawPreviewFrame()
        }
        await captureOneFrame(rec)
        setProgress(Math.round(((frame + 1) / totalFrames) * 100))
        setStatus(`正在转换第 ${frame + 1} / ${totalFrames} 帧。`)
      }

      const blob = await finishRecording(rec)

      // ── 上传唯一入口：filesApi.uploadFileToLocal（null 即失败，如实报错，不静默兜底）──
      const ext = rec.format.mimeType.includes('mp4') ? 'mp4' : 'webm'
      const outName = depthOutputName(name || videoUrl.split('/').pop() || 'video', ext)
      setStatus(`转换完成，正在上传…`)
      const url = await withTimeout(
        uploadFileToLocal(blob, UPLOAD_DIRS.videoProcess, outName),
        30000,
        '文件上传超时'
      )
      if (!url) throw new Error('深度视频上传失败（本地文件服务不可用）。')

      setProgress(100)
      setBadge('完成')
      setStatus('转换完成。')
      showToast('深度视频已生成', { type: 'success' })
      // 排障埋点（debug）：记录生成成功（url + 输出名），受 'depth' 位控制，默认安静不上报
      logger.debug('深度转视频', 'success', { url, outputName: outName }, { module: 'depth' })
      onSave(url, outName)
      onClose()
    } catch (e) {
      // 失败可见：不静默吞错、不抛未捕获；如实上报到内联状态条（含取消与超时）
      const cls = classifyError(e)
      const msg = isTimeoutError(e) ? cls.message : (e instanceof Error ? e.message : String(e))
      setStatus(msg)
      setBadge('出错')
      logger.debug('深度转视频', 'fail', { message: msg, stack: e instanceof Error ? e.stack : undefined }, { module: 'depth' })
      if (!abortRef.current) {
        showToast(msg, { type: 'error' })
      }
    } finally {
      setConverting(false)
      // G3：释放模型运行时与录像流句柄
      disposeModel()
      try { rec?.recorder.state === 'recording' && rec.recorder.stop() } catch { /* 忽略 */ }
    }
  }

  /** 停止转换（用户主动） */
  function stopConvert() {
    abortRef.current = true
    setStatus('正在停止…')
    setBadge('停止中')
  }

  /** 关闭弹窗（×/Esc/完成）：G3 释放 + abort，然后通知宿主关弹窗 */
  function handleClose() {
    abortRef.current = true
    disposeModel()
    onClose()
  }

  // 全屏遮罩弹窗（对齐摄影棚 CameraStudioPanel 外壳）：fixed inset-0 遮罩 + 居中面板
  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className="relative bg-surface-raised border border-edge rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(96vw, 860px)', height: 'min(88vh, 680px)', maxWidth: '98vw', maxHeight: '98vh' }}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge flex-shrink-0">
          <span className="text-caption-sm text-body font-medium">转深度视频</span>
          <button
            className="p-1 rounded text-muted hover:text-body hover:bg-surface-hover transition-colors"
            onClick={handleClose}
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-4 p-4 min-h-0 flex-1">
          {/* 左：参数列 */}
          <div className="w-56 shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <div>
              <div className={LABEL_CLS}>处理方式</div>
              <select className={INPUT_CLS} value={engine} onChange={(e) => { setEngine(e.target.value as 'ai' | 'fast'); if (e.target.value === 'fast') disposeModel() }}>
                <option value="ai">AI 深度估计</option>
                <option value="fast">快速预览（无模型）</option>
              </select>
            </div>

            {engine === 'ai' && (
              <>
                <div>
                  <div className={LABEL_CLS}>深度模型</div>
                  <select className={INPUT_CLS} value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className={LABEL_CLS}>运行位置</div>
                  <select className={INPUT_CLS} value={device} onChange={(e) => setDevice(e.target.value as 'webgpu' | 'wasm')}>
                    {DEVICE_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value} disabled={d.value === 'webgpu' && !gpuAvailable}>
                        {d.label}{d.value === 'webgpu' && !gpuAvailable ? '（不可用）' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={LABEL_CLS}>帧率</div>
                <input type="number" className={INPUT_CLS} value={fps} min={1} max={60} onChange={(e) => setFps(Number(e.target.value))} />
              </div>
              <div>
                <div className={LABEL_CLS}>最大宽度</div>
                <input type="number" className={INPUT_CLS} value={maxWidth} min={128} max={1280} onChange={(e) => setMaxWidth(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={LABEL_CLS}>开始 (秒)</div>
                <input type="number" className={INPUT_CLS} value={start} min={0} onChange={(e) => setStart(Number(e.target.value))} />
              </div>
              <div>
                <div className={LABEL_CLS}>结束 (秒)</div>
                <input type="number" className={INPUT_CLS} value={end} min={0} onChange={(e) => setEnd(Number(e.target.value))} />
              </div>
            </div>

            <div>
              <div className={LABEL_CLS}>对比度：{contrast.toFixed(2)}</div>
              <input type="range" className="w-full accent-primary" min={0.7} max={1.8} step={0.01} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
            </div>
            <div>
              <div className={LABEL_CLS}>平滑：{smooth.toFixed(2)}</div>
              <input type="range" className="w-full accent-primary" min={0} max={0.85} step={0.01} value={smooth} onChange={(e) => setSmooth(Number(e.target.value))} />
            </div>

            <label className="flex items-center gap-2 text-caption-sm text-muted cursor-pointer">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="accent-primary" />
              反色深度
            </label>

            <div>
              <div className={LABEL_CLS}>导出格式</div>
              <select className={INPUT_CLS} value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as 'auto' | 'mp4' | 'webm')}>
                <option value="auto">自动（优先 MP4）</option>
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </div>
          </div>

          {/* 右：双画布预览 */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-edge bg-surface-muted">
              <canvas ref={depthCanvasRef} className="w-full h-full object-contain nodrag nowheel"></canvas>
            </div>
          </div>
        </div>

        {/* 源视频（隐藏，仅用于抽帧） */}
        <video ref={videoRef} className="hidden" crossOrigin="anonymous"></video>
        <canvas ref={sourceCanvasRef} className="hidden nodrag nowheel"></canvas>

        {/* 进度条 + 操作 */}
        <div className="px-4 pb-4 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded bg-surface-2 overflow-hidden">
              <div className="h-full transition-all duration-150" style={{ width: `${progress}%`, background: 'var(--color-primary, #0ea5e9)' }}></div>
            </div>
            <span className="text-caption-sm text-muted tabular-nums w-10 text-right">{progress}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption-sm text-muted flex-1 truncate">
              {status}
              {badge ? <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-3 text-white text-caption-sm">{badge}</span> : null}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {converting ? (
                <button className="px-3 py-1.5 rounded text-caption-sm bg-surface-raised text-body border border-edge hover:bg-surface-hover transition-colors" onClick={stopConvert} title="停止转换">
                  停止
                </button>
              ) : (
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-surface-hover hover:bg-surface-hover-strong border border-edge text-white transition-colors"
                  onClick={startConvert}
                  title="开始转换"
                >
                  <span className="text-caption-sm font-medium">开始转换</span>
                  <span className="bg-white text-black w-5 h-5 rounded-full flex items-center justify-center">
                    <ArrowUp size={12} strokeWidth={3} />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}