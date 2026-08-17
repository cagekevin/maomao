# TASK-057 · 探索 · 节点体系与管线收口缺口

> 类型：**仅探索，只读分析**。本任务不修改任何源码、不编写/运行任何脚本、不执行测试。
> 所有结论均来自对 `src/` 现有实现的静态核查（2026-08-17 工作区快照）。
> 结论中的"建议"为后续可落地动作的候选，需另行立项。
> 文档经自审修订，已剔除早期版本的虚构断言（见文末 §6 审订记录）。

---

## 0. 背景与目标

TASK-057 锁定一个长期被推迟的底层问题：**节点体系与管线（数据同步 / 连线 / 序列化）的统一收口**。

所谓"收口"，指把散落在各节点里、本质应属于"节点通用能力"的逻辑，收敛到一个统一基座里，让任何新节点只需声明少量描述，就能自动获得：统一外框、统一数据同步、统一上游输入收集、统一连线契约、统一序列化/历史兼容。

---

## 1. 当前已收口的基座能力（对照基线）

以下能力**确实存在且被复用**，是收口工作的"已完成部分"。

| 能力 | 位置 | 作用 |
| --- | --- | --- |
| `NodeShell` | `src/components/base/NodeShell.jsx` | 统一节点外框：标题栏、工具条、children 插槽；内部渲染左右默认 `CustomHandle`；内置调用 `useSyncNodeData` + `useConnectedInputs`；`onConnect` 时弹出连接通知 |
| `useSyncNodeData` | `src/components/base/useSyncNodeData.js` | 把业务 state 与 RF `data` 双向对齐，写入时 `setNodes` 并触发 `history.record` |
| `useConnectedInputs` | `src/components/base/useConnectedInputs.js` | 按"直接上游"边（`edge.target === 本节点`）聚合上游产出；`NODE_OUTPUTS` 声明表 + `getNodeOutput` + `genericOutput` 兜底 |
| `NODE_OUTPUTS` / `getNodeOutput` | `useConnectedInputs.js` | **管线数据传递的核心契约**：每种"有产出的上游节点"在此声明如何解析产出，下游生成时统一读取 |
| `historyStack` + App 桥接 | `src/components/base/historyStack.js` | 统一历史栈（undo/redo），App 中挂载到 `Ctrl+Z`/`Ctrl+Y` 等 |
| `onConnect` 统一补边 | `App.jsx` `onConnect` | 连接时统一补 `id`（`edge-${Date.now()}`）、`type:'custom'`、`markerEnd`、序号标签、双向缓存（`xyEdge...`） |
| `group`/`loop` 内置连线 | `GroupNode` / `LoopNode` | 已用 NodeShell + ghost 节点（`GhostTargetNode`）把组/循环的隐式连线收口到统一 `onConnect` |

> 核查说明：早期版本曾断言 NodeShell 会"写回 `data.ports`/`data.portIds`"——**经全文 grep `ports`/`portIds` 确认，整个 `src/` 中该机制不存在**（仅 `director3d` 子模块的视口安全区字段同名，与节点端口无关）。故删除该不实描述。

---

## 2. 缺口清单（核心交付）

### 缺口 A · 两个视频节点未复用 `NodeShell`（外框/Handle 自写）

`NodeShell` 是统一外框与同步的唯一正确实现，并用 `import NodeShell` 精确统计，25 个节点级 `.jsx` 中 **14 个**真正 `import NodeShell`：

| 已用 NodeShell（14） | 文件 |
| --- | --- |
| textNode | TextNode.jsx |
| imageNode | ImageNode.jsx |
| imageBoxNode | ImageBoxNode.jsx |
| gridSplitNode | GridSplitNode.jsx |
| gridMergeNode | GridMergeNode.jsx |
| panoramaNode | PanoramaNode.jsx |
| director3dNode | Director3DNode.jsx |
| faceMosaicNode | FaceMosaicNode.jsx |
| loopNode | LoopNode.jsx |
| videoExtractNode | VideoExtractNode.jsx ⚠️ 见下 |
| videoProcessNode | VideoProcessNode.jsx ⚠️ 见下 |
| group | GroupNode.jsx |
| scriptBoxNode | ScriptBoxNode.jsx |
| promptNode | PromptNode.jsx |

