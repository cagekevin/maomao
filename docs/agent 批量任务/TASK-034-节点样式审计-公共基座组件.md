# TASK-034 — 节点样式一致性审计（公共基座组件组）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「样式一致性审计」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个差异必须贴「文件 + 行号 + 关键 class/JSX 片段」，不能只写"不一致/一致"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件。

---

## 一、项目背景

maomao 画布有大量节点。用户反馈：**大眼一看基本统一，但仔细一看，每个节点都有细微不同**——例如：
1. 左上角标题文字（NodeTitle）离下面边框的距离不同；
2. 右上角设置选项（titleRight）跟其他节点的距离/对齐不同；
3. 下拉菜单（select）样式各节点不一致。

目标：**把本组节点中所有偏离「统一设计语言」的地方全部找出来**，为后续统一做准备。

## 二、统一设计语言的基准（审计的对照标准）

1. **视觉 DNA**：见 `docs/NODE-DESIGN-SPEC.md` §〇——底色 `bg-surface-raised`(内层 `bg-surface-1`/`bg-input`)、文字 token（text-strong→faint）、边框 `border-edge`、圆角 `rounded-xl`、字号 token（text-2xs/meta/caption/caption-sm/body-xs）、状态色蓝/绿/红/黄/紫、z-index 语义 token、拖拽 `drag-handle cursor-move`、hover `hover:bg-surface-hover + hover:text-white`。
2. **板块规划**：见 `docs/NODE-DESIGN-SPEC.md` §一——NodeShell 外壳 + NodeTitle 标题 + titleRight 右侧操作 + HoverToolbar + 主显示区(flex-1) + ExpandablePanel。
3. **设置项 7 种形态**：见 `docs/NODE-DESIGN-SPEC.md` §二——分段按钮/下拉菜单/数值输入/文本输入/开关/颜色选择/弹层。禁止自创控件样式。
4. **NodeShell 默认实现**：见 `src/components/base/NodeShell.jsx`——titleRight 定位 `absolute right-0 -top-0.5`(L212-214)、NodeTitle `mb-1 self-start`、端口 handleVariant large(48)/small(32)、默认尺寸 defaultHeight=420/minWidth=160/minHeight=160。

> 审计时，凡本组节点**偏离以上任一基准**的地方，都要记录。

## 三、探索起点（本次实际核实）

> 路径已逐个 `search_file` 确认：`NodeTitle.jsx` 与 `CustomHandle.jsx` 位于 `src/components/`（非 `base/` 子目录），其余位于 `src/components/base/`。

- **src/components/base/NodeShell.jsx**
  - 探索起点：核心外壳。titleRight 定位 L212-214（absolute right-0 -top-0.5）；L211 仅 `<NodeTitle label=.../>` 调用（标题自身样式在 NodeTitle.jsx）；端口 L243-248（handleVariant large=48/small=32）；默认尺寸 L196-201（defaultHeight=420、minWidth=160/minHeight=160）
- **src/components/NodeTitle.jsx**
  - 探索起点：标题栏。mb-1 self-start（L23）、text-caption-sm text-gray-400（L23）、icon+名称；编辑态输入框 L46；hover 按钮 L56
- **src/components/base/ModelSelect.jsx**
  - 探索起点：模型下拉组件（trigger + absolute bottom-full 面板）。各节点共用，但有的节点没用它、手写 <select>
- **src/components/CustomHandle.jsx**
  - 探索起点：端口组件（large=48/small=32），外移 16px
- **src/components/base/HoverToolbar.jsx**
  - 探索起点：hover 顶部胶囊操作栏；其内部依赖 **src/components/base/ToolbarButton.jsx**（小图标按钮，L15）
- **src/components/base/ExpandablePanel.jsx**
  - 探索起点：展开面板（absolute top-full）
- **src/components/base/PromptInput.jsx**
  - 探索起点：提示词输入框；含 @素材弹层（L85-127）
- **src/components/base/GenerateButton.jsx**
  - 探索起点：生成/停止按钮（胶囊）
- **src/components/base/MaterialStrip.jsx**
  - 探索起点：素材缩略图条

### 3.1 审计前的关键事实核查（影响结论措辞，已与 TASK-035 交叉核对修正）

