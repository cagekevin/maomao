/**
 * localTool KV 存储层（对齐官方 18-KV存储键读写面梳理.md）。
 *
 * 官方有两套存储，前端经统一存储层自动分流（httpClient 的 Kr/Fr）：
 *  - 业务共享数据（画布 canvas-state-* / 账号 yimao_accounts / endpoint active_api_endpoint）→ 走 localTool KV（/api/kv/*，SQLite，磁盘持久化/跨端共享）
 *  - 纯本机数据（projects/app_settings/configs 等）→ 浏览器 localStorage
 *
 * 「哪个键走 KV」以 contracts.js STORAGE_KEYS 登记为准（见 isKvKey，单一事实源），
 * 而非仅靠前缀——避免登记成 kv 的键仍被当 local 写进浏览器存储。
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
import { reportDegrade } from './degrade.js'
import { CANVAS_STATE_PREFIX, STORAGE_KEYS } from './contracts.js' // 单一来源：画布 KV 前缀与后端判定统一在契约层

// 画布类 key 前缀（对齐官方 Ar.CANVAS_STATE_PREFIX，localTool KV 侧会带此前缀）
// re-export 兼容既有 `import { CANVAS_STATE_PREFIX } from './kvStore.js'`（如 projectStore）
export { CANVAS_STATE_PREFIX }

// kvGet / kvSet / kvDelete 底层转发已收口到 localToolApi.js（深模块），此处 re-export 兼容既有引用
export { kvGet, kvSet, kvDelete }

/**
 * 后端判定统一收口：以 contracts.js STORAGE_KEYS 登记为准（backend === 'kv'）。
 * 修 R1：此前仅认 canvas-state- 前缀，登记成 kv 的键（如 yimao_accounts）会被当 local 写进浏览器存储 → 关闭插件重开丢。
 *
 * 判断规则：
 *  1. 精确键：key 在 STORAGE_KEYS 直接登记 → 按其 backend 判定。
 *  2. pattern 动态键：key 匹配某个 backend==='kv' 的模板（如 canvas-state-v1-{projectId}）→ true。
 *  3. 其余（含未登记裸键）→ false（走 local）。
 */
const patternRegexCache = new Map()
function getPatternRegex(k) {
  let re = patternRegexCache.get(k)
  if (!re) {
    // 按 {xxx} 拆分 → 转义各段 → 用 .+ 拼接（天然防无限膨胀，模板数量有限，lazy 编译一次）
    const parts = k.split(/\{[^}]+\}/)
    const escaped = parts.map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('.+')
    re = new RegExp('^' + escaped + '$')
    patternRegexCache.set(k, re)
  }
  return re
}

export function isKvKey(key) {
  if (typeof key !== 'string' || !key) return false
  const entry = STORAGE_KEYS[key]
  if (entry) return entry.backend === 'kv'
  for (const [k, v] of Object.entries(STORAGE_KEYS)) {
    if (!v.pattern || v.backend !== 'kv') continue
    try {
      if (getPatternRegex(k).test(key)) return true
    } catch { /* 忽略无效正则模板 */ }
  }
  return false
}

/** 尝试解析 JSON 字符串，失败返回原值 */
function tryParse(s) {
  try { return JSON.parse(s) } catch { return s }
}

/** 统一读取：KV 键 → localTool KV（失败降级读本地副本，与 storageSet 降级写对称，修 R2）；否则 chrome.storage(插件)/localStorage。返回解析后的值或 null。 */
export async function storageGet(key) {
  if (isKvKey(key)) {
    try {
      return await kvGet(key)
    } catch (e) {
      // KV 读失败 → 降级读本地副本（对齐官方 getObject 回退既有历史数据；storageSet 曾降级写过的本地副本读得回）
      reportDegrade({ layer: 'kvStore', key, e, toast: '本地引擎存储暂不可用，已回退读取本地缓存' })
      const raw = sGet(key)
      if (raw === null) return null
      return tryParse(raw)
    }
  }
  const raw = sGet(key)
  if (raw === null) return null
  return tryParse(raw)
}

/** 统一写入：KV 前缀 → localTool KV；否则 chrome.storage(插件)/localStorage。 */
export async function storageSet(key, value) {
  if (isKvKey(key)) {
    try {
      const r = await kvSet(key, value)
      // 【P2-F1】KV 写成功后清除该键历史「降级本地副本」（storageGet 的 KV 失败回退曾写过）。
      // 否则 KV 恢复后，本地副本仍是旧值，一旦 KV 再次故障被 storageGet 回退读到 → 旧值"复活"覆盖新值。
      sRemove(key)
      return r
    } catch (e) {
      // KV 失败降级到本地存储，标记 degraded（业务共享数据不丢，仅跨端共享暂时失效）。
      // P1-3 关键降级：KV → localStorage 属于「跨端共享失效」，弹一次 toast 让用户感知
      // （否则换设备/重装后数据"失踪"，且 localTool 连上后的跨端同步不再生效）。
      sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
      reportDegrade({ layer: 'kvStore', key, e, toast: '本地引擎存储暂不可用，数据已暂存本地（跨设备同步可能丢失）' })
      return { ok: true, degraded: true }
    }
  }
  sSet(key, typeof value === 'string' ? value : JSON.stringify(value))
  return { ok: true }
}

/** 统一删除：KV 键 → localTool KV（失败降级删本地副本，防本地副本残留，修 R3）；否则 chrome.storage(插件)/localStorage。 */
export async function storageDelete(key) {
  if (isKvKey(key)) {
    try {
      return await kvDelete(key)
    } catch { /* KV 删失败：降级删本地副本，防止降级写的本地副本残留 */ }
  }
  sRemove(key)
  return { ok: true }
}
