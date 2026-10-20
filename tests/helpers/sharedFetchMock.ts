import { vi } from 'vitest';

/**
 * 取 `tests/setup.mjs` 注入的**共享 fetch 桩**。
 *
 * 【背景】setup 用 `defineProperty` 把 `globalThis.fetch` 换成共享 `vi.fn`
 * （node 下原生 fetch 不可配置，`vi.stubGlobal` 会静默失败，见 `_testUtils.mjs` 顶部约定）。
 * 此前各文件写 `globalThis.fetch as unknown as ReturnType<typeof vi.fn>` 取 mock API；
 * `_testUtils.jsonResp` 改成真 `Response` 后，`vi.mocked(globalThis.fetch)` 直接可用。
 *
 * 本函数只是「一处取实例」的语义化封装（**不做任何类型断言**）：需要 mock 行为时用返回值，
 * 只需要在 beforeEach 里清空时也用它。
 */
export function sharedFetchMock() {
  return vi.mocked(globalThis.fetch);
}
