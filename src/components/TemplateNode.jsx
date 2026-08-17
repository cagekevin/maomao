import React, { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Image as ImageIcon, Plus, ZoomIn, Download } from 'lucide-react'
// ═══ 基座组件（统一入口，禁止手写外壳/端口/背景）═══
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'
import ExpandablePanel from './base/ExpandablePanel.jsx'
import GenerateButton from './base/GenerateButton.jsx'
import ModelSelect from './base/ModelSelect.jsx'
import PromptInput from './base/PromptInput.jsx'
import MaterialStrip from './base/MaterialStrip.jsx'
import ResizeFullscreenHandle from './base/ResizeFullscreenHandle.jsx'
import FullscreenModal from './base/FullscreenModal.jsx'
import GeneratingOverlay from './base/GeneratingOverlay.jsx'
// ═══ 基座 hook（统一范式）═══
import { useNodeResize, useOutsideClick } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeGeneration } from './base/useNodeGeneration.js'
import { useNodePrefs } from './base/nodePrefs.js'
import { useSyncNodeData } from './base/useSyncNodeData.js'
import { showToast } from './base/toastStore.js'
import { generateImage } from './base/imageApi.js'
import { toAbsoluteFileUrl } from './base/filesApi.js'
import { useProviders, load as loadProviders } from './base/settings/providerStore.js'
import { buildAllModels } from './base/providerModels.js'

