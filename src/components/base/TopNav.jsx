import React from 'react'
import ProjectSelector from './ProjectSelector.jsx'
import { showToast } from './toastStore.js'
import { uploadConfig, downloadConfig } from './cloudSync.js'

/**
 * 顶部导航栏（复刻官方 Vr.jsx L3281 `Component806`，h-16）。
 *  - 左侧：Logo（猫猫画布，点击回画布）+ hover 官网入口
 *  - 中央：pill tab 组（bg-surface-deep rounded-full p-1）：「画布」/「多开」激活态 bg-white text-black
 *  - 项目选择器：紧跟 tab 组「多开」右边（官方 L3308）
 *  - 右侧（官方 Component805）：设置按钮（齿轮，L3489）+ AI 助手按钮（同一条水平线）
 *
 * @param {object} props
 *  - view             当前视图 'canvas' | 'accounts' | 'settings'
 *  - onNavigate       切视图回调（App 传 setView）
 *  - onSwitchProject  项目切换回调（App 负责保存/加载画布快照）
 *  - onCreateProject  新建项目回调
 *  - agentOpen        AI 助手面板开关
 *  - onToggleAgent    切换 AI 助手回调
 */

// 用户头像：本地图片（public/user-avatar.jpg，由桌面「Zoomable image.jpg」复制而来）
const AVATAR_URL = '/user-avatar.jpg'
// 头像加载失败兜底（复刻官方占位习惯）
const AVATAR_FALLBACK = 'https://api.dicebear.com/9.x/thumbs/svg?seed=maomao'

export default function TopNav({ view, onNavigate, onSwitchProject, onCreateProject, agentOpen, onToggleAgent }) {
  const tabs = [
    { key: 'canvas', label: '画布' },
    { key: 'accounts', label: '多开' },
  ]

  // 云端配置同步：点按钮即同步（当前用 cloudSync 模拟 localStorage 载体，流程跑通后对接真实云端）。
  // 同步内容：API 配置（providers）+ 预设提示词 + 项目（用户确认，其他不同步）。
  // 载体隔离在 cloudSync.js：将来接真实云端只改 uploadConfig/downloadConfig 两个函数。
  const handleCloudUpload = async () => {
    const r = await uploadConfig()
    if (!r.ok) showToast(r.error || '同步失败', { type: 'info' })
    else showToast(`【配置】已同步到云端（${r.count} 项）`, { type: 'success' })
  }

  const handleCloudDownload = async () => {
    const r = await downloadConfig()
    if (!r.ok) showToast(r.error || '下载失败', { type: r.hasCloud ? 'error' : 'info' })
    else {
      showToast(`【配置】已从云端同步到本地（${r.count} 项）`, { type: 'success' })
      // 恢复后 reload，让各 store（项目/预设/API 配置）重新加载生效
      setTimeout(() => window.location.reload(), 1000)
    }
  }

  return (
    <header className="bg-canvas flex items-center justify-between px-4 relative z-topnav flex-shrink-0 h-16 pt-2 pb-2">
      {/* 左侧：Logo */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 cursor-pointer relative group/logo" onClick={() => onNavigate('canvas')} title="返回画布">
          <div className="text-white font-bold text-lg italic tracking-wider">猫猫画布</div>
          {/* hover 官网入口 */}
          <div className="absolute left-0 top-full mt-2 bg-surface border border-edge rounded-lg shadow-xl opacity-0 invisible group-hover/logo:opacity-100 group-hover/logo:visible transition-all duration-300 delay-500 z-50 overflow-hidden whitespace-nowrap p-1">
            <div
              onClick={(e) => { e.stopPropagation(); window.open('https://www.1mao.cc', '_blank') }}
              className="text-sm text-gray-300 hover:text-white hover:bg-surface-hover-strong px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              访问官网
            </div>
          </div>
        </div>

        {/* 中央 pill tab 组 */}
        <nav className="flex items-center bg-surface-deep rounded-full p-1">
          {tabs.map((t) => {
            const isActive = view === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onNavigate(t.key)}
                className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors cursor-pointer border-none ${isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* 项目选择器：紧跟 tab 组「多开」右边（复刻官方 L3308 在 Logo 左侧组内、tab 组之后） */}
        {view === 'canvas' && <ProjectSelector onSwitch={onSwitchProject} onCreate={onCreateProject} />}
      </div>

      {/* 右侧组（复刻官方 Component805：设置 + AI 助手，与画布/多开同一水平线） */}
      <div className="flex items-center gap-4 ml-1">
        {/* 头像按钮（纯头像，hover 展开用户菜单；复刻官方 Component798 但只显示头像） */}
        <div className="relative group/avatar">
          <button
            type="button"
            className="relative flex items-center justify-center w-8 h-8 rounded-full text-sm bg-surface-hover-strong transition-all border-2 border-transparent hover:border-gray-500 cursor-pointer border-none overflow-hidden"
            title="用户信息"
          >
            <img
              src={AVATAR_URL}
              alt="avatar"
              className="w-full h-full rounded-full object-cover"
              draggable={false}
              onError={(t) => { if (t.target.src !== AVATAR_FALLBACK) t.target.src = AVATAR_FALLBACK }}
            />
          </button>
          {/* hover 用户菜单（复刻官方 Component797，含「同步设置」区块） */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-edge rounded-xl shadow-2xl opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all duration-200 z-float overflow-hidden flex flex-col">
            {/* 头部：头像 + 昵称 */}
            <div className="p-4 border-b border-edge flex items-center gap-3">
              <img src={AVATAR_URL} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-edge-muted" draggable={false} onError={(t) => { if (t.target.src !== AVATAR_FALLBACK) t.target.src = AVATAR_FALLBACK }} />
              <div className="flex flex-col">
                <div className="text-white font-bold text-sm truncate">画布用户</div>
                <div className="text-gray-400 text-xs">未绑定手机号</div>
              </div>
            </div>
            {/* 同步设置区块（复刻官方 Component788：上传云端 / 从云端下载） */}
            <div className="p-2 border-b border-edge">
              <div className="px-2 py-1 text-xs text-gray-500 font-bold">同步设置</div>
              <button
                type="button"
                onClick={handleCloudUpload}
                className="w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded-md flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                上传云端
              </button>
              <button
                type="button"
                onClick={handleCloudDownload}
                className="w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded-md flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                从云端下载
              </button>
            </div>
          </div>
        </div>

        {/* 设置按钮（复刻官方 L3489-3493 齿轮按钮，激活态高亮） */}
        <button
          type="button"
          onClick={() => onNavigate(view === 'settings' ? 'canvas' : 'settings')}
          className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-surface-active cursor-pointer border-none bg-transparent ${view === 'settings' ? 'bg-surface-active text-white' : ''}`}
          title="设置"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* AI 助手按钮（与设置按钮同款图标按钮样式，机器人图标） */}
        <button
          type="button"
          onClick={onToggleAgent}
          className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-surface-active cursor-pointer border-none bg-transparent ${agentOpen ? 'bg-surface-active text-white' : ''}`}
          title={agentOpen ? '关闭 AI 助手' : '打开 AI 助手'}
        >
          {/* 机器人图标 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <path d="M12 8V4" />
            <circle cx="9" cy="13" r="1" />
            <circle cx="15" cy="13" r="1" />
            <path d="M9 16h6" />
            <path d="M8 4h8" />
          </svg>
        </button>
      </div>
    </header>
  )
}
