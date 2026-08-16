# TASK-018 — 视频引擎与 3D/全景/特效节点边界薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不写批量改码脚本。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 未覆盖「视频处理」「3D 导演」「全景」「人脸马赛克」等重型节点与底层引擎。这些节点涉及 WebCodecs/Canvas/离线音频上下文、外部库（如 ffmpeg.wasm / three.js）、大文件处理，边界崩溃风险高。本任务探查这些节点的容错与边界。

## 二、硬约束

- 读 `src/components/base/`：`videoEngine.js`、`videoApi.js`、`useVideoPoster.js`、`faceMosaic.js`，及节点组件 `src/components/VideoProcessNode.jsx`、`src/components/VideoExtractNode.jsx`、`src/components/PanoramaNode.jsx`、`src/components/FaceMosaicNode.jsx`、`src/components/director3d/`（`Director3DNode.jsx` 及 tsx/ts）。
- 不修改任何 `src/`。
- 不参考现有文档作结论来源。
- 每条结论附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位）

- `src/components/base/videoEngine.js`（已探：大量 `Math.max` 兜底、`loadVideoElement(url, timeoutMs=15000)` L344-360 有超时、gif 生成 `timeoutMs=30000` L388、`computePacketStats(...).catch(()=>null)` L107/L184/L231 吞错、`outputTarget.cancel().catch()` L335）。
- `src/components/PanoramaNode.jsx`（已探：`L110-115` try/finally + setTimeout 清 toast，疑似全景加载失败处理）。
- `src/components/VideoProcessNode.jsx`（65KB 大文件，抽帧/合并/extractAudio 等，产出 `mediaType:'audio'` 供管线）。
- `src/components/FaceMosaicNode.jsx` + `src/components/base/faceMosaic.js`（人脸检测/马赛克）。
- `src/components/director3d/`：3D 场景节点，three.js 相关。

## 四、覆盖清单（按维度）

1. **视频加载超时但生成无总超时**：`videoEngine.js L344` `loadVideoElement` 15s 超时，但 gif/视频生成整体 `timeoutMs=30000`（L388），若 `loadVideoElement` 完成后解码/编码卡死，生成 Promise 无整体超时 → 永久挂起，节点 loading 不结束。
2. **computePacketStats 吞错**：`videoEngine.js L107/184/231` `.catch(()=>null)`；若视频轨道统计失败返回 null，后续 `?? 0` 兜底 → 分辨率/帧率误判为 0 → 输出尺寸 `Sc(t.width ?? maxW)` 用错值，生成静帧/黑屏。
3. **不支持格式**：`videoEngine.js` 处理 mp4/webm/mov 等；若传入不支持编码的源（如 avi、或带特殊 codec 的 mp4），`VideoDecoder`/`VideoEncoder` 抛错，错误处理路径（L464+ `catch`）是否给用户明确提示还是静默留空节点。
4. **全景节点加载失败**：`PanoramaNode.jsx L110-115` try/finally + `setTimeout(()=>setToast(null),2500)`；全景图（大图/equirectangular）加载失败是否留空白节点、toast 2.5s 后消失用户看不到错误。
5. **人脸马赛克检测失败**：`faceMosaic.js` 人脸检测（可能依赖外部模型/库）失败时，马赛克节点是「全图打码」还是「不打码」还是「报错」？误判（漏检→隐私泄露 / 误检→破坏画面）。
6. **3D 导演节点资源泄漏**：`director3d/` three.js 场景在节点删除/unmount 时是否 `dispose()` 几何体/材质/renderer？不释放 → WebGL context 泄漏（浏览器限制 ~16 个 context，超量后全部黑屏）。
7. **大文件内存**：视频/全景大文件处理时是否分块，还是整文件读内存（ArrayBuffer 撑爆）→ 移动端/低端机崩溃。

