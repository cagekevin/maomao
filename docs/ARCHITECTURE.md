# 原型架构与设计规范（react-nodes）

> **这份文档是「为什么」，不是「规则清单」。** 它从设计原则出发，推导出本原型该长什么样、数据该怎么流动、代码该怎么写。
> 新增节点 / 改节点 / 接真引擎前先读它，先理解「为什么这样设计」，再动手。

> ## 🔴 效力与真源分工（2026-09-19 校准 · 防 SSOT 第二份）
>
> **本文档只持有一条真源：§一 设计原则（4 条）。** 其余内容一律**引用他处**，本文不复制、也不得与之冲突：
>
> | 内容 | **唯一真源** |
> | --- | --- |
> | **现状目录结构 / 域清单 / 数据流链路** | **`spec/DATAFLOW.md`**（§一–§十七；§十六 = 旧名→新名） |
> | 节点**长什么样**（视觉 DNA / 板块 / 设置 / 操作） | `docs/NODE-DESIGN-SPEC.md` |
> | **命名判据**（N1–N9 域前缀 / 门面 / `*Store`） | **`docs/adr/ADR-0039`**（§六 只保留两条历史约定） |
> | **改名边界**（运行时字符串冻结） | **`docs/adr/ADR-0038`** |
> | **旧名 → 新名** | **`spec/DATAFLOW.md §十六`**（全文唯一一份） |
> | **新增节点权威流程** | `spec/NEW-NODE-GUIDE.md` |
> | base 能力清单（"有什么现成的") | `docs/BASE-CAPABILITIES.md` |
> | 代码规范总纲 | `docs/plan/CODING-STANDARD.md` |
>
> ⚠️ **本文档曾长期基于 `.jsx` 时代的 4 层结构**（① `App.jsx` ② `base/` ③ `components/*.jsx` ④ `scriptbox/`）——**该结构已不存在**（全部 TS 化 + 按域重组 + 多轮改名）。
> **2026-09-19 已就地修正全部路径与结构描述**（依据：实测 + `spec/DATAFLOW.md §十六`）。
> **若本文与 `spec/DATAFLOW.md` 冲突，以 DATAFLOW 为准。**

> **配套**：`docs/BASE-CAPABILITIES.md`（base 能力）· `tailwind.config.ts`（样式令牌唯一真相）· `docs/README.md`（文档索引）· `spec/NEW-NODE-GUIDE.md`（新增节点）。
> 启动 / 测试命令以 `package.json` 的 `scripts` 为准（`npm run dev` / `build` / `test:smoke` / `test:regression`）；**根目录无 `README.md`**（文档索引进 `docs/README.md`）。
> ⚠️ **旧配套 `node-types-map.md` 已删除**（随 `src/bundle/` 混淆产物移除；见 `docs/README.md:87`）；
> 节点 type↔组件映射的**真源 = `src/components/nodes/` 下的实际节点组件** + `src/components/base/core/contracts.ts` 的 `NODE_TYPES`。

***

## 一、设计原则（一切规范的源头，共 4 条）

> 下面每一条都回答「为什么这样设计」。遇到规范没覆盖的情况，回到这几条做取舍，而不是猜。

### 原则 1 · 关注点分离：画布壳与节点逻辑解耦

**设计意图**：这是一个**画布节点编辑器**。画布（渲染、连线、缩放、历史）是通用能力，与「某个节点是生图还是剧本盒子」无关。若把节点逻辑写进画布壳，节点无法独立复用/演化，画布壳会随节点增多而膨胀成垃圾场。

**推导**：

* `App.tsx` 只懂「画布」，不懂任何节点。

* 每个节点自包含，靠 **nodeTypes 注册 + node.data 契约** 接入画布。

* 节点间不互相 import 内部，通过 data 契约 + NodePalette 目录解耦。

### 原则 2 · 数据归属看「生命周期边界」：数据放哪，取决于谁需要它、活多久

**设计意图**：官方源码不是一种范式——普通节点（bo.jsx）用 useState，剧本盒子（c\_.jsx）把数据全放 node.data。**为什么不一样？** 因为两类数据的「读写边界」不同：

* 数据只被**本节点 UI 瞬时读写**（如 prompt 输入、图片预览）→ 放组件本地 useState，局部刷新、简单直接。

* 数据要被**引擎异步回写 / 被连线读取 / 随节点复制持久化**（如剧本盒子的 shots/assets）→ 必须放 node.data 单一真相，否则任何本地副本都会失同步。

**推导**：判断标准不是「简单/复杂」，而是**这份数据会不会被 node.data 之外的人读写**。会 → 进 node.data；不会 → 留 useState。纯 UI 状态（弹窗、视图、选中）永远留 useState。

### 原则 3 · 写回「可感知且可预测」：不可变更新、不全局波及

**设计意图**：React 的更新靠「引用变化」触发重渲染。直接原地改（`d.shots.push`）引用不变 → 界面不更新；而给所有节点都造新引用 → 所有节点重渲染卡顿。正确写法是**不可变地产生新引用、只更新目标节点**，让依赖方感知到变更、又不波及无关节点。

