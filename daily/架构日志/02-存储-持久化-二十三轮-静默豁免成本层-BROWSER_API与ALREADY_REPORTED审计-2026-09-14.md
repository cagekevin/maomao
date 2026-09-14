# 架构日志 · 存储 / 持久化 · 2026-09-14（二十三轮 · 施工轮）

> **文件名**：`02-存储-持久化-二十三轮-静默豁免成本层-BROWSER_API与ALREADY_REPORTED审计-2026-09-14.md`
> **本轮性质**：**施工轮**（用户「好」→ 开下一批 → 选 BROWSER_API + ALREADY_REPORTED）。
> **依据**：`架构师改码7步法.md`（Step 0→7）+ `架构师心法.md §零.4`（闸的成本守恒）+ `二十二轮` 日志下一批候选。
> **与 TD-02-26 的关系**：成本层第 6 批（前：RELEASE_FAIL 16→2、PARSE_FALLBACK 13→2、NON_BLOCKING 50→19、CLIPBOARD 8→4、READ_FALLBACK 6→3）。本轮覆盖剩余手写类中的 BROWSER_API 与 ALREADY_REPORTED，并顺带复核其余手写类（KEEP_ORIGINAL / LOCK_CHAIN / RECURSION_GUARD / MIGRATION）。

---

## 一、Step 0 普查

| 问题 | 取证结论 |
| --- | --- |
| 各手写类站点数 | BROWSER_API 5 · ALREADY_REPORTED 4 · KEEP_ORIGINAL 3 · LOCK_CHAIN 2 · RECURSION_GUARD 3 · MIGRATION 1 |
| catchOk 语义复核 | `BROWSER_API` = 浏览器 API 预期不可用（autoplay 拒绝 / 跨域污染 / 扩展 API 在宿主不可用时抛），**无强制原语**（手写类，合法即保留）。`ALREADY_REPORTED` = "失败已由他处可见（引擎已 toast / logger 已留痕），此处仅防 unhandled rejection"。`PARSE_FALLBACK` = 解析失败兜底，**唯一实现 = `tryParse`**（手写 `catch-ok` 属"回潮信号"，应改调原语）。 |
| 静默 catch 门禁命中面 | 仅命中 `catch {}` / `.catch(() => {})` / `.catch(() => null\|undefined\|0\|void 0)`；**`.catch(() => '')` 不命中**（空串不在回潮哨兵内）。 |

## 二、Step 1–3：形态判定（判据先行 · 标签是线索不是结论）

| 分类 | 真实语义 / 判读 | 处数 | 处置 |
| --- | --- | --- | --- |
| **BROWSER_API** | `useVideoPoster` 包裹 `drawVideoFrame→canvas.toDataURL`（跨域污染 / canvas taint）· `PlaybackSink` `el.play()`（autoplay 政策拒绝）· `faceMosaic` `chrome.runtime.getURL`（扩展 API 在宿主不可用）· `VideoThumbnail` `play()/pause()`（媒体控制被浏览器拒绝） | 5 | **全合法，保留**（手写类，无原语可收口） |
| **ALREADY_REPORTED** | `StepShots` `callbacks.onGenerateScript?.()`：引擎内部已 toast，此处仅防 rejection → **合法**，保留 | 1（保留） | 保留 |
| ALREADY_REPORTED（误标） | `httpClient.readErrorBody` `res.json()` / `res.text()` 失败 → 实为**解析 / 读取失败兜底**（非 JSON 错误体 / 无 body），非"他处已报告" | 2 | **改 `PARSE_FALLBACK`**（手写，async 无 sync 原语可套） |
| ALREADY_REPORTED（误标） | `agentCore.parseAgentError` `JSON.parse(text)` 失败 → 实为**解析兜底**（保留默认文案），非"他处已报告" | 1 | **改调 `tryParse` 原语**（消除手写豁免标记） |
| **KEEP_ORIGINAL** | `Director3DNode` 落盘失败保留原值 · `director3d/App` `onThumbnail` 回传失败保留原值 · `providerStore` probe 失败保留 test-connection 原始信息 | 3 | **全合法，保留** |
| **LOCK_CHAIN** | `projectMemoryStore` promise 锁链 `next.catch(() => {})` / `finally` 注册，令链永不 reject | 2 | **全合法，保留** |
| **RECURSION_GUARD** | `main.reportGlobalError` 全局兜底自身异常 · `logger` 上报自身禁止调 logger（防递归） | 3 | **全合法，保留** |
| **MIGRATION** | `conversationState` 旧键活跃 id 迁 KV 超时兜底 | 1 | **合法，保留** |

> **判据（Step 3「先分清重复的种类」）**：本轮再印证 SOP——ALREADY_REPORTED 4 处里 **3 处是误标**（实为解析/读取兜底，应归 PARSE_FALLBACK / `tryParse`），仅 1 处（StepShots）真符合"他处已报告"。若只按标签"保留 ALREADY_REPORTED"，会把解析兜底永久固化成错误分类。

## 三、改动清单

1. **`agentCore.ts` · `parseAgentError`**：
   原 `try { const text = await res.text(); const parsed = JSON.parse(text); msg = … } catch { /* ALREADY_REPORTED */ }`
   → `const text = await res.text().catch(() => ''); const parsed = tryParse(() => JSON.parse(text)); if (parsed !== undefined) msg = …`。
   - **行为严格等价**：读失败（`res.text()` 抛）→ `text=''` → `JSON.parse('')` 抛 → `tryParse` 返 `undefined` → `msg` 保持默认 `${fallback} (status)`；解析失败同理回退默认。`tryParse` 是 `PARSE_FALLBACK` 唯一实现，消除该处手写豁免标记。
   - `res.text().catch(() => '')` 不被静默 catch 门禁命中（`''` 不在哨兵 `null|undefined|0|void 0` 内），无需额外标记。
