# TASK-052 探索：节点功能链路缺口

> 任务类型：探索（不写代码，只盘点链路现状并给出缺口结论与修复方向）
> 范围：`src/components/*.jsx` 全部节点 + `src/components/base/` 公共链路（任务中心 / 统一生成契约 / Agent 工具 / 编排执行器 / 编组级联）
> 日期：2026-08-17
> 审计状态：已对代码逐节点交叉核实，本文所有断言均可定位到具体文件/行。

---

## 一、判断标准

"功能链路完整" = 节点走通闭环：**被 Agent 创建 → 接收上游输入 → 触发产出 → 上报任务中心 → 可被 Agent 驱动（`runNodeGeneration`）→ 级联删除/撤销可捕获**。

对照公共链路的 4 个硬杠（均已在代码中确认）：

| 杠 | 实现位置 | 作用 |
|----|----------|------|
| ① Agent 可创建 | `useCanvasAgentTools.js` `create_node` 工具 `enum` | 限制 Agent 能建的节点类型 |
| ② Agent 可驱动 | `useNodeGeneration.js`（effect 里 `registerTaskRetry`）→ `taskStore.runNodeGeneration(nodeId)` | 节点须把 `start` 注册进 `retryRegistry`，否则 `runNodeGeneration` 返回 `false` |
| ③ 产出进任务中心 | 节点生成后调 `reportGenerate(...)` 写 `taskStore` | 进"生成历史/可重做"，并进入依赖可观测面 |
| ④ 级联删除/撤销 | `groupNodes.js` `deleteNodesWithCascade(nodes, edges, ids)`（按 `parentId` 递归）+ `AgentPanel`/`App` 的 AI 撤销栈 | 删父节点应连带其子孙，不残留孤儿 |

**两个关键实现细节（补漏，影响 GAP 表述）：**
- `runNodeGeneration` 有并发上限 `MAX_CONCURRENT_GEN = 6`：活跃生成已达 6 个时，即使节点已注册也会返回 `false`（节点保持"待生成"，等用户手动点）。这是 A 组节点本身也受的已知约束。
- 级联删除 `deleteNodesWithCascade` **按 `parentId` 递归收集子孙并删相关边**，不依赖 source 边。孤儿节点（无 `parentId`、无边）删父时不会被带走。

---

## 二、公共链路现状（已实现、能力完整）

| 模块 | 文件 | 能力 |
|------|------|------|
| 任务中心 | `base/taskStore.js` | `registerTaskRetry` / `unregisterTaskRetry` / `isNodeRegistered` / `runNodeGeneration` / `reportGenerate` / `retryTaskNode` |
| 统一生成契约 | `base/useNodeGeneration.js` | 节点 `useNodeGeneration()` → effect 内 `registerTaskRetry(nodeId, start)` → 进入 `retryRegistry`；含 `maxConcurrent`/超时/重试/双写（`taskStore` + `node.data`） |
| 级联删除 | `base/groupNodes.js` `deleteNodesWithCascade` | 按 `parentId` 递归删子孙 + 删相关边（根治"删组留孤儿"） |
| AI 撤销/重做 | `AgentPanel.jsx` + `App.jsx` | 独立 `aiUndoStack` / `aiRedoStack`，记录 `addNodes`/`deleteNodesWithCascade` 前后快照 |
| Agent 工具 | `base/useCanvasAgentTools.js` | `create_node` / `execute_plan` / `generate_node` / `update_node` / `undo_ai` 等 |
| 编排执行器 | `base/canvasPlanExecutor.js` | `executePlan` → `ctx.addNodes` 建 `promptNode` → 轮询 `isNodeRegistered` → `runNodeGeneration(id)` 驱动 |

> **约束链**：`execute_plan` 只建 `promptNode`；`runNodeGeneration(id)` 依赖 `isNodeRegistered(id)`（即 `retryRegistry` 里有该 id）；而注册**只发生在 `useNodeGeneration` 的 effect 里**。所以"未 `useNodeGeneration`" ≡ "Agent 无法驱动"。

---

## 三、节点全量对照表（共 22 个业务节点）

`search_content` 对 `useNodeGeneration|registerTaskRetry|reportGenerate` 在 `src/components/*.jsx` 的命中：**仅 4 个节点文件 + NodeShell(基座复用) + LeftPanel(监听)**。其余节点零命中。

