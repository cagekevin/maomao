/**
 * localTool KV 存储层（对齐官方 18-KV存储键读写面梳理.md）。
 *
 * 官方有两套存储，前端经统一存储层自动分流（httpClient 的 Kr/Fr）：
 *  - key 以 `canvas-state-` 开头 → 走 localTool KV（/api/kv/*，SQLite，跨端共享）
 *  - 其余 key（projects/users/app_settings/api_configs 等）→ 浏览器 localStorage
 *
 * 本模块实现同样的「统一存储抽象」storageGet/storageSet/storageDelete，
 * 并暴露底层 kvGet/kvSet/kvDelete 供需要显式走 KV 的地方用。
 *
 * KV 接口契约（见 docs/18 §2）：
 *  - GET  /api/kv/get?key=<key>   → 返回解析后的值或 JSON null（key 不存在）
 *  - POST /api/kv/set {key,value} → { ok: true }
 *  - POST /api/kv/delete?key=<key> → { ok: true }（删不存在也 ok）
 *  - 错误体 { error: "<英文message>" }
 */
import { sGet, sSet, sRemove } from './storageAdapter.js'
import { kvGet, kvSet, kvDelete } from './localToolApi.js'
import { logger } from './logger.js'
import { CANVAS_STATE_PREFIX } from './contracts.js' // 单一来源：画布 KV 前缀统一在契约层

// 画布类 key 前缀（对齐官方 Ar.CANVAS_STATE_PREFIX，localTool KV 侧会带此前缀）
// re-export 兼容既有 `import { CANVAS_STATE_PREFIX } from './kvStore.js'`（如 projectStore）
export { CANVAS_STATE_PREFIX }

// kvGet / kvSet / kvDelete 底层转发已收口到 localToolApi.js（深模块），此处 re-export 兼容既有引用
export { kvGet, kvSet, kvDelete }

/** 判断 key 是否走 KV（画布类前缀走 localTool KV，对齐官方 Kr/Fr 分流） */
export function isKvKey(key) {
  return typeof key === 'string' && key.startsWith(CANVAS_STATE_PREFIX)
}

/** 统一读取：KV 前缀 → localTool KV；否则 chrome.storage(插件)/localStorage。返回解析后的值或 null。 */
export async function storageGet(key) {
  if (isKvKey(key)) return kvGet(key)
  const raw = sGet(key)
  if (raw === null) return null
  try { return JSON.parse(raw) } catch { return raw }
}

/** 统一写入：KV 前缀 → localTool KV；否则 chrome.storage(插件)/localStorage。 */
export async function storageSet(key, value) {
  if (isKvKey(key)) {
    try {
      return await kvSet(key, value)
    } catch (e) {
      // KV 失败降级到本地存储，标记 degraded（画布类数据不丢）
      sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
      logger.warn(`KV 写入失败，降级 localStorage: ${key}`, e)
      return { ok: true, degraded: true }
    }
  }
  sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  return { ok: true }
}

/** 统一删除：KV 前缀 → localTool KV；否则 chrome.storage(插件)/localStorage。 */
export async function storageDelete(key) {
  if (isKvKey(key)) return kvDelete(key)
  sRemove(key)
  return { ok: true }
}