**推导**：写回 node.data 一律 `setNodes(ns => ns.map(n => n.id===target ? {...n,data:{...n.data,...patch}} : n))`，非目标节点原样返回（引用不变 → 不重渲染）。

### 原则 4 · 面向真实引擎的可对接性：原型是「复刻 + 待接真引擎」

**设计意图**：这个原型不是最终交付，而是**复刻官方、之后要接真引擎**的中间产物。若假实现和真实现的「接缝」不可预测，接真引擎时全盘返工。

**推导**：

* 引擎回调签名 = 契约，冻结，UI 只调 `d.onXxx?.()`，不依赖引擎内部。

* **桩 / 假实现必须标注真链路**，且假实现里也走**同一写回通道**（`useNodeData`，见 §四）——模拟真实行为，接真引擎时零改 UI。

* 自研代码不搬官方混淆短名，避免「同名不同物」冲突，保证可搜索、可对照。

> **📌 关于文中「官方 `Xxx.jsx`」与「官方 `docs/NN`」两类引用**
> 前者是**复刻期对官方混淆产物的对照标记**（`src/bundle/` 已移除，标记仅存于注释）；后者是**官方逆向文档的编号**，该目录不在本仓可检索范围（位于 `docs/逆向专用_ai 禁止读/`，**AI 禁读**）。
> 二者**只作历史对照信息，不作为现行判据** —— 现行判据见页首真源表。

***

## 二、架构分层（原则 1 落到结构）

> **🔴 本节 2026-09-19 重写。** 旧版写的是 `.jsx` 时代的 **4 层**（① `App.jsx` ② `base/` ③ `components/*.jsx` ④ `scriptbox/`）—— **该结构已不存在**。
> 本节只回答**「原则 1 怎么落到结构」这条判据**；**现状结构（目录轴）以 `spec/DATAFLOW.md` 为唯一真源**。

### 2.1 现状三层 + 一容器

```
src/
├── main.tsx                 入口：挂载 <App/>
├── App.tsx                  ① 装配层 —— 画布宿主（原则1：只懂画布，不懂节点）
└── components/
    ├── base/                ② 「横切层 + 域」的容器（不是域，见 2.2）
    │   ├── core/  utils/  ui/  api/  storage/  panels/     ← 横切（无业务语义）
    │   └── canvas/ store/ prompt/ creative/ editors/ media/ depthVideo/   ← 域
    ├── nodes/               ③ 画布域的「节点宿主子域」= 各能力域的 UI 挂载点（16 个活节点 + `_template/` 蓝本）
    ├── edges/               ③ 画布域：边组件（CustomEdge / ConnectionLine / Comet）
    ├── agent/               ③ 域：AI 助手（⊃ runtime · conversation · assistantTable · canvas）
    ├── scriptbox/           ③ 域：剧本盒子（三步 UI + 设置 + 引擎）
    ├── director3d/          ③ 域：3D 导演台（已登记例外，未纳入收口）
    └── videoEditor/         ③ 域：剪辑器（独立应用，258 文件，**有域门面 `index.ts`**）
```

| 层 | 判据 | 例子 |
| --- | --- | --- |
| **装配层** | 进程入口 / 根装配 | `main.tsx` · `App.tsx` |
| **横切层** | **无业务语义**的通用原语 | `base/core/{logger,contracts,eventBus,contentStore,toastStore,idGen}` · `base/utils` · `base/ui` · `base/api` · `base/storage` · `hooks/` 编排层 |
| **域** | 面向**同一业务关注点**的一坨（**含业务语义**，**哪怕被多域消费**） | `agent` · `videoEditor` · `scriptbox` · `director3d` · `base/{canvas,store,prompt,creative,editors,media,depthVideo}` |

### 2.2 `base/` 不是域，是容器

这解释了为什么「域物住 `base/`」**不必然是错** —— 错的只是域物住进了 `base/{core,utils,api,storage,ui,panels}` 这几个**横切**子目录；
而 `base/canvas`、`base/store`、`base/editors` 本身就是**域容器**，住在里面不算住错。

> **判据推导与实测证据**（P1–P5：有无业务语义 / 关注点定边界 / 用户可感知性）见 `docs/DOMAIN-MODULES.md §2`；
> **现状域清单与 17 条数据流链路**见 `spec/DATAFLOW.md`。

### 2.3 依赖方向（单向）

**这条仍然有效**，由 `npm run check:arch` 规则 2 强制（`base/**` 禁 import 任何非 base 目录）：

```
App.tsx ──注册──▶ NodePalette / nodeTypes（只登记目录，不调用节点逻辑）
节点 ──用 useReactFlow() / useNodeData()──▶ 拿 setNodes/addNodes + 写回（不依赖 App 传参）
节点之间 ──通过 node.data 契约 / @软连接──▶ 解耦（不互相 import）
base/** ──✕ 禁──▶ 任何非 base 目录（业务域）
```

