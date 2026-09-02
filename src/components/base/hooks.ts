import { useState, useEffect, useRef, useCallback } from 'react'
import type { Dispatch, SetStateAction, RefObject, Ref, MouseEvent as ReactMouseEvent } from 'react'
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { NODE_AREA_FIXED_BASE_SIZE } from './config.ts'

/**
 * 判断事件目标是否在可编辑元素内（INPUT / TEXTAREA / contenteditable）。
 * 右键菜单与快捷键都要「在输入框内跳过」，共用此判定（复刻 H_.jsx:1316-1323 Xn）。
 *
 * 入参放宽为「任意带 target 的事件」：既有调用方涵盖 React 合成事件与原生事件
 * （useCanvasShortcuts 传的是原生 KeyboardEvent），故只约束到 target 这一最小契约。
 */
export function isEditableTarget(e?: { target?: EventTarget | null } | null): boolean {
  const t = e?.target as (EventTarget & {
    tagName?: string
    isContentEditable?: boolean
    closest?: (sel: string) => Element | null
  }) | null
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
 *  - contains 判断：点击落在任一 ref.current（弹层本身）内部 → 不关；否则 → onClose()。
 *    支持传单个 ref 或 ref 数组（portal 到 body 的弹层需把 popupRef 一并纳入，否则会被误判为外部）。
 *  - 卸载时自动移除监听，避免内存泄漏。
 *
 * @param ref     弹层/菜单容器的 ref（或 ref 数组）
 * @param visible 弹层是否打开（仅打开时挂监听）
 * @param onClose 点击外部时的关闭回调
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  visible: boolean,
  onClose?: () => void
): void {
  useEffect(() => {
    if (!visible) return
    const refs = Array.isArray(ref) ? ref : [ref]
    const close = (e: globalThis.MouseEvent) => {
      const inside = refs.some((r) => r.current && r.current.contains(e.target as Node))
      if (!inside) onClose?.()
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
export function useNodeExpanded(initial = true): {
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  toggle: () => void
} {
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
 *  - mode='area-fixed'（视频生成）：面积固定，width = sqrt(ratio)*base，height = base/sqrt(ratio)
 *
/** 尺寸模式：width-fixed（宽固定）/ area-fixed（面积固定，视频生成用） */
export type SizeSyncMode = 'width-fixed' | 'area-fixed'

export interface SizeSyncOptions {
  /** 尺寸模式，默认 'width-fixed' */
  mode?: SizeSyncMode
  defaultWidth?: number
  defaultHeight?: number
  /** area-fixed 的面积基准 */
  baseSize?: number
}

/** computeSizeSync / useSizeSync 的产物 */
export interface SizeSync {
  width: number
  height: number
}

/**
 * @param id 节点 id
 * @param aspectRatio 当前比例字符串（'Auto' 或 '16:9'）
 * @param opts { mode, defaultWidth, defaultHeight, baseSize }
 */
export function useSizeSync(id: string, aspectRatio: string, opts: SizeSyncOptions = {}): number | null {
  const { getNode, setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const mode = opts.mode || 'width-fixed'
  const defaultWidth = opts.defaultWidth ?? 420
  const defaultHeight = opts.defaultHeight ?? 420
  const baseSize = opts.baseSize ?? NODE_AREA_FIXED_BASE_SIZE // area-fixed 的面积基准
  const ratio = parseAspect(aspectRatio)

  useEffect(() => {
    // Auto / 无比例（ratio=null）：不干预节点尺寸。
    // 【为什么不再重置为默认方框】Auto 意味着「节点尺寸由实际媒体/编辑决定」——
    // PromptNode 裁剪/扩图后用 fitByRatio 跟随图片真实比例，ImageNode 用 <img onLoad> 自动跟随。
    // 若 Auto 仍把高度强制设成 defaultHeight，会覆盖这些媒体自适应结果（表现成「框被锁定」）。
    // 各节点初始显示仍有 NodeShell 的 useNodeSize + fallback 兜底，不会塌陷（见 NodeShell L242-248）。
    // GroupNode 已用 syncSize={false} 手动关掉本行为，印证 Auto 强制重置是已知副作用。
    if (!ratio) return
    const n = getNode(id)
    if (!n) return
    // 尺寸计算收敛到纯函数 computeSizeSync（width-fixed / area-fixed），可单测
    // Number() 归一：ReactFlow 的 style.width 可能是字符串（'260'），统一数值化保证后续算术合法
    // （与 useFitNodeRatio 同口径；字符串在 React inline style 下本就是无效宽度值）。
    const { width: w, height: h } = computeSizeSync(ratio, {
      mode, currentWidth: Number(n.style?.width ?? n.width ?? defaultWidth), defaultWidth, defaultHeight, baseSize,
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
export function parseAspect(aspectRatio?: string | null): number | null {
  if (!aspectRatio || aspectRatio === 'Auto') return null
  const m = aspectRatio.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/)
  return m ? parseFloat(m[1]) / parseFloat(m[2]) : null
}

/**
 * 纯函数：按比例计算节点目标尺寸（useSizeSync 的算法核心，抽出供单测）。
 *  - ratio=null（Auto/无比例）→ 返回默认尺寸
 *  - mode='width-fixed'（生图节点）：宽固定 currentWidth，高 = 宽 ÷ 比例
 *  - mode='area-fixed'（视频生成）：宽 = sqrt(比例)*base，高 = base/sqrt(比例)
 * @param ratio  宽高比值（parseAspect 的产物）
 * @param opts { mode, currentWidth, defaultWidth, defaultHeight, baseSize }
 */
export function computeSizeSync(
  ratio: number | null,
  opts: SizeSyncOptions & { currentWidth?: number } = {}
): SizeSync {
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
export function useNodeResize(id: string): {
  /** 主框手柄 → 写回 node.width/height + updateNodeInternals */
  onMainBoxResize: (w: number, h: number) => void
  /** 输入框手柄 → 写回 node.data.inputWidth/inputHeight */
  onInputResize: (w: number, h: number) => void
} {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const onMainBoxResize = useCallback(
    (w: number, h: number) => {
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
    (w: number, h: number) => {
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
 * @param opts { minHeight?, fallbackWidth?, syncWidth?, wrapperRef? }
 *   - minHeight        写回时的最小高度（原各节点 Math.max(N, h) 的 N）
 *   - fallbackWidth    拿不到 node.width 时的兜底宽度（原各节点 `n?.width ?? fallback`）
 *   - syncWidth        是否同时同步宽度为「内容元素实际宽度」（el.offsetWidth）。
 *                      默认 false（只同步高度，宽度沿用 node.width —— 旧行为）。
 *                      设 true：写回时用内容实际宽度，让 ReactFlow 盒子(.react-flow__node)
 *                      与视觉框贴合。修复「conic 连接跑马灯不贴合宽扁节点」的根因：
 *                      （剧本盒等宽度固定、但 useContentHeightSync 从不写回 node.width，
 *                      导致 conic inset 锚定的 ReactFlow 盒子宽度 ≠ 视觉宽度）。
 *   - wrapperRef       可选：NodeShell 根 div ref（传 NodeShell 的 wrapperRef）。
 *                      ⚠️ 关键修复：不传时测 contentRef（内容区），会漏掉 NodeShell 标题栏高度，
 *                      导致写回的 node.height 比视觉框矮 → conic 连接跑马灯（inset 锚定
 *                      .react-flow__node）「停在最后内容底部」不贴合。
 *                      传 wrapperRef（= 含标题栏的完整节点）时，改测 wrapper 完整高度，
 *                      让 node.height 贴合完整视觉框。内容自适应节点都应传此参数。
 * @returns ref        调用方需把返回的 ref 绑到内容区根 div（用法见调用方）
 */
export interface ContentHeightSyncOptions {
  /** 写回时的最小高度（原各节点 Math.max(N, h) 的 N） */
  minHeight?: number
  /** 拿不到 node.width 时的兜底宽度 */
  fallbackWidth?: number
  /** 是否同时同步宽度为「内容元素实际宽度」，默认 false */
  syncWidth?: boolean
  /** 可选：NodeShell 根 div ref（传它则测完整节点，含标题栏） */
  wrapperRef?: RefObject<HTMLElement | null>
}

export function useContentHeightSync(
  ref: RefObject<HTMLElement | null>,
  id: string,
  { minHeight = 0, fallbackWidth = 420, syncWidth = false, wrapperRef }: ContentHeightSyncOptions = {}
): void {
  const { getNode } = useReactFlow()
  const { onMainBoxResize } = useNodeResize(id)

  // 记录自己上次真正写回的高度（而非读滞后的 node.height），作为 4px 阈值防抖的判定来源。
  // 避免「读旧值→误判需更新→再写回→再触发」的同帧循环（ResizeObserver loop 告警根因）。
  const lastWrittenH = useRef<number>(0)

  // 统一测量基准：有 wrapperRef 就测完整节点（含 NodeShell 标题栏），否则退回内容区。
  // 观察对象与写回高度都基于它，避免「contentRef 漏标题 → node.height 偏矮 → 跑马灯不贴」。
  const measureRef = wrapperRef || ref

  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    let pendingRaf = 0
    let reobserveRaf = 0
    let ro: ResizeObserver | null = null

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
          // syncWidth=true：宽度同步为「内容元素实际宽度」，让 ReactFlow 盒子(.react-flow__node)
          // 贴合视觉框（否则剧本盒等固定宽节点宽度从不同步，conic 连接跑马灯锚定的盒子宽度 ≠ 视觉宽）。
          // 内容元素在节点内通常 w-full，其 offsetWidth 即视觉宽度。
          // Number() 归一：style.width 可能是字符串，且 onMainBoxResize 要求 number
          const curW = syncWidth
            ? Math.round(el.offsetWidth || n?.width || fallbackWidth)
            : Number(n?.width ?? n?.style?.width ?? fallbackWidth)
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
  }, [measureRef, id, getNode, onMainBoxResize, minHeight, fallbackWidth, syncWidth])
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
/** 画布坐标（screenToFlowPosition 输出 / addNode 入参） */
export interface FlowPosition {
  x: number
  y: number
}

/** 右键菜单状态里本 hook 消费的部分（client 为视口坐标） */
export interface MenuStateLike {
  client?: FlowPosition
  [key: string]: unknown
}

export function useNodePosition(): {
  posAtMenu: (menuState?: MenuStateLike | null) => FlowPosition
  posAtCenter: () => FlowPosition
} {
  const { screenToFlowPosition } = useReactFlow()

  const posAtMenu = useCallback(
    (menuState?: MenuStateLike | null): FlowPosition => {
      const s = menuState || {}
      return s.client
        ? screenToFlowPosition(s.client)
        : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    },
    [screenToFlowPosition]
  )

  const posAtCenter = useCallback(
    (): FlowPosition => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [screenToFlowPosition]
  )

  return { posAtMenu, posAtCenter }
}
