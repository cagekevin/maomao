# CLAUDE.md · 一毛AI画布多端合一（自研后端替代版）架构师工作手册

> **最后更新**：2026-08-15（主力开发切换为可维护原型，1mao 混淆代码仅作参考）

## ⚠️ 最新情况（2026-08-15，改动前必读）

> **主力开发已从「1mao 混淆还原代码」切换到「可维护原型」。** 结构如下：

```
本目录（新建文件夹，正式工程）
├── src/                        ← 【主力】可维护原型代码（App.jsx / components/ / base/…）
├── public/                     ← 插件文件（manifest.json / background.js / icon*.png）
├── index.html + vite.config.js + tailwind.config.js + package.json
├── scripts/                    ← 测试地基（smoke/regression/tools/health-check）
├── TESTING.md                  ← 测试体系文档
└── reference-1mao/             ← 【只读参考】1mao 混淆还原代码（查代码用，不直接改）
```

### 改代码入口（对，不是改 src/bundle）
- **主力开发/使用**：改本目录 `src/`（原型），不是 `reference-1mao/`
- **查 1mao 怎么实现某功能**：看 `reference-1mao/`（混淆还原代码，作参考）

### 常用命令（原型的，不是 1mao 的）
```bash
npm run dev           # 开发服务器（默认 5180）
npm run build         # 构建插件包 dist/
npm test              # 统一测试门禁（smoke + regression + tools）
npm run check:health  # 工程健康全量检查（构建+测试+TDZ+dist基线）
```

### 注意
- 本文件下方（§〇~§七）是 **1mao 混淆还原时代的架构手册**，与 `src/bundle/`、`localTool`、`apimart-gateway` 强相关；**`src/bundle/` 相关描述已失效**（现已归档到 `reference-1mao/`），localTool/网关部分仍有效（后端未变）。查后端时用下方，查前端主力开发用上方。

---

## 〇、 写给后续 AI 的写作铁律（最高优先）

**本项目约 90% 的代码与文档是写给后续 AI 的，不是给人看的。** 默认读者是下一个 AI。做到：

- **真实不误导**：文档与代码现状一致，宁可少写不写错；标注"已完成/规划中/已失效"，禁止把过时结构（旧 `src/legacy`、已归档脚本）写成现状。
- **简洁**：最少字传达必要信息，不写流水账/客套/重复。
- **精确**：脚本、文件、npm 命令必须是仓库真实存在的，已归档的写 `archived/`。
- **留痕**：反直觉改动立即注释"语义 + 原始混淆名"（§五.4 铁律 6）。

### 〇.1 沟通铁律（回复用户/给方案时，最高优先）

> 本组规则针对 AI **回答用户、给方案、汇报进度**时的输出。原则：**先给动作，再给解释；能一步说清不写两段；说完了就停。**

1. **第一行给下一步动作**：开头是可执行命令/文件路径/结论，不是"让我看看/好的/我来分析"式铺垫。例：先说 `npm run ask -- contract proxyMode` 怎么跑，再解释为什么。
2. **多步任务编号**：步骤 >1 就写成 `1. 2. 3.`，每步一个动作，不做无谓拆分。
3. **结尾给一个下一步**：若有事未了，收尾给 ONE 个 ≤2 分钟能做的动作；不写"还需要我做什么吗""希望有帮助"。
4. **砍跑题**：一个事说完再提下一个，第 2 个问题单独问，不塞同一段。
5. **每轮重述状态**：多步工作汇报时先说"第 N/M 步完成"，别让用户猜进度。有多步任务列表/计划工具（如 todo）时用它维护进度，一条一步、同时只有一个 in-progress，让列表替我重述，不另用散文复述整个计划。
6. **具体时间/范围预估**：说"约 15 分钟 / 改 3 处"，不说"一会儿 / 一些工作"。
7. **成果可见**：做完直接说"现在能跑 `npm run build`"，不把结果埋进长段总结。
8. **错误就事论事**：报错直接说"原因 + 修法"，不说"哎呀 / 似乎有问题"。
9. **列表 ≤5 项**：超 5 项拆"先做/后做"或"必做/可选"，不一次性堆 10 条。
10. **禁废话**：删掉开场客套（"好的！""明白了！""我来看看"）、结尾客套（"祝使用愉快""有需要随时说"）、无信息量的副词（"可能/或许/比较"）、套话比喻（"画龙点睛/打通壁垒"）。有真实不确定才用"可能"，别为了礼貌加。

> 发送前自查：删掉"我要开始…"式开头、"还有别的事吗"式结尾、任何跑题旁支。若只读第一行和最后一行就能知道下一步该干啥——发送；否则改到能为止。

> **与写作铁律的关系**：〇 的四条（真实/简洁/精确/留痕）约束**写进代码与文档的内容**；〇.1 十条约束 **AI 和用户对话时的表达**。两者都最高优先，冲突时真实 > 简洁（宁可多一句，不写错）。

### 〇.2 验收标准

> 标准：陌生后续 AI 能否凭此快速定位到要改的地方、且不被误导？能 → 合格；不能 → 重写。同时对话回复能否让用户只读首尾就行动？能 → 合格；不能 → 精简。

### 〇.3 打破规则的例外（默认规则之上，安全/任务/歧义优先）

