/**
 * ImportMediaModal —— 可复用「导入媒体」弹窗（横切地基）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么是一个弹窗而不是两处各写一份（用户需求 2026-09-17）】
 * 两个入口共用本组件：
 *  · 入口 A：画布右键菜单「上传」（`canvasContextMenu.tsx`）
 *  · 入口 B：剪辑器素材面板「导入」（`videoEditor/.../assets/views/media.tsx`）
 * 界面**完全复用**（4 来源 tab + 卡片网格 + 底栏计数），差异只由宿主注入的 `onPick` 决定。
 *
 * 【样式复用（用户指定）】与 creative 创作库（风格/滤镜/运镜）**同一套视觉范式**：
 * 直接复用其 `creative-library.css` 的 `.cl-*` 类（顶栏文字 tab / 分类 pills / 卡片网格 /
 * 底栏计数）+ `panel-kit.css` 的 `.pk-*`。**不新造卡片组件**。
 *
 * 【分层（check-arch 规则 2）】本文件在 `base/panels/`，**只认 `MediaRef`**（base/media 形状），
 * 不 import 任何 `videoEditor` / `nodes` 等业务域。**"导入到哪"由宿主经 `onPick` 注入** ——
 * 画布注入"建 assetNode"，剪辑器注入 `linkMediaRefsToProject`。这样两边都合法且组件真复用。
 * ════════════════════════════════════════════════════════════════
 *
 * 【4 个来源分类（顺序由用户裁定 2026-09-17）】
 *  1. 本地导入 —— **写动作**（选文件/拖入），不是读来源 → 单独一条腿（不经 provider）
 *  2. 生成     —— `queryMediaRefs('generated')`（tasks 目录 = AI 产出）
 *  3. 素材库   —— `queryMediaRefs('library')`（用户目录）
 *  4. 画布     —— `queryMediaRefs('canvas')`（画布节点里的图/视频）
 *
 * 【第二层：来源内部的分类 + 文件夹拖拽归类（用户裁定 2026-09-17）】
 *  · 分类由 **provider 声明**（`categories()`），弹窗不硬编码（M3）；
 *  · 素材库「全部」= 精确 `migrated` 根（**尚未归类**的素材），其下子文件夹以**卡片**呈现；
 *  · 卡片是**拖拽落点**：把文件拖上去即归类（复用 `useResourceMoveToFolder.folderDropProps`），
 *    落点目录由卡片自身的 `folder/name` 派生 —— 动态（磁盘有什么显示什么），非硬编码清单。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, X, Search, FolderOpen } from 'lucide-react';
import '../creative/creative-library.css';
// 经唯一出口（`../media`）消费：它保证内置 provider 已自注册（漏走它会静默少来源）。
import { listMediaRefSources, queryMediaRefs } from '../media/index.ts';
import type { MediaRef, MediaRefSource } from '../media/mediaRefTypes.ts';
import LazyImage from '../ui/LazyImage.tsx';
// 「文件 → 文件夹卡片」的归类拖拽（唯一收敛点，非本弹窗自写）。
// ⚠️ 这是 base 层 import hooks 的**既有先例**（TaskCenter / GeneratedView 同样从 '../../../hooks' 取）。
import { useResourceMoveToFolder } from '../../../hooks/useResourceMoveToFolder.ts';

/** 本地导入 tab 的伪来源 key（它不是 provider，是写动作）。 */
const LOCAL_TAB = 'local' as const;
type ImportTab = typeof LOCAL_TAB | MediaRefSource;

/** tab 顺序（用户裁定：生成在素材库之前）。 */
const TAB_ORDER: ImportTab[] = ['local', 'generated', 'library', 'canvas'];

const TAB_LABEL: Record<ImportTab, string> = {
  local: '本地导入',
  generated: '生成',
  library: '素材库',
  canvas: '画布',
};

export interface ImportMediaModalProps {
  /** 关闭回调（宿主持有 open state）。 */
  onClose?: () => void;
  /** 当前画布项目 id（素材库/画布按项目过滤用）。 */
  projectId?: string;
  /**
   * 选中一批媒体后的落地动作（**宿主注入**）。
   * 返回已处理的 ref 数（供底栏提示）或 void。
   * 画布入口：建 assetNode；剪辑器入口：`linkMediaRefsToProject`。
   */
  onPick: (items: MediaRef[]) => void | Promise<void>;
  /** 本地导入：选文件后的落地动作（宿主注入；不传则隐藏本地 tab 的行为）。 */
  onLocalFiles?: (files: FileList) => void | Promise<void>;
}

