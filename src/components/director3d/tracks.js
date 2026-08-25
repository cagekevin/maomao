// 3D 导演台·轨道写操作领域（M4.1 解耦收口）
// 职责：所有关键帧轨道的写变更（对象轨 + 相机轨）统一收口在此模块；
//       全部为纯函数 updater `(tracks, ...) => newTracks`，App.jsx 只做 setState 接线，
//       不再直接拼装底层写原语，避免 UI 层与通道数据结构耦合。
// 约定：
//   - 对象轨：统一经 writeObjectTrack（M4-C1 唯一写入口：增/删/移/改插值/清空/批处理）
//   - 相机轨：统一经 project.js 通道写原语（upsertChannelKeys/removeChannelFrames/
//             moveChannelFrames/setChannelInterpolation）
//   - 路径烘焙只产出 position 来源标识（M3-C2/C5），路径帧绝不写姿态/动作/骨骼；
//     「先删旧路径帧、再整批插新帧」= 一个原子 batch（M4-C5），保证撤销/重做整体回退。
// 依赖均为纯函数，node 环境可跑（tests/unit/tracks.test.js）。
import {
  cameraRotationToward, countChannelKeyframes, moveChannelFrames, pathTangentAtFraction,
  removeChannelFrames, setChannelInterpolation, snapshotToChannelKeys, upsertChannelKeys, writeObjectTrack,
} from './project.js'

// ---- 对象轨 ----

// 路径烘焙批处理（M3 路径帧语义）：bakedFrames 为 bakePathKeyframes 产出的帧列表（含 position），
// 先删旧路径帧 removeFrames 再整批 upsert 新路径帧 = 单次原子 batch（M4-C5）。
// 路径帧只落 transform.position（M3-C2/C5），不触碰 action/skeleton 通道。
export function bakeObjectPath(tracks, target, sourceType, bakedFrames, removeFrames = []) {
  const pathKeys = {}
  for (const frame of bakedFrames) {
    const snapshot = { frame: frame.frame, interpolation: 'linear', position: frame.position }
    const keys = snapshotToChannelKeys(sourceType, snapshot, snapshot.frame, snapshot.interpolation)
    for (const [channel, list] of Object.entries(keys)) {
      pathKeys[channel] = [...(pathKeys[channel] || []), ...list]
    }
  }
  return writeObjectTrack(tracks, target, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: [...removeFrames] },
      { op: 'upsert', keys: pathKeys },
    ],
  })
}

// 增/改一帧：整快照 snapshot 按实体类型拆进对应通道后写入（手动 K、单属性 K、粘贴共用）。
export const upsertObjectSnapshot = (tracks, target, entityType, snapshot) =>
  writeObjectTrack(tracks, target, {
    op: 'upsert',
    keys: snapshotToChannelKeys(entityType, snapshot, snapshot.frame, snapshot.interpolation),
  })

// 删除一帧或一批帧；轨道写空后自动移除该对象条目（writeObjectTrack 内部语义）。
export const removeObjectFrames = (tracks, target, frames) =>
  writeObjectTrack(tracks, target, { op: 'remove', frames: Array.isArray(frames) ? frames : [frames] })

// 整帧平移（各通道同帧一致）。
export const moveObjectFrame = (tracks, target, fromFrame, toFrame) =>
  writeObjectTrack(tracks, target, { op: 'move', from: fromFrame, to: toFrame })

// 改某帧插值（各通道同插值，M1 全通道同插值约定）。
export const setObjectInterpolation = (tracks, target, frame, value) =>
  writeObjectTrack(tracks, target, { op: 'interpolation', frame, value })

// 清空整条轨道（删除对象时随对象移除）。
export const clearObjectTrack = (tracks, target) =>
  writeObjectTrack(tracks, target, { op: 'clear' })

