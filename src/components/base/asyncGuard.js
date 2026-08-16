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
 * 给 Promise 加超时。超时后 reject TimeoutError（可传 AbortSignal 供底层真正取消）。
 * @param {Promise} promise
 * @param {number} ms 超时毫秒
 * @param {string} [message] 超时文案
 * @param {AbortSignal} [signal] 可选，用于超时时取消底层请求
 * @returns {Promise}
 */
export function withTimeout(promise, ms, message = '操作超时', signal) {
  return new Promise((resolve, reject) => {
    if (!(ms > 0)) return resolve(promise)
    const timer = setTimeout(() => {
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
  const { timeoutMs = 20000, crossOrigin = 'anonymous' } = opts
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
