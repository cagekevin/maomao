/**
 * 统一通知（toast）store —— 打地基：全项目所有交互提醒都走这一个入口。
 *
 * 【为什么用模块级发布订阅，而非 React Context】
 * 官方把所有节点的提醒都收敛到一个 `showToast`（H_.jsx k / onShowToast 回调）。原型若用
 * React Context + Provider，会要求「每个想弹提示的组件都包在 Provider 里」，深层节点很麻烦。
 * 模块级 store + 订阅：
 *  - 任何组件 `import { showToast } from './toastStore.ts'` 即可弹提示，无需包 Provider；
 *  - 渲染端（ToastContainer）只 subscribe 一次，把 store 里的 toast 列表画出来；
 *  - 之后接入官方 onShowToast 回调时，直接把它指向本 store 的 showToast 即可，全项目统一。
 *
 * 【接入约定（给后续所有交互提醒用）】
 * 弹提示：showToast('已复制 3 个节点', { type: 'success' })
 * type 取四档，对应状态色模板（doc39 §3.2）：success(绿) / error(红) / warning(黄) / info(蓝，默认)
 * 需要持久（不自动消失）：showToast('msg', { duration: 0 })
 */

// 单条 toast 结构：{ id, message, type, duration }
/** toast 状态档（对应状态色模板 doc39 §3.2：success绿 / error红 / warning黄 / info蓝） */
type ToastType = 'success' | 'error' | 'warning' | 'info'
/** 单条 toast 结构 */
interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
}
/** showToast 选项 */
interface ToastOptions {
  type?: ToastType
  duration?: number
}
let toasts: Toast[] = []
let listeners = new Set<() => void>()
let seq = 0

const DURATION = 3000 // 默认 3s 自动消失

// 分级默认时长：失败停留更久，让用户看清；中性 info 最短。
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 2500,
  info: 2500,
  warning: 3500,
  error: 4000,
}

/**
 * 弹一条提示。
 * @param {string} message 提示内容
 * @param {Object} [opts]
 * @param {'success'|'error'|'warning'|'info'} [opts.type='info'] 状态档（决定配色）
 * @param {number} [opts.duration] 显示时长(ms)；0 = 不自动消失；缺省按分级取 DEFAULT_DURATION
 * @returns {number} toast id（可用于手动关闭）
 */
export function showToast(message: string, { type = 'info' as ToastType, duration }: ToastOptions = {}): number {
  const id = ++seq
  const finalDuration = duration ?? DEFAULT_DURATION[type] ?? DURATION
  toasts = [...toasts, { id, message: String(message ?? ''), type, duration: finalDuration }]
  emit()
  return id
}

/** 手动关闭某条 toast */
export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** 关闭所有 toast */
export function clearToasts(): void {
  if (toasts.length === 0) return
  toasts = []
  emit()
}

/** 订阅（返回取消函数）。ToastContainer 用它渲染。 */
export function subscribe(listener: () => void): () => boolean {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 读当前快照 */
export function getToasts(): Toast[] {
  return toasts
}

function emit(): void {
  listeners.forEach((l) => l())
}

/**
 * 语义化快捷出口。业务代码优先用这四个，无需记忆 type 字符串，分级默认时长自动生效。
 * 约定：仅当用户「无法直接从界面感知结果」时才弹——后台保存、跨域复制失败、云端推送、
 * 降级有损等；用户一眼能看出的结果（粘贴图片到画布、复制节点）不要弹，属于噪音。
 */
export const toastSuccess = (message: string, opts?: ToastOptions): number => showToast(message, { ...opts, type: 'success' })
export const toastError = (message: string, opts?: ToastOptions): number => showToast(message, { ...opts, type: 'error' })
export const toastWarning = (message: string, opts?: ToastOptions): number => showToast(message, { ...opts, type: 'warning' })
export const toastInfo = (message: string, opts?: ToastOptions): number => showToast(message, { ...opts, type: 'info' })
