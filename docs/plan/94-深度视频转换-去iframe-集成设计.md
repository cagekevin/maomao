# 94 · 深度视频转换：去除 iframe，集成进主项目（设计稿 · 架构师定稿版）

> 状态：**设计稿，施工前需确认**。确认前不写任何代码。
> 日期：2026-09-03（架构师审阅优化：修正与现状不符点、补齐细节、消解矛盾）
> 集成源：`C:\Users\xinye\Downloads\depth-video-converter`（独立工具，自带 transformers.js + onnxruntime + 三个深度模型）
> 范围口径（已与用户对齐）：**这是小改动**——在**能承载视频的节点的 hover 工具栏**（**`DiscountVideoNode`** 与 **`ImageNode` 的视频态**）加「转深度视频」图标入口，点开同一个无 iframe 的 `DepthVideoModal`（源 = 该节点当前视频 URL），跑完回调生成下游深度视频节点。**不是新建独立子系统**。

---

## 1. 结论与架构定夺（架构师拍板）

### 1.1 方向结论（不变）
- **深度估计跑在浏览器端**（transformers.js + onnxruntime-web，WebGPU / WASM）。前端只管「UI + 参数 + 逐帧推理 + 录像 + 上传」，**不做服务端转码**。
- 把新源 `depth-video` 独立静态页的 UI + 转换逻辑 **port 成一个与宿主解耦的 `DepthVideoModal`**（props 仅 `videoUrl/name/onClose/onSave`），由 **`DiscountVideoNode` 与 `ImageNode`(视频态) 的 hover 工具栏**共同弹出，**去掉 `<iframe>` 与 `postMessage>`**。
- **大模型 / onnx / wasm 资源不进主项目 `dist`**：`vendor/`、`models/` 由 localTool 以静态资源目录提供，浏览器同源按 URL 加载。
- 独立静态页本身**不保留为第二入口**（见 §1.4 决策，与旧稿不同）。

### 1.2 现状核查结论（旧稿这几条与实际代码不符，必须修正）
逐行核对仓库后，旧稿以下陈述**不成立**，本次据此纠正：

| # | 旧稿说法 | 实际现状（已核实） | 修正 |
|---|---------|-------------------|------|
| A | `VideoProcessNode`「现有『转深度』按钮 + `depthOpen` 已就绪」 | 全仓无 `depth`/`转深度`/`深度` 代码，也没有 `depthOpen`。**正确载体是能承载视频的节点**，非 `VideoProcessNode`（它是 trim/extractAudio/… 的时间线处理面板，不用 hover 栏）。实际承载视频的是：**`DiscountVideoNode`**（生成，持 `videoUrl`）与 **`ImageNode`**（image/video/audio/text 多态，`type==='video'` 时持 `url`），两者都用 `HoverToolbar` | **转深度是全新入口**，落在两个节点的 hover `toolbarButtons`：`DiscountVideoNode`（`videoUrl` 非空出现）、`ImageNode`（`type==='video'` 时 show）。Modal 复用一份 |
| B | `localTool/src/index.ts`「不动，静态托管 `/depth-video/` 与 `/api/*` 已具备」 | `localTool/src/index.ts` 静态服务**只有两处**：`/files/*` → `uploads/`（`handleStaticFile`），兜底前端页 → `dist/`（`handleFrontendPage`，目录取 `../dist`）。**没有 `/depth-video/`、`/models/`、`/vendor/` 任何资源托管** | **必须在 localTool 新增一个深度资源静态目录映射**，否则浏览器拿不到模型（见 §4.3 最小改动点） |
| C | `vite.config.ts` 加 `server.proxy['/depth-video'] → 18080`，dev 走同源 | `vite.config.ts` **无任何 proxy**，且 `base:'./'`（相对路径，为兼容 Chrome 插件 side panel 经 `chrome-extension://` 加载） | **不加 Vite proxy**。dev 与生产一律让组件用**绝对同源 URL 指向 18080**（`http://127.0.0.1:18080/depth-video/...`）；`base:'./'` 不受影响。需从 `config.ts` 取 `API_BASE` 作为前缀（见 §5.2） |
| D | 资源路径「一律同源相对根 `/depth-video/...`（不用 API_BASE）」 | 主项目是**独立源**（Vite 5180 dev / dist 产物经 localTool 18080 托管生产），非官方那种同源嵌入。页面并不总部署在 18080 的站点根 | 资源前缀必须用 `API_BASE`（默认 `http://127.0.0.1:18080`），拼成 `${API_BASE}/depth-video/...` 绝对 URL；`models`/`onnxruntime` 的 import 与 wasmPaths 均以此前缀（见 §5.2） |

### 1.3 关键矛盾消解（旧稿 §5「localTool 不动」 vs 资源留 localTool）
旧稿第 3 节要求"vendor / models 留 localTool、浏览器加载"，第 5 节却写「localTool 不动、已具备静态托管」——两者**自相矛盾**。既然 vendor+models 在磁盘上、又要被浏览器按 URL 读、又不可进 dist，localTool 必然要提供一个**静态目录映射**。该改动极小：新增一个目录解析函数 + 一段静态分支（约 20 行），不触碰 `/api/*` 路由与 catch-all。这就是本方案全部的后端改动。

### 1.4 范围收敛（贴合「只是加个入口」）
- **不保留**独立静态页第二入口（`http://127.0.0.1:18080/depth-video/` 仍可访问，但**不导航**它、不再给它做任何升级维护；它只是资源被浏览器读到的宿主目录）。
- **不在 localTool 写转换后端**、不引任何新的 Node 运行时依赖（localTool 除 sql.js 外零运行时依赖的铁律不变）。
- **样式用主项目 Tailwind**，不沿用新源 `styles.css`（新源 UI 仅作「控件清单」参考，见 §6.1）。

---

## 2. 目标

