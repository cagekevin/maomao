import React from 'react'
import { ChevronDown, Settings as SettingsIcon, Keyboard } from 'lucide-react'
import ApiSettings from './sections/ApiSettings.jsx'
import ShortcutSettings from './sections/ShortcutSettings.jsx'

/**
 * 设置主框架（侧栏 + 舞台）。
 * 风格照抄一毛官方 Vr.jsx 设置页：
 *   - 容器 absolute inset-0 bg-canvas（覆盖画布，纯黑）
 *   - 侧栏 w-48，导航项激活 text-blue-500 font-bold border-edge bg-surface-active
 *   - 内容区 p-6 bg-canvas，内部 max-w-4xl 卡片布局
 */
const SECTIONS = [
  { key: 'api', label: '第三方API配置', icon: SettingsIcon, comp: 'ApiSettings' },
  { key: 'shortcut', label: '快捷键', icon: Keyboard, comp: 'ShortcutSettings' },
]

export default function SettingsFrame() {
  const [active, setActive] = React.useState('api')
  const [moreOpen, setMoreOpen] = React.useState(false)

  return (
    <div className="absolute inset-0 flex bg-canvas overflow-hidden z-float">
      {/* 左侧栏 */}
      <aside className="w-48 bg-canvas border-r-0 flex flex-col p-3 z-10 flex-shrink-0">
        <div className="px-3 py-2 mb-1">
          <span className="text-caption text-gray-500 uppercase tracking-wider">设置</span>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${active === s.key ? 'bg-surface-active text-blue-500 border border-edge shadow-sm' : 'text-gray-300 hover:bg-surface-1 hover:text-gray-100 border border-transparent'}`}
            >
              <Icon size={16} />
              <span className="flex-1 truncate">{s.label}</span>
            </button>
          )
        })}

        {/* 更多设置折叠组 */}
        <div className="mt-auto">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${moreOpen ? 'bg-surface-active text-blue-500 border border-edge shadow-sm' : 'text-gray-300 hover:bg-surface-1 hover:text-gray-100 border border-transparent'}`}
          >
            <SettingsIcon size={16} />
            <span className="flex-1">更多设置</span>
            <ChevronDown size={13} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreOpen && (
            <div className="px-3 py-2 text-xs text-gray-500">（预留扩展分区）</div>
          )}
        </div>
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto p-6 relative pb-24 custom-scrollbar bg-canvas nowheel nopan nodrag">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {renderSection(active)}
        </div>
      </main>
    </div>
  )
}

function renderSection(key) {
  switch (key) {
    case 'api':
      return <ApiSettings />
    case 'shortcut':
      return <ShortcutSettings />
    default:
      return <div className="text-center text-sm text-gray-500 py-16">该设置分区尚未实现</div>
  }
}
