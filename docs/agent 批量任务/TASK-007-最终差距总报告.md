# 猫猫画布 vs 大雄 差距总报告

> 唯一产出文件（TASK-007）。综合外部 9 份分散分析 + 我们侧 `src/` 源码**逐文件实际核实**（2026-08-16 工作树）。
> 铁律：只读不改源码、行号来自本次实际打开、每条结论贴「文件+行号+代码片段」。凡外部说"缺"但源码已实现的，已**更正并标注「已实现」**。

---

## 〇、执行摘要（一页）

**核心结论**：我们（猫猫画布）的 AI 助手「大脑」——异步执行器、前序依赖、generations 执行契约、Skill 三阶段、输入状态机、会话隔离、stop 真中断、Wave 并行、live 防悬空、事件系统、AI 撤销栈、确认态——**已全部对齐或超过大雄**（这部分被外部 9 份分析大量误报为"缺失"）。

**真正未追平**集中在两块：
1. **执行器工程细节（融合/产品参考语义、提示词纯净度、提示词改写）**：`canvasPlanExecutor.js` 只有 `depends_on_previous` 布尔，没有 `fusion`/`product_reference` 的语义区分与提示词改写。这是影响电商套图"产品一致性"的核心差距。
2. **画布增强能力（局部提取融合 / 长图入口 / 节点对齐 / 发送至 AI 助手入口）** 与 **若干交互入口（失败项重试 UI / 参考图确认弹窗 / Skill 编辑导入 / mojibake 修复 / 中文参数写法）**。

**优先级建议**：
- 🔴 P0（真实硬缺口，纯前端可落）：2.1 失败项重试 UI、2.2 依赖模式 fusion/product_reference 语义区分、2.3 Skill 逐页无损绑定 + 阶段1 完整性门禁、2.4 中文参数写法归一 + 用户原文最高优先。
- 🟠 P1：3.1 局部提取与图像融合节点、3.2 参考图节点画布内去重复用、3.3 `attachment_indices` 越界防护、3.4 mojibake 纯函数、3.5 参考图角色标注、3.6 失败回滚/跳过文案。
- 🟡 P2：4.1「发送至 AI 助手」多选入口、4.2 长图底部入口 + 编辑器、4.3 节点对齐/分布菜单、4.4 Skill 编辑 + .md 导入、4.5 参考图任务确认弹窗、4.6 Artifacts 跨步产物传递。
- 🟢 P3（架构不符，不追）：双画布 smart/classic adapter、插件宿主层、桌面插件管理器、canvas-bug-fix 插件机制、后端 Skill CRUD FastAPI。

---

## 一、差距总表（按优先级）

> 状态说明：**缺失**（源码零实现）/ **半对齐**（有同类但细节弱）/ **已实现**（源码已核实，外部误报）。

