# 04 · 画布 / 节点 · 跨区 · PromptInput 粘贴事件未隔离导致输入框粘贴双建节点 · 2026-09-18

> **性质**：审计轮（只读，查证"在 prompt 输入框粘贴文字为何同时建出文本节点"）。
> **根因区**：04（画布/节点交互 · 粘贴处理）· **跨区**：`base/prompt`（PromptInput）＋ `hooks`（useAssetDropPaste）＋ `App`（window 监听挂载）。
> **结论一句话**：`PromptInput` 的 `handlePaste` 只 `e.preventDefault()`、**未 `e.stopPropagation()`**，粘贴事件冒泡到 window 的 `useGlobalPaste`；A 闸对 contentEditable 仅按"载荷"放行（图片 / 节点组 JSON），故在输入框聚焦时粘贴这类"画布语义载荷"会**既插入输入框又建节点**（复制节点粘进 prompt → 建出 textGenerateNode + 框里落入 JSON 文本），即用户报的"同时粘贴文本节点和输入框文字"。稳健修法 = 让编辑器独占粘贴（`PromptInput` 补 `stopPropagation`）。
> **结论落点**：本文件（唯一写全处）＋ debt.mjs 登记 1 笔（TD-04-34）＋ 关联 TD-04-21（粘贴 CE 放行双实现，已解决·业务语义澄清）。
> **覆盖账**：本轮审 3 文件 / 涉及 3 文件（源 3，无测试新增——审计不改码）。

---

## 一 · Step 0 普查（粘贴处理被实现成几份）

| 关注 | 现有实现（文件:行 · 深读实证） | 份数 | 处置 |
| --- | --- | --- | --- |
| **画布粘贴入口** | `App.tsx:1055` `useGlobalPaste(onPaste)`（**window 级监听**）；`<ReactFlow>` 未挂 `onPaste`（`App.tsx:1464-1469` 仅 `onDragOver/onDrop/onPaneClick`） | 1（window 唯一） | 非债（已收口 TD-04-21） |
| **A 闸（window）** | `useAssetDropPaste.ts:627-630`：contentEditable 内仅 `isImagePaste || isGroupJson` 才转发 `onPaste`，其余 `return` | 1 | 非债（判定本身） |
| **B 闸（onPaste）** | `useAssetDropPaste.ts:458-475`：CE 跳过条件 `isOnlyPlainTextClipboard(items)`（`:472`）→ 仅"仅纯文本"拦截 | 1 | 非债（判定本身） |
| **B 闸建节点** | `handleTextPaste` `:423` `addNode('textGenerateNode', pos, {text})`；图片分支 `createNodeFromFile` `:249/233` | 1 | 非债（画布语义正确） |
| **编辑器粘贴处理** | `PromptInput.tsx:623-653` `handlePaste`：`e.preventDefault()` 插入 text/plain，**无 `stopPropagation`**（`:625`） | 1 | **VD（TD-04-34）** |
| **编辑器元素类型** | `PromptInput.tsx:717` `<div contentEditable …>`（非 input/textarea） | 1 | 非债 |

---

## 二 · Step 1 取证（refs + 行号，深读实证）

1. **画布粘贴唯一入口是 window 监听**：`App.tsx:1055` `useGlobalPaste(onPaste)`；`ReactFlow` 的 `onPaste` 属性**不存在**（`App.tsx:1464-1469` 仅 `onDragOver/onDrop/onPaneClick`）⇒ 生成节点的 `onPaste`（B 闸）只经 window A 闸转发被调用。
2. **A 闸放行条件**：`useAssetDropPaste.ts:627-630` `if (isContentEditableEvent(e)) { if (!isImagePaste && !isGroupJson) return; }` —— 在 contentEditable 内，只有剪贴板带**图片文件项**或**节点组 JSON**（`mutiwindow-nodes`/`mutiwindow-images`）才继续 `onPasteRef.current(e)`，纯文本 / 富文本（text/html 无图）一律 `return` 跳过。
3. **B 闸建节点分支**：A 闸放行后 `onPaste` 走 `:487-514`，纯文本项 `handleTextPaste(syncPlain)` → `:423` `addNode('textGenerateNode', pos, { text: cleanText })`；组 JSON → `:385-400` `onPasteNodeGroup` 重建节点；图片 → `createNodeFromFile` → `assetNode`。
4. **编辑器未隔离事件**：`PromptInput.tsx:623-625` `handlePaste` 仅 `e.preventDefault()`，**未 `e.stopPropagation()`** ⇒ 原生 paste 事件继续冒泡至 window，A 闸照常收到。`:626-650` 把 `getData('text/plain')` 插入编辑器 DOM 并 `emitDOM()`。
5. **双处理触发链**：聚焦 prompt 时粘贴"复制的节点"（剪贴板 = `mutiwindow-nodes` JSON）→ A 闸 `isGroupJson=true` → 转发 `onPaste` → B 闸 `isOnlyPlainTextClipboard=true` 但 `!isGroupJson=false` → 不跳过 → `handleTextPaste(JSON)` 建 `textGenerateNode`；同时 `PromptInput.handlePaste` 把同一 JSON 文本插入输入框 ⇒ **文本节点 + 输入框文字同时出现**（用户现象）。粘贴图片同理 → 建 `assetNode` + 框内插入空/alt 文本。
6. **诚实边界（已裁定非债的部分）**：纯文本 / 富文本粘贴当前被 A 闸载荷判定挡住（不建节点）；缺陷不在 A/B 闸的"放行/拦截"语义，而在**编辑器未独占粘贴事件**——隔离依赖 `e.target` 正确识别 contentEditable（脆弱），且任一"画布语义载荷"都会漏过。

