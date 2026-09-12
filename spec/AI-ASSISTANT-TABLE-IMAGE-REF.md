# AI 助手表格 —— 图片引用（@素材）方案

> **状态：`提案·未开工`（2026-09-08 起草）**
> 面向：表格图片能力的实施者 / 后续维护者。
> 用途：定义「表格单元格引用素材库图片」的存储、渲染、发送三层设计，以及 AI 侧的行为边界。
> **本文是方案，不是现状描述。未经批准不得开工。**
>
> 关联代码（真源，改前先读）：
>   - `src/components/base/prompt/promptChips.ts` → `PROMPT_CHIP_RE`、`resolvePromptChips`、`buildChipEl`
>   - `src/components/agent/assistantTable/CellEditor.tsx` → 单元格双态渲染
>   - `src/components/panels/AgentPanel.tsx` → `buildTableSnapshotText`（:1886）、发送装配（:848~872）
>   - `src/components/agent/assistantTable/assistantTable.ts` → `rowToText`（:375）、`buildPreviewResult`
>   - `src/components/agent/runtime/agentAttachments.ts` → `buildRefCatalog`（:63）
>   - `src/components/base/utils/imageUrl.ts` → `normalizeImageUrlForSend`（:358）、`MAX_SEND_DIM`（:58）
>   - `src/components/base/store/assetStore.ts` → `Asset`（:35）、`useAssets()`
>
> 关联文档：`AI-ASSISTANT-TABLE-JSON-CONTRACT.md`（输出契约，**本方案不改它**）、
> `AI-ASSISTANT-TABLE-INTERACTION-MODEL.md`（单元格交互模型）

---

## 一、目标与范围

### 1.1 要解决什么

用户希望表格单元格里能放**素材库图片的引用**，而不是只能放文字：

- 输入 `@` 弹出素材候选，选中即插入（与 `PromptInput` 体验一致）；
- 单元格里能**看到缩略图**，不用看冰冷的文件名；
- **AI 能看见这些图**：发表格给 AI 时，把被引用的图片一并发出去。

典型场景：分镜表里「角色」列引用 `@猫女`、`@化妆台`，让 AI 照着这些图写画面描述或生图提示词。

### 1.2 边界（明确不做）

| 项 | 裁定 | 理由 |
| --- | --- | --- |
| **AI 往单元格里写图** | ❌ 不做 | 用户裁定：AI 只当「看图的人」。AI 返回值一律是字符串，它拿不到素材 id，硬要它生成芯片串等于让它编造 id |
| 改 JSON 输出契约 | ❌ 不改 | 承接上条：值仍为字符串，契约 `rows: Array<Record<string, string>>` 一字不动 |
| 改表格数据模型 | ❌ 不改 | 仍为 `TableRow.values: Record<colId, string>`，图片以芯片串形式存在字符串里 |
| 单元格内嵌 contentEditable | ❌ 不做 | 见 §5.2 方案权衡 |
| 上传/管理素材 | ❌ 不做 | 复用现有素材库，本方案只消费不生产 |

---

## 二、现状：为什么现在放不了

三条硬约束，逐条对应下文的解法：

1. **渲染层**：`CellEditor` 只有两态——非编辑态是 `<div>{value}</div>`，编辑态是 `<textarea>`，没有任何 `<img>` 分支。

```54:56:src/components/agent/assistantTable/CellEditor.tsx
  if (!editing) {
    return <div className="cell cell-view">{value}</div>;
  }
```

2. **存储层**：JSON 契约把单元格值钉死为文本，解析时一切值被 `String()` 化（见 `AI-ASSISTANT-TABLE-JSON-CONTRACT.md` §3.3）。

3. **发送层**：`buildTableSnapshotText` / `rowToText` 产出的是**纯文本快照**，图片信息在转文本时就丢了；`attach` 只取输入框的参考图，与表格无关。

---

## 三、设计总览

```
存储：单元格字符串里存芯片  @{asset_12:猫女|http://.../thumb}
        ↓（复用 promptChips 现成协议，零新格式）
渲染：选中态 → 缩略图芯片；双击 → 浮层 PromptInput 编辑
        ↓
发送：AgentPanel 表格分支 → resolveTableChips(表格文本)
        ├→ 文本：芯片替换为「参考图N(猫女)」占位
        └→ 图片：url 追加进 allImages → send(text, attach)
```

