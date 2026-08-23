// 绑了轨迹的对象被用户直接拖拽时的仲裁（2026-08-03 群反馈「预设后拖相机不跟手」根治的宿主侧）：
// ① 播放中抓住对象 → 先暂停（手比播放头大；拖拽期间直驱层对手上对象停止盖章，播放头继续跑
//    会让松手对齐对到一个还在变的时间点）。
// ② 「松手即对齐」→ 把该对象绑定的轨迹整条刚体平移，使 sample@播放头 == 松手位置——直驱层
//    恢复盖章时球停在手放开的地方，不回跳；未绑定时纯函数返回原引用，setState bail-out 零回归。
// 视图侧的另一半（held-set 挂靠/window 级拖拽监听）在 scene3dSceneView.tsx / trajectoryRuntimeStore.ts。
import React from 'react'
import { translateBoundTrajectoryToHeldPosition } from './scene3dTrajectoryState'
import { objectVisualHalfHeight } from './scene3dCrowd'
import type { Scene3DState } from './scene3dTypes'

export function useScene3DBoundDrag({
  isPlaying,
  setIsPlaying,
  playheadRef,
  unlockViewForSceneEdit,
  setState,
}: {
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  playheadRef: React.MutableRefObject<number>
  unlockViewForSceneEdit: () => void
  setState: React.Dispatch<React.SetStateAction<Scene3DState>>
}): {
  beginSceneTransformInteraction: () => void
  handleBoundDragEnd: (id: string) => void
} {
  const beginSceneTransformInteraction = React.useCallback(() => {
    if (isPlaying) setIsPlaying(false)
    unlockViewForSceneEdit()
  }, [isPlaying, setIsPlaying, unlockViewForSceneEdit])

  const handleBoundDragEnd = React.useCallback((id: string) => {
    const playheadSeconds = playheadRef.current
    setState((current) => {
      const camera = current.cameras.find((candidate) => candidate.id === id)
      if (camera) return translateBoundTrajectoryToHeldPosition(current, id, playheadSeconds, camera.position)
      const object = current.objects.find((candidate) => candidate.id === id)
      if (!object) return current
      // 对象轨迹存脚底高度（objectWithPlaybackPose 采样后再加半身高），对齐时把中心位换算回脚底。
      return translateBoundTrajectoryToHeldPosition(current, id, playheadSeconds, [
        object.position[0],
        object.position[1] - objectVisualHalfHeight(object),
        object.position[2],
      ])
    })
  }, [playheadRef, setState])

  return { beginSceneTransformInteraction, handleBoundDragEnd }
}
