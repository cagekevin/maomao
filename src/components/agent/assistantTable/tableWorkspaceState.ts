/**
 * AI 助手表格 —— 共享「表格工作区运行态」（画布左侧独立面板 ↔ 右侧对话协作的枢纽）。
 *
 * 背景（2026-09-06 拆分定稿，权威文档 spec/TABLE-WORKSPACE-INDEPENDENT-PANEL.md §四.5；
 *     2026-09-06 改造：spec/AI-ASSISTANT-TABLE-IMPLEMENTATION.md §1.5 数据流与契约）：
 * 原表格嵌在 AgentPanel 内部（左表右对话各占半宽），拆分后表格移到「画布左侧独立滑出面板」。
 * 开合 open / 宽度 width / 选中行 selectedRowIds（多选集合）/ 待确认预览 preview / 探测游标 handledMessageId
 * 需要左右两侧（AgentPanel 纯对话 + TableWorkspacePanel 左面板）共享同一份运行态，
 * 本模块 = 该共享态的**唯一新增枢纽**，不落盘（仅宽度经 agent_split_width 记忆）、不进 conversationState。
 *
 * 铁律（对齐 spec §四.5.1 + §1.5）：
 *  - 不新增存储键 / 事件名 / 会话字段；宽度沿用既有键 `agent_split_width`（STORAGE_KEYS 已登记）。
 *  - 表格数据真相源仍是 per-conversation `memory.assistantTables`；确认/取消写回一律经
 *    conversationStore 唯一入口（get/setCurrentAssistantTable / get/setCurrentGlobalContract /
 *    markMessageTableResolved），本模块不绕过、不裸写。
 *  - 与 conversationState.ts 同款轻量底座：模块级可变 + subscribe + useSyncExternalStore。
 *  - confirmTablePreview / cancelTablePreview 是纯模块函数（无 React state），可直接单测。
 *
 * 预览=确认（C5）：acceptTablePreview 用【实时表 + 实时选中】调 buildPreviewResult 一次性算好
 * 「操作后最终表格」存入 preview；confirmTablePreview 只原样写回，零二次推导（B-003 结构消解）。
 *
 * 根治·假成功（2026-09-07）：不变量「preview.targetTabId 恒指向存在的 tab」。确认写回前先用 getTab
 * 证明目标存在，否则显式失败（error toast、清 preview、不落盘）——「已写入」= 真实落到目标表，
 * 绝不因「流程走到末尾」就假报成功。悬空引用在源头被抹掉：删 tab 时若恰是预览目标 → 作废 preview。
 * 根治·非幂等读（2026-09-07 深化）：空/老数据对话的 tab id 每次读都是新的（getCurrentAssistantTabs
 * 纯读不落盘），accept 捕获 targetTabId 后 confirm 重读会对不上 → 误报「目标不存在」。故 accept 捕获目标前
 * 先 materializeAssistantTabs() 落成稳定基线，保证「捕获的 id == 确认读回的 id」。
 *
 * 语义要点：
 *  - 关面板 = 关协作：closeTableWorkspace 同时清 selectedRowIds/preview/handledMessageId；
 *  - 切对话（resetTableWorkspace）清选中/预览/游标，但保留 open/width（表格面板不因切对话收起）。
 */
import { useSyncExternalStore } from 'react';
import { contentGet, contentSet } from '../../base/core/contentStore.ts';
import { logger } from '../../base/core/logger.ts';
import {
  getCurrentAssistantTabs,
  setCurrentAssistantTabs,
  setActiveTableTab,
  markMessageTableResolved,
  materializeAssistantTabs,
} from '../conversation/conversationStore.ts';
import {
  buildPreviewResult,
  getActiveTab,
  getTab,
  setTabGlobalStyle,
  setTabTable,
} from './assistantTable.ts';
import type { AssistantTableJson, AssistantTableTabs, CellRange } from './assistantTable.ts';

/** 选区类型由模型层（assistantTable.ts）定义并拥有，此处转出供 UI 层直接用 */
export type { CellRange };
import { pushHistory } from './tableHistory.ts';
import { showToast } from '../../base/core/toastStore.ts';

/** 左面板宽度记忆键（沿用拆分前「左表 | 右对话」分栏键，避免旧数据丢失；STORAGE_KEYS 已登记） */
const WIDTH_KEY = 'agent_split_width';
const WIDTH_MIN = 360;
const WIDTH_MAX = 1080;
const WIDTH_DEFAULT = 600;

