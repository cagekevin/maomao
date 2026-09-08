/**
 * AI 助手表格 —— id 生成收口（spec/AI-ASSISTANT-TABLE-INVARIANTS.md §§七.L1）。
 *
 * 所有表格 id 生成唯一走这里，禁止在 assistantTable.ts 之外散落 generateId('col'|'row'|'tab')。
 * 前缀必须带 `a`（agent 表格领域）：
 *   - 裸 `generateId('tab')` 被浏览器窗口 id 占用（useCanvasSync.ts:30），与表格标签页撞前缀、
 *     妨碍 grep 排障 —— 2026-09-08 收口换 `atab` 避让。
 *   - col/row 同步用 `acol`/`arow`，与 tab 前缀区分、便于一眼看某 id 属于表格哪个维度。
 * 语义：只换成更易懂的前缀，仍是 generateId（集中 ID 工具），幂等唯一格式不变。
 */
import { generateId } from '@/components/base/core/idGen.ts';

/** 新 tab id（前缀 atab） */
export const newTabId = () => generateId('atab');
/** 新列 id（前缀 acol） */
export const newColId = () => generateId('acol');
/** 新行 id（前缀 arow） */
export const newRowId = () => generateId('arow');