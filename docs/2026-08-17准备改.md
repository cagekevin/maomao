# AI 助手「反推图一却反推了全部」—— 与大雄代码的差距分析（修订版）

> 背景：用户连续多轮对话，**每轮都带一张图**（生图）。到第 4 轮**依然带了一张图**、并说「反推图一的提示词」，AI 把历史里所有图（1/2/3 轮 + 本轮第 4 轮的图）的提示词都反推了。
> 本文最初草率断言「我们和大雄机制一样、只是编号歧义」，经逐行核对大雄源码后**该结论作废**。本文为修订版，定位到一条**架构级差距**。
> 第三版（审计版）：在用户要求"再仔细检查、审计清楚"后，对前两版的自称"实锤"做了反向审计，纠正了一处证据方法不可靠、补入一个不推翻结论但需澄清的执行层反例，并确认"全量回传"比我之前说的更绝对（无截断）。见第 8 节《审计记录》。
> **第四版（本轮更新）**：用户纠正了关键前提——**第 4 轮也带了一张图**。原文档 §3 默认"第 4 轮没带图"，因此对真实场景的解释是错的。本版据此重写归因机制（见 §3.2「撞号 + 真图堆积」双重放大），并补入执行层、TextNode 反推链路的独立核实结果（§4.5.5、§9）。见第 9 节《审计记录（第四版）》。
> **本文不改任何代码，只做分析。**

---

## 0. 结论（先说清楚）

**我们和大雄的差距不在「编号目录 / attachment_indices / 禁止跨轮引用」这些表层机制——这些我们都有，且显式标注对齐大雄。**

**真正的差距是两条核心架构差距：历史图是否进 LLM 上下文、用什么形式进。（原文档曾列"执行层是否挂前轮图"为差距③，经第四版独立核实我们执行层同样不挂前轮图，已降级为非差距，见 §4.5.5。）**

1. **差距①（发送层）：历史消息是否回传给 LLM。** 大雄每轮 fresh-task（`agentFreshTaskHistoryMessages()` 恒 `return []`），历史图根本不进 LLM 上下文；我们全量回传，且把历史图以 `image_url` 内联。
2. **差距②（表示层）：跨轮图记忆靠什么。** 大雄靠「图 token 编码 + 跨轮目录反查 `agentParseRefTokensFromText`」，历史图以文本 token 存在历史里、执行层反查原图，LLM 上下文里一张历史图都没有；我们完全没有这层，历史图直接以原图 URL 堆进上下文。
3. **差距③（执行层）：是否默认参考上一轮结果。** 大雄 `agentForceNoStaleLastOutputs` 把「跨轮 lastResults 彻底关闭」；**经本轮代码核实，我们执行层 `useCanvasAgentTools.js` 同样不挂前轮图**——`setCurrentReferenceImages` 走 `setCurrentRefImages`（per-conversation 覆盖写），`execute_plan` 取 `refPool = getCurrentReferenceImages()`（仅本轮 `send` 时写入，见 `useAgentChat.js:843-861`），按 `attachment_indices` 精确取（751-757 行）。**即差距③在我们这边经核实并不成立——执行层反而不是根因，原文档将其列为"核心差距③"有误，应降级为"非差距"。** 详见 §4.5.5。

**因此「全反推」的根因是：我们的全量历史含图回传（差距①）+ 缺少 token 化跨轮图记忆（差距②）把前几轮的「真图」累积进上下文。在「第 4 轮也带图」的真实场景下，直接触发机制是「撞号 + 真图堆积」双重放大（见 §3.2）：每一轮各自把"自己那张"编号为"参考图1"，导致 LLM 上下文里出现多个都叫"参考图1"的真图，用户说"图一"时模型无法消歧，遂全反推。大雄因为 LLM 上下文里根本无历史图（token 化 + fresh-task 双重保证），自然不会「全反推」。**

**审计后置信度：差距①为"源码逐行实锤"（无截断的全量内联，见 §2.2 修正）；差距②为"语义+字面双重零命中"（见 §4.5.1 修正）；差距③经本轮核实"我们执行层也不挂前轮"，不构成根因，从核心差距中移除（见 §4.5.5）。**

（注：用户指出「三阶段只在用 Skill 时走，不用 Skill 时是单阶段」——这点成立，大雄无 Skill 时也是单阶段直接出 generations，与我们也一致；三阶段不是差距。）

---

## 1. 证据：大雄是 fresh-task，历史不回传

### 1.1 主发送路径用 `agentFreshTaskHistoryMessages()`，直接返回 `[]`

`daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js` 第 5410-5414 行：

