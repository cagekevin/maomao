# ai-relay —— 12 个 API 中转的连接层（从 AI-Canvas-tauri 搬出）

> 来源：`/Users/kevin/Downloads/AI-Canvas-tauri` 的 `src/services/ai/*` + `src-tauri/src/lib.rs` 的 `proxy_fetch`。
> 目标：一个**可独立在 Node 运行**的模块，把 12 个 API 中转「接进来」并且「连得稳」。

## 为什么单独搬这一层

AI-Canvas-tauri 的「中转站」智能在**前端驱动层**，Rust 侧只是哑管道（`proxy_fetch`）。
光把 12 个目录名搬进来没用——真正决定「能不能连、连得稳」的是下面三道防线：
已经在 `ai-relay` 里完整复刻：

1. **地址兜底探测**（`providerBaseUrl.ts` → `baseUrlCandidates`）：用户只填根域名时自动补 `/v1`；剥掉误贴的 `/chat/completions` 端点。
2. **稳定 HTTP 客户端**（`httpTransport.ts` → `stableRequest`）：408/429/500/502/503/504 指数退避重试；429 遵循 `Retry-After`；响应体默认 **64MB 上限**；全程 `AbortSignal` 可取消。
3. **模型目录兜底**（`providerCatalogFetch.ts`）：`local-manifest` 供应商远程挂了也有内置清单；`openai-compatible` 供应商拉 `/models` 失败回退到本地清单。

## 目录结构

```
ai-relay/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # 公共入口：createRelay / listProviders / getProvider + 生成 API 再导出
│   ├── types.ts                # 共享类型（供应商目录 / 鉴权 / 声明式协议 / 流式事件）
│   ├── providerCatalog.ts      # 12 个中转 + 自定义接口的目录定义表（BUILT_IN_PROVIDER_DEFINITIONS）
│   ├── providerEndpoints.ts    # 各供应商默认 base URL 常量
│   ├── providerBaseUrl.ts      # 防线1：地址规范化 + 候选探测（normalizeBaseUrl / baseUrlCandidates）
│   ├── httpTransport.ts        # 防线2：稳定 HTTP 客户端 stableRequest + corsSafeFetch + 64MB 上限
│   ├── providerCatalogFetch.ts # 防线3：模型目录拉取 + local-fallback 兜底
│   ├── connection.ts           # 连接测试（connectionTestPath 优先）+ 余额查询原型 fetchBalance
│   ├── assistantStream.ts      # 流式/非流式 SSE 解析：parseStream / parseNonStream（逐 token/工具调用/UTF-8）
│   ├── manifests/              # local-manifest 供应商的内置模型清单
│   │   ├── xaiModelManifest.ts / googleModelManifest.ts / sora2uModelManifest.ts / runninghubModelManifest.ts
│   ├── protocol/               # 声明式调用协议引擎（配套支持核心）
│   │   ├── variables.ts        # 协议可引用变量白名单
│   │   ├── shared.ts           # 常量 + 同源/Header 校验 + 鉴权解析
│   │   ├── validation.ts       # 协议校验 + version1→2 升级 + submit 引用约束
│   │   ├── template.ts         # 模板渲染（$whenPresent / $forEach）
│   │   ├── body.ts             # 请求体序列化（json/form-urlencoded/multipart）
│   │   ├── request.ts          # 同源 URL 拼装 + Header/Body 渲染
│   │   ├── response.ts         # 响应路径抽取（url/text/base64/错误/进度）
│   │   ├── http.ts             # 错误抽取 + 同源结果下载 + Base64/PCM 解码
│   │   ├── pollTask.ts         # 通用异步轮询器
│   │   ├── poll.ts             # 异步协议轮询执行（瞬时错误/429 退避重试）
│   │   ├── engine.ts           # submitModelProtocol / executeModelProtocol（sync/async 分叉）
│   │   ├── presets.ts          # openai-chat / openai-image / agnes-video 预设
│   │   └── index.ts            # 引擎统一再导出
│   └── generate/               # 各模态「配套支持」入口（建立在 protocol/ 之上）
│       └── index.ts            # chat / streamChat / generateImage / generateVideo / generateAudio
└── test/
    ├── relay.test.mjs          # 离线冒烟测试（目录/连接/清单）
    └── relay.runtime.test.mjs  # mock 服务跑通文本/流式/图片/视频（异步提交+轮询）
```