export default function ImportMediaModal({
  onClose,
  projectId,
  onPick,
  onLocalFiles,
}: ImportMediaModalProps) {
  const [tab, setTab] = useState<ImportTab>('local');
  const [q, setQ] = useState('');
  const [catKey, setCatKey] = useState<string | null>(null);
  const [items, setItems] = useState<MediaRef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 已注册的 provider 来源（本地 tab 之外的 3 个）。
  const providerSources = useMemo(() => listMediaRefSources(), []);

  // 当前 tab 的分类（第二层筛选）—— 由 provider **声明**，弹窗不硬编码（M3 收口）。
  const categories = useMemo(
    () => (tab === LOCAL_TAB ? [] : (providerSources.find((p) => p.source === tab)?.categories?.() ?? [])),
    [tab, providerSources],
  );

  // 切 tab 时清空选择/搜索/分类（本地 tab 无需拉取）。
  useEffect(() => {
    setQ('');
    setCatKey(null);
    setSelected(new Set());
    setError(null);
    if (tab === LOCAL_TAB) {
      setItems([]);
      return;
    }
    let alive = true;
    setLoading(true);
    queryMediaRefs(tab, { projectId })
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((e) => {
        // 诚实错误态：provider 失败**不返回空数组冒充"没有"**（docs/136 §5.3）。
        if (alive) {
          setItems([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, projectId]);

  // 分类切换 → 带分类 query 重新拉取（分类 query 覆盖列表级 query）。
  const switchCategory = useCallback(
    (key: string) => {
      setSelected(new Set());
      setError(null);
      setCatKey(key);
      if (tab === LOCAL_TAB) return;
      const cat = categories.find((c) => c.key === key);
      setLoading(true);
      queryMediaRefs(tab, { ...(cat?.query ?? {}), projectId })
        .then(setItems)
        .catch((e) => {
          setItems([]);
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => setLoading(false));
    },
    [tab, categories, projectId],
  );

  // 关键词过滤（客户端；当前已加载页内 —— 与 provider 的诚实边界一致）。
  const visible = useMemo(() => {
    if (!q) return items;
    const k = q.toLowerCase();
    return items.filter((it) => it.name.toLowerCase().includes(k));
  }, [items, q]);

  // 文件夹卡片（落点）与媒体条目分开渲染：前者可拖入，后者可选中/导入。
  const folderCards = useMemo(() => visible.filter((it) => it.isFolder), [visible]);
  const mediaItems = useMemo(() => visible.filter((it) => !it.isFolder), [visible]);

  // 「文件 → 文件夹卡片」归类拖拽：复用唯一收敛点（不在此自写移动逻辑）。
  // 刷新 = 重新拉当前分类（归类后该文件应离开「全部」）。
  const refreshCurrent = useCallback(() => {
    if (tab === LOCAL_TAB) return;
    const cat = categories.find((c) => c.key === (catKey ?? 'all'));
    queryMediaRefs(tab, { ...(cat?.query ?? {}), projectId })
      .then(setItems)
      .catch(() => undefined); // catch-ok: NON_BLOCKING 归类后刷新失败不阻断（下次进入自然同步）
  }, [tab, categories, catKey, projectId]);
  const { sourceDragProps, folderDropProps } = useResourceMoveToFolder({
    onRefreshed: refreshCurrent,
  });

  const toggle = useCallback((ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    const picked = mediaItems.filter((it) => selected.has(it.ref));
    if (picked.length === 0) return;
    await onPick(picked);
    onClose?.();
  };

  const isLocal = tab === LOCAL_TAB;

  return (
    <div className="cl-card">
      {/* 顶栏：来源文字 tab + 搜索 + 关闭（沿用 creative 创作库的 .cl-tabs 语言） */}
      <div className="pk-head">
        <div className="cl-tabs" role="tablist" aria-label="导入来源">
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className="cl-tab"
              // 未注册的 provider 来源不显示（防"点了却永远空"）。
              style={
                t !== LOCAL_TAB && !providerSources.some((p) => p.source === t)
                  ? { display: 'none' }
                  : undefined
              }
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="pk-head-spacer" />
        {!isLocal && (
          <label className="cl-search cl-search-top">
            <Search size={13} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索当前来源" />
          </label>
        )}
        <button type="button" className="cl-icon-btn" onClick={onClose} title="关闭（Esc）">
          <X size={14} />
        </button>
      </div>

      {/* 副条：来源内部的**分类**（由 provider 声明 · 复用 creative 的分类 pills 语言）。
          无 categories 的来源（如「画布」）不显示本行。 */}
      {categories.length > 0 && (
        <div className="cl-sub">
          <div className="cl-subrow">
            <div className="pk-pills">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="pk-pill"
                  aria-pressed={catKey === c.key}
                  onClick={() => switchCategory(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 主体 */}
      <div className="cl-main">
        {isLocal ? (
          /* 本地导入 = 写动作：选文件 / 拖入。选完交宿主处理（画布建节点 / 剪辑器上传）。 */
          <div className="cl-col">
            <button
              type="button"
              className="cl-btn is-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={14} /> 选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void onLocalFiles?.(e.target.files);
                e.target.value = '';
              }}
            />
            {!onLocalFiles && <p className="cl-empty">当前入口不支持本地导入</p>}
          </div>
        ) : error ? (
          /* 诚实错误态（不静默成空） */
          <div className="cl-grid">
            <p className="cl-empty">加载失败：{error}</p>
          </div>
        ) : loading ? (
          <div className="cl-grid">
            <p className="cl-empty">加载中…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="cl-grid">
            <p className="cl-empty">没有可导入的媒体</p>
          </div>
        ) : (
          <>
            {/* 文件夹卡片（**拖拽落点**）：把下排文件拖到这里即归类。
                它们是 provider 从后端返回的 `type:'folder'` 条目 → **动态**（磁盘有什么显示什么）。 */}
            {folderCards.length > 0 && (
              <div className="cl-grid">
                {folderCards.map((it) => (
                  <article
                    key={it.ref}
                    className="cl-card-item is-add"
                    title={`拖入文件归类到「${it.name}」`}
                    {...folderDropProps(it)}
                  >
                    <FolderOpen size={26} className="text-muted" strokeWidth={1.4} />
                    <div className="cl-name">
                      <p>{it.name}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="cl-grid">
              {mediaItems.map((it) => (
                <article
                  key={it.ref}
                  className={`cl-card-item ${selected.has(it.ref) ? 'is-on' : ''}`}
                  title={it.name}
                  onClick={() => toggle(it.ref)}
                  // 可拖拽（归类到上方文件夹卡片）；与"点击选中导入"互不冲突
                  // （dragstart 才写移动 payload，单击不触发）。
                  // ⚠️ `draggable` 的类型是 `boolean|string`（历史实现，见 hook 注释），
                  // JSX 只接受 Booleanish → 用 `!!` 收窄（运行时语义不变：真值即 true）。
                  {...(() => {
                    const p = sourceDragProps({
                      folder: it.folder,
                      name: it.name,
                      url: it.url,
                      source: it.source,
                      type: it.type,
                      contentId: it.contentId,
                    });
                    return { ...p, draggable: !!p.draggable };
                  })()}
                >
                  {it.type === 'video' ? (
                    <video src={it.url} muted loop playsInline preload="metadata" />
                  ) : (
                    <LazyImage
                      src={it.thumbnailUrl || it.url}
                      alt={it.name}
                      className="absolute inset-0"
                    />
                  )}
                  <div className="cl-name">
                    <p>{it.name}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 底栏：计数 + 确认（非本地 tab） */}
      <div className="pk-list-foot">
        {isLocal ? (
          <span>从本机选择文件导入</span>
        ) : (
          <>
            <span>
              共 {mediaItems.length} 项 · 已选 {selected.size}
              {folderCards.length > 0 ? ` · 可拖入 ${folderCards.length} 个文件夹` : ''}
            </span>
            <button
              type="button"
              className="cl-btn is-primary"
              disabled={selected.size === 0}
              onClick={() => void handleConfirm()}
            >
              导入选中 {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
