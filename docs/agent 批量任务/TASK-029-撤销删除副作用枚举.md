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
本任务**枚举 App.jsx 所有「结构操作点」的副作用完整性**，供 R3 统一治理（建 deleteWithCascade/recordPositionChange 等）。

## 二、硬约束
只读核验。产出 = 副作用清单（不是代码）。

## 三、探索起点（本次实际核实）
- `/Users/kevin/Documents/maomao/src/App.jsx`（1300+ 行，画布主入口）
  - `handleNodeDragStop` @ L1183（位置拖拽，`changed` 才 setNodes、普通移动不 record）
  - `deleteNode`（搜，约 L452-461，删节点）
  - `duplicateSelected`（约 L472-484，复制）
  - 编组/解组：L493-512、L868-873、L930-935
  - 自动排版：L621-639
  - 粘贴：L602-606
  - 连线：L1006-1009、删边 L1072-1074、L1098-1103
  - 所有 `history.record(...)` 调用点
- `/Users/kevin/Documents/maomao/src/components/base/historyStack.js`（77 行，撤销栈）
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasHistory.js`（70 行，hook）
- `/Users/kevin/Documents/maomao/src/components/base/workflowRuntime.js`（249 行，rollback）
- `/Users/kevin/Documents/maomao/src/components/base/groupNodes.js`（99 行，编组）

## 四、覆盖清单（本次实际核实）

判断维度：
1. **进栈**：该操作是否 `history.record`？（缺 → 不可撤销）
2. **级联**：删除/回滚时，关联的边、子节点（parentId）、被改的已有 data 是否一并处理？（缺 → 留垃圾/孤儿）
3. **一致性**：撤销恢复时，快照是否包含所有被改维度（节点+边+位置）？

> 撤销栈机制核实：撤销/重做均调用 `history.undo/redo`（App.jsx L979-980）→ `useCanvasHistory.undo`（useCanvasHistory.js L43-50）→ `apply(snap)` 把快照 `{nodes,edges}` 整体写回 `setNodes/setEdges`（App.jsx L245-248）。快照来自 `HistoryStack.push(snapshot)`（historyStack.js L33-42），`record` 显式传 `{nodes,edges}`（useCanvasHistory.js L28-34）。**关键：快照只含 `nodes` + `edges`，不含位置的"差异"，位置是节点对象的一部分被整体记录；data 也是节点对象的一部分被整体记录**——因此一致性取决于 record 时传入的快照是否完整覆盖被改维度。

### 4.1 结构操作清单（15 条）

| # | 操作 | 文件:行 | 副作用（节点/边/data/位置） | 进栈 | 级联 | 一致性 | 问题 |
|---|------|---------|------------------------------|------|------|--------|------|
| 1 | 位置拖拽（拖入/拖出组） | App.jsx L1183-1248 | position 变化 + parentId 变化 | **否** | 自身（parentId 改对，但 group 尺寸不自动调，可能视觉错位） | N/A（未记录） | 位置不可撤销；改组归属后无法 undo；最高频操作 |
| 2 | 删除节点（单选右键删除） | App.jsx L453-463 | 删 1 节点 + 关联边 | 是 | 边已级联（L456 按 source/target 过滤）；但若删的是 group 父节点，其**子节点不删**（L455 仅 `n.id !== id`） | 快照含 nodes+edges，撤销可恢复 | **删 group 留孤儿**：子节点仍在、parentId 指向已删的 group |
| 3 | 删除节点（节点菜单） | App.jsx L876-879 → 调 deleteNode | 同 #2 | 是（经 deleteNode L459） | 同 #2 | 同 #2 | 同 #2：删 group 留孤儿 |
| 4 | 多选删除 | App.jsx L947-959 | 删选中节点集合 + 关联边 | 是（L958 record） | 边级联（L955）；**若选中 group 父节点但子节点未选中 → 子节点留孤儿**（L954 只过滤选中 id） | 含 nodes+edges | **删 group 留孤儿**（多选场景同 #2） |
| 5 | 克隆选中（Ctrl+D） | App.jsx L472-484 | 新增克隆节点（偏移 40px），**不克隆边** | 是（L483 record） | **丢连线**：克隆只复制节点（L475-480），`edges: edgesRef.current` 原样保留（L483），克隆节点与源/其它节点之间无新边 | 含 nodes+edges | 复制 group/子节点时：克隆的是整个 group 节点（含 parentId 子关系？不——L473 只 `n.selected` 单节点，group 本身被克隆为无子节点的孤立 group）；关联连线全丢 |
| 6 | 编组（Ctrl+G） | App.jsx L487-501 | 建 group 节点 + 改子节点 parentId/position | 是（L496 record） | 边未变（节点 id 不变，边仍按 id 相连）；子节点绝对坐标转相对（groupNodes.js L61-73） | 含 nodes（含 group+子节点），edges 不变 | 编组本身级联正确；但撤销时 group 子节点 position 是相对坐标，恢复快照即可还原 |
| 7 | 取消编组（Ctrl+Shift+G） | App.jsx L504-512 | 删 group 节点 + 子节点 parentId 置空 + 坐标转绝对 | 是（L510 record） | groupNodes.js L90-96：子节点正确解组、坐标转回绝对 | 含 nodes，edges 不变 | 级联正确；撤销可恢复 |
| 8 | 右键「取消编组」(group 菜单) | App.jsx L862-874 | 同 #7 | 是（L871 record） | 同 #7 | 同 #7 | 同 #7 |
| 9 | 右键菜单「编组」(多选) | App.jsx L924-936 | 同 #6 | 是（L933 record） | 同 #6 | 同 #6 | 同 #6 |
| 10 | 新建节点 | App.jsx L394-450 | 新增 1 节点（+ 可选自动连线） | 是（L445 record） | 连线级联：有 connection 时建 source→新节点边（L440-442） | 含 nodes+edges（有 connection 时） | 正确 |
| 11 | 连线（onConnect） | App.jsx L1002-1013 | 新增 1 边 | 是（L1009 record） | 边唯一（L1005-1006 防重） | 含 nodes+edges | 正确 |
| 12 | 删除连线（✕/双击） | App.jsx L1069-1077, 1089-1094 | 删 1 边 | 是（L1074 record） | 仅边，不涉及节点 | 含 nodes+edges | 正确 |
| 13 | 批量删边（onEdgesDelete） | App.jsx L1097-1105 | 删多条边 | 是（L1101 record） | 仅边 | 含 nodes+edges | 正确 |
| 14 | 粘贴节点组 | App.jsx L565-608 | 新增节点 + 边（重映射 id） | 是（L605 record） | 边随节点重映射 source/target（L590-597），内部连线保留 | 含 nodes+edges（新 id 映射正确） | **跨组边界风险**：若粘贴组内某节点，新 id 不与任何 group 关联；原 group 子节点关系不保留（粘贴的是扁平节点） |
| 15 | 自动排版 | App.jsx L621-639 | 重算所有节点 position | 是（L638 record） | 仅改位置；arrangeSnapshot 另存排列前（L622,637）供「还原」（revertArrange L643-651，**不走撤销栈**） | 含 nodes+edges | 撤销可回排列前；但 revertArrange 不进撤销栈、也不清 arrangeCanvas 已 record 的快照 → 切两套状态略冗余 |

### 4.2 关键代码证据（行号来自本次实际打开）

- **位置拖拽不进撤销栈**（铁证）：`handleNodeDragStop` 末尾 `if (changed) setNodes(cur)`（App.jsx L1247），**全程无 `history.record` 调用**。对比其它操作如 `deleteNode`（L459）、`onConnect`（L1009）均有 record。
- **删 group 留孤儿**（铁证）：`deleteNode` 仅 `nodesRef.current.filter((n) => n.id !== id)`（App.jsx L455），未过滤 `n.parentId === id`；子节点 parentId 仍指向已删 group。
- **克隆丢连线**（铁证）：`duplicateSelected` 克隆只复制节点（L475-480），`history.record({ nodes: nextNodes, edges: edgesRef.current })`（L483）——`edgesRef.current` 原样传入，克隆节点不生成任何新边，源节点与克隆之间的边也不存在（克隆是新 id）。
- **workflowRuntime.rollback 只删节点不删边/不改 data**（铁证）：`rollback`（workflowRuntime.js L207-217）遍历 `nodeIds` 调 `ctx.deleteNode(id)`（L210），**未同步删除这些节点关联的边**，也**不改已有 data**；且 `deleteNode` 本身（App.jsx L456）会按 source/target 过滤边，但 rollback 用 `ctx.deleteNode` 逐个删——每删一个 `deleteNode` 会顺带清它的边，所以边会随节点被除（非遗漏）；真正缺口是：**rollback 不记撤销栈、不记录被删前的 data/边快照，无法"反撤销"恢复 AI 建的节点**。
- **撤销恢复机制**：`apply(snap)` 整体写回（App.jsx L245-248），快照 `push` 时已是完整 `{nodes,edges}`（historyStack.js L37），故对"已 record 的操作"，一致性良好；缺口全在"未 record / record 时维度不全"。

## 五、Top 缺陷汇总

| 缺陷类型 | 操作 | 位置 | 说明 |
|----------|------|------|------|
| **不可撤销** | 位置拖拽 / 改组归属 | App.jsx L1183-1248 | 最高频操作无 record，挪动节点或拖入/拖出组后无法 undo |
| **留孤儿** | 删 group（单选/多选删除） | App.jsx L455（deleteNode）、L954（多选删除） | 删 group 父节点不连带子节点，子节点 parentId 悬空 → 渲染孤儿 |
| **丢连线** | 克隆选中（Ctrl+D） | App.jsx L472-484 | 只复制节点不复制/重映射边，复制后连线全失 |
| **不可撤销** | 整理还原（revertArrange） | App.jsx L643-651 | 还原走独立 arrangeSnapshot，不进统一撤销栈，且不清 arrangeCanvas 已 record 的快照 |
| **不可反撤销** | workflowRuntime.rollback | workflowRuntime.js L207-217 | AI 回滚只删节点、不记撤销快照、不保存被删前 data/边，用户无法 undo 掉"AI 回滚" |
| **一致性裂缝** | 粘贴节点组（跨组） | App.jsx L565-608 | 粘贴的是扁平节点，不重建 group 子关系；若源含 group 内节点，粘贴后脱离父组 |
| **隐性孤儿** | 多选删除选中 group 但未选子 | App.jsx L947-959 | `sel.includes` 只删选中 id，group 子节点若未选中则留孤儿 |

## 六、R3 治理建议（统一封装）

1. **`deleteNodeWithCascade(id)`**（替换 App.jsx L453 deleteNode）：
   - 级联删除 `parentId === id` 的所有子节点（解决 #2/#3/#4 孤儿）。
   - 边过滤维持 `e.source !== id && e.target !== id`（已有，保留）。
   - 删除前由调用方 `history.record` 快照（保持进栈）。
   - group 删除统一走此函数（节点菜单 L878、多选删除 L952 都改调）。

2. **`recordPositionChange(prevNodes, nextNodes)`**（替换位置拖拽的裸 setNodes）：
   - 在 `handleNodeDragStop`（App.jsx L1247）改为：拖拽结束时若 `changed`，计算新节点数组并 `history.record({ nodes: nextNodes, edges: edgesRef.current })`，使位置/组归属可撤销。
   - 注意 suppress 窗口（useCanvasHistory 600ms）避免连续拖拽刷屏，可加"拖拽开始打标记、停止才 record"的合并策略。

3. **`duplicateWithEdges(selectedIds)`**（替换 App.jsx L472 duplicateSelected）：
   - 克隆选中节点并**重映射其相连边**（按源/目标 id 映射到新 clone id），保留组内/组间连线（解决 #5 丢连线）。
   - group 克隆：克隆 group 节点 + 其所有 parentId 子节点（整组克隆，而非孤立 group 外壳）。

4. **`rollback` 记录边 + data**（workflowRuntime.js L207-217）：
   - rollback 前先 `ctx.history?.record` 当前 `{nodes, edges}`（或保存一份 `preRollbackSnapshot` 供用户反撤销）。
   - 确保被删节点的 data 不静默丢失——若后续要做"恢复 AI 产出"，快照应保留 data。
   - 考虑把 rollback 接入统一撤销栈（复用 `deleteNodeWithCascade`，天然级联边+记录）。

5. **统一"删除"入口**（消除散落的三处删除逻辑）：
   - App.jsx 现有删除点：L453 deleteNode、L876-879 节点菜单删除、L947-959 多选删除、workflowRuntime L210 rollback 删除。
   - 全部收敛到 `deleteNodeWithCascade`，避免"删除"语义在多处不一致（有的级联、有的不留边）。

6. **`revertArrange` 与撤销栈打通**：保留 arrangeSnapshot 作为"二次确认"是合理的，但确认后建议 `history.record` 当前结果、或让还原也能 undo（当前还原不进栈，用户还原后想撤销还原做不到）。

## 七、验收对照

1. 清单完整（15 条，≥10，覆盖所有探索起点：L1183 拖拽 / L452-484 删除+克隆 / L493-512 编组解组 / L868-873 右键解组 / L930-935 右键编组 / L621-639 自动排版 / L602-606 粘贴 / L1006-1009 连线 / L1072-1074+1098-1103 删边 / 所有 history.record 调用点）。
2. 每条均标注"进栈 + 级联 + 一致性"三维度，并附行号证据。
3. 行号均来自本次实际打开 App.jsx（1458 行）、historyStack.js（77 行）、useCanvasHistory.js（70 行）、workflowRuntime.js（249 行）、groupNodes.js（99 行）核实。

## 八、铁律文件名
本文件即唯一产出。写满后结束。

## 七、铁律文件名
本文件即唯一产出。写满后结束。
