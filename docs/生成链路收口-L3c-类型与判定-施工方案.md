# 生成链路收口 L3c · 结果信封单一真源 + 中止判定统一 · 施工方案（终版 v2）

> **状态**：已审计（v1 待审计版 → v2 终版，修订见 §0）。**可施工**。
> **范围**：前端生成链路。C1 = 结果信封三胞胎合一；C2 = 中止判定统一走 `classifyError`。
> **本文按「写代码 4 步法」（契约 → 数据流 → 测试 → 施工）组织。每条断言标 `文件:行号` 证据。
> **依赖**：L3a/L3b 已完工（`generate.ts` 已落地）。本文是 L3 之后的**加固批**，不是新功能。
> **施工纪律**：按 §4.4 的 4 个 commit 分批提交，每批独立验收。禁止跨批混改。

---

## §0 审计修订记录（v1 → v2）

v1 共 9 处须修正。**其中 A9 是审计方自己的误判，已撤回**——施工前请读一遍，避免按 v1 的错话施工。

| # | v1 问题 | v2 处置 | 落点 |
|---|---|---|---|
| A1 | T3 声称 `expectTypeOf().toEqualTypeOf()` 能挡住「把别名改回独立 interface」——**实测不成立**。`expectTypeOf` 用结构化判定，两个逐字相同的 interface 判定为相等（已用 tsc 验证） | T3 降级为**弱锁**（仅防字段漂移）；新增 **T4 AST 源码级守卫**作为真锁 | §3 |
| A2 | T3 放进 `generate.test.ts`，但项目未开 `typecheck` → `npx vitest run` 下 expectTypeOf 是 no-op，**恒绿** | 明确 T3 由 `npm run type-check` 执行，不写进 vitest 验收命令 | §3 / §4.4 |
| A3 | 声称「消除一处静默吞错」，但该路径（业务错含 abort 进 catch）经核对**几乎不可达**——`relayGenerate:244` / `relayChat:290` 都把非中止异常转成信封，不抛 | 如实降级为「纪律/可维护性收益」；§6 红线表述改正 | §1-C2 / §6 |
| A4 | 双标准清单漏 `relayProxy:289` 与 `generate.ts:274` | 补全；`:289` 单列为 C2c | §1-C2 |
| A5 | 文件清单漏 `generate.ts`（铁律注释会变谎言）与 `generate.test.ts` 测试 #4 | 新增 **commit 4 · 契约同步** | §4.1 / §4.4 |
| A6 | T4「既有『已中止』用例保持绿」——该用例**实际不存在**（两个套件均无 `logger.warn('已中止')` 断言） | 改为**新增**用例 T5 | §3 |
| A7 | 4 处行号漂移（文件在 v1 写完后被改过） | 全部修正 | 全文 |
| A8 | 「其余 6 处用 `name`，等价正确」**不成立**：`classifyError` 判据含 `err?.aborted`，比纯 `name` 更宽 | `useNodeGeneration:282` 纳入 **C2b**（同文件已 import classifyError，成本≈0） | §1-C2 / §4.1 |
| A9 | **【撤回】** 审计曾指「内层 httpClient 超时被 `relayProxy:289` 的 `\|\| signal?.aborted` 伪装成 `aborted:true`」——经复核**不成立**：`asyncGuard:50-60` 在 timer 回调里**同步** `reject(TimeoutError)`，fetch 随后的 AbortError rejection 抢不到（Promise 先 settle 者胜）。故内层超时抛的是 `TimeoutError('请求超时（120000ms）')`，`signal?.aborted` 为 false → 正常 toast | 撤回该结论。`:289` 的真实问题降级为「**丢弃真实错误原因** + 无括号优先级隐患」，C2c 定位为**零 UI 行为变更** | §1-C2c |

**v1 §7 待实测 4 条的实测结果**（已消灭，不必再跑）：

| 待办 | 结果 |
|---|---|
| vitest 是否支持 `expectTypeOf` | ✅ 支持（vitest 2.1.8），但**默认不执行**类型断言 → 见 A2 |
| `scriptBoxEngine` 双套件基线是否全绿 | ✅ **已跑**：`scriptBoxEngine.test.ts`(44) + `.deep.test.ts`(22) + `generate.test.ts`(26) = **92 passed** |
| grep 确认无其他 `/abort/i.test(` | ✅ 确认只有 `scriptBoxEngine:234` 一处（`generate.ts:11` 是注释） |
| `NodeGenerationStartResult` / `NodeGenerationRunResult` 是否跨模块泄漏 | ✅ 确认无泄漏（前者只在 `useNodeGeneration.ts`，后者只在 `taskStore.ts`） |

