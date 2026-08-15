# 拖端口拉线 → 弹出连线菜单：完整生命周期

> 本文只探究一件"看起来很简单"的事：**从节点端口（Handle）按住拖出一条连接线，松手时没有连到有效目标，于是在松手处弹出一个菜单**。这个交互在官方 React Flow 复刻代码（`src/bundle/httpClient-BknZwXjG_components/H_.jsx`）里到底是怎么一步步发生的。
>
> **重要澄清**：这个交互用的是 **鼠标左键拖拽（左键按下→移动→松开）**，**不是右键**。右键触发的 `onPaneContextMenu` / `onNodeContextMenu` 是另一套上下文菜单，与本文的"连线菜单"不是一回事。很多同学把两者混为一谈，所以这里先划清界限。

---

## 0. 一句话总览

```
鼠标在 Handle 上按下
  → React Flow 内部进入 "connection in progress" 状态，开始画连接线（connectionLineComponent = _cmp_Pg）
  → 鼠标移动：连接线跟随光标；经过有效 Handle 时高亮、并记录潜在目标
  → 鼠标松开（pointerup / onConnectEnd 触发）
       ├─ 连到了有效目标  → 触发 onConnect，建立边，菜单不出现
       └─ 没连到有效目标 → Oi() 判定 screenToFlowPosition 得到的落点在画布空白处
                              → 构造 Fe = { type: "connection", connection, x, y }
                              → Ie(Fe) 打开菜单状态
                              → 菜单渲染：列出可选节点类型，点击后 di(...) 建节点并自动连线
```

下面逐阶段展开。

---

## 阶段 1：起点 —— Handle 上的 `onPointerDown`

连接线的整个生命周期由 **React Flow 的 Handle 组件**接管。用户把鼠标按在某个节点的 source/target Handle 上，React Flow 内部开始一次"连接会话"。

这一步发生在 React Flow 库内部（`Handle` 组件），在 `H_.jsx` 外部。我们能在 `H_.jsx` 里看到的，是这次会话对我们画布的**配置**：

```11958:11958:H_.jsx
connectionLineComponent={_cmp_Pg}
connectionRadius={60}
onConnect={Yn}
onConnectEnd={Oi}
```

四个关键配置的含义：

| 配置 | 作用 | 在本文中的位置 |
|------|------|----------------|
| `connectionLineComponent={_cmp_Pg}` | 拖拽时画的那条"临时连接线"长什么样 | 阶段 2 |
| `connectionRadius={60}` | 光标离某个 Handle 多近算"对准了" | 阶段 2 命中检测 |
| `onConnect={Yn}` | 真正连到有效目标时创建边 | 阶段 3 分支 A |
| `onConnectEnd={Oi}` | 松手时**无论连没连上都会调用** | 阶段 3 分支 B（本文主角） |

> 注意：`onConnectEnd` **每次松手都会触发**，不管成功还是失败。成功/失败的判定逻辑就在 `Oi` 内部。

---

## 阶段 2：拖拽中 —— 连接线跟随光标

拖拽过程中，React Flow 持续以 `connectionLineComponent`（`_cmp_Pg`）渲染一条临时线，起点是原始 Handle，终点跟随光标。同时它用 `connectionRadius` 做命中检测：

- 若光标进入某 Handle 的 `connectionRadius`（60px）范围，该 Handle 被视为"潜在目标"，会高亮；
- React Flow 内部维护 `connectionState`（含当前连接起点 `fromHandle`、`fromNode` 等）。

这一阶段纯属 React Flow 内部渲染，`H_.jsx` 不直接参与，我们只是把"那条线长什么样"交给了 `_cmp_Pg`。

---

## 阶段 3：松手 —— `onConnectEnd`（核心函数 `Oi`）

鼠标松开，React Flow 调用我们注册的 `Oi`。这是整篇文章的**心脏**。

### 3.1 两个取值的关键来源

```10143:10148:H_.jsx
let Oi = e => {
  let t = (e.clientX, ...ve());   // ve() = React Flow 的 screenToFlowPosition 等价物
```

- `e`：原生 pointer 事件，含 `clientX / clientY`（屏幕坐标）。
- `ve()`：由 `useReactFlow` 暴露的 `screenToFlowPosition`，把屏幕坐标换算成画布（flow）坐标。

### 3.2 判定是"成功连线"还是"落在空白"

