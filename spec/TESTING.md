# 原型测试地基（react-nodes）

> 本目录的测试体系，作为原型（`prototypes/react-nodes`）开发 / 提交 / 交付前的质量门禁。
> 借鉴了原产品（根目录 `scripts/`）的 health-check / safety-net 思想，并按原型（jsx + vite + 插件）做了适配。

## 〇、测试架构总纲（先读这一节）

> 这是整个测试体系的**顶层设计**。目标是：每个阶段都处于最优，而非"能跑就算"。判定一切测试工作的唯一标准——**它是否在测真实的、会因代码改动而失败的契约**。

### 核心原则：测试的价值 = 能否捕获真实回归

| 测试类型 | 价值 | 例子 | 判断标准 |
|---------|------|------|---------|
| **契约测试**（高价值） | 测真实行为/状态机/边界 | `pollTask`、`taskStore`、`scriptBoxEngine` | 断言具体返回值和副作用；**代码逻辑一变，它必红** |
| **行为测试**（中价值） | 测组件真实交互（非自证） | 点击触发某真实副作用、条件渲染分支 | 不 mock 被测组件自身逻辑；断言用户可感知行为 |
| **冒烟测试**（低价值，仅防崩） | 挂载/渲染不抛异常 | `expect(container).toBeTruthy()` | 只防"崩溃级"回归；不该成为测试主体 |

**红线**：`expect(x).toBeTruthy()` 式"挂载不崩"、以及"mock 被调用了"这类**自证式断言**，不算有效测试——mock 是我们自己写的，测它等于测自己。**测试应优先落在纯逻辑层**（store / api / 工具函数 / 引擎），那里的契约最稳定、最值得锁。

### 分层：越纯、越靠近逻辑的层，测试投入越大

```
高价值 ┌────────────────────────────┐
       │ L2 纯逻辑/store/api/引擎     │ ← 测试主战场（node，快、稳、锁契约）
       │ L3 hook 桥接               │ ← 中等：mock 依赖但锁 hook 返回值
       │ L4 组件                     │ ← 低优先级：只补「防崩」+「关键交互」，不铺量
       │ L5 SSR / E2E               │ ← 少量端到端冒烟
低价值 └────────────────────────────┘
```

### 投入原则（决定"测什么、不测什么"）
1. **纯逻辑 100% 覆盖**：state 机、工具函数、api 封装、引擎——必测。
2. **组件 20/80**：只测「关键交互 + 防崩」，不追求全组件铺量（维护成本 > 价值）。
3. **不为覆盖率而测**：一个自证式测试拉高覆盖率数字，比没有测试更糟（假安全感）。
4. **mock 只隔离边界**：mock 外部副作用（网络/存储/ReactFlow），**不 mock 被测组件自身的行为**。

### 全生命周期最优态（从开发到交付）
1. **写代码时**：纯逻辑与 UI 分离，逻辑可独立单测（本仓库已做到——逻辑在 `base/*.js`）。
2. **写测试时**：先写逻辑层契约测试 → 再补组件关键交互。照着「六、SOP」写。
3. **跑测试时**：`npm run test:unit`（4-5s）或 `npm run test:all`（门禁）。输出进 `test-results/`，不污染根目录。
4. **回归时**：`npm run test:all` 全绿即视为安全；新增/改动逻辑必须有对应测试。
5. **提交前**：`test:all` + `type-check` 通过即可，不被低价值测试拖累。

### 架构师应检查的完整维度清单（逐条自检）
除"测什么"外，一个最优测试体系还要过这些维度：

| 维度 | 关键问题 | 本仓库现状 |
|------|---------|-----------|
| **价值** | 测的是真实契约还是自证式断言？ | 逻辑层好；部分组件测试自证式（低价值） |
| **速度** | 整包多久？单个测试多久？ | 整包 4.3s；单组件 388ms（并发已优化） |
| **守门** | 提交/CI 时测试是否被强制跑？ | pre-commit 只 type-check，未跑测试 |
| **确定性** | 有 flaky（偶发红）吗？定时器/真实网络是否隔离？ | 12 个测试用定时器，需 fake timers 规范（见「六·铁律」） |
| **依赖一致** | package-lock 锁定？换机可复现？ | ✅ 已锁定 |
| **输出卫生** | 产物进 test-results/？不污染 git？ | ✅ 已规范 |
| **影响面** | 改 A 模块，能否快速知道哪些测试受影响？ | 无影响面映射，靠全量跑兜底 |

