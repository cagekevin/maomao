import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { Scene3DTrajectory, Scene3DTrajectoryBinding } from '../scene3dTypes'
import { sceneObjectTrajectorySample } from '../scene3dPlayback'
import {
  isScene3DObjectRuntimeHeld,
  setScene3DPlayheadSeconds,
  useScene3DTrajectoryRuntimeStore,
} from './trajectoryRuntimeStore'

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

    // 盖章 = 与导出/成片预览完全同一条 state 采样（sceneObjectTrajectorySample，脚底高度）
    // + 注册时声明的视觉抬升 positionOffset（轨迹存脚底、对象 position 语义是视觉中心，
    // 与 objectWithPlaybackPose 的 +objectVisualHalfHeight 同源）。此前这里手抄了第二份
    // 采样数学且没抬升，时间轴直驱比导出低半身（假人陷地）——共享采样后结构上无法再漂移。
    // 同一对象绑多条轨迹时与导出一致取第一条命中（老直驱是最后一条赢，属漂移的一部分）。
    const drivenObjectIds = new Set<string>()
    activeBindings.forEach((binding) => {
      binding.objects.forEach((boundObject) => drivenObjectIds.add(boundObject.objectId))
    })
    drivenObjectIds.forEach((objectId) => {
      // 用户拖拽优先：手上的对象直驱层不碰；松手后宿主把轨迹平移到新位置。
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
