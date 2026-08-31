// 运动路径核心链路的纯逻辑测试：
//   绘制出的控制点 → normalizeShotPaths/normalizeCameraPath 归一化
//   → pathSamplePoints 平滑采样（曲线连续、无跳跃）
//   → bakePathKeyframes 按弧长切关键帧（数量/覆盖/单调/去重稳定）
//   → pathPositionAtFraction 沿弧长匀速回放（直线匀速不偏、细粒度不掉帧）
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest'
import {
  createEmptyPath,
  normalizeCameraPath,
  normalizeShotPaths,
  bakePathKeyframes,
  pathSamplePoints,
  pathPositionAtFraction,
  pathTangentAtFraction,
  DEFAULT_PATH_SETTINGS,
} from '../../src/components/director3d/project.ts'

// 直线控制点：从 (0,·,0) 平移到 (10,·,0)，y 恒为 0（对象贴地轨道）
const straightPoints = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
]

// 折角控制点：验证曲线在转折处连续（不平滑化出跳变）
const cornerPoints = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  { x: 5, y: 0, z: 5 },
]

describe('路径归一化 normalizeShotPaths / normalizeCameraPath', () => {
  it('绘制的控制点可原样来回（含 y=锚点高度）', () => {
    const drawn = [
      { x: 1, y: 0.6, z: 2 },
      { x: 3, y: 0.6, z: 4 },
    ]
    const path = normalizeCameraPath({ points: drawn, startFrame: 0, endFrame: 360, keyframeCount: 5 })
    expect(path.points).toEqual(drawn)
    expect(path.startFrame).toBe(0)
    expect(path.endFrame).toBe(360)
    expect(path.keyframeCount).toBe(5)
    expect(path.closed).toBe(false)
  })

  it('空/非法输入兜底为 null，不崩', () => {
    expect(normalizeCameraPath(null)).toBeNull()
    expect(normalizeCameraPath({})).not.toBeNull()
    expect(normalizeShotPaths(null)).toEqual({})
    expect(normalizeShotPaths({ a: null })).toEqual({})
  })

  it('endFrame 不允许小于 startFrame+1', () => {
    const path = normalizeCameraPath({ points: straightPoints, startFrame: 100, endFrame: 50 })
    expect(path.endFrame).toBe(101)
  })

  it('描写入对象 id → 可各对象独立恢复', () => {
    const shots = normalizeShotPaths({
      'actor-lead': { points: straightPoints, startFrame: 0, endFrame: 360, keyframeCount: 3 },
    })
    expect(shots['actor-lead'].points).toHaveLength(3)
    expect(shots['actor-lead'].keyframeCount).toBe(3)
  })
})

describe('曲线采样 pathSamplePoints（转折处平滑连续）', () => {
  it('少于 2 个点不输出', () => {
    expect(pathSamplePoints([{ x: 0, y: 0, z: 0 }], false, 8)).toEqual([])
  })

  it('直线采样：首尾对齐起点终点，且全程单调前进', () => {
    const samples = pathSamplePoints(straightPoints, false, 8)
    expect(samples.length).toBeGreaterThan(10)
    expect(samples[0].x).toBeCloseTo(0, 3)
    expect(samples[samples.length - 1].x).toBeCloseTo(10, 3)
    let lastX = -Infinity
    for (const s of samples) {
      expect(s.x).toBeGreaterThanOrEqual(lastX - 1e-6) // 单调
      lastX = s.x
    }
  })

  it('转折处相邻采样点距离有界（无跳变、无掉帧）', () => {
    const samples = pathSamplePoints(cornerPoints, false, 16)
    let maxStep = 0
    for (let i = 1; i < samples.length; i += 1) {
      const dx = samples[i].x - samples[i - 1].x
      const dz = samples[i].z - samples[i - 1].z
      maxStep = Math.max(maxStep, Math.hypot(dx, dz))
    }
    // 整条约 10 单位、采样 32 段，单段步长应 ≪ 2
    expect(maxStep).toBeLessThan(2)
  })
})