1. 删除 `<iframe>` 与 `postMessage` 通信，在 `DepthVideoModal` 内直接渲染转换面板。
2. 在 **`DiscountVideoNode`（`videoUrl` 非空）与 `ImageNode`（`type==='video'`）的 hover 工具栏**加「转深度视频」图标，点开同一个无 iframe 的 `DepthVideoModal`（源 = 该节点当前视频 URL）。**ImageNode 必须支持**：深度结果正是 `imageNode(mediaType:'video')`，若不支持则每次结果都是无法再次转深度的"死胡同"，无法链式处理。
3. onnx / wasm / 模型继续由 localTool **静态目录**提供，**不进主项目 `dist`**。
4. 转换产出的深度视频 blob 经主项目现有上传链路落盘到 `canvas/video-process`，回调生成下游**深度视频节点**。
5. 行为不变：hover 任一视频节点 → 点图标 → 配置参数 → 转换 → 上传 → 画布生成可再次转深度的下游深度视频节点。

---

## 3. 集成源结构（已核查，逐文件）

```
C:\Users\xinye\Downloads\depth-video-converter\
├─ index.html              独立页外壳 + importmap —— 不集成（importmap 是独立页专属）
├─ app.js                  ★ 转换主逻辑（port 进 React 组件的唯一依据，见 §6）
├─ styles.css              该页样式 —— 不集成（改用项目 Tailwind）
├─ server.js               独立 dev 服务器(端口8765) —— 不集成
├─ start-local.bat/.ps1    启动脚本 —— 不集成
├─ vendor/
│  ├─ transformers/
│  │  ├─ transformers.web.min.js   ★ 浏览器端入口（ESM）
│  │  ├─ transformers.min.js       通用版（独立页用不了，跳过）
│  │  └─ LICENSE
│  └─ onnxruntime/
│     ├─ ort.webgpu.bundle.min.mjs          WebGPU 后端 bundle
│     ├─ ort-wasm-simd-threaded.asyncify.mjs  ← app.js 实际 wasmPaths.mjs 指向它
│     ├─ ort-wasm-simd-threaded.asyncify.wasm ← app.js 实际 wasmPaths.wasm 指向它
│     ├─ ort-wasm-simd-threaded.jsep.{mjs,wasm}  ← 未被 app.js 引用，属后备，可一并拷入
│     └─ README.md
└─ models/                                ★ 全部 ONNX 权重 + 各模型 config.json
   ├─ onnx-community/depth-anything-v2-small/   （默认模型）
   ├─ Xenova/depth-anything-small-hf/
   └─ Xenova/dpt-hybrid-midas/
```

**只把以下子目录原样拷入 localTool 静态目录**（体积大头在 `models/`，几十 MB，绝不进主项目 dist）：

| 待拷内容 | 目的 |
|---------|------|
| `vendor/` | transformers.js 运行时 + onnxruntime wasm/webgpu |
| `models/` | 三个深度模型权重 + config.json（`env.localModelPath` 指向） |

> `server.js`、`start-local.*`、`styles.css`、`index.html` 均**不拷**；`app.js` 只在本地作「port 逻辑的源」，不作为独立页运行。

**与旧版独立工具的关键差异（新源更完善，port 时照搬）**：
- 直接 `import` transformers.js 的 `pipeline`/`env`/`RawImage`，不再从 onnxruntime 包顺带导出。
- **GPU 回退链**：`webgpu/q4f16 → webgpu/q8 → wasm/q8`，逐档失败降级。
- **逐帧精确采集**：`captureStream(0)` + `track.requestFrame()` + 每帧 `recorder.resume()/pause()`，比 rAF 轮询准。
- 参数全：`smooth`(0..0.85 真实帧间混合)、`contrast`(0.7..1.8)、`invert`、`outputFormat: auto/mp4/webm`、`start/end`、`fps`、`maxWidth`。

---

## 4. 目标架构（集成后）

```
两个宿主节点共用同一份 DepthVideoModal（组件与宿主解耦，只认 videoUrl）：

DiscountVideoNode（生成节点）                 ImageNode（多态节点）
  data.videoUrl（生成/上传）                   type==='video'（detectMediaType 判定）
  hover toolbarButtons 追加图标                 hover toolbarButtons 追加图标(show: type==='video')
  videoUrl 非空才出现 → setDepthOpen(true)     有视频才出现 → setDepthOpen(true)
       └─────────────┬──────────────┘
            ┌────────▼────────┐
            └─ <DepthVideoModal videoUrl name onClose onSave>   ← 无 iframe
                 ├─ 运行时 import(`${API_BASE}/depth-video/vendor/transformers/transformers.web.min.js`)  (@vite-ignore)
                 ├─ env.localModelPath = `${API_BASE}/depth-video/models/` 等（资源前缀，§6.2）
                 ├─ 逐帧 depth-estimation（GPU 回退链）→ depth canvas
                 ├─ captureStream + MediaRecorder → webm/mp4 blob
                 ├─ uploadResult(blob, { subfolder: UPLOAD_DIRS.videoProcess })
                 └─ onSave(url, name) → 用 buildSpawnNodes/spawnAndCommit（deriveNodes.ts）
                                         生成下游 imageNode(mediaType:'video') 深度视频节点
```

> 注：两宿主现都**无**下游生成能力。转深度完成后要 spawn 下游深度视频节点，从
> `src/components/base/deriveNodes.ts` 引 `buildSpawnNodes + spawnAndCommit`（VideoProcessNode 的
> `spawnVideoNode` 即基于此），以当前节点右缘为基点生成，type=`imageNode`、
> `data:{ imageUrl:url, mediaType:'video', label:name }`。复用该 id/位置/命名约定，避免新写一套 spawn。
> **链式**：生成的下游本身是 `imageNode(mediaType:'video')`，其 hover 同样有「转深度」→ 可继续转深度。

```
localTool (18080, localTool/src/index.ts)
  ├─ [现有] /files/*    → uploads/                  （不动）
  ├─ [现有] 兜底前端页   → dist/                     （不动）
  └─ [新增] /depth-video/* → depth-video/ 静态目录    （vendor + models 宿主，纯 GET）
```

---

## 5. 改动清单（按文件，完整）

