/**
 * generate —「前端生成门面」唯一收口（L3 施工唯一依据：docs/前端生成门面收口-L3-裁定与修订.md）。
 *
 * 【为什么收口】imageApi.ts / videoApi.ts / chatApi.ts 三份门面各自直连 relay 拼意图，实现几乎一样、
 *   abort 语义还曾各自吞成信封（弹红色错误 toast）。本次统一为一个内部 generate() 共用实现 +
 *   4 个具名导出（generateImage / generateVideo / chatCompletions / chatStream），对外签名逐字不变
 *   → 调用点零改动（测试 #8/#10 锁死 barrel 与别名不漂移）。
 *
 * 【边界铁律 1 · 只接同步】capability:'chat' 一律走 relayChat（同步快路径）；任何流式一律走 chatStream（L3b 并入）。
 * 【边界铁律 2 · abort 原样上抛】image/video 中止一律**抛** AbortError，且必须**原样透传** relayGenerate 抛出的
 *   error（name 恒为 'AbortError'、message 恒为 'Aborted'）——**禁止**自行 new Error('已停止')。
 *   原因（L3c 更新）：生成链路的中止判定已统一走 classifyError（genErrors.ts:24），看的是 `e.name`；
 *   若自行 new Error 且不设 name='AbortError'，会被判为 business → 中止时误弹红色错误 toast。
 *   （L3 原文「scriptBoxEngine 用 /abort/i 匹配 message 判定中止」已于 L3c 失效，判定不再依赖 message 文案。）见裁定文档 §4.2.1。
 *
 * 【仅具名导出】内部 generate() 不导出——无人消费的抽象必然与别名实现漂移（修正 8 / §14.4①）。
 *
 * 【结果信封】复用 src/types/provider.ts 的 GenerationResult 唯一真源，禁止二次定义（修正 8）。
 */
import { GEN_TIMEOUT, VIDEO_TIMEOUT, CHAT_TIMEOUT } from '../core/config.ts'
import { normalizeImageUrlsForSend, toImageContentBlocks } from '../utils/imageUrl.ts'
import { resolveImagePixel } from '../utils/imagePixel.ts'
import { relayGenerate, relayChat, relayChatStream } from './relayProxy.ts'
import { logger } from '../core/logger.ts'
import type { RelayCapability, RelayIntent } from './relayProxy.ts'
import type { GenerationProvider, GenerationResult } from '@/types'

/** 真·单一真相：禁止重新列举字面量（修正 8） */
export type GenerateCapability = RelayCapability

/** 结果信封：复用 src/types 的 GenerationResult 唯一真源，禁止二次定义（修正 8） */
export type GenerateResult = GenerationResult

/** 统一生成请求（三模态共用；模态差异用可选字段表达） */
export interface GenerateRequest {
  capability: GenerateCapability
  provider: GenerationProvider
  model: string
  taskId?: string
  prompt?: string
  messages?: ChatMessage[]
  size?: string
  aspectRatio?: string // image：比例（如 '9:16'），Auto 不指定 size
  resolution?: string // video：清晰度
  seconds?: number // video：时长（秒）
  images?: string[]
  temperature?: number
  responseFormat?: string
}

/** generateImage 入参（对外签名不变；n/quality 保留兼容，当前由后端 preset 决定不在此拼装） */
export interface GenerateImageOptions {
  provider: GenerationProvider
  prompt: string
  model: string
  /** 清晰度档位（1K/2K），查表转像素用 */
  size?: string
  n?: number
  /** 比例（如 '9:16'），Auto 不指定 size */
  aspectRatio?: string
  quality?: string
  /** 参考图（图生图，可选） */
  images?: string[]
  /** 请求级前端 task_id（P0-A） */
  taskId?: string
}

/** generateVideo 入参（对外签名不变） */
export interface GenerateVideoOptions {
  provider: GenerationProvider
  prompt: string
  model: string
  /** 比例（如 '16:9'） */
  size?: string
  /** 清晰度（如 '1080p'） */
  resolution?: string
  /** 时长（秒） */
  seconds?: number
  /** 参考图（图生视频，可选） */
  images?: string[]
  /** 请求级前端 task_id（P0-A） */
  taskId?: string
}

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

/** chatCompletions 入参（stream 字段已删——死参数，修订 7）。流式与否由后端 config 决定。 */
export interface ChatCompletionsOptions {
  provider: GenerationProvider
  messages: ChatMessage[]
  model: string
  /** 参考图 URL（可选） */
  images?: string[]
  temperature?: number
  responseFormat?: 'json_object' | 'json' | string
  signal?: AbortSignal
  /** 请求级前端 task_id（reportGenerate 任务号，经 frontTaskId 透传后端；可选） */
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
  logger.info('generate', '附加参考图到 user 消息', refUrls.length)
  return messages.map((m, i) => (i === userIdx ? { ...m, content: contentArr } : m))
}

/**
 * 内部共用实现 —— 【不导出】（§14.4①）。
 * 三模态统一：image/video 走 relayGenerate（异步句柄，abort 原样上抛）；chat 走 relayChat（同步快路径）。
 */
