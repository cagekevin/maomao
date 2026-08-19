/**
 * 素材库 store（模拟 + 本地存储 + 事件订阅）。
 *
 * 素材按「目录」分类，目录对齐 loctool 的 folder 落盘结构：
 *  - tasks             AI生成结果
 *  - migrated          剪贴板
 *  - migrated/人物      剧本角色资产
 *  - migrated/场景      剧本场景资产
 *  - migrated/道具      剧本道具资产
 *  - migrated           素材库（通用，上传默认落此）
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
import { API_BASE } from './config.js'
import { rescanResources } from './localToolApi.js'
import { saveInlineToLocal, uploadFileToLocal, EXT_BY_TYPE } from './filesApi.js'
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
  { id: 'a_mat_1', folder: 'migrated', type: 'audio', name: '背景音效.mp3', url: '', size: 1024 * 1500, ts: 0 }
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
  { key: 'migrated', label: '素材库', folder: 'migrated' }
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

// 新增素材（folder 指定落目录，缺省 migrated）
export function addAssets(items, folder = 'migrated') {
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
 * - 默认落入「素材库(migrated)」目录；可传 folder 覆盖（如 'tasks'）；
 * - 名称优先用传入 name，否则用 URL 文件名，再否则「未命名」。
 * 返回新增的素材数组（供调用方 toast / 其它联动）。
 *
 * 【后端落盘】此前只写前端 localStorage，素材库面板读的是后端 /api/resources，两套割裂导致
 * 「已发送但面板看不到」。现补上：把 URL 素材经 localTool 落盘到对应 folder 目录（幂等 sha1 去重），
 * 落盘成功后 rescan，素材库面板即可读到。data: → multipart；http(s) → 下载成 Blob 后 multipart。
 * blob: 是本地临时地址，不落盘（调用方应传 data:/http）。
 */
export function sendToAssetLibrary(url, { name, folder = 'migrated', type } = {}) {
  logger.debug('assetStore', '[SEND] sendToAssetLibrary 进入', { urlPrefix: String(url).slice(0, 60), folder, name }, { module: 'asset' })
  if (!url) return []
  let fname = '未命名'
  try {
    const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    if (fromUrl && !/^blob:|^data:/.test(url)) fname = fromUrl
  } catch {}
  const assetName = (name && String(name).trim()) || fname
  const detectedType = type || detectAssetType({ name: fname, type: '' })
  const added = addAssets([{ url, name: assetName, type: detectedType }], folder)

  // 异步后端落盘（不阻塞、失败不抛——前端 store 仍保留，只是面板稍后 rescan 可见）。
  // 修复：blob: 是本地临时对象 URL，此前被直接短路丢弃（「发送到素材库」静默不落盘）。
  // 现改为用 filesApi.uploadFileToLocal 直接把 blob 作为文件上传落盘，与 data:/http 分支一致。
  if (url) {
    logger.debug('assetStore', '[SEND] 准备落盘', { urlPrefix: String(url).slice(0, 60), folder }, { module: 'asset' })
    persistUrlToBackend(url, folder)
  }
  // 广播「已发送」事件：素材库面板（assetStore 与 AssetLibrary 互不相通）订阅后
  // 自动切到落盘目录并重新 rescan 拉取，避免「点别处才刷新」的假象。
  emitAssetSent(folder)
  return added
}

