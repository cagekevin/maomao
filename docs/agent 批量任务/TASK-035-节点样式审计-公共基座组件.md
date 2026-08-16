# TASK-035 — 节点样式一致性审计（公共基座组件组）

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

1. **视觉 DNA**：见 `docs/NODE-DESIGN-SPEC.md` §〇——底色 `bg-surface-raised`(内层 `bg-surface-1`/`bg-input`)、文字 token（text-strong→faint）、边框 `border-edge`、圆角 `rounded-xl`、字号 token（text-2xs/meta/caption/caption-sm/body-xs，**大段文字才用 body 级**）、状态色蓝/绿/红/黄/紫、z-index 语义 token、拖拽 `drag-handle cursor-move`、hover `hover:bg-surface-hover + hover:text-white`。
2. **板块规划**：见 `docs/NODE-DESIGN-SPEC.md` §一——NodeShell 外壳 + NodeTitle 标题 + titleRight 右侧操作 + HoverToolbar + 主显示区(flex-1) + ExpandablePanel。
3. **设置项 7 种形态**：见 `docs/NODE-DESIGN-SPEC.md` §二——分段按钮/下拉菜单/数值输入/文本输入/开关/颜色选择/弹层。禁止自创控件样式。
4. **NodeShell 默认实现**：见 `src/components/base/NodeShell.jsx`——titleRight 定位 `absolute right-0 -top-0.5`(L212-214)、NodeTitle `mb-1 self-start`、端口 handleVariant large(48)/small(32)、默认尺寸 defaultHeight=420/minWidth=160/minHeight=160。
5. **z-index 语义 token（关键基准）**：见 `tailwind.config.js` L21-39。可用语义 token：`base`(0)/`node-inner`(10)/`node-inner-2`(20)/`dropdown`(50)/`float`(100)/`topnav`(200)/`canvas-tools`(700)/`sidebar`(800)/`popover`(1000)/`modal`(9999)/`modal-raise`(10000)/`modal-action`(10001)/`overlay-error`(99999)/`suggest`(999999)/`ceiling-1/2`/`ceiling`。**规范明确禁止裸数字 z-index**。本组组件里出现的裸数字：`z-10`/`z-50`(NodeShell 根 div L206)、`z-30`(NodeTitle floating L23)、`z-50`(ModelSelect 弹层 L68)、`z-20`(HoverToolbar L19)、`z-40`(ExpandablePanel L30)——基准 §〇 要求「一律语义 token，禁裸数字」，故均记入偏离。注意 `z-suggest`(PromptInput L87) 是已登记的语义 token，**非偏离**。
6. **字号 token（关键基准）**：见 `tailwind.config.js` L92-100。节点 UI 字号 token 为 `text-2xs`(8)/`text-meta`(9)/`text-caption`(10)/`text-caption-sm`(11)/`text-body-xs`(12)；大段可编辑文字可用 `text-base-sm`(15)。**不存在 `text-xs` 这个命名 token**——`text-xs` 是 Tailwind 默认 12px，渲染等同于 `text-body-xs` 但**绕过了项目语义 token 体系**，且不在规范推荐清单内，应改用 `text-body-xs`/`text-caption`。

> 审计时，凡本组节点**偏离以上任一基准**的地方，都要记录。

## 三、探索起点（本次实际核实）

- **src/components/base/NodeShell.jsx**
  - 探索起点：核心外壳。titleRight 定位 L212-214（absolute right-0 -top-0.5）；NodeTitle L211（mb-1 self-start）；端口 L243-248（handleVariant large=48/small=32）；默认尺寸 L155-159（defaultHeight=420、minWidth=160/minHeight=160）；根 div `z-10`/`z-50`(L206)、主容器 `shadow-xl`(L192)
- **src/components/NodeTitle.jsx**
  - 探索起点：标题栏。mb-1 self-start（L23）、text-caption-sm text-gray-400（L23）、icon+名称；非 floating 态 L23 含 `z-30` 裸数字；双击改名 input 用 `bg-surface-black`(L46)、`text-caption-sm`(L46)；名称按钮 `hover:bg-white/5 hover:text-gray-200`(L56)
- **src/components/base/ModelSelect.jsx**
  - 探索起点：模型下拉组件（trigger + absolute bottom-full 面板）。各节点共用，但有的节点没用它、手写 <select>
