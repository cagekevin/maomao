# Nomi 3D 导演台 · 契约层文档（1:1 复刻基线）

> 目的：为「在 maomao 画布中 1:1 复刻 Nomi 导演台 UI/交互」建立需求级契约基线。
> 数据先用假数据，UI/体验 1:1；不接 i18n（中文直写）；图标后续换。

## 0. 全局定位
- 把 `src/components/director3d` 整体替换为 Nomi 的 `Scene3DFullscreen` 全屏 3D 导演台。
- 界面布局、交互体验与 Nomi 1:1；内部数据/渲染技术栈以「复刻 UI」为准，不做后端 1:1。
- 画布宿主（reactflow 节点、`Director3DNode`、`onExit` 截图输出）保留，编辑器内部整体换。

## 1. 唯一入口契约

### `Scene3DFullscreen`（`scene3d/Scene3DFullscreen.tsx`）
```ts
type Scene3DFullscreenProps = {
  initialState: Scene3DState                       // 初始场景状态
  nodeTitle: string                                // 顶栏标题
  readOnly?: boolean                               // 只读（默认 false）
  onClose: () => void                              // 关闭
  onStateChange: (state: Scene3DState) => void     // 状态变更（宿主持久化）
  onScreenshot: (capture: Scene3DCaptureResult) => void
  onRecordTake?: (recordedState: Scene3DState) => string | void
  referenceTarget?: Scene3DReferenceTargetSummary
}
```
- 全屏渲染：`createPortal` 到 `document.body`，`zIndex: 3000`。
- 进编辑器即 `syncSceneTimelineDuration(cloneScene3DState(initialState))`。

## 2. 数据契约（Scene3DState）

### 核心类型
- `Scene3DVector3 = [number, number, number]`
- `Scene3DObject`：id/name/type/visible/position/rotation/scale + 可选 geometry/propKind/modelUrl/lightType/pose/poseTrack/locomotionClip/children/templateGroup
- `Scene3DCamera`：id/name/position/rotation/target + fov/aspectRatio/lensDepth/near/far + followTargetId/aimTrajectoryId/shakeAmplitude/framing
- `Scene3DTrajectory`：id/name/points[{id,position,timeRatio}]/curveControls/tension/closed/color
- `Scene3DTrajectoryBinding`：id/trajectoryId/objects[{objectId,offsetRatio}]/startTime/endTime/direction/fovFrom/fovTo
- `Scene3DPoseKeyframe`：time/presetId/pose（step-hold 动作关键帧）
- `Scene3DSelection`：`{type:'object'|'camera';id} | null`

### 顶层 `Scene3DState`
```ts
{
  objects: Scene3DObject[]
  cameras: Scene3DCamera[]
  trajectories: Scene3DTrajectory[]
  trajectoryBindings: Scene3DTrajectoryBinding[]
  trajectoryGroups: Scene3DTrajectoryGroup[]
  sceneTimeline: { totalDuration: number }
  environment: { preset/showGrid/showAxes/showSky/darkMode/backgroundColor/panoramaRotation/environmentMode/sphereRadius }
  editorCamera: { position/target/rotation/mode }
  lastThumbnail?: string
}
```

## 3. 组件树契约（Scene3DFullscreen 渲染）
```
Header（Scene3DFullscreenHeader）：标题 + 任务入口 pill（构图/动作/运镜）+ 精调 + CTA + 关闭
├─ 左栏 motion.aside（width:260）
│    trajectoryMode ? TrajectoryListPanel : SceneObjectList（场景树）
├─ 中央画布 flex-1（bg nomi-ink-05）
│    FencedCanvas（r3f Canvas 围栏）
│      SceneContent（3D 场景）+ Scene3DTrajectoryLayer + Scene3DTakeSampler
│    浮层：Scene3DViewportToolPill / Scene3DTaskOverlays / Scene3DTrajectoryEditBanner
│    底部：Scene3DBottomBar / Scene3DTrajectoryTimelineBar
├─ 右栏 motion.aside（width:300）
│    CharacterPossessButton + Scene3DRightPanelBody（PropertyPanel + Scene3DMoveHub）
全局：Scene3DCoachMarks / Scene3DExportingCard
```