describe('关键帧烘焙 bakePathKeyframes（按弧长切帧）', () => {
  const path = normalizeCameraPath({ points: straightPoints, startFrame: 10, endFrame: 130, keyframeCount: 5 })

  it('生成恰好 keyframeCount 个关键帧，覆盖 [start,end]，帧号单调', () => {
    const { frames, sourceKeyframeFrames } = bakePathKeyframes(path, 24)
    expect(frames).toHaveLength(5)
    expect(frames[0].frame).toBe(10)
    expect(frames[4].frame).toBe(130)
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].frame).toBeGreaterThan(frames[i - 1].frame)
    }
    expect(sourceKeyframeFrames).toEqual(frames.map(f => f.frame))
  })

  it('位置落在首尾控制点范围内（直线端点重合）', () => {
    const { frames } = bakePathKeyframes(path, 24)
    expect(frames[0].position[0]).toBeCloseTo(0, 3)
    expect(frames[4].position[0]).toBeCloseTo(10, 3)
  })

  it('同一路径重复烘焙产出完全一致的帧（去重稳定，不叠加不漂移）', () => {
    const a = bakePathKeyframes(path, 24)
    const b = bakePathKeyframes(path, 24)
    expect(b.frames).toEqual(a.frames)
    expect(b.sourceKeyframeFrames).toEqual(a.sourceKeyframeFrames)
  })

  it('关键帧数不足 2 或无点时返回空，不产出', () => {
    expect(bakePathKeyframes({ ...path, points: [] }, 24).frames).toEqual([])
    expect(bakePathKeyframes({ ...path, points: [straightPoints[0]] }, 24).frames).toEqual([])
    expect(bakePathKeyframes(null, 24).frames).toEqual([])
  })
})

describe('沿弧长匀速回放 pathPositionAtFraction', () => {
  const path = normalizeCameraPath({ points: straightPoints, startFrame: 0, endFrame: 360, keyframeCount: 5 })

  it('直线匀速：u=0.5 应落在中点附近（路程均匀）', () => {
    const mid = pathPositionAtFraction(path, 0.5)
    expect(mid.x).toBeCloseTo(5, 1)
  })

  it('首尾端点与起点终点对应', () => {
    const head = pathPositionAtFraction(path, 0)
    const tail = pathPositionAtFraction(path, 1)
    expect(head.x).toBeCloseTo(0, 2)
    expect(tail.x).toBeCloseTo(10, 2)
  })

  it('细粒度连续回放：前后帧位移有界（不掉帧、不瞬移）', () => {
    const steps = 60
    let prev = null
    let maxStep = 0
    for (let i = 0; i <= steps; i += 1) {
      const p = pathPositionAtFraction(path, i / steps)
      if (prev) maxStep = Math.max(maxStep, Math.hypot(p.x - prev.x, p.z - prev.z))
      prev = p
    }
    // 全程 10 单位分 60 步，单步应约 0.17；宽松界 0.5 验掉帧
    expect(maxStep).toBeLessThan(0.5)
  })

  it('超出 [0,1] 的进度被钳制，不越界', () => {
    expect(pathPositionAtFraction(path, -1).x).toBeCloseTo(0, 2)
    expect(pathPositionAtFraction(path, 2).x).toBeCloseTo(10, 2)
  })

  it('切线为归一化单位向量', () => {
    const tangent = pathTangentAtFraction(path, 0.5)
    expect(tangent).not.toBeNull()
    expect(Math.hypot(...tangent)).toBeCloseTo(1, 3)
  })
})

describe('default 参数（服务现状约束）', () => {
  it('默认关键帧数量为 5（已按用户收敛）', () => {
    expect(DEFAULT_PATH_SETTINGS.keyframeCount).toBe(5)
  })
  it('createEmptyPath 与默认 duration*fps 对齐', () => {
    const empty = createEmptyPath({ durationSeconds: 15, fps: 24 })
    expect(empty.startFrame).toBe(0)
    expect(empty.endFrame).toBe(360)
    expect(empty.keyframeCount).toBe(DEFAULT_PATH_SETTINGS.keyframeCount)
    expect(empty.points).toEqual([])
  })
})