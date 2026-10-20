/**
 * 错误分类相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 genErrors.ts 及其调用方复用。
 */

/** 错误分类枚举（genErrors.classifyError 的可决策类型；与 contracts.ts GEN_ERRORS 键对齐） */
export type ErrorKind = 'abort' | 'timeout' | 'network' | 'http' | 'business';

/**
 * 「错误响应」的最小结构契约（`parseAgentError` 的入参）。
 *
 * 真实 `Response` 与「由 HttpError 构造的同形假响应」都满足它 —— 此前各处写 `Response`，
 * 导致假响应只能靠双重断言通过（TD-18-49）。这里只声明解析真正用到的两个成员。
 */
export interface ErrorResponseLike {
  status: number;
  text: () => Promise<string>;
}
