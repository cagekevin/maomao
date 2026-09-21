// @vitest-environment jsdom
/**
 * useCanvasHistory 单测（批 1-8，hook 桥接）。
 * 覆盖：返回 canUndo/canRedo/record/undo/redo/clear；record 后 canUndo 为真；
 * undo 将历史快照应用到 apply；空历史时 undo/redo 安全不抛；
 * record() 缺省时回退 getSnapshot()；undo/redo 的 suppress 窗口与 600ms 定时释放。
 * 策略：jsdom + @testing-library/react renderHook；HistoryStack 走真实纯类（已有独立单测），
 * 这里只验证 React 桥接层。提供 getSnapshot 与 apply 两个注入函数。
 *
 * 【本文件是该 hook 的唯一落点】`tests/unit/canvasHooks.test.ts` 曾重复覆盖本 hook，
 * 已按该文件头注①「重复覆盖迁专用文件去重」的约定**并入本文件并删除**
 * （TD-04-54 · 2026-09-21）。新断言一律写这里，不要再开第二个文件。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@xyflow/react';
import type { CanvasSnapshot } from '../../src/components/canvas/structure/useCanvasHistory.ts';

const { useCanvasHistory } =
  await import('../../src/components/canvas/structure/useCanvasHistory.ts');

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
    // 【TD-04-31】apply 收到的是「按结构快照恢复后的画布」（不再原样透传输入快照），
    // 故断言契约（结构与 s1 一致）而非对象引用相等。
    const applied = apply.mock.calls.at(-1)![0] as CanvasSnapshot;
    expect(applied.nodes.map((n) => n.id)).toEqual(['n1']);
    expect(applied.edges).toEqual([]);
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
    const applied = apply.mock.calls.at(-1)![0] as CanvasSnapshot;
    expect(applied.nodes.map((n) => n.id)).toEqual(['b']);
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

  it('record 不传 snapshot 时回退用 getSnapshot() 的当前值', () => {
    // 契约（useCanvasHistory.ts:54-60）：不传参 ⇒ 用 getSnapshot()。
    // 反证：把 `snapshot || getSnapshot()` 改成 `snapshot ?? {nodes:[],edges:[]}` ⇒ 本断言红。
    const apply = vi.fn();
    const { result } = renderHook(() => useCanvasHistory(() => snap('x'), apply));

    act(() => result.current.record()); // 不传 ⇒ 回退 getSnapshot()
    act(() => result.current.record(snap('y')));
    act(() => result.current.undo());
    // 入栈的确实是 getSnapshot() 给的那份（'x'），不是空快照、也不是后一条 'y'
    const applied = apply.mock.calls.at(-1)![0] as CanvasSnapshot;
    expect(applied.nodes.map((n) => n.id)).toEqual(['x']);
  });
});

describe('useCanvasHistory — undo/redo 的 suppress 窗口', () => {
  // 语义（historyStack.ts:13-15/52-74）：undo/redo 后进入 suppress（600ms），窗口内 record 被忽略 ——
  // 否则 apply 引发的画布变化会被当成新操作入栈，undo 与 record 互相触发成环。
  // 纯类的 suppress 由 historyStack.test.ts 覆盖；**这里只锁 hook 层的定时释放接线**
  // （scheduleRelease → stack.releaseSuppress，600ms）。
  it('suppress 期内 record 被忽略；600ms 后恢复可记录（截断 redo 分支）', () => {
    vi.useFakeTimers();
    try {
      const apply = vi.fn();
      const { result } = renderHook(() => useCanvasHistory(() => snap('a'), apply));

      act(() => result.current.record(snap('a')));
      act(() => result.current.record(snap('b')));
      act(() => result.current.undo()); // 进入 suppress，并留下可 redo 的分支
      expect(result.current.canRedo).toBe(true);

      // suppress 期内 record ⇒ 被忽略：没有截断 redo 分支（canRedo 仍为 true）
      act(() => result.current.record(snap('c')));
      expect(result.current.canRedo).toBe(true);

      // 窗口过去 ⇒ 定时释放生效，record 恢复：新操作截断 redo 分支（canRedo 变 false）
      act(() => vi.advanceTimersByTime(600));
      act(() => result.current.record(snap('d')));
      expect(result.current.canRedo).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useCanvasHistory — 返回值引用稳定性（TD-04-39）', () => {
  // 返回值经 `CanvasEdgesProvider` 直接作 Context value（Provider 只透传、不加工）。
  // `React.memo` 只挡 props、**挡不住 context** ⇒ 它每换一次引用，画布上 11 个节点组件
  // 全部重渲（拖拽期间 App 每帧重渲 ⇒ 全部节点每帧重渲，是拖拽卡顿的头号放大器）。
  it('实参稳定 ⇒ 跨渲染返回同一引用', () => {
    // 反证：把 :111 的 useMemo 改回裸对象字面量 ⇒ 本断言红。
    const getSnapshot = () => ({ nodes: [], edges: [] });
    const apply = () => {};
    const { result, rerender } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    rerender();
    expect(result.current).toBe(first);
  });

  it('撤销栈真变化 ⇒ 引用必须换（防止用空依赖买绿、锁死状态）', () => {
    // 上一条的反面：契约是「无关重渲不换引用」，不是「永远不换」。
    // 若有人把 deps 写成 [] 求稳，canUndo 变了引用却不变 ⇒ 本断言红。
    const apply = vi.fn();
    const { result } = renderHook(() => useCanvasHistory(() => ({ nodes: [], edges: [] }), apply));

    const before = result.current;
    act(() => {
      result.current.record(snap('n1'));
      result.current.record(snap('n2'));
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current).not.toBe(before);
  });
});
