# 剧本盒子 · 状态层不变量收口与单一数据源（SSOT）

> **状态：执行指南（2026-09-08 整理，供他人落地）**
> **范围**：剧本盒子（`src/components/scriptbox/*`）。姊妹篇：
> `AI-ASSISTANT-TABLE-INVARIANTS.md`（表格域）、
> `AI-ASSISTANT-STATE-INVARIANTS-SSOT.md`（会话域）。
> 本文把同一套「收口方法论」套到剧本盒子，并**标注每条差距的必要性**，
> 避免把通用红线生套到本就稳定的节点模块上造成过度工程。
>
> **前置结论（已审代码确认）**：
> - SSOT **架构层已收口且比会话/表格域更干净**：playbook 用 `playbookId` 引用而非副本、
>   引擎每节点一个实例（无全局单例竞态）、失败均可见（toast/warn/finally 兜底）。
> - 不变量 **L4 校验网缺失**：全目录 0 处 `validate*`/`Violation[]`。但这对剧本盒子是
>   **可选增强**，非必修 bug（见第四节置信度标注）。
>
> **真源文件**：
> `scriptBoxPlaybookStore.ts`（playbook 真源）、`scriptBoxSchema.ts`（node.data 契约 +
> normalize）、`scriptBoxEngine.ts`（写漏斗 `commit=updateData`）、`scriptBoxPlaybookIO.ts`（导入校验）。

---

## 零、阅读约定

| 标记 | 含义 |
| --- | --- |
| ✅ | 已有保障，无需动 |
| ⚠️ | 部分保障 / 仅 warn 兜底 |
| ❌ | 无保障，但**须标注必要性**（剧本盒子场景可能非必修） |
| 🟡 | 差距存在，但**低必要性 / 可选增强**（避免过度工程） |

---

## 一、单一数据源（SSOT）—— 剧本盒子现状

> 剧本盒子的 SSOT 核心是 **「引用而非副本」**：`node.data` 只存 `playbookId`，
> 提示词配置真源在 `scriptBoxPlaybookStore`，彻底消灭「双份提示词」漂移。

### 分层

| 层 | 内容 | 可写？ |
| --- | --- | --- |
| **L0 真源** | playbook 内置=代码常量（`SCRIPT_BOX_WORKFLOWS`）；自定义=localStorage（`contentStore` 键 `scriptbox_playbooks`） | ✅ 经 `contentSet` |
| **L0 真源** | `node.data`（`ScriptBoxData`）= 画布节点态唯一真相 | ✅ 经 `updateData`（引擎内 `commit`） |
| L1 派生 | `getPlaybook(id)` 现读、引擎 `getData()` 读节点 | ❌ 读时计算 |
| L2 运行态 | `abortMap`/`patchQueue`（引擎每实例持有） | ❌ 纯内存，不落盘 |
| L3 兼容层 | 旧字段 `videoStatus`→`imageStatus` 迁移 | ❌ 只归一时读，运行时绝写 |

### 不变量（对照会话篇 SSOT-1~7）

| # | 不变量 | 现状 | 等级 |
| --- | --- | --- | --- |
| **SSOT-1** | playbook 唯一可写源；node.data 不存提示词副本 | ✅ `node.data` 仅 `playbookId`（`scriptBoxSchema.ts:25`）；写入全经 `contentSet`/`updateData` | ✅ |
| **SSOT-2** | 兼容层（旧字段）只读绝不写 | ✅ 仅 `normalizeScriptBoxData` 迁移时读（`scriptBoxSchema.ts:196`）；**无 `assertReadOnlyCompat` 守卫** | ⚠️ |
| **SSOT-3** | 统一读入口（`getPlaybook` / `normalizeScriptBoxData`） | ✅ 无散落读 raw | ✅ |
| **SSOT-4** | 派生禁止 `useState` 缓存会话数据 | ✅ 引擎 `createScriptBoxEngine` 工厂，**每节点一实例**，无全局单例（规避会话域 `currentAgentKey` 竞态） | ✅ |
| **SSOT-5** | 跨域经桥接（N/A） | — 剧本盒子无长期记忆域 | — |
| **SSOT-6** | 运行态不落盘 | ✅ `abortMap`/`patchQueue` 纯内存 | ✅ |
| **SSOT-7** | 防止双写漂移（序列化不另立键） | ✅ 随画布快照 `canvas-state-v1-{projectId}` 走（`scriptBoxSchema.ts:9`） | ✅ |

**结论**：SSOT 架构层是 ✅ 状态，比会话/表格域更彻底，**无需重写**。

---

## 二、不变量收口对照（L0~L5）

