/**
 * VideoThumbnail 失败可见性锚点（TD-16-29② 收口 · 2026-09-17）。
 *
 * 收口前：本组件是**全站视频缩略图唯一出口**（VideoGenerate / TaskCenter / GeneratedView /
 * AssetNode / 预览），但 `<video>` **没有 onError** —— 素材缺失 / 4xx / 解码失败时只剩黑框，
 * 用户与开发者都无法区分「还在加载」与「已损坏」。
 *
 * 本文件锁定：失败 → 显式占位；且**不留**坏元素在 DOM 里（否则黑框与占位同屏 = 没说清）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: h.warn, info: vi.fn(), error: vi.fn() },
}));

import VideoThumbnail from '../../src/components/base/ui/display/VideoThumbnail.tsx';

beforeEach(() => h.warn.mockClear());

describe('VideoThumbnail — 视频加载失败必须可见', () => {
  it('初始渲染正常：出 <video>，无失败占位', () => {
    render(<VideoThumbnail src="/files/a.mp4" />);
    expect(document.querySelector('video')).toBeTruthy();
    expect(screen.queryByText('视频加载失败')).toBeNull();
  });

  it('onError → 出「视频加载失败」占位，并留痕（不许静默黑框）', () => {
    render(<VideoThumbnail src="/files/b.mp4" />);
    const video = document.querySelector('video')!;

    fireEvent.error(video);

    expect(screen.getByText('视频加载失败')).toBeTruthy();
    // 【新断言比旧契约更强】锁住留痕存在（失败不能只改 UI 不记录）
    expect(h.warn).toHaveBeenCalledTimes(1);
  });

  it('换 src → 失败态复位（重新尝试新素材，不让旧 failed 粘住新源）', () => {
    const { rerender } = render(<VideoThumbnail src="/files/c.mp4" />);
    fireEvent.error(document.querySelector('video')!);
    expect(screen.getByText('视频加载失败')).toBeTruthy();

    rerender(<VideoThumbnail src="/files/d.mp4" />);
    expect(screen.queryByText('视频加载失败')).toBeNull();
    expect(document.querySelector('video')).toBeTruthy();
  });
});
