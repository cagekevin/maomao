import { useCallback } from 'react';
import { deleteResource } from '../base/api/localToolApi.ts';
import { openLocalFolder, openFileDir, relativePathFromUrl } from '../base/api/filesApi.ts';
import { showToast } from '../base/core/event/toastStore.ts';
import type { ResourceItem } from '../base/api/localToolApi.ts';

/**
 * 资源卡片三条动作（删除 / 打开本地目录 / 打开所在目录）的**唯一实现**（2026-11-06 收口）。
 *
 * 【为什么存在】三个 handler 此前在 `generate/GeneratedView` 与 `resource/ResourceLibrary`
 * 各抄一份：`handleDelete` 逐字相同，`handleOpenLocal` 只差路径表达式，`handleOpenFileDir`
 * 逐字相同 —— 与 `useInlineNameEditing`（TD-04-56）、`ResourceCardActions`（TD-04-57）、
 * `PagedFooter` 同一族的 SSOT 第二份，改一处必漏另一处。
 *
 * 【域差异开成参数（同 useInlineNameEditing 原则）】两面板唯一真差异是「打开本地目录时传哪个路径」：
 * 生成面板固定 `tasks` 目录、素材面板传当前目录 —— 归宿主，收上来即越权（PagedFooter 三铁律同源）。
 *
 * 【失败语义】删除失败 toast（乐观移除不回滚，与原两份实现一致）；打开失败 toast；
 * `relativePathFromUrl` 返回 null（解析不出相对路径）⇒ 打开所在目录直接 toast 失败。
 */
export function useResourceItemActions({
  connected,
  localFolder,
  setItems,
  setTotal,
}: {
  connected: boolean;
  /** 「打开本地存储目录」要打开的目录（生成面板 = 'tasks'，素材面板 = 当前目录）。 */
  localFolder: string;
  setItems: (updater: (list: ResourceItem[]) => ResourceItem[]) => void;
  setTotal: (updater: (t: number) => number) => void;
}) {
  const handleDelete = useCallback(
    async (item: ResourceItem) => {
      setItems((list) => list.filter((x) => x.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
      try {
        await deleteResource(item.id);
      } catch {
        showToast('删除失败', { type: 'error' });
      }
    },
    [setItems, setTotal],
  );

  const handleOpenLocal = useCallback(() => {
    if (!connected) {
      showToast('请先连接本地引擎', { type: 'warning' });
      return;
    }
    openLocalFolder(localFolder)
      .then((r) => showToast(`已在文件管理器中打开: ${r?.data?.path}`, { type: 'success' }))
      .catch(() => showToast('打开本地目录失败', { type: 'error' }));
  }, [connected, localFolder]);

  const handleOpenFileDir = useCallback((item: ResourceItem) => {
    const rel = relativePathFromUrl(item.url ?? '');
    if (!rel) {
      showToast('打开所在目录失败', { type: 'error' });
      return;
    }
    openFileDir(rel).catch(() => showToast('打开所在目录失败', { type: 'error' }));
  }, []);

  return { handleDelete, handleOpenLocal, handleOpenFileDir };
}
