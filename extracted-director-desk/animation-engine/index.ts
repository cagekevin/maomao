// ============================================================
// 3D 导演台 · 动画引擎 · 入口
// 自包含：只依赖 three / @react-three/fiber / @react-three/drei / zustand
// 用法：
//   import { useTrajectoryAnimation, useMannequinLocomotion,
//            cameraWithPlaybackPosition, objectWithPlaybackPose } from './animation-engine'
// ============================================================

// ── 类型 ──
export * from './types'

// ── 常量 / id ──
export * from './constants'
export * from './bindingIds'

// ── 纯函数：轨迹曲线 / 采样 ──
export * from './trajectory'
export * from './playback'
export * from './poseTrack'
export * from './math'
export * from './propSpecs'

// ── 运行时 store ──
export * from './runtimeStore'

// ── r3f hooks ──
export { useTrajectoryAnimation } from './useTrajectoryAnimation'
export { useScene3DObjectRefRegistration } from './useScene3DObjectRefRegistration'
export { useMannequinLocomotion } from './mannequinLocomotion'
export type { MannequinLocomotionDriver } from './mannequinLocomotion'
