// 对象动画「通道化」M4 采集入口与兼容迁移 纯逻辑测试
// 覆盖：
//   M4-C1 统一写入口 writeObjectTrack（增/改/删/移动/改插值/清空/批处理）+ 空轨自动删条目
//   M4-C2 混合 legacy 轨迁移：路径帧剥姿态残留、手动帧完整迁入对应通道
//   M4-C3 迁移幂等：同一旧数据多次迁移产出完全一致结果
//   M4-C4 迁移后依赖 M2 逐帧一致：旧整快照求值（参考实现）vs 迁移后新求值全等（浮点容差）
//   M4-C5 批处理原子性：一次 batch（先删旧路径帧再整批插新）结果正确，手动帧不丢
//   M4-C6 混合轨迁移规则：①路径帧无姿态残留 ②手动帧字段完整迁入 ③路径启用时 position=路径、动作/骨骼不丢
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest'
import {
  cloneJointPose, interpolateJointPose, normalizePoseId, poseCanLoop, poseForObject, presetPhase,
} from '../../src/components/director3d/rig.ts'
import {
  lerp, segmentAmount, objectAtFrame,
  normalizeObjectTracks, normalizeCameraPath, snapshotToChannelKeys,
  writeObjectTrack, setChannelInterpolation,
} from '../../src/components/director3d/project.ts'

const FPS = 24

// ---- 样本 ----
// 关节键带 `mixamorig` 前缀（cloneJointPose 只拷贝 JOINT_DEFINITIONS 登记的关节，无前缀会被过滤）。
const walkJoints = { mixamorigHips: [0.02, 0.01, 0.03], mixamorigLeftUpLeg: [0.12, 0.02, 0.05] }
const runJoints = { mixamorigHips: [0.2, 0.18, 0.25], mixamorigRightUpLeg: [0.45, 0.05, 0.1] }

const person = {
  id: 'actor-lead', type: 'person', pose: 'walk', poseTime: 0.4, continuousMotion: true,
  position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1],
  rigRoot: [0, 0, 0], joints: walkJoints,
}

// 直线路径：从 (0,·,0) 平移到 (10,·,0)，[0,240] 帧，烘焙帧 0/60/120/180/240（sourceKeyframeFrames 记录）。
const straightPath = normalizeCameraPath({
  points: [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
  startFrame: 0, endFrame: 240, keyframeCount: 5,
  sourceKeyframeFrames: [0, 60, 120, 180, 240],
})

// 混合 legacy 轨：路径帧（旧路径系统写入整份姿态快照，含姿态残留）+ 手动帧（用户 K 的完整快照）。
const legacyMixedTrack = [
  { frame: 0, interpolation: 'linear', position: [0, 0, 0], rotation: [0, 0.1, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.5, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 24, interpolation: 'smooth', position: [100, 0, 100], rotation: [0, 0.5, 0], scale: [1.2, 1, 1], pose: 'run', poseTime: 0.6, continuousMotion: true, rigRoot: [0, 0, 0], joints: runJoints },
  { frame: 60, interpolation: 'linear', position: [2.5, 0, 0], rotation: [0, 0.2, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.5, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 120, interpolation: 'linear', position: [5, 0, 0], rotation: [0, 0.3, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.5, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 180, interpolation: 'linear', position: [7.5, 0, 0], rotation: [0, 0.4, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.5, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
  { frame: 240, interpolation: 'linear', position: [10, 0, 0], rotation: [0, 0.5, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.5, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
]

const migrateMixed = () => normalizeObjectTracks(
  { 'actor-lead': legacyMixedTrack },
  { 'actor-lead': 'person' },
  { 'actor-lead': straightPath },
)['actor-lead']

// ---- M4-C1 统一写入口 ----

describe('M4-C1 writeObjectTrack 统一写入口', () => {
  it('upsert 增/改一帧：同帧覆盖（整体替换该帧 key）', () => {
    const keys = snapshotToChannelKeys('person', { frame: 10, position: [1, 0, 0] }, 10, 'linear')
    const tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys })
    expect(tracks['actor-lead'].transform[0]).toEqual({ frame: 10, interpolation: 'linear', fields: { position: [1, 0, 0] } })
    // 同帧再写完整 key → 覆盖该帧（含插值）
    const replaceKeys = snapshotToChannelKeys('person', { frame: 10, position: [9, 0, 0], rotation: [0, 1, 0], scale: [1, 1, 1] }, 10, 'smooth')
    const after = writeObjectTrack(tracks, 'actor-lead', { op: 'upsert', keys: replaceKeys })
    expect(after['actor-lead'].transform).toHaveLength(1)
    expect(after['actor-lead'].transform[0].interpolation).toBe('smooth')
    expect(after['actor-lead'].transform[0].fields).toEqual({ position: [9, 0, 0], rotation: [0, 1, 0], scale: [1, 1, 1] })
  })

  it('remove 删帧；轨道写空后自动移除该对象条目', () => {
    const keys = snapshotToChannelKeys('person', { frame: 10, position: [1, 0, 0] }, 10, 'linear')
    const tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys })
    expect(Object.keys(tracks)).toEqual(['actor-lead'])
    const after = writeObjectTrack(tracks, 'actor-lead', { op: 'remove', frames: [10] })
    expect(after['actor-lead']).toBeUndefined()
  })

  it('move 整帧平移', () => {
    const keys = snapshotToChannelKeys('person', { frame: 10, position: [1, 0, 0], rotation: [0, 0.5, 0] }, 10, 'linear')
    const tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys })
    const moved = writeObjectTrack(tracks, 'actor-lead', { op: 'move', from: 10, to: 20 })
    expect(moved['actor-lead'].transform[0].frame).toBe(20)
  })

  it('interpolation 改该帧插值（各通道一致）', () => {
    const keys = snapshotToChannelKeys('person', { frame: 10, position: [1, 0, 0], pose: 'walk', poseTime: 0.5, continuousMotion: true }, 10, 'linear')
    const tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys })
    const updated = writeObjectTrack(tracks, 'actor-lead', { op: 'interpolation', frame: 10, value: 'hold' })
    for (const list of Object.values(updated['actor-lead'])) {
      expect(list[0].interpolation).toBe('hold')
    }
  })

  it('clear 清空整条轨道（删除对象时随对象移除）', () => {
    const keys = snapshotToChannelKeys('person', { frame: 10, position: [1, 0, 0] }, 10, 'linear')
    const tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys })
    expect(writeObjectTrack(tracks, 'actor-lead', { op: 'clear' })['actor-lead']).toBeUndefined()
  })

  it('setChannelInterpolation 只改目标帧、不动其它帧', () => {
    const channels = {
      transform: [
        { frame: 0, interpolation: 'smooth', fields: { position: [0, 0, 0] } },
        { frame: 10, interpolation: 'linear', fields: { position: [1, 0, 0] } },
      ],
    }
    const next = setChannelInterpolation(channels, 10, 'hold')
    expect(next.transform[0].interpolation).toBe('smooth')
    expect(next.transform[1].interpolation).toBe('hold')
  })
})

