import React from 'react'
import { Plus, Trash2, Keyboard } from 'lucide-react'
import shortcutData from '../data/shortcuts.json'

/**
 * 设置分区 · 快捷键
 * 风格照抄一毛官方设置页卡片（bg-surface rounded-xl border-edge-subtle，头 p-4 border-b）。
 * 数据来自 ../data/shortcuts.json（真实画布快捷键，与 useCanvasShortcuts 对齐）。
 */
export default function ShortcutSettings() {
  const [items, setItems] = React.useState(shortcutData.shortcuts || [])

  const updateKeys = (id, keys) => setItems((list) => list.map((it) => (it.id === id ? { ...it, keys } : it)))
  const updateAction = (id, action) => setItems((list) => list.map((it) => (it.id === id ? { ...it, action } : it)))
  const removeItem = (id) => setItems((list) => list.filter((it) => it.id !== id))
  const addItem = () =>
    setItems((list) => [...list, { id: 'sc-' + Date.now().toString(36), action: '新动作', keys: '' }])

  return (
    <div className="group bg-surface rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-edge-subtle">
      {/* 卡片头 */}
      <div className="flex justify-between items-center p-4 border-b border-edge-subtle">
        <div className="font-bold text-gray-200 text-sm flex items-center gap-2">
          <span className="text-gray-500"><Keyboard size={15} /></span>
          快捷键设置
        </div>
        <span className="text-xs text-gray-500">{items.length} 项</span>
      </div>

      {/* 列表 */}
      <div className="px-4 space-y-2 pt-4">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 bg-surface-1 rounded-lg p-2 group/item border border-transparent hover:border-edge transition-colors">
            <div className="flex-1">
              <input
                value={it.action}
                onChange={(e) => updateAction(it.id, e.target.value)}
                placeholder="动作名称"
                className="w-full bg-transparent border-b border-edge-muted px-1 py-1.5 text-xs focus:border-blue-500 outline-none placeholder-gray-600 transition-colors text-gray-200"
              />
            </div>
            <div className="w-[180px]">
              <input
                value={it.keys}
                onChange={(e) => updateKeys(it.id, e.target.value)}
                placeholder="组合键"
                className="w-full bg-canvas border border-edge rounded px-2 py-1.5 text-xs text-center text-gray-300 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => removeItem(it.id)}
              className="text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity border-none bg-transparent cursor-pointer"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <button
          onClick={addItem}
          className="w-full py-2 bg-surface-1 text-gray-400 rounded-lg hover:bg-surface-hover hover:text-gray-200 transition-colors text-xs font-medium"
        >
          + 添加快捷键
        </button>
      </div>
    </div>
  )
}
