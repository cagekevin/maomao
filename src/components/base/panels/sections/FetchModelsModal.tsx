import React from 'react'
import { X, Check, Image as ImageIcon, MessageSquare, Video as VideoIcon, Search } from 'lucide-react'

/**
 * 拉取模型结果弹窗（勾选式保存）。
 * 拉取成功后不直接全量填进 provider，而是让用户勾选要保留的模型，点「确定」才写入。
 * 三栏（生图/聊天/视频）各自可全选/取消，顶部带搜索过滤。
 *
 * props：
 *  - open: boolean
 *  - fetched: { image_models, chat_models, video_models }  后端拉回的原始分类结果
 *  - existing: { image_models, chat_models, video_models }  当前 provider 已存的模型（用于默认勾选）
 *  - fetching: boolean                                      拉取中（弹窗内展示 loading 态）
 *  - onClose: () => void                                    取消（不写入）
 *  - onConfirm: (selected) => void                          selected = { image_models, chat_models, video_models }
 */

const CATS = [
  { key: 'chat_models', label: '聊天模型', Icon: MessageSquare },
  { key: 'image_models', label: '生图模型', Icon: ImageIcon },
  { key: 'video_models', label: '视频模型', Icon: VideoIcon },
]

const modelId = (m) => (m && (m.id || m.label)) || ''
const modelLabel = (m) => (m && (m.label || m.id)) || ''