```js:5410:5414:plugins/canvas-agent/web/canvas-agent.js
function agentFreshTaskHistoryMessages(){
  // 用户要求每次发送都作为新任务；当前要求已放在 payload.message 中，
  // 阶段1策划也会显式拼进阶段2，因此不再把前序对话消息交给 LLM。
  return [];
}
```

该函数在以下发送路径上被调用，返回值直接作为 `payload.messages`：
- 第 6806 行（阶段1 理解）
- 第 6996 行（阶段2 规划）
- 第 8306 行（无 Skill 直接生图主路径）
- 第 8619 行（重新生成 `regenerateAgentPrompts`）
- 第 6595 行（用户修改意见 `messages: []` 直传）

**补充查证（第二轮）：**
- `regenerateAgentPrompts`（8587-8630）是「重新生成」按钮的完整路径，其 `llmPayload.messages = agentFreshTaskHistoryMessages()`（8619），且 `images: userMsg?.images`（8620）只取那条**原始用户消息**的图，不是全历史图 → regenerate 也走 fresh，不回传历史图。
- 修改意见路径（6593-6596）同样 `messages: []` + `images: attachments`（本轮）。

即：**无论是否用 Skill、无论重新生成还是修改意见，主发送路径的 `messages` 都是 `[]` 或空，历史图从不回传。**

### 1.2 真正发给 LLM 的 payload 结构：本轮图在顶层 `images`

第 6806-6827 行（阶段1）示例：

```js:6813:6827:plugins/canvas-agent/web/canvas-agent.js
const llmPayload = {
  message: messageText,          // 本轮用户文字
  messages: historyMsgs,         // = agentFreshTaskHistoryMessages() = []
  images: imageUrls,             // 本轮附件图（本轮参考图），来自 contextImages
  videos: [],
  model, provider, ...
  system_prompt: ...
};
```

图片**只在本轮顶层 `images` 字段**，历史消息里不带图。模型在第 4 轮能「看见」的图，只有本轮你带的那张。

### 1.3 大雄另有一个 `agentHistoryMessages()`（会回传历史、但把 user 图丢弃只留文字）

第 5395-5409 行：它把 user 消息只转成 `{role:'user', content:m.text || '(images only)'}`，**图片被丢弃**。

**补充查证（第二轮）：** 全文件搜索 `agentHistoryMessages(` 的调用处，**只有第 5395 行这一处定义，没有任何调用**。它是死代码 / 备用函数，从未进入任何发送路径。这进一步坐实：大雄在主路径**刻意且唯一地**选择「不回传历史、且不回传历史图」（`agentFreshTaskHistoryMessages` 才是唯一被调用的）。

此外，第 8264-8265 行有更明确的工程意图声明：
```js:8264:8266:plugins/canvas-agent/web/canvas-agent.js
// 只把本轮用户明确提供的参考图发给 LLM；禁止把上一轮生成图/历史附件静默塞进上下文
const contextImages = attachments.slice();
```
即大雄对「历史图不能静默进上下文」是**有意识的设计约束**，而非碰巧。

---

## 2. 证据：我们是全量历史回传，且历史图内联

`src/components/base/useAgentChat.js`：

### 2.1 发送时把整段历史交给 LLM

第 889-890 行，每轮工具循环里：

```js:889:890:src/components/base/useAgentChat.js
assistant = await roundTrip(
  buildRequestMessages(messagesRef.current, systemRef.current, true, skillsRef.current, getCurrentMemory()),
```

`messagesRef.current` 是**完整历史**（所有轮次），不是 `[]`。

### 2.2 `buildRequestMessages` 把历史 user 消息里的图片以 `image_url` 内联回传

第 273-288 行：

```js:276:288:src/components/base/useAgentChat.js
if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
  const content = m.attachments.map((a) => ({ type: 'image_url', image_url: { url: a.url } }))
  // ...refCatalog / 坐标文本 拼进 content...
  out.push({ role: 'user', content })
  continue
}
```

即：**每一条历史 user 消息，只要带过图，那张图就以 `image_url` 形式重新喂给 LLM。** 第 1、2、3 轮带的三张图，到第 4 轮全部在上下文里可见。

**审计修正（第三版）：** 我之前说"全量回传"是靠直觉，本轮核实 `buildRequestMessages` 确实**没有任何截断**——函数签名（236 行）直接 `for (const m of messages)`（273 行），`messages` 即 `messagesRef.current`；全文搜 `AGENT_HISTORY_MAX` / `.slice(-N)` / `maxHistory` 在 `useAgentChat.js` 中**零命中**（对比大雄有 `AGENT_HISTORY_MAX` 5399 行、`AGENT_MSG_MAX` 4301 行截断）。且内联条件只看 `m.attachments.length > 0`（276 行），**不区分本轮/历史**。所以"全量"比我之前说的更绝对：既无条数截断，也无"仅本轮"过滤。根因①成立且比初判更强。

