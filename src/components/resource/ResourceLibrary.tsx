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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PanelSubBar, PanelPills, PanelMoreMenu } from '../base/panels/PanelBar.tsx';
import { useLocalToolStatus } from '@/hooks/useLocalToolStatus';
import { rescanResources, deleteResource } from '../base/api/localToolApi.ts';
// 分页读取的唯一实现（读一页；"是否还有更多"的判据是响应里的 totalPages，本文件不抄上限数字）。
import { fetchResourcePage } from '../base/api/pagedList.ts';
import { showToast } from '../base/core/event/toastStore.ts';
import { useResourceCardDragProps, useTextAsset } from '@/hooks/useAssetDragToCanvas';
import {
  uploadFileToLocal,
  openLocalFolder,
  openFileDir,
  relativePathFromUrl,
} from '../base/api/filesApi.ts';
import {
  onResourceSent,
  emitResourceSent,
  mergeResourcesFromBackend,
  libraryFoldersOf,
} from '@/components/resource/resourceStore';
// 目录浏览规则 + 素材库根：**与导入弹窗共用同一份**（唯一实现，见 libraryBrowse.ts）。
import {
  LIBRARY_ROOT,
  libraryBrowseArgs,
  libraryUpFolder,
  isEmptyLibraryRoot,
} from './libraryBrowse.ts';
// 【TD-04-57】卡片操作浮层收口为唯一实现（原为与本文件逐字重复的 40 行 JSX）。
import { ResourceCardActions } from './ResourceCardActions.tsx';
// 底部翻页栏：**唯一实现**（2026-09-21 与生成面板收口，替代本文件的无限滚动）。
import PagedFooter from './PagedFooter.tsx';
// 目录条目 → 自身目录路径的唯一实现（与「点目录进入」「拖入归类」共用）。
import { folderPathOf } from '@/hooks/useResourceMoveToFolder';
import { useCurrentProjectId } from '../base/store/projectStore.ts';
import { logger } from '../base/core/log/logger.ts';
import { isAudio, isVideoResource } from '../base/utils/media/assetType.ts';
import LazyImage from '../base/ui/display/LazyImage.tsx';
import { useInlineNameEditing } from '@/hooks/useInlineNameEditing.tsx';
import type { ResourceItem } from '../base/api/localToolApi.ts';
// 预览 overlay（文字/音频/图片 + 视频委托 ImageZoomDialog）的唯一实现，与生成面板共用
import { ResourcePreviewOverlay } from './ResourcePreview.tsx';

/**
 * 目录 pill 的来源 —— **派生自 `resourceStore.libraryFoldersOf()`（唯一判据），不在此另写一份**。
 *
 * 【收口（2026-09-17）】此前本文件有一份硬编码 `FOLDER_PILLS`，与 `resourceStore.FOLDERS`
 * 是**同一件事的两份**（人物/场景/道具三项目的 label 与 folder 逐字相同）= M3 第二份。
 * 现只保留「面向用户素材」的项，与 `base/media` 的 library provider **同一判据**
 * （tasks 由「生成」来源承载，不在此重复）。
 * 更新(2026-09-17)：白名单**不再在本文件定义**（此前与 library provider 各一份同名同值 = M3 第二份）
 * → 归到 FOLDERS 的拥有者 `resourceStore`，两处 import 同一常量（TD-02-53）。
 *
 * 【TD-03-15 · 2026-09-18 改为数据驱动】原为**模块级静态常量**（只含静态白名单 4 项）
 * ⇒ 用户在 `migrated` 下自建的目录（实测 `颜色`／`HKH其他产品`）**没有 pill、点不进去**。
 * 现移到组件内由 `libraryFoldersOf(items 里的 folder 行)` 派生 —— **目录一建出来就有入口**。
 * 数据来源不新增接口：本面板已经在拉 `/api/resources`，其中的 `type:'folder'` 条目就是磁盘目录的投影。
 */

/** 把分类清单转成 pill 项（「全部」的 folder=null → 本面板约定 = 素材库根 LIBRARY_ROOT，唯一真源）。 */
function toPillItems(folders: ReturnType<typeof libraryFoldersOf>) {
  return folders.map((f) => ({ folder: f.folder ?? LIBRARY_ROOT, label: f.label }));
}

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

const PAGE_SIZE = 20; // 每页 20 个（翻页控件 = 底部 `PagedFooter`，与生成面板同一实现）

