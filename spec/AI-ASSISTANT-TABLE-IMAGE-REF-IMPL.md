# AI 助手表格 —— 附件列（引用素材）· 可执行实施方案

> **状态：待批准（2026-09-08 · v2 附加列方案）**
> 上游：`AI-ASSISTANT-TABLE-IMAGE-REF.md`（原「单元格芯片」方案，**已被本文取代**）
> + `AI-ASSISTANT-TABLE-IMAGE-REF-AUDIT.md`（两轮审计，结论仍适用：芯片方案的风险点本文大部分已消除）。
> **v2 核心变化**：不再把素材塞进单元格字符串。改为**列分两种**——普通列 / 附件列，
> 二者共用 `columns` 数组与全部列 UI，只在内部 `kind` 上区分。

---

## 0. 为什么换方案（一句话）

原方案把 `@{id:label|url}` 芯片串塞进 `values[colId]`，导致：AI 改行会弄丢图（要 D4 兜底）、
芯片有两种形态与两种解释语义、`PromptInput` 会静默删芯片、要新写正则解析……
**这些复杂度全部源于「把异构内容塞进字符串」**。v2 不塞：素材以 id 列表存在行的平行字段里。

---

## 1. 数据模型（核心）

### 1.1 列：加 `kind` 字段，复用 `columns`

```ts
export type CellValue = string;

export interface TableColumn {
  id: string;
  label: string;
  width?: number;
  /** 附件列标记。缺省 / 旧数据 = 普通文本列（向后兼容，无需迁移） */
  kind?: 'assets';
}
```

**关键收益**：附件列仍在 `columns` 数组里 → 列宽拖拽（`useColumnResize`）、增删列
（`addColumn`/`insertColumnAfter`/`deleteColumn`）、重命名（`renameColumn`）、列序拖拽、
表头 UI（现有 `+` / `×` / 拖拽手柄）**全部复用，零改动**。附件列可放任意位置，不限于最左。

### 1.2 行：平行的 `assets` map

```ts
export interface TableRow {
  id: string;
  values: Record<string, CellValue>;
  /** 附件列内容：key = 附件列 colId → 素材库 Asset.id 列表。普通列不出现在此 */
  assets?: Record<string, string[]>;
}
```

附件列一个格子的内容 = **文字（`values[colId]`）+ 素材（`assets[colId]`）**，两者可共存，
满足「既能写文字也能放附件」。

**为什么 `assets` 不塞进 `values`**：`CellValue = string`，且 AI 契约是
`rows: Array<Record<string, string>>`。塞进去 = 重蹈芯片方案覆辙。
`values` 保持纯 string → **契约零改动**。

> ⚠️ **双源一致性是本方案唯一的结构性风险**：附件列的数据分散在 `values` 与 `assets` 两个 map，
> 靠 colId 关联。凡是「动列」的地方都要两处同步 —— 见 §5 风险 R-A1。

---

## 2. 附件列与 AI 的边界

| 项 | 裁定 |
| --- | --- |
| 附件列进 AI 的 `rows`？ | **不进**。`rowToObj` 跳过 `kind==='assets'` 的列 → AI 根本不知道这列存在 |
| AI 能改写附件列吗？ | **不能**（同上，免费获得，无需原方案的 D4 兜底） |
| 附件列发给 AI 吗？ | **发**（这是本功能的目的），但作为**独立段落**，格式与列明显区分 |
| 附件列里的**文字**发吗？ | **发**，同上段落 |

**发送格式**（`‖` + 缩进，AI 不会误认作列名；`rowToText` 输出时追加）：

```
第2行：角色=猫女、风格=皮克斯风大眼圆脸
  ‖角色图：参考图3(猫女)、参考图4(化妆台)
  ‖备注：主角，第一幕登场
```

前端兜底：`buildPreviewResult` 的 C3 列合并处，**过滤以 `‖` 开头的键**（一行代码），
防止 AI 偶尔把它当列名返回而生成垃圾列。

