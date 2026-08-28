/**
 * 降级透明度统一入口（P1-3）。
 *
 * 【为什么存在】此前「降级」散落各处：有的只 logger.warn（用户不可见）、有的各自写 toast
 * 文案（不一致）。本模块收口「两层降级」：
 *   - reportDegrade(layer, key, e)：统一记录降级日志（logger.warn），供排查；
 *   - reportDegrade({ layer, key, e, toast: '文案' })：除日志外再弹一次全局 toast，
 *     用于关键降级（如画布 KV → localStorage：用户保存的画布没进跨端 SQLite，需感知，
 *     否则换设备/重装后画布"失踪"）。
 *
 * 【节流】同类降级 toast 节流（默认 5s 窗口最多一次），避免高频落盘失败刷屏；
 *   toast 文案 key 相同即归并为同一类。
 *
 * 【依赖分类】In-process。唯一外部依赖为 logger / toastStore（模块级引用），无 React。
 * 非 UI、可单测。
 */
import { logger } from './logger.js'
import { showToast } from './toastStore.js'
import { THROTTLE_MS } from './config.js'

const throttle = { key: '', ts: 0 }

export function reportDegrade(args) {
  const {
    layer,   // 降级发生的层/模块（如 'kvStore'）
    key,     // 降级对象标识（如存储键 / 资源 url）
    e,       // 底层异常（可选，仅用于日志）
    toast,   // 可选：需要弹 toast 时的文案；不传则只记录日志不明示用户
    throttleMs = THROTTLE_MS,
  } = typeof args === 'string'
    ? { layer: args, key: '', e: arguments[1] } // 兼容：reportDegrade('layer', err)
    : args

  logger.warn(layer, `降级: ${key || ''}`, e?.message || e)

  if (toast) {
    const now = Date.now()
    if (toast === throttle.key && now - throttle.ts < throttleMs) return
    throttle.key = toast
    throttle.ts = now
    showToast(toast, { type: 'warning' })
  }
}