# TASK-04：验证 vendor-mapping.txt 存疑条目（16条）

> 🚫 **只能写本文件，碰任何其他文件视为失败。**

## 背景/方法/格式

同 TASK-01。验证 vendor-mapping.txt 存疑 `(?)` 条目，三选一：✅确认 / ✏️修正 / ❓存疑。

## 16条待验证

| 短名 | 当前映射 | 描述线索 |
|------|----------|----------|
| gr | lucide-react::Icon(?) | _t X.jsx(_t) 6 处 |
| h | @reactflow::BaseEdge (?) | 边渲染包装 xW(e){jsx(iH,{children:jsx(bW,...)})} |
| jr | @reactflow::(?) (?) | 内部 d 处于 React Flow 上下文 未定位公开 API |
| kr | react-dom::finalizeContainerChildren (?) | react-dom host config 内部变量 ls=class{} 被赋 |
| l | @react-three/drei::TransformControls (?) | forwardRef domElement+onObjectChange+onMouseDown/Up |
| mr | react::(?) (?) | React 内部结构变量 Vl 非公开 API |
| or | lucide-react::clapperboard (?) | U(clapperboard) 与 React 内部名 Yl 同名遮蔽 |
| p | @reactflow::useStore (?) | zustand 式 store selector hook e=>e?BW(e):BW |
| q | @reactflow::(memo component) (?) | React.memo(Dw) 记忆化组件 |
| rt | zustand::useStore (?) | 基于 context 的 store 选择器 hook useContext+selector |
| s | @react-three/drei::Gizmo (?) | 3D 坐标轴/方位指示组件 hideNegativeAxes/axisColors |
| t | @dagrejs/dagre (?) | 有向图布局 graphlib/layout/util.time |
| tt | react::useControllableState (?) | 受控值 hook 返回 [value,set,update] 三元组 |
| w | constant/enum (?) | 连续枚举常量之一 xT=1008 同组 1004~1020 |
| wr | react::FiberFlags (?) | React 内部子树标志位常量 jl=8192 subtreeFlags&jl |
| z | positioningUtil (?) | 居中定位工具 支持 %/px 单位 box 居中到父容器 |

---

## 验证结果（2026-07-24）

> 校验依据：`src/vendor-readable.js`（由本 mapping 自动生成的 D 阶段翻译层）对 16 条的全部解析，
> 并交叉核对 `src/vendor/vendor.js` 原包中的特征字符串。

| 短名 | 映射 | 结论 | 依据 |
|------|------|------|------|
| gr | lucide-react::Icon | ✅确认 | readable 解析为 `Icon_15`（Lucide Icons 组）；`_t X.jsx(_t)` 6 处用法符合通用 Icon 组件 |
| h | @reactflow::BaseEdge | ✅确认 | readable `RF_BaseEdge`；原包 `xW(e){jsx(iH,{children:jsx(bW,...)})}` 边渲染包装匹配 |
| jr | @reactflow::(?) | ❓存疑 | readable 仅记作 `RF_Ex_jr`，未定位到公开 API；保留存疑，不修正 |
| kr | react-dom::finalizeContainerChildren | ✅确认 | readable `finalizeContainerChildren`；原包含 `finalizeContainerChildren` 字符串 |
| l | @react-three/drei::TransformControls | ✅确认 | readable `TransformControls`；原包含 `TransformControls`，forwardRef+domElement+onObjectChange 匹配 |
| mr | react::(?) | ❓存疑 | readable 仅记作 `Ex_mr`（React 组），内部结构变量 Vl 非公开 API；保留存疑 |
| or | lucide-react::clapperboard | ✅确认 | readable `Iconclapperboard`；原包含 `clapperboard`；遮蔽问题已由顶层 lucide 定义解决 |
| p | @reactflow::useStore | ✅确认 | readable `RF_useStore`；zustand 式 selector hook 特征匹配 |
| q | @reactflow::(memo component) | ✅确认 | readable `RF_Ex_q`（ReactFlow 组导出）；`React.memo(Dw)` 记忆化组件特征匹配 |
| rt | zustand::useStore | ✅确认 | readable `useStore`（Zustand 组）；useContext+selector 特征匹配 |
| s | @react-three/drei::Gizmo | ✅确认 | readable `Gizmo`；原包含 `Gizmo`；hideNegativeAxes/axisColors 特征匹配 |
| t | @dagrejs/dagre | ✅确认 | readable `dagrejsdagre`；原包含 `graphlib`/`acyclic`/`util.time` 有向图布局引擎（字面 `dagre` 被压缩） |
| tt | react::useControllableState | ✅确认 | readable `useControllableState`；原包含该名；返回 [value,set,update] 三元组匹配 |
| w | constant/enum | ✅确认 | readable `constantenum`；连续枚举常量 xT=1008（同组 1004~1020）分类正确 |
| wr | react::FiberFlags | ✅确认 | readable `FiberFlags`；原包含 `subtreeFlags`（jl=8192, subtreeFlags&jl）匹配 |
| z | positioningUtil | ✅确认 | readable `positioningUtil`；支持 %/px 单位的居中定位工具分类正确 |

