/**
 * 视频剪辑器**基座**（常驻底部层）—— `docs/123` §二.3 G3/G5 卡 · `docs/120` C10 / C4 / C11 / C13。
 *
 * ── 形态铁律（改它之前先读这三条）──
 * 1. **常驻底部层，不是全屏层**：挂 `App` 根 flex 列的底部（`TopNav` 与画布之间**不覆盖**画布），
 *    **不用 `FullscreenShell` / 不用 portal / 不登记 `modalLayer`**（`docs/120` C10.1）。
 *    登记一次 → 画布快捷键全废、「画布点选素材入轨」这个**主入口**直接死掉。
 * 2. **非模态**：基座展开时画布仍可点选/拖节点（`docs/123` G3 人工验收项）。
 * 3. **键盘只让位三组键**（`docs/120` C10「关键区分」表）：Delete/Backspace · ⌘Z · ⌘⇧Z(⌘Y)。
 *    其余画布快捷键（Q/W/E、⌘A/D/G/L…）照旧 —— 判据与 `useCanvasShortcuts` **共用同一个
 *    `editorKeyAction()`**（判据单点，`docs/123` §二.6 G-3）。
 *
 * ── 两条入口（`docs/120` C4）──
 * · **顶栏按钮**（`TopNav`）：展开 / 收起基座。
 * · **画布上点选素材节点**（本文件 C11 段）：**仅基座展开时**生效，选中即落轨尾；
 *   折叠态点选**不产生任何动作**（C11.5 激活门 —— 「禁止静默副作用」的最终防线）。
 *
 * ── 未做的部分（诚实清单，别读成已完成；详见区域日志 §十六）──
 * 缩略图胶片条（C11.10）/ 真实波形（C11.7b）/ 走带出声（C11.7）/ 拖拽调长度（§0.4 粗档）/
 * 吸附（`snapTime` 已就位，但**没有拖拽消费方**）/ 带原声视频的 🔊 角标（C4.7 配套）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReactFlow, useStore, type Node } from '@xyflow/react';
import {
  ChevronDown,
  Lock,
  LockOpen,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react';
import { isEditableTarget } from '../../../base/core/uiHooks.ts';
import { editorKeyAction } from '../../../base/core/modalLayer.ts';
import { showToast } from '../../../base/core/toastStore.ts';
import { generateId } from '../../../base/core/idGen.ts';
import { useCanvasEdges } from '../../../base/canvas/CanvasEdgesContext.tsx';
import {
  deriveSelectedAssets,
  selectedAssetSig,
  selectedNodeIdsOfSig,
} from '../../../base/canvas/nodeMedia.ts';
import { spawnAndCommit } from '../../../base/canvas/deriveNodes.ts';
import { uploadResult } from '../../../base/utils/videoEngine.ts';
import { UPLOAD_DIRS } from '../../../base/utils/uploadDirs.ts';
import {
  clampZoom,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../../base/utils/timeline/timeScale.ts';
import { formatTickLabel } from '../../../base/utils/timeline/rulerTicks.ts';
import {
  appendTime,
  clipDuration,
  freezeFrameAt,
  removeClips,
  splitAt,
  timelineDuration,
  trimLeftAt,
  trimRightAt,
} from '../../core/timelineOps.ts';
import { routeClipToTrack } from '../../core/routeClip.ts';
import { DEFAULT_IMAGE_CLIP_DURATION } from '../../core/constants.ts';
import type { Clip, ClipKind, Track } from '../../core/types.ts';
import {
  planExport,
  runExport,
  type ExportRequest,
  type ExportStage,
} from '../../export/pipeline.ts';
import {
  loadEditorSource,
  readSourceBlob,
  useEditorSources,
} from '../../hooks/useEditorSources.ts';
import { useEditorProject } from './useEditorProject.ts';

/** 基座时间轴的固定缩放（像素/秒）。缩放交互属后续加粗功能；这里过 `clampZoom` 走同一取值域。 */
const DOCK_PPS = clampZoom(40);

/** 导出产物的节点尺寸（与 `VideoProcessNode` 的产物同款，C4.8「同型」）。 */
const EXPORT_NODE_STYLE = { width: 420, height: 380 };

