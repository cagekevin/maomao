# 架构日志 · 存储 / 持久化 · 2026-09-14（十八轮 · 施工轮）

> **文件名**：`02-存储-持久化-十八轮-静默豁免成本层-RELEASE_FAIL收口-2026-09-14.md`（同区多次审计各写新日期文件、不覆盖旧档）。
> **本轮性质**：**施工轮**（用户授权「开第 1 批：RELEASE_FAIL 16 处 → `releaseQuietly` 原语 + 测试 + 度量」）。
> **依据**：`架构师改码7步法.md`（Step 0→7）+ `架构师心法.md §零.4`（闸的成本守恒）+ `债务登记5步法.md` 17 区四轮日志 §八。
> **与 TD-02-26 的关系**：TD-02-26 的偿还计划有**两半** —— ① **闸层**（自由文本 → `catchOk.ts` 登记表 + 双向校验）已由 commit `7b957c97` 落地；② **成本层**（"允许吞"手写 92 遍未收口）**本轮才动第一批**。

---

## 一、Step 0 普查（先查仓库里已有什么）

| 问题 | 取证结论 |
| --- | --- |
| 已有"释放原语"吗？ | **无**。`base/utils/asyncGuard.ts` 只有 `withTimeout` / `isTimeoutError` / `loadImageWithTimeout` / `loadImageOrNull`（全是"加载/超时"族，无一处理"释放失败") |
| 原语该住哪？ | **`base/utils/asyncGuard.ts`**（= 边界守卫原语集合）。判据：① 同族语义；② **`base/core/**` 引本文件已有先例**（`contentStore.ts` 引其 `withTimeout`）→ 不会造成层位倒置；③ 16 处站点中 **4 处已 import 本文件**（`DepthVideoModal` / `ImageEditor` / `VideoProcessNode` / `scriptBoxEngine`）→ 零新增 import 面最优 |

## 二、Step 1–3：16 处的真实形态（判据先行）

`catch-ok: RELEASE_FAIL` **16 处**逐处取证后分成**两类**：

| 类 | 处数 | 形态 | 处置 |
| --- | --- | --- | --- |
| **真"释放/停止/取消"** | **14**（13 同步 + 1 异步） | `close?.()`×3（ImageBitmap）· `video.load()`×3（释源）· `ac.abort()`×2 · `controller.cancel()`×3 · `recorder.stop()` · `ro.observe()` · `output.cancel()`（**唯一异步**，`await …catch(()=>{})` 形态） | **收口进原语** |
| **媒体控制被浏览器拒绝** | 2（`VideoThumbnail.tsx` 的 `play()` / `pause()`） | 注释原文即"绕开 autoplay 政策" → 属 **`BROWSER_API`**（"浏览器 API 预期不可用"），**不是**"释放失败" | **改判 `BROWSER_API`**（码改，代码留待 BROWSER_API 批） |

> **判据（Step 3「先分清重复的种类」）**：这 14 处是**探测/运算重复**（同一件"怎么安全释放"的事）→ **可收口**；那 2 处是**判据不同**（浏览器策略 vs 资源释放）→ **不合并、改判码**。

## 三、改动清单

1. **新增原语**（`base/utils/asyncGuard.ts`，唯一实现 + 自带理由 + 配测试）：
   - `releaseQuietly(act: () => unknown): void`
   - `releaseQuietlyAsync(act: () => Promise<unknown> | unknown): Promise<void>`
   - **为什么不合成一个**：`await` 与否会**改变调用点时序**（导出/卸载路径必须等释放完成）；用 `Promise.resolve(act())` 把同步调用裹进微任务同样变语义 → 两态各一函数、**各留 1 处豁免**（这是豁免面从 16 → 2 的全部来源）。
   - 同步 `asyncGuard.ts` 文件头【用法】+【归属说明】。
2. **14 处调用点收口**：`uiHooks` · `DepthVideoModal` · `ImageEditor`×3 · `captureFrame`×2 · `videoEngine` · `director3d/App` · `VideoProcessNode`×3 · `scriptBoxEngine`×2 → 全部改 `releaseQuietly(...)` / `releaseQuietlyAsync(...)`，**不再有任何豁免标记**。
3. **2 处改判**：`ui/VideoThumbnail.tsx` 的 `play()`/`pause()` → `catch-ok: BROWSER_API`（并注明改判理由）。
4. **登记表反向指认**：`core/catchOk.ts` 的 `RELEASE_FAIL` 注释写明「**唯一实现 = `asyncGuard.ts` 的 `releaseQuietly`/`releaseQuietlyAsync`**；**再出现手写 RELEASE_FAIL 豁免 = 回潮信号**」。
5. **测试**：`tests/unit/asyncGuard.test.ts` 新增 5 例（同步/异步 × 正常/抛错/reject + 异步形态容错）。

