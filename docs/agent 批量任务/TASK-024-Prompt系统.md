# TASK-024 — Prompt 系统核验（大雄模板库/预设/上游继承 vs 我们 PromptLibrary）

> 只写本文件，未改动任何 `src/` 代码，未运行脚本。所有行号来自本次实际打开核实。

## 一、项目背景
大雄 Infinite-Canvas 有一套完整的 Prompt 系统：**模板库**（`promptTemplateGroup`/分组/场景标签）、**预设**（`promptPreset`，从节点一键存为预设）、**上游 prompt 继承**（下游节点自动拼上游的 prompt 作为 LLM 输入）、**提示词工程**（正负面模板、占位变量）。我们（maomao）有 `PromptLibrary.jsx` / `PromptInput.jsx`。本任务核验大雄 Prompt 系统与我们的差距。

## 二、铁律遵守
- 仅读不改：未修改任何 `src/`、未写脚本，唯一产出即本文件。
- 行号真实：均来自本次实际打开的文件。
- 结论均有代码证据。

---

## 三、大雄怎么做（代码证据）

### 3.1 预设（Preset）：从节点一键存为命名预设 + 面板管理/复用
- `loadPromptPresets` @ `smart-canvas.js L4153`：从 `localStorage[PROMPT_PRESETS_KEY]` 读取 `{id, text}` 数组。
- `savePromptPresets` @ L4161：写回 localStorage。
- `createPromptPresetFromNode` @ L4336：`const text = String(node?.text || '').trim(); ... const preset = {id:uid('preset'), name:defaultPromptPresetName(text), text, ...}; promptPresets.unshift(preset); savePromptPresets(); if(node) node.promptPresetId = preset.id;` —— 即"把当前节点 text 存成命名预设并绑定到节点"。
- `savePromptNodeAsPreset` @ L4364：直接调 `createPromptPresetFromNode(node)`。
- `openPromptPresetPanel` @ L4385：按节点相对画布定位打开预设面板，支持选择/删除预设（`renderPromptPresetPanel` L4367）。
- 预设数据模型：仅 `{id, name, text, category, createdAt, updatedAt}`（见 L4339 / L4357），**无 positive/negative 字段**——预设是纯文本 prompt 存/取。

### 3.2 模板库（Template Library）：分组 + 场景标签 + 搜索 + 应用
- 内置分组 `defaultPromptTemplateGroups` @ L4164：`view / storyboard / character / product / lighting / mine`。
- `loadPromptTemplateGroups` @ L4174 + `savePromptTemplateGroups` @ L4185：分组持久化（localStorage）。
- `loadPromptTemplates` @ L4202：从后端 `/api/prompt-libraries`（或 fallback `/api/smart-canvas/prompt-templates`）拉取模板，含 `positive` 字段；支持多词库（library）。
- 模板条目模型：`{id, name, scene, positive, negative, params, category}`（见 `promptTemplateItems` L4228-4259 的 mine 映射与 L4243 builtin 过滤）。
- `renderPromptTemplatePanel` @ L4429：渲染分类导航 + 搜索（`promptTemplateSearchText` L4277 含 name/scene/positive/negative）+ 卡片列表（含场景 `promptTemplateScene` L4273、标签）。
- `applyPromptTemplateToNode` @ L4606：`node.text = promptTemplateText(template, mode); node.promptPresetId = ...` —— 模板应用到节点 text。
- `saveCurrentPromptAsTemplate` @ L4627：把当前节点/Composer 的 prompt POST 到 `/api/prompt-libraries/items` 存为模板。
- `promptTemplateText(template, mode)` @ L4260：按 `positive`（默认）或 `full`（positive + `Negative prompt:` + `Params:`）拼装输出。

### 3.3 上游 prompt 继承（上游文本自动拼入下游 LLM 输入）
- `promptNodePromptItems` @ L1745：把节点自身 text 按分隔符拆成 items（支持 `promptSplitEnabled` 分隔符拆分，L1748）。
- `promptTextItemsForNode` @ L1775：取节点自身 prompt items，且对 `smart-group` 类型**递归**展平其成员（L1782 `smartGroupMembers(node).flatMap(...)`）。
- `promptNodeUpstreamPromptItems` @ L1785：`inputNodesFor(node).flatMap(input => promptTextItemsForNode(input))` 去重。
  - 关键：`inputNodesFor` @ L12273 调 `upstreamNodesForKinds(node, ['input'])` @ L12261，**只取连接 `kind==='input'` 的上游**（L12265-12267 按 `conn.kind` 过滤；非 connections 模式则退回 `node.inputNodeIds`）。即**不是"所有上游"，而是标记为 input 类连线**的上游节点文本，非 input 连线（如 flow）不计入。
