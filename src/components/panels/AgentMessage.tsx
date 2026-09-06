import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toAbsoluteFileUrl } from '../base/api/index.ts';
import LazyImage from '../base/ui/LazyImage.tsx';
import AgentConfirmCard from './AgentConfirmCard.tsx';
import ImageZoomDialog from '../base/editors/ImageZoomDialog.tsx';
import ChatMarkdown from './ChatMarkdown.tsx';
import { showToast } from '../base/core/toastStore.ts';
import { type ToolCall, type ChatMessage } from '../agent/runtime/agentCore.ts';

/** AgentMessage 实际渲染的消息形状：兼容 LLM 协议（ChatMessage）并扩展 UI 态字段。
 *  UI 层只处理文本/图片类消息，故将 content 收窄为 string（协议层 ChatMessage 允许数组形态，UI 不消费）。 */
export interface AgentMessageData extends ChatMessage {
  id?: string;
  content?: string;
  streaming?: boolean;
  skills?: Array<{ name?: string; id?: string; [k: string]: unknown }>;
  generations?: Array<{
    id?: string;
    title?: string;
    professionalPrompt?: string;
    prompt?: string;
    plannedPrompt?: string;
    ratio?: string;
    resolution?: string;
    [k: string]: unknown;
  }>;
  awaiting_confirm?: boolean;
  memory_suggest?: boolean;
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
const Reasoning = memo(function Reasoning({
  text,
  streaming,
}: {
  text?: string;
  streaming?: boolean;
}) {
  // 默认折叠：仅流式进行中（streaming=true）才展开显示"思考中"；
  // 历史消息（streaming=false/undefined）默认折叠，刷新后不展开（修复：原本 useState(true) 刷新后必展开）
  const [open, setOpen] = useState(!!streaming);
  const [done, setDone] = useState(false);
  const prevStreaming = useRef(streaming);
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      setOpen(false);
      setDone(true);
    }
    prevStreaming.current = streaming;
  }, [streaming]);

  // 简洁化：折叠态 = 一行小字，展开才出内容（不再用带边框的独立面板）
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setDone(false);
        }}
        className={`agent-trace ${open ? 'is-open' : ''}`}
      >
        <span className={`agent-dot ${streaming ? '' : 'is-ok'}`} />
        <span className="agent-trace-label">
          {streaming ? '思考中...' : done ? '已思考' : '思考过程'}
        </span>
        <svg
          className="agent-caret"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {/* 条件渲染而非 CSS 隐藏：折叠时内容不进 DOM（jsdom/无样式环境下才不会「看似可见」，
          也让折叠态真正从可访问性树里移除） */}
      {open && (
        <div className="agent-trace-detail">
          {text}
          {streaming && <span className="agent-cursor" />}
        </div>
      )}
    </>
  );
});

/** 工具调用标签（2026-09-05 去噪：中性灰小标签，参数收进 title，不再用紫色高亮抢视觉） */
const ToolCallChip = memo(function ToolCallChip({ name, args }: { name?: string; args?: string }) {
  let display = args || '';
  try {
    const obj = JSON.parse(args || '{}');
    display = Object.entries(obj)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ');
  } catch {
    /* keep raw */
  }
  return (
    <span title={display ? `${name}(${display})` : name} className="agent-toolchip">
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="font-mono truncate max-w-[150px]">{name}</span>
    </span>
  );
});

