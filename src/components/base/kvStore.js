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
import { API_BASE } from './apiBase.js'

// 画布类 key 前缀（对齐官方 Ar.CANVAS_STATE_PREFIX，localTool KV 侧会带此前缀）
export const CANVAS_STATE_PREFIX = 'canvas-state-v1-'

/** 底层 KV 读取：返回解析后的值；key 不存在返回 null。 */
export async function kvGet(key) {
  const res = await fetch(`${API_BASE}/api/kv/get?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error(`KV get ${key} 失败 (${res.status})`)
  return res.json() // null 或解析后的值
}

/** 底层 KV 写入：对象/数组/数字自动 stringify，返回 {ok:true}。 */
export async function kvSet(key, value) {
  const res = await fetch(`${API_BASE}/api/kv/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error(`KV set ${key} 失败 (${res.status})`)
  return res.json()
}

/** 底层 KV 删除：删不存在也返回 {ok:true}。 */
export async function kvDelete(key) {
  const res = await fetch(`${API_BASE}/api/kv/delete?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error(`KV delete ${key} 失败 (${res.status})`)
  return res.json()
}

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
  if (isKvKey(key)) return kvSet(key, value)
  sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  return { ok: true }
}

/** 统一删除：KV 前缀 → localTool KV；否则 chrome.storage(插件)/localStorage。 */
export async function storageDelete(key) {
  if (isKvKey(key)) return kvDelete(key)
  sRemove(key)
  return { ok: true }
}
