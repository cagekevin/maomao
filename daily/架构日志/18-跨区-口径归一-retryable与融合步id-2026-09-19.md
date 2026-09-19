# 架构日志 · 18 跨区 · 口径归一（retryable 与融合步 id）· 2026-09-19

> **触发债**：TD-18-29（`assistantStream` `retryable: status>=500`）· TD-18-31（`canvasPlanExecutor` 手写
> `Date.now()` 当步 id）。
> **性质**：**并记一轮，但不称母体** —— 两笔**判据不同**（ADR-0018 可重试口径 / ADR-0026 id 唯一入口），
> 只是同一次施工、同一个动作（**把自写的第二份口径改回引用唯一真源**）。
> **结论落点**：本文件（唯一写全处）。
> **一句话**：两笔的债描述**都需要修正**：TD-18-29 拿**跨包**的口径当冲突（真冲突在**包内同层**，
> 而且那个字段**全仓零读者**）；TD-18-31 的"同毫秒即撞"在**当前代码下没有可触发路径**——
> 它是**口径/一归问题**，不是可复现的 bug。

- **本区域状态**：`已验证(有债待还)` —— 本轮 **TD-18-29 / 31 结清**。

---

## 一 · Step 0 普查

| 口径 | 实测 |
| --- | --- |
| localTool「可重试状态码」真源 | `httpTransport.ts:34` `RETRYABLE_HTTP_STATUSES = [408,429,500,502,503,504]`（`protocol/shared.ts:45` 以旧名 `DEFAULT_RETRY_HTTP_STATUSES` re-export） |
| 引用真源的站点 | `protocol/poll.ts:137-140`（**真被消费**：决定 `processing` / `failed`） |
| **自写**口径的站点 | `assistantStream.ts:150 / :290` `response.status >= 500`（**漏 408/429**） |
| `retryable`（assistantStream 事件字段）的读者 | **0**（`localTool/**` 与 `src/**` 全仓无 `.retryable` 读取；只有 `types.ts:309` 的类型声明与两处生产点） |
| `relay.streamChat` 的调用方 | **0**（用户 2026-09-19 确认：**该链路是预留、未接线**） |
| 手写 `Date.now()` 当**唯一 id** 的站点 | **1**：`canvasPlanExecutor.ts:758` `__auto_fusion_${Date.now()}`（TD-18-18 已收口 7 站，此为第 8 处） |
| 同文件 `generateId` 是否已 import | **是**（`:17`）⇒ 一行可改 |

## 二 · Step 1 证伪（**两笔的债描述都需修正**）

### TD-18-29

| 命题 | 取证 | 判定 |
| --- | --- | --- |
| 「与 `genErrors`（http→false）冲突」 | `genErrors` 在**前端** `src/components/base/utils/genErrors.ts`；`assistantStream` 在 **localTool**（独立包、自带 package.json/tsconfig） | ❌ **框架错了**：跨包比较**不构成冲突**（不同层可有不同策略）。且前端 `genErrors` 自承 `retryable` 是**观测字段不是决策依据**，真决策点在 `httpClient.ts:261/369` |
| 「是第二份口径」 | 同包同层的 `protocol/poll.ts` 用 **408/429/5xx**，`assistantStream` 用 **≥500** | ✅ 属实 —— 但**真冲突在包内**：`assistantStream` **漏了 408/429** |
| 「改它会有回归风险」 | 该字段**全仓零读者**；且 `relay.streamChat` 是**预留**（未接线） | ❌ **证伪**：改它对现有行为**零影响** |
| 「应该照 TD-16-16 把字段删掉」 | `contracts.ts:751-756`（TD-16-16）：前端已把 `GEN_ERRORS.retryable` **删掉**，理由「全库零读者……故删字段去误导」 | ⛔ **不照做**：那次删的是**已接线链路上的死字段**；本处所在链路**整体是预留**，删字段 = 拆预留。**只做口径归一** |

### TD-18-31

| 命题 | 取证 | 判定 |
| --- | --- | --- |
| 「违反 idGen 唯一入口」 | `idGen.ts:1-9` 明示「禁止自己写 `Date.now()+Math.random()` 拼接」；本处是 TD-18-18 收口 7 站之外的第 8 处 | ✅ **属实** |
| 「同毫秒即撞 id（可复现的 bug）」 | ① 单个 plan 内**只追加一个**融合步 ⇒ 无内部碰撞面；② 节点 id = `plan-<stepId>-p_<rand>`（`:486`，本身已带 `generateId`）⇒ 节点**不会撞**；③ step id 只在**本次 plan 内**当 `byId` Map 键（`:452`），跨 plan 不互比 | ❌ **证伪**：**当前代码下没有可触发路径**。真实性质 = **口径/一归问题 + 潜在碰撞**（若将来同 plan 内追加多个自动步就会真撞） |

> **为什么仍要修**：入口被绕过 ⇒ 将来改 id 策略会漏；且它与同文件已收口的 7 站**不一致**，是"看起来像 bug 的坏味道"
> ——留着会让下一个 AI 反复怀疑。**修法零风险**（前缀 `__auto_fusion` 无消费者，`generateId` 已 import）。

## 三 · Step 6 最小改动

| # | 文件 | 改动 |
| --- | --- | --- |
| ① | `localTool/src/ai-relay/assistantStream.ts` | import `RETRYABLE_HTTP_STATUSES`；`response.status >= 500` → `RETRYABLE_HTTP_STATUSES.includes(response.status)`（×2）；注释写明"唯一真源 / 本字段零读者 / 链路是预留" |
| ② | `src/components/agent/canvas/canvasPlanExecutor.ts:758` | `__auto_fusion_${Date.now()}` → `generateId('__auto_fusion')`；注释写明它是 TD-18-18 的第 8 站 |
| ③ | `localTool/test/assistantStream.test.js` | **新增 1 条**：`retryable` 口径断言（429 / 408 真，500 真，403 / 400 假） |
| ④ | `tests/unit/canvasPlanExecutor.test.ts` | **新增 1 条**：融合兜底步被追加 + 其 step id 不是"裸时间戳"形态 |

