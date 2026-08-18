# TASK-067 探索报告：高频路径「原生能力」高 ROI 性能优化缺口

> 类型：**A 探索类**（不给行号、不限定死范围，只给判断标准 + 大概文件方向）
> 范围：**仅高频、对性能敏感的路径**（已按需排除 director3d / 脚本盒 / App 壳 等低频模块）
> 方法：6 个 AI 按子系统并行探索，结论去重合并
> 统一判定标准：
> 1. ROI 高：改动量小（原生替原生 / 加 memo / 防抖 / rAF 合并）即可显著降卡顿或重渲染
> 2. 几乎不损质量：不改视觉、不改 API、不引入行为变化
> 3. 典型信号：querySelector 反复查、getBoundingClientRect 高频触发、长列表缺 memo、
>    受控输入 onChange 未防抖即写父/全局 store、mousemove/wheel 未 rAF 合并、
>    store 整包订阅连坐重渲、热路径重复 JSON.parse/深拷贝/循环内 new RegExp

---

## 一、共识根因（多个 AI 独立确认，优先落地）

### R1. 节点 / 列表 / 卡片普遍缺 `React.memo`（最高 ROI，一行包裹）
- 全部 17 个节点组件 `src/components/nodes/*.jsx`（ImageNode / TextNode / PromptNode / GridSplitNode /
  GridMergeNode / VideoProcessNode / ImageBoxNode / TemplateNode 等）均为裸 `export default function`，无 memo。
- 列表/卡片：`AgentPanel.jsx` 消息列表、`TaskCenter.jsx` 任务卡、`AssetLibrary.jsx` / `GeneratedView.jsx` 素材卡、
  `PromptLibrary.jsx` 提示词卡、`NodeTitle.jsx`。
- 现象：ReactFlow 在选中/平移/缩放等父级 store 变化时重渲全部节点；列表父状态一变整列重建。
- 改法：`export default React.memo(Xxx)`（props 仅 id/data/selected，浅比较天然安全）。
- 收益：**高**　风险：**低**

### R2. 受控输入 / 搜索框 onChange 未防抖即写回（高频输入卡顿根因）
- `AgentPanel.jsx` 输入框每次按键同步 `contentSet` 落盘 + 整面板重渲
- `PromptInput.jsx` / `TextNode.jsx` 节点提示词每键 `setNodes` 全图 map
- `OverlayEditor.jsx` 画布尺寸 number 输入每键写回 node.data
- `PromptLibrary.jsx` / `TaskCenter.jsx` 搜索框每键全量 `.filter` 遍历
- `SkillSettings.jsx` / `AccountsSettings.jsx` / `ProviderForm.jsx` 大 textarea 每键整块重渲
- 改法：参考 `PromptHub.jsx` 已落地的 `debouncedKeyword`（200ms setTimeout）+ 抽独立受控子组件 memo
- 收益：**高**　风险：**低**

### R3. 高频鼠标事件（mousemove / wheel / pointermove）未用 `requestAnimationFrame` 合并
- `OverlayEditor.jsx` 拖拽图层 onMove 每帧 setState 触发重合成（其涂抹分支已用 rAF，拖拽分支未对齐）
- `ImageZoomDialog.jsx` onWheel 直接 setScale 无合并；拖拽平移 pointermove 每帧 setState
- `ResizeFullscreenHandle.jsx` resize move 每帧写 inline style 无 rAF
- `ImageEditor.jsx` 平移 move 每帧写 scrollLeft/Top；`FaceMosaicEditor.jsx` 框选每帧 setDragBox
- `lod.jsx` 每次 zoom 变化 `document.querySelector('.react-flow')` 可改 useRef 缓存
- 改法：move 内 rAF 合并 + getBoundingClientRect 在 down 时缓存一次
- 收益：**高**　风险：**低**

---

## 二、按子系统细分（ROI 高→中）

### A. 画布渲染 / 拖拽 / 连线
1. 节点组件缺 memo（见 R1）
2. `CustomHandle.jsx` 端口 mousemove 每帧 getBoundingClientRect + 写 CSS 变量 → 缓存 rect + rAF（中）
3. `GridSplit/Template/GridMerge/ScriptBox` 高度自适应 ResizeObserver 内 `getNodes().find` 全量遍历 → 缓存高度 ref / rAF 合并（中）
4. `useArrangeCanvas.js` BFS 内 `nodes.find` 嵌套 O(n²) → 改 `Map` 取节点（中，节点多时整理画布卡顿）
5. `VideoProcessNode.jsx` `ne` 用 `getNodes()` 全量 for 遍历找源 → 改 `getNode(id)` 单点取（中）

