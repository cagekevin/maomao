/**
 * `useInlineNameEditing` —— 「新建文件夹 / 重命名」内联输入条的**唯一实现**（TD-04-56 收口）。
 *
 * 【为什么必须给它自己的测试】收口前这套逻辑在 `GeneratedView` 与 `ResourceLibrary` 各存一份，
 * **两处都没有测试**；收口后它是两处共用的唯一真源 ⇒ 它错了就是两个面板一起错。
 *
 * 本组覆盖两件事：
 * ① **行为等价**：未连引擎守卫 / 默认名 / 失焦仅在改名时建 / 重命名就地改列表；
 * ② **props 引用稳定**：喂给 `memo(InlineNameInput)` 的回调在 state 不变时必须跨渲染同一引用
 *    （收口前它们是 JSX 内联箭头 ⇒ memo 恒失效，这是 TD-04-53 的遗留半笔）。
 *    反证（探针）：把 hook 内任一回调改回内联箭头 ⇒ 第 ② 组断言红。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  createFolder: vi.fn(async () => ({})),
  renameResource: vi.fn(async () => ({ data: { id: 'n2', url: 'u2', name: 'new' } })),
  textCacheDelete: vi.fn(),
  toasts: [] as string[],
}));

// 属「会长大」类模块（Api / store）⇒ 必须从真模块派生（TD-17-15，判据见 mockPartialSpread.test.ts）
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createFolder: h.createFolder,
}));
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  renameResource: h.renameResource,
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: (msg: string) => h.toasts.push(msg),
}));
vi.mock('../../src/hooks/useAssetDragToCanvas', () => ({
  textCache: { delete: h.textCacheDelete },
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import InlineNameInput from '../../src/components/base/ui/form/InlineNameInput.tsx';
import {
  useInlineNameEditing,
  DEFAULT_NEW_FOLDER_NAME,
} from '../../src/hooks/useInlineNameEditing.tsx';
import type { ResourceItem } from '../../src/components/base/api/localToolApi.ts';

/** 从 `renderInputs()` 的产物里取出喂给 `InlineNameInput` 的 props（不真渲染 ⇒ 快且无副作用） */
function inputProps(node: ReactNode): Record<string, unknown> | null {
  const kids = (node as { props?: { children?: unknown } })?.props?.children;
  const arr = Array.isArray(kids) ? kids : [kids];
  const el = arr.find((c) => isValidElement(c) && c.type === InlineNameInput);
  return el ? (el as { props: Record<string, unknown> }).props : null;
}

const ITEM = { id: 'n1', url: 'u1', name: '旧名' } as unknown as ResourceItem;

/** 基准入参：已连引擎 + 固定路径表达式（与两个消费方的真实用法同形） */
function base(overrides: Record<string, unknown> = {}) {
  return {
    connected: true,
    createFolderPath: (name: string) => `tasks/${name}`,
    refresh: vi.fn(),
    setItems: vi.fn(),
    logTag: '测试域',
    ...overrides,
  } as Parameters<typeof useInlineNameEditing>[0];
}

/**
 * **引用稳定**的入参 —— 专供「props 引用稳定」那组用。
 * ⚠️ 不能复用 `base()`：它写在 `renderHook` 回调里 ⇒ 每次渲染都新建 `createFolderPath`/`refresh`/`setItems`，
 * 那样 `createFolder` 必然每次换引用、断言**假红**。真实调用方这三个都是
 * `useCallback` / setter（见 hook JSDoc 的显式要求）⇒ 本常量才是 App 侧的忠实镜像。
 */
const STABLE_PARAMS = {
  connected: true,
  createFolderPath: (name: string) => `tasks/${name}`,
  refresh: vi.fn(),
  setItems: vi.fn(),
  logTag: '测试域',
} as Parameters<typeof useInlineNameEditing>[0];

beforeEach(() => {
  vi.clearAllMocks();
  h.toasts.length = 0;
});

describe('useInlineNameEditing · 行为等价', () => {
  it('未连引擎 → openCreate 只提示，不开输入条', () => {
    const { result } = renderHook(() => useInlineNameEditing(base({ connected: false })));
    act(() => result.current.openCreate());
    expect(h.toasts).toContain('请先连接本地引擎');
    expect(inputProps(result.current.renderInputs()), '未连引擎不应开输入条').toBeNull();
  });

  it('已连引擎 → openCreate 开输入条且初值为默认名', () => {
    const { result } = renderHook(() => useInlineNameEditing(base()));
    act(() => result.current.openCreate());
    expect(inputProps(result.current.renderInputs())?.value).toBe(DEFAULT_NEW_FOLDER_NAME);
  });

  it('失焦提交：仍是默认名 ⇒ **不**建目录；已改名 ⇒ 建', async () => {
    const createFolderPath = vi.fn((name: string) => `tasks/${name}`);
    const { result } = renderHook(() => useInlineNameEditing(base({ createFolderPath })));

    act(() => result.current.openCreate());
    await act(async () => {
      await (inputProps(result.current.renderInputs())?.onBlurCommit as () => Promise<void>)();
    });
    expect(h.createFolder, '默认名失焦不应建目录').not.toHaveBeenCalled();

    act(() => result.current.openCreate());
    act(() =>
      (inputProps(result.current.renderInputs())?.onChange as (v: string) => void)('新目录'),
    );
    await act(async () => {
      await (inputProps(result.current.renderInputs())?.onBlurCommit as () => Promise<void>)();
    });
    expect(createFolderPath).toHaveBeenCalledWith('新目录');
  });

  it('重命名提交 → 调 renameResource 并**就地**改本地列表（不整表重拉）', async () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useInlineNameEditing(base({ setItems })));
    act(() => result.current.openRename(ITEM));
    act(() => (inputProps(result.current.renderInputs())?.onChange as (v: string) => void)('新名'));
    await act(async () => {
      await (inputProps(result.current.renderInputs())?.onCommit as () => Promise<void>)();
    });
    expect(h.renameResource).toHaveBeenCalledWith('n1', '新名');
    expect(setItems, '应就地改列表').toHaveBeenCalled();
    expect(inputProps(result.current.renderInputs()), '提交后输入条应关闭').toBeNull();
  });
});

describe('useInlineNameEditing · props 引用稳定（memo(InlineNameInput) 可命中）', () => {
  it('state 不变时，喂给 InlineNameInput 的每个 prop 都是同一引用', () => {
    const { result, rerender } = renderHook(() => useInlineNameEditing(STABLE_PARAMS));
    act(() => result.current.openCreate());

    const first = inputProps(result.current.renderInputs());
    expect(first, '应渲染出新建文件夹输入条').not.toBeNull();

    rerender();
    const second = inputProps(result.current.renderInputs());
    for (const key of ['value', 'onChange', 'onCommit', 'onBlurCommit', 'onCancel']) {
      expect(second?.[key], `${key} 引用变了 ⇒ memo(InlineNameInput) 恒失效`).toBe(first?.[key]);
    }

    rerender();
    const third = inputProps(result.current.renderInputs());
    expect(third?.onCommit, '第 3 次渲染后 onCommit 引用变了').toBe(first?.onCommit);
    expect(third?.onCancel, '第 3 次渲染后 onCancel 引用变了').toBe(first?.onCancel);
  });
});
