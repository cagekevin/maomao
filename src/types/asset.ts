/**
 * 资产（媒体文件）相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 assetType.ts / asyncGuard.ts 及其调用方复用。
 */

/**
 * 资产类型判定结果（assetType.detectAssetType/detectFileType；对齐官方 xi.jsx / AssetNode 类型约定）。
 * 全库「扩展名 / mime → 类别」判定的统一取值，见 assetType.ts 的唯一真值源表。
 *  - image / video / audio / text：四类资产
 *  - other：非以上类型的文件（如压缩包）；empty：无 URL/文件
 */
export type AssetType = 'image' | 'video' | 'audio' | 'text' | 'other' | 'empty';

/** 图片/资产 URL 加载选项（asyncGuard.loadImageWithTimeout / loadImageOrNull） */
export interface AssetLoadOptions {
  timeoutMs?: number;
  /** null = 去掉 crossOrigin（跨域图无 CORS 头时的兜底，canvas 会被污染） */
  crossOrigin?: string | null;
}
