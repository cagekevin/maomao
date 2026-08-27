import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Image as ImageIcon, Plus, ZoomIn, Send, Download, Link as LinkIcon,
  AlertCircle, X, Coins, Zap
} from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.jsx'
import ExpandablePanel from '../base/ExpandablePanel.jsx'
import GenerateButton from '../base/GenerateButton.jsx'
import ModelSelect from '../base/ModelSelect.jsx'
import PromptInput from '../base/PromptInput.jsx'
import MaterialStrip from '../base/MaterialStrip.jsx'
import ResizeFullscreenHandle from '../base/ResizeFullscreenHandle.jsx'
import FullscreenEditor from '../base/FullscreenEditor.jsx'
import GeneratingOverlay from '../base/GeneratingOverlay.jsx'
import { NODE_AREA_FIXED_BASE_SIZE } from '../base/config.js'
import ImageZoomDialog from '../base/ImageZoomDialog.jsx'
import ImageEditor from '../base/ImageEditor.jsx'
import { useImageHoverActions } from '../base/useImageHoverActions.jsx'
import PromptLibraryButton from '../base/PromptLibraryButton.jsx'
import { downloadUrl, resolveDownloadFilename } from '../base/clipboard.js'
import JianyingIcon from '../base/JianyingIcon.jsx'
import { showToast } from '../base/toastStore.js'
import { sendToAssetLibrary } from '../base/assetStore.js'
import { openAssetLibrary } from '../base/taskStore.js'
import { useNodeResize, useOutsideClick } from '../base/hooks.js'
import { useConnectedInputs } from '../base/useConnectedInputs.js'
import { useMediaDegrade } from '../base/useMediaDegrade.js'
import { useGenerateNode } from '../base/useGenerateNode.js'
import { toAbsoluteFileUrl, saveResultToTasks } from '../base/filesApi.js'
import { logger } from '../base/logger.js'
import { fetchTasks } from '../base/localToolApi.js'
import { generateImage } from '../base/imageApi.js'
import { useNodePrefs } from '../base/nodePrefs.js'
import { useRenderImageResolver } from '../base/imageUrl.js'
import { resolveProviderModel } from '../base/providerModels.js'
import { debounce, mergeRefImages, buildEffectivePrompt } from '../base/utils.js'

/**
 * 生图节点（复刻原 bo.jsx / promptNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + PromptInput + GenerateButton + ModelSelect。
 * 保留差异化：主图片框、素材缩略图区、画质/比例/渲染质量菜单、请求格式、批量 xN。
 * 性能降级用通用 useMediaDegrade：lodLevel>=2 藏生图结果（与官方横幅"图片已隐藏"一致）。
 */
