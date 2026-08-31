// 3D 导演台领域逻辑：常量、归一化、逐帧插值、工程序列化。
// 纯逻辑/纯函数，不依赖 React 与组件，供 App.jsx 及各面板复用。
import {
  RIG_PRESET_OPTIONS, cloneJointPose, interpolateJointPose, normalizePoseId, poseCanLoop,
  poseForObject, presetJoints, presetPhase, presetRoot,
} from './rig.js'
import { readJson, removeKey, writeJson } from './storage.js'
import { isProjectImageUrl } from '../base/d3dPersistence.ts'

export const CAMERA_ID = '__shot_camera__'
export const PROJECT_STORAGE_KEY = 'director3d-project'
export const LEGACY_PROJECT_STORAGE_KEY = 'stageframe-project'
export const CUSTOM_POSE_STORAGE_KEY = 'director3d-custom-poses'
export const PROJECT_VERSION = 17
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
  ambientColor: '#fcfbfe',
  keyColor: '#fcfdfd',
  fillColor: '#f3eee7',
}
export const FPS_OPTIONS = [24, 25, 30]
export const FOCAL_LENGTH_PRESETS = [18, 24, 35, 50, 85, 120]
export const BRAND_MARK_URL = `${import.meta.env.BASE_URL}branding/director3d-mark.png`
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

// 摄像机/对象关键帧初始值：M1 起为「通道结构」空对象（`{ transform: [], lens: [] }` 之类）。
export const initialKeyframes = {}
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

// ================================================================
// M1 对象动画「通道化」数据契约
// 把「一份整快照关键帧数组」按属性域拆成独立通道，每通道一条独立轨，
// 轨内 key 只含本通道字段（M1-C1），并为未来「单属性 K 帧」预留「通道内
// 可只含部分字段的 key」（M1-C3：key 未含字段 → 该帧求值不解接管该字段）。
// 本模块仅定义契约 + 无损迁移（M1-C6）+ 读侧桥（flatten），M2 再落地按通道求值。
// ================================================================

// ================================================================
// 属性归属注册表（PROPERTY_REGISTRY）：3D 导演台「属性归谁管、怎么生效」的唯一登记入口。
// 一个属性只能在注册表登记一次，录制 / 求值 / 归一化自动按层生效，无需在各通道、求值器、Inspector 单独判断。
// ------------------------------------------------------------------
// 【一、怎么新增 / 修改属性】
//   · 新属性：在下方对应实体对象的字面量里加一行 `字段名: { layer, channel? }` 即可。
//     - 可动画的「量」（position/rotation/pose/...）：layer:'animatable'，并必须给 channel（transform/action/skeleton/lens）。
//     - 对象级「开关」（continuousMotion/footLock/targetMode/...）：layer:'objectState'，不要给 channel。
//     - 纯配置/显示（color/name/bodyType/...）：layer:'config'，不要给 channel。
//   · 修改归属：改这一行的 layer / channel 即可，全局自动对齐（`ENTITY_CHANNELS` 与 `OBJECT_STATE_FIELDS` 由此派生）。
//   · 删除属性：从注册表移除该行，并在 normalization（下方 normalize*Field）里同步去掉对应分支。
//   · 注意：不可随手在求值器 / Inspector / 录制函数里硬编码判断某个属性，必须先在注册表登记。
// ------------------------------------------------------------------
// 【二、为什么这样改】
//   43 已把通道级收口（每字段归一门、单一数据源）。但存在一类「对象级开关」语义缺陷：
//   continuousMotion 是"勾选即生效"，却被注册进 action 通道、被关键帧录制覆盖，导致
//   「先打帧、后勾选」播放时不循环（46 病灶）。根因是缺「属性在哪一层」这一维：
//     量(animatable) 要靠关键帧驱动 → 进通道、被关键帧值覆盖基线；
//     开关(objectState) 勾选即整段生效 → 不该被某一帧冻结，必须永远沿对象基线；
//     配置(config)   与动画无关 → 不进求值器。
//   用三层注册表统一声明 = 从根上消灭「开关被关键帧覆盖」这一类坑，且之后加开关零特判。
// ------------------------------------------------------------------
// 【三、数据流（一帧播放/拖帧/导出时）】
//   1. 录制：录制入口（objectKeyframeFromObject → snapshotToChannelKeys）只捡 animatable 字段进通道，
//      objectState/config 永不落关键帧。
//   2. 求值：evaluateXxxChannel 按通道插值出量；synthesizeObjectState 合成末端统一做 L2 覆盖——
//      对每个 objectState 字段用「对象基线值」强制覆盖求值结果（对齐 camera 的 targetMode 保留范式）。
//   3. 消费：渲染端（Viewport → models）读合成结果，开关最终决定行为（如 continuousMotion && loopable）。
//   链路即：注册表 `登记` → `录制只捡量` → `求值 L2 沿基线` → `渲染消费`，全程不逐列特判。
// ================================================================
export const PROPERTY_REGISTRY = {
  person: {
    position:         { layer: 'animatable', channel: 'transform' },
    rotation:         { layer: 'animatable', channel: 'transform' },
    scale:            { layer: 'animatable', channel: 'transform' },
    pose:             { layer: 'animatable', channel: 'action' },
    poseTime:         { layer: 'animatable', channel: 'action' },
    rigRoot:          { layer: 'animatable', channel: 'skeleton' },
    joints:           { layer: 'animatable', channel: 'skeleton' },
    continuousMotion: { layer: 'objectState' },   // 开关：勾选即生效，撤出 action 通道（46）
    footLock:         { layer: 'objectState' },   // 开关：脚底锁定
    bodyType:         { layer: 'config' },
    color:            { layer: 'config' },
    name:             { layer: 'config' },
    locked:           { layer: 'config' },        // 编辑约束，仍在动画系统之外
  },
  object: {
    position: { layer: 'animatable', channel: 'transform' },
    rotation: { layer: 'animatable', channel: 'transform' },
    scale:    { layer: 'animatable', channel: 'transform' },
    color:    { layer: 'config' },
    name:     { layer: 'config' },
    locked:   { layer: 'config' },
  },
  camera: {
    position:    { layer: 'animatable', channel: 'transform' },
    rotation:    { layer: 'animatable', channel: 'transform' },
    focalLength: { layer: 'animatable', channel: 'lens' },
    targetMode:  { layer: 'objectState' },   // 开关：始终面向对象（setCameraAtFrame 保留，见下）
    targetId:    { layer: 'objectState' },
    name:        { layer: 'config' },
    aspectRatio: { layer: 'config' },
  },
}

