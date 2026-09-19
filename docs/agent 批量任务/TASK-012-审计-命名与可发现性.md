# TASK-012 — 审计：DOMAIN-RELOCATION-FINAL.md 命名与可发现性（深模块接口视角）

> ⚠️ 铁律（违反重做）
> 1. 你只能写本文件，碰任何其他文件视为失败。
> 2. 不写脚本；只读/搜索/判断，结论填进本文件表格。
> 3. 不参考 TASK-011/013/014；独立审计，结论可与其他 AI 相反。

## 任务类型
C（文档/分析）。目标：从"深模块 = 窄接口 + 强实现"（项目 §2.6 / A7）与奥卡姆剃刀视角，审计这份文件的**命名、与兄弟文件的关系、可发现性**——即它能不能作为一个"深模块"被后续 AI 一眼找到、不绕路。

## 背景
一份好的"深模块"文档应具备：窄而清晰的入口名、与同类文档不冗余、能被文档导航索引到。本文件与 3 个兄弟文件同主题（`DOMAIN-MODULES` / `DOMAIN-RELOCATION-PLAN` / `DOMAIN-MODULES-HANDOFF`），需判断命名是否成"杂物抽屉"反例。

## 硬约束（真源）
- 项目"深模块"定义：`DOMAIN-RELOCATION-FINAL.md` §2.6、A7（L238-268）"域→子域→深模块；横切层件多=最容易变杂物抽屉；AI 一眼找到"。
- CLAUDE.md §5.5 奥卡姆剃刀：如无必要勿增实体；§七.1"别维护一堆文档"。
- CLAUDE.md L441-457 文档导航表（必读/按需/归档）；L466"读 docs 任意方案前先确认状态"。

## 探索起点（带行号）
- `docs/DOMAIN-RELOCATION-FINAL.md` L1 标题"域归位·最终执行计划（**可执行**）"。
- 兄弟：`docs/DOMAIN-MODULES.md`、`docs/DOMAIN-RELOCATION-PLAN.md`、`docs/DOMAIN-MODULES-HANDOFF.md`（grep 标题与首段，判断各自职责边界）。
- CLAUDE.md L441-457：本文件是否出现在"必读入口/按需参考"任何一行？若没出现，后续 AI 靠什么找到它？
- `docs/README.md`（若有）索引。

## 覆盖清单
1. **关系冗余**：PLAN vs FINAL vs HANDOFF vs MODULES 四者职责是否重叠/冲突？FINAL 是否使 PLAN 失效或多余？是否该合并/删冗余？
2. **导航可达**：CLAUDE.md 文档导航（L441-457）是否收录本文件或任一兄弟？没收录=发现成本高=不是好深模块入口。
3. **接口窄度**：作为"执行入口"（L18 只认本文件），它是否需要一个 index/门面式说明让 AI 0 步定位？现在入口名 `-FINAL` 是否隐含"有过 -PLAN"的过时叙事？
4. **命名建议**：给出推荐文件名（含是否合并、是否去 -FINAL）。

