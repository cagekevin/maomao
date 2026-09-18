// @vitest-environment jsdom
/**
 * ImportMediaModal（导入弹窗）—— **拉取方向铁律：意图 → 拉取，单向**（TD-03-20）。
 *
 * 【本文件钉住什么】拉取动作**只能由视图意图驱动**（来源 tab / 分类 / 下钻目录 / 项目）；
 * **拉取结果不得反推拉取动作**。
 *
 * 【改前的成环链（用户报「弹窗内文件夹/图片疯狂刷新直到卡死」）】
 *   `categories` ← `items`（派生自已拉到的数据）
 *     → `queryFor` → `navigate` → 切 tab 的 `useEffect`
 *       → `load()` → `setItems(新数组)` → 回到第一步……
 *   每一圈都发一次真实请求 ⇒ 无限自拉。故**「挂载/切 tab 只拉 1 次」就是本债的探针锚点**：
 *   把修复还原成旧实现，本文件必红（次数持续增长）。
 *
 * 【为什么断言"次数"而不是"界面好看"】症状（抖动/卡死）可以被各种兜底埋掉；
 * 「拉了几次」是这条不变式的**直接观测量**，埋不掉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  /** 数据源桩：**每次返回新数组**（真实 provider 也是如此 —— 这正是身份churn的来源）。 */
  queryMediaRefs: vi.fn(async (source: string, query: Record<string, unknown>) => {
    // 素材库根（精确 `migrated`）会返回一条**目录条目** —— 旧实现正是被这一步补齐的分类清单
    // 反推回拉取动作的；这里如实造出来，确保探针打的是真实触发路径。
    if (source === 'library' && query?.folderExact) {
      return [
        {
          ref: 'library:f1',
          source: 'library',
          name: '颜色',
          url: 'http://localhost/files/migrated/颜色',
          isFolder: true,
          folder: 'migrated',
        },
      ];
    }
    return [];
  }),
  loggerWarn: vi.fn(),
}));

/** 桩 provider 清单：**分类函数每次返回新对象/新数组**（与真实 provider 一致，勿缓存）。 */
const providers = [
  {
    source: 'generated' as const,
    label: '生成',
    order: 1,
    categories: () => [
      { key: 'all', label: '全部', query: {} },
      { key: 'image', label: '图片', query: { types: ['image'] } },
    ],
  },
  {
    source: 'library' as const,
    label: '素材库',
    order: 2,
    categories: (
      entries: readonly { isFolder?: boolean; name?: string; folder?: string }[] = [],
    ) => [
      { key: 'all', label: '全部', query: { folderExact: 'migrated' } },
      ...entries
        .filter((e) => e.isFolder)
        .map((e) => ({ key: `sub:${e.name}`, label: String(e.name), query: { folder: e.folder } })),
    ],
  },
  { source: 'canvas' as const, label: '画布', order: 3 },
];

vi.mock('../../src/components/base/media/index.ts', () => ({
  listMediaRefSources: () => providers,
  queryMediaRefs: (...a: unknown[]) =>
    h.queryMediaRefs(...(a as [string, Record<string, unknown>])),
}));
vi.mock('../../src/hooks/useLocalToolStatus.ts', () => ({
  useLocalToolStatus: () => ({ status: { isConnected: true } }),
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: {
    warn: (...a: unknown[]) => h.loggerWarn(...a),
    debug: () => {},
    info: () => {},
    error: () => {},
  },
}));
// ⚠️ 「会长大」类模块（toastStore）的 mock 必须走 importOriginal 派生真模块 ——
// 全量 mock 会被 `tests/unit/mockPartialSpread.test.ts`（TD-17-15）判红。
vi.mock('../../src/components/base/core/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('../../src/components/base/ui/LazyImage.tsx', () => ({ default: () => null }));
vi.mock('../../src/hooks/useResourceMoveToFolder.ts', () => ({
  folderPathOf: (card: { folder?: string; name?: string }) =>
    card.folder ? `${card.folder}/${card.name}` : String(card.name),
  useResourceMoveToFolder: () => ({
    sourceDragProps: () => ({}),
    folderDropProps: () => ({}),
  }),
}));

import ImportMediaModal from '../../src/components/base/panels/ImportMediaModal.tsx';

/**
 * 冲掉若干轮宏任务 —— 给「结果反推 effect」足够机会发作。
 * 旧实现下次数会持续增长；新实现下必须**纹丝不动**。
 */
async function settle(rounds = 4) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const renderModal = () => render(<ImportMediaModal onPick={() => ({ ok: true })} />);

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ImportMediaModal — 拉取只由意图驱动，结果不得反推（TD-03-20）', () => {
  it('【先红锚点】挂载后只拉取 1 次（结果到达不得再触发一次拉取）', async () => {
    renderModal();
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(1));

    await settle();

    // 改前：`setItems(新数组)` → categories 重建 → queryFor/navigate 身份变化 → 切 tab effect 重跑
    //       → 再 load → 再 setItems……次数持续增长（本断言必红，实测一路涨到超时）。
    expect(h.queryMediaRefs).toHaveBeenCalledTimes(1);
  });

  it('切到「素材库」tab 只拉 1 次；拉到目录条目（分类 pill 补齐）后不再自拉', async () => {
    const { getByRole } = renderModal();
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(1));

    await act(async () => {
      getByRole('tab', { name: '素材库' }).click();
    });
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(2));

    // 第 2 次拉到的目录条目会让分类清单补齐（多出「颜色」pill）—— 这正是旧实现的成环触发点。
    expect(h.queryMediaRefs.mock.calls[1][1]).toEqual({ folderExact: 'migrated' });

    await settle();
    expect(h.queryMediaRefs).toHaveBeenCalledTimes(2);
  });

  it('点分类 pill 只拉 1 次（分类的 query 随选中对象带过来，不回查派生自数据的清单）', async () => {
    const { getByRole, getByText } = renderModal();
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(1));

    await act(async () => {
      getByRole('tab', { name: '素材库' }).click();
    });
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(2));

    await act(async () => {
      getByText('全部').click();
    });
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(3));

    // 「全部」= 精确 migrated 根（provider 声明），不是"无分类的递归全量"。
    expect(h.queryMediaRefs.mock.calls[2][1]).toEqual({ folderExact: 'migrated' });

    await settle();
    expect(h.queryMediaRefs).toHaveBeenCalledTimes(3);
  });

  it('进入目录 = 前缀浏览，且分类 pill 一律不选中（分类与下钻互斥）', async () => {
    const { getByRole, getByTitle, container } = renderModal();
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(1));

    await act(async () => {
      getByRole('tab', { name: '素材库' }).click();
    });
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(2));

    await act(async () => {
      getByTitle(/进入「颜色」/).click();
    });
    await waitFor(() => expect(h.queryMediaRefs).toHaveBeenCalledTimes(3));

    // 子目录 = **前缀**（含更深子目录），与侧边栏素材库同一份规则（libraryBrowse 唯一实现）。
    expect(h.queryMediaRefs.mock.calls[2][1]).toEqual({ folder: 'migrated/颜色' });

    // 下钻态：分类与目录互斥 ⇒ 没有任何 pill 处于选中态（铁律见组件文件头）。
    const pressed = [...container.querySelectorAll('.pk-pill')].filter(
      (el) => el.getAttribute('aria-pressed') === 'true',
    );
    expect(pressed).toHaveLength(0);

    await settle();
    expect(h.queryMediaRefs).toHaveBeenCalledTimes(3);
  });
});
