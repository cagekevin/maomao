// @vitest-environment jsdom
/**
 * faceMosaic 单元测试（阶段一·算法与逻辑层）
 * 按 C1 可测性优先：mock 重环境（@mediapipe/tasks-vision / Image / canvas 真实渲染），
 * 只测纯逻辑剥离部分：
 *  - loadFaceDetector：单例缓存 + 加载失败清空并可重试
 *  - drawMosaicOnBox：各打码模式不抛错并触发绘制（mock ctx 记录调用）
 *  - MOSAIC_PALETTE 色板常量
 */
import { vi, describe, it, expect } from 'vitest';
import { fakeCanvas, fakeContext2d, stubCreateElement } from '../helpers/dom';
import type { MosaicMode } from '../../src/components/image/faceMosaic/faceMosaic.ts';

// mock mediapipe：不加载真实 wasm / 模型
/** `FaceDetector` 替身：本文件只断言单例身份，不调用 detect/detectForVideo。
 *  按真实类签名补齐实例成员（替身方法一律 `vi.fn()` 不实现），于是 `mockResolvedValueOnce`
 *  等调用点按真实类型校验，无需再绕类型系统硬转（原为两处断言，2026-10 收口）。 */
const fakeFaceDetector: import('@mediapipe/tasks-vision').FaceDetector = {
  setOptions: vi.fn(),
  detect: vi.fn(),
  detectForVideo: vi.fn(),
  enableLogging: vi.fn(),
  close: vi.fn(),
};
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(async () => ({ __wasm: true })),
  },
  FaceDetector: {
    createFromOptions: vi.fn(async () => fakeFaceDetector),
  },
}));

import {
  loadFaceDetector,
  drawMosaicOnBox,
  MOSAIC_PALETTE,
} from '../../src/components/image/faceMosaic/faceMosaic.ts';

/** 故意违反类型：`MosaicMode` 是四值联合，而运行期要能承受任意字符串（旧存档 / 手改数据）。
 *  本文件唯一一处此类收口，禁止在用例里散落同类断言。 */
const rawMode = (v: string): MosaicMode => v as MosaicMode;

function makeCtx() {
  // 2D 上下文替身收口到 helpers/dom.ts（jsdom 不实现 canvas）；此处只声明本文件用到的 spy
  return fakeContext2d({
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    filter: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  });
}

// mosaic/blur 内部会 document.createElement('canvas') 取离屏 2d context，
// jsdom 不实现 canvas，这里 spy 返回带 mock context 的假 canvas，使纯绘制逻辑可跑。
function installOffscreenCanvasSpy() {
  const offscreen = makeCtx();
  const original = document.createElement.bind(document);
  return stubCreateElement((tag) =>
    tag === 'canvas' ? fakeCanvas({ context: offscreen }) : original(tag),
  );
}

// 真 canvas 元素就是 CanvasImageSource（jsdom 下可建，只是没有 2D 实现）⇒ 不再用 {width,height} 假对象
const SRC: CanvasImageSource = Object.assign(document.createElement('canvas'), {
  width: 100,
  height: 100,
});
const BOX = { x: 10, y: 10, w: 30, h: 30 };

describe('loadFaceDetector', () => {
  it('成功加载后返回单例且只 createFromOptions 一次', async () => {
    const { FaceDetector } = await import('@mediapipe/tasks-vision');
    const a = await loadFaceDetector();
    const b = await loadFaceDetector();
    expect(a).toBe(fakeFaceDetector);
    expect(b).toBe(a);
    expect(FaceDetector.createFromOptions).toHaveBeenCalledTimes(1);
  });

  it('加载失败抛出且单例清空，下次调用可重试', async () => {
    vi.resetModules();
    const { FaceDetector } = await import('@mediapipe/tasks-vision');
    vi.mocked(FaceDetector.createFromOptions).mockClear();
    const { loadFaceDetector: load2 } =
      await import('../../src/components/image/faceMosaic/faceMosaic.ts');
    vi.mocked(FaceDetector.createFromOptions).mockRejectedValueOnce(new Error('wasm init fail'));
    await expect(load2()).rejects.toThrow('wasm init fail');
    // 失败后再次调用应重新尝试（单例已被 catch 清空）
    vi.mocked(FaceDetector.createFromOptions).mockResolvedValueOnce(fakeFaceDetector);
    const retry = await load2();
    expect(retry).toBe(fakeFaceDetector);
    expect(FaceDetector.createFromOptions).toHaveBeenCalledTimes(2);
  });
});

describe('drawMosaicOnBox', () => {
  let spy: any;
  beforeEach(() => {
    spy = installOffscreenCanvasSpy();
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it('mosaic 模式触发 drawImage（缩小放大像素块）', () => {
    const ctx = makeCtx();
    drawMosaicOnBox(ctx, SRC, BOX, 'mosaic', 0.5);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('bar 模式触发 fillRect 填充', () => {
    const ctx = makeCtx();
    drawMosaicOnBox(ctx, SRC, BOX, 'bar', 0.5, 'rect', '#000000');
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('grid 模式触发描边绘制', () => {
    const ctx = makeCtx();
    drawMosaicOnBox(ctx, SRC, BOX, 'grid', 0.5);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('blur 模式设置 ctx.filter 为 blur 后绘制', () => {
    const ctx = makeCtx();
    drawMosaicOnBox(ctx, SRC, BOX, 'blur', 0.5);
    expect(String(ctx.filter)).toMatch(/blur/);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('非法 mode 不抛错（回退默认分支）', () => {
    const ctx = makeCtx();
    // 故意传**类型外**的值验证兜底分支：`MosaicMode` 是四值联合，而运行期要能承受任意字符串
    // （数据可能来自旧存档/手改）。类型上不成立 ⇒ 单点收口在 rawMode。
    expect(() => drawMosaicOnBox(ctx, SRC, BOX, rawMode('unknown-mode'), 0.5)).not.toThrow();
  });
});

describe('MOSAIC_PALETTE', () => {
  it('包含 8 个标准色', () => {
    expect(MOSAIC_PALETTE).toHaveLength(8);
    expect(MOSAIC_PALETTE).toContain('#000000');
    expect(MOSAIC_PALETTE).toContain('#eab308');
  });
});
