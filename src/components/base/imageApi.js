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
import { resolveRefImages } from './refImage.js'
import { API_BASE } from './apiBase.js'

/** 目标端点：openai 用伪协议；apimart 用 base_url + /v1/{path}。 */
function buildTargetUrl(provider, path) {
  if ((provider?.protocol || 'apimart') === 'openai') return `openai://${path}`
  return `${(provider?.base_url || '').replace(/\/$/, '')}/v1/${path}`
}

/** 统一响应信封：成功 {ok:true, url}，失败 {ok:false, error}。 */
function ok(url) { return { ok: true, url } }
function fail(error) { return { ok: false, error } }

/** 经 localTool /api/proxy 转发（GET/POST）。失败抛错由调用方兜底。 */
async function proxyRequest({ provider, url, method = 'POST', body }) {
  const payload = { url, method }
  if (body) payload.body = JSON.stringify(body)
  if (provider?.id) payload.providerId = provider.id
  const res = await fetch(`${API_BASE}/api/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error?.message || j?.message || j?.detail || `HTTP ${res.status}`)
  }
  return res
}

/** 从 SSE 响应流中提取第一个成功图片 url（兼容 {results[].url} 与 {result.images[].url}）。 */
async function readSseImageUrl(res, onProgress) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let urlFound = ''
  try {
    while (true) {
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
          const imgUrl = evt?.results?.[0]?.url || evt?.result?.images?.[0]?.url
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
async function generateSync({ provider, url, genBody }, onProgress) {
  let waitUrl = url
  try {
    const u = new URL(url)
    u.searchParams.set('wait', '1')
    waitUrl = u.toString()
  } catch { /* 解析失败则原样 */ }

  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await proxyRequest({ provider, url: waitUrl, method: 'POST', body: genBody })
    // 响应头到达 → localTool 已连上并转发到网关/上游
    onProgress?.(20, '已转发到生成网关…')
    // 上游 SSE progress(0-100) 归一化映射到 [30,90]，避免覆盖阶段基准
    const stageProgress = (p) => onProgress?.(30 + Math.round(Math.min(100, Math.max(0, p || 0)) * 0.6), '上游生成中…')
    const imgUrl = await readSseImageUrl(res, stageProgress)
    return imgUrl ? ok(imgUrl) : fail('上游未返回图片')
  } catch (e) {
    return /^网络错误/.test(e?.message || '') ? fail(e.message) : fail(`生图失败：${e?.message || '同步请求异常'}`)
  }
}

/** 异步模式：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed。 */
async function generateAsync({ provider, url, genBody, timeoutMs }, onProgress) {
  // 提交
  let taskId
  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await proxyRequest({ provider, url, method: 'POST', body: genBody })
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
    return /^网络错误/.test(e?.message || '') ? fail(e.message) : fail(`提交失败：${e?.message || '提交异常'}`)
  }
  if (!taskId) return fail(`上游未返回任务 id`)

  // 轮询
  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' })
      const pj = await pr.json()
      const pd = pj?.data ?? pj
      const imgUrl = pd?.result?.images?.[0]?.url || pd?.results?.[0]?.url
      if (imgUrl) return ok(imgUrl)
      if (pd?.status === 'failed' || pd?.status === 'error') {
        return fail(pd?.error?.message || pd?.error || '上游任务失败')
      }
      onProgress?.(30 + Math.min(60, Math.round((Date.now() - start) / 3000) * 10), '上游生成中…')
    } catch (e) {
      return fail(`轮询失败：${e?.message || '轮询异常'}`)
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
 * 参考图（图生图）：网关 /v1/images/generations 认 image_urls 字段，blob: 由 refImage 先转 data base64。
 * @param {object} opts
 *   - provider, prompt, model, size(档位 1K/2K), n, aspectRatio(比例), quality(质量), images?
 * @param {function} [onProgress] (percent)
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateImage({ provider, prompt, model, size, n, aspectRatio, quality, images }, onProgress) {
  const genBody = { prompt, model, n: n || 1 }
  const hasRatio = aspectRatio && aspectRatio !== 'Auto' && aspectRatio !== 'auto'
  // 比例非 Auto → 查表转精确像素作 size；否则用传入的档位/默认
  genBody.size = hasRatio ? resolveImagePixel(aspectRatio, size || '1K') : (size || '')
  if (size && hasRatio) genBody.resolution = size
  if (size) genBody.image_size = String(size).toUpperCase()
  if (quality && quality !== 'auto') genBody.quality = quality
  const refImages = await resolveRefImages(images)
  if (refImages.length > 0) genBody.image_urls = refImages

  const url = buildTargetUrl(provider, 'images/generations')
  const mode = provider?.image_mode === 'async' ? 'async' : 'sync'
  return mode === 'async'
    ? generateAsync({ provider, url, genBody, timeoutMs: 300000 }, onProgress)
    : generateSync({ provider, url, genBody }, onProgress)
}
