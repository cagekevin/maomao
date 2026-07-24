# TASK-03：验证 vendor-mapping.txt 存疑条目（19条）

> 🚫 **只能写本文件，碰任何其他文件视为失败。**

## 背景/方法/格式

同 TASK-01。验证 vendor-mapping.txt 存疑 `(?)` 条目，三选一：✅确认 / ✏️修正 / ❓存疑。

## 19条待验证（已填验证结果）

> 验证依据：`src/vendor/vendor.js` 的 export 块（L4682）定位各短名对应的内部变量，
> 再查该变量定义。`U(\`name\`)` 为 lucide-react 图标工厂（见 vendor-mapping.txt 中 `gt=U(\`volume-2\`)` 等），
> L8 的 `ql=!1,Xl=0,Wl=0,tu=0,Ul=null` 等为 React 内部常量块。

| 短名 | 当前映射 | 验证结果 | 正确映射（如需修正） | 理由 |
|------|----------|----------|---------------------|------|
| ar | app::component(?) | ✏️修正 | react::internal | 内部变量 Xl=0，位于 L8 React 内部常量块（`...Xl=0,Zl=0...`），非组件 |
| bn | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | Fu=U(`list-plus`)，lucide 图标工厂创建（L49） |
| br | lucide-react::Loader(?) | ✏️修正 | lucide-react::Icon | Fl=U(`camera`)，应为 camera 图标而非 Loader（L49） |
| bt | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | Fd=U(`user-plus`)（L49） |
| c | app::component(?) | ✅确认 | app::component | tK=({alignment,margin,renderPriority,onUpdate,onTarget,children})=>{…}，函数组件（L4618） |
| cn | app::component(?) | ✏️修正 | lucide-react::Icon | qu=U(`move-horizontal`)，实为 lucide 图标而非 app 组件（L49） |
| cr | (?)? | ✏️修正 | react::internal | ql=!1，React 内部常量（布尔 false），位于 L8 常量块 |
| ct | lucide-react::Crop(?) | ✏️修正 | lucide-react::Icon | qd=U(`zoom-in`)，应为 zoom-in 图标而非 Crop（L49） |
| dn | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | Wu=U(`minus`)（L49） |
| dr | lucide-react::Icon(?) | ✏️修正 | react::internal | Wl=0，React 内部常量（数值 0），位于 L8 常量块 |
| dt | app::component(?) | ✏️修正 | lucide-react::Icon | Wd=U(`wrench`)，实为 lucide 图标而非 app 组件（L49） |
| en | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | td=U(`play`)（L49） |
| er | lucide-react::Icon(?) | ✏️修正 | react::internal | tu=0，React 内部常量（数值 0），位于 L8 常量块 |
| f | drawing::Line(?) | ✏️修正 | three::Line2 | MG=H.forwardRef(function({points,color,lineWidth,vertexColors,dashed,...})) 为 three 的 3D 粗线 Line2 组件，非 2D 绘图线条（L4618） |
| fn | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | Uu=U(`minimize-2`)（L49） |
| fr | lucide-react::Icon(?) | ✏️修正 | react::internal | Ul=null，React 内部常量（值 null），位于 L8 常量块 |
| ft | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | Ud=U(`workflow`)（L49） |
| g | React::(memo/forwardRef)(?) | ✏️修正 | react::createPortal(HOC) | qU=function(e,t,n){return (0,W.jsx)(JU,{children:e,container:t,state:n})}，W 为 createPortal，是 portal 包装 HOC 而非 memo/forwardRef（L4173） |
| gn | lucide-react::Icon(?) | ✅确认 | lucide-react::Icon | zu=U(`map`)（L49） |

### 汇总
- ✅确认（9）：bn, bt, c, dn, en, fn, ft, gn（+ 普通组件/图标判定正确）
- ✏️修正（10）：ar→react::internal；br→camera 图标；cn→move-horizontal 图标；cr→react::internal；ct→zoom-in 图标；dr→react::internal；dt→wrench 图标；er→react::internal；f→three::Line2；fr→react::internal；g→createPortal HOC
- ❓存疑（0）
