# TASK-026 — AI 助手集成核验（大雄 agent-dock 三模式 vs 我们 AgentPanel）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
大雄 Infinite-Canvas 的画布上集成了 **agent-dock**（`static/agent-dock/agent-dock.js`，576 行）AI 助手方案，支持 **Chat（SSE 流式）/ Agent（意图路由后即时生图改图）/ Image（文生图）三模式**，带历史会话 CRUD、系统提示词、模型/供应商选择。我们（maomao）有 `AgentPanel.jsx` + `useAgentChat.js`（已支持 Skill 三阶段、execute_plan、图像模式）。本任务核验大雄 agent 集成与我们的能力差距。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）
### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/agent-dock/agent-dock.js`，576 行）✅ 已打开核实
- 三模式分发：`sendMessage()` 按 `state.mode` 分支（chat→`streamChatMessage`→`/api/chat/stream` 流式；agent→`/api/chat/agent` 整包；image→`/api/chat`）
- 公开 API：`window.AgentDock = {open, close, toggle}`（L575）
- 会话 CRUD：`loadConversations/ openConversation/ newConversation/ deleteConversation`（L179-209）+ `rememberConversation`（L91，localStorage `gpt_chat_last_conversation_v1`）
- 身份：`X-User-ID` header（L49）+ `localStorage['gpt_chat_browser_user']`（L13）

### 大雄侧（孪生方案 `static/agent-panel/agent-panel.js`，735 行）✅ 已打开核实
- 与 agent-dock **能力等价**（同一套三模式 + 后端端点），仅挂载入口不同：公开 API `window.AgentPanel = {init, open, close, toggle}`（L731）。
- 三模式 `mode` 取值 chat/agent/image（L72）；`send` 按 `mode` 选端点：`/api/chat/agent` 或 `/api/chat`（L400），chat 走 `/api/chat/stream`（L448）。
- 历史恢复同样用 `rememberConversation`/`openConversation`（L104/L248/L251），与 agent-dock 同机制。
- **结论**：大雄侧两套 UI（dock 弹层 / panel 内嵌）后端共用，核验 agent-dock 即可代表大雄 agent 集成全部能力。

### 大雄后端（`/Users/kevin/Documents/画布/Infinite-Canvas/main.py`，行号已核实）✅
- `/api/chat/agent`（Agent 决策）@ 16045、`decide_chat_agent_action` @ 10878
- `/api/chat/stream`（SSE 流式）@ 16131、`/api/chat`（Image/整包）@ 15915
- `ChatRequest`（含 reference_images / mode / size / quality）@ 2625-2638

