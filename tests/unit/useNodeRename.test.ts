// @vitest-environment jsdom
/**
 * useNodeRename 单测（收口：8 处逐字重复的「标题改名 → 写回 data.label」）。
 * 用 vi.mock 隔离 @xyflow/react（仅取 useReactFlow().setNodes），不依赖真实 ReactFlowProvider。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const setNodesMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: setNodesMock }),
}));

const { useNodeRename } = await import('../../src/hooks/useNodeRename.ts');

describe('useNodeRename — 写回 data.label', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('不可变局部更新：只改目标节点 label，其它字段/其它节点引用不动', () => {
    const ns = [
      { id: 'n1', data: { label: '旧名', prompt: 'p' } },
      { id: 'n2', data: { label: '别动' } },
    ];
    let updater: ((ns: unknown) => unknown) | undefined;
    setNodesMock.mockImplementation((u) => {
      updater = u;
    });
    const { result } = renderHook(() => useNodeRename('n1'));

    act(() => result.current('新名'));
    expect(typeof updater).toBe('function');

    const next = (updater as (ns: unknown) => typeof ns)(ns);
    expect(next).not.toBe(ns);
    expect(next[0]).toEqual({ id: 'n1', data: { label: '新名', prompt: 'p' } });
    expect(next[1]).toBe(ns[1]); // 其它节点元素引用不动
  });

  it('目标节点不存在时不炸：节点数组内容原样返回', () => {
    const ns = [{ id: 'n1', data: { label: 'x' } }];
    let updater: ((ns: unknown) => unknown) | undefined;
    setNodesMock.mockImplementation((u) => {
      updater = u;
    });
    const { result } = renderHook(() => useNodeRename('missing'));

    act(() => result.current('新名'));
    const next = (updater as (ns: unknown) => typeof ns)(ns);
    expect(next).toEqual(ns);
    expect(next[0]).toBe(ns[0]);
  });
});