- **src/components/CustomHandle.jsx**
  - 探索起点：端口组件（large=48/small=32），外移 16px；外观由 index.css CSS 变量驱动
- **src/components/base/HoverToolbar.jsx**
  - 探索起点：hover 顶部胶囊操作栏。`-top-12 ... z-20`（L19）、`shadow-lg`（L20）
- **src/components/base/ExpandablePanel.jsx**
  - 探索起点：展开面板（absolute top-full）。`z-40`（L30）、`shadow-2xl`（L30）
- **src/components/base/PromptInput.jsx**
  - 探索起点：提示词输入框。textarea `text-base-sm`（L71）；@素材弹层 `z-suggest`(L87)/`shadow-2xl`(L87)；标题 `text-xs`(L91)、网格项 `text-2xs`/`text-caption`(L115)
- **src/components/base/GenerateButton.jsx**
  - 探索起点：生成/停止按钮（胶囊）。停止态 `text-xs`(L44)、生成态 `text-xs`(L67)、`shadow` 无（用 `bg-surface-hover` 胶囊）
- **src/components/base/MaterialStrip.jsx**
  - 探索起点：素材缩略图条。图片缩略 `w-10 h-10 rounded-md`(L31)、@标签 `text-2xs`(L34)、文本胶囊 `text-caption`(L45)

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
| NodeShell.jsx | 一致 | 一致(基准锚点) | N/A | 一致 | 一致(bg-surface-raised/shadow-xl) | N/A | N/A(外壳) | 偏离: 裸 z-10/z-50(L206) |
| NodeTitle.jsx | 一致 | N/A | N/A | N/A | 一致 | 一致(text-caption-sm) | N/A | 偏离: 裸 z-30(L23)+hover 底色非 token(L56) |
| ModelSelect.jsx | N/A | N/A | 一致(ModelSelect 基准) | N/A | 一致 | 偏离: 裸 z-50(L68) | N/A | 一致 |
| CustomHandle.jsx | N/A | N/A | N/A | 一致(large/small) | 一致(无裸色) | N/A | N/A | 一致 |
| HoverToolbar.jsx | N/A | N/A | N/A | N/A | 偏离: 裸 z-20(L19)+shadow-lg(L20) | 一致 | N/A | 一致 |
| ExpandablePanel.jsx | N/A | N/A | N/A | N/A | 偏离: 裸 z-40(L30)+shadow-2xl(L30) | 一致 | N/A | 一致 |
| PromptInput.jsx | N/A | N/A | N/A | N/A | 偏离: 裸 z-suggest 是 token(OK) | 偏离: text-xs(L91) | 一致(flex-1 父) | 一致 |
| GenerateButton.jsx | N/A | N/A | N/A | N/A | 一致 | 偏离: text-xs(L44,L67) | N/A | 一致 |
| MaterialStrip.jsx | N/A | N/A | N/A | N/A | 一致 | 一致(text-2xs/text-caption) | N/A | 一致 |

单元格填：`一致` / `偏离: 描述(L行号)`。偏离项必须在本表下方有详细证据。

### 5.2 详细差异清单（每个偏离项）

```
### NodeShell.jsx — 维度8 hover/选中态(z-index 裸数字)
- **基准**：§〇「z-index 一律语义 token（z-dropdown/z-popover/z-modal），禁裸数字」。tailwind.config.js L21-39 定义 14 个语义 token，无 z-10/z-50。
- **实际**：L206 根 div `className={`relative flex flex-col items-center group/node min-w-[160px] min-h-[160px] ${selected ? 'z-50' : 'z-10'} ...`}`。
- **偏离描述**：`z-10` 应映射为 `z-node-inner`(10)、`z-50` 应映射为 `z-dropdown`(50) 或新增语义 token。裸数字违反 §〇，且与其他浮层（HoverToolbar z-20、ExpandablePanel z-40、ModelSelect z-50）的层级关系不透明，未来调整层级易踩坑。
```