## 12 个中转一览

| id | 名称 | 鉴权 | 目录适配器 | 备注 |
|----|------|------|-----------|------|
| apimart | APIMart | api-key | openai-compatible | |
| xai | xAI/Grok | api-key | local-manifest | 内置 5 模型 |
| google | Gemini | api-key | local-manifest | 内置 8 模型 |
| sora2u | Sora2U | api-key | openai-compatible | 固定 utm 查询参数 + `/api/v1/credits` 连通探测 |
| volcengine | 火山方舟 | api-key | openai-compatible | |
| runninghub-model | RunningHub | api-key | local-manifest | 内置 15 图片模型 |
| grsai | GRSAI | api-key | local-manifest | 原工程无内置清单（空，待补） |
| dreamina | 即梦 | **oauth** | local-manifest | 走 token，非 Bearer key |
| tavily | Tavily | api-key | local-manifest | web-search |
| bocha | 博查 | api-key | local-manifest | web-search |
| zhipu-search | 智谱搜索 | api-key | local-manifest | web-search |
| exa | Exa | api-key | openai-compatible? | web-search（实际 local-manifest） |
| custom-openai | 自定义接口 | api-key | openai-compatible | 用户自填 baseUrl |

## 快速使用

```js
import { createRelay } from 'ai-relay';

const relay = createRelay({ providerId: 'xai', apiKey: process.env.XAI_KEY });

// 1) 测连通（自动用 baseUrl 候选 + 64MB 上限 + 重试）
const test = await relay.testConnection();
console.log(test); // { ok: true, status: 200, resolvedBaseUrl: 'https://api.x.ai/v1' }

// 2) 列模型（local-manifest 离线即可；openai-compatible 拉远程 + 兜底）
const { models, source } = await relay.listModels();

// 3) 发请求（稳定请求：候选重试 + 429 退避 + 可取消）
const ac = new AbortController();
const { response } = await relay.request({
  method: 'POST',
  path: '/chat/completions',
  body: { model: 'grok-4.5', messages: [{ role: 'user', content: 'hi' }] },
  signal: ac.signal,
});
const data = await response.json();
```

## 配套支持：名单之外，真正「调得动」模型

光有目录 + 模型清单只是元数据。下面这些才是「这 12 个中转怎么被使用」的配套支持，
全部从 `modelProtocol*.ts` / `generateText|Image|Video|Audio.ts` / `streamParsers.ts` 忠实搬出：

```js
// ── 文本（非流式）──
const text = await relay.chat({
  model: 'grok-4.5',
  messages: [{ role: 'user', content: 'hi' }],
});

// ── 文本（流式，逐 token 事件）──
const full = await relay.streamChat({
  model: 'grok-4.5',
  messages: [{ role: 'user', content: 'hi' }],
  onEvent: (ev) => {
    if (ev.type === 'text.delta') process.stdout.write(ev.delta);
    if (ev.type === 'done') console.log('\n[完成]', ev.finishReason);
  },
});

// ── 图片：同步（默认走 OpenAI 兼容 /images/generations 预设 openai-image）──
//   也可传自定义 protocol；openai-image 预设为 mode:'sync'，一次返回 data.*.url。
const urls = await relay.generateImage({ model: 'dall-e-3', prompt: 'a cat', size: '1024x1024' });

// ── 图片：异步（任务型接口，如 RunningHub）──
//   这类厂商没有标准同步端点，走「提交拿 taskId → 轮询」。协议引擎已支持 async，
//   把 mode:'async' 的自定义协议传给 generateImage 即可（无需改生成引擎）。
//   注意：目前没有内置「异步生图」预设（openai-image 是同步），需按厂商文档写协议。
const asyncImageUrls = await relay.generateImage({
  model: 'nanobanana',
  prompt: 'a cat',
  size: '1024x1024',
  protocol: {                       // 示例字段按实际厂商文档替换
    version: 2,
    mode: 'async',
    submit: {                       // RunningHub：POST /openapi/v2/{endpoint}
      method: 'POST',
      path: '/openapi/v2/nanobanana/text-to-image',
      body: { prompt: '{{prompt}}', aspect_ratio: '1:1', resolution: '1k', size: '{{size}}' },
    },
    response: { type: 'json', taskIdPath: 'data.taskId', errorPath: 'msg' },
    poll: {                         // RunningHub 用 POST /query + body {taskId} 查询
      method: 'POST',
      path: '/openapi/v2/query',
      body: { taskId: '{{submit.data.taskId}}' },
      response: {
        statusPath: 'data.status',
        successValues: ['SUCCESS'],
        failureValues: ['FAILED'],
        errorPath: 'data.errorMessage',
        result: { urlPath: 'data.results.*.url' },
      },
      intervalMs: 3000,
    },
  },
});

// ── 视频（异步：提交拿 taskId → 轮询直到完成；须传自定义协议）──
const { url } = await relay.generateVideo({
  model: 'agnes',
  protocol: getModelProtocolPreset('agnes-video'), // 或自己的 { version:2, mode:'async', ... }
  variables: { prompt: 'a dog', frames8n1: 121, fps: 24 },
});

// ── 音频（同样异步，须传自定义协议）──
const { url: audioUrl } = await relay.generateAudio({
  model: 'tts', protocol: myAudioProtocol, variables: { prompt: 'hello', audioVoice: 'alloy' },
});
```

