// monoform 领域逻辑：常量、归一化、逐帧插值、工程序列化。
// 纯逻辑/纯函数，不依赖 React 与组件，供 App.jsx 及各面板复用。
import {
  RIG_PRESET_OPTIONS, cloneJointPose, interpolateJointPose, normalizePoseId, poseCanLoop,
  poseForObject, presetJoints, presetPhase, presetRoot,
} from './rig.js'

export const CAMERA_ID = '__shot_camera__'
export const PROJECT_STORAGE_KEY = 'monoform-project'
export const LEGACY_PROJECT_STORAGE_KEY = 'stageframe-project'
export const CUSTOM_POSE_STORAGE_KEY = 'monoform-custom-poses'
export const PROJECT_VERSION = 16
export const DEFAULT_PROJECT_SETTINGS = {
  name: '未命名场景',
  fps: 24,
  durationSeconds: 15,
  loopPlayback: false,
}
export const DEFAULT_LIGHTING = {
  ambientIntensity: 1.35,
  keyIntensity: 2.8,
  fillIntensity: 1.1,
  keyAzimuth: 39,
  keyElevation: 51,
  exposure: 0.9,
  ambientColor: '#f7f1e6',
  keyColor: '#fff6e8',
  fillColor: '#a9c2c6',
}
export const FPS_OPTIONS = [24, 25, 30]
export const FOCAL_LENGTH_PRESETS = [18, 24, 35, 50, 85, 120]
export const BRAND_MARK_URL = `${import.meta.env.BASE_URL}branding/monoform-mark.png`
export const ASPECT_RATIOS = [
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
export const COMMON_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4']
export const CUSTOM_ASPECT_PATTERN = /^custom:([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/
export const DEFAULT_CAMERA_POSITION = [7.4, 4.6, 8.2]
export const LEGACY_DEFAULT_CAMERA_TARGET = [0.2, 1.2, 0]
export const initialObjects = [
  {
    id: 'actor-lead', name: '人物 · 主角', type: 'person', bodyType: 'standard', pose: 'walk',
    poseTime: presetPhase('walk'), continuousMotion: false, position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1], color: '#e8e3d8', joints: presetJoints(),
  },
  {
    id: 'block-stage', name: '平台', type: 'box',
    position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1], color: '#9a968c',
  },
  {
    id: 'block-step', name: '台阶', type: 'box',
    position: [2.9, 0.18, 0.55], rotation: [0, -0.18, 0], scale: [1.7, 0.36, 1.1], color: '#77746d',
  },
]
export const initialCamera = {
  position: [...DEFAULT_CAMERA_POSITION],
  rotation: cameraRotationToward(DEFAULT_CAMERA_POSITION, LEGACY_DEFAULT_CAMERA_TARGET),
  focalLength: 42,
  aspectRatio: '16:9',
  targetMode: 'manual',
  targetId: '',
}
export const DEFAULT_REFERENCE = {
  image: '',
  name: '',
  opacity: 0.45,
  scale: 1,
  x: 0,
  y: 0,
  visible: true,
  includeInExport: false,
}

export const initialKeyframes = []
export const initialCharacterKeyframes = {}

export const cleanAspectPart = value => String(Math.round(clamp(Number(value) || 1, 0.1, 100) * 100) / 100)
export const customAspectParts = value => {
  const match = String(value || '').match(CUSTOM_ASPECT_PATTERN)
  return match ? [Number(match[1]), Number(match[2])] : [16, 9]
}
export const customAspectValue = (width, height) => `custom:${cleanAspectPart(width)}:${cleanAspectPart(height)}`
export const aspectSelectValue = value => CUSTOM_ASPECT_PATTERN.test(String(value || '')) ? 'custom' : value
export const aspectValue = value => {
  const custom = String(value || '').match(CUSTOM_ASPECT_PATTERN)
  if (custom) return Number(custom[1]) / Math.max(0.1, Number(custom[2]))
  return ASPECT_RATIOS.find(option => option.value === value)?.ratio || 16 / 9
}
export const aspectLabel = value => {
  if (aspectSelectValue(value) === 'custom') {
    const [width, height] = customAspectParts(value)
    return `${width} : ${height} · 自定义`
  }
  return value || '16:9'
}
export const customAspectFrom = value => {
  if (aspectSelectValue(value) === 'custom') return value
  const parts = String(value || '16:9').split(':').map(Number)
  return customAspectValue(parts[0] || 16, parts[1] || 9)
}

export function exportDimensionsForAspect(aspectRatio) {
  const ratio = aspectValue(aspectRatio)
  const even = value => Math.max(2, Math.round(value / 2) * 2)
  return ratio >= 1
    ? { width: 1280, height: even(1280 / ratio) }
    : { width: even(1280 * ratio), height: 1280 }
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
export const radToDeg = value => Math.round((value * 180 / Math.PI) * 10) / 10
export const degToRad = value => Number(value || 0) * Math.PI / 180
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (a, b, t) => a + (b - a) * t
export const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
export const ease = t => t * t * (3 - 2 * t)
export const normalizeInterpolation = value => ['smooth', 'linear', 'hold'].includes(value) ? value : 'smooth'
export const segmentAmount = (key, amount) => key?.interpolation === 'hold' ? 0 : key?.interpolation === 'linear' ? amount : ease(amount)
export const POSE_LABELS = Object.fromEntries(RIG_PRESET_OPTIONS)
export const poseLabel = pose => POSE_LABELS[normalizePoseId(pose)] || '自定义动作'
export const normalizeFrameNumber = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

export function uniqueSortedKeyframes(keys) {
  const byFrame = new Map()
  keys.forEach(key => byFrame.set(key.frame, key))
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

export function clampKeyframeFrames(keys, maxFrame) {
  return uniqueSortedKeyframes((Array.isArray(keys) ? keys : []).map(key => ({
    ...key,
    frame: clamp(normalizeFrameNumber(key?.frame), 0, maxFrame),
  })))
}

export function keyframeMaxFrame(cameraKeys = [], objectTracks = {}) {
  const cameraFrames = Array.isArray(cameraKeys) ? cameraKeys.map(key => normalizeFrameNumber(key?.frame)) : []
  const objectFrames = Object.values(objectTracks || {})
    .flatMap(track => Array.isArray(track) ? track.map(key => normalizeFrameNumber(key?.frame)) : [])
  return Math.max(0, ...cameraFrames, ...objectFrames)
}

export function finiteVector3(value, fallback) {
  return Array.isArray(value) && value.length >= 3
    ? value.slice(0, 3).map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index])
    : [...fallback]
}

export function cameraRotationToward(position, target) {
  const eye = finiteVector3(position, DEFAULT_CAMERA_POSITION)
  const point = finiteVector3(target, LEGACY_DEFAULT_CAMERA_TARGET)
  let dx = point[0] - eye[0]
  let dy = point[1] - eye[1]
  let dz = point[2] - eye[2]
  const length = Math.hypot(dx, dy, dz)
  if (length < 1e-8) return [0, 0, 0]
  dx /= length; dy /= length; dz /= length
  return [Math.asin(Math.min(1, Math.max(-1, dy))), Math.atan2(-dx, -dz), 0]
}

export function normalizeCamera(camera = {}) {
  const position = finiteVector3(camera.position, initialCamera.position)
  const rotation = Array.isArray(camera.rotation)
    ? finiteVector3(camera.rotation, initialCamera.rotation)
    : cameraRotationToward(position, camera.target || LEGACY_DEFAULT_CAMERA_TARGET)
  return {
    position,
    rotation,
    focalLength: clamp(Number(camera.focalLength) || initialCamera.focalLength, 18, 120),
    aspectRatio: ASPECT_RATIOS.some(option => option.ratio && option.value === camera.aspectRatio) || CUSTOM_ASPECT_PATTERN.test(String(camera.aspectRatio || ''))
      ? camera.aspectRatio
      : initialCamera.aspectRatio,
    // 始终面向对象：targetMode 'object' 时摄像机旋转自动朝向 targetId 对象（参考 director3d 的 C4D Target）
    targetMode: camera.targetMode === 'object' ? 'object' : 'manual',
    targetId: typeof camera.targetId === 'string' ? camera.targetId : '',
  }
}

export function normalizeCameraKeyframes(keys = [], fallbackCamera = initialCamera) {
  const source = Array.isArray(keys) ? keys.filter(Boolean) : []
  return uniqueSortedKeyframes(source.map(key => {
    const position = finiteVector3(key.position, fallbackCamera.position)
    return {
      frame: normalizeFrameNumber(key.frame),
      interpolation: normalizeInterpolation(key.interpolation),
      position,
      rotation: Array.isArray(key.rotation)
        ? finiteVector3(key.rotation, fallbackCamera.rotation)
        : cameraRotationToward(position, key.target || LEGACY_DEFAULT_CAMERA_TARGET),
      focalLength: clamp(Number(key.focalLength) || fallbackCamera.focalLength, 18, 120),
    }
  }))
}

export function normalizeReference(reference = {}) {
  const image = typeof reference.image === 'string' && /^data:image\/(?:png|jpe?g|webp);base64,/i.test(reference.image)
    ? reference.image
    : ''
  return {
    image,
    name: image ? String(reference.name || '参考图').slice(0, 80) : '',
    opacity: clamp(Number(reference.opacity) || DEFAULT_REFERENCE.opacity, 0.1, 1),
    scale: clamp(Number(reference.scale) || DEFAULT_REFERENCE.scale, 0.25, 2),
    x: clamp(Number(reference.x) || 0, -75, 75),
    y: clamp(Number(reference.y) || 0, -75, 75),
    visible: reference.visible !== false,
    includeInExport: reference.includeInExport === true,
  }
}

export function normalizeProjectSettings(settings = {}) {
  const fps = FPS_OPTIONS.includes(Number(settings.fps)) ? Number(settings.fps) : DEFAULT_PROJECT_SETTINGS.fps
  const durationSeconds = clamp(Math.round(Number(settings.durationSeconds) || DEFAULT_PROJECT_SETTINGS.durationSeconds), 1, 60)
  return {
    name: String(settings.name || DEFAULT_PROJECT_SETTINGS.name).trim().slice(0, 40) || DEFAULT_PROJECT_SETTINGS.name,
    fps,
    durationSeconds,
    loopPlayback: Boolean(settings.loopPlayback),
  }
}

export function normalizeLighting(lighting = {}) {
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

export function timecodeAtFrame(frame, fps) {
  const safeFrame = Math.max(0, Math.round(frame))
  const frames = safeFrame % fps
  const totalSeconds = Math.floor(safeFrame / fps)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  return [hours, minutes, seconds, frames].map(value => String(value).padStart(2, '0')).join(':')
}

export function normalizePerson(object) {
  if (object?.type !== 'person') return object
  const pose = normalizePoseId(object.pose)
  return {
    ...object,
    pose,
    poseTime: Number.isFinite(object.poseTime) ? object.poseTime : presetPhase(pose),
    rigRoot: Array.isArray(object.rigRoot) ? object.rigRoot.slice(0, 3).map(value => Number(value) || 0) : [0, 0, 0],
    joints: cloneJointPose(object.joints),
    footLock: Boolean(object.footLock),
    continuousMotion: poseCanLoop(pose) && Boolean(object.continuousMotion),
  }
}

export function readCustomPoses() {
  try {
    const poses = JSON.parse(localStorage.getItem(CUSTOM_POSE_STORAGE_KEY) || '[]')
    if (!Array.isArray(poses)) return []
    return poses.filter(pose => pose?.id && pose?.name).map(pose => ({
      ...pose,
      pose: normalizePoseId(pose.pose),
      poseTime: Number.isFinite(pose.poseTime) ? pose.poseTime : presetPhase(pose.pose),
      rigRoot: Array.isArray(pose.rigRoot) ? pose.rigRoot.slice(0, 3) : presetRoot(pose.pose),
      joints: cloneJointPose(pose.joints),
    }))
  } catch {
    return []
  }
}

export function normalizeObjectTracks(tracks = {}) {
  if (!tracks || typeof tracks !== 'object') return {}
  return Object.fromEntries(Object.entries(tracks).map(([id, keys]) => [id, uniqueSortedKeyframes((Array.isArray(keys) ? keys.filter(Boolean) : []).map(key => {
    const pose = normalizePoseId(key.pose)
    return {
      ...key,
      frame: normalizeFrameNumber(key.frame),
      interpolation: normalizeInterpolation(key.interpolation),
      pose,
      poseTime: Number.isFinite(key.poseTime) ? key.poseTime : presetPhase(pose),
      continuousMotion: poseCanLoop(pose) ? (key.continuousMotion === undefined ? undefined : Boolean(key.continuousMotion)) : false,
      rigRoot: Array.isArray(key.rigRoot) ? key.rigRoot.slice(0, 3).map(value => Number(value) || 0) : [0, 0, 0],
      joints: cloneJointPose(key.joints),
    }
  }))]))
}

export const cloneProjectValue = value => JSON.parse(JSON.stringify(value))
export const defaultShotName = index => `镜头 ${String(index + 1).padStart(2, '0')}`

export function uniqueShotName(shots, preferred) {
  const used = new Set(shots.map(shot => String(shot.name || '').trim().toLocaleLowerCase()))
  const base = String(preferred || '镜头').trim().slice(0, 30) || '镜头'
  if (!used.has(base.toLocaleLowerCase())) return base
  for (let copy = 2; copy <= 99; copy += 1) {
    const suffix = ` ${copy}`
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`
    if (!used.has(candidate.toLocaleLowerCase())) return candidate
  }
  return `${base.slice(0, 23)} ${uid().slice(-6)}`
}

export function normalizeShot(shot, index, fallback) {
  const objects = (Array.isArray(shot?.objects) ? shot.objects : fallback.objects).map(normalizePerson)
  const camera = normalizeCamera(shot?.camera || fallback.camera)
  let keyframes = normalizeCameraKeyframes(shot?.keyframes ?? fallback.keyframes ?? [], camera)
  let objectKeyframes = normalizeObjectTracks(shot?.objectKeyframes || shot?.characterKeyframes || fallback.objectKeyframes || {})
  const timing = normalizeProjectSettings({
    fps: shot?.fps ?? shot?.settings?.fps ?? fallback.settings.fps,
    durationSeconds: shot?.durationSeconds ?? shot?.settings?.durationSeconds ?? fallback.settings.durationSeconds,
    loopPlayback: shot?.loopPlayback ?? shot?.settings?.loopPlayback ?? fallback.settings.loopPlayback,
  })
  const maxFrame = keyframeMaxFrame(keyframes, objectKeyframes)
  if (maxFrame > timing.fps * timing.durationSeconds) timing.durationSeconds = clamp(Math.ceil(maxFrame / timing.fps), 1, 60)
  const supportedMaxFrame = timing.fps * timing.durationSeconds
  if (maxFrame > supportedMaxFrame) {
    keyframes = clampKeyframeFrames(keyframes, supportedMaxFrame)
    objectKeyframes = Object.fromEntries(Object.entries(objectKeyframes).map(([id, track]) => [id, clampKeyframeFrames(track, supportedMaxFrame)]))
  }
  return {
    id: String(shot?.id || `shot-${uid()}`),
    name: String(shot?.name || defaultShotName(index)).trim().slice(0, 30) || defaultShotName(index),
    thumbnail: typeof shot?.thumbnail === 'string' && shot.thumbnail.startsWith('data:image/') ? shot.thumbnail : '',
    fps: timing.fps,
    durationSeconds: timing.durationSeconds,
    loopPlayback: timing.loopPlayback,
    objects,
    camera,
    lighting: normalizeLighting(shot?.lighting || fallback.lighting),
    reference: normalizeReference(shot?.reference || fallback.reference),
    keyframes,
    objectKeyframes,
  }
}

export function normalizeProjectData(data) {
  if (!data) return null
  const firstShot = Array.isArray(data.shots) ? data.shots[0] : null
  const sourceObjects = Array.isArray(data.objects) ? data.objects : firstShot?.objects
  if (!Array.isArray(sourceObjects)) return null
  const migrateLegacyDefaultDuration = Number(data.version || 0) < PROJECT_VERSION
  const legacySettingsDuration = Number(data.settings?.durationSeconds)
  const settings = normalizeProjectSettings({
    ...data.settings,
    durationSeconds: migrateLegacyDefaultDuration && legacySettingsDuration === 5 ? DEFAULT_PROJECT_SETTINGS.durationSeconds : data.settings?.durationSeconds,
  })
  const fallback = {
    settings,
    objects: sourceObjects,
    camera: data.camera || firstShot?.camera || initialCamera,
    lighting: data.lighting || firstShot?.lighting || DEFAULT_LIGHTING,
    reference: data.reference || firstShot?.reference || DEFAULT_REFERENCE,
    keyframes: data.keyframes || [],
    objectKeyframes: data.objectKeyframes || data.characterKeyframes || {},
  }
  const rawShots = Array.isArray(data.shots) && data.shots.length ? data.shots : [{
    id: 'shot-01',
    name: '镜头 01',
    fps: settings.fps,
    durationSeconds: settings.durationSeconds,
    loopPlayback: settings.loopPlayback,
    objects: fallback.objects,
    camera: fallback.camera,
    lighting: fallback.lighting,
    keyframes: fallback.keyframes,
    objectKeyframes: fallback.objectKeyframes,
  }]
  const shots = rawShots.slice(0, 30).map((shot, index) => {
    const legacyShotDuration = Number(shot?.durationSeconds ?? shot?.settings?.durationSeconds)
    const migratedShot = migrateLegacyDefaultDuration && legacyShotDuration === 5
      ? { ...shot, durationSeconds: DEFAULT_PROJECT_SETTINGS.durationSeconds, settings: { ...shot?.settings, durationSeconds: DEFAULT_PROJECT_SETTINGS.durationSeconds } }
      : shot
    return normalizeShot(migratedShot, index, fallback)
  })
  const activeShotId = shots.some(shot => shot.id === data.activeShotId) ? data.activeShotId : shots[0].id
  const activeShot = shots.find(shot => shot.id === activeShotId) || shots[0]
  return {
    ...data,
    version: PROJECT_VERSION,
    settings: { ...settings, fps: activeShot.fps, durationSeconds: activeShot.durationSeconds, loopPlayback: activeShot.loopPlayback },
    activeShotId,
    shots,
    objects: activeShot.objects,
    camera: activeShot.camera,
    lighting: activeShot.lighting,
    reference: activeShot.reference,
    keyframes: activeShot.keyframes,
    objectKeyframes: activeShot.objectKeyframes,
  }
}

export function readCachedProject(storageKey) {
  try {
    const key = storageKey || PROJECT_STORAGE_KEY
    const current = localStorage.getItem(key)
    const legacy = current ? null : localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY)
    const serialized = current || legacy
    const data = JSON.parse(serialized || 'null')
    const normalized = normalizeProjectData(data)
    if (!normalized) return null
    if (!current && legacy) localStorage.setItem(key, JSON.stringify(normalized))
    return normalized
  } catch {
    return null
  }
}

export function projectData({ settings, objects, camera, lighting, reference, keyframes, objectKeyframes, shots, activeShotId }) {
  const normalizedSettings = normalizeProjectSettings(settings)
  const sourceShots = shots?.length ? shots : [{ id: 'shot-01', name: '镜头 01' }]
  const resolvedActiveShotId = sourceShots.some(shot => shot.id === activeShotId) ? activeShotId : sourceShots[0].id
  const liveShot = {
    ...(sourceShots.find(shot => shot.id === resolvedActiveShotId) || sourceShots[0]),
    id: resolvedActiveShotId,
    fps: normalizedSettings.fps,
    durationSeconds: normalizedSettings.durationSeconds,
    loopPlayback: normalizedSettings.loopPlayback,
    objects,
    camera,
    lighting: normalizeLighting(lighting),
    reference,
    keyframes,
    objectKeyframes,
  }
  const serializedShots = sourceShots.map(shot => shot.id === resolvedActiveShotId ? liveShot : shot)
  return {
    version: PROJECT_VERSION,
    settings: normalizedSettings,
    activeShotId: resolvedActiveShotId,
    shots: serializedShots,
    objects,
    camera,
    lighting: normalizeLighting(lighting),
    reference,
    keyframes,
    objectKeyframes,
  }
}

export function cameraAtFrame(keyframes, frame, aspectRatio = '16:9') {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)
  if (!sorted.length) return { ...initialCamera, aspectRatio }
  const exact = sorted.find(key => key.frame === frame)
  if (exact) return { ...exact, aspectRatio }
  if (frame <= sorted[0].frame) return { ...sorted[0], aspectRatio }
  if (frame >= sorted.at(-1).frame) return { ...sorted.at(-1), aspectRatio }
  const rightIndex = sorted.findIndex(key => key.frame >= frame)
  const left = sorted[rightIndex - 1]
  const right = sorted[rightIndex]
  const t = segmentAmount(left, (frame - left.frame) / Math.max(1, right.frame - left.frame))
  return {
    position: left.position.map((value, index) => lerp(value, right.position[index], t)),
    rotation: left.rotation.map((value, index) => lerpAngle(value, right.rotation[index], t)),
    focalLength: lerp(left.focalLength, right.focalLength, t),
    aspectRatio,
  }
}

export function objectKeyframeFromObject(object, frame) {
  const rig = poseForObject(object)
  return {
    frame,
    interpolation: 'smooth',
    position: [...object.position],
    rotation: [...object.rotation],
    scale: [...object.scale],
    pose: normalizePoseId(object.pose),
    poseTime: Number.isFinite(object.poseTime) ? object.poseTime : presetPhase(object.pose),
    continuousMotion: poseCanLoop(object.pose) && Boolean(object.continuousMotion),
    rigRoot: [...rig.root],
    joints: cloneJointPose(rig.joints),
  }
}

export function objectAtFrame(object, keyframes = [], frame, fps = DEFAULT_PROJECT_SETTINGS.fps) {
  if (!object) return object
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)
  if (!sorted.length) return object
  const motionEnabled = key => poseCanLoop(key.pose || object.pose) && (key.continuousMotion === undefined ? Boolean(object.continuousMotion) : Boolean(key.continuousMotion))
  const sameState = (leftKey, rightKey) => normalizePoseId(leftKey.pose || object.pose) === normalizePoseId(rightKey.pose || object.pose) && motionEnabled(leftKey) === motionEnabled(rightKey)
  const stateStartFrame = key => {
    let index = sorted.indexOf(key)
    while (index > 0 && sameState(sorted[index - 1], sorted[index])) index -= 1
    return sorted[index]?.frame ?? key.frame
  }
  const applyKey = key => ({
    ...object,
    position: [...key.position],
    rotation: [...key.rotation],
    scale: [...key.scale],
    pose: normalizePoseId(key.pose || object.pose),
    poseTime: Number.isFinite(key.poseTime) ? key.poseTime : presetPhase(key.pose || object.pose),
    continuousMotion: motionEnabled(key),
    motionStartTime: stateStartFrame(key) / fps,
    rigRoot: [...(key.rigRoot || poseForObject({ ...object, pose: key.pose || object.pose }).root)],
    joints: cloneJointPose(key.joints || poseForObject({ ...object, pose: key.pose || object.pose }).joints),
  })
  const exact = sorted.find(key => key.frame === frame)
  if (exact) return applyKey(exact)
  if (frame <= sorted[0].frame) return applyKey(sorted[0])
  if (frame >= sorted.at(-1).frame) return applyKey(sorted.at(-1))
  const rightIndex = sorted.findIndex(key => key.frame >= frame)
  const left = sorted[rightIndex - 1]
  const right = sorted[rightIndex]
  const t = segmentAmount(left, (frame - left.frame) / Math.max(1, right.frame - left.frame))
  const leftRoot = left.rigRoot || poseForObject({ ...object, pose: left.pose || object.pose }).root
  const rightRoot = right.rigRoot || poseForObject({ ...object, pose: right.pose || object.pose }).root
  const leftPoseTime = Number.isFinite(left.poseTime) ? left.poseTime : presetPhase(left.pose || object.pose)
  const rightPoseTime = Number.isFinite(right.poseTime) ? right.poseTime : presetPhase(right.pose || object.pose)
  const interpolateState = sameState(left, right)
  return {
    ...object,
    position: left.position.map((value, index) => lerp(value, right.position[index], t)),
    rotation: left.rotation.map((value, index) => lerp(value, right.rotation[index], t)),
    scale: left.scale.map((value, index) => lerp(value, right.scale[index], t)),
    pose: normalizePoseId(left.pose || object.pose),
    poseTime: interpolateState ? lerp(leftPoseTime, rightPoseTime, t) : leftPoseTime,
    continuousMotion: motionEnabled(left),
    motionStartTime: stateStartFrame(left) / fps,
    rigRoot: interpolateState ? leftRoot.map((value, index) => lerp(value, rightRoot[index], t)) : [...leftRoot],
    joints: interpolateState ? interpolateJointPose(
      left.joints || poseForObject({ ...object, pose: left.pose || object.pose }).joints,
      right.joints || poseForObject({ ...object, pose: right.pose || object.pose }).joints,
      t,
    ) : cloneJointPose(left.joints || poseForObject({ ...object, pose: left.pose || object.pose }).joints),
  }
}

export function objectsAtFrame(objects, objectKeyframes, frame, fps) {
  return objects.map(object => objectAtFrame(object, objectKeyframes[object.id], frame, fps))
}

export function rotateVectorXYZ(vector, rotation = [0, 0, 0]) {
  let [x, y, z] = vector
  const [rx, ry, rz] = rotation
  const cosX = Math.cos(rx); const sinX = Math.sin(rx)
  const cosY = Math.cos(ry); const sinY = Math.sin(ry)
  const cosZ = Math.cos(rz); const sinZ = Math.sin(rz)
  ;[y, z] = [y * cosX - z * sinX, y * sinX + z * cosX]
  ;[x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY]
  ;[x, y] = [x * cosZ - y * sinZ, x * sinZ + y * cosZ]
  return [x, y, z]
}

export function visualCenterForObject(object) {
  if (!object) return [0, 0, 0]
  const position = object.position || [0, 0, 0]
  if (object.type !== 'person') return [...position]
  const bodyHeight = { tall: 1.12, broad: 1.04, female: 0.98, male: 1.06 }[object.bodyType] || 1
  const root = object.rigRoot || [0, 0, 0]
  const scale = object.scale || [1, 1, 1]
  const localCenter = [root[0] * scale[0], (root[1] + bodyHeight) * scale[1], root[2] * scale[2]]
  const offset = rotateVectorXYZ(localCenter, object.rotation)
  return position.map((value, index) => value + offset[index])
}

export function fallbackCharacterKeyframes() {
  return {}
}

export function referenceImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const imageExtension = /\.(png|jpe?g|webp|bmp|gif)$/i.test(file?.name || '')
    if (!file || (!file.type?.startsWith('image/') && !imageExtension)) { reject(new Error('请选择 PNG、JPG、WEBP、BMP 或 GIF 图片')); return }
    if (file.size > 50 * 1024 * 1024) { reject(new Error('参考图不能超过 50 MB')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('图片格式无法读取'))
      image.onload = () => {
        const longest = Math.max(image.naturalWidth, image.naturalHeight)
        const ratio = Math.min(1, 1600 / Math.max(1, longest))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
        const context = canvas.getContext('2d')
        context.fillStyle = '#e8e6df'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.84))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function referenceCanvasForExport(reference, width, height) {
  return new Promise((resolve, reject) => {
    if (!reference?.image || !reference.includeInExport) return resolve(null)
    const image = new Image()
    image.onerror = () => reject(new Error('参考图无法加入导出画面'))
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = '#9b9c98'
      context.fillRect(0, 0, width, height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      const drawWidth = width * 0.72 * reference.scale
      const drawHeight = drawWidth * image.naturalHeight / Math.max(1, image.naturalWidth)
      const centerX = width * (0.5 + reference.x / 100)
      const centerY = height * (0.5 + reference.y / 100)
      context.globalAlpha = reference.opacity
      context.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight)
      context.globalAlpha = 1
      resolve(canvas)
    }
    image.src = reference.image
  })
}