> **本仓库最值得补的三点**：① 提交钩子加 `test:unit`；② 定时器类测试强制 fake timers（防 flaky/挂起）；③ 有需要时建"模块→测试文件"影响面映射。

### 质量门禁守门点（测试在"何时"被强制跑）

| 守门点 | 现状 | 说明 |
|--------|------|------|
| **手动全量** `npm run test:all` | ✅ 有效 | 冒烟 + vitest 单测 + SSR 回归 + Agent 工具，全绿才过 |
| **提交钩子** `.husky/pre-commit` | ⚠️ **只跑 type-check，不跑测试** | 提交前无测试守门；测试仅靠手动跑 |
| **e2e 纳入门禁** | ⚠️ `test:all` **不含 e2e** | e2e 需单独 `npm run test:e2e`（慢），默认不在统一门禁 |
| **CI**（若有） | — | 若有 CI，应跑 `test:all` |

> **判断**：测试要有"活门禁"才有守门价值。若提交时不跑测试、e2e 不进门禁，这些测试就可能长期"绿假象"或没人跑。是否把 `test:unit` 加入 pre-commit、把 e2e 纳入 `test:all`，是产品决策——**默认推荐**：pre-commit 加 `test:unit`（4-5s 可接受），e2e 保持独立（慢，按需跑）。

### 现状覆盖面（2026-08-17）
- `src/components/base/*.js`（纯逻辑）：59 个文件，几乎全部有对应 `tests/unit/*.test.js`（覆盖好，应作为主战场）。
- 组件（jsdom）：关键节点组件有冒烟级测试。
- **结论**：逻辑层覆盖已到位，**不应再铺量**；剩余价值在「提升现有组件测试的断言质量 + 补守门点」，而非「加更多文件」。

## 一、快速上手

```bash
npm test                 # 等价 npm run test:all：跑统一测试门禁（推荐）
npm run check:health     # 工程健康度全量检查（含构建 + 测试 + TDZ + dist 基线）
npm run build            # 构建插件包（dist/）
```

日常改代码后，提交前跑一次 `npm test` 即可。

> ⚠️ **AI 助手跑测试（防挂起）**：改哪个文件就只跑它对应测试 `npx vitest run tests/unit/xxx.test.js`（涉及跨模块 import 才连带跑相关文件），最后才全量 `npm run test:unit` 兜底。勿裸调 `npx vitest`（默认 watch 挂住）。
>
> **根治「跑测试被误判为 watch 挂起」**：执行环境（IDE 工具）对命令行文本里含 `vitest` 字样做了启发式判断，一律当成 watch server 监控超时——但 vitest 实际已正常退出（`vitest.config.js` 设了 `watch:false`、`test:unit` 用 `vitest run` 单次）。**这是工具侧误报，非 vitest 真在 watch**。根治做法：
> 1. 永远通过 **npm 脚本**跑（`npm run test:unit` / `npm test`），内部 `spawnSync` 同步执行、工具不会误判挂起（已验证干净退出）。
> 2. 若必须裸调，用 `cmd /c "cd /d <repo> && npx vitest run ..."` 包裹，避免被当长任务监控。
> 3. 不要用 `node node_modules/vitest/vitest.mjs run` 之类——命令里仍含 `vitest` 字样，同样会误判。

## 二、命令总览

| 命令 | 说明 | 阻塞? |
|---|---|---|
| `npm run test:smoke` | 静态检查：JSX 语法 / ReactFlow API 误用 / 节点注册 / 依赖 | 是 |
| `npm run test:unit` | **vitest 全量单元测试**（`tests/unit/` 下所有用例；数量见运行结果，勿写死——保鲜铁律 §九）。单次运行入口，跑完即退；勿裸调 `npx vitest`（watch 挂住） | 是 |
| `npm run test:regression` | SSR 渲染 4 个核心节点 + 断言关键结构 class（能渲染不崩） | 是 |
| `npm run test:tools` | Agent 工具层验证（create/delete/update/connect/read_canvas） | 是 |
| `npm run test:all` | **统一门禁**：smoke + vitest全量单测 + regression + tools 一次跑完，任一失败退出码 1 | 是 |
| `npm test` | 等价 `test:all` | 是 |
| `npm run check:health` | **工程健康度全量检查**（见下节） | 是 |

## 三、check:health 检查项

`scripts/health-check.cjs` 一键检查 6 大项：

