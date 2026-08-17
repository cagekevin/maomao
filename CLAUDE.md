# CLAUDE.md · 猫猫画布（React 原型 + 自研后端）

> **本文件定位：项目认知入口。每个 AI 进来第一步读它**，了解"这是什么项目、技术栈、架构、目录、红线、怎么启动"。
> 读完按任务再读对应入口：**写代码 → `spec/CONTEXT.md`（决策地图）**；**写/改测试 → `spec/TESTING.md`（测试权威）**。三文件互补不重叠（见 §七.0）。
> **最后更新**：2026-08-15（主力开发为 `src/` 可维护原型；原产品混淆还原代码仅作只读参考，逆向脚本已归档 `scripts/1mao-scripts/`）

## ⚠️ 最新情况（改动前必读）

**主力开发是 `src/` 可维护 React 原型**（Vite + React + `@xyflow/react` 画布），不是原产品混淆还原代码。结构：

```
本目录（新建文件夹，正式工程）
├── src/                        ← 【主力】可维护原型（App.jsx / components/ / base/…）
├── public/                     ← 静态资源
├── index.html + vite.config.js + tailwind.config.js + package.json
├── scripts/                    ← 测试地基（smoke/regression/tools/health-check），见 scripts/README.md
├── spec/                       ← 🏛️ 权威规范（永不误删）：CONTEXT.md（写码决策）/ TESTING.md（测试）/ NEW-NODE-GUIDE.md / 横切分层 / 代码组织
├── docs/                       ← 临时/历史文档（调查产物，可过时可清理，不维护）
└── reference-1mao/             ← 【只读参考】原产品混淆还原代码（查实现用，不直接改）
```

### 改代码入口
- **主力开发/使用**：改本目录 `src/`（原型）。
- **查原产品怎么实现某功能**：看 `reference-1mao/`（混淆还原代码，作参考，已归档逆向脚本在 `scripts/1mao-scripts/`）。

### 常用命令
```bash
npm run dev           # 开发服务器（默认 5180）
npm run build         # 构建校验 + 回灌 dist/
npm test              # 统一测试门禁（= test:all：smoke + vitest全量单测 + regression + tools）
npm run test:unit     # vitest 全量单元测试（tests/unit/ 下 24 文件/244 用例，今天补的主力验证）
npm run test:smoke    # AI 默认自检：冒烟质量门（极快）
npm run check:health  # 工程健康全量检查
npm run type-check    # tsc --noEmit 类型检查（仅校验 .ts/.tsx，渐进式 strict）
```

### ⚠️ 查任务/查图/查视频铁律（改这些 bug 前必跑，不要自己造查询）

> **用户说「查一下这个任务 / 查这张图 / 图丢了 / 刷新没图 / 丢图」→ 第一件事跑这个脚本**，别去硬读代码猜：

```bash
cd localTool
node scripts/task-inspect.mjs <id>              # 直接贴 id 查全链路（id 可为 task_id / thread_id / node_id）
node scripts/task-inspect.mjs --consistency     # 三层一致性断言：画布↔任务中心↔磁盘（定位刷新丢图/错位）
node scripts/task-inspect.mjs --lost-check      # 全库丢图体检
node scripts/task-inspect.mjs --canvas-health   # 画布结构体检
```

**脚本 `task-inspect.mjs` 名字就是「查任务」**，AI 听到"查任务"就对得上。它会自动判定 id 类型并拉出数据库+后端日志+前端日志全链路。**禁止**在查任务时去翻 `taskStore.js`/`tasks.ts` 硬猜断点——先跑它拿真实数据再定位。

### 注意
- 下方 §〇~§七 是**通用工程规范 + 原型架构**，与 `src/` 直接相关。
- `reference-1mao/`、`localTool`、`apimart-gateway` 分别是「逆向参考」与「自研后端」，查后端实现时用对应目录，不要和前端原型混淆。
- 原产品逆向方法论与中间产物在 `docs/逆向专用_ai 禁止读/`（标注「AI 禁止读」，默认不读）。

