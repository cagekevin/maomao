# CONTEXT.md — 决策地图（写代码前必读的唯一入口）

> **最高准则：代码即知识。** 每个机制的具体"是什么/怎么用"，看对应**代码文件头部的注释**（它们已写得很清晰，如 `eventBus.js`/`toastStore.js`/`asyncGuard.js`）。本文件**不是机制百科**，而是**决策地图**——只回答代码本身回答不了的问题：`这个功能放哪 / 该调哪个唯一入口 / 哪些红线不能碰`。
>
> **本文件 = 唯一要维护的文档。** 日常写码/排任务，先读本页 → 按图索骥到代码 → 代码注释给足知识。**不要**为每个机制新建/维护文档（临时调查产物不落盘）。机制知识以代码为准，本页以"决策 + 红线"为准。

---

## 一、代码怎么组织（4 层）

### A. 状态放哪（3 问决策）
```
Q1 需跨组件共享？ → 是 → store；否 → Q2
Q2 需持久化？     → 是 → store + `contentStore`（见 §二④）；否 → Q3
Q3 单组件内部临时？→ 是 → 组件 useState
```
- store 统一模式：模块级状态 + `subscribe` + `useSyncExternalStore` 快照（**快照引用要稳定**，变更才换新引用，否则无限重渲染）。
- 禁止：组件内 useState 存本应全局共享的数据；组件直接改模块级变量。

### B. Hook 分类（每个 hook 属且只属一类）
`数据桥接`(useConnectedInputs/useSyncNodeData) / `交互`(useCanvasShortcuts/useContextMenu/useAssetDropPaste) / `能力`(useMediaDegrade/useVideoPoster/useFitNodeRatio) / `引擎`(useScriptBoxEngine/useNodeGeneration) / `状态`(useAgentChat) / `lod`(base/lod.jsx 的 useLod + LodProvider，画布性能降级数据源，内部自带缩放监听)。
- 命名 `useXxx`；hook 只封装逻辑，不写 UI；纯逻辑可单测。

### C. 配置集中（`src/components/base/config.js`，已建）
- 环境变量（`import.meta.env.VITE_*`）集中读一次；魔法数字/超时/阈值命名常量。禁止各文件裸读 env、裸写数字。

### D. 组件目录（渐进迁移，不强制批量）
`components/nodes/`（节点）/ `panels/`（面板）/ `scriptbox/`（剧本盒）/ `base/`（基座+横切）/ `edges/`（连线）。
- 新增组件放对应子目录，**不新增平铺顶层**；存量改到哪个顺手迁到哪。

> 详情见 `spec/代码组织结构规范.md`（可迭代）。

---

## 一·5、顶层架构（画布编排 × 节点体系）

> **顶层 = 全项目最高层的「骨架与红线」。** 通用机制（横切/并发/安全/一致性）见下文 §二~§五；
> 本层只讲「整个画布怎么组织、节点怎么进来」这两件最高层的事。改画布/节点先读本层，再往下走。
> **定位：只写"放哪/唯一入口/红线"，机制明细看代码注释与 `spec/NEW-NODE-GUIDE.md`。**

### A. 画布核心编排（唯一中心：`src/App.jsx`）
- **App.jsx 是唯一编排中心**，`Canvas` 组件内分 6 区：常量配置 / 状态 / 能力 / 菜单 / 事件 / 渲染（搜 `【区 N】` 注释定位）。
- **画布状态**：`nodes/edges` 用 `useNodesState/useEdgesState`；**必须同时维护 `nodesRef/edgesRef` 最新快照**——能力区（【区 3】）读 `nodesRef.current` 取最新值。**原因**：reactflow 的 `onNodesChange` 回调构建在 `useCallback` 闭包中，若回调直接引用 `nodes`，会给所有已注册回调绑定**旧闭包**（拿不到后续最新值）；只有 `ref` 是稳定引用、能始终读到最新快照。直接读 state 取旧值 = 撤销丢新增 / 批量写回错位（FINAL-057 系列已验证为高风险点）。
- **项目系统链路**：`currentProjectId`（projectStore，useSyncExternalStore）→ 画布快照走 localTool KV（`canvas-state-v1-{projectId}`）加载 + **600ms 防抖自动保存** + 多窗口 `BroadcastChannel('yimao_canvas_sync')` 冲突提示。
- **历史栈**：`useCanvasHistory`，`record` 必须**显式传最新快照**（`nodesRef/edgesRef`），禁异步 setState 取旧值。
- **AI 会话按项目隔离**：`agentKey = canvas-assistant-<projectId>`，conversationStore 据此隔离存储（新建项目 = 新会话）。
- **连线统一入口**：用户连线走 `onConnect`（edge id 去重 + 记历史）；拖到空白走 `onConnectEnd`（建 ghost-target + 弹连接菜单）。⚠️ **程序化建边也必须复用 onConnect 语义**（勿直接 `setEdges` 绕过——FINAL-057 D 未修，改动面大，谨慎）。
- **性能降级**：`LodProvider + useLod`（viewportMoving / nodeCount / edgeFxLimit），见 `base/lod.jsx`。

