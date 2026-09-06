/**
 * AI 聊天模型配置层。
 * 记录「AI 助手聊天」用哪个供应商的哪个模型（全局应用偏好，与具体供应商编辑无关）。
 *
 * 存储：localStorage（storageAdapter），键 agent_chat_model，
 * 值 { providerId, modelId, streamMode }。
 * - streamMode: 'stream'（流式，默认）| 'non-stream'（非流式，仅支持普通 JSON 响应的模型/API）
 * 与 agent_input_mode / agent_panel_width 等前端偏好一致，轻量即时，无需网络。
 */
import { contentGet, contentSet } from '../core/contentStore.ts';

export const AGENT_CHAT_MODEL_KEY = 'agent_chat_model';

/** 流式模式：'stream' 流式（默认） | 'non-stream' 非流式（仅普通 JSON 响应的模型/API） */
export type AgentStreamMode = 'stream' | 'non-stream';

/** AI 聊天模型配置（providerId + modelId + streamMode） */
export interface AgentChatModelConfig {
  providerId: string;
  modelId: string;
  streamMode: AgentStreamMode;
}

export function loadAgentChatModel(): AgentChatModelConfig | null {
  try {
    // contentGet 返回 unknown（存储值不可信），按 AgentChatModelConfig 收窄后再取字段
    const parsed = contentGet(AGENT_CHAT_MODEL_KEY) as Partial<AgentChatModelConfig> | null;
    if (parsed && typeof parsed === 'object' && parsed.providerId && parsed.modelId) {
      return {
        providerId: parsed.providerId,
        modelId: parsed.modelId,
        // 非流式标注：仅当显式存了 'non-stream' 才生效，否则默认流式（向后兼容旧配置）
        streamMode: parsed.streamMode === 'non-stream' ? 'non-stream' : 'stream',
      };
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return null;
}

export function saveAgentChatModel(cfg?: Partial<AgentChatModelConfig>): void {
  try {
    const cur: Partial<AgentChatModelConfig> = loadAgentChatModel() || {};
    contentSet(AGENT_CHAT_MODEL_KEY, {
      providerId: cfg?.providerId ?? cur.providerId ?? '',
      modelId: cfg?.modelId ?? cur.modelId ?? '',
      streamMode: cfg?.streamMode ?? cur.streamMode ?? 'stream',
    });
  } catch {
    /* 忽略 */
  }
}

// ── 历史回传轮数（过渡方案·2026-08-18）──
// 独立配置键，与聊天模型解耦（用户不配模型也能设）。
// 语义（buildRequestMessages 第 7 参 historyTurns）：
//   0          = 不回传历史文字（严格 fresh-task，只发本轮）；
//   1          = 只回传上一轮文字；
//   N（任意正） = 回传最近 N 轮文字（N≥消息总量时≈不限，buildRequestMessages 会自动回溯到最早）。
// 图片永远编号化（imageCatalog 图N）不内联，不破坏「反推图一却全反推」安全底线。
export const AGENT_HISTORY_TURNS_KEY = 'agent_history_turns';
export const AGENT_HISTORY_TURNS_DEFAULT = 6; // 默认回传最近 6 轮

/** 读历史回传轮数：合法返回非负整数；异常/非法回退默认 6。 */
export function loadAgentHistoryTurns(): number {
  try {
    const raw = contentGet(AGENT_HISTORY_TURNS_KEY);
    if (raw === undefined || raw === null || raw === '') return AGENT_HISTORY_TURNS_DEFAULT;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n); // 支持 0、任意非负整数（含大值≈不限）
  } catch {
    /* 忽略损坏数据 */
  }
  return AGENT_HISTORY_TURNS_DEFAULT;
}

/** 写历史回传轮数（非负整数；非法输入忽略）。 */
export function saveAgentHistoryTurns(n: number | string): void {
  try {
    const v = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(v) || v < 0) return;
    contentSet(AGENT_HISTORY_TURNS_KEY, Math.floor(v));
  } catch {
    /* 忽略 */
  }
}
