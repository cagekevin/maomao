// ============================================================
// 3D 导演台 · 动画引擎 · 假人骨骼动画（locomotion）
// 抽自 Nomi scene3dMannequinLocomotion.ts（完整，剥离宿主依赖）
// 用 three AnimationMixer 播 mannequin-animations.glb 的 idle/walk/run clip。
// 需要 MANNEQUIN_ANIMATION_URL 指向你的 glb 资源。
// ============================================================
import React from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as cloneSkeleton, retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import {
  LOCOMOTION_CROSSFADE_SECONDS,
  MANNEQUIN_ANIMATION_URL,
} from './constants'
import { applyMannequinArmDownPose, groundMannequinModel } from './math'

// 手臂链 track 名（retarget 对绕肩校正差 → 手臂退回 T-pose，故滤掉，由 armDown pose 兜底）。
function isArmLocomotionTrackName(trackName: string): boolean {
  return /(Shoulder|Arm|ForeArm|Hand)/.test(trackName)
}

function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null
  root.traverse((object) => {
    if (!found && object instanceof THREE.SkinnedMesh) found = object
  })
  return found
}

// 离屏确定性驱动句柄：stepper 在自己的 useFrame 里 imperative 调用。
export type MannequinLocomotionDriver = {
  setTime: (clipTime: number) => void
}

export function useMannequinLocomotion(
  model: THREE.Object3D,
  activeClip: string | undefined,
  driverRef?: React.MutableRefObject<MannequinLocomotionDriver | null>,
): void {
  const animationGltf = useGLTF(MANNEQUIN_ANIMATION_URL)
  const targetSkinned = React.useMemo(() => findSkinnedMesh(model), [model])
  // retarget 按两套骨架差异校正到我们假人骨架；只 retarget 一次后缓存。失败 clip 跳过。
  const clips = React.useMemo(() => {
    const map = new Map<string, THREE.AnimationClip>()
    const sourceSkinned = findSkinnedMesh(cloneSkeleton(animationGltf.scene))
    if (!targetSkinned || !sourceSkinned) return map
    for (const clip of animationGltf.animations as THREE.AnimationClip[]) {
      try {
        const retargeted = retargetClip(targetSkinned, sourceSkinned, clip, { hip: 'mixamorigHips' })
        const filtered = new THREE.AnimationClip(
          retargeted.name,
          retargeted.duration,
          retargeted.tracks.filter((track) => !isArmLocomotionTrackName(track.name)),
          retargeted.blendMode,
        )
        map.set(clip.name, filtered)
      } catch (error) {
        console.warn(`Mannequin clip retarget failed: ${clip.name}`, error)
      }
    }
    return map
  }, [animationGltf, targetSkinned])
  const mixerRef = React.useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = React.useRef<THREE.AnimationAction | null>(null)
  const actionsRef = React.useRef<Map<string, THREE.AnimationAction>>(new Map())

  React.useEffect(() => {
    if (!activeClip) {
      currentActionRef.current = null
      return
    }
    let mixer = mixerRef.current
    if (!mixer) {
      mixer = new THREE.AnimationMixer(targetSkinned ?? model)
      mixerRef.current = mixer
    }
    const actions = actionsRef.current
    let nextAction = actions.get(activeClip)
    if (!nextAction) {
      const clip = clips.get(activeClip)
      if (!clip) {
        console.warn(`Mannequin locomotion clip unavailable: ${activeClip}`)
        return
      }
      nextAction = mixer.clipAction(clip)
      nextAction.setLoop(THREE.LoopRepeat, Infinity)
      actions.set(activeClip, nextAction)
    }
    const prevAction = currentActionRef.current
    if (prevAction === nextAction) return
    nextAction.enabled = true
    nextAction.setEffectiveWeight(1)
    nextAction.play()
    if (prevAction) {
      nextAction.reset().play()
      prevAction.crossFadeTo(nextAction, LOCOMOTION_CROSSFADE_SECONDS, false)
    }
    currentActionRef.current = nextAction
    if (driverRef) {
      driverRef.current = {
        setTime: (clipTime: number) => {
          const m = mixerRef.current
          if (m) m.setTime(clipTime)
        },
      }
    }
  }, [activeClip, clips, targetSkinned, driverRef])

  React.useEffect(() => () => {
    const mixer = mixerRef.current
    if (mixer) mixer.stopAllAction()
    mixerRef.current = null
    actionsRef.current.clear()
    currentActionRef.current = null
    if (driverRef) driverRef.current = null
  }, [driverRef])

  useFrame((_, delta) => {
    // 离屏（driverRef 在场）：不在此自动推进，由 stepper 定相位。
    if (driverRef) return
    const mixer = mixerRef.current
    if (!activeClip || !mixer || !currentActionRef.current) return
    mixer.update(delta)
    applyMannequinArmDownPose(model)
    groundMannequinModel(model as THREE.Group)
  })
}
