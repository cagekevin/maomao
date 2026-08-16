# TASK-013 — 画布历史/撤销重做与快照序列化薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不要写 Babel/AST 脚本去批量改代码。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 已深度审计了「AI 执行链路」（useAgentChat / useCanvasAgentTools / canvasPlanExecutor 等），发现了一批致命 bug。但**画布本体**的撤销/重做、历史栈、快照序列化机制尚未被审计。本任务专门探查：用户手动操作画布时，撤销/重做是否会丢数据、跨项目是否串栈、快照落盘是否安全。

## 二、硬约束

- 只读 `src/components/base/` 下指定文件，不修改任何 `src/`。
- 不参考任何现有文档（禁止参考 `docs/` 下其他任务书作为结论来源，仅可参照本文件给出的探索起点）。
- 所有结论必须附「文件 + 行号 + 真实代码片段 + 触发场景 + 后果」。
- 区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位，必须逐文件通读）

- `src/components/base/historyStack.js`（纯类，77 行，已读）：撤销栈核心逻辑 `push/undo/redo/clear`，`MAX=15`，`suppress` 600ms 窗口，`branchRef` 分支截断。
- `src/components/base/useCanvasHistory.js`（70 行，已读）：React 桥接 hook，`record/undo/redo/clear`，`record` 依赖显式快照否则回退 `getSnapshot()`（注释明言「先 setNodes 再 record 必须显式传快照，否则 undo 丢失新增节点」）。
- `src/components/base/workflowRuntime.js`（249 行，已读）：Workflow 运行时 `runParallel`/`awaitNode`/cancel/`rollback`/`pushUndo`。
- `src/components/base/projectStore.js`：快照落盘 `loadJSON`/`saveJSON`、`CANVAS_STATE_PREFIX` 序列化、`projectsApi` 持久化（已探：`L26` JSON.parse fallback、`L34` sSet、`L112-115` 容错、`L131/141` 字段裁剪、`L201-202` 删除）。

## 四、覆盖清单（按维度，枚举「出现的所有地方」）

1. **撤销丢数据**：`record` 在 `useCanvasHistory.js L28-34` 若调用方未显式传 snapshot（仅 `getSnapshot()`），哪些节点操作会丢新增节点？grep 所有 `record(` 调用点，确认是否都传了快照。
2. **suppress 窗口竞态**：`historyStack.js L34` suppress 期内 `push` 被忽略；若 600ms 内连续两次合法操作（如拖拽+改参），第二次被吞 → 撤销栈缺一条。`useCanvasHistory.js L37-40` 的 suppressTimer 是否覆盖所有 push 路径。
3. **跨项目串栈**：`historyStack.clear()` 在切换/新建项目时是否一定被调用？grep `history.clear()` / `useCanvasHistory().clear` 所有调用点，找出「切项目但未清栈」的路径（残留栈 → 撤销跨项目应用旧快照）。
4. **快照落盘配额/截断**：`projectStore.js` 快照 `JSON.stringify` 写入 localStorage，`sSet`（`storageAdapter.js`）是否静默吞 `QuotaExceededError`（与 TASK-006 §4.3 同源）。大画布（数百节点 + dataURL）落盘失败是否无提示、是否连带丢其他项目。
5. **redo 分支覆盖**：`historyStack.js L55-62` redo 后 `branchRef` 更新；若在 redo 之后又 push，旧分支是否被正确截断（`L36` slice 逻辑）。
6. **Workflow.rollback 不彻底**：`workflowRuntime.js L207-217` rollback 仅删 `nodeIds` 内的节点；若工作流中途新建了边 / 改了已有节点 data，rollback 不还原这些副作用 → 留垃圾。

## 五、输出规范

