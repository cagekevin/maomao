import React from 'react'
import { Plus, Trash2, Image as ImageIcon, MessageSquare, Video as VideoIcon } from 'lucide-react'
import { FIXED_PROTOCOL_PROVIDER_IDS } from '../../providerProtocols.js'

/**
 * 模型清单分区（供应商编辑面板的一部分，样式对齐 SkillSettings 的 zinc 黑白系）。
 * 按能力分类（生图/聊天/视频）管理模型，支持增删改。
 * 逻辑不变，仅样式统一到 Skill 面板风格。
 *
 * M5-2 单模型协议选择器：image/chat 类模型（video 除外）、非锁死平台，可在 model_protocols
 * 上按模型覆盖 openai/gemini（C1/C2 契约）。选「默认」或非法值即删除该键。
 *
 * M5-3 模型数据一致性：重命名时迁移 model_protocols/model_names 键（旧名他处仍用则保留旧键），
 * 删除时清理不再被任何模型引用的键。
 */
const MODEL_CATS = [
  { key: 'chat_models', label: '聊天模型', Icon: MessageSquare },
  { key: 'image_models', label: '生图模型', Icon: ImageIcon },
  { key: 'video_models', label: '视频模型', Icon: VideoIcon },
]
// 单模型协议可选值（与后端 providers.ts PER_MODEL_PROTOCOL_OPTIONS 一致）：空串=默认即删键
const PROTOCOL_OPTIONS = ['', 'openai', 'gemini']

const inputCls = 'bg-transparent text-zinc-200 text-sm outline-none nodrag placeholder:text-zinc-600 disabled:opacity-60 w-full'
const ID_PLACEHOLDER = '模型名（必填，如 gpt-image-2）'

/** 该 model id 是否仍被某模型列表引用（排除 (excludeCat, excludeIdx) 那一个）。 */
function idStillUsed(p, id, excludeCat, excludeIdx) {
  return MODEL_CATS.some((cat) =>
    (p[cat.key] || []).some((m, j) => m && m.id && m.id === id && !(cat.key === excludeCat && j === excludeIdx))
  )
}

export default function ModelSection({ p, onUpdate }) {
  const idRefs = React.useRef({})
  const locked = FIXED_PROTOCOL_PROVIDER_IDS.includes(p.id)
  const addProtocolSelect = !locked // 锁死平台忽略单模型协议覆盖，不可选
  const setModelProtocol = (catKey, modelId, val) => {
    if (catKey === 'video_models') return
    const mp = { ...(p.model_protocols || {}) }
    const v = (val || '').toLowerCase()
    if (PROTOCOL_OPTIONS.includes(v)) {
      if (v) mp[modelId] = v
      else delete mp[modelId]
    } else {
      delete mp[modelId]
    }
    onUpdate({ model_protocols: mp })
  }
  const addItem = (catKey) => {
    const list = p[catKey] || []
    onUpdate({ [catKey]: [...list, { id: '' }] })
    return list.length
  }
  const handleEnter = (catKey, i, value) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!(value && value.trim())) return
    const newIndex = addItem(catKey)
    setTimeout(() => {
      const el = idRefs.current[`${catKey}-${newIndex}`]
      if (el) el.focus()
    }, 0)
  }
  /** M5-3 重命名：migrate 键、清理旧键（他处仍用则保留旧键）。 */
  const patchModelId = (catKey, i, oldId, newId) => {
    const patch = { [catKey]: (p[catKey] || []).map((x, j) => (j === i ? { ...x, id: newId } : x)) }
    if (oldId && newId && oldId !== newId) {
      const next = {}
      let changed = false
      for (const k of ['model_protocols', 'model_names']) {
        const map = p[k] || {}
        if (!(oldId in map)) continue
        const n = { ...map, [newId]: map[oldId] }
        if (!idStillUsed(p, oldId, catKey, i)) delete n[oldId]
        next[k] = n
        changed = true
      }
      if (changed) Object.assign(patch, next)
    }
    onUpdate(patch)
  }
  /** M5-3 删除：清理不再被引用的键。 */
  const removeItem = (catKey, idx) => {
    const removed = (p[catKey] || [])[idx]
    const patch = { [catKey]: (p[catKey] || []).filter((_, j) => j !== idx) }
    if (removed && removed.id) {
      const next = {}
      let changed = false
      for (const k of ['model_protocols', 'model_names']) {
        const map = p[k] || {}
        if (removed.id in map && !idStillUsed({ ...p, [catKey]: patch[catKey] }, removed.id, catKey, null)) {
          const n = { ...map }
          delete n[removed.id]
          next[k] = n
          changed = true
        }
      }
      if (changed) Object.assign(patch, next)
    }
    onUpdate(patch)
  }
  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      <div className="px-6 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
        <h3 className="text-sm text-zinc-200">模型清单</h3>
        <p className="text-xs text-zinc-500">按能力分类管理可用模型</p>
      </div>
      <div className="px-6 py-4">
        <div className="space-y-4">
          {MODEL_CATS.map((cat) => {
            const models = p[cat.key] || []
            const Icon = cat.Icon
            const showProtocol = addProtocolSelect && cat.key !== 'video_models'
            const patchItem = (i, patch) =>
              onUpdate({ [cat.key]: models.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 inline-flex items-center gap-1.5"><Icon size={14} className="text-zinc-500" /> {cat.label}（{models.length}）</span>
                  <button type="button" onClick={() => onUpdate({ [cat.key]: [...models, { id: '' }] })} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white hover:bg-surface-hover px-2 py-1 rounded-md transition-colors cursor-pointer border-none bg-transparent">
                    <Plus size={12} /> 添加
                  </button>
                </div>
                {models.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-2 px-3 bg-canvas border border-dashed border-edge rounded-xl">暂无模型，可点击「拉取模型」自动获取，或点「添加」手动填写</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {models.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 bg-canvas border border-edge rounded-xl px-3 py-2 group/model">
                        <div className="flex-1 min-w-0">
                          <input
                            ref={(el) => { idRefs.current[`${cat.key}-${i}`] = el }}
                            value={m.id || ''}
                            onChange={(e) => patchModelId(cat.key, i, m.id || '', e.target.value)}
                            onKeyDown={handleEnter(cat.key, i, m.id)}
                            placeholder={ID_PLACEHOLDER}
                            className={inputCls}
                          />
                        </div>
                        <div className="w-36 shrink-0 border-l border-edge pl-2">
                          <input
                            value={m.label || ''}
                            onChange={(e) => patchItem(i, { label: e.target.value })}
                            placeholder="显示名（可选）"
                            className={`${inputCls} text-zinc-400`}
                          />
                        </div>
                        {showProtocol && (
                          <div className="w-24 shrink-0 border-l border-edge pl-2 flex items-center gap-1">
                            <span className="text-[10px] text-zinc-600 shrink-0">协议</span>
                            <select
                              value={(p.model_protocols && p.model_protocols[m.id]) || ''}
                              onChange={(e) => setModelProtocol(cat.key, m.id, e.target.value)}
                              className="bg-transparent text-zinc-400 text-xs outline-none border-none cursor-pointer"
                            >
                              <option value="">默认</option>
                              <option value="openai">OpenAI</option>
                              <option value="gemini">Gemini</option>
                            </select>
                          </div>
                        )}
                        <button type="button" onClick={() => removeItem(cat.key, i)} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover/model:opacity-100 transition-opacity border-none bg-transparent cursor-pointer shrink-0" title="删除模型">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
