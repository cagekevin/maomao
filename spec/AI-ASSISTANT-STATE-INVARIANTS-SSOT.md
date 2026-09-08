# AI 助手 · 状态层不变量收口与单一数据源（会话域，不含表格）

> **状态：待批准（2026-09-08 整理）**
> **范围**：表格以外的整个 AI 助手状态层（`src/components/agent/conversation/*` +
> `runtime/useAgentChat.ts` + `runtime/runModeRegistry.ts`）。表格域不变量见姊妹篇
> `AI-ASSISTANT-TABLE-INVARIANTS.md`，本文档不复述，只把同一套「收口方法论」落到会话层，
> 并复用其 `validate*` 基建思路（两篇共享 `validate*` 应该统一到 `conversation/` 下）。
>
> **前提结论（已实测确认）**：
> - 单一数据源**架构层已收口**：`conversationState.states[agentKey]` 是唯一可写源，`commit`
>   是唯一写漏斗，`useConversationStore`/`useStoreSelector` 是统一读入口；`useAgentChat`
>   的双源（`messages`/`messagesRef`）已消灭。
> - 不变量**未收口**：全仓 0 处 `validateConversation`/`validateMemory` 类校验；`normalize*`
>   只「补默认值」不「断言恒真」；大量写入口 `if (!conv) return` 静默 no-op，与表格「假成功」同源。
>
> **真源文件**：`conversationState.ts` / `conversationSnapshot.ts` / `conversationAiState.ts`
> / `conversationSkillState.ts` / `conversationStore.ts`（聚合入口）。

---

## 零、阅读约定

每条不变量标注**现状保障等级**（与表格篇一致）：

| 标记 | 含义 |
| --- | --- |
| ✅ | 已有保障（注明位置），只需补一条校验防回潮 |
| ⚠️ | 部分保障（靠调用方自觉 / 只在部分入口做了） |
| ❌ | **无任何保障**，纯靠运气，是首要收口对象 |

---

## 一、单一数据源（SSOT）—— 会话层现状

> SSOT 是所有不变量的前提：如果数据有两个来源，引用校验查了也白查（两源各自自洽、互不对不上）。

### 分层（只允许 L0 可写，其余全是派生或运行态）

| 层 | 内容 | 可写？ |
| --- | --- | --- |
| **L0 真源** | `conversationState.states[agentKey]`（`{conversations, activeId, sending}`） | ✅ **唯一可写**（经 `commit`） |
| L1 派生 | `getCurrentSnapshot()` / `getActiveConv()` / `useStoreSelector` 选段 | ❌ 读时计算 |
| L2 快照副本（不落盘） | `useAgentChat` 经 `setCurrentSnapshot` 写回的暂存 | ❌ 写必回 L0 |
| L3 运行态（不落盘） | `sending`（per-agentKey）、`hydratedSet`、`stateMachine` 的 `stateAction` | ❌ |
| L4 兼容层 | `memory.assistantTable`（老数据水合）、`conv.runMode`（历史持久化兼容） | ❌ **只读，绝不写** |
| L5 长期记忆（独立真源） | `projectMemoryStore`（agentKey 全局，≠ 对话记忆） | ✅ **独立真源**，经 `pendingMemorySuggest` 暂存桥接 |

### 不变量

| # | 不变量 | 违反后果 | 现状 |
| --- | --- | --- | --- |
| **SSOT-1** | `states[agentKey]` 是会话数据唯一可写源；外部不得直改 | 双写失同步 | ✅ `states` 模块私有，`commit` 唯一写漏斗（`conversationState.ts:581`） |
| **SSOT-2** | 兼容层（`memory.assistantTable` / `conv.runMode`）只读，绝不写 | 老数据"复活" | ⚠️ 只靠注释（`conversationAiState.ts:114` / `:654`），**无守卫、无测试** |
| **SSOT-3** | 所有消费方走 `useConversationStore`/`useStoreSelector` 单一读入口，禁止各自读 raw + 各自 `normalizeConversation` | 同一份 raw 被归一多次 → 造出两套对象引用 | ⚠️ `getConversations()`（`conversationStore.ts:45`）每次返回 fresh 副本，安全但制造重复引用；无脚本禁裸 `normalizeConversation(` |
| **SSOT-4** | 派生数据必须 `useStoreSelector`/`useMemo` 派生，**禁止 `useState` 缓存会话数据** | 数据副本失同步 | ✅ `useAgentChat.ts:318-349` 已全订阅；仅 `error`/`model`/`stateAction` 留 `useState`（纯展示态，正确） |
| **SSOT-5** | 长期记忆 ≠ 对话记忆；桥接必须经 `pendingMemorySuggest` 暂存，禁止把长期记忆当对话 `memory` 写回 | 跨对话污染 / 长期记忆被对话态覆盖 | ⚠️ 桥接路径存在，但**无守卫**确保 `setCurrentMemory` 不误写长期记忆 |
| **SSOT-6** | 运行态（`sending`/`hydrated`）不落盘，或仅 per-agentKey | 切项目串态 | ✅ `sending` 仅内存（`conversationState.ts:593`）；`hydratedSet` per-key |
| **SSOT-7** | 撤销栈 `aiUndoStack` 是历史副本，不得当数据源读 | 读到过期数据 | ✅ 仅 `pushActiveAiUndo`/`popActiveAiUndo` 读写 |

