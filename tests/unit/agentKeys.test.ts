/**
 * agentKeys 单源契约（TD-15-1）。
 * 钉死 agentKey 前缀与两种会话存储键的形状——App / conversationState / backupStore 三处共用同一份。
 * 若有人改动前缀或键形（导致备份漏备/错备 AI 会话），本测试即红。
 */
import { describe, it, expect } from 'vitest';
import {
  AGENT_KEY_PREFIX,
  agentKeyForProject,
  agentConversationsKey,
  agentActiveConversationKey,
} from '@/components/agent/runtime/agentKeys';

describe('agentKeys 唯一真源（TD-15-1）', () => {
  it('前缀固定为 canvas-assistant（契约登记 @see contracts.ts STORAGE_KEYS）', () => {
    expect(AGENT_KEY_PREFIX).toBe('canvas-assistant');
  });

  it('agentKeyForProject：<prefix>-<projectId>，空 id 回退 default', () => {
    expect(agentKeyForProject('p1')).toBe('canvas-assistant-p1');
    expect(agentKeyForProject('')).toBe('canvas-assistant-default');
  });

  it('会话键形状与 contracts.ts 登记的 {agentKey} 模式一致', () => {
    const agentKey = agentKeyForProject('p1');
    expect(agentConversationsKey(agentKey)).toBe('agent_conversations_canvas-assistant-p1');
    expect(agentActiveConversationKey(agentKey)).toBe(
      'agent_active_conversation_id_canvas-assistant-p1',
    );
  });
});