/** 把单个 URL 素材落盘到后端指定 folder 目录，成功后 rescan。 */
async function persistUrlToBackend(url, folder) {
  logger.debug('assetStore', '[PERSIST] 开始', { kind: url.startsWith('data:') ? 'data' : url.startsWith('blob:') ? 'blob' : 'http', folder }, { module: 'asset' })
  try {
    if (url.startsWith('data:')) {
      // 本地 base64 → multipart 上传（复用 filesApi 的 dataURL 落盘，subfolder 传 folder）
      logger.debug('assetStore', '[PERSIST] 走 data 分支 saveInlineToLocal', null, { module: 'asset' })
      await saveInlineToLocal(url, folder)
      logger.debug('assetStore', '[PERSIST] data 分支完成', null, { module: 'asset' })
    } else if (url.startsWith('blob:')) {
      // 修复：blob: 是本地临时对象 URL，不能通过 fileUrl 下载（new URL 报错 / 浏览器回收）。
      // 改为 fetch 取 Blob 后作为文件上传，走与链路 A 一致的上传入口，保证「发送到素材库」对任意来源都落盘。
      try {
        logger.debug('assetStore', '[PERSIST] 走 blob 分支 fetch', url, { module: 'asset' })
        const resp = await httpRequest(url, { parseJson: false, retries: 0, label: 'assetStore.persistBlob' })
        logger.debug('assetStore', '[PERSIST] blob fetch 响应', { ok: resp.ok, status: resp.status }, { module: 'asset' })
        const blob = await resp.blob()
        const mime = blob.type || 'image/png'
        const ext = EXT_BY_TYPE[detectAssetType({ name: '', type: mime })] || (mime.split('/')[1] || 'png')
        const file = new File([blob], `asset.${ext}`, { type: mime })
        await uploadFileToLocal(file, folder)
        logger.debug('assetStore', '[PERSIST] blob 分支 uploadFileToLocal 完成', null, { module: 'asset' })
      } catch (blobErr) {
        logger.warn('assetStore', 'blob 转文件失败，跳过落盘', blobErr?.message)
      }
    } else {
      // http(s) 上游 url → 模仿链路 A（面板上传）：先把远程内容 fetch 成 Blob，
      // 再用 uploadFileToLocal 走 multipart（file + subfolder）落盘，
      // 不再走 JSON fileUrl 的 saveRemoteUrl 分支（避免 data:/异常态/内部地址等坑）。
      logger.debug('assetStore', '[PERSIST] 走 http 分支 fetch', url, { module: 'asset' })
      const resp = await httpRequest(url, { parseJson: false, label: 'assetStore.persistHttp' })
      logger.debug('assetStore', '[PERSIST] http fetch 响应', { ok: resp.ok, status: resp.status }, { module: 'asset' })
      const blob = await resp.blob()
      const mime = blob.type || 'image/png'
      const ext = EXT_BY_TYPE[detectAssetType({ name: '', type: mime })] || (mime.split('/')[1] || 'png')
      const file = new File([blob], `asset.${ext}`, { type: mime })
      await uploadFileToLocal(file, folder)
      logger.debug('assetStore', '[PERSIST] http 分支 uploadFileToLocal 完成', null, { module: 'asset' })
    }
    // 落盘后 rescan，让素材库面板（读 /api/resources）能收到新素材
    logger.debug('assetStore', '[PERSIST] 落盘成功，准备 rescan', null, { module: 'asset' })
    await rescanResources()
    logger.debug('assetStore', '[PERSIST] rescan 完成', null, { module: 'asset' })
  } catch (e) {
    // 落盘失败不再弹错误 toast（避免「成功」与「失败」提示矛盾、误导用户）；
    // 仅保留日志，便于后续排查实际落盘情况。
    const msg = e?.message || String(e)
    logger.error('assetStore', '发送到素材库落盘失败', msg)
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

// ── 发送成功事件总线 ──
// 问题背景：assetStore（落盘）与 AssetLibrary（读后端 /api/resources）是两套独立模块，
// 互不相通。sendToAssetLibrary 落盘成功后，面板不会自动重新拉取，必须手动切目录才刷新
// （用户体感「点别处才刷新」）。这里用一个轻量回调桥，发送成功后通知面板主动刷新。
let assetSentListener = null
export function onAssetSent(cb) {
  assetSentListener = cb
  return () => { if (assetSentListener === cb) assetSentListener = null }
}
export function emitAssetSent(folder) {
  assetSentListener?.(folder)
}
