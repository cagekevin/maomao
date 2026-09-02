/**
 * 类型占位：@tenney95/xiaoluo-image-editor（宿主图像编辑器）。
 *
 * 原项目用它渲染图片标注层。kit 只在 promptResolver 里懒加载调用，
 * 宿主不安装该包时这些函数用不到。这里给出最小类型声明，让编译通过。
 */
declare module '@tenney95/xiaoluo-image-editor' {
  export interface ImageAnnotationLayer {
    id?: string;
    visible?: boolean;
    kind?: string;
    data?: unknown;
    annotations?: unknown;
    [key: string]: unknown;
  }

  export function isImageAnnotationLayer(value: unknown): value is ImageAnnotationLayer;
  export function renderImageAnnotationLayerToDataUrl(layer: ImageAnnotationLayer): string;
}