**新增节点该"放哪"** → `docs/BASE-CAPABILITIES.md §八`；**域归属判据** → `docs/DOMAIN-MODULES.md §2`。

***

## 二.5、画布级工具（左下角工具栏 / 小地图 / 整理 / 性能模式）

> 复刻官方 `H_.jsx` 左下角工具栏（12013-12094）的通用画布能力。这些是**画布壳**的事（原则 1），不归属任何节点。
> ⚠️ **落点已随域重组变化**：容器/弹窗在 `base/`（画布域 + 面板层），而 dagre 布局 hook 属**横切编排层**（`src/hooks/`）—— 不再是"全部落在 `base/`"。

### 组件清单（现行真实路径）

| 文件 | 职责 | 复刻源 |
| --- | --- | --- |
| `src/components/base/panels/CanvasToolbar.tsx` | 左下角工具栏容器（运行/整理/小地图/清理/适合视图/性能模式/缩放±%） | `H_.jsx:12013-12094` |
| `src/components/base/canvas/ArrangeConfirm.tsx` | 整理后「是否保留整理结果？」确认弹窗（还原/保留） | `H_.jsx:11993-12012` |
| `src/hooks/useArrangeCanvas.ts` | dagre 自动布局 hook（含 group 父子、连通分量分组换列） | `H_.jsx:10985` `Ui` / `Ctrl+L` |
| `src/components/base/utils/arrangePack.ts` | 连通分量打包（`packComponents`），按视窗比例择优换行 | 同上 |

**依赖**：`dagre`（有向图分层布局引擎）。

### 各功能的行为约定

1. **小地图（MiniMap）**：`App.tsx` 用 `minimapOn` state（默认开）控制 `<MiniMap>` 显隐。样式复刻官方：`#222` 底 + `#333` 描边 + `maskColor #0d0c0c80` + `nodeColor #444`，定位在左下角工具栏上方（`absolute left-4 bottom-16`），仅节点数 `<100` 时显示（官方 `De.length < 100`）。
2. **整理画布（dagre 自动排版）**：`useArrangeCanvas` 复刻官方 `Ui`（2026-09-07 清爽总览档）——

   * dagre 配置 `rankdir:'LR' / nodesep:80 / ranksep:180 / align:'UL'`，compound graph 支持 group 父子；

   * 布局后按**连通分量**分组（BFS），各分量包围盒经 `packComponents` 按视窗比例（读 ReactFlow store 宽高）择优换行：整体边界框贴近视窗比例，`fitView` 后节点最大化；跨分量间距 `GAP_X=180`、换列 `GAP_Y=120`；

   * 写回新位置 + `fitView`；仅 `INPUT_PANEL_NODE_TYPES`（现行值 = **`textGenerateNode` / `imageGenerateNode` / `videoGenerateNode`**，见 `base/canvas/nodeDefaults.ts:31`）写 `data.expanded=false`，其余节点 data 原样透传（Tab 与 Ctrl+L 共用同一范围）；

   * **编组无折叠态**（D4）：不渲染折叠胶囊、无折叠按钮，`GroupNode` 不再写 `data.collapsed`；

   * `App.tsx` 在排列前存快照 → `ArrangeConfirm` 弹「是否保留」→ 还原=写回快照 / 保留=关闭。`Ctrl+L` 也触发。
3. **性能模式（enablePerformanceMode）**：`App.tsx` `performanceMode` state（默认开，官方默认 `true`）。

   * 传给 `LodProvider`（`src/components/base/canvas/lod.tsx`）的 `enablePerformanceMode` → 控制 LOD 分级（zoom≤0.5→1, ≤0.3→2, ≤0.2→3，给 `.react-flow` 加 `lod-1/2/3` class）；

   * **节点媒体降级统一走 `useAssetDegrade`**（`src/hooks/useAssetDegrade.ts`）—— **不再各节点自行读 `useLod()` 写字符串判断**：

     ```ts
     const { isHidden } = useAssetDegrade()   // lodLevel>=2 → 藏图片；>=3 → 连视频/音频也藏
     ...
     {!isHidden('image') && <img .../>}
     ```

     现行消费点：`AssetNode` · `ImageGenerate` · `ImageBoxNode` · `GridSplitNode` · `VideoGenerate` · `VideoExtractNode` · `VideoProcessNode` · `nodes/_template/TemplateNode`。
     隐藏 = 内容区替换为「性能模式已隐藏」占位（保留节点标题与端口）。

   * **顶部横幅**：`performanceMode && lodLevel>=2` 时弹黄色横幅——lodLevel≥3 显「已进入全局性能模式 (图片视频已隐藏)」，否则「低缩放性能模式 (图片已隐藏)」（`App.tsx:1673-1683`，复刻 `H_.jsx:11966-11971`）。
4. **缩放 / 适合视图**：`fitView / zoomIn / zoomOut`（`useReactFlow()`），缩放%由 `onViewportChange` 实时更新。

### 新增节点时如何响应性能模式