import type {
  TableClipboard,
  TableWorkspacePreview,
  TableWorkspaceState,
} from './tableWorkspaceTypes.ts';

/** 工作区运行态类型（定义见 ./tableWorkspaceTypes.ts，此处 re-export 维持对外兼容） */
export type {
  TableClipboard,
  TableWorkspacePreview,
  TableWorkspaceState,
} from './tableWorkspaceTypes.ts';

/** 读宽度记忆（clamp 到合法范围；异常回退默认值，不阻断） */
function loadWidth(): number {
  try {
    const t = contentGet(WIDTH_KEY);
    const n = t ? Number(t) : NaN;
    if (Number.isFinite(n)) return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, n));
  } catch (e) {
    logger.warn('AI助手', '表格宽度记忆读取失败，用默认宽', { error: e?.message || String(e) });
  }
  return WIDTH_DEFAULT;
}

let state: TableWorkspaceState = {
  open: false,
  width: loadWidth(),
  selectedRowIds: [],
  preview: null,
  handledMessageId: null,
  previewHeight: null,
  clipboard: null,
  range: null,
  focusedCell: null,
  editingCell: null,
};

const listeners = new Set<() => void>();

/** 订阅运行态变更（供 useSyncExternalStore / 非 hook 场景） */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): TableWorkspaceState {
  return state;
}

function setState(next: TableWorkspaceState): void {
  state = next;
  listeners.forEach((l) => l());
}

/** 同步读当前运行态（effect 内探测用，不订阅；组件渲染订阅请用 useTableWorkspace） */
export function getTableWorkspace(): TableWorkspaceState {
  return state;
}

/** 组件订阅 hook：运行态任何字段变化触发重渲染（小状态，整包订阅即可） */
export function useTableWorkspace(): TableWorkspaceState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 开合取反；开 = 进入协作（左面板滑出）；关 = 清协作现场（选中/预览/游标） */
export function toggleTableWorkspace(): void {
  if (state.open) {
    closeTableWorkspace();
  } else {
    setState({ ...state, open: true });
  }
}

/** 关面板 = 关协作：open=false + 清选中行/待确认预览/探测游标/单格与编辑态（spec §4.5.1） */
export function closeTableWorkspace(): void {
  setState({
    ...state,
    open: false,
    selectedRowIds: [],
    preview: null,
    handledMessageId: null,
    range: null,
    focusedCell: null,
    editingCell: null,
  });
}

/** 设当前聚焦单格（单击格；null = 清）。调用方负责互斥（聚焦普通格即清行多选） */
export function setTableFocusedCell(cell: { rowId: string; colId: string } | null): void {
  setState({ ...state, focusedCell: cell });
}

/** 设正在编辑的格（双击格；null = 退出编辑回选中态）。整表唯一编辑源 */
export function setTableEditingCell(cell: { rowId: string; colId: string } | null): void {
  setState({ ...state, editingCell: cell });
}

/** 左面板宽度（px）：clamp 360~1080 + 写 agent_split_width 记忆 */
export function setTableWorkspaceWidth(px: number): void {
  const w = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Number.isFinite(px) ? px : state.width));
  setState({ ...state, width: w });
  try {
    contentSet(WIDTH_KEY, String(w));
  } catch (e) {
    // 宽度记忆非关键路径：写失败不阻断交互，但要留痕可查（禁静默吞错）
    logger.warn('AI助手', '表格宽度记忆写入失败', { error: e?.message || String(e) });
  }
}

/**
 * 设置选中行集合（唯一意图信号，C1）。空数组 = 取消选中。
 * 供左面板 AssistantTablePanel onClickRow（普通点击=单选/取消，Cmd/Ctrl=累加 toggle）与
 * 右侧 AgentPanel「取消选中」共用——选中态全库只此一份。
 */
export function setTableWorkspaceRows(rowIds: string[]): void {
  setState({ ...state, selectedRowIds: rowIds || [] });
}

/** 写内部剪贴板（spec 3.6；仅内存，复制动作由 useTableSelection 触发） */
export function setTableClipboard(cb: TableClipboard | null): void {
  setState({ ...state, clipboard: cb });
}

/** 设置/取消单元格矩形选区（spec 3.6；切 tab、切对话、关面板都要清） */
export function setTableRange(range: CellRange | null): void {
  setState({ ...state, range });
}

