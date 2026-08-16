# TASK-033 — 节点样式一致性审计（复合特殊类组）

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

1. **视觉 DNA**：见 `docs/NODE-DESIGN-SPEC.md` §〇——底色 `bg-surface-raised`(内层 `bg-surface-1`/`bg-input`)、文字 token（text-strong→faint）、边框 `border-edge`、圆角 `rounded-xl`、字号 token（text-2xs/meta/caption/caption-sm/body-xs/body-sm，完整集以 `tailwind.config.js` 为准）、状态色蓝/绿/红/黄/紫、z-index 语义 token、拖拽 `drag-handle cursor-move`、hover `hover:bg-surface-hover + hover:text-white`。

> 说明：§〇 正文列举的是「节点 UI 全用」的推荐集（2xs/meta/caption/caption-sm/body-xs），但 `tailwind.config.js` L98 实际还登记了 `body-sm`(13px)，故 `text-body-sm` 是**合法 token**（非裸字号）。审计「裸字号」仅指 `text-[10px]` 这类任意像素值或 `text-sm`/`text-lg` 等未登记类。
2. **板块规划**：见 `docs/NODE-DESIGN-SPEC.md` §一——NodeShell 外壳 + NodeTitle 标题 + titleRight 右侧操作 + HoverToolbar + 主显示区(flex-1) + ExpandablePanel。
3. **设置项 7 种形态**：见 `docs/NODE-DESIGN-SPEC.md` §二——分段按钮/下拉菜单/数值输入/文本输入/开关/颜色选择/弹层。禁止自创控件样式。
4. **NodeShell 默认实现**：见 `src/components/base/NodeShell.jsx`——titleRight 定位 `absolute right-0 -top-0.5`(L212-214)、NodeTitle `mb-1 self-start`、端口 handleVariant large(48)/small(32)、默认尺寸 defaultHeight=420/minWidth=160/minHeight=160。

> 审计时，凡本组节点**偏离以上任一基准**的地方，都要记录。

## 三、探索起点（本次实际核实）

- **src/components/LoopNode.jsx**（本次 read_file 完整读取，共 263 行）
  - NodeShell L203-261：handleVariant="small"(L209)、defaultHeight=280(L213)、aspectRatio=null(L212)、titleRight 手写 `<select>`(L214-225)；主面板 `bg-surface rounded-xl`(L228)；序号徽章 `bg-surface-hover-strong border border-edge-muted text-caption text-gray-400`(L234)；textarea `bg-input border border-edge rounded-md p-1.5 text-caption-sm text-gray-200`(L237)；底部控制条 L249-256。
- **src/components/ScriptBoxNode.jsx**（本次 read_file 完整读取，共 187 行）
  - NodeShell L84-97：handleVariant="small"(L90)、showHandles={false}(L91)、minWidth=900/minHeight=600(L93-94)、aspectRatio=null(L92)；内部标题栏 `border-b border-white/[0.08]`(L103)、`text-body-sm text-gray-300`(L105)；StepNav 裸 svg 颜色 `#3a3a3a/#2a2a2a/#666`(L171-172)、`fontSize="11"`(L173)；设置/全屏按钮 `hover:text-white hover:bg-surface-hover`(L113-118)。
- **src/components/GroupNode.jsx**（本次 read_file 完整读取，共 113 行）
  - NodeShell L81-110：minWidth=120/minHeight=80(L88-89)、aspectRatio=null(L91)、defaultHeight=200(L92)、syncSize={false}(L93)、showHandles={false}(L94)、titleRight 折叠按钮(L95-104)；展开态空容器 `w-full h-full`(L107)、右侧自定义端口 `CustomHandle position="right" variant="small"`(L109)；折叠态独立小胶囊 L64-77（`bg-surface-raised/80 border-dashed`、`text-sm`、裸 Handle class）。

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
| LoopNode.jsx | 一致 | 一致 | 偏离: 手写 `<select>` 非 ModelSelect(L216-223) | 一致(small) | 偏离: 主面板重复 `bg-surface rounded-xl`(L228) | 一致 | 一致(flex-1) | 一致 |
| ScriptBoxNode.jsx | 一致 | 一致 | 一致(无 select) | 一致(showHandles=false 业务需要) | 待统一: 标题栏 `border-white/[0.08]`(L103，§〇 未登记 border-edge，但画布内 border-white/10 为既有浮层惯例) | 偏离: `text-gray-300` 不在文字 token 体系 + 裸 svg `#3a3a3a/#666`/`fontSize=11`(L105,L171-173) | 一致(内容自适应) | 一致 |
| GroupNode.jsx | 一致 | 一致 | 一致(无 select) | 一致(showHandles=false 业务需要) | 偏离: 折叠态 `bg-surface-raised/80 border-dashed`(L67) | 偏离: 折叠态 `text-sm` 裸字号(L73) | 一致(空容器) | 一致 |

