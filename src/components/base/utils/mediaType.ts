/**
 * 媒体类型判断工具（复刻官方 xi.jsx:30-48 的类型判定 / H_.jsx onDrop 的文件类型判定）。
 *
 * 【为什么抽成工具】
 * 图片节点（ImageNode 判断内容态）、画布拖入/粘贴（App.createNodeFromFile 判断文件类型）
 * 各自写了一套正则，容易漏扩展名、改一处漏一处。统一收敛到此，新增媒体格式只改这里。
 *
 * 类型约定（对齐官方 xi.jsx / ImageNode）：
 *  - image / video / audio / text / other / empty
 *  - other：非以上类型的文件（如压缩包）；empty：无 URL/文件
 */
import type { MediaType } from '@/types'

// 媒体扩展名正则（不含点）
const RE_VIDEO = /\.(mp4|webm|mov|mkv|avi|m4v)$/i
const RE_AUDIO = /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)$/i
const RE_IMAGE = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i
const RE_TEXT = /\.(txt|md|json|csv)$/i

/**
 * 判断一个 URL（dataURL / http / 文件名）的媒体类型。
 * 优先看 dataURL 前缀（如 data:video/），其次看扩展名。
 */
export function detectMediaType(url: string | null | undefined): MediaType {
  if (!url) return 'empty'
  const lower = String(url).toLowerCase()
  if (lower.startsWith('data:video/') || RE_VIDEO.test(lower)) return 'video'
  if (lower.startsWith('data:audio/') || RE_AUDIO.test(lower)) return 'audio'
  if (lower.startsWith('data:text/') || RE_TEXT.test(lower)) return 'text'
  return 'image' // data:image / http 图片 / 其它 URL 默认按图片
}

/**
 * 判断一个 File 的媒体类型（拖入/上传用）。
 */
export function detectFileType(file: File | null | undefined): MediaType {
  if (!file) return 'other'
  const type = file.type || ''
  const name = (file.name || '').toLowerCase()
  if (type.startsWith('image/') || RE_IMAGE.test(name)) return 'image'
  if (type.startsWith('video/') || RE_VIDEO.test(name)) return 'video'
  if (type.startsWith('audio/') || RE_AUDIO.test(name)) return 'audio'
  if (type.startsWith('text/') || RE_TEXT.test(name)) return 'text'
  return 'other'
}

/**
 * 判断一个 URL 是否「可作图片源显示」：dataURL / http(s) / blob。
 * 用于拖入 URL 文本时决定建 imageNode 还是 textNode。
 */
export function isAssetUrl(url: unknown): url is string {
  return typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
}

/**
 * 判断是否为音频素材（type 字段或 URL 扩展名）。
 * 收敛 AssetLibrary / GeneratedView 各自重复的实现，统一放这里。
 * @param type 素材 type（如 'audio'）
 * @param url 素材 URL（按扩展名兜底）
 */
export function isAudio(type: string | null | undefined, url: string | null | undefined): boolean {
  return type === 'audio' || (!!type && type.startsWith('audio')) || /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(url || '')
}
