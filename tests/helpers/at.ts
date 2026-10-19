/**
 * 测试侧「按下标取值」唯一辅助 —— P4b（`noUncheckedIndexedAccess` · tests）的前置设施。
 *
 * 【为什么存在】
 * `noUncheckedIndexedAccess` 下 `arr[i]` 的类型是 `T | undefined`（越界在运行时**确实**是 undefined）。
 * 测试里 90% 的这类报错都属于「已知下标在界内」：断言前先 `expect(rows[0]).toBeDefined()` 再取值可行，
 * 但会多写一行、且 `rows[0]` 写两遍容易漂移。
 *
 * 【为什么不用 `arr[i]!`】
 * `!` 只是让编译器闭嘴：越界时测试会在别的行以 `Cannot read properties of undefined` 崩掉，
 * 失败信息里既没有下标也没有长度，排查成本高。本辅助在**取值这一处**抛带上下文的错误，
 * 定位直接命中。
 *
 * 【用法】
 * ```ts
 * const row = at(rows, 0);            // 越界 → 抛 "at(): 下标 0 越界（长度 0）"
 * expect(at(rows, 1).cells[0]).toBe('x');
 * ```
 *
 * 【不适用】
 * 元素类型本身含 `undefined`（如 `Array<string | undefined>`）时，本辅助会把「合法 undefined 元素」
 * 误判为越界。这类数组请显式 `arr[i]` 后按业务判空，不要套本辅助。
 */
export function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) {
    throw new Error(`at(): 下标 ${index} 越界（长度 ${list.length}）`);
  }
  return value;
}

/** 取末项（`at(list, list.length - 1)` 的语义化写法；空列表同样抛错）。 */
export function last<T>(list: readonly T[]): T {
  return at(list, list.length - 1);
}