| # | 差距项 | 等级 | 我们侧代码证据 | 落点 |
|---|--------|------|----------------|------|
| 2.1 | 失败项单步重试 UI | 🔴 缺失 | `AgentPanel.jsx` 无 `stateAction==='retry'` 按钮；`inputStateMachine.js:80` 有 `retry` 推导但 UI 未接 | `AgentPanel.jsx` / `AgentMessage.jsx` |
| 2.2 | 依赖模式 fusion/product_reference 语义 | 🔴 缺失 | `canvasPlanExecutor.js:19-24` 只有布尔 `dependsOnPrevious`，无 `dependency_mode` 分支 | `canvasPlanExecutor.js` |
| 2.3 | Skill 逐页无损绑定 + 阶段1 完整性门禁 | 🔴 半对齐 | `skillStore.js:22-37` 仅骨架；`useAgentChat.js:121-132` 无 `global_contract`/`AGENT_TASK_SPEC` | `useAgentChat.js` / `skillStore.js` |
| 2.4 | 中文参数写法 + 用户原文最高优先 | 🔴 缺失 | `canvasPlanExecutor.js:27-44` `normalizeRatio/normalizeResolution` 只认 `1k/2k/4k`、`9:16` | `canvasPlanExecutor.js` |
| 3.1 | 局部提取与图像融合节点 | 🟠 缺失 | `src/` 无 `ImageFusion`/`cropContext`（搜索零命中） | `ImageEditor.jsx` / 新节点 |
| 3.2 | 参考图节点画布内去重复用 | 🟠 缺失 | `canvasPlanExecutor.js:86-107` `createGenNode` 直接写 data.images，无 refNodeCache | `canvasPlanExecutor.js` |
| 3.3 | attachment_indices 越界防护 | 🟠 半对齐 | `useCanvasAgentTools.js:643-646` 已 `filter(i < refPool.length)` 裁剪，但无明确报错文案 | `useCanvasAgentTools.js` |
| 3.4 | mojibake 修复纯函数 | 🟠 缺失 | `skillStore.js` 直接 `JSON.parse`，无 `_repair_mojibake_text`（搜索零命中） | `skillStore.js` |
| 3.5 | 参考图角色标注（产品/风格/实拍） | 🟠 缺失 | `useAgentChat.js:103` 无角色语义注入 | `useAgentChat.js` |
| 3.6 | 失败回滚 / 跳过文案 | 🟠 半对齐 | `canvasPlanExecutor.js:171-173` 文案为"前置步骤未全部成功，已跳过" | `canvasPlanExecutor.js` |
| 4.1 | 多选图「发送至 AI 助手」入口 | 🟡 缺失 | `AgentPanel.jsx:204-232` 有 `pendingImageNodes` ghost，但无一键批量入口按钮 | `AgentPanel.jsx` |
| 4.2 | 长图底部入口 + 独立编辑器 | 🟡 半对齐 | `NodePalette.jsx:36` 有 `gridMergeNode` 长图字段，但无快速入口/编辑器 | `GridMergeNode.jsx` |
| 4.3 | 节点对齐/分布菜单 | 🟡 缺失 | `ContextMenu.jsx` 仅"对齐鼠标"，无对齐/分布子菜单（搜索零命中） | `ContextMenu.jsx` |
| 4.4 | Skill 编辑已有 + .md 导入 | 🟡 缺失 | `skillStore.js:75-92` `upsertCustomSkill` 仅新建/覆盖，无导入导出 | `skillStore.js` |
| 4.5 | 参考图任务确认弹窗 | 🟡 缺失 | 无 `agentRefConfirmPanel` 等价组件 | `AgentPanel.jsx` |
| 4.6 | Artifacts 跨步产物传递 | 🟡 缺失 | `conversationStore.js:36-38` `memory` 仅 `lastPlan`，无 artifact map | `canvasPlanExecutor.js` |

**外部分析误报、经核实已实现（已纠正，防重复投入）**：

| 外部声称缺失 | 实际情况（源码证据） | 来源 |
|--------------|----------------------|------|
| `stop()` 不真中断请求 | `useNodeGeneration.js:50,73,82,128-131` 已实现 AbortController 真中断 | `docs/11` 记录 `d80335f` 修复 |
| Wave1 串行非并行 | `canvasPlanExecutor.js:150-158` 已是 `Promise.all(wave1.map(runNode))` | 同上 |
| aiUndoStack 模块级串话 | `conversationStore.js:275-302` 已下沉 per-conversation；`useCanvasAgentTools.js:9-11` 改引 store | 同上 |
| pendingGenerations 模块级 | `conversationStore.js:304-317` 已下沉；`useCanvasAgentTools.js:59-67` 改引 store | 同上 |
| Skill 三阶段无确认态 | `useCanvasAgentTools.js:622-624` `getAwaitingConfirm()` 硬约束；`AgentMessage.jsx:139-151` 确认按钮 | 同上 |
| live 节点防悬空 | `canvasPlanExecutor.js:131-134` await 后重查节点 | `docs/11` §九 |
| 事件系统空转 | `eventBus.js` 已建 publish/subscribe，`docs/11` 记录接入 workflow 生命周期 | 同上 |
| 输入状态机缺失 | `inputStateMachine.js:36-124` 与大雄逐字一致，已就绪 | 全 9 份均误报 |
| 多对话隔离缺失 | `conversationStore.js` 订阅式 + 自动落盘 + hydrated 守卫 | 全 9 份均误报 |
| 任务中心/刷新恢复缺失 | `useAgentChat.js:432-440` pending 恢复；`taskStore.js` 任务中心 | 全 9 份均误报 |
| 空态 Skill chips 缺失 | `AgentPanel.jsx:494-514` 已渲染 `allSkills` chips 点击启用 | 多份误报 |