---

## State 1 · 定契约

### C1 · 结果信封单一真源

**复述需求**：生成链路的三个同形结果信封收敛为一个类型定义，其余改为别名。**纯类型重构，零运行时行为变更**。

**输入源**：无（不是数据功能，是类型治理）。消费方：`generate.ts` 门面 + `relayProxy` 协议层 + `useNodeGeneration` hook 契约 + `useGenerateNode` 编排 hook。

**同形三胞胎（已逐字核实）**：

| # | 信封 | 位置 | 字段 | 现状消费者 |
|---|---|---|---|---|
| 1 | `GenerationResult` | `src/types/provider.ts:31` | `ok/url?/content?/error?/aborted?` | `generate.ts:24,30` 门面返回 |
| 2 | `RelayGenerationResult` | `relayProxy.ts:52-58` | **逐字相同** | `relayAttachUntilDone`(`:168`) / `relayGenerate`(`:223`) / `relayChat`(`:258`) |
| 3 | `NodeGenerationResult` | `useNodeGeneration.ts:40-46` | **逐字相同** | `GenerationRunner`(`:69`) / `GenerationOnSuccess`(`:70`) |

> 另有第 4 个名字 `GenerateResult`（`generate.ts:30`），但它**已经是别名**（`export type GenerateResult = GenerationResult`），不在本批改动范围，仅纳入 §3-T4 守卫黑名单防其退化为 interface。

**跨 hook 静默互传证据（病征）**：`useGenerateNode.ts:147` 把 `onSuccess: (r: GenerationResult)` 直接传给 `useNodeGeneration` 的 `onSuccess`（其参数类型是 `NodeGenerationResult`）——两个名字不同的类型在**接口边界静默兼容**，纯靠字段恰好相同。任何一边加字段不通知另一边，TS 照过，等运行才炸。

**真源归属判定**：`types/provider.ts` 是最近收口已选定的真源（`generate.ts:24` `import type { GenerationProvider, GenerationResult } from '@/types'`），且 `types/provider.ts` **零 import**（已核）→ 无循环风险。选定它，禁新建文件、禁把信封搬进 `contracts.ts`（结果信封不是跨切面机制，是领域类型）。

**非目标（红线，防过度收口）**：

| 类型 | 位置 | 为何不收 |
|---|---|---|
| `NodeGenerationStartResult` | `useNodeGeneration.ts:49-55` | `resultUrl`（非 `url`）+ `inFlight` 语义；`start()` 是「启动编排结果」，不是「生成结果」。强行合一要改字段名 + 扫全部调用点，无收益 |
| `NodeGenerationRunResult` | `taskStore.ts:437` | `Promise<boolean \| NodeGenerationRunResult>` 双形态 + `resultUrl`；taskStore 内部契约（已核：仅 `taskStore.ts:437/443/450` 引用，无跨模块泄漏） |
| `AwaitTaskResult` | `taskStore.ts:474` | `status: 'completed'\|'failed'\|'timeout'` 三态，不同语义 |
| 其他领域信封（`SkillResult` / `ImportResult` / `ReviewShotResult` / `SyncResult`…） | 各处 | 各自领域语义，强行并进 `GenerationResult` 违反高内聚低耦合 |

### C2 · 中止判定统一走 `classifyError`

**复述需求**：把全库唯一用 `message` 关键词判中止的位置（`scriptBoxEngine:234`）改为复用既有唯一入口 `classifyError`，并顺手把同文件内最该统一的一处（`useNodeGeneration:282`）一并纳入。

**输入源**：`runAbortable`（`scriptBoxEngine:213`）catch 到的任意异常。输出：`'abort'` → warn 不弹 toast；其他 → toast + error（失败可见）。

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

**中止判定现状全清单（已核实，v1 漏了后两项）**：

| 判定方式 | 位置 | 本批处置 |
|---|---|---|
| `classifyError(e)`（正） | `useNodeGeneration:273`、`:293` | 不动 |
| `e?.name === 'AbortError'` | `genErrors:29`、`useAgentChat:665`、`relayProxy:243`、`httpClient:200`、`workflowRuntime:167`/`:191` | **不动**（见下「不扩散」论证） |
| `e?.name === 'AbortError'` | `useNodeGeneration:282` | **C2b 改**（同文件已 import，成本 0） |
| `/abort/i.test(e?.message)`（**唯一 message 判点**） | `scriptBoxEngine:234` | **C2a 改** |
| `e.name === 'AbortError' \|\| signal?.aborted`（**无括号**） | `relayProxy:289` | **C2c 收紧**（零 UI 行为变更） |
| `opts.signal?.aborted` | `generate.ts:274` | **不动**（chatStream 里「中止不做文案归一」，语义不同） |

