# TASK-019 — 智能分组引擎核验（大雄 Infinite-Canvas smartGroup vs 我们 maomao）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们（maomao）是 React Flow 画布，逐项追平大雄（Infinite-Canvas）的智能无限画布。本任务深入核验大雄的**智能分组引擎（smartGroup）**：多图节点如何成组、成员管理、布局、放大聚焦、组内吸收新图、重新布线、解散还原，判断我们是否有等价能力、缺口在哪、值不值得对齐。

## 二、硬约束
只读核验。结论必须可执行（下一个 AI 拿到落点即可改）。

## 三、探索起点（本次实际核实）

### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`，17042 行）
- 智能分组核心：
  - `smartGroupLayoutSize` @ L1318
  - `smartGroupMembers` @ L1330
  - `smartGroupCompactMembers` @ L1340
  - `smartGroupZoom` @ L1349
  - `scaleSmartGroupMemberToZoom` @ L1354
  - `rerouteSmartConnections` @ L1362
  - `absorbImageNodeIntoSmartGroup` @ L1376
  - `addNodeToSmartGroup` @ L1387
  - `smartGroupContainingNode` @ L1418
  - `smartGroupScopeId` @ L1424
  - `smartGroupImageRefs` @ L1433
  - `smartGroupThumbLayout` @ L1457
  - `arrangeSmartGroupMembers` @ L1526
- 创建/解散分组：`createSmartGroupFromSelection` @ L15350（含 `addNodeToSmartGroup` L15366 + 自动整理 L15367）、`ungroupNode` @ L15374（解散时把图片拆回独立节点）
- 拖拽入组：`addDraggedNodesToSmartGroup` @ L15503（内部 `addNodeToSmartGroup` L15509 + 自动整理 L15513）、`addCreatedNodeToMenuGroup` @ L15538（内部 `addNodeToSmartGroup` L15540 + 自动整理 L15542）
- 迁移旧数据：`migrateSmartGroupImageMembers` @ L5742（内部 `absorbImageNodeIntoSmartGroup` L5751）
- 上传入组：`handleFiles` 流程 @ L11989（`addNodeToSmartGroup`，图片在 L1410 内部转 absorb）
- 编组/解组动作菜单：`smartGroupToolbarHtml` @ L7313、`runSmartGroupToolbarAction` @ L7329
- 节点类型判定：`isSmartGroupNode` @ L989、`isSmartImageNode` @ L986、`isSmartGroupCompactMember` @ L1343

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/groupNodes.js`（编组工具）— 实际核实
- `/Users/kevin/Documents/maomao/src/components/GroupNode.jsx`（编组节点）— 实际核实
- `/Users/kevin/Documents/maomao/src/App.jsx`（画布主入口 nodeTypes 注册 + 拖入/拖出成组 + 右键菜单）— 实际核实 L84、L486-507、L849-934、L1166-1248
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasShortcuts.js`（快捷键，含编组）— 实际核实

---

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）

### 核验点 1：大雄智能分组到底"智能"在哪

**1.1 组内吸收（图片进组后从画布消失，收进卡片缩略图网格）**
大雄：`absorbImageNodeIntoSmartGroup`（L1376–L1385）把图片节点的 `images` 并入 `group.images`，`delete group.w/h` 让网格按图数自动整理，再 `rerouteSmartConnections(child.id, group.id)` 重布线、删除原图片节点 `nodes = nodes.filter(n => n.id !== child.id)`。核心语义：**图片不再作为画布节点存在，而是收进组卡片的缩略图网格**。
调用入口（已逐个核实）：
- 旧数据迁移 `migrateSmartGroupImageMembers` → L5751
- 多选创建组 `createSmartGroupFromSelection` → L15366（经 `addNodeToSmartGroup`）
- 拖拽入组 `addDraggedNodesToSmartGroup` → L15509（经 `addNodeToSmartGroup`）
- 菜单新建入组 `addCreatedNodeToMenuGroup` → L15540（经 `addNodeToSmartGroup`）
- 上传图片入组 `handleFiles` 流程 → L11989（经 `addNodeToSmartGroup`）
- 而 `addNodeToSmartGroup`（L1387–L1416）中，图片分支在 L1410 显式转调 `absorbImageNodeIntoSmartGroup`。

