import React, { useState, useEffect, useRef } from 'react'
import { Clapperboard, Settings, Maximize2, Loader2 } from 'lucide-react'
import { Handle } from '@xyflow/react'
import NodeShell from '../base/NodeShell.jsx'
import CustomHandle from '../edges/CustomHandle.jsx'
import FullscreenModal from '../base/FullscreenModal.jsx'
import { useScriptBoxEngine } from '../base/useScriptBoxEngine.js'
import { useConnectedInputs } from '../base/useConnectedInputs.js'
import { useOutsideClick, useContentHeightSync } from '../base/hooks.js'
import StepShots from '../scriptbox/StepShots.jsx'
import StepAssets from '../scriptbox/StepAssets.jsx'
import StepPrompt from '../scriptbox/StepPrompt.jsx'
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

  // —— 上游输入接入（智能接受文本节点，接入剧情） ——
  // 用 useConnectedInputs 读取「直接连到本剧本盒子」的上游文本（如 textNode 生成的文本），
  // 作为剧情来源之一。设计：上游文本写入独立字段 data.upstreamStory，不覆盖用户手动输入的
  // data.story；生成剧本时引擎会把两者合并（见 scriptBoxEngine.onGenerateScript）。
  const connected = useConnectedInputs(id)
  const upstreamText = (connected.texts || []).map((t) => (t.text || '').trim()).filter(Boolean).join('\n\n')
  useEffect(() => {
    // 上游文本变化时同步到 data.upstreamStory（不覆盖用户手填的 data.story）。
    // 断线（upstreamText 为空）时清除残留的上游剧情，避免旧文本一直混入生成。
    if (upstreamText && d.upstreamStory !== upstreamText) {
      updateData({ upstreamStory: upstreamText })
    } else if (!upstreamText && d.upstreamStory) {
      updateData({ upstreamStory: '' })
    }
  }, [upstreamText, d.upstreamStory, updateData])

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
  // 外框自适应收口到 useContentHeightSync（ref 防抖 + rAF 打破 ResizeObserver 同帧循环告警）
  useContentHeightSync(contentRef, id, { minHeight: 600, fallbackWidth: 900 })

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
  const stepProps = { id, data: d, updateData, callbacks: d }

  return (
    <NodeShell
      id={id}
      label={d.label}
      defaultTitle="剧本盒子"
      icon={<Clapperboard size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      showHandles={false}
      aspectRatio={null}
      minWidth={900}
      minHeight={600}
      className="min-w-[900px]"
      style={{ minHeight: 600, width: 900, minWidth: 900 }}
    >
      {/* 主容器：背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局（标题栏+导航+内容）。
          relative：作为剧本盒子内部所有弹窗（资产抽屉/编辑框/设置弹窗）的绝对定位基准。
          高度用 contentRef 自适应（无限画布：内容撑开时写回 node.height，外框跟随）。 */}
      <div ref={contentRef} className="relative flex flex-col w-full min-h-0">
        {/* 输入端口（左侧 target，handleId='in'）：接收上游文本/剧情接入。
            showHandles={false} 已关闭 NodeShell 默认端口，这里显式补一个可连的输入口，
            让 textNode 等文本类上游能拖线连入剧本盒子作为剧情来源。 */}
        <CustomHandle position="left" variant="small" handleId="in" top="50%" />

        {/* 顶部标题栏 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] w-full drag-handle cursor-move shrink-0">
          <Clapperboard size={14} className="text-gray-500" />
          <span className="text-body-sm text-gray-300 font-medium">{d.projectName || '剧本盒子'}</span>
          {genMask && (
            <span className="flex items-center gap-1.5 text-caption-sm text-gray-400 bg-surface-subtle px-2.5 py-1 rounded-full">
              <Loader2 size={11} className="animate-spin text-emerald-400" />
              生成中 {d.genChars || 0} 字 · {genSecs}s
            </span>
          )}
          <div className="flex-1" />
          <button className="p-1 text-gray-400 hover:text-white hover:bg-surface-hover rounded-md" title="总体提示词设置" onClick={(e) => { e.stopPropagation(); setSettingsOpen(true) }}>
            <Settings size={13} />
          </button>
          <button className="p-1 text-gray-400 hover:text-white hover:bg-surface-hover rounded-md" title="全屏显示" onClick={(e) => { e.stopPropagation(); setFullscreen(true) }}>
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
          `!h-0 !w-0 !bg-transparent`），仅作 React Flow 注册锚点，连线视觉上从节点右侧出发。 */}
      {(d.shots || []).map((s) => (
        <Handle
          key={s.id}
          type="source"
          position="right"
          id={`shot-${s.id}`}
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

      {/* 全屏弹层 */}
      <FullscreenModal open={fullscreen} title={d.projectName || '剧本盒子'} onClose={() => setFullscreen(false)}>
        <div className="flex-1 flex flex-col min-h-0 overflow-auto">
          {step === 1 && <StepShots {...stepProps} />}
          {step === 2 && <StepAssets {...stepProps} />}
          {step === 3 && <StepPrompt {...stepProps} />}
        </div>
      </FullscreenModal>
    </NodeShell>
  )
}

/** 三步圆环导航（进度环：镜头/资产/提示词 完成度） */
function StepNav({ step, setStep, shots, assets }) {
  const t = (shots || []).length
  const n = (assets || []).length
  const i = (assets || []).filter((a) => a.has).length
  const a = (shots || []).filter((s) => s.prompt || s.videoPrompt).length
  const steps = [
    { n: 1, title: '确认镜头', desc: t ? `${t}镜头` : '暂无镜头', p: +(t > 0) },
    { n: 2, title: '准备资产', desc: n ? `${i}/${n}` : '暂无资产', p: n ? i / n : 0 },
    { n: 3, title: '合成提示词', desc: t ? `${a}/${t}` : '暂无镜头', p: t ? a / t : 0 }
  ]
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 shrink-0">
      {steps.map((s, k) => {
        const active = step === s.n
        const off = 2 * Math.PI * 11 * (1 - s.p)
        return (
          <React.Fragment key={s.n}>
            <button className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${active ? 'bg-surface-hover' : 'hover:bg-surface-1'}`} onClick={() => setStep(s.n)}>
              <svg width="28" height="28" className="shrink-0">
                <circle cx="14" cy="14" r="11" fill="none" stroke={active ? '#3a3a3a' : '#2a2a2a'} strokeWidth="2" />
                <circle cx="14" cy="14" r="11" fill="none" stroke={active ? '#fff' : '#666'} strokeWidth="2" strokeDasharray={2 * Math.PI * 11} strokeDashoffset={off} transform="rotate(-90 14 14)" style={{ transition: 'all .3s' }} />
                <text x="14" y="18" textAnchor="middle" fontSize="11" fontWeight="600" fill={active ? '#fff' : '#9ca3af'}>{s.n}</text>
              </svg>
              <span className="text-left">
                <span className={`block text-body-xs font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{s.title}</span>
                <span className="block text-caption text-gray-500">{s.desc}</span>
              </span>
            </button>
            {k < steps.length - 1 && <div className="w-10 h-px bg-surface-hover-strong" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}
export default React.memo(ScriptBoxNode)