### 声明式协议引擎做了什么（`src/protocol/`）
- **请求体序列化** `body.ts`：json / form-urlencoded / multipart（含 `$file` data URL 与随机边界）。
- **模板渲染** `template.ts`：只认白名单变量；`$whenPresent` 条件项、`$forEach` 参考素材数组展开。
- **同源校验** `request.ts`：地址必须由连接 baseUrl + 相对路径拼出，禁止请求站外；API Key 不进模板。
- **同步响应** `engine.ts`（mode:'sync'）：text / binary / json，按点号路径抽取 url/text/base64，可选同源下载。
- **异步执行** `engine.ts`（mode:'async'）：提交拿 taskId → 注入 `{{submit.*}}` → 交 `poll.ts` 轮询；校验强制轮询的 path/query/body 必须引用 `{{submit.<taskIdPath>}}`。
- **异步轮询** `poll.ts`：按 statusPath 轮询，瞬时网络错误与 429 退避重试，支持进度/超时/取消。
- **结果解码** `http.ts`：错误文案按 errorPath 抽取；Base64/PCM 转 data URL；同源结果强制同域名下载。
- **校验** `validation.ts`：version 1 自动升级为 2；非法变量、危险 Header、越权路径在解析阶段即拦截。

## 运行测试

```bash
cd download/ai-relay && npm test
```

- `relay.test.mjs`：离线验证目录/连接/模型清单。
- `relay.runtime.test.mjs`：起本地 mock 服务，**真实跑通** chat / streamChat / generateImage / generateVideo，
  证明名单 + 连接层之上的「调用协议引擎」可用。

## 与原工程的差异 / 已知缺口

- **OAuth（即梦）**：`createRelay({ auth: { type:'oauth', token } })` 已预留接口，但 `token` 的获取
  （Rust 侧 `dreamina.rs` 的 OAuth 登录）需另行对接。
- **凭据存储**：原工程 `secret_store.rs` 的「白名单 + 逐条索取 + 禁止枚举」安全模型未搬；本模块只接收明文 key。
- **脱敏日志**：`transport.sanitizeHeadersForLog` 已搬脱敏工具，但未默认开启写盘日志（防 Key 落磁盘）。
- **参考素材图床上传**：原工程 `uploadService` 把参考图传到图床再给模型，本模块 Node 侧默认走 data URL / 直传，
  如某中转强制图床地址需另行接 `resolveImageUrlArray` 等价逻辑。
- **内置预设只有两个**：`openai-image`（**同步**生图）与 `agnes-video`（**异步**视频）。
  **没有内置「异步生图」预设**——任务型生图（如 RunningHub 的 `POST /openapi/v2/query` 轮询）没有单一
  标准端点可固化为 preset，须按厂商文档写 `mode:'async'` 的自定义协议传入 `generateImage`。
- **异步图片/视频的协议落地**：`runninghub-model` 等异步任务型中转目前在目录里已列出模型
  （`manifests/runninghubModelManifest.ts`），但「模型 → 协议」的绑定（每个模型不同提交 endpoint）
  尚未在 `presets.ts` 固化，需要调用方在 `generateImage/generateVideo` 时自行传入协议；后续可加一个
  「按模型名解析该中转协议」的生成器，替代现在的手传 protocol。
