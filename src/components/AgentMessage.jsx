import { useEffect, useRef, useState } from 'react'

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
  const [open, setOpen] = useState(true)
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

/** 消息气泡主组件（复刻 Cr.jsx） */
export default function AgentMessage({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] flex flex-col items-end gap-1">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {message.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-md overflow-hidden border border-white/20 hover:border-white/50 transition-colors" title="点击新窗口打开">
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
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
            <div className="bg-canvas border border-edge-faint text-gray-200 text-sm rounded-lg rounded-bl-sm px-3 py-2 whitespace-pre-wrap break-words">
              {message.content}
              {message.streaming && <span className="inline-block w-1 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (message.role === 'tool') {
    let text = message.content
    let ok = true
    try {
      const r = JSON.parse(message.content)
      ok = !!r.ok
      text = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ''}` : '操作失败')
    } catch { /* keep raw */ }
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] text-caption-sm text-gray-500 bg-canvas border border-edge-subtle rounded-md px-2 py-1">
          <span className={ok ? 'text-green-500' : 'text-red-400'}>{'●'}</span>
          {' '}
          {text}
        </div>
      </div>
    )
  }

  return null
}
