import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Clapperboard,
  Play,
  Pause,
  Scissors,
  Trash2,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Plus,
  AlertCircle,
  X as XIcon,
} from 'lucide-react';
import { useReactFlow, type Node } from '@xyflow/react';
import NodeShell from '../base/ui/NodeShell.tsx';
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts';
import { useNodeRename } from '../../hooks/useNodeRename.ts';
import { patchNodeDataById } from '../../hooks/useNodeData.ts';
import { classifyAssetUrlKind } from '../base/utils/assetType.ts';
import { ASSET_NODE_SIZE } from '../base/canvas/nodeDefaults.ts';
import {
  pxDeltaToTime,
  snapTime,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../base/utils/timeline/timeScale.ts';
import { useAssetDegrade } from '../../hooks/useAssetDegrade.ts';
import { useNodeResize } from '../base/core/uiHooks.ts';
import { useCanvasKeydown } from '../base/core/canvasHotkeys.ts';
import { showToast } from '../base/core/toastStore.ts';
// 【TD-22-64 · 2026-09-18】时长显示唯一实现：此前本文件自持一份 `formatDuration`，
// 与 videoEditor/ui/…/media.tsx 的同名实现重复，且多一个「非有限 → '0:00'」的发明值。
import { formatDuration } from '../base/core/utils.ts';
import { logger } from '../base/core/logger.ts';
import { classifyError } from '../base/utils/genErrors.ts';
import { withTimeout, isTimeoutError, releaseQuietly } from '../base/utils/asyncGuard.ts';
import type { ProcessVideoOptions } from '../base/utils/videoEngine.ts';
import {
  readVideoMetadata,
  processVideo,
  concatVideos,
  videoToGif,
  formatBytes,
  uploadResult,
  ProgressController,
  ConversionCanceled,
} from '../base/utils/videoEngine.ts';
import { generateId } from '../base/core/idGen.ts';
import { buildSpawnNodes, spawnAndCommit } from '../base/canvas/deriveNodes.ts';
import { useCanvasEdges } from '../base/canvas/CanvasEdgesContext.tsx';
import { httpRequest, uploadFileToLocal } from '../base/api/index.ts';
import { updateNodeRuntime, useNodeRuntime } from '../base/store/nodeRuntimeStore.ts';
import previewUrls from '../base/utils/previewUrl.ts';
import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts';
import { DOWNLOAD_TIMEOUT, VIDEO_DOWNLOAD_TIMEOUT } from '../base/core/config.ts';
import { createRafBatch, fileNameFromUrl } from '../base/core/utils.ts';
import { sourceTimeAt, timelineTimeAt } from '../base/utils/timeline/sourceTime.ts';
import { captureFrame } from '../base/utils/captureFrame.ts';

/* ════════════════════════════════════════════════════════════════
 * 视频处理节点（复刻官方 Gc.jsx + fc.jsx 合并的 videoProcessNode）
 *
 * 五种模式（tab）：
 *  - trim          视频截取（时间轴修剪：入点[ 出点] 分割S 删除Delete，拖动片段/入出点）
 *  - extractAudio  提取音频（m4a / wav / mp3）
 *  - sizeFrameRate 尺寸帧率（480p/720p/1080p 预设 + 宽高 + fps）
 *  - concat        视频拼接（多轨时间线，片段拖动 + 轨道静音 + 新增轨道 + 导出顺序）
 *  - toGif         视频转 GIF（清晰度/帧率/速度/色彩 + 裁剪区间，gifenc 编码）
 *
 * 引擎：mediabunny（WebCodecs）做 trim/extractAudio/sizeFrameRate/concat；
 * gifenc 做视频转 GIF。上传用本地 object URL。
 *
 * 视频来源：上传文件 或 连接上游（connected.videos / images 里的视频）。
 * 端口：target(左) + source main-output(右)。
 * ════════════════════════════════════════════════════════════════ */

const MODES = [
  { value: 'trim', label: '视频截取' },
  { value: 'extractAudio', label: '提取音频' },
  { value: 'sizeFrameRate', label: '尺寸帧率' },
  { value: 'concat', label: '视频拼接' },
  { value: 'toGif', label: '视频转GIF' },
];
const AUDIO_FORMATS = [
  { value: 'm4a', label: 'M4A', hint: '体积小' },
  { value: 'wav', label: 'WAV', hint: '无损' },
  { value: 'mp3', label: 'MP3', hint: '通用' },
];
const SIZE_PRESETS = [
  { label: '480p', width: 854, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];
const FPS_OPTIONS = [24, 25, 30, 60];
const GIF_SIZES = [240, 360, 480, 640, 720]; // 清晰度（复刻官方 oc）
const GIF_FPS = [0.5, 1, 2, 3, 5, 8, 10, 12, 15, 20]; // 帧率（复刻官方 sc）
const GIF_SPEEDS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];
const GIF_COLORS = [
  { label: '高清 (256色)', value: 256 },
  { label: '标准 (128色)', value: 128 },
  { label: '压缩 (64色)', value: 64 },
];

const PX_PER_SEC = 36; // 时间线像素比例

const normalizeMode = (m: string): string => {
  if (m === 'resize' || m === 'frameRate') return 'sizeFrameRate';
  if (
    m === 'trim' ||
    m === 'extractAudio' ||
    m === 'sizeFrameRate' ||
    m === 'concat' ||
    m === 'toGif'
  )
    return m;
  return 'trim';
};
const stripExt = (name: string): string => (name || '').replace(/\.[^.]+$/, '') || 'video';
const evenRound = (v: number): number => Math.max(2, Math.round(v / 2) * 2);
const round2 = (v: number): number => Number(v.toFixed(2));
/**
 * 生成「带前缀的随机 id」。
 *
 * ⚠️【TD-21-23 · 2026-09-16】**只准用于"用户一次性动作"**（拆分片段 / 新建轨道 ——
 * 每次点击本来就该产生一个新实体，随机才是对的）。
 * **禁止**在 `useMemo` / 其它**纯派生**里使用：纯派生要求"同输入 → 同输出"，
 * 随机 id 会让**同一份数据每次重算都换一批身份** ⇒ 下游按 id 记的选中态 / React key 全部失效。
 * 实测后果：`:628` 的「选中片段」effect 每次重算都认不出 selectedClipId ⇒ 反复 setState
 * ⇒ 若触发重算的引用变化是持续性的，即构成**无限渲染循环**（vitest 永久挂死 + CPU 空转）。
 * 派生场景请按「来源标识」确定性拼 id（例：自动补片段 = `clip-auto-${sourceId}`）。
 */
const makeId = (p: string): string => `${p}-${generateId('v')}`;
const nameFromUrl = (url: string): string => {
  if (url.startsWith('data:')) return 'video.mp4';
  if (url.startsWith('blob:')) return 'local-video.mp4';
  // TD-16-14：文件名提取统一走 core/utils 唯一原语（URL 解析自动剥 ?# + decode 一次）
  return fileNameFromUrl(url) || 'video.mp4';
};

/** 连接源 → 名称（复刻官方 Lc） */
const sourceName = (node: Node, url: string): string => {
  const d = node?.data as Record<string, unknown> | undefined;
  const n = d?.sourceVideoName || d?.videoName || d?.fileName || d?.label || node?.id;
  return typeof n === 'string' && n ? n : nameFromUrl(url);
};

/** GIF 生成结果信息（官方 fc.jsx resultInfo） */
interface GifResultInfo {
  width: number;
  height: number;
  frameCount: number;
  size: number;
}

/**
 * 视频处理节点 data 契约。
 * 【2026-09-11】原「宽松接口 + `[key: string]: unknown` 兜底」已删：索引签名会让写错字段名
 * （如 `outputInfo` 漏声明）不报错，实测本节点字段已全部显式列出、删索引签名零编译错误。
 * 新增字段请在此登记（`npm run check:node-data` 会对账 interface ↔ palette ↔ 实际写入）。
 */
interface VideoProcessNodeData {
  label?: string;
  mode?: string;
  audioFormat?: string;
  resizeWidth?: number;
  resizeHeight?: number;
  targetFps?: number;
  gifMaxSize?: number;
  gifFps?: number;
  gifSpeed?: number;
  gifColors?: number;
  gifStart?: number;
  gifEnd?: number;
  gifDuration?: number;
  gifCrop?: unknown;
  gifResult?: GifResultInfo | null;
  // 注：progress / loading 声明已删（2026-09-11 数据体检）——瞬态已收口到 nodeRuntimeStore，
  // node.data 只留持久字段（spec/CONTEXT.md §二④b / §五）；此文件内已无 data.progress/data.loading 读取。
  errorMessage?: string;
  sourceVideoUrl?: string;
  sourceVideoName?: string;
  sourceMetadata?: Record<string, SourceMeta>;
  timelineTracks?: TimelineTrack[];
  /** 轨道中 video 片段引用的源 id 顺序（updateTracks 时随 timelineTracks 一起写回） */
  sourceOrder?: string[];
  /** 最近一次产出的文件名（与 outputInfo 一起写回，供下游子节点/下载复用） */
  outputName?: string;
  /** 最近一次产出的媒体元信息（写回时由 result.metadata 组装） */
  outputInfo?: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    size?: number;
  };
}