1. **文件存在性** —— 16 个关键文件（源码 / 插件 manifest / background / 图标 / 测试脚本）
2. **npm scripts 完整性** —— `dev/build/test:*` 是否齐全
3. **构建** —— `npm run build` 能否成功
4. **统一测试门禁** —— `test:all` 是否通过
5. **TDZ 风险扫描** —— 扫 `src` 下所有 `.jsx/.js` 的 TDZ / 未定义 / 非函数调用（防 `Cannot access 'x' before initialization`）
6. **dist 构建产物基线** —— 借鉴原产品 `safety-net.cjs`：对比 `dist/` 各文件大小，防意外增删 / 体积异常（基线存于 `scripts/dist-snapshot.json`，dist 有意义的更新后需重新生成基线）

> ⚠️ **dist 基线**：首次运行自动生成快照（仅记录）。之后每次对比；若你**刻意改了构建产物**（新增资源/插件文件），运行后会有差异提示，确认没问题后删除 `scripts/dist-snapshot.json` 重新生成即可。

## 四、测试文件结构

```
scripts/
├── smoke_test.cjs          # 冒烟：静态检查（调用 _smoke_checks.cjs）
├── _smoke_checks.cjs       # 冒烟检查明细（含 ReactFlow useReactFlow 白名单等）
├── regression_test.cjs     # 回归：SSR 渲染节点 + class 断言
├── test_agent_tools.cjs    # Agent 工具单测（被门禁引用；与 vitest canvasAgentTools 并存）
├── run_all_tests.cjs       # 统一门禁聚合脚本（smoke + vitest + regression + tools）
├── health-check.cjs        # 工程健康度全量检查
└── dist-snapshot.json      # dist 基线快照（自动生成，勿手改）

# ✅ 已移除孤儿脚本（2026-08-17）：test_workflow_runtime.mjs / test_workflow_complete.mjs /
#   test_backup_store.mjs 未被门禁引用且内容已被 vitest 覆盖，已删除收敛架构。
#   对应 vitest 测试：tests/unit/{workflowRuntime,backupStore}.test.js

tests/
├── setup.mjs               # vitest 全局 setup（内存 storage / ResizeObserver / matchMedia / scrollTo / fetch mock）
├── e2e/                    # Playwright 端到端（nodes.render / scriptBox / settings / canvas.interactions）
└── unit/                   # vitest 单元测试（`npm run test:unit` 全量跑；数量勿写死）
    ├── *.test.js           # 纯逻辑 node 单测（stores / api / 工具函数）—— 轻量、快
    ├── *.test.jsx          # jsdom 组件单测（节点组件 / hooks）—— 由 vitest.config.js 的
    │                       #   environmentMatchGlobs 自动归类 jsdom，无需写 @vitest-environment 注释
    └── _nodeMocks.mjs      # 【共享 mock 基建】集中 stub @xyflow/react、base 基座组件、hooks、
                            #   网络/存储层，导出 `mocks` 命名空间 + resetNodeMockState()，
                            #   被 jsdom 组件测试复用，消灭文件内重复 vi.mock（数量勿写死）
```

## 五、vitest 环境架构（vitest.config.js）

| 配置 | 值 | 说明 |
|------|-----|------|
| `environment` | `node` | 全局默认：纯逻辑单测走轻量 node，快 |
| `environmentMatchGlobs` | `tests/unit/**/*.test.jsx → jsdom` | 组件测试按约定应**自动**归 jsdom，但实测对个别文件不生效（如 `ScriptBoxModal.test.jsx` 仍报 `document is not defined`），**兜底方案**：在文件第一行写 `// @vitest-environment jsdom`（已有 `AgentMessage.test.jsx` 这样写），与自动归类等效。详见 §六 决策表 |
| `pool` | `forks` | fork 子进程池，隔离性好 |
| `maxWorkers` / `minWorkers` | `8` / `2` | 并发优化：默认懒启动/低并发导致整包慢（11-17s），显式调高后 ~4-5s。低核 CI 机器可改 `'50%'` 自适应 |
| `setupFiles` | `tests/setup.mjs` | 全局环境补丁 |

> **jsdom 为什么慢？** 每个组件测试文件独立初始化自己的 jsdom 实例（隔离需要，不能共享）。31 个 jsdom 文件的环境初始化累计耗时是主要成本。已通过高并发并行把它压到 ~4-5s。

## 五·补、测试输出与临时文件规范（禁止污染根目录）

**唯一合法的测试产物输出目录：`test-results/`**（已被 `.gitignore` 忽略，写进去不会污染 `git status`）。

