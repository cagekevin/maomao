# CONTEXT.md — 决策地图（写代码前必读的唯一入口）

> **最高准则：代码即知识。** 本文件**不是机制百科**，而是**决策地图**——只回答代码本身回答不了的问题：`这个功能放哪 / 该调哪个唯一入口 / 哪些红线不能碰`。机制的具体"是什么/怎么用"，请看对应**代码文件头部的注释**。

> **🔝 第一原则：能用原生，绝不外求。** 能用 React 内置和浏览器原生解决的，绝不引第三方库；能用已收口的 `base/utils.js` 解决的，绝不手写。第三方库仅在原生代价过高时引入并在此登记。

### 🎯 产品定位铁律（单人自用，最高优先）

本项目 99% 只有开发者个人使用。一切设计只服务**一个正常用户的真实用法**，**操作流畅是第一要求**。

* **不做过度防御**：防高并发/防安全漏洞等"防恶意用法"机制不需要。API Key 泄露改 Key 即可；用户用不对在前端教育，不让系统防得太狠。
* **死守系统稳定性**：代码引起的后端崩溃、丢数据、状态不一致必须治理。
* **轻量兜底，拒绝包装**：允许降级和重试，但**错误必须真实透传**。禁止归一化把原始错误变成"查不出来"的笼统信息。能查到真相 > 界面好看。
* **少重复，要收口**：同一套逻辑绝不手写多份。逻辑与 UI 不混（逻辑下沉 `base/`，组件只管渲染）。少一份重复 = 少一份维护，干净 = 查得快。
* **新机制决策**：先问"这是为真实用法服务，还是为了显得专业/安全？"前者做，后者砍。
* **重构边界（最高优先，写码前先问）**：架构收口/重构只针对**核心关键链路 + 容易出错的热点区域**。特定功能模块（视频抽帧、剧本盒、导演3D、网格拼接、人脸打码等"为实现特定功能而来"的节点）**不主动收口**——它们不常改、收口无维护收益，改坏了反而更麻烦。判断标准：这个区域**经常改吗？改错了影响核心链路吗？** 两个都不沾 → 不动它。砍收口也是"降复杂度"的一种。

### 🧭 双区阅读法（单人懒人模式）

本文件分两块，研究完的事项**看一条删一条**，绝不留"已否决"占位：

* **🔴 必做区（一至五）**：日常写码必须遵守的决策与红线。
* **🟡 建议区（六）**：还没采纳、有空才研究的待办与建议。状态必须标注（`✅已完成 / 🚧进行中 / 🔬待研究 / ❌已否决`）。

---

## 一、代码组织决策（4 层）

### A. 状态放哪（决策路由）

| 场景需求 | 决策 | 规范说明 |
| --- | --- | --- |
| **跨组件共享** | `store` | 模块级状态 + `subscribe` + 快照（引用必须稳定）。禁止组件内 useState 存全局数据。 |
| **需要持久化** | `store` + `contentStore` | 详见本文档第二节的持久化机制。 |
| **单组件临时** | `useState` | 组件内部状态管理。禁止组件直接改模块级变量。 |

### B. 组件与 Hook 规范

* **组件目录归类**：已全部归类至 `nodes/`、`panels/`、`scriptbox/`、`base/`、`edges/`。**禁止新增平铺顶层组件**。
* **Hook 分类**：分为数据桥接、交互、能力、引擎、状态、lod。命名 `useXxx`，只封装逻辑不写 UI，纯逻辑需可单测。
* **配置集中**：环境变量统一在 `config.js` 读一次。魔法数字/超时/阈值命名常量。禁止各文件裸读 env 或裸写数字。

---

## 一·五、顶层架构（画布编排 × 节点体系）

### A. 画布核心编排（唯一中心：`src/App.jsx`）

