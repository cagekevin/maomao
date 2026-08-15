# 37 · AI 助手重设计 + Skill 功能（探索/方向稿）

> **文档定位**：**探索/方向稿**，非实施计划。目标是回答——**怎么在「官方 30 个画布工具完全不动」的前提下，重设计 AI 助手界面 + 增加 CodeBuddy 式 skill 功能**。
>
> **状态**：探索中（draft）。代码落点（§二）基于当前 `src/bundle/` 实测；方向与方案（§三/§四）为权衡后的候选，**均未实施**。
>
> **用户已确认的方向**：
> 1. **skill 形态**：像 CodeBuddy 的 skill——**预设提示词技能**（一段指令 + systemPrompt），点击注入助手，由现有 30 工具执行。
> 2. **界面重设计边界**：**重写面板 UI**，**复用对话/发送逻辑**（`dr` hook 的 `send`/多轮/工具执行闭环）。
> 3. **30 工具边界**：工具本身不动，但 skill 可做**调用前/后的编排层**（多步调用序列）。
>
> **一句话结论（TL;DR）**：A1 助手的「对话 + 画布工具执行」闭环全在前端黑盒（`dr` hook + `lr()` 执行器），**后端只需 LLM 支持 function calling**（已由 `agentChat.ts` 落地）。重设计 = **替换面板组件 `_Component40` 的 UI 层**（不动 `dr`/`lr`/30 工具）；skill = **预设 systemPrompt + 引导语 + 可选编排层**，注入 `dr` 的 `systemPrompt` 或 `send` 前置。这条路径**完全不需要动官方 30 个工具**。

---

## 一、现状架构（先看这个，理解"能复用什么"）

### 1.1 A1 助手 = 前端黑盒闭环 + 后端 LLM 中转

```
浏览器画布 (src/bundle/ 前端)
   _Component40（面板 UI，官方黑盒）        ← 本次要重写的部分
      └─ dr({agentKey,projectId,canvasHandleRef,systemPrompt})  ← hook，复用
           ├─ messages/sending/send/stop/clear  ← 对话状态 + 发送
           └─ send 内部: SSE 多轮循环 + lr() 执行 30 个画布工具
   ▼
localTool POST /api/agent/:id/chat（agentChat.ts，已落地）
   ▼
支持 function calling 的 LLM（魔搭 Qwen3-14B）
```

- **前端闭环已齐**：`send`（`App.../shared.js:2786` 多轮循环）→ SSE 解析 `tool_calls` → `lr()`（`App.../shared.js:1896` 执行器）直接操作 React Flow 内存画布。**30 个工具全在前端，后端零理解。**
- **后端只缺 LLM 中转**：已由 `agentChat.ts` 落地（docs/27 §11，魔搭 Qwen3-14B，走代理）。

### 1.2 关键代码落点（实测）

| 落点 | 位置 | 作用 | 本次是否动 |
|---|---|---|---|
| **面板组件** | `src/bundle/App-BX6o9fW5_components/_Component40.jsx` | A1 助手聊天面板 UI（模型选择/输入框/消息列表/图片上传） | 🟠 **重写 UI** |
| **挂载点** | `App-BX6o9fW5_components/Vr.jsx:3685` | `<_Component40 agentKey="canvas-assistant" projectId={Z} canvasHandleRef={Ht} open={Ot} onClose onWidthChange={Nt} onEnabledChange={Bt} />` | 🟢 改 props 传 skill |
| **对话/发送 hook** | `App-BX6o9fW5_components/shared.js:2537 dr(e)` | 入参 `{agentKey, projectId, canvasHandleRef, defaultModel, systemPrompt}`，返回 `{messages, sending, error, model, setModel, send, stop, clear}` | 🟢 **复用，不改** |
| **工具执行器** | `App-BX6o9fW5_components/shared.js:1896 lr()` | `lr(name, args, canvasHandleRef)` 执行 30 工具（⚠️ 勿与 `httpClient.../shared.js:391` 的同名 `lr=Promise.resolve()` 混淆） | 🚫 完全不动 |
| **工具 schema** | `App-BX6o9fW5_components/shared.js:1270 or[]`（30 项） | 前端发给 LLM 的 tools schema | 🚫 完全不动 |
| **agent 配置** | `ar(e)` `App/shared.js:1248` → `/agent/:id/vip-check` | 返回 `{allowed, enabled, systemPrompt, defaultModel, visionModels}` | 🟢 skill 可注入 systemPrompt |
| **后端 chat** | `localTool/src/routes/agentChat.ts` | `/api/agent/:id/chat` SSE 透传 LLM | 🟢 不改（或可选加 skill 存储） |