// 复制轨道到新对象（duplicateSelected 用）：逐通道复制；
// 仅 transform 通道的 position 按 offset 偏移（副本与原件错开站位），动作/骨骼原样复制。
export function duplicateObjectTrack(tracks, target, newId, offset = 0) {
  const sourceTrack = tracks[target]
  if (!countChannelKeyframes(sourceTrack)) return tracks
  const duplicateTrack = {}
  for (const [channel, keys] of Object.entries(sourceTrack)) {
    duplicateTrack[channel] = (Array.isArray(keys) ? keys : []).map(key => channel === 'transform'
      ? { ...key, fields: { ...key.fields, position: offset ? [key.fields.position[0] + offset, key.fields.position[1], key.fields.position[2] + offset] : key.fields.position } }
      : key)
  }
  return { ...tracks, [newId]: duplicateTrack }
}

// 批量平移若干帧（时间轴框选/多选拖动用）：frameMap = { 旧帧号: 新帧号 }。
// 先删全部旧帧、再整批插入新帧（内容不变、仅 frame 平移）为单个原子 batch，
// 避免逐帧 move 在「目标帧被另一待移动帧占据」时顺序执行丢帧（M4-C5 原子语义）。
export function moveObjectFrames(tracks, target, frameMap) {
  const entries = Object.entries(frameMap)
  if (!entries.length) return tracks
  const fromFrames = entries.map(([from]) => Number(from))
  const keys = {}
  const track = tracks[target] || {}
  for (const [channel, list] of Object.entries(track)) {
    const moved = (Array.isArray(list) ? list : [])
      .filter(key => frameMap[key.frame] !== undefined)
      .map(key => ({ ...key, frame: frameMap[key.frame] }))
    if (moved.length) keys[channel] = moved
  }
  return writeObjectTrack(tracks, target, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: fromFrames },
      { op: 'upsert', keys },
    ],
  })
}

// 相机轨批量平移（先删旧帧再整批插新帧，transform/lens 同时处理）。
export function moveCameraFrames(channels, frameMap) {
  const entries = Object.entries(frameMap)
  if (!entries.length) return channels
  const fromFrames = entries.map(([from]) => Number(from))
  const toFrames = new Map(entries.map(([from, to]) => [Number(from), Number(to)]))
  const next = removeChannelFrames(channels, fromFrames)
  const keys = {}
  for (const [channel, list] of Object.entries(channels)) {
    const moved = (Array.isArray(list) ? list : [])
      .filter(key => toFrames.has(key.frame))
      .map(key => ({ ...key, frame: toFrames.get(key.frame) }))
    if (moved.length) keys[channel] = moved
  }
  return upsertChannelKeys(next, keys)
}

// ---- 相机轨 ----

// 相机路径烘焙：先删旧路径帧、再按曲线逐帧写 transform.position/rotation + lens.focalLength。
// 相机沿曲线匀速（linear 插值），视线朝切线方向，无需用户手动改插值。
export function bakeCameraPath(tracks, path, camera, bakedFrames, removeFrames = []) {
  let next = removeChannelFrames(tracks, [...removeFrames])
  for (const frame of bakedFrames) {
    const u = (frame.frame - path.startFrame) / Math.max(1, path.endFrame - path.startFrame)
    const tangent = pathTangentAtFraction(path, u) || [0, 0, -1]
    const targetPoint = [frame.position[0] + tangent[0], frame.position[1] + tangent[1], frame.position[2] + tangent[2]]
    const snapshot = {
      frame: frame.frame,
      interpolation: 'linear',
      position: frame.position,
      rotation: cameraRotationToward(frame.position, targetPoint),
      focalLength: camera.focalLength,
    }
    next = upsertChannelKeys(next, snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation))
  }
  return next
}

// 增/改一帧（整快照拆进 transform/lens）。
export const upsertCameraSnapshot = (tracks, snapshot) =>
  upsertChannelKeys(tracks, snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation))

// 删除一帧或一批帧（transform/lens 同时删，避免漏删幽灵 key）。
export const removeCameraFrames = (tracks, frames) =>
  removeChannelFrames(tracks, Array.isArray(frames) ? frames : [frames])

// 整帧平移。
export const moveCameraFrame = (tracks, fromFrame, toFrame) => moveChannelFrames(tracks, fromFrame, toFrame)

// 改某帧插值。
export const setCameraInterpolation = (tracks, frame, value) => setChannelInterpolation(tracks, frame, value)