/** 视频源元信息（sourceMetadata 条目）：时长/分辨率/帧率等，字段宽松可空 */
export interface SourceMeta {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  [key: string]: unknown;
}

/** 时间线片段：sourceId 引源、duration/start/end 为时间窗（字段来自外部导入数据，宽松可空） */
export interface TimelineClip {
  sourceId?: string | number;
  duration?: number;
  start?: number;
  end?: number;
  sourceStart?: number;
  sourceEnd?: number;
  timelineStart?: number;
  [key: string]: unknown;
}

/** 时间线轨道：kind/type 区分视频/音频，clips/segments 承载片段 */
export interface TimelineTrack {
  id?: string | number;
  kind?: string;
  type?: string;
  name?: string;
  label?: string;
  muted?: boolean;
  clips?: TimelineClip[];
  segments?: TimelineClip[];
  [key: string]: unknown;
}

/** 节点内部渲染用片段/轨道：具名字段显式声明（保留 [key:string]:unknown 索引以兼容写入 timelineTracks），
 *  id 归一为 string。必须显式声明具名字段——用 TimelineClip 交叉会因索引签名让 id/sourceStart 等读成 unknown。 */
interface VClip {
  id: string;
  sourceId?: string | number;
  sourceUrl?: string;
  url?: string;
  name?: string;
  duration?: number;
  sourceStart?: number;
  sourceEnd?: number;
  // 【2026-09-19 · TD-21-24】**必填**：`VClip` 只由 `tracks` 这个 useMemo 产出，而它**恒赋值**
  // （`:416` 取自 `cl.timelineStart ?? cursor`、`:455` 取自 `base`）⇒ 归一化后**不可能缺失**。
  // 此前声明为可选，导致下游 6 处 `?? 0` 兜底——它们**永远走不到**，却让每个读者以为"这里可能没有"；
  // 且"缺失时按 0 / 按 cursor / 不兜底"三种口径互相矛盾（债）。
  // 现把不变量下沉到**类型层**（真护栏）：将来谁产出不带 `timelineStart` 的 `VClip`，**TS 直接报错**。
  // ⚠️ 与 `TimelineClip.timelineStart?: number` 的区别**是刻意的**：那是**持久化/外部导入**形状，
  // 字段确实可能缺 ⇒ 归一化点的 `?? cursor`（`:404`）**可达且必须保留**。
  timelineStart: number;
  muted?: boolean;
  trackId?: string;
  [key: string]: unknown;
}
interface VTrack {
  id: string;
  kind?: string;
  type?: string;
  name?: string;
  label?: string;
  muted?: boolean;
  clips: VClip[];
  segments?: VClip[];
  [key: string]: unknown;
}

interface VideoProcessNodeProps {
  id: string;
  data: VideoProcessNodeData;
  selected?: boolean;
}

