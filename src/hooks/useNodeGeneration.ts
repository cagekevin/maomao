import { useCallback, useRef, useEffect } from 'react';
import type { GenerationResult } from '@/types';
import {
  registerTaskRetry,
  unregisterTaskRetry,
  claimNodeRun,
  releaseNodeRun,
} from '../components/base/store/taskStore.ts';
import { updateNodeRuntime, useNodeRuntime } from '../components/base/store/nodeRuntimeStore.ts';
import type { TaskController, NodeRunClaim } from '../components/base/store/taskStore.ts';
import { runGenerationContract } from '../components/base/store/generationContract.ts';
import { logger } from '../components/base/core/logger.ts';
import { subscribe } from '../components/base/core/eventBus.ts';
import { useNodeData } from './useNodeData.ts';

/**
 * 任务控制器：直接复用 taskStore 的权威定义（taskStore 已转 .ts，不再各写一份）。
 * 重新导出以保留本文件原有的对外导出面，调用方无需改动。
 */
export type { TaskController } from '../components/base/store/taskStore.ts';

/** 任务上报信息（节点类型 / 提示词 / 模型名） */
export interface GenerationTypeInfo {
  type: string;
  prompt?: string;
  modelName?: string;
}

/** 传给 run 执行器的参数 */
export interface NodeGenerationRunArgs {
  progress: (percent: number, stage?: string) => void;
  signal: AbortSignal;
  taskId: string;
}

/** run 执行器返回的结果信封 —— 别名对齐 GenerationResult（单一真源 src/types/provider.ts，L3c，禁另立 interface） */
export type NodeGenerationResult = GenerationResult;

/**
 * start() 的「已触发」返回值（成功 / 失败 / 中止 / 并发在跑）。
 * 【TD-01-6】start 另有 `false` 一态 = **未触发**（loading 忙 / 校验不过），见 `NodeGenerationApi.start`；
 * 两者语义有别——`{ok:false}` 是「触发了但失败」，`false` 是「压根没触发」。
 */
export interface NodeGenerationStartResult {
  ok: boolean;
  resultUrl?: string;
  error?: string;
  aborted?: boolean;
  inFlight?: boolean;
}

/** onRecover 收到的广播详情（agent:task-completed 载荷子集） */
export interface TaskCompletedDetail {
  taskId?: string;
  nodeId?: string;
  resultUrl?: string;
  type?: string;
  status?: string;
}

/** validate() → 错误文案或空串 */
export type GenerationValidate = () => string | undefined | null;
/** run(args) → 结果信封 */
export type GenerationRunner = (
  args: NodeGenerationRunArgs,
) => Promise<NodeGenerationResult | undefined>;
export type GenerationOnSuccess = (result: NodeGenerationResult, taskCtl: TaskController) => void;
export type GenerationOnRecover = (detail: TaskCompletedDetail) => void;

export interface UseNodeGenerationOptions {
  nodeId: string;
  /** 任务上报信息 */
  type: GenerationTypeInfo;
  validate?: GenerationValidate;
  run?: GenerationRunner;
  onSuccess?: GenerationOnSuccess;
  onRecover?: GenerationOnRecover;
  /** 声明后成功时自动 patchData({ [resultKey]: url })，省去 onSuccess 手写写回 */
  resultKey?: string;
  /** 声明后收到 task-completed 自动回填 node.data[resultKey] */
  recoverable?: boolean;
}

export interface NodeGenerationApi {
  loading: boolean;
  error: string;
  /** 【TD-01-6】`false` = 未触发（loading 忙 / 校验不过）；对象 = 已触发结果。两者勿混。 */
  start: () => Promise<NodeGenerationStartResult | false>;
  stop: () => void;
}

// 日志里的提示词只保留前 80 字：剧本盒子等场景的镜头提示词动辄上千字，
// 全量打进 localTool 终端会淹没其它全链路日志。完整原文仍可在节点 data /
// 任务中心（reportGenerate 上报）查到，日志侧只留可定位的摘要。
const LOG_PROMPT_MAX = 80;
function promptPreview(p: string | undefined): string {
  const s = typeof p === 'string' ? p : String(p || '');
  return s.length > LOG_PROMPT_MAX ? `${s.slice(0, LOG_PROMPT_MAX)}…` : s;
}

