/**
 * 生图 API —— 经 localTool /api/proxy 转发到供应商的 /v1/images/generations。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/images/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://images/generations，localTool 拼 base+key
 *
 * 同步/异步由 provider.image_mode 决定（API 设置页「图片生成模式」）：
 *  - sync ：URL 带 ?wait=1 → 网关同步 SSE 返回（progress + status:succeeded + results[].url）
 *  - async：提交返回 [{status:"submitted", task_id}] → 轮询 GET /v1/tasks/{id} 到 completed
 */
import { normalizeImageUrlsForSend } from './imageUrl.js'
import { API_BASE } from './apiBase.js'
import { getCurrentTaskId, setTaskPollId } from './taskStore.js'
import { GEN_TIMEOUT, GEN_POLL_INTERVAL } from './config.js'
import { classifyError } from './genErrors.js'

/** 目标端点：openai 用伪协议；apimart 用 base_url + /v1/{path}。 */
function buildTargetUrl(provider, path) {
  if ((provider?.protocol || 'apimart') === 'openai') return `openai://${path}`
  return `${(provider?.base_url || '').replace(/\/$/, '')}/v1/${path}`
}

/** 统一响应信封：成功 {ok:true, url}，失败 {ok:false, error}。 */
function ok(url) { return { ok: true, url } }
function fail(error) { return { ok: false, error } }

/** 经 localTool /api/proxy 转发（GET/POST）。失败抛错由调用方兜底。
 *
 * 【为何不迁到 httpClient.js】本模块是 SSE 流式响应（readSseImageUrl 读 body 流）+ 嵌套
 * error 信封（j.error.message），与 httpClient 的 parseJson/扁平错误消息语义冲突；且此处已
 * 内建三层异步治理：signal 取消、AbortError 原样上抛、async 轮询 timeoutMs 超时，故保留原生
 * fetch。调用方（useNodeGeneration）负责把错误归入 Timeout/Abort/网络 分类。
 * @param {AbortSignal} [signal] 可选取消信号（Step A 可取消地基，向后兼容，不传照常工作）。 */
