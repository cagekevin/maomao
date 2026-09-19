# TASK-029 · 域主：小域（`text` `prompt` `task` `resource` `generate`）+ `src/hooks/` + `src/types/`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本片特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-029-域主-小域与hooks与types.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

## 1. 领地（逐件，不许抽样）

```
src/components/text/**        # 1 件（TextGenerate.tsx）
src/components/prompt/**      # 2 件
src/components/task/**        # 1 件
src/components/resource/**    # 3 件
src/components/generate/**    # 1 件
src/hooks/**                  # 约 20 件
src/types/**                  # 约 5 件
```

共约 33 件。**不含**（别越界）：`base/**`（TASK-028）· 其它域目录。

## 2. 计划内结构（判「域内错位」的比对基准）

来自 `docs/plan/域归位-最终执行计划.md` §3：

```
text/       TextGenerate
resource/   resourceStore · ResourceLibrary · ResourcePreview
task/       taskStore · taskCompletionBus · TaskCenter
generate/   GeneratedView
prompt/     PromptHub · promptHubStore
```

**注意每个小域都是"计划写了目标件、没给结构"** ⇒ 你的「域内结构方案」和「判据缺口」小节是本片的核心产出。

## 3. 本片特有事项（必须逐条给结论）

### A · 小域（`text` `prompt` `task` `resource` `generate`）
1. **单件/双件域该不该建子目录？（成因 F · 必答）**
   按 **D2 门槛 ≥3 件**：`text`(1) · `task`(1) · `generate`(1) · `prompt`(2) · `resource`(3) **全部达不到建子目录的门槛**。
   请给**逐域结论**：留域根 + 门面？还是"其实不该独立成域、该并进别的域"？**判据缺口写清缺的是哪一条。**
2. **计划件是否到位**：逐个核 `text/TextGenerate.tsx` · `resource/{resourceStore,ResourceLibrary,ResourcePreview}` · `task/{taskStore,taskCompletionBus,TaskCenter}` · `generate/GeneratedView` · `prompt/{PromptHub,promptHubStore}` 是否存在、落点是否在同域。
3. **`resource` 是否真成域（L1 判）**：`TD-03-21` 说素材"一物覆盖三处"（`resourceStore` + 素材 UI + `librarySource`）。请实测这三处在哪，给结论：**素材的家该是哪一处**；若三处分散在不同域 ⇒ 报 `非本域·应属 X`（本轮不搬）。
4. **门面**：每个小域有没有 `index.ts`？没有的话，谁在直连它的内部件（给 `文件:行`）。

### B · `src/hooks/`（20 件 · 本片最重）
5. **逐件判域籍**。判据只用 L1 两条，具体化：
   - **界面位置** = 它被哪个域的**视图**消费（谁在 JSX 里调它）；
   - **数据落点** = 它读写的 store / key 属于哪个域（给 `文件:行`）。
6. **🔴 `src/hooks/` 是否属 ADR-0040 L4 的管辖范围？（成因 F · 必答）**
   25 号轮次曾自标"**待用户/架构师确认口径**"。请给结论：按现行判据能不能判？**不能判的话，缺的是哪一条判据**（写进「判据缺口」，供裁判裁定）。**不要**自己发明口径。
7. **跨域 hook 的处理**：若某 hook 被 **≥3 个业务域**消费 ⇒ 它是**真横切件，判合规**（不是"错位"）。请把这类单列一节。
8. **`src/hooks/` 是 `strict-src` 白名单目录**（"0 隐式 any"收口，见 `scripts/strict-src-whitelist.json`）。若你提出"某 hook 应属 X 域"的方案，在「判据缺口」里提醒裁判：**域内搬迁后必须同步白名单前缀**（2026-09-19 已发生过"覆盖 15→4 件"的静默缩水）。

### C · `src/types/`
9. **类型文件的落点判据（成因 F · 必答）**：类型件该**随域**（`<域>/types/`）还是**集中 `src/types/`**？逐件给结论 + 依据。
10. **撞名查**：`TD-18-45` 说 `src/types/asset.ts` vs `videoEditor/types/assets.ts` 只差一个 s（`videoEditor` 本批跳过，你只判断**你这边**的 `src/types/asset.ts` 该不该在 `src/types/`）。

## 4. 线索（只是线索 · 不是结论 · 可能已过期）

> **不要照抄**。每条用 `refs`/`ls`/`grep` 现场复核；对不上按实测记录，并标进「描述过期」（成因 G）。

- `TD-25-27`~`TD-25-31`：五笔债都点名 `src/hooks/` 里的**单域 hook**（画布 / 图片 / scriptbox 相关）。逐件复核其消费方，给"应属域"。
- `TD-25-14` 关联的 `base/utils/useMediaLoadFailed.ts` 是 **`base` 的活**（TASK-028），别越界。
- `TD-11-15`（母债）：摘要能对上 `src/hooks/` 的条目很少 ⇒ 说明当初"hooks 一面"扫得不全，**你的表要能补上这个缺口**。
- `TD-13-9`（已结）：`cloudSync` 的两组同步清单（`SYNC_ALLOW` / `SYNC_LABELS`）已于 2026-09-16 删除，改由 `base/core/contracts.ts` 的 `sync` / `label` 字段派生 ⇒ 若你在 hooks/types 里发现**残留的键名清单**，这是它的回声，登记（成因 G）。

## 5. 输出

按 **TASK-022 §7** 的格式（主表 + 末尾小节）。**域籍判定列只许四种**。
主表请**按片分块**（`### A 小域` / `### B src/hooks` / `### C src/types`），不要混成一张。

末尾**额外**必附：

```
## 小域结构方案（每域一条）
| 域 | 件数 | 是否达标建子目录（D2） | 建议结构 | 是否建议撤域 | 依据 |

## hooks 域籍分布
| 应属 | 件数 | 件清单 |

## 跨域（真横切）hook 清单
| hook | 业务域数 | 域清单 | 复核命令 |

## 白名单同步提醒（若提出搬迁方案）
- 若 <件> 搬到 <域>，须同步 scripts/strict-src-whitelist.json 的 <前缀>
```

## 6. 验收补充（除 TASK-022 §9 外）

- [ ] 五个小域 + `src/hooks` + `src/types` 的 `find` 输出**每一件**都在主表出现。
- [ ] `src/hooks/` **逐件**跑了 `refs`（不许抽样）。
- [ ] 「`src/hooks/` 是否属 L4」「小域该不该建子目录」「类型件该随域还是集中」三问**各有明确结论**，不能只写"待定"。
- [ ] `resource` 三处（`resourceStore` / 素材 UI / `librarySource`）**实测位置都写清了**。
