# TASK-028 — 视频引擎 await 点枚举（R2 系统性根因：生成无总超时）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件。

---

## 一、项目背景
R2 系统性根因：异步操作无总超时导致「loading 永不结束」。我们已在 `asyncGuard.js` 建了统一 `withTimeout`（`src/components/base/asyncGuard.js`）。视频引擎（`videoEngine.js`，468 行，用 mediabunny）的 `processVideo`/`concatVideos` 依赖 `conversion.execute()`/`samples()` 等 mediabunny 内部 await，**无顶层总超时**，解码卡死时节点 `loading` 永不结束。本任务**只枚举**视频引擎所有会"死等"的 await 点 + 调用链，供后续用 `withTimeout` 包裹。

## 二、硬约束
只读核验。产出 = await 点清单（不是代码）。

## 三、探索起点（本次实际核实）
- `/Users/kevin/Documents/maomao/src/components/base/videoEngine.js`（468 行）
  - `readVideoMetadata` @ L97（`await xc(blob)` L98、`await input.canRead()` L100、`await input.getPrimaryVideoTrack()` L101、`await input.getDurationFromMetadata()`/track 方法 L103-108、`await input.computeDuration()` L109）
  - `processVideo` @ L127（`await xc(blob)` L128、`await input.canRead()` L131、`await input.getPrimaryVideoTrack()` L132/L133、`await Conversion.init(init)` L171、`await conversion.execute()` L178、`await input.getDurationFromMetadata()` L181、`await videoTrack.getDisplayWidth/Height` L182/L183、`await videoTrack.computePacketStats` L184）
  - `concatVideos` @ L208（`await xc(b)` L213、`await input.canRead()` L217、`await input.getPrimaryVideoTrack()` L218、`await v.getDurationFromMetadata()` L220、`await input.getPrimaryAudioTrack()` L227、`await items[0].video.computePacketStats` L231、`await it.video.getDisplayWidth/Height` L235/L236、`await outputTarget.start()` L265、`for await ... samples()` L278/L298、`await it.audio.getFirstTimestamp()` L294、`await it.audio.getSampleRate/Channel` L295/L296、`await videoSink.add(sample)` L286、`await audioSink.add` L316/L318、`await outputTarget.finalize()` L325）
  - `videoToGif` @ L391（`await loadVideoElement` L393 已有超时；`await seekVideo` L427 循环内；`await new Promise(setTimeout)` L434 循环内）
- 统一基建：`/Users/kevin/Documents/maomao/src/components/base/asyncGuard.js`（`withTimeout` L36、`isTimeoutError` L24、`TimeoutError` L15）
  - ⚠️ **关键约束**：`withTimeout` 当前实现（L36-47）超时后**只 reject `TimeoutError`，不调用任何底层 cancel**，且 `signal` 参数已声明（L36 第4参）但函数体内**从未 `abort(signal)`**（对比 L42-46 只用 `clearTimeout`，未监听 signal abort）。意味着单纯包 `withTimeout` 不会中断 mediabunny 解码，只是"放手"让 Promise 挂在那里 → 仍有资源泄漏风险。
- 节点入口：`/Users/kevin/Documents/maomao/src/components/VideoProcessNode.jsx`（`handleProcess` L759，调用 `processVideo` L873 / `concatVideos` L852 / `videoToGif` L806）。
  - `handleProcess` 内 `fetch(blob)` 已带 `abort.signal`（L843、L861），但 mediabunny 内部 await 无任何超时。

## 四、覆盖清单（await 点逐条枚举）

