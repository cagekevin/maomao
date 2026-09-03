/**
 * ════════════════════════════════════════════════════════════════
 * 【前端 ↔ 后端的定位】本模块是「前端 → localTool 后端」的文件落盘唯一桥。
 * ════════════════════════════════════════════════════════════════
 * · 职责：把生成结果 / 素材 / 网页图从浏览器侧落盘到 localTool 后端的 uploads/ 目录，
 *   使「生成面板 / 素材库」能读到（后端 rescan 按目录收录）。
 * · 后端：localTool 服务，默认 http://127.0.0.1:18080（API_BASE）。
 * · 唯一端点：只打 `POST ${API_BASE}/api/files/upload` 一个接口，两种请求模式——
 *     multipart FormData（file + subfolder [+filename]）→ 直接存本地文件；
 *     JSON（{ fileUrl, subfolder, filename }）→ 后端 saveRemoteUrl 代下载（fetchWithProxy）
 *     并 sha1 幂等去重（downloadRemoteToLocal / saveResultToTasks 的 http 分支共用 uploadRemoteUrl）。
 * · 落盘目录：subfolder 一律取自 UPLOAD_DIRS 中央表（tasks/web/canvas/canvas/drop/
 *   canvas/video-process/migrated/director3d），禁止散写字面量；目录名一律不改（防存量 URL 破链）。
 * · 返回契约：后端返回 { code, data: { url } } 信封，本模块取 data.data.url
 *   （http://127.0.0.1:18080/files/<subfolder>/<name>）；失败一律返回 null 不抛
 *   （调用方降级保持原 URL），并 logger.warn 留痕 —— 失败可见但不打断主流程。
 * · 出口纪律：所有落盘经 httpRequest（统一超时/重试/错误分类），UPLOAD_OPTS 用较长超时 +
 *   retries:0（大文件不自动重试，避免重复上传）；禁止绕过本模块另写 fetch/上传。
 * · 本模块不碰后端 SQLite/DB，只做文件落盘 + 供 rescan 收录。
 * ════════════════════════════════════════════════════════════════
 *
 * 落盘函数一览（全部返回 url 或 null）：
 *  - saveInlineToLocal(dataUrl, subfolder?)   dataURL → multipart，sha1 内容哈希幂等去重
 *  - uploadFileToLocal(file, subfolder?, name)  原始 File/Blob → multipart（避免大文件两段内存拷贝）
 *  - downloadRemoteToLocal(url, {folder,name})  网页远程图 → JSON fileUrl 后台代下载（先拦本地 URL）
 *  - saveResultToTasks(url, type)  生成结果 → tasks（data:→multipart；http→fileUrl 代下载）
 *  - saveTextToTasks(text, name)  纯文本结果 → tasks/*.txt（后端 rescan 识别 type='text'）
 */
import { API_BASE } from '../config.ts'
import { httpRequest } from './httpClient.ts'
import { logger } from '../logger.ts'
import { UPLOAD_TIMEOUT } from '../config.ts'
import { formatTime, dataUrlToBlob, safeFileName } from '../utils.ts'
import { UPLOAD_DIRS } from '../uploadDirs.ts'
export { toAbsoluteFileUrl } from '../imageUrl.ts'
export { EXT_BY_TYPE }
import { isLocalFileUrl } from '../imageUrl.ts'
const SUBFOLDER = UPLOAD_DIRS.tasks
/** 网页拖图专用落盘目录（不与素材库/生成结果混放，见 docs/34 升级） */
export const WEB_DROP_SUBFOLDER = UPLOAD_DIRS.web
// multipart/大文件上传统一参数：较长超时 + 不自动重试（避免重复上传）
const UPLOAD_OPTS = { timeoutMs: UPLOAD_TIMEOUT, retries: 0 }

// toAbsoluteFileUrl 已收敛到 imageUrl.js（统一图片 URL 归一化入口）。
// 此处 re-export 兼容既有引用，逻辑单一来源在 imageUrl.js。

// 类型 → 扩展名（生成面板按扩展名分类展示）
const EXT_BY_TYPE: Record<string, string> = {
  image: 'png',
  text: 'txt',
  video: 'mp4',
  audio: 'm4a',
}

/** 文件名去非法字符 + 可读时间戳唯一化（到秒，如 20250815_142305） */
function safeName(base: string, ext: string): string {
  const clean = safeFileName(base, { fallback: 'result' })
  return `${clean}_${formatTime(undefined, { mode: 'file' })}.${ext}`
}