---

## 三 · Step 3 定位（归属）

- **VD（输入框粘贴双建节点）**：归属 04（画布/节点交互）。根因 = 编辑器粘贴处理未 `stopPropagation`，事件泄漏到画布全局粘贴处理器；与 TD-04-21 同源（粘贴"CE 放行"判定），但 TD-04-21 解决的是"判定双实现/业务语义"，本债解决的是"编辑器未隔离事件"这一遗留结构缺陷（TD-04-21 未触及 `PromptInput` 的事件冒泡）。

---

## 四 · 探债（明细）

| ID | 决策点/问题点 | 归类 | 归属 | 爆炸半径 | 利息率 | 根因 | 偿还计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-04-34 | `PromptInput.handlePaste`（`PromptInput.tsx:625`）只 `e.preventDefault()` 未 `e.stopPropagation()`，粘贴事件冒泡至 window `useGlobalPaste`（A 闸 `useAssetDropPaste.ts:627-630`）；当剪贴板带"画布语义载荷"（复制的节点组 JSON / 图片）时 A 闸放行 → `onPaste`（B 闸）建节点（`handleTextPaste` `:423` / `createNodeFromFile` `:233`），与编辑器插入文字双处理，现象＝输入框聚焦时粘贴"复制的节点"会同时建出 textGenerateNode 且框里落入该 JSON 文本 | 增债(结构) | 04 | 输入框粘贴交互正确性（用户可见双节点） | 中 | 编辑器未独占粘贴事件（缺 `stopPropagation`），隔离仅靠 A 闸按载荷分类（脆弱、且对画布语义载荷本就放行） | 在 `PromptInput.tsx:625` 的 `e.preventDefault()` 后补 `e.stopPropagation()`，使编辑器完全拥有粘贴、画布全局粘贴处理器不再收到编辑器内粘贴；验证：① 聚焦 prompt 粘贴纯文本/富文本/图片/复制的节点，文字只进输入框、不再建节点；② 焦点在画布空白/节点外粘贴仍正常建节点（走 window A 闸，不受影响）；③ 复制节点粘贴到画布仍重建（A 闸对画布焦点照常放行） | 待还（TD-04-34） |

> **非债裁定（诚实边界）** —— ⚠️ **2026-09-18 施工轮取证后，第 1 条被推翻，见 §八**：
> - ~~**A 闸 / B 闸的放行/拦截语义**：contentEditable 内纯文本/富文本跳过、画布焦点粘贴建节点 = 业务语义正确，**非债**。~~
>   **推翻理由**：A/B 闸对编辑区**按载荷分类放行**（图片 / 节点组 JSON 交给画布建节点）正是 TD-04-34 的**病根** ——
>   它与编辑区自身的粘贴处理撞成**双处理**（同一事件两个所有者）。用户裁定「**编辑器里的任何操作都归编辑器**」，
>   该放行已撤销。**当时判"非债"是因为只审了"载荷分类对不对"，没审"这个事件该归谁"。**
> - **编辑器元素类型（contentEditable）**：与 input/textarea 同属可编辑区，A 闸 `isContentEditableEvent` 已覆盖，**非债**。
>   （补注：该原语已随按载荷判据一起删除，现统一走 `isEditableTarget`，见 §八。）
> - **ReactFlow 未挂 onPaste**：画布粘贴统一走 window 监听是既有收口（TD-04-21），**非债**。