/** 生成步骤卡片（对齐大雄 agentExecutionPromptsHtml：阶段1 把 generations 渲染成可检查的步骤列表） */
const GenerationStepsCard = memo(function GenerationStepsCard({
  generations,
}: {
  generations?: AgentMessageData['generations'];
}) {
  const [open, setOpen] = useState(true);
  const list = (generations || []).filter((g) => g && typeof g === 'object');
  if (!list.length) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`agent-trace ${open ? 'is-open' : ''}`}
      >
        <span className="agent-dot" />
        <span className="agent-trace-label">生成步骤方案</span>
        <span className="agent-step-meta">{list.length} 条</span>
        <svg
          className="agent-caret"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {open && (
        <div className="agent-trace-detail">
          <div className="agent-steps">
            {list.map((g, i) => {
              const title = String(g?.title || g?.role || `步骤 ${i + 1}`).trim();
              const prompt = String(
                g?.professionalPrompt || g?.prompt || g?.plannedPrompt || '',
              ).trim();
              const ratio = String(g?.ratio || '').trim();
              const res = String(g?.resolution || '').trim();
              const meta = [ratio && `比例 ${ratio}`, res && `${res}`].filter(Boolean).join(' · ');
              return (
                <div key={g?.id || i}>
                  <div className="agent-step-head">
                    <span className="agent-step-index">{i + 1}</span>
                    <span className="agent-step-title">{title}</span>
                    {meta && <span className="agent-step-meta">{meta}</span>}
                  </div>
                  {prompt && <div className="agent-step-prompt">{prompt}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
});

/** 消息气泡主组件（复刻 Cr.jsx）
 *  @param {object} message
 *  @param {Function} onConfirmPlan 阶段2 一次性确认整个策划（generations 通道）
 *  @param {Function} onCancelPlan  取消待确认（策划/记忆）：放弃本次确认，清门禁并收起确认卡
 *  @param {Function} onRetryStep   重试失败步骤 */
interface AgentMessageProps {
  message: AgentMessageData;
  onConfirmPlan?: () => void;
  onCancelPlan?: (content?: string) => void;
  onRetryStep?: (nodeId: string) => void;
  onSendToCanvas?: (content: string) => void;
  /** 重新生成：重发本条回复之前最近一条用户指令 */
  onRegenerate?: () => void;
  /** 隐藏正文：当本消息已被结构化预览卡（如表格预览）替代，正文 JSON 与预览重复时设 true */
  hideContent?: boolean;
}

function AgentMessage({
  message,
  onConfirmPlan,
  onCancelPlan,
  onRetryStep,
  onSendToCanvas,
  onRegenerate,
  hideContent,
}: AgentMessageProps) {
  // 图片查看大图（原生 dialog）：点击消息里的图片 → 打开查看，替代 target=_blank 新窗口
  const zoomRef = useRef(null);
  const [zoomUrl, setZoomUrl] = useState(null);
  const openZoom = useCallback((url) => {
    if (!url) return;
    setZoomUrl(url);
    requestAnimationFrame(() => zoomRef.current?.showModal());
  }, []);
  const zoomDialog = <ImageZoomDialog ref={zoomRef} url={zoomUrl} />;

  /** 复制整段回复（navigator.clipboard 在非安全上下文不可用，降级为提示而非静默失败） */
  const copyContent = useCallback(async () => {
    const text = String(message?.content || '');
    if (!text) return;
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      showToast('已复制回复', { type: 'success' });
    } catch {
      showToast('复制失败，请手动选中文本复制', { type: 'error' });
    }
  }, [message?.content]);

  if (message.role === 'user') {
    const skillNames = (message.skills || []).map((s) => s?.name || s?.id || '').filter(Boolean);
    return (
      <div className="agent-user-row">
        <div className="agent-user-col">
          {/* 已使用 Skill（对齐大雄：user 消息显示本轮用到的 Skill） */}
          {skillNames.length > 0 && (
            <div className="agent-user-skills">
              {skillNames.map((n, i) => (
                <span key={i} className="agent-user-skill">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
            <div className="agent-user-att">
              {message.attachments.map((a, i) => (
                <button key={i} type="button" onClick={() => openZoom(a.url)} title="点击查看大图">
                  <LazyImage src={a.url} alt="" className="w-full h-full" />
                </button>
              ))}
            </div>
          )}
          {message.content && <div className="agent-user-bubble">{message.content}</div>}
        </div>
        {zoomDialog}
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className="agent-ai-row">
        {message.reasoning && <Reasoning text={message.reasoning} streaming={message.streaming} />}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="agent-toolchips">
            {message.tool_calls.map((tc, i) => (
              <ToolCallChip key={i} name={tc.function?.name} args={tc.function?.arguments} />
            ))}
          </div>
        )}
        {/* 正文：无气泡无边框，直接铺在面板底色上。
            hideContent=true 时（如表格消息已被下方预览卡替代）隐藏，避免 JSON 与预览重复 */}
        {!hideContent && message.content && (
          <div className="agent-ai-text">
            <ChatMarkdown value={message.content} onOpenImage={openZoom} />
            {message.streaming && <span className="agent-cursor" />}
          </div>
        )}
        {/* 【对齐大雄】阶段1 generations → 渲染步骤卡片（可折叠，用户确认前检查每步） */}
        <GenerationStepsCard generations={message.generations} />
        {/* 待确认（策划/记忆/积分）→ 统一确认卡（AgentConfirmCard）：仅前端按钮翻转 awaitingConfirm。
             记忆确认（memory_suggest）与策划确认共用同一种卡，靠标题/图标/文案区分语义。 */}
        {message.awaiting_confirm &&
          !message.streaming &&
          (message.memory_suggest ? (
            <AgentConfirmCard
              icon={
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              }
              title="保存长期记忆"
              desc="AI 建议记录一条长期记忆，确认后将延续到后续每轮对话。"
              confirmText="保存"
              cancelText="暂不保存"
              onConfirm={onConfirmPlan}
              onCancel={onCancelPlan ? () => onCancelPlan(message.content) : undefined}
            />
          ) : (
            <AgentConfirmCard
              icon={
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              }
              title="确认执行策划"
              desc="AI 已给出策划，确认后按此执行；取消可重新输入指令。"
              confirmText="确认，按此执行"
              cancelText="取消"
              onConfirm={onConfirmPlan}
              onCancel={onCancelPlan ? () => onCancelPlan(message.content) : undefined}
            />
          ))}
        {/* 底部行：meta + 操作（发到画布从原气泡右下角移入此处，常驻淡显、hover 变亮） */}
        {!message.streaming && (
          <div className="agent-foot">
            <span className="agent-meta">以上内容由 AI 生成</span>
            <div className="agent-actions">
              {/* 发到画布：整段回复 → 新建文本节点（内容落生成区 data.text） */}
              {onSendToCanvas && (
                <button
                  type="button"
                  className="agent-icon-btn is-xs"
                  onClick={() => onSendToCanvas(message.content)}
                  title="发到画布生成文本节点"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="agent-icon-btn is-xs"
                onClick={copyContent}
                title="复制回复"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              {/* 重新生成：重发本条回复之前最近一条用户指令（useAgentChat 未单独暴露 regenerate，UI 层就近重发） */}
              {onRegenerate && (
                <button
                  type="button"
                  className="agent-icon-btn is-xs"
                  onClick={onRegenerate}
                  title="重新生成（重发上一条指令）"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        {zoomDialog}
      </div>
    );
  }

  if (message.role === 'tool') {
    let text = message.content;
    let ok = true;
    let nodeId = '';
    let failedEntries = [];
    try {
      const r = JSON.parse(message.content);
      ok = !!r.ok;
      nodeId = r.nodeId || '';
      text = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ''}` : '操作失败');
      // 【TASK-007 2.1】execute_plan 计划返回 entries：把失败的步收集出来，逐个提供「重试此步」（对齐大雄 retryAgentGeneration）
      if (Array.isArray(r.data?.entries)) {
        failedEntries = r.data.entries.filter((e) => e && e.status === 'failed' && e.nodeId);
      }
    } catch {
      /* keep raw */
    }
    // 失败且带 nodeId（generate_node 失败已回传）→ 显示「重试此步骤」；execute_plan 多失败步 → 逐项重试
    const canRetry = !ok && !!nodeId && typeof onRetryStep === 'function';
    const hasFailedSteps = failedEntries.length > 0 && typeof onRetryStep === 'function';
    // 弱化：一行小字，不再用带边框的卡片（工具结果是过程信息，不该和 AI 正文抢视觉）
    return (
      <div className="agent-toolmsg-wrap">
        <div className="agent-toolmsg">
          <div className="agent-toolmsg-line">
            {ok && !hasFailedSteps ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="is-ok"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="is-fail"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            <span>{hasFailedSteps ? `计划执行：${failedEntries.length} 步失败` : text}</span>
            {canRetry && (
              <button
                type="button"
                onClick={() => onRetryStep(nodeId)}
                className="agent-retry"
                title="重新生成此步骤（只重试失败项，不影响其他已完成卡片）"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>重试</span>
              </button>
            )}
          </div>
          {hasFailedSteps && (
            <div className="agent-failed-steps">
              {failedEntries.map((e) => (
                <div key={e.nodeId} className="agent-failed-row">
                  <span className="agent-failed-msg">{e.error || '生成失败'}</span>
                  <button
                    type="button"
                    onClick={() => onRetryStep(e.nodeId)}
                    className="agent-retry"
                    title={`重试此步（${e.id || ''}）`}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
    );
  }

  return null;
}

export default memo(AgentMessage);
