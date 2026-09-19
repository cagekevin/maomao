import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  pxDeltaToTime,
  snapTime,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../src/components/base/utils/timeline/timeScale.ts';

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

describe('宿主绑定：VideoProcessNode 必须用共用原语，不许再内联换算', () => {
  const src = readFileSync('src/components/canvas/nodes/VideoProcessNode.tsx', 'utf8');

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