---

## 〇、 写给后续 AI 的写作铁律（最高优先）

**本项目约 90% 的代码与文档是写给后续 AI 的，不是给人看的。** 默认读者是下一个 AI。做到：

- **真实不误导**：文档与代码现状一致，宁可少写不写错；标注"已完成/规划中/已失效"，禁止把过时结构（旧 `src/bundle`、已归档脚本）写成现状。
- **简洁**：最少字传达必要信息，不写流水账/客套/重复。
- **精确**：脚本、文件、npm 命令必须是仓库真实存在的，已归档的写 `1mao-scripts/` 或 `archived/`。
- **留痕**：反直觉改动立即注释"语义 + 原始混淆名/来源"（见 §五.4）。

### 〇.1 沟通铁律（回复用户/给方案时，最高优先）

> 本组规则针对 AI **回答用户、给方案、汇报进度**时的输出。原则：**先给动作，再给解释；能一步说清不写两段；说完了就停。**

1. **第一行给下一步动作**：开头是可执行命令/文件路径/结论，不是"让我看看/好的/我来分析"式铺垫。
2. **多步任务编号**：步骤 >1 就写成 `1. 2. 3.`，每步一个动作，不做无谓拆分。
3. **结尾给一个下一步**：若有事未了，收尾给 ONE 个 ≤2 分钟能做的动作；不写"还需要我做什么吗""希望有帮助"。
4. **砍跑题**：一个事说完再提下一个，第 2 个问题单独问，不塞同一段。
5. **每轮重述状态**：多步工作汇报时先说"第 N/M 步完成"。有任务列表工具时用它维护进度，一条一步、同时只有一个 in-progress。
6. **具体时间/范围预估**：说"约 15 分钟 / 改 3 处"，不说"一会儿 / 一些工作"。
7. **成果可见**：做完直接说"现在能跑 `npm run build`"，不把结果埋进长段总结。
8. **错误就事论事**：报错直接说"原因 + 修法"，不说"哎呀 / 似乎有问题"。
9. **列表 ≤5 项**：超 5 项拆"先做/后做"或"必做/可选"，不一次性堆 10 条。
10. **禁废话**：删掉开场客套、结尾客套、无信息量副词、套话比喻。有真实不确定才用"可能"。

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

* **项目本质**：高保真复刻「猫猫画布」的 **React 原型**，前端为可维护工程（`src/`）；后端复用自研的 `localTool`（`:18080`）与 `apimart-gateway`（`:9004`）替代官方闭源引擎，实现多端合一。

* **当前进度**：
  * **已完成**：`src/` 原型骨架（画布 + 节点体系 + 通用能力地基 `base/`）；`localTool` 已承担前端托管、请求代理、本地存储及生图异步转同步；`apimart-gateway` 已承担 Lovart 中继、聊天同步、图视异步、webhook 及自动确认。
  * **进行中**：节点体系补全 + 通用能力地基打磨；网关原生双模（同步/异步）改造、落盘转存增强。
  * **历史归档**：`reference-1mao/` 为官方混淆 `dist/` 逆向还原的可读源码（查实现用，不直接改）；逆向流水线脚本已归档到 `scripts/1mao-scripts/`。

---

## 二、 前端原型架构

