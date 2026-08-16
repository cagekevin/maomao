# TASK-017 — 拖拽/缩放交互与编组(Group)边界薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不写批量改码脚本。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 未覆盖「用户手动操作画布」的交互层：拖拽、缩放、快捷键、编组/解组、自动排版、右键菜单、资产拖入。这些是高频操作，边界问题（父节点未前置、坐标错乱、快捷键冲突、编组嵌套）会直接破坏画布。本任务探查。

## 二、硬约束

- 读 `src/components/base/`：`groupNodes.js`、`useCanvasShortcuts.js`、`useArrangeCanvas.js`、`useAssetDragToCanvas.js`、`useAssetDropPaste.js`、`ContextMenu.jsx`、`NodePalette.jsx`、`CanvasToolbar.jsx`，及节点组件 `src/components/GroupNode.jsx`。
- 不修改任何 `src/`。
- 不参考现有文档作结论来源。
- 每条结论附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位）

- `src/components/base/groupNodes.js`（99 行，已读）：`createGroupFromNodes`/`ungroupNodes`。注释明言「父节点必须 unshift 到数组开头否则拖出消失」「不设 extent:'parent' 让节点能拖出组」。已探：`L27-29` 排除 group/已在组内节点、`L44-46` groupId 用 `Date.now().toString(36)`、`L61-76` 子节点转相对坐标 + unshift。
- `src/components/base/useCanvasShortcuts.js`（75 行，已读）：全局快捷键，`isEditableTarget` 守卫、`hasSelectionText` 跳过、`onAdd` Q/W/E 快速加节点、`onGroup/onUngroup/onArrange/onDuplicate/onSelectAll`。
- `src/components/base/useAssetDropPaste.js`（已探：`L106` decodeURIComponent 容错、`L116/L187` 非法数据忽略）。
- `src/components/base/useArrangeCanvas.js`、`src/components/base/useAssetDragToCanvas.js`：自动排版(dagre)、资产拖入落点。

## 四、覆盖清单（按维度）

1. **嵌套编组**：`groupNodes.js L27-29` 排除「已在其他组内」的节点，且 `createGroupFromNodes` 不处理 group 套 group。若用户对已编组的选择再 Ctrl+G → 行为？是否允许嵌套、是否会破坏 parentId 链。
2. **解组坐标错乱**：`ungroupNodes.js L90-96` 子节点 `position + group.position` 转绝对。若 group 自身被缩放/移动过（position 非原始），坐标计算是否用错基准（React Flow group 的 `position` 是 group 自身还是父？嵌套时错位）。
3. **groupId 碰撞**：`groupNodes.js L46` `group-${Date.now().toString(36)}` 同一毫秒内两次编组 → id 相同 → React key 冲突 / 父子关系错乱。
4. **快捷键冲突/遗漏**：`useCanvasShortcuts.js` Q/W/E 加节点无 `e.repeat` 防长按连发；Ctrl+A 全选在画布空焦点时是否误选文本？`onDuplicate` 复制后节点 id 是否重生成（防重复 id）。
5. **资产拖入坐标**：`useAssetDragToCanvas.js` / `useAssetDropPaste.js` 拖入落点用鼠标 clientX/Y 转画布坐标；缩放/平移状态下转换公式错 → 资产落到错误位置。
6. **自动排版覆盖人工布局**：`useArrangeCanvas.js`（dagre）重排后是否进撤销栈？若未 `record`，用户 Ctrl+Z 无法回退排版，或排版后节点重叠（dagre 参数）。
7. **右键菜单越界**：`ContextMenu.jsx` 菜单在画布边缘弹出是否超出视口被裁切；删除节点是否连带删边（orphan edges 残留）。