| 文件 | 动作 | 说明 |
|------|------|------|
| `localTool/runtime-models/depth-video/` | **新增资源目录** | **物理目录收进 `localTool/runtime-models/` 子目录**（不与 `src/`/`data/`/`logs/` 混放，且前瞻可加 rembg 等工具子目录）。把新源 `vendor/`、`models/` 拷到 `localTool/runtime-models/depth-video/`（§3）。 |
| `localTool/src/paths.ts` | **+1 函数** | 新增 `getDepthVideoDir()`：返回 `localTool/runtime-models/depth-video/`（`path.join(getRoot(),'runtime-models','depth-video')`，支持 `MAOMAO_ROOT` 覆盖，与既有路径函数同构）。 |
| `localTool/src/index.ts` | **+1 段静态分支** | 在 `handleRequest` 静态服务处新增：`method==='GET' && pathname.startsWith('/depth-video/')` → **URL 前缀 `/depth-video/`（保持简短）映射到物理根 `getDepthVideoDir()`**、按需 decode、**路径遍历校验**（同 `handleStaticFile` 逻辑）、按扩展名给 `Content-Type`、读文件返回。放在 `/files/` 分支之后、`/api/` 判定之前。**不注册 router 具名路由、不进 catch-all**。 |
| `src/components/base/depthVideo/path.ts`(可选) | **新增常量** | 收敛资源 URL 前缀与文件清单（单一来源），避免组件里散写字符串。 |
| `src/components/base/DepthVideoModal.tsx` | **新增（旧稿说『重写』，实为不存在→全新）** | 无 iframe 转换面板。props：`videoUrl / name / onClose / onSave(url,name)`。内部 port 新源 `app.js` 逻辑（§6）。 |
| `src/components/nodes/DiscountVideoNode.tsx` | **小改** | ① import `DepthVideoModal`、`deriveNodes` 的 `buildSpawnNodes/spawnAndCommit`、`showToast`、深度语义图标（如 lucide `Layers`/`Scan`）；② 加 `const [depthOpen,setDepthOpen]=useState(false)`；③ 在 `toolbarButtons` 的 `...(videoUrl ? [ fullscreen, download, jianying, delete ] : [])` 数组内**追加一项** `{ key:'depth', icon:<Layers size={14}/>, title:'转深度视频', onClick:()=>setDepthOpen(true) }`（**仅 videoUrl 非空出现**）；④ 渲染 `<DepthVideoModal videoUrl={videoUrl} name={...} onClose={()=>setDepthOpen(false)} onSave={深度处理回调}/>`。 |
| `src/components/nodes/ImageNode.tsx` | **小改** | `ImageNode` 多态承载 image/video/audio/text，`type === data.mediaType || detectMediaType(url)`。① import `DepthVideoModal` + 深度图标；② 加 `depthOpen` state；③ `toolbarButtons` 里（同批现有 `cameraStudio` 用 `show` 条件写法）追加 `{ key:'depth', icon:<Layers size={14}/>, title:'转深度视频', show: type==='video' && !!url, onClick:()=>setDepthOpen(true) }`（**仅视频态且非空 URL** 出现，图片/音频/文本态不显示）；④ 渲染 `<DepthVideoModal videoUrl={url} name={data.label 或文件名} onClose onSave={深度处理回调}/>`。source 视频 URL = 节点当前 `url`（`toAbsoluteFileUrl` 后）。 |
| `vite.config.ts` | **不动** | 不加 proxy；`base:'./'` 保持（CORS 靠组件直连 18080 绝对 URL，见 §5.2）。 |
| 上传链路 | **复用** | 不做新上传代码；`DepthVideoModal` 收尾直接 `uploadResult(blob,{subfolder:UPLOAD_DIRS.videoProcess})`，与节点现有处理一致（`canvas/video-process`）。 |

> `UPLOAD_DIRS.videoProcess = 'canvas/video-process'`（已存在于 `src/components/base/uploadDirs.ts`），深度视频落盘用它即可，无需新增目录常量。

> **入口细节（已敲定）**：
> - 位置：两个宿主的 `HoverToolbar buttons={toolbarButtons}` 各追加一个「转深度视频」图标，但**都只在有视频 URL 时出现**：
>   · `DiscountVideoNode`：追加到 `...(videoUrl ? [...] : [])` 条件数组内 → **`videoUrl` 非空才显示**；
>   · `ImageNode`：用 `show:` 条件（对齐现有 `cameraStudio` 的 `show:type==='image'` 写法）→ `show: type==='video' && !!url`，**图片/音频/文本/空态不显示**。
> - 图标：lucide 一个深度语义图标（`Layers` / `Scan` / `Gauge` 择一），`size={14}`，`title:'转深度视频'`；可给 `hoverClass`（如 `hover:text-sky-400`）区分于上传/删除。
> - 触发态：`DiscountVideoNode` hover 栏整条在节点 `loading`（生图中）被 `{!loading && ...}` 隐藏，无需额外禁用；`ImageNode` 无 `loading`。`depthOpen` 弹窗与宿主生成互不阻塞（弹窗生命周期自持）。
> - 弹窗源：直接用宿主节点当前视频 URL（`DiscountVideoNode.videoUrl` / `ImageNode.url`），**不重复读文件**；弹窗内 seek/抽帧只在弹窗 DOM 内进行，不污染节点。
> - 关弹窗：`onClose` 置 `depthOpen=false`；`onSave` 完成后同样置 false + toast + spawn 下游。
> - **代码不复制**：Modal 是同一份组件，两宿主仅各自声明「图标 + `depthOpen` + 渲染」，onSave 的 spawn 逻辑可提到一个小工具函数（如 `spawnDepthVideoNode(sourceId,url,name)`）供两处复用，避免两份 spawn 拷贝漂移。

### 5.1 模型与资源存放（定案）

**物理目录**：为不让 localTool 根目录变乱（它已有 `src/`/`routes/`/`data/`/`logs/`/`dist/`），**把资源收进 `localTool/runtime-models/` 子目录**（与 `data/`/`logs/` 这类运行时目录并列），当前工具再下一层 `depth-video/`。从 Downloads 的 `depth-video-converter/` 原样拷贝 `vendor/` 与 `models/`：

