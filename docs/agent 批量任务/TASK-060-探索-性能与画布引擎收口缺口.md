# TASK-060 — 探索：性能 / 画布引擎 / 渲染"该收口却没收口"的架构缺口（AI08）

> 你只能写这个文件，碰任何其他文件视为失败。本任务只探索 + 产出本文档，禁止改代码、禁止写脚本。

## ⚠️ 铁律（违反重做）
1. **只读不改，禁止写脚本**。
2. 自包含：不查看其他 TASK-* 文件。
3. 一切结论必须有代码证据（文件 + 行号 + 片段），行号由你亲自打开核实，禁止编造。

## 一、背景与任务目标
项目画布基于 `@xyflow/react`，有 `useLod.js`/`LodProvider.jsx`/`LodListener.jsx`（LOD 降级）、`useArrangeCanvas.js`、`useFitNodeRatio.js`、`CANVAS_PERFORMANCE.md`。大画布/多节点/视频 3D 节点存在性能压力。

你的任务：**探索性能 / 画布引擎 / 渲染里"该收口却没收口"的架构缺口**，评估 ROI/难度。重点：该有统一 LOD/虚拟化/重渲染控制却散落或未覆盖、高频操作无节流、大资源无统一释放。

## 二、判断标准（宁多勿漏）
- **该统一 LOD 却覆盖不全**：`useLod` 只包裹部分节点，大画布其余节点无降级，卡顿。
- **该有渲染节流/防抖却无**：拖拽/缩放/属性变更触发全量重渲染，缺 `React.memo`/选择器/`debounce` 收口。
- **该有虚拟化却无**：大量节点/边无窗口化渲染，DOM 爆炸。
- **该统一资源释放却无**：视频/3D/大图节点卸载不释放内存/objectURL/定时器。
- **该有统一性能埋点却无**：无渲染耗时/卡顿监控，优化靠猜。
- **该有统一画布操作 API 却散落**：缩放/适配/布局逻辑多处重复实现。

## 三、大概文件（不限定只这些，可自行扩展）
- `src/components/base/useLod.js`、`LodProvider.jsx`、`LodListener.jsx`、`useArrangeCanvas.js`、`useFitNodeRatio.js`、`CanvasToolbar.jsx`
- `src/components/*.jsx`（视频/3D/大图节点：`VideoProcessNode`/`DiscountVideoNode`/`Director3DNode`/`PanoramaNode`/`ImageBoxNode`/`ImageNode`）
- `src/App.jsx`（画布渲染相关）、`docs/CANVAS_PERFORMANCE.md`
- grep：`useEffect|setInterval|requestAnimationFrame|memo|useMemo|debounce|throttle|objectURL|revoke|LOD|虚拟化|render`

## 四、怎么做
1. 读 `useLod.js` / `useArrangeCanvas.js` / `CANVAS_PERFORMANCE.md` 理清性能收口现状。
2. grep 上述关键词，逐一打开核对"高频渲染点是否节流、大资源是否释放、LOD 是否覆盖全"。
3. 找"LOD 覆盖不全""无节流重渲染""资源泄漏""渲染 API 散落"等架构缺口。
4. 评估 ROI×难度，优先标出"收益大但完全没做"的（如统一虚拟化、统一资源释放 hook）。

## 五、输出规范
表格：`| # | 缺口描述 | 文件:行 | 该收口成什么 | 实际现状 | 影响面 | ROI(高/中/低) | 难度(S/M/L) | 证据片段 |`
表格后 ≤6 行收口优先级建议。

## 六、验收标准
1. 找出性能/画布引擎架构缺口，每条带文件:行 + 证据。
2. 覆盖 LOD / 渲染节流 / 虚拟化 / 资源释放 / 性能埋点 至少三类。
3. 每处给 ROI + 难度。
4. 只写本文件，不改代码、不写脚本。

---

## 七、探索发现（缺口清单）

