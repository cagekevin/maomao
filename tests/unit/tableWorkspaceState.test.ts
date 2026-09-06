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
  setTableWorkspaceRows,
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

    setTableWorkspaceRows(['r1', 'r2']);
    acceptTablePreview({
      json: { rows: [{ a: 'x' }] },
      messageId: 'm1',
      selectedRowIds: ['r1', 'r2'],
    });
    markTableMessageHandled('m9');
    expect(getTableWorkspace().selectedRowIds).toEqual(['r1', 'r2']);
    expect(getTableWorkspace().preview).not.toBeNull();
    expect(getTableWorkspace().handledMessageId).toBe('m9');

    toggleTableWorkspace(); // 关
    expect(getTableWorkspace().open).toBe(false);
    expect(getTableWorkspace().selectedRowIds).toEqual([]);
    expect(getTableWorkspace().preview).toBeNull();
    expect(getTableWorkspace().handledMessageId).toBeNull();
  });

  it('宽度 clamp 360~1080 + 经 agent_split_width 持久化（localStorage）', () => {
    setTableWorkspaceWidth(100); // 低于 min → 360
    expect(getTableWorkspace().width).toBe(360);
    setTableWorkspaceWidth(2000); // 高于 max → 1080
    expect(getTableWorkspace().width).toBe(1080);
    setTableWorkspaceWidth(500);
    expect(getTableWorkspace().width).toBe(500);
    expect(contentGet('agent_split_width')).toBe('500');
  });

  it('resetTableWorkspace 清选中/预览/游标，保留 open/width（切对话语义）', () => {
    toggleTableWorkspace();
    setTableWorkspaceWidth(520);
    setTableWorkspaceRows(['r1']);
    acceptTablePreview({
      json: { rows: [{ a: 'x' }] },
      messageId: 'm1',
      selectedRowIds: ['r1'],
    });
    markTableMessageHandled('m9');

    resetTableWorkspace();
    expect(getTableWorkspace().open).toBe(true);
    expect(getTableWorkspace().width).toBe(520);
    expect(getTableWorkspace().selectedRowIds).toEqual([]);
    expect(getTableWorkspace().preview).toBeNull();
    expect(getTableWorkspace().handledMessageId).toBeNull();
  });
});

