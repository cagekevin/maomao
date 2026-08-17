import React, { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Image as ImageIcon, Plus, ZoomIn, Crop, Pencil, Send, Download, Link as LinkIcon,
  AlertCircle, X, Coins, Zap
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
import ImageZoomDialog from './base/ImageZoomDialog.jsx'
import PromptLibraryButton from './base/PromptLibraryButton.jsx'
import { downloadUrl } from './base/clipboard.js'
import JianyingIcon from './JianyingIcon.jsx'
import { useNodeResize, useOutsideClick } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeGeneration } from './base/useNodeGeneration.js'
import { toAbsoluteFileUrl, saveResultToTasks } from './base/filesApi.js'
import { useProviders, load as loadProviders } from './base/settings/providerStore.js'
import { fetchTasks } from './base/tasksApi.js'
import { generateImage } from './base/imageApi.js'
import { useNodePrefs } from './base/nodePrefs.js'
import { useSyncNodeData } from './base/useSyncNodeData.js'
import { buildAllModels, resolveProviderModel } from './base/providerModels.js'

/**
 * 生图节点（复刻原 bo.jsx / promptNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + PromptInput + GenerateButton + ModelSelect。
 * 保留差异化：主图片框、素材缩略图区、画质/比例/渲染质量菜单、请求格式、批量 xN。
 * 性能降级用通用 useMediaDegrade：lodLevel>=2 藏生图结果（与官方横幅"图片已隐藏"一致）。
 */
