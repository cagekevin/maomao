/**
 * 框选误选守卫单测（2026-11-01 · 用户报障修复）。
 *
 * 守的是：框选时**框外的节点不许被选中**（React Flow 对 `handleBounds` 缺失的节点会
 * 无条件判进框选结果，见 selectionGuard.ts 文件头）。
 * 同时守反向：**框内的节点必须照常选中**（不能把正常框选搞坏）。
 */
import { describe, it, expect } from 'vitest';
import { filterSelectionOutsideRect } from '../../src/components/canvas/structure/selectionGuard.ts';

/** 造一个「框选产生的选中」变更 */
const selectChange = (id: string, selected = true) => ({ type: 'select' as const, id, selected });

/** 造节点几何 */
const geo = (id: string, x: number, y: number, w = 420, h = 420) => ({
  id,
  x,
  y,
  width: w,
  height: h,
});

/** 造一个按 id 查几何的解析器（未知 id → null） */
const resolver =
  (nodes: Array<ReturnType<typeof geo>>) =>
  (id: string): ReturnType<typeof geo> | null =>
    nodes.find((n) => n.id === id) ?? null;

describe('filterSelectionOutsideRect（框选误选守卫）', () => {
  const rect = { x: 0, y: 0, width: 400, height: 400 };

  it('框外的节点被选中 → 丢弃该变更（核心：用户报障的那个 bug）', () => {
    const far = geo('far', 9000, 9000); // 远在 (9000,9000)，框在原点
    const out = filterSelectionOutsideRect([selectChange('far')], rect, resolver([far]));
    expect(out).toHaveLength(0);
  });

  it('框内的节点 → 保留（不能误伤正常框选）', () => {
    const inside = geo('in', 100, 100); // 完全落在框内
    const out = filterSelectionOutsideRect([selectChange('in')], rect, resolver([inside]));
    expect(out).toHaveLength(1);
  });

  it('部分相交（框只擦到节点一角）→ 保留（与 getNodesInside 的"有交即中"同口径）', () => {
    const edge = geo('edge', 350, 350); // 350~770，与 0~400 相交
    const out = filterSelectionOutsideRect([selectChange('edge')], rect, resolver([edge]));
    expect(out).toHaveLength(1);
  });

  it('边缘刚好接触（无面积重叠）→ 丢弃', () => {
    const touch = geo('touch', 400, 0); // x 从 400 起，与 0~400 仅边界相接
    const out = filterSelectionOutsideRect([selectChange('touch')], rect, resolver([touch]));
    expect(out).toHaveLength(0);
  });

  it('rect 为 null（非框选路径）→ **原样放行**（点击选中/Ctrl+A 不受影响）', () => {
    const changes = [selectChange('a'), selectChange('b')];
    const out = filterSelectionOutsideRect(changes, null, resolver([]));
    expect(out).toBe(changes); // 同一引用，不做无谓重建
  });

  it('几何不可用（未测量/查不到）→ 放行（宁多选不漏选）', () => {
    const out = filterSelectionOutsideRect([selectChange('unknown')], rect, () => null);
    expect(out).toHaveLength(1);
  });

  it('只过滤"选中"，**取消选中**一律放行（否则框外节点永远无法取消选中）', () => {
    const far = geo('far', 9000, 9000);
    const out = filterSelectionOutsideRect([selectChange('far', false)], rect, resolver([far]));
    expect(out).toHaveLength(1);
  });

  it('非 select 变更（position/dimensions 等）一律放行', () => {
    const far = geo('far', 9000, 9000);
    const changes = [
      { type: 'position', id: 'far', position: { x: 1, y: 1 } },
      { type: 'dimensions', id: 'far', dimensions: { width: 10, height: 10 } },
    ];
    const out = filterSelectionOutsideRect(changes, rect, resolver([far]));
    expect(out).toHaveLength(2);
  });

  it('混合场景：框内保留、框外丢弃（一次框选同时命中多个）', () => {
    const nodes = [
      geo('a', 10, 10),
      geo('b', 200, 200),
      geo('far1', 9000, 9000),
      geo('far2', -9000, -9000),
    ];
    const out = filterSelectionOutsideRect(
      ['a', 'b', 'far1', 'far2'].map((id) => selectChange(id)),
      rect,
      resolver(nodes),
    );
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('全部命中时返回**原引用**（避免无谓重渲染）', () => {
    const nodes = [geo('a', 10, 10)];
    const changes = [selectChange('a')];
    const out = filterSelectionOutsideRect(changes, rect, resolver(nodes));
    expect(out).toBe(changes);
  });

  it('零尺寸框选矩形（刚开始拖、还没拉开）→ 原样放行（不误杀）', () => {
    const changes = [selectChange('far')];
    const out = filterSelectionOutsideRect(
      changes,
      { x: 0, y: 0, width: 0, height: 0 },
      resolver([]),
    );
    expect(out).toBe(changes);
  });
});
