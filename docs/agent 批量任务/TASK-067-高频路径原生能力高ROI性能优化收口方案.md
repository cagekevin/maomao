# 高频路径「原生能力」高 ROI 性能优化 · 收口方案（终稿 · 无遗漏版）

> 来源：TASK-067 三轮共 18 次 AI 并行探索（画布 / 面板 / 手势 / 存储 / 输入 / 工具 × 3 轮核对）
> 范围：**仅常用高频功能**；低频模块（director3d 拖拽 editors、脚本盒纯 UI）已按需剔除，仅保留其确属高频拖拽的 P3 漏点
> 判定门槛：ROI 高（小改动显著降卡顿/重渲染）、几乎不损质量（不改视觉/API/行为）
> **重要事实**：当前仓库实际**几乎未做任何此类优化**（全仓库 `React.memo` 仅 1 处、防抖/IME 多数缺失）。下文所有"收口文件"均为**待实施项**，非已落地。
> UI 视觉零变化，仅性能收口。

---

## 一、收口项总览（12 类范式，按改动范式聚类）

| 编号 | 收口范式（统一改法） | 收益 | 风险 | 批次 |
|------|---------------------|------|------|------|
| P1 | 节点/列表/卡片/端口/连线加 `React.memo` | 高 | 低 | 第一批 |
| P2 | 受控输入/搜索防抖 + 抽 memo 子组件（复用 `utils.debounce`） | 高 | 低 | 第一批 |
| P3 | 高频 mouse/wheel 用 `requestAnimationFrame` 合并 + 缓存 `getBoundingClientRect` | 高 | 低 | 第一批 |
| P4 | store 热路径同步 `JSON.stringify`/高频 `notify` 落盘节流（idle/debounce 合并） | 高 | 低 | 第一批 |
| P5 | store 整包订阅连坐重渲 → 加 selector / 原子 hook | 高 | 低 | 第二批 |
| P6 | 循环内 `new RegExp`/常量 `Set`/`Map` 提模块级 | 中 | 低 | 第二批 |
| P7 | `getNodes().find(x=>x.id===id)` 改 React Flow 原生 `getNode(id)` | 中 | 低 | 第二批 |
| P8 | 派生计算每次渲染重算 → `useMemo` 缓存 | 中 | 低 | 第二批 |
| P9 | 媒体/图片原生懒加载（`<img loading="lazy">` / 复用 `LazyImage`） | 高 | 低 | 第一批 |
| P10 | 拖拽/缩放期 `will-change` + 临时关 `pointer-events` + `transform` 替 `top/left` | 中 | 低 | 第一批 |
| P11 | 同帧/循环多次 store 写合并（批量 `setNodes`/`setEdges`/落盘） | 高 | 低 | 第二批 |
| P12 | IME 组字期间误触发 → `compositionstart/end` + `isComposing`（对齐 AgentPanel 范式） | 中 | 低 | 第一批 |
| P13 | 长列表虚拟滚动/视口裁剪（`react-window` 或 IntersectionObserver 哨兵） | 高 | 中 | 第三批 |
| P14 | `CSS contain` / `content-visibility` 隔离节点重排范围 | 中 | 低 | 第三批 |
| P15 | 列表稳定 `key`（弃 `key={i}` 改 `m.id` 等） | 中 | 低 | 第一批 |
| P16 | 防抖/深拷贝集中复用（手写 `setTimeout` 防抖改 `utils.debounce`） | 低 | 低 | 第二批 |

> P13/P14 属"结构性"优化，ROI 高但改动面稍大、风险中，放第三批单独验证。其余均零风险。

---

## 二、第一批（体感最明显，用户能感知变快变顺）