```
localTool/runtime-models/                        ← 本机推理资源命名空间（前瞻可加 rembg/ 等工具子目录）
  depth-video/                                 ← 当前工具：深度转视频
    vendor/transformers/transformers.web.min.js   ← 推理运行时入口（数 MB，可入库）
    vendor/onnxruntime/*.{mjs,wasm}
    models/onnx-community/depth-anything-v2-small/
    models/Xenova/depth-anything-small-hf/
    models/Xenova/dpt-hybrid-midas/               ← 权重（几十 MB，必须 .gitignore）
```

> **物理路径 ≠ URL 路径**：磁盘在 `runtime-models/depth-video/`，但**浏览器 URL 仍是简短的 `/depth-video/...`**（`${API_BASE}/depth-video/...`）。映射由 `index.ts` 静态分支完成：URL 前缀 `/depth-video/` → 物理根 `getDepthVideoDir()`。这样 localTool 目录干净，前端 URL 也不脏。

**为什么放 localTool（而非 dist / public/）**：不能进主项目 `dist`（几十 MB 污染构建产物）；`public/` 会被 Vite 打包进 dist，同样排除。localTool 已在服务两类静态根（`dist/`、`uploads/`），加这个资源根（`paths.ts` 一个 `getDepthVideoDir()` + `index.ts` 一段静态分支）与现有 `getFrontendDistDir()`/`getUploadDir()` 同构，是**最小且与现状一致的落点**。

**入库策略**：`localTool/runtime-models/depth-video/models/` 加 `.gitignore`（几十 MB，不入库/CI）；`vendor/` 数 MB 可入库（可复现推理环境）。文件本地手动铺，与 Downloads 保持一致；服务启动需保证目录存在。

**前端引用**：一律 `${API_BASE}/depth-video/...`，仅在一个常量模块声明（§6.2，p1 收口），组件不散写字符串。

### 5.2 UI 对齐现有（定案）

**不搬新源 `styles.css`**，用主项目 Tailwind + 已收敛控件/颜色 token（`bg-surface-1` / `text-caption` / `border-edge-raised` 等），与 `DiscountVideoNode`/`ImageNode`/`ImageZoomDialog` 观感一致。

- **弹窗容器**：用主项目现成弹窗容器（对齐 `ImageZoomDialog`/`SettingsFrame` 那套：原生 `<dialog>` 或遮罩卡片，Esc/点空白/× 关闭），不进画布缩放坐标系做浮层；弹窗自持生命周期，与宿主 `depthOpen` 绑定。打开即显示原视频缩略帧 + 状态，避免"空转"。
- **表单控件映射**（新源控件 → 主项目等价物）：
  - 处理方式 / AI 模型 / 运行位置 / 导出格式（下拉）→ 对齐现有 `Select`/`ModelSelect` 下拉样式与交互
  - 对比度 / 平滑（range 滑块）→ 原生 `range` + 项目滑块 class
  - 反色（checkbox）→ 对齐现有 `Toggle` 开关样式
  - 输出帧率 / 最大宽度 / 开始·结束秒数（number）→ 原生 input + 各节点通用的 `inputCls` 类公共输入样式
  - 开始转换 / 停止 → 对齐 `GenerateButton`/节点底部处理按钮的 loading 态与禁用逻辑
- **布局参照**：沿用新源 `index.html` 的 `workspace` 结构思想（左参数列 + 右预览），改造成 Tailwind 网格：左侧一组参数控件，右侧上「原视频预览」下/并排「深度视频预览」两个 canvas，底部进度条 + 状态文字 + 按钮。canvas 用 `willReadFrequently` 上下文，标 `nodrag/nowheel`（宿主是画布节点，防拖拽/滚轮干扰）。
- 具体 class 组合在施工时对 `DiscountVideoNode`/`NodeShell` 里现有表单的类名逐项对齐，不另起样式体系。

---

## 6. 关键技术点（全部已验证 / 从新源逐行核对）

### 6.1 UI port 边界
新源 `index.html` 的控件即功能清单，**逐一对齐**：
`engine(ai/fast 快速预览)`、`model(三选)`、`device(webgpu/wasm)`、`fps(25)`、`maxWidth(512,≤1280)`、`outputFormat(auto/mp4/webm)`、`start/end(0 表全片)`、`contrast(range 0.7..1.8 默认1.15)`、`smooth(range 0..0.85 默认0.25)`、`invert`。`fast` 模式是**无需模型**的亮度伪深度（`drawFastDepth`），可作为"无 GPU 也能玩"的兜底 UI 开关，port 保留。
UI 用主项目 Tailwind 重写，不沿用 `styles.css`。

### 6.2 在 Vite/主项目里加载 transformers.js 与 onnxruntime（关键差异：前缀用 API_BASE）
主项目不是 importmap（那是独立页）。做法：**运行时动态 import 绝对同源 URL + `@vite-ignore`**。前缀统一取 `API_BASE`（默认 `http://127.0.0.1:18080`），因为 dev(5180) 与生产(dist 托管在 18080) 都不是把 vendor 放在自己源根。

```ts
import { API_BASE } from './config.ts'
const RES = `${API_BASE}/depth-video`

const T = await import(/* @vite-ignore */ `${RES}/vendor/transformers/transformers.web.min.js`)
const { pipeline, env, RawImage } = T as any
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = `${RES}/models/`
env.backends.onnx.wasm.wasmPaths = {
  mjs:  `${RES}/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${RES}/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm`,
}
if (env.backends.onnx.webgpu) {
  env.backends.onnx.webgpu.powerPreference = 'high-performance'
  env.backends.onnx.webgpu.forceFallbackAdapter = false
}
```

> ⚠️ `transformers.web.min.js` 内如果内部用**相对** `./` 找 onnxruntime/worker/wasm，跨源（5180→18080）会 404。若如此：a) dev 阶段经浏览器直连 18080 仍同文件；b) 兜底方案是把资源 host 在同一源（见 §7.3 风险 R2）。CORS 已被 localTool 全开（`Access-Control-Allow-Origin:*`），浏览器跨源 import 模块需响应对应头，localTool 已对 `*` 放开 → 可行。

### 6.3 按需加载与隔离策略（防污染测试环境 / 防性能影响 —— 核心闸门）

> 用户关切：① 会不会污染测试环境；② 性能有没有影响；③ 要按需加载。
> 结论：**不会污染测试环境、无首屏/全局性能影响**，条件是严格按下面三道闸门 + 资源不入库。