> 注：搜索字符串 "NodeShell" 在 VideoExtract/VideoProcess 也有命中，但属注释/说明文本提及，**两者均未 `import NodeShell`**，实际用 `NodeTitle` + 自写 `Handle`/`CustomHandle` 外框。

**未用 NodeShell 的业务节点（确认仅 2 个）**：

- `videoExtractNode`（`VideoExtractNode.jsx`）：自写单容器外框 + 显式 `Handle`，注释明确"无 NodeShell 双层"。端口用 `id={'extract-left'}`、`id={'extract-right'}` 等硬编码。
- `videoProcessNode`（`VideoProcessNode.jsx`）：用 `NodeTitle` + `CustomHandle`（非 `NodeShell`），外框自写。

后果：这两个节点不走 NodeShell 内置的 `useSyncNodeData` 链路，且端口 id 命名自由，与统一约定不一致。

**收口建议 A**：将 `VideoExtractNode`、`VideoProcessNode` 改为 `NodeShell` 包裹，删除自有外框与硬编码 `Handle` id，统一走 `CustomHandle` 约定。

---

### 缺口 B · 节点注册两处平行维护，`nodeTypes` 不派生自 palette（最大暗门）

节点类型当前在 **两处** 维护，彼此独立、不互相派生：

1. `App.jsx` 的 `nodeTypes` 对象（字面量，16 项）：
   `textNode, imageNode, loopNode, promptNode, discountVideoNode, videoExtractNode, imageBoxNode, gridSplitNode, gridMergeNode, videoProcessNode, faceMosaicNode, panoramaNode, director3dNode, group, scriptBoxNode, ghostTarget`
2. `NodePalette.jsx` 的 `paletteNodes`（含 `hidden`/`builtin` 标记）+ `HIDDEN_TOP_LEVEL_NODES`：
   `textNode(hidden), imageNode, imageBoxNode, gridSplitNode, gridMergeNode, panoramaNode, director3dNode(builtin未标), faceMosaicNode, loopNode, videoExtractNode, videoProcessNode, group, scriptBoxNode, promptNode(hidden), discountVideoNode(hidden)`

关键事实：
- `NodePalette.jsx` 第 77 行算了 `builtinNodeTypes = paletteNodes.filter(n => n.builtin).map(n => n.type)`，**但 `App.jsx` 的 `nodeTypes` 完全独立手写，不引用它**。
- 两处是"平行手抄"，新增节点需手动在两处都加；若漏加 `nodeTypes`，对应 type 渲染失败，且**无启动期校验/告警**。
- `videoProcessNode` / `videoExtractNode` 实际上**两处都有**（均在 palette 且 builtin/可见，也在 nodeTypes）——早期版本称其"被刻意排除在 palette"是**错误**，已删除。
- `director3dNode` 在 palette 里**未标 `builtin:true`**，但在 nodeTypes 有、且用了 NodeShell——属于标记遗漏，不影响渲染但造成语义歧义。
- `templateNode`（`TemplateNode.jsx`，用了 NodeShell）**故意不在 nodeTypes 也不在 palette**：它是"新建节点的权威蓝本/模板"（注释"type 换成你的节点 type"），非业务节点，不计入缺口。

**收口建议 B（优先级最高）**：
- 建立**单一节点注册表**（如 `nodeRegistry.js`）：每个节点声明 `{ type, component, palette?, defaultData?, builtin?, hidden?, inputs?, outputs? }`；
- `nodeTypes`、`paletteNodes`、`defaultNodeData` 全部由注册表派生，删除两处平行字面量；
- 启动时断言 `Object.keys(nodeTypes)` 与注册表集合一致，缺失即抛出，杜绝静默遗漏；
- 补全 `director3dNode` 的 `builtin:true` 标记。

---

### 缺口 C · 管线数据传递已收口，但 `NODE_OUTPUTS` 覆盖不全 + 端口 id 命名未强制

**纠正早期错误**：早期版本称"连线 handle 命名形如 `out-*`/`in-*`"——**不实**。`useConnectedInputs` 完全不依赖 handle 前缀，它按 `edge.target === nodeId` 过滤，再按 source 节点的 `type` 查 `NODE_OUTPUTS` 表解析产出；仅 `scriptBoxNode` 用 `sourceHandle`（形如 `shot-${id}`）区分镜头。`CustomHandle` 的默认端口**不传 handleId**（React Flow 用 null id），只有多端口节点显式传 `handleId`。

