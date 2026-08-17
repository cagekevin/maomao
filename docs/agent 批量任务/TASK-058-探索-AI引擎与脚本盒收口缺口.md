# TASK-058 探索报告：AI 引擎与脚本盒「收口」可行性

> 类型：探索任务（仅产出本报告，不改代码、不写脚本）
> 日期：2026-08-17
> 范围：AI 引擎（Agent 对话）与脚本盒（剧本盒子）两套链路，能否收口到同一套 Provider 模型抽象 + Prompt 管理体系
> 证据来源：直接通读 `src/components/base/` 与 `src/components/AgentPanel.jsx` 相关源码（行号均来自实读）

---

## 0. 结论先行（TL;DR）

**可以收口，但当前是「两套半」而不是「两套」。** 现在状态：

- **脚本盒链路**（`scriptBoxEngine.js` + `scriptBoxPrompts.js`）已走在正确的收口路径上：经 `getProviderState()` → `resolveProviderModel()` → `chatApi`（文本）/ `imageApi`（图像）走 `/api/proxy`。它是范本。
- **节点生成链路**（`useNodeGeneration.js`）已是统一的「提交→进度→成功双写(taskStore + node.data) / 失败」契约，但 **prompt 仍散落在每个节点的 `run` 执行器里**（不在 `useNodeGeneration` 内）。
- **AI 引擎链路**（`useAgentChat.js`）是「自成一套」：它用 **stream + tools 的 `openai://chat/completions`**（自己 fetch + 自己拼 URL + 自己 SSE 解析），**没复用**脚本盒已用的 `chatApi.chatCompletions`（后者是 `stream:false`、不支持 `tools` 的纯文本封面包）。

**真正的收口缺口有 4 个**（详见第 4 节），其中最关键的一条是：**Agent 对话链路用的 LLM 转发实现 ≠ 脚本盒用的 `chatApi`，且 agent 对话的模型标识体系和生图 `providerId::modelId` 体系是两套并存的**。

**建议收口路线**：以脚本盒为范本，新增 `aiEngine.js` 封装「流式 + tools 的 LLM 调用」（吸收 `useAgentChat` 的 SSE 逻辑），统一经 `providerModels.resolveProviderModel` 解析；并把硬编码在 `useAgentChat.js` 的系统 prompt 抽到 `agentPrompts.js`。风险中等——**不是简单「把 useAgentChat 换成 chatApi」**，因为 `chatApi` 当前根本不支持 Agent 需要的流式与工具调用。

---

## 1. 现状地图（按职责分层，行号来自实读）

### 1.1 Provider / 模型抽象层

| 文件 | 真实职责 | 状态 |
|---|---|---|
| `providerModels.js` | `modelKey(p, m)`、`buildAllModels(providers, kind)`、`resolveProviderModel(providers, "providerId::modelId", primary)` | ✅ 已存在，被脚本盒 + 生图用 |
| `chatApi.js` | `chatCompletions({ provider, model, messages })` → `/api/proxy`；**实现是 `stream:false`、不支持 `tools`、返回统一信封 `{ ok, content }`**（见 `chatApi.js` L25-52 的 `chatCompletions`） | ⚠️ 是「非流式纯文本」封装，不能直接服务流式 Agent |
| `imageApi.js` | `generateImage({ provider, model, prompt, ... })` → `/api/proxy`；sync/async 由 `provider.image_mode` 决定（L237） | ✅ 已存在，被节点 + 生图用 |
| `providerStore.js`（`base/settings/`） | React 侧 provider 列表与 `isPrimary` 选择 | ✅ 存在，AgentPanel 用 |

> 实读确认：`providerModels.js` **没有** `PROVIDER_ALIASES`、`resolveModelByAlias` 这类符号；文档旧版本误写，以本次为准。

### 1.2 脚本盒链路（已收口，收口范本）

`scriptBoxEngine.js` 的 `createScriptBoxEngine({ ..., getProviderState })`：
- `resolveTextModel()` = `getProviderState()` → `resolveProviderModel(providers, d.textModel, primary)`（L74-80）
- 文本生成 → `chatApi.chatCompletions({ provider, model: modelId, messages, ... })`
- 图像生成 → `imageApi.generateImage({ provider, model, ... })`
- prompt 来自 `scriptBoxPrompts.js`（`SCRIPT_WRITER_SYSTEM`、`SCRIPT_WRITER_FORMAT`、`SHOT_DIRECTOR_SYSTEM`、`ZgPrompt`、`IMAGE_GEN_TYPES`、`getImageGenSys`、`buildShotImageUser` 等）；另有 `QG_RULES` 定义在 `scriptBoxEngine.js` 内部（L511 附近），不属 `scriptBoxPrompts.js`。