---

## 3. 改动清单（9 步）

| # | 文件 | 改动 | 风险 |
| --- | --- | --- | --- |
| 1 | `assistantTable.ts` | `TableColumn.kind` / `TableRow.assets` 类型 | 低 |
| 2 | `assistantTable.ts` | `normalizeAssistantTable` 放行新字段（另修：复制 tab 丢数据 bug） | 中 |
| 3 | `assistantTable.ts` | `rowToObj` / `rowToText` 跳过或特殊输出附件列 | 中 |
| 4 | `assistantTable.ts` | `deleteColumn` / `copyTab` / `copyRowsToTab` 同步 `assets` | **中高**（双源一致性） |
| 5 | `agent/` 新文件 | `createAssetRefResolver`（编号分配，纯函数） | 低 |
| 6 | `AgentPanel.tsx` | 发送装配：附件列的图追加进 `allImages` | **中**（主链路） |
| 7 | `TableGrid.tsx` | `cells()` 内一处分支：`kind==='assets'` → `<AssetCell>` | 低 |
| 8 | 新 `AssetCell.tsx` | 缩略图流 + `+` 选素材 + 失效占位 | 低 |
| 9 | `useColumnResize` / 表头 | 附件列列头加图标 + tooltip「不发给 AI」 | 低 |

步骤 4 与 6 是风险点：**先做 5 及其单测**，步骤 6 加开关 `TABLE_ASSET_SEND` 便于回退。

---

## 4. 各步骤要点

### 4.1 `normalizeAssistantTable`（必须显式放行）

现有实现「行归一：values 只保留已声明列的字符串值；extra 忽略」（:115）——
**`assets` 会被当成额外字段丢掉**。必须在此显式重建：

```ts
const assets: Record<string, string[]> = {};
const rawAssets = (rw.assets && typeof rw.assets === 'object' ? rw.assets : {}) as Record<string, unknown>;
for (const col of columns) {
  if (col.kind !== 'assets') continue;
  const list = Array.isArray(rawAssets[col.id]) ? rawAssets[col.id] : [];
  assets[col.id] = list.filter((x) => typeof x === 'string' && x);
}
rows.push({ id: rowId, values, ...(Object.keys(assets).length ? { assets } : {}) });
```

### 4.2 `copyTab`（顺带修现存 bug）

**现存 bug（已实测确认）**：`copyTab` 给列生成了新 id，但 `rows[].values` 仍用旧 colId 作 key
→ 复制出来的表**内容全空**。修复时**同时**重映射 `assets`：

```ts
const idMap = new Map<string, string>();
const columns = src.columns.map((c) => {
  const nid = generateId('col');
  idMap.set(c.id, nid);
  return { ...c, id: nid };
});
const rows = src.rows.map((r) => {
  const values: Record<string, CellValue> = {};
  const assets: Record<string, string[]> = {};
  for (const c of src.columns) {
    const to = idMap.get(c.id);
    if (!to) continue;
    values[to] = r.values?.[c.id] ?? '';
    if (c.kind === 'assets' && r.assets?.[c.id]) assets[to] = r.assets[c.id].slice();
  }
  return { id: generateId('row'), values, ...(Object.keys(assets).length ? { assets } : {}) };
});
```

> 已修（2026-09-08）：`values` 重映射部分已落地，单测已补「副本值与源表一致」断言。
> 本步在此基础上加 `assets` 重映射。

### 4.3 `deleteColumn` / `copyRowsToTab`

- `deleteColumn`：删除列时**必须**清 `rows[].assets[colId]`，否则留孤儿数据（体积 + 语义脏）。
- `copyRowsToTab`（跨表复制行）：现按**列名归一**，需同步复制 `assets` 并按目标表列 id 重映射；
  若目标表同名列是普通列（无素材）→ 素材丢弃（不静默失败，可不计）。

### 4.4 `createAssetRefResolver`（纯函数，替代原 `createTableChipResolver`）