// 派生通道表（保留旧名 ENTITY_CHANNELS 以兼容 43 已交付消费方）。
// 每个 entityType 产生 { channel: [field...] }，channel 顺序 = 注册表内首次出现顺序（合成按此覆盖，锁死）。
// animatable 字段必须声明 channel（否则抛错），杜绝「漏标 channel 静默攒 undefined」。
const deriveChannels = registry => {
  const out = {}
  for (const [type, fields] of Object.entries(registry)) {
    const channels = {}
    for (const [field, meta] of Object.entries(fields)) {
      if (meta.layer !== 'animatable') continue
      if (!meta.channel) throw new Error(`[PROPERTY_REGISTRY] ${type}.${field}: animatable 字段必须声明 channel`)
      ;(channels[meta.channel] ||= []).push(field)
    }
    out[type] = channels
  }
  return out
}
export const ENTITY_CHANNELS = deriveChannels(PROPERTY_REGISTRY)

// 预编译每实体 objectState 字段表：热路径只遍历字段名数组，不在循环里逐字段判 layer（47 热路径要求）。
export const OBJECT_STATE_FIELDS = Object.fromEntries(
  Object.entries(PROPERTY_REGISTRY).map(([type, fields]) => [
    type,
    Object.keys(fields).filter(field => fields[field].layer === 'objectState'),
  ]),
)

// 整快照 key → 各通道 key（M1.2 轨数据结构：`{frame, interpolation, fields:{…}}`）。
// 只有 snapshot 里「存在」的字段才进对应通道的 fields；不存在的字段不补默认
// （部分字段 key 语义，M1-C3）。派生量（如 motionStartTime）不在通道字段清单里，天然不落库（M1-C5）。
// 返回 `{ channelName: [{frame, interpolation, fields}] }`，无字段的通道不出现。
export function snapshotToChannelKeys(entityType, snapshot, frame, interpolation = 'smooth') {
  const definition = ENTITY_CHANNELS[entityType] || ENTITY_CHANNELS.object
  const keys = {}
  for (const [channel, fields] of Object.entries(definition)) {
    const fieldValues = {}
    for (const field of fields) {
      if (snapshot[field] !== undefined) fieldValues[field] = cloneProjectValue(snapshot[field])
    }
    if (Object.keys(fieldValues).length) {
      keys[channel] = [{ frame: normalizeFrameNumber(frame), interpolation: normalizeInterpolation(interpolation), fields: fieldValues }]
    }
  }
  return keys
}

// 通道结构 → 整快照 key 数组（读侧桥：M2 求值器落地前，旧 objectAtFrame/cameraAtFrame/Timeline
// 仍吃整快照数组，用本函数把各通道按帧合并还原）。同帧多通道合并，插值取后写通道（M1 全通道同插值）。
export function channelsToSnapshotKeys(entityType, channels = {}) {
  const definition = ENTITY_CHANNELS[entityType] || ENTITY_CHANNELS.object
  const fieldList = Object.values(definition).flat()
  const merged = new Map()
  for (const list of Object.values(channels || {})) {
    for (const key of (Array.isArray(list) ? list : [])) {
      if (!key || key.frame === undefined) continue
      const entry = merged.get(key.frame) || { frame: key.frame, interpolation: normalizeInterpolation(key.interpolation) }
      if (key.interpolation) entry.interpolation = normalizeInterpolation(key.interpolation)
      if (key.fields && typeof key.fields === 'object') {
        entry.fields = { ...entry.fields, ...cloneProjectValue(key.fields) }
      }
      merged.set(key.frame, entry)
    }
  }
  return [...merged.values()].sort((a, b) => a.frame - b.frame).map(entry => {
    const key = { frame: entry.frame, interpolation: entry.interpolation }
    for (const field of fieldList) {
      if (entry.fields?.[field] !== undefined) key[field] = cloneProjectValue(entry.fields[field])
    }
    return key
  })
}

// 读侧桥便捷入口：轨道可能是「已通道化结构」或「旧整快照数组」，统一吐整快照数组。
export function snapshotKeysForTrack(track, entityType = 'object') {
  return Array.isArray(track) ? track : channelsToSnapshotKeys(entityType, track || {})
}

// 统计一个轨道（通道结构或旧数组）的「已打点帧数」。
// 与旧实现 `keyframes.length`（= 已打点帧数）语义一致，供「轨道是否有动画 / 是否清空」判断；
// 同帧多通道只计一次（时间轴上每帧一个点）。
export function countChannelKeyframes(channels) {
  if (Array.isArray(channels)) return channels.length
  if (!channels || typeof channels !== 'object') return 0
  return new Set(Object.values(channels)
    .flatMap(list => (Array.isArray(list) ? list : []).map(key => key?.frame))).size
}

// 写入口：把 snapshotToChannelKeys 产出的各通道 key 合并进现有通道结构（同帧覆盖）。
// M1 各写入口（addObjectKeyframe/addKeyframe/粘贴/路径烘焙）统一经它落库（M4-C7 的雏形）。
export function upsertChannelKeys(channels = {}, channelKeys = {}) {
  const next = { ...channels }
  for (const [channel, keys] of Object.entries(channelKeys)) {
    const frame = keys[0]?.frame
    if (frame === undefined) continue
    next[channel] = uniqueSortedKeyframes([...(next[channel] || []).filter(key => key.frame !== frame), ...keys])
  }
  return next
}

// 从所有通道删除指定帧（M1 各删除入口统一用它，避免漏删某通道遗留幽灵关键帧）。
export function removeChannelFrames(channels = {}, frames = []) {
  const removed = new Set(frames)
  const next = {}
  for (const [channel, list] of Object.entries(channels)) {
    const kept = (Array.isArray(list) ? list : []).filter(key => !removed.has(key.frame))
    if (kept.length) next[channel] = kept
  }
  return next
}

