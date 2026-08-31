import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  FileText, Plus, Copy, ChevronDown, ChevronUp, Loader2,
  AlertCircle, Link as LinkIcon
} from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.tsx'
import ExpandablePanel from '../base/ExpandablePanel.jsx'
import GenerateButton from '../base/GenerateButton.jsx'
import ModelSelect from '../base/ModelSelect.jsx'
import PromptInput from '../base/PromptInput.jsx'
import MaterialStrip from '../base/MaterialStrip.jsx'
import ResizeFullscreenHandle from '../base/ResizeFullscreenHandle.jsx'
import FullscreenEditor from '../base/FullscreenEditor.jsx'
import GeneratingOverlay from '../base/GeneratingOverlay.jsx'
import PromptLibraryButton from '../base/PromptLibraryButton.jsx'
import { useNodeResize } from '../base/hooks.ts'
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts'
import { useGenerateNode } from '../../hooks/useGenerateNode.ts'
import { debounce, buildEffectivePrompt } from '../base/utils.ts'
import { buildSpawnNodes, spawnAndCommit, makeChildId } from '../base/deriveNodes.ts'
import { useCanvasEdges } from '../base/CanvasEdgesContext.jsx'
import { saveTextToTasks, toAbsoluteFileUrl } from '../base/filesApi.ts'
import { chatCompletions } from '../base/chatApi.ts'
import { useNodePrefs } from '../base/nodePrefs.ts'
import { resolveProviderModel } from '../base/providerModels.ts'
import { resolvePromptChips } from '../base/promptChips.ts'
import { logger } from '../base/logger.ts'
import { reportDegrade } from '../base/degrade.ts'
import previewUrls from '../base/previewUrl.ts'

/**
 * 文本节点（复刻原 Co.jsx / textNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + ModelSelect + GenerateButton + PromptInput。
 * 保留差异化：文本编辑区（双击编辑）、自动拆分、预设菜单。
 */