## 五、输出规范

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | 嵌套编组 | `groupNodes.js:27-30`<br>`App.jsx:486-501` | `const targets = nodes.filter((n) => ids.includes(n.id) && n.type !== 'group' && !n.parentId)`<br>`if (targets.length < 2) return { ok: false, error: '至少选择 2 个可编组的节点' }` | 对一个**已编组的选择**再 Ctrl+G：① 选「group 节点 + 其内部子节点」→ 子节点有 `parentId` 被 `!n.parentId` 过滤，group 自身有 `type==='group'` 被过滤 → `targets` 为空 → 拒绝。② 选「两个不同 group 的子节点」→ 二者都有 `parentId` → 全部被过滤 → `targets` 为空 → 拒绝。③ 选「group 节点 + 一个顶层游离节点」→ group 被 `type` 过滤 → 只剩 1 个 → 拒绝。 | **健康（防御性拒绝，无嵌套入口）**：`!n.parentId` + `n.type!=='group'` 双重守卫，使「嵌套编组 / group 套 group」在当前代码路径下**根本无法产生**，parentId 链不会被破坏。代价：无法用 Ctrl+G 表达「把多个已编组集合再合成大组」的语义需求（需先逐个解组），属功能取舍而非缺陷。 |
| 2 | 解组坐标 | `groupNodes.js:85-96`<br>`App.jsx:504-512` | `const gx = group.position.x`<br>`const gy = group.position.y`<br>`position: { x: n.position.x + gx, y: n.position.y + gy }` | React Flow 中 group 的 `position` 始终是其**自身在画布中的绝对坐标**（非父坐标）。结合维度 1：group 只能由顶层游离节点生成、不可能被嵌套（无父），故 `group.position` 永远是绝对坐标；子节点 `n.position` 是相对该 group 的相对坐标。解组时 `相对 + group绝对 = 子节点新绝对坐标`，公式正确。即使事后拖动 group 改变 `group.position`，相对子坐标不变，解组还原仍准确。 | **健康**：在唯一可达的场景（单层 group）下，`ungroupNodes` 坐标换算恒等正确，无错位。因嵌套组无法生成（维度1），「嵌套时基准用错」的假设场景不可达，不构成缺陷。 |
| 3 | groupId 碰撞 | `groupNodes.js:46` | `const groupId = \`group-${Date.now().toString(36)}\`` | 同一毫秒内连续两次建组（如极快连点两次 Ctrl+G，或 Agent `group_nodes` 工具在循环内无延迟批量建组）。`Date.now()` 毫秒级，两次调用可能返回**相同**字符串 → 两个 group 节点 `id` 重复 → React key 冲突，且 `nodes.find(n => n.id === groupId)` 永远命中第一个，`ungroupNodes` 对第二个组失效、其子的 `parentId` 指向重复 id 错乱。 | **设计权衡（手动极低概率 / Agent 批量高危）**：手工连点毫秒碰撞概率极低；但 Agent/group_nodes 工具若并发/紧循环建组，碰撞概率显著上升。**建议**：改用 `crypto.randomUUID()` 或 `Date.now().toString(36)+随机后缀`，彻底消除碰撞。 |
| 4 | 快捷键 / 复制 | `useCanvasShortcuts.js:43-47`<br>`App.jsx:472-484`<br>`useCanvasShortcuts.js:66` | `if (key === 'q') { e.preventDefault(); onAdd?.('textNode'); return }`（Q/W/E 无 `e.repeat` 守卫）<br>`duplicateSelected`：`id: \`${n.type}-clone-${Date.now()}-${Math.random().toString(36).slice(2,6)}\``，且克隆体 `...n` 直接沿用原 `parentId`；注释明示「简化：只克隆节点」 | ① **长按连发（已确认缺陷）**：按住 Q/W/E 不放，`keydown` 因无 `e.repeat` 判定而持续触发 `onAdd`，每次在视窗中心建一个节点 → 爆发式生成大量重叠节点。② **复制组/子节点 mishandle（已确认缺陷）**：Ctrl+D 一个 group 节点 → 仅克隆出「空壳 group」（新 id，但原 children 的 `parentId` 仍指向**旧** group，壳内无子）；Ctrl+D 一个子节点 → 克隆体沿用原 `parentId`，出现在**原** group 内偏移 40px 处（等于在原组内多复制了一份），且其连线**全部丢失**（克隆只复制节点、不复制边）。③ Ctrl+A 全选：`hasSelectionText()`（L64）在 L66 之前，输入框有选中文本时跳过、画布空焦点正常全选，无文本误选，健康。④ Ctrl+D 节点 id 含 `Math.random()`，无重复 id，健康。 | **已确认缺陷（2 项）**：A. Q/W/E 缺 `e.repeat` 守卫（建议分支首行 `if (e.repeat) return`）；B. `duplicateSelected` 对 group / 子节点复制行为不符合直觉且丢失连线（建议克隆 group 时递归克隆其子孙并改 parentId 指向新壳、同时复制内部边）。全选守卫与单节点 id 生成健康。 |
| 5 | 拖入坐标 | `useAssetDropPaste.js:94`<br>`useAssetDropPaste.js:43-46` | `const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })`；粘贴落点 `screenToFlowPosition(lastMouse.current)` | 资产库拖入 / 文件拖入 / 粘贴，落点均经 React Flow 官方 `screenToFlowPosition` 换算（内部已含 zoom+pan 变换）。缩放/平移任意状态下转换公式由 React Flow 负责，落点正确；`useAssetDragToCanvas.js` 仅负责 `dataTransfer` 信封，不参与坐标换算。 | **健康**：统一收敛到 `screenToFlowPosition`，无手写坐标系转换，缩放/平移下落点准确。仅粘贴时若 `lastMouse` 长时间未更新（如脚本触发而无 mousemove），回退到视图中心，符合预期。 |
| 6 | 排版撤销 | `useArrangeCanvas.js:13-16`<br>`App.jsx:621-639` | `useArrangeCanvas` 注释明言「只做纯计算+写回，不碰历史栈」；调用方 `arrangeCanvas` 在写回后 `history.record({ nodes: result.nodes, edges: result.edges })`（L638），且先存 `before` 快照供「还原」(L622/L637)。 | 用户 Ctrl+L / 点整理画布：排版结果被 `history.record` 入历史栈 → Ctrl+Z 可回退到排版前；「还原整理」按钮写回 `before` 快照。dagre 参数 `nodesep/ranksep=300` + 连通分量按列分摆（L110-167）避免多块图重叠；group 子节点保持相对父偏移（L141-147）。 | **健康**：撤销栈由宿主正确 record，无「排版无法撤销」问题；多连通分量换列防重叠已实现。group 重排后尺寸若变化，子节点按新父框相对偏移重算（L160-161 写回测量尺寸），视觉一致，非缺陷。 |
| 7 | 右键菜单 | `ContextMenu.jsx:48-61`<br>`App.jsx:452-463`(deleteNode)<br>`App.jsx:940-960`(selection 删除) | 防溢出：`if (top + mh > rect.height) top = Math.max(4, rect.height - mh - 10)`（同理左越界收左）；`deleteNode`：`nodesRef.current.filter((n) => n.id !== id)` 仅按 id 删自身；selection 删除：`nextEdges = edgesRef.current.filter((e) => !sel.includes(e.source) && !sel.includes(e.target))` | ① 菜单在画布边缘弹出：`useLayoutEffect` 绘制前测真实尺寸，超出则上/左移，永远完整落在容器内，不裁剪，健康。② **删除单个 group 节点（已确认缺陷）**：右键 group → 删除（`deleteNode` L455）只移除 group `id` 自身，**未连带删除其子节点**（子节点 `parentId === groupId` 仍保留）→ 子节点成为 `parentId` 指向已删除 group 的**孤儿节点**，React Flow 渲染异常（子节点脱离父框、坐标基准丢失）。③ 删除选中节点（selection 菜单 L955）：边级联过滤已做，orphan 边清理健康。 | **已确认缺陷（删 group 留孤儿子节点）**：右键单个 group 节点「删除」只删父、不删子，产生孤儿节点破坏画布。selection 批量删除与边级联删除、菜单越界防护均健康。 |

