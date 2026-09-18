# 57- 内容识别填充（inpaint）接入研究与翻车点

> 目标：把 inpaint-web（MI-GAN）的内容识别填充能力接入现有 `src/components/base/ImageEditor.jsx`，
> 采用 **B2 方案（画笔涂抹 mask + 完整复刻 renders[] 渲染栈 + 原图对照 slider）**。
> 本文档只做研究与风险收口，**不写业务代码**（按步进式协议，State 3 才施工）。

---

## 1. 结论速览

| 项 | 结论 |
|---|---|
| 选哪 | inpaint-web 的 MI-GAN（`migan_pipeline_v2.onnx`），纯前端 WebGPU/WASM，零后端 |
| 模型来源 | 运行时从 HuggingFace CDN 拉 `migan_pipeline_v2.onnx`，存浏览器 IndexedDB（`localforage`，库名 `modelCache`） |
| 我们怎么放 | **复制 onnx 到 `public/models/migan_pipeline_v2.onnx`**，改 `cache.ts` 的 url 指向 `/models/...`，首次从本站下载、IndexedDB 永久缓存 |
| 交互 | **画笔涂抹 mask**（任意形状），非矩形。松手即推理，与 PS 内容识别一致 |
| 方案 | B2：复刻 `renders[]` 迭代栈 + `lines[]` mask 栈 + 原图对照 slider，撤销复用现有 `pushHistory` |
| 源码仓库 | **https://github.com/lxfater/inpaint-web** （MIT? 否，实际为 **GPL-3.0**；需移植的文件在 `src/adapters/`） |
| 许可证 | inpaint-web 为 **GPL-3.0**（强 Copyleft）。内部用无碍；闭源分发需法务评估或换 lama |

---

## 2. 现有代码盘点（已读源码，非猜测）

### 2.1 inpaint-web 核心三件套（`_try_inpaint/src/adapters/`）
- `inpainting.ts`：`inpaint(imageFile, maskBase64)`，整体复用。
- `cache.ts`：`ensureModel(name)` / `downloadModel(name, onProgress)` / `modelExists(name)`，模型加载与 IndexedDB 缓存。
- `util.ts`：`getCapabilities()`（WebGPU/WASM/SIMD/threads 探测）+ `loadOrt()`（**动态注入 onnxruntime-web 的 wasm 脚本到 `<head>`**，不进 bundle）。

### 2.2 交互层（`_try_inpaint/src/Editor.tsx`）—— 必须搬的模式
- `lines: Line[]`（`{size, pts:[]}`）记录每次涂抹轨迹；`drawLines()` 把轨迹画成红色半透明叠加。
- `maskCanvas`：离屏 canvas，松手时 `refreshCanvasMask()` 用**白色**重画同一轨迹 → 作为 mask。
- 松手（`onPointerUp`）→ `refreshCanvasMask()` → `inpaint(renders.at(-1) ?? file, maskCanvas.toDataURL())` → 结果 push 进 `renders[]`。
- `renders[]`：每一帧推理结果是一张 `HTMLImageElement`，支持"回到某一步"（`backTo(index)`）。

### 2.3 superResolution.ts（对称参考，暴露另两个翻车点）
- 同样用 `ort` + `ensureModel`，但默认走 **CDN**（`cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/`）。
- 用 `opencv-ts` 做前处理（`cv.imread` / `cvtColor`）—— **我们的项目没有 `opencv-ts`，需加依赖**。

---

## 3. 接入架构（B2 数据流，State 3 待细化）

```
用户涂抹(canvas 鼠标事件)
   → lines[] (不可变更新 setLines([...]))
   → drawLines() 红色叠加层 (仅 UI 预览，不入主图)
   → onPointerUp:
       refreshCanvasMask(): lines → 白色画进 maskCanvas (离屏)
       inpaintCore(currentRenderImg | 原图, maskCanvas.toDataURL())
          ├─ ensureModel('inpaint') [首次 fetch /models/migan... → IndexedDB]
          ├─ getCapabilities() + 动态注入 onnxruntime wasm
          ├─ processImage: opencv cvtColor RGBA→RGB (imgProcess)
          ├─ processMark:  mask 反相 (markProcess, 见 §4.3)
          ├─ model.run(imageTensor, maskTensor)
          └─ postProcess → dataURL
       → 结果 Image 进 renders[] (复刻)
       → 主 canvas 重绘 renders.at(-1)
       → pushHistory() 进现有撤销栈
```

