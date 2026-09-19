/* ════════════════════════════════════════════════════════════════
 * AI 助手 agentKey 命名与存储键的**唯一真源**（TD-15-1 收口）
 * ────────────────────────────────────────────────────────────────
 * 【为什么存在】agentKey 前缀 `canvas-assistant` 此前硬编码在**三处**：
 *   App.tsx `agentKeyForProject`（规范构造器，但非可 import 纯函数）·
 *   `conversationState.ts` · `backupStore.ts`。
 * 前缀一旦漂移 → 会话键错位 → **备份静默漏备/错备 AI 会话，且零报错**（M3 SSOT 第二份）。
 * 故收在 base/core（叶层，零业务依赖）：App / conversationState / backupStore 共用同一份，
 * 禁任何模块再拼 `canvas-assistant` 字面量。
 *
 * 存储键形状与 `contracts.ts` 的 STORAGE_KEYS 登记一致（`agent_conversations_{agentKey}` /
 * `agent_active_conversation_id_{agentKey}`）——那份是**键名清单**，本文件是**键值构造器**，
 * 二者同源描述同一真相。
 * ════════════════════════════════════════════════════════════════ */

/** AI 助手 agentKey 前缀（默认 agentKey = canvas-assistant）。 */
export const AGENT_KEY_PREFIX = 'canvas-assistant';

/** 项目 id → agentKey（AI 会话按项目隔离；空 projectId 回退 'default'）。 */
export function agentKeyForProject(projectId: string): string {
  return `${AGENT_KEY_PREFIX}-${projectId || 'default'}`;
}

/** agentKey → 会话列表存储键（契约登记见 contracts.ts `agent_conversations_{agentKey}`）。 */
export function agentConversationsKey(agentKey: string): string {
  return `agent_conversations_${agentKey}`;
}

/** agentKey → 当前活跃会话 id 存储键（契约登记见 contracts.ts `agent_active_conversation_id_{agentKey}`）。 */
export function agentActiveConversationKey(agentKey: string): string {
  return `agent_active_conversation_id_${agentKey}`;
}

/**
 * agentKey → 项目长期记忆存储键（契约登记见 contracts.ts `agent_project_memory_v1_{agentKey}`）。
 * TD-13-5：此前 `projectMemoryStore.ts:58` 本地裸拼模板，绕开本构造器真源（M7 第二份）。
 */
export function agentProjectMemoryKey(agentKey: string): string {
  return `agent_project_memory_v1_${agentKey}`;
}
