import type { CanvasRenderer } from '../canvas-renderer';
import { BaseNode } from './base-node';
import { getVisualSourceTime } from '@/components/videoEditor/engine/timeline/element-utils';
import { getContainScale } from '@/components/videoEditor/engine/lib/canvas-size';
import type { Transform } from '@/components/videoEditor/types/timeline';
import type { TCanvasSize } from '@/components/videoEditor/types/project';

const VISUAL_EPSILON = 1 / 1000;

export interface VisualNodeParams {
  duration: number;
  timeOffset: number;
  trimStart: number;
  transform: Transform;
  opacity: number;
  /**
   * 适配基准尺寸（**必填**）。
   *
   * 【为什么必填】渲染与几何（`getElementCanvasRect`）必须用**同一个基准** ——
   * 曾因为 `StickerNode` 漏传而回落"当前画布"，于是改过画布尺寸的作品上贴纸的
   * 框子与画面错位（几何按原始画布、渲染按当前画布）。改成必填 ⇒ **漏传在编译期就被拦**，
   * 不再依赖"记得传"。
   */
  fitCanvasSize: TCanvasSize;
  /**
   * 素材的**显示尺寸**（= `MediaAsset.width/height`，导入时探测；缺省回落解码尺寸）。
   *
   * 【为什么必须与命中/框子同源】元素在画布上占多大由它决定 —— `getElementCanvasRect`
   * （命中 / 框子 / 吸附）读的是**同一个值**。若渲染改用自己的解码尺寸、而几何用元数据，
   * 两者一有差池就是"框子套不住画面、点不中自己看到的东西"。
   */
  mediaSize?: TCanvasSize;
  playbackRate?: number;
  reversed?: boolean;
}

export abstract class VisualNode<
  Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
  protected getLocalTime(time: number): number {
    return getVisualSourceTime({
      timelineTime: time,
      startTime: this.params.timeOffset,
      duration: this.params.duration,
      trimStart: this.params.trimStart,
      playbackRate: this.params.playbackRate,
      reversed: this.params.reversed,
    });
  }

  protected isInRange(time: number): boolean {
    const localTime = this.getLocalTime(time);
    const rate = this.params.playbackRate ?? 1;
    return (
      localTime >= this.params.trimStart - VISUAL_EPSILON &&
      localTime < this.params.trimStart + this.params.duration * rate
    );
  }

  protected renderVisual({
    renderer,
    source,
    sourceWidth,
    sourceHeight,
  }: {
    renderer: CanvasRenderer;
    source: CanvasImageSource;
    sourceWidth: number;
    sourceHeight: number;
  }): void {
    renderer.context.save();

    const { transform, opacity, fitCanvasSize, mediaSize } = this.params;
    // 显示尺寸取 `mediaSize`（几何原语读的同一值）；未提供时回落解码尺寸
    // （贴纸走这条：源边长 200 由 `STICKER_SOURCE_SIZE` 与几何原语同口径）。
    const sourceSize = {
      width: mediaSize?.width ?? sourceWidth,
      height: mediaSize?.height ?? sourceHeight,
    };
    // contain 算式与几何原语**同一实现**（`getContainScale`）；基准由 `fitCanvasSize` 必填传入。
    const containScale = getContainScale({ sourceSize, fitCanvasSize });
    const scaledWidth = sourceSize.width * containScale * transform.scale;
    const scaledHeight = sourceSize.height * containScale * transform.scale;
    const x = renderer.width / 2 + transform.position.x - scaledWidth / 2;
    const y = renderer.height / 2 + transform.position.y - scaledHeight / 2;

    renderer.context.globalAlpha = opacity;

    const centerX = x + scaledWidth / 2;
    const centerY = y + scaledHeight / 2;

    const needsFlip = transform.flipX || transform.flipY;
    const needsRotate = transform.rotate !== 0;

    if (needsRotate || needsFlip) {
      renderer.context.translate(centerX, centerY);
      if (needsRotate) {
        renderer.context.rotate((transform.rotate * Math.PI) / 180);
      }
      if (needsFlip) {
        renderer.context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
      }
      renderer.context.translate(-centerX, -centerY);
    }

    renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);
    renderer.context.restore();
  }
}
