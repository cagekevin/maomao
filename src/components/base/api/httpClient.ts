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
import { withTimeout, TimeoutError, isTimeoutError } from '../asyncGuard.ts'
import { logger } from '../logger.ts'
import { HTTP_DEFAULT_TIMEOUT } from '../config.ts'

/** httpRequest 选项（fetch 统一入口的参数契约） */
export interface HttpRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | FormData | undefined
  /** 外部取消信号（组件生命周期） */
  signal?: AbortSignal
  /** 超时毫秒，默认 15000；<=0 禁用超时 */
  timeoutMs?: number
  /** 网络/超时自动重试次数，默认 3；业务错误不重试 */
  retries?: number
  /** 首轮重试等待 ms，默认 500（递增） */
  retryDelay?: number
  /** 是否解析 JSON，默认 true */
  parseJson?: boolean
  /** 每次重试前回调（打日志/更新 UI） */
  onRetry?: (attempt: number, err: unknown) => void
  /** 错误消息上下文 */
  label?: string
}

/** 错误信封解析结果 { code, message } */
export interface ErrorDetail {
  code: string
  message: string
}

/** 网络错误（fetch 本身失败：断网/连接被拒/跨域），区别于 HTTP 状态错误 */
export class NetworkError extends Error {
  isNetwork = true
  cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/** HTTP 非 2xx 错误（携带 status 与响应体 data） */
export class HttpError extends Error {
  status: number
  data?: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

/**
 * 统一错误报文解析（B2：错误信封的唯一解析入口，禁止各处手写 data.error||data.detail 拆包）。
 *
 * 输入后端错误信封，输出可决策的 { code, message }：
 *  - `{ error: string }`            → 字符串兜底（B0/B2 兼容后端旧形态，必须保留）
 *  - `{ error: { code, message } }` → 结构化信封（B2 sendError 带 code 形态）
 *  - `{ detail }` / `{ message }`   → 平铺兜底
 * 优先级：error.code > error.message > error.detail > data.detail > data.message。
 * @param {*} data 后端错误响应体（可能为 null/undefined）
 * @returns {{ code: string, message: string }}
 */
export function extractErrorDetail(data: unknown): ErrorDetail {
  const src = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (typeof src.error === 'string') {
    // 字符串错误信封兜底：{error:'msg'} → UNKNOWN（后端当前必返字符串，兜底不可删）
    return { code: 'UNKNOWN', message: src.error }
  }
  const e = src.error && typeof src.error === 'object' ? (src.error as Record<string, unknown>) : {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    // 优先级：error.code > error.message > error.detail > data.detail > data.message
    code: str(e.code) || 'UNKNOWN',
    message: str(e.message) || str(e.detail) || str(src.detail) || str(src.message),
  }
}

/**
 * parseJson:false 模式兜底读取错误体（二进制/流式出口共用）。body 只能消费一次，读取后即抛错。
 * 优先 json（OpenAI 错误信封），非法则回退 text，全失败兜底空对象 → HttpError 仅带 status。
 */
async function readErrorBody(res: Response): Promise<unknown> {
  try { return await res.json() } catch { /* 非 JSON 错误体 */ }
  try { return { message: await res.text() } } catch { /* 无 body */ }
  return {}
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
export async function httpRequest<T = unknown>(url: string, {
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
}: HttpRequestOptions = {}) {
  // 内部 controller：外部 signal 与内部超时都中止它，互不污染（超时不误伤组件其他请求）
  const internalCtrl = new AbortController()
  const onExternalAbort = () => internalCtrl.abort()
  if (signal) {
    if (signal.aborted) internalCtrl.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  const start = Date.now()
  const tag = label || url
  // 排查用日志：走 debug（模块位 http），不触发 /api/logs 上报（避免每次请求多一次 fire-and-forget fetch）
  logger.debug('http', '[请求] 发出', { method, url: tag, timeoutMs, retries }, { module: 'http' })

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
            // HttpError.message 只承载业务 message（B2）；HTTP 状态由 HttpError.status 单独暴露，不再拼前缀
            const { message } = extractErrorDetail(data)
            throw new HttpError(res.status, message, data)
          }
          logger.debug('http', '[请求] 成功', { method, url: tag, status: res.status, elapsedMs: Date.now() - start }, { module: 'http' })
          return data
        }
        if (!res.ok) {
          // parseJson:false（二进制/流式出口）也要尽量保留上游错误体，避免非 2xx 时错误信息丢失
          const data = await readErrorBody(res)
          const { message } = extractErrorDetail(data)
          throw new HttpError(res.status, message, data)
        }
        logger.debug('http', '[请求] 成功', { method, url: tag, status: res.status, elapsedMs: Date.now() - start }, { module: 'http' })
        return res
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string } | undefined
        // 外部取消：立即抛，不重试
        if (signal?.aborted || err?.name === 'AbortError') throw e
        // 仅网络/超时错误可重试；业务错误（HttpError）不重试
        const retryable = e instanceof NetworkError || isTimeoutError(e) || err?.name === 'TypeError'
        if (retryable && attempt < retries) {
          onRetry?.(attempt + 1, e)
          await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)))
          continue
        }
        // 归类：TypeError 通常是 fetch 网络失败（断网/拒绝连接）
        if (e instanceof TypeError) throw new NetworkError(err?.message || '网络错误', e)
        // 传输层事实（状态码/错误类型/耗时）统一记录，便于定位「哪条请求断在哪」
        const status = e instanceof HttpError ? e.status : undefined
        logger.debug('http', '[请求] 失败', { method, url: tag, status, error: err?.name || 'Error', elapsedMs: Date.now() - start }, { module: 'http' })
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
export function httpPost<T = unknown>(url: string, data?: unknown, opts: HttpRequestOptions = {}): Promise<T> {
  return httpRequest<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data == null ? undefined : JSON.stringify(data),
    ...opts,
  })
}

/**
 * 带日志的请求（API 层默认用这个）：失败统一记录到 logger，符合「错误走 logger」约定。
 */
export async function httpRequestLogged<T = unknown>(url: string, opts: HttpRequestOptions = {}, label = 'http'): Promise<T> {
  try {
    return await httpRequest(url, opts)
  } catch (e: unknown) {
    // logger.warn 只支持 3 参（category/action/detail）；err.message 原实现即被忽略，故不带入
    logger.warn(label, '请求失败', `${url}`)
    throw e
  }
}