**三道闸门（落地要求）：**
- **G1 代码按需**：transformers.js / onnxruntime **只以运行时动态 `import(/* @vite-ignore */ URL)` 引入**，**禁止任何静态 `import`**（含 `import()` 裸路径）。静态 import 会被 Vite 打进构建产物/首屏 chunk → 污染产物体积与所有环境首屏。
- **G2 时机按需**：模型加载**绝不**发生在「页面打开 / 弹窗打开」时。仅当**全部**满足才触发 `loadModel()`：
  `depthOpen===true` ∧ `engine==='ai'` ∧ 用户点击「开始转换」。`fast` 伪深度模式**完全不加载模型**（不 import transformers、不拉任何 onnx/wasm）。
- **G3 资源按需**：模型权重本身走 HTTP 按需字节拉取（transformers.js 加载 onnx 天然流式），不打包进前端。释放策略：转换结束 / 弹窗关闭 / 切到 `fast` 时置 `pipe=null`、`RawImage=null`、revoke 相关 objectURL，避免长驻占用内存。

**对测试环境隔离（三层防线）：**
1. 代码层面：UI 自动化测试默认走 `fast` 模式或无模型路径，`ai` 模式默认不自动点、不预载 → Playwright/CI 不触发模型下载。
2. 资源层面：`localTool/runtime-models/depth-video/models/`（几十 MB）**进 `.gitignore`，不入库、不进 CI/测试镜像** → 测试环境根本没有模型可拉，加载分支只在用户本地点 ai 时走。
3. 失败降级：`loadModel` 失败（本地缺文件 / 网络）时**不抛未捕获异常**，而是弹窗内明确报「本地深度模型缺失/加载失败，可切快速预览」，主流程与测试不受污染。

**性能影响边界（明确）：**
- 首屏 / 全局：零增量（未按需时不下载、不占内存）。
- 仅推理窗口：GPU/CPU 局部占用；跑完或关弹窗即释放（G3）。
- 不拖慢主画布：深度 canvas / 推理在弹窗 DOM 内，与画布渲染隔离。

### 6.4 GPU 回退链（照搬新源 `ensureModel`）
```
首选 = options.device==='webgpu'
  先 navigator.gpu 探测；无 → 强制 wasm。
  webgpu 时先 prepareHighPerformanceGpu(requestAdapter high-performance, 拒绝 fallback adapter)，
  失败 → wasm。
attemps:
  webgpu → [ {webgpu,q4f16}, {webgpu,q8}, {wasm,q8} ]
  wasm   → [ {wasm,q8} ]
逐档尝试 pipeline('depth-estimation', model, { local_files_only:true, device, dtype, progress_callback })，
成功即锁定 (model,device,dtype) 复用；全败抛错。
```
- 推理中途若 `device==='webgpu'` 抛错（GPU context 丢失等），`recoverFromGpuError`：重置 `pipe=null`，`options.device='wasm'`，重新 `ensureModel(wasm/q8)` 后继续 —— port 保留。

### 6.5 逐帧转换主循环（照搬 `convert()`）
```
totalFrames = ceil((end-start)*fps)
recorder = createRecorder(...)   // captureStream(0)+requestFrame 手动驱动
每帧 i：
  time = start + i/fps
  await seekVideo(time)          // video.currentTime=target + await 'seeked'
  drawSourceFrame()              // sourceCtx.drawImage(video→canvas)
  engine==='ai' ? await drawAiDepth(options) : drawFastDepth(options)
  await captureOneFrame()        // recorder.resume(); requestFrame(); sleep(1000/fps); requestFrame(); recorder.pause()
  progress = (i+1)/totalFrames
收尾 finishRecording() → Blob
```
- 逐帧用 `requestFrame()` 驱动 canvas 已 `putImageData` 的新帧进 MediaRecorder，**精确一帧一拍**。
- 中途用户可 stop：`abortRequested=true`（对应弹窗「停止」按钮）。

### 6.6 深度 tensor → 灰度图（照搬 `renderDepth`/`rawToImageData`/`tensorToImageData`/`adjustDepthValue`）
- 输出形状各异：有的给 `{data,width,height,channels}`（RGB/RawImage），有的给 `{data,dims}`（归一化 float，需先 min-max → 255）。
- `adjustDepthValue`：`contrast` 围绕 128 缩放 + `invert` 取反 + clamp。
- `smooth` 帧间混合在 `commitDepthFrame` 用上一帧 imageData 按 blend 逐像素混（0..0.85），port 保留。

### 6.7 编码 / MediaRecorder mp4 探测（照搬 `pickRecordingFormat`）
- `auto`：先试 mp4 codecs 列表（avc1…）再 webm；mp4 不支持则回退 webm 并提示。
- 返回 `{ mimeType, extension, fellBackToWebm }`。mp4 不可用时弹窗内提示"已改 WebM"。

### 6.8 上传与生成下游节点（复用主项目链路，不新增）
转换完成得到 `Blob` 后，**不走独立页的「下载」**，改为：
```ts
const { url } = await uploadResult(blob, { subfolder: UPLOAD_DIRS.videoProcess })
// 命名对齐节点惯例：`${stripExt(name)}_depth.${ext}`
onSave(url, outName)
```
`DiscountVideoNode` 里 `onSave → buildSpawnNodes + spawnAndCommit`（`src/components/base/deriveNodes.ts`，VideoProcessNode 的 `spawnVideoNode` 同源于此）生成下游深度视频 `imageNode(mediaType:'video')`，toast「深度视频已生成」，关弹窗。命名沿用节点惯例 `${stripExt(name)}_depth` + 实际扩展名。

---

## 7. 风险 / 注意（含新增）