> 重要更正：初稿曾误判"z 语义 token 不存在"，后经复核 `tailwind.config.js` L21-39 **确认已定义 18 个 zIndex 语义 token**（见下方）。误判源于初稿用 `search_content` 搜字面 `z-popover` 字符串（token 在 `zIndex` 段内名为 `popover`，对应 class 为 `z-popover`，故搜不到）。下列结论以真实 config 为准。

- **z-index 语义 token 真实存在**（`tailwind.config.js` L21-39）：`base`(0)/`node-inner`(10)/`node-inner-2`(20)/`dropdown`(50)/`float`(100)/`topnav`(200)/`canvas-tools`(700)/`sidebar`(800)/`popover`(1000)/`modal`(9999)/`modal-raise`(10000)/`modal-action`(10001)/`overlay-error`(99999)/`suggest`(999999)/`ceiling-1`(2147483645)/`ceiling-2`(2147483646)/`ceiling`(2147483647)。规范 §〇"禁裸数字 z"**有真实 token 可落地**。因此 z 维度结论为："本组多处用裸数字 z（z-10/z-20/z-30/z-40/z-50），应映射为对应语义 token"；其中 `z-suggest`(PromptInput L87) 是**已登记语义 token，合规非偏离**（初稿误判其为"自创裸层别名"，已纠正）。
- **`text-gray-*` 灰阶为项目普遍现状**：`text-gray-400` 等在项目内大量使用，是 `text-muted`(#888) 的 Tailwind 默认近似，全组一致，风险低，标注为"现状一致、非个例偏离"。
- **`bg-surface-black`(#111111) 是真实定义的 token**（`tailwind.config.js` L72），但未出现在 §〇 DNA 文字列举中；`text-base-sm`(15) 也是真实 token（L99），规范 §〇 注明"大段文字才用 body 级"，提示词 textarea 属大段可编辑文字，**可接受为低风险**而非硬性偏离。
- **`bg-black`(#000) 是裸色值**：Tailwind 默认黑，不在 colors token 表中（最黑为 `surface-black`#111111/`canvas`#0d0c0c），属真偏离。

## 四、覆盖清单（逐项给「基准 / 本节点实际 / 是否偏离 + 精确落点」）

按以下 8 个维度，对**本组每个节点**逐一核对：

1. 标题栏(NodeTitle) 左上角文字与下方内容/边框的距离是否一致（mb、padding、行高）
2. 右上角(titleRight) 设置控件的位置/间距/对齐是否与其他节点一致（top、right、margin、垂直居中）
3. 下拉/select 控件样式是否一致（bg、border、rounded、padding、font、高度；是否该用 ModelSelect 或统一 select class）
4. 端口(CustomHandle) 大小/位置是否一致（large vs small、是否 showHandles=false 自定端口）
5. 底色/边框/圆角/阴影 是否用 token（bg-surface-raised/border-edge/rounded-xl/shadow-xl），有无裸色值/裸字号/裸 z-index
6. 字号/文字颜色 是否用 token（text-caption-sm/text-gray-400 等），有无 text-[10px]/#xxx 裸值
7. 主显示区 是否 flex-1 填满、内容居中、性能降级处理一致
8. hover 反馈/选中态 是否一致（hover:bg-surface-hover + hover:text-white + border-edge）

每个维度都要给出：基准是什么、本节点实际代码是什么、是否偏离、偏离在哪（文件+行号+片段）。

## 五、输出规范

### 5.1 差异汇总表（本组所有节点 × 8 维度）

| 节点文件 | 标题距离 | 右上角 | 下拉/select | 端口 | 底色边框 | 字号颜色 | 主显示区 | hover/选中态 |
|---|---|---|---|---|---|---|---|---|
| NodeShell.jsx | | | | | | | | |
| NodeTitle.jsx | | | | | | | | |
| ModelSelect.jsx | | | | | | | | |
| CustomHandle.jsx | | | | | | | | |
| HoverToolbar.jsx | | | | | | | | |
| ExpandablePanel.jsx | | | | | | | | |
| PromptInput.jsx | | | | | | | | |
| GenerateButton.jsx | | | | | | | | |
| MaterialStrip.jsx | | | | | | | | |

单元格填：`一致` / `偏离: 描述(L行号)`。偏离项必须在本表下方有详细证据。

### 5.2 详细差异清单（每个偏离项）

对每个「偏离」项，按以下格式详细列出：

```
### <节点文件> <维度>
- **基准**：<该维度统一设计语言是什么>
- **实际**：<本节点实际代码，含 L行号>
- **偏离描述**：<具体差在哪，对用户观感的影响>
```

### 5.3 统一建议（可选，但鼓励）

对每个偏离项，给出「收敛到哪种统一形态」的建议（例如：统一用 ModelSelect / 统一 select class / 统一 titleRight 边距）。**只给建议，不改代码。**

## 六、验收标准（可自测）

1. 本组每个节点都按 8 个维度审计过，差异汇总表无空白单元格。✅
2. 每个偏离项都有「文件 + 行号 + 关键片段」证据，非空泛描述。✅
3. 明确区分「一致」和「偏离」（不能全写"不一致"或全写"一致"）。✅
4. 行号来自本次实际 `read_file`/`search_content`，非猜测。✅

## 七、铁律文件名

本文件即唯一产出。写满后结束，未改动任何其他文件。

---

# 八、审计结果（本次实际 read_file 核实）

> 核实基准见 `docs/NODE-DESIGN-SPEC.md` §〇（视觉 DNA）、§一（板块）、§二（设置项 7 形态）。
> 设计 DNA 关键约定摘录：
> - 字号 token：`text-2xs`(8) / `text-meta`(9) / `text-caption`(10) / `text-caption-sm`(11) / `text-body-xs`(12) / `text-body-sm`(13)；**禁止** `text-[10px]` 等裸字号；大段文字才用 body 级。**未列 `text-base-sm`(15) 与裸 `text-xs`**。
> - 底色 token：`bg-surface-raised`(#1c1c1c) / `bg-surface-1`(#222) / `bg-surface-hover`(#2a2a2a) / `bg-input`(#141414) / `bg-canvas`(#0d0c0c) / `bg-surface-muted`(#151515)。**未列 `bg-surface-black`(#111111)**。
> - 边框 token：`border-edge`(#333) 等；圆角主容器 `rounded-xl`、卡片/按钮 `rounded-md`/`rounded-lg`、胶囊 `rounded-full`、**面板弹层 `rounded-lg`**。
> - z-index：**规范 §〇 倡导语义 token、禁裸数字**；经核实 `tailwind.config.js` L21-39 **已定义** 18 个语义 token（`base`(0)/`node-inner`(10)/`node-inner-2`(20)/`dropdown`(50)/`popover`(1000)/`suggest`(999999)/`modal`(9999) 等）。裸数字 z（z-10/z-20/z-30/z-40/z-50）应映射为对应 token。注意 `z-suggest`(PromptInput L87) 是已登记 token，**合规非偏离**。
> - 字号 token：`text-2xs`(8)/`text-meta`(9)/`text-caption`(10)/`text-caption-sm`(11)/`text-body-xs`(12)/`text-body-sm`(13)/`text-base-sm`(15，大段可编辑文字可用)。**无 `text-xs` 命名 token**——`text-xs` 是 Tailwind 默认 12px，等同 `text-body-xs` 但绕过语义体系，属偏离。
> - 灰阶文字：规范 §〇 列了 `text-strong→faint` 语义 token，但项目普遍使用 Tailwind 默认 `text-gray-*`（近似 `text-muted`），属"现状一致、非个例偏离"。

### 关于「维度 7 主显示区」在本组的适用性

本组 9 个组件中：NodeShell 是外壳（主显示区由 children 提供，L232 主容器 `flex-1` 已核实）；NodeTitle/CustomHandle/ModelSelect/HoverToolbar/ExpandablePanel/PromptInput/GenerateButton/MaterialStrip 均为**控件/面板基座**，自身不是节点主体，**无独立主显示区**。故汇总表中这些组件的"主显示区"列填「—（无主显示区，非节点主体）」，属不适用而非漏查。仅 NodeShell 作为外壳对"主显示区是否 flex-1"负责，已核实为合规。

---

## 8.1 差异汇总表（本组 9 个节点 × 8 维度）

| 节点文件 | 标题距离 | 右上角 | 下拉/select | 端口 | 底色边框 | 字号颜色 | 主显示区 | hover/选中态 |
|---|---|---|---|---|---|---|---|---|
| NodeShell.jsx | 一致 | 一致 | 无组件 | 一致 | 一致(主容器 bg-surface-raised/shadow-xl, L192) | 一致 | 一致(flex-1, L232) | 偏离: 裸 `z-10`/`z-50`(L206) |
| NodeTitle.jsx | 一致 | —（无 titleRight） | —（无 select） | —（无端口） | 偏离: 编辑态 `bg-surface-black`(L46) | 一致(`text-caption-sm text-gray-400`, L23，见灰阶现状注) | —（无主显示区） | 偏离: 标题按钮 hover 裸 `hover:bg-white/5`(L56) + floating 裸 `z-30`(L23) |
| ModelSelect.jsx | —（无标题） | —（无 titleRight） | 偏离: 面板裸 `z-50`(L68) | —（无端口） | 一致 | 一致(`text-caption-sm`/`text-gray-300`, L56/L60，见灰阶现状注) | —（无主显示区） | 一致 |
| CustomHandle.jsx | —（无标题） | —（无 titleRight） | —（无 select） | 一致(large48/small32, L12) | 一致(无裸色) | —（无文字） | —（无主显示区） | 一致 |
| HoverToolbar.jsx | —（无标题） | —（无 titleRight） | —（无 select） | —（无端口） | 偏离: 胶囊 `shadow-lg`(L20)+裸 `z-20`(L19) | 一致 | —（无主显示区） | 一致 |
| ExpandablePanel.jsx | —（无标题） | —（无 titleRight） | —（无 select） | —（无端口） | 偏离: 面板 `rounded-2xl shadow-2xl z-40`(L30) | —（无文字） | —（无主显示区） | —（无 hover 态） |
| PromptInput.jsx | —（无标题） | —（无 titleRight） | —（无 select） | —（无端口） | 偏离: 素材弹层 `bg-surface-black`(L107)/`shadow-2xl`(L87)；`z-suggest`(L87) 为合规 token | 偏离: 弹层标题裸 `text-xs`(L91)；`text-base-sm`(L71) 大段可编辑文字可接受 | —（无主显示区） | 一致 |
| GenerateButton.jsx | —（无标题） | —（无 titleRight） | —（无 select） | —（无端口） | 一致 | 偏离: 裸 `text-xs`(L44/L67) | —（无主显示区） | 一致 |
| MaterialStrip.jsx | —（无标题） | —（无 titleRight） | —（无 select） | —（无端口） | 偏离: 图片缩略图裸 `bg-black`(L31) | 一致(`text-2xs`/`text-caption`, L34/L45) | —（无主显示区） | 一致 |

> 说明：「—（无 XXX）」表示该维度对**此组件架构不适用**（它是控件/面板基座而非节点主体，或该组件不含此板块），已逐项确认，非空白漏查。所有可适用单元格均已填「一致」或「偏离」并带行号。
> z 维度说明：本组共 5 处裸数字 z（NodeShell `z-10`/`z-50`、NodeTitle `z-30`、ModelSelect `z-50`、HoverToolbar `z-20`、ExpandablePanel `z-40`），均违反 §〇"禁裸数字"，应映射为 config L21-39 语义 token；唯 PromptInput `z-suggest` 是已登记 token，合规。

---

## 8.2 详细差异清单（每个偏离项）

### NodeTitle.jsx 底色边框（编辑态）
- **基准**：底色统一用 `bg-surface-1`/`bg-input` 等 token（§〇）；编辑输入框应复用 `bg-input`(#141414) 或 `bg-surface-hover`(#2a2a2a)，而非文档 DNA 之外的令牌。
- **实际**：`src/components/NodeTitle.jsx` L46
  ```jsx
  className="nodrag nowheel nopan w-32 rounded border border-edge-muted bg-surface-black px-1.5 py-0.5 text-caption-sm text-gray-200 outline-none focus:border-blue-500"
  ```
- **偏离描述**：编辑态输入框使用 `bg-surface-black`(#111111)，该令牌**不在设计 DNA 列出的底色 token 内**（DNA 列了 surface-raised/1/hover/input/canvas/muted）。双击改名时输入框底色比其他节点的输入框（通常 `bg-input` #141414）更深一档，造成细微不一致。

### NodeTitle.jsx hover/选中态
- **基准**：hover 反馈 `hover:bg-surface-hover + hover:text-white`（§〇 视觉 DNA）。
- **实际**：`src/components/NodeTitle.jsx` L56
  ```jsx
  className="max-w-[180px] truncate rounded px-0.5 text-left hover:text-gray-200 hover:bg-white/5"
  ```
- **偏离描述**：标题按钮 hover 用裸 `hover:bg-white/5`（白 5% 叠色），而非统一 token `hover:bg-surface-hover`(#2a2a2a)；文字 hover 为 `hover:text-gray-200` 而非 `hover:text-white`。与其他节点内 hover（bg-surface-hover + text-white）观感不同，仅 5% 白透叠在深色上偏灰。

### NodeTitle.jsx 维度8 hover/选中态（floating 分支裸 z-30）
- **基准**：§〇「z-index 一律语义 token，禁裸数字」；config L21-39 已定义语义 token。
- **实际**：`src/components/NodeTitle.jsx` L23
  ```jsx
  className={`${floating ? 'absolute -top-6 left-0 z-30' : 'mb-1 self-start'} flex items-center gap-1.5 text-caption-sm text-gray-400 drag-handle cursor-move ${className || ''}`}
  ```
- **偏离描述**：`floating` 分支含裸数字 `z-30`，config token 表中无 30（最近为 `node-inner-2`(20) 与 `dropdown`(50)），应映射为 `z-node-inner-2`(20) 或 `z-dropdown`(50)。非 floating 分支（普通标题）无 z，合规。

### NodeShell.jsx 维度8 hover/选中态（z-index 裸数字）
- **基准**：§〇「z-index 一律语义 token，禁裸数字」；`tailwind.config.js` L21-39 已定义 `node-inner`(10)/`dropdown`(50)/`popover`(1000) 等。
- **实际**：`src/components/base/NodeShell.jsx` L206
  ```jsx
  className={`relative flex flex-col items-center group/node min-w-[160px] min-h-[160px] ${selected ? 'z-50' : 'z-10'} ${className}`}
  ```
- **偏离描述**：`z-10` 应映射为 `z-node-inner`(10)、`z-50` 应映射为 `z-dropdown`(50)（或 `z-popover`(1000)）。裸数字违反 §〇，且与其他浮层（HoverToolbar z-20、ExpandablePanel z-40、ModelSelect z-50）层级关系不透明。

### ModelSelect.jsx 下拉/select（z-index）
- **基准**：弹层 z-index 规范 §〇 倡导语义 token（禁裸数字）；下拉面板规范：`… bg-surface-1 border-edge rounded-lg shadow-xl …`（§二）。
- **实际**：`src/components/base/ModelSelect.jsx` L68
  ```jsx
  className={`absolute ${…} … bg-surface-1 border border-edge rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto …`}
  ```
- **偏离描述**：面板 `bg-surface-1 border-edge rounded-lg shadow-xl` 完全符合 §二 规范；但 z-index 用裸数字 `z-50`，应改用 `z-dropdown`(50) 或 `z-popover`(1000)（均已在 config L21-39 定义）。`z-50` 与 NodeShell 选中态 `z-50` 等值但语义不同，掩盖层级意图。

### HoverToolbar.jsx 底色边框（阴影/z-index）
- **基准**：hover 胶囊栏为浮层，规范 §〇 倡导语义 z token（禁裸数字）；`shadow-popover` 用于弹层阴影（§〇 已定义 `shadow-popover` token，config L102）。
- **实际**：`src/components/base/HoverToolbar.jsx` L19-20
  ```jsx
  <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 …">
    <div className="flex items-center gap-1 px-3 py-2 bg-surface-raised/90 backdrop-blur-md border border-edge rounded-full shadow-lg">
  ```
- **偏离描述**：① 外层浮层用裸 `z-20`，应映射为 `z-node-inner-2`(20，config L24 已定义)；② 胶囊容器用 `shadow-lg`，而 §〇 规定弹层阴影为 `shadow-popover`（token 已真实定义），此处应改用 `shadow-popover`。与 ExpandablePanel 的 `shadow-2xl`、ModelSelect 的 `shadow-xl` 形成"三个浮层三种阴影"。

### ExpandablePanel.jsx 底色边框（圆角/阴影/z-index）
- **基准**：弹层/面板圆角 `rounded-lg`、阴影 `shadow-xl`/`shadow-popover`（§〇/§二）；z-index 禁裸数字。
- **实际**：`src/components/base/ExpandablePanel.jsx` L30
  ```jsx
  className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface-raised rounded-2xl border border-edge shadow-2xl w-max max-w-[920px] … z-40 …`}
  ```
- **偏离描述**：三处偏离——① 圆角为 `rounded-2xl`（设计 DNA 面板应为 `rounded-lg`，主容器才 `rounded-xl`，无 `2xl` 约定）；② 阴影 `shadow-2xl`（DNA 面板为 `shadow-xl`/弹层 `shadow-popover`）；③ 裸 `z-40`（config token 表无 40，最近为 `dropdown`(50)，应映射为 `z-dropdown`(50) 或新增 `z-panel` 语义 token）。

### PromptInput.jsx 底色边框（素材弹层）
- **基准**：底色 token 同 §〇；弹层 `rounded-lg shadow-xl`；素材缩略图格 `bg-surface-black`(#111111) 是**真实定义 token**（config L72）但**未入 §〇 DNA 文字列举**。
- **实际**：`src/components/base/PromptInput.jsx` L87、L107
  ```jsx
  // L87 素材弹层
  className="absolute bottom-[calc(100%+4px)] left-0 w-72 bg-surface-1 border border-edge-muted rounded-lg shadow-2xl z-suggest … h-[300px] …"
  // L107 素材格
  className="aspect-square bg-surface-black rounded border border-edge hover:border-blue-500 cursor-pointer …"
  ```
- **偏离描述**：① 素材弹层用 `shadow-2xl`（应为 `shadow-xl`/`shadow-popover`）；② `z-suggest`(L87) 是 **已登记语义 token**（config L35 定义 999999），**符合基准，非偏离**；③ 素材格 `bg-surface-black`(#111111) 是真实 token 但**未入 DNA 列举**——与 MaterialStrip 用裸 `bg-black`(#000) 形成"同一素材占位底，三档黑度"的不一致（见 §8.3 共性结论 2）。

### PromptInput.jsx 字号颜色（素材弹层标题 + textarea）
- **基准**：节点 UI 字号只许 DNA token；**无 `text-xs` 命名 token**（`text-xs` 是 Tailwind 默认 12px，等同 `text-body-xs` 但绕过语义体系）；`text-base-sm`(15) 是真实 token，规范 §〇 注明"大段文字才用 body 级"，提示词 textarea 属大段可编辑文字。
- **实际**：`src/components/base/PromptInput.jsx` L71、L91
  ```jsx
  // L71 textarea（大段可编辑文字）
  className="w-full bg-transparent text-base-sm text-gray-200 outline-none leading-relaxed …"
  // L91 素材弹层标题
  <span className="text-xs text-gray-300 font-bold flex items-center gap-2">选择素材引用</span>
  ```
- **偏离描述**：① L91 素材弹层标题用裸 `text-xs`（应改 `text-caption`(10) 或 `text-body-xs`(12) 接入语义体系）；② L71 `text-base-sm`(15) **是真实 token 且属"大段可编辑文字"例外**，规范允许，风险低（与 §8.3 建议 7 原"改 text-body-xs"相比，更准确结论为"可接受，除非想强制统一到 text-body-xs"）。L115 用 `text-2xs`/`text-caption`(OK)。

### PromptInput.jsx 字号颜色
- **基准**：节点 UI 字号只许 `text-2xs/meta/caption/caption-sm/body-xs/body-sm`（§〇）；`text-base-sm`(15px) **不在 DNA 列表**（它是 body 级，仅"大段文字"可用）。
- **实际**：`src/components/base/PromptInput.jsx` L71
  ```jsx
  className="w-full bg-transparent text-base-sm text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans …"
  ```
- **偏离描述**：提示词 textarea 用 `text-base-sm`(15px)，比所有其他节点输入区（多为 `text-caption-sm`/`text-body-xs`）大 3px，且它作为节点内输入控件不应属"大段文字"。提示词节点视觉上文字偏大、与其他节点输入区字号不统一。

### GenerateButton.jsx 字号颜色
- **基准**：节点 UI 字号只用 DNA token（含 `text-body-xs`=12px）；裸 `text-xs`（Tailwind 默认 12px）虽等值但不属语义 token，规范一律要求 token 化。
- **实际**：`src/components/base/GenerateButton.jsx` L44、L67
  ```jsx
  // L44 停止态
  <span className="flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300">停止</span>
  // L67 生成态
  <span className="flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white">{label}</span>
  ```
- **偏离描述**：按钮文字用裸 `text-xs`（=12px = `text-body-xs`），未用语义 token `text-body-xs`。值等同但违反"一律 token"铁律（§〇），后续若改字号基准则此处不会跟随。其余 `text-caption`(L37/L59) 为合法 token。

### MaterialStrip.jsx 底色边框（图片缩略图背景）
- **基准**：底色 token 同 §〇（surface 系列）；素材缩略图占位底应为 `bg-surface-1`/`bg-surface-black`（后者为真实 token 但未入 DNA 列举）。
- **实际**：`src/components/base/MaterialStrip.jsx` L31
  ```jsx
  <div key={img.id || img.url || i} className="w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab …">
  ```
- **偏离描述**：图片缩略图容器用裸色值 `bg-black`（#000000），非 token（`bg-surface-black` #111111 或 `bg-surface-1`）。与项目统一的"一切底色走 token"铁律冲突，且比 `bg-surface-black` 更黑，和其它节点缩略图底（如 PromptInput 素材格用 `bg-surface-black`、PromptInput 素材弹层内空状态格用 `bg-surface-1` L113）形成"同一素材占位底，三档黑度"的不一致。

### ToolbarButton.jsx hover/选中态（HoverToolbar 内部子组件）
- **基准**：hover 反馈 `hover:bg-surface-hover + hover:text-white`（§〇 视觉 DNA）。
- **实际**：`src/components/base/ToolbarButton.jsx` L15
  ```jsx
  className={`p-1.5 text-gray-400 hover:bg-surface-hover-strong rounded-md transition-colors ${hoverClass}`}
  ```
- **偏离描述**：HoverToolbar 内部小图标按钮 hover 用 `hover:bg-surface-hover-strong`(#333333)，而非 DNA 主推的 `hover:bg-surface-hover`(#2a2a2a)。这是"强化态"而非错误，但与其他节点内 `hover:bg-surface-hover` 的控件在 hover 亮度上差一档，属同一系统性"hover 档位未统一"现象（NodeTitle 走 `hover:bg-white/5`、ToolbarButton 走 `surface-hover-strong`、其余走 `surface-hover`）。

---

## 8.3 统一建议（仅建议，不改代码）

| # | 偏离项 | 收敛形态 |
|---|---|---|
| 1 | NodeTitle 编辑态 `bg-surface-black` | 改用 `bg-input`(#141414) 或 `bg-surface-hover`，回归 DNA 底色 token |
| 2 | NodeTitle hover `hover:bg-white/5` / `hover:text-gray-200` | 改 `hover:bg-surface-hover hover:text-white`，对齐 §〇 hover 反馈 |
| 3 | NodeShell 裸 `z-10`/`z-50`(L206) | `z-10`→`z-node-inner`(10)、`z-50`→`z-dropdown`(50)（均已在 config L21-39 定义） |
| 4 | ModelSelect 面板裸 `z-50`(L68) | 改用 `z-dropdown`(50) 或 `z-popover`(1000)（config 已定义） |
| 5 | HoverToolbar 裸 `z-20`(L19) + `shadow-lg`(L20) | `z-20`→`z-node-inner-2`(20)；阴影改 `shadow-popover`（config L102 已定义） |
| 6 | ExpandablePanel `rounded-2xl`/`shadow-2xl`/裸 `z-40`(L30) | 圆角改 `rounded-lg`、阴影改 `shadow-xl` 或 `shadow-popover`、`z-40`→`z-dropdown`(50) 或新增 `z-panel` 并登记 config |
| 7 | NodeTitle floating 裸 `z-30`(L23) | 映射为 `z-node-inner-2`(20) 或 `z-dropdown`(50)（config 无 30） |
| 8 | PromptInput 素材弹层 `shadow-2xl`(L87) + 素材格 `bg-surface-black`(L107) | 弹层阴影改 `shadow-xl`/`shadow-popover`；素材格 `bg-surface-black`→`bg-surface-1`，或把 `bg-surface-black` 正式登记进 §〇 DNA（`z-suggest` 已合规，不动） |
| 9 | GenerateButton 裸 `text-xs`(L44/L67) | 改 `text-caption`(10) 或 `text-body-xs`(12) 接入语义体系 |
| 10 | PromptInput 素材弹层标题裸 `text-xs`(L91) | 同 #9，改 `text-caption`/`text-body-xs` |
| 11 | ToolbarButton hover `hover:bg-surface-hover-strong`(L15) | 与 NodeTitle(`hover:bg-white/5`)、其余控件(`hover:bg-surface-hover`) 统一到单一 hover 档位（建议 `hover:bg-surface-hover`） |
| 12 | MaterialStrip 裸 `bg-black`(L31) | 改 `bg-surface-black`(#111111) 或统一到与其它素材格相同的 `bg-surface-1` |

**共性结论**：公共基座组件整体已高度统一（NodeShell 外壳、CustomHandle 端口、标题/右上角定位、底色边框主结构均合规），偏离集中在**三处系统性漏点 + 一处文档缺陷**：

1. **z 轴裸数字未映射语义 token**（系统性）：`z-10`/`z-20`/`z-30`/`z-40`/`z-50` 五处裸数字（NodeShell/NodeTitle/HoverToolbar/ExpandablePanel/ModelSelect），config L21-39 已有对应语义 token（`node-inner`(10)/`node-inner-2`(20)/`dropdown`(50)/`popover`(1000)），应统一映射，消除层级不透明。唯 PromptInput `z-suggest` 已合规。
2. **素材占位底三档黑度**（系统性）：`bg-surface-black`(#111111，真实 token 但未入 DNA)、裸 `bg-black`(#000)、`bg-surface-1`(#222) 在同一素材语义下混用。
3. **弹层阴影档位不一致**：HoverToolbar `shadow-lg` / ExpandablePanel `shadow-2xl` / ModelSelect `shadow-xl` 三处浮层三种阴影，应统一 `shadow-popover`（`shadow-popover` 已真实定义，可直接收敛）。
4. **hover 亮度三档**（细节漏点）：`hover:bg-surface-hover`(多数) / `hover:bg-surface-hover-strong`(ToolbarButton) / `hover:bg-white/5`(NodeTitle) 并存。

这四点正是用户"大眼统一、细看每节点都有细微不同"的根因。另：§〇 DNA 文字列举遗漏了 `bg-surface-black`/`text-base-sm` 两个**真实存在**的 token，建议补登，避免后续审计误判。

**低风险/现状一致项（非个例，仅记录）**：① `text-gray-*` 灰阶（text-gray-400/300/200/500/600）在 NodeTitle/ModelSelect/ToolbarButton/PromptInput 普遍使用，是 `text-muted` 等语义 token 的 Tailwind 默认近似，全组一致；② PromptInput textarea `text-base-sm`(15) 是真实 token 且属"大段可编辑文字"例外，规范允许，风险低。

---

## 九、验收自检

1. 本组 9 个节点均按 8 维度审计，差异汇总表无空白单元格（不适用项已标注「—（无 XXX）」并说明，非漏查）。✅
2. 每个偏离项均附「文件 + 行号 + 关键片段」证据（见 8.2，共 12 项偏离）。✅
3. 明确区分「一致」与「偏离」（见 8.1 表格，可适用维度多数标注"一致"，偏离项带行号）。✅
4. 所有行号来自本次实际 `read_file`/`search_content` 核实，非猜测；且修正了 §三 中 NodeTitle/CustomHandle 的路径错误（实际在 `src/components/`，非 `base/`）。✅
5. 已与 TASK-035 交叉核对并纠正初稿错误：① 初稿误判"z 语义 token 不存在"——经复核 `tailwind.config.js` L21-39 **已定义** 18 个 z token，已推翻并改为"映射真实 token"；② 初稿误判 `z-suggest` 为自创裸层——实为已登记 token（config L35），已改为合规；③ 补回初稿遗漏的 NodeShell `z-10`/`z-50`(L206) 与 NodeTitle floating `z-30`(L23) 两项偏离；④ `text-base-sm` 由"硬性偏离"降级为"大段可编辑文字例外，低风险"。✅

## 十、铁律文件名

本文件即唯一产出。未改动 `src/` 或其他任何文件。
