import type { Scene3DState } from './scene3dTypes'

// 空场景兜底时长（无内容时时间轴不塌成 0）。历史上散落在 serializer；提到这里做单一真相源。
export const DEFAULT_SCENE_TIMELINE_DURATION = 10

// 成片真实终点（单一真相源，第3期）：所有绑定 endTime 与角色 poseTrack 关键帧时间的最大值。
// 时间轴显示长度与导出时长都读它——「尺子」与「成片」两套长度合一（根治 totalDuration 只增不减 + 导出裁尾补丁）。
export function sceneContentEndSeconds(state: Scene3DState): number {
  const bindingEnd = state.trajectoryBindings.reduce((max, binding) => Math.max(max, binding.endTime), 0)
  const poseEnd = state.objects.reduce((max, object) => (
    (object.poseTrack ?? []).reduce((inner, keyframe) => Math.max(inner, keyframe.time), max)
  ), 0)
  return Math.max(bindingEnd, poseEnd)
}

// 把 sceneTimeline.totalDuration 双向同步到内容长度（可增可减）：有内容 → = 内容终点；空场景 → 兜底默认。
// 值未变则原样返回（省新对象、稳引用，避免无谓重渲染）。
export function syncSceneTimelineDuration(state: Scene3DState): Scene3DState {
  const contentEnd = sceneContentEndSeconds(state)
  const nextTotal = contentEnd > 0 ? contentEnd : DEFAULT_SCENE_TIMELINE_DURATION
  if (nextTotal === state.sceneTimeline.totalDuration) return state
  return { ...state, sceneTimeline: { ...state.sceneTimeline, totalDuration: nextTotal } }
}
