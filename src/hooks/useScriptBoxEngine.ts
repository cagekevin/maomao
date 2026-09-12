import { useEffect, useRef, useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { createScriptBoxEngine } from '../components/scriptbox/scriptBoxEngine.ts';
import {
  normalizeScriptBoxData,
  type ScriptBoxData,
} from '../components/scriptbox/scriptBoxSchema.ts';
import { injectNodePrefs } from '../components/base/canvas/nodePrefs.ts';
import { commitNewNodes } from '../components/base/canvas/deriveNodes.ts';
import { useProvidersList, load as loadProviders } from '../components/base/store/providerStore.ts';
import { logger } from '../components/base/core/logger.ts';
import { patchNodeDataById } from './useNodeData.ts';

// 写回通道契约收口在 scriptBoxSchema（引擎与 hook 共用同一份，避免两处漂移）
import type { ScriptBoxUpdateData } from '../components/scriptbox/scriptBoxSchema.ts';
export type { ScriptBoxUpdateData };

/**
 * 剧本盒子 —— 引擎回调注入 hook（对应官方 H_.jsx 的注入机制 A/B）。
 *
 * 职责铁律（docs/剧本盒子/剧本盒子职责划分.md）：
 *  - 引擎回调必须由「能拿到 setNodes/getNodes/坐标」的宿主创建，再挂到 node.data.onXxx；
 *  - UI 组件（ScriptBoxNode / scriptbox/*）只调 d.onXxx?.(...)，不做引擎；
 *  - 数据只存 node.data，引擎经 setNodes 写回、UI 编辑经 updateData 写回。
 *
 * 为什么放剧本盒子自己的 hook 而不是 App.jsx：
 *  - 用 useReactFlow() 就能拿到 getNodes/setNodes/getEdges/screenToFlowPosition，
 *    无需 App 传参，App 保持通用画布壳，不变成垃圾场；
 *  - 剧本盒子专用逻辑聚在本模块，与 scriptBoxEngine.js 同类。
 *
 * 用法：在 ScriptBoxNode 内调用本 hook。它：
 *  - 创建并缓存一份 createScriptBoxEngine 实例（ref，跨 render 稳定）；
 *  - 通过 useEffect 把 9 个 onXxx 回调写回 node.data.onXxx（复制/分享后回调仍在）。
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
): { updateData: ScriptBoxUpdateData } {
  const { getNodes, getNode, getEdges, setNodes, setEdges, screenToFlowPosition } = useReactFlow();

  // 供应商（多 provider，接真系统）：引擎经 getProviderState 实时读 providers + 主供应商，
  // 生成/生图时按模型 value（providerId::modelId）解析到对应 provider，再经统一生成入口 /api/generate 转发（旧 /api/proxy 出站已随 2026-09-03 收口退役）。
  // P5 原子订阅：只订阅 providers 列表，不随 providerStore 的 dirty/loading/testResult 连坐重渲染。
  const providers = useProvidersList();
  // 首次挂载确保供应商已加载（生成/生图前必须有 provider，否则解析不到模型）
  useEffect(() => {
    if (!providers || providers.length === 0)
      loadProviders().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setEdges: setEdges as unknown as (updater: (edges: unknown[]) => unknown[]) => void,
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
          injectNodePrefs(nd.type, data);
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

  const callbacks = engineRef.current;

  // 把引擎全部回调写回 node.data.onXxx（官方注入点语义，含 P1-2 尾帧变体），保证复制/分享后回调仍在
  useEffect(() => {
    patchNodeDataById(setNodes, nodeId, callbacks);
    // 仅挂载时注入一次；nodeId 变化时重新注入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  return { updateData };
}
