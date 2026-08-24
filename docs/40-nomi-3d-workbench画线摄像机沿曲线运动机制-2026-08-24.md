# nomi-3d-workbench：画线 + 摄像机沿曲线运动 实现机制解析

> 来源项目：`/Users/kevin/Downloads/nomi-3d-workbench`
> 技术栈：react-three-fiber (@react-three/fiber) + drei (@react-three/drei) + three.js + zustand
> 调研日期：2026-08-24
> 目标：搞清楚"在 3D 场景里画一条线（路径），让摄像机沿着这条线运动"是如何实现的，供 3D 导演台（monoform 白膜预演）移植参考。

---

## 0. 一句话结论

这个项目把"画线 + 摄像机沿曲线运动"抽象成一个 **Trajectory（轨迹）子系统**：

- **画线** = 在地面平面（y=0）上点选/双击放置控制点，得到一条 `points: Vector3[]` 路径，运行时用 `THREE.CatmullRomCurve3`（默认）或分段 `QuadraticBezierCurve3`（带曲率把手时）实时构建平滑曲线。
- **摄像机沿曲线运动** = 把"相机"和"某条轨迹"通过一个 `TrajectoryBinding`（绑定关系）关联，播放时按时间 `t∈[0,1]` 调用 `curve.getPointAt(t)` 取相机位置、`curve.getTangentAt(t)` 取朝向，逐帧（r3f 的 `useFrame`）更新相机 Object3D。
- **统一采样源**：编辑器实时预览、相机预览小窗、离屏导出成片，三处都走**同一个采样函数** `sceneObjectTrajectorySample`，保证"所见即所得、导出可复现"。

核心目录：`src/workbench/generationCanvas/nodes/scene3d/trajectory/`

---

## 1. 数据模型（持久化层）

定义于 `scene3dTypes.ts`：

```ts
// 轨迹上的一个控制点
Scene3DTrajectoryPoint = {
  id: string
  position: [x, y, z]        // 脚底坐标（轨迹存脚底，渲染时加半身高抬升）
  timeRatio?: number         // 可选：该点在时间轴上的归一化位置（用于非匀速）
}

// 每段（相邻两点之间）可选的贝塞尔曲率控制点
Scene3DTrajectoryCurveControl = {
  segmentStartPointId: string // 段起点 point 的 id
  position: [x, y, z]
}

// 一条轨迹
Scene3DTrajectory = {
  id, name,
  points: Scene3DTrajectoryPoint[],
  curveControls?: Scene3DTrajectoryCurveControl[], // 每段最多 1 个把手
  tension: number,    // CatmullRom 张力，默认 0.5
  closed: boolean,    // 是否闭合（循环）
  color: string
}

// 绑定：把一条轨迹绑给若干对象（含摄像机），定义时间窗口与方向
Scene3DTrajectoryBinding = {
  id,
  trajectoryId: string,
  objects: { objectId: string; offsetRatio: number }[], // 可绑相机、角色假人
  startTime: number,          // 秒
  endTime: number,            // 秒
  direction: 'forward' | 'reverse',
  fovFrom?, fovTo?,           // 可选：FOV 渐变（变焦运镜）
}
```

要点：
- **持久化层不存 THREE 曲线对象**，只存控制点数组 + 可选曲率把手。真正的曲线在运行时由 `buildTrajectoryCurve` 临时构建（见 §2.1）。
- 一条轨迹可以被**多个对象共享**，一个对象也可以绑**多条**轨迹（`TrajectoryBinding.objects` 是数组）。

---

## 2. 画线：用户如何创建与编辑路径

### 2.1 曲线构建 `buildTrajectoryCurve`（`trajectory/trajectoryUtils.ts:64`）

