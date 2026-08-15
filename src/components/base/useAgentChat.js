import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasAgentTools } from './useCanvasAgentTools.js'
import { sGet, sSet } from './storageAdapter.js'
import { API_BASE } from './apiBase.js'

/**
 * ════════════════════════════════════════════════════════════════
 * 画布 AI 助手 —— 对话 hook（复刻官方 shared.js `dr`，接入工具层）
 * ════════════════════════════════════════════════════════════════
 *
 * 【对应关系】
 * 官方 App-BX6o9fW5_components/shared.js `dr(e)`（2537-2908）：
 *  - 消息状态 messages / sending / error / model / setModel
 *  - send(text, attachments)   → SSE 流式 + 多轮工具循环（≤ ur=8 轮）
 *  - stop() / clear()          → 中止 / 清空
 *  - 工具执行：官方用 `lr(name,args,canvasHandleRef)`；本实现改用
 *    useCanvasAgentTools 的 callTool（即刚建好的统一画布工具层）。
 *
 * 【与官方的差异（均为原型适配）】
 *  1. 工具执行器：lr → callTool（useCanvasAgentTools），LLM 侧无感知，返回信封不变。
 *  2. 鉴权：官方 We() 取登录 token；原型无登录，直接发请求。
 *  3. 历史持久化：官方 nr(n)/ir(n) 走后端；原型用 localStorage（键 = `agent_history_${agentKey}`）。
 *  4. LLM 端点：读 env（VITE_*，见下），默认走 localTool 18080 的 /api/agent/:id/chat，
 *     与 docs/27 一致（localTool 已落地支持 function calling 的 LLM 中转）。
 *
 * 【LLM 端点配置（.env 或 import.meta.env）】
 *  - VITE_LLM_CHAT_BASE_URL  默认 'http://127.0.0.1:18080/api/agent/{agentKey}/chat'
 *      （指向 localTool；localTool 再转发到支持 function calling 的 LLM，见 docs/27 §3/§11）
 *  - VITE_LLM_CHAT_API_KEY   可选，Bearer 鉴权
 *  - VITE_LLM_CHAT_MODEL     默认 'gpt-4o-mini'（localTool 会按配置覆盖，见 docs/27 §11.3）
 *  - 若想直接连某个 OpenAI 兼容端点：把 BASE_URL 设成该端点 /v1/chat/completions 即可。
 *
 * 【消息契约（对齐官方 + LLM 可解析）】
 *  - user:      { role:'user', content, attachments?:[{type,url}], createdAt }
 *  - assistant: { role:'assistant', content, reasoning?, tool_calls?, streaming?, model, createdAt }
 *  - tool:      { role:'tool', content:JSON字符串, tool_call_id, createdAt }
 *  - system:    { role:'system', content }
 * ════════════════════════════════════════════════════════════════
 */

// 复刻官方 shared.js:2536 `var ur = 8`（多轮工具循环硬上限）
const MAX_TOOL_ROUNDS = 8

// LLM 端点配置（env 可覆盖；默认走 localTool 18080，与 docs/27 一致）
const CHAT_BASE_URL = import.meta.env?.VITE_LLM_CHAT_BASE_URL || ''
const CHAT_API_KEY = import.meta.env?.VITE_LLM_CHAT_API_KEY || ''
const CHAT_MODEL = import.meta.env?.VITE_LLM_CHAT_MODEL || 'gpt-4o-mini'

// Demo 模式：VITE_AGENT_DEMO='1' 时，不发真实 LLM 请求，
// 用本地规则引擎模拟「说一句话 → 调工具 → 画布变化」。方便没配 LLM key 也能演示。
const DEMO_MODE = import.meta.env?.VITE_AGENT_DEMO === '1'

/** 历史持久化键 */
const historyKey = (agentKey) => `agent_history_${agentKey || 'canvas-assistant'}`

