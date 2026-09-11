/**
 * AI 助手表格 —— 左栏表格工作区组件（多标签页版，UI 薄壳 + 组合子组件，spec/AI-ASSISTANT-TABLE-TABS.md）。
 *
 * 形态：普通 HTML 表格，活在 AI 面板左栏，与画布完全解耦。数据真相源 = 会话记忆 memory.assistantTables（多标签页，
 * {tabs,activeTabId}）。globalStyle 每 tab 独立。
 * 自读自写（conversationStore 原子订阅 + setCurrent* 写回）。
 *
 * 【多标签页装配】（spec 3.1/3.2/3.3/3.4/3.5/3.6）：
 *  - .atw 顶部渲染 TableTabsBar（高 40px 与 AI 助手顶栏齐平），选中=当前=发给 AI（activeTabId）；
 *  - 工具条加 ⟲/⟳（撤销/重做，仅按钮不绑快捷键）；批量删除选中行；
 *  - globalStyle 写当前活动 tab（setCurrentTableGlobalStyle），不再写 global_contract；
 *  - 行尾 ⋯ 菜单（RowOpsMenu，含跨表复制「复制行到…」）；
 *  - 预览卡：边距下好「写入到」目标表下拉（含「＋ 新建标签页」）+ 拖动拉高。
 *
 * 其余（拆分结构）：
 *  - TableGrid.tsx：表格主体纯渲染（表头/行/格/行号/操作列）；
 *  - CellEditor.tsx：单格 textarea（自动撑高）；
 *  - useColumnResize.ts：列宽估算 + 拖拽 hook（命令式改 DOM、松手 commit）；
 *  - useTableDrafts.ts：edits/colRenameDraft/styleDraft 草稿收口；
 *  - tableHistory.ts：撤销/重做栈（纯运行态、不落盘）；
 *  - icons.tsx / assistant-table.css 同款。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import {
  setCurrentAssistantTable,
  setCurrentAssistantTabs,
  getCurrentAssistantTabs,
  setCurrentTableGlobalStyle,
} from '../conversation/conversationStore.ts';
import {
  parsePasted,
  addRow,
  deleteRows,
  moveRow,
  insertRowAfter,
  rowToText,
  insertColumnAfter,
  deleteColumn,
  renameTab,
  addTab,
  removeTab,
  copyTab,
  moveTab,
  copyRowsToTab,
} from './assistantTable.ts';
import { normalizeAssistantTable, replaceTextInTabs } from './assistantTable.ts';
import { useTableSelection } from './useTableSelection.ts';
import type { AssistantTable, TableRow, TableTab } from './assistantTable.ts';
import { showToast } from '@/components/base/core/toastStore.ts';
import { askConfirm } from '@/components/base/core/confirmStore.ts';
import { hasModalLayer } from '@/components/base/core/modalLayer.ts';
import { isEditableTarget } from '@/components/base/core/uiHooks.ts';
import {
  useTableWorkspace,
  setTableWorkspaceRows,
  setTableFocusedCell,
  setTableEditingCell,
  switchTableTab,
  setPreviewTargetTab,
  discardPreviewForMissingTarget,
} from './tableWorkspaceState.ts';
import { useActiveAssistantTable } from './useActiveAssistantTable.ts';
import { useTableDrafts } from './useTableDrafts.ts';
import { useColumnResize } from './useColumnResize.ts';
import { usePreviewResize } from './usePreviewResize.ts';
import { pushHistory, useTableHistory, undoTable, redoTable } from './tableHistory.ts';
import TableGrid from './TableGrid.tsx';
import TableTabsBar from './TableTabsBar.tsx';
import FindReplaceDialog from './FindReplaceDialog.tsx';
import RowOpsMenu from './RowOpsMenu.tsx';
import Icon from './icons.tsx';
import AssistantTablePreviewCard from './AssistantTablePreviewCard.tsx';
import './assistant-table.css';

/** 面板外部注入：回调与左栏宽度 */
export interface AssistantTablePanelProps {
  /** 左栏固定宽度（px）（父级分栏拖拽决定） */
  width?: number;
  /** 某行 → 发送到画布（AgentPanel 传 sendContentToCanvas，内部 rowToText 拼好文字） */
  onSendToCanvas?: (text: string) => void;
  /** 是否正在发送（发送中禁用确认按钮） */
  sending?: boolean;
  onConfirmPreview?: () => void;
  onCancelPreview?: () => void;
}

