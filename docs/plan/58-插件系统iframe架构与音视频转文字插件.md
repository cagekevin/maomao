# 58. 插件系统（iframe 架构）与音视频工具系列（ASR / 字幕 / TTS）

> 配套研究：《57-内容识别填充 inpaint 接入》（同一批"开源工具轻量化接入"决策）。
> 本文是**可交接规格书**：接手 AI 照 §9 骨架施工，按 §11 勾选。
> 音视频工具系列包含三个插件：**① 音视频转文字（ASR）**、**② 文字转 SRT 字幕**、**③ TTS 配音**。三者共用同一 iframe 插件架构，本期一次性把架构与三个插件的选型/翻车点定清。

---

## 1. 需求与架构决策（State 1 收口）

### 用户原话复述
- 现有两个顶层 tab：**画布**（canvas）、**多开**（accounts）。
- 要**新增第三个 tab「插件」**。
- 插件以 **iframe 形式**承载——即每个开源工具**独立构建成静态站点**，主应用用 `<iframe src="/plugins/<id>/index.html">` 嵌入。
- 音视频常用工具链（本期三个插件）：
  1. **音视频转文字（ASR）**：音频/视频文件 → 文字稿（+ 时间戳）。
  2. **文字转 SRT**：① 由 ASR 直接导出带时间戳的 SRT/VTT（whisper 自带）；② 独立轻量工具——已有纯文字稿（无时间轴）→ 自动切句配时间轴生成 SRT。
  3. **TTS 配音**：文字 → 语音音频（可导出 mp3/wav），用于给视频/幻灯片配音。
- 后续各类开源工具都按此模式塞进来（inpaint-web 等），形成"插件市场"。

### 架构选型结论
**插件 = 独立构建的开源 web app，build 产物放 `public/plugins/<id>/`，主应用 iframe 嵌入。**

| 维度 | 决策 | 理由 |
|---|---|---|
| 集成形态 | iframe 嵌入独立构建的静态站 | 开源工具（inpaint-web、whisper-web）多是 Vite/独立 app，**原样 build 即可，零改造**；避免把它们 React 组件化（成本高、易冲突） |
| 通信 | 初期**纯 iframe 自包含**（工具内部完成全部交互），暂不做 postMessage 跨域通信 | 第一个插件不需要主应用数据；后续若需"画布图片→插件处理→回画布"再开 postMessage 协议（见 §4.7） |
| 资源托管 | 模型/ wasm 全部**本地托管**于 `public/plugins/<id>/` 或 `public/models/`、`public/onnxruntime/` | 去 CDN 化（对标《53-错误处理静默与虚假审计》+ inpaint 翻车点 §4.4），内网/离线可用 |
| 失败可见 | 插件内部错误由插件自身 UI 呈现；主应用 iframe 容器提供"加载中/加载失败"兜底 | 禁止静默白屏 |

### 翻车点总览（详见 §4，先给结论）
1. **iframe 沙箱与同源/跨源**：插件产物在主应用同源（`/plugins/...`），无跨域问题；但 build 时若工具用了绝对路径资源会 404 → 必须 `base: './'`（相对路径）。
2. **browser-whisper 不是独立 app**：它是 npm 库，**无法直接 iframe**。两条路：① 用 `whisper-web`（独立 Vite app）fork 后 build；② 自写一个极薄宿主页包一层 browser-whisper。本文选 **①**（与 inpaint-web 同策略，可原样 build）。
3. **音频/视频解码**：视频要先抽音轨（Video → AudioContext/PCM），Whisper 只吃 16kHz 单声道音频；浏览器 `<video>`/`<audio>` + `MediaElementSource` 抽轨有 CORS/解码坑。
4. **长文件分窗**：Whisper 单段最长 ~30s，长音视频要切片 + 拼接 + 时间戳对齐。
5. **模型体积与缓存**：Whisper tiny ~75MB / base ~140MB，首次下载慢；必须 IndexedDB 缓存 + 进度条，禁止无反馈。
6. **去 CDN**：whisper-web 默认从 HF CDN 拉模型 + 从 jsdelivr 拉 transformers.js wasm → 改为本地 `public/` 托管（同 inpaint §4.4）。
7. **标签类型扩展**：`TopNav`/`App` 的 `view` 类型当前为 `'canvas' | 'accounts' | 'settings'`，加 `'plugins'` 需同步改类型注解（若有 TS）和渲染分支。
8. **iframe 高度/滚动**：插件站是整页应用，iframe 必须 `width:100% height:100%`，父容器要占满内容区（仿 `accounts`/`settings` 覆盖层）。