// ---- M4-C5 批处理原子性 ----

describe('M4-C5 batch 原子性（路径 bake 先删旧帧再整批插新）', () => {
  it('一次 batch 结果 = 顺序手写结果，手动帧不丢', () => {
    const seed = snapshotToChannelKeys('person', { frame: 24, position: [100, 0, 100], pose: 'run', poseTime: 0.6, continuousMotion: true }, 24, 'smooth')
    let tracks = writeObjectTrack({}, 'actor-lead', { op: 'upsert', keys: seed })
    tracks = writeObjectTrack(tracks, 'actor-lead', { op: 'upsert', keys: snapshotToChannelKeys('person', { frame: 0, position: [0, 0, 0] }, 0, 'linear') })
    tracks = writeObjectTrack(tracks, 'actor-lead', { op: 'upsert', keys: snapshotToChannelKeys('person', { frame: 60, position: [2.5, 0, 0] }, 60, 'linear') })

    const batchResult = writeObjectTrack(tracks, 'actor-lead', {
      op: 'batch',
      steps: [
        { op: 'remove', frames: [0, 60] },
        { op: 'upsert', keys: {
          transform: [
            { frame: 0, interpolation: 'linear', fields: { position: [0, 0, 0] } },
            { frame: 120, interpolation: 'linear', fields: { position: [5, 0, 0] } },
            { frame: 240, interpolation: 'linear', fields: { position: [10, 0, 0] } },
          ],
        } },
      ],
    })

    const frames = batchResult['actor-lead'].transform.map(key => key.frame).sort((a, b) => a - b)
    expect(frames).toEqual([0, 24, 120, 240]) // 旧路径帧 0/60 被删，新增 120/240，手动帧 24 保留
    expect(batchResult['actor-lead'].action).toHaveLength(1)
    expect(batchResult['actor-lead'].action[0].fields.pose).toBe('run') // 手动动作帧不丢
  })
})

// ---- M4-C2 / M4-C6 混合轨迁移规则 ----

