/**
 * 统一异步边界守卫（R2 系统性根因治理）。
 *
 * 【为什么存在】项目大量异步操作（图片加载 / 视频生成 / 全景解码 / 网关请求）没有统一
 * 超时兜底：有的有（faceMosaic.loadImage 20s）、有的没有（imageCompress.loadImage 永久挂起），
 * 导致「loading 永不结束 / 用户无感卡死」。本模块提供统一的超时 + 失败语义，消灭这类 bug。
 *
 * 【用法】
 *  - withTimeout(promise, ms, msg?)：给任意 Promise 加超时，超时抛 TimeoutError。
 *  - isTimeoutError(e)：判断是否超时（调用方可据此决定"重试/降级/提示"）。
 *  - loadImageWithTimeout(url, ms?, opts?)：图片加载 + 超时 + crossOrigin + 取消，统一图片入口。
 */

import { IMAGE_LOAD_TIMEOUT } from './config.js'

/** 超时错误（统一类型，便于调用方用 isTimeoutError 区分"超时"与"真实失败"） */
export class TimeoutError extends Error {
  constructor(message = '操作超时') {
    super(message)
    this.name = 'TimeoutError'
    this.isTimeout = true
  }
}

/** 判断是否为超时错误 */
export function isTimeoutError(e) {
  return !!(e && (e instanceof TimeoutError || e?.isTimeout === true || e?.name === 'TimeoutError'))
}

/**
 * 给 Promise 加超时。超时后 reject TimeoutError。
 * @param {Promise} promise
 * @param {number} ms 超时毫秒
 * @param {string} [message] 超时文案
 * @param {AbortSignal} [signal] 可选，超时时 abort 它（供底层真正取消，避免资源泄漏）
 * @param {Function} [onTimeout] 可选，超时时回调（在 reject 前调用，供调用方主动 cancel 底层任务）
 * @returns {Promise}
 */
export function withTimeout(promise, ms, message = '操作超时', signal, onTimeout) {
  return new Promise((resolve, reject) => {
    if (!(ms > 0)) return resolve(promise)
    const timer = setTimeout(() => {
      try { onTimeout?.() } catch { /* 取消回调失败不阻断 */ }
      // 中止底层信号：优先标准 abort()，跨环境（jsdom/老浏览器）用 dispatchEvent fallback
      try {
        if (signal?.abort) signal.abort()
        else signal?.dispatchEvent?.(new Event('abort'))
      } catch { /* 忽略 */ }
      reject(new TimeoutError(message))
    }, ms)
    const done = () => clearTimeout(timer)
    Promise.resolve(promise)
      .then((v) => { done(); resolve(v) })
      .catch((e) => { done(); reject(e) })
  })
}

/**
 * 统一图片加载入口：HTMLImageElement + 超时 + crossOrigin + 可取消。
 * 替代 imageCompress.loadImage（无超时）与 faceMosaic.loadImage（各自实现）。
 * @param {string} url
 * @param {object} [opts] { timeoutMs=20000, crossOrigin='anonymous' }
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageWithTimeout(url, opts = {}) {
  const { timeoutMs = IMAGE_LOAD_TIMEOUT, crossOrigin = 'anonymous' } = opts
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = crossOrigin
    const timer = setTimeout(() => {
      img.src = '' // 打断挂起加载
      reject(new TimeoutError('图片加载超时'))
    }, timeoutMs)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); reject(new Error('图片加载失败（可能跨域或格式不支持）')) }
    img.src = String(url || '')
  })
}
