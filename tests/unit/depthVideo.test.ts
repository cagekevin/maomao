/**
 * 深度转视频 —— 纯函数单测（State 3 断言 A1–A6）。
 * 覆盖 depthVideo/depthUrls.ts、engine.ts、loader.ts 的纯逻辑，实现一变必红。
 */
import { describe, it, expect } from 'vitest';
import { buildRuntimeModels } from '../../src/components/base/depthVideo/depthUrls.ts';
import {
  adjustDepthValue,
  grayFromRaw,
  grayFromTensor,
  blendFrames,
  pickRecordingFormat,
  depthOutputName,
  buildDepthChildSpec,
} from '../../src/components/base/depthVideo/engine.ts';
import { configureEnv, disposeModel } from '../../src/components/base/depthVideo/loader.ts';

describe('A1 adjustDepthValue — 深度值对比度/反色', () => {
  it('128 在任意 contrast 下保持 128（围绕中心对称）', () => {
    expect(adjustDepthValue(128, { contrast: 1.6, invert: false })).toBe(128);
  });
  it('contrast=1.6 放大偏离', () => {
    expect(adjustDepthValue(200, { contrast: 1.6, invert: false })).toBe(
      Math.round(128 + (200 - 128) * 1.6),
    );
    expect(adjustDepthValue(200, { contrast: 1.6, invert: false })).toBe(243);
  });
  it('invert 取反', () => {
    expect(adjustDepthValue(100, { contrast: 1.0, invert: true })).toBe(155);
  });
  it('越界输入恒 clamp 到 [0,255]', () => {
    expect(adjustDepthValue(-50, { contrast: 2, invert: false })).toBe(0);
    expect(adjustDepthValue(500, { contrast: 2, invert: false })).toBe(255);
    expect(adjustDepthValue(9999, { contrast: 1, invert: true })).toBe(0);
  });
});

