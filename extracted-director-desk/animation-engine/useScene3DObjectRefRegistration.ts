// ============================================================
// 3D 导演台 · 动画引擎 · 对象 ref 注册 hook
// 抽自 Nomi trajectory/useScene3DObjectRefRegistration.ts（完整）
// ============================================================
import React from 'react'
import * as THREE from 'three'
import { registerScene3DObjectRef, unregisterScene3DObjectRef } from './runtimeStore'

/**
 * 场景对象组件把**自己长命的 group ref** 登进轨迹直驱表：挂载即注册、卸载即注销。
 * 注册的是 ref 对象本身（不是冻结快照），`.current` 恒指当前活着的 Object3D。
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
