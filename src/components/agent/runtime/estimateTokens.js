/**
 * tokenEstimate —— 粗略 token 估算（无精确 tokenizer，纯启发式估算口径）。
 *
 * 照搬参考项目 contextManager+tokenEstimate 的思想：不依赖真实 tokenizer，
 * 用字符结构估算，供「上下文预算触发压缩」决策用（达到预算 75% 预压缩 / 90% 强制）。
 * 估算只用于触发决策，不要求精确；中文按约 1 字符≈1 token，拉丁按约 4 字符≈1 token。
 */

/** 中文/日文/韩文等宽字元（CJK）正则 */
const CJK_RE = /[\u3400-\u9fff]/g

/** 估算单段纯文本的 token 数（启发式）。 */
export function estimateTokens(value) {
  const s = typeof value === 'string' ? value : (value == null ? '' : String(value))
  if (!s) return 0
  const cjk = (s.match(CJK_RE) || []).length
  const rest = s.length - cjk
  return Math.ceil(cjk + rest / 4)
}

/** 估算一组消息（含 role/结构开销 + 可选 tool_calls）的 token 数。 */
export function estimateMessagesTokens(messages) {
  const PER_MESSAGE_OVERHEAD = 8
  let total = 0
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== 'object') continue
    total += PER_MESSAGE_OVERHEAD + estimateTokens(typeof m.content === 'string' ? m.content : '')
    if (Array.isArray(m.tool_calls)) {
      total += estimateTokens(JSON.stringify(m.tool_calls))
    }
  }
  return total
}