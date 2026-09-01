// 对象动画「通道化」M1 数据契约 纯逻辑测试
// 覆盖：
//   M1-C1 三实体通道划分（camera/object/person）+ 轨内 key 只含本通道字段
//   M1-C2 每字段属且只属一通道（不重复登记、不做无谓拆分）
//   M1-C3 通道内 key 支持部分字段（未含字段不落 fields）
//   M1-C4 通道名/字段名走统一登记表（此处验证所有落库字段均来自 ENTITY_CHANNELS）
//   M1-C5 派生量（motionStartTime）不落通道字段
//   M1-C6 旧整快照 → 通道结构无损迁移，迁移后播放逐帧一致（对 camera/object/person 三实体）
// 另含：迁移幂等性、keyframeMaxFrame/clampKeyframeFrames 通道化适配、写入口 upsert/remove、读侧桥 flatten。
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest'
import { presetJoints } from '../../src/components/director3d/rig.ts'
import type { ChannelTracks, ChannelKey, ProjectObject } from '../../src/components/director3d/project.ts'
import {
  ENTITY_CHANNELS,
  snapshotToChannelKeys,
  channelsToSnapshotKeys,
  snapshotKeysForTrack,
  countChannelKeyframes,
  upsertChannelKeys,
  removeChannelFrames,
  moveChannelFrames,
  normalizeObjectTracks,
  normalizeCameraKeyframes,
  normalizeProjectData,
  objectAtFrame,
  cameraAtFrame,
  objectsAtFrame,
  keyframeMaxFrame,
  clampKeyframeFrames,
  initialCamera,
} from '../../src/components/director3d/project.ts'

// ---- 测试样本：与 objectKeyframeFromObject / addObjectKeyframe 产出形状一致的整快照 key ----

const person = {
  id: 'actor-lead', type: 'person', pose: 'walk', poseTime: 0.4, continuousMotion: true,
  position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1],
  rigRoot: [0, 0, 0], joints: presetJoints('walk'),
}

const box = {
  id: 'block-stage', type: 'box',
  position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1],
}

