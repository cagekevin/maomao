import { describe, it, expect } from 'vitest';
import {
  sourceTimeAt,
  timelineTimeAt,
} from '../../src/components/base/utils/timeline/sourceTime.ts';

// 卡 8（docs/126）：源媒体时间 ↔ 时间轴时间 的共用原语。
// 原实现在 nodes/VideoProcessNode.tsx 内联 3 遍（:1356/:1370 正算、:1552 反算），
// 本测试锁住"正算/反算互为反函数"与"缺省字段=0"两条契约。

const CLIP = { timelineStart: 10, sourceStart: 2 };

describe('sourceTimeAt：时间轴时间 → 源媒体时间', () => {
  it('正算：片段源起点 + 时间轴上的偏移', () => {
    expect(sourceTimeAt(13, CLIP)).toBe(5);
    expect(sourceTimeAt(10, CLIP)).toBe(2);
  });

  it('缺省字段视为 0（与既有内联 ?? 0 兜底一致）', () => {
    expect(sourceTimeAt(7, {})).toBe(7);
    expect(sourceTimeAt(7, { timelineStart: 3 })).toBe(4);
  });
});

describe('timelineTimeAt：源媒体时间 → 时间轴时间', () => {
  it('反算：片段时间轴起点 + 源媒体上的偏移', () => {
    expect(timelineTimeAt(5, CLIP)).toBe(13);
    expect(timelineTimeAt(2, CLIP)).toBe(10);
  });

  it('往返一致（浮点容差内）', () => {
    for (const t of [0, 3.25, 13, 999.5]) {
      expect(timelineTimeAt(sourceTimeAt(t, CLIP), CLIP)).toBeCloseTo(t, 10);
    }
  });

  it('不夹取——夹取属调用方判据（宿主先 Math.max 再传入）', () => {
    // 源时间早于片段源起点：原语原样外推
    expect(timelineTimeAt(0, CLIP)).toBe(8);
    // 宿主夹取写法（等价原内联 `timelineStart + Math.max(0, cur - sourceStart)`）
    const cur = 0;
    expect(timelineTimeAt(Math.max(CLIP.sourceStart, cur), CLIP)).toBe(10);
  });
});