改动半径：**2 生产文件（各 1 处）+ 2 测试文件（各 1 条）**。

## 四 · Step 7 验证

```
🔬 探针结论｜TD-18-29 retryable 口径 先红后绿
   文件   : localTool/src/ai-relay/assistantStream.ts（命中 2 处，已还原 sha=824cbb72b47e）
   命令   : cd localTool && node --test --import tsx test/assistantStream.test.js
   观测   : exit=1｜输出 44 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「429」 — 命中
```

> **判别点说明**：旧口径 `status >= 500` 会把 **429（限流）/ 408（请求超时）漏成"不可重试"** ⇒ 断言必然红。

```
🔬 探针结论｜TD-18-31 融合步 id 走唯一入口 先红后绿
   文件   : src/components/agent/canvas/canvasPlanExecutor.ts（命中 1 处，已还原 sha=c3626e30bdef）
   命令   : npx vitest run tests/unit/canvasPlanExecutor.test.ts
   观测   : exit=1｜输出 23 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「not to match」 — 命中
```

**反向探针**：`canvasPlanExecutor` 21 条 → **22 条全绿**（+1 = 本轮新增）；`assistantStream` 侧 `localTool` 全量 ALL PASS。

**门禁（全绿）**：

| 命令 | 结论 |
| --- | --- |
| `npx vitest run` | **244 文件 / 3037 测试通过**（本轮 +1 = 新增的融合步 id 锁） |
| `npm run test:localtool` | **ALL PASS**（353 条，本轮 +1 = 新增的 `retryable` 口径断言；含 localTool 侧 `tsc --noEmit`） |
| `npx tsc --noEmit`（前端） | **0 错** |
| `npx eslint <改动文件>` | 0 问题 |
| `check:arch` / `check:any` / `check:strict-src` | ✅ / **0 违规** / ✅ |
| `check:dead-code` | 基线 76 → 当前 **76**（无新增） |
| `check:doc-refs` / `check:gates` | **0 违规** / **15 闸带申诉口** |

## 五 · 度量（改前 / 改后）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| localTool 内**自写**「可重试状态码」口径 | **1**（`status >= 500`，缺 408/429） | **0**（改引用 `RETRYABLE_HTTP_STATUSES` 真源） |
| 手写 `Date.now()` 当唯一 id 的站点 | **1** | **0**（idGen 收口覆盖 8 站） |
| 本族机器判据（会红的断言） | **0** | **2** |
| 运行期行为变化 | — | **零**（`retryable` 零读者；`__auto_fusion` 前缀无消费者） |

## 六 · 交付六闸自查

- **一归**：可重试状态码口径 **1 自写 + 1 引用 → 2 引用同一真源**；步 id 口径 **1 自写 → 0** ✅
- **减一**：未新增任何兜底 / 守卫 / 兼容分支 ✅
- **减二**：删 2 处自写口径；两笔各补一条**会红的断言**（不是注释护栏）✅
- **一诚实**：把"零读者""链路是预留""当前没有可触发路径"三件容易被夸大的事**如实写进代码注释与本文件** ✅
- **零炸**：见下三问 ✅
- **一凭证**：2 块探针 + 反向探针 + 门禁 + 4 组 grep 计数 ✅

**零炸三问**：

1. **哪些行为被改了？** —— **运行期零变化**。
   - TD-18-29：`retryable` 字段值在 408/429 上由 `false` 变 `true`，但该字段**全仓零读者**；
   - TD-18-31：融合步 id 形态由 `__auto_fusion_<ts>` 变 `__auto_fusion_<ts36>_<rand6>`，前缀**无消费者**。
2. **改前能走的路径，改后仍能走吗？** → 是（全量单测通过；localTool ALL PASS）。
3. **改前会失败的，改后仍失败吗？** → 是（未触碰任何失败路径）。

**用户可感知的行为变化**：**无**。

## 七 · 结论与下一步

- TD-18-29 / TD-18-31 **结清**。
- **债描述被修正处（A7）**：
  1. **TD-18-29**：不是"与前端 genErrors 冲突"（跨包），而是**包内同层**两份口径、`assistantStream` 漏 408/429；
     且该字段**零读者**、链路是**预留** ⇒ 修它对行为零影响，**未删字段**（删了等于拆预留）。
  2. **TD-18-31**：不是"可复现的撞 id bug"——单 plan 只追加一个融合步、节点 id 自带随机段、step id 不跨 plan 比较
     ⇒ **当前无可触发路径**；真实性质是**入口被绕过的口径问题**。
- **未纳入本轮**：
  1. `director3d/useToast.ts:29` `${Date.now()}-${Math.random()...}` —— 也是手写，但**自带随机段**且属 director3d 域，
     未被 TD-18-31 点名 ⇒ 只观察、不动（零炸）。
  2. `ImageBoxNode.tsx:492` / `videoEngine.ts:670` / `TaskCenter.tsx:241` 的 `Date.now()` 用于**下载文件名**，
     不是唯一键；同毫秒撞名概率低但存在 ⇒ 同属观察项，不入账（避免为整洁扩大改动面）。
  3. TD-18-29 的**字段去留**（预留链路接线后是否真需要 `retryable`）—— 接线时再定，现在删与留都是猜。