* **唯一编排中心**：`App.jsx` 的 `Canvas` 组件分为常量配置、状态、能力、菜单、事件、渲染 6 区。
* **画布状态快照**：必须同时维护 `nodesRef/edgesRef` 最新快照，能力区必须读 ref 取最新值。**原因**：reactflow 的 `onNodesChange` 回调构建在 `useCallback` 闭包中，直接引用 `nodes` 会给所有已注册回调绑定旧闭包（拿不到后续最新值）；只有 ref 是稳定引用。直接读 state 取旧值 = 撤销丢新增 / 批量写回错位（FINAL-057 系列已验证为高风险点）。
* **系统链路**：`currentProjectId` → 画布快照走 localTool KV 加载 → 600ms 防抖保存 → 多窗口冲突提示。AI 会话按项目 ID 隔离存储。
* **历史栈入参**：`useCanvasHistory` 的 `record` 必须**显式传最新快照**（nodesRef/edgesRef），禁异步 setState 取旧值。
* **性能降级**：通过 `base/lod.jsx`（LodProvider + useLod）处理，包含视口移动、节点数、连线特效限制。

### B. 连线与节点体系红线

* **用户手连**：走 `onConnect`（edge id 去重并记历史）。
* **拖到空白建节点**：走 `onConnectEnd`，内联调用 `addNode`，不走 deriveNodes。
* **程序化建节点+连线**：**唯一**走 `base/deriveNodes.js` 链路，原子进 undo。
* **单源节点目录**：`base/NodePalette.jsx` 是唯一目录。
* **⚠️ 新增节点必做 3 处同步**：1. Palette 登记；2. `useConnectedInputs.js` 声明产出（漏写会导致下游拿不到数据）；3. 文档登记。例外：`director3dNode` 与 `ghostTarget` 由 App.jsx 派生后补充。
* **节点统一范式**：外壳用 `NodeShell`（禁止手写外壳）；UI 用 `useState(data.xxx)`、写回用 `setNodes` 不可变更新；上游数据走 `useConnectedInputs`。详见 `spec/NEW-NODE-GUIDE.md`。
* **管线契约**：`useConnectedInputs.js` 的 `NODE_OUTPUTS` 是「下游自动拿上游数据」的唯一声明，有产出的节点必须登记，数组型用 `arrayImages` 归一。

### C. 逻辑收口准则（手写 ≥3 次必收口）

* **撤销/历史**：统一走 `historyStack.js`。
* **节点生成**：统一走 `useNodeGeneration.js` 契约，禁止手写生成样板。
* **错误/异步**：统一走 `genErrors.js` + `asyncGuard.js`，禁止节点自写网络错误判定，禁止无超时 Promise。
* **收口硬性豁免**：只有面临性能独占、领域硬隔离、上游契约钉死或安全隔离时允许不收口，且必须在代码处注释原因。

---

## 二、横切机制（各模块唯一入口）

| 模块 | 唯一入口 | 核心规则 | 🚫 严禁行为 |
| --- | --- | --- | --- |
| **① 通信** | `eventBus.js` | 瞬时事件广播；事件先在 `contracts.js` 登记。 | eventBus 存状态 / store 发事件 |
| **② 表现** | `toastStore.js` | 业务只调语义化 4 档 (Success/Error/Warning/Info)。 | `showToast('x',{type})` 混写 |
| **③ 观测** | `logger.js` | 记录+上报，供排查使用。 | 裸写 `console.log/warn/error` |
| **④ 持久化** | `contentStore` | 横切存储权威入口；按 KEYS 自动路由底层存储。 | 业务直调 storageAdapter / 散落字符串 |
| **⑤ 能力** | `mediaType`等 | URL转换/剪贴板等单一入口。`previewUrl` 管本地预览。 | 节点手写 `URL.createObjectURL` |
| **⑥ 工具** | `idGen.js` / `utils.js` | 通用纯工具集合。 | 手写 `Date.now().toString(36)` 造 ID |
| **⑦ 下载** | `clipboard.downloadUrl` | 统一文件下载与导出。 | 自写 `createObjectURL + a.download` |