### P1 · memo 收口（覆盖节点/端口/连线/面板/卡片）
**统一改法**：`export default React.memo(Xxx)`；回调用 `useCallback` 稳定化，否则 memo 失效。
**收益**：高。**风险**：低。
- 注意点①：节点组件若 `data` 是每次新对象（setNodes 重造），浅比较仍会判不等 → 需确认 `useSyncNodeData` 复用同一 data 引用，或 memo 比较函数自定义。
- 注意点②：端口 `CustomHandle`/连线 `CustomEdge` memo 后，若 props 含内联函数（如 `onConnect`）会变 → 同步 useCallback。
- 注意点③：面板卡片 memo 需配合父组件拆出稳定子组件，否则父重渲仍穿透。
**收口文件**：
- 节点（全部 17 个）：`src/components/nodes/*.jsx`（ImageNode/TextNode/PromptNode/GridSplitNode/GridMergeNode/VideoProcessNode/ImageBoxNode/TemplateNode/ScriptBoxNode/Director3DNode/PanoramaNode/FaceMosaicNode/DiscountVideoNode/LoopNode/GroupNode/GhostTargetNode/VideoExtractNode）
- 端口/连线：`src/components/edges/CustomHandle.jsx`、`CustomEdge.jsx`、`ConnectionLine.jsx`
- 面板/卡片：`panels/AgentPanel.jsx`(AgentMessage+子 Reasoning/ToolCallChip/GenerationStepsCard)、`panels/PromptConfirmCard.jsx`(+StatusIcon)、`base/TaskCenter.jsx`(TaskCard+CleanItem+MenuBtn)、`base/AssetLibrary.jsx`(AssetCard+TextAssetCell+TextPreview)、`base/GeneratedView.jsx`(ResourceCard+TextResourceCell+TextPreview)、`base/PromptLibrary.jsx`(PromptCard)、`base/PromptHub.jsx`(HubCard已memo；补 DetailRow/HubDetail/HubLoading/HubEmpty)、`base/NodeTitle.jsx`、`base/TopNav.jsx`、`base/HoverToolbar.jsx`、`base/MaterialStrip.jsx`、`base/VideoThumbnail.jsx`、`base/ContextMenu.jsx`、`base/ModelSelect.jsx`、`base/NodeShell.jsx`、`base/ToolbarButton.jsx`、`base/JianyingIcon.jsx`、`base/CanvasToolbar.jsx`、`base/ToastContainer.jsx`(单条 toast memo)、`base/settings/sections/*`(大表单拆 memo 子组件)

### P2 · 输入/搜索防抖 + 抽 memo 子组件
**统一改法**：本地 state 暂存 + `utils.debounce`(200ms) 写回；大表单抽独立 memo 编辑区。
**收益**：高。**风险**：低（唯一边界：防抖窗口内强制杀进程会丢未落盘内容，正常关闭/刷新不丢——已存在，非新增）。
- 注意点：节点提示词（TextNode 等）若直接改 store data，需本地暂存 + 失焦/防抖 commit，避免每键 setNodes 全图重算。
**收口文件**：
- 搜索框（均加防抖+IME）：`base/PromptLibrary.jsx`、`base/PromptHub.jsx`、`base/TaskCenter.jsx`、`base/SkillSettings.jsx`
- 节点提示词/文本（本地暂存+防抖 commit）：`nodes/TextNode.jsx`、`PromptNode.jsx`、`TemplateNode.jsx`、`DiscountVideoNode.jsx`、`GridSplitNode.jsx`、`GridMergeNode.jsx`、`PanoramaNode.jsx`、`base/PromptInput.jsx`、`base/ImageEditor.jsx`(文字标注)
- 标题/名称：`base/NodeTitle.jsx`、`base/ProjectSelector.jsx`
- 大表单拆 memo：`base/settings/sections/SkillSettings.jsx`、`AccountsSettings.jsx`、`ProviderForm.jsx`、`ModelSection.jsx`、`ShortcutSettings.jsx`

### P3 · 高频事件 rAF 合并 + 缓存 rect
**收益**：高（拖拽/缩放体验最强）。**风险**：低。
- 注意点①：rAF 合并后，end 时必须 cancelAnimationFrame 并 flush 最后一次状态，否则松手位置差一帧。
- 注意点②：`getBoundingClientRect` 改为在 pointerdown 缓存一次，move 内只读缓存；若元素尺寸会变（如缩放自身），需在 resize 起点重取。
- 注意点③：wheel 需保留 `passive:false` + `preventDefault`，否则页面滚动会干扰。
**收口文件**：`base/OverlayEditor.jsx`(拖拽/rotate)、`base/ImageZoomDialog.jsx`(wheel/pan)、`base/ResizeFullscreenHandle.jsx`、`base/ImageEditor.jsx`、`base/FaceMosaicEditor.jsx`、`base/lod.jsx`(querySelector→useRef)、`base/useAssetDropPaste.js`、`base/ContextMenu.jsx`(useLayoutEffect→ResizeObserver)、`src/App.jsx`(onViewportChange)、`edges/CustomHandle.jsx`(getBoundingClientRect→down缓存+rAF)、`nodes/GridSplitNode.jsx`(切割线/lasso move)、`nodes/VideoProcessNode.jsx`(时间轴scrub/trim拖拽/片段拖拽)、`panels/AgentPanel.jsx`(宽度拖拽)、`base/PromptHub.jsx`(onScroll加载rAF节流)、`director3d/editor/panels/CameraPanel.tsx`、`director3d/editor/panels/InspectorControls.tsx`

