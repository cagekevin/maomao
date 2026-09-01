/**
 * ── 唯一性声明（2026-08-30）──
 * 全项目唯一的事件广播通道（subscribe/publish/subscribeOnce）。
 * 对外「一对多、瞬时广播」一律走本模块 + contracts.ts EVENTS 登记（check:events 门禁）。
 * 禁止自建第二套广播（window.dispatchEvent / 手写 Map 监听）。
 * taskCompletionBus / persistFailureBus / assetStore.onAssetSent 均为本总线之上的薄封装，非第二套；
 * promptHubStore.js subscribePromptHub / taskStore.js listeners 是「模块内订阅」非广播通道（见各自文件头）。
 * 明确不做：不加优先级/超时/统一 context 调度器（当前订阅者全为 UI 刷新，规模不需要）。
 *
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
 * 【当前事件注册表】改代码前先查这份全量清单（发布/订阅均须存在，避免"只监听未发布"）：
 *  - agent:task-completed   taskCompletionBus.publishTaskCompleted 发布 → useNodeGeneration:210 订阅（任务完成→精准回填节点）
 *  - asset:sent             assetStore.onAssetSent/emitAssetSent（薄封装）→ AssetLibrary 刷新（P1-D 收口裸回调桥）
 *  - presets-changed        promptManager:88 发布 → PromptLibrary:40 订阅（预设库跨节点同步）
 *  - project:import         ProjectSelector:99 发布 → App:343 订阅（导入按钮→App 处理文件）
 *  - project:export         ProjectSelector:103 发布 → App:344 订阅（导出按钮→App 下载）
 *  - persist:failed        storageAdapter 发布（sSet/sRemove 持久化失败）→ App 订阅（节流 toast「部分数据保存失败」）
 * 详细说明见 docs/实时总线-Event-Bus-全解-2026-08-16.md。新增事件统一用「领域:动作」命名。
 *
 * 【用法】
 *   import { publish, subscribe } from './eventBus.ts'
 *   const off = subscribe('agent:task-completed', (payload) => {...})
 *   publish('agent:task-completed', { taskId, nodeId, resultUrl })
 */
import { logger } from './logger.ts'

/** 订阅者载荷类型（事件载荷无固定结构，各事件按 EVENTS 登记表约定；此处宽松为 unknown 以兼容所有事件） */
type EventPayload = unknown
/** 事件订阅回调类型 */
type EventHandler = (payload: EventPayload) => void
/** 取消订阅函数类型 */
type Unsubscribe = () => void

const listeners = new Map<string, Set<EventHandler>>() // event -> Set<fn>

/** 订阅事件，返回取消函数 */
export function subscribe(event: string, fn: EventHandler): Unsubscribe {
  if (!event || typeof fn !== 'function') return () => {}
  if (!listeners.has(event)) listeners.set(event, new Set<EventHandler>())
  listeners.get(event)!.add(fn)
  return () => {
    const set = listeners.get(event)
    if (set) { set.delete(fn); if (set.size === 0) listeners.delete(event) }
  }
}

/** 发布事件（同步调用所有订阅者） */
export function publish(event: string, payload?: EventPayload): void {
  const set = listeners.get(event)
  if (!set) return
  set.forEach((fn) => {
    try { fn(payload) } catch (e) { logger.warn('eventBus', `${event} 订阅者异常`, (e as { message?: unknown } | null)?.message || String(e)) }
  })
}

/** 订阅事件一次后自动取消 */
export function subscribeOnce(event: string, fn: EventHandler): Unsubscribe {
  const off = subscribe(event, (payload) => {
    off()
    fn(payload)
  })
  return off
}

/** 清空某事件的所有订阅（测试/重置用） */
export function clearEvent(event: string): void {
  listeners.delete(event)
}