---

## 五 · 覆盖度表（本轮）

| 文件 | 层 | 覆盖状态 | 轮次/日期 | 证据(refs/行号·深读) | 债/裁定 |
| --- | --- | --- | --- | --- | --- |
| `src/components/base/prompt/PromptInput.tsx` | 上层 | 深审 | 本轮 | `:623-625` handlePaste 仅 preventDefault 未 stopPropagation；`:717` contentEditable；`:626-650` 插入文字 | TD-04-34 |
| `src/hooks/useAssetDropPaste.ts` | 地基 | 深审 | 本轮 | `:627-630` A 闸 CE 仅放行图片/组JSON；`:458-475` B 闸跳过条件 isOnlyPlainTextClipboard；`:423` 建 textGenerateNode | 发函数（TD-04-21 关联） |
| `src/App.tsx` | 上层 | 抽审 | 本轮 | `:1055` useGlobalPaste(onPaste) window 监听；`:1464-1469` ReactFlow 未挂 onPaste | 粘贴入口收口（TD-04-21） |

---

## 六 · 结论（回答：输入框粘贴为何双建节点）

1. **画布粘贴入口**：✅ 已收口为 window 级 `useGlobalPaste`（A 闸）+ `onPaste`（B 闸）单一路径；`<ReactFlow>` 不挂 `onPaste`。
2. **A/B 闸语义**：✅ 对 contentEditable 内的纯文本/富文本正确跳过、对画布焦点粘贴正确建节点（TD-04-21 业务语义）。
3. **隔离缺陷**：🔴 **编辑器未独占粘贴事件**。`PromptInput.handlePaste` 只 `preventDefault` 未 `stopPropagation` ⇒ 事件泄漏到 window A 闸；当剪贴板带"画布语义载荷"（复制的节点组 JSON / 图片）时 A 闸放行 → `onPaste` 建节点，与编辑器插入文字**双处理**。用户现象（粘贴出文本节点 + 框里文字）精确对应"复制节点粘进 prompt"这一可复现路径（组 JSON → `textGenerateNode` + 框内 JSON 文本）。纯文本/富文本当前被 A 闸载荷判定挡住，但隔离结构本身仍脆弱（依赖 `e.target` 识别 contentEditable）。

**一句话**：修 TD-04-34 —— `PromptInput.handlePaste` 补 `e.stopPropagation()`，让编辑器独占粘贴，画布处理器不再收到编辑器内粘贴；焦点在画布外的粘贴不受影响（A 闸照常）。

---

## 七 · 状态行

- 本区（04）：`已还清` 🟢 —— 本轮新增 TD-04-34（中）1 笔并**同轮施工还清**（§八）；
  关联 TD-04-21（粘贴 CE 放行双实现）已随 ADR-0029 的判据收口一并作废（其"按载荷分类"已被推翻）。
  04 区主表**已清零**（`node scripts/debt.mjs list --area 4` 主表命中 0）。
- 覆盖账：审 3 / 共涉及 3 / 未审 0（本轮聚焦输入框粘贴双处理；`useAssetDropPaste` A/B 闸已在前轮 TD-04-21 深审）。
- DATAFLOW 对账：**一致**。粘贴入口链路（window useGlobalPaste → onPaste）判定成立，非链路图漂移。无需改现状图。

---

## 八、施工轮（`架构师改码7步法` · 2026-09-18 · TD-04-34 已解决 · 判据 ADR-0029）

### 8.1 用户裁定（本轮判据的唯一来源）

> 「**编辑器内的粘贴和删除也不归画布呀**……我刚刚说的删除，是指**编辑器里的任何操作**，比如全选、删除，
> 这些都是自己的。」「**不要变成我说啥你改啥**。」

⇒ 判据不是"粘贴不归画布"，而是「**交互只有一个所有者：编辑器内的交互一律归编辑器**」。
**我第一版只治了粘贴，范围写窄了** —— 归属判据天然按**事件类**推广，只治一种事件等于留下"下一个事件再犯"。

### 8.2 Step 0 普查：同一条判据被写成 **7 份**，完整性还不一样