// 写入口：把某帧在所有通道整体平移到另一帧（Timeline 拖动关键帧用）。
// 逐通道改 frame 后重排；目标帧已有 key 时先删旧再写（与 upsert 同帧覆盖语义一致），
// 保证「同帧最多一个 key」，否则求值端 left/right 段定位会因重复帧号错乱。
export function moveChannelFrames(channels = {}, fromFrame, toFrame) {
  if (fromFrame === toFrame) return channels
  const next = {}
  for (const [channel, list] of Object.entries(channels)) {
    const moved = (Array.isArray(list) ? list : []).filter(key => key.frame !== toFrame)
      .map(key => key.frame === fromFrame ? { ...key, frame: toFrame } : key)
    if (moved.length) next[channel] = uniqueSortedKeyframes(moved)
  }
  return next
}

// 写入口：把某帧在各通道的 interpolation 统一更新（Timeline 改插值用，M4.1）。
// 同帧多通道共用同一 interpolation（M1 全通道同插值），故一次性更新所有通道该帧。
export function setChannelInterpolation(channels = {}, frame, interpolation) {
  const normalized = normalizeInterpolation(interpolation)
  const target = normalizeFrameNumber(frame)
  const next = {}
  for (const [channel, list] of Object.entries(channels)) {
    next[channel] = (Array.isArray(list) ? list : []).map(key => key.frame === target ? { ...key, interpolation: normalized } : key)
  }
  return next
}

// M4.1 对象轨唯一写入口：手动 K / 单属性 K / 路径 bake / 删除 / 移动 / 改插值统一经它落库，
// 禁止在 UI 层手写 setCharacterKeyframes 拼装（M4-C1）。
// operation（互斥之一）：
//   { op:'upsert', keys }                  增/改一帧（keys 为 snapshotToChannelKeys 产物的通道 key 映射）
//   { op:'remove', frames:[...] }          删指定帧（跨通道；轨道被写空后自动移除该对象条目）
//   { op:'move', from, to }                整帧平移
//   { op:'interpolation', frame, value }   改该帧插值（各通道一致）
//   { op:'clear' }                         清空整条轨道（删除对象时随对象移除）
//   { op:'batch', steps:[operation...] }   原子批处理（路径 bake：先删旧路径帧再整批插新，M4-C5）
// 语义集中：同帧覆盖/排序去重由底层原语保证。返回新 tracks（纯函数，不就地修改）。
export function writeObjectTrack(tracks = {}, id, operation) {
  if (!operation || typeof operation !== 'object') return tracks
  const applyOp = (channels, step) => {
    switch (step?.op) {
      case 'upsert': return upsertChannelKeys(channels, step.keys)
      case 'remove': return removeChannelFrames(channels, Array.isArray(step.frames) ? step.frames : [step.frames])
      case 'move': return moveChannelFrames(channels, step.from, step.to)
      case 'interpolation': return setChannelInterpolation(channels, step.frame, step.value)
      case 'clear': return {}
      case 'batch': return (Array.isArray(step.steps) ? step.steps : []).reduce(applyOp, channels)
      default: return channels
    }
  }
  const next = applyOp(tracks[id] || {}, operation)
  if (countChannelKeyframes(next)) return { ...tracks, [id]: next }
  const copy = { ...tracks }
  delete copy[id]
  return copy
}

// 收集一个轨道（通道结构或旧数组）的所有帧号（keyframeMaxFrame 用）。
const collectTrackFrames = track => {
  const lists = Array.isArray(track) ? [track] : Object.values(track || {})
  return lists.flatMap(list => (Array.isArray(list) ? list : []).map(key => normalizeFrameNumber(key?.frame)))
}

export function clampKeyframeFrames(keys, maxFrame) {
  const clampList = list => uniqueSortedKeyframes((Array.isArray(list) ? list : []).map(key => ({
    ...key,
    frame: clamp(normalizeFrameNumber(key?.frame), 0, maxFrame),
  })))
  if (Array.isArray(keys)) return clampList(keys)
  if (keys && typeof keys === 'object') {
    return Object.fromEntries(Object.entries(keys).map(([channel, list]) => [channel, clampList(list)]).filter(([, list]) => list.length))
  }
  return keys
}

