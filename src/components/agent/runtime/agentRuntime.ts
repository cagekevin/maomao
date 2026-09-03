/**
 * ════════════════════════════════════════════════════════════════
 * agentRuntime —— AI 助手「运行时逻辑」下沉模块（依赖注入）
 * ════════════════════════════════════════════════════════════════
 *
 * 【职责】从 useAgentChat.ts 抽出的「需要外部依赖、但本身不是 React hook」的
 *   运行时逻辑。它们不再持有 hook 闭包，而是通过显式 ctx（上下文）注入依赖，
 *   由 useAgentChat 在调用点构造 ctx。包含：
 *     · roundTrip         单次 LLM 请求（流式 SSE / 非流式 JSON 双模式）
 *     · runToolCalls      执行一批工具调用并回填 tool 消息
 *     · runDemoMode       Demo 规则引擎分支（VITE_AGENT_DEMO='1'）
 *
 * 【为何依赖注入而非直接 import】这些函数原在 hook 内闭包使用 model/callTool/
 * appendMsg/toolSchemas/provider 等**由 hook 持有的状态**。直接 import 会引入
 * 模块级副作用或导致多实例状态串台；改为 ctx 注入后，模块可独立单测、
 * 不绑定 React 生命周期，且行为与拆分前完全一致。
 *
 * 【与 useAgentChat 的契约】本模块不 import React，不触碰 messagesRef/
 * sendingRef/abortRef/stateMachineRef 等 hook 可变 ref。所有对「历史/发送态」
 * 的读写都经由 ctx 里注入的 appendMsg/callTool 完成，绝不绕过 hook 的消息同步。
 *
 * 【改动优先级】低于 agentCore（纯函数）——runToolCalls/roundTrip 涉及工具
 * 执行与 LLM 通信，改这里必读 useAgentChat.ts 调用点及 docs/12-ai助手架构.md。
 * ════════════════════════════════════════════════════════════════
 */

// 可插拔协议适配器：统一 URL 拼装（openai 伪协议 / apimart base_url），避免散落协议判断
import { buildTargetUrl } from '../../base/providerProtocols.ts'
// 【出口回收】proxy 分支走 /api/proxy 经统一 httpRequest（B5），不裸写 fetch
import { httpRequest } from '@/components/base/api/index.ts'
// 请求形态层：聊天 responses 形态（gpt-5.6 用 /v1/responses 带工具不再报错，M2-2/M2-4）
import { resolveChatMode, buildResponsesChatBody, parseResponsesChatJson, parseResponsesSSEChunk } from '../../base/requestModes.ts'
// AI 助手配置真源（docs/66 §4/A 层）：聊天温度从 agentConfig 读取，不再硬编码
import { AGENT_TEMPERATURE } from '../agentConfig.ts'
// 复用 agentCore 的权威消息/工具调用类型（同 runtime 目录，避免重定义漂移）
import type { ChatMessage, ToolCall } from './agentCore.ts'

/** roundTrip 返回的 assistant 消息：在 ChatMessage 基础上携带运行期必填字段。 */
interface RuntimeAssistantMessage extends ChatMessage {
  model: string
  createdAt: number
}

/** ══════════════════════════════════════════════════════════════════════════════
 *  roundTrip —— 单次 LLM 请求（复刻官方 dr:2579-2778 的 v）。
 * ══════════════════════════════════════════════════════════════════════════════
 *  支持流式（stream:true + SSE）与非流式（stream:false + 普通 JSON）两种模型：
 *  - 流式（默认）：传 tools（function calling），SSE 逐块解析。
 *  - 非流式：AI 助手设置里标注「非流式」时走普通 JSON 响应解析。默认不开工具。
 *
 *  @param {object} ctx 注入依赖：
 *    - endpoint:      LLM 端点 URL（useAgentChat 计算：CHAT_BASE_URL 或 /api/agent/:key/chat）
 *    - model:         当前模型名
 *    - toolSchemas:   工具 schema 数组（来自 useCanvasAgentTools）
 *    - provider:      主供应商对象（存在 → /api/proxy 链路）
 *    - apiBase:       API_BASE（本地网关地址）
 *    - chatApiKey:    CHAT_API_KEY（可选 Bearer）
 *    - logger:        链路日志对象
 *    - loadAgentChatModel: () => 读取 agentModelStore 的聊天模型配置
 *    - parseAgentError:  (res, fallback) => 统一错误解析（来自 agentCore）
 *    - parseSSEChunk:    (line, acc) => SSE 增量解析（来自 agentCore）
 *  @param {Array} requestMessages 发给 LLM 的 messages（buildRequestMessages 产物）
 *  @param {AbortSignal} signal     取消信号
 *  @param {Function} onStream      流式回调（content/reasoning/toolCalls）
 *  @returns {Promise<{ role, content, reasoning?, tool_calls? }>}
 */
