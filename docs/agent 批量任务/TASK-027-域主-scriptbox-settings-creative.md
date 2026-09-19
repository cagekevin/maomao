# TASK-027 · 域主：`scriptbox` + `settings` + `creative`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-027-域主-scriptbox-settings-creative.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

## 1. 领地（逐件，不许抽样）

```
src/components/scriptbox/**    # 约 20 件
src/components/settings/**     # 约 12 件
src/components/creative/**     # 约 11 件
```

**三个域分别出表**（不许混成一张）。**不含**（别越界）：`base/**`（TASK-028）· `src/hooks/**`（TASK-029）。

## 2. 计划内结构（判「域内错位」的比对基准）

来自 `docs/plan/域归位-最终执行计划.md` §3：

```
scriptbox/   （已有；**+ ScriptBoxNode · Select**）
settings/    appSettings · settingRegistry · providerStore · accountsStore
             SettingsFrame · sections/
creative/    ✅ 已建（**结构未定 · 由你按 D2/D3 判**）
```

**计划明定的两件事**：
1. **`Select` 应在本域**（A4 #39：`Select` → `scriptbox/`）。
2. **`ScriptBoxNode.tsx` 直挂 `scriptbox/` 域根**（该域的节点**没有** `nodes/` 子目录）—— **不许为了"节点都该在 nodes/"而建议迁它**。

其余三个域的计划信息都很少 ⇒ **你的「域内落点」判定 + 「判据缺口」小节是本批最重的一份**。

## 3. 本域特有事项（必须逐条给结论）

### `scriptbox`
1. **域根散件（D1）· 本域最重**：域根实测堆了十几件（节点 + 引擎 + schema + 弹窗 + 步进 UI + Playbook 管理 …）。请按 **D2（≥3 件同职责）** 提出**子域划分方案**，逐件给去处（例：`Step*` 一组、`ScriptBox*` 弹窗一组、`scriptBox*` 引擎一组 —— 但**方案要由你按职责实测得出，不是我给的示例**）。**本轮只登记，不搬。**
2. **`Select.tsx` 现行地位**：它是 A4 从 `base/panels` 移入的通用 UI 件。判：① 属 scriptbox 的 UI 件（`ui/`？）② 还是**真横切 UI kit**（那应属 `base/ui`，成因 D/并案）—— 给结论 + 四件证据。
3. **`scriptBoxEngine` / `scriptBoxSchema` / `scriptBoxPrompts` / `scriptBoxPlaybookStore` 四件的层次（D4）**：引擎/schema 属能力层，须**不依赖** UI。逐件跑 `refs` 验。
4. **`KEY_SCRIPTBOX_PLAYBOOKS` 的域标注**：`base/core/contracts.ts` 里该键登记写 `domain: 'settings'`、`store: 'scriptBoxPlaybookStore.ts'`。请按 L1 判**数据落点**，给结论：这个 `domain: 'settings'` 是否判错（若错，成因 C 或 G）。

### `settings`
5. **`sections/` 职责单一（D3）**：设置分节应全在 `sections/`；域根除 `SettingsFrame.tsx` + store 类件 + `index.ts` 外有别的件 ⇒ 域根散件。
6. **store 类件该在域根还是 `store/`（D2/D3）**：`appSettings` · `settingRegistry` · `providerStore` · `accountsStore` 四件同职责（状态）⇒ 是否该建 `store/`？给结论（注意 D2 门槛：≥3 件 ⇒ 达标）。
7. **是否存在"看似 settings、其实属于别域"的件**（例：模型/provider 相关件是否该属 `agent` 或 `generate`）——按 §4 四件证据判。

### `creative`
8. **`creative` 到底是不是一个域（成因 F · 必答）**：用 L1 两条判；若它其实是 `image` 或 `canvas` 的一部分 ⇒ 报 `非本域·应属 X`（但**本轮不搬**）。若它是独立域，给出**域内结构方案**（子域划分 + 达标性）。
9. **`creative-library.css` 一类样式件的落点**：它随域在哪？给结论。

## 4. 线索（只是线索 · 不是结论 · 可能已过期）

> **不要照抄**。每条用 `refs`/`ls`/`grep` 现场复核；对不上按实测记录，并标进「描述过期」。

- `TD-25-31`：`src/hooks/useScriptBoxEngine.ts` → 属 scriptbox（由 TASK-029 报送，你第二波复核）。
- `TD-18-38`：前端 AI 中继（`generate` + `pollTask` + `relayProxy`，约 919 行）平铺在 `base/api` —— 若它服务 `generate` 域/本域某处，由 TASK-028 报送。
- `TD-03-21`：素材"一物覆盖三处"（`resourceStore` + 素材 UI + `librarySource`）—— 涉及 `resource` 域（TASK-029），你若在 creative 里发现素材类重复实现，登记（成因 H）。
- `base/prompt/` **计划要求搬空即删**（A6），目标域是 `prompt/`（TASK-029 的地）—— 不是你的活，别越界。
- **闸历史（成因 B）**：`strict-src-whitelist.json` 里 `src/components/scriptbox/` **是白名单目录**（受"0 隐式 any"收口）。若你提出子域划分方案，请在「判据缺口」里提醒裁判：**白名单是按目录前缀匹配的，域内搬迁后必须同步白名单**（2026-09-19 已发生过一次"覆盖 15→4 件"的缩水）。

## 5. 输出

按 **TASK-022 §7** 的格式，**三个域各一套**（主表 + 末尾小节），并在末尾加一张**三域汇总**：

```
## 三域汇总
| 域 | 扫描件数 | 本域·合规 | 域内错位 | 非本域 | 待核 | 域根散件数 | 主要成因 |
```

## 6. 验收补充（除 TASK-022 §9 外）

- [ ] 三个域各自的 `find` 输出**每一件**都在各自主表出现。
- [ ] `scriptbox` 给了**子域划分方案**（逐件去处 + 达标性依据）。
- [ ] `creative` 是否成域**给了明确结论 + L1 证据**。
- [ ] `Select.tsx` 的归属（scriptbox 内部件 / 横切 UI kit）**给了明确结论 + 四件证据**。
