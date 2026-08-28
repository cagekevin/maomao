import React, { useState, useEffect } from 'react'

/**
 * 节点标题栏（复刻原 _Component8.jsx）
 * 显示小图标 + 名称，双击可改名，支持拖拽（drag-handle）。
 *
 * onRename 回调（可选）：
 *  - 传入时，改名 commit 会写回节点数据（如 data.label），让名字流向下游素材匹配；
 *  - 不传则保持「仅本地显示」的原行为，对其他节点零影响。
 * @param {function(string):void} [onRename]
 */
function NodeTitle({ label, defaultTitle, icon, className = '', floating = false, onRename }) {
  const [val, setVal] = useState(label || defaultTitle)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setVal(label || defaultTitle)
  }, [label, defaultTitle])

  const commit = (text) => {
    const next = text.trim() || defaultTitle
    setVal(next)
    if (typeof onRename === 'function') onRename(next)
  }

  return (
    <div
      className={`${floating ? 'absolute -top-6 left-0 z-30' : 'mb-1 self-start'} flex items-center gap-1.5 text-caption-sm text-secondary drag-handle cursor-move ${className || ''}`}
    >
      {icon}
      {editing ? (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => {
            setEditing(false)
            commit(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setEditing(false)
              commit(e.currentTarget.value)
            }
            if (e.key === 'Escape') {
              setEditing(false)
              setVal(label || defaultTitle)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag nowheel nopan w-32 rounded border border-edge-muted bg-surface-black px-1.5 py-0.5 text-caption-sm text-primary outline-none focus:border-blue-500"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          className="max-w-[180px] truncate rounded px-0.5 text-left hover:text-primary hover:bg-white/5"
          title="双击修改名称"
        >
          {val || defaultTitle}
        </button>
      )}
    </div>
  )
}
export default React.memo(NodeTitle)
