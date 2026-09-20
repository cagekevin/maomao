import { useCallback, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import InlineNameInput from '@/components/base/ui/form/InlineNameInput.tsx';
import { createFolder as createFolderApi } from '@/components/base/api/filesApi.ts';
import { renameResource } from '@/components/base/api/localToolApi.ts';
import type { ResourceItem } from '@/components/base/api/localToolApi.ts';
import { textCache } from '@/hooks/useAssetDragToCanvas';
import { showToast } from '@/components/base/core/event/toastStore.ts';
import { logger } from '@/components/base/core/log/logger.ts';

/** 新建文件夹的默认名。「失焦仅在改了名时静默建」这条判据要用到它 ⇒ 导出供断言/复用。 */
export const DEFAULT_NEW_FOLDER_NAME = '新建文件夹';

interface UseInlineNameEditingOptions {
  /** 是否已连本地引擎（未连则「新建文件夹」入口只提示、不开输入条） */
  connected: boolean;
  /**
   * 建文件夹的**落盘路径**怎么算。
   * 【为什么必须由调用方给】这是本机制**唯一**的域差异：`GeneratedView` 在 `tasks` 域下走
   * `tasks/<name>`，其余走 `<folder>/<name>`；`ResourceLibrary` 恒走 `<currentFolder>/<name>`。
   * ⚠️ 调用方请用 `useCallback` 包住（依赖当前目录）——否则本 hook 的 `createFolder` 会每渲染换引用，
   * 进而让 `memo(InlineNameInput)` 失效（**只稳一个 prop 是白做**）。
   */
  createFolderPath: (name: string) => string;
  /** 建/改成功后的刷新（各面板自己的列表重载，通常是 `reset(true)`）。同样请用 `useCallback`。 */
  refresh: () => void;
  /** 重命名成功后**就地**改本地列表（避免整表重拉）；直接传面板自己的 `setItems` */
  setItems: Dispatch<SetStateAction<ResourceItem[]>>;
  /** 日志域标签（`'生成视图'` / `'素材库'`）—— 日志按域区分，故属调用方知识 */
  logTag: string;
}

interface UseInlineNameEditingResult {
  /** 打开「新建文件夹」输入条（未连引擎时只提示） */
  openCreate: () => void;
  /** 打开「重命名」输入条 */
  openRename: (item: ResourceItem) => void;
  /** 渲染两条输入条（两者在调用点相邻，故合并为一个出口） */
  renderInputs: () => ReactNode;
}

/**
 * 「新建文件夹 / 重命名」内联输入条的**统一机制**（TD-04-56 收口）。
 *
 * 【为什么收口】`GeneratedView` 与 `ResourceLibrary` 各自**逐字复制**了同一套 ——
 * 4 个 state 声明 + 「新建文件夹」菜单项的 `connected` 守卫与初值 + `createFolder`（约 13 行）
 * + `handleRename`（约 22 行）+ 两段 36 行的 `InlineNameInput` 调用块（`diff` 实测零差异），
 * 合计约 **85 行**；两处唯一的真差异只有「建文件夹的路径怎么算」与「日志域标签」。
 * 抽为唯一实现后，改一处即两处生效（此前是"改一处忘一处"的典型 SSOT 第二份）。
 *
 * 【顺带解掉 memo 击穿（TD-04-53 的遗留半笔）】此前那两段调用块里的 `onCommit` / `onBlurCommit` /
 * `onCancel` 是 **JSX 内联箭头** ⇒ 每次渲染新建引用 ⇒ `memo(InlineNameInput)` 恒失效。
 * 本 hook 内的回调一律 `useCallback` ⇒ 面板因**无关原因**重渲（如列表刷新）时 `value` 与各回调
 * 引用都不变 ⇒ memo 命中。（打字期间 `value` 变 ⇒ 必然重渲，这是受控输入的固有行为，与 memo 无关。）
 *
 * 【为什么不把 `createFolder` / `handleRename` 留给调用方】那样收口就只剩"抽了段 JSX"——
 * 两条最容易漂移的业务判据（建目录的路径语义、重命名后如何就地改列表）仍各存两份。
 * 本 hook 只把**真正的域差异**（路径表达式、日志标签、列表刷新方式）开成参数。
 */
export function useInlineNameEditing({
  connected,
  createFolderPath,
  refresh,
  setItems,
  logTag,
}: UseInlineNameEditingOptions): UseInlineNameEditingResult {
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<ResourceItem | null>(null);
  const [renameName, setRenameName] = useState('');

  // 打开「新建文件夹」：未连引擎时只提示、不开输入条（原两处各自内联这段守卫）
  const openCreate = useCallback(() => {
    if (!connected) {
      showToast('请先连接本地引擎', { type: 'warning' });
      return;
    }
    setNewFolderName(DEFAULT_NEW_FOLDER_NAME);
    setCreating(true);
  }, [connected]);

  const openRename = useCallback((item: ResourceItem) => {
    setRenameTarget(item);
    setRenameName(item.name ?? '');
  }, []);

  const cancelCreate = useCallback(() => setCreating(false), []);

  // 新建文件夹（对齐官方 S.createFolder → POST /api/files/mkdir）
  const createFolder = useCallback(
    async (name: string): Promise<boolean> => {
      if (!name || !connected) return false;
      try {
        await createFolderApi(createFolderPath(name));
        refresh();
        return true;
      } catch (e) {
        // 建文件夹失败 → 返回 false 由 UI 呈现（**调用方可见**，非静默）；另留痕给开发者（2026-09-17）。
        logger.debug(logTag, '建文件夹失败（已由返回值呈现）', e);
        return false;
      }
    },
    [connected, createFolderPath, refresh, logTag],
  );

  // 回车：无条件建（含默认名）+ toast —— 与旧的 Enter 语义一致
  const commitCreate = useCallback(async () => {
    const ok = await createFolder(newFolderName.trim());
    showToast(ok ? '创建成功' : '创建失败', { type: ok ? 'success' : 'error' });
    setCreating(false);
  }, [createFolder, newFolderName]);

  // 失焦：仅在改了名时静默建 —— 与旧的 onBlur 语义一致
  const blurCommitCreate = useCallback(async () => {
    const name = newFolderName.trim();
    if (name && name !== DEFAULT_NEW_FOLDER_NAME) await createFolder(name);
    setCreating(false);
  }, [createFolder, newFolderName]);

  // 重命名资源
  const commitRename = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      setRenameTarget(null);
      return;
    }
    try {
      const res = await renameResource(renameTarget.id, name);
      // 更新本地列表（id/url/name 已变）
      const d = res?.data;
      if (d)
        setItems((list) =>
          list.map((x) =>
            x.id === renameTarget.id ? { ...x, id: d.id, url: d.url, name: d.name } : x,
          ),
        );
      textCache.delete(renameTarget.url ?? '');
      showToast('重命名成功', { type: 'success' });
    } catch (e) {
      showToast((e as { message?: string })?.message || '重命名失败', { type: 'error' });
    }
    setRenameTarget(null);
    setRenameName('');
  }, [renameTarget, renameName, setItems]);

  const cancelRename = useCallback(() => {
    setRenameTarget(null);
    setRenameName('');
  }, []);

  const renderInputs = (): ReactNode => (
    <>
      {/* 新建文件夹输入卡片（TD-19-3：走唯一实现 InlineNameInput） */}
      {creating && (
        <InlineNameInput
          tone="orange"
          value={newFolderName}
          onChange={setNewFolderName}
          onCommit={commitCreate}
          onBlurCommit={blurCommitCreate}
          onCancel={cancelCreate}
        />
      )}

      {/* 重命名输入条（TD-19-3：走唯一实现 InlineNameInput） */}
      {renameTarget && (
        <InlineNameInput
          value={renameName}
          onChange={setRenameName}
          onCommit={commitRename}
          onCancel={cancelRename}
          placeholder="输入新文件名"
          onFocusSelectBody
        />
      )}
    </>
  );

  return { openCreate, openRename, renderInputs };
}
