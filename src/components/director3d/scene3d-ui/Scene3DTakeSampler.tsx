import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { findSceneObjectByRuntimeId } from './scene3dMath'
import type { Scene3DVector3 } from './scene3dTypes'

// 录 take 的 Canvas 内采样器（S2）。录制期间每帧读：
//  - 被操控角色 group 的世界位置（CharacterDriveController 直驱的就是这个 group）；
//  - 编辑器相机的世界位置（用户录制时绕看 = 机位路径）。
// 推进 useScene3DTakeRecorder 的 buffer（内部按 50ms 节流）。空帧/未录时零开销。
// 直驱 group 位置不走 React state（节流提交），所以这里直接读 three 世界矩阵才拿得到「正在走」的实时位置。
// 录运镜（相机操控 take）额外用：相机注视点 = 相机世界位置 + 前向 × 此距离。
// 与 CameraViewEditController 的 targetDistance 同量级，够稳定地还原朝向（aim 点本身只用作 lookAt 方向）。
const AIM_DISTANCE = 3

export function Scene3DTakeSampler({
  isRecording,
  possessedObjectId,
  possessingCamera,
  onSampleCharacter,
  onSampleCamera,
  onSampleCameraAim,
}: {
  isRecording: boolean
  // 被操控角色 id（角色 take 才采其世界位置）。相机 take 时为 null。
  possessedObjectId: string | null
  // 是否在操控相机（相机 take 才采注视点）。
  possessingCamera: boolean
  onSampleCharacter: (position: Scene3DVector3) => void
  onSampleCamera: (position: Scene3DVector3) => void
  onSampleCameraAim: (target: Scene3DVector3) => void
}): null {
  const { camera, scene, invalidate } = useThree()
  const worldRef = React.useRef(new THREE.Vector3())
  const dirRef = React.useRef(new THREE.Vector3())

  // 录制时强制每帧渲染（demand 模式下静止不重绘 → 采样会停；invalidate 让循环转起来）。
  React.useEffect(() => {
    if (isRecording) invalidate()
  }, [isRecording, invalidate])

  useFrame(() => {
    if (!isRecording) return
    if (possessedObjectId) {
      const group = findSceneObjectByRuntimeId(scene, possessedObjectId)
      if (group) {
        group.getWorldPosition(worldRef.current)
        onSampleCharacter([worldRef.current.x, worldRef.current.y, worldRef.current.z])
      }
    }
    // 机位永远采（角色 take 时是绕拍机位；相机 take 时是运镜本身）。
    onSampleCamera([camera.position.x, camera.position.y, camera.position.z])
    // 相机 take：额外采注视点（相机前向投影），还原 free-look 转头。
    if (possessingCamera) {
      camera.getWorldDirection(dirRef.current)
      const aim = worldRef.current.copy(camera.position).addScaledVector(dirRef.current, AIM_DISTANCE)
      onSampleCameraAim([aim.x, aim.y, aim.z])
    }
    invalidate() // 维持录制期间的连续帧
  })

  return null
}