/**
 * 探测命中：AI 返回表格 JSON → 用【当前活动 tab 的表 + 实时选中】调 buildPreviewResult 一次性算好
 * 「操作后最终表格」存入 preview（预览=确认，C5）。targetTabId 默认 = 当下活动 tab（spec 3.3）。
 * 确认/取消才写回正式表。
 */
export function acceptTablePreview(p: {
  json: AssistantTableJson;
  messageId: unknown;
  selectedRowIds: string[];
}): void {
  // 【根治·非幂等读-2026-09-07】捕获预览目标前先把 tabs 落成稳定基线：
  // 空/老数据对话的 tab id 每次读都是新的（getCurrentAssistantTabs 纯读不落盘），
  // 若不在此定住，accept 存的 targetTabId 到 confirm 重读就对不上 → 误报「目标不存在」。
  // materialize 幂等，已落盘则零开销。
  materializeAssistantTabs();
  const tabs = getCurrentAssistantTabs();
  const activeTab = getActiveTab(tabs);
  const targetTabId = activeTab ? activeTab.id : '';
  const sb = activeTab
    ? { columns: activeTab.columns, rows: activeTab.rows }
    : { columns: [], rows: [] };
  const r = buildPreviewResult(sb, p.json, p.selectedRowIds);
  setState({
    ...state,
    preview: {
      json: p.json,
      messageId: p.messageId,
      selectedRowIds: p.selectedRowIds || [],
      targetTabId,
      resultRows: r.resultRows,
      resultCols: r.resultCols,
      opKind: r.opKind,
      updatedCount: r.updatedCount,
      appendedCount: r.appendedCount,
      changedRowIds: r.changedRowIds,
    },
  });
}

/** 预览目标表切换（spec 3.3）：用目标表重算，保持「预览=确认」；
 *  选中行不参与定位（rowId 属原表），只认 AI 行的 _rowIndex；目标无列 → 自然 replace 建表。 */
export function setPreviewTargetTab(tabId: string): void {
  const p = state.preview;
  if (!p) return;
  const tabs = getCurrentAssistantTabs();
  const target = getTab(tabs, tabId);
  const tb = target ? { columns: target.columns, rows: target.rows } : { columns: [], rows: [] };
  const r = buildPreviewResult(tb, p.json, []);
  setState({
    ...state,
    preview: {
      ...p,
      targetTabId: tabId,
      resultRows: r.resultRows,
      resultCols: r.resultCols,
      opKind: r.opKind,
      updatedCount: r.updatedCount,
      appendedCount: r.appendedCount,
      changedRowIds: r.changedRowIds,
    },
  });
}

/** 预览卡高度（px，仅内存、不落盘；null 回退 CSS 默认）。调用方负责 clamp（usePreviewResize）。 */
export function setPreviewHeight(px: number): void {
  setState({ ...state, previewHeight: Number.isFinite(px) ? px : null });
}

/**
 * 切 tab（spec 2）：写 activeTabId 到会话记忆 + 重置协作现场（选中/预览/游标）。
 * rowId 属原表，跨表无意义 → 清空；防止破坏 C1「选中即唯一意图信号」。
 */
export function switchTableTab(tabId: string): void {
  setActiveTableTab(tabId);
  setState({
    ...state,
    selectedRowIds: [],
    preview: null,
    handledMessageId: null,
    range: null,
    focusedCell: null,
    editingCell: null,
  });
}

/** 探测游标推进：该消息已处理过（表格回复/普通回复/已确认取消），刷新/重渲不重弹 */
export function markTableMessageHandled(messageId: unknown): void {
  setState({ ...state, handledMessageId: messageId });
}

/**
 * 确认写回（预览=确认，C5）：把 acceptTablePreview 算好的 resultCols/resultRows **原样写回目标 tab**，
 * 零二次推导（不再 _rowIndex/mergeRowFromObj/jsonToSb 重算——B-003 结构消解）。
 * globalStyle 写目标 tab 的 globalStyle（隔离决策：不再写 global_contract）。
 * 确认后自动切到目标表（spec 3.3，用户才能看到写回结果）；
 * 写回 + markMessageTableResolved('confirmed') + 清 preview + 入撤销栈。
 * @returns { ok, mode }；结果无列（异常）时 logger.warn + 不落表 + ok:false（A-001/A-004：绝不静默）。
 */