```10148:10160:H_.jsx
  let n = t.x;
  let r = t.y;
  let i = {
    source: Re.current,
    sourceHandle: Ce.current,
    target: ...ne.current,
    targetHandle: ...le.current
  };
  let a = i.target != null;       // 关键：拖拽结束时，React Flow 是否记录了一个有效 target？
  if (a) {
    // 分支 A：连到了有效端口 → 走 Yn（建边），不弹菜单
  } else {
    // 分支 B：没连上 → 落点在空白 → 准备弹菜单
  }
```

判定逻辑非常直白：`i.target != null`。

- **分支 A（`a === true`）**：`Re.current` 存的 source、`ne.current` 存的 target 都有效 → 走 `Yn`（即 `onConnect`），生成一条新边（见下文 3.4 附注）。
- **分支 B（`a === false`）**：拖拽结束时没有任何 Handle 被命中 → 落点是画布空白 → 进入弹菜单流程。

### 3.3 分支 B：构造菜单状态 `Fe` 并打开

```10172:10182:H_.jsx
  if (a) {
    ...
  } else {
    let s = {
      type: `connection`,          // 菜单类型标记为 "connection"
      connection: i,               // 把这次的 source 信息（source / sourceHandle）一起带过去
      x: n,                        // 松手处的画布坐标 x
      y: r                         // 松手处的画布坐标 y
    };
    Ie(s);                         // ← 打开菜单！把状态交给 React 的 state setter
  }
```

要点：

1. `type: "connection"` 把这次菜单和"右键画布弹出的普通菜单"区分开。`Ie` 是菜单 state 的 setter，`Fe` 就是传进去的 payload。
2. `connection: i` 非常关键——它带着**这次拖拽的 source 节点 id 和 sourceHandle id**。这样后面用户选了某个菜单项，新建节点后能**自动从原始端口连到新节点**。
3. `x / y` 是落点的画布坐标（由 `ve()`/screenToFlowPosition 换算得到），菜单会定位在这里。

> `Ie` 与 `Fe` 是一对 state：`Ie` 是 setter，`Fe` 是当前菜单状态对象（可能含 `type: "canvas" | "node" | "connection" | "selection"` 等多种类型）。`Oi` 把 `Fe` 设成 `connection` 型，就触发了下方的菜单渲染分支。

---

## 阶段 4：菜单渲染 —— 根据 `Fe.type === "connection"` 画出选项

`H_.jsx` 在 React Flow 外层渲染一个大菜单组件（内部 `Component3119`）。它会根据 `Fe.type` 决定渲染哪一组菜单项。当 `Fe.type === "connection"` 时，渲染的是**可用作连线目标的节点类型列表**：

```12232:12271:H_.jsx
{Fe.type === `canvas` || Fe.type === `connection` ? <Q.Fragment>
  {/* 文本节点 */}
  <Component3036 onClick={() => di(`textNode`, gi(), { text: `` }, Fe.connection)}>文本</Component3036>
  {/* 图片节点 */}
  <Component3040 onClick={() => di(`promptNode`, gi(), { prompt: `` }, Fe.connection)}>图片</Component3040>
  {/* 视频节点 */}
  <Component3044 onClick={() => di(`discountVideoNode`, gi(), { prompt: `` }, Fe.connection)}>视频</Component3044>
  {/* 剧本盒子 */}
  <Component3048 onClick={() => di(`scriptBoxNode`, gi(), { step: 1, shots: [], assets: [] }, Fe.connection)}>剧本盒子</Component3048>
  {/* AI应用 */}
  <Component3050 onClick={() => di(`rhWebappNode`, gi(), { webappName: `AI应用`, openAppSelectorOnMount: true }, Fe.connection)}>AI应用</Component3050>
  ...
```

每个菜单项的 `onClick` 都调用同一个工厂函数 `di(nodeType, position, data, Fe.connection)`：

- 第一个参数：要建的节点类型（`textNode` / `promptNode` / `discountVideoNode` / `scriptBoxNode` / `rhWebappNode` …）。
- 第二个参数 `gi()`：菜单里的"新节点位置"。这里用 `gi()` 而非 `Fe.x/y`，是为了给新建节点一个**带轻微偏移的落点**，避免新节点正好压在光标/菜单上（详见阶段 5）。
- 第三个参数：新节点初始 `data`。
- 第四个参数 `Fe.connection`：把阶段 3.3 存下来的 source 信息回传，用于**自动连线**。

