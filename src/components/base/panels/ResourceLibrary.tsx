import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  FileText,
  Music,
  Play,
  Image as ImageIcon,
  FolderOpen,
  FolderPlus,
  ChevronLeft,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PanelSubBar, PanelPills, PanelMoreMenu } from './PanelBar.tsx';
import { useLocalToolStatus } from '../../../hooks/useLocalToolStatus.ts';
import { rescanResources, deleteResource, renameResource } from '../api/localToolApi.ts';
// 分页读取的唯一实现：此前本文件 `reset` 用 `items.length < total`、`loadMore` 用 `page < totalPages`
// **两套 hasMore 判据**（M3），现统一走 `hasMoreOf`。
import { fetchResourcePage, hasMoreOf } from '../api/pagedList.ts';
import { showToast } from '../core/toastStore.ts';
import {
  fetchText,
  textCache,
  useResourceCardDragProps,
} from '../../../hooks/useAssetDragToCanvas.ts';
import {
  toAbsoluteFileUrl,
  uploadFileToLocal,
  openLocalFolder,
  openFileDir,
  relativePathFromUrl,
  createFolder as createFolderApi,
} from '../api/filesApi.ts';
import {
  onResourceSent,
  emitResourceSent,
  mergeResourcesFromBackend,
  FOLDERS,
  LIBRARY_CATEGORY_KEYS,
} from '../store/resourceStore.ts';
// 目录浏览规则 + 素材库根：**与导入弹窗共用同一份**（唯一实现，见 libraryBrowse.ts）。
import { LIBRARY_ROOT, libraryBrowseArgs, libraryUpFolder } from '../media/libraryBrowse.ts';
// 目录条目 → 自身目录路径的唯一实现（与「点目录进入」「拖入归类」共用）。
import { folderPathOf } from '../../../hooks/useResourceMoveToFolder.ts';
import { useCurrentProjectId } from '../store/projectStore.ts';
import { logger } from '../core/logger.ts';
import { isAudio } from '../utils/assetType.ts';
import LazyImage from '../ui/LazyImage.tsx';
import InlineNameInput from '../ui/InlineNameInput.tsx';
import ImageZoomDialog from '../editors/ImageZoomDialog.tsx';
import type { ResourceItem } from '../api/localToolApi.ts';
import { toImgDragProps } from '../../../hooks/useAssetDragToCanvas.ts';

/**
 * 目录 pill —— **派生自 `resourceStore.FOLDERS`（唯一真源），不在此另写一份**。
 *
 * 【收口（2026-09-17）】此前本文件有一份硬编码 `FOLDER_PILLS`，与 `resourceStore.FOLDERS`
 * 是**同一件事的两份**（人物/场景/道具三项目的 label 与 folder 逐字相同）= M3 第二份。
 * 现只保留「面向用户素材」的 4 项（key 白名单），与 `base/media` 的 library provider
 * **同一判据**（tasks 由「生成」来源承载，不在此重复）。
 *
 * 更新(2026-09-17 收口)：白名单**不再在本文件定义**（此前与 library provider 各一份同名同值 = M3 第二份）
 * → 归到 FOLDERS 的拥有者 `resourceStore`，两处 import 同一常量（TD-02-53）。
 */
const FOLDER_PILLS = FOLDERS.filter((f) => LIBRARY_CATEGORY_KEYS.includes(f.key)).map((f) => ({
  // pill value 用 folder（本面板既有语义：`folder` state 即目录前缀）；
  // 「全部」在 FOLDERS 里 folder=null → 本面板约定 = 素材库根（真源 LIBRARY_ROOT）。
  folder: f.folder ?? LIBRARY_ROOT,
  label: f.label,
}));

interface TypeBadge {
  icon: LucideIcon;
  cls: string;
}

const TYPE_BADGE: Record<string, TypeBadge> = {
  image: { icon: ImageIcon, cls: 'text-blue-400 bg-blue-500/10' },
  video: { icon: Play, cls: 'text-purple-400 bg-purple-500/10' },
  audio: { icon: Music, cls: 'text-green-400 bg-green-500/10' },
  text: { icon: FileText, cls: 'text-yellow-400 bg-yellow-500/10' },
};

const PAGE_SIZE = 20; // 每次加载 20 个，无限滚动追加

