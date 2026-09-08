# AI 助手表格 —— 图片引用（@素材）方案 · 审计报告

> **审计对象**：`AI-ASSISTANT-TABLE-IMAGE-REF.md`（提案·未开工，2026-09-08 起草）
> **审计时间**：2026-09-08
> **审计方式**：逐条核对文档引用的代码真源（promptChips / AgentPanel / assistantTable / agentAttachments / imageUrl / assetStore / useConnectedInputs / useCanvasAgentTools）。
> **结论**：方案整体扎实、引用大体属实；存在 **1 个真实逻辑漏洞 + R1 方案里一条死路 + 4 处未闭合设计点**。落地前必须修①和②。

---

## 一、真实逻辑问题（必须修 / 补）

### L1. §6.3「text 不解析」导致同轮内"参考图"出现两套表示 —— 严重

表格单元格的芯片会被解析成 `参考图N(label)`，但用户在输入框手打的 `@素材`（落在 `text` 段）在表格模式下**完全不解析**，以裸 `@{id:label|url}` 串直接发给 AI；而同一输入框里的 `attachments` 却进了 `allImages` 并编入 `buildRefCatalog`。

```848:862:src/components/panels/AgentPanel.tsx
if (tableOpen) {
  // currentTable / rowTexts 走 resolve()
  } else if (text) { parts.push(text); }   // ← text 原样推，芯片不解析
```

```838:840:src/components/panels/AgentPanel.tsx
const allImages = [...attachments, ...pendingImageNodes]
  .filter((a) => a?.url)
  .filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i);
```

**后果**：用户写「用 `@{asset_x:猫女}` 改这一行」，AI 看到的是裸芯片串，而目录里却是 `参考图M：猫女`——同一张图两种 token，模型会困惑。文档自己承认"text 不解析"，但**没回答"输入框 @ 的图在表格模式下怎么被正确引用"**。

**建议**：表格模式下，对 `text` 段也走一次 `resolve()`（与 `currentTable` / `rowTexts` 共享同一 resolver），或明确约定"表格模式下输入框不解析 @、且 `attachments` 不并入本轮 allImages"，二选一消除歧义。

### L2. R1「按 id 跨源去重」不可行，且现状去重在 normalize 之前 —— 严重

R1 把"按 id 跨源去重"与"normalize 之后按 url 去重"并列，但前者对 R1 的具体场景（表格 vs 画布节点）**根本不成立**：

- 表格芯片 `id` = `Asset.id`（§4 铁律 2）；
- `pendingImageNodes`（画布节点附件）用的是 `nodeId`（`AgentPanel.tsx:868-875`），命名空间不同，无法用同一 id 去重。

唯一可行的只有"**归一化后按 url 去重**"。但现状去重发生在 `normalizeImageUrlForSend` **之前**（见上 `AgentPanel.tsx:838-840`），而 `thumbnailToOriginal` 还原只在 `normalizeImageUrlForSend` 内部（`imageUrl.ts:300-307`）。若不复盘，按文档落地仍会"表格图 + 画布节点图"各发一张。

**建议**：
1. 删除 R1 中"按 id 跨源去重"这一条（对表格 vs 画布节点不成立）；
2. 明确"跨源只能按归一化后 url 去重"，并把 `AgentPanel` 现状的"预归一去重"改为"归一后去重"。

> 补充实测提示：芯片 `thumb` 字段存的是 `asset.url`（原始 `/files/...`，见 `promptChips.autoLinkAssetsByName:374`、`assetStore.addAssets`），与 `attachments` 同源，故 asset-vs-asset 往往能去重；但 asset-vs-画布节点、以及 `blob:/data:` 素材仍会撞 R1，故"实施前实测"是必要的。

### L3. §5.5 失效占位 vs §4「复用 promptChips 能力」的张力 —— 中

`promptChips.renderPromptToNodes` 显示缩略图时**优先用 `metaMap`（当前素材列表）取最新 url**，字符串里的 url 视为旧值：

```216:220:src/components/base/prompt/promptChips.ts
const label = (meta && meta.label ...) || match[2];
const url = match[3] ? decodeThumb(match[3]) : meta?.url || '';
```