| 场景 | 放哪 | 禁止 |
|------|------|------|
| 测试运行日志 / 报告 | `test-results/` | ❌ 根目录散落 `*.log` / `*.txt` |
| 诊断脚本输出 | `test-results/`（写文件） | ❌ `/tmp` 散落日志（退出即丢、难追踪） |
| vitest / playwright 产物 | `test-results/`（vitest 报告、playwright `test-results/`） | ❌ `tests/unit/` 里留 `all-out.txt` 之类 |
| 一次性临时文件 | 用后即删，不留库 | ❌ 建 `Temp/`、`tmp/` 等无意义根目录 |

**铁律**：
1. 任何测试/诊断脚本，输出一律写 `test-results/`，**绝不**在项目根、`tests/`、`scripts/` 下新建输出文件。
2. 命令行重定向测试输出时，用 `> test-results/xxx.log`，跑完自行清理或保留（已 gitignore，无碍）。
3. `Temp/`、`tmp/` 这类无 gitignore 的根目录**不要再新建**；已有 `Temp/`（含非测试文件）不属于测试体系。

## 六、如何新增一个测试（SOP）—— 写给后续维护 AI 的操作手册

> 目标是：**照着这份 SOP，写测试不靠猜**。新增测试统一走下面的决策 + 模板。

### 写测试前先自问（价值把关）
1. **它测的是真实行为吗？** 断言的是「输入→输出/副作用」的具体值，而非「不崩」或「mock 被调用」。
2. **逻辑一变，它会红吗？** 若源码逻辑改动它仍绿，就是废测试。
3. **放对层了吗？** 优先纯逻辑层（`base/*.js` 的契约）；组件只补关键交互。

> 低价值用例宁可写纯逻辑也不写自证式组件断言。

### 决策：这个测试该放哪、用什么环境？

| 被测对象 | 文件 | 环境 |
|---------|------|------|
| 纯函数 / store / api / 工具函数（无 React） | `tests/unit/xxx.test.js` | node（默认，无需声明） |
| React 组件（节点 / 面板 / UI） | `tests/unit/Xxx.test.jsx` | **优先自动 jsdom**（`environmentMatchGlobs` 已处理）；若仍报 `document is not defined`，在**文件第一行**写 `// @vitest-environment jsdom` 兜底（与 `AgentMessage.test.jsx` 一致） |
| React hook（useXxx） | `tests/unit/useXxx.test.js` | 需要 DOM → 在**文件第一行**写 `// @vitest-environment jsdom` |
| 端到端 | `tests/e2e/xxx.spec.js` | playwright |

### 模板 A：纯逻辑单测（node，最简单）

```js
import { describe, it, expect } from 'vitest'
import { myFunc } from '../../src/.../xxx.js'

describe('xxx', () => {
  it('描述行为', () => {
    expect(myFunc(输入)).toEqual(期望)
  })
})
```

### 模板 B：组件单测（jsdom + 共享 mock）

```js
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'   // ① 先复用共享 mock 基建

// ② 按组件实际依赖，用 mocks 命名空间把模块 mock 掉（模板见 TextNode.test.jsx）
vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
// ...（组件依赖哪些 base 模块，就 mock 哪些）

import MyNode from '../../src/components/MyNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })  // ③ 每例前重置共享状态

describe('MyNode', () => {
  it('挂载不崩', () => { expect(render(<MyNode id="n1" data={{}} />).container).toBeTruthy() })
})
```

### 共享 mock 基建（`tests/unit/_nodeMocks.mjs`）
- 已 stub：`@xyflow/react`、NodeShell/HoverToolbar/GenerateButton 等 base 基座组件、hooks（useConnectedInputs/useNodeGeneration/useOutsideClick/useNodePrefs/...）、toastStore、filesApi、providerStore、providerModels、chatApi、imageApi、videoEngine、faceMosaic。
- 导出：`mocks`（命名空间）+ `resetNodeMockState()`（每例前调用重置）。
- **复用优先**：组件依赖的 base 模块，先查 `_nodeMocks.mjs` 有没有现成 stub，有就直接 `vi.mock('...', () => mocks.xxx)`，不要自己重写。

### 组件测试铁律（防卡死 / 防误报）
1. **有 `setTimeout`/`setInterval` 的组件**：测试里用 `vi.useFakeTimers()` + 交互后 flush，`afterEach` 里 `vi.useRealTimers()` + `cleanup()`，**绝不留真实 timer**（否则 vitest worker 挂起，整包卡死 —— 历史教训：AgentPanel.test.jsx）。
2. **不触发真实网络**：依赖 fetch 的一律走 `tests/setup.mjs` 的全局 fetch mock。
3. **每例独立**：`beforeEach` 重置 mock 状态，避免跨用例污染。
4. **断言行为而非实现**：优先 `screen.getByText` / `fireEvent` / `waitFor`，不要断言内部 state。