### 菜单定位

菜单的屏幕位置由 `Fe.x / Fe.y`（画布坐标）经 `screenToFlowPosition` 的反向换算得到，并做边界保护，防止超出画布容器：

```11595:11612:H_.jsx
  let { x: e, y: t } = Fe;          // 取出画布坐标
  let n = Fe.type === `node` || Fe.type === `selection` ? 150 : 550;  // 菜单预估高度
  if (Le.current) {                // Le = 画布容器 ref
    let r = Le.current.getBoundingClientRect();
    if (e + 160 > r.width)  e = r.width - 160 - 10;   // 右边界保护
    if (t + n > r.height)   t = Math.max(10, r.height - n - 10);  // 下边界保护
  }
  return { top: t, left: e };
```

---

## 阶段 5：点击菜单项 —— `di()` 建节点 + 自动连线 + 关闭菜单

`di` 是"建节点"的统一工厂（`H_.jsx:8659`）。在连线场景下的调用签名是 `di(nodeType, gi(), data, Fe.connection)`。它做了三件事：

1. **建节点**：在 `gi()` 算出的位置插入一个新节点。
2. **自动连线**：因为第四个参数带了 `Fe.connection`（含原始 `source` 和 `sourceHandle`），`di` 内部会额外创建一条从原始端口指向新节点的边，相当于"你拖到一半没连上，我帮你补完这次连接"。
3. 节点建好后，菜单状态被清空：`Ie(null)`（见 `Oi` 反义，`Fe` 重置为 `null` 即关闭菜单）。

> 这完美回答了"为什么拖到空白松手也能连成线"——因为松手时连接没完成，但 source 被暂存进了 `Fe.connection`，点击菜单项时由 `di` 用这个 source 把边补出来。用户感知上就是"拉一条线 → 选个节点 → 线自动接上了"。

### `Yn`（分支 A 的 onConnect）—— 成功连线的对照

作为对照，当拖拽**成功命中**目标 Handle 时走的是 `Yn`（`H_.jsx:1217`）：

```1217:1217:H_.jsx
let Yn = Z.useCallback(e => {
  let t = J();   // getNodes()
  ...
```

`Yn` 直接拿 React Flow 给的 `connection` 参数（`{ source, sourceHandle, target, targetHandle }` 都齐全）创建边，不涉及菜单、不涉及 `di`。

---

## 阶段 6：菜单关闭

菜单关闭有两条路径：

1. **正常**：点击菜单项 → `di` 建节点后 `Ie(null)` 关闭。
2. **取消**：点击画布空白（`onPaneClick={nr}`）会调用 `Ie(null)` 关闭；或再次触发 `Oi` 命中其他分支。

源码中 `Ie(null)` 的两处直接调用（行 10103 处的关闭逻辑与菜单内的 `onPaneClick`）共同保证菜单不会残留。

---

## 完整时序图

```
用户                       React Flow 内部               H_.jsx（我们的代码）
 │                              │                              │
 │─ mousedown on Handle ───────>│ 进入 connection 会话         │
 │                              │ 用 connectionLineComponent   │
 │                              │ (_cmp_Pg) 画跟随光标的临时线  │
 │─ mousemove ─────────────────>│ 命中检测(connectionRadius=60)│
 │                              │ 记录潜在 target(ne/le.current)│
 │─ mouseup ───────────────────>│ 调用 onConnectEnd(Oi)        │
 │                              │                              │
 │                              │                              │ Oi(e):
 │                              │                              │  t = ve()  ← screenToFlowPosition
 │                              │                              │  a = (target != null)?
 │                              │                              │  ├─ true  → Yn()  建边(分支A)
 │                              │                              │  └─ false → Fe={type:"connection",
 │                              │                              │         │           connection:i,
 │                              │                              │         │           x,y}
 │                              │                              │         └→ Ie(Fe) 打开菜单
 │                              │                              │              │
 │                              │             渲染菜单(Fe.type==="connection")│
 │<── 看到菜单选项(文本/图片/…) ──│<──────────────────────────────┘
 │                              │                              │
 │─ 点击"文本" ─────────────────────────────────────────────────>│ di("textNode", gi(), {...}, Fe.connection)
 │                              │                              │   1) 建新节点
 │                              │                              │   2) 用 Fe.connection 自动连线
 │                              │                              │   3) Ie(null) 关闭菜单
 │<── 新节点出现，且从原端口连到它 ──│                              │
```