---

## 2. 现有接入点（已核实，防重复造轮子）

- `src/components/base/TopNav.jsx` L27-30：`tabs = [{key:'canvas',label:'画布'},{key:'accounts',label:'多开'}]`。**新增 `{key:'plugins',label:'插件'}`**。
- `TopNav` 的 `view` prop 类型（`'canvas'|'accounts'|'settings'`，L13）需扩展 `'plugins'`。
- `src/App.jsx` L1433-1436：整页覆盖层形态 `{view==='accounts' && <AccountsSettings/>}`、`{view==='settings' && <SettingsFrame/>}`。**仿此加 `{view==='plugins' && <PluginsFrame/>}`**。
- `App.jsx` 的 `view` state（L196 注释）与 `onNavigate` 回调——`plugins` 走同一套切换，无需新机制。
- 已有 `logger`（`src/components/base/logger.js`）、`asyncGuard.withTimeout`（`src/components/base/asyncGuard.js`）——插件内部若需日志/超时复用，但**插件是独立站，通常自带 console**；主应用层仅管 iframe 加载。

---

## 3. 第一个插件：音视频转文字（选型）

### 候选对比（已确认支持"文件转写"）
| 方案 | 文件转写 | 体积（首次） | 纯前端离线 | 中文 | 是否独立 app（可 iframe） | 许可证 |
|---|---|---|---|---|---|---|
| **whisper-web**（Xenova，fork） | ✅ | tiny 75MB / base 140MB | ✅ | ✅ | ✅ Vite app，可 build | MIT |
| browser-whisper（npm 库） | ✅ | 同级 | ✅ | ✅ | ❌ 需包宿主页 | 见 repo |
| vosk-browser | ✅（喂 PCM） | <50MB（中文小模型） | ✅ | ✅ | ❌ wasm lib，需宿主 | Apache-2.0 |

### 结论
**选 `whisper-web`（fork + 本地化 build）**。理由：
- 是**独立 Vite app**，可直接 `npm run build` → 产物丢 `public/plugins/asr/`，主应用 iframe 嵌，**零组件化改造**（最贴合你的"iframe 形式"）。
- Whisper 效果公认，中文 OK，纯前端离线（模型本地托管后）。
- 与 inpaint-web 同策略（fork 推理核心 + 本地化），团队已有经验。
- 比 browser-whisper（npm 库，要包宿主页）省一层；比 vosk（需喂 PCM，集成更复杂）省事。

> 若未来要更轻（<50MB），可换 vosk-browser 做第二个 ASR 插件，架构不变。

### 3.2 插件二：文字转 SRT（字幕）

**要点：SRT 不是独立模型，而是"带时间戳的文本输出格式"。** 它有两层含义，必须区分：

**(a) ASR 直接导出 SRT/VTT（首选，零新增工具）**
whisper 推理结果本身带 `segments[].start/end` 时间戳。whisper-web 原生支持导出 SRT / VTT / TXT。→ **本期 SRT 需求大部分由插件一（ASR）覆盖**，无需新插件，只需在 ASR 插件 UI 上加"导出格式：TXT / SRT / VTT"选项。