* **技术栈**：Vite + React 18 + `@xyflow/react`(React Flow) + Tailwind。开发服务器 `localhost:5180`。
* **入口**：`src/main.jsx` → `src/App.jsx`。
* **节点体系**：`src/components/*.jsx`，每个节点一个文件（如 `TextNode`/`ImageNode`/`PromptNode`/`DiscountVideoNode`/`VideoExtract`/`ImageBox`/`GridSplit`/`GridMerge`/`VideoProcess`/`Group`/`ScriptBox`/`GhostTarget`）。**新增节点权威流程 → `spec/NEW-NODE-GUIDE.md`**（NodeShell 外壳 + 4 处注册同步 + NODE_OUTPUTS 管线契约，顶层规则见 `spec/CONTEXT.md` §一·5）。
* **通用能力地基**：`src/components/base/`（`NodeShell` 统一外框、`CanvasToolbar`、`useArrangeCanvas`、`useCanvasAgentTools` 脚本盒引擎、Toast、ImageEditor、OverlayEditor、设置面板、AI 助手面板 AgentPanel 等）。
* **设计语言**：参照 `docs/BASE-CAPABILITIES.md`；节点视觉/交互规范见 `docs/README.md`「节点设计规范」。
* **运行形态**：Chrome 扩展（MV3）。`public/manifest.json` + `background.js` + `icon*.png` 为插件壳；`src/` 编译后由 `vite.config.js`（`base:'./'`，兼容 `chrome-extension://`）打包进 `dist/`。存储经 `src/components/base/contentStore.js`（横切存储权威入口，按 STORAGE_KEYS 自动路由 local/KV/native，底层 `storageAdapter.js` 走 `chrome.storage` 插件环境）。`npm run dev` 预览画布，`npm run build` 出 `dist/`。

> 与 history 区别：旧版 `src/bundle/` 是混淆还原源码；当前 `src/` 是直接可读可维护的工程，构建产物仍是 Chrome 扩展 `dist/`。

---

## 三、 修改代码步骤与提交前验证流程（不跑不许提交）

### 3.1 改动流程（通用，所有 `src/` 改动都走）

**AI 每次改动后的默认自检**：`npm run test:smoke`（冒烟质量门，极快，立即发现契约漂移/React 单实例破坏/chunk 完整性）。

**完整验证流程**（较大改动或提交前）：

```
0. npm run dev           ← 预览改动（非校验）
1. npm run test:smoke    ← 冒烟质量门（每次改动都跑，默认自检）
2. npm run test:unit     ← vitest 全量单元测试（tests/unit/ 下 24 文件/244 用例；
                           剧本盒引擎/AI 工具/纯函数等改动必跑，今天补的主力验证）
3. npm run build         ← 构建校验 + 回灌 dist/（确认编译通过）
4. npm run test:regression ← 节点注册表 + 脚本盒引擎回归（改了节点/引擎跑）
5. npm run test:tools    ← 画布 Agent 工具验证（改了 agent 工具跑）
6. npm run check:health  ← 全量健康度（较大改动或提交前，0 错 0 警为佳）
```

> 命令速查（详见 `spec/TESTING.md`，权威）：**`npm test`（= `npm run test:all`）= 冒烟 + vitest 全量单测 + 回归 + Agent 工具** 四件套一次跑完，提交前首选；单项：`npm run test:smoke`（冒烟）/`test:unit`（vitest 单测）/`test:regression`（SSR 回归）/`test:tools`（Agent 工具）；`npm run check:health` 全量编排（含构建 + 测试 + TDZ + dist 基线）。
> 提交前 `pre-commit` 钩子自动跑 `type-check`；`main` 分支的 push/PR 由 `.github/workflows/ci.yml` 云端跑 type-check + 单测。lint 已移除（弊大于利，门禁靠类型检查 + 测试）。
> **写完代码跑哪个**：平时 `npm run type-check` + `test:unit`；改画布/地基或合 main 前再跑 `npm test` 全量兜底（regression/tools 已含在内）。

### 3.2 localTool 改动必测

> **凡改动 `localTool/src/**`，提交前必须跑 `cd localTool && npm test`**（先编译再测，全量用例覆盖 localtool.test / localtool.network / providers 三个文件，隔离临时库不碰真实数据）。理由：方案②改变了 KV 入库行为（base64→`/files/` 磁盘文件），无测试无法保证不回归。详见 `localTool/scripts/README.md`。

