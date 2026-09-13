/**
 * 胶片条视图映射（`docs/120` C11.10「裁剪即所见」）。
 *
 * 【为什么这条值得单测】映射算错**不报错、不崩、不破任何闸**，只会让片段显示
 * **别的时间**的画面 —— 而且看起来完全正常。人工点一遍几乎发现不了（除非恰好剪过又记得原片）。
 * 故把「源区间 → 图上区间」的推导钉死在测试里。
 */
import { describe, expect, it } from 'vitest';
import { filmstripBackground } from '../../../src/components/videoEditor/panels/dock/filmstripView.ts';

describe('filmstripBackground —— 源区间映射到胶片图上的位置', () => {
  it('整段未裁 → 图铺满、无偏移（最常走的一支）', () => {
    expect(filmstripBackground({ sourceStart: 0, sourceEnd: 10 }, 10)).toEqual({
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 50%',
    });
  });

  it('裁掉前半（取后一半）→ 放大 200% 并靠右', () => {
    // D=10, start=5, end=10 ⇒ d=5 ⇒ size=200%；span=D−d=5 ⇒ P=100·5/5=100%
    expect(filmstripBackground({ sourceStart: 5, sourceEnd: 10 }, 10)).toEqual({
      backgroundSize: '200% 100%',
      backgroundPosition: '100% 50%',
    });
  });

  it('取中间三分之一 → 放大 300% 且落在正中', () => {
    // D=30, start=10, end=20 ⇒ d=10 ⇒ size=300%；span=20 ⇒ P=100·10/20=50%
    expect(filmstripBackground({ sourceStart: 10, sourceEnd: 20 }, 30)).toEqual({
      backgroundSize: '300% 100%',
      backgroundPosition: '50% 50%',
    });
  });

  it('放大倍率与偏移成正比：起始越靠后，越靠右（单调性，防公式写反）', () => {
    const early = filmstripBackground({ sourceStart: 0, sourceEnd: 5 }, 20);
    const late = filmstripBackground({ sourceStart: 15, sourceEnd: 20 }, 20);
    expect(Number.parseFloat(early.backgroundPosition)).toBe(0);
    expect(Number.parseFloat(late.backgroundPosition)).toBe(100);
    // 两段时长相同 ⇒ 放大倍率相同
    expect(early.backgroundSize).toBe(late.backgroundSize);
  });

  it('出点超出源时长 → 倍率仍按**片段真实时长**算（与盒子宽度同源），且位置不产生负数', () => {
    // 不在这里"夹到源末尾"：盒子宽度 = clipDuration（994s）—— 映射若自行夹成 5s，图就会与盒子对不上。
    // 脏数据的正确处置是「如实按同一公式算」，而不是两处各夹一次。
    const out = filmstripBackground({ sourceStart: 5, sourceEnd: 999 }, 10);
    expect(Number.parseFloat(out.backgroundSize)).toBeCloseTo((10 / 994) * 100, 6);
    expect(Number.parseFloat(out.backgroundPosition)).toBe(0);
  });

  it('脏数据（出点倒挂 / 零时长源）→ 回落整段，不产生 NaN', () => {
    // 出点倒挂 ⇒ 时长为 0 ⇒ 无区间可映射，回落整段（与 `clipDuration` 一致：它也是 0）
    expect(filmstripBackground({ sourceStart: 5, sourceEnd: 2 }, 10)).toEqual({
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 50%',
    });
    expect(filmstripBackground({ sourceStart: 0, sourceEnd: 5 }, 0)).toEqual({
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 50%',
    });
  });

  it('放大倍率恒等于 `源时长 / 片段时长`（与决定盒子宽度的 `clipDuration` 同一公式）', () => {
    // 这条是「图片会不会与盒子对不上」的守卫：两处时长一旦分歧，这里先红
    const cases: [{ sourceStart: number; sourceEnd: number }, number][] = [
      [{ sourceStart: -3, sourceEnd: 2 }, 10], // 负入点脏数据：时长仍是 5（= 2 − (−3)）
      [{ sourceStart: 0, sourceEnd: 10 }, 10],
      [{ sourceStart: 4, sourceEnd: 6 }, 10],
      [{ sourceStart: 8, sourceEnd: 20 }, 10], // 出点越界
    ];
    for (const [clip, sourceDuration] of cases) {
      const expected = (sourceDuration / Math.max(0, clip.sourceEnd - clip.sourceStart)) * 100;
      const size = Number.parseFloat(filmstripBackground(clip, sourceDuration).backgroundSize);
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeCloseTo(expected, 6);
    }
  });

  it('偏移恒在 0%–100% 之间（CSS 百分比语义要求，越界会露白）', () => {
    for (const [start, end] of [
      [0, 1],
      [1, 2],
      [2.5, 7.5],
      [9, 10],
    ]) {
      const out = filmstripBackground({ sourceStart: start, sourceEnd: end }, 10);
      const p = Number.parseFloat(out.backgroundPosition);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
      expect(Number.isFinite(p)).toBe(true);
    }
  });
});