---

## 3. 为什么这导致「全反推」，而大雄不会

**真实场景（用户纠正后的前提）：** 用户第 4 轮**也带了一张图**，说「反推图一的提示词」。即第 4 轮不是"无图"，而是"本轮图 + 前三轮历史图"四张图同时在上下文里。原文档 §3 假设"第 4 轮没带图"是错的，下面按真实场景分析。

### 3.1 大雄为什么不会全反推

大雄上下文里只有「本轮文字 + 本轮那唯一一张图」。它的 `attachmentCatalog` 只列本轮图（§1.2，`canvas-agent.js:6807-6811`），且历史图根本不进 `payload.images`（`contextImages = attachments.slice()`，8265）。所以：

- 第 4 轮本轮带了一张图 → "图一"唯一指向本轮这张图 → 精准反推。
- 即便大雄的 `refCatalog` 也是"每轮从 1 重编"（`canvas-agent.js:6809` `参考图${index+1}`），但因为历史图不进上下文，"参考图1"永远只指向本轮那唯一一组图，**不会和历史轮撞号**。

**关键结论：大雄"每轮从 1 重编"不是差异，也不本身导致问题。差异在于——大雄的"从 1 重编"只作用于本轮那唯一一组图（历史图不进上下文），而我们的"从 1 重编"作用于每一轮各自的图、且所有轮的真图都堆进同一上下文。**

### 3.2 我们为什么全反推：撞号 + 真图堆积双重放大

我们的 `send` 给**每条** user 消息都写 `refCatalog`，且编号从本轮输入框从 1 重编（`useAgentChat.js:848-858`）。`buildRequestMessages` 把历史 user 消息的原图 `image_url` + 该轮 `refCatalog` 文本一起内联（276-288 行）。于是第 4 轮 LLM 实际看到的上下文是：

```
[历史图A image_url] 参考图1：图A（画布坐标…）   ← 第1轮 refCatalog
[历史图B image_url] 参考图1：图B（画布坐标…）   ← 第2轮 refCatalog
[历史图C image_url] 参考图1：图C（画布坐标…）   ← 第3轮 refCatalog
[第4轮图D image_url] 参考图1：图D（画布坐标…）  ← 第4轮 refCatalog，用户说"反推图1"
```

两个同时发生的放大器：

1. **真图堆积**：A/B/C/D 四张真图全部以 `image_url` 可见地躺在视觉上下文里（来自全量回传，差距①）。
2. **撞号**：四轮的 `refCatalog` 各自都把"自己那张"标成"参考图1"，且历史消息的 `refCatalog` 文本没标注"这是第几轮"。LLM 面对**四个都叫"参考图1"的真图**，没有任何信号区分"图1"指第几轮的哪张。

→ 第 4 轮用户说"反推图1"，模型无法消歧，低风险反推任务下倾向于"把能看见的图都处理一遍" → **四张图全部反推**。

**原文档 §3 把原因模糊写成"图一歧义 / 语义模糊"。精确化后：真实机制是"撞号（refCatalog 每轮重编撞号）+ 真图堆积（全量回传）"双重放大，根因仍是差距①全量回传；"每轮重编"本身不是差距（大雄也一样），但它叠加上"历史真图不隔离"才会撞号。**

### 3.3 与大雄的本质差异一句话

大雄用 `messages:[]` + `images` 仅本轮 + `attachmentCatalog` 仅本轮 三重保证"历史真图不进 LLM 上下文"，于是"从1重编"永远只作用于本轮一组图、绝不撞号；我们全量回传把各轮真图堆进同一上下文，叠加每轮重编的 refCatalog，撞号与堆积同时发生 → 全反推。

---

## 4. 表层机制对比（这些我们都有，不是差距，列清以免误判）

