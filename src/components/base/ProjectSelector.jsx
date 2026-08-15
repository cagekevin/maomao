import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useProjects, createProject, switchProject, deleteProject, renameProject, getCurrentProject } from './projectStore.js'
import { showToast } from './toastStore.js'

/**
 * 项目选择器（复刻官方 Vr.jsx L3308-3370 项目下拉 + L3713-3749 新建/重命名弹窗）。
 * UI/交互与官方一致：触发器纯文字+底部线、下拉 hover 展开（项目列表+⋮菜单）、+ 新建按钮、
 * 新建(项目名称)/重命名(项目名称)弹窗 `bg-surface-hover w-64`。
 */
export default function ProjectSelector({ onSwitch, onCreate }) {
  const { projects, currentProjectId } = useProjects()
  const [modal, setModal] = useState(null)
  const [name, setName] = useState('')
  const wrapRef = useRef(null)

  const current = getCurrentProject()
  const currentName = current?.name || '选择项目'

  const handleSwitch = (id) => {
    if (id === currentProjectId) return
    if (onSwitch) onSwitch(id)
    else switchProject(id)
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const proj = createProject(trimmed)
    if (onCreate) onCreate(proj)
    setModal(null)
    setName('')
  }

  const openRename = () => {
    if (!current) return
    setModal({ mode: 'rename', id: current.id, name: current.name })
    setName(current.name)
  }

  const handleRename = () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('项目名称不能为空', { type: 'warning' }); return }
    renameProject(modal.id, trimmed)
    setModal(null)
    showToast('项目名称已更新', { type: 'success' })
  }

  const handleDelete = () => {
    if (projects.length <= 1) { showToast('至少保留一个项目', { type: 'warning' }); return }
    if (!window.confirm('确定删除此项目吗？')) return
    deleteProject(currentProjectId)
    if (onSwitch) onSwitch(getCurrentProject().id)
  }

  const openCreateModal = () => { setModal({ mode: 'create' }); setName('') }

  return (
    <div ref={wrapRef} className="flex items-center gap-1 group/project-selector relative">
      {/* 下拉触发器（复刻 Component731） */}
      <div className="relative group/project-dropdown cursor-pointer">
        <div className="flex items-center gap-1 bg-transparent text-gray-300 text-sm hover:text-white pl-2 pr-2 py-1 outline-none min-w-[100px] pb-1.5 z-10 relative">
          <span className="truncate max-w-[120px]">{currentName}</span>
          <ChevronDown size={14} className="text-gray-500 group-hover/project-dropdown:text-white transition-colors" />
        </div>
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-white/10 group-hover/project-dropdown:bg-white transition-colors pointer-events-none rounded-full" />
        <div className="absolute left-0 top-full mt-2 w-48 bg-surface border border-edge rounded-xl shadow-2xl opacity-0 invisible group-hover/project-dropdown:opacity-100 group-hover/project-dropdown:visible transition-all duration-200 z-float overflow-hidden py-1">
          {projects.map((e) => {
            const isActive = e.id === currentProjectId
            return (
              <div
                key={e.id}
                onClick={() => handleSwitch(e.id)}
                className={`px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2 hover:bg-surface-hover-strong transition-colors ${isActive ? 'text-white bg-surface-1' : 'text-gray-400'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-transparent'}`} />
                <span className="truncate">{e.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 项目菜单 ⋮（复刻 Component749） */}
      <div className="relative group/project-menu -ml-1 z-10">
        <button type="button" className="text-gray-500 hover:text-white transition-colors p-1 flex items-center justify-center cursor-pointer border-none bg-transparent" aria-label="项目菜单">
          <MoreVertical size={16} />
        </button>
        <div className="absolute left-0 top-full mt-2 w-40 bg-surface border border-edge rounded-xl shadow-2xl opacity-0 invisible group-hover/project-menu:opacity-100 group-hover/project-menu:visible transition-all duration-200 z-float overflow-hidden py-1">
          <button type="button" onClick={openRename} className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white flex items-center gap-2 cursor-pointer border-none bg-transparent">
            <Pencil size={14} /> 重命名项目
          </button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('import-project'))} className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white flex items-center gap-2 cursor-pointer border-none bg-transparent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            导入项目
          </button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('export-project'))} className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white flex items-center gap-2 cursor-pointer border-none bg-transparent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            导出项目
          </button>
          {projects.length > 1 && (
            <>
              <div className="h-[1px] bg-surface-hover-strong my-1 mx-2" />
              <button type="button" onClick={handleDelete} className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-surface-hover-strong hover:text-red-300 flex items-center gap-2 cursor-pointer border-none bg-transparent">
                <Trash2 size={14} /> 删除项目
              </button>
            </>
          )}
        </div>
      </div>

      {/* 新建项目 + 按钮（复刻 Component741） */}
      <button
        type="button"
        onClick={openCreateModal}
        className="text-gray-400 hover:text-white transition-colors p-1 ml-1 cursor-pointer border-none bg-transparent"
        title="新建项目"
      >
        <Plus size={18} />
      </button>

      {/* 新建/重命名弹窗（复刻官方 L3713-3749） */}
      {modal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal" onClick={() => setModal(null)}>
          <div className="bg-surface-hover p-4 rounded-lg border border-edge w-64" onClick={(e) => e.stopPropagation()}>
            <div className="text-gray-200 text-sm font-bold mb-3">{modal.mode === 'create' ? '新建项目' : '重命名项目'}</div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') modal.mode === 'create' ? handleCreate() : handleRename()
                if (e.key === 'Escape') setModal(null)
              }}
              placeholder={modal.mode === 'create' ? '项目名称' : '项目名称'}
              className="w-full bg-surface-deep border border-edge rounded p-2 text-gray-200 text-xs mb-3 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-xs px-2 py-1 cursor-pointer border-none bg-transparent">取消</button>
              <button type="button" onClick={modal.mode === 'create' ? handleCreate : handleRename} className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-500 cursor-pointer border-none">{modal.mode === 'create' ? '创建' : '保存'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