**结论**：脚本盒是「收口后该有的样子」，应作为 Agent 链路对齐的范本。注意它用的 `chatApi` 是**非流式、无 tools** 的——脚本盒本来就不需要流式 function calling。

### 1.3 节点生成链路（契约统一，prompt 未收口）

`useNodeGeneration.js` L8-46 自述为 P0 架构级统一契约：
- 统一「提交任务 → 进度 → 成功双写(taskStore + node.data) / 失败」契约（L82-95）
- 统一「再来一次」retry 注册（L143-148，注册到 `taskStore.retryRegistry`）
- `generate_node` 工具经 `runNodeGeneration(id)` 驱动真实生成（`useCanvasAgentTools.js` L605-644 注释明确）
- **不含 prompt**：prompt 在 `run` 执行器里拼好再传给 `generateImage`（L33 注释 `run: async ({progress}) => generateImage(...)`），`useNodeGeneration` 只负责契约编排

**缺口**：生成「流程」已收口，但每个节点的 prompt 内容仍散落在该节点自己的执行器里，未集中管理。

### 1.4 AI 引擎链路（自成一套，主要收口对象）

`useAgentChat.js` 实读确认：
- `roundTrip()`（L607-724）自己 `fetch`：
  - `provider` 存在 → `fetch(`${API_BASE}/api/proxy`, ...)`（L629-640），URL 自己拼：`provider.protocol==='openai' ? 'openai://chat/completions' : (base_url + '/v1/chat/completions')`（L634）
  - 否则 → `fetch(endpoint)`（localTool `/api/agent/:id/chat`，L641-650，endpoint 来自 L600）
- 自己构造 `llmBody`：`model, messages, stream, temperature:0.6`，**流式时带 `tools: toolSchemas, tool_choice:'auto'`**（L614-622）
- 自己解析 SSE（L669-710，`parseSSEChunk` 累积 content/reasoning/toolCalls）
- 自己注入 system prompt（L240-272）：`CANVAS_AGENT_RULES`（L245）、`SKILL_EXECUTION_RULES`（skill 注入 L250-256）、memory 注入（L257-264）、**`global_contract` 回灌**（L265-272，从 `memory.global_contract` 逐字回灌到对话 system）
- `provider` 来自 `useAgentChat({ provider })` prop（L471 `useAgentChat({ defaultModel, provider, ... })`），由 `AgentPanel` 选好传入
- `model` 是 `useState(defaultModel)`（L475），裸模型名（如 `agentModels[0]`），**非** `providerId::modelId` 合并串
- 非流式模型（`streamMode==='non-stream'`）走 L660-666，不传 `tools`（模型不支持 function calling）

**关键事实（修正旧版认知）**：
1. `AgentPanel` **确实传了 `provider`**（`agentProvider`，见下 1.5）——所以默认形态下 Agent 走 `/api/proxy`，**不是**「绕开 provider 体系」。旧版报告称「AgentPanel 没传 provider」是错误的。
2. 但 Agent 对话的「模型标识」用的是 **`provider`（对象）+ 裸 `model`（字符串）分体传参**，与脚本盒/生图用的 `resolveProviderModel("providerId::modelId")` 合并字符串体系**不是同一套**。两者都能定位到供应商，但标识形式不统一。
3. Agent 对话的 LLM 转发（流式+tools）与 `chatApi.chatCompletions`（非流式、无 tools）是**两套实现**。Agent 当前**无法**直接复用 `chatApi`。

### 1.5 AgentPanel 的 provider / model 选择（实读确认）

`AgentPanel.jsx` L73-179：
- `const { providers } = useProviders()`（L73）；`primary`（L74）= `providers.find(p=>p.isPrimary)`
- `agentProvider`（L76-83）：优先 `loadAgentChatModel().providerId` 指定的 provider；否则 `providers.find(p=>p.id==='modelscope') || primary`
- `agentModels`（L85-88）：`agentProvider.chat_models` 的 id 列表，兜底用 `AGENT_MODELS`（env `VITE_AGENT_MODELS` 或 `DEFAULT_MODELS = ['deepseek-chat', ...]`，L32-40）
- `defaultAgentModel`（L92-97）：优先 `loadAgentChatModel().modelId`，否则 `agentModels[0]`
- 调用 `useAgentChat({ defaultModel: defaultAgentModel, provider: agentProvider })`（L178-180）