| 层 | 剧本盒子现状 | 等级 |
| --- | --- | --- |
| **L0 写漏斗** | ✅ 全部经 `commit=updateData` 函数式 patch（`scriptBoxEngine.ts:506` 等）；批量走 `createPatchBatcher` 累积合并防丢项（`:216`） | ✅ |
| **L1 生成收口** | ❌ playbook id 散落 `custom-${Date.now().toString(36)}${Math.random()...}`（`scriptBoxPlaybookStore.ts:157`） | 🟡 见注① |
| **L2 查找收口** | ⚠️ `getPlaybook` 悬挂仅 `logger.warn` 回退默认（`:103`），无 `requirePlaybook` 抛错钩子 | ⚠️ 低优先 |
| **L3 守卫收口** | ⚠️ 失败可见已落地（toast 默认 error、loadCustom 失败 warn、任务 finally `taskCtl.fail`），但 `normalizeScriptBoxData` 非对象 asset 静默给空（`scriptBoxSchema.ts:189`） | ⚠️ |
| **L4 不变量校验** | ❌ 无 `validatePlaybook`/`validateScriptBoxData`；仅 `parseImport` 基础 JSON 形状校验（`scriptBoxPlaybookIO.ts:59`） | 🟡 见注② |
| **L5 测试网** | ❌ 无错误注入用例 | 🟡 随 L4 |

**注①（L1 id 红线）**：违背 spec「禁止散落 `Math.random`/`Date.now` 拼 id」，但 playbook 不在多实例碰撞场景、且 `saveCustomPlaybook` 有 `isBuiltin` 守卫防覆盖，实际碰撞风险极低 → **低优先，可顺手收口到 `idGen.ts`，非必修**。

**注②（L4 校验网）**：会话层需 `validate*` 是因为流式/多 agentKey/网络恢复等复杂态；剧本盒子是**序列化随画布的节点模块**，数据来自本地快照、无运行时多源竞争，稳定性天然高。故 L4/L5 对剧本盒子是 **「增强项」而非「必修 bug」**，应按需、避免过度工程。

---

## 三、与表格篇 / 会话篇横向对比

| 维度 | 表格域 | 会话域 | 剧本盒子 |
| --- | --- | --- | --- |
| 真源 | `memory.assistantTables` | `states[agentKey]` | playbook 常量/localStorage + `node.data` |
| 写漏斗 | `setCurrentAssistantTabs` | `commit` | `updateData`（`commit`） |
| 引用 vs 副本 | 副本（表格数据内联） | 副本（conv 内联） | **引用（`playbookId`）✅ 最干净** |
| 全局单例竞态 | 无 | 有（`currentAgentKey`，待观察） | **无（每实例引擎）✅** |
| 校验基建 | ✅ `tableInvariants.ts` + 单测网 | ❌ 未收口 | ❌ 未收口（🟡 可选增强） |
| 失败可见 | 部分 | 部分静默 no-op | ✅ toast/warn/finally |

**剧本盒子在「SSOT 架构层」领先，在「L4 校验网」与会话域同处未收口**。

---

## 四、收口分批（标注必要性，避免过度工程）

| 批次 | 内容 | 必要性 | 风险 | 收益 |
| --- | --- | --- | --- | --- |
| **批 0** | `normalizeScriptBoxData` 非对象 asset 静默兜底加 `logger.warn` | 中（与现有失败可见风格对齐） | 零 | 立竿见影消除一处静默 |
| **批 L1** | playbook id 生成收口到 `idGen.ts` 登记前缀 | 🟡 低（仅风格/防极低概率撞车） | 零 | 消除散落，统一治理 |
| **批 1** | 补 `validateScriptBoxData`/`validatePlaybook`（I：shot/asset id 唯一；S：Playbook 形状；P：序列化体积）+ 错误注入单测 | 🟡 **可选增强**（非必修） | 零（只加校验不改逻辑） | 防回潮，但剧本盒子收益低于会话/表格域 |
| **批 2** | `getPlaybook` 悬挂加 `requirePlaybook` 抛错钩子供「必须命中」场景 | 🟡 低（当前 warn 已够用） | 低 | 写时即查 |

**建议**：只做 **批 0**（纯收益、零风险、消除唯一静默点）。批 L1/1/2 列为「可选增强」，由接手者按实际痛点决定是否投入——**不要为凑齐 spec 框架而过度改造一个稳定的模块**。

---

## 五、给执行者的红线提示

1. **不要重写 SSOT 架构层**：playbookId 引用、每实例引擎、序列化随画布——这三者已是最佳实践，动则引入回归。
2. **新增校验只加不改成**：`validate*` 必须返回 `Violation[]` 且**不改任何写逻辑**，与表格篇 `tableInvariants.ts` 同范式可复用。
3. **任何 fallback 必须出声**：沿用现有 `logger.warn` / toast 风格，禁止新增静默 no-op。
4. **id 生成统一 `idGen.ts`**：若补 playbook id，登记前缀（如 `pb`），禁止散落 `Math.random`/`Date.now`。
