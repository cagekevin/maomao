# scripts/ —— 原型测试与构建辅助脚本

本目录只放**当前原型在用的核心流水线脚本**：持续复用、被 `package.json` 的 npm scripts 引用。
完整测试体系见 [`spec/TEST-GUIDE.md`](../spec/TEST-GUIDE.md)（权威文档，所有命令以它为准）。

> 1mao 逆向 / MV3 扩展 / 契约扫描等已不适用原型的旧脚本，整体归档在 `1mao-scripts/`，不在此列、不在 npm scripts 中。

## 根目录脚本清单（当前在用）

| 脚本 | 用途 | npm 命令 |
| --- | --- | --- |
| `smoke_test.cjs` | Tier 2 冒烟测试（硬断言质量门），任一项 FAIL 退出码 1。零依赖，AI 默认自检 | `npm run test:smoke` |
| `_smoke_checks.cjs` | 可复用静态冒烟检查集（被 `smoke_test.cjs` 调用），零依赖 | — |
| `tests/unit/nodes/ssrRegression.test.ts` | Tier 3 回归测试：SSR 渲染节点 + class 断言（vitest 移植，替代原 `regression_test.cjs`） | `npm run test:regression` |
| `tests/unit/canvasAgentTools.test.ts` | Tier 4 画布 Agent 工具单元验证（vitest，替代原 `test_agent_tools.cjs`） | `npm run test:tools` |
| `run_all_tests.cjs` | 一键跑所有层级测试（smoke + 前端 vitest 全量 + localTool tsc/单测；regression/tools 两个用例已被 vitest 全量包含，故不单列） | `npm test` |
| `health-check.cjs` | 工程健康编排（**2026-09-23 瘦身后只剩 3 节**）：静态资产存在性 / `npm run build` / 全量测试。契约闸与架构闸**由 `gates.manifest.json` 单源消费**（`gates-run.mjs health` 已在闸循环里跑过），此处不再重复调用 | `npm run check:health` |
| `_syntax_check.ps1` | 启动脚本 `launch-all.ps1` 语法检查 | — |
| ~~`check-jsx.mjs`~~ | **已于 2026-09-15 删除**：判据（JSX/TSX 可解析性）被 `type-check`(tsc) + `test:smoke`(esbuild 检查) + `vite build` 完全覆盖，属冗余闸。取证：JSX 属性区写 `{/* … */}` 时 **tsc 与 esbuild 都报错**（tsc `TS1005` / esbuild `Expected "..." but found "}"`），故它没有独占判据 | — |
| `check-node-data.mjs` | **node.data + 产出契约对账**：① 字段缺口（含**索引签名回退**拦截 / `nodeDataSchema` 默认 / 本节点自写）；② 结果字段命名（写侧产出 vs 读侧 `SINGLE_OUTPUT_FIELDS` / `NODE_OUTPUTS` / 安全网是否认识，2026-09-12 / TD-02-11）；③ **无产出声明一致性**（登记 `NO_OUTPUT_NODE_TYPES` 却写产出字段即报，表2d）；④ 清空遗留字段、豁免表过期、**解析器自检**（解析源为空即 fail-loud，TD-02-9）。**已挂 `check:health`（`--strict`：上述任一 ≠ 0 即失败）**；本节点自用的例外登记脚本内 `RESULT_EXEMPT`（须带原因）。可传类型名子串只看单个节点 | `npm run check:node-data` |
| `check-arch.mjs` | **架构红线（7 条，@babel/parser AST）**：① 循环依赖 ② `base/` 禁反向依赖业务域 ③ 结果信封禁另立 interface ④ agent 工具层禁裸调画布写（须经 canvasHost）⑤ 禁手写 `setNodes/setEdges` 裸写 node/edge 字段（data/width/height/style/selected → 须经 `patchNodeById`/`patchEdgeById`）⑥ 存储唯一入口（禁直调 `kvGet/kvSet/sGet/sSet` 底层）⑦ **KV 后端键禁同步读**（TD-02-12：`contentGet` 对 `backend:'kv'` 键冷缓存返回「未知」而非「不存在」→ 须用 `contentGetAsync`/严格族；含解析源自检） | `npm run check:arch` |
| `check-gate-vitals.mjs` | **元层闸（闸的闸）**：真源 = `gates.manifest.json`。**2026-09-24 由原两道元层闸合并**：① **在册闸的扫描根必须存在**、且"扫到 0 即 fail-loud"的基数自检不得缺失（治「扫 0 却绿灯」—— TD-22-53 / TD-02-9 同族）；② **在册闸脚本头部必须带【申诉口】三问**（锚点 `★闸的申诉口` + `Q1 守什么：`/`Q2 何时该改：`/`Q3 怎么改：`，原 `check-gates.mjs` 判据）—— 把「闸的成本守恒律」从注释升为机器约束。另含**孤儿闸**识别（物理存在却既不在清单、也不在助手白名单 ⇒ 从没被跑过）。静态度量、零执行（< 0.1s）；非脚本命令（如 `npm run type-check`）**明确列出为跳过**、不静默略过；解析到 0 个脚本即 fail-loud（防"假绿"）。 | `npm run check:push`（闸循环内） |
| `check-storage-keys.mjs` | 存储键契约：`contentSet/Get` 用到的键必须在 `contracts.STORAGE_KEYS` 登记（防裸键漂移） | `npm run check:keys` |
| `check-events.mjs` | 事件契约：`publish/subscribe` 的事件名必须在 `contracts.EVENTS` 登记（防发布无订阅/订阅无发布） | `npm run check:events` |
| `check-api-contract.cjs` | 前后端 API 契约比对（前端 `apiRegistry` ↔ localTool 路由表） | `npm run check:api` |
| `check-node-types.mjs` | `useNodePrefs` 命名空间必须先登记 `contracts.NODE_TYPES`（防裸字符串命名空间让「上次参数」静默失效） | `npm run check:node-types` |
| `check-node-handles.mjs` | 节点端口契约：`NODE_HANDLE_CONTRACT` 为端口真源，App/lazyNode 只允许派生 | `npm run check:node-handles` |
| `check-targets.mjs` | 各 `check-*` 共享的**默认扫描根唯一事实源**（被上面几个脚本 require，不单独跑） | — |
| `mv-sync-refs.mjs` | **改名/移动文件 + AST 全库同步 import 说明符**（CLAUDE §5.4.8 强制：改名/搬文件一律用它，禁手写 import 漂移） | 手动 |
| `debt.mjs` | **债务账本读写唯一入口**（主表 `daily/架构日志/债务.md` 只留待办 + `债务-归档.md` 存历史；2026-09-14 收口：原 2 个手写点 → 1 个写入者）。**读**：`list`（默认待办；`--all`/`--area`/`--status` 跨主表+归档）· `area <NN>` 某区全部历史 · `search <词>` 跨区找同类（**状态列即"当时怎么解的"**）· `show <ID>` 单条 + **解法入口**· `audit` 只读体检（**不是闸**）。**写**：`add`/`resolve`（入口校验非法枚举 / 摘要含 `\|` / 锚点不存在 → 当场拒，**刻意不挂闸**）。**维护**：`archive` 把已完成项移入归档（主表只留待办） | 手动 |
| `probe.mjs` | **「先红后绿」探针执行器**（临时注入 → 跑命令 → **精确断言**（退出码 / 输出命中 / 输出不得命中）→ **无条件还原**）。**为什么必须用它做探针、而不是手改**：① journal 兜底（`scripts/.probe/` 存**原文全文**，启动先自愈上次被 Ctrl+C/崩溃打断的残留）；② 还原后 **sha256 自校验**，工作区零污染；③ **强制注入点唯一**（0 处 / 多处即拒 —— 防"红的不是那点"，本仓 TD-02-9「假护栏恒绿」同款教训）；④ 结论块直出，可粘贴进区域日志当证据。`--dry` 只预览。<br>`node scripts/probe.mjs --label X --file <f> --find "<旧>" --replace "<新>" --run "<cmd>" --expect-exit 1 --expect-out "<精确关键词如 file.ts:384>"` | 手动 |
| `extract-tailwind.mjs` | 从 `src/` 抽取 Tailwind 类到 `src/index.css` 白名单 | `npm run extract:tw` |
| `ts-tests.mjs` | 测试类型消化作战系统：`check`/`verify` 单文件、`status` 全局进度、`add/rm-nocheck`。**`status` 已修复可放心用**（批量剥 nocheck → tsc → finally 还原；早期恢复不可靠的历史问题已不再复现） | — |
| `m1-scan.mjs` | 测试类型错误**全貌聚合**（只读）：复制到 `tmp/unit` 副本扫描，零污染。产出每个文件 × 错误数 × 错误码 | — |
| `m1-count.mjs` | **M1「React 重渲反模式」形态计数**（只读**度量工具 · 不是闸**）：AST 口径统计 memo 决策点（裸/React.memo/带比较器）+ JSX 内联箭头·数组·对象 prop；`--json` 落基线、`--diff` 自动算净减。**口径真源 = 脚本头**（文档只许引用，禁抄数字）。**无 pass/fail、不挂 CI**（依据 `ADR-0016` 默认不建 + M1 评审 §三「不建闸」裁定）。⚠️ 与 `m1-scan.mjs` 名字撞车但**两回事**：那个是 TS 类型错误，这个是重渲形态 | — |
| `ts-detail.mjs` | 测试类型错误**逐条明细**（只读）：跑 1 次 tsc，按文件名片段过滤出多个目标文件的逐行错误。`check` 逐文件查太慢时用它 | — |
| `ui-geometry/measure-panel.mjs` | **真实浏览器布局测量**：自起/复用 dev server，注入表格模式+消息流+AI 预览，量指定选择器几何 + 扫「真正撑破面板右缘」的元素（自动排除 `.sb-body` 等滚动容器内被正常收纳的横向滚动内容）。定位"某内容超出去"类布局问题用，别靠猜 | 手动 |