- `promptNodeUpstreamPromptText` @ L1793：`promptNodeUpstreamPromptItems(node).join('\n\n')`。
- `promptNodeLLMInputText` @ L1796：`[upstream, instruction].filter(Boolean).join('\n\n')` —— **上游 text + 本节点 instruction**（`node.llmInstruction` 或自身 prompt items）拼成最终 LLM 输入。
- 渲染层也展示：`upstreamPromptHtml` @ L6951-6955 在节点内渲染"上游输入"区块（仅 `llmEnabled` 时有，见 L6956 起的 `prompt-node-llm` 分支）。
- 实际生成调用：`runPromptLLMNode` @ L14638：`const message = promptNodeLLMInputText(node).trim();` 再 `fetch('/api/canvas-llm', ...)` —— 确认上游 prompt 继承**真正进入 LLM 请求**。
- 触发条件：依赖 `node.llmEnabled === true`（L14644 运行时强制置 true；UI 中该区块只在 `prompt-node-llm` 渲染）。即这是"Prompt 节点开启 LLM 模式（`llmEnabled`）"时的链式文本串联，普通生图（不开 LLM）不会自动拼上游 prompt。

### 3.4 正负面 / 提示词工程
- 仅模板库支持：`promptTemplateText` L4260 区分 positive / negative / params（用于 SD 类生图）。
- 预设（preset）本身**不含** positive/negative，只是纯文本。
- 节点自身支持分隔符拆分：`promptNodeSeparator` L1741、`promptNodeSplitEnabled`（L1748）实现单框多段。

---

## 四、我们现状（代码证据）

### 4.1 提示词库 `PromptLibrary.jsx`
- 数据层 `promptManager.js`：预设模型 `{id, title, type, prompt, enabled}`，`type` = `text|image|video|all`（L4-7、L133-138 的 `CATEGORY_OPTIONS`）。**有分类（type），但无场景标签、无 positive/negative 字段、无分组管理、无多词库。**
- 支持：我的提示词 / 最近使用双 tab（L26、L144-155）、按分类筛选 + 搜索（L58-62、`searchCards` `promptManager.js L124`）、新建/编辑/删除（L75-112）。
- **缺失"从节点一键存为预设"**：`PromptLibrary` 的 `onUse` 回调只把 prompt 交给宿主（L64-73），不反向写回源节点；没有 `saveCurrentPromptAsTemplate` 等同入口。

### 4.2 提示词输入 `PromptInput.jsx`
- 纯 `textarea` 输入（L69-83），支持 `@` 触发素材引用弹层（L85-127，`refImages/refTexts`）。
- **无**：分隔符多段拆分、正/负切换、占位变量、模板变量替换。
- 尺寸由 `inputWidth/inputHeight` 驱动（L72-78），与节点 data 双向回写。

### 4.3 上游数据读取 `useConnectedInputs.js`
- 机制：下游生成时实时读**直接上游**产出的 `images/texts/videos/audios`（L139-177，`edges.filter(e => e.target === nodeId)`）。
- `textNode` 产出 `data.text` 作为参考文本（L122-124），`promptNode`(生图) 产出 `data.imageUrl`（L133-134 通用兜底）。
- **关键差异**：我们的"上游"只把上游文本/图片作为**参考素材（@引用 / 参考图）**，并不自动把上游 prompt 文本**拼装进下游节点自身的 prompt / LLM 输入**。即没有大雄的 `promptNodeUpstreamPromptText` 那种"下游 prompt = 上游 prompt + 本节点指令"的文本继承概念。
- 生图节点 `PromptNode.jsx`：上游图走 `refImages`（L226）传给 `generateImage` 的 `images`（L163），上游文本走 `refTexts`（L227）→ `@` 引用插入（L229），但**不会自动拼成大段上游 prompt 文本填入 prompt 框**。