**结论**：Agent 对话确实接入了 provider 体系（经 AgentPanel），只是模型标识是「裸名 + 单独 provider 对象」形式。

### 1.6 Prompt 体系（实读确认）

| 文件 | 真实管理的 prompt | 状态 |
|---|---|---|
| `scriptBoxPrompts.js` | `SCRIPT_WRITER_SYSTEM`、`SCRIPT_WRITER_FORMAT`、`SHOT_DIRECTOR_SYSTEM`、`ZgPrompt`、`IMAGE_GEN_TYPES`（keyframe/grid4/grid9/topdown）、`getImageGenSys`、`buildShotImageUser`、`ASSET_TEMPLATES` 等 | ✅ 脚本盒专用，集中 |
| `scriptBoxEngine.js`（内部） | `QG_RULES`（L511 附近，生图/视频质量约束） | ⚠️ 在引擎文件内，未进 `scriptBoxPrompts.js` |
| `useAgentChat.js`（内部常量） | `CANVAS_AGENT_RULES`（L85+）、`SKILL_EXECUTION_RULES`、skill 文档包裹格式、memory/global_contract 回灌片段（L240-272） | ❌ 硬编码散落 |
| `promptManager.js` | **用户预设提示词库**（localStorage，`{id,title,type,prompt,enabled}`，`DEFAULT_PRESETS` L25-31）；`loadPresets/saveAndNotify/createPreset/getRecent` 等 | ⚠️ 是「用户侧资产库」，非「系统 prompt 注册表」 |
| `PromptLibrary.jsx` | UI 弹窗，从 `promptManager` 读用户预设，供生图/文本/视频节点「预设」按钮复用（L15-16） | ⚠️ 用户资产库 UI |

> 实读确认：`promptManager.js` **不是**「节点参数里的 prompt 存取」，而是「用户可保存/复用的提示词预设库」。旧版报告对 `promptManager` 的描述有误，以本次为准。
> 系统级 prompt（Agent 行为准则、Skill 执行规则、风格契约）**没有一个统一的「注册表 + 变量注入」机制**，散落在 `useAgentChat.js` 与脚本盒两处。

> 关于 `global_contract` 风格契约的真实去向（修正旧版）：它**在两处都被注入**——
> - `useAgentChat.js` L265-272：把 `memory.global_contract` 逐字**回灌到对话 system**（保证 Agent 续轮仍知风格）；
> - `useCanvasAgentTools.js` L761-769（`executePlanTool`）：把 `global_contract` 三字段**锁到每个生图 prompt 头部**（保证电商套图每步风格统一）。
> 两处职责不同（对话上下文 vs 生图 prompt 锁定），并非重复。

---

## 2. 收口可行性评估

### 2.1 Provider 模型抽象——可收口，但需统一「标识体系」✅

证据：
- `providerModels.resolveProviderModel` 已是通用解析器，脚本盒与生图已验证可用。
- 生图链路（`useCanvasAgentTools.getGenParams` 注 L27）已采用 `providerId::modelId` 合并格式 + `resolveProviderModel`。
- **缺口**：Agent **对话**链路用的是「`provider` 对象 + 裸 `model`」分体传参，未走 `resolveProviderModel`。两条链路的模型标识形式不一致。

收口动作：让 Agent 对话的模型也统一为 `providerId::modelId` 字符串，经 `resolveProviderModel` 解析；或直接复用 AgentPanel 已算好的 `agentProvider` + `model` 并补一层 `resolveProviderModel` 对齐。目标是「全链路只有一种模型标识形式」。

### 2.2 发送/转发层——**不能直接复用 `chatApi`，需新建 `aiEngine`** ⚠️（修正旧版「低风险」判断）

实读确认：
- `chatApi.chatCompletions` 是 `stream:false`、无 `tools` 参数、返回 `{ok,content}` 信封（`chatApi.js` L25-52）。
- `useAgentChat` 需要 **stream + tools（function calling）+ SSE 解析 + 推理字段(reasoning)**。
- 因此 Agent 当前**不能**简单改成调用 `chatApi`。