- **R1 资源目录体积 / 入库**：`models/` 几十 MB、`vendor/` 数 MB。物理目录 `localTool/runtime-models/depth-video/` 应确保不被 git 大包/构建产物误收。若仓库会整体提交 localTool，给 `localTool/runtime-models/depth-video/models/` 加 `.gitignore`（`models/` 必须、`vendor/` 视 policy），把文件本地手动铺到位（从 Downloads 拷，不在 repo 追踪）。**这是纯本地模型，不会在 CI/远端存在**——服务启动后需保证目录在，缺文件会 import 失败。
- **R2 跨源 import worker/wasm**：transformers/onnxruntime 常起 worker + 拉 wasm。跨源(dev 5180→18080)时 wasm/worker 若按页面相对路径解析会 404。缓解：显式 `env.backends.onnx.wasm.wasmPaths`（已做）+ CORS 全开。若仍有 worker 跨源受限，dev 阶段最稳做法是**直接把深度弹窗页面也用 18080 的 dist 访问来测**（生产即同源），或后续加 Vite proxy 定向（仅 dev）。
- **R3 WebGPU 兼容**：旧浏览器回退 wasm（慢），预期内；`fast` 模式可无模型出伪深度兜底。
- **R4 性能**：逐帧 ONNX 推理是大计算，长视频耗时高。默认 `fps=25`、`maxWidth=512`；UI 上建议默认给较短 `start/end` 与 `fps` 提示，支持中途停止。转换是**弹窗内长任务**：用 `AbortController`/`abortRef` 支持「停止」，并在弹窗 `onClose`/卸载时 **dispose（G3）并 abort**，防卸载竞态——弹窗自持生命周期，不依赖 `DiscountVideoNode` 的生成 loading（节点 `loading` 只管 AI 生图）。
- **R5 MediaRecorder mp4**：`auto` 优先 mp4、否则 webm（§6.7），已探测 `isTypeSupported`。
- **R6 `base:'./'` + 绝对资源前缀**：主项目 `base:'./'` 只影响自己构建产物相对引用；深度资源一律 `${API_BASE}/depth-video/...` 绝对 URL，二者不冲突。生产若部署在**非** 127.0.0.1:18080 的远端（VITE_API_BASE 指向远程），深度资源须随同部署在该远端 `/depth-video/`，否则 404 —— 文档注明部署前提。
- **R7 命名**：outputName 用 `${stripExt(name)}_depth` + 实际扩展名（mp4/webm），避免覆盖源名。

---

## 8. 施工顺序（自包含，逐步可验证）

1. **后端加资源宿主 + 放置模型（最小，先让 URL 可读）**
   `paths.ts` 加 `getDepthVideoDir()`（返回 `localTool/runtime-models/depth-video/`）；`index.ts` 加 `/depth-video/` 静态分支（URL 前缀 → 该物理根）。把 Downloads 的 `vendor/`、`models/` 拷入 `localTool/runtime-models/depth-video/`（§5.1）；给 `localTool/runtime-models/depth-video/models/` 加 `.gitignore`。重启 localTool，浏览器验证 `http://127.0.0.1:18080/depth-video/vendor/transformers/transformers.web.min.js` 与任一 `models/.../*.onnx` 返回 200 且 mime 正确（js→`application/javascript`、onnx→`application/octet-stream`）。
2. **port 转换逻辑为可测试纯函数**：把新源 `app.js` 拆成与 DOM 解耦的模块（`loadModel` / `convertFrames` / `encodeMime` / `rawToGray` …），先单元可测，再接入组件。
3. **新增 `DepthVideoModal.tsx`**：UI **对齐现有控件/弹窗**（§5.2，Tailwind + 现有 `Select`/`Toggle`/`GenerateButton`/`inputCls` 体系，不搬 `styles.css`）+ 上述逻辑 + 上传回调。
4. **加入口**：`DiscountVideoNode`（`videoUrl` 非空）与 `ImageNode`（`type==='video'`）的 hover `toolbarButtons` 各追加图标 + `depthOpen` + 渲染共用 `DepthVideoModal`；`onSave` 提一个 `spawnDepthVideoNode(sourceId,url,name)`（`buildSpawnNodes/spawnAndCommit`）供两宿主复用。
5. **联调**：discount 节点生成视频、或 ImageNode 载入/产出视频后 hover → 点图标 → 弹窗载入该视频 → 选 fast 模式全流程出结果（不依赖模型，快速验通）→ 再验证 ai 模式 GPU/wasm 回退 → 对生成的下游深度节点再次 hover 验证链式可再转。
6. **验收**（§9）通过后提交。

---

## 9. 确认清单（施工前请打勾）

- [ ] 范围收敛：仅「**能承载视频的节点 hover 加转深度图标**（`DiscountVideoNode` + `ImageNode` 视频态）+ 一个无 iframe 弹窗 + 生成下游深度视频节点」，不动 localTool 的 `/api/*` 与 catch-all。
- [ ] **入口载体敲定**：`DiscountVideoNode`（`videoUrl` 非空才显示）与 `ImageNode`（`show: type==='video' && !!url`）两宿主的 hover 各加图标，共用一份 `DepthVideoModal`；源视频 = 宿主当前视频 URL；`onSave` 抽 `spawnDepthVideoNode`（`buildSpawnNodes/spawnAndCommit`）生成下游 `imageNode(mediaType:'video')`，**使下游可链式再转**（ImageNode 必须支持的原因）。
- [ ] **修正 B/D**：localTool 需**新增** `/depth-video/` 静态目录（现无），resource 前缀用 `API_BASE` 绝对 URL（dev 无 Vite proxy，`base:'./'` 保持）。
- [ ] **模型存放（§5.1）**：物理收进 `localTool/runtime-models/depth-video/`（子目录命名空间，vendor + models）；`models/` 入 `.gitignore` 不入库/CI，`vendor/` 可入库；浏览器 URL 保持简短的 `${API_BASE}/depth-video/...`（index.ts 静态分支做 URL→物理根映射）；URL 只经 `API_BASE` 前缀常量引用。
- [ ] **UI 对齐现有（§5.2）**：弹窗容器对齐现有 `dialog`/遮罩卡片；控件复用项目 `Select`/`Toggle`/`GenerateButton`/`inputCls` 体系与颜色 token；不搬 `styles.css`；左参数列 + 右双 canvas 预览布局。
- [ ] 上传落盘目录用现有 `UPLOAD_DIRS.videoProcess`（`canvas/video-process`），复用 `uploadResult`，不新写上传。
- [ ] `onSave` 行为：经 `buildSpawnNodes + spawnAndCommit` 生成下游「深度视频」`imageNode(mediaType:'video')`（沿用仓库统一 spawn 语义）。
- [ ] UI 还原度：用主项目 Tailwind 重写（功能等价即可，`fast` 伪深度保留作无模型兜底），不搬 `styles.css`。
- [ ] 停止/取消：长转换提供「停止」并按节点现有 `abortRef`/`controllerRef` 模式清理，避免卸载竞态。
- [ ] **按需三道闸门**：G1 仅运行时动态 import（禁静态 import）；G2 仅 `depthOpen ∧ ai ∧ 点击转换` 才 `loadModel`，`fast` 不加载；G3 结束/关弹窗释放 `pipe`/`RawImage`/revoke objectURL。
- [ ] **测试隔离**：`models/` 进 `.gitignore` 不入库/CI；UI 测试走 `fast` 或无模型路径；`loadModel` 失败只弹窗提示，不抛未捕获异常、不污染测试。

