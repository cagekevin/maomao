/**
 * 存储适配层：Chrome 插件环境用 chrome.storage.local，普通环境回退 localStorage。
 *
 * 设计：为兼容现有同步调用（localStorage.getItem/setItem），本层提供「同步内存缓存」。
 *  - 启动时 initStorage() 从 chrome.storage.local 批量加载到内存 Map（异步）
 *  - 之后 sGet/sSet/sRemove 同步读写内存，sSet 同步更新内存 + 异步持久化到 chrome.storage.local
 *  - 非插件环境直接读写 localStorage（同步），与现有行为一致
 *
 * 使用：页面入口调用一次 initStorage()（App.tsx onMount），此后配置读写走 sGet/sSet。
 */

/** 是否运行在 Chrome 扩展环境 */
export function isChromeExtension() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id
  } catch {
    return false
  }
}

const KEY_PREFIX = 'yimao:'
const cache = new Map()
let loaded = false

/** 初始化：插件环境从 chrome.storage.local 批量加载到内存缓存（仅需调用一次） */
export function initStorage() {
  if (loaded || !isChromeExtension()) {
    loaded = true
    return
  }
  try {
    chrome.storage.local.get(null, (all) => {
      if (all && typeof all === 'object') {
        for (const k of Object.keys(all)) {
          if (k.startsWith(KEY_PREFIX)) cache.set(k.slice(KEY_PREFIX.length), all[k])
        }
      }
      loaded = true
    })
  } catch {
    loaded = true
  }
}

/** 同步读取（字符串或 null，与 localStorage 一致） */
export function sGet(key) {
  if (!isChromeExtension()) {
    try { return localStorage.getItem(KEY_PREFIX + key) } catch { return null }
  }
  const v = cache.get(key)
  return v === undefined ? null : (typeof v === 'string' ? v : JSON.stringify(v))
}

/** 同步写（插件环境同步更新内存 + 异步持久化） */
export function sSet(key, value) {
  const fullKey = KEY_PREFIX + key
  if (!isChromeExtension()) {
    try { localStorage.setItem(fullKey, value) } catch { /* ignore */ }
    return
  }
  cache.set(key, value)
  try { chrome.storage.local.set({ [fullKey]: value }) } catch { /* ignore */ }
}

/** 同步删（插件环境同步删内存 + 异步删存储） */
export function sRemove(key) {
  const fullKey = KEY_PREFIX + key
  if (!isChromeExtension()) {
    try { localStorage.removeItem(fullKey) } catch { /* ignore */ }
    return
  }
  cache.delete(key)
  try { chrome.storage.local.remove(fullKey) } catch { /* ignore */ }
}