### 4.1 `readVideoMetadata`（L97-119）
| # | 函数 | 文件:行 | await 点 | 死等场景 | 是否已有超时 | 建议包裹位置 |
|---|------|---------|----------|----------|-------------|--------------|
| 1 | `readVideoMetadata` | videoEngine.js L98 | `await xc(blob)`（构造 `new Input`，内部读 Blob） | 损坏/超大 Blob 解析卡死 | 无 | 函数级总超时 `withTimeout(readVideoMetadata(blob), 30_000)` |
| 2 | `readVideoMetadata` | videoEngine.js L100 | `await input.canRead()` | 解码首帧挂起（容器可识别但流损坏） | 无 | 函数级总超时覆盖 |
| 3 | `readVideoMetadata` | videoEngine.js L101 | `await input.getPrimaryVideoTrack()` | 轨道枚举挂起 | 无 | 函数级总超时覆盖 |
| 4 | `readVideoMetadata` | videoEngine.js L103-108 | `await Promise.all([input.getDurationFromMetadata(), track.getDisplayWidth(), track.getDisplayHeight(), track.computePacketStats(120).catch(()=>null)])` | 元数据/包统计计算卡死 | 无（`computePacketStats` 有 `.catch` 兜底非超时） | 函数级总超时覆盖 |
| 5 | `readVideoMetadata` | videoEngine.js L109 | `await input.computeDuration()`（兜底，仅在 `getDurationFromMetadata` 返回 falsy 时走） | 全量解码时长卡死 | 无 | 函数级总超时覆盖 |

> 注：该函数由 `VideoProcessNode.jsx` L402 在 `useEffect` 内调用（读元数据），不在 `handleProcess` 主处理链；但**死等同样会导致该源元数据永远 pending**，建议单独包或随 `handleProcess` 之外另包。

### 4.2 `processVideo`（L127-200）
| # | 函数 | 文件:行 | await 点 | 死等场景 | 是否已有超时 | 建议包裹位置 |
|---|------|---------|----------|----------|-------------|--------------|
| 6 | `processVideo` | videoEngine.js L128 | `await xc(blob)` | 输入 Blob 解析卡死 | 无 | 函数级总超时 `withTimeout(..., 5*60*1000)` |
| 7 | `processVideo` | videoEngine.js L131 | `await input.canRead()` | 解码首帧挂起 | 无 | 函数级总超时覆盖 |
| 8 | `processVideo` | videoEngine.js L132 | `await input.getPrimaryVideoTrack()` | 轨道枚举挂起 | 无 | 函数级总超时覆盖 |
| 9 | `processVideo` | videoEngine.js L133 | `await input.getPrimaryAudioTrack()` | 音轨枚举挂起 | 无 | 函数级总超时覆盖 |
| 10 | `processVideo` | videoEngine.js L171 | `await Conversion.init(init)` | mediabunny 初始化/校验挂起 | 无 | 函数级总超时覆盖 |
| 11 | `processVideo` | videoEngine.js L178 | `await conversion.execute()` | **编码卡死（核心死等点）** | 无 | 函数级总超时覆盖（最关键的 5 分钟档） |
| 12 | `processVideo` | videoEngine.js L181 | `await input.getDurationFromMetadata()` / 兜底 `await input.computeDuration()` | 时长计算卡死 | 无 | 函数级总超时覆盖 |
| 13 | `processVideo` | videoEngine.js L182-183 | `await videoTrack.getDisplayWidth()` / `getDisplayHeight()` | 尺寸查询挂起 | 无 | 函数级总超时覆盖 |
| 14 | `processVideo` | videoEngine.js L184 | `await videoTrack.computePacketStats(120).catch(()=>null)` | 包统计卡死（有 .catch 非超时兜底） | 无 | 函数级总超时覆盖 |

> 进度回调 `conversion.onProgress`（L177）仅上报，不阻塞；`t.controller?.attach(conversion)` 已挂上控制器，用于用户取消（L172），但**无超时取消**。

