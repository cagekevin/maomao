# TASK-039 — 参考项目 AI 会话稳定性剖析（四）：消息附件与 LLM 请求构造

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「机制剖析」，禁止修改任何代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个机制点必须贴「文件 + 行号 + 关键代码片段」，不能只写"有/没有"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件或我们的 `src/` 代码。

---

> 以下剖析基于本次实际打开核实的参考项目文件：
> - `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
> - `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-adapter.js`
> 所有行号均来自本次读取核实。

---

## 一、项目背景

maomao 画布的 AI 会话**不稳定**：上下文容易串、参考图定位不准、AI 不知道参考图来自画布哪个节点。

本任务剖析参考项目（大雄 canvas-agent）**「消息附件结构 + LLM 请求构造」**——参考图怎么组装成 part、坐标 x/y 怎么带、消息怎么发给 LLM，以及任务提交（llm-tasks）的载荷格式。

**参考材料**（只读这些）：
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-adapter.js`

## 二、硬约束

- **禁止参考** maomao 的 `src/` 实现，只剖析参考项目。
- 输出是**机制剖析报告**，不是代码。
- 不得臆测，每条必须有真实代码行证据。

## 三、探索起点（本次实际核实）

- **canvas-agent.js**
  - grep：`agentGetComposerParts`（L244）、`agentBuildAttachmentsFromNodes`（L9852，附件带 nodeId+x/y）、`agentCollectComposerAttachments`（L317）、`agentCreateAndWaitLlmTask`（L870）、`agentRefToken`（L4695，参考图 token 含 x/y）
  - 语义：消息 content 用 **parts 数组**（`{type:'text'}` / `{type:'image', url, name, nodeId, x, y, refIndex}`），参考图带画布坐标；参考图以 `[参考图N:name]{{agent-ref url=... x=... y=...}}` token 内联在文字里。
- **canvas-adapter.js**
  - grep：`agentCanvasImages`（canvas-agent.js L8904，画布全部图片带 nodeId+x/y）、`selection`、`selectedAgentImageNodes`（canvas-agent.js L9912）
  - 语义：选中画布带图节点 → 转成参考图附件（带 nodeId + x + y）。

## 四、覆盖清单（逐个回答，全部带证据）

1. **LLM 消息的 content 结构是什么**？`agentGetComposerParts` 生成的 parts 数组，每种 part 的字段（text / image + url/name/nodeId/x/y/refIndex）。
2. **参考图坐标怎么带**？`agentBuildAttachmentsFromNodes` 如何给每张参考图附 `nodeId + x + y`；参考图 token 格式（L4695）。
3. **选中画布节点怎么变成参考图**？`selectedAgentImageNodes` + `agentBuildAttachmentsFromNodes` 的链路。
4. **LLM 请求怎么提交**？`agentCreateAndWaitLlmTask`（L870）发到 `/api/plugins/canvas-agent/llm-tasks`，payload 结构（messages/parts/tools/system_prompt 等）。
5. **附件编号/引用**：`refIndex` 怎么编号？LLM 怎么用 `attachment_indices` 精确引用第几张参考图（prompt 里如何说明）。
6. **与"上下文稳定"的关系**：parts 结构化 + 参考图编号 + 坐标，如何让 LLM 上下文清晰、不串、能精确定位参考图？

## 五、输出规范

按覆盖清单**逐条**输出。每条格式：
```
### 覆盖点 N：<标题>
**机制**：<简述>
**代码证据**：`<文件> L<行>` + 关键代码片段（3-10 行）
**对"稳定性"的意义**：<这句机制如何让上下文清晰不串>
```

最后单独一节「**总结：消息附件与请求构造如何保障会话稳定**」，3-5 条讲清楚核心设计。

## 六、验收标准（可自测）

1. 覆盖清单 6 个点**全部有**输出，每点都有真实 `文件 L行号` + 代码片段。
2. 至少回答：parts 数组的完整结构、参考图 x/y 的携带方式、`agentCreateAndWaitLlmTask` 的载荷格式、`refIndex` 编号与 `attachment_indices` 引用。
3. 行号是本次实际打开文件核实的，不是凭空写。
4. 全文只写本文件，无修改代码、无脚本。

---

# 剖析报告：消息附件与 LLM 请求构造

## 覆盖点 1：LLM 消息的 content 结构（parts 数组）

**机制**：输入框内容被统一规整成一个 `parts` 数组，顺序保持「文字 + 图片字符」的原混排结构。每个 part 只有两种类型：`{type:'text', text}` 或 `{type:'image', ...}`。图片 part 携带完整定位字段（`url/name/nodeId/x/y/refIndex`），供发送气泡原样回显，也直接作为发给 LLM 的附件来源。