**唯一入口**：`applyInpaint()`（`useCallback`，仿现有 `applyCrop`），禁止在事件 handler 里散写推理逻辑。

**复用点（禁止另写）**：
- 选区/mask 交互：搬 `Editor.tsx` 的 `lines`/`drawLines`/`refreshCanvasMask` 模式（新增，因现有 ImageEditor 无此能力）。
- 撤销：`pushHistory`（ImageEditor.jsx:221）。
- 推理核心：`adapters/inpainting.ts` + `cache.ts` + `util.ts`。
- 日志：用现有 `src/components/base/logger.js` 的 `logger` / `logger.error`，**禁止** `console.log` 散写、`alert()`、静默 `.catch(()=>{})`。

---

## 4. 翻车点（重点）

### 4.1 mask 是反相的 —— 最易写错
`inpainting.ts` 的 `markProcess`：
```js
chwArray[...] = (channelData[h * W + w] !== 255) * 255
```
含义：mask 上**非白色(255)区域 → 255（要修复）**，**白色区域 → 0（保留）**。
所以涂抹轨迹必须用**白色**画进 maskCanvas（正如 `Editor.tsx` 的 `refreshCanvasMask` 用 `'white'`）。
**翻车**：若图省事直接在红色预览层取 mask，或把 mask 颜色搞反，结果会是"该修的没修、该留的被糊掉"。务必保持 `maskCanvas` 用白色描轨迹。

### 4.2 坐标系不一致 —— canvas 缩放导致 mask 错位
- inpaint-web 单 canvas，mask 与主图**同尺寸同坐标**，`maskCanvas.width = context.canvas.width`。
- 我们 `ImageEditor` 主图有 **CSS 缩放 / devicePixelRatio / 画布平移缩放**，`ev.offsetX/offsetY` 是**显示坐标**，不等于图像像素坐标。
- **翻车**：直接把鼠标 `offsetX/Y` 当图像坐标涂，mask 会整体偏移、缩放错位，推理区域对不上。
- **对策**：涂抹坐标必须映射到**主图实际像素坐标系**（`imgRef` 自然尺寸 or canvas 内部分辨率）。复用现有 `applyCrop` 里的 `scaleX/scaleY` 映射思路（ImageEditor.jsx:402-426）。maskCanvas 尺寸必须等于"送推理的图像尺寸"，不能等显示尺寸。

### 4.3 opencv-ts 依赖 + WASM 初始化时序
- `inpainting.ts` / `superResolution.ts` 都 `import cv from 'opencv-ts'`，且前处理 `cv.imread` 需要 opencv.js 的 wasm 就绪。我们的 `package.json` **没有 opencv-ts**，需加。
- **翻车**：opencv-ts 的 wasm 未 ready 就调 `cv.imread` 会抛 `cv is not defined` 或静默 NaN。必须等 `cv['onRuntimeInitialized']` 或 `await cv.ready`（取决于版本）后再跑 `inpaint`。建议把 opencv 初始化也收口进 `util.ts` 的 `getCapabilities` / 一个新的 `ensureOpencv()`。

### 4.4 onnxruntime 走 CDN 还是 bundle
- `inpainting.ts` / `superResolution.ts` 的 `configEnv` 把 `ort.env.wasm.wasmPaths` 指向 **`cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/`**（外网 CDN）。
- **翻车**：① 用户离线/内网打开 → 推理直接挂；② 版本漂移 CDN 资源变动 → 隐性坏。
- **对策**：要么把 onnxruntime-web 的 wasm 也放 `public/onnxruntime/`（推荐，和模型同源），改 `configEnv` 指向 `/onnxruntime/`；要么 `package.json` 装 `onnxruntime-web` 用打包。先确认 `util.ts` 的 `loadOrt()` 是否已从 npm 引入——若是，则 `wasmPaths` 改本地即可。