// 文字读取与三态统一收敛到 useAssetDragToCanvas.js 的 useTextAsset（唯一实现）；isAudio / isVideoResource 统一到 assetType.js
// 文字素材单元格：默认展示文件内容（前几行）
const TextAssetCell = React.memo(function TextAssetCell({
  url,
  name,
}: {
  url: string;
  name?: string;
}) {
  const state = useTextAsset(url);
  // 失败必须可见：不退回 name —— 否则"读失败"与"文件名"在界面上无从区分（TD-18-17 · 一诚实）
  const text = state.phase === 'ok' ? state.text : state.phase === 'failed' ? state.error : '';
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

/**
 * 素材库 tab —— 与本地磁盘文件一一对应（从 localTool /api/resources 读取 migrated 目录，rescan 收录），
 * 目录 pill 沿用本原型小圆按钮形式，**底部翻页（每页 20 个，控件与生成面板同一实现）**。
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
  const [items, setItems] = useState<ResourceItem[]>([]);
  /**
   * 磁盘实有的子目录行（`type:'folder'`）—— **只在 `migrated` 根那一拉更新**。
   *
   * 【为什么要独立于 `items`（TD-03-15）】目录 pill 清单由「静态基底 ∪ 磁盘实有子目录」派生，
   * 而 `items` 随当前目录变化（进子目录后里面就没有 folder 行了）⇒ 若从 `items` 派生，
   * **一进子目录 pill 就集体消失**（用户再也点不回去）。故单独留存，只在浏览到根时分母对。
   */
  const [rootFolderRows, setRootFolderRows] = useState<
    { folder?: string | null; name?: string | null }[]
  >([]);
  const [total, setTotal] = useState(0);
  /** 当前页 / 总页数（`totalPages` 由后端响应决定，本面板不抄任何上限数字）。 */
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  /**
   * 「翻页」的失败原因（null = 无错误）。
   * 【为什么必须有】翻页失败若被静默吞掉 → 列表停在旧页、用户读成"就这些"，与事实相反（静默不完整）。
   * 失败读者 = 用户 ⇒ 用**持续可见**的 UI 状态（不是 toast，toast 逝去即失明）+ 「点击重试」入口。
   * （2026-09-21：由无限滚动的 `loadMoreError` 改为翻页失败态 —— 触发方式变了，失败语义随之改变。）
   */
  const [pageError, setPageError] = useState<string | null>(null);
  /** 首屏（第 1 页 / 换目录 / 重拉）加载失败的原因；与 `pageError`（翻页）分开——
   *  两者的**重试动作不同**（重跑 `reset` vs 重跑当前页），共用一个状态会把重试接到错的动作上。 */
  const [loadError, setLoadError] = useState<string | null>(null);
  // 外部事件驱动的**重拉信号**（机制，不是兜底）：`resource:sent` 自带目标目录，而目标目录可能与
  // 本面板当前目录**相同** —— setFolder 同值不触发上面的 effect，故需这个单调递增信号保证
  // 「同目录再发送也重拉」。两 state 各司其职（目录 / 重拉信号），React 批处理合并为一次 effect。
  const [refreshSignal, setRefreshSignal] = useState(0);
  // 【TD-04-56】`creating` / `newFolderName` / `renameTarget` / `renameName` 四个 state
  // 与「建目录 / 重命名」的全部逻辑，已收口到 `useInlineNameEditing`（调用点见下方 `reset` 之后）。

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const resetTokenRef = useRef(0);

  const currentFolder = folder || LIBRARY_ROOT; // 当前目录（用于拉取/打开本地/上传落点）

  /**
   * 目录 pill 清单（**数据驱动**，TD-03-15）：静态基底 ∪ 磁盘实有子目录。
   * 判据唯一实现在 `resourceStore.libraryFoldersOf`，本面板只负责喂数据与渲染。
   * 磁盘那一半来自 `rootFolderRows`（见其 state 注释：为何不直接用 `items`）。
   */
  const folderPills = useMemo(
    () => toPillItems(libraryFoldersOf(rootFolderRows)),
    [rootFolderRows],
  );
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
      setPageError(null);
      setLoadError(null);
      setPage(1);
      try {
        if (rescan) await rescanResources();
        // 根目录 = 精确（只看待归类）；子目录 = 前缀（含更深子目录）—— 见 fetchArgsFor 注释。
        const slice = await fetchResourcePage({ ...fetchArgsFor(), projectId }, 1, PAGE_SIZE);
        if (token !== resetTokenRef.current) return;
        setItems(slice.items);
        mergeResourcesFromBackend(slice.items);
        // 【TD-03-15】浏览到素材库根时，把返回的目录行留作 pill 清单的**磁盘那一半**
        // （「全部」= folderExact:migrated ⇒ 其 items 里正好含 migrated 下所有 type:'folder'）。
        // 非根目录**不清空**（留上次的快照）—— 否则进子目录后 pill 集体消失、用户点不回去。
        // 同理**翻页不更新它**（见 goPage）：只有"重拉第 1 页"才是 pill 清单的正确分母。
        if (currentFolder === LIBRARY_ROOT) {
          setRootFolderRows(slice.items.filter((x) => x.type === 'folder'));
        }
        setTotal(slice.total);
        setTotalPages(slice.totalPages);
      } catch (e) {
        // 【2026-09-17 TD-24-4 §二】读失败不得伪装成"该目录暂无素材"（同族翻页失败已修）：
        // 此前这里只 `logger.warn` + `setItems([])` ⇒ 用户看到空态，读成"我的素材没了"。
        // 现按同族形态如实留痕 + **持续可见的错误态 + 可重试**（重试 = 重跑本函数，不是换页）。
        const message = (e as { message?: string })?.message || String(e);
        logger.warn('ResourceLibrary', '加载失败（localTool 未连？）', message);
        if (token === resetTokenRef.current) {
          setItems([]);
          setLoadError(message);
        }
      } finally {
        if (token === resetTokenRef.current) setLoading(false);
      }
    },
    [connected, projectId, fetchArgsFor, currentFolder],
  );

  // 【TD-04-56】「新建文件夹 / 重命名」统一机制：state / 未连引擎守卫 / 建目录 / 重命名 / 两段输入条
  // 全部收口到 `useInlineNameEditing`（与 GeneratedView 同一实现）；本处只声明**域差异**。
  // `createFolderPath` / `refreshList` 用 useCallback 包住 —— 它们是 hook 内 `createFolder` 的依赖，
  // 不稳则 `memo(InlineNameInput)` 依旧失效（只稳一个 prop = 白做）。
  const createFolderPath = useCallback(
    (name: string) => `${currentFolder}/${name}`,
    [currentFolder],
  );
  const refreshList = useCallback(() => void reset(true), [reset]);
  const editing = useInlineNameEditing({
    connected,
    createFolderPath,
    refresh: refreshList,
    setItems,
    logTag: '素材库',
  });

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

  /**
   * 翻到指定页（底部翻页栏的「上一页 / 下一页 / 重试」）。
   *
   * 【为什么是它、而不是"滚动到底加载更多"（2026-09-21 用户实测判定）】
   * 原实现把"加载下一页"的唯一触发挂在容器 `onScroll` 上。而第 1 页只有 20 条，
   * 在 330px 面板里**撑不满容器** ⇒ 不产生滚动条 ⇒ scroll 事件永不发生 ⇒ 加载永不触发
   *（用户实测：「完全不会动」；外在表现 = 永远 20 条，新素材把最旧那个挤出第一页）。
   * 触发条件与"内容够不够高"互为前提 = **结构死锁**，改 CSS 治不了（把 20 条拉高只是换个屏幕再犯）。
   * 现触发改为**点击**（与内容高度无关），并复用素材库/生成共用的 `PagedFooter`。
   *
   * 【与 reset 的分工】reset = 换目录 / 重拉第 1 页（会刷新 pill 清单的磁盘那一半）；
   * goPage = 只在同一目录内换页，**不碰 `rootFolderRows`**（否则翻到第 2 页 pill 会集体消失）。
   * 读取口径与 reset 完全一致（根目录精确 / 子目录前缀），否则翻页会串入已归类素材。
   */
  const goPage = useCallback(
    async (next: number) => {
      if (!connected || loading || next < 1) return;
      const target = Math.min(next, totalPages);
      const token = ++resetTokenRef.current;
      setLoading(true);
      setPageError(null);
      try {
        const slice = await fetchResourcePage({ ...fetchArgsFor(), projectId }, target, PAGE_SIZE);
        if (token !== resetTokenRef.current) return;
        // 替换（不是追加）：翻页语义 = 换一屏，与生成面板一致。
        setItems(slice.items);
        mergeResourcesFromBackend(slice.items);
        setTotal(slice.total);
        setTotalPages(slice.totalPages);
        setPage(slice.page);
      } catch (e) {
        // 失败可见（读者 = 用户）：翻页失败不得伪装成"就这些"（静默不完整）。
        const message = e instanceof Error ? e.message : String(e);
        logger.warn('ResourceLibrary', '翻页失败', message);
        if (token === resetTokenRef.current) setPageError(message);
      } finally {
        if (token === resetTokenRef.current) setLoading(false);
      }
    },
    [connected, loading, totalPages, projectId, fetchArgsFor],
  );

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
        const tail =
          failures.length > 0 ? `；${failures.length} 个失败：${failures[0].message}` : '';
        showToast(`已上传 ${ok} 个素材${tail}`, {
          type: failures.length > 0 ? 'warning' : 'success',
        });
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

  // 【TD-04-56】`handleRename` / `createFolder` 已收口到 `useInlineNameEditing`（见上方调用点）。
  // 原先此处与 GeneratedView 逐字重复约 35 行，两处唯一差异只有路径表达式与日志标签。

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
          items={folderPills.map((f) => ({ key: f.folder, label: f.label }))}
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
              // 【TD-04-56】未连引擎的守卫 + 初值一并收口到 hook（原先本段与 GeneratedView 逐字重复）
              onClick: editing.openCreate,
            },
          ]}
        />
      </PanelSubBar>

      {/* 新建文件夹 / 重命名 两条输入条（TD-04-56：收口到 useInlineNameEditing，与 GeneratedView 同一实现） */}
      {editing.renderInputs()}

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

      {/* 素材网格（每页 20 条，翻页见底部 `PagedFooter`；容器仅保留正常的溢出滚动） */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-2.5 mt-2">
        {!connected ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">
            请先连接本地引擎
          </div>
        ) : loading && items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">
            加载中...
          </div>
        ) : items.length === 0 && loadError ? (
          // 失败态**优先于**空态：否则"读失败"被读成"该目录暂无素材"（把缺失伪装成事实）。
          // 有陈旧 items 时不接管列表（保留可见内容），只在真正空屏时如实说明。
          <div className="h-full flex flex-col items-center justify-center text-faint text-sm gap-2">
            <div className="text-4xl opacity-40">⚠️</div>
            <p className="m-0 text-red-400">素材加载失败</p>
            <p
              className="text-xs text-subtle m-0 max-w-[240px] text-center break-all"
              title={loadError}
            >
              {loadError}
            </p>
            <button
              className="text-caption-sm text-red-400 hover:text-red-300 cursor-pointer border-none bg-transparent"
              onClick={() => void reset(true)}
            >
              点击重试
            </button>
          </div>
        ) : items.length === 0 ? (
          // 【TD-03-15】根空 → **如实说明素材在别处**（而非"该目录暂无素材"）：
          // 根 = 「尚未归类」区，而绝大部分行是系统产出（tasks/canvas，不在根里）
          // ⇒ 新库点开「全部」是空的、磁盘却躺着几千个文件，旧文案会让用户以为素材丢了。
          isEmptyLibraryRoot({
            folder: currentFolder,
            itemCount: items.length,
            loading,
            hasError: !!loadError,
          }) ? (
            <div className="h-full flex flex-col items-center justify-center text-faint text-sm gap-2 px-6">
              <div className="text-4xl opacity-40">📦</div>
              <p className="m-0">这里还没有待归类的素材</p>
              <p className="text-xs text-subtle m-0 text-center leading-relaxed">
                「全部」只显示尚未归类的素材。AI 生成的内容在「生成」里， 已归类的素材在 人物 / 场景
                / 道具 等目录里。
              </p>
              <p className="text-xs text-subtle m-0">上传或拖入文件即可出现在这里</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-faint text-sm gap-2">
              <div className="text-4xl opacity-40">📦</div>
              <p className="m-0">该目录暂无素材</p>
              <p className="text-xs text-subtle m-0">上传文件后会落盘到本地并出现在这里</p>
            </div>
          )
        ) : (
          <>
            {/* 列数随面板宽度自适应（`.pk-media-grid`，与「生成」tab 共用同一份规则） */}
            <div className="pk-media-grid">
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
                    ) : isVideoResource(a.type, a.url) ? (
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
                      <ResourceCardActions
                        item={a}
                        onOpenDir={handleOpenFileDir}
                        onRename={editing.openRename}
                        onDelete={handleDelete}
                      />
                    )}

                    {/* 底部名称 */}
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-meta text-white/80 truncate m-0">{a.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 底部固定翻页栏（与生成面板**同一实现**）。
          失败态由它承接（`pageError` + 重试 = 重跑当前页）：读者 = 用户，持续可见、可重试。 */}
      <PagedFooter
        label="素材"
        total={total}
        page={page}
        totalPages={totalPages}
        loading={loading}
        error={pageError}
        onRetry={() => void goPage(page)}
        onPage={goPage}
      />

      {/* 拖入高亮 */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400/50 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <span className="text-blue-300 text-sm">松开以上传素材</span>
        </div>
      )}

      {/* 全屏预览（文字/音频/图片 + 视频播放器）走与生成面板共用的唯一实现 */}
      <ResourcePreviewOverlay
        item={preview}
        onClose={() => setPreview(null)}
        assetDragProps={assetDragProps}
      />
    </div>
  );
}

export default React.memo(ResourceLibrary);
