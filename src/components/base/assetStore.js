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
 * 接真系统：本 store 是前端本地缓存（localStorage）；
 * 「发送到素材库」（sendToAssetLibrary）现已同时把 URL 素材落盘到 localTool
 * （POST /api/files/upload，subfolder=folder）并 rescan，素材库面板（读 /api/resources）可读到。
 */
import { useSyncExternalStore } from 'react'
import { contentGet, contentSet, createDebouncedPersist } from './contentStore.js'
import { generateId } from './idGen.js'
import { httpRequest } from './httpClient.js'
import { API_BASE } from './apiBase.js'
import { rescanResources } from './resourcesApi.js'
import { saveInlineToLocal } from './filesApi.js'
import { logger } from './logger.js'

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
  const raw = contentGet(STORAGE_KEY)
  if (Array.isArray(raw) && raw.length > 0) return raw
  // 首次：seed 演示素材
  const seeded = DEFAULT_ASSETS.map((a) => ({ ...a, ts: Date.now() }))
  contentSet(STORAGE_KEY, seeded)
  return seeded
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

// P4 落盘节流：高频变更（拖入/批量生成/上传进度）合并落盘，消除主线程长任务。
// write 是「读当前最新 assets」的 thunk —— flush 时才执行，天然把窗口内多次变更合并为最终态。
// 通知订阅者（notify）保持即时，只有「落盘」被节流，UI 响应性不受影响。
const persistDebounced = createDebouncedPersist(() => contentSet(STORAGE_KEY, assets), 300)

function notify() {
  persistDebounced.schedule()
  listeners.forEach((l) => l())
}

/** 强制立即落盘（页面卸载兜底 / 测试用）；createDebouncedPersist 已自动注册 pagehide 兜底 */
export function flushPersist() {
  persistDebounced.flush()
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return assets
}

/** 读取当前内存素材列表（供测试/非 React 场景） */
export function getAssets() {
  return assets
}

function genId() {
  return generateId('asset')
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

/**
 * 发送任意 URL 素材到素材库（节点「发送到素材库」统一入口）。
 * - 自动按 URL/文件名推断类型（detectAssetType）；
 * - 默认落入「素材池(materials)」目录；可传 folder 覆盖（如 'tasks'）；
 * - 名称优先用传入 name，否则用 URL 文件名，再否则「未命名」。
 * 返回新增的素材数组（供调用方 toast / 其它联动）。
 *
 * 【后端落盘】此前只写前端 localStorage，素材库面板读的是后端 /api/resources，两套割裂导致
 * 「已发送但面板看不到」。现补上：把 URL 素材经 localTool 落盘到对应 folder 目录（幂等 sha1 去重），
 * 落盘成功后 rescan，素材库面板即可读到。data: → multipart；http(s) → fileUrl 下载落盘。
 * blob: 是本地临时地址，不落盘（调用方应传 data:/http）。
 */
export function sendToAssetLibrary(url, { name, folder = 'materials', type } = {}) {
  if (!url) return []
  let fname = '未命名'
  try {
    const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    if (fromUrl && !/^blob:|^data:/.test(url)) fname = fromUrl
  } catch {}
  const assetName = (name && String(name).trim()) || fname
  const detectedType = type || detectAssetType({ name: fname, type: '' })
  const added = addAssets([{ url, name: assetName, type: detectedType }], folder)

  // 异步后端落盘（不阻塞、失败不抛——前端 store 仍保留，只是面板稍后 rescan 可见）
  if (url && !url.startsWith('blob:')) {
    persistUrlToBackend(url, folder)
  }
  return added
}

/** 把单个 URL 素材落盘到后端指定 folder 目录，成功后 rescan。 */
async function persistUrlToBackend(url, folder) {
  try {
    if (url.startsWith('data:')) {
      // 本地 base64 → multipart 上传（复用 filesApi 的 dataURL 落盘，subfolder 传 folder）
      await saveInlineToLocal(url, folder)
    } else {
      // http(s) 上游 url → fileUrl 幂等下载落盘（对齐 saveResultToTasks 范式，subfolder 用 folder）。
      // ⚠️ 不传 filename：后端 saveRemoteUrl 用「sha1(url) + URL basename」做幂等文件名，
      // 传带时间戳的 filename 会让同名 URL 每次生成新文件名 → 重复下载，破坏幂等。
      await httpRequest(`${API_BASE}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: url, subfolder: folder }),
        timeoutMs: 60000,
        retries: 0,
        label: 'sendToAssetLibrary',
      })
    }
    // 落盘后 rescan，让素材库面板（读 /api/resources）能收到新素材
    await rescanResources()
  } catch (e) {
    logger.warn('assetStore', '发送到素材库落盘失败', e?.message)
  }
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
  return assets
}

// React hook：订阅素材列表
export function useAssets() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