想让某节点在缩小时也降级（隐藏重型媒体），**直接用统一 hook，别自己判 `lodLevel`**：

```tsx
import { useAssetDegrade } from '../../hooks/useAssetDegrade.ts'

const { isHidden } = useAssetDegrade()
// lodLevel: 0=正常, 1=≤0.5, 2=≤0.3, 3=≤0.2；isHidden('image'|'video'|'audio')
```

然后渲染时 `!isHidden('image') && <img/...>`，替换为轻量占位即可。**阈值已内建**：≥2 藏图片，≥3 藏视频/音频（对齐横幅语义）。

***

## 二.6、画布统一工具层（Canvas Agent Tools）

> **给「AI 画布助手」（LLM function calling）铺路**。本原型已用 ReactFlow 重写了画布操作（`addNode`/`setNodes` 等在 `App.tsx`），**缺的正是把这份能力抽象成「可被 LLM 调用」的统一工具层**——这就是 `useCanvasAgentTools`。

> ⚠️ **落点已变（2026-09-19 修正）**：现行位置 = **`src/components/agent/canvas/useCanvasAgentTools.ts`**，**不在 `base/`**。
> 原因：它是 **AI 助手域的私有能力**（`agent/canvas` 子域，与 `agentCanvasHost.ts` / `canvasPlanExecutor.ts` 同目录），**不是横切层**。
> 横切的是**工具注册表** `base/canvas/toolRegistry.ts`（画布机制）；工具**实现**归 agent 域 —— 这是 §2.2 判据的直接应用。

### 为什么用 `useReactFlow()` 自取能力（原则 1 关注点分离）

* 工具层通过 `useReactFlow()` 自取能力（同 `useScriptBoxEngine` 模式），**App 无需传参、不变成垃圾场**。

* 它只是「画布操作」的**统一出口**，不含任何 Agent UI / LLM 逻辑。Agent 面板（聊天/工具调用循环）是独立关注点，只调 `callTool(name, args)`。

### 工具返回契约（原则 4 面向真实引擎）

每个工具 `{ ok, data | error }`，`error` 恒为人话，可直接喂 LLM（对齐官方 `lr()` 返回形状，LLM 解析无差异）。写操作一律「不可变局部更新」（原则 3）：只改目标节点，非目标节点 `: n` 原样返回。

### 何时走工具层 / 何时不走

* **走**：Agent 面板、自动化脚本、测试驱动画布——统一走 `useCanvasAgentTools`，保证「画布操作」只有这一个出口。

* **不走**：节点内部 UI 交互（那是节点自己的事）；手写一次性操作（直接 `setNodes`）。

### 新增工具流程

1. 在 `src/components/agent/canvas/useCanvasAgentTools.ts` 定义工具对象（`name/description/parameters/execute`，`execute(args, ctx)` 返回信封）。
2. 加入 `AGENT_TOOLS` 数组 → 自动出现在 `toolSchemas`（LLM 可见）与 `CANVAS_AGENT_TOOL_NAMES`。
3. 在 `tests/unit/canvasAgentTools.test.ts` 加一条用例（`npm run test:tools`）。
4. 登记进 `docs/BASE-CAPABILITIES.md` §二.5 清单。

### 接真系统路径

工具已接**真实后端**（生成走 `base/api/generate.ts` → 后端 `localTool/`，链路见 `spec/DATAFLOW.md §一`）。若 Agent 改走服务端编排，只需把 `setNodes/setEdges` 换成调 localTool 状态接口；**工具签名与返回信封不变，LLM 侧无感知**（原则 4 的可对接性）。

***

## 三、数据范式（原则 2 的落地）

> **🔴 本节 2026-09-19 重写。** 旧版把节点分成**范式 A（useState 缓存型）**与**范式 B（node.data 单一数据源型）**，并写「范式 A 运行时改动**不强制写回**」—— **该二分已收敛为一条**。
> 依据：`src/hooks/useNodeField.ts:6` 头注自述「节点『本地 state ↔ node.data 字段』落盘**唯一实现**（`node.data` 写回**唯一链路的一环**）」；`check:arch` **规则 5** 守 `useNodeData` 为 `node.data` 写回**唯一真源**。

### 现行范式：`node.data` 是持久化真源，`useState` 只是编辑态缓冲

```
用户输入 ──▶ 本地 useState（编辑态缓冲；高频输入防抖）
                │  内部 effect 落盘
                ▼
        node.data（唯一持久化真源）──▶ 画布快照 / Agent / 连线读取 / 卸载 flush
```

| 数据种类 | 放哪 | 通道 |
| --- | --- | --- |
| **业务数据**（`prompt` / `text` / `assetUrl` / `aspectRatio` / `imageSize` / `shots` …） | **`node.data`** | `useNodeData(id).patchData`（低频即时）· `patchDebounced`（高频输入） |
| **可编辑字段的本地缓冲** | `useState`（**必须落盘**） | **`useNodeField(field, initial, writer)`** —— 一个字段一行，**禁止**手抄三段样板 |
| **纯 UI 状态**（弹窗开关 / 视图模式 / 选中项 / hover / zoom） | `useState`（**不落盘**） | 直接 `useState` |

