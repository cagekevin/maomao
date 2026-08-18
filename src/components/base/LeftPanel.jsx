import React, { useMemo, useEffect, useRef } from 'react'
import { Clock, FolderOpen, Sparkles, Pin, PinOff, BookOpen } from 'lucide-react'
import TaskCenter from './TaskCenter.jsx'
import GeneratedView from './GeneratedView.jsx'
import AssetLibrary from './AssetLibrary.jsx'
import PromptHub from './PromptHub.jsx'
import { useTasks, usePanel, setPanel, getPanel, togglePin } from './taskStore.js'
import { useAssets } from './assetStore.js'

// tab 配置：任务 / 生成 / 素材 / 提示词库
const TABS = [
  { key: 'tasks', label: '任务', icon: Clock },
  { key: 'generated', label: '生成', icon: Sparkles },
  { key: 'assets', label: '素材', icon: FolderOpen },
  { key: 'prompts', label: '提示词', icon: BookOpen }
]

/**
 * 左侧滑出面板：收起态是一条竖着的窄工具栏（图标 + 未读角标），
 * 点击图标滑出面板，内部用 tab 切换「任务中心 / 素材库」。
 * 点击面板外部 → 收起；点击收起箭头 → 收起。
 *
 * 展开/活动 tab 状态存于全局（taskStore.usePanel），使「生成任务时自动弹出任务中心」
 * （reportGenerate → openTaskCenter）能控制本面板。
 */
export default function LeftPanel() {
  const { expanded, activeTab, pinned } = usePanel()
  const setActiveTab = (key) => setPanel({ activeTab: key })
  const setExpanded = (v) => setPanel({ expanded: v })
  const tasks = useTasks()
  const assets = useAssets()
  const panelRef = useRef(null)

  // 未读角标：失败任务数 + 进行中任务数
  const badgeCount = useMemo(() => tasks.filter((t) => t.status === 'failed' || t.status === 'running' || t.status === 'queued').length, [tasks])

  // 点面板外部收起
  useEffect(() => {
    if (!expanded) return
    const onDown = (e) => {
      // 钉住态：点击面板外部不收起
      if (getPanel().pinned) return
      if (panelRef.current && !panelRef.current.contains(e.target)) setExpanded(false)
    }
    // 延时注册，避免展开瞬间的点击误关
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', onDown) }
  }, [expanded])

  // 收起时同步保存当前 tab
  const openTab = (key) => {
    setActiveTab(key)
    setExpanded(true)
  }

  return (
    <>
      {/* 收起态：左侧竖条工具栏 */}
      {!expanded && (
        <div className="fixed left-3 top-1/2 -translate-y-1/2 z-sidebar flex flex-col items-center gap-1.5 bg-[#191919]/90 backdrop-blur border border-edge-faint rounded-xl px-1.5 py-2 shadow-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const showBadge = tab.key === 'tasks' && badgeCount > 0
            return (
              <button
                key={tab.key}
                className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer border-none ${isActive ? 'bg-surface-hover text-white' : 'text-muted hover:text-white hover:bg-surface-subtle'}`}
                title={tab.label}
                onClick={() => openTab(tab.key)}
              >
                <Icon size={17} />
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-meta font-semibold flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 展开态：滑出面板 */}
      {expanded && (
        <div ref={panelRef} className="fixed left-3 top-2 bottom-2 z-sidebar w-[330px] bg-input border border-edge-faint rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-panel-in">
          {/* 顶栏：tab 切换 + 钉住按钮 */}
          <div className="h-[52px] border-b border-edge-subtle flex items-center pl-3 pr-2 gap-1 flex-shrink-0">
            <div className="flex-1 flex gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-[34px] rounded-lg text-body-sm transition-colors cursor-pointer border-none ${isActive ? 'bg-surface-1 text-white font-medium' : 'text-muted hover:text-body hover:bg-surface-faint'}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            {/* 钉住按钮：钉住后点击面板外部不自动收起 */}
            <button
              title={pinned ? '已钉住（点击取消，点击外部不再自动关闭）' : '钉住面板（点击外部不再自动关闭）'}
              aria-pressed={pinned}
              className={`ml-1 w-[34px] h-[34px] flex items-center justify-center rounded-lg transition-colors cursor-pointer border-none ${pinned ? 'text-blue-400 bg-surface-1' : 'text-muted hover:text-body hover:bg-surface-faint'}`}
              onClick={togglePin}
            >
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 min-h-0">
            {activeTab === 'tasks' ? <TaskCenter />
              : activeTab === 'generated' ? <GeneratedView />
              : activeTab === 'assets' ? <AssetLibrary />
              : <PromptHub />}
          </div>
        </div>
      )}

    </>
  )
}
