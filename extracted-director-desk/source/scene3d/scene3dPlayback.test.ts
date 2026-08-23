import { describe, it, expect } from 'vitest'
import { bindingFovAtPlayhead, cameraWithPlaybackPosition, objectWithPlaybackPose } from './scene3dPlayback'
import type { Scene3DCamera, Scene3DObject, Scene3DTrajectoryBinding, Scene3DVector3 } from './scene3dTypes'

const squat: Record<string, Scene3DVector3> = { mixamorigSpine: [10, 0, 0] }
const wave: Record<string, Scene3DVector3> = { mixamorigRightArm: [-40, 0, 0] }

const noTrajectory = { trajectories: [], trajectoryBindings: [] }

function mannequin(extra: Partial<Scene3DObject>): Scene3DObject {
  return {
    id: 'm1',
    name: '假人',
    type: 'mannequin',
    visible: true,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...extra,
  }
}

describe('objectWithPlaybackPose · pose-over-time', () => {
  it('无 poseTrack → pose 原样（老行为，未触轨迹则对象身份不变）', () => {
    const object = mannequin({ pose: squat })
    expect(objectWithPlaybackPose(noTrajectory, object, 3)).toBe(object)
  })

  it('有 poseTrack：随 t step-hold 切换 pose（即便无轨迹绑定，原地切动作也变）', () => {
    const object = mannequin({
      pose: undefined,
      poseTrack: [
        { time: 0, presetId: 'walk', pose: undefined },
        { time: 2, presetId: 'squat', pose: squat },
        { time: 4, presetId: 'wave', pose: wave },
      ],
    })
    expect(objectWithPlaybackPose(noTrajectory, object, 1).pose).toBeUndefined()
    expect(objectWithPlaybackPose(noTrajectory, object, 2).pose).toEqual(squat)
    expect(objectWithPlaybackPose(noTrajectory, object, 3.9).pose).toEqual(squat)
    expect(objectWithPlaybackPose(noTrajectory, object, 99).pose).toEqual(wave)
  })

  it('t 早于首关键帧 → 落回静态基准 object.pose', () => {
    const object = mannequin({
      pose: wave,
      poseTrack: [{ time: 5, presetId: 'squat', pose: squat }],
    })
    expect(objectWithPlaybackPose(noTrajectory, object, 1).pose).toEqual(wave)
    expect(objectWithPlaybackPose(noTrajectory, object, 5).pose).toEqual(squat)
  })

  it('空 poseTrack 数组 → 等同无轨道', () => {
    const object = mannequin({ pose: squat, poseTrack: [] })
    expect(objectWithPlaybackPose(noTrajectory, object, 3)).toBe(object)
  })
})

function binding(extra: Partial<Scene3DTrajectoryBinding>): Scene3DTrajectoryBinding {
  return {
    id: 'b1',
    trajectoryId: 't1',
    objects: [{ objectId: 'cam1', offsetRatio: 0 }],
    startTime: 2,
    endTime: 6,
    direction: 'forward',
    ...extra,
  }
}

function camera(extra: Partial<Scene3DCamera> = {}): Scene3DCamera {
  return {
    id: 'cam1',
    name: '相机1',
    visible: true,
    position: [0, 1.45, 5],
    rotation: [0, 0, 0],
    target: [0, 1.35, 0],
    fov: 40,
    aspectRatio: '16:9',
    lensDepth: 0,
    near: 0.1,
    far: 200,
    ...extra,
  }
}

describe('bindingFovAtPlayhead · FOV 渐变', () => {
  it('两端点都缺省 → null（老行为，不碰 fov）', () => {
    expect(bindingFovAtPlayhead(binding({}), 40, 4)).toBeNull()
  })

  it('按段时间进度线性插值，段外 clamp 到端点', () => {
    const ramp = binding({ fovFrom: 20, fovTo: 60 })
    expect(bindingFovAtPlayhead(ramp, 40, 2)).toBe(20)
    expect(bindingFovAtPlayhead(ramp, 40, 4)).toBe(40)
    expect(bindingFovAtPlayhead(ramp, 40, 6)).toBe(60)
    expect(bindingFovAtPlayhead(ramp, 40, 0)).toBe(20)
    expect(bindingFovAtPlayhead(ramp, 40, 99)).toBe(60)
  })

  it('单端点缺省 → 用相机静态 fov 补位', () => {
    expect(bindingFovAtPlayhead(binding({ fovTo: 80 }), 40, 6)).toBe(80)
    expect(bindingFovAtPlayhead(binding({ fovTo: 80 }), 40, 2)).toBe(40)
  })
})

describe('cameraWithPlaybackPosition · 手持抖动', () => {
  const noTraj = { objects: [], trajectories: [], trajectoryBindings: [] }

  it('关（缺省/0）= 恒等：位姿与静态相机逐位相同', () => {
    const plain = cameraWithPlaybackPosition(noTraj, camera(), 3.7)
    expect(plain.position).toEqual([0, 1.45, 5])
    expect(plain.target).toEqual([0, 1.35, 0])
  })

  it('开抖动：位姿偏移非零、同 t 确定性重现（离屏采帧与预览必须一致）', () => {
    const shaky = camera({ shakeAmplitude: 60 })
    const first = cameraWithPlaybackPosition(noTraj, shaky, 3.7)
    const second = cameraWithPlaybackPosition(noTraj, shaky, 3.7)
    expect(first.position).toEqual(second.position)
    expect(first.target).toEqual(second.target)
    expect(first.position).not.toEqual([0, 1.45, 5])
    const later = cameraWithPlaybackPosition(noTraj, shaky, 4.1)
    expect(later.position).not.toEqual(first.position)
  })

  it('幅度越大偏移越大，且始终有界（100% ≤ 3.5cm 平移量级）', () => {
    const offset = (amplitude: number, t: number) => {
      const moved = cameraWithPlaybackPosition(noTraj, camera({ shakeAmplitude: amplitude }), t)
      return Math.hypot(moved.position[0] - 0, moved.position[1] - 1.45, moved.position[2] - 5)
    }
    // 取多个采样点比较平均量级（单点可能撞噪声过零点）。
    const times = [0.3, 1.1, 2.6, 3.9, 5.2]
    const meanSmall = times.reduce((sum, t) => sum + offset(20, t), 0) / times.length
    const meanLarge = times.reduce((sum, t) => sum + offset(100, t), 0) / times.length
    expect(meanLarge).toBeGreaterThan(meanSmall)
    times.forEach((t) => expect(offset(100, t)).toBeLessThanOrEqual(0.05))
  })
})

describe('cameraWithPlaybackPosition · 播放中 fov', () => {
  const trajectory = {
    id: 't1',
    name: '推近',
    points: [
      { id: 'p1', position: [0, 1.45, 8] as Scene3DVector3 },
      { id: 'p2', position: [0, 1.45, 4] as Scene3DVector3 },
    ],
    tension: 0.5,
    closed: false,
    color: '#888888',
  }

  it('binding 带 fov 渐变 → 播放相机 fov 跟播放头走；无渐变 → 保持静态 fov', () => {
    const state = { objects: [], trajectories: [trajectory], trajectoryBindings: [binding({ fovFrom: 20, fovTo: 60 })] }
    expect(cameraWithPlaybackPosition(state, camera(), 4).fov).toBe(40)
    expect(cameraWithPlaybackPosition(state, camera(), 6).fov).toBe(60)
    const plain = { objects: [], trajectories: [trajectory], trajectoryBindings: [binding({})] }
    expect(cameraWithPlaybackPosition(plain, camera(), 4).fov).toBe(40)
  })
})