> 〇.1 十条是默认；遇到下列情况**优先打破默认**。原则：约束赢了，形状（先动作/头尾不客套）仍保留。

1. **用户明确要"解释/带我过一遍"**：可以完整展开讲，但头尾仍不客套；正文按需长，加小标题方便回看。
2. **破坏性操作在前**（`rm -rf`、强推、数据库迁移、删表、`git reset --hard`）：先确认再动手，**安全 > 简洁**。
3. **调试卡死**：同一问题连续 3 轮仍没解决，停止继续改代码，说出"可能想错了的假设"，问 1 个诊断问题，而非继续迭代。
4. **请求真有歧义**：问 1 个短的澄清问题，胜过猜错重写。
5. **规则和任务打架**：当规则会删掉答案本身时，任务赢、形状留。例：问"有哪些选项"就给 2~4 个带一行取舍的排序选项（推荐在前），而不是只给一条路——选项本身就是答案。
6. **规则和工具/系统冲突**：代码助手系统约束高于本规范；该声明工具调用就声明，该直接干活就不问"要不要我"，时间预估对准真正执行步骤的人。同 5：约束赢、形状留。

---

## 一、 项目全局定位 (TL;DR)

* **项目本质**：使用自研的 `localTool` 和 `apimart-gateway` 替换官方原版的三个闭源可执行引擎（Win端、Mac Arm版、Mac Intel版），实现多端合一。

* **当前进度**：
  * **已完成**：`localTool` 已承担前端托管、请求代理、本地存储及生图异步转同步，并自研实现了替代官方 1mao 的平台接口。`apimart-gateway` 已承担 Lovart 中继、聊天同步、图视异步、webhook 及自动确认。
  * **进行中**：网关原生双模（同步/异步）改造、落盘转存（不丢图）增强。
  * **新增（2026-08-02）**：仓库已纳入官方混淆 `dist/` 逆向还原出的**可编辑工程源码** `src/bundle/`，支持 `npm run build` 直接回灌 `dist/`（见 §五.4）；配套还原流水线脚本已归档到 `scripts/archived/`（`rename-pipeline/`、`beautify/`、`tools/` 等，一次性逆向产物），核心质量门 `scripts/smoke_test.cjs`（AI 默认自检，见 §三）。逆向还原方法论与中间产物集中于 `docs/逆向专用_ai 禁止读/`（标注「AI 禁止读」，AI 助手默认不读取该目录内容）。
  * **新增（2026-08-09）AI 可读性增强**：新增 **`npm run ask`（AI 检索总入口，改码前先跑它，见 §三/§五.8）**；`npm run map` 额外产出 `symbol_map.json`（符号级索引）+ `AI_NAVIGATION.md`（改码第一站导航）。方向稿见 `docs/36-AI可读性架构优化探索.md`。

---

## 二、 核心架构与组件职责

系统严格遵循分层铁律，请求的唯一入口为 `localTool`，网关作为纯粹的中转站。任何接口/报错/模型的归属，必须先分清是 **localTool / 网关 / 官方 1mao / kkidc** 哪一类，禁止含糊说"后端返回"。

### 0. 三道关系与信息链路（总图）

```
浏览器/画布 (dist/)
   │  唯一出口 proxyMode=local-tool，所有请求打到 localTool
   ▼
localTool :18080  ── 自研，整体对接 apimart-gateway
   ├─ /api/proxy ──────► apimart-gateway :9004 ──► Lovart (lgw.lovart.ai，需 VPN)
   │      （x-proxy-url 常态 = http://127.0.0.1:9004/...）
   ├─ /api/proxy 透传 ─► kkidc (外部视频上游，原样透传)
   └─ /public/platform/* ─► 本地静态兜底（自研替换官方 1mao，不连任何远端）
   ▼
官方 1mao（闭源，非自研）
   └─ 仅当 localTool 未启动时，前端 fallback 裸直连；常态不参与链路
```

**关系要点**：
- localTool ↔ apimart-gateway：经 `/api/proxy` 服务端转发，`x-proxy-url` 常态指向 `:9004`，再到 Lovart。
- localTool ↔ 官方 1mao：官方 1mao 的平台接口由 localTool **自研替换**，常态不连；仅 fallback 裸连官方。
- apimart-gateway ↔ 官方 1mao：**无直接关系**，网关只认 Lovart。
- kkidc：localTool 透传的外部上游，非前端直连、也非网关直连。

### 1. 核心层：localTool (一毛画布专属适配层)

* **技术栈与端口**：Node/TS，固定端口 `127.0.0.1:18080`。
* **定位**：一切"让画布好用"的适配都在此层完成，整体对接 **apimart-gateway（→Lovart）**。

