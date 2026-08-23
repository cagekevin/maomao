# 照抄清单（source 目录）

## 已拿出的源文件（直接可抄）
```
extracted-director-desk/source/
├── Scene3DEditor.tsx           入口（节点卡 → 全屏）
├── fencedCanvas.tsx            r3f Canvas 围栏（init 兜底）
└── scene3d/                    导演台全目录（128 文件）
    ├── Scene3DFullscreen.tsx   全屏主编辑器（核心壳）
    ├── Scene3DFullscreenHeader.tsx  顶栏
    ├── scene3dToolbar.tsx      底部添加/视口工具
    ├── scene3dCharacterActionBar.tsx  底部操控条
    ├── scene3dTrajectorySurfaces.tsx  右栏+轨迹浮层
    ├── trajectory/             轨迹时间轴/渲染（19 文件）
    ├── ueSpike/                UE 姿势（5 文件）
    ├── scene3dTypes.ts         数据模型
    └── ...（其余 100+ 文件）
```

## 照抄时还要从 Nomi 一并拿的公共依赖
scene3d 会 import 这些跳出目录的模块。抄时在 Nomi 里同样 `cp` 过来（都在 `src/workbench/` 或 `src/` 下）：

| 依赖 | Nomi 相对路径（src/ 下） | 用到它的文件 |
|---|---|---|
| `utils/cn` | `src/utils/cn.ts` | 几乎所有组件（必拿） |
| `design` | `src/design/` | 顶栏/窗口条品牌 mark |
| `i18n` | `src/i18n/locales/scene3d.ts` | 所有文案 |
| `ui/toast` | `src/ui/toast.tsx` | 出片/错误提示 |
| `ui/chunkBoundary` | `src/ui/chunkBoundary.tsx` | 懒加载 |
| `ui/app-shell/WindowControls` | `src/ui/app-shell/` | win32 窗口控制 |
| `ui/app-shell/windowTitlebarDoubleClick` | `src/ui/app-shell/` | win32 拖拽 |
| `ui/switch` | `src/ui/switch.tsx` | 开关控件 |
| `model/generationCanvasTypes` | `src/workbench/generationCanvas/model/` | 节点类型 |
| `model/generationNodeKinds` | `src/workbench/generationCanvas/model/` | 节点种类 |
| `store/generationCanvasStore` | `src/workbench/generationCanvas/store/` | 画布 store |
| `workbenchStore` | `src/workbench/workbenchStore.ts` | 工作台 store |
| `agent/*`（4 个） | `src/workbench/generationCanvas/agent/` | AI 工具接线 |
| `api/assetUploadApi` | `src/workbench/api/` | 资源上传 |
| `controls/archetypeMeta` | `src/workbench/generationCanvas/nodes/controls/` | 节点元数据 |
| `media/videoPlayback*` | `src/media/` | 视频播放 |
| `onboarding/onboardingState` | `src/onboarding/` | 引导记忆 |
| `project/workbenchProjectSession` | `src/workbench/project/` | 工程会话 |
| `desktop/activeProject` + `desktop/bridge` | `src/desktop/` | 桌面桥接 |
| `render/CardCommon` + `renderRegistry` + `DeferredNodeMedia` | `src/workbench/generationCanvas/nodes/render/` | 节点卡渲染（Scene3DEditor 用） |

> 注意：`render/`、`model/`、`store/`、`agent/`、`controls/` 属于 **generationCanvas 节点宿主体系**。如果你的新画布自己实现了这些（节点模型、store、AI 工具），可以**自己重写对应接口**，不用搬整个 generationCanvas。

## 3D 静态资源（照抄要一起带）
- `mannequin-animations.glb`（假人 locomotion clip：walk/run 等）——在 `src/` 下搜 `.glb`
- 环境贴图/全景占位资源（scene3dEnvironment 用）

## npm 依赖（照抄项目 package.json 需加）
`three` · `@react-three/fiber` · `framer-motion` · `@tabler/icons-react` · `clsx` · `tailwind-merge` · `zustand`（trajectoryRuntimeStore）· `react-i18next` · `react`/`react-dom`

## 最省事路线（强烈建议）
上面公共依赖里，**真正绕不开的核心就 3 个**：`utils/cn.ts`、`design/`、`i18n`。其余都是跟「generationCanvas 节点宿主」绑定的（模型/store/agent/render）——你重构新画布时，这些接口大概率要重写。
所以最实际的抄法：
1. 抄 `source/scene3d/` 的 UI 组件 + `Scene3DFullscreen.tsx` 壳。
2. 把 `cn.ts`、design、i18n 一起带上。
3. 自己实现 `FencedCanvas`（已在 source 里，只依赖 r3f）+ 你的节点数据接口。
