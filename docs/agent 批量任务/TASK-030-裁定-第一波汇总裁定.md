# TASK-030 · 裁判裁定（第一波汇总）

> **裁定人**：主 agent（裁判）· **裁定日期**：2026-09-19
> **依据**：ADR-0040（L1–L4）· ADR-0042（D1 / 判据 5 / 判据 6）· `scripts/check-arch.mjs` 现行规则原文（**闸是判据的可验证形态，优先级高于域主的口径推断**）
> **本轮状态**：**只裁定，不搬**。执行排第二波之后，逐域串行。

---

## 一 · 收表情况

| 任务书 | 域主 | 件数 | 合规 | 域内错位 | 非本域 | 待核 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-023 | image | 27 | 24 | 3 | 0 | 0 | ✅ 已交 |
| TASK-024 | video | 13 | 13 | 0 | 0 | 0 | ✅ 已交 |
| TASK-025 | canvas | 50 | — | — | **2** | — | ✅ 已交 |
| TASK-026 | agent | 62 | 58 | 2 | 0 | 2 | ✅ 已交 |
| TASK-027 | scriptbox+settings+creative | 43 | — | — | **0** | 2 | ✅ 已交（送出 0） |
| TASK-028 | **base 横切层** | 85 | — | — | — | — | ❌ **未交**（所有"送往 base"的件暂无认领方） |
| TASK-029 | 小域+hooks+types | 33 | 25 | 0 | 0 | **8** | ✅ 已交 |

**全批送出「非本域」仅 2 件**（canvas 2 件）· **待核 12 件**（hooks 8 + agent 2 + creative/.DS_Store + settings 口径冲突 1）。

---

## 二 · 裁定 1：`canvas/backupStore.ts` —— **报出成立，落点改判 `base/store/`**（非 `canvas`）

**域主结论**：非本域 ⇒ 应回 `base/store/`（成因 C，置信中）
**裁定：认。** 并追加一条域主没看到的证据 —— **架构闸已经把它写进白名单**：

```
scripts/check-arch.mjs:1472-1500（规则 11 · 云同步范围白名单）
const GETLOCALKEYS_LEGIT = new Set([
  'src/components/base/core/contracts.ts',      // 定义处本身
  'src/components/base/store/cloudSync.ts',     // 云同步范围（∩ getSyncKeys()）
  'src/components/canvas/backupStore.ts',       // 备份范围（全量；备份 ≠ 同步）· 2026-09-19 域归位迁入 canvas
                                                // （旧路径 base/store/backupStore.ts 已失效 ⇒ 未同步即假红 TD-25-21）
]);
```

**裁定理由（三条，从强到弱）**：
1. **数据落点 = 全量 localStorage**（`backupStore.ts:60 LS_KEYS = getLocalKeys()`）—— **全量**意味着它**不认识任何单域** ⇒ 零业务语义 ⇒ 它不可能"属 canvas"。
2. **它与 `base/store/cloudSync.ts` 是同一族**（一个是同步范围、一个是备份范围；规则 11 把二者并列为合法消费者）⇒ 同族件同落点。
3. **界面位置 = App 层工具栏**（`src/App.tsx:72`），宿主层功能，不是画布视图。

**推翻的记录**：`TD-25-21`（"`base/store/backupStore.ts` 仅被 canvas 消费 ⇒ 迁 canvas"）**处置有误** —— 它按"直接 fan-in 只数到一个 canvas 件"做判定，正是 **ADR-0042 判据 5 禁止的只看直接 fan-in**。⇒ 该笔债的处置**必须回改**（不是新债）。

**执行的连带动作（第二波）**：搬之前/之后**必须同步 `check-arch.mjs` 规则 11 白名单**（`canvas/backupStore.ts` → `base/store/backupStore.ts`），否则该条**当场假红**。这是"搬迁必须同步闸"的第 2 个实证（第 1 个：拆 `canvas/nodes` 后 `check-node-handles` 豁免失灵）。

---

## 三 · 裁定 2：`canvas/parts/JianyingIcon.tsx` —— **并案成立，落 `base/ui/`**

**域主结论**：并案（共享件）⇒ 建议 `base/ui/`
**裁定：认。** 追加口径（补 L3 的缺口）：

> **2 域件口径**：`ADR-0040 L3` 要求 ≥3 域才对"有业务语义"的件成立横切；但对**零业务语义的纯展示件**，**≥2 域消费即归横切 UI kit**。
> 理由：留下任何一域都会让另一域"跨域私取"（`image/nodes/ImageGenerate.tsx:571` + `video/nodes/VideoGenerate.tsx:289`），而 L3 的 ≥3 门槛本意是防"业务语义件被误判成横切"，纯 SVG 图标无此风险。

**证据已足**：零数据落点（`:1` 仅 `import React`）· 本域 0 处渲染 · 2 域各 1 处渲染。

---

