import { RotateCcw } from 'lucide-react'

/**
 * 全局设置栏：与选中物体无关的画布/工程级设置。
 * 当前包含「画幅比例」「时间轴」「视口」与「光照」，未来可扩展「参考图」「背景」等。
 * 独立成模块避免 App.jsx 膨胀。
 */

const ASPECT_RATIOS = [
  { value: '16:9', label: '16 : 9 · 横屏视频', ratio: 16 / 9 },
  { value: '9:16', label: '9 : 16 · 竖屏短视频', ratio: 9 / 16 },
  { value: '4:3', label: '4 : 3 · 经典画幅', ratio: 4 / 3 },
  { value: '3:4', label: '3 : 4 · 竖版经典画幅', ratio: 3 / 4 },
  { value: '3:2', label: '3 : 2 · 摄影画幅', ratio: 3 / 2 },
  { value: '1:1', label: '1 : 1 · 方形画幅', ratio: 1 },
  { value: '1.85:1', label: '1.85 : 1 · 影院宽屏', ratio: 1.85 },
  { value: '2.39:1', label: '2.39 : 1 · 电影宽银幕', ratio: 2.39 },
  { value: 'custom', label: '自定义画幅' },
]
const FPS_OPTIONS = [24, 25, 30]
const CUSTOM_ASPECT_PATTERN = /^custom:([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/
const DEFAULT_LIGHTING = {
  ambientIntensity: 1.35, keyIntensity: 2.8, fillIntensity: 1.1,
  keyAzimuth: 39, keyElevation: 51, exposure: 0.9,
  ambientColor: '#f7f1e6', keyColor: '#fff6e8', fillColor: '#a9c2c6',
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const cleanAspectPart = value => String(Math.round(clamp(Number(value) || 1, 0.1, 100) * 100) / 100)
const customAspectParts = value => {
  const match = String(value || '').match(CUSTOM_ASPECT_PATTERN)
  return match ? [Number(match[1]), Number(match[2])] : [16, 9]
}
const customAspectValue = (width, height) => `custom:${cleanAspectPart(width)}:${cleanAspectPart(height)}`
const aspectSelectValue = value => CUSTOM_ASPECT_PATTERN.test(String(value || '')) ? 'custom' : value
const customAspectFrom = value => {
  if (aspectSelectValue(value) === 'custom') return value
  const parts = String(value || '16:9').split(':').map(Number)
  return customAspectValue(parts[0] || 16, parts[1] || 9)
}
const normalizeLighting = lighting => {
  const numeric = (value, fallback, minimum, maximum) => {
    const parsed = Number(value)
    return clamp(Number.isFinite(parsed) ? parsed : fallback, minimum, maximum)
  }
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback
  return {
    ambientIntensity: numeric(lighting.ambientIntensity, DEFAULT_LIGHTING.ambientIntensity, 0, 3),
    keyIntensity: numeric(lighting.keyIntensity, DEFAULT_LIGHTING.keyIntensity, 0, 6),
    fillIntensity: numeric(lighting.fillIntensity, DEFAULT_LIGHTING.fillIntensity, 0, 4),
    keyAzimuth: numeric(lighting.keyAzimuth, DEFAULT_LIGHTING.keyAzimuth, -180, 180),
    keyElevation: numeric(lighting.keyElevation, DEFAULT_LIGHTING.keyElevation, 5, 85),
    exposure: numeric(lighting.exposure, DEFAULT_LIGHTING.exposure, 0.25, 1.75),
    ambientColor: color(lighting.ambientColor, DEFAULT_LIGHTING.ambientColor),
    keyColor: color(lighting.keyColor, DEFAULT_LIGHTING.keyColor),
    fillColor: color(lighting.fillColor, DEFAULT_LIGHTING.fillColor),
  }
}

export function GlobalSettingsPanel({ cameraAspect, onAspectChange, projectSettings, onApplySettings, maxKeyframeFrame = 0, showGrid, onToggleGrid, performanceMode, onTogglePerformance, lighting, onLightingChange }) {
  const selected = aspectSelectValue(cameraAspect)
  const [customWidth, customHeight] = customAspectParts(cameraAspect)
  const settings = projectSettings || {}
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
    <div className="inspector-scroll global-settings-panel">
      <div className="inspector-section">
        <div className="section-title"><span>全局设置</span></div>

        {/* 画幅（影响导出画面，最常用） */}
        <div className="property-group">
          <label className="select-field"><span>画幅比例</span><select value={aspectSelectValue(cameraAspect)} onChange={event => onAspectChange(event.target.value === 'custom' ? customAspectFrom(cameraAspect) : event.target.value)}>{ASPECT_RATIOS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {selected === 'custom' && (
            <div className="custom-aspect-inputs"><span>自定义</span><input aria-label="自定义画幅宽" type="number" min="0.1" max="100" step="0.1" value={customWidth} onChange={event => onAspectChange(customAspectValue(event.target.value, customHeight))} /><i>:</i><input aria-label="自定义画幅高" type="number" min="0.1" max="100" step="0.1" value={customHeight} onChange={event => onAspectChange(customAspectValue(customWidth, event.target.value))} /></div>
          )}
        </div>

        {/* 视口（日常开关） */}
        <div className="section-title timeline-section-title"><span>视口</span></div>
        <div className="property-group">
          <div className="global-check-row">
            <label className="global-check"><input type="checkbox" checked={Boolean(showGrid)} onChange={onToggleGrid} /><span>显示网格</span></label>
            <label className="global-check"><input type="checkbox" checked={Boolean(performanceMode)} onChange={onTogglePerformance} /><span>性能模式</span></label>
          </div>
        </div>

        {/* 时间轴（工程参数） */}
        <div className="section-title timeline-section-title"><span>时间轴</span></div>
        <div className="property-group">
          <label className="select-field"><span>工程名称</span><input className="settings-name-input" value={settings.name || ''} maxLength="40" onChange={event => onApplySettings({ ...settings, name: event.target.value })} /></label>
          <div className="global-settings-row">
            <label className="select-field"><span>帧率</span><select value={settings.fps || 24} onChange={event => onApplySettings({ ...settings, fps: Number(event.target.value) })}>{FPS_OPTIONS.map(value => <option value={value} key={value}>{value} FPS</option>)}</select></label>
            <label className="select-field"><span>总时长</span><input className="settings-duration-input" type="number" min="1" max="60" step="1" value={settings.durationSeconds || 15} onChange={event => onApplySettings({ ...settings, durationSeconds: Number(event.target.value) })} /></label>
          </div>
          <label className="global-check"><input type="checkbox" checked={Boolean(settings.loopPlayback)} onChange={event => onApplySettings({ ...settings, loopPlayback: event.target.checked })} /><span>循环播放</span></label>
          {hasDurationConflict && <p className="settings-warning">当前时长放不下关键帧，请至少设置 {requiredSeconds} 秒。</p>}
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
  )
}

const cloneDefaultLighting = { ...DEFAULT_LIGHTING }

export default GlobalSettingsPanel