**(b) 纯文字稿 → 自动配时间轴（独立轻量工具，可选）**
场景：已有台词/文稿（无时间轴），要生成 SRT 给视频硬字幕。实现是**纯前端轻逻辑**：
- 切句（按标点/行）→ 估算每句时长（按字数 × 语速，或用户设定总时长均分）→ 生成 `00:00:01,000 --> 00:00:04,500` 格式。
- **不需要任何模型/wasm**，几十行 JS 即可，最适合做"独立极简 iframe 工具"（甚至无需 fork 外部 repo，自建一个 Vite 小站即可）。
**结论**：(b) 作为**独立自建插件** `srt-maker`，体积小、无模型依赖、纯前端。若优先级低，可暂缓，先靠 (a)。

### 3.3 插件三：TTS 配音（文字 → 语音）

| 方案 | 独立 app（可 iframe） | 模型体积 | 质量 | 中文 | 许可证 |
|---|---|---|---|---|---|
| **Kokoro-82M（ONNX）** | ❌ 需包宿主（如 `StreamingKokoroJS-tts`） | ~80MB | 优（2025-2026 端侧最佳之一） | ✅（含 zh 音色） | Apache-2.0 |
| **transformers.js + Xenova TTS**（`transformer-tts`） | ❌ 需包宿主 | 中 | 良 | ✅ | MIT |
| Coqui TTS / Bark | 重，需后端或超大 wasm | 大 | 优 | ✅ | MPL/Apache |

**结论：选 Kokoro-82M（ONNX）**，理由：
- 2025-2026 端侧 TTS **质量/体积比最佳**（82M 参数，效果接近大模型），中文音色可用。
- 纯前端 ONNX + onnxruntime-web（与 inpaint/whisper 同源技术栈，团队已熟）。
- Apache-2.0 友好（比 inpaint 的 GPL 省心）。
- **但它不是独立 app**：需 fork `StreamingKokoroJS-tts`（或自建极薄宿主页）包一层 → build → `public/plugins/tts/`。架构与 whisper-web 同款处理。

> 若想"零 fork 最省事"，可改用 `transformer-tts`（transformers.js + Xenova，MIT，同样需包宿主）。本期定 Kokoro 为推荐，施工时二选一。

---

## 4. 翻车点详解与对策

### §4.1 iframe 相对路径（base: './'）
whisper-web build 默认 `base: '/'`，产物里资源引用 `/assets/xxx.js`。放进 `public/plugins/asr/` 后，iframe `src="/plugins/asr/index.html"` 会让 `/assets/xxx` 404。
**对策**：fork 后改 `vite.config` 的 `base: './'`（或 `base: '/plugins/asr/'`）。**断言**：build 后 `index.html` 内资源引用为 `./assets/...` 相对路径。

### §4.2 whisper-web 本地化（去 CDN，对标 inpaint §4.4）
whisper-web 默认：
- 模型从 `https://huggingface.co/...` 拉；
- transformers.js wasm 从 `cdn.jsdelivr.net/npm/@xenova/transformers.js`。
**对策**：
- 模型：`git clone` whisper-web 后改其模型 URL 指向 `/models/whisper-tiny/...`（或让其保持 HF 但加本地代理）；最稳是**下载模型放 `public/models/whisper/<model>/`** 并改代码 URL。
- wasm：`npm i @xenova/transformers.js` 后把 dist wasm 复制到 `public/onnxruntime/` 或插件内，改 `env.wasm.wasmPaths`。
**断言**：断网环境下插件仍能加载模型+wasm（无外网请求）。

### §4.3 音频/视频解码（视频抽音轨）
Whisper 输入是 **16kHz 单声道 PCM**。视频（mp4）要先抽音轨：
- 浏览器方案：`<video>` + `AudioContext.createMediaElementSource` → 离线渲染/实时抽 PCM；或直接用 `ffmpeg.wasm` 抽轨（更稳但重）。
- 坑：`<video>` 跨域、解码权限、实时抽 PCM 的 `ScriptProcessor`/`AudioWorklet` 时序。
**对策（轻量优先）**：插件内用 `<audio>/<video>` 元素 + `MediaElementAudioSourceNode` + `AudioWorklet` 抽 16kHz mono PCM，喂给 whisper。若视频抽轨不稳，降级为"仅支持音频文件（mp3/wav/m4a）"，视频用 ffmpeg.wasm 抽轨作为增强。
**断言**：上传一个 mp4 → 能抽出音轨并成功转写文字；上传 wav → 直接转写。