**1.2 成员管理（显式 `items` 元数据）**
- `smartGroupMembers`（L1330–L1338）：取 `node.items` 数组、去重、排除子分组，返回画布成员节点列表。
- `addNodeToSmartGroup`（L1387–L1416）：图片→走 `absorbImageNodeIntoSmartGroup`（L1410）；提示词/循环→作为画布成员加入 `group.items`（L1413）；子分组→吸收其图片并入成员、删子分组本体（L1391–L1407）。
- `smartGroupCompactMembers`（L1340）：成员中 `smart-prompt`/`smart-loop` 视作"紧凑成员"。

**1.3 放大聚焦（分组像"画布中的画布"整体缩放）**
- `smartGroupZoom`（L1349–L1351）：读 `_memberZoom`，默认 1。
- `scaleSmartGroupMemberToZoom`（L1354–L1360）：新入组成员按当前缩放等比缩小尺寸（仅改尺寸、不跳点）。
- 注释 L1346–L1348 明确：缩放分组时组内所有成员整体等比缩放+重排，用每次手势起始快照实时计算，不持久基准。

**1.4 布局（自动排成员网格 + 拖入即排布）**
- `smartGroupThumbLayout`（L1457–L1520）：算缩略图网格 `cols/rows/thumb`、组宽高，支持单图（`count===1`）、显式尺寸（`hasExplicit`）、多图宫格（最多 4 列）。
- `arrangeSmartGroupMembers`（L1526–L1617）：把成员/缩略图排整齐网格、居中、收敛组框包住成员；图片成员归一化回自然尺寸（L1573–L1580 注释说明这是"拖出再拖入图片变小"根因修复）。
- 自动布局触发点（已核实）：`createSmartGroupFromSelection` L15367、`addDraggedNodesToSmartGroup` L15513、`addCreatedNodeToMenuGroup` L15542——即**每次入组后自动 `arrange`**，无需手动。

**1.5 重布线（来源→分组）**
`rerouteSmartConnections`（L1362–L1374）：把指向 `fromId` 的连线 / `inputNodeIds` 引用改接到 `toId`，去重去自环。

**1.6 组判定 / 作用域**
- `isSmartGroupNode`（L989–L991）：`node.type === 'smart-group'`。
- `smartGroupContainingNode`（L1418–L1421）、`smartGroupScopeId`（L1424–L1429）：区分"成员所属组"与"组本体"，用于连线合并/隐藏。
- `smartGroupImageRefs`（L1433–L1455）：汇总组内所有图片（组级 + 成员级）按先行后列排序，是预览/批量下载/宫格拼接的数据源。

**1.7 解散还原（吸收的逆操作）**
`ungroupNode`（L15374–L15413）：把收进卡片的 `group.images` 拆成独立 `smart-image` 节点平铺在原位置（L15383–L15401），删分组容器，过滤掉指向分组的连线/引用（L15402–L15406），提示词/循环成员原地保留。

**1.8 顶部操作菜单**
`smartGroupToolbarHtml`（L7313–L7328）+ `runSmartGroupToolbarAction`（L7329–L7360）：整理排列 / 预览（整组左右切换）/ 宫格拼接 / 批量下载 / 解散分组。

---

### 核验点 2：我们现状（代码证据）

**2.1 我们只有"静态/容器编组"，没有"组内吸收图片"**
`createGroupFromNodes`（`groupNodes.js` L24–L77）：仅计算外接矩形生成 `type:'group'` 父节点，把目标节点设为子节点（`parentId + 相对坐标`，**不设 `extent:'parent'`，可自由拖出**，L68 注释）。图片节点**仍是画布上的独立节点**，不存在"收进卡片缩略图网格并删除节点"的逻辑。
对照：大雄 L1376–L1385 的吸收-删除语义，我们完全缺失。

**2.2 成员管理 = 父子节点（隐式），无 `items` 元数据**
我们成员关系完全由 React Flow 父子机制（`parentId`）承载，节点上不存 `items` 数组。`GroupNode.jsx` 是空容器（L106–L107 `/* 空容器：外壳背景即 group 背景 */`）。无 `smartGroupMembers` / `smartGroupCompactMembers` 等价函数。
对照：大雄 L1330 / L1340 用 `group.items` 显式建模成员。

**2.3 放大聚焦：仅"折叠/展开"，无组内等比缩放**
`GroupNode.jsx` 的 `toggleCollapse`（L27–L61）：折叠态缩成 40px 小胶囊、子节点 `hidden:true`；展开态恢复。这是**整体显隐**，不是大雄的"组内成员整体等比缩放 + 重排"（`smartGroupZoom` L1349 / `scaleSmartGroupMemberToZoom` L1354）。我们无 `_memberZoom` 概念。