/** 从 localStorage 读历史（官方 nr(n)，原型本地版） */
function loadHistory(agentKey) {
  try {
    const raw = sGet(historyKey(agentKey))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 保存历史到 localStorage（官方 ir(n)，原型本地版） */
function saveHistory(agentKey, messages) {
  try {
    sSet(historyKey(agentKey), JSON.stringify(messages))
  } catch {
    /* 忽略写失败 */
  }
}

/** SSE 解析（复刻官方 dr 内 v 函数：按 data: 前缀解析 delta，含 content/reasoning/tool_calls） */
function parseSSEChunk(line, acc) {
  if (!line.startsWith('data:')) return
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return
  try {
    const delta = JSON.parse(payload).choices?.[0]?.delta
    if (!delta) return
    if (delta.content) acc.content += delta.content
    if (delta.reasoning_content) acc.reasoning += delta.reasoning_content
    else if (delta.reasoning) acc.reasoning += delta.reasoning
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        acc.toolCalls[idx] ||= { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
        if (tc.id) acc.toolCalls[idx].id = tc.id
        if (tc.function?.name) acc.toolCalls[idx].function.name += tc.function.name
        if (tc.function?.arguments) acc.toolCalls[idx].function.arguments += tc.function.arguments
      }
    }
  } catch {
    /* 忽略单条解析失败 */
  }
}

/** 把消息数组转成请求体 messages（复刻官方 dr:2584-2623，含附件转 image_url） */
function buildRequestMessages(messages, systemPrompt) {
  const out = []
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt })
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      const content = m.attachments.map((a) => ({ type: 'image_url', image_url: { url: a.url } }))
      if (m.content) content.push({ type: 'text', text: m.content })
      out.push({ role: 'user', content })
      continue
    }
    const obj = { role: m.role, content: m.content || '' }
    if (m.tool_calls) obj.tool_calls = m.tool_calls
    if (m.tool_call_id) obj.tool_call_id = m.tool_call_id
    out.push(obj)
  }
  return out
}

/**
 * Demo 规则引擎（仅 VITE_AGENT_DEMO='1' 时用）。
 * 模拟 LLM：把「自然语言一句话」映射成一系列工具调用，驱动画布变化。
 * 返回 [{ name, args }, ...]；不认识的话返回 []（assistant 纯文字答复）。
 * 说明：这是原型演示用的简化规则，真实对话应走 roundTrip（真实 LLM）。
 */
export function demoPlan(text, callTool) {
  const t = text.trim().toLowerCase()

  // 识别节点类型关键词 → type
  const typeMap = [
    [/生图|图片|画(?:一张|个)?|生成.*图|image|prompt/i, 'promptNode'],
    [/视频|video/i, 'discountVideoNode'],
    [/文本|text/i, 'textNode'],
    [/剧本|脚本盒|script/i, 'scriptBoxNode'],
    [/编组|group/i, 'group']
  ]
  let type = null
  for (const [re, ty] of typeMap) {
    if (re.test(t)) { type = ty; break }
  }

  // 提取中文/英文引号内容作为 prompt（如「帮我生成一张「赛博朋克」图」）
  let prompt = ''
  const qm = text.match(/[「『"“']([^」』"”']+)[」』"”']/)
  if (qm) prompt = qm[1]
  else if (/生成|创建|画/.test(t)) {
    // 兜底：取「一张…图」等
    const pm = text.match(/(?:一张|一个|一段)?\s*([^，。,．.！？!?\s]{2,30})/i)
    if (pm && pm[1] && !/节点|画布/.test(pm[1])) prompt = pm[1]
  }

  const calls = []

  // 1) 创建节点
  if (/创建|新建|生成|添加|画|放一个|建一个|帮我.*(节点|图|视频)/i.test(t) && type) {
    calls.push({ name: 'create_node', args: { type, ...(prompt ? { prompt } : {}), ...(type === 'promptNode' ? { label: '生图节点' } : type === 'discountVideoNode' ? { label: '视频节点' } : { label: '文本节点' }) } })
  }

  // 2) 连接：「把 A 连到 B」「连接 text-1 和 prompt-1」
  if (/连接|连到|连线|connect/i.test(t)) {
    const ids = text.match(/([a-zA-Z0-9_-]+-?\d*)/g)?.filter((s) => s !== t)
    // 匹配「连接 A 和 B」里的两个节点标识
    const m = text.match(/([\w-]+)(?:\s*(?:和|与|到|to)\s*([\w-]+))?/)
    if (m) {
      const a = m[1]
      const b = m[2] || ids?.[1]
      if (a && b && a !== b) calls.push({ name: 'connect_nodes', args: { source: a, target: b } })
    }
  }

  // 3) 删除：「删除 X」
  if (/删除|移除|删掉|delete/i.test(t)) {
    const m = text.match(/([\w-]+)/g)
    if (m) {
      const id = m.find((s) => s && s !== '删除' && s !== '删除')
      if (id) calls.push({ name: 'delete_node', args: { nodeId: id } })
    }
  }

  // 4) 查看画布
  if (/看看|列出|有哪些|查看|list|结构/i.test(t)) {
    calls.push({ name: 'read_canvas', args: {} })
  }

  // 5) 适配视图
  if (/适配|全览|全部显示|fit/i.test(t)) {
    calls.push({ name: 'fit_view', args: {} })
  }

  return calls
}

