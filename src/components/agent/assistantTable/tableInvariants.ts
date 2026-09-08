/**
 * AI 助手表格 —— 不变量校验（spec/AI-ASSISTANT-TABLE-INVARIANTS.md §七.L4）。
 *
 * 把表格域「应当恒真」的约束收敛成可单测的校验函数，接在纯函数用例末尾跑一次，
 * 防「复制/重映射」之类引用脱节长期静默（I4 正是三次事故的共同形态）。
 *
 * 分层判定：
 *  - validateTabs：校验整份 AssistantTableTabs（多 tab）的 I/S/T 类不变量；
 *  - validateWorkspace：校验运行态 tableWorkspaceState 的 W/P 类不变量。
 *  hard 约束违规 → error；可疑 → warn（调用方决定是否告警/只留痕）。
 *
 * 用法（对齐 §九）：
 *   import { validateTabs } from './tableInvariants.ts'
 *   const next = copyTab(fixture, 'A');
 *   expect(validateTabs(next).filter((v) => v.level === 'error')).toEqual([]);
 */
import type { AssistantTableTabs } from './assistantTable.ts';
import { normalizeLabel } from './assistantTable.ts';
import type { TableWorkspaceState } from './tableWorkspaceState.ts';

/** 一条违规：level=error 硬约束必须修；level=warn 可疑（如跨表 id 复用、同名列） */
export interface Violation {
  level: 'error' | 'warn';
  /** 不变量编号，如 'I4' / 'S2' / 'W1'（对应 spec 清单） */
  code: string;
  message: string;
}

function err(code: string, message: string): Violation {
  return { level: 'error', code, message };
}
function warn(code: string, message: string): Violation {
  return { level: 'warn', code, message };
}

/**
 * 校验整份多标签页集合。返回违规数组；空 = 健康。
 * 硬约束（error）：S6/T1 tabs≥1、I5 activeTabId 有效、I1 tab id 全局唯一、
 *   每 tab 内 I2 列 id 唯一 / I3 行 id 唯一 / I4 行 values.key==columns.id / S1 label 非空。
 * 警告（warn）：I6 跨表复用 col/row id、S2 归一后同名列。
 */
export function validateTabs(tabs: AssistantTableTabs | null): Violation[] {
  const out: Violation[] = [];
  if (!tabs || !Array.isArray(tabs.tabs)) return [err('S6', 'tabs 结构缺失或非数组')];
  // S6/T1：恒 ≥1 tab
  if (tabs.tabs.length < 1) out.push(err('S6', `tabs 为空（恒需 ≥1）`));
  // I1：tab id 全局唯一
  const tabSeen = new Map<string, number>();
  tabs.tabs.forEach((t, i) => {
    const n = tabSeen.get(t.id) ?? 0;
    tabSeen.set(t.id, n + 1);
    if (n > 0) out.push(err('I1', `tab id 重复「${t.id}」位于 index ${i}`));
  });
  // I5/T2：activeTabId 指向存在的 tab
  if (tabs.tabs.length && !tabSeen.has(tabs.activeTabId)) {
    out.push(err('I5', `activeTabId「${tabs.activeTabId}」不指向任何存在的 tab`));
  }
  // 跨表 col/row id 复用（I6，警告级）
  const colOwner = new Map<string, string>();
  const rowOwner = new Map<string, string>();
  for (const t of tabs.tabs) {
    for (const c of t.columns) {
      const owner = colOwner.get(c.id);
      if (owner) out.push(warn('I6', `col id「${c.id}」在表「${owner}」与「${t.name}」间复用`));
      else colOwner.set(c.id, t.id);
    }
    for (const r of t.rows) {
      const owner = rowOwner.get(r.id);
      if (owner) out.push(warn('I6', `row id「${r.id}」在表「${owner}」与「${t.name}」间复用`));
      else rowOwner.set(r.id, t.id);
    }
  }
  // 每 tab：列/行 id 唯一、I4 键对齐、S1 非空列、S2 同名列
  tabs.tabs.forEach((t) => {
    // I2：列 id 唯一
    const colSeen = new Map<string, number>();
    t.columns.forEach((c, i) => {
      const n = colSeen.get(c.id) ?? 0;
      colSeen.set(c.id, n + 1);
      if (n > 0) out.push(err('I2', `表「${t.name}」col id「${c.id}」重复于 index ${i}`));
      if (!c.label || !String(c.label).trim()) {
        out.push(err('S1', `表「${t.name}」列「${c.id}」label 为空`));
      }
    });
    // S2：归一后同名列（警告级）
    const normLabel = new Map<string, string>();
    t.columns.forEach((c) => {
      const norm = normalizeLabel(c.label);
      if (!norm) return;
      const prev = normLabel.get(norm);
      if (prev) out.push(warn('S2', `表「${t.name}」同名列「${prev}」与「${c.label}」`));
      else normLabel.set(norm, c.label);
    });
    // I3：行 id 唯一
    const colIds = new Set(t.columns.map((c) => c.id));
    const rowSeen = new Map<string, number>();
    t.rows.forEach((r, i) => {
      const n = rowSeen.get(r.id) ?? 0;
      rowSeen.set(r.id, n + 1);
      if (n > 0) out.push(err('I3', `表「${t.name}」row id「${r.id}」重复于 index ${i}`));
      // I4：每行 values.key 集合 == 本表 columns.id 集合（既不缺也不多）
      const rowKeys = Object.keys(r.values ?? {});
      for (const cid of colIds) {
        if (!(cid in (r.values ?? {}))) {
          out.push(err('I4', `表「${t.name}」行「${r.id}」缺列键「${cid}」（渲染会空白）`));
        }
      }
      for (const k of rowKeys) {
        if (!colIds.has(k)) {
          out.push(err('I4', `表「${t.name}」行「${r.id}」含孤儿列键「${k}」（静默膨胀）`));
        }
      }
    });
  });
  return out;
}

