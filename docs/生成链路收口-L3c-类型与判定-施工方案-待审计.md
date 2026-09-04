# 生成链路收口 L3c · 结果信封单一真源 + 中止判定统一 · 施工方案 · 待审计

> **状态**：待审计。审计通过前禁止施工。
> **范围**：前端生成链路。C1 = 结果信封三胞胎合一；C2 = 中止判定双标准统一。
> **本文按「写代码 4 步法」（契约 → 数据流 → 测试 → 施工）组织。每条断言标 `文件:行号` 证据，请逐条核对。
> **依赖**：L3a/L3b 已完工（generate.ts 已落地）。本文是 L3 之后的**加固批**，不是新功能。

---

## State 0 · 背景

L3 收口时确立了两条纪律，但审计发现它们都**只靠"人记住"，没有机制兜底**：

1. **「禁止并行定义」纪律**（L3 修正 8）：`GenerateCapability = RelayCapability` 真源化。但**结果信封**仍有三个逐字同形的 `interface` 并行定义，且已在跨 hook 静默互传（见 E1）。
2. **「abort message 铁律」**（L3 §4.2.1）：`scriptBoxEngine` 用 `/abort/i.test(message)` 判定中止 → 必须靠所有人写英文 message。但全库其余 6 处都用 `name === 'AbortError'`，且 `genErrors.classifyError` 早已是声明过的"统一错误分类单一入口"（E2）。

本批把这两条纪律从"约定"变成"机制"：信封只留一个真源（别名收口），判定只走一个入口（`classifyError`）。

---

## State 1 · 定契约

### C1 · 结果信封单一真源

**复述需求**：生成链路的三个同形结果信封收敛为一个类型定义，其余改为别名。**纯类型重构，零运行时行为变更**。

**输入源**：无（不是数据功能，是类型治理）。消费方：`generate.ts` 门面 + `relayProxy` 协议层 + `useNodeGeneration` hook 契约 + `useGenerateNode` 编排 hook。

**同形三胞胎（已逐字核实）**：

| # | 信封 | 位置 | 字段 | 现状消费者 |
|---|---|---|---|---|
| 1 | `GenerationResult` | `src/types/provider.ts:31` | `ok/url?/content?/error?/aborted?` | `generate.ts:24,30` 门面返回 |
| 2 | `RelayGenerationResult` | `relayProxy.ts:52` | **逐字相同** | `relayAttachUntilDone` / `relayGenerate` / `relayChat` 返回 |
| 3 | `NodeGenerationResult` | `useNodeGeneration.ts:39` | **逐字相同** | `GenerationRunner` / `GenerationOnSuccess` 契约（`:68-69`） |

**跨 hook 静默互传证据（病征）**：`useGenerateNode.ts:147` 把 `onSuccess: (r: GenerationResult)` 直接传给 `useNodeGeneration` 的 `onSuccess`（其参数类型是 `NodeGenerationResult`）——两个名字不同的类型在**接口边界静默兼容**，纯靠字段恰好相同。任何一边加字段不通知另一边，TS 照过，等运行才炸。

**真源归属判定**：`types/provider.ts` 是**最近收口已选定的真源**（`generate.ts:24` `import type { GenerationResult } from '@/types'`），且 `types/provider.ts` **零 import**（已核，无任何依赖）→ 无循环风险。选定它，禁新建文件、禁把信封搬进 contracts.ts（结果信封不是跨切面机制，是领域类型）。

**非目标（红线，防过度收口）**：

| 类型 | 位置 | 为何不收 |
|---|---|---|
| `NodeGenerationStartResult` | `useNodeGeneration.ts:48` | `resultUrl`（非 `url`）+ `inFlight` 语义；start() 是"启动编排结果"，不是"生成结果"。强行合一要改字段名 + 扫全部调用点，无收益 |
| `NodeGenerationRunResult` | `taskStore.ts:437` | `Promise<boolean \| NodeGenerationRunResult>` 双形态 + `resultUrl`；taskStore 内部契约 |
| `AwaitTaskResult` | `taskStore.ts:474` | `status: 'completed'\|'failed'\|'timeout'` 三态，不同语义 |
| 其他领域信封（`SkillResult` / `ImportResult` / `ReviewShotResult` / `SyncResult`…） | 各处 | 各自领域语义，强行并进 `GenerationResult` 违反高内聚低耦合 |

### C2 · 中止判定统一走 `classifyError`

