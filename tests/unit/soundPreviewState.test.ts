/**
 * 音效试听的状态判据（2026-11-07 从 veSoundPreview.test.tsx 迁来）。
 *
 * 原锁法：renderHook + jsdom + 假 Audio 类，断言 pause 次数与 playingId 变化。
 * 现改锁纯函数（AGENTS.md §2.3）——「点同条停 / 点别的换 / 迟到的 ended 不清新歌」是判据，
 * 「Audio 被 pause 了几次」是副作用，由 hook 的 cleanup 承担（那条无法纯函数化，已在代码注释写明）。
 */
import { describe, it, expect } from 'vitest';
import {
  decidePreviewToggle,
  shouldSettlePreview,
} from '@/components/videoEditor/lib/soundPreviewState.ts';

describe('decidePreviewToggle —— 点同条停、点别的换', () => {
  it('点正在播的那条 → 停止（即使它没有 previewUrl 也该停掉当前播放）', () => {
    expect(decidePreviewToggle(7, { id: 7, previewUrl: 'https://a/7.mp3' })).toEqual({
      kind: 'stop',
    });
    expect(decidePreviewToggle(7, { id: 7 })).toEqual({ kind: 'stop' });
  });

  it('点另一条且它有 url → 换歌', () => {
    expect(decidePreviewToggle(7, { id: 9, previewUrl: 'https://a/9.mp3' })).toEqual({
      kind: 'play',
      id: 9,
    });
  });

  it('点另一条但没有 url → idle（先把上一条停掉，不建新 audio）', () => {
    expect(decidePreviewToggle(7, { id: 9 })).toEqual({ kind: 'idle' });
    expect(decidePreviewToggle(null, { id: 9, previewUrl: '' })).toEqual({ kind: 'idle' });
  });
});

describe('shouldSettlePreview —— 迟到的 ended 不得清新歌（按 id 判等）', () => {
  it('回调来自当前在播的那条 → 该清理', () => {
    expect(shouldSettlePreview(9, 9)).toBe(true);
  });

  it('回调来自已经被换掉的旧条 → 不动状态', () => {
    expect(shouldSettlePreview(9, 7)).toBe(false);
  });

  it('当前没有在播（已被停掉）→ 旧条回调也不该复活/覆盖状态', () => {
    expect(shouldSettlePreview(null, 7)).toBe(false);
  });
});