### 🔴 与表格域同源的缝隙

- **静默 fallback（会话级 I5/T2 翻版）**：`getActiveConv()` 找不到返回 `null`
  （`conversationState.ts:604`）；`ensureActiveConversation`/`applyConversation` 找不到目标则
  静默回退 `conversations[0]`（`conversationStore.ts:62`/`:93`）；写入口 `if (!conv) return`
  静默 no-op（`conversationAiState.ts:87` 等）。**违反不报、不变红** → 「假成功」温床。
- **`currentAgentKey` 是全局单例**：多 agentKey 切换靠单例 `currentAgentKey`（`conversationState.ts:262`）
  + `prevAgentKeyRef` abort（`useAgentChat.ts:477`）防串台。AgentPanel 单实例无差，但本质是
  「单一全局当前 key」而非「多实例各自持有」——并发多实例会有竞态风险（目前无多实例，标记待观察）。

---

## 二、ID 与引用完整性（I，会话级）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **I1** | conversation id 全局唯一 | `getState().conversations.find` 取错对话 | ✅ `uid('ac')`（`conversationState.ts:632`） | 校验 + 生成收口 |
| **I2** | message id 稳定唯一（P15） | 列表 key 重挂载 / 流式占位错位 | ⚠️ `normalizeConversation:622` 补 id 但**不查重**（撞号只静默留原） | 校验（error 级） |
| **I3** | `activeId` 恒指向存在的 conversation | 静默回退 `conversations[0]` → 用户以为在对话2、写进对话1 | ⚠️ 有回退但**静默** | 回退处加 `logger.warn` |
| **I4** | `pending.messageId` 指向存在的 message（刷新恢复） | 恢复空转 / 误重发 | ✅ `resolvePendingRecovery` dangling-safe（`useAgentChat.ts:455` 清 pending） | 补校验 |

---

## 三、结构边界（S）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **S1** | `messages.length ≤ AGENT_MSG_MAX`（=60） | 整包无限膨胀 | ✅ `setCurrentSnapshot:77` / `patchCurrentMessages:122` 均 `slice(-AGENT_MSG_MAX)` | 校验（断言） |
| **S2** | `workflow.status` ∈ 合法集 | 状态机走死分支 | ⚠️ `normalizeWorkflow:663` 缺省归 `'planning'` 静默 | 校验（warn 级未知值） |
| **S3** | `creditGate` 形状合法（`pending`+`gens[]`+`map{}`） | 积分闸误触 / 永拒 | ✅ `isCreditGate` 读侧守护（`conversationSkillState.ts:92`）；`setCreditGate:117` 写侧校验 | 补单测断言「非法 shape 必被拒」 |
| **S4** | `global_contract` 三字段恒 string | 契约键为 undefined | ✅ `normalizeMemory:720` | 校验 |
| **S5** | `runMode` 恒 `'auto'`（历史值归一） | 执行模型漂移 | ✅ `conversationState.ts:654` 强制；但**类型仍 `'auto'\|'step-confirm'` 是谎言**（F25 类） | 类型收窄为 `'auto'` |

---

## 四、多对话隔离（T，防串台）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **T1** | `referenceImages` / `pending` / `aiUndoStack` / `pendingGenerations` 全 per-conversation | 跨对话泄漏参考图 / 恢复串台 | ✅ 全挂 `conv.*` | 校验（切对话后清空） |
| **T2** | 切 agentKey 中断旧 key 进行中流（卸载不断流） | 两项目流串台 | ✅ `useAgentChat.ts:477` `prevAgentKeyRef` abort | 校验（旧流 abort） |
| **T3** | 对话列表 `conversations.length ≥ 1`（不做零对话态） | 空指针 | ✅ `ensureActiveConversation`/`deleteConversation` 兜底建空 | 校验 |

---