| 机制 | 我们 | 大雄 | 是否差距 |
|---|---|---|---|
| 内联 chip（可见参考图+序号） | `AgentPanel.jsx:542` | `canvas-agent.js:311` | 否 |
| 「禁止默认参考上一轮结果」指令 | `useAgentChat.js:112` | `canvas-agent.js:781` | 否 |
| 每轮从 1 重编「参考图编号目录」 | `useAgentChat.js:848`（注释对齐大雄） | `canvas-agent.js:767` | 否 |
| `attachment_indices` 精确引用 | `useAgentChat.js:112,467` | `canvas-agent.js:768` | 否 |
| 「分别/各自/每张」一对一拆图 | `useAgentChat.js:437`（注释对齐大雄 L2259/L2334） | `canvas-agent.js:776` | 否 |
| 待确认 ghost 防误触 | `AgentPanel.jsx:198` | `canvas-agent.js:280` | 否 |
| **历史消息回传（含历史图）** | **全量回传（含 image_url）** | **`return []` 不回传** | **是，核心差距①** |
| **图 token 编码 + 跨轮目录反查** | **无（搜 `refToken`/`encodeRefToken` 零命中）** | **`agentEncodeRefToken`+`agentCollectKnownRefCatalog`+`agentParseRefTokensFromText`** | **是，核心差距②** |
| **执行层默认参考上一轮结果图（use_last_outputs）** | **不挂前轮：`setCurrentReferenceImages` 覆盖写，执行取 `refPool=getCurrentReferenceImages()`（仅本轮）** | **`agentForceNoStaleLastOutputs` 彻底关闭** | **否——经本轮核实不成立，降级为非差距（见 §4.5.5）** |
| **TextNode 连线反推链路** | 独立入口：`TextNode.jsx:131` 走 `chatCompletions`，仅传 `images:refUrls`（本节点参考图），不带历史/refCatalog | （大雄对应机制见 §9） | **是，另一条独立的"全反推"触发链路，原文档完全漏掉（见 §9）** |

---

## 4.5 第三层差距（第二轮深挖补入）：大雄用「图 token + 执行层反查」承载跨轮图记忆，我们靠「把原图塞进 LLM 上下文」

这是之前两轮都漏掉、但可能是最本质的一条。它解释了**为什么大雄能做到"LLM 上下文里一张历史图都没有、却能跨轮精确用图"**。

### 4.5.1 大雄的图 token 机制

大雄不在 LLM 上下文里堆历史图，而是把图编码成**自包含 token** 存进历史文本：

- `agentEncodeRefToken`（4686 行）：把一张图编成
  `[参考图1:name]{{agent-ref url="..." name="..." node="..." x=".." y=".."}}`
  这个 token **人类可读、机器可还原**，url/node/坐标全带在里面。
- 渲染历史、复制消息时，图以 token 嵌入文本（4647-4667、4828 行），**图本体不进 LLM 上下文，但 token 里带着图的所有元信息**。
- `agentCollectKnownRefCatalog`（4772 行）：遍历**全部**历史 user 消息的 `parts`/`images`（含所有对话），收集成「图 url + refIndex + name + 坐标」的全局目录。
- `agentParseRefTokensFromText`（4698 行）：从任意历史文本（包括 assistant 文本里残留的 `[参考图N:name]`）反查回真实图片，**供执行层连线生图用**——不是给 LLM 看的。

→ 结论：大雄的「跨轮图记忆」是 **token 文本层 + 执行层反查层** 实现的。LLM 看到的永远是「本轮图 + 文字 token 引用」，历史原图**从不进上下文**，但生图时执行层能精确还原用哪张。

### 4.5.2 我们的对应物：零（审计后双重确认）

**审计修正（第三版）：** 我前两版说"图 token 零命中"只搜了 `refToken`/`encodeRefToken` 等，可能被命名差异漏判。本轮改用大雄 token 的**字面特征** `[参考图` / `agent-ref` / `encodeRefToken` / `parseRefTokens` / `collectKnownRef` 直接在 `src/` 搜索——**依然零命中**。即：不是命名差异，是这套机制在我们代码里**完全不存在**。

我们的「跨轮图」做法是：`buildRequestMessages` 第 276-288 行把历史 user 消息里的图直接以 `image_url` 内联进 LLM 上下文。即：
- 大雄：图 → token 文本（上下文轻量）→ 执行层反查原图。
- 我们：图 → 原图二进制 URL 直接进上下文（上下文沉重、且累积）。

这正是「全反推」的放大器：我们的历史图是**真图**堆在上下文，模型「看得见」就会处理；大雄的历史图只是**文本 token**，模型看不见原图，只能按本轮图操作。

### 4.5.3 执行层默认参考上一轮结果：大雄彻底关闭

`agentForceNoStaleLastOutputs`（2958 行）在生产前强制：

```js:10641:10643:plugins/canvas-agent/web/canvas-agent.js
// 跨轮 lastResults 仅在明确“改上一张”时使用，避免无参考图却挂上历史图
gen.use_last_outputs = false; // 跨轮 lastResults 彻底关闭
```

即：大雄不仅不回传历史图给 LLM，连「执行层默认挂上一轮生成图」也彻底关掉，只在同计划内 `depends_on_previous` 时由 plan executor 注入前序结果。第 8265 行 `contextImages = attachments.slice()` 也确认本轮图从不混入历史图。