---

## 关键变量速查

| 变量 | 含义 | 定义处 |
|------|------|--------|
| `Oi` | `onConnectEnd` 回调，本文主角 | `H_.jsx:10143` |
| `Yn` | `onConnect` 回调，成功连线时建边 | `H_.jsx:1217` |
| `Ie` | 菜单状态 setter | 组件顶部 state |
| `Fe` | 当前菜单状态对象（含 `type`/`x`/`y`/`connection`） | 组件顶部 state |
| `ve` / `Ve` | `screenToFlowPosition`，屏幕→画布坐标换算 | `H_.jsx:121` |
| `gi` | 新节点落点计算（带偏移，防压住菜单） | 组件内 helper |
| `di` | 建节点工厂，第四个参数带 `connection` 时自动连线 | `H_.jsx:8659` |
| `Re/Ce/ne/le.current` | 拖拽开始/结束时的 source 与 target 信息 | React Flow 内部 ref |
| `_cmp_Pg` | 拖拽中那条临时连接线的渲染组件 | 独立文件 |
| `Le` | 画布容器 ref，用于菜单边界保护 | 组件内 ref |

---

## 常见误解澄清

1. **"右键拉出一条线"**：实际是**左键在 Handle 上拖拽**。右键触发的是 `onPaneContextMenu`/`onNodeContextMenu`（画布/节点右键菜单），和"连线菜单"是两套独立机制。`Fe.type` 分别为 `"canvas"/"node"` 与 `"connection"`，靠 `type` 字段区分走哪段渲染。
2. **"菜单是连上之后才出现的"**：错。菜单恰好是**没连上（落在空白）**才出现；连上了走 `Yn` 直接建边，菜单根本不渲染。
3. **"松手就立刻建节点"**：错。松手只是打开菜单，**真正的建节点发生在用户点击菜单项那一刻**（即 `di` 被调用时）。
4. **"那条临时线消失后线就没了"**：松手时临时线确实消失，但 source 被存进 `Fe.connection`；点菜单项时 `di` 用这个 source 把永久边补回来，所以视觉上"线接上了"。

---

# 附：原型里"这个功能一直不成功"的根因与修复

> 前置结论先放这里：**官方 `H_.jsx` 对接的是 React Flow **v12**（`onConnectEnd` 带第二参数 `connectionState`）；而原型 `prototypes/react-nodes` 装的是 **`reactflow@11.11.4`（v11）**，v11 的 `onConnectEnd` **只接收 `event` 一个参数**，根本没有 `connectionState`。原型把 v12 的写法搬过来，`connectionState` 恒为 `undefined`，于是提前 `return`，菜单永不弹出。

## 一、根因：两版 API 签名不同

### 官方（v12 / xyflow）—— 能用

官方 `H_.jsx:10143` 的 `Oi` 用了第二参数 `connectionState` 里的 `isValid / fromNode / fromHandle`：

```js
let Oi = Z.useCallback((e, t) => {          // t = connectionState
  if (!t.isValid && t.fromNode && t.fromHandle) {   // ← 能读到 isValid / fromNode / fromHandle
    ...
```

v12 的 `onConnectEnd` 签名是 `(event, connectionState: ConnectionState)`，`ConnectionState` 含 `fromNode / fromHandle / isValid` 等字段。

### 原型（v11 / reactflow@11.11.4）—— 失败

原型 `App.jsx` 原样搬了官方写法：

```js
const onConnectEnd = useCallback(
  (event, connectionState) => {
    const t = connectionState || {}                 // t = {}（v11 不传第二参）
    if (t.isValid || !t.fromNode || !t.fromHandle) return   // ← 恒 return！
    ...
```

v11 源码（`node_modules/@reactflow/core/dist/esm/index.mjs`）`onPointerUp` 里只传一个参数：

```js:1033:1046:index.mjs
function onPointerUp(event) {
    if ((closestHandle || handleDomNode) && connection && isValid) {
        onConnect?.(connection);
    }
    // it's important to get a fresh reference from the store here
    // in order to get the latest state of onConnectEnd
    getState().onConnectEnd?.(event);      // ← 只有 event，没有 connectionState！
    ...
```

