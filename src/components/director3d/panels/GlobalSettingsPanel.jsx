import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  ASPECT_RATIOS, DEFAULT_LIGHTING, FPS_OPTIONS, aspectSelectValue, customAspectFrom,
  customAspectParts, customAspectValue, normalizeLighting,
} from '../project.js'

/**
 * 全局设置栏：与选中物体无关的画布/工程级设置。
 * 当前包含「画幅比例」「时间轴」「视口」与「光照」，未来可扩展「参考图」「背景」等。
 * 独立成模块避免 App.jsx 膨胀；常量/解析工具统一复用 project.js，不在此重复定义。
 */

export function GlobalSettingsPanel({ cameraAspect, onAspectChange, projectSettings, onApplySettings, maxKeyframeFrame = 0, showGrid, onToggleGrid, performanceMode, onTogglePerformance, seamlessBackground, onToggleSeamless, lighting, onLightingChange }) {
  const selected = aspectSelectValue(cameraAspect)
  const [customWidth, customHeight] = customAspectParts(cameraAspect)
  const settings = projectSettings || {}
  // 总时长输入本地暂存：输入过程不生效，失焦/回车才提交，避免"想填 15 时敲到 1 就已生效"
  const [durationDraft, setDurationDraft] = useState(null)
  const durationValue = durationDraft ?? settings.durationSeconds ?? 15
  const commitDuration = value => {
    setDurationDraft(null)
    const seconds = Math.min(60, Math.max(1, Number(value)))
    if (!Number.isFinite(seconds)) return
    onApplySettings({ ...settings, durationSeconds: seconds })
  }
  const totalFrames = Number(settings.fps) * Number(settings.durationSeconds)
  const safeMaxKeyframeFrame = Number.isFinite(maxKeyframeFrame) ? maxKeyframeFrame : 0
  const requiredSeconds = Math.max(1, Math.ceil(safeMaxKeyframeFrame / (Number(settings.fps) || 24)))
  const hasDurationConflict = Number.isFinite(totalFrames) && totalFrames < safeMaxKeyframeFrame
  const updateLighting = patch => onLightingChange(current => normalizeLighting({ ...current, ...patch }))
  const lightRange = (label, key, minimum, maximum, step, suffix = '') => (
    <label className="lighting-range" key={key}>
      <span>{label}</span>
      <input type="range" aria-label={label} min={minimum} max={maximum} step={step} value={lighting[key]} onChange={event => updateLighting({ [key]: Number(event.target.value) })} />
      <output>{Number(lighting[key]).toFixed(step < 1 ? 2 : 0)}{suffix}</output>
    </label>
  )
  const lightColor = (label, key) => (
    <label className="lighting-color" key={key}>
      <span>{label}</span>
      <input type="color" aria-label={label} value={lighting[key]} onChange={event => updateLighting({ [key]: event.target.value })} />
      <output>{lighting[key]}</output>
    </label>
  )
  return (
    <div className="global-settings-panel">
      <div className="global-settings-head">
        <div><strong>全局设置</strong></div>
      </div>
      <div className="inspector-scroll global-settings-scroll">
        <div className="inspector-section">
          <div className="property-group">
          <label className="select-field"><span>工程名称</span><input className="settings-name-input" value={settings.name || ''} maxLength="40" onChange={event => onApplySettings({ ...settings, name: event.target.value })} /></label>
          <div className="global-settings-row">
            <label className="select-field"><span>帧率</span><select value={settings.fps || 24} onChange={event => onApplySettings({ ...settings, fps: Number(event.target.value) })}>{FPS_OPTIONS.map(value => <option value={value} key={value}>{value} FPS</option>)}</select></label>
            <label className="select-field"><span>总时长</span><input className="settings-duration-input" type="number" min="1" max="60" step="1" value={durationValue} onChange={event => setDurationDraft(event.target.value)} onBlur={event => commitDuration(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') commitDuration(event.target.value) }} /></label>
          </div>
          <label className="select-field"><span>画幅比例</span><select value={aspectSelectValue(cameraAspect)} onChange={event => onAspectChange(event.target.value === 'custom' ? customAspectFrom(cameraAspect) : event.target.value)}>{ASPECT_RATIOS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {selected === 'custom' && (
            <div className="custom-aspect-inputs"><span>自定义</span><input aria-label="自定义画幅宽" type="number" min="0.1" max="100" step="0.1" value={customWidth} onChange={event => onAspectChange(customAspectValue(event.target.value, customHeight))} /><i>:</i><input aria-label="自定义画幅高" type="number" min="0.1" max="100" step="0.1" value={customHeight} onChange={event => onAspectChange(customAspectValue(customWidth, event.target.value))} /></div>
          )}
          <label className={`global-check loop-playback-check ${settings.loopPlayback ? 'is-checked' : ''}`}><input type="checkbox" checked={Boolean(settings.loopPlayback)} onChange={event => onApplySettings({ ...settings, loopPlayback: event.target.checked })} /><span>循环播放</span></label>
          {hasDurationConflict && <p className="settings-warning">当前时长放不下关键帧，请至少设置 {requiredSeconds} 秒。</p>}
        </div>

        {/* 视口（日常开关） */}
        <div className="section-title timeline-section-title"><span>视口</span></div>
        <div className="property-group">
          <div className="global-check-row">
            <label className={`global-check ${showGrid ? 'is-checked' : ''}`}><input type="checkbox" checked={Boolean(showGrid)} onChange={onToggleGrid} /><span>显示网格</span></label>
            <label className={`global-check ${performanceMode ? 'is-checked' : ''}`}><input type="checkbox" checked={Boolean(performanceMode)} onChange={onTogglePerformance} /><span>性能模式</span></label>
            <label className={`global-check ${seamlessBackground ? 'is-checked' : ''}`}><input type="checkbox" checked={Boolean(seamlessBackground)} onChange={onToggleSeamless} /><span>无缝背景</span></label>
          </div>
        </div>

        {/* 光照（微调，最低频） */}
        <div className="section-title timeline-section-title section-title-with-action">
          <span>光照</span>
          <button type="button" className="global-reset-light" onClick={() => onLightingChange(cloneDefaultLighting)}><RotateCcw size={11} /> 恢复默认</button>
        </div>
        <div className="property-group">
          {lightRange('环境亮度', 'ambientIntensity', 0, 3, 0.05)}
          {lightRange('主光亮度', 'keyIntensity', 0, 6, 0.05)}
          {lightRange('补光亮度', 'fillIntensity', 0, 4, 0.05)}
          {lightRange('水平方向', 'keyAzimuth', -180, 180, 1, '°')}
          {lightRange('主光高度', 'keyElevation', 5, 85, 1, '°')}
          {lightRange('画面曝光', 'exposure', 0.25, 1.75, 0.01)}
          <div className="lighting-colors">
            {lightColor('环境色', 'ambientColor')}
            {lightColor('主光色', 'keyColor')}
            {lightColor('补光色', 'fillColor')}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

const cloneDefaultLighting = { ...DEFAULT_LIGHTING }

export default GlobalSettingsPanel