### P4 · 落盘节流
**收口文件**：`base/assetStore.js`(notify同步stringify→idle合并)、`base/taskStore.js`(progress高频notify→rAF/200ms)、`base/contentStore.js`(findPatternEntry调用处)、`base/conversationStore.js`(commit每变更全量stringify+notify→节流)、`base/projectStore.js`(persist同步stringify→批处理)
**收益**：高。**风险**：低。
- 注意点①：idle/防抖合并后，落盘略延后（≤几百 ms）——需确保组件卸载/页面 beforeunload 时 flush，否则极端刷新丢数据（App 已有类似通道可复用）。
- 注意点②：conversationStore 全文检索索引若每次 commit 重建，需与落盘节流解耦，别把搜索变慢。

### P9 · 图片懒加载
**收口文件**：`panels/AgentMessage.jsx`(附件缩略图)、`base/TopNav.jsx`(头像/webicon)、`base/AssetLibrary.jsx`、`base/GeneratedView.jsx`、`base/PromptLibrary.jsx`、`base/PromptHub.jsx`、`base/MaterialStrip.jsx`、`base/PromptInput.jsx`（background-image→`<img loading="lazy" decoding="async">` 或复用 `LazyImage`）
**收益**：高（素材多时首屏显著快）。**风险**：低。
- 注意点：background-image 改 `<img>` 后需保持现有 object-fit/宽高比样式；若容器靠背景图撑高，需补 aspect-ratio 或显式高度，避免布局跳变。

### P10 · 合成层
**收口文件**：`base/OverlayEditor.jsx`、`base/ImageZoomDialog.jsx`、`base/ResizeFullscreenHandle.jsx`、`base/FaceMosaicEditor.jsx`、`base/ImageEditor.jsx`、`nodes/VideoProcessNode.jsx`(裁剪手柄/时间轴/播放头 move期)
**收益**：中（配合 P3 体感更顺）。**风险**：低。
- 注意点：`will-change` 必须在拖拽结束移除，长期挂会占内存；`pointer-events:none` 只在拖拽遮罩层用，别误伤可点元素。

### P12 · IME 感知
**收口文件**（均加 `compositionstart/end` + `isComposing`）：`base/PromptLibrary.jsx`、`base/PromptHub.jsx`、`base/TaskCenter.jsx`、`base/SkillSettings.jsx`、`base/AccountsSettings.jsx`、`base/ProviderForm.jsx`、`base/ModelSection.jsx`、`base/ShortcutSettings.jsx`、`base/ImageEditor.jsx`、`base/NodeTitle.jsx`、`base/ProjectSelector.jsx`、`nodes/TextNode.jsx`、`PromptNode.jsx`、`TemplateNode.jsx`、`DiscountVideoNode.jsx`、`nodes/GridSplitNode.jsx`、`GridMergeNode.jsx`、`panels/PromptConfirmCard.jsx`
**收益**：中（中文输入体验更稳，少抖动）。**风险**：低。
- 注意点：对齐 AgentPanel 现有 `isComposingRef` 范式；compositionend 后需补触发一次 onChange/搜索，避免组字完成不提交。

### P15 · 列表稳定 key
**收口文件**：`panels/AgentPanel.jsx`(`messages.map((m,i)=><AgentMessage key={i}>` → 改 `m.id`)
**收益**：中。**风险**：低。
- 注意点：若 messages 存在无 id 的占位项，需保证 id 稳定唯一，否则改为 map 索引前先补 id，避免顺序错乱。

---

## 三、第二批（零风险原生收口）