在下方表格逐条填写（每条一行）。找不到问题填「健康」并简述原因。

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | 撤销丢数据 | 结构操作健康：`src/App.jsx` L445/L459/L483/L496/L510/L605/L638/L725/L871/L933/L958/L1009/L1101（共 14 处 `record(` 调用点，全部显式传快照）。**位置拖拽不进栈**：`src/App.jsx` L1109-1156 `onNodesChangeForEdges`（绑定 `onNodesChange`）、L1183-1248 `handleNodeDragStop`（绑定 `onNodeDragStop`） | 结构性操作（增/删节点、连线、删边、克隆、编组/解组、自动排版）全部 14 处均显式传 `{ nodes, edges }` 快照，无遗漏。但节点**位置拖拽**走的是 ReactFlow 内部 `onNodesChange`（L1111 `onNodesChange(changes)`），`onNodesChangeForEdges` 只重算边选中态、**不调 `history.record`**；`handleNodeDragStop` 仅在「拖入/拖出 group」导致 `changed=true` 时 `setNodes(cur)`（L1247），普通位置移动 `changed=false` 既无 `setNodes` 也无 `record`，位置变化完全不进栈。 | 用户在画布上拖拽移动一个节点（未跨 group），松开鼠标后按 Ctrl+Z。 | 节点位置**无法被撤销**（撤销栈里没有这条 position 变化记录）→ 用户以为能撤销移动，实际上位置被永久改掉；这是「撤销覆盖不全」而非「丢新增节点」。结构类操作则正常可撤销。 | 缺陷（位置拖拽不进撤销栈；结构操作健康）。注意：本维度标题「撤销丢数据」在结构层已修复，但**位置维度存在真实覆盖缺口**，故整体判缺陷而非健康 |
| 2 | suppress 竞态 | `src/components/base/historyStack.js` L33-34；`src/components/base/useCanvasHistory.js` L37-40（仅 `undo`/`redo` 内调用 `scheduleRelease`） | `push(snapshot){ if (this.suppress) return }`（L34）。`suppress` 标志**只在 `undo`/`redo` 后**被置 true（`useCanvasHistory.js` L47/L57），并由 `scheduleRelease` 在 600ms 后 `stack.releaseSuppress()`（L39）复位；普通手动操作的 `record`→`stack.push` 不会进入 suppress。 | 用户执行一次「撤销/重做」后，紧接 **600ms 内**做新手动操作（如刚 undo 完立刻删节点/移动节点/改参），该新操作的 `push` 被 `suppress` 的 `return` 直接吞掉，不进栈。 | 撤销栈缺这一条最新记录 → 用户再按 Ctrl+Z 会越过刚做的真实改动、把更早状态应用回画布，造成「刚的操作撤不掉 / 撤到错误层级」。600ms 窗口较长（人手速操作极易落入），属于确定性可复现的位置竞态。 | 缺陷（确发但低频：触发前提是「undo/redo 后 600ms 内的首条新操作」；根因是 suppress 对「新操作」与「undo/redo 自身重复记录」无差别屏蔽，无法靠调用点规避） |
| 3 | 跨项目串栈 | `src/App.jsx` L289/L302（仅两处清栈）；`src/components/base/projectStore.js` L178 `createProject`/L188 `switchProject`/L197 `deleteProject` 自身不清栈；`src/components/base/ProjectSelector.jsx` L24-25；`src/App.jsx` L1292 `key={activeProjectId}` 重挂载 | 清栈动作只存在于 App 的 `handleSwitchProject`/`handleCreateProject`（`history.clear?.()`，L289/L302）。`projectStore` 三函数不持有 history 引用、不清栈；`ReactFlow` 用 `key={activeProjectId}`（L1292）在切项目时**重挂载整个画布**（清空旧节点/加载新节点），但 `history` 是 App 顶层单个 `useCanvasHistory` 实例（L243，不随 `key` 重挂载），故画布重挂载**不会**自动清栈；`ProjectSelector.handleSwitch` 若 `onSwitch` 未传则直接 `switchProject(id)`（L25）**绕过 App 清栈**。 | (a) 任何未经 `handle*` 而直接调 `switchProject`/`createProject` 的入口（含 L25 fallback）；(b) 当前 `handle*` 若未来被改漏 `history.clear()`，则旧项目快照残留栈中，切到新项目后 Ctrl+Z 会把旧项目快照 `apply` 到新画布。 | 跨项目串栈 → 撤销把 A 项目节点/边错误恢复到 B 项目，数据污染且难排查。当前正常路径（App 总传 `onSwitch`、`deleteProject` 后也走 `onSwitch`）均清栈，但**清栈完全依赖调用方自觉、store 层与画布重挂载层均无自动防护**，是结构性脆弱点。 | 设计权衡（当前路径不串栈，但清栈无强制保障；`key` 重挂载不清栈 + L25 fallback 是潜在串栈口，建议把 history 按 `activeProjectId` 隔离或在 `switchProject` 注入清栈钩子加固） |
| 4 | 落盘配额 | `src/components/base/kvStore.js` L54-66（`storageSet`→`kvSet` L62-63，画布 key 走 localTool KV/SQLite）；`src/components/base/storageAdapter.js` L55-63（`sSet`）；`src/components/base/projectStore.js` L146-170（L166-168 catch）；`src/App.jsx` L254 `.catch(()=>{})` | 画布 key 以 `canvas-state-v1-` 开头（`kvStore.js` L21），`storageSet`（L62-63）经 `kvSet`（`localTool` `/api/kv/set`，SQLite 后端）落盘，**不经 localStorage**；localStorage 仅存 `projects` 等非画布 key（`sSet` L57-58/L62 仍静默吞异常，但与画布快照无关）。`saveCanvasState` L166-168 catch 仅 `console.warn` 返回 `{success:false}`；调用方 `persistCanvas` L254 `saveCanvasState(...).catch(() => {})` 完全忽略结果。 | 大画布（数百节点 + dataURL 缩略图 / 大 data）推送 `localTool` KV 时，服务端可因请求体积限制 / 磁盘 / 序列化失败而返回非 2xx，`kvSet` 抛错（L37），或前端 `JSON.stringify` 抛循环引用等，均被 `saveCanvasState` catch 吞掉、再由 `.catch(()=>{})` 彻底丢弃。 | 快照落盘**静默失败、无任何 UI 提示**：用户以为已保存，刷新/切项目后画布回到旧版本或丢失。单 key 失败仅影响该项目（KV 按项目分 key），不直接连累其他项目，但「失败无感知、无重试」是主要风险。 | 缺陷（与 TASK-006 §4.3 同源：写入异常被静默吞；落盘失败完全无提示、无法重试，大画布/后端异常场景真实可触发；落盘目标实为 localTool KV 而非 localStorage，但失败静默问题一致） |
| 5 | redo 分支 | `src/components/base/historyStack.js` L36、L55-62 | redo 后 L60 `this.branchRef = this.index`；后续 push 时 L36 `const next = this.history.slice(0, this.branchRef + 1)` 取 0..index 再 push 新快照，正确截断被 redo 覆盖的旧分支。 | 用户 undo 到中间某步 → 做新操作（再 push）→ 再 redo。 | 旧分支被 `slice(0, branchRef+1)` 干净截断，新分支独立成栈；redo 不会把已失效的旧分支混回。 | 健康（分支截断逻辑正确，redo 后 push 不产生孤儿分支） |
| 6 | rollback 不彻底 | `src/components/base/workflowRuntime.js` L207-217 | `rollback(ctx)` 仅遍历 `nodeIds` 调 `ctx.deleteNode(id)`（L209-210），或过滤掉 `nodeIds` 内节点后 `ctx.setNodes(remaining)`（L212-213）。它只清理「本次工作流新建的节点」，不处理：(a) 工作流中途 `addEdge` 新建的边；(b) 对**已有节点 data** 的修改（如改写某节点参数、状态）。`nodeIds` 只记录 `addNode(id)` 注册的节点（L139-142）。 | AI 工作流执行中：新建节点 N1、新建边 E1（连到已存在节点 N0）、并把 N0 的 data 改了；工作流失败调用 `rollback`。 | 结果：N1 被删，但**孤立的边 E1 残留**（指向已删 N1 的悬空边），且 N0 被改的 data 未还原 → 画布留下垃圾边 + 被污染的已有节点，需用户手动清理。 | 缺陷（rollback 仅回滚「新建节点」一类副作用，对边新建、已有节点 data 改写两类副作用无还原，AI 中断/失败场景必留垃圾） |