### B. 面板 / 列表 / 媒体
1. AgentPanel 消息列表缺 memo + key=i（高，见 R1/R2）
2. TaskCenter 任务卡缺 memo + 内联回调未 useCallback（高）
3. AssetLibrary/GeneratedView 卡片缺 memo + 图片用 backgroundImage 无懒加载 → 改 `<img loading="lazy" decoding="async">` 或复用 `LazyImage`（高）
4. PromptLibrary 卡片缺 memo（中）
5. PromptInput/MaterialStrip 内联 img 无 lazy/async（中）
6. AssetLibrary onScroll 未 rAF 节流（中）
7. PromptConfirmCard draft 状态拖垮整卡 → 拆编辑态子组件（中）
8. GeneratingOverlay tips 池每渲染 `filter` 重算 → useMemo（中/低）

### C. 选中 / 框选 / 缩放手势
1. 节点/边缺 memo（见 R1，R3 合并项最高）
2. `App.jsx` onViewportChange 每次 setZoomPercent 触发整 Canvas 树重渲 → 抽 zoom% 子组件或 rAF 节流（中高）
3. `useAssetDropPaste.js` 全局 mousemove 常驻监听 → 仅粘贴/拖放期启用 + rAF（中）
4. `ContextMenu.jsx` useLayoutEffect 同步读 offsetWidth/Height → 改 ResizeObserver/布局后定位（中）

### D. 存储 / 状态更新链路
1. `conversationStore.js` `useConversationStore()` 整包订阅 + 派生全量重算 → 加 selector/浅比较包装 + useMemo 缓存（高）
2. `settings/providerStore.js` `useProviders()` 整包订阅连坐消费者 → 拆 `useProvidersList()` 原子（高）
3. `assetStore.js` `notify()` 每次同步 `JSON.stringify` 整数组 → 落盘防抖/idle 合并（高）
4. `taskStore.js` reportGenerate progress 高频 notify+persist → rAF/200ms 节流合并（高）
5. `canvasPlanExecutor.js` 批量 setNodes 未合并 → 同帧 patch 累积一次 setNodes（中）
6. `contentStore.js` 同步 JSON.stringify 热路径 → 批处理合并（中）
7. `useScriptBoxEngine.js` 整包 useProviders 驱动节点重渲 → 见 D2

### E. 文本 / 富文本 / 输入控件
- 见 R2 全量清单（AgentPanel / PromptInput / TextNode / OverlayEditor / PromptLibrary / PromptHub / SkillSettings /
  AccountsSettings / ProviderForm / TaskCenter / GeneratedView / AssetLibrary / NodeTitle）

### F. 工具函数 / 工具区
1. TaskCenter 搜索防抖（见 R2）
2. PromptLibrary 搜索防抖（见 R2）
3. `useCanvasAgentTools.js` execute_plan 循环内 `new RegExp` 提外 + `cnMap` 提模块常量（中）
4. `canvasPlanExecutor.js` `gcText` 与 `normalize*` 同 step 重复计算 → 循环外预算一次（中）
5. `AssetLibrary.jsx` loadMore 分页 `new Set` 每次 prev.map 重建 → useRef 累积 id Set（中）
6. `contracts.js` `getLocalKeys/getKvKeyPatterns` 每次 `Object.entries().filter().map` → 提模块级常量（中）
7. `nodePalette.jsx` `getNodesByCategory` 每次全量 filter → 模块级分类 Map 索引（中）
8. `hooks.js` `parseAspect` 正则每次编译 → 提模块级 `ASPECT_RE`（低/中）
9. `agentCore.js` demoPlan 等正则/Set 字面量每次重建 → 提模块常量（低）

---

## 三、落地优先级建议（按"改动小 + 收益大 + 风险低"）

**第一批（杠杆最高，建议立即做）：**
- R1 节点/列表 memo（一行包裹，挡住整片重渲）
- R2 输入/搜索防抖（照 PromptHub 范式，覆盖 8+ 处）
- R3 拖拽/缩放 rAF 合并（OverlayEditor/ImageZoomDialog/ResizeFullscreenHandle 等）
- D3 assetStore 落盘防抖、D4 taskStore 进度节流（消除主线程长任务）

**第二批（顺手改，纯原生提常量/缓存/索引）：**
- `useCanvasAgentTools` new RegExp/cnMap 提常量
- `canvasPlanExecutor` gcText/normalize 去重
- `contracts`/`nodePalette`/`hooks.parseAspect` 模块级缓存
- `useArrangeCanvas` O(n²)→Map

**已做对的基准（勿回退）：** `PromptHub.jsx`（memo + 防抖 + 分页切片）、`lod.jsx`（level 切换已 rAF）、
OverlayEditor 涂抹分支（已 rAF）。

---

## 四、探索产物说明
- 本任务为探索类，**未修改任何源码**，仅产出此清单。
- 6 个子任务覆盖：A 画布、B 面板媒体、C 手势、D 存储、E 输入、F 工具。
- 后续若进入实施，建议按子系统分批 commit（参照 CLAUDE.md 最小差异准则）。
