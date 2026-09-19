import type { CanvasRenderer } from '../canvas-renderer';
import { VisualNode, type VisualNodeParams } from './visual-node';
import { buildIconSvgUrl } from '../../../lib/iconify-api';
import { setCrossOriginForReadable } from '@/components/base/utils/net/asyncGuard';

export interface StickerNodeParams extends VisualNodeParams {
  iconName: string;
  color?: string;
}

export class StickerNode extends VisualNode<StickerNodeParams> {
  private image?: HTMLImageElement;
  private readyPromise: Promise<void>;

  constructor(params: StickerNodeParams) {
    super(params);
    this.readyPromise = this.load();
  }

  private async load() {
    const image = new Image();
    // 走唯一 URL 构造函数（经 localTool 代理出站，不再直连公网）—— TD-22-47。
    const url = buildIconSvgUrl(this.params.iconName, {
      width: 200,
      height: 200,
      color: this.params.color,
    });
    // TD-16-2 / TD-22-55：渲染合成会回读 canvas，crossOrigin 必须走跨源裁决单点
    // （同源不设 / 真跨源才 anonymous）—— 恒设 'anonymous' 会让同源源被污染。
    setCrossOriginForReadable(image, url);
    this.image = image;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to load sticker: ${this.params.iconName}`));
      image.src = url;
    });
  }

  async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
    await super.render({ renderer, time });

    if (!this.isInRange(time)) {
      return;
    }

    await this.readyPromise;

    if (!this.image) {
      return;
    }

    this.renderVisual({
      renderer,
      source: this.image,
      sourceWidth: 200,
      sourceHeight: 200,
    });
  }
}