* **八类职责**：
  1. **前端托管**：托管 `dist/` 静态产物并自动打开浏览器。
  2. **代理转发**：画布所有请求（`proxyMode=local-tool`）的唯一入口 `/api/proxy`，负责协议翻译（剥 `{code,data}` 信封、SSE 过滤、异步转同步、超时），转发给网关或透传给 kkidc。
  3. **本地存储**：KV、任务、资源、文件 `/files/` 落盘（**SQLite 即 `sql.js` 本地 WASM，库文件 `~/.maomao-localtool/localtool.db`，非云端**；schema 见 `localTool/src/db/database.ts`，仅 `tasks` 表存生成任务 prompt）。
  4. **接口替换**：自研实现平台接口（`/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/*`、`/api/sync/default` 兜底），**替代官方 1mao 的对应能力**（官方为闭源外部服务，非自研），返回本地静态兜底，不连官方服务，也不实时连 Lovart。
  5. **管理接口**：`/api/admin/*`（统计/清理/导入导出）。
  6. **上传/资产**：`/api/assets/upload`、`/api/upload/app-asset`。
  7. **网关自检引导**：读 apimart-gateway `.env` 校验 AK/SK、提示 VPN。
  8. **官方权益接口转发**（`/api/user/info`、`/api/user/model-entitlements`、`/api/agent/:id/vip-check`）：官方 1mao 闭源，账号/权益/会员判定 100% 在官方远程；本层只做**中转 + 短缓存**（内存 Map，按 token hash 隔离），不取代官方判定、不伪造权限。默认转发目标为官方候选接入点（endpointConfig `s()[0]`，如 `https://www.1mao.cc`）。**注意**：前端权益 base 默认直连官方候选地址（`g()` 只读 sessionStorage 不读 KV），请求当前不经本层；需后续让前端把 base 指向 18080 才真正接管（见 `localTool/src/routes/official.ts` 尾部「后续补前端」）。

> 注：② 的转发目标是 apimart-gateway；④ 是用来替换官方 1mao 的，两者边界清晰。

### 2. 中继层：apimart-gateway (通用第三方 AI API 中继)

* **技术栈与端口**：Python/FastAPI，固定端口 `127.0.0.1:9004`。
* **定位**：纯粹中转站，只对接 Lovart，做三件事：
  1. 接收外部 OpenAI 风格请求（`/v1/images`、`/v1/videos`、`/v1/chat`）。
  2. 最小规范化（尺寸解析、数量约束、**模型别名映射**→Lovart 工具名）。
  3. 转发 Lovart 并回传结果。

* **绝对解耦**：只认"图片/视频/聊天"三种能力；✗ 不关心前端逻辑（节点/特惠/混淆字段），✗ 不侵入 Lovart 内部（项目/工具名/生成策略由 `lovart_client.py` 负责）。鲁棒性（项目失效重建、`done` 防抖、高成本自动确认）属对上游不稳定性的兜底，不改变中转定位。

### 3. 前端与外部依赖层

* **画布前端 (`dist/`)**：Vite 构建产物，由 `src/bundle/` 编译生成（见 §五.4）。**运行只读 `dist/`**；改前端须改 `src/bundle/` 再 `npm run build` 回灌。
* **逆向还原源码 (`src/bundle/`)**：官方 `dist/` 经拆包/还原后的**可编辑工程源码**（约 200 文件，174 `.jsx` + 18 `.js` + 4 `.css` + 4 `.json`）。每个顶层 chunk `.js` 仅做门面 re-export，真实逻辑拆到 `*_components/` 子目录；`component_map.json` 记录「原始混淆名 → 文件名」映射，是还原引用的真相表。含 `_react_shim.js` / `_jsx_runtime.js` 解决 React 单实例问题（⚠️ 不可删除/改写，否则 `Invalid hook call`）。**改完跑 `npm run build` 即回灌 `dist/`**（见 §五.4 改造规范）。
* **官方 1mao**：闭源外部服务（**非自研**），处理账号权益（含 grok/GK 等模型及报错），体外于自研引擎；仅在 localTool 未启动时作为 fallback 裸连。其平台接口正由 localTool 自研替换（见 §二.1 ④）。
* **kkidc**：视频生成外部上游，请求由 localTool 原样透传，非前端直连。

---

## 三、 修改代码步骤与提交前验证流程（不跑不许提交）

### 3.0 先分清两类代码：改「混淆还原」 vs 新建「自研」（SOP 不同）

> **AI 动手前先判断这次改的是哪类代码，用对应 SOP。** 混淆还原码和自研新代码的约束完全不同，混用会踩坑。

| 场景 | 代表位置 | 命名 | SOP |
|---|---|---|---|
| **① 改/扩官方混淆码** | `src/bundle/*_components/` 内**已有**的混淆文件（`H_.jsx`/`shared.js`/`_Component40.jsx` 等） | **沿用混淆名**，改动处加语义注释 + 原名（如 `// ol = tasks 数组`） | 走本 §三 + §五.4（最小差异 ≤30 行、混淆留痕、官方更新重打边界） |
| **② 新建自研代码** | `src/bundle/*_components/` 内**新建**文件，或 `localTool/src/**`、`scripts/**` | **用语义化命名**（不用混淆名），如 `_cmp_AssistantPanel.jsx`、`agentChat.ts` | 走下方「新建自研 SOP」（§3.1） |

> ⚠️ 判断要点：**改动落在既有混淆函数内 = ①**（必须最小差异、留痕、可重打）；**新增独立功能/组件 = ②**（可用语义名、自包含资源、独立文件）。若拿不准，按①保守处理（混淆码宁可少动）。

### 3.1 新建自研代码 SOP（新写组件/模块，不用混淆名）

> 适用于**我们自研新增**、不在官方混淆包里的逻辑。借鉴 maomao `SOP-代码拆解标准流程.md`（同源混淆还原工程）。**验证链路仍走本 §三 通用流程（0~5 步）**，只是代码风格/资源独立有额外要求。