### §4.4 长文件分窗（30s 切片）
Whisper 单段上限 ~30s。长音视频需切片 → 逐段推理 → 拼接 + 时间戳。
**对策**：插件内实现 `sliceAudio(pcm, 30s)` + 段间重叠（避免切词）+ `timestamps` 对齐拼接。
**断言**：>2min 音频转写结果与人工校对段落顺序一致、时间戳递增。

### §4.5 模型体积与进度（失败可见）
75~140MB 首次下载慢。whisper-web 有进度回调，必须**展示下载进度条**；模型 404 / 断网 → 超时（60s）+ UI 报错，**禁止白屏静默**（对标 inpaint §4.5 + 《53》）。
**对策**：复用 whisper-web 的 `progress_callback` 接 UI；外层 `withTimeout`（若移植到主应用层）或插件内 `setTimeout` 兜底。

### §4.6 标签类型扩展（view 增加 'plugins'）
`TopNav` 的 `view` 类型、`App` 的 `view` state 都要加 `'plugins'`。漏改会导致 TS 报错或导航不生效。
**对策**：全局搜 `view === 'accounts'` 同款分支，统一加 `plugins`；`tabs` 数组追加。

### §4.7 后续通信协议（本期不做，预埋）
若未来"画布图片节点 → 点开 inpaint 插件 → 处理完回填节点"，需主应用 ↔ iframe postMessage。本期 ASR 插件**纯自包含**，不实现。但在 `PluginsFrame` 预留 `<iframe onLoad onError>` + 未来 `postMessage` 监听位（注释标明），避免架构返工。

### §4.8 iframe 容器占满
插件站是整页应用。iframe 父容器须占满内容区（仿 `accounts`/`settings` 覆盖层 `absolute inset-0` 或 `flex-1`）。
**对策**：`PluginsFrame` 用 `flex flex-col h-full`；iframe `className="w-full flex-1 border-0"`。

---

## 5. 插件目录与资源落地

### 5.1 主应用改动
```
src/components/base/TopNav.jsx   # 【改】tabs 加 {key:'plugins',label:'插件'}；view 类型加 'plugins'
src/App.jsx                      # 【改】加 {view==='plugins' && <PluginsFrame/>}；view state 类型扩展
src/components/base/PluginsFrame.jsx  # 【新】左侧插件列表 + 右侧 iframe 容器
public/plugins/                  # 【放】各插件 build 产物
  asr/                           # whisper-web build 产物（base:'./'）
  srt-maker/                     # 自建极简站（纯前端，无模型）或并入 asr 导出（§3.2）
  tts/                           # Kokoro-82M 宿主页 build 产物（base:'./'）
public/models/whisper/           # 【放】whisper-tiny 模型（本地化，§4.2）
public/models/kokoro/            # 【放】kokoro-82m-v1.0 ONNX（本地化，§3.3）
public/onnxruntime/              # 【放】transformers.js / onnxruntime-web wasm（去 CDN）
```

### 5.2 插件源（fork）
```bash
git clone --depth 1 https://github.com/xenova/whisper-web.git _try_asr          # 插件一 ASR
git clone --depth 1 https://github.com/therealtimex/StreamingKokoroJS-tts.git _try_tts  # 插件三 TTS（Kokoro）
# 插件二 srt-maker：自建 Vite 小站，无需 fork（§3.2-b）
```
需本地化文件（参考 inpaint-web 同款处理）：
- `vite.config` → `base: './'`（§4.1，ASR/TTS 都需）
- ASR：模型 URL → `/models/whisper/...`；transformers.js wasm → `env.wasm.wasmPaths = '/onnxruntime/'`（§4.2）
- TTS：Kokoro ONNX URL → `/models/kokoro/...`；onnxruntime-web wasm → `env.wasm.wasmPaths = '/onnxruntime/'`（§3.3）
- `npm run build` → 产物分别复制到 `public/plugins/asr/` 与 `public/plugins/tts/`

