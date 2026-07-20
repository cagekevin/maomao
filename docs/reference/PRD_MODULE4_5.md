# 一毛AI画布 · 模块 4-5 PRD（画布框架 + 节点组件）

> 基于 `_engine/App.js` 深度分析，步进式推理引擎生成。
> 目标：UI 和功能 1:1 复刻原版，最终删除 `_engine/`。

---

## 第 1 层：全局骨架

### 定位

将一毛AI画布 Chrome 扩展的 **UI 层**（模块 4 + 模块 5）从 `_engine/App.js`（4.6 万行混淆代码）完整复刻为可读 TypeScript。功能和 UI 1:1 对齐原版，用户不应感知到底层被重写。

### 范围

- ✅ 画布（React Flow）、25 种可交互节点 + 2 种 StubNode
- ✅ 右键菜单（3 种触发场景）、快捷键（Q/W/E）
- ✅ 资源面板、任务面板、设置面板
- ✅ 底部状态栏、状态指示器（本地引擎连接状态）
- ❌ 用户账号/登录/付费功能（移除）
- ❌ 3D 导演台节点（director3dNode）→ StubNode 占位
- ❌ RH Web 应用节点（rhWebappNode）→ StubNode 占位

### 模块拆分

| # | 模块名 | 职责 | 依赖 |
|---|--------|------|------|
| M4-A | **画布容器** | React Flow 画布实例、视口控制、连线系统、拖放上传、性能优化（LOD） | 无 |
| M4-B | **交互系统** | 右键菜单（画布/节点/多选 3 种触发）、快捷键、选中/多选/拖放/删除/复制/组合 | M4-A |
| M4-C | **布局框架** | 三栏布局（资源面板 + 画布 + 检查器）、底部状态栏、状态指示器 | M4-A |
| M5 | **节点组件** | 25 种可交互节点 + 2 种 StubNode，每种节点独立文件 | M4-A, M4-B |

### 翻车点

1. **节点 data 中的函数回调**：原版节点 data 包含 `onGenerate` 等函数，序列化会丢失。应对：data 分为「配置数据」（可序列化）和「运行时回调」（不可序列化）
2. **CSS 样式依赖**：原版 3 个预编译 CSS（~175KB），新组件必须用原版 class name。应对：沿用原版 CSS，禁止引入新框架
3. **节点间数据流**：连线逻辑分散在 App.js 多处。应对：先实现静态渲染和单节点功能，数据流后续接入

### 跨模块约束

- **C1**：所有节点组件必须接受 `{ id, data, selected, width }` 作为 props（与原版签名一致）
- **C2**：所有 UI 必须使用原版 CSS class name，禁止引入新 CSS 框架
- **C3**：节点 data 中的函数字段通过 React Flow `nodes` 数组注入，不存储到持久层
- **C4**：快捷键处理必须包含输入框焦点检查——当 `e.target` 为 `INPUT`/`TEXTAREA`/`SELECT` 或 `isContentEditable` 时跳过（验证：原版 `Ch()` 函数 App.js L28171-28172，画布快捷键 L36534-36538 同逻辑）
- **C5**：撤销/重做直接 `setNodes(setEdges)` 设置状态，不经过 `onNodesChange` 回调链（验证：原版 `vn()`/`bn()` App.js L31698-31712 直接 `W(e.nodes)` / `G(e.edges)`）
- **C6**：画布使用 `useNodesState` / `useEdgesState` hook（返回 `[nodes, setNodes, onNodesChange]`），而非手动 `applyNodeChanges`（验证：原版 L31249 `hn(gg())` 即 `useNodesState(initialNodes)`）

### 模块级约束