## 输出规范
| 项 | 结论 | 真源/行号 |
|---|---|---|
| 四兄弟职责重叠点 | PLAN（L1「两阶段施工计划」）与 FINAL（L1「最终执行计划·可执行」、L4「执行时只认本文件」）**同为搬迁施工计划 → 实质重叠/冲突**；MODULES（L6「唯一蓝图」）与 HANDOFF §1（「计划/阶段/进度 = DOMAIN-MODULES.md §1–§9」）也持有「计划/进度」→ 三份叠计划；HANDOFF（L3/L13）指向 MODULES 而非 FINAL，与 FINAL「执行只认本文件」**入口指引相互矛盾** | PLAN L1/L7-9；FINAL L1/L4/L5；MODULES L6；HANDOFF L3/§1；CLAUDE L439 |
| 是否在 CLAUDE.md 导航 | **否** —— grep `DOMAIN-(RELOCATION\|MODULES)` 在 CLAUDE.md **0 命中**；L441-457 必读/按需/归档三张表**均未收录**四份任意一份；后续 AI 只能靠 grep 找，违反 L466「读 docs 任意方案前先确认状态」的可见前提 | CLAUDE.md L441-457；grep 0 命中；CLAUDE L466 |
| 入口是否够窄 | **否** —— ①「-FINAL」后缀隐含「有过 -PLAN」的过时叙事（奥卡姆反例）；②四份并存**无单一 0 步定位点**；③HANDOFF 指向 MODULES、FINAL 自认唯一执行源，AI 不知认谁；④无 index/门面式说明 | FINAL L1/L4；HANDOFF L3；CLAUDE L466；§2.6/L261-266 |
| **命名裁定** | **合并 PLAN 入 FINAL 并删 PLAN；去「-FINAL」后缀，改名 `docs/域归位-执行计划.md`**；MODULES 保留为唯一蓝图真源；HANDOFF 薄入口并入 MODULES 或保留但须在 CLAUDE 导航登记 | 见理由1/2 |
| 理由1 | 奥卡姆剃刀（CLAUDE §5.5「如无必要勿增实体」/L439「别维护一堆文档」）：PLAN 与 FINAL 两份并存 = 增冗余实体，该删其一，只留一份可执行计划；「-FINAL」本身即「曾有过 PLAN」的气味 | CLAUDE §5.5 / L439 |
| 理由2 | 可发现性失败：CLAUDE 导航（铁律 L441-457、L466）未收录任一份，AI 无法一眼找到 → 非好深模块入口；若保留，至少须把「唯一执行计划」登记进 CLAUDE 导航表，否则发现成本过高 | CLAUDE L441-457 / L466 |

## 验收标准
- 给出"保留原名 / 改名 X / 合并进 Y"的明确裁定。
- 引用兄弟文件职责证据 + CLAUDE.md 导航表行号。
- 不写脚本、不动其他文件。

## 审计结果（由执行 AI 填写）
【四兄弟职责重叠】PLAN(L1「两阶段施工计划」) 与 FINAL(L1「最终执行计划·可执行」/L4「执行时只认本文件」) **同为搬迁施工计划 → 实质重叠/冲突**；MODULES(L6「唯一蓝图」) 与 HANDOFF §1(「计划/阶段/进度=DOMAIN-MODULES.md §1–§9」) 也各自持有「计划/进度」→ 三份叠计划；且 HANDOFF(L3) 指向 MODULES、FINAL 自认唯一执行源，**入口指引互相打架，「认哪份」不清**。
【是否在CLAUDE.md导航】否——grep `DOMAIN-(RELOCATION|MODULES)` 在 CLAUDE.md **0 命中**；L441-457 必读/按需/归档三表均未收录四份任意一份，后续 AI 只能靠 grep 找（违反 L466 可见性前提）。
【入口是否够窄】否——「-FINAL」后缀隐含「有过 -PLAN」的过时叙事（奥卡姆反例）；四份并存无单一 0 步定位点；HANDOFF 指向 MODULES、FINAL 自认唯一执行源，AI 不知认谁；无 index/门面说明。
【命名裁定】**合并 PLAN 入 FINAL 并删 PLAN；去「-FINAL」后缀，改名 `docs/域归位-执行计划.md`**；MODULES 保留为唯一蓝图真源；HANDOFF 薄入口并入 MODULES 或保留但须登记进 CLAUDE 导航。
【理由1】奥卡姆剃刀 §5.5「如无必要勿增实体」/L439「别维护一堆文档」：PLAN 与 FINAL 两份并存 = 增冗余实体，该删其一，只留一份可执行计划；「-FINAL」本身就是「曾有过 PLAN」的气味。
【理由2】可发现性失败：CLAUDE 导航(L441-457、L466) 未收录任一份，AI 无法一眼找到 → 非好深模块入口；若保留，至少须把「唯一执行计划」登记进 CLAUDE 导航表，否则发现成本过高。