| 实现 | 位置 | 完整性 |
| --- | --- | --- |
| ✅ 共用原语 | `base/core/uiHooks.ts:16` `isEditableTarget` | 完整 |
| ✅ 走原语 | `useCanvasShortcuts:85` · `useContextMenu:70` · `modalLayer:301` · `AssistantTablePanel:445` | 完整 |
| ⚠️ 手写副本 | `ImageBoxNode:391` · `PanoramaNode:463` · `OverlayEditor:644` | 完整但重复 |
| ❌ 手写且漏项 | `VideoProcessNode:744` `matches('input, textarea, select')` | **漏 contenteditable** |
| ❌ 无守卫 | `canvasHotkeys.ts::useCanvasKeydown`（画布内组件的**唯一入口**） | 只查"画布被压制" |
| ❌ 按载荷 | `useAssetDropPaste` A 闸 / B 闸（含 787ca25 的 input/textarea 变体） | **间接判据，必然漏** |

**非债裁定（诚实边界）**：`DepthVideoModal:115`（Esc 关层）· `useTabDragSort:104`（Esc 取消拖拽）·
`AgentPanel:889`（只停自动跟随、不吃键）—— 都不属本类。`ImageEditor:400` 的 `textInput` 是**域内状态**
（图片编辑器正在加文字），不是"焦点在输入区"，**非债**。域外（`director3d` / `videoEditor`）各有副本，**未收口**，见 ADR-0029 §决议 6。

### 8.3 Step 2 归因：**这是母体，不是孤例**

两个真 bug 同源：
1. **输入框内按 Delete/Backspace** → 同时删文字 **+ 删视频片段**（`VideoProcessNode` 自写守卫漏 contenteditable）；
2. **输入框内粘贴"复制的节点"** → 既建节点又落 JSON（A 闸按载荷放行 × 编辑区自己插文字）。

母体 = **同一判据多份实现 + 判据放错位置（放在消费者而非唯一入口）**。故修法是**判据上移 + 副本删除**，不是补条件。

### 8.4 Step 6 施工（8 文件）

| # | 改动 | 位置 |
| --- | --- | --- |
| ① | `PromptInput.handlePaste` 补 `stopPropagation`（编辑区独占） | `PromptInput.tsx:633` |
| ② | A 闸：按载荷分类 → `if (isEditableTarget(e)) return;` | `useAssetDropPaste.ts:613` |
| ③ | B 闸：CE/input 两套载荷判据 → 同一条归属判据 | `useAssetDropPaste.ts:447` |
| ④ | `read()` 兜底里 5 处 `!isCE` 条件删除（编辑区已在上方早退 ⇒ 恒真） | `useAssetDropPaste.ts:479-524` |
| ⑤ | 删 5 个按载荷原语：`isContentEditableEvent`／`isCanvasGroupJson`／`readClipboardText`／`hasImageClipboardItem`／`isOnlyPlainTextClipboard` | `useAssetDropPaste.ts`（原语块整体退役） |
| ⑥ | `useCanvasKeydown` **唯一入口内置**可编辑区守卫 | `canvasHotkeys.ts:57` |
| ⑦ | `VideoProcessNode` 自写的不完整守卫**删除** | `VideoProcessNode.tsx:744` |
| ⑧ | `ImageBoxNode` / `PanoramaNode` / `OverlayEditor` 手写副本改走 `isEditableTarget` | 各自 window 监听处 |

### 8.5 Step 7 证据

**（a）先红后绿探针（3 个，全部命中）**：
```
① PromptInput 去掉 stopPropagation      → exit=1（35 行）
② A 闸 还原「按载荷放行」                → exit=1（63 行）
③ useCanvasKeydown 去掉可编辑区守卫      → exit=1（103 行）
```

**（b）对账测试**：`tests/unit/editorOwnership.test.tsx`（**9 例**：粘贴侧 5 + 键盘侧 4，同一条判据同文件）。
  - ⚠️ 探针执行时本测试曾拆为 `pasteOwnership.test.tsx`（粘贴）+ `editorKeydownOwnership.test.tsx`（键盘）
    两个文件；**当日晚些时候已合并**为上名（同判据同文件 —— 本机 jsdom 每个测试文件各建一次环境，拆开白付一次成本）。
    故探针记录里的 `--run "…pasteOwnership.test.tsx"` 是**当时的命令**，其等价现状命令为 `--run "…editorOwnership.test.tsx"`，用例未变。

