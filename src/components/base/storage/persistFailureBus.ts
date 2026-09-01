/**
 * persist:failed 事件的「节流 + 分发」纯逻辑（从 App.jsx 监听器中抽出，便于单测）。
 *
 * 【为什么抽】App.jsx:451-463 原生把「按 key 节流 + 逐 key 透传 key/error」写在组件 effect 里，
 * 逻辑埋在上帝文件且无 App.test.jsx，零覆盖。抽出为可注入 now/onToast/onLog 的工厂，
 * App 只负责把 showToast/logger 塞进来，节流与分发规则可独立断言。
 *
 * 【规则（与改造前一致，不改变行为）】
 *   1. 同一 key 在 throttleMs 内重复 → suppressed，不弹 Toast（避免高频刷屏）；
 *   2. 不同 key 各自弹出，不漏报；
 *   3. 每次事件（含被节流吞掉的）都调用 onLog 上报，供离线观测频率与 key 分布。
 *
 * @param {object} [opts]
 *   now: () => number  时间源（测试注入）
 *   throttleMs: number 同一 key 节流窗口（默认 config.THROTTLE_MS）
 *   onToast: (key,error) => void  需要弹 Toast 时的回调
 *   onLog:  (key,error,suppressed) => void  每次事件的日志回调
 * @returns {(payload: {key?:string, error?:string}) => void}
 */
import { THROTTLE_MS } from '../config.ts'

/** 工厂入参（可注入时间源与回调） */
interface ThrottledPersistOptions {
  now?: () => number
  throttleMs?: number
  onToast?: (key: string, error: string) => void
  onLog?: (key: string, error: string, suppressed: boolean) => void
}

/** persist:failed 事件载荷（键可缺省 → 兜底 '(未知键)'） */
interface PersistFailPayload {
  key?: string
  error?: string
}

export function createThrottledPersistHandler({
  now = Date.now,
  throttleMs = THROTTLE_MS,
  onToast,
  onLog,
}: ThrottledPersistOptions = {}): (payload: PersistFailPayload | null | undefined) => void {
  const lastByKey = new Map<string, number>()
  return (payload) => {
    const key = payload?.key ?? '(未知键)'
    const error = payload?.error ?? ''
    const t = now()
    const last = lastByKey.get(key)
    const suppressed = last !== undefined && t - last < throttleMs
    if (onLog) onLog(key, error, suppressed)
    if (suppressed) return
    lastByKey.set(key, t)
    if (onToast) onToast(key, error)
  }
}