## 六、验收标准

- [x] 7 维度覆盖，附行号+片段。
- [x] 缺陷给触发场景→后果。
- [x] 区分缺陷/权衡/健康。
- [x] 末尾 Top 3。

## 七、铁律文件名

`docs/agent 批量任务/TASK-017-拖拽缩放交互与编组边界.md`

## 八、Top 3 高危薄弱点（按风险排序）

1. **【缺陷·高危】右键删除 group 留孤儿节点**（`App.jsx:452-463` `deleteNode`）。右键单个 group 节点删除只按 `id` 移除父节点，子节点 `parentId` 仍指向已删除的 group → 孤儿节点渲染异常、坐标基准丢失、画布结构破坏。**建议**：`deleteNode` 删除 group 时递归收集 `parentId === id` 的所有子孙一并删除（或迁移到祖父）。

2. **【缺陷·中危】Ctrl+D 复制 group / 子节点 mishandle + 丢连线**（`App.jsx:472-484` `duplicateSelected`）。克隆体 `...n` 沿用原 `parentId`：复制 group 只产出无子的空壳（children 仍属旧组）；复制子节点会在原组内多塞一份；且「简化：只克隆节点」导致所有连线丢失。**建议**：复制 group 时递归克隆子孙并把 parentId 改指向新壳、同时复制内部边；复制子节点时按是否在组内决定新 parentId。

