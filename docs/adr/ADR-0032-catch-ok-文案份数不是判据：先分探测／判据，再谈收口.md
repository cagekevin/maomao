# ADR-0032 · catch-ok 文案份数不是判据：先分探测／判据，再谈收口

- **状态**：生效
- **结论**：同一 catch-ok 文案在多处逐字重复，本身不构成「未收口」违规——先按 ADR-0031 分探测／判据：判据重复禁合并。另：注入到页面主世界执行的函数体物理上引用不到模块内原语，属不可收口站点。
- **日期**：2026-09-18
- **裁定人**：架构师（取证后自定）
- **触发**：TD-18-14：18 区横推把 9 处 catch-ok: BROWSER_API 登记为「逐字重复未收口」

## 背景

ADR-0011 现行判据 3：**同一 catch-ok 文案在 ≥3 处逐字重复、未收口为原语 → 违规。**

它把**判据的载体**认成了**文案**：只要 CODE 一样，就推定"语义一样"。TD-18-14 正是这条推定的产物——
18 区横推 grep 出 9 处 `catch-ok: BROWSER_API`，按"份数 ≥3"登记为「逐字重复未收口」。而**同日更早**
用户已裁定 ADR-0031：判据重复**禁合并** ⇒ 两条判据在同一链路上**指向相反动作**，且 ADR-0011 的措辞
会让后人**继续**按份数登记假债（与 ADR-0031 §后果里"顺着上一轮待办把它当债补"是同一条回潮路径）。

## 判据（凭什么成立 / 为什么不成立）

**"份数"不成立** —— 9 处逐处实读（非推断）：

| 站点 | 被 catch 的代码 | 判据 | 降级值 |
| --- | --- | --- | --- |
| `storageAdapter.ts:48 isChromeExtension` | 访问 `chrome.*` | **环境探测原语本体**（"能力在不在"） | `false` |
| `storageAdapter.ts:67 hasLocalStorage` | 访问 `localStorage` | 同上（探测原语本体） | `false` |
| `storageQuota.ts:155` | 遍历存储 | **读取受限 → 降级为"不可用"**（UI 已呈现） | `null` |
| `accountsStore.ts:293 fetchActiveTab` | `chrome.tabs.query` | **扩展 API 边界调用失败 → 拿不到** | `null` |
| `accountsStore.ts:418` | 主世界读 `localStorage` | 同上（且**跨上下文**，见下） | `null` |
| `accountsStore.ts:437` | `chrome.scripting.executeScript` | 同上 | `null` |
| `VideoThumbnail.tsx:80/91` | `video.play()/pause()` | **策略性拒绝**（autoplay 政策） | 无（调用方 `setPlaying` 呈现） |
| `useCanvasShortcuts.ts:65` | `window.getSelection()` | **探测语义**（"有没有选区"） | `false` |

**结论：9 处 = 文案 1 份，判据 ≥5 种。** 按 ADR-0031 二分：

- **探测语义**（`isChromeExtension` / `hasLocalStorage` / `getSelection`）：失败与"能力不在／没有"对调用方是
  **同一个答案** ⇒ 本身即探测原语，再包一层 = **假抽象**（Step 3「只有 1 种实现的接缝」）；且**不留痕**——
  刷日志只会淹没正常路径（判据见 `core/degrade.ts` 头注）。
- **判据各异**（`storageQuota` 的"读取受限降级"、`VideoThumbnail` 的"策略性拒绝"）：合并 = 削掉各层能力 ⇒ **保留分层**。
- **真重复**（`VideoThumbnail` 同文件同判据、`accountsStore` 的三处扩展 API 边界）：**收口**。

**另一条新判据（物理约束，不是偏好）**：`accountsStore` 主世界读 `localStorage` 的 `func` 是
`chrome.scripting.executeScript({ func })` 的**注入函数体** —— 序列化后跑在**页面主世界**，
**物理上引用不到模块内的 `chromeApiOrNull`**（闭包不随函数体过界）。这是**不可收口站点**，不是"漏收的一处"。
同类形态：`page.evaluate` / worker `postMessage` 注入体。

## 决议

1. **ADR-0011 判据 3 加前置条件**（其正文冻结，不改写 —— 只可改头部状态行）：引用它之前**必须先过 ADR-0031
   的探测／判据二分**；「文案逐字重复」**不是**判据，**同一「吞」语义**（探测重复）在 ≥3 处手写才是。
2. **收口落点（已落）**：`base/ui/VideoThumbnail.tsx` → `quietMediaControl(ref, act)`（2 → 1 份判据）；
   `base/store/accountsStore.ts` → `chromeApiOrNull(what, act)`（3 → 1 份判据 + **补留痕**，并修掉
   `readTabLocalStorage` 里 `chrome.tabs.query` **裸调**这处半态：其 JSDoc 明写"读取失败返回 null，不阻断
   保存/切换"，裸调却让异常直穿成「切换环境失败」）；注入函数体**保持独立**并就地注明"不可收口"的理由。
3. **判非债落点（已补就地指针）**：`storageAdapter.ts` ×2 · `storageQuota.ts` · `useCanvasShortcuts.ts`
   各补一行"有意不收口／不留痕 + 为什么"，防后人再当 bug 补（A7 防回潮）。
4. **登记侧**：TD-18-14 结清（真重复已收口 + 留痕已补），其中 5 处判非债在轮次文件逐处留证。

## 后果

- ✅ 收益：切断"按文案份数登记假债"这条回潮路径（它已实际产出 TD-18-14 一笔假债 + 一次错误方向）；真重复
  （2 族共 5 处）收口为 2 份实现；补上扩展 API 边界的**留痕**（此前用户侧"环境少存了一部分"零解释）。
- ⚠️ 代价 / 回潮风险：**"同一 CODE 多处出现"在这一族不再等于"该收口"** ⇒ 后人若拿它当判据会误判。
  另：`quietMediaControl` 是**有意不留痕**的站点 —— 若将来把"浏览器 API 失败一律留痕"当铁律照搬，
  会把 autoplay 常态刷成噪音。
- 📌 违反时的判据（怎么发现"又回去了"）：
  - **机器**：无（本族不收口，按「建闸前置评审」不建闸）。
  - **人工**：① 账本里再出现「N 处 `catch-ok: X` 逐字重复 ⇒ 未收口」这种**只数文案**的登记 ⇒ 违反；
    ② 为"份数一致"把探测语义（`isChromeExtension` / `hasLocalStorage` / `getSelection`）包进新原语 ⇒ 违反；
    ③ 在注入函数体（`executeScript({func})` / `page.evaluate`）里调用模块内原语 ⇒ 编译/运行必炸，物理不可能。

## Lessons Learned

- **判据不能挂在"文案"上**：文案是**表征**，判据是**语义**。用 CODE 相等替代语义相等，会一边禁止"复制标记"、
  一边**批量生产**"这处该收口"的假债 —— 正是它自己要禁的形态的镜像。
- **两条同日生效的 ADR 可以互相矛盾而不自知**：冲突只在**具体一笔债**上才显形。⇒ 立判据时要问"它与现行判据
  在同一条链路上会不会打架"。
- **"不可收口"要写下来**：跨上下文序列化是**物理约束**，与"懒"只差一句注释；不写明，下一轮还会登记它。
