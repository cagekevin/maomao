/**
 * 轻量事件总线（对齐大雄 subscribe/publish）。
 *
 * 【解决什么】模块间非状态类事件通信解耦，避免各处硬编码 `window.dispatchEvent('xxx')`
 * 且"只监听未发布"（见 docs/11 §五.3）。提供一个统一发布/订阅通道。
 *
 * 【与 conversationStore 的区别】
 *  - conversationStore：管理"状态"（消息/工作流），用 useSyncExternalStore 订阅。
 *  - eventBus：管理"事件"（瞬时动作：workflow 开始/确认/某步骤完成），一次性广播，不存状态。
 * 两者互补，不重复。
 *
 * 【用法】
 *   import { publish, subscribe } from './eventBus.js'
 *   const off = subscribe('agent:workflow-status', (payload) => {...})
 *   publish('agent:workflow-status', { status: 'running' })
 */
const listeners = new Map() // event -> Set<fn>

/** 订阅事件，返回取消函数 */
export function subscribe(event, fn) {
  if (!event || typeof fn !== 'function') return () => {}
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(fn)
  return () => {
    const set = listeners.get(event)
    if (set) { set.delete(fn); if (set.size === 0) listeners.delete(event) }
  }
}

/** 发布事件（同步调用所有订阅者） */
export function publish(event, payload) {
  const set = listeners.get(event)
  if (!set) return
  set.forEach((fn) => {
    try { fn(payload) } catch (e) { console.error(`[eventBus] ${event} 订阅者异常:`, e?.message || e) }
  })
}

/** 订阅事件一次后自动取消 */
export function subscribeOnce(event, fn) {
  const off = subscribe(event, (payload) => {
    off()
    fn(payload)
  })
  return off
}

/** 清空某事件的所有订阅（测试/重置用） */
export function clearEvent(event) {
  listeners.delete(event)
}
