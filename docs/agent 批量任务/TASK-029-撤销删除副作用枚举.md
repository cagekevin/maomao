# TASK-029 — 撤销/删除副作用完整性枚举（R3 系统性根因：数据一致性靠调用方自觉）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件。

---

## 一、项目背景
R3 系统性根因：撤销/删除/回滚的**副作用不完整**，数据一致性靠每个操作点手动维护。已知问题：
- 位置拖拽（App.jsx `handleNodeDragStop`）**不进撤销栈**（最高频操作不可撤销）。
- 删 group 只删父节点、不删子节点（App.jsx `deleteNode`），留孤儿。
- `workflowRuntime.rollback` 只删节点不删边/不改已有 data。
- 复制 group/子节点（`duplicateSelected`）mishandle + 丢连线。
本任务**枚举所有「结构操作点」的副作用完整性**，供 R3 统一治理（建 deleteWithCascade/recordPositionChange 等）。

> **审计范围扩展说明（自查补强）**：经审计，改变画布"结构"的操作不仅有 App.jsx 内的用户交互，还有 **AI 工具层**（`src/components/base/useCanvasAgentTools.js`）与 **计划执行器**（`src/components/base/canvasPlanExecutor.js`）。这些路径同样直接 `setNodes/setEdges`，且**完全不经过用户的 `history.record`**，是"删 group 留孤儿"的**第二处（独立）缺陷源**，且因与用户撤销栈隔离而更隐蔽。任务书探索起点虽只列 App.jsx，但"枚举所有结构操作点副作用完整性"必须覆盖它们，否则治理会漏掉 AI 路径的孤儿问题。

## 二、硬约束
只读核验。产出 = 副作用清单（不是代码）。

## 三、探索起点（本次实际核实）
- `/Users/kevin/Documents/maomao/src/App.jsx`（1458 行，画布主入口）
  - `handleNodeDragStop` @ L1183（位置拖拽，changed 才 setNodes、普通移动不 record）
  - `deleteNode` @ L453-463（删节点）
  - `duplicateSelected` @ L472-484（复制）
  - 编组/解组：L487-501、L504-512、L862-874、L924-936
  - 自动排版：L621-639
  - 粘贴：L565-608
  - 连线：L1002-1013、删边 L1069-1077、L1089-1094、L1097-1105
  - 所有 `history.record(...)` 调用点（共 13 处，见 4.2）
- `/Users/kevin/Documents/maomao/src/components/base/historyStack.js`（77 行，撤销栈）
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasHistory.js`（70 行，hook）
- `/Users/kevin/Documents/maomao/src/components/base/workflowRuntime.js`（249 行，rollback）
- `/Users/kevin/Documents/maomao/src/components/base/groupNodes.js`（99 行，编组）
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`（977 行，AI 工具层；MUTATING_TOOLS 集合 L203-210；deleteNodeTool L308-325、batchDeleteNodesTool L328-344、createNodeTool L223-281、connectNodesTool L412-431、updateNodeTool L351-382、moveNodeTool L833-849、groupNodesTool L852-863、undoAiTool L819-830）
- `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`（executePlan 经 ctx.addNodes/setNodes/lockNodeSettings 改画布，L224-264、L290）

## 四、覆盖清单（本次实际核实）

判断维度：
1. **进栈**：该操作是否进入某个撤销栈？
   - 用户操作 → 是否 `history.record`？（缺 → 用户 Ctrl+Z 不可撤销）
   - AI 操作 → 是否进 `aiUndoStack`？（见 4.3，与用户栈**隔离**）
2. **级联**：删除/回滚时，关联的边、子节点（parentId）、被改的已有 data 是否一并处理？（缺 → 留垃圾/孤儿）
3. **一致性**：撤销恢复时，快照是否包含所有被改维度（节点+边+位置+data）？