async function proxyRequest({ provider, url, method = 'POST', body }, signal) {
  const payload = { url, method }
  if (body) payload.body = JSON.stringify(body)
  if (provider?.id) payload.providerId = provider.id
  // 贯穿链路：把前端 task_id 带给 localTool/网关，关联 Lovart thread_id（见 taskStore.currentTaskId）
  const frontTaskId = getCurrentTaskId()
  if (frontTaskId) payload.taskId = frontTaskId
  const res = await fetch(`${API_BASE}/api/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error?.message || j?.message || j?.detail || `HTTP ${res.status}`)
  }
  return res
}

/** 从 SSE 响应流中提取第一个成功图片 url（兼容 {results[].url} 与 {result.images[].url}）。 */
async function readSseImageUrl(res, onProgress, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let urlFound = ''
  try {
    while (true) {
      if (signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const raw = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : ''
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          if (typeof evt.progress === 'number') onProgress?.(evt.progress)
          // url 可能是数组（网关 result.images[0].url:[...]）或字符串，统一取字符串
          const rawUrl = evt?.results?.[0]?.url ?? evt?.result?.images?.[0]?.url
          const imgUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl
          if (evt.status === 'succeeded' && imgUrl) urlFound = imgUrl
          if (evt.status === 'failed' || evt.error) throw new Error(evt.error || evt.failure_reason || '生成失败')
        } catch (e) { /* 忽略单条 JSON 解析失败 */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return urlFound
}

/** 同步模式：URL 带 ?wait=1，读 SSE 流拿图片 url。 */
async function generateSync({ provider, url, genBody }, onProgress, signal) {
  let waitUrl = url
  try {
    const u = new URL(url)
    u.searchParams.set('wait', '1')
    waitUrl = u.toString()
  } catch { /* 解析失败则原样 */ }

  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await proxyRequest({ provider, url: waitUrl, method: 'POST', body: genBody }, signal)
    // 响应头到达 → localTool 已连上并转发到网关/上游
    onProgress?.(20, '已转发到生成网关…')
    // 上游 SSE progress(0-100) 归一化映射到 [30,90]，避免覆盖阶段基准。
    // 【单调递增兜底】上游 progress 可能不单调（时而 100 时而 0 → 90 掉回 30），
    // 用已到达最大值封住，保证进度条只前进不后退。
    let reached = 0
    const stageProgress = (p) => {
      const mapped = 30 + Math.round(Math.min(100, Math.max(0, p || 0)) * 0.6)
      if (mapped > reached) reached = mapped
      onProgress?.(reached, '上游生成中…')
    }
    const imgUrl = await readSseImageUrl(res, stageProgress, signal)
    return imgUrl ? ok(imgUrl) : fail('上游未返回图片')
  } catch (e) {
    if (e?.name === 'AbortError') throw e // 取消信号：原样抛出，由调用方（useNodeGeneration）处理为"已取消"
    const c = classifyError(e)
    return c.type === 'network' ? fail(c.message) : fail(`生图失败：${c.message || '同步请求异常'}`)
  }
}

/** 异步模式：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed。 */
async function generateAsync({ provider, url, genBody, timeoutMs }, onProgress, signal) {
  // 提交
  let taskId
  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await proxyRequest({ provider, url, method: 'POST', body: genBody }, signal)
    onProgress?.(20, '已提交到生成网关…')
    const json = await res.json()
    const data = json?.data ?? json
    const tasks = Array.isArray(data) ? data : (Array.isArray(json) ? json : [])
    const submitted = tasks.find((t) => t && (t.status === 'submitted' || t.task_id))
    taskId = submitted?.task_id
    // 部分供应商提交即返回结果（非任务形态）
    const direct = data?.results?.[0]?.url || data?.result?.images?.[0]?.url || json?.results?.[0]?.url
    if (!taskId && direct) return ok(direct)
  } catch (e) {
    if (e?.name === 'AbortError') throw e // 取消：原样抛出，由调用方处理
    const c = classifyError(e)
    return c.type === 'network' ? fail(c.message) : fail(`提交失败：${c.message || '提交异常'}`)
  }
  if (!taskId) return fail(`上游未返回任务 id`)

  // 【取舍】把网关返回的可查询 task_id 回填到当前任务记录，供刷新后恢复轮询
  // （pollTask.js）按 /api/v1/gateway/task/{id} 查结果。仅异步 async 模式走到这；
  // sync/SSE 模式同步等待、无 task_id，不存（刷新断即断，官方同此）。
  setTaskPollId(getCurrentTaskId(), taskId)

  // 轮询
  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, GEN_POLL_INTERVAL))
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    try {
      const pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' }, signal)
      const pj = await pr.json()
      const pd = pj?.data ?? pj
      // 网关 result.images[0].url 是数组（APIMart 规范 `{url:[...]}`），需取 [0]；兼容字符串
      const rawUrl = pd?.result?.images?.[0]?.url ?? pd?.results?.[0]?.url
      const imgUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl
      if (imgUrl) return ok(imgUrl)
      if (pd?.status === 'failed' || pd?.status === 'error') {
        return fail(pd?.error?.message || pd?.error || '上游任务失败')
      }
      onProgress?.(30 + Math.min(60, Math.round((Date.now() - start) / 3000) * 10), '上游生成中…')
    } catch (e) {
      if (e?.name === 'AbortError') throw e // 取消：原样抛出
      const c = classifyError(e)
      return c.type === 'network' ? fail(c.message) : fail(`轮询失败：${c.message || '轮询异常'}`)
    }
  }
  return fail('轮询超时')
}

/**
 * 比例 × 清晰度档位 → 精确像素 查表（复刻官方 H_.jsx oe 表）。
 * 官方生图节点不把「9:16 + 1K」原样传给上游，而是查这张表转成固定像素
 * （如 9:16+1K → 880x1776），避免不同 AI/网关对比例档位理解不一致而自由换算。
 * @type {Record<string, Record<string,string>>}
 */
const RATIO_PIXEL_TABLE = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '16:9': { '1K': '1776x880', '2K': '2048x1152', '4K': '3840x2160' },
  '9:16': { '1K': '880x1776', '2K': '1152x2048', '4K': '2160x3840' },
  '3:2': { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
  '2:3': { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
  '21:9': { '1K': '2048x880', '2K': '2048x880', '4K': '3840x1648' },
  '9:21': { '1K': '880x2048', '2K': '880x2048', '4K': '1648x3840' },
  '1:3': { '1K': '688x2048', '2K': '688x2048', '4K': '1280x3840' },
  '3:1': { '1K': '2048x688', '2K': '2048x688', '4K': '3840x1280' },
  '2:1': { '1K': '2048x1024', '2K': '2048x1024', '4K': '3840x1920' },
  '1:2': { '1K': '1024x2048', '2K': '1024x2048', '4K': '1920x3840' },
  '4:3': { '1K': '1024x768', '2K': '2304x1728', '4K': '2880x2160' },
  '3:4': { '1K': '768x1024', '2K': '1728x2304', '4K': '2160x2880' },
}
const DEFAULT_PIXEL = '1024x1024'

/**
 * 比例 + 档位 → 精确像素（查表，复刻官方）。
 *  - 比例 Auto / 空 → 返回 ''（不指定 size）
 *  - 档位查不到 → 回退该比例的 '1K'；比例也查不到 → 兜底 DEFAULT_PIXEL
 * @param {string} ratio  比例，如 '9:16' / 'Auto'
 * @param {string} size   档位，如 '1K' / '2K' / '4K'
 * @returns {string} 像素字符串（'880x1776'）或 ''（Auto 不指定）
 */
export function resolveImagePixel(ratio, size) {
  if (!ratio || ratio === 'Auto' || ratio === 'auto') return ''
  const byRatio = RATIO_PIXEL_TABLE[ratio] || {}
  return byRatio[size] || byRatio['1K'] || DEFAULT_PIXEL
}

/**
 * 生图（文生图 / 图生图）。
 * 尺寸处理对齐官方：把「比例 + 档位」查表转成精确像素 size（避免不同 AI 理解错位），
 * 同时保留 image_size（档位）与 resolution 供网关/apimart 使用。
 *  - apimart(Lovart) 网关：size 给像素，网关 parse_size 直接命中精确像素分支原样用。
 *  - openai 直连（魔搭等）：size=像素 是 OpenAI 标准格式，可直接被接受。
 * 参考图（图生图）：网关 /v1/images/generations 认 image_urls 字段，blob: 由 imageUrl.js 先转 data base64。
 * @param {object} opts
 *   - provider, prompt, model, size(档位 1K/2K), n, aspectRatio(比例), quality(质量), images?
 * @param {function} [onProgress] (percent)
 * @param {AbortSignal} [signal] 可选取消信号（Step A；不传向后兼容）
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateImage({ provider, prompt, model, size, n, aspectRatio, quality, images }, onProgress, signal) {
  const genBody = { prompt, model, n: n || 1 }
  const hasRatio = aspectRatio && aspectRatio !== 'Auto' && aspectRatio !== 'auto'
  // 比例非 Auto → 查表转精确像素作 size；否则用传入的档位/默认
  genBody.size = hasRatio ? resolveImagePixel(aspectRatio, size || '1K') : (size || '')
  if (size && hasRatio) genBody.resolution = size
  if (size) genBody.image_size = String(size).toUpperCase()
  if (quality && quality !== 'auto') genBody.quality = quality
  // refFormat:'base64' 的 provider（只认 base64 的后端）→ 参考图统一转 base64 再发；
  // 否则走默认（URL，网关 resolve_attachments 统一转 CDN）。
  const refImages = await normalizeImageUrlsForSend(images, { preferBase64: provider?.refFormat === 'base64' })
  if (refImages.length > 0) genBody.image_urls = refImages

  const url = buildTargetUrl(provider, 'images/generations')
  const mode = provider?.image_mode === 'async' ? 'async' : 'sync'
  return mode === 'async'
    ? generateAsync({ provider, url, genBody, timeoutMs: GEN_TIMEOUT }, onProgress, signal)
    : generateSync({ provider, url, genBody }, onProgress, signal)
}