### P5 · store selector / 原子 hook
**收口文件**：`base/conversationStore.js`(useConversationField)、`settings/providerStore.js`(useProvidersList)、`base/projectStore.js`(useCurrentProjectId)、`base/assetStore.js`(useAssets→原子)、`settings/accountsStore.js`(useAccounts→原子)、`base/appSettings.js`(useAppSettings→原子/selector)、`base/useScriptBoxEngine.js`(改useProvidersList)
**收益**：高。**风险**：低。
- 注意点①：selector 返回新对象需配浅比较（`useSyncExternalStore` 的 `isEqual`），否则无限重渲。
- 注意点②：原子 hook 拆分后要核对所有调用方，别漏掉仍依赖整包字段的地方。

### P6 · 常量提模块级
**收口文件**：`base/contentStore.js`(findPatternEntry循环内new RegExp→模块级Map)、`base/scriptBoxPrompts.js`(highlightNames正则缓存)、`base/agentCore.js`(DELETE_VERBS等Set/正则提级)、`base/useCanvasAgentTools.js`(cnMap+execute_plan正则缓存)
**收益**：中。**风险**：低。
- 注意点：正则若含动态插值（如 `${num}`），不能简单提常量，需改 Map 按 key 缓存实例。

### P7 · getNode(id) 替 getNodes().find
**收口文件**：`base/hooks.js`(useAutoSize)、`base/useScriptBoxEngine.js`(getData)、`base/useFitNodeRatio.js`、`base/useConnectedInputs.js`(N×N双层遍历→Map)、`base/scriptBoxEngine.js`(onConnectShots)、`base/canvasPlanExecutor.js`(L312单点取)、`nodes/Director3DNode.jsx`(双层遍历)、`nodes/PanoramaNode.jsx`(双层遍历)、`nodes/FaceMosaicNode.jsx`、`TextNode.jsx`、`PromptNode.jsx`、`GridSplitNode.jsx`、`GridMergeNode.jsx`、`VideoProcessNode.jsx`(spawn路径find)
**收益**：中（节点多时整理画布/连线计算明显）。**风险**：低。
- 注意点①：`getNode(id)` 取的是 React Flow 内部引用，若节点数据在 store 而非 RF state，需确认取数来源一致，别取到旧快照。
- 注意点②：双层遍历改 Map 时，注意 edges/nodes 增量更新后 Map 需重建或按 id 查，避免缓存过期。

### P8 · useMemo 缓存派生
**收口文件**：`base/GeneratingOverlay.jsx`、`base/TaskCenter.jsx`、`base/AssetLibrary.jsx`(loadMore Set)、`base/canvasPlanExecutor.js`(重复filter合并)、`base/hooks.js`(parseAspect正则)、`base/conversationStore.js`、`base/useAgentChat.js`(conversations全量深拷贝→useMemo)
**收益**：中。**风险**：低。
- 注意点：useMemo 依赖必须是稳定引用，若依赖每次新数组/对象会失效甚至更慢；conversationStore 内派生建议 commit 后缓存一份而非每次 getSnapshot 重算。

### P11 · 批量写合并
**收口文件**：`base/useCanvasAgentTools.js`(batchCreateNodesTool/batchConnectNodesTool/execute 循环内逐条addNodes/setEdges→合并一次)、`base/canvasPlanExecutor.js`(已合并，复核)、`base/assetStore.js`/`taskStore.js`(已合并，复核)
**收益**：高（批量生图/拖入体感明显）。**风险**：低。
- 注意点：合并后单次 setNodes 若节点极多仍可能卡，必要时分批（每批 ≤50 个）用 rAF 切帧，避免长任务阻塞。

### P16 · 防抖/深拷贝集中复用
**收口文件**：`base/PromptHub.jsx`(手写setTimeout防抖→utils.debounce)、其余业务侧手写防抖一并改 `utils.debounce`/`utils.deepClone`
**收益**：低（维护性收益为主）。**风险**：低。
- 注意点：`utils.debounce` 默认是否带 `immediate`/取消方法需核对，替换时保持原行为（尤其 PromptHub 的 200ms 节奏）。

---

## 四、第三批（结构性优化，单独验证）

