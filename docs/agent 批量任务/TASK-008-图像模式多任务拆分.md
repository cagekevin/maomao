# TASK-008 — 图像模式多任务拆分（每张参考图一对一 task，对齐大雄）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自本次实际打开文件核实。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
深入核验「图像模式（直连生图，不经过 LLM）是否支持对每张参考图一对一拆分任务」。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）

### 大雄侧（canvas-agent.js）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- 图像模式入口 `agentSendDirectImageMessage` @ `canvas-agent.js L8132`
- 一对一改图判断 `agentLooksLikePerReferenceEdit` @ `canvas-agent.js L2259`
- 拆步执行 `agentExpandPerReferenceGenerations` @ `canvas-agent.js L2334`
- 图序/拆分解析 `parseImageRefTasks` @ `canvas-agent.js L2091`
- 兜底挂索引 `agentEnsureGenerationAttachmentIndices` @ `canvas-agent.js L2418`

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`：`sendImageMode` @ `useAgentChat.js L735`
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`：`executePlan` @ `canvasPlanExecutor.js L65`
- 工具层 `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`：`execute_plan` 工具 @ `useCanvasAgentTools.js L601`，内含 `attachment_indices` 解析 @ `useCanvasAgentTools.js L642`

---

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）

### 核验点 1：大雄图像模式怎么对每张参考图一对一拆 task

**大雄做法（代码证据）**
图像模式入口 `agentSendDirectImageMessage` 初始只建**一个** generation，并把全部参考图挂到它的 `attachment_indices`：
```text
canvas-agent.js L8146-8155
    const refIndexes = attachments.map((_, index) => index);
    const assistantMsg = { ... generations:[{
        id:'direct_image_1', title:'直接生图', role:'image', prompt,
        count,
        use_attachments:refIndexes.length > 0, attachment_indices:refIndexes,
        depends_on_previous:false, ...
    }], ... };
```
但真正的一对一拆分发生在 `runAgentGenerations` 内部（两个阶段都兜底调用）：
- 预处理：`agentApplyComplexRequestGuards` → `agentExpandPerReferenceGenerations` @ `canvas-agent.js L2423`、`L2515-2525`
- 执行前兜底：`agentEnsurePlanStepsFromUserIntent` @ `canvas-agent.js L2998`

判断"是否一对一改图"的核心是 `agentLooksLikePerReferenceEdit` @ `canvas-agent.js L2259`：
```text
canvas-agent.js L2263-2271
    if(/(分别|各自|逐一|逐个|每张|各出|各改|各变成|分别改成|分别变成|分别做成)/.test(t)) return true;
    if(/(这两|这两张|这两个|这几张|这几个|全部|两只|两张|两个|几只|几张).{0,16}(分别|都|各自|改成|变成|换成)/.test(t)) return true;
    if(/(都改成|都变成|都换成|全部改成|全部变成)/.test(t)) return true;
    const targets = t.match(/变成[^，,。；;\n]{1,12}/g) || [];
    if(targets.length >= 2) return true;
```
一旦命中，`agentExpandPerReferenceGenerations` `canvas-agent.js L2334` 把单步扩成 N 步，每步 `attachment_indices:[i]` 只含一张图（情况 A 多目标 @ `L2360-2376`，情况 B 同目标分布 @ `L2397-2412`）：
```text
canvas-agent.js L2369 + L2406
    attachment_indices: [i],     // 每张参考图一个 generation，只含自己那一张
    depends_on_previous: false, dependency_mode: 'none',
```

**结论**：大雄图像模式直连生图也**会**做一对一拆分——靠"入口先挂全部图 → 跑图前检测分别改图语义 → 强制拆成 N 个单图 generation"。它不靠 LLM，而是纯前端文本规则。

---

### 核验点 2：我们 `sendImageMode` 现在怎么处理多张参考图

