import type { Ref, RefCallback } from 'react';

/**
 * 合并多个 ref 到一个回调 ref —— 层原语要把 `forwardedRef` 与"内部测量用的 ref"
 * 挂在**同一个 DOM 节点**上（如 PopoverContent 既对外暴露 ref，又要把自己交给定位 hook 测量）。
 *
 * 【为什么不用 Radix 的 `useComposedRefs`】它是 `@radix-ui/react-compose-refs` 的依赖，
 * 本计划的终点是 `src/` 内 0 处 `@radix-ui/*`；而这 15 行没有任何"黑盒价值"。
 *
 * 语义与 React 官方 `useComposedRefs` 示例一致：对象 ref 与函数 ref 都支持，
 * `null/undefined` 跳过（可选 ref 不报错）。
 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (ref === null || ref === undefined) continue;
      if (typeof ref === 'function') {
        ref(node);
        continue;
      }
      /* 对象 ref 的 `current` 允许写入 `null`（卸载），而 `RefObject<T>.current` 的类型是 `T` —— 故走窄化写入。 */
      (ref as { current: T | null }).current = node;
    }
  };
}
