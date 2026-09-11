// @vitest-environment jsdom
/**
 * useNodeExpanded 单测（收口：4 节点逐字重复的「展开态 state + 写回 data.expanded + 外部同步」）。
 * 覆盖三条语义：
 *  1) 初始态：data.expanded 未定义 → 默认展开（true）；显式 false → 收起
 *  2) 本地 toggle → 写回 node.data.expanded
 *  3) 外部 data.expanded 变化（Tab 快捷键 / Agent update_node）→ 同步回本地 state
 * 用 vi.mock 隔离 @xyflow/react（仅取 useReactFlow().setNodes）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const setNodesMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: setNodesMock }),
}));

const { useNodeExpanded } = await import('../../src/hooks/useNodeExpanded.ts');

/** 取最后一次写回 patch 到目标节点后的 data（模拟 reactflow 的不可变局部更新） */
function lastPatchedData(): Record<string, unknown> {
  const calls = setNodesMock.mock.calls;
  const updater = calls[calls.length - 1][0];
  const ns = [{ id: 'n1', data: { keep: 1 } }];
  return updater(ns)[0].data;
}

describe('useNodeExpanded — 初始态', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('data.expanded 未定义 → 默认展开，且挂载时把当前展开态写回 data', () => {
    const { result } = renderHook(() => useNodeExpanded('n1', undefined));
    expect(result.current.expanded).toBe(true);
    expect(lastPatchedData()).toEqual({ keep: 1, expanded: true });
  });

  it('data.expanded=false → 初始收起', () => {
    const { result } = renderHook(() => useNodeExpanded('n1', false));
    expect(result.current.expanded).toBe(false);
  });
});

describe('useNodeExpanded — toggle 与写回', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('toggleExpanded 翻转本地 state 并写回 data.expanded', () => {
    const { result } = renderHook(() => useNodeExpanded('n1', true));
    expect(result.current.expanded).toBe(true);

    act(() => result.current.toggleExpanded());
    expect(result.current.expanded).toBe(false);
    expect(lastPatchedData()).toEqual({ keep: 1, expanded: false });

    act(() => result.current.toggleExpanded());
    expect(result.current.expanded).toBe(true);
    expect(lastPatchedData()).toEqual({ keep: 1, expanded: true });
  });

  it('setExpanded(false)（节点自定义 toggle 语义，如 TextGenerate 输入锁）同样写回', () => {
    const { result } = renderHook(() => useNodeExpanded('n1', true));
    act(() => result.current.setExpanded(false));
    expect(result.current.expanded).toBe(false);
    expect(lastPatchedData()).toEqual({ keep: 1, expanded: false });
  });
});

describe('useNodeExpanded — 外部 data.expanded 同步（Tab / Agent）', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('外部改 data.expanded → 同步回本地 state（本地不受控于自身写回）', () => {
    const { result, rerender } = renderHook(
      ({ d }: { d: boolean | undefined }) => useNodeExpanded('n1', d),
      { initialProps: { d: undefined as boolean | undefined } },
    );
    expect(result.current.expanded).toBe(true);

    rerender({ d: false });
    expect(result.current.expanded).toBe(false);

    rerender({ d: true });
    expect(result.current.expanded).toBe(true);
  });

  it('外部为 undefined 时不覆盖本地 state（未声明即不干预）', () => {
    const { result, rerender } = renderHook(
      ({ d }: { d: boolean | undefined }) => useNodeExpanded('n1', d),
      { initialProps: { d: undefined as boolean | undefined } },
    );
    act(() => result.current.setExpanded(false));

    rerender({ d: undefined });
    expect(result.current.expanded).toBe(false);
  });
});