**我们现状（代码证据）**
`sendImageMode` @ `useAgentChat.js L735` 把**整批**参考图 map 成一个数组后，只构造**一个** generation，整批塞进 `referenceImages` 传给 `execute_plan`：
```text
useAgentChat.js L755-769
      const referenceImages = (userMsg.attachments || []).map((a) => a.url).filter(Boolean)
      const gens = [{
        id: `direct_image_${Date.now()}`,
        title: '直接生图',
        prompt,
        ratio: panel.ratio || 'Auto',
        resolution: panel.resolution || '1K',
        depends_on_previous: false,
        dependency_mode: 'none',
      }]
      ...
      const res = await callTool('execute_plan', { generations: gens, auto_run: true, model: panel.model, referenceImages })
```
- 它**完全没做**"分别/各自/图1变白图2变黑"这类一对一改图的语义判断。
- 它**完全没有**把多张参考图拆成 N 个 generation 的逻辑。
- `gens` 永远只有 1 个元素，多张参考图被作为一个节点的 `images`（整批图生图），无法做到"每张参考图各出一个独立结果"。

**执行器侧现状（代码证据）**
`canvasPlanExecutor.js` 的 `executePlan` 已支持"每步优先用自己的 `referenceImages`"：
```text
canvasPlanExecutor.js L101-103
      ...(stepRefImages(step).length
        ? { images: stepRefImages(step).map((u) => (typeof u === 'string' ? { url: u, name: 'reference' } : u)) }
        : (referenceImages && referenceImages.length ? { images: referenceImages.map(...) } : {})),
```
即：若某步带 `step.referenceImages`，就只用那一张；否则退化用整批 `referenceImages`。

**工具侧现状（关键：已具备按步解析能力）**
`execute_plan` 工具 `useCanvasAgentTools.js L642-649` 已把 `attachment_indices` 解析成该步 `referenceImages`：
```text
useCanvasAgentTools.js L642-649
      const resolvedGens = (gens || []).map((g) => {
        const idxs = Array.isArray(g?.attachment_indices) ? g.attachment_indices.map((i)=>Number(i))... : []
        if (idxs.length > 0 && refPool.length > 0) {
          return { ...g, referenceImages: idxs.filter((i) => i < refPool.length).map((i) => refPool[i]).filter(Boolean) }
        }
        return g
      })
```
说明：底层"按步精确取参考图"能力**已经实现并可用**；缺的只是 `sendImageMode` 在直连路径上"判断语义 + 把整批拆成 N 个 generation"这一环。

---

### 核验点 3：结论 —— `sendImageMode` 要改成什么样才能支持「多参考图一对一拆分」

**结论**
要追平大雄，只需在 `sendImageMode`（`useAgentChat.js L735-769`）里，把"整批塞单 generation"改为"先判断是否一对一改图 → 拆成 N 个 generation，每步 `attachment_indices:[i]`"。底层 `execute_plan` + `canvasPlanExecutor` 已能正确消费。

**精确落点（文件+行号+改法）**

1. **新增语义判断函数**（对齐大雄 `agentLooksLikePerReferenceEdit` @ `canvas-agent.js L2259`）
   - 落点：`useAgentChat.js`，在 `sendImageMode` 之前（如 `L734` 后）新增 `imageModeLooksLikePerReferenceEdit(text, attachCount)`。
   - 改法：移植大雄 L2263-2277 的正则逻辑（分别/各自/每张/都改成/变成X变成Y 多目标），命中返回 true。