export default function FetchModelsModal({ open, fetched, existing, fetching, onClose, onConfirm }) {
  // selected: { [catKey]: Set<modelId> }，仅存勾选中的 id 集合
  const [selected, setSelected] = React.useState({ image_models: new Set(), chat_models: new Set(), video_models: new Set() })
  const [keyword, setKeyword] = React.useState('')
  const [tabKey, setTabKey] = React.useState('image_models')

  // 每次打开 / fetched 变化时，初始化为空（默认全不选，由用户自己勾）。
  React.useEffect(() => {
    if (!open || !fetched) return
    setSelected({ image_models: new Set(), chat_models: new Set(), video_models: new Set() })
    setKeyword('')
    // 默认切到第一个有数据的分类 tab
    const first = CATS.find((c) => (fetched[c.key] || []).length > 0)
    setTabKey(first ? first.key : 'image_models')
  }, [open, fetched]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const fetchedList = fetched || { image_models: [], chat_models: [], video_models: [] }
  const kw = keyword.trim().toLowerCase()

  const toggle = (catKey, id) => {
    setSelected((prev) => {
      const next = new Set(prev[catKey])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, [catKey]: next }
    })
  }

  const setCatAll = (catKey, on) => {
    setSelected((prev) => {
      const ids = (fetchedList[catKey] || []).map(modelId)
      const next = new Set(prev[catKey])
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return { ...prev, [catKey]: next }
    })
  }

  const totalSelected = CATS.reduce((n, c) => n + selected[c.key].size, 0)
  const totalAll = CATS.reduce((n, c) => n + (fetchedList[c.key] || []).length, 0)

  const handleConfirm = () => {
    // 合并：勾选的 = 本次拉到的且勾选的 ∪ 已存在但本次未拉到的且仍勾选的
    const out = {}
    for (const cat of CATS) {
      const existMap = new Map((existing?.[cat.key] || []).map((m) => [modelId(m), m]))
      const fetchedMap = new Map((fetchedList[cat.key] || []).map((m) => [modelId(m), m]))
      const ids = new Set([
        ...(fetchedList[cat.key] || []).map(modelId),
        ...selected[cat.key], // 含已存在但本次未拉到的（它们未必在 fetchedList 里）
      ])
      const list = []
      for (const id of selected[cat.key]) {
        list.push(fetchedMap.get(id) || existMap.get(id) || { id, label: id })
      }
      out[cat.key] = list
    }
    onConfirm(out)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-modal" onClick={onClose}>
      <div
        className="bg-surface border border-edge-subtle rounded-2xl shadow-2xl shadow-black/40 w-[760px] max-w-[94vw] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/15 rounded-full flex items-center justify-center">
              <Check size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm text-strong font-medium">选择要保存的模型</h3>
              <p className="text-xs text-muted mt-0.5">默认不勾选，勾选需要保留的模型，点「确定」才写入</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-strong transition-colors border-none bg-transparent cursor-pointer p-1" title="关闭">
            <X size={18} />
          </button>
        </div>

        {/* 搜索 + 已选统计 */}
        <div className="px-6 py-3 border-b border-edge-subtle flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="过滤模型名…"
              className="w-full bg-canvas border border-edge rounded-xl pl-9 pr-3 py-2 text-sm text-body outline-none focus:border-blue-500 transition-colors placeholder:text-muted"
            />
          </div>
          <span className="text-xs text-secondary whitespace-nowrap">已选 <span className="text-blue-400 font-medium">{totalSelected}</span> / 共 {totalAll}</span>
        </div>

        {/* tab 栏 */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-edge-subtle shrink-0">
          {CATS.map((cat) => {
            const Icon = cat.Icon
            const cnt = (fetchedList[cat.key] || []).length
            const active = tabKey === cat.key
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setTabKey(cat.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 h-9 text-xs rounded-t-lg border-b-2 transition-colors cursor-pointer border-none ${active ? 'text-strong border-blue-500 bg-canvas/60' : 'text-muted border-transparent hover:text-body'}`}
              >
                <Icon size={14} className={active ? 'text-blue-400' : 'text-muted'} />
                {cat.label}
                <span className={`ml-0.5 px-1.5 rounded-full text-[10px] ${active ? 'bg-blue-500/20 text-blue-300' : 'bg-surface-1 text-muted'}`}>{cnt}</span>
              </button>
            )
          })}
        </div>

        {/* body：当前 tab 的表格 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {CATS.filter((c) => c.key === tabKey).map((cat) => {
            const all = fetchedList[cat.key] || []
            const filtered = kw ? all.filter((m) => modelId(m).toLowerCase().includes(kw) || modelLabel(m).toLowerCase().includes(kw)) : all
            const selCount = selected[cat.key].size
            const allChecked = all.length > 0 && all.every((m) => selected[cat.key].has(modelId(m)))
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-secondary inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-body">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => setCatAll(cat.key, e.target.checked)}
                      className="accent-blue-500"
                      disabled={all.length === 0}
                    />
                    全选本类
                  </label>
                  <span className="text-xs text-muted">已选 {selCount} / {all.length}</span>
                </div>
                {all.length === 0 ? (
                  <div className="text-xs text-muted py-6 text-center bg-canvas/40 border border-dashed border-edge rounded-xl">无此类模型</div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-muted border-b border-edge-subtle">
                        <th className="w-10 py-2 pl-2 font-normal">选</th>
                        <th className="py-2 font-normal">模型名</th>
                        <th className="py-2 pr-2 font-normal">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => {
                        const id = modelId(m)
                        const checked = selected[cat.key].has(id)
                        return (
                          <tr
                            key={id}
                            onClick={() => toggle(cat.key, id)}
                            className={`border-b border-edge-subtle/60 cursor-pointer transition-colors ${checked ? 'bg-blue-500/5' : 'hover:bg-surface-1'}`}
                          >
                            <td className="py-2 pl-2">
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'border-muted'}`}>
                                {checked && <Check size={12} className="text-strong" />}
                              </span>
                            </td>
                            <td className="py-2 text-body truncate">{modelLabel(m)}</td>
                            <td className="py-2 pr-2 text-[11px] text-muted truncate max-w-[220px]">{id}</td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-xs text-muted py-3 text-center">无匹配「{keyword}」的模型</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-edge-subtle shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 text-xs rounded-xl bg-surface-1 text-body hover:bg-surface-hover transition-colors cursor-pointer border-none"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalSelected === 0}
            className="inline-flex items-center gap-2 px-4 h-9 text-xs font-medium bg-white text-black rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={14} /> 确定保存（{totalSelected}）
          </button>
        </div>
      </div>
    </div>
  )
}
