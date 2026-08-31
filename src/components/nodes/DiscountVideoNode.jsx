import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Clapperboard, Plus, Expand, Download, Trash2, Play,
  AlertCircle, Settings, Link as LinkIcon, RefreshCw, Coins
} from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.tsx'
import ExpandablePanel from '../base/ExpandablePanel.tsx'
import GenerateButton from '../base/GenerateButton.tsx'
import ModelSelect from '../base/ModelSelect.tsx'
import ResizeFullscreenHandle from '../base/ResizeFullscreenHandle.tsx'
import FullscreenEditor from '../base/FullscreenEditor.tsx'
import GeneratingOverlay from '../base/GeneratingOverlay.tsx'
import { NODE_AREA_FIXED_BASE_SIZE } from '../base/config.js'
import { downloadUrl, resolveDownloadFilename } from '../base/clipboard.ts'
import PromptLibraryButton from '../base/PromptLibraryButton.tsx'
import JianyingIcon from '../base/JianyingIcon.tsx'
import MaterialStrip from '../base/MaterialStrip.tsx'
import PromptInput from '../base/PromptInput.tsx'
import { resolvePromptChips } from '../base/promptChips.ts'
import { useNodeResize, useOutsideClick } from '../base/hooks.ts'
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts'
import { useMediaDegrade } from '../../hooks/useMediaDegrade.ts'
import { useVideoPoster } from '../../hooks/useVideoPoster.ts'
import LazyImage from '../base/LazyImage.tsx'
import VideoThumbnail from '../base/VideoThumbnail.tsx'
import ImageZoomDialog from '../base/ImageZoomDialog.tsx'
import { useGenerateNode } from '../../hooks/useGenerateNode.ts'
import { generateVideo } from '../base/api/index.ts'
import { useNodePrefs } from '../base/nodePrefs.ts'
import { logger } from '../base/logger.ts'
import { resolveProviderModel } from '../base/providerModels.ts'
import { debounce, buildEffectivePrompt, clampSeconds } from '../base/utils.ts'

