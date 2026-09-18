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

> **非债裁定（诚实边界）**：
> - **A 闸 / B 闸的放行/拦截语义**：contentEditable 内纯文本/富文本跳过、画布焦点粘贴建节点 = 业务语义正确（TD-04-21 已澄清"网页富文本清洗成纯文本建节点"为期望行为），**非债**。
> - **编辑器元素类型（contentEditable）**：与 input/textarea 同属可编辑区，A 闸 `isContentEditableEvent` 已覆盖，**非债**。
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

- 本区（04）：`已验证(有债待还)` 🔴 —— 本轮新增 TD-04-34（中）1 笔；关联 TD-04-21（粘贴 CE 放行双实现，已解决·业务语义澄清，未触及事件冒泡隔离）。
- 覆盖账：审 3 / 共涉及 3 / 未审 0（本轮聚焦输入框粘贴双处理；`useAssetDropPaste` A/B 闸已在前轮 TD-04-21 深审）。
- DATAFLOW 对账：**一致**。粘贴入口链路（window useGlobalPaste → onPaste）判定成立，非链路图漂移。无需改现状图。