收口动作：把 `useAgentChat.roundTrip` 的「流式+tools LLM 调用」逻辑下沉为一个新的 `aiEngine.chat({ provider, model, messages, tools, stream, temperature, signal, onStream })`：
- 内部复用 `imageApi.buildTargetUrl`（openai 伪协议 vs 拼接 base_url）的同源逻辑拼 `/api/proxy` 目标；
- 复用 `parseSSEChunk` 解析；
- `provider` 经 `resolveProviderModel` 统一解析；
- 把 `chatApi` 升级为同时支持「流式+tools」与「非流式」，或让 `aiEngine` 与 `chatApi` 共享底层 `proxyRequest`（位于 `imageApi.js` L27-45，目前 `imageApi` 私有，`chatApi` 自带 fetch——二者底层 fetch 也未统一，见 2.4）。

### 2.3 Prompt 体系——部分可收口 ⚠️

- 系统级 prompt（`CANVAS_AGENT_RULES`、`SKILL_EXECUTION_RULES`、skill 包裹格式、memory/global_contract 回灌片段）应抽出到 `agentPrompts.js`（与 `scriptBoxPrompts.js` 对称）。
- 难点：Agent 的 system prompt 是**动态拼装**（画布准则 + skill 注入 + memory 注入 + global_contract 回灌），不是静态字符串。需要「prompt 模板 + 变量填充」机制（如 `buildAgentSystemPrompt({ rules, skills, memory, contract })`），而非简单挪位置。
- `PromptLibrary.jsx` 是用户资产库（UI），与系统 prompt 注册表职责不同，不宜混用。系统 prompt 注册表应独立于它新建。

### 2.4 转发底层 fetch——两套，未统一 ⚠️

实读确认：
- `imageApi.proxyRequest`（L27-45）：带 `providerId`、`taskId`（贯穿 `taskStore.currentTaskId`）、`signal` 取消。
- `chatApi`（L25-52）：自带 `fetch` 到 `/api/proxy`，但 **未传 `providerId`/`taskId`**、`stream:false`。
- `useAgentChat`（L629-650）：自带 `fetch`，带 `providerId`、但不带 `taskId`。
- 三者都拼 `/api/proxy`，但底层 fetch 实现**各写各的**，`taskId` 贯穿链只有 `imageApi` 做了。

收口动作：抽一个统一的 `proxyFetch({ url, provider, body, signal, taskId })`，被 `imageApi` / `chatApi` / `aiEngine` 共用，确保 `taskId` 贯穿（供 Lovart thread 关联）与可取消信号三处一致。

### 2.5 非流式模型 / 协议差异——应下沉到通用层

`useAgentChat` 的 `streamMode` 判定（L610-611）、`provider.protocol==='openai'` 分支（L634）与 `imageApi` 的 `provider?.protocol` / `image_mode` 判定同源。通用 `aiEngine`/`chatApi` 应吸收这些分支，对外只暴露统一调用。

---

## 3. 已具备的收口地基（不要重复造）

以下模块已成熟，收口时**直接复用**，不要重写：

1. `providerModels.resolveProviderModel` —— 模型字符串解析的唯一真相源（脚本盒 + 生图已用）。
2. `providerModels.buildAllModels` —— 按 kind(image/text/video) 列出可选模型（AgentPanel L100 用）。
3. `imageApi.generateImage` —— 生图转发（sync/async + refFormat + resolution 自动）。
4. `imageApi.buildTargetUrl` —— openai 伪协议 vs 拼接 base_url 的 URL 构造（可被 `aiEngine` 复用）。
5. `imageApi.proxyRequest` —— 带 `providerId` / `taskId` / `signal` 的 `/api/proxy` 封装（建议提升为共享底层）。
6. `useNodeGeneration` —— 节点生成「任务中心双写」契约（Agent 的 `generate_node` 已接真生成，见 `useCanvasAgentTools.js` L605-644）。
7. `scriptBoxEngine.createScriptBoxEngine` —— 脚本盒引擎范本，展示「注入 `getProviderState` → `resolveProviderModel` → `chatApi`/`imageApi`」的正确范式。
8. `useAgentChat.parseAgentError`（L331，proxy/agent 双路径共用错误归一）—— 可提升到 `aiEngine` 共享。
9. `parseSSEChunk`（SSE 流式解析）—— Agent 流式解析核心，可直接复用到 `aiEngine`。
10. `useCanvasAgentTools.getGenParams` 的 `providerId::modelId` 约定（L27 注释）—— 证明生图侧已统一标识，对话侧应对齐。

