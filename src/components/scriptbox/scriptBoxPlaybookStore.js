/**
 * 剧本盒子·Playbook 数据层（唯一权威数据源）。
 *
 * 【职责】
 *  内置 playbook（`scriptBoxWorkflows.js` 里的 SCRIPT_BOX_WORKFLOWS）为只读常量；
 *  自定义 playbook（用户另存为/编辑/删除）持久化在 localStorage 键 `scriptbox_playbooks`
 *  （经 storageAdapter sGet/sSet，禁裸 localStorage；键已在 contracts.js STORAGE_KEYS 登记）。
 *
 * 【单一数据源铁律】
 *  任何提示词配置只有一处可写：内置=代码常量（只读）、自定义=localStorage。节点 data 不存任何
 *  提示词配置副本，只存 `playbookId` 引用。引擎/UI 一律经 getPlaybook() 现读，无优先级回退链。
 *  生成结果（shots[].prompt / videoPrompt）是快照，改 playbook 不影响任何历史产出。
 *
 * 【依赖方向】store(scriptbox) → scriptBoxWorkflows(scriptbox) 内置 + storageAdapter(base)。
 *  下游 resolver(base) → 本 store。依赖单向，无回环。
 */
import { SCRIPT_BOX_WORKFLOWS, DEFAULT_WORKFLOW } from './scriptBoxWorkflows.js'
import { sGet, sSet, sRemove } from '../base/storageAdapter.js'
import { logger } from '../base/logger.js'

/** 自定义 playbook 的 localStorage 键（已在 contracts.js STORAGE_KEYS 登记，domain:'settings'）。 */
export const PLAYBOOKS_KEY = 'scriptbox_playbooks'

// ── localStorage 自定义列表缓存（sGet 同步读，避免每次 JSON.parse）。懒加载。─
let customCache = null // null=未加载；undefined 保留给「尚未定义」语义时用，校验见 loadCustom

/** 读取内置 playbook 并归一为统一结构（补 builtin / constraints 去 custom / negative 补 common）。 */
function normalizeBuiltin(id, wf) {
  return {
    id,
    label: wf.label,
    builtin: true,
    script: wf.script || '',
    shot: wf.shot || '',
    audit: wf.audit || '',
    qg: wf.qg || '',
    assetTemplates: wf.assetTemplates || {},
    imageGenTemplates: wf.imageGenTemplates || {},
    // §4.3 砍 custom：内置 constraints 只暴露 image/video；negative 补 common 位（空默认）。
    constraints: { image: wf.constraints?.image || '', video: wf.constraints?.video || '' },
    negative: { common: '', image: wf.negative?.image || '', video: wf.negative?.video || '' },
  }
}

/** 解析本地自定义 playbook 列表（sGet 返回字符串 → JSON.parse；坏数据降级为空对象）。 */
function loadCustom() {
  if (customCache !== null) return customCache
  try {
    const raw = sGet(PLAYBOOKS_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    customCache = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch (e) {
    logger.warn('scriptbox', '自定义 playbook 解析失败，降级为空', { error: e?.message })
    customCache = {}
  }
  return customCache
}

/** 持久化自定义列表（深拷贝后写 localStorage）。 */
function persist(obj) {
  try {
    sSet(PLAYBOOKS_KEY, JSON.stringify(obj))
  } catch (e) {
    // sSet 已内置 persist:failed 事件上报；此处仅留日志兜底
    logger.warn('scriptbox', '自定义 playbook 保存失败', { error: e?.message })
  }
}

/** 清缓存（供外部在写操作后不需要手动调，内部已同步更新；保留便于单测注入重置）。 */
export function __resetCustomCache() { customCache = null }

/**
 * 取所有 playbook（内置在前 + 自定义在后），供 GearSettings 下拉 / 管理面板。
 * @returns {Array<object>} playbook 数组（含 builtin 标志）
 */
export function getAllPlaybooks() {
  const builtin = Object.entries(SCRIPT_BOX_WORKFLOWS).map(([id, wf]) => normalizeBuiltin(id, wf))
  const custom = Object.values(loadCustom())
  return builtin.concat(custom)
}

/**
 * 按 id 取 playbook（内置与自定义共同查找；未命中回退默认并留痕警示而非静默）。
 * @param {string} id playbook id
 * @returns {object} playbook；未知 id 返回 DEFAULT_WORKFLOW 且 logger.warn（供悬挂引用显式提示）
 */
export function getPlaybook(id) {
  const rid = String(id || '')
  const custom = loadCustom()
  if (rid && custom[rid]) return custom[rid]
  if (rid && SCRIPT_BOX_WORKFLOWS[rid]) return normalizeBuiltin(rid, SCRIPT_BOX_WORKFLOWS[rid])
  // 悬挂引用：不静默吞掉，留痕警示（UI 侧据此显式展示「缺失」条）
  if (rid) logger.warn('scriptbox', '剧本盒子工作流不存在，回退默认', { playbookId: rid })
  const def = SCRIPT_BOX_WORKFLOWS[DEFAULT_WORKFLOW]
  return normalizeBuiltin(DEFAULT_WORKFLOW, def)
}

/** 是否内置（内置只读，不可删改，只可「另存为」）。 */
export function isBuiltin(id) {
  return Boolean(SCRIPT_BOX_WORKFLOWS[String(id || '')])
}

/**
 * 保存自定义 playbook（新建或整体覆盖）。名称/字段由调用方（GearSettings/manager）组织好。
 * @param {object} pb 自定义 playbook（含 id/label/…统一结构 + builtin:false）
 * @returns {boolean} 是否成功（id 为内置则拒绝）
 */
export function saveCustomPlaybook(pb) {
  if (!pb || !pb.id) return false
  if (isBuiltin(pb.id)) { logger.warn('scriptbox', '拒绝覆盖内置 playbook', { id: pb.id }); return false }
  const list = loadCustom()
  list[pb.id] = { ...pb, builtin: false }
  persist(list)
  return true
}

/**
 * 删除自定义 playbook。内置不可删。
 * @param {string} id
 * @returns {boolean}
 */
export function deleteCustomPlaybook(id) {
  if (isBuiltin(id)) return false
  const list = loadCustom()
  if (!(id in list)) return false
  delete list[id]
  persist(list)
  return true
}

/**
 * 「另存为」：从源 playbook 复制一个新自定义 playbook（生成独立 id）。
 * @param {string|null} sourceId 源 playbook id（另存当前选中）；内置/自定义均可作为源
 * @param {object} override 需要覆盖的字段（如另存为流程合并了编辑态/覆盖项）
 * @param {string} label 新名称（调用方已校验非空/不重名）
 * @returns {string} 新 playbook id（失败返回空串）
 */
export function createCustomFrom(sourceId, override = {}, label) {
  const src = getPlaybook(sourceId)
  const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const merged = {
    ...src,
    ...override,
    id,
    label: label || `${src.label} 副本`,
    builtin: false,
  }
  // negative.common 若源是旧结构缺位则补空，保证统一结构
  merged.negative = { common: '', image: '', video: '', ...(src.negative || {}), ...(override.negative || {}) }
  saveCustomPlaybook(merged)
  return id
}

// 兼容旧 import 契约：scriptBoxPrompts.js:16 与 GearSettings 原样依赖这些符号，保持导出不破坏。
export { SCRIPT_BOX_WORKFLOWS, DEFAULT_WORKFLOW }
/** @deprecated 旧 getWorkflow 语义的兼容别名（引擎已改走 resolver；此出口为保证过外部 import 不崩，勿新增调用）。 */
export function getWorkflow(id) {
  return getPlaybook(id)
}