3. **【缺陷·中危】Q/W/E 长按连发建节点**（`useCanvasShortcuts.js:43-47`）。无 `e.repeat` 守卫，按住 Q/W/E 不放会连续在视窗中心生成大量重叠节点。**建议**：在快速添加分支加 `if (e.repeat) return`。

> 备注（低危 / 权衡）：`groupId` 用 `Date.now().toString(36)`（`groupNodes.js:46`）在 Agent 批量并发建组时可能毫秒碰撞，建议改 `crypto.randomUUID()`；**嵌套编组（维度1）与解组坐标（维度2）经审计为健康**（双重 `!parentId`+`type` 守卫使嵌套组不可达，故解组公式恒正确），非缺陷；拖入坐标、排版撤销栈、菜单越界防护均健康。

## 九、审计说明（自审修订记录）

首稿两处分析被自审推翻并修正，确保文档「无遗漏、无错误」：

- **维度 1 / 2（首稿误判）**：首稿假设「跨父子节点可合并成新组」「嵌套组解组坐标会错位」。复核 `groupNodes.js:27-28` 的 `!n.parentId && n.type!=='group'` 双重守卫后确认：任何带 `parentId` 的节点或 group 自身都会被 `targets` 过滤，嵌套组在当前代码路径下**根本无法生成**。故维度 1 由「权衡(允许跨父合并)」修正为「健康(防御性拒绝)」，维度 2 由「潜在缺陷」修正为「健康」，原 Top3 第 3 条（嵌套坐标错乱）据此删除。
- **维度 4（补充真实缺陷）**：首稿仅记 Q/W/E 连发。审计 `duplicateSelected`（`App.jsx:472-484`）发现复制 group/子节点 mishandle + 丢连线为**真实可达缺陷**，已补入维度 4 并晋级 Top3 第 2。
- 所有行号、片段均取自本次实际读取的源文件（`groupNodes.js` / `useCanvasShortcuts.js` / `useArrangeCanvas.js` / `useAssetDropPaste.js` / `useAssetDragToCanvas.js` / `ContextMenu.jsx` / `NodePalette.jsx` / `CanvasToolbar.jsx` / `GroupNode.jsx` / `App.jsx`），未套用历史行号、未改任何 `src/`。