export function keyframeMaxFrame(cameraKeys = [], objectTracks = {}) {
  const cameraFrames = collectTrackFrames(cameraKeys)
  const objectFrames = Object.values(objectTracks || {}).flatMap(track => collectTrackFrames(track))
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

// 摄像机通道字段归一化（M1）：迁移/幂等时统一规整通道内字段。
// 字段清单见 ENTITY_CHANNELS.camera；新增通道字段时在此补一条归一化规则。
const normalizeCameraField = (field, value, fallbackCamera) => {
  if (field === 'position') return finiteVector3(value, fallbackCamera.position)
  if (field === 'rotation') return Array.isArray(value) ? finiteVector3(value, fallbackCamera.rotation) : cameraRotationToward(fallbackCamera.position, LEGACY_DEFAULT_CAMERA_TARGET)
  if (field === 'focalLength') return clamp(Number(value) || fallbackCamera.focalLength, 18, 120)
  return value
}

export function normalizeCameraKeyframes(keys = [], fallbackCamera = initialCamera) {
  // M1 通道化：输入兼容「旧整快照数组」与「已通道化结构」，输出统一为通道结构
  // `{ transform: [{frame, interpolation, fields:{position, rotation}}], lens: [...] }`。
  // 旧数组：逐 key 经 snapshotToChannelKeys 拆成 transform/lens 后合并（幂等迁移，
  //   旧工程一次性升级、无数据丢失）；已通道化：逐通道归一化字段后原样返回（幂等）。
  // 摄像机只有 transform（位移/旋转）+ lens（焦距）两通道，见 ENTITY_CHANNELS.camera。
  const channels = Array.isArray(keys)
    ? (Array.isArray(keys) ? keys.filter(Boolean) : []).reduce(
        (merged, key) => upsertChannelKeys(merged, snapshotToChannelKeys('camera', key, key.frame, key.interpolation)),
        {},
      )
    : (keys || {})
  const result = {}
  for (const [channel, fields] of Object.entries(ENTITY_CHANNELS.camera)) {
    const list = (Array.isArray(channels[channel]) ? channels[channel].filter(Boolean) : []).map(key => ({
      frame: normalizeFrameNumber(key.frame),
      interpolation: normalizeInterpolation(key.interpolation),
      fields: Object.fromEntries(
        fields
          .filter(field => key.fields?.[field] !== undefined)
          .map(field => [field, normalizeCameraField(field, key.fields[field], fallbackCamera)]),
      ),
    })).filter(key => Object.keys(key.fields).length)
    if (list.length) result[channel] = uniqueSortedKeyframes(list)
  }
  return result
}

export function normalizeReference(reference = {}) {
  const image = typeof reference.image === 'string' && isProjectImageUrl(reference.image)
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
  const poses = readJson(CUSTOM_POSE_STORAGE_KEY, [])
  if (!Array.isArray(poses)) return []
  return poses.filter(pose => pose?.id && pose?.name).map(pose => ({
    ...pose,
    pose: normalizePoseId(pose.pose),
    poseTime: Number.isFinite(pose.poseTime) ? pose.poseTime : presetPhase(pose.pose),
    rigRoot: Array.isArray(pose.rigRoot) ? pose.rigRoot.slice(0, 3) : presetRoot(pose.pose),
    joints: cloneJointPose(pose.joints),
  }))
}

// 对象/人物通道字段归一化（M1）：与旧整快照归一化规则一一对应，保证迁移后播放逐帧一致。
// 字段清单见 ENTITY_CHANNELS；新增通道字段时在此补一条归一化规则。
function normalizeObjectField(entityType, field, value) {
  if (field === 'position' || field === 'rotation') return finiteVector3(value, [0, 0, 0])
  if (field === 'scale') return finiteVector3(value, [1, 1, 1])
  if (field === 'pose') return normalizePoseId(value)
  if (field === 'poseTime') return Number.isFinite(Number(value)) ? Number(value) : presetPhase(normalizePoseId(value))
  if (field === 'rigRoot') return Array.isArray(value) ? value.slice(0, 3).map(item => Number(item) || 0) : [0, 0, 0]
  if (field === 'joints') return cloneJointPose(value)
  return value
}

// 通道结构可自推断实体类型（含 action/skeleton → person，含 lens → camera，否则 object）；
// 旧整快照数组无法推断，需调用方显式传 entityTypes（normalizeShot 已从 objects 构建并传入）。
const inferChannelEntityType = track => {
  if (!track || typeof track !== 'object' || Array.isArray(track)) return 'object'
  if ('action' in track || 'skeleton' in track) return 'person'
  if ('lens' in track) return 'camera'
  return 'object'
}

// 单条对象轨道归一化：输入兼容旧整快照数组 / 已通道化结构，输出统一为通道结构（幂等）。
// pathFrames（M4.2）：该对象路径烘焙帧号集合（来自 paths[id].sourceKeyframeFrames）。
// 旧路径系统在路径帧写入了整份姿态快照（pose/poseTime/rotation/scale/rigRoot/joints），
// 迁移时这些字段不得进 action/skeleton 通道——路径帧只保留 position 作为「路径接管位置」的
// 来源标识（M3-C1 二选一由 M3 求值引擎保证，位置关键帧被显示忽略）。非路径帧（用户手动 K）
// 的整快照完整迁移到对应通道。已通道化结构无路径残留（M3 起 bake 只写 position），幂等归一。
const normalizeObjectTrack = (track, entityType, pathFrames = []) => {
  const definition = ENTITY_CHANNELS[entityType] || ENTITY_CHANNELS.object
  const pathFrameSet = new Set(pathFrames.map(normalizeFrameNumber))
  const channels = Array.isArray(track)
    ? track.filter(Boolean)
        .map(key => pathFrameSet.has(normalizeFrameNumber(key.frame))
          ? { frame: key.frame, interpolation: key.interpolation, position: key.position }
          : key)
        .reduce(
          (merged, key) => upsertChannelKeys(merged, snapshotToChannelKeys(entityType, key, key.frame, key.interpolation)),
          {},
        )
    : (track || {})
  const result = {}
  for (const [channel, fields] of Object.entries(definition)) {
    const list = (Array.isArray(channels[channel]) ? channels[channel].filter(Boolean) : []).map(key => ({
      frame: normalizeFrameNumber(key.frame),
      interpolation: normalizeInterpolation(key.interpolation),
      fields: Object.fromEntries(
        fields
          .filter(field => key.fields?.[field] !== undefined)
          .map(field => [field, normalizeObjectField(entityType, field, key.fields[field])]),
      ),
    })).filter(key => Object.keys(key.fields).length)
    if (list.length) result[channel] = uniqueSortedKeyframes(list)
  }
  return result
}

export function normalizeObjectTracks(tracks = {}, entityTypes = {}, paths = {}) {
  if (!tracks || typeof tracks !== 'object') return {}
  // M1 通道化：entityTypes 显式传入「对象 id → 实体类型」（person/object），决定按哪个通道定义拆包；
  // 未传时对已通道化结构按通道名自推断，旧数组一律回落为 object（无姿态语义，只留 transform）。
  // M4.2：paths 提供每对象路径烘焙帧号（sourceKeyframeFrames），迁移时剥掉路径帧姿态残留。
  return Object.fromEntries(Object.entries(tracks)
    .map(([id, track]) => [id, normalizeObjectTrack(track, entityTypes[id] || inferChannelEntityType(track), paths?.[id]?.sourceKeyframeFrames || [])])
    .filter(([, track]) => countChannelKeyframes(track) > 0))
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
  // M1：对象轨道按实体类型拆通道，entityTypes 从镜头内 objects 构建（决定 person 拆 3 通道 / object 拆 1 通道）
  const entityTypes = Object.fromEntries(objects.map(object => [object.id, object.type]))
  const camera = normalizeCamera(shot?.camera || fallback.camera)
  let keyframes = normalizeCameraKeyframes(shot?.keyframes ?? fallback.keyframes ?? [], camera)
  // M4.2：先归一化 paths（拿路径烘焙帧号），再迁移对象轨——路径帧剥姿态残留依赖它
  const paths = normalizeShotPaths(shot?.paths || fallback.paths)
  let objectKeyframes = normalizeObjectTracks(shot?.objectKeyframes || shot?.characterKeyframes || fallback.objectKeyframes || {}, entityTypes, paths)
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
    thumbnail: typeof shot?.thumbnail === 'string' && isProjectImageUrl(shot.thumbnail) ? shot.thumbnail : '',
    fps: timing.fps,
    durationSeconds: timing.durationSeconds,
    loopPlayback: timing.loopPlayback,
    objects,
    camera,
    lighting: normalizeLighting(shot?.lighting || fallback.lighting),
    reference: normalizeReference(shot?.reference || fallback.reference),
    keyframes,
    objectKeyframes,
    paths,
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
    paths: data.paths || {},
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
    paths: fallback.paths,
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
    paths: activeShot.paths,
  }
}

