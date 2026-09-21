// @vitest-environment jsdom
/**
 * useSelectedElements / useElementSelection —— 选中元素订阅的**唯一 React 桥接**（TD-04-45）。
 *
 * 锁两件事：
 *  ① **只此一份**：改前「订阅选中元素」在 `use-element-selection` / `use-preview-interaction` /
 *     `selection-overlay` 三处逐字重复；现在后两处委托本文件导出的实现（结构面由 grep 凭证，见轮次文件）。
 *  ② **引用稳定 ⇒ 重渲不解绑重绑订阅**：这正是 TD-04-45 的病灶（内联箭头每次渲染新建 ⇒
 *     `useSyncExternalStore` 每次渲染都 unsubscribe + subscribe）。
 *
 * 用**假 editor** 注入：被测的是**本 hook 的订阅行为**（subscribe 被调用几次），
 * 不是 engine 内部实现；假件只实现 `selection` 的真实契约面（subscribe / getSelectedElements）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const h = vi.hoisted(() => {
  const state = { subscribeCalls: 0, unsubscribes: 0 };
  const listeners = new Set<() => void>();
  const visible = [{ trackId: 't1', elementId: 'e1' }];
  const editor = {
    selection: {
      subscribe(listener: () => void) {
        state.subscribeCalls += 1;
        listeners.add(listener);
        return () => {
          state.unsubscribes += 1;
          listeners.delete(listener);
        };
      },
      getSelectedElements: () => visible,
    },
  };
  return { state, editor, visible };
});

vi.mock('@/components/videoEditor/hooks-cutia/use-editor', () => ({
  // 被测实现走 `useEditorInstance()`（只取实例、不订阅任何 store）—— 见 TD-04-40：
  // 本 hook 的选中态已由 `useSelectionSnapshot` 精确订阅 `selection`，再走 `useEditor()` 会重复订阅。
  useEditorInstance: () => h.editor,
}));

const { useSelectedElements, useElementSelection } =
  await import('@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection');

beforeEach(() => {
  h.state.subscribeCalls = 0;
  h.state.unsubscribes = 0;
});

describe('useSelectedElements — 订阅引用稳定（TD-04-45）', () => {
  it('重渲不解绑重绑订阅：subscribe 次数不随渲染增长', () => {
    // 反证：把 useSelectionSnapshot 里的 subscribe/getSnapshot 还原成内联箭头
    // （去掉 useCallback）⇒ 每次渲染都换引用 ⇒ subscribe 次数随渲染增长 ⇒ 本断言红。
    const { rerender } = renderHook(() => useSelectedElements());
    const afterMount = h.state.subscribeCalls;
    expect(afterMount).toBeGreaterThan(0);

    rerender();
    rerender();

    expect(h.state.subscribeCalls).toBe(afterMount);
  });

  it('返回值是 SelectionManager 的稳定引用（不新造数组）', () => {
    // 引用稳定是「不无限重渲」的前提（SelectionManager 只在内容真变时才换 visibleElements）。
    // 反证：把 return 改成 `[...snapshot]` ⇒ 每次渲染新数组 ⇒ 本断言红。
    const { result, rerender } = renderHook(() => useSelectedElements());
    expect(result.current).toBe(h.visible);
    rerender();
    expect(result.current).toBe(h.visible);
  });
});

describe('useElementSelection — 委托同一实现', () => {
  it('不重复订阅：挂载只 subscribe 一次，重渲不新增', () => {
    // 若 useElementSelection 自己再写一份内联桥接（或重复调用 useEditor 各自订阅），
    // 这里的挂载计数就会 > 1；重渲若换引用则会继续增长。
    const { rerender } = renderHook(() => useElementSelection());
    expect(h.state.subscribeCalls).toBe(1);

    rerender();
    expect(h.state.subscribeCalls).toBe(1);
  });
});