```ts
export function buildTrajectoryCurve(trajectory): THREE.Curve<THREE.Vector3> | null {
  if (trajectory.points.length < 2) return null
  const points = trajectory.points.map(p => new THREE.Vector3(...p.position))
  const controls = trajectoryCurveControlMap(trajectory) // 段起点id -> 控制点
  const curve = new THREE.CatmullRomCurve3(points, trajectory.closed, 'catmullrom', trajectory.tension)
  curve.updateArcLengths()
  if (controls.size > 0) {
    // 带曲率把手：用 CurvePath 拼接
    const path = new THREE.CurvePath<THREE.Vector3>()
    for (let i = 0; i < segmentCount; i++) {
      const control = controls.get(points[i].id)
      path.add(control
        ? new THREE.QuadraticBezierCurve3(start, control, end)   // 该段走贝塞尔
        : catmullSegmentCurve(curve, i, segmentCount))          // 否则走 Catmull-Rom 子段
    }
    path.updateArcLengths()
    return path
  }
  return curve
}
```

- 默认：整条 `CatmullRomCurve3`，过所有控制点的平滑样条。
- 某段有曲率把手：该段替换为 `QuadraticBezierCurve3`（start→control→end），其余段仍是 Catmull-Rom 子段，整体用 `CurvePath` 拼接。
- `updateArcLengths()` 保证 `getPointAt`/`getTangentAt`（按弧长均匀取点）正确。

### 2.2 交互入口

| 操作 | 交互 | 处理函数 |
|------|------|----------|
| 双击地面创建新轨迹（含 2 点） | `TrajectoryEditPlane` 透明平面 `onDoubleClick`（`TrajectoryRenderer.tsx:189`） | `onCreateTrajectory([x,0,z])` → `createTrajectoryAt`（`useScene3DTrajectoryEditing.ts:219`） |
| 双击已有线段插入点 | `TrajectoryHitTube` `onDoubleClick` | `insertPointAtHit` → `onInsertPoint`，插入位置用 `trajectoryInsertIndex` 沿弧长最近点（`trajectoryUtils.ts:177`） |
| 拖拽单个控制点 | `TrajectoryControlPoint`（`TrajectoryPointControls.tsx:129`） | 射线投影到 xz 平面，`onUpdatePoint` 回写 |
| 选中后用 TransformControls 自由移动（可离地） | drei `<TransformControls>`（`TrajectoryPointControls.tsx:24`） | `onUpdatePoint` |
| 曲率把手（贝塞尔控制点） | `TrajectoryCurveControlHandle`（`TrajectoryPointControls.tsx:472`） | `onUpdateCurveControl`；双击把手删除（`null`）恢复 Catmull-Rom |
| 端点 `+` 按钮追加点 | `TrajectoryEndpointAddButton`（`TrajectoryPointControls.tsx:394`） | 沿切线延伸推算 `addPosition` |
| 整条轨迹平移 | `useTrajectoryWholeDrag`（`TrajectoryRenderer.tsx:77`） | `translateTrajectory` |

新建轨迹默认 2 个点，第二点沿 +X 偏移 3 单位（`NEW_TRAJECTORY_SECOND_POINT_OFFSET = 3`），`tension 0.5`，`closed false`。

### 2.3 实时渲染曲线

`TrajectoryLineView`（`TrajectoryRenderer.tsx:266`）：
- `trajectoryLinePoints(trajectory)`（`trajectoryUtils.ts:86`）先 `buildTrajectoryCurve` 再 `curve.getPoints(64)` 采样 64 段点。
- 喂给 drei 的 `<Line points={...} />` 画出可见曲线。
- 另用透明 `TubeGeometry`（`createTrajectoryTubeGeometry`，半径 0.12）做**命中体**（方便点击/拖拽），见 `TrajectoryHitTube`（`TrajectoryRenderer.tsx:214`）。

---

## 3. 摄像机沿曲线运动：核心机制

### 3.1 绑定（谁沿哪条轨迹动）

把"相机"当作一个可被绑定的对象即可。例如在 `cameraMoveBuilder.ts` 里，语义运镜（"推近/环绕/升降/横移"等）被翻译成：

```ts
// buildBinding（cameraMoveBuilder.ts:196）
{
  id, trajectoryId,
  objects: [{ objectId: cameraId, offsetRatio: 0 }], // 绑的就是相机
  startTime: 0, endTime: duration,
  direction: 'forward',
  // zoom/dolly_zoom 还会带 { fovFrom, fovTo } 做变焦
}
```

即：相机 = 一个 `objectId`，轨迹 = 一组控制点，Binding = 把两者按时间窗口关联。

