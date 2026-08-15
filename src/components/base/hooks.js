import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react'

/**
 * 判断事件目标是否在可编辑元素内（INPUT / TEXTAREA / contenteditable）。
 * 右键菜单与快捷键都要「在输入框内跳过」，共用此判定（复刻 H_.jsx:1316-1323 Xn）。
 */
export function isEditableTarget(e) {
  const t = e?.target
  if (!t) return false
  const tag = t.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    !!t.isContentEditable ||
    (!!t.closest && !!t.closest('input, textarea, [contenteditable="true"]'))
  )
}

/**
 * 「点击外部关闭」公共 hook（outside click）。
 *
 * 场景：下拉菜单 / 弹层打开后，用户点击弹层以外的空白处时自动收起。
 * 全项目所有这类弹层统一用它，避免各组件各自手写 document 监听（历史上 ModelSelect、
 * PromptInput 两份几乎逐字的重复代码就是从这里抽出来的）。
 *
 * 实现要点：
 *  - visible 为 true 时才挂 document mousedown 监听（capture 阶段，用 true）。
 *  - 用 capture=true 是因为 mousedown 冒泡前就能拦截，且弹层内部 onClick 常做
 *    stopPropagation；capture 监听发生在冒泡之前，配合 contains 判断不会误关。
 *  - contains 判断：点击落在 ref.current（弹层本身）内部 → 不关；否则 → onClose()。
 *  - 卸载时自动移除监听，避免内存泄漏。
 *
 * @param ref     弹层/菜单容器的 ref
 * @param visible 弹层是否打开（仅打开时挂监听）
 * @param onClose 点击外部时的关闭回调
 */
