import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  FileText, Plus, Copy, ChevronDown, ChevronUp, Loader2,
  AlertCircle, Link as LinkIcon
} from 'lucide-react'
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
import PromptLibraryButton from './base/PromptLibraryButton.jsx'
import { useNodeResize } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useNodeGeneration } from './base/useNodeGeneration.js'
import { saveTextToTasks, toAbsoluteFileUrl } from './base/filesApi.js'
import { useProviders, load as loadProviders } from './base/settings/providerStore.js'
import { chatCompletions } from './base/chatApi.js'
import { useNodePrefs } from './base/nodePrefs.js'
import { buildAllModels, resolveProviderModel } from './base/providerModels.js'

/**
 * 文本节点（复刻原 Co.jsx / textNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + ModelSelect + GenerateButton + PromptInput。
 * 保留差异化：文本编辑区（双击编辑）、自动拆分、预设菜单。
 */
export default function TextNode({ id, data, selected }) {
  // 通用连线数据传递：读取直接上游节点的文本/图片作为参考输入
  const connected = useConnectedInputs(id)
  const { setEdges, getNodes, setNodes } = useReactFlow()
  // 断开连线：素材缩略图红色 × → 删除该来源节点 → 本节点的连线（仅对有 sourceNodeId 的素材）
  const disconnectSource = useCallback(
    (sourceNodeId) => {
      if (!sourceNodeId) return
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)))
    },
    [id, setEdges]
  )
  const [prompt, setPrompt] = useState(data.prompt || '')
  const [text, setText] = useState(data.text || '')
  const [autoSplit, setAutoSplit] = useState(data.autoSplit || false)

  // ── 输入落盘：本地 state + 同步写回 node.data（不可变更新）──
  // 复用画布快照 KV（App.jsx 600ms 防抖 autoSave 只存 node.data，不存组件 useState）
  // → 手动输入的文字随画布快照落盘，刷新/切换项目不丢。
  // 只 re-render 本节点（setState 本来就会），无「全画布刷新」；自动保存已有 600ms 防抖，无需额外防抖。
  const patchData = useCallback(
    (patch) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [id, setNodes]
  )
  const setPromptPersist = useCallback(
    (v) => {
      setPrompt((prev) => (typeof v === 'function' ? v(prev) : v))
    },
    []
  )
  const setTextPersist = useCallback(
    (v) => {
      setText((prev) => (typeof v === 'function' ? v(prev) : v))
    },
    []
  )
  const setAutoSplitPersist = useCallback((v) => { setAutoSplit(v) }, [])
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  // 抽屉展开/收起
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])
  // 【React 反模式修复】「写回 node.data」不再在 setState updater 里做（那会在渲染期间 setNodes → BatchProvider 警告）。
  // 改为监听本地 state 变化，用 useEffect 同步落盘（effect 内 setState 合法，不在渲染期）。
  useEffect(() => { patchData({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { patchData({ text }) }, [text]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { patchData({ autoSplit }) }, [autoSplit]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps
  const [editingText, setEditingText] = useState(false)
  // 记住上次选择的模型（跨节点/跨会话）；初始用记忆值，无记忆回退 gpt-4o-mini
  const { prefs: textPrefs, set: setTextPrefs } = useNodePrefs('textNode', { model: '' })
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || textPrefs.model || 'gpt-4o-mini')
  const [images, setImages] = useState(data.images || [])
  const textAreaRef = useRef(null)
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  const wrapperRef = useRef(null) // NodeShell 根 div ref（主框手柄拖拽改整体尺寸）
  // 全屏编辑状态（复刻 Co.jsx:33,35 的 m/y → 主框/输入框全屏）
  const [fullscreenText, setFullscreenText] = useState(false)
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)

  // 尺寸写回（基座 useNodeResize）：
  //  - onMainBoxResize：主框手柄 → node.width/height + updateNodeInternals（wrapper 跟随，端口不错位）
  //  - onInputResize：输入框手柄 → node.data.inputWidth/inputHeight（复刻官方）
  const { onMainBoxResize, onInputResize } = useNodeResize(id)

  // 供应商配置（多 provider）：模型下拉聚合【所有 provider】的 chat_models（节点式选模型），
  // 生成时按选中的 model 解析回对应 provider，经 /api/proxy 转发。
  const { providers } = useProviders()
  const primary = providers?.find((p) => p.isPrimary) || providers?.[0] || null
  const models = buildAllModels(providers, 'chat')

  // 挂载时确保供应商已加载（若未打开设置页，providers 为空 → 拉取主供应商；load 幂等）
  React.useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // providers 加载后：若「未记忆模型」且节点没显式指定模型 → 默认用第一个 chat_model 的 key 并记忆
  const defaultFromProvider = models[0]?.id
  React.useEffect(() => {
    if (!defaultFromProvider) return
    if (textPrefs.model) return // 已有记忆，不覆盖
    if (data.selectedModel) return // 节点显式指定，不覆盖
    setSelectedModel(defaultFromProvider)
    setTextPrefs({ model: defaultFromProvider })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFromProvider])

  // 统一生成契约（useNodeGeneration）：收敛「reportGenerate + 进度 + 成功双写 + 失败 + retry注册」。
  // 真实文本生成：经 localTool /api/proxy → 选中的 provider /v1/chat/completions（节点式：可跨 provider 选模型）。
  // Agent 的 generate_node 也走这里。
  const { loading, error, stop: onStop, start: handleGenerate } = useNodeGeneration({
    nodeId: id,
    type: { type: 'text', prompt: prompt || text || '', modelName: selectedModel },
    validate: () => ((prompt || text)?.trim() ? '' : '请输入提示词或文本'),
    run: async ({ progress, signal }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      // 参考图：把连线上游/上传的图传给 AI（让 AI 看图反推提示词/理解图片）。
      // chatApi 会转成 image_url 内容块（blob 自动转 data base64）。
      const refUrls = refImages.map((img) => img.url)
      // 文本为非流式请求：上报「连接本地服务」→「上游生成中」两个阶段
      progress?.(10, '正在连接本地服务…')
      // 对齐官方 H_.jsx Lr（6141-6152）：只有勾选「自动拆分」才把 system 换成
      // 「智能内容拆分助手」要求返回严格 JSON {items:[{title,content}]}；
      // 未勾选时 system 是普通助手（不加任何 JSON 指令）。
      const sysContent = autoSplit
        ? `你是一个智能内容拆分助手。请先仔细观察用户提供的图片内容，然后基于图片内容进行拆分。你必须将内容拆分成多个独立的部分，并返回一个严格的JSON对象，包含一个 items 数组，数组中的每个对象包含 title 和 content 两个字段。请直接返回纯JSON字符串，不要包含任何额外的解释文字或Markdown代码块。`
        : 'You are a helpful assistant.'
      const r = await chatCompletions({
        provider: useProvider,
        messages: [
          { role: 'system', content: sysContent },
          { role: 'user', content: prompt || text || '' }
        ],
        model: modelId,
        images: refUrls,
        signal // 支持真取消（Step C）
      })
      progress?.(30, '上游生成中…')
      if (!r.ok) return { ok: false, error: r.error || '生成失败' }
      return { ok: true, content: r.content }
    },
    onSuccess: (r) => {
      // 勾选「自动拆分」：解析 AI 返回的严格 JSON {items:[{title,content}]}，每个 item 生成一个文本节点
      // 并自动连线（对齐官方 H_.jsx Lr 6326-6380：strip ```json → JSON.parse → items → 新建 textNode 网格 + 连线）。
      // 解析失败则降级为普通文本（不阻断）。
      if (autoSplit && typeof r.content === 'string') {
        let items = []
        try {
          const clean = r.content.replace(/```json/g, '').replace(/```/g, '').trim()
          const parsed = JSON.parse(clean)
          items = parsed.items || parsed
        } catch (e) {
          console.warn('[TextNode] 自动拆分 JSON 解析失败，降级为普通文本:', e)
          items = []
        }
        if (Array.isArray(items) && items.length > 0) {
          const me = getNodes().find((n) => n.id === id)
          const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 420) + 60
          const baseY = me?.position.y ?? 100
          const newNodes = items.map((it, n) => ({
            id: `text-split-${id}-${n}-${Date.now()}`,
            type: 'textNode',
            position: { x: baseX, y: baseY + n * 250 },
            data: { text: typeof it === 'string' ? it : it.content, label: typeof it === 'string' ? `Text ${n + 1}` : it.title, expanded: false },
          }))
          const newEdges = newNodes.map((nn) => ({ id: `e-${id}-${nn.id}`, source: id, target: nn.id, sourceHandle: 'main-output' }))
          setNodes((ns) => ns.concat(newNodes))
          setEdges((es) => es.concat(newEdges))
          return
        }
      }
      setTextPersist(r.content)
      // 文本结果落盘成 txt → 生成面板「文本」tab 收录（异步，失败不影响节点显示）
      if (typeof r.content === 'string' && r.content.trim()) {
        saveTextToTasks(r.content, 'text').catch(() => {})
      }
    },
  })

  const uploadImage = (e) => {
    const f = e.target.files?.[0]
    if (f) setImages((prev) => [...prev, URL.createObjectURL(f)])
    e.target.value = ''
  }

  const loadingIcon = <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'rgb(210,2,7)' }} />
  const refImages = [...(connected.images || []), ...images.map((u, i) => ({ id: `img-${i}`, url: u, label: `图片${i + 1}` }))]
  const refTexts = connected.texts || []

  const toolbarButtons = [
    ...(images.length === 0
      ? [{ key: 'upload', icon: <Plus size={12} />, title: '上传图片', onClick: () => fileRef.current?.click() }]
      : []),
    { key: 'copy', icon: <Copy size={12} />, title: '复制文本', onClick: () => navigator.clipboard?.writeText(text) },
    { key: 'toggle', icon: expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />, title: expanded ? '收起输入' : '展开输入', onClick: toggleExpanded }
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="文本生成"
      icon={<FileText size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      defaultHeight={320}
      wrapperRef={wrapperRef}
    >
      {/* hover 操作栏 */}
      <HoverToolbar buttons={toolbarButtons} loading={loading} loadingIcon={loadingIcon} />

      {/* 隐藏文件上传（复刻 Co.jsx:250） */}
      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={uploadImage} />

      {/* 主容器：flex-1 填满 wrapper（wrapper 高度由 useSizeSync defaultHeight=420 同步），
          与生图/特惠视频节点一致，避免 wrapper≠主框导致端口/面板位置错位。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
      <div
        className="relative flex flex-col w-full flex-1 min-h-0"
        onClick={(e) => {
          // 点击节点主体切换抽屉（新建默认收起、初始默认展开，都可点开/收起）。
          // 排除按钮/输入框避免误触；textarea 非编辑时只读（readOnly），单击可切换抽屉，
          // 编辑靠双击触发（onDoubleClick 进 editingText），互不冲突。
          if (!editingText && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) {
            toggleExpanded()
          }
        }}
      >
        {/* 文本内容区 */}
        {/* 【高度根因修复（抉择）】textarea 曾用 h-full（height:100%），但父容器是 flex-1
            （flex 计算高度，非显式 height），百分比高度解析为 auto → textarea 塌缩成默认行高
            （约 46px），多行文本只显示第一句。官方节点用固定 height 故 h-full 有效；原型 NodeShell
            用 minHeight，故改用 flex 撑满：父容器已是 flex，textarea 用 flex-1 替代 h-full，
            由 flex 分配高度 → 完整显示多行，超出内容靠 textarea 自身 overflow:auto 滚动查看。 */}
        <div
          className={`flex flex-col flex-1 min-h-0 p-3 overflow-hidden bg-surface relative rounded-xl ${editingText ? 'nopan nowheel nodrag' : 'drag-handle cursor-move'}`}
          onWheel={(e) => e.stopPropagation()}
          onDoubleClick={() => {
            if (!editingText) {
              setEditingText(true)
              setTimeout(() => textAreaRef.current?.focus(), 0)
            }
          }}
        >
          {loading && (
            <GeneratingOverlay label="生成中..." category="text" />
          )}
          {error ? (
            <div className="text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          ) : (
            <>
              {!text && !loading && !editingText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <FileText size={72} className="text-gray-700" strokeWidth={1.2} />
                  <span className="text-xs text-gray-600">双击编辑内容或AI生成</span>
                </div>
              )}
              <textarea
                ref={textAreaRef}
                className={`w-full flex-1 min-h-0 bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel resize-none ${editingText ? 'nodrag nopan' : ''}`}
                style={{ fontSize: '14px', color: '#a1a1aa' }}
                placeholder=""
                value={text}
                readOnly={!editingText}
                onChange={(e) => setTextPersist(e.target.value)}
                onBlur={() => setEditingText(false)}
                onWheel={(e) => e.stopPropagation()}
              />
            </>
          )}
        </div>

        {/* 右下角手柄：双击全屏编辑文本内容（复刻 Co.jsx:314 _Component23）。
            targetRef=NodeShell 根 div（wrapper），拖拽改其 DOM 实时预览，
            onResizeEnd 写回 ReactFlow node.width/height + updateNodeInternals，
            让 ReactFlow wrapper 跟随 → 端口基于 wrapper 中点不错位 */}
        <ResizeFullscreenHandle
          targetRef={wrapperRef}
          minWidth={320}
          minHeight={180}
          onRequestFullscreen={() => setFullscreenText(true)}
          onResizeEnd={onMainBoxResize}
        />
      </div>

      {/* 展开的提示词面板（复刻 Co.jsx:666 过渡）。
          手柄不在 ExpandablePanel 内统一渲染，由本节点在面板 children 里渲染，
          targetRef=textarea, onResizeEnd 写回 node.data.inputWidth/inputHeight。 */}
      <ExpandablePanel expanded={expanded} minWidth={420}>
        <div className="space-y-3">
          {/* 素材缩略图区（通用组件 MaterialStrip，以生图节点为标准） */}
          <MaterialStrip images={refImages} texts={refTexts} onInsert={(name) => setPromptPersist((p) => (p ? `${p} @${name} ` : `@${name} `))} onDisconnect={disconnectSource} />

          {/* 提示词输入（基座 PromptInput） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPromptPersist}
            placeholder="输入提示词 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={(name) => setPromptPersist((p) => (p ? `${p} @${name} ` : `@${name} `))}
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部：自动拆分 + 模型 + 预设 + 生成 */}
          <div className="flex items-center justify-between pt-2 border-t border-edge-faint">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer h-6 px-2 text-caption-sm text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded transition-colors">
                <input type="checkbox" checked={autoSplit} onChange={(e) => setAutoSplitPersist(e.target.checked)} className="accent-blue-500 rounded sm:w-3 sm:h-3" />
                自动拆分
              </label>

              {/* 模型选择（基座 ModelSelect；选择即记住，跨节点复用） */}
              <ModelSelect
                value={selectedModel}
                onChange={(m) => { setSelectedModel(m); setTextPrefs({ model: m }) }}
                models={models}
              />

              {/* 预设提示词：打开提示词库弹窗 → 使用后新建文本节点 */}
              <PromptLibraryButton category="text" />
            </div>

            {/* 生成 / 停止（基座 GenerateButton） */}
            <GenerateButton loading={loading} onGenerate={handleGenerate} onStop={onStop} showCost={false} />
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸 + 双击全屏（复刻 Co.jsx:672 _Component23）。
            targetRef=textarea（promptInputRef），拖拽改 textarea 尺寸；
            onResizeEnd → onInputResize 写回 node.data.inputWidth/inputHeight，
            textarea 的 inline style 读这个 data 渲染（见 PromptInput）。
            注意：输入框是面板里的「部件」，不参与节点端口定位，所以只写 data，
            不走 onMainBoxResize 那种 node.width/height 写回。 */}
        <ResizeFullscreenHandle
          targetRef={promptInputRef}
          minWidth={200}
          maxWidth={900}
          minHeight={60}
          maxHeight={400}
          onRequestFullscreen={() => setFullscreenPrompt(true)}
          onResizeEnd={onInputResize}
        />
      </ExpandablePanel>

      {/* 全屏弹层（复刻 Ai.jsx）：主框全屏编辑文本内容 */}
      <FullscreenModal open={fullscreenText} title="编辑文本内容" onClose={() => setFullscreenText(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-canvas text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="输入文本内容..."
          value={text}
          onChange={(e) => setTextPersist(e.target.value)}
        />
      </FullscreenModal>

      {/* 全屏弹层（复刻 Ai.jsx）：输入框全屏编辑提示词 */}
      <FullscreenModal open={fullscreenPrompt} title="编辑提示词 - 文本" onClose={() => setFullscreenPrompt(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-canvas text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="输入提示词..."
          value={prompt}
          onChange={(e) => setPromptPersist(e.target.value)}
        />
      </FullscreenModal>
    </NodeShell>
  )
}
