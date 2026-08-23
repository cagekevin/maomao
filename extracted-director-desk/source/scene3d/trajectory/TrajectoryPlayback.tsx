import React from 'react'
import { useThree } from '@react-three/fiber'
import type { Scene3DTrajectoryBinding } from '../scene3dTypes'
import { useTrajectoryAnimation } from './useTrajectoryAnimation'
import {
  setScene3DObjectRuntimeRefsVisible,
  useScene3DTrajectoryRuntimeStore,
} from './trajectoryRuntimeStore'

/**
 * Playback driver. The object-ref registry itself is owned by the marker
 * components (SceneObjectView / CameraHelperView self-register their live group
 * refs via useScene3DObjectRefRegistration — registration lifetime == Object3D
 * lifetime, so a viewfinder round-trip remount can never leave zombie refs).
 * This layer only owns the *binding* lifecycle: per bound object it guards the
 * release semantics below.
 */
function bindableObjectIds(bindings: Scene3DTrajectoryBinding[]): string[] {
  return Array.from(new Set(bindings.flatMap((binding) => binding.objects.map((object) => object.objectId))))
}

function BoundObjectReleaseGuard({ objectId }: { objectId: string }): null {
  React.useEffect(() => () => {
    // When playback releases the object (unbound / timeline closed), force it
    // visible so a hidden closed-loop frame never persists; the next render
    // reapplies the authored transform.
    setScene3DObjectRuntimeRefsVisible(objectId, true)
  }, [objectId])

  return null
}

export function TrajectoryPlayback({
  bindings,
  isPlaying,
  setIsPlaying,
  playheadRef,
  activeTrajectoryIds,
}: {
  bindings: Scene3DTrajectoryBinding[]
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  playheadRef: React.MutableRefObject<number>
  activeTrajectoryIds?: ReadonlySet<string> | null
}): JSX.Element {
  const objectIds = React.useMemo(() => bindableObjectIds(bindings), [bindings])
  useTrajectoryAnimation({ isPlaying, setIsPlaying, playheadRef, activeTrajectoryIds })

  // frameloop='demand' 下暂停拖播放头没有帧 → useTrajectoryAnimation 的 useFrame 不跑，
  // 3D 对象停在旧位置（时间轴默认常显后不再靠 timelineOpen 强制 'always'）。订阅播放头
  // 变化手动请一帧，让摆位逻辑应用新播放头；播放中（'always'）invalidate 是空操作，零成本。
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => useScene3DTrajectoryRuntimeStore.subscribe(
    (state) => state.playheadSeconds,
    () => invalidate(),
  ), [invalidate])

  return (
    <>
      {objectIds.map((objectId) => (
        <BoundObjectReleaseGuard key={objectId} objectId={objectId} />
      ))}
    </>
  )
}