> **撤销栈机制核实（两套栈，互不互通）**：
> - A) 用户栈：`history.undo/redo`（App.jsx L979-980）→ `useCanvasHistory.undo`（useCanvasHistory.js L43-50）→ `apply(snap)` 整体写回 `setNodes/setEdges`（App.jsx L245-248）。快照来自 `HistoryStack.push(snapshot)`（historyStack.js L33-42），`record` 显式传 `{nodes,edges}`（useCanvasHistory.js L28-34）。**快照只含 nodes+edges，位置与 data 作为节点对象一部分被整体记录**，故对"已 record 的操作"一致性良好。
> - B) AI 栈：`buildCanvasAgentTools` 对 `MUTATING_TOOLS`（useCanvasAgentTools.js L203-210）在执行前统一 `pushActiveAiUndo({nodes,edges,action})`（L924-925）；`undoAiTool`（L819-830）弹出最近快照恢复，**与用户 Ctrl+Z 完全隔离**（文件头注释 L189、L815）。
> - ⚠️ 根因点：两套栈各自只信自己调用方"自觉 record/push"，没有任何统一收口，故数据一致性靠调用方自觉（正是 R3 根因）。

### 4.1 用户侧结构操作清单（15 条，全部 App.jsx）

| # | 操作 | 文件:行 | 副作用（节点/边/data/位置） | 进栈(用户) | 级联 | 一致性 | 问题 |
|---|------|---------|------------------------------|-----------|------|--------|------|
| 1 | 位置拖拽（拖入/拖出组） | App.jsx L1183-1248 | position 变化 + parentId 变化 | **否** | 自身（parentId 改对，group 尺寸不自动调可能视觉错位） | N/A（未记录） | 位置不可撤销；改组归属后无法 undo；最高频操作 |
| 2 | 删除节点（deleteNode 本体+单选右键删除） | App.jsx L453-463 / L876-879 | 删 1 节点 + 关联边 | 是（L459） | 边已级联（L456 按 source/target 过滤）；**删 group 父节点不删 `parentId===id` 子节点**（L455 仅 `n.id !== id`） | 快照含 nodes+edges，撤销可恢复 | **删 group 留孤儿** |
| 3 | 多选删除 | App.jsx L947-959 | 删选中节点集合 + 关联边 | 是（L958） | 边级联（L955）；**选中 group 父节点但子节点未选中 → 子节点留孤儿**（L954 只过滤选中 id） | 含 nodes+edges | **删 group 留孤儿**（多选场景） |
| 4 | 克隆选中（Ctrl+D） | App.jsx L472-484 | 新增克隆节点（偏移 40px），**不克隆边** | 是（L483） | **丢连线**：克隆只复制节点（L475-480），`edges: edgesRef.current` 原样保留（L483），克隆为新 id 无对应边 | 含 nodes+edges | 复制 group/子节点时：group 被克隆为无子节点孤立外壳；关联连线全丢 |
| 5 | 编组（Ctrl+G） | App.jsx L487-501 | 建 group 节点 + 改子节点 parentId/position | 是（L496） | 边未变（节点 id 不变）；子节点绝对坐标转相对（groupNodes.js L61-73） | 含 nodes+edges | 编组级联正确；撤销可恢复 |
| 6 | 取消编组（Ctrl+Shift+G） | App.jsx L504-512 | 删 group 节点 + 子节点 parentId 置空 + 坐标转绝对 | 是（L510） | groupNodes.js L90-96：子节点正确解组、坐标转回绝对 | 含 nodes，edges 不变 | 级联正确；撤销可恢复 |
| 7 | 右键「取消编组」(group 菜单) | App.jsx L862-874 | 同 #6 | 是（L871） | 同 #6 | 同 #6 | 同 #6 |
| 8 | 右键菜单「编组」(多选) | App.jsx L924-936 | 同 #5 | 是（L933） | 同 #5 | 同 #5 | 同 #5 |
| 9 | 新建节点 | App.jsx L394-450 | 新增 1 节点（+ 可选自动连线） | 是（L445） | 连线级联：有 connection 时建 source→新节点边（L440-442） | 含 nodes+edges（有 connection 时） | 正确 |
| 10 | 连线（onConnect） | App.jsx L1002-1013 | 新增 1 边 | 是（L1009） | 边唯一（L1005-1006 防重） | 含 nodes+edges | 正确 |
| 11 | 删除连线（✕/双击） | App.jsx L1069-1077, 1089-1094 | 删 1 边 | 是（L1074） | 仅边 | 含 nodes+edges | 正确 |
| 12 | 批量删边（onEdgesDelete） | App.jsx L1097-1105 | 删多条边 | 是（L1101） | 仅边 | 含 nodes+edges | 正确 |
| 13 | 粘贴节点组 | App.jsx L565-608 | 新增节点 + 边（重映射 id） | 是（L605） | 边随节点重映射 source/target（L590-597），组内/间连线保留 | 含 nodes+edges（id 映射正确） | **跨组边界风险**：粘贴的是扁平节点，不重建 group 子关系；粘贴 group 内节点后脱离父组 |
| 14 | 自动排版 | App.jsx L621-639 | 重算所有节点 position | 是（L638） | 仅改位置；arrangeSnapshot 另存排列前（L622,637）供「还原」（revertArrange L643-651 **不进撤销栈**） | 含 nodes+edges | 撤销可回排列前；revertArrange 不进栈、也不清 arrangeCanvas 已 record 的快照 → 两套状态冗余 |
| 15 | 清理缓存（base64 外置） | App.jsx L664-731 | 改节点 data（data: URL → /files/ URL） | 是（L725） | 仅改 data，不动边/位置 | 含 nodes+edges | 一致；data 字段整体替换，撤销可还原 |