- **M4-A**：画布配置必须与原版完全一致（minZoom=0.05, maxZoom=4, connectionRadius=60, nodeOrigin=[0,0]）
- **M4-A 补充**：`deleteKeyCode: ['Backspace', 'Delete']` 由 React Flow 内部处理节点删除；自定义快捷键中 Delete/Backspace 在 `!ctrlKey && !metaKey` 条件下处理 Inspector 输入框删除（App.js L7394-7402），两者不冲突
- **M4-A 补充**：vite.config.ts 须添加 `resolve.dedupe: ['react', 'react-dom']`，防止 `@xyflow/react` 解析出第二份 React 实例（当前缺失）
- **M4-B**：右键菜单结构必须与原版完全一致（一级菜单 + 小工具子菜单 + 用户自定义模板）
- **M4-C**：布局使用 CSS Grid/Flex，不引入 UI 框架
- **M4-Entry**：入口切换策略——新组件写在 `src/AppShell.tsx`，M4-C/A/B 全部完成并通过 build 后，将 `main.tsx` 的 `lazy(() => import('./_engine/App.js'))` 切换为 `import AppShell from './AppShell'`。切换前引擎始终可用作回退。`_engine/` 源码零改动。
- **M5**：每种节点一个文件，文件名与 nodeTypes key 对应

---

## 第 2 层：模块级细化

### M4-A：画布容器 ✅

**约束清单**：
1. **A-C1** React Flow 配置参数与原版一一对应（验证：对比 App.js L36754-36797 的 20+ props）
2. **A-C2** nodeTypes 注册表包含 27 种类型（验证：Object.keys(nodeTypes).length === 27）
3. **A-C3** onNodesChange 使用 `useNodesState` hook 返回的回调（支撑 C6）
4. **A-C4** 编组折叠：group.collapsed → 子节点 hidden
5. **A-C5** 拖放上传：支持 `image/*`、`video/*`、`audio/*`、`text/plain`（原版 `accept: 'image/*,video/*,audio/*,text/plain'`，`App.js:36752`，勿漏 text/plain）

**原版 React Flow 配置（App.js L36754-36797）**：
```js
fitView: true,
fitViewOptions: { padding: 0.2, maxZoom: 1, minZoom: 0.05 },
minZoom: 0.05,
maxZoom: 4,
connectionRadius: 60,
nodeOrigin: [0, 0],
deleteKeyCode: ['Backspace', 'Delete'],
elevateNodesOnSelect: false,
elevateEdgesOnSelect: false,
onlyRenderVisibleElements: nodes.length > 20,
nodesDraggable: true,
nodesConnectable: true,
selectionOnDrag: nodes.length <= 80,
panOnDrag: true,
proOptions: { hideAttribution: true },
className: 'bg-[#0d0c0c]'
```

> ⚠️ **1:1 补全（原版 `App.js:36754-36798` 不止配置参数）**：以上仅 ReactFlow 的「配置参数」。原版 `Be`(ReactFlow) 还挂载了**大量事件处理函数**，本 PRD 配置块未列出，1:1 复刻时不可遗漏（M4-A 实现须逐一对齐）：
> `onNodesChange`(fe) / `onEdgesChange`(he) / `onConnect`(xn) / `onEdgeDoubleClick`(Yr) / `onNodeClick`(kn) / `onPaneContextMenu`(Cn) / `onNodeContextMenu`(wn) / `onSelectionContextMenu`(En) / `onSelectionEnd`(On) / `onPaneClick`(An) / `onDragOver`(Ir) / `onDrop`(Lr) / `onConnectEnd`(Fr) / `onMoveStart`(bt) / `onMoveEnd`(xt) / `onNodeDragStop`(jt) / `onSelectionDragStop`(Mt)。
> 另：`className` 原版为 `bg-[#0d0c0c] ${ai ? 'performance-large-canvas' : ''}`（含大画布性能模式条件类 `performance-large-canvas`），**非固定 `bg-[#0d0c0c]`**——A-C1 简写可接受，但实现时须带条件类。

**nodeTypes 注册表（App.js L31046-31074）**：
```js
{
  group, imageNode, promptNode, textNode, cropNode,
  gridSplitNode, gridMergeNode, videoNode, sd2VideoNode,
  discountVideoNode, audioNode, audioPlayerNode, customNode,
  rhWebappNode, videoExtractNode, videoToGifNode, imageCompressNode,
  faceMosaicNode, compareNode, textConcatNode, urlToImageNode,
  fileToUrlNode, panoramaNode, director3dNode, imageBoxNode,
  stickyNoteNode, ghostTarget
}
```