---

## 9A. 决策记录（方向缺口 1–5 定案）

> 补足上述施工前不可再悬的方向项。1、2 按架构师建议；3、4、5 按用户拍板。

### D1 资源加载与缓存策略（定案：**不做额外缓存层，保持简单**）
- 直接 HTTP 从 18080 `/depth-video/...` 拉取 vendor/models，依赖**浏览器 HTTP 缓存 + transformers.js 自身的 onnx 缓存**。
- **不做** IndexedDB / 自研「下载管理 / 首备」持久层——这是第一个本机工具实例，不值得先造。等有第二个本机工具、且"每次几十 MB 重拉"真开始痛时，再进 §10 通用层补缓存策略。
- 结论：本机浏览器工具默认对深度资源开启 HTTP 强缓存即可，代码不做额外持久化。

### D2 转换过程的可见性（定案：**弹窗内自持进度，不进任务中心/节点 loading**）
- 转换是**同步本机推理**，非异步后端任务。进度（状态条 + 百分比）完全在 `DepthVideoModal` 内自持（照搬新源 `status/bar`），**不写** `node.data` 的 loading/progress、**不进**主项目任务中心。
- 弹窗关闭即中止（`abortRef` + G3 dispose）；不提供"关弹窗后后台继续"的产品形态（本期不做）。

### D3 默认参数（定案：**弹窗内保活，不跨会话记忆；但调一组开机即用的中性偏优默认**）
- **不做**跨会话 prefs 记忆（接 `useNodePrefs` 会为单工具造键；等第二个本机工具 + 通用参数面板时再统一）。参数只在弹窗内用 React state 保持单次会话。
- **最佳默认参数**（能直接出片、不花哨）：
  | 参数 | 默认 | 理由 |
  |------|------|------|
  | 处理方式 engine | `ai` | 默认走真深度；`fast` 仅作无模型/超低配手动兜底 |
  | 模型 model | `onnx-community/depth-anything-v2-small` | 体积小 × 质量好的平衡点 |
  | 运行位置 device | `webgpu`（探测） | 有 WebGPU 用 GPU；无则**如实降级** wasm 并**告知用户**（见 D5） |
  | 输出帧率 fps | `25` | 与原视频观感一致；真慢可手动降 |
  | 最大宽度 maxWidth | `512` | WebGPU 下清晰与速度的平衡 |
  | 起止 start/end | `0 / 0` | 全片 |
  | 对比度 contrast | `1.0` | 中性，不人为扭曲 |
  | 平滑 smooth | `0.25` | 轻帧间混合，去闪烁不糊 |
  | 反色 invert | 关 | 依需求再开 |
  | 导出 outputFormat | `auto` | 能 mp4 则 mp4，否则**如实提示**转 webm（见 D5） |

### D4 下游节点 spawn（定案：**默认连边、复用仓库 spawn 规范，不重写**）
- 复用仓库统一范式：**照抄 `VideoProcessNode.spawnVideoNode`（`src/components/nodes/VideoProcessNode.tsx:800`）**：`buildSpawnNodes(...)` **本身即生成边**（`source=当前节点 → target=下游`，`sourceHandle:'main-output'`）+ `spawnAndCommit(...)` 原子提交（setNodes/setEdges/history.record 三连已收口，**禁止手写**）。
- 下游规格：`type:'imageNode'`、`data:{ imageUrl:url, mediaType:'video', label, expanded:true }`、`style` 对齐现有；节点 id 用 `generateId` 语义前缀。**默认连边**，画布上源在左、深度结果在右，链路可见且可继续链式。
- 两宿主各自的 spawn 收口到 `spawnDepthVideoNode(sourceId,url,name)`，内部同样只调 `buildSpawnNodes`/`spawnAndCommit`，**不另起一套 spawn**。

### D5 错误透传（定案：**真实透传，不做"骗人的兜底"**）
- **不搞掩盖真相的降级**：不静默 `catch → 假装切 CPU/wasm 继续`、不用假的占位结果糊弄。
- 凡失败都**如实上报**到弹窗内联状态条，给**真实可操作的下一步**，不弹系统 alert、不白屏：
  · WebGPU 初始化失败 → 明说"此环境 WebGPU 不可用"，让用户**主动选择**切 WASM（CPU）或退出——不自动替用户换；
  · 模型加载失败/本地文件缺失 → 明示"模型文件缺失/加载失败（路径 ${…}）"，给「重试」或「改用快速预览(fast)」；
  · mp4 编码不支持 → 明示"当前浏览器不支持 mp4 封装，已转 webm"，结果如实标注扩展名；
  · 中途取消/出错 → 状态条如实显示"已停止/失败原因"，复用主项目 `classifyError` 口径与 toast 文案规范，不吞异常。
- 对应地，照搬新源 `recoverFromGpuError` 这类**静默改 device 的写法要改为显式询问/告知**，不自动降级。

---

## 10. 前瞻规划：可插拔「本机推理工具」注册表（不阻塞当前施工，仅为后续建模预留）

