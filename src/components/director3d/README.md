# 3D 导演台（director3d）

嵌入画布节点的 3D 导演台。由 `Director3DNode` 双击节点后全屏打开。

## 架构总览

```
App.tsx (入口 / Director3DOverlay)
  └─ top-bar（顶栏：标题 + 截图 + 关闭）
  └─ DirectorDeskShell（三栏壳）
       ├─ 左：ObjectTreePanel（场景树）
       ├─ 中：DirectorCanvas（3D 视口，r3f）
       ├─ 右：RightPanel（属性面板，内含 AnimationPanel 等）
       ├─ 底：AnimationTimelineBar（时间轴）
       └─ CurveEditorDialog（曲线编辑器弹窗）
```

## 重要分界：哪些绝不能动，哪些可以改

> 这是核心原则。改错「地基」= 数据/功能全崩；改「皮」只影响外观。

### 一、绝对不可动的「地基」（数据 + 引擎 + 逻辑）

改任何一个都会导致数据不兼容或功能失效，**不要动**：

| 目录/文件 | 作用 |
|---|---|
| `editor/schema/` | `directorProject.ts` 工程/对象/相机/关键帧/轨道数据结构 |
| `editor/store/directorStore.ts` | zustand 全局状态（工程、播放、选中、打帧、运镜）单一真相 |
| `editor/store/directorSelectors.ts` | 派生选择器 |
| `editor/runtime/` | 3D 渲染（角色模型、插值、相机） |
| `editor/canvas/DirectorCanvas.tsx` | r3f 3D 视口画布 |
| `editor/canvas/SceneRoot.tsx` | 场景根 |
| `editor/io/` | 导入导出、截图、动画导出 |
| `editor/loaders/` | gltf/模型/全景图加载 |
| `editor/modelLibrary/` + `editor/presets/` | 模型库目录、姿态/骨骼预设 |
| `editor/panels/AnimationPanel.tsx` | 动画面板（逻辑核心） |
| `editor/panels/RightPanel.tsx` | 右栏容器（结构核心） |
| `editor/canvas/AnimationTimelineBar.tsx` | 底部时间轴（功能全，绑定真实 store）|

> 注：这些文件**内部逻辑不可改**，但它们渲染出来的 DOM 结构上的 CSS 类名/样式是可改的（改皮不改骨）。

### 二、可改的「外观皮」（布局 + 样式，不动数据）

这是「把界面做成像成熟软件」的唯一改造范围：

| 文件 | 作用 | 可改 |
|---|---|---|
| `app/layout/DirectorDeskShell.tsx` | 三栏布局壳 | 分栏比例、间距、折叠交互 |
| `styles/index.css`（约 4700 行） | 全部视觉样式 | **核心改造对象**（配色/质感/排版/控件）|
| `App.tsx` 顶部 top-bar | 顶栏 | 样式、布局 |
| `app/useDirectorViewportShortcuts.ts` | 视口快捷键 | 一般不动 |

## 目标

- 界面要「像个成熟软件」（如剪映 / Blender / CAD 的专业外观）。
- **只换皮**：只改 CSS 与布局壳，绝不改数据模型、store、runtime、schema。
- 功能与数据保持不变。

## 清理历史

已删除的残留（避免再出现）：
- `scene3d-ui/` 整个目录 —— Nomi 搬入的 94 个文件（含假数据时间轴 NomiTimelinePreview）
- `editor/canvas/TimelineComponentPreview.tsx` —— react-timeline-editor 预览残留
- `test/` 空目录
- `NOMI-CONTRACT.md` / `NOMI-PRD.md` —— Nomi 文档

底部时间轴统一使用自己的 `AnimationTimelineBar`，不接 Nomi 假数据时间轴。
