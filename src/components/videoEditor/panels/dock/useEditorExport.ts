/**
 * 基座导出编排 —— `docs/120` C4 / C5.6（G4 产出在此获得**生产消费者**）。
 *
 * 【它做什么】把「导出判路 + 执行 + 回写画布」收敛成一个 hook，不再摊在 `VideoEditorDock` 身上。
 * 判据与执行**原样搬自**原 Docker 的导出段（`docs/120` C5.1：走两条路由计划一个入口 runExport）。
 *
 * 【归属】`panels/dock/`（与 `useEditorProject` 同层）。它 import `export/**` 是**合法**的 ——
 * `check-arch` 规则 6 只锁 `videoEditor/hooks/**` 禁依赖 `export/**`，本文件不在 `hooks/` 下。
 *
 * 【为什么 exportRequest 等在 hook 内 useMemo、onExport 走 ref】`useEditorProject` 每次渲染返新
 * store 对象 ⇒ 依赖它的引用身份会漂。onExport 是**事件驱动**（点按钮才跑），不依赖 identity，
 * 只需读到**最新**的 exportRequest/plan/kindByUrl —— 直接从本 hook 的闭包取即可（它们在每次渲染
 * 重建，onExport 绑定最新的那次）。
 */
import { useMemo, useRef, useState } from 'react';
import { type Node } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useCanvasEdges } from '../../../base/canvas/CanvasEdgesContext.tsx';
import { spawnAndCommit } from '../../../base/canvas/deriveNodes.ts';
import { generateId } from '../../../base/core/idGen.ts';
import { showToast } from '../../../base/core/toastStore.ts';
import { UPLOAD_DIRS } from '../../../base/utils/uploadDirs.ts';
import { uploadResult } from '../../../base/utils/videoEngine.ts';
import {
  planExport,
  runExport,
  type ExportPlan,
  type ExportRequest,
  type ExportStage,
} from '../../export/pipeline.ts';
import { readSourceBlob } from '../../hooks/useEditorSources.ts';
import type { EditorClipSource } from '../../hooks/useEditorSources.ts';
import type { MediaProfile } from '../../core/routeClip.ts';
import type { Clip, ClipKind, Project } from '../../core/types.ts';

/** 导出产物的节点尺寸（与 `VideoProcessNode` 的产物同款，C4.8「同型」）。 */
const EXPORT_NODE_STYLE = { width: 420, height: 380 };

export interface EditorExport {
  exportRequest: ExportRequest | null;
  plan: ExportPlan | null;
  /** C12.2：M1 只做「如实显示」黑边，不假装能消掉（yes/no/unknown）。 */
  letterbox: 'yes' | 'no' | 'unknown';
  kindByUrl: ReadonlyMap<string, ClipKind>;
  exporting: boolean;
  exportStage: ExportStage | null;
  exportProgress: number;
  abortExport: () => void;
  onExport: () => Promise<void>;
}

export function useEditorExport(opts: {
  flow: ReactFlowInstance;
  history: ReturnType<typeof useCanvasEdges> | null;
  project: Project | null;
  allClips: Clip[];
  sources: { byClipId: ReadonlyMap<string, EditorClipSource> };
  /** 基座存活（挂载期 true / 卸载期 false）；导出异步回写前要复核。 */
  aliveRef: { current: boolean };
}): EditorExport {
  const { flow, history, project, allClips, sources, aliveRef } = opts;

  /** 参与导出的片段 + 画像。**断链片段不入清单** —— 由 C13 预检条让用户知情，不静默跳过。 */
  const exportRequest = useMemo((): ExportRequest | null => {
    if (!project) return null;
    const sources2: ExportRequest['sources'] = [];
    const profiles = new Map<string, MediaProfile>();
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
  const letterbox = useMemo<'yes' | 'no' | 'unknown'>(() => {
    if (!project) return 'unknown';
    const target = project.settings.width / Math.max(1, project.settings.height);
    const sized = allClips
      .map((c) => sources.byClipId.get(c.id)?.profile)
      .filter((p): p is MediaProfile => p?.width !== undefined && p?.height !== undefined);
    if (sized.length === 0) return 'unknown';
    return sized.some(
      (p) => Math.abs((p.width as number) / Math.max(1, p.height as number) - target) > 0.01,
    )
      ? 'yes'
      : 'no';
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
  const spawnAssetNode = useMemo(
    () => (url: string, name: string) => {
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

  const onExport = async (): Promise<void> => {
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
      // TD-22-2：落盘失败（null）显式报错 —— 不再静默产出「刷新即失效」的 blob: 节点
      if (!uploaded) {
        showToast('导出失败：结果未能保存到本地（本地服务未启动？）');
        return;
      }
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
  };

  return {
    exportRequest,
    plan,
    letterbox,
    kindByUrl,
    exporting,
    exportStage,
    exportProgress,
    abortExport: () => abortRef.current?.abort(),
    onExport,
  };
}