### 命名与位置
- 文件名：`被测模块名.test.js|jsx`（如 `useNodeGeneration.test.js`、`PromptNode.upstream.test.jsx`）。
- 位置：一律 `tests/unit/`；helper/共享基建放 `tests/unit/_*.mjs`（下划线前缀表示非测试文件，不会被 include 误收）。

## 七、常见问题

### 1. 改了节点外观，regression 报 class 找不到
回归测试断言的是节点**根 / 主容器的关键 class**（如 `bg-surface-raised`、`rounded-xl`、`border-edge`、`cust-handle`）。
如果你改动了 NodeShell 外壳 / 节点外观，同步更新 `scripts/regression_test.cjs` 里对应节点的 `expect` 数组。

### 2. 用了新的 ReactFlow API，smoke 报 warning
`_smoke_checks.cjs` 里有 `allowedFromUseReactFlow` 白名单。React Flow 12 的 `useReactFlow()` 返回值若不在白名单会 warning。
确认是合法 API 后，把方法名加进白名单（如 `deleteElements`）。

### 3. 改代码触发 TDZ / 未定义
`check:health` 的 TDZ 扫描会提示。典型场景：在 `const x = useState(...)` 定义前就 `useXxx(x)` 调用（参考 DiscountVideoNode 的修复：把依赖的 hook 调用移到 state 定义之后）。

## 八、已补 / 后续可补

- ✅ **已补 vitest 单测**（2026-08-16）：`tests/unit/` 下 24 文件 / 244 用例，覆盖剧本盒引擎（回调/分批并发/toast/@资产高亮）、AI 画布工具层、管线契约、各纯函数。
- ✅ **已补「算法与逻辑层」单测（阶段一，2026-08-17）**：`tests/unit/` 新增 5 文件 / 54 用例，覆盖 `promptManager`（预设 CRUD+持久化+卡片映射）、`resourcesApi`（fetch 封装全 mock）、`pollTask`（轮询状态机+结果 URL 提取）、`faceMosaic`（detector 单例+打码模式）、`videoEngine`（ProgressController 取消传播）。
- ✅ **已补 Playwright E2E 部分用例**：`tests/e2e/` 已有节点渲染（`nodes.render.spec.js`）与剧本盒状态机（`scriptBox.spec.js`），`npm run test:e2e` 可跑。
- ✅ **已修复测试门禁历史存量失败（2026-08-17 续）**：整包 `npm run test:all` 此前长期红（46 失败 / 17 文件），本轮逐一定位根因修复后 **全绿（891 单测 + SSR 回归 13 节点 + Agent 工具层）**。要点：① `vitest.config.js` 缺 `@vitejs/plugin-react` 致所有 `.test.jsx` 报 `React is not defined`（加 `react()` 插件一次性修复）；② 真实源码 bug 5 处（`TemplateNode` TDZ、`kvStore` KV 失败不降级、`logger` 前缀写死、`useCanvasShortcuts` 选中文本守卫漏 Q/W/E、`projectStore` 版本号同毫秒不递增、`storageAdapter` chrome.storage 抛错误报）；③ 测试断言过时 4 处（`promptManager`/`nodePrefs`/`backupStore` 键名未对齐 `yimao_` 前缀、`logger` category 格式）；④ 删除遗留死文件 `nodeRegistry.test.js`（源码已移除）。详见计划文档「收尾修复」小节。
- ✅ **已补高频组件深度测试（2026-08-18，阶段二续）**：`TaskCenter`（任务中心面板）、`AgentPanel`（画布 AI 助手聊天面板）此前为**零测试**的高频改动组件（近 200 次提交多次改动），本轮补齐深度测试（详见各 `.test.jsx` 头部注释）。
  - `tests/unit/TaskCenter.test.jsx`：空态计数、任务列表渲染（状态/类型/模型名/进度）、筛选与搜索、更多菜单操作（重试/删除）、大图预览、清理任务（清理失败/清理全部）、展开请求/响应数据。
  - `tests/unit/AgentPanel.test.jsx`：面板显隐、消息发送（回车/快捷 chip/空输入禁用/发送后清空）、图像模式直连生图（走 `sendImageMode` 不经过 LLM）、sending 态（思考中 + 停止）、Skill 应用与移除（`markSkillUsed` + `setCurrentSnapshot` 同步落盘）、对话管理（新建/切换/清空含 confirm 分支）、待引用图确认并入附件、执行分级切换。
  - 排障记录：① AgentPanel 的 `selectedImageNodes` 若用默认参数（每次渲染新 `[]`）会与组件内 `useEffect(setPendingImageNodes)` 无限 re-render → 堆溢出，测试必须传稳定引用；② jsdom(pretendToBeVisual) 的平滑 `scrollTo`/`requestAnimationFrame` 在部分组合下持续递归耗尽内存，测试环境固定为空桩。
