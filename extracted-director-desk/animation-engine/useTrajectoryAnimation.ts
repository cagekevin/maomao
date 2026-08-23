// ============================================================
// 3D 导演台 · 动画引擎 · 轨迹动画驱动 hook（r3f）
// 抽自 Nomi trajectory/useTrajectoryAnimation.ts（完整，剥离宿主依赖）
// 在 r3f 的 <Canvas> 内使用：播放头推进 + 采样 → 直驱注册对象的 position/朝向。
// ============================================================
import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { Scene3DTrajectory, Scene3DTrajectoryBinding } from './types'
import { sceneObjectTrajectorySample } from './playback'
import {
  isScene3DObjectRuntimeHeld,
  setScene3DPlayheadSeconds,
  useScene3DTrajectoryRuntimeStore,
} from './runtimeStore'

type UseTrajectoryAnimationOptions = {
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  playheadRef?: React.MutableRefObject<number>
  activeTrajectoryIds?: ReadonlySet<string> | null
}

function bindingTrajectory(
  binding: Scene3DTrajectoryBinding,
  trajectories: Scene3DTrajectory[],
): Scene3DTrajectory | undefined {
  return trajectories.find((trajectory) => trajectory.id === binding.trajectoryId)
}

export function useTrajectoryAnimation({
  isPlaying,
  setIsPlaying,
  playheadRef: externalPlayheadRef,
  activeTrajectoryIds,
}: UseTrajectoryAnimationOptions): React.MutableRefObject<number> {
  const internalPlayheadRef = React.useRef(useScene3DTrajectoryRuntimeStore.getState().playheadSeconds ?? 0)
  const playheadRef = externalPlayheadRef ?? internalPlayheadRef
  const isPlayingRef = React.useRef(isPlaying)
  const activeTrajectoryIdsRef = React.useRef<ReadonlySet<string> | null>(activeTrajectoryIds ?? null)
  const frameCounterRef = React.useRef(0)
  const lastPublishedPlayheadRef = React.useRef(playheadRef.current)

  React.useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  React.useEffect(() => {
    activeTrajectoryIdsRef.current = activeTrajectoryIds ?? null
  }, [activeTrajectoryIds])

  useFrame((_, delta) => {
    const runtime = useScene3DTrajectoryRuntimeStore.getState()
    const { trajectories, trajectoryBindings, objectRefMap, sceneTimeline } = runtime
    const selectedTrajectoryIds = activeTrajectoryIdsRef.current
    const activeBindings = selectedTrajectoryIds
      ? trajectoryBindings.filter((binding) => selectedTrajectoryIds.has(binding.trajectoryId))
      : trajectoryBindings

    if (isPlayingRef.current) {
      playheadRef.current += delta
    }

    const playheadSeconds = playheadRef.current

    const drivenObjectIds = new Set<string>()
    activeBindings.forEach((binding) => {
      binding.objects.forEach((boundObject) => drivenObjectIds.add(boundObject.objectId))
    })
    drivenObjectIds.forEach((objectId) => {
      // 用户拖拽优先：手上的对象直驱层不碰。
      if (isScene3DObjectRuntimeHeld(objectId)) return
      const targets = objectRefMap.get(objectId)
      if (!targets || targets.length === 0) return
      const sample = sceneObjectTrajectorySample(runtime, objectId, playheadSeconds, selectedTrajectoryIds)
      if (!sample) return
      targets.forEach((target) => {
        const object = target.ref.current
        if (!object) return
        object.visible = sample.visible
        object.position.copy(sample.position)
        if (target.positionOffset) object.position.add(target.positionOffset)
        if (target.followTangent !== false && sample.tangent) {
          object.lookAt(object.position.clone().add(sample.tangent))
        }
      })
    })

    if (isPlayingRef.current && activeBindings.length > 0) {
      const openEndTimes: number[] = []
      activeBindings.forEach((binding) => {
        const trajectory = bindingTrajectory(binding, trajectories)
        if (trajectory && !trajectory.closed) openEndTimes.push(binding.endTime)
      })
      const stopAt = openEndTimes.length > 0
        ? Math.max(...openEndTimes)
        : sceneTimeline.totalDuration
      if (playheadRef.current >= stopAt) {
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }

    if (!isPlayingRef.current) return

    frameCounterRef.current += 1
    if (
      frameCounterRef.current % 2 === 0 &&
      Math.abs(lastPublishedPlayheadRef.current - playheadRef.current) >= 0.0005
    ) {
      lastPublishedPlayheadRef.current = playheadRef.current
      setScene3DPlayheadSeconds(playheadRef.current)
    }
  })

  return playheadRef
}
