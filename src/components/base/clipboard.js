/**
 * 剪贴板公共工具 —— 集中「复制 / 粘贴清洗」能力，供画布/节点/面板复用，消除各处重复实现。
 *
 * 覆盖：
 *  - copyImageToClipboard(url)：图片本身复制到剪贴板（image/png），可粘到其它软件
 *    对齐官方 Ei（H_.jsx:10044 canvas→toBlob）与 ImageBoxNode.copyImage。
 *  - copyText(text)：纯文本复制（clipboard.writeText）
 *  - sanitizePastedText(raw)：粘贴文本清洗 —— 丢弃所有样式/富文本残留，只留干净纯文本。
 *  - downloadUrl(url, filename)：下载文件（fetch blob → a.download）
 *  - downloadBlob(blob, filename)：直接下载已有 Blob（备份 JSON / 文本导出等）
 *
 * 说明：复制「节点组」走 App.jsx 的 copySelectedNodes（含连线关系，独立于本模块）；
 * 复制「链接」用 copyText 即可。
 */

import { logger } from './logger.js'

/**
 * 粘贴文本清洗（纯文本化）：把从剪贴板/富文本带过来的「样式与格式残留」全部丢弃，只留干净纯文本。
 * 覆盖场景：粘贴网页/表格/Word 内容时常见的一类脏字符与格式。
 *  - 零宽 / 不可见字符（BOM、零宽空格、软连字符、LRM/RLM 等）
 *  - 控制字符（C0 控制区，保留换行符）
 *  - 统一换行（\r\n → \n）
 *  - 表格 Tab 分隔 → 单个空格；连续空格 → 单个空格
 *  - 压缩多余空行（3+ 个换行 → 2 个）
 * @param {string} raw 原始文本
 * @returns {string} 清洗后的纯文本
 */
export function sanitizePastedText(raw) {
  if (!raw) return ''
  return String(raw)
    // 去零宽 / 软连字符 / BOM / LRM / RLM 等不可见字符
    .replace(/[\u200b\ufeff\u00ad\u200e\u200f\u2060]/g, '')
    // 去 C0 控制字符（保留 \n 换行 0x0a 与 \t 由下一步统一处理）
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    // 统一换行
    .replace(/\r\n?/g, '\n')
    // 表格 Tab 分隔 → 空格
    .replace(/\t+/g, ' ')
    // 连续空格（含全角空格）→ 单个半角空格
    .replace(/[ \u3000]+/g, ' ')
    // 行首/行尾多余空格
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n[ ]+/g, '\n')
    // 压缩多余空行
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
    logger.warn('clipboard', '复制图片失败（canvas 跨域等）', e?.message)
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

/** 下载已有 Blob（a.download）。返回 { ok, msg }。所有 a.download 下载统一走这里。 */
export async function downloadBlob(blob, filename) {
  if (!blob) return { ok: false, msg: '没有可下载的内容' }
  try {
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
    logger.warn('clipboard', '下载失败', e?.message)
    return { ok: false, msg: '下载失败' }
  }
}

/** 下载文件（fetch blob → a.download）。返回 { ok, msg }。 */
export async function downloadUrl(url, filename) {
  if (!url) return { ok: false, msg: '没有可下载的内容' }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await downloadBlob(blob, filename)
  } catch (e) {
    logger.warn('clipboard', '下载失败', e?.message)
    return { ok: false, msg: '下载失败' }
  }
}
