import { expect, mock, test } from 'bun:test';

const tracks = [
  { id: 'audio-track', name: 'Audio', type: 'audio', elements: [] },
  { id: 'overlay-track', name: 'Overlay', type: 'text', elements: [] },
];

let visionResult: string | undefined;

mock.module('@videoEditor/engine/core', () => ({
  EditorCore: {
    getInstance: () => ({
      project: {
        getActiveOrNull: () => ({
          settings: {
            fps: 25,
            canvasSize: { width: 3840, height: 2160 },
            background: { type: 'color', color: '#000000' },
          },
        }),
      },
      timeline: {
        getTracks: () => tracks,
        getTotalDuration: () => 10,
      },
      media: { getAssets: () => [] },
    }),
  },
}));

mock.module('@videoEditor/engine/services/renderer/scene-builder', () => ({
  buildScene: ({ tracks: sceneTracks }: { tracks: typeof tracks }) => ({
    trackIds: sceneTracks.map((track) => track.id).join(','),
  }),
}));

mock.module('@videoEditor/engine/services/renderer/canvas-renderer', () => ({
  CanvasRenderer: class {
    async renderToCanvas({
      node,
      time,
      targetCanvas,
    }: {
      node: { trackIds: string };
      time: number;
      targetCanvas: HTMLCanvasElement & { renderedFrame?: string };
    }) {
      targetCanvas.renderedFrame = `${node.trackIds}@${time}`;
    }
  },
}));

mock.module('@videoEditor/engine/lib/ai/vision', () => ({
  analyzeImageWithVision: async ({
    imageDataUrl,
    analysisPrompt,
  }: {
    imageDataUrl: string;
    analysisPrompt: string;
  }) => visionResult ?? `${analysisPrompt}|${imageDataUrl}`,
}));

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    createElement: () => ({
      width: 0,
      height: 0,
      toDataURL(this: { width: number; height: number; renderedFrame: string }) {
        return `data:image/jpeg;${this.width}x${this.height};${this.renderedFrame}`;
      },
    }),
  },
});

test('renders and analyzes an isolated track frame', async () => {
  visionResult = undefined;
  const { inspectFrameTool } = await import('../frame-tools');

  expect(
    await inspectFrameTool.execute({
      time: 10,
      trackId: 'overlay-track',
      question: 'Is there a title?',
    }),
  ).toEqual({
    success: true,
    message: 'Frame inspected at 10.00s',
    data: {
      time: 10,
      renderedTime: 9.96,
      scope: 'track',
      trackId: 'overlay-track',
      width: 1280,
      height: 720,
      analysis: 'Is there a title?|data:image/jpeg;1280x720;overlay-track@9.96',
    },
  });
});

test('rejects an empty vision analysis', async () => {
  visionResult = '   ';
  const { inspectFrameTool } = await import('../frame-tools');

  expect(await inspectFrameTool.execute({ time: 1 })).toEqual({
    success: false,
    message: 'Vision model returned an empty analysis',
  });
});
