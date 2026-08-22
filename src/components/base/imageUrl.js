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
import { compressImage } from './imageCompress.js'

/** 发送给 AI 的图片最长边上限（超过则前端压缩到该尺寸内，避免接口尺寸/体积限制） */
export const MAX_SEND_DIM = 1920

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
 * 发送侧防御：把「缩略图端点 URL」还原成其背后对应的原图片地址。
 *
 * 背景：显示侧（scope='render'）会把本地图转换成 `/api/files/thumbnail?url=...&maxDim=640` 端点，
 * 该 URL 是**小图**且仅供前端 `<img>` 显示。若历史上某处误把 render 结果当参考图塞进发送，网关会
 * 收到缩略图端点（可能 404 或拿到小图/糊图）→ 参考图丢失。这是「发送带缩略图」的系统性隐患。
 *
 * 契约：发送侧禁止携带任何缩略图端点 URL。本函数遇到此类 URL：
 *  1. 解析其 `query.url`（相对 /files/ 原图路径）；
 *  2. 还原并补全为**原图绝对地址**（真实原始图片），保证发送的一律是原图；
 *  3. 无法还原（无 url 参数 / 非法）→ 返回空串，由调用方丢弃该图（不静默发坏图）。
 *
 * 状态归属：这是图片 URL 归一化领域内的「发送统一出口守卫」，与 render 出口（buildThumbnailUrl）
 * 对称、互斥。新增节点要发图片一律经此，禁止绕过。
 * @param {string} u 可能是缩略图端点的 URL
 * @returns {string} 原图绝对地址；无法还原返回 ''
 */
function thumbnailToOriginal(u) {
  if (typeof u !== 'string' || !u) return ''
  const qIndex = u.indexOf('?')
  if (qIndex === -1) return ''
  // 仅当确实命中缩略图端点路径才处理（避免误拆普通带 query 的原图 URL）。
  const path = u.slice(0, qIndex)
  if (!/\/files\/thumbnail$/.test(path)) return ''
  const rel = new URLSearchParams(u.slice(qIndex + 1)).get('url')
  if (!rel) return ''
  return toAbsoluteFileUrl(rel)
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
 * 本地 File/Blob → data: base64（发送附件用）。
 * 收口：FileReader 的 dataURL 转换统一在此，各面板不得散写 FileReader。
 * 与 blobToDataUrl（网络 blob→data）语义互补：一个收本地 File、一个收 URL。
 * @param {Blob|File} file
 * @returns {Promise<string>} data:...;base64,xxx
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(new Error('FileReader failed'))
    fr.readAsDataURL(file)
  })
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
 * 发送端归一化（单个图）：统一成「后端网关可访问」的地址，并对本地图做「最长边 ≤1920」压缩。
 *
 * 规则（2026-08 定契约）：
 *  - 本地图（/files/ 相对、blob:、data: base64）→ 先压缩到最长边 ≤ MAX_SEND_DIM(1920)、保持原格式，
 *    再转 data: base64 内嵌（网关 resolve_attachments 解析 base64 → 上传 CDN，不依赖访问本地 127.0.0.1）。
 *  - 公网图（http/https）→ 不压缩（AI 可直接访问，且受 CORS 限制压缩不可靠），原样透传。
 *  - preferBase64=true（只认 base64 的后端）→ 本地图已压缩转 base64；公网图保持原尺寸转 base64（不压缩）。
 *  - 压缩失败（跨域/格式异常）→ 回退原逻辑，失败可见（logger 记录）但不阻断发送，避免丢图。
 *
 * @param {string} u
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function normalizeImageUrlForSend(u, opts = {}) {
  if (typeof u !== 'string') return ''
  // 发送侧硬契约：禁止发送缩略图端点 URL。若误入 render 结果，先还原回原图再走后续归一。
  const original = thumbnailToOriginal(u)
  if (original) u = original

  // 判定「本地可压缩图」：/files/ 相对、blob:、data:、以及绝对 http 但指向本地文件（可还原为 /files/，如缩略图还原结果）。
  // 其余绝对 http(s) = 公网图（AI 可直接访问，且受 CORS 限制压缩不可靠 → 不压缩）。
  const isLocal = u.startsWith('/files/') || u.startsWith('blob:') || u.startsWith('data:') || !!toRelativeFileUrl(u)
  if (!isLocal) {
    // 公网图：不压缩。按 preferBase64 决定是否转 base64（保持原尺寸）。
    if (opts.preferBase64) return urlToDataUrl(u)
    return u
  }

  // 本地图：压缩到 ≤1920 保持原格式 → base64（网关 resolve_attachments 解析 base64 → 上传 CDN）。
  // 压缩结果即 dataUrl，无论 preferBase64 与否都返回 base64。
  const compressable = u.startsWith('/files/') ? toAbsoluteFileUrl(u) : u
  try {
    const { dataUrl } = await compressImage(compressable, { maxSize: MAX_SEND_DIM, keepOriginalFormat: true })
    if (dataUrl) return dataUrl
  } catch (e) {
    logger.warn('imageUrl', '发送前压缩失败，回退原样发送', { url: String(u).slice(0, 80), error: e?.message })
  }

  // 压缩失败 / 无结果 → 回退原逻辑（/files/ 补全绝对、blob 转 base64、data 原样）。
  if (u.startsWith('/files/')) return toAbsoluteFileUrl(u)
  if (u.startsWith('blob:')) return blobToDataUrl(u)
  if (u.startsWith('data:') || opts.preferBase64) return urlToDataUrl(u)
  return u
}