> **协作规则（不越层）**：弹提示→②、记日志→③、广播→①、存数据→④、算/转换→⑤⑥、下载→⑦。**禁止越层**（toast 不写日志、logger 不弹提示）。新增事件/存储键/错误类型先到 `contracts.js` 登记再实现。

> **debug 开关（查 bug 临时日志用，已升级为通用 DEBUG）**：`config.js` 的 `DEBUG`（`isDebugModuleOn(module)`）按模块分类控制 `logger.debug` 输出，默认全关、不上报后端。模块位集中在 `DEBUG_MODULES = ['asset','agent','image']`（素材库 / AI 助手 / 图片生成全链路）。开启：`.env` 加 `VITE_DEBUG_ALL=1`（全开）或 `VITE_DEBUG_<MODULE>=1`（单模块），运行时 `window.__DEBUG_ALL` / `window.__DEBUG_<MODULE>`。`DEBUG_ASSET` 保留为 asset 模块位别名（旧引用不破）。**新增模块直接在 `DEBUG_MODULES` 登记，禁止再起独立散开关**。详见 CLAUDE.md §3.2（改 bug 先加日志）。

---

## 三、异步与一致性

* **并发治理**：**仅生图需要治理**（`GEN_MAX_CONCURRENT = 6`）。视频/图片压缩/文件上传等不会导致超并发的操作，不设全局防御，不要过度设计。
* **异步一致性**：异步操作统一支持 `AbortSignal` 真中断；竞态防护通过请求带 id 校验最新；超时统一走 `asyncGuard.js` 的 `withTimeout` + 命名常量（config）。
* **错误透传铁律**：`genErrors.js` 仅用于重试降级决策，**绝对禁止吞掉或改写原始错误信息**。
* **自动重试**：仅网络/超时最多 3 次指数退避，上游业务失败绝不自动重试（防封号）。

---

## 四、安全与密钥铁律（最高优先）

安全只防"自有密钥泄露/硬编码"，不做防恶意攻击防御。

1. **密钥只进 `.env**`，绝不硬编码，绝不入库。
2. **前端不落地 AK/SK**：只经 localTool 或网关转发。
3. **无敏日志**：日志、toast、上报 body 不得含任何密钥/token。
4. **代理访问**：连 Lovart 必须 VPN；git push 走代理 7897。
5. **新外部接入**：密钥强制走环境变量。

---

## 五、数据一致性防线

* **唯一 ID**：nodeId/edgeId/taskId 必须走 `base/idGen.js`。
* **字段映射**：前端 camelCase ↔ 后端 snake_case 转换以 CONTRACTS 为准。
* **快照稳定**：所有 store 的 getSnapshot 必须引用缓存。
* **新增 store/持久化自查**：会不会产生画布↔任务↔磁盘不一致？写码时主动规避（排查脚本见 CLAUDE.md §四）。
* **字符串契约零损伤（红线，改任何引用必须全量 grep 同步）**：`proxyMode=local-tool`、`127.0.0.1:18080`、`127.0.0.1:9004`、`/api/proxy`、`x-proxy-url`、画布硬编码字段 `t.data[0].url`、`{code,data}` 信封、SSE 事件格式。禁止局部替换漏网。
* **生成链路真相源契约（红线，所有生成节点必守）**：任务中心为结果权威源，node.data 为渲染缓存副本。① `onSuccess` 必须把结果写回 node.data（`data.imageUrl`/`data.videoUrl`），否则刷新丢结果；② 异步可恢复节点必须传 `onRecover`，收到 `agent:task-completed` 广播回填 `resultUrl`；③ **文本类节点例外**——结果本体在 `data.text`、任务中心 `resultUrl` 为空，不套用 onRecover，由 data.text 随画布快照落盘恢复；④ 方向单向：写只走 `useNodeGeneration`，刷新后任务中心→节点回填，节点不回写任务中心。样板：PromptNode / DiscountVideoNode；机制见 `base/useNodeGeneration.js` 文件头。
* **生成节点真相源自查表（新增/改节点必核，缺一项即违约）**：① 是否接入 `useNodeGeneration`？绕开 hook 自写 `reportGenerate`/进度/`setNodes` 即违约；② `onSuccess` 是否写回 `node.data`（`imageUrl`/`videoUrl`/`text`）？只 `setXxx` 不写 data = 刷新丢结果；③ 异步节点是否传 `onRecover`？缺 = 异步完成刷新不恢复（文本例外）；④ `onRecover` 是否对齐 PromptNode 的"节点消失重建"兜底？不一致即样板断裂；⑤ 结果字段命名是否统一（`imageUrl`/`videoUrl`/`text`）？禁双字段冗余（如 `ImageNode` 的 `url`+`imageUrl`）；⑥ 已知未接入节点（P1 待收口，新节点禁走此路）：`VideoExtractNode`（刷新丢结果）、`VideoProcessNode`、`ImageNode`、`GridSplit`、`Loop` 等共 13 个。
* **数据一致性风险红线（刷新/离线/多端边界）**：① 离线态结果只存 `node.data`，重连不补登任务中心（未连时任务记录内存态，刷新即清）；② 文本结果纯靠 600ms autoSave 窗口，窗口内刷新即丢；③ sync 生图无 `pollTaskId`、无 `agent:task-completed` 广播，恢复全靠 `data.imageUrl` 副本，外链/临时地址即丢图；④ `blob:`/`data:` 地址永不落盘，两端皆丢；⑤ 多端仅 `_version` 冲突拒绝覆盖、不合并，`BroadcastChannel` 只广播事件不传数据；⑥ 画布 KV 降级 localStorage 后重连不回灌 KV，双源分裂。方向：任务中心回填为权威，画布旧副本只占位不回写。