// 旧整快照：人物两段动作（walk→walk 连续运动 → run 切状态段），验证骨骼插值/硬切语义不破
const legacyPersonKeys = [
  { frame: 0, interpolation: 'smooth', position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: presetJoints('walk') },
  { frame: 24, interpolation: 'linear', position: [0, 0, 0.3], rotation: [0, 0.5, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 1.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: presetJoints('walk') },
  { frame: 48, interpolation: 'smooth', position: [1.5, 0, 0.3], rotation: [0, 0.9, 0], scale: [1, 1, 1], pose: 'run', poseTime: 0.6, continuousMotion: true, rigRoot: [0, 0, 0], joints: presetJoints('run') },
]

// 旧整快照：普通物体（旧实现也写入 pose 等字段，但物体无姿态语义，应被通道化收敛到仅 transform）
const legacyBoxKeys = [
  { frame: 0, interpolation: 'smooth', position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [1, 1, 1], pose: 'idle', poseTime: 0, continuousMotion: false, rigRoot: [0, 0, 0], joints: presetJoints('idle') },
  { frame: 24, interpolation: 'linear', position: [2, 0.45, -0.8], rotation: [0, 0.2, 0], scale: [1.2, 1, 1], pose: 'idle', poseTime: 0, continuousMotion: false, rigRoot: [0, 0, 0], joints: presetJoints('idle') },
]

const legacyCamKeys = [
  { frame: 0, interpolation: 'smooth', position: [7.4, 4.6, 8.2], rotation: [0.3, 0, 0], focalLength: 42 },
  { frame: 24, interpolation: 'linear', position: [5, 4, 6], rotation: [0.4, 0, 0], focalLength: 35 },
]

const sampleFrames = [0, 5, 10, 24, 36, 48]

// ---- M1.1 实体·通道注册表（M1-C1 / C2 / C5） ----

describe('M1.1 实体·通道注册表 ENTITY_CHANNELS', () => {
  it('三实体通道划分符合 PRD 草案（M1-C1）；continuousMotion 撤出 action 归 objectState（47）', () => {
    expect(ENTITY_CHANNELS.camera).toEqual({ transform: ['position', 'rotation'], lens: ['focalLength'] })
    expect(ENTITY_CHANNELS.object).toEqual({ transform: ['position', 'rotation', 'scale'] })
    expect(ENTITY_CHANNELS.person).toEqual({ transform: ['position', 'rotation', 'scale'], action: ['pose', 'poseTime'], skeleton: ['rigRoot', 'joints'] })
  })

  it('同实体下每个字段属且只属一个通道（M1-C2 无重复登记）', () => {
    for (const definition of Object.values(ENTITY_CHANNELS)) {
      const fields = Object.values(definition).flat()
      expect(new Set(fields).size).toBe(fields.length)
    }
  })

  it('派生量 motionStartTime 不落任何通道字段（M1-C5）', () => {
    const allFields = Object.values(ENTITY_CHANNELS).flatMap(definition => Object.values(definition).flat())
    expect(allFields).not.toContain('motionStartTime')
  })
})

// ---- M1.2 轨数据结构 + snapshotToChannelKeys（M1-C1 / C3） ----

describe('M1.2 整快照 → 通道 key（snapshotToChannelKeys）', () => {
  it('人物整快照按 transform/action/skeleton 拆包，fields 无跨通道混入（M1-C1）', () => {
    const keys = snapshotToChannelKeys('person', legacyPersonKeys[0], 0, 'smooth')
    expect(Object.keys(keys).sort()).toEqual(['action', 'skeleton', 'transform'])
    expect(keys.transform[0].fields).toEqual({ position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1] })
    expect(Object.keys(keys.action[0].fields).sort()).toEqual(['pose', 'poseTime'])
    expect(Object.keys(keys.skeleton[0].fields).sort()).toEqual(['joints', 'rigRoot'])
    // 反例：transform.fields 里不得出现动作/骨骼字段
    // objectState（continuousMotion）不进任何通道（47）
    expect(keys.action[0].fields.continuousMotion).toBeUndefined()
    expect(keys.transform[0].fields.pose).toBeUndefined()
    expect(keys.transform[0].fields.joints).toBeUndefined()
  })

  it('摄像机整快照拆为 transform + lens（镜头通道独立）', () => {
    const keys = snapshotToChannelKeys('camera', legacyCamKeys[0], 0, 'smooth')
    expect(Object.keys(keys).sort()).toEqual(['lens', 'transform'])
    expect(keys.transform[0].fields).toEqual({ position: [7.4, 4.6, 8.2], rotation: [0.3, 0, 0] })
    expect(keys.lens[0].fields).toEqual({ focalLength: 42 })
  })

  it('普通物体整快照只产生 transform 通道（pose 等无效字段被收敛掉）', () => {
    const keys = snapshotToChannelKeys('object', legacyBoxKeys[0], 0, 'smooth')
    expect(Object.keys(keys)).toEqual(['transform'])
    expect(keys.transform[0].fields).toEqual({ position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [1, 1, 1] })
  })

  it('通道内 key 支持部分字段：只含 position 的 key 不落 rotation（M1-C3）', () => {
    const keys = snapshotToChannelKeys('person', { position: [1, 2, 3] }, 5, 'smooth')
    expect(Object.keys(keys)).toEqual(['transform'])
    expect(keys.transform[0].fields).toEqual({ position: [1, 2, 3] })
    expect(keys.transform[0].fields.rotation).toBeUndefined()
  })

  it('插值方式随 key 透传（M1-C3 语义的一部分）', () => {
    const keys = snapshotToChannelKeys('person', legacyPersonKeys[1], 24, 'linear')
    expect(keys.transform[0].interpolation).toBe('linear')
  })

  it('未知实体类型回退到 object（默认仅 transform）', () => {
    const keys = snapshotToChannelKeys('alien', legacyBoxKeys[0], 0, 'smooth')
    expect(Object.keys(keys)).toEqual(['transform'])
  })
})

// ---- 读侧桥：通道 → 整快照（channelsToSnapshotKeys / snapshotKeysForTrack） ----

describe('读侧桥 channelsToSnapshotKeys（M2 求值器落地前的过渡）', () => {
  it('人物通道 round-trip 还原整快照所有字段与帧序', () => {
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    const flat = channelsToSnapshotKeys('person', channels['actor-lead'])
    expect(flat.map(key => key.frame)).toEqual([0, 24, 48])
    expect(flat[0].pose).toBe('walk')
    expect(flat[0].position).toEqual([-1.25, 0, 0.3])
    expect(flat[0].rigRoot).toEqual([0, 0, 0])
    expect(flat[0].joints).toEqual(presetJoints('walk'))
    expect(flat[1].interpolation).toBe('linear')
  })

  it('snapshotKeysForTrack 对已通道化/旧数组输入均返回整快照数组', () => {
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    expect(snapshotKeysForTrack(channels['actor-lead'], 'person')).toEqual(channelsToSnapshotKeys('person', channels['actor-lead']))
    expect(snapshotKeysForTrack(legacyPersonKeys, 'person')).toEqual(legacyPersonKeys.map(key => ({ ...key })))
  })
})

// ---- M1-C6 无损迁移 + 逐帧一致锚 ----