- 🟡 **仍可补（第二阶段全覆盖，2026-08-17 续，详见计划文档）**：当前 `src/components` 共 185 文件、已覆盖 48、仍有 **137 个零测试文件**待清零，按 7 批推进：
  1. ✅ **批 1 已完成**（2026-08-17）：`backupStore` `clipboard` `cloudSync` `imageCompress` `workflowRuntime` `hooks`(纯函数) `useCanvasHistory` `useSyncNodeData` —— 新增 8 个测试文件（`backupStore/clipboard/cloudSync/imageCompress/workflowRuntime/hooks/useCanvasHistory/useSyncNodeData.test.js`）。`nodePrefs` 实为 React hook，下移批 3。
  2. ✅ **批 2 已完成**（2026-08-17）：`apiBase` `chatApi` `imageApi` `videoApi` `filesApi` `tasksApi` `projectsApi` `settingsApi`(providerApi) —— 新增 8 个测试文件（48 用例）。关键基建：在 `tests/setup.mjs` 用 `Object.defineProperty` 强制 mock 全局 `fetch`（Node 原生 fetch 不可配置，`vi.stubGlobal` 失效）。
  3. **批 3** 业务 hook：`nodePrefs`（从批 1 移入）`useArrangeCanvas` `useAssetDragToCanvas` `useAssetDropPaste` `useContextMenu` `useVideoPoster` `useLocalToolStatus` `useFitNodeRatio` `useMediaDegrade` `useNodeGeneration` `useScriptBoxData` `useScriptBoxEngine` `useCanvasAgentTools`
  4. ✅ **批 4 已完成（2026-08-18）**：`ImageBoxNode` `AgentMessage` `AgentPanel` `Comet` `ConnectionLine` `CustomEdge` `CustomHandle` `DiscountVideoNode` `GhostTargetNode` `JianyingIcon` `NodeTitle` `ScriptBoxNode` —— 待补的 9 个节点已全部补齐（见下方阶段二续记录）。
  5. ✅ **批 5 已完成（2026-08-18）**：`TaskCenter`（`ContextMenu` `AssetLibrary` `CanvasToolbar` `GeneratedView` `ImageEditor` `OverlayEditor` `TopNav` `PromptInput` `ModelSelect` `NodePalette` `ProjectSelector` 等仍待补）
  6. ~~**批 6** director3d 逻辑层/store（0→全）~~ —— **已取消：不开测**。`director3d/` 是**外部下载的开源仓库**（storyai-3d-director-desk），非本仓库自有代码，不纳入测试维护（见 CLAUDE.md §二）。原列表（`directorStore` `cameraGeometry` `panoramaMath` `exportProjectJson` 等）不再作为待办。
  7. ~~**批 7** director3d React 组件 + E2E 收口~~ —— **已取消：不开测**（同上）。`generation.flow` / `director3d` E2E 不新增。

> ⚠️ §八 属历史批次记录，含会过期的具体数字/待办。**保鲜机制下不再主动维护**（见 §九）；现状以「跑 `npm run test:unit` 的结果」为准。

---

## 九、保鲜机制（防止本文件过时——不靠自觉，靠 3 条）

1. **强制二选一**：写测试时若发现本文件某条与现状不符（命令变了/结构变了/规范改了），**要么改代码符合它，要么更新本文件**。禁止"代码改了、文档留旧说法"。
2. **数字/事实不写死**：本文件**禁止写会过期的具体数字**（文件数/用例数/行号/耗时）。需要就说"见运行结果/跑 npm test"。历史记录（§八）属于固定记载，不改；但新内容一律不写死。
3. **规范最小化**：凡是测试文件里已有的注释能表达的，不重复写进本文件。本文件只留"命令、分层、SOP、输出规范"这些代码回答不了的。

> **自检**：改测试后若本文件不需更新 → 规范稳定；若需更新 → 是活规范，随代码演进，正常。
