import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
  applyStructuralSnapshot,
  extractStructuralSnapshot,
  isSameStructure,
} from '../../src/components/base/canvas/structuralSnapshot.ts';

/**
 * TD-04-31 · 结构化撤销（对标对方 plans/2026-07-24）。
 *
 * 核心契约（必须钉死，这是本债的全部价值）：
 *  ① 提取只留结构字段（id/type/parentId + 边端点）→ 快照不随 data 体积膨胀；
 *  ② **撤销不回退位置/尺寸/普通内容**（现存节点保留当前值）；
 *  ③ 结构差异只做增删（撤销一次删除 = 重建；撤销一次新建 = 移除）；
 *  ④ 结构相同判等（用于"结构没变不重复入栈"）。
 */
function node(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    type: 'imageBox',
    position: { x: 10, y: 20 },
    data: { label: 'x' },
    ...extra,
  } as Node;
}

describe('TD-04-31 · 结构快照提取', () => {
  it('只留结构字段：position / width / height / data 不进快照', () => {
    const s = extractStructuralSnapshot(
      [node('n1', { width: 200, height: 100, data: { label: '长内容', big: 'x'.repeat(9999) } })],
      [],
    );
    expect(s.nodes).toEqual([{ id: 'n1', type: 'imageBox' }]);
    // 快照里不含任何位置/尺寸/内容字段
    expect(JSON.stringify(s)).not.toContain('position');
    expect(JSON.stringify(s)).not.toContain('9999-');
  });

  it('parentId 属结构（编组归属），缺省则不写入', () => {
    const s = extractStructuralSnapshot([node('c1', { parentId: 'g1' }), node('n2')], []);
    expect(s.nodes[0]).toEqual({ id: 'c1', type: 'imageBox', parentId: 'g1' });
    expect(s.nodes[1]).toEqual({ id: 'n2', type: 'imageBox' });
    expect('parentId' in s.nodes[1]).toBe(false);
  });

  it('边只留端点结构；sourceHandle/targetHandle 有才写', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: null },
      { id: 'e2', source: 'b', target: 'c' },
    ] as unknown as Edge[];
    const s = extractStructuralSnapshot([], edges);
    expect(s.edges[0]).toEqual({
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'out',
    });
    expect(s.edges[1]).toEqual({ id: 'e2', source: 'b', target: 'c' });
  });
});

describe('TD-04-31 · 撤销不回退位置/尺寸/内容（核心）', () => {
  it('结构相同、但当前位置/内容已变 → 撤销后保留**当前**位置与内容', () => {
    // 历史快照（结构 n1）—— 当时 position 是 (10,20)、内容 'x'
    const snap = extractStructuralSnapshot([node('n1')], []);
    // 用户之后把节点拖到了 (999,888)、改了内容（这些**不进** history）
    const current = [
      node('n1', {
        position: { x: 999, y: 888 },
        width: 777,
        data: { label: '用户改过的新内容' },
      }),
    ];
    const out = applyStructuralSnapshot(current, [], snap);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].position).toEqual({ x: 999, y: 888 });
    expect(out.nodes[0].width).toBe(777);
    expect(out.nodes[0].data).toEqual({ label: '用户改过的新内容' });
  });

  it('撤销一次「新建」→ 该节点被移除，其余节点位置不动', () => {
    const beforeAdd = extractStructuralSnapshot([node('a')], []);
    const current = [
      node('a', { position: { x: 5, y: 5 } }),
      node('new', { position: { x: 1, y: 1 } }),
    ];
    const out = applyStructuralSnapshot(current, [], beforeAdd);
    expect(out.nodes.map((n) => n.id)).toEqual(['a']);
    expect(out.nodes[0].position).toEqual({ x: 5, y: 5 }); // 未被回退
  });

  it('撤销一次「删除」→ 节点被重建（结构回来了）', () => {
    const withNode = extractStructuralSnapshot([node('a'), node('b', { parentId: 'a' })], []);
    const current = [node('a', { position: { x: 3, y: 3 } })]; // b 已被删
    const out = applyStructuralSnapshot(current, [], withNode);
    expect(out.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.nodes[0].position).toEqual({ x: 3, y: 3 }); // a 位置保留
    expect(out.nodes[1].parentId).toBe('a'); // 归属结构恢复
  });
});

describe('TD-04-31 · 结构判等（防重复入栈）', () => {
  it('结构相同 → true（即使位置/内容不同）', () => {
    const a = extractStructuralSnapshot([node('n1')], []);
    const b = extractStructuralSnapshot(
      [node('n1', { position: { x: 999, y: 999 }, data: { label: 'other' } })],
      [],
    );
    expect(isSameStructure(a, b)).toBe(true);
  });

  it('节点数 / id / type / parentId / 顺序 任一不同 → false', () => {
    const base = extractStructuralSnapshot([node('n1')], []);
    expect(isSameStructure(base, extractStructuralSnapshot([node('n1'), node('n2')], []))).toBe(
      false,
    );
    expect(
      isSameStructure(base, extractStructuralSnapshot([node('n1', { type: 'text' })], [])),
    ).toBe(false);
    expect(
      isSameStructure(base, extractStructuralSnapshot([node('n1', { parentId: 'g' })], [])),
    ).toBe(false);
    // 顺序不同 = 结构不同（渲染叠放顺序可见）
    const two = extractStructuralSnapshot([node('a'), node('b')], []);
    const rev = extractStructuralSnapshot([node('b'), node('a')], []);
    expect(isSameStructure(two, rev)).toBe(false);
  });

  it('边结构变化 → false', () => {
    const noEdge = extractStructuralSnapshot([], []);
    const withEdge = extractStructuralSnapshot([], [
      { id: 'e1', source: 'a', target: 'b' },
    ] as unknown as Edge[]);
    expect(isSameStructure(noEdge, withEdge)).toBe(false);
  });
});