**`scriptBoxEngine:234` 为什么必须改（真实收益）**：

1. **脆弱依赖**：L3 §4.2.1 铁律要求所有人写英文 message 才能工作——**判定标准本不该依赖 message 内容**。这是本批的主收益，属纪律/可维护性，不是 bug 修复。
2. **理论误判**：若上游业务错误 message 碰巧含 "abort"（如 `'request aborted by provider: 429'`，但 `name` 非 AbortError）→ 被误判为「已中止」→ 只 `logger.warn`，不弹 toast。

> ⚠️ **不要把第 2 条当成正在发生的 bug**（v1 的 A3 错误）。`relayGenerate:244` 与 `relayChat:290` 的 catch 都把非中止异常转成**信封**而非抛出，故上游业务错误**到不了 `runAbortable` 的 catch**，它在 task 内就被 `if (!r.aborted) toast(r.error)` 正常弹出了。改它是对的方向，但验收时**不要期待修掉一个可见缺陷**。

**等价性论证（改后行为逐类对齐）**——`runAbortable` catch 能接到的异常：

| 异常 | 抛出点 | 现状（`/abort/i`） | 改后（`classifyError`） | 一致？ |
|---|---|---|---|---|
| `AbortError` (`name`) | `relayProxy:195-197`（`'Aborted'`）/ `httpClient:161-163`（`'The user aborted a request.'`） | 命中 → warn | `name==='AbortError'` → abort → warn | ✅ |
| `TimeoutError` | `asyncGuard:59` | message=`${toastFail}（超时）` 不含 abort → toast | `isTimeoutError` → timeout → toast | ✅ |
| `HttpError` | `httpClient:191` | 不含 abort → toast | → http → toast | ✅ |
| `NetworkError` / `TypeError` | `httpClient:209` | 不含 abort → toast | → network → toast | ✅ |
| `null` / `undefined` | — | `e?.message \|\| ''` → 不命中 → toast | `!e` → business → toast | ✅ |
| 业务错含 "abort" | （几乎不可达，见上） | 误判 warn | → business → toast | 🔴 唯一变更，方向正确 |

**「不扩散」论证（为何不动另外 5 处 `name` 判点）**：
- `genErrors:29` 是 classifyError 自身；`httpClient:200` 在重试循环里，改用 classifyError 会引入 `contracts.ts` 依赖（分层风险）；`relayProxy:243` / `workflowRuntime:167/:191` / `useAgentChat:665` 是同步热路径，且判据与 classifyError 的**真子集**关系明确（它们只漏判 `aborted:true` 但 name 非 AbortError 的形态，当前链路不产生）。改它们 churn > 收益。
- **例外**：`useNodeGeneration:282` 必须改——它与 `:273`/`:293` 的 `classifyError` 调用在**同一个 catch 块的上下 11 行内**，同一文件里两套口径，是本批口号「判定只走一个入口」最刺眼的违反点，且改动只是**放宽**判据（新增 `err?.aborted` 覆盖），不可能把原本判 abort 的改成非 abort → **零回归风险**。

#### C2c · `relayProxy:289` 收紧（零 UI 行为变更）

```289:289:src/components/base/api/relayProxy.ts
    if (e instanceof Error && e.name === 'AbortError' || signal?.aborted) return { ok: false, aborted: true, error: '已停止' }
```

两个问题（**都不改变 `aborted` 的判定结果**）：

1. **无括号**：`(A && B) || C`。`&&` 虽优先于 `||`，但靠读者自推，后续改动极易写错。
2. **丢弃真实原因**：`error` 硬编码 `'已停止'`。当 `signal.aborted` 为真而抛出的其实是网络错 / JSON 解析错时，日志里永远只剩「已停止」，无法排查。

> ⚠️ **不要顺手把 `error` 改成 `e.message`**：`useNodeGeneration:270` 是 `const msg = r?.error || '生成失败'; showToast(msg)`，**不检查 `aborted`** → 英文 message（`'The user aborted a request.'`）会直接弹给用户。保留 `'已停止'` 文案，真实原因改用 debug 日志承载。

---

## State 2 · 定数据流

### C1 · 数据流（类型引用链）