## 五、输出规范

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | 生成无总超时 | `videoEngine.js` L344-364 `loadVideoElement` + L388/393 `videoToGif` L392 `timeoutMs=30000` + `VideoProcessNode.jsx` L759-922 `handleProcess` + `videoEngine.js` L178 `conversion.execute()` / L278 `samples()` / L325 `finalize()` | `function loadVideoElement(url, timeoutMs = 15000)`(L344)；`videoToGif` 入参 `timeoutMs=30000`(L392) 仅透传给 `loadVideoElement`(L393)，逐帧 `await seekVideo`(L427) 无整体时钟；引擎层 `processVideo` 仅 `await conversion.execute()`(L178)、`concatVideos` 真正逐帧死等在 `for await (const sample of source.samples(it.start, it.end))`(L278) 与收尾 `await outputTarget.finalize()`(L325)，均无顶层超时；`handleProcess`(L759-922) 调用处无 `setTimeout`/`Promise.race` 兜底 | 用户对一个解码卡死/超大视频点「开始处理」，`conversion.execute()` 内部死等（如某片段解码器挂起、磁盘/网络阻塞导致 `samples()` 永不 resolve） | `loading:true`(L798) 永远不结束，节点按钮置灰、取消按钮点 `controller.cancel()`(L914→L90-93) 但 mediabunny 未必响应 → 用户只能刷新页面，已写回 `data.loading` 的节点卡死态需手动清 | **已确认缺陷**（仅 GIF 有加载超时，trim/extractAudio/sizeFrameRate/concat 四大路径无总超时） |
| 2 | 统计吞错 | `videoEngine.js` L107 / L184 / L231 | `track.computePacketStats(120).catch(() => null)`(L107、L184、L231)；随后 `fps: Cc(stats?.averagePacketRate ?? 0)`(L114、L185)、`outFps = Cc(t.fps ?? stats?.averagePacketRate ?? 30)`(L242) | 某视频轨 `computePacketStats` 抛错（如轨道损坏/特殊封装），catch 静默返回 null → fps 兜底 0→`Cc` 回退 30(L38)；但 `readVideoMetadata` 里 `width/height` 来自 `getDisplayWidth/Height`(L105-106)、`concatVideos` 里 `maxW/maxH` 来自 `getDisplayWidth/Height`(L235-236)，均不在此 catch 内 | 单点统计失败被吞，fps 误判为 0 但被 `Cc` 兜底成 30，宽高走独立 `getDisplayWidth/Height` 返回真实值（L105-106/L235-236），故输出尺寸 `Sc(t.width ?? maxW)`(L240) 用的是真实宽高——当前不会黑屏/静帧。属「容错兜底」，仅静默丢失诊断信息；若未来 `?? 0` 扩散到 width/height 才会黑屏 | **设计权衡**（吞错+兜底并存，当前有 `Cc`/`Sc` 保护且宽高独立取值未直接黑屏，但静默丢失诊断信息） |
| 3 | 格式不支持 | `videoEngine.js` L100-102、L131、L173-176 + `VideoProcessNode.jsx` L73 `VIDEO_EXT` | `if (!(await input.canRead())) throw new Error('无法识别视频格式')`(L100/L131)；`if (!conversion.isValid) { throw new Error(reasons ? ... : '当前浏览器无法完成此处理') }`(L173-176)；节点侧 `VIDEO_EXT=/\.(mp4|webm|mov|mkv|avi|m4v|ogg)/i`(L73) 仅用于「连接源识别视频」，不做实际解码能力校验 | 传入 mediabunny 不支持的源（如带特殊 codec 的 mp4、浏览器 WebCodecs 不支持的 avi），`canRead` 或 `isValid` 失败 → 抛错被 `VideoProcessNode.jsx` L912-917 `catch` 捕获 → `fail(e.message)` 显示并 `showToast` | 错误路径**有显式用户提示**（不是静默留空）：节点 `errorMessage`(L1420-1425) 红字 + toast。但 `concatVideos` catch 在 L333-337 先 `outputTarget.cancel().catch()` 再 `throw t.controller?.isCanceled ? new ConversionCanceled() : e`(L337)——若用户在 finalize 卡死时点取消，最终抛 `ConversionCanceled` 被 `VideoProcessNode.jsx` L913 判为取消态清空 loading 无提示，与真实「处理失败」共用同一条取消分支，失败原因被吞 | **健康**（错误处理路径完整，有提示；瑕疵是取消态与失败态文案合并见维度1，且 L337 让 finalize 期的真实失败可能被误归为「取消」） |
| 4 | 全景加载失败 | `PanoramaNode.jsx` L110-115 + L57-120 `doCapture` + L251-293 渲染 + L255-260 `<img>` | `} catch { setToast('截图失败，请重试') }`(L110-111)；`finally { ...; setTimeout(() => setToast(null), 2500) }`(L112-115)；toast 渲染 L268-274 无 error 样式（与成功同款）；主显示区 `panoUrl? <img src={panoUrl} ...>`(L255-260) 直接渲染，`<img>` 无 `onError` 处理；占位 `: <div>等待输入全景图</div>`(L287-291) | ① 全景图 URL 失效/跨域/404：主区 `<img>` 加载失败无任何 onError 回调 → 主区静默空白（比截图失败更隐蔽，连 toast 都没有）；② 点击截图 `viewerRef.current.capture` 抛错 → catch 设 toast，但 2.5s 后 toast 自动消失(L115)，用户若没盯着屏幕错误不可见 | 主图加载失败完全静默（无提示、无占位错误态）；截图失败被「2.5s 自动消失的 toast」弱提示，无持久错误态、无重试入口；用户看不到失败原因，误以为「点过了但没反应」或「图丢了但界面正常」 | **已确认缺陷**（主图失败静默无提示 + 截图错误短命无 error 样式 + 无失败持久态） |
| 5 | 马赛克误判 | `faceMosaic.js` L33-48 `loadFaceDetector` + L51-59 `loadImage`(20s 超时) + L206-218 `detectFaces` + L225-273 `applyMosaic` + `FaceMosaicNode.jsx` L94-128 `handleAI` | `loadFaceDetector`(L33-48，单例，失败置空 L44 下次重试)；`loadImage` 带 `timeoutMs=20000`(L51-55) 超时；`applyMosaic` 检测 `detector.detect(img).detections`(L240) 逐框打码；`handleAI` 单图 `try{applyMosaic}catch{firstErr||=e.message}`(L106-113)，全部失败才 `setErrorMessage+showToast`(L116-120)，`faceCount===0` 仅 `showToast('未检测到人脸')`(L126)，部分失败有 `showToast('部分图片处理失败…')`(L127) | 模型加载失败（`loadFaceDetector` 抛错）→ `applyMosaic` 抛错 → `handleAI` 该图进 catch，不产出也不「全图打码」（非误检破坏画面）；漏检（模型没认出人脸）→ `faceCount=0`、不打码、toast「未检测到人脸」(L126) → 隐私泄露风险；误检（把背景当脸）→ 对无关区域打码破坏画面。`handleAI` 本身无总超时，多图串行累加可能长时间 loading | 失败路径是「报错/跳过」而非「全图打码」，**不会误破坏画面**；但漏检场景静默不打码 → 人脸隐私泄露（功能层面缺陷，非崩溃）。`minDetectionConfidence:0.4`(L41) 偏低，易误检；单图加载有 20s 超时但有兜底失败路径，不会永久挂起 | **设计权衡**（失败不破坏画面=健康；漏检不打码=隐私泄露风险=缺陷倾向，需在节点层面将 `faceCount===0` 的「未检测到人脸」升级为明确警告「未打码=隐私未保护」让用户确认） |
| 6 | 3D 资源泄漏 | `Director3DNode.jsx` L133 双击 + L155-165 `createPortal` + `DirectorCanvas.tsx` L683-760 `<Canvas>` + `SceneRoot.tsx` L339-370 `FbxModel/ObjModel` + `PanoViewer.jsx` L60-105 `capture` + `App.tsx` L31-172 `Director3DOverlay` + `captureBridge.ts` L474-475 | `Director3DOverlay` 经 `Director3DNode` 双击(L133)→`createPortal`(L155-165) 全屏挂载，内含 `<Canvas>`(DirectorCanvas L683-760)；r3f 在 `<Canvas>` unmount 时自动 `renderer.dispose()` + 场景图遍历 dispose（框架默认行为，**代码无显式 dispose 调用**）；`PanoViewer.capture` 正确 `target.dispose()`(L102)；`CanvasCaptureBridge` 注册全局 `setViewportCaptureHandler`(DirectorCanvas L474) 并在 useEffect cleanup `clearViewportCaptureHandler()`(L475，实现见 `captureBridge.ts` L19-21)；`FBXLoader`/`OBJLoader` 经 `useLoader` 缓存，`NormalizedImportedObject` 用 `object.clone(true)`(SceneRoot L341) | 反复双击打开/关闭 3D 导演台（L133 双击 → L155 portal），每次创建新 WebGL context；r3f 自动 dispose 会释放，但**浏览器硬限制 ~16 个 context**，若用户在 context 真正 GC 前高频开关、或低端机 context 创建慢，可能短暂超量 → 全部黑屏；`useLoader` 缓存的几何体/纹理卸载时由 r3f 释放，但跨开关不主动 `dispose` 旧资源 | 无手动 dispose 代码，完全依赖 r3f 自动释放——正常开关安全（健康），但缺少「context 数量上限保护/防抖」与显式资源释放，高频开关/大模型场景有泄漏窗口 | **设计权衡**（框架自动 dispose 覆盖主路径=健康；无显式资源治理+无开关防抖=潜在缺陷，建议在 `Director3DOverlay` unmount 加 `gl.dispose` 兜底与开关节流） |
| 7 | 大文件内存 | `videoEngine.js` L62-64 `xc` + L213 `xc(b)` 全输入驻留 + L245 `BufferTarget` + `VideoProcessNode.jsx` L843/861 `fetch(...).then(r=>r.blob())` + `PanoViewer.jsx` L25-42 `useTexture(url)` | `VideoProcessNode.handleProcess` 先 `await fetch(src).then(r=>r.blob())`(L843 拼接段、L861 单段) 整文件读入内存 Blob，再 `new Input({source:new BlobSource(blob)})`→`xc(b)`(videoEngine L62-64)；`concatVideos` 循环 `for (const b of blobs) inputs.push(await xc(b))`(L213) 把所有段 Blob 同时驻留后再逐段 `source.samples`(L278)；全景 `useTexture(url)`(PanoViewer L27) 一次性解码整张 equirectangular 大图，并在 L32-42 生成 mipmap 上 GPU 纹理 | 用户上传/连接 4K 长视频或多个大视频做 concat，所有段 Blob 同时驻留内存（L213 全收集后才处理）；或全景节点加载数 MB~数十 MB 等距全景图，整图解码 + mipmap 撑高峰值内存 | 移动端/低端机 OOM → 标签页崩溃或被系统杀进程；concat 多段时内存峰值=各段之和且持续至 L338 才 `dispose`，无分块流式/上限；全景无 `maxTextureSize` 降级，大图直接上 GPU | **已确认缺陷**（整文件读内存，无分块/流式/内存上限；全景无尺寸/分辨率降级） |

