/**
 * AI 聊天模型配置层。
 * 记录「AI 助手聊天」用哪个供应商的哪个模型（全局应用偏好，与具体供应商编辑无关）。
 *
 * 存储：localStorage（storageAdapter），键 agent_chat_model，
 * 值 { providerId, modelId, streamMode }。
 * - streamMode: 'stream'（流式，默认）| 'non-stream'（非流式，仅支持普通 JSON 响应的模型/API）
 * 与 agent_input_mode / agent_panel_width 等前端偏好一致，轻量即时，无需网络。
 */
import { contentGet, contentSet } from '../contentStore.js'

export const AGENT_CHAT_MODEL_KEY = 'agent_chat_model'

export function loadAgentChatModel() {
  try {
    const parsed = contentGet(AGENT_CHAT_MODEL_KEY)
    if (parsed && typeof parsed === 'object' && parsed.providerId && parsed.modelId) {
      return {
        providerId: parsed.providerId,
        modelId: parsed.modelId,
        // 非流式标注：仅当显式存了 'non-stream' 才生效，否则默认流式（向后兼容旧配置）
        streamMode: parsed.streamMode === 'non-stream' ? 'non-stream' : 'stream',
      }
    }
  } catch { /* 忽略损坏数据 */ }
  return null
}

export function saveAgentChatModel(cfg) {
  try {
    const cur = loadAgentChatModel() || {}
    contentSet(AGENT_CHAT_MODEL_KEY, {
      providerId: cfg?.providerId ?? cur.providerId ?? '',
      modelId: cfg?.modelId ?? cur.modelId ?? '',
      streamMode: cfg?.streamMode ?? cur.streamMode ?? 'stream',
    })
  } catch { /* 忽略 */ }
}
