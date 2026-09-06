# AI 助手表格 —— 新增功能设计（多行改 + 选行为唯一意图信号）

> **状态：已整合** —— 本文与新功能相关内容已并入 `spec/AI-ASSISTANT-TABLE-IMPLEMENTATION.md`（唯一实施依据）；本文保留为设计背景/证据。
> 状态：对齐定稿，待技术债清理后落地
> 配套文档：`spec/AI-ASSISTANT-TABLE-TECHDEBT.md`（清理清单）、`spec/AI-ASSISTANT-TABLE-PROMPT-DESIGN.md`（AI 协议）

## 1. 背景与问题

现状有两个痛点：

1. **确认写回与预览用两套逻辑**，对同一份 AI JSON 各自重新推导，空行/多行下必然分歧 → 表现即"预览对、点确认却不更新"。
2. **选中态只支持单行**，无法让 AI 一次改多行；"往表格里加新内容"也没有干净的触发方式。

本次要加的两个功能，本质是"让选中态成为唯一意图信号"这一地基上的两个应用：

- **功能一：多行同时修改** —— 用户在左表多选若干行，让 AI 一次性改这几行。
- **功能二：以"选中的行"表达追加** —— 用户想加内容时，自己先建空行、选中它们、给 AI 指路，AI 把内容填进这些行；不需要单独的"追加模式/开关"。

## 2. 设计原则（地基）

- **预览即真相源（预览 = 确认）**：预览时一次性算出"操作后最终表格"并存入 preview 状态；确认只做一件事——把这份结果原样写回，**不再二次推导**。从根上消除"预览≠确认"。
- **选中态是唯一意图信号**：
  - 选中 N 行 + AI 回 N 行 → `update`：第 i 个 AI 行填进选中的第 i 行（有 `_rowIndex` 优先用行号）。
  - 选中 0 行 + AI 回行 → `append`：原样追加到末尾（保留原有行与列宽）。
  - 选中 N 行但 AI 回 M>N 行 → 前 N 行 update，多出的行 append。
  - AI 显式返回全表 → `replace`（按列名映射现有列、保留列宽，不重生成列 id）。
- **列名不完全匹配也不静默丢**：AI 返回的键名对不上现有列名时，作为**新列追加**（先在预览里显示，确认可见）。彻底消灭 `mergeRowFromObj` 的"对不上就 `continue` 静默跳过"。
- **保留现有列 id / 宽度**：任何写回都绝不 `generateId('col')` 重造列，列宽（`width`）不丢。

## 3. 功能一：多行同时修改

| 项 | 设计 |
|---|---|
| 交互 | **Cmd/Ctrl + 点击行** 累加/取消选中（不新增 checkbox 列，改动面最小） |
| 状态 | `selectedRowId: string \| null` → **`selectedRowIds: string[]`**（多选集合） |
| 写回 | AI 返回行按选中顺序（或 `_rowIndex`）**逐行 merge** 到对应选中行；行数不等时多余行追加到末尾 |
| 预览 | 右卡显示"操作后最终整表"（= 确认结果），左表仍为旧态，天然可对比 |
| AI 上下文 | 发送时把选中的多行（行号 + 内容）一起注入，提示"请按选中行逐一返回改动" |

取消选中（单一行或整批）仍走现有"取消选中"入口，清空 `selectedRowIds`。

## 4. 功能二：以"选中的行"表达追加

用户工作流（无需新 UI 元素）：

1. 用户想往表格加内容 → 自己点"加行"建好空行（如 2 行）。
2. 选中这些空行（Cmd/Ctrl 多选）。
3. 对 AI 说"给这两行续写…"。
4. AI 返回对应行内容 → 确认填进选中的空行。

这样"改"与"加"共用同一套机制，**不需要单独的追加语义/开关**，架构最干净，也不会让 AI 去猜"该改还是该加"。

兜底兼容：若用户**未选中任何行**却让 AI 改表，且 AI 返回了行，则按 `append` 处理（末尾追加），不破坏现有数据。

## 5. 统一架构（两个功能共用地基）

### 5.1 预览状态新形状

```ts
interface TableWorkspacePreview {
  json: AssistantTableJson;
  messageId: unknown;
  selectedRowIds: string[];          // 发消息那一刻冻结的选中（含多选）
  resultRows: TableRow[];            // 操作后"最终的全部行"（预览=确认）
  resultCols: TableColumn[];         // 操作后列（保留原列 id/宽度，新增列才追加）
  opKind: 'update' | 'append' | 'replace';
}
```

### 5.2 纯函数：`buildPreviewResult(sb, json, selectedRowIds)`

产出 `{ resultRows, resultCols, opKind }`，即"操作后最终表格"。规则见 §2 意图判定。预览 UI 与确认写回**共用这一份结果**。

### 5.3 `confirmTablePreview()` 退化为一行写入

```ts
setCurrentAssistantTable({ columns: p.resultCols, rows: p.resultRows });
// + globalStyle 处理 + markMessageTableResolved('confirmed') + 清 preview
```

删除 `_rowIndex` / `mergeRowFromObj` / `jsonToSb` 在确认路径上的二次推导（保留或迁移到 `buildPreviewResult` 内）。

## 6. 验收标准

1. 选中一个**空行** + AI 续写 → 确认后内容填进该空行（不再"纹丝不动"）。
2. 选中**两行** + AI 改这两行 → 确认后两行都更新，未选中的行不受影响。
3. **未选中**任何行 + AI 返回行 → 确认后末尾追加，原有 44 行与列宽不丢。
4. AI 返回的**列名与现有不一致** → 新列出现在预览中，确认后被加入（不再静默丢弃）。
5. 预览所见 == 确认结果（任意场景）。

## 7. 落地前置

须先清理 `spec/AI-ASSISTANT-TABLE-TECHDEBT.md` 中 A 级技术债（尤其是"预览/确认双逻辑""列名静默跳过""列 id 重生成"），再按 §5 改造。