/**
 * 把内联 dataURL 落盘为本地文件 URL（「将内联资源转为URL / 清理缓存」核心）。
 * 语义对齐官方后端 base64Externalize.saveBase64ToFile：
 *  - 文件名 = sha1(base64 内容) 前 16 位 + 扩展名 → 幂等去重，重复转换不重复落盘；
 *  - 落盘失败返回 null，调用方保留原 base64（绝不删图）。
 * 走 localTool /api/files/upload，返回 http://127.0.0.1:18080/files/<subfolder>/<name>。
 * @param {string} dataUrl 形如 data:image/png;base64,xxxx
 * @param {string} [subfolder] 落盘子目录，默认 canvas（与官方 base64Externalize 一致）
 * @returns {Promise<string|null>} 落盘 URL；失败返回 null
 */
export async function saveInlineToLocal(dataUrl: string, subfolder: string = UPLOAD_DIRS.canvas): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  try {
    const blob = dataUrlToBlob(dataUrl)
    const fileExt = extFromMime(dataUrl) || 'png'
    // sha1 去重：同一 base64 → 同一文件名（对齐官方 saveBase64ToFile 惯例）
    const hash = await sha1Hex(blob)
    const filename = `${hash}.${fileExt}`
    const fd = new FormData()
    fd.append('file', blob, filename)
    fd.append('subfolder', subfolder)
    const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
    return data?.data?.url || null
  } catch (e) {
    logger.warn('filesApi', '内联资源落盘失败', e)
    return null
  }
}

/**
 * 直接把 File/Blob 上传到 localTool（对齐官方 H_.jsx onDrop 的 hi(file,{subfolder})）。
 * 区别于 saveInlineToLocal（dataURL → 落盘）：这里直接 multipart 传原始文件，
 * 避免视频等大文件先转 dataURL 再转 Blob 的两段大内存拷贝。
 * 上传成功返回 http://127.0.0.1:18080/files/<subfolder>/<name>；失败返回 null。
 * @param {File|Blob} file 原始文件
 * @param {string} [subfolder] 落盘子目录，默认 canvas/drop（对齐官方）
 * @param {string} [filename] 可选自定义文件名（默认用 file.name）
 * @returns {Promise<string|null>}
 */
export async function uploadFileToLocal(file: File | Blob | null, subfolder: string = UPLOAD_DIRS.canvasDrop, filename?: string): Promise<string | null> {
  if (!file) return null
  logger.debug('filesApi', '[UPLOAD] 准备 multipart 上传', { subfolder, name: filename || (file as File).name, size: file.size, type: file.type }, { module: 'asset' })
  try {
    const fd = new FormData()
    fd.append('file', file, filename || (file as File).name || 'upload')
    fd.append('subfolder', subfolder)
    const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
    logger.debug('filesApi', '[UPLOAD] 完成', { url: data?.data?.url, subfolder }, { module: 'asset' })
    return data?.data?.url || null
  } catch (e) {
    logger.warn('filesApi', '文件上传失败', e)
    return null
  }
}

/**
 * 远程 http(s) URL → 本地 /files/ URL（网页拖图后台本地化专用，先显示后替换）。
 * 复用 localTool 后端【唯一下载归属点】saveRemoteUrl：POST /api/files/upload 传 fileUrl，
 * 服务端 fetchWithProxy 下载（直连优先、失败走 7897 代理）+ sha1 幂等去重 + [download] 留痕日志。
 * 跨域/防盗链图在浏览器 fetch 会失败，后端代下载天然绕过 CORS。网页图统一落 web 目录，
 * 不与素材库/生成结果混放。
 * @param {string} url http(s) 远程图片 URL
 * @param {object} [opts] { folder='canvas' 落盘子目录, filename 可选文件名（默认取 URL basename） }
 * @returns {Promise<string|null>} 本地化 URL（http://127.0.0.1:18080/files/<folder>/<name>）；失败返回 null（调用方降级保持原 URL）
 */
export async function downloadRemoteToLocal(url: string, { folder = UPLOAD_DIRS.canvas, filename }: { folder?: string; filename?: string } = {}): Promise<string | null> {
  // 【本地图拦截】URL 已指向本机 uploads（/files/... 或 API_BASE/files/...）→ 本就落盘，无需再下载。
  // 背景：素材拖到画布时若没带 application/x-yimao-asset，画布会把它当「网页图」走本地化，
  // 后端便把 127.0.0.1 的文件重新下载一份存进 web 目录 → uploads/web 出现重复文件。
  // 这里作为最后一道防线：任何入口想「本地化」本机文件，一律直接返回 null（调用方保持原 URL）。
  if (isLocalFileUrl(url)) {
    logger.debug('filesApi', '[DOWNLOAD] 已是本地文件，跳过重复下载', { url: String(url).slice(0, 100) }, { module: 'asset' })
    return null
  }
  // saveRemoteUrl 用 new URL(fileUrl) 取 basename，data:/blob: 会抛错 → 仅 http(s) 可下载（非 http 直接 null）
  if (typeof url !== 'string' || !/^https?:/i.test(url)) return null
  return uploadRemoteUrl(url, folder, filename)
}

