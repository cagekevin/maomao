# 架构日志 · 存储 / 持久化 · 2026-09-14（二十轮 · 施工轮）

> **文件名**：`02-存储-持久化-二十轮-静默豁免成本层-NON_BLOCKING收口-2026-09-14.md`（同区多次审计各写新日期文件、不覆盖旧档）。
> **本轮性质**：**施工轮**（用户授权「继续 · 开第 3 批：NON_BLOCKING 31」）。
> **依据**：`架构师改码7步法.md`（Step 0→7）+ `架构师心法.md §零.4`（闸的成本守恒）+ `十九轮` 日志 `下一批候选（NON_BLOCKING 31）`。
> **与 TD-02-26 的关系**：成本层第 3 批（前两轮：RELEASE_FAIL 16→2、PARSE_FALLBACK 11→2）。

---

## 一、Step 0 普查（先查仓库里已有什么）

| 问题 | 取证结论 |
| --- | --- |
| 已有"非阻塞吞错"原语吗？ | **无**。`base/utils/asyncGuard.ts` 无 `attemptQuietly`；同义的 fire-and-forget 吞错散落在 31 处手写 `try/catch` + `NON_BLOCKING` 标记。 |
| 原语该住哪？ | **`base/utils/asyncGuard.ts`**（与 `releaseQuietly` / `tryParse` 同文件，镜像收口形态）；判据同前：① 同族边界守卫语义 ② `base/core/**` 引本文件已有先例 ③ 13 个新消费方 import 面最优。 |
| 同语义手写几份？ | 原标记 **31 处**（accountsStore 10 · asyncGuard 3 · useAgentChat 3 · useCanvasSync 2 · storageAdapter 2 · ImageEditor 2 · 其余各 1）。 |

## 二、Step 1–3：31 处标记的真实形态（判据先行 · 标签是线索不是结论）

> ⚠️ **本轮最关键的 SOP 教训（准确性铁律 A1/A2）**：上轮（`十九轮` 日志「下一批候选」）我曾**假设**「NON_BLOCKING 31 … 预计多数改 `reportDegrade`」。本轮逐一 `grep` + 读真实代码后，**该假设被实证推翻**——31 处里绝大多数是**真·非阻塞 fire-and-forget**（轮询 / 跨标签页广播 / 可选增强 / 最佳努力 chrome API），硬改 `reportDegrade` 会引入噪音与行为变更、无依据。另有 **4 处是误标**。

| 真实语义 | 处数 | 文件:行 | 处置 |
| --- | --- | --- | --- |
| 真·非阻塞 fire-and-forget（轮询/广播/增强/最佳努力落盘，失败确无关主链路） | **~24** | `useAssetDropPaste:260`(contentId 增强) · `useCanvasSync:87`(轮询) · `d3dPersistence:88`(广播) · `imageUpscale:112` · `imageCompress:146` · `asyncGuard:66/141` · `ResourceLibrary:373`/`GeneratedView:314`(建文件夹→false 由 UI 呈现) · `storageAdapter:76/128` · `ImageEditor:250/360` · `canvasPlanExecutor:377` · `accountsStore:455/632`(外层) · … | **保留标记**（语义正确；形态各异、不强行收口） |
| 同质·批量单步失败（chrome API / 会话落盘，逐次失败不阻断） | **13** | `accountsStore:340/355/448/586/607/625/662/671`（10）· `useAgentChat:942/974/1094`（3） | **收口进 `attemptQuietly` 原语**（标记全数消失） |
| 误标①：释放/取消 teardown（**非订阅**） | 3 | `useCanvasSync:71`(`channel?.close()`) · `OverlayEditor:601`(`releasePointerCapture`) · `asyncGuard:76`(`sig?.abort()`) | **改判 `RELEASE_FAIL` → `releaseQuietly`**（原语已存在） |
| 误标②：正则编译失败（**非订阅**） | 1 | `contentStore:195`(`compilePatternRegex(k)`) | **改判 `PARSE_FALLBACK` → `tryParse`**（同 `十九轮` 的 `storageQuota`，原语已存在） |
| 误标③：订阅失败（**非解析**） | 1 | `backendLogStream:52`(`new EventSource` 订阅失败，前轮暂挂 PARSE_FALLBACK) | **重标 `NON_BLOCKING`**（归位正确语义；仍走"订阅失败静默"） |

