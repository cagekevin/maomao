/**
 * 断言先行（测试专用）：值可能为 null/undefined，但**用例前提**要求它非空时用它。
 *
 * 【为什么不用 `!`】`!` 只让编译器闭嘴：运行时拿到 null 依旧崩，且崩在离根因很远的地方
 * （如 `Cannot read properties of null (reading 'width')`），排查成本高。
 *
 * 【为什么不用提前 return】return 会让后续断言被跳过 ⇒ **测试假绿**（P4 的硬教训：
 * 守卫一律 `throw`，不许 `return`）。
 *
 * 用法：`const g = must(res.nodes.find((n) => n.id === 'g'), 'group 节点');`
 * 失败信息形如 `期望非空：group 节点`，直接指出用例前提没成立。
 */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`期望非空：${what}`);
  return value;
}