### 4.5 模型加载失败 / WebGPU 不可用 —— 失败必须可见
- inpaint-web 原版：`catch(e){ alert(e.message) }` + 一堆 `console.log` → **违反本仓库《53-错误处理静默与虚假审计》**。
- **翻车**：模型下载中断、IndexedDB 配额满、WebGPU 上下文创建失败 → 若静默吞错，用户只看到"转圈 forever"或"没反应"。
- **对策**：
  - 模型 `fetch` 必须套**总超时**（`withTimeout`，本仓库统一机制），超时抛明确错误并清理悬挂资源。
  - 所有错误**原样透传**到 `logger.error('inpaint','fail',{error:e.message, stack:e.stack})` + UI 错误态，**禁止** `.catch(()=>{})`、禁止 `alert()`、禁止 `new Error('出错了')` 抹掉原始 stack。
  - WebGPU 不可用时 `getCapabilities()` 已回退 wasm，无需自己判，但回退后的失败仍要透传。

### 4.6 大图内存 / 主线程卡死
- `inpaint()` 全程**主线程**，MI-GAN 跑 1024×1024 级图可能卡数秒（你实测"速度还行"，但取决于图尺寸/设备）。
- inpaint-web 在 `App.tsx` 用 `resizeImageFile(f, 1024*4)` 把图限制到 **4096 边**内再进编辑器。
- **翻车**：用户直接拖入 8000px 大图 → 推理爆内存或卡死无响应。
- **对策**：接入时复用 `resizeImageFile` 思路，进 inpaint 前限制最大边（建议 ≤4096，可按设备降）。

### 4.7 B2 的 renders[] 与原 ImageEditor 撤销栈的冲突
- 我们现有 `pushHistory` 是基于**主 canvas 像素快照**的撤销栈；B2 又要 `renders[]` 多帧迭代 + "回到某步"。
- **翻车**：两套历史并存会状态分裂（撤销栈和 renders 不同步，撤销后 renders 还在）。
- **对策（State 3 细定）**：二选一——
  - (a) renders[] 仅作**预览/逐步精修的中间态**，每次松手推理完成即 `drawImage` 结果进主 canvas + `pushHistory`（单一真相源 = 主 canvas + pushHistory）；"回到某步"用 renders 但不绕过 pushHistory。
  - (b) 彻底用 renders[] 替代 pushHistory（改动大，不推荐，破坏现有撤销契约）。
  - **采用 (a)**，保持现有 `pushHistory` 唯一入口不被旁路。

### 4.8 画笔预览与主图叠加的 DOM 结构
- inpaint-web 把 mask 预览画在**同一个 canvas**（`drawLines(context,[currentLine])`），松开才分离 mask。
- 我们 ImageEditor 是 React 受控 + 已有工具系统，**建议**在 inpaint 工具激活时，在主 canvas 之上盖一个**独立的透明 overlay canvas** 做涂抹预览，避免污染主 canvas 的撤销基准像素。
- **翻车**：把涂抹预览直接画进主 canvas → 撤销快照里混入了红色笔迹。

---

## 5. 依赖与放置清单（State 3 施工前准备）

| 资源 | 来源 | 放到我们项目 |
|---|---|---|
| `migan_pipeline_v2.onnx` | HF CDN（运行时拉） | `public/models/migan_pipeline_v2.onnx`（从 `_try_inpaint` 已缓存或重新下载复制） |
| onnxruntime-web wasm | CDN `cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/` | 改为 `public/onnxruntime/`（去外网依赖）或 npm 打包 |
| `opencv-ts` | npm | `package.json` 新增依赖 |
| `localforage` | npm（cache.ts 用） | `package.json` 新增依赖 |
| adapter 三件套 | `_try_inpaint/src/adapters/` | 移植到 `src/components/base/inpaint/`（或 `src/lib/inpaint/`） |

> 模型文件不在 `_try_inpaint/public/`（运行时拉取后存 IndexedDB），需从浏览器已缓存或重新 `curl` HF 取得后复制进 `public/models/`。

---

## 6. 待 State 2/3 确认项（已收口，待施工）

