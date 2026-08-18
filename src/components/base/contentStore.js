/**
 * Content 层：横切存储权威入口。
 *
 * 所有业务数据读写必须走 contentStore，禁止直调 storageAdapter/kvStore/原生 localStorage。
 * contentStore 根据 STORAGE_KEYS 登记的路由配置自动分流到后端。
 *
 * ── 设计原则 ──
 * 1. 键必须登记：未在 STORAGE_KEYS 登记的键会触发 warning，帮助在迁移期发现遗漏
 * 2. 自动路由：调用方不感知后端（local/KV/native），由 STORAGE_KEYS 决定
 * 3. 缓存优先：同步 API 读内存缓存（惰性加载），避免重复序列化/网络请求
 * 4. 变更通知：set/delete 自动通知订阅者，React 组件可响应式更新
 * 5. 不可变快照：getSnapshot() 返回冻结副本，用于撤销/恢复/历史追踪
 *
 * ── API 概览 ──
 *   同步（local/native 后端）    异步（通用，包含 KV）
 *   get(key)                    getAsync(key)
 *   set(key, value)             setAsync(key, value)
 *   delete(key)                 deleteAsync(key)
 *                               has(key)
 *
 *   订阅与快照
 *   subscribe(key, cb)          subscribeAll(cb)
 *   getSnapshot()               getKeySnapshot(key)
 *
 *   落盘节流
 *   createDebouncedPersist(write, delay)   高频变更合并落盘（见下方原语注释，P4）
 *
 * ── 迁移路径 ──
 *   1. 先在 STORAGE_KEYS 登记键
 *   2. 把 store 中 sGet/sSet → content.get/set
 *   3. 把 store 中 storageGet/storageSet → content.getAsync/setAsync
 *   4. 批量迁移结束后，删除旧直调代码
 */
import { sGet, sSet, sRemove } from './storageAdapter.js'
import { storageGet, storageSet, storageDelete, isKvKey } from './kvStore.js'
import { STORAGE_KEYS } from './contracts.js'
import { logger } from './logger.js'

// ─────────────────────────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────────────────────────

/** 内存缓存 { [key]: value|undefined }。undefined 表示未加载。 */
const cache = new Map()

/** 按 key 的订阅者：{ [key]: Set<callback> } */
const keyListeners = new Map()

/** 全局订阅者：Set<(key, value) => void> */
const globalListeners = new Set()

/** 已 warning 的未登记键集合（防重复 warning） */
const warnedKeys = new Set()

/** P6：动态键模板 → 编译后正则的模块级缓存（findPatternEntry 循环内不再每次 new RegExp）。
 *  模板键有限（contracts.js 登记的量级），按模板 lazy 编译一次，天然防无限膨胀。 */
const patternRegexCache = new Map()
function getPatternRegex(k) {
  let re = patternRegexCache.get(k)
  if (!re) {
    // 按 {xxx} 拆分 → 转义各段 → 用 .+ 拼接（避免先替换 .+ 再被转义）
    const parts = k.split(/\{[^}]+\}/)
    const escaped = parts.map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('.+')
    re = new RegExp('^' + escaped + '$')
    patternRegexCache.set(k, re)
  }
  return re
}

// ─────────────────────────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────────────────────────

/** 尝试解析 JSON 字符串，失败返回原值 */
function tryParse(s) {
  try { return JSON.parse(s) } catch { return s }
}

/**
 * 检查 key 是否匹配 STORAGE_KEYS 中 pattern:true 的动态键模板。
 * 返回匹配的条目，无匹配返回 null。
 * 例如 key="canvas-state-v1-proj-123" 匹配模板 "canvas-state-v1-{projectId}"。
 */
function findPatternEntry(key) {
  for (const [k, v] of Object.entries(STORAGE_KEYS)) {
    if (!v.pattern) continue
    try {
      if (getPatternRegex(k).test(key)) return v
    } catch { /* 忽略无效正则 */ }
  }
  return null
}

function isPatternMatch(key) {
  return findPatternEntry(key) !== null
}

/**
 * 检查 key 是否在 STORAGE_KEYS 中登记。
 * 支持动态键模板匹配（pattern:true）。
 * 未登记则在开发环境 warning 一次（迁移期辅助定位遗漏的键）。
 */