### P13 · 长列表虚拟滚动/视口裁剪
**收口文件**：`base/AssetLibrary.jsx`(素材网格)、`base/GeneratedView.jsx`(结果网格)、`base/TaskCenter.jsx`(任务列表)、`base/PromptHub.jsx`/`PromptLibrary.jsx`(提示词超长列表)、`panels/AgentPanel.jsx`(消息流)
**改法**：`react-window` 或 IntersectionObserver 哨兵替当前 `visibleCount` 假分页
**收益**：高（素材/任务超长列表滚动明显）。**风险**：中。
- 注意点①：虚拟滚动会改变滚动容器与 measure 逻辑，需处理不定高项（如消息气泡）的 estimateSize，避免跳滚。
- 注意点②：与 P9 懒加载、P1 memo 可能冲突，需确认只保留一层优化；AgentPanel 消息流若带流式更新，虚拟列表需支持动态追加。
- 注意点③：改动面较大，单独批次验证，不混入第一批。

### P14 · CSS contain 隔离
**收口文件**：`nodes/*.jsx`(节点外壳加 `contain: layout style paint`)、长列表项加 `content-visibility: auto`
**收益**：中。**风险**：低。
- 注意点：`content-visibility:auto` 会让元素初始不渲染（影响首屏高度测量/IntersectionObserver），需配 `contain-intrinsic-size` 给预估高，否则滚动条跳动。

---

## 四、测试策略（动手前的安全网，对齐 CLAUDE.md §3.0）

> 原则：**不用先写一堆测试再改**，但需先确认现有门禁基线绿，并对"易回归的高风险纯逻辑项"补测试锚点。CLAUDE.md 规定"纯逻辑层（store/api/工具/引擎）是测试主战场，逻辑边写边锁；组件只补关键交互 + 防崩"。

### 4.1 现有门禁（已齐备，直接复用，无需自建）
- `npm run test:smoke` — 冒烟质量门（极快，每次改动必跑：查契约漂移 / React 单实例 / chunk 完整性）
- `npm run test:unit` — vitest 全量单测（`tests/unit/` 下 24 文件 / 244 用例；`.jsx` 自动 jsdom + `@testing-library/react`）
- `npm run test:regression` — 节点注册表 + 脚本盒引擎回归
- `npm run test:tools` — 画布 Agent 工具验证
- `npm run type-check` — tsc 类型检查（pre-commit 钩子自动跑）
- `npm test` = smoke + unit + regression + tools 四件套一次跑完
- 测试写位置：`tests/unit/**/*.test.{js,jsx}`，`@` 别名已指向 `./src`

### 4.2 动手前必做：确认基线绿
- 第一步先跑 `npm run test:unit` + `npm run test:smoke`，**确认当前门禁是绿的**，作为回归基线。改动后再跑应有 ≥ 原用例数通过。

### 4.3 需先补测试锚点的高风险纯逻辑项（按 ROI 排序）
| 收口项 | 抽出的可测纯逻辑 | 测试断言要点 | 优先级 |
|--------|-----------------|-------------|--------|
| **P2/P12 防抖+IME** | `utils.debounce`（已存在 `utils.js`）的"输入→提交"语义；IME `isComposing` 判断 | ① 连续输入 200ms 内只提交 1 次；② `compositionstart`~`compositionend` 期间不提交；③ `compositionend` 后补提交 1 次 | **最高**（最易回归） |
| **P4 落盘节流** | `assetStore`/`taskStore`/`conversationStore` 的 persist 节流（抽成可独立调用的 `flushPersist`/`schedulePersist`） | ① 高频 notify 在 idle/防抖窗口内只落盘 1 次；② 窗口内多次变更合并为最终态；③ `flush()` 可强制立即落盘（供 beforeunload 用） | 高 |
| **P5 store selector** | zustand selector 浅比较（`useSyncExternalStore` 的 `isEqual`） | ① 无关字段变更不触发订阅组件重渲染；② 返回新对象时浅比较防无限重渲 | 中 |

> 上述 3 项建议各 1 个单测文件（约 30~50 行/文件），组件类（P1 memo / P9 懒加载 / P10 合成层 / P15 key）按 CLAUDE.md"组件只补关键交互"，**不先写大量单测**，改完由现有 `test:smoke` + `test:unit` 兜住。