/**
 * ════════════════════════════════════════════════════════════════
 * 【节点模板】TemplateNode —— 新建节点的唯一权威蓝本
 * ════════════════════════════════════════════════════════════════
 *
 * 【怎么用】
 * 1. 复制本文件为 `src/components/XxxNode.jsx`，把函数名、type 占位符全换成你的。
 * 2. 按「业务专属内容」改主显示框 children 和展开面板；不需要的能力直接删对应块。
 * 3. 4 处注册（漏一处必出问题，详见文件底部【注册】）：
 *    - NodePalette.jsx paletteNodes 加一行
 *    - App.jsx nodeTypes 加 `xxxNode -> XxxNode`
 *    - useConnectedInputs.js NODE_OUTPUTS 加一行（有产出必须，否则下游拿不到数据）
 *    - docs/BASE-CAPABILITIES.md 登记
 * 4. 跑 `npm run test:smoke` + `npm run build`。
 *
 * 【本模板已包含的通用能力（对照 NODE-DESIGN-SPEC.md）】
 *  - 外壳：NodeShell（标题/端口/背景/边框/阴影/尺寸/右键全内置）✓
 *  - 顶部 hover 操作栏：HoverToolbar + ToolbarButton 式按钮 ✓
 *  - 底部展开面板：ExpandablePanel ✓
 *  - 提示词输入：PromptInput（含 @素材弹层）✓
 *  - 素材缩略图条：MaterialStrip（真实上游连线）✓
 *  - 生成按钮：GenerateButton（含 loading/停止）✓
 *  - 模型下拉：ModelSelect（多 provider 聚合）✓
 *  - 右下角手柄：ResizeFullscreenHandle（拖拽改尺寸+双击全屏）✓
 *  - 数据范式：useState 存 UI + setNodes 写回 data + useSyncNodeData 外部同步
 *    + useNodePrefs 参数记忆 + useNodeResize 尺寸写回 ✓
 *  - 性能降级：useMediaDegrade ✓
 *  - 生成契约：useNodeGeneration（提交/进度/成功写回/失败/重试）✓
 *
 * 【上/下游数据怎么接（对应"接节点"的通用机制）】
 *  - 读上游：`useConnectedInputs(id)` 已在模板接入 → 自动聚合所有直接上游产出
 *    { images, texts, videos, audios }，本节点作为参考输入用（已接 MaterialStrip + PromptInput）。
 *  - 产出给下游：① 组件里把结果写回 node.data（如 data.imageUrl / data.images[]）；
 *    ② 在 `useConnectedInputs.js` 的 `NODE_OUTPUTS` 加一行声明如何解析你的产出
 *    （单产出其实可省略——有 `genericOutput` 兜底读 imageUrl/videoUrl/resultUrl；
 *    但**数组型产出（images[]/extractedImages[]）必须声明**，否则下游拿不到）。
 *    见文件底部【上/下游数据 + 产出声明】。
 *
 * ════════════════════════════════════════════════════════════════
 * 【特殊能力索引 · 想抄哪个能力去哪个节点找】
 * ════════════════════════════════════════════════════════════════
 * 模板只给「通用最小闭环」。以下特殊能力**不内置**（避免模板变臃肿），
 * 需要时按表去对应节点复制对应代码块，改到你的节点里即可：
 *
 * ┌─ 能力 ────────────────────┬─ 抄哪 ────────────────┬─ 备注 ───────────────────────┐
 * │ 多内容类型(图/视频/音频/文)  │ ImageNode           │ detectMediaType + data.mediaType│
 * │ 全屏编辑器(裁剪/涂鸦/压缩)   │ ImageNode           │ ImageEditor + FullscreenModal    │
 * │ 视频首帧封面               │ ImageNode/TextNode   │ base/useVideoPoster             │
 * │ 宽高比自适应               │ ImageNode            │ base/useFitNodeRatio            │
 * │ 双击编辑 + AI生成 + 全屏编辑 │ TextNode            │ editingText + useNodeGeneration  │
 * │ 画质/比例/渲染质量菜单       │ PromptNode           │ trigger + absolute bottom-full  │
 * │ 批量张数 xN                │ PromptNode           │ count 下拉 + 循环生成            │
 * │ 多图容器(图片盒子)          │ ImageBoxNode         │ data.images 直读 + 多选/全选     │
 * │ 自定义多端口               │ ImageBox/GridSplit    │ showHandles=false + CustomHandle │
 * │ 批量 spawn 下游多图         │ GridSplitNode        │ addNodes 网格排列 + addEdges     │
 * │ spawn 视频/音频/GIF 下游    │ VideoProcessNode      │ addNodes + mediaType 显式标注   │
 * │ 高度自适应(ResizeObserver)  │ ScriptBoxNode         │ contentRef + onMainBoxResize    │
 * │ 折叠/展开 编组              │ GroupNode            │ parentId 子节点 + 聚合出口       │
 * │ 拆分多段→spawn 多个生图节点  │ LoopNode             │ 文案切段 + 每段 addNodes         │
 * │ 全屏 3D/球体漫游 portal     │ Panorama/Director3D   │ createPortal + z-modal          │
 * │ 人脸打码全屏编辑器          │ FaceMosaicNode        │ FaceMosaicEditor + FullscreenModal│
 * │ area-fixed 面积固定尺寸     │ DiscountVideoNode     │ NodeShell sizeMode='area-fixed'  │
 * │ 原生 select 表单控件        │ GridMergeNode         │ §二 原生 select 形态            │
 * └───────────────────────────┴──────────────────────┴────────────────────────────────┘
 *
 * 【本模板「不内置」的两种常见业务形态（避免模板变臃肿）】
 *  - 多图容器/接图片盒子/视频盒子：数据量大、被连线频繁读写 → 参考 ImageBoxNode，
 *    主显示区换成多图网格 + data.images 直读（不复制 state），产出用数组型声明。
 *  - 批量生成/拆分多段（像循环节点）：一个节点 spawn 多个下游节点 → 参考 LoopNode/GridSplit，
 *    在业务里用 addNodes + addEdges 扩展（见文件底部【批量生成】）。
 *
 * 【样式铁律（对照 NODE-DESIGN-SPEC.md）】
 *  - 只在 children 写业务内容，禁止手写 bg-surface-raised/rounded-xl/border/shadow（NodeShell 已提供）
 *  - 样式全用 token：bg-surface-1 / text-body / border-edge / text-caption / z-dropdown 等
 *  - 禁止：裸色值 bg-[#1c1c1c] / 裸字号 text-[10px]/text-xs/text-sm / 裸 z-index z-[9999]
 *  - 禁止：shadow-lg / shadow-2xl（浮层一律 shadow-popover）
 *  - 按钮 hover 统一 hover:bg-surface-hover + hover:text-white
 */