### 我们侧（均已打开核实）✅
- `/Users/kevin/Documents/maomao/src/components/AgentPanel.jsx`（AI 助手面板，838 行）
- `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`（对话 hook，934 行）
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`（画布工具层，24 工具）
- `/Users/kevin/Documents/maomao/src/components/base/conversationStore.js`（会话隔离数据层，499 行）
- `/Users/kevin/Documents/maomao/src/components/base/skillStore.js`（Skill 系统：`getAllSkills` L130 / `markSkillUsed` L176 / `repairMojibakeText` L21）

## 四、覆盖清单

### 核验点 1：大雄 agent 集成能力
- **三模式**：Chat（流式，可中断）、Agent（整包，意图路由后即时生图/改图）、Image（文生图）。
- **历史会话**：CRUD + `rememberConversation` 恢复上次会话，后端 `load_conversation/save_conversation` 持久化（跨页面共享同一 localStorage user）。
- **Agent 自主生图**：`decide_chat_agent_action`（`main.py` L10878）→ 经意图路由返回 `generate_image`/`edit_image` → `/api/chat/agent`（L16080-16095）直接 `generate_ai_image` 并把图写回 `conversation["messages"]`（L16104-16128）。

### 核验点 2：我们现状（代码证据）
- `useAgentChat.js`：Chat 流式走 `roundTrip` + 多轮工具循环（≤ `MAX_TOOL_ROUNDS=8`，L69/L731）；Skill 三阶段 `show_plan_for_confirm → execute_plan`（L621-632）；图像模式 `sendImageMode` 直连生图（L800）；execute_plan 多步编排（L841 复用 `callTool('execute_plan', ...)`）。
- **我们有没有"对话内即时单张生图/改图"**：有，但走「图像模式」整包路径（`sendImageMode` L800-841 复用 `execute_plan` 在画布建节点+生图），或 Agent 模式下 LLM 自行调 `generate_node`/`execute_plan`。即我们**没有大雄那种"一句话→后端路由→直接出图、不建画布节点"的轻量即时路径**，我们的出图默认落到画布节点。
- **历史会话跨页面共享/恢复**：我们有完整多对话 CRUD（`conversationStore.js`：newConversation L437 / switchConversation L444 / deleteConversation L450 / ensureActiveConversation L396），且带 `hydrated` 时序守卫（L46/L89/L431）、`pending` 恢复（useAgentChat L486-493）、`rememberConversation` 等价物为 `ACTIVE_KEY` 持久化（L31）。但**仅限 maomao 画布内**，无后端跨页面（gpt-chat.html）共享。

### 核验点 3：结论 —— 值不值得对齐
见下方第五节「能力矩阵 + 价值判断」。

## 五、输出规范（三节贯通）

### A. 大雄怎么做（代码证据）
1. **三模式分发**（`agent-dock.js` `sendMessage` L282-335）：
   - chat：`streamChatMessage` → `fetch('/api/chat/stream', ...)`（`L342-346`），SSE `delta` 增量渲染（`L361`），`AbortController` 可中断（`L338/L534`）。
   - agent：`fetch('/api/chat/agent', {body:{mode:'agent', ...}})`（`L309-316`），整包返回。
   - image：`fetch('/api/chat', {mode:'image', size: chatSizeFromPrompt(message)})`（`L320-325`），直连生图。
2. **Agent 意图路由即时出图**（`main.py`）：
   - `decide_chat_agent_action(payload, conversation, refs)` @ L10878，用 LLM 把用户输入路由为 `chat/generate_image/edit_image`（system prompt L10892-10899）。
   - `/api/chat/agent` @ L16045：L16070 拿到 `decision`，L16080 命中 `generate_image/edit_image` 后 `generate_ai_image(...)`（L16093）直接出图，L16104-16128 把 `assistant_message`（含 `image_url/image_urls`）写回 `conversation["messages"]`。
   - **关键特征**：出图**不建画布节点**，图直接作为消息附件返回（`msg.image_urls`，`agent-dock.js` `addMessageBubble` L224-238 渲染 `generated-grid`）。
   - **容错降级**：`edit_image` 无参考图且无历史图时降级为 `generate_image`（main.py L10874-10875、/api/chat/agent L16077-16078），避免空引用报错。我们图像模式单图即生图、无显式降级分支但行为等价（无参考图则纯文生图）。
3. **历史会话 CRUD + 恢复**（`agent-dock.js` L179-209）：`loadConversations` 从 `/api/conversations` 拉列表，`openConversation` 拉消息；`rememberConversation(id)`（L91）写 `gpt_chat_last_conversation_v1`，下次 `loadConversations` 自动 `openConversation(rid)`（L182-185）恢复上次会话。
4. **系统提示词 / 模型供应商**（`agent-dock.js`）：`openSettings` 弹层可编辑 `systemPrompt`（L406/L491/L539）；`renderModelPop` 选 provider+model（L427-451）。

### B. 我们现状（代码证据）
1. **Chat 流式**：`useAgentChat.js` `roundTrip`（L507-598）走 SSE `parseSSEChunk`（L152），多轮工具循环 `MAX_TOOL_ROUNDS=8`（L69/L731）。`AgentPanel.jsx` 发送按钮在 `sending` 且非 `steer` 时变停止按钮（L815-818）→ `stop()`（L872）。✅ 流式+可中断都有。
2. **Agent 自主编排（我们更强）**：
   - Skill 系统：`getAllSkills()` 取全部 Skill（skillStore L130），`markSkillUsed` 标记已用（L176），`.md/.txt` 导入经 `repairMojibakeText` 修复乱码（L21，AgentPanel L351）；启用 Skill 后 `buildRequestMessages` 把原文无损注入 system（useAgentChat L198-204）。
   - Skill 三阶段：`show_plan_for_confirm` 展示策划（L621-623），用户确认后 `handleConfirmPlan` 回发"请执行"（AgentPanel L321-325），`execute_plan` 执行多步（L626-632）。
   - `execute_plan` 能**批量建节点 + 依赖批改图**（useAgentChat L841 复用 `useCanvasAgentTools` 的 `execute_plan`），支持 `depends_on_previous`、`attachment_indices` 精确引用参考图（CANVAS_AGENT_RULES L104）。
   - **我们的 Agent 输出直接落到画布节点**（`create_node`/`generate_node`/`execute_plan` 建节点），这是大雄没有的"批量编排 + 画布集成"能力。
3. **Image 文生图**：`sendImageMode`（useAgentChat L800-841）参考图+提示词直连生图，复用 `execute_plan`（L841）在画布建节点出图；支持"分别改图"拆分 `imageModeLooksLikePerReferenceEdit`/`buildPerReferenceGenerations`（L349-381）。✅ 文生图/图生图都有，且比大雄更细（多参考图一对一拆分）。
4. **即时单张生图/改图的轻量路径（我们缺失点）**：大雄 agent 模式"一句话→后端路由→`generate_ai_image`→图进消息气泡、不建节点"。我们**没有**这条"不建画布节点、纯对话气泡出图"的轻量路径——我们的 image/agent 出图一律经 `execute_plan` 建节点。已全仓搜索佐证：在 `src/components` 下搜索 `generate_inline|inline_image|不建节点` 无匹配（仅 `useAssetDropPaste.js` L143 的"不建节点"是指粘贴不误建文本节点，与出图无关），即我们确实无"对话气泡直出图"工具。代价：用户只想"聊着出一张图看看"也会被塞一个画布节点。
5. **历史会话**：`conversationStore.js` 完整 CRUD（new/switch/delete L437-459）、`hydrated` 守卫防刷新丢历史（L46/L89/L431）、`pending` 刷新恢复（useAgentChat L486-493）、`ACTIVE_KEY` 记当前对话（L31）。但**仅 maomao 画布内 localStorage，无跨页面/后端共享**。

### C. 追平落点（可执行）+ 价值判断

| 能力项 | 我们现状 | 缺口 | 追平落点 | 成本 | 价值 | 倾向 |
|---|---|---|---|---|---|---|
| Chat 流式+可中断 | ✅ `roundTrip`+`stop`（L507/L872） | 无 | 保持 | 0 | 已具备 | 我们更强 |
| Agent 批量编排（Skill 三阶段 + execute_plan 多步 + 依赖批） | ✅ L621-632/L841 | 无 | 保持 | 0 | 高 | **我们更强** |
| Image 文生图/图生图（多参考图一对一拆分） | ✅ `sendImageMode` L800-841 + L349-381 | 无 | 保持 | 0 | 高 | **我们更强**（更细） |
| 即时单张生图/改图（轻量，不建画布节点） | ❌ 出图必建节点 | 缺"对话气泡直出图"路径 | 新增 imageMode/agent 的 `inline` 开关：`sendImageMode` 增加 `inline=true` 分支，调 `callTool('generate_image_inline')` 只回图不建节点；或在 `useCanvasAgentTools` 增加 `generate_inline_image` 工具 | 中（前端+工具层+渲染气泡） | 中（提升"轻聊出图"体验，但画布集成是我们的差异化优势，纯气泡出图价值有限） | **弊≥利**——优先级低，可做可选 inline 模式 |
| 历史会话 CRUD + 恢复上次 | ✅ `conversationStore` L437-459 + `pending` 恢复 L486 | 无（仅缺跨页面） | 保持 | 0 | 已够用 | 我们够用 |
| 跨页面/后端会话共享 | ❌ 仅本画布 localStorage | 缺后端持久化 | 需加后端 `/api/conversations` + `X-User-ID`（对齐大雄 L179-209） | 高（后端+账号体系） | 低（maomao 单页应用无需跨页面） | **弊>利**——不做 |
| 系统提示词编辑 | ✅ Skill + `systemPrompt` 注入（useAgentChat L193-194） | 无独立 system 输入框 | 可选在设置页加 systemPrompt 字段 | 低 | 低 | 利≈弊——按需 |
| 模型/供应商选择 | ✅ `agentProvider`/`agentModels`（AgentPanel L83-95）+ 生图模型 `ModelSelect`（L703-712） | 无独立聊天模型下拉（已注释 L667-700，因设置页统一指定） | 保持 | 0 | 已具备 | 我们更强 |

**关键判断**：
1. 我们 Agent 编排（Skill 三阶段 + execute_plan 批量 + 依赖批改图）**显著强于**大雄的"单张即时出图"。大雄的 Agent 模式本质是一次意图路由 + 单张 `generate_ai_image`，**无批量、无画布节点、无依赖编排**。
2. 我们**缺失**的是"不建画布节点的轻量即时出图"——但这恰是我们的差异化劣势的镜像：我们的价值就在"AI 操作画布"。纯气泡出图会削弱画布集成优势，故**不建议作为核心对齐项**，只做可选 inline 模式（成本中/价值中）。
3. 历史会话我们 `conversationStore` 已覆盖 CRUD + 刷新恢复 + 多对话隔离，**够用**；跨页面后端共享对单页应用无价值，**不做**。
4. 三模式映射：我们 `inputMode`（`agent`/`image`，AgentPanel L195/L593-611）已对等大雄 chat/agent(智能) + image；大雄的独立 `chat`(纯问答) 模式我们由 `agent` 模式在不触发工具时自然退化（无 tool_calls 即纯文本，useAgentChat L744）。

## 六、验收标准
1. 三节贯通，带文件+行号+片段。✅（A/B/C 三节均含 `agent-dock.js`/`main.py`/`useAgentChat.js`/`AgentPanel.jsx`/`conversationStore.js` 真实行号与片段）
2. 明确"我们更强"与"我们缺失"的项。✅（我们更强：Agent 批量编排、Image 多参考图拆分、历史 CRUD；我们缺失：轻量即时单张出图不建节点、跨页面后端共享）
3. 每项有成本与价值评级。✅（见 C 节矩阵）
4. 亲自核实代码。✅（所有行号来自本次实际打开 `agent-dock.js`(576 行)、`main.py`(L10878/L16045/L16080/L2625 等)、`useAgentChat.js`(934 行)、`AgentPanel.jsx`(838 行)、`conversationStore.js`(499 行) 核实）

## 七、铁律文件名
本文件即唯一产出。写满后结束。
