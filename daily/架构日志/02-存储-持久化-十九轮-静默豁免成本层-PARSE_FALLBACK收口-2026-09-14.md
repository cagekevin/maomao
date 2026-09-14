# 架构日志 · 存储 / 持久化 · 2026-09-14（十九轮 · 施工轮）

> **文件名**：`02-存储-持久化-十九轮-静默豁免成本层-PARSE_FALLBACK收口-2026-09-14.md`（同区多次审计各写新日期文件、不覆盖旧档）。
> **本轮性质**：**施工轮**（用户授权「开第 2 批：PARSE_FALLBACK 11 → `tryParse` 原语 + 测试 + 度量」）。
> **依据**：`架构师改码7步法.md`（Step 0→7）+ `架构师心法.md §零.4`（闸的成本守恒）+ `十八轮` 日志 `下一批候选①`。
> **与 TD-02-26 的关系**：TD-02-26 成本层第 1 批（十八轮）收口 `RELEASE_FAIL 16→2`；本轮是第 2 批（`PARSE_FALLBACK 11`）。

---

## 一、Step 0 普查（先查仓库里已有什么）

| 问题 | 取证结论 |
| --- | --- |
| 已有"解析兜底"原语吗？ | **无**。`base/utils/asyncGuard.ts` 无 `tryParse`；仅 `contentStore.ts:165` 有一个文件级私有 `tryParse(s): unknown`（JSON 失败返原串，语义不同、未导出、非本成本层）。 |
| 原语该住哪？ | **`base/utils/asyncGuard.ts`**（与十八轮 `releaseQuietly` 同文件，镜像「`RELEASE_FAIL` 唯一实现」的收口形态）；判据同十八轮：① 同族语义（边界守卫原语）② `base/core/**` 引本文件已有先例，不倒置 ③ 6 个新消费方零新增 import 面最优。 |
| 同语义手写几份？ | 原标记 11 处（见下）。 |

## 二、Step 1–3：11 处标记的真实形态（判据先行 · 标签是线索不是结论）

> ⚠️ **核心发现（SOP 准确性铁律 A1/A2：「任何名称也是描述，必须 grep 再写」）**：原 11 处 `catch-ok: PARSE_FALLBACK` 标记里，**只有 8 处是真解析兜底**，其余 3 处是**误标**——这正是 SOP 反复警告的「拿标签当结论」翻车点。逐处 `grep` + 读真实代码取证：

| 真实语义 | 处数 | 文件:行 | 处置 |
| --- | --- | --- | --- |
| 真·解析失败兜底（JSON / DOMParser / URL / 正则编译失败 → 落默认分支） | **8** | `useAssetDropPaste.ts:312/377/395` · `AssetNode.tsx:160` · `clipboard.ts:399` · `agentCore.ts:225` · `resourceStore.ts:384` · `storageQuota.ts:169` | **收口进 `tryParse`**（统一原语，调用点零标记） |
| 误标①：释放/取消 teardown（**非解析**） | 2 | `GridMergeNode.tsx:523`（`document.body.removeChild`）· `agentRuntime.ts:267`（`res?.body?.cancel?.()`） | **改判 `RELEASE_FAIL` → `releaseQuietly`**（原语已存在，行为无损） |
| 误标②：订阅失败（**非解析**，属网络/订阅） | 1 | `backendLogStream.ts:52`（`new EventSource` 订阅失败） | **留待 `NON_BLOCKING` 批重标**（该批有不同处置口径：多数应改 `reportDegrade`） |

> **判据（Step 3「先分清重复的种类」）**：本批 8 处是**探测/运算重复**（同一件"怎么安全解析"的事）→ **可收口为单一 `tryParse`**；那 2 处是**判据不同**（teardown 失败不阻断 ≠ 解析失败兜底）→ **不并入 tryParse、改判 RELEASE_FAIL**；那 1 处是**宿主不同**（订阅失败归 NON_BLOCKING）。

## 三、改动清单

