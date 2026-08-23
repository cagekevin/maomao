# 3D 导演台 · 动画引擎（自包含）

> 从 Nomi 3D 导演台抽出的**动画 / 关键帧体系**，做成了自包含模块。
> **只依赖**：`three`、`@react-three/fiber`、`@react-three/drei`、`zustand`。
> **不依赖**任何宿主画布 / generationCanvas / Nomi 内部模块。

## 文件结构

```
animation-engine/
├── types.ts                 数据模型（Scene3DState / Trajectory / PoseKeyframe ...）
├── constants.ts             常量 + 假人默认姿势（⚠️ 接入要填 MANNEQUIN_ANIMATION_URL）
├── bindingIds.ts            id 工厂 + 相机 aim 绑定约定
├── trajectory.ts            轨迹曲线数学（CatmullRom + 二次贝塞尔 + 时间重映射）
├── poseTrack.ts             动作关键帧（step-hold：录制事件 → 关键帧 → 采样）
├── playback.ts              ★ 播放采样核心（对象/相机随播放头位姿 + 手持抖动 + FOV 渐变）
├── math.ts                  数学（向量 / 相机朝向 / 骨骼姿势 / 落地）
├── propSpecs.ts             语义道具 footprint（供 objectVisualHalfHeight）
├── runtimeStore.ts          zustand 运行时 store（播放头 / 场景快照 / 对象 ref 表 / held）
├── mannequinLocomotion.ts   ★ 假人骨骼动画 hook（AnimationMixer 播 idle/walk/run）
├── useTrajectoryAnimation.ts ★ 轨迹动画驱动 hook（播放头推进 + 采样直驱对象）
├── useScene3DObjectRefRegistration.ts  对象 ref 注册 hook（挂载即注册）
└── index.ts                 统一出口
```

## 接入你的画布：3 步

### 1. 填 `constants.ts` 的资源路径
```ts
// 唯一必须改的配置点
export const MANNEQUIN_ANIMATION_URL = new URL('../assets/mannequin-animations.glb', import.meta.url).href
```
（`mannequin-animations.glb` 在 `../source/_deps/assets/` 已备好。）

### 2. npm 依赖
```
three  @react-three/fiber  @react-three/drei  zustand
```

### 3. 在 r3f `<Canvas>` 内接线

**播放轨迹动画**（对象/相机沿轨迹动）：
```tsx
import { useTrajectoryAnimation, setScene3DTrajectorySnapshot } from './animation-engine'

// 进编辑器时把场景轨迹喂进运行时 store
setScene3DTrajectorySnapshot({
  trajectories, trajectoryBindings, trajectoryGroups, sceneTimeline,
})

// Canvas 内，每帧推进播放头 + 驱动绑定对象
const playheadRef = useTrajectoryAnimation({ isPlaying, setIsPlaying })
```

**对象注册**（让轨迹能驱动它的 group）：
```tsx
import { useScene3DObjectRefRegistration } from './animation-engine'

const groupRef = useRef<THREE.Group>(null)
useScene3DObjectRefRegistration(object.id, groupRef, { positionOffsetY: 0, followTangent: true })
```

**假人骨骼动画**（播 idle/walk/run）：
```tsx
import { useMannequinLocomotion } from './animation-engine'

useMannequinLocomotion(model, activeClip)  // activeClip: 'idle' | 'walk' | 'run' | undefined
```

**按播放头取相机 / 对象最终位姿**（渲染 / 导出共用）：
```tsx
import { cameraWithPlaybackPosition, objectWithPlaybackPose } from './animation-engine'

const camera = cameraWithPlaybackPosition(state, cameraData, playheadSeconds)
const object = objectWithPlaybackPose(state, objectData, playheadSeconds)
```

## 关键帧是什么形态

- **动作关键帧**（`poseTrack`）：`{ time, presetId?, pose? }[]`，**step-hold**（离散切换，不插值）。
  录制：`buildPoseTrack(events)`；取 t 时刻姿势：`samplePoseKeyframe(track, t)`。
- **轨迹关键帧**（`trajectory`）：每个轨迹点有 `timeRatio`（0~1 时间分布），`remapTrajectoryTimeRatio` 做时间→曲线映射。可拖点调节奏。
- **骨骼动画**（locomotion）：three AnimationMixer 播 glb clip，`crossFadeTo` 平滑过渡；离屏用 `driverRef.setTime(t)` 逐帧定相位（确定性可重现）。

> ⚠️ 注意：这里是**离散动作切换 + 沿轨迹动画 + 骨骼 clip**，不是「打两个姿势帧自动补间」的连续插值 K 帧。如需双键帧补间，需在此之上自建。

## 与 Nomi 原版的差异（剥离清单）

原版依赖 generationCanvas 宿主的地方，这里全部剥掉或内联：
- `isArmLocomotionTrackName` → 内联进 `mannequinLocomotion.ts`
- `scene3dConstants` 只保留动画需要部分
- 所有 `../../../../` 跨模块 import 改为引擎内相对 import
- `objectVisualHalfHeight` 依赖的 prop footprint → 独立 `propSpecs.ts`（只留 footprint 数据）