**标准写法**（新增节点照抄 —— 见 `nodes/ImageGenerate.tsx:118-120` · `nodes/TextGenerate.tsx:79-84`）：

```tsx
const { patchData, patchDebounced } = useNodeData(id)
const [prompt, setPrompt] = useNodeField('prompt', data.prompt || '', patchDebounced)          // 高频 → 防抖
const [autoSplit, setAutoSplit] = useNodeField('autoSplit', data.autoSplit || false, patchData) // 低频 → 即时
```

**三条硬约定**：

1. **写回不在 `setState` updater 里做**（渲染期 `setNodes` → BatchProvider 警告）—— 统一由 `useNodeField` 内部 effect 落盘；
   ⇒ 因此**必须在 `useNodeData(id)` 之后**调用它（writer 需先就位）。
2. **外部改 `data` → 本地 state 的同步**（Agent `update_node` / Tab 快捷键）由 `useGenerateNode` 的 `sync` 参数 / `useSyncNodeData` 负责；与 `useNodeField` **两处不重叠、不打架**。
3. **卸载 flush**：防抖实例与卸载 flush 由 `useNodeData` 的 `patchDebounced` 承接，`useNodeField` **不重复注册**。

### 判断准则（新增节点先回答）

> 问自己：**这份数据要不要在刷新 / 切项目 / 复制节点后还在？**

| 回答 | 放哪 |
| --- | --- |
| 要（业务数据：输入、参数、产出、结果） | **`node.data`**，走 `useNodeData` + `useNodeField` |
| 不要（弹窗开关 / 视图模式 / 选中项 / hover） | `useState`，**不落盘** |

### 为什么必须这样（原则 2）

数据被**引擎异步回写 + UI 编辑 + 连线读取 + 画布快照持久化**四方操作 ⇒ 任何**长期存在**的本地副本都会失同步（原则2）。
⇒ **单一真相（`node.data`）+ 编辑缓冲（`useState`）+ 统一落盘通道（`useNodeData`）** 才是零耦合可对接的形态（原则4）。

> **复合节点（剧本盒子）** 是这条范式的**极端情形**：它的 `shots/assets` 被引擎异步回写，所以连"编辑缓冲"都不留，
> UI 编辑直接 `updateData(patch)`、触发生成只调 `d.onXxx?.()`（见 `hooks/useScriptBoxEngine.ts`）。

***

## 四、写回通道（原则 3 的落地）

| 通道 | 用途 | 备注 |
| --- | --- | --- |
| **`useNodeData(id)`** → `patchData` / `patchDebounced` | **`node.data` 写回的唯一链路** | `check:arch` **规则 5** 守；`patchDebounced` 承接防抖 + 卸载 flush |
| **`useNodeField(field, initial, writer)`** | 可编辑字段「本地 state ↔ `node.data`」落盘 | 底层走 `useNodeData`；**禁止**手抄三段样板（见 §三） |
| `setNodes` | 引擎生成 / 连线 / 批量命令写回 | 不可变局部更新 |
| `updateData`（`hooks/useScriptBoxEngine.ts`） | 剧本盒子（复合节点）UI 编辑写回 | 走 `node.data.onXxx` 回调注入 |

**写回铁律（原则3）**：

1. **不可变局部更新**：只改目标字段，其余字段/节点保留旧引用。禁止原地 `push`/`赋值`。
2. **单节点刷新**：`setNodes(ns => ns.map(n => n.id===id ? {...n,data:{...n.data,...patch}} : n))`，非目标节点 `: n` 原样返回。**绝不**给所有节点造新引用。
   纯函数底层 = `src/hooks/useNodeData.ts` 的 `computePatchNodeById` / `patchNodeById` / `patchNodeDataById`。
3. **高频输入缓冲**：打字/拖拽先存本地编辑态，**防抖后**落盘一次 —— 现行实现 = `useNodeField(..., patchDebounced)`，不是各节点手写 `setTimeout`。

***

## 五、连线机制（@软连接）

* 剧本盒子分镜文本写 `@资产名` = **软连接标记**。

* 下游生图/生视频时按 `@资产名` 匹配收集有图的资产为参考图（纯函数）。

* **没写** **`@`** **或资产没出图 → 带不上参考图。**

* **为什么**：资产图不是靠真实连线传的，而是「文本标记 + 下游动态收集」——解耦剧本盒子与下游（原则1），也保证参考图只在有图时才生效。

***

## 六、命名规范（原则 4 的落地 + 可读性）

> **🔴 本节不是命名判据的真源（2026-09-19 校准）。**
> **域前缀 / 门面 / `*Store` / `Contract` 的判据本体在 `docs/adr/ADR-0039`**；**改名边界（运行时字符串冻结）在 `docs/adr/ADR-0038`**。
> **引用本节当命名依据 = 违规**（本节只保留下面两条**与域无关**的历史约定）。新代码的命名请以 ADR-0039 为准。