### 4.3 `concatVideos`（L208-341，长循环最危险）
| # | 函数 | 文件:行 | await 点 | 死等场景 | 是否已有超时 | 建议包裹位置 |
|---|------|---------|----------|----------|-------------|--------------|
| 15 | `concatVideos` | videoEngine.js L213 | `for (const b of blobs) inputs.push(await xc(b))` | 某输入 Blob 解析卡死（逐个，循环） | 无 | 函数级总超时 `withTimeout(..., 按片段数×单段档位)` |
| 16 | `concatVideos` | videoEngine.js L217 | `await input.canRead()` | 解码首帧挂起 | 无 | 函数级总超时覆盖 |
| 17 | `concatVideos` | videoEngine.js L218 | `await input.getPrimaryVideoTrack()` | 轨道枚举挂起 | 无 | 函数级总超时覆盖 |
| 18 | `concatVideos` | videoEngine.js L220 | `await v.getDurationFromMetadata()` / 兜底 `await v.computeDuration()` | 时长计算卡死 | 无 | 函数级总超时覆盖 |
| 19 | `concatVideos` | videoEngine.js L227 | `await input.getPrimaryAudioTrack()` | 音轨枚举挂起 | 无 | 函数级总超时覆盖 |
| 20 | `concatVideos` | videoEngine.js L231 | `await items[0].video.computePacketStats(120).catch(()=>null)` | 包统计卡死 | 无 | 函数级总超时覆盖 |
| 21 | `concatVideos` | videoEngine.js L235-236 | `await it.video.getDisplayWidth()` / `getDisplayHeight()`（循环） | 尺寸查询挂起 | 无 | 函数级总超时覆盖 |
| 22 | `concatVideos` | videoEngine.js L265 | `await outputTarget.start()` | 输出初始化挂起 | 无 | 函数级总超时覆盖 |
| 23 | `concatVideos` | videoEngine.js L278 | `for await (const sample of source.samples(it.start, it.end))` **视频帧长循环** | 解码某帧卡死 → 整个拼接永不结束（最危险死等点） | 无 | **函数级总超时**即可，不打断每帧，只保证总时长上限 |
| 24 | `concatVideos` | videoEngine.js L286 | `await videoSink.add(sample)`（循环内） | 写入编码帧卡死 | 无 | 函数级总超时覆盖 |
| 25 | `concatVideos` | videoEngine.js L294 | `await it.audio.getFirstTimestamp()` | 音频首时间戳卡死 | 无 | 函数级总超时覆盖 |
| 26 | `concatVideos` | videoEngine.js L295-296 | `await it.audio.getSampleRate()` / `getNumberOfChannels()` | 音频参数查询挂死 | 无 | 函数级总超时覆盖 |
| 27 | `concatVideos` | videoEngine.js L298 | `for await (const sample of audioSource.samples(...))` **音频帧长循环**（仅非静音片段） | 音频解码某帧卡死 | 无 | 函数级总超时覆盖 |
| 28 | `concatVideos` | videoEngine.js L316 / L318 | `await audioSink.add(await Tc(buf))`（重采样后写入）/ 静音轨 `await audioSink.add(wc(it.duration))` | 音频重采样/写入卡死 | 无 | 函数级总超时覆盖 |
| 29 | `concatVideos` | videoEngine.js L325 | `await outputTarget.finalize()` | 封装 mp4 卡死 | 无 | 函数级总超时覆盖 |

> 异常处理已具备取消语义：L334-336 `catch` 内 `if (outputTarget && state not canceled/finalized) await outputTarget.cancel().catch(()=>undefined)`。这意味着**若 `withTimeout` 超时后能触发 `outputTarget.cancel()`，资源可释放**——但当前 `withTimeout` 不调用 cancel（见第三节铁律），需改造 `withTimeout` 或包裹层手动 cancel。

### 4.4 `videoToGif`（L391-444）
| # | 函数 | 文件:行 | await 点 | 死等场景 | 是否已有超时 | 建议包裹位置 |
|---|------|---------|----------|----------|-------------|--------------|
| 30 | `videoToGif` | videoEngine.js L393 | `await loadVideoElement(url, timeoutMs)`（`timeoutMs` 默认 30000，来自 `t.timeoutMs` L392；`loadVideoElement` 内部 `setTimeout` 15s 默认但被 `t.timeoutMs` 覆盖 L344/L393） | 视频元素加载/元数据就绪挂起 | **已有**（L344 `setTimeout` 拒绝 '视频加载超时'；时长由 `t.timeoutMs` 控制，默认 30s） | 无需包（局部已有） |
| 31 | `videoToGif` | videoEngine.js L427 | `await seekVideo(video, Math.min(time, end))`（逐帧 seek，`for` 循环 L425-435） | 某帧 `seeked` 事件永不触发 → 整段 GIF 卡死 | **无总超时**（仅每帧 `seeked` 无超时保护） | **需函数级总超时** `withTimeout(..., 60_000)`（按帧数×单帧预算） |
| 32 | `videoToGif` | videoEngine.js L434 | `await new Promise((r) => setTimeout(r, 0))`（让出主线程，逐帧） | 理论不卡，但依赖循环推进 | 无 | 随函数级总超时覆盖 |