async function generate(
  req: GenerateRequest,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const { capability, provider, model } = req

  // chat 同步快路径：relayChat 返 {ok,content|error,aborted?} 信封（铁律 1：不接流式）
  if (capability === 'chat') {
    const finalMessages = await attachImages(req.messages ?? [], req.images, provider)
    const r = await relayChat(
      {
        frontTaskId: req.taskId || '',
        type: 'chat',
        providerId: provider.id || 'lovart',
        capability: 'chat',
        model,
        messages: finalMessages,
      },
      {
        signal,
        timeoutMs: CHAT_TIMEOUT,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.responseFormat ? { responseFormat: req.responseFormat === 'json' ? 'json_object' : req.responseFormat } : {}),
      }
    )
    if (r.ok && typeof r.content === 'string') return { ok: true, content: r.content }
    return { ok: false, error: r.error || '上游未返回文本内容', aborted: r.aborted }
  }

  // image | video：异步 relay。参考图统一出口守卫 + abort 原样上抛（铁律 2，禁止吞成信封）
  const refImages = await normalizeImageUrlsForSend(req.images)
  const intent: RelayIntent = {
    frontTaskId: req.taskId || '',
    type: capability,
    providerId: provider.id,
    capability,
    model,
    prompt: req.prompt,
    images: refImages,
  }
  if (capability === 'image') {
    const hasRatio = req.aspectRatio && req.aspectRatio !== 'Auto' && req.aspectRatio !== 'auto'
    const pixel = hasRatio ? resolveImagePixel(req.aspectRatio, req.size || '1K') : (req.size || '')
    intent.size = hasRatio ? pixel : undefined
  } else {
    intent.size = req.size && req.size !== 'Auto' ? req.size : undefined
    intent.resolution = req.resolution
    intent.duration = req.seconds ? String(req.seconds) : undefined
  }
  const r = await relayGenerate({
    intent,
    timeoutMs: capability === 'video' ? VIDEO_TIMEOUT : GEN_TIMEOUT,
    signal,
    onProgress,
  })
  if (r.ok && r.url) return { ok: true, url: r.url }
  return { ok: false, error: r.error || '生成失败', aborted: r.aborted }
}

/**
 * 生图（文生图 / 图生图）→ 发意图给后端 relay。中止抛 AbortError（铁律 2）。
 * @returns GenerationResult：{ ok:true, url? } / { ok:false, error?, aborted? }
 */
export function generateImage(
  opts: GenerateImageOptions,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  // 别名 = generate() 一行 wrapper，防各自实现漂移（测试 #10 锁死）
  return generate(
    { capability: 'image', provider: opts.provider, model: opts.model, taskId: opts.taskId, prompt: opts.prompt, size: opts.size, aspectRatio: opts.aspectRatio, images: opts.images },
    onProgress,
    signal
  )
}

/**
 * 文生视频 / 图生视频。中止抛 AbortError（铁律 2）。
 * @returns GenerationResult：{ ok:true, url? } / { ok:false, error?, aborted? }
 */
export function generateVideo(
  opts: GenerateVideoOptions,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  return generate(
    { capability: 'video', provider: opts.provider, model: opts.model, taskId: opts.taskId, prompt: opts.prompt, size: opts.size, resolution: opts.resolution, seconds: opts.seconds, images: opts.images },
    onProgress,
    signal
  )
}

/**
 * 文本补全（同步）。
 * @returns GenerationResult：{ ok:true, content? } / { ok:false, error?, aborted? }（chat 中止仍返信封）
 */
export function chatCompletions(opts: ChatCompletionsOptions): Promise<GenerateResult> {
  return generate(
    { capability: 'chat', provider: opts.provider, model: opts.model, taskId: opts.taskId, messages: opts.messages, images: opts.images, temperature: opts.temperature, responseFormat: opts.responseFormat },
    undefined,
    opts.signal
  )
}

/**
 * chat 流式（AI 助手专用）。返回**未消费 body** 的原始 Response，SSE 逐块解析交给调用方。
 * 本函数负责出站 + 错误归一（修正 5）：非 2xx HttpError → 经 parseAgentError 统一文案，
 * 缺省 parseAgentError 则退化成裸错误（不静默吞错、不伪造不了真实原因）。
 *  - stream 默认 true（SSE 打字机 + tool_calls delta）；false 走同步 JSON（后端按 config）。
 *  - 中止（signal.aborted）原样上抛，不做错误归一，避免把取消误判成失败。
 */
export async function chatStream(opts: {
  provider: GenerationProvider
  model: string
  messages: ChatMessage[]
  tools?: unknown[]
  taskId?: string
  stream?: boolean
  signal?: AbortSignal
  /** 错误归一入口：HttpError → 统一文案（来自 agentCore）。 */
  parseAgentError?: (res: { status: number; text: () => Promise<string> }, fallback: string) => Promise<string>
}): Promise<Response> {
  try {
    return await relayChatStream({
      intent: {
        frontTaskId: opts.taskId || '',
        providerId: opts.provider?.id || 'lovart',
        model: opts.model,
        messages: opts.messages,
      },
      tools: opts.tools,
      stream: opts.stream,
      signal: opts.signal,
      label: 'chatStream',
    })
  } catch (e) {
    // 中止：原样上抛（用户取消不是失败，不做文案归一）
    if (opts.signal?.aborted) throw e
    const he = e as { name?: string; status?: number; data?: unknown } | null
    if (he && he.name === 'HttpError') {
      const fake = { status: he.status ?? 0, text: async () => (he.data != null ? JSON.stringify(he.data) : '') }
      throw new Error(opts.parseAgentError ? await opts.parseAgentError(fake, '调用失败') : '调用失败')
    }
    // 网络/超时/取消等异常：原样上抛，保留原始 stack（失败可见禁令）
    throw e
  }
}