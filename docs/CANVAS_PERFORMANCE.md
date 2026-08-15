# 画布性能优化 — 官方机制探析与原型落地对照

> 面向对象：ReactFlow 画布（节点数量大、含大量图片/视频媒体节点时）。
> 参考源码：`src/bundle/httpClient-BknZwXjG_components/`（官方混淆产物）
> 关键文件：`shared.js`（工具/上下文）、`H_.jsx`（主画布）、`V_.jsx`（性能 CSS）、`_Component131.jsx`（LOD Provider）、`_Component122.jsx`（LOD 计算）、`xi.jsx`/`Zo.jsx`/`bo.jsx`（媒体节点）、`Lg.jsx`（懒加载）、`Mg.jsx`/`Pg.jsx`（边特效）。
> 原型现状：`prototypes/react-nodes/src/`

---

## 一、总览

官方是一套 **「缩放降级 + 缩略图降载 + 渲染裁剪 + 特效降级 + 懒加载 + 服务端缩略图」** 的多层性能体系，核心按「缩得越小 → 隐藏越多 → 渲染越省」这一条主线展开。

| 机制 | 官方触发条件 | 原型现状 |
|---|---|---|
| LOD 4 档缩放降级 | zoom ≤ 0.5 / 0.3 / 0.2 | ✅ 已实现（LodListener/LodProvider/useLod/useMediaDegrade） |
| lod-1/2/3 全局 CSS 降级 | 同上 | ✅ **已落地**（index.css，复刻 V_.jsx） |
| 服务端缩略图降载 | useThumbnail 开启 | ❌ 未接入（原型为本地 blob，无缩略图服务） |
| 图片按屏幕宽度换档 | useThumbnail + zoom | ❌ 未接入 |
| 视频 poster 封面替代 | useThumbnail + 有封面 | ✅ **已落地**（DiscountVideoNode，useVideoPoster + preload=none） |
| onlyRenderVisibleElements | 节点 > 20 | ✅ **已落地**（App.jsx） |
| selectionOnDrag 动态开关 | 节点 ≤ 80 | ✅ **已落地**（App.jsx） |
| 大画布 hit 命中区收窄 | 节点 > 100 | ✅ **已落地**（performance-large-canvas + cust-edge-hit） |
| 边特效按选中/LOD 降级 | 选中或 lod<2 | ✅ 已实现（ConnectionLine lod<2 + CustomEdge 选中化） |
| IntersectionObserver 懒加载 | 进入视口 120px | ✅ **已落地**（LazyImage 组件 → ImageBoxNode / DiscountVideoNode 素材缩略图） |
| React.memo 组件缓存 | 全节点 | ⚠️ 部分（LazyImage 已 memo；未盲目包全节点，见 §九） |
| 视口移动防抖 / rAF 节流 | pan 期间 | ⚠️ LOD class 已 rAF 节流；viewportMoving 未用（官方 CSS 未激活，见 §八） |
| willReadFrequently | 抽帧/读像素 | ⚠️ 部分（videoEngine/gif 已用） |
| 上传即生成缩略图 | 上传图片/视频 | ❌ 无后端缩略图 |

> 本次落地记录（2026-08）：App.jsx ReactFlow 性能 props、index.css LOD+大画布 CSS、base/LazyImage.jsx、
> ImageBoxNode 缩略图懒加载、DiscountVideoNode 视频 poster 降载。均已过 lint，未跑浏览器实测。

---

## 二、LOD（Level of Detail）缩放降级 — 最核心

### 2.1 官方实现
- **上下文** `shared.js:489-512`：`vr`（`{lodLevel, viewportMoving, nodeCount, handleFollowLimit, edgeFxLimit}`）+ `_r`（useThumbnail）+ `gr`（默认值）。读钩子：`xr()`（LOD）、`br()`（useThumbnail）。
- **Provider** `_Component131.jsx:4-25`：把 H_.jsx 传下的 value 通过两个 Context.Provider 下发。
- **档位计算** `shared.js:11525-11572`（`_Component122`，`Z.memo`）：用 `useStore(e => e.transform[2])` 只订阅 zoom，再 `requestAnimationFrame` 节流把 class 挂到 `.react-flow`：

```js
const n = Vt(e => e.transform[2])            // 只订阅 zoom
const o = n <= 0.2 ? 3 : n <= 0.3 ? 2 : +(n <= 0.5)
// level0: zoom>0.5（无降级） / 1: ≤0.5 / 2: ≤0.3 / 3: ≤0.2
```

