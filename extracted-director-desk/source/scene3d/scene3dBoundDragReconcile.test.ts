// 「松手即对齐」（2026-08-03 群反馈根治的结构闸）：拖完绑了轨迹的对象/相机，其轨迹整条
// 刚体平移到 sample@播放头 == 松手位置——直驱层恢复盖章时不回跳、state 与画面单一真相。
// 场景按真实复现构造：默认场景 + 相机 + applyCameraMovePreset('push_in')（即「推近」预设）。
import { describe, it, expect } from 'vitest'
import { translateBoundTrajectoryToHeldPosition } from './scene3dTrajectoryState'
import { sceneObjectTrajectorySample } from './scene3dPlayback'
import { applyCameraMovePreset } from './cameraMovePreset'
import { createDefaultScene3DState } from './scene3dSerializer'
import type { Scene3DCamera, Scene3DState, Scene3DVector3 } from './scene3dTypes'

function camera(extra: Partial<Scene3DCamera> = {}): Scene3DCamera {
  return {
    id: 'cam1',
    name: '相机1',
    visible: true,
    position: [2, 1.45, 4],
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

function stateWithPushInPreset(): Scene3DState {
  const base: Scene3DState = { ...createDefaultScene3DState(), cameras: [camera()] }
  const result = applyCameraMovePreset(base, 'cam1', { move: 'push_in', duration: 5, amplitude: 0.6 })
  if (!result) throw new Error('preset must apply')
  return result.state
}

describe('translateBoundTrajectoryToHeldPosition · 松手即对齐', () => {
  it('推近预设 + 拖走相机：轨迹平移到 sample@播放头 == 松手位置（不回跳）', () => {
    const bound = stateWithPushInPreset()
    const dropPosition: Scene3DVector3 = [5.086, 3.871, 4.41]
    const reconciled = translateBoundTrajectoryToHeldPosition(bound, 'cam1', 0, dropPosition)

    const sample = sceneObjectTrajectorySample(reconciled, 'cam1', 0)
    expect(sample).not.toBeNull()
    expect(sample!.position.x).toBeCloseTo(dropPosition[0], 3)
    expect(sample!.position.y).toBeCloseTo(dropPosition[1], 3)
    expect(sample!.position.z).toBeCloseTo(dropPosition[2], 3)
  })

  it('刚体平移：所有点同 delta 移动，路径形状（点间相对向量）不变', () => {
    const bound = stateWithPushInPreset()
    const before = bound.trajectories[0]
    const reconciled = translateBoundTrajectoryToHeldPosition(bound, 'cam1', 0, [12, 9, -3])
    const after = reconciled.trajectories[0]

    expect(after.points).toHaveLength(before.points.length)
    const shapeOf = (points: typeof before.points) => points.slice(1).map((point, index) => ([
      point.position[0] - points[index].position[0],
      point.position[1] - points[index].position[1],
      point.position[2] - points[index].position[2],
    ]))
    shapeOf(after.points).forEach((segment, index) => {
      segment.forEach((component, axis) => {
        expect(component).toBeCloseTo(shapeOf(before.points)[index][axis], 6)
      })
    })
  })

  it('curveControls 同步平移（漏了会把曲线拽变形）', () => {
    const bound = stateWithPushInPreset()
    const withControl: Scene3DState = {
      ...bound,
      trajectories: bound.trajectories.map((trajectory) => ({
        ...trajectory,
        curveControls: [{ segmentStartPointId: trajectory.points[0].id, position: [1, 2, 3] as Scene3DVector3 }],
      })),
    }
    const start = withControl.trajectories[0].points[0].position
    const reconciled = translateBoundTrajectoryToHeldPosition(withControl, 'cam1', 0, [
      start[0] + 4,
      start[1],
      start[2] - 2,
    ])
    expect(reconciled.trajectories[0].curveControls?.[0].position).toEqual([5, 2, 1])
  })

  it('未绑定 / 位移≈0 → 返回原引用（setState bail-out，普通拖拽零回归）', () => {
    const unbound: Scene3DState = { ...createDefaultScene3DState(), cameras: [camera()] }
    expect(translateBoundTrajectoryToHeldPosition(unbound, 'cam1', 0, [9, 9, 9])).toBe(unbound)

    const bound = stateWithPushInPreset()
    const startPoint = bound.trajectories[0].points[0].position
    // 松手位置就是轨迹起点（如 aim 拖拽只动 target、位置没动）→ 恒等
    expect(translateBoundTrajectoryToHeldPosition(bound, 'cam1', 0, [...startPoint])).toBe(bound)
  })

  it('播放头停在轨迹中段：对齐的是 sample@播放头，不是轨迹起点', () => {
    const bound = stateWithPushInPreset()
    const midSeconds = 2.5 // duration 5s → 路径中点
    const drop: Scene3DVector3 = [-4, 2, 7]
    const reconciled = translateBoundTrajectoryToHeldPosition(bound, 'cam1', midSeconds, drop)
    const sample = sceneObjectTrajectorySample(reconciled, 'cam1', midSeconds)
    expect(sample!.position.x).toBeCloseTo(drop[0], 3)
    expect(sample!.position.y).toBeCloseTo(drop[1], 3)
    expect(sample!.position.z).toBeCloseTo(drop[2], 3)
  })
})