**代码证据**：`canvas-agent.js L244`（`agentGetComposerParts`）
```js
244:function agentGetComposerParts(){
...
250:        const parts = [];
251:        if(text) parts.push({type:'text', text});
252:        atts.forEach((att, i) => {
253:            if(att?.url) parts.push({type:'image', url:att.url, name:att.name||`Image${i+1}`, nodeId:att.nodeId||'', x:Number(att.x)||0, y:Number(att.y)||0, refIndex:i+1});
254:        });
255:        return parts;
```
当输入框是富文本 composer 元素时（L257 起的 `walk` 遍历 DOM），文字节点合并进上一个 `text` part（L267-269），内联图片 chip 被解析成带 `refIndex` 的 image part（L284-290）：
```js
284:                name: el.dataset.name || 'image',
285:                nodeId: el.dataset.nodeId || '',
286:                x: Number(el.dataset.x) || 0,
287:                y: Number(el.dataset.y) || 0,
288:                refIndex: Number(el.dataset.refIndex) || (parts.filter(p => p.type==='image').length + 1)
```

**对"稳定性"的意义**：文字与图片在 content 里是显式分离、可序列化、顺序固定的结构，而不是把图片塞进一段不可解析的自由文本。发送气泡、回显、LLM 载荷三方共用同一份 `parts`，从根本上避免"文字和图混在一起导致 LLM 数错图/错位"的串扰。

---

## 覆盖点 2：参考图坐标怎么带（nodeId + x + y）

**机制**：每张参考图都带画布坐标系（`nodeId` + `x` + `y`）。来源有两处：① 选中画布节点时由 `agentBuildAttachmentsFromNodes` 注入；② 内联 chip 的 `data-node-id/data-x/data-y`；③ 参考图 token `{{agent-ref ... x=.. y=..}}` 把坐标写进文字，便于粘贴/还原。

**代码证据 A**：`canvas-agent.js L9852`（`agentBuildAttachmentsFromNodes`）
```js
9852:function agentBuildAttachmentsFromNodes(imageNodes){
9853:    const atts = [];
9854:    for(const node of (imageNodes || [])){
9855:        const source = agentNodeImages(node)[0] || (node.url ? {url:node.url, name:node.name || node.title || 'image'} : null);
...
9858:        atts.push({
9859:            url: item.url,
9860:            name: item.name || node.title || node.name || 'image',
9861:            nodeId: node.id,
9862:            x: Number(node.x) || 0,
9863:            y: Number(node.y) || 0
9864:        });
9865:    }
9866:    return atts;
9867:}
```

**代码证据 B**：`canvas-agent.js L4686`（`agentEncodeRefToken` 生成内联 token，含 x/y）
```js
4686:function agentEncodeRefToken(att={}){
4687:    const url = String(att.url || '').trim();
4688:    if(!url) return '';
4689:    const name = String(att.name || att.label || 'image').trim() || 'image';
4690:    const nodeId = String(att.nodeId || '');
4691:    const x = Number(att.x) || 0;
4692:    const y = Number(att.y) || 0;
4693:    const idx = Number(att.refIndex) || 0;
4694:    // 人类可读 + 机器可还原；粘贴时优先解析 token
4695:    const enc = (s) => encodeURIComponent(String(s ?? ''));
4696:    return `[参考图${idx || 1}:${name}]{{agent-ref url="${enc(url)}" name="${enc(name)}" node="${enc(nodeId)}" x="${x}" y="${y}"}}`;
4697:}
```
对应解析器 `agentParseRefTokensFromText`（L4698）用正则把 `x=".." y=".."` 还原回 image part（L4718-4719）。

**对"稳定性"的意义**：`nodeId` 让 AI 知道参考图来自画布哪个节点，`x/y` 给出画布物理坐标。坐标随 token 内联进文字，粘贴/历史消息也能无损还原——AI 不只能"看到图"，还能定位图在画布上的位置，避免"参考图来自哪、和谁相邻"这类上下文丢失。

---

## 覆盖点 3：选中画布节点怎么变成参考图

**机制**：链路为 `selectedAgentImageNodes()`（从画布选区取图片节点）→ `agentForceGhostFromNodes()`（灰态预选）→ `agentBuildAttachmentsFromNodes()`（注入 nodeId+x/y）→ 落入 `agentState.attachments` / composer chip。点击画布节点时由 `agentSelectionGhostClickHandler` 触发。

**代码证据 A**：`canvas-agent.js L9912`（`selectedAgentImageNodes` 取选区图片节点）
```js
9912:function selectedAgentImageNodes(){
9913:    const ids = (typeof selectedNodeIds === 'function')
9914:        ? selectedNodeIds()
9915:        : (agentHost?.getSelection?.()?.nodeIds || []);
9916:    const list = (typeof nodes !== 'undefined' && Array.isArray(nodes)) ? nodes : [];
9917:    return (ids || []).map(id => list.find(node => node?.id === id)).filter(node => {
9918:        if(!node) return false;
9919:        if(typeof isSmartImageNode === 'function'){
9920:            return isSmartImageNode(node) && agentNodeImages(node).some(image => image?.url);
9921:        }
9922:        if(agentNodeImages(node).some(image => image?.url)) return true;
9923:        if(node.type === 'image' && node.url) return true;
9924:        return false;
9925:    });
9926:}
```