**2.4 布局：无自动成员网格排列，拖入也不自动整理**
我们缺乏 `arrangeSmartGroupMembers` / `smartGroupThumbLayout` 等价能力。组框尺寸"只由用户手动拖动调整，不根据子节点自动伸缩"（`App.jsx` L1182、L1246 注释）。拖入成组分支 `handleNodeDragStop`（L1223–L1231）仅设 `parentId`，**不入组后自动排列**——对比大雄 L15513 拖入即 `arrange`。无"整理排列"菜单项。

**2.5 重布线：拖入/拖出时不改写连线**
`handleNodeDragStop`（`App.jsx` L1183–L1248）：拖入 = 设 `parentId` + 相对坐标（L1223–L1231）；拖出 = 解除 `parentId`（L1232–L1243）。**仅改 parentId，完全不触及 edges**（无 `rerouteSmartConnections` 等价逻辑）。连线随父/子节点移动而自动跟随（React Flow 自带），但大雄"来源→分组"连线重定向语义我们没有。

**2.6 解散还原：仅解除 parentId，不拆图片**
`ungroupNodes`（`groupNodes.js` L85–L98）：仅把子节点 `parentId` 置空 + 坐标转回绝对、删 group 节点。因我们图片本就是独立节点，不存在"拆回"需求，但也因此没有大雄 L15383–L15401 那种"卡片图片→独立节点平铺"能力（因为我们从未吸收）。

**2.7 入口**
- `App.jsx` L84 `group: GroupNode` 注册；L486–L493 Ctrl+G → `createGroupFromNodes`；L504–L507 Ctrl+Shift+G → `ungroupNodes`；L849–L868 右键"取消编组"；L923–L934 右键"编组"（含 `history.record` 撤销记录）。
- `useCanvasShortcuts.js` L60–L61：`Ctrl+G` 编组、`Ctrl+Shift+G` 取消编组。
对比大雄工具栏（L7313–L7360）多了预览/宫格拼接/批量下载。

**2.8 结论**
我们是**"静态容器编组"**（React Flow 父子 + 折叠/展开），大雄是**"智能分组"**（图片吸收进卡片、组内等比缩放聚焦、自动成员网格、连线重定向、整组预览/拼接/下载、解散还原）。两者本质不同：我们是"把节点框在一起"，大雄是"把内容聚合进一个多图节点"。

---

### 核验点 3：结论 —— 值不值得对齐

#### 能力矩阵（大雄 vs 我们）

| 能力 | 大雄（代码证据） | 我们（代码证据） | 缺口 | 改动成本 | 价值/频率 |
|---|---|---|---|---|---|
| 图片组内吸收（进组删节点、收进缩略图网格） | `absorbImageNodeIntoSmartGroup` L1376；触发 L5751/L15366/L15509/L15540/L11989 | 无（图片始终是独立节点） | 整条吸收链路缺失 | 高 | 中（多图管理场景有用，但节点本就是画布独立节点，习惯不同） |
| 显式成员建模 `items` | `smartGroupMembers` L1330、`addNodeToSmartGroup` L1387 | 仅隐式 `parentId` | 无元数据数组 | 中 | 中 |
| 放大聚焦（组内等比缩放+重排） | `smartGroupZoom` L1349、`scaleSmartGroupMemberToZoom` L1354 | 仅折叠/展开 `toggleCollapse` L27 | 无 `_memberZoom` | 高 | 中低（折叠已能"聚焦"，缩放非刚需） |
| 自动成员网格布局（含拖入即排布） | `arrangeSmartGroupMembers` L1526；触发 L15367/L15513/L15542 | 无（手动拖尺寸，L1182/1246；拖入不整理） | 缺布局算法 | 中 | 中（整理排列体验加分） |
| 重布线（来源→分组） | `rerouteSmartConnections` L1362 | 无（拖入只改 parentId，L1223） | 缺连线重定向 | 中 | 中低（RF 连线自动跟随，痛点不突出） |
| 紧凑态（prompt/loop 紧凑成员） | `smartGroupCompactMembers` L1340 | 无 | 概念缺失 | 低 | 低 |
| 解散还原（图片拆回独立节点） | `ungroupNode` L15374 | 无需（我们从不吸收；`ungroupNodes` L85 仅解 parentId） | 概念缺失（但我们无需） | — | — |
| 整组操作菜单（预览/宫格/下载/解散） | `runSmartGroupToolbarAction` L7329 | 仅编组/解组 | 缺预览/拼接/下载 | 中 | 中（依赖图片吸收才成立） |
| 折叠/展开 | — | `toggleCollapse` L27（我们独有，大雄无等价） | 我们领先 | — | — |