（注：我们执行层是否关 `use_last_outputs` 本轮已核实——见 §4.5.5：`setCurrentReferenceImages` 覆盖写、`execute_plan` 仅取本轮 `refPool`，确认不挂前轮图，差距③不成立。根因仅在 LLM 上下文侧。）

### 4.5.4 审计反例（不推翻结论，但必须写明）：大雄执行层有 `agentLastUserAttachments()` 回退

第三版审计中发现，大雄在**执行生图**阶段（不是 LLM 上下文）存在跨轮图回退：

```js:8695:8697:plugins/canvas-agent/web/canvas-agent.js
const lastResults = agentLastResults();
const currentAttach = (userMsg?.images || []).filter(i => i?.url);
const attachRefs = currentAttach.length ? currentAttach : agentLastUserAttachments();
```

`agentLastUserAttachments()`（4258 行）向前找**最近一条带图 user 消息**，把它的图作为本轮生图参考图。即：**当用户本轮没带参考图时，执行层会回退用上一轮用户带的图去生图。**

**这为什么不算推翻差距①②：**
- 这个回退发生在**执行层创建生图节点**时（`executeAgentGenerations`），作用是"本轮没图也能接着用上一轮的图生图"。它**不进 LLM 上下文**——LLM 看到的 `messages` 仍是 `agentFreshTaskHistoryMessages()` 返回的 `[]`，本轮 `images` 仍是 `contextImages = attachments.slice()`（仅本轮）。
- 它恰恰印证差距②：大雄的跨轮图记忆是**执行层/节点层**的事（靠 token 目录 + 回退），**不是 LLM 上下文的事**。我们则是把历史图直接堆进 LLM 上下文。两者跨轮用图的能力都有，但**实现层不同**——这正是差距的本质。
- 也印证差距③的"彻底关闭"是**针对 `use_last_outputs`（上一轮生成结果图）**，不是针对"用户历史参考图"。用户历史参考图在执行层通过回退保留；上一轮生成结果图在 `agentForceNoStaleLastOutputs` 被关。两者分开处理，逻辑自洽。

**因此：此反例不削弱、反而细化了差距①②。** 大雄 LLM 上下文零历史图（已实锤），跨轮用图靠执行层 token/回退（已实锤）；我们 LLM 上下文堆历史图（已实锤）。

### 4.5.5 第四版核实（修正差距③）：我们执行层同样不挂前轮图

原文档把"执行层默认参考上一轮结果"列为核心差距③，但这是**待核项未核实就下的结论**。本轮独立读 `useCanvasAgentTools.js` 与 `useAgentChat.js` 的 `send`，事实如下：

- `useCanvasAgentTools.js:58-63`：`setCurrentReferenceImages(urls)` 内部走 `setCurrentRefImages(urls)`（per-conversation 状态，**覆盖写**，不是累积）。
- `useAgentChat.js:843-861`：`send` 时 `userMsg.refCatalog` 只由**本轮输入框**的图编号生成（848-858），`setCurrentReferenceImages` 只装**本轮**图（861）。
- `useCanvasAgentTools.js:751-757`：`execute_plan` 取 `refPool = getCurrentReferenceImages()`（即本轮写入的），按 `attachment_indices` 精确取对应图写入每步 `referenceImages`。

→ **结论：我们执行层完全依赖本轮 `refPool`，不挂前轮图，与"大雄关 lastResults"语义一致。差距③经核实不成立，应从核心差距中移除，降级为"非差距"。** 这也意味着"全反推"问题只发生在 LLM 上下文侧（聊天线，差距①②）或连线聚合侧（TextNode 线，§9），与执行层无关。原文档 §4.5.3 "我们待核、即便关了根因①仍在" 的表述应修正为"我们执行层已确认不挂前轮，根因仅在于 LLM 上下文侧"。

（注：大雄执行层有 `agentLastUserAttachments()` 回退——本轮无图时回退用上一轮用户图生图，且不进 LLM 上下文。我们执行层是否有类似回退本轮未深究，但它同样只影响生图节点、不进 LLM 上下文，不影响"全反推"归因。）

### 4.5.6 第四版新增（原文档完全漏掉）：TextNode 连线反推是另一条独立触发链路

用户"反推图一的提示词"也可能发生在 **TextNode 连线反推**场景（节点注释明写"让 AI 看图反推提示词/理解图片"，是产品主推交互）。这条线**根本不走 `useAgentChat` 的聊天体系**，因此前面所有差距①②对它都不适用——它"全反推"的根因完全不同。详见第 9 节。

---

