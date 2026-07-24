# TASK-02：验证 vendor-mapping.txt 存疑条目（19条）

> 🚫 **只能写本文件，碰任何其他文件视为失败。**

## 背景/方法/格式

同 TASK-01。验证 vendor-mapping.txt 存疑 `(?)` 条目，三选一：✅确认 / ✏️修正 / ❓存疑。

## 19条待验证

| 短名 | 当前映射 | 描述线索 |
|------|----------|----------|
| Rn | rolldown-runtime::__commonJS (?) | CJS 模块封装工厂 |
| Tt | react-dom::(internal/events) (?) | 事件注册内部 _reactListening/listenToAll |
| Un | rolldown-runtime::__toESM (?) | 模块 interop ESM 命名空间 |
| V | rolldown-runtime::__commonJS (?) | CJS 模块封装工厂 |
| Vn | rolldown-runtime::__copyProps (?) | 模块 interop 复制属性 |
| Wn | scheduler::(internal) (?) | React 调度内部 事件优先级/shouldYield |
| Xn | scheduler::(internal) (?) | React 调度内部 事件优先级/shouldYield |
| Xt | app::helper(?) | Ie(图片N) 媒体标签/复制类工具 被局部变量遮蔽 |
| Y | app::getMediaTypeLabel(?) | Le(e) 按 type 返回 图片/视频 等展示名 |
| Yn | lucide-react::Icon(?) | Re size11/15 strokeWidth1.8 图标 |
| Yt | lucide-react::Icon(?) | ze X.jsx(ze) L15937 |
| Z | (?) (?) | Be 仅见局部尺寸变量 未定位真实 API |
| Zn | (?) (?) | Ve 仅见局部尺寸变量 未定位真实 API |
| Zt | lucide-react::Icon(?) | He X.jsx(He) 4 处 |
| _ | (?) (?) | Ue 被局部 useRef 遮蔽 未定位真实 API |
| _n | lucide-react::Icon(?) | We size11/15 strokeWidth1.8 图标 |
| _t | react-flow::Node(?) | Ke X.jsx(Ke) style:Ke 疑似节点组件 |
| a | app::component(?) | qe X.jsx(qe) onClick:()=>qe(id) |
| an | app::optionsArray(?) | Je=[...] 列表 切片 map 渲染 |