describe('M1-C6 旧整快照无损迁移 → 播放逐帧一致', () => {
  it('人物：迁移+flatten 后 objectAtFrame 逐帧输出与旧实现完全一致', () => {
    const legacyResults = sampleFrames.map(frame => objectAtFrame(person, legacyPersonKeys, frame, 24))
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    const flatBack = channelsToSnapshotKeys('person', channels['actor-lead']) as ChannelKey[]
    const migratedResults = sampleFrames.map(frame => objectAtFrame(person, flatBack, frame, 24))
    expect(migratedResults).toEqual(legacyResults)
  })

  it('普通物体：旧实现写入的 pose 字段被收敛后，播放输出不变', () => {
    const legacyResults = sampleFrames.map(frame => objectAtFrame(box, legacyBoxKeys, frame, 24))
    const channels = normalizeObjectTracks({ 'block-stage': legacyBoxKeys }, { 'block-stage': 'object' })
    const flatBack = channelsToSnapshotKeys('object', channels['block-stage']) as ChannelKey[]
    const migratedResults = sampleFrames.map(frame => objectAtFrame(box, flatBack, frame, 24))
    // 物体无姿态语义（M1-C1 只留 transform 通道），求值回退的 poseTime 等字段不影响渲染；
    // 断言对渲染真正生效的 transform 字段逐帧一致即可。
    const pickTransform = result => ({ position: result.position, rotation: result.rotation, scale: result.scale })
    expect(migratedResults.map(pickTransform)).toEqual(legacyResults.map(pickTransform))
    // 收敛生效：物体轨道不再携带 pose/poseTime 等无意义字段
    expect(flatBack[0].pose).toBeUndefined()
    expect(flatBack[0].poseTime).toBeUndefined()
    expect(flatBack[0].joints).toBeUndefined()
  })

  it('摄像机：迁移为 transform/lens 双通道后 cameraAtFrame 逐帧一致', () => {
    const legacyResults = sampleFrames.map(frame => cameraAtFrame(legacyCamKeys, frame, '16:9'))
    const channels = normalizeCameraKeyframes(legacyCamKeys, initialCamera)
    const flatBack = channelsToSnapshotKeys('camera', channels)
    const migratedResults = sampleFrames.map(frame => cameraAtFrame(flatBack, frame, '16:9'))
    expect(migratedResults).toEqual(legacyResults)
  })

  it('摄像机：cameraAtFrame 直接接收通道结构也得到一致结果', () => {
    const channels = normalizeCameraKeyframes(legacyCamKeys, initialCamera)
    expect(cameraAtFrame(channels, 12, '16:9')).toEqual(cameraAtFrame(legacyCamKeys, 12, '16:9'))
  })

  it('objectsAtFrame 直接消费通道化轨道，输出与整快照求值一致', () => {
    const channels = {
      'actor-lead': normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })['actor-lead'],
      'block-stage': normalizeObjectTracks({ 'block-stage': legacyBoxKeys }, { 'block-stage': 'object' })['block-stage'],
    }
    const viaChannels = objectsAtFrame([person, box], channels, 10, 24)
    const viaLegacy = objectsAtFrame([person, box], { 'actor-lead': legacyPersonKeys, 'block-stage': legacyBoxKeys }, 10, 24)
    // 人物：动作/骨骼语义全保留，整对象逐字段一致
    expect(viaChannels[0]).toEqual(viaLegacy[0])
    // 物体：无姿态语义，仅比对渲染生效的 transform 字段
    expect(viaChannels[1].position).toEqual(viaLegacy[1].position)
    expect(viaChannels[1].rotation).toEqual(viaLegacy[1].rotation)
    expect(viaChannels[1].scale).toEqual(viaLegacy[1].scale)
  })

  it('整工程 normalizeProjectData：旧数据迁移为通道结构', () => {
    const project = normalizeProjectData({
      version: 17,
      settings: { fps: 24, durationSeconds: 15 },
      shots: [{
        id: 'shot-01', name: '镜头 01',
        objects: [person, box],
        camera: initialCamera,
        keyframes: legacyCamKeys,
        objectKeyframes: { 'actor-lead': legacyPersonKeys, 'block-stage': legacyBoxKeys },
        paths: {},
      }],
    })
    expect(project.keyframes.transform).toBeInstanceOf(Array)
    expect(project.keyframes.lens).toBeInstanceOf(Array)
    expect(project.objectKeyframes['actor-lead'].action).toBeInstanceOf(Array)
    expect(project.objectKeyframes['actor-lead'].skeleton).toBeInstanceOf(Array)
    expect(project.objectKeyframes['block-stage'].transform).toBeInstanceOf(Array)
    expect(project.objectKeyframes['block-stage'].action).toBeUndefined()
  })
})

