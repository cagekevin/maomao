/**
 * 音频波形**峰值**单测 —— `docs/120` C11.7b「真实波形」的算法层。
 *
 * 波形里唯一有算法的是「采样 → 列峰值」，而它**不碰 IO**：故在这里把
 * 「不漏尖峰 / 不错位 / 脏数据不产生 NaN」钉死；外层只剩 mediabunny 的解码搬运。
 *
 * 【一个专门的语义要守住】采样数少于列数时，后段列必须是 **0 而不是重复填充** ——
 * 重复会让波形看起来"还有声音"，而 C11.7b 明令「固定图案冒充波形 = 撒谎」。
 */
import { describe, expect, it } from 'vitest';
import { downsamplePeaks, mergeIntoPeaks } from '../../src/components/base/utils/audioPeaks.ts';

describe('downsamplePeaks —— 采样 → 列峰值（每列取绝对值最大）', () => {
  it('把最大值放进它所属的那一列，且是**绝对值**（负尖峰也算音量）', () => {
    const samples = new Float32Array([0.1, 0.2, -0.9, 0.3]);
    const peaks = Array.from(downsamplePeaks(samples, 2));
    // 前 2 个样本 → 第 0 列（峰 0.2）；后 2 个 → 第 1 列（峰 0.9）
    expect(peaks[0]).toBeCloseTo(0.2, 5);
    expect(peaks[1]).toBeCloseTo(0.9, 5);
  });

  it('列数多于采样数（上采样）→ 采样按它的**时间覆盖**铺满各列（这是真实覆盖，不是重复填充）', () => {
    // 1 个采样覆盖整段 [0,1) → 4 列都有它
    const peaks = Array.from(downsamplePeaks(new Float32Array([0.5]), 4));
    expect(peaks).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('空采样 → 长度仍是 columns 的全 0 数组（调用方不必判空）', () => {
    const peaks = downsamplePeaks(new Float32Array(0), 8);
    expect(peaks.length).toBe(8);
    expect(Array.from(peaks)).toEqual(new Array(8).fill(0));
  });

  it('越界幅度夹到 1（不产生 >1 的柱高，SVG 会被拉出 viewBox）', () => {
    const peaks = downsamplePeaks(new Float32Array([3, -7]), 1);
    expect(Array.from(peaks)).toEqual([1]);
  });

  it('columns 非法（0 / 负 / 小数）→ 至少 1 列（小数向下取整）', () => {
    expect(downsamplePeaks(new Float32Array([1]), 0).length).toBe(1);
    expect(downsamplePeaks(new Float32Array([1]), -3).length).toBe(1);
    expect(downsamplePeaks(new Float32Array([1]), 2.7).length).toBe(2);
  });

  it('时间上靠后的尖峰不会被前面的列吞掉（不错位）', () => {
    const samples = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0.95]);
    const peaks = Array.from(downsamplePeaks(samples, 4));
    expect(peaks[3]).toBeCloseTo(0.95, 5);
    expect(peaks[0]).toBe(0);
  });
});

describe('mergeIntoPeaks —— 流式解码时按「整段时长」把块归并进列峰值', () => {
  it('后一块的峰值**只覆盖自己那段列**，不冲掉前一块（跨块不丢尖峰）', () => {
    const peaks = new Float32Array(4);
    // 第 1 块：0..0.5s（total 1s，rate 4/s，2 个采样）→ 列 0、1
    mergeIntoPeaks(peaks, new Float32Array([0.9, 0.9]), 0, 4, 1);
    expect(peaks[0]).toBeCloseTo(0.9, 5);
    expect(peaks[1]).toBeCloseTo(0.9, 5);
    expect(peaks[2]).toBe(0);
    // 第 2 块：0.5..1.0s → 列 2、3
    mergeIntoPeaks(peaks, new Float32Array([0.4, 0.4]), 0.5, 4, 1);
    expect(peaks[2]).toBeCloseTo(0.4, 5);
    expect(peaks[3]).toBeCloseTo(0.4, 5);
  });

  it('跨块边界（块正好骑在两列上）→ 两列都取到该块的值', () => {
    const peaks = new Float32Array(2);
    mergeIntoPeaks(peaks, new Float32Array([0.8, 0.8]), 0.25, 4, 1);
    // 块覆盖 0.25s..0.75s ⇒ 骑在列 0（0..0.5）与列 1（0.5..1）上
    expect(peaks[0]).toBeCloseTo(0.8, 5);
    expect(peaks[1]).toBeCloseTo(0.8, 5);
  });

  it('同一列被两块先后命中 → 取较大者（峰值是 max，不是覆盖）', () => {
    const peaks = new Float32Array(2);
    mergeIntoPeaks(peaks, new Float32Array([0.2]), 0, 4, 1);
    mergeIntoPeaks(peaks, new Float32Array([0.6]), 0.25, 4, 1);
    expect(peaks[0]).toBeCloseTo(0.6, 5);
  });

  it('脏入参（totalSeconds ≤ 0 / sampleRate ≤ 0 / 空块）→ 不动峰值、不产生 NaN', () => {
    const peaks = new Float32Array([0.5, 0.5]);
    mergeIntoPeaks(peaks, new Float32Array([1, 1]), 0, 0, 1);
    mergeIntoPeaks(peaks, new Float32Array([1, 1]), 0, 44100, 0);
    mergeIntoPeaks(peaks, new Float32Array(0), 0, 44100, 1);
    expect(Array.from(peaks)).toEqual([0.5, 0.5]);
  });

  it('offset 超出总时长 → 不越界写（列索引被夹在数组内）', () => {
    const peaks = new Float32Array(2);
    mergeIntoPeaks(peaks, new Float32Array([1, 1, 1, 1]), 5, 4, 1);
    expect(Array.from(peaks)).toEqual([0, 0]);
  });
});