### 2.2 每档隐藏内容（`V_.jsx:14-26`）
| class | 效果 | 理由 |
|---|---|---|
| `lod-1` | `video { display:none }` | 视频解码代价最高，先藏 |
| `lod-2` | `img { visibility:hidden }` | 再藏图片（保留节点外形 + handle 可连线） |
| `lod-3` | iframe/textarea/input/button 隐藏、`.nodrag` 透明不可点、`.node-content` 隐藏、节点 `opacity:.8` | 全局性能模式 |

> 官方 LOD **不隐藏音频**，音频靠 `_Component12`（handle）和 `xi.jsx` 懒渲染控制。

### 2.3 UI 横幅（`H_.jsx:11966-11971`）
- `lodLevel===2`："低缩放性能模式 (图片已隐藏)"
- `lodLevel===3`："已进入全局性能模式 (图片视频已隐藏)"

### 2.4 原型现状
✅ 已实现完整链路：`LodProvider`（App.jsx:796）→ `LodListener`（把 lod-1/2/3 加到 `.react-flow`，rAF 节流）→ `useLod`/`useMediaDegrade`（各节点隐藏媒体）。`useMediaDegrade` 逻辑：`lod>=2 藏 image，lod>=3 藏 image+video+audio`。横幅已实现（App.jsx:871-878），且 `performanceMode` 关闭时 LodListener 清空 class 并回调 0。

✅ **缺口 1 已补齐**：`index.css` 已加 `lod-1/2/3` 全局 CSS（复刻 `V_.jsx:14-26`），并在注释里说明与节点内 JS 隐藏互为兜底。规则：

```css
.react-flow.lod-1 .react-flow__node video { display: none; }
.react-flow.lod-2 .react-flow__node img { visibility: hidden; }
.react-flow.lod-3 .react-flow__node iframe { display: none; }
.react-flow.lod-3 .react-flow__node textarea,
.react-flow.lod-3 .react-flow__node input,
.react-flow.lod-3 .react-flow__node button { visibility: hidden; }
.react-flow.lod-3 .react-flow__node .nodrag { opacity: 0; pointer-events: none; }
.react-flow.lod-3 .react-flow__node .node-content { display: none; }
.react-flow.lod-3 .react-flow__node { opacity: 0.8; }
```

> 注：选择器前缀 `.react-flow__node` 避免误伤画布级元素；与节点内 `useMediaDegrade` 的 JS 隐藏叠加生效（互为兜底，不冲突）。

---

## 三、缩略图降载（useThumbnail）— 大媒体画布的关键

### 3.1 服务端缩略图尺寸档位（`shared.js:1531-1559`）
- `qr = [200,300,...,1000]` 9 档。
- `Jr(e)`：期望像素向上取整到最近档位；超 1000 返回 null。
- `Yr(e,t,n)`：拼缩略图 URL —— 图片 `${url}_resize_${size}.jpg`；视频 `${url}_frame1_resize_${size}.jpg`。
- 读缩放（`shared.js:1927` `vi(e)`）：`useStore` 读 `transform[2]`，节点宽度 × zoom = 实际屏幕像素 → `Jr` 取档。**缩放时自动换档**。

### 3.2 图片节点降载（`bo.jsx:442-451`）
```js
const { useThumbnail } = br()
const Fe = vi(width ?? 420)                    // 当前屏幕宽度对应档位
const Ie = useThumbnail ? Yr(url, Fe, 'image') || thumbUrl || url : url
```
即：开缩略图 → 优先「按屏幕宽度缩放的服务端图」→ fallback 缓存 `thumbnailUrl` → fallback 原图。

### 3.3 视频 poster 替代（`xi.jsx:313-338`、`Zo.jsx:623-643`）
- 播放中：`<video poster={帧封面}>`。
- **useThumbnail 且有封面**：只渲染静态 `<img>` 封面，**不加载视频本体**，点击才切播放 → 大画布避免解码全部视频。
- 否则 `<video preload="none">`。

### 3.4 上传即生成缩略图（`shared.js:1717-1884`）
- `si()` POST `/api/files/upload`，服务端返回 `{url, thumbnailUrl, path}`。
- `mi()` GET `/api/files/thumbnail?url=&maxDim=&quality=`，带 **Map 级缓存**（`di` 10 分钟有效 + `fi` 在途去重）。
- `hi()` 统一入口：`preferThumbnail && url 含 /files/` → `mi`；本地 blob → `si`（带 `generateThumb/thumbMaxDim/thumbQuality`）。
- 视频首帧封面：`ensureVideoPoster`/`_i()`（`shared.js:1896-1926`）用 `captureVideoFrameBlob` 抓首帧上传生成 `_frame1.jpg`。