```
### ModelSelect.jsx — 维度6 字号颜色 / 维度5 z-index
- **基准**：§〇 禁裸 z-index；弹层用 `z-popover`。
- **实际**：L68 弹层 `className={`absolute ... z-50 block max-h-60 overflow-y-auto ...`}`。
- **偏离描述**：`z-50` 是裸数字，应改用 `z-popover`(1000) 或 `z-dropdown`(50)。与规范冲突；且 z-50 与 NodeShell 选中态 z-50 等值但语义不同，掩盖层级意图。字号方面 L56/L79/L87 均用 token（text-caption-sm/text-meta/text-caption），无偏离。
```

```
### NodeTitle.jsx — 维度8 hover/选中态(z-index 裸数字 + hover 底色裸值)
- **基准**：§〇「z-index 一律语义 token，禁裸数字」；§〇 hover 反馈「hover:bg-surface-hover + hover:text-white + border-edge」。
- **实际**：L23 `className={`${floating ? 'absolute -top-6 left-0 z-30' : 'mb-1 self-start'} ...`}`（非 floating 分支无 z，但 floating 分支含 `z-30`）；L56 名称按钮 `className="max-w-[180px] truncate rounded px-0.5 text-left hover:text-gray-200 hover:bg-white/5"`。
- **偏离描述**：(1) `z-30` 为裸数字且不在 tailwind.config.js L21-39 语义 token 表中（最近的是 node-inner-2=20、dropdown=50）。floating 标题浮在节点上方，应映射为 `z-node-inner-2`(20) 或 `z-dropdown`(50)。(2) hover 态用 `hover:bg-white/5`（裸 rgba 白）而非规范要求的 `hover:bg-surface-hover`；文字用 `hover:text-gray-200` 而非 `hover:text-white`。与 §〇 的「hover:bg-surface-hover + hover:text-white」不一致，是唯一用手写白底 hover 的基座组件。
```

```
### HoverToolbar.jsx — 维度5 底色边框/阴影(z-index 裸数字 + 阴影 token)
- **基准**：§〇 禁裸 z-index；弹层阴影应 `shadow-popover`(见 tailwind.config.js L102 `popover: '0 20px 60px -10px rgba(0,0,0,0.85)'`)。
- **实际**：L19 `-top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 ...`；L20 胶囊 `... bg-surface-raised/90 backdrop-blur-md border border-edge rounded-full shadow-lg`。
- **偏离描述**：(1) `z-20` 为裸数字，应映射为 `z-node-inner-2`(20，tailwind.config.js L24 已定义)。(2) `shadow-lg` 非规范弹层阴影 token；HoverToolbar 是浮在节点上方的弹层，应使用 `shadow-popover` 而非默认 `shadow-lg`，与 ExpandablePanel 的 `shadow-2xl`、ModelSelect 的 `shadow-xl` 也不一致（三个浮层三种阴影）。
```

```
### ExpandablePanel.jsx — 维度5 底色边框/阴影(z-index 裸数字 + 阴影 token)
- **基准**：§〇 禁裸 z-index；弹层 `z-popover`；弹层阴影 `shadow-popover`。
- **实际**：L30 `className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface-raised rounded-2xl border border-edge shadow-2xl w-max max-w-[920px] ... z-40 ...`}`。
- **偏离描述**：(1) `z-40` 为裸数字且无对应语义 token（50 是 dropdown，20 是 node-inner-2，40 不存在于 token 表）。应改为 `z-dropdown`(50) 或新增语义 token。(2) `shadow-2xl` 非规范弹层阴影 token，应使用 `shadow-popover`。与 HoverToolbar(shadow-lg)、ModelSelect(shadow-xl) 三处浮层阴影各不相同。
```

```
### PromptInput.jsx — 维度6 字号颜色(text-xs 绕开语义 token)
- **基准**：§〇「节点 UI 全用 text-2xs/meta/caption/caption-sm/body-xs，大段文字才用 body 级。禁止 text-[10px] 等裸字号」；无 `text-xs` 命名 token（text-xs 是 Tailwind 默认 12px，等同于 text-body-xs 但绕过语义体系）。
- **实际**：L91 `@素材弹层标题 `className="text-xs text-gray-300 font-bold flex items-center gap-2"`。
- **偏离描述**：`text-xs` 不在规范推荐字号 token 清单内，应改 `text-caption`(10) 或 `text-body-xs`(12) 以接入语义体系。同文件 L71 textarea 用 `text-base-sm`(15，大段可编辑文字，可接受)、L115 用 `text-2xs`/`text-caption`(OK)，唯 L91 用 `text-xs` 不一致。
- 补充：L87 @素材弹层 `z-suggest` 是语义 token（tailwind.config.js L35 定义 999999），**符合基准，非偏离**；`shadow-2xl` 同 ExpandablePanel 问题，非 popover token。
```