---

### M4-B：交互系统（进行中）

#### [State 1: 边界对齐]

**职责**：处理用户在画布上的所有交互操作——右键菜单（3 种触发场景）、键盘快捷键、节点选中/多选、拖放/删除/复制/组合操作。

**校验**：
- 与全局定位「UI 1:1 复刻」一致 ✅
- 与 C2（原版 CSS）一致 ✅ — 右键菜单使用原版 class name
- 与 M4-A 不重叠 ✅ — M4-A 管 React Flow 配置，M4-B 管事件处理和菜单渲染

#### [State 2: 拆解结构]

| # | 子模块 | 职责 |
|---|--------|------|
| B1 | **右键菜单组件** | ContextMenu UI 组件，支持 3 种触发模式（画布/节点/多选），子菜单展开/收起 |
| B2 | **菜单数据定义** | 菜单项数组定义（一级菜单 + 小工具子菜单分类 + 用户自定义模板 + 已固定工具） |
| B3 | **快捷键系统** | Q(文本)/W(生图)/E(视频) 创建节点 + Delete/Backspace 删除 + Ctrl+C 复制 + Ctrl+V 粘贴 + Ctrl+Z 撤销 + Ctrl+Y / Ctrl+Shift+Z 重做（全部走全局 keydown 通道，见 `App.js:28213-28219`，输入框聚焦时经 `Ch(e.target)` 跳过浏览器原生行为） |
| B4 | **节点操作** | 复制节点、删除节点、组合/取消编组、合并为图片盒子、依次运行后续节点 |
| B5 | **连接操作** | onConnect 创建连线、onEdgeDoubleClick 删除连线、connectionLineComponent 自定义 |

#### [State 3: 识别陷阱]

1. **右键菜单位置计算**：原版右键菜单需要根据触发位置（画布坐标 vs 屏幕坐标）和视口偏移计算定位，坐标转换容易出错
2. **子菜单展开方向**：小工具子菜单需要根据屏幕边界自动调整展开方向（向上/向下），否则可能被截断
3. **复制节点的 ID 生成**：复制节点必须生成新 ID，且需要更新所有内部引用（如子节点对父 group 的引用）

#### [State 4: 设计路径]

**约束**：
- **B-C1**：右键菜单 3 种触发场景的菜单项必须与原版完全一致（验证标准：对比 App.js L37279-37710 的菜单结构）
- **B-C2**：快捷键 Q/W/E 必须在对应位置创建节点（验证标准：Q→textNode, W→promptNode, E→discountVideoNode）
- **B-C3**：右键菜单**自身**用屏幕坐标（鼠标事件 `K.x/K.y`）绝对定位；菜单内「创建节点」时，用 React Flow v12 的 `screenToFlowPosition`（原版解构为 `we`，再封装为 `wr`，`App.js:31254` / `35301`，`wr` 额外叠加 canvas `getBoundingClientRect()` 偏移）将屏幕坐标转为 flow 坐标。**注意：原版用的是 `screenToFlowPosition`（v12 名），不是 `flowToScreenCoordinates`（v11 旧名，原版未使用）**，1:1 复刻勿用错 API。
- **B-C4**：复制/粘贴分两步，照搬原版，**无固定 (+50,+50) 偏移**（该偏移量来自他人臆想，原版无）：
  - **Ctrl+C 复制（`jr`，`App.js:35764-35796`）**：取选中节点 → 序列化 `mutiwindow-nodes` 写 clipboard；`data` 深拷贝后**剥离函数字段**（`typeof t[e]==='function' && delete`）并删除运行时字段 `loading`/`progress`/`errorMessage`/`imageUrlRef`/`imageUrlThumbRef`/`imageUrlUploaded`；新 ID 在粘贴时生成。复制时**无位置偏移**。
  - **Ctrl+V 粘贴（`kr`，`App.js:35549-35609`）**：读 clipboard 的 `mutiwindow-nodes` → 算原节点组 bounding box 中心 → 新位置 = `粘贴点（视口中心或鼠标，经屏幕→flow 坐标转换） + (原 position - 中心)`，**保持组内相对位置**，非固定偏移。