### 禁止混淆短名

官方 `src/bundle/` 是混淆产物（`Ar/Pr/Fr/Ir/Mr/Nr/Un/oi/ai/li/ui/di/ii/Zg/Yg/Qg/Fa/Ra/K/zt` 无语义）。**自研代码禁止用这些做标识符**，必须用语义化全名。

* 允许例外：注释里标注官方符号对应关系（`// onGenerateScript(Ar)`）——是价值对照信息。

* 对照表：`Ar→generateScript`、`Zg→buildAssetPrompt`、`Nr→assembleShotUser`、`K→setNodes`、`zt→abortMap` 等。

### 数据字段全名（契约单一命名）

数据契约命名与官方一致，禁止简写/别名：`globalStyle`（非 style）、`category`（非 cat）、`description`（非 desc）、`gridMode`（非 grid）。**同一份数据两个名字 = 失同步**（原则2）。

> ⚠️ **运行时字符串面另有冻结令**：`base/core/contracts.ts` 的 `STORAGE_KEYS` / `EVENTS` / `NODE_TYPES` 等**键名与字符串值**是持久化标识，
> **改名只动符号名与文件路径，禁止"顺手统一"这些字符串** —— 改键＝存量数据失联（`ADR-0038`）。

***

## 七、新增节点流程（把原则落到行动）

### 7.1 范例代码指路（写节点前先读这些，别凭想象）

> **不要凭空造结构，直接抄/仿下面的真实代码。** 每个文件示范了一种范式或机制，读它比读规则更准。

| 想写什么 | 去看这个真实文件 | 它示范了 |
| --- | --- | --- |
| **范式 A（普通节点 · 现行标准）** | `src/components/nodes/ImageGenerate.tsx`（`:118-120`） | `useNodeData` + `useNodeField` 落盘、纯 UI 状态留 `useState`、`NodeShell/HoverToolbar/GenerateButton/PromptInput` 基座组装 |
| 范式 A（更薄的例子） | `src/components/nodes/TextGenerate.tsx`（`:79-84`） | 同上；高频输入 `patchDebounced` / 低频即时 `patchData` 的分工 |
| **范式 B（复合节点 · 剧本盒子）** | `src/components/nodes/ScriptBoxNode.tsx` + `src/components/scriptbox/StepShots.tsx` | 业务数据只读 `data`、编辑走 `updateData`、只调 `d.onXxx?.()`、纯 UI 状态留 `useState` |
| 范式 B 数据写回通道 | `src/hooks/useScriptBoxEngine.ts` | `updateData(patch)` 不可变写回（`setNodes` 里非目标节点 `: n` 原样返回）；支持函数式 patch 并发安全合并 |
| 范式 B 引擎注入 | `src/hooks/useScriptBoxEngine.ts` | `useReactFlow()` 拿 setNodes/addNodes/坐标 → 建引擎 → 挂 `node.data.onXxx`，并返回统一 `updateData` |
| 范式 B 引擎实现 | `src/components/scriptbox/scriptBoxEngine.ts` | `createScriptBoxEngine({getData,updateData,addNodes})` 返回回调 |
| 纯函数层（无副作用） | `src/components/scriptbox/scriptBoxPrompts.ts` | 提示词模板 / 拼装函数，UI 与引擎都从这里取 |
| **节点外壳 / 端口 / 尺寸** | `src/components/base/ui/NodeShell.tsx` + `base/ui/CustomHandle.tsx` + `base/core/uiHooks.ts` | 所有节点的公共骨架（`useSizeSync` / `useNodeResize` / `useContentHeightSync`） |
| 通用控件 | `src/components/base/ui/{GenerateButton,ModelSelect,ExpandablePanel,GeneratingOverlay}.tsx` · `base/panels/{HoverToolbar,FullscreenModal}.tsx` · `base/prompt/PromptInput.tsx` | 生成按钮 / 模型下拉 / 展开面板 / 生成中遮罩 / hover 栏 / 全屏 / 提示词输入 |
| 连线特效 | `src/components/edges/CustomEdge.tsx` + `edges/ConnectionLine.tsx`（+ `edges/Comet.tsx`） | 自定义连线 + 拖拽临时线 |
| **节点目录注册** | `src/components/base/canvas/NodePalette.ts` | 新增节点加一行，右键菜单自动接入 |
| 节点数据契约 / 默认值 | `src/components/base/canvas/{nodeDataSchema,nodeDefaults,nodePrefs}.ts` | 字段 schema / 类型默认尺寸 / 用户偏好 |
| 域门面（深模块范本） | `src/components/videoEditor/index.ts` · `src/components/agent/index.ts` · `src/components/base/media/index.ts` | 域的唯一出口怎么建（窄接口） |

### 7.2 新增节点步骤

> **权威流程 = `spec/NEW-NODE-GUIDE.md`**（视觉 DNA / 板块 / 交互 / 设置项）；本节只给「落到哪几个文件」的骨架。