## 六、验收标准（可自测）

- [ ] 6 个维度全部覆盖，每条附文件+行号+片段。
- [ ] 凡标「缺陷」的，给出「触发场景 → 后果」链路，且行号可在本次会话核实。
- [ ] 区分「已确认缺陷 / 设计权衡 / 健康」。
- [ ] 末尾给出「最值得修 Top 3」（影响 × 概率）。

## 七、铁律文件名

`docs/agent 批量任务/TASK-013-画布历史撤销重做与快照序列化.md`

## 八、最值得修 Top 3（影响 × 概率）

| 排名 | 维度 | 编号 | 影响 | 概率 | 理由 & 建议修法 |
|---|------|------|------|------|----------------|
| 1 | 位置拖拽不进撤销栈 | #1（子项） | 高（每一项节点位置调整都无法撤销，画布布局被悄悄改掉且不可逆） | 高（拖拽是画布最高频操作，每次移动后 Ctrl+Z 都无效） | `App.jsx` L1109-1156 `onNodesChangeForEdges` 与 L1183-1248 `handleNodeDragStop` 均不调 `history.record`。建议：在 `handleNodeDragStop` 末尾（无论是否跨 group）或 `onNodesChange` 的 `position` change 落定时调 `history.record({ nodes: nodesRef.current, edges: edgesRef.current })`；为防拖拽过程产生大量中间态，应在 `onNodeDragStop`（拖拽结束）记一条，而非每次 `onNodesChange`。 |
| 2 | 落盘配额/失败静默 | #4 | 高（静默丢整个画布快照，刷新/切项目后数据消失） | 高（大画布 + dataURL 易超服务端体积/磁盘限制，且用户无感知） | 落盘走 `kvStore.storageSet`→`kvSet`（localTool KV/SQLite），失败被 `saveCanvasState` catch 吞、`persistCanvas` `.catch(()=>{})` 丢弃。建议：`saveCanvasState` 返回失败原因并向上抛，`persistCanvas` 失败弹 `showToast` 提示，必要时降级裁剪 dataURL 重试。 |
| 3 | suppress 竞态 | #2 | 中高（undo/redo 后 600ms 内新操作丢历史，Ctrl+Z 跳层/覆写） | 中（用户 undo 后手快接操作即触发，确定可复现） | `historyStack.js` L34 `if(this.suppress) return` 对「新操作」与「undo/redo 自身」无差别抑制。建议：suppress 只应在 undo/redo 应用快照期间屏蔽重复记录，不应屏蔽用户随后生成的真实新操作；可改为 suppress 仅阻止同源（undo/redo）二次 push，或缩短/取消对新操作的屏蔽。 |

> 备注：
> - 维度 #5（redo 分支）经逐行复核判定为**健康**，无确认缺陷。
> - 维度 #6（rollback 不彻底）确为缺陷（AI 失败留悬空边 + 被污染已有节点），因发生面限于 AI 工作流失败路径、概率略低于上述 Top3，列为**第 4 优先**：建议 `rollback` 同时删除本次新建的边（维护 edgeIds 集合）并还原被改动的已有节点 data（pushUndo 时记录旧 data 快照、rollback 时回写）。
> - 维度 #3（跨项目串栈）当前调用路径均清栈，属**设计权衡**；但 `key={activeProjectId}`（L1292）重挂载画布不清栈、`ProjectSelector.jsx` L25 fallback 路径与 store 层无自动防护是结构性脆弱点，建议把 history 实例按 `activeProjectId` 隔离或在 `switchProject` 注入清栈钩子加固。
