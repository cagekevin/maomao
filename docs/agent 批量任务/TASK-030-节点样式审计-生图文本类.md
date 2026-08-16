# TASK-030 — 节点样式一致性审计（生图文本类组）

> 本次为「样式一致性审计」，只产出本 md 文档，未改动任何 `src/` 代码。
> 所有行号来自本次实际 `read_file` / 核实，引用格式 `文件路径 L行号`。

## 一、审计基准（对照标准）

- **NodeTitle 默认**：`src/components/NodeTitle.jsx L23` → `mb-1 self-start`，全组统一，无 per-node 偏差。
- **titleRight 定位**：`src/components/base/NodeShell.jsx L212-214` → `absolute right-0 -top-0.5 flex items-center gap-1 nodrag`（基准）。
- **端口大小**：`src/components/CustomHandle.jsx L12` → `variant="large"` 直径 48 / `"small"` 直径 32（基准）。
- **主容器**：`NodeShell.jsx L192` → `bg-surface-raised rounded-xl border shadow-xl`，选中 `border-edge-strong`，常态 hover `border-edge-muted`（基准）。
- **字号 token**：`tailwind.config.js L92-100` → `text-2xs(8)/meta(9)/caption(10)/caption-sm(11)/body-xs(12)/body-sm(13)/base-sm(15)`，**禁止** `text-[10px]`/`text-[12px]`/`text-[14px]` 等裸字号、`#xxx` 裸色值。
  - 说明：本组 4 节点普遍混用 Tailwind 默认灰阶 `text-gray-300/400/500/700` 而非纯语义 `text-body/secondary/muted/faint` token，但 `NODE-DESIGN-SPEC.md §〇` 文字层级示例本身即用 `text-gray-400`，且全组一致，故**不单列为此维度偏离**，仅在「裸字号 `text-[Npx]` / 裸 hex `#xxx`」时才记为偏离。
- **下拉形态**：`NODE-DESIGN-SPEC.md §二` → 统一 `absolute bottom-full ... bg-surface-1 border-edge rounded-lg shadow-xl ... z-popover`（z-popover=`50`）；多选模型用 `ModelSelect`；提示词输入复用 `PromptInput`。
- **分段按钮**：`NODE-DESIGN-SPEC.md §二` → 选中 `bg-blue-500/15 border-blue-500/60 text-blue-300`，未选 `bg-surface-hover border-edge text-gray-400`。
- **hover/选中**：§〇 → 按钮 `hover:bg-surface-hover + hover:text-white + hover:border-edge`；主操作优先语义蓝而非裸白底。

---

## 二、差异汇总表（本组 4 节点 × 8 维度）

| 节点文件 | 标题距离 | 右上角 | 下拉/select | 端口 | 底色边框 | 字号颜色 | 主显示区 | hover/选中态 |
|---|---|---|---|---|---|---|---|---|
| PromptNode.jsx | 一致(NodeTitle L23) | 一致(无 titleRight) | 一致(ModelSelect L375 + 统一下拉 L357) | 一致(large L278) | 一致(shell L192) | 一致(token) | 一致(flex-1 L288) | 一致(hover L352) |
| TextNode.jsx | 一致(NodeTitle L23) | 一致(无 titleRight) | 一致(ModelSelect L342) | 一致(small L227) | 一致(shell L192) | **偏离: textarea 裸字号/裸色 L287** | 一致(flex-1 L242) | 一致(hover L336) |
| DiscountVideoNode.jsx | 一致(NodeTitle L23) | 一致(无 titleRight) | **偏离: 手写下拉非 ModelSelect/PromptInput L287-355** | 一致(large area-fixed L218) | 一致(shell L192) | **偏离: text-gray-200 裸色 L292 + 选中态 bg-surface-3 L326** | 一致(flex-1 L232) | 一致(hover L313) |
| FaceMosaicNode.jsx | 一致(NodeTitle L23) | 一致(无 titleRight) | **偏离: 分段按钮样式错 L213 + 裸字号 select L221/229** | 一致(small L169) | 一致(shell L192) | **偏离: 裸字号 text-[10/12px] L221/229/246/283/291 + 裸 hex #141414 L291(同源)** | **偏离: 无独立主显示区/无 ExpandablePanel L176** | 一致(上传/手动按钮 hover L275/283；AI打码白底与基座 GenerateButton 同源 L291) |

> 单元格：`一致` / `偏离: 描述(L行号)`。

---

## 三、详细差异清单

### TextNode.jsx 字号颜色（textarea 裸字号 + 裸色值）
- **基准**：§〇 禁止裸字号/裸色值；节点文本区应使用 `text-body-xs`/`text-body` + `text-secondary` 等 token。
- **实际**：`src/components/TextNode.jsx L287`：
  ```jsx
  style={{ fontSize: '14px', color: '#a1a1aa' }}
  ```