---

## 五·五、外部仓库边界（director3d）

* **`src/components/director3d/` 是从外部下载的开源仓库**（storyai-3d-director-desk），非本仓库自有代码，**基本独立于主画布**（自有 store/schema/编辑器，TS 实现），耦合不深。由 `Director3DNode` 双击进入。
* **边界红线**：**不为它写测试、不纳入测试维护、不主动重构**；改动只做"必要的最小集成"，改前先读文件头注释。它是独立设计，别当主项目机制深改。

---

## 六、维护纪律与待办（单中心，保鲜机制）

### A. 决策记录渠道（钉死三档，不许颠三倒四）

| 档位 | 判定条件 | 记录位置 | 🚫 严禁行为 |
| --- | --- | --- | --- |
| **代码注释** | 单文件局部机制、调用方单一 | **对应代码文件头**写清「为什么/边界/红线」 | 不另写文档 |
| **CONTEXT.md** | 横跨 ≥2 处 / 全库决策 / 选型入口 | 本文档对应章节 + `contracts.js` 落地 | 不立 ADR 文件 |
| **专项文档** | 需要长篇幅的策略（如错误重试） | 极少数现有专项文档，并在本文档索引 | 不为普通决策新开 |

> **铁律**：1. **不立 ADR 文件**（`docs/adr/` 非决策渠道，历史为空）；2. **主注释优先于散碎注释**——改文件同步更新文件头 JSDoc，别只在改动行塞注释（否则后续 AI 读不到全貌）；3. **本文件只写收口/唯一入口/红线这类决策**，**不记具体 bug 修复**——修 bug 直接在对应代码里写注释说明「为什么改/边界」即可，别往本文件塞。
>
> **保鲜机制 3 条**：① 发现文档与代码**在「收口/红线」层面**不符，必须二选一同步（改代码或改文档），**规范失真比没有规范更糟**；② 本文件**禁止写会过期的具体数字**（文件数/用例数/行号/版本），事实活在代码里；③ 能靠代码注释表达的机制一律写注释，本文件只留"放哪/选入口/红线"，**规范越短越不过时**。

### B. ✅ 已收口（勿重复收口；后续 AI 改前先认领这些唯一入口）

> 这些是**当前架构事实**（已落地、有边界），不是待办。改到相关功能先看这里，避免重复收口或走绕道。

