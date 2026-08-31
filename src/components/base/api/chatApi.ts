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
import { normalizeImageUrlsForSend, toImageContentBlocks } from '../imageUrl.ts'
import { logger } from '../logger.ts'
import { chatProxy } from './proxyGenerate.ts'
// 请求形态层：聊天 responses 形态构造请求体（chat_completions 默认，M2-2）
import { resolveChatMode, buildResponsesChatBody } from '../requestModes.ts'
import type { GenerationProvider, GenerationResult } from '@/types'

/** 聊天气息内容块（text / image_url），供 content 数组形式的消息使用 */
export interface ChatContentBlock {
  type: 'text' | 'image_url' | string
  text?: string
  image_url?: { url: string; detail?: string } | string
}

/** 聊天消息（对齐 /v1/chat/completions messages 形态；extra 字段透传 tools 等） */
export interface ChatMessage {
  role: 'user' | 'system' | 'assistant' | 'tool' | string
  content?: string | ChatContentBlock[]
  tool_call_id?: string
  tool_calls?: Array<Record<string, unknown>>
  [key: string]: unknown
}

/** chatCompletions 入参 */
export interface ChatCompletionsOptions {
  provider: GenerationProvider
  messages: ChatMessage[]
  model: string
  /** 参考图 URL（可选） */
  images?: string[]
  temperature?: number
  responseFormat?: 'json_object' | 'json' | string
  signal?: AbortSignal
  stream?: boolean
}

/** 把参考图附加到最后一条 user 消息（content 转数组 + image_url 块）。 */
async function attachImages(messages: ChatMessage[], images: string[] | null | undefined, provider: GenerationProvider | undefined): Promise<ChatMessage[]> {
  if (!images?.length) return messages
  // 发送统一出口守卫：参考图必经此归一（含缩略图端点自动还原原图），禁止绕过。见 imageUrl.js thumbnailToOriginal
  // refFormat:'base64' 的 provider（只认 base64 的后端）→ 参考图统一转 base64 再发
  const refUrls = await normalizeImageUrlsForSend(images, { preferBase64: provider?.refFormat === 'base64' })
  if (!refUrls.length) return messages
  const blocks = toImageContentBlocks(refUrls)
  const userIdx = messages.length - 1
  // messages 可能为空（messages[userIdx] 为 undefined），运行时兜底空对象；此处仅窄化类型不改变运行时语义
  const last: ChatMessage = (messages[userIdx] || {}) as ChatMessage
  const contentArr: ChatContentBlock[] = Array.isArray(last.content)
    ? [...last.content]
    : [{ type: 'text', text: typeof last.content === 'string' ? last.content : String(last.content || '') }]
  contentArr.push(...blocks)
  logger.info('chatApi', '附加参考图到 user 消息', refUrls.length)
  return messages.map((m, i) => (i === userIdx ? { ...m, content: contentArr } : m))
}

/**
 * 文本补全。
 * @returns {{ ok:boolean, content?:string, error?:string, aborted?:boolean }}
 */
export async function chatCompletions({ provider, messages, model, images, temperature = 0.1, responseFormat, signal, stream = false }: ChatCompletionsOptions): Promise<GenerationResult> {
  const finalMessages = await attachImages(messages, images, provider)
  // responses 形态：input[] + tools 顶层 name 构造请求体；默认 chat/completions（M2-2）
  if (resolveChatMode(provider?.chat_request_mode, model) === 'responses') {
    const body = buildResponsesChatBody({ model, messages: finalMessages, temperature, responseFormat: responseFormat === 'json' ? 'json_schema' : responseFormat === 'json_object' ? 'json_schema' : responseFormat, stream })
    return chatProxy({ provider, body, signal, stream })
  }
  const body: Record<string, unknown> = { model, messages: finalMessages, temperature, stream }
  if (responseFormat === 'json_object' || responseFormat === 'json') body.response_format = { type: responseFormat }
  return chatProxy({ provider, body, signal, stream })
}
