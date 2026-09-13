import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import { needsCompositing } from '../../../src/components/videoEditor/core/routeClip.ts';
import type { Clip } from '../../../src/components/videoEditor/core/types.ts';

function withClip(extra: Record<string, unknown>) {
  const p = createEmptyProject();
  p.tracks[0].clips.push({
    id: 'a',
    kind: 'video',
    sourceStart: 0,
    sourceEnd: 2,
    timelineStart: 0,
    ...extra,
  } as Clip);
  return p;
}

describe('P-2 探针：未登记的 M2 加工字段是否被兜住', () => {
  it('★speed（M2 变速，原枚举未登记）→ 必须合成', () => {
    expect(needsCompositing(withClip({ speed: 2 }))).toBe(true);
  });

  it('★textStyle（M2 文字样式）→ 必须合成', () => {
    expect(needsCompositing(withClip({ textStyle: { size: 21 } }))).toBe(true);
  });

  it('★未来某未知字段 → 必须合成（保守方向）', () => {
    expect(needsCompositing(withClip({ someFutureFx: { a: 1 } }))).toBe(true);
  });

  it('放行字段 name / size=工程尺寸 不触发', () => {
    const base = createEmptyProject();
    const p = withClip({
      name: 'x',
      size: { width: base.settings.width, height: base.settings.height },
    });
    expect(needsCompositing(p)).toBe(false);
  });

  it('空数组 = 没设（volumePoints: []）→ 不触发', () => {
    expect(needsCompositing(withClip({ volumePoints: [] }))).toBe(false);
  });

  it('undefined 字段 → 不触发', () => {
    expect(needsCompositing(withClip({ transform: undefined }))).toBe(false);
  });
});
