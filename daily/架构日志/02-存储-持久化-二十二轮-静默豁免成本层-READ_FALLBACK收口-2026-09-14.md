# 架构日志 · 存储 / 持久化 · 2026-09-14（二十二轮 · 施工轮）

> **文件名**：`02-存储-持久化-二十二轮-静默豁免成本层-READ_FALLBACK收口-2026-09-14.md`（同区多次审计各写新日期/轮次文件、不覆盖旧档）。
> **本轮性质**：**施工轮**（用户「好」→ 开下一批 → 选 READ_FALLBACK 6）。
> **依据**：`架构师改码7步法.md`（Step 0→7）+ `架构师心法.md §零.4`（闸的成本守恒）+ `二十一轮` 日志下一批候选。
> **与 TD-02-26 的关系**：成本层第 5 批（前：RELEASE_FAIL 16→2、PARSE_FALLBACK 11→2、NON_BLOCKING 31→19、CLIPBOARD 8→4）。

---

## 一、Step 0 普查

| 问题 | 取证结论 |
| --- | --- |
| READ_FALLBACK 标记数 | **6 处** |
| catchOk 语义 | `READ_FALLBACK` = "读取失败回退默认/容错（配置/偏好/订阅回调读不到 → 用默认值）"。**关键**：catchOk.ts 明确——READ_FALLBACK **无强制专属原语**（不像 RELEASE_FAIL/PARSE_FALLBACK/NON_BLOCKING 有 `releaseQuietly`/`tryParse`/`attemptQuietly`），故合法读回退仍手写标记并注明原因。 |
| `contentGet` 是否可抛 | `contentGet` → `loadFromLocal` → `JSON.parse`；**脏数据可抛** → 读回退 try/catch 必要。 |
| `contentSet` 是否可抛 | `contentSet`（contentStore.ts:526）"**永不因持久化失败而抛错**"；仅契约违约（未登记键 / 不可序列化 / notify 抛）才抛 → 包裹写失败须用 NON_BLOCKING 原语。 |
| `getCreditGate` 是否可抛 | `getCreditGate`（conversationSkillState.ts:105）= `getActiveConv()?.[FIELD]` + `isCreditGate` 守卫 → 纯函数**永不抛**。 |
| `logs.push` 是否可抛 | `useCanvasAgentTools` 内 `const logs: unknown[] = []`（:1382），`logs.push(it)` **永不抛**。 |

## 二、Step 1–3：6 处真实形态（判据先行 · 标签是线索不是结论）

| 真实语义 | 处数 | 文件:行 | 处置 |
| --- | --- | --- | --- |
| **合法 READ_FALLBACK**（contentGet 脏数据回退默认，语义正确） | 3 | `AgentPanel.tsx:209`(`loadWidth`:contentGet→数字钳制→DEFAULT_WIDTH) · `agentModelStore.ts:36`(`loadAgentChatModel`:contentGet→JSON.parse→null) · `agentModelStore.ts:70`(`loadAgentHistoryTurns`:contentGet→Number→默认 6) | **保留标记**（读取脏数据确会抛，回退必要） |
| **误标码**：`contentSet` 是**写入**误标 READ_FALLBACK（注释也写"记忆写入失败"） | 1 | `nodePrefs.ts:131` | **改走 `attemptQuietly`（NON_BLOCKING 原语）**，行为不变 |
| **死代码**：`getCreditGate()` 永不抛，外层 try/catch 永不被触发 | 1 | `AgentPanel.tsx:625` | **移除死 try/catch** |
| **死代码**：`logs.push(it)` 永不抛，外层 try/catch 永不被触发 | 1 | `useCanvasAgentTools.ts:1436` | **移除死 try/catch** |

> **判据（Step 3「先分清重复的种类」）**：6 处里 1 处是**判据不同**（写 ≠ 读 → 路由到 NON_BLOCKING 原语 `attemptQuietly`）+ 2 处是**死代码**（被保护操作本就不抛错，try/catch 恒无效）。若只按标签"保留 READ_FALLBACK"，会把一处误标和两处死代码永久固化。

## 三、改动清单