---

## 四、 关键技术机制（后端）

### 1. 同步与异步双模机制 (网关层)

* **异步（默认）**：提交后返回 `task_id`，调用方轮询或 webhook 收结果（webhook 幂等去重）。
* **同步（规划）**：请求带 `wait:true`，内部复用轮询直至终态直接返回，自带超时（504），**必须保持异步为默认**。
* **独立聊天**：`chat_completions` 走内部轮询，**绝对不经过**图片同步的提交路径。

### 2. 本地落盘与文件管理机制 (localTool)

* **唯一入口**：localTool 的 `/files/` 是唯一文件入口，Python 网关不直接落盘。
* **不丢图增强**：localTool 拿到 CDN url 后 `saveRemoteUrl`（基于 `sha1(url)` 幂等）转存本地。
* **降级策略**：下载失败仍返回 CDN 链接 + WARN，**绝不抛 500 阻断生图**。
* **丢图排查主入口**：`cd localTool && npm run inspect -- --lost-check`；日志看 `[download] FAIL`。外因多为 CDN 需代理/VPN 抖动。
* **图片/视频生命周期排查主入口（查图/视频/任务/日志/全链路，一律用这个脚本 `task-inspect.mjs`）**：
  ```bash
  cd localTool && node scripts/task-inspect.mjs --lifecycle <id>
  ```
  id 三种都可：`task_id`（`task_xxx`）/ **`thread_id`**（Lovart 上游"室外 ID"，即 task_id 去掉 `task_` 前缀）/ `node_id`。脚本自动判定，用 `thread_id` 或 `task_id` 时把「数据库完整记录 + 网关后端日志 + 前端上报日志」全链路一次拉出（`[poll]` 记 `thread=xxx`、`[submit]` 记 `task_id=task_xxx`，双键匹配）。
  > **强调：排查图/视频/任务就用它，不要自己造查询。** 它覆盖：单任务全链路 `--lifecycle`、按节点比对 `--task`、**三层一致性断言 `--consistency [proj]`（画布↔任务中心↔磁盘，定位刷新丢图/错位）**、丢图体检 `--lost-check`、画布体检 `--canvas-health`、日志过滤 `--logs`、全局搜 `--search`、任意 SQL `--sql`。

* **查任务全链路三步走（前端可见 ID 贯穿到 Lovart 状态）**：
  前端任务中心的 `task_id`（用户可见）就是贯穿主 ID。链路已打通：前端 `proxyRequest` 带 `taskId` → localTool `/api/proxy` 读它并透传网关 → 网关返回 Lovart `thread_id` → localTool 把「前端 task_id ↔ thread_id」关联落库（`tasks` 表 `thread_id` 列）。三步查询：
  1. **用前端 task_id 查关联 + 全链路**：`node scripts/task-inspect.mjs --lifecycle <前端任务中心显示的id>` → 得到 `thread_id`。
  2. **拿 thread_id 查任务是否结束**：`LOVART_ACCESS_KEY=ak LOVART_SECRET_KEY=sk HTTPS_PROXY=http://127.0.0.1:7897 node scripts/task-inspect.mjs --lovart-status <thread_id>`（自动走代理，连 Lovart `/chat/status`）。
  3. **拿 thread_id 查任务结果（出图 URL/文本）**：同上命令换 `--lovart-result`（连 `/chat/result`）。
  > 凭据与代理端口从网关进程 env 取（`ps eww $(lsof -tiTCP:9004 -sTCP:LISTEN | head -1)` 里 `LOVART_ACCESS_KEY/LOVART_SECRET_KEY`，代理用 7897）；连 Lovart 必须开 VPN/代理，脚本已内置代理探测（`HTTPS_PROXY` 等环境变量 + 常见端口）。
* **出站代理**：localTool 原生 `fetch` 不继承系统代理；经 `localTool/src/utils/netProxy.ts` 的 `fetchWithProxy`（直连→环境变量→探测本机代理端口→隧道）兜底。