三层互不耦合：**存的是字符串**（数据模型不变）、**看的是芯片**（渲染层加分支）、**发的是附件**（发送层加一步解析）。

---

## 四、存储层：复用 `@{id:label|thumb}` 芯片协议

**不发明新格式**，直接用 `PromptInput` 已在用的芯片串：

```41:41:src/components/base/prompt/promptChips.ts
export const PROMPT_CHIP_RE: RegExp = /@\{([^:]+):([^|}]*)(?:\|([^}]+))?\}/g;
```

选中它的理由（不是图省事，是四条实打实的收益）：

1. **数据模型零改动**：芯片是字符串，塞进 `values[colId]` 即可，表格层无感。
2. **缩略图 URL 自带在串里**，`serializeDOM` 会把它编码进去——刷新/重建/跨会话不丢缩略图，不依赖素材列表还活着：

```124:124:src/components/base/prompt/promptChips.ts
      result += thumb ? `@{${id}:${label}|${encodeThumb(thumb)}}` : `@{${id}:${label}}`;
```

3. **复制/粘贴/查找替换/导出 CSV** 天然是纯文本，不引入横穿全表的异构对象。
4. **向后兼容**：旧数据是纯文本，`PROMPT_CHIP_RE` 匹配不到就原样显示，不崩。

### 铁律

1. **禁止在表格里手写 `@{...}` 正则**。解析一律走 `promptChips.ts` 的导出（该文件的头注释已声明「唯一入口」）。新增能力也加在该文件内。
2. 芯片的 `id` 一律取**素材库 `Asset.id`**（`assetStore.ts:35`），不使用画布节点 id——节点会随删除失效，落进表格即死链。
3. `label` 取 `Asset.name` **剥掉扩展名**（素材库 name 带后缀，如 `赛博朋克夜景.png`；已有 `safeAssetBase()` 可复用）。

---

## 五、UI 层

### 5.1 渲染：只在「选中态」渲染缩略图

在 `CellEditor` 的**非编辑态**分支加一层：若值含芯片 → 渲染缩略图芯片流；否则仍走现有 `<div>{value}</div>`。

- 缩略图组件用 `LazyImage`（`AssetLibrary` 已在用），避免百行表格打出几百个 `<img>`。
- 一行内多芯片需按列宽流式换行；列宽可拖拽，不能写死尺寸。

### 5.2 编辑：格子只读 + 浮层编辑（方案 B）

| 方案 | 判断 |
| --- | --- |
| A. `<td>` 内嵌 contentEditable | ❌ 与现有**矩形选区**（`onCellPointerDown` + `range`）、方向键/Enter/Tab 导航、`grow` 自动撑高、复制粘贴全面冲突，等于重写 `TableGrid` 交互层 |
| **B. 格子只读展示芯片，双击打开浮层，浮层里放现成 `PromptInput`** | ✅ **采纳** |
| C. 编辑态 textarea 直接显示 `@{...}` 源码 | ❌ 难看且易被改坏 |

方案 B 的核心收益：`PromptInput` 的全套能力**白拿**——@ 候选弹层、打字即转芯片、缩略图、改名跟随、素材消失自动清理。它已暴露 `portalTarget` / `onReady` / `refImages` / `refTexts` 接口，接进浮层几乎零改动。

### 5.3 @ 候选来源

现状：`PromptInput` 的素材来自**上游连线**（`refImages={connected.images}`）。
但表格是全局面板（`TableWorkspacePanel` 吸附在 AI 面板左缘），**没有「上游节点」概念**。

> **【已定稿 D1】** 候选 = **仅素材库**（`useAssets()` 过滤 `type==='image'`），不含画布图片节点。
> 理由：素材库 id 稳定，随时能解析回 url；画布节点会随删除失效，落进表格即死链。

### 5.4 一格能放几张

**存储与发送层面无上限**（纯 UI 决定）。

- 展示：默认显示前 **3 张**，超出折叠为 `+N` 气泡，点击展开。
- 理由：行高由 `grow` 自动撑出，图片是固定高度块，无折叠会把行撑爆。

> **【已定稿 D2】** **一格多图**（支持多角度 / 多参考），保留 §5.1 的 `+N` 折叠。

### 5.5 素材失效

素材被删后，芯片里的 thumb URL 会 404。需要**灰色破图占位 + tooltip「素材已删除」**，不能崩、不能渲染成空白格。
（`PromptInput` 的 `refIdsSignature` 清理逻辑是「素材从候选列表消失就删芯片」，那是输入框语义；**表格不适用**——表格里的引用是用户显式存的数据，不能因为素材暂时不在候选列表就被静默删掉。）