```
### GenerateButton.jsx — 维度6 字号颜色(text-xs 绕开语义 token)
- **基准**：同 PromptInput，节点 UI 字号应用 token，无 `text-xs`。
- **实际**：L44 停止态 `<span className="flex items-center gap-1 mr-3 text-xs text-red-400 ...">`；L67 生成态 `<span className="flex items-center gap-1 mr-3 text-xs text-gray-300 ...">`。
- **偏离描述**：两处 `text-xs` 应改 `text-caption`(10) 或 `text-body-xs`(12)。与同文件其他文字（如 L37/L59/L68 用 svg/icon 无字号问题）及全局规范不一致。GenerateButton 是各生成节点共用的胶囊按钮，其字号偏离会被复制到所有生成类节点。
```

### 5.3 统一建议（只给建议，不改代码）

1. **z-index 裸数字（NodeShell z-10/z-50、NodeTitle z-30、ModelSelect z-50、HoverToolbar z-20、ExpandablePanel z-40）**
   - 收敛方案：全部改用 `tailwind.config.js` 已定义的语义 token。`z-10`→`z-node-inner`、`z-20`→`z-node-inner-2`、`z-30`→`z-node-inner-2` 或 `z-dropdown`、`z-40/z-50`→`z-dropdown`(50)（若需更高可新增 `z-float-panel`）。ExpandablePanel 的 `z-40` 介于 20/50 之间，建议定级为 `z-dropdown`(50) 或新增 `z-panel` 语义 token 并登记到 config。
   - 目的：层级关系透明，避免浮层相互压盖的隐性 bug。

2. **弹层阴影不统一（HoverToolbar shadow-lg / ExpandablePanel shadow-2xl / ModelSelect shadow-xl）**
   - 收敛方案：统一为规范定义的 `shadow-popover`（tailwind.config.js L102）。若需区分「轻浮层」与「重弹层」，可登记 `shadow-popover` + `shadow-popover-lg` 两个 token，但至少在「同是 absolute 浮层」场景下一致。

3. **text-xs 绕开语义 token（PromptInput L91 / GenerateButton L44,L67）**
   - 收敛方案：全部替换为 `text-caption`(10) 或 `text-body-xs`(12)。建议按钮内短标签用 `text-caption`、可读正文用 `text-body-xs`。
   - 目的：接入项目字号语义体系，未来统一调字号只需改 token。

4. **NodeTitle / CustomHandle / MaterialStrip**
   - CustomHandle / MaterialStrip：经 8 维度核对，未发现偏离。CustomHandle 端口 large48/small32 由 variant 驱动，无裸色值，外观由 index.css 变量统一管理；MaterialStrip 用 `text-2xs`/`text-caption`，缩略图 `rounded-md`、底色 token，符合规范。无需改动。
   - **NodeTitle**：已发现 2 处偏离（见上方详细清单 L23 `z-30` 裸数字、L56 `hover:bg-white/5` 非 token），需按建议 1 / 建议 5 收敛。其余（text-caption-sm 字号、mb-1 self-start 间距）与 NodeShell 基准 L211 一致。

5. **NodeTitle hover 底色裸值（hover:bg-white/5）**
   - 收敛方案：L56 改为 `hover:bg-surface-hover hover:text-white`，对齐 §〇 hover 反馈基准。若不希望 hover 时文字变全白、保留浅灰，至少底色应接入 token（如 `hover:bg-surface-hover` 已含足够对比），避免裸 `white/5` 游离于色彩语义体系外。

## 六、验收标准（可自测）

1. 本组每个节点都按 8 个维度审计过，差异汇总表无空白单元格。✅
2. 每个偏离项都有「文件 + 行号 + 关键片段」证据，非空泛描述。✅
3. 明确区分「一致」和「偏离」（不能全写"不一致"或全写"一致"）。✅
4. 行号来自本次实际 `read_file`/`search_content`，非猜测。✅

## 七、铁律文件名

本文件即唯一产出。写满后结束，未改动任何其他文件。
