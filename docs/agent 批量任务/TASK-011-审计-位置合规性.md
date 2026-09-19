# TASK-011 — 审计：DOMAIN-RELOCATION-FINAL.md 该不该放在 docs/

> ⚠️ 铁律（违反重做）
> 1. 你只能写本文件，碰任何其他文件视为失败。
> 2. 不写脚本；只读/搜索/判断，结论填进本文件表格。
> 3. 不参考 TASK-012/013/014；独立审计，结论可与其他 AI 相反。

## 任务类型
C（文档/分析）。目标：判定这份"域归位最终执行计划"物理落点 `docs/DOMAIN-RELOCATION-FINAL.md` 是否合规，不是改代码。

## 背景
`docs/DOMAIN-RELOCATION-FINAL.md` 是"域归位·最终执行计划（可执行）"，L18 明写"**执行时只认本文件**"，声称是执行权威入口。但它现在躺在 `docs/` 下。CLAUDE.md 对 `docs/` 的定位与对"决策/判据/现状"的落点有铁律。本任务只审计"位置对不对"，不管文件内容好坏。

## 硬约束（真源，必须引用）
- CLAUDE.md L17-19：`docs/` ← 临时/历史文档（调查产物，可过时可清理，**不维护**）。
- CLAUDE.md L60-74「决策记录铁律」：跨 ≥2 处/全库级决策 → **`spec/CONTEXT.md`** + `contracts.ts`；单文件局部机制 → 该文件头 JSDoc；不为普通决策新开文档。
- CLAUDE.md L435 + `docs/adr/ADR-0023` `ADR-0024` `ADR-0025`：判据进 ADR、现状进 DATAFLOW、细节进代码注释；CONTEXT 只装路由与例外。
- CLAUDE.md L441-457 文档导航表：`spec/` 是权威规范（CONTEXT/TEST-GUIDE/NEW-NODE-GUIDE/DATAFLOW）；`docs/` 仅节点设计/架构/能力清单等按需参考；`daily/` 不导航。

## 探索起点（带行号，来自本次会话实际读取）
- `docs/DOMAIN-RELOCATION-FINAL.md` L1-5（来源声明：由 `docs/agent 批量任务/TASK-001~010` 合并）、L18（"执行时只认本文件"）。
- 兄弟文件：`docs/DOMAIN-MODULES.md`（判据真源）、`docs/DOMAIN-RELOCATION-PLAN.md`、`docs/DOMAIN-MODULES-HANDOFF.md`。
- 对照目录：`docs/adr/`（40 份 ADR）、`docs/plan/`（191 份方案）、`docs/audit-archive/`（3 份审计归档）。
- 读 `spec/CONTEXT.md` 顶部看"规则适用性地图"定位；读 `docs/adr/ADR-0023.md` `ADR-0024.md` `ADR-0025.md` 看判据/现状/机制落点规则。

## 覆盖清单（按项目独特生命周期拆解）
1. **定性**：这份文件到底是"执行计划/判据集合/现状快照/机制说明"中哪一类（或混合）？按 ADR-0023/24/25 分类。
2. **冲突检测**：它是"执行时只认"的权威文件，但 CLAUDE.md 说 docs 是"不维护、可清理"——二者是否冲突？若冲突，哪条优先（CLAUDE.md 是最高优先认知入口）？
3. **边界比较**：与 `spec/`（权威）、`docs/adr/`（判据）、`docs/plan/`（方案）、`docs/audit-archive/`（归档）比较，它最像哪一种？当前放 `docs/` 根是否最佳？
4. **裁定**：留在 `docs/` 还是迁到 X（spec/ / adr/ / plan/ / audit-archive/）？给一句明确裁定 + 3 条理由（带真源行号）。

## 输出规范
填下表（只在本文件写）：

| 项 | 结论 | 真源/行号 |
|---|---|---|
| 文件定性 |  |  |
| 与 docs 定义冲突？ |  |  |
| 最像哪类落点 |  |  |
| **最终裁定** | 留 docs/ 或 迁 `<X>` |  |
| 理由1 |  |  |
| 理由2 |  |  |
| 理由3 |  |  |

## 验收标准
- 给出"留 docs/ 或 迁 X"的一句明确裁定，不可模棱两可。
- 每条理由引用真源行号（CLAUDE.md / ADR / 兄弟文件）。
- 不写脚本、不动其他文件。

## 审计结果（由执行 AI 填写）
【定性】执行计划（施工批次+验证）；判据已委派 DOMAIN-MODULES、链路给 DATAFLOW，符合决策铁律。
【与docs定义冲突？】docs/ 是"不维护可清理"历史文档；本文件是"执行时只认"的活计划，短期需被维护——冲突。但归 docs/plan/（计划既定落点，191份先例）可化解。
【最像哪类落点】docs/plan/（计划），非 docs/ 根（权威/参考）、非 adr/（判据）、非 spec/（权威规范）。
【最终裁定】迁 docs/plan/域归位-最终执行计划.md
【理由1】CLAUDE.md L17-19：docs根=权威/参考；计划类 191 份均在 docs/plan/（先例）。
【理由2】决策铁律 L60-74：跨域决策应进 CONTEXT；本文件判据已委派 DOMAIN-MODULES，无需升 spec，留 docs 家族合规。
【理由3】L18"执行时只认本文件"与"docs不维护"冲突，唯有标"规划中"状态头+归 plan/ 才能化解。
