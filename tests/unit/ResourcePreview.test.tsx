// @vitest-environment jsdom
/**
 * `ResourcePreviewOverlay` 行为测试（TD-01-22 收口，2026-09-18）。
 *
 * 素材库（ResourceLibrary）与生成（GeneratedView）两个面板**共用的唯一预览实现**：
 *   · text → TextPreview（读文件内容）；audio → 播放器卡片；其余（image）→ 可拖到画布的大图；
 *   · video → 委托统一原语 `ImageZoomDialog`（本组件不再自写播放器）。
 * 并锁住判据：视频/图片分流走 `assetType.isVideoResource`（与 `isAudio` 同族），
 * 禁止任何一侧再内联 `type === 'video' || startsWith('video')`。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import type { ResourceDragSourceProps } from '../../src/hooks/useResourceMoveToFolder.ts';
import type { ResourceItem } from '../../src/components/base/api/localToolApi.ts';

const h = vi.hoisted(() => ({ fetchText: vi.fn(async () => '文件内容 ABC') }));

vi.mock('../../src/hooks/useAssetDragToCanvas.ts', () => ({
  fetchText: h.fetchText,
  toImgDragProps: (p: unknown) => p,
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: (u: string | null | undefined) => u ?? '',
}));
vi.mock('../../src/components/base/editors/ImageZoomDialog.tsx', () => ({
  default: (p: { kind?: string; url?: string }) =>
    React.createElement('div', {
      'data-testid': 'zoom-dialog',
      'data-kind': p.kind,
      'data-url': p.url,
    }),
}));

import { ResourcePreviewOverlay } from '../../src/components/base/panels/ResourcePreview.tsx';
import { isVideoResource } from '../../src/components/base/utils/assetType.ts';

/** 拖到画布的 dragProps 工厂桩（真实实现由各面板的 useResourceCardDragProps 注入）。 */
const dragProps = (): ResourceDragSourceProps => ({ draggable: true, onDragStart: () => {} });

const item = (over: Partial<ResourceItem> = {}): ResourceItem => ({
  id: 'r1',
  name: '素材A',
  folder: 'tasks',
  type: 'image',
  url: '/files/a.png',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ResourcePreviewOverlay（素材预览唯一实现）', () => {
  it('item=null 时不渲染任何预览结构', () => {
    const { container } = render(
      <ResourcePreviewOverlay item={null} onClose={() => {}} assetDragProps={dragProps} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('text 素材 → 走 TextPreview 展示文件内容与名称', async () => {
    render(
      <ResourcePreviewOverlay
        item={item({ type: 'text', url: '/files/a.txt', name: '笔记' })}
        onClose={() => {}}
        assetDragProps={dragProps}
      />,
    );
    expect(screen.getByText('笔记')).toBeTruthy();
    expect(screen.queryByTestId('zoom-dialog')).toBeNull();
    await waitFor(() => expect(screen.getByText('文件内容 ABC')).toBeTruthy());
  });

  it('video 素材 → 委托 ImageZoomDialog（kind=video），不再自写播放器', () => {
    render(
      <ResourcePreviewOverlay
        item={item({ type: 'video', url: '/files/a.mp4' })}
        onClose={() => {}}
        assetDragProps={dragProps}
      />,
    );
    const dialog = screen.getByTestId('zoom-dialog');
    expect(dialog.getAttribute('data-kind')).toBe('video');
    expect(dialog.getAttribute('data-url')).toBe('/files/a.mp4');
  });

  it('image 素材 → 大图 + 关闭按钮可关闭（onClose 被调用）', () => {
    const onClose = vi.fn();
    render(
      <ResourcePreviewOverlay
        item={item({ type: 'image', url: '/files/a.png' })}
        onClose={onClose}
        assetDragProps={dragProps}
      />,
    );
    expect(screen.getByRole('img').getAttribute('src')).toBe('/files/a.png');
    expect(screen.queryByTestId('zoom-dialog')).toBeNull();
    fireEvent.click(screen.getByText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('assetType.isVideoResource（与 isAudio 同族的唯一判据）', () => {
  it('type 直判 / mime 前缀 / 扩展名兜底 均判真', () => {
    expect(isVideoResource('video', '')).toBe(true);
    expect(isVideoResource('video/mp4', '')).toBe(true);
    expect(isVideoResource(undefined, '/files/a.mp4')).toBe(true);
    expect(isVideoResource('other', 'a.webm?token=1')).toBe(true);
  });

  it('非视频（图片/音频/文本/目录）判假，不误伤', () => {
    expect(isVideoResource('image', '/files/a.png')).toBe(false);
    expect(isVideoResource('audio', '/files/a.mp3')).toBe(false);
    expect(isVideoResource('text', '/files/a.txt')).toBe(false);
    expect(isVideoResource('folder', '')).toBe(false);
    expect(isVideoResource(undefined, undefined)).toBe(false);
  });
});
