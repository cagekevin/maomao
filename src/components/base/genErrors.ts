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
import { isTimeoutError } from './asyncGuard.ts'
import { GEN_ERRORS } from './contracts.js'
import type { ErrorKind } from '@/types'

/** 错误分类结果 */
export type ClassifiedError = { type: ErrorKind; message: string; retryable: boolean }

/**
 * 把任意错误归入可决策类型。
 * 识别优先级：取消 > 超时 > 网络 > HTTP > 业务兜底。
 */
export function classifyError(e: unknown): ClassifiedError {
  if (!e) return { type: 'business', message: '', retryable: false }
  const err = e as { name?: string; message?: string; aborted?: boolean; isNetwork?: boolean; status?: number }
  const name = err?.name
  const message = err?.message || String(e || '')
  if (name === 'AbortError' || err?.aborted) return { type: 'abort', message, retryable: false }
  if (isTimeoutError(e) || name === 'TimeoutError') return { type: 'timeout', message, retryable: true }
  // fetch 断网以 TypeError 拒绝；历史代码曾用「网络错误」前缀文案，向后兼容一并识别
  if (name === 'NetworkError' || err?.isNetwork === true || e instanceof TypeError || message.startsWith('网络错误')) {
    return { type: 'network', message, retryable: true }
  }
  if (name === 'HttpError' || typeof err?.status === 'number') return { type: 'http', message, retryable: false }
  return { type: 'business', message, retryable: false }
}

/** 生成类超时文案：以 GEN_ERRORS.timeout.label 为基底，并保留真实秒数（用户要求不丢弃「超过 X 秒」细节）。
 * 收口：各代理的超时文案统一走这里，禁止写「生成超时/生图超时/轮询超时」等多种变体。
 * @param ms 总超时毫秒，如「请求超时（超过 300 秒未返回）」 */
export function timeoutMessage(ms: number): string {
  return `${GEN_ERRORS.timeout.label}（超过 ${Math.round(ms / 1000)} 秒未返回）`
}