/** 导出阶段的用户可读名（`docs/123` §一.5 O2 的三阶段）。 */
const STAGE_LABEL: Record<ExportStage, string> = {
  audio: '混音中',
  video: '渲染画面中',
  mux: '写入中',
};

interface VideoEditorDockProps {
  open: boolean;
  onClose: () => void;
  /** 工程随项目走（`docs/120` C2.6）；切换项目由 `App` 用 `key` 强制重挂载。 */
  projectId: string;
}

export default function VideoEditorDock({ open, onClose, projectId }: VideoEditorDockProps) {
  // 首次展开才加载（折叠不重载、也不丢状态）；常驻挂载 = 与 AgentPanel 同款（open 控显隐）
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  /* ── C4.5 硬断言：必须在 ReactFlowProvider 子树内 ──
   * 挂到 provider 之外时，导出回写（`spawnAndCommit`）会**静默失败且无任何报错**。
   * 故在挂载期就断言，不递延到「用户点了导出才发现没反应」。
   * （正常情况下 `useReactFlow()` 自己会先抛；本段是为了让失败**可读**：报出本仓的原因。） */
  const flow = useReactFlow();
  if (typeof flow?.setNodes !== 'function' || typeof flow?.getNodes !== 'function') {
    throw new Error(
      '视频剪辑器基座必须挂在 ReactFlowProvider 子树内：缺失该上下文时导出回写会静默失败（docs/120 C4.5）',
    );
  }
  const history = useCanvasEdges();

  const store = useEditorProject(projectId, everOpened);
  const project = store.project;
  const sources = useEditorSources(project);

  const openRef = useRef(open);
  const aliveRef = useRef(true);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const mainTrack = project?.tracks.find((t) => !t.overlay) ?? null;
  const mainClips = mainTrack?.clips ?? EMPTY_CLIPS;
  const allClips = useMemo(() => project?.tracks.flatMap((t) => t.clips) ?? [], [project]);
  const playhead = project?.playhead ?? 0;
  const totalDuration = project ? timelineDuration(project.tracks) : 0;
  const brokenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, state] of sources.byClipId) {
      if (state.resolved.status === 'broken') ids.add(id);
    }
    return ids;
  }, [sources.byClipId]);

  /* ════════════════════════════════════════════════════════════════
   * C11 · 入轨：在画布上点选素材节点 → 追加到对应类型轨尾
   * ════════════════════════════════════════════════════════════════ */

  /**
   * 选中集的**内容签名**（`base/canvas/nodeMedia` 既有原语，不含坐标 —— 拖动不触发重算）。
   *
   * 为什么用签名而不是订阅「选中事件」：入轨只在**选中集真变了**的那一次发生。
   * 签名比较天然满足 C11.4「点几次就上几条」——**取消选中再点它 = 签名变了 = 再上一条**。
   */
  const selectedSig = useStore((s) => selectedAssetSig(deriveSelectedAssets(s.nodes)));

  /**
   * 让入轨逻辑拿到**最新**的 flow / store，同时**不让它们进入 effect 依赖**。
   *
   * 为什么必须这样：`useEditorProject` **每次渲染都返回新的 store 对象** ⇒ 任何以它为依赖的
   * `useCallback` 每次都换身份 ⇒ 入轨 effect 每次渲染都跑。那正是下面这个缺陷的放大器。
   * 用 ref 传递「最新值」后，effect 的依赖只剩**选中集**与**开合**，运行次数与语义对上。
   */
  const flowRef = useRef(flow);
  const storeRef = useRef(store);
  useEffect(() => {
    flowRef.current = flow;
    storeRef.current = store;
  });

  /**
   * **已处理的选中集** —— 「已经为它入过轨」的 nodeId。
   *
   * 存「集合」而不是「上一个签名」：集合语义与「签名变没变」解耦，于是
   * `fresh = 本次签名里的 id − 已处理集合` 是**幂等**的 —— 多跑几次 effect 也只会入一次。
   */
  const handledRef = useRef<ReadonlySet<string>>(new Set());

  const enqueue = useCallback(
    async (nodeId: string) => {
      const asset = deriveSelectedAssets(flowRef.current.getNodes()).find(
        (a) => a.nodeId === nodeId,
      );
      if (!asset) return;
      const kind: ClipKind =
        asset.type === 'audio' ? 'audio' : asset.type === 'video' ? 'video' : 'image';

      // 时长必须先知道：**没有时长就没有片段** —— 这不是产品取舍，是数据结构的事实
      // （片段在时间轴上**只**由 `timelineStart + clipDuration` 存在）。
      const probed = await loadEditorSource(asset.url, kind);
      if (probed.source.resolved.status !== 'ok') {
        // 读不到就不入轨，并**明说原因**（C13：不静默产坏片）
        showToast(`素材读不到，未入轨：${probed.source.resolved.reason}`);
        return;
      }
      // 等待期间可能已折叠/切项目 —— 折叠态点选**不留痕**（C11.5），故此处直接放弃
      if (!aliveRef.current || !openRef.current) return;

      const clip: Clip = {
        id: generateId('clip'),
        kind,
        sourceUrl: asset.url,
        // `nodeId` 只作**只读溯源**，不参与寻址（`docs/123` §一.2 R2）
        nodeId: asset.nodeId,
        name: asset.label || undefined,
        size:
          probed.source.profile?.width !== undefined && probed.source.profile?.height !== undefined
            ? { width: probed.source.profile.width, height: probed.source.profile.height }
            : undefined,
        // C11.6：落轨用**源素材整段**（精确入出点是工作台的事）
        sourceStart: 0,
        sourceEnd: probed.source.duration ?? DEFAULT_IMAGE_CLIP_DURATION,
        timelineStart: 0,
      };

      const target = routeClipToTrack(clip.kind); // C11.1 分轨唯一判据
      let rejection: string | null = null;
      storeRef.current.applyTracks((tracks) =>
        tracks.map((t) => {
          if (t.kind !== target) return t;
          // C7.3：锁定轨禁止一切编辑 —— 入轨是编辑，故拒绝（且**明说**，不静默丢弃）
          if (t.locked) {
            rejection = `「${t.name}」已锁定，未入轨`;
            return t;
          }
          return { ...t, clips: [...t.clips, { ...clip, timelineStart: appendTime(t) }] };
        }),
      );
      if (rejection) showToast(rejection);
    },
    // 依赖为空 = 身份稳定 = 入轨 effect 只在**选中集真的变了**时跑（见文件头「点一次出两条」）
    [],
  );

  useEffect(() => {
    // **唯一真源**：该不该入轨，只看「本次签名声明的 id」与「已处理集合」的差。
    // 不再用 `flow.getNodes()` 另读一次当前选中集 —— 那次读与渲染期快照可能不一致，
    // 正是「同一次点选入轨两遍」的成因（回归测试 `dockEnqueue.test.tsx`）。
    const ids = selectedNodeIdsOfSig(selectedSig);
    const fresh = ids.filter((id) => !handledRef.current.has(id));
    // 折叠与否都要**跟上**已处理集，否则展开瞬间会把「折叠期间选中过」的节点补入轨
    handledRef.current = new Set(ids);
    // C11.5 激活门：折叠态**不留痕**
    if (!open) return;
    for (const id of fresh) void enqueue(id);
  }, [selectedSig, open, enqueue]);

  /* ════════════════════════════════════════════════════════════════
   * 编辑动作（工带）—— 全部经 `core/` 原语，能力判据直接问原语
   * ════════════════════════════════════════════════════════════════ */

  const applyMain = useCallback(
    (fn: (clips: Clip[]) => Clip[] | null) => {
      store.applyTracks((tracks) =>
        tracks.map((t) => {
          if (t.overlay) return t;
          const next = fn(t.clips);
          return next ? { ...t, clips: next } : t;
        }),
      );
    },
    [store],
  );

  const setPlayhead = useCallback(
    (t: number) => {
      store.applyProjectPatch({ playhead: Math.max(0, Math.min(totalDuration, t)) });
    },
    [store, totalDuration],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      // 输入框内不劫键（时间码输入框等）；Esc 不接管（C10.2）
      if (isEditableTarget(e)) return;
      const action = editorKeyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'undo') store.undo();
      else if (action === 'redo') store.redo();
      else if (action === 'delete' && selectedClipId) {
        applyMain((clips) => removeClips(clips, [selectedClipId], 'lift'));
      }
    },
    [open, store, selectedClipId, applyMain],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // 能力判据：**直接问原语**（不做第二套「能不能切」的推断），不可用即置灰 + tooltip（O3）
  const canSplit = splitAt(mainClips, playhead) !== null;
  const canTrimLeft = trimLeftAt(mainClips, playhead) !== null;
  const canTrimRight = trimRightAt(mainClips, playhead) !== null;
  const canDelete = selectedClipId !== null && mainClips.some((c) => c.id === selectedClipId);

  /* ════════════════════════════════════════════════════════════════
   * 导出（`docs/120` C4 / C5.6）—— G4 产出在此获得**生产消费者**
   * ════════════════════════════════════════════════════════════════ */

  /** 参与导出的片段 + 画像。**断链片段不入清单** —— 由 C13 预检条让用户知情，不静默跳过。 */
  const exportRequest = useMemo((): ExportRequest | null => {
    if (!project) return null;
    const sources2: ExportRequest['sources'] = [];
    const profiles = new Map<string, NonNullable<ClipProfile>>();
    for (const clip of allClips) {
      const state = sources.byClipId.get(clip.id);
      if (!state || state.resolved.status !== 'ok') continue;
      sources2.push({ clip, url: state.resolved.url });
      if (state.profile) profiles.set(clip.id, state.profile);
    }
    return { project, sources: sources2, profiles };
  }, [project, allClips, sources]);

  /** C5.1 / C5.6：走哪条路 + 为什么 —— **常驻可见**（不「悄悄掉画质」）。 */
  const plan = useMemo(() => (exportRequest ? planExport(exportRequest) : null), [exportRequest]);

  /** C12.2：M1 只做「如实显示」黑边，不假装能消掉（消黑边是 M2 的 fit 模式）。 */
  const letterbox = useMemo(() => {
    if (!project) return 'unknown' as const;
    const target = project.settings.width / Math.max(1, project.settings.height);
    const sized = allClips
      .map((c) => sources.byClipId.get(c.id)?.profile)
      .filter((p): p is ClipProfile => p?.width !== undefined && p?.height !== undefined);
    if (sized.length === 0) return 'unknown' as const;
    return sized.some(
      (p) => Math.abs((p.width as number) / Math.max(1, p.height as number) - target) > 0.01,
    )
      ? ('yes' as const)
      : ('no' as const);
  }, [project, allClips, sources]);

  /** url → 素材类别（导出端口取字节时需要，用于命中/补建探测缓存）。 */
  const kindByUrl = useMemo(() => {
    const map = new Map<string, ClipKind>();
    for (const clip of allClips) {
      const state = sources.byClipId.get(clip.id);
      if (state?.resolved.status === 'ok') map.set(state.resolved.url, clip.kind);
    }
    return map;
  }, [allClips, sources]);

  const [exporting, setExporting] = useState(false);
  const [exportStage, setExportStage] = useState<ExportStage | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  /** C4.1：导出**新建节点**（剪辑是破坏性的，覆盖会让原始素材在画布上无从找回）。 */
  const spawnAssetNode = useCallback(
    (url: string, name: string) => {
      // 落点 = 当前视窗中心（C4：**不依赖任何「锚点节点」**）
      const center = flow.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node: Node = {
        id: `export-${generateId('n')}`,
        type: 'assetNode',
        position: center,
        // C4.8：必须是**既有、可被下游消费**的节点形态 —— 与 `VideoProcessNode` 产物同款。
        // 字段名用 `assetUrl` 而非 `videoUrl`：`nodeMedia.getNodeMedia` 两者都认，
        // 但 `assetNode` 与全仓产物用的是 `assetUrl`；并存两个名就是「两名指一物」。
        data: { assetUrl: url, assetType: 'video', label: name, expanded: true },
        style: EXPORT_NODE_STYLE,
      };
      spawnAndCommit(
        { childNodes: [node], edges: [] },
        {
          getNodes: flow.getNodes,
          getEdges: flow.getEdges,
          setNodes: flow.setNodes,
          setEdges: flow.setEdges,
          history: history ?? undefined,
        },
      );
    },
    [flow, history],
  );

  const onExport = useCallback(async () => {
    if (!exportRequest || !plan) return;
    if (exportRequest.sources.length === 0) {
      showToast('时间轴上没有可导出的片段');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    setExportStage(null);
    setExportProgress(0);
    try {
      const outcome = await runExport(exportRequest, {
        signal: controller.signal,
        callbacks: { onStage: setExportStage, onProgress: setExportProgress },
        // 复用探测缓存里的字节（探测已读过一遍，导出不该再下一遍）
        ports: { fetchBlob: (url) => readSourceBlob(url, kindByUrl.get(url) ?? 'video') },
      });
      if (controller.signal.aborted) {
        showToast('导出已取消');
        return;
      }
      if (outcome.status === 'reject') {
        showToast(outcome.reason);
        return;
      }
      // C4.2：导出是异步的，期间用户可能切项目 / 关基座 —— 回写前复核，失效则丢弃并告知
      if (!aliveRef.current) {
        showToast('工程已切换，本次导出结果已丢弃');
        return;
      }
      const uploaded = await uploadResult(outcome.value.blob, {
        subfolder: UPLOAD_DIRS.videoEditor,
      });
      if (!aliveRef.current) {
        showToast('工程已切换，本次导出结果已丢弃');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      spawnAssetNode(uploaded.url, `剪辑_${stamp}.mp4`);
      // C4.3：如实告知音频去向，不让用户自己发现「怎么没声音」
      showToast(outcome.status === 'degraded' ? `导出完成，但${outcome.reason}` : '导出完成');
    } catch (e) {
      if (controller.signal.aborted) showToast('导出已取消');
      else showToast(`导出失败：${e instanceof Error ? e.message : '未知原因'}`);
    } finally {
      abortRef.current = null;
      setExporting(false);
      setExportStage(null);
    }
  }, [exportRequest, plan, kindByUrl, spawnAssetNode]);

  const trackAreaRef = useRef<HTMLDivElement | null>(null);

  return (
    <section
      aria-label="视频剪辑器"
      data-video-editor-dock
      className={`relative flex flex-col border-t border-border bg-surface-panel-2 text-primary ${open ? '' : 'hidden'}`}
      style={{ height: project?.ui.dockHeight ?? 280 }}
    >
      {/* ── 工带 ── */}
      <header className="flex items-center gap-2 px-3 h-10 border-b border-border text-xs">
        <button
          type="button"
          className="px-2 py-1 rounded hover:bg-surface-hover"
          title="收起剪辑器"
          onClick={onClose}
        >
          <ChevronDown size={14} />
        </button>
        <span className="tabular-nums font-medium">{formatTickLabel(playhead, 1)}</span>
        <span className="opacity-50">/</span>
        <span className="tabular-nums opacity-70">{formatTickLabel(totalDuration, 1)}</span>

        <span className="w-px h-4 bg-border mx-1" />

        <DockAction
          icon={<Scissors size={14} />}
          label="分割"
          enabled={canSplit}
          disabledHint="把播放头移到片段内部再分割"
          onClick={() => applyMain((clips) => splitAt(clips, playhead))}
        />
        <DockAction
          icon={<Scissors size={14} className="-scale-x-100" />}
          label="裁左"
          enabled={canTrimLeft}
          disabledHint="把播放头移到片段内部"
          onClick={() => applyMain((clips) => trimLeftAt(clips, playhead))}
        />
        <DockAction
          icon={<Scissors size={14} />}
          label="裁右"
          enabled={canTrimRight}
          disabledHint="把播放头移到片段内部"
          onClick={() => applyMain((clips) => trimRightAt(clips, playhead))}
        />
        <DockAction
          icon={<span className="text-[11px]">⏸</span>}
          label="定格"
          enabled={canSplit}
          disabledHint="把播放头移到片段内部"
          onClick={() =>
            applyMain(
              (clips) => freezeFrameAt(clips, playhead, DEFAULT_IMAGE_CLIP_DURATION)?.clips ?? null,
            )
          }
        />

        <span className="w-px h-4 bg-border mx-1" />

        <DockAction
          icon={<Trash2 size={14} />}
          label="删除(留洞)"
          enabled={canDelete}
          disabledHint="先选中一个片段"
          onClick={() =>
            applyMain((clips) =>
              selectedClipId ? removeClips(clips, [selectedClipId], 'lift') : null,
            )
          }
        />
        <DockAction
          icon={<Trash2 size={14} />}
          label="删除(波纹)"
          enabled={canDelete}
          disabledHint="先选中一个片段"
          onClick={() =>
            applyMain((clips) =>
              selectedClipId ? removeClips(clips, [selectedClipId], 'ripple') : null,
            )
          }
        />

        <span className="ml-auto" />

        <DockAction
          icon={<Undo2 size={14} />}
          label="撤销"
          enabled={store.canUndo}
          disabledHint="没有可撤销的编辑"
          onClick={store.undo}
        />
        <DockAction
          icon={<Redo2 size={14} />}
          label="重做"
          enabled={store.canRedo}
          disabledHint="没有可重做的编辑"
          onClick={store.redo}
        />

        <span className="w-px h-4 bg-border mx-1" />

        {/* 导出 + 阶段进度（`docs/123` §一.5 O2：长任务要能看出卡在哪一步） */}
        <div className="flex items-center gap-2">
          {exporting && (
            <span className="tabular-nums opacity-70">
              {STAGE_LABEL[exportStage ?? 'audio']} {Math.round(exportProgress * 100)}%
            </span>
          )}
          <button
            type="button"
            disabled={exporting || allClips.length === 0}
            title={exporting ? '导出中…' : '导出为画布节点'}
            onClick={() => void onExport()}
            className={`px-2 py-1 rounded ${
              exporting || allClips.length === 0
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-surface-hover'
            }`}
          >
            导出
          </button>
          {exporting && (
            <button
              type="button"
              className="px-2 py-1 rounded hover:bg-surface-hover"
              onClick={() => abortRef.current?.abort()}
            >
              取消
            </button>
          )}
        </div>
      </header>

      {/* ── C5.6：导出前信息**常驻**（路径 / 工程参数 / 黑边 / 音频出口），不弹预检窗 ── */}
      {project && (
        <div className="px-3 py-1 text-[11px] opacity-70 truncate" data-export-info>
          {plan?.reason ?? '正在判断导出路径…'}
          <span className="mx-1">·</span>
          {project.settings.width}×{project.settings.height}
          <span className="mx-1">·</span>
          {project.fps}fps
          <span className="mx-1">·</span>
          {letterbox === 'yes'
            ? '成片会有黑边（片段比例 ≠ 工程比例）'
            : letterbox === 'no'
              ? '无黑边'
              : '片段尺寸未探测，可能带黑边'}
          <span className="mx-1">·</span>
          音频出口 AAC 48kHz
        </div>
      )}

      {/* ── C13：断链预检 —— 只有**真的需要决策**时才拦一次（其余信息常驻，见上） ── */}
      {brokenIds.size > 0 && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger" data-broken-banner>
          有 {brokenIds.size} 个片段素材读不到 —— 导出会**跳过**这些片段，其余照常。
        </div>
      )}

      {/* ── 状态条：冲突 / 失败 / 加载（诚实可见，不静默）── */}
      {store.conflict && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger flex items-center gap-2">
          工程已在别处更新，本次改动**未落盘**（本地改动保留）。
          <button type="button" className="underline" onClick={store.reload}>
            重新加载
          </button>
        </div>
      )}
      {store.status === 'failed' && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger">
          工程读取失败：{store.reason ?? '未知原因'}
        </div>
      )}

      {/* ── 轨道区 ── */}
      <div
        ref={trackAreaRef}
        className="relative flex-1 overflow-x-auto"
        onPointerDown={(e) => {
          // 点轨道区 = 移动播放头（D 组换算原语的消费点）
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          setPlayhead(xToTime(e.clientX - rect.left + e.currentTarget.scrollLeft, DOCK_PPS, 0));
        }}
      >
        {store.status === 'loading' && <div className="p-3 text-xs opacity-60">正在加载工程…</div>}

        {project?.tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            selectedClipId={selectedClipId}
            brokenIds={brokenIds}
            onSelectClip={setSelectedClipId}
            onToggle={(patch) =>
              store.applyTracks((tracks) =>
                tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)),
              )
            }
          />
        ))}

        {/* 播放头 */}
        {project && (
          <div
            className="absolute top-0 bottom-0 w-px bg-danger pointer-events-none"
            style={{ left: timeToX(playhead, DOCK_PPS, 0) }}
          />
        )}
      </div>
    </section>
  );
}