1. **方案锁定 B2**，renders[] 采用 §4.7 的 (a) 策略，不旁路 `pushHistory`。
2. **模型放 `public/models/`**，URL 常量集中登记（仿 `CONTRACTS` 的 `STORAGE_KEYS` 思路，不裸写字符串）。
3. **统一 logger + withTimeout**，抹掉原版 `alert`/`console.log` 静默风格（对标《53-错误处理静默与虚假审计》《09-日志系统统一收口规范》）。
4. **坐标映射**复用 `applyCrop` 的 `scaleX/scaleY`，maskCanvas 尺寸 = 送推理图像像素尺寸。
5. **opencv / onnxruntime 去 CDN 化**，本地 `public/` 托管。

---

## 7. 验证清单（State 2 契约断言雏形）

- 给定：主图 + 白色涂抹轨迹 mask → `inpaint()` 返回 dataURL，且**涂抹区像素被改变、未涂抹区像素不变**（验证 mask 反相正确）。
- 给定：WebGPU 不可用环境 → `getCapabilities()` 回退 wasm 且仍能出结果。
- 给定：模型 URL 404 → `ensureModel` 抛错且经 `withTimeout` 超时，错误透传到 `logger.error` + UI，无静默转圈。
- 给定：同一站点二次打开 → 模型从 IndexedDB 命中，不再网络下载。
- 给定：涂抹坐标在缩放后的 canvas 上 → 推理修复区域与视觉涂抹位置对齐（验证 §4.2）。

---

# 8. State 2：可验证断言（施工验收用，逐条可写成单测）

> 每条断言必须"实现一变必红"，禁止自证式（只验证不崩 / mock 被调用）。
> 建议放 `tests/unit/inpaint*.test.js`，用 jsdom + 真实 onnx 太重，故对**纯函数层**（坐标映射、mask 生成、超时）做单测；端到端推理用手动验收（§11）。

**A. 坐标映射（对应 §4.2）**
- `mapScreenToImage(offsetX, offsetY, viewState)`：给定 displaySize=800×600、imageSize=1600×1200、scale=1 → 返回 (2*offsetX, 2*offsetY)；给定有平移 offset → 减去平移后再缩放。断言输出落在 [0, imageSize] 区间。

**B. mask 生成反相正确（对应 §4.1）**
- `buildMaskDataURL(lines, imgW, imgH)`：给定一条白色轨迹 lines，返回 dataURL；解码其像素，断言轨迹像素 = 255、轨迹外像素 = 0（注意：送 `inpaint` 前是白色=要修；`markProcess` 内部再反相，见 §4.1，本断言只验"涂抹处=白"）。
- `markProcess` 语义（移植后单测）：输入 mask 中一处 255、一处 0 → 输出 chw 中对应位置分别为 0 和 255（验证反相）。

**C. 超时与失败可见（对应 §4.5，复用 `asyncGuard.withTimeout`）**
- `ensureModel('inpaint', { timeoutMs: 8000 })`：当 URL 返回 404 / 网络断 → 8s 内 reject 且 `isTimeoutError` 或真实错误，错误 message 含原始原因；**断言不出现永久 pending**。
- 任意 `catch` 分支：断言**不存在** `catch(()=>{})` 空体、不存在 `new Error('出错了')` 抹栈；真实 `e.stack` 必须进入 `logger.error`。

**D. 模型缓存命中（对应 §4.5）**
- 首次 `ensureModel` 后，`localforage.getItem(MODEL_CACHE_KEY)` 非空；二次调用**不发网络请求**（可用 `fetch` 计数器断言），直接 resolve。

**E. 大图限边（对应 §4.6）**
- `clampImageToMaxEdge(file, 4096)`：输入 8000×6000 → 输出宽 ≤4096 且比例不变。

**F. 撤销入口不被旁路（对应 §4.7）**
- 完成一次 inpaint 后，`pushHistory` 被调用且主 canvas 当前像素 = renders.at(-1) 解码像素；renders 仅作中间态，断言 `pushHistory` 调用次数 = inpaint 成功次数（不随 renders 预览帧额外增加）。

---

# 9. State 3：施工规格（直接照做）

## 9.1 新增/修改文件树

