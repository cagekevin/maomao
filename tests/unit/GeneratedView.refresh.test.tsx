// @vitest-environment jsdom
/**
 * GeneratedView（「生成」tab）行为测试 —— TD-12-10 同母体：
 * **「结果就绪」信号必须被当前可见的消费方收到**。
 *
 * 场景：生成任务的产物由 runGenerationContract 落盘到 tasks 目录，随后 taskCompletionBus
 * 广播 `agent:task-completed`。但本面板是条件渲染且只在自己挂载/切目录时拉取 →
 * 用户停在「生成」tab 时看不到刚生成的结果（与素材库面板「点了却看不到」同族）。
 *
 * 本文件用**真实 eventBus**（只 mock 数据源）打通「广播 → 重拉」：改前本面板零订阅 → 先红。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  fetchResources: vi.fn(async (..._a: unknown[]) => ({
    data: { items: [], total: 0, page: 1, totalPages: 1 },
  })),
  rescanResources: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  deleteResource: vi.fn(async (..._a: unknown[]) => ({})),
  renameResource: vi.fn(async (..._a: unknown[]) => ({})),
  showToast: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../src/hooks/useLocalToolStatus.ts', () => ({
  useLocalToolStatus: () => ({ status: { isConnected: true } }),
}));
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  fetchResources: (...a: unknown[]) => h.fetchResources(...a),
  rescanResources: (...a: unknown[]) => h.rescanResources(...a),
  deleteResource: (...a: unknown[]) => h.deleteResource(...a),
  renameResource: (...a: unknown[]) => h.renameResource(...a),
}));
vi.mock('../../src/components/base/core/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: (...a: unknown[]) => h.showToast(...a),
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: {
    warn: (...a: unknown[]) => h.loggerWarn(...a),
    debug: () => {},
    info: () => {},
    error: () => {},
  },
}));
vi.mock('../../src/hooks/useAssetDragToCanvas.ts', () => ({
  useResourceCardDragProps: () => ({}),
  toImgDragProps: () => ({}),
  fetchText: vi.fn(async () => ''),
  textCache: new Map(),
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: (u: string) => u,
  openLocalFolder: vi.fn(async () => ({})),
  openFileDir: vi.fn(async () => ({})),
  relativePathFromUrl: () => '',
  createFolder: vi.fn(async () => ({})),
}));
vi.mock('../../src/components/base/panels/PanelBar.tsx', () => ({
  PanelSubBar: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
  PanelPills: () => React.createElement('div'),
  PanelMoreMenu: () => React.createElement('div'),
}));
vi.mock('../../src/components/base/ui/VideoThumbnail.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/LazyImage.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/editors/ImageZoomDialog.tsx', () => ({ default: () => null }));

import GeneratedView from '../../src/components/base/panels/GeneratedView.tsx';
import { publish } from '../../src/components/base/core/eventBus.ts';

const completed = (id: string) => ({
  taskId: id,
  nodeId: `n-${id}`,
  resultUrl: `/files/tasks/${id}.png`,
  type: 'image',
  status: 'completed',
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('GeneratedView（生成 tab）— 结果就绪刷新（TD-12-10 同母体）', () => {
  it('【先红锚点】收到 agent:task-completed → 重新拉取列表（生成结果落盘后自动可见）', async () => {
    render(<GeneratedView />);
    await waitFor(() => expect(h.fetchResources).toHaveBeenCalledTimes(1));

    publish('agent:task-completed', completed('t1'));

    // 改前：本面板零订阅（只在挂载/切目录拉取）→ 次数恒为 1（红）
    await waitFor(() => expect(h.fetchResources).toHaveBeenCalledTimes(2));
  });

  it('卸载后不再响应事件（订阅已随条件渲染清理，防泄漏/防不可见面板空拉）', async () => {
    const { unmount } = render(<GeneratedView />);
    await waitFor(() => expect(h.fetchResources).toHaveBeenCalledTimes(1));

    unmount();
    publish('agent:task-completed', completed('t2'));
    await Promise.resolve();

    expect(h.fetchResources).toHaveBeenCalledTimes(1);
  });
});