export default function TemplateNode({ id, data, selected }) {
  // ─── 1. 上游数据 + 性能降级（通用）───
  // useConnectedInputs：读取直接上游节点的产出（图片/文本）作为参考输入；空则渲染空态
  const connected = useConnectedInputs(id)
  // useMediaDegrade：lodLevel>=2 时隐藏生成结果（大画布性能降级）
  const { isHidden } = useMediaDegrade()
  const hideResult = isHidden('image')

  // 上游合并：图片 + 文本（多个上游节点自动聚合；data.images/texts 额外资产也并入）
  const refImages = [...(connected.images || []), ...(data.images?.length ? data.images : [])]
  const refTexts = [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])]
  // 注意：effectivePrompt 依赖下方声明的 prompt state，故计算延后到 prompt 初始化之后

  // ─── 2. ReactFlow 数据写回（统一范式）───
  const { setNodes, setEdges } = useReactFlow()

  // patchData：改 node.data 的唯一入口（不可变局部更新；Agent read_canvas 能读到最新）
  const patchData = useCallback((patch) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [id, setNodes])

  // ─── 3. 业务 state（用 useState 存 UI；改后 setState + patchData 双写）───
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '')
  // 全屏编辑：提示词输入框双击 → 全屏编辑提示词（复刻 TextNode）
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)
  // 全屏查看：主框双击 → 全屏查看生成结果（替代原 showToast('全屏') 占位）
  const [fullscreenResult, setFullscreenResult] = useState(false)

  // 参数记忆：记住上次选的模型/比例，新建节点默认沿用（跨节点/跨会话）
  // 【模板】type 换成你的节点 type（如 'textNode'），默认值按需改
  const { prefs: myPrefs, set: setMyPrefs } = useNodePrefs('templateNode', { model: '', aspectRatio: '1:1' })
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || myPrefs.aspectRatio || '1:1')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || myPrefs.model || '')
  // 有效提示词 = 本地 prompt + 上游文本（多文本节点合并），两者都参与生成；延后到 prompt 初始化后避免 TDZ
  const upstreamText = refTexts.map((t) => (t.text || '').trim()).filter(Boolean).join('\n')
  const effectivePrompt = [prompt?.trim(), upstreamText].filter(Boolean).join('\n') || ''

  // 外部同步：Agent update_node 改 data 时，把变更同步回本地 state（否则 UI 不跟变）
  // 【模板】把所有「由 data 初始化的 state」都列进来
  useSyncNodeData(data, { prompt: setPrompt, aspectRatio: setAspectRatio, selectedModel: setSelectedModel })

  // 提示词落盘：本地 state + 写回 node.data（支持函数式更新；刷新不丢）
  const setPromptPersist = useCallback((v) => {
    setPrompt((prev) => (typeof v === 'function' ? v(prev) : v))
  }, [])

  // 抽屉展开/收起
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])
  // 【React 反模式修复】「写回 node.data」不在 setState updater 里做（渲染期间 setNodes → BatchProvider 警告），
  // 改用 useEffect 同步落盘。
  React.useEffect(() => { patchData({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 4. refs + 尺寸写回（通用）───
  const wrapperRef = useRef(null)      // NodeShell 根 div（供主框手柄拖拽）
  const promptInputRef = useRef(null)  // 提示词 textarea（供面板手柄拖拽）
  const fileRef = useRef(null)         // 隐藏 file input
  const { onMainBoxResize, onInputResize } = useNodeResize(id)  // 主框/输入框尺寸写回 ReactFlow

  // 断连线：点击素材缩略图红色 ×，删除该素材来源节点 → 本节点的连线（通用）
  const disconnectSource = useCallback(
    (sourceNodeId) => {
      if (!sourceNodeId) return
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)))
    },
    [id, setEdges]
  )

  // ─── 5. 模型下拉（多 provider 聚合，通用）───
  const { providers } = useProviders()
  const models = buildAllModels(providers, 'image')
  React.useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 6. 生成契约（通用；无生成能力的节点删掉本块 + GenerateButton）───
  // useNodeGeneration：统一「提交任务 → 进度 → 成功双写(taskStore + node.data) / 失败 / 手动重试」。
  // 【错误/重试规范，见 docs/09】错误已由契约按 type 分类并映射文案（genErrors.js）：
  //   - 网络/超时层由 API 层 withRetry 自动重试；上游失败不自动重试，交给「再来一次」。
  //   - 本节点禁止自写 if (/网络错误/.test(msg)) 等判断，只读 gen.error 展示即可。
  //   - 若要刷新后恢复结果（节点消失重建），可传 onRecover: (d) => { setImageUrl(d.resultUrl); patchData({ imageUrl: d.resultUrl }) }。
  const gen = useNodeGeneration({
    nodeId: id,
    type: { type: 'image', prompt: effectivePrompt, modelName: selectedModel },  // 任务上报信息
    // 前置校验：本地 prompt 或上游文本任一非空即可生图
    validate: () => (effectivePrompt?.trim() ? '' : '请输入提示词'),
    run: async ({ progress }) => generateImage({                  // 真执行器（换成你的 API）
      model: selectedModel,
      prompt: effectivePrompt,
      refImages,
      aspectRatio,
    }, progress),
    onSuccess: (r) => {                                          // 成功回写 node.data（落盘已由契约内部完成）
      setImageUrl(r.url)
      patchData({ imageUrl: r.url })
      setMyPrefs({ model: selectedModel, aspectRatio })
    },
  })

  // ─── 7. hover 工具栏按钮（通用；可选）───
  // 【模板】换成你的按钮：{ key, icon, title, show, onClick }
  const toolbarButtons = [
    { key: 'upload', icon: <Plus size={12} />, title: '上传', onClick: () => fileRef.current?.click() },
    { key: 'zoom', icon: <ZoomIn size={12} />, title: '放大', show: !!imageUrl, onClick: () => showToast('放大预览') },
    { key: 'download', icon: <Download size={12} />, title: '下载', show: !!imageUrl, onClick: () => showToast('下载') },
  ]

  // ─── 8. 渲染（外壳 + hover 栏 + 主显示框 + 展开面板）───
  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="模板节点"               // 【模板】改成你的节点名
      icon={<ImageIcon size={11} className="text-gray-500" />}  // 【模板】换成你的图标
      selected={selected}
      handleVariant="small"                 // 'large'(48) / 'small'(32)
      aspectRatio={aspectRatio}
      defaultHeight={280}
      wrapperRef={wrapperRef}
      // 【模板】需要 titleRight（右上角操作）就传。按钮统一用 §〇.3 分段按钮基底（照 GridSplit）：
      // titleRight={
      //   <div className="flex items-center gap-1 nodrag">
      //     <button className={`px-2 py-0.5 rounded text-caption flex items-center gap-1 border transition-colors cursor-pointer ${active ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white'}`}>...</button>
      //   </div>
      // }
      // 【模板】不需要默认左右端口 / 自定义多端口时设 showHandles={false}：
      // showHandles={false}
    >
      {/* 顶部 hover 操作栏（通用；不需要删掉） */}
      <HoverToolbar buttons={toolbarButtons} />

      {/* 隐藏文件输入（通用；不需要上传删掉） */}
      <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={() => showToast('上传处理')} />

      {/* 主显示框（唯一必须 children；用 flex-1 填满，别用 h-full） */}
      <div className="relative flex flex-col w-full flex-1 min-h-0" onClick={toggleExpanded}>
        {hideResult ? (
          // 性能降级：大画布隐藏结果（通用）
          <div className="flex-1 flex items-center justify-center text-caption text-gray-500">图片已隐藏</div>
        ) : imageUrl ? (
          <div className="flex-1 relative overflow-hidden rounded-lg">
            <img src={toAbsoluteFileUrl(imageUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
            {gen.error && (
              <div className="absolute inset-x-0 bottom-0 p-2 bg-red-500/80 text-white text-caption"><span className="break-all">{gen.error}</span></div>
            )}
          </div>
        ) : (
          // 空态占位（用 token，别写死示例图）
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface-muted rounded-lg">
            <ImageIcon size={48} className="text-gray-700" strokeWidth={1.2} />
            <span className="text-caption text-gray-500">双击展开参数，点生成</span>
          </div>
        )}

        {/* 右下角手柄：拖拽改主框尺寸 + 双击全屏查看结果（通用） */}
        <ResizeFullscreenHandle
          targetRef={wrapperRef}
          minWidth={320}
          minHeight={200}
          onRequestFullscreen={() => setFullscreenResult(true)}
          onResizeEnd={onMainBoxResize}
        />
      </div>

      {/* 底部展开面板（通用；参数区 + 生成按钮） */}
      <ExpandablePanel expanded={expanded} minWidth={420}>
        <div className="space-y-3">
          {/* 素材缩略图区（通用 MaterialStrip，真实上游连线；空则不渲染） */}
          <MaterialStrip
            images={connected.images}
            texts={connected.texts}
            onInsert={(name) => setPromptPersist((p) => (p ? `${p} @${name} ` : `@${name} `))}
            onDisconnect={disconnectSource}
          />

          {/* 提示词输入（通用 PromptInput，含 @素材弹层） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPromptPersist}
            placeholder="描述内容，输入 @ 引用素材..."
            refImages={connected.images}
            refTexts={connected.texts}
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部控制条（通用：参数 + 模型 + 生成按钮） */}
          <div className="flex items-center justify-between pt-2 border-t border-edge-faint nodrag">
            <div className="flex items-center gap-1.5 overflow-visible z-dropdown">
              {/* 【模板】参数快捷入口（比例/尺寸下拉等），照 PromptNode 画质菜单形态 */}
              {/* 模型下拉（通用 ModelSelect） */}
              <ModelSelect
                value={selectedModel}
                onChange={(m) => { setSelectedModel(m); setMyPrefs({ model: m }) }}
                models={models}
              />
            </div>

            {/* 生成 / 停止（通用 GenerateButton） */}
            <GenerateButton
              loading={gen.loading}
              onGenerate={gen.start}
              onStop={gen.stop}
            />
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸 + 双击全屏编辑提示词（通用；PromptInput 的 textarea 做 targetRef） */}
        <ResizeFullscreenHandle
          targetRef={promptInputRef}
          minWidth={360}
          minHeight={80}
          onRequestFullscreen={() => setFullscreenPrompt(true)}
          onResizeEnd={onInputResize}
        />
      </ExpandablePanel>

      {/* 全屏弹层：提示词输入框双击 → 全屏编辑提示词（复刻 TextNode） */}
      <FullscreenModal open={fullscreenPrompt} title="编辑提示词 - 模板" onClose={() => setFullscreenPrompt(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-canvas text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="描述内容，输入 @ 引用素材..."
          value={prompt}
          onChange={(e) => setPromptPersist(e.target.value)}
        />
      </FullscreenModal>

      {/* 全屏弹层：主框双击 → 查看生成结果（替代原 showToast 占位） */}
      <FullscreenModal
        open={fullscreenResult}
        title="查看生成结果"
        onClose={() => setFullscreenResult(false)}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="生成结果"
            className="max-w-full max-h-full object-contain rounded"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            暂无生成结果
          </div>
        )}
      </FullscreenModal>

      {/* 生成中遮罩（通用；可选） */}
      {gen.loading && <GeneratingOverlay label="生成中…" />}
    </NodeShell>
  )
}