**复述需求**：全库唯一用 `message` 关键词判中止的位置（`scriptBoxEngine:234`）改为复用既有唯一入口 `classifyError`。消除双标准 + 修复一个静默吞错隐患。

**输入源**：`runAbortable`（scriptBoxEngine:213）catch 到的任意异常。输出：`'abort'` → warn 不弹 toast；其他 → toast + error（失败可见）。

**现有唯一入口（已核实）**：
```24:37:src/components/base/utils/genErrors.ts
export function classifyError(e: unknown): ClassifiedError {
  ...
  if (name === 'AbortError' || err?.aborted) return { type: 'abort', message, retryable: false }
  if (isTimeoutError(e) || name === 'TimeoutError') return { type: 'timeout', ... }
  ...
}
```
错误类型登记于中央表 `contracts.ts:467 GEN_ERRORS`（abort/timeout/network/http/business），`ErrorKind` 定义于 `src/types/errors.ts:7`。

**双标准现状（已核实）**：

| 判定方式 | 位置 |
|---|---|
| `e?.name === 'AbortError'`（正） | `genErrors:29`、`useNodeGeneration:276`、`useAgentChat:665`、`relayProxy:243`、`httpClient:200`、`workflowRuntime:167/191` |
| `/abort/i.test(e?.message)`（**唯一例外**） | `scriptBoxEngine:234` |

**`scriptBoxEngine:234` 现状的两个问题**：
1. **静默吞错隐患**：若上游业务错误 message 碰巧含 "abort"（如 `'request aborted by provider: 429'`，但 `name` 非 AbortError）→ 被误判为"已中止"→ 只 `logger.warn`，**不弹 toast、不上报 error** → 失败静默（违反失败可见铁律）。
2. **脆弱依赖**：L3 §4.2.1 铁律要求所有人写英文 message 才能工作——判定标准本不该依赖 message 内容。

**等价性论证（改后行为逐类对齐）**——`runAbortable` catch 能接到的异常：

| 异常 | 抛出点 | 现状（/abort/i） | 改后（classifyError） | 一致？ |
|---|---|---|---|---|
| `AbortError` (`name`) | `relayProxy:195` / `httpClient:161` | message=`'Aborted'`/`'The user aborted...'` → 命中 → warn | `name==='AbortError'` → abort → warn | ✅ 一致 |
| `TimeoutError` | `withTimeout:59`（超时 reject） | message=`${toastFail}（超时）` 不含 abort → toast | `isTimeoutError` → timeout → toast | ✅ 一致 |
| `HttpError` | `httpClient:191` | 取决于 message | → http → toast | ✅ 一致 |
| 业务错含 "abort" | 上游返回 | **误判 warn（吞错）** | → business → **toast（修复）** | 🔴 行为变更（修复方向） |

**结论**：唯一行为变更 = 修复「业务错含 abort 被吞」。无回归风险面，但需跑 scriptBoxEngine 双测试套件确认（见 State 3）。

---

## State 2 · 定数据流

### C1 · 数据流（类型引用链）

```
【唯一真源】 src/types/provider.ts → export interface GenerationResult   （零 import，无环）
                │
                ├─ src/components/base/api/generate.ts      （已直连：import type { GenerationResult } from '@/types'）
                ├─ src/components/base/api/relayProxy.ts     ← 本批加别名：RelayGenerationResult = GenerationResult
                └─ src/hooks/useNodeGeneration.ts            ← 本批加别名：NodeGenerationResult = GenerationResult
                         │
                         └─ src/hooks/useGenerateNode.ts     （不动：已在 import GenerationResult，见 :147 互传）
```

- **引用方向**：`relayProxy → types`、`useNodeGeneration → types` 均单向；`types/provider.ts` 零依赖 → 无环、无 TDZ。
- **别名而非复制**：`export type RelayGenerationResult = GenerationResult` 是类型别名，不占运行时；字段任何一处改动会在所有别名处**编译期**爆红（"实现一变必红"天然成立）。
- **为何 useNodeGeneration 此前不直接 import types**：历史遗留（三旧门面 era 各自 `interface` 自足）。改后契约签名不变，调用方零改动（TS 结构兼容原本就成立）。
- **avoid黑盒**：无新增运行时链路、无 eventBus、无存储键。纯类型层的收敛不产生可追溯性缺口。

### C2 · 数据流（异常判定链）

