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
 *  - 表格数据真相源仍是 per-conversation `memory.assistantTable`；确认/取消写回一律经
 *    conversationStore 唯一入口（get/setCurrentAssistantTable / get/setCurrentGlobalContract /
 *    markMessageTableResolved），本模块不绕过、不裸写。
 *  - 与 conversationState.ts 同款轻量底座：模块级可变 + subscribe + useSyncExternalStore。
 *  - confirmTablePreview / cancelTablePreview 是纯模块函数（无 React state），可直接单测。
 *
 * 预览=确认（C5）：acceptTablePreview 用【实时表 + 实时选中】调 buildPreviewResult 一次性算好
 * 「操作后最终表格」存入 preview；confirmTablePreview 只原样写回，零二次推导（B-003 结构消解）。
 *
 * 语义要点：
 *  - 关面板 = 关协作：closeTableWorkspace 同时清 selectedRowIds/preview/handledMessageId；
 *  - 切对话（resetTableWorkspace）清选中/预览/游标，但保留 open/width（表格面板不因切对话收起）。
 */
import { useSyncExternalStore } from 'react';
import { contentGet, contentSet } from '../../base/core/contentStore.ts';
import { logger } from '../../base/core/logger.ts';
import {
  getCurrentAssistantTable,
  setCurrentAssistantTable,
  getCurrentGlobalContract,
  setCurrentGlobalContract,
  markMessageTableResolved,
} from '../conversation/conversationStore.ts';
import { buildPreviewResult } from './assistantTable.ts';
import type { AssistantTableJson, TableColumn, TableRow } from './assistantTable.ts';

/** 左面板宽度记忆键（沿用拆分前「左表 | 右对话」分栏键，避免旧数据丢失；STORAGE_KEYS 已登记） */
const WIDTH_KEY = 'agent_split_width';
const WIDTH_MIN = 360;
const WIDTH_MAX = 1080;
const WIDTH_DEFAULT = 600;

/**
 * 待确认预览（预览=确认，C5）：acceptTablePreview 时已把「操作后最终表格」算好存入，
 * 预览卡直接渲染 resultRows/resultCols，确认只原样写回——不做第二次推导。
 */
export interface TableWorkspacePreview {
  json: AssistantTableJson;
  messageId: unknown;
  /** 发消息/探测那一刻冻结的选中（含多选）；仅留痕，写回不依赖它 */
  selectedRowIds: string[];
  /** 操作后「最终的全部行」（= 确认结果） */
  resultRows: TableRow[];
  /** 操作后列（保留原列 id/宽度，新增列才追加） */
  resultCols: TableColumn[];
  opKind: 'update' | 'append' | 'replace';
  /** update 场景：实际被更新的行数（预览卡文案用） */
  updatedCount: number;
  /** update 且 AI 行多于选中行 / append 场景：追加行数（预览卡文案用） */
  appendedCount: number;
}

/** 共享「表格工作区运行态」形状（spec §四.5.1 + §1.5） */
export interface TableWorkspaceState {
  /** 表格工作区开合（左面板滑出 = 表格协作激活） */
  open: boolean;
  /** 左面板宽（px，clamp 360~1080，localStorage agent_split_width） */
  width: number;
  /** 选中行集合（多选，唯一意图信号；AI 注入读 / 预览写回判定读；空数组 = 未选中） */
  selectedRowIds: string[];
  /** 待确认预览（AI 返回表格 JSON → 探测命中置位；确认/取消清空） */
  preview: TableWorkspacePreview | null;
  /** 探测游标（原 AgentPanel tbPreviewHandledRef：最后一条已处理过的消息 id） */
  handledMessageId: unknown;
}

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

/** 关面板 = 关协作：open=false + 清选中行/待确认预览/探测游标（spec §4.5.1） */
export function closeTableWorkspace(): void {
  setState({ ...state, open: false, selectedRowIds: [], preview: null, handledMessageId: null });
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

/**
 * 探测命中：AI 返回表格 JSON → 用【实时表 + 实时选中】调 buildPreviewResult 一次性算好
 * 「操作后最终表格」存入 preview（预览=确认，C5）。确认/取消才写回正式表。
 */
export function acceptTablePreview(p: {
  json: AssistantTableJson;
  messageId: unknown;
  selectedRowIds: string[];
}): void {
  const r = buildPreviewResult(getCurrentAssistantTable(), p.json, p.selectedRowIds);
  setState({
    ...state,
    preview: {
      json: p.json,
      messageId: p.messageId,
      selectedRowIds: p.selectedRowIds || [],
      resultRows: r.resultRows,
      resultCols: r.resultCols,
      opKind: r.opKind,
      updatedCount: r.updatedCount,
      appendedCount: r.appendedCount,
    },
  });
}

/** 探测游标推进：该消息已处理过（表格回复/普通回复/已确认取消），刷新/重渲不重弹 */
export function markTableMessageHandled(messageId: unknown): void {
  setState({ ...state, handledMessageId: messageId });
}

/**
 * 确认写回（预览=确认，C5）：把 acceptTablePreview 算好的 resultCols/resultRows **原样写回**，
 * 零二次推导（不再 _rowIndex/mergeRowFromObj/jsonToSb 重算——B-003 结构消解）。
 * globalStyle 同步（保留 visual_positioning / negative）；
 * 写回 + markMessageTableResolved('confirmed') + 清 preview（左面板预览卡卸载，消息流留 pv-done 痕迹）。
 * @returns { ok, mode }；结果无列（异常）时 logger.warn + 不落表 + ok:false（A-001/A-004：绝不静默）。
 */
export function confirmTablePreview(): { ok: boolean; mode?: string } {
  const p = state.preview;
  if (!p) return { ok: false };
  const gs = String(p.json?.globalStyle ?? '').trim();
  if (gs) {
    const cur = getCurrentGlobalContract();
    if (gs !== (cur?.unified_style_prompt ?? '')) {
      setCurrentGlobalContract({
        visual_positioning: String(cur?.visual_positioning ?? '').trim(),
        unified_style_prompt: gs,
        unified_negative_prompt: String(cur?.unified_negative_prompt ?? '').trim(),
      });
    }
  }
  if (p.resultCols.length === 0) {
    // 探测时已拦空 rows；此处兜底：结果无列 = 推导异常，显式失败不静默落表（A-001/A-004）
    logger.warn('AI助手', '表格确认写回失败：结果无列，已中断', { messageId: p.messageId });
    markMessageTableResolved(p.messageId, 'confirmed');
    setState({ ...state, preview: null });
    return { ok: false, mode: p.opKind };
  }
  setCurrentAssistantTable({ columns: p.resultCols, rows: p.resultRows });
  markMessageTableResolved(p.messageId, 'confirmed');
  setState({ ...state, preview: null });
  return { ok: true, mode: p.opKind };
}

/** 取消写回：只打「已取消」处理态 + 清 preview，正式表不动 */
export function cancelTablePreview(): void {
  const p = state.preview;
  if (!p) return;
  markMessageTableResolved(p.messageId, 'cancelled');
  setState({ ...state, preview: null });
}

/** 切对话：清选中行/待确认预览/探测游标（防串到别的对话），保留 open/width */
export function resetTableWorkspace(): void {
  setState({ ...state, selectedRowIds: [], preview: null, handledMessageId: null });
}
