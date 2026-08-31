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
import { contentGet, contentSet } from './contentStore.ts'
import { publish } from './eventBus.ts'
import { generateId } from './idGen.ts'

/** 预设分类（对齐下方 TYPE_LABEL 键与前端 PromptLibrary 分组） */
export type PresetType = 'text' | 'image' | 'video' | 'all'

/** 提示词预设（本地存储形状，id 可能缺失由 ensureIds 补齐） */
export interface Preset {
  id?: string
  title?: string
  type?: string
  prompt?: string
  enabled?: boolean
}

/** 弹窗卡片行（mapToLibraryCards 输出，供 PromptLibrary 渲染） */
interface LibraryCard {
  id: string
  title?: string
  content?: string
  category?: string
  presetIndex: number
  isLocal: boolean
}

const STORAGE_KEY = 'yimao_preset_prompts'
const RECENT_KEY = 'yimao_preset_recent'

// 内置示例预设（首次使用、或本地清空时兜底展示，方便直观看到效果）
export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'pp_face_real',
    title: '面部变真实',
    type: 'image',
    prompt: '超写实人像；自然不均匀的皮肤纹理，可见毛孔，细微的汗毛，鼻翼周围淡淡的泛红，轻微的眼下阴影，真实的皮肤通透感；无磨皮，无美颜效果，纪实写实风格；中性深色背景，柔和虚化；侧方柔和定向光，凸显皮肤纹理与面部轮廓；真实自然的色调，电影感但自然的对比度；使用高端85mm人像镜头拍摄，浅景深，眼睛部分极致清晰；照片级真实感，无CGI渲染',
    enabled: true
  }
]

// 读取本地（容错）
function readJSON<T>(key: string, fallback: T): T {
  try {
    const val = contentGet(key)
    if (val === undefined || val === null) return fallback
    return Array.isArray(val) ? (val as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, val: unknown): void {
  try {
    contentSet(key, val)
  } catch {
    // 忽略（隐私模式等）
  }
}

// 补齐 id（旧数据可能没 id）
export function ensureIds(presets: Preset[]): Preset[] {
  if (!Array.isArray(presets)) return []
  return presets.map((p) => (p.id ? p : { ...p, id: generateId('pp') }))
}

// 加载预设列表；首次使用（本地为空）→ 写入内置示例
export function loadPresets(): Preset[] {
  const stored = readJSON<Preset[] | null>(STORAGE_KEY, null)
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
export function savePresets(presets: Preset[]): void {
  writeJSON(STORAGE_KEY, presets)
}

// 新建空预设模板
export function createPreset(): Preset {
  return { id: generateId('pp'), title: '', type: 'all', prompt: '', enabled: true }
}

// 保存并广播（跨节点同步提示词库）
export function saveAndNotify(presets: Preset[]): void {
  savePresets(presets)
  // 广播预设变化（经 eventBus，解耦 window）：PromptLibrary 等订阅同步
  publish('presets-changed', presets)
}

// 最近使用 id 列表（去重 + 上限 50）
export function getRecent(): string[] {
  return readJSON<string[]>(RECENT_KEY, [])
}

export function recordRecent(id: string): void {
  const list = getRecent()
  const next = [id, ...list.filter((x) => x !== id)].slice(0, 50)
  writeJSON(RECENT_KEY, next)
}

// 预设数组 → 弹窗卡片格式（含原始下标，供编辑/删除定位）
export function mapToLibraryCards(presets: Preset[]): LibraryCard[] {
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
export function getRecentCards(allCards: LibraryCard[], recentIds: string[]): LibraryCard[] {
  const map = new Map(allCards.map((c) => [c.id, c]))
  return recentIds.map((id) => map.get(id)).filter(Boolean)
}

// 搜索过滤（标题 + 内容）
export function searchCards(cards: LibraryCard[], keyword: string): LibraryCard[] {
  if (!keyword || !keyword.trim()) return cards
  const kw = keyword.trim().toLowerCase()
  return cards.filter((c) => (c.title || '').toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw))
}

// 分类标签文案/颜色
export const TYPE_LABEL: Record<string, string> = { text: '文本', image: '生图', video: '视频' }
export const TYPE_TAG_CLASS: Record<string, string> = { text: 'text-green-400 bg-green-500/10', image: 'text-blue-400 bg-blue-500/10', video: 'text-purple-400 bg-purple-500/10' }
export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'image', label: '生图' },
  { value: 'video', label: '视频' }
]

export { generateId }