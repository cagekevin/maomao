/**
 * 文本聊天 API —— 经 localTool /api/proxy 转发到供应商的 /v1/chat/completions。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/chat/completions
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://chat/completions，localTool 拼 base+key
 *
 * 参考图（images）：
 *  - user message 的 content 为数组时支持 { type:'image_url', image_url:{url} }，
 *    网关提取后经 resolve_attachments 处理。url 经 imageUrl.js 统一解析（blob:→data base64）。
 *
 * 【薄壳】代理请求脚手架（buildTargetUrl / proxyFetch / 嵌套错误解析 / 信封归一）已收口到
 * proxyGenerate.js 深模块；本文件仅负责「业务参数 → body + 委托 chatProxy」。
 *
 * ⚠️【为何不走 httpClient.js（SSE 豁免红线）】本模块走 SSE 流式（逐块解析 content/reasoning/tool_calls，
 * 流中断视为业务语义而非传输错误），其错误语义与 httpClient 的「非 2xx 抛 HttpError + 网络/超时自动重试」
 * 冲突；httpClient 的自动重试会破坏流式增量与多轮工具循环。故保持独立 proxyGenerate 链路，
 * 并在模块内部自行处理 AbortSignal。禁止把它迁移到 httpClient.js。
 */
import { normalizeImageUrlsForSend, toImageContentBlocks } from './imageUrl.js'
import { logger } from './logger.js'
import { chatProxy } from './proxyGenerate.js'

/** 把参考图附加到最后一条 user 消息（content 转数组 + image_url 块）。 */
async function attachImages(messages, images, provider) {
  if (!images?.length) return messages
  // refFormat:'base64' 的 provider（只认 base64 的后端）→ 参考图统一转 base64 再发
  const refUrls = await normalizeImageUrlsForSend(images, { preferBase64: provider?.refFormat === 'base64' })
  if (!refUrls.length) return messages
  const blocks = toImageContentBlocks(refUrls)
  const userIdx = messages.length - 1
  const last = messages[userIdx] || {}
  const contentArr = Array.isArray(last.content)
    ? [...last.content]
    : [{ type: 'text', text: typeof last.content === 'string' ? last.content : String(last.content || '') }]
  contentArr.push(...blocks)
  logger.info('chatApi', '附加参考图到 user 消息', refUrls.length)
  return messages.map((m, i) => (i === userIdx ? { ...m, content: contentArr } : m))
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
  const finalMessages = await attachImages(messages, images, provider)
  const body = { model, messages: finalMessages, temperature, stream: false }
  if (responseFormat === 'json_object' || responseFormat === 'json') body.response_format = { type: responseFormat }
  return chatProxy({ provider, body, signal })
}
