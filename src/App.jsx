import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react'
import { Type, Image as ImageIcon, Clapperboard, Trash2, Copy, Zap, RefreshCw, Folder, FolderOpen } from 'lucide-react'
import CanvasToolbar from './components/base/CanvasToolbar.jsx'
import ArrangeConfirm from './components/base/ArrangeConfirm.jsx'
import { useArrangeCanvas } from './components/base/useArrangeCanvas.js'
import { useAssetDropPaste, useGlobalPaste } from './components/base/useAssetDropPaste.js'
import { copyImageToClipboard } from './components/base/clipboard.js'
import TextNode from './components/TextNode.jsx'
import ImageNode from './components/ImageNode.jsx'
import PromptNode from './components/PromptNode.jsx'
import DiscountVideoNode from './components/DiscountVideoNode.jsx'
import VideoExtractNode from './components/VideoExtractNode.jsx'
import ImageBoxNode from './components/ImageBoxNode.jsx'
import GridSplitNode from './components/GridSplitNode.jsx'
import GridMergeNode from './components/GridMergeNode.jsx'
import VideoProcessNode from './components/VideoProcessNode.jsx'
import GroupNode from './components/GroupNode.jsx'
import ScriptBoxNode from './components/ScriptBoxNode.jsx'
import GhostTargetNode from './components/GhostTargetNode.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import LeftPanel from './components/base/LeftPanel.jsx'
import { switchProject, loadCanvasState, saveCanvasState, getCurrentProject, initProjects } from './components/base/projectStore.js'
import { logger } from './components/base/logger.js'
import { useNodePosition } from './components/base/hooks.js'
import CustomEdge from './components/CustomEdge.jsx'
import ConnectionLine from './components/ConnectionLine.jsx'
import ContextMenu from './components/base/ContextMenu.jsx'
import { useContextMenu } from './components/base/useContextMenu.js'
import { useCanvasHistory } from './components/base/useCanvasHistory.js'
import { useCanvasShortcuts } from './components/base/useCanvasShortcuts.js'
import { paletteCategories, getNodesByCategory, defaultNodeData } from './components/base/NodePalette.jsx'
import LodProvider from './components/base/LodProvider.jsx'
import LodListener from './components/base/LodListener.jsx'
import ToastContainer from './components/base/ToastContainer.jsx'
import SettingsFrame from './components/base/settings/SettingsFrame.jsx'
import AccountsSettings from './components/base/settings/sections/AccountsSettings.jsx'
import TopNav from './components/base/TopNav.jsx'
import { showToast } from './components/base/toastStore.js'
import { getSetting, setSetting } from './components/base/appSettings.js'
import { useLocalToolStatus } from './components/base/useLocalToolStatus.js'
import LocalToolConnectModal from './components/base/LocalToolConnectModal.jsx'
import EmptyCanvasGuide from './components/base/EmptyCanvasGuide.jsx'
import { initTasks } from './components/base/taskStore.js'
import { createGroupFromNodes, ungroupNodes } from './components/base/groupNodes.js'

/* ======================================================================
 * 【区 1】常量与配置区
 * nodeTypes / edgeTypes / 初始画布内容 / 画布参数
 * ====================================================================== */

// 节点类型注册表：新增节点时在此登记 type → 组件
const nodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  promptNode: PromptNode,
  discountVideoNode: DiscountVideoNode,
  videoExtractNode: VideoExtractNode,
  imageBoxNode: ImageBoxNode,
  gridSplitNode: GridSplitNode,
  gridMergeNode: GridMergeNode,
  videoProcessNode: VideoProcessNode,
  group: GroupNode,
  scriptBoxNode: ScriptBoxNode,
  ghostTarget: GhostTargetNode
}

// 边类型注册表
const edgeTypes = {
  default: CustomEdge
}

