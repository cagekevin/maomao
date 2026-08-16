# TASK-032 — 节点样式一致性审计（视频3D类组）

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

1. **视觉 DNA**（docs/NODE-DESIGN-SPEC.md §〇）：
   - 底色：节点主容器 `bg-surface-raised`(#1c1c1c)，内层面板 `bg-surface-1`(#222)，输入 `bg-surface-hover`/`bg-input`(#141414)，内容区深 `bg-canvas`/`bg-surface-muted`(#151515)
   - 文字：强 `text-strong`(fff) → 弱 `text-muted`(#888) → 最弱 `text-faint`(#666)
   - 边框：常态 `border-edge`(#333)，hover `border-edge-strong`/`hover:border-edge-muted`，选中 `border-edge-strong`
   - 圆角：主容器 `rounded-xl`，卡片/按钮 `rounded-md`/`rounded-lg`，胶囊 `rounded-full`
   - 字号：节点 UI 全用 `text-2xs`(8)/`text-meta`(9)/`text-caption`(10)/`text-caption-sm`(11)/`text-body-xs`(12)，**禁止** `text-[10px]` 等裸字号
   - 阴影：主容器 `shadow-xl`，弹层 `shadow-popover`，选中 `shadow-glow-*`
   - 状态色：蓝 `#3b82f6`/绿 `#22c55e`/红 `#ef4444`/黄 `#eab308`/紫 `#d946ef`
   - z-index：一律语义 token（`z-dropdown`/`z-popover`/`z-modal`），**禁裸数字**
   - 拖拽：内容区 `drag-handle cursor-move`，交互控件标 `nodrag`
   - hover 反馈：按钮 `hover:bg-surface-hover` + `hover:text-white` + `hover:border-edge`；选中项 `bg-surface-hover-strong text-white border-edge-strong`
2. **板块规划**（§一）：NodeShell 外壳 + NodeTitle 标题 + titleRight 右侧操作 + HoverToolbar + 主显示区(flex-1) + ExpandablePanel。
3. **设置项 7 种形态**（§二）：分段按钮/下拉菜单/数值输入/文本输入/开关/颜色选择/弹层。下拉菜单形态 = 触发按钮 + `absolute bottom-full` 面板 `bg-surface-1 border-edge rounded-lg shadow-xl p-3 z-popover`，选项选中 `bg-surface-hover-strong text-white`。禁止自创控件样式。
4. **NodeShell 默认实现**（src/components/base/NodeShell.jsx）：
   - titleRight 容器 `absolute right-0 -top-0.5 flex items-center gap-1 nodrag`（L212-214）
   - NodeTitle 在框内 `mb-1 self-start`（L211 + NodeTitle L23）；`floating` 时变 `absolute -top-6 left-0 z-30`（NodeTitle L23）
   - 主容器 `bg-surface-raised rounded-xl border shadow-xl transition-colors duration-200 drag-handle cursor-move` + 选中 `border-edge-strong`/常态 `border-edge hover:border-edge-muted`（L192）
   - 端口：默认 `showHandles=true` 渲染 `CustomHandle` left+right，`variant={handleVariant}`（默认 `large`），定位相对根 div 中点（L243-248）
   - 默认尺寸 `defaultHeight=420`/`minWidth=160`/`minHeight=160`（L159/155/156）

> 审计时，凡本组节点**偏离以上任一基准**的地方，都要记录。

## 三、探索起点（本次实际核实，read_file 全文）

| 文件 | 是否用 NodeShell | 标题方式 | 端口方式 |
|---|---|---|---|
| src/components/VideoExtractNode.jsx | **否**（手写外壳 L339-340） | `<NodeTitle floating />`（L326） | 原生 `<Handle>`（L343/587） |
| src/components/VideoProcessNode.jsx | **否**（手写外壳 L1136-1137） | `<NodeTitle floating />`（L1126） | `CustomHandle variant="small"`（L1135/1486） |
| src/components/PanoramaNode.jsx | **是**（L227 `<NodeShell>`） | 框内 `mb-1 self-start`（NodeShell L211） | NodeShell 默认 large（未传 showHandles） |
| src/components/Director3DNode.jsx | **是**（L120 `<NodeShell>`） | 框内 `mb-1 self-start` | NodeShell 默认 large + 自加 large（L152/153） |

补充核实：
- VideoExtractNode 手写 select（L505-515，抽帧模式）；minWidth=280（L322/330）；字号多 `text-xs`（L364/383/420/462/468/480/484/497/508/526/540/571/575）
- VideoProcessNode select 4 处（L1377/1385/1393/1401，gif 参数）；裸色值遍布（`bg-[#1b1b1b]` L1137 等）；`text-[10px]` 无
- PanoramaNode titleRight 含 select（L245-252）；裸 `text-[10px]`（L135/136/141/143）；裸 z-index `z-[5]`(L179)/`z-[9999]`(L188)；aspectRatio="16:9"、defaultHeight=360（L234-235）
- Director3DNode defaultHeight=260（L126）；主显示区自套外壳（L131）；裸 z-index `z-[9999]`(L157)

## 四、覆盖清单（8 维度，本组每节点逐项）

1. 标题栏(NodeTitle) 与下方内容/边框距离（mb、padding、行高）
2. 右上角(titleRight) 控件位置/间距/对齐
3. 下拉/select 控件样式（bg、border、rounded、padding、font、高度；是否 §二 形态）
4. 端口(CustomHandle) 大小/位置（large vs small、是否 showHandles=false 自定端口）
5. 底色/边框/圆角/阴影 是否用 token，有无裸色值
6. 字号/文字颜色 是否用 token，有无 text-[10px]/#xxx 裸值
7. 主显示区 是否 flex-1 填满、内容居中、性能降级
8. hover 反馈/选中态 是否一致；z-index 是否裸数字（§〇 补充维度）

## 五、输出规范

### 5.1 差异汇总表（本组所有节点 × 8 维度）

| 节点文件 | ①标题距离 | ②右上角 | ③下拉/select | ④端口 | ⑤底色边框 | ⑥字号颜色 | ⑦主显示区 | ⑧hover/选中 + z-index |
|---|---|---|---|---|---|---|---|---|
| VideoExtractNode.jsx | 偏离: `floating` 标题 `-top-6` 浮于框外(L326)，与 NodeShell 内 `mb-1` 体系不同 | 偏离: 无 titleRight，操作全在底部(L475-583)，与 NodeShell `absolute right-0 -top-0.5`(L213) 体系不同 | 偏离: 手写 select `bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs`(L508)，原生非 §二 面板形态；focus `border-white`(L508) | 偏离: 原生 `<Handle>`(L343/587)，无 large/small 变体 | 轻微偏离: 主体 `bg-surface-raised rounded-xl` 合规(L340)，但 `transition-all duration-300` 非基准 `transition-colors duration-200`(L192) | 偏离: 大量 `text-xs`(L364/383/420/462/468/480/484/497/508/526/540/571/575) 非 §〇 字号 token | 一致: `flex-1` 内容区(L349)填满 | 一致: `hover:border-edge-muted`(L340) + `hover:bg-surface-hover-strong`(L355/386/484)；z 无裸值 |
| VideoProcessNode.jsx | 偏离: `floating` 标题 `-top-6`(L1126) | 偏离: 无 titleRight，模式切换在内容区 grid(L1142-1153) | 偏离: select 4 处(L1377/1385/1393/1401) `bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm`，与 VideoExtract(L508) **互相不一致**；focus `border-edge-strong`(L1377) | 偏离: `CustomHandle variant="small"`(L1135/1486)，同组 Director3D 用 large，VideoExtract 用原生 Handle，三节点三种 | 严重偏离: 裸 `bg-[#1b1b1b]`(L1137/1454/1490)、`bg-[#202020]`(L1211/1512)、`bg-[#303030]`(L1078/1157/1242)、`border-[#343434]`/`border-[#666]`(L1137)、`border-[#3b3b3b]`(L953)、`bg-[#272727]`(L953)、`bg-[#292929]`(L1479)、`bg-[#383838]`(L1043)、`bg-[#505050]`(L1036)、`border-[#ededed]`(L1148/1324/1414)、`border-[#ddd]`(L1362)；圆角 `rounded-lg`(L1137) 非 `rounded-xl` | 偏离: 无裸 `text-[10px]`，但裸色值即属偏离；`text-xs`? 本节点主用 token，子块 `border-[#777]` focus(L951) | 一致: `flex-1`(L1140)；内部 panel 混用 `bg-[#202020]`/`bg-surface-subtle`(L1211/1242) | 偏离: 选中 `border-[#666]`(裸,L1137) 非 `border-edge-strong`；hover `border-[#484848]`(裸,L1137)；z 无裸值 |
| PanoramaNode.jsx | 一致: NodeShell 内 `mb-1 self-start`(L211/NodeTitle L23) | 部分偏离: titleRight 容器定位复用 NodeShell `absolute right-0 -top-0.5`(L213) 一致；但内部 select 紧贴按钮(L240-253) | 偏离: select(L245-252) `bg-surface-black text-gray-300 text-caption px-1 py-0.5` 极小，与 VideoExtract/VideoProcess 三者均不同；原生非 §二 形态 | 一致: NodeShell 默认 large（未传 showHandles） | 一致: 外壳由 NodeShell 提供 `bg-surface-raised`(L192) | 严重偏离: 裸 `text-[10px]`(L135/136/141/143) + `font-bold`(L136)，违反 §〇 禁用裸字号 | 一致: 主显示区 `bg-black`(L261) 填满 | 一致: 选中 `border-edge-strong`(L192)；**但裸 z-index `z-[5]`(L179)/`z-[9999]`(L188) 违反 §〇** |
| Director3DNode.jsx | 一致: NodeShell `mb-1 self-start` | 一致(允许): 无 titleRight，本节点确无右侧操作 | 无 select（一致: 无下拉控件） | 严重偏离: 未传 `showHandles={false}`，NodeShell 已渲染默认 large 端口(L243-248) + 节点内又加 large(L152/153) → **双层端口** | 偏离: 外壳 NodeShell `bg-surface-raised` 合规；但主显示区自套 `bg-surface-muted rounded-xl overflow-hidden border border-edge shadow-xl`(L131) 双重圆角/阴影/边框 | 一致: `text-xs text-gray-500`(L140) token | 偏离: 主显示区 `minHeight:200`(L132) 硬编码 + 内嵌 `bg-surface-muted rounded-xl`(L131) 与外层双重圆角 | 一致: NodeShell hover `hover:border-edge-muted`(L192)；**但裸 z-index `z-[9999]`(L157) 违反 §〇** |

> 说明：VideoExtractNode / VideoProcessNode 未用 NodeShell，因此其标题距离、右上角、端口等「结构维度」整体偏离 NodeShell 基准，属「架构级偏离」；PanoramaNode / Director3DNode 用 NodeShell，仅细节偏离。

### 5.2 详细差异清单（每个偏离项）

---

#### VideoExtractNode.jsx ①标题距离
- **基准**：NodeShell 内 NodeTitle `mb-1 self-start`（NodeShell L211 + NodeTitle L23），标题在内容框**内**，与下方边框有固定 `mb-1` 间距。
- **实际**：L326 `<NodeTitle defaultTitle="视频抽帧" icon={...} floating />`，`floating` → `absolute -top-6 left-0 z-30`（NodeTitle L23），浮在节点**上方外部**，不占布局。
- **偏离描述**：与用 NodeShell 的 Panorama/Director3D 标题「在框内、mb-1」完全不同。用户「左上角标题离下面边框距离」观感不一致——此节点标题飘在框外 24px，其余在框内贴顶。

#### VideoExtractNode.jsx ②右上角
- **基准**：NodeShell 默认 titleRight 容器 `absolute right-0 -top-0.5 flex items-center gap-1 nodrag`（L213）。
- **实际**：无 titleRight；所有操作（配置按钮 L565、开始处理 L574）放在底部 `border-t border-edge-faint`（L475-583）。
- **偏离描述**：右侧无设置控件，与「节点可在右上放模式切换/全选」板块规划（§一）不一致，与有 titleRight 的 Panorama 形成对照差异。属「无 titleRight」分支。

#### VideoExtractNode.jsx ③下拉/select
- **基准**：§二 下拉菜单形态 = 触发按钮 + `absolute bottom-full` 面板 `bg-surface-1 border-edge rounded-lg shadow-xl p-3 z-popover`。
- **实际**：L505-515 手写原生 `<select>`：
```jsx
<select value={mode} onChange={...}
  className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors">
```
- **偏离描述**：① 裸原生 select，无 popover 面板形态，与 §二 不符；② 字号 `text-xs`(12) 非节点小字号 token；③ focus 用裸 `border-white` 而非 token；④ 与 VideoProcessNode 的 select（`rounded px-1.5 py-1 text-caption-sm`，L1377）**自身样式互不一致**（圆角、padding、字号均不同）。

#### VideoExtractNode.jsx ④端口
- **基准**：端口由 NodeShell 用 CustomHandle 渲染 large(48)/small(32)（NodeShell L243-248），统一在节点中点。
- **实际**：L343 `<Handle type="target" position={Position.Left} />`、L587 `<Handle type="source" position={Position.Right} id="main-output" />`（原生 Handle，无尺寸/样式变体）。
- **偏离描述**：未用 CustomHandle，无 large/small 变体，端口视觉尺寸/位置与用 NodeShell 的节点（Director3D large、VideoProcess small）完全不同。

#### VideoExtractNode.jsx ⑤底色边框
- **实际**：L340 `bg-surface-raised rounded-xl overflow-hidden border shadow-xl transition-all duration-300`——底色/圆角/阴影 token 合规。
- **偏离描述**：仅 `transition-all duration-300` 与基准 `transition-colors duration-200`（NodeShell L192）不同（过渡属性/时长），属轻微偏离。底色边框主体一致。

#### VideoExtractNode.jsx ⑥字号颜色
- **实际**：底部大量 `text-xs`（L364/383/420/462/468/480/484/497/508/526/540/571/575）。
- **偏离描述**：`text-xs`(12px) 非 §〇 规定的节点 UI 字号 token 体系（text-2xs/meta/caption/caption-sm/body-xs）。虽非裸 `text-[12px]` 值，但 token 选用偏离节点小字号规范。

---

#### VideoProcessNode.jsx ①标题距离
- **实际**：L1126 `<NodeTitle ... floating />`，同 VideoExtractNode，`-top-6` 浮于框外。
- **偏离描述**：与 NodeShell 内 `mb-1` 标题体系不同（同 VideoExtractNode ①）。

#### VideoProcessNode.jsx ③下拉/select
- **实际**：L1377/1385/1393/1401 四组 select，例如：
```jsx
<select value={gifMaxSize} ... className="nodrag bg-surface-1 border border-edge rounded px-1.5 py-1 text-caption-sm text-gray-200 outline-none focus:border-edge-strong">
```
- **偏离描述**：① 与 VideoExtractNode 的 select（L508 `rounded-md px-3 py-2 text-xs`）**互相不一致**（圆角、padding、字号 token 均不同）；② 原生 select 未用 §二 下拉面板形态；③ focus 用 `border-edge-strong` 而 VideoExtract 用 `border-white`，二者 focus 态也不统一。

#### VideoProcessNode.jsx ④端口
- **实际**：L1135 `<CustomHandle position="left" handleId="default" variant="small" />`、L1486 `<CustomHandle position="right" handleId="main-output" variant="small" />`。
- **偏离描述**：用 small 变体，而同组 Director3D 用 large（L152/153），VideoExtract 用原生 Handle。端口大小三节点三种，不一致。

#### VideoProcessNode.jsx ⑤底色边框（最严重）
- **实际**：L1137 主容器 `bg-[#1b1b1b] rounded-lg overflow-hidden border shadow-xl ... ${selected ? 'border-[#666]' : 'border-[#343434] hover:border-[#484848]'}`。另 L1078 `bg-[#303030]`、L1157/1242 `border-[#303030]`、L1211/1512 `bg-[#202020]`、L1148/1324/1414 `border-[#ededed]`、L1454/1490 `bg-[#1b1b1b]`、L1479 `bg-[#292929]`、L952 `hover:bg-[#303030]`、L953 `border-[#3b3b3b] bg-[#272727]`、L1036 `border-[#505050]`、L1043 `bg-[#383838]`、L1288 `hover:bg-[#3a3a3a]`、L951 `focus:border-[#777]`、L1362 `border-[#ddd]`。
- **偏离描述**：**严重偏离 §〇**——未用 `bg-surface-raised`(应为 #1c1c1c，此用 #1b1b1b 近似裸值)、圆角 `rounded-lg`(应为 `rounded-xl`)、边框裸 `#343434/#666/#484848/#3b3b3b/#505050/#777/#ddd/#ededed`(应为 `border-edge`/`border-edge-strong` token)、大量裸背景裸边框色值。此节点几乎全用裸色值，是四节点中偏离最严重的一个。

#### VideoProcessNode.jsx ⑧选中态 / z-index
- **实际**：L1137 选中 `border-[#666]`（裸值），hover `border-[#484848]`（裸值）。
- **偏离描述**：基准选中态应为 `border-edge-strong`（NodeShell L192，语义 token），此用裸 `#666`，未走 token，颜色与边缘 token 体系脱节。z-index 无裸值（已核实，L 全文件无 `z-[`）。

#### VideoProcessNode.jsx ⑦主显示区
- **实际**：L1140 `flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto` 填满。
- **偏离描述**：flex-1 一致；但内部 panel 容器 L1211 `bg-[#202020]`、L1242 `bg-surface-subtle` 混用裸值与 token，降级处理未统一。

---

#### PanoramaNode.jsx ②右上角
- **实际**：L237-256 titleRight 内放「全景设置」按钮 + 条件 select：
```jsx
<select value={panoType} ... className="bg-surface-black text-gray-300 text-caption px-1 py-0.5 rounded border border-edge-muted outline-none cursor-pointer">
```
- **偏离描述**：titleRight 容器定位复用 NodeShell `absolute right-0 -top-0.5`（L213）体系，对齐一致；但内部 select 样式 `bg-surface-black text-caption px-1 py-0.5`（极小、极扁）与 VideoExtract/VideoProcess 的 select 三者均不同，且 select 紧贴按钮无额外间距。

#### PanoramaNode.jsx ③下拉/select
- **偏离描述**：如上，select 外观（`bg-surface-black ... px-1 py-0.5`，L248）与同组另两个手写 select 均不一致，且同样未采用 §二 下拉面板形态。

#### PanoramaNode.jsx ⑥字号颜色（裸字号）
- **实际**：L135 `text-[10px] text-gray-400`、L136 `text-[10px] ... font-bold`、L141 `text-[10px]`、L143 `text-[10px]`（renderRatioSelect）。
- **偏离描述**：**违反 §〇 铁律**——直接使用裸字号 `text-[10px]`，规范明确「禁止 `text-[10px]` 等裸字号」。四节点中唯一出现裸 `text-[10px]` 的节点。

#### PanoramaNode.jsx ⑧ z-index（裸数字）
- **实际**：L179 `z-[5]`（比例虚线遮罩）、L188 `z-[9999]`（全屏球体漫游 portal 根）。
- **偏离描述**：**违反 §〇 铁律**——z-index 一律语义 token（`z-dropdown`/`z-popover`/`z-modal`），禁裸数字。此处用裸 `z-[5]`/`z-[9999]`。虽处全屏 portal，仍属裸 z-index，应改用 `z-modal` 等语义 token。

---

#### Director3DNode.jsx ④端口（双层端口）
- **基准**：端口由 NodeShell 统一渲染；自定义端口节点应 `showHandles={false}` 关闭默认再自加（NodeShell L243 注释 + §三）。
- **实际**：L120-128 NodeShell 未传 `showHandles`（默认 true → NodeShell 渲染默认 large 左右端口，L243-248）；节点内又 L152/153 额外加 `<CustomHandle type="target" position="left" variant="large" />` 与 `<CustomHandle type="source" position="right" variant="large" />`。
- **偏离描述**：**双层端口**——NodeShell 默认端口 + 节点自定义端口重叠渲染（共 4 个端口、左右各一对重叠）。既与基准「自定义端口节点应 `showHandles={false}`」冲突，也造成视觉重复。修复应为传 `showHandles={false}` 仅保留自加端口。

#### Director3DNode.jsx ⑦主显示区（双重外壳）
- **实际**：L131 主显示区 `relative flex-1 bg-surface-muted rounded-xl overflow-hidden border border-edge shadow-xl cursor-pointer`，L132 `style={{ minHeight: 200 }}`。
- **偏离描述**：① 外壳已 NodeShell 提供 `bg-surface-raised rounded-xl border shadow-xl`（L192），此又在主显示区自套一层 `bg-surface-muted rounded-xl border border-edge shadow-xl`——**双重圆角/双重阴影/双重边框**（NodeShell 注释 L85-87 明确反对「重复写会出双重外框」）；② `minHeight:200` 硬编码（L132），未用 token/响应式，与 PanoramaNode 用 `nodeSize.w/h` 内联尺寸（L261）策略也不一致。

#### Director3DNode.jsx ⑧ z-index（裸数字）
- **实际**：L157 全屏导演台 portal 根 `z-[9999]`。
- **偏离描述**：**违反 §〇 铁律**——裸 z-index，应改用 `z-modal` 语义 token。

---

### 5.3 统一建议（只给建议，不改代码）

| 偏离项 | 收敛建议 |
|---|---|
| 标题 floating vs mb-1（VideoExtract/VideoProcess） | 两节点改接入 NodeShell，标题用内置 `mb-1 self-start`，与 Panorama/Director3D 一致；或若需浮标题，全节点统一 floating 规范。 |
| 无 titleRight（VideoExtract/VideoProcess） | 若有右侧操作，统一用 `titleRight` 容器；模式切换等高频操作优先放 titleRight 或 HoverToolbar（§一）。 |
| 三节点 select 样式互不一致 | 抽离统一 `selectClass`（如 `bg-surface-1 border border-edge rounded-md px-2.5 py-1.5 text-caption-sm text-gray-200 focus:border-edge-strong`）；或改用 §二 下拉面板 / ModelSelect。三者 padding/圆角/字号/focus 态对齐。 |
| 端口三种实现（原生 Handle / CustomHandle small / CustomHandle large 双层） | 统一用 NodeShell + CustomHandle；Director3D 设 `showHandles={false}` 后只保留自加端口，消除双层；VideoExtract 弃原生 Handle 改 CustomHandle。large/small 按节点尺寸角色统一决策。 |
| VideoProcessNode 大量裸色值 | 全部替换：`bg-surface-raised`/`bg-surface-subtle`/`bg-surface-active`/`border-edge`/`border-edge-strong`；圆角统一 `rounded-xl`；选中态 `border-edge-strong`。 |
| PanoramaNode 裸 `text-[10px]`（L135/136/141/143） | 改用 token `text-meta`(9) 或 `text-2xs`(8)，`font-bold` 改 `font-medium`。 |
| VideoExtractNode `text-xs` 多处 | 节点 UI 字号统一为 `text-caption`/`text-caption-sm` 等 token。 |
| VideoExtractNode `transition-all duration-300` | 对齐 NodeShell `transition-colors duration-200`（L192）。 |
| PanoramaNode / Director3DNode 裸 z-index（`z-[5]` L179 / `z-[9999]` L188,L157） | 全屏弹层改语义 token `z-modal`；L179 比例遮罩改 `z-[...]` → 用局部 `z-*` token 或合理语义层级。 |
| Director3DNode 主显示区双重外壳 | 去掉主显示区自套的 `rounded-xl border border-edge shadow-xl`，仅留 `bg-surface-muted` + `overflow-hidden`；`minHeight` 改 token 或跟随 NodeShell 尺寸。 |

## 六、验收标准（可自测）

1. 本组每个节点都按 8 个维度审计过，差异汇总表无空白单元格。✅
2. 每个偏离项都有「文件 + 行号 + 关键片段」证据，非空泛描述。✅
3. 明确区分「一致」和「偏离」。✅
4. 行号来自本次实际 `read_file`/`search_content`，非猜测。✅

## 七、铁律文件名

本文件即唯一产出。写满后结束，未改动任何其他文件。
