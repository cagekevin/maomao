/**
 * 统一请求层 —— 所有 fetch 的唯一入口（AbortSignal 治理）。
 *
 * 【为什么存在】项目原先 44+ 处 fetch 裸调：无超时（可能永久挂起）、无取消、
 * 无错误分类。本模块把「超时 / 取消 / 错误分类 / 受限重试」集中到这里，统一消灭
 * 这类 bug。任何新网络请求必须走 httpRequest，禁止再裸写 fetch。
 *
 * 【能力】
 *  - 超时：默认 15s，超时抛 TimeoutError（asyncGuard.withTimeout），并中止底层请求。
 *  - 取消：接受外部 signal（组件生命周期），与内部超时 controller 隔离，互不污染。
 *  - 错误分类：TimeoutError / NetworkError / HttpError(status,data) / AbortError。
 *  - 受限重试：仅网络/超时错误自动重试（业务 4xx/5xx 不重试），默认最多 3 次。
 *
 * 【返回】parseJson=true（默认）时返回解析后的 JSON；HTTP 非 2xx 抛 HttpError。
 */
import { withTimeout, TimeoutError, isTimeoutError } from './asyncGuard.js'
import { logger } from './logger.js'
import { HTTP_DEFAULT_TIMEOUT } from './config.js'

/** 网络错误（fetch 本身失败：断网/连接被拒/跨域），区别于 HTTP 状态错误 */
export class NetworkError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'NetworkError'
    this.isNetwork = true
    this.cause = cause
  }
}

/** HTTP 非 2xx 错误（携带 status 与响应体 data） */
export class HttpError extends Error {
  constructor(status, message, data) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

/**
 * 统一 HTTP 请求。
 * @param {string} url
 * @param {object} [opts]
 *   - method?: 'GET'|'POST'|...
 *   - headers?: Record<string,string>
 *   - body?: string
 *   - signal?: AbortSignal       外部取消信号（组件生命周期）
 *   - timeoutMs?: number         超时毫秒，默认 15000；<=0 禁用超时
 *   - retries?: number           网络/超时自动重试次数，默认 3；业务错误不重试
 *   - retryDelay?: number        首轮重试等待 ms，默认 500（递增）
 *   - parseJson?: boolean        是否解析 JSON，默认 true
 *   - onRetry?: (attempt, err)  每次重试前回调（用于打日志/更新 UI）
 *   - label?: string             错误消息上下文，如 'fetchTasks' → "fetchTasks failed: HTTP 500"
 * @returns {Promise<any>}        解析后的响应体（parseJson=true）或 Response
 * @throws {TimeoutError|NetworkError|HttpError|AbortError}
 */
export async function httpRequest(url, {
  method = 'GET',
  headers,
  body,
  signal,
  timeoutMs = HTTP_DEFAULT_TIMEOUT,
  retries = 3,
  retryDelay = 500,
  parseJson = true,
  onRetry,
  label,
} = {}) {
  // 内部 controller：外部 signal 与内部超时都中止它，互不污染（超时不误伤组件其他请求）
  const internalCtrl = new AbortController()
  const onExternalAbort = () => internalCtrl.abort()
  if (signal) {
    if (signal.aborted) internalCtrl.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      // signal 已中止 → 立即抛，不 fetch
      if (internalCtrl.signal.aborted) {
        const err = new Error('The user aborted a request.')
        err.name = 'AbortError'
        throw err
      }
      try {
        const res = await withTimeout(
          fetch(url, { method, headers, body, signal: internalCtrl.signal }),
          timeoutMs,
          `请求超时（${timeoutMs}ms）`,
          internalCtrl.signal,
        )
        if (parseJson) {
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            const detail = data?.error || data?.detail || data?.message
            const base = `${label ? label + ' failed: ' : ''}HTTP ${res.status}`
            throw new HttpError(res.status, detail ? `${base}: ${detail}` : base, data)
          }
          return data
        }
        if (!res.ok) throw new HttpError(res.status, `${label ? label + ' failed: ' : ''}HTTP ${res.status}`)
        return res
      } catch (e) {
        // 外部取消：立即抛，不重试
        if (signal?.aborted || e?.name === 'AbortError') throw e
        // 仅网络/超时错误可重试；业务错误（HttpError）不重试
        const retryable = e instanceof NetworkError || isTimeoutError(e) || e?.name === 'TypeError'
        if (retryable && attempt < retries) {
          onRetry?.(attempt + 1, e)
          await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)))
          continue
        }
        // 归类：TypeError 通常是 fetch 网络失败（断网/拒绝连接）
        if (e instanceof TypeError) throw new NetworkError(e?.message || '网络错误', e)
        throw e
      }
    }
  } finally {
    signal?.removeEventListener?.('abort', onExternalAbort)
  }
}

/**
 * 快速 JSON 请求助手：POST 且自动序列化 body、带 Content-Type。
 * 用法：httpPost('/api/x', { foo: 1 }, { signal })
 */
export function httpPost(url, data, opts = {}) {
  return httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data == null ? undefined : JSON.stringify(data),
    ...opts,
  })
}

/**
 * 带日志的请求（API 层默认用这个）：失败统一记录到 logger，符合「错误走 logger」约定。
 */
export async function httpRequestLogged(url, opts = {}, label = 'http') {
  try {
    return await httpRequest(url, opts)
  } catch (e) {
    logger.warn(label, '请求失败', `${url}`, e?.message)
    throw e
  }
}
