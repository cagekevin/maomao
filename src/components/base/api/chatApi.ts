/**
 * 文本聊天 API —— 「前端发意图 → localTool /api/generate（capability=chat，统一生成入口）」（docs/90 R5、docs/101、Step 6 收口）。
 *
 * 链路：本文件 → relayChat（relayProxy）→ POST /api/generate → relayGenerate 引擎按 providerId( config
 * providers/<id>.json ) 出站 → 同步返 {ok, content}。统一生成入口收口（2026-09-03），chat 与 image/video
 * 同走 /api/generate 分流（旧 /api/relay 已并入）。
 * 流式与否由后端 config 决定（Step 4），前端不传 stream。
 *
 * 【taskId 贯穿任务中心】taskId 取前端 reportGenerate 的任务号，经 frontTaskId 透传后端（聊天也进任务中心）。
 * scriptbox/AI 助手等内部工具调用无可选 taskId 时可不传。
 *
 * 【新时代配置型（2026-09-03）】providerId = 13 个 config 厂商之一；model = 该厂商模型清单里的 id。
 * temperature/response_format 经 relayChat 透传后端（preset 纯模板有传才进 body）——TextNode JSON 输出与
 * 采样温度依赖它们。已随 proxyGenerate 退役移除 chatProxy / resolveChatMode / buildResponsesChatBody。
 */
import { normalizeImageUrlsForSend, toImageContentBlocks } from '../utils/imageUrl.ts'
import { logger } from '../core/logger.ts'
import { relayChat } from './relayProxy.ts'
import { CHAT_TIMEOUT } from '../core/config.ts'
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

/** chatCompletions 入参（对外签名不变；stream 由后端 config 决定，前端传 true 仅表示「期望流式」） */
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
  /** 请求级前端 task_id（reportGenerate 任务号，经 frontTaskId 透传后端，贯穿任务中心；可选） */
  taskId?: string
}

/** 把参考图附加到最后一条 user 消息（content 转数组 + image_url 块）。 */
async function attachImages(messages: ChatMessage[], images: string[] | null | undefined, provider: GenerationProvider | undefined): Promise<ChatMessage[]> {
  if (!images?.length) return messages
  // 发送统一出口守卫：参考图必经此归一（含缩略图端点自动还原原图），禁止绕过。见 imageUrl.js thumbnailToOriginal
  const refUrls = await normalizeImageUrlsForSend(images)
  if (!refUrls.length) return messages
  const blocks = toImageContentBlocks(refUrls)
  const userIdx = messages.length - 1
  // messages 为空的诚实判空：没有 user 消息可附加，直接原样返回
  if (userIdx < 0) return messages
  const last = messages[userIdx]
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
export async function chatCompletions({ provider, messages, model, images, temperature = 0.1, responseFormat, signal, stream, taskId }: ChatCompletionsOptions): Promise<GenerationResult> {
  const finalMessages = await attachImages(messages, images, provider)
  // 仅有参考图附加后产生有效消息才走；空消息后端校验失败返回错误
  const r = await relayChat(
    {
      frontTaskId: taskId || '',
      type: 'chat',
      providerId: provider.id || 'lovart',
      capability: 'chat',
      model,
      messages: finalMessages,
    },
    {
      signal,
      timeoutMs: CHAT_TIMEOUT,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(responseFormat ? { responseFormat: responseFormat === 'json' ? 'json_object' : responseFormat } : {}),
    }
  )
  if (r.ok && typeof r.content === 'string') return { ok: true, content: r.content }
  return { ok: false, error: r.error || '上游未返回文本内容', aborted: r.aborted }
}