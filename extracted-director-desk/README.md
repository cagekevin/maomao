# 3D 导演台 · 提取包

> 从 Nomi 项目提取的 3D 导演台（Scene3D Editor）完整素材，**重点是样式与外观**。
> 目标是重构成你自己的画布，这里提供可直接参考/复用的设计语言、布局骨架、组件样式、数据模型和文案。

## 目录结构

| 文件 | 内容 | 用途 |
|---|---|---|
| `01-design-tokens.md` | 完整设计 token（颜色/圆角/字号/阴影/动画/全局样式） | 落地设计地基 |
| `02-layout-shell.md` | 外壳布局结构 + 顶部工具栏 + 窗口条 | 搭壳参考 |
| `03-component-styles.md` | 各交互组件 className 规范（按钮/工具栏/底栏/时间轴） | 直接复用样式 |
| `04-data-model.ts` | 核心数据模型（可直接 import） | 状态结构 |
| `05-i18n-zh.md` | 全量 UI 中文文案 | 文案替换 |

## 架构总览（来源）

```
generationCanvas 画布 scene3d 节点
  └─ Scene3DEditor.tsx（节点卡入口：缩略图 / 空态 → 全屏）
       └─ Scene3DFullscreen.tsx（全屏主编辑器，createPortal 挂 body）
            ├─ Scene3DFullscreenHeader   顶栏（任务入口 / CTA / 关闭）
            ├─ 左栏: SceneObjectList / TrajectoryListPanel  (260px)
            ├─ 中央: FencedCanvas(react-three-fiber)
            │         SceneContent + Scene3DTrajectoryLayer
            │         覆盖层: ToolPill / TaskOverlays / BottomBar / Timeline
            ├─ 右栏: Scene3DRightPanelBody = PropertyPanel + MoveHub  (300px)
            └─ Scene3DCoachMarks / ExportingCard（全局覆盖）
```

## 关键技术栈

- **渲染**：`@react-three/fiber` + `three`（`FencedCanvas` 封装 r3f）。
- **样式**：Tailwind + CSS 变量 token + `cn()`（clsx + tailwind-merge 自定义组）。
- **动效**：`framer-motion`（左右栏开合动画）。
- **图标**：`@tabler/icons-react`。
- **i18n**：`react-i18next`。

## 依赖清单（重构需要）

**npm 依赖**
- `react` / `react-dom`
- `three` + `@react-three/fiber`
- `framer-motion`
- `@tabler/icons-react`
- `clsx` + `tailwind-merge`
- `tailwindcss`

**必须带走的源码**
- `cn.ts`（`clsx + extendTailwindMerge`，注册 micro/caption 字号、nomi/ 圆角、outline 色 —— 不带走会样式冲突）
- `tailwind.config.ts` 的 `workbenchBasePlugin` + theme.extend（token 定义）
- 3D 资源：`mannequin-animations.glb`（假人 locomotion clip）、环境预设等

## 提取范围（本次已覆盖 vs 未覆盖）

**已提取（外观/结构/数据）**
- 全部设计 token、外壳布局、顶栏/工具栏/底栏/时间轴/面板的样式类名
- 核心数据模型 `scene3dTypes`、UI 文案

**未提取（业务逻辑，重构时自行决定是否需要）**
- 3D 渲染内核：`scene3dObjects.tsx`、`scene3dSceneView.tsx`、`SceneContent`（react-three-fiber 场景内容）
- 交互逻辑：`useScene3DCharacterDrive`（WASD 操控）、`useScene3DTakeRecorder`（录 take）、`useScene3DTrajectoryEditing`（轨迹编辑）、`scene3dPlayback`（播放位姿）
- 序列化：`scene3dSerializer.ts`
- 与 generationCanvas 的接线（节点卡入口 `Scene3DEditor.tsx`）

> 这些逻辑在重构重设计时通常会被重写，故本次只做索引标记（见下），核心结构已在 `02-layout-shell.md` 标注。

## 逻辑文件索引（如需参考原实现）

- 轨迹调度：`trajectory/TrajectoryTimeline.tsx`、`scene3dMoveHub.tsx`、`cameraMoveSchedule.ts`、`scene3dPlayback.ts`
- 操控/录制：`useScene3DCharacterDrive.ts`、`useScene3DTakeRecorder.ts`、`takeRecording.ts`
- 序列化：`scene3dSerializer.ts`
- 道具规格：`scene3dPropSpecs.ts`
- 场景模板：`scene3dSceneTemplates.ts`
- 环境：`scene3dEnvironmentPanel.tsx`
- 运镜预设：`cameraMovePreset.ts`
- 视口截图/出片：`scene3dScreenshot.ts`、`useScene3DCaptureExport.ts`

## 重构建议（基于外观）

1. **先落 token**：把 `01-design-tokens.md` 的 CSS 变量 + Tailwind 映射 + `cn()` 抄进新项目，所有组件立刻具备 Nomi 的设计语言。
2. **复刻浮条原语**：`03-component-styles.md` 第 7 节的三要素（白浮层+边框+md阴影 / h-8 按钮 / ink 激活态）是整套 UI 的骨架，建议抽成 `Toolbar/Pill/Button` 原语。
3. **外壳结构照抄**：`02-layout-shell.md` 的三栏 + 中央画布 + 底部浮条布局，动效参数（width 260/300、duration 0.24）可直接沿用。
4. **配色心智**：暖灰中性色（ink 阶梯）+ 蓝色 accent(h=250) + 3D 轴 XYZ 红绿蓝；危险用红、录用 danger 实底、CTA 用 ink 实底。
5. **明暗主题**：`[data-mantine-color-scheme="dark"]` 切换，token-only 翻组即翻全局。
