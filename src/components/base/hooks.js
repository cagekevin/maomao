import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { NODE_AREA_FIXED_BASE_SIZE } from './config.js'

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
  const { getNode, setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const mode = opts.mode || 'width-fixed'
  const defaultWidth = opts.defaultWidth ?? 420
  const defaultHeight = opts.defaultHeight ?? 420
  const baseSize = opts.baseSize ?? NODE_AREA_FIXED_BASE_SIZE // area-fixed 的面积基准
  const ratio = parseAspect(aspectRatio)

  useEffect(() => {
    const n = getNode(id)
    if (!n) return
    // 尺寸计算收敛到纯函数 computeSizeSync（width-fixed / area-fixed / Auto），可单测
    const { width: w, height: h } = computeSizeSync(ratio, {
      mode, currentWidth: n.style?.width ?? n.width ?? defaultWidth, defaultWidth, defaultHeight, baseSize,
    })
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
  }, [id, ratio, mode, defaultWidth, defaultHeight, baseSize, getNode, setNodes, updateNodeInternals])

  return ratio
}

/**
 * 解析 '16:9' / '1:1' / 'Auto' → 宽高比数值或 null。
 *  纯函数，导出供单测（useSizeSync 尺寸计算的输入解析）。
 */
export function parseAspect(aspectRatio) {
  if (!aspectRatio || aspectRatio === 'Auto') return null
  const m = aspectRatio.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/)
  return m ? parseFloat(m[1]) / parseFloat(m[2]) : null
}

/**
 * 纯函数：按比例计算节点目标尺寸（useSizeSync 的算法核心，抽出供单测）。
 *  - ratio=null（Auto/无比例）→ 返回默认尺寸
 *  - mode='width-fixed'（生图节点）：宽固定 currentWidth，高 = 宽 ÷ 比例
 *  - mode='area-fixed'（特惠视频）：宽 = sqrt(比例)*base，高 = base/sqrt(比例)
 * @param {number|null} ratio  宽高比值（parseAspect 的产物）
 * @param {object} opts { mode, currentWidth, defaultWidth, defaultHeight, baseSize }
 * @returns {{width, height}}
 */
export function computeSizeSync(ratio, opts = {}) {
  const mode = opts.mode || 'width-fixed'
  const defaultWidth = opts.defaultWidth ?? 420
  const defaultHeight = opts.defaultHeight ?? 420
  const baseSize = opts.baseSize ?? NODE_AREA_FIXED_BASE_SIZE
  const currentWidth = opts.currentWidth ?? defaultWidth
  if (ratio) {
    if (mode === 'area-fixed') {
      return {
        width: Math.round(Math.sqrt(ratio) * baseSize),
        height: Math.round(baseSize / Math.sqrt(ratio)),
      }
    }
    // width-fixed：宽度固定为当前宽度（或默认宽）
    return { width: currentWidth, height: Math.round(currentWidth / ratio) }
  }
  // Auto / 无比例：默认尺寸
  return { width: currentWidth, height: defaultHeight }
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
 * 内容高度自适应 hook（无限画布：内容撑开时节点高度跟随，消除 ResizeObserver 循环告警）。
 *
 * 【收口背景】VideoProcess / GridSplit / ScriptBox / GridMerge 四个节点此前各自手写同一套
 * ResizeObserver 高度自适应（监听 contentRef → onMainBoxResize 写回 node.height + updateNodeInternals）。
 * 手写 ≥3 次必收口（CONTEXT §一·五C），此处抽公共实现，四节点复用。
 *
 * 【ResizeObserver loop 告警根因（2026-08-20 根治）】
 * 旧实现每次回调都读 `getNode(id).height` 作 4px 阈值判定，但 setNodes 是异步批量更新，
 * 回调执行时拿到的 node.height 仍是旧值 → 阈值永远基于滞后数据 → 写回后又触发尺寸变化 → 同帧内
 * 反复触发，浏览器报 `ResizeObserver loop completed with undelivered notifications`。
 *
 * 【根治手段（行为等价，只改防抖来源与时机）】
 *  1. lastWrittenH ref：基于「自己上次真正写回的高度」判断 4px 阈值，不读滞后的 node.height，
 *     真正打破「读旧值→误判需更新→再写」的循环。
 *  2. requestAnimationFrame：把 onMainBoxResize（setNodes）推迟到下一帧，不再同帧内反复触发
 *     ResizeObserver，正是消除 loop 告警的直接手段。
 *  3. 尺寸计算逻辑与 4px 阈值与原手写版完全一致，行为等价、仅修循环与告警。
 *
 * @param ref          contentRef：监听内容区高度的元素 ref（调用方 useRef + 绑定到内容区根 div）
 * @param id           节点 id
 * @param opts { minHeight?, fallbackWidth? }
 *   - minHeight        写回时的最小高度（原各节点 Math.max(N, h) 的 N）
 *   - fallbackWidth    拿不到 node.width 时的兜底宽度（原各节点 `n?.width ?? fallback`）
 * @returns ref        调用方需把返回的 ref 绑到内容区根 div（用法见调用方）
 */
export function useContentHeightSync(ref, id, { minHeight = 0, fallbackWidth = 420 } = {}) {
  const { getNode } = useReactFlow()
  const { onMainBoxResize } = useNodeResize(id)

  // 记录自己上次真正写回的高度（而非读滞后的 node.height），作为 4px 阈值防抖的判定来源。
  // 避免「读旧值→误判需更新→再写回→再触发」的同帧循环（ResizeObserver loop 告警根因）。
  const lastWrittenH = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pendingRaf = 0
    let reobserveRaf = 0
    let ro = null

    // 创建并挂载观察者。回调发现高度变化 → 先 disconnect（停止本轮观察），rAF 写回 node.height，
    // 下一帧尺寸稳定后再重新 observe。这样写回（setNodes→wrapper 尺寸变）不会被同一 observation 周期
    // 再次捕获，消除 `ResizeObserver loop completed` 告警（浏览器认为回调又触发了被观察元素尺寸变化）。
    const mount = () => {
      ro = new ResizeObserver(() => {
        const h = el.offsetHeight
        if (!h) return
        // 阈值基于「自己上次写回的高度」，而非 getNode(id).height（滞后值），真正防抖
        if (Math.abs(h - lastWrittenH.current) < 4) return
        lastWrittenH.current = h
        // 写回前先断开观察，避免写回引发的尺寸变化在当轮 observation 内被再次捕获
        ro?.disconnect()
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = 0
          const n = getNode(id)
          const curW = n?.width ?? n?.style?.width ?? fallbackWidth
          onMainBoxResize(Math.round(curW), Math.max(minHeight, Math.round(h)))
          // 下一帧（写回已生效、尺寸稳定）重新开始观察
          reobserveRaf = requestAnimationFrame(() => {
            reobserveRaf = 0
            mount()
          })
        })
      })
      try { ro.observe(el) } catch { /* noop */ }
    }

    mount()
    return () => {
      if (pendingRaf) cancelAnimationFrame(pendingRaf)
      if (reobserveRaf) cancelAnimationFrame(reobserveRaf)
      ro?.disconnect()
    }
  }, [ref, id, getNode, onMainBoxResize, minHeight, fallbackWidth])
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