```
src/
  components/base/
    ImageEditor.jsx              # 【改】注册 'inpaint' 工具 + 挂载 overlay + 调 applyInpaint
    inpaint/
      inpainting.ts              # 【搬】_try_inpaint/src/adapters/inpainting.ts，url 改本地
      cache.ts                   # 【搬】_try_inpaint/src/adapters/cache.ts，key 常量登记
      capabilities.ts            # 【搬】_try_inpaint/src/adapters/util.ts（getCapabilities+loadOrt）
      opencv.ts                  # 【新】ensureOpencv() 收口 opencv-ts 初始化（对应 §4.3）
      maskCanvas.ts              # 【新】buildMaskDataURL / mapScreenToImage / refreshCanvasMask
      useInpaint.ts              # 【新】React hook：lines 状态、涂抹事件、applyInpaint 唯一入口
      constants.ts               # 【新】INPAINT_MODEL_URL / MODEL_CACHE_KEY / MAX_EDGE / ORT_WASM_PATH
  components/base/utils.js       # 【不改，复用】withTimeout / loadImageWithTimeout（asyncGuard）
public/
  models/migan_pipeline_v2.onnx  # 【放】从 HF 或已缓存复制（见 §5）
  onnxruntime/                   # 【放】onnxruntime-web@1.16.3/dist/* （去 CDN，对应 §4.4）
```

> 不要新建第二个 ImageEditor 或第二个 inpaint 入口（防重复，对应 State1 收口检索）。

## 9.2 常量登记（`inpaint/constants.ts`，禁止裸写字符串）

```ts
export const INPAINT_MODEL_URL = '/models/migan_pipeline_v2.onnx'   // 改自 HF CDN
export const ORT_WASM_PATH = '/onnxruntime/'                        // 改自 cdn.jsdelivr.net（§4.4）
export const MODEL_CACHE_KEY = 'migan-pipeline-v2'                  // localforage key（§4.5）
export const MODEL_CACHE_STORE = 'modelCache'                       // localforage 库名
export const MAX_EDGE = 4096                                        // 大图限边（§4.6）
export const MODEL_LOAD_TIMEOUT_MS = 60000                          // 模型下载总超时
export const INFER_TIMEOUT_MS = 120000                              // 推理总超时
```

## 9.3 核心函数签名（单一职责，拼接闭环 §1 需求）

```ts
// maskCanvas.ts —— 坐标与 mask（对应 §4.1/§4.2）
mapScreenToImage(offsetX, offsetY, view: {scale, panX, panY, dispW, dispH}): {x, y}
buildMaskDataURL(lines: Line[], imgW: number, imgH: number): Promise<string>
refreshCanvasMask(maskCtx, lines: Line[]): void   // 白色描轨迹（§4.1）

// opencv.ts —— opencv 初始化收口（§4.3）
ensureOpencv(): Promise<OpenCV>

// inpainting.ts —— 移植自 _try_inpaint，签名保持
inpaint(imageFile: Blob, maskBase64: string, opts?: {signal?:AbortSignal}): Promise<string>

// cache.ts —— 移植，url 用 INPAINT_MODEL_URL，套 withTimeout
ensureModel(name: string, opts?: {timeoutMs?: number; signal?: AbortSignal}): Promise<void>
downloadModel(name, onProgress?): Promise<void>
modelExists(name): Promise<boolean>

// useInpaint.ts —— 唯一入口（对应 State1 唯一入口）
useInpaint({canvasRef, imgRef, pushHistory}) => {
  lines: Line[],
  isInpainting: boolean,
  error: Error | null,
  onPointerDown/Move/Up(e),     // 涂抹交互（搬 Editor.tsx，坐标经 mapScreenToImage）
  applyInpaint(): Promise<void>, // 串：refreshCanvasMask→inpaint→drawImage→pushHistory（§4.7-a）
  backTo(index): void,           // renders[] 回到某步（不旁路 pushHistory）
  clearMask(): void,
}
```

## 9.4 数据流转（单向，对应 §3）