> ⚠️ 说明：外部 9 份分析写于 `docs/08-12` 之前或同时，未同步我们后续的 `d80335f` 等修复提交，故大量"缺失"已不成立。本报告以工作树真实状态为准。

---

## 二、分项详述

### 2.1 失败项单步重试 UI —— 🔴 缺失

**大雄做法**：每个生成卡片在 `status==='error'||'stopped'` 时渲染「重试失败项」按钮（`data-agent-gen-retry`），区分整条重试与单步失败重试，moderation 失败必须重新提交 API，`retryCount` 展示。

**我们现状（代码证据）**：
- 状态机已备：`inputStateMachine.js:78-83` 的 `action()` 在 `failed` 态且有内容时推导 `'retry'`，但——
- UI 未接：`AgentPanel.jsx` 全局搜索 `stateAction === 'retry'` **零命中**；`handleSend`（`AgentPanel.jsx:290-317`）只判断 `stateAction !== 'steer'`，失败时按钮仍是"发送"。`AgentMessage.jsx` 对 assistant 消息也无重试入口。
- 节点级重试存在：`taskStore.js:243-261` `registerTaskRetry`/`retryTask` 支持节点重跑，但仅任务中心（`TaskCenter.jsx:238`）可见，Agent 工作流消息卡片不可达。

**差距等级**：🔴 P0（体验硬伤，纯前端可落）。

**追平落点**：`AgentMessage.jsx` 对 `execute_plan` 返回的失败 entry 渲染「重试此步」按钮 → 调 `canvasPlanExecutor` 单步重跑（仅该 step + nodeId）；复用 `runNodeGeneration`，不新端点。Moderation 失败显式「重新提交」文案。

**复杂度**：低（约 40 行 UI + 单步重试函数）。

### 2.2 依赖模式 fusion / product_reference 语义区分 —— 🔴 缺失

**大雄做法**：`stepDependencyMode()` 区分 `fusion`（挂全部前序成功图 + 改写融合提示词）与 `product_reference`（只挂首张产品定稿 + 原参考图，强调"保持产品一致性不融合"），并 `buildFusionPrompt`/`buildProductReferencePrompt`/`extractSubjectLabel` 做中文提示词工程。

**我们现状（代码证据）**：
- `canvasPlanExecutor.js:19-24` `dependsOnPrevious()` 只认布尔：
```js
19:function dependsOnPrevious(step) {
20:  if (!step) return false
21:  if (step.depends_on_previous === true || step.use_previous_results === true) return true
22:  if (Array.isArray(step.depends_on_steps) && step.depends_on_steps.length) return true
23:  return false
24:}
```
- `canvasPlanExecutor.js:160-191` Wave2 对所有 `depends_on_previous` 统一连前序成功节点（`prevOk.map(...addEdges)`），**不区分 fusion/product_reference**，也不改写下游 `prompt`。证据：`:169-177` 只建连线，无提示词改写分支。
- `dependency_mode` 字段在 `SKILL_EXECUTION_RULES`（`useAgentChat.js:131`）与工具 schema（`useCanvasAgentTools.js:609`）里被 LLM 要求填写，但**执行器完全不消费它**。

**差距等级**：🔴 P0（电商"5主图+8详情"产品一致性的核心）。