## 5. 为什么我们可能「抄漏了」这一条

大雄的 `agentFreshTaskHistoryMessages() => []` 是一个**极短、极不起眼**的函数，注释也只说「每次发送都作为新任务」。抄写时很容易被忽略，或误以为「历史肯定要回传才有记忆」，于是按常规 LLM 对话习惯写成了全量历史回传。

但大雄的「记忆」不是靠历史消息回传实现的，而是靠：
- 本轮 `message` 携带完整当前要求；
- Skill / 阶段1 策划显式拼进后续阶段；
- `agentActiveConversationMemory` + `agentMemoryPromptBlock`（5421 行）把本对话摘要 / 统一风格 / 已确认信息 / 备注作为 system 注入，**不靠原始历史消息堆上下文**。

我们这边其实也有对应的 memory 注入（`useAgentChat.js` 第 257-272 行 `lastPlan` / `global_contract` 回灌，且注释直接写「对齐大雄」）。这说明大雄「靠 memory 而非靠历史回传」的**上层思路我们理解到了，也抄了**。

**但两层对齐中我们只抄了一层：**
1. ✅ 抄了「memory 走 system 注入」——我们有 `lastPlan` / `global_contract` 注入，对应大雄 `agentMemoryPromptBlock`。
2. ❌ **没抄「发送时 history messages 不回传」**——大雄主路径 `messages` 恒为 `[]`（且 8264 行明令禁止静默塞历史图），我们却把 `messagesRef.current`（整段历史，含每条历史 user 消息的图）全量回传，并用 `image_url` 内联历史图。

结果：我们的 memory 注入和大雄一致，但**发送层多做了一步「全量历史含图回传」**，这一步正是大雄刻意避免的。正是这多出来的一步把历史图带进了上下文，导致跨轮图累积、触发「全反推」。

这也很符合「抄漏」的典型形态：抄了显眼的、成体系的那层（memory 注入、编号目录、attachment_indices），却漏掉了那行藏在发送函数前、只有 `return []` 的短函数——因为它太短，且违反「对话要带历史」的直觉。

---

## 6. 修复方向（不实锤，待决定）

要让行为与大雄一致，核心是：**发送时不要把历史 user 消息里的图片内联回传**，改为 fresh-task 模式（只发本轮 message + 本轮图 + memory/system）。同时针对"撞号"问题，可考虑把 refCatalog 改为全局连续编号。具体可选：

1. **最小改动（对齐大雄 messages:[] + images 仅本轮）**：在 `buildRequestMessages` 处理**非本轮**历史 user 消息时（276 行分支），不再把 `m.attachments` 内联成 `image_url`，只保留 `m.content` 纯文字（剥离 `refCatalog`/坐标文本）。这样历史真图不进 LLM 视觉上下文（对齐大雄 8265），本轮图仍正常内联。跨轮记忆靠已有 `lastPlan`/`global_contract` 注入承载。→ **直接消除"真图堆积"放大器。**
2. **彻底对齐**：直接让历史 messages 回传为 `[]`（纯 fresh-task），记忆改由 memory/system 注入承载（我们已有 global_contract / lastPlan 注入，可扩展）。
3. **折中（保留多轮文字记忆、去掉历史图）**：历史 user 消息只回传文字不回传图，本轮图走单独通道——兼顾「能聊上下文」和「不堆积历史图」。
4. **（可选）消除撞号**：把 `refCatalog` 从"每轮从 1 重编"改为"全局连续编号"（对齐大雄 `agentCollectKnownRefCatalog` 收集全部历史生成全局目录）——第 1 轮图=参考图1、第 2 轮=参考图2…本轮不再从 1 重编。这样即便未来某路径仍回传部分历史图，"图1"也唯一指向第 1 张，不会撞号。但注意：仅靠改编号**不解决真图堆积**（历史图仍进上下文），需与方案 1 组合才彻底。

> 注：若选 1/3，需确认「图生图时必须本轮带图」指令仍生效（我们已有，见第 112 行），否则模型可能翻 memory 里残留的图引用。
> 另：若用户走的是 **TextNode 连线反推**（§9），修复方向完全不同——那是 `connected.images` 连线聚合把多张上游图全传进去、且无"指定第几张"入口的问题，与聊天历史无关，不应在 `buildRequestMessages` 上修。

## 6.1 修复前必须先确认：用户从哪个入口触发反推

「反推图一却全反推」至少两条独立链路，根因与修法都不同，**定位前必须确认触发入口**：
- **聊天助手线**（本档主分析）：`useAgentChat` + `buildRequestMessages`，根因=差距①②（全量含图回传 + 无 token 化），按 §6 方案 1/2/3 修。
- **TextNode 连线反推线**（§9）：`TextNode.jsx:131` `chatCompletions`，根因=连线聚合多图无指定入口，按 §9 修。
原文档只审计了聊天线，把其现象当成全局唯一根因，是本次第四版最重要的修正（详见 §9.2）。