### B. 节点体系（顶层规则）
- **单源节点目录**：`base/NodePalette.jsx` 的 `paletteNodes` 是**唯一节点目录**（type/label/icon/cat/data/builtin），右键菜单/节点面板/`defaultNodeData` 都从它派生。
- **⚠️ 顶层红线：新增节点必须 4 处同步**（详细流程见 `spec/NEW-NODE-GUIDE.md` §六）：
  1. `NodePalette.jsx` `paletteNodes` 登记；
  2. `App.jsx` `nodeTypes` 加 `type → 组件`（⚠️ 当前仍是**手写平行表**，与 palette 双维护，漏了=节点建不出来，是已知回归陷阱）；
  3. `useConnectedInputs.js` 的 `NODE_OUTPUTS` 声明产出（**最易漏**，漏了下游连了线也拿不到数据）；
  4. 文档/交接登记。
- **节点统一范式**：外壳用 NodeShell（禁止手写外壳）；UI 用 `useState(data.xxx)`、写回用 `setNodes` 不可变更新；上游数据走 `useConnectedInputs`。详见 NEW-NODE-GUIDE.md。
- **管线契约**：`useConnectedInputs.js` 的 `NODE_OUTPUTS` 是「下游自动拿上游数据」的唯一声明，有产出的节点必须登记，数组型用 `arrayImages` 归一。

### C. 地基统一收口（怎么设计 / 怎么收口）
> **每套地基遵循同一收口思路：纯逻辑下沉纯类/纯函数 → UI/React 只做桥接 → 单一入口。** 改地基先读文件头注释（代码即知识）。以下是被反复验证过的收口规范：

1. **撤销/历史**：`historyStack.js`（纯类，可单测）持逻辑，`useCanvasHistory.js`（hook）只桥接 React；`record` 必须**显式传最新快照**（异步 setState 会取旧值 → undo 丢新增）。画布类操作统一走它，勿自建撤销。
2. **节点生成统一契约**：`useNodeGeneration.js` 收敛"提交→进度→成功双写(taskStore+node.data)/失败"样板，节点**禁止**手写生成样板（以前每节点重复 ~40 行）；`run` 执行器接 `AbortSignal` 供 stop 真中断。
3. **错误/异步收口**：`genErrors.js`（classifyError 分类）+ `asyncGuard.js`（withTimeout 超时）统一；禁止节点自写 `if(/网络错误/)`、禁止无超时 Promise。决策见 §三。

### D. 收口准则（何时统一集中管理）【顶层决策规范】
> **规则：任何逻辑若「手写 ≥3 次」，必须抽统一入口集中管理；除非存在「必须不能收口」的硬约束。**
>
> **判断两步**：
> 1. **计数**：这段逻辑是否已/将在 ≥3 处重复手写？（写新代码前先想"会不会再来一次"）
> 2. **例外**：是否有必须各自独立的硬理由？——性能独占 / 领域硬隔离 / 上游契约钉死 / 安全隔离。**有才可不收口**，且必须在该处注释原因（不设 deadline）。
>
> **落地**：抽到对应层的唯一入口（通用纯工具→§二⑥、业务能力→§二⑤、存储→§二④、生成→`useNodeGeneration`、撤销→`useCanvasHistory`、下载→§二⑦），并在 `contracts.js`/对应登记表落地。已存在的重复手写 → 见 §六 待办逐一收敛。
>
> **反面警示**：收口不是"建个文件就行"，必须**让所有调用走它、堵死绕道**（如 `idGen.js` 已收口，但 `accountsStore`/`ShortcutSettings` 仍手写 `Date.now().toString` 绕过——已收口却仍绕道=更糟）。

---

## 二、横切机制（7 块，各一个唯一入口）