> 前端原型（`src/`）通过 `proxyMode=local-tool` 把所有请求打到 localTool `:18080`，再由 localTool 转发网关 `:9004` → Lovart（需 VPN）。

---

## 五、 开发红线与规范

### 5.1 绝对禁区 🚫

* **端口与入口**：禁止改 `18080`/`9004` 端口；禁止改 `proxyMode=local-tool` 唯一入口。
* **VPN 前置**：连 Lovart (`lgw.lovart.ai:443`) **必须开 VPN**，否则网关静默 502，非代码问题。
* **溯源铁律**：讨论报错/模型归属必须标清来源（localTool / 网关 / 官方 / kkidc），禁止"后端返回"式含糊。

### 5.2 变更记录留痕

* 任何反直觉/绕开既有逻辑的改动，在改动处立即注释「语义 + 原始混淆名/来源」（如 `// ol = tasks 数组，来自 H_.jsx`，不设 deadline）。
* 跨大块改动（新增/删除节点、改脚本盒引擎）在 `docs/` 或改动文件顶部登记：改了哪、原始来源、目的、影响运行时行为。是后续对照 `reference-1mao/` 的唯一依据。
* **禁止直接手改 `dist/`**：`dist/` 是 `src/` 的构建产物，前端改动一律改 `src/` 后 `npm run build`。

### 5.3 参考代码边界 🚫

* `reference-1mao/` 是官方混淆还原的**只读参考**，查"原产品怎么实现某功能"用，不直接改、不把它的混淆符号当运行契约钉死。
* `scripts/1mao-scripts/` 是已归档的逆向/扩展脚本，默认不跑。
* `docs/逆向专用_ai 禁止读/` 明确标注「AI 禁止读」，默认不读取，仅引用其存在。

### 5.4 复用规则（原型内）

1. **共享函数不随意从模块抽取**：被高频依赖的基座函数（如 `NodeShell`、`useArrangeCanvas`）改动需评估下游，避免破坏引用。
2. **禁止新文件循环 import 大模块**（TDZ）：跨模块引用走既有 barrel / 已导出符号。
3. **React 单实例不可破**：整工程唯一 React 实例，✗ 不可新增独立 react/react-dom 实例。
4. **字符串契约零损伤**（见 §五.5）：`proxyMode=local-tool`、`127.0.0.1:18080`、`127.0.0.1:9004`、`/api/proxy`、`x-proxy-url`、画布硬编码字段 `t.data[0].url`、`{code,data}` 信封——改任何引用必须全量 grep 同步。
5. **降复杂度优先**：能减少复杂度又不引入 bug 的改动都做（混淆短名改语义长名、抽公共、删冗余），被运行时契约钉死的除外。改完必须 `npm run build` 验证。

### 5.5 卡帕西编码准则 (Karpathy Rules)

* **奥卡姆剃刀**：如无必要，勿增实体（依赖/文件/端点）。多解释并存取假设最少的一条。
* **精准修改**：只碰必须碰的，清理孤儿代码，每行修改可追溯明确目的。
* **目标驱动**：任务转可验证目标，拆解执行。

### 5.6 最小差异提交

* 每次 commit 的 diff 尽量 ≤ 30 行；多步改动拆成单文件独立 commit，便于 `git reset --hard HEAD~1` 回退。
* 每写一处反直觉/绕开既有逻辑的代码，立即注释原因。

### 5.7 字符串契约零损伤

以下前后端契约值一字不差，改任何引用必须全量 grep 同步，禁止局部替换漏网：
- `proxyMode=local-tool`、`127.0.0.1:18080`、`127.0.0.1:9004`、`/api/proxy`、`x-proxy-url`
- 画布硬编码字段：`t.data[0].url`、`{code,data}` 信封结构、SSE 事件格式
- 模型别名映射（网关 `lovart_client.py` 内的工具名 ↔ Lovart 工具名）