**代码证据 B**：`canvas-agent.js L9869`（`agentForceGhostFromNodes` 调用构造器并写入灰态）
```js
9869:function agentForceGhostFromNodes(imageNodes, {reason='click'}={}){
9870:    const list = Array.isArray(imageNodes) ? imageNodes : [];
9871:    if(!list.length) return false;
9872:    if(!agentOpen) return false;
9874:    const atts = agentBuildAttachmentsFromNodes(list);
9875:    if(!atts.length) return false;
...
9881:    setAgentGhostAttachments(atts);
9882:    agentLastSelectionSig = sig;
9883:    return true;
9884:}
```

**对"稳定性"的意义**：选区的"哪些节点被选"由单一函数 `selectedAgentImageNodes` 归一化，过滤掉非图片节点，再由统一的构造器注入坐标。这样"用户选了哪几张图"在任意入口（点击/多选/按钮）都收敛到同一份 `attachments` 结构，不会出现"选区变了但附件没更新"的漂移。

---

## 覆盖点 4：LLM 请求怎么提交（agentCreateAndWaitLlmTask 载荷）

**机制**：`agentCreateAndWaitLlmTask(payload)` 把 payload 原样 `JSON.stringify` 后 POST 到 `/api/plugins/canvas-agent/llm-tasks`（流式为 `?stream=true`），拿到 `task_id` 后轮询结果。调用方负责构造 payload：典型字段为 `message / messages / images / videos / model / provider / ms_model / system_prompt`。

**代码证据 A**：`canvas-agent.js L870`（`agentCreateAndWaitLlmTask` 提交）
```js
870:async function agentCreateAndWaitLlmTask(payload, {stream=true}={}){
871:    const url = stream ? '/api/plugins/canvas-agent/llm-tasks?stream=true' : '/api/plugins/canvas-agent/llm-tasks';
872:    const taskRes = await fetch(url, {
873:        method:'POST',
874:        headers:{'Content-Type':'application/json'},
875:        body:JSON.stringify(payload || {})
876:    }).then(async r => {
877:        if(!r.ok) throw new Error(await responseErrorMessage(r, tr('smart.promptLlmFailed')));
878:        return r.json();
879:    });
880:    const llmTaskId = taskRes.task_id;
```

**代码证据 B**：`canvas-agent.js L6813`（阶段1 实际组装的 payload）
```js
6813:        const llmPayload = {
6814:            message: messageText,
6815:            messages: historyMsgs,
6816:            images: imageUrls,
6817:            videos: [],
6818:            model,
6819:            provider,
6820:            ms_model: provider === 'modelscope' ? model : '',
6821:            system_prompt: agentSystemPrompt(bypassThinking, _finalCount.count, 'understand', {
6822:                conversationId: ownerConversationId,
6823:                skills: userMsg?.skills || [],
6824:                freshTask: true,
6825:                attachmentCatalog
6826:            })
6827:        };
6828:        const result = await agentCreateAndWaitLlmTask(llmPayload, {stream:true});
```
其中 `images = attachments.slice(0, AGENT_LLM_IMAGE_MAX).map(i => i.url)`（L6783 / L6596），`system_prompt` 由 `agentSystemPrompt` 动态拼装（见 L5247），会注入 Skill 原文、参考图编号目录 `attachmentCatalog` 和阶段指令。另一处改写任务的提交（L6593）同样使用 `message/messages/images/model/provider/system_prompt` 字段。

**对"稳定性"的意义**：请求走"先建任务、再轮询"的服务端任务模式，且 payload 是结构化 JSON（而非拼接 prompt 字符串）。`system_prompt` 与 `message`/`images` 分离，历史 `messages` 与本轮 `message` 分离——LLM 看到的"系统规则 / 历史 / 本轮"边界清晰，不会因字符串拼接错位而把历史混进指令。

---

## 覆盖点 5：附件编号 / 引用（refIndex 与 attachment_indices）

**机制**：参考图按"输入框从左到右"固定编号为 参考图1、参考图2…。`refIndex` 在 `parts`/chip 上以 1-based 存储（L253 / L288 / L344）。LLM 在 `generations` 里用 `attachment_indices`（**0-based**）精确指定该步使用第几张参考图；执行层严格按索引连线，不在 prompt 文字里猜。