> 要点：`videoToGif` 的 `loadVideoElement` 局部超时（30s）**只保护加载阶段**，逐帧 `seekVideo` 循环（L425-435）无总超时，解码卡死时 `loading` 永不结束。需确认并补充函数级总超时。

### 4.5 其他（非死等但相关）
- `uploadResult`（L455-468）：`await uploadFileToLocal`（L460）已自带网络超时（localTool 网关层），且有 try/catch 降级，不在本任务"解码死等"范畴，但理论上也可包总超时（非必需）。
- `Tc` 重采样（L51-59）：`ctx.startRendering()` 在 `concatVideos` L316 内被 await，已被函数级总超时覆盖。

---

## 五、超时档位与包裹位置建议

### 5.1 函数级 vs 局部 await 超时
- **统一建议在函数入口包 `withTimeout`**（而非每处 await），理由：
  1. mediabunny 内部 await 多为 C++/WebCodecs 底层，逐点包成本高且漏点多；函数级总超时一次覆盖全部内部 await。
  2. `concatVideos` 的 `for await` 长循环（L278/L298）只应保证"总时长上限"，不能每帧打断 → 函数级总超时天然契合。
  3. 用户取消已通过 `ProgressController`/`AbortController` 在 `handleProcess` 实现（VideoProcessNode L791-794、L1448-1451），超时语义应复用同一控制器。
- **局部 await 超时仅保留**：`videoToGif` 的 `loadVideoElement`（L344 已有）；`readVideoMetadata` 的 `computePacketStats` 已有 `.catch` 兜底（非超时，建议叠加函数级总超时）。

### 5.2 建议档位（生图/视频/拼接不同）
| 函数 | 建议总超时值 | 依据 |
|------|-------------|------|
| `readVideoMetadata` | `30_000`（30s） | 仅读元数据，非编码；卡死即坏文件 |
| `processVideo` | `5 * 60_000`（5min） | 单段编码/转码，长视频可能数分钟 |
| `concatVideos` | `blobs.length * 90_000`（每片段 90s，下限 `5min`） | 多段串行解码+编码，按片段数线性增长 |
| `videoToGif` | `60_000`（60s） | 逐帧 seek+编码，帧数受限（L421 `frameCount`），单帧预算 ~数十 ms |

### 5.3 建议包裹位置（具体文件+行号）
| 函数 | 包裹位置 | 代码层 |
|------|---------|--------|
| `readVideoMetadata` | `VideoProcessNode.jsx` L402 调用处包 `withTimeout(readVideoMetadata(blob), 30_000)` | 或直接在 videoEngine.js L97 函数体首行包 |
| `processVideo` | `VideoProcessNode.jsx` L873 `await processVideo(...)` → `await withTimeout(processVideo(blob, opts), 5*60*1000)` | 节点入口统一 |
| `concatVideos` | `VideoProcessNode.jsx` L852 `await concatVideos(...)` → `await withTimeout(concatVideos(blobs, {...}), blobs.length*90_000)` | 节点入口统一 |
| `videoToGif` | `VideoProcessNode.jsx` L806 `await videoToGif(...)` → `await withTimeout(videoToGif(currentUrl, {...}), 60_000)` | 节点入口统一 |

> 推荐在 `handleProcess` 内统一包（L802 `try` 块开头），而非改 videoEngine.js，保持引擎纯函数、超时策略在调用侧——符合「节点入口统一包总超时」要点。