```
任意 throw（task 内）
   │
   ▼
runAbortable catch（scriptBoxEngine:232）
   │
   ├─ 改前：/abort/i.test(e?.message)   ← 双标准（唯一 message 判点）
   ▼
改后：classifyError(e)                    ← 复用唯一入口 genErrors.ts:24（GEN_ERRORS 登记 contracts.ts:467）
   ├─ type === 'abort'   → onReset + logger.warn('·已中止')，不 toast
   └─ 其余（timeout/http/network/business）→ toast(e?.message || toastFail) + logger.error（失败可见）
```

- **复用而非新机制**：`classifyError` 头注释自称"统一错误分类——异步/网络错误的**单一决策入口**"（genErrors.ts:3）。scriptBoxEngine 绕过它是历史遗留，本批消灭。
- **拦截点唯一**：判定只在 `runAbortable` catch 一处改，不扩散到其他 6 处（它们已用 `name`，等价正确；避免无谓 churn）。
- **失败可见**：改后不再有任何"被 /abort/i 误吞"的路径。

---

## State 3 · 构思测试

**C1（纯类型，无运行时）——测试手段 = type-check + 类型断言**

| # | 断言 | 一变即红条件 |
|---|---|---|
| T1 | `npm run type-check` 全绿 | 任一别名解除 / 字段漂移 → 编译红 |
| T2 | `generate.test.ts` 既有 #8（barrel 导出 4 具名符号）+ #10（别名 wrapper）继续绿 | 门面签名被破坏 → 红 |
| T3 | `generate.test.ts` 新增：`expectTypeOf<RelayGenerationResult>().toEqualTypeOf<GenerationResult>()` 且 `NodeGenerationResult` 同 | 有人把 `RelayGenerationResult` 重新改成独立 interface（哪怕字段照抄）→ `toEqualTypeOf` 红 |

> 注：T3 用 vitest 内置 `expectTypeOf`（仅类型检查、运行时无开销）。若项目未用过先确认 vitest 版本支持；不支持则退化为 T1（type-check 已能锁）。

**C2（行为变更，实现一变必红）**

| # | 断言（进 `scriptBoxEngine.test.ts` / `.deep.test.ts`） | 一变即红条件 |
|---|---|---|
| T4 | 既有「已中止」用例保持绿：mock task 抛 `{name:'AbortError', message:'Aborted'}` → `logger.warn('·已中止')` 被调、toast 未被调 | 回归 |
| T5 | **新增**：mock task 抛业务错 `new Error('request aborted by provider: 429')`（name 非 AbortError）→ **toast 被调**、warn 未调 | 当前实现（/abort/i 误判）→ **红**，证明修复 |
| T6 | **新增**：mock task 抛 `TimeoutError('尾帧变体生成失败（超时）')` → toast 被调、不被判中止 | 若 classifyError 把超时误判 abort → 红 |

**验收命令**：
```bash
npm run type-check
npx vitest run tests/unit/generate.test.ts tests/unit/scriptBoxEngine.test.ts tests/unit/scriptBoxEngine.deep.test.ts
npm run test:smoke
```

---

## State 4 · 施工

### 4.1 文件清单（唯一真源）

| 文件 | 动作 | 批次 |
|---|---|---|
| `src/types/provider.ts` | 不动（真源已在此）。可选：在 `GenerationResult` 上方补一行"以下别名引用本类型，禁另起 interface"注记 | C1 |
| `src/components/base/api/relayProxy.ts` | 改：`interface RelayGenerationResult`（:52-58）→ `export type RelayGenerationResult = GenerationResult` + 顶部 `import type { GenerationResult } from '@/types'` | C1 |
| `src/hooks/useNodeGeneration.ts` | 改：`interface NodeGenerationResult`（:39-45）→ `export type NodeGenerationResult = GenerationResult` + `import type { GenerationResult } from '@/types'` | C1 |
| `src/components/scriptbox/scriptBoxEngine.ts` | 改：`:234` `/abort/i.test(e?.message)` → `classifyError(e).type === 'abort'` + import | C2 |
| `docs/前端生成门面收口-L3-裁定与修订.md` | 改：§4.2.1 铁律加注记「已由 L3c 统一判定，本条降级为兼容历史 message」 | 顺手（施工后） |
| `src/hooks/useGenerateNode.ts` | **不动**（已在用 `GenerationResult`） | — |

### 4.2 函数/类型签名