### A 组：链路完整（①~④ 全满足）

| 节点 | `useNodeGeneration` | `create_node` enum | 任务中心上报 | 说明 |
|------|:--:|:--:|:--:|------|
| `TextNode` | ✅ | ✅（`textNode`） | ✅ | 文本生成，完整 |
| `TemplateNode` | ✅ | 经 `textNode` 创建 | ✅ | 模板变体，复用 textNode 类型与生成契约 |
| `PromptNode` | ✅ | ✅（`promptNode`） | ✅ | 生图，级联/撤销核心，完整 |
| `DiscountVideoNode` | ✅ | ✅（`discountVideoNode`） | ✅ | 视频生成，完整 |

> 注：`create_node` 实际 `enum = ['textNode','promptNode','imageNode','discountVideoNode','scriptBoxNode','group']`（见 `useCanvasAgentTools.js`）。其中 `imageNode` 是 PromptNode 的产出容器、`scriptBoxNode` 是剧本盒、`group` 是编组——它们本身不是"生成型"，故不需要 `useNodeGeneration`（见下）。

### B 组：展示 / 容器 / 编组型（非生成型，链路合理，非缺口）

| 节点 | 接 `useNodeGeneration`? | 角色 | 链路评价 |
|------|:--:|------|----------|
| `ImageNode` | ❌ | 接收 image/video/audio/text 的展示节点（PromptNode 产出载体） | 合理：本身不生成，靠上游喂数据 |
| `ImageBoxNode` | ❌ | 多图容器，是"切分/拼图/全景/打码/抽帧"的共同上游枢纽 | 合理：容器不生成 |
| `ScriptBoxNode` | ❌ | 剧本盒 | 已入 `create_node` enum，可创建 |
| `GroupNode` | ❌ | 编组容器，靠 React Flow `parentId` 机制 | 合理：容器 |

### C 组：后链路生产 / 处理节点（**缺口主体**）

| 节点 | `useNodeGeneration` | `create_node` enum | 产出机制 | 断链项 |
|------|:--:|:--:|------|--------|
| `VideoProcessNode` | ❌ | ❌ | 本地 mediabunny/gifenc 浏览器引擎；落盘 `/files/`；spawn `imageBoxNode` | ①③④ |
| `PanoramaNode` | ❌ | ❌ | 本地 Three.js 球视图；截图 spawn `imageNode` | ①②③④ |
| `FaceMosaicNode` | ❌ | ❌ | 本地 MediaPipe + canvas；spawn `imageNode` | ①②③④ |
| `Director3DNode` | ❌ | ❌ | 双击开 3D 导演台；截图写 `imageBoxNode` | ①③④ |
| `LoopNode` | ❌ | ❌ | LB 模式 spawn 下游 `promptNode`（级联改下游 data） | ①③④ |
| `GridSplitNode` | ❌ | ❌ | 网格切片 → 多 `imageBoxNode` | ①③④ |
| `GridMergeNode` | ❌ | ❌ | 拼接网格 → 单 `imageBoxNode` | ①③④ |
| `VideoExtractNode` | ❌ | ❌ | 本地 canvas 抽帧 → `extractedImages` | ①②③④ |

> C 组 8 个节点全部不调 `reportGenerate` / `registerTaskRetry` / `runNodeGeneration`，也不在 `create_node` enum。它们靠"用户手动点 UI / 节点内部 `setNodes` 本地 spawn"产出。

---

## 四、缺口结论（GAP）

### GAP-1：Agent 无法创建后链路生产节点
`create_node` enum 仅 6 种，后链路 8 节点（C 组）全不在列。Agent 编排只能停在 `promptNode` 层，用户必须手拖后续处理节点。

### GAP-2：Agent 无法驱动后链路生产节点（最致命）
`runNodeGeneration(nodeId)` 查 `retryRegistry`，未注册返回 `false`。代码自身已认知此边界——`generate_node` 工具对未注册节点明确返回：
> `节点 ${id} 未注册生成契约（类型 ${node.type} 暂不支持由 Agent 驱动）`

因此 C 组节点的产出只能靠人工触发，Agent 多步流水线到"处理图"这一步必然断。注意：对 A 组这叫"有意收敛"，对 C 组则是真实能力缺口（用户手能动、Agent 不能动，破坏编排闭环）。

