# 原型架构与设计规范（react-nodes）

> **这份文档是「为什么」，不是「规则清单」。** 它从设计原则出发，推导出本原型该长什么样、数据该怎么流动、代码该怎么写。
> 新增节点 / 改节点 / 接真引擎前先读它，先理解「为什么这样设计」，再动手。
> 配套：`SCRIPTBOX-HANDOFF.md`（剧本盒子专属）、`node-types-map.md`（官方节点映射）、`tailwind-tokens.md`（样式令牌）、`README.md`（启动/测试）。

---

## 一、设计原则（一切规范的源头，共 4 条）

> 下面每一条都回答「为什么这样设计」。遇到规范没覆盖的情况，回到这几条做取舍，而不是猜。

### 原则 1 · 关注点分离：画布壳与节点逻辑解耦

**设计意图**：这是一个**画布节点编辑器**。画布（渲染、连线、缩放、历史）是通用能力，与「某个节点是生图还是剧本盒子」无关。若把节点逻辑写进画布壳，节点无法独立复用/演化，画布壳会随节点增多而膨胀成垃圾场。

**推导**：
- App.jsx 只懂「画布」，不懂任何节点。
- 每个节点自包含，靠 **nodeTypes 注册 + node.data 契约** 接入画布。
- 节点间不互相 import 内部，通过 data 契约 + NodePalette 目录解耦。

### 原则 2 · 数据归属看「生命周期边界」：数据放哪，取决于谁需要它、活多久

**设计意图**：官方源码不是一种范式——普通节点（bo.jsx）用 useState，剧本盒子（c_.jsx）把数据全放 node.data。**为什么不一样？** 因为两类数据的「读写边界」不同：
- 数据只被**本节点 UI 瞬时读写**（如 prompt 输入、图片预览）→ 放组件本地 useState，局部刷新、简单直接。
- 数据要被**引擎异步回写 / 被连线读取 / 随节点复制持久化**（如剧本盒子的 shots/assets）→ 必须放 node.data 单一真相，否则任何本地副本都会失同步。

**推导**：判断标准不是「简单/复杂」，而是**这份数据会不会被 node.data 之外的人读写**。会 → 进 node.data；不会 → 留 useState。纯 UI 状态（弹窗、视图、选中）永远留 useState。

### 原则 3 · 写回「可感知且可预测」：不可变更新、不全局波及

**设计意图**：React 的更新靠「引用变化」触发重渲染。直接原地改（`d.shots.push`）引用不变 → 界面不更新；而给所有节点都造新引用 → 所有节点重渲染卡顿。正确写法是**不可变地产生新引用、只更新目标节点**，让依赖方感知到变更、又不波及无关节点。

**推导**：写回 node.data 一律 `setNodes(ns => ns.map(n => n.id===target ? {...n,data:{...n.data,...patch}} : n))`，非目标节点原样返回（引用不变 → 不重渲染）。

### 原则 4 · 面向真实引擎的可对接性：原型是「复刻 + 待接真引擎」

**设计意图**：这个原型不是最终交付，而是**复刻官方、之后要接真引擎**的中间产物。若假实现和真实现的「接缝」不可预测，接真引擎时全盘返工。

**推导**：
- 引擎回调签名 = 契约，冻结（对齐官方 `docs/40 §3.2`），UI 只调 `d.onXxx?.()`，不依赖引擎内部。
- 假实现必须标注真链路，且假实现里也走 updateData 写回（模拟真实行为）。
- 自研代码不搬官方混淆短名，避免「同名不同物」冲突，保证可搜索、可对照。

---

## 二、架构分层（原则 1 落到结构）

```
prototypes/react-nodes/src/
├── main.jsx               入口：挂载 <App/>
├── App.jsx                ① 画布宿主（原则1：只懂画布，不懂节点）
└── components/
    ├── base/              ② 通用基座（所有节点复用的公共件，无业务）
    ├── scriptbox/         ④ 剧本盒子子模块（三步 UI + 设置弹窗）
    ├── ScriptBoxNode.jsx  ③ 剧本盒子主组件（复合节点）
    ├── PromptNode.jsx / DiscountVideoNode.jsx / TextNode.jsx ...  ③ 各节点（自包含）
    └── CustomEdge.jsx / ConnectionLine.jsx / NodeTitle.jsx / JianyingIcon.jsx
```