- **偏离描述**：直接写死 `fontSize:14px`（裸字号，违反 §〇）与 `color:#a1a1aa`（裸 hex，绕过 `text-secondary(#aaa)`/`text-body(#ccc)` token）。大眼与其它节点文字观感微差，且主题切换/语义调色时不会跟随 token。

### DiscountVideoNode.jsx 下拉/select（手写下拉，未复用基座）
- **基准**：§二 多选模型用 `ModelSelect`；提示词输入复用 `PromptInput`；下拉统一 `bg-surface-1 border-edge rounded-lg shadow-xl z-popover`。
- **实际**：`src/components/DiscountVideoNode.jsx L287-304` 手写 textarea（非 `PromptInput`，无 @素材弹层）；L311-348 手写比例/分辨率/时长下拉按钮（`Settings` icon + 手写菜单），未使用 `ModelSelect` 或统一下拉 class。
- **偏离描述**：① 提示词框失去 `PromptInput` 的 @素材提及能力，与本组其它 3 节点能力不一致；② 比例菜单是自创控件，触发按钮样式（`bg-transparent hover:bg-surface-hover`，L313）虽接近 ModelSelect 按钮，但面板内选项选中态与 PromptNode 不同（见下）。

### DiscountVideoNode.jsx 字号颜色（裸色 + 选中态不一致）
- **基准**：文字用 token（如 `text-gray-300`→应 `text-secondary`/`text-body`，规范更建议 `text-body`）；下拉选项选中态统一 `bg-surface-hover-strong border-edge-strong text-white`（见 PromptNode L360/364/368）。
- **实际**：
  - `src/components/DiscountVideoNode.jsx L292`：`className="... text-base-sm text-gray-200 ..."` —— `text-base-sm` (15px) 是合法 token，但 `text-gray-200` 是裸 Tailwind 灰阶，非语义 token。
  - `src/components/DiscountVideoNode.jsx L326/334/342`：选项选中态用 `bg-surface-3 text-white`（surface-3=#444），未选 `bg-surface-raised text-gray-400 hover:bg-surface-hover`。