- **B-C5**：连接线双击删除（onEdgeDoubleClick），自定义 connectionLineComponent（原版变量 `Mh`）

**原版右键菜单结构（画布/连接菜单 `App.js:37279-37540`；节点/多选菜单延续至 ~`L37710`，B-C1 引用 37710 即指完整菜单）**：
```
画布/连接右键菜单：
├── 文本 (Q)          → textNode
├── 图片 (W)          → promptNode
├── 视频 (E)          → discountVideoNode
├── AI应用             → rhWebappNode (→ StubNode)
├── ── 分隔线 ──
├── 小工具 > (子菜单)
│   ├── 文本工具
│   │   ├── 文本拼接     → textConcatNode
│   │   └── 听音断句     → audioNode
│   ├── 图片工具
│   │   ├── 图片盒子     → imageBoxNode
│   │   ├── 图片切分     → gridSplitNode
│   │   ├── 图片拼图     → gridMergeNode
│   │   ├── 全景图       → panoramaNode
│   │   ├── 3D导演台     → director3dNode (→ StubNode)
│   │   ├── 图片压缩     → imageCompressNode
│   │   ├── 人脸打码     → faceMosaicNode
│   │   ├── 对比工具     → compareNode
│   │   └── 网址转图片   → urlToImageNode
│   ├── 视频工具
│   │   ├── 其他视频     → videoNode
│   │   ├── 视频抽帧     → videoExtractNode
│   │   └── 视频转GIF    → videoToGifNode
│   └── 其他工具
│       ├── 万能节点     → customNode
│       ├── 便签         → stickyNoteNode
│       └── 文件转链接   → fileToUrlNode
├── 自定义 > (用户保存的模板)
├── [已固定的工具节点]
├── ── 分隔线 ──
├── 上传               → 文件选择器
├── 模板库
└── 导入 >             → 资源导入面板

节点/多选右键菜单：
├── [多选] 复制 / 组合 / 创建模板 / 多项连接 / 合并为图片盒子 / 删除
├── [单节点] 取消编组 / 依次运行 / 复制 / 复制图片 / 图片切分 / 删除
```

#### [State 5: 汇总确认] ✅

M4-B 约束已确认，5 条约束写入约束清单。

---

### M4-C：布局框架

#### [State 1: 边界对齐]

**职责**：主应用的顶层布局骨架——顶部导航栏（Logo + Tab 按钮 + 项目选择器 + 工具按钮）、主内容区的 Tab 面板切换（canvas/transit/accounts/settings/appcenter）、引擎状态指示器、Settings 面板的左右分栏。

**校验**：
- 与全局定位「UI 1:1 复刻」一致 ✅
- 与 C2（原版 CSS）一致 ✅ — 所有 class name 必须与原版一一对应
- 与 M4-A/M4-B 不重叠 ✅ — M4-A 管 React Flow 配置，M4-B 管画布交互事件，M4-C 管外层布局骨架

#### [State 2: 拆解结构]

| # | 子模块 | 职责 |
|---|--------|------|
| C1 | **主容器** | 最外层 `div.flex.h-screen.bg-[#0d0c0c].flex-col`，Loading 状态切换 |
| C2 | **顶部导航栏** | h-16 导航栏：Logo + Tab 按钮组 + 项目选择器 + 余额/头像 + 设置齿轮 + 任务中心 |
| C3 | **Tab 面板切换** | 5 个 Tab（canvas/transit/accounts/settings/appcenter），使用 `absolute inset-0` + `visible z-10` / `invisible -z-10` 切换 |
| C4 | **资源面板（transit）** | 全屏资源面板，含子 Tab（生成/素材）、过滤器（全部/图片/视频/文本）、内容网格 |
| C5 | **Settings 面板** | 左右分栏：左侧 w-48 导航（内置模型/第三方API/预设提示词/数据管理/升级/后端接入点），右侧 flex-1 内容区 |
| C6 | **引擎状态指示器** | 画布右下角浮动组件：版本号 + 连接状态（绿色对勾/红色脉冲） |
| C7 | **accounts 面板** | 多开账号管理面板（全屏） |