/**
 * 视频生成节点（复刻原 As.jsx / discountVideoNode）
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
  const { setEdges, setNodes } = useReactFlow()
  // 标题改名 → 写回 data.label，让下游 @名 匹配 / 素材条显示跟随
  const rename = useCallback((name) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)))
  }, [id, setNodes])
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
  const effectivePrompt = buildEffectivePrompt(prompt, refTexts)
  // 【富文本芯片解析】prompt 里可能含 `@{id:label}` 素材芯片（图片 → 参考图，文本 → 纯文本）。
  // 生成前统一解析：chipResolved.text 是发给 AI 的纯文本；chipResolved.refImages 是用户显式 @ 的参考图。
  const connectedImages = connected.images || []
  const chipResolved = useMemo(
    () => resolvePromptChips(effectivePrompt, connectedImages, refTexts),
    [effectivePrompt, connectedImages, refTexts]
  )
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
  // 记住上次选择的模型/比例/分辨率/时长（跨节点/跨会话，与 PromptNode 一致）
  const { prefs: vidPrefs, set: setVidPrefs } = useNodePrefs('discountVideoNode', { model: '', size: '16:9', resolution: '1080p', seconds: '10' })
  // 记忆只影响新建（见 App.addNode 注入）；存量初始化只读 data，缺字段用纯常量。
  const [ratio, setRatio] = useState(data.size ?? '16:9')
  const [resolution, setResolution] = useState(data.resolution ?? '1080p')
  const [seconds, setSeconds] = useState(data.selectedSeconds ?? '10')
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '')
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
  const insertAssetRef = useRef(null) // 富文本素材插入：由 PromptInput onReady 上抛（主框 MaterialStrip 共用）
  const insertMention = (asset) => {
    if (typeof insertAssetRef.current === 'function') insertAssetRef.current(asset)
  }
  // 双击视频查看大图（原生 <dialog> + 原生 <video> 播放器）
  const [zoomUrl, setZoomUrl] = useState('')
  const zoomRef = useRef(null)
  const openVideoZoom = useCallback((url) => {
    if (!url) return
    setZoomUrl(url)
    requestAnimationFrame(() => zoomRef.current?.showModal())
  }, [])
  // 单击/双击区分：单击立即切抽屉、双击看大图。
  // 用两次 click 时间间隔识别双击：双击时第一次 click 已 toggle，第二次 click 拦截不 toggle，
  // 再由 dblclick 补一次 toggle 抵消，抽屉回到原位并打开大图。单击则只 toggle 一次，无延迟。
  const lastClickTime = useRef(0)
  const doubleClickPending = useRef(false)
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
  // 时长改为滑块（4~15s 自由选择，替代原来写死的 6 个预设按钮）。
  // 说明：视频 API 的 duration 原样透传不设上限，模型超过 4s 即可生成；合并生成视频时
  // 滑块初始值 = 选中镜头时长累加（selectedSeconds）。滑块值取整秒，超出预设直接可滑。
  const MIN_SECONDS = 4
  const MAX_SECONDS = 15

  // 供应商/模型 + 默认模型回填 + useNodeGeneration(统一契约) 收进 useGenerateNode（P0-2 收口）。
  // prefs/selectedModel 由本节点持有并传入（无死锁）；外部 data.videoUrl 变更同步也收进 sync。
  const { providers, primary, models, loading, error, stop: onStop, start: handleGenerate } = useGenerateNode({
    nodeId: id,
    type: 'video',
    // 上报用解析后的纯文本（芯片已替换为可读内容），与实发 chipResolved.text 一致
    prompt: chipResolved.text || effectivePrompt || '',
    data,
    prefs: vidPrefs,
    setPrefs: setVidPrefs,
    selectedModel,
    setSelectedModel,
    // 收编外部同步：Agent 更新 / 视频处理 spawn 写回 data.videoUrl → 同步本地 state（替手写 effect）
    sync: { videoUrl: setVideoUrl },
    resultField: 'videoUrl',
    recoverable: true,
    // 前置校验：本地 prompt（含芯片解析后的文本或参考图）或上游文本任一非空即可生成
    validate: () => ((effectivePrompt?.trim() || chipResolved.refImages.length > 0) ? '' : '请输入提示词'),
    run: async ({ progress, signal, taskId }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(providers, selectedModel, primary)
      // 参考图 = 用户显式 @ 的芯片图（顺序对应 prompt 里的「图片N」）+ 其余连线上游图（去重）
      const chipUrls = chipResolved.refImages.map((im) => im.url)
      const upstreamUrls = connectedImages.map((img) => img.url)
      const refUrls = [...new Set([...chipUrls, ...upstreamUrls])]
      // signal 支持真取消（Step C）
      return generateVideo({
        provider: useProvider,
        // 芯片解析后的纯文本（图片芯片已替换为「图片N」，文本芯片已替换为纯文本）
        prompt: chipResolved.text || effectivePrompt || '',
        model: modelId,
        size: ratio,
        resolution,
        seconds,
        images: refUrls,
        taskId, // P0-A 请求级贯穿
      }, (pct, stage) => progress(Math.max(10, Math.min(98, Math.round(pct))), stage), signal)
    },
    onSuccess: (r) => {
      setVideoUrl(r.url)
      // 【真相源契约】data.videoUrl 写回由声明式 resultField:'videoUrl' 自动完成（经 useNodeData，随画布快照落盘）。
      // 此回调只负责本地 state 同步与业务记忆。
      setVidPrefs({ model: selectedModel, size: ratio, resolution, seconds })
    },
    // 【精准节点回填】异步视频任务刷新后恢复轮询完成的广播 → 节点卡片自动恢复显示（data 回填由 recoverable 自动，此处同步本地 state 供渲染/下载）。
    onRecover: ({ resultUrl }) => {
      setVideoUrl(resultUrl)
    },
  })

  const onUpload = () => fileRef.current?.click()

  // 下载当前视频（<a download> 触发浏览器保存；文件名推导走统一 resolveDownloadFilename，label 缺扩展名补 .mp4）
  const handleDownload = () => {
    if (!videoUrl) return
    downloadUrl(videoUrl, resolveDownloadFilename(data.label, videoUrl, { ext: 'mp4', fallback: 'video.mp4' }))
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
      defaultTitle="视频生成"
      icon={<Clapperboard size={11} className="text-muted" />}
      selected={selected}
      minWidth={200}
      minHeight={200}
      aspectRatio={ratio}
      sizeMode="area-fixed"
      baseSize={NODE_AREA_FIXED_BASE_SIZE}
      className="min-w-[200px] min-h-[200px]"
      onRename={rename}
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
        onClick={() => {
          const now = Date.now()
          // 两次 click 间隔很短 → 是双击的第二次 click，拦截（不 toggle，交给 dblclick 补偿）
          if (now - lastClickTime.current < 300) {
            doubleClickPending.current = true
            lastClickTime.current = now
            return
          }
          lastClickTime.current = now
          doubleClickPending.current = false
          toggleExpanded()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          // 双击：第一次 click 已 toggle 一次，这里补一次 toggle 抵消 → 抽屉回到原位，再打开大图
          if (doubleClickPending.current) {
            toggleExpanded()
            doubleClickPending.current = false
          }
          // 有视频才打开大图预览（系统原生 <video> 播放器）
          if (videoUrl) openVideoZoom(videoUrl)
        }}
      >
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${videoUrl ? '' : 'bg-surface-muted'}`}>
          {/* 性能模式媒体降级：缩小时隐藏视频（复刻官方"图片视频已隐藏"） */}
          {videoUrl && !loading && !error && hideVideo && (
            <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-surface-muted">
              <Clapperboard size={24} className="text-muted" />
              <span className="text-caption text-muted">性能模式已隐藏</span>
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
              className={`w-full h-full ${loading ? 'opacity-50 blur-sm' : ''}`}
              onActivate={() => videoRef.current?.play()}
              onDoubleClick={() => openVideoZoom(videoUrl)}
            />
          )}
          {loading && (
            <GeneratingOverlay label="生成中..." backgroundUrl={videoUrl} category="video" />
          )}
          {!videoUrl && !loading && !error && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted pointer-events-none">
              <Clapperboard size={80} className="text-muted" strokeWidth={1.2} />
            </div>
          )}
          {error && !loading && !videoUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-surface p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-caption font-medium max-w-full break-words">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。 */}
      <ExpandablePanel expanded={expanded} minWidth={500}>
        <div className="space-y-3">
          {/* 素材缩略图区（通用组件 MaterialStrip，以生图节点为标准） */}
          <MaterialStrip images={connected.images} texts={connected.texts} onInsert={insertMention} onDisconnect={disconnectSource} />

          {/* 提示词输入（基座 PromptInput，富文本芯片） */}
          <PromptInput
            ref={promptInputRef}
            value={prompt}
            onChange={setPromptPersist}
            placeholder="描述你想要的视频内容 (输入 @ 调出素材)..."
            refImages={connected.images}
            refTexts={connected.texts}
            onInsert={insertMention}
            onReady={(fn) => { insertAssetRef.current = fn }}
            richText
            inputWidth={data.inputWidth}
            inputHeight={data.inputHeight}
          />

          {/* 底部控制 */}
          <div className="flex items-center justify-between pt-2 border-t border-edge-faint nodrag">
            <div className="flex items-center gap-1.5 overflow-visible z-dropdown">
              {/* 比例/分辨率/时长（ref 绑外层 relative，点外部才关） */}
              <div ref={ratioMenuRef} className="relative nodrag flex items-center">
                <button
                  className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setShowRatioMenu((v) => !v) }}
                  title="选择比例和时长"
                >
                  <Settings size={12} className="opacity-70" />
                  <span className="whitespace-nowrap">{ratio} · {resolution} · {seconds}s</span>
                </button>
                {showRatioMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-72 bg-surface-1 border border-edge rounded-lg shadow-popover p-3 z-dropdown flex flex-col gap-3 max-h-none overflow-visible nopan nodrag" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-caption text-muted mb-2 px-1">比例</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {ratioOptions.map((o) => (
                          <button key={o.value} className={`px-3 py-1.5 text-caption-sm rounded-md transition-colors ${ratio === o.value ? 'bg-surface-3 text-white' : 'bg-surface-raised text-secondary hover:bg-surface-hover hover:text-primary'}`} onClick={() => { setRatio(o.value); setVidPrefs({ size: o.value }) }}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2 px-1">分辨率</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {resOptions.map((r) => (
                          <button key={r} className={`px-3 py-1.5 text-caption-sm rounded-md transition-colors ${resolution === r ? 'bg-surface-3 text-white' : 'bg-surface-raised text-secondary hover:bg-surface-hover hover:text-primary'}`} onClick={() => { setResolution(r); setVidPrefs({ resolution: r }) }}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2 px-1">时长 (秒)</div>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-caption-sm text-white font-medium tabular-nums shrink-0 text-center bg-surface-3 rounded px-2 py-0.5">{seconds}s</span>
                        <span className="text-caption-sm text-muted tabular-nums shrink-0">{MIN_SECONDS}s</span>
                        <input
                          type="range"
                          min={MIN_SECONDS}
                          max={MAX_SECONDS}
                          step={1}
                          value={clampSeconds(seconds, MIN_SECONDS, MAX_SECONDS)}
                          onChange={(e) => { const v = String(e.target.value); setSeconds(v); setVidPrefs({ seconds: v }) }}
                          className="nodrag accent-blue-500 w-32 shrink-0"
                        />
                        <span className="text-caption-sm text-muted tabular-nums shrink-0">{MAX_SECONDS}s</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模型选择（基座 ModelSelect） */}
              <ModelSelect value={selectedModel} onChange={setSelectedModel} models={models} />

              {/* 预设提示词：打开提示词库弹窗 → 可追加到当前提示词或新建文本节点 */}
              <PromptLibraryButton
                category="video"
                onAppend={(p) => setPromptPersist((prev) => (prev ? `${prev}\n${p}` : p))}
              />
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

      {/* 全屏弹层：提示词输入框双击 → 全屏编辑提示词（统一组件，富文本芯片） */}
      <FullscreenEditor
        open={fullscreenPrompt}
        onClose={() => setFullscreenPrompt(false)}
        variant="prompt"
        value={prompt}
        onChange={setPromptPersist}
        placeholder="描述你想要的视频内容 (输入 @ 调出素材)..."
        refImages={connected.images}
        refTexts={connected.texts}
        onInsert={insertMention}
        onDisconnect={disconnectSource}
        richText
      />

      {/* 双击视频查看大图：原生 <dialog> + 系统原生 <video> 播放器 */}
      <ImageZoomDialog ref={zoomRef} url={zoomUrl} kind="video" />
    </NodeShell>
  )
}
export default React.memo(DiscountVideoNode)