管线数据传递**已经是统一收口的**（这是好消息），但存在两点不完善：

1. **`NODE_OUTPUTS` 声明表目前只覆盖 4 种节点**：`imageBoxNode`、`videoExtractNode`、`gridSplitNode`、`gridMergeNode`；其余节点靠 `genericOutput` 兜底（`imageUrl > videoUrl > resultUrl` + `data.mediaType`）。新增"非标准字段产出"的节点若漏加 `NODE_OUTPUTS` 声明，下游拿不到正确产出，且**无提示**。
2. **端口 id 命名自由**：`videoExtractNode` 用 `extract-left`/`extract-right`，`videoProcessNode` 用自定义 `CustomHandle`，NodeShell 默认端口无 id，脚本盒子用 `shot-${id}`。缺少统一的 `handleId` 生成规则与校验，未来新节点易踩坑。

**收口建议 C**：
- 在 `NODE_OUTPUTS` 附近加"声明完整性断言"：已知有产出的节点类型若未声明，开发期 warn；
- 定义 `CustomHandle` 的 `handleId` 命名约定（如 `out-*`/`in-*` 或语义化 id），并在 NodeShell/节点中强制经统一工厂生成，禁止硬编码散落 id；
- 把 `videoProcessNode`/`videoExtractNode` 的产出（抽帧图、音轨等）补进 `NODE_OUTPUTS`，使其与 `videoExtractNode` 现有声明风格一致。

---

### 缺口 D · 历史录制覆盖较全，但"程序化 spawn 连线"绕过 `onConnect`+历史

`App.jsx` 中 `history.record` 已覆盖（核查实际调用点）：
- 建节点（~505）、删节点（~518）、编组/解组（~550/565）、粘贴（~659）、自动排列（~692）、删线/连线（~537/659/1077/1142/1170）、节点拖动（~1328）、AI 生成（~779/926/988）、edge label 编辑（~1013）。

**真实缺口（程序化连线绕过）**：`VideoProcessNode.jsx` 在 spawn 子节点（图/音频/gif 结果节点）时，直接 `setEdges(eds => eds.concat(...))` 创建 `e-${id}-${nid}` 格式边（~709/732/755 行）。这些边：
- **不经过 App 的 `onConnect`**（无统一 `id` 前缀 `edge-`、`type:'custom'`、`markerEnd`、序号标签、双向缓存 `xyEdge...`）；
- **不进历史栈**（无 `history.record`）。

后果：视频处理结果节点与源节点的连线序列化形态与其他边不一致，且不可撤销。

**收口建议 D**：`VideoProcessNode` 的程序化建边应改为走统一连接入口（或将 `onConnect` 的补边逻辑抽取为可复用函数 `makeEdge(...)`，spawn 时调用并 `history.record`）。

---

### 缺口 E · 序列化无 schema 版本 / 无迁移

- `saveCanvasState` 直接写 `{ nodes, edges }` 整快照，key 前缀 `canvas-state-v1-`，但 **payload 本身无 `schemaVersion` 字段**；
- `loadCanvasState` 无版本校验、无迁移函数；
- `historyStack` 存纯 `{ nodes, edges }` 快照，同样无版本；
- 节点 data 中的产出字段（如 `extractedImages`、`imageUrl`）随节点序列化；将来节点改版字段结构，旧画布加载后无迁移兜底，可能错位。

**收口建议 E**：
- 在持久化 payload 顶层加 `schemaVersion: N`；
- `loadCanvasState` 增加 `migrate(state)` 分发，旧版本按规则补字段或重算；
- 历史快照同样记录版本，回放时按版本解释（或仅允许回放同版本快照）。

---

## 3. 收口优先级建议（探索产出，待立项）