export function confirmTablePreview(recordHistory = true): { ok: boolean; mode?: string } {
  const p = state.preview;
  if (!p) return { ok: false };
  const gs = String(p.json?.globalStyle ?? '').trim();
  if (p.resultCols.length === 0) {
    // 探测时已拦空 rows；此处兜底：结果无列 = 推导异常，显式失败不静默落表（A-001/A-004）
    logger.warn('AI助手', '表格确认写回失败：结果无列，已中断', { messageId: p.messageId });
    markMessageTableResolved(p.messageId, 'confirmed');
    setState({ ...state, preview: null });
    return { ok: false, mode: p.opKind };
  }
  const tabs0 = getCurrentAssistantTabs();
  const targetTabId = p.targetTabId || getActiveTab(tabs0)?.id || '';
  // 【根治·假成功-2026-09-07】「已写入」必须 = 目标 tab 真实存在、写真实落到它上面，而不是流程走到末尾。
  // 预览生成后目标 tab 可能已被删/重建（onClose 已同步清 preview，此处兜底）→ targetTabId 悬空，
  // 旧代码 setTabTable→updateTab 会原样返回 tabs0（静默 no-op）却仍旧弹「已写入」——正是「提示成功但表空」的根。
  // 故先证明目标存在：不存在 → 显式失败（error toast、清 preview、不落盘），绝不假报成功。
  const target = getTab(tabs0, targetTabId);
  if (!target) {
    logger.warn('AI助手', '表格确认写回失败：目标 tab 已不存在（预览过期）', {
      targetTabId,
      messageId: p.messageId,
    });
    markMessageTableResolved(p.messageId, 'confirmed');
    setState({ ...state, preview: null });
    showToast?.('写入失败：目标表格已不存在，请重新生成', { type: 'error' });
    return { ok: false, mode: p.opKind };
  }
  const targetName = target.name;
  let tabs1 = setTabTable(tabs0, targetTabId, { columns: p.resultCols, rows: p.resultRows });
  if (gs) tabs1 = setTabGlobalStyle(tabs1, targetTabId, gs);
  if (recordHistory) pushHistory(tabs0);
  setCurrentAssistantTabs(tabs1);
  markMessageTableResolved(p.messageId, 'confirmed');
  // 确认后自动切到目标表 + toast（spec 3.3 / §8-3 拍板）：走 switchTableTab（而非只改 activeTabId）
  // 才能把协作现场（选中行/预览/游标/选区）一并清掉 —— 旧选中行 id 属原表，留着会跨表残留。
  switchTableTab(targetTabId);
  showToast?.(`已写入「${targetName}」`, { type: 'success' });
  return { ok: true, mode: p.opKind };
}

/** 【根治·悬空引用-2026-09-07】tab 集合变更后维持不变量「preview.targetTabId 恒指向存在的 tab」：
 *  删除/重建 tab 后，若当前待确认预览的目标 tab 已不在 tabs 中，立即作废 preview（防确认时写悬空 id 假成功）。
 *  由 UI 所有改动 tab 集合的手柄（如 onClose 删 tab）调用；confirmTablePreview 内另有一道存在性兜底。 */
export function discardPreviewForMissingTarget(tabs: AssistantTableTabs | null): void {
  const p = state.preview;
  if (!p || !tabs) return;
  if (!getTab(tabs, p.targetTabId)) {
    logger.warn('AI助手', '预览目标 tab 已被删除，预览作废', { targetTabId: p.targetTabId });
    setState({ ...state, preview: null });
  }
}

/** 取消写回：只打「已取消」处理态 + 清 preview，正式表不动 */
export function cancelTablePreview(): void {
  const p = state.preview;
  if (!p) return;
  markMessageTableResolved(p.messageId, 'cancelled');
  setState({ ...state, preview: null });
}

/** 切对话：清选中行/待确认预览/探测游标/选区（防串到别的对话），保留 open/width。
 *  ⚠️ 撤销栈不在这里清 —— 由 AgentPanel 切对话时显式调 clearHistory()（快照是整份 tabs，
 *  跨对话复用会把 A 对话的 tabs 写进 B 对话并落盘）。 */
export function resetTableWorkspace(): void {
  setState({
    ...state,
    selectedRowIds: [],
    preview: null,
    handledMessageId: null,
    range: null,
    focusedCell: null,
    editingCell: null,
  });
}