### 1.3 核心结论：能复用 vs 要重写

- **✅ 复用（绝不动）**：`dr` hook（对话/发送/多轮/工具执行闭环）、`lr()` 执行器、30 个工具 schema、`agentChat.ts` 后端。
- **🟠 重写**：`_Component40` 的面板 **UI 层**——但保留它暴露的 props 契约（`open`/`onClose`/`onWidthChange`/`onEnabledChange`/`canvasHandleRef`），这样 `Vr.jsx` 挂载点改动最小。
- **🟢 新增**：skill 数据源 + skill 注入逻辑。

---

## 二、重设计面板 UI（复用 dr 闭环）

### 2.1 原则

**只替换「怎么展示」，不碰「怎么对话」**。新面板组件（建议命名 `_cmp_AssistantPanel`，放 `httpClient-BknZwXjG_components/` 新文件，或复用现有 barrel）内部仍然：
- 调 `dr({ agentKey, projectId, canvasHandleRef, defaultModel, systemPrompt })` 拿 `messages/sending/send/stop/clear/setModel`。
- 渲染消息列表（`F`）、输入框（`v`）、发送按钮、模型下拉、图片上传（`D`）。
- 所有 `send`/`stop`/`clear` 直接复用 dr 返回的。

### 2.2 新增 UI 区块（本次核心增量）

1. **技能区（Skill 面板）**：面板顶部/侧边放一排 skill 卡片，点击即注入（见 §三）。
2. **消息展示增强**：现有消息是纯文本 + 可能含 `reasoning`（思考链）。可改为区分「用户/助手/思考/工具执行」的视觉样式，展示 LLM 调用工具的进度（`tool_calls` 名称 + 状态）。
3. **输入区增强**：保留文本输入 + 图片上传，可加「清空对话」「停止生成」按钮（`clear`/`stop` 已有）。

### 2.3 挂载点改动（Vr.jsx:3685）

只把 `<_cmp__Component40 ...>` 换成 `<_cmp_AssistantPanel ...>`（新组件名），props 契约保持一致 + 加一个 `skills` 数组 prop：
```js
<_cmp_AssistantPanel
  agentKey={`canvas-assistant`}
  projectId={Z}
  canvasHandleRef={Ht}
  open={Ot}
  onClose={() => jt(false)}
  onWidthChange={Nt}
  onEnabledChange={Bt}
  skills={SKILLS}   // ← 新增：技能列表
/>
```

> ⚠️ 避坑（CLAUDE.md §五.4）：新组件**不要 import 顶层大 chunk**（TDZ）；放 `*_components/` 内新建文件，走 barrel；React 单实例由 shim 保证，别新增独立 react。

---

## 三、Skill 架构（CodeBuddy 式预设技能）

### 3.1 Skill 的定义（数据结构）

CodeBuddy 的 skill 本质是「一段预设的指令 + 触发描述」。映射到本画布助手，一个 skill 建议如下结构：

```js
// SKILLS 数组（前端常量，或 localTool 下发）
{
  id: 'short-video-script',      // 唯一 id
  name: '短视频脚本',             // 展示名
  icon: '🎬',                    // 图标（可选）
  description: '输入主题，生成 N 个分镜脚本 + 资产 + 提示词',  // 卡片说明
  systemPrompt: '你是短视频编导...',  // 注入 dr 的 systemPrompt（覆盖/追加）
  userHint: '帮我做一个关于...的短视频脚本',  // 点击后预填的引导语（触发词）
  steps: [                       // 可选：编排层（见 §3.3）
    { tool: 'create_node', args: { type: 'scriptBoxNode', ... } },
    ...
  ]
}
```

### 3.2 Skill 如何生效（三条注入路径）

