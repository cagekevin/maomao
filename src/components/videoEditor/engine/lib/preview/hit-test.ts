import type {
  TimelineTrack,
  TimelineElement,
  Transform,
} from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import type { TProjectSettings } from '@/components/videoEditor/types/project';
import {
  getOutputTracks,
  hasMediaId,
  isElementActiveAtTime,
} from '@/components/videoEditor/engine/timeline';
import { indexMediaAssets } from '@/components/videoEditor/engine/lib/media/media-utils';
import { getElementCanvasRect } from './element-bounds';

export interface HitResult {
  trackId: string;
  element: TimelineElement;
  transform: Transform;
}

function isPointInRotatedRect({
  point,
  center,
  halfWidth,
  halfHeight,
  rotationDeg,
}: {
  point: { x: number; y: number };
  center: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
  rotationDeg: number;
}): boolean {
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
}

/**
 * Returns the topmost visible element at the given canvas-coordinate point,
 * or null when nothing is hit.
 *
 * 【为什么收 `settings`】画布尺寸与适配基准（`getFitCanvasSize`）由本函数内部派生 ——
 * 调用方**拿不到**这两个参数，也就无从与渲染口径写歪（命中区与画面必须同一套坐标）。
 */
export function hitTestElements({
  point,
  tracks,
  mediaAssets,
  settings,
  currentTime,
}: {
  point: { x: number; y: number };
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  settings: Pick<TProjectSettings, 'canvasSize' | 'originalCanvasSize'>;
  currentTime: number;
}): HitResult | null {
  const mediaMap = indexMediaAssets({ mediaAssets });

  // 【命中序必须与渲染序同源】图层序 = `tracks` 数组序（下标 0 = 最上层）⇒ 遍历取反序
  // （`scene-builder` 用同一条式子）。此处曾各抄一份 `isMainTrack` 分区 —— 同一真相两份副本，
  // 且与渲染一起把用户拖动的顺序抹掉（命中与画面双双对不上时间轴列表）。
  // 可见性同源：`getOutputTracks` 已滤掉隐藏项 ⇒ 本处看不到它们（与画面**同一批**候选）。
  const orderedTracksBottomToTop = getOutputTracks(tracks).slice().reverse();

  const candidates: HitResult[] = [];

  for (const track of orderedTracksBottomToTop) {
    const orderedElements = track.elements.slice().sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return a.id.localeCompare(b.id);
    });

    for (const element of orderedElements) {
      if (element.type === 'audio') continue;
      if (!isElementActiveAtTime({ element, time: currentTime })) continue;

      const transform = (element as { transform: Transform }).transform;
      candidates.push({ trackId: track.id, element, transform });
    }
  }

  // test from top to bottom (last rendered = topmost)
  for (const candidate of candidates.slice().reverse()) {
    const { element, transform } = candidate;

    // 矩形走**唯一几何原语**（与画面 / 框子同一份算式与尺寸来源）。
    const rect = getElementCanvasRect({
      element,
      transform,
      media: hasMediaId(element) ? mediaMap.get(element.mediaId) : undefined,
      settings,
    });

    if (!rect) continue;

    if (
      isPointInRotatedRect({
        point,
        center: { x: rect.centerX, y: rect.centerY },
        halfWidth: rect.width / 2,
        halfHeight: rect.height / 2,
        rotationDeg: rect.rotate,
      })
    ) {
      return candidate;
    }
  }

  return null;
}
