import { useEffect, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { createScriptBoxEngine } from './scriptBoxEngine.js'
import { useProvidersList, load as loadProviders } from './settings/providerStore.js'
import { logger } from './logger.js'

/**
 * 剧本盒子 —— 引擎回调注入 hook（对应官方 H_.jsx 的注入机制 A/B）。
 *
 * 职责铁律（docs/剧本盒子/剧本盒子职责划分.md）：
 *  - 引擎回调必须由「能拿到 setNodes/addNodes/坐标」的宿主创建，再挂到 node.data.onXxx；
 *  - UI 组件（ScriptBoxNode / scriptbox/*）只调 d.onXxx?.(...)，不做引擎；
 *  - 数据只存 node.data，引擎经 setNodes 写回、UI 编辑经 updateData 写回。
 *
 * 为什么放剧本盒子自己的 hook 而不是 App.jsx：
 *  - 用 useReactFlow() 就能拿到 getNodes/setNodes/addNodes/screenToFlowPosition，
 *    无需 App 传参，App 保持通用画布壳，不变成垃圾场；
 *  - 剧本盒子专用逻辑聚在本模块，与 scriptBoxEngine.js 同类。
 *
 * 用法：在 ScriptBoxNode 内调用本 hook。它：
 *  - 创建并缓存一份 createScriptBoxEngine 实例（ref，跨 render 稳定）；
 *  - 通过 useEffect 把 9 个 onXxx 回调写回 node.data.onXxx（复制/分享后回调仍在）。
 *
 * @param nodeId  剧本盒子节点 id
 * @param data    节点当前 data（仅兜底；引擎主要经 getNodes 实时读最新 data）
 */
export function useScriptBoxEngine(nodeId, data) {
  const { getNodes, getNode, setNodes, setEdges, addNodes, screenToFlowPosition } = useReactFlow()

  // 供应商（多 provider，接真系统）：引擎经 getProviderState 实时读 providers + 主供应商，
  // 生成/生图时按模型 value（providerId::modelId）解析到对应 provider 再经 /api/proxy 转发。
  // P5 原子订阅：只订阅 providers 列表，不随 providerStore 的 dirty/loading/testResult 连坐重渲染。
  const providers = useProvidersList()
  // 首次挂载确保供应商已加载（生成/生图前必须有 provider，否则解析不到模型）
  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // providers 实时镜像到 ref：引擎实例经 useRef 只创建一次（跨 render 稳定），
  // 若 getProviderState 直接闭包捕获「首次 render 的 providers」（此时异步加载未完成 → 空数组），
  // 之后 providers 加载完成也不会更新闭包 → 引擎永远读到空供应商 → 生成一直报「请先配置模型」。
  // 故用 providersRef 在每次 render 同步最新值，getProviderState 读 ref.current，打破闭包过期。
  const providersRef = useRef(providers)
  providersRef.current = providers

  // 书写回通道（统一收口，ScriptBoxNode / Step 组件共用）：
  // 支持对象 patch 与函数式 patch `(latestData)=>patch`（并发安全合并，避免读到旧引用导致状态互相覆盖）。
  // 用 useCallback 保证跨 render 稳定（ScriptBoxNode 是 React.memo，稳定引用可减少无谓重渲染）。
  const updateData = useCallback(
    (patch) =>
      setNodes((ns) => ns.map((n) => {
        if (n.id !== nodeId) return n
        const latest = n.data || {}
        const resolved = typeof patch === 'function' ? patch(latest) : patch
        return { ...n, data: { ...latest, ...resolved } }
      })),
    [nodeId, setNodes]
  )

  // 引擎实例用 ref 缓存，跨 render 稳定（不因 data 变化重建导致子组件重渲染）
  const engineRef = useRef(null)
  if (!engineRef.current) {
    engineRef.current = createScriptBoxEngine({
      // 读最新 data：经 useReactFlow().getNode 实时取（O(1) hash 查，替 getNodes().find），避免闭包捕获旧值
      getData: () => getNode(nodeId)?.data ?? data ?? {},
      // 写回 node.data：经 setNodes 不可变更新（引擎唯一写回通道）。
      // 支持两种形态：对象 patch（直接合并）或函数 `(latestData) => patch`（基于最新 data 计算，
      // 供并发场景下安全合并，避免 getData() 读到旧引用导致状态互相覆盖）。
      updateData,
      nodeId,
      setEdges,
      getNodes,
      // 供应商解析（接真系统）：返回 { providers, primary }，供引擎选模型/转发
      // 注意：读 providersRef.current 而非闭包捕获的 providers，避免闭包过期读到空数组。
      getProviderState: () => {
        const list = providersRef.current || []
        return { providers: list, primary: list.find((p) => p.isPrimary) || list[0] || null }
      },
      // 连线：经 addNodes 建下游节点，位置用 screenToFlowPosition 算落点基准
      addNodes: (nodes) => {
        if (!addNodes) return
        const base = screenToFlowPosition?.({ x: 0, y: 0 }) ?? { x: 0, y: 0 }
        addNodes(
          nodes.map((nd) => ({
            ...nd,
            position: {
              x: (nd.position?.x ?? 0) + base.x + 100,
              y: (nd.position?.y ?? 0) + base.y
            }
          }))
        )
      }
    })
  }

  const callbacks = engineRef.current

  // 把 9 回调写回 node.data.onXxx（官方注入点语义），保证复制/分享后回调仍在
  useEffect(() => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...callbacks } } : n)))
    // 仅挂载时注入一次；nodeId 变化时重新注入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  return { updateData }
}
