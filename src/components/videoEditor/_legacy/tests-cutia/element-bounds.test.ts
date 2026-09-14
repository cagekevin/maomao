import { expect, test } from 'bun:test';
import { getElementHalfSize } from './element-bounds';
import type { MediaAsset } from '@videoEditor/types/assets';
import type { ImageElement } from '@videoEditor/types/timeline';

test('keeps media bounds fitted to the original canvas', () => {
  const transform = {
    scale: 1,
    position: { x: 0, y: 0 },
    rotate: 0,
  };
  const element = {
    type: 'image',
    mediaId: 'media',
    transform,
  } as ImageElement;
  const mediaMap = new Map([['media', { width: 1920, height: 1080 } as MediaAsset]]);

  expect(
    getElementHalfSize({
      element,
      transform,
      mediaMap,
      canvasWidth: 1366,
      canvasHeight: 768,
      fitCanvasSize: { width: 1920, height: 1080 },
    }),
  ).toEqual({ halfWidth: 960, halfHeight: 540 });
});