---

## 4. 收口缺口清单（4 个，按优先级）

### 缺口 G1【P0】：模型标识体系不统一
- **现象**：生图链路用 `providerId::modelId` 合并串 + `resolveProviderModel`（经 `useCanvasAgentTools`）；Agent **对话**链路用「`provider` 对象 + 裸 `model` 字符串」分体传参（`useAgentChat` L471/L475、AgentPanel L178-180）。两套标识形式并存。
- **影响**：切换/扩展供应商时，对话与生成要分别维护；`resolveProviderModel` 的合并串优势（一处解析、防错）未惠及对话链路。
- **收口**：对话链路也统一为 `providerId::modelId`，经 `resolveProviderModel` 解析；最少改动是让 AgentPanel 把 `agentProvider` + `model` 拼成合并串再下发。

### 缺口 G2【P0】：Agent 对话的 LLM 转发未复用 `chatApi`，且 `chatApi` 不支持流式/tools
- **现象**：`useAgentChat.roundTrip`（L607-724）自己 `fetch` + 拼 `openai://chat/completions` + 自写 SSE + 带 `tools`；`chatApi.chatCompletions`（`chatApi.js` L25-52）是 `stream:false`、无 `tools` 的非流式封面包。两者是两套实现。
- **影响**：流式 LLM 转发逻辑只在 Agent 一处，bug（如 718 行的空 tool_calls 修复）修在 Agent 内，`chatApi` 不会有；若将来脚本盒也要流式，又得再写一份。
- **收口**：新建 `aiEngine.chat({ provider, model, messages, tools, stream, temperature, signal, onStream })`，吸收 `useAgentChat` 的 SSE/streamMode/tool_call 逻辑；`chatApi` 升级为同时支持流式+tools，或二者共用统一 `proxyFetch`。**注意：这不是「把 useAgentChat 换成 chatApi」那么简单——`chatApi` 当前能力不满足 Agent 需求，必须先扩展。**

### 缺口 G3【P1】：系统级 prompt 硬编码散落
- **现象**：`useAgentChat.js` 内 `CANVAS_AGENT_RULES`、`SKILL_EXECUTION_RULES`、skill 包裹格式、memory/global_contract 回灌片段硬编码（L85-272）；脚本盒另管一套（`scriptBoxPrompts.js` + `scriptBoxEngine.js` 的 `QG_RULES`）。无「系统 prompt 注册表 + 变量注入」机制。
- **影响**：改 Agent 行为准则要动 `useAgentChat`；对话与脚本盒的「风格契约」无法共享同一份源；`QG_RULES` 还藏在引擎文件内。
- **收口**：抽 `agentPrompts.js`（与 `scriptBoxPrompts.js` 对称）放 Agent 系统 prompt；新增 `buildAgentSystemPrompt(ctx)` 模板函数，替代 `useAgentChat` L240-272 的拼装逻辑。

### 缺口 G4【P2】：转发底层 fetch 未统一 + 无 Token/配额归因
- **现象**：
  - `imageApi.proxyRequest`（带 `providerId`/`taskId`/`signal`）、`chatApi` 自带 fetch（无 `taskId`）、`useAgentChat` 自带 fetch（无 `taskId`）三套底层 fetch 各写各的；
  - 全仓库搜索 `token|配额|usage|quota` 无命中，LLM/生图调用均无 `usage` 统计与归因。
- **影响**：`taskId` 贯穿链只生图做了，对话/文本未做（刷新/关联 Lovart thread 不完整）；无法做成本控制与按对话/节点归因消耗。
- **收口**：抽共享 `proxyFetch({ url, provider, body, signal, taskId })`；`chatApi`/`aiEngine` 回传 `usage` → `taskStore` 归因。此专项不阻塞 G1-G3。

---

## 5. 建议收口路线（分阶段，不写代码仅规划）

### 阶段 1（统一底层，低风险）
- 抽 `proxyFetch({ url, provider, body, signal, taskId })`（源自 `imageApi.proxyRequest`，提升为共享），被 `imageApi` / `chatApi` / 后续 `aiEngine` 共用，确保 `taskId` 贯穿与 `signal` 取消三处一致。