// ---- 归一化幂等 + 通道化适配 ----

describe('归一化与通道化工具（幂等/统计/clamp/写入口）', () => {
  it('normalizeObjectTracks 对已通道化输入幂等（跑两次结果一致）', () => {
    const once = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    const twice = normalizeObjectTracks(once, { 'actor-lead': 'person' })
    expect(twice).toEqual(once)
  })

  it('normalizeCameraKeyframes 对已通道化输入幂等', () => {
    const once = normalizeCameraKeyframes(legacyCamKeys, initialCamera)
    const twice = normalizeCameraKeyframes(once, initialCamera)
    expect(twice).toEqual(once)
  })

  it('通道化 key 归一化 frame/interpolation（frame 字符串/越界自动规整）', () => {
    // 故意喂 frame:'3'（字符串脏数据）测 clamp 兜底；用 unknown as 标注此处为故意
    const noisy = { 'actor-lead': { transform: [{ frame: '3', interpolation: 'hold', fields: { position: [1, 2, 3] } }] } } as unknown as ChannelTracks
    const normalized = normalizeObjectTracks(noisy, { 'actor-lead': 'person' })
    expect(normalized['actor-lead'].transform[0].frame).toBe(3)
    expect(normalized['actor-lead'].transform[0].interpolation).toBe('hold')
  })

  it('countChannelKeyframes 统计通道结构 / 旧数组 / 空值', () => {
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    expect(countChannelKeyframes(channels['actor-lead'])).toBe(3)
    expect(countChannelKeyframes(legacyPersonKeys)).toBe(3)
    expect(countChannelKeyframes({})).toBe(0)
    expect(countChannelKeyframes([])).toBe(0)
  })

  it('keyframeMaxFrame 在通道化结构下取到各通道最大帧', () => {
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    const camChannels = normalizeCameraKeyframes(legacyCamKeys, initialCamera)
    expect(keyframeMaxFrame(camChannels, channels)).toBe(48)
    expect(keyframeMaxFrame({}, {})).toBe(0)
  })

  it('clampKeyframeFrames 对通道化结构逐通道 clamp', () => {
    const channels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })
    const clamped = clampKeyframeFrames(channels['actor-lead'], 30)
    const frames = Object.values(clamped).flatMap((list: ChannelKey[]) => list.map((key: ChannelKey) => key.frame))
    expect(Math.max(...frames)).toBeLessThanOrEqual(30)
    expect((clamped as ChannelTracks).transform.map((key: ChannelKey) => key.frame)).toEqual([0, 24, 30])
  })

  it('upsertChannelKeys：写入口按通道合并，同帧覆盖', () => {
    let channels: ChannelTracks = {}
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[0], 0, 'smooth'))
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[1], 24, 'linear'))
    expect(countChannelKeyframes(channels)).toBe(2)
    expect(Object.keys(channels).sort()).toEqual(['action', 'skeleton', 'transform'])
    // 同帧重写：只更新该帧、不新增
    const overwrite = { ...legacyPersonKeys[0], position: [9, 9, 9] }
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', overwrite, 0, 'smooth'))
    expect(countChannelKeyframes(channels)).toBe(2)
    expect((channels).transform[0].fields.position).toEqual([9, 9, 9])
  })

  it('removeChannelFrames：从所有通道删除指定帧', () => {
    let channels: ChannelTracks = {}
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[0], 0, 'smooth'))
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[1], 24, 'linear'))
    const removed = removeChannelFrames(channels, [24])
    expect(countChannelKeyframes(removed)).toBe(1)
    expect(removed.transform[0].frame).toBe(0)
  })

  it('moveChannelFrames：把某帧在所有通道整体平移为另一帧', () => {
    let channels: ChannelTracks = {}
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[0], 0, 'smooth'))
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[1], 24, 'linear'))
    const moved = moveChannelFrames(channels, 24, 12)
    expect(countChannelKeyframes(moved)).toBe(2)
    expect((moved as ChannelTracks).transform.map((key: ChannelKey) => key.frame).sort()).toEqual([0, 12])
    expect((moved as ChannelTracks).action.map((key: ChannelKey) => key.frame).sort()).toEqual([0, 12])
    // 移到已存在的帧：目标帧旧 key 被覆盖，帧数不重复
    const collide = moveChannelFrames(channels, 0, 24)
    expect(countChannelKeyframes(collide)).toBe(1)
    expect((collide as ChannelTracks).transform[0].frame).toBe(24)
    // 同帧平移为幂等
    expect(moveChannelFrames(channels, 0, 0)).toBe(channels)
  })
})
