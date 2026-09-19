/**
 * 对话/消息渲染共用的图片 URL 判定与抽取（纯函数，AgentMessage 与 ChatMarkdown 共用）。
 *
 * 从 AgentMessage.tsx 抽离（原模块内函数），保证「图片判定/文本切图」逻辑单一真相，
 * 且 ChatMarkdown 渲染 Markdown 时能复用同一套图片规则（markdown 图片 / <img> / 裸 URL）。
 */
import { classifyAssetUrlKind } from '@/components/base/utils/media/assetType';

/**
 * 一个 URL 是否该在消息里**渲染成图片**。
 *
 * 【命名（TD-16-7 裁决 2026-09-16）】原名为 `isAssetUrl` —— 与 `base/utils/assetType.ts:119`
 * 的同名函数**契约完全不同**（那是「是否是可显示的资产 URL：http/data/blob」，本函数是
 * 「是否该当图片渲染：还要排除网页后缀/临时协议」）。同名异契约 = 真值源分裂的命名撞车陷阱
 * （读代码的人会以为它们是一回事）→ 改名 `looksLikeImageUrl` 以消歧。
 * **两者判据不同、不可合并**：本函数多出的「无后缀图床兼容 + 网页后缀排除」是**消息渲染域的判据**，
 * 底层「扩展名是否图片」已委托真值源 `classifyAssetUrlKind`（探测收口、判据分层）。
 *
 * 判据：
 *  - 跳过临时协议 blob:/ipfs:/ipns:（持久化后必破图）
 *  - data: 只接受 data:image/
 *  - http(s)：带图片后缀直接渲染；无后缀则排除网页类后缀后渲染（兼容无后缀图床）
 */
export function looksLikeImageUrl(u: string): boolean {
  u = String(u || '')
    .trim()
    .toLowerCase();
  if (!u) return false;
  if (/^(?:blob:|ipfs:|ipns:)/.test(u)) return false;
  if (u.startsWith('data:')) return u.startsWith('data:image/');
  if (!/^https?:\/\//.test(u)) return false;
  // 探测收口：是否「图片类扩展名」统一走真值源（EXT_KIND 全表，含 avif 等）
  if (classifyAssetUrlKind(u) === 'image') return true;
  // 无后缀：排除网页/文档类后缀后按图床处理（本域判据，真值源不表达）
  return !/\.(?:html?|php|json|xml|css|js|mjs|txt|md|csv|pdf)(?:[?#]|$)/.test(u);
}

/** 从文本里按顺序找出所有「图片 URL 候选」及其位置（含 markdown ![]() 与 <img src>）。 */
export interface ImageSpan {
  url: string;
  start: number;
  end: number;
}
export function extractImageSpans(text: string): ImageSpan[] {
  const spans: ImageSpan[] = [];
  // 1) markdown 图片 ![](url) / ![alt](url)
  //    允许 url 内部包含一对括号 (…)，只在结尾的 ) 处闭合，避免含 ) 的签名链接被截断
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g)) {
    spans.push({ url: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  // 2) HTML <img src="url">
  for (const m of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    spans.push({ url: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  // 3) 裸链接：http(s)://… 或 data:image/…
  //    读到空白才停（不再遇 ) 即截断，保留 url 内部的 ) 与 ?query 参数）；
  //    尾随的中英文标点/括号/引号不属于 url，用非捕获组剥离；
  //    排除被 blob:/ipfs:/ipns: 协议前缀包裹的 URL（与 looksLikeImageUrl「临时协议不渲染」契约冲突）
  for (const m of text.matchAll(
    /(https?:\/\/[^\s]+?|data:image\/[^\s"]+?)(?:[)\]}'"，。、,!?；;]+)?(?=\s|$)/gi,
  )) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 5), m.index ?? 0);
    // 排除 blob:/ipfs:/ipns: 临时协议前缀（与 looksLikeImageUrl「临时协议不渲染」契约冲突）
    if (/^(?:blob:|ipfs:|ipns:)$/.test(before)) continue;
    // 排除 markdown 链接目标 [text](url)：这种 URL 属于链接，不是图片，交给行内链接渲染
    if (before.endsWith('](')) continue;
    spans.push({ url: m[1] ?? m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  // 去重 + 只保留真正是图片的 + 按出现顺序
  // 去重 key 用「纯 url」：markdown 与裸链接多处出现同一 url 只渲染一次（根治重复显示）
  const seen = new Set<string>();
  return spans
    .filter((s) => looksLikeImageUrl(s.url) && !seen.has(s.url) && seen.add(s.url))
    .sort((a, b) => a.start - b.start);
}
