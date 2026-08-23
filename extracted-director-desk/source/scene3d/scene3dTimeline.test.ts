import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_TIMELINE_DURATION, sceneContentEndSeconds, syncSceneTimelineDuration } from './scene3dTimeline'
import type { Scene3DObject, Scene3DState, Scene3DTrajectoryBinding } from './scene3dTypes'

function binding(endTime: number, startTime = 0): Scene3DTrajectoryBinding {
  return {
    id: `b-${startTime}-${endTime}`,
    trajectoryId: 't',
    objects: [{ objectId: 'o', offsetRatio: 0 }],
    startTime,
    endTime,
    direction: 'forward',
  }
}

function makeState(partial: Partial<Scene3DState>): Scene3DState {
  return {
    objects: [],
    cameras: [],
    trajectories: [],
    trajectoryBindings: [],
    trajectoryGroups: [],
    sceneTimeline: { totalDuration: DEFAULT_SCENE_TIMELINE_DURATION },
    ...partial,
  } as Scene3DState
}

describe('sceneContentEndSeconds', () => {
  it('= 最大绑定 endTime', () => {
    expect(sceneContentEndSeconds(makeState({ trajectoryBindings: [binding(3), binding(7), binding(5)] }))).toBe(7)
  })

  it('也吃角色 poseTrack 关键帧时间（与导出 motionEnd 同公式）', () => {
    const state = makeState({
      trajectoryBindings: [binding(3)],
      objects: [{ poseTrack: [{ time: 0 }, { time: 8 }] } as unknown as Scene3DObject],
    })
    expect(sceneContentEndSeconds(state)).toBe(8)
  })

  it('空场景 = 0', () => {
    expect(sceneContentEndSeconds(makeState({}))).toBe(0)
  })
})

describe('syncSceneTimelineDuration', () => {
  it('增长到内容长度', () => {
    const next = syncSceneTimelineDuration(makeState({ trajectoryBindings: [binding(15)], sceneTimeline: { totalDuration: 10 } }))
    expect(next.sceneTimeline.totalDuration).toBe(15)
  })

  it('收缩：内容变短时 totalDuration 回落（第3期核心，旧「只增不减」的反面）', () => {
    const next = syncSceneTimelineDuration(makeState({ trajectoryBindings: [binding(4)], sceneTimeline: { totalDuration: 20 } }))
    expect(next.sceneTimeline.totalDuration).toBe(4)
  })

  it('空场景兜底默认（时间轴不塌成 0）', () => {
    const next = syncSceneTimelineDuration(makeState({ trajectoryBindings: [], sceneTimeline: { totalDuration: 20 } }))
    expect(next.sceneTimeline.totalDuration).toBe(DEFAULT_SCENE_TIMELINE_DURATION)
  })

  it('值未变返回同一引用（省无谓重渲染）', () => {
    const state = makeState({ trajectoryBindings: [binding(6)], sceneTimeline: { totalDuration: 6 } })
    expect(syncSceneTimelineDuration(state)).toBe(state)
  })
})