**施工中修掉的两处类型回归**（诚实留痕）：① `uiHooks` 闭包内 TS 不保留 `let ro` 的窄化 → `ro?.observe(el)`；② `director3d/App` 的 `let output` 因用法被挪进闭包而失去推断（TS7034/7005）→ **先落 `const out = output` 再闭包**（不使用 `!` 断言，遵铁律 2）。

## 四、度量（改前 / 改后）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| `RELEASE_FAIL` 豁免处数 | **16** | **2**（仅原语内部 2 处） |
| 全库 `catch-ok` 标记总数 | 92 | **80**（−14 收口 +2 原语内） |
| 该语义的手写 `try/catch` 块 | 14 | **0** |
| `BROWSER_API` | 3 | 5（+2 改判，待 BROWSER_API 批） |
| 新增公共原语 | 0 | **2**（同文件，非新文件） |
| import 面 | — | 4 处零改动（已 import）+ 4 处新增 1 行 |

## 五、验证（Step 7）

- `npx tsc --noEmit` **exit 0**；
- 相关单测 **7 文件 / 138 例全绿**（`asyncGuard` 17（含新增 5）· `captureFrame` 21 · `videoEngine` · `ImageEditor.outpaint` 13 · `scriptBoxEngine` 44 · `VideoProcessNode` 10 · `depthVideo`）；
- `node scripts/check-silent-catch.mjs` → **✅ 0 违规**；
- **探针（先红后绿 · `node scripts/probe.mjs`）**：

  | 次 | 注入 | 观测 | 结论 |
  | --- | --- | --- | --- |
  | 1（**探针写错**） | 把 `throw` 放进 **try 内**（`act(); throw …`） | `exit=0`（测试仍绿） | ❌ **未命中 —— 是我的探针错**：该抛错会被同一个 catch 吞掉，行为根本没变。**未跳过、未改断言**，回去重写探针 |
  | 2（修正后） | 从 **catch 体内重抛**（`// catch-ok: …` 那行换成 `throw new Error('PROBE-not-swallowed')`） | `exit=1`，输出命中 `asyncGuard.test.ts` | ✅ **命中** —— 证明新增测试**精确锁住"吞掉不外抛"**这一点 |

  跑完 `asyncGuard.ts` 已还原（sha `8757313b1449` 一致）、journal 清空。

## 六、覆盖度表（增量：只列本轮变化行）

| 文件 | 层 | 覆盖状态 | 灯 | 轮次/日期 | 证据 | 债/裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `base/utils/asyncGuard.ts`（@见 16 区） | L1 core/utils | 深审 | 🟢 | 十八轮 09-14 | 新增 2 原语；文件头扩定位；tsc/单测/闸/探针全绿 | 非债（本轮为**偿还动作**） |
| `base/core/catchOk.ts` | L1 core | 深审 | 🟢 | 十八轮 09-14 | `RELEASE_FAIL` 注释反向指认原语 | 非债 |
| `base/core/uiHooks.ts` · `base/depthVideo/DepthVideoModal.tsx` · `base/editors/ImageEditor.tsx` · `base/ui/VideoThumbnail.tsx` · `base/utils/captureFrame.ts` · `base/utils/videoEngine.ts` · `director3d/App.tsx` · `nodes/VideoProcessNode.tsx` · `scriptbox/scriptBoxEngine.ts` | L1–L3 | 回查 | 🟢 | 十八轮 09-14 | 14 处改调原语 / 2 处改判 BROWSER_API | 非债（行为不变，`type-check` + 相关单测实证） |
| `tests/unit/asyncGuard.test.ts` | 测试 | 深审 | 🟢 | 十八轮 09-14 | 新增 5 例 + 探针先红后绿 | 非债 |

**覆盖账**：本轮审/改 **12 个文件**（11 src + 1 test）；**行为变更 = 0**（豁免形态收口 + 1 处码改判）；未审 0（本批范围内）。

## 七、结论与下一批

- **TD-02-26「成本层」第 1 批完成**：`RELEASE_FAIL` 16 → 2，全库标记 92 → 80。
- **下一批（按同判据，各批独立授权）**：
  1. `PARSE_FALLBACK` 11 → `tryParse*`（返回 null / 判别联合）
  2. `NON_BLOCKING` 31 → **拆两类**：`accountsStore` 10 处（chrome 扩展 API 单项失败，同质 → `attemptEach`）；其余 21 处**逐处判**（预计多数该改 `reportDegrade` 留痕而非豁免）
  3. `CLIPBOARD` 8 / `READ_FALLBACK` 6 → 各 1 原语
  4. `BROWSER_API` 5（含本轮 2 处改判）/ `ALREADY_REPORTED` 4 / `KEEP_ORIGINAL` 3 → 逐处判
  → 目标：**80 → ~13**（只剩 `RECURSION_GUARD` 3 · `LOCK_CHAIN` 2 · `MIGRATION` 1 + 少数真结构性）
- **判定为真结构性、保留手写**：`RECURSION_GUARD`（logger 自身防递归）· `LOCK_CHAIN`（锁链防断）· `MIGRATION`（旧键一次性迁移）。
