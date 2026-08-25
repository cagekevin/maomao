# 3D 轴圈（ViewCube）踩坑经验与最佳方案 - 2026-08-24

> 本文记录在 `src/components/director3d`（3D 导演台）里做「视角轴圈」的完整过程：
> 哪些方案试过、为什么失败、真正的根因是什么、一个「好看又好用」的轴圈应该怎么做。
> 供后续再实现时直接参考，避免重复踩坑。

---

## 0. 目标

在导演台视口做一个**视角导航控件**：点击它能把相机快速切到
**顶 / 底 / 前 / 后 / 左 / 右 / 透视** 等标准视角。两条硬性标准：

1. **必须好看**（低饱和配色、比例协调、线条直达圆头、随相机旋转、不互相重叠）
2. **必须好用**（点得动、切完视角平滑不跳、画面不偏移）

## 1. 走过的弯路（5 个方案，逐个失败）

| 方案 | 做法 | 结果 / 失败原因 |
|------|------|----------------|
| ① drei `GizmoHelper + GizmoViewport` | 一行接入 | 能点，但**太亮、太大、线离圆太远**，点击**跳一下** |
| ② DOM canvas 自绘三轴 | 2D 投影绘制 | 外观好看，但**根本点不了** |
| ③ 退回 drei + 参数调优 | `axisScale/axisHeadScale/axisColors/onTarget` | 仍**丑**、**线离圆仍远**、**仍跳一下** |
| ④ drei `<Hud>` 里自绘（R3F 事件） | 场景内渲染 sprite | 能点、跟随相机，但观感一般、不够好看 |
| ⑤ DOM canvas + 实时朝向（rAF 桥接） | 修好「点不了」 | **能点了**，但转轴向时**两个轴向互相重叠**，体验差 |

结论：**五个方案分别踩中了五个不同的坑**，说明问题不是"换个库/换个写法"就能绕过去的，
必须先理解根因。

## 2. 关键根因（最值钱的经验）

### 2.1 跨 Canvas 边界的控件拿不到实时相机朝向 → 「点不了」

- 导演台里 `editorView` 这个 state **在编辑视角下从不更新**：
  `captureEditorView`（[App.jsx](src/components/director3d/App.jsx)）只写 `editorViewRef`，
  只有进摄像机视角才 `setEditorView`。
- 于是任何**依赖 `editorView.rotation` 的 Canvas 外 DOM 控件**，拿到的一直是 `undefined`，
  用「单位朝向」绘制 → 六个方向里只有 `-Z` 是朝前的，**其余圆头全被命中判定当成背面跳过** → 怎么点都没反应。

> **教训**：控件要拿**实时相机数据**，不能依赖一个只在特定时机更新的 state。
> 正解有两条：
> - 控件放进 R3F Canvas 内，直接 `useThree(s => s.camera)` 读 live camera；
> - 或留在 DOM 侧，用 **rAF 桥接** 读 `editorViewRef.current.rotation` 重绘（不触发 App 重渲染）。

### 2.2 `frameloop="demand"` 下 drei 内置补间会「跳一下」

- 本项目 Canvas 必须 `frameloop="demand"`（项目约束）。
- drei 轴圈内置补间靠 `useFrame` 的 `delta` 推进；`demand` 模式下**空闲后首帧 `delta` 巨大**，
  一帧就把相机转到终点 → 表现为点击后「跳一下」（没有动画、直接瞬移）。

> **教训**：自研补间必须**限制单帧步进** + 每帧 `invalidate()`：
> `t = Math.min(1, t + Math.min(delta, 0.05) / duration)`，保证任何帧率下都平滑。

### 2.3 旋转中心：drei 以原点为目标，导演台目标在 y=1

- drei `GizmoHelper` 内部用**场景原点**算相机距离/方向；而导演台 `OrbitControls` 的 target 是
  `[0, 1, 0]`（角色中心）。切完视角后相机对着错误位置 → 画面偏移。
- 正解：补间以 `controls.target` 为旋转中心（`endPos = target + direction * radius`），
  `controls.update()` 只在补间结束时调用一次，避免中途触发 `EditorCameraReporter` 回写打架。

### 2.4 2D 正交投影必然「轴重叠」

- DOM canvas 版用「把世界轴投影到屏幕」来画：相机转到某些角度时，两个轴在屏幕上的投影几乎重合
  → 圆头叠在一起，视觉上难看、也难以点选。这是 2D 投影方案的**先天缺陷**。

> **教训**：想彻底避免重叠，别用「2D 投影画三轴」，直接用**真正的 3D 小立方体（ViewCube 风格）**。

## 3. 一个「好看又好用」的轴圈应该怎么做（最佳方案）

### 3.1 渲染位置：进 R3F Canvas（复用 R3F 事件系统）

- 用 drei 的 `<Hud renderPriority>`（或直接在场景里渲染），轴圈画在 **R3F 自己的 canvas** 上。
- 这是本应用里**唯一被反复验证可点击**的路径（方案①④都能点；Canvas 外的 DOM 覆盖层则反复出问题）。

### 3.2 外观：真正的 3D 小立方体，别用 2D 三轴投影

- 推荐：drei `<GizmoViewcube>`（带 front/back/top 面标签的立方体），或自绘一个 R3F 小立方体放进 `<Hud>`。
- 天然规避轴重叠；六面即六个标准视角，语义清晰。
- 视觉标准：
  - 低饱和配色（X 砖红 / Y 青绿 / Z 雾蓝），不要霓虹色；
  - 尺寸 50–60px，右上角（`right: 12px; top: 54px`，避开视角面板）；
  - 可加一层半透明深色圆底 + 模糊，增强可点性暗示。

### 3.3 交互：自研平滑补间，以 controls.target 为旋转中心

- 点击轴面/圆头 → 得到世界方向 `d` → 补间目标：
  `endPos = controls.target + normalize(d) * radius`（radius = 当前相机到 target 距离，保留缩放）。
- 补间写法（可直接复用）：
  - `useEffect` 收到 request 时记录 `startPos/startQ/endPos/endQ`，`invalidate()`；
  - `useFrame` 里 `t += Math.min(delta, 0.05) / duration`，`position.lerpVectors` + `quaternion.slerp`；
  - 完成时 `controls.target.copy(target); controls.update()`，回调清空 request；
  - 顶/底视图给方向加 `0.0001` 级微偏移，避免相机 up 与视线平行（万向锁）。

### 3.4 数据流

- 控件内直接用 `useThree` 读 live camera（`camera.matrix` 取逆作为轴圈朝向）。
- 跨 Canvas 边界才需要 rAF 桥接 ref；优先避免。

### 3.5 验证清单

- [ ] 能点击并切到正确视角（顶/底/前/后/左/右/透视）
- [ ] 随相机旋转、六个面/轴互不重叠
- [ ] 切换平滑、无「跳一下」、画面以角色为中心不偏移
- [ ] 转轴向过程始终清晰可读、可点
- [ ] 只在「编辑视角」显示，摄像机视角隐藏

## 4. 一句话总结

**轴圈 = 放进 R3F Canvas（Hud）的真正的 3D 小立方体 + 自研平滑补间（限步 invalidate、以
controls.target 为旋转中心）。**
避开：drei 自带轴圈的丑/跳、Canvas 外 DOM 覆盖层的事件不可靠、2D 投影的轴重叠。