---

## 六、发送层：让 AI 看见表格里的图（本方案核心）

### 6.1 现状链路

表格模式下，发送前把「整表快照 + 选中行 + 用户的话」拼进 `finalText`，附件只取输入框的参考图：

```848:872:src/components/panels/AgentPanel.tsx
    if (tableOpen) {
      const parts: string[] = [];
      const currentTable = buildTableSnapshotText(tableData, globalStyle, activeTableName);
      if (currentTable) parts.push(currentTable);
      if (selectedRows.length > 0) {
        const rowTexts = selectedRows.map((r) => {
          const idx = tableData.rows.findIndex((x) => x.id === r.id) + 1;
          return `第${idx}行：${rowToText(tableData, r) || '（空行）'}`;
        });
        parts.push(buildRefineRowsUser(rowTexts, globalStyle, text));
      } else if (text) {
        parts.push(text);
      }
      finalText = parts.filter(Boolean).join('\n\n');
    }
    // 【单入口 · docs/65 M7/M8】一律调 send；direct 由 send 内部第一行分流到直连生图
    //（不再由 UI 分 inputMode 调 send/sendImageMode，发送分支只存在于 send）。
    const attach =
      allImages.length > 0
        ? allImages.map(({ url, nodeId, label, x, y }) => ({
            type: 'image',
            url,
```

图片附件经 `normalizeAttachmentsForSend` → `toImageContentBlocks` 内联，并由 `buildRefCatalog` 生成编号目录：

```63:70:src/components/agent/runtime/agentAttachments.ts
export function buildRefCatalog(imgAtts: SendAttachment[] | null | undefined): string {
  if (!imgAtts || imgAtts.length === 0) return '';
  const lines = ['【本轮参考图顺序（仅作为编号数据）】'];
  imgAtts.forEach((a, i) => {
    lines.push(
      `参考图${i + 1}：${a.label || a.name || `Image${i + 1}`}` +
        (a.nodeId ? `（画布节点 ${a.nodeId}）` : ''),
    );
  });
```

**结论：改动点收敛到 `AgentPanel` 的 `tableOpen` 分支**——`send` 以下的归一化、压缩、内联、编号全都不用碰。

### 6.2 解析器：共享编号空间的 `resolveTableChips`

新增纯函数（建议落在 `assistantTablePrompt.ts`，纯函数层、可单测；内部仍调 `promptChips` 的能力，**不重写正则**）。

职责：把表格文本里的芯片替换成编号占位，并收集去重后的图片。

```ts
// 提案签名（未实现）
function createTableChipResolver(offset: number): {
  resolve(text: string): string;              // 芯片 → 「参考图N(label)」
  readonly images: Array<{ url: string; label: string }>;  // 去重后的图，供追加进 allImages
};
```

三条设计要点：

#### ① 编号必须带 offset，不能从 1 开始（易踩的坑）

`buildRefCatalog` 是**按 attachments 数组顺序**编号的。输入框已有 M 张图占了 `参考图1..M`，表格的图追加在数组末尾，就必须从 `M+1` 开始编号。否则表格里的「参考图1」和输入框的「参考图1」撞车，AI 会认错图。

#### ② 编号跨文本段复用（这是收益，不是问题）

同一素材在不同行出现时**复用同一个 N**：

```
第2行：角色 | 参考图3(猫女) | 皮克斯风大眼圆脸…
第7行：角色 | 参考图3(猫女) | …      ← 同一个 N，不是参考图4
```

AI 因此能直接看出「第 2 行和第 7 行是同一个角色」。所以解析器必须**跨 `currentTable` 与 `rowTexts` 共享同一个 Map**，分两次独立调用会各建一套编号。

#### ③ 措辞对齐对话链路

`resolvePromptChips` 产出的是 seedance 垫图语法 `[img=图片N]`：

```262:264:src/components/base/prompt/promptChips.ts
        // seedance 富文本垫图语法：显式 `[img=图片N]` 声明垫图引用，而非裸词「图片N」，
        // 避免模型把「图片1」当成画面描述词汇而忽略垫图 / 凭空重画。
        return `[img=图片${idx}]`;
```

**表格里不用它**——对话链路的编号目录叫「参考图N」（`buildRefCatalog`），两种措辞并存会让模型懵。表格统一输出 `参考图N(label)`。