```
【唯一真源】 src/types/provider.ts → export interface GenerationResult   （零 import，无环）
                │
                ├─ src/components/base/api/generate.ts      （已直连：:24 import type from '@/types'）
                ├─ src/components/base/api/relayProxy.ts     ← 本批加别名：RelayGenerationResult = GenerationResult
                └─ src/hooks/useNodeGeneration.ts            ← 本批加别名：NodeGenerationResult = GenerationResult
                         │
                         └─ src/hooks/useGenerateNode.ts     （不动：:147 已在用 GenerationResult）
```

- **引用方向**：`relayProxy → types`、`useNodeGeneration → types` 均单向；`types/provider.ts` 零依赖 → 无环、无 TDZ。
- **`import type` 完全擦除**：新增的是纯 `import type`，编译后不存在（已由 `check-arch.mjs:62-68` 的 `importKind !== 'type'` 跳过逻辑背书）→ 不产生运行时依赖，不触发循环依赖红线。
- **别名而非复制**：`export type RelayGenerationResult = GenerationResult` 不占运行时；字段任何一处改动会在所有别名处**编译期**爆红。
- **avoid 黑盒**：无新增运行时链路、无 eventBus、无存储键。纯类型层收敛不产生可追溯性缺口。
- **C1 的防漂移靠什么**：**不靠 `expectTypeOf`**（见 A1），靠 §3-T4 的 AST 源码守卫。

### C2 · 数据流（异常判定链）

```
任意 throw（task 内）
   │
   ▼
runAbortable catch（scriptBoxEngine:232）
   │
   ├─ 改前：/abort/i.test(e?.message || '')   ← message 判点（唯一）
   ▼
改后：classifyError(e)                        ← 唯一入口 genErrors.ts:24（GEN_ERRORS 登记 contracts.ts:467）
   ├─ type === 'abort'   → onReset + logger.warn('·已中止')，不 toast
   └─ 其余（timeout/http/network/business）→ toast(e?.message || toastFail) + logger.error（失败可见）
```

**并列的两条 abort 路径（施工前必须看懂，否则会误判 C2 的作用域）**：

| 路径 | 链路 | 是否进 `runAbortable.catch` | 落点 |
|---|---|---|---|
| ① **信封分支** | chat/text：`relayChat` 返回 `{ok:false, aborted:true, error:'已停止'}`（`relayProxy:289`），`chatCompletions` **不抛** | ❌ 不进 catch | `scriptBoxEngine` 的 6 处 `if (!r.aborted)`：`:298` / `:455` / `:456` / `:581` / `:747` / `:1042` |
| ② **抛出分支** | image/video：`relayProxy:195-197` 抛 `AbortError('Aborted')` → `relayGenerate:243` 透传 → `generate()` 不吞 | ✅ 进 catch | **`scriptBoxEngine:234`（C2a 改这里）** |

> 自证：`scriptBoxEngine:1167` 注释「图像链路中止一律 AbortError 上抛，由 runAbortable 的 catch 兜底（记「已中止」warn），不会走到这里」。
> **C2a 只作用于路径 ②。** 路径 ① 的 `if (!r.aborted)` 判定**不在本批范围**——它判定的是信封字段而非异常，与「异常分类单一入口」是两件事。C2c 只补其可追溯性，不改判定。

**失败可见**：改后不再有任何「因 message 含 abort 而被误吞」的路径（该路径原就几乎不可达，见 §1-C2 注）。

---

## State 3 · 构思测试

### C1（纯类型，无运行时）

| # | 断言 | 一变即红条件 | 执行者 |
|---|---|---|---|
| **T1** | `npm run type-check` 全绿 | 字段漂移 → 编译红 | `type-check` |
| **T2** | `generate.test.ts` 既有 #8（barrel 导出 4 具名符号）+ #10（别名 wrapper）继续绿 | 门面签名被破坏 → 红 | vitest |
| **T3** | `generate.test.ts` 新增：`expectTypeOf<RelayGenerationResult>().toEqualTypeOf<GenerationResult>()`，且 `NodeGenerationResult` 同 | **只防字段漂移** | **仅 `npm run type-check`**（见下） |
| **T4** | `check-arch.mjs` 新增规则 3：禁止在 `src/` 另立信封 interface | **有人把别名改回独立 interface（哪怕字段照抄）→ 红** ← C1 的真锁 | `npm run check:arch` / `check:health` |