| 块 | 唯一入口 | 一句话 | 禁止 |
|----|---------|--------|------|
| ① 通信 | `eventBus.js` (publish/subscribe) | 瞬时事件广播；事件先登记 `contracts.js` EVENTS | ❌ eventBus 存状态 / store 发事件 |
| ② 表现 | `toastStore.js` (toastSuccess/Error/Warning/Info) | 业务只调语义化 4 档 | ❌ `showToast('x',{type})` 混写 |
| ③ 观测 | `logger.js` (logger.info/warn/error) | 记录+上报，供排查 | ❌ 裸 `console.log/warn/error` |
| ④ 持久化 | **`contentStore`**（横切存储权威入口）+ `storageAdapter`/`kvStore`（底层） | 业务读写走 `contentStore`（按 STORAGE_KEYS 自动路由 local/KV/native）；`storageAdapter` 是底层，业务**禁止**直调 | ❌ 直调 storageAdapter / 散落字符串字面量 |
| ⑤ 能力 | `mediaType`/`clipboard`/`filesApi`/`imageUrl`... | 业务能力单一入口 | ❌ 手写正则/URL拼接/压缩 |
| ⑥ 工具 | genId 已落 `base/idGen.js`；deepClone/formatTime/throttle/debounce **待统一**（见 §六 待办） | 通用纯工具 | ❌ 手写 `Date.now().toString(36)`/`Math.random` 造 ID |
| ⑦ 下载 | `clipboard.downloadUrl` | 文件下载/导出 | ❌ 自写 `createObjectURL + a.download` |

**协作**：弹提示→②；记日志→③；广播→①；存数据→④；算/转换→⑤⑥；下载→⑦。**不越层**（toast 不写日志、logger 不弹提示）。

**登记表**：`src/components/base/contracts.js`（EVENTS/STORAGE_KEYS/GEN_ERRORS）——新增事件/存储键/错误类型先登记再实现。

> 详情见 `spec/横切基础设施分层.md`（可迭代）。

---

## 三、异步与并发治理（项目核心风险）

**铁律：打爆上游 = 大忌。** 并发必须受控，绝不无限叠加。

### 并发治理（全局统一，当前只治了生图一处）
- **生图**：`config.js` `GEN_MAX_CONCURRENT = 6`（已实现，taskStore 引用，超出跳过待用户手动点）。
- **待统一**：视频生成 / 图片压缩 / 文件上传 / Agent 批量任务的并发**尚无全局治理**。
- 设计目标：全局信号量/并发池，各操作分预算（生图 N/视频 M/上传 K/压缩 P），超限**排队或跳过**（生图=跳过，其他=排队）。
- **新增任何会并发触发上游/耗资源的操作，先想"并发上限是多少、超了怎么办"**。

### 异步一致性
- 异步操作统一支持 `AbortSignal`（可取消）；停止必须真中断 fetch/SSE/轮询。
- 竞态防护：请求带 id，返回校验是否最新（`asyncGuard.js` 统一用法）。
- 超时统一：`withTimeout`（asyncGuard）+ 命名常量（config）。
- 错误分类：统一走 `genErrors.js`（classifyError → type → 决策），节点**禁止**自写 `if(/网络错误/)`。
  - 自动重试：仅网络/超时（`withRetry`，最多 3 次指数退避）；上游业务失败不自动重试（防封号）。
  - 决策表见 `docs/09-节点错误降级与重试收敛策略`（✅ 质量高，保留为明细）。

---

## 四、安全与密钥铁律（完全空白，最高优先遵守）

1. **密钥只进 `.env`**（已 gitignore），**绝不硬编码 / 绝不入库**（`apimart-gateway/.env` 含真实 AK/SK）。
2. **前端不落地 AK/SK**：只经 localTool/网关转发；前端代码禁止出现真实密钥。
3. **日志/上报脱敏**：任何日志、toast、上报 body 不得含密钥/token。
4. **代理访问**：连 Lovart 必须 VPN；git push 走代理 7897。
5. **新增外部系统接入**：先查本文件，密钥走环境变量，禁止硬编码。

---

## 五、数据一致性防线（画布 ↔ 任务 ↔ 磁盘）

- **唯一 ID 铁律**：nodeId/edgeId/taskId 生成与去重集中（走 `base/idGen.js` 的 `generateId`），禁止各造各的。
- **字段映射集中**：前端 camelCase ↔ 后端 snake_case 以 CONTRACTS 为准，禁止散落转换。
- **快照稳定**：所有 store 的 getSnapshot 引用缓存（防无限重渲染）。
- **新增 store/持久化**：自查"会不会产生画布↔任务↔磁盘不一致"（CLAUDE §四 有运行时排查脚本，写码时主动规避）。

