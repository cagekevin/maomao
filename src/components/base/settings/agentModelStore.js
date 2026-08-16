/**
 * AI 聊天模型配置层。
 * 记录「AI 助手聊天」用哪个供应商的哪个模型（全局应用偏好，与具体供应商编辑无关）。
 *
 * 存储：localStorage（storageAdapter），键 agent_chat_model，值 { providerId, modelId }。
 * 与 agent_input_mode / agent_panel_width 等前端偏好一致，轻量即时，无需网络。
 */
import { sGet, sSet } from '../storageAdapter.js'

export const AGENT_CHAT_MODEL_KEY = 'agent_chat_model'

export function loadAgentChatModel() {
  try {
    const raw = sGet(AGENT_CHAT_MODEL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.providerId && parsed.modelId) {
      return { providerId: parsed.providerId, modelId: parsed.modelId }
    }
  } catch { /* 忽略损坏数据 */ }
  return null
}

export function saveAgentChatModel(cfg) {
  try {
    sSet(AGENT_CHAT_MODEL_KEY, JSON.stringify({ providerId: cfg?.providerId || '', modelId: cfg?.modelId || '' }))
  } catch { /* 忽略 */ }
}
