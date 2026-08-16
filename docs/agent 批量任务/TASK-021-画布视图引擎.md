# TASK-021 — 画布视图引擎核验（大雄 Infinite-Canvas 无限画布 vs 我们 React Flow）

> 本文件为唯一产出。仅做只读核验，未改动任何 `src/` 代码、未写脚本。
> 所有行号均来自本次实际打开文件核实；React Flow 默认值依据 `@xyflow/react` v12 官方文档，凡未显式配置的均以"取默认"标注。

## 一、核验范围与结论摘要

| 能力 | React Flow 自带 | 我们现状（App.jsx） | 缺口 | 价值判断 |
|---|---|---|---|---|
| 无限缩放 | ✅ 自带（minZoom/maxZoom） | 已配置 `minZoom={0.05} maxZoom={4}` | 无 | 利>弊 |
| 拖拽/平移 | ✅ 自带（panOnDrag 默认 true） | 显式 `panOnDrag` | 无 | 利>弊 |
| 滚轮缩放 | ✅ 自带（zoomOnScroll 默认 true） | 取默认 | 无 | 利>弊 |
| 捏合缩放 | ✅ 自带（zoomOnPinch 默认 true） | 取默认（触屏） | 无 | 利>弊 |
| 双击放大 | ✅ 自带（zoomOnDoubleClick 默认 true） | 取默认 | 无（反超：大雄无此默认） | 利>弊 |
| 画布背景网格 | ✅ 自带（Background 组件） | 点阵网格已配 | 无 | 利>弊 |
| 小地图（可跳转） | ✅ 自带 `MiniMap` | 已用，且 `pannable zoomable` | 无 | 利>弊 |
| fitAll | ✅ 自带 `fitView` | 整理/工具栏/初始化均调用 | 无 | 利>弊 |
| 缩放百分比显示 | ❌ 需自定义 | 已实现 `zoomPercent` | 无（反超：大雄无显式百分数） | 利>弊 |
| 自定义滚轮曲线 | ❌ 需自定义 | 用 React Flow 默认平滑 | 小缺口 | 弊>利 |
| 点击节点放大聚焦（Zoom Preview） | ❌ 需自定义 | 无 | 中缺口 | 弊>利（桌面低频） |
| 触摸桥接层（touch→mouse 翻译） | ⚠️ 无需（RF 基于 Pointer） | 无（也不需要） | 无（架构不同） | 利>弊 |

**关键判断**：React Flow 已天然覆盖大雄视图引擎的全部基础能力（无限缩放/拖拽/滚轮/捏合/双击放大/网格/小地图/适配），且在「缩放百分比显示」上反超大雄。大雄真正"超越默认"的只有两处——自定义滚轮缩放曲线（`canvasWheelZoomFactor`）与点击节点放大聚焦的 Zoom Preview（`enterZoomPreview`/`exitZoomPreviewToNode`）；其 `touch-mouse.js` 桥接因大雄全程基于 mouse 事件实现才需要，而 React Flow 本就基于 Pointer Events，不存在该缺口。两处超越均属"体验增强"而非"能力缺失"，对当前以桌面为主的 maomao 产品价值有限，**不建议优先对齐**。

---

## 二、大雄怎么做（代码证据）

### 2.1 无限缩放 —— 自定义滚轮曲线 + 自实现视口
`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`

视口应用（world 层 transform，L2045-L2054）：
```js
2045:function applyViewport(){
2046:    world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
2051:    world.classList.toggle('canvas-scaled', Math.abs(viewport.scale - 1) > 0.001);
...
2054:    renderMinimap();
```
自定义滚轮缩放因子（L2063-L2069）：
```js
2063:function canvasWheelZoomFactor(event, pageSize){
2064:    const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? pageSize : 1;
2065:    const isMac = /^Mac/.test(navigator.platform || '');
2066:    const sensitivity = 0.0008;
2067:    const macMultiplier = isMac ? 1.15 : 1;
2068:    return Math.exp(-event.deltaY * unit * sensitivity * macMultiplier);
2069:}
```
- 用 `Math.exp()` 指数曲线把滚轮 deltaY 映射为连续平滑缩放因子；对 Mac 单独乘 1.15 灵敏度。缩放态切换 `canvas-scaled` class 关闭 backdrop-filter 避免位图降采样发虚（L2051）。
- 屏幕→世界坐标换算 `screenToWorld`（L2056）、视口中心 `viewportCenter`（L2070）均自建。