/**
 * 发送端归一化（图片数组）：逐个过 normalizeImageUrlForSend，过滤空值。
 * @param {Array<string>} images
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string[]>}
 */
export async function normalizeImageUrlsForSend(images, opts = {}) {
  const urls = (images || []).filter((u) => typeof u === 'string' && u)
  // 【带图可观测】发送前记录本次带了几张图、每张是 URL 还是 Base64（基于原始输入，不携带图片内容）。
  // 统一收口在发送归一化出口：覆盖生图/文本/视频/AI 聊天全部带图发送路径，一处埋点全链路可 grep。
  if (urls.length > 0) {
    logger.info('imageUrl', '发送图片', { ...summarizeImages(urls), total: urls.length })
  }
  // 多图并行压缩/归一化（Promise.all），避免多张图串行累积等待（本地图压缩耗时集中在 canvas 解码）。
  const results = await Promise.all(urls.map((u) => normalizeImageUrlForSend(u, opts)))
  return results.filter(Boolean)
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

/**
 * 图片形态分类（可观测用）：发送的图片是 URL 还是 Base64。
 *  - 'data:' 前缀 → 'base64'（内联 base64）
 *  - 其余（http/https/blob://files/ 等）→ 'url'
 * 用于发送出口日志，让「带图不可观测」变得可观测——不记图片内容，只记形态。
 * @param {string} url
 * @returns {'url'|'base64'}
 */
export function classifyImageType(url) {
  return typeof url === 'string' && url.startsWith('data:') ? 'base64' : 'url'
}

/**
 * 图片形态摘要（发送出口日志用）：把一组原始图片 URL 归成「几张 URL / 几张 Base64」。
 * 返回 { count, urls, base64s }，不携带图片内容，仅用于排障可观测。
 * @param {Array<string>} images 原始图片 URL 数组
 * @returns {{ count:number, urls:number, base64s:number }}
 */
export function summarizeImages(images) {
  const list = (images || []).filter((u) => typeof u === 'string' && u)
  let urls = 0
  let base64s = 0
  for (const u of list) {
    if (classifyImageType(u) === 'base64') base64s++
    else urls++
  }
  return { count: list.length, urls, base64s }
}