describe('M4-C2/C6 混合 legacy 轨迁移', () => {
  it('路径帧只留 transform.position，手动帧完整迁入对应通道', () => {
    const migrated = migrateMixed()
    // 手动帧拆出三通道；路径帧绝不产生 action/skeleton key（M3-C5）
    expect(Object.keys(migrated).sort()).toEqual(['action', 'skeleton', 'transform'])
    expect(migrated.action).toHaveLength(1)
    expect(migrated.skeleton).toHaveLength(1)

    const transform = migrated.transform
    // ①路径帧无姿态残留：fields 只有 position（剥掉 pose/joints/rigRoot/rotation/scale）
    for (const pathFrame of [0, 60, 120, 180, 240]) {
      const key = transform.find(k => k.frame === pathFrame)
      expect(Object.keys(key.fields)).toEqual(['position'])
      expect(key.fields.position).toEqual([pathFrame * 10 / 240, 0, 0])
    }
    // ②手动帧字段完整迁入 transform 通道
    const manualTransform = transform.find(k => k.frame === 24)
    expect(Object.keys(manualTransform.fields).sort()).toEqual(['position', 'rotation', 'scale'])
    expect(manualTransform.fields.position).toEqual([100, 0, 100])
    expect(manualTransform.fields.scale).toEqual([1.2, 1, 1])
    // ②手动帧完整迁入 action/skeleton 通道（continuousMotion 是 objectState，不落通道，见 47）
    expect(migrated.action[0]).toEqual({ frame: 24, interpolation: 'smooth', fields: { pose: 'run', poseTime: 0.6 } })
    // cloneJointPose 恒返回全部登记关节（缺失补零），runJoints 注入值应在其中
    expect(migrated.skeleton[0].fields.joints).toEqual(cloneJointPose(runJoints))
  })

  it('③路径启用时 position=路径位置（忽略位置关键帧），动作/骨骼不丢', () => {
    const migrated = migrateMixed()
    // frame 30：路径 u=0.125 → x=1.25；关键帧段 24→60 插值 x≈83.75（被显示忽略）
    const at = objectAtFrame(person, migrated, 30, FPS, straightPath)
    expect(at.position[0]).toBeCloseTo(1.25, 1)
    expect(at.position[0]).not.toBeCloseTo(83.75, 1)
    // 手动动作/骨骼帧未被路径锁死或丢失
    expect(at.pose).toBe('run')
    expect(at.poseTime).toBeCloseTo(0.6, 5)
    expect(at.joints).toEqual(cloneJointPose(runJoints))
  })

  it('路径不启用时 position 回落关键帧插值', () => {
    const migrated = migrateMixed()
    const at = objectAtFrame(person, migrated, 30, FPS, null)
    // frame 30 落在 24(手动帧,smooth)→60(路径帧) 段：smoothstep 平滑插值，而非路径位置
    const t = 6 / 36
    const s = t * t * (3 - 2 * t)
    expect(at.position[0]).toBeCloseTo(100 + (2.5 - 100) * s, 1)
  })
})

// ---- M4-C3 迁移幂等 ----

describe('M4-C3 迁移幂等', () => {
  it('同一混合 legacy 轨迁移 N 次逐字段相等', () => {
    const first = normalizeObjectTracks({ 'actor-lead': legacyMixedTrack }, { 'actor-lead': 'person' }, { 'actor-lead': straightPath })
    const second = normalizeObjectTracks(first, { 'actor-lead': 'person' }, { 'actor-lead': straightPath })
    expect(second).toEqual(first)
  })
})

// ---- M4-C4 迁移后 M2 逐帧一致（旧整快照参考实现） ----

// 旧整快照求值参考实现（复刻现网 objectAtFrame，仅作对照基准，M4-C4）
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

// 递归容差比较：数值在容差内视为相等，数组逐元素比，对象按 expected 的键子集比。
function expectSameState(actual, expected) {
  for (const field of ['position', 'rotation', 'scale', 'pose', 'poseTime', 'continuousMotion', 'rigRoot', 'joints']) {
    const a = actual[field]
    const e = expected[field]
    if (Array.isArray(e) && Array.isArray(a)) {
      expect(a).toHaveLength(e.length)
      e.forEach((value, index) => {
        if (typeof value === 'number' && typeof a[index] === 'number') {
          expect(Math.abs(a[index] - value)).toBeLessThanOrEqual(1e-9)
        } else {
          expect(a[index]).toEqual(value)
        }
      })
    } else if (typeof e === 'number' && typeof a === 'number') {
      expect(Math.abs(a - e)).toBeLessThanOrEqual(1e-9)
    } else {
      expect(a).toEqual(e)
    }
  }
}

describe('M4-C4 迁移后 M2 逐帧一致（旧参考实现对照）', () => {
  it('纯手动 legacy 轨迁移后逐帧全等（无路径场景）', () => {
    const legacyKeys = [
      { frame: 0, interpolation: 'smooth', position: [-1.25, 0, 0.3], rotation: [0, 0.25, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 0.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
      { frame: 24, interpolation: 'linear', position: [0, 0, 0.3], rotation: [0, 0.5, 0], scale: [1, 1, 1], pose: 'walk', poseTime: 1.4, continuousMotion: true, rigRoot: [0, 0, 0], joints: walkJoints },
      { frame: 48, interpolation: 'smooth', position: [1.5, 0, 0.3], rotation: [0, 0.9, 0], scale: [1, 1, 1], pose: 'run', poseTime: 0.6, continuousMotion: true, rigRoot: [0, 0, 0], joints: runJoints },
    ]
    const migrated = normalizeObjectTracks({ 'actor-lead': legacyKeys }, { 'actor-lead': 'person' }, {})['actor-lead']
    for (let frame = 0; frame <= 48; frame += 4) {
      const legacy = legacyObjectAtFrame(person, legacyKeys, frame, FPS)
      const next = objectAtFrame(person, migrated, frame, FPS)
      expectSameState(next, legacy)
    }
  })
})
