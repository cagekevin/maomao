/**
 * 素材库 store（模拟 + 本地存储 + 事件订阅）。
 *
 * 素材按「目录」分类，目录对齐 loctool 的 folder 落盘结构：
 *  - tasks             AI生成结果
 *  - migrated          剪贴板
 *  - migrated/人物      剧本角色资产
 *  - migrated/场景      剧本场景资产
 *  - migrated/道具      剧本道具资产
 *  - materials         素材池（通用，上传默认落此）
 *
 * 素材字段：{ id, folder, type, url, name, size, ts }
 *  type: 'image' | 'video' | 'audio'
 *
 * 接真系统：upload() 改为 POST /api/resources（folder 参数）、
 * 素材列表改为 GET /api/resources?folder=xxx，UI 不变。
 */
import { useSyncExternalStore } from 'react'
import { sGet, sSet } from './storageAdapter.js'

const STORAGE_KEY = 'yimao_asset_library'
const listeners = new Set()

// 预置演示素材（首次使用/本地为空时 seed，方便直观看到目录效果）
const DEFAULT_ASSETS = [
  { id: 'a_gen_1', folder: 'tasks', type: 'image', name: '赛博朋克夜景.png', url: 'https://picsum.photos/seed/cyberasset/200/200', size: 1024 * 320, ts: 0 },
  { id: 'a_gen_2', folder: 'tasks', type: 'video', name: '花园小猫.mp4', url: 'https://www.w3schools.com/html/mov_bbb.mp4', size: 1024 * 2100, ts: 0 },
  { id: 'a_mig_1', folder: 'migrated/人物', type: 'image', name: '主角立绘.png', url: 'https://picsum.photos/seed/char/200/200', size: 1024 * 280, ts: 0 },
  { id: 'a_mig_2', folder: 'migrated/场景', type: 'image', name: '雨夜街道.png', url: 'https://picsum.photos/seed/scene/200/200', size: 1024 * 250, ts: 0 },
  { id: 'a_mig_3', folder: 'migrated/道具', type: 'image', name: '魔法书.png', url: 'https://picsum.photos/seed/prop/200/200', size: 1024 * 210, ts: 0 },
  { id: 'a_mat_1', folder: 'materials', type: 'audio', name: '背景音效.mp3', url: '', size: 1024 * 1500, ts: 0 }
]

function load() {
  try {
    const raw = sGet(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // 首次：seed 演示素材
    const seeded = DEFAULT_ASSETS.map((a) => ({ ...a, ts: Date.now() }))
    try { sSet(STORAGE_KEY, JSON.stringify(seeded)) } catch { /* ignore */ }
    return seeded
  } catch {
    return DEFAULT_ASSETS
  }
}

// 初始化素材列表（必须在 DEFAULT_ASSETS 与 load 定义之后）
let assets = load()

// 目录 pill 配置（含 folder 前缀匹配）
export const FOLDERS = [
  { key: 'all', label: '全部', folder: null },
  { key: 'generated', label: 'AI生成', folder: 'tasks' },
  { key: 'character', label: '人物', folder: 'migrated/人物' },
  { key: 'scene', label: '场景', folder: 'migrated/场景' },
  { key: 'prop', label: '道具', folder: 'migrated/道具' },
  { key: 'materials', label: '素材池', folder: 'materials' }
]

function persist() {
  try {
    sSet(STORAGE_KEY, JSON.stringify(assets))
  } catch {
    /* ignore */
  }
}

function notify() {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return assets
}

function genId() {
  return 'asset_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

// 判断文件类型（图片/视频/音频/文字/其他）
export function detectAssetType(file) {
  const type = file?.type || ''
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('text/')) return 'text' // .txt/.md/.json 等文本文件
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(file?.name || '')) return 'image'
  if (/\.(mp4|webm|mov|mkv)$/i.test(file?.name || '')) return 'video'
  if (/\.(mp3|wav|ogg|m4a)$/i.test(file?.name || '')) return 'audio'
  if (/\.(txt|md|markdown|json|log|csv|srt)$/i.test(file?.name || '')) return 'text'
  return 'image'
}

// 判断目录命中：folder 是否为当前 pill 的 folder 前缀
function matchesFolder(assetFolder, folder) {
  if (folder === null) return true // 全部
  if (folder === 'migrated') return assetFolder === 'migrated' || assetFolder.startsWith('migrated/')
  return assetFolder === folder || assetFolder.startsWith(folder + '/')
}

// 按目录 pill 过滤素材
export function filterByFolder(list, folder) {
  return list.filter((a) => matchesFolder(a.folder, folder))
}

// 新增素材（folder 指定落目录，缺省 materials）
export function addAssets(items, folder = 'materials') {
  const now = Date.now()
  const added = items.map((it) => ({
    id: it.id || genId(),
    folder: it.folder || folder,
    type: it.type || 'image',
    url: it.url,
    name: it.name || '未命名',
    size: it.size || 0,
    ts: it.ts || now
  }))
  assets = [...added, ...assets]
  notify()
  return added
}

export function removeAsset(id) {
  assets = assets.filter((a) => a.id !== id)
  notify()
}

export function clearAssets() {
  assets = []
  notify()
}

// 本地持久化时同步到内存（跨 tab）
export function loadAssets() {
  assets = load()
  notify()
}

// React hook：订阅素材列表
export function useAssets() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