不再解析字符串，输入是 assetId，复杂度只剩编号分配：

```ts
export function createAssetRefResolver(opts: {
  /** 本轮已有图片附件的 canonicalKey，顺序即编号：第 i 项 = 参考图 i+1 */
  existingKeys: string[];
  /** assetId → 可发送 url；查不到（素材已删）→ 不发图 */
  urlOf: (assetId: string) => string | undefined;
  labelOf: (assetId: string) => string;
  limit?: number; // 默认 10
}): {
  ref(assetId: string): string;            // → "参考图3(猫女)" | "「猫女」"（超限/已删）
  readonly images: Array<{ url: string; label: string }>;
  readonly overflow: number;
};
```

内部：一张 Map（key → 编号）；key = `canonicalImageKey(url)`，命中 `existingKeys` 则**复用其编号且不发图**。

**已消除**：正则解析、`lastIndex` 陷阱、label 净化、芯片两种形态、**`urlOf` 判活天然覆盖已删素材**。

### 4.5 `AgentPanel.tsx` 发送装配（:836-876）

同 v1 步骤 4，但输入从"解析文本"改为"遍历附件列"：

1. `baseImages` 去重 key 换 `canonicalImageKey`（顺带修现存 pending/attachments 漏去重）；
2. `resolver = createAssetRefResolver({ existingKeys: baseImages.map(im => canonicalImageKey(im.url)), ... })`；
3. **先遍历选中行**的附件列占号（懒分配 → 选中行优先），再遍历整表；
4. `resolver.images` push 进 `allImages`（局部数组，**不 setState**，避免污染会话快照）；
5. `overflow > 0` → 文末追加「另有 N 张图未附」。

### 4.6 `TableGrid.tsx`（一处分支）

`cells(row)` 内（:96-131），按 `col.kind` 分流：

```tsx
if (col.kind === 'assets') {
  return <td key={col.id} className={tdClass} onMouseDown={...} onClick={...}>
    <AssetCell
      text={value}
      assetIds={row.assets?.[col.id] ?? []}
      editing={isEditing}
      onChangeText={(v) => onCellChange(row.id, col.id, v)}
      onChangeAssets={(ids) => onAssetsChange(row.id, col.id, ids)}
      onCommit={() => onCellCommit(row.id, col.id, value)}
    />
  </td>;
}
```

⚠️ 附件列的 `<td>` **仍挂 `onCellPointerDown`**（与普通列一致，选区坐标统一）——
这与 v1「独立区域不挂事件」不同：因为附件列现在**就是** `columns` 的一员，选区必须包含它，
否则矩形选区会出现空洞。这是复用 columns 带来的**行为统一**（好事）。

### 4.7 `AssetCell.tsx`

- 非编辑态：`{文字}` + 缩略图流（`LazyImage`，url 查 `useAssets()`），默认前 3 张 + `+N` 折叠；
- 编辑态：`<textarea>` 改文字 + 下方素材区（`+` 打开素材库选择器，可删）；
- 素材被删 → 灰底破图占位 + `title="素材已删除"`；
- 缩略图 url **当前查 `useAssets()`**（不存 url）→ 天然无死链、改名自动跟随。

---

## 5. 风险与收益（诚实评估）

### 5.1 收益（相对原芯片方案）

| 原风险 | v2 |
| --- | --- |
| §7 D4 防覆盖 | **免费**（附件列不进 `rows`） |
| N7 PromptInput 静默删芯片 | **不存在**（不碰 PromptInput） |
| L3/D9 芯片两种语义、改名跟不跟随 | **不存在** |
| N3/N4 `parseChips`、label 净化 | **不存在** |
| N2 正则 `lastIndex` | **不存在** |
| R1 跨源去重 / R2 死链 / N6 判活 | **大幅简化**（按 assetId + 实时查 url） |
| UI 成本 | **接近零**（复用 `columns` 全套） |

