/**
 * 文本聊天 API —— 经 localTool /api/proxy 转发到供应商的 /v1/chat/completions。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/chat/completions
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://chat/completions，localTool 拼 base+key
 *
 * 参考图（images）：
 *  - user message 的 content 为数组时支持 { type:'image_url', image_url:{url} }，
 *    网关提取后经 resolve_attachments 处理。url 经 refImage.js 统一解析（blob:→data base64）。
 */
import { resolveRefImages, toImageContentBlocks } from './refImage.js'

import { API_BASE } from './apiBase.js'

/** 目标端点：openai 用伪协议让 localTool 拼 base+key；apimart 用 base_url 原样透传。 */
function buildTargetUrl(provider) {
  if ((provider?.protocol || 'apimart') === 'openai') return 'openai://chat/completions'
  return `${(provider?.base_url || '').replace(/\/$/, '')}/v1/chat/completions`
}

/** 把参考图附加到最后一条 user 消息（content 转数组 + image_url 块）。 */
async function attachImages(messages, images) {
  if (!images?.length) return messages
  const refUrls = await resolveRefImages(images)
  if (!refUrls.length) return messages
  const blocks = toImageContentBlocks(refUrls)
  const userIdx = messages.length - 1
  const last = messages[userIdx] || {}
  const contentArr = Array.isArray(last.content)
    ? [...last.content]
    : [{ type: 'text', text: typeof last.content === 'string' ? last.content : String(last.content || '') }]
  contentArr.push(...blocks)
  console.log(`[chatApi] 附加 ${refUrls.length} 张参考图到 user 消息`)
  return messages.map((m, i) => (i === userIdx ? { ...m, content: contentArr } : m))
}

/**
 * 经 localTool /api/proxy 转发，返回统一信封。
 * @returns {{ ok:boolean, content?:string, error?:string, aborted?:boolean }}
 */
async function post(payload, signal) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (e) {
    console.error('[chatApi] 网络异常:', e?.message)
    return e?.name === 'AbortError'
      ? { ok: false, aborted: true, error: '已停止' }
      : { ok: false, error: `网络错误：${e.message}` }
  }

  let json
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: `响应解析失败 (HTTP ${res.status})` }
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || json?.detail || `HTTP ${res.status}`
    return { ok: false, error: msg }
  }
  const content = (json?.data ?? json)?.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim()) return { ok: true, content }
  return { ok: false, error: '上游未返回文本内容' }
}

/**
 * 文本补全。
 * @param {object} opts
 *   - provider, messages, model
 *   - images?: string[]         参考图 URL（可选）
 *   - temperature?: number      默认 0.1
 *   - responseFormat?: 'json_object'|'json'
 *   - signal?: AbortSignal
 * @returns {{ ok:boolean, content?:string, error?:string, aborted?:boolean }}
 */
export async function chatCompletions({ provider, messages, model, images, temperature = 0.1, responseFormat, signal }) {
  const finalMessages = await attachImages(messages, images)
  const body = { model, messages: finalMessages, temperature, stream: false }
  if (responseFormat === 'json_object' || responseFormat === 'json') body.response_format = { type: responseFormat }
  const payload = { url: buildTargetUrl(provider), method: 'POST', body: JSON.stringify(body) }
  if (provider?.id) payload.providerId = provider.id
  return post(payload, signal)
}