### 6.3 处理顺序（避免误伤用户的话）

`buildRefineRowsUser` 会把用户指令 `text` 拼进最终文本。若在拼装**之后**统一解析，用户自己在输入框 @ 的素材会被重复处理一遍。正确顺序：

```
1. currentTable = buildTableSnapshotText(...)  → resolve()
2. rowTexts     = selectedRows.map(rowToText)  → resolve()   ← 同一 resolver
3. buildRefineRowsUser(已解析的 rowTexts, globalStyle, text)  ← text 不解析
4. images 追加到 allImages 末尾（编号 = allImages.length + k）
```

### 6.4 成本模型（重要，别按行数估）

> **❌ 常见误解：40 行 × 每格 2 图 = 80 张图，会爆 context。**
> 这是把「芯片出现次数」当成了「图片张数」。素材库引用是**引用语义**，40 行都引用同一个「猫女」，去重后是 **1 张图**，不是 40 张。

真实成本 = **去重后的唯一素材数 N**，与表格行数基本无关：

- 典型 N = 3~10（角色几个 + 场景几个 + 道具几个）
- 单轮 token ≈ N 张图
- 前端开销 ≈ N 次 `normalizeImageUrlForSend`（压到 `MAX_SEND_DIM=1920`，可能转 base64）
- **累计 = N × 对话轮数**（fresh-task 每轮重发）

去重是现成的：`resolvePromptChips` 内部按 id 去重（`imageKeyToIndex` Map），`AgentPanel` 侧 `allImages` 也按 url 去重过一遍。

### 6.5 作用域与上限

- **作用域**：带**整表**（当前活动 tab）去重后的全部图。
  （曾考虑"只带选中行"以省成本，但基于 §6.4 的修正，该理由不成立；且整表带图能让 AI 看到全表，避免出现"文字里有第 7 行的猫女但图没给"的割裂。）

> **【已定稿 D3】** **整表带图**——带当前活动 tab 去重后的全部图。

- **上限**：软上限 **10 张**（唯一素材数）。
- **超限降级顺序**：选中行的图 → 出现频次高的 → 其余只在文本里保留 `label` 不带图，并在末尾注明「另有 N 张图未附，需要请说明」。
- 更合理的长期做法是**按总量（总像素/字节）而非张数**设限，张数只是粗糙代理——记账，本期不做。

### 6.6 记账项（本期不做）

同一会话内对已发过的 url **缓存压缩结果**（LRU，key = `url + MAX_SEND_DIM`）。
当前每轮重发都会重新压缩 + 重新传一遍，10 张图 × 20 轮是实打实的浪费。等真觉得慢/贵再上。

---

## 七、防覆盖：AI 改行不得弄丢图

**这是"AI 只看不写"能否真正成立的关键。**

契约的 `update` 语义是「命中行只覆盖提及列，未提及列保留原值」——但**如果 AI 改的那一列本身就带图芯片**，它返回的新值里不会有芯片（它不知道 id），写入后图就没了。

两道保险，**都做**：

1. **前端兜底（主要）**：`buildPreviewResult` 的 update 落库前，若原单元格值含芯片、而 AI 新值不含 → 保留原值（或将新文本与芯片合并）。
2. **提示词（辅助）**：`agentConfig.ts` 的 `TABLE_RULES` 补一条——凡单元格出现「参考图N」占位的，原样保留不可改写。

只加提示词不够，模型会忘，必须有前端兜底。

> **【已定稿 D4】** 合并策略 = **① 原值整个保留**（AI 对该格的修改丢弃）。
> 理由：更安全；且按 §1.2 边界，AI 本来就不该改带图的格。

---

## 八、落地清单（按顺序，均需另行批准）

| # | 文件 | 改动 | 风险 |
| --- | --- | --- | --- |
| 1 | `assistantTablePrompt.ts` | 新增 `createTableChipResolver`（纯函数，单测先行） | 低 |
| 2 | `AgentPanel.tsx` `tableOpen` 分支 | 按 §6.3 顺序解析；url 追加进 `allImages`；加 10 张上限与降级 | 中（触摸发送主链路，需回归表格协作全用例） |
| 3 | `assistantTable.ts` update 落库 | 含芯片单元格不被纯文本覆盖 | 中 |
| 4 | `agentConfig.ts` `TABLE_RULES` | 补"参考图占位原样保留" | 低 |
| 5 | `CellEditor.tsx` | 非编辑态加芯片/缩略图渲染分支 | 低 |
| 6 | 新增浮层组件 | 双击格子打开，内嵌 `PromptInput`（候选按 D1 定） | 中（新组件） |
| 7 | 素材失效占位 | 灰图 + tooltip | 低 |

