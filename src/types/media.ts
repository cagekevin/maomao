/**
 * 媒体类型相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 mediaType.ts / asyncGuard.ts 及其调用方复用。
 */

/** 媒体类型判定结果（mediaType.detectMediaType/detectFileType；对齐官方 xi.jsx / AssetNode 类型约定） */
export type MediaType = 'image' | 'video' | 'audio' | 'text' | 'other' | 'empty';

/**
 * 媒体类别（不含 other/empty 两个兜底态）：
 * 全库「扩展名 / mime → 类别」判定的统一取值，见 mediaType.ts 的唯一真值源表。
 */
export type MediaKind = 'image' | 'video' | 'audio' | 'text';

/** 产出类型（结果 URL 判定）：产出结果只有图/视频/音频三种，text 归 image 兜底 */
export type ResultKind = 'image' | 'video' | 'audio';

/** 图片加载选项（asyncGuard.loadImageWithTimeout / loadImageOrNull） */
export interface ImageLoadOptions {
  timeoutMs?: number;
  /** null = 去掉 crossOrigin（跨域图无 CORS 头时的兜底，canvas 会被污染） */
  crossOrigin?: string | null;
}