#### [State 3: 识别陷阱]

1. **Tab 切换使用 visibility 而非条件渲染**：原版所有 Tab 面板始终挂载在 DOM 中，通过 `visible z-10` / `invisible -z-10` CSS 切换。这确保画布状态在切换 Tab 后不丢失。如果用条件渲染（`{tab === 'canvas' && <Canvas/>}`），画布状态会被销毁。
2. **导航栏内容随 Tab 动态变化**：画布 Tab 时导航栏中间显示项目选择器 + 新建/导入/导出按钮；其他 Tab 时这些元素不显示。
3. **Settings 子 Tab 状态独立**：Settings 面板有自己的子 Tab 状态（`builtin`/`models`/`basic`/`data`/`upgrade`/`endpoint`），与主 Tab 状态独立管理。
4. **资源面板子 Tab**：transit 面板内部有「生成」/「素材」子 Tab + 过滤器，这些状态独立于主 Tab。

#### [State 4: 设计路径]

**约束**：
- **C-C1**：主容器 class 必须为 `flex h-screen bg-[#0d0c0c] flex-col font-sans text-gray-200`（验证：对比 App.js L44125）
- **C-C2**：Tab 面板使用 `absolute inset-0` + visibility 切换，禁止条件渲染（支撑画布状态不丢失）
- **C-C3**：顶部导航栏 class 必须为 `bg-[#0d0c0c] flex items-center justify-between px-4 relative z-20 flex-shrink-0 h-16 pt-2 pb-2`（验证：对比 App.js L44135）
- **C-C4**：Tab 按钮容器 class 必须为 `flex items-center bg-[#151414] rounded-full p-1`，激活态 `bg-white text-black`，非激活态 `text-gray-400 hover:text-gray-200`（验证：对比 App.js L44168-44181）
- **C-C5**：引擎状态指示器定位 `absolute bottom-6 right-6 z-50`，连接态 `w-8 h-8 border-[#333]`，断开态 `px-3 py-1.5 border-red-500/30 bg-red-950/20`（验证：对比 App.js L44846-44892）

**原版布局结构（App.js 提取）**：
```
Nv() — 主应用组件
├── Loading: "flex items-center justify-center h-screen" → "Loading..."
└── 主容器: "flex h-screen bg-[#0d0c0c] flex-col font-sans text-gray-200"
    ├── 顶部导航栏 (h-16, flex-shrink-0, z-20)
    │   ├── 左: Logo "一毛AI" (onClick → canvas tab) + 下拉菜单
    │   ├── 中: Tab按钮组 [画布|资源|多开] "bg-[#151414] rounded-full p-1"
    │   ├── 中(仅canvas tab): 项目选择器 + 新建/导入/导出
    │   └── 右: 余额 + 头像/登录 + 设置齿轮(→settings tab) + 任务中心(→弹窗)
    ├── 任务中心弹窗(av): 独立弹窗，非Tab，由导航栏时钟图标触发
    │   └── 运行中任务红点指示: "absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"
    └── 主内容区: "flex-1 relative overflow-hidden bg-[#0d0c0c]"
        ├── accounts面板: "absolute inset-0 flex flex-col" + visibility切换
        ├── transit面板(Qn): "absolute inset-0 flex flex-col bg-[#0d0c0c]"
        │   ├── 工具栏: "p-3 flex justify-between items-center gap-4"
        │   │   ├── 子Tab [生成|素材]: "bg-[#151414] rounded-full p-1 border border-[#333]"
        │   │   ├── 过滤器 [全部|图片|视频|文本]: "bg-[#1a1a1a] rounded-lg p-1"
        │   │   └── 显示大小 + 新建文件夹
        │   └── 内容网格: "flex-1 overflow-y-auto p-3 flex flex-col"
        ├── canvas面板: "absolute inset-0 w-full h-full flex flex-col"
        │   ├── React Flow 画布 (flex-1 relative)
        │   ├── 版本号: "text-[10px] font-medium text-white/15 tabular-nums"
        │   └── 引擎状态指示器: "absolute bottom-6 right-6 z-50"
        ├── appcenter面板: "absolute inset-0" + visibility切换（隐藏Tab，无导航栏入口）
        └── settings面板: "absolute inset-0 flex overflow-hidden"
            ├── 左侧导航: "w-48 bg-[#0d0c0c] border-r-0 flex flex-col p-3 z-10 flex-shrink-0"
            │   └── 子项: 内置模型(builtin) / 第三方API(models) / 预设提示词(basic) / 数据管理(data) / 升级(upgrade) / 后端接入点(endpoint)
            └── 右侧内容: "flex-1 overflow-y-auto p-6 relative pb-24 custom-scrollbar bg-[#0d0c0c] nowheel nopan nodrag"
                └── 内容约束: "max-w-4xl mx-auto flex flex-col gap-6"
```