## 4. 内部状态契约（Scene3DFullscreen 自管）
- `selection`：当前选中对象/相机
- `transformMode`：translate | rotate | scale
- `viewLocked` + `controlMode`（edit|fly）
- `leftPanelOpen` / `rightPanelOpen`（motion 开合动画，duration 0.24）
- `flySpeed`、`focusId`、`cameraViewEditId`、`task`（compose/act/move）

## 5. 宿主依赖（可 stub 项）
`scene3d/` 目录 import 的 Nomi 宿主极少（cn/i18n/toast/design/desktop/switch/onboarding）。
- i18n → 中文直写（用户明确不要多语言）
- toast/switch/NomiSelect → 本地 stub
- desktop/* → web 环境 stub
- generationCanvas 宿主 → 仅 Scene3DEditor 入口用；`Scene3DFullscreen` 本体不依赖

## 5.5 动作层 hooks 契约（M3）
| Hook | 入参要点 | 返回要点 |
|---|---|---|
| `useScene3DAddActions` | readOnly/stateRef/setState | `{ addObject, addProp, addCamera, addCrowd, applySceneTemplate }` |
| `useScene3DDeleteAction` | readOnly/selectionRef/setState | 删除选中对象/相机 |
| `useScene3DClipboardActions` | readOnly/stateRef/selectionRef/clipboardRef | `{ startKeyboardNavigation, stopKeyboardNavigation, copySelection, pasteClipboard }` |
| `useScene3DKeyboardShortcuts` | 各 action 回调 | 注册键盘快捷键 |
| `useScene3DTrajectoryModeActions` | trajectory/enterTrajectoryMode/stateRef/setState | 轨迹模式的选择/加点/绑定/播放 |
| `useScene3DTrajectoryEditing` | `{ state, setState, readOnly }` | `{ trajectoryEditMode, timelineOpen, isPlaying, playheadRef, activeTrajectoryId, addGroup, renameGroup, patchBinding, selectTrajectory, ... }`（轨迹编辑状态全集） |
| `useScene3DTaskFlow` | state/selection/trajectory/takeRecorder/... | `{ taskMode, taskCtaLabel, viewIdentity, statusSentence, recordCountdown, handleTaskChange, handleTaskCta, ... }`（任务状态机） |
| `useScene3DCameraViewEdit` | readOnly/selectedCamera/cameraViewEditId/... | `{ enterCameraViewEdit, exitCameraViewEdit, toggleCameraViewEdit, levelSelectedCamera, previewMode, setPreviewMode, handleTogglePreview, updateEditorCamera }` |
| `useScene3DCharacterDrive` | objects/cameras/selection/... | `{ possessId, enterPossess, exitPossess, cameraPossessId, enterCameraPossess, applyActionPreset, locomotionClip, ... }` |
| `useScene3DTakeRecorder` | possessTarget/readOnly/stateRef | `{ isRecording, elapsedSeconds, startRecording, stopRecording, sampleCharacter, sampleCamera, recordPoseEvent }` |
| `useScene3DCaptureExport` | stateRef/captureApiRef/trajectory | `{ captureViewport, captureSelectedCamera }` |
| `useScene3DCaptureActions` | ... | `{ captureViewport, captureSelectedCamera }` |
| `useScene3DSemanticPose` | possessId/patchObject/recordPoseEvent | `{ handlePoseTransition, handlePoseResume }` |
| `useScene3DCameraFraming` | setState/stateRef | `{ patchCamera, handleCameraAspectChange }` |
| `useScene3DBoundDrag` | isPlaying/playheadRef/setState | `{ beginSceneTransformInteraction, handleBoundDragEnd }` |

> 这些 hook 大部分是「纯状态 + setState 操作」，可移植。少数（CharacterDrive 操控、TakeRecorder 录制）依赖键盘/录制，可先用空实现 stub，后续补。

## 6. 关键常量
- `FULLSCREEN_Z_INDEX = 3000`
- 默认时间线时长 10s（`syncSceneTimelineDuration`）
- `OBJECT_LIMIT = 100`
- 假人模型：`x-bot.glb` + `mannequin-animations.glb`（locomotion: idle/walk/run）
- `CAMERA_DEFAULT_TARGET = [0, 0.75, 0]`
