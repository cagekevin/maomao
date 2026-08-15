# scripts/ —— 核心脚本目录

本目录只放**核心流水线**脚本：持续复用、被 `package.json` 的 npm scripts 或 CI 质量门引用。
**一次性 / 临时 / 探索性脚本禁止放这里**，请统一放进 `archived/`（见下方规范）。

## 根目录脚本清单

| 脚本 | 用途 |
| --- | --- |
| `smoke_test.cjs` | Tier 2 冒烟测试（硬断言），任一项 FAIL 即退出码 1，作为 CI 质量门。用法：`node scripts/smoke_test.cjs`（npm: `test:smoke`） |
| `_smoke_checks.cjs` | 可复用静态冒烟检查（被 `smoke_test.cjs` 与 `_check_align.cjs` 共用），零依赖，CI 直跑 |
| `_check_align.cjs` | 改名对齐校验安全网：扫描改名后源码关键行为标记位置，确认改名没误伤 |
| `_syntax_check.ps1` | 启动脚本 `launch-all.ps1` 语法检查 |
| `contract_scan.cjs` | 跨端字符串契约全量分布 + 漂移检测。用法：`node scripts/contract_scan.cjs [--resnap\|--md]`（npm: `contracts`） |
| `gen_bundle_map.cjs` | 扫描 `src/bundle/` 生成 `BUNDLE_MAP.md`，作为 AI 检索入口（按特征反查落点）。用法：`node scripts/gen_bundle_map.cjs`（npm: `map`） |
| `rollback/` | 改名失败回退：快照（`snapshot.cjs`）+ 恢复（`restore.cjs`），安全网 |
| `check-build.cjs` | 构建后完整性检查：扫描 `dist/assets` 确认 `main-*.js`/`vendor-*.js` 产物存在，并做错误签名/TDZ 可见性提醒（不阻断）。用法：`node scripts/check-build.cjs` |
| `health-check.cjs` | 全量健康度编排：文件存在性（`src/bundle/` 现状）/ npm scripts / 构建 / 地图 / 冒烟 / TDZ / dist 基线一键跑。用法：`npm run health` |
| `safety-net.cjs` | dist 产物基线快照与体积对比。`--save` 存基线，重跑对比变化。用法：`node scripts/safety-net.cjs [--save]` |
| `verify-ext.cjs` | Playwright 真机验收（MV3 扩展）：加载 `dist/` 捕获 console/pageerror/SW 异常 + UI 渲染断言，结果写 `report.json`。用法：`node scripts/verify-ext.cjs`（依赖 `verify-common.cjs`） |
| `verify-chunks.cjs` | 动态 chunk 逐个 `import()` 验收，补 `verify-ext` 未覆盖的异步 chunk，结果写 `report-chunks.json`。用法：`node scripts/verify-chunks.cjs`（依赖 `verify-common.cjs`） |
| `verify-features.cjs` | 验证各功能域 barrel 运行时标记 `window.__gougou_features__` 是否真机置位。用法：`node scripts/verify-features.cjs`（依赖 `verify-common.cjs`） |
| `verify-common.cjs` | `verify-*` 三件套公共模块：`resolveExtPath`/`isNoise`/`launchExtContext`/`findExtId`，被上面三个 require |

> **归档说明**：以下脚本已移入 `archived/`（均为适配旧 `src/legacy` 结构、对当前
> `src/bundle/` 已失效，或纯逆向一次性产物，实测跑不起来）：
> - `archived/tools/`：`summarize.cjs`（缺 acorn 依赖）、`trace-barrels.cjs`/`gen-semantic-map.cjs`/`patch-semantic-map.cjs`/`gen-feature-groups.cjs`（硬编码旧 `src/legacy`/`src/features`）、`vendor-lookup.cjs`/`hooks-lookup.cjs`/`hooks-contract.md`（索引旧 legacy 短名）、`audit-barrels.cjs`（依赖已删 T02B 报告）
> - `archived/beautify/`：`beautify.cjs`/`beautify-dist.cjs`/`launch-beautify-dist.ps1`（反编译美化，文档早已标注归档但漏移）、`add_chunk_headers.cjs`（一次性插头）
>
> 对 `src/bundle/` 定位代码，用 `npm run map`（BUNDLE_MAP.md）替代上述失效工具。

## 命令速查（AI 工作流）

`package.json` 命令。AI 每次改动后的**默认自检**是冒烟（快），按需再跑单项/全量：

| 命令 | 作用 |
| --- | --- |
| `npm run test:smoke` | **AI 默认自检**：冒烟质量门（契约漂移 / React 单实例 / chunk 完整性），~194ms 极快 |
| `npm run build` | 构建校验 + 回灌 `dist/`（改完 `src/bundle/` 必跑） |
| `npm run map` | 重建 `BUNDLE_MAP.md` 检索地图（新增/改动文件后按需） |
| `npm run contracts` | 契约漏改漂移检测（动了字符串契约后按需，漂移用 `--resnap` 重建基线） |
| `npm run health` | 全量健康度检查（存在性 / build / map / smoke / TDZ / dist 基线），较大改动或提交前，0 错 0 警为佳 |

> AI 改动工作流见 CLAUDE.md §二点五：改完 `src/bundle/` → `test:smoke` → `build` → 按需 `map`/`contracts` → 较大改动 `health` + 真机走查。

## 数据文件（根目录，核心流水线输入）

- `contracts.json` / `contract_snapshot.json`：`contract_scan.cjs` 的契约字典与基线快照
- `contract_snapshot.json`：契约扫描基线，漂移比对依据
- `dist-snapshot.json`：`safety-net.cjs --save` 的 dist 产物基线快照（体积/文件清单）
- `report.json` / `report-chunks.json`：`verify-ext.cjs` / `verify-chunks.cjs` 真机验收结果产物

> 其它数据文件（如 `regions.json` / `panels.json` / `region_labels.json`）已随逆向辅助脚本归入 `archived/`。

## 规范：一次性脚本归哪里

**以后任何一次性 / 临时 / 探索性脚本，必须新建独立文件夹放进 `scripts/archived/` 下，禁止直接丢进本目录。**

- 本目录只保留**核心流水线**脚本（持续复用、被 CI / npm scripts 引用）。
- 新的一次性脚本：在 `scripts/archived/` 下按用途建子文件夹（如 `archived/临时导出/`、`archived/实验-xxx/`），脚本及其依赖数据一起放进去。
- 不要为图省事把临时脚本平铺在本目录——会污染脚本目录、淹没核心流水线、让后人分不清哪些还能跑。
- 若一个归档脚本后来证明要长期复用，再把它和依赖一起移回本目录，并在此表登记。

详见 [`archived/README.md`](./archived/README.md)。
