/**
 * 应用设置（对齐官方 `app_settings`，前端 localStorage）。
 *
 * 官方（18-KV存储键读写面梳理.md §3.4）：app_settings 属前端 localStorage（Ar 枚举，走 Wr 层），
 * 用于持久化画布默认值、性能模式开关、AI 助手开关、小地图开关等 UI 偏好，刷新不丢。
 *
 * 本模块提供统一的 read/write + React hook，App 层用它初始化各 state 并在变化时写回。
 */
import { useSyncExternalStore } from 'react'
import { sGet, sSet } from './storageAdapter.js'

const KEY = 'app_settings'

// 默认应用设置（对齐官方默认：性能模式默认开）
const DEFAULTS = {
  performanceMode: true,   // 缩放性能模式（官方 ge 默认 true）
  minimapOn: false,        // 小地图默认关
  agentOpen: false,        // AI 助手默认关
}

let settings = load()

function load() {
  try {
    const raw = sGet(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

// 订阅（供 useAppSettings）
const listeners = new Set()
function save() {
  try { sSet(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
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
}

/** React hook：订阅 app_settings */
export function useAppSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
