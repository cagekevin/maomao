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

## 验证结果

> 方法：TASK 中的 19 个短名即 `vendor-mapping.txt` 的 vendor.js **导出名**。
> `src/App.js` 已反混淆，其 import 语句 `import { <短名> as <别名> } from "./vendor/vendor.js"` 把每个导出名映射到一个局部别名；
> 以该别名在 App.js 中的**真实用法**为准（被 JSX 渲染=`组件/图标`，被函数调用=`helper`）。读取 vendor.js / App.js 仅作验证，未改动任何其他文件。

| 短名 | 当前映射 | 验证结果 | 正确映射（如需修正） | 理由 |
|------|----------|----------|---------------------|------|
| Rn | rolldown-runtime::__commonJS (?) | ✏️修正 | lucide-react::Icon | `Rn as _e`，`X.jsx(_e,{size:11})` 规则网格按钮图标，非 CJS 封装工厂 |
| Tt | react-dom::(internal/events) (?) | ✏️修正 | lucide-react::Icon | `Tt as q`，`X.jsx(q,{size:14})` title=删除，删除图标，非事件注册内部 |
| Un | rolldown-runtime::__toESM (?) | ✏️修正 | lucide-react::Icon | `Un as Ee`，`X.jsx(Ee,{size:14})` 下载按钮图标，非 ESM 命名空间 |
| V | rolldown-runtime::__commonJS (?) | ✏️修正 | app::helper | `V as Oe`，`function Oe(e){}` 且 `Oe('translate'/'rotate'/'scale')` 变换模式 handler，非 CJS 工厂 |
| Vn | rolldown-runtime::__copyProps (?) | ✏️修正 | lucide-react::Icon | `Vn as ke`，`X.jsx(ke,{size:11,className:'text-gray-500'})` 图标，非 interop 复制属性 |
| Wn | scheduler::(internal) (?) | ✏️修正 | lucide-react::Icon | `Wn as Me`，`X.jsx(Me,{size:16})` 刷新/连接图标，非调度内部 |
| Xn | scheduler::(internal) (?) | ✏️修正 | lucide-react::Icon | `Xn as Fe`，`X.jsx(Fe,{size:18})` "分享应用" 图标，非调度内部 |
| Xt | app::helper(?) | ✅确认 | | `Xt as Ie`，`Ie('图片'+n)`/`Ie(Le(e),true)` 媒体标签/复制类 helper，匹配 |
| Y | app::getMediaTypeLabel(?) | ✅确认 | | `Y as Le`，`Le(e)` 按 type 返回 '图片'/'视频' 展示名，匹配 |
| Yn | lucide-react::Icon(?) | ✅确认 | | `Yn as Re`，`X.jsx(Re,{size:...})` 图标，匹配 |
| Yt | lucide-react::Icon(?) | ✅确认 | | `Yt as ze`，`X.jsx(ze,...)` 图标，匹配 |
| Z | (?)? | ✏️修正 | app::helper | `Z as Be`，`function Be(e){H({kind:'prop',assetSource:'library',...})}` 添加 prop 资源 handler，已可定位（原误判为局部尺寸变量） |
| Zn | (?)? | ❓存疑 | | `Zn as Ve`，所有 `Ve` 引用均为局部变量（useState / `Math.round(380/Math.sqrt(Re))` 尺寸计算 / `Ve && X.jsx`），真实导出 API 未定位 |
| Zt | lucide-react::Icon(?) | ✅确认 | | `Zt as He`，`X.jsx(He,{...})` 图标（4 处），匹配 |
| _ | (?)? | ❓存疑 | | `_ as Ue`，部分作用域作函数 `Ue(se,e)`/`Ue(qe,e)` 构建对象，但大量局部 `Ue`（useRef/useState）遮蔽，库归属无法确定（疑似 three/app 对象工厂） |
| _n | lucide-react::Icon(?) | ✅确认 | | `_n as We`，`X.jsx(We,{size:...})` 图片类按钮图标，匹配 |
| _t | react-flow::Node(?) | ✏️修正 | lucide-react::Icon | `_t as Ke`，`X.jsx(Ke,{size:13})` "生成视频" 图标（size 属性），非节点组件 |
| a | app::component(?) | ✏️修正 | app::helper | `a as qe`，`function qe(e){we(e),A(false)}`、`onClick:()=>qe(e.id)` 为选择 handler（函数），非组件 |
| an | app::optionsArray(?) | ✏️修正 | lucide-react::Icon | `an as Je`，`X.jsx(Je,{size:14})` title=发送到画布，发送图标，非选项数组 |

### 汇总
- ✅确认 6 条：Xt、Y、Yn、Yt、Zt、_n
- ✏️修正 11 条：Rn、Tt、Un、V、Vn、Wn、Xn、Z、_t、a、an
- ❓存疑 2 条：Zn、_

> 关键发现：原 (?) 中把 Rn/V/Un/Vn/Wn/Xn 标为 rolldown-runtime / scheduler 内部项的判断基本都不成立——
> 反混淆后的用法显示它们多为 lucide 图标或 app helper；其中只有 `V`(=Oe) 是 app 函数而非图标。
> 原 `app::*` 两项中 `a` 实为 helper（非 component）、`an` 实为图标（非 optionsArray）。
