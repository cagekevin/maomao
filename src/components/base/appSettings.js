/**
 * 应用设置（对齐官方 `app_settings`，前端 localStorage）。
 *
 * 官方（18-KV存储键读写面梳理.md §3.4）：app_settings 属前端 localStorage（Ar 枚举，走 Wr 层），
 * 用于持久化画布默认值、性能模式开关、AI 助手开关、小地图开关等 UI 偏好，刷新不丢。
 *
 * 本模块提供统一的 read/write + React hook，App 层用它初始化各 state 并在变化时写回。
 */
import { useSyncExternalStore } from 'react'
import { contentGet, contentSet } from './contentStore.js'
import { buildDefaults } from './settings/settingRegistry.js'

const KEY = 'app_settings'

// 默认应用设置：单一事实来源在 settings/settingRegistry.js（新增开关只改注册表）
const DEFAULTS = buildDefaults()

let settings = load()

function load() {
  try {
    const parsed = contentGet(KEY)
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

// 订阅（供 useAppSettings）
const listeners = new Set()
function save() {
  try { contentSet(KEY, settings) } catch { /* ignore */ }
}
function notify() {
  listeners.forEach((l) => l())
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return settings
}

/** 读取某个设置（默认值兜底） */
export function getSetting(key) {
  return settings[key] !== undefined ? settings[key] : DEFAULTS[key]
}

/** 写入一个设置（更新内存 + 持久化 + 通知） */
export function setSetting(key, value) {
  settings = { ...settings, [key]: value }
  save()
  notify()
  // 调试总开关桥接：同步写 window.__DEBUG_ALL，让 isDebugModuleOn（config.js）实时读到并全开 debug。
  // 这样用户在「其他设置→调试模式」一键开/关，不依赖 AI 敲 window.__DEBUG_*。
  if (key === 'debugOn') syncDebugAll(!!value)
}

/** 把调试总开关状态同步到 window.__DEBUG_ALL（isDebugModuleOn 的实时读取源） */
function syncDebugAll(v) {
  if (typeof window !== 'undefined') window.__DEBUG_ALL = !!v
}

// 应用加载初始化：若已持久化的调试总开关为开（云同步/刷新恢复），启动即同步 window.__DEBUG_ALL，
// 否则刷新后 debug 会因 window 为新的而丢失开启状态。
syncDebugAll(!!getSetting('debugOn'))

/** React hook：订阅 app_settings */
export function useAppSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