> **T3 的两条硬约束（v1 踩过的坑，务必照做）**：
> 1. **它只能在 `npm run type-check` 下生效**。项目 `vitest.config.ts` 无 `test.typecheck` 段 → `typecheck.enabled` 默认 `false`，`typecheck.include` 默认只匹配 `*.test-d.ts`。放进 `generate.test.ts` 后，`npx vitest run` 下 expectTypeOf 是 **no-op，恒绿**。唯一能检查到它的是 `type-check:tests`（`tsc --noEmit -p tests/tsconfig.json`，靠泛型约束报错）。
> 2. **它挡不住「改回独立 interface」**。已实测：`expectTypeOf` 底层是结构化 `Equal`；两个逐字相同的 interface 判定为相等（`.branded` 亦无效，两边都无 brand）。**这是 T4 必须存在的原因。**

**T4 实现（追加到 `scripts/check-arch.mjs`，放在规则 2 之后、结尾汇总之前）**：

```js
// ── 3. 结果信封单一真源：禁止另立 interface（L3c）──
console.log('\n📦 结果信封单一真源：禁另立 interface（L3c）')
// 真源 = src/types/provider.ts::GenerationResult；其余同名信封必须是 `export type X = GenerationResult` 别名。
// 用 AST 而非正则：正则会误伤注释/字符串里的同名词。
const ENVELOPE_INTERFACE_BAN = new Set([
  'GenerationResult', 'RelayGenerationResult', 'NodeGenerationResult', 'GenerateResult',
])
const ENVELOPE_TRUE_SOURCE = 'src/types/provider.ts'
let envelopeViol = 0
for (const f of files) {                       // files：复用脚本顶部 collectFiles(SRC) 的结果
  const rel = f.slice(root.length + 1).replace(/\\/g, '/')
  if (rel === ENVELOPE_TRUE_SOURCE) continue   // 真源本体豁免
  let code
  try { code = readFileSync(f, 'utf8') } catch { continue }
  let ast
  try {
    ast = parse(code, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript', 'decorators-legacy'], errorRecovery: true })
  } catch { continue }
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'TSInterfaceDeclaration') {
      const name = n.declaration.id?.name
      if (ENVELOPE_INTERFACE_BAN.has(name)) {
        envelopeViol++
        fail(`结果信封被另立 interface: ${rel} → interface ${name}`
          + `（必须改为 \`export type ${name} = GenerationResult\` 别名，真源 ${ENVELOPE_TRUE_SOURCE}）`)
      }
    }
    for (const k in n) if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k])
  }
  walk(ast.program)
}
if (!envelopeViol) console.log('  ✅ 无另立结果信封 interface')
```

> `check-arch.mjs` 已被 `scripts/health-check.cjs:165` 调用 → 加规则即自动进 `npm run check:health` 门禁，无需改 package.json。

### C2（判定统一）

| # | 断言（位置） | 一变即红条件 |
|---|---|---|
| **T5** | **新增**（v1 误称「既有」）`scriptBoxEngine`：「已中止」——mock 抛 `Object.assign(new Error('Aborted'), { name: 'AbortError' })` → `logger.warn` 被调用且 message 含「已中止」；`showToast` **未**被调用 | C2a 改错 → 红 |
| **T6** | **新增**：mock 抛业务错 `new Error('request aborted by provider: 429')`（name 非 AbortError）→ `showToast` 被调用、`logger.warn` 未调用 | 当前实现（`/abort/i` 误判）→ **红**，锁定修复 |
| **T7** | **新增**：mock 抛 `new TimeoutError('尾帧变体生成失败（超时）')` → `showToast` 被调用、不判中止 | 若 classifyError 把超时误判 abort → 红 |
| **T8** | **新增**（C2b 回归）：`useNodeGeneration` 的 `start()` 在 run 抛 AbortError 时仍返回 `{ok:false, error:'已停止', aborted:true}` 且不弹 toast | C2b 改错 → 红 |
| **T9** | **改写** `generate.test.ts` 测试 #4：断言从「`/abort/i.test(err.message)`」改为「`err.name === 'AbortError'`」（见 commit 4） | 门面中止契约被破坏 → 红 |

**T5–T7 的落地要点**（两套件现有 mock 结构已核）：

- `scriptBoxEngine` 从 `'../base/api/index.ts'`（barrel）导入 `chatCompletions` / `generateImage`（`:6-7`），但两套件 mock 的是 `'../../src/components/base/api/generate.ts'` → **mock 经 barrel re-export 生效**（`deep.test.ts:364` 已实证）。
- **触发 catch 的入口**：用经 `runAbortable` 的 image 链路 —— `scriptBoxEngine:1101`（`runAbortable('tailframe-${shotId}', …)`，内部 `:1134` 调 `generateImage`）或 `:674`（`runAbortable('shotimg-${shotId}', …)`）。做法是 `generateImageMock.mockRejectedValueOnce(err)`。
- **需新增 logger mock**（两套件目前都没有）：

```ts
vi.mock('../../src/components/base/core/logger.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/base/core/logger.ts')>()
  // spread actual：logger 是 `export const logger: {...}`（logger.ts:104），保持其余导出/方法不变
  return { ...actual, logger: { ...actual.logger, warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }
})
```

- `deep.test.ts:157` 已有相邻基线 `expect(showToast).toHaveBeenCalledWith('超时', expect.objectContaining({type:'error'}))`，T7 写成它的同款即可。

**验收命令**（注意 T3 不在 vitest 命令里）：

```bash
npm run type-check                 # T1 + T3
npm run check:arch                 # T4（或 npm run check:health 全量）
npx vitest run tests/unit/generate.test.ts tests/unit/scriptBoxEngine.test.ts tests/unit/scriptBoxEngine.deep.test.ts tests/unit/useNodeGeneration.test.ts
npm run test:smoke
```

> **基线（v2 施工前已跑过，绿）**：`generate.test.ts`(26) + `scriptBoxEngine.test.ts`(44) + `scriptBoxEngine.deep.test.ts`(22) = **92 passed**。`tests/unit/useNodeGeneration.test.ts` 施工前须自行跑一次存基线。

---

## State 4 · 施工

### 4.1 文件清单（唯一真源）

| 文件 | 动作 | 批次 |
|---|---|---|
| `src/types/provider.ts` | **不动**（真源已在此）。可选：在 `GenerationResult`（`:31`）上方补一行「以下别名引用本类型，禁另起 interface」注记 | C1 |
| `src/components/base/api/relayProxy.ts` | `interface RelayGenerationResult`（`:52-58`）→ `export type RelayGenerationResult = GenerationResult` + 顶部 `import type { GenerationResult } from '@/types'` | C1 |
| `src/hooks/useNodeGeneration.ts` | `interface NodeGenerationResult`（`:40-46`）→ `export type NodeGenerationResult = GenerationResult` + `import type { GenerationResult } from '@/types'` | C1 |
| `scripts/check-arch.mjs` | 追加规则 3（见 §3-T4 代码块） | C1 |
| `tests/unit/generate.test.ts` | 补 T3（`expectTypeOf`） | C1 |
| `src/components/scriptbox/scriptBoxEngine.ts` | `:234` → `classifyError(e).type === 'abort'` + import | C2a |
| `tests/unit/scriptBoxEngine.test.ts`（或 `.deep.test.ts`） | 补 T5/T6/T7 + logger mock | C2a |
| `src/hooks/useNodeGeneration.ts` | `:282` `e?.name === 'AbortError'` → `classifyError(e).type === 'abort'` | C2b |
| `tests/unit/useNodeGeneration.test.ts` | 补 T8 | C2b |
| `src/components/base/api/relayProxy.ts` | `:289` 补括号 + 加 debug 日志（见 4.2） | C2c |
| `src/components/base/api/generate.ts` | **改注释** `:11-12`（v1 遗漏） | 契约同步 |
| `tests/unit/generate.test.ts` | **改测试 #4**（`:150-158`）断言（v1 遗漏） | 契约同步 |
| `docs/前端生成门面收口-L3-裁定与修订.md` | §4.2.1 铁律、测试表 #4、风险表 0b 加注记「已由 L3c 统一判定」 | 契约同步 |
| `src/hooks/useGenerateNode.ts` | **不动**（`:147` 已在用 `GenerationResult`） | — |

### 4.2 函数/类型签名

```ts
// ── relayProxy.ts（C1）──
import type { GenerationResult } from '@/types'