### 4.2 用户侧关键代码证据（行号来自本次实际打开）

- **位置拖拽不进撤销栈**（铁证）：`handleNodeDragStop` 末尾 `if (changed) setNodes(cur)`（App.jsx L1247），**全程无 `history.record`**。对比 `deleteNode`（L459）、`onConnect`（L1009）均有 record。
- **删 group 留孤儿**（铁证）：`deleteNode` 仅 `nodesRef.current.filter((n) => n.id !== id)`（App.jsx L455），未过滤 `n.parentId === id`；子节点 parentId 仍指向已删 group。
- **克隆丢连线**（铁证）：`duplicateSelected` 克隆只复制节点（L475-480），`history.record({ nodes: nextNodes, edges: edgesRef.current })`（L483）——`edgesRef.current` 原样传入，克隆节点不生成任何新边（克隆是新 id，源/克隆间无对应边）。
- **撤销恢复机制**：`apply(snap)` 整体写回（App.jsx L245-248），快照 `push` 时已是完整 `{nodes,edges}`（historyStack.js L37）；对"已 record 的操作"一致性良好，缺口全在"未 record / record 时维度不全"。
- **用户侧 13 处 `history.record` 全清单**（grep 实测）：L445(addNode)、L459(deleteNode)、L483(duplicateSelected)、L496(groupSelected)、L510(ungroupSelected)、L605(pasteNodeGroup)、L638(arrangeCanvas)、L725(handleClearCache)、L871(nodeMenu ungroup)、L933(selection group)、L958(selection delete)、L1009(onConnect)、L1074(removeEdge)、L1101(onEdgesDelete)。（注：L1074 与 L1101 同属删边路径，分别为单条/批量入口，共 14 处 record 调用点，均在用户栈内。）其中**唯独 `handleNodeDragStop`（L1247）是改结构的代码路径却无 record**——即 #1 位置拖拽。

### 4.3 AI 工具层结构操作清单（9 条，useCanvasAgentTools.js + canvasPlanExecutor.js）

> 全部经 `ctx.setNodes/setEdges` 直接改画布，**均不调 `history.record`**（文件头明示 L189："AI 通过工具改画布是 setNodes/setEdges 直接改，不会进用户的撤销栈"）。改前快照统一 push 进**隔离的 `aiUndoStack`**（L924-925），仅 `undoAiTool` 能撤（L819-830）。