**导航栏右侧按钮（App.js L44467-44497）**：
| 按钮 | 图标 | title | 行为 |
|------|------|-------|------|
| 设置 | 齿轮(P组件, size:20) | `设置` | `Te('settings')` → 切换到 settings Tab |
| 任务中心 | 时钟SVG(clock) | `任务中心` | `f(!d)` → 打开/关闭任务中心弹窗(av组件) |

**任务中心弹窗特征**：
- 组件：`av`（App.js L44499）
- Props：`open, globalTasks, useThumbnail, onClose, onRefreshTask, onRerunTask, onFullscreen, setGlobalTasks, showToastMessage`
- 红点指示：当有 running/pending 任务时，按钮右上角显示红点 `bg-red-500 rounded-full animate-pulse`
- **不是 Tab**，是独立的浮动弹窗

**Tab 值映射**（导航栏可见 Tab 仅 4 个）：
| Tab 值 | 显示名称 | 触发方式 | 导航栏按钮 |
|--------|---------|---------|-----------|
| `canvas` | 画布 | Tab 按钮 / Logo 点击 | ✅ |
| `transit` | 资源 | Tab 按钮 | ✅ |
| `accounts` | 多开 | Tab 按钮 | ✅ |
| `settings` | 设置 | 右侧齿轮图标 | ✅ |
| `appcenter` | 应用中心 | 代码内部切换（无导航栏入口） | ❌ 隐藏 |

**Tab 面板可见性切换模式**（所有面板统一）：
```
className: `absolute inset-0 ... ${activeTab === 'xxx' ? 'visible z-10' : 'invisible -z-10'}`
```

#### [State 5: 汇总确认] ✅

M4-C 约束已确认，5 条约束写入约束清单。

---

### M5：节点组件

#### [State 1: 边界对齐]

**职责**：实现 27 种节点组件（25 种可交互 + 2 种 StubNode），每种节点一个独立文件，完整复刻原版的 props 签名、Handles、CSS 类名、UI 渲染和交互行为。

**校验**：
- 与全局定位「UI 1:1 复刻」一致 ✅
- 与 C1（props 签名一致）一致 ✅
- 与 C2（原版 CSS）一致 ✅
- 与 C3（data 函数字段不持久化）一致 ✅

#### [State 2: 拆解结构]

**Handle 组件体系**：
- `E` = React Flow 原生 Handle（仅 cropNode、ghostTarget 直接使用）
- `_r` = 自定义 Handle 包装器（`cust-handle-wrap`），支持 `variant: "small" | "large"` + 自定义 `id`，绝大多数节点使用
- 动态 Handle：gridSplitNode(`cell-${i}`)、gridMergeNode(`cell-${t}`)、videoExtractNode(`frame-${i}`)、customNode/rhWebappNode(`var-${name}`)

**节点分类（按实现复杂度分 3 批）**：