/** 空片段数组的稳定引用（避免每次渲染新建数组导致下游 memo 失效）。 */
const EMPTY_CLIPS: Clip[] = [];

/** 探测画像的窄类型（`MediaProfile` 的形状；此处不自造新类型，只做局部别名便于可空收窄）。 */
type ClipProfile = { width?: number; height?: number; mimeType?: string };

/** 工带按钮：不可用时**置灰 + tooltip 说明为什么**（`docs/123` §一.5 O3：不可用状态 ≠ 刚发生的动作）。 */
function DockAction({
  icon,
  label,
  enabled,
  disabledHint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  enabled: boolean;
  disabledHint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? label : disabledHint}
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded ${
        enabled ? 'hover:bg-surface-hover' : 'opacity-40 cursor-not-allowed'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** 一条轨：轨道头（名 + 三状态）+ 片段条。 */
function TrackRow({
  track,
  selectedClipId,
  brokenIds,
  onSelectClip,
  onToggle,
}: {
  track: Track;
  selectedClipId: string | null;
  brokenIds: Set<string>;
  onSelectClip: (id: string) => void;
  onToggle: (patch: Partial<Pick<Track, 'locked' | 'hidden' | 'muted'>>) => void;
}) {
  return (
    <div className="flex items-stretch border-b border-border" data-track-id={track.id}>
      <div className="w-28 shrink-0 flex items-center gap-1 px-2 py-1 text-xs border-r border-border">
        <span className="truncate">{track.name}</span>
        <button
          type="button"
          className="ml-auto opacity-70 hover:opacity-100"
          title={track.locked ? '解锁' : '锁定'}
          onClick={() => onToggle({ locked: !track.locked })}
        >
          {track.locked ? <Lock size={12} /> : <LockOpen size={12} />}
        </button>
        <button
          type="button"
          className="opacity-70 hover:opacity-100"
          title={track.hidden ? '显示' : '隐藏'}
          onClick={() => onToggle({ hidden: !track.hidden })}
        >
          {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          type="button"
          className="opacity-70 hover:opacity-100"
          title={track.muted ? '取消静音' : '静音'}
          onClick={() => onToggle({ muted: !track.muted })}
        >
          {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      </div>

      <div className="relative flex-1 h-10 min-w-full">
        {track.clips.map((clip) => {
          const broken = brokenIds.has(clip.id);
          return (
            <button
              key={clip.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectClip(clip.id);
              }}
              className={`absolute top-1 bottom-1 rounded border text-[11px] truncate px-1 text-left ${
                broken
                  ? 'border-danger bg-danger/30 text-danger'
                  : selectedClipId === clip.id
                    ? 'border-danger bg-danger/20'
                    : 'border-border bg-surface-panel'
              }`}
              style={{
                left: timeToX(clip.timelineStart, DOCK_PPS, 0),
                width: Math.max(2, timeDeltaToPx(clipDuration(clip), DOCK_PPS)),
              }}
              // C13：断链是**持续状态**（红标 + 原因），不是一次性 toast
              title={
                broken
                  ? `${clip.name ?? clip.id} · 素材已失效`
                  : `${clip.name ?? clip.id} · ${clipDuration(clip).toFixed(2)}s`
              }
            >
              {clip.name ?? clip.kind}
            </button>
          );
        })}
      </div>
    </div>
  );
}
