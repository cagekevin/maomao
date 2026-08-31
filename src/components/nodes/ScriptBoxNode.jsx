import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Clapperboard, Settings, Maximize2, Loader2 } from 'lucide-react'
import { Handle, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import NodeShell from '../base/NodeShell.tsx'
import CustomHandle from '../edges/CustomHandle.tsx'
import { useScriptBoxEngine } from '../../hooks/useScriptBoxEngine.ts'
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts'
import { useOutsideClick, useContentHeightSync } from '../base/hooks.ts'
import { shotHandleId } from '../base/contracts.js'
import StepShots from '../scriptbox/StepShots.tsx'
import StepAssets from '../scriptbox/StepAssets.tsx'
import StepPrompt from '../scriptbox/StepPrompt.tsx'
import StepNav from '../scriptbox/StepNav.tsx'
import ScriptBoxFullscreen from '../scriptbox/ScriptBoxFullscreen.tsx'
import GearSettings from '../scriptbox/GearSettings.jsx'

/**
 * 剧本盒子（scriptBoxNode）—— 复刻 c_.jsx，按 docs/剧本盒子 的职责架构实现。
 *
 * 数据模型：单一数据源 node.data（shots/assets/配置 + 9 个 onXxx 引擎回调）。
 * 职责铁律：
 *  - 本组件只「读 node.data」（直接读 data prop），任何编辑都经 useScriptBoxEngine.updateData 写回；
 *  - 任何「生成/连线」都只调 d.onXxx?.(...)（引擎回调），本组件不做计算；
 *  - 引擎回调由 useScriptBoxEngine 注入 node.data.onXxx（经 setNodes/addNodes/坐标写回）；
 *  - 引擎（scriptBoxEngine.js）不依赖 UI，经 setNodes 写回；纯函数（scriptBoxPrompts.js）无副作用。
 *
 * 三步状态机：①确认镜头 ②准备资产 ③合成提示词（可点击切换，不自动连跑）。
 */
function ScriptBoxNode({ id, data, selected }) {
  // 引擎：创建并注入 node.data.onXxx（含连线，能建下游），并返回统一写回通道 updateData。
  // 写回经 updateData（对象或函数式 patch，并发安全）；生成/连线只调 d.onXxx?.(...)，本组件不做引擎。
  const { updateData } = useScriptBoxEngine(id, data)

  const d = data || {}

  // —— 上游输入接入（与文本节点一致：接受上游文本节点 + 图片节点） ——
  // 用 useConnectedInputs 读取「直接连到本剧本盒子」的上游文本/图片，
  // 作为剧情来源其中之一。上游文本写入 data.upstreamStory（合并串）+ data.upstreamTexts（条目数组）、
  // 图片写入 data.upstreamImages，均不覆盖用户手动输入的 data.story。
  // 展示交给第 1 步的 StepShots（剧情上方只读素材区）；生成剧本时引擎把上游内容一起交给编剧模型
  //（见 engine.onGenerateScript），让 AI 能「知道我产品外观」从而写出准确剧本。
  const { setEdges } = useReactFlow()
  const connected = useConnectedInputs(id)
  const upstreamTexts = (connected.texts || []).map((t) => (t.text || '').trim()).filter(Boolean).join('\n\n')
  useEffect(() => {
    // 上游文本/图片变化时同步到 data（断线后按空清理，避免旧内容一直混入生成）。
    const patch = {}
    const curText = d.upstreamStory || ''
    if (upstreamTexts && upstreamTexts !== curText) patch.upstreamStory = upstreamTexts
    else if (!upstreamTexts && curText) patch.upstreamStory = ''
    const imgList = (connected.images || [])
      .map((im, i) => (im && im.url ? { id: im.id || `up-img-${i}`, url: im.url, label: im.label || '', sourceNodeId: im.sourceNodeId } : null))
      .filter(Boolean)
    const curImgs = d.upstreamImages || []
    const sameImgs = imgList.length === curImgs.length && imgList.every((im, i) => curImgs[i] && curImgs[i].url === im.url)
    if (!sameImgs) patch.upstreamImages = imgList
    const txtList = (connected.texts || [])
      .map((t, i) => (t && t.text ? { id: t.id || `up-txt-${i}`, label: t.label || '', text: t.text, sourceNodeId: t.sourceNodeId } : null))
      .filter(Boolean)
    const curTxts = d.upstreamTexts || []
    const sameTxts = txtList.length === curTxts.length && txtList.every((t, i) => curTxts[i] && curTxts[i].text === t.text)
    if (!sameTxts) patch.upstreamTexts = txtList
    if (Object.keys(patch).length) updateData(patch)
  }, [upstreamTexts, d.upstreamStory, d.upstreamImages, d.upstreamTexts, connected, updateData])

  // 断开连线：点击只读素材区红色 × → 删除该来源节点 → 本节点的连线（对齐文本节点）。
  const disconnectSource = useCallback(
    (sourceNodeId) => {
      if (!sourceNodeId) return
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)))
    },
    [id, setEdges]
  )

  // —— UI 状态（非数据，放组件本地） ——
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const settingsRef = useRef(null)
  useOutsideClick(settingsRef, settingsOpen, () => setSettingsOpen(false))

  // —— 外框自适应（无限画布：内容撑开时，节点高度跟随，外框不溢出） ——
  // 为什么：这是无限画布，剧本盒子内容（镜头/资产）多时不能在一个固定高度里滚动（用户否了滚动方案），
  // 而要「内容自然撑开 → 节点高度跟随 → 外框贴合内容」。用 ResizeObserver 监听主容器高度变化，
  // 写回 node.height + updateNodeInternals，让 ReactFlow 节点 wrapper（含端口定位）也跟随。
  // 注意：必须去掉固定 height（只留 minHeight），否则根 div 高度被锁死、内容溢出到框外。
  const contentRef = useRef(null)
  // NodeShell 根 div ref：useContentHeightSync 需测「含标题栏的完整节点」而非仅内容区，
  // 否则写回的 node.height 偏矮（漏标题栏），节点框高度与端口定位基准不一致。
  const wrapperRef = useRef(null)
  // 输入端口经 NodeShell 的 overlayHandles 插槽挂在「整个节点」上（定位基准含标题栏），
  // 使其相对整个节点定位在 50% 中点，而不是相对内容区（contentRef）。内容区高度随三步
  // （StepShots/StepAssets/StepPrompt）变化，若相对内容区 top:50% 会导致端口在不同步骤
  // 跑到不同高度，无法固定在节点框正中。
  //
  // ⚠️ 分镜端口（shot-${id}）随 shots 增删而变，但节点高度不一定跟着变（等高替换镜头）→
  // React Flow 不会自动重新测量（它只在节点尺寸/type/位置变化时重测，见 @xyflow/react
  // 的 useNodeObserver）→ 新增的 shot 端口进不了 handleBounds，引擎紧接着建的边会报
  // code-008「Couldn't create edge for source handle」且不渲染。这里在「镜头 id 列表」
  // 变化时显式 updateNodeInternals 强制重测；key 用 id 列表而非 shots 数组，
  // 避免镜头任意字段（提示词/图片）变动都触发重测。
  const updateNodeInternals = useUpdateNodeInternals()
  const shotsKey = (d.shots || []).map((s) => String(s.id)).join(',')
  useEffect(() => {
    if (shotsKey) updateNodeInternals(id)
  }, [shotsKey, id, updateNodeInternals])
  // 外框自适应收口到 useContentHeightSync（ref 防抖 + rAF 打破 ResizeObserver 同帧循环告警）
  useContentHeightSync(contentRef, id, { minHeight: 600, fallbackWidth: 900, syncWidth: true, wrapperRef })

  // 生成遮罩计时
  const genMask = !!d.genMask
  const [genSecs, setGenSecs] = useState(0)
  useEffect(() => {
    if (!genMask) return
    setGenSecs(0)
    const t = setInterval(() => setGenSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [genMask])

  const step = d.step || 1
  const setStep = (n) => updateData({ step: n })

  // 三步组件只调 d.onXxx?.(...)（引擎回调，由 useScriptBoxEngine 注入 node.data.onXxx）。
  // callbacks 追加断线回调（onDisconnectUpstream），供第 1 步 StepShots 的上游只读素材区断线用。
  const stepProps = { id, data: d, updateData, callbacks: { ...d, onDisconnectUpstream: disconnectSource } }

  return (
    <NodeShell
      id={id}
      label={d.label}
      defaultTitle="剧本盒子"
      icon={<Clapperboard size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      showHandles={false}
      aspectRatio={null}
      minWidth={900}
      minHeight={600}
      className="min-w-[900px]"
      style={{ minHeight: 600, width: 900, minWidth: 900 }}
      wrapperRef={wrapperRef}
      // 输入端口（左侧 target，handleId='in'）：接收上游文本节点 + 图片节点接入。
      // showHandles={false} 已关闭 NodeShell 默认端口，这里显式补一个可连的输入口，
      // 让 textNode 等文本/图片类上游能拖线连入剧本盒子，作为编剧参考（第 1 步展示、传给 AI）。
      // ⚠️ 必须走 overlayHandles（挂 NodeShell 根 div）而不是 createPortal 延迟挂载：
      // 延迟挂载时端口在首帧后才进 DOM，而 React Flow 只在节点尺寸/type/位置变化时重测
      // handleBounds → 'in' 永远进不了 handleBounds → 指向它的边每次渲染都报
      // code-008「Couldn't create edge for target handle id: "in"」且边不渲染（实测复现）。
      // 走 overlayHandles 首帧即在 DOM 中，首次测量就带上 'in'。
      overlayHandles={<CustomHandle position="left" variant="small" handleId="in" top="50%" />}
    >
      {/* 主容器：背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局（标题栏+导航+内容）。
          relative：作为剧本盒子内部所有弹窗（资产抽屉/编辑框/设置弹窗）的绝对定位基准。
          高度用 contentRef 自适应（无限画布：内容撑开时写回 node.height，外框跟随）。 */}
      <div ref={contentRef} className="relative flex flex-col w-full min-h-0">
        {/* 顶部标题栏 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] w-full drag-handle cursor-move shrink-0">
          <Clapperboard size={14} className="text-muted" />
          <span className="text-body-sm text-body font-medium">{d.projectName || '剧本盒子'}</span>
          {genMask && (
            <span className="flex items-center gap-1.5 text-caption-sm text-secondary bg-surface-subtle px-2.5 py-1 rounded-full">
              <Loader2 size={11} className="animate-spin text-emerald-400" />
              生成中 {d.genChars || 0} 字 · {genSecs}s
            </span>
          )}
          <div className="flex-1" />
          <button className="p-1 text-secondary hover:text-white hover:bg-surface-hover rounded-md" title="总体提示词设置" onClick={(e) => { e.stopPropagation(); setSettingsOpen(true) }}>
            <Settings size={13} />
          </button>
          <button className="p-1 text-secondary hover:text-white hover:bg-surface-hover rounded-md" title="全屏显示" onClick={(e) => { e.stopPropagation(); setFullscreen(true) }}>
            <Maximize2 size={13} />
          </button>
        </div>

        {/* 三步导航 */}
        <StepNav step={step} setStep={setStep} shots={d.shots} assets={d.assets} />

        {/* 三步内容：不裁剪不滚动（无限画布），让内容自然撑开，节点高度自适应内容 */}
        <div className="relative px-4 pb-4 min-h-0 overflow-visible" onClick={(e) => e.stopPropagation()}>
          {step === 1 && <StepShots {...stepProps} />}
          {step === 2 && <StepAssets {...stepProps} />}
          {step === 3 && <StepPrompt {...stepProps} />}
          {/* 步骤1生成剧本不整节点遮罩：只用顶部标题栏的「生成中」spinner+计时（见标题栏 genMask），
              避免和步骤3的卡片级动画混成两套。步骤3分镜提示词的动画是卡片级的（StepPrompt cardFor）。 */}
        </div>
      </div>

      {/* 恒定注册每个分镜的 source handle（对齐官方 c_.jsx：节点根部恒定渲染所有 shot- 端口）。
          为什么恒定：这些端口不随「步骤」切换而卸载，从剧本盒子 source 出发的边永远能锚到
          `shot-${id}` handle，杜绝「切到第1/2步时分镜卡片卸载 → handle 消失 → React Flow
          setEdges 报 008 Couldn't create edge for source handle」。样式隐藏（对齐官方迷你视图
          `!h-0 !w-0 !bg-transparent`），仅作 React Flow 注册锚点，连线视觉上从节点右侧出发。
          id 走 contracts.shotHandleId（与读侧 parseShotHandle 成对，前缀唯一事实来源）。 */}
      {(d.shots || []).map((s) => (
        <Handle
          key={s.id}
          type="source"
          position="right"
          id={shotHandleId(s.id)}
          className="!absolute !h-0 !w-0 !min-w-0 !min-h-0 !border-0 !bg-transparent !opacity-0"
          style={{ right: 0, top: '50%' }}
        />
      ))}

      {/* 齿轮设置弹窗 */}
      {settingsOpen && (
        <div ref={settingsRef}>
          <GearSettings data={d} updateData={updateData} onClose={() => setSettingsOpen(false)} />
        </div>
      )}

      {/* 全屏工作台视图（脚本盒子自包含，真全屏 100vw×100vh，三步都在内） */}
      <ScriptBoxFullscreen
        open={fullscreen}
        title={d.projectName || '剧本盒子'}
        data={d}
        updateData={updateData}
        callbacks={d}
        onClose={() => setFullscreen(false)}
      />
    </NodeShell>
  )
}

export default React.memo(ScriptBoxNode)
