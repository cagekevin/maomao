import React, { useMemo } from 'react'
import { NodeResizer, useStore } from '@xyflow/react'
import NodeTitle from '../NodeTitle.jsx'
import CustomHandle from '../CustomHandle.jsx'
import { useSizeSync } from './hooks.js'

// ReactFlow store 选择器：订阅单个节点的当前 width/height。
// 目的：让根 div 的 inline width/height 永远等于 ReactFlow 的 node.width/height。
// 当 NodeResizer 拖拽 / 自定义手柄 onMainBoxResize 写回 setNodes 后，store 更新 →
// 本 hook 触发重渲染 → 根 div 尺寸跟随新值 → 与 ReactFlow wrapper 保持像素一致。
// （SSR / 未初始化时 store 可能无 nodeLookup，需安全兜底返回 undefined，外层回退到默认尺寸）
function useNodeSize(id) {
  return useStore((s) => {
    const lookup = s?.nodeLookup
    if (!lookup || !id) return { width: undefined, height: undefined }
    const n = lookup.get(id)
    if (!n) return { width: undefined, height: undefined }
    const w = n.width ?? n.style?.width
    const h = n.height ?? n.style?.height
    return { width: w, height: h }
  })
}

/**
 * 节点外壳（所有节点的公共骨架基座）。
 *
 * ── 关键设计：根 div 尺寸必须 = ReactFlow node 尺寸 ──
 * 端口（CustomHandle）和连线都基于「节点整体中点」计算，而 ReactFlow 节点的尺寸由
 * node.width/height（或 style）决定。因此根 div 不能简单用 `w-full h-full`（那是跟父级
 * 容器，不是跟 ReactFlow 节点尺寸），而必须用 useNodeSize 从 store 订阅 node.width/height，
 * 以 inline style 渲染。这样 NodeResizer / 自定义手柄 / 改比例（useSizeSync）任一途径
 * 改了 node 尺寸，根 div 都跟着变，端口永远在正确中点，杜绝「拖了但端口跑偏」。
 *
 * 尺寸来源总览（都汇聚到 node.width/height）：
 *  - NodeResizer（ReactFlow 内置）：拖拽节点边缘改尺寸，ReactFlow 自动同步 wrapper。
 *  - ResizeFullscreenHandle（自定义手柄）：onResizeEnd → useNodeResize.onMainBoxResize
 *    → 写回 node.width/height + updateNodeInternals。
 *  - useSizeSync：改比例时按比例重算 node 尺寸。
 *
 * @param props
 *  - id, label, defaultTitle, icon   标题栏
 *  - selected                         选中态（z-50）
 *  - resizable                        是否可拖拽调尺寸（默认 true）
 *  - minWidth, minHeight              NodeResizer 最小尺寸
 *  - keepAspect                       拖拽时是否保持比例
 *  - aspectRatio                      'Auto'|'16:9'|...（启用比例同步）
 *  - defaultHeight                    aspectRatio=Auto 时的默认高度
 *  - sizeMode                         'width-fixed'（默认，生图）| 'area-fixed'（特惠视频）
 *  - baseSize                         area-fixed 的面积基准（默认 380）
 *  - handleVariant                    'large'|'small'
 *  - className                        追加到根 div 的 class
 *  - style                            追加到根 div 的 inline style（如 { minHeight: 640 }
 *                                      可让宽节点即使 store n.height 没生效也撑出最小高度）
 *  - wrapperRef                       暴露根 div ref（供右下角手柄拖拽改整体尺寸）
 *  - children                         节点内容（hover栏 + 主显示框 + 展开面板）
 *
 * ════════════════════════════════════════════════════════════════
 * 【新建节点指南：如何写得和通用节点一致】
 * ════════════════════════════════════════════════════════════════
 *
 * 1. 高度怎么保持自适应（无限画布，内容多了不能滚动）
 *    · 节点外壳：NodeShell 根 div 用 min-height（不是固定 height），内容多会自然撑高。
 *    · 但 ReactFlow 的 node.height 是固定值，若内容撑开超过它，端口定位会错位。
 *    · 复合节点（如剧本盒子）做法：用 ResizeObserver 监听主容器高度，
 *      变化时用 useNodeResize(id).onMainBoxResize(w, h) 写回 node.height + updateNodeInternals，
 *      让 ReactFlow wrapper 跟随 → 端口不错位。参考 ScriptBoxNode.jsx。
 *    · 简单节点通常无需自适应：内容固定在 NodeShell 的固定尺寸内即可。
 *
 * 2. 怎么写才能和通用节点保持一致
 *    · 一律用 NodeShell 作为外壳（尺寸/标题/端口/主容器背景都内置），不要自己手写外壳。
 *    · 内容包在 NodeShell 的 children 里；背景/边框/阴影由 NodeShell 主容器统一提供，
 *      节点内部不要再写 bg-surface-raised、rounded、border、shadow（会重复/不一致）。
 *    · 端口用 CustomHandle（要 id 用 handleId、要位置用 top 参数），别自创样式。
 *    · 参考 TextNode / PromptNode / DiscountVideoNode 的写法。
 *
 * 3. 如果不保持一致，要怎么样才最合理
 *    · 先确认差异是「业务内容」还是「外壳」：业务内容差异正常（放 children）；
 *      外壳差异（背景/端口/尺寸行为）应优先收敛到 NodeShell，而不是在节点里特判。
 *    · 确实需要 NodeShell 不提供的通用能力（如：不需要端口 → showHandles={false}、
 *      需要额外端口 → 自己渲染 CustomHandle）时，才在节点层扩展，并在注释里说明原因，
 *      避免下一个 AI 以为是自己写错了。
 * ════════════════════════════════════════════════════════════════
 */