export async function roundTrip(ctx, requestMessages, signal, onStream) {
  const { endpoint, model, toolSchemas, provider, apiBase, chatApiKey, logger, loadAgentChatModel, parseAgentError, parseSSEChunk, ENABLE_TOOLS_ON_NON_STREAM } = ctx
  // 读取 AI 助手聊天模型配置：判断是否非流式（non-stream 模型不支持工具，仅对话）
  const streamMode = loadAgentChatModel()?.streamMode || 'stream'
  const isNonStream = streamMode === 'non-stream'
  // 非流式默认不传 tools；开启 ENABLE_TOOLS_ON_NON_STREAM 开关后两者都传（保持工具调用能力）。
  const withTools = !isNonStream || ENABLE_TOOLS_ON_NON_STREAM
  // 聊天请求形态（M2-2）：provider.chat_request_mode === 'responses' → /v1/responses（gpt-5.6 带工具）。
  // 默认 chat，走 /v1/chat/completions，现有模型零改动。
  const isResponsesChat = resolveChatMode(provider?.chat_request_mode, model) === 'responses'
  // 【工具门禁】一次请求的关键判定日志：便于诊断「AI 是否拿到工具、为何不用」。
  //  - toolSchemaCount=0            → toolSchemas 空（工具注册表问题，见 useCanvasAgentTools AGENT_TOOLS）
  //  - withTools=false              → 模型被配成非流式 且 未开 ENABLE_TOOLS_ON_NON_STREAM（工具被主动关闭）
  //  - withTools=true 且 count>0 但 AI 仍不调工具 → 属 LLM/网关侧行为（继续看下方「流式结果」的 toolCallCount）
  // 仅 debug 模式输出（logger.debug + { module:'agent' }，见 config.js DEBUG_MODULES/前端调试模式开关）
  logger.debug('AI助手', '[工具门禁]', {
    streamMode, isNonStream, withTools,
    toolSchemaCount: Array.isArray(toolSchemas) ? toolSchemas.length : 0,
    toolNames: Array.isArray(toolSchemas) ? toolSchemas.map((t) => t?.function?.name).filter(Boolean).slice(0, 20) : [],
    model, isResponsesChat,
  }, { module: 'agent' })
  const llmBody = isResponsesChat
    ? buildResponsesChatBody({
        model,
        messages: requestMessages,
        toolSchemas: withTools ? toolSchemas : [],
        // 注意：responses 端点（gpt-5.6 系）不支持 temperature 参数，
        // 传了会报 "Unsupported parameter: 'temperature' is not supported with this model."
        stream: !isNonStream,
      })
    : {
        model,
        messages: requestMessages,
        stream: !isNonStream,
        temperature: AGENT_TEMPERATURE,
        ...(withTools ? { tools: toolSchemas, tool_choice: 'auto' } : {})
      }
  // 是否走「多 provider /api/proxy 转发」：provider 存在时（如魔搭，支持 function calling）
  const useProxy = !!provider
  // 非流式响应是普通 JSON，Accept 无需 text/event-stream
  const accept = isNonStream ? 'application/json' : 'text/event-stream'
  // 【链路日志】请求到网关：走 proxy 还是直接 /api/agent，模型、流式模式、消息数、是否带工具
  logger.info('AI助手', '请求', { via: useProxy ? 'proxy' : 'agent', provider: provider?.id || '', model, stream: !isNonStream, msgCount: requestMessages.length, tools: withTools ? (toolSchemas || []).length : 0 })
  // 【B层】发往 LLM 的 messages 明细：每条约化（role + 是否有图 + content 长度 + 工具数）——定位发给模型的内容
  logger.debug('AI助手', '[请求] messages', {
    count: requestMessages.length,
    roles: requestMessages.map((m) => m.role),
    firstContentHead: requestMessages.find((m) => m.role === 'user')?.content ? String(requestMessages.find((m) => m.role === 'user').content).slice(0, 120) : '',
  }, { module: 'agent' })
  // ── [debug] 非流式链路 · 跳①：请求形态判定 + body 构造 ──
  logger.debug('AI助手', '[非流式] 跳①形态', {
    streamMode, isNonStream, isResponsesChat, withTools,
    bodyKeys: Object.keys(llmBody),
    bodyStream: llmBody.stream,
    msgCount: requestMessages.length,
    hasImageInBody: JSON.stringify(llmBody).includes('image_url') || JSON.stringify(llmBody).includes('input_image'),
  }, { module: 'agent' })
  // 【出口回收说明（B5）】本请求是 SSE 流式读 body 流 + 非流式普通 JSON 双模式，可走两条链路：
  //  - proxy 分支（provider 存在走 /api/proxy 转发）经 httpRequest 出站 —— 用 SSE 模式
  //    （timeoutMs:0 不被 15s 掐断 + retries:0 + parseJson:false 返回未消费原始 Response），
  //    回炉的是「HTTP 语义」，SSE 行协议豁免红线（缺口⑦/M5-e）不破；
  //  - 直连官方分支（/api/agent/...，M1-a③ 白名单）保留原生 fetch，避免改动其既有 rejection 语义。
  // 响应仍由下方逐块解析 event 驱动多轮工具循环，与拆分前行为一致。
  // ── [debug] 非流式链路 · 跳②：fetch 发送（记录目标 URL + body 摘要） ──
  // 【2026-09-03 统一收口】provider 存在（AI 助手默认恒有）→ 发 GenIntent 打统一生成入口
  // POST /api/generate（capability=chat + tools + stream:true），后端 relayChatStream 透传 SSE；
  // 前端 SSE 解析 / tool_calls delta 解析原样保留（打字机不丢）。旧 /api/proxy 已退役。
  const relayBody = useProxy
    ? {
        providerId: provider?.id,
        capability: 'chat',
        model,
        messages: requestMessages,
        ...(withTools ? { tools: toolSchemas, tool_choice: 'auto' } : {}),
        // 流式：带 tools/AI 助手默认 → 后端 relayChatStream 透传 SSE（打字机+tool_calls delta）；
        // 非流式（streamMode=non-stream）→ stream:false，后端同步 JSON。
        stream: !isNonStream,
      }
    : null
  logger.debug('AI助手', '[非流式] 跳②发送', {
    via: useProxy ? 'relay' : 'agent',
    target: useProxy ? `${apiBase}/api/generate` : endpoint,
    bodyLen: JSON.stringify(relayBody ?? llmBody).length,
    hasImage: JSON.stringify(relayBody ?? llmBody).includes('image_url') || JSON.stringify(relayBody ?? llmBody).includes('input_image'),
    accept,
  }, { module: 'agent' })
  let res
  if (useProxy) {
    try {
      res = await httpRequest(`${apiBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: accept },
        body: JSON.stringify(relayBody),
        signal,
        timeoutMs: 0,
        retries: 0,
        parseJson: false,
        label: 'agentRoundTrip.relay',
      })
    } catch (e) {
      if (e?.name === 'HttpError') {
        logger.error('AI助手', '请求失败', { status: e.status, via: 'proxy', model })
        // httpRequest 已在 HttpError 携带上游错误体，重建 res 供 parseAgentError 走统一「代理转发失败」文案
        const fake = { status: e.status, text: async () => (e.data != null ? JSON.stringify(e.data) : '') }
        throw new Error(await parseAgentError(fake, '代理转发失败'))
      }
      // 网络/超时/取消：原样上抛（与直连官方 fetch 的 rejection 语义一致）
      throw e
    }
  } else {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: accept,
        ...(chatApiKey ? { Authorization: `Bearer ${chatApiKey}` } : {})
      },
      body: JSON.stringify(llmBody),
      signal
    })
  }
  if (!res.ok) {
    // 仅直连官方分支会走到这里（proxy 分支非 2xx 已在上方 catch 抛错）
    logger.error('AI助手', '请求失败', { status: res.status, via: useProxy ? 'proxy' : 'agent', model })
    throw new Error(await parseAgentError(res, useProxy ? '代理转发失败' : '调用失败'))
  }
  // 【链路日志】到网关成功拿到响应头（HTTP 状态）
  logger.info('AI助手', '响应', { status: res.status, via: useProxy ? 'proxy' : 'agent', stream: !isNonStream })

  // ── 非流式：普通 JSON 响应 ──
  // 【加固】非流式一次性读取整个响应体，遇网关/代理缓冲断流、content-length 不符等会截断 JSON。
  // 原 `res.json().catch(()=>({}))` 会把截断的非法 JSON 静默吞成 {} → content 变 '' →
  // 文字与图片 URL 全丢且无任何提示（偶发、难定位）。改为：先读 text → 容错解析，解析失败
  // 兜底为原始文本（渲染层仍能从文本抽 URL 出图），并打 ERROR 日志，绝不静默丢内容。
  if (isNonStream) {
    const rawText = await res.text().catch(() => '')
    const json = safeParseNonStreamJSON(rawText, logger)
    // ── [debug] 非流式链路 · 跳③：响应体读取 + 解析结果（定位"收不到回复"） ──
    logger.debug('AI助手', '[非流式] 跳③响应体', {
      rawLen: rawText.length,
      jsonParsed: !!json,
      rawHead: rawText.slice(0, 200),
      isResponsesChat,
    }, { module: 'agent' })
    // responses 形态：output[] 里取 message.content[].text + function_call（挂 unmooted，下面统一归一手）
    if (isResponsesChat) {
      const { content: rContent, toolCalls: rCalls } = parseResponsesChatJson(json || {})
      const rAssistant: RuntimeAssistantMessage = {
        role: 'assistant',
        content: rContent || (rawText && !json ? rawText : ''),
        model, createdAt: Date.now(),
      }
      if (rCalls.length > 0) rAssistant.tool_calls = rCalls
      if (rawText && !json) logger.error('AI助手', 'responses 非流式解析失败(可能截断)', { rawLen: rawText.length, head: rawText.slice(0, 120) })
      logger.debug('AI助手', '[非流式] 跳③ responses解析', { rContentLen: rContent.length, rCallCount: rCalls.length, rCalls }, { module: 'agent' })
      onStream?.({ content: rAssistant.content, reasoning: '', toolCalls: rAssistant.tool_calls || [] })
      logger.info('AI助手', 'responses 非流式结果', { contentLen: rAssistant.content.length, toolCallCount: rCalls.length })
      return rAssistant
    }
    const msg = json?.choices?.[0]?.message || {}
    logger.debug('AI助手', '[非流式] 跳③ chat解析', {
      jsonKeys: json ? Object.keys(json) : [],
      choicesLen: json?.choices?.length ?? 0,
      msgKeys: Object.keys(msg),
      msgContentType: typeof msg?.content,
      msgContentLen: typeof msg?.content === 'string' ? msg.content.length : (msg?.content == null ? 0 : 'non-string'),
      msgHasToolCalls: Array.isArray(msg?.tool_calls),
    }, { module: 'agent' })
    // 【兜底】解析失败（被截断/非 JSON）时，把原始文本当 content 保留，避免整条回复消失。
    // 渲染层 extractImageSpans 仍能从纯文本里抽 URL 渲染图片。
    const content = (msg?.content != null && String(msg.content).length > 0)
      ? String(msg.content)
      // 【统一收口】AI 助手非流式走 /api/generate 同步，后端返回 relay 信封 {code,data:{status:'completed',text}}，
      // 非 OpenAI choices 结构 —— 需兼容 data.text，否则拿不到文本（非流式"不生效"根因）。
      : (typeof json?.data?.text === 'string' && json.data.text ? String(json.data.text)
      : (rawText && !json ? rawText : ''))
    const assistant: RuntimeAssistantMessage = { role: 'assistant', content, model, createdAt: Date.now() }
    // 【非流式工具】若开启 ENABLE_TOOLS_ON_NON_STREAM，响应里可能带 tool_calls（OpenAI 兼容
    //   格式：message.tool_calls: [{ id, type, function:{ name, arguments } }]）。解析后放进
    //   assistant，send 主循环即按工具调用处理（过滤空 name、多轮循环收敛）。
    if (ENABLE_TOOLS_ON_NON_STREAM && Array.isArray(msg.tool_calls)) {
      const calls = msg.tool_calls
        .map((tc) => tc?.function?.name ? { id: tc.id || '', type: tc.type || 'function', function: { name: tc.function.name, arguments: tc.function.arguments || '' } } : null)
        .filter(Boolean)
      if (calls.length > 0) assistant.tool_calls = calls
    }
    // 【链路日志】截断告警：原始文本非空但未能解析出正常 message，提示可能丢内容。
    if (rawText && !json) logger.error('AI助手', '非流式解析失败(可能截断)', { rawLen: rawText.length, head: rawText.slice(0, 120) })
    onStream?.({ content: assistant.content, reasoning: '', toolCalls: assistant.tool_calls || [] })
    logger.info('AI助手', '非流式结果', { contentLen: assistant.content.length, rawLen: rawText.length, toolCallCount: (assistant.tool_calls || []).length })
    return assistant
  }

  // ── 流式：SSE 逐块解析 ──
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  const acc = { content: '', reasoning: '', toolCalls: [] }

  // 【吞输出兜底】部分模型/网关在 streamMode='stream' 时仍返回「普通 JSON 非流式响应」
  //（choices[0].message.content，而非 choices[0].delta 的 SSE）。parseSSEChunk 只认 data: 前缀，
  //  会把这类响应整个吞掉（status 200 但 contentLen=0，且无任何提示）。
  //  这里在 acc 尚无内容时，尝试把「合法完整 JSON 对象」按非流式结构解析出 content/tool_calls，
  //  避免输出被静默吞掉。命中返回 true；不命中（真 SSE / 非法 JSON / 已有内容）返回 false，不影响主链路。
  const tryParseNonStreamJsonFallback = (text: string): boolean => {
    if (acc.content || acc.reasoning || acc.toolCalls.length) return false
    const t = String(text || '').trim()
    if (!t.startsWith('{')) return false
    try {
      const json = JSON.parse(t)
      const msg = json?.choices?.[0]?.message
      if (!msg || typeof msg !== 'object') return false
      let hit = false
      if (typeof msg.content === 'string' && msg.content) {
        acc.content += msg.content
        hit = true
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc?.function?.name) {
            acc.toolCalls.push({
              id: tc.id || '',
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments || '' },
            })
            hit = true
          }
        }
      }
      if (hit) {
        logger.warn('AI助手', '流式收到非流式JSON响应，已兜底解析（避免吞输出）', {
          contentLen: (msg.content || '').length,
          toolCallCount: Array.isArray(msg.tool_calls) ? msg.tool_calls.length : 0,
        })
      }
      return hit
    } catch {
      return false
    }
  }

  // 流式回调（节流 50ms，复刻官方 v）
  let lastFlush = 0
  let pendingFlush = false
  const flush = () => {
    lastFlush = Date.now()
    pendingFlush = false
    onStream?.({
      content: acc.content,
      reasoning: acc.reasoning,
      toolCalls: [...acc.toolCalls]
    })
  }
  const scheduleFlush = () => {
    const now = Date.now()
    if (now - lastFlush >= 50) flush()
    else if (!pendingFlush) {
      pendingFlush = true
      setTimeout(flush, 50 - (now - lastFlush))
    }
  }

  let _totalBytes = 0 // 【B层】累计收到的 SSE 字节数（定位流式是否被缓冲/断流）
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength) _totalBytes += value.byteLength
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const chunk of parts) {
      const before = acc.content.length + acc.reasoning.length + acc.toolCalls.length
      // 请求形态差异：responses 走自带 SSE 事件解析，chat/completions 走原 parseSSEChunk
      if (isResponsesChat) parseResponsesSSEChunk(chunk, acc)
      else if (!parseSSEChunk(chunk, acc)) {
        // parseSSEChunk 返回 false（非 data: 前缀）→ 尝试非流式 JSON 兜底，防吞输出
        tryParseNonStreamJsonFallback(chunk)
        scheduleFlush()
        continue
      }
      if (acc.content.length + acc.reasoning.length + acc.toolCalls.length > before) scheduleFlush()
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    // 末尾残余：responses 走 SSE，chat 先走 SSE、非 data: 再尝试非流式 JSON 兜底（单行 JSON 落这里）
    if (isResponsesChat) parseResponsesSSEChunk(buffer, acc)
    else if (!parseSSEChunk(buffer, acc)) tryParseNonStreamJsonFallback(buffer)
  }
  flush()

  const assistant: RuntimeAssistantMessage = { role: 'assistant', content: acc.content || '', model, createdAt: Date.now() }
  if (acc.reasoning) assistant.reasoning = acc.reasoning
  // 【根因修复】必须基于「过滤后的真实 tool_calls」判断，而非 acc.toolCalls.length。
  // parseSSEChunk 会为每段 tool_calls 创建占位（name 可能为空），若流里 tool_calls 的 name
  // 未拼全/为空，acc.toolCalls 有占位但 filter 后为空 → 旧代码 `if(acc.toolCalls.length>0)`
  // 仍设 `tool_calls:[]`（空数组）→ 存进历史 → 下次发给 LLM 报 Empty tool_calls。
  // 改为：filter 后非空才设，空则完全不设，杜绝空数组。
  const realCalls = acc.toolCalls.filter((t) => t.function?.name)
  if (realCalls.length > 0) assistant.tool_calls = realCalls
  // 【链路日志】流式响应完成：内容长度 + 触发的工具调用
  logger.info('AI助手', '流式结果', { contentLen: assistant.content.length, toolCallCount: realCalls.length, toolNames: realCalls.map((t) => t.function?.name) })
  logger.debug('AI助手', '[流式] 完成', { bytes: _totalBytes, contentLen: assistant.content.length, reasoningLen: (assistant.reasoning || '').length, toolNames: realCalls.map((t) => t.function?.name) }, { module: 'agent' })
  return assistant
}

/** ══════════════════════════════════════════════════════════════════════════════
 *  safeParseNonStreamJSON —— 非流式响应体容错解析（加固截断场景）。
 * ══════════════════════════════════════════════════════════════════════════════
 *  非流式一次性读取整段 JSON，遇网关/代理断流会被截断成非法 JSON。此函数分级兜底：
 *    1) 直接 JSON.parse（理想情况）；
 *    2) 去掉首尾 ```json / ``` 围栏后重试（模型偶有代码块包裹）；
 *    3) 抽取文本中「首个完整 {…} 对象」再解析（忽略前后多余文本，抵抗部分截断/包裹）；
 *    4) 全失败返回 null（调用方兜底为原始文本，绝不静默丢内容）。
 *
 *  @param {string} rawText  响应体原文
 *  @param {object} logger   链路日志（失败时 WARN，不抛）
 *  @returns {object|null}   解析后的对象，或 null（表示需回退到原始文本）
 */
function safeParseNonStreamJSON(rawText, logger) {
  if (!rawText || !rawText.trim()) return null
  const candidate = (s) => { try { return JSON.parse(s) } catch { return undefined } }
  // 1) 直接解析
  let obj = candidate(rawText)
  if (obj && typeof obj === 'object') return obj
  // 2) 去 markdown 代码围栏（```json / ```）
  const fenced = rawText.replace(/^[\s\S]*?```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim()
  obj = candidate(fenced)
  if (obj && typeof obj === 'object') return obj
  // 3) 抽取首个完整 {…} 对象（括号配平，抵抗前后多余文本 / 尾部截断）
  const start = rawText.indexOf('{')
  if (start >= 0) {
    let depth = 0, inStr = false, esc = false
    for (let i = start; i < rawText.length; i++) {
      const ch = rawText[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { obj = candidate(rawText.slice(start, i + 1)); break } }
    }
    if (obj && typeof obj === 'object') return obj
  }
  logger?.warn?.('AI助手', '非流式 JSON 容错解析失败', { rawLen: rawText.length, head: rawText.slice(0, 120) })
  return null
}

/** ══════════════════════════════════════════════════════════════════════════════
 *  runToolCalls —— 执行一批工具调用并回填 tool 消息（send 的真实分支与 Demo 分支共用）。
 * ══════════════════════════════════════════════════════════════════════════════
 *  tools: [{ name, args, callId? }] → 逐个 callTool，把 tool 消息 append 到历史。
 *
 *  【TASK-006 #1 修复】execute_plan/generate_node/trigger_generation 等是 async 工具，
 *  callTool 返回 Promise。旧实现同步 for 循环拿 `result.ok` 全是 undefined →
 *  回填 LLM `{ok:false,error:undefined}` → 误判失败 → 撞 MAX_TOOL_ROUNDS 死循环 + 重复建节点。
 *  改为 async + 逐个 await，确保回填真实结果（await 普通对象/值也安全，不改变行为）。
 *
 *  @param {object} ctx 注入依赖：
 *    - callTool:   (name, args) => Promise<result>（来自 useCanvasAgentTools）
 *    - appendMsg:  (msg) => 追加消息（同步 state + ref，来自 useAgentChat 消息同步辅助）
 *    - model:      当前模型名
 *    - logger:     链路日志对象
 *    - getActivePendingGenerations: () => 读取当前对话暂存 generations
 */
/** 【B层日志辅助】工具参数摘要：截断超长（如 generations 超大 JSON），防 debug 刷屏 */
function safeSummarizeArgs(args) {
  if (args == null) return ''
  try {
    const s = JSON.stringify(args)
    return s && s.length > 300 ? `${s.slice(0, 300)}…(${s.length}字符)` : (s || '')
  } catch {
    return String(args).slice(0, 150)
  }
}

export async function runToolCalls(ctx, tools, callIdFor: (tc: ToolCall) => string = () => '') {
  const { callTool, appendMsg, model, logger, getActivePendingGenerations } = ctx
  // 【积分闸停点语义修正】creditHeld：本轮是否「execute_plan 命中积分闸（返回 awaited:'credit'）」。
  // 只有它才触发工具循环暂停等用户点生成；积分闸不影响任何其它工具/建节点/读节点（用户裁定）。
  let creditHeld = false
  for (const tc of tools) {
    let args = {}
    if (tc.function?.arguments) {
      try { args = JSON.parse(tc.function.arguments) } catch (e) { logger.warn('Agent', '工具参数 JSON.parse 失败', { name: tc.function?.name, arguments: tc.function?.arguments, error: e }) }
    }
    logger.debug('AI助手', '[工具] 入参', { name: tc.function?.name, args: safeSummarizeArgs(args) }, { module: 'agent' })
    const result = await callTool(tc.function?.name, args)
    // 【链路日志】工具执行结果：工具名 + 成功/失败（失败带 error），供排查 AI 调工具环节
    if (result?.ok) logger.info('AI助手', '工具', { name: tc.function?.name, ok: true })
    else logger.error('AI助手', '工具失败', { name: tc.function?.name, error: result?.error || '' })
    appendMsg({
      role: 'tool',
      // 失败时也携带 result.nodeId（若工具失败返回了），供对话侧「重试此步骤」定位节点（对齐大雄）
      content: result?.ok ? JSON.stringify({ ok: true, ...result.data }) : JSON.stringify({ ok: false, error: result?.error, ...(result?.nodeId ? { nodeId: result.nodeId } : {}) }),
      tool_call_id: callIdFor(tc),
      createdAt: Date.now()
    })
    // Skill 三阶段阶段1：show_plan_for_confirm 把策划展示给用户（作为一条 assistant 消息，可见规划）
    // 门禁只依赖工具成功（result?.ok），与 plan_text/generations 传输彻底解耦（对齐大雄：门禁由前端本地构造）。
    if (tc.function?.name === 'show_plan_for_confirm' && result?.ok) {
      const planText = result.data?.plan_text || '（策划已生成，请确认）'
      // 【对齐大雄】generations 挂到确认消息上，供前端渲染步骤卡片（agentGenCardHtml 等价物）。
      // 来源优先级：回复正文解析暂存（主） > 工具参数传入。都来自 per-conversation pendingGenerations。
      const confirmGens = Array.isArray(result.data?.generations) && result.data.generations.length
        ? result.data.generations
        : (getActivePendingGenerations() || [])
      appendMsg({ role: 'assistant', content: `生成策划：\n${planText}`, generations: confirmGens, model, createdAt: Date.now(), awaiting_confirm: true })
    }
    // 【记】memory_suggest：把"待确认记忆"展示给用户（作为一条 assistant 消息，含确认按钮）。
    // 复用 awaiting_confirm 门禁卡片；确认按钮文案由 AgentMessage 按 memory_suggest 语义渲染。
    // 用户确认动作由 UI 侧（AgentPanel.handleConfirmPlan → 确认记忆逻辑）落库。
    if (tc.function?.name === 'memory_suggest' && result?.ok) {
      const kind = result.data?.kind || ''
      const content = result.data?.content || ''
      const kindLabel = ({ preference: '偏好', fact: '事实', constraint: '约束', decision: '决定' })[kind] || kind
      appendMsg({
        role: 'assistant',
        content: `建议保存一条长期记忆：\n[${kindLabel}] ${content}\n\n确认后该记忆将写入项目（之后每轮对话都会延续这一偏好/事实/约束/决定）。`,
        model, createdAt: Date.now(), awaiting_confirm: true, memory_suggest: { kind, content }
      })
    }
    // 【TASK-009 执行摘要】execute_plan 返回 logs → 渲染一条带逐步进度的「执行摘要」消息（对齐大雄折叠面板）
    // 修复 #1 后 result 是真对象，此判断才真正生效
    if (tc.function?.name === 'execute_plan' && result?.ok) {
      // 【积分闸停点】execute_plan 命中积分闸（awaited:'credit'）→ 本轮已走到「点生成烧积分」临界点，
      // 置 creditHeld，send 循环据此暂停等用户确认；与全局残留 creditGate.pending 无关（见 send 停点注释）。
      if (result.data?.awaited === 'credit') creditHeld = true
      const logsArr = Array.isArray(result.data?.logs) ? result.data.logs : []
      // 【对齐大雄 agentLastResults】把本轮生成结果图 url 存到 assistant 消息的 lastResults，
      //   供后续轮「改上一张生成图」时执行层跨轮取最近生成图（图不进 LLM 上下文，执行层反查原图）。
      const entriesArr = Array.isArray(result.data?.entries) ? result.data.entries : []
      const lastResults = entriesArr
        .filter((e) => e && e.status === 'completed' && e.resultUrl)
        .map((e) => ({ url: e.resultUrl, name: e.stepId || e.id || `图${(e.stepId || e.id || '').toString().slice(0, 12)}`, nodeId: e.nodeId || '' }))
      if (logsArr.length > 0) {
        const lines = logsArr.map((l) => {
          const mark = l.level === 'error' ? '❌' : l.level === 'warn' ? '⚠️' : l.level === 'ok' ? '✅' : '·'
          return `${mark} ${l.message}`
        })
        appendMsg({ role: 'assistant', content: `执行摘要：\n${lines.join('\n')}`, model, createdAt: Date.now(), execution_summary: true, lastResults })
      } else if (lastResults.length > 0) {
        // 无日志但有结果图：也记录 lastResults，避免跨轮引用丢数据源
        appendMsg({ role: 'assistant', content: `已完成 ${lastResults.length} 张图。`, model, createdAt: Date.now(), execution_summary: true, lastResults })
      }
    }
  }
  // 返回本轮是否「execute_plan 命中积分闸」→ send 工具循环据此决定是否暂停等用户点生成
  return { creditHeld }
}

/** ══════════════════════════════════════════════════════════════════════════════
 *  runDemoMode —— Demo 模式（VITE_AGENT_DEMO='1'）分支。
 * ══════════════════════════════════════════════════════════════════════════════
 *  本地规则引擎模拟，不走真实 LLM。抽独立函数让 send 主流程更清晰。
 *  @param {object} ctx 注入依赖：{ callTool, appendMsg, model }
 *  @param {string} text 用户输入
 *  @returns {Promise<boolean>} true = 已走 Demo 分支处理完，调用方应提前 return
 */
export async function runDemoMode(ctx, text) {
  const { callTool, appendMsg, model, demoPlan } = ctx
  const plan = demoPlan(text, callTool)
  if (plan.length > 0) {
    // 模拟 assistant 决策（工具调用）
    const assistantMsg = {
      role: 'assistant', content: '', model,
      tool_calls: plan.map((p, i) => ({
        id: `call_demo_${Date.now()}_${i}`, type: 'function',
        function: { name: p.name, arguments: JSON.stringify(p.args) }
      })),
      createdAt: Date.now()
    }
    appendMsg(assistantMsg)
    // 执行每个工具并回填 tool 结果（TASK-006 #1：await 异步工具，避免 Promise 被序列化）
    for (const [i, p] of plan.entries()) {
      const r = await callTool(p.name, p.args)
      appendMsg({
        role: 'tool',
        content: r?.ok ? JSON.stringify({ ok: true, ...r.data }) : JSON.stringify({ ok: false, error: r?.error }),
        tool_call_id: assistantMsg.tool_calls[i].id,
        createdAt: Date.now()
      })
    }
    // 最后补一条 assistant 总结
    const done = plan.map((p) => p.name).join('、')
    appendMsg({
      role: 'assistant',
      content: `已执行画布操作：${done}。${plan.some((p) => p.name === 'create_node') ? '新节点已创建。' : ''}${plan.some((p) => p.name === 'connect_nodes') ? '已建立连线。' : ''}${plan.some((p) => p.name === 'delete_node') ? '节点已删除。' : ''}`,
      model, createdAt: Date.now()
    })
  } else {
    appendMsg({ role: 'assistant', content: '（演示模式）我暂时只会演示这些画布操作：创建节点（生图/视频/文本）、连接两个节点、删除节点、查看画布、适配视图。试试说「创建一个生图节点」或「连接 text-1 和 image-1」。', model, createdAt: Date.now() })
  }
  // Demo 分支落盘交给 finally 统一处理（captureActiveConversation），这里只 return
  return true
}