/** 取当前活动 tab 的表（供 validateWorkspace 核对运行态引用；无活动 tab 返回 null） */
function getActiveTable(tabs: AssistantTableTabs): { columns: Array<{ id: string }>; rows: Array<{ id: string }>; tabId: string } | null {
  const t = tabs.tabs.find((x) => x.id === tabs.activeTabId);
  if (!t) return null;
  return { columns: t.columns, rows: t.rows, tabId: t.id };
}

/**
 * 校验运行态（W/P 类）。返回违规数组。
 * 硬约束（error）：P1 preview.targetTabId 指向存在的 tab。
 * 警告（warn）：W1 selectedRowIds 越界、W4 focusedCell/editingCell 指向不存在行/列、W2 行选与单格并存、P3 changedRowIds 越界。
 */
export function validateWorkspace(
  ws: TableWorkspaceState,
  tabs: AssistantTableTabs,
): Violation[] {
  const out: Violation[] = [];
  if (!ws) return out;
  const active = getActiveTable(tabs);
  if (!active) {
    if (ws.preview?.targetTabId) out.push(err('P1', `preview.targetTabId「${ws.preview.targetTabId}」但无活动 tab`));
    return out;
  }
  const rowIds = new Set(active.rows.map((r) => r.id));
  const colIds = new Set(active.columns.map((c) => c.id));
  const tabExists = tabs.tabs.some((t) => t.id === ws.preview?.targetTabId);
  // P1：preview.targetTabId 必须是存在的 tab
  if (ws.preview && !tabExists) {
    out.push(err('P1', `preview.targetTabId「${ws.preview.targetTabId}」不指向存在的 tab（确认会写悬空→假成功）`));
  }
  // W1：selectedRowIds ⊆ 当前活动表 rows
  for (const id of ws.selectedRowIds ?? []) {
    if (!rowIds.has(id)) out.push(warn('W1', `selectedRowIds 含幽灵行「${id}」（当前表无此行）`));
  }
  // W4：focusedCell/editingCell 指向存在的 row & col
  const cellOk = (cell: { rowId: string; colId: string } | null, tag: string) => {
    if (!cell) return;
    if (!rowIds.has(cell.rowId) || !colIds.has(cell.colId)) {
      out.push(warn('W4', `${tag}「${cell.rowId}:${cell.colId}」指向不存在的行/列`));
    }
  };
  cellOk(ws.focusedCell, 'focusedCell');
  cellOk(ws.editingCell, 'editingCell');
  // W2：行选与单格互斥（不可并存）
  if (ws.selectedRowIds?.length && (ws.focusedCell || ws.editingCell)) {
    out.push(warn('W2', 'selectedRowIds 与 focusedCell/editingCell 并存（应互斥）'));
  }
  // P3：changedRowIds ⊆ resultRows 的 id
  if (ws.preview) {
    const resultIds = new Set((ws.preview.resultRows ?? []).map((r) => r.id));
    for (const id of ws.preview.changedRowIds ?? []) {
      if (!resultIds.has(id))
        out.push(warn('P3', `preview.changedRowIds 含「${id}」不在 resultRows 中`));
    }
  }
  return out;
}