**① 放置与命名**
- 前端新组件：放 `src/bundle/*_components/` 内**新建文件**，用语义名（如 `_cmp_AssistantPanel.jsx`），复用现有 barrel 导出；**不要 import 顶层大 chunk**（TDZ 循环依赖）。
- 后端新逻辑：放 `localTool/src/**` 新建文件，语义名。
- 脚本：放 `scripts/**`。

**② 资源自包含（CSS / 图标）**
- **CSS 自包含**：组件内 `const STYLES = \`...\`` 定义 CSS 字符串（统一前缀），`<style>{STYLES}</style>` 注入；**禁止 Tailwind 任意值**（`gap-[16px]`/`text-[#e5e5e5]`），颜色 hex/rgba、字体/间距 px、伪类写 CSS 字符串里。
- **图标内联 SVG**：写进组件 JSX，不 `import` vendor 图标，不复用混淆 JS 里的 svg 别名（官方更新会重排失效）。
- **别改/依赖官方混淆 CSS**（`src/bundle/assets/` 的 `src-DoQUrSOl.css` 等，是官方产物 + `post-build-fixups` 引用）。

**③ 通信用事件总线**
- 新组件与已有混淆组件/`Vr.jsx` 之间状态同步：用 `window.dispatchEvent('yimao:xxxChanged')` 事件总线（调用点 ≤2 才用 props 回调）；**不要从新文件 import 混淆大组件**。

**④ 引用混淆符号**
- 若新组件要复用混淆模块的能力（如 `dr`/`lr`/`ar`）：**必须从同一个 `shared.js`/`component_map.json` 指定的文件 import**（同模块同实例），不能另起炉灶，否则句柄/状态绑定错。

**⑤ 验证**
- 仍走本 §三 流程：`npm run ask` 定位 → `npm run test:smoke` → `npm run build` 回灌 → `npm run map`（新增文件后更新检索地图）→ 真机走查。**真机验证不可跳过**（`test:smoke` 的 npm React 与 Chrome 的 vendor React 不等价）。

> 大段删除/替换（300+ 行）用 Node 脚本（`indexOf`+`substring` 定位），别用 `replace_in_file`（易上下截断错位）。

### 3.2 通用改动流程（①改混淆码 + ②新建自研 都走此验证）

**AI 每次改动后的默认自检**：`npm run test:smoke`（冒烟质量门，~194ms 极快，立即发现契约漂移/React 单实例破坏/chunk 完整性）。
**按需触发**：**改前**先 `npm run ask` 定位（短名/契约/文件是啥，见 §五.8）→ **改动完** `npm run test:smoke`，契约相关再 `npm run contracts`（漂移 FAIL 用 `--resnap` 重建基线）、需更新检索地图 `npm run map`；较大改动或环境异常时 `npm run health`（全量体检，0 错 0 警为佳）；预览走 `npm run dev`（开发服务器，非校验）。

**改前定位 + 改动完成后的完整验证流程**：

```
0. npm run ask               ← 改前先定位：短名/契约/功能是啥（必用，见 §五.8）
1. npm run test:smoke        ← 冒烟质量门（快速，每次改动都跑）
2. npm run build             ← 回灌 dist/（确认编译通过）
3. npm run map               ← 更新 AI 检索地图 + symbol_map.json（若新增/改动了文件）
4. npm run contracts         ← 契约漏改检测（若动了字符串契约）
5. npm run health            ← 全量健康度（较大改动或提交前）
```

> **命令速查**（`package.json`）：
> - **`npm run ask -- symbol|contract|file <关键词>`【必用】** = `node scripts/ai_ask.cjs`（AI 检索总入口：改码前遇到任何"是啥"先跑它）
> - `npm run test:smoke` = `node scripts/smoke_test.cjs`（改动后默认自检，快）
> - `npm run build` / `npm run map` / `npm run contracts`（单项按需，生成物重建）
> - `npm run health` = `node scripts/health-check.cjs`（全量体检，较大改动或提交前）

> 注：当前无 husky/pre-commit 强制钩子，验证靠自觉；`dist/` 手改按 §五.2 单独 commit 并注明授权。

### 3.3 localTool 改动必测（新增约定，2026-08-13）

> **凡改动 `localTool/src/**`（含方案② base64 外置/孤儿 GC），提交前必须跑 `cd localTool && npm test`**。脚本见 §七.2 速查。理由：方案②改变了 KV 入库行为（base64→`/files/` 磁盘文件），无测试无法保证不回归。

- **跑法**：`cd localTool && npm test`（= `tsc && node --test test/*.test.js`，先编译再测，73 项）。
- **覆盖面**（`localTool/test/` 两文件）：
  - `localtool.test.js`：本地/存储/文件链路——方案②、KV、Tasks、Resources、Admin、Files（含 upload multipart/thumbnail/move/mkdir）、Database（备份/导出/删除引用计数）、Platform、System（status/jianying）、helpers（含 SQL 注入防护）。
  - `localtool.network.test.js`：出站转发层（**mock `globalThis.fetch`**，不碰真实网络）——official（base 决策/缓存/invalidate/不伪造权限）、passthrough（本地不转发/流式回传）、agentChat（SSE 透传/非 SSE 包装）、system（proxy 剥信封/gatewayTask code 转换）、files 的 saveRemoteUrl 下载落盘。
