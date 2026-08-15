import React from 'react'
import { showToast } from '../../toastStore.js'
import {
  useAccounts,
  isExtensionEnv,
  openEditForm,
  closeForm,
  setFormName,
  setFormCookies,
  saveEnvironment,
  activateEnv,
  clearCookies,
  requestDelete,
  moveEnv,
} from '../accountsStore.js'

/**
 * 多开账号管理（整页视图）。
 * 1:1 复刻官方 Vr.jsx `V === 'accounts'`（docs/32 + 源码 L3560-3671）：
 *  - 顶部「新建/修改环境」表单（名称 + 可选 Cookie 粘贴 + 保存，Enter 提交，✕ 关闭）
 *  - 列表区：视频教程链接 + 网格「保存当前环境」虚线卡 + 环境卡片
 *  - 环境卡片：头像/名称/激活√角标/⋮菜单（修改/复制Cookie/清除全部Cookies/删除二次确认）
 *  - 拖拽排序
 * 运行端：扩展端（k=true）真实读写 Cookie；浏览器端降级（新建写测试数据，切换/清Cookie静默）。
 */

// 环境卡片的 ⋮ 菜单（独立子组件，hover 展开，复刻官方 Component851）
function EnvMenu({ env, isConfirming, onEdit, onCopy, onClearAll, onDelete }) {
  return (
    <div className="relative group/menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="text-gray-400 hover:text-white p-1 rounded hover:bg-surface-hover-strong cursor-pointer border-none bg-transparent"
        aria-label="环境菜单"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      <div className="absolute right-0 top-full pt-1 hidden group-hover/menu:block z-50">
        <div className="bg-surface-active border border-edge rounded-md shadow-xl py-1 w-24">
          <button type="button" onClick={onEdit} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-surface-hover-strong hover:text-white cursor-pointer border-none bg-transparent">
            修改
          </button>
          <button type="button" onClick={onCopy} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-surface-hover-strong hover:text-white cursor-pointer border-none bg-transparent">
            复制 Cookie
          </button>
          <button type="button" onClick={onClearAll} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-surface-hover-strong hover:text-red-300 cursor-pointer border-none bg-transparent">
            清除全部 Cookies
          </button>
          <div className="border-t border-edge my-1" />
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-surface-hover-strong hover:text-red-300 cursor-pointer border-none bg-transparent"
          >
            {isConfirming ? '确认删除?' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountsSettings() {
  const {
    envs, activeId, formOpen, formEditId, formName, formCookies, saving, confirmDeleteId,
  } = useAccounts()
  const isExt = isExtensionEnv()

  // 拖拽排序（复刻官方 Da/Oa/ka/Aa：记录源索引，drop 时移动）
  const dragIndexRef = React.useRef(null)
  const [dragOverIndex, setDragOverIndex] = React.useState(null)

  const handleDragStart = (e, idx) => {
    dragIndexRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }
  const handleDrop = (e, idx) => {
    e.preventDefault()
    setDragOverIndex(null)
    moveEnv(dragIndexRef.current, idx)
    dragIndexRef.current = null
  }

  const handleCopy = (env) => {
    const text = JSON.stringify(env.cookies)
    navigator.clipboard?.writeText(text)
    showToast('Cookie 已复制', { type: 'success' })
  }

  const handleSave = async () => {
    const r = await saveEnvironment(false)
    // 官方 Sa：保存成功只关表单、无 toast；失败用 alert（见 store saveEnvironment）
    if (!r.ok && r.error) alert(r.error)
  }

  // 「保存当前环境」卡片：官方 `Sa(true)` 自动模式（忽略表单，直接抓取/降级 + 新建环境）
  const handleSaveCurrent = async () => {
    const r = await saveEnvironment(true)
    if (!r.ok && r.error) alert(r.error)
  }

  const handleClearAll = async (env) => {
    // 非扩展端：官方 ha L1666 `if(!k){ K.error('仅支持浏览器扩展环境'); return }`
    if (!isExt) {
      showToast('仅支持浏览器扩展环境', { type: 'error' })
      return
    }
    const r = await clearCookies(env.id, true)
    if (!r.ok) {
      if (r.error) alert(r.error)
      return
    }
    // 官方 K.info/success（toast）：无 cookies → info；成功 → success
    if (r.count === 0) {
      showToast('当前页面没有可清除的 Cookies', { type: 'info' })
    } else {
      showToast(`已清除 ${r.count} 个全部 Cookies`, { type: 'success' })
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-canvas overflow-hidden z-float">
      {/* ── 新建/修改环境表单（复刻官方 un && Component828）── */}
      {formOpen && (
        <div className="p-3 bg-surface-deep border-b border-edge shadow-sm">
          <div className="bg-surface-active p-3 rounded-lg border border-edge animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-bold text-gray-200">{formEditId ? '修改环境' : '手动添加环境'}</div>
              <button type="button" onClick={closeForm} className="text-gray-500 hover:text-gray-300 cursor-pointer border-none bg-transparent">
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="输入环境名称 (如:即梦小号)"
                className="flex-1 bg-surface border border-edge rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap cursor-pointer border-none"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
            <div className="mt-2">
              <textarea
                value={formCookies}
                onChange={(e) => setFormCookies(e.target.value)}
                placeholder="[可选] 手动粘贴 Cookie (JSON 或 key=value; 格式)"
                className="w-full bg-surface border border-edge rounded px-3 py-1.5 text-caption text-gray-300 focus:outline-none focus:border-blue-500 h-16 resize-none font-mono nowheel nopan"
              />
            </div>
            <div className="text-caption text-gray-500 mt-2">* 默认自动抓取当前标签页 Cookie。若填写上方 Cookie 则优先使用。</div>
          </div>
        </div>
      )}

      {/* ── 列表区（复刻官方 Component855）── */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {/* 顶部：视频教程链接（复刻官方 Component830） */}
        <div className="flex justify-between items-center mb-4">
          <a
            href="https://www.bilibili.com/video/BV1nWdbBREXv/?share_source=copy_web&vd_source=cebaf375056cef0735636bdd79543af1"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-500 hover:text-gray-300 underline flex items-center gap-1 transition-colors bg-surface-1 px-3 py-1.5 rounded-full hover:bg-surface-hover-strong"
          >
            📺 如何一个网站登录多个账号？(视频教程)
          </a>
        </div>

        {/* 网格（复刻官方 Component854：2/3/4/5/6 列自适应） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* 「保存当前环境」虚线卡（复刻官方 Component834：onClick=Sa(true) 直接保存） */}
          <div
            className="relative bg-blue-900/10 rounded-xl border-[3px] border-blue-500 border-dashed transition-all cursor-pointer hover:bg-blue-900/20 hover:border-blue-400 flex flex-col items-center justify-center p-3 h-32 group"
            onClick={handleSaveCurrent}
            title="保存当前环境"
          >
            <div className="relative mb-3 flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform group-hover:bg-blue-500 group-hover:text-white">
              <span className="text-3xl font-light">+</span>
            </div>
            <div className="font-bold text-blue-400 group-hover:text-blue-300 truncate text-sm w-full text-center px-2 transition-colors">
              保存当前环境
            </div>
          </div>

          {/* 环境卡片（复刻官方 Component853） */}
          {envs.map((e, idx) => {
            const isActive = activeId === e.id
            const isDragOver = dragOverIndex === idx
            const isConfirming = confirmDeleteId === e.id
            return (
              <div
                key={e.id}
                draggable
                onDragStart={(ev) => handleDragStart(ev, idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(ev) => handleDragOver(ev, idx)}
                onDrop={(ev) => handleDrop(ev, idx)}
                onClick={() => activateEnv(e.id)}
                title={e.siteName}
                className={`relative bg-surface-deep rounded-xl border transition-all cursor-grab active:cursor-grabbing group hover:bg-surface-active flex flex-col items-center justify-center p-3 h-32
                  ${isActive ? 'border-blue-500 shadow-blue-500/10 shadow-md ring-1 ring-blue-500/50 bg-blue-900/10' : 'border-edge hover:border-gray-500'}
                  ${isDragOver ? 'border-dashed border-[3px] border-blue-400 opacity-80 scale-105 z-10' : ''}
                `}
              >
                <img
                  src={e.avatar}
                  className="w-12 h-12 rounded-full bg-canvas object-contain p-0.5 border border-edge mb-3 pointer-events-none"
                  draggable={false}
                  alt={e.name}
                  onError={(t) => { t.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.name}` }}
                />
                <div className="font-bold text-gray-200 truncate text-sm w-full text-center px-2">{e.name}</div>
                {isActive && (
                  <div className="absolute top-0 left-0 w-0 h-0 border-t-[32px] border-r-[32px] border-t-blue-500 border-r-transparent rounded-tl-xl z-10">
                    <div className="absolute -top-[28px] left-[6px] text-body-xs text-white font-bold">√</div>
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <EnvMenu
                    env={e}
                    isConfirming={isConfirming}
                    onEdit={(ev) => { ev.stopPropagation(); openEditForm(e.id) }}
                    onCopy={(ev) => { ev.stopPropagation(); handleCopy(e) }}
                    onClearAll={(ev) => { ev.stopPropagation(); handleClearAll(e) }}
                    onDelete={(ev) => { ev.stopPropagation(); requestDelete(e.id) }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部：运行端说明（信息） */}
        <div className="mt-6 flex justify-center">
          <span className="text-xs text-gray-600">
            运行端：{isExt ? 'Chrome 扩展（Cookie 读写生效）' : '浏览器（Cookie 读写需扩展端，当前仅列表管理）'}
          </span>
        </div>
      </div>

    </div>
  )
}