export default function PromptNode({ id, data, selected }) {
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
  const refImages = [...(connected.images || []), ...(data.images?.length ? data.images : [])]
  const refTexts = [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])]

  // 【修复】上游文本节点连进来时，文字只进入 refTexts（素材区），不会被自动填进 prompt。
  // 构造「有效提示词」= 本地 prompt + 上游文本 合并：两者都参与生成，
  // 本地写的主提示词在前，上游文本节点/资产文字追加在后，一起送进生图请求。
  // 多个上游文本节点自动合并；多个上游图片节点也已在 refImages 中合并。
  const upstreamText = refTexts.map((t) => (t.text || '').trim()).filter(Boolean).join('\n')
  const effectivePrompt = [prompt?.trim(), upstreamText].filter(Boolean).join('\n') || ''
  // 提示词输入框双击全屏编辑（复刻 TextNode 的交互：ResizeFullscreenHandle 双击 → 弹层）
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)
  // 记住上次选择的比例/尺寸/模型（跨节点/跨会话）；初始用记忆值，无记忆回退默认
  const { prefs: imgPrefs, set: setImgPrefs } = useNodePrefs('promptNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' })
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || imgPrefs.aspectRatio || 'Auto')
  const [imageSize, setImageSize] = useState(data.imageSize || imgPrefs.imageSize || '1K')
  const [quality, setQuality] = useState(data.quality || 'auto')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || imgPrefs.model || '')
  const [count, setCount] = useState(data.count || 1)
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '')
  const [showImgMenu, setShowImgMenu] = useState(false)
  const [showCountMenu, setShowCountMenu] = useState(false)
  // 同步 Agent(update_node) 写入 node.data 的外部变更到本地 state：
  // 否则 Agent 改了 data.aspectRatio / selectedModel，UI 与生成参数仍用旧 state。
  useSyncNodeData(data, { aspectRatio: setAspectRatio, selectedModel: setSelectedModel, quality: setQuality, imageSize: setImageSize })
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
  // 提示词落盘：本地 state + 写回 node.data（支持函数式更新）。
  // 复用画布快照 KV（App.jsx 600ms 防抖 autoSave）→ 手动输入的提示词刷新不丢。
  const setPromptPersist = useCallback((v) => {
    setPrompt((prev) => (typeof v === 'function' ? v(prev) : v))
  }, [])
  // 抽屉展开/收起
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])
  // 【React 反模式修复】「写回 node.data」不再在 setState updater 里做（那会在渲染期间 setNodes → BatchProvider 警告）。
  // 改为监听本地 state 变化，用 useEffect 同步落盘（effect 内 setState 合法，不在渲染期）。
  React.useEffect(() => { patchData({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps
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
      const items = (d && d.items) || []
      const hit = items.find((t) => t.nodeId === id && t.status === 'completed' && t.resultUrl)
      if (hit && hit.resultUrl) {
        setImageUrl(hit.resultUrl)
        patchData({ imageUrl: hit.resultUrl })
      }
    }).catch(() => {})
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

  // 供应商配置（多 provider）：模型下拉聚合【所有 provider】的 image_models（节点式选模型），
  // 生成时按选中的 model 解析回对应 provider，经 /api/proxy 转发。
  const { providers } = useProviders()
  const primary = providers?.find((p) => p.isPrimary) || providers?.[0] || null
  const models = buildAllModels(providers, 'image')

  // 挂载时确保供应商已加载
  React.useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // providers 加载后：若「未记忆模型」且节点没显式指定模型 → 默认用第一个模型的 key 并记忆
  const defaultFromProvider = models[0]?.id
  React.useEffect(() => {
    if (!defaultFromProvider) return
    if (imgPrefs.model) return // 已有记忆，不覆盖
    if (data.selectedModel) return // 节点显式指定，不覆盖
    setSelectedModel(defaultFromProvider)
    setImgPrefs({ model: defaultFromProvider })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFromProvider])

  // 统一生成契约（useNodeGeneration）：收敛「reportGenerate + 进度 + 成功双写(taskStore+node.data) + 失败 + retry注册」。
  // 真实生图：经 localTool /api/proxy → 选中的 provider /v1/images/generations（节点式：可跨 provider 选模型）。
  // 同步/异步由该 provider.image_mode 决定（API 设置页「图片生成模式」）。Agent 的 generate_node 也走这里。
  const { loading, error, stop: onStop, start: handleGenerate } = useNodeGeneration({
    nodeId: id,
    type: { type: 'image', prompt: effectivePrompt || '', modelName: selectedModel },
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
      // 写回 node.data.imageUrl，供复制图片（copyNodeImage）、复制节点等读取 node.data 的入口拿到结果
      patchData({ imageUrl: r.url })
      // 【刷新不丢】把生成结果落盘到 localTool 的 /files/tasks/，再用持久化 URL 覆盖写回 data.imageUrl。
      // 否则若上游返回的是外链/临时地址，刷新后节点会因 URL 失效而丢图（taskStore 的落盘只回写任务中心，不回写节点）。
      if (r.url && !/^blob:/.test(r.url)) {
        saveResultToTasks(r.url, 'image').then((persistedUrl) => {
          if (persistedUrl && persistedUrl !== r.url) {
            setImageUrl(persistedUrl)
            patchData({ imageUrl: persistedUrl })
          }
        }).catch(() => {})
      }
      // 记忆本次参数（模型/比例/尺寸），供新建节点复用
      setImgPrefs({ model: selectedModel, aspectRatio, imageSize })
    },
    // 【精准节点回填】异步任务刷新后恢复轮询完成的广播 → 把结果写回本节点，节点卡片自动恢复显示图。
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
      patchData({ imageUrl: resultUrl })
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

  // 下载生成的图片（<a download> 触发浏览器保存）
  const handleDownload = () => {
    if (!imageUrl) return
    let filename = data.label || data.name || ''
    try {
      const fromUrl = decodeURIComponent(new URL(imageUrl).pathname.split('/').pop() || '')
      if (fromUrl && !/^blob:|^data:/.test(imageUrl)) filename = filename || fromUrl
    } catch {}
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += (filename ? '.' : '') + 'png'
    if (!filename) filename = 'generated.png'
    downloadUrl(imageUrl, filename)
  }

  // hover 操作栏按钮
  const toolbarButtons = [
    ...(refImages.length === 0
      ? [{ key: 'upload', icon: <Plus size={14} />, title: '上传参考图', onClick: () => fileRef.current?.click() }]
      : []),
    ...(hasImage
      ? [
          { key: 'zoom', icon: <ZoomIn size={14} />, title: '放大' },
          { key: 'crop', icon: <Crop size={14} />, title: '裁剪' },
          { key: 'edit', icon: <Pencil size={14} />, title: '编辑' },
          { key: 'send', icon: <Send size={14} />, title: '发送到左侧网站', hoverClass: 'hover:text-blue-400' },
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
      icon={<ImageIcon size={11} className="text-gray-500" />}
      selected={selected}
      minWidth={160}
      minHeight={160}
      handleVariant="small"
      aspectRatio={aspectRatio}
      defaultHeight={420}
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
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${hasImage ? '' : 'bg-canvas'}`}>
          {/* 性能模式媒体降级：缩小时隐藏生图结果（复刻官方"图片已隐藏"） */}
          {hasImage && !loading && !error && hideResult && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-surface-muted">
              <ImageIcon size={24} className="text-gray-700" />
              <span className="text-caption text-gray-500">性能模式已隐藏</span>
            </div>
          )}
          {hasImage && !hideResult && (
            <img
              src={imageUrl}
              alt="Generated Content"
              loading="lazy"
              decoding="async"
              className={`max-w-full w-full h-full object-contain block rounded-lg ${loading ? 'opacity-50 blur-sm' : ''}`}
              draggable={false}
            />
          )}
          {loading && (
            <GeneratingOverlay label="生图中..." backgroundUrl={imageUrl} category="image" />
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-surface p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-xs font-medium max-w-full break-words">{error}</span>
              <span className="text-caption bg-surface-hover-strong hover:bg-surface-3 text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors">请检查设置或重试</span>
            </div>
          )}
          {!hasImage && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted pointer-events-none">
              <ImageIcon size={80} className="text-gray-700" strokeWidth={1.2} />
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
                <button type="button" className="flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowImgMenu((v) => !v) }}>
                  <span className="w-2.5 h-3 border border-current rounded-[2px]" />
                  <span>{aspectRatio} · {imageSize} · {qualityOptions.find((q) => q.value === quality)?.label}</span>
                </button>
                {showImgMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-surface-1 border border-edge rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-caption text-gray-500 mb-2">画质</div>
                      <div className="flex gap-1.5">{sizeOptions.map((s) => <button key={s} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${imageSize === s ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setImageSize(s); setImgPrefs({ imageSize: s }); requestAnimationFrame(() => patchData({ imageSize: s })) }}>{s}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2">比例</div>
                      <div className="flex flex-wrap gap-1.5">{ratioOptions.map((r) => <button key={r} type="button" className={`px-3 py-1.5 text-caption-sm rounded-md border transition-colors ${aspectRatio === r ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setAspectRatio(r); setImgPrefs({ aspectRatio: r }); requestAnimationFrame(() => patchData({ aspectRatio: r })) }}>{r}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2">渲染质量</div>
                      <div className="flex gap-1.5">{qualityOptions.map((q) => <button key={q.value} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${quality === q.value ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setShowImgMenu(false); setQuality(q.value); setImgPrefs({ quality: q.value }); requestAnimationFrame(() => patchData({ quality: q.value })) }}>{q.label}</button>)}</div>
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

              {/* 预设：打开提示词库弹窗 → 使用后新建文本节点 */}
              <PromptLibraryButton category="image" />
            </div>

            {/* 批量 xN + 生成/停止 */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {!loading && (
                <div ref={countMenuRef} className="relative nodrag flex items-center">
                  <button className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-edge hover:border-edge-strong rounded text-caption-sm text-gray-300 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowCountMenu((v) => !v) }} title="批量生成数量">
                    <span>x{count}</span>
                  </button>
                  {showCountMenu && (
                    <div className="absolute bottom-full right-0 mb-1 w-16 bg-surface-1 border border-edge rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} className={`w-full text-center py-1.5 text-caption-sm rounded-md transition-colors ${count === n ? 'bg-surface-hover-strong text-white' : 'text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`} onClick={(e) => { e.stopPropagation(); setCount(n); setShowCountMenu(false) }}>x{n}</button>)}
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

      {/* 全屏弹层（复刻 TextNode）：提示词输入框双击 → 全屏编辑提示词 */}
      <FullscreenModal open={fullscreenPrompt} title="编辑提示词 - 生图" onClose={() => setFullscreenPrompt(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-canvas text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="描述你想要的画面 (输入 @ 调出素材)..."
          value={prompt}
          onChange={(e) => setPromptPersist(e.target.value)}
        />
      </FullscreenModal>

      {/* 双击大图：共享 ImageZoomDialog */}
      <ImageZoomDialog ref={zoomRef} url={zoomUrl} />
    </NodeShell>
  )
}
