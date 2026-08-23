// ============================================================
// 3D 导演台 · 动画引擎 · 动作关键帧（pose-over-time）
// 抽自 Nomi scene3dPoseTrack.ts（完整）
// step-hold：动作是离散切换，t 时刻取「time ≤ t 的最近一帧」，不插值。
// ============================================================
import type { Scene3DPoseKeyframe, Scene3DVector3 } from './types'

// 录制事件（recorder 产物的输入形态）。time 为绝对场景时间轴秒。
export type Scene3DPoseEvent = {
  time: number
  presetId?: string
  pose?: Record<string, Scene3DVector3>
}

function clonePose(pose?: Record<string, Scene3DVector3>): Record<string, Scene3DVector3> | undefined {
  if (!pose) return undefined
  return Object.fromEntries(
    Object.entries(pose).map(([boneName, rotation]) => [boneName, [...rotation] as Scene3DVector3]),
  )
}

// 关键帧的稳定身份键：连续同 key 段塌合成一帧。
export function poseKeyframeKey(keyframe: Scene3DPoseKeyframe | Scene3DPoseEvent | undefined): string {
  if (!keyframe) return 'base'
  if (keyframe.presetId) return `preset:${keyframe.presetId}`
  if (keyframe.pose && Object.keys(keyframe.pose).length > 0) {
    const shape = Object.entries(keyframe.pose)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([bone, rot]) => `${bone}:${rot.join(',')}`)
      .join('|')
    return `pose:${shape}`
  }
  return 'base'
}

// 录制事件 → 归一关键帧序列：滤非法 → 升序稳定排序 → 塌合连续同 key → 深 clone。
export function buildPoseTrack(events: ReadonlyArray<Scene3DPoseEvent>): Scene3DPoseKeyframe[] {
  const valid = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => Number.isFinite(event.time) && event.time >= 0)
  valid.sort((a, b) => (a.event.time - b.event.time) || (a.index - b.index))

  const track: Scene3DPoseKeyframe[] = []
  let lastKey: string | null = null
  for (const { event } of valid) {
    const key = poseKeyframeKey(event)
    if (key === lastKey) continue
    lastKey = key
    track.push({
      time: event.time,
      presetId: event.presetId,
      pose: clonePose(event.pose),
    })
  }
  return track
}

export type Scene3DFrameMotionSource = 'locomotion' | 'static-pose' | 'static-base'

export function frameMotionSource(
  track: ReadonlyArray<Scene3DPoseKeyframe> | undefined,
  locomotionClip: string | undefined,
  time: number,
): Scene3DFrameMotionSource {
  const keyframe = track && track.length > 0 ? samplePoseKeyframe(track, time) : undefined
  const poseInterrupts = poseKeyframeKey(keyframe) !== 'base'
  if (poseInterrupts) return 'static-pose'
  if (locomotionClip) return 'locomotion'
  return 'static-base'
}

// 时刻 t 当前生效的关键帧（step-hold）。
export function samplePoseKeyframe(
  track: ReadonlyArray<Scene3DPoseKeyframe>,
  time: number,
): Scene3DPoseKeyframe | undefined {
  let best: Scene3DPoseKeyframe | undefined
  for (const keyframe of track) {
    if (keyframe.time > time) continue
    if (!best || keyframe.time > best.time) best = keyframe
  }
  return best
}
