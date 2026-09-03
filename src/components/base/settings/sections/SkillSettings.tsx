import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Search, Plus, Bot, Sparkles, Upload, Download, Pencil, MoreHorizontal, X, Trash2 } from 'lucide-react'
import { getAllSkills, readCustomSkills, upsertCustomSkill, deleteCustomSkill, isSkillEnabled, setSkillEnabled, getAllEnabledMap } from '../../store/skillStore.ts'
import { showToast } from '../../core/toastStore.ts'
import { askConfirm } from '../../core/confirmStore.ts'
import { downloadBlob } from '../../utils/clipboard.ts'
import { createImeInput } from '../../core/utils.ts'
import { Toggle } from '../Toggle'

const inputCls =
  'w-full bg-canvas border border-edge text-body text-sm px-3 py-2.5 rounded-xl outline-none placeholder:text-muted focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10 transition disabled:opacity-50'

function emptyForm() {
  return { id: '', name: '', description: '', content: '' }
}

export default function SkillSettings() {
  const [allSkills, setAllSkills] = useState(() => getAllSkills())
  // 【数据损坏可见】读取失败/损坏时透传原因并展示错误态。
  // 注意：不禁用保存——否则用户既不能修也不能导，会被困死；改为提供逃生舱（见下方错误条）。
  const [loadError, setLoadError] = useState(() => readCustomSkills().error || '')
  const [selectedId, setSelectedId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [isNew, setIsNew] = useState(false)
  const [editing, setEditing] = useState(false) // 详情页内的编辑态
  const [enabledMap, setEnabledMap] = useState(() => getAllEnabledMap())
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const mdFileRef = useRef(null)

  /** 刷新列表并同步「损坏/失败」状态（每次写后都调，保证错误态不残留、不谎报） */
  const refreshAll = () => {
    const res = readCustomSkills()
    setLoadError(res.error || '')
    setAllSkills(getAllSkills())
    return res
  }

  // 搜索 IME 感知防抖
  const searchIme = useRef(null)
  if (searchIme.current == null) {
    searchIme.current = createImeInput((v) => setDebouncedKeyword(v), 200)
  }

  const refreshEnabled = () => setEnabledMap(getAllEnabledMap())

  // 点击更多菜单外部关闭
  useEffect(() => {
    if (!moreOpen) return
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [moreOpen])

  // 分组：个人（自定义） / 官方（内置）
  const { personalSkills, officialSkills } = useMemo(() => {
    let list = allSkills
    if (debouncedKeyword.trim()) {
      const k = debouncedKeyword.toLowerCase()
      list = list.filter(
        (s) => s.name?.toLowerCase().includes(k) || s.description?.toLowerCase().includes(k),
      )
    }
    return {
      personalSkills: list.filter((s) => !s.builtin),
      officialSkills: list.filter((s) => s.builtin),
    }
  }, [allSkills, debouncedKeyword])

  const selected = allSkills.find((s) => s.id === selectedId) || null
  const readonly = !!(selected && selected.builtin && !isNew && !editing)

  const getEnabled = (id) => {
    if (id in enabledMap) return !!enabledMap[id]
    return true
  }

  const handleToggle = (id, enabled) => {
    setSkillEnabled(id, enabled)
    refreshEnabled()
  }

  const handleSelect = (skill) => {
    setSelectedId(skill.id)
    setIsNew(false)
    setEditing(false)
    setForm({
      id: skill.id,
      name: skill.name || '',
      description: skill.description || '',
      content: skill.content || '',
    })
  }

  const handleNew = () => {
    setSelectedId('')
    setIsNew(true)
    setEditing(true)
    setForm(emptyForm())
  }

  const handleStartEdit = () => {
    if (!selected || selected.builtin) return
    setEditing(true)
    setForm({
      id: selected.id,
      name: selected.name || '',
      description: selected.description || '',
      content: selected.content || '',
    })
  }

  const handleSave = () => {
    const name = form.name.trim()
    const content = form.content.trim()
    if (!name) return showToast('请填写 Skill 名称', { type: 'warning' })
    if (!content) return showToast('请填写 Skill 内容', { type: 'warning' })
    const saved = upsertCustomSkill({
      id: form.id || undefined,
      name,
      description: form.description.trim(),
      content,
    })
    // 【禁止谎报成功】upsertCustomSkill 在「缺 name/content」与「写失败」两种情况下都返回 null。
    // 此处必须区分：写失败要透传错误，不可弹「已保存」误导用户（否则用户以为存上了，实际丢了）。
    if (!saved) {
      const res = readCustomSkills()
      showToast(res.ok ? 'Skill 保存失败：请检查名称与内容是否填写完整' : `Skill 保存失败：${res.error}`, { type: 'error' })
      return
    }
    refreshAll()
    setSelectedId(saved.id)
    setIsNew(false)
    setEditing(false)
    setForm({ id: saved.id, name: saved.name, description: saved.description, content: saved.content })
    showToast('Skill 已保存', { type: 'success' })
  }

  // 确认统一走 confirmStore（D8 横切收敛：替代 window.confirm）
  const handleDelete = async () => {
    if (!selected || selected.builtin) return
    const ok = await askConfirm({ title: `删除 Skill「${selected.name}」？`, confirmText: '删除', danger: true })
    if (!ok) return
    const res = deleteCustomSkill(selected.id)
    if (!res.ok) {
      showToast(`Skill 删除失败：${res.error}`, { type: 'error' })
      return
    }
    refreshAll()
    setSelectedId('')
    setIsNew(false)
    setEditing(false)
    setForm(emptyForm())
    showToast('Skill 已删除', { type: 'success' })
  }

  const handleClose = () => {
    setSelectedId('')
    setIsNew(false)
    setEditing(false)
    setForm(emptyForm())
  }

  const cancel = () => {
    if (isNew) {
      handleClose()
    } else {
      setEditing(false)
      if (selected) {
        setForm({
          id: selected.id,
          name: selected.name || '',
          description: selected.description || '',
          content: selected.content || '',
        })
      }
    }
  }

  // .md 导入
  const handleMdImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      Array.from(files).forEach((f) => {
        if (!/\.(md|markdown|txt)$/i.test(f.name)) return
        const reader = new FileReader()
        reader.onload = () => {
          const text = String(reader.result || '')
          const name = f.name.replace(/\.(md|markdown|txt)$/i, '')
          const saved = upsertCustomSkill({ name, description: '', content: text })
          if (saved) {
            refreshAll()
            setSelectedId(saved.id)
            setIsNew(false)
            setEditing(false)
            setForm({ id: saved.id, name: saved.name, description: saved.description, content: saved.content })
            showToast(`已导入 Skill「${saved.name}」`, { type: 'success' })
          } else {
            // 区分「内容不完整」与「写入失败」：后者须透传底层原因，不可笼统归咎用户
            const res = readCustomSkills()
            showToast(res.ok ? `导入失败：${name} 缺少名称或内容` : `导入失败：${res.error}`, { type: 'error' })
          }
        }
        reader.onerror = () => showToast(`读取失败：${f.name}`, { type: 'error' })
        reader.readAsText(f, 'utf-8')
      })
    } finally {
      e.target.value = ''
    }
  }

  // .md 导出
  const handleMdExport = () => {
    const target = selected || (isNew && form.name ? form : null)
    if (!target || !target.content) return showToast('请先选择一个有内容的 Skill', { type: 'warning' })
    const blob = new Blob([target.content], { type: 'text/markdown;charset=utf-8' })
    const filename = `${target.name || 'skill'}.md`
    downloadBlob(blob, filename)
    showToast(`已导出 ${filename}`, { type: 'success' })
  }

  const showDetail = selected || isNew

  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-edge-subtle flex items-center justify-between">
        <div>
          <h3 className="settings-page-title flex items-center gap-2">
            <Bot size={17} className="text-secondary" />
            Skill Library
          </h3>
          <p className="text-xs text-muted mt-1">管理 AI 助手能力模块</p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-surface-1 text-xs text-secondary">
          {allSkills.length} Skills
        </div>
      </div>

      <div className="flex h-[760px]">
        {/* 左栏：搜索 + 新建 + 分组列表 + 开关 */}
        <aside className="w-[280px] shrink-0 border-r border-edge-subtle flex flex-col">
          {/* 搜索 */}
          <div className="p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  searchIme.current?.onChange(e.target.value, (e.nativeEvent as InputEvent).isComposing)
                }}
                onCompositionEnd={(e) => searchIme.current?.onCompositionEnd((e.target as HTMLInputElement).value)}
                onBlur={() => searchIme.current?.cancel()}
                placeholder="搜索技能"
                className="w-full h-9 bg-canvas border border-edge rounded-xl pl-9 pr-3 text-xs text-body outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          {/* 新建 */}
          <div className="px-4 pb-3">
            <button
              onClick={handleNew}
              className="w-full h-9 rounded-xl bg-surface-1 text-xs text-body flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none"
            >
              <Plus size={14} /> 新建技能
            </button>
          </div>

          {/* 列表（分组） */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
            {/* 【数据损坏/读取失败】透传原因 + 逃生舱。
                 不禁用保存：禁用会让用户既不能修也不能导，被困死。 */}
            {loadError ? (
              <div className="mx-1 mb-1 px-3 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs">
                <div className="text-amber-300 font-medium">自定义 Skill 未能加载</div>
                <div className="mt-1 text-secondary break-words">{loadError}</div>
                <div className="mt-1.5 text-muted">
                  为避免覆盖原始数据，此处不显示、也不自动写入。保存操作仍可进行（会生成新列表）。
                </div>
              </div>
            ) : null}
            {/* 个人（自定义） */}
            <div>
              <div className="px-2 pb-1.5 text-[11px] text-muted uppercase tracking-wider">个人</div>
              <div className="space-y-0.5">
                {personalSkills.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted">暂无自定义技能</div>
                ) : (
                  personalSkills.map((skill) => {
                    const active = skill.id === selectedId && !isNew
                    const enabled = getEnabled(skill.id)
                    return (
                      <div
                        key={skill.id}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition group
                          ${active ? 'bg-surface-active border border-edge' : 'border border-transparent hover:bg-surface-hover'}`}
                        onClick={() => handleSelect(skill)}
                      >
                        <Bot size={14} className="shrink-0 text-secondary" />
                        <span className="flex-1 text-sm text-body truncate">{skill.name}</span>
                        <Toggle
                          checked={enabled}
                          onChange={(v) => handleToggle(skill.id, v)}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* 官方（内置） */}
            <div>
              <div className="px-2 pb-1.5 text-[11px] text-muted uppercase tracking-wider">官方</div>
              <div className="space-y-0.5">
                {officialSkills.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted">暂无内置技能</div>
                ) : (
                  officialSkills.map((skill) => {
                    const active = skill.id === selectedId && !isNew
                    const enabled = getEnabled(skill.id)
                    return (
                      <div
                        key={skill.id}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition group
                          ${active ? 'bg-surface-active border border-edge' : 'border border-transparent hover:bg-surface-hover'}`}
                        onClick={() => handleSelect(skill)}
                      >
                        <Bot size={14} className="shrink-0 text-secondary" />
                        <span className="flex-1 text-sm text-body truncate">{skill.name}</span>
                        <Toggle
                          checked={enabled}
                          onChange={(v) => handleToggle(skill.id, v)}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* 底部导入/导出 */}
          <div className="p-3 border-t border-edge-subtle flex gap-2">
            <input ref={mdFileRef} type="file" accept=".md,.markdown,.txt" multiple onChange={handleMdImport} className="hidden" />
            <button
              onClick={() => mdFileRef.current?.click()}
              className="flex-1 h-8 rounded-lg bg-surface-1 text-xs text-body flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none"
              title="导入 .md 为自定义 Skill"
            >
              <Upload size={13} /> 导入
            </button>
            <button
              onClick={handleMdExport}
              disabled={!selected && !(isNew && form.name)}
              className="flex-1 h-8 rounded-lg bg-surface-1 text-xs text-body flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
              title="导出当前 Skill 为 .md"
            >
              <Download size={13} /> 导出
            </button>
          </div>
        </aside>

        {/* 右栏：详情 / 编辑 */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            {!showDetail ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-surface-1 flex items-center justify-center mb-4">
                  <Sparkles size={25} className="text-muted" />
                </div>
                <p className="text-sm text-secondary">选择一个技能</p>
                <p className="text-xs text-muted mt-1">查看或编辑 AI 能力配置</p>
              </div>
            ) : editing || isNew ? (
              /* 编辑态 */
              <div className="p-6 max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base text-strong font-medium">
                      {isNew ? '新建技能' : '编辑技能'}
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      {isNew ? '创建一个新的自定义 Skill' : '修改 Skill 配置'}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-xl bg-surface-1 flex items-center justify-center text-secondary hover:text-strong hover:bg-surface-hover transition cursor-pointer border-none"
                    title="关闭"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-surface-1 border border-edge rounded-2xl p-5 space-y-4">
                  <label>
                    <span className="block text-xs text-secondary mb-2">名称</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例如：商品详情页生成"
                      className={inputCls}
                    />
                  </label>

                  <label>
                    <span className="block text-xs text-secondary mb-2">描述</span>
                    <input
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="简单描述这个 Skill 的用途"
                      className={inputCls}
                    />
                  </label>

                  <label>
                    <span className="block text-xs text-secondary mb-2">AI Instructions</span>
                    <div className="relative">
                      <textarea
                        value={form.content}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="输入 AI 助手需要长期遵循的行为规则..."
                        className="w-full min-h-[340px] bg-canvas border border-edge rounded-xl p-3 text-sm text-body placeholder:text-muted outline-none resize-none focus:border-blue-500/50 transition"
                      />
                      <span className="absolute right-3 bottom-3 text-[10px] text-muted">Skill Prompt</span>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              /* 详情态（只读展示） */
              <div className="p-6">
                {/* 顶部标题 + 操作 */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="min-w-0">
                    <h2 className="text-lg text-strong font-medium truncate">{selected?.name}</h2>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        selected?.builtin
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-purple-500/10 text-purple-400'
                      }`}>
                        {selected?.builtin ? '官方内置' : '自定义'}
                      </span>
                      <span className="text-[11px] text-muted">
                        {getEnabled(selected?.id) ? '已启用' : '已关闭'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-4 h-9 rounded-xl bg-white text-black text-xs font-medium flex items-center justify-center hover:bg-zinc-200 transition cursor-pointer border-none"
                      onClick={() => showToast('已切换到该技能', { type: 'success' })}
                    >
                      去使用
                    </button>
                    {!selected?.builtin && (
                      <button
                        onClick={handleStartEdit}
                        className="px-4 h-9 rounded-xl bg-surface-1 text-xs text-body font-medium flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none"
                      >
                        <Pencil size={13} /> 编辑
                      </button>
                    )}
                    <span ref={moreRef} className="relative">
                      <button
                        onClick={() => setMoreOpen((v) => !v)}
                        className="w-9 h-9 rounded-xl bg-surface-1 flex items-center justify-center text-secondary hover:text-strong hover:bg-surface-hover transition cursor-pointer border-none"
                        title="更多"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {moreOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-[140px] bg-surface border border-edge rounded-xl shadow-2xl py-1 z-20 overflow-hidden">
                          <button
                            onClick={() => {
                              handleMdExport()
                              setMoreOpen(false)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-hover hover:text-strong transition cursor-pointer border-none text-left"
                          >
                            <Download size={14} /> 下载
                          </button>
                          {!selected?.builtin && (
                            <button
                              onClick={() => {
                                handleDelete()
                                setMoreOpen(false)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer border-none text-left"
                            >
                              <Trash2 size={14} /> 删除
                            </button>
                          )}
                        </div>
                      )}
                    </span>
                    <button
                      onClick={handleClose}
                      className="w-9 h-9 rounded-xl bg-surface-1 flex items-center justify-center text-secondary hover:text-strong hover:bg-surface-hover transition cursor-pointer border-none"
                      title="关闭"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* 技能描述 */}
                <div className="mb-6">
                  <h3 className="text-sm text-muted mb-2">技能描述</h3>
                  <p className="text-sm text-body leading-relaxed whitespace-pre-wrap">
                    {selected?.description || '暂无描述'}
                  </p>
                </div>

                {/* 技能内容 */}
                <div className="pt-4 border-t border-edge-subtle">
                  <h3 className="text-sm text-muted mb-3">技能内容</h3>
                  <div className="bg-surface-1 border border-edge rounded-xl p-4 text-sm text-body leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {selected?.content || '暂无内容'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* footer */}
          {showDetail && (editing || isNew) ? (
            <div className="px-6 py-4 border-t border-edge-subtle flex items-center justify-between">
              {selected && !selected.builtin && !isNew ? (
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-400 hover:text-red-300 transition cursor-pointer border-none bg-transparent"
                >
                  删除 Skill
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={cancel}
                  className="px-4 h-9 rounded-xl text-xs text-body bg-surface-1 hover:bg-surface-hover transition cursor-pointer border-none"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 h-9 rounded-xl text-xs font-medium bg-white text-black hover:bg-zinc-200 transition cursor-pointer border-none"
                >
                  {isNew ? '创建 Skill' : '保存修改'}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 border-t border-edge-subtle">
              {/* 详情态底部留空，保持视觉平衡 */}
            </div>
          )}
        </main>
      </div>
    </section>
  )
}