/**
 * ════════════════════════════════════════════════════════════════
 * 统一「节点生成」契约（useNodeGeneration）—— P0 架构级
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么要有它（架构评审核心发现）】
 * 此前每个生成节点的 handleGenerate 都手写同一套样板：
 *   解析 provider → reportGenerate → taskCtl.progress → 调 API
 *   → 成功写 node.data + taskCtl.done / 失败 setError + taskCtl.fail
 *   → registerTaskRetry 注册重生成回调（供 Agent runNodeGeneration / 测试驱动）
 * ImageGenerate / TextGenerate / VideoGenerate 各重复约 40 行，
 * 且 Agent 的 generate_node 工具是死桩（没接真实生成）。
 * 未来 28 个节点逐个接真引擎时，若没有统一契约，每个节点都要重复踩一遍坑，
 * 还容易「任务中心有结果、节点卡片没结果」或反之的不一致。
 *
 * 【它收敛什么】
 *  - 统一「提交任务 → 进度 → 成功双写(taskStore + node.data) / 失败」契约
 *  - 统一重生成回调注册（registerTaskRetry，供 Agent runNodeGeneration 驱动）
 *  - Agent / 测试 / 脚本通过 runNodeGeneration(nodeId) 驱动任意节点生成
 *
 * 【真相源契约（节点必守，P0）】任务中心为结果权威源，node.data 为渲染缓存副本：
 *  1. onSuccess 必须把结果写回 node.data（如 patchData({ assetUrl: r.url })），
 *     否则刷新后节点因 data 无持久 URL 而丢结果（结果只在任务中心）。
 *     对照样板：ImageGenerate / VideoGenerate.onSuccess 写 data.assetUrl / data.videoUrl。
 *  2. 异步可恢复的节点必须声明 onRecover（见下），收到 agent:task-completed 广播
 *     把持久 resultUrl 写回 node.data，刷新后自动恢复显示。
 *  3. 文本类节点（结果本体在 data.text、任务中心 resultUrl 为空）不适用 onRecover，
 *     由 data.text 随画布快照落盘恢复，无需传此回调。
 *  4. 方向单向：写只走本契约，刷新后任务中心 → 节点回填，节点不回写任务中心。
 *
 * 【瞬态收口·阶段二】loading/error（瞬态）归 nodeRuntimeStore（按 nodeId 内存 Map），
 *   不入 node.data / 画布快照 → 复制节点天然隔离，杜绝「半个 loading 被复制走」。
 *   本 hook 直接经 useNodeRuntime 读、updateNodeRuntime 写，对外接口 { loading, error }
 *   不变，各生成节点遮罩读取几乎不动；进度仍经 taskCtl.progress 走任务中心。
 *
 * 【用法】
 *   const gen = useNodeGeneration({
 *     nodeId: id,
 *     type: { type: 'image', prompt: p, modelName: modelId },  // 任务上报信息
 *     validate: () => (p.trim() ? '' : '请输入提示词'),          // 前置校验，返回错误文案或空串
 *     run: async ({ progress }) => generateImage({...}, progress),  // 真执行器
 *     onSuccess: (r, ctx) => { setAssetUrl(r.url); setImgPrefs({...}); },  // 成功回写 node.data
 *     onRecover: ({ resultUrl }) => { setAssetUrl(resultUrl); patchData({ assetUrl: resultUrl }) },  // 广播回填（异步可恢复节点必传）
 *     // ── P0-2-b 声明式写法（推荐，省去手写「写回 node.data」样板）──
 *     resultKey: 'assetUrl',   // 声明后成功时自动 patchData({[resultKey]: r.url})
 *     recoverable: true,       // 声明后收到 task-completed 自动回填 patchData({[resultKey]: resultUrl})
 *     // 声明了 resultKey/recoverable 即可省略 onSuccess 与 onRecover 里的写 node.data 部分、
 *     // 但 onSuccess 中 UI state 回写（如 setAssetUrl）与业务逻辑仍需保留。
 *     // 文本类节点（结果在 data.text、任务中心 resultUrl 为空）不传 recoverable。如 onRecover 不适用此自动回填，可省略。
 *     // 注意：onRecover/onSuccess 与声明式并存时，若都写了同一字段会幂等双写（无害）。
 *   })
 *   // gen = { loading, error, start, stop }
 *
 * 【run 返回契约】
 *   { ok: true, url?, content? }            → 成功（url/content 给 onSuccess 回写与 node.data
 *                                              任务中心 resultUrl；doneUrl 悬空契约已删，统一用 r.url（B2））
 *   { ok: false, error: '原因' }            → 失败（自动 setError + taskCtl.fail）
 *
 * 【中止说明】
 *   stop() 目前只清 loading/error，不中断网络请求（真 API 的中断需 AbortController，
 *   待接真引擎时在 run 内用 AbortSignal 实现，start/stop 对外接口不变）。
 */