export function readCachedProject(storageKey) {
  const key = storageKey || PROJECT_STORAGE_KEY
  // 优先读当前 key；无有效缓存时才回退旧版 key 做一次性迁移
  const current = readJson(key, null)
  const legacy = current ? null : readJson(LEGACY_PROJECT_STORAGE_KEY, null)
  const normalized = normalizeProjectData(current || legacy)
  if (!normalized) return null
  if (legacy) {
    // legacy 迁移：回写新 key，并清理旧 key 释放存储空间（原实现遗留，长期占用）
    writeJson(key, normalized)
    removeKey(LEGACY_PROJECT_STORAGE_KEY)
  }
  return normalized
}

export function projectData({ settings, objects, camera, lighting, reference, keyframes, objectKeyframes, paths, shots, activeShotId }) {
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
    paths,
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
    paths,
  }
}

// ================================================================
// M2 通道求值引擎：查询基元 + 各通道独立求值 + 按注册顺序合成
// ================================================================
// 为什么这样做（对比 M1 读侧桥 flatten 成整快照再求值）：
//   1. 单通道只接管「该帧定位到的 key 里实际存在的字段」——把 M1 的部分字段 key 语义落到求值端
//      （M2-C1）：未含字段该帧不解接管，保持底层基线，杜绝静默补默认值。
//   2. 动作通道是唯一的状态源：pose/continuousMotion 共同决定「状态段」，段边界处 poseTime 与骨骼
//      硬切、段内插值（逐字复刻旧 objectAtFrame 的 sameState/stateStartFrame 语义，M2-C4 迁移锚
//      保证行为不变）。它同时产出 motionStartTime 与「段内是否同状态」的派生上下文供骨骼消费（M2-C7）。
//   3. 骨骼通道不自猜状态：没有动作上下文时，即使有骨骼 key 也不臆造状态段，按同状态插值兜底。
//   4. 合成器按 ENTITY_CHANNELS 注册顺序（transform→action→skeleton）逐通道覆盖被接管字段，
//      每字段唯一归因，未接管字段保持基线（M2-C2）。
// 新增配置（X2）：给某实体加通道/字段，只改 ENTITY_CHANNELS 与对应 normalize*Field 归一化；
//   若新通道需要独立求值语义（如状态段），参照 evaluateActionChannel 补求值器并在
//   synthesizeObjectState 里登记。

// 查询基元：在已排序通道 key 数组里定位目标帧（M2-C6），四个通道与相机轨/对象轨共用。
// 返回 { exact, left, right, t, bounds }：exact 命中该帧的 key（无则 null）；
// bounds 区分 exact/首前/末后/段内，left/right 为段两侧 key，t 为段内插值进度。
function locateChannelKey(keys, frame) {
  if (!Array.isArray(keys) || !keys.length) return { exact: null, left: null, right: null, t: 0, bounds: 'empty' }
  const exact = keys.find(key => key.frame === frame)
  if (exact) return { exact, left: exact, right: exact, t: 0, bounds: 'exact' }
  if (frame <= keys[0].frame) return { exact: null, left: keys[0], right: keys[0], t: 0, bounds: 'before' }
  if (frame >= keys.at(-1).frame) return { exact: null, left: keys.at(-1), right: keys.at(-1), t: 1, bounds: 'after' }
  const rightIndex = keys.findIndex(key => key.frame >= frame)
  const left = keys[rightIndex - 1]
  const right = keys[rightIndex]
  return {
    exact: null,
    left,
    right,
    t: segmentAmount(left, (frame - left.frame) / Math.max(1, right.frame - left.frame)),
    bounds: 'segment',
  }
}

// 数值通道求值（transform / lens 共用）：字段值插值 + 部分字段接管。
// angleFields 里登记的名称走 lerpAngle（相机 rotation 绕角插值，与旧 cameraAtFrame 一致），
// 其余数组字段逐元素 lerp、标量字段（focalLength）直接 lerp。
// 段内两端字段不一致（一端缺字段）时不插值、保持有值一侧——「接管以该帧可确定为准」，不臆造缺口。
// 返回 null 表示无 key（该通道未接管）；否则返回 `{ 字段名: 值 }` 的覆盖集合。
function evaluateNumericChannel(keys, frame, { angleFields = new Set() } = {}) {
  const { left, right, t, bounds } = locateChannelKey(keys, frame)
  if (bounds === 'empty') return null
  const fields = {}
  if (bounds !== 'segment') {
    for (const field of Object.keys(left.fields || {})) {
      fields[field] = cloneProjectValue(left.fields[field])
    }
    return fields
  }
  const leftFields = left.fields || {}
  const rightFields = right.fields || {}
  const allFields = new Set([...Object.keys(leftFields), ...Object.keys(rightFields)])
  for (const field of allFields) {
    const a = leftFields[field]
    const b = rightFields[field]
    if (a === undefined || b === undefined) {
      fields[field] = cloneProjectValue(a !== undefined ? a : b)
    } else if (angleFields.has(field)) {
      fields[field] = a.map((value, index) => lerpAngle(value, b[index], t))
    } else if (Array.isArray(a)) {
      fields[field] = a.map((value, index) => lerp(value, b[index], t))
    } else {
      fields[field] = lerp(a, b, t)
    }
  }
  return fields
}

