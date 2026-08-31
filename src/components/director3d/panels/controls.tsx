import type { LucideIcon } from 'lucide-react'
import { Link2, Lock, Unlock, Unlink2 } from 'lucide-react'
import { degToRad, radToDeg } from '../project.ts'

export interface ToolButtonProps {
  icon: LucideIcon
  /** 高亮态（如吸附/锁定选中时亮起） */
  active?: boolean
  label: string
  onClick: () => void
  disabled?: boolean
  shortcut?: string
}

export function ToolButton({ icon: Icon, active = false, label, onClick, disabled = false, shortcut }: ToolButtonProps) {
  return (
    <button className={`icon-button ${active ? 'is-active' : ''}`} onClick={onClick} disabled={disabled} title={`${label}${shortcut ? ` (${shortcut})` : ''}`} aria-label={label}>
      <Icon size={15} strokeWidth={1.8} />
    </button>
  )
}

export interface AxisSliderProps {
  label: string
  title: string
  value: number
  onChange: (value: number) => void
  accent: string
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  locked?: boolean
  onToggleLock?: () => void
}

export function AxisSlider({ label, title, value, onChange, accent, min, max, step, unit = '', disabled = false, locked = false, onToggleLock }: AxisSliderProps) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0
  const safeMin = Math.min(min, Math.floor(numericValue / step) * step)
  const safeMax = Math.max(max, Math.ceil(numericValue / step) * step)
  const digits = step < 0.1 ? 2 : step < 1 ? 1 : 0
  return (
    <div className={`axis-slider ${onToggleLock ? 'has-axis-lock' : ''} ${locked ? 'is-axis-locked' : ''}`} style={{ '--axis-color': accent } as React.CSSProperties}>
      <span>{label}</span>
      <input aria-label={`${title} ${label}`} type="range" min={safeMin} max={safeMax} step={step} value={numericValue} onChange={event => onChange(Number(event.target.value))} disabled={disabled || locked} />
      <output>{numericValue.toFixed(digits)}{unit}</output>
      {onToggleLock && <button type="button" className="axis-lock-button" aria-label={`${locked ? '解除' : '锁定'}缩放 ${label} 轴`} aria-pressed={locked} title={`${locked ? '解除' : '锁定'} ${label} 轴缩放`} onClick={onToggleLock}>{locked ? <Lock size={10} /> : <Unlock size={10} />}</button>}
    </div>
  )
}

export interface VectorFieldsProps {
  title: string
  value: number[]
  onChange: (value: number[]) => void
  degrees?: boolean
  kind?: 'position' | 'rotation' | 'scale'
  disabled?: boolean
  proportionalScale?: boolean
  scaleAxisLocks?: boolean[]
  onToggleProportionalScale?: () => void
  onToggleScaleAxis?: (axis: number) => void
}

export function VectorFields({ title, value, onChange, degrees = false, kind = 'position', disabled = false, proportionalScale = false, scaleAxisLocks = [false, false, false], onToggleProportionalScale, onToggleScaleAxis }: VectorFieldsProps) {
  const display = degrees ? value.map(radToDeg) : value
  const settings = degrees
    ? { min: -180, max: 180, step: 1, unit: '°' }
    : kind === 'scale'
      ? { min: 0.1, max: 5, step: 0.05, unit: '' }
      : { min: -30, max: 30, step: 0.05, unit: '' }
  const update = (index, next) => {
    if (kind === 'scale' && scaleAxisLocks[index]) return
    const copy = [...display]
    if (kind === 'scale' && proportionalScale) {
      const baseline = Math.max(0.0001, Math.abs(display[index]))
      const ratio = next / baseline
      display.forEach((current, axis) => { copy[axis] = scaleAxisLocks[axis] ? current : Math.max(0.05, current * ratio) })
    } else copy[index] = next
    onChange(degrees ? copy.map(degToRad) : copy)
  }
  return (
    <div className="property-group">
      <div className="property-label-row">
        <div className="property-label">{title}</div>
        {kind === 'scale' && <button type="button" className={`proportional-lock ${proportionalScale ? 'is-active' : ''}`} aria-pressed={proportionalScale} onClick={onToggleProportionalScale} disabled={disabled} title="开启后拖动任意未锁定轴，其他未锁定轴按原比例同步缩放">{proportionalScale ? <Link2 size={11} /> : <Unlink2 size={11} />} 等比</button>}
      </div>
      <div className="axis-sliders">
        <AxisSlider label="X" title={title} value={display[0]} onChange={value => update(0, value)} accent="#d7675b" disabled={disabled} locked={kind === 'scale' && Boolean(scaleAxisLocks[0])} onToggleLock={kind === 'scale' ? () => onToggleScaleAxis?.(0) : null} {...settings} />
        <AxisSlider label="Y" title={title} value={display[1]} onChange={value => update(1, value)} accent="#76a96c" disabled={disabled} locked={kind === 'scale' && Boolean(scaleAxisLocks[1])} onToggleLock={kind === 'scale' ? () => onToggleScaleAxis?.(1) : null} {...settings} />
        <AxisSlider label="Z" title={title} value={display[2]} onChange={value => update(2, value)} accent="#5d87c7" disabled={disabled} locked={kind === 'scale' && Boolean(scaleAxisLocks[2])} onToggleLock={kind === 'scale' ? () => onToggleScaleAxis?.(2) : null} {...settings} />
      </div>
    </div>
  )
}
