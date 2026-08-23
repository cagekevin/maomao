// 直驱盖章 ↔ 导出/预览 state 采样的对齐闸。
// 盖章配方 = sceneObjectTrajectorySample（脚底）+ 注册时的 positionOffset（objectVisualHalfHeight 抬升），
// 见 useTrajectoryAnimation / TrajectoryPlayback。这里断言这套配方对同一对象/播放头
// 与 objectWithPlaybackPose / cameraWithPlaybackPosition 逐字一致——两条路径再分叉即红。
// （2026-08-04 根治：直驱曾手抄第二份采样数学且漏抬升，假人时间轴播放陷地半身；
//   objectVisualHalfHeight 曾双实现分叉，prop 分支只有一份，导出把道具错抬半高。）
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  cameraWithPlaybackPosition,
  objectWithPlaybackPose,
  sceneObjectTrajectorySample,
} from '../scene3dPlayback'
import { objectVisualHalfHeight } from '../scene3dCrowd'
import type { Scene3DCamera, Scene3DObject, Scene3DTrajectory, Scene3DTrajectoryBinding } from '../scene3dTypes'

const trajectory: Scene3DTrajectory = {
  id: 't1',
  name: '走位',
  // 轨迹点存脚底高度（y=0 贴地），带一点起伏确认 y 不是巧合对齐
  points: [
    { id: 'p1', position: [0, 0, 0] },
    { id: 'p2', position: [4, 0.4, 2] },
    { id: 'p3', position: [8, 0, -1] },
  ],
  tension: 0.5,
  closed: false,
  color: '#ff0000',
}

function bindingFor(objectId: string): Scene3DTrajectoryBinding {
  return {
    id: `b-${objectId}`,
    trajectoryId: 't1',
    objects: [{ objectId, offsetRatio: 0 }],
    startTime: 0,
    endTime: 4,
    direction: 'forward',
  }
}

const mannequin: Scene3DObject = {
  id: 'm1',
  name: '假人',
  type: 'mannequin',
  visible: true,
  position: [0, 1.25, 0],
  rotation: [0, 0, 0],
  scale: [2.5, 2.5, 2.5],
}

const prop: Scene3DObject = {
  id: 'car1',
  name: '车辆',
  type: 'prop',
  propKind: 'car',
  visible: true,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
}

const camera: Scene3DCamera = {
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
}

function stateFor(objectId: string): { trajectories: Scene3DTrajectory[]; trajectoryBindings: Scene3DTrajectoryBinding[]; objects: Scene3DObject[] } {
  return { trajectories: [trajectory], trajectoryBindings: [bindingFor(objectId)], objects: [mannequin, prop] }
}

/** 逐字复刻 useTrajectoryAnimation 的盖章配方：state 采样 + positionOffset + lookAt。 */
function stampObject(objectId: string, lift: number, playhead: number): THREE.Object3D | null {
  const sample = sceneObjectTrajectorySample(stateFor(objectId), objectId, playhead)
  if (!sample) return null
  const object3d = new THREE.Object3D()
  object3d.visible = sample.visible
  object3d.position.copy(sample.position)
  object3d.position.add(new THREE.Vector3(0, lift, 0))
  if (sample.tangent) object3d.lookAt(object3d.position.clone().add(sample.tangent))
  return object3d
}

const PLAYHEADS = [0, 0.7, 2, 3.3, 4]

// state 路的 vectorToArray/eulerToArray 落盘前四舍到 4 位小数（0.1mm 级），盖章路写全精度
// Object3D——对齐判据取 4dp 容差（低于它 = 不可见也不可累积，高于它 = 两路真分叉）。
function expectVec3Close(actual: [number, number, number], expected: [number, number, number]): void {
  expect(actual[0]).toBeCloseTo(expected[0], 4)
  expect(actual[1]).toBeCloseTo(expected[1], 4)
  expect(actual[2]).toBeCloseTo(expected[2], 4)
}

describe('直驱盖章 == 导出采样（同一对象/播放头逐字一致）', () => {
  it('假人：盖章位置（含 halfHeight 抬升）与 objectWithPlaybackPose 一致，脚不陷地', () => {
    const lift = objectVisualHalfHeight(mannequin)
    expect(lift).toBeCloseTo(1.25, 10) // 0.5 * scaleY
    for (const t of PLAYHEADS) {
      const stamped = stampObject(mannequin.id, lift, t)
      const posed = objectWithPlaybackPose(stateFor(mannequin.id), mannequin, t)
      expect(stamped).not.toBeNull()
      expectVec3Close(stamped!.position.toArray() as [number, number, number], posed.position)
      // 朝向同样对齐（两侧都是 lookAt(position + tangent)）
      expectVec3Close([stamped!.rotation.x, stamped!.rotation.y, stamped!.rotation.z], posed.rotation)
    }
  })

  it('道具（origin 在地面中心）：halfHeight=0，底面贴轨迹走，导出不再错抬半高', () => {
    const lift = objectVisualHalfHeight(prop)
    expect(lift).toBe(0)
    for (const t of PLAYHEADS) {
      const stamped = stampObject(prop.id, lift, t)
      const posed = objectWithPlaybackPose(stateFor(prop.id), prop, t)
      const sample = sceneObjectTrajectorySample(stateFor(prop.id), prop.id, t)
      expectVec3Close(stamped!.position.toArray() as [number, number, number], posed.position)
      // 贴地语义：对象 y == 轨迹脚底 y（零抬升）
      expect(posed.position[1]).toBeCloseTo(sample!.position.y, 4)
    }
  })

  it('相机：两条路径都零抬升（位置 == 原始采样）', () => {
    const state = { trajectories: [trajectory], trajectoryBindings: [bindingFor(camera.id)], objects: [] }
    for (const t of PLAYHEADS) {
      const sample = sceneObjectTrajectorySample(state, camera.id, t)
      const played = cameraWithPlaybackPosition(state, camera, t)
      expectVec3Close(played.position, sample!.position.toArray() as [number, number, number])
    }
  })
})
