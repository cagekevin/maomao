/**
 * 参考图 token 编解码（对齐大雄 agentEncodeRefToken / agentParseRefTokensFromText）。
 *
 * ── 它在整个架构里的位置（完整逻辑）──
 * fresh-task 下历史图不进 LLM 上下文，但「跨轮引用某张历史图」仍需机器可还原的载体。这套 token 机制
 * 就是那个载体：
 *   - 写入端：encodeRefToken 把一张图编码成自包含 token（人类可读前缀 + 机器可还原元信息）：
 *       [参考图1:name]{{agent-ref url="..." name="..." node="..." x=".." y=".."}}
 *   - 读取端：parseRefTokensFromText 从任意文本（历史/粘贴/渲染）反查还原原图，供执行层生图用。
 * 关键：token 只作为「文本引用」存在，图本体（二进制 URL）从不进 LLM 上下文——模型看到的是文字 token，
 *       生图时执行层用 token 反查原图 URL。这正是「跨轮图记忆」在表示层的实现。
 *
 * ── 与参考项目大雄（daxiong-canvas-plugins/canvas-agent）的差距对照（差距②表示层）──
 * 大雄：
 *   - agentEncodeRefToken（4686 行）：图 → token；
 *   - agentCollectKnownRefCatalog（4772 行）：收集全部历史 user 消息的图成全局目录；
 *   - agentParseRefTokensFromText（4698 行）：从历史文本反查 token → 还原原图（供执行层）。
 *   → 大雄 LLM 上下文里一张历史图都没有，靠 token + 执行层反查跨轮用图。
 * 我们（对齐前）：完全没有这层，历史图直接以原图 URL 堆进 LLM 上下文 → 造成「真图堆积 + 撞号」→ 全反推。
 * 我们（对齐后）：本文件实现 token 编解码；历史图仍不进 LLM 上下文，跨轮用图靠 execute_plan
 *   （useCanvasAgentTools.js）经 getCurrentImageMap / getLastGeneratedImages 反查。
 */
import type { RefImageAttrs, RefTokenNode, RefKnownImage } from '@/types'

/** 编码一张参考图成 token 文本（对齐大雄 agentEncodeRefToken）。
 *  url 为空返回 '' */
export function encodeRefToken(att: RefImageAttrs = {}): string {
  const url = String(att.url || '').trim()
  if (!url) return ''
  const name = String(att.name || att.label || 'image').trim() || 'image'
  const nodeId = String(att.nodeId || '')
  const x = Number(att.x) || 0
  const y = Number(att.y) || 0
  const idx = Number(att.refIndex) || 0
  const enc = (s: string) => encodeURIComponent(String(s ?? ''))
  return `[参考图${idx || 1}:${name}]{{agent-ref url="${enc(url)}" name="${enc(name)}" node="${enc(nodeId)}" x="${x}" y="${y}"}}`
}

/**
 * 从任意文本里解析 token，还原成节点数组。
 * 对齐大雄 agentParseRefTokensFromText：优先解析新格式 token；若文本含旧格式 [参考图N:name]，
 * 则需结合 knownRefCatalog（收集历史已知图）反查 url。这里只负责纯 token 解析，
 * 反查历史 catalog 由调用方传入 knownImages 完成（保持纯函数、可单测）。
 */
export function parseRefTokensFromText(text = '', knownImages: RefKnownImage[] = []): RefTokenNode[] {
  const raw = String(text || '')
  if (!raw) return []
  const nodes = []
  // 1) 新格式： [参考图1:name]{{agent-ref url="..." name="..." node="..." x=".." y=".."}}
  const re = /\[参考图\s*(\d+)\s*:\s*([^\]]*)\]\{\{agent-ref\s+url="([^"]*)"\s+name="([^"]*)"\s+node="([^"]*)"\s+x="([^"]*)"\s+y="([^"]*)"\}\}/g
  let last = 0
  let m
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) nodes.push({ type: 'text', text: raw.slice(last, m.index) })
    nodes.push({
      type: 'image',
      url: decodeURIComponent(m[3] || ''),
      name: decodeURIComponent(m[4] || m[2] || 'image') || 'image',
      nodeId: decodeURIComponent(m[5] || ''),
      x: Number(m[6]) || 0,
      y: Number(m[7]) || 0,
      refIndex: Number(m[1]) || 0,
    })
    last = m.index + m[0].length
  }
  if (last > 0) {
    if (last < raw.length) nodes.push({ type: 'text', text: raw.slice(last) })
    return nodes
  }
  // 2) 仅 token：{{agent-ref ...}}
  const re2 = /\{\{agent-ref\s+url="([^"]*)"\s+name="([^"]*)"\s+node="([^"]*)"\s+x="([^"]*)"\s+y="([^"]*)"\}\}/g
  last = 0
  while ((m = re2.exec(raw)) !== null) {
    if (m.index > last) nodes.push({ type: 'text', text: raw.slice(last, m.index) })
    nodes.push({
      type: 'image',
      url: decodeURIComponent(m[1] || ''),
      name: decodeURIComponent(m[2] || 'image') || 'image',
      nodeId: decodeURIComponent(m[3] || ''),
      x: Number(m[4]) || 0,
      y: Number(m[5]) || 0,
    })
    last = m.index + m[0].length
  }
  if (last > 0) {
    if (last < raw.length) nodes.push({ type: 'text', text: raw.slice(last) })
    return nodes
  }
  // 3) 旧格式 [参考图1:name]：结合 knownImages 反查 url
  if (/\[参考图\s*\d+\s*:/.test(raw) && Array.isArray(knownImages) && knownImages.length) {
    last = 0
    const re3 = /\[参考图\s*(\d+)\s*:\s*([^\]]*)\]/g
    while ((m = re3.exec(raw)) !== null) {
      if (m.index > last) nodes.push({ type: 'text', text: raw.slice(last, m.index) })
      const idx = Number(m[1]) || 0
      const name = String(m[2] || '').trim() || 'image'
      const hit = knownImages.find((c) => Number(c.refIndex) === idx)
        || knownImages.find((c) => c.name === name)
      if (hit?.url) {
        nodes.push({ type: 'image', url: hit.url, name: hit.name || name, nodeId: hit.nodeId || '', x: Number(hit.x) || 0, y: Number(hit.y) || 0, refIndex: idx })
      } else {
        nodes.push({ type: 'text', text: m[0] })
      }
      last = m.index + m[0].length
    }
    if (last < raw.length) nodes.push({ type: 'text', text: raw.slice(last) })
    if (nodes.some((n) => n.type === 'image')) return nodes
  }
  return []
}
