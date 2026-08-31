/**
 * tokenBudget —— 模型上下文预算：token 估算 + 压缩触发决策（纯函数，无副作用）
 * ════════════════════════════════════════════════════════════════
 *
 * 照搬参考项目 contextManager.ts 的预算思想：按模型「输入预算」与当前请求
 * token 估算的比例，决定是否需要压缩历史——达到约 75% 后台预压缩，达到约 90%
 * 请求前强制压缩。只决定「压不压、怎么压」，不负责实际压缩（压缩仍走 contextCompression）。
 *
 * 【合并 · 2026-08-30】原 estimateTokens.js（32 行 / 2 出口）整体并入本文件并私有化：
 *   - 原先「估算 → 决策」是两个文件串成的单链，每层只做一步，且全链仅
 *     useAgentChat.ts 一个消费者（2 处调用），属分层浅薄（见
 *     Temp/deepening-context-budget-seam-20260830-0010.md 候选 A）。
 *   - 合并后 Interface 面从 6 出口（2+4）收窄到 3 出口：
 *     resolveInputBudget / decideContextCompression / estimateMessagesTokens；
 *     estimateTokens（单段）与两个阈值常量转为模块私有——它们在 src/ 均零消费。
 *   - estimateMessagesTokens 保留导出：不是因为有生产消费者，而是它是「估算口径」
 *     的唯一直接测试锚点；若一并私有化，6 个估算用例只能借 decideContextCompression
 *     间接验证，估算口径一改就会误报红。
 *
 * 【估算口径】无精确 tokenizer，纯启发式：中文按约 1 字符≈1 token，拉丁按约 4 字符≈1 token，
 *   每条消息另计 8 token 结构开销（PER_MESSAGE_OVERHEAD）。
 *   估算只用于触发决策，不要求精确。
 *
 * 【降级语义】预算缺失/非法时一律返回保守值（预算 0、决策 'none'）——
 *   压缩是优化而非正确性要求，宁可不压也不因缺预算误触发；真超限会在 LLM 请求层暴露。
 * ════════════════════════════════════════════════════════════════
 */

/** 中文/日文/韩文等宽字元（CJK）正则 */
const CJK_RE = /[\u3400-\u9fff]/g
/** 每条消息的结构开销（role/分隔符等），照搬参考项目 tokenEstimate 的口径 */
const PER_MESSAGE_OVERHEAD = 8
/** 达到输入预算该比例时，后台预压缩（不阻塞本次请求） */
const CONTEXT_PRECOMPRESS_RATIO = 0.75
/** 达到输入预算该比例时，请求前强制压缩（阻塞等待压缩完成再发送） */
const CONTEXT_FORCE_COMPRESS_RATIO = 0.9

/** 估算单段纯文本的 token 数（启发式）。模块私有——外部只需 estimateMessagesTokens。 */
function estimateTokens(value: unknown): number {
  const s = typeof value === 'string' ? value : (value == null ? '' : String(value))
  if (!s) return 0
  const cjk = (s.match(CJK_RE) || []).length
  const rest = s.length - cjk
  return Math.ceil(cjk + rest / 4)
}

/** 估算一组消息（含 role/结构开销 + 可选 tool_calls）的 token 数。 */
export function estimateMessagesTokens(messages: unknown[] | null | undefined): number {
  let total = 0
  for (const m of (Array.isArray(messages) ? messages : []) as Record<string, any>[]) {
    if (!m || typeof m !== 'object') continue
    total += PER_MESSAGE_OVERHEAD + estimateTokens(typeof m.content === 'string' ? m.content : '')
    if (Array.isArray(m.tool_calls)) {
      total += estimateTokens(JSON.stringify(m.tool_calls))
    }
  }
  return total
}

/**
 * 解析输入预算：contextWindow × (1 − outputBudgetRatio)，留出输出生成空间。
 * @param {object} opts
 * @param {number} [opts.contextWindow] 模型上下文窗口（token）；缺省用保守兜底
 * @param {number} [opts.outputBudgetRatio] 输出预算留白比例（默认 0.2）
 * @returns {number} 输入预算（token），无效输入返回 0
 */
export function resolveInputBudget(
  { contextWindow = 0, outputBudgetRatio = 0.2 }: { contextWindow?: number; outputBudgetRatio?: number } = {}
): number {
  if (contextWindow <= 0) return 0
  return Math.round(contextWindow * (1 - Math.min(1, Math.max(0, outputBudgetRatio))))
}

/**
 * 决策这组将要发送的消息要不要触发压缩。
 * @param {object} opts
 * @param {Array}  [opts.messages]    将发给模型的消息（内部做 token 估算）
 * @param {number} [opts.inputBudget] 模型输入预算（token）
 * @returns {'force'|'precompress'|'none'} force=强制压缩 / precompress=后台预压缩 / none=不压缩
 */
/** 压缩决策：force=请求前强制压缩 / precompress=后台预压缩 / none=不压缩 */
export type CompressionDecision = 'force' | 'precompress' | 'none'

export function decideContextCompression(
  { messages = [], inputBudget = 0 }: { messages?: unknown[]; inputBudget?: number } = {}
): CompressionDecision {
  if (inputBudget <= 0 || messages.length === 0) return 'none'
  const ratio = estimateMessagesTokens(messages) / inputBudget
  if (ratio >= CONTEXT_FORCE_COMPRESS_RATIO) return 'force'
  if (ratio >= CONTEXT_PRECOMPRESS_RATIO) return 'precompress'
  return 'none'
}
