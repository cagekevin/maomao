/**
 * AI 聊天模型配置层。
 * 记录「AI 助手聊天」用哪个供应商的哪个模型（全局应用偏好，与具体供应商编辑无关）。
 *
 * 存储：localStorage（storageAdapter），键 agent_chat_model，
 * 值 { providerId, modelId, streamMode }。
 * - streamMode: 'stream'（流式，默认）| 'non-stream'（非流式，仅支持普通 JSON 响应的模型/API）
 * 与 agent_input_mode / agent_panel_width 等前端偏好一致，轻量即时，无需网络。
 */
import { contentGet, contentSet } from '@/components/base/core/contentStore';
import { confirmPersist } from '@/components/base/core/degrade';
// 键名真源 = contracts.ts（TD-13-7 收口：本模块不再自持第二份键字面量）
import { KEY_AGENT_CHAT_MODEL, KEY_AGENT_HISTORY_TURNS } from '@/components/base/core/contracts';

/** 值 = contracts 真源（re-export 让既有消费方零改动） */
export const AGENT_CHAT_MODEL_KEY = KEY_AGENT_CHAT_MODEL;

/** 流式模式：'stream' 流式（默认） | 'non-stream' 非流式（仅普通 JSON 响应的模型/API） */
export type AgentStreamMode = 'stream' | 'non-stream';

/** AI 聊天模型配置（providerId + modelId + streamMode） */
export interface AgentChatModelConfig {
  providerId: string;
  modelId: string;
  streamMode: AgentStreamMode;
}

export function loadAgentChatModel(): AgentChatModelConfig | null {
  // 【消费者不越权 · 2026-09-17 拆 catch-ok】删 `catch { // catch-ok: READ_FALLBACK }`：
  // `contentGet` 对**已登记键不抛**（失败语义归 contentStore = 真相源，只对契约违约抛错且须 fail-fast）
  // ⇒ 该 catch 不可达，留着只会把「契约违约」一并吞掉。
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
  return null;
}

export function saveAgentChatModel(cfg?: Partial<AgentChatModelConfig>): void {
  const cur: Partial<AgentChatModelConfig> = loadAgentChatModel() || {};
  // 【2026-09-17 TD-24-4 阶段1】自确认：模型配置是用户偏好，未落盘必须留痕（旧注释"已内部留痕"
  // 指的是全局总线，本路径 KV/local 均可能不被它覆盖）。
  confirmPersist(
    contentSet(AGENT_CHAT_MODEL_KEY, {
      providerId: cfg?.providerId ?? cur.providerId ?? '',
      modelId: cfg?.modelId ?? cur.modelId ?? '',
      streamMode: cfg?.streamMode ?? cur.streamMode ?? 'stream',
    }),
    { layer: 'agentModelStore', key: AGENT_CHAT_MODEL_KEY },
  );
}

// ── 历史回传轮数（过渡方案·2026-08-18）──
// 独立配置键，与聊天模型解耦（用户不配模型也能设）。
// 语义（buildRequestMessages 第 7 参 historyTurns）：
//   0          = 不回传历史文字（严格 fresh-task，只发本轮）；
//   1          = 只回传上一轮文字；
//   N（任意正） = 回传最近 N 轮文字（N≥消息总量时≈不限，buildRequestMessages 会自动回溯到最早）。
// 图片永远编号化（imageCatalog 图N）不内联，不破坏「反推图一却全反推」安全底线。
export const AGENT_HISTORY_TURNS_KEY = KEY_AGENT_HISTORY_TURNS;
export const AGENT_HISTORY_TURNS_DEFAULT = 6; // 默认回传最近 6 轮

/** 读历史回传轮数：合法返回非负整数；异常/非法回退默认 6。 */
export function loadAgentHistoryTurns(): number {
  // 同上（删不可达 catch）：`contentGet` 对已登记键不抛。
  const raw = contentGet(AGENT_HISTORY_TURNS_KEY);
  if (raw === undefined || raw === null || raw === '') return AGENT_HISTORY_TURNS_DEFAULT;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n); // 支持 0、任意非负整数（含大值≈不限）
  return AGENT_HISTORY_TURNS_DEFAULT;
}

/** 写历史回传轮数（非负整数；非法输入忽略）。 */
export function saveAgentHistoryTurns(n: number | string): void {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return;
  // 自确认（同上）：未落盘留痕，不静默
  confirmPersist(contentSet(AGENT_HISTORY_TURNS_KEY, Math.floor(v)), {
    layer: 'agentModelStore',
    key: AGENT_HISTORY_TURNS_KEY,
  });
}