### 3.5 原型现状
❌ 未接入。原型媒体均为本地 `blob:`/`data:` URL，无 `/files/` 缩略图服务；`useMediaDegrade` 注释里也写明"接真系统后再把隐藏改缩略图"。

**落地建议**：原型无后端，可先做「前端缩略图降载」：
1. 图片节点：`useLod()` 的 zoom + 节点宽度，缩小时用**内存中已降采样的 canvas 缩略图**（或初次加载时生成一张低清 dataURL 缓存），替换原 `<img src>`。
2. 视频节点：缩小时仅渲染 `<video poster>`（`captureFrame` 首帧），不加载本体。
3. 若接入 localTool 缩略图服务，再对齐官方 `Yr/Jr/vi` 的档位逻辑。

---

## 四、ReactFlow 画布级配置（`H_.jsx:11958-11964`）

```jsx
<ReactFlow
  fitView fitViewOptions={{ padding:0.2, maxZoom:1, minZoom:0.05 }}
  minZoom={0.05} maxZoom={4}
  elevateNodesOnSelect={false}          // 关选中抬升，减少 z-index 重排
  elevateEdgesOnSelect={false}
  nodeOrigin={[0,0]}                     // 减少节点定位计算
  proOptions={{ hideAttribution:true }}
  onlyRenderVisibleElements={nodeCount > 20}   // 关键：节点>20 只渲染可视元素
  selectionOnDrag={nodeCount <= 80}      // 节点<=80 才允许框选
  panOnDrag
/>
```

- **onlyRenderVisibleElements**：>20 节点时跳过视口外节点 DOM 渲染，收益最大。
- **elevateNodes/EdgesOnSelect=false**：关掉选中抬升层级。
- **nodeOrigin=[0,0]**：简化节点锚点计算。
- **selectionOnDrag** 按节点数动态开。

### 原型现状（App.jsx:820-847）
✅ **已全部补齐**（`App.jsx` ReactFlow props）：

```jsx
elevateNodesOnSelect={false}
elevateEdgesOnSelect={false}
nodeOrigin={[0, 0]}
onlyRenderVisibleElements={nodes.length > 20}
selectionOnDrag={nodes.length <= 80}
panOnDrag
className={nodes.length > 100 ? 'performance-large-canvas' : undefined}
```

> 注：`nodes.length` 直接用 App 层的 useNodesState 数组；大画布 class 对应 index.css 的 `performance-large-canvas .cust-edge-hit` hit 区收窄。

---

## 五、useStore 选择器优化

官方广泛用 `Vt(e => e.transform[2])`（`useStore`）只订阅 zoom，配合 LOD 上下文，节点只在自己关心的状态变化时重渲染。
- `shared.js:11529-11531`、`1927`、`c_.jsx:21-23`、`B_.jsx:5-7`。

### 原型现状
✅ `LodListener`（`useStore(s => s.transform?.[2])`）已采用。其余节点若需响应缩放，应同样用 `useStore` 选择器而非订阅整棵 store。

---

## 六、边/连线特效降级

- 边（`Mg.jsx:18-41`）：**只有选中或关联选中**才渲染 glow + comet；普通边只有细线。
- 连线预览（`Pg.jsx:41`）：`f = lodLevel < 2` 才渲染 comet/glow。

### 原型现状
✅ `ConnectionLine.jsx` 已实现 `enableFx = lodLevel < 2`（关闭辉光 + 粒子）；`CustomEdge.jsx` 已实现「选中或关联选中才渲染 glow/comet」，普通边只有细线，与官方 `Mg.jsx` 一致，无需改动。

---

## 七、懒加载图片（IntersectionObserver）

`Lg.jsx:4-37`：`Z.memo` + `new IntersectionObserver({rootMargin:'120px'})`，进入视口附近才真正挂 `<img src>`。用于分镜/多图节点缩略图（`Rg.jsx:689`）。

### 原型现状
✅ **已实现 `base/LazyImage.jsx`**（复刻 `Lg.jsx`：memo + IntersectionObserver rootMargin 120px + loading=lazy）。已应用到：
- `ImageBoxNode`（图片盒子）多图缩略图网格
- `DiscountVideoNode`（素材参考图缩略图）

> 说明：图片节点/视频节点多为单图（1 节点 1 图），懒加载收益集中在多图容器；故未对单图节点强制替换（其已有 loading="lazy"）。

---

## 八、视口移动防抖 / rAF 节流

