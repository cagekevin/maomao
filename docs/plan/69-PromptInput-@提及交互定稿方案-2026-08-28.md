# 69 · PromptInput `@` 提及交互 —— 定稿方案

> **日期**：2026-08-28
> **状态**：方案已定稿，**未实施**（本轮只出方案，未改任何源码）；
> 2026-08-28 已完成**全量代码引用复核**——结论与架构成立，7 处缺口已补齐为 §十二，
> 其中 P2（`before` 取法）**待拍板后即可开工 M1/M2**。
> **前置底稿**：`docs/audit/PromptInput-@提及交互审计-2026-08-28.md`（问题证据链，本方案的问题编号沿用其 §三~§六）
> **决策归属**：按 `CLAUDE.md §决策记录铁律`，本方案横跨 ≥2 处（PromptInput / 新文件 / tailwind 令牌 / hooks / 4 个节点），
> **实施时必须把「层级令牌」与「提及判定单一入口」两条全库级结论同步进 `spec/CONTEXT.md` + `contracts.js`**，单文件局部机制同步进各文件头 JSDoc。
>
> **⚠️ 引用基准（2026-08-28 复核 · 实施前必读）**
> 本文引用的 `PromptInput.jsx` 行号基于 **70 号方案实施前**的版本，与当前工作区**系统性偏移 +10~+12 行**
> （例：本文写"弹层 `:532`"→ 实际 `:541`；"判定 `:333-335`"→ 实际 `:341-347`；`getCaretPos :296-307`→ 实际 `:298-327`）。
> **结论与符号全部有效，行号已失效**——实施时按 `getCaretPos` / `detectMention` / `renderRichMode` 等**符号名**定位，禁止按行号找。
> 已实测核对准确、可直接按行号引用的文件：`tailwind.config.js:21-39`、`hooks.js:39-48`、`App.jsx:1324`、
> `NodeShell.jsx:217-218`、`ExpandablePanel.jsx:30`、`FullscreenModal.jsx:75-78`、`ImageBoxNode.jsx:622-629`。
> 复核发现的 6 处缺口已补齐为 **§十二 开工前补丁**，**实施前必须先读**。

---

## 目录