## 四 · 裁定 3：`agent/canvas/` 三件 —— **不认**（维持 `agent/canvas/`）

**请求方**：TASK-026（agent 域主）请 canvas 复核（三项选择：认领/不认/并案）
**裁定：不认（维持现状）。** 并**定死口径**（这是本批唯一真正的双边冲突）：

> **L1 双侧冲突口径**：当「界面位置」与「数据落点」指向相反时，按 **① 驱动方 ② 唯一消费域** 判；**不采用"数据落点优先"**（那会把所有"能力件派生的结构件"都吸进 canvas，使 canvas 成为黑洞）。

**本案证据**：
- canvas 域对这 3 件**零消费**；agent 域 3 处消费（含门面 `agent/index.ts:64` 导出）
- 它们**同时写 agent 自己的数据**（会话 workflow/memory → `conversationStore`）⇒ 不是"只写画布"
- 它们是**单向** `→ @/components/canvas`（依赖方向健康）

---

## 五 · 裁定 4：`skillStore` / `agentModelStore` —— **不认并案**（维持 `agent/`）

同用裁定 3 的口径：数据真源在 agent（`contracts.ts` 登记 `domain:'agent'`）· 主消费方在 agent · settings 仅渲染管理 UI（`AgentChatSettings.tsx:221` 等）⇒ **驱动方 = agent**。

---

## 六 · 🔴 裁定 5：`src/hooks/` 8 件待核 —— **全部维持 `src/hooks/`（零搬迁）**，并推翻其"被锁死"理由

**域主（TASK-029）的说法**：8 件待核，其中 3–4 件"被 cross-cutting 件锁死 ⇒ 搬出触发**规则 2** 反依赖"。

**裁定：理由引错判据，但结论正确。**
- **规则 2 只管 `base/{core,utils,ui,api,storage}`**（`check-arch.mjs:403-405`：`BASE_CROSS_CUTTING` + `BASE_PREFIX='src/components/base/'`）⇒ **`src/hooks/` 根本不在管辖内**，"搬出触发规则 2"**不成立**。
- **但结论仍是"留"**，改用正确判据 —— 三条：
  1. **`src/hooks/` 是被闸承认的横切层**：规则 8（node/edge 写回唯一入口）**直接点名** `src/hooks/useNodeData.ts` / `useEdgeData.ts`（`check-arch.mjs:752-753, 863-870` 的报错文案即判据来源）⇒ 这两件**必须留**，搬走等于让闸的判据失效。
  2. **"App.tsx 根装配消费" ≠ 业务域消费** ⇒ **不触发 L4**（L4 管的是"只被一个**业务域**消费"；`App.tsx` 不是业务域）⇒ **没有判据要求它们搬家**。无据要求 ⇒ **维持现状**（`useArrangeCanvas` · `useCanvasShortcuts` · `useEdgeData` · `useCanvasSync` · `useAssetDropPaste` · `useNodeGeneration`）。
  3. **被横切管线条消费的 hook 属横切层**（`useResourceMoveToFolder` 被 `useAssetDragToCanvas` 消费 · `useSyncNodeData` 被 `useGenerateNode` 消费 ⇒ 这些管线条本身跨 canvas/image/text/video）⇒ 留。

**⇒ 推翻 TASK-029 对 `useEdgeData` 的"待核·候选 canvas"**（闸已把它定为写回唯一入口，属横切层铁件）。

**新增口径（写进 ADR-0040，第二波执行前落地）**：
> **L4-bis**：`L4` 的"单域"指**业务域**；`App.tsx` 根装配消费、以及被横切管线条（`src/hooks/` 内 ≥2 域消费的 hook）消费的件，**不触发 L4**，维持横切层。

---

## 七 · 裁定 6：域主提出的其余 16 个「判据缺口」

