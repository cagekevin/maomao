/**
 * 请求形态层（前端镜像）—— 对应 localTool/src/routes/requestModes.ts（后端基准层 + 单测）。
 * 规则唯一真相在后端 requestModes.ts；本文件镜像同规则供请求路径消费（同 providerProtocols.js
 * 镜像 protocolAdapters.ts 的先例）。改规则需两端同步 + 后端单测锁定。
 *
 * 用途：让 image_request_mode 4 形态真正驱动生图端点/body/响应解析（消灭死字段，PRD 翻车点 1）。
 * 纯函数、无副作用。
 */

/** 必须走 /v1/responses 的模型（chat/completions 不支持其工具调用）。单一真相，改规则两端同步。 */
export const REQUIRES_RESPONSES_MODEL = /gpt-5\.6|gpt-5-6/

/** 生图形态 → 端点 path（相对 provider base）。未知/空 → 默认 openai（M2-5 保守）。 */
export function imageModePath(mode: string): string {
  switch (mode) {
    case 'openai-responses': return 'responses'
    case 'openai-video-proxy': return 'videos'
    case 'openai-json':
    case 'openai':
    default: return 'images/generations'
  }
}

/** 是否 responses 形态（聊天/生图共用，单一真相不做域名嗅探）。 */
export function isResponsesMode(mode: string | undefined): boolean {
  return mode === 'openai-responses' || mode === 'responses'
}

/** responses 的 input 数组：文本 input_text，参考图 input_image（只收 image，契约 E7）。 */
export function buildResponsesInput(prompt: string, images: unknown[] = []): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }]
  for (const img of images) {
    if (typeof img === 'string' && img.trim()) input.push({ type: 'input_image', image_url: img.trim() })
  }
  return input
}

/** responses 生图请求体（size 在 tool 内部，不在顶层）。 */
export function buildResponsesImageBody(p: { model: string; prompt: string; images?: unknown[]; size?: string; quality?: string }): Record<string, unknown> {
  const { model, prompt, images = [], size = '', quality } = p
  const tool: Record<string, unknown> = { type: 'image_generation' }
  if (size) tool.size = size
  return { model, input: buildResponsesInput(prompt, images), tools: [tool], tool_choice: 'auto' }
}

/** 从 responses output[] 提取生图 URL（image_generation_call + completed 的 result）。 */
export function parseResponsesImage(data: unknown): string | undefined {
  const output = Array.isArray((data as Record<string, unknown>)?.output) ? ((data as Record<string, unknown>).output as unknown[]) : []
  for (const item of output) {
    const it = item as Record<string, unknown>
    if (it?.type === 'image_generation_call' && it?.status === 'completed'
      && typeof it?.result === 'string' && (it.result as string).trim()) {
      return (it.result as string).trim()
    }
  }
  return undefined
}