- **偏离描述**：与 PromptNode 同位置选中态（`bg-surface-hover-strong border-edge-strong text-white`）不一致——PromptNode 用 hover-strong(#333)+edge-strong 描边，DiscountVideo 用 surface-3(#444)无描边。用户细看会发现同是「下拉里的选中项」高亮颜色/描边不同。

### FaceMosaicNode.jsx 下拉/select（分段按钮样式错 + 裸字号）
- **基准**：§二 分段按钮选中 `bg-blue-500/15 border-blue-500/60 text-blue-300`，未选 `bg-surface-hover border-edge text-gray-400 hover:text-white`。
- **实际**：`src/components/FaceMosaicNode.jsx L213`：
  ```jsx
  className={`... ${mode === m.mode ? 'bg-blue-600 text-white border-blue-500' : 'text-gray-300 bg-surface-1 hover:bg-surface-hover border-edge'}`}
  ```
- **偏离描述**：选中态用实心 `bg-blue-600 text-white`（高饱和实心蓝），而规范与其它节点分段按钮是浅蓝底 `bg-blue-500/15` + 蓝字 `text-blue-300`。观感明显更「重」，与本组视觉 DNA 不统一。

### FaceMosaicNode.jsx 字号颜色（多处裸字号/裸色）
- **基准**：§〇 禁用 `text-[10px]`/`text-[12px]`/裸 hex。
- **实际**：
  - `src/components/FaceMosaicNode.jsx L221` 强度标签 `text-[10px] text-gray-400`
  - `src/components/FaceMosaicNode.jsx L229` 颜色标签 `text-[10px] text-gray-400`
  - `src/components/FaceMosaicNode.jsx L246` 结果信息 `text-[10px] text-gray-400`
  - `src/components/FaceMosaicNode.jsx L283` 手动按钮 `text-[12px]`
  - `src/components/FaceMosaicNode.jsx L291` AI打码主按钮 `text-[12px]` 且 `bg-white text-[#141414]`（裸色值）
- **偏离描述**：5 处裸字号（`text-[10px]`/`text-[12px]`）违反 §〇 禁止裸字号；其中 `text-[#141414]` 是裸 hex（应为 `bg-white text-inverse-strong` 或语义 token）。细看字号略大于同组 caption-sm(11)/body-xs(12) 的规范取值，且不受 token 管理。

### FaceMosaicNode.jsx 主显示区（板块结构偏离）
- **基准**：§一 节点按「NodeTitle + 主显示区(flex-1) + ExpandablePanel」组织；本组其它 3 节点均有「主显示区 flex-1」+「ExpandablePanel 放参数」。
- **实际**：`src/components/FaceMosaicNode.jsx L176` 直接 `flex-1 p-3 flex flex-col gap-2.5` 把图源预览、模式、强度、颜色、结果、按钮全部堆在 children，**无独立主显示区、无 ExpandablePanel**。
- **偏离描述**：板块规划与本组其它节点不一致——其它节点参数收进 ExpandablePanel 默认展开/可收起，FaceMosaic 全部常驻展开无收起能力。属结构偏离（业务差异，但影响统一观感与交互范式）。

### FaceMosaicNode.jsx hover/选中态（主操作白底——与基座同源，非硬偏离）
- **基准**：§〇 主操作优先语义蓝（`bg-blue-500`/`bg-surface-hover`）；禁止裸 `bg-white text-[#141414]`。
- **实际**：`src/components/FaceMosaicNode.jsx L291`：`className="... bg-white text-[#141414] hover:bg-gray-200 ..."`；上传/手动按钮 `L275/283` 用 `bg-surface-hover hover:bg-surface-hover-strong border-edge`（与基准一致）。
- **核查结论**：经比对基座 `src/components/base/GenerateButton.jsx L68`，基座生成按钮主按钮同样为 `bg-white text-black`（白底黑字）。故 FaceMosaic「AI打码」白底按钮**观感与同组生成按钮一致，非视觉偏离**，仅 `text-[#141414]` 写死裸 hex（基座用 `text-black`=#000，同为裸值，属历史同源写法）。
- **偏离性质（轻度/同源）**：`text-[#141414]` 是裸 hex，未走语义 token；但此为与基座 `GenerateButton` 同源的既有写法，不影响本组统一观感，列为「待收敛」而非「硬偏离」。建议后续统一抽成 `bg-white text-inverse-strong`（或文本 token）以消除裸值。

---

## 四、统一建议（仅建议，未改代码）

1. **TextNode textarea（L287）**：去掉 `style` 裸值，改为 `className="... text-body-xs text-secondary ..."`（或 `text-body text-secondary`，由设计定档）。textarea 颜色用 token 而非 `#a1a1aa`。
2. **DiscountVideoNode 提示词框（L287-304）**：复用基座 `PromptInput`（与 PromptNode/TextNode 一致），恢复 `@素材` 弹层能力，删除手写 textarea + `text-gray-200` 裸色（改用 `PromptInput` 内置 token）。
3. **DiscountVideoNode 比例/时长菜单（L311-348）**：面板内选项选中态收敛为 `bg-surface-hover-strong border-edge-strong text-white`（与 PromptNode L360/364/368 对齐）；触发器若保留手写，按钮 class 已接近 `ModelSelect` 可不动，但菜单选项态必须统一。
4. **FaceMosaicNode 模式按钮（L213）**：选中态改为 `bg-blue-500/15 border-blue-500/60 text-blue-300`，未选 `bg-surface-hover border-edge text-gray-400 hover:text-white`（§二 分段按钮）。
5. **FaceMosaicNode 裸字号（L221/229/246/283/291）**：`text-[10px]`→`text-caption`，`text-[12px]`→`text-body-xs`；`text-[#141414]`→`text-inverse-strong`（或 `text-[#141414]` 改用 `bg-white text-inverse-strong`）。
6. **FaceMosaicNode AI打码主按钮（L291）**：白底配色与基座 `GenerateButton`（L68）同源一致，观感无偏离，仅 `text-[#141414]` 为裸 hex。建议：把裸 `#141414` 改为语义 token（如 `text-inverse-strong`），并同步收敛基座 `GenerateButton` 的 `text-black`→`text-inverse-strong`，统一消除裸值（不改动白底观感）。
7. **FaceMosaicNode 板块（L176）**：建议拆出「主显示区 flex-1」+「ExpandablePanel 放模式/强度/颜色」，与本组其它 3 节点板块规划一致（可选，取决于业务是否需要常驻）。

---

## 五、验收自查

1. ✅ 本组 4 节点均按 8 维度审计，差异汇总表无空白单元格。
2. ✅ 每个偏离项均有「文件 + 行号 + 关键片段」证据，非空泛描述。
3. ✅ 明确区分「一致」（PromptNode 8 维全一致；TextNode/DiscountVideoNode/标题/端口/底色/主显示区/hover 多数一致）与「偏离」（已逐条列出）。
4. ✅ 行号来自本次实际 `read_file`（`NodeShell.jsx`/`NodeTitle.jsx`/`PromptNode.jsx`/`TextNode.jsx`/`DiscountVideoNode.jsx`/`FaceMosaicNode.jsx`/`CustomHandle.jsx`/`ModelSelect.jsx`/`tailwind.config.js`）核实，非猜测。

> 本文件即唯一产出，未改动任何其他文件。