/**
 * 主 hook。
 * @param {object} opts
 *  - agentKey:     助手标识（默认 canvas-assistant）
 *  - systemPrompt: 注入的 system 提示词（可叠加画布操作准则）
 *  - defaultModel: 默认模型名
 *  - provider:     可选，AI 助手实际使用的供应商（来自 API 设置）。传了则经 /api/proxy
 *                  转发到该供应商（保留 function calling + SSE），选的模型才真正生效；
 *                  不传则回退走 localTool /api/agent/:id/chat（env 配的 LLM）。
 * @returns { messages, sending, error, model, setModel, send, stop, clear }
 */
export function useAgentChat({ agentKey = 'canvas-assistant', systemPrompt = '', defaultModel = CHAT_MODEL, provider = null } = {}) {
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(defaultModel)

  // 工具层（替代官方 lr()）
  const { toolSchemas, callTool } = useCanvasAgentTools()

  // ref 缓存（避免闭包旧值，对齐官方 g.current/h.current）
  const systemRef = useRef(systemPrompt)
  const messagesRef = useRef([])
  const abortRef = useRef(null)
  useEffect(() => { systemRef.current = systemPrompt }, [systemPrompt])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // 初始加载历史（复刻官方 dr useEffect：nr(n) 读历史）
  useEffect(() => {
    const hist = loadHistory(agentKey)
    setMessages(hist)
    messagesRef.current = hist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  // 卸载时中止进行中的请求（复刻官方 dr:2571-2575）
  useEffect(() => {
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  // 组装端点：默认走 localTool /api/agent/{agentKey}/chat；env 可覆盖
  const endpoint = CHAT_BASE_URL || `${API_BASE}/api/agent/${encodeURIComponent(agentKey)}/chat`

  /** 单次 SSE 请求，返回 { role:'assistant', content, reasoning?, tool_calls? }（复刻官方 dr:2579-2778 的 v） */
  const roundTrip = useCallback(
    async (requestMessages, signal, onStream) => {
      const llmBody = {
        model,
        messages: requestMessages,
        tools: toolSchemas,
        tool_choice: 'auto',
        stream: true,
        temperature: 0.6
      }
      // 是否走「多 provider /api/proxy 转发」：provider 存在时（如魔搭，支持 function calling）
      const useProxy = !!provider
      const res = useProxy
        ? await fetch(`${API_BASE}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({
              url: (provider?.protocol === 'openai' ? 'openai://chat/completions' : (provider?.base_url || '').replace(/\/$/, '') + '/v1/chat/completions'),
              providerId: provider?.id,
              method: 'POST',
              body: JSON.stringify(llmBody)
            }),
            signal
          })
        : await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...(CHAT_API_KEY ? { Authorization: `Bearer ${CHAT_API_KEY}` } : {})
            },
            body: JSON.stringify(llmBody),
            signal
          })
      if (!res.ok) {
        let msg = `调用失败 (${res.status})`
        try {
          const text = await res.text()
          const parsed = JSON.parse(text)
          msg = parsed?.error?.message || parsed?.error || text
        } catch { /* keep default */ }
        throw new Error(msg)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      const acc = { content: '', reasoning: '', toolCalls: [] }

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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const chunk of parts) {
          const before = acc.content.length + acc.reasoning.length + acc.toolCalls.length
          parseSSEChunk(chunk, acc)
          if (acc.content.length + acc.reasoning.length + acc.toolCalls.length > before) scheduleFlush()
        }
      }
      buffer += decoder.decode()
      if (buffer.trim()) parseSSEChunk(buffer, acc)
      flush()

      const assistant = { role: 'assistant', content: acc.content || '', model, createdAt: Date.now() }
      if (acc.reasoning) assistant.reasoning = acc.reasoning
      if (acc.toolCalls.length > 0) assistant.tool_calls = acc.toolCalls.filter((t) => t.function?.name)
      return assistant
    },
    [endpoint, model, toolSchemas, provider]
  )

  /** 发送（复刻官方 dr:2786-2895 的 send：SSE + 多轮工具循环） */
  const send = useCallback(
    async (text, attachments) => {
      if (sending || (!text.trim() && (!attachments || attachments.length === 0))) return
      setError(null)

      const userMsg = { role: 'user', content: text, createdAt: Date.now() }
      if (attachments && attachments.length > 0) userMsg.attachments = attachments

      let history = [...messagesRef.current, userMsg]
      setMessages(history)
      messagesRef.current = history
      setSending(true)

      const controller = new AbortController()
      abortRef.current = controller
      try {
        // ── Demo 模式（VITE_AGENT_DEMO='1'）：本地规则引擎模拟，不走真实 LLM ──
        if (DEMO_MODE) {
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
            setMessages((prev) => [...prev, assistantMsg])
            let msgs = [...history, assistantMsg]
            // 执行每个工具并回填 tool 结果
            for (const [i, p] of plan.entries()) {
              const result = callTool(p.name, p.args)
              const toolMsg = {
                role: 'tool',
                content: result.ok ? JSON.stringify({ ok: true, ...result.data }) : JSON.stringify({ ok: false, error: result.error }),
                tool_call_id: assistantMsg.tool_calls[i].id,
                createdAt: Date.now()
              }
              setMessages((prev) => [...prev, toolMsg])
              msgs = [...msgs, toolMsg]
            }
            // 最后补一条 assistant 总结
            const done = plan.map((p) => p.name).join('、')
            const summary = { role: 'assistant', content: `已执行画布操作：${done}。${plan.some((p) => p.name === 'create_node') ? '新节点已创建。' : ''}${plan.some((p) => p.name === 'connect_nodes') ? '已建立连线。' : ''}${plan.some((p) => p.name === 'delete_node') ? '节点已删除。' : ''}`, model, createdAt: Date.now() }
            setMessages((prev) => [...prev, summary])
            msgs = [...msgs, summary]
            saveHistory(agentKey, msgs)
            messagesRef.current = msgs
          } else {
            const reply = { role: 'assistant', content: '（演示模式）我暂时只会演示这些画布操作：创建节点（生图/视频/文本）、连接两个节点、删除节点、查看画布、适配视图。试试说「创建一个生图节点」或「连接 text-1 和 image-1」。', model, createdAt: Date.now() }
            setMessages((prev) => [...prev, reply])
            saveHistory(agentKey, [...history, reply])
            messagesRef.current = [...history, reply]
          }
          setSending(false)
          abortRef.current = null
          return
        }

        let msgs = history
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // 追加流式 assistant 占位（复刻官方）
          const placeholder = { role: 'assistant', content: '', model, streaming: true, createdAt: Date.now() }
          setMessages((prev) => [...prev, placeholder])
          msgs = [...msgs, placeholder]

          const assistant = await roundTrip(
            buildRequestMessages(msgs, systemRef.current),
            controller.signal,
            (delta) => {
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last && last.role === 'assistant' && last.streaming) {
                  next[next.length - 1] = {
                    ...last,
                    content: delta.content,
                    reasoning: delta.reasoning || undefined,
                    tool_calls: delta.toolCalls.filter((t) => t.function?.name)
                  }
                }
                return next
              })
            }
          )
          // 结束流式
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { ...assistant, streaming: false }
            return next
          })
          msgs = [...msgs.slice(0, -1), { ...assistant, streaming: false }]

          // 无工具调用 → 结束
          if (!assistant.tool_calls || assistant.tool_calls.length === 0) break

          // 执行工具（替代官方 lr()：callTool 来自 useCanvasAgentTools）
          for (const tc of assistant.tool_calls) {
            let args = {}
            if (tc.function?.arguments) {
              try { args = JSON.parse(tc.function.arguments) } catch (e) { console.warn('[Agent] 工具参数 JSON.parse 失败:', tc.function?.name, tc.function?.arguments, e) }
            }
            const result = callTool(tc.function?.name, args)
            const toolMsg = {
              role: 'tool',
              content: result.ok ? JSON.stringify({ ok: true, ...result.data }) : JSON.stringify({ ok: false, error: result.error }),
              tool_call_id: tc.id,
              createdAt: Date.now()
            }
            setMessages((prev) => [...prev, toolMsg])
            msgs = [...msgs, toolMsg]
          }
        }
        // 保存历史
        saveHistory(agentKey, msgs)
        messagesRef.current = msgs
      } catch (e) {
        if (e?.name === 'AbortError') {
          setError('已停止')
        } else {
          setError(e?.message || '发送失败')
        }
        setMessages((prev) => {
          const next = [...prev]
          if (next.length > 0 && next[next.length - 1].streaming) next.pop()
          return next
        })
      } finally {
        setSending(false)
        abortRef.current = null
      }
    },
    [sending, model, roundTrip, callTool, agentKey]
  )

  /** 停止（复刻官方 stop） */
  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** 清空（复刻官方 clear，含存空历史） */
  const clear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    messagesRef.current = []
    setError(null)
    saveHistory(agentKey, [])
  }, [agentKey])

  return { messages, sending, error, model, setModel, send, stop, clear }
}