/** relay 生成最终结果信封 —— 别名对齐 GenerationResult（单一真源，L3c，禁另立 interface） */
export type RelayGenerationResult = GenerationResult
// 既有函数签名（relayAttachUntilDone:168 / relayGenerate:223 / relayChat:258）不变

// ── useNodeGeneration.ts（C1）──
import type { GenerationResult } from '@/types'

/** run 执行器返回的结果信封 —— 别名对齐 GenerationResult（单一真源，L3c，禁另立 interface） */
export type NodeGenerationResult = GenerationResult
// GenerationRunner(:69) / GenerationOnSuccess(:70) 签名不变

// ── scriptBoxEngine.ts（C2a，:232-239 的 catch）──
import { classifyError } from '../base/utils/genErrors.ts'   // 与 useNodeGeneration.ts:16 同款
// } catch (e) {
//   onReset?.()
//   if (classifyError(e).type === 'abort') {
//     logger.warn('scriptBox', `${info.logLabel}·已中止`, info.ctx)
//   } else {
//     toast(e?.message || info.toastFail)
//     logger.error('scriptBox', `${info.logLabel}·异常`, { ...info.ctx, error: e?.message })
//   }
// }

// ── useNodeGeneration.ts（C2b，:281-288）—— classifyError 已在 :16 导入，无需新增 import ──
// } catch (e) {
//   if (classifyError(e).type === 'abort') {   // 原：e?.name === 'AbortError'
//     logger.debug('生成', '[节点] 用户停止', { nodeId }, { module: 'image' })
//     updateNodeRuntime(nodeId, { error: '' })
//     taskCtl.fail('已停止')
//     return { ok: false, error: '已停止', aborted: true }
//   }
//   ...