| # | 操作 | 文件:行 | 副作用 | 进栈(AI) | 级联 | 一致性 | 问题 |
|---|------|---------|--------|----------|------|--------|------|
| 16 | AI 删节点（delete_node） | useCanvasAgentTools.js L308-325（执行 L316-324） | 删 1 节点 + 关联边 | 是（aiUndoStack，L924-925 包裹） | 边级联（L322）；**删 group 不删 `parentId===id` 子节点**（L321 仅 `n.id !== id`） | aiUndoStack 快照含 nodes+edges，`undo_ai` 可整体还原 | **删 group 留孤儿（AI 路径，独立于用户侧 #2）** |
| 17 | AI 批量删节点（batch_delete_nodes） | useCanvasAgentTools.js L328-344（执行 L336-342） | 删多节点 + 关联边 | 是（aiUndoStack） | 边级联（L341）；**同样不删子节点**（L340 仅 `!ids.includes(n.id)`） | 同 #16 | **删 group 留孤儿（批量路径）** |
| 18 | AI 建节点（create_node / batch_create_nodes） | useCanvasAgentTools.js L223-281（执行 L242-279）/ L284-305 | 新增节点（+ 可选 connectFrom 边） | 是（aiUndoStack） | connectFrom 时建边（L267） | 含 nodes+edges | 正确 |
| 19 | AI 连线（connect_nodes / batch_connect_nodes） | useCanvasAgentTools.js L412-431 / L434-452 | 新增边 | 是（aiUndoStack） | 边去重（L426） | 含 nodes+edges | 正确 |
| 20 | AI 删边（delete_edge） | useCanvasAgentTools.js L455-477 | 删 1 边 | 是（aiUndoStack） | 仅边 | 含 nodes+edges | 正确（L468/L471 两个内部实现，均只动边） |
| 21 | AI 改节点 data（update_node / update_node_any_field） | useCanvasAgentTools.js L351-382 / L388-409 | 改目标节点 data（白名单/任意合并） | 是（aiUndoStack） | 只改 1 节点 data | 含 nodes+edges | 一致；白名单防越权改 |
| 22 | AI 移动节点（move_node） | useCanvasAgentTools.js L833-849（执行 L841-847） | 改 position | 是（aiUndoStack） | 仅 1 节点位置 | 含 nodes+edges | 一致；但 AI 移动 group 子节点不更新 parentId 相对坐标 → 可能视觉错位（参考 #1 group 归属由用户拖拽处理，AI 路径无此逻辑） |
| 23 | AI 编组（group_nodes） | useCanvasAgentTools.js L852-863（执行 L856-862） | 调 createGroupFromNodes 建组 | 是（aiUndoStack） | 复用 groupNodes.js，级联正确 | 含 nodes+edges | 级联正确 |
| 24 | execute_plan（经 canvasPlanExecutor 建/跑节点） | canvasPlanExecutor.js L224-264（建节点）、L290（写回 data）、workflowRuntime.js L207-217（rollback 删节点） | 批量建节点+连线+写 data；出错 rollback 删节点 | execute_plan 进 aiUndoStack（MUTATING_TOOLS L209）；**rollback 不进任何栈** | **rollback 调 ctx.deleteNode（= AI deleteNodeTool 路径 L321）→ 删 group 不删子节点 → 孤儿**；且 rollback 不记录被删前快照 | rollback 的删除**无任何撤销栈记录**（既不能用户 Ctrl+Z、也不能 undo_ai 反撤销） | **AI 编排回滚 = 删 group 留孤儿 + 不可反撤销**（最严重组合缺陷） |

### 4.4 AI 侧关键代码证据