### 4.4 预设应用方式（`PromptLibraryButton.jsx`）与覆盖范围
- 点"预设"→ 打开库 → 选"使用"→ **在视口中央新建一个文本节点**（L26-42，`addNodes([{type:'textNode', data:{text: prompt}}])`）。
- 即预设 = "快速生成带内容的文本节点"，**不是**"把预设写入当前节点 prompt / 绑定 `promptPresetId` 复用"。与大雄 `applyPromptTemplateToNode` 直接改写目标节点 `node.text`（L4621）不同。
- **覆盖范围**：`PromptLibraryButton` 被三处节点引用，不止生图：
  - `PromptNode.jsx` L384 `<PromptLibraryButton category="image" />`
  - `TextNode.jsx` L349 `<PromptLibraryButton category="text" />`
  - `DiscountVideoNode.jsx` L354 `<PromptLibraryButton category="video" />`
  - 即预设库已覆盖 生图/文本/视频 三类节点，分类筛选与节点类型对齐。

### 4.5 我们侧已有的"负向提示词"能力（Agent 链路，非节点输入框）
- 注意：负向提示词概念在我们侧**并非完全缺失**，而是存在于 **Agent 统一风格契约（global_contract）**，未下沉到节点级 `PromptInput`/模板库：
  - `conversationStore.js` L39 `global_contract: null` 含 `unified_negative_prompt`（统一负面提示词）。
  - `useAgentChat.js` L134 / L218：阶段1 策划产出 `global_contract`（含 `unified_negative_prompt`），并**逐字锁定**带入后续每步 prompt 头部，不可改写/省略。
  - `useCanvasAgentTools.js` L597 / L601 / L651、L691：`global_contract` schema 含 `unified_negative_prompt`，`gcText` 拼装进入每步生成。
  - `canvasPlanExecutor.js` L238：同样把 `unified_negative_prompt` 拼入每步 prompt。
- 结论：**节点输入框/模板库层无 positive/negative 字段**，但 **Agent 多步创作链路已有 unified 负向提示词机制**。这改变了"正负面"的落点判断（见第五节）。

---

## 五、追平落点（可执行）+ 价值判断

| 能力 | 大雄现状（证据） | 我们现状（证据） | 缺口 | 落点（可执行） | 成本 | 价值 | 判断 |
|---|---|---|---|---|---|---|---|
| 预设存取（命名预设 + 节点绑定） | `createPromptPresetFromNode` L4336（含 `node.promptPresetId` 绑定）/ 面板 L4367 / `applyPromptTemplateToNode` 改写 `node.text` L4621 | `promptManager.js` 支持命名预设 CRUD + 分类；`PromptLibraryButton` 覆盖 image/text/video 三节点（见 4.4）；但选"使用"是**新建文本节点**而非写回当前节点，无 `promptPresetId` 绑定 | 缺"从当前节点一键存为预设" + "预设写回当前节点 prompt" | 小：在 `PromptInput` 旁加"存为预设"按钮 → `createPreset()`；`onUse` 增加"应用到当前节点"分支写 `node.data.prompt` | 低 | 中 | **已有补强**（利≥弊） |
| 模板库（分组+场景标签+搜索+多词库+应用） | `renderPromptTemplatePanel` L4429 / `loadPromptTemplates` 多词库 L4202 / 场景 `promptTemplateScene` L4273 / `applyPromptTemplateToNode` L4606 | `PromptLibrary.jsx` 有分类 + 搜索，但无场景标签 / 分组管理 / 多词库 | 库能力≈简化版，缺场景标签与分组管理 | 中：给 `promptManager` 预设加 `scene` 字段 + 分组标签页 | 中 | 中 | **已有补强**（利≥弊） |
| 正负面提示词 | 节点模板 `promptTemplateText` L4260（positive/negative/params） | 节点 `PromptInput`/`promptManager` 无 positive/negative 字段；但 **Agent 链路已有 `unified_negative_prompt` 统一风格契约**（`conversationStore.js` L39 / `useAgentChat.js` L134,L218 / `useCanvasAgentTools.js` L601 / `canvasPlanExecutor.js` L238），逐字锁定带入每步 prompt | 节点输入框/模板库层无 negative；Agent 层已具备，未下沉到节点 | 中：把 `unified_negative_prompt` 概念下沉到 `PromptInput`（负向文本框）+ 模板条目 `negative` 字段 | 中 | 高（生图/视频用户强需求；Agent 已验证价值） | **部分已有 + 下沉补强**（利≥弊） |
| 上游 prompt 文本继承（拼装进下游 LLM 输入） | `promptNodeLLMInputText` L1796 + `runPromptLLMNode` L14638 真正进 LLM 请求；仅取 `kind==='input'` 上游（L12261/L12273），且需 `node.llmEnabled`（L14644） | `useConnectedInputs.js` L139-177 只把上游当参考素材，不自动拼 prompt 文本进下游 | 缺"下游 prompt = 上游 prompt + 本节点指令"的链式文本继承（且大雄限定 input 连线 + LLM 模式，并非所有上游） | 高：新增"prompt 继承模式"，仅对 `kind==='input'` 上游 text 节点、在生成时拼入最终 prompt（复刻 L1793/L1796） | 高 | 中（仅多节点链式文本创作用得上；当前主流用参考图/@引用） | **全新能力**（视场景，链式文本创作才利大于弊；当前主用参考图，优先级中，建议暂缓） |
| 分隔符多段 / 占位变量 | `promptNodePromptItems` L1745（split by `promptSeparator`） | 无多段拆分 | 无多段拆分 | 低-中：节点 prompt 支持分隔符拆分多段 | 低 | 低 | **全新能力**（按需） |