- **隔离**：每个测试独立临时 `MAOMAO_DATA_DIR`，绝不触碰真实 `~/.maomao-localtool/`；`official.memCache` 为模块级单例，测试间用 `handleOfficialInvalidate` + 唯一 token 隔离。
- **测试发现的真 bug（2026-08-13）**：Node `Buffer.from(x,'base64')` 宽容忽略非法字符 → 非法 base64 被静默落盘成损坏文件。已加 `isValidBase64` 严格校验（`base64Externalize.ts`），失败回退保留原值。**改 base64 相关逻辑后务必重跑 `npm test`。**
- **边界**：真实官方/网关/LLM 端到端连通、`index.ts` HTTP 分发、official stale 降级（受 60s TTL 限制）不在单测内，需真机走查。

---

## 四、 关键技术机制

### 1. 同步与异步双模机制 (网关层)

* **异步（默认）**：提交后返回 `task_id`，调用方通过轮询或 webhook 接收结果（webhook 幂等去重）。
* **同步（规划）**：请求带 `wait:true`，内部复用轮询直至终态直接返回，自带超时（504），**必须保持异步为默认**。
* **独立聊天**：聊天 (`chat_completions`) 走内部 `run_and_get` 轮询，**绝对不经过**图片同步的 `_do_submit`。

### 2. 本地落盘与文件管理机制

* **唯一入口**：localTool 的 `/files/` 是唯一文件入口，Python 网关不直接落盘。
* **不丢图增强**：localTool 拿到 CDN url 后调 `saveRemoteUrl`（基于 `sha1(url)` 幂等）转存本地。
* **降级策略**：下载失败仍返回 CDN 链接 + WARN，**绝不抛 500 阻断生图**。
* **丢图留痕（2026-08-14）**：`saveRemoteUrl` 每次下载打 `[download]`（OK/FAIL/SKIP + 落盘路径）、`/api/files/upload` 打 `[upload]`（200/400）日志（`localTool/src/routes/files.ts`）。**"生成图显示在画布但资源面板没有"通常是下载失败降级为远程 URL 未本地化**——先用 `npm run db -- --lost-check` 查，日志看 `[download] FAIL`。常见外因：CDN（`a.lovart.ai`）需代理才能访问，VPN/代理抖动时偶发超时。
* **出站代理（2026-08-02）**：localTool 是独立 Node 进程，原生 `fetch` **不继承浏览器/系统代理**。若外部 CDN（如 Lovart `a.lovart.ai`）在本机需经代理才能访问，`saveRemoteUrl` 直连会超时 → 表现 `POST /api/files/upload 400`。统一封装 `localTool/src/utils/netProxy.ts` 的 `fetchWithProxy`：**直连优先 → 失败读代理环境变量（`HTTPS_PROXY`>`HTTP_PROXY`>`ALL_PROXY`，大小写兼容）→ 无则探测本机常见代理端口（`7897/7890/1087/1080/8888/8118`）→ 用 `node:https`+`tls.connect` CONNECT 隧道经代理重试**。本地目标（`127.0.0.1`/`localhost`/内网）永不走代理。适用点：`files.ts` 的 `saveRemoteUrl`（下载 CDN 图）与 `handleReadProxy`（`x-proxy-url` 外部代理读）；`/api/proxy`→`:9004`、`official.ts`/`passthrough.ts`→官方（直连可达）**不涉及**。

---

## 五、 开发红线与规范

### 5.1 绝对禁区 🚫

* **端口与入口**：禁止改 `18080`/`9004` 端口；禁止改 `proxyMode=local-tool` 唯一入口。
* **VPN 前置**：连 Lovart (`lgw.lovart.ai:443`) **必须开 VPN**，否则网关静默 502，非代码问题。
* **溯源铁律**：讨论报错/模型归属必须标清来源（localTool / 网关 / 官方 1mao / kkidc），禁止"后端返回"式含糊。

### 5.2 `dist/` 前端修改规程

* **禁止直接手改 `dist/`**：`dist/` 是 `src/bundle/` 的构建产物，**前端改动一律改 `src/bundle/` 后 `npm run build` 回灌**（见 §五.4）。任何情况下都不得直接编辑 `dist/` 混淆产物。
* **定位：官方包 + 我们的最小改动**。`src/bundle/` 是「官方发行 dist 经还原流水线的基线」叠加「我们的最小改动」。我们的目标是对官方包做**最小**改动，而非另起炉灶。
* **每次改动必须记录**：任何对 `src/bundle/` 的修改都要在 `docs/` 下（或改动文件顶部注释）登记——改了哪个 chunk、哪一行、原始混淆符号、改动目的、影响的运行时行为。这是官方更新时「重打补丁」的唯一依据（见 §五.4 ⑧）。
* **官方更新 = 重打补丁**：官方发新版时，重新拉官方 dist → 跑还原流水线生成新基线 → 依据变更记录把我们的每处最小改动**逐一重新打上**（混淆符号可能已重排，需重新对照，禁止直接套用旧映射）。

### 5.3 逆向源码与还原脚本红线 🚫

