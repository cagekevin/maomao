// 对象动画「通道化」M2 逐帧求值与合成引擎 纯逻辑测试
// 覆盖：
//   M2-C1 单通道求值只输出该帧 key 含字段；未含字段该帧不解接管（部分字段语义）
//   M2-C2 合成器按注册通道顺序合并，每字段唯一归因；未接管字段保持底层基线
//   M2-C3 迁移验证锚：旧整快照求值（参考实现）vs 新通道求值，person/object/camera 三实体逐帧全等（浮点容差）
//   M2-C4 改动作切状态段 → 骨骼 hard 切，与旧行为一致（不悄悄变成插值，杜绝走走停停回归）
//   M2-C6 查询基元边界：exact / 首前 / 末后 / 段内 定位正确（相机轨与对象轨共用同一套基元）
//   M2-C7 骨骼「插值 or hard 切」决策消费动作通道派生上下文；仅动作通道时骨骼不被接管、不自猜
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest'
import {
  normalizePoseId, presetPhase, poseCanLoop, poseForObject, interpolateJointPose, cloneJointPose, presetJoints,
} from '../../src/components/director3d/rig.ts'
import {
  lerp, lerpAngle, segmentAmount, initialCamera,
  objectAtFrame, objectsAtFrame, cameraAtFrame,
  normalizeObjectTracks, normalizeCameraKeyframes,
  snapshotToChannelKeys, upsertChannelKeys,
  ENTITY_CHANNELS, OBJECT_STATE_FIELDS,
} from '../../src/components/director3d/project.ts'

const FPS = 24

// ---- 测试样本（与 channelContract.test.js 一致，保证迁移锚可比） ----
// 注意：presetJoints('walk')/('run') 的 joints 在预设未定义关节时为全零（实际姿态由动画 clip 驱动），
// 二者相同，无法观测「硬切」。故此处为 walk/run 注入不同关节值。
// 关节键必须带 `mixamorig` 前缀：cloneJointPose 只拷贝 JOINT_DEFINITIONS 里登记的关节 id，
// 无前缀的裸键会被过滤掉，注入值等于白注入（这是 hidden bug，前缀写全才能让硬切可被断言）。
// 迁移锚只比较新旧求值，不受注入值影响。

const walkJoints = { mixamorigHips: [0.02, 0.01, 0.03], mixamorigLeftUpLeg: [0.12, 0.02, 0.05] }
const runJoints = { mixamorigHips: [0.2, 0.18, 0.25], mixamorigRightUpLeg: [0.45, 0.05, 0.1] }

const person = {
  id: 'actor-lead', type: 'person', pose: 'walk', poseTime: 0.4, continuousMotion: true,
  position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1],
  rigRoot: [0, 0, 0], joints: walkJoints,
}

const box = {
  id: 'block-stage', type: 'box',
  position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1],
}