### 3.2 采样函数（所有运动的唯一数学来源）

`scene3dPlayback.ts:71` **`sceneObjectTrajectorySample`**：

```ts
export function sceneObjectTrajectorySample(state, objectId, playheadSeconds, activeTrajectoryIds) {
  const binding = findObjectTrajectoryBinding(state, objectId, activeTrajectoryIds)
  const trajectory = state.trajectories.find(t => t.id === binding.trajectoryId)
  const curve = buildTrajectoryCurve(trajectory)
  const duration = binding.endTime - binding.startTime

  const visible = !(trajectory.closed && playheadSeconds < binding.startTime)
  let tBase = clampRatio((playheadSeconds - binding.startTime) / duration) // 时间→[0,1]
  if (binding.direction === 'reverse') tBase = 1 - tBase
  const t = remapTrajectoryTimeRatio(trajectory, tBase + offset) // 支持非匀速 timeRatio

  const tangent = curve.getTangentAt(t)
  return {
    position: curve.getPointAt(t),                                   // ① 位置
    tangent: tangent.lengthSq() >= 1e-10 ? tangent.normalize() : null, // ② 朝向（切向）
    visible,
  }
}
```

关键两步（这正是"沿曲线运动"的本质）：
1. **位置**：`curve.getPointAt(t)` —— 按**弧长归一化**的 t 取曲线上的点（匀速运动）。
2. **朝向**：`curve.getTangentAt(t)` —— 取该点切线，渲染时让对象 `lookAt(position + tangent)` 朝前看（见 §3.3）。

`remapTrajectoryTimeRatio`（`trajectoryUtils.ts:141`）支持每个控制点带 `timeRatio`，实现"路径长但某段走得快/慢"的非匀速效果；闭合轨迹用 `wrapRatio` 循环。

### 3.3 逐帧驱动（播放引擎）

`trajectory/useTrajectoryAnimation.ts` 用 r3f 的 `useFrame` 每帧执行：

```ts
useFrame((_, delta) => {
  if (isPlayingRef.current) playheadRef.current += delta   // 播放头随时间推进
  const playheadSeconds = playheadRef.current

  drivenObjectIds.forEach((objectId) => {
    if (isScene3DObjectRuntimeHeld(objectId)) return       // 用户手拖中的对象跳过，避免打架
    const targets = objectRefMap.get(objectId)             // 注册进来的活 Object3D ref
    const sample = sceneObjectTrajectorySample(runtime, objectId, playheadSeconds, selectedTrajectoryIds)
    targets.forEach((target) => {
      const obj = target.ref.current
      obj.visible = sample.visible
      obj.position.copy(sample.position)
      if (target.positionOffset) obj.position.add(target.positionOffset)
      if (target.followTangent !== false && sample.tangent) {
        obj.lookAt(obj.position.clone().add(sample.tangent)) // ③ 朝切线方向
      }
    })
  })

  // 到终点自动停
  if (playheadRef.current >= stopAt) { isPlayingRef.current = false; setIsPlaying(false) }
})
```

而**摄像机**本身不是普通 Object3D，它有自己的 `Scene3DCamera` 数据（position/target/fov/rotation）。相机沿轨迹的最终姿态由 `cameraWithPlaybackPosition`（`scene3dPlayback.ts:180`）计算，逻辑同样基于 `sceneObjectTrajectorySample`：

```ts
export function cameraWithPlaybackPosition(state, camera, playheadSeconds, activeTrajectoryIds): Scene3DCamera {
  const sample = sceneObjectTrajectorySample(state, camera.id, playheadSeconds, activeTrajectoryIds)
  const position = sample ? sample.position : camera.position
  // 注视点优先级：aim 轨迹 > follow 目标 > 静态 target
  const aimSample = camera.aimTrajectoryId ? sceneObjectTrajectorySample(...) : null
  const target = aimSample ? aimSample.position
    : sceneObjectCameraTargetPosition(state, camera.followTargetId, ...) ?? camera.target
  const shaken = withCameraShake(position, target, camera.shakeAmplitude ?? 0, playheadSeconds)
  return {
    ...camera,
    position: shaken.position,
    target: shaken.target,
    rotation: cameraLookAtRotation(shaken.position, shaken.target), // lookAt 同类计算
    fov: bindingFovAtPlayhead(binding, camera.fov, playheadSeconds) ?? camera.fov,
  }
}
```