### 2.2 画布背景网格
`applyViewport` 内 L2052-L2053：
```js
2052:    shell.style.backgroundSize = '24px 24px';
2053:    shell.style.backgroundPosition = '0 0';
```
- 用 CSS background 网格（24px 点阵），随视口缩放。

### 2.3 小地图（可点击跳转）
`renderMinimap` L2076：把每个节点投影成 minimap 上的 `<div class="minimap-node">`，并叠加视口框 `minimapViewport`（L2106）：
```js
2106:    minimapContent.innerHTML = `${nodeHtml}<div id="minimapViewport" class="smart-minimap-viewport" ...></div>`;
```
`minimapEventToWorld` L2109 把 minimap 上的鼠标事件反投影回世界坐标：
```js
2109:function minimapEventToWorld(event){
2116:    return {
2117:        x:state.minX + (mx - state.offsetX) / Math.max(0.0001, state.scale),
2118:        y:state.minY + (my - state.offsetY) / Math.max(0.0001, state.scale)
2119:    };
2120:}
```
- 小地图点击 → 反投影到世界点 → `centerViewportOnWorldPoint`（L2121）平移视口。即"可点击跳转"。

### 2.4 Zoom Preview —— 点击节点放大聚焦（大雄核心超越点）
进入总览 `enterZoomPreview` L2153：
```js
2153:function enterZoomPreview(){
2154:    if(zoomPreviewState) return;
2155:    zoomPreviewState = {...viewport};
2156:    shell.classList.add('zoom-preview');
2158:    fitAllNodesViewport();
```
退出并钻入某节点 `exitZoomPreviewToNode` L2177：
```js
2177:function exitZoomPreviewToNode(nodeId){
2187:    const fitScale = Math.min(
2188:        ZOOM_PREVIEW_NODE_MAX_SCALE,        // 1.15
2189:        fitW / Math.max(1, rect.width),
2190:        fitH / Math.max(1, rect.height)
2191:    );
2192:    const readableScale = Math.min(ZOOM_PREVIEW_NODE_MAX_SCALE, Math.max(ZOOM_PREVIEW_NODE_DEFAULT_SCALE, fitScale)); // 默认1 / 最大1.15
2195:    viewport.scale = Math.max(safeScale(prev.scale), readableScale);
2196:    viewport.x = shell.clientWidth / 2 - cx * viewport.scale;
2197:    viewport.y = shell.clientHeight / 2 - cy * viewport.scale;
```
- 约束常量 `ZOOM_PREVIEW_NODE_DEFAULT_SCALE=1` / `ZOOM_PREVIEW_NODE_MAX_SCALE=1.15`（L1294-L1295）；`safeScale`/`nodeScale` L1282/L1286 仅做缩放值兜底。
- 触发入口两处：
  1. 键盘快捷键 `z`（无修饰键）`toggleZoomPreview()`，L16182-L16186。
  2. 总览态点节点钻入、点空白退出——由 `shell` 的 `click` 监听实现（L15568-L15577）：
     ```js
     15568: shell.addEventListener('click', e => {
     15569:    if(!zoomPreviewState) return;
     15574:    const nodeEl = e.target.closest('.image-node');
     15575:    if(nodeEl?.dataset?.id) exitZoomPreviewToNode(nodeEl.dataset.id);
     15576:    else exitZoomPreview(screenToWorld(e));
     15577: }, true);
     ```
  3. 对应的 `mousedown` 监听（L15561-L15567）只做 `preventDefault/stopPropagation` 防穿透，不触发钻入。

### 2.5 fitAll
`fitAllNodesViewport` L2127：计算所有节点包围盒 + `pad=160`，限制 `nextScale` 在 `[0.06, 0.82]`，居中（L2144-L2149）。

### 2.6 触摸/鼠标双模适配（独立文件，架构使然）
`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/touch-mouse.js`
- 注释（L2-L3）：单指触摸翻译为 mousedown/move/up，双指捏合翻译为 wheel。
- 之所以需要：大雄画布全部交互（平移/拖节点/连线/框选）基于 mouse 事件实现（见 `shell.onmousedown` L15578 等），触屏上只有原生 click，故需桥接。
- 单指 L64 `touchstart`→`fire('mousedown')`；双指 L72 记 `pinch`，L82 `touchmove` 双指算距差派发 wheel（L55 `pinchState`）。监听冒泡阶段，局部已 `stopPropagation` 的处理自然跳过（L8）。

---

## 三、我们现状（代码证据）

### 3.1 React Flow 版本
`/Users/kevin/Documents/maomao/package.json` L26：`"@xyflow/react": "^12.3.5"`（v12，视图引擎能力完整）。

