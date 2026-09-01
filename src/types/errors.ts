/**
 * 错误分类相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 genErrors.ts 及其调用方复用。
 */

/** 错误分类枚举（genErrors.classifyError 的可决策类型；与 contracts.ts GEN_ERRORS 键对齐） */
export type ErrorKind = 'abort' | 'timeout' | 'network' | 'http' | 'business'