/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 跨轮图数据源（E 类：AI 图生图反查）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationStore.js 拆出的 E 类职能：跨轮图记忆三数据源，
 * 供执行层 / 发送层反查历史图并统一编号。依赖单向指向 conversationState 底座 + conversationSnapshot。
 * 命名/导出不变，消费方无感知。
 * ════════════════════════════════════════════════════════════════
 */
import { getActiveConv } from './conversationState.js'
import { getCurrentSnapshot } from './conversationSnapshot.js'

/** 向前找当前对话里最近一条带图 user 消息，返回其参考图 url 数组（对齐大雄 agentLastUserAttachments）。 */
export function getLastUserReferenceImages() {
  const conv = getActiveConv()
  const msgs = conv?.messages || []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const imgs = Array.isArray(m.attachments) ? m.attachments.filter((a) => a && a.url) : []
    if (imgs.length > 0) return imgs.map((a) => a.url).filter(Boolean)
  }
  return []
}

/** 【对齐大雄 agentLastResults】向前找当前对话里最近一条带生成结果图的 assistant 消息，返回其结果图数组。
 *  结果图来自 execute_plan 成功回填到 assistant 消息的 lastResults（useAgentChat.runToolCalls 回填）。
 *  ⚠️ 消费方：只有 getCurrentImageMap() 用它做「图1~图M」编号供 direct_refs 引用，execute_plan **不直接
 *  调用它自动挂历史生成图**——对齐大雄 use_last_outputs=false「跨轮 lastResults 彻底关闭」，只有 LLM
 *  用 direct_refs 显式引用历史图时才用。图本体不进 LLM 上下文，执行层反查原图 url。 */
export function getLastGeneratedImages() {
  const conv = getActiveConv()
  const msgs = conv?.messages || []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role !== 'assistant') continue
    const lr = Array.isArray(m.lastResults) ? m.lastResults.filter((r) => r && r.url) : []
    if (lr.length > 0) return lr
  }
  return []
}

/** 【对齐大雄 agentCurrentImageMap】统一编号映射：上一轮生成图(图1~图M) + 当前附件(图M+1~图M+N)。
 *  返回 [{ num, url, name, source:'gen'|'att' }]。**两个消费方**（改前必读）：
 *   ① 执行层：execute_plan（useCanvasAgentTools.js）用它把 direct_refs 的 url 反查成「图N」，翻译 prompt 里的「图N」；
 *   ② 发送层：useAgentChat.send 把它传给 buildRequestMessages 的 imageCatalog，注入 LLM（「当前可引用的图」），
 *      让 LLM 在 generations 里能用「图N」+ direct_refs 精确引用历史图/上一轮生成图（图本体不进 LLM 上下文）。
 *  数据源：上一轮生成图来自 getLastGeneratedImages()（assistant 消息的 lastResults，由 useAgentChat 在
 *  execute_plan 成功后回填）；当前附件来自 getCurrentSnapshot().attachments。 */
export function getCurrentImageMap() {
  const genResults = getLastGeneratedImages()
  const attachments = getCurrentSnapshot().attachments || []
  const map = []
  genResults.forEach((r, i) => map.push({ num: i + 1, url: r.url, name: r.name || `图${i + 1}`, source: 'gen' }))
  const offset = genResults.length
  attachments.filter((a) => a && a.url).forEach((a, i) => map.push({ num: offset + i + 1, url: a.url, name: a.name || a.label || `图${offset + i + 1}`, source: 'att' }))
  return map
}