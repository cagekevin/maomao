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
