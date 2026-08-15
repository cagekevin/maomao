/**
 * 视频生成 API —— 经 localTool /api/proxy 转发到供应商的 /v1/videos/generations。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/videos/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://videos/generations，localTool 拼 base+key
 *
 * ⚠️ 视频强制异步（比生图慢很多，不适合 SSE 同步等待）：
 * 提交返回 task_id → 轮询 GET /v1/tasks/{id} 到 completed → 取 result.videos[].url。
 * 不走 provider.image_mode，也不用 sync。
 *
 * 网关契约：body { model, prompt, size(如 16:9), image_urls(参考图可选) }。
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

/** 异步模式（视频唯一模式）：提交拿 task_id → 轮询到 completed。 */
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
    const direct = data?.result?.videos?.[0]?.url || data?.results?.[0]?.url || json?.result?.videos?.[0]?.url
    if (!taskId && direct) return ok(direct)
  } catch (e) {
    return /^网络错误/.test(e?.message || '') ? fail(e.message) : fail(`提交失败：${e?.message || '提交异常'}`)
  }
  if (!taskId) return fail(`上游未返回任务 id`)

  // 轮询
  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 5000))
    try {
      const pr = await proxyRequest({ provider, url: pollUrl, method: 'GET' })
      const pj = await pr.json()
      const pd = pj?.data ?? pj
      const vidUrl = pd?.result?.videos?.[0]?.url || pd?.result?.images?.[0]?.url || pd?.results?.[0]?.url
      if (vidUrl) return ok(vidUrl)
      if (pd?.status === 'failed' || pd?.status === 'error') {
        return fail(pd?.error?.message || pd?.error || '上游任务失败')
      }
      onProgress?.(30 + Math.min(60, Math.round((Date.now() - start) / 5000) * 10), '上游生成中…')
    } catch (e) {
      return fail(`轮询失败：${e?.message || '轮询异常'}`)
    }
  }
  return fail('轮询超时')
}

/**
 * 文生视频 / 图生视频。
 * @param {object} opts
 *   - provider, prompt, model
 *   - size: 比例（如 '16:9'）
 *   - resolution: 清晰度（如 '1080p'）
 *   - seconds: 时长（秒）
 *   - images?: string[] 参考图（图生视频，可选）。网关认 body.image_urls。
 * @param {function} [onProgress] (percent)
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateVideo({ provider, prompt, model, size, resolution, seconds, images }, onProgress) {
  const genBody = { prompt, model }
  if (size && size !== 'Auto') genBody.size = size
  if (resolution) genBody.resolution = resolution
  if (seconds) genBody.duration = String(seconds)
  const refImages = await resolveRefImages(images)
  if (refImages.length > 0) genBody.image_urls = refImages

  const url = buildTargetUrl(provider, 'videos/generations')
  return generateAsync({ provider, url, genBody, timeoutMs: 600000 }, onProgress)
}