| # | 缺口描述 | 文件:行 | 该收口成什么 | 实际现状 | 影响面 | ROI | 难度 | 证据片段 |
|---|----------|---------|--------------|----------|--------|-----|------|----------|
| G1 | LOD 视口移动降级被人为关死 | `src/App.jsx:1336` | `viewportMoving` 接 ReactFlow `onMove`/`onMoveStart`/`onMoveEnd` | `viewportMoving: false` 硬编码；`useMediaDegrade` 只读 `lodLevel`，`LodListener` 只监听缩放不监听 `onMove` | 大画布拖动时重型媒体照常渲染，卡顿 | 高 | S | `LodProvider value={{ lodLevel, viewportMoving: false, ... }}` |
| G2 | 3D 资源（全景/导演台）卸载未显式释放 | `src/components/base/PanoViewer.jsx:27`、`src/components/PanoramaNode.jsx:59` | 节点卸载时 dispose 纹理/几何体/WebGL 上下文 | `PanoViewer.jsx:27` 用 `useTexture(url)` 加载，节点唯一的 `useEffect`（`PanoramaNode.jsx:59`）仅处理 `panoUrl` 变化重置错误态，无任何 3D 资源卸载清理；`capture()` 内 `WebGLRenderTarget` 已 dispose，但常驻纹理不释放 | 反复增删 3D/全景节点 GPU 内存累积 | 高 | M | `const texture = useTexture(url)`（节点无 return 清理钩子） |
| G3 | 视频节点卸载无 media 清理 | `src/components/VideoProcessNode.jsx`、`src/components/DiscountVideoNode.jsx` | 卸载时 `.pause()` + `src=""`/revoke objectURL | `VideoProcessNode` 确有 `URL.createObjectURL/revokeObjectURL`（447/473/474/670 行）但均在业务函数内、不在 `useEffect` 卸载清理钩子；缺卸载时 `<video>.pause()`。搜索 `.pause()`/`revokeObjectURL` 在 `DiscountVideoNode.jsx` **零命中** | 删除视频节点后底层 `<video>` 解码可能后台跑 | 中 | S | `VideoProcessNode` 有 URL 释放但不在卸载钩子；`DiscountVideoNode` 零命中 |
| G4 | 无统一"节点资源释放"入口 | 全仓（搜索 `useUnmount`/`useCleanup`/`disposeAll`/`useNodeResource` 零命中） | 抽 `useNodeResourceCleanup()` 统一 pause/revoke/dispose | 各节点各自写 `useEffect` 清理，逻辑分散易漏（G2/G3 根因） | 资源泄漏共性风险 | 中 | M | 无统一 hook 文件 |
| G5 | 画布层性能埋点缺失 | `src/App.jsx`、`src/components/base/useArrangeCanvas.js` | 加 render 耗时 / 节点数 / 排版耗时埋点 | `performance.mark`/`.measure` 仅 `director3d` 内部有，主渲染层无 | 无性能基线，优化无量化依据 | 低 | S | 主画布层无 `performance.mark` |
| G6 | 导演台/全景 3D 不响应画布 LOD | `src/components/Director3DNode.jsx`、`src/components/base/PanoViewer.jsx` | 文档说明属设计预期；可选接 `useThumbnail` 缩略图降级 | LOD 仅覆盖画布 2D 节点（共 **10 个**：`ImageNode`/`VideoProcessNode`/`DiscountVideoNode`/`PromptNode`/`TemplateNode`/`ImageBoxNode`/`GridSplitNode`/`GridMergeNode`/`FaceMosaicNode`/`VideoExtractNode`），独立 3D Canvas 不消费 LOD context | 缩小画布时 3D 节点仍全量渲染 | 低 | M | `useMediaDegrade` 未覆盖 3D 节点 |

### 已做且收口良好的（避免误判）
- LOD 缩放降级主链路完整：`LodListener`（缩放→level，rAF 去抖）→ `App.jsx` state → `LodProvider` context → `useMediaDegrade`（共 **10 个**节点消费：`ImageNode`/`VideoProcessNode`/`DiscountVideoNode`/`PromptNode`/`TemplateNode`/`ImageBoxNode`/`GridSplitNode`/`GridMergeNode`/`FaceMosaicNode`/`VideoExtractNode`）。另 `ConnectionLine.jsx:15` 用 `useLod()` 消费 `lodLevel` 控制连线特效，但不属媒体降级。
- Director3D 编辑器内部清理较规范：`ViewportBackground.tsx:84 texture?.dispose()`、`ViewportAspectOverlay.tsx:53/64/74 cancelAnimationFrame`、`DirectorCanvas.tsx:475 clearViewportCaptureHandler`、`InspectorControls.tsx` 拖拽 cleanupRef 均有 return 清理。
- `LodProvider.jsx:15` 有默认值兜底，不传也能跑。
- CDN 降级独立体系 `src/components/base/cdnFallback.js` 已收口（本任务关注点外）。

