import { useState, useCallback, useRef } from 'react'
import { isEditableTarget } from './hooks.js'

/**
 * 右键菜单状态 hook（复刻 H_.jsx:131,1324-1388 的 Fe/Xe 菜单状态与三个触发 handler）。
 *
 * 提供：
 *  - state       { x, y, type, nodeId } | null
 *  - containerRef 画布容器 ref（供 ContextMenu 做坐标基准与防溢出）
 *  - onPaneContextMenu / onNodeContextMenu / onSelectionContextMenu / onSelectionEnd
 *    直接传给 ReactFlow 的四个回调
 *  - onPaneClick 点击空白关闭菜单
 *  - close      手动关闭
 *
 * ── 坐标系（与 ContextMenu 组件配套，务必一致）──
 * 鼠标事件的 clientX/clientY 是「相对视口」的页面坐标，但菜单要 absolute 定位在
 * ReactFlow 外层那个 <div ref={containerRef} className="relative"> 里，top/left 是
 * 「相对容器」的坐标。所以 toContainerPos 用 containerRef.getBoundingClientRect() 做基准，
 * 把 client 坐标换算成相对容器坐标：x = clientX - rect.left，y = clientY - rect.top。
 * ContextMenu 拿到 state.x/y 后 top/left 直接用它，就能让菜单左上角对齐鼠标点。
 * 注意：containerRef 必须和 ContextMenu 挂在同一个 relative div 上，否则坐标系错位。
 */
export function useContextMenu() {
  const [state, setState] = useState(null)
  const containerRef = useRef(null)

  const toContainerPos = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const open = useCallback(
    (type, nodeId, e) => {
      if (isEditableTarget(e)) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = toContainerPos(e.clientX, e.clientY)
      // client 存原始屏幕坐标（视口坐标系），供建节点时用 screenToFlowPosition 换算出正确落点
      const client = { x: e.clientX, y: e.clientY }
      setState(nodeId ? { x, y, type, nodeId, client } : { x, y, type, client })
    },
    [toContainerPos]
  )

  // 打开「连接」菜单：从端口拖出到空白，弹菜单选下游节点类型（复刻官方 onConnectEnd Oi）
  // 单一数据源：直接复用空白处（canvas）同一套菜单，不另起 connection 菜单。
  // 仅把这次拖拽的源信息（connection）挂进 state，菜单项据此决定是否自动连线。
  const openConnection = useCallback(
    (connection, clientX, clientY) => {
      const { x, y } = toContainerPos(clientX, clientY)
      setState({ x, y, type: 'canvas', connection })
    },
    [toContainerPos]
  )

  // 空白处右键
  const onPaneContextMenu = useCallback((e) => open('canvas', null, e), [open])
  // 节点右键
  const onNodeContextMenu = useCallback((e, node) => open('node', node.id, e), [open])
  // 多选框右键
  const onSelectionContextMenu = useCallback((e, nodes) => open('selection', null, e), [open])
  // 拖拽框结束且选中>1 时弹出（复刻 er：延迟 50ms 判断选中数）
  const onSelectionEnd = useCallback(
    (e, nodes) => {
      setTimeout(() => {
        const n = nodes || []
        if (n.length > 1) open('selection', null, e)
      }, 50)
    },
    [open]
  )

  // 点击空白关闭（复刻 nr）
  const onPaneClick = useCallback(() => setState(null), [])

  const close = useCallback(() => setState(null), [])

  return {
    state,
    containerRef,
    onPaneContextMenu,
    onNodeContextMenu,
    onSelectionContextMenu,
    onSelectionEnd,
    onPaneClick,
    openConnection,
    close
  }
}
