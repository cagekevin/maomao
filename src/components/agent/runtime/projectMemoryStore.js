/**
 * projectMemoryStore —— 长期记忆持久化与脱敏（照搬参考项目 projectMemoryService）。
 *
 * 【一句话】保存用户明确的稳定偏好/事实/约束/决定（kind 分类），**按 agentKey 全局共用（不分项目）**，
 *  供检索后在上下文组装时按相关性注入。与对话级 memory.summary（自动压缩）互补：
 *  这里是「用户确认后显式写入」的长期记忆，由 memory_suggest 工具写入。
 *
 * 【是否分项目】按用户确认：本项目记忆不分项目，一条全局长期记忆（仅按 agentKey 隔离，每项目一个 agentKey
 *  本身就天然按项目隔离）。`projectId` 参数保留仅为兼容旧调用方，内部一律忽略。
 *
 * 【存储】走项目统一 Content 层（contentStore），KV key = `agent_project_memory_v1_${agentKey}`。
 *  遵守项目硬约束：持久化一律经 contentStore API，异步带总超时（withTimeout），错误经 logger 可见，
 *  不静默吞错。模块内维护按 key 的缓存，供同步读取（注入用）。
 *
 * 【上限】单 agentKey 最多保留 PROJECT_MEMORY_LIMIT 条，超出时淘汰最旧（updatedAt 最早），防无限膨胀。
 *
 * 【脱敏】写入前统一脱敏密钥/凭据/绝对路径并截断，禁止文件全文/网页全文/临时结果进入长期记忆。
 */
import { contentGetAsync, contentSetAsync, contentDeleteAsync } from '../../base/contentStore.js'
import { withTimeout } from '../../base/asyncGuard.js'
import { generateId } from '../../base/idGen.ts'
import { logger } from '../../base/logger.js'
import { KV_TIMEOUT } from '../../base/config.js'

/** 单条记忆正文长度上限 */
export const PROJECT_MEMORY_CONTENT_LIMIT = 500
/** 单个 agentKey 的记忆条数上限，超出淘汰最旧 */
export const PROJECT_MEMORY_LIMIT = 60
/** 记忆类别枚举（对齐参考项目 ProjectMemoryKind） */
export const PROJECT_MEMORY_KINDS = ['preference', 'fact', 'constraint', 'decision']
/** 类别中文标签 */
export const PROJECT_MEMORY_KIND_LABELS = {
  preference: '偏好',
  fact: '事实',
  constraint: '约束',
  decision: '决定',
}

/** 记忆归属全局（不分项目），key 仅按 agentKey 区分 */
const memoryKey = (agentKey) => `agent_project_memory_v1_${agentKey}`

/** 模块级缓存：{ [agentKey]: ProjectMemory[] }，同步注入读取；写后同步更新。 */
const cache = new Map()
// 并发写锁：同一 key 的 read-modify-write 串行化，防并发覆盖丢数据。
const locks = new Map()
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(key, next.catch(() => {}))
  try { next.finally(() => { if (locks.get(key) === next) locks.delete(key) }) } catch { /* 忽略 finally 隐患 */ }
  return next
}

const cacheKey = (agentKey) => agentKey

/**
 * 脱敏记忆正文：移除密钥/凭据/本地绝对路径，压缩空白并截断到上限（纯函数）。
 * @param {string} value
 * @returns {string}
 */