表格渲染若复用 `renderPromptToNodes`，素材被删（metaMap 无该 id）就只剩字符串 url（可能 404），而 §5.5 的"灰图占位"恰恰依赖字符串自带 url——与"复用 metaMap"相反。文档 §5.1 没说清表格渲染**到底复用 `renderPromptToNodes` 还是自己解析芯片**。

**建议**：§5.1 明确"表格渲染不依赖 metaMap 取 url，直接用芯片串自带的 url（与输入框语义不同）"，或单列一个不查 metaMap 的表格专用渲染分支。

### L4. D4 防覆盖的落点 / 触发过宽 —— 中

`buildPreviewResult` 现有语义已是"未提及列保留原值"，带图列只要 AI 不提就天然保住：

```617:618:src/components/agent/assistantTable/assistantTable.ts
for (const col of resultCols) {
  const v = colValue(obj, col);
  if (v !== undefined) nextRows[ti].values[col.id] = v;  // 只覆盖提及列
}
```

所以 D4 实际只补"**AI 提了带图列**"这一窄场景。文档写成"含芯片单元格不被纯文本覆盖"偏宽，且没说清兜底做在 `buildPreviewResult` 内部加 chip-aware 逻辑，还是调用方后处理（需拿原行值比对合并结果）。

**建议**：把 D4 精确写为"若原单元格含芯片且 AI 返回新值不含芯片（即 AI 重写了该列）→ 丢弃 AI 新值、保留原芯片"，并明确落在 `buildPreviewResult` 的 update 合并之后（用原始行值比对合并结果）。

---

## 二、未确定 / 待拍板项

| 编号 | 项 | 说明 | 状态 |
| --- | --- | --- | --- |
| U1 | §6.5 频次口径 | 降级"频次高"按"出现次数"还是"被多少行引用"未定义 | 待定 |
| U2 | §6.4 vs R1 没串起来 | 跨源发重图会把某些素材翻倍，使实际 N 突破"N 与行数无关"的乐观上限 | 建议补一句 |
| U3 | 新文件 `assistantTablePrompt.ts` | 命名是否过 `check:arch` 的 base 分层门禁未确认（现有纯函数在 `assistantTable.ts`） | 待确认 |
| U4 | §11 E1 快照投画布后 | canvas 侧对芯片串的防覆盖未考虑（与 D4 同根，属延伸范围） | 待定 / 本期不做 |
| — | R2 / R3 / R4 | R2 已由 §5.5 回答；R3 / R4 已裁定"本期不做" | 不算未决 |

---

## 三、文档引用核对（准 / 偏）

| 文档引用 | 实际 | 判定 |
| --- | --- | --- |
| `promptChips.ts:41` `PROMPT_CHIP_RE` | 同 | ✅ |
| `promptChips.ts:124` `serializeDOM` | 同 | ✅ |
| `promptChips.ts:262-264` seedance `[img=图片N]` | 同（`:264`） | ✅ |
| `agentAttachments.ts:63` `buildRefCatalog` | 同 | ✅ |
| `AgentPanel.tsx:848~872` 发送装配 | 同（`:848-876`） | ✅ |
| `AgentPanel.tsx:1886` `buildTableSnapshotText` | 同 | ✅ |
| `assistantTable.ts:375` `rowToText` | 同 | ✅ |
| `imageUrl.ts:358` `normalizeImageUrlForSend` | 实际 `:300` | ⚠️ 行号偏（差 58） |
| `imageUrl.ts:58` `MAX_SEND_DIM` | 同 | ✅ |
| `assetStore.ts:35` `Asset` / `useAssets()` | 同（`:35` / `:462`） | ✅ |
| `useCanvasAgentTools.ts:395` 白名单 5 类 | 路径实为 `src/components/agent/canvas/useCanvasAgentTools.ts`，`:395` `ALLOWED_TYPES` 确为 5 类 | ⚠️ 路径少写 `canvas/` 层，行号准 |
| `useConnectedInputs.ts:380` G2 校验 / `scriptBoxNode` | 同（`:96` / `:380`） | ✅ |

---

## 四、措辞修正建议

- §4 称芯片里存"缩略图 URL"，但 `thumb` 字段实际存 `asset.url`（原始 `/files/`，非缩略图端点）。称"缩略图 URL"易误导，且与 R1"存的是缩略图 URL"的前提直接相关——建议改为"素材原始 url"。
- §6.4 与 R1 应互引，说明跨源发重图会放大真实 N。