然后相机预览小窗（`scene3dCameraPreview.tsx` 的 `CameraPreview` / `PlaybackCameraMonitor`）把算出的 `position/rotation/fov` 直接喂给 r3f `<Canvas camera={...}>`，实现"摄像机沿你画的线运动"的所见即所得预览。

### 3.4 运行时注册表：`objectRefMap`

为什么用"注册表"而不是每帧按 id 扫描场景？见 `trajectoryRuntimeStore.ts` 与 `useScene3DObjectRefRegistration.ts`：

- 每个 marker 组件（角色 `SceneObjectView`、相机 `CameraHelperView`）挂载时调用 `registerScene3DObjectRef(id, ref)` 把自己的**长命 group ref** 注册进 zustand store 的 `objectRefMap`；卸载时注销。
- 注册的是 ref 对象本身（`.current` 永远指向活着的 Object3D），生命周期 = Object3D 生命周期，因此取景切换/undo/redo 导致的重挂载**不会**留下"僵尸 ref"。
- `useTrajectoryAnimation` 每帧只遍历 `objectRefMap` 里已注册的对象盖章（copy position / lookAt），零查找成本。
- 用户正在拖拽的对象（`heldObjectIds` 集合）在 `useFrame` 里被跳过，避免"动画写 transform"和"手拖"双写打架（marker 被钉回轨迹点、拖拽不跟手的根因，已在注释中记录）。

---

## 4. 播放控制与进度

- **播放头**：`trajectoryRuntimeStore.playheadSeconds`（zustand 单一状态源）。
- **播放/暂停/进度条/时间轴**：UI 在 `TrajectoryTimeline.tsx` / `TrajectoryPlayback.tsx`，通过 `setScene3DPlayheadSeconds` 推进。
- **frameloop='demand' 兼容**：暂停拖播放头时 r3f 不自动出帧，`TrajectoryPlayback` 订阅 `playheadSeconds` 变化手动 `invalidate()` 请一帧（`TrajectoryPlayback.tsx:52`）。
- **到终点自动停**：`useTrajectoryAnimation` 中 `playheadRef >= stopAt`（`stopAt` = 所有 open-end binding 的最大 endTime，闭合轨迹则取 `sceneTimeline.totalDuration`）。

---

## 5. 额外运镜细节（值得移植参考）

### 5.1 注视点三选一（互斥单源）
`cameraWithPlaybackPosition` 中注视目标优先级：
1. **aim 轨迹**（`camera.aimTrajectoryId`）：相机运镜 take 录下的逐帧朝向，忠实还原 free-look 转头。
2. **follow 某物体**（`camera.followTargetId`）：角色走位 take，相机跟拍主体。
3. **静态 target**：老行为，固定注视点。

注意：`buildCamera`（运镜 builder）里**故意不设 `followTargetId`**——主体在运镜里静止，若跟随会把注视点抬到主体头顶裁出框（P0-A 根因）。

### 5.2 手持抖动（确定性噪声）
`withCameraShake`（`scene3dPlayback.ts:135`）：纯播放头 t 的多频正弦叠加（无随机源），保证预览逐帧与离屏导出**严格一致**、mp4 可复现。满幅 ±1.6° 注视摆动 + ±3.5cm 机位平移，幅度由 `camera.shakeAmplitude` 控制。

### 5.3 FOV 渐变（变焦运镜）
`binding.fovFrom/fovTo` + `bindingFovAtPlayhead`：`zoom_in/out` 机位几乎不动（仅 2mm epsilon 防零长曲线），靠 FOV 线性插值实现变焦；`dolly_zoom`（希区柯克变焦）机位后拉同时 FOV 反向补偿。

### 5.4 语义运镜 → 状态（AI 友好）
`cameraMoveBuilder.ts` 把人话运镜（`push_in/pull_out/orbit_left/crane_up/track_right/dolly_zoom/...`）直接翻译成 `Scene3DState`（主体假人 + 跟拍相机 + 轨迹 + 绑定），是纯函数、配单测。这意味着"让相机沿某条线运动"既可由用户手绘，也可由 AI 语义生成。