/** 文本 → 首张图片 URL：markdown 优先，裸 URL 兜底（H2）。 */
export function extractMarkdownImage(text: string): string | undefined {
  if (!text) return undefined
  const md = text.match(/!\[[^\]]*\]\(([^)]+)\)/)
  if (md) return md[1].trim()
  const bare = text.match(/(https?:\/\/[^\s"'<>)]+)/)
  return bare ? bare[1].replace(/[.,;]$/, '') : undefined
}

/** responses 生图响应解析（H2 兜底链）：image_generation_call → output_text markdown。 */
export function parseResponsesJson(data: unknown): string | undefined {
  const direct = parseResponsesImage(data)
  if (direct) return direct
  const d = data as Record<string, unknown>
  const output = Array.isArray(d?.output) ? (d.output as unknown[]) : []
  const texts: string[] = []
  for (const item of output) {
    const it = item as Record<string, unknown>
    if (it?.type === 'output_text' && typeof it?.text === 'string') texts.push(it.text as string)
    if (it?.type === 'message' && Array.isArray(it?.content)) {
      for (const c of it.content as unknown[]) {
        const cc = c as Record<string, unknown>
        if (cc?.type === 'output_text' && typeof cc?.text === 'string') texts.push(cc.text as string)
      }
    }
  }
  return extractMarkdownImage(texts.join('\n'))
}

/**
 * 工具调用归一（M2-4）：responses function_call / chat message.tool_calls → 统一
 * { id, type:'function', function:{ name, arguments } }，供现有 agent 工具循环消费。
 */
export function normalizeToolCalls(source: unknown): Array<{ id?: string; type: 'function'; function: { name: string; arguments?: string } }> {
  const s = source as Record<string, unknown>
  const output = Array.isArray(source) ? (source as unknown[]) : (Array.isArray(s?.output) ? (s.output as unknown[]) : [])
  const out: Array<{ id?: string; type: 'function'; function: { name: string; arguments?: string } }> = []
  for (const tc of output) {
    const item = tc as Record<string, unknown>
    const fn = item?.function as Record<string, unknown> | undefined
    if (fn && typeof fn.name === 'string') {
      out.push({ id: item.id as string | undefined, type: 'function', function: { name: fn.name, arguments: fn.arguments as string | undefined } })
    } else if (item?.type === 'function_call' && typeof item?.name === 'string') {
      out.push({ id: item.call_id as string | undefined, type: 'function', function: { name: item.name as string, arguments: item.arguments as string | undefined } })
    }
  }
  return out
}

/**
 * 聊天形态归一（M2-2）：决定聊天走 /v1/responses 还是 /v1/chat/completions。
 * 优先级：
 *   1. 手动配置 provider.chat_request_mode === 'responses' → responses（用户显式指定）
 *   2. 否则按模型自动判断：gpt-5.6 系（仅 responses 端点支持工具）→ responses
 *   3. 默认 chat（现有 chat/completions 模型零改动，M2-5 保守）
 * @param {string|undefined} mode provider.chat_request_mode
 * @param {string} model 当前聊天模型名（用于自动判断）
 */
export function resolveChatMode(mode: string | undefined, model = ''): 'responses' | 'chat' {
  if (isResponsesMode(mode)) return 'responses'
  // 自动判断：gpt-5.6 系模型在 chat/completions 不支持 tools，必须走 responses
  const m = String(model || '').toLowerCase()
  if (REQUIRES_RESPONSES_MODEL.test(m)) return 'responses'
  return 'chat'
}

/**
 * responses 聊天请求体（M2-2）：input 数组 + tools 顶层 name（不是 function 嵌套，
 * 实测 APM 报 `Missing required parameter: 'tools[0].name'`）。
 *  - system/user/assistant 文本 → { role, content:[input_text] }；image_url → input_image；
 *  - assistant 历史 tool_calls → function_call 项；
 *  - role='tool'（工具结果）→ function_call_output（call_id + output）。
 */
export function buildResponsesChatBody(p: {
  model: string
  messages?: unknown[]
  toolSchemas?: unknown[]
  temperature?: number
  stream?: boolean
  responseFormat?: string
}): Record<string, unknown> {
  const { model, messages = [], toolSchemas = [], temperature, stream, responseFormat } = p
  const input: unknown[] = []
  for (const m of messages) {
    const msg = m as Record<string, unknown>
    if (msg?.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: (msg.tool_call_id as string) || '',
        output: typeof msg.content === 'string' ? (msg.content as string) : JSON.stringify(msg?.content ?? ''),
      })
      continue
    }
    // Responses API 中 content 元素类型随角色而定：
    //  - user:    input_text / input_image
    //  - assistant: 只能 output_text / refusal（上游用 input_text 会报
    //    "Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'"）
    const isAssistant = msg?.role === 'assistant'
    const items = Array.isArray(msg?.content) ? (msg.content as unknown[]) : [{ type: isAssistant ? 'output_text' : 'input_text', text: typeof msg?.content === 'string' ? (msg.content as string) : String(msg?.content ?? '') }]
    const mapped = (items || []).map((c) => {
      const cc = c as Record<string, unknown>
      if (cc?.type === 'image_url') {
        const raw = (cc?.image_url as Record<string, unknown>)?.url || cc?.image_url
        return { type: 'input_image', image_url: raw, detail: (cc?.image_url as Record<string, unknown>)?.detail }
      }
      if (cc?.type === 'text') return { type: isAssistant ? 'output_text' : 'input_text', text: cc.text }
      // 保留显式给出的 output_text（assistant 历史回传），其余原样透传
      return c
    })
    input.push({ role: msg?.role, content: mapped })
    if (Array.isArray(msg?.tool_calls)) {
      for (const tc of msg.tool_calls as unknown[]) {
        const t = tc as Record<string, unknown>
        input.push({
          type: 'function_call',
          call_id: (t?.id as string) || '',
          name: (t?.function as Record<string, unknown>)?.name || '',
          arguments: (t?.function as Record<string, unknown>)?.arguments || '{}',
        })
      }
    }
  }
  const body: Record<string, unknown> = { model, input }
  if (typeof temperature === 'number') body.temperature = temperature
  if (typeof stream === 'boolean') body.stream = stream
  if (responseFormat) body.text = { format: { type: responseFormat } }
  if (toolSchemas?.length) {
    body.tools = toolSchemas.map((t) => {
      const tt = t as Record<string, unknown>
      const fn = tt?.function as Record<string, unknown> | undefined
      return {
        type: 'function',
        name: fn?.name || tt?.name || '',
        description: fn?.description || '',
        parameters: fn?.parameters || {},
      }
    })
    body.tool_choice = 'auto'
  }
  return body
}