function checkRegistered(key) {
  if (key in STORAGE_KEYS) return true
  if (isPatternMatch(key)) return true
  if (warnedKeys.has(key)) return false
  warnedKeys.add(key)
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`[contentStore] 未登记的存储键: "${key}"，请先在 contracts.js 的 STORAGE_KEYS 登记`)
  }
  return false
}

/** 获取后端类型：local | kv | native | null（未知） */
function getBackend(key) {
  const entry = STORAGE_KEYS[key]
  if (entry) return entry.backend
  // 动态键：查找匹配的模式键
  const patternEntry = findPatternEntry(key)
  if (patternEntry) return patternEntry.backend
  // 未登记键：按 isKvKey 启发式判断
  return isKvKey(key) ? 'kv' : 'local'
}

/** 通知所有订阅者 */
function notify(key, value) {
  keyListeners.get(key)?.forEach((cb) => cb(value))
  globalListeners.forEach((cb) => cb(key, value))
}

/** 从 localStorage 加载键到缓存（同步） */
function loadFromLocal(key) {
  const raw = sGet(key)
  if (raw === null) {
    cache.set(key, undefined)
    return undefined
  }
  const parsed = tryParse(raw)
  cache.set(key, parsed)
  return parsed
}

/** 从 KV 加载键到缓存（异步） */
async function loadFromKv(key) {
  const value = await storageGet(key)
  cache.set(key, value)
  return value
}

// ─────────────────────────────────────────────────────────────────
// 同步 API（仅 local/native 后端，KV 键会返回缓存值或 undefined）
// ─────────────────────────────────────────────────────────────────

/**
 * 同步读取键值。
 * - local/native 键：惰性加载，首次读从 localStorage 加载到缓存，后续读缓存
 * - KV 键：返回缓存值（如果之前未加载过则返回 undefined，需用 getAsync）
 */
export function contentGet(key) {
  checkRegistered(key)
  if (cache.has(key)) return cache.get(key)
  const backend = getBackend(key)
  if (backend === 'kv') {
    // KV 键同步读不到（本地缓存未命中时不做网络请求）
    return undefined
  }
  return loadFromLocal(key)
}

/**
 * 同步写入键值。
 * - local/native 键：同步写缓存 + localStorage
 * - KV 键：同步写缓存 + 异步写 KV（fire-and-forget，失败仅 warning）
 */