// fetchText/textCache 统一收敛到 useAssetDragToCanvas.js；isAudio 统一到 assetType.js
// 文字素材单元格：默认展示文件内容（前几行）
const TextAssetCell = React.memo(function TextAssetCell({
  url,
  name,
}: {
  url: string;
  name?: string;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    let alive = true;
    fetchText(url).then((t) => {
      if (alive) setText(t);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  const display = useMemo(() => String(text || name || '').slice(0, 120), [text, name]);
  return (
    <div className="w-full h-full bg-surface-strong flex items-center justify-center px-1.5">
      {display && (
        <p className="text-2xs text-muted leading-tight m-0 line-clamp-3 break-all text-center">
          {display}
        </p>
      )}
    </div>
  );
});

// 文字素材预览：完整展示文件内容
const TextPreview = React.memo(function TextPreview({ url, name }: { url: string; name?: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    let alive = true;
    fetchText(url).then((t) => {
      if (alive) setText(t);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="w-[360px] max-w-[90vw] bg-surface-2 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-primary m-0">{name}</span>
      </div>
      <pre className="text-xs text-secondary whitespace-pre-wrap break-words max-h-[55vh] overflow-y-auto custom-scrollbar m-0">
        {text || '（加载中...）'}
      </pre>
    </div>
  );
});

/**
 * 素材库 tab —— 与本地磁盘文件一一对应（从 localTool /api/resources 读取 migrated 目录，rescan 收录），
 * 目录 pill 沿用本原型小圆按钮形式，无限滚动（每次 20 个）。
 * 顶部「⋯」菜单含「打开本地目录」「新建文件夹」（对齐官方素材 tab）。
 * 上传文件真实落盘到后端 /api/files/upload；删除走 /api/resources/delete。预览/拖拽建节点保留。
 */
function ResourceLibrary() {
  const { status } = useLocalToolStatus();
  const connected = status.isConnected;
  // docs/122 #3：按当前项目拉取素材（legacy project_id NULL 全项目可见，显式 projectId 只对其项目）
  const projectId = useCurrentProjectId();

  const [folder, setFolder] = useState(LIBRARY_ROOT); // 当前目录前缀路径（素材库根 = 「全部」）
  const [preview, setPreview] = useState<ResourceItem | null>(null);
  const videoZoomRef = useRef<HTMLDialogElement>(null); // 视频预览统一走 ImageZoomDialog（含截屏按钮）

  // 视频预览：preview 变为视频时自动打开统一视频框（关闭由 onClose 复位 preview）
  useEffect(() => {
    if (preview && (preview.type === 'video' || String(preview.type).startsWith('video'))) {
      videoZoomRef.current?.showModal();
    }
  }, [preview]);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  /**
   * 「加载下一页」的失败原因（null = 无错误）。
   * 【为什么必须有】此前翻页失败被 `catch { /* 忽略 *\/ }` 静默吞掉 → 列表停在半路，
   * 用户看到的是"加载完了"，与事实相反（静默不完整）。失败读者 = 用户 ⇒ 用**持续可见**的
   * UI 状态（不是 toast，toast 逝去即失明）+ 「点击重试」入口。
   */
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  // 外部事件驱动的**重拉信号**（机制，不是兜底）：`resource:sent` 自带目标目录，而目标目录可能与
  // 本面板当前目录**相同** —— setFolder 同值不触发上面的 effect，故需这个单调递增信号保证
  // 「同目录再发送也重拉」。两 state 各司其职（目录 / 重拉信号），React 批处理合并为一次 effect。
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<ResourceItem | null>(null); // 正在重命名的资源
  const [renameName, setRenameName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  /** 失败后阻断自动重试（防滚动无限重试 + 刷日志）；用 ref 而非 state —— 重试入口需要**同步**解除。 */
  const loadMoreBlockedRef = useRef(false);
  const resetTokenRef = useRef(0);

  const currentFolder = folder || LIBRARY_ROOT; // 当前目录（用于拉取/打开本地/上传落点）
  /**
   * 拉取过滤方式（用户裁定 2026-09-17）：**「全部」= 精确 `migrated` 根（尚未归类）**。
   *
   * 【为什么根目录用精确而非前缀】原语义（前缀）= `migrated` 根 + 人物/场景/道具 一锅端，
   * 与各分类重复、且让"待归类"淹没在已归类素材里。改精确后，「全部」就是待归类区，
   * 旁边并排显示子文件夹卡片（后端返回的 `type:'folder'`）作拖拽落点。
   * 进入子目录（如 `migrated/人物`）后仍用**前缀**（含其更深子目录），保持浏览语义不变。
   *
   * 判据直接内联在 fetch 处（`currentFolder === 'migrated'`）而不用派生变量 ——
   * 派生变量会让 react-hooks/exhaustive-deps 要求把它也列进 deps（它本就随 currentFolder 变）。
   */
  const fetchArgsFor = useCallback(
    // 根 → 精确 / 子目录 → 前缀：规则走 libraryBrowse（与导入弹窗**同一份实现**，不再自写判断）。
    (extra: Record<string, unknown> = {}) => ({
      ...libraryBrowseArgs(currentFolder),
      ...extra,
    }),
    [currentFolder],
  );
  // 返回上一级（在子目录时）；到顶（父 = 根）→ 回素材库根。
  const back = useCallback(() => {
    setFolder(libraryUpFolder(folder) ?? LIBRARY_ROOT);
  }, [folder]);

  // 重置并加载第一页（目录变化时先 rescan，保证与磁盘一致）
  const reset = useCallback(
    async (rescan = false) => {
      if (!connected) return;
      const token = ++resetTokenRef.current;
      setLoading(true);
      setLoadMoreError(null);
      loadMoreBlockedRef.current = false;
      pageRef.current = 1;
      try {
        if (rescan) await rescanResources();
        // 根目录 = 精确（只看待归类）；子目录 = 前缀（含更深子目录）—— 见 fetchArgsFor 注释。
        const slice = await fetchResourcePage({ ...fetchArgsFor(), projectId }, 1, PAGE_SIZE);
        if (token !== resetTokenRef.current) return;
        setItems(slice.items);
        mergeResourcesFromBackend(slice.items);
        setTotal(slice.total);
        setHasMore(hasMoreOf(slice));
      } catch (e) {
        logger.warn(
          'ResourceLibrary',
          '加载失败（localTool 未连？）',
          (e as { message?: string })?.message,
        );
        if (token === resetTokenRef.current) setItems([]);
      } finally {
        if (token === resetTokenRef.current) setLoading(false);
      }
    },
    [connected, projectId, fetchArgsFor],
  );

  // 首次挂载 + 目录变化 + 项目切换 + 重拉信号 → 重置到第 1 页并 rescan
  useEffect(() => {
    if (!connected) return;
    reset(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, currentFolder, projectId, refreshSignal]);

  // 订阅「素材已落盘可用」事件（`resource:sent`）：切到落盘目录 + 触发重拉。
  // 该事件由发送方在**落盘 + 归位之后**发出（见 resourceStore.sendToResourceLibrary）——
  // 收到即代表后端「文件 + 行 + 目录」已齐备，此刻 rescan 才拉得到它。
  useEffect(() => {
    return onResourceSent((sentFolder: string) => {
      setFolder(sentFolder || LIBRARY_ROOT);
      setRefreshSignal((n) => n + 1);
    });
  }, []);

  // 加载下一页并追加（无限滚动）
  const loadMore = useCallback(async () => {
    // 失败后**不自动重试**（否则滚动会无限重试 + 刷日志）：等用户点「重试」解除阻断再走。
    if (!connected || loadingRef.current || !hasMore || loadMoreBlockedRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadMoreError(null);
    const next = pageRef.current + 1;
    try {
      // 与 reset 同口径（根目录精确 / 子目录前缀），否则翻页会串入已归类素材。
      const slice = await fetchResourcePage({ ...fetchArgsFor(), projectId }, next, PAGE_SIZE);
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...slice.items.filter((x) => !seen.has(x.id))];
      });
      pageRef.current = slice.page;
      setTotal(slice.total);
      setHasMore(hasMoreOf(slice));
      mergeResourcesFromBackend(slice.items);
    } catch (e) {
      // 失败可见（读者 = 用户）：此前这里是静默吞 → 用户把"加载失败"读成"已经到底"。
      const message = e instanceof Error ? e.message : String(e);
      logger.warn('ResourceLibrary', '加载下一页失败', message);
      loadMoreBlockedRef.current = true;
      setLoadMoreError(message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [connected, hasMore, projectId, fetchArgsFor]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) loadMore();
  }, [loadMore]);

  // 上传文件到后端（落盘当前目录 + rescan 收录）
  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!connected) {
        showToast('请先连接本地引擎', { type: 'warning' });
        return;
      }
      if (!files) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      let ok = 0;
      /** 【2026-09-17】失败明细（**生产者判词**）—— 不再只剩一个"上传失败"的笼统结论。 */
      const failures: Array<{ name: string; message: string }> = [];
      for (const f of list) {
        // 【2026-09-17 判据】失败**不再只计数后丢掉**：逐条收生产者判词，让用户知道"为什么没传上去"。
        const r = await uploadFileToLocal(f, currentFolder);
        if (r.ok) ok++;
        else failures.push({ name: f.name, message: r.message });
      }
      if (ok > 0) {
        // 【失败可见】部分成功时把失败明细一并说明（原来只要有 1 个成功就完全静默其余失败）。
        const tail = failures.length > 0 ? `；${failures.length} 个失败：${failures[0].message}` : '';
        showToast(`已上传 ${ok} 个素材${tail}`, { type: failures.length > 0 ? 'warning' : 'success' });
        // 修复：上传后未触发 rescan → 面板不刷新、用户「看不到刚传的图」。
        // 主动广播事件，复用与链路 B 一致的「切目录 + rescan」刷新机制。
        emitResourceSent(currentFolder);
        reset(true); // rescan 后刷新，保证与磁盘一致
      } else {
        // 【消费者只转发】带上第一条生产者判词 —— 原来只有笼统一句"上传失败"。
        showToast(`上传失败：${failures[0]?.message || '未知原因'}`, { type: 'error' });
      }
    },
    [connected, currentFolder, reset],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (item: ResourceItem) => {
    setItems((list) => list.filter((x) => x.id !== item.id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await deleteResource(item.id);
    } catch {
      showToast('删除失败', { type: 'error' });
    }
  };

  const handleOpenLocal = () => {
    if (!connected) {
      showToast('请先连接本地引擎', { type: 'warning' });
      return;
    }
    openLocalFolder(currentFolder)
      .then((r) => showToast(`已在文件管理器中打开: ${r?.data?.path}`, { type: 'success' }))
      .catch(() => showToast('打开本地目录失败', { type: 'error' }));
  };

  const handleOpenFileDir = (item: ResourceItem) => {
    const rel = relativePathFromUrl(item.url ?? '');
    if (!rel) {
      showToast('打开所在目录失败', { type: 'error' });
      return;
    }
    openFileDir(rel).catch(() => showToast('打开所在目录失败', { type: 'error' }));
  };

  // 重命名资源
  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      setRenameTarget(null);
      return;
    }
    try {
      const res = await renameResource(renameTarget.id, name);
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
  };

  // 新建文件夹（对齐官方 → POST /api/files/mkdir）
  const createFolder = async (name: string): Promise<boolean> => {
    if (!name || !connected) return false;
    try {
      await createFolderApi(`${currentFolder}/${name}`);
      reset(true);
      return true;
    } catch (e) {
      // 建文件夹失败 → 返回 false 由 UI 呈现（**调用方可见**，非静默）；另留痕给开发者（2026-09-17）。
      logger.debug('素材库', '建文件夹失败（已由返回值呈现）', e);
      return false;
    }
  };

  // 卡片拖拽：一套 dragstart 同时写「移动归类」+「拖到画布建节点」两套 MIME（见 useResourceCardDragProps 注释）
  const { cardDragProps, assetDragProps } = useResourceCardDragProps({
    connected,
    onRefreshed: () => reset(true),
  });

  return (
    <div
      className="h-full flex flex-col overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        if ([...e.dataTransfer.types].includes('Files')) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* 副工具条：目录 pill（可横滚 + 拖拽防误点，收进共享 PanelPills）+ ⋯ 菜单（无搜索，按用户裁定） */}
      <PanelSubBar>
        <PanelPills
          items={FOLDER_PILLS.map((f) => ({ key: f.folder, label: f.label }))}
          value={folder}
          onChange={(folderPath) => setFolder(folderPath)}
          leading={
            folder !== LIBRARY_ROOT ? (
              <button
                className="pk-pill"
                onClick={back}
                title="返回上级"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={12} /> {folder.split('/').pop()}
              </button>
            ) : undefined
          }
        />
        <PanelMoreMenu
          items={[
            {
              key: 'open',
              label: '打开本地目录',
              icon: FolderOpen,
              onClick: () => {
                if (!connected) {
                  showToast('请先连接本地引擎', { type: 'warning' });
                  return;
                }
                handleOpenLocal();
              },
            },
            {
              key: 'newfolder',
              label: '新建文件夹',
              icon: FolderPlus,
              onClick: () => {
                if (!connected) {
                  showToast('请先连接本地引擎', { type: 'warning' });
                  return;
                }
                setCreating(true);
                setNewFolderName('新建文件夹');
              },
            },
          ]}
        />
      </PanelSubBar>

      {/* 新建文件夹输入卡片（TD-19-3：走唯一实现 InlineNameInput） */}
      {creating && (
        <InlineNameInput
          tone="orange"
          value={newFolderName}
          onChange={setNewFolderName}
          // 回车：无条件建（含默认名）+ toast —— 与旧的 Enter 语义一致
          onCommit={async () => {
            const ok = await createFolder(newFolderName.trim());
            showToast(ok ? '创建成功' : '创建失败', { type: ok ? 'success' : 'error' });
            setCreating(false);
          }}
          // 失焦：仅在改了名时静默建 —— 与旧的 onBlur 语义一致
          onBlurCommit={async () => {
            if (newFolderName.trim() && newFolderName.trim() !== '新建文件夹') {
              await createFolder(newFolderName.trim());
            }
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* 重命名输入条（TD-19-3：走唯一实现 InlineNameInput） */}
      {renameTarget && (
        <InlineNameInput
          value={renameName}
          onChange={setRenameName}
          onCommit={handleRename}
          onCancel={() => {
            setRenameTarget(null);
            setRenameName('');
          }}
          placeholder="输入新文件名"
          onFocusSelectBody
        />
      )}

      {/* 上传区 */}
      <div className="px-2.5 pt-2 flex-shrink-0">
        <button
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-edge text-body-xs text-muted hover:border-edge-strong hover:text-body transition-colors cursor-pointer bg-surface-strong/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} /> 上传素材 / 拖入文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,text/*,.txt,.md,.json,.csv,.srt"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* 素材网格（无限滚动） */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-2.5 mt-2"
      >
        {!connected ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">
            请先连接本地引擎
          </div>
        ) : loading && items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-faint text-sm gap-2">
            <div className="text-4xl opacity-40">📦</div>
            <p className="m-0">该目录暂无素材</p>
            <p className="text-xs text-subtle m-0">上传文件后会落盘到本地并出现在这里</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {items.map((a) => {
                const badge = TYPE_BADGE[a.type ?? 'image'] || TYPE_BADGE.image;
                const BadgeIcon = badge.icon;
                const audio = isAudio(a.type, a.url);
                const isFolder = a.type === 'folder';
                return (
                  <div
                    key={a.id}
                    {...cardDragProps(a)}
                    className={`group relative aspect-square bg-surface rounded-xl overflow-hidden transition-colors ${isFolder ? 'border border-edge cursor-pointer hover:border-edge-raised' : 'border border-edge cursor-grab active:cursor-grabbing hover:border-edge-raised'}`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 200px' }}
                    onClick={() => {
                      // 目录条目 → 自身目录路径：**唯一实现** folderPathOf（不再就地拼 currentFolder/name，
                      // 那份与「拖入归类」的落点推导是同一条规则的第二份 = M3）。
                      if (isFolder) setFolder(folderPathOf(a));
                      else setPreview(a);
                    }}
                  >
                    {isFolder ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted">
                        <FolderOpen size={30} strokeWidth={1.2} />
                        <span className="text-caption font-medium text-center px-1 break-all leading-tight m-0">
                          {a.name}
                        </span>
                      </div>
                    ) : a.type === 'text' ? (
                      <TextAssetCell url={a.url ?? ''} name={a.name} />
                    ) : audio ? (
                      <div className="w-full h-full bg-surface-black flex flex-col items-center justify-center gap-1.5 p-2">
                        <Music size={22} className="text-green-400" />
                        <span className="text-meta text-muted text-center break-all leading-tight m-0">
                          {a.name}
                        </span>
                      </div>
                    ) : a.type === 'video' || (a.type && a.type.startsWith('video')) ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                        {a.url ? (
                          <video src={a.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <Play size={20} className="text-faint" />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-7 h-7 rounded-full bg-black/45 flex items-center justify-center">
                            <Play size={12} className="text-white ml-0.5" />
                          </span>
                        </span>
                      </div>
                    ) : a.url ? (
                      <LazyImage src={a.url} alt={a.name} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-subtle">
                        <FileText size={18} />
                      </div>
                    )}

                    {/* 类型角标（文件夹/文字不显示黄色图标） */}
                    {!isFolder && a.type !== 'text' && (
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center ${badge.cls}`}
                      >
                        <BadgeIcon size={9} />
                      </span>
                    )}

                    {/* 卡片操作：打开目录 / 重命名 / 删除；移动到文件夹改为「拖文件到文件夹卡片」 */}
                    {!isFolder && (
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none"
                          title="打开所在目录"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFileDir(a);
                          }}
                        >
                          <FolderOpen size={10} />
                        </button>
                        <button
                          className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none"
                          title="重命名"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameTarget(a);
                            setRenameName(a.name ?? '');
                          }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-red-300 hover:bg-black/80 cursor-pointer border-none"
                          title="删除"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(a);
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}

                    {/* 底部名称 */}
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-meta text-white/80 truncate m-0">{a.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部加载提示 */}
            {loading && (
              <div className="py-3 text-center text-caption-sm text-faint">加载中...</div>
            )}
            {/* 翻页失败：持续可见 + 可重试（读者 = 用户；此前这里静默吞 → 用户读成"到底了"） */}
            {!loading && loadMoreError && (
              <button
                className="w-full py-3 text-center text-caption-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer border-none bg-transparent"
                title={loadMoreError}
                onClick={() => {
                  loadMoreBlockedRef.current = false;
                  void loadMore();
                }}
              >
                加载更多失败 · 点击重试
              </button>
            )}
            {!loading && !loadMoreError && !hasMore && items.length > 0 && (
              <div className="py-3 text-center text-caption-sm text-subtle">
                已全部加载（共 {total} 个）
              </div>
            )}
          </>
        )}
      </div>

      {/* 拖入高亮 */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400/50 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <span className="text-blue-300 text-sm">松开以上传素材</span>
        </div>
      )}

      {/* 点击大图/文字/音频预览；视频统一走下方 ImageZoomDialog */}
      {preview && preview.type !== 'video' && !String(preview.type).startsWith('video') && (
        <div
          className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-w-full max-h-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.type === 'text' ? (
              <TextPreview url={preview.url ?? ''} name={preview.name} />
            ) : isAudio(preview.type, preview.url) ? (
              <div className="w-[300px] bg-surface-2 rounded-xl p-6 flex flex-col items-center gap-3">
                <Music size={40} className="text-green-400" />
                <p className="text-xs text-secondary m-0">{preview.name}</p>
                <audio src={preview.url} controls className="w-full" />
              </div>
            ) : (
              <img
                src={toAbsoluteFileUrl(preview.url)}
                alt={preview.name}
                {...toImgDragProps(
                  assetDragProps({
                    url: toAbsoluteFileUrl(preview.url),
                    name: preview.name,
                    type: preview.type,
                  }),
                )}
                className="max-h-[75vh] max-w-full rounded-lg object-contain cursor-grab active:cursor-grabbing"
              />
            )}
            <p className="text-xs text-muted m-0">
              {preview.name} · {preview.folder}
            </p>
            <button
              className="px-4 py-1.5 rounded-lg bg-surface-hover text-body hover:bg-surface-hover-strong text-xs cursor-pointer border-none"
              onClick={() => setPreview(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
      {/* 视频预览统一收口到 ImageZoomDialog（含截屏当前帧/尾帧按钮） */}
      {preview && (preview.type === 'video' || String(preview.type).startsWith('video')) && (
        <ImageZoomDialog
          ref={videoZoomRef}
          url={preview.url}
          kind="video"
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export default React.memo(ResourceLibrary);