| 路径 | 做法 | 改动量 | 适用 |
|---|---|---|---|
| **A. systemPrompt 注入** | 点 skill → `setModel` + 把 skill.systemPrompt 设为 dr 的 systemPrompt，再 `send(userHint)` | 小（前端） | 大多数 skill |
| **B. userHint 预填** | 点 skill → 输入框预填引导语，用户确认后手动发 | 最小 | 简单技能 |
| **C. 编排层（多步）** | 点 skill → 前端先串行调 `lr()` 执行 steps（建节点/连线），再交给 LLM 对话 | 中（前端编排） | 复杂技能（需 30 工具组合） |

> **推荐先做 A/B（零编排），C 作为进阶**。因为 A/B 完全靠 systemPrompt + 引导语驱动现有 30 工具，**零改工具、零改后端**；C 需要额外写编排函数。

### 3.3 编排层（steps）——用户确认的「调用前/后编排」

30 工具本身不动，但 skill 可以在 `send` **之前**（或 LLM 工具执行之后）做一个**前端编排**：
- **前编排**：点 skill 时，先用 `lr()` 执行预设的「建 scriptBoxNode → 连线」等步骤，把画布铺好，再让 LLM 接着对话。
- **后编排**：LLM 执行完某个工具后，前端可补做「自动连线」「自动布局」等收尾（复用 `move_node`/`connect_nodes`）。

实现上，编排层就是**一个调用 `lr(name, args, canvasHandleRef)` 的函数**（`lr` 暴露在 shared.js，`_Component40` 通过 `dr` 的 `canvasHandleRef` 拿到句柄）。**不动 `lr` 本身，只是调用它。**

### 3.4 Skill 数据源（放哪）

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **S1 前端常量** | skill 定义写在 `_Component40`（或新文件）里 | 零后端改动、零新增接口 | 改 skill 要改前端 + build 回灌 |
| **S2 localTool 下发** | localTool 新增 `/api/agent/canvas-assistant/skills` 返回 skill 清单 | 改 skill 只改 localTool，不动前端 | 多一个接口 + 契约 |
| **S3 混合（推荐）** | 核心 skill 前端内置（兜底），localTool 可扩展下发 | 前端零依赖可跑，localTool 可加技能 | 两者都要维护 |

> **建议先 S1（前端常量）**，让 skill 快速落地验证；后续要支持"用户自定义技能"再升 S2/S3。符合「奥卡姆剃刀：如无必要勿增实体」。

### 3.5 Skill 与 systemPrompt 的注入细节（重要，避免踩坑）

- `dr` 接收 `systemPrompt`，`_Component40` 里 `ee = u?.systemPrompt` 来自 `ar(e)`（vip-check 返回的 agent 配置）。
- **skill 注入时**：需要能覆盖/合并这个 systemPrompt。两种做法：
  - ① 在 `_Component40` 里维护一个「当前 skill」state，`dr({ systemPrompt: skill ? skill.systemPrompt : agentConfig.systemPrompt })`。
  - ② 或在 `send` 时把 skill 的引导语 prepend 到 user message（更稳，不动 systemPrompt 逻辑）。
- ⚠️ **后端注意**（docs/27 §2.5.3）：前端 `shared.js:2586` 会过滤掉 `messages` 里的 system，后端收到的 messages 不含 system，`agentChat.ts` 会 unshift 一条本地准则。**skill 的 systemPrompt 若想生效，要么走前端注入（dr 层），要么改 `agentChat.ts` 按 skill id 选择 systemPrompt**（可选）。

---

## 四、推荐执行路径（分阶段）

> 全部不动 30 工具、不动 `lr`、不动后端核心。每阶段独立可验收。

| 阶段 | 动作 | 产出 | 状态 |
|---|---|---|---|
| **P1 验证链路** | 在现有 `_Component40` 里先验证 skill 注入（A/B 路径）能驱动 30 工具 | skill 注入 demo | ⬜ 待做 |
| **P2 重设计面板** | 新建 `_cmp_AssistantPanel`，复用 `dr` 闭环，重写 UI（技能区/消息展示/输入区） | 新面板 + 技能区 | ⬜ 待做 |
| **P3 skill 数据源** | skill 定义成前端常量（S1），含 systemPrompt + userHint + 可选 steps | skill 清单 | ⬜ 待做 |
| **P4 编排层** | 为复杂 skill 实现「前/后编排」（调用 `lr` 组合工具） | 编排函数 | ⬜ 待做 |
| **P5 后端扩展** | （可选）localTool 下发 skill / 按 skill 选 systemPrompt | 接口 | ⬜ 待做 |

