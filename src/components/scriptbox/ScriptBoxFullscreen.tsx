import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clapperboard, Settings, X, Loader2 } from 'lucide-react'
import StepNav from './StepNav.tsx'
import StepShots from './StepShots.tsx'
import StepAssets from './StepAssets.tsx'
import StepPrompt from './StepPrompt.tsx'
import GearSettings from './GearSettings.tsx'
import { toastInfo } from '../base/core/toastStore.ts'
import type { ScriptBoxData, ScriptBoxUpdateData, ScriptBoxCallbacks } from './scriptBoxSchema.ts'

interface ScriptBoxFullscreenProps {
  open: boolean
  title?: string
  data?: ScriptBoxData
  updateData: ScriptBoxUpdateData
  callbacks: ScriptBoxCallbacks
  onClose: () => void
}

/**
 * 剧本盒子 —— 全屏工作台视图（自包含，替代通用 base/FullscreenModal 的浮窗卡片）。
 *
 * 背景：用户要求「点全屏后整个应用变成一个全屏网页，三步都在里面」。通用 FullscreenModal
 * 是浮窗（可缩放卡片、只占屏 80%、无导航），被 TextNode/PromptNode 等共用，不能改它。
 * 故剧本盒子专属全屏视图收口在本组件：
 *  - createPortal 挂到 body，`fixed inset-0` 铺满 100vw×100vh（真全屏，无边框/无缩放手柄）
 *  - 顶部标题栏 + StepNav 三步导航 + 三步内容（StepShots/StepAssets/StepPrompt）
 *  - 与窗口模式共用 StepNav 与三步组件，保证两种视图 UI 一致
 *  - 数据/引擎零改动：纯渲染，靠 props ({ data, updateData, callbacks }) 驱动同一份 node.data
 *
 * @param props
 *  - open        是否打开
 *  - title       标题栏文本（项目名）
 *  - data        节点 node.data（data.read 读全量，含 step/shots/assets）
 *  - updateData  写回通道（来自 useScriptBoxEngine）
 *  - callbacks   引擎回调（node.data.onXxx 生成/连线）
 *  - onClose     关闭回调（Esc / 关闭按钮）
 */
export default function ScriptBoxFullscreen({ open, title = '剧本盒子', data, updateData, callbacks, onClose }: ScriptBoxFullscreenProps) {
  const d = (data ?? ({} as ScriptBoxData))
  const step = d.step || 1
  const setStep = (n: number) => updateData({ step: n })
  // 三步组件契约统一为 ({ data, updateData, callbacks })，窗口/全屏完全复用
  const stepProps: { data: ScriptBoxData; updateData: ScriptBoxUpdateData; callbacks: ScriptBoxCallbacks } = { data: d, updateData, callbacks }
  // 全屏内的总体设置弹窗（与窗口模式共用 GearSettings）
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 生成遮罩计时（与 ScriptBoxNode 标题栏一致：全屏后仍能看见「生成中」动画）
  const genMask = !!d.genMask
  const [genSecs, setGenSecs] = useState(0)

  // 关闭包装：生成中关闭全屏时告知生成仍在后台进行（引擎异步、不随全屏关闭中断），
  // 避免用户误以为生成已取消/数据丢失
  const handleClose = () => {
    if (genMask) toastInfo('生成仍在后台进行，关闭后可在节点内查看进度')
    onClose()
  }
  useEffect(() => {
    if (!genMask) return
    setGenSecs(0)
    const t = setInterval(() => setGenSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [genMask])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, genMask])

  if (!open) return null

  return createPortal(
    <div data-testid="fullscreen" className="fixed inset-0 z-ceiling-2 bg-surface-raised flex flex-col nodrag" onWheel={(e) => e.stopPropagation()}>
      {/* 顶部标题栏（与节点内标题栏一致，无自定义底色） */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] shrink-0">
        <Clapperboard size={14} className="text-muted" />
        <span className="text-body-sm text-body font-medium">{title}</span>
        {genMask && (
          <span className="flex items-center gap-1.5 text-caption-sm text-secondary bg-surface-subtle px-2.5 py-1 rounded-full">
            <Loader2 size={11} className="animate-spin text-emerald-400" />
            生成中 {String(d.genChars || 0)} 字 · {genSecs}s
          </span>
        )}
        <div className="flex-1" />
        <span className="text-caption-sm text-muted">Esc 关闭</span>
        <button className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded transition-colors" title="总体提示词设置" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
        </button>
        <button className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded transition-colors" title="关闭全屏" onClick={handleClose}>
          <X size={16} />
        </button>
      </div>

      {/* 三步导航 */}
      <StepNav step={step} setStep={setStep} shots={d.shots} assets={d.assets} />

      {/* 三步内容：纵向铺满剩余空间，内部滚动（背景统一由外层 surface 提供） */}
      <div className="flex-1 min-h-0 px-4 pb-4 overflow-auto custom-scrollbar">
        {step === 1 && <StepShots {...stepProps} />}
        {step === 2 && <StepAssets {...stepProps} />}
        {step === 3 && <StepPrompt {...stepProps} />}
      </div>

      {/* 总体设置弹窗：absolute inset-0 相对全屏根容器定位，覆盖整个全屏 */}
      {settingsOpen && <GearSettings data={d} updateData={updateData} onClose={() => setSettingsOpen(false)} />}
    </div>,
    document.body
  )
}