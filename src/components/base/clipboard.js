/**
 * 剪贴板公共工具 —— 集中「复制」能力，供画布/节点/面板复用，消除各处重复实现。
 *
 * 覆盖：
 *  - copyImageToClipboard(url)：图片本身复制到剪贴板（image/png），可粘到其它软件
 *    对齐官方 Ei（H_.jsx:10044 canvas→toBlob）与 ImageBoxNode.copyImage。
 *  - copyText(text)：纯文本复制（clipboard.writeText）
 *  - downloadUrl(url, filename)：下载文件（fetch blob → a.download）
 *
 * 说明：复制「节点组」走 App.jsx 的 copySelectedNodes（含连线关系，独立于本模块）；
 * 复制「链接」用 copyText 即可。
 */

/** 把图片 URL 复制成 image/png 到剪贴板。返回 { ok, msg }，调用方负责 toast。 */
export async function copyImageToClipboard(url) {
  if (!url) return { ok: false, msg: '没有图片可复制' }
  try {
    // 画布绘制 → toBlob PNG → 写剪贴板（对齐官方 Ei:10049-10079）
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('Could not get blob')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return { ok: true, msg: '图片已复制，可在画布或其它软件中粘贴' }
  } catch (e) {
    console.warn('[clipboard] 复制图片失败（canvas 跨域等）:', e?.message)
    // 退化为复制链接（对齐官方 fallback 思路）
    try {
      await navigator.clipboard.writeText(url)
      return { ok: true, msg: '图片链接已复制（直接复制图片失败）' }
    } catch {
      return { ok: false, msg: '复制失败，可能因跨域或权限限制' }
    }
  }
}

/** 复制纯文本到剪贴板。返回 { ok, msg }。 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    return { ok: true, msg: '已复制' }
  } catch {
    return { ok: false, msg: '复制失败，请检查浏览器权限' }
  }
}

/** 下载文件（fetch blob → a.download）。返回 { ok, msg }。 */
export async function downloadUrl(url, filename) {
  if (!url) return { ok: false, msg: '没有可下载的内容' }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objUrl)
    return { ok: true, msg: '已开始下载' }
  } catch (e) {
    console.warn('[clipboard] 下载失败:', e?.message)
    return { ok: false, msg: '下载失败' }
  }
}