### 5.2 风险（**不是只有收益**）

| 编号 | 风险 | 等级 | 说明 |
| --- | --- | --- | --- |
| **R-A1** | **双源一致性** | 🔴 主要风险 | `values` 与 `assets` 靠 colId 关联。`deleteColumn` / `copyTab` / `copyRowsToTab` / `normalize` 四处都要同步，**漏一处就是静默数据丢失**。刚修的 `copyTab` bug 正是这一类——说明这地方确实容易漏 |
| **R-A2** | `normalizeAssistantTable` 丢字段 | 🟠 | 现有逻辑「extra 忽略」，不显式放行则落盘丢失。同 R-A1 性质 |
| **R-A3** | AI 看不见附件列的文字 | 🟡 体验 | 用户在附件列写了字，AI 完全不知道（整列不进 `rows`）。需列头图标 + tooltip「本列不发给 AI」提示 |
| **R-A4** | 粘贴 / CSV 导入无法还原素材 | 🟡 | 外部文本只能重建文字部分，素材 id 丢失。跨表复制行（`copyRowsToTab`）需显式处理 |
| **R-A5** | 编号系统（offset/limit/overflow） | 🟠 固有 | 「让 AI 看表格里的图」的固有成本，任何方案都躲不掉；改错 = AI 认错图，且测试难覆盖 |
| **R-A6** | 列类型不可切换 | 🟡 | 建议**不支持**普通列↔附件列互转（新建时定类型），否则 `values` 里的旧文字语义不明 |

### 5.3 结论

**收益 > 风险，但远不是「只有收益」。**
相对原方案风险等级从「中高」降到「**低~中**」，且剩余风险的**主要成分（R-A1/A2）是同一类：
「动列时忘了同步另一个 map」** —— 这类问题可以靠**集中收口**根治（见 §6）。

---

## 6. 收口建议（把 R-A1/A2 压到最低）

**不要在 4 个函数里各写一遍 assets 同步**，而是收口成两个纯函数：

```ts
/** 列 id 重映射：一次性同步 values 与 assets（copyTab 用） */
function remapRowColumns(row: TableRow, idMap: Map<string,string>, srcCols: TableColumn[]): TableRow;

/** 丢弃某列在行上的全部痕迹（deleteColumn 用） */
function stripColumnFromRow(row: TableRow, colId: string): TableRow;
```

所有「动列」的地方**只准**调这两个函数，禁止就地手写。
配合单测：对每个动列函数都断言「`assets` 的 key 集合 ⊆ 当前附件列 id 集合」（不变量校验）。

---

## 7. 验收

1. 新增附件列 → 选素材 → 显示缩略图；文字与素材可共存。
2. 同一素材被多行引用 → 附件只有 1 张，多行文本编号相同。
3. 输入框已有 2 张图 → 表格首图编号「参考图3」，与 `buildRefCatalog` 一致。
4. 表格引用的素材已在输入框附件里 → **不重复发图**，复用其编号。
5. AI 改行（含附件列所在行）→ 附件列的素材与文字**都不被改写**。
6. 素材被删 → 灰图占位，不崩；发送时**不发该图**。
7. **复制标签页 → 副本内容与源表完全一致**（含附件）。
8. **删除附件列 → 行上不残留孤儿 `assets`**。
9. 全表无附件列 → 发送行为与现状完全一致（回归）。
10. 附件列无素材 → 与现状一致（回归）。

## 8. 发版前自检

- [ ] `values` 仍是 `Record<string, string>`，AI 契约零改动
- [ ] 所有「动列」函数走 `remapRowColumns` / `stripColumnFromRow`，无散落的 assets 处理
- [ ] 单测含「`assets` key ⊆ 附件列 id」不变量
- [ ] `normalizeAssistantTable` 已显式放行 `assets`
- [ ] 附件列不进 `rows`，且 `‖` 开头的键被过滤
- [ ] `TABLE_ASSET_SEND` 开关可一键回退
