import { useState, useEffect, useCallback } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { rescanResources } from '../base/api/index.ts';
import { fetchAllResourcePages } from '../base/api/pagedList.ts';
import { toAbsoluteFileUrl } from '../base/utils/assetUrl.ts';
import type { ResourceItem } from '../base/api/localToolApi.ts';
import { mergeResourcesFromBackend } from '../base/store/resourceStore.ts';
import { useCurrentProjectId } from '../base/store/projectStore.ts';
import { useLocalToolStatus } from '../../hooks/useLocalToolStatus.ts';
import { logger } from '../base/core/logger.ts';
import ScriptBoxModal from './ScriptBoxModal.tsx';

/**
 * 剧本盒子 —— 「从素材库选择」图片选择器。
 * 按资产类别锁定素材库对应目录（人物/场景/道具），网格展示该目录下的图片，点选一张即回调 onPick(url)。
 * 复用后端 /api/resources 拉取（**取全量**，走 `api/pagedList` 的分页读取唯一实现），
 * 与素材库面板同源；只展示图片（type='image'）。
 *
 * @param props
 *  - folder  素材库目录（如 migrated/人物），决定打开时看哪个文件夹
 *  - onClose 关闭回调
 *  - onPick(url)  选中图片回调（把该图 URL 设为资产参考图）
 */
export default function ScriptBoxAssetPicker({
  folder,
  onClose,
  onPick,
}: {
  folder: string;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const { status } = useLocalToolStatus();
  const connected = status.isConnected;
  // 【TD-12-5 修复】与 ResourceLibrary 同口径传 projectId（此前缺参 → 剧本盒选图跨项目可见）
  const projectId = useCurrentProjectId();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // 目录变化 → 重新拉取该目录图片
  const load = useCallback(
    async (rescan = false) => {
      if (!connected) return;
      setLoading(true);
      setErr('');
      try {
        if (rescan) {
          await rescanResources();
        }
        // 【取全量（2026-09-17 收口）】本弹窗**没有分页/滚动加载入口**，只取第 1 页会让用户
        // 看不到也**选不到**后面的图（此前 60 条封顶，与导入弹窗的 100 条同族 = 静默不完整）。
        // 走分页读取的唯一实现（按 totalPages 取齐，不抄上限）。
        const list = await fetchAllResourcePages({ folder, type: 'image', projectId });
        setItems(list);
        mergeResourcesFromBackend(list);
      } catch (e) {
        // UI 红字已提示；再补 logger 便于排查本地引擎/后端问题
        const errMsg = (e as { message?: string }).message || String(e);
        logger.warn('scriptBox', '素材库加载失败', { folder, error: errMsg });
        setErr((e as { message?: string })?.message || '素材库加载失败');
      } finally {
        setLoading(false);
      }
    },
    [connected, folder, projectId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const folderLabel = (folder || '').split('/').pop() || '素材库';

  return (
    <ScriptBoxModal
      title={`从素材库选择 · ${folderLabel}`}
      onClose={onClose}
      width={640}
      height={480}
      bodyClass="p-3 flex flex-col min-h-0 flex-1"
    >
      {!connected ? (
        <div className="flex-1 flex items-center justify-center text-faint text-caption-sm">
          请先连接本地引擎
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-faint text-caption-sm">
          <Loader2 size={14} className="animate-spin mr-2" />
          加载中…
        </div>
      ) : err ? (
        <div className="flex-1 flex items-center justify-center text-red-400 text-caption-sm">
          {err}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-faint text-caption-sm gap-1">
          <ImageIcon size={20} className="opacity-40" />
          <span>「{folderLabel}」目录暂无图片素材</span>
          <span className="text-xs text-subtle">请先在素材库上传该类型的图片</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-4 gap-2">
            {items.map((a) => (
              <button
                key={a.id}
                type="button"
                className="group relative aspect-square rounded-lg overflow-hidden border border-edge-faint hover:border-emerald-400/60 cursor-pointer bg-surface-strong transition-colors"
                onClick={() => onPick?.(a.url ?? '')}
                title={a.name}
              >
                <img
                  src={toAbsoluteFileUrl(a.url)}
                  alt={a.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-gradient-to-t from-black/75 to-transparent text-meta text-white/85 truncate">
                  {a.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ScriptBoxModal>
  );
}