1. **先答范式问题**（§三判断准则）：这份数据要不要持久化 → 要则进 `node.data`（走 `useNodeData` + `useNodeField`）。
2. **对照 7.1 挑范本文件**，仿它的结构建 `src/components/nodes/XxxNode.tsx`（不造轮子、不凭空编 props）。
3. **注册目录**：`src/components/base/canvas/NodePalette.ts` 的 `paletteNodes` 加一行（`type/label/icon/cat/data`）——**记得 `builtin: true` + 默认 data**。
4. **注册 nodeTypes**：**不用手改 `App.tsx`** —— `App.tsx:160` 的 `nodeTypes` 由 `NodePalette.buildNodeTypeComponents()` **派生**，palette 加了就自动接入。
   * 若节点有**非默认端口**：须把 `targetHandleId/sourceHandleId` 登记到 `base/core/contracts.ts` 的 `NODE_HANDLE_CONTRACT`（漏登记 → `check:node-handles` 红）。
5. **接引擎**（复合节点）：仿 `hooks/useScriptBoxEngine.ts` 注入回调，`App.tsx` 不改。
6. **验证**：`npm run build` + `npm run test:smoke` + `npm run test:regression` 三道门全绿；
   碰了节点契约再补 `check:node-types` / `check:node-handles` / `check:node-data` / `check:keys`（这些在 build 阶段跑）。
7. **沉淀**：数据契约 / 行为写进 `spec/DATAFLOW.md` 对应链路 + `docs/BASE-CAPABILITIES.md`。

***

## 八、验收自检（写完代码对照）

* [ ] `App.tsx` 没被塞进节点逻辑？（`nodeTypes` 是**派生**的，palette 加了就自动接入）

* [ ] 业务数据都进了 `node.data`？可编辑字段走 `useNodeField`（**没手抄三段样板**）？只有纯 UI 状态才留 `useState`？

* [ ] 写回是不可变局部更新？非目标节点 `: n` 原样返回？

* [ ] 标识符是语义全名？没搬官方混淆短名？**新命名符合 `ADR-0039`**（域前缀 / 门面 / `*Store`）？

* [ ] **没动运行时字符串面**（`STORAGE_KEYS` / `EVENTS` / `NODE_TYPES` / uploads 子目录 / URL）？（`ADR-0038`）

* [ ] 桩 / 假实现标注了真链路？回调签名对齐契约？

* [ ] 三（build / smoke / regression）道门全绿？

***

## 九、踩坑经验（开发教训，新增节点/改节点必读）

> 以下是从图片盒子 / 图片切分 / 图片拼图复刻中反复踩到的坑。**每条都是真发生过的事**，下次动手前先对照，能省一整轮调试。

### 9.1 新建文件后 dev server 模块缓存会坏（最高频坑）

* **症状**：页面报 `Uncaught SyntaxError: The requested module '.../XxxNode.tsx?t=...' does not provide an export named 'default'`，但 esbuild 打包能通过。

* **根因**：dev server **启动早于**新文件创建（或新文件编辑中途被缓存），Vite 内存里的模块图钉住了一个损坏/空版本，`npm run build` 反而能过。

* **修法**：**重启 dev server 并清缓存**（新文件 / 改 `App.tsx` 后必做）。dev 端口 = **5180**（`vite.config.ts:73`）：

  ```bash
  # macOS / Linux
  lsof -ti:5180 | xargs -r kill -9
  rm -rf node_modules/.vite
  npm run dev
  ```

  ```powershell
  # Windows
  $p = (Get-NetTCPConnection -LocalPort 5180 -State Listen | select -expand OwningProcess | select -First 1)
  if ($p) { Stop-Process -Id $p -Force }
  Remove-Item -Recurse -Force node_modules\.vite
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > dev-server.log 2>&1" -WindowStyle Hidden
  ```

* **判定**：重启后浏览器动态 `import('/src/components/nodes/XxxNode.tsx')` 应返回 `{ default: fn }`；再跑 `test:smoke` 确认注册生效。

### 9.2 import 路径要核对层级

* 坑例（历史）：`CustomHandle` 曾在 `src/components/`（根），写成 `./base/CustomHandle.jsx` → 500 / 模块加载失败。
  **现行路径已重组**：外壳件都在 `src/components/base/ui/`（`NodeShell.tsx` / `CustomHandle.tsx` / `NodeTitle.tsx` / `JianyingIcon.tsx`），面板件在 `base/panels/`，提示词件在 `base/prompt/`。

* 铁律：**复用既有组件的 import 路径，先 `Read` 过原文件再写**，别凭记忆。
  **最快的对法 = 打开同目录的同类节点，抄它的 import 段**（如 `nodes/ImageGenerate.tsx:1-54` 是一份完整的现行 import 清单）。

### 9.3 节点外观必须与其他节点统一

* **标题**：一律用 `NodeShell` 自带标题（传 `label/defaultTitle/icon`），标题右侧操作组用 **`titleRight`** **插槽**（NodeShell 渲染，`absolute right-0 -top-0.5` 与标题垂直居中）。**禁止** `showTitle={false}` 后自己在 children 里渲染 NodeTitle——会把标题包进主容器内、出现双重外框、边框颜色不一致。