内部辅助 / 一次性脚本（未挂 `package.json`，按需手动跑，勿删）：
- `test-affected.cjs`：按**暂存改动**反查受影响测试并只跑它们（`vitest run --changed` 不认改动的源码文件，故自实现）。
- `ts-exts.cjs`：TS 规范化重构期「扩展名无关解析 + 永久豁免」的唯一事实源（被 `.mjs`/`.cjs` 双方 require）。
- `_shot.cjs`：Playwright 截图/取控制台报错的临时脚本（`_` 前缀 = 内部件）。
- `_fix_unused_vars.mjs`：一次性根治 `no-unused-vars` 的批量修复脚本（已用完，留档）。

## 命令速查（AI 工作流）

`package.json` 命令。AI 每次改动后的**默认自检是冒烟（快）**，按需再跑单项/全量：

| 命令 | 作用 |
| --- | --- |
| `npm run test:smoke` | **AI 默认自检**：契约漂移 / React 单实例 / chunk 完整性，极快 |
| `npm run build` | 构建校验 + 回灌 `dist/`（改完 `src/` 必跑） |
| `npm test` | 统一测试门禁（smoke + regression + tools） |
| `npm run check:health` | 全量健康度检查（manifest 全部闸 + healthOnly：静态资产存在性 / build / 全量测试） |
| `node scripts/ts-tests.mjs status` | **测试类型消化进度**：批量剥全部 @ts-nocheck → tsc → finally 还原（已修复可靠）。**摘帽/收尾前先跑它**，会列出 0 错的「白拿」文件 | 手动 |
| `node scripts/ts-tests.mjs verify <file>` | 单文件收尾：剥 @ts-nocheck → tsc → vitest，全过才**永久摘帽** | 手动 |
| `node scripts/ts-detail.mjs <片段>` | 看某文件/某系列测试的**逐条类型错误**（跑 1 次 tsc 过滤出多文件，含解析率自检） | 手动 |

> AI 改动工作流：改完 `src/` → `npm run test:smoke` → `npm run build` → 较大改动 `npm run check:health` + 浏览器走查。

## 规范：一次性脚本归哪里

**任何一次性 / 临时 / 探索性脚本，放进 `1mao-scripts/` 或新建独立文件夹，禁止直接丢进本目录。**
- 本目录只保留**核心流水线**脚本（持续复用、被 npm scripts 引用）。
- 1mao 逆向时代的扩展/契约/还原脚本统一在 `1mao-scripts/`（只读参考，不跑）。
- 若要恢复某个归档脚本长期复用，把它和依赖一起移回本目录，并在此表登记。
