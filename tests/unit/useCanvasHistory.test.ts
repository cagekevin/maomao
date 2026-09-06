// @vitest-environment jsdom
/**
 * useCanvasHistory 单测（批 1-8，hook 桥接）。
 * 覆盖：返回 canUndo/canRedo/record/undo/redo/clear；record 后 canUndo 为真；
 * undo 将历史快照应用到 apply；空历史时 undo/redo 安全不抛。
 * 策略：jsdom + @testing-library/react renderHook；HistoryStack 走真实纯类（已有独立单测），
 * 这里只验证 React 桥接层。提供 getSnapshot 与 apply 两个注入函数。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@xyflow/react';
import type { CanvasSnapshot } from '../../src/hooks/useCanvasHistory.ts';

const { useCanvasHistory } = await import('../../src/hooks/useCanvasHistory.ts');

// CanvasSnapshot.nodes 是 xyflow 完整 Node[]（需 id/position/data），edges 是 Edge[]。
// 测试只关心 id 差异，故用最小合规形状构造，去掉原先的 `as any`。
function snap(id: string): CanvasSnapshot {
  return { nodes: [{ id, position: { x: 0, y: 0 }, data: {} }], edges: [] };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCanvasHistory — 基础', () => {
  it('初始 canUndo/canRedo 均为 false，暴露 record/undo/redo/clear', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(
        () => ({ nodes: [], edges: [] }),
        () => {},
      ),
    );
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(typeof result.current.record).toBe('function');
    expect(typeof result.current.undo).toBe('function');
    expect(typeof result.current.redo).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('空历史时 undo/redo 不抛错', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(
        () => ({ nodes: [], edges: [] }),
        () => {},
      ),
    );
    expect(() => act(() => result.current.undo())).not.toThrow();
    expect(() => act(() => result.current.redo())).not.toThrow();
  });
});

describe('useCanvasHistory — 记录与撤销', () => {
  it('record 两次后 canUndo 为真；undo 把上一份快照交给 apply', () => {
    const apply = vi.fn();
    const s1 = snap('n1');
    const s2 = snap('n2');
    const { result } = renderHook(() => useCanvasHistory(() => ({ nodes: [], edges: [] }), apply));

    act(() => result.current.record(s1));
    act(() => result.current.record(s2));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(apply).toHaveBeenCalledWith(s1);
  });

  it('redo 在 undo 后可用', () => {
    const apply = vi.fn();
    const s1 = snap('a');
    const s2 = snap('b');
    const { result } = renderHook(() => useCanvasHistory(() => ({ nodes: [], edges: [] }), apply));

    act(() => result.current.record(s1));
    act(() => result.current.record(s2));
    act(() => result.current.undo()); // 回到 s1
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo()); // 回到 s2
    expect(apply).toHaveBeenLastCalledWith(s2);
  });

  it('clear 清空历史，canUndo 回到 false', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(
        () => ({ nodes: [], edges: [] }),
        () => {},
      ),
    );
    act(() => result.current.record({ nodes: [], edges: [] }));
    act(() => result.current.record(snap('x')));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.clear());
    expect(result.current.canUndo).toBe(false);
  });
});