类型定义也印证（`@reactflow/core/dist/esm/types/general.d.ts`）：

```ts:67:68:general.d.ts
export type OnConnectStart = (event: ReactMouseEvent | ReactTouchEvent, params: OnConnectStartParams) => void;
export type OnConnectEnd = (event: MouseEvent | TouchEvent) => void;   // ← 只有 event 一个参数
```

**结论**：`t.fromNode` 永远是 `undefined`，`!t.fromNode` 恒为 `true`，`onConnectEnd` 每次一进来就 `return`，菜单永远弹不出来。这就是"一直不成功"的根本原因。

> 顺带一提：原型注释里写"复刻官方 `onConnectEnd` `Oi:H_.jsx:10143`"，但**官方那套是 v12 的 API**，直接在 v11 上搬运必然水土不服。踩坑根源是「照抄逆向代码却没对照两边 React Flow 大版本」。

## 二、修复方案

在 v11 里要拿"从哪个端口拖出来的"，正确来源是 **`onConnectStart`**（v11 就支持第二参数 `params`）：

```ts:63:68:general.d.ts
export type OnConnectStartParams = {
    nodeId: string;
    handleId: string | null;
    handleType: HandleType | null;
};
export type OnConnectStart = (event: ReactMouseEvent | ReactTouchEvent, params: OnConnectStartParams) => void;
```

思路：**用 `onConnectStart` 记住拖拽源，`onConnectEnd` 直接用事件坐标开菜单**。因为 v11 里 `onConnectEnd` 只在「拖到空白松手」时才会触发（拖到有效 Handle 松手走的是 `onConnect`），所以 `onConnectEnd` 里剩下的场景就可以直接弹菜单，不需要 `isValid` 判断。

### 改法（示意，落点在 `prototypes/react-nodes/src/App.jsx`）

1. **加一个 source 记忆 ref**：记住拖拽起点。

```js
const connectSourceRef = useRef(null)
```

2. **注册 `onConnectStart`**：拖拽开始时记下 source 节点与 handle。

```js
const onConnectStart = useCallback((event, params) => {
  connectSourceRef.current = params ? { nodeId: params.nodeId, handleId: params.handleId } : null
}, [])
```

3. **重写 `onConnectEnd`**：不再依赖 `connectionState`，直接用 v11 的 `event` 坐标 + 记忆的 source 开菜单。

```js
const onConnectEnd = useCallback(
  (event) => {
    const src = connectSourceRef.current
    connectSourceRef.current = null
    // v11 的 onConnectEnd 只在「拖到空白松手」触发；没有源（非端口拖拽）则忽略
    if (!src || !src.nodeId) return
    const { clientX, clientY } = event?.changedTouches?.[0] || event || {}
    if (clientX == null) return
    const rect = menu.containerRef.current?.getBoundingClientRect()
    const pos = screenToFlowPosition({ x: clientX, y: clientY })
    // 建 ghost 占位节点 + ghost 边（保持官方"选中后补连线"的视觉），再弹菜单
    setNodes((ns) => ns.filter((n) => n.id !== 'ghost-target').concat({
      id: 'ghost-target', type: 'ghostTarget', position: pos,
      style: { opacity: 0, pointerEvents: 'none', width: 1, height: 1 },
      data: { label: '' }, selectable: false, draggable: false
    }))
    setEdges((es) => es.filter((e) => e.id !== 'ghost-edge').concat({
      id: 'ghost-edge', source: src.nodeId, sourceHandle: src.handleId || null,
      target: 'ghost-target', type: 'default'
    }))
    setTimeout(() => {
      menu.openConnection(
        { source: src.nodeId, sourceHandle: src.handleId || null, dropPosition: pos },
        clientX - (rect?.left || 0), clientY - (rect?.top || 0)
      )
    }, 50)
  },
  [setNodes, setEdges, screenToFlowPosition, menu.openConnection]
)
```

4. **把 `onConnectStart` 挂到 `<ReactFlow>`**（与 `onConnectEnd` 并列）。

### 关键差异点（为什么这样改就对了）

| 项 | 官方 v12 | 原型 v11（修复后） |
|----|----------|--------------------|
| `onConnectEnd` 第二参数 | 有 `connectionState`，含 `fromNode/fromHandle/isValid` | 无。改为用 `onConnectStart` 记忆的 source |
| 判定"落在空白" | `!t.isValid` | 无需判定——v11 里 `onConnectEnd` 只在拖空时才触发 |
| 获取落点坐标 | `e.clientX/clientY` | 相同，直接取 `event.clientX/clientY` |
| 弹菜单类型 | `{ type:'connection', connection, x, y }` | `openConnection(...)` 内部已组 `{ type:'connection', connection }`，无需改 |

