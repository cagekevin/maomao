/**
 * 存储监控 · 数据源（纯函数层）。
 *
 * 【职责】为「设置 → 更多设置 → 存储监控」提供存储占用/配额的计算逻辑，纯函数可单测。
 *   分两块：
 *     A. 浏览器存储配额（IndexedDB/Cache）+ chrome.storage/localStorage 已存占用估算
 *     B. 存储画像（按 STORAGE_KEYS 各 domain 统计实际存储键占用）—— 只读，不做清理
 *
 * 【为什么放这】本项目无 `src/services/` 目录，纯逻辑统一在 `src/components/base/`
 *   （对齐 contentStore.js / kvStore.js / storageAdapter.js）。磁盘扫描（Tauri 版文档里的
 *   getProjectDataDir / readDir）在 Chrome 扩展沙箱做不了，故本模块不含磁盘扫描。
 *
 * ── 数据流全景（下个 AI 改这前必读）──
 *  StorageMonitor（UI）挂载 → runScan() 三路并行：
 *   ├─ estimateBrowserStorage()  → navigator.storage.estimate()
 *   │     浏览器分配的 IndexedDB/Cache 配额（maomao 不写 IndexedDB，usage 通常为 0）
 *   ├─ estimateChromeStorage()   → enumerateLocalEntries() 逐键估字节
 *   │     扩展 chrome.storage.local / Web localStorage 的「已存内容」总量
 *   └─ analyzeStorageByKeys()    → enumerateLocalEntries() → 剥 yimao: 前缀
 *        → mapKeyToDomain()（查 STORAGE_KEYS 精确/pattern 映射到 domain）→ 按 domain 聚合
 *
 * 三个函数都经 enumerateLocalEntries() 枚举「实际落盘的原始键（rawKey 带 yimao: 前缀）」，
 * 保证统计的是真实数据；domain 映射以 contracts.js 的 STORAGE_KEYS 为唯一事实源。
 *
 * 【口径（与 UI 约定）】
 *   - estimateBrowserStorage()：navigator.storage.estimate() → IndexedDB + Cache Storage 用量。
 *   - estimateChromeStorage()：扩展读 chrome.storage.local.get(null) 按内容估算已存占用；
 *     Web 环境回退 localStorage。注意：chrome.storage.local 的配额拿不到，只能估内容字节。
 *   - analyzeStorageByKeys()：枚举实际存储键（localStorage / chrome.storage.local），剥 yimao: 前缀，
 *     经 STORAGE_KEYS 映射到 domain，按 domain 汇总占用（只读，无副作用）。
 *
 * 【红线】本模块只读存储，不写、不删。任何清理动作必须走 contentStore 唯一入口，禁止散写。
 *   domain 映射以 contracts.js 的 STORAGE_KEYS 为唯一事实源，不硬编码键名/前缀。
 *   前缀用 storageAdapter.KEY_PREFIX（单一来源，已导出），勿在本文件硬编码 'yimao:'。
 *
 * 【⚠️ 清理建议（若下个 AI 做「清理」，先读这条）】
 *   当前二期只做只读画像，不含清理。若后续加清理，务必：
 *   1. 只删「缓存/可重建」类键，且二次确认（如 yimao_prompt_hub_cache 提示词社区缓存、
 *      可安全重建的派生数据）；禁止直接删用户主数据键（projects/画布快照/账号/会话）。
 *   2. 删除走 contentStore 唯一入口（contentDelete / contentDeleteAsync），禁止散写 sRemove/裸键。
 *      KV 键（canvas-state-v1-*、yimao_accounts 等）存在 localTool 后端，前端删不走 localStorage，
 *      需走 kvStore.storageDelete，且删后要处理跨端同步。
 *   3. 删除前确认无引用（grep 该键的读方）；删后重扫刷新 UI。
 *   4. 「无用大对象」判定需谨慎：本模块 byteLength 只估内容字节，无法区分「在用的关键数据」和
 *      「可删的无用数据」。真正确认可删，要靠业务语义（如过期缓存、已导出的历史快照），别凭大小猜。
 */
import { isChromeExtension, KEY_PREFIX } from './storageAdapter.js'
import { STORAGE_KEYS } from './contracts.js'

/** 配额受压预警阈值：用量比例 ≥ 此值时视为「即将用尽」（对齐文档 STORAGE_PRESSURE_RATIO） */
export const STORAGE_PRESSURE_RATIO = 0.85

/**
 * 【已弃用】AI 会话键级本地存储预算预警。
 * 会话键 `agent_conversations_*` 已迁 localTool KV（contracts.js backend:'kv'，
 * 见 docs/AI助手会话存储迁移-KV收口事实记录.md），不再占用 localStorage / chrome.storage，
 * 故「本地存储配额键级预警」已无意义。本函数固定返回 null（不枚举、不误报）。
 * 真正兜底会话体积的是 volumePolicy 的 L3 预算降级（applyConversationBudget），与本地存储配额无关。
 * @returns {Promise<null>} 恒 null（已弃用）
 */
export async function analyzeAgentConversationPressure() {
  return null
}

/** domain → 中文标签（仅供 UI 展示，domain 值以 STORAGE_KEYS 登记为准） */
export const DOMAIN_LABELS = {
  project: '项目 / 画布',
  settings: '应用设置',
  agent: 'AI 助手',
  preset: '提示词预设',
  asset: '素材库',
  prompthub: '提示词社区',
  pref: '节点偏好',
  account: '账号环境',
  clipboard: '剪贴板',
  director3d: '3D 导演台',
  unknown: '未归类',
}