export function contentSet(key, value) {
  checkRegistered(key)
  cache.set(key, value)
  const backend = getBackend(key)
  if (backend === 'kv') {
    storageSet(key, value).catch((e) => {
      logger.warn(`[contentStore] KV 写入失败 (fire-and-forget): ${key}`, e)
    })
  } else {
    sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  notify(key, value)
}

/**
 * 同步删除键。
 * - local/native 键：同步删缓存 + localStorage
 * - KV 键：同步删缓存 + 异步删 KV（fire-and-forget）
 */
export function contentDelete(key) {
  checkRegistered(key)
  cache.delete(key)
  const backend = getBackend(key)
  if (backend === 'kv') {
    storageDelete(key).catch((e) => {
      logger.warn(`[contentStore] KV 删除失败 (fire-and-forget): ${key}`, e)
    })
  } else {
    sRemove(key)
  }
  notify(key, undefined)
}

/**
 * 同步检查键是否存在（缓存或后端）。
 * 注意：KV 键如果缓存未命中，会返回 false（即使后端存在），建议用 getAsync 确认。
 */
export function contentHas(key) {
  checkRegistered(key)
  if (cache.has(key)) {
    const v = cache.get(key)
    return v !== undefined && v !== null
  }
  const backend = getBackend(key)
  if (backend === 'kv') return false // KV 键同步无法确认
  const raw = sGet(key)
  return raw !== null
}

// ─────────────────────────────────────────────────────────────────
// 异步 API（通用，对所有后端有效）
// ─────────────────────────────────────────────────────────────────

/** 异步读取键值，总是从后端加载（同时更新缓存）。 */
export async function contentGetAsync(key) {
  checkRegistered(key)
  const backend = getBackend(key)
  if (backend === 'kv') {
    return loadFromKv(key)
  }
  return loadFromLocal(key)
}

/** 异步写入键值，等待持久化完成。 */
export async function contentSetAsync(key, value) {
  checkRegistered(key)
  cache.set(key, value)
  const backend = getBackend(key)
  if (backend === 'kv') {
    await storageSet(key, value)
  } else {
    sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  notify(key, value)
}

/** 异步删除键，等待删除完成。 */
export async function contentDeleteAsync(key) {
  checkRegistered(key)
  cache.delete(key)
  const backend = getBackend(key)
  if (backend === 'kv') {
    await storageDelete(key)
  } else {
    sRemove(key)
  }
  notify(key, undefined)
}

// ─────────────────────────────────────────────────────────────────
// 订阅
// ─────────────────────────────────────────────────────────────────

/**
 * 订阅指定键的变更。
 * @param {string} key
 * @param {(value: any) => void} callback
 * @returns {() => void} 取消订阅函数
 */
export function contentSubscribe(key, callback) {
  if (!keyListeners.has(key)) keyListeners.set(key, new Set())
  keyListeners.get(key).add(callback)
  return () => keyListeners.get(key)?.delete(callback)
}

/**
 * 订阅所有键的变更。
 * @param {(key: string, value: any) => void} callback
 * @returns {() => void} 取消订阅函数
 */
export function contentSubscribeAll(callback) {
  globalListeners.add(callback)
  return () => globalListeners.delete(callback)
}

// ─────────────────────────────────────────────────────────────────
// 快照
// ─────────────────────────────────────────────────────────────────

/**
 * 获取所有已登记键的不可变快照（冻结对象）。
 * 排除动态键（pattern: true）和未在缓存中的键。
 * 用于撤销/恢复/历史追踪。
 */
export function contentGetSnapshot() {
  const snapshot = {}
  for (const [key, entry] of Object.entries(STORAGE_KEYS)) {
    if (entry.pattern) continue // 动态键跳过
    if (cache.has(key)) {
      const v = cache.get(key)
      if (v !== undefined) snapshot[key] = v
    } else {
      const backend = getBackend(key)
      if (backend !== 'kv') {
        // 同步加载 local 键
        const v = loadFromLocal(key)
        if (v !== undefined) snapshot[key] = v
      }
    }
  }
  return Object.freeze(snapshot)
}

/** 获取指定键的不可变快照值。 */
export function contentGetKeySnapshot(key) {
  checkRegistered(key)
  const backend = getBackend(key)
  if (cache.has(key)) return Object.freeze(cache.get(key))
  if (backend !== 'kv') {
    const v = loadFromLocal(key)
    return Object.freeze(v)
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────────
// 维护
// ─────────────────────────────────────────────────────────────────

/**
 * 落盘节流原语（P4）：高频变更时合并落盘，消除主线程长任务（整数组/整包 JSON.stringify）。
 * 用法（各 store）：
 *   const persistDebounced = createDebouncedPersist(() => contentSet(KEY, 最新状态))
 *   function notify() { persistDebounced.schedule(); listeners.forEach((l) => l()) }
 * 语义：
 *  - schedule()：标记待落盘；窗口（delay ms）内多次调用只落盘 1 次。
 *    write 必须是「读当前最新状态」的 thunk——flush 时才执行，天然把窗口内多次变更合并为最终态。
 *  - flush()：强制立即落盘（供组件卸载兜底；本原语自动注册 pagehide 触发 flush，防极端刷新丢数据）。
 *  - cancel()：取消未落盘写（测试/重置用）。
 * 注意：通知订阅者（notify）保持即时，只有「落盘」被节流——UI 响应性不受影响。
 */
export function createDebouncedPersist(write, delay = 300) {
  let timer = null
  let pending = false
  function schedule() {
    pending = true
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      pending = false
      write()
    }, delay)
  }
  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (pending) {
      pending = false
      write()
    }
  }
  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pending = false
  }
  // 页面退出时强制落盘，避免防抖窗口内关闭/刷新丢最后变更
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
  }
  return { schedule, flush, cancel }
}

/**
 * 清除内容缓存（用于测试/重置）。
 * 注意：订阅者不受影响，后续 set/get 会重新加载。
 */
export function contentClearCache() {
  cache.clear()
  warnedKeys.clear()
}

/**
 * 获取缓存统计信息。
 * @returns {{ cachedKeys: number, listeners: number, globalListeners: number }}
 */
export function contentStats() {
  return {
    cachedKeys: cache.size,
    listeners: keyListeners.size,
    globalListeners: globalListeners.size,
  }
}