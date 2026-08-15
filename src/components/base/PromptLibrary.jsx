import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Search, Plus, Check, Pencil, Trash2, List, Clock } from 'lucide-react'
import {
  loadPresets, saveAndNotify, createPreset,
  getRecent, recordRecent, getRecentCards, searchCards, mapToLibraryCards,
  TYPE_LABEL, TYPE_TAG_CLASS, CATEGORY_OPTIONS
} from './promptManager.js'
import { showToast } from './toastStore.js'

/**
 * 提示词库大弹窗（复刻 maomao/src/components/prompts/PromptLibrary.jsx）。
 *
 * 入口：生图/文本/视频节点的「预设」按钮 → 打开本弹窗。
 * 点某条「使用」→ onUse(prompt) 回调（宿主新建文本节点）；也可新建/编辑/删除预设。
 *
 * @param {object} props
 *  - open         是否打开
 *  - onClose      关闭回调
 *  - onUse        使用回调（content 为预设 prompt）
 *  - defaultCategory 默认分类（image/video/text/''）
 *  - presetPrompts 可选的预设数组覆盖（不传则从本地读）
 */
export default function PromptLibrary({ open, onClose, onUse, defaultCategory = '', presetPrompts }) {
  const [activeTab, setActiveTab] = useState('mine') // mine | recent
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory)
  const [editingIndex, setEditingIndex] = useState(-1)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', type: 'all', prompt: '' })

  // 预设列表：外部传入优先，否则本地读
  const [localPresets, setLocalPresets] = useState(() => loadPresets())
  const presets = presetPrompts || localPresets

  // 监听外部 presetsChanged 广播，保持同步
  useEffect(() => {
    const onChanged = (e) => setLocalPresets(e.detail || loadPresets())
    window.addEventListener('yimao:presetsChanged', onChanged)
    return () => window.removeEventListener('yimao:presetsChanged', onChanged)
  }, [])

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setSelectedCategory(defaultCategory)
      setSearchKeyword('')
      setActiveTab('mine')
      setEditingIndex(-1)
      setShowNewForm(false)
    }
  }, [open, defaultCategory])

  const cards = useMemo(() => mapToLibraryCards(presets), [presets])
  const recentIds = useMemo(() => getRecent(), [open])
  const recentCards = useMemo(() => getRecentCards(cards, recentIds), [cards, recentIds])

  const displayCards = useMemo(() => {
    let list = activeTab === 'recent' ? recentCards : cards
    if (selectedCategory) list = list.filter((c) => c.category === selectedCategory)
    return searchCards(list, searchKeyword)
  }, [activeTab, recentCards, cards, selectedCategory, searchKeyword])

  const handleUse = (card) => {
    recordRecent(card.id)
    if (onUse) {
      onUse(card.content)
      onClose()
    } else {
      showToast('已复制到剪贴板')
      try { navigator.clipboard.writeText(card.content) } catch { /* ignore */ }
    }
  }

  const startEdit = (presetIndex) => {
    const p = presets[presetIndex]
    if (!p) return
    setEditingIndex(presetIndex)
    setFormData({ title: p.title || '', type: p.type || 'all', prompt: p.prompt || '' })
  }

  const saveEdit = () => {
    if (!formData.title.trim()) { showToast('请输入标题', { type: 'warning' }); return }
    const next = presets.slice()
    next[editingIndex] = { ...next[editingIndex], title: formData.title, type: formData.type, prompt: formData.prompt }
    saveAndNotify(next)
    if (!presetPrompts) setLocalPresets(next)
    setEditingIndex(-1)
    showToast('已保存', { type: 'success' })
  }

  const handleDelete = (presetIndex) => {
    const next = presets.filter((_, i) => i !== presetIndex)
    saveAndNotify(next)
    if (!presetPrompts) setLocalPresets(next)
    if (editingIndex === presetIndex) setEditingIndex(-1)
    showToast('已删除', { type: 'success' })
  }

  const startNew = () => {
    setShowNewForm(true)
    setFormData({ title: '', type: selectedCategory || 'all', prompt: '' })
  }

  const saveNew = () => {
    if (!formData.title.trim()) { showToast('请输入标题', { type: 'warning' }); return }
    const next = [...presets, { ...createPreset(), title: formData.title, type: formData.type, prompt: formData.prompt }]
    saveAndNotify(next)
    if (!presetPrompts) setLocalPresets(next)
    setShowNewForm(false)
    showToast('已添加', { type: 'success' })
  }

  const isModalOpen = editingIndex >= 0 || showNewForm

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-modal bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 nowheel nopan nodrag" onClick={onClose}>
      <div className="w-[88vw] h-[84vh] max-w-[1400px] bg-input border border-edge-faint rounded-[18px] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header：品牌 + 搜索 + 关闭 */}
        <div className="h-[60px] border-b border-edge-subtle flex items-center px-5 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 pr-4 border-r border-edge-faint">
            <Sparkles size={18} className="text-blue-400" />
            <span className="text-base font-semibold text-white whitespace-nowrap">提示词库</span>
          </div>
          <div className="relative flex-1 max-w-[320px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索标题或提示词内容"
              className="w-full h-[34px] bg-surface border border-edge rounded-[10px] pl-9 pr-3 text-body text-body-sm outline-none focus:border-edge-strong box-border"
            />
          </div>
          <button className="ml-auto w-8 h-8 flex items-center justify-center bg-transparent hover:bg-surface-hover rounded-lg text-muted hover:text-white cursor-pointer" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧导航 */}
          <div className="w-[170px] border-r border-edge-subtle p-4 pr-3 flex flex-col gap-1.5 flex-shrink-0">
            <button
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-body-sm transition-all cursor-pointer text-left border-none ${activeTab === 'mine' ? 'bg-surface-2 text-white font-medium' : 'text-muted hover:bg-surface-2 hover:text-primary bg-transparent'}`}
              onClick={() => setActiveTab('mine')}
            >
              <List size={16} /> 我的提示词
            </button>
            <button
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-body-sm transition-all cursor-pointer text-left border-none ${activeTab === 'recent' ? 'bg-surface-2 text-white font-medium' : 'text-muted hover:bg-surface-2 hover:text-primary bg-transparent'}`}
              onClick={() => setActiveTab('recent')}
            >
              <Clock size={16} /> 最近使用
            </button>
          </div>

          {/* 主区域 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 工具栏：分类 + 新建 */}
            <div className="h-[58px] px-5 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex gap-2 items-center">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || 'all'}
                    className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer border ${selectedCategory === opt.value ? 'bg-white text-[#141414] font-medium border-white' : 'bg-surface-2 text-muted border-transparent hover:bg-surface-hover hover:text-primary'}`}
                    onClick={() => setSelectedCategory(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer border-none"
                onClick={startNew}
              >
                <Plus size={14} /> 新建提示词
              </button>
            </div>

            {/* 卡片网格 */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 custom-scrollbar">
              {displayCards.length === 0 ? (
                <div className="h-full flex items-center justify-center text-faint text-sm">
                  {activeTab === 'recent' ? '还没有使用记录' : '暂无提示词，点击「新建提示词」添加'}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
                  {displayCards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-surface border border-edge-faint rounded-[14px] p-4 flex flex-col gap-2.5 cursor-pointer transition-all hover:border-edge-muted hover:bg-surface-2"
                      onClick={() => handleUse(card)}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="text-sm font-semibold text-white leading-[1.4] truncate flex-1" title={card.title}>{card.title || '(未命名)'}</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', opacity: 0 }}>
                          <button
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-md bg-transparent hover:bg-surface-hover text-muted hover:text-white cursor-pointer border-none"
                            title="编辑"
                            onClick={(evt) => { evt.stopPropagation(); startEdit(card.presetIndex) }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-md bg-transparent hover:bg-red-500/10 text-muted hover:text-red-400 cursor-pointer border-none"
                            title="删除"
                            onClick={(evt) => { evt.stopPropagation(); handleDelete(card.presetIndex) }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted leading-[1.6] m-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {card.content || '(空)'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`px-2 py-0.5 rounded-md text-caption-sm font-medium ${TYPE_TAG_CLASS[card.category] || 'bg-white/10 text-secondary'}`}>
                          {card.category ? TYPE_LABEL[card.category] : '通用'}
                        </span>
                        <button
                          className="px-3 py-1 rounded-lg text-xs text-blue-400 border border-edge bg-transparent hover:bg-blue-500/10 hover:border-blue-500/30 cursor-pointer transition-all"
                          onClick={(evt) => { evt.stopPropagation(); handleUse(card) }}
                        >
                          使用
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 编辑/新建弹窗 */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-modal-raise bg-black/60 flex items-center justify-center" onClick={() => { setEditingIndex(-1); setShowNewForm(false) }}>
          <div className="w-[520px] bg-surface border border-edge rounded-2xl p-6 flex flex-col gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base-sm font-semibold text-white m-0">{showNewForm ? '新建提示词' : '编辑提示词'}</h3>
            <div className="flex gap-2.5">
              <div className="flex flex-col gap-1.5 flex-[2]">
                <label className="text-xs text-muted">标题</label>
                <input
                  placeholder="标题"
                  value={formData.title}
                  onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                  className="bg-input border border-edge rounded-[10px] px-3 py-2.5 text-body text-body-sm outline-none focus:border-edge-strong box-border"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((d) => ({ ...d, type: e.target.value }))}
                  className="bg-input border border-edge rounded-[10px] px-3 py-2.5 text-body text-body-sm outline-none focus:border-edge-strong box-border"
                >
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.value ? o.label : '通用'}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">提示词内容</label>
              <textarea
                placeholder="提示词内容"
                value={formData.prompt}
                onChange={(e) => setFormData((d) => ({ ...d, prompt: e.target.value }))}
                className="bg-input border border-edge rounded-[10px] px-3 py-2.5 text-body text-body-sm outline-none focus:border-edge-strong resize-none h-[160px] leading-[1.6] box-border"
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              {!showNewForm ? (
                <button className="px-3 py-2 rounded-[10px] text-xs text-red-400 bg-transparent hover:bg-red-500/10 cursor-pointer border-none" onClick={() => { handleDelete(editingIndex); setEditingIndex(-1) }}>删除</button>
              ) : <span />}
              <div className="flex gap-2.5">
                <button className="px-4 py-2 rounded-[10px] text-xs bg-surface-hover text-body hover:bg-surface-hover-strong cursor-pointer border-none" onClick={() => { setEditingIndex(-1); setShowNewForm(false) }}>取消</button>
                <button className="px-4 py-2 rounded-[10px] text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer border-none" onClick={showNewForm ? saveNew : saveEdit}>{showNewForm ? '添加' : '保存'}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}