第 2 步风险最高，**必须与第 1 步的单测一起做**，且先在第 2 步加开关便于回退。

---

## 九、风险与未决

| 编号 | 项 | 说明 |
| --- | --- | --- |
| **R1** | **跨源去重可能漏** | 表格芯片存的是**缩略图** URL，画布节点附件是**原图** URL，两者字面不同 → `AgentPanel` 现有的按 url 去重会失效，同一张图可能发两次。需在 normalize 之后去重，或按 id 做跨源去重。**实施前必须实测确认** |
| **R2** | 素材删除后 thumb 404 | 见 §5.5，需占位兜底 |
| **R3** | 每轮重发无缓存 | 见 §6.6，本期不做 |
| **R4** | 表格图无画布坐标 | `attach` 的 `x/y` 字段表格图填不了；`buildRefCatalog` 支持缺省，不影响 |

**已定稿决策（2026-09-08 用户拍板）**

| 编号 | 决策项 | 裁定 |
| --- | --- | --- |
| D1 | @ 候选来源 | 仅素材库（不含画布节点） |
| D2 | 一格几张 | 一格多图 + `+N` 折叠 |
| D3 | 发送作用域 | 整表带图（去重后） |
| D4 | 防覆盖合并策略 | 原值整个保留 |

---

## 十、验收标准

1. 单元格能 `@` 出素材、显示缩略图、双击可在浮层里编辑并写回。
2. 同一素材在多行引用 → 发给 AI 的附件**只有 1 张**，多行文本里编号**相同**。
3. 输入框已有 2 张图时，表格第一张图编号为「参考图3」，与 `buildRefCatalog` 一致。
4. AI 明确指出它能看到表格里的第几张图（人工对话验证）。
5. AI 改某行带图单元格 → 确认写回后**图仍在**。
6. 素材被删除 → 单元格显示失效占位，不崩、不空白。
7. 全表无芯片时，发送链路行为与现状**完全一致**（回归）。

---

## 十一、延伸提案：整表缩略表节点（TableCardNode）

> 目标：解决「逐行『发送到画布』太麻烦」——把**整张表**一次性投到画布，成为一个**只读的小尺寸节点**，
> 只露简洁信息，**每行一个输出端口**可连下游。
> 状态：**设计已定稿（E1~E6 全部拍板），尚未开工**（2026-09-08）。

### 11.1 可行性：有现成先例，不是新发明

`scriptBoxNode`（剧本盒）已经是「一个节点 + 每个分镜一个端口 + 按端口取数据」：

```96:101:src/hooks/useConnectedInputs.ts
  scriptBoxNode: (d, sourceHandle) => {
    const shotId = parseShotHandle(sourceHandle);
    if (!shotId) return undefined;
    const shot = (d.shots || []).find((s) => String(s.id) === String(shotId));
    return { images: shot ? collectAssets(shot, d.assets) : [] };
  },
```

其设计原则（该文件注释原文）可直接照搬：**「下游连哪个镜头就该只拿那个镜头的资产，不能把所有镜头的图都塞下去」**。
另有 `GridSplitNode` 演示了「N 个动态 `<Handle id="cell-N">` 分别定位到各条目」的渲染做法（:758~771、:881~894）。

结论：**技术上完全可行，是既有架构的自然延伸**。

### 11.2 落点（照抄剧本盒模式）

| 环节 | 做法 |
| --- | --- |
| 端口 id | `row-${rowId}`；**前缀常量化**进 `contracts.ts`（对齐 `SHOT_HANDLE_PREFIX`，禁止裸拼字符串），配 `parseRowHandle()` |
| 产出声明 | `NODE_OUTPUTS.tableNode = (d, sourceHandle) => …`，按端口反查该行，返回 `{ texts:[{id,label,text:行文本}], images:[该行引用的素材图] }` |
| 未命中端口 | 返回 `undefined`（= 弃权，交回通用兜底），**不可返回空对象**（会屏蔽兜底——剧本盒注释已明写此为回归点） |
| 节点注册 | `NodePalette` 登记一处即可（`App.tsx` 的 `nodeTypes` 由 `buildNodeTypeComponents()` 单源派生） |
| dev 校验 | `uncoveredOutputNodeTypes()`（useConnectedInputs）扫描 `NODE_TYPES`，未声明产出会 dev warn 且单测红——**必须**在 `SINGLE_OUTPUT_FIELDS`（单 URL）/ `NODE_OUTPUTS`（复合）/ `NO_OUTPUT_NODE_TYPES`（无产出）之一登记（2026-09-12 / TD-02-11 起） |