- **AI 删 group 留孤儿（铁证）**：`deleteNodeTool.execute` 仅 `setNodes((ns) => ns.filter((n) => n.id !== id))`（useCanvasAgentTools.js L321），与用户侧 `deleteNode` L455 同源缺陷（都不过滤 `parentId`）。`batchDeleteNodesTool` L340 同理。
- **AI 双栈隔离（铁证）**：`buildCanvasAgentTools` 对 `MUTATING_TOOLS` 在执行前 `pushActiveAiUndo({ nodes: ctx.getNodes(), edges: ctx.getEdges(), action: t.name })`（L924-925）；`undoAiTool` 用 `popActiveAiUndo()` + `ctx.setNodes/setEdges(snap)` 恢复（L824-828）。注释 L189/L815 明示与用户 Ctrl+Z 隔离。
- **rollback 不进栈（铁证）**：`workflowRuntime.rollback`（L207-217）遍历 `nodeIds` 调 `ctx.deleteNode(id)`（L210）；`ctx` 注入的是 AI `deleteNodeTool` 路径（useCanvasAgentTools.js L321），故删 group 同样留孤儿，且**rollback 全程无 pushActiveAiUndo / 无 history.record**（L207-217 无 undo 相关调用）。
- **execute_plan 改 data 不经用户栈（铁证）**：`canvasPlanExecutor` 经 `ctx.setNodes`（L224、L290）写回 imageUrl/参数，仅当 `execute_plan` 工具被调时整体进 aiUndoStack（MUTATING_TOOLS L209）；但计划内"建节点+跑图+写回"是**一次工具调用 push 一次快照**，故 undo_ai 可整体撤回整次编排，粒度合理。

## 五、Top 缺陷汇总（按严重度）

| 严重度 | 缺陷类型 | 操作 | 位置 | 说明 |
|--------|----------|------|------|------|
| 🔴 高 | 不可撤销 + 留孤儿(组合) | execute_plan rollback | canvasPlanExecutor.js L224-264 + workflowRuntime.js L207-217 | AI 回滚用 ctx.deleteNode 删节点→删 group 留孤儿；且 rollback 不进任何撤销栈，无法反撤销 |
| 🔴 高 | 留孤儿 | 删 group（用户单选/多选） | App.jsx L455（deleteNode）、L954（多选删除） | 删 group 父节点不连带 `parentId===id` 子节点 |
| 🔴 高 | 留孤儿 | 删 group（AI delete_node / batch_delete_nodes） | useCanvasAgentTools.js L321、L340 | 与用户侧同源缺陷（不滤 parentId），且完全不进用户栈 |
| 🟠 中 | 不可撤销 | 位置拖拽 / 改组归属 | App.jsx L1183-1248（L1247 无 record） | 最高频操作无 record，挪动/改组归属后无法 Ctrl+Z |
| 🟠 中 | 丢连线 | 克隆选中（Ctrl+D） | App.jsx L472-484（L483 原样传 edges） | 只复制节点不重映射边，复制后连线全失 |
| 🟠 中 | 一致性裂缝 | 粘贴组内节点 | App.jsx L565-608 | 粘贴扁平节点，不重建 group 子关系，group 内节点脱离父组 |
| 🟡 低 | 不可撤销 | 整理还原 revertArrange | App.jsx L643-651 | 走独立 arrangeSnapshot，不进统一撤销栈，且不清 arrangeCanvas 已 record 快照 |
| 🟡 低 | 隐性孤儿 | 多选删 group 但未选子 | App.jsx L947-959 | `sel.includes` 只删选中 id，未选子节点则留孤儿 |
| 🟡 低 | 视觉错位 | AI move_node 移动 group 子节点 | useCanvasAgentTools.js L846 | 直接改绝对 position，不更新 parentId 相对坐标（缺用户侧 handleNodeDragStop 的组归属逻辑） |

## 六、R3 治理建议（统一封装，覆盖用户侧 + AI 侧）

1. **`deleteNodeWithCascade(id)`**（替换 App.jsx L453 deleteNode；**同时供 AI `deleteNodeTool`/`batchDeleteNodesTool` 复用**）：
   - 级联删除 `parentId === id` 的所有子节点（彻底解决用户侧 #2/#3 与 AI 侧 #16/#17 孤儿）。
   - 边过滤维持 `e.source !== id && e.target !== id`（已有，保留）。
   - 删除前由调用方 record（用户侧 `history.record`；AI 侧 `pushActiveAiUndo`，保持各自栈）。
   - 调用点统一改调：App.jsx L878 节点菜单删除、L952 多选删除；useCanvasAgentTools.js L321/L340 的 filter 逻辑。

