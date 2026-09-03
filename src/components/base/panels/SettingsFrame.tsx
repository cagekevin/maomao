import React from 'react'
import { Settings as SettingsIcon, Bot, Sliders, HardDrive, type LucideIcon } from 'lucide-react'
import ApiSettings from './sections/ApiSettings.tsx'
import AgentChatSettings from './sections/AgentChatSettings.tsx'
import OtherSettings from './sections/OtherSettings.tsx'
import StorageMonitor from './sections/StorageMonitor.tsx'

/**
 * 设置主框架（侧栏 + 舞台）。
 * 风格照抄官方 Vr.jsx 设置页：
 *   - 容器 absolute inset-0 bg-canvas（覆盖画布，纯黑）
 *   - 侧栏 w-48，导航项激活 text-blue-500 font-bold border-edge bg-surface-active
 *   - 内容区 p-6 bg-canvas，内部 max-w-4xl 卡片布局
 */
/** 侧栏导航项（icon 用 lucide 组件，comp 是对应 section 组件名，供 renderSection 分发）。 */
interface SectionNav {
  key: string
  label: string
  icon: LucideIcon
  comp: 'ApiSettings' | 'AgentChatSettings' | 'OtherSettings' | 'StorageMonitor'
}

const SECTIONS: SectionNav[] = [
  // 2026-08-18：AI 助手改得频繁，提到第一个，默认选中它
  { key: 'agent', label: 'AI 助手', icon: Bot, comp: 'AgentChatSettings' },
  { key: 'api', label: '第三方API配置', icon: SettingsIcon, comp: 'ApiSettings' },
  // 2026-08-21：其他设置（画布显示/图片偏好收口）
  { key: 'other', label: '其他设置', icon: Sliders, comp: 'OtherSettings' },
  // 2026-08-27：存储监控从"更多设置"折叠组移出，独立成项
  { key: 'storage', label: '存储监控', icon: HardDrive, comp: 'StorageMonitor' },
]

export default function SettingsFrame() {
  const [active, setActive] = React.useState('agent')

  return (
    <div className="absolute inset-0 flex bg-canvas overflow-hidden z-float">
      {/* 左侧栏 */}
      <aside className="w-48 bg-canvas border-r-0 flex flex-col p-3 z-10 flex-shrink-0">
        <div className="px-3 py-2 mb-1">
          <span className="text-caption text-muted uppercase tracking-wider">设置</span>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${active === s.key ? 'bg-surface-active text-blue-500 border border-edge shadow-sm' : 'text-body hover:bg-surface-1 hover:text-primary border border-transparent'}`}
            >
              <Icon size={16} />
              <span className="flex-1 truncate">{s.label}</span>
            </button>
          )
        })}
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto p-6 relative pb-24 custom-scrollbar bg-canvas nowheel nopan nodrag">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {renderSection(active)}
        </div>
      </main>
    </div>
  )
}

function renderSection(key: string) {
  switch (key) {
    case 'api':
      return <ApiSettings />
    case 'agent':
      return <AgentChatSettings />
    case 'other':
      return <OtherSettings />
    case 'storage':
      return <StorageMonitor />
    default:
      return <div className="text-center text-sm text-muted py-16">该设置分区尚未实现</div>
  }
}
