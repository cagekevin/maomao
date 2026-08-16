import React, { useMemo, useRef, useState } from 'react'
import { Search, Plus, Bot, Sparkles, Upload, Download } from 'lucide-react'
import { getAllSkills, upsertCustomSkill, deleteCustomSkill } from '../../skillStore.js'
import { showToast } from '../../toastStore.js'

const inputCls =
  'w-full bg-canvas border border-edge text-zinc-200 text-sm px-3 py-2.5 rounded-xl outline-none placeholder:text-zinc-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10 transition disabled:opacity-50'

const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'builtin', label: '内置' },
  { value: 'custom', label: '自定义' },
]

function emptyForm() {
  return { id: '', name: '', description: '', content: '' }
}

export default function SkillSettings() {
  const [allSkills, setAllSkills] = useState(() => getAllSkills())
  const [selectedId, setSelectedId] = useState('')
  const [category, setCategory] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [isNew, setIsNew] = useState(false)
  const mdFileRef = useRef(null)

  const list = useMemo(() => {
    let result = allSkills
    if (category === 'builtin') result = result.filter((s) => s.builtin)
    if (category === 'custom') result = result.filter((s) => !s.builtin)
    if (keyword.trim()) {
      const k = keyword.toLowerCase()
      result = result.filter((s) => s.name?.toLowerCase().includes(k) || s.description?.toLowerCase().includes(k))
    }
    return result
  }, [allSkills, category, keyword])

  const selected = allSkills.find((s) => s.id === selectedId) || null
  const readonly = !!(selected && selected.builtin && !isNew)

  const handleSelect = (skill) => {
    setSelectedId(skill.id)
    setIsNew(false)
    setForm({ id: skill.id, name: skill.name || '', description: skill.description || '', content: skill.content || '' })
  }

  const handleNew = () => {
    setSelectedId('')
    setIsNew(true)
    setForm(emptyForm())
  }

  const handleSave = () => {
    const name = form.name.trim()
    const content = form.content.trim()
    if (!name) return showToast('请填写 Skill 名称', { type: 'warning' })
    if (!content) return showToast('请填写 Skill 内容', { type: 'warning' })
    const saved = upsertCustomSkill({ id: form.id || undefined, name, description: form.description.trim(), content })
    setAllSkills(getAllSkills())
    setSelectedId(saved.id)
    setIsNew(false)
    setForm({ id: saved.id, name: saved.name, description: saved.description, content: saved.content })
    showToast('Skill 已保存', { type: 'success' })
  }

  const handleDelete = () => {
    if (!selected || selected.builtin) return
    if (!window.confirm(`删除 Skill「${selected.name}」？`)) return
    deleteCustomSkill(selected.id)
    setAllSkills(getAllSkills())
    setSelectedId('')
    setIsNew(false)
    setForm(emptyForm())
    showToast('Skill 已删除', { type: 'success' })
  }

  const cancel = () => {
    setSelectedId('')
    setIsNew(false)
    setForm(emptyForm())
  }

  // .md 导入为自定义预设（对齐大雄「保存为预设」语义；content 走 upsertCustomSkill 内置 mojibake 清洗）
  const handleMdImport = (e) => {
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
            setAllSkills(getAllSkills())
            setSelectedId(saved.id)
            setIsNew(false)
            setForm({ id: saved.id, name: saved.name, description: saved.description, content: saved.content })
            showToast(`已导入 Skill「${saved.name}」`, { type: 'success' })
          } else {
            showToast(`导入失败：${name} 缺少名称或内容`, { type: 'error' })
          }
        }
        reader.onerror = () => showToast(`读取失败：${f.name}`, { type: 'error' })
        reader.readAsText(f, 'utf-8')
      })
    } finally {
      e.target.value = ''
    }
  }

  // .md 导出当前选中 Skill（Blob 下载）
  const handleMdExport = () => {
    const target = selected || (isNew && form.name ? form : null)
    if (!target || !target.content) return showToast('请先选择一个有内容的 Skill', { type: 'warning' })
    const blob = new Blob([target.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${target.name || 'skill'}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast(`已导出 ${a.download}`, { type: 'success' })
  }

  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-edge-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm text-white font-medium flex items-center gap-2">
            <Bot size={17} className="text-zinc-400" />
            Skill Library
          </h3>
          <p className="text-xs text-zinc-500 mt-1">管理 AI 助手能力模块</p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-surface-1 text-xs text-zinc-400">{allSkills.length} Skills</div>
      </div>

      <div className="flex h-[620px]">
        {/* 左栏：搜索 + 分类 + 新建 + 列表 */}
        <aside className="w-[260px] shrink-0 border-r border-edge-subtle flex flex-col">
          {/* 搜索 */}
          <div className="p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索 Skill"
                className="w-full h-9 bg-canvas border border-edge rounded-xl pl-9 pr-3 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          {/* 分类 */}
          <div className="px-4 flex gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategory(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs transition cursor-pointer border-none ${
                  category === opt.value ? 'bg-white text-black' : 'bg-surface-1 text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 新建 + 导入/导出 */}
          <div className="p-4 flex gap-2">
            <button
              onClick={handleNew}
              className="flex-1 h-9 rounded-xl bg-white text-black text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition cursor-pointer border-none"
            >
              <Plus size={14} /> 新建
            </button>
            <input ref={mdFileRef} type="file" accept=".md,.markdown,.txt" multiple onChange={handleMdImport} className="hidden" />
            <button
              onClick={() => mdFileRef.current?.click()}
              className="h-9 rounded-xl bg-surface-1 text-xs text-zinc-300 px-3 flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none"
              title="导入 .md 为自定义 Skill"
            >
              <Upload size={14} /> 导入
            </button>
            <button
              onClick={handleMdExport}
              disabled={!selected && !(isNew && form.name)}
              className="h-9 rounded-xl bg-surface-1 text-xs text-zinc-300 px-3 flex items-center justify-center gap-1.5 hover:bg-surface-hover transition cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
              title="导出当前 Skill 为 .md"
            >
              <Download size={14} /> 导出
            </button>
          </div>

          {/* 列表 */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {list.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-600 px-5 text-center">暂无 Skill</div>
            ) : list.map((skill) => {
              const active = skill.id === selectedId && !isNew
              return (
                <button
                  key={skill.id}
                  onClick={() => handleSelect(skill)}
                  className={`w-full text-left px-3 py-3 rounded-xl border transition group cursor-pointer ${
                    active ? 'bg-surface-active border-edge' : 'border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-200 truncate">{skill.name}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md ${
                      skill.builtin ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {skill.builtin ? '内置' : '自定义'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 truncate">{skill.description || skill.content?.slice(0, 40)}</p>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 右栏：编辑区 */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-6">
            {!selected && !isNew ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-1 flex items-center justify-center mb-4">
                  <Sparkles size={25} className="text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400">选择一个 Skill</p>
                <p className="text-xs text-zinc-600 mt-1">查看或编辑 AI 能力配置</p>
              </div>
            ) : (
              <div className="max-w-2xl">
                {/* 标题 */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base text-white font-medium">{isNew ? '新建 Skill' : selected?.name}</h2>
                    {!isNew && (
                      <div className="mt-1 text-xs text-zinc-500">{selected?.builtin ? '系统内置能力' : '自定义能力'}</div>
                    )}
                  </div>
                  {readonly && <span className="text-xs text-zinc-500">内置 Skill 只读</span>}
                </div>

                {/* 表单 */}
                <div className="bg-surface-1 border border-edge rounded-2xl p-5 space-y-4">
                  <label>
                    <span className="block text-xs text-zinc-400 mb-2">名称</span>
                    <input
                      value={form.name}
                      disabled={readonly}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例如：商品详情页生成"
                      className={inputCls}
                    />
                  </label>

                  <label>
                    <span className="block text-xs text-zinc-400 mb-2">描述</span>
                    <input
                      value={form.description}
                      disabled={readonly}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="简单描述这个 Skill 的用途"
                      className={inputCls}
                    />
                  </label>

                  <label>
                    <span className="block text-xs text-zinc-400 mb-2">AI Instructions</span>
                    <div className="relative">
                      <textarea
                        value={form.content}
                        disabled={readonly}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="输入 AI 助手需要长期遵循的行为规则..."
                        className="w-full min-h-[340px] bg-canvas border border-edge rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none resize-none focus:border-blue-500/50 transition disabled:opacity-50"
                      />
                      <span className="absolute right-3 bottom-3 text-[10px] text-zinc-600">Skill Prompt</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* footer：删除 + 取消/保存 */}
          <div className="px-6 py-4 border-t border-edge-subtle flex items-center justify-between">
            {selected && !selected.builtin && !isNew ? (
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 transition cursor-pointer border-none bg-transparent">
                删除 Skill
              </button>
            ) : (
              <span />
            )}
            {!readonly && (
              <div className="flex gap-2">
                <button onClick={cancel} className="px-4 h-9 rounded-xl text-xs text-zinc-300 bg-surface-1 hover:bg-surface-hover transition cursor-pointer border-none">
                  取消
                </button>
                <button onClick={handleSave} className="px-5 h-9 rounded-xl text-xs font-medium bg-white text-black hover:bg-zinc-200 transition cursor-pointer border-none">
                  {isNew ? '创建 Skill' : '保存修改'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </section>
  )
}