> 只要把「source 来源」从"v12 的 connectionState"换成"v11 的 onConnectStart"，其余逻辑（ghost 占位、`openConnection`、`di` 建节点补连线）都可原样复用——它们本身不依赖版本差异。

---

# 附 2：最终落地 —— 升级 React Flow v12 + 菜单单一数据源

> 上面的"v11 打补丁"（`onConnectStart` 记忆 source）是一条可用的 workaround，但最终**没有采用**。原因：官方逆向用的是 v12，与其在 v11 上打补丁消除 API 代差，不如**直接升到 v12**——官方 `Oi` 那套逻辑原样可用，一劳永逸。同时把拖线菜单并进右键菜单（单一数据源）。

## 一、React Flow v11 → v12 的改动点

| 项 | v11（`reactflow`） | v12（`@xyflow/react`） |
|----|--------------------|------------------------|
| 包名 | `reactflow` | `@xyflow/react` |
| 主组件导出 | `import ReactFlow from 'reactflow'`（default） | `import { ReactFlow } from '@xyflow/react'`（**具名导出**） |
| `onConnectEnd` 签名 | `(event)` 单参数 | `(event, connectionState)`，`connectionState` 含 `fromNode/fromHandle/isValid` |
| `NodeResizer` | 从 `reactflow` 导入 | **主包已内置**，仍从 `@xyflow/react` 导入 |
| CSS | `reactflow/dist/style.css` | `@xyflow/react/dist/style.css` |

改动文件（`prototypes/react-nodes/`）：
- `package.json`：`reactflow@^11.11.4` → `@xyflow/react@^12.x`（实际装到 12.11.3）
- 全部 10 处 `import ... from 'reactflow'` → `from '@xyflow/react'`（App.jsx、CustomHandle/CustomEdge/ConnectionLine/GroupNode、NodeShell/hooks/LodListener/useScriptBoxEngine/useScriptBoxData）
- `main.jsx`：CSS 路径
- `App.jsx`：`ReactFlow` 改为具名导入
- 测试脚本：`scripts/_smoke_checks.cjs`（导出收集改用 `matchAll` 处理 v12 多段 export；依赖名、import 正则更新）、`scripts/regression_test.cjs`（`ReactFlowProvider` 来源）

验证：`npm run build` 通过、`smoke_test` ALL PASS、`regression_test` PASS、Playwright 实测拖线弹菜单 PASS。

## 二、菜单单一数据源（拖线复用右键 canvas 菜单）

升级前原型有一套独立的 `connection` 菜单（`连接文本节点 / 连接生图节点 / 连接特惠视频节点`），与右键 canvas 菜单是两套，状态/渲染/关闭逻辑重复。改为**单一数据源**：

- `useContextMenu.openConnection`：`type` 从 `'connection'` 改为 `'canvas'`，仅把 `connection`（拖拽源信息）挂进 state。
- `App.jsx`：删掉 `connectionMenuItems` 与 `menuItems` 里的 `connection` 分支；新增统一建节点入口 `addNodeFromMenu(type)` —— 有 `connection` → 自动连线 + 清 ghost；无 → 普通建节点。快捷键 Q/W/E 的判断也同步改为检测 `menu.state?.connection`。

效果：拖线弹出的菜单 = 右键画布同一套（文本/图片/视频/小工具），选类型后建节点并自动连到源端口。Playwright 实测：建节点 +1、连线 +1、菜单关闭、ghost 清除、无 JS 报错。

## 三、结论

`onConnectEnd` 弹菜单这件事的根因，本质是 **React Flow 两个大版本 API 不同**：
- 官方 `H_.jsx` 对接 v12，用 `connectionState`（第二参数）；
- 原型原来在 v11，`onConnectEnd` 只有 `event`，照搬 v12 代码导致恒 `return`。

**最终解法 = 升 v12 让 API 对齐（消除代差）+ 菜单单一数据源（消除重复）**。这两步之后，"从端口拖到空白 → 弹出菜单 → 选类型建节点并自动连线"完整跑通。