* **运行与源码关系**：运行时只认 `dist/`；`src/bundle/` 是可编辑源码，`npm run build` 编译回灌 `dist/`（见 §五.4）。
* **还原脚本边界**：还原/拆包/重命名脚本已归档到 `scripts/archived/`（`rename-pipeline/`：`scope_rename_plugin.cjs`/`jsx_restore_plugin.cjs`/`name_rules.cjs` 等；`beautify/`：`beautify.cjs`/`beautify-dist.cjs`；`one-off/`：`split_js.py`/`advanced_format.js`；`reverse-helpers/`：`gen_map.cjs`），均属一次性逆向产物，非运行流水线；离线分析中间产物集中在 `docs/逆向专用_ai 禁止读/`。
* **AI 禁止读目录**：`docs/逆向专用_ai 禁止读/` 明确标注「AI 禁止读」，AI 助手默认不读取该目录，仅在需要时引用其存在，不展开其内容。
* **混淆符号随官方版本变动**：官方每次发新版，还原出的变量名/组件名可能整体重排。我们的最小改动钉在特定混淆符号/行号上，**官方更新重打补丁时必须重新对照现版本，禁止直接套用旧映射**（见 §五.2 定位与 §五.4 ⑧）。

### 5.4 `src/bundle/` 可编辑化改造规范（改「官方混淆码」专用，适配 gougou 铁律）

> 本节规范**只针对「改动 `src/bundle/` 内既有的官方混淆码」**（§三 3.0 场景①）。**若是新建自研组件/模块，走 §三 3.1（新建自研 SOP）**，不必受"最小差异/混淆留痕/重打边界"约束（那是改官方代码的红线）。

`src/bundle/` 已支持 `npm run build` 直接回灌 `dist/`（Vite + `post-build-fixups` 自动补图标/CSS 引用/CSP）。改造遵循以下铁律（借鉴 gougou 反编译还原工程化经验）：

1. **被高频依赖的共享函数不可从 chunk 抽取**（打乱 vendor 初始化 → `Rr is not a function` / `Bd is not a function`）。新增逻辑优先走 `*_components/` 内新建文件，或复用现有 barrel，不直引大 chunk。
2. **禁止新文件 `import` 顶层 chunk 大文件**（循环依赖 → TDZ）。跨 chunk 引用走 `component_map.json` 指定的目标文件。
3. **整块迁移几千行必翻车**（store+helper 不可分割）；拆改只做最小差异（diff ≤ 30 行，见 §五.6）。
4. **React 单实例不可破**：`_react_shim.js` / `_jsx_runtime.js` 经 `vite.config.ts` 的 `resolve.alias` + `dedupe` 绑定到 vendor 工厂，✗ 不可删除/改写/新增独立 react 实例。
5. **字符串契约零损伤**（见 §五.7/§五.8）：画布硬编码读 `t.data[0].url`、`{code,data}` 信封、`proxyMode=local-tool` 等契约值，改任何引用必须全量 grep 同步。**辅助工具**：改前 `npm run ask -- contract <键>` 确认影响面，改后跑 `npm run contracts` 校验全端同步（漂移即 FAIL）。
6. **混淆留痕 + 变更登记**：每处反直觉改动立即注释语义 + 原名（如 `// ol = tasks 数组, shared.js L247`，不设 deadline）；同时按 §五.2 的「变更记录」要求在 `docs/` 登记该改动，作为官方更新重打的依据。
7. **改前建基线 / 改后比对**：改前跑 `npm run test:smoke`（即 `node scripts/smoke_test.cjs`）记录基线；改后必须重跑，确保 `checkImportGraph`（chunk 引用不悬空）+ `checkContracts`（契约漂移）+ `checkDistDuplicateChunks`（React 单实例）全 PASS，再 `npm run build`。`checkReadableParity` 为**可选项**：`readable/` 是已归档 `rename-pipeline` 的只读阅读副本（`name_rules` 空跑 no-op，不参与构建回灌），缺失时该检查仅 WARN 不阻断。
8. **官方更新重打流程**：官方发新版 → ① 拉新 dist，跑还原流水线（`archived/rename-pipeline/`）生成新 `src/bundle/` 基线；② 取出 §五.2 登记的我们的最小改动清单；③ 逐条对照**新版本**的混淆符号/行号重新打上（禁止直接 `git apply` 旧 diff，符号已变）；④ 重跑 `npm run test:smoke` + `npm run build` + `npm run health` + 真机走查。

9. **降低复杂度优先**：凡是能减少代码复杂度、又不引入 bug 的改动都要做——包括但不限于把混淆短名（`_st`/`R`/`Dl` 等本地可改的）改为语义长名、抽公共逻辑、删冗余分支。被 `component_map.json`/运行时契约钉死、改动会破坏引用的除外。**改完必须 `npm run build` 验证回灌 `dist/` 成功。**

> 验证链路：`src/bundle/` 改完 → `npm run test:smoke`（快速自检）→ `npm run build`（回灌 `dist/`）→ 按需 `npm run map`/`npm run contracts` → 较大改动 `npm run health`（全量）→ 浏览器真机走查（见 §三）。

### 5.5 卡帕西编码准则 (Karpathy Rules)

* **奥卡姆剃刀**：如无必要，勿增实体（依赖/文件/端点）。多解释并存取假设最少的一条。
* **精准修改**：只碰必须碰的，清理孤儿代码，每行修改可追溯明确目的。
* **目标驱动**：任务转可验证目标，拆解执行。