0. [一句话结论与变更清单](#零一句话结论与变更清单)
1. [目标与非目标](#一目标与非目标)
2. [最终形态示意](#二最终形态示意)
3. [为什么现在会被挡住（层级根因）](#三为什么现在会被挡住层级根因)
4. [架构：三层解耦](#四架构三层解耦)
5. [详细设计](#五详细设计)
6. [z-index 统一方案（专章）](#六z-index-统一方案专章)
7. [视觉与动效规范（和谐）](#七视觉与动效规范和谐)
8. [实施计划 M1/M2/M3](#八实施计划-m1m2m3)
9. [可观测性与验收清单](#九可观测性与验收清单)
10. [风险与回滚](#十风险与回滚)
11. [决策记录 ADR](#十一决策记录-adr)
12. [开工前补丁（2026-08-28 复核）](#十二开工前补丁2026-08-28-复核) ← **实施前必读**

---

## 零、一句话结论与变更清单

**`@` 候选层从「节点内 absolute 向下弹」改为「portal 到 body 的 fixed 浮层、底对齐向上弹」，
触发判定抽成可单测的纯函数，生命周期补齐 5 条关闭路径，层级上**复用现有 `z-popover` 令牌（零新增）**。**

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/components/base/promptMention.js` | **新增** | 纯函数层：提及判定 + 定位计算（无 DOM，可单测） |
| `src/components/base/PromptInput.jsx` | **改** | 定位/portal/生命周期/IME/埋点；删除 textarea 死分支 |
| `src/components/base/hooks.js` | **改** | `useOutsideClick` 支持 ref 数组（弹层 portal 后不在 wrap 内） |
| `tailwind.config.js` | **改** | 仅删 `suggest(999999)` 一行；**零新增令牌**，候选层复用 `popover(1000)` |
| `src/components/base/FullscreenEditor.jsx` | **改** | 传 `portalTarget={null}`（弹窗内保持内联） |
| `src/index.css` | **改** | 芯片行高对齐文本行高（可选，见 §5.6） |
| `tests/unit/promptMention.test.js` | **新增** | 判定与定位的表驱动单测 |
| `tests/unit/PromptInput.test.jsx` | **新增** | 组件级：弹出/IME/抑制/关闭 |
| `src/components/base/promptChips.js` | **改（P1 新增）** | `autoLinkAssetsByName` 改为复用 `isMentionBoundary`，消除与 70 的边界规则分叉（见 §十二-P1） |
| `src/components/nodes/ImageBoxNode.jsx` | **改（P5 提前）** | `:627` `z-overlay-error` → `z-popover`，原 M3-4 提前到 M1-7 |
| `spec/CONTEXT.md` + `contracts.js` | **改** | 登记层级令牌 + **两条** @ 提及入口（边界判定 / 批量转换 / 触发判定分工，见 §十二-P1） |
| `docs/agent 批量任务/TASK-034`、`TASK-035` | **改（P6 新增）** | 删 `suggest` 令牌后同步修订其「`z-suggest` 合规非偏离」结论 |

**不改动**：`promptChips.js` 的序列化协议（`@{id:label|thumb}` 保持不变，存量数据零迁移）、
`autoLinkAssetsByName` 的**全等匹配语义**（P1 只统一边界判定，不改匹配规则）、
`MaterialStrip`、节点的 `PromptInput` 调用签名（全部向后兼容，新增参数均可选）。

---

## 一、目标与非目标

### 1.1 目标（用户原始诉求 → 可验收指标）

| # | 目标 | 可观测指标 |
|---|---|---|
| G1 | **底对齐**：弹层在 `@` 行上方，底边与 `@` 行顶边贴合，**不遮挡任何已输入文本** | 弹层底边与 `@` 字符顶边间距 = `4px ± 1px`；`placement=up` 时弹层矩形与 `@` 行矩形**无交集** |
| G2 | **稳定显示**：该弹的时候弹、位置不漂 | 编辑器内滚动 / 窗口 resize 后位置漂移 ≤ 1px；连续输入中文不闪烁（切换次数 = 0） |
| G3 | **不误显示**：只在真的要 `@` 时弹 | 误触发场景（§9.2 表）全部为 0；IME 组字中弹层出现次数 = 0 |
| G4 | **很快消失**：任何"不要了"的动作都立刻关 | 关闭路径覆盖 §5.4 全表；Esc 后同一 `@` 不再重弹 |
| G5 | **不被别人挡住** | 对弹层中心做 `elementFromPoint` 命中测试，命中元素必须在弹层内（§9.3） |

### 1.2 非目标（本次不做，避免范围膨胀）

- 不改 `@{id:label}` 序列化协议、不做存量数据迁移。
- 不引入富文本编辑器库（继续手写 contentEditable）。
- 不改造 `MaterialStrip`、不改素材来源与去重逻辑。
- **形态 V2（分组 + 底部搜索条，对齐用户截图）** 列为 M3 可选项，需用户一句话确认后再做（见 §8.M3）。

---

## 二、最终形态示意

```
      ┌────────────────────────────┐   ← fixed，portal 到 document.body，z-popover(1000)
      │ 🖼 人物参考                 │      底边 = @ 行顶边 - 4px（向上展开，不遮挡正文）
      │ 🖼 场景背景                 │
      │ @  分镜脚本                 │      宽 280 / 最大高 300 / 超出内部滚动
      └──────────────▲─────────────┘
                     │ 4px
  ┌──────────────────────────────────────┐
  │ 一个赛博朋克的猫 @人物参考 走在街上…   │   ← contentEditable
  └──────────────────────────────────────┘
                  ▲
                  └─ @ 字符矩形（anchor）

上方空间不足（< 160px）时自动翻转：placement='down'，顶边 = @ 行底边 + 4px。
```

与现状对比：

| 维度 | 现状 | 定稿 |
|---|---|---|
| 方向 | 向下弹（`:313` `top = rect.top - wrapRect.top + lh`） | **向上弹**（底对齐） |
| 挂载 | 节点内 `absolute`（`:532`） | **portal 到 body + `fixed`** |
| 坐标系 | 相对 wrap，受画布 transform 缩放 | **视口坐标**，缩放不影响字号 |
| 跟随 | 打开时算一次（`:340`），之后不动 | rAF 节流重算（scroll/resize） |
| 翻转 | 无 | 有（空间不足向下） |

---

## 三、为什么现在会被挡住（层级根因）

> 结论：**`z-suggest: 999999` 是无效的**——它被封在节点的层叠上下文里，数字再大也只在节点内部生效。

证据链（自外向内）：

| 层级 | 元素 | 为什么是层叠上下文 | 证据 |
|---|---|---|---|
| ① | `.react-flow__node`（ReactFlow wrapper） | `z-index: internals.z` + `transform: translate(...)` | `node_modules/@xyflow/react/dist/esm/index.js:2349-2352` |
| ② | NodeShell 根 div | `relative` + `z-10/z-50` + **`contain: layout style`** | `src/components/base/NodeShell.jsx:213-217` |
| ③ | ExpandablePanel | `absolute` + `z-40` | `src/components/base/ExpandablePanel.jsx:30` |
| ④ | `@` 弹层 | `absolute` + `z-suggest(999999)` | `PromptInput.jsx:532` |

**因此**：

1. ④ 的 999999 只能在 ③ 内部比较，**无法跨节点**。
2. 节点与节点之间只比 ① 的 `internals.z`；而 `App.jsx:1324` 设了 **`elevateNodesOnSelect={false}`**，即选中也不抬升 → **所有节点 z 值相同，DOM 顺序靠后者必然盖住靠前者**。
3. NodeShell 根有 `contain: layout style`（`NodeShell.jsx:216`）→ 它同时是**后代 fixed/absolute 的包含块**。即使把弹层改成 `fixed` 但不 portal，它仍会被锁在节点盒子里（位置错乱），**所以"portal 到 body"是唯一解，不是可选优化**。
4. 选中节点还有 `.react-flow__node.selected { filter: drop-shadow(...) }`（`index.css:213-217`），`filter` 同样会创建包含块 → 进一步印证 ③。
5. 全屏弹窗场景：`FullscreenModal` 是 `createPortal` + `z-ceiling-2(2147483646)`（`FullscreenModal.jsx:75-78`），弹层若 portal 到 body 且 z 低于它 → **会被自己的弹窗盖住**。这是 §6 里 dual-mode 设计的由来。

---

## 四、架构：三层解耦

```
┌─────────────────────────────────────────────────────────┐
│ ③ 展示层  PromptInput.jsx（DOM / 事件 / portal / 埋点）    │
├─────────────────────────────────────────────────────────┤
│ ② 决策层  promptMention.js（纯函数 · 无 DOM · 可单测）     │
│           detectMentionQuery()  computeMentionPlacement() │
├─────────────────────────────────────────────────────────┤
│ ① 数据层  promptChips.js（芯片序列化，协议不变）            │
└─────────────────────────────────────────────────────────┘
```

**关键收益**：把"该不该弹 / 弹在哪"从 React 组件里抽成纯函数 → 这两个最易出 bug 的部分变成**表驱动单测可覆盖**的确定性逻辑，这是"可观测"的工程基础（§9）。

---

## 五、详细设计

### 5.1 新增 `src/components/base/promptMention.js`（纯函数）

**解决问题**：3.1 `@` 前无边界、3.2 标点不截断、3.3 无长度上限。

```js
/** @提及触发判定（纯函数，唯一入口，禁止在组件里另写 lastIndexOf('@')） */

export const MENTION_MAX_QUERY = 20       // 超过即判为「不是在 @ 人」，自动关闭
export const MENTION_PANEL_W = 280
export const MENTION_PANEL_MAX_H = 300
export const MENTION_FLIP_MIN_H = 160     // 上方空间不足此值 → 翻转到下方

/** query 内出现即终止（含全角空格/常见中文标点） */
const BREAK = new Set([' ', '\n', '\t', '\u3000', ',', '.', ';', '!', '?',
  '，', '。', '；', '、', '！', '？', '：', '{', '}', '(', ')', '（', '）'])

/**
 * `@` 边界判定（唯一入口）：@ 前一个字符必须落在允许集内才认为是「真的要 @ 」。
 * 允许集 = 行首 / 空白 / 开括号 / 冒号 / ZWSP / 芯片尾 `}`。
 *
 * ⚠️ 必须与 docs/70 的 `autoLinkAssetsByName` **共用同一套边界规则**（见 §十二-P1）：
 *   该函数的上下文是序列化字符串，芯片形如 `@{id:label}`，紧贴其后输入 `@名字` 时 `@` 前是 `}`，
 *   故 `}` 必须在允许集内——否则「芯片后打 @」这条路径在两侧会得出相反结论。
 * @param {string} prev @ 的前一个字符；@ 位于串首时传 ''
 */
const ALLOW_PREV = new Set(['', ' ', '\n', '\t', '\u3000', '\u200B', '(', '（', '[', '：', ':', '}'])
export function isMentionBoundary(prev) {
  return ALLOW_PREV.has(prev ?? '')
}

/**
 * @param {string} before 光标之前的**纯文本片段**（真实语义见下方 ⚠️，不是「整行文本」）
 * @returns {{active:boolean, query:string, atIndex:number}}
 */
export function detectMentionQuery(before) {
  const at = String(before || '').lastIndexOf('@')
  if (at < 0) return { active: false, query: '', atIndex: -1 }
  if (!isMentionBoundary(at === 0 ? '' : before[at - 1])) return { active: false, query: '', atIndex: -1 }
  const query = before.slice(at + 1)
  if (query.length > MENTION_MAX_QUERY) return { active: false, query: '', atIndex: -1 }
  for (const ch of query) if (BREAK.has(ch)) return { active: false, query: '', atIndex: -1 }
  return { active: true, query, atIndex: at }
}
```

> **为什么 `@` 前后都要判**：现状只判"后面没有空格"（`PromptInput.jsx` 的 `detectMention` 内 `inMention` 三条件），
> 所以 `邮箱@xx`、`abc@`、URL 里的 `@` 全都会弹——这是"误显示"的最大来源。

> **⚠️ `before` 的真实语义（2026-08-28 复核修正 · 见 §十二-P2）**
> 初稿写「芯片已归一为占位」**不成立**：芯片在 DOM 里是 `[data-ref-id]` 元素，`ensureCaretSlotBeforeChip`
> 只在芯片**前**插 ZWSP 文本节点，芯片**后**没有占位。因此 `before` 只能取到
> **「当前 textNode 内、光标之前」** 的内容（现状 `detectMention` 即 `node.textContent.slice(0, cursorPos)`）。
> 这带来两个必须处理的后果：
> 1. §9.2 用例「芯片占位 `\u200B@` → 弹」在真实 DOM 下**几乎不会出现**，若照抄会写成测不到的假覆盖；
> 2. `@` 与光标分属不同 textNode 时会漏判。
> **定稿取法（二选一，实施时择一并在文件头 JSDoc 写明）**：
> - **A（推荐）**：从 editor 根做一次轻量文本化，芯片 → 单字符占位（复用 `ZWSP`），得到「整段纯文本 + 光标偏移」，
>   再把 `before` 传进来。跨 textNode 也正确，且让 `\u200B@` 用例真正生效。
> - **B（最小改动）**：维持现状只取当前 textNode，接受「跨节点漏判」，并从 §9.2 删掉 `\u200B@` 这条用例。

### 5.2 定位：`computeMentionPlacement`（纯函数）

**解决问题**：P0 方向反了、P1 不翻转、P1 无左右 clamp。

```js
/**
 * 底对齐定位：默认向上展开，弹层底边 = 光标行顶边 - gap（绝不遮挡已输入文本）。
 * 输入/输出均为**视口坐标**（配合 position: fixed 使用）。
 */
export function computeMentionPlacement(anchor, opts = {}) {
  const { panelW = MENTION_PANEL_W, panelMaxH = MENTION_PANEL_MAX_H,
          flipMinH = MENTION_FLIP_MIN_H, gap = 4, margin = 8 } = opts
  const vw = opts.viewportW ?? window.innerWidth
  const vh = opts.viewportH ?? window.innerHeight
  const spaceAbove = anchor.top - margin
  const spaceBelow = vh - anchor.bottom - margin
  const placement = (spaceAbove >= flipMinH || spaceAbove >= spaceBelow) ? 'up' : 'down'
  const room = placement === 'up' ? spaceAbove : spaceBelow
  const height = Math.max(96, Math.min(panelMaxH, room))
  const left = Math.min(Math.max(margin, anchor.left), Math.max(margin, vw - panelW - margin))
  return placement === 'up'
    ? { placement, left, top: undefined, bottom: vh - anchor.top + gap, height }
    : { placement, left, top: anchor.bottom + gap, bottom: undefined, height }
}
```

**anchor 取法**（修正现状 `:296-307` 的两处不准）：

- 用 `@` 字符的 `Range` 矩形，而不是光标矩形（现状：找不到 `@` 时 fallback 到光标 `:307` → 位置跳变）。
- **不再 `+ lineHeight` 推算行底**（现状 `:309-313`）：芯片是 `inline-flex` 实际高 ~26px（`index.css:649-667`），而文本行高 14×1.625≈22.75px（`PromptInput.jsx:512`），固定 `lh` 在含芯片行必然偏 3~4px。改为直接取 `@` 字符矩形 → 天然正确。

### 5.3 Portal + `fixed` 渲染

**解决问题**：G5 被相邻节点遮挡、画布缩放导致弹层一起缩放、`contain: layout` 锁死 fixed。

```jsx
{showMention && createPortal(
  <div
    ref={popRef}
    data-mention-portal                       // ← 可观测契约：E2E / 命中测试锚点
    data-mention-placement={pos.placement}    // ← 'up' | 'down'
    data-mention-count={filtered.length}
    className="fixed z-popover flex flex-col overflow-hidden rounded-lg border border-edge bg-surface-1 shadow-2xl nodrag nowheel nopan"
    style={{ left: pos.left, top: pos.top, bottom: pos.bottom,
             width: MENTION_PANEL_W, height: pos.height }}
    onMouseDown={(e) => e.preventDefault()}   // 保住编辑器焦点，避免 blur → 自杀式关闭
  >
    {/* 列表 / 空态 1 行提示 */}
  </div>,
  portalTarget || document.body
)}
```

配套要点：

- **`portalTarget` prop（新增，可选）**：默认 `document.body`；`FullscreenEditor` 传 `null` → 走内联 `absolute` 分支（弹窗内本就是最高上下文，且弹窗不滚动）。**这解决 §3.5 的"被自己的全屏弹窗盖住"**。
- **内联分支的坐标系**：`bottom = wrapRect.bottom - anchor.top + gap`，其余逻辑与 fixed 完全一致（共用 `computeMentionPlacement` 的翻转决策）。
- **`onMouseDown preventDefault`（新加）**：现状点候选项会先 blur（`:519` 只 emitDOM，但浏览器原生会把焦点移走），导致"点击选中"偶发失效。
- **既有先例**：`ImageBoxNode.jsx:622-666` 已是 `createPortal(..., document.body)` + `fixed`，本方案沿用同一范式，不引入新概念。

### 5.4 生命周期：关闭路径补全

**解决问题**：4.1 失焦不关、4.2 光标移动不重判、4.3 Esc 后重弹、4.4 无匹配不关、4.5 关闭按钮竞态。

| 触发 | 现状 | 定稿 |
|---|---|---|
| 选中候选 | 有（`:394`） | 保留 |
| Esc | 有（`:444-448`） | 保留 + **本轮抑制**（`dismissedRef`） |
| 点击外部 | 有（`hooks.js:39-48`） | 保留 + **portal 后需把 `popRef` 纳入判定** |
| 输入空格/换行/`{` | 有（`:342-344`） | 保留（判定交给纯函数） |
| **失焦 blur** | ❌（`:519` 只 emitDOM） | ✅ **新增** |
| **光标移动（方向键/Home/End/点击）** | ❌ | ✅ **新增**：`selectionchange` + rAF 合并 |
| **无匹配** | ❌（停在"暂无素材"） | ✅ 收成 1 行提示（高 ~40px），`filtered.length===0 && all.length>0` 保留；`all.length===0` **根本不弹** |
| **画布平移/缩放/节点拖动** | ❌ | ✅ **新增**：直接关闭（移动即关，符合 G4"很快消失"） |
| **画布 resize / 编辑器内滚动** | ❌ | ✅ **新增**：rAF 重算位置（不关闭） |
| **关闭按钮 X** | 有但无 mousedown 防护（`renderRichMode` 弹层头部） | **移除头部 X**（见 §7），Esc/点外部足够 |

> **⚠️ 两条关闭路径的实现方式（初稿只写了"✅ 新增"，2026-08-28 补齐 · 见 §十二-P4）**
>
> **① 画布平移 / 缩放 / 节点拖动 → 关闭（`viewport`）**
> `PromptInput` 在节点内部，自身无法感知 ReactFlow transform。定稿用 **`useStore` 订阅**，不新发明机制：
> ```js
> import { useStore } from '@xyflow/react'
> const transform = useStore((s) => s.transform)          // [x, y, zoom]
> React.useEffect(() => { closeMention('viewport') }, [transform?.[0], transform?.[1], transform?.[2]])
> ```
> 只依赖三个标量、不依赖数组引用，避免每次渲染误关。**节点拖动**不改变 transform（改 node.position），
> 但它必然先触发 `blur` 或 `selectionchange`，由 `blur` 路径兜底即可，**不额外监听**。
>
> **② 编辑器内滚动 / 窗口 resize → 不关闭，rAF 重算（`—`）**
> ```js
> const rafRef = useRef(0)
> const scheduleRecalc = useCallback(() => {
>   cancelAnimationFrame(rafRef.current)
>   rafRef.current = requestAnimationFrame(() => setMentionPos(getCaretPos()))
> }, [getCaretPos])
> useEffect(() => {
>   if (!showMention) return
>   const ed = editorRef.current
>   ed?.addEventListener('scroll', scheduleRecalc, { passive: true })
>   window.addEventListener('resize', scheduleRecalc)
>   return () => {
>     cancelAnimationFrame(rafRef.current)
>     ed?.removeEventListener('scroll', scheduleRecalc)
>     window.removeEventListener('resize', scheduleRecalc)
>   }
> }, [showMention, scheduleRecalc])
> ```
> 监听**只在 `showMention` 为真时挂载**，关闭即卸载，杜绝常驻监听。

**"本轮抑制"（Esc 语义）实现**：`dismissedRef.current = 触发这次弹层的 @ 字符在文本中的绝对下标`；`detectMention` 每次先比对该下标，相同则不再弹；当该位置的 `@` 被删除、或出现新的 `@` 时清除。→ Esc 不再是"白按"。

**统一关闭出口（埋点）**：

```js
const closeMention = useCallback((reason) => {
  if (!showMention) return
  setShowMention(false)
  logger.debug('PromptInput', 'mention-close', { reason }, { module: 'prompt' })
}, [showMention])
// reason: 'select' | 'esc' | 'blur' | 'outside' | 'no-match' | 'no-assets' | 'overflow' | 'ime' | 'viewport' | 'unmount'
```

`logger.debug` 第 4 参 `{ module: 'prompt' }` 用法与 `logger.js:103-111` 一致（默认静默，需时开模块位）。**这让"为什么弹/为什么关"在控制台可逐条追溯**——这是"可观测"的核心手段之一。

### 5.5 IME 抑制

**解决问题**：3.4 中文输入时按拼音字母反复过滤 → 闪烁 + 长期"暂无匹配"。

```jsx
const composingRef = useRef(false)
// ...
onCompositionStart={() => { composingRef.current = true; closeMention('ime') }}
onCompositionEnd={() => { composingRef.current = false }}
onInput={(e) => {
  emitDOM()
  if (composingRef.current || e.nativeEvent.isComposing) return   // 组字中不判定
  scheduleDetect()                                                // rAF 合并
}}
```

与项目既有 IME 范式（`utils.js:114-125`、`AgentPanel.jsx:821`、`PromptHub.jsx:285-289`）保持一致。

### 5.6 芯片行高对齐（可选，P2）

现状芯片 `inline-flex` + `padding:2px 6px` + `border:1px` + icon 22px → 实高 ~28px，文本行高 22.75px，导致**含芯片行整体被撑高**，视觉上"行距忽大忽小"。
可选修法：`index.css` 的 `.prompt-chip` 加 `height: 22px; padding-top:0; padding-bottom:0;` 并把 icon 收到 18px。属视觉打磨，不阻塞 M1/M2。

### 5.7 清理：删除 textarea 死分支

- `renderTextareaMode` 及其弹层、`useOutsideClick(textareaWrapRef…)` **全部删除**——
  已实测：全项目 5 个 `<PromptInput>` 调用点**全部传 `richText`**
  （`PromptNode.jsx:403`、`TextNode.jsx:351`、`TemplateNode.jsx:311`、`DiscountVideoNode.jsx:322`、`FullscreenEditor.jsx:70`），
  该分支**永远不可达**。
- 同步修正**已过期的文件头注释**（仍写"仅 PromptNode 传 richText，其余保持 textarea"）与 `richText = false` 默认值。

> **⚠️ 别误删 `FullscreenEditor` 自己的 textarea（2026-08-28 复核）**
> `FullscreenEditor.jsx` 存在一个**同名但不同物**的 `richText` prop（默认 `false`）：
> 为 `false` 时它渲染**自己的 `<textarea>`**（`FullscreenEditor.jsx:81-90`），根本不经过 `PromptInput`。
> 该分支**不是死代码**（`variant='text'` 及未升级的节点仍走它），**禁止顺手删**。
> 因此 §5.3 的 `portalTarget={null}` 只对「4 个节点 → FullscreenEditor(richText) → PromptInput」这条链路生效。

---

## 六、z-index 统一方案（专章）

> **本章已按「零新增令牌」重写。** 初稿曾新增 `mention: 10002` / `portal-menu: 10003`，
> 违反 `tailwind.config.js:18-19` 明写的规范「**新增浮层时优先复用现有令牌，不要直接写数字**」，已废弃。

### 6.0 先厘清：`99999` 不是本方案引入的

| 令牌 | 值 | 归属 | 用途与证据 |
|---|---|---|---|
| `overlay-error` | **99999** | **项目已有**（`tailwind.config.js:33`） | 根级崩溃全屏（`ErrorBoundary.jsx:62`）。**与本方案无关，不动它** |
| `suggest` | 999999 | 项目已有（`tailwind.config.js:35`） | 仅 PromptInput 使用，且已被 §3 证明无效 → **本方案删除** |

> 顺带说明：本项目 z-index 规范的出处有两处 —— `tailwind.config.js:15-20`（令牌排序与「优先复用、禁止裸数字」）
> 与 `NodeShell.jsx:103` 的节点编写规范（「禁止裸 z-index `z-[9999]`」）。本方案严格遵循前者。

### 6.1 现状令牌体检

`tailwind.config.js:21-39`：

```
base 0 < node-inner 10/20 < dropdown 50 < float 100 < topnav 200
     < canvas-tools 700 < sidebar 800 < popover 1000 < modal 9999
     < modal-raise 10000 < modal-action 10001 < overlay-error 99999
     < suggest 999999 < ceiling-1 2147483645 < ceiling-2 2147483646 < ceiling 2147483647
```

| # | 问题 | 证据 | 定性 |
|---|---|---|---|
| 1 | `suggest: 999999` 高于 `overlay-error(99999)` → 数值军备竞赛 | `tailwind.config.js:35` vs `:33` | 不和谐，**删除** |
| 2 | `suggest` 全项目仅 2 处使用，其一在死代码里 | `PromptInput.jsx:119`、`:532` | 可安全删除 |
| 3 | `ImageBoxNode` 缩略图菜单误用 `overlay-error`（错误全屏）当浮层菜单 | `ImageBoxNode.jsx:627` | 语义错配，顺手收敛 |
| 4 | `ModelSelect` 用裸 `z-50` | `ModelSelect.jsx:69` | 违反规范，顺手收敛 |
| 5 | `AgentPanel` 用裸 `z-[60]` 盖 `ModelSelect` | `AgentPanel.jsx:1092-1102` | 违反规范（有注释说明理由，M3 可选收敛） |

### 6.2 定稿：**复用 `z-popover(1000)`，零新增令牌**

```js
// tailwind.config.js —— 唯一改动：删一行
zIndex: {
  base: '0', 'node-inner': '10', 'node-inner-2': '20',
  dropdown: '50', float: '100', topnav: '200',
  'canvas-tools': '700', sidebar: '800', popover: '1000',   // ← @ 候选层复用它
  modal: '9999', 'modal-raise': '10000', 'modal-action': '10001',
  'overlay-error': '99999',
  // suggest: '999999'  ← 删除（仅 PromptInput 用，且无效）
  'ceiling-1': '2147483645', 'ceiling-2': '2147483646', ceiling: '2147483647',
}
```

**为什么 `popover(1000)` 恰好够用**（portal 到 body 后，竞争者只剩 body 层元素）：

| body 层元素 | 值 | 与 1000 的关系 | 是否符合预期 |
|---|---|---|---|
| ReactFlow 节点（`elevateNodesOnSelect={false}`，z≈0） | 0 | **< 1000** | ✅ 盖住节点（本方案核心目标） |
| 画布工具栏 `canvas-tools` | 700 | < 1000 | ✅ 盖住 |
| 侧边栏 `sidebar` | 800 | < 1000 | ✅ 盖住 |
| 设置页 `float` | 100 | < 1000 | ✅ 盖住 |
| 顶栏 `topnav` | 200 | < 1000 | ✅ 盖住 |
| 全屏弹窗 `modal` / `modal-raise` / `ceiling-2` | 9999+ | > 1000 | ✅ 被弹窗盖住（正确；弹窗内走内联分支，见 §6.3） |
| 错误全屏 `overlay-error` | 99999 | > 1000 | ✅ 崩溃时必须盖住一切 |
| Toast `ceiling-1` | 2147483645 | > 1000 | ✅ 提示永在最上 |
| **ImageBoxNode 缩略图菜单** | **99999**（`z-overlay-error`） | **> 1000** | ⚠️ **初稿漏列**——它也是 portal 到 body 的浮层（`ImageBoxNode.jsx:622-629`），会盖住 `@` 弹层 |

> **⚠️ 初稿论证缺口（2026-08-28 复核 · 见 §十二-P5）**
> 「1000 严格高于所有非弹窗元素」这句**不成立**：`ImageBoxNode` 的缩略图菜单是 portal 到 body 的
> **浮层**而非弹窗，却用了 `overlay-error(99999)`。它与 `@` 弹层同为 body 层元素时，`@` 弹层(1000) **会被盖住**。
> 二者同时打开的概率低（点别处会先关），但既然 M3-4 本就要收敛它，**定稿把 M3-4 提前到 M1 一并做**：
> 两者同用 `z-popover(1000)`，同值则靠 DOM 顺序——都是 portal 到 body，**后挂载者在后、后开的盖先开的**，语义反倒自洽。

**结论（修订后）：1000 严格高于「所有非弹窗元素」、严格低于「所有弹窗/错误/Toast」；
唯一例外是误用 `overlay-error` 的 `ImageBoxNode` 菜单，由 M1 步骤 7 收敛后消除。**
这也正好落在规范要求的「复用现有令牌」上，`z-popover` 语义（浮层）与 `@` 候选层完全匹配，且已有 `ArrangeConfirm.jsx:30` 在用。

### 6.3 双模式挂载（关键）

| 场景 | 挂载方式 | position | z | 为什么 |
|---|---|---|---|---|
| 节点内（4 个节点的 `ExpandablePanel`） | `createPortal → document.body` | `fixed` | **`z-popover`** | 跳出 §3 的 ①②③ 三层封印，不受画布 `transform` 缩放；1000 足以压过节点/侧边栏/工具栏 |
| 全屏编辑器内（`FullscreenEditor`） | 内联 | `absolute` | **`z-float`(100)** | 弹窗是 `z-ceiling-2`，portal 到 body 反而会被它盖住；内联在弹窗的层叠上下文内，100 已是该上下文最高 |

由 `portalTarget` prop 控制（默认 `document.body`，传 `null` 走内联），调用方零感知。

### 6.4 遮挡自检（可观测）

portal 之后仍可能被人挡（例如未来的新浮层）。因此固化为一条**可执行的断言**：

```js
/** 命中测试：弹层中心点是否真的被它自己接住（true = 被别人挡住了） */
export function isMentionCovered(popEl) {
  const r = popEl.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return !(hit && popEl.contains(hit))
}
```

- E2E（`playwright.config.js` 已有地基）里对"弹层打开"状态跑一次 → 失败即回归。
- 也可在 `?debugMention=1` 下由 `logger.debug` 输出，人工一眼可查。

---

## 七、视觉与动效规范（和谐）

| 项 | 取值 | 对齐谁 |
|---|---|---|
| 宽 | `280px` | 截图形态；介于现状 192px 与 `ModelSelect` 272px 之间 |
| 最大高 | `300px`（内容超出内部滚动） | 现状 `max-h-[300px]` 保持不变 |
| 圆角 / 底 / 边 / 影 | `rounded-lg` / `bg-surface-1` / `border-edge` / `shadow-2xl` | **与 `ModelSelect.jsx:69`、`PromptNode.jsx:427` 完全一致** |
| 条目 | 高 32px、`px-2`、`text-caption-sm`、缩略图 22px `rounded` 4px | 现状 `:562-570` 微调对齐 |
| 高亮 | `bg-blue-500/25 text-white` | 现状 `:556` 保持不变（不要为了改而改） |
| 无匹配 | 单行 `text-caption text-muted`（高 ~40px） | 现状两行大空态（`:543-547`）→ 收窄，减少噪音 |
| **头部** | **移除**（去掉"可能@的内容"标题 + X 按钮） | 截图无头部；少一个点击热点；关闭交给 Esc / 点外部 |
| 动效 | `transition-[opacity,transform] duration-150 ease-out`，`up` 时 `translateY(4px)→0` | 与 `ExpandablePanel` 的 300ms 刻意区分：**面板是重量级展开用慢速，候选层是轻量提示用快速** |

> **为什么移除头部 X**：候选层是"轻量、随时可弃"的辅助层，给一个常驻关闭按钮会诱使用户去点它（多一次点击），而 Esc / 点外部 / 继续打字已覆盖全部关闭需求。这与 G4"很快消失"同向。

---

## 八、实施计划 M1/M2/M3

### M1 · 定位与层级（P0）— 解决"底对齐 + 不被挡"

| 步骤 | 内容 |
|---|---|
| 1 | 新增 `promptMention.js`：`computeMentionPlacement` + 常量 |
| 2 | `PromptInput.jsx` 弹层改 `createPortal` + `fixed` + `bottom` 定位；新增 `portalTarget` prop |
| 3 | `hooks.js` `useOutsideClick` 支持 ref 数组（向后兼容单 ref） |
| 4 | `tailwind.config.js`：仅删 `suggest`；`PromptInput` 改用 `z-popover`（零新增令牌） |
| 5 | `FullscreenEditor.jsx` 传 `portalTarget={null}` |
| 6 | 加 `data-mention-*` 契约属性 |
| 7 | **`ImageBoxNode.jsx:627` `z-overlay-error` → `z-popover`**（原 M3-4，提前，理由见 §6.2 ⚠️） |

**验收**：§9.1 全部 + §9.3 命中测试。

### M2 · 触发与生命周期（P0/P1）— 解决"稳定 + 不误显 + 很快消失"

| 步骤 | 内容 |
|---|---|
| 1 | `promptMention.js` 加 `detectMentionQuery`，组件改调它 |
| 2 | IME 抑制（`compositionstart/end` + `isComposing`） |
| 3 | `selectionchange` + rAF 统一重判（替代"只在 onInput 判"） |
| 4 | 5 条新增关闭路径（blur / 无匹配 / 无素材不弹 / 视口变化 / 滚动跟随） |
| 5 | Esc 本轮抑制（`dismissedRef`） |
| 6 | 关闭原因埋点 `logger.debug(..., { module: 'prompt' })` |
| 7 | 插入改用当前选区（`savedRange` 降级为兜底，修 3.7 残留 `@关键字`） |

**验收**：§9.2 误触发表全 0 + §9.4 关闭路径表全覆盖。

### M3 · 清理与形态（P2 / 可选）

| 步骤 | 内容 | 需确认 |
|---|---|---|
| 1 | 删 textarea 死分支 + 修正过期头注释 | 否，直接做 |
| 2 | 视觉规范落地（移除头部、280px、150ms 动效） | 否，直接做 |
| 3 | `ModelSelect` 裸 `z-50` → `z-dropdown` | 否，顺手收敛 |
| 4 | `ImageBoxNode` `z-overlay-error` → `z-popover` | **已提前至 M1-7**（§6.2），此处仅留档 |
| 7 | 同步修订 `docs/agent 批量任务/TASK-034`、`TASK-035` 中「`z-suggest` 合规非偏离」的结论 | 否，删令牌后必做 |
| 5 | **形态 V2**：分组（Reference / This project）+ 底部"输入关键词匹配参考资源"搜索条 | **需你确认** |
| 6 | 芯片行高对齐（§5.6） | 否，可选 |

> **M1/M2 保持现有列表形态不变**，先把"位置 + 稳定性 + 层级"做对，形态升级独立在 M3——这样每一步都可独立验收、可独立回滚。

---

## 九、可观测性与验收清单

### 9.1 位置（自动化：单测 `promptMention.test.js`，表驱动）

| 用例 | 输入 | 期望 |
|---|---|---|
| 上方充足 → 向上 | `anchor.top=400, vh=800`（上 392 / 下 ~372） | `placement='up'`，`bottom = 800-400+4 = 404` |
| 上方不足 → 向下翻转 | `anchor.top=60, vh=800`（上 52 / 下 ~724） | `placement='down'`，`top = anchor.bottom+4`，`height=300` |
| 两侧都不足但上方更多 | `anchor.top=280, vh=400`（上 272 / 下 ~104） | `placement='up'`，`height = min(300, 272) = 272` |
| 上方不足 → 翻到下方 | `anchor.top=108, vh=800`（上 100 < 160；100 ≥ 676 也不成立 → `down`） | `placement='down'`，`top = anchor.bottom+4`，`height=300` |
| 高度收缩（向上但空间 < 300） | `anchor.top=180, vh=400, anchor.bottom=202`（上 172 ≥ 160 → `up`） | `placement='up'`，`height = min(300, 172) = 172` |
| 左溢出 | `anchor.left=5` | `left = 8`（margin） |
| 右溢出 | `anchor.left=vw-10` | `left = vw-280-8` |
| 最小高度兜底 | 可用空间 40px | `height = 96`（`max(96, …)`），宁可溢出也不塌成一条 |

> 翻转判据（`computeMentionPlacement`）：`spaceAbove >= flipMinH(160) || spaceAbove >= spaceBelow` → `'up'`，否则 `'down'`。
> 单测须同时锁定「160 阈值」与「两侧都不够时取空间大的一侧」两条边界。
>
> **⚠️ 用例修订说明（2026-08-28）**：初稿第 4 条名为「高度收缩」却给了一组**收缩不到**的参数
> （下方 676 → `height = min(300, 676) = 300`），标题与断言自相矛盾，照抄会写出错误断言。
> 已拆分上表两条：一条测「翻转到下方」，一条用 `vh=400 / 上方 172` **真正测到收缩**。
>
> **已知取舍（非 bug，写入测试注释免得后人当 bug 修）**：只要上方 ≥ 160 就**优先向上**，
> 哪怕下方空间远大于上方（例：上 170 / 下 1000 → `up`，`height=170` 而非 `down` 的 300）。
> 这是「底对齐不遮挡已输入文本」优先于「弹层尽量大」的刻意取舍（G1 优先）。

### 9.2 误触发（自动化：单测 + 组件测）

| 输入（光标前的文本） | 期望 | 覆盖问题 |
|---|---|---|
| `abc@` | 弹 | 正常触发 |
| `abc@人` | 弹 | 中文 query |
| `我的邮箱是abc@` | **不弹** | 3.1 `@` 前是字母 |
| `hello@world.com 继续写` | **不弹** | 3.2 含 `.` 且 `@` 前非空白 |
| `@人物参考 走在街上` | **不弹** | 3.2 已空格收尾 |
| `@人物参考，然后` | **不弹** | 3.2 全角标点 |
| `@` + 30 个连续汉字 | **不弹** | 3.3 超长 |
| `参考@` （`@` 前是中文） | **不弹** | 3.1（中文名后紧接 `@` 视为普通文本） |
| 芯片占位 `\u200B@` | 弹 | ZWSP 允许。**⚠️ 仅 §十二-P2 选 A 时才测得**；选 B 须删除本条，否则是假覆盖 |

### 9.3 遮挡（E2E / 手动）

```js
// playwright 片段
const pop = page.locator('[data-mention-portal]')
await expect(pop).toBeVisible()
const covered = await pop.evaluate((el) => {
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return !(hit && el.contains(hit))
})
expect(covered).toBe(false)         // ← 未被任何元素遮挡
```

手动补充检查点：**在本节点正下方/右侧叠放 2~3 个节点（含选中态）后重测**，确认仍不被盖（这是 `elevateNodesOnSelect={false}` 下最容易翻车的场景）。

### 9.4 关闭路径（组件测 / 手动）

| 操作 | 期望 | 埋点 reason |
|---|---|---|
| 点候选项 | 关闭 + 插入芯片 + 无 `@关键字` 残留 | `select` |
| Esc | 关闭，且继续打字**不再弹** | `esc` |
| 点到画布空白处 | 关闭 | `outside` |
| Tab 到别的节点 / 切窗口 | 关闭 | `blur` |
| 方向键把光标移出 `@` 区间 | 关闭 | `overflow`（复用，或新增 `caret`） |
| 输入空格 / 中文标点 | 关闭 | `overflow` |
| 无素材时输入 `@` | **从未打开** | `no-assets` |
| 有素材但 query 无匹配 | 收成 1 行提示 | `no-match` |
| 拖动画布 / 滚轮缩放 | 关闭 | `viewport` |
| 编辑器内滚动 / 窗口 resize | **不关闭**，位置跟随（漂移 ≤1px） | — |

### 9.5 运行期可观测（人工排障）

开 `DEBUG_MODULES` 的 `prompt` 模块位后，控制台按条输出：

```
[debug] 17:43:06 | PromptInput | mention-open  | {"query":"人","count":3,"placement":"up"}
[debug] 17:43:07 | PromptInput | mention-close | {"reason":"esc"}
[debug] 17:43:08 | PromptInput | mention-close | {"reason":"blur"}
```

配合 DOM 上的 `data-mention-placement` / `data-mention-count`，**任何一次"弹错/不弹/被挡"都能在 10 秒内定位到原因**，不需要复现调试。

---

## 十、风险与回滚

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| portal 后 `useOutsideClick` 失效（点弹层被判为外部） | 高（必现） | 弹层一碰就关 | 已纳入 M1 步骤 3：`popRef` 一并参与判定 |
| `onMouseDown preventDefault` 导致候选项 `onClick` 不触发 | 低 | 选不中 | `preventDefault` 只阻止默认聚焦，click 仍派发；M1 手动验证 |
| `selectionchange` 与 `onInput` 双驱动重复 `detectMention` | 中 | 无功能影响，仅多一次计算 | rAF 合并，且 `detectMention` 幂等 |
| 画布缩放时关闭弹层，用户觉得"太敏感" | 低 | 体验 | 这是刻意取舍（移动即关，符合 G4）；若反馈不佳，M3 可改为跟随重算 |
| 删 `suggest` 令牌遗漏引用 | 低 | 构建期样式缺失 | 全项目仅 2 处且其一随死代码删除；`npm run build` 兜底 |
| jsdom 无布局，组件测取不到 `getBoundingClientRect` | 中 | 单测失败 | 定位计算全部在纯函数层测；组件测 mock rect |

**回滚**：M1/M2/M3 各自独立 commit，任一里程碑出问题 `git revert` 该 commit 即可（改动集中在 `PromptInput.jsx` + 新增的 `promptMention.js`，无数据迁移、无协议变更）。

---

## 十一、决策记录 ADR

| # | 决策 | 备选方案 | 为什么选它 |
|---|---|---|---|
| A1 | **portal 到 body + fixed** | 抬升宿主节点 `node.zIndex` | 抬升方案改动更小，但：① 弹层仍随画布 `transform` 缩放（zoom<1 时字变小）；② 宿主节点整体跳到其它节点之上，视觉突兀；③ 全屏编辑器场景无 ReactFlow node 可用。portal 一次解决遮挡 + 缩放 + `contain` 三重问题，且项目已有先例（`ImageBoxNode.jsx:622-666`） |
| A2 | **底对齐 = 弹层底边贴 `@` 行顶边（-4px）** | 贴 `@` 字符基线 | 贴基线会覆盖 `@` 所在行本身，与"不遮挡已输入文本"冲突。截图与主流实现（Notion/飞书）均为"整行之上" |
| A3 | **判定逻辑抽成纯函数** | 留在组件内 | 组件内逻辑在 jsdom 下几乎不可测；抽出来后误触发 9 个用例全表驱动覆盖，这是"可观测"的地基 |
| A4 | **复用 `z-popover(1000)`，零新增令牌** | ① 新增 `mention: 10002`；② 沿用 `suggest: 999999` | ① 违反 `tailwind.config.js:18-19`「优先复用现有令牌，不要直接写数字」；② 999999 已被 §3 证明无效且高于错误全屏。而 1000 天然落在「sidebar 800 之上、modal 9999 之下」，严格高于所有非弹窗元素、低于所有弹窗/错误/Toast，语义与数值双向自洽，**不需要新数字** |
| A5 | **全屏编辑器内不 portal** | 统一 portal | 弹窗是 `z-ceiling-2(2147483646)`，portal 到 body 的弹层必然被它盖住。双模式由 `portalTarget` prop 收口，调用方零感知 |
| A6 | **画布平移/缩放时关闭弹层** | 跟随重算 | 跟随需要在每帧换算视口坐标（额外复杂度 + 抖动风险）；"移动即关"符合 G4，且是主流编辑器行为。留作 M3 可回退项 |
| A7 | **M1/M2 不改面板形态** | 一步到位做成截图形态 | 位置/稳定性/层级是"对错问题"，形态是"好坏问题"。先做对、再做好，每步独立可验收可回滚 |
| A8 | **移除头部（标题 + X）** | 保留 | 截图无头部；X 按钮会诱使多余点击；关闭路径已足够（§5.4） |
| A9 | **`overlay-error(99999)` 不动** | 一并下调它 | 它服务于根级崩溃全屏（`ErrorBoundary.jsx:62`），与本方案无交集；动它属于无关变更，会牵连 `ImageBoxNode` 等既有引用，风险 > 收益 |
| A10 | **边界判定抽成 `isMentionBoundary` 并与 docs/70 共用** | 69 与 70 各留一套 `@` 边界规则 | 两个入口都宣称自己是「唯一入口」，规则不一致就会产生第三处散落的 `@` 判定，直接违背 67/68 号文档的数据流收敛方向（§十二-P1） |
| A11 | **`before` 取法二选一并写进文件头 JSDoc** | 维持"整行纯文本"的错误假设 | 芯片在 DOM 里是元素、不出现在 textNode 中，若不显式定取法，M2 会按错误假设实现并返工（§十二-P2） |
| A12 | **`ImageBoxNode` 的 z 收敛提前到 M1** | 留在 M3-4 可选 | 初稿「1000 高于所有非弹窗元素」的论证漏了它；同值化后靠 DOM 顺序反而自洽（§十二-P5） |

---

## 十二、开工前补丁（2026-08-28 复核）

> **本章来源**：方案定稿后对全部代码引用做的一次实测核对。
> **结论：正文的结论与架构全部成立，可以实施**；但有下列 7 处缺口，
> **P1 / P2 / P4 会导致 M2 返工，必须在开工前定死**；P3 / P5 / P6 / P7 已直接并入正文相应章节或接受现状。

| # | 缺口 | 严重度 | 状态 |
|---|---|---|---|
| P1 | 与已实施的 docs/70 边界规则冲突 | **阻塞 M2** | 方案已给，待并入 70 |
| P2 | `before` 的真实语义与初稿描述不符 | **阻塞 M2** | 二选一，待你拍板 |
| P3 | `PromptInput.jsx` 行号系统性偏移 +10~+12 | 中 | 已在文首「引用基准」标注 |
| P4 | 两条关闭路径（画布移动 / 滚动跟随）没给实现 | **阻塞 M2** | 已在 §5.4 补齐代码 |
| P5 | `z-popover` 论证漏了 `ImageBoxNode` 菜单 | 中 | 已并入 §6.2 + 提前到 M1-7 |
| P6 | 删 `suggest` 令牌与两份审计文档冲突 | 低 | 已并入 §8 M3-7 |
| P7 | `nodrag/nowheel/nopan` 在 portal 后语义变化 | 低 | 见下，接受现状 |

---

### P1 · 与 docs/70 的边界规则冲突（阻塞 M2）

**现状**：70 号方案（画布图片命名与 @名匹配）**已实施**，其 `autoLinkAssetsByName` 已登记为唯一入口
（`contracts.js:17-22`「禁止在 PromptInput/任何组件里手写 lastIndexOf('@')/匹配正则」）。但它的正则是：

```js
// promptChips.js:267 —— 全局替换，不检查 @ 前面是什么字符
const re = new RegExp(`@(${names.map(...).join('|')})`, 'g')
```

而本方案的 `detectMentionQuery` 要求 `@` 前必须落在 `ALLOW_PREV` 内。**两套规则并存**：

| 输入 | 69 的 `detectMentionQuery`（输入时） | 70 的 `autoLinkAssetsByName`（已输入文本） | 一致？ |
|---|---|---|---|
| `abc@` | 不弹 ✅ | 命中则替换 ✅ | 一致 |
| `我的邮箱abc@人物参考` | **不弹** ✅ | **仍会替换** ❌ | **不一致** |
| `芯片后紧接着打 @人物参考` | 弹（DOM 侧 `@` 在 textNode 首） ✅ | 命中 ✅ | 一致，但**要求 `}` 在允许集** |

**定稿处置**：

1. `promptMention.js` 导出 `isMentionBoundary(prev)`（已并入 §5.1），**`}` 必须留在允许集内**
   —— 因为 70 的字符串上下文里芯片是 `@{id:label}`，紧贴其后输入 `@名字` 时 `@` 前就是 `}`。
2. `autoLinkAssetsByName` 改为**同一函数判定边界**。最小改法：把正则整体替换为
   「先按 `@` 切分 → 逐处校验 `isMentionBoundary(前字符)` 且名字全等 → 命中才替换」，
   并**复用 `promptMention.js` 的 `isMentionBoundary`**（`promptChips.js` 从 `promptMention.js` import，单向依赖，不成环）。
3. `contracts.js` 的能力层登记区**扩写为两条**，明确分工，避免后人误以为二选一：
   - `promptChips.autoLinkAssetsByName`：**已输入文本的批量转换**（value 变化时，把 `@素材名` → `@{id:label|thumb}`）
   - `promptMention.detectMentionQuery`：**输入时的触发判定**（光标前是否构成 @ 提及）
   - 两者**共用 `promptMention.isMentionBoundary` 作为边界单一真源**

> **不做的理由（避免范围膨胀）**：不改动 `@{id:label}` 序列化协议，也不做存量数据迁移。
> 本项只统一「边界判定」这一点，不动 70 的全等匹配语义。

---

### P2 · `before` 的真实语义（阻塞 M2，需你拍板）

已在 §5.1 的 ⚠️ 中写清。**二选一**：

| 方案 | 做法 | 代价 | 收益 |
|---|---|---|---|
| **A（推荐）** | 从 editor 根做一次轻量文本化：芯片 → 单字符占位（`ZWSP`），得到「整段纯文本 + 光标偏移」，再切片传 `before` | 多一次遍历（prompt 一般 < 2KB，可忽略） | 跨 textNode 也正确；§9.2 的 `\u200B@` 用例**真正生效**；为后续形态 V2（分组/搜索）打好地基 |
| **B（最小改动）** | 维持现状只取当前 textNode | 零改动 | 跨 textNode 漏判；需从 §9.2 删掉 `\u200B@` 用例（否则是假覆盖） |

> **建议 A**。理由：`detectMentionQuery` 一旦是纯函数，文本化也应是纯函数（可单测），
> 且「整段纯文本 + 偏移」这个中间产物未来能被形态 V2 的搜索条直接复用。

---

### P3 · 行号偏移（已处理）

见文首「引用基准」。`tailwind.config.js` / `hooks.js` / `App.jsx` / `NodeShell.jsx` /
`ExpandablePanel.jsx` / `FullscreenModal.jsx` / `ImageBoxNode.jsx` 的引用已实测核对，准确。

---

### P4 · 两条关闭路径的实现（已处理）

已在 §5.4 补齐可直接落地的代码：画布平移/缩放走 `useStore((s) => s.transform)`，
滚动/resize 走「仅 `showMention` 为真时挂载 + rAF 合并」。

---

### P5 / P6 · 层级与文档冲突（已处理）

- P5：`ImageBoxNode` 菜单已并入 §6.2 表格，收敛动作提前到 **M1 步骤 7**。
- P6：删 `suggest` 令牌后需同步修订 `TASK-034` / `TASK-035` 中「`z-suggest` 合规非偏离」的结论，已列入 **M3 步骤 7**。

---

### P7 · `nodrag / nowheel / nopan` 在 portal 后的语义变化（接受现状）

实测 `index.css:320-322`，本项目的 `.nodrag` **只定义为 `cursor: default`**，
真正的拖拽阻断来自 ReactFlow 内部的 `target.closest('.nodrag')`。

portal 到 body 后弹层已不在 `.react-flow` 内，**拖拽/滚轮本来就不会触发** → 这三个 class 退化为无害冗余。
**定稿：保留**（作为语义标注，成本为零，且内联分支（全屏编辑器）下仍然需要）。

**已知副作用（低概率，不阻塞）**：`index.css:600-603` 的
`.react-flow.lod-3 .react-flow__node .nodrag { opacity: 0; pointer-events: none }` 对 portal 弹层失效
→ 缩放进入 LOD-3 时，输入框已被禁用但 `@` 弹层仍悬浮可见。
**触发条件苛刻（要先打开弹层再缩到极小）**，本期不做；若后续反馈可加一行
`const zoom = useStore((s) => s.transform[2]); if (zoom < LOD3) closeMention('lod')`。

---

## 附：待用户确认项

### A. 阻塞项（不确认不能开工 M2）

0. **`before` 取法（§十二-P2）**：A（editor 根文本化，跨 textNode 正确，为形态 V2 铺路）还是
   B（只取当前 textNode，零改动但跨节点漏判、需删掉 `\u200B@` 用例）？**建议 A**。
1. **是否同步收敛 docs/70（§十二-P1）**：把 `autoLinkAssetsByName` 改为复用 `isMentionBoundary`？
   不做的话，`我的邮箱abc@人物参考` 这类文本仍会被 70 误转成芯片（69 侧已正确不弹）。
   **建议做**——否则两套 @ 判定并存，正好违背 67/68 的数据流收敛方向。

### B. 非阻塞项（确认后并入 M3）

2. **形态 V2（M3-5）** 是否要做成截图那样：顶部按来源分组（Reference / This project）+ 底部常驻"输入关键词匹配参考资源"搜索条？
3. **芯片行高（§5.6）** 是否一并对齐文本行高（会让含芯片的行更紧凑）？
4. 宽度 **280px** 是否合适（现状 192px，截图观感约 280~320px）？

> **M1 不受 A 组阻塞**（M1 只做定位与层级，不碰判定逻辑）；A 组只阻塞 M2。
> B 组不影响 M1/M2 开工，确认后并入 M3 即可。