---

## 6. 导出：所见即所得、可复现

- 持久化 = `JSON.stringify(Scene3DState)` 整个状态（含 `trajectories` / `trajectoryBindings` / `trajectoryGroups`）+ 时间轴。
- 离屏导出 mp4 / 首尾帧（`Scene3DTrajectoryCapture.tsx`）同样调用 `cameraWithPlaybackPosition` / `sceneObjectTrajectorySample`，逐帧 `applySceneCameraPose` 到离屏相机并渲染。因**与预览共用同一采样函数 + 确定性抖动**，导出结果与编辑预览像素级一致。
- `isCameraMoveReady`（`scene3dPlayback.ts:45`）判断是否"运镜就绪"：至少一条轨迹 ≥2 点 + 至少一个绑定绑的是相机——参考视频需要相机运镜才能渲染 mp4。

---

## 7. 移植到 monoform 白膜预演的要点清单

1. **轨迹 = 控制点数组 + 可选曲率把手**，运行时才构建 `CatmullRomCurve3` / 拼接 `CurvePath`。不要长期持有 THREE 曲线对象。
2. **统一采样源**：编辑器实时预览、相机预览、导出三处必须共用同一个 `sample(t)` 函数，否则"预览与成片漂移"（该项目为此专门修过"假人陷地低半身"的 bug）。
3. **沿曲线运动 = `getPointAt(t)` 取位置 + `getTangentAt(t)` 取朝向 + `lookAt(pos+tan)`**。t 用弧长归一化保证匀速；支持 `timeRatio` 做非匀速。
4. **对象 / 相机统一走"绑定 + 注册表"**：marker 自注册 Object3D ref，播放层每帧只遍历注册表盖章，避免重挂载僵尸 ref。
5. **手拖优先**：播放层每帧跳过"用户正在拖拽的对象"，避免 transform 双写冲突。
6. **注视点三选一**（aim 轨迹 / follow 目标 / 静态 target）互斥单源，运镜里主体静止时**不要**设 follow 否则裁框。
7. **确定性抖动**保证导出可复现；变焦用 FOV 渐变，希区柯克变焦机位+FOV 反向补偿。
8. **AI 语义运镜**：把"推/拉/环绕/升降/横移"翻译成轨迹点数组的纯函数，是 AI 导演台的高价值接口。

---

## 8. 关键文件索引

| 文件 | 职责 |
|------|------|
| `trajectory/trajectoryUtils.ts` | 曲线构建 `buildTrajectoryCurve`、采样点、弧长插入索引、时间重映射 `remapTrajectoryTimeRatio` |
| `trajectory/useTrajectoryAnimation.ts` | `useFrame` 逐帧驱动：播放头推进 + 对注册对象盖章 position/lookAt |
| `trajectory/trajectoryRuntimeStore.ts` | 运行时 store（播放头、轨迹、绑定、对象 ref 注册表、held 集合） |
| `trajectory/useScene3DObjectRefRegistration.ts` | marker 自注册/注销 Object3D ref |
| `trajectory/TrajectoryRenderer.tsx` | 画线交互（双击地面建轨迹、命中管、曲线渲染 `<Line>`） |
| `trajectory/TrajectoryPointControls.tsx` | 控制点拖拽、曲率把手、端点追加 |
| `trajectory/TrajectoryPlayback.tsx` | 播放驱动挂载 + frameloop=demand 兼容 |
| `scene3dPlayback.ts` | **采样核心** `sceneObjectTrajectorySample`、相机 `cameraWithPlaybackPosition`、抖动、FOV 渐变 |
| `cameraMoveBuilder.ts` | 语义运镜 → Scene3DState（纯函数，AI 友好） |
| `scene3dCameraPreview.tsx` | 相机预览小窗 / 播放监控窗，喂 `cameraWithPlaybackPosition` 结果 |
| `scene3dSceneView.tsx:384` | 主场景相机 marker 注册进轨迹运行时 |
| `scene3dTypes.ts` | `Scene3DTrajectory` / `Scene3DTrajectoryBinding` 等类型定义 |