### 5.6 最小差异提交

* 每次 commit 的 diff 尽量 ≤ 30 行；多步改动拆成单文件独立 commit，便于 `git reset --hard HEAD~1` 回退。
* 每写一处反直觉/绕开混淆的代码，立即注释原因（如 `// 绕开 dist 硬编码读 t.data[0].url`）。

### 5.7 字符串契约零损伤

以下前后端契约值一字不差，改任何引用必须全量 grep 同步，禁止局部替换漏网：
- `proxyMode=local-tool`、`127.0.0.1:18080`、`127.0.0.1:9004`、`/api/proxy`、`x-proxy-url`
- 画布硬编码字段：`t.data[0].url`、`{code,data}` 信封结构、SSE 事件格式
- 模型别名映射（网关 `lovart_client.py` 内的工具名 ↔ Lovart 工具名）

### 5.8 契约字典与地图工具（AI 防漏改辅助）

`src/bundle/` 为混淆还原代码，AI 改动极易「改一处漏一处」。配套工具（零运行时依赖，随代码重跑）：

- **`npm run ask`（`scripts/ai_ask.cjs`）——【必读必用】**：AI 检索**总入口**，遇到任何"短名/契约/功能是啥"的疑问，跑它一条命令出人话答案，不用自己 parse JSON。三种查询：`npm run ask -- symbol <短名>`（符号用途+落点）、`-- contract <键>`（契约影响面）、`-- file <关键词>`（相关文件）。**改 `src/bundle/` 前不确定任何东西，先跑它。**
- **`BUNDLE_MAP.md` / `symbol_map.json`**：`npm run map` 自动生成的地图（文件级特征/高危/同名影子/功能域/符号索引）。`npm run ask` 的数据源；要读全貌才直接看它们。**禁止手改。**
- **`CONTRACTS.md` + `scripts/contracts.json` + `contract_scan.cjs`**：跨端字符串契约字典与漂移检测（`npm run contracts` 质量门，命中数变化即 FAIL）。`npm run ask -- contract` 的数据源。
- **`scripts/smoke_test.cjs`** 已接入 `checkContracts`（契约漂移）与 `checkDistDuplicateChunks`（React 双实例/Vite 重复 chunk），提交前验证链路见 §三。

> **铁律：BUNDLE_MAP.md / CONTRACTS.md / symbol_map.json 一律由工具重建，禁止手改。** 这三份是自动生成物，手改会被下次 `npm run map` / `npm run contracts -- --md` 覆盖，且会漏掉自动检测（如同名影子文件扫描、符号级反查）。要改地图内容，改 `scripts/gen_bundle_map.cjs` 或 `scripts/contract_scan.cjs` 后重跑。其中第六章「同名影子文件警示」由生成器自动扫描 `src/bundle/` 跨目录同名文件得出（如 `shared.js` 4 处、`Tr.jsx` 等各 2 处），是防「改一处漏一处」的最高危提示，勿删。

---

## 六、 运维排障速查 (Quick Reference)

### 1. 启动方式

* **一键启动 (推荐)**：先开 VPN。
  * Windows: `powershell -ExecutionPolicy Bypass -File .\launch-all.ps1 2`
  * Mac: `./launch-all.command`
* **独立调试**：
  * localTool: `cd localTool && npm run build && node dist/index.js`
  * 网关: `cd apimart-gateway && python -m uvicorn main:app --host 127.0.0.1 --port 9004`

### 2. 常见问题速查

* **网关 502**：先查 VPN 是否连通 `lgw.lovart.ai:443`。
* **字段对不上**：画布硬编码读 `t.data[0].url`，需在 localTool 侧剥 `{code,data}` 信封对齐。
* **接口契约**：查 `01-接口兼容性审计.md.bak.md` + 分析 `dist/` 调用。
* **反混淆排障**：`scripts/archived/` 下 `one-off/advanced_format.js`(webcrack) / `beautify/beautify.cjs`(Prettier) 离线分析（已归档，一次性），`src/bundle/` 为还原产物，**严禁回写主分支作为运行产物**；还原中间产物见 `docs/逆向专用_ai 禁止读/`（AI 禁止读）。

### 3. 缓存清理（遇到怪事先清缓存）

> 排障**首选步骤**：遇到登录异常 / 模型列表异常 / 图生图异常 / 接入点残留等「说不清的怪事」时，先跑清理脚本重置缓存，再判断是否真 bug。脚本只删缓存类 KV，**保留画布数据/登录凭证/项目**（详见脚本头部安全边界）。

```bash
# 清理缓存类 KV（默认安全：img_* 图片缓存、接入点、同步元数据、版本标记）
node scripts/clear-cache.cjs
# 先预览有哪些 KV 键（标 🔒业务 / 🟡缓存），不删除
node scripts/clear-cache.cjs --list
# 只删指定 key（如接入点，曾致登录回环，见 docs/01 变更#1）
node scripts/clear-cache.cjs --kv=active_api_endpoint
```

配套（`localTool` 侧）：
* `GET  /api/admin/kv-list`：列出所有 KV 键。
* `POST /api/admin/clear-cache`：按缓存前缀精准删 KV（`confirm:true` 才执行），保留 `canvas-state-v1-*`/`auth_token`/`projects` 等业务键。
* **`clear-cache` 接口需 localTool 为 build 后的新版**（改过 `localTool/src` 需 `npm run build` + 重启生效）。

