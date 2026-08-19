import React, { useState, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Clapperboard, Plus, Expand, Download, Trash2, Play,
  AlertCircle, Settings, Link as LinkIcon, RefreshCw, Coins
} from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.jsx'
import ExpandablePanel from '../base/ExpandablePanel.jsx'
import GenerateButton from '../base/GenerateButton.jsx'
import ModelSelect from '../base/ModelSelect.jsx'
import ResizeFullscreenHandle from '../base/ResizeFullscreenHandle.jsx'
import FullscreenModal from '../base/FullscreenModal.jsx'
import GeneratingOverlay from '../base/GeneratingOverlay.jsx'
import { downloadUrl } from '../base/clipboard.js'
import PromptLibraryButton from '../base/PromptLibraryButton.jsx'
import JianyingIcon from '../base/JianyingIcon.jsx'
import MaterialStrip from '../base/MaterialStrip.jsx'
import { useNodeResize, useOutsideClick } from '../base/hooks.js'
import { useConnectedInputs } from '../base/useConnectedInputs.js'
import { useMediaDegrade } from '../base/useMediaDegrade.js'
import { useVideoPoster } from '../base/useVideoPoster.js'
import LazyImage from '../base/LazyImage.jsx'
import VideoThumbnail from '../base/VideoThumbnail.jsx'
import { useNodeGeneration } from '../base/useNodeGeneration.js'
import { useProviders } from '../base/settings/providerStore.js'
import { generateVideo } from '../base/videoApi.js'
import { useNodePrefs } from '../base/nodePrefs.js'
import { logger } from '../base/logger.js'
import { buildAllModels, resolveProviderModel } from '../base/providerModels.js'
import { debounce } from '../base/utils.js'

/**
 * 特惠视频节点（复刻原 As.jsx / discountVideoNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + GenerateButton + ModelSelect。
 * 保留差异化：主显示区、比例/分辨率/时长菜单、素材区、提示词输入。
 * 性能降级用通用 useMediaDegrade：lodLevel>=3 藏视频（与官方横幅 yt===3 一致）。
 */
