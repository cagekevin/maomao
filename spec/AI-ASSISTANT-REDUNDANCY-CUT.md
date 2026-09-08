# AI 助手冗余代码砍除提案（仅文档，不动代码）

> 背景：用户判断 AI 助手中间堆了很多没意义的多余东西。最典型的是 `runMode`/`workMode`——执行模型在 2026-09-05 已收敛为**恒 `auto`**，但整套"模式机制"还作为兼容骨架留着：一堆"忽略入参、恒返回 `'auto'`"的空函数、一个永远只含 `auto` 的定义表、一个 UI 从不消费的再导出。本文件只列"该砍什么 + 怎么砍"，不含任何代码改动。

---

## 0. 总原则：为什么这些是多余的

执行模型只剩 `auto` 一种模式后，原三态（direct / step-confirm / auto）的"可变性"已消失。凡是下面三种形态，都属于该砍的死重：

1. **忽略入参、恒返回常量的函数**：`normalizeWorkMode`、`resolveWorkMode`、`getSystemPromptForWorkMode`、`resolveConvRunMode`、`getCurrentRunMode`、`resolveSkillExecutionRules` —— 形参全是 `_`/`_raw`，逻辑不可达。
2. **只为兼容历史数据而存在的写回路**：`setWorkMode` 恒写 `'auto'`、`registerRunModeSync` 把 `conv.runMode` 恒拍成 `'auto'`、`getWorkMode` 读出来再幂等回写 `'auto'`。
3. **永不产出的类型分支 / 永不消费的导出**：`RunMode = 'step-confirm' | 'auto'` 的 `'step-confirm'`、`getCurrentRunMode`/`setCurrentRunMode` 在 `conversationStore`/`useAgentChat` 再导出但 `AgentPanel` **0 消费**、`INPUT_MODE_STORAGE_KEY` 已无写入方。

> 根因：每次"删了其它模式但保留注册表兼容"都是一次增量包袱。累积下来就变成现在这种"全链路恒 auto 的空壳"。

---

## 1. 砍除清单（按文件）

### 1.1 `src/components/agent/runtime/runModeRegistry.ts` —— 整模块删除
整文件 128 行，全部是"恒 auto"的封装。可删除。

- 其中**唯一还有实际内容**的是 auto 的系统提示词文本（`WORK_MODE_DEFS.AUTO.systemPrompt`，约第 43–44 行）。把它**提升为一个纯常量**到 `agentConfig.ts` / `agentCore.ts` 里，例如：
  ```ts
  export const AUTO_MODE_SYSTEM_PROMPT =
    '【生图执行粒度：完全自主】你完全自主地建节点/生成/操作画布，直接执行，无需用户确认。需要烧积分时有积分确认闸在必要处拦一下。';
  ```
- 删除：`RUN_MODE_IDS`、`WorkMode`、`DEFAULT_WORK_MODE`、`WorkModeDef`、`WORK_MODE_DEFS`、`normalizeWorkMode`、`resolveWorkMode`、`getSystemPromptForWorkMode`、`resolveConvRunMode`、`_legacyRunModeReader`、`registerLegacyRunModeReader`、`runModeSyncHook`、`registerRunModeSync`、`safeContentGet`、`safeContentSet`、`getWorkMode`、`setWorkMode`、`WORK_MODE_STORAGE_KEY`、`INPUT_MODE_STORAGE_KEY`。

### 1.2 `src/components/agent/conversation/conversationAiState.ts` —— 删 `runMode` 段（约 40–72 行）
- 删除 `registerLegacyRunModeReader(...)`、`registerRunModeSync(...)` 两段调用（47–58 行）。
- 删除 `RunMode` 类型（61 行）、`getCurrentRunMode`（64–66 行）、`setCurrentRunMode`（68–72 行）。
- 同步删除顶部 import 中对 `runModeRegistry` 的依赖（32–38 行的整段 `import { ... } from '../runtime/runModeRegistry.ts'`）。

### 1.3 `src/components/agent/conversation/conversationState.ts` —— 删持久化字段
- `Conversation.runMode: 'auto' | 'step-confirm'`（190 行）：删除。
- `RawConversation.runMode?: unknown`（213 行）：删除。
- 相关注释（652–653 行"runMode 兼容字段一律归 auto"）一并清理：现在没有这个字段，注释失去对象。
- **第 654 行 `c.runMode = 'auto';` 这行实际赋值也要删**：删掉 `runMode` 字段后它变成对不存在属性的写入（因 `Conversation` 带 `[key:string]: unknown` 索引签名，不会编译报错，会静默沦为无意义死写）。