### GAP-3：后链路产出不进任务中心 / 不可重做 / 不动级联
C 组不调 `reportGenerate`，故：
- 不进"生成历史"面板，无法回看/重做；
- 上游（如上游 promptNode）重生成后，没有任何重算流程会带动这些后处理节点（它们不在 `retryRegistry`，也不在任何 `depends_on_previous` 依赖图里）。
> **修正旧稿**：代码里**不存在**名为 `getDependentNodes` 的自动级联重算函数；级联只发生在 `canvasPlanExecutor` 的 `depends_on_previous` 分批 + `runNodeGeneration` 单点触发。故"上游改动自动重算下游"对 C 组天然不成立，而非"漏接某函数"。

### GAP-4：后链路 spawn 的下游节点逃逸级联删除
`deleteNodesWithCascade` 按 `parentId` 递归。C 组节点 spawn 下游（imageBoxNode / imageNode / promptNode）时**不建 `parentId`、也不建 source 边**（对 C 组搜 `addEdge` 零命中，均为 `setNodes` 直加孤立节点）。结果：删父节点（如 LoopNode）时，其 spawn 的下游成为**孤儿节点**残留在画布；AI 撤销栈同理可能不回滚这些 spawn 产物。

### GAP-5（已知约束，非缺口，但需记录）：A 组并发上限
即使完整链路节点，单次 `execute_plan` 若规划 >6 个生成，`runNodeGeneration` 因 `MAX_CONCURRENT_GEN=6` 跳过超额节点（保持"待生成"）。这是设计取舍，但编排大批量图时需知悉。

---

## 五、影响面排序（按破坏力）

1. **GAP-2 驱动** — 最致命：Agent 编排只能生图/视频，无法自动"处理图→全景/打码/切九宫格/抽帧"，多步任务必人工插手。
2. **GAP-1 创建** — Agent 连节点都建不了，编排能力锁死在 promptNode 层。
3. **GAP-3 历史/级联** — 产出不可追溯、上游改动不联动，违背"画布即可复现工作流"。
4. **GAP-4 删除/撤销逃逸** — 孤儿节点/脏数据，低频但难排查。
5. **GAP-5 并发上限** — 已知约束，大批量编排需注意。

---

## 六、修复方向（供后续实施任务，不在本探索落地）

1. **统一后链路生成契约**：为 C 组 8 节点封装各自"生成函数"，接入 `useNodeGeneration`（或新增 `registerLocalGenerate(nodeId, fn)` 适配本地引擎），使 `isNodeRegistered` 为真、`runNodeGeneration` 可驱动。
2. **扩展 `create_node` enum**：纳入 8 个后链路节点类型，补 `defaultNodeData` 与 description。
3. **产出上报**：C 组 spawn 下游前先 `reportGenerate(input→output meta)`，使结果进生成历史、进入依赖可观测面。
4. **级联删除修正**：C 组 spawn 下游时写入 `parentId = 父节点id`（或建 source 边），使 `deleteNodesWithCascade` 能递归带走；并验证 AI 撤销栈对 spawn 产物的回滚。
5. **并发上限评估**：评估 `MAX_CONCURRENT_GEN=6` 对后链路批量处理的适用性，必要时按节点类型区分上限。

---

## 七、审计说明（本文相对初稿的修正）

- 删除初稿中误引的 `getDependentNodes`（代码无此函数）；级联重算机制已按 `canvasPlanExecutor` + `runNodeGeneration` 真实实现重写。
- 将"展示/容器/编组型"节点（ImageNode/ImageBoxNode/ScriptBoxNode/GroupNode）从"缺口"中剔除，单列 B 组说明其不接生成契约是**合理设计**，避免误报。
- GAP-4 由"可能逃逸"升级为"确认逃逸"：基于 `deleteNodesWithCascade` 按 `parentId` + C 组 spawn 无 `parentId`/无边的实测。
- 补 `MAX_CONCURRENT_GEN=6` 并发约束（GAP-5）。
- 补 `create_node` 精确 enum 列表与节点全量 22 节点对照表，确保无遗漏。

## 八、未覆盖边界（待后续任务确认）

- 自动化（automation）触发链路对 C 组节点的可达性未验证。
- `conversationStore` 跨对话隔离对后链路节点 data 的影响未验证。
- C 组各节点"用户手动产出"的完整路径（含双击编辑器子组件）仅抽检，未逐函数走读。