---

## 7. 一句话总结

「全反推」不是因为我们抄漏了编号/引用机制——那些都有。真正的差距是**大雄每轮 fresh-task（历史含图不回传），我们每轮全量历史含图回传**。在「第 4 轮也带图」的真实场景下，直接触发机制是**撞号 + 真图堆积**双重放大：各轮 refCatalog 都把"自己那张"编号为"参考图1"、且历史真图全堆进同一上下文，用户说"图一"时模型无法消歧遂全反推。大雄因看不到历史图、且"从1重编"只作用于本轮一组图，天然不撞号、不堆积。最初「两边机制一样、只是编号歧义」的判断不成立。**另需警惕：_TextNode 连线反推是另一条独立链路（§9），根因完全不同，原文档只审计聊天线、把其现象当成全局唯一根因是错误的。_**

---

## 8. 审计记录（第三版：自检我前两版的自称"实锤"）

用户要求"再仔细检查、审计清楚"。以下逐条审计前版结论，区分**已坐实 / 已纠正 / 已补强**：

### 8.1 已坐实（证据硬）
- **差距①（LLM 上下文零历史图）**：大雄 5 条发送路径（6806/6996/8306/8619/6595）全部 `agentFreshTaskHistoryMessages() => []` 或 `messages: []`，逐行读确认（非靠搜索）。我们 `buildRequestMessages` 273 行 `for (const m of messages)` **无截断**（全文搜 `AGENT_HISTORY_MAX`/`.slice(-N)` 零命中），276 行内联只看 `m.attachments.length>0` **不区分本轮/历史**。✅ 比初判更强。
- **差距②（图 token 机制缺失）**：用大雄 token 字面特征 `[参考图`/`agent-ref`/`encodeRefToken`/`parseRefTokens`/`collectKnownRef` 搜 `src/` **零命中**，排除命名差异漏判。✅
- **差距③「大雄关 lastResults」**：`agentForceNoStaleLastOutputs` 2958 + 10642 `// 跨轮 lastResults 彻底关闭`。✅

### 8.2 已纠正（前版证据方法不可靠，结论仍成立但表述要改）
- 前版称"搜 `agentHistoryMessages` 全文件零调用=死代码"——**搜索方法本身可靠**（该函数确实零调用），但前版曾用"搜 `agentRunMainFlow(` 零命中"来暗示主路径简单，而实际大雄单文件脚本函数间直接调用、搜不到圆括号调用是正常的。主路径判断是靠**逐行读 5 处**，不是靠搜索，结论正确，但 doc 中"靠搜索证明"的表述已删除，改为"逐行读确认"。

### 8.3 已补强（审计中发现的执行层反例，不推翻、反而细化）
- **`agentLastUserAttachments()` 回退（8695-8697）**：大雄执行层在用户本轮无图时，回退用上一轮用户带的图生图。这说明大雄**跨轮用图在执行层是有的**，但**不进 LLM 上下文**——印证差距②"跨轮图靠执行层/token，不靠 LLM 上下文堆图"。已写入 §4.5.4。

### 8.4 仍待核（第三版当时未深入，第四版已核清）
- 第三版时我们执行层（`useCanvasAgentTools`）是否关 `use_last_outputs` / 有类似 `agentLastUserAttachments` 回退——标注"待核"。**第四版已核实（见 §4.5.5）：我们执行层 `setCurrentReferenceImages` 覆盖写、`execute_plan` 仅取本轮 `refPool`，确认不挂前轮图，即差距③不成立，已降级为非差距。** 待核项已闭合。

### 8.5 审计结论
前两版"实锤"经反向审计后，差距①②站得住，且差距①比我初判更绝对（无截断、无本轮过滤），差距②经字面特征复核排除了命名漏判。唯一补充是大雄执行层有跨轮图回退（不进 LLM 上下文），它让"大雄完全无跨轮图"的表述需精确到"LLM 上下文无跨轮图、执行层有"。**第四版进一步核实：差距③（执行层挂前轮）经代码确认不成立，原"三条差距"修正为"两条核心差距（①②）+ 一条非差距（③）"。**

---

## 9. 第四版新增：TextNode 连线反推是另一条独立的「全反推」触发链路

### 9.1 真实代码（独立核实）

`src/components/TextNode.jsx` 反推提示词链路（约 131-151 行）：

