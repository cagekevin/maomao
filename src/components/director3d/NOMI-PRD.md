# Nomi 3D 导演台 · 1:1 复刻 PRD

> 文档性质：需求级契约基线（PRD 骨架）。后续模块细化内容追加到本文档。
> 配套：`NOMI-CONTRACT.md` 为 Nomi 原始契约层提取（数据/组件/hook/常量）。

---

## 0. 全局定位

- **做什么**：把 `src/components/director3d` 整体替换为 Nomi 的 `Scene3DFullscreen` 全屏 3D 导演台，UI 与交互体验 1:1。
- **给谁用**：用户（中文），在 reactflow 画布双击 director3d 节点打开全屏导演台。
- **核心价值**：UI 与使用体验与 Nomi 完全一致；内部数据/渲染技术栈以「复刻 UI」为准。
- **边界**：画布宿主（`Director3DNode`、`onExit` 截图输出）保留；编辑器内部整体换。
- **明确取舍**：不接 i18n（中文直写）；图标用 lucide stub；数据先用假数据，后期接真实 `DirectorProject`。

---

## 1. 核心模块拆解

| # | 模块 | 职责 |
|---|---|---|
| M1 | 全屏壳布局 | `Scene3DFullscreen` 顶栏+左栏+中央+右栏+底部浮层+开合动效，1:1 布局 |
| M2 | 3D 场景渲染 | `FencedCanvas`+`Scene3DSceneContent/View/Objects`（假人/相机/网格/道具/轨迹） |
| M3 | 交互动作层 | 14 个 `useScene3D*` hooks 驱动 UI 响应 |
| M4 | 面板内容 | 左栏场景树 / 右栏属性+运镜 hub / 底部工具栏 / 时间轴 |
| M5 | 数据适配 | 假 `Scene3DState` 先喂；不接 i18n |

**依赖关系**：M4 依赖 M3（面板读 hook 状态）→ M3 依赖 M2（操作 3D 对象）→ M1 容器承载。M5 横切供数据。

---

## 2. 最容易翻车的 3 个点

1. **r3f 版本断层**（react19/fiber9/drei10 vs Nomi 的 react18/fiber8/drei9）→ 3D 渲染层需适配或重写。
2. **动作层 hooks 依赖宿主**（`useScene3DFullscreenActions` 引 generationCanvasStore 等）→ 需逐个 stub/裁剪。
3. **假人/资源缺失**（x-bot.glb、mannequin-animations.glb、环境贴图）→ 需拷资源或用占位，否则 3D 显示不对。

---

## 3. 约束清单（含跨模块）

| 模块 | 核心约束 |
|---|---|
| M1 全屏壳 | 布局 1:1：顶栏(52px)+左栏(260)+中央(flex-1)+右栏(300)+底部浮层；左右栏 motion 开合(width 260/300, dur 0.24) |
| M2 3D场景 | 中央= `FencedCanvas`(r3f)+`Scene3DSceneContent/View/Objects`；假人 x-bot.glb+locomotion；网格/坐标轴/天空齐 |
| M3 动作层 | 14 个 `useScene3D*` hooks 全移植；`Scene3DFullscreen` 接线（props/ref 转发）逐字对照 Nomi |
| M4 面板 | 左 SceneObjectList / 右 PropertyPanel+MoveHub / 底 SceneAddToolbar+BottomBar / 时间轴 TrajectoryTimeline，1:1 |
| M5 数据 | 假 `Scene3DState` 驱动；不接 i18n（中文直写）；图标 lucide stub |

### 跨模块约束
- **C1 布局 1:1 优先**：先让 `Scene3DFullscreen` 组件树完整渲染（含占位 3D），再逐个补 hooks/场景。
- **C2 数据契约统一**：所有面板/hook 消费同一 `Scene3DState`，假数据先喂。
- **C3 r3f 版本适配**：3D 渲染层必须在 react19/fiber9 下编译运行；必要时重写渲染（保结构 1:1，实现可换）。
- **C4 宿主依赖零残留**：`scene3d/` 移植后不得 import 任何 generationCanvas/宿主，全 stub。
- **C5 验证标准**：打开画布 director3d 节点，截图与 Nomi 原界面逐区域对比（顶栏/左栏/右栏/时间轴/3D画布），视觉一致即通过。

---

## 4. 契约基线（详见 NOMI-CONTRACT.md）
- 入口 `Scene3DFullscreen`：7 props（initialState/nodeTitle/readOnly/onClose/onStateChange/onScreenshot/onRecordTake/referenceTarget），createPortal 到 body，zIndex 3000。
- 数据 `Scene3DState`：objects/cameras/trajectories/trajectoryBindings/trajectoryGroups/sceneTimeline/environment/editorCamera。
- 组件树：Header + 左栏(Inspector|TrajectoryList) + 中央(FencedCanvas>SceneContent) + 右栏(RightPanelBody) + 底部(BottomBar+TimelineBar) + 浮层(CoachMarks/TaskOverlays/ViewportToolPill/ExportCard)。
- hooks：14 个 `useScene3D*`，返回对象见 CONTRACT §5.5。

---

## 5. 递归细化状态
- [x] 第 1 层（全局骨架）
- [ ] 第 2 层：M1 全屏壳（下一步）
- [ ] M2 3D 场景
- [ ] M3 动作层
- [ ] M4 面板
- [ ] M5 数据适配
