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
import {
  fetchResources,
  rescanResources,
  deleteResource,
  renameResource,
} from '../api/localToolApi.ts';
import { showToast } from '../core/toastStore.ts';
import { publish } from '../core/eventBus.ts';
import {
  fetchText,
  textCache,
  useAssetCardDragProps,
} from '../../../hooks/useAssetDragToCanvas.ts';
import {
  toAbsoluteFileUrl,
  uploadFileToLocal,
  openLocalFolder,
  openFileDir,
  relativePathFromUrl,
  createFolder as createFolderApi,
} from '../api/filesApi.ts';
import { onAssetSent, emitAssetSent } from '../store/assetStore.ts';
import { logger } from '../core/logger.ts';
import { isAudio } from '../utils/mediaType.ts';
import LazyImage from '../ui/LazyImage.tsx';
import ImageZoomDialog from '../editors/ImageZoomDialog.tsx';
import type { ResourceItem } from '../api/localToolApi.ts';
import { toImgDragProps } from '../../../hooks/useAssetDragToCanvas.ts';

/** 目录 pill（folder 前缀对齐本地磁盘 migrated 结构，与后端 /api/resources 一一对应） */
interface FolderPill {
  key: string;
  label: string;
  folder: string;
}

const FOLDER_PILLS: FolderPill[] = [
  { key: 'migrated', label: '全部', folder: 'migrated' },
  { key: 'character', label: '人物', folder: 'migrated/人物' },
  { key: 'scene', label: '场景', folder: 'migrated/场景' },
  { key: 'prop', label: '道具', folder: 'migrated/道具' },
];

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