function DiscountVideoNode({ id, data, selected }) {
  // 性能模式媒体降级（通用 hook）：hideVideo = isHidden('video')，即 lodLevel>=3
  const { isHidden } = useMediaDegrade()
  const hideVideo = isHidden('video')

  // 通用连线数据传递：读取直接上游节点的图片/文本作为参考素材
  const connected = useConnectedInputs(id)
  // 上游文本合并（多个文本节点自动聚合；data.texts 额外资产也并入），作为提示词的一部分
  const refTexts = [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])]
  const upstreamText = refTexts.map((t) => (t.text || '').trim()).filter(Boolean).join('\n')
  const { setEdges, setNodes } = useReactFlow()
  // 断开连线：素材缩略图红色 × → 删除该来源节点 → 本节点的连线（仅对有 sourceNodeId 的素材）
  const disconnectSource = useCallback(
    (sourceNodeId) => {
      if (!sourceNodeId) return
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)))
    },
    [id, setEdges]
  )
  const [prompt, setPrompt] = useState(data.prompt || '')
  // 有效提示词 = 本地 prompt + 上游文本，两者都参与生成
  const effectivePrompt = [prompt?.trim(), upstreamText].filter(Boolean).join('\n') || ''
  // 提示词输入框双击全屏编辑（复刻 TextNode 的交互：ResizeFullscreenHandle 双击 → 弹层）
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)
  // 提示词落盘：本地 state + 写回 node.data（支持函数式更新）。
  // 复用画布快照 KV（App.jsx 600ms 防抖 autoSave）→ 手动输入的提示词刷新不丢。
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
  // P2：prompt 持续输入走防抖写回（避免每键 setNodes 全图 node 数组重建）；卸载 flush 兜底
  const debouncedPatch = useRef(null)
  if (debouncedPatch.current == null) {
    debouncedPatch.current = debounce(patchData, 200)
  }
  const [ratio, setRatio] = useState(data.size || '16:9')
  const [resolution, setResolution] = useState(data.resolution || '1080p')
  const [seconds, setSeconds] = useState(data.selectedSeconds || '10')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel || 'runway-gen3')
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded)
  // 抽屉展开/收起
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])
  // 【React 反模式修复】「写回 node.data」不在 setState updater 里做（渲染期间 setNodes → BatchProvider 警告），
  // 改用 useEffect 同步落盘。
  React.useEffect(() => { debouncedPatch.current({ prompt }) }, [prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { patchData({ expanded }) }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps
  // 卸载前 flush 最后一次待提交（避免防抖窗口内丢数据）
  React.useEffect(() => () => { debouncedPatch.current?.flush() }, [])
  const [videoUrl, setVideoUrl] = useState(data.videoUrl || '')
  const [showRatioMenu, setShowRatioMenu] = useState(false)

  // 视频首帧封面（复刻官方 xi.jsx poster 机制）：未播放时只显示首帧封面、不加载视频本体，点击才加载播放
  // 注意：必须在 videoUrl state 定义之后调用，否则触发 TDZ「Cannot access before initialization」
  const posterUrl = useVideoPoster(videoUrl)
  const fileRef = useRef(null)
  const videoRef = useRef(null) // 主视频元素（点击播放按钮用）
  const promptInputRef = useRef(null) // 提示词 textarea ref（供面板右下角手柄拖拽改尺寸）
  const ratioMenuRef = useRef(null) // 比例/分辨率/时长菜单容器（点击外部关闭）
  useOutsideClick(ratioMenuRef, showRatioMenu, () => setShowRatioMenu(false))

  // 输入框尺寸写回 node.data（基座 useNodeResize，复刻官方 inputWidth/inputHeight）
  const { onInputResize } = useNodeResize(id)

  const ratioOptions = [
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' }
  ]
  const resOptions = ['480p', '720p', '1080p']
  const durationOptions = ['4', '6', '8', '10', '12', '15']

  // 供应商配置（多 provider）：模型下拉聚合【所有 provider】的 video_models（节点式选模型），
  // 生成时按选中的 model 解析回对应 provider，经 /api/proxy 转发。
  const { providers } = useProviders()
  const primary = providers?.find((p) => p.isPrimary) || providers?.[0] || null
  const models = buildAllModels(providers, 'video')

  // 记住上次选择的模型/比例/分辨率/时长（跨节点/跨会话）
  const { prefs: vidPrefs, set: setVidPrefs } = useNodePrefs('discountVideoNode', { model: '', size: '16:9', resolution: '1080p', seconds: '10' })

  // providers 加载后：若「未记忆模型」且节点没显式指定模型 → 默认用第一个 video_model 的 key 并记忆
  const defaultFromProvider = models[0]?.id
  React.useEffect(() => {
    if (!defaultFromProvider) return
    if (vidPrefs.model) return
    if (data.selectedModel) return
    setSelectedModel(defaultFromProvider)
    setVidPrefs({ model: defaultFromProvider })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFromProvider])

  // 统一生成契约（useNodeGeneration）：收敛「reportGenerate + 进度 + 成功双写 + 失败 + retry注册」。
  // 真实视频生成：经 localTool /api/proxy → 选中的 provider /v1/videos/generations（节点式：可跨 provider 选模型）。
  // Agent 的 generate_node 也走这里。
  const { loading, error, stop: onStop, start: handleGenerate } = useNodeGeneration({
    nodeId: id,
    type: { type: 'video', prompt: effectivePrompt || '', modelName: selectedModel },
    // 前置校验：本地 prompt 或上游文本任一非空即可生成
    validate: () => (effectivePrompt?.trim() ? '' : '请输入提示词'),
    run: async ({ progress, signal }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      const refUrls = connected.images.map((img) => img.url)
      // signal 支持真取消（Step C）
      return generateVideo({
        provider: useProvider,
        prompt: effectivePrompt || '',
        model: modelId,
        size: ratio,
        resolution,
        seconds,
        images: refUrls,
      }, (pct, stage) => progress(Math.max(10, Math.min(98, Math.round(pct))), stage), signal)
    },
    onSuccess: (r) => {
      setVideoUrl(r.url)
      // 【真相源契约】结果写回 node.data.videoUrl 由声明式 resultKey 自动完成（经 useNodeData，随画布快照落盘）。
      // 此回调只负责本地 state 同步与业务记忆；写 node.data 的部分交由 resultKey({[videoUrl]: r.url})。
      setVidPrefs({ model: selectedModel, size: ratio, resolution, seconds })
    },
    // 【精准节点回填】异步视频任务刷新后恢复轮询完成的广播 → 写回本节点，节点卡片自动恢复显示。
    // 视频唯一异步模式，均有 pollTaskId；data.videoUrl 有外部同步 effect 会把值同步到本地 state。
    onRecover: ({ resultUrl }) => {
      // 写回 node.data.videoUrl 由声明式 recoverable 自动完成，此处只同步本地 state（供渲染/下载）。
      setVideoUrl(resultUrl)
    },
    // ── P0-2-c 声明式写回：成功 / 广播恢复均自动 patchData({ videoUrl }) ──
    resultKey: 'videoUrl',
    recoverable: true,
  })

  // 外部写入 videoUrl（如视频处理节点 spawn 输出）→ 同步到本地 state，使节点显示/可下载该视频
  React.useEffect(() => {
    if (data.videoUrl && data.videoUrl !== videoUrl) setVideoUrl(data.videoUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.videoUrl])

  const onUpload = () => fileRef.current?.click()

  // 下载当前视频（<a download> 触发浏览器保存；文件名取 label，缺扩展名补 .mp4）
  const handleDownload = () => {
    if (!videoUrl) return
    let filename = data.label || ''
    try {
      const fromUrl = decodeURIComponent(new URL(videoUrl).pathname.split('/').pop() || '')
      if (fromUrl && !/^blob:|^data:/.test(videoUrl)) filename = filename || fromUrl
    } catch {}
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += (filename ? '.' : '') + 'mp4'
    if (!filename) filename = 'video.mp4'
    downloadUrl(videoUrl, filename)
  }

  // hover 操作栏按钮
  const toolbarButtons = [
    { key: 'upload', icon: <Plus size={14} />, title: '上传图片、视频或音频素材', onClick: onUpload },
    ...(videoUrl
      ? [
          { key: 'fullscreen', icon: <Expand size={14} />, title: '全屏播放' },
          { key: 'download', icon: <Download size={14} />, title: '下载', onClick: handleDownload },
          {
            key: 'jianying',
            icon: <JianyingIcon size={14} />,
            title: '发送到剪映素材库',
            hoverClass: 'hover:text-emerald-400',
            onClick: () => logger.info('DiscountVideoNode', '发送到剪映素材库')
          },
          { key: 'delete', icon: <Trash2 size={14} />, title: '删除', hoverClass: 'hover:text-red-500', onClick: () => setVideoUrl('') }
        ]
      : [])
  ]

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="特惠视频"
      icon={<Clapperboard size={11} className="text-gray-500" />}
      selected={selected}
      minWidth={200}
      minHeight={200}
      aspectRatio={ratio}
      sizeMode="area-fixed"
      baseSize={380}
      className="min-w-[200px] min-h-[200px]"
      handleVariant="small"
    >
      {/* hover 操作栏（loading 时隐藏） */}
      {!loading && <HoverToolbar buttons={toolbarButtons} loading={false} />}

      <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*,video/*,audio/*" />

      {/* 主显示区：flex-1 填满 wrapper，wrapper 宽高由 useSizeSync(area-fixed) 按比例同步，
          主框宽=wrapper宽，高=wrapper高 → 自然成比例，端口不跑偏，无需主框自己定 ratio。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
      <div
        className="relative cursor-pointer group/display flex flex-col w-full flex-1 min-h-0"
        onClick={toggleExpanded}
      >
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${videoUrl ? '' : 'bg-surface-strong'}`}>
          {/* 性能模式媒体降级：缩小时隐藏视频（复刻官方"图片视频已隐藏"） */}
          {videoUrl && !loading && !error && hideVideo && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-surface-muted">
              <Clapperboard size={24} className="text-gray-700" />
              <span className="text-caption text-gray-500">性能模式已隐藏</span>
            </div>
          )}
          {videoUrl && !hideVideo && (
            <VideoThumbnail
              videoRef={videoRef}
              src={videoUrl}
              poster={posterUrl || data.poster || ''}
              muted={false}
              fit="contain"
              size="lg"
              className={`w-full h-full rounded-lg ${loading ? 'opacity-50 blur-sm' : ''}`}
              onActivate={() => videoRef.current?.play()}
            />
          )}
          {loading && (
            <GeneratingOverlay label="生成中..." backgroundUrl={videoUrl} category="video" />
          )}
          {!videoUrl && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted pointer-events-none">
              <Clapperboard size={80} className="text-gray-700" strokeWidth={1.2} />
            </div>
          )}
          {error && !loading && !videoUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-surface p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-xs font-medium max-w-full break-words">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。 */}
      <ExpandablePanel expanded={expanded} minWidth={500}>
        <div className="space-y-3">
          {/* 素材缩略图区（通用组件 MaterialStrip，以生图节点为标准） */}
          <MaterialStrip images={connected.images} texts={connected.texts} onInsert={(name) => setPromptPersist((p) => (p ? `${p} @${name} ` : `@${name} `))} onDisconnect={disconnectSource} />

          {/* 提示词输入 */}
          <div className="flex items-start gap-2">
            {/* 外层不设固定 height，让 textarea 撑开 → 手柄拖拽纵向能正确拉高（生图 PromptInput 同款） */}
            <div className="flex-1 nodrag relative shrink-0">
              <textarea
                ref={promptInputRef}
                className="w-full bg-transparent text-base-sm text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag resize-none"
                style={{
                  width: data.inputWidth ? `${data.inputWidth}px` : undefined,
                  height: data.inputHeight ? `${data.inputHeight}px` : '80px',
                  minHeight: '80px',
                  overflow: 'auto'
                }}
                placeholder="描述你想要的视频内容 (输入 @ 调出素材)..."
                value={prompt}
                onChange={(e) => setPromptPersist(e.target.value)}
                onWheel={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* 底部控制 */}
          <div className="flex items-center justify-between pt-2 border-t border-edge-faint nodrag">
            <div className="flex items-center gap-1.5 overflow-visible z-50">
              {/* 比例/分辨率/时长（ref 绑外层 relative，点外部才关） */}
              <div ref={ratioMenuRef} className="relative nodrag flex items-center">
                <button
                  className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-gray-300 transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setShowRatioMenu((v) => !v) }}
                  title="选择比例和时长"
                >
                  <Settings size={12} className="opacity-70" />
                  <span className="whitespace-nowrap">{ratio} · {resolution} · {seconds}s</span>
                </button>
                {showRatioMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-72 bg-surface-1 border border-edge rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-caption text-gray-500 mb-2 px-1">比例</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {ratioOptions.map((o) => (
                          <button key={o.value} className={`px-3 py-1.5 text-caption-sm rounded-md transition-colors ${ratio === o.value ? 'bg-surface-3 text-white' : 'bg-surface-raised text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`} onClick={() => { setRatio(o.value); setVidPrefs({ size: o.value }) }}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2 px-1">分辨率</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {resOptions.map((r) => (
                          <button key={r} className={`px-3 py-1.5 text-caption-sm rounded-md transition-colors ${resolution === r ? 'bg-surface-3 text-white' : 'bg-surface-raised text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`} onClick={() => { setResolution(r); setVidPrefs({ resolution: r }) }}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption text-gray-500 mb-2 px-1">时长 (秒)</div>
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {durationOptions.map((d) => (
                          <button key={d} type="button" className={`px-3 py-1.5 text-caption-sm rounded-md transition-colors ${String(d) === seconds ? 'bg-surface-3 text-white' : 'bg-surface-raised text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`} onClick={() => { setSeconds(d); setVidPrefs({ seconds: String(d) }) }}>{d}s</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模型选择（基座 ModelSelect） */}
              <ModelSelect value={selectedModel} onChange={setSelectedModel} models={models} />

              {/* 预设提示词：打开提示词库弹窗 → 使用后新建文本节点 */}
              <PromptLibraryButton category="video" />
            </div>

            {/* 生成 / 停止（基座 GenerateButton） */}
            <GenerateButton
              loading={loading}
              onGenerate={handleGenerate}
              onStop={onStop}
              onRefresh={onStop}
            />
          </div>
        </div>

        {/* 面板右下角手柄：拖拽改输入框尺寸（复刻 As.jsx:2055 _Component23）。
            targetRef=textarea（promptInputRef），onResizeEnd → onInputResize 写回
            node.data.inputWidth/inputHeight，textarea 的 inline style 读这个 data 渲染。
            注意：视频 textarea 外层不能设固定 height（否则纵向拖不动），
            高度完全由 data.inputHeight 驱动。输入框不参与端口定位，只写 data。 */}
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
      <FullscreenModal open={fullscreenPrompt} title="编辑提示词 - 特惠视频" onClose={() => setFullscreenPrompt(false)}>
        <textarea
          autoFocus
          className="flex-1 w-full min-h-0 bg-canvas text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded"
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#e5e7eb' }}
          placeholder="描述你想要的视频内容 (输入 @ 调出素材)..."
          value={prompt}
          onChange={(e) => setPromptPersist(e.target.value)}
        />
      </FullscreenModal>
    </NodeShell>
  )
}
export default React.memo(DiscountVideoNode)
