/**
 * localTool 文件落盘（生成结果 → uploads/tasks 目录）。
 *
 * 复刻官方 H_.jsx 的 Ce.uploadFile：生成完成后把结果保存到 localTool 的 tasks 目录，
 * 使「生成」面板（读 uploads/tasks）能看到生成结果。
 *
 * 断档背景：节点生成成功只把 resultUrl 存进任务中心(SQLite)，未落盘 tasks 目录，
 * 导致生成面板空。这里补上落盘：data:/blob → multipart file；http → fileUrl(幂等下载)。
 */
import { API_BASE } from './apiBase.js'
const SUBFOLDER = 'tasks'

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
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${clean}_${ts}.${ext}`
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
      const res = await fetch(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd })
      if (!res.ok) {
        console.warn('[filesApi] data 落盘失败', res.status)
        return null
      }
      const data = await res.json().catch(() => ({}))
      return data.url || null
    }

    // http(s) 上游 url → fileUrl 幂等下载落盘
    const res = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl: url, subfolder: SUBFOLDER, filename: safeName('generated', ext) }),
    })
    if (!res.ok) {
      console.warn('[filesApi] fileUrl 落盘失败', res.status)
      return null
    }
    const data = await res.json().catch(() => ({}))
    return data.url || null
  } catch (e) {
    console.warn('[filesApi] 落盘 tasks 失败:', e)
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
  const safeName = (name || 'generated').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'generated'
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const filename = `${safeName}_${ts}.txt`
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const fd = new FormData()
    fd.append('file', blob, filename)
    fd.append('subfolder', SUBFOLDER)
    fd.append('filename', filename)
    const res = await fetch(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      console.warn('[filesApi] 文本落盘失败', res.status)
      return null
    }
    const data = await res.json().catch(() => ({}))
    return data.url || null
  } catch (e) {
    console.warn('[filesApi] 文本落盘 tasks 失败:', e)
    return null
  }
}