**追平落点**：在 `dependsOnPrevious` 之外增加 `dependencyMode(step)` 读取 `step.dependency_mode`；Wave2 按模式决定挂载哪些前序图（product_reference 仅首张成功图；fusion 全部）并改写 `prompt`（平移大雄 `buildFusionPrompt`/`buildProductReferencePrompt` 为纯函数）。

**复杂度**：中（约 80 行 + 提示词函数）。

### 2.3 Skill 逐页无损绑定 + 阶段1 完整性门禁 —— 🔴 半对齐

**大雄做法**：阶段1 强制 `AGENT_TASK_SPEC` 结构化任务单 + `global_contract` 三项（视觉定位/统一风格/统一负面提示词）逐字锁定；截断策划不进阶段2；阶段2 逐页原文绑进 generation.prompt，不压缩。

**我们现状（代码证据）**：
- `skillStore.js:16-39` 内置 Skill 仅骨架：无逐页字段模板、无统一风格/负面提示词规则、无完整性门禁。
- `useAgentChat.js:121-132` `SKILL_EXECUTION_RULES` 仅要求"每步 prompt 完整纯净"，**无 `global_contract` 概念**，无完整性门禁。
- `executePlanTool`（`useCanvasAgentTools.js:618-665`）直接执行，无对 `global_contract` 的逐字下传。
- ✅ 三阶段框架已对齐（`show_plan_for_confirm` / awaitingConfirm 硬约束 / execute_plan），见 `useCanvasAgentTools.js:565-666` 与 `useAgentChat.js:563-565`。

**差距等级**：🔴 P0。

**追平落点**：`skillStore.js` 内置 content 平移大雄 universal-detail-pages 逐页结构 + 统一风格/负面提示词；`SKILL_EXECUTION_RULES` 增加"每步 prompt 必须含统一风格与统一负面提示词"约束 + 阶段1 完整性门禁（缺页/缺 global_contract 三项 → 返回需重规划）。

**复杂度**：中（prompt 改写 + 校验函数）。

### 2.4 中文参数写法归一 + 用户原文最高优先 —— 🔴 缺失

**大雄做法**：支持"9比16""高画质/中画质/低画质"等中文写法；用户对话显式参数最高优先且锁定到节点+生图请求。

**我们现状（代码证据）**：
- `canvasPlanExecutor.js:27-44` 归一表只认 `square/1:1`、`story/9:16`、`landscape/16:9`、`portrait/3:4`、`1k/2k/4k`。`normalizeRatio` 第 30 行 `if (r === '9:16')` 不认"9比16"；`normalizeResolution` 不认"高画质"。
- 用户原文优先：generations 字段 > 面板 defaults（`canvasPlanExecutor.js:88-90`），但**用户输入里的"9比16/高画质"未被解析锁定**——若 LLM 没写进 generations 则丢失。

**差距等级**：🔴 P0。

**追平落点**：`canvasPlanExecutor.js:27-44` 增中文映射表（9比16→9:16、高画质→high 等）；`useAgentChat.js` 解析用户输入时提取中文比例/画质，以最高优先级注入 generations。

**复杂度**：低。

### 3.1 局部提取与图像融合节点 —— 🟠 缺失

**大雄做法**：`local-patch` 提取矩形选区 → 生成带 `cropContext`（源 nodeId + 区域 + SHA）的局部图节点；融合节点（原图 + 多局部图 → 新全图），颜色匹配 + 对比滑杆 + 上下文冲突拦截。

**我们现状（代码证据）**：`src/` 搜索 `ImageFusion`/`cropContext`/`local-patch` **零命中**。`ImageEditor.jsx` 有裁剪但只产新图、无 `cropContext`；`GridMergeNode.jsx` 拼图非融合语义。

**差距等级**：🟠 P1。

**追平落点**：`ImageEditor.jsx` 裁剪流程加"提取为局部图节点"模式写 `cropContext`；新建 `ImageFusionNode`（参考 `GridMergeNode` 形态）实现融合 + 颜色匹配 + 比例/指纹校验。

