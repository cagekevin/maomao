import { describe, it, expect, vi } from 'vitest';
import {
  buildSpawnNodes,
  commitNewNodes,
  spawnAndCommit,
  makeChildId,
} from '../../src/components/base/canvas/deriveNodes.ts';

describe('buildSpawnNodes', () => {
  const parent = { id: 'p1', position: { x: 100, y: 200 } };

  it('生成子节点并自动连线（source=父,target=子，默认 id 前缀）', () => {
    const { childNodes, edges } = buildSpawnNodes(parent, [
      { type: 'assetNode', data: { label: 'a' } },
      { type: 'textGenerateNode', data: { label: 'b' } },
    ]);
    expect(childNodes).toHaveLength(2);
    expect(edges).toHaveLength(2);
    expect(edges[0].source).toBe('p1');
    expect(edges[0].target).toBe(childNodes[0].id);
    expect(edges[0].id).toBe(`e-p1-${childNodes[0].id}`);
    // 子节点自动偏移（默认 x=base.x+40，y 递增）
    expect(childNodes[0].position.x).toBe(140);
    expect(childNodes[0].position.y).toBe(240);
    expect(childNodes[1].position.y).toBe(440);
  });

  it('保留显式 id 与自定义边选项（sourceHandle/targetHandle/type/animated）', () => {
    const { childNodes, edges } = buildSpawnNodes(
      parent,
      [{ id: 'c1', type: 'assetNode', position: { x: 1, y: 2 }, data: {} }],
      { sourceHandle: 'merged-output', targetHandle: null, type: 'default', animated: false },
    );
    expect(childNodes[0].id).toBe('c1');
    expect(childNodes[0].position).toEqual({ x: 1, y: 2 });
    expect(edges[0].sourceHandle).toBe('merged-output');
    expect(edges[0].targetHandle).toBe(null);
    expect(edges[0].type).toBe('default');
    expect(edges[0].animated).toBe(false);
  });

  it('不传子节点位置时基于父节点偏移', () => {
    const { childNodes } = buildSpawnNodes(parent, [{ type: 'a', data: {} }]);
    expect(childNodes[0].position.x).toBe(140);
    expect(childNodes[0].position.y).toBe(240);
  });
});

describe('makeChildId', () => {
  it('返回带语义前缀 + 唯一后缀的 id', () => {
    const a = makeChildId('text-split');
    const b = makeChildId('text-split');
    expect(a).toMatch(/^text-split-/);
    expect(a).not.toBe(b);
  });
});

describe('commitNewNodes / spawnAndCommit（建节点唯一原语，TD-04-2/04-11）', () => {
  const makeHandles = (nodes = [], edges = []) => ({
    getNodes: () => nodes,
    getEdges: () => edges,
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    history: { record: vi.fn() },
  });

  it('补结构默认：imageGenerateNode 自动补 width/height/style（此前手写 420 与 nodeDefaults 漂移）', () => {
    const handles = makeHandles();
    const out = commitNewNodes(
      { nodes: [{ id: 'n1', type: 'imageGenerateNode', position: { x: 1, y: 2 }, data: {} }] },
      handles,
    );
    expect(out[0].width).toBe(420);
    expect(out[0].height).toBe(420);
    expect(out[0].style).toEqual({ width: 420, height: 420 });
  });

  it('原子提交：setNodes/setEdges 追加 + history.record 一次（含节点与边）', () => {
    const handles = makeHandles([{ id: 'old' }], []);
    const out = commitNewNodes(
      {
        nodes: [{ id: 'n1', type: 'group', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e-n1', source: 'p', target: 'n1' }],
      },
      handles,
    );
    expect(out).toHaveLength(1);
    expect(handles.setNodes).toHaveBeenCalledTimes(1);
    expect(handles.setEdges).toHaveBeenCalledTimes(1);
    expect(handles.history.record).toHaveBeenCalledTimes(1);
    const snap = handles.history.record.mock.calls[0][0];
    expect(snap.nodes.map((n) => n.id)).toEqual(['old', 'n1']);
    expect(snap.edges.map((e) => e.id)).toEqual(['e-n1']);
  });

  it('无 history 时不读 getEdges、不 record（剧本盒等不纳 undo 的场景）', () => {
    const getEdges = vi.fn(() => []);
    const handles = { getNodes: () => [], getEdges, setNodes: vi.fn(), setEdges: vi.fn() };
    commitNewNodes(
      { nodes: [{ id: 'n1', type: 'group', position: { x: 0, y: 0 }, data: {} }] },
      handles,
    );
    expect(getEdges).not.toHaveBeenCalled();
    expect(handles.setNodes).toHaveBeenCalledTimes(1);
  });

  it('spawnAndCommit 是 commitNewNodes 的薄包装（行为一致）', () => {
    const handles = makeHandles();
    const spawned = buildSpawnNodes({ id: 'p1', position: { x: 0, y: 0 } }, [
      { id: 'c1', type: 'assetNode', data: {} },
    ]);
    const out = spawnAndCommit(spawned, handles);
    expect(out.map((n) => n.id)).toEqual(['c1']);
    expect(handles.history.record).toHaveBeenCalledTimes(1);
  });
});