### 4.4 每批结束验证组合
- **批次 1**：`npm run test:smoke` → `npm run test:unit` → 手测画布拖拽/缩放/批量生图/中文输入搜索
- **批次 2**：`npm run test:smoke` → `npm run test:unit` → `npm run type-check`
- **批次 3**：上面 + 长列表滚动手测 + 性能对比（virtual list 不定高跳滚风险，单独验证）
- 提交前：`npm test`（四件套）+ `npm run build`

---

## 五、实施计划（无遗漏一次性执行）

> 按批次顺序，每批内按"子系统"拆 commit（CLAUDE.md 最小差异准则）。每批结束跑 `npm run type-check` + `npx vitest run` 门禁。

### 批次 1（第一批：P1+P2+P3+P4+P9+P10+P12+P15）
1. **P1 memo**：先 nodes/*.jsx(17) + edges/*(3) + NodeShell/NodeTitle，再 panels/* + base/* 卡片/列表
2. **P15**：AgentPanel `key={i}`→`m.id`（与 P1 同文件）
3. **P3 rAF**：OverlayEditor/ImageZoomDialog/ResizeFullscreenHandle/ImageEditor/FaceMosaicEditor + CustomHandle + GridSplit/VideoProcess + App.onViewportChange
4. **P10 合成层**：同上拖拽组件（与 P3 同改）
5. **P2 防抖**：PromptLibrary/TaskCenter/SkillSettings 搜索 + 节点提示词(PromptInput/TextNode等) + settings 大表单拆 memo
6. **P12 IME**：上述所有输入文件加 composition 判断（与 P2 同文件）
7. **P9 懒加载**：AgentMessage/TopNav/AssetLibrary/GeneratedView/PromptLibrary/PromptHub/MaterialStrip/PromptInput
8. **P4 落盘节流**：assetStore/taskStore/contentStore/conversationStore/projectStore
> 验证：type-check + vitest + 手测画布拖拽/缩放/批量生图/中文输入搜索

### 批次 2（第二批：P5+P6+P7+P8+P11+P16）
9. **P7 getNode(id)**：先 base/hooks/useScriptBox*/useConnectedInputs/scriptBoxEngine，再 nodes/Director3D/Panorama/各 spawn 路径
10. **P6 常量提级**：contentStore/agentCore/scriptBoxPrompts/useCanvasAgentTools
11. **P5 store selector**：conversationStore/providerStore/projectStore/assetStore/accountsStore/appSettings/useScriptBoxEngine
12. **P8 useMemo**：GeneratingOverlay/TaskCenter/AssetLibrary/canvasPlanExecutor/hooks/useAgentChat
13. **P11 批量写**：useCanvasAgentTools 三处批量工具合并
14. **P16 复用 utils**：PromptHub 手写防抖改 utils.debounce
> 验证：type-check + vitest

### 批次 3（第三批：P13+P14，结构性）
15. **P13 虚拟滚动**：AssetLibrary/GeneratedView/TaskCenter/PromptHub/PromptLibrary/AgentPanel
16. **P14 CSS contain**：nodes/*.jsx + 长列表项
> 验证：type-check + vitest + 长列表滚动手测 + 性能对比

---

## 六、已做对的基准（勿回退）
- `PromptHub.jsx`：HubCard 已 memo + 200ms 防抖 + 分页（P1/P2/P9 范式来源，但手写防抖需改 P16）
- `lod.jsx`：level 切换已 rAF 合并
- `OverlayEditor.jsx`：涂抹分支已 rAF 合并
- `AgentPanel.jsx`：`isComposing` 范式来源（P12 对齐目标）、宽度拖拽待补 rAF
- `utils.js`：已集中 `debounce/throttle/deepClone`（P16 复用目标）
- `App.jsx`：节点提示词 autoSave 已 600ms 防抖（P4 落盘节流通道）

---

## 七、探索产物说明
- 本任务为探索类，**未修改任何源码**，仅产出此清单 + 实施计划
- 三轮共 18 次 AI 并行探索，覆盖画布/面板/手势/存储/输入/工具六大高频子系统 × 3 轮核对
- 所有收口项均为"小改动、高 ROI、几乎不损质量、UI 零变化"
- 原始素材：`TASK-067-探索-高频路径原生能力高ROI性能优化缺口.md`