**复杂度**：高（独立节点 + 融合算法）。

### 3.2 参考图节点画布内去重复用 —— 🟠 缺失

**大雄做法**：`refNodeCache`（URL→nodeId 单例）+ `findExistingImageNodeId`，整画布找不到才建一次。

**我们现状（代码证据）**：`canvasPlanExecutor.js:86-107` `createGenNode` 每次按 `step.referenceImages` 写进节点 `data.images`，**无"整画布复用同 URL 节点"逻辑**。

**差距等级**：🟠 P1。

**追平落点**：`createGenNode` 前 `getNodes()` 查同 URL 复用，命中则 `connectNodes` 而非新建；未命中才写 `data.images`。

**复杂度**：低。

### 3.3 attachment_indices 越界防护 —— 🟡 半对齐（已实现裁剪，缺明确报错）

**代码证据**：`useCanvasAgentTools.js:643-646` 已 `filter((i) => i < refPool.length)` 越界即裁剪，不会崩溃。但缺"越界即报错引导"的明确提示文案（对齐大雄 2.2.48 修复的索引越界 bug）。

**追平落点**：越界时返回明确 `{ok:false, error:'参考图编号超出范围'}` 或至少 toast 提示。

**复杂度**：极低。

### 3.4 mojibake 修复纯函数 —— 🟠 缺失

**大雄做法**：`backend.py` `_repair_mojibake_text` 检测并修复 CP1252/Latin1 误解码的 UTF-8 中文。

**我们现状**：`skillStore.js:47-55,75-92` 直接 `JSON.parse`/`JSON.stringify`，无乱码兜底（搜索 `_repair_mojibake` 零命中）。风险低（我们走 UTF-8 localStorage），但平移成本低。

**追平落点**：`skillStore.js` 加纯函数 `repairMojibake`，在 `upsertCustomSkill`/`getAllSkills` 读写入路径过一遍。

**复杂度**：低。

### 3.5 参考图角色标注（产品/风格/实拍） —— 🟠 缺失

**大雄做法**：LLM 规划时为每张参考图标角色（产品图/风格图/实拍图），并执行层按 `attachment_indices` 连线 + 产品一致性原则双重锁定。

**我们现状**：`useAgentChat.js:103` 仅要求 LLM 用 `attachment_indices` 精确引用，**无角色语义**也未显式传递/展示给用户。

**追平落点**：`CANVAS_AGENT_RULES`（`useAgentChat.js:83-116`）补"必须为每张参考图标角色"指令（纯提示词，零后端成本）；UI chip 可选显示角色标签（增强项）。

**复杂度**：低。

### 3.6 失败回滚 / 跳过文案 —— 🟡 半对齐

**代码证据**：`canvasPlanExecutor.js:171-173` 失败文案为 `'前置步骤未全部成功，已跳过'`，缺"成功/总数 + 引导重试"文案（对齐大雄 `prevFailed>0 → 提示重试`）。

**追平落点**：补 `X/Y 成功，已跳过融合步骤，请先重试失败的素材步骤` 文案；可选在 assistant 消息逐步汇报（`toastStore`）。

**复杂度**：极低。

### 4.1 多选图「发送至 AI 助手」入口 —— 🟡 缺失

**大雄做法**：智能画布选图后浮出「发送至设计大师（N 张）」按钮，冻结选区后灌入 Agent。

**我们现状**：`AgentPanel.jsx:204-232` 已实现 `pendingImageNodes`（ghost 待确认），但**无一键批量入口按钮**——依赖用户手动在面板确认。选区冻结已天然由 React state 保证（`AgentPanel.jsx:208-213`），优于大雄。

**追平落点**：画布多选图片节点时增浮动按钮「发送给 AI 助手（N 张）」→ 调 `confirmPendingImages`（`AgentPanel.jsx:215`）。

**复杂度**：低。

### 4.2 长图底部入口 + 独立编辑器 —— 🟡 半对齐