- `onMoveStart` 设 `viewportMoving=true`；`onMoveEnd` 用 `setTimeout 120ms` 延迟复位（`H_.jsx:196-211`）。移动期间跳过重活（如自动布局 `H_.jsx:1073-1080` 延迟到停止后）。
- 鼠标坐标、LOD class 切换均用 `requestAnimationFrame` 节流。
- `V_.jsx:28-53`：`.viewport-moving.pan-performance-mode.is-large-canvas` 下 edges/connectionline `opacity:0`、边动画/阴影/滤镜全关、背景隐藏。

### 原型现状
✅ LOD class 已用 rAF 节流。
⚠️ `viewportMoving` **未引入**（保持官方状态：官方虽有 `onMoveStart/onMoveEnd` 设值，但其 CSS `.viewport-moving.pan-performance-mode.is-large-canvas` 官方代码从未添加这些 class，属「预留死样式」；原型无自动布局等依赖 viewportMoving 的重活，故不引入）。原型 `index.css` 注释已说明该取舍。

---

## 九、React.memo 组件缓存

官方对**所有节点、边、Handle、缩略图组件**均 `Z.memo`（47+ 文件），避免未变节点重渲染。

### 原型现状
⚠️ **刻意未盲目给所有节点包 memo**。原因：
- ReactFlow 节点自带 `NodeWrapper` 缓存，节点仅在 `data/selected` 变化时重渲染，外部包 memo 收益边际；
- 盲目改动违反「改公共组件默认行为不变」的教训（§9.5）；
- 真正高频的纯展示组件（缩略图）已通过 `LazyImage`（memo）覆盖。
若后续遇到具体节点重渲染卡顿，再逐节点针对性 `memo`，不预先批量改。

---

## 十、willReadFrequently / GL 参数

- 读像素的 canvas context 用 `willReadFrequently:true`（`ic.jsx:44`、`ec.jsx:138/238/290`、`Pl.jsx:23`、`kl.jsx:21`）。
- 全景/3D 节点 GL：`preserveDrawingBuffer:true, antialias, powerPreference:'high-performance'`（`Zl.jsx:291-294`）。

### 原型现状
⚠️ `videoEngine.js`（gif 生成）和 `VideoExtractNode` 已用 `willReadFrequently`；其余读像素点建议统一补。

---

## 十一、落地优先级（原型）与进度

按「收益 / 成本」排序。✅ 表示已落地：

1. ✅ **【P0】补 ReactFlow 画布性能 props**（App.jsx）：`onlyRenderVisibleElements`、`selectionOnDrag`、`elevateNodesOnSelect/EdgesOnSelect`、`nodeOrigin`、大画布 class。
2. ✅ **【P0】补 `lod-1/2/3` 全局 CSS**（index.css）：藏 video/img/控件，与节点内 `useMediaDegrade` 协同。
3. ✅ **【P1】懒加载组件 `LazyImage`**（base/LazyImage.jsx）→ ImageBoxNode / DiscountVideoNode 缩略图。
4. ✅ **【P1】边特效选中化**：CustomEdge 已实现，无需改动。
5. ⚠️ **【P1】React.memo**：仅 LazyImage 已 memo；节点刻意不批量包（理由见 §九）。
6. ⚠️ **【P2】前端缩略图降载**：未做。原型无缩略图服务，本地降采样复杂度高、收益有限；仅当遇到大图解码卡顿再投入。
7. ⚠️ **【P2】视口移动防抖**：未做。官方该 CSS 是死样式（未激活），原型无依赖它的重活，收益低，不推荐投入。

> 下一步建议：先浏览器实测已落地项是否生效、交互是否受影响，再决定是否碰 P2 剩余两项。

---

## 附：官方性能代码位置速查

| 机制 | 文件:行 |
|---|---|
| LOD 上下文/钩子 | shared.js:489-512 |
| LOD 档位计算 | shared.js:11525-11572 |
| LOD CSS | V_.jsx:14-26 |
| 缩略图档位/URL | shared.js:1531-1559 |
| 屏幕宽度→档位 | shared.js:1927-1932 |
| 上传生成缩略图 | shared.js:1717-1884 |
| 视频首帧封面 | shared.js:1896-1926 |
| ReactFlow 配置 | H_.jsx:11958-11964 |
| 大画布 class | H_.jsx:11614, V_.jsx:58 |
| pan 性能 CSS | V_.jsx:28-53 |
| 懒加载图 | Lg.jsx:4-37 |
| 边特效选中化 | Mg.jsx:18-41 |
| 连线特效 LOD | Pg.jsx:41 |
| 视口移动防抖 | H_.jsx:196-211 |
