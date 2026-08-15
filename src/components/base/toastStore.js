/**
 * 统一通知（toast）store —— 打地基：全项目所有交互提醒都走这一个入口。
 *
 * 【为什么用模块级发布订阅，而非 React Context】
 * 官方把所有节点的提醒都收敛到一个 `showToast`（H_.jsx k / onShowToast 回调）。原型若用
 * React Context + Provider，会要求「每个想弹提示的组件都包在 Provider 里」，深层节点很麻烦。
 * 模块级 store + 订阅：
 *  - 任何组件 `import { showToast } from './toastStore.js'` 即可弹提示，无需包 Provider；
 *  - 渲染端（ToastContainer）只 subscribe 一次，把 store 里的 toast 列表画出来；
 *  - 之后接入官方 onShowToast 回调时，直接把它指向本 store 的 showToast 即可，全项目统一。
 *
 * 【接入约定（给后续所有交互提醒用）】
 * 弹提示：showToast('已复制 3 个节点', { type: 'success' })
 * type 取四档，对应状态色模板（doc39 §3.2）：success(绿) / error(红) / warning(黄) / info(蓝，默认)
 * 需要持久（不自动消失）：showToast('msg', { duration: 0 })
 */

// 单条 toast 结构：{ id, message, type, duration }
let toasts = []
let listeners = new Set()
let seq = 0

const DURATION = 3000 // 默认 3s 自动消失

/**
 * 弹一条提示。
 * @param {string} message 提示内容
 * @param {Object} [opts]
 * @param {'success'|'error'|'warning'|'info'} [opts.type='info'] 状态档（决定配色）
 * @param {number} [opts.duration=3000] 显示时长(ms)；0 = 不自动消失
 * @returns {number} toast id（可用于手动关闭）
 */
export function showToast(message, { type = 'info', duration = DURATION } = {}) {
  const id = ++seq
  toasts = [...toasts, { id, message: String(message ?? ''), type, duration }]
  emit()
  return id
}

/** 手动关闭某条 toast */
export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** 关闭所有 toast */
export function clearToasts() {
  if (toasts.length === 0) return
  toasts = []
  emit()
}

/** 订阅（返回取消函数）。ToastContainer 用它渲染。 */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 读当前快照 */
export function getToasts() {
  return toasts
}

function emit() {
  listeners.forEach((l) => l())
}
