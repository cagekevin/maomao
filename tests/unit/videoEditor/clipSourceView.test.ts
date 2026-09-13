/**
 * 胶片条 / 波形的**呈现映射**（`docs/120` C11.10「裁剪即所见」+ C11.7b「真实波形」）。
 *
 * 【为什么这条值得单测】映射算错**不报错、不崩、不破任何闸**，只会让片段显示
 * **别的时间**的画面/波形 —— 而且看起来完全正常。人工点一遍几乎发现不了。
 * 故把「源区间 → 图上区间」的推导钉死在测试里，尤其钉死「胶片条与波形**共用同一映射**」
 * （两者一旦各写一份，就会出现「胶片裁剪了、波形却是整段」这种最阴的漂）。
 */
import { describe, expect, it } from 'vitest';
import {
  filmstripBackground,
  sourceWindow,
  waveformPath,
  waveformSpan,
} from '../../../src/components/videoEditor/panels/dock/clipSourceView.ts';

describe('sourceWindow / filmstripBackground —— 源区间映射到胶片图上的位置', () => {
  it('整段未裁 → 图铺满、无偏移（最常走的一支）', () => {
    expect(filmstripBackground({ sourceStart: 0, sourceEnd: 10 }, 10)).toEqual({
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 50%',
      backgroundRepeat: 'repeat-x',
    });
  });

  it('裁掉前半（取后一半）→ 放大 200% 并靠右', () => {
    // D=10, start=5, end=10 ⇒ d=5 ⇒ size=200%；span=D−d=5 ⇒ P=100·5/5=100%
    expect(filmstripBackground({ sourceStart: 5, sourceEnd: 10 }, 10)).toEqual({
      backgroundSize: '200% 100%',
      backgroundPosition: '100% 50%',
      backgroundRepeat: 'repeat-x',
    });
  });

  it('取中间三分之一 → 放大 300% 且落在正中', () => {
    // D=30, start=10, end=20 ⇒ d=10 ⇒ size=300%；span=20 ⇒ P=100·10/20=50%
    expect(filmstripBackground({ sourceStart: 10, sourceEnd: 20 }, 30)).toEqual({
      backgroundSize: '300% 100%',
      backgroundPosition: '50% 50%',
      backgroundRepeat: 'repeat-x',
    });
  });

  it('横向恒为 repeat-x（兜住放大取整产生的缝隙，杜绝露底黑缝）', () => {
    for (const clip of [
      { sourceStart: 0, sourceEnd: 10 },
      { sourceStart: 5, sourceEnd: 10 },
      { sourceStart: 5, sourceEnd: 2 }, // 脏数据
    ]) {
      expect(filmstripBackground(clip, 10).backgroundRepeat).toBe('repeat-x');
    }
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
      backgroundRepeat: 'repeat-x',
    });
    expect(filmstripBackground({ sourceStart: 0, sourceEnd: 5 }, 0)).toEqual({
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 50%',
      backgroundRepeat: 'repeat-x',
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

/* ────────────────────────────────────────────────────────────────
 * 波形（C11.7b）与胶片条**共用同一映射** —— 这正是它们的防漂守卫
 * ──────────────────────────────────────────────────────────────── */

describe('waveformSpan —— 与 filmstripBackground 同源（防「胶片裁剪了、波形却是整段」）', () => {
  it('同一源区间，两种表达指向同一个窗口', () => {
    const clip = { sourceStart: 10, sourceEnd: 20 };
    const bg = filmstripBackground(clip, 30);
    const span = waveformSpan(clip, 30);
    // background-size 的百分比 = 绝对定位元素的 width 百分比（同一个数）
    expect(Number.parseFloat(bg.backgroundSize)).toBe(Number.parseFloat(span.width));
    // background-position 的百分比 → left 的百分比：x/W = -(size%-100)/100 * P/100
    const size = Number.parseFloat(span.width);
    const pos = Number.parseFloat(bg.backgroundPosition);
    const leftFromBg = (-(size - 100) / 100) * (pos / 100) * 100;
    expect(Number.parseFloat(span.left)).toBeCloseTo(leftFromBg, 6);
  });

  it('整段未裁 → left 0%、width 100%（不缩放、不偏移）', () => {
    expect(waveformSpan({ sourceStart: 0, sourceEnd: 30 }, 30)).toEqual({
      left: '0%',
      width: '100%',
    });
  });

  it('取后半段 → 左移一半、宽度翻倍（与胶片条的 200%/100% 同源）', () => {
    expect(waveformSpan({ sourceStart: 15, sourceEnd: 30 }, 30)).toEqual({
      left: '-100%',
      width: '200%',
    });
  });

  it('`sourceWindow` 是两者的共同上游（脏数据时两个表达一起回落，不许一个降一个不降）', () => {
    const clip = { sourceStart: 5, sourceEnd: 2 };
    expect(sourceWindow(clip, 10)).toEqual({ widthPercent: 100, leftPercent: 0 });
    expect(filmstripBackground(clip, 10).backgroundSize).toBe('100% 100%');
    expect(waveformSpan(clip, 10).width).toBe('100%');
  });
});

describe('waveformPath —— 峰值数组 → 对称波形路径', () => {
  it('空峰值 → 空路径（不画一条贴中线的假波形）', () => {
    expect(waveformPath(new Float32Array(0))).toBe('');
  });

  it('中线 = 50，峰高按幅度上下对称展开', () => {
    const path = waveformPath(new Float32Array([0, 0.5, 1]));
    const ys = Array.from(path.matchAll(/,(-?\d+(?:\.\d+)?)/g)).map((m) => Number(m[1]));
    // 上半（从左到右）：静音 → 中线；半幅 → 上移 25；满幅 → 顶
    expect(ys[0]).toBe(50);
    expect(ys[1]).toBe(25);
    expect(ys[2]).toBe(0);
    // 下半**从右往左**走（闭合路径）：顶 → 25 → 中线
    expect(ys[3]).toBe(100);
    expect(ys[4]).toBe(75);
    expect(ys[5]).toBe(50);
  });

  it('越界峰值（脏数据 >1 / NaN / 负数）夹回 0..1，不产生非法坐标', () => {
    const path = waveformPath(new Float32Array([2, NaN, -1, 0.3]));
    expect(path).not.toContain('NaN');
    for (const y of Array.from(path.matchAll(/,(-?\d+(?:\.\d+)?)/g)).map((m) => Number(m[1]))) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('x 坐标随列严格递增（上半），且覆盖到最后一列', () => {
    const peaks = new Float32Array([0.2, 0.4, 0.6, 0.8]);
    const path = waveformPath(peaks);
    const pairs = path
      .slice(1)
      .split(' L')
      .map((seg) => seg.split(',').map(Number));
    expect(pairs.length).toBe(peaks.length * 2);
    for (let i = 1; i < peaks.length; i++) {
      expect(pairs[i][0]).toBeGreaterThan(pairs[i - 1][0]);
    }
  });
});
