/**
 * AI 抠图能力片 · 纯函数单测（`ADR-0049`：只锁用户可感知契约，禁 UI 存在性测试）。
 *
 * 【测什么】`mattingEngine` 的纯函数 + `mattingConfig` 的训练口径常量。
 * **不测** `MattingEditor` 的元素存在性（`ADR-0049` 禁）。
 *
 * 【为什么直接 import 实现模块（而不是走能力片门面）】
 * 门面 `index.ts` 是**用例编排**（`createMattingSession()` / `cutout()`），
 * 不导出这些纯函数 —— 那样是对的，门面不该为测试长出一条导出清单。
 * 本文件测的是**实现细节的正确性**（缩放口径 / 坐标换算 / logits 阈值），
 * 故直连被测模块，也避免为测试在门面上开洞。
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
} from '@/components/image/lib/matting/mattingEngine.ts';
import {
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

describe('toImageCoords · 显示坐标 → 原图坐标', () => {
  it('除以显示缩放（缩小显示时坐标变大）', () => {
    expect(toImageCoords({ x: 100, y: 50 }, 0.5)).toEqual({ x: 200, y: 100 });
  });

  it('显示缩放 1（原尺寸）= 恒等', () => {
    expect(toImageCoords({ x: 100, y: 50 }, 1)).toEqual({ x: 100, y: 50 });
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
  // 用**真实常量**而非手抄数字：常量改了这里跟着变（不是把我抄的值再断言一遍）
  it('喂入 MEAN ⇒ 三平面都归零', () => {
    const plane = 2;
    const arr = new Float32Array(3 * plane);
    normalizeInto(arr, plane, 0, MATTING_MEAN[0], MATTING_MEAN[1], MATTING_MEAN[2]);
    expect(arr[0]).toBeCloseTo(0);
    expect(arr[plane]).toBeCloseTo(0);
    expect(arr[2 * plane]).toBeCloseTo(0);
  });

  it('喂入 MEAN + 1×STD ⇒ 归一到 1（且落在各自平面）', () => {
    const plane = 3;
    const arr = new Float32Array(3 * plane);
    normalizeInto(
      arr,
      plane,
      1,
      MATTING_MEAN[0] + MATTING_STD[0],
      MATTING_MEAN[1],
      MATTING_MEAN[2],
    );
    expect(arr[1]).toBeCloseTo(1); // R 平面 = 均值 + 1 个标准差 ⇒ 1
    expect(arr[plane + 1]).toBeCloseTo(0); // G 平面仍是均值
    expect(arr[2 * plane + 1]).toBeCloseTo(0); // B 平面仍是均值
  });

  it('CHW 排布：三个平面各占 plane 长度，互不覆盖', () => {
    const plane = 2;
    const arr = new Float32Array(3 * plane);
    // 只给 R 通道一个非均值 → 只有第 0 平面该动
    normalizeInto(
      arr,
      plane,
      1,
      MATTING_MEAN[0] + MATTING_STD[0],
      MATTING_MEAN[1],
      MATTING_MEAN[2],
    );
    expect(arr[1]).toBeCloseTo(1);
    expect(arr[1 + plane]).toBeCloseTo(0);
    expect(arr[1 + 2 * plane]).toBeCloseTo(0);
  });

  it('三通道各用**各自**的 mean/std（防串用：G 用 STD[0] 这类错要被抓到）', () => {
    const plane = 1;
    const arr = new Float32Array(3 * plane);
    // 三通道各给「均值 + 1×自己那档 STD」⇒ 三平面都该是 1；串用任何一档都会偏
    normalizeInto(
      arr,
      plane,
      0,
      MATTING_MEAN[0] + MATTING_STD[0],
      MATTING_MEAN[1] + MATTING_STD[1],
      MATTING_MEAN[2] + MATTING_STD[2],
    );
    expect(arr[0]).toBeCloseTo(1);
    expect(arr[plane]).toBeCloseTo(1);
    expect(arr[2 * plane]).toBeCloseTo(1);
  });
});