// 动作通道求值：pose / poseTime / continuousMotion + 状态段派生上下文。
// 复刻旧 objectAtFrame 语义：状态 = (pose, 连续运动开关)，同状态段内 poseTime 插值、跨段硬切；
// motionStartTime = 状态段起始帧 / fps；并产出 interpolateState 供骨骼通道决定「插值 or 硬切」。
// 返回 null 表示无动作 key（未接管，合成器保持基线）。
// 注意：通道 key 的字段在 `key.fields` 下（M1 轨结构），必须经 field() 读取，勿用扁平访问。
function evaluateActionChannel(keys, object, frame, fps) {
  if (!Array.isArray(keys) || !keys.length) return null
  const field = (key, name) => key?.fields?.[name]
  const motionEnabled = key => poseCanLoop(field(key, 'pose') || object.pose)
    && (field(key, 'continuousMotion') === undefined ? Boolean(object.continuousMotion) : Boolean(field(key, 'continuousMotion')))
  const sameState = (leftKey, rightKey) => normalizePoseId(field(leftKey, 'pose') || object.pose) === normalizePoseId(field(rightKey, 'pose') || object.pose)
    && motionEnabled(leftKey) === motionEnabled(rightKey)
  const stateStartFrame = key => {
    let index = keys.indexOf(key)
    while (index > 0 && sameState(keys[index - 1], keys[index])) index -= 1
    return keys[index]?.frame ?? key.frame
  }
  const poseTimeOf = key => {
    const value = field(key, 'poseTime')
    return Number.isFinite(value) ? value : presetPhase(field(key, 'pose') || object.pose)
  }
  const { exact, left, right, t, bounds } = locateChannelKey(keys, frame)
  const key = exact || left
  const interpolateState = bounds === 'segment' ? sameState(left, right) : true
  return {
    pose: normalizePoseId(field(key, 'pose') || object.pose),
    poseTime: interpolateState ? lerp(poseTimeOf(left), poseTimeOf(right), t) : poseTimeOf(left),
    continuousMotion: motionEnabled(key),
    motionStartTime: stateStartFrame(key) / fps,
    interpolateState, // 派生上下文：骨骼通道据此决定插值 or 硬切（M2-C7）
  }
}

// 骨骼通道求值：rigRoot / joints。
// 决策来源（M2-C7）：段内是否硬切由动作通道派生上下文（interpolateState）决定——
// 只有动作上下文说「同状态」才插值，否则保持左 key（状态段边界硬切，杜绝走走停停回归）。
// 无动作上下文（仅骨骼 key 的极端情况）：无状态信息，按同状态插值兜底，不臆造状态段。
// 返回 null 表示无骨骼 key（未接管，保持基线）。
// 字段同样在 key.fields 下，经 field() 读取。
function evaluateSkeletonChannel(keys, actionContext, object, frame) {
  if (!Array.isArray(keys) || !keys.length) return null
  const field = (key, name) => key?.fields?.[name]
  const { exact, left, right, t, bounds } = locateChannelKey(keys, frame)
  const key = exact || left
  const jointsOf = k => field(k, 'joints') || poseForObject({ ...object, pose: field(k, 'pose') || object.pose }).joints
  const rootOf = k => field(k, 'rigRoot') || poseForObject({ ...object, pose: field(k, 'pose') || object.pose }).root
  const interpolate = actionContext ? actionContext.interpolateState : true
  if (bounds !== 'segment' || !interpolate) {
    return { rigRoot: [...rootOf(key)], joints: cloneJointPose(jointsOf(key)) }
  }
  return {
    rigRoot: rootOf(left).map((value, index) => lerp(value, rootOf(right)[index], t)),
    joints: interpolateJointPose(jointsOf(left), jointsOf(right), t),
  }
}

// 合成器：从基线对象出发，按 ENTITY_CHANNELS 注册顺序逐通道覆盖被接管字段。
// 每字段唯一归因：一个字段只属于一个通道，未接管字段保持基线（M2-C2）。
// M3 路径独立化：可选传入该对象的运动路径。路径「存在且启用」时（M3-C1），
//   position 唯一由路径提供（pathPositionAtFrame 弧长匀速），变换通道里的位置关键帧
//   被显式忽略（二选一）；「有路径」即视为位置来源存在，变换轨为空也不回落基线（M3-C3）。
//   rotation/scale 等其它变换字段仍按关键帧/基线求值；路径帧绝不写 pose/joints/rigRoot（M3-C2）。
function synthesizeObjectState(object, channels, frame, fps, path = null) {
  const result = { ...object }
  // transform 通道：数值插值（对象/人物的 rotation 走普通 lerp，与旧 objectAtFrame 行为一致）
  const transform = evaluateNumericChannel(channels?.transform || [], frame, {})
  // 路径作为独立位置来源：启用时 position 唯一由路径给出
  const pathPosition = pathActive(path) ? pathPositionAtFrame(path, frame) : null
  if (pathPosition) result.position = pathPosition
  if (transform) {
    if (pathPosition) {
      // M3-C1：路径启用时丢弃变换通道的 position（位置关键帧被忽略），其余字段照常接管
      const { position: _position, ...rest } = transform
      Object.assign(result, rest)
    } else {
      Object.assign(result, transform)
    }
  }
  // action 通道（仅 person 注册）：状态段求值 + 派生上下文
  const action = evaluateActionChannel(channels?.action || [], object, frame, fps)
  if (action) {
    result.pose = action.pose
    result.poseTime = action.poseTime
    // note: continuousMotion 不再由 action 通道决定，见下方 L2 沿基线覆盖（46）。
    result.motionStartTime = action.motionStartTime
  }
  // skeleton 通道（仅 person 注册）：骨骼插值/硬切由动作上下文决定
  const skeleton = evaluateSkeletonChannel(channels?.skeleton || [], action, object, frame)
  if (skeleton) {
    result.rigRoot = skeleton.rigRoot
    result.joints = skeleton.joints
  }
  // L2：对象级开关（objectState）勾选即生效，永远从基线取，覆盖任何求值结果。
  // continuousMotion/footLock 由此统一沿基线；targetMode/targetId 走 cameraAtFrame + setCameraAtFrame 特判（47 §4.5）。
  for (const field of OBJECT_STATE_FIELDS[object.type] || []) result[field] = object[field]
  return result
}