/**
 * ════════════════════════════════════════════════════════════════
 * 【上/下游数据 + 产出声明】（复制模板后必看）
 * ════════════════════════════════════════════════════════════════
 *
 * 一、读上游（已接入，无需改）
 *   `useConnectedInputs(id)` 会自动聚合所有「直接连线到自己」的上游节点产出，
 *   返回 { images:[{url,label,sourceNodeId}], texts:[], videos:[], audios:[] }。
 *   模板里已把 connected.images/texts 接给 MaterialStrip + PromptInput 作参考输入。
 *
 * 二、产出给下游（有产出必做，否则下游连了线也拿不到数据）
 *   1) 组件里把结果写回 node.data（模板已在 onSuccess 写 data.imageUrl）。
 *   2) 到 `src/components/base/useConnectedInputs.js` 的 `NODE_OUTPUTS` 加一行声明。
 *      · 单图/单视频/单文本：通常可省略（有 genericOutput 兜底读 data.imageUrl/videoUrl/resultUrl）。
 *      · 数组型产出（data.images[] / data.extractedImages[]）必须声明，示范：
 *
 *      // 在 NODE_OUTPUTS 里加：
 *      xxxNode: (d) => ({ images: arrayImages(d.extractedImages, 'xxx', (i) => `输出 ${i + 1}`) }),
 *      // arrayImages 是 useConnectedInputs.js 里现成的数组归一函数，直接 import/引用。
 *
 * 三、多图容器（要当"图片盒子/视频盒子"那种多图节点时）
 *   - 数据量大、被连线/剧本盒子频繁读写 → 参考 ImageBoxNode：直接读 data.images、不复制 state。
 *   - 主显示区换成多图网格 + 空态，产出声明用上面的数组型写法。见文件底部【多图容器骨架】。
 *
 * 四、批量生成 / 拆分成多个（像循环节点：一个节点 spawn 多个下游生图节点时）
 *   - 用 `useReactFlow()` 的 addNodes / addEdges，参考 LoopNode.jsx 的 handleGenerate：
 *     遍历 N 段 → 每段 addNodes 建一个下游节点（填好 data）→ addEdges 自动连线。
 *   - 这是业务逻辑，不属于通用外壳，所以模板不内置，按需在业务里扩展。见文件底部【批量生成骨架】。
 */