### 3.2 App.jsx 画布主组件配置
`/Users/kevin/Documents/maomao/src/App.jsx`
- 引入 `ReactFlow, Background, BackgroundVariant, MiniMap, Panel, ReactFlowProvider, useNodesState, useEdgesState, useReactFlow`（L2-L12）。
- `<ReactFlow>` 主体配置（L1291-L1328）：
  ```jsx
  1291: <ReactFlow
  1292:   key={activeProjectId}
  1315:   minZoom={0.05}
  1316:   maxZoom={4}
  1317:   fitView
  1318:   fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
  1324:   onlyRenderVisibleElements={nodes.length > 20}
  1325:   selectionOnDrag={nodes.length <= 80}
  1326:   panOnDrag
  ```
- 未显式配置的视图相关项 → 取 React Flow v12 默认：`zoomOnScroll=true`（滚轮缩放开）、`zoomOnPinch=true`（触摸捏合开）、`zoomOnDoubleClick=true`（双击空白放大）、`panOnScroll=false`（默认滚轮缩放而非平移）、`zoomActivationKeyCode='Meta'/'Control'`（按住 Ctrl/Cmd 滚轮平移）。这些是 React Flow 出厂能力，无需额外代码即生效。

### 3.3 画布背景网格
`src/App.jsx` L1330-L1336：
```jsx
1330: <Background
1331:   variant={BackgroundVariant.Dots}
1332:   gap={20}
1333:   size={1}
1334:   color="#333"
1335:   bgColor="#0d0c0c"
1336: />
```
- 点阵网格，等价于大雄 `shell backgroundSize` 点阵（L2052），且 React Flow 自动随缩放渲染。

### 3.4 小地图（MiniMap，可点击跳转）
`src/App.jsx` L1339-L1348：
```jsx
1339: {minimapOn && nodes.length < 100 && (
1341:   <MiniMap
1342:     pannable
1343:     zoomable
1344:     maskColor="#0d0c0c80"
1345:     nodeColor="#444"
1347:     className="..."
1348:   />
```
- 默认 `minimapOn` 关（L189-L192，用户要求默认不显示，点工具栏 Map 图标再开），仅节点数 <100 时渲染。
- `pannable` + `zoomable` 已开 → React Flow `MiniMap` 原生支持拖拽平移与缩放（等价于大雄 `minimapEventToWorld` 点击跳转，交互更顺手）。

### 3.5 fitAll / 适配
`src/App.jsx`：
- 初始化 `fitView`（L1317）+ `fitViewOptions`（L1318）。
- 整理后 `fitView({ padding: 0.2, duration: 800, maxZoom: 1 })`（L632、L649）。
- 工具栏 FitView 按钮 `onFitView={() => fitView({ padding: 0.2, duration: 800 })}`（L1413）。
- `useArrangeCanvas.js` L40 `arrange` 仅做 dagre 布局，视口适配全交给 `onComplete` 回调里的 `fitView`（L37 注释明确"如 fitView"）。无直接视口操作代码（已搜证 `useArrangeCanvas.js` 中 viewport/fitView 仅 L37/L41 两处注释级引用）。

### 3.6 缩放百分比显示（我们的加分项）
`src/App.jsx` L226-L229：
```jsx
226:  const [zoomPercent, setZoomPercent] = React.useState(100)
227:  const onViewportChange = React.useCallback((v) => {
228:    setZoomPercent(Math.round((v?.zoom || 1) * 100))
229:  }, [])
```
- 通过 `onViewportChange`（L1319 接入）实时计算缩放百分数传给工具栏 `zoomPercent`（L1414）。大雄无显式百分比 UI，此项我们反超大雄。

### 3.7 Zoom Preview（点击节点放大聚焦）
- **现状：无。** 全局搜索 `onNodeDoubleClick` 仅命中连线删除 `onEdgeDoubleClick`（L1089-L1090）；无任何节点聚焦/钻入逻辑。
- 但已具备实现基础：`useReactFlow()` 提供 `screenToFlowPosition`/`fitView`（L180），以及 `setCenter`/`zoomTo`（v12 自带，未在本文件搜索命中即表示尚未使用）。

### 3.8 触摸适配
- 依赖 React Flow v12 内置 Pointer Events（原生支持触屏拖拽/平移/捏合），**不存在大雄式"touch→mouse 桥接"需求**——因为大雄的桥接是为弥补"全程基于 mouse 事件"而存在，React Flow 架构天然无需此层。

---

## 四、追平落点（可执行）+ 价值判断