2. **`httpClient.ts` · `readErrorBody`**：`catch-ok: ALREADY_REPORTED` → `catch-ok: PARSE_FALLBACK`（2 处）。`catch {}` 结构、回退分支、返回值**完全不变**，仅纠正分类（解析/读取失败兜底，非"他处已报告"）。

## 四、度量（改前 / 改后 · 实测 grep 口径）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| `ALREADY_REPORTED` 标记 | 4 | **1**（仅 StepShots 合法保留） |
| `PARSE_FALLBACK` 标记 | 1 | **3**（httpClient×2 手写 + agentCore 改调 tryParse 后该处标记消除） |
| 全库 `catch-ok` 标记总数 | 51 | **50**（−1：agentCore 手写标记经 `tryParse` 消除） |
| 误标改判 | — | 3（2 → PARSE_FALLBACK 手写、1 → `tryParse` 原语） |
| 新增原语 | 0 | 0（复用既有 `tryParse`） |
| 行为变更 | — | **0**（parseAgentError 严格等价；readErrorBody 结构/行为不变） |

## 五、验证（Step 7）

- `npx tsc --noEmit` **exit 0**；
- `node scripts/check-silent-catch.mjs` → **✅ 0 违规**；
- 单测 **90 例全绿（EXIT 0，无未处理 rejection）**：`httpClient` 19 · `agentRuntime` 6 · `useAgentChat.hook` 65。

## 六、覆盖度表（增量：只列本轮变化行）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `src/components/agent/runtime/agentCore.ts` | L1 core | 回查 | 🟢 | 二十三轮 09-14 | `parseAgentError` 改调 `tryParse`（PARSE_FALLBACK 原语），行为等价；agentRuntime 6 + useAgentChat.hook 65 绿 | 非债（误标改判） |
| `src/components/base/api/httpClient.ts` | L1 core | 回查 | 🟢 | 二十三轮 09-14 | `readErrorBody` 误标 ALREADY_REPORTED → PARSE_FALLBACK，结构不变；httpClient 19 绿 | 非债（误标改判） |
| `src/hooks/useVideoPoster.ts` · `PlaybackSink.tsx` · `faceMosaic.ts` · `VideoThumbnail.tsx` | L1/L2 | 审计 | 🟢 | 二十三轮 09-14 | BROWSER_API 5/5 合法（浏览器 API 预期不可用），保留 | 非债（合法手写类） |
| `src/components/nodes/Director3DNode.tsx` · `director3d/App.tsx` · `providerStore.ts` · `projectMemoryStore.ts` · `main.tsx` · `logger.ts` · `conversationState.ts` · `StepShots.tsx` | L1/L2 | 审计 | 🟢 | 二十三轮 09-14 | KEEP_ORIGINAL 3 / LOCK_CHAIN 2 / RECURSION_GUARD 3 / MIGRATION 1 / ALREADY_REPORTED 1(StepShots) 全部合法手写豁免，保留 | 非债（合法手写类） |

**覆盖账**：本轮审/改 **2 个 src 文件 + 审计余下手写类 8 文件**；**行为变更 = 0**；未审 0。

## 七、结论与下一批

- **TD-02-26「成本层」第 6 批完成**：BROWSER_API 5/5 合法保留；ALREADY_REPORTED 4 → 1（3 误标收口：2 归 PARSE_FALLBACK 手写、1 归 `tryParse` 原语）；全库标记 51 → 50。
- **关键发现（修正早期乐观估计）**：剩余手写类（无原语可收口）经本批 + 二十二轮普查已基本确认全部合法——`READ_FALLBACK 3 / BROWSER_API 5 / KEEP_ORIGINAL 3 / LOCK_CHAIN 2 / RECURSION_GUARD 3 / MIGRATION 1 / ALREADY_REPORTED 1` 共 **18 处均为结构性必需手写豁免**。故二十二轮提出的"全库收敛到 ~11"不成立；**现实下限 ≈ 50（皆合法）**。成本层"可删"部分（原语兜底的 65 处：RELEASE_FAIL / PARSE_FALLBACK / NON_BLOCKING / CLIPBOARD 4 类）已全部收口完毕，剩余为合法手写豁免，**无更多可删项**。
- **观察（非本轮范围，留待裁定）**：`VideoThumbnail.tsx:77/88` 用 `try { v?.play?.() } catch {}` 同步 try 包裹 `play()` 返回的**被拒 Promise**——sync try/catch 抓不到异步 rejection，会漏成 unhandled rejection，与 `catch-ok: BROWSER_API` 标注的"吞 autoplay 拒绝"意图不符（机制瑕疵）。该修法涉行为（改 `v?.play?.()?.catch?.(() => {})`），不在"分类收口"范围内，建议单独立项、由用户拍板。
- **观察（非本轮）**：`package.json` 重复键 `check:gates`（34/40 行重名，后者覆盖前者）致 `vitest` 启动告警，留待工具链治理批（@见 17 区）。
- **结论**：成本层收口已达真实终点（无可删手写豁免），建议转"收尾确认"或就 VideoThumbnail 机制瑕疵单独修。