1. **`nodePrefs.ts`**：`mergeNodePrefs` 内 `try { loadAll(); contentSet(STORAGE_KEY, all) } catch { /* READ_FALLBACK */ }` → `attemptQuietly(() => { loadAll(); ...; contentSet(STORAGE_KEY, all) })`；新增 `import { attemptQuietly } from '../utils/asyncGuard.ts'`。写失败仍忽略、本次参数仍生效（行为零变化），标记由误标 READ_FALLBACK 改为 NON_BLOCKING 原语。
2. **`AgentPanel.tsx`**：移除 `setCreditGatePreview(getCreditGate())` 外层死 try/catch（getCreditGate 纯守卫永不抛）。订阅回调其余逻辑不变。
3. **`useCanvasAgentTools.ts`**：`onLog` 内 `logs.push(it)` 移除死 try/catch（局部数组 push 永不抛）。日志收集行为不变。
4. **CLIPBOARD 批遗留修复（本轮顺带）**：`VideoExtractNode.test.tsx:28` 的 `downloadUrl` mock 原写成**无参** `vi.fn(() => ({ok:true,msg:''}))`，导致 `:64` `h.downloadUrl(...a)` 展开参数触发 `TS2556`——该批跑 tsc 早于该测试改动故未暴露。本轮补成 rest 参数签名 `vi.fn((..._a: unknown[]) => ({ok:true,msg:''}))`，tsc 复绿。

## 四、度量（改前 / 改后 · 实测 grep 口径）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| `READ_FALLBACK` 标记处数 | **6** | **3**（仅保留 3 处合法读回退） |
| 全库 `catch-ok` 标记总数（实测 `Select-String`） | 54（二十一轮后） | **51**（−3） |
| 误标码改判 | — | 1（写 → NON_BLOCKING 原语） |
| 死代码移除 | — | 2（AgentPanel / useCanvasAgentTools） |
| 新增公共原语 | 0 | **0**（复用 `attemptQuietly`） |
| import 面 | — | 1 文件新增 `attemptQuietly` 导入（nodePrefs） |
| 行为变更 | — | **0**（均不改变可见行为；nodePrefs 仍忽略写失败、本次参数仍生效） |

## 五、验证（Step 7）

- `npx tsc --noEmit` **exit 0**（修复 CLIPBOARD 批遗留 TS2556）；
- `node scripts/check-silent-catch.mjs` → **✅ 0 违规**；
- 受影响单测 **55 例全绿（EXIT 0，无未处理 rejection）**：`AgentPanel` 27 · `nodePrefs` 10 · `nodePrefsRegression` 4 · `useCanvasAgentTools` 14；
- **探针**：READ_FALLBACK 无新增原语（合法 3 处手写标记符合 catchOk.ts 约定）；`attemptQuietly` 吞错语义由二十轮 / CLIPBOARD 批探针锁定（本轮仅复用，未改原语）。

## 六、覆盖度表（增量：只列本轮变化行）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `components/base/canvas/nodePrefs.ts` | L1 core/store | 回查 | 🟢 | 二十二轮 09-14 | contentSet 写失败改走 attemptQuietly（NON_BLOCKING 原语），行为零变；nodePrefs.test 10 + nodePrefsRegression 4 绿 | 非债（误标改判） |
| `components/panels/AgentPanel.tsx` | L2 UI | 回查 | 🟢 | 二十二轮 09-14 | 移除 getCreditGate 死 try/catch（纯守卫永不抛）；AgentPanel.test 27 绿 | 非债（死代码移除） |
| `components/agent/canvas/useCanvasAgentTools.ts` | L2 UI | 回查 | 🟢 | 二十二轮 09-14 | 移除 logs.push 死 try/catch（局部数组永不抛）；useCanvasAgentTools.test 14 绿 | 非债（死代码移除） |
| `tests/unit/VideoExtractNode.test.tsx` | 测试 | 深审 | 🟢 | 二十二轮 09-14 | downloadUrl mock 补 rest 参数签名，修 CLIPBOARD 批遗留 TS2556 | 非债（测试契约对齐） |

**覆盖账**：本轮审/改 **3 个 src + 1 个测试**；**行为变更 = 0**；未审 0。

## 七、结论与下一批

- **TD-02-26「成本层」第 5 批完成**：`READ_FALLBACK` 6 → 3，全库标记 54 → 51。
- **关键方法收益（再次印证 SOP）**：6 处里 1 处**误标码**（写入被当读取）+ 2 处**死代码**（被保护操作本就不抛错）——若只按标签"保留 READ_FALLBACK"会固化误标与死代码；必须回到真实代码判形态。
- **累计（5 批）**：CLIPBOARD 8→4、READ_FALLBACK 6→3，全库 71 → 51。
- **下一批候选（各批独立授权）**：`BROWSER_API` 5 / `ALREADY_REPORTED` 4 / `KEEP_ORIGINAL` 3 / `LOCK_CHAIN` 2 / `RECURSION_GUARD` 3 / `MIGRATION` 1 → 目标：**51 → ~11**。
- **观察（非本轮范围，未动）**：`package.json` 重复键 `check:gates`（34/40 行重名，后者覆盖前者），`vitest` 启动告警，留待工具链治理批（@见 17 区）。