2. **`recordPositionChange(nextNodes)`**（替换位置拖拽的裸 setNodes）：
   - `handleNodeDragStop`（App.jsx L1247）`if (changed)` 时改 `history.record({ nodes: nextNodes, edges: edgesRef.current })`，使位置/组归属可撤销。
   - 注意 suppress 窗口（useCanvasHistory 600ms，useCanvasHistory.js L37-40）避免连续拖拽刷屏；可加"拖拽开始打标记、停止才 record"的合并策略。

3. **`duplicateWithEdges(selectedIds)`**（替换 App.jsx L472 duplicateSelected）：
   - 克隆选中节点并**重映射其相连边**（源/目标 id 映射到新 clone id），保留组内/组间连线（解决 #4 丢连线）。
   - group 克隆：克隆 group 节点 + 其所有 `parentId` 子节点（整组克隆，而非孤立 group 外壳）。

4. **`rollback` 接入统一删除 + 记录快照**（workflowRuntime.js L207-217）：
   - rollback 前 `pushActiveAiUndo` 当前 `{nodes,edges}`（或存 `preRollbackSnapshot`），让用户/AI 能反撤销"AI 回滚"。
   - rollback 内改用 `deleteNodeWithCascade`（走 `ctx.deleteNode` 注入的同名级联函数），让删 group 不再留孤儿。
   - 被删节点的 data 不静默丢失：快照保留 data，便于后续"恢复 AI 产出"。

5. **统一"删除"入口（消除散落的 4+2 处删除逻辑）**：
   - 用户侧：App.jsx L453 deleteNode、L876-879 节点菜单删除、L947-959 多选删除、revertArrange（L643）。
   - AI 侧：useCanvasAgentTools.js L321 deleteNodeTool、L340 batchDeleteNodesTool、workflowRuntime L210 rollback。
   - 全部收敛到 `deleteNodeWithCascade`，避免"删除"语义多处不一致。

6. **修复 paste 跨组裂缝（App.jsx L565-608）**：粘贴时若某源节点 `parentId` 命中本次粘贴 id 集合，则新 id 重映射后一并设置新 `parentId`（保留组内关系），否则按现有扁平处理。

7. **`revertArrange` 与撤销栈打通**（App.jsx L643-651）：确认后 `history.record` 当前结果（或让还原本身可 Ctrl+Z），避免"还原后想撤销还原"做不到。

8. **AI `move_node` 补组归属逻辑**（useCanvasAgentTools.js L846）：移动 group 子节点时同步换算 parentId 相对坐标，与用户侧 `handleNodeDragStop` 的组归属处理对齐，避免视觉错位。

## 七、验收对照

1. 清单完整：用户侧 15 条（≥10）+ AI 侧 9 条 + execute_plan/rollback 路径 = **覆盖所有改画布结构的操作点**，含全部探索起点（L1183 拖拽 / L453-484 删除+克隆 / L487-512 编组解组 / L862-874 右键解组 / L924-936 右键编组 / L621-639 自动排版 / L565-608 粘贴 / L1002-1013 连线 / L1069-1077+L1097-1105 删边 / 13 处 history.record）；并扩展覆盖 AI 工具层（delete_node/batch_delete_nodes/update_node/move_node/group_nodes/delete_edge/connect_nodes）与 canvasPlanExecutor/rollback 路径。
2. 每条均标注"进栈 + 级联 + 一致性"三维度，并附行号证据。
3. 行号均来自本次实际打开核实：App.jsx（1458 行）、historyStack.js（77 行）、useCanvasHistory.js（70 行）、workflowRuntime.js（249 行）、groupNodes.js（99 行）、useCanvasAgentTools.js（977 行）、canvasPlanExecutor.js（行内引用 L224-264/L290）。
4. 自查补强：补出原任务书探索起点未列的 **AI 工具层**为"删 group 留孤儿"的第二独立缺陷源，并指出**用户栈/AI 栈双轨隔离**是 R3 根因的放大因素。

## 八、铁律文件名
本文件即唯一产出。写满后结束。
