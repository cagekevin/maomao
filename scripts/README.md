# scripts/ —— 原型测试与构建辅助脚本

本目录只放**当前原型在用的核心流水线脚本**：持续复用、被 `package.json` 的 npm scripts 引用。
完整测试体系见 [`docs/TESTING.md`](../docs/TESTING.md)（权威文档，所有命令以它为准）。

> 1mao 逆向 / MV3 扩展 / 契约扫描等已不适用原型的旧脚本，整体归档在 `1mao-scripts/`，不在此列、不在 npm scripts 中。

## 根目录脚本清单（当前在用）

| 脚本 | 用途 | npm 命令 |
| --- | --- | --- |
| `smoke_test.cjs` | Tier 2 冒烟测试（硬断言质量门），任一项 FAIL 退出码 1。零依赖，AI 默认自检 | `npm run test:smoke` |
| `_smoke_checks.cjs` | 可复用静态冒烟检查集（被 `smoke_test.cjs` 调用），零依赖 | — |
| `regression_test.cjs` | Tier 3 回归测试：节点注册表 + 脚本盒引擎快照比对 | `npm run test:regression` |
| `test_agent_tools.cjs` | Tier 4 画布 Agent 工具单元验证（20 项） | `npm run test:tools` |
| `run_all_tests.cjs` | 一键跑所有层级测试（smoke + regression + tools） | `npm test` |
| `health-check.cjs` | 工程健康编排：脚手架/构建/冒烟/回归/TDZ/契约比对一键跑 | `npm run check:health` |
| `_syntax_check.ps1` | 启动脚本 `launch-all.ps1` 语法检查 | — |
| `check-jsx.mjs` | JSX 语法合规检查（禁 `<br>`/危险 `dangerouslySetInnerHTML` 等） | `npm run check:jsx` |
| `extract-tailwind.mjs` | 从 `src/` 抽取 Tailwind 类到 `src/index.css` 白名单 | `npm run extract:tw` |
| `sync-mapping.mjs` | 节点中文名 → 英文 type 映射同步（`docs/node-types-map.md`） | `npm run sync:mapping` |

数据文件（根目录，流水线输入/产物）：
- `dist-snapshot.json`：dist 产物基线快照（体积/文件清单），`health-check` 比对用。

## 命令速查（AI 工作流）

`package.json` 命令。AI 每次改动后的**默认自检是冒烟（快）**，按需再跑单项/全量：

| 命令 | 作用 |
| --- | --- |
| `npm run test:smoke` | **AI 默认自检**：契约漂移 / React 单实例 / chunk 完整性，极快 |
| `npm run build` | 构建校验 + 回灌 `dist/`（改完 `src/` 必跑） |
| `npm test` | 统一测试门禁（smoke + regression + tools） |
| `npm run check:health` | 全量健康度检查（脚手架 / build / smoke / regression / TDZ / dist 基线） |

> AI 改动工作流：改完 `src/` → `npm run test:smoke` → `npm run build` → 较大改动 `npm run check:health` + 浏览器走查。

## 规范：一次性脚本归哪里

**任何一次性 / 临时 / 探索性脚本，放进 `1mao-scripts/` 或新建独立文件夹，禁止直接丢进本目录。**
- 本目录只保留**核心流水线**脚本（持续复用、被 npm scripts 引用）。
- 1mao 逆向时代的扩展/契约/还原脚本统一在 `1mao-scripts/`（只读参考，不跑）。
- 若要恢复某个归档脚本长期复用，把它和依赖一起移回本目录，并在此表登记。
