import React from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as cloneSkeleton, retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { MANNEQUIN_ANIMATION_URL, LOCOMOTION_CROSSFADE_SECONDS } from './scene3dConstants'
import { applyMannequinArmDownPose, groundMannequinModel } from './scene3dMath'
import { isArmLocomotionTrackName } from './scene3dCharacterDrive'

// possess 态被操控假人的「实时迈腿」：用 three 内建 AnimationMixer 播 mannequin-animations.glb 里的
// idle/walk/run clip 驱动骨骼（in-place 原地踏步，前进位移仍由 CharacterDriveController 直驱 group.position）。
// 仅当 activeClip 有值时启用；为空时此 hook 不建 mixer、不每帧更新（静态 pose 路径完全不受影响 → 离屏/群众/不 possess 零回归）。
// 切 clip 用 crossFadeTo 平滑过渡。每帧 mixer.update 后 groundMannequinModel 保证脚踩地不飘。
function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null
  root.traverse((object) => {
    if (!found && object instanceof THREE.SkinnedMesh) found = object
  })
  return found
}

// 离屏确定性驱动句柄：stepper 在自己的 useFrame 里（render/capture 之前）imperatively 调用，
// 保证 setTime 后的骨架在同一帧被 captureScene 采到（无一帧滞后；与 applyPoseOverTime 同序）。
// setTime(t)=按该时刻定相位（walk 循环自动取模）；suspend()=该帧被静态动作打断，locomotion 让位静态 pose。
export type MannequinLocomotionDriver = {
  setTime: (clipTime: number) => void
}

export function useMannequinLocomotion(
  model: THREE.Object3D,
  activeClip: string | undefined,
  // 给了此 ref（离屏）→ 组件不在自己的 useFrame 自动推进，改由 stepper 通过 ref.current.setTime
  //   在 capture 前 imperatively 驱动（确定性，无一帧滞后）。某帧被静态动作打断时 stepper 不调 setTime，
  //   该帧由 stepper 的 applyPoseOverTime 接管骨架（静态优先）。
  // 缺省（LIVE possess）→ 组件自己的 useFrame 走 mixer.update(delta) 实时路径，行为不变。
  driverRef?: React.MutableRefObject<MannequinLocomotionDriver | null>,
): void {
  // 只在真正要动画时才订阅动画 GLB（useGLTF 内部缓存，重复调用零额外加载）。
  const animationGltf = useGLTF(MANNEQUIN_ANIMATION_URL)
  // 假人的 SkinnedMesh：retarget 的目标 + 播放 mixer 的宿主都用它（绑到 SkinnedMesh 而非外层 group，
  // 否则 PropertyBinding 报「node does not have a skeleton」刷控制台）。
  const targetSkinned = React.useMemo(() => findSkinnedMesh(model), [model])
  // 动画源(three Xbot)与我们假人「零点姿势」差~90°，clip 不能直接套（会躺平爆散，headless+R13 实证）。
  // 用 retargetClip 按两套骨架的绑定差异把每条 clip 校正到我们假人骨架的局部空间，再播；只 retarget 一次后缓存。
  // 源骨架用克隆（retarget 会临时驱动它采样，克隆免污染 useGLTF 共享场景）。失败的 clip 跳过（不假装在动）。
  const clips = React.useMemo(() => {
    const map = new Map<string, THREE.AnimationClip>()
    const sourceSkinned = findSkinnedMesh(cloneSkeleton(animationGltf.scene))
    if (!targetSkinned || !sourceSkinned) return map
    for (const clip of animationGltf.animations as THREE.AnimationClip[]) {
      try {
        const retargeted = retargetClip(targetSkinned, sourceSkinned, clip, { hip: 'mixamorigHips' })
        // #2 A-hybrid：滤掉手臂链 track（retarget 对绕肩校正差 → 手臂退回 T-pose）。
        // 只留腿/髋/脊/颈/头被驱动；手臂由 applyMannequinArmDownPose 每帧兜成「自然下垂」。
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

  // activeClip 切换时：建/取 mixer，crossFade 到目标 clip。clip 名变化频率低（仅 idle↔walk↔run 桶切），
  // 非每帧——不会引发渲染风暴。activeClip 变 undefined（退出 possess/换对象）→ 停 mixer 回静态路径。
  React.useEffect(() => {
    if (!activeClip) {
      // 不主动 reset 骨骼：Mannequin 的静态 pose useLayoutEffect 会在 activeClip 缺省时重新应用并落地。
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
        // clip 名对不上 / retarget 失败：诚实退出，回静态路径，别假装在动。
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
    // 离屏：mixer+action 就绪后发布驱动句柄，供 stepper 在 capture 前 imperatively 定相位。
    if (driverRef) {
      driverRef.current = {
        setTime: (clipTime: number) => {
          const m = mixerRef.current
          if (m) m.setTime(clipTime)
        },
      }
    }
  }, [activeClip, clips, targetSkinned, driverRef])

  // 卸载（换对象/退出 possess 销毁组件）时停掉所有 action，释放 mixer。
  React.useEffect(() => () => {
    const mixer = mixerRef.current
    if (mixer) mixer.stopAllAction()
    mixerRef.current = null
    actionsRef.current.clear()
    currentActionRef.current = null
    if (driverRef) driverRef.current = null
  }, [driverRef])

  useFrame((_, delta) => {
    // 离屏（driverRef 在场）：不在此自动推进——由 stepper 在 capture 前调 driver.setTime + 自己落地，
    // 保证「定相位 → 落地 → 采帧」同序无滞后。此处只负责 LIVE 实时路径。
    if (driverRef) return
    const mixer = mixerRef.current
    if (!activeClip || !mixer || !currentActionRef.current) return
    // LIVE 实时：用帧间 delta 推进动画（possess 走路，行为完全不变）。
    mixer.update(delta)
    // #2 A-hybrid：clip 已滤掉手臂链 → 手臂没人驱动，每帧补上「自然下垂」静态姿势（不再 T-pose）。
    applyMannequinArmDownPose(model)
    // clip 让脚上下起伏，每帧按蒙皮最低点重新落地，保证脚踩地不飘（基准沿用现有 groundMannequinModel 逻辑）。
    groundMannequinModel(model as THREE.Group)
  })
}
