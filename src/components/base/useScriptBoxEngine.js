import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { createScriptBoxEngine } from './scriptBoxEngine.js'
import { useProviders, load as loadProviders } from './settings/providerStore.js'

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
 *  - 剧本盒子专用逻辑聚在本模块，与 useScriptBoxData.js / scriptBoxEngine.js 同类。
 *
 * 用法：在 ScriptBoxNode 内调用本 hook。它：
 *  - 创建并缓存一份 createScriptBoxEngine 实例（ref，跨 render 稳定）；
 *  - 通过 useEffect 把 9 个 onXxx 回调写回 node.data.onXxx（复制/分享后回调仍在）。
 *
 * @param nodeId  剧本盒子节点 id
 * @param data    节点当前 data（仅兜底；引擎主要经 getNodes 实时读最新 data）
 */
export function useScriptBoxEngine(nodeId, data) {
  const { getNodes, setNodes, setEdges, addNodes, screenToFlowPosition } = useReactFlow()

  // 供应商（多 provider，接真系统）：引擎经 getProviderState 实时读 providers + 主供应商，
  // 生成/生图时按模型 value（providerId::modelId）解析到对应 provider 再经 /api/proxy 转发。
  const { providers } = useProviders()
  // 首次挂载确保供应商已加载（生成/生图前必须有 provider，否则解析不到模型）
  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 引擎实例用 ref 缓存，跨 render 稳定（不因 data 变化重建导致子组件重渲染）
  const engineRef = useRef(null)
  if (!engineRef.current) {
    engineRef.current = createScriptBoxEngine({
      // 读最新 data：经 useReactFlow().getNodes 实时取，避免闭包捕获旧值
      getData: () => getNodes().find((n) => n.id === nodeId)?.data ?? data ?? {},
      // 写回 node.data：经 setNodes 不可变更新（引擎唯一写回通道）
      updateData: (patch) =>
        setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...patch } } : n))),
      nodeId,
      setEdges,
      getNodes,
      // 供应商解析（接真系统）：返回 { providers, primary }，供引擎选模型/转发
      getProviderState: () => {
        const list = providers || []
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
}
