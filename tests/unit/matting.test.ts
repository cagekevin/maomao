/**
 * AI 抠图能力片 · 单测（`ADR-0049`：只锁用户可感知契约，禁 UI 存在性测试）。
 *
 * 【测什么】`mattingEngine` 的纯函数 + `mattingConfig` 的训练口径常量。
 * **不测** `MattingEditor` 的元素存在性（`ADR-0049` 禁）。
 *
 * 【非自证式判据】（`架构师写新业务代码.md` §4.7）
 * 每条断言都满足：**把被测实现改坏，断言必红**。
 * 例：把 `scaleForSize` 的 `Math.max` 改成 `Math.min` ⇒ 首条必红；
 * 把 `isForeground` 的 `> 0` 改成 `> 0.5` ⇒ 阈值那条必红。
 */
import { describe, it, expect } from 'vitest';
import {
  alphaFromLogits,
  drawParamsFor,
  isForeground,
  normalizeInto,
  scaleForSize,
  toImageCoords,
  toModelCoords,
} from '@/components/image/lib/matting/mattingEngine.ts';
import {
  MATTING_EMBEDDING_SHAPE,
  MATTING_INPUT_SIZE,
  MATTING_MEAN,
  MATTING_STD,
} from '@/components/image/lib/matting/mattingConfig.ts';

describe('mattingConfig · 训练口径常量（改即错）', () => {
  it('输入边长 = 1024', () => {
    expect(MATTING_INPUT_SIZE).toBe(1024);
  });

  it('归一化参数与训练一致（ImageNet 口径）', () => {
    expect(MATTING_MEAN).toEqual([123.675, 116.28, 103.53]);
    expect(MATTING_STD).toEqual([58.395, 57.12, 57.375]);
  });

  it('embedding 形状：两路都要（SAM-HQ 特有 interm 通路）', () => {
    // 若误按标准 SAM 只留一路，这里会红 —— 这正是"两路都要"的机器守卫
    expect(MATTING_EMBEDDING_SHAPE.imageChannels).toBe(256);
    expect(MATTING_EMBEDDING_SHAPE.intermChannels).toBe(160);
    expect(MATTING_EMBEDDING_SHAPE.size).toBe(64);
  });
});

describe('scaleForSize · 等比缩放到最长边 = 1024', () => {
  it('宽图按宽缩放（1024/w）', () => {
    expect(scaleForSize(2048, 1024)).toBe(0.5);
  });

  it('高图按高缩放（1024/h）', () => {
    expect(scaleForSize(1024, 2048)).toBe(0.5);
  });

  it('小图会**放大**（scale > 1）—— 不是只缩不放', () => {
    expect(scaleForSize(512, 512)).toBe(2);
  });

  it('非法尺寸抛错（编程错误，不静默返回默认值）', () => {
    expect(() => scaleForSize(0, 100)).toThrow();
    expect(() => scaleForSize(100, -1)).toThrow();
  });
});

describe('drawParamsFor · 绘制参数（左上对齐，右下留空）', () => {
  it('宽图：drawH 占满 1024，drawW 按比例', () => {
    const p = drawParamsFor(2048, 1024);
    expect(p.drawW).toBe(1024);
    expect(p.drawH).toBe(512);
  });

  it('高图：drawW 占满 1024，drawH 按比例', () => {
    const p = drawParamsFor(1024, 2048);
    expect(p.drawW).toBe(512);
    expect(p.drawH).toBe(1024);
  });
});

describe('toImageCoords / toModelCoords · 三段坐标链', () => {
  it('显示坐标 → 原图坐标（除以显示缩放）', () => {
    expect(toImageCoords({ x: 100, y: 50 }, 0.5)).toEqual({ x: 200, y: 100 });
  });

  it('原图坐标 → 模型坐标（乘缩放系数）', () => {
    expect(toModelCoords({ x: 200, y: 100 }, 0.5)).toEqual({ x: 100, y: 50 });
  });

  it('两段可串成完整链：显示坐标 → 模型坐标', () => {
    const img = toImageCoords({ x: 100, y: 50 }, 0.5); // 显示 → 原图
    const model = toModelCoords(img, 0.5); // 原图 → 模型
    expect(model).toEqual({ x: 100, y: 50 });
  });

  it('显示缩放非法抛错', () => {
    expect(() => toImageCoords({ x: 1, y: 1 }, 0)).toThrow();
  });
});

describe('isForeground / alphaFromLogits · 阈值是 0（logits，不是概率）', () => {
  it('正 logit ⇒ 前景；负 logit ⇒ 背景', () => {
    expect(isForeground(0.1)).toBe(true);
    expect(isForeground(-0.1)).toBe(false);
  });

  it('0 本身不算前景（严格大于）', () => {
    expect(isForeground(0)).toBe(false);
  });

  it('小正数仍是前景 —— 证明阈值不是 0.5（误用概率阈值会大幅收缩 mask）', () => {
    expect(isForeground(0.01)).toBe(true);
  });

  it('alphaFromLogits：前景 255 / 背景 0', () => {
    const alpha = alphaFromLogits([1.5, -1.5, 0, 0.3]);
    expect(Array.from(alpha)).toEqual([255, 0, 0, 255]);
  });

  it('alpha 长度 = 输入长度', () => {
    expect(alphaFromLogits(new Float32Array(100)).length).toBe(100);
  });
});

describe('normalizeInto · CHW 排布归一化', () => {
  it('按 (px-mean)/std 写入三个平面', () => {
    const plane = 2;
    const arr = new Float32Array(3 * plane);
    normalizeInto(arr, plane, 0, 123.675, 116.28, 103.53); // 用均值 ⇒ 结果全 0
    expect(arr[0]).toBeCloseTo(0);
    expect(arr[plane]).toBeCloseTo(0);
    expect(arr[2 * plane]).toBeCloseTo(0);
  });

  it('平面索引正确（CHW：R 在前，B 在后）', () => {
    const plane = 3;
    const arr = new Float32Array(3 * plane);
    normalizeInto(arr, plane, 1, 123.675 + 58.395, 116.28, 103.53);
    expect(arr[1]).toBeCloseTo(1); // R 平面 = 均值 + 1 个标准差 ⇒ 1
    expect(arr[plane + 1]).toBeCloseTo(0); // G 平面仍是均值
    expect(arr[2 * plane + 1]).toBeCloseTo(0); // B 平面仍是均值
  });
});