function TextNode({ id, data, selected }) {
  // 通用连线数据传递：读取直接上游节点的文本/图片作为参考输入
  const connected = useConnectedInputs(id)
  const { setEdges, getEdges, getNodes, getNode, setNodes } = useReactFlow()
  const history = useCanvasEdges()
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

  // 参考输入：自身上传图片（在 images 定义后并入）+ 连线上游产出。
  // refTexts / effectivePrompt 不依赖 images，先定义在 useNodeGeneration 之前，避免 TDZ。
  const refTexts = connected.texts || []
  // 有效提示词 = 本地 prompt/文本 + 上游文本（多文本节点合并），两者都参与生成
  const effectivePrompt = buildEffectivePrompt(prompt?.trim() || text?.trim(), refTexts)
  const [autoSplit, setAutoSplit] = useState(data.autoSplit || false)

  // ── 输入落盘：本地 state + 防抖写回 node.data（不可变更新）──
  // 复用画布快照 KV（App.jsx 600ms 防抖 autoSave 只存 node.data，不存组件 useState）
  // → 手动输入的文字随画布快照落盘，刷新/切换项目不丢。
  // P2：prompt/text 持续输入走 debouncedPatch（200ms 防抖合并），避免每键 setNodes 全图 node 数组重建；
  // 卸载时 flush 兜底（防抖窗口内输入不丢）。autoSplit/expanded 是低频切换，保持即时写回。
  const patchData = useCallback(
    (patch) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [id, setNodes]
  )
  const debouncedPatch = useRef(null)
  if (debouncedPatch.current == null) {
    debouncedPatch.current = debounce(patchData, 200)
  }
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
  useEffect(() => { debouncedPatch.current({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { debouncedPatch.current({ text }) }, [text]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { patchData({ autoSplit }) }, [autoSplit]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps
  // 卸载前 flush 最后一次待提交（避免防抖窗口内丢数据）
  useEffect(() => () => { debouncedPatch.current?.flush() }, [])
  const [editingText, setEditingText] = useState(false)
  // 记住上次选择的模型（跨节点/跨会话）；初始用记忆值，无记忆回退 gpt-4o-mini
  const { prefs: textPrefs, set: setTextPrefs } = useNodePrefs('textNode', { model: '' })
  // 记忆只影响新建（见 App.addNode 注入）；存量初始化只读 data，缺字段用纯常量。
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? 'gpt-4o-mini')
  const [images, setImages] = useState(data.images || [])
  // 卸载时释放所有预览 Blob URL，避免内存泄漏（对齐 VideoProcessNode / AgentPanel）
  useEffect(() => () => { images.forEach((u) => previewUrls.release(u)) }, [images])
  // 自身上传图片 + 连线上游图片，多上游图片节点自动合并
  // 【memo 优化】用 useMemo 稳定 refImages 引用：否则每次 render 新建数组，传给 memo 子组件
  // （MaterialStrip/PromptInput）会失效导致每次重渲染。
  const refImages = useMemo(
    () => [...(connected.images || []), ...images.map((u, i) => ({ id: `img-${i}`, url: u, label: `图片${i + 1}` }))],
    [connected.images, images]
  )
  // 【富文本芯片解析】prompt/text 里可能含 `@{id:label}` 素材芯片（图片 → 参考图 + 文本占位，文本 → 纯文本）。
  // 与生图/视频节点一致：chipResolved.text 是发给 AI 的纯文本；chipResolved.refImages 是用户显式 @ 的参考图。
  // 必须在 refImages 定义之后、useGenerateNode 之前（其 run 闭包引用本值，防 TDZ）。
  const chipResolved = useMemo(
    () => resolvePromptChips(effectivePrompt, refImages, refTexts),
    [effectivePrompt, refImages, refTexts]
  )
  const textAreaRef = useRef(null)
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  const wrapperRef = useRef(null) // NodeShell 根 div ref（主框手柄拖拽改整体尺寸）
  const insertAssetRef = useRef(null) // 富文本素材插入：由 PromptInput onReady 上抛（主框 MaterialStrip 共用）
  const insertMention = (asset) => {
    if (typeof insertAssetRef.current === 'function') insertAssetRef.current(asset)
  }
  // 全屏编辑状态（复刻 Co.jsx:33,35 的 m/y → 主框/输入框全屏）
  const [fullscreenText, setFullscreenText] = useState(false)
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)

  // 尺寸写回（基座 useNodeResize）：
  //  - onMainBoxResize：主框手柄 → node.width/height + updateNodeInternals（wrapper 跟随，端口不错位）
  //  - onInputResize：输入框手柄 → node.data.inputWidth/inputHeight（复刻官方）
  const { onMainBoxResize, onInputResize } = useNodeResize(id)

  // 供应商/模型 + 默认模型回填 + useNodeGeneration(统一契约) 收进 useGenerateNode（P0-2 收口）。
  // 文本特例：模型域 'chat'（buildAllModels）与上报类型 'text' 不一致，故分 type/reportType 传。
  // prefs/selectedModel 由本节点持有并传入（无死锁）；结果写在 data.text（随画布快照恢复），不接 resultKey/recoverable。
  const { providers, primary, models, loading, error, stop: onStop, start: handleGenerate } = useGenerateNode({
    nodeId: id,
    type: 'chat',
    reportType: 'text',
    // 上报用解析后的纯文本（芯片已替换为可读内容），与实发一致，避免任务中心/日志看到 @{id:label|url} 噪音
    prompt: chipResolved.text || effectivePrompt || '',
    data,
    prefs: textPrefs,
    setPrefs: setTextPrefs,
    selectedModel,
    setSelectedModel,
    // 前置校验：本地 prompt/文本 或上游文本任一非空即可生成
    validate: () => (effectivePrompt?.trim() || chipResolved.refImages.length > 0 ? '' : '请输入提示词或文本'),
    run: async ({ progress, signal }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      // 参考图 = 用户显式 @ 的芯片图（顺序对应文本里的「图片N」）+ 其余连线上游/上传图（去重）。
      // 之前漏了解析：@ 插入的图芯片既不入参考图、又以 @{...|url} 噪音原样发给 LLM。
      const chipUrls = chipResolved.refImages.map((im) => im.url)
      const upstreamUrls = refImages.map((img) => img.url)
      const refUrls = [...new Set([...chipUrls, ...upstreamUrls])]
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
          { role: 'user', content: chipResolved.text || effectivePrompt || '' }
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
          logger.warn('TextNode', '自动拆分 JSON 解析失败，降级为普通文本', e)
          items = []
        }
        if (Array.isArray(items) && items.length > 0) {
          const me = getNode(id)
          const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 420) + 60
          const baseY = me?.position.y ?? 100
          const spawned = buildSpawnNodes(
            { id, position: { x: baseX, y: baseY } },
            items.map((it, n) => ({
              id: makeChildId('text-split'),
              type: 'textNode',
              position: { x: baseX, y: baseY + n * 250 },
              data: { text: typeof it === 'string' ? it : it.content, label: typeof it === 'string' ? `Text ${n + 1}` : it.title, expanded: false },
            })),
            { sourceHandle: 'main-output' }
          )
          spawnAndCommit(spawned, { getNodes, getEdges, setNodes, setEdges, history })
          return
        }
      }
      // 【debug】确认 AI 生成结果 content 的实际内容/长度（排查"文字选中却复制空"）
      logger.debug('TextNode', 'onSuccess content', { type: typeof r.content, len: typeof r.content === 'string' ? r.content.length : null, sample: typeof r.content === 'string' ? r.content.slice(0, 80) : r.content }, { module: 'text' })
      setTextPersist(r.content)
      // 文本结果落盘成 txt → 生成面板「文本」tab 收录（异步，失败不影响节点显示）
      // P1-3：统一经 reportDegrade 记录，避免只 catch 不提示（内网/权限问题时用户感知保存降级）
      if (typeof r.content === 'string' && r.content.trim()) {
        saveTextToTasks(r.content, 'text').catch((e) => {
          reportDegrade({ layer: 'TextNode', key: 'saveTextToTasks', e })
        })
      }
    },
  })

  const uploadImage = (e) => {
    const f = e.target.files?.[0]
    if (f) setImages((prev) => [...prev, previewUrls.create(f)])
    e.target.value = ''
  }

  const loadingIcon = <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'rgb(210,2,7)' }} />

  const toolbarButtons = [
    ...(images.length === 0
      ? [{ key: 'upload', icon: <Plus size={12} />, title: '上传图片', onClick: () => fileRef.current?.click() }]
      : []),
    { key: 'copy', icon: <Copy size={12} />, title: '复制文本', onClick: () => {
      // 【debug】复制按钮点击时确认 text state 的实际值（排查复制空）
      logger.debug('TextNode', 'copy button', { textType: typeof text, len: typeof text === 'string' ? text.length : null, sample: typeof text === 'string' ? text.slice(0, 80) : text }, { module: 'text' })
      navigator.clipboard?.writeText(text)
    } },
    { key: 'toggle', icon: expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />, title: expanded ? '收起输入' : '展开输入', onClick: toggleExpanded }
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="文本生成"
      icon={<FileText size={11} className="text-muted" />}
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
          与生图/视频生成节点一致，避免 wrapper≠主框导致端口/面板位置错位。
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
            <div className="text-red-400 text-caption p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          ) : (
            <>
              {!text && !loading && !editingText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <FileText size={72} className="text-muted" strokeWidth={1.2} />
                  <span className="text-caption text-muted-2">双击编辑内容或AI生成</span>
                </div>
              )}
              <textarea
                ref={textAreaRef}
                className={`w-full flex-1 min-h-0 bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel resize-none nodrag ${editingText ? 'nopan' : ''}`}
                style={{ fontSize: '14px', color: 'rgb(var(--mao-text-secondary))' }}
                placeholder=""
                value={text}
                readOnly={!editingText}
                onChange={(e) => setTextPersist(e.target.value)}
                onBlur={() => setEditingText(false)}
                onWheel={(e) => e.stopPropagation()}
                onCopy={() => {
                  // 【debug】排查"选中文字 Ctrl+C 但粘贴空"：复制时确认 selection 内容
                  try {
                    const sel = window.getSelection()
                    logger.debug('TextNode', 'copy on textarea', {
                      selectionText: sel ? sel.toString() : '(no sel)',
                      selectionLen: sel ? sel.toString().length : 0,
                      textStateLen: typeof text === 'string' ? text.length : null,
                    }, { module: 'text' })
                  } catch (e) { logger.debug('TextNode', 'copy selection read fail', { error: e?.message }, { module: 'text' }) }
                }}
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
          <MaterialStrip images={refImages} texts={refTexts} onInsert={insertMention} onDisconnect={disconnectSource} />

          {/* 提示词输入（基座 PromptInput，富文本芯片） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPromptPersist}
            placeholder="输入提示词 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={insertMention}
            onReady={(fn) => { insertAssetRef.current = fn }}
            richText
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部：自动拆分 + 模型 + 预设 + 生成 */}
          <div className="flex items-center justify-between pt-2 border-t border-edge-faint">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer h-6 px-2 text-caption-sm text-secondary hover:text-primary select-none bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded transition-colors">
                <input type="checkbox" checked={autoSplit} onChange={(e) => setAutoSplitPersist(e.target.checked)} className="accent-blue-500 rounded sm:w-3 sm:h-3" />
                自动拆分
              </label>

              {/* 模型选择（基座 ModelSelect；选择即记住，跨节点复用） */}
              <ModelSelect
                value={selectedModel}
                onChange={(m) => { setSelectedModel(m); setTextPrefs({ model: m }) }}
                models={models}
              />

              {/* 预设提示词：打开提示词库弹窗 → 可追加到当前提示词或新建文本节点 */}
              <PromptLibraryButton
                category="text"
                onAppend={(p) => setPromptPersist((prev) => (prev ? `${prev}\n${p}` : p))}
              />
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

      {/* 全屏弹层：主框全屏编辑文本内容 */}
      <FullscreenEditor
        open={fullscreenText}
        onClose={() => setFullscreenText(false)}
        variant="text"
        value={text}
        onChange={setTextPersist}
        placeholder="输入文本内容..."
      />

      {/* 全屏弹层：输入框全屏编辑提示词（显示上游图片/文本，富文本芯片） */}
      <FullscreenEditor
        open={fullscreenPrompt}
        onClose={() => setFullscreenPrompt(false)}
        variant="prompt"
        value={prompt}
        onChange={setPromptPersist}
        placeholder="输入提示词..."
        refImages={refImages}
        refTexts={refTexts}
        onInsert={insertMention}
        onDisconnect={disconnectSource}
        richText
      />
    </NodeShell>
  )
}
export default React.memo(TextNode)