1. **新增原语**（`base/utils/asyncGuard.ts`，唯一实现 + 自带理由 + 配测试）：
   - `tryParse<T>(parser: () => T, fallback?: T): T | undefined` —— `parser()` 抛错即返回 `fallback`（默认分支 / 默认文案 / 空值）。
   - **为什么不限定 JSON/DOM**：`await` 与否、解析器种类都不同，但"解析失败 → 落默认"这一**判据**完全统一 → 一个泛型 `tryParse` 收口（窄接口 + 厚实现 = 深模块）；`fallback` 作为参数承载差异，不重分类。
   - 文件头【用法】+【归属说明】补 `tryParse` 行。
2. **8 处调用点收口**：`useAssetDropPaste`（×3）· `AssetNode` · `clipboard` · `agentCore` · `resourceStore` · `storageQuota` → 全部改 `tryParse(...)`，**不再有任何 `catch-ok` 标记**。
3. **2 处误标改判**：`GridMergeNode`（`removeChild`）· `agentRuntime`（`res.body.cancel`）→ 改调 `releaseQuietly(...)`（标记随之消失，零新增）。
4. **登记表反向指认**：`core/catchOk.ts` 的 `PARSE_FALLBACK` 注释写明「**唯一实现 = `asyncGuard.ts` 的 `tryParse`**；**再出现手写 PARSE_FALLBACK 豁免 = 回潮信号**」，并**记录 3 处误标真相**（防后续 AI 再当真）。
5. **测试**：`tests/unit/asyncGuard.test.ts` 新增 6 例（解析成功 / 失败返 fallback / 未传 fallback 返 undefined / 抛错不外抛 / URL 解析真实场景 / 正则编译真实场景）。

**施工中确认零类型回归**（诚实留痕）：8 处收口点 `tsc --noEmit` 直接 exit 0，无 `let`→闭包窄化丢失等问题（与十八轮 `uiHooks`/`director3d` 不同，本批调用点无需在闭包外先落 `const`）。

## 四、度量（改前 / 改后 · 实测 grep 口径）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| `PARSE_FALLBACK` 标记处数 | **11** | **2**（1 原语内部 `asyncGuard.ts` + 1 `backendLogStream` 待 NON_BLOCKING 批） |
| 全库 `catch-ok` 标记总数（实测 `Select-String`） | 80（十八轮后） | **71**（−9：8 收口 + 2 误标改判 releaseQuietly；+1 原语内部） |
| 真 `PARSE_FALLBACK` 语义的手写 `try/catch` 块 | 8 | **0** |
| 误标改判 | — | 2 → `RELEASE_FAIL`（releaseQuietly）+ 1 → 待 `NON_BLOCKING` |
| `RELEASE_FAIL` 标记 | 2 | 2（不变；新增 2 处 `releaseQuietly` 调用，标记仍只在原语内部） |
| 新增公共原语 | 0 | **1**（`tryParse`，同文件） |
| import 面 | — | 6 文件新增 1 行（`useAssetDropPaste`/`AssetNode`/`clipboard`/`agentCore`/`storageQuota`/`resourceStore`）；`GridMergeNode`/`agentRuntime` 在既有 `asyncGuard` import 上加 `releaseQuietly` |
| 行为变更 | — | **0**（豁免形态收口 + 2 处码改判；类型与运行行为不变） |

## 五、验证（Step 7）

- `npx tsc --noEmit` **exit 0**；
- 相关单测 **8 文件 / 154 例全绿**（`asyncGuard` 23〔含新增 6〕· `useAssetDropPaste` 29 · `storageQuota` 22 · `resourceStore` 31 · `clipboard` 31 · `agentRuntime` 6 · `agentLogic` 24 · `GridMergeNode` 6 · `AssetNode` 5）；
- `node scripts/check-silent-catch.mjs` → **✅ 0 违规**；
- **探针（先红后绿 · `node scripts/probe.mjs`）**：

  | 次 | 注入 | 观测 | 结论 |
  | --- | --- | --- | --- |
  | 1（先红） | 把 `tryParse` catch 体内 `return fallback;` 换成 `throw new Error('PROBE-not-swallowed')` | `exit=1`，输出含 `PROBE-not-swallowed` | ✅ 命中 —— 证明新增测试**精确锁住"吞掉不外抛"**这一点（注入后测试立即变红） |
  | 2（后绿） | 还原（sha `a688180f8294` 一致，journal 已清） | `exit=0`，23 例全绿 | ✅ 绿 |

  > 跑完 `asyncGuard.ts` 已还原、工作区零污染（`git status src` 仅含本轮预期改动）。