/**
 * responses 聊天响应解析（非流式，M2-2/M2-4）：
 *   output[] 的 message → content[].text 拼 content；function_call → 归一 tool_calls。
 */
export function parseResponsesChatJson(json: unknown): { content: string; toolCalls: unknown[] } {
  const content: string[] = []
  const toolCalls: unknown[] = []
  const d = json as Record<string, unknown>
  const output = Array.isArray(d?.output) ? (d.output as unknown[]) : []
  for (const item of output) {
    const it = item as Record<string, unknown>
    if (it?.type === 'message' && Array.isArray(it?.content)) {
      for (const c of it.content as unknown[]) {
        const cc = c as Record<string, unknown>
        if (cc?.type === 'output_text' && typeof cc?.text === 'string') content.push(cc.text as string)
      }
    } else if (it?.type === 'function_call' && typeof it?.name === 'string') {
      toolCalls.push({ id: it.call_id || '', type: 'function', function: { name: it.name as string, arguments: it.arguments || '' } })
    }
  }
  return { content: content.join(''), toolCalls }
}

/**
 * responses 聊天 SSE 增量解析（M2-3，流式）：
 *   response.output_text.delta 拼文本；response.reasoning_summary_text.delta 拼推理；
 *   response.function_call_arguments.delta（含 .done）拼工具名与参数。
 *   acc 与 parseSSEChunk 同构（{content, reasoning, toolCalls}），可无损并入 roundTrip 循环。
 */
/** SSE 累积器：content/reasoning 文本 + toolCalls 归一数组（元素可被逐 delta 增量改写）。 */
interface SSEAcc {
  content: string
  reasoning: string
  toolCalls: Array<{ id?: string; type: 'function'; function: { name: string; arguments: string } }>
}