### 完全没做的
1. 画布视口移动期间媒体隐藏策略（连 `onMove` 监听都没接，见 G1）。
2. 统一节点资源生命周期管理 hook（见 G4）。
3. 画布级性能埋点/性能面板（见 G5）。
4. 缩略图替代原图：`useMediaDegrade.js:17` 注释明确"接真系统用缩略图替换原图而非隐藏"，目前 `useThumbnail` 恒为 `false`。

### 虚拟化（已收口良好，明确记录避免误判为缺口）
模板第二节将"该有虚拟化却无"列为判断标准，经核实本项目**虚拟化已收口**，非缺口：
- `src/App.jsx:1407`：`onlyRenderVisibleElements={nodes.length > 20}` —— ReactFlow 节点窗口化渲染，>20 节点才开启，避免 DOM 爆炸。
- `src/App.jsx:1408`：`selectionOnDrag={nodes.length <= 80}`、`:1410` `nodes.length > 100` 加 `performance-large-canvas` 类（大画布降级样式）。
- `src/components/base/LazyImage.jsx`（整体）：图片懒加载 + `IntersectionObserver`（rootMargin 120px，第 28 行），进入视口附近才挂载 `<img>`，避免多图节点一次性解码；`export default memo(LazyImage)`（第 50 行）已 memo 化。
- 节点级 `React.memo` 普遍使用（26 个文件含 `memo(`/`React.memo`，含 `VideoProcessNode`/`GridSplitNode`/`GridMergeNode`/`Director3DNode`/`NodeShell` 等），重渲染控制有基础。
> 结论：虚拟化/懒加载/节点 memo 三项均已收口，本任务无需将其列为缺口。唯一关联优化点见 G5（缺耗时埋点，无法量化大画布排版/渲染实际成本）。

### 自动排版（已收口，非高频无需节流）
- `src/components/base/useArrangeCanvas.js`：dagre + BFS 纯同步计算，由用户主动触发（Ctrl+L / 整理画布），非高频连续操作，**无需 debounce/throttle 收口**（"该有节流却无"在此不成立）。
- 已知优化空间（非架构缺口，仅备注）：`useArrangeCanvas.js:93` `nodes.find` 在 BFS 内层 O(V) 查找致整体 O(V²)，数百节点排版可能短时卡顿；因 G5 缺埋点无法量化。属后续性能优化项，不计入本次缺口清单。

### 收口优先级建议（仅建议，不实施）
- **P0（G1）**：把 `viewportMoving` 接上 ReactFlow `onMove` 事件——改动小、收益大，直接解锁已有降级能力。
- **P0（G2）**：`PanoramaNode`/`Director3DNode` 卸载时显式 dispose 3D 资源。
- **P1（G4）**：抽统一 `useNodeResourceCleanup`，收敛视频/图片/3D 释放。
- **P1（G3）**：视频节点卸载 `pause()` + src 释放。
- **P2（G5）**：画布层加 `performance.mark` 基线埋点。
- **P2（G6）**：文档说明 3D 不响应画布 LOD 属设计预期；如需可加 `useThumbnail` 缩略图降级。

### 涉及文件清单
- `src/App.jsx`（LodProvider 硬编码 `viewportMoving:false` @1336）
- `src/components/base/LodListener.jsx`（只监听缩放，无 onMove）
- `src/components/base/useLod.js` / `useMediaDegrade.js` / `LodProvider.jsx`
- `src/components/base/PanoViewer.jsx`（纹理无卸载 dispose）
- `src/components/PanoramaNode.jsx`（唯一 `useEffect` @59 仅处理 panoUrl 错误态，无 3D 卸载清理）
- `src/components/VideoProcessNode.jsx` / `DiscountVideoNode.jsx`（无 media 卸载清理）
- `src/components/Director3DNode.jsx` + `src/components/director3d/**`（内部有清理，外层不统一）
- `src/components/base/useArrangeCanvas.js`（无耗时埋点）
