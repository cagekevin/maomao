/**
 * 统一图片 URL 归一化模块 —— 「前端图片形式统一」的唯一出口。
 *
 * 背景：前端图片 URL 有 4 种形式——绝对 http(s) / data: base64 / blob: / 相对 /files/。
 * 若不统一：
 *  - 渲染端：相对 /files/ 在画布环境（localhost:5180）解析成错误源 → 破图；
 *  - 发送端：blob:（浏览器临时地址）/ 相对路径，后端网关访问不到 → 丢图。
 *
 * 因此所有「图片 URL 出口」（渲染、发送、存储）应统一经过本模块，保证：
 *  - 渲染用 normalizeImageUrl → 相对补全成绝对，前端不破图；
 *  - 发送用 normalizeImageUrlForSend → blob 转 data、相对补全成绝对，后端不丢图。
 *
 * 收敛原则：任何新增节点/面板要显示或发送图片，一律用这里，不各写各的 URL 处理。
 */
import { API_BASE } from './apiBase.js'

/** 相对 /files/ 路径 → 完整可访问 URL（对齐后端 resources.ts / base64Externalize 惯例）。 */
export function toAbsoluteFileUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('/files/')) return `${API_BASE}${url}`
  return url
}

/**
 * 渲染端归一化：把任意图片 URL 补全成「可被 <img> 直接加载」的地址。
 *  - /files/ 相对 → 补全为绝对 http；
 *  - data: / http(s) / blob: / 裸 base64 → 原样（浏览器可直接显示）。
 * @param {string} url
 * @returns {string}
 */
export function normalizeImageUrl(url) {
  return toAbsoluteFileUrl(url)
}

/**
 * 把单个 blob: URL 转成 data: base64（发送给后端用）。
 *  http/data/裸base64 原样返回；失败返回空字符串（调用方丢弃该图）。
 * @param {string} u
 * @returns {Promise<string>}
 */
export async function blobToDataUrl(u) {
  try {
    const res = await fetch(u)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('FileReader failed'))
      fr.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn(`[imageUrl] blob 转 dataURL 失败:`, e.message)
    return ''
  }
}

/**
 * 把任意 URL（http(s) / blob / /files/ 相对）拉取并转成 data: base64。
 * 用于「只认 base64 的后端」（refFormat: 'base64' 场景）。失败返回空字符串。
 * 注：http(s) 外网 URL 受 CORS 限制可能拉取失败；同源 localTool 没问题。
 * @param {string} u 需要转 base64 的图片地址
 * @returns {Promise<string>} data:image/...;base64,xxx 或空字符串
 */
export async function urlToDataUrl(u) {
  if (typeof u !== 'string' || !u) return ''
  if (u.startsWith('data:')) return u // 已是 base64，直接返回
  const absolute = toAbsoluteFileUrl(u) // 相对 /files/ 先补全
  try {
    const res = await fetch(absolute)
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('FileReader failed'))
      fr.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn(`[imageUrl] URL 转 base64 失败:`, e.message)
    return ''
  }
}

/**
 * 发送端归一化（单个图）：统一成「后端网关可访问」的地址。
 *
 * 默认（preferBase64=false，走网关场景）：
 *  - /files/ 相对 → 补全为绝对 http（否则网关访问不到）→ 最优先
 *  - blob: → 转 data: base64（浏览器临时地址，网关访问不到）
 *  - data: / http(s) / 裸 base64 → 原样（网关 resolve_attachments 可处理）
 *
 * preferBase64=true（未来「只认 base64 的后端」，provider 配置 refFormat:'base64'）：
 *  - 所有参考图（含 http(s) / /files/ / blob）统一转成 data: base64 再发。
 *
 * @param {string} u
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function normalizeImageUrlForSend(u, opts = {}) {
  if (typeof u !== 'string') return ''
  if (opts.preferBase64) {
    // 只认 base64 的后端：任何形式都转 base64（data: 已是 base64 原样返回）
    return urlToDataUrl(u)
  }
  if (u.startsWith('/files/')) return toAbsoluteFileUrl(u)
  if (!u.startsWith('blob:')) return u
  return blobToDataUrl(u)
}

/**
 * 发送端归一化（图片数组）：逐个过 normalizeImageUrlForSend，过滤空值。
 * @param {Array<string>} images
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string[]>}
 */
export async function normalizeImageUrlsForSend(images, opts = {}) {
  const urls = (images || []).filter((u) => typeof u === 'string' && u)
  const out = []
  for (const u of urls) {
    const resolved = await normalizeImageUrlForSend(u, opts)
    if (resolved) out.push(resolved)
  }
  return out
}