// fetchText/textCache 统一收敛到 useAssetDragToCanvas.js；isAudio 统一到 mediaType.js
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
function AssetLibrary() {
  const { status } = useLocalToolStatus();
  const connected = status.isConnected;

  const [folder, setFolder] = useState('migrated'); // 当前目录前缀路径（migrated 为「全部」根）
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
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<ResourceItem | null>(null); // 正在重命名的资源
  const [renameName, setRenameName] = useState('');
  const [menuItemId, setMenuItemId] = useState<string | null>(null); // 卡片「⋯」菜单打开的卡片 id

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const resetTokenRef = useRef(0);

  const currentFolder = folder || 'migrated'; // 当前目录前缀（用于拉取/打开本地/上传落点）
  // 返回上一级（在子目录时）
  const back = useCallback(() => {
    const parts = folder.split('/');
    parts.pop();
    setFolder(parts.length > 0 ? parts.join('/') : 'migrated');
  }, [folder]);

  // 重置并加载第一页（目录变化时先 rescan，保证与磁盘一致）
  const reset = useCallback(
    async (rescan = false) => {
      if (!connected) return;
      const token = ++resetTokenRef.current;
      setLoading(true);
      pageRef.current = 1;
      try {
        if (rescan) await rescanResources();
        const data = await fetchResources({ folder: currentFolder, page: 1, pageSize: PAGE_SIZE });
        if (token !== resetTokenRef.current) return;
        const d = data?.data;
        setItems(d?.items || []);
        setTotal(d?.total || 0);
        setHasMore((d?.items || []).length < (d?.total || 0));
      } catch (e) {
        logger.warn('AssetLibrary', '加载失败（localTool 未连？）', e?.message);
        if (token === resetTokenRef.current) setItems([]);
      } finally {
        if (token === resetTokenRef.current) setLoading(false);
      }
    },
    [connected, currentFolder],
  );

  // 首次挂载 + 目录变化 → 重置到第 1 页并 rescan
  useEffect(() => {
    if (!connected) return;
    reset(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, currentFolder]);

  // 订阅「发送到素材库」成功事件：自动切到落盘目录并重新 rescan 拉取，
  // 解决此前「点完要切目录/点别处才刷新」的体感问题（assetStore 与面板互不相通）。
  useEffect(() => {
    return onAssetSent((sentFolder: string) => {
      const target = sentFolder || 'migrated';
      setFolder(target); // 触发 currentFolder 变化 → 上面的 reset(true) 自动 rescan 刷新
    });
  }, []);

  // 加载下一页并追加（无限滚动）
  const loadMore = useCallback(async () => {
    if (!connected || loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    const next = pageRef.current + 1;
    try {
      const data = await fetchResources({ folder: currentFolder, page: next, pageSize: PAGE_SIZE });
      const d = data?.data;
      if (d?.page && d.page > 1) {
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...(d.items || []).filter((x) => !seen.has(x.id))];
        });
      }
      pageRef.current = d.page || next;
      setTotal(d.total || 0);
      setHasMore((d.items || []).length > 0 && d.page < (d.totalPages || 1));
    } catch {
      /* 忽略下一页失败 */
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [connected, currentFolder, hasMore]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) loadMore();
  }, [loadMore]);

  // 上传文件到后端（落盘当前目录 + rescan 收录）
  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!connected) return showToast('请先连接本地引擎', { type: 'warning' });
      const list = Array.from(files);
      if (list.length === 0) return;
      let ok = 0;
      for (const f of list) {
        // 候选 A（deepening-files-upload-seam）：uploadFileToLocal 失败返 null（等价原 try/catch 吞错），
        // 成功才计数——不丢弃单文件失败、也不回滚已成功项。
        const url = await uploadFileToLocal(f, currentFolder);
        if (url) ok++;
      }
      if (ok > 0) {
        showToast(`已上传 ${ok} 个素材`, { type: 'success' });
        // 修复：上传后未触发 rescan → 面板不刷新、用户「看不到刚传的图」。
        // 主动广播事件，复用与链路 B 一致的「切目录 + rescan」刷新机制。
        emitAssetSent(currentFolder);
        reset(true); // rescan 后刷新，保证与磁盘一致
      } else {
        showToast('上传失败', { type: 'error' });
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
    if (!connected) return showToast('请先连接本地引擎', { type: 'warning' });
    openLocalFolder(currentFolder)
      .then((r) => showToast(`已在文件管理器中打开: ${r?.data?.path}`, { type: 'success' }))
      .catch(() => showToast('打开本地目录失败', { type: 'error' }));
  };

  const handleOpenFileDir = (item: ResourceItem) => {
    const rel = relativePathFromUrl(item.url);
    if (!rel) return showToast('打开所在目录失败', { type: 'error' });
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
      textCache.delete(renameTarget.url);
      // 广播改名：画布/脚本箱节点里引用旧 url 的字段改写为新 url（App 订阅），防下游图生图 404
      if (d.url && d.url !== renameTarget.url)
        publish('resource:renamed', { oldUrl: renameTarget.url, newUrl: d.url });
      showToast('重命名成功', { type: 'success' });
    } catch (e) {
      showToast(e?.message || '重命名失败', { type: 'error' });
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
    } catch {
      /* ignore */
    }
    return false;
  };

  // 卡片拖拽：一套 dragstart 同时写「移动归类」+「拖到画布建节点」两套 MIME（见 useAssetCardDragProps 注释）
  const { cardDragProps, assetDragProps } = useAssetCardDragProps({
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
            folder !== 'migrated' ? (
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
                if (!connected) return showToast('请先连接本地引擎', { type: 'warning' });
                handleOpenLocal();
              },
            },
            {
              key: 'newfolder',
              label: '新建文件夹',
              icon: FolderPlus,
              onClick: () => {
                if (!connected) return showToast('请先连接本地引擎', { type: 'warning' });
                setCreating(true);
                setNewFolderName('新建文件夹');
              },
            },
          ]}
        />
      </PanelSubBar>

      {/* 新建文件夹输入卡片 */}
      {creating && (
        <div className="px-2.5 pt-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-deep border border-orange-500/40 rounded-lg p-1.5">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const ok = await createFolder(newFolderName.trim());
                  showToast(ok ? '创建成功' : '创建失败', { type: ok ? 'success' : 'error' });
                  setCreating(false);
                } else if (e.key === 'Escape') setCreating(false);
              }}
              onBlur={async () => {
                if (newFolderName.trim() && newFolderName.trim() !== '新建文件夹') {
                  await createFolder(newFolderName.trim());
                }
                setCreating(false);
              }}
              className="flex-1 h-7 bg-surface-strong border border-orange-500/40 rounded-md px-2 text-caption-sm text-white outline-none focus:border-orange-500 box-border"
            />
            <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
          </div>
        </div>
      )}

      {/* 重命名输入条 */}
      {renameTarget && (
        <div className="px-2.5 pt-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-deep border border-blue-500/40 rounded-lg p-1.5">
            <input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              // 聚焦即自动选中「文件名主体（不含后缀）」，便于直接改；后缀保留以免改错扩展名
              onFocus={(e) => {
                const v = e.target.value || '';
                const dot = v.lastIndexOf('.');
                const end = dot > 0 ? dot : v.length;
                e.target.setSelectionRange(0, end);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                } else if (e.key === 'Escape') {
                  setRenameTarget(null);
                  setRenameName('');
                }
              }}
              onBlur={handleRename}
              className="flex-1 h-7 bg-surface-strong border border-blue-500/40 rounded-md px-2 text-caption-sm text-white outline-none focus:border-blue-500 box-border"
              placeholder="输入新文件名"
            />
            <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
          </div>
        </div>
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
                const badge = TYPE_BADGE[a.type] || TYPE_BADGE.image;
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
                      if (isFolder)
                        setFolder(
                          currentFolder === 'migrated'
                            ? `migrated/${a.name}`
                            : `${currentFolder}/${a.name}`,
                        );
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
                      <TextAssetCell url={a.url} name={a.name} />
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
                            setRenameName(a.name);
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
            {!loading && !hasMore && items.length > 0 && (
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
              <TextPreview url={preview.url} name={preview.name} />
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

export default React.memo(AssetLibrary);