> **建议顺序**：先 P1 用最小改动验证「skill 注入 → LLM → 工具执行」全链路通，再投入 P2 重设计 UI。P1 若验证 skill 无法驱动工具（如 systemPrompt 注入无效），P2/P3 的方案要调整，避免白做 UI。

---

## 五、约束与红线（实施必读）

1. **30 工具 + `lr` 完全不动**：它们在前端黑盒里，动了就破坏「官方更新重打补丁」的边界。
2. **`dr` hook 复用**：新面板必须通过 `dr` 拿 `send/stop/clear`，不要另起炉灶重写对话逻辑（否则丢失多轮循环 + 工具执行闭环）。
3. **React 单实例不可破 + 资源独立**：新组件放 `*_components/` 新建文件，不 import 顶层大 chunk（TDZ）。
   - **CSS 自包含（SOP §3.2 标准，推荐）**：新面板样式用**自包含 CSS**——组件内 `const STYLES = \`...\`` 定义 CSS 字符串（统一前缀如 `ap-`），通过 `<style>{STYLES}</style>` 注入，**完全不用 Tailwind 任意值**（❌ `gap-[16px]`/`text-[#e5e5e5]`/`rounded-[18px]`）。颜色用 hex/rgba、字体 px、间距 px，伪类写进 CSS 字符串。参考 maomao `SOP-代码拆解标准流程.md` §3.2 模板（此方案比 `import './xxx.css'` 更适合混淆还原工程——`xxx.css` 会被 Vite 打包但需确认 dist 引用，而 `<style>` 注入随组件走、零额外依赖）。
   - **图标内联 SVG（SOP 翻车 #11）**：新面板图标用**内联 SVG**（写进组件 JSX），不 `import` vendor 图标组件，也不复用官方混淆 JS 里硬编码的 svg 别名（`Component860/859/864` 等）——官方更新后这些符号/路径会重排失效。`public/` 的 `icon*.png`/`favicon.svg` 可用于应用级图标（`post-build-fixups` ①会拷）。
   - **不要改/依赖官方 4 个混淆 CSS**（`src-DoQUrSOl.css`/`httpClient-DFxwm5B3.css`/`vendor-Qkhkn02K.css` 在 `src/bundle/assets/`，是官方产物 + `post-build-fixups` ①引用，改它们破坏「官方更新重打」边界，且 `src-DoQUrSOl.css` 由 post-build 补回引用，动它会被下次 build 覆盖）。
   - **通信用事件总线（SOP 翻车 #6）**：新面板与 `Vr.jsx` 之间若需状态同步（如 Skill 写回画布、面板开合联动），用 `window.dispatchEvent('ap:xxxChanged')` 事件总线（调用点 ≤2 才用 props 回调）——**不要从新文件 `import` `Vr.jsx`/顶层大 chunk**（TDZ 循环依赖）。
4. **props 契约对齐**：新面板保留 `_Component40` 的 props（`open`/`onClose`/`onWidthChange`/`onEnabledChange`/`canvasHandleRef`），让 `Vr.jsx:3685` 改动最小。
5. **skill 注入走前端或 `agentChat.ts`**：别改 `shared.js:2586` 的 system 过滤逻辑（那是官方前端，动了破坏重打边界）。
6. **改动登记**：若动了 `src/bundle/`（新面板/挂载点），按 docs/01 §四.2 变更登记 + build 回灌。
7. **验证**：`npm run test:smoke` + `npm run build` + 真机走查（点 skill → 助手驱动画布）。

---

## 六、盲点与待确认（实施前必读）

- **画布句柄盲点（docs/27 §10.2）**：`lr()` 依赖 `canvasHandleRef`（`Ht`）就绪，本地引擎模式下是否正常需真机验证——这决定 skill 编排层（调 `lr`）能不能用。
- **skill 注入 systemPrompt 是否真能驱动工具**：需先验证 A 路径（systemPrompt 注入）是否被 LLM 采纳。若魔搭 Qwen3-14B 对长 systemPrompt 的服从性不足，可能要改用 userHint 预填（B 路径）更稳。
- **8 轮上限（`ur=8`，docs/27 §10.4）**：复杂 skill 的多步编排 + 对话可能超 8 轮被截断，编排层应考虑把「确定性步骤」放前端（steps），减少对 LLM 多轮循环的依赖。
- **打字机退化（docs/27 §11.4）**：LLM 走代理时 SSE 被缓冲成一次性返回，功能正确但非流式打字。重设计 UI 时消息展示需兼容"一次性出整段"。