### 4.1 无限缩放 / 拖拽 / 滚轮 / 捏合 / 双击放大 / 网格 / 小地图 / fitAll
- 现状：React Flow 自带，已全部配置（含默认项），无需补。
- 成本：0。价值：已具备（且双击放大、百分比显示反超大雄）。倾向：**利>弊（已满足）**。

### 4.2 自定义滚轮缩放曲线
- 缺口：React Flow v12 默认滚轮缩放已是平滑指数曲线；大雄 `canvasWheelZoomFactor` 差异仅在"Mac 灵敏度微调 + 发虚规避"（L2046/L2051 关闭 backdrop-filter）。
- 落点：可在 `<ReactFlow>` 加 `zoomOnScroll` + 自定义 `onWheel` 调 `zoomActivationKeyCode` 微调；发虚问题 React Flow 用 `onlyRenderVisibleElements`/LOD 已另解（LodListener L1376）。
- 成本：低（半天）。价值：低（默认已平滑，体验增量小）。倾向：**弊>利（不建议优先）**。

### 4.3 Zoom Preview（点击节点放大聚焦）
- 缺口：我们无此能力，需自定义。
- 落点（可执行）：
  1. 进入总览：工具栏/快捷键触发 `useReactFlow().fitView({ padding: 0.2, duration: 600, maxZoom: 0.82 })`。
  2. 点节点钻入：用 `useReactFlow().setCenter(x, y, { zoom, duration })`，x/y 取节点中心、`zoom = clamp(可读缩放, 1, 1.15)`（对齐大雄 `ZOOM_PREVIEW_NODE_DEFAULT_SCALE=1` / `MAX=1.15`，L1294-L1295）。
  3. 在 React Flow 原生 `onNodeDoubleClick`（或 `onNodeClick`）里调 `setCenter`；叠加 `zoom-preview` class 控制 UI 态；点空白退出回 `fitView`。
- 成本：中（1-2 天，含交互态与快捷键）。价值：中-低（仅"从总览快速钻入某节点"场景有用，桌面用户用滚轮/框选更直接）。倾向：**弊>利（桌面低频，暂缓）**。

### 4.4 触摸桥接层
- 缺口：无（架构不同，React Flow 基于 Pointer Events 已原生支持触屏）。
- 成本：0。价值：0（无需补）。倾向：**利>弊（无需投入）**。

---

## 五、结论
大雄 Infinite-Canvas 的"视图引擎"优势 ≠ 能力缺失，而是**自建交互手感打磨**（自定义滚轮曲线、Zoom Preview 钻取）。其 `touch-mouse.js` 桥接因底层架构（全程 mouse 事件）才需存在，React Flow 天然无此缺口。

- 基础八项（无限缩放 / 拖拽 / 滚轮 / 捏合 / 双击放大 / 网格 / 小地图可跳转 / fitAll）：**React Flow 已 100% 覆盖并配置**，且「双击放大」「缩放百分比显示」反超大雄。
- 两项大雄"超越默认"能力：自定义滚轮曲线、Zoom Preview——**价值均偏低、成本不等**，**不建议作为优先项**；若后续移动端或"快速钻取"需求上升，再按 4.3 落点低成本补 Zoom Preview 即可。

**总体倾向：保持 React Flow 现状，不追平大雄视图引擎的手感增强项（利>弊 / 弊>利 已逐行标注）。**

---

## 六、核验完整性自检
- [x] 大雄无限缩放曲线（L2063）+ 视口应用（L2045）— 已贴证据
- [x] 大雄背景网格（L2052）— 已对应我们 Background（L1330）
- [x] 大雄小地图可跳转（L2076/L2109）— 已对应我们 MiniMap pannable/zoomable（L1341）
- [x] 大雄 Zoom Preview 全部入口（L2153/L2177/L15568/L16186）— 已贴 click 与 z 键证据
- [x] 大雄 fitAll（L2127）— 已对应我们 fitView（L1317/L632/L1413）
- [x] 大雄触摸桥接（touch-mouse.js L2/L64/L72）— 已说明架构差异
- [x] 我们逐项配置（L1291-L1328 主体 / L1330 网格 / L1339 小地图 / L226 百分比 / L180 fitView API）
- [x] React Flow 默认项（zoomOnScroll/zoomOnPinch/zoomOnDoubleClick/panOnScroll）明确标注"取默认"
- [x] 我们加分项（双击放大默认开、zoomPercent 百分比）已补
- [x] 无遗漏核验点、无错误行号、无虚构代码