**代码证据 A**：`refIndex` 编号 — `canvas-agent.js L333`（`agentRenumberInlineChips` 重排展示序号与 `data-ref-index`）
```js
333:function agentRenumberInlineChips(){
334:    if(!agentInput || !agentIsComposerEl()) return;
335:    [...agentInput.querySelectorAll('.agent-inline-chip[data-agent-chip="ref"]')].forEach((chip, i) => {
336:        const idx = i + 1;
...
342:        chip.title = `参考图${idx}: ${name}`;
343:        chip.dataset.refIndex = String(idx);
344:    });
345:}
```

**代码证据 B**：`attachment_indices` 契约 — `canvas-agent.js L969`（执行层归一化，0-based）
```js
969:            // attachment_indices: 指定该 prompt 只使用哪些附件作为参考图（0-based 索引数组）
970:            // LLM 可用此字段实现"每条 prompt 只带特定参考图"的精细控制
971:            if(Array.isArray(p.attachment_indices)){
972:                normalized.attachment_indices = p.attachment_indices
973:                    .filter(i => Number.isFinite(Number(i)) && Number(i) >= 0)
974:                    .map(i => Math.floor(Number(i)));
975:            }
```

**代码证据 C**：编号规则在 system prompt 中明确告知 LLM — `canvas-agent.js L767` / `L768`
```js
767:- 参考图编号由你在规划时完成：按输入框从左到右固定为 参考图1、参考图2、参考图3...（与用户放入顺序一致，不可重排）。
768:- 你必须根据用户原话给每张参考图标注角色（产品图/风格图/实拍图/其他）...同时在每步 generations 里用 attachment_indices 精确指向要用的编号（0-based：参考图1→0，参考图2→1）。
```

**对"稳定性"的意义**：编号固定 + 0-based 索引双向对齐，LLM 无需在文字里写"第一张图/上面的图"这种模糊指代，而是用 `[0,1]` 这类确定性索引。执行层只认索引、不猜语义，彻底消除"多张参考图时被张冠李戴"的串图问题。

---

## 覆盖点 6：与"上下文稳定"的关系

**机制**：整套设计把"参考图"从"一段不可解析的自由文本里的链接"升级为"带编号 + 坐标 + 角色 + 索引"的结构化对象，并在 system prompt、parts、generations 三处形成一致的编号体系。

**代码证据**：`canvas-agent.js L6807`（把编号目录注入 system_prompt，让 LLM 与用户/执行层对齐）
```js
6807:        const attachmentCatalog = (attachments || []).filter(item => item?.url).length
6808:            ? ['【本轮参考图顺序（仅作为编号数据）】']
6809:                .concat((attachments || []).filter(item => item?.url).map((item, index) => `参考图${index + 1}：${item.name || item.label || `Image${index + 1}`}`))
6810:                .concat(['编号固定按输入框从左到右排列。'])
6811:                .join(AGENT_NL)
6812:            : '';
```
配合 `agentSystemPrompt` 把该目录拼进 `system_prompt`（L5259-5260），以及阶段指令要求"每张参考图标注角色 + 用 attachment_indices 精确指向"（L768-772）。

**对"稳定性"的意义**：
- **不串**：parts 结构化 + 编号目录，使多轮对话里"哪张图是第几号"始终可解析、可还原；
- **能定位**：nodeId + x/y 让 AI 知道参考图在画布的位置与来源节点，而非孤立图片；
- **可复现**：token 内联坐标，历史消息/粘贴无损还原，不会因重建会话而丢失坐标；
- **确定性执行**：attachment_indices 把"用哪张图"从自然语言猜义变成索引硬绑定，执行层零歧义。

---

## 总结：消息附件与请求构造如何保障会话稳定

1. **结构化 parts 是单一事实源**：文字与图片在 `parts` 数组里显式分离、顺序固定，发送气泡、回显、LLM 载荷三方共用，杜绝混排文本导致的图序错位（L244、L253）。
2. **参考图携带画布坐标**：`nodeId + x + y` 通过构造器（L9858）与内联 token（L4696）双通道写入，AI 能定位参考图来源与位置，而非只看孤立图。
3. **编号体系三方对齐**：输入框从左到右固定 `refIndex`（1-based，L253/L343），system prompt 注入 `attachmentCatalog`（L6807/L5259），LLM 据此标注角色并用 `attachment_indices`（0-based）精确引用（L768/L971），人、模型、执行层编号一致。
4. **请求载荷结构化分离**：`agentCreateAndWaitLlmTask` 以 `message/messages/images/system_prompt` 分字段 JSON 提交（L6813/L870），系统规则、历史、本轮边界清晰，避免字符串拼接错位。
5. **确定性执行契约**：执行层只认 `attachment_indices` 索引连线、不猜 prompt 语义（L969），多张参考图场景下天然防串图、防张冠李戴。
