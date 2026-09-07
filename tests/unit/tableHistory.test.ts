import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushHistory,
  clearHistory,
  canUndo,
  canRedo,
  undoTable,
  redoTable,
  useTableHistory,
} from '../../src/components/agent/assistantTable/tableHistory.ts';
import {
  emptyAssistantTabs,
  addTab,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import type { AssistantTableTabs } from '../../src/components/agent/assistantTable/assistantTable.ts';

/**
 * 表格层撤销栈（spec 3.4 / 验收第 7 条）：
 *  - 上限 50 丢最旧；新 commit 清空 redo 分支；
 *  - 撤销/重做 = 弹快照（调用方落盘），快照是整份 tabs（跨 tab 成立）；
 *  - 切对话必须 clearHistory（否则会把 A 对话的 tabs 写进 B 对话 —— 落盘污染）。
 */
describe('表格撤销栈（tableHistory）', () => {
  beforeEach(() => {
    clearHistory();
  });

  const snapAt = (n: number): AssistantTableTabs => {
    let t = emptyAssistantTabs();
    for (let i = 1; i < n; i++) t = addTab(t);
    return t;
  };

  it('初始无可撤销/可重做', () => {
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(undoTable(snapAt(1))).toBeUndefined();
    expect(redoTable(snapAt(1))).toBeUndefined();
  });

  it('入栈后可撤销，撤销后可重做，且回到入栈时的快照', () => {
    const before = snapAt(1);
    const after = snapAt(3);
    pushHistory(before);
    expect(canUndo()).toBe(true);

    const undone = undoTable(after);
    expect(undone).toBe(before); // 原样引用，不重建（模型层不可变更新）
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(true);

    const redone = redoTable(before);
    expect(redone).toBe(after);
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
  });

  it('新 commit 清空 redo 分支（撤销后改 → 原未来不可达）', () => {
    pushHistory(snapAt(1));
    undoTable(snapAt(2));
    expect(canRedo()).toBe(true);
    pushHistory(snapAt(2)); // 新一次 commit
    expect(canRedo()).toBe(false);
  });

  it('上限 50：超出丢最旧，可撤销数不超过 50', () => {
    for (let i = 0; i < 60; i++) pushHistory(snapAt(1));
    let n = 0;
    while (canUndo()) {
      undoTable(snapAt(1));
      n += 1;
      if (n > 100) break; // 死循环保险
    }
    expect(n).toBe(50);
  });

  it('clearHistory 一次清干净（切对话防跨对话污染）', () => {
    pushHistory(snapAt(1));
    pushHistory(snapAt(2));
    expect(canUndo()).toBe(true);
    clearHistory();
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(undoTable(snapAt(1))).toBeUndefined();
  });

  it('pushHistory 忽略空快照（防脏数据把栈打穿）', () => {
    pushHistory(null as unknown as AssistantTableTabs);
    expect(canUndo()).toBe(false);
  });

  it('导出 useTableHistory 供工具条 ⟲/⟳ disabled 驱动（spec 3.4 唯一入口）', () => {
    expect(typeof useTableHistory).toBe('function');
  });
});