| # | 缺口 | 裁定 |
| --- | --- | --- |
| F-1 | 域根 hook 无处可去（image） | **D3 增 `hooks/` 职责名**（域内共享 hook）⇒ `image/useCopyNode.ts` · `useFitNodeRatio.ts` → `image/hooks/` |
| F-2 | 零业务语义 + 单域消费的落点 | 采纳：**留消费域**（`useCopyNode` 语义属通用，但只 1 域消费 ⇒ 留 image） |
| F-3 | 子域门面是否算第二份门面 | **子域门面合法**（域门面唯一 + 每域各一子域门面，且不得暴露域外未消费符号）⇒ **计划 §A5「删 `image/editors/index.ts`」推翻**（标 G） |
| F-4 | D2（≥3 件合并）与 D3（职责单一）冲突 | **D2 优先**：并进职责最近的现成子目录 ⇒ `cameraPrompt.ts` · `cameraStudio.ts` · `cameraParams/` 同居 |
| F-5 | 无数据落点件的证据②怎么写 | 允许 `—（无数据）`，但**必须**写"由谁侧效应 import" |
| video-① | 能力件派生的画布结构件随谁 | **随能力件**（同裁定 3 口径）⇒ `depthVideo/spawn.ts` 留 `video/` |
| video-② | 恰好 2 域消费的件 | 零业务语义 ⇒ 横切（同裁定 2）；**有业务语义 ⇒ 留主力域 + 登记例外** |
| video-③ | `captureFrame`：计划说迁 `video/lib`，门面头注说"已裁定留原处" | **留 `base/utils/`** —— 门面头注的"**已裁定**"优先于计划的行内目标；计划 §A6 该行标 **G（过期）** |
| video-④ | 节点注册类直连算不算绕门面 | **算装配点例外**（`NodePalette` / `lazyNode` 是构建期注册面）⇒ 但**须在域门面头补例外声明**（登记待办） |
| agent-1 | 契约件不足 3 件 | 采纳域主的 ②：**并案建 `agent/contract/`**，收 `agentTypes.ts` + `conversation/conversationTypes.ts` + `assistantTable/tableWorkspaceTypes.ts`（正好 ≥3） |
| agent-2 | 子能力目录内部是否再按 D3 分层 | **子能力目录 = 一级豁免**（内部不再拆）⇒ `assistantTable/` 的"假子域"风险自动消解 |
| agent-3 | 同一视图跨两子域 | 采纳：**由 `AgentPanel` 直接装配的面板壳归 `panels/`**，子能力内部视图归子能力目录 |
| agent-5 | 计划"不内部重构"是时序还是永久 | **时序**（本批不动；域主登记的 2 件错位**成立**） |
| agent-6 | `base/core/agentKeys.ts` 归属 | **归 `agent/`**（计划 §2 已改判；实测 agent 5 / App 1 / backupStore 零消费）⇒ 目标 `agent/runtime/`；**并入迁移矩阵**，待 TASK-028 认领 |
| 029-G2 | 类型件随域还是集中 | 采纳：**跨 ≥2 域共享的契约类型集中 `src/types/`；单域内部类型随域** |
| 029-G3 | 域存在性门槛 | 采纳：**节点类型（`cat`）即成域，与件数解耦** |
| 029-G4 | `promptHubStore.ts` 模块内订阅已删、0 消费 | **登记为债**（域内核死抽象，非归属问题），不在搬迁范围 |
| 023-测试桩 | `tests/unit/GridSplitNode.test.tsx:18` mock `OverlayEditor`，但被测件无 overlay 引用 | **登记为债**（测试桩过期），非域籍问题 |

---

## 八 · 第一波结论：**需要执行搬迁的只有 5 件**（其余是域内归位）

### A · 跨域（需第二波认领）
| 件 | 从 | 到 | 认领方 | 前置动作 |
| --- | --- | --- | --- | --- |
| `backupStore.ts` | `canvas/`（域根） | `base/store/` | **TASK-028（未交）** | 同步 `check-arch` 规则 11 白名单 |
| `JianyingIcon.tsx` | `canvas/parts/` | `base/ui/` | **TASK-028（未交）** | 无 |
| `agentKeys.ts` | `base/core/` | `agent/runtime/` | TASK-026 | 待 TASK-028 确认送出 |

### B · 域内归位（不需跨域认领，可直接执行）
| 件 | 从 | 到 | 域 |
| --- | --- | --- | --- |
| `useCopyNode.ts` · `useFitNodeRatio.ts` | `image/`（域根） | `image/hooks/`（新建） | image |
| `editors/cameraStudio.ts` | `image/editors/` | `image/editors/cameraParams/` | image |
| `agentTypes.ts` + 2 件契约 | 三个子域 | `agent/contract/`（新建） | agent |

### C · 清理项（非域籍）
- 删除 3 个 `.DS_Store`：`agent/` · `video/` · `creative/`
- **推翻/过期项**（回改，不是新债）：`TD-25-21` 处置 · `TD-25-11` / `TD-18-37` 已偿 ⇒ resolve · 计划 §A5 行（删 `editors/index.ts`）· 计划 §A6 行（`captureFrame`）

---

## 九 · 下一步（等指令）

1. **TASK-028（base 横切层）未交** ⇒ 2 件"送往 base"的件无人认领。要么等它交，要么我直接代判（我已给出裁定，只差执行）。
2. **第二波派单**：只需 3 个目标域复核（base ×2 件 · agent ×1 件）—— **其余 10 项我已直接裁定，不必再往返**。
3. **执行顺序**（逐域串行，每域搬完跑 `npx tsc --noEmit` + `node scripts/check-arch.mjs`）：先做**域内归位**（零风险，4 件）→ 再作**跨域 3 件**（带闸白名单同步）。
4. **本裁定未覆盖**：`videoEditor`(259) · `director3d`(30) —— 按用户裁定跳过，此二域内的错位**无人覆盖**（已知缺口）。
