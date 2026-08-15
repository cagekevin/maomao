/**
 * 参考图 URL 解析公共工具（图片/聊天/视频节点共用）——「前端发送给后端」的统一出口。
 *
 * 为什么需要它：参考图可能有各种形式——http(s) / data: base64 / 裸 base64 / blob: / 相对 /files/。
 * apimart-gateway 的 resolve_attachments 能处理 http/data/裸base64 并自动转 CDN；
 * 但有两类浏览器/网关无法直接访问的地址，前端必须在发送前统一处理，否则后端拿不到图 → 丢图：
 *   - blob:  —— 浏览器内临时地址，网关进程访问不到，必须转成 data: base64；
 *   - /files/ —— 相对路径，网关会解析成它自己的 /files/，访问不到，必须补全为绝对 http URL
 *               （对应本项目的 localTool 绝对地址，如 http://127.0.0.1:18080/files/...）。
 *
 * 所有发送链路的图片（imageApi 图生图 / chatApi 聊天 / videoApi 生视频）都汇聚到 resolveRefImages，
 * 因此这里是「前端→后端」参考图的唯一统一入口。底层逻辑已收敛到 imageUrl.js
 * （normalizeImageUrlForSend / normalizeImageUrlsForSend），此处保持兼容导出。
 *
 * 参考网关：apimart-gateway/main.py resolve_attachments（L612-728）。
 */
import { normalizeImageUrlForSend, normalizeImageUrlsForSend } from './imageUrl.js'

/**
 * 把单个参考图 URL 统一成「后端可访问」的 URL。
 * 底层见 imageUrl.normalizeImageUrlForSend：
 *  - 默认（走网关）：blob→data、相对→绝对、data/http 原样；
 *  - preferBase64=true：任何形式统一转 base64（适配只认 base64 的后端）。
 */
export async function resolveRefImageUrl(u, opts = {}) {
  return normalizeImageUrlForSend(u, opts)
}

/**
 * 把参考图 URL 数组统一解析成「后端可用的 URL 数组」。
 * 底层见 imageUrl.normalizeImageUrlsForSend（过滤空值 + 逐个归一化）。
 * @param {Array<string>} images
 * @param {{ preferBase64?: boolean }} [opts] preferBase64=true → 全部转 base64
 */
export async function resolveRefImages(images, opts = {}) {
  return normalizeImageUrlsForSend(images, opts)
}

/**
 * 把参考图 URL 数组转成网关 chat 契约的 messages 内容块：
 * [{ type: 'image_url', image_url: { url } }, ...]
 * 用于文本节点（聊天）让 AI 看图反推提示词。
 * @param {string[]} urls 已 resolve 的网关可用 URL
 */
export function toImageContentBlocks(urls) {
  return (urls || []).map((url) => ({ type: 'image_url', image_url: { url } }))
}
