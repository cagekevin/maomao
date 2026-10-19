import type { CanvasRenderer } from '../canvas-renderer';
import { BaseNode } from './base-node';
import type { TextElement } from '@/components/videoEditor/types/timeline';
import {
  hasTextBackground,
  hasTextShadow,
  hasTextStroke,
} from '@/components/videoEditor/constants/text-constants';
// 【排版唯一实现】字体串 / 换行 / 量宽高都在 text-layout —— 本文件只负责"怎么画"。
// 命中与选中框读的是同一份排版（`getElementCanvasRect`），否则"框子套不住字、点不中自己看到的字"。
import { layoutText, type TextLayout } from '../text-layout';
import { isElementActiveAtTime } from '@/components/videoEditor/engine/timeline/element-utils';

type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type TextNodeParams = TextElement & {
  canvasCenter: { x: number; y: number };
  canvasHeight: number;
  textBaseline?: CanvasTextBaseline;
};

export class TextNode extends BaseNode<TextNodeParams> {
  isInRange({ time }: { time: number }) {
    // 「这一刻该不该画」与命中 / 框子 / 吸附**同一判据**（半开区间口径不得各写一遍）。
    return isElementActiveAtTime({ element: this.params, time });
  }

  override async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
    if (!this.isInRange({ time })) {
      return;
    }

    renderer.context.save();

    const x = this.params.transform.position.x + this.params.canvasCenter.x;
    const y = this.params.transform.position.y + this.params.canvasCenter.y;

    renderer.context.translate(x, y);
    if (this.params.transform.rotate) {
      renderer.context.rotate((this.params.transform.rotate * Math.PI) / 180);
    }
    if (this.params.transform.scale !== 1) {
      renderer.context.scale(this.params.transform.scale, this.params.transform.scale);
    }

    const textBaseline = this.params.textBaseline || 'middle';

    // 【为什么用同一个上下文量】`layoutText` 会把 font 设进 `renderer.context`，
    // 随后绘制直接复用它 —— 量的字与画的字**逐字同一个 font 串**。
    const layout = layoutText({
      element: this.params,
      canvasHeight: this.params.canvasHeight,
      context: renderer.context,
    });

    renderer.context.textAlign = this.params.textAlign;
    renderer.context.textBaseline = textBaseline;
    renderer.context.fillStyle = this.params.color;

    const prevAlpha = renderer.context.globalAlpha;
    renderer.context.globalAlpha = this.params.opacity;

    if (layout.hasBoxWidth) {
      this.renderMultiline({ context: renderer.context, layout, textBaseline });
    } else {
      this.renderSingleLine({ context: renderer.context, layout, textBaseline });
    }

    renderer.context.globalAlpha = prevAlpha;
    renderer.context.restore();
  }

  private renderSingleLine({
    context,
    layout,
    textBaseline,
  }: {
    context: RenderContext;
    layout: TextLayout;
    textBaseline: CanvasTextBaseline;
  }) {
    if (hasTextBackground({ backgroundColor: this.params.backgroundColor })) {
      const textW = layout.width;
      const textH = layout.height;
      const padX = this.params.backgroundPaddingX ?? 8;
      const padY = this.params.backgroundPaddingY ?? 4;
      const borderRadius = this.params.backgroundBorderRadius ?? 0;

      const prevAlpha = context.globalAlpha;
      const bgOpacity = this.params.backgroundOpacity ?? 1;
      context.globalAlpha = prevAlpha * bgOpacity;

      context.fillStyle = this.params.backgroundColor;
      let bgLeft = -textW / 2;
      if (context.textAlign === 'left') bgLeft = 0;
      if (context.textAlign === 'right') bgLeft = -textW;

      const backgroundTop = textBaseline === 'bottom' ? -textH - padY : -textH / 2 - padY;
      const bgW = textW + padX * 2;
      const bgH = textH + padY * 2;
      const bgX = bgLeft - padX;

      if (borderRadius > 0 && context.roundRect) {
        context.beginPath();
        context.roundRect(bgX, backgroundTop, bgW, bgH, borderRadius);
        context.fill();
      } else {
        context.fillRect(bgX, backgroundTop, bgW, bgH);
      }

      context.globalAlpha = prevAlpha;
      context.fillStyle = this.params.color;
    }

    if (hasTextShadow(this.params.shadow)) {
      context.shadowColor = this.params.shadow.color;
      context.shadowOffsetX = this.params.shadow.offsetX;
      context.shadowOffsetY = this.params.shadow.offsetY;
      context.shadowBlur = this.params.shadow.blur;
    }

    if (hasTextStroke(this.params.stroke)) {
      context.strokeStyle = this.params.stroke.color;
      context.lineWidth = this.params.stroke.width * 2;
      context.lineJoin = 'round';
      context.strokeText(this.params.content, 0, 0);
    }

    if (hasTextShadow(this.params.shadow)) {
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
    }

    context.fillText(this.params.content, 0, 0);
  }

  private renderMultiline({
    context,
    layout,
    textBaseline,
  }: {
    context: RenderContext;
    layout: TextLayout;
    textBaseline: CanvasTextBaseline;
  }) {
    const { lines, lineHeight, boxWidth, height: totalHeight } = layout;

    let startY: number;
    if (textBaseline === 'bottom') {
      startY = -totalHeight;
    } else {
      startY = -totalHeight / 2 + lineHeight / 2;
    }

    context.textBaseline = 'middle';

    let textX = 0;
    if (context.textAlign === 'left') {
      textX = -boxWidth / 2;
    } else if (context.textAlign === 'right') {
      textX = boxWidth / 2;
    }

    if (hasTextBackground({ backgroundColor: this.params.backgroundColor })) {
      const padX = this.params.backgroundPaddingX ?? 8;
      const padY = this.params.backgroundPaddingY ?? 4;
      const borderRadius = this.params.backgroundBorderRadius ?? 0;

      const prevAlpha = context.globalAlpha;
      const bgOpacity = this.params.backgroundOpacity ?? 1;
      context.globalAlpha = prevAlpha * bgOpacity;

      context.fillStyle = this.params.backgroundColor;
      const bgX = -boxWidth / 2 - padX;
      const bgY = startY - lineHeight / 2 - padY;
      const bgW = boxWidth + padX * 2;
      const bgH = totalHeight + padY * 2;

      if (borderRadius > 0 && context.roundRect) {
        context.beginPath();
        context.roundRect(bgX, bgY, bgW, bgH, borderRadius);
        context.fill();
      } else {
        context.fillRect(bgX, bgY, bgW, bgH);
      }

      context.globalAlpha = prevAlpha;
      context.fillStyle = this.params.color;
    }

    for (const [i, line] of lines.entries()) {
      const lineY = startY + i * lineHeight;

      if (hasTextShadow(this.params.shadow)) {
        context.shadowColor = this.params.shadow.color;
        context.shadowOffsetX = this.params.shadow.offsetX;
        context.shadowOffsetY = this.params.shadow.offsetY;
        context.shadowBlur = this.params.shadow.blur;
      }

      if (hasTextStroke(this.params.stroke)) {
        context.strokeStyle = this.params.stroke.color;
        context.lineWidth = this.params.stroke.width * 2;
        context.lineJoin = 'round';
        context.strokeText(line, textX, lineY);
      }

      if (hasTextShadow(this.params.shadow)) {
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
      }

      context.fillText(line, textX, lineY);
    }
  }
}