| 优先级 | 缺口 | 风险 | 收益 |
| --- | --- | --- | --- |
| P0 | B 注册表统一（nodeTypes 派生自注册表 + 启动断言） | 高（新增节点静默失效、两处手抄易漏） | 一次性消除"暗门"，后续节点零成本接入 |
| P1 | D 视频节点程序化连线改走统一入口 + 进历史 | 中（现有画布边形态兼容） | 消除唯一绕开 onConnect/history 的连线路径 |
| P1 | E 序列化 schemaVersion + migrate | 中 | 画布可演进，避免旧数据错位 |
| P2 | A 视频两节点改用 NodeShell | 低（外观/一致性） | 统一外框与同步链路 |
| P2 | C NODE_OUTPUTS 覆盖断言 + handleId 命名约定 | 低 | 管线契约健壮性、降低新节点踩坑 |

---

## 4. 关键事实对照（核查索引）

- 统一外框实现：`src/components/base/NodeShell.jsx`（提供标题栏/工具条/默认 Handle + 内置 useSyncNodeData/useConnectedInputs；**不写回 ports/portIds**）
- 数据同步：`src/components/base/useSyncNodeData.js`（`setNodes` + `history.record`）
- 上游输入/管线契约：`src/components/base/useConnectedInputs.js`（`NODE_OUTPUTS` 表 + `getNodeOutput` + `genericOutput`；按 `edge.target` 聚合，不依赖 handle 前缀）
- 历史栈：`src/components/base/historyStack.js` + `App.jsx` 桥接
- 边统一补 id/type：`App.jsx` `onConnect`
- 注册两处：`App.jsx` `nodeTypes`（16 项字面量）/ `NodePalette.jsx` `paletteNodes`+`HIDDEN_TOP_LEVEL_NODES`（`builtinNodeTypes` 算出却未被引用）
- 未复用 NodeShell 的业务节点：`VideoProcessNode.jsx`、`VideoExtractNode.jsx`
- 程序化旁路连线：`VideoProcessNode.jsx` ~709/732/755（`e-${id}-${nid}` 格式，`setEdges` 直连，不进历史）
- 序列化：`saveCanvasState` / `loadCanvasState`（无 schemaVersion、无 migrate）
- `templateNode`：`TemplateNode.jsx`，新建节点蓝本，故意不注册（非缺口）

---

## 5. 结论

节点体系与管线的**骨架已收口**：`NodeShell`（统一外框+同步+输入）、`useConnectedInputs`/`NODE_OUTPUTS`（管线数据传递已统一收口）、`onConnect` 统一补边、`historyStack`（覆盖建/删/拖/AI 生成等）、组/循环的 ghost 连线。

仍存在 **5 个明确缺口**：

1. `videoProcessNode`/`videoExtractNode` 未复用 `NodeShell`（自写外框+Handle）；
2. 节点注册两处平行维护、`nodeTypes` 不派生自注册表（最大暗门）；
3. 管线契约 `NODE_OUTPUTS` 覆盖不全 + 端口 id 命名未强制统一；
4. 视频节点程序化 spawn 连线绕过 `onConnect` 与历史栈；
5. 序列化无 schema 版本与迁移。

建议按 P0（注册表）→ P1（视频连线 + 序列化版本）→ P2（视频外框 + 管线契约健壮性）顺序推进。

> 本文档为探索产物，未对任何文件做改动。

---

## 6. 自审修订记录（审计说明）

本版由作者自审后修订，纠正初版以下事实错误：

1. **删除虚构的 `data.ports`/`data.portIds` 写回机制**：grep 全仓确认不存在。
2. **删除"连线 handle 命名 `out-*`/`in-*`"断言**：实际使用默认 null id（NodeShell 默认端口）、`shot-${id}`（脚本盒子），管线不依赖 handle 前缀。
3. **删除虚构节点名**（agentNode/codeNode/htmlNode/translateNode/summarizeNode/textInputNode 等）：这些文件在 `src/components` 不存在；改用 `import NodeShell` 精确统计的 14 节点真实清单。
4. **纠正"videoProcessNode 被刻意排除在 palette"**：该节点实际在 palette（builtin/可见）且已在 nodeTypes，并非例外。
5. **补充 `templateNode` 为新建蓝本、故意不注册**，不计入缺口。
6. **区分"管线数据传递已收口"与"`NODE_OUTPUTS` 覆盖不全"**：避免把已解决问题写成缺口。
7. **将"视频旁路建边"定性为程序化 spawn 连线（~709/732/755），而非用户手动连线**，更准确。