> **判据（Step 3「先分清重复的种类」）**：13 处是同族"尽力而为吞错"→ **收口为单一 `attemptQuietly`**；3 处是**判据不同**（teardown ≠ 非阻塞）→ **不并入、改判 RELEASE_FAIL**；1 处是**解析失败**→ 改判 PARSE_FALLBACK；1 处是**宿主不同**（订阅失败）→ 重标本码。

## 三、改动清单

1. **新增原语**（`base/utils/asyncGuard.ts`，主实现 + 自带理由 + 配测试）：
   - `attemptQuietly(act)`（同步）/ `attemptQuietlyAsync(act)`（异步：包裹 `await act()`）—— `NON_BLOCKING` 的**主实现**（fire-and-forget / 批量单步失败不阻断主链路）。
   - 文件头【用法】+【归属说明】补 `attemptQuietly` 行。
2. **13 处收口**：`accountsStore`（×8，余 2 处外层 catch 保留）+ `useAgentChat`（×3）→ `attemptQuietly`/`attemptQuietlyAsync`，**调用点零标记**。
3. **4 处误标改判**：`useCanvasSync`(`close`) · `OverlayEditor`(`releasePointerCapture`) · `asyncGuard`(`sig.abort`) → `releaseQuietly`；`contentStore`(`compilePatternRegex`) → `tryParse`。**零新增标记**（均走既有原语）。
4. **1 处重标**：`backendLogStream` `PARSE_FALLBACK` → `NON_BLOCKING`（归位正确语义）。
5. **登记表反向指认**：`core/catchOk.ts` 的 `NON_BLOCKING` 注释写明「**主实现 = `asyncGuard.ts` 的 `attemptQuietly`**；**再出现手写 NON_BLOCKING 豁免 = 回潮信号**」，并**记录 4 处误标真相**（防后续 AI 再当真）。
6. **测试**：`tests/unit/asyncGuard.test.ts` 新增 4 例（同步/异步 成功执行 & 抛错被吞）。

## 四、度量（改前 / 改后 · 实测 grep 口径）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| `NON_BLOCKING` 标记处数 | **31** | **19** |
| `PARSE_FALLBACK` 标记处数 | 2 | **1**（仅 `asyncGuard.ts` 内部；`backendLogStream` 重标离场、`contentStore` 改判 `tryParse`） |
| `RELEASE_FAIL` 标记处数 | 2 | 2（不变；3 处误标复用既有原语，零新增） |
| 全库 `catch-ok` 标记总数（实测 `Select-String`） | 71（十九轮后） | **58**（−13） |
| 真 `NON_BLOCKING` 同质手写 `try/catch` 块 | 13 | **0**（→ `attemptQuietly`） |
| 误标改判 | — | 3 → `RELEASE_FAIL` + 1 → `PARSE_FALLBACK`（均走既有原语） |
| 新增公共原语 | 0 | **2**（`attemptQuietly` / `attemptQuietlyAsync`，同文件） |
| import 面 | — | 6 文件新增 1 行（`accountsStore`/`useAgentChat`/`useCanvasSync`/`OverlayEditor`/`contentStore` 引既有原语；`backendLogStream` 仅改码） |
| 行为变更 | — | **0**（豁免形态收口 + 4 处码改判 + 1 处重标；类型与运行行为不变） |

## 五、验证（Step 7）

- `npx tsc --noEmit` **exit 0**；
- `node scripts/check-silent-catch.mjs` → **✅ 0 违规**；
- 相关单测 **全绿**：`asyncGuard` 27〔含新增 4〕· `contentStore` 71 · `accountsStore` 30 · `useAgentChat` 65 · `useCanvasSync` 7 · `OverlayEditor` 1（= 201，含他轮）；
- **探针（先红后绿 · `node scripts/probe.mjs`）**：

  | 次 | 注入 | 观测 | 结论 |
  | --- | --- | --- | --- |
  | 1（先红） | 把 `attemptQuietly` catch 体内改为 `throw new Error('PROBE-not-swallowed')` | `exit=1`，输出含 `PROBE-not-swallowed` | ✅ 命中 —— 证明新增测试**精确锁住"吞掉不外抛"** |
  | 2（后绿） | 还原（sha `771dbd56d018` 一致，journal 已清） | `exit=0`，27 例全绿 | ✅ 绿 |

  > 跑完 `asyncGuard.ts` 已还原、工作区零污染。

