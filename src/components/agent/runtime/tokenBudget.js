/**
 * tokenBudget —— 模型上下文预算触发压缩决策（纯函数，无副作用）——
 *
 * 照搬参考项目 contextManager.ts 的预算思想：按模型「输入预算」与当前请求
 * token 估算的比例，决定是否需要压缩历史——达到约 75% 后台预压缩，达到约 90%
 * 请求前强制压缩。只决定「压不压、怎么压」，不负责实际压缩（压缩仍走 contextCompression）。
 *
 * 估算仅用于触发决策，不要求精确；取值口径见 estimateTokens.js（CJK≈1字/token、
 * 拉丁≈4字/token）。
 */
import { estimateMessagesTokens } from './estimateTokens.js'

/** 达到输入预算该比例时，后台预压缩（不阻塞本次请求） */
export const CONTEXT_PRECOMPRESS_RATIO = 0.75
/** 达到输入预算该比例时，请求前强制压缩（阻塞等待压缩完成再发送） */
export const CONTEXT_FORCE_COMPRESS_RATIO = 0.9

/**
 * 解析输入预算：contextWindow × (1 − outputBudgetRatio)，留出输出生成空间。
 * @param {object} opts
 * @param {number} [opts.contextWindow] 模型上下文窗口（token）；缺省用保守兜底
 * @param {number} [opts.outputBudgetRatio] 输出预算留白比例（默认 0.2）
 * @returns {number} 输入预算（token），无效输入返回 0
 */
export function resolveInputBudget({ contextWindow = 0, outputBudgetRatio = 0.2 } = {}) {
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
export function decideContextCompression({ messages = [], inputBudget = 0 } = {}) {
  if (inputBudget <= 0 || messages.length === 0) return 'none'
  const ratio = estimateMessagesTokens(messages) / inputBudget
  if (ratio >= CONTEXT_FORCE_COMPRESS_RATIO) return 'force'
  if (ratio >= CONTEXT_PRECOMPRESS_RATIO) return 'precompress'
  return 'none'
}