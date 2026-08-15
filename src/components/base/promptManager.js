/**
 * 提示词预设数据层（复刻 maomao/src/services/promptManager.js）。
 *
 * 纯本地存储（localStorage），字段：{ id, title, type, prompt, enabled }
 *  - type: 'text' | 'image' | 'video' | 'all'（分类）
 *  - enabled: 是否启用
 *
 * 用法：
 *   loadPresets() / savePresets(list) / createPreset()
 *   saveAndNotify(list)  —— 保存后广播 'yimao:presetsChanged'，方便跨节点同步
 *   recordRecent(id) / getRecent()
 */
import { sGet, sSet } from './storageAdapter.js'

const STORAGE_KEY = 'yimao_preset_prompts'
const RECENT_KEY = 'yimao_preset_recent'

// 生成短 id
function generateId() {
  return 'pp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// 内置示例预设（首次使用、或本地清空时兜底展示，方便直观看到效果）
export const DEFAULT_PRESETS = [
  { id: 'pp_demo_title', title: '爆款标题', type: 'text', prompt: '请生成 10 个吸睛的爆款标题，要求短促有力、带情绪钩子', enabled: true },
  { id: 'pp_demo_xhs', title: '小红书文案', type: 'text', prompt: '以小红书种草风格写一段文案，语气亲切，多用 emoji 和换行', enabled: true },
  { id: 'pp_demo_cyber', title: '赛博朋克城市', type: 'image', prompt: '赛博朋克风格城市夜景，霓虹灯，雨夜，反乌托邦，电影感光影', enabled: true },
  { id: 'pp_demo_cat', title: '小猫花园', type: 'video', prompt: '一只小猫在花园里追逐蝴蝶，阳光，微风吹动花朵', enabled: true },
  { id: 'pp_demo_spring', title: '春天散文', type: 'text', prompt: '写一段关于春天的散文，清新自然，多用比喻', enabled: true }
]

// 读取本地 JSON（容错）
function readJSON(key, fallback) {
  try {
    const raw = sGet(key)
    if (!raw) return fallback
    const val = JSON.parse(raw)
    return Array.isArray(val) ? val : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, val) {
  try {
    sSet(key, JSON.stringify(val))
  } catch {
    // 忽略（隐私模式等）
  }
}

// 补齐 id（旧数据可能没 id）
export function ensureIds(presets) {
  if (!Array.isArray(presets)) return []
  return presets.map((p) => (p.id ? p : { ...p, id: generateId() }))
}

// 加载预设列表；首次使用（本地为空）→ 写入内置示例
export function loadPresets() {
  const stored = readJSON(STORAGE_KEY, null)
  if (stored === null) {
    const seeded = ensureIds(DEFAULT_PRESETS)
    writeJSON(STORAGE_KEY, seeded)
    return seeded
  }
  const withIds = ensureIds(stored)
  if (withIds.some((p, i) => !stored[i]?.id)) {
    writeJSON(STORAGE_KEY, withIds)
  }
  return withIds
}

// 全量保存
export function savePresets(presets) {
  writeJSON(STORAGE_KEY, presets)
}

// 新建空预设模板
export function createPreset() {
  return { id: generateId(), title: '', type: 'all', prompt: '', enabled: true }
}

// 保存并广播（跨节点同步提示词库）
export function saveAndNotify(presets) {
  savePresets(presets)
  try {
    window.dispatchEvent(new CustomEvent('yimao:presetsChanged', { detail: presets }))
  } catch {
    // ignore
  }
}

// 最近使用 id 列表（去重 + 上限 50）
export function getRecent() {
  return readJSON(RECENT_KEY, [])
}

export function recordRecent(id) {
  const list = getRecent()
  const next = [id, ...list.filter((x) => x !== id)].slice(0, 50)
  writeJSON(RECENT_KEY, next)
}

// 预设数组 → 弹窗卡片格式（含原始下标，供编辑/删除定位）
export function mapToLibraryCards(presets) {
  return presets
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.enabled !== false)
    .map(({ p, idx }) => ({
      id: p.id || 'preset-' + idx,
      title: p.title,
      content: p.prompt,
      category: p.type === 'all' ? '' : p.type,
      presetIndex: idx,
      isLocal: true
    }))
}

// 按最近使用 id 提取最近卡片
export function getRecentCards(allCards, recentIds) {
  const map = new Map(allCards.map((c) => [c.id, c]))
  return recentIds.map((id) => map.get(id)).filter(Boolean)
}

// 搜索过滤（标题 + 内容）
export function searchCards(cards, keyword) {
  if (!keyword || !keyword.trim()) return cards
  const kw = keyword.trim().toLowerCase()
  return cards.filter((c) => (c.title || '').toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw))
}

// 分类标签文案/颜色
export const TYPE_LABEL = { text: '文本', image: '生图', video: '视频' }
export const TYPE_TAG_CLASS = { text: 'text-green-400 bg-green-500/10', image: 'text-blue-400 bg-blue-500/10', video: 'text-purple-400 bg-purple-500/10' }
export const CATEGORY_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'image', label: '生图' },
  { value: 'video', label: '视频' }
]

export { generateId }
