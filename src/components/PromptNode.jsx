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
import ResizeFullscreenHandle from './base/ResizeFullscreenHandle.jsx'
import GeneratingOverlay from './base/GeneratingOverlay.jsx'
import PromptLibraryButton from './base/PromptLibraryButton.jsx'
import JianyingIcon from './JianyingIcon.jsx'
import { useNodeResize, useOutsideClick } from './base/hooks.js'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeGeneration } from './base/useNodeGeneration.js'
import { useProviders, load as loadProviders } from './base/settings/providerStore.js'
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
  const { setNodes } = useReactFlow()
  // 用户手动选择 → 写回 node.data，让 data 始终是真实状态（Agent read_canvas 读到最新）
  const patchData = useCallback((patch) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [id, setNodes])
  const fileRef = useRef(null)
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
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
  // 同步/异步由该 provider.image_mode 决定（API 设置页「图片生成模式」）。Agent 的 trigger_generation 也走这里。
  const { loading, error, stop: onStop, start: handleGenerate } = useNodeGeneration({
    nodeId: id,
    type: { type: 'image', prompt: prompt || '', modelName: selectedModel },
    validate: () => (prompt?.trim() ? '' : '请输入提示词'),
    run: async ({ progress }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      const refUrls = refImages.map((img) => img.url)
      // 图生图：把连线上游产出的参考图传下去（网关 image_urls 字段）
      return generateImage({
        provider: useProvider,
        prompt: prompt || '',
        model: modelId,
        size: imageSize,
        n: count,
        aspectRatio,
        quality,
        images: refUrls,
      }, (pct) => progress(Math.max(15, Math.min(98, Math.round(pct)))))
    },
    onSuccess: (r) => {
      setImageUrl(r.url)
      // 记忆本次参数（模型/比例/尺寸），供新建节点复用
      setImgPrefs({ model: selectedModel, aspectRatio, imageSize })
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

  // 参考输入 = 连线上游的产出（useConnectedInputs）+ 自身 data.images/texts。
  // 为什么合并两处：useConnectedInputs 是「通用连线机制」（任意上游节点 → 本节点）；
  // data.images 是剧本盒子连下游时用 collectAssets 按 @资产名 匹配后塞给本节点的资产参考图（更精准）。
  // 上游为空 + data 无图 → 两者都空 → 素材区隐藏，绝不显示假示例。
  const refImages = [...(connected.images || []), ...(data.images?.length ? data.images : [])]
  const refTexts = [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])]

  const insertMention = (name) => setPrompt((p) => (p ? `${p} @${name} ` : `@${name} `))
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
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
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
        onClick={() => setExpanded((v) => !v)}
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
          {/* 素材缩略图区 */}
          {(refImages.length > 0 || refTexts.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-1">
              {refImages.map((img, i) => {
                const name = `图片${i + 1}`
                return (
                  <div key={img.id} className="w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan" title={img.isConnected ? '已连线的图片' : '上传的图片'}>
                    <img src={img.url} className="w-full h-full object-cover opacity-80 pointer-events-none" alt={name} />
                    <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                    <button type="button" className="absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-2xs text-white text-center py-0.5 truncate cursor-pointer transition-colors" title={`点击插入 @${name}`} onClick={(e) => { e.stopPropagation(); insertMention(name) }}>{name}</button>
                    <span className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all"><X size={10} className="text-white" /></span>
                  </div>
                )
              })}
              {refTexts.map((t, i) => {
                const name = `文本${i + 1}`
                return (
                  <div key={t.id} className="h-8 px-2 bg-surface-hover border border-edge-muted rounded flex items-center gap-1 text-caption text-gray-300 hover:bg-surface-hover-strong hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative" title={t.text} onClick={(e) => { e.stopPropagation(); insertMention(name) }}>
                    <LinkIcon size={10} />
                    <span className="max-w-[80px] truncate">{name} ({t.label})</span>
                    <span className="absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all"><X size={10} className="text-white" /></span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 提示词输入（基座 PromptInput，含 @素材弹层） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPrompt}
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
                      <div className="flex gap-1.5">{sizeOptions.map((s) => <button key={s} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${imageSize === s ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setImageSize(s); setImgPrefs({ imageSize: s }); patchData({ imageSize: s }) }}>{s}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2">比例</div>
                      <div className="flex flex-wrap gap-1.5">{ratioOptions.map((r) => <button key={r} type="button" className={`px-3 py-1.5 text-caption-sm rounded-md border transition-colors ${aspectRatio === r ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setAspectRatio(r); setImgPrefs({ aspectRatio: r }); patchData({ aspectRatio: r }) }}>{r}</button>)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2">渲染质量</div>
                      <div className="flex gap-1.5">{qualityOptions.map((q) => <button key={q.value} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${quality === q.value ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-gray-400 hover:bg-surface-hover'}`} onClick={() => { setQuality(q.value); patchData({ quality: q.value }) }}>{q.label}</button>)}</div>
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
          onResizeEnd={onInputResize}
        />
      </ExpandablePanel>
    </NodeShell>
  )
}
