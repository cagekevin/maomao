import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, FileImage, Move3D, Trash2 } from 'lucide-react'
import { cloneProjectValue, DEFAULT_REFERENCE, normalizeReference } from '../project.js'

export function ReferenceOverlay({ reference, onChange, cameraMode = false, cameraAspect = 16 / 9, children }) {
  const dragRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const update = patch => onChange(current => normalizeReference({ ...current, ...patch }))
  const beginDrag = event => {
    if (!editing) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.parentElement.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: reference.x, y: reference.y, width: bounds.width, height: bounds.height }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveDrag = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    update({
      x: drag.x + (event.clientX - drag.startX) / Math.max(1, drag.width) * 100,
      y: drag.y + (event.clientY - drag.startY) / Math.max(1, drag.height) * 100,
    })
  }
  const endDrag = event => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }
  const hasImage = Boolean(reference.image)
  const referenceLayer = hasImage && reference.visible ? (
    <div className={`reference-layer ${editing ? 'is-editing' : ''}`} aria-label={`参考图 ${reference.name}`}>
      <img
        src={reference.image}
        alt={reference.name || '动作参考图'}
        draggable="false"
        style={{ left: `${50 + reference.x}%`, top: `${50 + reference.y}%`, width: `${72 * reference.scale}%`, opacity: reference.opacity }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  ) : null
  return (
    <>
      {hasImage && (
        <div className={`reference-panel floating-panel ${!expanded ? 'is-collapsed' : ''}`}>
          {!expanded ? (
            <button type="button" className="reference-expand" title="展开参考图工具" aria-label="展开参考图工具" onClick={() => setExpanded(true)}><FileImage size={13} /><ChevronDown size={11} /></button>
          ) : (
            <>
              <button type="button" className={reference.visible ? 'is-active' : ''} onClick={() => update({ visible: !reference.visible })}>{reference.visible ? '隐藏' : '显示'}</button>
              <button type="button" className={editing ? 'is-active' : ''} onClick={() => { setEditing(value => !value); update({ visible: true }) }}><Move3D size={12} /> {editing ? '锁定' : '移动图'}</button>
              <button type="button" title="移除参考图" aria-label="移除参考图" onClick={() => { onChange(cloneProjectValue(DEFAULT_REFERENCE)); setEditing(false); setExpanded(true) }}><Trash2 size={12} /></button>
              <label><span>透明</span><input aria-label="参考图透明度" type="range" min="0.1" max="1" step="0.05" value={reference.opacity} onChange={event => update({ opacity: Number(event.target.value) })} /></label>
              <label><span>大小</span><input aria-label="参考图大小" type="range" min="0.25" max="2" step="0.05" value={reference.scale} onChange={event => update({ scale: Number(event.target.value) })} /></label>
              <label className="reference-export-toggle"><input aria-label="参考图随 PNG 和 MP4 导出" type="checkbox" checked={reference.includeInExport} onChange={event => update({ includeInExport: event.target.checked })} /><span>进入导出</span></label>
              <button type="button" onClick={() => update({ x: 0, y: 0, scale: 1 })}>居中</button>
              <button type="button" title="收起参考图工具" aria-label="收起参考图工具" onClick={() => { setExpanded(false); setEditing(false) }}><ChevronUp size={12} /></button>
            </>
          )}
        </div>
      )}
      {cameraMode ? (
        <div className="camera-edit-frame">
          <div className="camera-edit-stage" style={{ aspectRatio: cameraAspect, '--camera-aspect': cameraAspect }}>
            {referenceLayer}
            {children}
          </div>
        </div>
      ) : <>{referenceLayer}{children}</>}
    </>
  )
}