### 11.3 已定稿设计点（2026-09-08 用户拍板）

| # | 决策项 | 裁定 |
| --- | --- | --- |
| E1 | 数据来源 | **快照**（投放时 copy 进 `node.data`）+ 节点上「从表格同步」按钮手动刷新 |
| E2 | 每行端口输出 | **行文本 + 该行引用的素材图** |
| E3 | 行数多 | **折叠**，默认只露前 N 行（N 建议 8，可调），可展开 |
| E4 | 现有「单行发送到画布」 | 保留（细粒度场景仍需要） |
| E5 | 是否加入 AI `create_node` 白名单 | 暂不加入（白名单现仅 5 类，见 `useCanvasAgentTools.ts:395`；本节点由用户按钮触发） |
| E6 | 多标签页 | **一个节点 = 当前选中的那张表**；不做批量投放，见 §11.4 |

### 11.4 多标签页怎么处理（E6）

**裁定：一个节点 = 一张表 = 当前选中的那张表。**

这不是随手选的，是对齐既有约定。`AI-ASSISTANT-TABLE-TABS.md` §3.8 已定：

> **选中态 = 当前表 = 发给 AI 的那张表**，三者同一，信号只有一个 —— `activeTabId`。
> ❌ 不做"多表同时注入"……一次就一张表（从源头压信息量 —— 用户核心诉求）。

落画布沿用同一信号，心智模型一致：**我当前看哪张，投下去就是哪张**。

| 备选 | 判断 |
| --- | --- |
| **A. 一个节点 = 一个 tab（当前选中）** | ✅ **采纳** |
| B. 一个节点装全部 tab（节点内 tab 切换器） | ❌ 违反 §3.8「一次一张、压信息量」的初衷；且端口 id 被迫复合成 `tabId:rowId`（行 id 还可能在跨表复制后重复） |
| C. A + 提供「投放全部标签页」一次生成 N 个节点 | ❌ **不做**（2026-09-08 拍板） |

**快照字段**：`{ tabId, tabName, columns, rows, globalStyle, capturedAt }`

- 节点标题显示 `tabName`（对齐 §3.7「落画布带表名」）。
- 「同步」按钮按 **tabId** 反查——**不按表名**：改名不影响；删了重建同名也对不上（这本就是正确行为）。
- 端口 id 保持 `row-${rowId}` 即可：一个节点只装一张表，行 id 节点内唯一，无需复合 tabId。

> **【已定稿 · 不做「投放全部标签页」（增强 C）】** —— 2026-09-08 拍板。
> 记录理由以防回潮：
> ① 与 §3.8「一次一张、从源头压信息量」的整体取向一致——批量投放等于把信息量重新铺开；
> ② N 大时画布节点爆炸，收益不抵成本；
> ③ 想投多张就切 tab 投多次，路径已通，**无需新增入口**。

### 11.5 风险

- **R5 端口坐标漂移**：节点内若用滚动/折叠容器，handle 位置变化后须调 `updateNodeInternals()`，否则连线端点与实际端口错位。
- **R6 行 id 变更**：表格行可被删除/重排；下游已连线而 rowId 消失 → 该端口成孤儿。需定「行删除时是否级联删边」。
- **R7 tab 被删除**：节点快照仍可用、已有连线不受影响，但「同步」按钮须禁用 + tooltip「源表已删除」。不可静默失败。

---

## 十二、发版前自检清单

- [ ] 未改 `AI-ASSISTANT-TABLE-JSON-CONTRACT.md`（契约零改动）
- [ ] 未改 `TableRow.values` 的数据形态（仍是 `Record<colId, string>`）
- [ ] 芯片解析只走 `promptChips.ts` 出口，无散落正则
- [ ] 表格编号带 offset，与 `buildRefCatalog` 不撞车
- [ ] 去重按唯一素材生效（不是按出现次数）
- [ ] AI 改行不会弄丢图（前端兜底已生效）
- [ ] 无芯片表格的发送行为无回归