### 1.4 `src/components/agent/runtime/agentCore.ts` —— 去掉 `workMode` 形参链路
- `buildRequestMessages(..., workMode, ...)` 中的 `workMode` 形参：删除；调用方不再传。
- 第 360 行 `getSystemPromptForWorkMode(workMode)` → 直接 inline `AUTO_MODE_SYSTEM_PROMPT`（来自 1.1 的常量）。
- 第 352 行 `resolveSkillExecutionRules(workMode)` → 直接 inline `SKILL_EXECUTION_RULES`（函数本体就是 `return SKILL_EXECUTION_RULES`，`workMode` 形参从没用过）。
- 删除 `resolveSkillExecutionRules` 定义（143–145 行）和 `import { getSystemPromptForWorkMode, RUN_MODE_IDS }`（46 行）。
- 第 42 行 `import type { WorkMode } from './runModeRegistry.ts'`：删 `workMode` 形参与 `resolveSkillExecutionRules` 后，该类型导入不再被任何符号引用，必须一并删除（否则 `noUnusedLocals` 报错）。
- 第 321 行 `workMode: WorkMode = RUN_MODE_IDS.AUTO` 这一整段形参（含默认值）删除；注意 `buildRequestMessages` 末尾还有 `mode: 'canvas' | 'table'`（322 行），调用方 `useAgentChat.ts:705` 删 `getWorkMode()` 实参后，`mode`（706 行）仍正确落在 322 行形参上，不要动它。

### 1.5 `src/components/agent/runtime/useAgentChat.ts` —— 断掉运行时调用
- 第 705 行 `getWorkMode()` 调用及其作为 `workMode` 实参的传递：删除（对应 1.4 的形参删除）。
- 第 106–107、111 行 import / 类型中 `getCurrentRunMode`/`setCurrentRunMode`/`getWorkMode`：删除。
- 第 303–304、1117–1118 行 hook 返回对象里的 `getCurrentRunMode`/`setCurrentRunMode`：删除（UI 从没消费，见 1.6）。

### 1.6 `src/components/agent/conversation/conversationStore.ts` —— 删再导出
- 第 238–239 行 `getCurrentRunMode`/`setCurrentRunMode` 的 import、第 261 行 `export { getWorkMode, setWorkMode }`：删除。

### 1.7 `src/components/agent/index.ts` —— 删桶导出
- 第 69–76 行：第 69 行注释 + 第 70–76 行整块 `export { getWorkMode, setWorkMode, RUN_MODE_IDS, DEFAULT_WORK_MODE, WORK_MODE_STORAGE_KEY } from './runtime/runModeRegistry.ts'` 全部删除（对外 API 不再暴露已死的"模式"概念；`RUN_MODE_IDS`/`DEFAULT_WORK_MODE`/`WORK_MODE_STORAGE_KEY` 同样来自即将删除的模块，只删 71–72 会留下 73–75 的**悬空 import**，编译直接报错）。

### 1.8 `src/components/base/core/contracts.ts` —— 更新收口描述
- 第 4 行顶部注释、第 34 行注释中提及 `runModeRegistry.js` / 三态模式处：改为"执行模型恒 auto，模式注册表已删除"。
- 第 372–377 行 `agent_work_mode` 整个 STORAGE_KEYS 登记条目：`getWorkMode`/`setWorkMode` 删除后该键再无任何读写方，属死登记，整条移除（含第 374 行 `store: 'runModeRegistry.js'` 与第 376 行 note）。

### 1.9 `src/components/base/store/settingRegistry.ts` —— 清注释
- 第 3 行注释里"与 runModeRegistry.js（WORK_MODE_DEFS）同族"：去掉对 runModeRegistry 的引用。

### 1.10 测试清理
- `tests/unit/runModeRegistry.test.ts`：整篇测的就是即将删除的注册表，随模块一起删除。
- `tests/unit/creditGateModes.test.ts`：其中把 `runMode` 当死状态处理的断言（注释已写明 credit 与模式正交）应去掉对 `runMode` 的依赖，只保留 credit 闸本身；**第 96 行 `import type { RunMode } from '...conversationAiState.ts'` 一并删除**（`RunMode` 类型随 `conversationAiState` 清理后该导入悬空）。
- `tests/unit/conversationStore.test.ts` / `AgentPanel.test.tsx` / `useAgentChat.hook.test.ts`：去掉对 `getWorkMode`/`getCurrentRunMode` 的 mock 与断言（grep 已确认这些测试里有引用）。
- `tests/unit/canvasAgentTools.test.ts`：**§1.10 初稿漏列，必须补**：第 39–40 行 `getCurrentRunMode`/`getWorkMode` 的 `vi.fn()` mock、第 667 行 `vi.mocked(convStore.getWorkMode).mockReturnValue('auto')` 都要删——后者在 `getWorkMode` 删除后 `convStore.getWorkMode` 不存在，`vi.mocked(undefined)` 运行时会直接抛错。