---

## 六、 运维排障速查 (Quick Reference)

### 0. 画布问题排查铁律（最高优先，先对齐再回应）

> 用户报**画布任何问题**（节点缺失/错位、连线异常、边 id 报错、key 警告、布局、保存异常等），AI **必须先跑**
> `cd localTool && node scripts/task-inspect.mjs --canvas-health [projectId]`
> 拿到当前画布**真实数据结构快照**（节点数/边数/类型分布/无 id 边/重复 id 边/悬空边），再回应用户。
> 禁止在没查画布状态前直接猜测或下结论（避免「用户说 A、AI 说 B」）。
> - `--canvas-health` 缺省取最近更新的画布快照；可传 projectId（如 `proj-xxx`）指定。
> - 覆盖：数据结构类（节点/边/布局/保存）。**UI 视觉类**（样式、错位观感）查不到，需结合截图或
>   `--logs` 前端上报日志（`logger.js` 已上报 localTool `/api/logs`）。
> - 常见判读：无 id 边 → EdgeRenderer 用 undefined 作 key 触发重复 key 警告（App.jsx `onConnect` 需补 id）；
>   重复 id/悬空边 → 数据链路错误。

### 1. 启动方式

* **一键启动 (推荐)**：先开 VPN。
  * Windows: `powershell -ExecutionPolicy Bypass -File .\launch-all.ps1 2`
* **独立调试**：
  * localTool: `cd localTool && npm run build && node dist/index.js`
  * 网关: `cd apimart-gateway && python -m uvicorn main:app --host 127.0.0.1 --port 9004`
* **仅前端原型**：`npm run dev`（localhost:5180，无需后端即可看画布）
* **git 推送（必须走代理 7897）**：GitHub 推送直连常超时/被断，**每次 push 都用 7897 代理**：
  `HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 git push origin main`
  （若在代理 `git push` 之外还要传输大文件，速度慢属正常，等待写对象完成即可。）

### 2. 常见问题速查

* **网关 502**：先查 VPN 是否连通 `lgw.lovart.ai:443`。
* **字段对不上**：画布硬编码读 `t.data[0].url`，需 localTool 侧剥 `{code,data}` 信封对齐。
* **构建/测试异常**：先 `npm run test:smoke` 看契约/React 单实例；再 `npm run check:health` 全量。
* **改 localTool 后端**：`cd localTool && npm test`（全量，localtool.test / localtool.network / providers 三个文件）必跑。

### 3. 缓存清理（前端原型不涉及 KV 缓存；后端排障见下）

后端 KV 缓存清理：`node scripts/1mao-scripts/clear-cache.cjs`（已归档，仅后端排障用），或 localTool 侧 `POST /api/admin/clear-cache`。

---

## 七、 文档导航与场景速查

### 0. 三入口分工（AI 进入必读流程）

> **本文件（CLAUDE.md）= 项目认知入口，每个 AI 第一站。** 读完它了解"项目是什么"后，按任务类型再读对应入口：

| 任务类型 | 必读 | 定位 |
|---------|------|------|
| 任何任务第一步 | **CLAUDE.md（本文件）** | 项目认知：技术栈/架构/目录/红线/启动 |
| 写代码 | **`spec/CONTEXT.md`** | 决策地图：功能放哪 / 调哪个唯一入口 / 机制红线 |
| 写/改测试 | **`spec/TESTING.md`** | 测试权威：命令/分层/SOP/输出规范 |

> 三个文件**互补不重叠**：CLAUDE 管"项目是什么"，CONTEXT 管"写码怎么决策"，TESTING 管"测试怎么做"。机制细节看对应代码注释（代码即知识）。

### 1. 文档导航（精简：只列必要，其余看代码）

> **原则：别维护一堆文档。** 机制知识看代码注释（代码即知识）；下面是**真正需要读的少数入口**。