**第 1 批（纯 UI，无 API）**：
| nodeType | 组件名 | 文件名 | 描述 |
|----------|--------|--------|------|
| `group` | `Eh` | GroupNode.tsx | 编组节点，折叠/展开，子节点容器 |
| `stickyNoteNode` | `Uh` | StickyNoteNode.tsx | 便签，contentEditable 富文本，无 Handle |
| `imageBoxNode` | `Ih` | ImageBoxNode.tsx | 图片盒子，多图管理，缩略图网格 |
| `ghostTarget` | `Nh` | GhostTarget.tsx | 1x1 透明锚点，不可连接 |
| `textConcatNode` | `Rc` | TextConcatNode.tsx | 文本拼接，分隔符/前缀/后缀 |

**第 2 批（轻度 API，单输入输出）**：
| nodeType | 组件名 | 文件名 | 描述 |
|----------|--------|--------|------|
| `imageNode` | `li` | ImageNode.tsx | 图片/视频/音频/文本展示，自动类型判断 |
| `promptNode` | `Ya` | PromptNode.tsx | AI 生图，prompt+模型+尺寸+参考图 |
| `textNode` | `Qa` | TextNode.tsx | 文本生成，prompt+模型+自动分割 |
| `videoNode` | `Do` | VideoNode.tsx | 普通视频生成，prompt+模型+时长 |
| `sd2VideoNode` | `Ao` | Sd2VideoNode.tsx | SD2 视频生成（即梦/Seedance） |
| `discountVideoNode` | `os` | DiscountVideoNode.tsx | 特惠视频生成 |
| `audioNode` | `cs` | AudioNode.tsx | 听音断句，音频→文本 |
| `audioPlayerNode` | `ps` | AudioPlayerNode.tsx | 音频播放器，波形可视化 |
| `urlToImageNode` | `Wc` | UrlToImageNode.tsx | URL→图片，本地引擎代理 |
| `fileToUrlNode` | `qc` | FileToUrlNode.tsx | 文件→链接，上传对象存储 |
| `customNode` | `ms` | CustomNode.tsx | 万能节点，自定义 API 配置 |
| `cropNode` | `eo` | CropNode.tsx | 图片裁剪 |

**第 3 批（重度渲染/复杂交互）**：
| nodeType | 组件名 | 文件名 | 描述 |
|----------|--------|--------|------|
| `gridSplitNode` | `po` | GridSplitNode.tsx | 图像切分，3种模式，动态 cell handles |
| `gridMergeNode` | `To` | GridMergeNode.tsx | 图像拼图，3种模式，动态 cell handles |
| `videoExtractNode` | `Ns` | VideoExtractNode.tsx | 视频抽帧，动态 frame handles |
| `videoToGifNode` | `Gs` | VideoToGifNode.tsx | 视频转 GIF，gif.js |
| `imageCompressNode` | `nc` | ImageCompressNode.tsx | 图片压缩，Canvas |
| `faceMosaicNode` | `Cc` | FaceMosaicNode.tsx | 人脸打码，3种模式 |
| `compareNode` | `Lc` | CompareNode.tsx | 图片对比，可拖分割线 |
| `panoramaNode` | `Yc` | PanoramaNode.tsx | 720 全景图，Three.js |
| `rhWebappNode` | `Ms` | RhWebappNode.tsx | AI 应用节点 → **StubNode** |
| `director3dNode` | `Th` | Director3dNode.tsx | 3D 导演台 → **StubNode** |

#### [State 3: 识别陷阱]

1. **自定义 Handle 组件 `_r` 必须优先实现**：27 个节点中 25 个使用 `_r`（`cust-handle-wrap`），它是所有节点端口的基础设施。如果先实现节点再补 Handle，会导致大量返工。
2. **节点 data 中的回调函数**：`promptNode` 的 `onGenerate`、`textNode` 的 `onRefresh`、`cropNode` 的 `onCropComplete` 等都是通过 React Flow `nodes` 数组注入的函数，不存储到持久层。实现时需要明确哪些 data 字段是运行时回调。
3. **动态 Handle 的 ID 命名约定**：`cell-${i}`、`frame-${i}`、`var-${name}` — 这些 ID 在连线数据中引用，改名会导致连线断裂。
4. **`stickyNoteNode` 无 Handle**：唯一没有输入输出端口的节点，不要误加。
5. **`ghostTarget` 不可连接**：`isConnectable: false`，仅作锚点用途。
6. **`rhWebappNode` 和 `director3dNode` 用 StubNode 占位**：这两个节点依赖外部服务/复杂 3D 引擎，先用 StubNode 占位，显示"功能开发中"。

