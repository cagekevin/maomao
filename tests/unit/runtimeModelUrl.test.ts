/**
 * 本机模型取件 URL —— 纯函数单测（plan 147）。
 *
 * 锁的是**契约**不是实现：根相对（同源铁律）、无双斜杠、无多余尾斜杠。
 * 「两侧前缀同值」那一半不在这里测 —— 由 `check:arch` 的 `CROSS_STACK_CONSTS`
 * 逐字对账（`PREFIX_MODELS` 项），避免同一判据出现第二份实现。
 */
import { describe, it, expect } from 'vitest';
import { PREFIX_MODELS, runtimeModelUrl } from '../../src/components/base/core/runtimeModelUrl.ts';

describe('本机模型取件 URL runtimeModelUrl（同源根相对）', () => {
  it('根相对：不以 http 开头、不以 ./ 开头（同源铁律——绝对 URL 会让取件静默失败）', () => {
    for (const u of [runtimeModelUrl('mediapipe'), runtimeModelUrl('three', 'a.glb')]) {
      expect(u.startsWith('/')).toBe(true);
      expect(u).not.toMatch(/^https?:/);
      expect(u).not.toMatch(/^\.\//);
    }
  });

  it('拼成 /models/<modelId>/<relPath>；relPath 为空时不留尾斜杠', () => {
    expect(runtimeModelUrl('mediapipe', 'wasm')).toBe('/models/mediapipe/wasm');
    expect(runtimeModelUrl('three', 'xbot-animated-lod.glb')).toBe(
      '/models/three/xbot-animated-lod.glb',
    );
    expect(runtimeModelUrl('mediapipe')).toBe('/models/mediapipe');
  });

  it('relPath 前导斜杠被规整 ⇒ 不产生双斜杠', () => {
    const u = runtimeModelUrl('mediapipe', '/wasm/blaze_face_short_range.tflite');
    expect(u).toBe('/models/mediapipe/wasm/blaze_face_short_range.tflite');
    expect(u).not.toContain('//');
  });

  it('前缀真源 = /models/（与后端同值由 check:arch 对账）', () => {
    expect(PREFIX_MODELS).toBe('/models/');
  });
});