## 五、落盘与契约（P）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **P1** | 落盘序列化体积 ≤ `SAFE_BUDGET_BYTES` | `QuotaExceededError` 丢对话 | ✅ `applyConversationBudget` 投影降级（`conversationState.ts:278`） | 校验（降级后断言体积） |
| **P2** | 落盘失败**可见**（不静默吞） | 用户不知内容没存上 | ✅ `logger.warn` + `reportDegrade`（`conversationState.ts:298`） | 校验（失败必上报） |
| **P3** | 未水化（hydrated=false）禁止落盘 | 挂载覆盖存量 | ✅ `commit` 守卫（`conversationState.ts:585`） | 校验 |
| **P4** | 流式中间态（streaming:true 占位）不落最终态 | 刷新看到半截气泡 | ✅ `endStreaming`/`stripStreaming`；`patchCurrentMessages` `persist:false` | 校验（终态无 streaming） |

---

## 六、不变量收口方法论（怎么收口）

> 与表格篇「五层收口」对齐。核心思想：**把「散、补、静」转成「集中、断言、可见」**。
> 校验基建（`validateConversation`/`validateMemory`/`validateWorkflow`）**应与表格篇
> `tableInvariants.ts` 同处 `conversation/` 下**，两域共享「`Violation[]` + 单测网」范式。

### L0 · 单一入口收口（最优先，其它层前提）

1. **写漏斗已收口（`commit`），强化「写前校验」**：在 `commit` 内、`persist` 之前接入
   `validateStoreState(getState())`，dev 下 `console.warn` 违规项（硬约束 error 可抛）。
2. **读入口收口**：加脚本/code-review 规则，禁止 `conversationState.ts` 之外裸调
   `normalizeConversation(`/`normalizeMemory(` 当「读时复制」用——只读入口统一走
   `getCurrentSnapshot`/`getActiveConv`。
3. **消灭静默 no-op**：`getActiveConv()` 返回 null 的调用点，改为 `requireConv()`（必须命中
   则抛错）或 at least `logger.warn`；`ensureActiveConversation`/`applyConversation` 的静默
   回退处加 `logger.warn('AI助手','activeId 指向不存在对话，已回退', {id})`。

### L1 · 生成收口（零风险）

- `conv`/`msg` id 已走 `uid('ac')`/`generateId('msg')`（`idGen.ts`），集中、无双前缀撞车
  （注意表格 `generateId('tab')` 与 `useCanvasSync` 的窗口 id 撞前缀是 table 域问题，不在此）。
- 若新增 id 类型，统一在 `idGen.ts` 登记前缀，禁止散落 `Math.random`/`Date.now` 拼 id。

### L2 · 查找收口（禁止静默）

- 新增 `requireConv(state, id): Conversation` —— 找不到**抛错**，供「必须命中」场景
  （`setCurrentGlobalContract`/`setCurrentArtifacts`/`markMessageTableResolved` 等写入口）。
- 现有 `getActiveConv` 保留（可为 null），但所有「写前必命中」处改用 `requireConv`。
- `activeId` 静默回退（`:62`/`:93`）保留兜底（不能崩），但加 `logger.warn`。

### L3 · 守卫收口（把「假成功」转「可见错误」）

- 写入口 early-return `if (!conv) return` → 改为 `if (!conv) { logger.warn(...); return; }`，
  让「写没生效」可见而非静默。
- `runMode` 类型谎言（S5）：把 `RunMode` 类型收窄为 `'auto'`，删除 `step-confirm` 兼容分支
  （历史数据已由 `normalizeConversation:654` 归一，无运行时分支依赖）。

### L4 · 不变量校验（真正防回潮的一层）

```ts
/** 返回违规描述数组；空 = 健康。硬约束违规 → error，可疑 → warn */
export function validateConversation(conv: Conversation): Violation[];
export function validateMemory(mem: ConversationMemory): Violation[];
export function validateWorkflow(wf: WorkflowState | null): Violation[];
```

**检查项**（对应上文 I/S/T/P）：

*硬约束（error）*
- I2 message id 唯一；**I3 `activeId` 有效**；S1 `messages.length ≤ AGENT_MSG_MAX`；
  S3/S4 creditGate/global_contract 形状；P1 体积；P4 终态无 `streaming:true`

*警告（warn）*
- S2 未知 `workflow.status`；T1 切对话后残留；S5 非 auto 的 `runMode`；**SSOT-2 兼容层被写**

**接入点**：
1. `normalizeConversation`/`normalizeMemory` 出口 + `commit` 落盘前（dev 下 `console.warn`）
2. **单测通用断言**：所有会话纯函数用例末尾跑 `expect(validateConversation(conv)).toEqual([])`

### L5 · 测试网（防回潮的最后一公里）