const legacyPersonKeys = [
  { frame: 0, interpolation: 'smooth', position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 24, interpolation: 'linear', position: [0, 0, 0.3], rotation: [0, 0.5, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 1.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 48, interpolation: 'smooth', position: [1.5, 0, 0.3], rotation: [0, 0.9, 0], scale: [1, 1, 1], pose: 'run', poseTime: 0.6, continuousMotion: true, rigRoot: [0, 0, 0], joints: runJoints },
]

const legacyBoxKeys = [
  { frame: 0, interpolation: 'smooth', position: [1.4, 0.45, -0.8], rotation: [0, -0.18, 0], scale: [2.8, 0.9, 2.1], pose: 'idle', poseTime: 0, continuousMotion: false, rigRoot: [0, 0, 0], joints: presetJoints('idle') },
  { frame: 24, interpolation: 'linear', position: [2, 0.45, -0.8], rotation: [0, 0.2, 0], scale: [1.2, 1, 1], pose: 'idle', poseTime: 0, continuousMotion: false, rigRoot: [0, 0, 0], joints: presetJoints('idle') },
]

const legacyCamKeys = [
  { frame: 0, interpolation: 'smooth', position: [7.4, 4.6, 8.2], rotation: [0.3, 0, 0], focalLength: 42 },
  { frame: 24, interpolation: 'linear', position: [5, 4, 6], rotation: [0.4, 0, 0], focalLength: 35 },
]

// 迁移到通道结构（复用 M1 归一化入口）
const personChannels = normalizeObjectTracks({ 'actor-lead': legacyPersonKeys }, { 'actor-lead': 'person' })['actor-lead']
const boxChannels = normalizeObjectTracks({ 'block-stage': legacyBoxKeys }, { 'block-stage': 'object' })['block-stage']
const camChannels = normalizeCameraKeyframes(legacyCamKeys, initialCamera)

// ---- 旧整快照求值参考实现（迁移验证锚）：逐字复刻现网 objectAtFrame / cameraAtFrame ----
// 仅作对照基准，M2 引擎落地后若此基准与现网一致、新引擎与基准全等，即证明「换内构、行为不变」。

function legacyObjectAtFrame(object, keyframes, frame, fps) {
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

function legacyCameraAtFrame(keyframes, frame, aspectRatio = '16:9') {
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

// ---- 断言工具 ----

// 递归容差比较：数值在容差内视为相等，数组逐元素比，对象按 expected 的键子集比。
function compareSubset(actual, expected, fields, tolerance = 1e-9) {
  for (const field of fields) {
    const a = actual[field]
    const e = expected[field]
    if (Array.isArray(e) && Array.isArray(a)) {
      expect(a.length).toBe(e.length)
      e.forEach((value, index) => {
        if (typeof value === 'number' && typeof a[index] === 'number') {
          expect(Math.abs(a[index] - value)).toBeLessThanOrEqual(tolerance)
        } else {
          expect(a[index]).toEqual(value)
        }
      })
    } else if (typeof e === 'number' && typeof a === 'number') {
      expect(Math.abs(a - e)).toBeLessThanOrEqual(tolerance)
    } else {
      expect(a).toEqual(e)
    }
  }
}

// ---- M2-C1 单通道求值：部分字段 key 不解接管 ----

describe('M2-C1 单通道求值：未含字段不解接管', () => {
  it('普通物体：仅 position 关键帧 → rotation/scale 保持基线', () => {
    const partial = upsertChannelKeys({}, snapshotToChannelKeys('object', { position: [3, 0, 0] }, 10, 'linear'))
    const atFrame = objectAtFrame(box, partial, 10, FPS)
    expect(atFrame.position).toEqual([3, 0, 0])
    expect(atFrame.rotation).toEqual(box.rotation)
    expect(atFrame.scale).toEqual(box.scale)
  })

  it('摄像机：仅 position 关键帧 → rotation/focalLength 保持基线', () => {
    const partial = upsertChannelKeys({}, snapshotToChannelKeys('camera', { position: [2, 3, 4] }, 10, 'linear'))
    const atFrame = cameraAtFrame(partial, 10, '16:9')
    expect(atFrame.position).toEqual([2, 3, 4])
    expect(atFrame.rotation).toEqual(initialCamera.rotation)
    expect(atFrame.focalLength).toBe(initialCamera.focalLength)
  })
})

// ---- M2-C2 合成器：每字段唯一归因，未接管字段保持基线 ----

describe('M2-C2 合成器按注册顺序合并', () => {
  it('人物：仅 transform 通道 → 动作/骨骼字段保持基线，且不产生派生量', () => {
    let tOnly = {}
    tOnly = upsertChannelKeys(tOnly, snapshotToChannelKeys('person', { position: [0, 1, 0] }, 0, 'smooth'))
    const atFrame = objectAtFrame(person, tOnly, 5, FPS)
    expect(atFrame.position).toEqual([0, 1, 0])
    expect(atFrame.pose).toEqual(person.pose)
    expect(atFrame.continuousMotion).toEqual(person.continuousMotion)
    expect(atFrame.rigRoot).toEqual(person.rigRoot)
    expect(atFrame.joints).toEqual(person.joints)
    expect(atFrame.motionStartTime).toBeUndefined()
  })

  it('人物：仅 action 通道 → 变换保持基线', () => {
    let aOnly = {}
    aOnly = upsertChannelKeys(aOnly, snapshotToChannelKeys('person', { pose: 'run', poseTime: 0.5, continuousMotion: true }, 0, 'smooth'))
    const atFrame = objectAtFrame(person, aOnly, 5, FPS)
    expect(atFrame.pose).toBe('run')
    expect(atFrame.position).toEqual(person.position)
    expect(atFrame.rotation).toEqual(person.rotation)
    expect(atFrame.scale).toEqual(person.scale)
    expect(atFrame.motionStartTime).toBe(0)
  })
})

// ---- M2-C3 迁移验证锚：新旧求值逐帧全等 ----

describe('M2-C3 迁移验证锚：旧整快照求值 vs 新通道求值 逐帧一致', () => {
  const personFields = ['position', 'rotation', 'scale', 'pose', 'poseTime', 'continuousMotion', 'motionStartTime', 'rigRoot', 'joints']
  const boxFields = ['position', 'rotation', 'scale']
  const camFields = ['position', 'rotation', 'focalLength', 'aspectRatio']

  it('人物：-5..60 逐帧全等（含 exact/首前/末后/段内/状态切换）', () => {
    for (let frame = -5; frame <= 60; frame += 1) {
      const legacy = legacyObjectAtFrame(person, legacyPersonKeys, frame, FPS)
      const current = objectAtFrame(person, personChannels, frame, FPS)
      compareSubset(current, legacy, personFields)
    }
  })

  it('普通物体：-5..40 逐帧 transform 全等', () => {
    for (let frame = -5; frame <= 40; frame += 1) {
      const legacy = legacyObjectAtFrame(box, legacyBoxKeys, frame, FPS)
      const current = objectAtFrame(box, boxChannels, frame, FPS)
      compareSubset(current, legacy, boxFields)
    }
  })

  it('摄像机：-5..40 逐帧全等', () => {
    for (let frame = -5; frame <= 40; frame += 1) {
      const legacy = legacyCameraAtFrame(legacyCamKeys, frame, '16:9')
      const current = cameraAtFrame(camChannels, frame, '16:9')
      compareSubset(current, legacy, camFields)
    }
  })

  it('objectsAtFrame 三实体混合轨逐帧一致', () => {
    const tracks = { 'actor-lead': personChannels, 'block-stage': boxChannels }
    for (let frame = 0; frame <= 40; frame += 1) {
      const current = objectsAtFrame([person, box], tracks, frame, FPS)
      const legacy = [legacyObjectAtFrame(person, legacyPersonKeys, frame, FPS), legacyObjectAtFrame(box, legacyBoxKeys, frame, FPS)]
      compareSubset(current[0], legacy[0], personFields)
      compareSubset(current[1], legacy[1], boxFields)
    }
  })
})

// ---- M2-C4 改动作切状态段 → 骨骼 hard 切 ----

describe('M2-C4 状态段边界：骨骼 hard 切与旧行为一致', () => {
  it('walk→run 切换区间（帧25-47）：骨骼保持左状态、不做插值', () => {
    const at24 = objectAtFrame(person, personChannels, 24, FPS)
    const at25 = objectAtFrame(person, personChannels, 25, FPS)
    const at47 = objectAtFrame(person, personChannels, 47, FPS)
    expect(at25.joints).toEqual(at24.joints)
    expect(at25.rigRoot).toEqual(at24.rigRoot)
    expect(at47.joints).toEqual(at24.joints)
  })

  it('硬切区间新求值与旧求值逐帧一致（不悄悄变插值）', () => {
    for (let frame = 25; frame <= 47; frame += 1) {
      const legacy = legacyObjectAtFrame(person, legacyPersonKeys, frame, FPS)
      const current = objectAtFrame(person, personChannels, frame, FPS)
      compareSubset(current, legacy, ['pose', 'poseTime', 'continuousMotion', 'motionStartTime', 'rigRoot', 'joints'])
    }
  })

  it('同状态段内（帧1-23）骨骼正常插值', () => {
    const at23 = objectAtFrame(person, personChannels, 23, FPS)
    const at1 = objectAtFrame(person, personChannels, 1, FPS)
    // 同 walk 状态，rigRoot 恒等 → 数值一致；joints 同姿态插值后与端点一致（walk→walk）
    expect(at1.joints).toEqual(at23.joints)
  })
})

// ---- M2-C6 查询基元边界 ----

describe('M2-C6 查询基元：exact / 首前 / 末后 / 段内 定位', () => {
  it('摄像机：exact 帧命中关键帧值', () => {
    expect(cameraAtFrame(camChannels, 0, '16:9').position).toEqual([7.4, 4.6, 8.2])
    expect(cameraAtFrame(camChannels, 24, '16:9').position).toEqual([5, 4, 6])
  })
  it('摄像机：首前取最近 key（帧0），末后取最近 key（帧24）', () => {
    expect(cameraAtFrame(camChannels, -2, '16:9').position).toEqual([7.4, 4.6, 8.2])
    expect(cameraAtFrame(camChannels, 40, '16:9').position).toEqual([5, 4, 6])
  })
  it('摄像机：段内插值与参考一致', () => {
    const current = cameraAtFrame(camChannels, 12, '16:9')
    const legacy = legacyCameraAtFrame(legacyCamKeys, 12, '16:9')
    compareSubset(current, legacy, ['position', 'rotation', 'focalLength', 'aspectRatio'])
  })
  it('对象：exact/首前/末后/段内 定位与参考一致', () => {
    for (const frame of [-3, 0, 1, 12, 24, 40]) {
      compareSubset(objectAtFrame(box, boxChannels, frame, FPS), legacyObjectAtFrame(box, legacyBoxKeys, frame, FPS), ['position', 'rotation', 'scale'])
    }
  })
})

// ---- M2-C7 骨骼决策来自动作通道派生上下文 ----

describe('M2-C7 骨骼决策消费动作通道派生上下文', () => {
  it('仅 action 通道（无 skeleton）：骨骼不被接管、不自猜状态', () => {
    // 基线人物用 idle 姿态（骨骼=idle），动作通道 K walk —— 若骨骼自猜会落到 walk 骨骼，
    // 正确行为是「无骨骼关键帧 → 不解接管」，保持基线 idle 骨骼。
    const personIdle = { ...person, pose: 'idle', poseTime: 0, continuousMotion: false, joints: presetJoints('idle') }
    let channels: any = {}
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[0], 0, 'smooth'))
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', legacyPersonKeys[1], 24, 'linear'))
    const actionOnly = { action: channels.action }
    const atFrame = objectAtFrame(personIdle, actionOnly, 12, FPS)
    // 动作字段被接管
    expect(atFrame.pose).toBe('walk')
    // continuousMotion 是 objectState：沿基线（false），不被 action 通道关键帧值覆盖（47）
    expect(atFrame.continuousMotion).toBe(false)
    // 骨骼无关键帧 → 保持基线 idle 骨骼，而非被「猜状态」改成 walk 骨骼
    expect(atFrame.rigRoot).toEqual(personIdle.rigRoot)
    expect(atFrame.joints).toEqual(presetJoints('idle'))
  })

  it('动作+骨骼同时存在：骨骼硬切边界由动作状态段决定（walk→run 在 24-48 间切）', () => {
    // 帧47（run 段前）骨骼=walk；帧48（run 段）骨骼=run
    const beforeSwitch = objectAtFrame(person, personChannels, 47, FPS)
    const afterSwitch = objectAtFrame(person, personChannels, 48, FPS)
    expect(beforeSwitch.pose).toBe('walk')
    expect(afterSwitch.pose).toBe('run')
    // 帧48 exact 命中骨架通道 run 帧 → 输出被克隆后的注入 run 骨骼（非 presetJoints('run')）
    expect(afterSwitch.joints).toEqual(cloneJointPose(runJoints))
    // 骨骼在切段帧发生 hard 切（run 的 joints 不等于 walk 的 joints）
    expect(afterSwitch.joints).not.toEqual(beforeSwitch.joints)
  })
})

// ---- 47 三层注册表契约：objectState 沿基线 / 派生通道 / 不落通道 ----

describe('47 三层注册表：objectState 沿基线不被关键帧覆盖', () => {
  it('先勾后打帧再播放：continuousMotion 恒沿基线 true，不被旧 action 关键帧 false 覆盖（46 病灶）', () => {
    // 基线勾选 true；但 action 通道已录一帧 continuousMotion=false（模拟旧数据或打帧当下为 false）
    const base = { ...person, continuousMotion: true }
    let channels: any = {}
    // 用不含 continuousMotion 的 action key（真值已撤出通道），叠加一个含 false 的旧结构 key，验证求值仍取基线
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', { pose: 'walk', poseTime: 0.4 }, 0, 'smooth'))
    channels.action = [{ frame: 0, interpolation: 'smooth', fields: { pose: 'walk', poseTime: 0.4, continuousMotion: false } }]
    const atFrame = objectAtFrame(base, channels, 5, FPS)
    expect(atFrame.continuousMotion).toBe(true) // 即便关键帧里残留 false，仍沿基线 true
    // 反证：基线 false 时，即使通道残留 true 也不覆盖
    const off = objectAtFrame({ ...person, continuousMotion: false }, channels, 5, FPS)
    expect(off.continuousMotion).toBe(false)
  })

  it('footLock（objectState）同沿基线，不参与任何通道求值', () => {
    const base = { ...person, footLock: true }
    let channels: any = {}
    channels = upsertChannelKeys(channels, snapshotToChannelKeys('person', { pose: 'walk', poseTime: 0.4 }, 0, 'smooth'))
    expect(objectAtFrame(base, channels, 5, FPS).footLock).toBe(true)
  })
})

describe('47 三层注册表：派生的 ENTITY_CHANNELS 与 OBJECT_STATE_FIELDS', () => {
  it('continuousMotion/footLock 被收进 OBJECT_STATE_FIELDS.person，且不在任何 ENTITY_CHANNELS 通道', () => {
    expect(OBJECT_STATE_FIELDS.person).toEqual(expect.arrayContaining(['continuousMotion', 'footLock']))
    const channelFields = Object.values(ENTITY_CHANNELS.person).flat()
    expect(channelFields).not.toContain('continuousMotion')
    expect(channelFields).not.toContain('footLock')
  })

  it('camera 的 targetMode/targetId 归 objectState；派生命中化通道仅 animatable（47 §3）', () => {
    expect(OBJECT_STATE_FIELDS.camera).toEqual(expect.arrayContaining(['targetMode', 'targetId']))
    expect(ENTITY_CHANNELS.camera.transform).toEqual(['position', 'rotation'])
    expect(ENTITY_CHANNELS.camera.lens).toEqual(['focalLength'])
    expect(ENTITY_CHANNELS.camera.lens).not.toContain('targetMode')
  })
})