// ── relayProxy.ts（C2c，:288-291）—— aborted 判定结果零变更 ──
// } catch (e) {
//   // 中止判定：真·用户取消（AbortError）或 信号已中止（signal 先中止、后续步骤连带抛错）。
//   // 括号不可省：旧写法 `(A && B) || C` 靠读者自推优先级，后续改动极易写错。
//   // 【L3c】error 字段仍给 UI 中文文案（useNodeGeneration:270 不检查 aborted 就直接 toast，
//   //        改英文会造成 UX 退化）；真实原因改由 debug 日志承载，不再被 '已停止' 覆盖丢失。
//   const aborted = (e instanceof Error && e.name === 'AbortError') || !!signal?.aborted
//   if (aborted) {
//     logger.debug('生成', '[relay] chat 中止', { error: e instanceof Error ? e.message : String(e) }, { module: 'image' })
//     return { ok: false, aborted: true, error: '已停止' }
//   }
//   return { ok: false, error: e instanceof Error ? e.message : '聊天失败' }
// }
```

### 4.3 generate.ts 注释改写（契约同步，v1 遗漏）

```ts
// ── generate.ts:10-12 ──
// 【边界铁律 2 · abort 原样上抛】image/video 中止一律**抛** AbortError，且必须**原样透传** relayGenerate 抛出的
//   error（name 恒为 'AbortError'、message 恒为 'Aborted'）——**禁止**自行 new Error('已停止')。
//   原因（L3c 更新）：生成链路的中止判定已统一走 classifyError（genErrors.ts:24），看的是 `e.name`；
//   若自行 new Error 且不设 name='AbortError'，会被判为 business → 中止时误弹红色错误 toast。
//   （L3 原文写的「scriptBoxEngine 用 /abort/i 匹配 message」已于 L3c 失效，判定不再依赖 message 文案。）
```

配套改 `tests/unit/generate.test.ts:150-158`（测试 #4）：

```ts
it('image 中止 → 抛 AbortError（L3c：判据是 name，不再依赖 message）', async () => {
  const err = new Error('Aborted')
  err.name = 'AbortError'
  h.mockRelayGenerate.mockRejectedValueOnce(err)
  await expect(api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' })).rejects.toMatchObject({
    name: 'AbortError',
  })
})
```

> 保留 `message: 'Aborted'` 的实值不变（relayProxy 侧契约未动），只是**断言对象**从 message 改为 name。

### 4.4 施工顺序与验收

```
commit 1（C1 · 纯类型，零运行时行为变更）
  1. relayProxy.ts：interface → type 别名 + import type
  2. useNodeGeneration.ts：同上
  3. 可选：types/provider.ts 补注记
  4. check-arch.mjs：追加规则 3（T4 真锁）
  5. generate.test.ts：补 T3（expectTypeOf）
  验收：npm run type-check  +  npm run check:arch  +  npx vitest run tests/unit/generate.test.ts

commit 2（C2 · 判定统一）
  1. scriptBoxEngine.ts:234 → classifyError + import          （C2a）
  2. useNodeGeneration.ts:282 → classifyError                 （C2b）
  3. relayProxy.ts:289 补括号 + debug 日志                     （C2c）
  4. 补 T5/T6/T7（scriptBoxEngine）+ T8（useNodeGeneration）
  验收：npm run type-check
        + npx vitest run tests/unit/scriptBoxEngine.test.ts tests/unit/scriptBoxEngine.deep.test.ts tests/unit/useNodeGeneration.test.ts
        + npm run test:smoke