**（c）既有测试的处置（**测试红 ≠ 测试错**，逐条判）**：`tests/unit/useAssetDropPaste.test.tsx` 8 例变红，分两类：
- **4 例锁的是"已被撤销的规则"**（CE/input/textarea 内粘贴节点 JSON → 放行建节点）⇒ **断言反转**（改判据必须改测试）；
- **1 例测的是"已被删除的机制"**（`dataTransferItemListLike` 锁按载荷分类的类数组判据）⇒ **删测试 + 删辅助器**
  （锁着已撤销设计的假绿测试必须删，7 步法 §弯路留痕）；
- **3 例是 `read()` 兜底路径**，它们变红**不是语义问题，是我引入的 bug**（见 8.8）。

### 8.6 度量（改前 / 改后）

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| 「可编辑区」判据**实现份数** | **7**（1 原语 + 3 手写副本 + 1 漏项 + 1 无守卫 + 2 按载荷） | **1**（`isEditableTarget`，另域外 3 处副本未收口） |
| 粘贴侧识别原语 | **5** | **0** |
| `useAssetDropPaste.ts` 行数 | — | **+32 / −93 = 净 −61 行** |
| 守卫位置 | 每个消费者各自记得加（会漏） | **唯一入口强制**（忘不掉） |
| 真 bug | 2 处未修 | 2 处已修 |

### 8.7 交付四闸自查

- **一归**：判据 7 份 → 1 份 ✅
- **减一**：删掉 5 个按载荷原语 + 5 处 `!isCE` 条件 + 1 个假绿测试与辅助器；**未新增任何兜底** ✅
- **减二**：`useAssetDropPaste` 净 −61 行；判据从"按载荷猜"（间接）收窄为"归属"（直接） ✅
- **一诚实**：`read()` 兜底里被 `!isCE` 掩盖的分支被删（编辑区已早退，那 5 个条件恒真 = 幽灵判断） ✅

### 8.8 弯路留痕（**与结论同等对待 · 本轮最贵的一条**）

**弯路 ①：我只治了"粘贴"，没推判据的完整外延。**
- 推理链：用户报的是"粘贴双处理"→ 我就只补 `stopPropagation` + 收 A 闸。
- 为什么错：归属判据是**按事件类**成立的（粘贴/删除/全选…），只治一种 ⇒ 键盘侧两个真 bug（删片段）原样留着。
- 用户原话：「你是一个架构师，你这个删除还需要我提醒？」「不要变成我说啥你改啥」。
- 已完整回退/改正：是（见 8.4，键盘侧一并收口）。

**弯路 ②：我引入了一个运行时 bug，而且是被"只跑自己那两个测试文件"掩盖的。**
- 事实：我删掉 `isCE` 变量后，`read()` 兜底里 5 处 `!isCE` 仍在引用它 ⇒ 走到那里直接 `ReferenceError`
  ⇒ `useAssetDropPaste` 的 3 个 `read()` 用例建节点数为 0（红）。
- 为什么没当场发现：**我改完只跑了 eslint、跳过了 `tsc`**（本机 tsc 要 ~5 分钟，我图快）；
  且我只跑了自己新写的 2 个测试文件，**没跑被我改动的那个既有测试文件**，也没跑全量。
- 后果：交给用户的是一次**假绿**（我报"9 例全绿"，实际全量有 9 例红）。
- **改正（流程级，不是这一次）**：① 改完源码**必须跑 tsc**，不许因慢跳过；
  ② 改了某个文件，**必须跑该文件的既有测试**，不能只跑自己新写的；
  ③ 全量跑不动时，**交给用户在正常环境跑**，不许拿"子集全绿"当"全绿"。
- 是否已完整回退：是（`isCE` 5 处条件删除，见 8.4 ④）。

**弯路 ③：把测试拆成两个文件。**
- 事实：一个判据拆成 `pasteOwnership` + `editorKeydownOwnership` 两个文件；而本机 jsdom **每个测试文件各建一次环境**
  ⇒ 白付一次环境成本。用户问「为什么两分钟还没跑完」。
- 结论：**同一判据的测试应尽量同文件**。
- **已回改**：当日晚些时候合并为 `tests/unit/editorOwnership.test.tsx`（9 例，两段同文件），旧两文件已删；
  ADR-0029 的「📌 违反时的判据」与本节 §8.5 的命令均已同步改名（A7：修正必须回改原文）。

### 8.9 落点

- 明细真源 = 本文件（§八）。
- 判据本体 → `docs/adr/ADR-0029-交互只有一个所有者：编辑器内的交互一律归编辑器.md`（用户裁定）。
- `债务.md`：TD-04-34 → **已解决**。
- DATAFLOW.md：无需刷新（只改事件归属判定，未改链路与边）。
