/**
 * 统一错误分类 —— 异步/网络错误的单一决策入口（CONTEXT §三）。
 *
 * 【为什么存在】此前错误判断散落各处（节点自写 if(/网络错误/)、各 API 各写各的），
 * 分类口径不一致。本模块把「错误 → 类型 → 决策依据」集中：
 *  - classifyError(e) → { type, message, retryable }
 *  - type ∈ abort | timeout | network | http | business（登记于 contracts.js GEN_ERRORS）
 *  - retryable：仅 timeout/network 可自动重试（业务失败不重试，防封号）
 *
 * 【用法】调用方拿到 type 后统一决策（abort 原样上抛 / network·timeout 降级 / 其余按业务
 * 处理），禁止再自写 if(/网络错误/) 之类关键词判断。类型登记/文案在 contracts.js GEN_ERRORS。
 */
import { isTimeoutError } from './asyncGuard.js'
import { GEN_ERRORS } from './contracts.js'

/**
 * 把任意错误归入可决策类型。
 * 识别优先级：取消 > 超时 > 网络 > HTTP > 业务兜底。
 * @param {unknown} e
 * @returns {{ type: keyof typeof GEN_ERRORS, message: string, retryable: boolean }}
 */
export function classifyError(e) {
  if (!e) return { type: 'business', message: '', retryable: false }
  const name = e?.name
  const message = e?.message || String(e || '')
  if (name === 'AbortError' || e?.aborted) return { type: 'abort', message, retryable: false }
  if (isTimeoutError(e) || name === 'TimeoutError') return { type: 'timeout', message, retryable: true }
  // fetch 断网以 TypeError 拒绝；历史代码曾用「网络错误」前缀文案，向后兼容一并识别
  if (name === 'NetworkError' || e?.isNetwork === true || e instanceof TypeError || /^网络错误/.test(message)) {
    return { type: 'network', message, retryable: true }
  }
  if (name === 'HttpError' || typeof e?.status === 'number') return { type: 'http', message, retryable: false }
  return { type: 'business', message, retryable: false }
}