export function cameraAtFrame(keyframes, frame, aspectRatio = '16:9') {
  // M2：keyframes 兼容「旧整快照数组」与「已通道化结构」；旧数组经幂等归一化转通道。
  // transform 通道的 rotation 走绕角插值（lerpAngle，与旧行为一致），lens 通道 focalLength 走 lerp。
  const channels = Array.isArray(keyframes) ? normalizeCameraKeyframes(keyframes, initialCamera) : (keyframes || {})
  const result = { ...initialCamera, aspectRatio }
  const transform = evaluateNumericChannel(channels.transform || [], frame, { angleFields: new Set(['rotation']) })
  const lens = evaluateNumericChannel(channels.lens || [], frame, {})
  if (transform) Object.assign(result, transform)
  if (lens) Object.assign(result, lens)
  return result
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
    rigRoot: [...rig.root],
    joints: cloneJointPose(rig.joints),
  }
}

export function objectAtFrame(object, keyframes = [], frame, fps = DEFAULT_PROJECT_SETTINGS.fps, path = null) {
  if (!object) return object
  // M2：keyframes 兼容「旧整快照数组」与「已通道化结构」；旧数组按实体类型经幂等归一化转通道。
  const channels = Array.isArray(keyframes) ? normalizeObjectTrack(keyframes, object.type) : (keyframes || {})
  // M3：path 为可选的运动路径（独立位置来源，见 synthesizeObjectState）
  return synthesizeObjectState(object, channels, frame, fps, path)
}

export function objectsAtFrame(objects, objectKeyframes, frame, fps, paths = {}) {
  // M3：paths 为 `{对象id → 运动路径}` 映射，逐对象透传给求值引擎作为独立位置来源
  return objects.map(object => objectAtFrame(object, objectKeyframes[object.id], frame, fps, paths?.[object.id]))
}

// ---- 运动路径（画线）领域逻辑：纯 JS，不依赖 three，可供 App / Viewport / 序列化复用 ----

export const DEFAULT_PATH_SETTINGS = {
  startFrame: 0,
  endFrame: 360,
  keyframeCount: 5,
  closed: false,
}

// 归一化单个路径控制点：统一成 `{x,y,z}` 的有限数值。
export function normalizePathPoint(point) {
  if (!point || typeof point !== 'object') return { x: 0, y: 0, z: 0 }
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0
  return {
    x: numeric(point.x ?? point[0]),
    y: numeric(point.y ?? point[1]),
    z: numeric(point.z ?? point[2]),
  }
}

export function normalizePathPoints(points) {
  if (!Array.isArray(points)) return []
  return points.filter(Boolean).map(normalizePathPoint)
}

export function normalizeCameraPath(path) {
  if (!path || typeof path !== 'object') return null
  const startFrame = clamp(Math.round(Number(path.startFrame) || 0), 0, 9999)
  const endFrame = Math.max(startFrame + 1, Math.round(Number(path.endFrame) || DEFAULT_PATH_SETTINGS.endFrame))
  const points = normalizePathPoints(path.points)
  return {
    startFrame,
    endFrame,
    keyframeCount: clamp(Math.round(Number(path.keyframeCount) || DEFAULT_PATH_SETTINGS.keyframeCount), 2, 500),
    closed: Boolean(path.closed),
    points,
    sourceKeyframeFrames: Array.isArray(path.sourceKeyframeFrames)
      ? path.sourceKeyframeFrames.map(normalizeFrameNumber).filter(frame => frame >= 0)
      : [],
  }
}

// 某镜头下：targetId → 其运动路径。targetId 即对象 id，摄像机用 CAMERA_ID。
export function normalizeShotPaths(paths = {}) {
  if (!paths || typeof paths !== 'object') return {}
  return Object.fromEntries(Object.entries(paths)
    .map(([id, path]) => [id, normalizeCameraPath(path)])
    .filter(([, path]) => path))
}

// 生成一条空的、用于全新绘制的运动路径（控制点由绘制产生）。
export function createEmptyPath(timing = DEFAULT_PROJECT_SETTINGS) {
  const totalFrames = Math.max(2, (timing.durationSeconds || DEFAULT_PROJECT_SETTINGS.durationSeconds) * (timing.fps || DEFAULT_PROJECT_SETTINGS.fps))
  return {
    startFrame: 0,
    endFrame: Math.round(totalFrames),
    keyframeCount: DEFAULT_PATH_SETTINGS.keyframeCount,
    closed: false,
    points: [],
    sourceKeyframeFrames: [],
  }
}

const clampSegmentIndex = (array, index) => array[Math.max(0, Math.min(array.length - 1, index))]

// M3 路径来源判定：路径「存在且启用」= 有 ≥2 个可归一化控制点（M3-C1/C3 的唯一判定入口）。
// 与旧 UI 层 `path && Array.isArray(path.points) && path.points.length >= 2` 语义一致。
export function pathActive(path) {
  return Boolean(path && Array.isArray(path.points) && path.points.length >= 2)
}

// M3 路径→帧求值：把 frame 映射到 [startFrame, endFrame] 的弧长进度，沿路径匀速取位。
// 直接复用 pathPositionAtFraction（M3-C4：曲线几何/匀速/平滑不重写）。
// 返回 [x,y,z] 或 null（路径未启用时）。路径启用即全程接管 position（帧越界按端点钳制，
// 与旧 UI 层行为一致），故「有路径」恒为位置来源存在（M3-C3）。
export function pathPositionAtFrame(path, frame) {
  if (!pathActive(path)) return null
  const start = Math.max(0, Math.round(Number(path.startFrame) || 0))
  const end = Math.max(start + 1, Math.round(Number(path.endFrame) || DEFAULT_PATH_SETTINGS.endFrame))
  const u = clamp((frame - start) / Math.max(1, end - start), 0, 1)
  const pos = pathPositionAtFraction(path, u)
  if (!pos) return null
  return [pos.x, pos.y, pos.z]
}

