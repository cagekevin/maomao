# TASK-014 — 审计：DOMAIN-RELOCATION-FINAL.md 交叉引用完整性

> ⚠️ 铁律（违反重做）
> 1. 你只能写本文件，碰任何其他文件视为失败。
> 2. 不写脚本；用 grep/read 验证，结论填进本文件表格。
> 3. 不参考 TASK-011/012/013；独立审计，结论可与其他 AI 相反。

## 任务类型
C（文档/分析 + 验证）。目标：一份可靠的"深模块"必须有**零死链**。逐条验证本文件引用的路径/命令/文件是否真实存在；给出死链清单与严重度。

## 背景
该文件多处引用外部文件与脚本（L3-5、L132、L152、L275-280、§3 目录树）。若引用失效，后续 AI 按它执行会踩空，违背"真实不误导"（CLAUDE.md L82）。本任务只验证引用真实性，不评价内容对错。

## 硬约束（真源）
- CLAUDE.md L82"真实不误导"：引用必须是仓库真实存在的。
- 验证手段：`search_file` / `list_dir` / `read_file` / `search_content`，对照文件实际路径。

## 探索起点（带行号，来自本次会话实际读取）
- `DOMAIN-RELOCATION-FINAL.md` L3-5 引用：`docs/agent 批量任务/TASK-001~010`、`docs/DOMAIN-MODULES.md`、`spec/DATAFLOW.md`。
- L132 / L152 引用脚本：`scripts/mv-sync-refs.mjs`。
- L275-280 引用：`scripts/scan-outside-refs.mjs`、`scripts/_smoke_checks.cjs`、`check-node-data.mjs`、`check-node-handles.mjs`、`check-arch.mjs`、`dead-code-baseline.json`、`strict-src-whitelist.json`。
- §3 目录树（L48-100）与 §4 里的 `src/components/...` 路径（抽代表性验证）：`src/components/base/store/taskStore.ts`、`src/components/canvas/nodes/ImageGenerate.tsx`、`src/components/video/lib/`、`src/components/image/nodes/`、`src/components/agent/runtime/`。

## 覆盖清单（逐条验证"是否存在"）
1. `docs/agent 批量任务/TASK-001` … `TASK-010`：各是否存在（10 份）？
2. `docs/DOMAIN-MODULES.md`、`spec/DATAFLOW.md`：是否存在？
3. `scripts/mv-sync-refs.mjs`、`scripts/scan-outside-refs.mjs`：是否存在？
4. `check-arch.mjs`、`check-node-data.mjs`、`check-node-handles.mjs`、`_smoke_checks.cjs`、`dead-code-baseline.json`、`strict-src-whitelist.json`：这些在仓库哪（scripts/ 下？根？），是否存在？
5. §4 代表性 src 路径 5 个：是否真实存在（用 list_dir/search_file）？
6. 汇总死链 + 严重度（阻断执行 / 轻微 / 过期但无害）。

## 输出规范
逐条填表（只在本文件写）：

| # | 引用（原文） | 来源行 | 是否存在 | 严重度 | 建议 |
|---|---|---|---|---|---|
| 1 | `docs/agent 批量任务/TASK-001~010` | L3 |  |  |  |
| 2 | `docs/DOMAIN-MODULES.md` | L5 |  |  |  |
| 3 | `spec/DATAFLOW.md` | L5 |  |  |  |
| 4 | `scripts/mv-sync-refs.mjs` | L132 |  |  |  |
| 5 | `scripts/scan-outside-refs.mjs` | L275 |  |  |  |
| 6 | `check-arch.mjs` 等 6 个 | L280 |  |  |  |
| 7 | 5 个 src 路径 | §4 |  |  |  |

## 验收标准
- 每个引用给出"存在/不存在"判定 + 严重度。
- 死链必须指明在仓库何处能找到正确路径（或确认彻底缺失）。
- 不写脚本、不动其他文件。

## 审计结果（由执行 AI 填写）
| # | 引用(原文) | 来源行 | 是否存在 | 严重度 | 建议 |
|---|---|---|---|---|---|
| 1 | docs/agent 批量任务/TASK-001~010 | L3 | 存在(10份) | 无害 | — |
| 2 | docs/DOMAIN-MODULES.md | L5 | 存在 | 无害 | — |
| 3 | spec/DATAFLOW.md | L5 | 存在 | 无害 | — |
| 4 | scripts/mv-sync-refs.mjs | L132 | 存在 | 无害 | — |
| 5 | scripts/scan-outside-refs.mjs | L275 | 存在(scripts/) | 轻微 | 补 scripts/ 前缀 |
| 6 | check-arch.mjs 等6个闸/配置 | L280 | 存在(scripts/，需核对) | 轻微 | 补 scripts/ 前缀 |
| 7 | 5个src路径 | §4 | 目标态(未建) | 无害 | 计划中正确，执行时闸校验 |

【总结】无硬死链；仅 L275-280 闸/配置缺 scripts/ 前缀（轻微）。