function PromptNode({ id, data, selected }) {
  const render = useRenderImageResolver()
  // 性能模式媒体降级（通用 hook）：hideResult = isHidden('image')，即 lodLevel>=2
  const { isHidden } = useMediaDegrade()
  const hideResult = isHidden('image')

  // 通用连线数据传递：读取直接上游节点的产出（图片/文本）作为参考输入
  const connected = useConnectedInputs(id)
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  const [prompt, setPrompt] = useState(data.prompt || '')

  // 参考输入 = 连线上游的产出（useConnectedInputs）+ 自身 data.images/texts。
  // 为什么合并两处：useConnectedInputs 是「通用连线机制」（任意上游节点 → 本节点）；
  // data.images 是剧本盒子连下游时用 collectAssets 按 @资产名 匹配后塞给本节点的资产参考图（更精准）。
  // 上游为空 + data 无图 → 两者都空 → 素材区隐藏，绝不显示假示例。
  // 【必须放在 prompt 定义之后、useNodeGeneration 之前】否则其 config 闭包首帧访问会触发 TDZ。
  // 【memo 优化】用 useMemo 稳定 refImages/refTexts 引用：否则每次 render 新建数组，传给 memo 子组件
  // （MaterialStrip/PromptInput）会失效导致每次重渲染。依赖用 connected.*/data.* 引用而非整对象，
  // 上游/自身数据未变时引用稳定。
  const refImages = useMemo(
    // 合并「连线上游产出」+「剧本盒等塞给本节点的 data.images」时，可能同一批资产图
    // 走了两条路重复进入（同 id，如 script-asset-xxx），mergeRefImages 按 id 去重避免渲染 key 重复。
    () => mergeRefImages(connected.images, data.images),
    [connected.images, connected.texts, data.images, data.texts]
  )
  const refTexts = useMemo(
    () => [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])],
    [connected.texts, connected.images, data.texts, data.images]
  )

  // 【修复】上游文本节点连进来时，文字只进入 refTexts（素材区），不会被自动填进 prompt。
  // 构造「有效提示词」= 本地 prompt + 上游文本 合并：两者都参与生成，
  // 本地写的主提示词在前，上游文本节点/资产文字追加在后，一起送进生图请求。
  // 多个上游文本节点自动合并；多个上游图片节点也已在 refImages 中合并。
  const effectivePrompt = buildEffectivePrompt(prompt, refTexts)
  // 提示词输入框双击全屏编辑（复刻 TextNode 的交互：ResizeFullscreenHandle 双击 → 弹层）
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)
  // 记住上次选择的比例/尺寸/模型（跨节点/跨会话）；初始用记忆值，无记忆回退默认
  const { prefs: imgPrefs, set: setImgPrefs } = useNodePrefs('promptNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' })
  // ⚠️【记忆只影响新建，不污染存量】组件初始化只读 data，缺字段用纯常量默认，
  // 绝不读记忆(imgPrefs)做回退——记忆已在新建入口 App.addNode 注入新节点 data。
  // 这样已挂载/快照还原的存量节点不会被记忆反向改写（见 nodePrefs.js 注释）。
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? 'Auto')
  const [imageSize, setImageSize] = useState(data.imageSize ?? '1K')
  const [quality, setQuality] = useState(data.quality ?? 'auto')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '')
  const [count, setCount] = useState(data.count || 1)
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '')
  const [showImgMenu, setShowImgMenu] = useState(false)
  const [showCountMenu, setShowCountMenu] = useState(false)
  // useSyncNodeData（Agent update_node 改 data → 同步本地 state）已收进 useGenerateNode 的 sync 参数，此处不再手写。
  const { setNodes, setEdges, getEdges, getNodes, addNodes } = useReactFlow()

  // 断连线：点击素材缩略图红色 ×，删除该素材来源节点 → 本节点的连线。
  // 仅对来自连线的素材有效（有 sourceNodeId）；data.images（剧本盒子资产）无来源连线，不处理。
  const disconnectSource = useCallback(
    (sourceNodeId) => {
      if (!sourceNodeId) return
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)))
    },
    [id, setEdges]
  )
  // 用户手动选择 → 写回 node.data，让 data 始终是真实状态（Agent read_canvas 读到最新）
  const patchData = useCallback((patch) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [id, setNodes])
  // 提示词落盘：本地 state + 防抖写回 node.data（支持函数式更新）。
  // 复用画布快照 KV（App.jsx 600ms 防抖 autoSave）→ 手动输入的提示词刷新不丢。
  // P2：prompt 持续输入走 debouncedPatch（200ms 防抖合并），避免每键 setNodes 全图 node 数组重建；
  // 卸载时 flush 兜底（防抖窗口内输入不丢）。expanded 是低频切换，保持即时写回。
  const setPromptPersist = useCallback((v) => {
    setPrompt((prev) => (typeof v === 'function' ? v(prev) : v))
  }, [])
  const debouncedPatch = useRef(null)
  if (debouncedPatch.current == null) {
    debouncedPatch.current = debounce(patchData, 200)
  }
  // 抽屉展开/收起
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])
  // 【React 反模式修复】「写回 node.data」不再在 setState updater 里做（那会在渲染期间 setNodes → BatchProvider 警告）。
  // 改为监听本地 state 变化，用 useEffect 同步落盘（effect 内 setState 合法，不在渲染期）。
  React.useEffect(() => { debouncedPatch.current({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps
  // 卸载前 flush 最后一次待提交（避免防抖窗口内丢数据）
  React.useEffect(() => () => { debouncedPatch.current?.flush() }, [])
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  // 双击大图：原生 <dialog> 弹窗（无外框、无背景容器，只显示图片）
  const zoomRef = useRef(null)
  const [zoomUrl, setZoomUrl] = useState(null)
  const openZoom = useCallback((url) => {
    if (!url) return
    setZoomUrl(url)
    requestAnimationFrame(() => zoomRef.current?.showModal())
  }, [])

  // 【刷新不丢·根治】挂载时若 data.imageUrl 为空，从任务中心按 nodeId 拉取已完成任务的持久化 resultUrl 回填。
  // 覆盖两类场景：① 旧代码生成的存量节点（onSuccess 从未写回 data.imageUrl）；② 落盘/写回竞态导致 data 里没存持久 URL。
  // 任务中心 resultUrl 是已落盘到 /files/tasks/ 的持久地址，回填后随画布快照自动保存，刷新不再丢图。
  const recoveredRef = useRef(false)
  React.useEffect(() => {
    if (recoveredRef.current) return
    recoveredRef.current = true
    if (data.imageUrl) return // 已有图，不覆盖
    let cancelled = false
    fetchTasks({ pageSize: 1000 }).then((d) => {
      if (cancelled) return
      const items = (d && d.data && d.data.items) || []
      const hit = items.find((t) => t.nodeId === id && t.status === 'completed' && t.resultUrl)
      if (hit && hit.resultUrl) {
        setImageUrl(hit.resultUrl)
        patchData({ imageUrl: hit.resultUrl })
      }
    }).catch((e) => logger.warn('task', 'restore-fail', { nodeId: id, error: e?.message }))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 三个下拉菜单容器（画质/格式/数量）：ref 绑外层 relative，使「按钮+菜单」都在内，点外部才关
  const imgMenuRef = useRef(null)
  const countMenuRef = useRef(null)
  useOutsideClick(imgMenuRef, showImgMenu, () => setShowImgMenu(false))
  useOutsideClick(countMenuRef, showCountMenu, () => setShowCountMenu(false))

  // 输入框尺寸写回 node.data（基座 useNodeResize，复刻官方 inputWidth/inputHeight）
  const { onInputResize } = useNodeResize(id)

  // 供应商/模型 + useSyncNodeData(外部变更同步) + 默认模型回填 + useNodeGeneration(统一契约)
  // 全部收进 useGenerateNode（P0-2 收口，第68+71行）。prefs/selectedModel 由本节点持有并传入（无死锁）。
  // providers/primary/models 一并汇出供 run / ModelSelect 使用；任务上报提示词取 effectivePrompt。
  const { providers, primary, models, loading, error, stop: onStop, start: handleGenerate } = useGenerateNode({
    nodeId: id,
    type: 'image',
    prompt: effectivePrompt || '',
    data,
    prefs: imgPrefs,
    setPrefs: setImgPrefs,
    selectedModel,
    setSelectedModel,
    // 收编 useSyncNodeData：Agent(update_node) 改 data 字段 → 同步本地 state（替原手写字段映射）
    sync: { aspectRatio: setAspectRatio, selectedModel: setSelectedModel, quality: setQuality, imageSize: setImageSize },
    resultField: 'imageUrl',
    recoverable: true,
    // 前置校验：本地 prompt 或上游文本任一非空即可生图
    validate: () => (effectivePrompt?.trim() ? '' : '请输入提示词'),
    run: async ({ progress, signal }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      const refUrls = refImages.map((img) => img.url)
      // 图生图：把连线上游产出的参考图传下去（网关 image_urls 字段）；signal 支持真取消（Step C）
      return generateImage({
        provider: useProvider,
        prompt: effectivePrompt || '',
        model: modelId,
        size: imageSize,
        n: count,
        aspectRatio,
        quality,
        images: refUrls,
      }, (pct) => progress(Math.max(15, Math.min(98, Math.round(pct)))), signal)
    },
    onSuccess: (r) => {
      setImageUrl(r.url)
      // data.imageUrl 已由 resultField:'imageUrl' 在 hook 内自动 patchData。
      // 仅当上游返回临时地址、落盘后有持久 URL 时才再覆盖写 data.imageUrl（刷新不丢）。
      // 否则若上游返回的是外链/临时地址，刷新后节点会因 URL 失效而丢图（taskStore 落盘只回写任务中心，不回写节点）。
      if (r.url && !/^blob:/.test(r.url)) {
        saveResultToTasks(r.url, 'image').then((persistedUrl) => {
          if (persistedUrl && persistedUrl !== r.url) {
            setImageUrl(persistedUrl)
            patchData({ imageUrl: persistedUrl })
          }
        }).catch((e) => logger.warn('task', 'persist-fail', { nodeId: id, error: e?.message }))
      }
      // 记忆本次参数（模型/比例/尺寸），供新建节点复用
      setImgPrefs({ model: selectedModel, aspectRatio, imageSize })
    },
    // 【精准节点回填】异步任务刷新后恢复轮询完成的广播 → 节点恢复显示图（resultUrl 写回 data 由 recoverable 自动）。
    // 仅生图 async 模式会命中（有 pollTaskId）；sync 同步无任务广播。
    onRecover: ({ resultUrl }) => {
      // 【异步安全兜底】节点在生成期间被删除/合并而消失 → 用结果重建节点（复用原 id 保持任务关联），
      // 避免「任务中心有图、画布没图」错位。吸收大雄 canvas-agent 的「live 节点消失→结果重建」经验。
      if (!getNodes().some((n) => n.id === id)) {
        // 原节点已不在画布：用原 id + 生图节点类型重建，带 resultUrl 与 label/prompt，放固定偏移位置。
        // 注意 addNodes 重复同 id 会告警，但此处仅在「确认不存在」时走，安全。
        addNodes([{
          id,
          type: 'promptNode',
          position: { x: 100, y: 100 },
          data: {
            ...(data?.label ? { label: data.label } : {}),
            ...(data?.prompt ? { prompt: data.prompt } : {}),
            imageUrl: resultUrl,
            aspectRatio: data?.aspectRatio || 'Auto',
          },
          width: 420,
          height: 420,
        }])
        return
      }
      setImageUrl(resultUrl)
    },
  })

  // 图片可选比例（含 1:3 / 3:1 极端竖/横比例，不含 1:2 / 2:1）
  const ratioOptions = ['Auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1']
  const sizeOptions = ['1K', '2K', '4K']
  const qualityOptions = [
    { value: 'auto', label: '自动' },
    { value: 'low', label: '低质量' },
    { value: 'medium', label: '中质量' },
    { value: 'high', label: '高质量' }
  ]
  const costMap = { 'dall-e-3': 4 }

  const insertMention = (name) => setPromptPersist((p) => (p ? `${p} @${name} ` : `@${name} `))
  const hasImage = !!imageUrl

  // 下载生成的图片（<a download> 触发浏览器保存；文件名推导走统一 resolveDownloadFilename）
  const handleDownload = () => {
    if (!imageUrl) return
    downloadUrl(imageUrl, resolveDownloadFilename(data.label || data.name, imageUrl, { ext: 'png', fallback: 'generated.png' }))
  }

  // 共享图片 hover 能力（裁剪/标记/压缩）：写回走 setImageUrl + patchData（不可变落盘）。
  const { editor, setEditor, renderEditor, renderInlineCropper, imageButtons } = useImageHoverActions({
    id,
    url: imageUrl,
    hasImage,
    label: data.label,
    onImageReplaced: (dataUrl) => {
      setImageUrl(dataUrl)
      patchData({ imageUrl: dataUrl })
    },
  })

  // hover 操作栏按钮：图片类共享能力(crop/edit/compress)走 useImageHoverActions（带 onClick，修死按钮），
  // zoom/upload/send/jianying/download 按生图节点语义各自声明。
  const toolbarButtons = [
    ...(refImages.length === 0
      ? [{ key: 'upload', icon: <Plus size={14} />, title: '上传参考图', onClick: () => fileRef.current?.click() }]
      : []),
    ...(hasImage
      ? [
          { key: 'zoom', icon: <ZoomIn size={14} />, title: '放大' },
          // 共享图片能力：裁剪/标记（开 ImageEditor）/压缩，show 已由 hook 控制为 hasImage
          ...imageButtons,
          {
            key: 'send',
            icon: <Send size={14} />,
            title: '发送到素材库',
            hoverClass: 'hover:text-blue-400',
            onClick: () => {
              if (!imageUrl) { showToast('没有可发送的素材', { type: 'error' }); return }
              const name = (data.label && String(data.label).trim()) || ''
              sendToAssetLibrary(imageUrl, { name, type: 'image' })
              openAssetLibrary()
              showToast('已发送到素材库', { type: 'success' })
            }
          },
          { key: 'jianying', icon: <JianyingIcon size={14} />, title: '发送到剪映素材库', hoverClass: 'hover:text-emerald-400' },
          { key: 'download', icon: <Download size={14} />, title: '下载', onClick: handleDownload }
        ]
      : [])
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="生图节点"
      icon={<ImageIcon size={11} className="text-muted" />}
      selected={selected}
      minWidth={160}
      minHeight={160}
      handleVariant="small"
      aspectRatio={aspectRatio}
      sizeMode="area-fixed"
      baseSize={NODE_AREA_FIXED_BASE_SIZE}
    >
      {/* hover 操作栏（loading 时隐藏） */}
      {!loading && <HoverToolbar buttons={toolbarButtons} />}

      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" />

      {/* 主图片框：点击切换展开/收起；flex-1 填满 wrapper（高度由 useSizeSync 同步）。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
      <div
        className="relative cursor-pointer group/image w-full flex flex-col flex-1 min-h-0"
        onClick={toggleExpanded}
        onDoubleClick={(e) => { e.stopPropagation(); openZoom(imageUrl) }}
      >
        {/* 就地裁剪浮层：覆盖在生图结果区，不跳全屏 */}
        {renderInlineCropper()}
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${hasImage ? '' : 'bg-canvas'}`}>
          {/* 性能模式媒体降级：缩小时隐藏生图结果（复刻官方"图片已隐藏"） */}
          {hasImage && !loading && !error && hideResult && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-surface-muted">
              <ImageIcon size={24} className="text-muted" />
              <span className="text-caption text-muted">性能模式已隐藏</span>
            </div>
          )}
          {hasImage && !hideResult && (
            <img
              src={render(imageUrl)}
              alt="Generated Content"
              loading="lazy"
              decoding="async"
              className={`max-w-full w-full h-full object-cover block ${loading ? 'opacity-50 blur-sm' : ''}`}
              draggable={false}
            />
          )}
          {loading && (
            <GeneratingOverlay label="生图中..." backgroundUrl={imageUrl} category="image" />
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-surface p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-caption font-medium max-w-full break-words">{error}</span>
              <span className="text-caption bg-surface-hover-strong hover:bg-surface-3 text-body px-3 py-1 rounded-full border border-edge-raised transition-colors">请检查设置或重试</span>
            </div>
          )}
          {!hasImage && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted pointer-events-none">
              <ImageIcon size={80} className="text-muted" strokeWidth={1.2} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none" />
        </div>
      </div>

      {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。 */}
      <ExpandablePanel expanded={expanded} minWidth={500}>
        <div className="space-y-3">
          {/* 素材缩略图区（通用组件 MaterialStrip，以生图节点为标准：缩略图 + 底部@插入 + 右上×断线） */}
          <MaterialStrip images={refImages} texts={refTexts} onInsert={insertMention} onDisconnect={disconnectSource} />

          {/* 提示词输入（基座 PromptInput，含 @素材弹层） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPromptPersist}
            placeholder="描述你想要的画面 (输入 @ 调出素材)..."
            refImages={refImages}
            refTexts={refTexts}
            onInsert={insertMention}
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部参数区 */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-edge-faint nodrag">
            <div className="flex items-center gap-1.5 overflow-visible">
              {/* 画质 / 比例 / 渲染质量 */}
              <div ref={imgMenuRef} className="relative nodrag">
                <button type="button" className="flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowImgMenu((v) => !v) }}>
                  <span className="w-2.5 h-3 border border-current rounded-[2px]" />
                  <span>{aspectRatio} · {imageSize} · {qualityOptions.find((q) => q.value === quality)?.label}</span>
                </button>
                {showImgMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-surface-1 border border-edge rounded-lg shadow-popover p-3 z-dropdown flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-caption text-muted mb-2">画质</div>
                      <div className="flex gap-1.5">{sizeOptions.map((s) => <button key={s} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${imageSize === s ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setImageSize(s); setImgPrefs({ imageSize: s }); requestAnimationFrame(() => patchData({ imageSize: s })) }}>{s}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2">比例</div>
                      <div className="flex flex-wrap gap-1.5">{ratioOptions.map((r) => <button key={r} type="button" className={`px-3 py-1.5 text-caption-sm rounded-md border transition-colors ${aspectRatio === r ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setAspectRatio(r); setImgPrefs({ aspectRatio: r }); requestAnimationFrame(() => patchData({ aspectRatio: r })) }}>{r}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2">渲染质量</div>
                      <div className="flex gap-1.5">{qualityOptions.map((q) => <button key={q.value} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${quality === q.value ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setQuality(q.value); setImgPrefs({ quality: q.value }); requestAnimationFrame(() => patchData({ quality: q.value })) }}>{q.label}</button>)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模型选择（基座 ModelSelect；选择即记住，跨节点复用） */}
              <ModelSelect
                value={selectedModel}
                onChange={(m) => { setSelectedModel(m); setImgPrefs({ model: m }); patchData({ selectedModel: m }) }}
                models={models}
                costMap={costMap}
                placeholder="选择模型"
              />

              {/* 预设：打开提示词库弹窗 → 可追加到当前提示词或新建文本节点 */}
              <PromptLibraryButton
                category="image"
                onAppend={(p) => setPromptPersist((prev) => (prev ? `${prev}\n${p}` : p))}
              />
            </div>

            {/* 批量 xN + 生成/停止 */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {!loading && (
                <div ref={countMenuRef} className="relative nodrag flex items-center">
                  <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowCountMenu((v) => !v) }} title="批量生成数量">
                    <span>x{count}</span>
                  </button>
                  {showCountMenu && (
                    <div className="absolute bottom-full right-0 mb-1 w-16 bg-surface-1 border border-edge rounded-lg shadow-popover p-1 z-dropdown flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} className={`w-full text-center py-1.5 text-caption-sm rounded-md transition-colors ${count === n ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`} onClick={(e) => { e.stopPropagation(); setCount(n); setShowCountMenu(false) }}>x{n}</button>)}
                    </div>
                  )}
                </div>
              )}
              <GenerateButton loading={loading} onGenerate={handleGenerate} onStop={onStop} />
            </div>
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸（复刻 bo.jsx:1676 _Component23）。
            targetRef=textarea（promptInputRef），onResizeEnd → onInputResize 写回
            node.data.inputWidth/inputHeight，PromptInput 的 textarea 读这个 data 渲染。
            输入框是面板里的部件，不参与端口定位，所以只写 data，不改 node.width/height。 */}
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

      {/* 全屏弹层：提示词输入框双击 → 全屏编辑提示词（统一组件） */}
      <FullscreenEditor
        open={fullscreenPrompt}
        onClose={() => setFullscreenPrompt(false)}
        variant="prompt"
        value={prompt}
        onChange={setPromptPersist}
        placeholder="描述你想要的画面 (输入 @ 调出素材)..."
        refImages={refImages}
        refTexts={refTexts}
        onInsert={insertMention}
        onDisconnect={disconnectSource}
      />

      {/* 双击大图：共享 ImageZoomDialog */}
      <ImageZoomDialog ref={zoomRef} url={zoomUrl} />

      {/* 图片编辑器（裁剪/标记/压缩）：统一机制渲染，editor 关闭时返回 null */}
      {renderEditor()}
    </NodeShell>
  )
}
export default React.memo(PromptNode)