> 说明：标题距离、右上角、端口、主显示区、hover/选中态 5 个维度本组三节点均**未偏离**基准，详见 §5.2 证据。

### 5.2 详细差异清单（每个偏离项）

---

#### LoopNode.jsx 维度3（下拉/select）

- **基准**：`NODE-DESIGN-SPEC.md` §二「下拉菜单」形态 = 触发按钮 + `absolute bottom-full` 面板（`bg-surface-1 border-edge rounded-lg shadow-xl p-3 z-popover`），选项选中 `bg-surface-hover-strong text-white`；或统一用 `ModelSelect` 组件（全仓库 8 处复用，见 `src/components/base/ModelSelect.jsx`）。**禁止自创控件样式**。
- **实际**：`src/components/LoopNode.jsx` L214-223 手写原生 `<select>`：
  ```jsx
  <select
    className="max-w-[130px] px-1.5 py-0.5 rounded border border-edge bg-surface-hover text-caption text-gray-400 hover:text-white outline-none cursor-pointer nodrag"
    value={splitMethod}
    onChange={(e) => changeSplitMethod(e.target.value)}
  >
    {SPLIT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
  </select>
  ```
- **偏离描述**：全仓库唯一一处手写 `<select>`（已用 search_content 确认仅 LoopNode 命中该 class）。它既没用 ModelSelect 也没用 §二 的「触发按钮+弹层」形态，而是直接用浏览器原生 select 控件。观感上：原生 option 下拉面板不受 maomao 暗色 token 控制（系统浅色弹窗），与画布其它节点一致性的「触发按钮 + 暗色面板」下拉严重不一致；且触发态为 `text-gray-400`(灰) 而非选中态白字，默认态与 hover 态颜色跳变。

---

#### LoopNode.jsx 维度5（底色/边框/圆角）

- **基准**：`NodeShell.jsx` L192 `mainShellClassName` 已统一提供 `bg-surface-raised rounded-xl border shadow-xl`；`NodeShell.jsx` L86-87 注释明确"children 里不要再写 bg-surface-raised / rounded-xl / border / shadow——主容器已提供，重复写会出双重外框、颜色不一致"。
- **实际**：`src/components/LoopNode.jsx` L228 主面板：
  ```jsx
  <div className="relative w-full flex-1 min-h-0 flex flex-col gap-1.5 p-2 bg-surface rounded-xl drag-handle cursor-move">
  ```