## 六、验收标准

- [x] 7 维度覆盖，附行号+片段。
- [x] 缺陷给触发场景→后果。
- [x] 区分缺陷/权衡/健康。
- [x] 末尾 Top 3。

## 七、铁律文件名

`docs/agent 批量任务/TASK-018-视频引擎与3D全景节点边界.md`

## 八、Top 3 薄弱点（按崩溃/隐私风险排序）

1. **生成无总超时（维度1）** — `processVideo`/`concatVideos` 依赖 mediabunny `conversion.execute()`(L178)/`samples()` 循环(L278)/`finalize()`(L325)，均无顶层超时；解码卡死时节点 `loading`(L798) 永久不结束，仅 GIF 路径有 `loadVideoElement` 15s + `videoToGif` 30s 超时。最贴近「节点 loading 不结束」的硬崩溃体验，应给 `handleProcess` 包一个 `Promise.race` 总超时（如 5~8 分钟）并统一取消/失败态文案（注意 L337 会让 finalize 期真实失败被误归为「取消」）。
2. **大文件内存（维度7）** — 视频/全景整文件读内存（`fetch().blob()` L843/L861、concat `xc(b)` 全收集 L213 / `useTexture` 全景整图解码 L27），concat 多段叠加、全景无 `maxTextureSize` 降级，移动端 OOM 风险最高。建议 concat 改流式逐段处理（边读边处理而非 L213 全收集）、全景按设备上限降级缩放。
3. **全景失败全静默（维度4）+ 马赛克漏检（维度5）** — 二者都是「失败但用户看不到/误以为成功」：主区 `<img>` 加载失败连 toast 都没有(L255-260 无 onError)；截图 toast 2.5s 消失无 error 样式(L110-115)；`faceCount===0` 仅轻提示「未检测到人脸」(L126) 却不强调「未打码=隐私未保护」。建议主图加 onError 占位红字、截图失败持久 error 样式+重试入口；马赛克在 `faceCount===0` 时明确警告「未打码」。

> 备注（探查边界）：维度6「3D 资源泄漏」经源码确认 **依赖 r3f 框架自动 dispose**（代码无显式 `renderer.dispose()`），但 `CanvasCaptureBridge`(DirectorCanvas L474-475) 正确 cleanup 了全局 handler、`PanoViewer.capture` 正确 `target.dispose()`(L102)；故判定为「设计权衡」而非硬缺陷，仅缺高频开关防抖与显式资源兜底。维度2「统计吞错」`computePacketStats().catch(()=>null)`(L107/184/231) 有 `Cc`(L38)/`Sc`(L34) 兜底且宽高走独立 `getDisplayWidth/Height`(L105-106/L235-236) 未直接黑屏，判定为设计权衡。维度3 格式不支持有完整错误提示链路（`errorMessage` 红字 + toast），判定健康（瑕疵见维度1 L337 取消/失败态合并）。
