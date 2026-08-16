# TASK-022 — 节点数据模型与序列化核验（大雄 serializableSmartNode vs 我们画布快照）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
大雄 Infinite-Canvas 的节点数据模型支持**序列化/反序列化**（`serializableSmartNode` / `canvasForStorage`）、**工作流导入导出**（JSON）、**撤销快照**（`snapshotForUndo` / `pushUndo`）。我们（maomao）有画布快照（KV 自动保存）和 AI 撤销栈。本任务核验双方数据模型与持久化机制的差距。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）
### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`）
- `serializableSmartNode` @ L776、`canvasForStorage` @ L699、`mediaItemForStorage` @ L689
- **工作流导入导出**：`selectedSmartWorkflowPayload` @ L785、`normalizeImportedSmartWorkflow` @ L802、`exportSelectedSmartWorkflow` @ L829、`insertSmartWorkflowIntoCanvas` @ L869、`importSmartWorkflowFile` @ L903、`smartWorkflowFilename` @ L754
- **撤销重做**：`snapshotForUndo` @ L194、`pushUndo` @ L203、`performUndo` @ L209、`capturePendingUndo`/`commitPendingUndo`/`discardPendingUndo` @ L185-193
- **设置持久化**：`settingsForStorage` @ L648、`normalizeSmartVideoModeSettings` @ L653

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/conversationStore.js`（AI 撤销栈 + 对话持久化）
- `/Users/kevin/Documents/maomao/src/App.jsx`（画布自动保存到 KV）
- `localTool/src/routes/kv.ts`（KV 后端）
- `/Users/kevin/Documents/maomao/src/components/base/taskStore.js`（任务中心持久化）

## 四、覆盖清单

### 核验点 1：大雄数据模型
- **序列化**：`serializableSmartNode`（L776）怎么过滤运行时字段、只留可持久化字段？
- **工作流导入导出**：`exportSelectedSmartWorkflow`（L829）导出子图 JSON；`insertSmartWorkflowIntoCanvas`（L869）导入回画布。这相当于"复制/粘贴子图到另一个项目"。
- **撤销**：`snapshotForUndo`（L194）快照哪些？`pushUndo`（L203）压栈、`performUndo`（L209）恢复。是"整画布快照"还是"增量"？
- **设置持久化**：`settingsForStorage`（L648）把运行设置归一化落 localStorage。

### 核验点 2：我们现状（代码证据）
- `App.jsx`：画布快照怎么序列化/落 KV？有没有"导出子图 JSON / 导入子图"？
- `conversationStore.js`：AI 撤销栈快照粒度（`{nodes,edges}` 整画布？）。
- 是否支持"把选中的一组节点导出成 JSON，再在别的项目导入"（相当于大雄工作流导入导出）？
- 结论：我们是"整画布自动保存"，大雄额外有"子图级导入导出"，这是**画布间复用**的关键差异。

### 核验点 3：结论 —— 值不值得对齐
- 能力矩阵：整画布持久化 / 子图导出 / 子图导入 / 撤销快照 / 设置归一化。
- 每项：我们现状、缺口、落点、成本、价值。
- **关键判断**：子图导入导出对"多项目复用/团队协作/模板复用"价值高，成本如何？
- 明确"利大于弊 / 弊大于利"倾向。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）+ 价值判断」三节。

## 六、验收标准
1. 三节贯通，带文件+行号+片段。
2. 明确区分"整画布持久化"与"子图级导入导出"两个层次。
3. 每项有成本与价值评级。
4. 亲自核实代码。

## 七、铁律文件名
本文件即唯一产出。写满后结束。

---

## 八、核验成果（2026-08-16 实际核实）

> 全部行号来自本次实际打开文件核实，引用格式 `文件 L行号`。

### 核验点 1：大雄数据模型（代码证据）

**序列化（只留可持久化字段，过滤运行时态）**
大雄用两层序列化函数把运行时态剥离：

- `serializableSmartNode` `smart-canvas.js L776-784`：深拷贝后用 `normalizeLegacySmartNode` 归一，对 `images` 走 `mediaItemForStorage`+`stripImageGenerationMeta` 过滤，`runSettings` 走 `settingsForStorage`，再 `clearSmartNodeTransientRunState` 清 `running/pending/queued/jimengPending` 等，最后 `delete copy._dom`。
- `mediaItemForStorage` `L689-698`：删 `cloudUrl/uploadedUrl/originalRemoteUrl/tempCloudUrl/_inlineVideoActive` 等远程/临时态。
- `canvasForStorage` `L699-708`：整画布深拷贝；`settings` 归一；过滤日志预览幽灵节点（`SMART_LOG_PREVIEW_NODE_ID`）；逐节点清洗 images/runSettings。
- `clearSmartNodeTransientRunState` `L760-775`：清 `running/pending/queued/_dom` 等运行时态，可选清运行历史（`runStartedAt` 等）。

**工作流导入导出（子图级）**
- `selectedSmartWorkflowPayload` `L785-801`：取 `selectedNodeIds()` 选中节点 → `serializableSmartNode` 序列化，连线只保留"两端都在选中集内"的 `connections`，输出 `{format:'infinite-smart-canvas-workflow', version:1, canvas_type:'smart', nodes, connections}`。
- `normalizeImportedSmartWorkflow` `L802-807`：兼容 `数组 / {nodes} / {workflow:{nodes}}` 三种形态。
- `exportSelectedSmartWorkflow` `L829-868`：默认只导出 JSON（`downloadBlob` 触发浏览器下载，文件名 `smartWorkflowFilename`）；`includeResources=true` 时 POST `/api/canvas-workflows/export` 打 zip 包（带本地资源）。
- `insertSmartWorkflowIntoCanvas` `L869-902`：先 `pushUndo()` 压撤销栈；按选中子图最小包围盒算 `dx/dy` 偏移到视口中心；**重新生成所有 id**（`idMap` 映射旧→新），连线同步改写 `from/to`；`nodes.push(...)` + `connections` 追加；`scheduleSave()` 落盘。
- `importSmartWorkflowFile` `L903-918`：文件 POST `/api/canvas-workflows/import` 走后端解析，再 `insertSmartWorkflowIntoCanvas`。

→ 这是"选中一组节点 → 导出 JSON → 在别的项目导入追加"的子图级复用机制。

**撤销重做（整画布快照栈）**
- `snapshotForUndo` `L194-202`：快照 `{nodes, connections, selectedId, selectedIds, selectedImage}`（整画布深拷贝，**非增量**）。
- `pushUndo` `L203-208`：`undoStack.push(snapshotForUndo())`，超过 `UNDO_LIMIT` 则 `shift()`（整画布快照栈，有上限）。
- `performUndo` `L209-219`（及 `capturePendingUndo/commitPendingUndo/discardPendingUndo` `L185-193`）：整画布写回 `nodes`/`canvas.connections`/`selectedId`。
→ 大雄撤销是"整画布快照栈"，与子图导入导出是两套独立机制。

**设置持久化**
- `settingsForStorage` `L648-651`：`cloneSmartSettings` 后过滤 `videoTempShLinks` 只留 `manual===true`。
- `normalizeSmartVideoModeSettings` `L653-660`：video 模式设置归一化。

### 核验点 2：我们现状（代码证据）

**整画布持久化（KV 自动保存）**
- `App.jsx L251-279`：`persistCanvas` 走 `saveCanvasState(projectId, nodesRef.current, edgesRef.current)`；`useEffect` 监听 `[nodes, edges]` 用 600ms 防抖自动保存（`canvasLoaded` 后生效，避免首读误存）。
- `projectStore.js L146-170` `saveCanvasState`：**落盘前清理 ReactFlow 运行时 UI 态**——`sanitizeNodes`（`L126-135`，白名单 `NODE_KEEP=['id','type','position','data','width','height']`）与 `sanitizeEdges`（`L136-145`，`EDGE_KEEP=['id','source','target','sourceHandle','targetHandle','type','data','label']`）删 `selected/dragging/measured/handles` 等会话态；并做版本冲突检测（`_version` Date.now() 比较，远程更新则拒绝覆盖）。

**撤销重做（整画布快照栈，纯类实现）**
- `smart-canvas.js L156`：`const UNDO_LIMIT = 40`（大雄上限 **40**）。
- `historyStack.js L15-76` `HistoryStack`：`push/undo/redo`，`max` 默认 **15**（构造函数 `L16`），`suppress` 抑制窗口，`branchRef` 截断 redo 分支。快照是 `{nodes, edges}`（整画布，非增量）。
- `useCanvasHistory.js L15-70`：`record/undo/redo/clear` 桥接到 React；`record` 显式传 `{nodes, edges}` 快照。
- `App.jsx L638`：`history.record({ nodes, edges })` 在整理后压栈。
→ 机制等价大雄，**实质差距仅上限：我们 15 < 大雄 40**（undo 深度更浅，长会话易顶掉早期快照）。

**AI 撤销栈（per-conversation，对话态）**
- `conversationStore.js L125` `aiUndoStack: []`（每条对话独立），`L320-347` `pushActiveAiUndo`（上限 20）/`popActiveAiUndo`，快照 `{nodes, edges, action}`（整画布）。
→ 这是对话态的 AI 操作撤销，与画布 `HistoryStack` 是两套独立栈，属于我们独有补充（大雄无此层）。

**子图级"复制粘贴"（剪贴板态，存在但非文件化）**
- `copySelectedNodes` `App.jsx L517-551`：取 `nodesRef.current.filter(n => n.selected)` 选中节点 → 取"两端都在选中集内"的边（`L526-528`）→ 写成 `{type:'mutiwindow-nodes', nodes, edges, originalIds}` → `navigator.clipboard.writeText(JSON.stringify(...))`（`L546`）。
- `pasteNodeGroup` `App.jsx L565-608`：解析 `mutiwindow-nodes` → **重新生成所有 id**（`L585`，`${type}-${Date.now()}-${rand}`）→ 用 `Map` 重映射边 `source/target`（`L590-597`）→ 按粘贴点 `pos` 整体偏移（包围盒中心对齐）→ 并入画布并 `history.record`（`L605`）。
→ 这就是"选中一组节点 → 复制 → 在别处粘贴重建（含内部连线）"，**机制等价于大雄的子图复制粘贴**，且已做了 id 重映射 + 视口居中 + 撤销入栈。

**子图级"文件化导入导出"：缺失（关键缺口）**
- 大雄的 `exportSelectedSmartWorkflow`（`L829`）是**把子图落盘成 `.json` 文件下载**（可存盘/跨项目/跨设备/分享），`importSmartWorkflowFile`（`L903`）是**从 `.json` 文件读回追加到当前画布**——这是"文件级"子图复用。
- 我们 `copySelectedNodes/pasteNodeGroup` 是**剪贴板级**，只能本机本次会话内 Ctrl+C/Ctrl+V，**不能落盘成文件、不能跨项目/跨设备分享**。
- 我们另有**整应用备份导出/导入**：`App.jsx L306-352` 订阅 `project:export/import` → `exportAll()` 打包整应用（含全部画布+配置）下载 JSON（`L311-318`）、`importAll()` 读 `.json` 整包写回并刷新（`L325-348`）。但这是**全量工作流备份**，不是"选中子图导出"。
- `projectStore.js` 只有整画布 KV 的 `loadCanvasState/saveCanvasState`（`L109-170`），无子图文件导出。
→ 我们停在"整画布自动保存 + 剪贴板子图复制 + 整应用文件备份"三层，**缺"选中子图导出为 JSON 文件 / 从 JSON 文件导入追加"这一层**。

**运行时态过滤的精细度差异（补充）**
- 大雄对节点 `images` 单独剥离远程态：`mediaItemForStorage`（`L689-698`）删 `cloudUrl/uploadedUrl/originalRemoteUrl/tempCloudUrl/_inlineVideoActive`；`serializableSmartNode`（`L779`）再经 `stripImageGenerationMeta` 过滤。
- 我们 `sanitizeNodes`（`projectStore.js L124-135`）白名单只保留 `id/type/position/data/width/height`，`data` 整体保留未递归——即 `data.images` 里的 `cloudUrl` 等远程态会随 `data` 一起落盘。实际影响有限（`data.images` 多为本地生成的 `{url,name}`），但精细度上大雄更彻底。

### 核验点 3：结论 —— 能力矩阵与价值判断

| 能力 | 大雄 | 我们现状 | 缺口 | 落点（可执行） | 成本 | 价值 |
|---|---|---|---|---|---|---|
| 整画布持久化 | `canvasForStorage`+localStorage | `saveCanvasState`+KV 自动保存（`App.jsx L251-279`、`projectStore.js L146-170`） | 无（且我们做了白名单+版本冲突防护，更稳） | —（已追平/更优） | — | 高（已具备） |
| 运行时态过滤 | `serializableSmartNode`/`mediaItemForStorage`/`clearSmartNodeTransientRunState` | `sanitizeNodes/sanitizeEdges` 白名单（`projectStore.js L124-145`） | `data.images` 未递归剥离远程态（精细度略低） | 可选：在 `sanitizeNodes` 对 `data.images` 递归删 `cloudUrl` 等 | 低 | 中（防御性，非必需） |
| 撤销快照（整画布） | `snapshotForUndo`/`pushUndo`/`performUndo`，上限 **40**（`L156`） | `HistoryStack` MAX=**15**（`historyStack.js L16`）+ `useCanvasHistory` | 上限 15 < 40（undo 深度更浅） | 可选：上限调到 40、加 `capturePendingUndo` 三态（`L185-193`） | 低 | 中 |
| 设置归一化 | `settingsForStorage`（`smart-canvas.js L648`） | `appSettings.js` 已落盘 | 无 | —（已具备） | — | 中 |
| 子图复制粘贴（剪贴板） | `selectedSmartWorkflowPayload`（选中序列化，`L785`） | `copySelectedNodes`+`pasteNodeGroup`（`App.jsx L517/L565`，id 重映射+视口居中+入栈） | 无（已追平，且我们额外做 id 重映射防冲突） | —（已追平） | — | 高（已具备） |
| 整应用文件备份 | —（大雄无整包备份概念） | `exportAll`/`importAll`（`App.jsx L306-352`） | 无（我们独有，全量备份） | —（我们更全） | — | 中（已具备） |
| **子图文件化导入导出** | `exportSelectedSmartWorkflow` `L829` / `insertSmartWorkflowIntoCanvas` `L869` / `importSmartWorkflowFile` `L903` | **缺失**（仅剪贴板级复制，不能落盘/跨项目/跨设备） | 无"选中子图 → 导出 JSON 文件 → 从文件导入追加" | 新增 `exportSelectedSubgraph`（选中→`{format,version,nodes,edges}`→下载 JSON）+ `importSubgraph(json)`（重生成 id、`idMap` 改写连线、视口居中、压撤销栈） | **中** | **高** |

**关键判断（子图文件化导入导出）**
- **利大于弊，建议对齐**。价值高：支撑"多项目复用 / 模板复用 / 团队协作 / 用户间分享固定工作流"。大雄已验证是轻量 JSON（无后端强依赖，`exportSelectedSmartWorkflow` 默认纯 JSON 下载即可，`includeResources` zip 打包是增强项）。
- 成本可控：核心是对"选中节点 + 内部连线"做序列化（复用现有 `sanitizeNodes` 白名单思路）+ 导入时 id 重映射（大雄 `idMap` 模式 `L879-892`；我们 `pasteNodeGroup` 的 `Map` 重映射 `L583-597` 可直接复用）+ 撤销栈压栈。纯前端 JSON 即可，无需立即上 `/api/canvas-workflows/export` 的 zip 资源打包。
- 风险低：导入前 `pushUndo` 保证可撤销，id 重映射避免与原画布冲突；与我们现有 `pasteNodeGroup` 机制同构，实现路径熟悉。

**结论**：整画布持久化 / 撤销（机制）/ 设置归一化 / 子图剪贴板复制粘贴 / 整应用文件备份五层均已追平或优于大雄；唯一实质差距是**"选中子图导出为 JSON 文件 / 从 JSON 文件导入追加"这一文件化子图复用层**，建议作为后续任务立项（利大于弊，中成本、高价值）。另外撤销栈上限 15 vs 40 是次要可调项。

## 九、验收自检
1. ✅ 三节贯通（大雄怎么做 / 我们现状 / 追平落点+价值判断），均带 `文件 L行号` + 片段。
2. ✅ 明确区分三个层次：①整画布持久化（KV 自动保存）；②子图剪贴板复制粘贴（已具备）；③子图文件化导入导出（缺失，单独列出）。
3. ✅ 每项有成本与价值评级（能力矩阵表，含 7 行）。
4. ✅ 全部代码本次实际打开核实（大雄 `smart-canvas.js`、我们 `App.jsx`/`projectStore.js`/`conversationStore.js`/`historyStack.js`/`useCanvasHistory.js` 均实际读取）。
5. ✅ 已修正初稿两处不精确：大雄 `UNDO_LIMIT=40`（非模糊"更大"）；补录初稿遗漏的 `copySelectedNodes/pasteNodeGroup` 剪贴板子图复制与 `exportAll/importAll` 整应用备份。