若清完缓存仍异常：**重启 localTool**（清空 `official.ts` 进程内官方权益内存缓存 `memCache`），`./launch-all.command 2`（Mac）/ `launch-all.ps1 2`（Win）。

---

## 七、 文档导航与场景速查

### 1. 文档导航（信任度）

| 文档 | 用途 | 信任度 |
|---|---|---|
| `docs/01-接口兼容性审计.md.bak.md` | 前后端契约海关审计 | 🟢 高 |
| `docs/02-断点三域梳理.md` ~ `docs/21-*.md` | 断点/方案/进度系列（21 篇） | 🟡 中（部分已落地，部分规划） |
| `docs/27-AI操控画布-定稿方案.md` | AI 操控画布（权威专题） | 🟢 高 |
| `docs/31-自研节点接入指南-引子.md` | 自研节点接入（专题） | 🟢 高 |
| `docs/33-剧本盒子探索.md` | 剧本盒子总览（专题） | 🟢 高 |
| `docs/34-素材系统与落盘rescan专题.md` | 素材/落盘/rescan（专题） | 🟢 高 |
| `docs/35-缩略图实现机制探索.md` | 缩略图机制（专题） | 🟢 高 |
| `docs/18-节点组件契约表.md` / `docs/18-事件总线字典.md` / `docs/18-KV存储键读写面梳理.md` | 三类契约事实表（专题） | 🟢 高 |
| `docs/36-AI可读性架构优化探索.md` | AI 可读性架构优化方向稿（P1 已落地：symbol_map.json + BUNDLE_MAP 第八章符号级索引） | 🟢 已部分落地 |
| `daily/2026-08-01.md` / `daily/2026-07-31.md` | 执行日志 | 🟢 高 |
| `docs/逆向专用_ai 禁止读/` | 还原方法论与中间产物 | 🚫 AI 禁止读 |
| `npm run ask`（`scripts/ai_ask.cjs`） | **【必用】** AI 检索总入口（symbol/contract/file 三查，问即答） | 🟢 工具 |
| `src/bundle/BUNDLE_MAP.md` + `symbol_map.json` + `AI_NAVIGATION.md` | 自动生成地图族（`npm run map` 产出；文件特征/符号/导航）。一般经 `npm run ask` 取用，需全貌才直读 | 🟢 自动生成 |
| `CONTRACTS.md` + `scripts/contracts.json` + `contract_scan.cjs` | 契约字典 + 分布 + 漂移检测（`npm run contracts` 质量门） | 🟢 权威 |
| `src/bundle/*_components/component_map.json` | 混淆名→文件名映射（还原/跨 chunk 引用溯源） | 🟡 字典级 |
| `npm run test:smoke` / `npm run health` | 改动后自检 / 全量体检 | 🟢 工具 |

> 读 `docs/` 任意方案前先确认其状态是「已完成」还是「规划中」，避免把规划当现状。

### 2. 场景速查表

| 场景 | 做法 |
|---|---|
| 要加平台接口（替代官方 1mao） | 改 `localTool/src/routes/`（builtin/models/manifest/sync），返回本地静态兜底 |
| 要改代理/转发逻辑 | `localTool/src/routes/system.ts`（`/api/proxy` 剥信封/SSE/异步转同步） |
| 要接新模型/视频能力 | 改 `apimart-gateway/lovart_client.py` 别名映射与规范化 |
| 要查官方权益转发 | `localTool/src/routes/official.ts`（中转+短缓存，不伪造权限） |
| 要改画布前端 | 先 `npm run ask` 定位 → 改 `src/bundle/` → `npm run test:smoke` → `npm run build`（回灌 dist）→ 按需 `npm run health`（见 §五.4）；严禁直接手改 dist |
| 要看画布可读源码 | `src/bundle/`（可编辑工程源码，改完 build 回灌） |
| 改 localTool 后端（含方案② base64 外置/孤儿 GC） | `cd localTool && npm test`（73 项，先编译再测；隔离临时库，不碰真实数据） |
| localTool 库膨胀需压缩 | 停 localTool 后跑 `cd localTool && npm run db:vacuum`（即 `node scripts/db-query.mjs --vacuum`，自动备份+完整性校验+VACUUM） |
| 想查 localTool 数据库 | `cd localTool && npm run db -- --tables/--table/--sql/--kv/--search`（`localTool/scripts/db-query.mjs`，只读，支持 `--json`） |
| 查 localTool 日志 | `cd localTool && npm run db -- --logs [download\|upload\|proxy\|error\|...]`（按前缀/关键词过滤，自动高亮异常） |
| **丢图排查主入口** | `cd localTool && npm run db -- --lost-check`（tasks 远程URL未落盘 / 失败任务 / 磁盘↔资源一致性 / 日志下载失败与上传400 一次列全）或 `npm run db -- --task <node_id>` 看单节点各任务结果形态 |
| localTool 全部脚本清单 | `localTool/scripts/README.md` |
| VPN/502 排障 | 先 `ping lgw.lovart.ai:443` 确认 VPN |
| 提交前验证 | 前端 `npm run test:smoke`+`npm run build`；**localTool 改动另跑 `cd localTool && npm test`**（见 §三.3） |