```jsx
// 参考图：把连线上游/上传的图传给 AI（让 AI 看图反推提示词/理解图片）
const refUrls = refImages.map((img) => img.url)
const r = await chatCompletions({ ..., images: refUrls })
```

- 它走 `chatCompletions`，**只传 `images: refUrls`（本节点参考图）+ prompt**，**完全不带历史消息、不带 refCatalog、不带 attachment_indices**。
- `refImages`（约 201 行）= `connected.images`（连线上游图）+ 上传图。

### 9.2 为什么这是独立根因（原文档完全漏掉）

用户"反推图一"如果发生在 TextNode 连线反推场景（节点注释明写"让 AI 看图反推提示词"，是产品主推交互），**根因根本不是"全量历史回传"**——因为这条线压根不发历史消息、不发历史图。它"反推全部"只可能是因为 `refImages` 里连了多张上游图（`connected.images` 聚合了多个上游节点的输出），且**没有"指定第几张"的入口**，模型把连进来的所有图全反推了。

→ 这是**连线聚合 / 交互语义**问题（`connected.images` 收集了多张上游图却无"指定第几张"的入口），与聊天历史无关。**原文档只审计聊天助手一条线，把其现象当成全局唯一根因，是错误且会误导修复的。** 若用户实际是从 TextNode 连线触发反推，去改 `buildRequestMessages`（聊天线）完全无效。

### 9.3 与聊天线的对比

| 维度 | 聊天助手线（§2-§8） | TextNode 连线反推线（本节） |
|---|---|---|
| 入口 | 聊天输入框说"反推图一" | 节点连线 + 文本节点"反推提示词" |
| 发送函数 | `useAgentChat.buildRequestMessages` | `TextNode.jsx` → `chatCompletions` |
| 是否发历史 | 是（全量回传，差距①） | 否（只发本节点 `refImages`） |
| "全反推"根因 | 差距①②（真图堆积 + 撞号） | `connected.images` 聚合多张上游图、无指定入口 |
| 修复位置 | `buildRequestMessages` 历史分支 | TextNode 连线语义 / `refImages` 收集逻辑 |

**结论：定位"反推图一却全反推"必须先确认用户从哪个入口触发。两条链路根因不同、修法不同，不能混为一谈。**

---

## 10. 审计记录（第四版：用户纠正前提 + 独立核实执行层与 TextNode）

用户指出两件事：(1) 第 4 轮**也带了一张图**（原文档 §3 假设"没带图"是错的）；(2) 不要轻率下断言，要完整看双方代码。本版据此做了以下更正与补强：

### 10.1 前提更正
- 原 §3 默认"第 4 轮没带图"，导致归因偏到"无图却躺历史真图"。**真实场景是第 4 轮带图**，"全反推"的真正机制是"撞号（refCatalog 每轮重编撞号）+ 真图堆积（全量回传）"双重放大，而非"无图"。已重写 §3（§3.2）。

### 10.2 差距③经核实不成立（降级为非差距）
- 独立读 `useCanvasAgentTools.js:58-63` 与 `useAgentChat.js:843-861`，确认：我们 `setCurrentReferenceImages` 覆盖写、`execute_plan` 仅取本轮 `refPool = getCurrentReferenceImages()`，执行层不挂前轮图。与原文档把差距③列为"核心差距"矛盾 → **已降级为非差距**（§0、§4 对比表、§4.5.5）。

### 10.3 新增 TextNode 独立链路（原文档完全漏掉）
- 独立读 `TextNode.jsx:131` 及 `connected.images` 来源，确认：连线反推走 `chatCompletions` 仅传本节点 `refImages`，根因是连线聚合多图无指定入口，与聊天历史无关。已补 §9，并明确"定位前须确认触发入口"（§6.1）。

### 10.4 对"每轮从 1 重编"的澄清
- 原文档与本人前几轮都曾误把"refCatalog 每轮从 1 重编"当成差距或根因。经读大雄 `canvas-agent.js:6809` 确认**大雄也是每轮从 1 重编**。所以"从 1 重编"不是差距；真正让它在大雄不撞号的原因是"历史图不进上下文，从1重编只作用于本轮一组图"。已在 §3.1 澄清。

### 10.5 第四版最终结论
「全反推」的真实差异只剩**两条核心架构差距**：① 我们全量历史含图回传（大雄 `messages:[]`+`images`仅本轮）、② 我们无图 token 化跨轮记忆（大雄有 token + 执行层反查）。执行层差距③经核实不成立。触发入口有两条独立链路（聊天线 / TextNode 连线线），须先定位再修。原文档把聊天线现象当成全局唯一根因、并夸大"三层架构差距"，本版已校正。
