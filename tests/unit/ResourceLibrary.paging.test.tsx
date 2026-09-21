// @vitest-environment jsdom
/**
 * ResourceLibrary（素材库 tab）翻页行为测试 —— 「最多 20 个、不会翻页」的修复锚点。
 *
 * 【被测能力】当后端说"还有更多页"时，用户**能到达下一页**。
 *
 * 【为什么这么断（不是断实现细节）】改前把"加载下一页"的唯一触发挂在容器 `onScroll` 上：
 * 第 1 页 20 条撑不满 330px 面板 ⇒ 无滚动条 ⇒ scroll 永不发生 ⇒ 加载永不触发（结构死锁），
 * 外在表现 = 永远 20 条、新素材把最旧那个挤出首页。故本测试走**真实调用路径**
 * （渲染面板 → 点底部「下一页」），断言两点：① 发出的请求页号 = 2；② 列表被**替换**为第 2 页。
 * 把 `goPage` 改成恒取第 1 页、或把触发改回 onScroll，① / ② 立刻红（探针见轮次文件）。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent, screen } from '@testing-library/react';

const h = vi.hoisted(() => {
  const buildAll = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r${i + 1}`,
      name: `素材${i + 1}`,
      url: `/files/migrated/a${i + 1}.png`,
      type: 'image',
      folder: 'migrated',
    }));
  const all = buildAll(45); // 45 条 ⇒ totalPages = 3
  const calls: Array<Record<string, unknown>> = [];
  return {
    all,
    calls,
    loggerWarn: vi.fn(),
    reset: (n: number) => {
      calls.length = 0;
      all.length = 0;
      all.push(...buildAll(n));
    },
  };
});

vi.mock('../../src/hooks/useLocalToolStatus.ts', () => ({
  useLocalToolStatus: () => ({ status: { isConnected: true } }),
}));

vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  fetchResources: vi.fn(async (params: Record<string, unknown> = {}) => {
    h.calls.push(params);
    const page = Number(params.page ?? 1);
    const pageSize = Number(params.pageSize ?? 20);
    const start = (page - 1) * pageSize;
    return {
      code: 0,
      data: {
        items: h.all.slice(start, start + pageSize),
        total: h.all.length,
        page,
        pageSize,
        totalPages: Math.ceil(h.all.length / pageSize),
      },
    };
  }),
  rescanResources: vi.fn(async () => ({ ok: true })),
  deleteResource: vi.fn(async () => ({})),
  renameResource: vi.fn(async () => ({})),
}));

vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: {
    warn: (...a: unknown[]) => h.loggerWarn(...a),
    debug: () => {},
    info: () => {},
    error: () => {},
  },
}));

vi.mock('../../src/components/base/panels/PanelBar.tsx', () => ({
  PanelSubBar: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
  PanelPills: () => React.createElement('div'),
  PanelMoreMenu: () => React.createElement('div'),
}));

vi.mock('../../src/hooks/useAssetDragToCanvas.ts', () => ({
  useResourceCardDragProps: () => ({ cardDragProps: () => ({}), assetDragProps: {} }),
  useTextAsset: () => ({ phase: 'ok', text: '' }),
  toImgDragProps: () => ({}),
  fetchText: vi.fn(async () => ''),
  textCache: new Map(),
}));

vi.mock('../../src/components/base/ui/display/LazyImage.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/display/ImageZoomDialog.tsx', () => ({
  default: () => null,
}));

vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  openLocalFolder: vi.fn(async () => ({})),
  openFileDir: vi.fn(async () => ({})),
  relativePathFromUrl: () => '',
  uploadFileToLocal: vi.fn(async () => ({ ok: true })),
}));

import ResourceLibrary from '../../src/components/resource/ResourceLibrary.tsx';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  h.reset(45);
});

describe('ResourceLibrary（素材库 tab）— 翻页', () => {
  it('还有更多页时，点「下一页」→ 请求第 2 页，且列表被替换为第 2 页', async () => {
    render(<ResourceLibrary />);

    // 首屏：请求第 1 页（20 条），第 21 条不在当前页
    await screen.findByText('素材1');
    expect(h.calls[0].page).toBe(1);
    expect(screen.queryByText('素材21')).toBeNull();

    fireEvent.click(screen.getByText('下一页'));

    await waitFor(() => {
      expect(h.calls.some((c) => c.page === 2)).toBe(true);
    });
    // 替换而非追加：第 2 页首条出现、第 1 页首条消失
    expect(await screen.findByText('素材21')).toBeTruthy();
    expect(screen.queryByText('素材1')).toBeNull();
  });

  it('只有一页时不渲染翻页按钮（与生成面板同款）', async () => {
    h.reset(1);
    render(<ResourceLibrary />);

    await screen.findByText('素材1');
    expect(screen.queryByText('下一页')).toBeNull();
    expect(screen.queryByText('上一页')).toBeNull();
  });
});