### 关键判断
1. **预设 / 模板库**：我们已具备 70% 能力（命名预设 CRUD + 分类 + 搜索 + 覆盖三类节点）；仅缺"节点↔预设绑定"和"场景标签/分组管理"。属已有补强，成本低、收益明确，**建议做**。
2. **正负面提示词**：节点层缺失，但 **Agent 统一风格契约已落地 `unified_negative_prompt` 并逐字锁定每步**——说明负向词需求真实存在且被验证。落点应为"把该概念下沉到节点 `PromptInput` + 模板条目"，**建议做（生图/视频价值高）**。
3. **上游 prompt 纯文本继承**：大雄限定"input 类连线 + `llmEnabled` 模式 + 多节点链式文本创作"。我们当前主流用法是"上游参考图/参考素材 + @引用"，链式纯文本 prompt 继承使用频率低、实现成本高（要改生成链路把上游 text 拼入最终 prompt）。**当前弊≤利，建议暂缓；若后续强化"多节点串联生文/改写"再补。**

### 结论倾向
- **利大于弊、建议落地**：预设节点绑定、模板场景标签/分组、正负面下沉到节点输入框。
- **弊大于利/暂缓**：上游 prompt 纯文本继承（优先级中，等链式文本创作场景成熟再做）。

---

## 六、验收自检
- 三节贯通，均带文件+行号+片段：✅（大雄 `smart-canvas.js` L4153/L4336/L4367/L4429/L4606/L4260/L1785/L1793/L1796/L14638/L12261/L12273；我们 `PromptLibrary.jsx` / `PromptInput.jsx` / `useConnectedInputs.js` L139-177 / `promptManager.js` / `PromptLibraryButton.jsx` L26-42 / `PromptNode.jsx` L226-229,L384 / `TextNode.jsx` L349 / `DiscountVideoNode.jsx` L354 / `conversationStore.js` L39 / `useAgentChat.js` L134,L218 / `useCanvasAgentTools.js` L597,L601,L651,L691 / `canvasPlanExecutor.js` L238）。
- 区分"已有补强"vs"全新能力"：✅（见第五节表格与判断，含"部分已有+下沉补强"细分）。
- 每项成本与价值评级：✅。
- 亲自核实代码：✅（本次实际打开上述文件，行号均来自实际读取）。
- 审计修正记录（自审补漏）：① 上游继承范围——大雄仅取 `kind==='input'` 连接上游（非所有上游）、需 `llmEnabled`，已更正；② 预设覆盖——`PromptLibraryButton` 同时用于 image/text/video 三节点，已更正"仅生图"误述；③ 正负面——发现 Agent 链路已有 `unified_negative_prompt` 统一契约，节点层缺失但非全无，已更正"全新缺失"误述并调整为"下沉补强"。