* **边框/背景**：主容器边框由 NodeShell 统一（`border-[#333]`），节点内层**不要**重复加 `border` + 独立 `bg`（如 `bg-[#121212]`），否则出现内外两个框、颜色不一致。图片/内容区只做圆角内容面板，不顶替外框。

* **验证**：新增节点后用 playwright 量标题离主容器距离，应与 `textGenerateNode`（文本生成）一致（实测左 17px / 顶 -20.5px）。

### 9.4 高度自适应：**用 `useContentHeightSync`，别手写 ResizeObserver**

* 坑例：图片切分节点被 NodeShell 默认 `minHeight 420` 撑高，内容只有 280px，底部大块空白。

* 铁律：**复合 / 内容会撑高的节点**，用 `src/components/base/core/uiHooks.ts` 的公共 hook 一行搞定：

  ```tsx
  import { useContentHeightSync } from '../base/core/uiHooks.ts'

  const contentRef = useRef<HTMLDivElement>(null)
  useContentHeightSync(contentRef, id, { minHeight: 600, fallbackWidth: 900, syncWidth: true })
  // 内容区：<div ref={contentRef}>…</div>
  ```

* **⚠️ 禁止再手写 `new ResizeObserver` → `onMainBoxResize` 的旧模式**（`nodes/_template/TemplateNode.tsx:571` 明确登记）——
  那会与 `useContentHeightSync` 打架，产生重复写回与抖动。
* **固定宽度 / 内容不随宽度变化的节点，务必传 `syncWidth: true`**。
* 需要测「含标题栏的完整节点」时，`ref` 挂 **NodeShell 根 div** 而非内容区（见 `nodes/GridMergeNode.tsx:138,251`）。
* 现行消费点：`GridMergeNode` · `VideoExtractNode` · `ScriptBoxNode` · `nodes/_template/TemplateNode`。

### 9.5 改公共组件要保证默认行为不变

* 给 `NodeShell` 加的 `showTitle` / `titleRight` prop，**默认值必须不影响既有节点**（`showTitle` 默认 true、`titleRight` 默认 undefined → 走原逻辑）。改完跑 `test:smoke` + `test:regression`，确认 `TextGenerate` / `ImageGenerate` 等标题无回归。

### 9.6 完整复刻官方，不简化

* 官方 `Yo.jsx`（图片拼图）有 grid / longImage / overlay 三模式，overlay 是完整的图层编辑器（`Uo.jsx`：图层列表/排序/涂抹擦除/属性面板/全屏）。**用户要求与官方一致时，模式与交互必须全做**，不能用简化版占位。复杂子功能抽到独立件（现行落点：**`src/components/base/editors/OverlayEditor.tsx`**），主组件保持清晰。

### 9.7 注册节点要同步两处（**不再是三处**）

* ① `src/components/base/canvas/NodePalette.ts` 的 `paletteNodes` 加一行（**记得 `builtin: true` + 默认 data**，否则 palette 有但画布不渲染 / 缺默认值）。
* ② 若有**非默认端口**：`base/core/contracts.ts` 的 `NODE_HANDLE_CONTRACT` 加一项（`check:node-handles` 会对账）。
* **`App.tsx` 不用改** —— `nodeTypes` 由 `paletteNodes` **派生**（`App.tsx:160` 的 `buildNodeTypeComponents()`）。漏 ① → 右键菜单能搜到但建不出来或渲染异常。

### 9.8 节点默认尺寸：**登记在 `nodeDefaults.ts`，不在 `App.tsx`**

* 固定尺寸的节点（图片切分 `280px`、图片拼图 `320px`、生图 `420×420`…）登记到
  **`src/components/base/canvas/nodeDefaults.ts` 的 `NODE_TYPE_DEFAULTS`**（结构默认：`width/height/style/initial*`），由 `applyNodeTypeDefaults` 在**新建与快照还原时都补**。
* 跨节点复用尺寸用同文件的 `ASSET_NODE_SIZE` / `IMAGE_BOX_NODE_SIZE` 等常量，**别各节点硬编码**。
* 图片区用 `h-auto`（跟随图片比例）或固定高度，别让节点被撑太大。

### 9.9 功能验证用 playwright 实测，不只靠 lint / 打包

* `lint` / 打包只查语法。**交互类功能（拖拽交换、模式切换、上传、展开）必须用 playwright 打开 dev server 实测**，注入带数据的 localStorage 快照 + 模拟事件，断言渲染结果与 JS 错误数。临时脚本用完删，不留仓库。

### 9.9 功能验证用 playwright 实测，不只靠 lint / 打包

* `lint` / 打包只查语法。**交互类功能（拖拽交换、模式切换、上传、展开）必须用 playwright 打开 dev server 实测**，注入带数据的 localStorage 快照 + 模拟事件，断言渲染结果与 JS 错误数。临时脚本用完删，不留仓库。