2. **拆步逻辑**（对齐大雄 `agentExpandPerReferenceGenerations` @ `canvas-agent.js L2334`）
   - 落点：`useAgentChat.js` `sendImageMode` 内部，`L755` 之后、`L757` 构造 `gens` 处改造。
   - 改法：若 `referenceImages.length >= 2 && imageModeLooksLikePerReferenceEdit(prompt, referenceImages.length)`，则把 `gens` 从单元素数组改为：
     ```js
     const gens = referenceImages.map((url, i) => ({
       id: `direct_image_${Date.now()}_ref${i+1}`,
       title: `参考图${i+1}`,
       prompt,                 // 可后续按大雄 L2292 规则重写为"保持参考主体…仅改X"
       ratio: panel.ratio || 'Auto',
       resolution: panel.resolution || '1K',
       depends_on_previous: false,
       dependency_mode: 'none',
       use_attachments: true,
       attachment_indices: [i],
     }))
     ```
   - `callTool('execute_plan', ...)` 的 `referenceImages` 参数处理（关键优先级链）：
     工具层 `execute_plan` 解析时，**每步若带 `attachment_indices`，则按编号从 `refPool` 取该步 `referenceImages`（`useCanvasAgentTools.js L642-649`），并优先于整批 `referenceImages`（`canvasPlanExecutor.js L101-103`）**。
     因此拆步后每步已带 `attachment_indices:[i]`，工具层会按步精确取图；整批 `referenceImages` 传参可保留作兜底，但不影响正确性。
   - **致命依赖**：`refPool` 来自模块级 `getCurrentReferenceImages()`（`useCanvasAgentTools.js L640`），由 `sendImageMode` 必须显式写入。当前 `sendImageMode`（`useAgentChat.js L735-789`）**完全没调用** `setCurrentReferenceImages`（全代码库仅 `send` 路径 `useAgentChat.js L612` 调用过一次；`sendImageMode` 的 L747-751 只 normalize 了 url 进 `userMsg.attachments`，未写入全局 refPool）。
     所以**必须**在 `sendImageMode` 内补一行：`setCurrentReferenceImages(referenceImages)`（导出见 `useCanvasAgentTools.js L41`），否则 `refPool` 为空、按 `attachment_indices` 取不到图、每步退化成无参考图的纯文生图。

3. **单图/非分别语义保持原行为**
   - 落点：`useAgentChat.js L757-765` 原 `gens = [{...}]` 分支保留为 else 分支（整批塞单 generation），与现状一致。

**无需改动**
- `canvasPlanExecutor.js`：每步 `referenceImages` 优先逻辑已就绪（L101-103）。
- `useCanvasAgentTools.js`：`attachment_indices` 解析已就绪（L642-649）。

---

## 五、输出规范（三节贯通见上）

- 大雄怎么做（代码证据）：见核验点 1。
- 我们现状（代码证据）：见核验点 2。
- 追平落点（可执行）：见核验点 3。

## 六、边界与非目标（自测完整性）

1. **非分别语义的多图（如"融合这两张""参考图1的构图"）**：大雄走 `single` 模式，整批图挂到单任务（`canvas-agent.js L2141-2151`：有底图/合成词/仅单张引用 → 不拆分，`attachment_indices = allRefs`）。我们现状整批塞单 generation **恰好等价于**大雄 `single` 模式，行为正确，**不应**改动。落点 3 的拆步逻辑必须仅在"分别改图"语义下触发，否则会破坏融合/底图类需求。

2. **单张参考图**：`referenceImages.length < 2` 时不满足拆步前提（`agentLooksLikePerReferenceEdit` 首行 `if(n < 2) return false` @ `canvas-agent.js L2262`），保持原单 generation 行为即可。

3. **prompt 重写（可选增强）**：大雄在拆步时会把每步 prompt 重写为"保持参考主体姿态/构图/风格不变，仅改 X"（`agentBuildPerReferenceEditPrompt` @ `canvas-agent.js L2292`）。我们落点 3 示例直接复用用户原 `prompt` 即可工作（图生图会收到对应单张参考图），prompt 重写属锦上添花，不阻塞追平，可后续独立任务处理。

## 七、验收标准（自测映射）
1. 每个核验点均含「大雄（代码证据）+ 我们（代码证据）+ 追平落点（文件+行号+改法）」✅（见四）。
2. 落点落到具体文件+行号，无"在合适位置" ✅（见核验点 3 的 1/2/3）。
3. 结论亲自核实代码，非引用外部文档 ✅（所有行号来自本次打开文件）。

## 八、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。
