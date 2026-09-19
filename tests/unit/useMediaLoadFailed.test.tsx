/**
 * 「媒体加载失败可见化」唯一原语 —— 行为锚点（TD-16-29② 收口 · 2026-09-17）。
 *
 * 收口前：`<img>` / `<video>` / `<audio>` 在预览播放器 / VideoThumbnail / 时间轴贴纸处
 * **各写一份或干脆没写** onError ⇒ 失败只剩黑框 / 裂图 / 静音控件，
 * 用户与开发者都**无法区分**「还没加载」与「已损坏」。
 *
 * 本文件锁定 3 条最容易回归的语义：
 *  - 失败置位 + 留痕（`logger.warn`）—— 不许静默；
 *  - `failed` 粘住（媒体不会自愈）；
 *  - `resetKey` 变化 → 复位（换素材必须重新尝试，否则旧 failed 粘住新素材）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// logger.warn 必须被调用（"只置位不留痕" = 把不可诊断的问题留给后人）
const h = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: h.warn, info: vi.fn(), error: vi.fn() },
}));

import { useMediaLoadFailed } from '../../src/components/base/utils/media/useMediaLoadFailed.ts';

beforeEach(() => {
  h.warn.mockClear();
});

describe('useMediaLoadFailed — 失败必须可见（置位 + 留痕）', () => {
  it('初始不失败；onError → failed=true 且 logger.warn 被调用（不许静默）', () => {
    const { result } = renderHook(() => useMediaLoadFailed('http://x/a.mp4', '视频缩略图'));
    expect(result.current.failed).toBe(false);
    expect(h.warn).not.toHaveBeenCalled();

    act(() => result.current.onError());

    expect(result.current.failed).toBe(true);
    // 【新断言比旧契约更强】锁住「留痕存在」——失败不能只改状态不记录
    expect(h.warn).toHaveBeenCalledTimes(1);
  });

  it('留痕带 label 与 detail（可归因到具体素材）', () => {
    const { result } = renderHook(() =>
      useMediaLoadFailed('http://x/b.mp4', '预览素材', { id: 'asset-1', type: 'video' }),
    );
    act(() => result.current.onError());

    const [category, message, detail] = h.warn.mock.calls[0];
    expect(category).toBe('媒体');
    expect(message).toContain('预览素材');
    expect(detail).toEqual({ id: 'asset-1', type: 'video' });
  });

  it('failed 粘住：连续 onError 不会自己复位（媒体元素不会自愈）', () => {
    const { result } = renderHook(() => useMediaLoadFailed('http://x/c.mp4', '视频缩略图'));
    act(() => result.current.onError());
    act(() => result.current.onError());
    expect(result.current.failed).toBe(true);
  });

  it('resetKey 变化 → 复位（换素材后必须重新尝试，否则旧 failed 粘住新素材）', () => {
    const { result, rerender } = renderHook(
      ({ key: k }: { key: string }) => useMediaLoadFailed(k, '视频缩略图'),
      { initialProps: { key: 'http://x/d.mp4' } },
    );

    act(() => result.current.onError());
    expect(result.current.failed).toBe(true);

    // 同一素材重渲染 → 不复位（否则每次渲染都重试失败图，白跑请求）
    rerender({ key: 'http://x/d.mp4' });
    expect(result.current.failed).toBe(true);

    // 换素材 → 复位
    rerender({ key: 'http://x/e.mp4' });
    expect(result.current.failed).toBe(false);
  });
});