**大雄做法**：框选多图 → 底部"合成长图" → 双击编辑器拖拽排序/改宽/放大小图。

**我们现状**：`NodePalette.jsx:36` `gridMergeNode` 已含 `longDirection/longTargetSize/longAutoSize` 长图字段（`GridMergeNode.jsx` 支持），但**无"框选多图→一键合成长图"入口、无双击拖拽排序编辑器**。

**追平落点**：画布多选图片节点时浮条「合成长图」→ 用 `GridMergeNode` longImage 模式；补双击打开排序编辑器。

**复杂度**：中。

### 4.3 节点对齐/分布菜单 —— 🟡 缺失

**大雄做法**：`node-align-distribute` 选中多节点 → 6 向对齐 + 关键对象对齐 + 水平/垂直分布。

**我们现状**：`ContextMenu.jsx` 搜索"对齐/分布"仅命中"对齐鼠标"注释（`ContextMenu.jsx:18`）；`useArrangeCanvas.js` 有全局 dagre 自动排版，**无选中局部对齐/分布**。

**追平落点**：`ContextMenu.jsx` 多选时加对齐子菜单（左/右/上/下/水平居中/垂直居中 + 分布），纯计算写 `setNodes` 并入历史栈。

**复杂度**：中。

### 4.4 Skill 编辑已有 + .md 导入 —— 🟡 缺失

**大雄做法**：可 PUT 改任意 Skill content；支持 `.md`/`.txt` 导入。

**我们现状**：`skillStore.js:75-92` `upsertCustomSkill` 仅新建/覆盖（无"编辑已有 content"UI 入口提示，无导入导出）。

**追平落点**：`SkillSettings` 加编辑已有 content + `.md` 导入/导出（解析 `# 标题`+正文）。

**复杂度**：低。

### 4.5 参考图任务确认弹窗 —— 🟡 缺失

**大雄做法**：带参考图任务进规划前弹 `agentRefConfirmPanel` 列出参考图，用户确认/取消。

**我们现状**：参考图直接进三阶段，无专门确认弹窗（`executePlanTool` 入口无确认拦截）。

**追平落点**：`present_plan` 阶段若 generations 含 `attachment_indices`/`referenceImages`，前端先弹确认卡片（复用 `ArrangeConfirm` 式组件）。

**复杂度**：低。

### 4.6 Artifacts 跨步产物传递 —— 🟡 缺失

**大雄做法**：`input_artifact_ids`/`output_artifact_id` 声明步骤间非图像中间成果依赖（Logo→品牌色系→产品→推广图多轮传递）。

**我们现状**：`conversationStore.js:36-38` `memory` 仅 `lastPlan`，无 artifact map；`canvasPlanExecutor.js` 仅连线隐式传递图像，无显式成果身份。

**追平落点**：执行器登记 `{artifactId, nodeId, resultUrl, role}` 模块/对话级 map；下游显式写 `data.images`（前端内存态即可，无需后端）。

**复杂度**：中。

---

## 三、架构差异（结构性）

| 维度 | 大雄 | 我们 | 结论 |
|------|------|------|------|
| 画布形态 | 双画布 classic（prompt/generator/output）+ smart（smart-image），各 adapter | 单 ReactFlow 画布 + `promptNode` 单节点 | **架构差异，不追**（执行器已通过工具层解耦，无需双 adapter） |
| 插件机制 | schema v2 插件 + 宿主 `CanvasAgentHost` + 桌面管理器 EXE | 单体 React 应用，能力直编进节点/组件 | **不追**（非插件架构） |
| 后端 Skill | FastAPI `backend.py` CRUD + 乱码修复 | localStorage + 前端 `skillStore.js` | **不追**（纯前端足够；仅 mojibake 纯函数可平移，见 3.4） |
| 生图引擎 | volcengine/modelscope/runninghub/comfy 多引擎 | `runNodeGeneration` 统一契约，provider 经 `useAgentChat` 转发 | **半对齐**（视后端是否暴露多引擎，当前无需） |
| 任务持久化 | 无任务中心 | 任务中心 + 刷新恢复轮询（`useAgentChat.js:432-440`） | **我们更强** |
| global_contract / artifact | 显式契约 + 跨轮产物链路 | 仅 `lastPlan` 记忆 | **差距**（见 2.3 / 4.6） |