### 5.3 资源
| 资源 | 动作 | 位置 |
|---|---|---|
| whisper-tiny 模型 | 从 HF（`Xenova/whisper-tiny`）下载，或浏览器跑一次后从 IndexedDB 导出 | `public/models/whisper/tiny/` |
| @xenova/transformers.js wasm | `npm pack` 取 dist | `public/onnxruntime/` |
| whisper-web build | fork 后 build（base:'./'） | `public/plugins/asr/` |
| kokoro-82m-v1.0 ONNX | 从 HF（`onnx-community/kokoro-82m-v1.0` 或 `therealtimex` 仓库）下载 | `public/models/kokoro/` |
| Kokoro 宿主页 build | fork `StreamingKokoroJS-tts` 后 build（base:'./'） | `public/plugins/tts/` |
| srt-maker 站 | 自建 Vite 小站（纯前端切句配轴，无模型） | `public/plugins/srt-maker/` |

---

## 6. State 2：可验证断言（验收用）

- **A. tab 注册**：点击「插件」→ `view==='plugins'`，`PluginsFrame` 渲染，画布被覆盖（仿 accounts）。
- **B. iframe 加载**：`/plugins/asr/index.html`（及 tts/srt-maker）返回 200，页面内资源（`./assets/...`）全部 200（验证 §4.1 相对路径）。
- **C. 离线可用**：断网后插件内模型/wasm 仍从 `public/` 加载成功，无外网请求（验证 §4.2）。
- **D. 文件转写（ASR）**：上传 wav/mp3 → 输出文字稿；上传 mp4 → 抽出音轨后输出文字稿（验证 §4.3）。
- **E. 长文件**：>2min 音频转写段落顺序正确、时间戳递增（验证 §4.4）。
- **F. 失败可见**：模型 URL 404 / 断网且未缓存 → 60s 内 UI 报错，无永久白屏（验证 §4.5）。
- **G. 无静默**：插件内无 `catch(()=>{})`、无 `alert` 抹错；错误进 UI 状态（对标《53》）。
- **H. SRT 导出**：ASR 结果可导出 SRT/VTT，时间戳格式正确（`00:00:01,000 --> 00:00:04,500`）；srt-maker 能将纯文字稿生成 SRT（验证 §3.2）。
- **I. TTS 配音**：输入中文文本 → 输出可播放/下载的语音音频（wav/mp3），音色正常、无爆音（验证 §3.3）。
- **J. TTS 离线**：断网后 Kokoro 模型/wasm 从 `public/` 加载成功（验证 §3.3 去 CDN）。

---

## 7. State 3：施工骨架

### 7.1 TopNav 改动
```jsx
const tabs = [
  { key: 'canvas', label: '画布' },
  { key: 'accounts', label: '多开' },
  { key: 'plugins', label: '插件' },   // 新增
]
// props 类型：view: 'canvas' | 'accounts' | 'settings' | 'plugins'
```

### 7.2 App 改动
```jsx
{view === 'accounts' && <AccountsSettings />}
{view === 'settings' && <SettingsFrame />}
{view === 'plugins' && <PluginsFrame />}   // 新增（整页覆盖层，仿上）
```