---

## 六、维护纪律（一份为中心，代码即知识）

**分工原则**：
- **机制"是什么/怎么用" → 看代码注释**（`eventBus.js`/`toastStore.js`/`asyncGuard.js` 头部已写清）。代码清晰，它就是知识，**不必另写文档**。
- **"功能放哪/选哪个入口/红线" → 看本文件**（决策地图）。
- **真正的专项文档只留少量**（决策/策略需要篇幅的，如错误降级）。

**只维护**（可更新/迭代）：
- ✅ 本文件 `CONTEXT.md` —— **唯一中心（决策地图），日常必读**
- ✅ `src/components/base/contracts.js` —— 登记表（代码事实）
- ✅ `docs/09-节点错误降级与重试收敛策略` —— 错误重试策略（需要篇幅，保留）
- 🔹 可选：`docs/代码组织结构规范.md` / `docs/横切基础设施分层.md` —— 已有，作为明细；**不再扩展新内容**（机制知识下沉到代码）

**不维护**（历史调查产物 / 已并入，不主动更新）：
- 🟡 `07-Toast` / `08-存储键` / `09-日志` / `01-06` / `实时总线` / `CONTRACTS-2026-08-16` → 机制以本文件 §二 + 对应代码注释为准

**新增机制**：能靠代码注释表达的就写注释（不建文档、不立 ADR）；确需全局决策的才在本文件登记（横跨 ≥2 处 → 代码注释写清收口原因与红线 + 本文件登记），并在 `contracts.js` 落地。**临时调查产物不落盘成正式文档。**

### 顶层已知待办（已确认、未修，后续立项）
> 来源：`docs/agent 批量任务/FINAL-收口缺口核实终稿`（人工核实）。改动前先查，避免重复踩/重复提。
> 工具统一 → §二⑥；其余多为中风险重构，改前需评估下游。
1. **通用工具统一**：deepClone / formatTime / throttle / debounce 尚无集中实现（genId 已在 `base/idGen.js`），业务零散手写（如 `JSON.parse(JSON.stringify())`）。
2. **nodeTypes 单源化**：`App.jsx nodeTypes` 与 `NodePalette` 双维护，漏登记=节点建不出来（FINAL-057 B，中风险）。
3. **程序化建边统一走 onConnect**：部分节点直接 `setEdges` 绕过 onConnect 校验/撤销栈（FINAL-057 D，改动面大）。
4. **统一节点错误降级/重试收敛**：节点级 catch 大多只 setState 不收敛（FINAL-056，架构级）。
5. **本地预览收口**：`URL.createObjectURL` 手写 ≥10 处（节点选图预览/视频加载），无统一入口（区分于下载 `downloadUrl`，这是「临时预览 URL」，应抽 `imageUrl`/能力层统一，含 revoke 清理）。
6. **已收口却仍绕道的反例**：`idGen.js` 已收口，但 `accountsStore`/`ShortcutSettings` 仍手写 `Date.now().toString` 造 ID → 需收敛回 `generateId`（先 grep 全库堵死绕道）。

> **铁律**：**别为"文档齐全"而写文档。** 维护文档 = 维护负担 = 会过期。让代码当知识，本文件当地图，文档只补代码表达不了的决策。

### 🔄 保鲜机制（防止规范过时——不靠自觉，靠这 3 条）

**1. 强制二选一（改代码 or 改本文件，必须同步）**
> 写代码时若发现**本文件某条与最新代码不符**：要么改代码符合它，要么更新本文件这条。**禁止"代码改了、本文件留着旧说法"**——规范失真比没有规范更糟。

**2. 数字/事实不写死**
> 本文件**禁止写会过期的具体数字**（文件数、用例数、行号、版本）。需要就说"见代码/跑 npm test"，让事实活在代码里，本文件只留"决策与红线"。

**3. 规范最小化（能下沉就下沉）**
> 凡是能靠**代码注释**表达的机制，一律写注释，不写进本文件。本文件只保留**代码回答不了**的：放哪、选哪个入口、红线。规范越短，越不可能过时。

> **自检**：改动代码后，若本文件不需要更新 → 说明规范内容"无事实绑定"，长期稳定；若需要更新 → 说明它是活规范，随代码演进，正常。