function parseResponsesSSEDataLine(line: string, acc: SSEAcc): void {
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return
  try {
    const evt = JSON.parse(payload)
    const type = evt?.type
    // output_item.added（type=function_call）→ 真实上游在此时携带函数名与 call_id
    //（function_call_arguments.delta/done 里没有 name，只有 arguments）。
    if (type === 'response.output_item.added' && evt?.item?.type === 'function_call') {
      acc.toolCalls[0] ||= { id: '', type: 'function', function: { name: '', arguments: '' } }
      if (typeof evt.item.call_id === 'string' && !acc.toolCalls[0].id) acc.toolCalls[0].id = evt.item.call_id
      if (typeof evt.item.name === 'string' && !acc.toolCalls[0].function.name) acc.toolCalls[0].function.name = evt.item.name
    } else if (type === 'response.output_text.delta' && typeof evt?.delta === 'string') acc.content += evt.delta
    else if (type === 'response.reasoning_summary_text.delta' && typeof evt?.delta === 'string') acc.reasoning += evt.delta
    else if (type === 'response.response.delta' && Array.isArray(evt?.delta?.output_text)) {
      for (const o of evt.delta.output_text) if (typeof o?.text === 'string') acc.content += o.text
    } else if (type === 'response.function_call_arguments.delta' && typeof evt?.delta === 'string') {
      acc.toolCalls[0] ||= { id: '', type: 'function', function: { name: '', arguments: '' } }
      if (typeof evt?.name === 'string') acc.toolCalls[0].function.name += evt.name
      if (typeof evt?.call_id === 'string' && !acc.toolCalls[0].id) acc.toolCalls[0].id = evt.call_id
      acc.toolCalls[0].function.arguments += evt.delta
    } else if (type === 'response.function_call_arguments.done') {
      acc.toolCalls[0] ||= { id: '', type: 'function', function: { name: evt?.name || '', arguments: evt?.arguments || '' } }
      if (typeof evt?.call_id === 'string') acc.toolCalls[0].id = evt.call_id
      if (typeof evt?.name === 'string' && !acc.toolCalls[0].function.name) acc.toolCalls[0].function.name = evt.name
      if (typeof evt?.arguments === 'string') acc.toolCalls[0].function.arguments = evt.arguments
    }
  } catch {
    /* 忽略单条解析失败 */
  }
}

/**
 * responses 聊天 SSE 增量解析（M2-3，流式）——兼容带 `event:` 前缀的 SSE 块。
 * 上游（apimart responses 端点）返回标准 SSE 块形如：
 *   event: response.output_text.delta\n
 *   data: {"type":"response.output_text.delta",...}\n
 *   \n
 * roundTrip 按 \n\n 分块后，chunk 以 `event:` 开头，若按「整块必须 data: 开头」会全部漏解析
 * （表现为 status 200 但 contentLen=0）。这里按行遍历，忽略 event:/空行，逐个解析 data: 行。
 */
export function parseResponsesSSEChunk(line: string, acc: SSEAcc = { content: '', reasoning: '', toolCalls: [] }): void {
  if (!line) return
  const lines = line.split('\n')
  for (const l of lines) {
    const t = l.trimEnd()
    if (t.startsWith('data:')) parseResponsesSSEDataLine(t, acc)
    // event: 行、空行、其他 SSE 元信息行：忽略
  }
}

/** 友好错误降级提示（G1）：命中给中文提示，未命中空串原样透传。 */
export function friendlyRequestError(text: string): string {
  const s = String(text || '').toLowerCase()
  if (/reasoning_effort/.test(s)) return '该模型不支持在 chat/completions 用工具，建议改用 responses 端点或换模型'
  if (/(?:401)|(?:unauthorized)|(?:invalid.{0,10}(?:api.?key|key))|(?:api.?key.{0,10}invalid)/.test(s)) return 'API Key 无效或已过期'
  if (/(?:429)|(?:rate\s*limit)|(?:too many requests)/.test(s)) return '请求过于频繁，稍后再试'
  if (/(?:not found)|(?:invalid endpoint)|(?:failed to find model)|(?:model.*select)/.test(s)) return '模型不存在或需改用 ep- 接入点'
  return ''
}