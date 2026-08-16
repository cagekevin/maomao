# TASK-031 — 节点样式一致性审计（图片工具类组）

> 本文件为唯一产出。仅做审计，未修改任何 `src/` 代码，未执行脚本。所有行号来自本次实际 `read_file` 核实，token 取值来自 `tailwind.config.js` 实际定义。
> 覆盖节点：`ImageNode.jsx`、`ImageBoxNode.jsx`、`GridSplitNode.jsx`、`GridMergeNode.jsx`。
> 版本：v2（复审修正版，修正初版中 z-index token 映射、bg-surface 取值、维度1 标题间距、text-xs 措辞、补录 ImageBox 裸 z-20）。

---

## 一、项目背景

maomao 画布节点「大眼一看基本统一，但仔细一看每个节点都有细微不同」。本组审计目标是找出图片工具类节点中偏离统一设计语言（见 `docs/NODE-DESIGN-SPEC.md`）的所有位置。

## 二、统一设计语言基准（审计对照标准）

1. **视觉 DNA**（`NODE-DESIGN-SPEC.md` §〇）：底色 `bg-surface-raised`(主容器 #1c1c1c)/`bg-surface-1`(内层 #222)/`bg-input`(输入 #141414)、文字 token（`text-strong #fff→faint #666`）、边框 `border-edge`(#333)、圆角主容器 `rounded-xl`、字号 token（`text-2xs`8/`text-meta`9/`text-caption`10/`text-caption-sm`11/`text-body-xs`12，**禁止 `text-[10px]` 等裸字号**）、状态色蓝/绿/红/黄/紫、z-index **一律语义 token**（见下）、拖拽 `drag-handle cursor-move`、hover `hover:bg-surface-hover + hover:text-white`。
2. **z-index 语义 token**（取自 `tailwind.config.js` L21-39）：`base`0 < `node-inner`10 < `node-inner-2`20 < `dropdown`50 < `float`100 < `topnav`200 < `canvas-tools`700 < `sidebar`800 < `popover`1000 < `modal`9999 < …。基准：节点内部浮层用 `dropdown`/`float`，弹层用 `popover`/`modal`，**禁裸数字**。
3. **板块规划**（§一）：NodeShell 外壳 + NodeTitle 标题 + titleRight 右侧操作 + HoverToolbar + 主显示区(flex-1) + ExpandablePanel。
4. **设置项 7 种形态**（§二）：分段按钮 `px-2 py-0.5 rounded text-caption border`；下拉菜单触发+`absolute bottom-full` 面板 `bg-surface-1 ... shadow-xl z-popover`；数值输入 `w-* bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge`；文本输入 `flex-1 bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge`；开关 `accent-blue-500`；颜色选择 `input[type=color]`；弹层。禁止自创控件。
5. **NodeShell 默认实现**（`src/components/base/NodeShell.jsx`）：titleRight `absolute right-0 -top-0.5 flex items-center gap-1 nodrag`(L212-214)、NodeTitle `mb-1 self-start`(NodeTitle.jsx L23)、端口 `handleVariant` large(48)/small(32)、主壳 `bg-surface-raised rounded-xl border shadow-xl`(L192)；注释明确 children 不应重复写 `rounded-xl`/背景(L86-87)。

---

## 三、探索起点（本次实际核实）

- `src/components/ImageNode.jsx` — NodeShell L192-199：`handleVariant="small"`、`aspectRatio={null}`、无 titleRight；主显示区 `bg-surface-strong`(L217)；使用 `<HoverToolbar>`(L202)。
- `src/components/ImageBoxNode.jsx` — NodeShell L391-424：`handleVariant={smallHandle}`(L398)、`showHandles={false}`(L399)、titleRight 全选/展开(L400-423)、自定义 in/active 端口(L427-428)、手写 hover 悬浮栏 `z-20`(L434)。
- `src/components/GridSplitNode.jsx` — NodeShell L741-756：`showHandles={false}`(L747)、titleRight 模式切换(L748-754)、按钮 `px-1.5 py-0.5`(L587)、内容 `rounded-xl`(L760)、裸 `z-[100]/z-[80]`(L624/639/659/731)。
- `src/components/GridMergeNode.jsx` — NodeShell L386-401：`showHandles={false}`(L393)、titleRight 模式切换(L394-400)、按钮 `px-1.5 py-0.5`(L375)、内容 `bg-surface`(L406)、原生 `<select>` L626-639。

---

## 四、覆盖清单（8 维度逐项核对）

### 5.1 差异汇总表（本组所有节点 × 8 维度）

| 节点文件 | 标题距离 | 右上角 | 下拉/select | 端口 | 底色边框 | 字号颜色 | 主显示区 | hover/选中态 |
|---|---|---|---|---|---|---|---|---|
| ImageNode.jsx | 一致 | 一致(无 titleRight) | 一致(无) | 一致:small(L198) | 一致 | 一致 | 一致:flex-1 居中(L215-217) | 一致(HoverToolbar L202) |
| ImageBoxNode.jsx | 偏离:内容无 padding，标题间距更小(L462) | 偏离:按钮 `px-1.5 py-0.5`(L404,418) | 一致(无) | 一致:small 自定义(L427-428) | 一致 | 一致 | 一致:flex-1(L462-463) | 偏离:手写 hover 栏 `z-20`(L434)，未用 HoverToolbar |
| GridSplitNode.jsx | 偏离:内容 `p-2` 增大标题间距(L760) | 偏离:按钮 `px-1.5 py-0.5`(L587-589) | 一致(无原生 select) | 一致:small 自定义(L757-758) | 偏离:内容 `rounded-xl` 嵌套(L760) | 偏离:裸 `z-[100]/z-[80]`(L624,639,659,731) | 一致:flex 容器 | 一致 |
| GridMergeNode.jsx | 偏离:内容 `p-3` 标题间距最大(L406) | 偏离:按钮 `px-1.5 py-0.5`(L375-377) | 偏离:原生 `<select>` `text-xs`+`px-2`(L626-639) | 一致:small 自定义(L403-404,684) | 偏离:内容 `bg-surface` 填充(L406) | 一致(均 token，含默认 text-xs) | 一致:flex 容器 | 一致 |

> 单元格：`一致` / `偏离: 描述(L行号)`。

---

### 5.2 详细差异清单

#### 维度1 · 标题栏(NodeTitle) 与下方内容间距
- **基准**：NodeTitle 统一 `mb-1 self-start`(NodeTitle.jsx L23)，各节点主显示区应从同一视觉基线起排。
- **实际**：
  - `ImageNode.jsx` L215 主容器 `<div className="relative w-full flex flex-col flex-1">` — **无 padding**，标题下沿紧贴内容。
  - `ImageBoxNode.jsx` L462-463 `<div className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col">` — **无 padding**。
  - `GridSplitNode.jsx` L760 `<div ... className="p-2 space-y-2 ...">` — **`p-2`(8px)**，标题到首行内容多 8px 间距。
  - `GridMergeNode.jsx` L406 `<div ... className="p-3 space-y-3 ...">` — **`p-3`(12px)**，标题到首行内容间距最大。
- **偏离描述**：四个节点标题→内容的实际间距 = `mb-1`(4px) + 各自内容 padding(0 / 0 / 8px / 12px)。用户肉眼可见 GridSplit、GridMerge 的标题与内部控件之间有明显留白，而 ImageNode/ImageBox 几乎贴着。属同一组内不一致。

#### 维度2 · 右上角(titleRight) 设置控件位置/间距
- **基准**：§二 分段按钮 `px-2 py-0.5`；NodeShell 统一把 titleRight 渲染为 `absolute right-0 -top-0.5 flex items-center gap-1 nodrag`(L212-214)，故**定位/垂直对齐/间距四节点一致**（此项不偏离）。偏离在按钮自身水平内边距。
- **实际**：
  - `ImageBoxNode.jsx` L404、L418：`className="px-1.5 py-0.5 rounded hover:bg-surface-hover-strong ..."`
  - `GridSplitNode.jsx` L587-589：`className={`px-1.5 py-0.5 rounded text-caption ...`}`
  - `GridMergeNode.jsx` L375-377：`className={`px-1.5 py-0.5 rounded text-caption ...`}`
- **偏离描述**：三节点 titleRight 按钮均 `px-1.5`，而 SPEC 分段按钮范例及同组 `GridSplitNode` 预设按钮(L798 `px-2 py-0.5`)、`GridMergeNode` 预设按钮(L596 `px-2 py-0.5`)用 `px-2`。即同一节点内「右上方模式按钮(px-1.5)」与「下方同类预设按钮(px-2)」内边距不统一，右上方操作按钮更窄、字距更挤，大眼可见。

#### 维度3 · 下拉/select 控件
- **基准**：§二 下拉菜单应为「触发按钮 + `absolute bottom-full` 面板 `bg-surface-1 border-edge rounded-lg shadow-xl ... z-popover`」；或统一 select class。禁止自创控件。
- **实际**：`GridMergeNode.jsx` L626-639 使用浏览器原生 `<select>`：
  ```jsx
  <select value={autoSize ? 'auto' : cellSize} ... className="bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge outline-none flex-1" ...>
  ```
  及 L633 同样原生 `<select>`（比例）。同文件无其它下拉控件。
- **偏离描述**：
  1. 用原生 `<select>` 而非规范浮层形态。原生 select 在暗色画布下展开的是系统亮色面板，与画布暗色 DNA 突兀（其它节点下拉/菜单均自绘暗色 `bg-surface-1` 面板）。
  2. 字号用 Tailwind 默认 `text-xs`(12px = 项目 token `text-body-xs`)，虽非「裸字号」但比同节点右上方模式按钮的 `text-caption`(10px) 大 2px，字号不统一。
  3. 水平内边距 `px-2`，而同节点数值输入（L614/L617/L659/L661）用 `px-1.5`，控件内边距不一致。
  > 说明：原生 select 属「下拉菜单」形态的一种实现，不属「自创控件」，但样式细节（系统亮色面板、`text-xs`、`px-2`）偏离规范推荐形态。

#### 维度4 · 端口(CustomHandle) 大小/位置
- **基准**：§〇 端口 size 用 large(48)/small(32)；不需要默认端口时 `showHandles={false}` + 自定 CustomHandle（NodeShell doc L104）。
- **实际**：
  - `ImageNode.jsx` L198 `handleVariant="small"` → NodeShell 渲染默认 small 左右端口。
  - `ImageBoxNode.jsx` L398 `showHandles={false}` + L427-428 自定义 `CustomHandle variant={smallHandle}`（in/active）。
  - `GridSplitNode.jsx` L747 `showHandles={false}` + L757-758 自定义 small（in/batch）。
  - `GridMergeNode.jsx` L393 `showHandles={false}` + L403-404/684 自定义 small（default/merged-output/batch-output）。
- **偏离描述**：四节点端口 `variant` 均为 `small`，尺寸一致；自定端口为合理业务需求（多端口），**一致，无偏离**。

#### 维度5 · 底色/边框/圆角/阴影 是否用 token
- **基准**：§〇 主壳 `bg-surface-raised rounded-xl border shadow-xl`；NodeShell 注释明确要求 children 不再重复写 `rounded-xl`/背景(L86-87)。
- **实际（偏离项）**：
  - `GridSplitNode.jsx` L760 内容根 `<div ... className="p-2 space-y-2 relative z-10 rounded-xl w-full">` — 在已 `rounded-xl` 主壳内再套 `rounded-xl`，形成嵌套圆角。
  - `GridMergeNode.jsx` L406 内容根 `<div ... className="p-3 space-y-3 bg-surface relative drag-handle w-full">` — 额外 `bg-surface`(#1a1a1a) 覆盖主壳 `bg-surface-raised`(#1c1c1c)。
- **偏离描述**：
  - GridSplit 的 `rounded-xl` 冗余：若内部填充背景会呈现双重描边；即便当前未填背景，仍与「不在 children 重复圆角」规范相悖（对比 ImageNode 主显示区仅图片 `rounded-lg`，无额外圆角）。
  - GridMerge 的 `bg-surface`(#1a1a1a) 比主壳 `#1c1c1c` 更深一档，使图片拼图节点内容区比其它节点更黑，大眼可见「这个节点里面发暗」。同时 `p-3` 比 GridSplit `p-2` 内边距更大，组内不一致。
  - 其余底色均用 token（ImageNode `bg-surface-strong`#161616、ImageBox 空态 `bg-surface-muted`#151515），属规范内，一致。

#### 维度6 · 字号/文字颜色 是否用 token
- **基准**：§〇 一律 token（`text-caption`/`text-caption-sm`/`text-body-xs` 等），禁 `text-[10px]` 裸字号、禁 `#xxx` 裸色值。
- **实际**：四节点文字均用 token（`text-caption`/`text-caption-sm`/`text-meta`/`text-gray-*` 等），未发现 `text-[Npx]` 裸字号或 `#xxx` 裸文字色。GridMerge 唯一非项目命名的是原生 `<select>` 上的 `text-xs`（Tailwind 默认 12px，等价于项目 `text-body-xs`），非裸值。
- **偏离描述**：**无「裸字号/裸色值」偏离**。注：维度3 已记录 GridMerge `text-xs` 与按钮 `text-caption` 的**字号大小不统一**（12px vs 10px），属同组观感不一致但非违规裸值。

#### 维度7 · 主显示区 是否 flex-1 填满/居中/性能降级
- **基准**：§一 主显示区必须 flex-1 填满、内容居中、性能降级一致。
- **实际**：
  - `ImageNode.jsx` L215-217 `flex-1 ... flex items-center justify-center`，含 `useMediaDegrade` 降级(L221)。
  - `ImageBoxNode.jsx` L462-463 `flex-1 ... flex flex-col`，含 `isHidden('image')`(L40/L483)。
  - `GridSplitNode.jsx` 预览框 `h-[180px]`(L764) 固定高 + `isHidden('image')`(L765)。
  - `GridMergeNode.jsx` 预览框 `minHeight:160, maxHeight:360`(L411) + `toAbsoluteFileUrl(preview)`。
- **偏离描述**：四节点均 flex-1 居中且做了性能降级处理，**一致，无偏离**。注：GridSplit/GridMerge 预览区用固定/限高而非纯 flex-1 自适应，属业务需要（拼合预览需稳定比例），不记偏离。

#### 维度8 · hover 反馈/选中态
- **基准**：§〇 按钮 `hover:bg-surface-hover + hover:text-white + border hover:border-edge`；选中 `border-edge-strong`。
- **实际（偏离项）**：
  - `ImageBoxNode.jsx` L434 手写悬浮操作栏：`<div className="absolute -top-12 ... z-20 opacity-0 group-hover/node:opacity-100 ... nodrag">`，内部按钮用 `hover:bg-surface-hover-strong`(L436 等)，未复用 `HoverToolbar` 组件（ImageNode L202 用了 `<HoverToolbar>`）。
  - 其余节点（ImageNode HoverToolbar、GridSplit/GridMerge 控制区按钮）均符合 hover token。
- **偏离描述**：
  1. `z-20` 为裸数字，对应语义 token `z-node-inner-2`(20)；违反「z-index 一律语义 token」铁律（与 GridSplit 的 `z-[100]/z-[80]` 同为裸 z-index 类问题）。
  2. ImageBox 自写 hover 栏样式（胶囊 `bg-surface-raised/90 backdrop-blur-md rounded-full`，L435）与 ImageNode 的 `HoverToolbar` 组件非同一实现，按钮圆角/底色微差；NodeShell doc L110 已注明「ImageBoxNode 手写是历史遗留，别模仿」。属历史遗留偏离，记录备查。

---

### 5.3 统一建议（仅建议，不改代码）

| # | 偏离项 | 收敛建议 |
|---|---|---|
| 1 | 维度1 标题间距（GridSplit `p-2` / GridMerge `p-3` vs ImageNode/ImageBox 0） | 统一内容根 padding（建议全组 `p-2`），让标题→内容视觉间距一致。 |
| 2 | 维度2 三节点 titleRight 按钮 `px-1.5` | 统一 `px-2 py-0.5`，与同节点预设按钮(L798/L596)及 SPEC 分段按钮一致；或反向把预设按钮也降 `px-1.5`，但须全组唯一。 |
| 3 | 维度3 GridMerge 原生 `<select>` | 替换为规范「触发按钮 + `absolute bottom-full` 面板」形态（复用 PromptNode 画质菜单 / ModelSelect），字号 `text-caption`、内边距 `px-1.5` 对齐数值输入，消除系统亮色面板。 |
| 4 | 维度5 GridSplit 内容 `rounded-xl`(L760) | 删除 `rounded-xl`，主壳已提供；保留 `p-2 space-y-2 z-10 w-full`。 |
| 5 | 维度5 GridMerge 内容 `bg-surface`(L406) | 删除 `bg-surface`，让主壳 `bg-surface-raised` 透出；`p-3` 对齐为 `p-2`（配合建议1）。 |
| 6 | 维度6/3 GridMerge `<select>` `text-xs` | 跟随建议3 改用 `text-caption`，与右上方模式按钮字号统一。 |
| 7 | 维度6/8 GridSplit 裸 `z-[100]/z-[80]`(L624/639/659/731) | `z-[100]`→语义 token `z-float`(100，值完全相同)；`z-[80]` 无精确 token，就近取 `z-float`(100) 或 `z-dropdown`(50)，避免裸数字。 |
| 8 | 维度8 ImageBox 裸 `z-20`(L434) | 改用语义 token `z-node-inner-2`(20，值相同)。 |
| 9 | 维度8 ImageBox 手写 hover 栏 | 迁移到 `HoverToolbar` 组件，与 ImageNode 同实现，消除样式微差（历史遗留，低优先级）。 |

---

## 六、验收标准自检

1. 本组 4 节点均按 8 维度审计，差异汇总表无空白单元格。✅
2. 每个偏离项均有「文件 + 行号 + 关键片段」证据，非空泛描述。✅
3. 明确区分「一致」与「偏离」（ImageNode 8 维全一致；ImageBox/GridSplit/GridMerge 具体维度标注偏离）。✅
4. 行号与 token 取值均来自本次实际 `read_file` / `tailwind.config.js`，非猜测；v2 已修正初版的 z-index 映射、bg-surface 取值、维度1 间距、text-xs 措辞，并补录 ImageBox 裸 `z-20`。✅

## 七、铁律文件名

本文件即唯一产出，未改动任何其他文件。