## 六、覆盖度表（增量：只列本轮变化行）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `base/utils/asyncGuard.ts`（@见 16 区） | L1 core/utils | 深审 | 🟢 | 十九轮 09-14 | 新增 `tryParse`；文件头扩定位；tsc/单测/闸/探针全绿 | 非债（本轮为**偿还动作**） |
| `base/core/catchOk.ts` | L1 core | 深审 | 🟢 | 十九轮 09-14 | `PARSE_FALLBACK` 注释反向指认原语 + 记 3 处误标真相 | 非债 |
| `hooks/useAssetDropPaste.ts` · `nodes/AssetNode.tsx` · `base/utils/clipboard.ts` · `agent/runtime/agentCore.ts` · `base/store/resourceStore.ts` · `base/storage/storageQuota.ts` | L1–L3 | 回查 | 🟢 | 十九轮 09-14 | 8 处改调 `tryParse`，相关单测实证 | 非债（行为不变） |
| `nodes/GridMergeNode.tsx` · `agent/runtime/agentRuntime.ts` | L1–L3 | 回查 | 🟢 | 十九轮 09-14 | 2 处误标改判 `releaseQuietly` | 非债（行为不变） |
| `base/core/backendLogStream.ts` | L1 core | 待下批 | 🟡 | 十九轮 09-14 | 标记定位为 `NON_BLOCKING` 误标，移交该批重标 | 待 `NON_BLOCKING` 批 |
| `tests/unit/asyncGuard.test.ts` | 测试 | 深审 | 🟢 | 十九轮 09-14 | 新增 6 例 + 探针先红后绿 | 非债 |

**覆盖账**：本轮审/改 **11 个文件**（9 src + 1 测试 + 1 登记表）；**行为变更 = 0**；未审 0（本批范围内）。

## 七、结论与下一批

- **TD-02-26「成本层」第 2 批完成**：`PARSE_FALLBACK` 11 → 2，全库标记 80 → 71。
- **关键方法收益**：本批再次验证 SOP「标签是线索不是结论」——11 处里 3 处误标（2 处实为 `RELEASE_FAIL` teardown、1 处实为 `NON_BLOCKING` 订阅失败）。若照单全收硬改 11 处 `tryParse`，会把 3 处错误语义固化进新原语。取证后只收口真 8 处，2 处顺手归位 `releaseQuietly`（原语已存在、零成本），1 处移交正确批次。
- **下一批（按同判据，各批独立授权）**：
  1. `NON_BLOCKING` 31（拆：`accountsStore` 10 处同质 → `attemptEach`；其余 21 处逐处判，预计多数改 `reportDegrade` 留痕；含本批移交的 `backendLogStream`）
  2. `CLIPBOARD` 8 / `READ_FALLBACK` 6 → 各 1 原语
  3. `BROWSER_API` 5（含十八轮 2 处改判）/ `ALREADY_REPORTED` 4 / `KEEP_ORIGINAL` 3 → 逐处判
  → 目标：**71 → ~13**（只剩 `RECURSION_GUARD` 3 · `LOCK_CHAIN` 2 · `MIGRATION` 1 + 少数真结构性）。
- **观察（非本轮范围，未动）**：`package.json` 存在重复键 `check:gates`（第 34 行 `gates-run.mjs list` 与第 40 行 `check-gates.mjs` 重名，后者覆盖前者），`vitest` 启动告警。属预存在的工具配置债，非本轮引入，按 SOP 不擅自扩 scope，留待工具链治理批处理。
