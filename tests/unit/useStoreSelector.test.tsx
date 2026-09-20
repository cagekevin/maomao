/**
 * store selector 浅比较锚点（P5 原子 hook 的测试基座）。
 *
 * 现状各 store（conversationStore/resourceStore/projectStore/appSettings 等）用
 * useSyncExternalStore 整包订阅，任何字段变更都触发订阅组件重渲染（连坐）。
 * P5 引入 useStoreSelector(selector, isEqual=shallowEqual)：只订阅 selector 结果，
 * 无关字段变更不重渲染；selector 返回新对象时靠浅比较返回旧引用，防无限重渲。
 *
 * 本文件锁定两条最关键语义（对齐计划 §4.3 P5）：
 *  ① 无关字段变更不触发订阅组件重渲染
 *  ② selector 返回新对象但浅比较相等 → 不重渲染（防无限重渲）
 *  + shallowEqual 纯函数语义
 */
import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { useStoreSelector, shallowEqual } from '../../src/hooks/useStoreSelector.ts';

/** 最小可操控外部 store（对齐各 store 的 subscribe/getSnapshot 契约） */
function createStore(initial: Record<string, unknown>) {
  let state: Record<string, unknown> = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next: Record<string, unknown>) => {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** 探针组件：订阅 selector，每次渲染回调 onRender（统计重渲染次数） */
type ProbeProps = {
  store: { subscribe: (cb: () => void) => () => void; getState: () => Record<string, unknown> };
  selector: (state: Record<string, unknown>) => unknown;
  isEqual?: (a: unknown, b: unknown) => boolean;
  onRender: () => void;
};
function Probe({ store, selector, isEqual, onRender }: ProbeProps) {
  const v = useStoreSelector(store.subscribe, store.getState, selector, isEqual);
  onRender();
  return <div data-testid="value">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>;
}

describe('useStoreSelector — 无关字段变更不触发重渲染', () => {
  it('订阅 s.a，只改 s.b → 不重渲染；改 s.a 才重渲染', () => {
    const store = createStore({ a: 1, b: 1 });
    const onRender = vi.fn();
    render(<Probe store={store} selector={(s) => s.a} onRender={onRender} />);
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => store.setState({ a: 1, b: 2 })); // 无关字段变更
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => store.setState({ a: 2, b: 2 })); // 订阅字段变更
    expect(onRender).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('value').textContent).toBe('2');
  });
});

describe('useStoreSelector — 新对象浅比较防无限重渲', () => {
  it('selector 每次返回新对象（{a: s.a}），a 不变 → 不重渲染', () => {
    const store = createStore({ a: 1, b: 1 });
    const onRender = vi.fn();
    render(<Probe store={store} selector={(s) => ({ a: s.a })} onRender={onRender} />);
    expect(onRender).toHaveBeenCalledTimes(1);

    // b 变更：selector 仍返回 {a:1}（新对象，浅比较相等）→ 应返回旧引用，不重渲染
    act(() => store.setState({ a: 1, b: 2 }));
    expect(onRender).toHaveBeenCalledTimes(1);

    // a 变更：浅比较不等 → 重渲染且拿到新值
    act(() => store.setState({ a: 2, b: 2 }));
    expect(onRender).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('value').textContent).toBe('{"a":2}');
  });

  it('订阅数组字段（引用不变则复用旧引用）', () => {
    const store = createStore({ list: [1, 2, 3] });
    const onRender = vi.fn();
    render(<Probe store={store} selector={(s) => s.list} onRender={onRender} />);
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => store.setState({ list: [1, 2, 3] })); // 新数组但元素相同（浅比较相等）
    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => store.setState({ list: [1, 2, 4] })); // 元素变化
    expect(onRender).toHaveBeenCalledTimes(2);
  });
});

describe('shallowEqual — 纯函数语义', () => {
  it('同一引用 / 相同原始值 → true', () => {
    const o = { a: 1 };
    expect(shallowEqual(o, o)).toBe(true);
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual('x', 'x')).toBe(true);
  });

  it('不同原始值 / null 与对象 → false', () => {
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual(undefined, null)).toBe(false);
  });

  it('同键同值对象 / 数组 → true（浅层）', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
  });

  it('键数不同 / 值不同 / 缺键 → false', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('嵌套对象浅比较：仅比一层引用', () => {
    const inner = { x: 1 };
    expect(shallowEqual({ a: inner }, { a: inner })).toBe(true); // 内层同引用
    expect(shallowEqual({ a: inner }, { a: { x: 1 } })).toBe(false); // 内层不同引用
  });
});

describe('useStoreSelector — selector 闭包捕获值变化时取最新（TD-04-44）', () => {
  it('selector 依赖的外部变量变化后返回最新结果（不得冻结在首帧）', () => {
    // 契约：selector 是"每次渲染取最新"的取值器，不是首帧快照。
    // 反证：把实现里的 selectorRef.current 改回直接闭包捕获 selector（旧实现）
    // ⇒ 本断言红（会一直返回首帧那个 key 的值）。
    const store = createStore({ items: { a: 1, b: 2 } });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useStoreSelector(
          store.subscribe,
          store.getState,
          (s) => (s.items as Record<string, number>)[id],
        ),
      { initialProps: { id: 'a' } },
    );
    expect(result.current).toBe(1);
    rerender({ id: 'b' });
    expect(result.current).toBe(2);
  });

  it('内联箭头 selector（身份每次渲染都变）不会击穿缓存 ⇒ 不无限重渲', () => {
    // 反面约束：修 TD-04-44 **不得**把缓存改成"selector 一变就重建"
    //（那会让返回新对象的 selector 每次重算 → 浅比较失效 → 无限重渲）。
    const store = createStore({ n: 1 });
    let renders = 0;
    function Probe() {
      renders += 1;
      // 内联箭头：每次渲染身份都不同；返回新对象 ⇒ 必须靠缓存 + 浅比较挡住重渲
      useStoreSelector(store.subscribe, store.getState, (s) => ({ v: s.n }));
      return null;
    }
    render(<Probe />);
    expect(renders).toBe(1);
    act(() => store.setState({ n: 1 })); // 通知一次，但选中值浅比较相等
    expect(renders).toBe(1);
  });
});