## 六、覆盖度表（增量：只列本轮变化行）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `base/utils/asyncGuard.ts`（@见 16 区） | L1 core/utils | 深审 | 🟢 | 二十轮 09-14 | 新增 `attemptQuietly`/`attemptQuietlyAsync`；tsc/单测/闸/探针全绿 | 非债（偿还动作） |
| `base/core/catchOk.ts` | L1 core | 深审 | 🟢 | 二十轮 09-14 | `NON_BLOCKING` 注释反向指认原语 + 记 4 处误标真相 | 非债 |
| `base/store/accountsStore.ts` · `agent/runtime/useAgentChat.ts` | L1–L3 | 回查 | 🟢 | 二十轮 09-14 | 13 处改调 `attemptQuietly`/`Async`，相关单测实证 | 非债（行为不变） |
| `hooks/useCanvasSync.ts` · `base/editors/OverlayEditor.tsx` · `base/utils/asyncGuard.ts` · `base/core/contentStore.ts` | L1–L3 | 回查 | 🟢 | 二十轮 09-14 | 4 处误标改判 `releaseQuietly`/`tryParse` | 非债（行为不变） |
| `base/core/backendLogStream.ts` | L1 core | 回查 | 🟢 | 二十轮 09-14 | `PARSE_FALLBACK` → `NON_BLOCKING` 重标 | 非债 |
| 其余 ~24 处真 `NON_BLOCKING`（轮询/广播/增强/落盘回退/建文件夹返回 false） | L1–L3 | 回查 | 🟢 | 二十轮 09-14 | 读真实代码确认语义正确，保留标记 | 非债 |
| `tests/unit/asyncGuard.test.ts` | 测试 | 深审 | 🟢 | 二十轮 09-14 | 新增 4 例 + 探针先红后绿 | 非债 |

**覆盖账**：本轮审/改 **10 个文件**（8 src + 1 测试 + 1 登记表）；**行为变更 = 0**；未审 0（本批范围内）。

## 七、结论与下一批

- **TD-02-26「成本层」第 3 批完成**：`NON_BLOCKING` 31 → 19，全库标记 71 → 58。
- **关键方法收益（再次印证 SOP）**：①「标签是线索不是结论」——31 处里 4 处误标（3 处 teardown 实为 `RELEASE_FAIL`、1 处正则编译实为 `PARSE_FALLBACK`），若照单全收硬改 `reportDegrade` 会把错误语义固化；② **敢推翻自己的上轮假设**——上轮写"多数改 reportDegrade"，census 证伪后改为"收口同质 13 + 保留真非阻塞"，避免无依据的行为变更。
- **下一批（按同判据，各批独立授权）**：
  1. 剩余 `NON_BLOCKING` 19 处多为**语义性非阻塞**（轮询/广播/增强/落盘回退/建文件夹返回 false），形态各异、**不强行收口**，建议转战其它码：
  2. `CLIPBOARD` 8 / `READ_FALLBACK` 6 / `BROWSER_API` 5 / `ALREADY_REPORTED` 4 / `KEEP_ORIGINAL` 3 / `MIGRATION` 1 / `LOCK_CHAIN` 2 / `RECURSION_GUARD` 3 → 各按"≥3 同质则收口原语 / 单点判"处理。
  → 目标：**58 → ~13** 量级（剩 `RECURSION_GUARD` 3 · `LOCK_CHAIN` 2 · `MIGRATION` 1 + 少数真结构性）。
- **观察（非本轮范围，未动）**：`package.json` 重复键 `check:gates`（第 34 行 `gates-run.mjs list` 与第 40 行 `check-gates.mjs` 重名，后者覆盖前者），`vitest` 启动告警。属预存在工具配置债，留待工具链治理批。