---

## 五、落地优先级建议

1. **必改**：L1（同轮引用一致）、L2（删"按 id 跨源"、改为归一化后按 url 去重并改 `AgentPanel` 预归一去重）。
2. **落地前定**：L3（渲染复用与否）、L4（D4 精确落点）、U1（频次口径）、U3（新文件门禁）。
3. **顺手修**：第三节行号 / 路径偏差、第四节措辞。

> 不修 L1 / L2，按文档落地会出现"AI 看错图 / 同一张图发两次"。

---

# 第二轮审计（2026-09-08 复核 · 逐条回读真源）

> 复核方式：对前次每条 L/U 结论重新回读代码，并补充核对 `PromptInput` / `agentConfig` / `package.json` scripts / `safeFileName` / `tests/unit` 布局。
> **总结论：前次 L1 不成立（前提被证伪），L2 结论对但给的解法过重，L3/L4 已有明确落点，U1/U3 可关闭；新发现 7 条（N1~N7），其中 N1 是真正的"落地即错"。**
> 可执行方案已单独成文：`spec/AI-ASSISTANT-TABLE-IMAGE-REF-IMPL.md`。

## A. 对前次结论的处置

| 前次 | 处置 | 依据 |
| --- | --- | --- |
| **L1** text 不解析 → 两套表示 | ❌ **撤销** | `AgentPanel` 输入框是 `<textarea>`（`AgentPanel.tsx:1553`），**不是 `PromptInput`**。全仓 `resolvePromptChips` 调用点只有 4 个画布节点（`ImageGenerate`/`TextGenerate`/`VideoGenerate`/`TemplateNode`）。AgentPanel 链路**根本不产生芯片串**，text 段不解析是唯一正确行为。审计把"画布节点语义"误植到了 AI 面板 |
| **L2** 按 id 跨源去重不可行 | ✅ 成立，但**解法过重** | id 命名空间不同属实（`Asset.id` vs `nodeId`）。但无需把 `handleSend` 改成异步归一化再去重。正解：导出**同步** `canonicalImageKey(url)`（内部复用已存在的 `thumbnailToOriginal` + `toRelativeFileUrl`），去重 key 换掉即可，不动异步流程 |
| **L3** 渲染复用与否 | ✅ **定论** | 表格渲染**不查 metaMap**，一律用芯片串自带 `thumb`。理由：`renderPromptToNodes:218` 是 `match[3] ? decodeThumb : meta?.url`，串自带即优先；表格是用户显式存的数据，不该被当前素材列表改写 |
| **L4** D4 落点/触发过宽 | ✅ **定论** | 落点 = `buildPreviewResult` update 循环（`assistantTable.ts:616-619`）。判定 = `parseChips(prev).length>0 && parseChips(v).length===0 → continue` |
| **U1** 频次口径 | ✅ **关闭** | 不需要"频次"概念。改用**懒分配 + 先解析选中行**——选中行的图天然先占号，其余按首次出现顺序，超限者只留 label |
| **U3** 新文件门禁 | ✅ **关闭** | ① `package.json` scripts **没有** `check:arch`，该门禁不存在；② `src/components/agent/assistantTable/assistantTablePrompt.ts` **已存在**（纯函数层，1.87KB），落点天然合法 |

## B. 新发现（第二轮）

### N1. 编号错位 / 空洞 —— 最严重，按原文档落地必错 🔴

原文档 §6.3 只写"图片追加进 `allImages`"。但若表格引用的素材**已在 `allImages` 里**（画布节点恰好引用了同一素材），正确行为是**复用它的编号**（文本写「参考图1」且不重复发图）；若实施者按字面理解"先追加、再靠 url 去重"，会出现：文本写「参考图4」而目录里它是「参考图1」→ **AI 认错图**，且去重后数组下标前移造成编号空洞。

**解**：resolver 构造时预置 `existing`（已有图的 key→编号），命中即复用编号且不产出新图。见 IMPL §3。

### N2. `PROMPT_CHIP_RE` 是模块级 `/g` 正则，`lastIndex` 跨调用共享