### 7.3 PluginsFrame（新）
```jsx
// 左侧插件列表（可扩展，本期 only asr），右侧 iframe 占满
export default function PluginsFrame() {
  const [active, setActive] = useState('asr')
  const PLUGINS = [
    { id: 'asr', name: '音视频转文字', path: '/plugins/asr/index.html' },
    { id: 'srt', name: '文字转SRT', path: '/plugins/srt-maker/index.html' },
    { id: 'tts', name: 'TTS配音', path: '/plugins/tts/index.html' },
  ]
  return (
    <div className="absolute inset-0 flex bg-canvas z-plugins">
      <aside className="w-48 border-r border-edge p-2 flex flex-col gap-1">
        {PLUGINS.map(p => (
          <button key={p.id} onClick={() => setActive(p.id)}
            className={active===p.id ? 'bg-white text-black ...' : 'text-secondary ...'}>
            {p.name}
          </button>
        ))}
      </aside>
      <main className="flex-1 relative">
        {/* §4.7 预埋：onLoad/onError + 未来 postMessage 监听 */}
        <iframe src={PLUGINS.find(p=>p.id===active).path}
          className="w-full h-full border-0"
          title="plugin-asr"
          onError={() => showToast('插件加载失败', { type: 'error' })} />
      </main>
    </div>
  )
}
```

### 7.4 whisper-web 本地化（fork 内改）
```js
// vite.config.js
export default { base: './' }   // §4.1

// 模型/env 初始化处
env.wasm.wasmPaths = '/onnxruntime/'                    // §4.2
const modelUrl = '/models/whisper/tiny/model.onnx'       // §4.2 本地模型
```

---

## 8. 交付检查清单

- [ ] `TopNav` 出现「插件」tab，点击切换到 `PluginsFrame`，画布被覆盖
- [ ] `public/plugins/asr/index.html` 可访问，内部资源相对路径全部 200（§4.1）
- [ ] 断网环境下插件模型/wasm 从 `public/` 加载成功（§4.2）
- [ ] 上传 wav/mp3 → 输出文字稿
- [ ] 上传 mp4 → 抽音轨后输出文字稿（§4.3）
- [ ] >2min 音频转写段落顺序 + 时间戳正确（§4.4）
- [ ] 首次下载模型有进度条；404/断网 60s 内报错无白屏（§4.5）
- [ ] 插件内无静默 catch / alert 抹错（§4.5/《53》）
- [ ] iframe 占满内容区，无滚动条异常（§4.8）
- [ ] 后续 postMessage 通信位已预埋注释（§4.7）
- [ ] ASR 可导出 SRT/VTT，时间戳格式正确（§3.2-a）
- [ ] `public/plugins/srt-maker/index.html` 可访问；纯文字稿能生成 SRT（§3.2-b）
- [ ] `public/plugins/tts/index.html` 可访问；中文文本 → 可播放/下载语音（§3.3）
- [ ] TTS 断网后 Kokoro 模型/wasm 从 `public/` 加载成功（§3.3 去 CDN）
- [ ] 许可证提示：whisper-web MIT；Kokoro Apache-2.0；若 ASR 换 vosk 为 Apache-2.0

---

## 9. 给接手 AI 的最后一句话

这是** iframe 插件系统**的第一个插件（音视频转文字）。核心难点不是 ASR 算法，而是：
1. **iframe 相对路径**（§4.1）——build 必须 `base:'./'`，否则资源 404；
2. **去 CDN 本地化**（§4.2）——whisper-web 默认拉 HF/jsdelivr，必须改成本地 `public/`；
3. **视频抽音轨**（§4.3）——Whisper 只吃 16kHz mono PCM，mp4 要先抽；
4. **失败可见**（§4.5）——模型大、下载慢，必须进度条 + 超时报错，禁止白屏静默（对标《53-错误处理》）。

架构上：新增「插件」tab 仿 `accounts`/`settings` 的整页覆盖层；插件是独立 build 的静态站，主应用 iframe 嵌，**零组件化改造**。按 §7 骨架写，按 §8 勾选。

> 注：本文第一个插件选 `whisper-web`（独立 app 可 iframe）。若你更想用 `browser-whisper`（npm 库），则需在 `public/plugins/asr/` 写一个极薄宿主页引用该库，其余架构不变——但优先 whisper-web 以贴合"iframe 原样嵌入"诉求。