```
[指针事件] 
  → onPointerDown/Move：mapScreenToImage → 追加到 lines（setLines([...lines, newLine]）不可变）
  → 红色预览画在 overlay canvas（不入主 canvas，对应 §4.8）
[onPointerUp]
  → refreshCanvasMask(maskCtx, lines)        // 白色轨迹（§4.1）
  → maskDataURL = buildMaskDataURL(lines, imgW, imgH)
  → applyInpaint():
      currentImg = renders.at(-1) ?? imgRef.current   // B2 原图对照基准
      withTimeout(inpaint(currentImgFile, maskDataURL, {signal}), INFER_TIMEOUT_MS)
        └─ ensureModel('inpaint',{timeoutMs:MODEL_LOAD_TIMEOUT_MS,signal})  // 首次下载+IndexedDB
        └─ getCapabilities()+loadOrt() → ORT_WASM_PATH（§4.4）
        └─ ensureOpencv() → cvtColor RGBA→RGB（§4.3）
        └─ markProcess 反相（§4.1）→ model.run → postProcess → dataURL
      → resultImg = await loadImageWithTimeout(dataURL)   // 复用 asyncGuard
      → renders.push(resultImg)        // B2 中间态（§4.7-a）
      → ctx.drawImage(resultImg) 到主 canvas
      → pushHistory()                  // 单一真相源，不旁路
      → clearMask()；setIsInpainting(false)
  → 任一步失败：catch(e) → logger.error('inpaint','fail',{msg:e.message,stack:e.stack})
                     → setError(e) → UI 错误态展示，禁止静默
```

## 9.5 空实现骨架（施工时按注释填，禁止未声明依赖）

```ts
// useInpaint.ts（骨架，注释即步骤）
export function useInpaint({ canvasRef, imgRef, pushHistory }) {
  const [lines, setLines] = useState<Line[]>([])        // 不可变更新
  const [renders, setRenders] = useState<HTMLImageElement[]>([])
  const [isInpainting, setIsInpainting] = useState(false)
  const [error, setError] = useState<Error|null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>()      // 离屏 mask

  const onPointerDown = (e) => { /* mapScreenToImage → 起新 line，setLines */ }
  const onPointerMove = (e) => { /* 追加 pt 到当前 line，重绘 overlay 红色预览 */ }
  const onPointerUp = () => { /* refreshCanvasMask → applyInpaint */ }

  const applyInpaint = async () => {
    // 1. 取当前基准图（renders.at(-1) ?? imgRef.current）
    // 2. buildMaskDataURL(lines, imgW, imgH)
    // 3. withTimeout(inpaint(...), INFER_TIMEOUT_MS) —— 失败原样透传 logger.error+setError
    // 4. loadImageWithTimeout(resultDataURL) → draws 主 canvas
    // 5. setRenders([...renders, img])；pushHistory()  // 单一入口
    // 6. clearMask()
  }
  const backTo = (i) => { /* renders[i] → 主 canvas + pushHistory（不旁路） */ }
  const clearMask = () => { setLines([]); /* 清 overlay + maskCanvas */ }
  return { lines, renders, isInpainting, error, onPointerDown, onPointerMove, onPointerUp, applyInpaint, backTo, clearMask }
}
```

## 9.6 关键步骤注意（逐条对翻车点）

- **§4.1 mask 反相**：`refreshCanvasMask` 必须用 `'white'` 描；`markProcess` 移植时**保留反相逻辑**，不要"好心"改成正相。
- **§4.2 坐标**：所有涂抹点经 `mapScreenToImage`，`maskCanvas.width/height = imgW/imgH`（送推理尺寸），overlay 仅显示用。
- **§4.3 opencv**：`ensureOpencv()` 在 `applyInpaint` 首次调用，await 后再 `cv.imread`；opencv-ts 加进 `package.json`。
- **§4.4 onnxruntime 去 CDN**：`configEnv` 的 `ort.env.wasm.wasmPaths = ORT_WASM_PATH`；把 `onnxruntime-web@1.16.3/dist/*` 复制到 `public/onnxruntime/`。
- **§4.5 失败可见**：模型 `fetch` 用 `withTimeout(... MODEL_LOAD_TIMEOUT_MS)`，signal 传入可 abort；禁止 `alert`/`console.log`/空 catch；错误统一 `logger.error`。
- **§4.6 大图**：进 inpaint 前 `clampImageToMaxEdge(file, MAX_EDGE)`。
- **§4.7 撤销单一源**：renders 只预览/精修，每次成功必 `pushHistory`，不另建历史栈。
- **§4.8 overlay**：红色预览画独立 overlay canvas，绝不画进主 canvas（避免污染撤销基准）。

---

# 10. 依赖与资源落地清单（施工前必须齐）

