/**
 * AI 助手表格 —— 撤销/重做栈（纯运行态、不落盘，spec 3.4）。
 *
 * 设计（对齐 spec §2「撤销/重做」）：
 *  - 快照 = 整份 `AssistantTableTabs` 的引用（模型层本就不可变更新，存引用几乎零成本）。
 *  - 入栈时机：只在「commit」后进（改格提交、加/删/移/复制行、列增删改名、列宽落点、粘贴、清空、
 *    AI 确认写回、关闭 tab、批量删除/粘贴/跨表复制、重命名 tab）；草稿逐键不入。
 *  - 撤销/重做 = 弹出快照 → 由调用方 setCurrentAssistantTabs(snapshot) + 清本地草稿。
 *    跨 tab 也成立（快照是整份 tabs）。
 *  - 栈上限 50（超出丢最旧）；新 commit 清空 redo（future）。
 *  - 纯函数/模块级可变 + subscribe + useSyncExternalStore（对齐 tableWorkspaceState 底座）。
 *  - ❌ 不绑 Ctrl/Cmd+Z 快捷键（与画布 undo / 单元格 textarea 三方抢键，spec 3.4 裁定只走按钮）。
 */
import { useRef, useSyncExternalStore } from 'react';
import type { AssistantTableTabs } from './assistantTable.ts';

const MAX_STEPS = 50;

/** past：每次 commit「之前」的 tabs 快照（撤销目标）；future：被撤销出来的状态（可重做） */
let past: AssistantTableTabs[] = [];
let future: AssistantTableTabs[] = [];

const listeners = new Set<() => void>();
function emit(): void {
  listeners.forEach((l) => l());
}

/** commit 前快照入栈（仅 commit 后进；新 commit 清空 redo）；上限 50 丢最旧 */
export function pushHistory(snapshot: AssistantTableTabs): void {
  if (!snapshot) return;
  past = [...past, snapshot].slice(-MAX_STEPS);
  future = [];
  emit();
}

/** 清空（切对话/硬重置用，防串表） */
export function clearHistory(): void {
  past = [];
  future = [];
  emit();
}

export function canUndo(): boolean {
  return past.length > 0;
}

export function canRedo(): boolean {
  return future.length > 0;
}

export interface TableHistoryRead {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * 撤销一步：把 currentTabs（当前已应用态）压入 future，返回到 past 顶部快照。
 * 调用方拿到非 undefined 后执行 setCurrentAssistantTabs(snapshot)。无可撤销返回 undefined。
 */
export function undoTable(currentTabs: AssistantTableTabs): AssistantTableTabs | undefined {
  if (past.length === 0) return undefined;
  const prev = past.pop()!;
  future = [...future, currentTabs];
  emit();
  return prev;
}

/** 重做一步：把 currentTabs 压入 past，返回 future 顶部快照。无可重做返回 undefined。 */
export function redoTable(currentTabs: AssistantTableTabs): AssistantTableTabs | undefined {
  if (future.length === 0) return undefined;
  const next = future.pop()!;
  past = [...past, currentTabs].slice(-MAX_STEPS);
  emit();
  return next;
}

/** 订阅（供 useTableHistory 按钮 disabled 驱动） */
export function subscribeHistory(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 组件 hook：读 canUndo/canRedo 驱动工具条 ⟲/⟳ disabled。
 *  ⚠️ useSyncExternalStore 的 getSnapshot 必须返回**引用稳定**的对象（否则每次都被判 changed → 无限重渲），
 *  但**引用稳定 ≠ 可以永远返回同一个对象**：React 用 `is(prev, next)` 判定要不要重渲，
 *  恒定引用会让 `emit()` 永远判「没变」，订阅形同虚设（2026-09-07 修：原先在 render 里原地改 ref 字段，
 *  按钮 disabled 只是靠「pushHistory 紧跟 store 写入 → 顺带重渲」碰巧正确，任何不经 store 的入栈都会僵住）。
 *  正解：值真变了才**换一个新对象**，值没变就回同一引用。 */
export function useTableHistory(): TableHistoryRead {
  const cached = useRef<TableHistoryRead>({ canUndo: canUndo(), canRedo: canRedo() });
  const getSnapshot = (): TableHistoryRead => {
    const u = canUndo();
    const r = canRedo();
    if (cached.current.canUndo !== u || cached.current.canRedo !== r) {
      cached.current = { canUndo: u, canRedo: r };
    }
    return cached.current;
  };
  return useSyncExternalStore(subscribeHistory, getSnapshot, getSnapshot);
}
