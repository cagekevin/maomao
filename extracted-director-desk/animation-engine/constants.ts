// ============================================================
// 3D 导演台 · 动画引擎 · 常量（抽自 Nomi scene3dConstants.ts）
// 只保留动画/K帧体系需要的部分。
// ============================================================
import * as THREE from 'three'
import type { Scene3DVector3 } from './types'

export const CAMERA_DEFAULT_TARGET: Scene3DVector3 = [0, 0.75, 0]
export const UNGROUPED_TRAJECTORY_GROUP_ID = '__ungrouped_trajectories__'

export const MANNEQUIN_DEFAULT_SCALE: Scene3DVector3 = [2.5, 2.5, 2.5]
export const MANNEQUIN_LABEL_BASE_HEIGHT = 0.58
export const MANNEQUIN_REST_ROTATION_KEY = 'scene3dRestRotation'
// 假人 locomotion 动画 clip（idle/walk/run 等）来源。
// ⚠️ 接入时必须改成你自己的资源路径，例如：
//   export const MANNEQUIN_ANIMATION_URL = new URL('../assets/mannequin-animations.glb', import.meta.url).href
// 空字符串会导致 useGLTF 报错——这是你接画布时第一个要填的配置点。
export const MANNEQUIN_ANIMATION_URL = ''

// possess 态自动 locomotion clip 名（须与 mannequin-animations.glb 内 clip 名逐字一致）。
export type Scene3DLocomotionClip = 'idle' | 'walk' | 'run'
export const LOCOMOTION_CLIP_IDLE: Scene3DLocomotionClip = 'idle'
export const LOCOMOTION_CLIP_WALK: Scene3DLocomotionClip = 'walk'
export const LOCOMOTION_CLIP_RUN: Scene3DLocomotionClip = 'run'
export const LOCOMOTION_WALK_SPEED_THRESHOLD = 0.05
export const LOCOMOTION_RUN_SPEED_THRESHOLD = 3.2
export const LOCOMOTION_CROSSFADE_SECONDS = 0.22

// 假人默认姿势（站立基准，骨骼 offset 弧度）
export const MANNEQUIN_DEFAULT_POSE: Record<string, Scene3DVector3> = {
  mixamorigSpine: [degreesToRadians(2), 0, 0],
  mixamorigNeck: [degreesToRadians(-8), 0, 0],
  mixamorigHead: [degreesToRadians(-10), 0, 0],
  mixamorigLeftArm: [degreesToRadians(67.5), degreesToRadians(11.4), degreesToRadians(-6.8)],
  mixamorigRightArm: [degreesToRadians(67.5), degreesToRadians(-11.4), degreesToRadians(6.8)],
  mixamorigLeftForeArm: [degreesToRadians(8), degreesToRadians(-4), 0],
  mixamorigRightForeArm: [degreesToRadians(8), degreesToRadians(4), 0],
  mixamorigLeftHand: [degreesToRadians(6), 0, degreesToRadians(-8)],
  mixamorigRightHand: [degreesToRadians(6), 0, degreesToRadians(8)],
}

export function degreesToRadians(value: number): number {
  return Number(THREE.MathUtils.degToRad(value).toFixed(4))
}

export function radiansToDegrees(value: number): number {
  return Number(THREE.MathUtils.radToDeg(value).toFixed(1))
}
