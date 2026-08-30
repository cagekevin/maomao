/**
 * 媒体类型相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 mediaType.ts / asyncGuard.ts 及其调用方复用。
 */

/** 媒体类型判定结果（mediaType.detectMediaType/detectFileType；对齐官方 xi.jsx / ImageNode 类型约定） */
export type MediaType = 'image' | 'video' | 'audio' | 'text' | 'other' | 'empty'

/** 图片加载选项（asyncGuard.loadImageWithTimeout / loadImageOrNull） */
export interface ImageLoadOptions {
  timeoutMs?: number
  /** null = 去掉 crossOrigin（跨域图无 CORS 头时的兜底，canvas 会被污染） */
  crossOrigin?: string | null
}