/**
 * 【内部】http(s) 远程 URL → 落盘本地 /files/ URL（fileUrl 模式，后端 saveRemoteUrl 幂等下载）。
 * downloadRemoteToLocal 与 saveResultToTasks 的 http 分支共用的唯一下载入口，禁止调用方另写 JSON 上传。
 * @param {string} fileUrl http(s) 远程 URL
 * @param {string} subfolder 落盘子目录
 * @param {string} [filename] 可选文件名
 * @returns {Promise<string|null>} 本地 /files/ URL；失败返回 null（不抛，调用方降级）
 */
async function uploadRemoteUrl(fileUrl: string, subfolder: string, filename?: string): Promise<string | null> {
  try {
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl, subfolder, filename: filename || undefined }),
      ...UPLOAD_OPTS,
    })
    return data?.data?.url || null
  } catch (e) {
    logger.warn('filesApi', '远程 URL 落盘失败', e)
    return null
  }
}

/** data: URL → 扩展名（不带点），按 mime 推导 */
function extFromMime(dataUrl: string): string | null {
  const m = /^data:([^;,]+)/.exec(dataUrl)?.[1]
  if (!m) return null
  const subtype = m.split('/')[1]?.toLowerCase()
  const map: Record<string, string> = { jpeg: 'jpg', 'svg+xml': 'svg', 'quicktime': 'mov' }
  return map[subtype] || subtype || null
}

/** blob → sha1 十六进制（Web Crypto），供幂等去重；失败返回空串 */
async function sha1Hex(blob: Blob): Promise<string> {
  try {
    const buf = await blob.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-1', buf)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now()}`
  }
}

/**
 * 把生成结果落盘到 localTool 的 tasks 目录。
 * @param {string} url 结果 url：data: / blob: / http(s) 上游 url
 * @param {'image'|'text'|'video'|'audio'|string} type 结果类型，决定扩展名
 * @returns {Promise<string|null>} 落盘后的 url（http://127.0.0.1:18080/files/tasks/xxx.png）；失败返回 null（不抛，不影响主流程）
 */
export async function saveResultToTasks(url: string, type: string): Promise<string | null> {
  if (!url || url.startsWith('blob:')) return null // blob: 是本地临时地址，上传无意义（调用方应传 data:/http）
  // 【relay 后端化】url 已是本机 /files/（relay-poll 后端已落盘 tasks 目录）→ 无需再落盘，直接返回原 url。
  // 否则 uploadRemoteUrl 会把本机文件重新下载一份到 tasks → uploads/tasks 出现重复文件（M4-C4 / P0-C 双落盘洞）。
  if (isLocalFileUrl(url)) {
    return url
  }
  const ext = EXT_BY_TYPE[type] || 'bin'

  try {
    if (url.startsWith('data:')) {
      // 本地 base64 → multipart 上传
      const blob = dataUrlToBlob(url)
      const fd = new FormData()
      fd.append('file', blob, `result_${Date.now()}.${ext}`)
      fd.append('subfolder', SUBFOLDER)
      fd.append('filename', safeName('generated', ext))
      const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
      return data?.data?.url || null
    }

    // http(s) 上游 url → fileUrl 幂等下载落盘（走 uploadRemoteUrl 唯一下载入口）
    return uploadRemoteUrl(url, SUBFOLDER, safeName('generated', ext))
  } catch (e) {
    logger.warn('filesApi', '落盘 tasks 失败', e)
    return null
  }
}

/**
 * 把纯文本结果落盘成 txt 到 tasks 目录（文本节点的生成结果不是 url，而是文本内容）。
 * 后端 rescan 会把 upload/tasks/*.txt 识别为 type='text'，生成面板「文本」tab 即可收录。
 * @param {string} text 文本内容
 * @param {string} [name] 文件名前缀（默认 generated）
 * @returns {Promise<string|null>} 落盘后的 18080 url；失败返回 null（不抛，不影响主流程）
 */
export async function saveTextToTasks(text: string, name?: string): Promise<string | null> {
  if (typeof text !== 'string' || !text.trim()) return null
  // 文件名清洗统一走 safeFileName（收口，勿再手写 replace 样板）：与旧手写逻辑逐字节等价（sep='_' + fallback）
  const safeBase = safeFileName(name, { fallback: 'generated' })
  const filename = `${safeBase}_${formatTime(undefined, { mode: 'file' })}.txt`
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const fd = new FormData()
    fd.append('file', blob, filename)
    fd.append('subfolder', SUBFOLDER)
    fd.append('filename', filename)
    const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
    return data?.data?.url || null
  } catch (e) {
    logger.warn('filesApi', '文本落盘 tasks 失败', e)
    return null
  }
}