### 5.4 取消语义与资源泄漏（铁律第四节第 4 点）
- `concatVideos` 已在 `catch` 内调用 `outputTarget.cancel()`（L334-336）；`processVideo` 通过 `t.controller?.attach(conversion)`（L172）可由外部 `controller.cancel()`（ProgressController L90-93）取消。
- **问题**：当前 `withTimeout`（asyncGuard.js L36-47）超时后**只 reject，不调用 `controller.cancel()` / `outputTarget.cancel()`**，也未 abort 传入的 `signal`。
  - 后果：超时后 Promise 被丢弃，但 mediabunny 的 `Conversion`/`Output` 仍在后台跑 → **WebCodecs 资源（GPU/内存）泄漏**，且节点 `loading` 虽因 `handleProcess` catch 被设回 false（VideoProcessNode L913-917），但底层解码线程未停。
- **修复方向（供后续任务，不在本任务修改）**：
  1. 改造 `withTimeout` 支持 `onTimeout` 回调 / 真正 abort signal；或在 `handleProcess` 包裹时，超时 reject 后**主动调用 `controller.cancel()`**（进程类）与 `abort.abort()`（fetch 类）。
  2. 对 `concatVideos` 可在 `withTimeout` reject 后捕获并触发 `outputTarget.cancel()`——但 `outputTarget` 是引擎内部变量，需引擎暴露取消句柄或统一经 `controller`。
  3. 最简稳妥：超时后 `abortRef.current?.abort()` + `controllerRef.current?.cancel()`（VideoProcessNode 已有 L1448-1451 取消逻辑复用），让 `ProgressController.cancel()`（L90-93）派发到 `conversion.cancel()`/`output.cancel()`。

---

## 六、输出规范（验收对应）
1. **完整 await 点清单**：覆盖 `readVideoMetadata`（#1-5）、`processVideo`（#6-14）、`concatVideos`（#15-29）、`videoToGif`（#30-32），共 32 个 await 点，均带 `videoEngine.js L行号` + 代码片段。
2. **每个函数**：已明确「已有/无总超时」——`videoToGif.loadVideoElement` 局部已有（#30），其余全部「无」；并给出建议总超时位置（文件+行号，见 5.3）与档位（见 5.2）。
3. **亲自核实代码**：行号均来自本次实际打开 `videoEngine.js`（468 行）、`asyncGuard.js`（70 行）、`VideoProcessNode.jsx`（1510 行）核实。

## 七、若在 handleProcess 统一包总超时，覆盖哪些函数（结论）
在 `VideoProcessNode.jsx` 的 `handleProcess`（`try` 块，L802 起）统一包 `withTimeout`，可覆盖：

- **`processVideo`**（L873 调用）→ 覆盖 #6-14（含核心死等点 `conversion.execute()` L178）。
- **`concatVideos`**（L852 调用）→ 覆盖 #15-29（含最危险长循环 `for await samples()` L278/L298）。
- **`videoToGif`**（L806 调用）→ 覆盖 #31-32（逐帧 `seekVideo` 循环 L427），#30（loadVideoElement）局部已有超时无需重复包。
- **不覆盖** `readVideoMetadata`（#1-5）：该函数在 `VideoProcessNode.jsx` L402 的 `useEffect` 元数据读取中调用，**不在 `handleProcess` 链内**，需单独包（建议同 L402 处 `withTimeout(..., 30_000)`）。
- **`uploadResult`**（L876）网络层：localTool 网关自带超时，可选包，非死等解码点。

> 统一包后的核心缺口（必须后续解决）：`withTimeout` 当前不触发 `controller.cancel()`/`outputTarget.cancel()`，超时仅"放手"不"取消"，存在资源泄漏。需按 5.4 改造或在包裹层超时后主动调用 `abortRef.current?.abort()` + `controllerRef.current?.cancel()`（复用 VideoProcessNode L1448-1451 取消逻辑）。

## 八、铁律文件名
本文件即唯一产出。写满后结束。
