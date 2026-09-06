import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as contentStore from '../../src/components/base/core/contentStore.ts';
const { contentClearCache, contentGet } = contentStore;
import {
  resetConversationCache,
  ensureActiveConversation,
  applyConversation,
} from '../../src/components/agent/conversation/conversationStore.ts';
import {
  getCurrentAssistantTable,
  setCurrentAssistantTable,
  getCurrentGlobalContract,
  markMessageTableResolved,
} from '../../src/components/agent/conversation/conversationStore.ts';
import { getActiveConv } from '../../src/components/agent/conversation/conversationState.ts';
import { appendMsg } from '../../src/components/agent/runtime/agentMessages.ts';
import { parsePasted } from '../../src/components/agent/assistantTable/assistantTable.ts';
import {
  getTableWorkspace,
  toggleTableWorkspace,
  closeTableWorkspace,
  setTableWorkspaceWidth,
  setTableWorkspaceRow,
  acceptTablePreview,
  markTableMessageHandled,
  confirmTablePreview,
  cancelTablePreview,
  resetTableWorkspace,
} from '../../src/components/agent/assistantTable/tableWorkspaceState.ts';

// 会话键已迁 KV：用 Map 兜底让 KV 确定性往返，避免走真实网络（对齐 assistantTable.memory.test.ts）
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
  // 运行态复位：关面板 = 清选中/预览/游标（模块级状态，跨用例不残留）
  closeTableWorkspace();
});

/** 造一个会话 + 一张表，返回当前表（后续用例基于它写回） */
function setupConvWithTable() {
  const id = ensureActiveConversation();
  applyConversation(id);
  const sb = parsePasted('景别\t画面\n中景\t原画面');
  setCurrentAssistantTable(sb!);
  return getCurrentAssistantTable();
}

/** 追加一条 assistant 消息并返回其 id（confirm/cancel 需要真实 messageId 才能打到 mark） */
function appendAssistant(content: string): unknown {
  appendMsg({ role: 'assistant', content, createdAt: Date.now() });
  const msgs = getActiveConv()!.messages as Array<{ id?: unknown }>;
  return msgs[msgs.length - 1].id;
}

describe('tableWorkspaceState — 开合/选中/预览/游标（纯运行态）', () => {
  it('toggle 开合取反；close 清选中/预览/游标（关面板 = 关协作）', () => {
    expect(getTableWorkspace().open).toBe(false);
    toggleTableWorkspace();
    expect(getTableWorkspace().open).toBe(true);

    setTableWorkspaceRow('r1');
    acceptTablePreview({ json: { rows: [{ a: 'x' }] }, messageId: 'm1', rowId: 'r1' });
    markTableMessageHandled('m9');
    expect(getTableWorkspace().selectedRowId).toBe('r1');
    expect(getTableWorkspace().preview).not.toBeNull();
    expect(getTableWorkspace().handledMessageId).toBe('m9');

    toggleTableWorkspace(); // 关
    expect(getTableWorkspace().open).toBe(false);
    expect(getTableWorkspace().selectedRowId).toBeNull();
    expect(getTableWorkspace().preview).toBeNull();
    expect(getTableWorkspace().handledMessageId).toBeNull();
  });

  it('宽度 clamp 360~760 + 经 agent_split_width 持久化（localStorage）', () => {
    setTableWorkspaceWidth(100); // 低于 min → 360
    expect(getTableWorkspace().width).toBe(360);
    setTableWorkspaceWidth(900); // 高于 max → 760
    expect(getTableWorkspace().width).toBe(760);
    setTableWorkspaceWidth(500);
    expect(getTableWorkspace().width).toBe(500);
    expect(contentGet('agent_split_width')).toBe('500');
  });

  it('resetTableWorkspace 清选中/预览/游标，保留 open/width（切对话语义）', () => {
    toggleTableWorkspace();
    setTableWorkspaceWidth(520);
    setTableWorkspaceRow('r1');
    acceptTablePreview({ json: { rows: [{ a: 'x' }] }, messageId: 'm1', rowId: 'r1' });
    markTableMessageHandled('m9');

    resetTableWorkspace();
    expect(getTableWorkspace().open).toBe(true);
    expect(getTableWorkspace().width).toBe(520);
    expect(getTableWorkspace().selectedRowId).toBeNull();
    expect(getTableWorkspace().preview).toBeNull();
    expect(getTableWorkspace().handledMessageId).toBeNull();
  });
});

describe('tableWorkspaceState — confirmTablePreview 写回（模块化，替代原 AgentPanel）', () => {
  it('单行（有选中行 + AI 只回 1 行）→ mergeRowFromObj 只覆盖该行已有列，消息打 confirmed，预览清空', () => {
    const sb = setupConvWithTable();
    const rowId = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"景别":"特写","画面":"新画面"}]}');

    setTableWorkspaceRow(rowId);
    acceptTablePreview({
      json: { rows: [{ 景别: '特写', 画面: '新画面' }] },
      messageId: mid,
      rowId,
    });
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    const c0 = after.columns[0].id; // 景别
    const c1 = after.columns[1].id; // 画面
    expect(after.rows[0].values[c0]).toBe('特写');
    expect(after.rows[0].values[c1]).toBe('新画面');
    expect(after.rows).toHaveLength(1); // 不新增行
    expect(getTableWorkspace().preview).toBeNull();
    const msgs = getActiveConv()!.messages as Array<{ tableResolved?: string }>;
    expect(msgs[msgs.length - 1].tableResolved).toBe('confirmed');
  });

  it('整表（无选中行 / 多行）→ jsonToSb 全量替换列+行 + globalStyle 写回，消息打 confirmed', () => {
    setupConvWithTable();
    const mid = appendAssistant(
      '{"globalStyle":"写实电影感","rows":[{"新列A":"a1","新列B":"b1"}]}',
    );

    acceptTablePreview({
      json: { globalStyle: '写实电影感', rows: [{ 新列A: 'a1', 新列B: 'b1' }] },
      messageId: mid,
      rowId: null,
    });
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.columns.map((c) => c.label)).toEqual(['新列A', '新列B']);
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].values[after.columns[0].id]).toBe('a1');
    expect(getCurrentGlobalContract()?.unified_style_prompt).toBe('写实电影感');
    expect(getTableWorkspace().preview).toBeNull();
  });

  it('cancelTablePreview → 只打 cancelled，正式表不动，预览清空', () => {
    const sb = setupConvWithTable();
    const rowId = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"景别":"特写"}]}');

    setTableWorkspaceRow(rowId);
    acceptTablePreview({ json: { rows: [{ 景别: '特写' }] }, messageId: mid, rowId });
    cancelTablePreview();

    // 表格没变
    const after = getCurrentAssistantTable();
    expect(after.rows[0].values[after.columns[0].id]).toBe('中景');
    expect(getTableWorkspace().preview).toBeNull();
    const msgs = getActiveConv()!.messages as Array<{ tableResolved?: string }>;
    expect(msgs[msgs.length - 1].tableResolved).toBe('cancelled');
  });

  it('无预览时 confirm/cancel 为 no-op，不抛', () => {
    expect(() => confirmTablePreview()).not.toThrow();
    expect(() => cancelTablePreview()).not.toThrow();
  });
});