// uniform Catmull-Rom 求值：p1-p2 段内 [0,1]，p0/p3 为前后相邻控制点。
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  const evalAxis = (a, b, c, d) =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return {
    x: evalAxis(p0.x, p1.x, p2.x, p3.x),
    y: evalAxis(p0.y, p1.y, p2.y, p3.y),
    z: evalAxis(p0.z, p1.z, p2.z, p3.z),
  }
}

// 向量（数组）版 Catmull-Rom 平滑插值：p1-p2 段内 [0,1]，p0/p3 为前后相邻点；
// 穿越关键帧时切线连续 → 相机回放转角处平滑，无需额外加点。
function vectorCatmullRom(a, b, c, d, t) {
  const t2 = t * t
  const t3 = t2 * t
  const axis = (p, q, r, s) => 0.5 * ((2 * q) + (-p + r) * t + (2 * p - 5 * q + 4 * r - s) * t2 + (-p + 3 * q - 3 * r + s) * t3)
  return [axis(a[0], b[0], c[0], d[0]), axis(a[1], b[1], c[1], d[1]), axis(a[2], b[2], c[2], d[2])]
}

const pathPointDistanceSq = (a, b) =>
  (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z)

// 把控制点采样成一条稠密折线（用于渲染曲线本体 / 弧长累加）。返回 {x,y,z}[]。
export function pathSamplePoints(points, closed = false, samplesPerSegment = 8) {
  if (!Array.isArray(points) || points.length < 2) return []
  const pts = points.map(normalizePathPoint)
  const segmentCount = closed ? pts.length : pts.length - 1
  const sampleStep = 1 / Math.max(1, samplesPerSegment)
  const samples = []
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const i0 = clampSegmentIndex(pts, closed ? (segment - 1 + pts.length) % pts.length : segment - 1)
    const i1 = pts[segment % pts.length]
    const i2 = pts[(segment + 1) % pts.length]
    const i3 = clampSegmentIndex(pts, closed ? (segment + 2) % pts.length : segment + 2)
    for (let t = 0; t <= 1; t += sampleStep) {
      samples.push(catmullRomPoint(i0, i1, i2, i3, t))
    }
  }
  // 去除相邻重复点（开曲线的连接处 / 闭曲线接缝）
  const result = []
  for (const sample of samples) {
    const previous = result[result.length - 1]
    if (!previous || pathPointDistanceSq(previous, sample) > 1e-10) result.push(sample)
  }
  return result
}

// 求路径在弧线比例 u∈[0,1] 处的前进切线（沿采样折线的局部差分，用于摄像机朝向前方）。
// 返回 [x,y,z]；采样不足两点时返回 null。
export function pathTangentAtFraction(path, u = 0) {
  const samples = pathSamplePoints(path?.points, Boolean(path?.closed), 16)
  if (samples.length < 2) return null
  const index = clamp(Math.round(clamp(u, 0, 1) * (samples.length - 1)), 0, samples.length - 2)
  const a = samples[index]
  const b = samples[index + 1]
  const tangent = [b.x - a.x, b.y - a.y, b.z - a.z]
  const length = Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1] + tangent[2] * tangent[2])
  if (length < 1e-8) return [0, 0, -1]
  return [tangent[0] / length, tangent[1] / length, tangent[2] / length]
}

// 按弧长把路径均匀切出 `count` 个关键帧（覆盖 [startFrame, endFrame]）。
// 返回：`{ frames:[{frame, position:[x,y,z]}], sourceKeyframeFrames:number[] }`。
export function bakePathKeyframes(path, fps = DEFAULT_PROJECT_SETTINGS.fps) {
  if (!path || !Array.isArray(path.points) || path.points.length < 2) {
    return { frames: [], sourceKeyframeFrames: [] }
  }
  const closed = Boolean(path.closed)
  const count = clamp(Math.round(Number(path.keyframeCount) || DEFAULT_PATH_SETTINGS.keyframeCount), 2, 500)
  const start = Math.max(0, Math.round(Number(path.startFrame) || 0))
  const end = Math.max(start + 1, Math.round(Number(path.endFrame) || DEFAULT_PATH_SETTINGS.endFrame))
  const totalFrames = end - start
  const samples = pathSamplePoints(path.points, closed, 8)
  // 累加弧长
  const cumulative = [0]
  for (let index = 1; index < samples.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.sqrt(pathPointDistanceSq(samples[index - 1], samples[index])))
  }
  const totalLength = cumulative[cumulative.length - 1] || 0
  const frames = []
  const sourceKeyframeFrames = []
  for (let i = 0; i < count; i += 1) {
    const u = count === 1 ? 0 : i / (count - 1)
    const targetLength = u * totalLength
    let index = cumulative.findIndex(value => value >= targetLength)
    if (index < 0) index = cumulative.length - 1
    const point = samples[index]
    frames.push({ frame: start + Math.round(u * totalFrames), position: [point.x, point.y, point.z] })
    sourceKeyframeFrames.push(start + Math.round(u * totalFrames))
  }
  return { frames, sourceKeyframeFrames }
}

// 按弧长匀速在平滑路径上取一点（贝塞尔思路：点少、曲线平滑、路程匀速）。
// u 为 0..1 的进度；把路径先重采样成稠密平滑折线，再按累计弧长定位，
// 并在目标弧长前后两个采样点之间做线性插值，保证任意进度都连续、不掉帧。
export function pathPositionAtFraction(path, u = 0) {
  const samples = pathSamplePoints(path?.points, Boolean(path?.closed), 30)
  if (samples.length < 2) return null
  const cumulative = [0]
  for (let index = 1; index < samples.length; index += 1) {
    cumulative.push(cumulative[index - 1] + Math.sqrt(pathPointDistanceSq(samples[index - 1], samples[index])))
  }
  const total = cumulative[cumulative.length - 1] || 0
  const target = clamp(u, 0, 1) * total
  let index = cumulative.findIndex(value => value >= target)
  if (index < 0) index = cumulative.length - 1
  const prev = samples[index - 1] || samples[index]
  const next = samples[index]
  const segStart = cumulative[index - 1] || 0
  const segLen = cumulative[index] - segStart
  const t = clamp((target - segStart) / Math.max(1e-6, segLen), 0, 1)
  return {
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    z: lerp(prev.z, next.z, t),
  }
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