export default function NodeShell({
  id,
  label,
  defaultTitle,
  icon,
  selected,
  resizable = true,
  minWidth = 160,
  minHeight = 160,
  keepAspect = false,
  aspectRatio,
  defaultHeight = 420,
  sizeMode = 'width-fixed',
  baseSize = 380,
  handleVariant = 'large',
  showHandles = true,
  showTitle = true,
  titleRight,
  className = '',
  style: extraStyle = {},
  wrapperRef,
  syncSize = true,
  children
}) {
  // 比例同步：改比例时同步 wrapper 尺寸。
  // syncSize=false（如编组节点）：不强制同步尺寸，尺寸完全由 ReactFlow 节点 style 决定，
  // 否则 useSizeSync 的 Auto 分支会把高度强制设成 defaultHeight，覆盖 group 实际尺寸。
  const ratio = syncSize ? useSizeSync(id, aspectRatio, {
    mode: sizeMode,
    defaultHeight,
    baseSize
  }) : null
  const effectiveKeepAspect = keepAspect || !!ratio

  // 主容器背景层（所有节点共同的纯视觉外壳：背景/圆角/边框/阴影/选中边框）。
  // 各节点 children 由它包住，天然获得统一背景，无需各自手写 bg-surface-raised。
  // 注意：节点若需要 onClick 等交互，应放在自身 children 内部 div 上，不要依赖此层。
  // 注意：不加 overflow-hidden——各节点内部显示框（生图/视频/文本）已自带 rounded+overflow 裁剪；
  // 且 ExpandablePanel / HoverToolbar 是 absolute 定位于节点外（top-full / -top-12），
  // overflow-hidden 会把它们裁掉。背景层只需提供视觉外壳，不承担裁剪。
  // 必须是 flex flex-col：各节点内部主容器 div 用 flex-1 填满高度，依赖父级是 flex 容器。
  const mainShellClassName = `w-full flex-1 min-h-0 flex flex-col bg-surface-raised rounded-xl border shadow-xl transition-colors duration-200 ${selected ? 'border-edge-strong' : 'border-edge hover:border-edge-muted'}`

  // 订阅当前节点尺寸，用于根 div inline style
  const { width, height } = useNodeSize(id)
  // 尺寸来源：node data（初始渲染时可能还没 width/height，回退到默认值）
  //  - 宽度：width-fixed 用 420，area-fixed 用面积基准（baseSize）
  //  - 高度：用 defaultHeight
  const fallbackW = useMemo(() => (sizeMode === 'width-fixed' ? 420 : baseSize), [sizeMode, baseSize])
  const inlineW = width ?? fallbackW
  const inlineH = height ?? defaultHeight

  return (
    <div
      ref={wrapperRef}
      className={`relative flex flex-col items-center group/node min-w-[160px] min-h-[160px] ${selected ? 'z-50' : 'z-10'} ${className}`}
      style={{ width: typeof inlineW === 'number' ? `${inlineW}px` : inlineW, minHeight: typeof inlineH === 'number' ? `${inlineH}px` : inlineH, ...extraStyle }}
    >
      {/* 标题：与所有节点完全一致（NodeTitle mb-1 self-start，宽度只包内容）。
          titleRight 操作组用绝对定位浮在标题右侧，不改变 NodeTitle 的位置/间距 */}
      {showTitle && <NodeTitle label={label} defaultTitle={defaultTitle} icon={icon} />}
      {titleRight && (
        <div className="absolute right-0 -top-0.5 flex items-center gap-1 nodrag">{titleRight}</div>
      )}

      {/* 尺寸调整（ReactFlow NodeResizer：仅右下角白色圆角手柄） */}
      {resizable && (
        <NodeResizer
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={effectiveKeepAspect}
          isVisible={selected}
          color="#ffffff80"
          lineClassName="opacity-0"
          handleClassName="!text-white/60 hover:!text-blue-400"
        />
      )}

      {/* 主容器背景层：统一背景/圆角/边框/阴影/选中边框（见 mainShellClassName） */}
      <div className={mainShellClassName}>{children}</div>

      {/* 端口统一渲染，相对根 div 定位 → 在 wrapper 中点。
          剧本盒子等复合节点用 showHandles={false} 关闭，改用内部每镜头/每输出口端口 */}
      {showHandles && (
        <>
          <CustomHandle position="left" variant={handleVariant} />
          <CustomHandle position="right" variant={handleVariant} />
        </>
      )}
    </div>
  )
}