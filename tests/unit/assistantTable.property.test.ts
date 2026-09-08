/**
 * AI 助手表格 —— 性质测试（阶段 5 · 必做，2026-09-08）。
 *
 * 下标模型的经典风险是「增删列时忘了同步移动所有行 cells」→ 破坏 O(1) 长度不变量
 * `cells.length === columns.length`。随机操作序列每步断言长度恒等，作为常驻护栏，
 * 比静态校验更能抓住这类运行时错位（copyTab/跨表事故的多发区）。
 * 使用确定性伪随机（固定种子），不引入 flaky；列增删/行增删/建表/AI 写入全覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  addColumn,
  insertColumnAfter,
  deleteColumn,
  addRow,
  deleteRow,
  parsePasted,
  buildPreviewResult,
  updateTab,
  emptyAssistantTabs,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import type { AssistantTableTabs } from '../../src/components/agent/assistantTable/assistantTable.ts';

/** 长度不变量：所有 tab 的所有行恒成立 */
function lengthOk(tabs: AssistantTableTabs): boolean {
  return tabs.tabs.every((t) => t.rows.every((r) => r.cells.length === t.columns.length));
}

/** 确定性伪随机（LCG，固定种子 → 可复现，不 flaky） */
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('assistantTable 性质：cells 长度恒等（阶段5）', () => {
  it('随机增删列/行 × N 后，所有行 cells.length === columns.length 恒成立', () => {
    const rand = seededRand(20260908);
    let tabs = emptyAssistantTabs();
    for (let i = 0; i < 300; i++) {
      const r = rand();
      const t = tabs.tabs.find((x) => x.id === tabs.activeTabId);
      const firstCol = t && t.columns[0] ? t.columns[0].id : undefined;
      const firstRow = t && t.rows[0] ? t.rows[0].id : undefined;
      if (r < 0.3) {
        tabs = updateTab(tabs, tabs.activeTabId, (sb) => addColumn(sb));
      } else if (r < 0.5) {
        tabs = updateTab(tabs, tabs.activeTabId, (sb) => insertColumnAfter(sb, firstCol, 'C'));
      } else if (r < 0.68 && firstCol !== undefined) {
        tabs = updateTab(tabs, tabs.activeTabId, (sb) => deleteColumn(sb, firstCol));
      } else if (r < 0.78) {
        tabs = updateTab(tabs, tabs.activeTabId, (sb) => addRow(sb));
      } else if (r < 0.88 && firstRow !== undefined) {
        tabs = updateTab(tabs, tabs.activeTabId, (sb) => deleteRow(sb, firstRow));
      } else {
        // AI 建表（replace）后仍恒等
        const sb = { columns: t!.columns, rows: t!.rows };
        const res = buildPreviewResult(sb, {
          rows: [{ 场景: 'a' }, { 场景: 'b', 镜头: 'c' }],
        });
        tabs = updateTab(tabs, tabs.activeTabId, () => ({
          columns: res.resultCols,
          rows: res.resultRows,
        }));
      }
      expect(lengthOk(tabs)).toBe(true);
    }
  });

  it('粘贴建表 + normalize 兼容不破坏长度（parsePasted → rows 恒等）', () => {
    const p = parsePasted('场景\t镜头\n室内\t特写', undefined);
    expect(p).not.toBeNull();
    expect(p!.rows.every((r) => r.cells.length === p!.columns.length)).toBe(true);
    expect(p!.rows[0].cells).toEqual(['室内', '特写']);
  });
});