describe('tableWorkspaceState — acceptTablePreview 算结果 + confirm 原样写回（预览=确认）', () => {
  it('单行（选中行 + AI 只回 1 行）→ update 该行，消息打 confirmed，预览清空', () => {
    const sb = setupConvWithTable();
    const rowId = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"景别":"特写","画面":"新画面"}]}');

    setTableWorkspaceRows([rowId]);
    acceptTablePreview({
      json: { rows: [{ 景别: '特写', 画面: '新画面' }] },
      messageId: mid,
      selectedRowIds: [rowId],
    });
    const p = getTableWorkspace().preview!;
    expect(p.opKind).toBe('update');
    expect(p.resultRows).toHaveLength(1); // 预览存「操作后最终表格」
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

  it('多行改（选中 2 行 + AI 回 2 行）→ 两行都更新，未选中行不受影响（验收 2）', () => {
    setupConvWithTable();
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2\n全景\t原3')!;
    setCurrentAssistantTable(sb);
    const r1 = sb.rows[0].id;
    const r3 = sb.rows[2].id;
    const mid = appendAssistant('{"rows":[{"画面":"新1"},{"画面":"新3"}]}');

    setTableWorkspaceRows([r1, r3]);
    acceptTablePreview({
      json: { rows: [{ 画面: '新1' }, { 画面: '新3' }] },
      messageId: mid,
      selectedRowIds: [r1, r3],
    });
    expect(getTableWorkspace().preview!.opKind).toBe('update');
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    const c1 = after.columns[1].id; // 画面
    expect(after.rows[0].values[c1]).toBe('新1');
    expect(after.rows[1].values[c1]).toBe('原2'); // 未选中行不受影响
    expect(after.rows[2].values[c1]).toBe('新3');
    expect(after.rows).toHaveLength(3);
  });

  it('未选中行 + AI 返回行 → append 末尾追加，原有行与列宽不丢（验收 3）', () => {
    setupConvWithTable();
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2')!;
    const col0 = sb.columns[0];
    setCurrentAssistantTable({ ...sb, columns: [{ ...col0, width: 180 }, sb.columns[1]] });
    const mid = appendAssistant('{"rows":[{"景别":"全景","画面":"新增"}]}');

    acceptTablePreview({
      json: { rows: [{ 景别: '全景', 画面: '新增' }] },
      messageId: mid,
      selectedRowIds: [],
    });
    const p = getTableWorkspace().preview!;
    expect(p.opKind).toBe('append');
    expect(p.resultCols[0].id).toBe(col0.id); // 列 id 保留
    expect(p.resultCols[0].width).toBe(180); // 列宽不丢
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.rows).toHaveLength(3); // 原 2 行 + 追加 1 行
    expect(after.rows[2].values[after.columns[0].id]).toBe('全景');
    expect(after.rows[0].values[after.columns[0].id]).toBe('中景'); // 原行不动
  });

  it('单行带 _rowIndex（无选中）→ 精准 patch 到对应行，不当列、不整表替换', () => {
    // 先建会话 + 表，再覆盖成一张 3 行表：景别/画面（行序：中景-原1 / 特写-原2 / 全景-原3）
    setupConvWithTable();
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2\n全景\t原3')!;
    const row2 = sb.rows[1]; // 第 2 行：特写/原2
    setCurrentAssistantTable(sb);
    const mid = appendAssistant('{"rows":[{"_rowIndex":2,"画面":"已更新"}]}');

    // 未选中任何行（selectedRowIds=[]），靠 AI 返回的 _rowIndex:2 定位到第 2 行
    acceptTablePreview({
      json: { rows: [{ _rowIndex: 2, 画面: '已更新' }] },
      messageId: mid,
      selectedRowIds: [],
    });
    // 未选中 + AI 有 _rowIndex → 按行号定位该行（update 语义，非 append）
    const p = getTableWorkspace().preview!;
    expect(p.opKind).toBe('update');
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.rows).toHaveLength(3); // 不整表替换、不新增行
    const c0 = after.columns[0].id; // 景别
    const c1 = after.columns[1].id; // 画面
    expect(after.rows[1].values[c1]).toBe('已更新'); // 第 2 行画面被改
    expect(after.rows[1].values[c0]).toBe('特写'); // 第 2 行其它列保留
    expect(after.rows[0].values[c1]).toBe('原1'); // 其它行不动
    expect(after.rows[2].values[c1]).toBe('原3');
    expect(after.columns.map((c) => c.label)).toEqual(['景别', '画面']); // _rowIndex 不当列
    expect(row2.id).toBe(after.rows[1].id); // 写回的是原第 2 行（id 稳定）
    const msgs = getActiveConv()!.messages as Array<{ tableResolved?: string }>;
    expect(msgs[msgs.length - 1].tableResolved).toBe('confirmed');
    expect(getTableWorkspace().preview).toBeNull();
  });

  it('空表 + AI 整表 → replace 建表 + globalStyle 写回（验收全流程）', () => {
    setupConvWithTable();
    setCurrentAssistantTable({ columns: [], rows: [] }); // 清空成空表
    const mid = appendAssistant(
      '{"globalStyle":"写实电影感","rows":[{"新列A":"a1","新列B":"b1"}]}',
    );

    acceptTablePreview({
      json: { globalStyle: '写实电影感', rows: [{ 新列A: 'a1', 新列B: 'b1' }] },
      messageId: mid,
      selectedRowIds: [],
    });
    const p = getTableWorkspace().preview!;
    expect(p.opKind).toBe('replace');
    expect(p.resultCols.map((c) => c.label)).toEqual(['新列A', '新列B']);
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.columns.map((c) => c.label)).toEqual(['新列A', '新列B']);
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].values[after.columns[0].id]).toBe('a1');
    expect(getCurrentGlobalContract()?.unified_style_prompt).toBe('写实电影感');
    expect(getTableWorkspace().preview).toBeNull();
  });

  it('AI 返回列名与现有不一致 → 新列出现在预览 resultCols，确认后写入（验收 4）', () => {
    setupConvWithTable();
    const sb = getCurrentAssistantTable();
    const rid = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"画面":"新画面","备注":"新列值"}]}');

    setTableWorkspaceRows([rid]);
    acceptTablePreview({
      json: { rows: [{ 画面: '新画面', 备注: '新列值' }] },
      messageId: mid,
      selectedRowIds: [rid],
    });
    const p = getTableWorkspace().preview!;
    expect(p.resultCols.map((c) => c.label)).toEqual(['景别', '画面', '备注']); // 新列在预览
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.columns.map((c) => c.label)).toEqual(['景别', '画面', '备注']);
    expect(after.rows[0].values[after.columns[2].id]).toBe('新列值');
  });

  it('预览=确认：preview 冻结结果，确认原样写回（不再二次推导）', () => {
    setupConvWithTable();
    const sb = getCurrentAssistantTable();
    const rid = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"画面":"新画面"}]}');

    setTableWorkspaceRows([rid]);
    acceptTablePreview({
      json: { rows: [{ 画面: '新画面' }] },
      messageId: mid,
      selectedRowIds: [rid],
    });
    const p = getTableWorkspace().preview!;
    // accept 后即使改选/表已变，确认仍写 preview 里的结果（B-003 结构消解）
    setTableWorkspaceRows([]);
    setCurrentAssistantTable(parsePasted('甲\t乙\nx\ty')!);
    confirmTablePreview();

    const after = getCurrentAssistantTable();
    expect(after.columns.map((c) => c.label)).toEqual(['景别', '画面']);
    expect(after.rows[0].values[after.columns[1].id]).toBe('新画面');
    expect(getTableWorkspace().preview).toBeNull();
  });

  it('cancelTablePreview → 只打 cancelled，正式表不动，预览清空', () => {
    const sb = setupConvWithTable();
    const rowId = sb.rows[0].id;
    const mid = appendAssistant('{"rows":[{"景别":"特写"}]}');

    setTableWorkspaceRows([rowId]);
    acceptTablePreview({
      json: { rows: [{ 景别: '特写' }] },
      messageId: mid,
      selectedRowIds: [rowId],
    });
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
    expect(confirmTablePreview()).toEqual({ ok: false });
  });
});