**🔴 必读入口（按任务）**
| 文档 | 用途 |
| --- | --- |
| `spec/CONTEXT.md` | **写码决策地图（唯一中心）**：顶层架构（画布编排×节点体系×地基收口×收口准则）/ 代码组织 / 横切 7 块入口 / 并发治理 / 安全密钥 / 数据一致性 |
| `spec/TESTING.md` | **测试体系权威**：命令/分层/SOP/输出规范 |
| `spec/NEW-NODE-GUIDE.md` | **新建节点权威流程**（高频：骨架/注册/契约/常见坑） |
| `tailwind.config.js` | **样式令牌唯一真相**（禁裸色值，勿再引用已删的 tailwind-tokens.md） |

**🟡 按需参考（不用日常维护；用到了才看）**
| 文档 | 用途 |
| --- | --- |
| `docs/NODE-DESIGN-SPEC.md` / `docs/ARCHITECTURE.md` | 节点长什么样 / 设计原则（ARCHITECTURE 路径前缀 `prototypes/...` 为旧写法，实际即根 `src/`） |
| `docs/BASE-CAPABILITIES.md` | base 能力清单（**已并入 CONTEXT §二 横切层**，仅深挖用） |
| `docs/CANVAS_PERFORMANCE.md` / `docs/node-types-map.md` | 性能 / 节点类型映射（生成产物） |
| `docs/1mao-docs/` | 原产品逆向/专题（历史参考） |

**🚫 归档/禁止（不读）**
| 目录 | 说明 |
| --- | --- |
| `reference-1mao/` | 混淆还原只读源码（查实现用，不直接改） |
| `scripts/1mao-scripts/` | 归档逆向脚本（不跑） |
| `docs/逆向专用_ai 禁止读/` | 还原方法论（AI 禁止读） |
| `daily/` | 执行日志（不导航，不用维护） |

> 读 `docs/` 任意方案前先确认其状态是「已完成」还是「规划中」，避免把规划当现状。

### 2. 场景速查表

| 场景 | 做法 |
| --- | --- |
| 要加平台接口（替代官方） | 改 `localTool/src/routes/platform.ts`（builtin/models/manifest）+ `projects.ts`（sync/default），返回本地静态兜底 |
| 要改代理/转发逻辑 | `localTool/src/routes/system.ts`（`/api/proxy` 剥信封/SSE/异步转同步） |
| 要接新模型/视频能力 | 改 `apimart-gateway/lovart_client.py` 别名映射与规范化 |
| 要查官方权益转发 | `localTool/src/routes/official.ts`（中转+短缓存，不伪造权限） |
| 要改画布前端 | 改 `src/` → `npm run test:smoke` → `npm run build`；严禁直接手改 dist |
| 要新增画布节点 | 按 `docs/README.md` 节点规范 + `docs/node-types-map.md`，放 `src/components/` |
| 画布问题排查（节点/边/布局/保存） | **第一步必跑** `cd localTool && node scripts/task-inspect.mjs --canvas-health`（见 §六.0 铁律）|
| **查图/视频/任务/日志/全链路**（task_id / thread_id 室外ID / node_id） | **主入口** `cd localTool && node scripts/task-inspect.mjs --lifecycle <id>`（见 §四.2「查任务主入口」）。其余：`--logs` 日志、`--task` 节点比对、`--lost-check` 丢图、`--consistency` 三层一致性断言 |
| 改 localTool 后端 | `cd localTool && npm test`（全量，三个测试文件）|
| 丢图排查 | `cd localTool && npm run inspect -- --lost-check`（或 `npm run db -- --lost-check`）|
| 提交前验证 | 前端 `npm test`（= smoke+vitest全量单测+regression+tools）+`npm run build`；较大改动加 `npm run check:health`；**localTool 改动另跑 `cd localTool && npm test`** |
