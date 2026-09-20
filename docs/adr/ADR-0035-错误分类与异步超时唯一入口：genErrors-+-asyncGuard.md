# ADR-0035 · 错误分类与异步超时唯一入口：genErrors + asyncGuard

- **状态**：已毕业
- **结论**：错误→类型只由 genErrors.classifyError 判定；超时/释放/解析等异步语义只由 asyncGuard 承担。禁止自写关键词式网络错误判定，禁止无超时 Promise。
- **日期**：2026-09-19
- **裁定人**：架构师（归位取证；规则原文见 `spec/CONTEXT.md:113`）
- **触发**：TD-18-20 —— 该判决句长期只存在于 CONTEXT，`adr.mjs search` **0 命中**（违反 ADR-0025 判据 1）
- **与 ADR-0018 的关系**：互补，不重叠 —— **0018 决定"能不能重试"，本条决定"这是什么类型 / 有没有超时"**
- **补充（2026-09-20）**：**§判据 2 的 `classifyError(e) → { type, message, retryable }` 与 §违反判据 4 已过期** —— `retryable` 已被 **ADR-0046** 整体移出 `ClassifiedError`（实测 `genErrors.ts:49`，改由 `getRetryableObserved()` 显式观测）⇒ 判据 2 是过期事实、违反判据 4 从此**写不出来**。**判据本体（分类与超时的唯一入口）不变。**

## 背景

「错误/异步：统一走 `genErrors.ts` + `asyncGuard.ts`，禁止节点自写网络错误判定，禁止无超时 Promise」
此前只写在 `spec/CONTEXT.md:113`。

**规则其实已在代码里明文**（2026-09-19 取证）：

- `base/utils/genErrors.ts:2`「统一错误分类 —— 异步/网络错误的**单一分类入口**」；
- `base/utils/genErrors.ts:4`「此前错误判断散落各处（**节点自写 `if(/网络错误/)`**、各 API 各写各的）」；
- `base/core/contracts.ts:750`「新增错误：先登记 type 与其文案，**禁止各节点自写 `if(/网络错误/)` 判断**」。

**且存量零违反**：全仓 `src` 已无 `if (/网络错误/)` 式判定，只剩 `genErrors.ts:43-48` 为兼容
**历史文案**而保留的识别分支 —— 那段本身就是"关键词判定必然漂移"的化石证据。

## 判据（它凭什么成立）

1. **关键词判定必然漂移**：错误文案是给人看的，改一个字判定就失效；且**无法穷举**
   （`scriptBoxEngine.ts:228` 记的就是这个：「上游错误文本无法穷举关键词」）。
   正解是按**错误的结构特征**分类（`name` / `status` / `isNetwork` / 是否 `TimeoutError`），
   这正是 `classifyError` 的识别优先级（取消 > 超时 > 网络 > HTTP > 业务）。
2. **唯一入口已存在且返回判别式类型**：`classifyError(e) → { type, message, retryable }`，
   `type ∈ abort|timeout|network|http|business` 且**登记在 `contracts.ts` GEN_ERRORS**
   ⇒ 新增类型有登记面、有对账可能。
3. **无超时 Promise 的失败形态最坏**：不是崩，是**永远 pending** ⇒ 用户看到"一直在转"，
   日志里什么都没有。`asyncGuard.withTimeout` 是唯一实现，把"挂起"变成"可诊断的超时错误"。
4. **与 ADR-0018 的分工**：0018 说"只有网络错误才能重试"（**重试**判据）；本条说
   "网络错误**是什么**、Promise**必须有超时**"（**分类 + 时限**判据）。两者不互相取代。

## 决议

1. **错误分类唯一入口**：`src/components/base/utils/genErrors.ts`（`classifyError`）。
   禁止自写 `if (/网络错误/)`、`if (msg.includes('超时'))` 之类关键词判定。
2. **异步语义唯一入口**：`src/components/base/utils/asyncGuard.ts`
   （`withTimeout` / `isTimeoutError` / `tryParse` / `releaseQuietly`）。**禁止无超时的 Promise**。
3. **新增错误类型** → 先在 `contracts.ts` 的 `GEN_ERRORS` 登记 type 与文案，再实现。
4. **CONTEXT 只留一行指针**（不抄判据正文）—— 见 ADR-0025。

## 后果

- ✅ 判据有了主场与检索入口（`adr.mjs search 错误分类` 可命中，此前 0 命中）。
- ✅ 存量零违反 ⇒ 本条**零行为变化**，是"立判据"不是"改代码"。
- ⚠️ **代价 / 边界**：`genErrors.ts:43-48` 仍保留「网络错误」前缀的**向后兼容识别** ——
  这是历史文案的兼容分支，**不是**鼓励新代码走关键词判定；`genErrors.ts:9-13` 另有一条重要边界：
  `retryable` 是**观测字段不是决策依据**（真决策点在 `httpClient.ts:261/369`），勿与 ADR-0018 混读。
- ⚠️ **回潮风险**："这个接口的错误体没有 status，我只能 match 文案" ⇒ 正解是给该错误补
  `name`/`isNetwork` 等**结构特征**，而不是在消费方 match 文案。

📌 **违反时的判据（怎么发现"又回去了"）**：

1. `src` 出现新的关键词式错误判定（`if (/网络错误/)`、`msg.includes('超时')`、`/fetch failed/` 之类）；
2. 出现 `await somePromise` 而该 Promise 未包 `withTimeout`（且它可能永不 settle）；
3. 新增错误类型**未**登记在 `contracts.ts` 的 `GEN_ERRORS`；
4. 用 `retryable` 做 `if (retryable)` 分支决策（它只是观测字段，见上文边界）。
- **毕业去向**：类型层：HttpRequestOptions.timeoutMs 必填 + NO_TIMEOUT 哨兵（src/components/base/api/httpClient.ts:53-72）—— 漏写编译不过，无需额外闸
