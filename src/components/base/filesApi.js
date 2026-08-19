/**
 * localTool 文件落盘（生成结果 → uploads/tasks 目录）。
 *
 * 复刻官方 H_.jsx 的 Ce.uploadFile：生成完成后把结果保存到 localTool 的 tasks 目录，
 * 使「生成」面板（读 uploads/tasks）能看到生成结果。
 *
 * 断档背景：节点生成成功只把 resultUrl 存进任务中心(SQLite)，未落盘 tasks 目录，
 * 导致生成面板空。这里补上落盘：data:/blob → multipart file；http → fileUrl(幂等下载)。
 */
import { API_BASE } from './config.js'
import { httpRequest } from './httpClient.js'
import { logger } from './logger.js'
import { UPLOAD_TIMEOUT } from './config.js'
import { formatTime } from './utils.js'
export { toAbsoluteFileUrl } from './imageUrl.js'
export { EXT_BY_TYPE }
const SUBFOLDER = 'tasks'
// multipart/大文件上传统一参数：较长超时 + 不自动重试（避免重复上传）
const UPLOAD_OPTS = { timeoutMs: UPLOAD_TIMEOUT, retries: 0 }

// toAbsoluteFileUrl 已收敛到 imageUrl.js（统一图片 URL 归一化入口）。
// 此处 re-export 兼容既有引用，逻辑单一来源在 imageUrl.js。

// 类型 → 扩展名（生成面板按扩展名分类展示）
const EXT_BY_TYPE = {
  image: 'png',
  text: 'txt',
  video: 'mp4',
  audio: 'm4a',
}

/** 文件名去非法字符 + 可读时间戳唯一化（到秒，如 20250815_142305） */
function safeName(base, ext) {
  const clean = (base || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'result'
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
export async function saveInlineToLocal(dataUrl, subfolder = 'canvas') {
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
    return data.url || null
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
export async function uploadFileToLocal(file, subfolder = 'canvas/drop', filename) {
  if (!file) return null
  logger.debug('filesApi', '[UPLOAD] 准备 multipart 上传', { subfolder, name: filename || file.name, size: file.size, type: file.type }, { module: 'asset' })
  try {
    const fd = new FormData()
    fd.append('file', file, filename || file.name || 'upload')
    fd.append('subfolder', subfolder)
    const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
    logger.debug('filesApi', '[UPLOAD] 完成', { url: data?.url, subfolder }, { module: 'asset' })
    return data.url || null
  } catch (e) {
    logger.warn('filesApi', '文件上传失败', e)
    return null
  }
}

/** data: URL → 扩展名（不带点），按 mime 推导 */
function extFromMime(dataUrl) {
  const m = /^data:([^;,]+)/.exec(dataUrl)?.[1]
  if (!m) return null
  const subtype = m.split('/')[1]?.toLowerCase()
  const map = { jpeg: 'jpg', 'svg+xml': 'svg', 'quicktime': 'mov' }
  return map[subtype] || subtype || null
}

/** blob → sha1 十六进制（Web Crypto），供幂等去重；失败返回空串 */
async function sha1Hex(blob) {
  try {
    const buf = await blob.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-1', buf)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now()}`
  }
}

/** data: URL → Blob（base64 或 urlencoded） */
function dataUrlToBlob(dataUrl) {
  const idx = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, idx)
  const raw = dataUrl.slice(idx + 1)
  const mime = meta.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(raw)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * 把生成结果落盘到 localTool 的 tasks 目录。
 * @param {string} url 结果 url：data: / blob: / http(s) 上游 url
 * @param {'image'|'text'|'video'|'audio'|string} type 结果类型，决定扩展名
 * @returns {Promise<string|null>} 落盘后的 url（http://127.0.0.1:18080/files/tasks/xxx.png）；失败返回 null（不抛，不影响主流程）
 */
export async function saveResultToTasks(url, type) {
  if (!url || url.startsWith('blob:')) return null // blob: 是本地临时地址，上传无意义（调用方应传 data:/http）
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
      return data.url || null
    }

    // http(s) 上游 url → fileUrl 幂等下载落盘
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl: url, subfolder: SUBFOLDER, filename: safeName('generated', ext) }),
      ...UPLOAD_OPTS,
    })
    return data.url || null
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
export async function saveTextToTasks(text, name) {
  if (typeof text !== 'string' || !text.trim()) return null
  const safeBase = (name || 'generated').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'generated'
  const filename = `${safeBase}_${formatTime(undefined, { mode: 'file' })}.txt`
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const fd = new FormData()
    fd.append('file', blob, filename)
    fd.append('subfolder', SUBFOLDER)
    fd.append('filename', filename)
    const data = await httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, ...UPLOAD_OPTS })
    return data.url || null
  } catch (e) {
    logger.warn('filesApi', '文本落盘 tasks 失败', e)
    return null
  }
}
