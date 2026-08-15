import React from 'react'
import { Plus, Trash2, Image as ImageIcon, MessageSquare, Video as VideoIcon } from 'lucide-react'

/**
 * 模型清单分区（供应商编辑面板的一部分）。
 * 按能力分类（生图/聊天/视频）管理模型，支持增删改。
 *
 * 每个模型有两个可编辑字段：
 *  - id（必填，真正传给上游的值）：默认空，方便直接填写；清空显示空白。
 *  - label（显示名，可选）：下拉框/Agent 展示的名字，留空则回退 id。
 * 均支持增删改（对内置 readonly provider 同样开放）。
 */
const MODEL_CATS = [
  { key: 'image_models', label: '生图模型', Icon: ImageIcon },
  { key: 'chat_models', label: '聊天模型', Icon: MessageSquare },
  { key: 'video_models', label: '视频模型', Icon: VideoIcon },
]

const inputCls = 'bg-transparent text-gray-200 text-sm outline-none nodrag placeholder-gray-600 disabled:opacity-60 w-full'
const ID_PLACEHOLDER = '模型名（必填，如 gpt-image-2）'

export default function ModelSection({ p, onUpdate }) {
  // 模型清单对内置 readonly provider 同样开放增删改（与连接配置一致，用户要求全放开）
  // 每行 id 输入框 ref（回车新增后聚焦到新行）
  const idRefs = React.useRef({})
  const addItem = (catKey) => {
    const list = p[catKey] || []
    onUpdate({ [catKey]: [...list, { id: '' }] })
    return list.length // 新行索引
  }
  // 回车新增：当前行已有内容才新增空行，并把光标聚焦到新行的 ID 输入框
  const handleEnter = (catKey, i, value) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!(value && value.trim())) return // 空行回车不新增
    const newIndex = addItem(catKey)
    setTimeout(() => {
      const el = idRefs.current[`${catKey}-${newIndex}`]
      if (el) el.focus()
    }, 0)
  }
  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
        <h3 className="text-sm text-gray-200">模型清单</h3>
        <p className="text-xs text-gray-500">按能力分类管理可用模型</p>
      </div>
      <div className="px-5 py-4">
        <div className="space-y-5">
          {MODEL_CATS.map((cat) => {
            const models = p[cat.key] || []
            const Icon = cat.Icon
            const patchItem = (i, patch) =>
              onUpdate({ [cat.key]: models.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 inline-flex items-center gap-1.5"><Icon size={14} className="text-gray-500" /> {cat.label}（{models.length}）</span>
                  <button type="button" onClick={() => onUpdate({ [cat.key]: [...models, { id: '' }] })} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white hover:bg-surface-hover px-2 py-1 rounded-md transition-colors cursor-pointer border-none bg-transparent">
                    <Plus size={12} /> 添加
                  </button>
                </div>
                {models.length === 0 ? (
                  <div className="text-xs text-gray-600 py-2 px-3 bg-canvas border border-dashed border-edge rounded-lg">暂无模型，可点击「拉取模型」自动获取，或点「添加」手动填写</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {models.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 bg-canvas border border-edge rounded-lg px-3 py-2 group/model">
                        <div className="flex-1 min-w-0">
                          {/* 模型 id：真正传给上游的值，必填、可自由填写。回车新增下一行 */}
                          <input
                            ref={(el) => { idRefs.current[`${cat.key}-${i}`] = el }}
                            value={m.id || ''}
                            onChange={(e) => patchItem(i, { id: e.target.value })}
                            onKeyDown={handleEnter(cat.key, i, m.id)}
                            placeholder={ID_PLACEHOLDER}
                            className={inputCls}
                          />
                        </div>
                        <div className="w-36 shrink-0 border-l border-edge pl-2">
                          {/* 显示名 label（可选）：留空回退 id */}
                          <input
                            value={m.label || ''}
                            onChange={(e) => patchItem(i, { label: e.target.value })}
                            placeholder="显示名（可选）"
                            className={`${inputCls} text-gray-400`}
                          />
                        </div>
                        <button type="button" onClick={() => onUpdate({ [cat.key]: models.filter((_, j) => j !== i) })} className="text-gray-600 hover:text-red-500 opacity-0 group-hover/model:opacity-100 transition-opacity border-none bg-transparent cursor-pointer shrink-0" title="删除模型">
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