export function sanitizeMemoryContent(value) {
  return String(value || '')
    .replace(/\b(?:sk|key|token|ak)-[A-Za-z0-9_-]{12,}\b/gi, '[已脱敏密钥]')
    .replace(/\b(?:api[_-]?key|authorization|token)\s*[:=]\s*\S+/gi, '[已脱敏凭据]')
    .replace(/[A-Za-z]:\\(?:[^\\\r\n]+\\?)*/g, '[本地路径]')
    .replace(/\/(?:Users|home|private|Volumes|tmp|var)\/[^\s"'`]+/g, '[本地路径]')
    .replace(/[\t\r\n ]+/g, ' ')
    .trim()
    .slice(0, PROJECT_MEMORY_CONTENT_LIMIT)
}

/**
 * 从 Content 层读记忆（更新排序，updatedAt 降序）。失败/超时返回 []（记 ERROR，不静默，不中断调用方）。
 * @param {string} agentKey
 * @param {string} [_projectId] 已弃用（不分项目），仅为兼容旧调用方保留
 * @returns {Promise<Array>} [{ id, kind, content, enabled, createdAt, updatedAt }]
 */
export async function loadProjectMemories(agentKey, _projectId) {
  const key = memoryKey(agentKey)
  if (!cache.has(cacheKey(agentKey))) {
    try {
      const raw = await withTimeout(contentGetAsync(key), KV_TIMEOUT, '读取项目记忆超时')
      const list = Array.isArray(raw)
        ? raw.filter((m) => m && typeof m === 'object' && typeof m.id === 'string')
        : []
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      cache.set(cacheKey(agentKey), list)
    } catch (e) {
      logger.error('AI助手', '[记忆] 读取失败', { err: e?.message })
      return []
    }
  }
  return (cache.get(cacheKey(agentKey)) || []).slice()
}

/** 同步读缓存（供上下文组装，不触发 IO；未加载或为空返回 []）。 */
export function getCachedProjectMemories(agentKey, _projectId) {
  return (cache.get(cacheKey(agentKey)) || []).slice()
}

/** 同步写缓存（工具写入/删除后更新内存，保证后续注入立刻可见）。 */
function writeCache(agentKey, list) {
  const sorted = list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  cache.set(cacheKey(agentKey), sorted)
}

/**
 * 保存一条记忆（按 id upsert；超出 PROJECT_MEMORY_LIMIT 时淘汰最旧）。
 * 串行化 read-modify-write，写后同步更新缓存。
 * @param {string} agentKey
 * @param {object} memory { id?, kind, content, enabled?, createdAt?, updatedAt?, source? }
 * @returns {Promise<object>} 保存后的记忆记录
 */
export async function saveProjectMemory(agentKey, memory) {
  const key = memoryKey(agentKey)
  const record = {
    id: memory?.id || generateId('mem'),
    kind: PROJECT_MEMORY_KINDS.includes(memory?.kind) ? memory.kind : 'fact',
    content: String(memory?.content || '').slice(0, PROJECT_MEMORY_CONTENT_LIMIT),
    enabled: memory?.enabled !== false,
    createdAt: memory?.createdAt || Date.now(),
    updatedAt: memory?.updatedAt || Date.now(),
  }
  if (memory?.source && typeof memory.source === 'object') record.source = memory.source
  await withLock(cacheKey(agentKey), async () => {
    const list = await loadProjectMemories(agentKey)
    const idx = list.findIndex((m) => m.id === record.id)
    let next = list
    if (idx >= 0) next = list.map((m) => (m.id === record.id ? { ...m, ...record } : m))
    else next = [record, ...list]
    // 超出上限 → 淘汰最旧（updatedAt 最早，已在数组末尾）
    if (next.length > PROJECT_MEMORY_LIMIT) next = next.slice(0, PROJECT_MEMORY_LIMIT)
    await withTimeout(contentSetAsync(key, next), KV_TIMEOUT, '保存项目记忆超时')
    writeCache(agentKey, next)
  })
  return record
}

/** 删除一条记忆（同步更新缓存；不存在幂等返回）。 */
export async function removeProjectMemory(agentKey, _projectId, id) {
  await withLock(cacheKey(agentKey), async () => {
    const list = await loadProjectMemories(agentKey)
    const remain = list.filter((m) => m.id !== id)
    if (remain.length === list.length) return
    await withTimeout(contentSetAsync(memoryKey(agentKey), remain), KV_TIMEOUT, '删除项目记忆超时')
    writeCache(agentKey, remain)
  })
}

/** 测试隔离：清空缓存 */
export function __resetProjectMemoryCacheForTest() {
  cache.clear()
}

/** 备用：清空某 agentKey 的全部记忆（供清理用；本模块未直接使用，保留导出以便未来接入） */
export async function deleteProjectMemories(agentKey, _projectId) {
  await contentDeleteAsync(memoryKey(agentKey)).catch((e) => logger.warn('AI助手', '[记忆] 批量删除失败', { err: e?.message }))
  cache.delete(cacheKey(agentKey))
}