commit 3（契约同步 —— 不做会让注释变成谎言）
  1. generate.ts:11-12 注释改写（见 4.3）
  2. generate.test.ts 测试 #4 断言改写（见 4.3）
  3. docs/前端生成门面收口-L3-裁定与修订.md：§4.2.1 铁律 + 测试表 #4 + 风险表 0b 加「已由 L3c 统一判定」注记
  验收：npm run type-check  +  npx vitest run tests/unit/generate.test.ts  +  npm run test:smoke

commit 4（收尾）—— 可选
  1. 本文 §7 待办清零后的记录回填
  2. 全量：npm run check:health  +  npx vitest run
```

**可变性纪律**：三处都是表达式级替换，无状态、无共享数据 mutate、无热路径深拷贝问题。C2 不新增节流（`runAbortable` 无高频路径）。

---

## §5 风险与回滚

| # | 风险 | 概率 | 处置 |
|---|---|---|---|
| 1 | 别名化触发 TS 字面量推断差异 | 极低 | `GenerationResult` 字段全 optional，无字面量窄化；`type-check` 兜底 |
| 2 | T3 被误当成「已生效」（vitest 下恒绿） | **中** | 已在 §3 用加粗写明；验收命令里 T3 只挂在 `type-check` 下。别把「vitest 绿」当成类型断言通过 |
| 3 | 有人把别名改回独立 interface，T1/T3 都不红 | **中** | **T4（check-arch 规则 3）专防此项**；已进 `check:health` 门禁 |
| 4 | C2a 后 T5 找不到能触发 catch 的入口 | 中 | 依次试 `generateImageMock.mockRejectedValueOnce()` 打 `:1101` 与 `:674` 两个入口；若 task 内 try/catch 把异常吞了，降级为断言「`onStopScriptItem` 后 `showToast` 未被调用」（加强 `:306` 既有用例），并在本文记录降级原因 |
| 5 | C2c 顺手把 `error` 改成 `e.message` → 弹英文 toast | 中 | **明令禁止**。`useNodeGeneration:270` 不检查 `aborted` 就 toast。真实原因走 debug 日志 |
| 6 | C2b 改宽判据引入回归 | 极低 | 新判据是旧判据的**超集**（新增 `err?.aborted`），只可能多判 abort，不会少判；T8 兜底 |
| 7 | 业务错含 abort 从 warn 变 toast | 低 | 方向正确，但**该路径几乎不可达**，验收时不要期待可见变化；若 toast 噪音变大另行评估 |

**回滚**：commit 1 / 2 / 3 各自独立，出错 `git reset --hard HEAD~1`。commit 2 内部 C2a/C2b/C2c 互不依赖，可单独 `git checkout HEAD~1 -- <file>` 细粒度回退。

---

## §6 红线复核

| 铁律 | 是否触碰 | 说明 |
|---|---|---|
| CLAUDE.md §5.1 绝对禁区（端口/唯一入口/字符串契约） | ✅ 未触碰 | 纯类型 + 判定表达式替换，不改任何 API 路径/字段名/协议 |
| 失败可见（禁止静默吞错） | ✅ 未新增吞错 | **表述更正（v1 夸大）**：C2a 消除的是「message 依赖」这一**脆弱性**，不是一处正在发生的吞错（该路径几乎不可达，见 §1-C2 注）。C2c 补的是**可追溯性**（真实原因不再被 `'已停止'` 覆盖丢失） |
| 异步总超时 | ✅ 未新增异步 | 不涉 |
| 统一错误分类唯一入口 | ✅ C2a/C2b 是回归该入口 | C1 不涉错误 |
| 循环依赖（§5.4.2 TDZ） | ✅ 无风险 | 新增均为 `import type`，编译期擦除；`check-arch` 规则 1 兜底 |

---

## §7 施工前必做（v1 的 4 条待实测已消灭，剩这 3 条）

1. 跑 `npx vitest run tests/unit/useNodeGeneration.test.ts` 存**改动前基线**（v2 已跑的 92 passed 不含此文件）。
2. 跑 `npm run check:arch` 存基线，确认规则 3 追加前是绿的。
3. commit 2 施工时，先确认 `:1101` / `:674` 哪个入口能让异常真正到达 `runAbortable` 的 catch（风险表 #4）。

**已由 v2 审计消灭、无需再验**：vitest 对 `expectTypeOf` 的支持与执行条件、`scriptBoxEngine` 双套件基线、`/abort/i` 全库唯一性、信封类型跨模块泄漏面。