/**
 * ════════════════════════════════════════════════════════════════
 * 【批量生成骨架】一个节点 spawn 多个下游节点（参考 LoopNode / GridSplitNode）
 * ════════════════════════════════════════════════════════════════
 * 场景：把上游文案切 N 段，每段建一个下游生图节点并自动连线。
 * 在节点里用 useReactFlow() 拿 addNodes / addEdges：
 *
 *   // 在组件顶部：const { addNodes, addEdges, getNodes } = useReactFlow()
 *   const spawnMultiple = () => {
 *     const items = ['段1', '段2', '段3']            // 你的 N 份产出
 *     const me = getNodes().find((n) => n.id === id)
 *     const baseX = (me?.position.x ?? 300) + (me?.measured?.width ?? 300) + 80
 *     const baseY = me?.position.y ?? 200
 *     const ts = Date.now()
 *     const newNodes = items.map((item, i) => ({
 *       id: `out-${id}-${i}-${ts}-${Math.random().toString(36).slice(2, 6)}`,
 *       type: 'promptNode',                          // 下游节点类型（或 imageNode）
 *       position: { x: baseX, y: baseY + i * 750 },  // 纵向排列，避免重叠
 *       data: { prompt: item },                      // 填好下游的 data
 *       width: 420, height: 420,
 *     }))
 *     const newEdges = newNodes.map((nn) => ({ id: `e-${id}-${nn.id}`, source: id, target: nn.id }))
 *     addNodes(newNodes)
 *     addEdges(newEdges)
 *   }
 *
 *   · 数组型产出要在 useConnectedInputs.js 的 NODE_OUTPUTS 登记（见【上/下游数据】）。
 *   · spawn 视频/音频：参考 VideoProcessNode.spawnVideoNode/spawnAudioNode，
 *     下游用 type:'imageNode' + data.mediaType:'video'/'audio'（blob URL 无扩展名，靠显式类型）。
 */

