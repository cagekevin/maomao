import type { TCanvasSize } from '@/components/videoEditor/types/project';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';

/**
 * **渲染适配基准尺寸（唯一实现）**：作品创建时钉下的原始画布尺寸优先，缺失才按当前画布。
 *
 * 【它是什么】`scene-builder` 的 `fitCanvasSize` —— 决定"素材按哪个矩形做 contain 适配"，
 * 一路喂进渲染节点（`visual-node.renderVisual`）、命中（`hit-test`）、框子（`selection-overlay`）。
 *
 * 【为什么必须唯一】它是**画面 / 框子 / 命中三者共用的缩放基准**：任何一处写成别的口径
 * （例如漏掉 `originalCanvasSize`、或用了当前画布），三者的坐标立刻互相错位 ——
 * 而且**只在"改过画布尺寸"的作品上才显形**（默认两者相等时看不出问题），极难自查。
 * 故一律经此函数取值，禁在消费方内联 `originalCanvasSize ?? canvasSize`。
 */
export function getFitCanvasSize({
  canvasSize,
  originalCanvasSize,
}: {
  canvasSize: TCanvasSize;
  originalCanvasSize?: TCanvasSize | null;
}): TCanvasSize {
  return originalCanvasSize ?? canvasSize;
}

/**
 * **contain 适配缩放（唯一实现）**：把素材按基准尺寸等比放进画布（取宽高比更小的那一维）。
 *
 * 【为什么必须唯一】渲染（`visual-node.renderVisual`）与几何（`getElementCanvasRect`）各自
 * 算一次同一个式子、且输入**完全相同**（素材显示尺寸 + 适配基准）—— 两份一旦漂移，
 * 就是"框子套不住画面、点不中自己看到的东西"，且只在非等比素材上显形。
 */
export function getContainScale({
  sourceSize,
  fitCanvasSize,
}: {
  sourceSize: TCanvasSize;
  fitCanvasSize: TCanvasSize;
}): number {
  return Math.min(fitCanvasSize.width / sourceSize.width, fitCanvasSize.height / sourceSize.height);
}

/**
 * **素材显示尺寸（唯一回落规则）**：`MediaAsset.width/height` 合法则用它，否则回落画布尺寸。
 *
 * 【为什么必须唯一】渲染（`scene-builder` → `VisualNodeParams.mediaSize`）与几何
 * （`getElementCanvasRect`）必须读**同一个值**，否则框子与画面错位。
 *
 * 【为什么用 `||` 而不是 `??`】`0` / `NaN` 是**非法尺寸**（会让 `getContainScale` 除零 → 矩形 NaN），
 * 不是"用户指定的 0 像素"。缺失与非法都要回落 —— `??` 只兜 `null`/`undefined`。
 */
export function getMediaDisplaySize({
  media,
  canvasSize,
}: {
  media?: Pick<MediaAsset, 'width' | 'height'> | undefined;
  canvasSize: TCanvasSize;
}): TCanvasSize {
  return {
    width: media?.width || canvasSize.width,
    height: media?.height || canvasSize.height,
  };
}