- **偏离描述**：主显示区又写了一次 `bg-surface rounded-xl`，与 NodeShell 外壳 `bg-surface-raised` 形成**双层背景 + 双层圆角**。外层 `bg-surface-raised`(#1c1c1c) + 内层 `bg-surface`(#151515) 叠出可见的内嵌框感，而其它节点（如 PromptNode/TextNode）主显示区只靠 NodeShell 外壳，没有这层额外圆角背景。视觉上 LoopNode 比其它节点"多了一圈内卡"，细看不一致。

---

#### ScriptBoxNode.jsx 维度5（底色/边框/圆角）

- **基准**：`NODE-DESIGN-SPEC.md` §〇 边框只登记 `border-edge`(#333) / `border-edge-muted` / `border-edge-strong` 系列，未提及 `border-white/*` 白色透明度边框。
- **实际**：`src/components/ScriptBoxNode.jsx` L103 内部标题栏分隔线：
  ```jsx
  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] w-full drag-handle cursor-move shrink-0">
  ```
- **偏离描述（待统一，非硬偏离）**：用了 `border-white/[0.08]` 而非 §〇 登记的 `border-edge`。但经 search_content 复核，画布内 `border-white/10`（及 `border-white/[0.08]`）**并非 ScriptBox 自创**——`GridSplitNode.jsx` L927/L998、`PanoramaNode.jsx` L151/L193/L199 均用 `border-white/10` 作为浮层/标题栏分隔，属画布内既有二级惯例。严格按 §〇 它没走 `border-edge` token，但与其他节点（如 LoopNode 用 `border-edge`/`border-edge-faint`）的标题分隔明度不同，是"可统一 / 可保留"的待定项，不应记为 ScriptBox 独有偏离。

---

#### ScriptBoxNode.jsx 维度6（字号/文字颜色）

- **基准**：字号用 `tailwind.config.js` 登记的 token（含 `body-sm` L98、`caption-sm` L96 等）；文字颜色 §〇 登记 `text-strong`(fff)/`text-muted`(#888)/`text-faint`(#666) 及节点常用 `text-gray-400`；禁止 `text-[10px]` 等任意像素裸字号与 `#xxx` 裸色值。
- **实际**：`src/components/ScriptBoxNode.jsx`
  - L105 标题文字：`text-body-sm text-gray-300`——`text-body-sm` 是 **tailwind 合法 token（L98, 13px）**，合规；`text-gray-300` 不在 §〇 登记的 strong/muted/faint/gray-400 文字体系内（属更深一级灰），是轻微偏离。
  - L171-172 StepNav 进度环 svg 描边裸色（**确属裸色值**）：
    ```jsx
    <circle cx="14" cy="14" r="11" fill="none" stroke={active ? '#3a3a3a' : '#2a2a2a'} strokeWidth="2" />
    <circle ... stroke={active ? '#fff' : '#666'} ... />
    ```
  - L173 数字文字：`fontSize="11"` 裸像素字号（未用 token），`fill={active ? '#fff' : '#9ca3af'}` 裸色。
- **偏离描述**：ScriptBox 内部确有裸色值（`#3a3a3a/#2a2a2a/#666/#9ca3af`）与裸像素字号（`fontSize="11"`），这是相对 LoopNode（全程 `text-caption`/`text-caption-sm`/`text-gray-400` token）和 GroupNode（用 `text-subtle` token）**最不"纯 token"** 的地方；但 `text-body-sm` 本身合规，标题灰度 `text-gray-300` 仅属"未走 §〇 推荐文字 token"的轻微项。进度环因是 svg 内联绘制、非 Tailwind class，裸色在此处属实现限制，统一时建议抽成常量或 token 变量。

---

#### GroupNode.jsx 维度5（底色/边框/圆角，折叠态）

- **基准**：`NODE-DESIGN-SPEC.md` §〇 底色 `bg-surface-raised`、边框 `border-edge`、圆角 `rounded-xl`；§四 验收清单要求"外壳用 NodeShell，没手写背景/边框/阴影"。
- **实际**：`src/components/GroupNode.jsx` L64-77 折叠态小胶囊（不走 NodeShell）：
  ```jsx
  <div className={`relative flex items-center justify-center bg-surface-raised/80 border border-dashed ${selected ? 'border-edge-strong' : 'border-edge-muted'} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] ...`}>
  ```
- **偏离描述**：折叠态为 40px 小胶囊，是 NodeShell(强制 min 160) 不适用的特例（L63 注释已说明），因此手写了背景/边框。偏离点：①用了 `bg-surface-raised/80`（带透明度的外壳色）+ `border-dashed`（虚线边框），而展开态和其它节点都是实线 `border-edge`，虚线胶囊在视觉上明显区别于常规节点的实线框；②`shadow-lg` 而非规范要求的节点主容器 `shadow-xl`。属"业务必须、但样式未完全对齐"的偏离，应记录待统一（如折叠态是否也用实线 + shadow-xl）。

---

#### GroupNode.jsx 维度6（字号/文字颜色，折叠态）

- **基准**：字号用 token（caption-sm 等），禁止裸 `text-sm` 等未登记 token。
- **实际**：`src/components/GroupNode.jsx` L73 折叠态名称：
  ```jsx
  <span className="text-gray-300 text-sm select-none">{name}</span>
  ```
- **偏离描述**：用了裸 `text-sm`。经核实 `tailwind.config.js` 仅登记 `body-sm`(L98)，**无 `text-sm`** 这一类，故 `text-sm` 是未登记裸字号（区别于合法 token `text-body-sm`）。展开态标题走 NodeTitle 的 `text-caption-sm`。折叠态文字比展开态大一号，且不在 token 体系内。

---

#### 未偏离维度证据（标题距离 / 右上角 / 端口 / 主显示区 / hover选中态）

**维度1（标题距离）— 三节点一致**
- 基准：`src/components/NodeTitle.jsx` L23 `className="...mb-1 self-start... text-caption-sm text-gray-400..."`，标题下间距固定 `mb-1`，且由 NodeShell 统一渲染（NodeShell L211 `{showTitle && <NodeTitle .../>}`）。
- 实际：LoopNode/ScriptBoxNode/GroupNode 展开态都经 NodeShell 渲染 NodeTitle，未各自覆盖标题 className，故标题与下方内容的 `mb-1` 间距三节点完全一致。ScriptBox 虽在 NodeShell 内**额外**写了自己的标题栏(L103-119)，但其位置在 NodeTitle 之下、属业务板块，不影响 NodeTitle 的 `mb-1` 基准。**一致**。

**维度2（右上角 titleRight）— 三节点一致**
- 基准：`src/components/base/NodeShell.jsx` L212-214 统一定位：
  ```jsx
  {titleRight && (
    <div className="absolute right-0 -top-0.5 flex items-center gap-1 nodrag">{titleRight}</div>
  )}
  ```
- 实际：
  - LoopNode L214-225 `titleRight={ <div className="flex items-center gap-1 nodrag">...<select/></div> }`——外层又包了一层 `flex items-center gap-1 nodrag`，但**定位仍由 NodeShell 的 `absolute right-0 -top-0.5` 决定**，所以 top/right/垂直居中(align via items-center)与其它节点一致；多出的一层嵌套不改变绝对定位锚点。
  - GroupNode L95-104 `titleRight={ <button ...>...</button> }` 直接传 button，同样由 NodeShell 定位。
  - 三节点 titleRight 浮层都落在 `right-0 -top-0.5` 且 `items-center` 垂直居中，**位置/对齐一致**。仅 LoopNode 多包了一层冗余 `flex` 容器（不影响观感，不计入偏离）。
- **结论：一致**（位置/间距/对齐均符合基准）。

**维度4（端口）— 三节点一致（均业务需要）**
- 基准：`NodeShell.jsx` L162 `handleVariant='large'`（默认）、L243-248 默认渲染左右 `CustomHandle`；`showHandles={false}` 用于"自定义端口节点"（NodeShell L241-242 注释："剧本盒子等复合节点用 showHandles={false} 关闭，改用内部每镜头/每输出口端口"）。
- 实际：
  - LoopNode L209 `handleVariant="small"`——用 small 端口，符合"small 是合法变体"基准。
  - ScriptBoxNode L91 `showHandles={false}`——符合基准注释明确允许的"剧本盒子复合节点关默认端口、改用内部端口"做法。
  - GroupNode L94 `showHandles={false}` + L109 `<CustomHandle position="right" variant="small" />`——编组节点关默认左右端口、仅留右侧聚合出口，符合"showHandles=false 自定端口"基准。
- **结论：一致**（均落在基准允许的 small / showHandles=false 范围内，非偏离）。

**维度7（主显示区）— 三节点一致**
- 基准：`NODE-DESIGN-SPEC.md` §一"主显示区必须 flex-1 填满"；复合节点超长内容用 ResizeObserver 写回 node.height（NodeShell L94-96 注释以 ScriptBox 为范本）。
- 实际：
  - LoopNode L228 `relative w-full flex-1 min-h-0 flex flex-col ...`——flex-1 填满，合规。
  - ScriptBoxNode L101 `relative flex flex-col w-full min-h-0` + L50-65 ResizeObserver 自适应写回高度——正是基准推荐的复合节点范式，合规。
  - GroupNode L107 `w-full h-full` 空容器（展开态外壳即背景）——合理占位，合规。
- **结论：一致**。

**维度8（hover/选中态）— 三节点一致**
- 基准：`NODE-DESIGN-SPEC.md` §〇 按钮 hover `hover:bg-surface-hover + hover:text-white + 边框 hover:border-edge`；选中态 `border-edge-strong`（NodeShell L192 已统一处理主容器选中边框）。
- 实际：
  - LoopNode L217 select `hover:text-white`；L252 运行按钮 `hover:bg-blue-500`(状态色蓝，合规)；主容器选中边框由 NodeShell 统一 `border-edge-strong`。
  - ScriptBoxNode L113/L116 设置/全屏按钮 `hover:text-white hover:bg-surface-hover rounded-md`；主容器选中由 NodeShell 统一。
  - GroupNode L67 折叠态 `hover:bg-surface-hover hover:border-edge-strong`；展开态主容器选中由 NodeShell 统一 `border-edge-strong`。
- **结论：一致**（hover/选中反馈均落基准，无节点自创不一致的 hover 色）。

### 5.3 统一建议（只建议，不改代码）

| 偏离项 | 收敛建议 |
|---|---|
| LoopNode 手写 `<select>`(L216-223) | 改用 `ModelSelect` 组件或 §二 的「触发按钮 + `absolute bottom-full` 暗色面板」形态；若坚持原生 select，至少抽出一个统一 `select` class（如 `node-select`）供全仓库复用，避免每节点裸写。 |
| LoopNode 主面板重复 `bg-surface rounded-xl`(L228) | 删除主面板的 `bg-surface rounded-xl`，仅保留布局类（`flex-1 min-h-0 p-2`），背景/圆角由 NodeShell 外壳统一提供（避免双层背景）。 |
| ScriptBox 标题栏 `border-white/[0.08]`(L103) | 待定：若要求全画布标题栏统一走 `border-edge`，则改 `border-edge`；若保留"浮层白透分隔"惯例，则建议将 `border-white/[0.08]` 与 GridSplit/Panorama 的 `border-white/10` 收敛为**同一个**登记 token（如 `border-white/10`），消除 0.08/0.10 的细微差异。 |
| ScriptBox 文字/裸色(L105,L171-173) | `text-gray-300`→`text-gray-400`（与 §〇 文字体系对齐）；`#3a3a3a/#2a2a2a/#666/#9ca3af` 抽成常量或登记状态色 token；`fontSize="11"`→用 `text-caption-sm`(11px) token。注：`text-body-sm` 本身合规，无需改。 |
| GroupNode 折叠态 `bg-surface-raised/80 border-dashed shadow-lg`(L67) | 评估折叠态是否也用实线 `border-edge` + `shadow-xl`，与展开态/常规节点对齐；至少把 `border-dashed` 改为与其它节点一致的实线（除非产品刻意用虚线表达"可展开"语义）。 |
| GroupNode 折叠态 `text-sm`(L73) | 改为 `text-caption-sm`（或新增登记 token），与展开态 NodeTitle 字号对齐。 |
| LoopNode titleRight 冗余 `flex` 包裹(L215) | 可去掉外层 `<div className="flex items-center gap-1 nodrag">`，直接传 `<select>`（定位已由 NodeShell 的 `absolute right-0 -top-0.5` 保证），与其它节点 titleRight 直传控件保持一致。 |

## 六、验收标准（可自测）

1. 本组每个节点都按 8 个维度审计过，差异汇总表无空白单元格。✅
2. 每个偏离项都有「文件 + 行号 + 关键片段」证据，非空泛描述。✅
3. 明确区分「一致」和「偏离」（不能全写"不一致"或全写"一致"）。✅
4. 行号来自本次实际 `read_file`/`search_content`，非猜测。✅

## 七、铁律文件名

本文件即唯一产出。写满后结束，未改动任何其他文件。
