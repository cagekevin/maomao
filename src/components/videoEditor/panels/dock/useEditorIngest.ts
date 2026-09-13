/**
 * 基座入轨编排 —— `docs/120` C11（画布点选素材 → 追加到对应类型轨尾）。
 *
 * 【它做什么】把「点选即入轨」的判定 + 执行收敛成 hook。关键是不变式：
 *   - **单一真源**：该不该入轨只看「选中集内容签名之间的差」，不另读一次 `getNodes()` 实时态
 *     （那次读与渲染期快照可能不一致 = 复现过「点选一次出两条」的根因，`dockEnqueue.test.tsx`）。
 *   - **幂等**：用「已处理集合」而非「上一个签名」。
 *   - **C11.5 激活门**：折叠态点选**不留痕**（`if (!open) return;` 必须在 enqueue 前）。
 *
 * 【ref 的意义（坑 1 教训）】`useEditorProject` **每次渲染返新 store 对象** ⇒ 任何以它为依赖的
 * useCallback 每次都换身份 ⇒ 入轨 effect 每次渲染都跑。故 flow/store 经 ref 传递，effect 依赖只剩
 * 选中集 + 开合，运行次数与语义对上。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import {
  deriveSelectedAssets,
  selectedAssetSig,
  selectedNodeIdsOfSig,
} from '../../../base/canvas/nodeMedia.ts';
import { generateId } from '../../../base/core/idGen.ts';
import { showToast } from '../../../base/core/toastStore.ts';
import { loadEditorSource } from '../../hooks/useEditorSources.ts';
import { DEFAULT_IMAGE_CLIP_DURATION } from '../../core/constants.ts';
import { routeClipToTrack } from '../../core/routeClip.ts';
import { appendTime, trackAccepts } from '../../core/timelineOps.ts';
import type { Clip, ClipKind } from '../../core/types.ts';
import type { EditorProjectStore } from './useEditorProject.ts';

/** 入轨的自闭环副作用 hook：用户点选素材节点 → 自动落轨尾；Docker 无需使用返回值。 */
export function useEditorIngest(opts: {
  flow: ReactFlowInstance;
  open: boolean;
  store: EditorProjectStore;
  /** 基座存活（导出与入轨共享；入轨等待探测期间基座可能已折叠/切项目）。 */
  aliveRef: { current: boolean };
}): void {
  const { flow, open, store, aliveRef } = opts;

  /**
   * 选中集的**内容签名**（`base/canvas/nodeMedia` 既有原语，不含坐标 —— 拖动不触发重算）。
   * 为什么用签名而不是订阅「选中事件」：入轨只在**选中集真变了**的那一次发生。
   * C11.4「点几次就上几条」——取消选中再点它 = 签名变了 = 再上一条。
   */
  const selectedSig = useStore((s) => selectedAssetSig(deriveSelectedAssets(s.nodes)));

  /** 让入轨逻辑拿到**最新**的 flow / store，同时**不让它们进入 effect 依赖**（见文件头）。 */
  const flowRef = useRef(flow);
  const storeRef = useRef(store);
  useEffect(() => {
    flowRef.current = flow;
    storeRef.current = store;
  });

  /** 开合态最新值（入轨 await 探测期间折叠了 → 不留痕）。 */
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /**
   * **已处理的选中集** —— 「已经为它入过轨」的 nodeId。
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

      // 时长必须先知道：**没有时长就没有片段** —— 片段在时间轴上**只**由 `timelineStart + clipDuration` 存在。
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

      const target = routeClipToTrack(clip.kind); // C11.1 分轨唯一判据（片段该进哪一类轨）
      let rejection: string | null = null;
      storeRef.current.applyTracks((tracks) => {
        // 落轨规则（M2 多轨，用户口径）：「**第一条可用的同类轨**」。
        // 可用 = 未锁定且未隐藏（判据单点在 `core/timelineOps.ts::trackAccepts`，不在此重写）。
        // 为什么不是「最后一条 / 新增的那条」：用户点选素材时并不预期"落到哪条"，
        // 落到第一条可用轨是最小惊奇；要换轨就把片段拖过去（跨轨拖拽已支持）。
        const chosen = tracks.find((t) => t.kind === target && trackAccepts(t));
        if (!chosen) {
          // 同类轨全不可用 → 明说原因（C7.3：不静默丢弃）
          rejection = `没有可用的${target === 'audio' ? '音频' : '视频'}轨（全部锁定或隐藏），未入轨`;
          return tracks;
        }
        return tracks.map((t) =>
          t.id === chosen.id
            ? { ...t, clips: [...t.clips, { ...clip, timelineStart: appendTime(t) }] }
            : t,
        );
      });
      if (rejection) showToast(rejection);
    },
    // 依赖 = 宿主传入的稳定存活 ref（非 useRef 创建，故显式列出以消 lint）+ 本 hook 内 refs。
    // ref 对象身份恒定 → enqueue 身份仍稳定 = 入轨 effect 只在**选中集真的变了**时跑（见文件头「点一次出两条」）
    [aliveRef],
  );

  useEffect(() => {
    // **唯一真源**：该不该入轨，只看「本次签名声明的 id」与「已处理集合」的差。
    const ids = selectedNodeIdsOfSig(selectedSig);
    const fresh = ids.filter((id) => !handledRef.current.has(id));
    // 折叠与否都要**跟上**已处理集，否则展开瞬间会把「折叠期间选中过」的节点补入轨
    handledRef.current = new Set(ids);
    // C11.5 激活门：折叠态**不留痕**（必须在 enqueue 之前）
    if (!open) return;
    for (const id of fresh) void enqueue(id);
  }, [selectedSig, open, enqueue]);
}
