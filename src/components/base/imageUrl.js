/**
 * 统一图片 URL 归一化模块 —— 「前端图片形式统一」的唯一出口。
 * 参考图 URL 归一化唯一入口，refImage.js 已折叠至此。
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
import { useCallback } from 'react'
import { logger } from './logger.js'
import { httpRequest } from './httpClient.js'
import { API_BASE } from './config.js'
import { IMAGE_FETCH_TIMEOUT } from './config.js'
import { API_ENDPOINTS } from './contracts.js'
import { useAppSettings } from './appSettings.js'

/**
 * 相对 /files/ 路径 → 完整可访问 URL（对齐后端 resources.ts / base64Externalize 惯例）。
 */
export function toAbsoluteFileUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('/files/')) return `${API_BASE}${url}`
  return url
}

/** thumbnail format 白名单（与后端 SUPPORTED_THUMB_FORMATS 一致）：仅 Jimp 可编码格式，禁 webp。 */
const SUPPORTED_THUMB_FORMATS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'])

/**
 * 绝对本地文件 URL（含 API_BASE 前缀）→ 相对 /files/ 路径；非本地返回 null。
 * DB 里存的是绝对路径（http://127.0.0.1:18080/files/...），按需出图端点要的是相对 /files/ 形式，
 * 这里收口「绝对→相对」的还原，避免各组件手写正则。
 * @param {string} u
 * @returns {string|null}
 */
export function toRelativeFileUrl(u) {
  if (!u || typeof u !== 'string') return null
  if (u.startsWith('/files/')) return u
  const m = /^https?:\/\/[^/]+(\/files\/.*)$/.exec(u)
  return m ? m[1] : null
}

/**
 * 构造本地文件按需出图端点 URL（END P0：render 显示链路取小图）。
 *  - url 形如 /files/subfolder/name 或对应绝对地址（内部转为相对）；
 *  - format 缺省不传 → 后端沿用源扩展名；传 'webp' → 同尺寸 webp(quality80 默认)。
 *  - maxDim 缺省 640：足显常见节点框且解码位图远小于原图（治拖拽卡）可另传覆盖。
 * 幂等：同 url/maxDim/format 命中同一缩略图缓存文件，重复取图不重复渲染。
 * @param {string} url
 * @param {{ maxDim?: number, format?: string }} [opts]
 * @returns {string}
 */
export function buildThumbnailUrl(url, opts = {}) {
  const rel = toRelativeFileUrl(url)
  if (!rel) return toAbsoluteFileUrl(url) // 非本地文件，出图端点无法服务，回原图绝对地址
  const q = new URLSearchParams()
  q.set('url', rel)
  q.set('maxDim', String(opts.maxDim || 640))
  // 仅白名单格式才透传，webp 等 Jimp 无法编码的格式一律不传（防后端假 webp），由后端回退源扩展名
  if (opts.format && SUPPORTED_THUMB_FORMATS.has(opts.format.toLowerCase())) {
    q.set('format', opts.format.toLowerCase())
  }
  return `${API_BASE}${API_ENDPOINTS.fileThumbnail}?${q.toString()}`
}

/**
 * 前端图片「唯一出口」：显示与发送共用一个契约，scope 区分策略。
 *
 *  - scope='render'（显示）：本地文件 → 按需小图（前端只解码小位图，治全分辨率拖拽卡）；
 *    非本地（外部 http / data: / blob: / 裸 base64）→ 原样地址（出图端点无法服务，回退原图，绝不破图）。
 *  - scope='send'（发送/AI 生图）：一律原图绝对地址（发送需原尺寸保真，不缩图）。
 *
 * 格式：format 仅白名单（png/jpg/jpeg/gif/bmp/tiff）透传；webp 当前后端(Jimp 0.22)无法编码，
 * 统一钳制不产出，避免假 webp 与 MIME 错标。发送保真不引入压缩开关（见 docs/18 P2 决策）。
 *
 * 统一解析收口：/files/ 补全与「绝对→相对」均复用既有 toAbsoluteFileUrl / toRelativeFileUrl，
 * 组件不得再散写 URL 处理；新增显示/发送一律经本函数。
 * @param {string} url
 * @param {{ scope?: 'render'|'send', maxDim?: number, format?: string }} [opts]
 * @returns {string}
 */
export function resolveImageUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return url
  const scope = opts.scope || 'render'
  // thumbnail:false（设置里关掉「显示缩略图」）→ render 也回原图绝对地址，不按需出图
  if (scope === 'render' && opts.thumbnail !== false && toRelativeFileUrl(url)) {
    return buildThumbnailUrl(url, { maxDim: opts.maxDim, format: opts.format })
  }
  return toAbsoluteFileUrl(url)
}

/**
 * React hook：返回一个「显示地址解析器」`resolve(u)`，
 * 自动读取 app_settings.thumbnailOn（实时生效），关掉缩略图即回原图。
 * 在渲染内/循环内（如网格格元）直接调用 resolve(u) 即可，避免 hook 进循环。
 */
export function useRenderImageResolver() {
  const settings = useAppSettings()
  const thumbnail = settings.thumbnailOn !== false
  return useCallback(
    (u, extra) => resolveImageUrl(u, { scope: 'render', thumbnail, ...extra }),
    [thumbnail]
  )
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
    const res = await httpRequest(u, { timeoutMs: IMAGE_FETCH_TIMEOUT, retries: 0, parseJson: false })
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('FileReader failed'))
      fr.readAsDataURL(blob)
    })
  } catch (e) {
    logger.warn('imageUrl', 'blob 转 dataURL 失败', e.message)
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
    const res = await httpRequest(absolute, { timeoutMs: IMAGE_FETCH_TIMEOUT, retries: 0, parseJson: false })
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('FileReader failed'))
      fr.readAsDataURL(blob)
    })
  } catch (e) {
    logger.warn('imageUrl', 'URL 转 base64 失败', e.message)
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

/**
 * 把参考图 URL 数组转成网关 chat 契约的 messages 内容块：
 * [{ type: 'image_url', image_url: { url } }, ...]
 * 用于聊天消息让 AI 看图反推提示词。
 * @param {string[]} urls 已 normalize 的网关可用 URL
 */
export function toImageContentBlocks(urls) {
  return (urls || []).map((url) => ({ type: 'image_url', image_url: { url } }))
}