function VideoProcessNode({ id, data, selected }: VideoProcessNodeProps) {
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow();
  // 标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随），单一实现收口到 useNodeRename
  const rename = useNodeRename(id);
  const history = useCanvasEdges();
  const { isHidden } = useAssetDegrade();
  const { onMainBoxResize: _onMainBoxResize } = useNodeResize(id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  /* ---------- 状态（复刻官方 1-41 行） ---------- */
  const [mode, setMode] = useState(() => normalizeMode(data.mode ?? ''));
  const [audioFormat, setAudioFormat] = useState(data.audioFormat || 'm4a');
  const [resizeWidth, setResizeWidth] = useState(data.resizeWidth ?? 1280);
  const [resizeHeight, setResizeHeight] = useState(data.resizeHeight ?? 720);
  const [targetFps, setTargetFps] = useState(data.targetFps ?? 30);
  // GIF 参数（复刻官方 fc.jsx：o fps=10 / c maxSize=480 / u colors=256 / f speed=1 / m,g,v 裁剪）
  const [gifFps, setGifFps] = useState(data.gifFps ?? 10);
  const [gifMaxSize, setGifMaxSize] = useState(data.gifMaxSize ?? 480);
  const [gifColors, setGifColors] = useState(data.gifColors ?? 256);
  const [gifSpeed, setGifSpeed] = useState(data.gifSpeed ?? 1);
  const [gifCrop, setGifCrop] = useState(data.gifCrop ?? 0); // m
  const [gifStart, setGifStart] = useState(data.gifStart ?? 0); // g
  const [gifEnd, setGifEnd] = useState(data.gifEnd ?? 0); // v
  const [gifDuration, setGifDuration] = useState(data.gifDuration ?? 0); // h（视频总时长）
  const [gifResult, setGifResult] = useState(data.gifResult || null); // E（resultInfo）
  const [sourceMetadata, setSourceMetadata] = useState(data.sourceMetadata || {});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null); // F
  const [playheadTime, setPlayheadTime] = useState(0); // j
  const [isPlaying, setIsPlaying] = useState(false); // N
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({}); // ee {sourceId:[url]}
  const [editingClipId, setEditingClipId] = useState<string | null>(null); // k
  const [timelineTracks, setTimelineTracks] = useState(data.timelineTracks || []);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage || '');

  // refs
  const videoRef = useRef<HTMLVideoElement | null>(null); // u
  const scrubRef = useRef<HTMLDivElement | null>(null); // d
  // P3：scrub 手势期 { batch, rect } —— batch 是 createRafBatch 的包装函数（可调用 + flush）。
  const scrubDrag = useRef<{
    batch: ((x: number) => void) & { flush: () => void };
    rect?: DOMRect;
  } | null>(null);
  const metaInFlight = useRef<Set<string>>(new Set()); // f
  const thumbUrls = useRef<string[]>([]); // p
  const isScrubbing = useRef(false); // m
  const controllerRef = useRef<ProgressController | null>(null); // c（ProgressController 实例，能力面由 videoEngine 决定）
  const abortRef = useRef<AbortController | null>(null); // l
  const timelineWrapRef = useRef<HTMLDivElement | null>(null); // Ne

  /* ---------- 输入源（复刻官方 42-89 行） ---------- */
  const connected = useConnectedInputs(id);
  // 连接源：videos + images 里的视频
  const connectedSources = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const v of connected.videos || []) {
      if (!v?.url) continue;
      if (seen.has(v.url)) continue;
      seen.add(v.url);
      list.push({ url: v.url });
    }
    for (const im of connected.images || []) {
      if (!im?.url) continue;
      const u = im.url;
      // 视频判定统一走 assetType.classifyAssetUrlKind（含 data:video/ 前缀与 ?# 处理）；
      // blob: 是本节点自身处理产出的视频 URL（无扩展名），显式保留
      if (u.startsWith('blob:') || classifyAssetUrlKind(u) === 'video') {
        if (seen.has(u)) continue;
        seen.add(u);
        list.push({ url: u });
      }
    }
    return list;
  }, [connected]);

  // 连接源对象（sourceId = url 去重后的唯一标识）
  const ne = useMemo(() => {
    const srcNodes = new Map();
    for (const n of getNodes()) {
      for (const v of connected.videos || []) if (v.url && n.id === v.id) srcNodes.set(v.url, n);
      for (const im of connected.images || [])
        if (im.url && n.id === im.id) srcNodes.set(im.url, n);
    }
    const map = new Map();
    for (const s of connectedSources) {
      if (map.has(s.url)) continue;
      const node = srcNodes.get(s.url);
      map.set(s.url, { sourceId: s.url, url: s.url, name: sourceName(node, s.url) });
    }
    return Array.from(map.values());
  }, [connectedSources, connected.videos, connected.images, getNodes]);

  // 注入视频源（外部预置 data.sourceVideoUrl，无上游连线时生效）
  const localSource = useMemo(() => {
    if (data.sourceVideoUrl && ne.length === 0) {
      return {
        sourceId: `local-${id}`,
        url: data.sourceVideoUrl,
        name: data.sourceVideoName || nameFromUrl(data.sourceVideoUrl),
      };
    }
    return null;
  }, [data.sourceVideoUrl, data.sourceVideoName, ne.length, id]);

  // 全部源
  const sources = useMemo(() => {
    if (localSource) return [...ne, localSource];
    return ne;
  }, [ne, localSource]);

  /* ---------- 时间线轨道（复刻官方 Wc） ---------- */
  const tracks = useMemo((): VTrack[] => {
    const sourceMap = new Map(sources.map((s) => [s.sourceId, s]));
    const usedSourceIds = new Set();
    const built = (timelineTracks || []).map((tr, idx) => {
      const kind = tr.kind || tr.type || 'video';
      const trackId = tr.id != null ? String(tr.id) : `${kind}-track-${idx + 1}`;
      let cursor = 0;
      const clips = (tr.clips || tr.segments || []).map((cl, ci) => {
        const src = sourceMap.get(cl.sourceId);
        const dur =
          sourceMetadata[cl.sourceId ?? '']?.duration || cl.duration || cl.sourceEnd || cl.end || 0;
        const start = Math.max(0, cl.sourceStart ?? cl.start ?? 0);
        let end = cl.sourceEnd ?? cl.end ?? 0;
        if ((end === 0 || end === cl.duration) && dur > 0 && (cl.duration || 0) === 0) end = dur;
        const validEnd =
          Number.isFinite(end) && end < Number.MAX_SAFE_INTEGER ? Math.min(end, dur || end) : dur;
        usedSourceIds.add(cl.sourceId);
        const clipDur = Math.max(0, validEnd - start);
        const tlStart = cl.timelineStart ?? cursor;
        cursor = tlStart + clipDur;
        return {
          // 【TD-21-23】持久片段缺 id 时的回退必须**确定性**（按"轨道序号+片段序号"派生）：
          // 本 useMemo 每次重算都会走到这里，随机 id 会让同一份 timelineTracks 每次换身份。
          id: cl.id != null ? String(cl.id) : `clip-${idx}-${ci}`,
          sourceId: cl.sourceId,
          url: src?.url || cl.url || cl.sourceUrl || '',
          name: src?.name || cl.name || cl.sourceName || '视频片段',
          sourceStart: start,
          sourceEnd: Math.max(start, validEnd),
          duration: clipDur,
          timelineStart: tlStart,
          muted: !!cl.muted,
          trackId,
        };
      });
      return {
        id: trackId,
        name: tr.name || tr.label || `${kind === 'video' ? '视频' : '音频'} ${idx + 1}`,
        kind,
        clips,
        muted: !!tr.muted,
      };
    });
    // 确保有视频轨道
    let videoTrack = built.find((t) => t.kind === 'video');
    if (!videoTrack) {
      videoTrack = { id: 'video-track-1', name: '视频 1', kind: 'video', clips: [], muted: false };
      built.push(videoTrack);
    }
    // 把有元数据的未用源自动加入视频轨（复刻官方 5443-5466）
    for (const s of sources) {
      if (usedSourceIds.has(s.sourceId)) continue;
      const dur = sourceMetadata[s.sourceId]?.duration || 0;
      if (dur === 0) continue;
      const base =
        videoTrack.clips.length > 0
          ? Math.max(...videoTrack.clips.map((c) => c.timelineStart + c.duration))
          : 0;
      videoTrack.clips.push({
        // 【TD-21-23】自动补的片段：id 由 sourceId **确定性派生**（同一源 → 恒等 id）。
        // 原为 `makeId('clip')`（随机）⇒ 本 useMemo 一旦重算就换一批新 id ⇒ `:628` 的选中态 effect
        // 认不出 selectedClipId ⇒ setSelectedClipId ⇒ 渲染 ⇒ 重算……（引用持续不稳时即无限循环）。
        id: `clip-auto-${s.sourceId}`,
        sourceId: s.sourceId,
        url: s.url,
        name: s.name,
        sourceStart: 0,
        sourceEnd: dur,
        duration: dur,
        timelineStart: base,
        muted: false,
        trackId: videoTrack.id,
      });
    }
    return built;
  }, [timelineTracks, sources, sourceMetadata]);

  /* 选中片段 + 其所在轨道（复刻官方 ie） */
  const selectedClipInfo = useMemo(() => {
    for (const tr of tracks) {
      const clip = tr.clips.find((c) => c.id === selectedClipId);
      if (clip) return { track: tr, clip };
    }
    return null;
  }, [selectedClipId, tracks]);

  // 可见视频片段（导出用，复刻官方 ae）：按 timelineStart 排序
  const exportClips = useMemo(
    () =>
      tracks
        .filter((t) => t.kind === 'video')
        .flatMap((t) =>
          [...t.clips]
            .sort((a, b) => a.timelineStart - b.timelineStart)
            .filter((c) => c.url && (c.duration ?? 0) > 0)
            .map((c) => ({ ...c, muted: !!t.muted || c.muted })),
        ),
    [tracks],
  );

  const firstVideoClip = tracks.find((t) => t.kind === 'video')?.clips[0]; // oe
  const currentClip = selectedClipInfo?.clip || firstVideoClip; // H
  const currentUrl = currentClip?.url || sources[0]?.url || '';
  const currentName = currentClip?.name || sources[0]?.name || '';
  const currentMeta =
    currentClip && currentClip.sourceId != null ? sourceMetadata[currentClip.sourceId] : undefined; // U
  const totalDuration = currentMeta?.duration || currentClip?.sourceEnd || 0; // W

  /* ---------- 写回 data（复刻官方 128-162 行） ---------- */
  const updateTracks = useCallback(
    (t: VTrack[]) => {
      patchNodeDataById(setNodes, id, {
        timelineTracks: t,
        sourceOrder: t
          .filter((e) => e.kind === 'video')
          .flatMap((e) => e.clips.map((c) => String(c.sourceId))),
      });
      setTimelineTracks(t);
    },
    [id, setNodes],
  );

  const mutateTracks = useCallback(
    (mutator: (draft: VTrack[]) => void) => {
      const next = tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c })) }) as VTrack);
      mutator(next);
      updateTracks(next);
    },
    [tracks, updateTracks],
  );

  useEffect(() => {
    patchNodeDataById(setNodes, id, {
      mode,
      audioFormat,
      resizeWidth,
      resizeHeight,
      targetFps,
      gifFps,
      gifMaxSize,
      gifColors,
      gifSpeed,
      gifCrop,
      gifStart,
      gifEnd,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    audioFormat,
    resizeWidth,
    resizeHeight,
    targetFps,
    gifFps,
    gifMaxSize,
    gifColors,
    gifSpeed,
    gifCrop,
    gifStart,
    gifEnd,
    id,
    setNodes,
  ]);

  /* ---------- 读元数据（复刻官方 176-209 行） ---------- */
  useEffect(() => {
    for (const s of sources) {
      if (sourceMetadata[s.sourceId] || metaInFlight.current.has(s.sourceId)) continue;
      metaInFlight.current.add(s.sourceId);
      (async () => {
        try {
          const blob = await httpRequest(s.url, {
            parseJson: false,
            retries: 0,
            timeoutMs: DOWNLOAD_TIMEOUT,
            label: 'readVideoMeta',
          }).then((r) => r.blob());
          const meta = await readVideoMetadata(blob);
          setSourceMetadata((prev) => {
            const next = { ...prev, [s.sourceId]: meta };
            patchNodeDataById(setNodes, id, { sourceMetadata: next, errorMessage: undefined });
            return next;
          });
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : '无法读取视频信息');
        } finally {
          metaInFlight.current.delete(s.sourceId);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sources, setNodes]);

  /* ---------- GIF 时长同步（复刻官方 fc.jsx 60-76 行） ---------- */
  const gifSourceMeta = useMemo(
    () => sources.map((s) => sourceMetadata[s.sourceId]).find(Boolean),
    [sources, sourceMetadata],
  );
  useEffect(() => {
    const dur = gifSourceMeta?.duration || 0;
    if (!dur) return;
    setGifDuration(dur);
    if (!gifEnd || gifEnd <= 0 || gifEnd > dur) setGifEnd(dur);
    if (gifStart >= dur - 0.1) setGifStart(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifSourceMeta?.duration]);

  /* ---------- 抽缩略图（复刻官方 210-254 行） ---------- */
  useEffect(() => {
    const withMeta = Array.from(
      new Map(
        sources.filter((s) => sourceMetadata[s.sourceId]?.duration).map((s) => [s.sourceId, s]),
      ).values(),
    );
    let cancelled = false;
    (async () => {
      for (const s of withMeta) {
        if (thumbnails[String(s.sourceId)]) continue;
        const meta = sourceMetadata[s.sourceId];
        const urls: string[] = [];
        for (let i = 0; i < 6; i++) {
          try {
            const blob = await captureFrame(
              s.url,
              Math.max(0.05, ((meta.duration ?? 0) * (i + 0.5)) / 6),
              0.55,
            );
            if (cancelled) return;
            const u = previewUrls.create(blob);
            if (!u) {
              // 【混线修正 2026-09-13】降级跳过（非异常）—— 但"静默跳过一帧"不可观测（Step 4）。
              // 用 debug 级（不是 warn）：属预期降级，不该打扰用户；但排查"少了几帧"时必须查得到。
              logger.debug('videoProcess', '抽缩略图：previewUrls.create 返回空，跳过该帧', {
                sourceId: s.sourceId,
                index: i,
              });
              continue;
            }
            thumbUrls.current.push(u);
            urls.push(u);
          } catch {
            break;
          }
        }
        if (!cancelled && urls.length) setThumbnails((prev) => ({ ...prev, [s.sourceId]: urls }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sources, setNodes]);

  useEffect(() => {
    if (!selectedClipId && firstVideoClip) setSelectedClipId(firstVideoClip.id);
    if (selectedClipId && !selectedClipInfo && firstVideoClip) setSelectedClipId(firstVideoClip.id);
  }, [firstVideoClip, selectedClipId, selectedClipInfo]);

  /* ---------- 清理（复刻官方 255-266 行） ---------- */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      controllerRef.current?.cancel();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup 读 ref.current 取「卸载时刻最新值」；若在 effect 内捕获旧数组会漏释放后添加的 thumbUrls，规则对 ref 属误报
      thumbUrls.current.forEach((u) => previewUrls.release(u));
    };
  }, []);

  /* ---------- 片段操作（复刻官方 267-362 行） ---------- */
  const updateClip = useCallback(
    (clipId: string, patch: Partial<VClip>) => {
      mutateTracks((t) => {
        let clip: VClip | undefined;
        let track;
        for (const tr of t) {
          const idx = tr.clips.findIndex((c) => c.id === clipId);
          if (idx >= 0) {
            clip = tr.clips[idx];
            track = tr;
            break;
          }
        }
        if (!clip) {
          // 【混线修正 2026-09-13】原实现 `let clip;` 无类型，找不到片段时 `Object.assign(undefined, patch)` 会抛；
          // 严格类型化那条线把它改成了静默 return（Step 4 禁静默吞）→ 补可见信号，控制流不变。
          logger.warn('videoProcess', 'updateClip: 未找到目标片段，本次补丁被忽略', { clipId });
          return;
        }
        Object.assign(clip, patch);
        clip.duration = Math.max(0, (clip.sourceEnd ?? 0) - (clip.sourceStart ?? 0));
        if (clip && track && patch.trackId && patch.trackId !== track.id) {
          const target = t.find((e) => e.id === patch.trackId);
          if (target) {
            track.clips = track.clips.filter((c) => c.id !== clipId) as VClip[];
            target.clips.push(clip);
          }
        }
      });
    },
    [mutateTracks],
  );

  const setInPoint = useCallback(() => {
    if (!currentClip) return;
    const v = round2(Math.max(0, Math.min(playheadTime, (currentClip.sourceEnd ?? 0) - 0.05)));
    updateClip(currentClip.id, { sourceStart: v });
  }, [currentClip, playheadTime, updateClip]);

  const setOutPoint = useCallback(() => {
    if (!currentClip) return;
    const meta =
      sourceMetadata[currentClip.sourceId ?? '']?.duration || (currentClip.sourceEnd ?? 0);
    const v = round2(Math.min(meta, Math.max(playheadTime, (currentClip.sourceStart ?? 0) + 0.05)));
    updateClip(currentClip.id, { sourceEnd: v });
  }, [currentClip, playheadTime, sourceMetadata, updateClip]);

  const splitAtPlayhead = useCallback(() => {
    if (
      !currentClip ||
      playheadTime <= (currentClip.sourceStart ?? 0) + 0.01 ||
      playheadTime >= (currentClip.sourceEnd ?? 0) - 0.01
    )
      return;
    const v = round2(playheadTime);
    mutateTracks((t) => {
      const track = t.find((e) => e.clips.some((c) => c.id === currentClip.id));
      if (!track) return;
      const idx = track.clips.findIndex((c) => c.id === currentClip.id);
      const original = track.clips[idx];
      const a = { ...original, sourceEnd: v, duration: v - (original.sourceStart ?? 0) };
      const b = {
        ...original,
        id: makeId('clip'),
        sourceStart: v,
        duration: (original.sourceEnd ?? 0) - v,
      };
      track.clips.splice(idx, 1, a, b);
      setSelectedClipId(b.id);
    });
  }, [currentClip, playheadTime, mutateTracks]);

  const removeClip = useCallback(() => {
    if (selectedClipInfo) {
      mutateTracks((t) => {
        const track = t.find((e) => e.id === selectedClipInfo.track.id);
        if (track)
          track.clips = track.clips.filter((c) => c.id !== selectedClipInfo.clip.id) as VClip[];
      });
      setSelectedClipId('');
    }
  }, [selectedClipInfo, mutateTracks]);

  /* ---------- 键盘快捷键（复刻官方 363-388 行） ---------- */
  // 走画布侧键盘注册的**唯一入口**：画布被全屏层 / 视频剪辑器压制时自动让位。
  // 【为什么必须】本节点在画布上可见、随时可被盖住：用户在剪辑器里按 Delete 想删片段，
  // 若这里不判让位，删掉的会是**本节点里被盖住的片段**（静默破坏，TD-22-19）。
  useCanvasKeydown(
    (e) => {
      // ⚠️ 此处**不再**自判"焦点在不在输入区"：该判据已收口到入口 `useCanvasKeydown`
      //（`isEditableTarget`，覆盖 INPUT/TEXTAREA/**contenteditable**）。
      // 历史（2026-09-18 用户裁定 · ADR-0029）：这里曾写 `tgt.matches('input, textarea, select')`
      // —— 漏了 contenteditable ⇒ 在输入框里按 Delete/Backspace **既删文字又删片段**。
      if (e.key === '[') {
        e.preventDefault();
        setInPoint();
      } else if (e.key === ']') {
        e.preventDefault();
        setOutPoint();
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        splitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeClip();
      }
    },
    { enabled: mode === 'trim' || mode === 'concat' },
  );

  /* ---------- 播放头 / scrubber（复刻官方 389-454 行） ---------- */
  // 容差由本宿主决定（秒级、随总长放宽），换算成像素后交给共用原语。
  // 分工（7 步法 Step 3）：**容差多大**是本域判据（保留在此）；**在容差内找最近候选**是共用运算（`snapTime`）。
  const snapTolerance = Math.max(0.08, totalDuration * 0.012);
  const snapTo = useCallback(
    (v: number, targets: number[]) =>
      snapTime(v, targets, PX_PER_SEC, timeDeltaToPx(snapTolerance, PX_PER_SEC)),
    [snapTolerance],
  );

  const setPlayhead = useCallback(
    (v: number) => {
      const targets = currentClip ? [currentClip.sourceStart ?? 0, currentClip.sourceEnd ?? 0] : [];
      const clamped = Math.max(0, Math.min(totalDuration, snapTo(v, targets)));
      setPlayheadTime(clamped);
      if (videoRef.current && videoRef.current.src === currentUrl)
        videoRef.current.currentTime = clamped;
    },
    [currentClip, totalDuration, snapTo, currentUrl],
  );

  // P3：scrub 高频 → pointerdown 建一次 batch + rect 缓存，move 只 batch（每帧一次 setPlayhead+video.currentTime），up flush
  const onScrubPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubDrag.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const batch = createRafBatch((clientX) => {
        const r = scrubDrag.current?.rect;
        if (!r) return;
        setPlayhead(((clientX - r.left) / r.width) * totalDuration);
      });
      scrubDrag.current = { batch, rect };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    scrubDrag.current.batch(e.clientX);
  };
  const flushScrub = () => {
    scrubDrag.current?.batch.flush(); // 松手补最后一帧，避免播放头差一帧
    scrubDrag.current = null;
  };

  const onDragTrimHandle = (e: React.PointerEvent, side: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    const clip = currentClip;
    const rect = scrubRef.current?.getBoundingClientRect();
    if (!rect || !clip || !totalDuration) return;
    // P3：move 高频 → rAF 合并 updateClip；rect 起点缓存，move 内不再读
    const batch = createRafBatch((clientX) => {
      const v = round2(
        snapTo(
          Math.max(
            0,
            Math.min(totalDuration, ((clientX - rect.left) / rect.width) * totalDuration),
          ),
          [playheadTime],
        ),
      );
      if (side === 'start')
        updateClip(clip.id, { sourceStart: Math.min(v, (clip.sourceEnd ?? 0) - 0.05) });
      else updateClip(clip.id, { sourceEnd: Math.max(v, (clip.sourceStart ?? 0) + 0.05) });
    });
    const move = (ev: PointerEvent) => batch(ev.clientX);
    const up = () => {
      batch.flush(); // 松手补最后一帧，避免入出点差一帧
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    batch(e.nativeEvent.clientX);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
  };

  /* ---------- 片段拖动（复刻官方 455-508 行） ---------- */
  const onDragClip = (e: React.PointerEvent<HTMLDivElement>, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    const startX = e.clientX;
    const startTimeline = clip.timelineStart;
    // P3：move 高频 → rAF 合并（elementsFromPoint + updateClip 从每事件一次降到每帧一次）
    const batch = createRafBatch((clientX, clientY) => {
      const dx = pxDeltaToTime(clientX - startX, PX_PER_SEC);
      const candidate = Math.max(0, startTimeline + dx);
      const snapTargets = [
        0,
        playheadTime,
        ...tracks.flatMap((t) =>
          t.clips
            .filter((c) => c.id !== clipId)
            .flatMap((c) => [c.timelineStart, c.timelineStart + (c.duration ?? 0)]),
        ),
      ];
      const a = snapTo(candidate, snapTargets);
      const b = snapTo(candidate + (clip.duration ?? 0), snapTargets);
      const moved =
        Math.abs(a - candidate) <= Math.abs(b - (candidate + (clip.duration ?? 0)))
          ? a
          : b - (clip.duration ?? 0);
      const el = document
        .elementsFromPoint(clientX, clientY)
        .find((n) => n.getAttribute('data-track-id'));
      const newTrackId = el ? el.getAttribute('data-track-id') : undefined;
      updateClip(clipId, {
        timelineStart: round2(Math.max(0, moved)),
        ...(newTrackId ? { trackId: newTrackId } : {}),
      });
    });
    const move = (ev: PointerEvent) => batch(ev.clientX, ev.clientY);
    const up = () => {
      batch.flush(); // 松手补最后一帧，避免片段位置差一帧
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
  };

  /* ---------- 播放 / 上传 / 新增轨道（复刻官方 509-545 行） ---------- */
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  const addTrack = () => {
    updateTracks([
      ...tracks,
      {
        id: makeId('video-track'),
        name: `视频 ${tracks.filter((t) => t.kind === 'video').length + 1}`,
        kind: 'video',
        clips: [],
      },
    ]);
  };

  /* ---------- 处理（复刻官方 546-707 行） ---------- */
  const fail = useCallback(
    (msg: string) => {
      // 【瞬态收口·阶段二】loading 归 nodeRuntimeStore，node.data 只留持久字段(errorMessage)。
      updateNodeRuntime(id, { loading: false });
      patchNodeDataById(setNodes, id, { errorMessage: msg });
      showToast(msg);
    },
    [id, setNodes],
  );

  const spawnVideoNode = useCallback(
    (url: string, name: string) => {
      const me = getNode(id);
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60;
      const baseY = me?.position.y ?? 100;
      const nid = `video-${id}-${generateId('v')}`;
      const spawned = buildSpawnNodes(
        { id, position: { x: baseX, y: baseY } },
        [
          {
            id: nid,
            type: 'assetNode',
            position: { x: baseX, y: baseY },
            // assetType:'video'：blob 视频 URL 无扩展名/前缀，靠显式类型让 assetNode 正确渲染视频
            data: { assetUrl: url, assetType: 'video', label: name, expanded: true },
            style: { ...ASSET_NODE_SIZE.video }, // 尺寸单源（TD-16-48）：视频档 = 420×380
          },
        ],
        { sourceHandle: 'main-output' },
      );
      spawnAndCommit(spawned, {
        getNodes,
        getEdges,
        setNodes,
        setEdges,
        history: history ?? undefined,
      });
    },
    [id, getNode, getNodes, getEdges, setNodes, setEdges, history],
  );

  const spawnAudioNode = useCallback(
    (url: string, name: string) => {
      const me = getNode(id);
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60;
      const baseY = me?.position.y ?? 100;
      const nid = `audio-${id}-${generateId('a')}`;
      const spawned = buildSpawnNodes(
        { id, position: { x: baseX, y: baseY } },
        [
          {
            id: nid,
            type: 'assetNode',
            position: { x: baseX, y: baseY },
            // assetType:'audio'：blob 音频 URL 无扩展名/前缀，靠显式类型让 assetNode 正确渲染音频
            data: { assetUrl: url, assetType: 'audio', label: name, expanded: false },
            style: { ...ASSET_NODE_SIZE.audio }, // 尺寸单源（TD-16-48）：音频档 = 320×200
          },
        ],
        { sourceHandle: 'main-output' },
      );
      spawnAndCommit(spawned, {
        getNodes,
        getEdges,
        setNodes,
        setEdges,
        history: history ?? undefined,
      });
    },
    [id, getNode, getNodes, getEdges, setNodes, setEdges, history],
  );

  // GIF 结果 spawn 成图片节点（gif 是图片，assetType:'image'）
  const spawnGifNode = useCallback(
    (url: string, name: string) => {
      const me = getNode(id);
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 540) + 60;
      const baseY = me?.position.y ?? 100;
      const nid = `gif-${id}-${generateId('g')}`;
      const spawned = buildSpawnNodes(
        { id, position: { x: baseX, y: baseY } },
        [
          {
            id: nid,
            type: 'assetNode',
            position: { x: baseX, y: baseY },
            data: { assetUrl: url, assetType: 'image', label: name, expanded: false },
            style: { ...ASSET_NODE_SIZE.image }, // 尺寸单源（TD-16-48）：图片档 = 360×260
          },
        ],
        { sourceHandle: 'main-output' },
      );
      spawnAndCommit(spawned, {
        getNodes,
        getEdges,
        setNodes,
        setEdges,
        history: history ?? undefined,
      });
    },
    [id, getNode, getNodes, getEdges, setNodes, setEdges, history],
  );

  const handleProcess = useCallback(async () => {
    const isConcat = mode === 'concat';
    const clips =
      mode === 'trim'
        ? exportClips.filter((c) => c.sourceId === currentClip?.sourceId)
        : exportClips;
    if (isConcat && clips.length < 2) {
      fail('视频拼接至少需要 2 个可见视频片段');
      return;
    }
    if (mode === 'trim' && clips.length === 0) {
      fail('时间线中没有可导出的片段');
      return;
    }
    if (mode !== 'concat' && mode !== 'trim' && !currentUrl) {
      fail('请先连接包含视频的节点');
      return;
    }
    if (mode === 'sizeFrameRate' && (resizeWidth <= 0 || resizeHeight <= 0 || targetFps <= 0)) {
      fail('宽度、高度和帧率必须为正数');
      return;
    }
    if (mode === 'toGif') {
      if (!currentUrl) {
        fail('请先连接包含视频的节点');
        return;
      }
      if (gifCrop && gifStart >= gifEnd) {
        fail('裁剪区间无效：开始时间必须小于结束时间');
        return;
      }
    }

    const outW = evenRound(resizeWidth);
    const outH = evenRound(resizeHeight);
    const controller = new ProgressController();
    const abort = new AbortController();
    controllerRef.current = controller;
    abortRef.current = abort;
    // 【瞬态收口·阶段二】loading/progress 归 nodeRuntimeStore；node.data 只留持久字段。
    updateNodeRuntime(id, { loading: true, progress: 0 });
    patchNodeDataById(setNodes, id, { errorMessage: undefined });
    try {
      let result;
      if (mode === 'toGif') {
        // 视频转 GIF：输入是 URL（videoToGif 内部用 video 元素加载），无需 blob 下载。
        // 【R2 视频治理】包总超时（60s），超时 abort 底层 + 取消，防逐帧 seek 卡死永久 loading（TASK-028 #31-32）
        const gif = await withTimeout(
          videoToGif(currentUrl, {
            fps: gifFps,
            maxSize: gifMaxSize,
            colors: gifColors,
            speed: gifSpeed,
            startTime: gifCrop ? gifStart : 0,
            endTime: gifCrop ? gifEnd : undefined,
            onProgress: (p) => updateNodeRuntime(id, { progress: Math.round(p * 100) }),
          }),
          60000,
          'GIF 生成超时（可能解码卡死）',
          abort.signal,
          () => {
            releaseQuietly(() => controller.cancel());
          },
        );
        // TD-22-5：GIF 产物也走唯一落盘基座（旧实现 createObjectURL 临时 URL 直接喂节点 → 刷新即失效）。
        // outputName 提前派生（落盘文件名 = 展示名，同源一致）；失败显式报错，不伪造成功。
        const outputName = `${stripExt(currentName || 'video')}_gif.gif`;
        const up = await uploadFileToLocal(gif.blob, UPLOAD_DIRS.videoProcess, outputName);
        if (!up.ok) {
          updateNodeRuntime(id, { loading: false });
          // 【2026-09-17 消费者只转发】原因由生产者给出（原来固定说"本地服务未启动？"= 自己编）。
          fail(`GIF 保存失败：${up.message}`);
          return;
        }
        updateNodeRuntime(id, { loading: false, progress: 100 });
        patchNodeDataById(setNodes, id, {
          errorMessage: undefined,
          gifResult: {
            width: gif.width,
            height: gif.height,
            frameCount: gif.frameCount,
            size: gif.size,
          },
          outputName,
        });
        setGifResult({
          width: gif.width,
          height: gif.height,
          frameCount: gif.frameCount,
          size: gif.size,
        });
        spawnGifNode(up.url, outputName);
        showToast('GIF 生成完成');
        return;
      } else if (isConcat) {
        const blobs = [];
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const blob = await httpRequest(clip.url!, {
            parseJson: false,
            retries: 0,
            timeoutMs: VIDEO_DOWNLOAD_TIMEOUT,
            label: 'downloadClip',
            signal: abort.signal,
          }).then((r) => r.blob());
          blobs.push(blob);
          updateNodeRuntime(id, { progress: Math.round(((i + 1) / clips.length) * 20) });
        }
        // 【R2 视频治理】concat 包总超时（每片段 90s 下限 5min），防 for await 长循环卡死（TASK-028 #15-29）
        result = await withTimeout(
          concatVideos(blobs, {
            segments: clips.map((c) => ({
              start: c.sourceStart,
              end: c.sourceEnd,
              muted: c.muted,
            })),
            controller,
            onProgress: (p) => updateNodeRuntime(id, { progress: 20 + Math.round(p * 80) }),
          }),
          Math.max(5 * 60 * 1000, blobs.length * 90 * 1000),
          '视频拼接超时（可能解码卡死）',
          abort.signal,
          () => {
            releaseQuietly(() => controller.cancel());
          },
        );
      } else {
        const clip = mode === 'trim' ? clips[0] : undefined;
        const src = currentUrl;
        const blob = await httpRequest(src, {
          parseJson: false,
          retries: 0,
          timeoutMs: VIDEO_DOWNLOAD_TIMEOUT,
          label: 'downloadVideo',
          signal: abort.signal,
        }).then((r) => r.blob());
        const baseOpts = {
          controller,
          onProgress: (p: number) => updateNodeRuntime(id, { progress: Math.round(p * 100) }),
        };
        let opts: ProcessVideoOptions;
        if (mode === 'trim')
          opts = { mode, start: clip!.sourceStart, end: clip!.sourceEnd, ...baseOpts };
        else if (mode === 'extractAudio')
          opts = { mode, format: audioFormat as ProcessVideoOptions['format'], ...baseOpts };
        else
          opts = {
            mode: mode as ProcessVideoOptions['mode'],
            width: outW,
            height: outH,
            fps: targetFps,
            ...baseOpts,
          };
        // 【R2 视频治理】processVideo 包总超时（5min），防 conversion.execute 编码卡死（TASK-028 #6-14）
        result = await withTimeout(
          processVideo(blob, opts),
          5 * 60 * 1000,
          '视频处理超时（可能编码卡死）',
          abort.signal,
          () => {
            releaseQuietly(() => controller.cancel());
          },
        );
      }

      const uploaded = await uploadResult(result.blob, { subfolder: UPLOAD_DIRS.videoProcess });
      // TD-22-2：落盘失败显式报错 —— 不再静默 spawn「刷新即失效」的 blob: 节点。
      // 【2026-09-17 消费者只转发】原因由生产者给出（原来固定"本地服务未启动？"= 自己编）。
      if (!uploaded.ok) {
        updateNodeRuntime(id, { loading: false, progress: 100 });
        fail(`产物保存失败：${uploaded.message}`);
        return;
      }
      const count = clips.length;
      const suffix =
        mode === 'trim'
          ? count > 1
            ? `trimmed_${count}_clips`
            : 'trimmed'
          : mode === 'extractAudio'
            ? 'audio'
            : mode === 'sizeFrameRate'
              ? `${outW}x${outH}_${targetFps}fps`
              : `merged_${count}_clips`;
      const outputName = `${stripExt(currentName || 'video')}_${suffix}.${result.extension}`;
      updateNodeRuntime(id, { loading: false, progress: 100 });
      patchNodeDataById(setNodes, id, {
        errorMessage: undefined,
        outputName,
        outputInfo: {
          duration: result.metadata.duration,
          width: mode === 'extractAudio' ? undefined : result.metadata.width,
          height: mode === 'extractAudio' ? undefined : result.metadata.height,
          fps: mode === 'extractAudio' ? undefined : result.metadata.fps,
          size: result.blob.size,
        },
      });
      if (mode === 'extractAudio') {
        spawnAudioNode(uploaded.url, outputName);
        showToast('音频提取完成');
      } else {
        spawnVideoNode(uploaded.url, outputName);
        showToast(mode === 'concat' ? '视频拼接完成' : '视频处理完成');
      }
    } catch (e) {
      // 【R7 错误分类记录】异常经 classifyError 统一分类（timeout/network/business），分类结果进日志供排查；
      // message 原样透传（错误透传铁律）。超时优先于取消判断：withTimeout 超时会 abort + cancel（设置
      // aborted/isCanceled），若先判取消会把超时误归为取消而静默。isTimeoutError 在前，超时明确 fail 提示。
      const cls = classifyError(e);
      if (isTimeoutError(e)) {
        logger.error('VideoProcessNode', 'process timeout', {
          error: (e as { message?: string })?.message,
          errType: cls.type,
          retryable: cls.retryable,
        });
        fail(e instanceof Error ? e.message : '视频处理超时');
      } else if (e instanceof ConversionCanceled || abort.signal.aborted || controller.isCanceled) {
        updateNodeRuntime(id, { loading: false, progress: 0 });
        patchNodeDataById(setNodes, id, { errorMessage: undefined });
      } else {
        logger.error('VideoProcessNode', 'process failed', {
          error: (e as { message?: string })?.message,
          errType: cls.type,
          retryable: cls.retryable,
        });
        fail(e instanceof Error ? e.message : '视频处理失败');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [
    mode,
    exportClips,
    currentClip,
    currentUrl,
    resizeWidth,
    resizeHeight,
    targetFps,
    audioFormat,
    gifFps,
    gifMaxSize,
    gifColors,
    gifSpeed,
    gifCrop,
    gifStart,
    gifEnd,
    currentName,
    id,
    setNodes,
    fail,
    spawnVideoNode,
    spawnAudioNode,
    spawnGifNode,
  ]);

  // 【瞬态收口·阶段二】loading/progress 从 node.data 迁到 nodeRuntimeStore（内存级）。
  // 旧快照 data 里可能残留 loading/progress，此处不再读 data，防「复制/刷新残留」误判遮罩。
  const runtime = useNodeRuntime(id);
  const loading = runtime.loading;
  const realtimeProgress = runtime.progress;
  const inputCls =
    'nodrag nowheel w-full h-8 bg-surface-1 border border-edge-raised rounded-md px-2 text-caption-sm text-primary outline-none focus:border-edge-strong';
  const presetCls =
    'nodrag h-8 px-2 rounded-md border border-edge-raised bg-surface-active text-caption text-body hover:bg-surface-active-2 transition-colors disabled:opacity-35 disabled:cursor-not-allowed';
  const smallBtnCls =
    'nodrag h-7 min-w-7 px-1.5 rounded border border-edge-raised bg-surface-hover text-secondary flex items-center justify-center hover:text-white disabled:opacity-30';

  const playheadPct = totalDuration ? (playheadTime / totalDuration) * 100 : 0;
  const inPct =
    totalDuration && currentClip ? ((currentClip.sourceStart ?? 0) / totalDuration) * 100 : 0;
  const outPct =
    totalDuration && currentClip ? ((currentClip.sourceEnd ?? 0) / totalDuration) * 100 : 100;
  const canRun =
    mode === 'concat'
      ? exportClips.length >= 2
      : mode === 'trim'
        ? exportClips.length > 0
        : !!currentUrl;

  /* ---------- 时间线总长（复刻官方 Me） ---------- */
  const timelineTotal = useMemo(() => {
    let max = 0;
    for (const t of tracks)
      for (const c of t.clips) {
        const end = c.timelineStart + (c.duration ?? 0);
        if (end > max) max = end;
      }
    return max;
  }, [tracks]);

  const timelineWidth = Math.max(100, timeDeltaToPx(timelineTotal, PX_PER_SEC) + 100);
  const playheadX = timeToX(playheadTime, PX_PER_SEC, 0);

  /* 同步横向滚动（复刻官方 Pe） */
  const syncScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const left = e.currentTarget.scrollLeft;
    if (timelineWrapRef.current) {
      timelineWrapRef.current.querySelectorAll('.timeline-container').forEach((el) => {
        if (el !== e.currentTarget) el.scrollLeft = left;
      });
    }
  };

  /* 点击时间线定位（复刻官方 Le） */
  const onTimelinePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, xToTime(e.clientX - rect.left, PX_PER_SEC, 0));
    for (const tr of tracks) {
      if (tr.kind !== 'video') continue;
      const clip = tr.clips.find(
        (c) => t >= c.timelineStart && t <= c.timelineStart + (c.duration ?? 0),
      );
      if (clip) {
        if (selectedClipId !== clip.id) {
          setSelectedClipId(clip.id);
          const srcT = sourceTimeAt(t, clip);
          if (videoRef.current.src !== clip.url) {
            videoRef.current.src = clip.url!;
            const setTime = () => {
              if (videoRef.current) {
                videoRef.current.currentTime = srcT;
                videoRef.current.removeEventListener('loadedmetadata', setTime);
              }
            };
            videoRef.current.addEventListener('loadedmetadata', setTime);
          } else {
            videoRef.current.currentTime = srcT;
          }
        } else {
          videoRef.current.currentTime = sourceTimeAt(t, clip);
        }
        setPlayheadTime(t);
        return;
      }
    }
    setPlayheadTime(t);
  };

  /* 时间线片段缩略图组件（复刻官方 Re） */
  const renderClipThumb = (clip: VClip) => {
    const imgs = thumbnails[String(clip.sourceId)] || [];
    return (
      <div
        key={clip.id}
        className="absolute top-1 h-12 z-10"
        style={{
          left: timeToX(clip.timelineStart, PX_PER_SEC, 0),
          width: timeDeltaToPx(clip.duration ?? 0, PX_PER_SEC),
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setSelectedClipId(clip.id);
          onDragClip(e, clip.id);
        }}
      >
        <div
          onDoubleClick={() => {
            setEditingClipId(clip.id);
            setSelectedClipId(clip.id);
          }}
          className={`nodrag relative w-full h-full overflow-hidden border cursor-grab active:cursor-grabbing ${selectedClipId === clip.id ? 'border-white z-10' : 'border-edge-raised'}`}
        >
          <div className="absolute inset-0 flex">
            {(imgs.length ? imgs : [undefined, undefined, undefined]).map((u, i) =>
              u ? (
                <img
                  key={u}
                  src={u}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="h-full min-w-0 flex-1 object-cover pointer-events-none select-none"
                />
              ) : (
                <div key={i} className="flex-1 bg-surface-raised-2" />
              ),
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-5 px-1 flex items-center gap-1 bg-black/70 text-meta text-white">
            <span className="truncate">{clip.name}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              {(clip.duration ?? 0).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* 高度：本节点内容区为 overflow-y-auto 内部滚动，内容不撑高节点，
     节点尺寸由 NodeShell 的 NodeResizer + nodeDefaults 控制，无需内容高度自适应。 */
  /* ---------- trim 模式的入出点 scrubber（复刻官方 ze） ---------- */
  const trimScrubber = currentClip && (
    <div className="p-2">
      <div
        ref={scrubRef}
        className="relative h-16 overflow-hidden bg-surface-active-2 cursor-crosshair touch-none select-none"
        onPointerDown={onScrubPointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) onScrubPointer(e);
        }}
        onPointerUp={flushScrub}
      >
        <div className="absolute inset-0 flex">
          {(thumbnails[String(currentClip.sourceId)] || []).map((u) => (
            <img
              key={u}
              src={u}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="min-w-0 flex-1 object-cover pointer-events-none select-none"
            />
          ))}
        </div>
        <div
          className="absolute inset-y-0 left-0 bg-black/65 pointer-events-none"
          style={{ width: `${inPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/65 pointer-events-none"
          style={{ width: `${100 - outPct}%` }}
        />
        <div
          className="absolute inset-y-0 border-y-2 border-white/90 pointer-events-none"
          style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }}
        />
        <button
          type="button"
          aria-label="拖动入点"
          title="拖动片段头部设置入点；靠近播放头时自动吸附"
          onPointerDown={(e) => onDragTrimHandle(e, 'start')}
          className="nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40"
          style={{ left: `${inPct}%` }}
        >
          <span className="absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60" />
        </button>
        <button
          type="button"
          aria-label="拖动出点"
          title="拖动片段尾部设置出点；靠近播放头时自动吸附"
          onPointerDown={(e) => onDragTrimHandle(e, 'end')}
          className="nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40"
          style={{ left: `${outPct}%` }}
        >
          <span className="absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60" />
        </button>
        <div
          className="absolute inset-y-0 z-10 w-px bg-red-400 pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400" />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-meta text-muted tabular-nums">
        <span>入点 {(currentClip.sourceStart ?? 0).toFixed(2)}s</span>
        <span>片段 {(currentClip.duration ?? 0).toFixed(2)}s</span>
        <span>出点 {(currentClip.sourceEnd ?? 0).toFixed(2)}s</span>
      </div>
    </div>
  );

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="视频处理"
      icon={<Clapperboard size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      defaultHeight={620}
      minWidth={520}
      minHeight={620}
      // 端口契约收口到 NodeShell（勿改回 children 手写 CustomHandle）：
      // 本节点是「成品节点」，两侧端口 id 被下游 spawn 写死引用
      // （左侧接收 targetHandle='default'/null 的通用连线；
      //   右侧 sourceHandle='main-output' 见 depthVideo/spawn.ts 与 VideoProcessNode 内部 spawn）。
      // 手写在 children 里会让端口渲染位置基准错乱 → 建边成功但线不显示。
      targetHandleId="default"
      sourceHandleId="main-output"
      syncSize={false}
      onRename={rename}
    >
      <div
        ref={contentRef}
        className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar nowheel"
      >
        {/* 模式切换 */}
        <div className="grid grid-cols-5 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              disabled={loading}
              className={`nodrag h-8 rounded-md border text-caption leading-tight px-0.5 ${mode === m.value ? 'bg-inverse text-inverse-strong border-inverse' : 'bg-surface-subtle text-secondary border-edge-raised hover:text-white'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 视频预览 */}
        {currentUrl ? (
          <div className="relative bg-black rounded-md overflow-hidden border border-edge">
            {!isHidden('video') && (
              <video
                ref={videoRef}
                src={currentUrl}
                controls={mode !== 'trim' && mode !== 'concat'}
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => {
                  if (!isScrubbing.current) {
                    if (mode === 'concat') {
                      if (isPlaying && currentClip)
                        setPlayheadTime(
                          // 夹取到片段源起点（等价原内联 Math.max(0, cur - sourceStart)）
                          timelineTimeAt(
                            Math.max(currentClip.sourceStart ?? 0, e.currentTarget.currentTime),
                            currentClip,
                          ),
                        );
                    } else {
                      setPlayheadTime(e.currentTarget.currentTime);
                    }
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="nodrag nowheel w-full aspect-video object-contain"
              />
            )}
          </div>
        ) : (
          <div className="nodrag aspect-video rounded-md border border-dashed border-edge-raised flex items-center justify-center gap-2 text-muted">
            <span className="text-caption-sm">连接视频节点以导入</span>
          </div>
        )}

        {/* 视频信息 */}
        {currentUrl && (
          <div className="flex justify-between gap-2 text-caption text-muted">
            <span className="truncate">{currentName}</span>
            <span className="shrink-0 tabular-nums">
              {currentMeta
                ? `${formatDuration(currentMeta.duration)} · ${currentMeta.width}×${currentMeta.height} · ${(currentMeta.fps ?? 0).toFixed(2)} fps`
                : '读取信息中...'}
            </span>
          </div>
        )}

        {/* 时间线面板（trim/concat） */}
        {(mode === 'trim' || mode === 'concat') && (
          <div className="nodrag nowheel rounded-md border border-edge bg-surface-well overflow-hidden flex flex-col min-h-0 shrink-0">
            {/* 控制栏 */}
            <div className="h-9 px-2 flex shrink-0 items-center gap-1 border-b border-edge">
              <button
                className={smallBtnCls}
                title={isPlaying ? '暂停' : '播放'}
                onClick={togglePlay}
                disabled={!currentUrl}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                className={smallBtnCls}
                title="在播放头设置入点 (["
                onClick={setInPoint}
                disabled={!currentClip}
              >
                [
              </button>
              <button
                className={smallBtnCls}
                title="在播放头设置出点 (])"
                onClick={setOutPoint}
                disabled={!currentClip}
              >
                ]
              </button>
              <button
                className={smallBtnCls}
                title="在播放头分割 (S)"
                onClick={splitAtPlayhead}
                disabled={!currentClip}
              >
                <Scissors size={13} />
              </button>
              <button
                className={smallBtnCls}
                title="删除选中片段 (Delete)"
                onClick={removeClip}
                disabled={!selectedClipInfo}
              >
                <Trash2 size={13} />
              </button>
              <span className="ml-auto text-caption text-secondary tabular-nums">
                {playheadTime.toFixed(2)}s
              </span>
            </div>

            {/* trim：入出点 scrubber */}
            {mode === 'trim' && trimScrubber}

            {/* concat：多轨时间线 */}
            {mode === 'concat' && (
              <div
                ref={timelineWrapRef}
                className="max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 space-y-1 relative"
              >
                {/* 播放头（绝对定位到滚动容器） */}
                <div
                  className="absolute top-1.5 bottom-0 z-20 w-px bg-red-400 pointer-events-none transition-transform duration-75"
                  style={{ transform: `translateX(${playheadX}px)`, left: '102px' }}
                >
                  <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400" />
                </div>
                {tracks.map((tr) => (
                  <div
                    key={tr.id}
                    data-track-id={tr.id}
                    className="flex min-h-16 border border-edge bg-surface-subtle relative"
                  >
                    <div className="w-24 shrink-0 p-1.5 border-r border-edge flex flex-col gap-1 text-meta text-secondary z-30 bg-surface-subtle">
                      <div className="flex items-center gap-1">
                        <span className="truncate" title={tr.name}>
                          {tr.name}
                        </span>
                        <button
                          className="ml-auto"
                          title="轨道静音"
                          onClick={() =>
                            mutateTracks((t) => {
                              const n = t.find((x) => x.id === tr.id);
                              if (n) n.muted = !n.muted;
                            })
                          }
                        >
                          {tr.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        </button>
                      </div>
                    </div>
                    <div
                      className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden timeline-container custom-scrollbar pb-1"
                      onScroll={syncScroll}
                    >
                      <div
                        className="relative h-14 min-w-full cursor-crosshair"
                        style={{ width: timelineWidth }}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          isScrubbing.current = true;
                          onTimelinePointer(e);
                        }}
                        onPointerMove={(e) => {
                          if (isScrubbing.current) onTimelinePointer(e);
                        }}
                        onPointerUp={(e) => {
                          isScrubbing.current = false;
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                        onPointerCancel={() => {
                          isScrubbing.current = false;
                        }}
                      >
                        {tr.clips.map((c) => renderClipThumb(c))}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-1 mt-2">
                  <span className="text-meta text-muted">
                    导出顺序：视频轨从上到下，片段从左到右
                  </span>
                  <button
                    className="flex items-center gap-1 text-caption text-secondary hover:text-white px-2 py-1 rounded bg-surface-hover border border-edge-raised hover:bg-surface-active-2 transition-colors"
                    onClick={addTrack}
                  >
                    <Plus size={11} />
                    新增轨道
                  </button>
                </div>
              </div>
            )}

            {/* 选中片段信息 */}
            {selectedClipInfo && (
              <div className="h-9 px-2 border-t border-edge flex items-center gap-2 text-meta text-secondary">
                <span className="truncate max-w-32">{selectedClipInfo.clip.name}</span>
                <span className="tabular-nums">
                  {(selectedClipInfo.clip.sourceStart ?? 0).toFixed(2)} -{' '}
                  {(selectedClipInfo.clip.sourceEnd ?? 0).toFixed(2)}s
                </span>
                <button
                  className="ml-auto"
                  title="片段静音"
                  onClick={() =>
                    updateClip(selectedClipInfo.clip.id, { muted: !selectedClipInfo.clip.muted })
                  }
                >
                  {selectedClipInfo.clip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* extractAudio：格式选择 */}
        {mode === 'extractAudio' && (
          <div className="grid grid-cols-3 gap-2">
            {AUDIO_FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setAudioFormat(f.value)}
                className={`nodrag h-11 rounded-md border flex flex-col items-center justify-center ${audioFormat === f.value ? 'border-inverse bg-inverse text-inverse-strong' : 'border-edge-raised bg-surface-active text-body'}`}
              >
                <span className="text-caption-sm">{f.label}</span>
                <span className="text-meta opacity-60">{f.hint}</span>
              </button>
            ))}
          </div>
        )}

        {/* sizeFrameRate：预设 + 宽高 + fps */}
        {mode === 'sizeFrameRate' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setResizeWidth(p.width);
                    setResizeHeight(p.height);
                  }}
                  className={presetCls}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-caption text-muted">
                宽度
                <input
                  type="number"
                  min={2}
                  step={2}
                  value={resizeWidth}
                  onChange={(e) => setResizeWidth(Number(e.target.value))}
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="text-caption text-muted">
                高度
                <input
                  type="number"
                  min={2}
                  step={2}
                  value={resizeHeight}
                  onChange={(e) => setResizeHeight(Number(e.target.value))}
                  className={`${inputCls} mt-1`}
                />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {FPS_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setTargetFps(f)}
                  className={`${presetCls} ${targetFps === f ? 'border-edge-strong text-white' : ''}`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>
        )}

        {/* toGif：视频转 GIF（复刻官方 fc.jsx） */}
        {mode === 'toGif' && (
          <div className="flex flex-col gap-3">
            {/* 清晰度 / 帧率 / 速度 / 色彩 四列下拉 */}
            <div className="grid grid-cols-4 gap-2">
              <label className="nodrag flex flex-col gap-1 text-caption text-muted">
                清晰度
                <select
                  value={gifMaxSize}
                  onChange={(e) => setGifMaxSize(Number(e.target.value))}
                  className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-primary outline-none focus:border-edge-strong"
                >
                  {GIF_SIZES.map((v) => (
                    <option key={v} value={v}>
                      {v}p
                    </option>
                  ))}
                </select>
              </label>
              <label className="nodrag flex flex-col gap-1 text-caption text-muted">
                帧率
                <select
                  value={gifFps}
                  onChange={(e) => setGifFps(Number(e.target.value))}
                  className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-primary outline-none focus:border-edge-strong"
                >
                  {GIF_FPS.map((v) => (
                    <option key={v} value={v}>
                      {v} fps
                    </option>
                  ))}
                </select>
              </label>
              <label className="nodrag flex flex-col gap-1 text-caption text-muted">
                速度
                <select
                  value={gifSpeed}
                  onChange={(e) => setGifSpeed(Number(e.target.value))}
                  className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-primary outline-none focus:border-edge-strong"
                >
                  {GIF_SPEEDS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="nodrag flex flex-col gap-1 text-caption text-muted">
                色彩
                <select
                  value={gifColors}
                  onChange={(e) => setGifColors(Number(e.target.value))}
                  className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-primary outline-none focus:border-edge-strong"
                >
                  {GIF_COLORS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 裁剪开关 + 双 range */}
            {gifDuration > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setGifCrop((c: number) => (c ? 0 : 1))}
                  className={`nodrag h-6 px-2 rounded text-caption border ${gifCrop ? 'bg-inverse text-inverse-strong border-inverse' : 'bg-surface-active text-secondary border-edge-raised'}`}
                >
                  {gifCrop ? '裁剪已开' : '裁剪'}
                </button>
                {gifCrop === 1 ? (
                  <div className="nodrag flex flex-1 items-center gap-2 text-caption text-secondary min-w-0">
                    <input
                      type="range"
                      min={0}
                      max={gifDuration}
                      step={0.1}
                      value={gifStart}
                      onChange={(e) =>
                        setGifStart(Math.min(parseFloat(e.target.value), gifEnd - 0.1))
                      }
                      className="nodrag flex-1 accent-blue-500 min-w-0"
                    />
                    <input
                      type="range"
                      min={0}
                      max={gifDuration}
                      step={0.1}
                      value={gifEnd}
                      onChange={(e) =>
                        setGifEnd(Math.max(parseFloat(e.target.value), gifStart + 0.1))
                      }
                      className="nodrag flex-1 accent-blue-500 min-w-0"
                    />
                    <span className="shrink-0 tabular-nums w-24 text-right">
                      {gifStart.toFixed(1)} - {gifEnd.toFixed(1)}s
                    </span>
                  </div>
                ) : (
                  <span className="text-meta text-muted-2">默认整段视频</span>
                )}
              </div>
            )}

            {/* 结果信息（复刻官方 fc.jsx resultInfo） */}
            {gifResult && (
              <div className="text-caption text-secondary flex items-center gap-2 flex-wrap">
                <span>
                  {gifResult.width}×{gifResult.height}
                </span>
                <span>·</span>
                <span>{gifResult.frameCount} 帧</span>
                <span>·</span>
                <span className="text-blue-400">{formatBytes(gifResult.size)}</span>
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {errorMessage && (
          <div className="flex items-start gap-1.5 text-caption-sm text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-auto pt-2 flex gap-2 sticky bottom-0 bg-surface-panel-2">
          <button
            onClick={handleProcess}
            disabled={!canRun || loading}
            className={`nodrag node-btn-primary flex-1 justify-center`}
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                处理中 {realtimeProgress || 0}%
              </>
            ) : (
              <>
                <Play size={13} />
                {mode === 'concat'
                  ? '按时间线拼接'
                  : mode === 'toGif'
                    ? gifResult
                      ? '重新生成GIF'
                      : '生成GIF'
                    : '开始处理'}
              </>
            )}
          </button>
          {loading && (
            <button
              onClick={() => {
                abortRef.current?.abort();
                controllerRef.current?.cancel();
              }}
              title="取消处理"
              className="nodrag h-9 w-9 rounded-md border border-edge-muted bg-surface-raised-2 text-body flex items-center justify-center"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 编辑片段截取弹层 */}
      {editingClipId && currentClip && (
        <div className="absolute inset-0 z-50 bg-surface-panel-2/95 backdrop-blur-sm flex flex-col p-3 nodrag nowheel rounded-lg">
          <div className="flex items-center justify-between mb-3 text-white">
            <span className="text-sm font-medium">编辑片段截取</span>
            <button
              onClick={() => setEditingClipId(null)}
              className="text-secondary hover:text-white"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            <div className="relative bg-black rounded-md overflow-hidden border border-edge">
              {!isHidden('video') && (
                <video
                  ref={videoRef}
                  src={currentClip.url}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={(e) => setPlayheadTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="nodrag nowheel w-full aspect-video object-contain"
                />
              )}
            </div>
            <div className="nodrag nowheel rounded-md border border-edge bg-surface-well overflow-hidden flex flex-col shrink-0">
              <div className="h-9 px-2 flex shrink-0 items-center gap-1 border-b border-edge">
                <button
                  className={smallBtnCls}
                  title={isPlaying ? '暂停' : '播放'}
                  onClick={togglePlay}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button className={smallBtnCls} title="在播放头设置入点 ([" onClick={setInPoint}>
                  [
                </button>
                <button className={smallBtnCls} title="在播放头设置出点 (])" onClick={setOutPoint}>
                  ]
                </button>
                <button className={smallBtnCls} title="在播放头分割 (S)" onClick={splitAtPlayhead}>
                  <Scissors size={13} />
                </button>
                <span className="ml-auto text-caption text-secondary tabular-nums">
                  {playheadTime.toFixed(2)}s
                </span>
              </div>
              {trimScrubber}
            </div>
            <button
              onClick={() => setEditingClipId(null)}
              className="mt-auto shrink-0 h-9 w-full rounded-md bg-inverse text-inverse-strong text-body-xs font-medium"
            >
              完成截取
            </button>
          </div>
        </div>
      )}
    </NodeShell>
  );
}
export default React.memo(VideoProcessNode);
