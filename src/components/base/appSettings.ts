/**
 * 应用设置（对齐官方 `app_settings`，前端 localStorage）。
 *
 * 官方（18-KV存储键读写面梳理.md §3.4）：app_settings 属前端 localStorage（Ar 枚举，走 Wr 层），
 * 用于持久化画布默认值、性能模式开关、AI 助手开关、小地图开关等 UI 偏好，刷新不丢。
 *
 * 本模块提供统一的 read/write + React hook，App 层用它初始化各 state 并在变化时写回。
 */
import { useSyncExternalStore } from 'react'
import { contentGet, contentSet } from './contentStore.ts'
import { buildDefaults } from './settings/settingRegistry.ts'

const KEY: string = 'app_settings'

// 默认应用设置：单一事实来源在 settings/settingRegistry.js（新增开关只改注册表）
const DEFAULTS: Record<string, unknown> = buildDefaults()

let settings: Record<string, unknown> = load()

function load(): Record<string, unknown> {
  try {
    const parsed = contentGet(KEY)
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

// 订阅（供 useAppSettings）
const listeners = new Set<() => void>()
function save(): void {
  try { contentSet(KEY, settings) } catch { /* ignore */ }
}
function notify(): void {
  listeners.forEach((l) => l())
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot(): Record<string, unknown> {
  return settings
}

/** 读取某个设置（默认值兜底） */
export function getSetting(key: string): unknown {
  return settings[key] !== undefined ? settings[key] : DEFAULTS[key]
}

/** 写入一个设置（更新内存 + 持久化 + 通知） */
export function setSetting(key: string, value: unknown): void {
  settings = { ...settings, [key]: value }
  save()
  notify()
  // 调试总开关桥接：同步写 window.__DEBUG_ALL，让 isDebugModuleOn（config.js）实时读到并全开 debug。
  // 这样用户在「其他设置→调试模式」一键开/关，不依赖 AI 敲 window.__DEBUG_*。
  if (key === 'debugOn') syncDebugAll(!!value)
}

/** 扩展 window 上的调试总开关（config.js isDebugModuleOn 运行时读取源；非标准窗口属性需显式声明） */
type DebugWindow = Window & { __DEBUG_ALL: boolean }

/** 把调试总开关状态同步到 window.__DEBUG_ALL（isDebugModuleOn 的实时读取源） */
function syncDebugAll(v: boolean): void {
  if (typeof window !== 'undefined') (window as unknown as DebugWindow).__DEBUG_ALL = !!v
}

// 应用加载初始化：若已持久化的调试总开关为开（云同步/刷新恢复），启动即同步 window.__DEBUG_ALL，
// 否则刷新后 debug 会因 window 为新的而丢失开启状态。
syncDebugAll(!!getSetting('debugOn'))

/** React hook：订阅 app_settings */
export function useAppSettings(): Record<string, unknown> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
