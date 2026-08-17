import { useEffect, useRef, useState } from 'react'
import { toAbsoluteFileUrl } from './base/filesApi.js'
import LazyImage from './base/LazyImage.jsx'

/** 直观判断：一个 URL 是否该渲染成图片。
 *  - 跳过临时协议：blob:/ipfs:/ipns:（持久化后必破图）
 *  - data: 只接受 data:image/
 *  - http(s)：带图片后缀(.png/.jpg…)直接渲染；无后缀则排除网页类后缀(.html/.json…)后渲染（兼容无后缀图床） */
function isImageUrl(u) {
  u = String(u || '').trim().toLowerCase()
  if (!u) return false
  if (/^(?:blob:|ipfs:|ipns:)/.test(u)) return false
  if (u.startsWith('data:')) return u.startsWith('data:image/')
  if (!/^https?:\/\//.test(u)) return false
  if (/\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#]|$)/.test(u)) return true
  return !/\.(?:html?|php|json|xml|css|js|mjs|txt|md|csv|pdf)(?:[?#]|$)/.test(u)
}

/** 从文本里按顺序找出所有「图片 URL 候选」及其位置（含 markdown ![]() 与 <img src>）。 */
function extractImageSpans(text) {
  const spans = []
  // 1) markdown 图片 ![](url) / ![alt](url)
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    spans.push({ url: m[1], start: m.index, end: m.index + m[0].length })
  }
  // 2) HTML <img src="url">
  for (const m of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    spans.push({ url: m[1], start: m.index, end: m.index + m[0].length })
  }
  // 3) 裸链接：http(s)://… 或 data:image/…
  for (const m of text.matchAll(/(https?:\/\/[^\s)]+|data:image\/[^\s"]+)/gi)) {
    spans.push({ url: m[0], start: m.index, end: m.index + m[0].length })
  }
  // 去重 + 只保留真正是图片的 + 按出现顺序
  const seen = new Set()
  return spans
    .filter((s) => isImageUrl(s.url) && !seen.has(s.start + s.url) && seen.add(s.start + s.url))
    .sort((a, b) => a.start - b.start)
}

/** 把 assistant 的纯文本 content 按图片 URL 切分：文本段原样（保留换行），图片段渲染成图。 */
function renderContentWithImages(text) {
  const str = String(text || '')
  if (!str) return null
  const spans = extractImageSpans(str)
  if (spans.length === 0) {
    return <span className="whitespace-pre-wrap break-words">{str}</span>
  }
  const nodes = []
  let last = 0
  spans.forEach((s, i) => {
    if (s.start > last) nodes.push({ type: 'text', value: str.slice(last, s.start), key: `t${i}` })
    nodes.push({ type: 'image', value: s.url, key: `i${i}` })
    last = s.end
  })
  if (last < str.length) nodes.push({ type: 'text', value: str.slice(last), key: `t${spans.length}` })
  return (
    <div className="space-y-2">
      {nodes.map((n) =>
        n.type === 'text' ? (
          <span key={n.key} className="whitespace-pre-wrap break-words block">
            {n.value}
          </span>
        ) : (
          <a
            key={n.key}
            href={toAbsoluteFileUrl(n.value)}
            target="_blank"
            rel="noreferrer"
            className="block w-full max-w-[280px] rounded-md overflow-hidden border border-white/15 hover:border-white/40 transition-colors"
            title="点击新窗口打开"
          >
            <LazyImage src={n.value} alt="" className="w-full max-h-[240px] bg-black/30" imgClassName="w-full h-auto max-h-[240px] object-contain" />
          </a>
        )
      )}
    </div>
  )
}

/**
 * ════════════════════════════════════════════════════════════════
 * 画布 AI 助手 —— 消息气泡（复刻官方 Cr.jsx + Sr.jsx + _Component34.jsx）
 * ════════════════════════════════════════════════════════════════
 *
 * 【对应关系】
 *  - Cr.jsx          消息气泡主组件（user / assistant / tool 三态渲染）
 *  - Sr.jsx          assistant 的「思考过程」折叠面板
 *  - _Component34.jsx assistant 的 tool_calls 标签（紫色 wren 图标 + 工具名 + 参数）
 *
 * 【消息结构契约（与 useAgentChat 对齐）】
 *  - user:      { role, content, attachments? }
 *  - assistant: { role, content, reasoning?, tool_calls?, streaming? }
 *  - tool:      { role, content:JSON字符串, ... }   // content 形如 {"ok":true,...} 或 {"ok":false,"error":"..."}
 * ════════════════════════════════════════════════════════════════
 */

/** 思考过程折叠面板（复刻 Sr.jsx） */
function Reasoning({ text, streaming }) {
  // 默认折叠：仅流式进行中（streaming=true）才展开显示"思考中"；
  // 历史消息（streaming=false/undefined）默认折叠，刷新后不展开（修复：原本 useState(true) 刷新后必展开）
  const [open, setOpen] = useState(!!streaming)
  const [done, setDone] = useState(false)
  const prevStreaming = useRef(streaming)
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      setOpen(false)
      setDone(true)
    }
    prevStreaming.current = streaming
  }, [streaming])

  return (
    <div className="mb-1 border border-edge-faint rounded-md bg-[#0a0a0a]">
      <button
        type="button"
        onClick={() => { setOpen(!open); setDone(false) }}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-caption-sm text-gray-400 hover:text-gray-300 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-medium">{streaming ? '思考中...' : done ? '已思考' : '思考过程'}</span>
        {!streaming && <span className="ml-auto text-caption text-gray-600">{open ? '点击折叠' : '点击展开'}</span>}
      </button>
      {open && (
        <div className="px-3 pb-2 pt-0.5 text-body-xs text-gray-500 whitespace-pre-wrap break-words border-t border-edge-subtle leading-relaxed">
          {text}
          {streaming && <span className="inline-block w-1 h-3 bg-gray-600 ml-0.5 animate-pulse align-middle" />}
        </div>
      )}
    </div>
  )
}

/** 工具调用标签（复刻 _Component34.jsx） */
function ToolCallChip({ name, args }) {
  let display = args || ''
  try {
    const obj = JSON.parse(args || '{}')
    display = Object.entries(obj).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')
  } catch { /* keep raw */ }
  return (
    <span className="inline-flex items-center gap-1 text-caption-sm text-purple-300 bg-purple-950/30 border border-purple-800/30 rounded-md px-2 py-0.5">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="font-mono">{name}</span>
      {display && <span className="text-purple-400 truncate max-w-[200px]">{display}</span>}
    </span>
  )
}

/** 生成步骤卡片（对齐大雄 agentExecutionPromptsHtml：阶段1 把 generations 渲染成可检查的步骤列表） */
function GenerationStepsCard({ generations }) {
  const [open, setOpen] = useState(true)
  const list = (generations || []).filter((g) => g && typeof g === 'object')
  if (!list.length) return null
  return (
    <div className="mt-2 border border-edge-faint rounded-md bg-[#0a0a0a]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-caption-sm text-gray-400 hover:text-gray-300 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-medium">生成步骤方案</span>
        <span className="ml-auto text-caption text-gray-600">{list.length} 条</span>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-2 border-t border-edge-subtle">
          {list.map((g, i) => {
            const title = String(g?.title || g?.role || `步骤 ${i + 1}`).trim()
            const prompt = String(g?.professionalPrompt || g?.prompt || g?.plannedPrompt || '').trim()
            const ratio = String(g?.ratio || '').trim()
            const res = String(g?.resolution || '').trim()
            const meta = [ratio && `比例 ${ratio}`, res && `${res}`].filter(Boolean).join(' · ')
            return (
              <div key={g?.id || i} className="text-body-xs leading-relaxed">
                <div className="flex items-center gap-1.5 text-gray-300">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface border border-edge-subtle text-caption-sm text-gray-400 flex-shrink-0">{i + 1}</span>
                  <span className="font-medium truncate">{title}</span>
                  {meta && <span className="ml-auto text-caption text-gray-600 flex-shrink-0">{meta}</span>}
                </div>
                {prompt && <div className="mt-0.5 pl-[22px] text-gray-500 whitespace-pre-wrap break-words">{prompt}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 消息气泡主组件（复刻 Cr.jsx） */
export default function AgentMessage({ message, onConfirmPlan, onRetryStep }) {
  if (message.role === 'user') {
    const skillNames = (message.skills || []).map((s) => s?.name || s?.id || '').filter(Boolean)
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] flex flex-col items-end gap-1">
          {/* 已使用 Skill 标签（对齐大雄：user 消息显示本轮用到的 Skill） */}
          {skillNames.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              <span className="text-caption text-gray-600">已使用 Skill</span>
              {skillNames.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-caption-sm text-gray-300 bg-surface border border-edge-faint rounded-md px-1.5 py-0.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  {n}
                </span>
              ))}
            </div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {message.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-md overflow-hidden border border-white/20 hover:border-white/50 transition-colors" title="点击新窗口打开">
                  <img src={toAbsoluteFileUrl(a.url)} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {message.content && (
            <div className="bg-surface-hover text-white text-sm rounded-lg rounded-br-sm px-3 py-2 whitespace-pre-wrap break-words border border-edge">
              {message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full">
          {message.reasoning && <Reasoning text={message.reasoning} streaming={message.streaming} />}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="mb-1 space-y-1">
              {message.tool_calls.map((tc, i) => (
                <ToolCallChip key={i} name={tc.function?.name} args={tc.function?.arguments} />
              ))}
            </div>
          )}
          {message.content && (
            <div className="bg-canvas border border-edge-faint text-gray-200 text-sm rounded-lg rounded-bl-sm px-3 py-2">
              {renderContentWithImages(message.content)}
              {message.streaming && <span className="inline-block w-1 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />}
            </div>
          )}
          {/* 【对齐大雄】阶段1 generations → 渲染步骤卡片（可折叠，用户确认前检查每步） */}
          <GenerationStepsCard generations={message.generations} />
          {/* Skill 阶段2：待确认策划 → 渲染确认按钮（Step F；仅前端按钮翻转 awaitingConfirm） */}
          {message.awaiting_confirm && !message.streaming && (
            <button
              type="button"
              onClick={onConfirmPlan}
              disabled={!onConfirmPlan}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              确认，按此执行
            </button>
          )}
        </div>
      </div>
    )
  }

  if (message.role === 'tool') {
    let text = message.content
    let ok = true
    let nodeId = ''
    let failedEntries = []
    try {
      const r = JSON.parse(message.content)
      ok = !!r.ok
      nodeId = r.nodeId || ''
      text = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ''}` : '操作失败')
      // 【TASK-007 2.1】execute_plan 计划返回 entries：把失败的步收集出来，逐个提供「重试此步」（对齐大雄 retryAgentGeneration）
      if (Array.isArray(r.data?.entries)) {
        failedEntries = r.data.entries.filter((e) => e && e.status === 'failed' && e.nodeId)
      }
    } catch { /* keep raw */ }
    // 失败且带 nodeId（generate_node 失败已回传）→ 显示「重试此步骤」；execute_plan 多失败步 → 逐项重试
    const canRetry = !ok && !!nodeId && typeof onRetryStep === 'function'
    const hasFailedSteps = failedEntries.length > 0 && typeof onRetryStep === 'function'
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] inline-flex flex-col items-start gap-1.5 text-caption-sm text-gray-500 bg-canvas border border-edge-subtle rounded-md px-2 py-1">
          <div className="inline-flex items-center gap-1.5">
            {ok && !hasFailedSteps ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            <span>{hasFailedSteps ? `计划执行：${failedEntries.length} 步失败` : text}</span>
            {canRetry && (
              <button
                type="button"
                onClick={() => onRetryStep(nodeId)}
                className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-edge hover:border-blue-400 text-gray-400 hover:text-blue-300 transition-colors"
                title="重新生成此步骤（只重试失败项，不影响其他已完成卡片）"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>重试</span>
              </button>
            )}
          </div>
          {hasFailedSteps && (
            <div className="flex flex-col gap-1 pl-1">
              {failedEntries.map((e) => (
                <div key={e.nodeId} className="inline-flex items-center gap-2">
                  <span className="text-red-400/80 truncate max-w-[220px]">{e.error || '生成失败'}</span>
                  <button
                    type="button"
                    onClick={() => onRetryStep(e.nodeId)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-edge hover:border-blue-400 text-gray-400 hover:text-blue-300 transition-colors"
                    title={`重试此步（${e.id || ''}）`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span>重试此步</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