function Canvas() {
  /* ====================================================================
   * 【区 2】状态区
   * nodes / edges + ref 同步（供能力区取最新快照，避免闭包旧值）
   * ==================================================================== */
  // 项目系统（对齐官方 Vr.jsx）：画布状态按当前项目初始化/持久化。
  // 对齐官方：初始画布为空（官方 H_.jsx 空画布时显示「右键自由生成你的想象」引导）。
  // 画布快照走 localTool KV（异步）：挂载后从 KV 读当前项目快照，有值（含空画布）则覆盖；
  // 无快照（首次）保持空画布 → 触发 EmptyCanvasGuide 空状态引导（完整复刻官方）。
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // 异步加载当前项目画布快照（KV）
  const [canvasLoaded, setCanvasLoaded] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    const projectId = getCurrentProject().id
    loadCanvasState(projectId).then((saved) => {
      if (cancelled) return
      setCanvasLoaded(true)
      if (saved && saved.nodes) {
        setNodes(saved.nodes)
        setEdges(saved.edges || [])
      }
      // 无 saved（首次）：保留演示画布
    }).catch(() => { setCanvasLoaded(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ====================================================================
   * 多窗口画布同步检测（复刻官方 H_.jsx:480-492 + 870-880）
   *  - 每窗口唯一 tabId
   *  - BroadcastChannel('yimao_canvas_sync') 监听：收到「其他窗口」保存的
   *    同一项目 CANVAS_SAVED → 显示红色警告条「画布在其他窗口被修改」
   *
   * ═══ 官方其他 BroadcastChannel/mutiwindow 事件，我们为什么不做 ═══
   * 1) mutiwindow-task-completed / mutiwindow-rerun-task：
   *    已在官方 H_.jsx 核实：它们其实是【窗口内】CustomEvent（window.addEventListener /
   *    dispatchEvent），并非跨窗口 BroadcastChannel；且全项目【只有监听、从未 dispatch】，
   *    属于预留钩子/死代码，当前业务流程根本不触发 → 无脑复刻没有意义。
   *    任务完成本就走 taskStore + /api/tasks 轮询刷新，结果落盘即更新，不依赖该事件。
   * 2) mutiwindow-open-schedule-settings / open-builtin-settings：
   *    这是「模型调度 / 内置模型详情」两个独立功能面板的窗口内事件，
   *    属功能缺失而非窗口机制，应单独评估开发，不并入本多窗口模块。
   * ==================================================================== */
  const tabIdRef = React.useRef(`tab-${Date.now()}-${Math.random()}`)
  const [canvasConflict, setCanvasConflict] = React.useState(false)
  React.useEffect(() => {
    let channel
    try {
      channel = new BroadcastChannel('yimao_canvas_sync')
      channel.onmessage = (e) => {
        if (
          e?.data?.type === 'CANVAS_SAVED' &&
          e.data.projectId === getCurrentProject().id &&
          e.data.tabId !== tabIdRef.current
        ) {
          setCanvasConflict(true)
        }
      }
    } catch (err) {
      console.warn('[Canvas] BroadcastChannel 不可用:', err?.message)
    }
    return () => { try { channel?.close() } catch { /* ignore */ } }
  }, [])
  // 切换项目后重置冲突标记（官方在 projectId 变化时不应残留旧项目冲突）
  React.useEffect(() => {
    setCanvasConflict(false)
  }, [getCurrentProject()?.id])

  // 视窗中心 → flow 坐标（Q/W/E 快速添加节点用）；适配用 fitView
  const { screenToFlowPosition, fitView } = useReactFlow()

  // 画布 AI 助手面板开关（复刻官方 _Component40 的 open state），持久化到 app_settings
  const [agentOpen, setAgentOpen] = React.useState(() => getSetting('agentOpen'))
  React.useEffect(() => { setSetting('agentOpen', agentOpen) }, [agentOpen])

  // 视图切换：canvas（画布）/ accounts（多开整页，复刻官方 V='accounts'）/ settings（独立设置框架：侧栏 + 舞台）
  const [view, setView] = React.useState('canvas')

  // 小地图开关（复刻 H_.jsx:474 un/dn，默认关——用户要求默认不显示，点工具栏 Map 图标再开）。
  // 仅当开启且节点数 <100 时显示 MiniMap（官方 De.length<100）。持久化到 app_settings。
  const [minimapOn, setMinimapOn] = React.useState(() => getSetting('minimapOn'))
  React.useEffect(() => { setSetting('minimapOn', minimapOn) }, [minimapOn])

  // 缩放性能模式开关（复刻 H_.jsx:79 ge，官方默认 true：性能模式默认开启）。
  // 从 app_settings 读入（对齐官方 Vr.jsx ei 从 app_settings 读），持久化刷新不丢。
  const [performanceMode, setPerformanceMode] = React.useState(() => getSetting('performanceMode'))
  React.useEffect(() => { setSetting('performanceMode', performanceMode) }, [performanceMode])

  // ── localTool 连接检测 + 全屏提醒（完整复刻官方 Vr.jsx L35/L95-106/L3274-3280）──
  const { status: localTool, checkConnection } = useLocalToolStatus()
  // 全屏提醒开关（对齐官方 rt）与「用户已关闭」标记（对齐官方 st，关闭后不再自动弹，直到重连）
  const [connectWarn, setConnectWarn] = React.useState(false)
  const [warnDismissed, setWarnDismissed] = React.useState(false)
  // 官方 3s 延迟后判定是否弹提醒：未连接且用户未主动关闭 → 弹；已连接 → 关
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!localTool.isConnected && !warnDismissed) {
        setConnectWarn(true)
      } else if (localTool.isConnected) {
        setConnectWarn(false)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [localTool.isConnected, warnDismissed])

  // 整理后「是否保留」快照（复刻 H_.jsx:134 tt/nt，null = 无弹窗）。
  // 存「排列前」的 nodes/edges 快照，「还原」= 整体写回（见 revertArrange）。
  const [arrangeSnapshot, setArrangeSnapshot] = React.useState(null)

  // 自动排版（复刻 H_.jsx:10985 Ui / Ctrl+L）。本 hook 只做纯布局计算，快照/历史/确认弹窗由
  // arrangeCanvas 在此统一编排（见能力区）。
  const { arrange } = useArrangeCanvas()

  // 当前缩放百分比（监听 viewport 变化，驱动左下角 zoom% 显示）。
  // 接真系统：若需在缩小到某级做额外事（如隐藏 toolbar 部分按钮），可直接读 lodLevel state（见下）。
  const [zoomPercent, setZoomPercent] = React.useState(100)
  const onViewportChange = React.useCallback((v) => {
    setZoomPercent(Math.round((v?.zoom || 1) * 100))
  }, [])

  // 始终指向最新 nodes/edges（撤销/重做取快照用）
  const nodesRef = React.useRef(nodes)
  const edgesRef = React.useRef(edges)
  React.useEffect(() => { nodesRef.current = nodes }, [nodes])
  React.useEffect(() => { edgesRef.current = edges }, [edges])

  // 历史栈（基座 useCanvasHistory）：record 需显式传最新快照，避免异步 setState 取到旧值
  const history = useCanvasHistory(
    () => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    ({ nodes: ns, edges: es }) => {
      setNodes(ns)
      setEdges(es)
    }
  )

  // 保存画布并广播到其他窗口（复刻官方 H_.jsx:870-880：保存后 postMessage CANVAS_SAVED）
  const persistCanvas = React.useCallback(
    (projectId) => {
      saveCanvasState(projectId, nodesRef.current, edgesRef.current).catch(() => {})
      try {
        const channel = new BroadcastChannel('yimao_canvas_sync')
        channel.postMessage({ type: 'CANVAS_SAVED', projectId, tabId: tabIdRef.current })
        channel.close()
      } catch (err) {
        console.warn('[Canvas] 广播画布同步失败:', err?.message)
      }
    },
    []
  )

  // 切换项目：保存当前画布快照（KV）→ 切换 → 异步加载目标项目快照 → 重置历史（对齐官方 Vr.jsx）
  const handleSwitchProject = useCallback(
    (targetId) => {
      persistCanvas(getCurrentProject().id)
      switchProject(targetId)
      setNodes([])
      setEdges([])
      loadCanvasState(targetId).then((saved) => {
        const next = saved && saved.nodes ? saved : { nodes: [], edges: [] }
        setNodes(next.nodes)
        setEdges(next.edges || [])
      }).catch(() => {})
      history.clear?.()
      logger.info('项目', 'switch', { targetId })
    },
    [setNodes, setEdges, history, persistCanvas]
  )

  // 新建项目：先保存当前画布快照（KV，对齐官方切走前自动持久化）→ 清空画布（store 已在 ProjectSelector 中创建并切换到新项目）
  const handleCreateProject = useCallback(() => {
    persistCanvas(getCurrentProject().id)
    setNodes([])
    setEdges([])
    history.clear?.()
    logger.info('项目', 'create', { name: getCurrentProject().name })
  }, [setNodes, setEdges, history, persistCanvas])

  // 右键菜单状态（基座 useContextMenu）
  const menu = useContextMenu()
  // 统一新建节点落点（公共 base）：posAtMenu 右键位置 / posAtCenter 视图中央
  const { posAtMenu, posAtCenter } = useNodePosition()

  // 后端化初始化：任务中心从 /api/tasks 加载历史任务；项目系统从 /api/projects 加载项目（对齐官方）
  React.useEffect(() => {
    initTasks()
    initProjects()
  }, [])

  // LOD 视口缩放等级（基座 LodListener/LodProvider）
  const [lodLevel, setLodLevel] = React.useState(0)

  /* ====================================================================
   * 【区 3】能力区
   * 画布操作：addNode / deleteNode / selectAll / duplicateSelected
   * ==================================================================== */

  // 新增节点（复刻源码 di(type, position, data, connection)）
  // connection?: { source, sourceHandle, dropPosition } —— 从端口拖出到空白时，
  // 在 dropPosition 建节点并自动创建 source→新节点 的边；scriptBox 的 shot- 端口预填宽高比/时长。
  const addNode = useCallback(
    (type, position, data = {}, connection) => {
      const id = `${type}-${Date.now()}`
      const nodeData = { label: '', ...data }

      // scriptBoxNode 的 shot- 端口 → promptNode/discountVideoNode 时预填（复刻 di:8667-8687）
      if (connection) {
        const src = nodesRef.current.find((n) => n.id === connection.source)
        const shotId = connection.sourceHandle?.startsWith('shot-') ? connection.sourceHandle.slice(5) : null
        const shot = shotId && src?.type === 'scriptBoxNode' ? (src.data?.shots || []).find((s) => s.id === shotId) : null
        if (shot) {
          const ar = String(src.data?.aspectRatio || '16:9')
          const o = ar === 'custom' ? String(src.data?.customAspectRatio || '16:9') : ar
          if (type === 'promptNode') {
            nodeData.aspectRatio = o === '4:4' ? '1:1' : o
          } else if (type === 'discountVideoNode') {
            nodeData.size = o === '4:4' ? '1:1' : o
            nodeData.selectedSeconds = String(Math.max(1, Number.parseInt(shot.duration || '5', 10) || 5))
            nodeData.durationFromScript = true
          }
        }
      }

      const newNode = { id, type, position: { ...position }, data: nodeData }
      if (type === 'promptNode') {
        // 生图节点默认 420×420，避免端口跑偏
        Object.assign(newNode, { width: 420, height: 420, style: { width: 420, height: 420 } })
      }
      if (type === 'gridSplitNode') {
        // 图片切分对齐官方 Lo.jsx：固定窄容器 280px，图片区跟随图片比例
        Object.assign(newNode, { width: 280, style: { width: 280 } })
      }
      if (type === 'videoProcessNode') {
        // 视频处理对齐官方 Gc.jsx：min 520×620
        Object.assign(newNode, { width: 520, height: 620, style: { width: 520, height: 620 } })
      }
      const nextNodes = [...nodesRef.current, newNode]
      // 若带 connection：自动创建 source→新节点 的边
      const nextEdges = connection
        ? [...edgesRef.current, { id: `e-${connection.source}-${id}`, source: connection.source, sourceHandle: connection.sourceHandle || null, target: id, type: 'default', animated: false }]
        : edgesRef.current
      setNodes(nextNodes)
      if (connection) setEdges(nextEdges)
      history.record({ nodes: nextNodes, edges: nextEdges })
      // 不记建节点日志：结构操作可从画布快照/历史栈还原，记了是噪音（见 logger.js 注释）
      return id
    },
    [setNodes, setEdges, history]
  )

  // 删除节点及其相连边
  const deleteNode = useCallback(
    (id) => {
      const nextNodes = nodesRef.current.filter((n) => n.id !== id)
      const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      history.record({ nodes: nextNodes, edges: nextEdges })
      // 不记删节点日志（同建节点）
    },
    [setNodes, setEdges, history]
  )

  // 全选（复刻 H_.jsx:11493-11513）
  const selectAll = useCallback(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })))
  }, [setNodes, setEdges])

  // 克隆当前选中的节点（复刻 Ctrl+D，简化：只克隆节点，偏移 40px）
  const duplicateSelected = useCallback(() => {
    const selected = nodesRef.current.filter((n) => n.selected)
    if (selected.length === 0) return
    const clones = selected.map((n) => ({
      ...n,
      id: `${n.type}-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: { x: (n.position?.x || 0) + 40, y: (n.position?.y || 0) + 40 },
      selected: true
    }))
    const nextNodes = [...nodesRef.current, ...clones]
    setNodes(nextNodes)
    history.record({ nodes: nextNodes, edges: edgesRef.current })
  }, [setNodes, history])

  // 编组选中节点（Ctrl+G；与右键菜单/Agent 共用 createGroupFromNodes）
  const groupSelected = useCallback(() => {
    const selectedIds = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
    if (selectedIds.length === 0) {
      showToast('请先选中要编组的节点', { type: 'warning' })
      return
    }
    const res = createGroupFromNodes(nodesRef.current, selectedIds)
    if (res.ok) {
      setNodes(res.nodes)
      history.record({ nodes: res.nodes, edges: edgesRef.current })
      showToast('已编组', { type: 'success' })
    } else {
      showToast(res.error || '编组失败', { type: 'warning' })
    }
  }, [setNodes, history])

  // 取消所选 group（Ctrl+Shift+G；与右键菜单/Agent 共用 ungroupNodes）
  const ungroupSelected = useCallback(() => {
    const selected = nodesRef.current.find((n) => n.selected && n.type === 'group')
    if (!selected) return
    const res = ungroupNodes(nodesRef.current, selected.id)
    if (res.ok) {
      setNodes(res.nodes)
      history.record({ nodes: res.nodes, edges: edgesRef.current })
    }
  }, [setNodes, history])

  // 复制选中节点组到系统剪贴板（对齐官方 Ci，H_.jsx:9966-10024）。
  // 格式 {type:'mutiwindow-nodes', nodes, edges, originalIds}，data 去掉函数与运行时字段，
  // 粘贴时（onPaste）解析 JSON 重建节点组（含连线），与官方完全一致。
  const copySelectedNodes = useCallback(async (onlyId) => {
    let t = nodesRef.current.filter((n) => n.selected)
    // 若右键的是某个 node 且不在选中集合内，则只复制该节点（对齐官方 Ci:9971）
    if (onlyId && !t.some((n) => n.id === onlyId)) {
      const single = nodesRef.current.find((n) => n.id === onlyId)
      if (single) t = [single]
    }
    if (t.length === 0) return
    // 只复制「选中节点之间互连」的边（对齐官方 Ci:9982-9988）
    const innerEdges = edgesRef.current.filter(
      (e) => t.some((n) => n.id === e.source) && t.some((n) => n.id === e.target)
    )
    const payload = {
      type: 'mutiwindow-nodes',
      nodes: t.map((n) => {
        const data = { ...n.data }
        Object.keys(data).forEach((k) => { if (typeof data[k] === 'function') delete data[k] })
        delete data.loading
        delete data.progress
        delete data.errorMessage
        delete data.imageUrlRef
        delete data.imageUrlThumbRef
        delete data.imageUrlUploaded
        return { ...n, data }
      }),
      edges: innerEdges,
      originalIds: t.map((n) => n.id)
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload))
      showToast(`已复制 ${t.length} 个节点`)
    } catch {
      showToast('复制失败，请检查浏览器权限', { type: 'error' })
    }
  }, [])

  // 复制节点图片本身到剪贴板（对齐官方 Ei，H_.jsx:10044）：与「复制节点」不同，
  // 这是把图片以 image/png 写进剪贴板，可粘到微信/PS 等其它软件。复用公共 clipboard.copyImageToClipboard。
  const copyNodeImage = useCallback(async (nodeId) => {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    const imgUrl = node?.data?.imageUrl || node?.data?.url
    if (!imgUrl) { showToast('该节点没有图片', { type: 'warning' }); return }
    const res = await copyImageToClipboard(imgUrl)
    showToast(res.msg, { type: res.ok ? 'success' : 'error' })
  }, [])

  // 粘贴节点组（对齐官方 xi，H_.jsx:9635-9789）：解析 mutiwindow-nodes 重建节点+边，
  // 以粘贴点 pos 为中心整体落下。返回是否处理了 mutiwindow-nodes。
  const pasteNodeGroup = useCallback(async (jsonStr, pos) => {
    let t
    try {
      t = JSON.parse(jsonStr)
    } catch {
      return false
    }
    if (!t || t.type !== 'mutiwindow-nodes') return false
    const e = t.nodes || []
    if (e.length === 0) return false
    const n = t.edges || []
    // 计算原节点组包围盒中心，使整组以粘贴点为中心落下（对齐官方 xi:9673-9686）
    const o = Math.min(...e.map((x) => x.position?.x ?? 0))
    const s = Math.min(...e.map((x) => x.position?.y ?? 0))
    const c = Math.max(...e.map((x) => (x.position?.x ?? 0) + (x.measured?.width || 300)))
    const l = Math.max(...e.map((x) => (x.position?.y ?? 0) + (x.measured?.height || 300)))
    const u = (o + c) / 2
    const d = (s + l) / 2
    const f = new Map()
    const p = e.map((x) => {
      const id = `${x.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      f.set(x.id, id)
      const data = JSON.parse(JSON.stringify(x.data || {}))
      return { ...x, id, position: { x: pos.x + (x.position?.x ?? 0) - u, y: pos.y + (x.position?.y ?? 0) - d }, selected: true, data }
    })
    const m = (n || []).map((x) => ({
      ...x,
      id: `e-${f.get(x.source)}-${f.get(x.target)}`,
      source: f.get(x.source),
      target: f.get(x.target),
      selected: true,
      type: 'default'
    }))
    const beforeNodes = nodesRef.current
    const beforeEdges = edgesRef.current
    // 旧节点取消选中，新节点/边并入（对齐官方 xi:9751-9766）
    const nextNodes = beforeNodes.map((x) => ({ ...x, selected: false })).concat(p)
    const nextEdges = beforeEdges.map((x) => ({ ...x, selected: false })).concat(m)
    setNodes(nextNodes)
    setEdges(nextEdges)
    history.record({ nodes: nextNodes, edges: nextEdges })
    showToast(`已粘贴 ${p.length} 个节点`)
    return true
  }, [setNodes, setEdges, history])

  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）：
  // 先存排列前快照 → dagre 布局写回 → 弹「是否保留整理结果」确认。
  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）。
  // 编排顺序（抉择）：
  //   1. 先存「排列前快照」before → 供「还原」用（不污染全局撤销栈，见 ArrangeConfirm 注释）；
  //   2. 调 useArrangeCanvas.arrange 算新布局并写回（onArrange 走 setNodes/setEdges）；
  //   3. 写回后 fitView 适配新布局；
  //   4. 弹「是否保留」确认窗（ArrangeConfirm）；
  //   5. 把「排列后结果」入历史栈（undo 可回到排列前）。
  // 接真系统：nodesRef.current/edgesRef.current 换 useReactFlow().getNodes/getEdges() 即可，
  // 其余编排不变。
  const arrangeCanvas = useCallback(() => {
    const before = { nodes: nodesRef.current, edges: edgesRef.current }
    const result = arrange({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      onArrange: ({ nodes: ns, edges: es }) => {
        setNodes(ns)
        setEdges(es)
      },
      onComplete: () => {
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 800, maxZoom: 1 })
        }, 100)
      },
    })
    // 弹确认：存排列前快照，还原时写回
    setArrangeSnapshot(before)
    history.record({ nodes: result.nodes, edges: result.edges })
  }, [arrange, setNodes, setEdges, fitView, history])

  // 还原整理：写回排列前快照 + 关闭弹窗 + fitView（复刻 H_.jsx:11996-12006）
  // 抉择：直接用快照整体 setNodes/setEdges，比逆向 dagre 更简单可靠。
  const revertArrange = useCallback(() => {
    if (!arrangeSnapshot) return
    setNodes(arrangeSnapshot.nodes)
    setEdges(arrangeSnapshot.edges)
    setArrangeSnapshot(null)
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800, maxZoom: 1 })
    }, 100)
  }, [arrangeSnapshot, setNodes, setEdges, fitView])

  // 保留整理：仅关闭弹窗（复刻 H_.jsx:12008-12010），整理结果已写回、无需再动
  const keepArrange = useCallback(() => {
    setArrangeSnapshot(null)
  }, [])

  // 清理缓存（复刻官方 Ki 语义的「原型本地版」）：
  // 遍历节点，把 data 里体积超过阈值的内联 dataURL 大资源（图片/视频/缩略图）置空释放，
  // 减轻内存负担（官方转 /files/ 本地 URL；原型无后端，改为释放超大内联数据）。
  // 阈值 100KB；只清 data:image|data:video 前缀的字段；不可变局部更新（原则 3）。
  const DATAURL_THRESHOLD = 100 * 1024
  const CLEAN_FIELDS = ['imageUrl', 'videoUrl', 'thumbnailUrl']
  const handleClearCache = useCallback(() => {
    let clearedCount = 0
    let clearedBytes = 0
    let changed = false
    const next = nodesRef.current.map((n) => {
      const d = n.data || {}
      const patches = {}
      for (const f of CLEAN_FIELDS) {
        const v = d[f]
        if (typeof v === 'string' && v.startsWith('data:') && v.length > DATAURL_THRESHOLD) {
          patches[f] = ''
          clearedCount++
          clearedBytes += v.length
        }
      }
      if (Object.keys(patches).length === 0) return n
      changed = true
      return { ...n, data: { ...d, ...patches } }
    })
    if (!changed) {
      showToast('没有需要清理的大内联资源', { type: 'info' })
      return
    }
    setNodes(next)
    history.record({ nodes: next, edges: edgesRef.current })
    showToast(`已清理 ${clearedCount} 个大内联资源（约 ${(clearedBytes / 1024).toFixed(0)}KB）`, { type: 'success' })
  }, [setNodes, history])

  /* ====================================================================
   * 素材拖入 / 粘贴（复刻 H_.jsx:10201-10350 onDragOver ki / onDrop Ai + handlePaste）
   * 统一收敛到 useAssetDropPaste hook：App 只挂事件，具体建节点逻辑在 hook 里。
   * ==================================================================== */
  const { onDragOver, onDrop, onPaste } = useAssetDropPaste({
    addNode: (type, pos, data) => addNode(type, pos, data),
    screenToFlowPosition,
    onPasteNodeGroup: pasteNodeGroup
  })
  // 全局粘贴监听（文档级）
  useGlobalPaste(onPaste)

  /* ====================================================================
   * 【区 4】菜单配置区
   * canvas（空白）/ node（单选节点）/ selection（多选）三套右键菜单项
   * ==================================================================== */

  // 空白处菜单：快速添加节点 + 小工具子菜单（复刻 H_.jsx:12232-12340）
  const canvasMenuItems = (state) => {
    // 小工具子菜单：按分类列出目录节点（复刻 H_.jsx:12290-12340 的 at/vi/_i）
    const toolsSubmenu = paletteCategories
      .map((cat) => {
        const catNodes = getNodesByCategory(cat.key)
        if (catNodes.length === 0) return null
        return {
          key: `tools-${cat.key}`,
          label: cat.label,
          items: catNodes.map((n) => ({
            key: n.type,
            icon: n.icon,
            label: n.label,
            badge: n.badge,
            onClick: () => addNodeFromMenu(n.type)
          }))
        }
      })
      .filter(Boolean)

    return [
      { key: 'text', icon: <Type size={16} className="text-green-500" />, label: '文本', shortcut: 'Q', onClick: () => addNodeFromMenu('textNode') },
      { key: 'image', icon: <ImageIcon size={16} className="text-blue-400" />, label: '图片', shortcut: 'W', onClick: () => addNodeFromMenu('promptNode') },
      { key: 'video', icon: <Clapperboard size={16} className="text-yellow-500" />, label: '视频', shortcut: 'E', onClick: () => addNodeFromMenu('discountVideoNode') },
      { type: 'divider' },
      ...toolsSubmenu
    ]
  }

  // 单选节点菜单：复制 / [复制图片] / 删除（复刻 H_.jsx:12573-12617）
  // 「复制」对齐官方：把节点（组）写入系统剪贴板，用户 Ctrl+V 粘贴重建。
  // 「复制图片」仅图片类节点（imageNode/promptNode）有：把图片本身复制到剪贴板（对齐官方 Ei，H_.jsx:12603）。
  const nodeMenuItems = (state) => {
    const node = nodesRef.current.find((n) => n.id === state.nodeId)
    if (!node) return []
    const isImageLike = node.type === 'imageNode' || node.type === 'promptNode'
    const isGroup = node.type === 'group'
    const items = [
      { key: 'duplicate', icon: <Copy size={16} className="text-gray-300" />, label: '复制', onClick: () => copySelectedNodes(node.id) }
    ]
    if (isImageLike) {
      items.push({
        key: 'copyImage',
        icon: <ImageIcon size={16} className="text-gray-300" />,
        label: '复制图片',
        onClick: () => copyNodeImage(node.id)
      })
    }
    // group 节点：取消编组（治根：与 Agent 共用 ungroupNodes）
    if (isGroup) {
      items.push({
        key: 'ungroup',
        icon: <FolderOpen size={16} className="text-gray-300" />,
        label: '取消编组',
        onClick: () => {
          const res = ungroupNodes(nodesRef.current, node.id)
          if (res.ok) {
            setNodes(res.nodes)
            history.record({ nodes: res.nodes, edges: edgesRef.current })
          }
        }
      })
    }
    items.push(
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={16} className="text-red-400" />, label: '删除', danger: true, onClick: () => deleteNode(node.id) }
    )
    return items
  }

  // 从「连接」状态建下游节点：在 dropPosition 建节点 + 自动连线，并清掉 ghost（复刻官方 di + a()）
  const buildFromConnection = useCallback(
    (type, conn) => {
      if (!conn) return
      addNode(type, { x: conn.dropPosition.x, y: conn.dropPosition.y }, defaultNodeData(type), conn)
      setNodes((ns) => ns.filter((n) => n.id !== 'ghost-target'))
      setEdges((es) => es.filter((e) => e.id !== 'ghost-edge'))
      menu.close()
    },
    [addNode, setNodes, setEdges, menu.close]
  )

  // 统一建节点入口（单一数据源）：
  //   - 从端口拖出到空白（state.connection 存在）→ 复用同一份 canvas 菜单项，但建节点时自动连线 + 清 ghost；
  //   - 空白处右键（无 connection）→ 普通建节点。
  const addNodeFromMenu = useCallback(
    (type) => {
      const conn = menu.state?.connection
      if (conn) {
        buildFromConnection(type, conn)
        return
      }
      // 右键菜单（含工具子菜单/视频抽帧）：用公共 posAtMenu 算落点（右键位置，点哪建哪）
      addNode(type, posAtMenu(menu.state), defaultNodeData(type))
    },
    [menu.state, buildFromConnection, addNode, posAtMenu]
  )

  // 多选菜单：编组 / 复制 / 删除（对齐官方多选右键：复制选中节点组到剪贴板，粘贴时重建）
  const selectionMenuItems = () => {
    const selectedIds = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
    const items = []
    // 编组：选中≥2个普通节点时可用（治根：与 Agent group_nodes 共用 createGroupFromNodes）
    if (selectedIds.length >= 2) {
      items.push({
        key: 'group',
        icon: <Folder size={16} className="text-gray-300" />,
        label: '编组',
        onClick: () => {
          const res = createGroupFromNodes(nodesRef.current, selectedIds)
          if (res.ok) {
            setNodes(res.nodes)
            history.record({ nodes: res.nodes, edges: edgesRef.current })
          }
        }
      })
      items.push({ type: 'divider' })
    }
    items.push(
      {
        key: 'duplicate',
        icon: <Copy size={16} className="text-gray-300" />,
        label: '复制',
        onClick: () => copySelectedNodes()
      },
      { type: 'divider' },
      {
        key: 'delete',
        icon: <Trash2 size={16} className="text-red-400" />,
        label: '删除',
        danger: true,
        onClick: () => {
          const sel = nodesRef.current.filter((n) => n.selected).map((n) => n.id)
          const nextNodes = nodesRef.current.filter((n) => !sel.includes(n.id))
          const nextEdges = edgesRef.current.filter((e) => !sel.includes(e.source) && !sel.includes(e.target))
          setNodes(nextNodes)
          setEdges(nextEdges)
          history.record({ nodes: nextNodes, edges: nextEdges })
        }
      }
    )
    return items
  }

  // 根据菜单类型分发到对应配置（单一数据源：拖线复用 canvas 菜单，故无独立 connection 分支）
  const menuItems = (state) => {
    if (state.type === 'node') return nodeMenuItems(state)
    if (state.type === 'selection') return selectionMenuItems(state)
    return canvasMenuItems(state)
  }

  /* ====================================================================
   * 【区 5】事件绑定区
   * 快捷键 / 连线 / 删边监听 / 选中节点→边关联联动
   * ==================================================================== */

  // 键盘快捷键（基座 useCanvasShortcuts）
  useCanvasShortcuts({
    onUndo: history.undo,
    onRedo: history.redo,
    onSelectAll: selectAll,
    onDuplicate: duplicateSelected,
    onArrange: arrangeCanvas,
    onGroup: groupSelected,
    onUngroup: ungroupSelected,
    onAdd: (type) => {
      // 若处于「拖线」菜单态（复用 canvas 菜单但 state 带 connection）：建下游并自动连线
      const conn = menu.state?.connection
      if (conn) {
        buildFromConnection(type, conn)
        return
      }
      // 否则快速添加节点到视窗中心（复刻 Q/W/E，统一走公共 posAtCenter）
      addNode(type, posAtCenter(), defaultNodeData(type))
    }
  })

  // 连线：连到真实节点时建边（isValid 连接）
  const onConnect = useCallback(
    (params) => {
      const nextEdges = [...edgesRef.current, { ...params, type: 'default', animated: false }]
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
      // 不记连线日志（同建节点）
    },
    [setEdges, history]
  )

  // 从端口拖出到空白：建 ghost-target + ghost-edge + 弹「连接」菜单（复刻官方 onConnectEnd Oi:H_.jsx:10143）
  // ReactFlow 的 onConnectEnd 第二参数是 connectionState（含 isValid/fromNode/fromHandle）。
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      const t = connectionState || {}
      // 仅当「连接无效（拖到空白）+ 有源节点和源端口」时弹菜单（官方判断）
      if (t.isValid || !t.fromNode || !t.fromHandle) return
      const { clientX, clientY } = event?.changedTouches?.[0] || event || {}
      if (clientX == null) return

      const rect = menu.containerRef.current?.getBoundingClientRect()
      const pos = screenToFlowPosition({ x: clientX, y: clientY })
      // 建 ghost-target（不可见占位节点）
      setNodes((ns) =>
        ns
          .filter((n) => n.id !== 'ghost-target')
          .concat({
            id: 'ghost-target',
            type: 'ghostTarget',
            position: pos,
            style: { opacity: 0, pointerEvents: 'none', width: 1, height: 1 },
            data: { label: '' },
            selectable: false,
            draggable: false
          })
      )
      // 建 ghost-edge（fromNode → ghost-target）
      setEdges((es) =>
        es
          .filter((e) => e.id !== 'ghost-edge')
          .concat({
            id: 'ghost-edge',
            source: t.fromNode.id,
            sourceHandle: t.fromHandle.id || null,
            target: 'ghost-target',
            type: 'default'
          })
      )
      // 弹「连接」菜单（官方 setTimeout 50ms，确保 ghost 渲染完成）
      setTimeout(() => {
        menu.openConnection(
          { source: t.fromNode.id, sourceHandle: t.fromHandle.id || null, dropPosition: pos },
          (clientX - (rect?.left || 0)),
          (clientY - (rect?.top || 0))
        )
      }, 50)
    },
    [setNodes, setEdges, screenToFlowPosition, menu.openConnection]
  )

  // 删除连线（统一入口：CustomEdge 的 ✕ 按钮、连线双击删除 都走这里）
  const removeEdge = useCallback(
    (id) => {
      if (!id) return
      const nextEdges = edgesRef.current.filter((ed) => ed.id !== id)
      setEdges(nextEdges)
      history.record({ nodes: nodesRef.current, edges: nextEdges })
    },
    [setEdges, history]
  )

  // CustomEdge 的 ✕ 按钮通过 window 事件触发（edge 组件无法直接拿 App 函数）
  useEffect(() => {
    const handler = (e) => {
      removeEdge(e.detail?.id)
    }
    window.addEventListener('yimao:remove-edge', handler)
    return () => window.removeEventListener('yimao:remove-edge', handler)
  }, [removeEdge])

  // 双击连线删除
  const onEdgeDoubleClick = useCallback(
    (event, edge) => {
      removeEdge(edge.id)
    },
    [removeEdge]
  )

  // deleteElements（CustomEdge 的 ✕ 按钮用）删除连线后，记录 undo 历史
  const onEdgesDelete = useCallback(
    (deleted) => {
      if (!deleted || !deleted.length) return
      const nextEdges = edgesRef.current.filter((ed) => !deleted.some((d) => d.id === ed.id))
      history.record({ nodes: nodesRef.current, edges: nextEdges })
      // 不记删线日志（同建节点）
    },
    [history]
  )

  // 选中节点联动：与选中节点相连的边 → data.relatedToSelected = true（触发 comet + 加亮）
  // 每次节点 change 后，基于当前全部选中节点重算每条边的关联态（支持多选）
  const onNodesChangeForEdges = useCallback(
    (changes) => {
      onNodesChange(changes)

      // 聚合本次 change 造成的选中变化（select 类型 change 带 selected 字段）
      const selectionMap = {}
      changes.forEach((c) => {
        if (c.type === 'select' && c.id) {
          selectionMap[c.id] = c.selected
        }
      })
      if (Object.keys(selectionMap).length === 0) return

      // 基于当前 nodes 快照 + 本次 select 覆盖，算出真实选中集合，再重算每条边关联态
      setNodes((currentNodes) => {
        const selectedIds = new Set()
        currentNodes.forEach((n) => {
          const override = selectionMap[n.id]
          if (override !== undefined ? override : !!n.selected) {
            selectedIds.add(n.id)
          }
        })

        setEdges((eds) => {
          let changed = false
          const next = eds.map((ed) => {
            const rel = selectedIds.has(ed.source) || selectedIds.has(ed.target)
            if (ed.data?.relatedToSelected !== rel) {
              changed = true
              return { ...ed, data: { ...ed.data, relatedToSelected: rel } }
            }
            return ed
          })
          return changed ? next : eds
        })
        return currentNodes
      })
    },
    [onNodesChange, setEdges, setNodes]
  )

  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  // 折叠 group 时隐藏其子节点（React Flow 官方推荐用 hidden 字段，替代自研 opacity 方案）。
  // hidden:true 让 React Flow 原生不渲染、不交互、不占布局；展开时自动恢复。
  // GroupNode.toggleCollapse 折叠时已设子节点 hidden，这里对「加载快照即折叠」的 group 兜底处理。
  const visibleNodes = useMemo(() => {
    const collapsedGroups = new Set(
      nodes.filter((n) => n.type === 'group' && n.data?.collapsed).map((n) => n.id)
    )
    if (collapsedGroups.size === 0) return nodes
    return nodes.map((n) =>
      n.parentId && collapsedGroups.has(n.parentId) ? { ...n, hidden: true } : n
    )
  }, [nodes])

  // 拖拽节点结束（onNodeDragStop）：
  // 1) 拖入成组：节点落入某 group 范围内 → 设为该 group 子节点（parentId + 相对坐标）
  // 2) 拖出离组：原 group 子节点拖出其父边界 → 解除 parentId（转绝对坐标），group 保留
  // group 尺寸只由用户手动拖动调整，不根据子节点自动伸缩。
  const handleNodeDragStop = React.useCallback((_evt, dragged) => {
    if (!dragged || dragged.type === 'group') return
    let cur = nodesRef.current
    let changed = false

    // ---- 1&2) 拖入/拖出判定 ----
    // 绝对坐标辅助（递归求父绝对位置）
    const absPosOf = (id) => {
      let x = 0, y = 0, nodeId = id
      let guard = 0
      while (nodeId && guard++ < 20) {
        const n = cur.find((nn) => nn.id === nodeId)
        if (!n) break
        x += n.position.x; y += n.position.y
        nodeId = n.parentId
      }
      return { x, y }
    }
    // 判定节点是否「大部分在 group 内」：重叠面积 ≥ 子节点面积的一半（50%）即算组内。
    // 这样比中心点判定更宽松直观：只要子节点一半以上落进 group，就算归组。
    const insideGroup = (nodeAbs, g) => {
      const gAbs = absPosOf(g.id)
      const gW = Number(g.style?.width) || g.measured?.width || 0
      const gH = Number(g.style?.height) || g.measured?.height || 0
      const nW = Number(dragged.measured?.width) || Number(dragged.style?.width) || 100
      const nH = Number(dragged.measured?.height) || Number(dragged.style?.height) || 60
      const overlapW = Math.max(0, Math.min(nodeAbs.x + nW, gAbs.x + gW) - Math.max(nodeAbs.x, gAbs.x))
      const overlapH = Math.max(0, Math.min(nodeAbs.y + nH, gAbs.y + gH) - Math.max(nodeAbs.y, gAbs.y))
      const overlap = overlapW * overlapH
      const nodeArea = nW * nH
      return nodeArea > 0 && overlap / nodeArea >= 0.5
    }

    const draggedAbs = { x: dragged.position.x + (dragged.parentId ? absPosOf(dragged.parentId).x : 0), y: dragged.position.y + (dragged.parentId ? absPosOf(dragged.parentId).y : 0) }
    // 候选 group：非折叠、不包含被拖节点自身；按面积小→大（优先最内层）
    const groups = cur
      .filter((n) => n.type === 'group' && !n.data?.collapsed && n.id !== dragged.id)
      .sort((a, b) => (Number(a.style?.width) || 0) * (Number(a.style?.height) || 0) - (Number(b.style?.width) || 0) * (Number(b.style?.height) || 0))
    const newParent = groups.find((g) => insideGroup(draggedAbs, g))

    if (newParent && dragged.parentId !== newParent.id) {
      // 拖入/更换父组：转为该 group 子节点
      const pAbs = absPosOf(newParent.id)
      cur = cur.map((n) =>
        n.id === dragged.id
          ? { ...n, parentId: newParent.id, position: { x: draggedAbs.x - pAbs.x, y: draggedAbs.y - pAbs.y } }
          : n
      )
      changed = true
    } else if (!newParent && dragged.parentId) {
      // 拖出原组：解除 parentId，转绝对坐标（group 保留）
      const parent = cur.find((n) => n.id === dragged.parentId)
      if (parent) {
        const pAbs = absPosOf(parent.id)
        cur = cur.map((n) =>
          n.id === dragged.id
            ? { ...n, parentId: undefined, extent: undefined, position: { x: draggedAbs.x, y: draggedAbs.y } }
            : n
        )
        changed = true
      }
    }

    // group 尺寸只由用户手动拖动调整，不根据子节点自动伸缩
    if (changed) setNodes(cur)
  }, [setNodes])

  /* ====================================================================
   * 【区 6】渲染区
   * ReactFlow 画布 + 覆盖层（右键菜单）
   * ==================================================================== */
  return (
    <LodProvider value={{ lodLevel, viewportMoving: false, nodeCount: nodes.length, handleFollowLimit: 60, edgeFxLimit: 50 }}>
      {/* 顶层：flex 纵向布局（复刻官方 Vr.jsx L3274 flex h-screen flex-col） */}
      <div className="flex flex-col h-screen bg-canvas font-sans text-gray-200">
        {/* 本地引擎未连接全屏提醒（完整复刻官方 Vr.jsx L3274-3280 挂载 _cmp_Tr） */}
        <LocalToolConnectModal
          isVisible={connectWarn}
          onClose={() => {
            setConnectWarn(false)
            setWarnDismissed(true) // 对齐官方 ct(true)：用户关闭后不再自动弹，直到重连
          }}
          onRetry={checkConnection}
        />
        {/* 顶部导航栏：Logo + 画布/多开 pill tab + 项目选择器 + 右侧设置/AI 助手 */}
        <TopNav
          view={view}
          onNavigate={setView}
          onSwitchProject={handleSwitchProject}
          onCreateProject={handleCreateProject}
          agentOpen={agentOpen}
          onToggleAgent={() => setAgentOpen((v) => !v)}
        />

        {/* 内容区：画布为基座，多开/设置整页覆盖（官方 visible/invisible 覆盖层形态） */}
        <div ref={menu.containerRef} className="relative flex-1 min-h-0">
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          onNodesChange={onNodesChangeForEdges}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineComponent={ConnectionLine}
          connectionRadius={60}
          deleteKeyCode={['Backspace', 'Delete']}
          onPaneContextMenu={menu.onPaneContextMenu}
          onNodeContextMenu={menu.onNodeContextMenu}
          onSelectionContextMenu={menu.onSelectionContextMenu}
          onSelectionEnd={menu.onSelectionEnd}
          onPaneClick={menu.onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          proOptions={proOptions}
          minZoom={0.05}
          maxZoom={4}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
          onViewportChange={onViewportChange}
          /* ===== 画布性能优化（复刻 H_.jsx:11958-11964）===== */
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          nodeOrigin={[0, 0]}
          onlyRenderVisibleElements={nodes.length > 20}
          selectionOnDrag={nodes.length <= 80}
          panOnDrag
          className={nodes.length > 100 ? 'performance-large-canvas' : undefined}
        >
          {/* 点阵网格：gap=20 / size=1 / color=#333（复刻 H_.jsx:12100） */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#333"
            bgColor="#0d0c0c"
          />
          {/* 小地图（复刻 H_.jsx:12095-12098，仅当开启且节点数 <100 时显示） */}
          {/* 抉择：定位在左下角工具栏上方（bottom-16），样式令牌 #222/#333/nodeColor#444 对齐 docs/39 */}
          {minimapOn && nodes.length < 100 && (
            <div className="absolute left-4 bottom-16 z-canvas-tools flex flex-col items-start gap-2 pointer-events-none">
              <MiniMap
                pannable
                zoomable
                maskColor="#0d0c0c80"
                nodeColor="#444"
                className="!bg-surface-1 !m-0 !relative !bottom-0 !left-0 shadow-2xl rounded overflow-hidden border border-edge pointer-events-auto"
              />
            </div>
          )}
          {/* 性能模式横幅（复刻 H_.jsx:11966-11971：ge 开 且 lodLevel>=2 时顶部黄条） */}
          {/* lodLevel 由下方 LodListener 计算（缩放越小 level 越高）：>=2 缩到 ≤0.3，>=3 缩到 ≤0.2 */}
          {performanceMode && lodLevel >= 2 && (
            <Panel position="top-center" className="mt-4 pointer-events-none">
              <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-2 animate-pulse">
                <Zap size={14} className="text-yellow-400" />
                {lodLevel === 3 ? '已进入全局性能模式 (图片视频已隐藏)' : '低缩放性能模式 (图片已隐藏)'}
              </div>
            </Panel>
          )}
          {/* 画布在其他窗口被修改警告条（复刻官方 H_.jsx:11984-11991：Sn 时红色横幅，点击刷新页面） */}
          {canvasConflict && (
            <Panel position="top-center" className="mt-16 pointer-events-none">
              <div
                className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer"
                onClick={() => window.location.reload()}
                title="点击刷新页面"
              >
                <RefreshCw size={14} className="text-red-400 animate-pulse" />
                检测到该画布在其他窗口被修改，继续保存可能会覆盖数据，强烈建议点击此处刷新页面！
              </div>
            </Panel>
          )}
          {/* LOD 视口缩放监听（基座 LodListener）。
              enablePerformanceMode=false 时 LodListener 会清空 lod class 并把 lodLevel 置 0，
              因此「性能模式关 → 节点不隐藏媒体、横幅不弹」天然成立（各节点用 useLod 读 lodLevel）。 */}
          <LodListener onLodChange={setLodLevel} enablePerformanceMode={performanceMode} />
        </ReactFlow>

        {/* 画布专属覆盖层：仅画布视图渲染（对齐官方 V 视图互斥，避免叠到设置/多开上） */}
        {view === 'canvas' && (
          <>
            {/* 画布空状态引导「右键自由生成你的想象」（完整复刻官方 H_.jsx L12622：画布加载完成且无节点时显示） */}
            {canvasLoaded && nodes.length === 0 && (
              <EmptyCanvasGuide onAdd={(type) => addNode(type, posAtCenter(), defaultNodeData(type))} />
            )}
            {/* 画布 AI 助手面板（复刻官方 _Component40；open 时右侧浮出）；设置/AI 助手按钮已在顶部导航栏右侧 */}
            <AgentPanel
              agentKey="canvas-assistant"
              open={agentOpen}
              onClose={() => setAgentOpen(false)}
              systemPrompt={''}
            />

            {/* 左侧滑出面板：任务中心 + 素材库（fixed 覆盖层，不依赖画布容器） */}
            <LeftPanel />

            {/* 左下角工具栏（复刻 H_.jsx:12013 bottom-left） */}
            {/* 抉择：工具栏 + 确认弹窗叠在一个 absolute 容器（left-3 bottom-3），弹窗 absolute bottom-full 挂在工具栏上方 */}
            <div className="absolute left-3 bottom-3 z-canvas-tools pointer-events-auto">
              <div className="relative">
                {/* 整理后「是否保留」确认弹窗（复刻 H_.jsx:11993） */}
                <ArrangeConfirm
                  snapshot={arrangeSnapshot}
                  onRevert={revertArrange}
                  onKeep={keepArrange}
                />
                {/* 占位按钮 onRun/onClearCache 未传：接真系统时在 App 传入（见 CanvasToolbar 注释） */}
            <CanvasToolbar
              minimapOn={minimapOn}
              onToggleMinimap={() => setMinimapOn((v) => !v)}
              onArrange={arrangeCanvas}
              onFitView={() => fitView({ padding: 0.2, duration: 800 })}
              zoomPercent={zoomPercent}
              performanceMode={performanceMode}
              onTogglePerformance={() => setPerformanceMode((v) => !v)}
              onClearCache={handleClearCache}
              localToolConnected={localTool.isConnected}
            />
              </div>
            </div>

            {/* 右键菜单（基座 ContextMenu，挂载于画布外层） */}
            <ContextMenu state={menu.state} items={menuItems} onClose={menu.close} containerRef={menu.containerRef} />
          </>
        )}

        {/* 多开整页：覆盖画布（复刻官方 V='accounts'，含新建表单+环境网格+⋮菜单） */}
        {view === 'accounts' && <AccountsSettings />}
        {/* 设置层：覆盖画布（官方 Vr.jsx 形态），右上角齿轮常驻可切换 */}
        {view === 'settings' && <SettingsFrame />}
        </div>
      </div>
    </LodProvider>
  )
}

export default function App() {
  return (
    <>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      {/* 统一通知容器（顶部居中，配合 toastStore.showToast 使用） */}
      <ToastContainer />
    </>
  )
}