### 1.11 `inputMode` / `INPUT_MODE_STORAGE_KEY`
- 全仓已无 `inputMode` 的**写入方**（direct 模式删除后不再产出 image 值）。仅 `runModeRegistry.ts:19` 与 `AgentPanel.tsx:844` 注释提及。删掉 `INPUT_MODE_STORAGE_KEY` 常量与注释里的 `inputMode`。

---

## 2. 明确**不是**冗余、不要砍

- **`show_plan_for_confirm`**：这是 LLM 真实调用的工具 + 有 `awaitingConfirm` 门禁逻辑（`useCanvasAgentTools.ts:1224`、`agentRuntime.ts:536` 等）。auto 下它"仅展示不进 awaiting"，但工具本身与确认交互是真实的，保留。
- **`CANVAS_AGENT_RULES` / `SKILL_EXECUTION_RULES`**：真实 system 提示词常量（`CANVAS_AGENT_RULES` 在 `agentCore.ts:128`，`SKILL_EXECUTION_RULES` 在 `agentCore.ts:137`，定义均收口到 `agentConfig.ts`）。`resolveSkillExecutionRules` 才该砍，常量本身保留（已 inline 到调用点）。
- **`conv.runMode` 之外的会话字段**：`pendingMemorySuggest`/`referenceImages`/`globalContract` 等都是真源数据，与模式无关。
- **`credit` 积分闸**：与模式正交，是独立真功能，不碰。

---

## 3. 改动后形态（before / after）

**Before（调用链）**
```
useAgentChat → getWorkMode() → buildRequestMessages(workMode)
  → getSystemPromptForWorkMode(workMode)  // 恒返回 AUTO 文本
  → resolveSkillExecutionRules(workMode)  // 恒返回 SKILL_EXECUTION_RULES
conversationAiState：getCurrentRunMode/setCurrentRunMode/registerRunModeSync  // UI 0 消费
runModeRegistry：一整个"恒 auto"注册表
conv.runMode: 'auto' | 'step-confirm'  // 持久化但永远 'auto'
```

**After（调用链）**
```
useAgentChat → buildRequestMessages()  // 无 workMode 形参
  → 直接 inline AUTO_MODE_SYSTEM_PROMPT
  → 直接 inline SKILL_EXECUTION_RULES
conversationStore / useAgentChat 不再导出任何 runMode/getWorkMode
conv 上无 runMode 字段
runModeRegistry.ts 删除
```

净效果：删 1 个模块 + 约 15–18 处零碎引用（含 `index.ts` 73–75、`agentCore.ts:42`、`conversationState.ts:654`、`contracts.ts` 整条 `agent_work_mode` 登记等初稿遗漏项）+ 5 个测试文件改动（删 1 个、改 4 个），减少 ~200 行纯空壳，且消掉"看起来还能切模式、其实永远 auto"的误导性 API。

---

## 4. 建议的落地顺序（仅参考，本文件不执行）

1. 先把 auto 文本常量提进 `agentConfig.ts`，`agentCore` 两处 inline（1.1 + 1.4）。
2. 断 `useAgentChat` 的 `getWorkMode` 调用与 hook 返回（1.5）。
3. 删 `conversationAiState` runMode 段 + `conversationStore`/`index.ts` 再导出（1.2 + 1.6 + 1.7）。
4. 删 `conv.runMode` 字段 + `RawConversation.runMode`（1.3）。
5. 删 `runModeRegistry.ts` 整模块（1.1 余下部分）。
6. 清注释（`contracts.ts` / `settingRegistry.ts` / `AgentPanel` 注释）+ 清测试（1.8–1.11，含初稿漏列的 `canvasAgentTools.test.ts`）。
7. 跑 `vitest` 确认无悬空引用。

> 风险控制：第 1 步先保留常量、第 5 步才删模块，可保证中间态编译通过。砍完建议 grep 一次 `runMode|workMode|RunMode|WorkMode` 应只剩本文档提及的历史注释（可顺手清）。