### 10.1 源码拉取（接手 AI 先 clone 再移植）
```
git clone --depth 1 https://github.com/lxfater/inpaint-web.git _try_inpaint
```
需移植的源文件（已在本仓 `_try_inpaint/` 验证存在）：
- `_try_inpaint/src/adapters/inpainting.ts` → 推理主函数 `inpaint(imageFile, maskBase64)`
- `_try_inpaint/src/adapters/cache.ts`     → 模型加载 / IndexedDB 缓存
- `_try_inpaint/src/adapters/util.ts`      → `getCapabilities()` + `loadOrt()`（动态注入 onnxruntime）
- `_try_inpaint/src/Editor.tsx`            → 涂抹交互模式（`lines`/`drawLines`/`refreshCanvasMask`）参考实现

### 10.2 资源 / 依赖

| 资源 | 动作 | 位置 |
|---|---|---|
| `migan_pipeline_v2.onnx` | 从 HF（`andraniksargsyan/migan`）或本机浏览器已缓存 IndexedDB 取出，复制到项目 | `public/models/` |
| `onnxruntime-web@1.16.3/dist/*` | `npm pack onnxruntime-web@1.16.3` 取 dist，复制到项目 | `public/onnxruntime/` |
| `opencv-ts` | `npm i opencv-ts` | `package.json` |
| `localforage` | `npm i localforage`（cache.ts 用） | `package.json` |
| 推理三件套 | 复制 `_try_inpaint/src/adapters/{inpainting,cache}.ts` + `util.ts` | `src/components/base/inpaint/` |

> 模型不在 `_try_inpaint/public/`（运行时拉取存 IndexedDB）。取模型两种方法：
> 1) 浏览器打开 `_try_inpaint` 跑一次 inpaint，再从 `AppData\...\IndexedDB` 导出（麻烦）；
> 2) 直接 `curl -L https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx -o public/models/migan_pipeline_v2.onnx`（推荐）。

---

# 11. 交付检查清单（另一个 AI 施工完逐项勾）

- [ ] `public/models/migan_pipeline_v2.onnx` 存在且可访问（curl 200）
- [ ] `public/onnxruntime/` 含 onnxruntime wasm（无外网 CDN 依赖）
- [ ] `ImageEditor.jsx` 工具栏出现 `inpaint` 工具且 `setTool('inpaint')` 进入涂抹模式
- [ ] 涂抹为任意形状（画笔），非矩形
- [ ] 松手即推理，结果自动补全涂抹区，未涂抹区像素不变（§4.1 反相正确）
- [ ] 缩放后的 canvas 上涂抹，修复位置与视觉对齐（§4.2）
- [ ] 首次推理触发模型下载，进度可见；二次打开从 IndexedDB 命中（§4.5）
- [ ] 模型 URL 404 / 断网 → 60s 内超时报错，UI 显示错误，无永久转圈（§4.5）
- [ ] 无任何 `catch(()=>{})` / `alert()` / `console.log` 静默；错误进 `logger.error`（对标《53-错误处理静默与虚假审计》）
- [ ] WebGPU 不可用自动回退 wasm 仍出结果
- [ ] 8000px 大图自动限边 ≤4096，不爆内存（§4.6）
- [ ] 每次 inpaint 成功都进 `pushHistory`，renders[] 不旁路撤销（§4.7-a）
- [ ] 提供"回到某步"对照（B2 要求）
- [ ] 单元测试覆盖 §8 的 A~F 断言
- [ ] 许可证提示：GPL-3.0，内部用无碍；闭源分发需评估（§1）

---

# 12. 给接手 AI 的最后一句话

这是**纯前端、零后端**的内容识别填充（MI-GAN）。核心难点不是算法，而是：
1. mask 反相（§4.1）——写错就"修反了"；
2. 坐标对齐（§4.2）——我们的 canvas 有缩放，必须映射；
3. 失败可见 + 超时（§4.5）——原版用 alert/console.log 静默，本仓库严禁，必须 `asyncGuard.withTimeout` + `logger.error`；
4. 去 CDN 化（§4.4）——模型与 onnxruntime 都放 `public/` 本地托管。

照 §9 骨架写，按 §11 勾选，不要另起入口、不要静默吞错、不要改 mask 反相逻辑。