export function useNodeGeneration({
  nodeId,
  type,
  validate,
  run,
  onSuccess,
  onRecover,
  resultKey,
  recoverable,
}: UseNodeGenerationOptions): NodeGenerationApi {
  // P0-2-b：声明 resultKey/recoverable 后可省去节点手写「写回 node.data」样板（经 useNodeData 统一 patchData）
  const { patchData } = useNodeData(nodeId);
  const resultKeyRef = useRef<string | undefined>(resultKey);
  resultKeyRef.current = resultKey;
  const recoverableRef = useRef(!!recoverable);
  recoverableRef.current = !!recoverable;
  // 【瞬态收口·阶段二】loading/error 统一归 nodeRuntimeStore（内存级，按 nodeId 键，
  // 复制天然隔离）。对外接口不变：本 hook 仍返回 { loading, error }，节点代码几乎不动。
  const { loading, error } = useNodeRuntime(nodeId);
  // AbortController：stop() 真中断请求（Step C）。run 执行器接收 signal 并传给底层 API（Step A 已支持）。
  const abortRef = useRef<AbortController | null>(null);
  // 【TD-01-5 · 2026-09-13】原 `runningRef` 同步防重已删：`claimNodeRun`（taskStore 同步 Map 锁，
  // 本函数第一句）已覆盖同 tick 重入——claim 成功即证明无在跑（唯一置位点就是本函数，各退出路径皆复位），
  // 故 runningRef 在本函数内恒为 false（死 ref）。防重实际由 claim + 下方 `loading` 守卫共同承担。

  const runRef = useRef<GenerationRunner | undefined>(run);
  runRef.current = run;
  const onSuccessRef = useRef<GenerationOnSuccess | undefined>(onSuccess);
  onSuccessRef.current = onSuccess;
  const onRecoverRef = useRef<GenerationOnRecover | undefined>(onRecover);
  onRecoverRef.current = onRecover;
  const validateRef = useRef<GenerationValidate | undefined>(validate);
  validateRef.current = validate;
  const typeRef = useRef<GenerationTypeInfo>(type);
  typeRef.current = type;

  const start = useCallback(async (): Promise<NodeGenerationStartResult | false> => {
    // 【P1-E 跨发起方并发锁】先占单节点互斥锁（taskStore 层，任何发起方都经本 start 汇聚）。
    // 同节点已有进行中（Agent runNodeGeneration / 用户手动 start）→ 明确返回「进行中」，不并发生成。
    const claim: NodeRunClaim = claimNodeRun(nodeId);
    if (!claim.ok) {
      logger.debug('生成', '[节点] 已在生成，跳过并发', { nodeId }, { module: 'image' });
      return { ok: false, inFlight: true };
    }
    // 【TD-01-5 收窄】`loading` 守卫**保留**（非冗余）：其它流程会独立置 loading:true
    //（如 VideoProcessNode 自管的处理流程 `updateNodeRuntime(id,{loading:true})`，不持有本 claim）→
    // 节点忙时不并发起生成。原先一并检查的 `runningRef` 已删（见上方说明：claim 已覆盖，恒 false）。
    if (loading) {
      releaseNodeRun(nodeId);
      return false;
    }
    const v = validateRef.current?.();
    if (v) {
      updateNodeRuntime(nodeId, { error: v });
      releaseNodeRun(nodeId);
      return false;
    }

    updateNodeRuntime(nodeId, { loading: true, error: '' });
    // 每次 start 重建 AbortController（旧请求先取消，避免并发）
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    // 缺省兜底用完整形状而非 `|| {}`，否则 t 退化为 `{}`、取 t.type/t.prompt 会报属性不存在
    const t: GenerationTypeInfo = typeRef.current || { type: '', prompt: '', modelName: '' };
    // 任务中心上报 / 进度 / done-fail 分类统一由 runGenerationContract 承载（TD-01-8）
    logger.info('生成', 'start', { nodeId, type: t.type, prompt: promptPreview(t.prompt) });
    // 【B层】节点生成入口：prompt 摘要 + 节点类型（定位是哪个节点、发的什么提示词触发生图）
    logger.debug(
      '生成',
      '[节点] start',
      {
        nodeId,
        type: t.type,
        prompt: String(t.prompt || '').slice(0, 120),
        modelName: t.modelName,
      },
      { module: 'image' },
    );
    try {
      // 【TD-01-8 收口】编排序列（report→progress→run→localize→落盘→写回→done/fail 分类）
      // 交给 runGenerationContract（与剧本盒同一份实现）；本 hook 只保留 React 侧职责：
      // claim / validate / loading 状态 / AbortController，以及「写回 + 错误落点」回调。
      return await runGenerationContract({
        taskNodeId: nodeId,
        type: t.type,
        prompt: t.prompt,
        modelName: t.modelName,
        signal: ctl.signal,
        run: (args) => runRef.current(args),
        // 首写：resultKey 自动 patchData + 节点 onSuccess 特化（与旧实现同序：先写回、后落盘）
        settle: (url, r, taskCtl) => {
          const resultKey = resultKeyRef.current;
          if (resultKey && url) patchData({ [resultKey]: url });
          onSuccessRef.current?.(r, taskCtl);
        },
        // 落盘后的持久 URL 覆盖写回（旧「patchData(持久)」一步；原语保证仅在与显示 URL 不同时调用）
        onPersisted: (persistedUrl) => {
          const resultKey = resultKeyRef.current;
          if (resultKey) patchData({ [resultKey]: persistedUrl });
        },
        onFail: (msg) => updateNodeRuntime(nodeId, { error: msg }),
        onAbort: () => updateNodeRuntime(nodeId, { error: '' }),
        logTag: '生成',
        // 降级留痕的 layer 用**模块名**（不是日志标签）：degrade 观测按「层」归组，读者不同（Step 4 三问③）
        degradeLayer: 'useNodeGeneration',
        logCtx: { nodeId, prompt: promptPreview(t.prompt) },
      });
    } finally {
      updateNodeRuntime(nodeId, { loading: false });
      releaseNodeRun(nodeId); // 【P1-E】释放单节点互斥锁
    }
  }, [loading, nodeId, patchData]);

  // stop：真中断底层请求（Step C）。请求经 signal 传到 imageApi/videoApi，abort 后 fetch/轮询中断。
  const stop = useCallback(() => {
    abortRef.current?.abort();
    updateNodeRuntime(nodeId, { loading: false });
  }, [nodeId]);

  // 重生成回调注册：让 Agent runNodeGeneration（generate_node 工具）能驱动本节点重新生成
  // （任务中心「再来一次」入口已于 2026-09-12 删除——第二入口剧本盒资产任务未接 retry，点必失败，故整体移除）
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (!nodeId) return;
    registerTaskRetry(nodeId, () => startRef.current());
    return () => unregisterTaskRetry(nodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // 【精准节点回填】监听异步任务恢复轮询的完成广播（taskStore/pollTask 发 agent:task-completed，经 eventBus）。
  // 只有「任务归属的节点」（detail.nodeId === 本 nodeId）才响应 → 精准：其他在跑的/不相关的节点忽略。
  // 收到后回调 onRecover(detail)，由各节点把 resultUrl 写回 node.data（刷新后节点卡片自动恢复显示结果）。
  // 用 ref 存最新 onRecover，监听只在挂载时注册一次，避免每次渲染重建。
  useEffect(() => {
    if (!nodeId) return;
    const handler = (payload: unknown) => {
      const d = payload as TaskCompletedDetail | undefined;
      if (!d) return;
      // 只认本节点 + 已完成 + 有结果 URL 的广播，其余忽略（精准）
      if (d.nodeId !== nodeId) return;
      if (d.status !== 'completed' || !d.resultUrl) return;
      // P0-2-b：声明 recoverable + resultKey 后自动回填 node.data[resultKey]，省去 onRecover 手写写回样板
      if (recoverableRef.current) {
        const resultKey = resultKeyRef.current;
        if (resultKey) patchData({ [resultKey]: d.resultUrl });
      }
      onRecoverRef.current?.(d);
    };
    return subscribe('agent:task-completed', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  return { loading, error, start, stop };
}