export function useOutsideClick(ref, visible, onClose) {
  useEffect(() => {
    if (!visible) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [ref, visible, onClose])
}

/**
 * 展开/收起控制 hook。
 * 所有带「下方输入面板」的节点共用同一套展开语义：
 *  - 点击主显示框切换
 *  - 面板用 opacity/scale/h-0 过渡
 */
export function useNodeExpanded(initial = true) {
  const [expanded, setExpanded] = useState(initial)
  const toggle = useCallback(() => setExpanded((v) => !v), [])
  return { expanded, setExpanded, toggle }
}

/**
 * 比例 → 节点尺寸同步 hook（复刻 bo.jsx:631-745 / As.jsx:993-1140 尺寸管理）。
 * 解决「改比例时端口/连线跑偏」：比例变化时同步 wrapper 尺寸，
 * 并调用 updateNodeInternals 让 React Flow 重算 handle 位置。
 *
 * 两种尺寸模式：
 *  - mode='width-fixed'（生图节点）：宽度固定，height = 当前宽度 ÷ 比例
 *  - mode='area-fixed'（特惠视频）：面积固定，width = sqrt(ratio)*base，height = base/sqrt(ratio)
 *
 * @param id 节点 id
 * @param aspectRatio 当前比例字符串（'Auto' 或 '16:9'）
 * @param opts { mode, defaultWidth, defaultHeight, baseSize }
 */
export function useSizeSync(id, aspectRatio, opts = {}) {
  const { getNodes, setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const mode = opts.mode || 'width-fixed'
  const defaultWidth = opts.defaultWidth ?? 420
  const defaultHeight = opts.defaultHeight ?? 420
  const baseSize = opts.baseSize ?? 380 // area-fixed 的面积基准
  const ratio = parseAspect(aspectRatio)

  useEffect(() => {
    const n = getNodes().find((x) => x.id === id)
    if (!n) return
    let w, h
    if (ratio) {
      if (mode === 'area-fixed') {
        w = Math.round(Math.sqrt(ratio) * baseSize)
        h = Math.round(baseSize / Math.sqrt(ratio))
      } else {
        // width-fixed：宽度固定为当前宽度（或默认宽）
        w = n.style?.width ?? n.width ?? defaultWidth
        h = Math.round(w / ratio)
      }
    } else {
      // Auto：用默认尺寸
      w = n.style?.width ?? n.width ?? defaultWidth
      h = defaultHeight
    }
    const changed =
      (n.style?.height ?? n.height) !== h || (n.style?.width ?? n.width) !== w
    if (changed) {
      setNodes((ns) =>
        ns.map((x) =>
          x.id === id
            ? { ...x, width: w, height: h, style: { ...x.style, width: w, height: h } }
            : x
        )
      )
      updateNodeInternals(id)
    }
  }, [id, ratio, mode, defaultWidth, defaultHeight, baseSize, getNodes, setNodes, updateNodeInternals])

  return ratio
}

/**
 * 解析 '16:9' / '1:1' / 'Auto' → 宽高比数值或 null。
 */
export function parseAspect(aspectRatio) {
  if (!aspectRatio || aspectRatio === 'Auto') return null
  const m = aspectRatio.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/)
  return m ? parseFloat(m[1]) / parseFloat(m[2]) : null
}

/**
 * 右下角手柄（ResizeFullscreenHandle）的尺寸写回 hook。
 * 统一「手柄拖拽 → 尺寸写回 ReactFlow」这一公共机制，供所有节点复用一个入口：
 *
 *  - onMainBoxResize(w, h)：主框手柄 → 写回 node.width/height + updateNodeInternals
 *  - onInputResize(w, h)：输入框手柄 → 写回 node.data.inputWidth/inputHeight
 *
 * ── 为什么两条路径不同（本质差异）──
 * 1. 主框是节点的「主体」，它的尺寸就是 ReactFlow 节点的尺寸（wrapper 大小）。
 *    主框手柄拖拽后，必须把新尺寸写回 node.width/height + updateNodeInternals，
 *    否则 ReactFlow wrapper 仍是旧尺寸 → 端口（handle 基于 wrapper 中点定位）会错位、
 *    拖拽结果也不会持久。所以 onMainBoxResize 要动 node.width/height。
 * 2. 输入框只是「面板里的一个元素」，不参与 ReactFlow 节点尺寸/端口定位，
 *    它自己的宽高用 node.data.inputWidth/inputHeight 记录即可，textarea 的
 *    inline style 读这个 data 渲染（复刻官方 inputWidth/inputHeight 机制）。
 *
 * 一句话：主框拖的是「节点的壳」，必须写回 ReactFlow；输入框拖的是「壳里的部件」，
 * 存 data 即可。两者都通过 setNodes 触发重渲染，从而让目标元素跟随新尺寸。
 *
 * @param id 节点 id
 */
export function useNodeResize(id) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const onMainBoxResize = useCallback(
    (w, h) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, width: w, height: h, style: { ...n.style, width: w, height: h } } : n
        )
      )
      updateNodeInternals(id)
    },
    [id, setNodes, updateNodeInternals]
  )

  const onInputResize = useCallback(
    (w, h) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, inputWidth: w, inputHeight: h } } : n))
      )
    },
    [id, setNodes]
  )

  return { onMainBoxResize, onInputResize }
}

/**
 * 统一「新建节点落点」计算（公共 base）。
 *
 * 所有新建节点入口共用此落点规则，避免各写各的导致不一致：
 *  - posAtMenu(menuState)  右键菜单（含工具子菜单/视频抽帧）→ 右键点击位置（点哪建哪）
 *                          注意用 menuState.client（视口坐标）经 screenToFlowPosition 换算成
 *                          flow 坐标；不能用 menuState.x/y（那是容器相对坐标，坐标系不同）。
 *  - posAtCenter()         Q/W/E 快捷键等无坐标入口 → 视图中央
 *
 * 返回的 position 均为画布 flow 坐标，可直接传给 addNode / addNodes。
 */
export function useNodePosition() {
  const { screenToFlowPosition } = useReactFlow()

  const posAtMenu = useCallback(
    (menuState) => {
      const s = menuState || {}
      return s.client
        ? screenToFlowPosition(s.client)
        : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    },
    [screenToFlowPosition]
  )

  const posAtCenter = useCallback(
    () => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [screenToFlowPosition]
  )

  return { posAtMenu, posAtCenter }
}