/**
 * 估算浏览器存储配额（navigator.storage.estimate）。
 * @returns {Promise<{usage:number, quota:number, ratio:number} | null>}
 *   环境不支持（无 navigator.storage.estimate）返回 null。
 */
export async function estimateBrowserStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0 }
}

/**
 * 判断配额是否受压（用量比例 ≥ STORAGE_PRESSURE_RATIO）。
 * @param {number} ratio 用量比例（0~1）
 * @returns {{ underPressure: boolean }}
 */
export function estimateStoragePressure(ratio) {
  return { underPressure: typeof ratio === 'number' && ratio >= STORAGE_PRESSURE_RATIO }
}

/**
 * 估算已存占用（chrome.storage.local 扩展 / localStorage Web）。
 * 逐键序列化估算字节，返回总字节与键数。
 * @returns {Promise<{bytes:number, keys:number} | null>} 环境不支持返回 null
 */
export async function estimateChromeStorage() {
  const entries = await enumerateLocalEntries()
  if (!entries) return null
  let bytes = 0
  for (const e of entries) bytes += byteLength(e.rawKey) + byteLength(e.value)
  return { bytes, keys: entries.length }
}

/**
 * 枚举浏览器实际存储键（chrome.storage.local 扩展 / localStorage Web）。
 * rawKey 带 yimao: 前缀（实际落盘键名），value 为原始值（未解析）。
 * @returns {Promise<Array<{rawKey:string, value:unknown}> | null>} 环境不支持返回 null
 */
export async function enumerateLocalEntries() {
  try {
    if (isChromeExtension()) {
      const all = await new Promise((resolve) => {
        chrome.storage.local.get(null, resolve)
      })
      if (!all || typeof all !== 'object') return []
      return Object.entries(all).map(([k, v]) => ({ rawKey: k, value: v }))
    }
    // Web 环境回退 localStorage
    const out = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k == null) continue
      out.push({ rawKey: k, value: localStorage.getItem(k) })
    }
    return out
  } catch {
    // 存储读取受限（隐私模式/权限）时降级为「不可用」，UI 展示降级文案而非崩
    return null
  }
}

/**
 * 把剥前缀后的逻辑键名映射到 STORAGE_KEYS 的 domain。
 * 精确匹配优先；其次 pattern 动态键（如 canvas-state-v1-{projectId}）；匹配不到归 'unknown'。
 * @param {string} key 剥掉 yimao: 前缀后的逻辑键名
 * @returns {string} domain
 */
export function mapKeyToDomain(key) {
  const entry = STORAGE_KEYS[key]
  if (entry) return entry.domain
  for (const [k, v] of Object.entries(STORAGE_KEYS)) {
    if (!v.pattern) continue
    try {
      if (getPatternRegex(k).test(key)) return v.domain
    } catch { /* 忽略无效正则模板 */ }
  }
  return 'unknown'
}

/** pattern 模板 → 编译后正则（模块级缓存，避免循环内重复编译） */
const patternRegexCache = new Map()
function getPatternRegex(k) {
  let re = patternRegexCache.get(k)
  if (!re) {
    const parts = k.split(/\{[^}]+\}/)
    const escaped = parts.map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('.+')
    re = new RegExp('^' + escaped + '$')
    patternRegexCache.set(k, re)
  }
  return re
}

/**
 * 存储画像：按 domain 统计实际存储键占用（只读）。
 * 枚举实际键 → 剥 yimao: 前缀 → mapKeyToDomain → 按 domain 聚合 bytes/keys/detail。
 * @returns {Promise<{
 *   domains: Array<{domain:string, label:string, bytes:number, keys:number, detail:Array<{key:string, bytes:number}>}>,
 *   totalBytes:number, totalKeys:number
 * } | null>} 环境不支持返回 null
 */
export async function analyzeStorageByKeys() {
  // ① 枚举实际落盘键（localStorage / chrome.storage.local），rawKey 带 yimao: 前缀
  const entries = await enumerateLocalEntries()
  if (!entries) return null
  // ② 按 domain 聚合：bytes = 键名长度 + 值序列化长度（键名也占空间，故都计入）
  const byDomain = new Map()
  let totalBytes = 0
  for (const e of entries) {
    // 剥 yimao: 前缀 → 逻辑键名（非业务键不带前缀，原样保留）
    const logical = e.rawKey.startsWith(KEY_PREFIX) ? e.rawKey.slice(KEY_PREFIX.length) : e.rawKey
    // ③ 逻辑键名 → domain（精确 STORAGE_KEYS 匹配，其次 pattern 动态键，兜底 unknown）
    const domain = mapKeyToDomain(logical)
    const bytes = byteLength(e.rawKey) + byteLength(e.value)
    totalBytes += bytes
    // ④ 累加到对应 domain（首个出现时初始化）
    if (!byDomain.has(domain)) byDomain.set(domain, { domain, bytes: 0, keys: 0, detail: [] })
    const g = byDomain.get(domain)
    g.bytes += bytes
    g.keys += 1
    g.detail.push({ key: logical, bytes })
  }
  // ⑤ 打中文标签 + 按占用降序（UI 占比条好看）
  const domains = Array.from(byDomain.values())
    .map((g) => ({ ...g, label: DOMAIN_LABELS[g.domain] || g.domain }))
    .sort((a, b) => b.bytes - a.bytes)
  return { domains, totalBytes, totalKeys: entries.length }
}

/** 估算任意值序列化后的字节数（undefined→0；对象按 JSON 字符串估算） */
function byteLength(value) {
  if (value === undefined || value === null) return 0
  if (typeof value === 'string') return value.length
  try { return JSON.stringify(value).length } catch { return 0 }
}
