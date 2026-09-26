import { useEffect, useRef, useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { createScriptBoxEngine } from './scriptBoxEngine.ts';
import {
  normalizeScriptBoxData,
  parseAssetTaskNodeId,
  parseTailFrameTaskNodeId,
  type ScriptBoxData,
} from './scriptBoxSchema.ts';
import { subscribe } from '../base/core/event/eventBus.ts';
import { TASK_COMPLETED_EVENT } from '../base/core/contracts.ts';
import { localizeAndStoreToResourceLibrary, resourceFolderOf } from '../resource/resourceStore.ts';
import { injectNodePrefs, commitNewNodes } from '../canvas';

import { useProvidersList, useEnsureProvidersLoaded } from '../settings/providerStore.ts';
import { logger } from '../base/core/log/logger.ts';

// 写回通道契约收口在 scriptBoxSchema（引擎与 hook 共用同一份，避免两处漂移）
import type { ScriptBoxUpdateData, ScriptBoxCallbacks } from './scriptBoxSchema.ts';
export type { ScriptBoxUpdateData };

/**
 * 剧本盒子 —— 引擎回调注入 hook（对应官方 H_.jsx 的注入机制 A/B）。
 *
 * 职责铁律（docs/剧本盒子/剧本盒子职责划分.md）：
 *  - 引擎回调必须由「能拿到 setNodes/getNodes/坐标」的宿主创建，再经**本 hook 返回值**下发；
 *  - UI 组件（ScriptBoxNode / scriptbox/*）只调 callbacks.onXxx?.(...)，不做引擎；
 *  - 数据只存 node.data，引擎经 setNodes 写回、UI 编辑经 updateData 写回。
 *
 * 为什么放剧本盒子自己的 hook 而不是 App.jsx：
 *  - 用 useReactFlow() 就能拿到 getNodes/setNodes/getEdges/screenToFlowPosition，
 *    无需 App 传参，App 保持通用画布壳，不变成垃圾场；
 *  - 剧本盒子专用逻辑聚在本模块，与 scriptBoxEngine.js 同类。
 *
 * 用法：在 ScriptBoxNode 内调用本 hook。它：
 *  - 创建并缓存一份 createScriptBoxEngine 实例（ref，跨 render 稳定）；
 *  - **把 15 个 onXxx 回调作为返回值下发**（不再写进 node.data —— 见下「为什么回调不进 data」）。
 *
 * 【为什么回调不进 node.data（TD-09-4 · 2026-09-16）】
 * 回调是「引擎 ↔ UI 的会话契约」，不是画布数据：node.data 经 `canvasSnapshotSchema.NODE_KEEP`
 * 以 `data` 整包落盘（`JSON.stringify`）。函数在序列化时被**静默丢弃**（`AbortController`/`Map`
 * 甚至静默变 `{}`），历史上靠「每次挂载重新注入」掩盖了「每次落盘都在丢」。且
 * `ScriptBoxNodeData extends ScriptBoxCallbacks` 让**持久化类型物理声明了函数字段**（类型不诚实）。
 * 现改为经 React 通道下发：data 里不再有函数，类型诚实 + 落盘不再丢 + 删掉重注入兜底。
 *
 * @param nodeId  剧本盒子节点 id
 * @param data    节点当前 data（仅兜底；引擎主要经 getNodes 实时读最新 data）
 *   【2026-09-11】故意声明为 `object` 而非 `Record<string, unknown>`：节点 data 有自己的 interface
 *   （且已删 `[key: string]: unknown` 索引签名，见 TD-8 / L2），要求 Record 会反向逼节点加回索引签名。
 *   本 hook 只把它当「任意对象兜底」透传给 normalizeScriptBoxData，就地收窄一次即可。
 */
export function useScriptBoxEngine(
  nodeId: string,
  data?: object,
): { updateData: ScriptBoxUpdateData; callbacks: ScriptBoxCallbacks } {
  const { getNodes, getNode, getEdges, setNodes, setEdges, screenToFlowPosition } = useReactFlow();

  // 供应商（多 provider，接真系统）：引擎经 getProviderState 实时读 providers + 主供应商，
  // 生成/生图时按模型 value（providerId::modelId）解析到对应 provider，再经统一生成入口 /api/generate 转发（旧 /api/proxy 出站已随 2026-09-03 收口退役）。
  // P5 原子订阅：只订阅 providers 列表，不随 providerStore 的 dirty/loading/testResult 连坐重渲染。
  const providers = useProvidersList();
  // 首次挂载确保供应商已加载（生成/生图前必须有 provider，否则解析不到模型）
  // 供应商加载（**唯一实现**，含失败可见性）：原来三处各写一份 `load().catch(logger.warn)`
  // —— 加载失败时这里静默为空，随后用户收到误导性的「请先配置模型」（TD-24-4 §二）。
  useEnsureProvidersLoaded();

  // providers 实时镜像到 ref：引擎实例经 useRef 只创建一次（跨 render 稳定），
  // 若 getProviderState 直接闭包捕获「首次 render 的 providers」（此时异步加载未完成 → 空数组），
  // 之后 providers 加载完成也不会更新闭包 → 引擎永远读到空供应商 → 生成一直报「请先配置模型」。
  // 故用 providersRef 在每次 render 同步最新值，getProviderState 读 ref.current，打破闭包过期。
  const providersRef = useRef(providers);
  providersRef.current = providers;

  // 书写回通道（统一收口，ScriptBoxNode / Step 组件共用）：
  // 支持对象 patch 与函数式 patch `(latestData)=>patch`（并发安全合并，避免读到旧引用导致状态互相覆盖）。
  // 用 useCallback 保证跨 render 稳定（ScriptBoxNode 是 React.memo，稳定引用可减少无谓重渲染）。
  const updateData = useCallback<ScriptBoxUpdateData>(
    (patch) =>
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== nodeId) return n;
          const latest = n.data || {};
          const resolved = typeof patch === 'function' ? patch(latest as ScriptBoxData) : patch;
          return { ...n, data: { ...latest, ...resolved } };
        }),
      ),
    [nodeId, setNodes],
  );

  // 引擎实例用 ref 缓存，跨 render 稳定（不因 data 变化重建导致子组件重渲染）
  const engineRef = useRef<ReturnType<typeof createScriptBoxEngine> | null>(null);
  if (!engineRef.current) {
    engineRef.current = createScriptBoxEngine({
      // 读最新 data：经 useReactFlow().getNode 实时取（O(1) hash 查，替 getNodes().find），避免闭包捕获旧值。
      // P0-0 数据契约：读取前先 normalizeScriptBoxData 补齐缺省（旧画布/新建节点缺新字段不漂移）。
      // data 静态类型是 object（见上方 JSDoc），normalizeScriptBoxData 的入参契约是 Record；
      // 就地收窄一次（语义安全：它只做「任意对象 + 补齐默认值」）。
      getData: () =>
        normalizeScriptBoxData((getNode(nodeId)?.data ?? data ?? {}) as Record<string, unknown>),
      // 写回 node.data：经 setNodes 不可变更新（引擎唯一写回通道）。
      // 支持两种形态：对象 patch（直接合并）或函数 `(latestData) => patch`（基于最新 data 计算，
      // 供并发场景下安全合并，避免 getData() 读到旧引用导致状态互相覆盖）。
      updateData,
      nodeId,
      // 【TD-07-9 C 组 · 2026-09-20】原为 `setEdges as unknown as (updater) => void`
      //   —— **双重断言**会把整个函数变得不受检查（引擎传错参数也不报错）。
      //   引擎有意与 React Flow 解耦（用 `unknown[]` 保可单测性，与它对节点用 `NodeLike` 同手法）
      //   ⇒ 边界处**一次**断言不可避免；但改为下面这种后，**不检查面从「整个函数」缩到「返回值」**：
      //   入参 `es` 仍是 React Flow 真类型（引擎拿到什么由它决定），只有 `unknown[] → 边[]` 这一处断言。
      setEdges: (updater) => setEdges((es) => updater(es) as typeof es),
      getNodes,
      // 供应商解析（接真系统）：返回 { providers, primary }，供引擎选模型/转发
      // 注意：读 providersRef.current 而非闭包捕获的 providers，避免闭包过期读到空数组。
      getProviderState: () => {
        const list = providersRef.current || [];
        return { providers: list, primary: list.find((p) => p.primary) || list[0] || null };
      },
      // 连线：经 commitNewNodes 建下游节点，位置用 screenToFlowPosition 算落点基准。
      // 【复用系统新建入口的模型记忆】剧本盒子建节点不走 App.addNode，故在此补 injectNodePrefs，
      // 把 localStorage「上次选择的模型」填进 data.selectedModel —— 否则新节点 selectedModel 恒为 ''，
      // 且 useGenerateNode 的「自动选第一个模型」兜底被 prefs.model 守卫挡掉，永远补不回来。
      // injectNodePrefs 仅补 data 里未显式传的字段，剧本盒已预填的 aspectRatio/size/selectedSeconds/label 不受影响。
      // 【TD-04-2】改用 commitNewNodes：补结构默认 + 原子写（替代原裸 addNodes）→ 与 App.addNode 的
      //   结构默认口径一致（此前剧本盒建的节点手写 width/height，与 nodeDefaults 单源表漂移）。
      //   ⚠️ 不传 history：边由 scriptBoxEngine 紧随其后单独 setEdges 写入（不经 history），若此处
      //   只把「节点」记进 history，undo 会撤掉节点却留下悬空边。故本回调与边保持同口径 = 均不进 history。
      //   【已裁定·勿改（2026-09-11 用户确认）】剧本盒「建节点」不纳入 undo 撤销栈 = **有意设计，非债**：
      //   它建的是批量生成的中间产物节点，用户手动 Ctrl+Z 撤这类系统派生节点非主流程、且易与「重新生成」
      //   混淆；为此给引擎加原子 addNodeWithEdge API 的复杂度不值当。后续 AI 勿当 bug 去「补撤销」。
      //   （原 TD-04-10 据此结案为「非债·不改」。）
      addNodes: (nodes) => {
        const base = screenToFlowPosition?.({ x: 0, y: 0 }) ?? { x: 0, y: 0 };
        const prepared = nodes.map((raw) => {
          const nd = raw as Node;
          const data = { ...nd.data };
          injectNodePrefs(nd.type ?? '', data);
          return {
            ...nd,
            data,
            position: {
              x: (nd.position?.x ?? 0) + base.x + 100,
              y: (nd.position?.y ?? 0) + base.y,
            },
          };
        });
        commitNewNodes({ nodes: prepared }, { getNodes, getEdges, setNodes, setEdges });
      },
    });
  }

  // 引擎回调（引擎实例即回调集合）：经本 hook 返回值下发，**不再写进 node.data**（TD-09-4）。
  const callbacks = engineRef.current;

  // ════════════════════════════════════════════════════════════════
  // 【刷新自愈】清掉被落盘的「执行态」（genMask / 各级 loading）
  // ════════════════════════════════════════════════════════════════
  // 【要解决的病（用户可见）】下面这些是**瞬时 UI 标志**，却写在 node.data 里，经
  //   `canvasSnapshotSchema.NODE_KEEP` 的「data 整包透传」随画布快照落盘 ⇒ 刷新后被原样恢复：
  //     · 顶层 `genMask`                      → 步骤1 标题栏「生成中 N 字 · Ns」计时器
  //       （标题里的 `genChars` 同样落盘，但**经取证恒为 0** —— 全仓唯一写点就是生成开始时
  //        `updateData({ genMask: true, genChars: 0 })`，此后从无递增 ⇒ 它不是脏值，故不清理）
  //     · `shots[].promptLoading`             → 步骤3 卡片「正在生成提示词…」遮罩
  //     · `shots[].imgGenLoading`             → 步骤3 卡片「正在生成关键帧…」遮罩
  //     · `shots[].tailFrameVariantsLoading`  → 步骤3 尾帧变体遮罩
  //     · `assets[].loading`                  → 步骤2 资产卡遮罩
  //   而刷新后**没有任何一条路径会来复位它**：
  //     ① 生成任务的 .then/.catch、② `runAbortable` 的 withTimeout 守卫 —— 都随页面卸载消失；
  //     ③ `normalizeScriptBoxData` 只补缺省（`{...默认, ...存量}`，存量赢），不复位执行态；
  //     ④ 文本任务无 resultUrl ⇒ 被下方 recover handler 的 `!d.resultUrl` 守卫挡掉，无恢复通道。
  //   ⇒ 表现为「计时器从 0 重新开始涨、遮罩永在」＝用户报的「文本一直在跑，永远不停止」。
  //
  // 【判据（与本仓既有先例一致：执行态不入持久化）】
  //   · `agent/conversation/conversationState.ts` P4 自愈：streaming「绝不该落盘、水化即清」；
  //   · `task/nodeRuntimeStore.ts`：loading/error 是纯瞬态，「不入 node.data / 画布快照」。
  //   本处只做该判据的**「水化即清」半边**（另半边=把执行态迁出 node.data，本轮不做）。
  //
  // 【为什么放这里，而不是放进 `normalizeScriptBoxData`】normalize 被 `getData()` **每次读取**
  //   都调用；放进去会把**正在生成中**的 loading 一起清掉（动画消失）。必须只在挂载这一刻擦一次。
  //
  // 【幂等与开销】① 每个 nodeId 只做一次（ref 守卫，含 StrictMode 双调用）；
  //   ② 无残留时**直接 return，不写回**——避免每次挂载都白触发一次 setNodes（连带一次快照落盘）。
  //   复位只碰执行态，不改动任何业务数据（shots 内容 / assets 内容 / 用户输入一概不动）。
  // ════════════════════════════════════════════════════════════════
  const runtimeCleanedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nodeId || runtimeCleanedRef.current === nodeId) return;
    runtimeCleanedRef.current = nodeId;
    const d0 = normalizeScriptBoxData((data ?? {}) as Record<string, unknown>);
    const genMaskOn = Boolean((d0 as { genMask?: unknown }).genMask);
    const shotsBusy = (d0.shots || []).some(
      (s) => s.promptLoading || s.imgGenLoading || s.tailFrameVariantsLoading,
    );
    const assetsBusy = (d0.assets || []).some((a) => a.loading);
    if (!genMaskOn && !shotsBusy && !assetsBusy) return; // 无残留 → 不写回（零开销）
    updateData((latest) => ({
      ...(genMaskOn ? { genMask: false } : {}),
      ...(shotsBusy
        ? {
            shots: (latest.shots || []).map((s) =>
              s.promptLoading || s.imgGenLoading || s.tailFrameVariantsLoading
                ? {
                    ...s,
                    promptLoading: false,
                    imgGenLoading: false,
                    tailFrameVariantsLoading: false,
                  }
                : s,
            ),
          }
        : {}),
      ...(assetsBusy
        ? { assets: (latest.assets || []).map((a) => (a.loading ? { ...a, loading: false } : a)) }
        : {}),
    }));
  }, [nodeId, updateData, data]);

  // 【TD-01-9 / TD-01-12】「生成中刷新」回填：任务中心 pollTask 找回 resultUrl 后，经 eventBus 广播
  // `agent:task-completed`。节点侧 useNodeGeneration 按 nodeId 精准回填；剧本盒此前**不订阅**。
  // 本 handler 按**伪 nodeId 前缀**分别回填剧本盒的两类任务（规则单源在 scriptBoxSchema）：
  //   ① 资产图 `${nodeId}-asset-${assetId}` → 回填 data.assets（TD-01-9）
  //   ② 尾帧综合图 `${nodeId}-tailframe-${shotId}` → 回填该镜 composed 变体（TD-01-12）
  // 【TD-01-13 边界补齐】剧本盒生图的**设计意图**是「生成完自动归类进素材库的 人物/场景/道具」
  //（resourceFolderOf(category)），省用户手动拖。但「落素材库」是生成流程的一步，随刷新会中断 →
  // 资产图 recover 时**补一次落库**到同一分类，否则素材库里会缺这张图（用户得手动补）。
  // 【TD-01-25 收口（2026-09-18）】补库的**判据**已从"本会话首次"改为「已归档」状态位
  // （`imageStatus === 'uploaded'`，由**所有**归档路径写入：生成 settle / 手动上传 / 本处补库）——
  // 原判据会在同一会话里重复归档一次，正确性靠 sha1 幂等兜住而非状态（详见下方 handler 注释）。
  const recoveredAssetsRef = useRef(new Set<string>());
  useEffect(() => {
    const handler = (payload: unknown) => {
      const d = payload as { nodeId?: string; resultUrl?: string; status?: string } | undefined;
      if (!d || d.status !== 'completed' || !d.resultUrl) return;
      const taskNodeId = d.nodeId || '';
      const url = d.resultUrl;

      // ① 资产图任务
      const assetId = parseAssetTaskNodeId(nodeId, taskNodeId);
      if (assetId) {
        updateData((latest) => ({
          assets: (latest.assets || []).map((a) =>
            a.id === assetId
              ? { ...a, loading: false, has: true, assetUrl: url, thumbnailUrl: url }
              : a,
          ),
        }));
        // 补「自动归类进素材库」：**判据 = 「已归档」状态位 `imageStatus === 'uploaded'`**（不再是"本会话首次"）。
        // 【TD-01-25 收口】原先是**盲补**：同一会话里生成路径已归档过，而 `taskStore.done()` **必然**再广播一次
        // 到本 handler → 会对同一资产**重复归档一遍**，靠后端 sha1 幂等兜住（补偿步骤形态，掩盖"谁是归档真相"）。
        // 现判据落在状态位上：生成路径真归档了就标 `uploaded`（见 scriptBoxEngine 的 settle），此处据此跳过；
        // 只有**刷新中断**（生成路径从未 settle）才真的补一次。`recoveredAssetsRef` 保留为**同会话在途去重**
        // （补库是 fire-and-forget，状态位写入前可能再来一条广播）—— 两把锁管两件事（在途 vs 已归档），不是同一真相两份。
        const asset = normalizeScriptBoxData(
          (getNode(nodeId)?.data ?? {}) as Record<string, unknown>,
        ).assets?.find((a) => a.id === assetId);
        if (
          asset?.category &&
          asset.imageStatus !== 'uploaded' &&
          !recoveredAssetsRef.current.has(assetId)
        ) {
          recoveredAssetsRef.current.add(assetId);
          void localizeAndStoreToResourceLibrary(url, {
            name: asset.name,
            folder: resourceFolderOf(asset.category),
          })
            .then(() => {
              // 归档成功 → 落状态位（此后同一资产的广播不再触发补库）
              updateData((latest) => ({
                assets: (latest.assets || []).map((a) =>
                  a.id === assetId ? { ...a, imageStatus: 'uploaded' } : a,
                ),
              }));
            })
            .catch((e: unknown) => {
              const err = e instanceof Error ? e : new Error(String(e));
              logger.warn('scriptBox', 'recover 补落素材库失败（图已回填剧本盒，不阻断）', {
                nodeId,
                assetId,
                error: err.message,
              });
            });
        }
        return;
      }

      // ② 尾帧综合图任务（每镜一卡）：写回该镜 composed 变体 + 自动选中 + 复位 loading。
      const shotId = parseTailFrameTaskNodeId(nodeId, taskNodeId);
      if (!shotId) return;
      updateData((latest) => ({
        shots: (latest.shots || []).map((s) => {
          if (s.id !== shotId) return s;
          const variants = Array.isArray(s.prevTailFrameVariants) ? s.prevTailFrameVariants : [];
          const hasComposed = variants.some(
            (v) => (v as { id?: string } | null)?.id === 'composed',
          );
          return {
            ...s,
            tailFrameVariantsLoading: false,
            prevTailFrameVariants: hasComposed
              ? variants.map((v) =>
                  (v as { id?: string } | null)?.id === 'composed'
                    ? {
                        ...(v as object),
                        assetUrl: url,
                        thumbnailUrl: url,
                        loading: false,
                        errorMsg: undefined,
                      }
                    : v,
                )
              : [...variants, { id: 'composed', assetUrl: url, thumbnailUrl: url, loading: false }],
            selectedTailFrameVariantId: 'composed',
            prevShotImageRefUrls: [url],
          };
        }),
      }));
    };
    return subscribe(TASK_COMPLETED_EVENT, handler);
  }, [nodeId, updateData, getNode]);

  return { updateData, callbacks };
}
