import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as contentStore from '../../src/components/base/core/contentStore.ts';
const { contentClearCache } = contentStore;
import {
  resetConversationCache,
  ensureActiveConversation,
  applyConversation,
  newConversation,
  switchConversation,
} from '../../src/components/agent/conversation/conversationStore.ts';
import {
  getCurrentAssistantTable,
  setCurrentAssistantTable,
  getCurrentGlobalContract,
  setCurrentGlobalContract,
  markMessageTableResolved,
} from '../../src/components/agent/conversation/conversationStore.ts';
import { getActiveConv } from '../../src/components/agent/conversation/conversationState.ts';
import { appendMsg } from '../../src/components/agent/runtime/agentMessages.ts';
import { parsePasted } from '../../src/components/agent/assistantTable/assistantTable.ts';

// 会话键已迁 KV：用 Map 兜底让 KV 确定性往返，避免走真实网络
const kvStore = new Map();
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => {
    kvStore.set(key, value);
    return { ok: true };
  }),
  kvDelete: vi.fn(async (key) => {
    kvStore.delete(key);
    return { ok: true };
  }),
}));

beforeEach(() => {
  localStorage.clear();
  kvStore.clear();
  contentClearCache();
  resetConversationCache();
});

describe('assistantTable 会话记忆字段', () => {
  it('读写走 per-conversation 隔离：写表A → 切会话读空 → 切回A仍在', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    const sb = parsePasted('景别\t画面\n中景\t人');
    setCurrentAssistantTable(sb!);
    expect(getCurrentAssistantTable().rows).toHaveLength(1);

    const { id: idB } = newConversation();
    applyConversation(idB);
    // 新对话 = 新空表
    expect(getCurrentAssistantTable().columns).toHaveLength(0);
    expect(getCurrentAssistantTable().rows).toHaveLength(0);

    switchConversation(id);
    // 切回 A → 表还在
    expect(getCurrentAssistantTable().rows).toHaveLength(1);
  });

  it('normalize 兜底：会话无表数据 → 空表（不抛）', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    setCurrentAssistantTable({ columns: [], rows: [] });
    expect(getCurrentAssistantTable().rows).toHaveLength(0);
  });

  it('globalStyle 复用 global_contract.unified_style_prompt：写全局风格可读回', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    setCurrentGlobalContract({
      visual_positioning: '',
      unified_style_prompt: '写实电影感',
      unified_negative_prompt: '',
    });
    expect(getCurrentGlobalContract()?.unified_style_prompt).toBe('写实电影感');
  });

  it('markMessageTableResolved 只给目标消息打 tableResolved、不误伤其它消息，可覆写', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    // 造两条 assistant 表格回复 + 一条 user（模拟同对话多轮表格确认的历史）
    appendMsg({ role: 'assistant', content: '{"rows":[{"景别":"A"}]}', createdAt: 1 });
    appendMsg({ role: 'assistant', content: '{"rows":[{"景别":"B"}]}', createdAt: 2 });
    appendMsg({ role: 'user', content: '追加问题', createdAt: 3 });
    const msgs = getActiveConv()!.messages as Array<{ id?: unknown; tableResolved?: string }>;
    const first = msgs[0];

    // 确认第一条 → 只有它带 confirmed，其余（含同为表格的第二条）不带
    markMessageTableResolved(first.id, 'confirmed');
    const afterConfirm = getActiveConv()!.messages as Array<{
      id?: unknown;
      tableResolved?: string;
    }>;
    expect(afterConfirm[0].tableResolved).toBe('confirmed');
    expect(afterConfirm[1].tableResolved).toBeUndefined();
    expect(afterConfirm[2].tableResolved).toBeUndefined();

    // 覆写（误触取消后再确认等）→ 状态切换为 cancelled
    markMessageTableResolved(first.id, 'cancelled');
    const afterCancel = getActiveConv()!.messages as Array<{
      id?: unknown;
      tableResolved?: string;
    }>;
    expect(afterCancel[0].tableResolved).toBe('cancelled');
    expect(afterCancel[1].tableResolved).toBeUndefined();

    // 目标消息 id 缺省/不存在的调用为 no-op，不抛
    expect(() => markMessageTableResolved(undefined, 'confirmed')).not.toThrow();
    expect(() => markMessageTableResolved('nope', 'confirmed')).not.toThrow();
  });
});
