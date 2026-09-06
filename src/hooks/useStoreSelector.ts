/**
 * ════════════════════════════════════════════════════════════════
 * store selector 原子订阅原语（P5 范式基座）
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么】各 store（conversationStore/assetStore/projectStore/appSettings…）此前用
 *   useSyncExternalStore(subscribe, getSnapshot) 整包订阅——store 里任何字段变更都会
 *   触发所有订阅组件重渲染（连坐）。本原语让组件只订阅 selector 选中的字段：
 *   - 无关字段变更 → selector 结果不变 → 不重渲染
 *   - selector 返回新对象/新数组但浅比较相等 → 返回旧引用 → 不重渲染（防无限重渲）
 *
 * 【用法】
 *   const value = useStoreSelector(store.subscribe, store.getState, (s) => s.activeId)
 *   const cfg  = useStoreSelector(store.subscribe, store.getState, (s) => ({ a: s.a }))
 *
 * 【isEqual 语义】默认 shallowEqual（一层引用比较）。返回原始值时 Object.is 即足够；
 *   返回新对象/新数组时必须配浅比较，否则每次订阅都判不等 → 无限重渲染。
 * ════════════════════════════════════════════════════════════════
 */
import { useState, useSyncExternalStore } from 'react';

/**
 * 浅比较：一层引用相等判断（同引用 / 同原始值 / 同键同值对象、数组 → true）。
 * 嵌套对象只比「引用」，不递归。
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (ao[k] !== bo[k]) return false;
  }
  return true;
}

/** store 订阅函数：注册回调并返回取消订阅函数 */
export type StoreSubscribe = (onStoreChange: () => void) => () => void;

/**
 * selector 原子订阅：只订阅 selector 结果，非订阅字段变更不触发重渲染。
 * 缓存上一次选中值：新选中值浅比较相等 → 复用旧引用，避免 React 判不等导致无限重渲。
 */
export function useStoreSelector<S, T>(
  subscribe: StoreSubscribe,
  getSnapshot: () => S,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual,
): T {
  // getSelection 用 useState 惰性初始化，缓存 memoizedSelection（跨调用复用同一引用）
  const [getSelection] = useState(() => {
    let hasValue = false;
    let memoizedSelection: T = null as T;
    return () => {
      const nextSelection = selector(getSnapshot());
      if (hasValue && isEqual(memoizedSelection, nextSelection)) {
        return memoizedSelection;
      }
      hasValue = true;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
  });
  return useSyncExternalStore(subscribe, getSelection, getSelection);
}