- 新增 `tests/unit/conversationState.invariants.test.ts`：覆盖每条 I/S/T/P。
- **错误注入用例**：故意把 `activeId` 设成不存在的 id / 删一个 message 的 id，断言
  `validateConversation` 报 error —— 确保校验本身有效（否则校验像没写）。

---

## 七、单一数据源方法论（怎么保证）

> SSOT 不是「一份数据」就完事，而是**写有唯一漏斗、读有唯一入口、兼容层只读、跨域经桥接**。

### 原则清单（code-review 红线）

1. **唯一可写源**：会话数据只经 `commit` 写 `states[agentKey]`；外部零直接写。新增写路径
   必须走 `conversationStore` 的 `set*` 函数，禁止在组件/hook 里持有可变副本再回写。
2. **唯一读入口**：UI 经 `useConversationStore`/`useStoreSelector` 订阅；逻辑经
   `getCurrentSnapshot`/`getActiveConv`。禁止「读 raw + 各自 `normalizeConversation`」造第二份。
3. **兼容层只读 + 守卫**：`memory.assistantTable` / `conv.runMode` 等老字段只在水合时读，
   写侧加 `assertReadOnlyCompat` 守卫（违反即 warn）。
4. **per-conversation 隔离**：一切运行时/暂存态挂 `conv.*`，禁止模块级跨对话共享（除
   `states`/`hydratedSet` 这两个必要单例，且必须 per-key）。
5. **跨域经桥接**：长期记忆（`projectMemoryStore`）≠ 对话记忆（`memory`）。写入长期记忆
   **只**经 `confirmPendingMemorySuggest`（由 `pendingMemorySuggest` 暂存确认后落库），
   禁止把对话 `memory` 直接当长期记忆写回。
6. **运行态不落盘**：`sending`/`stateAction` 等纯展示态只在 hook 内 `useState` 或 per-key
   内存，`setCurrentSnapshot` 不序列化它们。
7. **禁止静默兜底**：所有 fallback/early-return 必须 `logger.warn`（把「假成功」转可见错误）。
   崩不得的场景保留兜底，但**兜底要出声**。

### 实施护栏（让红线不被悄悄绕过）

- **写前校验**：`commit` 内接 `validateConversation`（L4），dev 下硬约束 error 可抛。
- **单测网**：每条不变量一个错误注入用例（见 L5）。
- **脚本守卫**：code-review / lint 规则禁止：
  - 在 `conversationState.ts` 之外裸 `states[` 直写；
  - 裸 `normalizeConversation(` 当读时复制（应走 `getCurrentSnapshot`）；
  - 裸 `generateId` 用未登记前缀。
- **类型诚实**：`RunMode` 收窄为 `'auto'`；`memory.assistantTable` 标注 `@deprecated 只读`。

---

## 八、与表格篇的关系

| 维度 | 表格域（`AI-ASSISTANT-TABLE-INVARIANTS.md`） | 会话域（本文） |
| --- | --- | --- |
| 真源 | `memory.assistantTables` | `states[agentKey]` |
| 写漏斗 | `setCurrentAssistantTabs` | `commit` |
| 读入口 | `useActiveAssistantTable()` | `useStoreSelector`/`getCurrentSnapshot` |
| 校验基建 | `tableInvariants.ts`（`validateTabs`/`validateWorkspace`） | **建议与表格同处 `conversation/`**，新增 `validateConversation` 等 |
| 共同根因 | 静默 fallback / 双源 / 无 `validate` | 同左（会话级翻版） |

两篇共享同一套「五层收口 + `Violation[]` + 单测网」范式；`validate*` 系列应统一到
`conversation/` 下，避免表格、会话各写一套校验骨架。

---

## 九、落地分批（风险递增）

| 批次 | 内容 | 风险 | 收益 |
| --- | --- | --- | --- |
| **批 0** | 消灭静默 no-op：`getActiveConv` 静默 fallback 加 `logger.warn`；写入口 early-return 出声 | 低 | 把「假成功」转为可见，立竿见影 |
| **批 1** | `validateConversation`/`validateMemory`/`validateWorkflow` + 单测网 + 错误注入用例 | **零**（只加校验，不改写逻辑） | 拦住未来绝大多数同类 bug |
| **批 2** | `commit` 内接写前校验（dev warn）；`requireConv` 替换「必须命中」写入口 | 低 | 写时即查，不等用户踩 |
| **批 3** | `RunMode` 类型收窄为 `'auto'`；SSOT-2 兼容层守卫 | 低 | 消除类型谎言 + 老数据复活 |
| **批 4** | `projectMemoryStore` 桥接守卫（确保 `setCurrentMemory` 不误写长期记忆） | 中 | 消除跨域污染 |

**顺序建议**：批 0（先出声）→ 批 1（先立护栏）→ 批 2/3/4。