* **通用工具**：`base/utils.js`（`deepClone`/`formatTime`/`debounce`/`throttle`/`useDebouncedEffect`/`createImeInput`/`createRafBatch`）。边界：`director3d` 不纳入；时序敏感处（`useCanvasHistory` 抑制窗口、`useAgentChat` 流式 flush、`ghost-edge`）保留手写。全库散落手写防抖/深拷贝已收敛至此，勿再绕道。
* **nodeTypes 单源**：`base/NodePalette.jsx` 的 `paletteNodes`（含 `component` 字段），`buildNodeTypeComponents()` 派生 `App.jsx nodeTypes`，不再手写平行表。
* **程序化建边**：`base/deriveNodes.js`（`buildSpawnNodes`/`makeChildId`）+ `CanvasEdgesContext.jsx`，9 处建子节点+连线统一并原子进 undo。边界：`scriptBoxEngine` 注入式引擎、`onConnect` 手连、`onConnectEnd` ghost-edge 保持原样。
* **本地预览**：`base/previewUrl.js`（`create/release` 引用计数）。边界：下载走 `clipboard`、持久化降级走 `videoEngine`、`director3d` 不纳入。
* **ID 生成**：`base/idGen.js` `generateId`。边界：`accountsStore`/`ShortcutSettings` 手写 `Date.now().toString` 已收敛回，勿再绕道。
* **useAgentChat 三层拆分**：`agentCore.js`(纯函数)/`agentRuntime.js`(运行时)/`useAgentChat.js`(hook 编排)。契约：useAgentChat 顶部 re-export agentCore，**改纯函数去 agentCore.js**；roundTrip/runToolCalls 与状态机竞态耦合留在 hook 封装层，勿强行下钻。

### C. 🟡 顶层已知待办（改动前先查，看完删）

* 🚧 **统一节点错误降级/重试收敛**：节点级 catch 大多只 setState 不收敛。未开工，改前先 grep 现有半成品。
* 🚧 **预览 URL 卸载释放缺口**：`TextNode`/`FaceMosaicNode`/`VideoExtractNode` 预览卸载时未 release。未开工（单独立项，防改动行为边界）。
* ✅ **性能优化绕道收口**：散落手写 `setTimeout` 防抖/深拷贝已收敛至 `base/utils.js`（`debounce`/`createRafBatch` 等），仅时序敏感处保留手写。

### D. ✅ 性能优化批次（已全部落地，仅留档案）

> 以下为历史批次档案，**均已落地并通过 `test:unit` + build 验证**。代码事实以实际实现为准，本段仅记录"曾在此收口"，不重复约束。

* **落盘节流（P4）**：各 Store 落盘已加节流。
* **节点 `React.memo` + `AgentPanel` key（P1+P15）**：节点组件已 memo 包裹。
* **rAF 合并（P3+P10）**：`base/utils.js` 的 `createRafBatch` 已落地，多处于 App.jsx / 编辑器 / 视频节点消费；will-change 合成层已启用。
* **搜索/输入防抖 + IME 感知（P2+P12）**：`createImeInput` 已收口于 `utils.js`。
* **selector/常量/getNode/useMemo/批量写/utils 复用（P5-P8/P11/P16）**：已收敛。
* **虚拟滚动 / contain / LazyImage 共享 IO（P9/P13/P14）**：`LazyImage.jsx` 与 `NodeShell.jsx` 已落地 `IntersectionObserver` + `content-visibility`/`contain`。

### E. 🔬 性能优化研究建议（实测无收益不动）

1. **AI 流式渲染**：评估使用 `useDeferredValue` 优化 messagesRef 竞态重渲染。
2. **lod.jsx 降级**：评估降级 class 改经 `<ReactFlow className>` 注入，接真实 dragging。
3. **LazyImage 观察者**：同屏百级图时，评估抽共享 IO 单例（已入 P9，以实测为准）。
4. **非紧急计算合并**：缩略图等操作评估走 `requestIdleCallback` 而非抢动画帧（需确认 Safari 支持）。