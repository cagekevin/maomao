import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_PIXELS_PER_SECOND,
  MIN_PIXELS_PER_SECOND,
  clampZoom,
  dropIndexAt,
  fitZoom,
  pxDeltaToTime,
  rectsIntersect,
  snapTime,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../src/components/base/utils/timeline/timeScale.ts';
import {
  buildTicks,
  formatTickLabel,
  pickTickStep,
} from '../../src/components/base/utils/timeline/rulerTicks.ts';

describe('timeScale · 时间↔像素', () => {
  it('timeToX / xToTime 互为反函数（含滚动位移）', () => {
    expect(timeToX(2, 50)).toBe(100);
    expect(timeToX(2, 50, 30)).toBe(70);
    expect(xToTime(70, 50, 30)).toBe(2);
    expect(xToTime(timeToX(3.3, 37, 12), 37, 12)).toBeCloseTo(3.3, 10);
  });

  it('pxDeltaToTime / timeDeltaToPx 互为反函数，且与滚动无关', () => {
    expect(pxDeltaToTime(72, 36)).toBe(2);
    expect(timeDeltaToPx(2, 36)).toBe(72);
  });

  it('clampZoom 夹到上下限；非法值退到下限（不产出 NaN 传播）', () => {
    expect(clampZoom(1)).toBe(MIN_PIXELS_PER_SECOND);
    expect(clampZoom(1e6)).toBe(MAX_PIXELS_PER_SECOND);
    expect(clampZoom(Number.NaN)).toBe(MIN_PIXELS_PER_SECOND);
  });

  it('fitZoom：整条时长恰好铺满宽度，再夹取', () => {
    expect(fitZoom(100, 1000)).toBe(10);
    expect(fitZoom(0, 1000)).toBe(MIN_PIXELS_PER_SECOND);
    expect(fitZoom(1, 1e6)).toBe(MAX_PIXELS_PER_SECOND);
  });
});

describe('timeScale · 吸附（容差以像素给）', () => {
  it('容差内取最近候选，容差外原样返回', () => {
    expect(snapTime(1.0, [1.5], 10, 8)).toBe(1.5); // tolSec = 0.8
    expect(snapTime(1.0, [1.5], 100, 8)).toBe(1.0); // tolSec = 0.08 → 不吸
  });

  it('同一秒数差在放大后不再吸附（这正是容差必须按像素的原因）', () => {
    const candidates = [1.2];
    expect(snapTime(1.0, candidates, 8, 8)).toBe(1.2); // 缩小：0.2s 才 1.6px → 吸
    expect(snapTime(1.0, candidates, 80, 8)).toBe(1.0); // 放大：0.2s = 16px → 不吸
  });

  it('tolPx = 0 表示关闭吸附；空候选原样返回', () => {
    expect(snapTime(1.0, [1.0], 50, 0)).toBe(1.0);
    expect(snapTime(1.0, [], 50, 8)).toBe(1.0);
  });

  it('并列距离时取先出现的候选（调用方可按重要性排列）', () => {
    expect(snapTime(1.0, [1.5, 0.5], 50, 100)).toBe(1.5);
  });
});

describe('timeScale · 落点序号 / 框选相交', () => {
  const spans = [
    { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 2 }, // 中点 1
    { id: 'b', timelineStart: 2, sourceStart: 0, sourceEnd: 2 }, // 中点 3
    { id: 'c', timelineStart: 4, sourceStart: 0, sourceEnd: 2 }, // 中点 5
  ];

  it('dropIndexAt：落点序号 = 中点落在 t 之前的片段数', () => {
    expect(dropIndexAt(spans, 0.5)).toBe(0); // 早于 a 的中点 1
    expect(dropIndexAt(spans, 2.5)).toBe(1); // 只越过 a 的中点
    expect(dropIndexAt(spans, 9)).toBe(3); // 越过全部
  });

  it('dropIndexAt：排除被拖动的片段（否则落点永远偏原位）', () => {
    // 不排除：a(中点1) 与 b(中点3) 都在 t 之前 → 2
    expect(dropIndexAt(spans, 3.5)).toBe(2);
    // 排除 a：只剩 b 在前 → 1（两者不同，正是排除参数的意义）
    expect(dropIndexAt(spans, 3.5, 'a')).toBe(1);
  });

  it('rectsIntersect：边缘恰好接触算相交', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectsIntersect(a, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true);
    expect(rectsIntersect(a, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true);
    expect(rectsIntersect(a, { left: 10.1, top: 0, right: 20, bottom: 10 })).toBe(false);
  });
});

describe('rulerTicks · 刻度', () => {
  it('pickTickStep：缩放越大步长越小；无缩放信息时退到最粗', () => {
    expect(pickTickStep(240)).toBe(1);
    expect(pickTickStep(36)).toBe(5);
    expect(pickTickStep(4)).toBe(30);
    expect(pickTickStep(0)).toBe(3600);
  });

  it('formatTickLabel：m:ss 与 h:mm:ss；步长 < 1s 才带小数', () => {
    expect(formatTickLabel(65, 5)).toBe('1:05');
    expect(formatTickLabel(3661, 5)).toBe('1:01:01');
    expect(formatTickLabel(0.5, 0.5)).toBe('0:00.5');
  });

  it('buildTicks：从 0 起、间隔为 step，末尾必含 duration', () => {
    expect(buildTicks(4, 2).map((t) => t.time)).toEqual([0, 2, 4]);
    expect(buildTicks(7.3, 2).map((t) => t.time)).toEqual([0, 2, 4, 6, 7.3]);
    expect(buildTicks(0, 2)).toEqual([]);
    expect(buildTicks(10, 0)).toEqual([]);
  });
});

describe('宿主绑定：VideoProcessNode 必须用共用原语，不许再内联换算', () => {
  const src = readFileSync('src/components/nodes/VideoProcessNode.tsx', 'utf8');

  it('时间↔像素换算全部经共用原语', () => {
    expect(src).toContain('timeToX(');
    expect(src).toContain('xToTime(');
    expect(src).toContain('timeDeltaToPx(');
    expect(src).toContain('pxDeltaToTime(');
    expect(src).toContain('snapTime(');
  });

  it('不再出现内联的 * PX_PER_SEC / / PX_PER_SEC 换算', () => {
    expect(src).not.toMatch(/\*\s*PX_PER_SEC/);
    expect(src).not.toMatch(/\/\s*PX_PER_SEC/);
  });
});