---

## 七、实施方法论（借鉴 maomao SOP-代码拆解标准流程）

> 以下方法论来自 `/Users/kevin/Documents/maomao/docs/SOP-代码拆解标准流程.md`（同源混淆还原工程），对重写 `_Component40` 面板有直接指导意义，落地前读原文。

### 7.1 核心判断：AI 不怕缩写，怕散点与隐式依赖（ROI 排序）

> **AI 能读全文件、grep 定义、追调用链，缩写不是障碍；障碍是①散点炸点②隐式依赖③巨文件单体。**

对本次任务的应用：
- **Skill = 显式契约，ROI 最高**：skill 的 systemPrompt/引导语是「显式注入」，比「改 30 工具」或「改 `_Component40` 逻辑」都安全——印证 §三「完全不动 30 工具、靠 systemPrompt 驱动」的方向正确。
- **重写面板 UI 次之**：只动 `_Component40` 的展示层（UI），不动 `dr`/`lr`/30 工具，散点少、依赖可见。
- **不建议**：为 skill 去改 `shared.js:2586`（system 过滤）或 `lr`（执行器）——那是官方前端核心，动了引入隐式依赖回归。

### 7.2 前置检查（拆 `_Component40` 前必答，参考 SOP §1）

| # | 检查项 | 对本次的意义 |
|---|---|---|
| 1 | `_Component40` 是否被多处高频依赖？ | 它只在 `Vr.jsx:3685` 一处挂载 → **可重写**（替换为新组件名） |
| 2 | 是否引用模块级闭包变量？ | 它内部用 `dr`/`ar`/`lr`（从 `shared.js` import）。重写时**这些必须从同一 `shared.js` import 或用 props 传入**，不能假定全局 |
| 3 | 体积是否值得拆？ | `_Component40.jsx` 是完整面板（几百行）→ 值得重写/拆分 |
| 4 | 有无专题文档？ | `docs/37`（本文）+ `docs/27`（A1 助手定稿）→ 已具备 |

> ⚠️ **关键**：`_Component40` 内部依赖 `dr`/`ar`/`lr`（都在 `App.../shared.js`）。重写的新面板**必须从同一个 `shared.js` import 这些符号**（同模块、同实例），不能在新文件里另起炉灶——否则 `dr` 拿到的 `send` 不是同一套画布句柄绑定，工具执行会失败。

### 7.3 大块删除/重写用 Node 脚本（参考 SOP §4.1）

若要在 `src/bundle/` 里大段替换（如把 `Vr.jsx:3685` 的挂载换成新组件、或删除 `_Component40` 旧 UI），**300+ 行的删除/替换不用 `replace_in_file`**（容易上半截换了下半截留着），用 `indexOf`+`substring` 的 Node 脚本定位 + 切片，兼容 `\r\n`。

### 7.4 验证顺序（参考 SOP §5）

```
1. npm run build          ← 编译通过（回灌 dist）
2. npm run test:smoke     ← 契约/React 单实例/chunk 完整性
3. 真机走查                ← Chrome 加载 dist，点 skill → 助手驱动画布
```
> ⚠️ SOP 提醒：`test:e`（npm React）与 Chrome 用的 vendor React **不等价**，真机验证不可跳过——本项目的 `test:smoke` 同理，最终以 Chrome 真机为准。

### 7.5 渐进式路线图 + 翻车铁律（借鉴 maomao 拆分计划，**勿全量重写**）

> maomao `docs/拆分计划.md` 用**真实多次翻车**证明：混淆还原工程「整块迁移/全量重写」必踩 TDZ/初始化依赖链崩。对本次 AI 助手重设计 + 后续任何混淆码改造，**必须渐进式，不能全量**。

#### 7.5.1 为什么不能「把每个文件都重写」（maomao 实测铁律）