#### 逐项追平落点（可执行）

1. **图片组内吸收（高 / 取舍见下）**
   - 落点：`src/components/base/groupNodes.js` 新增 `absorbImageIntoGroup(nodes, edges, groupId, imageNodeId)`，参照大雄 L1376–L1385：把图片节点 `data.images` 并入 group `data.images`、`delete group.style` 显式尺寸、`ungroupNodes` 式删节点，并改写 edges 的 source/target（复用落点 3 的 `rerouteConnections`）。
   - 改法：返回 `{ok, nodes, edges}`，`App.jsx` L1223 拖入分支在 `isImageNode` 时分流调用；同时需在 `GroupNode.jsx` 渲染 `data.images` 缩略图网格（大雄 L1457 布局算法）。

2. **自动成员网格布局（中 / 推荐追平）**
   - 落点：`GroupNode.jsx` 标题栏加"整理排列"按钮（仿 L7318），在 `App.jsx` 新增 `arrangeGroupMembers(groupId)`（算法参照 L1526–L1617：求成员外接矩形、行列网格、居中、收敛组框），并在 `handleNodeDragStop` L1231 之后调用（对齐大雄 L15513 "拖入即排布"）。
   - 改法：纯几何，风险低，体验提升明显。

3. **重布线（中 / 可选）**
   - 落点：`groupNodes.js` 新增 `rerouteConnections(edges, fromId, toId)`，参照 L1362–L1369 改 `source/target` 去重；在 `App.jsx` L1223 拖入分支和 `absorbImageIntoGroup` 内调用。

4. **放大聚焦（高 / 暂不建议）**
   - 落点：需在 `data` 加 `_memberZoom` 并在 `GroupNode`/子节点渲染时按缩放换算尺寸，牵涉渲染层，改动面大；折叠态已满足"聚焦"诉求。

5. **整组预览/宫格/下载（中 / 依赖图片吸收）**
   - 落点：先做落点 1，再在 `GroupNode.jsx` 菜单加预览/拼接/下载（复用已有图片预览/下载组件）。

#### 价值判断
- **总体倾向：弊大于利（不建议全量对齐，建议只追平「自动成员网格布局」一项）。**
- 理由：
  1. 架构差异本质：大雄是"多图节点 + 内容吸收"模型，我们是"画布独立节点 + 父子容器"模型。吸收-删除语义会把图片从画布抹除，违背我们"节点即产物、可独立拖拽/连线/复用"的设计哲学；强行对齐会破坏节点数据模型与 Artifact 链路（TASK-003 等）。
  2. 折叠/展开已提供"聚焦"能力，缩放聚焦非刚需。
  3. 唯一明确值得做、**成本低收益高**的是「自动成员网格布局 / 整理排列」——它不破坏模型，纯几何优化，能直接补上我们"组框不随成员自动收敛"（L1182/L1246）与"拖入不自动排布"的体验短板。
  4. 重布线与"来源→分组"语义在 React Flow 中连线本就随节点移动，痛点不突出，优先级低。
- 结论：**对齐"整理排列"（中成本）即可；图片吸收/组内缩放/整组预览拼接（高成本 + 破坏模型）弊大于利，暂不追平。**

---

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）+ 价值判断」三节 —— 见上文第四、三节。

## 六、验收标准（可自测）
1. 每个核验点都给出「大雄 + 我们 + 落点」三段，带文件+行号+片段。✅（见第四节）
2. 落点落到具体文件+行号+改法，不能写"在合适位置"。✅（见 3.1–3.5）
3. 能力矩阵完整、每项有成本与价值评级。✅（见第三节矩阵表，含解散还原、拖入即排布补充）
4. 亲自核实代码，非引用外部文档。✅（所有行号均来自本次 `read_file`/`search_content` 实际打开）

## 七、铁律文件名
本文件即唯一产出。写满后结束，未改动任何其他文件。