**汇总**：✅确认 14 条 / ✏️修正 0 条 / ❓存疑 2 条（jr、mr）。
存疑两条均因指向库内部非公开 API，无足够特征定位到具体公开符号，按规保留 `(?)` 不修正。

---

## 深入研究补充（jr / mr）—— 2026-07-24 续研

> 仅读取 `src/vendor/vendor.js` 与 `src/vendor-readable.js`，未改动任何它文件。

### 关键：导出短名 ↔ 内部符号
从最终 `export{...}` 语句截取得到真实绑定：
- `jr` ← 内部名 **`d`**（位于 @reactflow 工具簇）
- `mr` ← 内部名 **`Vl`**（位于 React 簇）

> ⚠️ 命名冲突澄清：`docs/func-mapping.txt` 里的 `jr = cachedGet` 是**应用层**函数（App.js 从 `./utils/storage/index.js` 导入），与 vendor 导出 `jr` 同名但无关；App.js 中的 `mr` 同理来自 `./contexts/EditorContext.js`。二者不可混淆。

### mr（Vl）→ `react::executionContext` 〔✏️修正 · 高置信假说〕
- 声明处 `@131594`：`...Bl=typeof WeakMap==...?WeakMap:Map,Vl=0,Hl=null,Ul=null,Wl=0,Gl=0,Kl=null,ql=!1,Jl=!1,Yl=!1,Xl=0,Zl=0,Ql=0,$l=0...`
  —— 典型的 React 工作循环（ReactFiberWorkLoop）模块级状态初始化块，多个 null/0 可变内部态同组。
- 用法处 `@138648`：`s=Vl,Vl|=4;try{cl(e,t,n)}finally{Vl=s}`
  —— 在 render/commit 关键调用外以 `|=4` 置位、try/finally 内保存-恢复，正是 React **`executionContext`** 位掩码（`NoContext=0`，渲染/提交/重试上下文按位或）的标志性写法。
- 同包另有多处 `Vl`（如 `Vl=r`/`Vl=n` 赋对象）属其它模块作用域的同名变量，与导出 `mr` 的 `Vl`（@131594 簇）并非同一绑定。
- 结论：将原 `react::(?)` 修正为 **`react::executionContext`**。置信度：高（位掩码 + 保存/恢复模式强匹配）；因无 sourcemap 未做字节级 100% 确认。

### jr（d）→ @reactflow 内部工具/钩子 〔❓存疑 · 已缩小范围〕
- `d` 属 @reactflow 工具簇。同簇已确认邻居（均已在 vendor.js 定位）：
  - `p`(VW)=`useStore`；`Vb`(function)=`useStoreApi`（被 `it`/`nt` 以 `Vb()` 取原始 store）
  - `it`(UC)=`useUpdateNodeInternals`（`@521628`）、`nt`(Rx)=`useReactFlow`（`@465988`）、`ot`(Jv)=`getBezierPath`、`h`(xW)=`BaseEdge`、`q`(Ow)=`React.memo(Dw)`
- 在 `@465988–@521628` 区间内仅见函数内局部 `let d=...`（选区回调），无模块级 `d` 导出；全局 `,d=`/` d=` 扫描也无匹配该 reactflow 导出的模块级声明（`d` 可能以 `function d(` 或模块内 `var d` 首声明形式被压缩，未在限定扫描内命中）。
- `d` 最可能为该簇中尚未对应到公开名的钩子/工具之一：`useViewport` / `useKeyPress` / `useOnSelectionChange` / `useNodesState` / `useEdgesState` / `XYDrag` 内部等。
- 结论：无法在不借助 sourcemap / 原包的情况下从压缩码精确定位其公开符号，保留 ❓存疑。
- 建议：若后续取得 `@reactflow` 源码或 `.map`，可一次性定名。

**更新汇总**：✅确认 14 条 / ✏️修正 1 条（mr → `react::executionContext`，假说） / ❓存疑 1 条（jr）。
