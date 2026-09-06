/**
 * AI 助手表格 —— 共享「表格工作区运行态」（画布左侧独立面板 ↔ 右侧对话协作的枢纽）。
 *
 * 背景（2026-09-06 拆分定稿，权威文档 spec/TABLE-WORKSPACE-INDEPENDENT-PANEL.md §四.5）：
 * 原表格嵌在 AgentPanel 内部（左表右对话各占半宽），拆分后表格移到「画布左侧独立滑出面板」。
 * 开合 open / 宽度 width / 选中行 selectedRowId / 待确认预览 preview / 探测游标 handledMessageId
 * 需要左右两侧（AgentPanel 纯对话 + TableWorkspacePanel 左面板）共享同一份运行态，
 * 本模块 = 该共享态的**唯一新增枢纽**，不落盘（仅宽度经 agent_split_width 记忆）、不进 conversationState。
 *
 * 铁律（对齐 spec §四.5.1）：
 *  - 不新增存储键 / 事件名 / 会话字段；宽度沿用既有键 `agent_split_width`（STORAGE_KEYS 已登记）。
 *  - 表格数据真相源仍是 per-conversation `memory.assistantTable`；确认/取消写回一律经
 *    conversationStore 唯一入口（get/setCurrentAssistantTable / get/setCurrentGlobalContract /
 *    markMessageTableResolved），本模块不绕过、不裸写。
 *  - 与 conversationState.ts 同款轻量底座：模块级可变 + subscribe + useSyncExternalStore。
 *  - confirmTablePreview / cancelTablePreview 是纯模块函数（无 React state），可直接单测。
 *
 * 语义要点：
 *  - 关面板 = 关协作：closeTableWorkspace 同时清 selectedRowId/preview/handledMessageId；
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
import { mergeRowFromObj, jsonToSb } from './assistantTable.ts';
import type { AssistantTableJson } from './assistantTable.ts';

/** 左面板宽度记忆键（沿用拆分前「左表 | 右对话」分栏键，避免旧数据丢失；STORAGE_KEYS 已登记） */
const WIDTH_KEY = 'agent_split_width';
const WIDTH_MIN = 360;
const WIDTH_MAX = 760;
const WIDTH_DEFAULT = 600;

/** 待确认预览：存 raw JSON + 来源消息 + 探测当下选中行；计算模型（buildPreviewModel）由消费方派生 */
export interface TableWorkspacePreview {
  json: AssistantTableJson;
  messageId: unknown;
  rowId: string | null;
}

/** 共享「表格工作区运行态」形状（spec §四.5.1） */
export interface TableWorkspaceState {
  /** 表格工作区开合（左面板滑出 = 表格协作激活） */
  open: boolean;
  /** 左面板宽（px，clamp 360~760，localStorage agent_split_width） */
  width: number;
  /** 选中行（AI 注入「改单行」读；AssistantTablePanel onSelectRow lift 落点） */
  selectedRowId: string | null;
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
  selectedRowId: null,
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
  setState({ ...state, open: false, selectedRowId: null, preview: null, handledMessageId: null });
}

/** 左面板宽度（px）：clamp 360~760 + 写 agent_split_width 记忆 */
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

/** 选中行（null=取消选中）；供左面板 AssistantTablePanel onSelectRow lift 与右侧注入共用 */
export function setTableWorkspaceRow(rowId: string | null): void {
  setState({ ...state, selectedRowId: rowId });
}

/** 探测命中：AI 返回表格 JSON → 置待确认预览（确认/取消才写回正式表） */
export function acceptTablePreview(p: TableWorkspacePreview): void {
  setState({ ...state, preview: p });
}

/** 探测游标推进：该消息已处理过（表格回复/普通回复/已确认取消），刷新/重渲不重弹 */
export function markTableMessageHandled(messageId: unknown): void {
  setState({ ...state, handledMessageId: messageId });
}

/**
 * 确认写回（模块化，替代原 AgentPanel confirmTablePreview）：
 *  - 单行（有 rowId 且 AI 只回 1 行）→ mergeRowFromObj 只覆盖该行已有列；
 *  - 整表 → jsonToSb 全量替换列+行，globalStyle 同步（保留 visual_positioning / negative）；
 *  - 写回 + markMessageTableResolved('confirmed') + 清 preview（左面板预览卡卸载，消息流留 pv-done 痕迹）。
 */
export function confirmTablePreview(): void {
  const p = state.preview;
  if (!p) return;
  const { json, rowId } = p;
  const rows = Array.isArray(json.rows) ? json.rows : [];
  const current = getCurrentAssistantTable();
  if (rowId && rows.length === 1 && rows[0] && typeof rows[0] === 'object') {
    const next = mergeRowFromObj(current, rowId, rows[0] as Record<string, unknown>);
    if (next !== current) setCurrentAssistantTable(next);
  } else {
    const { globalStyle: gs, sb: next } = jsonToSb(json);
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
    if (next.columns.length > 0) setCurrentAssistantTable(next);
  }
  markMessageTableResolved(p.messageId, 'confirmed');
  setState({ ...state, preview: null });
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
  setState({ ...state, selectedRowId: null, preview: null, handledMessageId: null });
}