/**
 * ════════════════════════════════════════════════════════════════
 * 【多图容器骨架】当"图片盒子/视频盒子"（参考 ImageBoxNode）
 * ════════════════════════════════════════════════════════════════
 * 多图容器数据量大、被连线/剧本盒子频繁读写 → **直接读 data.images，不复制 state**：
 *
 *   const images = data.images || []                  // 直读，勿 useState 复制
 *   // 增删改都走 patchData({ images: next }) 写回 node.data
 *   // 主显示区换成多图网格：grid + 每格一张 <img> + hover 操作
 *   // 空态：拖拽/粘贴/点击添加（参考 ImageBoxNode 空态）
 *   // 产出声明：useConnectedInputs.js NODE_OUTPUTS 里
 *   //   imageBoxNode: (d) => ({ images: (d.images||[]).map(im => ({id,url,label})).filter(x=>x.url) })
 */

/**
 * ════════════════════════════════════════════════════════════════
 * 【高度自适应骨架】内容撑高超过 node.height 时（参考 ScriptBoxNode）
 * ════════════════════════════════════════════════════════════════
 * 简单节点（内容固定）无需。内容会撑高时用 ResizeObserver 写回 node.height：
 *
 *   const contentRef = useRef(null)
 *   const { getNodes } = useReactFlow()
 *   const { onMainBoxResize } = useNodeResize(id)
 *   useEffect(() => {
 *     const el = contentRef.current
 *     if (!el) return
 *     const ro = new ResizeObserver(() => {
 *       const h = el.offsetHeight
 *       if (!h) return
 *       const n = getNodes().find((x) => x.id === id)
 *       const curH = n?.height ?? n?.style?.height ?? 0
 *       if (Math.abs(h - curH) < 4) return          // 阈值防抖，避免循环触发
 *       const curW = n?.width ?? n?.style?.width ?? 0
 *       onMainBoxResize(Math.round(curW), Math.max(600, Math.round(h)))
 *     })
 *     ro.observe(el)
 *     return () => ro.disconnect()
 *   }, [id, getNodes, onMainBoxResize])
 *   // 主容器加 ref={contentRef}；去掉固定 height（只留 minHeight），否则内容溢出到框外。
 */