| 层 | 职责 | 承载原则 |
|---|---|---|
| ① App.jsx | ReactFlow 装配 + 画布状态 + 通用操作 + 历史/快捷键 + nodeTypes 注册 + 演示节点数据 | 原则1 |
| ② base/ | 节点外壳/端口/公共 hooks/面板/菜单/节点目录 + 画布级工具栏工具（CanvasToolbar/ArrangeConfirm/useArrangeCanvas，见 §二.5）+ **画布统一工具层（useCanvasAgentTools，见 §二.6）** | 原则1 |
| ③ components/*.jsx | 每个节点的 UI + 交互 + 数据 | 原则2、3 |
| ④ scriptbox/ | 剧本盒子三步子组件 | 原则2、3、4 |

**依赖方向（单向）**：
```
App.jsx ──注册──▶ NodePalette/nodeTypes（只登记目录，不调用节点逻辑）
节点 ──用 useReactFlow()──▶ 拿 setNodes/addNodes/坐标（不依赖 App 传参）
节点之间 ──通过 node.data 契约 / @软连接──▶ 解耦（不互相 import）
```

---

## 二.5、画布级工具（左下角工具栏 / 小地图 / 整理 / 性能模式）

> 复刻官方 `H_.jsx` 左下角工具栏（12013-12094）的通用画布能力。这些是**画布壳**的事（原则 1），不归属任何节点，全部落在 `base/`。

### 组件清单（新增，`src/components/base/`）

| 文件 | 职责 | 复刻源 |
|---|---|---|
| `CanvasToolbar.jsx` | 左下角工具栏容器（运行/整理/小地图/清理/适合视图/性能模式/缩放±%） | `H_.jsx:12013-12094` |
| `ArrangeConfirm.jsx` | 整理后「是否保留整理结果？」确认弹窗（还原/保留） | `H_.jsx:11993-12012` |
| `useArrangeCanvas.js` | dagre 自动布局 hook（含 group 父子、连通分量分组换列） | `H_.jsx:10985` `Ui` / `Ctrl+L` |

**依赖**：`dagre`（新增 npm 依赖，有向图分层布局引擎）。

### 各功能的行为约定

1. **小地图（MiniMap）**：`App.jsx` 用 `minimapOn` state（默认开）控制 `<MiniMap>` 显隐。样式复刻官方：`#222` 底 + `#333` 描边 + `maskColor #0d0c0c80` + `nodeColor #444`，定位在左下角工具栏上方（`absolute left-4 bottom-16`），仅节点数 `<100` 时显示（官方 `De.length < 100`）。
2. **整理画布（dagre 自动排版）**：`useArrangeCanvas` 复刻官方 `Ui`——
   - dagre 配置 `rankdir:'LR' / nodesep:300 / ranksep:300 / align:'UL'`，compound graph 支持 group 父子；
   - 布局后按**连通分量**分组（BFS），逐分量摆位，超宽 2500 换列（列距 +400），分量内间距 +300；
   - 写回新位置 + 全部 `data.expanded=false` + `fitView`；
   - `App.jsx` 在排列前存快照 → `ArrangeConfirm` 弹「是否保留」→ 还原=写回快照 / 保留=关闭。`Ctrl+L` 也触发。
3. **性能模式（enablePerformanceMode）**：`App.jsx` `performanceMode` state（默认开，官方默认 `true`）。
   - 传给 `LodListener enablePerformanceMode` → 控制 LOD 分级（zoom≤0.5→1, ≤0.3→2, ≤0.2→3，给 `.react-flow` 加 `lod-1/2/3` class）；
   - **节点媒体降级**：节点用 `useLod()` 读 `lodLevel`，缩小时隐藏图片/视频/音频——
     - `ImageNode`：lodLevel≥2 隐藏图片，≥3 连视频/音频也隐藏；
     - `PromptNode`（生图结果）：lodLevel≥2 隐藏结果图；
     - `DiscountVideoNode`：lodLevel≥3 隐藏视频。
     隐藏 = 内容区替换为「性能模式已隐藏」占位（保留节点标题与端口）。
   - **顶部横幅**：`performanceMode && lodLevel>=2` 时弹黄色横幅——lodLevel≥3 显「已进入全局性能模式 (图片视频已隐藏)」，否则「低缩放性能模式 (图片已隐藏)」（复刻 `H_.jsx:11966-11971`）。
4. **缩放 / 适合视图**：`fitView / zoomIn / zoomOut`（`useReactFlow()`），缩放%由 `onViewportChange` 实时更新。

### 新增节点时如何响应性能模式

想让某节点在缩小时也降级（隐藏重型媒体），只需：
```jsx
import { useLod } from './base/useLod.js'
const { lodLevel = 0 } = useLod()
// lodLevel: 0=正常, 1=≤0.5, 2=≤0.3, 3=≤0.2
const hideMedia = lodLevel >= 2 // 按需调阈值
```
然后渲染时 `!hideMedia && <img/video/...>`，替换为轻量占位即可。**阈值选择对齐横幅语义**：≥2 藏图片，≥3 藏视频。

---

## 二.6、画布统一工具层（Canvas Agent Tools，`useCanvasAgentTools.js`）

> **给将来「AI 画布助手」（LLM function calling）铺路**。官方 A1 画布助手（`docs/27`）依赖「30 个画布工具 + 前端执行器 + LLM 中转」。本原型已用 ReactFlow 重写了画布操作（`addNode`/`setNodes` 等在 App.jsx），**缺的正是把这份能力抽象成「可被 LLM 调用」的统一工具层**——这就是 `useCanvasAgentTools`。

### 为什么放 base/（原则 1 关注点分离）

- 工具层通过 `useReactFlow()` 自取能力（同 `useScriptBoxEngine` 模式），**App 无需传参、不变成垃圾场**。
- 它只是「画布操作」的**统一出口**，不含任何 Agent UI / LLM 逻辑。Agent 面板（聊天/工具调用循环）是后续独立工作，届时只需调 `callTool(name, args)`。

### 工具返回契约（原则 4 面向真实引擎）

每个工具 `{ ok, data | error }`，`error` 恒为人话，可直接喂 LLM（对齐官方 `lr()` 返回形状，LLM 解析无差异）。写操作一律「不可变局部更新」（原则 3）：只改目标节点，非目标节点 `: n` 原样返回。

### 何时走工具层 / 何时不走

- **走**：Agent 面板、自动化脚本、测试驱动画布——统一走 `useCanvasAgentTools`，保证「画布操作」只有这一个出口。
- **不走**：节点内部 UI 交互（那是节点自己的事）；手写一次性操作（直接 `setNodes`）。

### 新增工具流程

1. 在 `useCanvasAgentTools.js` 定义工具对象（`name/description/parameters/execute`，`execute(args, ctx)` 返回信封）。
2. 加入 `AGENT_TOOLS` 数组 → 自动出现在 `toolSchemas`（LLM 可见）与 `CANVAS_AGENT_TOOL_NAMES`。
3. 在 `scripts/test_agent_tools.cjs` 加一条用例（`npm run test:tools`）。
4. 登记进 `BASE-CAPABILITIES.md` §二.5 清单。

### 接真系统路径

当前操作 ReactFlow 内存画布（原型阶段）。接真引擎时若 Agent 改走服务端，只需把 `setNodes/setEdges` 换成调 localTool 状态接口；**工具签名与返回信封不变，LLM 侧无感知**（原则 4 的可对接性）。

---

## 三、数据范式（原则 2 的落地）

### 范式 A：useState 缓存型（普通节点：PromptNode / DiscountVideoNode / TextNode …）

- 业务数据存组件本地 `useState`，初始化从 node.data 读，运行时改动不强制写回。
- **为什么行**：这些数据只被本节点 UI 读写，本地 state 足够，局部刷新、实现简单（原则2）。
- 生成用 `useGenerate`（假实现）+ `setImageUrl/setVideoUrl`。

### 范式 B：node.data 单一数据源型（复合节点：剧本盒子）

- 业务数据只存 node.data，组件绝不用 useState 缓存 shots/assets。
- UI 编辑 → `updateData(patch)`；UI 触发生成/连线 → 只调 `d.onXxx?.()`；引擎经 `getData/updateData` 交互。
- **为什么必须这样**：数据被引擎（异步回写）+ UI（编辑）+ 连线（读取）三方操作，任何本地副本都会失同步（原则2）。单一真相 + 回调注入保证引擎零耦合接入（原则4）。

### 判断准则（新增节点先回答）

> 问自己：**这份数据会不会被 node.data 之外的东西（引擎/连线/持久化/复制）读写？**

| 回答 | 范式 |
|---|---|
| 不会，只被本节点 UI 读写 | A（useState） |
| 会，被引擎/连线/复制读取 | B（node.data） |
| 弹窗开关/视图模式/选中项这类纯 UI 状态 | 一律 useState（即使节点是 B） |

---

## 四、写回通道（原则 3 的落地）

| 通道 | 用途 |
|---|---|
| `setNodes` | 引擎生成/连线写回（B 型节点） |
| `updateData`（`useScriptBoxData`） | UI 编辑写回（B 型节点） |

**写回铁律（原则3）**：
1. **不可变局部更新**：只改目标字段，其余字段/节点保留旧引用。禁止原地 `push`/`赋值`。
2. **单节点刷新**：`setNodes(ns => ns.map(n => n.id===id ? {...n,data:{...n.data,...patch}} : n))`，非目标节点 `: n` 原样返回。**绝不**给所有节点造新引用。
3. **高频输入缓冲**：打字/拖拽先存本地编辑态，保存才 `updateData` 一次（GearSettings 模式）。

---

## 五、连线机制（@软连接）

- 剧本盒子分镜文本写 `@资产名` = **软连接标记**。
- 下游生图/生视频时按 `@资产名` 匹配收集有图的资产为参考图（纯函数）。
- **没写 `@` 或资产没出图 → 带不上参考图。**
- **为什么**：资产图不是靠真实连线传的，而是「文本标记 + 下游动态收集」——解耦剧本盒子与下游（原则1），也保证参考图只在有图时才生效。

---

## 六、命名规范（原则 4 的落地 + 可读性）

### 禁止混淆短名
官方 `src/bundle/` 是混淆产物（`Ar/Pr/Fr/Ir/Mr/Nr/Un/oi/ai/li/ui/di/ii/Zg/Yg/Qg/Fa/Ra/K/zt` 无语义）。**自研代码禁止用这些做标识符**，必须用语义化全名。

- 允许例外：注释里标注官方符号对应关系（`// onGenerateScript(Ar)`）——是价值对照信息。
- 对照表：`Ar→generateScript`、`Zg→buildAssetPrompt`、`Nr→assembleShotUser`、`K→setNodes`、`zt→abortMap` 等。

### 数据字段全名（契约单一命名）
数据契约命名与官方一致，禁止简写/别名：`globalStyle`（非 style）、`category`（非 cat）、`description`（非 desc）、`gridMode`（非 grid）。**同一份数据两个名字 = 失同步**（原则2）。

---

## 七、新增节点流程（把原则落到行动）

### 7.1 范例代码指路（写节点前先读这些，别凭想象）

> **不要凭空造结构，直接抄/仿下面的真实代码。** 每个文件示范了一种范式或机制，读它比读规则更准。

| 想写什么 | 去看这个真实文件 | 它示范了 |
|---|---|---|
| 范式 A（useState 型普通节点） | `src/components/TextNode.jsx` | 数据用 useState、纯 UI 状态用 useState、`useGenerate` 假生成、`NodeShell/HoverToolbar/GenerateButton/PromptInput` 基座组装 |
| 范式 B（node.data 复合节点） | `src/components/ScriptBoxNode.jsx` + `src/components/scriptbox/StepShots.jsx` | 业务数据只读 data、编辑走 updateData、只调 `d.onXxx?.()`、纯 UI 状态留 useState |
| 范式 B 数据写回通道 | `src/components/base/useScriptBoxData.js` | `updateData(patch)` 不可变写回（`setNodes` 里非目标节点 `: n` 原样返回） |
| 范式 B 引擎注入 | `src/components/base/useScriptBoxEngine.js` | `useReactFlow()` 拿 setNodes/addNodes/坐标 → 建引擎 → 挂 node.data.onXxx |
| 范式 B 引擎实现 | `src/components/base/scriptBoxEngine.js` | `createScriptBoxEngine({getData,updateData,addNodes})` 返回回调，假实现标注真链路 |
| 纯函数层（无副作用） | `src/components/base/scriptBoxPrompts.js` | 提示词模板 / 拼装函数，UI 与引擎都从这里取 |
| 节点外壳 / 端口 / 尺寸 | `src/components/base/NodeShell.jsx` + `CustomHandle.jsx` + `base/hooks.js` | 所有节点的公共骨架，直接复用 |
| 通用控件 | `src/components/base/GenerateButton.jsx` / `HoverToolbar.jsx` / `ModelSelect.jsx` / `PromptInput.jsx` / `ExpandablePanel.jsx` / `FullscreenModal.jsx` | 生成按钮 / hover 栏 / 模型下拉 / 提示词输入 / 展开面板 / 全屏，直接复用 |
| 连线特效 | `src/components/CustomEdge.jsx` + `ConnectionLine.jsx` | 自定义连线 + 拖拽临时线 |
| 节点目录注册 | `src/components/base/NodePalette.jsx` | 新增节点加一行，右键菜单自动接入 |

### 7.2 新增节点步骤

1. **先答范式问题**（§三判断准则）：数据被谁读写 → 定 useState 型 or node.data 型。
2. **对照 7.1 挑范本文件**，仿它的结构建 `components/XxxNode.jsx`（不造轮子、不凭空编 props）。
3. **注册目录**：`NodePalette.jsx` paletteNodes 加一行（type/label/icon/cat/data）。
4. **注册 nodeTypes**：`App.jsx` nodeTypes 加一行 `type → 组件`（只这一行，无逻辑）。
5. **接引擎**（B 型）：仿 `useScriptBoxEngine.js` 注入回调，App 不改。
6. **验证**：`npm run build` + `npm run test:smoke` + `npm run test:regression` 三道门全绿。
7. **沉淀**：数据契约 / 行为写进对应交接文档。

---

## 八、验收自检（写完代码对照）

- [ ] App.jsx 只加了 nodeTypes 一行 + 演示数据？没加节点逻辑？
- [ ] 数据放对范式了？该进 node.data 的没进 useState？
- [ ] 写回是不可变局部更新？非目标节点 `: n` 原样返回？
- [ ] 标识符是语义全名？没搬官方混淆短名？
- [ ] 假实现标注了真链路？回调签名对齐契约？
- [ ] 三（build / smoke / regression）道门全绿？

---

## 九、踩坑经验（开发教训，新增节点/改节点必读）

> 以下是从图片盒子 / 图片切分 / 图片拼图复刻中反复踩到的坑。**每条都是真发生过的事**，下次动手前先对照，能省一整轮调试。

### 9.1 新建文件后 dev server 模块缓存会坏（最高频坑）
- **症状**：页面报 `Uncaught SyntaxError: The requested module '.../XxxNode.jsx?t=...' does not provide an export named 'default'`，但 `check-jsx` / esbuild 打包都通过。
- **根因**：dev server **启动早于**新文件创建（或新文件编辑中途被缓存），Vite 内存里的模块图钉住了一个损坏/空版本，`npm run build` 反而能过。
- **修法**：**重启 dev server 并清缓存**（新文件/改 App.jsx 后必做）：
  ```powershell
  $p = (Get-NetTCPConnection -LocalPort 5180 -State Listen | select -expand OwningProcess | select -First 1)
  if ($p) { Stop-Process -Id $p -Force }
  Remove-Item -Recurse -Force node_modules\.vite
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > dev-server.log 2>&1" -WindowStyle Hidden
  ```
- **判定**：重启后浏览器动态 `import('/src/components/XxxNode.jsx')` 应返回 `{ default: fn }`；再跑 `test:smoke` 确认注册生效。

### 9.2 import 路径要核对层级
- 坑例：`CustomHandle.jsx` 在 `src/components/`（根），不是 `base/`。写成 `./base/CustomHandle.jsx` → 500 / 模块加载失败。
- 铁律：**复用既有组件的 import 路径，用 `read_file` 看过原文件再写**，别凭记忆。`NodeTitle` 在 `components/`，`NodeShell/CustomHandle` 等在外壳组件里自查。

### 9.3 节点外观必须与其他节点统一
- **标题**：一律用 `NodeShell` 自带标题（传 `label/defaultTitle/icon`），标题右侧操作组用 **`titleRight` 插槽**（NodeShell 渲染，`absolute right-0 -top-0.5` 与标题垂直居中）。**禁止** `showTitle={false}` 后自己在 children 里渲染 NodeTitle——会把标题包进主容器内、出现双重外框、边框颜色不一致。
- **边框/背景**：主容器边框由 NodeShell 统一（`border-[#333]`），节点内层**不要**重复加 `border` + 独立 `bg`（如 `bg-[#121212]`），否则出现内外两个框、颜色不一致。图片/内容区只做圆角内容面板，不顶替外框。
- **验证**：新增节点后用 playwright 量标题离主容器距离，应与 `textNode`（文本生成）一致（实测左 17px / 顶 -20.5px）。

### 9.4 高度用 ResizeObserver 自适应（别固定 420）
- 坑例：图片切分节点被 NodeShell 默认 `minHeight 420` 撑高，内容只有 280px，底部大块空白。
- 铁律：**复合/可折叠内容节点用 `useNodeResize(id)` + ResizeObserver** 让高度贴合内容：
  ```js
  const { onMainBoxResize } = useNodeResize(id)
  const contentRef = useRef(null)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      if (!h) return
      const n = getNodes().find((x) => x.id === id)
      if (Math.abs(h - (n?.height ?? n?.style?.height ?? 0)) < 4) return
      onMainBoxResize(Math.round(n?.width ?? n?.style?.width ?? 320), Math.max(160, Math.round(h)))
    })
    ro.observe(el); return () => ro.disconnect()
  }, [id, getNodes, onMainBoxResize])
  ```
  内容区 `div ref={contentRef}`。实测节点高度从 420 → 301，贴合内容。

### 9.5 改公共组件要保证默认行为不变
- 给 `NodeShell` 加的 `showTitle` / `titleRight` prop，**默认值必须不影响既有节点**（`showTitle` 默认 true、`titleRight` 默认 undefined → 走原逻辑）。改完跑 `test:smoke` + `test:regression`，确认 TextNode / PromptNode 等标题无回归。

### 9.6 完整复刻官方，不简化
- 官方 `Yo.jsx`（图片拼图）有 grid / longImage / overlay 三模式，overlay 是完整的图层编辑器（`Uo.jsx`：图层列表/排序/涂抹擦除/属性面板/全屏）。**用户要求与官方一致时，模式与交互必须全做**，不能用简化版占位。复杂子功能抽到 `base/` 独立文件（如 `base/OverlayEditor.jsx`），主组件保持清晰。

### 9.7 注册节点要三处同步
- `App.jsx` nodeTypes 一行 + `NodePalette.jsx` 一行（**记得 `builtin: true` + 默认 data**，否则 palette 有但画布不渲染/缺默认值）。漏一个 → 右键菜单能搜到但建不出来或渲染异常。

### 9.8 节点默认尺寸
- 需要固定窄容器的节点（图片切分 `280px`、图片拼图 `320px`）在 `App.jsx` `addNode` 里 `Object.assign(newNode, { width, style: { width } })`。图片区用 `h-auto`（跟随图片比例）或固定高度，别让节点被撑太大。

### 9.9 功能验证用 playwright 实测，不只靠 check-jsx
- `check-jsx` / lint 只查语法。**交互类功能（拖拽交换、模式切换、上传、展开）必须用 playwright 打开 dev server 实测**，注入带数据的 localStorage 快照 + 模拟事件，断言渲染结果与 JS 错误数。临时脚本用完删，不留仓库。