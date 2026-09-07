/**
 * arrangePack.packComponents 单测（清爽总览方案 · 步骤 4）。
 * 覆盖：空输入 / 单点 / 方形视窗选行列 / 宽视窗偏向多列 / 兜底视窗 / 间距生效。
 * 关键：取 fitView 后真实缩放最大（scale = min(vw/W, vh/H, maxZoom)）的行列分布；
 *      同分取更大的 perRow（更贴从左到右阅读流向）。
 */
import { describe, it, expect } from 'vitest';
import { packComponents } from '../../src/components/base/utils/arrangePack.ts';

describe('packComponents', () => {
  it('空输入 → perRow=0、无占位、零包围盒', () => {
    const r = packComponents([], { gapX: 180, gapY: 120 });
    expect(r.perRow).toBe(0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
    expect(r.placements).toEqual([]);
  });

  it('单点 → perRow=1，占位 (0,0)，包围盒即该分量', () => {
    const r = packComponents([{ width: 100, height: 50 }], { gapX: 180, gapY: 120 });
    expect(r.perRow).toBe(1);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.placements).toEqual([{ x: 0, y: 0 }]);
  });

  it('方形视窗、4 等块 → 选每行 2 个（2×2 填满方框，缩放最大）', () => {
    const boxes = [
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ];
    const r = packComponents(boxes, {
      gapX: 0,
      gapY: 0,
      viewport: { width: 400, height: 400 },
      maxZoom: 10,
    });
    expect(r.perRow).toBe(2);
    expect(r.placements).toHaveLength(4);
  });

  it('宽视窗、6 等块 → 偏向多列（每行 3 个），而非一列到底', () => {
    const boxes = Array.from({ length: 6 }, () => ({ width: 100, height: 100 }));
    const r = packComponents(boxes, {
      gapX: 0,
      gapY: 0,
      viewport: { width: 1600, height: 1000 },
      maxZoom: 10,
    });
    // 每行 3 列 → H=200、W=300 → scale=min(5.33,5)=5，优于 1/2 列
    expect(r.perRow).toBe(3);
  });

  it('兜底视窗（未提供 viewport）→ 退化 1600×900，结果确定', () => {
    const boxes = [
      { width: 300, height: 300 },
      { width: 300, height: 300 },
    ];
    const r = packComponents(boxes, { gapX: 0, gapY: 0, maxZoom: 10 });
    // 每行 2 个：W=600、H=300 → scale=min(2.67,3)=2.67 > 单列(1.5)，故 perRow=2
    expect(r.perRow).toBe(2);
    expect(r.placements).toHaveLength(2);
  });

  it('间距生效：横向占位推进含 gapX；纵向换行含 gapY', () => {
    // 横向：2 个并排，perRow=2，gapX=20 → 每行宽 220、第二块 x=120
    const wide = packComponents(
      [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
      { gapX: 20, gapY: 50, viewport: { width: 1600, height: 1000 }, maxZoom: 10 },
    );
    expect(wide.perRow).toBe(2);
    expect(wide.width).toBe(220);
    expect(wide.placements[1].x).toBe(120);

    // 纵向：窄视窗强制单列，gapY=50 → 第二块 y=150（100+50）
    const tall = packComponents(
      [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
      { gapX: 20, gapY: 50, viewport: { width: 50, height: 1000 }, maxZoom: 10 },
    );
    expect(tall.perRow).toBe(1);
    expect(tall.height).toBe(250);
    expect(tall.placements[1].y).toBe(150);
  });
});