> 动机（前瞻思维）：浏览器端本机 ONNX 推理是**一类能力**，深度估计只是第一个实例。未来的
> 抠图（RMBG / U²-Net）、人脸解析、超分、抠像、调色 等，骨架完全相同：**模型权重 + 运行时
> (transformers.js/onnxruntime) 由 localTool 静态托管 → 前端运行时按需 import + 按 key 加载/缓存 →
> 跑推理 → 结果上传回画布**。若每个都重造「静态目录 + loadModel + 释放」轮子，会复制、漂移、难收口。
> 本节把通用形态抽出来，但**当前只落到深度一个实例**，不引入"为了未来而抽象"的空转。

### 10.1 抽象模型（一句话）
把「深度弹窗」这一特例，泛化为：**一个「本机推理任务」= 模型声明 + 输入 + 参数 → Blob 输出 → 回画布**。
当前深度转视频其实可看作**多帧**推理（一视频 → 逐帧 depth → 编码成片）。单图抠图是**单帧**特例，天然复用同一 pipeline。

### 10.2 建议分层（贴合仓库既有惯例，避免另起新形态）

```
┌─ 通用层（与具体模型无关，本期就建，可复用于一切本机模型）
│  localTool 侧：
│   · 静态资源宿主：不再是「深度专属 /depth-video/」，而是通用「本地推理资源根」，
│     默认一个命名空间（如 /depth-video、/runtime-models/<id>），一个目录解析函数即可扩。★见 10.5
│  前端侧：
│   · runtimeModels/ 目录：加载器 + 释放器 + 内存/缓存策略（对 transformers.js 二次封装）。
│     职责：给「模型 id → 已 import 的运行时 + 已 load 的 pipeline」做键控缓存与释放，
│     与 DOM/组件解耦，纯函数可单测（对齐仓库「纯函数下沉可测」惯例）。
│
├─ 声明表（对齐 WORK_MODE_DEFS / HEAVY_NODE_LOADERS / toolRegistry —— 静态声明、引用恒定）
│  LOCAL_MODEL_DEFS：一个字段登记一个可用「本机模型」，字段值含：
│     id / label / type(task，如 depth-estimation / background-removal)
│     runtimePath(vendor 脚本 URL) / modelRoot(models 子路径)
│     defaultDevice 与回退链 / 输入输出形状说明 / 用途描述(给 UI 与未来入口)
│  新增一个模型 = 本表加一条 + localTool 静态目录铺对应 vendor/models，不碰其它逻辑。★见 10.4
│
├─ 运行时加载器（局部，本期就抽象，不做过度）
│   useLocalModel(id) → { load(), pipe, dispose(), loading, error }
│   —— 封装 G1/G2/G3 闸门；同 id 幂等（已 load 复用），切 id / 释放时统一 dispose。
│
└─ 能力入口（未来：每种「本机工具」一个入口组件/按钮，登记到入口表，对齐 lazyNode 预注册）
     · 转深度视频（本期）→ DepthVideoModal
     · 抠图（未来）→ 一个「图片节点上『去背景』」入口 / 或节点能力菜单
```

### 10.3 关键铁律（本期就执行，避免为未来挖坑）
1. **资源目录通用化但按工具命名空间隔离**：不要写死 `/depth-video/` 这一个串到前端各处，而是收口到一个「本地推理资源前缀」常量（如 `RUNTIME_MODELS_ROOT`），再按工具拼命名空间。当前只有一个工具时，值 = `${API_BASE}/depth-video`；未来加抠图 = `${API_BASE}/runtime-models/rembg`。★前端**只从一个模块**读这个前缀（对齐 config.ts 单一来源），禁止散写。
2. **每个工具的 vendor/models 独立成子目录 + 独立 `.gitignore` 条目**：互不污染；任一工具缺资源不影响其它（各自失败只各自弹窗）。
3. **模型声明集中、实现拆分**：`LOCAL_MODEL_DEFS` 只存「元数据 + 路径」，不存推理实现；每个模型一个 `run(pipe, input)` 纯实现文件。深度那套逐帧/录像属于「转视频」工作流，是深度工具的自带流程，不塞进通用层。
4. **结果出口统一**：都走「Blob/URL → uploadResult(subfolder) → 回调 spawn 对应节点」，复用 filesApi/uploadDirs，不各自写上传。
5. **不预建 UI 框架**：通用层只做「加载/释放/资源前缀/声明表」四件与模型无关的事；每种工具的**参数面板**仍是各自的（抠图不需要 fps/startTime）。避免造一个万能表单引擎的空转。

### 10.4 未来加一个「抠图」模型的最小改动（用本设计推演）
- localTool：新增静态命名空间（如把 `RMBG` 的 vendor/models 拷到 `localTool/runtime-models/rembg/`）；index.ts 的静态分支只需把「前缀根」参数化，已是通用实现。
- 前端：`LOCAL_MODEL_DEFS` 加一条 `rembg`；写一个 `runRmbg(pipe, imageUrl)` 纯实现（单帧输入→透明 PNG Blob，走 `rawToImageData` 同款 `adjustDepthValue` 思路的 alpha 输出）；建一个「图片节点『去背景』」入口组件，复用 `useLocalModel` + `uploadResult`。
- 无需改动：加载/释放/资源前缀/上传/`.gitignore` 策略/测试隔离三道闸门。

### 10.5 与「本期最小化」的关系（不超前实现）
本期**不新建** `runtimeModels/` 抽象目录、**不写** `LOCAL_MODEL_DEFS` 表、**不加**抠图 UI。只做两件「顺手不费」的铺垫，让未来不加一行改动就能插：
- **p1 资源前缀收口**：把 `${API_BASE}/depth-video` 收敛到一个常量（`depthVideo/config.ts` 或并入 config），组件不再散写。
- **p2 加载/释放提函数**：把 `loadModel / disposeModel / encodeMime / rawToGray` 从组件里提成模块级纯函数（已列入 §8 步骤 2 的 port 拆分），天然可被未来工具复用。

> 结论：**现在不做通用框架**，只做 p1/p2 两个收口；把「注册表/通用层」作为这篇文档的 10.x 记录在案，等第二个本机模型真出现时，再据此把 p1/p2 升格为通用层。既符合「先按需、不过度抽象」，又保住了前瞻扩展的落点。

---

确认后我再开始施工。