#### [State 4: 设计路径]

**约束**：
- **M5-C1**：每种节点一个文件，文件名 PascalCase 与 nodeType key 对应（验证：`src/nodes/` 下文件数 ≥ 27）
- **M5-C2**：所有节点 props 签名必须与原版一致（验证：对比上表 Props 列）
- **M5-C3**：优先实现 `_r`（CustomHandle）组件，作为所有节点的 Handle 基础设施
- **M5-C4**：动态 Handle ID 命名必须与原版一致（`cell-${i}`、`frame-${i}`、`var-${name}`）
- **M5-C5**：`rhWebappNode` 和 `director3dNode` 使用 StubNode 占位，显示"功能开发中"提示

**实现顺序**：
```
Step 1: CustomHandle (_r) + 通用节点标题栏 (si) + 通用尺寸约束 (ci)
Step 2: 第 1 批（纯 UI 5 个）
Step 3: 第 2 批（轻度 API 12 个）
Step 4: 第 3 批（重度渲染 9 个，含 2 个 StubNode）
Step 5: nodeTypes 注册表组装 + 验证
```

**各节点关键 CSS 类（实现时必须复用）**：
| nodeType | 容器 CSS |
|----------|---------|
| group | `relative flex items-center justify-center bg-[#2a1f24] border border-dashed rounded-xl` (折叠) / `relative w-full h-full rounded-xl bg-[#1e171b]/50` (展开) |
| imageNode | `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| promptNode | `relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px]` |
| textNode | `relative flex flex-col items-center group/node transition-all` |
| cropNode | `relative flex flex-col` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| gridSplitNode | `relative flex flex-col` + `bg-[#1c1c1c] rounded-xl border shadow-xl w-[280px]` |
| gridMergeNode | `relative flex flex-col` + `bg-[#1c1c1c] rounded-xl border shadow-xl min-w-[320px]` |
| videoNode | `relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px]` |
| sd2VideoNode | `relative flex flex-col items-center group/node transition-all w-full h-full min-w-[200px] min-h-[200px]` |
| discountVideoNode | `relative flex flex-col items-center group/node w-full min-w-[200px] min-h-[200px]` |
| audioNode | `relative flex flex-col group/node transition-all w-[360px]` |
| audioPlayerNode | `bg-[#1c1c1c] rounded-xl border shadow-xl flex flex-col w-full h-full` |
| customNode | `flex flex-col items-center group/node transition-all` + `bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl` (width: 400px) |
| rhWebappNode | `flex flex-col items-center group/node transition-all` + `bg-[#1c1c1c] rounded-xl border shadow-xl` (minWidth: 820, minHeight: 560) |
| videoExtractNode | `relative group/node w-full h-full min-w-[280px]` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| videoToGifNode | `relative group/node w-full h-full min-w-[300px] min-h-[200px]` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| imageCompressNode | `relative group/node w-full h-full min-w-[300px] min-h-[200px]` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| faceMosaicNode | `relative group/node w-full h-full min-w-[320px] min-h-[250px]` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| compareNode | `relative group/node w-full h-full min-w-[360px] min-h-[300px]` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| textConcatNode | `relative flex flex-col` + `w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2` |
| urlToImageNode | `relative flex flex-col` + `w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2` |
| fileToUrlNode | `relative flex flex-col` + `bg-[#1c1c1c] border-2 rounded-xl w-[320px]` |
| panoramaNode | `flex flex-col items-center group/node transition-shadow w-full h-full` + `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl` |
| director3dNode | `relative w-full h-full flex flex-col group/node` + `bg-[#151515] rounded-xl overflow-hidden border border-[#333]` |
| imageBoxNode | `relative w-full h-full group/node` |
| stickyNoteNode | `relative w-full h-full group/node` + contentEditable |
| ghostTarget | `width:1; height:1; opacity:0; pointerEvents:none` |

`[PAUSED_AWAITING_INPUT]`

