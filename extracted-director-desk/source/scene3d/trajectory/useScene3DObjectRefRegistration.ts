import React from 'react'
import * as THREE from 'three'
import { registerScene3DObjectRef, unregisterScene3DObjectRef } from './trajectoryRuntimeStore'

/**
 * marker 组件（SceneObjectView / CameraHelperView）把**自己长命的 group ref** 登进
 * 轨迹直驱表：挂载即注册、卸载即注销。注册的是 ref 对象本身（不是解引用后的冻结快照），
 * 所以 `.current` 恒指当前活着的 Object3D。
 *
 * 为什么必须由 marker 自己注册（而不是播放层按 id 扫 scene 查一次）：marker 会被整组
 * 卸载重挂——取景调整（cameraViewEditing）隐藏全部相机 marker、undo/redo、任何条件渲染。
 * 旁路扫描拿到的对象在重挂载后就是已离场的尸体，每帧盖章全部落空（2026-08-04 取景往返
 * 后 marker 冻住的根因）。注册的生命周期 = Object3D 的生命周期，僵尸在结构上不可能。
 */
export function useScene3DObjectRefRegistration(
  runtimeId: string,
  ref: React.RefObject<THREE.Object3D>,
  options: { enabled?: boolean; positionOffsetY?: number; followTangent?: boolean } = {},
): void {
  const enabled = options.enabled ?? true
  const positionOffsetY = options.positionOffsetY ?? 0
  const followTangent = options.followTangent
  React.useEffect(() => {
    if (!enabled) return undefined
    registerScene3DObjectRef(runtimeId, ref, {
      ...(positionOffsetY ? { positionOffset: new THREE.Vector3(0, positionOffsetY, 0) } : {}),
      followTangent,
    })
    return () => unregisterScene3DObjectRef(runtimeId, ref)
  }, [enabled, followTangent, positionOffsetY, ref, runtimeId])
}