---

## 四、已对齐确认（我们已实现，外部误报项，防重复投入）

以下能力经源码核实**已对齐或超过大雄**，不要再投入：

1. **异步执行器**：`useNodeGeneration.js:64-125` `start()` 返回 `{ok,resultUrl}`，已落盘持久 URL，比大雄轮询更可靠。
2. **前序依赖 + generations 执行契约**：`canvasPlanExecutor.js:65-197` Wave1/Wave2 + 连线传递前序图。
3. **分组事务 AI 撤销栈**：`conversationStore.js:275-302` `aiUndoStack` per-conversation；`useCanvasAgentTools.js:186-193` `MUTATING_TOOLS` 整体入栈，`undo_ai` 整体撤回（`useCanvasAgentTools.js:766-777`）。
4. **模型锁定**：`canvasPlanExecutor.js:88-98` 参数优先级 + `genParams`（`useCanvasAgentTools.js:25-31`）。
5. **输入状态机**：`inputStateMachine.js:36-124` 与大雄逐字一致（send/stop/steer/retry/idle）。
6. **Skill 三阶段 + 确认态硬约束**：`useCanvasAgentTools.js:565-666`（`getAwaitingConfirm` 校验）；`AgentMessage.jsx:139-151` 确认按钮。
7. **多对话隔离 + 刷新恢复**：`conversationStore.js` 订阅式 + 自动落盘 + hydrated 守卫；`useAgentChat.js:432-440` pending 恢复。
8. **stop 真中断**：`useNodeGeneration.js:50,73,128-131` AbortController 真中断。
9. **Wave1 并行**：`canvasPlanExecutor.js:150-158` `Promise.all`。
10. **live 节点防悬空**：`canvasPlanExecutor.js:131-134` await 后重查节点。
11. **事件系统**：`eventBus.js` publish/subscribe 接入 workflow 生命周期（`docs/11` §九）。
12. **参考图 ghost 待确认**：`AgentPanel.jsx:204-232` `pendingImageNodes` 防误触。
13. **图像模式直连生图**：`useAgentChat.js:735-789` `sendImageMode` 复用 `execute_plan`。
14. **参考图编号目录 + attachment_indices 精确取图**：`useAgentChat.js:599-612` + `useCanvasAgentTools.js:642-649`（已越界裁剪，见 3.3）。
15. **空态 Skill chips 点击引用**：`AgentPanel.jsx:494-514`。
16. **可拉伸侧栏**：`AgentPanel.jsx:386-390` 拖拽手柄（MIN 320 / MAX 720）。
17. **「设为默认」模型记忆**：`agentModelStore`（`loadAgentChatModel` 在 `AgentPanel.jsx:83-103` 使用）。
18. **统一工具层（24 工具）**：`useCanvasAgentTools.js:824-856` `AGENT_TOOLS` 统一信封。
19. **SSE 流式 + reasoning + tool_calls 增量**：`useAgentChat.js:150-172` `parseSSEChunk` + `roundTrip`。

---

## 五、不需要追平的（架构不符 / 低价值）

1. **双画布 smart/classic adapter 体系**：我们单画布，执行器已工具层解耦，无需 host 抽象。
2. **插件宿主 `CanvasAgentHost` + schema v2 清单**：单体应用，能力直编节点/组件。
3. **桌面插件管理器 EXE（自更新）**：Web/本地混合架构，非插件生态。
4. **canvas-bug-fix 插件机制**：我们走主代码修复，无需热补丁插件；`useArrangeCanvas` 已全局排版，仅缺"仅整理选中"（可选补，见 4.3 范畴）。
5. **后端 Skill CRUD FastAPI + 同名 409 / usage_count**：localStorage 纯前端足够；仅 mojibake 纯函数 worth 平移（3.4）。
6. **generator/output 双节点拆分**：与单体 `promptNode` 架构不符，收益低。
7. **多生图引擎路由（engine 字段）**：当前 `runNodeGeneration` 统一契约足够，视后端暴露再定。