```ts
// ── relayProxy.ts（C1）──
import type { GenerationResult } from '@/types'

/** relay 生成最终结果信封 —— 别名对齐 GenerationResult（单一真源，L3c，禁另立 interface） */
export type RelayGenerationResult = GenerationResult
// 所有既有函数签名（relayAttachUntilDone/relayGenerate/relayChat → Promise<RelayGenerationResult>）不变

// ── useNodeGeneration.ts（C1）──
import type { GenerationResult } from '@/types'

/** run 执行器返回的结果信封 —— 别名对齐 GenerationResult（单一真源，L3c，禁另立 interface） */
export type NodeGenerationResult = GenerationResult
// GenerationRunner / GenerationOnSuccess（:68-69）签名不变

// ── scriptBoxEngine.ts（C2，:232-239 的 catch 改造）──
import { classifyError } from '../base/utils/genErrors.ts'   // 与 useNodeGeneration.ts:15 同款 import
// ...catch (e) {
//   onReset?.()
//   if (classifyError(e).type === 'abort') {
//     logger.warn('scriptBox', `${info.logLabel}·已中止`, info.ctx)
//   } else {
//     toast(e?.message || info.toastFail)
//     logger.error('scriptBox', `${info.logLabel}·异常`, { ...info.ctx, error: e?.message })
//   }
// }
```

### 4.3 空函数骨架

无新增运行时函数。两处都是**声明替换**（C1）与**判定表达式替换**（C2），不引入新状态机/新函数。按 4 步法此为"无骨架"类改动，直接按 4.2 签名落地即可。

### 4.4 施工顺序与验收

```
commit 1（C1 · 纯类型）：
  1. relayProxy.ts：interface → type 别名 + import
  2. useNodeGeneration.ts：同上
  3. 可选：types/provider.ts 补注记
  4. generate.test.ts 补 T3（expectTypeOf）
  5. 验收：npm run type-check + npx vitest run tests/unit/generate.test.ts

commit 2（C2 · 判定统一）：
  1. scriptBoxEngine.ts：:234 改 classifyError + import
  2. scriptBoxEngine.test.ts / .deep.test.ts 补 T5/T6，确认 T4 绿
  3. 验收：npm run type-check + npx vitest run tests/unit/scriptBoxEngine.test.ts tests/unit/scriptBoxEngine.deep.test.ts + npm run test:smoke
```

**可变性纪律**：两处都是表达式级替换，无状态、无共享数据 mutate、无热路径深拷贝问题。C2 不新增节流（`runAbortable` 无高频路径）。

---

## 5. 风险与回滚

| 风险 | 概率 | 处置 |
|---|---|---|
| 别名化在某处触发 TS 字面量推断差异 | 极低 | `GenerationResult` 字段全 optional，无字面量窄化；type-check 兜底 |
| `expectTypeOf` vitest 版本不支持 | 低 | 退化只留 T1/T2；或改用编译期哨兵（`const _t: GenerationResult = {} as RelayGenerationResult` 所在文件参与 tsc） |
| C2 改后 scriptBoxEngine 既有"已中止"用例红 | 低 | 等价性已逐类论证（State 2）；T5/T6 先写后跑，红了说明论证有漏，退回 State 2 |
| C2 业务错含 "abort" 从 warn 变 toast（行为变更） | 中 | 这是**修复**不是回归（失败可见）；验收时若 toast 噪音变大，可另行评估是否需在 toast 文案区分 |

**回滚**：C1/C2 各自独立 commit，出错 `git reset --hard HEAD~1`。

---

## 6. 红线复核

| 铁律 | 是否触碰 |
|---|---|
| CLAUDE.md §5.1 绝对禁区（端口/唯一入口/字符串契约） | ✅ 未触碰（纯类型 + 单行判定，不改任何 API 路径/字段名） |
| 失败可见（禁止静默吞错） | ✅ C2 反而**消除**一处静默吞错 |
| 异步总超时 | ✅ 未新增异步，不涉 |
| 统一错误分类唯一入口 | ✅ C2 是回归该入口；C1 不涉错误 |

---

## 7. 仍待实测（施工前亲自跑一次）

1. vitest 是否支持 `expectTypeOf`（决定 T3 形态）。
2. `scriptBoxEngine` 双测试套件当前基线是否全绿（改动前的基线 diff）。
3. grep 确认无其他 `/abort/i.test(` 遗漏点（我只查到 `scriptBoxEngine:234` 一处，请复核）。
4. grep 确认 `NodeGenerationStartResult` / `NodeGenerationRunResult` 无跨模块 import（若已泄漏到别处，需评估是否也该对齐字段名——**默认不做**，但要知道泄漏面）。
