/**
 * 对话/消息渲染共用的图片 URL 判定与抽取（纯函数，AgentMessage 与 ChatMarkdown 共用）。
 *
 * 从 AgentMessage.tsx 抽离（原模块内函数），保证「图片判定/文本切图」逻辑单一真相，
 * 且 ChatMarkdown 渲染 Markdown 时能复用同一套图片规则（markdown 图片 / <img> / 裸 URL）。
 */

/** 直观判断：一个 URL 是否该渲染成图片。
 *  - 跳过临时协议：blob:/ipfs:/ipns:（持久化后必破图）
 *  - data: 只接受 data:image/
 *  - http(s)：带图片后缀(.png/.jpg…)直接渲染；无后缀则排除网页类后缀(.html/.json…)后渲染（兼容无后缀图床） */
export function isImageUrl(u: string): boolean {
  u = String(u || '').trim().toLowerCase()
  if (!u) return false
  if (/^(?:blob:|ipfs:|ipns:)/.test(u)) return false
  if (u.startsWith('data:')) return u.startsWith('data:image/')
  if (!/^https?:\/\//.test(u)) return false
  if (/\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#]|$)/.test(u)) return true
  return !/\.(?:html?|php|json|xml|css|js|mjs|txt|md|csv|pdf)(?:[?#]|$)/.test(u)
}

/** 从文本里按顺序找出所有「图片 URL 候选」及其位置（含 markdown ![]() 与 <img src>）。 */
export interface ImageSpan {
  url: string
  start: number
  end: number
}
export function extractImageSpans(text: string): ImageSpan[] {
  const spans: ImageSpan[] = []
  // 1) markdown 图片 ![](url) / ![alt](url)
  //    允许 url 内部包含一对括号 (…)，只在结尾的 ) 处闭合，避免含 ) 的签名链接被截断
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g)) {
    spans.push({ url: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
  }
  // 2) HTML <img src="url">
  for (const m of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    spans.push({ url: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
  }
  // 3) 裸链接：http(s)://… 或 data:image/…
  //    读到空白才停（不再遇 ) 即截断，保留 url 内部的 ) 与 ?query 参数）；
  //    尾随的中英文标点/括号/引号不属于 url，用非捕获组剥离；
  //    排除被 blob:/ipfs:/ipns: 协议前缀包裹的 URL（与 isImageUrl「临时协议不渲染」契约冲突）
  for (const m of text.matchAll(/(https?:\/\/[^\s]+?|data:image\/[^\s"]+?)(?:[)\]}'"，。、,!?；;]+)?(?=\s|$)/gi)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 5), m.index ?? 0)
    // 排除 blob:/ipfs:/ipns: 临时协议前缀（与 isImageUrl「临时协议不渲染」契约冲突）
    if (/^(?:blob:|ipfs:|ipns:)$/.test(before)) continue
    // 排除 markdown 链接目标 [text](url)：这种 URL 属于链接，不是图片，交给行内链接渲染
    if (before.endsWith('](')) continue
    spans.push({ url: m[1] ?? m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
  }
  // 去重 + 只保留真正是图片的 + 按出现顺序
  // 去重 key 用「纯 url」：markdown 与裸链接多处出现同一 url 只渲染一次（根治重复显示）
  const seen = new Set<string>()
  return spans
    .filter((s) => isImageUrl(s.url) && !seen.has(s.url) && seen.add(s.url))
    .sort((a, b) => a.start - b.start)
}
