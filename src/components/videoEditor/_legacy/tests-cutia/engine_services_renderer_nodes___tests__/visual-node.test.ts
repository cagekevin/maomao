import { expect, test } from 'bun:test';
import type { CanvasRenderer } from '../../canvas-renderer';
import { buildScene } from '../../scene-builder';
import { VisualNode } from '../visual-node';

class TestVisualNode extends VisualNode {
  draw({ renderer }: { renderer: CanvasRenderer }) {
    this.renderVisual({
      renderer,
      source: {} as CanvasImageSource,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
  }
}

test('keeps media fitted to the original canvas when output shrinks', () => {
  let drawBounds: number[] = [];
  const renderer = {
    width: 1366,
    height: 768,
    context: {
      globalAlpha: 1,
      save() {},
      restore() {},
      drawImage(_source: CanvasImageSource, x: number, y: number, width: number, height: number) {
        drawBounds = [x, y, width, height];
      },
    },
  } as unknown as CanvasRenderer;
  const node = new TestVisualNode({
    duration: 1,
    timeOffset: 0,
    trimStart: 0,
    trimEnd: 0,
    transform: {
      scale: 1,
      position: { x: 0, y: 0 },
      rotate: 0,
    },
    opacity: 1,
    fitCanvasSize: { width: 1920, height: 1080 },
  });

  node.draw({ renderer });

  expect(drawBounds).toEqual([-277, -156, 1920, 1080]);
});

test('passes the original canvas size to media nodes', () => {
  const scene = buildScene({
    canvasSize: { width: 1366, height: 768 },
    fitCanvasSize: { width: 1920, height: 1080 },
    duration: 1,
    background: { type: 'color', color: 'transparent' },
    mediaAssets: [
      {
        id: 'media',
        name: 'video.mp4',
        type: 'video',
        file: new File([], 'video.mp4'),
        url: 'blob:video',
        width: 1920,
        height: 1080,
        duration: 1,
      },
    ],
    tracks: [
      {
        id: 'track',
        name: 'Video',
        type: 'video',
        isMain: true,
        muted: false,
        hidden: false,
        transitions: [],
        elements: [
          {
            id: 'element',
            name: 'Video',
            type: 'video',
            mediaId: 'media',
            startTime: 0,
            duration: 1,
            trimStart: 0,
            trimEnd: 0,
            transform: {
              scale: 1,
              position: { x: 0, y: 0 },
              rotate: 0,
            },
            opacity: 1,
            playbackRate: 1,
            reversed: false,
          },
        ],
      },
    ],
  });

  expect(scene.children[0]?.params).toMatchObject({
    fitCanvasSize: { width: 1920, height: 1080 },
  });
});
