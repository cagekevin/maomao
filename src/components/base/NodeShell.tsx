import React, { useMemo, type CSSProperties, type Ref, type ReactNode } from 'react'
import { NodeResizer, useStore } from '@xyflow/react'
import NodeTitle from './NodeTitle.tsx'
import CustomHandle from '../edges/CustomHandle.tsx'
import { useSizeSync } from './hooks.ts'
import { NODE_AREA_FIXED_BASE_SIZE } from './config.ts'
import ErrorBoundary from './ErrorBoundary.tsx'
import { logger } from './logger.ts'

type SizeMode = 'width-fixed' | 'area-fixed'
type HandleVariant = 'large' | 'small'

interface NodeShellProps {
  id: string
  label?: string
  defaultTitle?: string
  icon?: ReactNode
  selected?: boolean
  resizable?: boolean
  minWidth?: number
  minHeight?: number
  keepAspect?: boolean
  aspectRatio?: string
  defaultHeight?: number
  sizeMode?: SizeMode
  baseSize?: number
  handleVariant?: HandleVariant
  showHandles?: boolean
  /** 右侧 source 端口的 handleId。
      默认留空（React Flow 视为 null handle），关闭时不影响既有无 id 连边；
      传 'main-output' 等值可让该节点作为固定契约的连线源头（如「转深度」spawn 写死 sourceHandle 的场景）。 */
  sourceHandleId?: string
  showTitle?: boolean
  titleRight?: ReactNode
  onRename?: (label: string) => void
  className?: string
  style?: CSSProperties
  wrapperRef?: Ref<HTMLDivElement>
  overlayHandles?: ReactNode
  syncSize?: boolean
  children?: ReactNode
}

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
 *  - useSizeSync：改比例时按比例重算 node 尺寸（宽高同时写回）。
 *  - useContentHeightSync：内容区 ResizeObserver 监听高度自适应，写回 node.height。
 *    ⚠️ 默认只同步「高度」，不同步「宽度」——这是有意的（宽度通常由 useSizeSync/NodeResizer
 *    管理或固定）。但对「宽度固定、不随内容/拖拽变化」的复合节点（ScriptBox 固定 900、
 *    GridMerge/GridSplit 等），若不把 node.width 也写回，ReactFlow wrapper(.react-flow__node)
 *    的宽度会滞后于视觉框 → 连接节点的「conic 跑马灯环绕」（index.css 的 connectingto::before，
 *    用 inset 锚定 .react-flow__node）会出现「高度贴合、宽度不贴合」。
 *    解法：给 useContentHeightSync 传 { syncWidth: true }，写回宽度时用内容元素实际宽度
 *    el.offsetWidth，让 wrapper 贴合视觉框。见 hooks.js 的 syncWidth 参数说明。
 *
 * @param props
 *  - id, label, defaultTitle, icon   标题栏
 *  - selected                         选中态（z-50）
 *  - resizable                        是否可拖拽调尺寸（默认 true）
 *  - minWidth, minHeight              NodeResizer 最小尺寸
 *  - keepAspect                       拖拽时是否保持比例
 *  - aspectRatio                      'Auto'|'16:9'|...（启用比例同步）
 *  - defaultHeight                    aspectRatio=Auto 时的默认高度
 *  - sizeMode                         'width-fixed'（默认，生图）| 'area-fixed'（视频生成）
 *  - baseSize                         area-fixed 的面积基准（默认 380）
 *  - handleVariant                    'large'|'small'
 *  - showHandles                      是否渲染默认左右端口（默认 true；自定义端口节点设 false）
 *  - showTitle                        是否渲染标题栏（默认 true）
 *  - titleRight                       标题右侧操作组（absolute 浮在标题右，不占布局）
 *  - onRename                         (可选) 标题改名 commit 回调，写回节点数据（如 data.label）
 *  - className                        追加到根 div 的 class
 *  - style                            追加到根 div 的 inline style（如 { minHeight: 640 }
 *                                      可让宽节点即使 store n.height 没生效也撑出最小高度）
 *  - wrapperRef                       暴露根 div ref（供右下角手柄拖拽改整体尺寸）
 *  - overlayHandles                   端口/覆盖层，直接挂在「根 div」（含标题栏的整个节点）上，
 *                                      定位基准是整体节点（children 的定位基准只是主框，不含标题栏）。
 *                                      ⚠️ 需要「相对整个节点居中」的端口必须走这个插槽，
 *                                      不要用 createPortal 延迟挂载（见 ScriptBoxNode 注释：
 *                                      延迟挂载的端口进不了 React Flow 的 handleBounds → code-008）
 *  - syncSize                         是否强制同步尺寸（默认 true；编组等特殊节点设 false）
 *  - children                         节点内容（hover栏 + 主显示框 + 展开面板）
 *
 * ════════════════════════════════════════════════════════════════
 * 【新建节点指南 · 权威范本（后续 AI 建节点先读这个）】
 * ════════════════════════════════════════════════════════════════
 *
 * 一句话：外壳用 NodeShell，节点只写「业务专属内容」，绝不手写外壳/端口/背景/尺寸。
 * 参考节点（从简到繁）：TextNode / PromptNode → ImageBoxNode / GridSplitNode → ScriptBoxNode（复合）。
 *
 * ── 0. 标准节点骨架（照抄）──
 *   return (
 *     <NodeShell id label defaultTitle icon selected handleVariant aspectRatio defaultHeight wrapperRef>
 *       <HoverToolbar buttons={toolbarButtons} />                       // hover 胶囊栏（可选）
 *       <input type="file" ref hidden />                               // 上传（可选）
 *       <div className="relative flex flex-col w-full flex-1 min-h-0"> // 主显示框（唯一必须 children）
 *         ...业务内容（用 flex-1 填满，别用 h-full）...
 *         <ResizeFullscreenHandle targetRef={wrapperRef} onResizeEnd={onMainBoxResize} />
 *       </div>
 *       <ExpandablePanel expanded minWidth>...</ExpandablePanel>       // 展开面板（可选）
 *       <FullscreenModal open onClose>...</FullscreenModal>             // 全屏弹层（可选）
 *     </NodeShell>
 *   )
 *
 * ── 1. 外壳与样式（最高频）──
 *   · 外壳全用 NodeShell：尺寸/标题/端口/主容器背景/边框/阴影内置，禁止手写外壳。
 *   · children 里不要再写 bg-surface-raised / rounded-xl / border / shadow——主容器已提供，
 *     重复写会出双重外框、颜色不一致（见 ARCHITECTURE.md §9.3）。背景层不裁 children，只供视觉。
 *   · 样式全用 token（bg-surface-1 / text-body / border-edge / text-caption），token 在
 *     tailwind.config.js。禁止新写裸色值 bg-[#1c1c1c] / text-gray-500 / text-[10px] / z-[9999]。
 *
 * ── 2. 尺寸 / 高度自适应 ──
 *   · 根 div 尺寸 = ReactFlow node.width/height（NodeShell 用 useNodeSize 从 store 订阅，
 *     非 w-full/h-full 跟随父容器），端口基于中点定位。别在节点里另写一套尺寸逻辑。
 *   · 简单节点：内容固定在 NodeShell 尺寸内即可。复合节点（内容撑高超 node.height）：
 *     ResizeObserver 监听 → useNodeResize(id).onMainBoxResize(w,h) 写回 node.height +
 *     updateNodeInternals，否则端口错位。参考 ScriptBoxNode.jsx。
 *   · 文本区用 flex-1（父已是 flex），别用 h-full（百分比在 flex 下解析为 auto → 塌缩）。
 *   · 右下角手柄 ResizeFullscreenHandle + onMainBoxResize（写 node.width/height）；
 *     面板内「部件」只写 node.data.inputWidth/inputHeight（如 PromptInput 的 textarea）。
 *   · 比例 aspectRatio / sizeMode / keepAspect 由 NodeShell 管，别手写 resize。
 *
 * ── 3. 端口 ──
 *   · 默认左右 CustomHandle 已由 NodeShell 渲染。要多端口/指定位置：CustomHandle（handleId/top），
 *     别自创端口样式。不需要端口 → showHandles={false}（如 ImageBoxNode 用自定义 in/active 口）。
 *
 * ── 4. 拖拽 / 交互 ──
 *   · 主显示框用 drag-handle cursor-move（可拖动）；交互控件（按钮/输入/textarea）标 nodrag。
 *     别给整个 children 标 nodrag，否则内容区盖住可拖区域、只剩标题栏能拖。
 *   · onClick 放节点自身 children 内层 div，别依赖 NodeShell 主容器层。
 *   · hover 按钮统一 HoverToolbar + ToolbarButton，别手写胶囊栏（ImageBoxNode 手写是历史遗留，别模仿）。
 *
 * ── 5. 数据状态（通读全部节点后的统一范式，先想清楚）──
 *   统一范式（TextNode/PromptNode/DiscountVideo/GridSplit/GridMerge 全部一致）：
 *   · **useState 存 UI 状态**：所有节点都用 `useState(data.xxx)` 初始化（prompt/text/rows/cols/ratio…）。
 *   · **setNodes 不可变更新写回 data**：改状态时 `setNodes(ns => ns.map(n => n.id===id
 *     ? {...n, data:{...n.data,...patch}} : n))`，非目标节点 : n 原样返回。
 *   · **外部写 data → 同步回本地 state**：用 useEffect 监听 `data.xxx`，变化时 setState 刷新
 *     （GridSplit/GridMerge/DiscountVideo 都这么做）。若外部是 Agent 批量写，用 `useSyncNodeData(data, setters)`。
 *   · 例外（别当通用范式）：ImageBoxNode 直接读 data.images、不复制 state——因为它是「多图容器」，
 *     数据量大且常被连线/剧本盒子读写，直接读 data 避免副本失控。单参数节点照统一范式即可。
 *   · 判断准则（ARCHITECTURE.md §三）：数据会不会被引擎/连线/持久化/复制读写。
 *   · ⚠️ 不要把「手写 setNodes」当范式：可抽 `updateData` 帮助函数（如 ImageBoxNode），
 *     但不要引入新 state 管理库。
 *
 * ── 6. 通用能力走单一入口（见 docs/CODING-STANDARD.md §一，别各写各的）──
 *   · 媒体判断 mediaType.js；URL 归一 imageUrl.js；弹提示 toastStore.showToast；
 *     落盘 filesApi.js；压缩 imageCompress.js；复制/下载 clipboard.js；缩略图 base/LazyImage.jsx。
 *   · 生成流程 useNodeGeneration；模型下拉 ModelSelect；提示词 PromptInput；按钮 GenerateButton。
 *   · 参数记忆 useNodePrefs（记住上次模型/比例/尺寸，跨节点复用）。
 *   · ⚠️ 已知重复（历史遗留，新代码别模仿、逐步收敛）：ImageBoxNode 手写 makeThumb/copyImage/downloadUrl，
 *     应分别用 imageCompress / clipboard.js。
 *
 * ── 7. 注册（4 处同步，漏一处 → 要么建不出 / 要么下游拿不到数据）──
 *   · components/base/NodePalette.ts paletteNodes 加一行 { type, label, icon, cat, data, builtin:true }。
 *   · App.jsx nodeTypes 加一行 type → 组件。
 *   · **base/useConnectedInputs.js 的 NODE_OUTPUTS 加一行**（有产出的节点必须登记，否则下游连线拿不到数据；
 *     数组型产出 extractedImages[] 用 arrayImages 归一）。这是最容易漏的一处。
 *   · 新增 base 能力登记 docs/BASE-CAPABILITIES.md；数据契约写交接文档。
 *
 * ── 8. 验证门禁 ──
 *   · npm run test:smoke + npm run test:regression + npm run build 三道门全绿。
 *
 * 判断准则：差异是「业务内容」→ 放 children（正常）；差异是「外壳/端口/尺寸行为」→ 优先收敛到
 * NodeShell，不在节点里特判。确实需要 NodeShell 不提供的通用能力时，才在节点层扩展并注释原因，
 * 避免下一个 AI 以为写错了。
 * ════════════════════════════════════════════════════════════════
 */
function NodeShell({
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
  baseSize = NODE_AREA_FIXED_BASE_SIZE,
  handleVariant = 'large',
  showHandles = true,
  sourceHandleId,
  showTitle = true,
  titleRight,
  onRename,
  className = '',
  style: extraStyle = {},
  wrapperRef,
  overlayHandles,
  syncSize = true,
  children
}: NodeShellProps) {
  // 比例同步：改比例时同步 wrapper 尺寸。
  // syncSize=false（如编组节点）：不强制同步尺寸，尺寸完全由 ReactFlow 节点 style 决定，
  // 否则 useSizeSync 的 Auto 分支会把高度强制设成 defaultHeight，覆盖 group 实际尺寸。
  const ratio = syncSize ? useSizeSync(id, aspectRatio ?? '', {
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
  // 主容器背景层：加 drag-handle cursor-move，让节点主体（内容区之外的空白/背景）可拖拽移动。
  // 各节点内容区需去掉整块 nodrag，只给真正的交互控件（按钮/输入/textarea）标 nodrag，
  // 否则内容区撑满主容器会把可拖区域盖住（只剩标题栏可拖）。
  const mainShellClassName = `relative w-full flex-1 min-h-0 flex flex-col bg-surface-raised rounded-xl border shadow-xl transition-colors duration-200 drag-handle cursor-move ${selected ? 'border-edge-strong' : 'border-edge hover:border-edge-muted'}`

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
      style={{ width: typeof inlineW === 'number' ? `${inlineW}px` : inlineW, minHeight: typeof inlineH === 'number' ? `${inlineH}px` : inlineH, contain: 'layout style', ...extraStyle }}
    >
      {/* 标题：与所有节点完全一致（NodeTitle mb-1 self-start，宽度只包内容）。
          titleRight 操作组用绝对定位浮在标题右侧，不改变 NodeTitle 的位置/间距 */}
      {showTitle && <NodeTitle label={label} defaultTitle={defaultTitle} icon={icon} onRename={onRename} />}
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

      {/* 主容器背景层：统一背景/圆角/边框/阴影/选中边框（见 mainShellClassName）。
          用局部 ErrorBoundary 包住 children：单个节点渲染崩溃只降级该节点，不影响整个画布。
          onError 上报 logger（生成/渲染异常全链路可查）。 */}
      <div className={mainShellClassName}>
        <ErrorBoundary
          variant="node"
          onError={(error) => logger.error('error', 'node-render', { nodeId: id, error: error?.message || String(error) })}
        >
          {children}
        </ErrorBoundary>

        {/* 端口统一渲染在「主框内部」，相对主框定位 → 圆心精确贴在带圆角边框的节点边缘上。
            之前相对根 div（含标题区、flex items-center）定位，导致图片/视频节点端口偏离主框边缘。
            剧本盒子等复合节点用 showHandles={false} 关闭，改用内部每镜头/每输出口端口 */}
        {showHandles && (
          <>
            <CustomHandle position="left" variant={handleVariant} />
            <CustomHandle position="right" variant={handleVariant} handleId={sourceHandleId} />
          </>
        )}
      </div>

      {/* 覆盖层端口：直接挂在「根 div」（含标题栏的整个节点）上，绝对定位基准 = 整个节点。
          ⚠️ 为什么要有这个插槽：需要「相对整个节点居中」的端口（如剧本盒子左侧 in 口）若放在
          children 里，定位基准是主框（不含标题栏），会偏低半个标题高度；而用 createPortal
          + 状态延迟挂载（首帧后才能拿到 ref）会导致端口不在首次测量中 → 进不了 React Flow
          的 handleBounds → 指向它的边报 code-008 且不渲染。这里渲染即挂载，无时序问题。 */}
      {overlayHandles}
    </div>
  )
}
export default React.memo(NodeShell)