describe('A2 灰度化 grayFromRaw / grayFromTensor', () => {
  it('raw 4 通道按均值灰度', () => {
    // 1 像素 RGBA(255,0,0,255) → 灰度 = (255+0+0)/3 ≈ 85
    const raw = { data: [255, 0, 0, 255], width: 1, height: 1, channels: 4 };
    const out = grayFromRaw(raw, { contrast: 1, invert: false });
    expect(out.length).toBe(1);
    expect(out[0]).toBe(85);
  });
  it('raw 1 通道复用首通道', () => {
    const raw = { data: [200, 200], width: 1, height: 2, channels: 1 };
    const out = grayFromRaw(raw, { contrast: 1, invert: true });
    expect(out[0]).toBe(255 - 200);
    expect(out[1]).toBe(255 - 200);
  });
  it('tensor 归一化 float 放大到 0..255', () => {
    // min=0,max=1 → scale 255；0→0，0.5→127.5→round 128，1→255
    const out = grayFromTensor(new Float32Array([0, 0.5, 1]), [1, 1, 3], {
      contrast: 1,
      invert: false,
    });
    expect(Array.from(out)).toEqual([0, Math.round(127.5), 255]);
  });
  it('tensor 全等不除零、不产生 NaN', () => {
    const out = grayFromTensor(new Float32Array([0.5, 0.5, 0.5]), [1, 1, 3], {
      contrast: 1,
      invert: false,
    });
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('A3 帧间平滑 blendFrames', () => {
  const prev = new Float32Array([0, 100, 200]);
  const curr = new Float32Array([255, 255, 255]);
  it('smooth=0 输出 = curr', () => {
    expect(Array.from(blendFrames(prev, curr, 3, 0))).toEqual([255, 255, 255]);
  });
  it('smooth=0.85 输出 = round(prev*0.85+curr*0.15)', () => {
    const out = blendFrames(prev, curr, 3, 0.85);
    expect(out[0]).toBe(Math.round(0 * 0.85 + 255 * 0.15));
    expect(out[1]).toBe(Math.round(100 * 0.85 + 255 * 0.15));
    expect(out[2]).toBe(Math.round(200 * 0.85 + 255 * 0.15));
  });
  it('越界 smooth 被 clamp、无越界输出', () => {
    const out1 = blendFrames(prev, curr, 3, 2);
    const out2 = blendFrames(prev, curr, 3, -1);
    expect(Math.max(...Array.from(out1))).toBeLessThanOrEqual(255);
    expect(Math.min(...Array.from(out1))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...Array.from(out2))).toBeLessThanOrEqual(255);
  });
});

describe('A4 格式探测 pickRecordingFormat', () => {
  const mp4 = (m: string) => m.includes('mp4');
  const webm = (m: string) => m.includes('webm');
  it('auto + mp4 可用 → mp4', () => {
    const f = pickRecordingFormat('auto', mp4);
    expect(f.extension).toBe('mp4');
    expect(f.fellBackToWebm).toBe(false);
  });
  it('auto + mp4 不可用、webm 可用 → webm', () => {
    const f = pickRecordingFormat('auto', webm);
    expect(f.extension).toBe('webm');
    expect(f.fellBackToWebm).toBe(false);
  });
  it('显式 webm 不探测 mp4', () => {
    const f = pickRecordingFormat('webm', webm);
    expect(f.extension).toBe('webm');
  });
  it('显式 mp4 且不支持 → 如实回退标记（不静默）', () => {
    const f = pickRecordingFormat('mp4', webm);
    expect(f.extension).toBe('webm');
    expect(f.fellBackToWebm).toBe(true);
  });
  it('完全无支持 → 抛错', () => {
    expect(() => pickRecordingFormat('auto', () => false)).toThrow();
  });
});

describe('A5 资源前缀 buildRuntimeModels（同源根相对）', () => {
  it('返回同源根相对路径（页面 origin 即资源 origin）', () => {
    const p = buildRuntimeModels('http://127.0.0.1:18080');
    expect(p.root).toBe('/depth-video');
    expect(p.transformers).toBe('/depth-video/vendor/transformers/transformers.web.min.js');
    expect(p.modelRoot).toBe('/depth-video/models/');
    expect(p.wasmPaths.wasm).toBe(
      '/depth-video/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm',
    );
    expect(p.ortWebgpuBundle).toBe('/depth-video/vendor/onnxruntime/ort.webgpu.bundle.min.mjs');
  });
  it('apiBase 不参与拼装，无双斜杠（相对路径恒定）', () => {
    const p = buildRuntimeModels('http://127.0.0.1:18080/');
    expect(p.transformers).not.toContain('//vendor');
    expect(p.modelRoot).not.toContain('//models');
    expect(p.root).toBe('/depth-video');
  });
  it('configureEnv 将相对路径写入 env（单源派生）', () => {
    const env: any = { backends: { onnx: { wasm: {}, webgpu: {} } } };
    const runtime = { env, pipeline: null, RawImage: null };
    configureEnv(runtime, buildRuntimeModels('http://126.0.0.1:18080'));
    expect(runtime.env.localModelPath).toBe('/depth-video/models/');
    expect(runtime.env.backends.onnx.wasm.wasmPaths.wasm).toContain('.wasm');
  });
});

describe('A6 下游节点规格 buildDepthChildSpec + 命名', () => {
  it('下游为 imageNode 视频态，imageUrl=outputUrl，expanded=true，label=name', () => {
    const spec = buildDepthChildSpec(
      'http://127.0.0.1:18080/files/canvas/video-process/x_depth.mp4',
      'scene_depth.mp4',
    );
    expect(spec.type).toBe('imageNode');
    expect(spec.data.mediaType).toBe('video');
    expect(spec.data.imageUrl).toBe(
      'http://127.0.0.1:18080/files/canvas/video-process/x_depth.mp4',
    );
    expect(spec.data.expanded).toBe(true);
    expect(spec.data.label).toBe('scene_depth.mp4');
  });
  it('命名 ${stripExt(name)}_depth.${ext}，不覆盖源名', () => {
    expect(depthOutputName('scene.mp4', 'mp4')).toBe('scene_depth.mp4');
    expect(depthOutputName('视频_01', 'webm')).toBe('视频_01_depth.webm');
  });
});

describe('附加：disposeModel 释放幂等（G3 防崩）', () => {
  it('重复调用不抛错', () => {
    expect(() => disposeModel()).not.toThrow();
    expect(() => disposeModel()).not.toThrow();
  });
});