---

## 六、追平路线图（按依赖排序 + 验收标准）

> 原则：不破坏现有架构；改 `src/` 后跑 `npm run test:smoke` + `npm run build`；复用 `base/` 工具层；字符串契约零损伤。

**阶段 A — P0（核心体验，纯前端可落，约 1-2 天）**
1. **2.4 中文参数写法 + 用户原文最高优先** → `canvasPlanExecutor.js:27-44` 增映射；`useAgentChat.js` 解析用户输入。验收：输入"9比16/高画质"生成对应节点。
2. **2.2 依赖模式 fusion/product_reference 语义** → `canvasPlanExecutor.js:19-24,160-191` 增 `dependencyMode()` + 提示词改写纯函数。验收：启用「电商详情页」Skill 出 5主图+8详情，依赖步产品一致性不融合。
3. **2.3 Skill 逐页无损绑定 + 阶段1 完整性门禁** → `skillStore.js:16-39` 平移 universal-detail-pages；`useAgentChat.js:121-132` 加 `global_contract` 约束。验收：截断策划被拒；统一风格/负面词逐字进每步 prompt。
4. **2.1 失败项单步重试 UI** → `AgentMessage.jsx` + `canvasPlanExecutor.js` 单步重跑。验收：某步失败，消息卡片有「重试此步」，仅重跑该步。

**阶段 B — P1（执行器工程 + 健壮性）**
5. **3.2 参考图节点去重复用** → `canvasPlanExecutor.js:86-107`。验收：多步引同一图只建一个参考节点。
6. **3.3 attachment_indices 明确报错** → `useCanvasAgentTools.js:643-646`。验收：越界索引返回明确错误。
7. **3.6 失败跳过文案 + 进度日志** → `canvasPlanExecutor.js:171-173`。验收：跳过步显示 X/Y + 引导重试。
8. **3.4 mojibake 修复** → `skillStore.js`。验收：粘贴乱码 Skill 被修复。
9. **3.5 参考图角色标注** → `useAgentChat.js:83-116` 提示词 + 可选 UI 标签。验收：LLM 为参考图标产品/风格/实拍。

**阶段 C — P2（画布增强能力，中等成本）**
10. **4.3 节点对齐/分布菜单** → `ContextMenu.jsx`。验收：多选节点可对齐/分布。
11. **3.1 局部提取与图像融合节点** → `ImageEditor.jsx` + 新 `ImageFusionNode`。验收：选区提取→融合回原图。
12. **4.2 长图底部入口 + 编辑器** → `GridMergeNode.jsx`。验收：框选多图→合成长图→双击调序。
13. **4.1 多选图「发送至 AI 助手」入口** → `AgentPanel.jsx`。验收：画布多选图片浮按钮一键灌入。
14. **4.5 参考图任务确认弹窗** → `AgentPanel.jsx`。验收：带参考图任务先确认再规划。
15. **4.4 Skill 编辑 + .md 导入** → `skillStore.js`。验收：编辑已有 + 导入 .md。
16. **4.6 Artifacts 跨步产物传递** → `canvasPlanExecutor.js` + `conversationStore.js`。验收：Logo→色系→产品→推广图跨轮引用。

> 阶段 A 不依赖任何新节点/后端，全部落点已覆盖 90% 核心差距；阶段 C 的 3.1/4.2/4.3 属画布增强，可按产品规划分批。

---

*报告生成：2026-08-16，基于 `src/` 工作树实际核实 + 外部 9 份分析综合去重。所有"缺失"项均以本次打开源码行号为证；外部误报项已在「已对齐确认」与「差距总表误报栏」纠正。*