`promptChips.ts:41` 导出的是**同一个 RegExp 对象**。`String.replace(re, fn)` 会自动重置 `lastIndex`（安全）；但实施者为做自定义替换很可能写 `while ((m = PROMPT_CHIP_RE.exec(t)))` —— 一旦别处（如 `renderPromptToNodes:211` 的循环）残留 `lastIndex`，解析结果会**静默丢芯片**。

**解**：新增的 `parseChips()` 内部用 `new RegExp(PROMPT_CHIP_RE.source, 'g')` 建本地副本，并在文件注释里钉死这条。

### N3. `promptChips.ts` 缺「字符串 → 芯片列表」的纯解析出口

铁律 1 禁止手写正则，但表格渲染（React，最好无 `document` 依赖）、resolver、D4 判定**全都需要这个能力**；现有唯一的反序列化出口 `renderPromptToNodes` 返回 `Node[]` 且强依赖 `document`。

**解**：新增 `parseChips(text): ParsedChip[]`（纯、无 DOM），并让 `renderPromptToNodes` 改用它（顺带消除"两处各写一遍 exec 循环"的分叉）。

### N4. label 未净化 `}` / `{` / `@`，会截断芯片

`safeFileName`（`utils.ts:115`）净化的字符集是 `[\\/:*?"<>|]`，**不含 `}`、`{`、`@`**。素材名含 `}`（macOS 允许）→ `@{id:猫}女|url}` 被正则截成 `@{id:猫`… 解析错乱；含 `@{` → 文本里出现伪芯片。

**解**：新增 `buildChipString(id,label,thumb)` 出口，内部对 id/label 额外 `.replace(/[{}|]/g,'_')`；禁止任何地方字符串模板裸拼芯片。

### N5. 表格图若 push 进 `attachments` 会污染会话快照

`attachments` 有 `setCurrentSnapshot`（`:509`）落盘 + `releaseAttachmentUrls`（`:877`）释放。表格图是**每轮按当前表动态算出**的，不属于会话附件。

**解**：只入本轮局部数组（`allImages` 的拷贝），**不 setState**。

### N6. 发送侧 404 未被覆盖（§5.5 只管显示）

素材删除后芯片里的 url 仍会被当图发出。**裁定 D5**：保持 resolver 纯函数、不查 `useAssets()`，照发自带 url；理由——删除是低频、UI 侧已有占位提示、纯函数可单测。风险登记入 R2。

### N7. §5.2 方案 B 与 §5.5 自相矛盾，会静默删用户数据

方案 B 要在浮层里放 `PromptInput`，而 `PromptInput` 有**素材消失清理**（`:281` `refIdsSignature`）——某素材 id 从 `refImages` 消失就删掉对应芯片。这恰恰是 §5.5 声明"表格不适用"的行为，但用了 PromptInput 它就会生效。

**解**：给 `PromptInput` 加 `preserveMissingRefs?: boolean`（默认 `false` 保现状），表格浮层传 `true` 跳过清理。

## C. 事实勘误（第二轮补）

| 项 | 前次/原文 | 实际 |
| --- | --- | --- |
| `normalizeImageUrlForSend` 行号 | 文档写 `:358`，前次说"实际 `:300`" | 两个都在：`:300` 单图版、`:358` **数组版** `normalizeImageUrlsForSend`。文档应写 `:300` |
| §6.4 成本模型 | "前端开销 ≈ N 次 normalize（压到 1920，可能转 base64）" | `/files/` 在 `preferBase64=false`（默认）下**不压缩**，保持相对路径（`:324-327`），压缩在 localTool 出站。前端开销远小于描述 |
| `check:arch` 门禁 | 前次 U3 担心 | 不存在（package.json 无此 script） |
| `PromptInput` 能力 | §5.2 说"几乎零改动" | `refImages` 需 `{id,label,url}`；`portalTarget` 默认 `document.body`（浮层场景合适）；`onChange` 吐的是 `serializeDOM` 芯片串，可直接写回单元格 ✔ |

## D. 修订后的落地优先级

1. **必做（不做必错）**：N1（编号复用）、N2（正则副本）、N3（`parseChips` 出口）、N4（label 净化）。
2. **必做（功能本体）**：IMPL 步骤 3~7。
3. **定稿项**：N5（不入 attachments）、N6（D5 照发）、N7（`preserveMissingRefs`）、L3/L4 落点。
4. **顺手修**：行号、§6.4 措辞、§4「缩略图 URL」→「素材原始 url」。