| maomao 翻车 | 现象 | 根因 | 对本项目（11 万行）的影响 |
|---|---|---|---|
| #6/#7 editorStore 整块迁移 2094 行 | `Cannot access 'Lj' before initialization` TDZ | 改变 ES module 加载图，打乱 `let/const` 初始化顺序 | `src/bundle` 的 `shared.js`（34k/11k 行）+ 跨文件互相 import 正是这种「不可分割有机体」，全量迁移会密集触发 |
| #16 提取 48 行共享函数 `si` | build 过但运行时 `Bd is not a function`，扩展打不开 | 模块级函数间隐式初始化依赖链，抽任何函数都改变加载图 | `lr`/`dr`/30 工具等被高频依赖的共享函数**绝不可抽** |
| #9 新文件 import App.js | 循环依赖 TDZ | App.js 无命名导出，加 export 再 import 必然循环 | 新面板不 import 顶层大 chunk（已在 §五 约束） |

> **结论**：你问的「把每个文件都重新写、重写事件总线、每个文件改 CSS」——**非常麻烦且高风险**（maomao 实证），且官方每次发新版会冲掉所有重写。正确路径是下面 7.5.2 的「渐进式」。

#### 7.5.2 渐进式路线图（maomao §8~§11 精化，对应本项目）

```
① 注释化/可读化（先建地图，再动手）     ← docs/36 已落地（symbol_map.json + 注释）
② 语义化重命名（切和改分离，逐个评估）   ← 只改引用范围可控的本地短名
③ vendor 翻译层（不删 vendor，只加映射） ← 远期：vendor-readable.js 映射标准库名
④ 新代码直连标准库（新组件语义名）        ← 本次 Skill/新面板就从此步开始
⑤ 旧代码按需替换（逐个换，不一次全换）   ← 只重写要改的组件（如 _Component40）
```

**本项目落地建议**：
- **本次（AI 助手重设计 + Skill）只做 ④ + ⑤ 的"按需"子集**：新面板用语义名 + 自包含 CSS + 事件总线（§3.1 SOP），`_Component40` 只重写要改的部分，其余官方组件不动。
- **③ vendor 翻译层**：远期才做（当前新组件已能 `import { useState } from 'react'`，通过 `_react_shim`/`_jsx_runtime` 单实例 alias 支持，见 CLAUDE.md §五.4）。
- **绝不碰**：`shared.js` 聚合、`lr` 执行器、30 工具、vendor/运行时——它们是「不可分割有机体」。

#### 7.5.3 翻车铁律速记（实施时避坑）

1. **被高频依赖的共享函数不可从 chunk 抽取**（`lr`/`dr`/`ar`/30 工具）——抽了必崩。
2. **不能从新文件 import 顶层大 chunk**（TDZ）——用事件总线或从 `component_map.json` 指定文件 import。
3. **整块迁移几千行必翻车**（store+helper 不可分割）——只做最小差异。
4. **`npm run build` 通过 ≠ 没回归**——必须 Chrome 真机验证（vendor React 不等价 npm React）。
5. **先理解再动手**（注释化/symbol_map 先建地图）——直接拆不懂的代码是 maomao 翻车根因。
6. **官方更新会冲掉所有重写**——重写只针对「确认要改的」组件，且登记到 docs/01 变更台账。

---

## 附：相关文档索引

- `docs/27-AI操控画布-定稿方案.md`：A1 助手 30 工具 schema、SSE 协议、`agentChat.ts` 实施记录（§11）。
- `docs/01 长期目标-未来适配方向.md`：方向六（A1 助手）落地 + 变更 #1/#8。
- `src/bundle/App-BX6o9fW5_components/_Component40.jsx`：现有面板组件（重写目标）。
- `src/bundle/App-BX6o9fW5_components/shared.js:2537 dr` / `:1248 ar`：对话 hook / agent 配置。
- `src/bundle/App-BX6o9fW5_components/shared.js:1270 or[]` / `:1896 lr`：30 工具 schema / 执行器（**不动**）。
- `localTool/src/routes/agentChat.ts`：`/api/agent/:id/chat` 后端（已落地）。
- `/Users/kevin/Documents/maomao/docs/SOP-代码拆解标准流程.md`：同源混淆还原工程的拆解方法论（自包含 CSS / 事件总线 / 前置检查 / 大块删除用脚本）——§七 已摘要点。
- `/Users/kevin/Documents/maomao/docs/拆分计划.md`：同源混淆还原工程的渐进式拆分路线图 + 翻车铁律（**勿全量重写**，TDZ/初始化链）——§7.5 已摘要点。
