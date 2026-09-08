/**
 * AI 助手表格 —— 本地编辑草稿统一管理（edits / colRenameDraft / styleDraft 收口）。
 *
 * 背景：原 AssistantTablePanel 三份散落 useState，`edits` key 用 `"${rowId}:${colId}"` 字符串拼接，
 * 改列/删列会留孤儿 key。收口到本 hook，编辑态集中、语义化，便于后续加「整行编辑/撤销」。
 *
 * 关键设计：
 *  - 单元格草稿 edits 值以「rowId:colId」为键（表格行值本就用 colId 映射，沿用不引入新结构）；
 *  - commitCell 写回走纯函数 setCell（幂等、返回新表），并清理该格草稿；
 *  - 切对话（activeConversationId 变化）重置编辑草稿，防跨对话串表；styleDraft 随 globalStyle 外部变化同步；
 *  - 样式草稿仅在外部未在输入时同步（typing 不触发 globalStyle 变化，故不会覆盖用户输入）。
 */
import { useEffect, useState } from 'react';
import { renameColumn, setCell } from './assistantTable.ts';
import type { AssistantTable } from './assistantTable.ts';

export function useTableDrafts(
  table: AssistantTable,
  globalStyle: string,
  activeConversationId: string,
  commit: (sb: AssistantTable) => void,
) {
  /** 单元格草稿 `${rowId}:${colId}` → 输入中的文本 */
  const [edits, setEdits] = useState<Record<string, string>>({});
  /** 列名重命名草稿 colId → draft */
  const [colRenameDraft, setColRenameDraft] = useState<Record<string, string>>({});
  /** 全局风格草稿 */
  const [styleDraft, setStyleDraft] = useState(globalStyle);

  const draftKey = (rowId: string, colId: string) => `${rowId}:${colId}`;

  /** 单元格渲染值：有草稿取草稿，否则回退到数据层 backing */
  const cellValue = (rowId: string, colId: string, backing: string): string => {
    const k = draftKey(rowId, colId);
    return k in edits ? edits[k] : backing;
  };
  /** 输入时写草稿（不落数据层） */
  const setCellDraft = (rowId: string, colId: string, value: string) => {
    const k = draftKey(rowId, colId);
    setEdits((prev) => ({ ...prev, [k]: value }));
  };
  /** blur 提交：写回数据层 + 清该格草稿 */
  const commitCell = (rowId: string, colId: string, value: string) => {
    const next = setCell(table, rowId, colId, value);
    if (next !== table) commit(next);
    const k = draftKey(rowId, colId);
    setEdits((prev) => {
      if (!(k in prev)) return prev;
      const n = { ...prev };
      delete n[k];
      return n;
    });
  };

  /** 列名草稿渲染值 */
  const colRename = (colId: string) => colRenameDraft[colId];
  const setColRename = (colId: string, value: string) =>
    setColRenameDraft((prev) => ({ ...prev, [colId]: value }));
  /** 列名 blur 提交：非空且变化才写回，随后清草稿 */
  const commitColRename = (colId: string, label: string) => {
    const v = (colRenameDraft[colId] ?? label).trim();
    if (v && v !== label) commit(renameColumn(table, colId, v));
    setColRenameDraft((prev) => {
      if (!(colId in prev)) return prev;
      const n = { ...prev };
      delete n[colId];
      return n;
    });
  };

  // 全局风格外部变化 → 同步草稿（用户输入时值尚未写 globalStyle，故不覆盖输入）
  useEffect(() => {
    setStyleDraft(globalStyle);
  }, [globalStyle]);

  // 切对话 → 重置本地编辑草稿（防跨对话串表；选中态由共享态 resetTableWorkspace 清，勿另持副本）
  useEffect(() => {
    setEdits({});
    setColRenameDraft({});
  }, [activeConversationId]);

  // 【SSOT-6 · 孤儿草稿清理 2026-09-08】删行/删列后，table 的 rows/columns 缩小，
  // 必须清掉 edits 里指向已删行/列的 `${rowId}:${colId}` key、colRenameDraft 里指向已删列的 key，
  // 否则孤儿草稿堆积；将来若 id 复用会串值。
  // 只在「草稿 key 参考不到现有行/列」时裁剪；正常输入时 table 引用不变，effect 不触发，不会误吞输入中草稿。
  useEffect(() => {
    const rowIds = new Set(table.rows.map((r) => r.id));
    const colIds = new Set(table.columns.map((c) => c.id));
    setEdits((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        const idx = k.indexOf(':');
        const rowId = idx >= 0 ? k.slice(0, idx) : k;
        const colId = idx >= 0 ? k.slice(idx + 1) : '';
        if (rowIds.has(rowId) && colIds.has(colId)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
    setColRenameDraft((prev) => {
      if (Object.keys(prev).every((cid) => colIds.has(cid))) return prev;
      const next: Record<string, string> = {};
      for (const [cid, v] of Object.entries(prev)) if (colIds.has(cid)) next[cid] = v;
      return next;
    });
  }, [table]);

  /** 清空全部本地草稿（撤销/重做/切 tab 后，表格已变，旧草稿指向过期行/列，必须清） */
  const resetAllDrafts = () => {
    setEdits({});
    setColRenameDraft({});
    setStyleDraft(globalStyle);
  };

  return {
    cellValue,
    setCellDraft,
    commitCell,
    colRename,
    setColRename,
    commitColRename,
    styleDraft,
    setStyleDraft,
    resetAllDrafts,
  };
}
