/**
 * 参考图 URL 解析公共工具（图片/聊天/视频节点共用）。
 *
 * 为什么需要它：参考图可能有各种形式——http(s) / data: base64 / 裸 base64 / blob:。
 * apimart-gateway 的 resolve_attachments 能处理 http/data/裸base64 并自动转 CDN；
 * 唯独 blob: 是浏览器内临时地址，网关进程访问不到会丢弃。所以前端遇到 blob:
 * 必须先转成 data: base64 再发，保证任何参考图都能发出去。
 *
 * 参考网关：apimart-gateway/main.py resolve_attachments（L612-728）。
 */

/** 把单个 blob: URL 转成 data: base64（http/data 原样返回；失败返回空字符串丢弃）。 */
export async function resolveRefImageUrl(u) {
  if (typeof u !== 'string') return ''
  if (!u.startsWith('blob:')) return u
  try {
    const res = await fetch(u)
    const blob = await res.blob()
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('FileReader failed'))
      fr.readAsDataURL(blob)
    })
    return b64 // data:image/xxx;base64,...
  } catch (e) {
    console.warn(`[refImage] blob 参考图转换失败:`, e.message)
    return '' // 转换失败则丢弃该图
  }
}

/**
 * 把参考图 URL 数组统一解析成「网关可用的 URL 数组」。
 *  - 过滤空值；blob: 转 data: base64；其余原样。
 * @param {string[]} images
 * @returns {Promise<string[]>}
 */
export async function resolveRefImages(images) {
  const urls = (images || []).filter((u) => typeof u === 'string' && u)
  const out = []
  for (const u of urls) {
    const resolved = await resolveRefImageUrl(u)
    if (resolved) out.push(resolved)
  }
  return out
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