export default function AssistantTablePanel({
  width = 460,
  onSendToCanvas,
  sending = false,
  onConfirmPreview,
  onCancelPreview,
}: AssistantTablePanelProps) {
  const { selectedRowIds, preview, previewHeight, focusedCell, editingCell } = useTableWorkspace();
  // previewing 由已订阅的共享态 preview 派生（单一真相，不再由父级回声下发第二个来源，TD-11-11）
  const previewing = !!preview;
  // ── 多标签页数据源（真源 = memory.assistantTables；返回 tabs + 当前活动 tab）──
  const {
    activeConversationId,
    tabs,
    activeTabId,
    table: tableData,
    globalStyle,
  } = useActiveAssistantTable();
  const { canUndo, canRedo } = useTableHistory();
  const { onGripPointerDown } = usePreviewResize();
  // 查找替换弹窗开关（⋯ 菜单「查找替换」打开；Esc/取消/替换完成关闭）
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  /** 唯一写回入口（当前活动 tab）：commit 前快照入撤销栈 */
  const commit = useCallback(
    (sb: AssistantTable) => {
      if (sb === tableData) return;
      pushHistory(getCurrentAssistantTabs());
      const normalized = normalizeAssistantTable(sb);
      setCurrentAssistantTable(normalized);
    },
    [tableData],
  );

  // 选区 + 系统/内部剪贴板（spec 3.6 + interaction-model；依赖 commit，故必须在其后声明）
  const { range, onCellPointerDown, clearRange, copy, paste } = useTableSelection({
    table: tableData,
    selectedRowIds,
    commit,
  });

  // ── 撤销/重做（仅工具条按钮，spec 3.4；不绑 Ctrl/Cmd+Z）──
  const handleUndo = () => {
    const prev = undoTable(getCurrentAssistantTabs());
    if (prev) {
      setCurrentAssistantTabs(prev);
      resetAllDrafts();
      showToast?.('已撤销', { type: 'success' });
    }
  };
  const handleRedo = () => {
    const next = redoTable(getCurrentAssistantTabs());
    if (next) {
      setCurrentAssistantTabs(next);
      resetAllDrafts();
      showToast?.('已重做', { type: 'success' });
    }
  };

  // 列宽策略/拖拽 + 本地编辑草稿
  const { colWidths, colElsRef, startResize, resizeTick } = useColumnResize(tableData, commit);
  const {
    cellValue,
    setCellDraft,
    commitCell,
    colRename,
    setColRename,
    commitColRename,
    styleDraft,
    setStyleDraft,
    resetAllDrafts,
  } = useTableDrafts(tableData, globalStyle, activeConversationId, commit);

  // 切 tab → 清本地草稿（行属原表，跨表无意义）
  useEffect(() => {
    resetAllDrafts();
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 业界模型单元格交互（spec interaction-model §3）：单击=聚焦整格、双击=编辑、切格=先提交当前编辑 ──
  /** 提交当前正在编辑的格（若在编辑）并退出编辑态；无编辑则 no-op。
   *  触发场景：用户单击另一个格/行号/工具栏（点了不可聚焦的 div，原生 blur 不会自己触发，须显式提交）。 */
  const commitEditingCellIfAny = () => {
    const ec = editingCell;
    if (!ec) return;
    const row = tableData.rows.find((r) => r.id === ec.rowId);
    if (!row) {
      setTableEditingCell(null); // 行已不存在 → 直接退出
      return;
    }
    const backing = row.cells[tableData.columns.findIndex((c) => c.id === ec.colId)] ?? '';
    commitCell(ec.rowId, ec.colId, cellValue(ec.rowId, ec.colId, backing));
    setTableEditingCell(null);
  };

  /**
   * 【行选 vs 单格互斥（spec interaction-model §1.3/§3.1）】selectedRowIds（行）与 focusedCell（单格）不可并存。
   * 该互斥不变量已于 SSOT 写者收口（setTableFocusedCell 聚焦即清行选 / setTableWorkspaceRows 选行即清单格，
   * 见 tableWorkspaceState.ts，TD-11-11）：本函数只调聚焦，无需再手动清行选。
   */
  /** 单击格：若正在编辑另一格先提交它；再聚焦该格为「当前格」（不进入编辑），并清行多选（互斥右半） */
  const handleFocusCell = (rowId: string, colId: string) => {
    if (editingCell && !(editingCell.rowId === rowId && editingCell.colId === colId)) {
      commitEditingCellIfAny();
    }
    setTableFocusedCell({ rowId, colId });
  };

  /** 双击格：先提交正在编辑的其它格，再进入编辑态（该格同时成为当前格），同样清行多选（互斥） */
  const handleEditCell = (rowId: string, colId: string) => {
    if (editingCell && !(editingCell.rowId === rowId && editingCell.colId === colId)) {
      commitEditingCellIfAny();
    }
    setTableFocusedCell({ rowId, colId });
    setTableEditingCell({ rowId, colId });
  };

  /** 编辑态 textarea blur 提交（业界：失焦即提交 + 退出编辑回选中态） */
  const handleCellCommit = (rowId: string, colId: string, value: string) => {
    commitCell(rowId, colId, value);
    setTableEditingCell(null);
  };

  const handlePaste = async () => {
    let text = '';
    let html = '';
    try {
      if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type === 'text/plain' && !text) text = await _readType(item, type);
            else if (type === 'text/html' && !html) html = await _readType(item, type);
          }
        }
      }
    } catch {
      /* read() 可能缺权限，回退 readText */
    }
    try {
      if (!text) text = await navigator.clipboard.readText();
    } catch {
      /* 权限被拒 */
    }
    const sb = parsePasted(text, html);
    if (!sb) {
      showToast?.('未识别到表格内容（首行为列名，行用 Tab 分隔）', { type: 'error' });
      return;
    }
    commit(sb);
    showToast?.(`已粘贴表格 · ${sb.rows.length} 行`, { type: 'success' });
  };
  async function _readType(item: ClipboardItem, type: string): Promise<string> {
    const blob = await item.getType(type);
    return await blob.text();
  }

  // 复制整表为表格：一次写两种格式 —— TSV（Excel/Sheets/Word 粘上成表）+ HTML <table>
  const handleCopyTable = useCallback(async () => {
    if (!tableData.columns.length) {
      showToast?.('表格还没有列，无法复制', { type: 'error' });
      return;
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cols = tableData.columns;
    const header = cols.map((c) => c.label).join('\t');
    const bodyRows = tableData.rows
      .map((r) => cols.map((_, ci) => (r.cells[ci] ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');
    const tsv = bodyRows ? `${header}\n${bodyRows}` : header;
    const html =
      '<table border="1" cellspacing="0" cellpadding="4"><thead><tr>' +
      cols.map((c) => `<th>${esc(c.label)}</th>`).join('') +
      '</tr></thead><tbody>' +
      tableData.rows
        .map(
          (r) =>
            '<tr>' + cols.map((_, ci) => `<td>${esc(r.cells[ci] ?? '')}</td>`).join('') + '</tr>',
        )
        .join('') +
      '</tbody></table>';
    try {
      if (
        navigator.clipboard &&
        'write' in navigator.clipboard &&
        typeof ClipboardItem !== 'undefined'
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([tsv], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      showToast?.(`已复制表格 · ${tableData.rows.length} 行 ${cols.length} 列`, {
        type: 'success',
      });
    } catch {
      showToast?.('复制失败（浏览器可能限制了剪贴板权限）', { type: 'error' });
    }
  }, [tableData]);

  // 清空表格：复用全局 askConfirm（danger 红样式），确认后才清空
  const handleClearTable = useCallback(async () => {
    const ok = await askConfirm({
      title: '清空表格？',
      message: '所有行和列都会被删除，且无法撤销。',
      confirmText: '清空',
      danger: true,
    });
    if (!ok) return;
    commit({ columns: [], rows: [] });
    showToast?.('已清空表格', { type: 'success' });
  }, [commit]);

  const handleStyleCommit = () => {
    const next = styleDraft.trim();
    if (next === globalStyle) return;
    // 风格属 commit（spec §2.1「行/列/风格/表名/顺序 任一 commit」），不入栈会让一次 ⟲ 吞掉多步
    pushHistory(getCurrentAssistantTabs());
    setCurrentTableGlobalStyle(next);
  };

  /** 批量删除选中行（Delete/Backspace 或 ⋯「删除选中行」），一次入撤销栈 */
  const handleDeleteSelected = () => {
    if (!selectedRowIds.length) return;
    const next = deleteRows(tableData, selectedRowIds);
    if (next !== tableData) {
      commit(next);
      setTableWorkspaceRows([]);
      showToast?.(`已删除 ${selectedRowIds.length} 行`, { type: 'success' });
    }
  };

  /** 每行 ⋯ 菜单回调集（spec 3.5/3.6）：套用当前活动 tab 的行级纯函数 */
  const rowOps = (row: TableRow) => {
    const apply = (fn: (sb_: AssistantTable) => AssistantTable) => {
      const next = fn(tableData);
      if (next !== tableData) commit(next);
    };
    const hasMulti = selectedRowIds.length > 1;
    const opsRowIds = hasMulti ? selectedRowIds : [row.id];
    return (
      <RowOpsMenu
        disabled={false}
        hasMultiSelect={hasMulti}
        onMoveUp={() => apply((s) => moveRow(s, row.id, 'up'))}
        onMoveDown={() => apply((s) => moveRow(s, row.id, 'down'))}
        onInsertAfter={() => {
          apply((s) => insertRowAfter(s, row.id));
          showToast?.('已插入空行');
        }}
        onDelete={() => {
          apply((s) => deleteRows(s, opsRowIds));
          if (selectedRowIds.length) setTableWorkspaceRows([]);
          showToast?.(`已删除 ${opsRowIds.length} 行`, { type: 'success' });
        }}
        onSendToCanvas={() => {
          const t = rowToText(tableData, row, globalStyle, activeTabName(tabs, activeTabId));
          onSendToCanvas?.(t);
          showToast?.('已发送到画布（建成文本节点）');
        }}
        onCopyToTab={(destTabId) => copyRowsToTarget(destTabId, opsRowIds)}
        onCopyToNewTab={() => {
          // 「＋ 新建标签页」：先建空 tab 再复制过去（与预览卡同款路径）
          const cur = getCurrentAssistantTabs();
          const next = addTab(cur);
          const newTabId = next.tabs[next.tabs.length - 1].id;
          pushHistory(cur);
          setCurrentAssistantTabs(next);
          copyRowsToTarget(newTabId, opsRowIds);
        }}
        tabs={tabs.tabs}
        currentTabId={activeTabId}
        currentTabName={activeTabName(tabs, activeTabId)}
      />
    );

    /** 跨表复制唯一实现：源=当前活动 tab，目标=destTabId，复制到目标末尾 + 入栈 + 切过去 */
    function copyRowsToTarget(destTabId: string, rowIds: string[]) {
      const cur = getCurrentAssistantTabs();
      const nextTabs = copyRowsToTab(cur, activeTabId, destTabId, rowIds);
      if (nextTabs === cur) return;
      pushHistory(cur);
      setCurrentAssistantTabs(nextTabs);
      switchTableTab(destTabId);
      showToast?.('已复制行到目标表', { type: 'success' });
    }
  };

  /** 点选行（C1）：普通点击=单选/再点取消；Cmd/Ctrl=累加/取消多选；Shift=区间选（从锚点行起选一片）。
   *  ⚠️ 选行 = 与选区互斥的另一套信号：一旦选行就清掉矩形选区（spec §3.6 —— 选区与行多选互斥，
   *  否则行选中后之前的选区蓝框还挂着，视觉像脏残留）。 */
  const onClickRow = (e: ReactMouseEvent, row: TableRow) => {
    if (editingCell) commitEditingCellIfAny(); // 点行号格（非聚焦元素，无原生 blur）→ 显式提交正在编辑的格
    if (range) clearRange();
    const multi = e.metaKey || e.ctrlKey;
    let next: string[];
    if (multi) {
      next = selectedRowIds.includes(row.id)
        ? selectedRowIds.filter((id) => id !== row.id)
        : [...selectedRowIds, row.id];
    } else if (e.shiftKey && selectedRowIds.length > 0) {
      // Shift+点：从已有选中行的「锚点」（首个或最后一个）到本行全选
      const anchors = tableData.rows
        .map((r, i) => ({ i, id: r.id }))
        .filter((x) => selectedRowIds.includes(x.id))
        .sort((a, b) => a.i - b.i);
      if (anchors.length) {
        const cur = tableData.rows.findIndex((r) => r.id === row.id);
        const a0 = anchors[0].i;
        const a1 = anchors[anchors.length - 1].i;
        const from = Math.min(a0, a1, cur);
        const to = Math.max(a0, a1, cur);
        next = tableData.rows.slice(from, to + 1).map((r) => r.id);
      } else {
        next = [row.id];
      }
    } else {
      next = selectedRowIds.length === 1 && selectedRowIds[0] === row.id ? [] : [row.id];
    }
    setTableWorkspaceRows(next); // 非空即清「当前格+编辑格」（互斥不变量已收口到 SSOT 写者 setTableWorkspaceRows）
  };

  /**
   * 面板内快捷键（焦点必须在 .atw 面板内；spec 3.6 + interaction-model §3.3）：
   *  - Delete/Backspace = 批量删除选中行；
   *  - Ctrl/Cmd+C = 复制（**行 > 矩形选区 > 聚焦单格**）到系统剪贴板 + 内部；编辑态（textarea）走浏览器原生；
   *  - Ctrl/Cmd+V = 从系统剪贴板粘贴（回退内部剪贴板）；编辑态走浏览器原生；
   *  - Esc = 退出编辑态；无编辑则取消选区。
   * ⚠️ 绝不绑 Ctrl/Cmd+Z（spec 3.4：与画布 undo / 单元格原生 undo 三方抢键，撤销只走工具条按钮）。
   * ⚠️ 判定「是否编辑中」而非看标签：编辑中（editingCell 非空）→ 放行给 textarea 原生文字复制粘贴；
   *    非编辑 → 表格接管系统剪贴板（修「复制粘不出来」根因：焦点在格内 textarea 时原 handler 直接短路给原生）。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ 本监听在【捕获阶段】(true)，且最后会对 Delete/Backspace 调 preventDefault +
      // stopPropagation —— 意味着它跑在所有冒泡监听之前，且能吞掉事件。两个后果：
      //  ① 画布的 useCanvasShortcuts 让位与否救不了它（那招只对冒泡阶段生效）；
      //  ② 用户在上方全屏编辑器（ImageEditor 等）里打字，退格会被这里截走。
      // 可达路径（不是理论问题，2026-09-10 核实）：在表格里选过行 → selectedRowIds/
      // focusedCell 非空且不会自动清 → 打开图片编辑器用文字工具输字 → 按退格想删字，
      // 实际删掉的是表格里选中的行。所以这里必须自查两件事：
      // ① 上方有全屏模态层 → 整体让位，不抢
      if (hasModalLayer()) return;
      // ② 焦点在任何输入框/可编辑元素内 → 退格是「删一个字符」，不是「删表格行」。
      //    表格自身的编辑态由下方 editingCell 分支覆盖，这里补的是外部输入框的情况。
      if (isEditableTarget(e)) return;
      const t = e.target as HTMLElement | null;
      // 编辑态：用户在改格内文字 → Ctrl/Cmd+C/V 走 textarea 原生（业界），不拦
      if (editingCell) {
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        return;
      }
      // 【业界铁律·勿改回严格 contains 版】选中格是只读 div（不聚焦），单击后 DOM 焦点常落在 body →
      //   keydown 的 e.target 不在面板内。若写成「仅 when panelRef.contains(t) 才接管」，Ctrl+C/V 会被
      //   整个拦掉（连 toast 都不弹，2026-09-08 实测）。正确语义：已选中格（focusedCell）即接管复制粘贴；
      //   仅在「无选中格 且 焦点在面板外」时才放行给全局，避免抢全局 Ctrl+C。
      const inPanel = !!panelRef.current?.contains(t);
      if (!inPanel && !focusedCell) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'c') {
        e.preventDefault();
        void copy(focusedCell).then((msg) => {
          if (msg) showToast?.(msg, { type: 'success' });
        });
        return;
      }
      if (mod && k === 'v') {
        e.preventDefault();
        void paste(focusedCell).then((msg) => {
          if (msg) showToast?.(msg, { type: 'success' });
        });
        return;
      }
      if (e.key === 'Escape') {
        if (editingCell) {
          e.preventDefault();
          commitEditingCellIfAny();
        } else {
          clearRange();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRowIds.length) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowIds, tableData, copy, paste, clearRange, focusedCell, editingCell]);

  const hasData = tableData.columns.length > 0;
  /** 面板根节点（快捷键只在面板内生效，防抢全局/画布快捷键） */
  const panelRef = useRef<HTMLElement>(null);

  // 预览卡：目标表名（来自运行态 preview.targetTabId）与目标表列表
  const previewTargetTabName = preview
    ? tabs.tabs.find((t) => t.id === preview.targetTabId)?.name || ''
    : '';
  const targetTabs: Array<{ id: string; name: string }> = tabs.tabs.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  return (
    <section className="atw" style={{ width }} ref={panelRef}>
      {/* tab 条（高 40px，与 AI 助手顶栏齐平；spec 3.1） */}
      <TableTabsBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={switchTableTab}
        onAdd={() => {
          const next = addTab(getCurrentAssistantTabs());
          pushHistory(getCurrentAssistantTabs());
          setCurrentAssistantTabs(next);
          switchTableTab(next.tabs[next.tabs.length - 1].id);
          showToast?.('已新建标签页');
        }}
        onRename={(tabId, name) => {
          const next = renameTab(getCurrentAssistantTabs(), tabId, name);
          if (next !== getCurrentAssistantTabs()) pushHistory(getCurrentAssistantTabs());
          setCurrentAssistantTabs(next);
        }}
        onClose={async (tabId) => {
          const cur = getCurrentAssistantTabs();
          const next = removeTab(cur, tabId);
          if (next !== cur) {
            pushHistory(cur);
            setCurrentAssistantTabs(next);
            setTableWorkspaceRows([]);
            // 若被删的恰是待确认预览的目标 tab → 作废预览（防确认时写悬空 id 假成功）
            discardPreviewForMissingTarget(next);
          }
        }}
        onCopyAsNew={(tabId) => {
          const cur = getCurrentAssistantTabs();
          const next = copyTab(cur, tabId);
          pushHistory(cur);
          setCurrentAssistantTabs(next);
          switchTableTab(next.tabs[next.tabs.length - 1].id);
          showToast?.('已复制为新表');
        }}
        onFindReplace={() => setFindReplaceOpen(true)}
        onReorder={(from, to) => {
          const cur = getCurrentAssistantTabs();
          const next = moveTab(cur, from, to);
          if (next !== cur) {
            pushHistory(cur);
            setCurrentAssistantTabs(next);
          }
        }}
      />

      <div className="atw-head">
        {/* 顶部单行：撤销/重做 + 全局风格 +（正式页）行数 / 新增一行；粘贴入口仅见于空态下方 */}
        <div className="atw-toolbar">
          {/* ⟲/⟳ 是撤销的**唯一入口**（spec 3.4），故不受 hasData 限制：
              清空表格/删完列后若跟着 hasData 一起隐藏，清空就再也撤不回来了。 */}
          <button
            type="button"
            className="atw-icobtn"
            title="撤销"
            disabled={!canUndo}
            onClick={handleUndo}
          >
            <Undo2 size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="atw-icobtn"
            title="重做"
            disabled={!canRedo}
            onClick={handleRedo}
          >
            <Redo2 size={12} strokeWidth={2} />
          </button>
          {selectedRowIds.length > 1 && (
            <button
              type="button"
              className="atw-icobtn is-danger"
              title={`删除选中的 ${selectedRowIds.length} 行`}
              onClick={handleDeleteSelected}
            >
              <Icon name="trash" size={12} strokeWidth={2} />
            </button>
          )}

          <div className="atw-style">
            <span className="atw-style-label">
              <Icon name="globe" size={11} />
              全局
            </span>
            <input
              className={`atw-style-input ${styleDraft ? '' : 'is-ph'}`}
              value={styleDraft}
              placeholder="未设置（AI 会自行补一个）"
              onChange={(e) => setStyleDraft(e.target.value)}
              onBlur={handleStyleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <Icon className="pen" name="edit" size={12} />
          </div>

          {hasData && (
            <>
              <button
                type="button"
                className="atw-icobtn"
                title="新增一行"
                onClick={() => {
                  commit(addRow(tableData));
                  showToast?.('已新增一行（点格子填内容）');
                }}
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                className="atw-icobtn"
                title="复制为表格（粘到 Excel/Word/Notion 等仍是表格）"
                onClick={handleCopyTable}
              >
                <Icon name="copy" />
              </button>
              <button
                type="button"
                className="atw-icobtn"
                title="清空表格"
                onClick={handleClearTable}
              >
                <Icon name="trash-clear" />
              </button>
            </>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="atw-empty">
          <div className="mark">
            <Icon name="table" size={18} strokeWidth={1.8} />
          </div>
          <h4>{previewing ? '等你在右侧确认后写入' : '还没有表格'}</h4>
          <p>
            {previewing
              ? '预览不改正式表 —— 确认才是唯一写回闸口'
              : '粘贴一段带表头的文字（首行=列名），或在右侧对话里描述需求让 AI 设计表头并填充'}
          </p>
          {previewing ? null : (
            <div className="acts">
              <button type="button" className="tb" onClick={handlePaste}>
                粘贴表格
              </button>
            </div>
          )}
        </div>
      ) : (
        <TableGrid
          table={tableData}
          selectedRowIds={selectedRowIds}
          range={range}
          onCellPointerDown={onCellPointerDown}
          editingCell={editingCell}
          focusedCell={focusedCell}
          onFocusCell={handleFocusCell}
          onEditCell={handleEditCell}
          colWidths={colWidths}
          colElsRef={colElsRef}
          resizeTick={resizeTick}
          cellValue={cellValue}
          onCellChange={setCellDraft}
          onCellCommit={handleCellCommit}
          onRowClick={onClickRow}
          colRename={colRename}
          onColRenameChange={setColRename}
          onColRenameCommit={commitColRename}
          onInsertColumnAfter={(colId) => {
            commit(insertColumnAfter(tableData, colId));
            showToast?.('已插入一列（点表头可改名）');
          }}
          onDeleteColumn={(colId) => {
            commit(deleteColumn(tableData, colId));
            showToast?.('已删除列');
          }}
          onStartResize={startResize}
          renderRowOps={rowOps}
        />
      )}

      {/* 【待确认预览卡 · 正式表格下方】AI 返回表格 JSON → 探测成预览后，在左栏渲染预览卡
          （共格式 tab 共享态 preview）。确认/取消由 tableWorkspaceState.confirmTablePreview/cancelTablePreview
          真正写回（写目标表）+ 清 preview；确认/取消后本块卸载、消息流原位显示 pv-done 痕迹。 */}
      {preview && (
        <div className="atw-preview">
          <AssistantTablePreviewCard
            kind="table"
            globalStyle={String(preview.json?.globalStyle ?? '').trim()}
            columns={preview.resultCols.map((c) => c.label)}
            // 【TD-11-11 F6 修正】直接透传位置式 cells，删除原「按列名 → Record」转换
            // （同名列会被覆盖，是丢值根因）。位置式与 columns 等长对齐，渲染按列序索引。
            rows={preview.resultRows.map((r) => r.cells.map((c) => c ?? ''))}
            rowIndex={null}
            opKind={preview.opKind}
            updatedCount={preview.updatedCount}
            appendedCount={preview.appendedCount}
            changedIndexes={
              (preview.changedRowIds || []).length
                ? preview.resultRows
                    .map((r, i) => ((preview.changedRowIds || []).includes(r.id) ? i : -1))
                    .filter((i) => i >= 0)
                : undefined
            }
            sending={sending}
            onConfirm={onConfirmPreview ?? (() => {})}
            onCancel={onCancelPreview ?? (() => {})}
            targetTabName={previewTargetTabName}
            targetTabs={targetTabs}
            onSelectTarget={setPreviewTargetTab}
            onNewTarget={() => {
              // 「＋ 新建标签页」：先建空 tab，再按 replace 重算预览（spec 3.3）
              const cur = getCurrentAssistantTabs();
              const next = addTab(cur);
              const newTabId = next.tabs[next.tabs.length - 1].id;
              pushHistory(cur); // 建 tab 是结构变更，应可 ⟲ 撤销
              setCurrentAssistantTabs(next);
              setPreviewTargetTab(newTabId);
              showToast?.('已新建空标签页作为写入目标');
            }}
            previewHeight={previewHeight}
            onGripPointerDown={onGripPointerDown}
          />
        </div>
      )}

      {/* 查找替换面板（⋯ 菜单「查找替换」打开）：本面板只管输入+实时计数，onReplace 走下面唯一全量替换入口 */}
      <FindReplaceDialog
        open={findReplaceOpen}
        tabs={tabs}
        onCancel={() => setFindReplaceOpen(false)}
        onReplace={(find, replace) => {
          const cur = getCurrentAssistantTabs();
          const result = replaceTextInTabs(cur, find, replace);
          if (result.tabs !== cur) {
            pushHistory(cur); // commit 前快照入撤销栈，改错可一键 ⟲ 还原
            setCurrentAssistantTabs(result.tabs);
            showToast?.(`已在所有标签页替换 ${result.count} 处`, { type: 'success' });
          } else {
            showToast?.('没有找到匹配内容', { type: 'info' });
          }
          setFindReplaceOpen(false);
        }}
      />
    </section>
  );
}

/** 取某 tab 名（sendToCanvas 文本首行「表名：xxx」用；spec 3.7） */
function activeTabName(tabs: { tabs: TableTab[] }, activeTabId: string): string {
  return tabs.tabs.find((t) => t.id === activeTabId)?.name || '';
}