### 阶段 2（统一模型标识，低风险）
- AgentPanel 把 `agentProvider` + `model` 拼成 `providerId::modelId`（或直接复用 AgentPanel 已解析好的 provider 对象）下发，对话链路经 `resolveProviderModel` 解析（对齐生图侧 G1）。

### 阶段 3（收口 Agent LLM 转发，中风险）
- 新建 `aiEngine.chat(...)`，吸收 `useAgentChat.roundTrip` 的流式+tools+SSE+streamMode 逻辑，内部复用 `proxyFetch` + `resolveProviderModel`。
- `useAgentChat.roundTrip` 改为调用 `aiEngine.chat`，删除内联 fetch/URL 拼装/SSE 解析。
- 同步把 `chatApi` 升级为支持流式+tools（或明确分工：`aiEngine` 负责流式对话、`chatApi` 负责脚本盒类非流式文本）。

### 阶段 4（Prompt 收口，中风险）
- 抽 `agentPrompts.js`，把 `CANVAS_AGENT_RULES` / `SKILL_EXECUTION_RULES` / skill 包裹格式 / memory·global_contract 回灌片段迁过去。
- 新增 `buildAgentSystemPrompt(ctx)` 模板函数，替代 `useAgentChat` L240-272 拼装逻辑。
- 把 `scriptBoxEngine.js` 内的 `QG_RULES` 迁到 `scriptBoxPrompts.js`，统一脚本盒 prompt 收口。

### 阶段 5（可选，观测性）
- `aiEngine` / `imageApi` 回传 `usage` → `taskStore` 归因（G4）。

---

## 6. 风险与注意事项（实读依据）

1. **SSE 增量回调兼容性**：`useAgentChat` 的 `onStream({ content, reasoning, toolCalls })` 带 `reasoning`（推理字段，如 DeepSeek-R1），下沉到 `aiEngine` 时必须保留 `reasoning` 透传——`chatApi` 当前无此字段。
2. **非流式模型分支必须保留**：`streamMode==='non-stream'` 时 `useAgentChat` 不传 `tools`（L613-621，模型不支持 function calling），`aiEngine` 必须保留该分支，否则非流式模型会报工具调用错误。
3. **空 tool_calls 修复不能丢**：`useAgentChat` L714-720 已修「流式占位 tool_calls name 未拼全 → 存空数组 → 下次报 Empty tool_calls」问题，`aiEngine` 必须继承该修复逻辑（`realCalls = acc.toolCalls.filter(t => t.function?.name)`）。
4. **localTool `/api/agent` 回退路径**：`provider` 为空时走 localTool env 配的 LLM（`CHAT_BASE_URL`/`CHAT_API_KEY`，L77-78, L600）。收口后该回退应保留为「无 provider 时的默认通道」，但建议也统一经 `aiEngine`（让 `aiEngine` 在 `provider` 缺失时直连 `endpoint`）。
5. **不可破坏已有单测/契约**：`scriptBoxEngine` 的 `resolveTextModel`、`parseJsonText`、`useJsonObject`、`buildAllModels` 都是导出纯函数且有单测，收口不应改其签名；`useNodeGeneration` 的「任务中心双写」契约（`taskStore.retryRegistry`）是 Agent `generate_node` 的依赖，不能动。
6. **`global_contract` 双注入是有意为之**：对话 system 回灌（续轮记忆）与生图 prompt 头部锁定（风格统一）职责不同，收口时勿误删其一。

---

## 7. 一句话总结

脚本盒已走在正确的收口路径上（范本），节点生成「流程」契约已统一（但 prompt 仍散落），**AI 引擎是最大的收口对象**——它用「流式+tools 的自写 LLM 转发」绕开了脚本盒用的 `chatApi`（而 `chatApi` 当前根本不支持流式与工具调用，所以不是简单复用），且对话链路的模型标识（`provider` 对象 + 裸 `model`）与生图侧统一的 `providerId::modelId` 是两套并存。收口的本质动作是：**抽共享 `proxyFetch` + 新建支持流式/tools 的 `aiEngine`、把对话模型标识统一为 `providerId::modelId`、把 `useAgentChat` 的硬编码系统 prompt 抽到 `agentPrompts.js`**。工作量中等、风险可控，不必重写脚本盒或节点层；但切忌把阶段 3 误判为「低风险直接复用 chatApi」——`chatApi` 必须先扩展能力。
