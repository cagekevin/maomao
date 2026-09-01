# 可执行方案：彻底替换生成链路为 ai-relay-kit

> 状态：可执行（v1）
> 日期：2026-09-01
> 原则：**彻底抛弃现有生成链路（`proxyGenerate` / `*Api` / `providerProtocols` / `requestModes` / `resultUrlExtractor`），直接引用 kit，不做任何包装层。跑不通再按需把部分加回来。**
> 验证前置（本次实测已通过）：
> - kit `tsc --noEmit` 0 错误，68 个文件自洽完整
> - kit 零外部 npm 依赖（全部相对 import，无 `node:` 无第三方包）
> - kit 经 esbuild 打包后 `getModelProtocolPreset('openai-image')` 与 `executeModelProtocol` 真实加载运行成功（root 仓库已有 esbuild 0.21.5，打包 17ms）

---

## 0. 目标（一句话）

前端只发意图 `{providerId, capability, model, prompt}` → 一个 `/api/relay` 端点 → kit 的 `executeModelProtocol` 吃协议声明跑平台 → 返回结果。加新平台 = 加一份协议声明，几分钟。

---

## 1. 硬前置：统一语言到 bundler + esbuild（不做这一步 kit 跑不起来）

> **状态：✅ 已完成（2026-09-01，本次落地并验收通过）**

**这是 kit 能 vendor 进来的必要前提，不是可选优化。** 实测确认：kit 内部 import 是 `.js` 后缀裸引用指向 `.ts` 文件（`moduleResolution: bundler` 写法），**不能像现有 localTool 那样 `tsc && node dist/index.js` 裸跑**（直接 node import 会报 `Cannot find module schema.js`）。必须经 esbuild 打包。

### 1.1 改动（已落地）

`localTool/tsconfig.json`：
- `module: ESNext`（原 `Node16`）
- `moduleResolution: bundler`（原 `Node16`）
- `target: ES2023`（kit 用 `findLastIndex` 等 ES2023 特性）
- 另加 `noEmit` + `allowImportingTsExtensions`（esbuild 负责产出，tsc 纯做类型门禁）；删 `outDir/declaration/declarationMap/sourceMap`（不再由 tsc 发产物）

启动方式从：
```
tsc && node dist/index.js
```
改为：
```
tsc --noEmit && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js --sourcemap && node --enable-source-maps dist/index.js
```

`package.json` scripts（已改）：
- `build`: 上述 `tsc --noEmit && esbuild ... --sourcemap`
- `start` / `dev`: `node --enable-source-maps dist/index.js`
- `test`: `tsc --noEmit && node --test --import tsx test/*.test.js`（测试直接跑 `src/*.ts`，依赖 `tsx` 处理 `.js`→`.ts` 映射）

`launch-all.command`（mac 启动器，已改）：前台与 `nohup` 后台启动均加 `--enable-source-maps`。

### 1.2 附带必改（已落地，实测是 5 处非文档原记的 4 处）

esbuild `--bundle` 把模块塌成单文件后，**5 处**（含文档原记 4 处之外的 `agentChat.ts`，其为死代码直接删）`import.meta.url` 构造的 `__dirname` 相对层数变化，key 会丢。**已收敛为单一 `src/paths.ts`**（基于 `process.cwd()`，支持 `MAOMAO_ROOT`/`MAOMAO_ENV_FILE`/`MAOMAO_CONFIG_FILE` 覆盖）：
- `src/index.ts`：`.env` → `getEnvFile()`；前端 dist → `getFrontendDistDir()`；网关 `.env` → `getApimartGatewayEnv()`
- `./routes/providers.ts`：`.env` → `getEnvFile()`（key 真相源）；`api.config.json` → `getApiConfigFile()`
- `./router.ts`：baseline JSON → `getBaselinePath()`
- `./utils/logWriter.ts`：logs 目录 → `getLogsDir()`
- `./routes/agentChat.ts`：删死代码 `__dirname`（原未用，无路径归并）

新文件 `localTool/src/paths.ts`：`getRoot`/`getEnvFile`/`getApiConfigFile`/`getBaselinePath`/`getLogsDir`/`getFrontendDistDir`/`getApimartGatewayEnv`。

同步确认：launch 启动器 + `package.json` scripts 均已同步（**注意：文档原记 `launch-all.ps1:282` 应指 `launch-all.command`（macOS）与 `launch-all.ps1`（Windows）两处，本次改了 command，ps1 若存在需同步确认**）。

### 1.3 验收（本次实测全部通过）

- `tsc --noEmit` **0 错误**
- 起服务后真实读到 `.env` / `api.config.json` 路径正确，**key 不丢**（`/api/providers` 三个 provider 均 `has_key=True`）
- `npm test` **全绿（190 tests, 0 fail）**，测试改跑 `src/*.ts`
- `dist/index.js` 伴生 `.map`（3.6MB），`--enable-source-maps` 起服务堆栈指向源码
- esbuild 打包实测 52ms，`dist/index.js`（1.9MB）

---

## 2. vendor kit（完整拷，不做子集筛选）

把 `/Users/kevin/Downloads/ai-relay-kit/src/` **整个**拷进 `localTool/src/relay-kit/`。

```
localTool/src/relay-kit/
├── protocol/          ← executeModelProtocol / schema / variables / body / response
├── core/              ← transport / polling / stream-parser
├── types/
├── providers/         ← base-urls / catalog / manifests
├── generate/          ← text / image / video / audio / run
├── capabilities.ts / contract.ts / index.ts / relay.ts
├── docs/ / share/ / stations/ / upstream/ / deps/ / rust/   ← 整包拷，编译报错再剔
```

**不要做 §3.1 那种"子集筛选"**——既然彻底引用、不包装，就整包拷。多了的文件编译时不引用就不进产物，esbuild 会 tree-shake。

**不做适配层**：不写 `transport.ts` 桥、不写 `bridge.ts` key 注入、不写 `envelope.ts` 包装。kit 内部怎么用就怎么用，只加一个薄端点。

---

## 2.5 目标态架构：挪 kit 之后系统为什么更清晰

> kit 挪过来是手段，**架构变清晰是目的**。本节画清楚"挪之前 vs 挪之后"，让每个改动都有明确收益。

### 2.5.1 现状的"乱"（要消除的）

现在平台知识**散在三层、且前后端重复**：

| 层 | 现状 | 问题 |
|---|---|---|
| 前端 | `providerProtocols.ts`（拼 URL）、`requestModes.ts`（组 body）、`resultUrlExtractor.ts`（取字段）、`proxyGenerate.ts`（SSE/轮询） | 前端**越权**知道每个平台怎么请求、怎么取结果 |
| 后端 | `protocolAdapters.ts` + `providers.ts` 的 `resolveProviderTarget`/`effectiveProtocol` | 跟前端**镜像重复**一套适配器 |
| 网关 | 9004 自己又有一套 apimart 协议实现 | 又一个协议实现 |

**加一个平台 = 前端改 1 处 + 后端改 1 处（有时还动网关）= "改三处"**。这就是现状维护成本高的根源。

### 2.5.2 挪之后的"清晰"（目标态）

```
前端                               localTool                           平台
────                               ────────                            ──────
只发意图                           ├─ /api/relay (薄端点)            9004 / 魔搭 / 新平台
{providerId,                      ├─ relay-kit (通用协议引擎)       各平台各自协议
 capability,                       └─ presets (协议声明, 纯数据)
 model, prompt}                              ↑
                                   声明里写死: 怎么提交(§submit)
                                               怎么轮询(§poll)
                                               怎么取结果(§response)
```

三个让架构变清晰的核心点：

1. **意图与协议分离**：前端只表达"我要图/文本/视频"，**不知道任何平台细节**；平台细节全部收敛为 `presets` 里的**协议声明数据**，不在任何业务代码里。kit 的 `submit/poll/response` 三段就是平台的自描述，**声明即数据流**。

2. **加平台成本：改三处 → 改一处**：加新平台只需在 `presets` 加一份声明；前端零改动（只发意图）、后端零业务代码改动、网关不动（9004 本就是 apimart）。

3. **消除前后端重复适配器**：现有 `providerProtocols.ts` ↔ `protocolAdapters.ts` 两套镜像适配器**全部删除**，只剩一份"声明数据"。同类平台（如多个 openai-compatible）复用同一份声明，不重复写。

### 2.5.3 目录的"清晰"落点

```
localTool/src/
├── relay-kit/        ← vendored 通用引擎（不动，升级 cp -r 覆盖）
├── relay-presets.ts  ← 平台协议声明（唯一"平台知识"单一真相）
├── relay-route.ts    ← /api/relay 薄端点（唯一新增业务代码）
└── routes/           ← 其余现有路由（不再含平台协议逻辑）
```

> 判据：**"加一个平台，碰几个文件？"** 从现状的"前端+后端+可能网关三处"降到"只碰 `relay-presets.ts` 一处"。达到这一点，架构就是清晰的。

---

## 3. 薄端点 `/api/relay`

**核心：直接从 `protocol/executor` 调逃生舱 `executeModelProtocol`，绕过 kit 的 `index.ts` 门面（它 re-export 一堆无关模块）。**

```ts
// localTool/src/relay-route.ts —— 唯一新增的薄端点
import { executeModelProtocol, submitModelProtocol } from './relay-kit/protocol/executor';
import { readProviderKey, getProvider } from './routes/providers.js';
import { presets } from './relay-presets';   // §4 的协议声明表
import { json } from './utils/helpers.js';

// POST /api/relay  入参 { providerId, capability, model, prompt, stream, ...rest }
export async function handleRelay(req, res) {
  const body = await parseJsonBody(req);
  const provider = getProvider(body.providerId);
  if (!provider) return sendError(res, `Provider not found: ${body.providerId}`, 404);

  // 协议声明：capability → preset（见 §4）。拿不到就报配置错
  const protocol = presets[body.capability]?.[provider.id] || presets[body.capability]?.['default'];
  if (!protocol) return sendError(res, `No protocol for capability=${body.capability}`, 400);

  const conn = { apiKey: readProviderKey(provider.id), baseUrl: provider.base_url, protocol };
  const variables = { model: body.model, prompt: body.prompt, ...body.rest };

  // ── chat 流式分流（见 §4.3）──
  const wantStream = body.capability === 'chat' && body.stream !== false;
  const modelStreaming = provider.chat_models?.find((m) => m.id === body.model)?.streaming ?? false;
  if (wantStream && modelStreaming) {
    // 支持流式：submitModelProtocol 只提交，不读完整响应 → 拿原始 Response 逐块读 SSE 回写
    const submitted = await submitModelProtocol(conn);
    if (!submitted.urls && !submitted.text && !submitted.poll) {
      // sync + 流式：submitted 应含可流式消费的原始响应；此处由 /api/relay 自行解析 SSE
      await pipeSseToResponse(submitted, res);   // 解析 choices[].delta.content / output[].content[].text
      return;
    }
    // 异常兜底：落到下面非流式
  }

  // 非流式（或模型不支持流式）：executeModelProtocol 读完整 JSON
  const result = await executeModelProtocol({ ...conn, variables });
  // result: { urls?, text?, taskId? }
  return json(res, { code: 0, data: { url: result.urls?.[0], content: result.text, taskId: result.taskId } });
}
```

**要点：**
- key 真相源仍是现有 `readProviderKey`（`.env` 红线不动）
- `baseUrl` = `provider.base_url`（9004 = `http://127.0.0.1:9004`）
- `protocol` = 协议声明对象（§4），**纯数据**
- 返回 `{code,data}` 信封，兼容前端现有 `GenerationResult` 形状

**`pipeSseToResponse`（chat 流式）**：`submitModelProtocol` 返回后，从原始 `Response` 的 body 逐块读 SSE，解析 `choices[].delta.content`（chat/completions）与 `output[].content[].text`（responses），逐块 `res.write` 回前端，结束写 `data: [DONE]`。解析逻辑可直接复用现有前端 `readSseChatContent`（`proxyGenerate.ts`）的同款实现迁到后端。这是 chat 流式唯一新增的一段（约 40 行），非流式/其余能力不涉及。

**注册路由**：`router.ts` 的 `routes` 表加一行 `{ method:'POST', pattern:'/api/relay', handler: handleRelay }`，放在 catch-all 之前。

---

## 3.5 数据流契约（前端 ↔ `/api/relay` 的接口边界，落地前必须定死）

> 之前方案只画了方向，**没定请求/响应/错误/流式到底长什么样**。这节把前后端交互的所有契约钉死——前端 `relayProxy` 与后端 `handleRelay` 是同一份契约的两端，**先定契约再写代码**，避免各自拍板对不上。

### 3.5.1 请求契约（前端 → `/api/relay`）

```
POST /api/relay
Content-Type: application/json

body: {
  providerId: string,          // 必填，如 'lovart'（9004）
  capability: 'image'|'video'|'chat',   // 必填
  model: string,               // 必填，模型 id
  prompt: string,              // 必填（chat 无 prompt 时用 messages）
  stream?: boolean,            // chat 专用；缺省 false。true=要流式（模型支持才流）
  // 能力专属参数（透传给协议变量）
  size?: string,               // image/video：像素或比例
  messages?: ChatMessage[],    // chat：替换 prompt
  images?: string[],           // image：参考图（图生图），URL 或 base64
  taskId?: string,             // 前端贯穿 task_id（可选）
  // 预留：后续能力专属字段（resolution/duration 等）直接加，向前兼容
}
```

### 3.5.2 响应契约（`/api/relay` → 前端）

**非流式（image/video/chat 非流式）：**
```
200 { code: 0, data: { url?: string, content?: string, taskId?: string } }
     // url    → image/video 结果
     // content→ chat 文本结果
     // taskId → 异步任务 id（供前端恢复/关联，可选）

200 { code: -1, data: { error: string, stage: 'submit'|'poll'|'extract', providerId, capability } }
     // 业务错误：错误分类 + 阶段 + 定位字段（§7.5.3）

非 2xx: { error: string }   // 配置错/参数错（§7.5.3）
```

**chat 流式（`stream:true` 且模型支持流式）：**
```
200
Content-Type: text/event-stream

data: {"choices":[{"delta":{"content":"你好"}}]}
data: {"choices":[{"delta":{"content":"世界"}}]}
data: [DONE]
```
（SSE 行格式对齐 OpenAI 兼容，前端复用现有 `readSseChatContent` 同款解析）

### 3.5.3 前端 `relayProxy` 返回契约（前端内部）

```
非流式 → { ok:true, url?|content? } | { ok:false, error }
流式   → 透传 SSE 字节流，由调用方逐块消费（现有流式调用方逻辑不变）
```

### 3.5.4 变量契约（`/api/relay` → kit `variables`）

body 字段 → kit 协议变量的映射（§4 声明里 `{{变量}}` 的来源）：

| body 字段 | 映射到 kit 变量 | 说明 |
|---|---|---|
| `prompt` | `prompt` | |
| `model` | `model` | |
| `size` | `size` | 像素 `1024x1024` 或比例 `1:1` |
| `messages` | `messages` | chat |
| `images` | `imageUrls` | image 参考图（§7.2 验证） |
| `stream` | `stream` | chat |

**契约原则**：`/api/relay` 只做「body 字段 → kit 变量」的**平坦映射**，不解析平台语义。平台字段差异全在 §4 协议声明里吸收（如 9004 的 `image_urls` 由声明写死，前端不用知道）。

---

## 4. 9004 协议声明（`relay-presets.ts`，纯数据）

**9004 出图/出视频/chat 全部走异步 poll 形态**——实测确认 9004 的 `?wait=1` 同步 SSE 本质就是"异步提交 + 网关内部轮询 + SSE 包装"，直接用 kit 异步 poll 声明即可覆盖，不需要特判 SSE。

### 4.1 image（`/v1/images/generations`）

9004 异步返回 `{ data:[{ task_id }] }`，轮询 `GET /v1/tasks/{id}` 到 `completed`，结果 `data.result.images[0].url[0]`。

```ts
const LOVART_IMAGE = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST', path: '/images/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  response: { type: 'json', taskIdPath: 'data.0.task_id' },
  poll: {
    method: 'GET', path: '/v1/tasks/{{submit.data.0.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed', 'abort'],
      result: { urlPath: 'data.result.images.0.url.0' },
      errorPath: 'data.error.message',
    },
    intervalMs: 3000,
  },
};
```

### 4.2 video（`/v1/videos/generations`）

9004 异步返回 `{ id, status, task_id }`（对象形态，非数组）。轮询结果 `data.result.videos[0].url[0]`。

```ts
const LOVART_VIDEO = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST', path: '/videos/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  response: { type: 'json', taskIdPath: 'task_id' },   // 对象形态，直接用 task_id
  poll: {
    method: 'GET', path: '/v1/tasks/{{submit.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed', 'abort'],
      result: { urlPath: 'data.result.videos.0.url.0' },
      errorPath: 'data.error.message',
    },
    intervalMs: 3000,
  },
};
```

### 4.3 chat（`/v1/chat/completions`）

```ts
const LOVART_CHAT = {
  version: 2,
  mode: 'sync',
  streamFormat: 'openai-sse',
  submit: {
    method: 'POST', path: '/chat/completions',
    body: { model: '{{model}}', messages: '{{messages}}', stream: '{{stream}}' },
  },
  response: { type: 'json', result: { textPath: 'choices.0.message.content' }, errorPath: 'error.message' },
};
```

> **chat 流式策略（已拍板）**：**支持流式的模型走流式，不支持的自动退化非流式。**
>
> 实现要点：kit 的 `executeModelProtocol` 对 sync 是 `response.json()` 读完整 JSON（实测确认），**它不消费 SSE 流**。所以"流式"要落在 `/api/relay` 路由层——**用 kit 的 `submitModelProtocol`（只提交、不读完整响应）拿回原始 `Response`，由 `/api/relay` 自己消费 SSE 流**；模型不支持流式时走 `executeModelProtocol` 读完整 JSON。
>
> `/api/relay` 分流逻辑：
> ```
> 入参 { capability:'chat', model, stream:true|false|undefined }
>   ├─ 模型声明支持流式 且 前端要流式 →
>   │    submitModelProtocol() → 拿原始 Response
>   │    → /api/relay 逐块解析 SSE（choices[].delta.content / output[].content[].text）
>   │    → 逐块回写前端（复用前端已有 readSseChatContent 同款解析）
>   ├─ 否则（非流式 / 模型不支持）→
>   │    executeModelProtocol() → response.json() 读完整
>   │    → 返回 { content }
> ```
> 模型是否支持流式 = provider 模型列表的 `streaming` 字段（现有 `ProviderModel.streaming` 已存在）。

### 4.4 preset 表

```ts
export const presets = {
  image: { lovart: LOVART_IMAGE, default: LOVART_IMAGE },
  video: { lovart: LOVART_VIDEO, default: LOVART_VIDEO },
  chat:  { lovart: LOVART_CHAT,  default: LOVART_CHAT },
};
```

**加新平台 = 在对应 capability 下加一份协议声明**（provider.id 命中优先，否则 default）。前端零改动、零重启感知。

---

## 5. 前端改造（删旧链路，发意图）

### 5.1 删（或停止引用）

| 文件 | 动作 |
|---|---|
| `src/components/base/api/proxyGenerate.ts` | 删（含 SSE/轮询/错误分类/超时整套） |
| `src/components/base/api/imageApi.ts` / `videoApi.ts` / `chatApi.ts` | 改写为调 `relayProxy` |
| `src/components/base/providerProtocols.ts` | 删（URL 拼装下沉后端） |
| `src/components/base/requestModes.ts` | 删（body 构造下沉后端）；`parseResponsesSSEChunk`/`readSseChatContent` 流式解析逻辑**迁到后端** `/api/relay` 的 `pipeSseToResponse`（§3） |
| `src/components/base/resultUrlExtractor.ts` | 删（字段映射下沉后端） |

### 5.2 新增 `relayProxy.ts`

```ts
// 前端唯一意图入口
export async function relayProxy({ providerId, capability, model, prompt, ...rest }) {
  const res = await fetch(`${API_BASE}/api/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, capability, model, prompt, ...rest }),
  });
  const { code, data } = await res.json();
  return code === 0 ? { ok: true, url: data.url, content: data.content } : { ok: false, error: data?.error };
}
```

### 5.3 调用方替换

- `scriptbox/scriptBoxEngine.ts`、`agent/runtime/agentCore.ts`、`useAgentChat.ts`、`agentRuntime.ts`：生成调用入口替换为 `relayProxy`
- `src/types/provider.ts`：`GenerationProvider` 收窄为 `{id, name, capability}`（如需要）
- `ProviderForm.tsx`：删平台专属下拉，保留配置/选择

---

## 6. 执行顺序 + 验收（每步独立可验证）

| 步骤 | 内容 | 验收标准 |
|---|---|---|
> **顺序定案**：统一语言（A）是地基、第一步。① `submitModelProtocol` 返回形态、② vendoring import 图**依赖 A 的 bundler/打包环境**，紧跟 A 之后作为 B 的前置排雷；③ 9004 真实响应信封**不依赖语言**，可与 A 并行/先行抓包（直接决定 §4 声明字段，先抓省返工）。

| 步骤 | 内容 | 验收标准 |
|---|---|---|
| **前置（③）** | 并行/先行：`curl 127.0.0.1:9004` 发 image/video/chat 三次真实请求，抓回 `task_id/status/result` 真实信封 | §4 三份协议声明的字段/状态枚举（successValues/urlPath）照真实响应修正 |
| **A** | 统一语言（§1）：tsconfig 改 bundler + ES2023，启动加 esbuild，收敛 4 处路径 | ① `tsc --noEmit` 0 错；② 起服务 key 不丢；③ `npm test` 全绿 |
| **B** | vendor kit（§2）：拷 `src/` 进 `localTool/src/relay-kit/`；**前置排雷 ①②**：① 确认 `submitModelProtocol` 对 sync+流式返回什么（是否保留可消费原始 `Response`）；② esbuild 打包后实际 import 图里是否浏览器 API（`window/document/FileReader`）被拉入 | ① esbuild 打包后能 import `executeModelProtocol`，且 ① 结果决定 §4.3 chat 流式实现；② 与 localTool 同 tsc 0 错；③ vendoring 整包 vs 子集边界定死 |
| **C** | 薄端点 `/api/relay`（§3）+ 注册路由 | ① `curl POST /api/relay` 返回 `{code:0,data:{url}}`（连 9004 真跑一次 image） |
| **D** | 9004 协议声明（§4）：image/video/chat 三份 | ① curl 验证 image 出图、video 出视频、chat 出文本（连 9004 端到端） |
| **E** | 前端删旧链路（§5）：改 `relayProxy`、替换调用方 | ① 生成/聊天/视频正常；② 前端源码搜不到 `buildTargetUrl`/`extractResultUrl`/`openai://`；③ 加新平台前端零改动 |

> **回退策略（对应"跑不通再加回"）**：C/D 步若 kit 跑不通 9004，按能力回退——image/video 若跑不通则整体回老 `proxyGenerate`；chat 流式已按 §4.3 在 `/api/relay` 路由层自实现，若某模型流式消费异常，自动退化非流式（无需回老路由）。**回退是"加回某个能力"，不是推翻方案。**

---

## 6.1 执行检查点（Go / No-Go）——每个岔路必须停下来重规划

> 这是本方案最重要的补充：**A→E 是方向，中间有几个岔路，走到必须停下、把细节重新规划好再继续**，否则闷头做到 E 才发现方向错，返工成本爆炸。下面按执行顺序列出每个"必须停下来"的检查点，以及停下后要重新规划什么。

### 检查点 ①：A 步完成（统一语言）—— 最危险，一步错全盘错

**停下来验证：**
- `tsc --noEmit` 0 错（现有 localTool 全部代码在 bundler 下编译过）
- 起服务后 **key 真的没丢**（`.env`/`api.config.json` 读对），不能只信日志，要真发一次请求确认鉴权通过
- `npm test` 全绿（测试摆脱 dist 耦合）

**No-Go 触发（必须停下重规划）：**
- 4 处 `import.meta.url` 路径收敛后，**仍有任何一处读到错误的 key 或文件路径** → 停下，重新梳理所有运行时路径，不能带病进 B。
- esbuild 打包产物里有 **localTool 依赖的 Node 特有写法**（如 `__dirname` 裸用、`require`）在 bundler 下报错 → 停下，逐个修。

> **为什么必须停**：A 是地基。A 没打牢，B-E 全在流沙上。**此处 No-Go 不解决，绝不进 B。**

### 检查点 ②：B 步完成（vendor kit 编译通过）—— 暴露 kit 的隐藏依赖

**停下来验证：**
- kit 与 localTool **同一份 tsconfig 编译 0 错**（不是各自 tsconfig）
- esbuild 打包 `executeModelProtocol` 入口能加载运行（临时脚本跑通）

**No-Go 触发（停下重规划）：**
- kit 里有**浏览器专属 API**（`btoa/atob`/`DOMException` 在 Node 有的能用，但若出现 `window`/`document`/`FileReader` 等 Node 没有的）在打包时拉到 → 停下，决定：**剔该模块 / 加 Node polyfill / 换入口**（§7.4）。
- kit 依赖的某个子模块（如 `docs/`、`upstream/`）被核心链 import 拉到且无法在 Node 跑 → 停下，**重新划定 vendoring 边界**（§7.4：子集 vs 整包）。

> **为什么必须停**：这一步决定"kit 能不能在 localTool 里用"。**跑不通，后面 C/D/E 全是白做，必须先解决依赖再继续。**

### 检查点 ③：C 步完成（/api/relay 真跑一次 image）—— 协议引擎第一次被验证

**停下来验证（这是全案最关键的一次真实验证）：**
- `curl POST /api/relay`，连 9004，真出一张图，返回 `{code:0, data:{url}}`
- **key 注入正确**（`readProviderKey` 拿到 9004 的 key，网关鉴权通过）

**No-Go 触发（停下重规划）：**
- 9004 异步返回的**信封形态**与 §4.1 声明的 `taskIdPath: 'data.0.task_id'` / `result: data.result.images.0.url.0` **对不上** → 停下，**照 9004 真实响应重写协议声明**（这是纯数据调整，快，但必须先看清真实响应，不能猜）。
- 9004 异步轮询返回的**状态枚举**（`completed`/`failed`/`abort`/`running`…）与声明里的 `successValues` 不匹配 → 停下，核对 `main.py` 实际状态词。
- **`?wait=1` 同步 SSE 那条路**：如果决定同步也要，这里就得重新规划"同步 SSE 怎么进 kit"（§4.3 已选异步 poll，此处确认不再需要同步）。

> **为什么必须停**：C 是"kit 引擎 + 协议声明"第一次真机对撞。**协议声明写错，跑不通，是这里最可能发生的失败点。** 必须对照 9004 真实响应逐字段核对，重写声明，不能跳过。

### 检查点 ④：D 步完成（image/video/chat 三份声明全端到端）—— 三种能力全部验证

**停下来验证：**
- image 出图 ✅、video 出视频 ✅、chat 出文本 ✅（都连 9004 真跑）
- **chat 流式**：支持流式的模型走流式（`submitModelProtocol` 拿流），不支持自动退化非流式（§4.3）
- **参考图**（`image_urls` 图生图）能进变量、9004 接受

**No-Go 触发（停下重规划）：**
- **chat 流式这条路**（§4.3）：`submitModelProtocol` 对 sync+流式协议**实际返回什么**不是可消费的原始 `Response` → 停下，**重新设计 chat 流式实现**（换 `buildModelProtocolRequest` 拿 url+init 自己 fetch，或 kit 内改）。
- **参考图 / 专属字段**（`image_urls`/`size`/`resolution`/`ms_loras`）kit 的 `PROTOCOL_VARIABLES` 表达不了 → 停下，**扩展变量表**（§7.2，纯数据，低风险但必须先定）。
- 视频的**信封形态**（9004 视频返回 `{id, task_id}` 对象 vs 图片 `[{task_id}]` 数组）声明写错 → 停下，照真实响应重写（§4.2 已区分）。

> **为什么必须停**：D 是把"能出图"变成"三种能力全通"。**任一能力在此不通，都要停下单独解决，不能带着坏能力进 E（前端一旦切过去，问题会放大成用户可见的 bug）。**

### 检查点 ⑤：E 步前端切换前 —— 最后一道闸

**停下来验证：**
- 列出**所有**调用 `proxyGenerate`/`imageApi`/`videoApi`/`chatApi`/`providerProtocols`/`requestModes`/`resultUrlExtractor` 的地方（`scriptbox`/`agent`/`useAgentChat`/`agentRuntime`/各节点/设置页）**完整清单**，不能漏
- 决定 `GenerationProvider` 收窄为 `{id,name,capability}` 是否可行（依赖这些字段的 UI 要不要留）

**No-Go 触发（停下重规划）：**
- 发现**遗漏的调用方**（某节点/某流程还在用旧链路的内部函数）→ 停下，补进替换清单，**不能靠 grep 一次就删**。
- `ProviderForm.tsx` 上**平台专属字段**（`image_request_mode`/`chat_request_mode`/`image_mode`）如果还依赖前端知识 → 停下，**先想清这些字段在"意图化"后谁负责**，再删前端逻辑。
- **生图进度**（§7.3）：如果前端必须要实时进度，而当前 `/api/relay` 是等完成返回 → 停下，**先设计进度方案**（先返 taskId 前端轮询 / `/api/relay` 走 SSE）再切前端，不能切完才发现没进度。

> **为什么必须停**：E 是**唯一会碰前端、影响用户可见行为**的一步。**切前端前必须把所有细节定死，否则就是拿整个画布界面去赌。**

### 检查点 ⑥：E 步之后（灰度期）—— 观察，不急着删干净

**停下来观察：**
- 生成/聊天/视频在**真实使用**下正常（不是只 curl 通）
- **日志**能定位"这次走了 kit 还是老路"（若有双轨残留）

**No-Go 触发：**
- 某能力真实使用异常 → 停下，按 §6 回退策略**单独加回该能力**，不推翻整个方案
- 灰度稳定后，再清理 `proxyGenerate` 等死代码（§5.1）

---

## 7. 风险与待决项

1. **chat 流式（已拍板）**：支持流式的模型走流式，不支持的自动退化非流式。实现落在 `/api/relay` 路由层——用 `submitModelProtocol` 拿原始 `Response` 自行读 SSE；模型 `streaming=false` 或流式消费异常时退化 `executeModelProtocol` 读完整 JSON。**待验证**：`submitModelProtocol` 对 sync+流式协议实际返回什么（是否保留原始 `Response` 可消费），需 D 步连 9004 实测确认。
2. **参考图 / 专属字段**：`image_urls`（图生图）、`size`/`resolution` 等变量能否被 kit 的 `PROTOCOL_VARIABLES` 表达——kit `variables.ts` 已支持 `imageUrls`/`size`/`resolution`，应在 D 步连 9004 验证。
3. **进度回调**：现有前端生图有 progress（SSE 逐块推）。kit 异步 poll 能取 `data.progress`，但 `/api/relay` 当前设计是等全部完成才返回。**若前端要实时进度，`/api/relay` 需改成先返回 taskId 让前端轮询，或 /api/relay 也走 SSE。** 这是待定项，先按"等完成返回"跑通，进度后再补。
4. **vendoring 整包 vs 子集**：按"彻底引用"整包拷；若 esbuild 打包发现 `rust/`/`tauri-transport` 等带浏览器 API 的模块被核心 import 链拉到，报错再剔。实测核心链只用 `protocol/` `core/` `types/`。

---

## 7.5 横切关注点（贯穿所有步骤，落地前统一约定）

> 前面各节按"功能"分，本节按"横切"统一收口——**日志、错误、鉴权、超时、进度**这五件事在每个端点/每次请求都要处理，**必须先定规矩再写代码**，否则各自实现、事后难排障。

### 7.5.1 日志（并入现有 `[proxy]`/`[upload]`/`[agent-chat]` 体系，不另起炉灶）

`/api/relay` 用 `[relay]` 前缀，格式对齐现有：

```
[relay] ts | providerId=lovart capability=image model=gpt-image-2 stage=submit attempt=0 status=running | 200ms
[relay] ts | providerId=lovart capability=video model=seedance-2 stage=poll attempt=3 status=processing | 12s
[relay] ts | providerId=lovart capability=chat model=lovart-chat stage=extract status=succeeded | 3s
```

- **stage**：`submit`（提交）→ `poll`（轮询，异步才有）→ `extract`（取结果）→ `error`
- **status**：`running`/`processing`/`succeeded`/`failed`
- **attempt**：异步轮询第几次
- **必须记**：providerId + capability + model + stage，一次请求可串联定位（时间线）
- **脱敏**：绝不打印 key（现有红线延续）

### 7.5.2 错误分类（`/api/relay` 统一，带 stage）

kit 会抛 `ModelProtocolHttpError`（带 status/retryAfterMs）、轮询超时、完成未取到结果、异步未生成轮询配置等。**压成统一错误结构，前端能定位：**

```
{ code: -1, data: { error, stage, providerId, capability } }
```

错误分类表：

| 类别 | 触发 | stage | 示例 message |
|---|---|---|---|
| 配置错 | 缺 key / 缺 preset / provider 不存在 | submit | `Provider not found: xxx` / `No protocol for capability=image` |
| 上游 4xx | 参数 / 鉴权错 | submit/poll | `模型请求失败 (401): Invalid token` |
| 上游 5xx | 服务端错 | submit/poll | `模型请求失败 (500): ...` |
| 轮询超时 | `maxDurationMs` 到 | poll | `模型任务轮询超时` |
| 结果路径取不到 | 完成但字段对不上 | extract | `模型响应中未找到配置的结果` |

**原则**：`/api/relay` 保留 kit 原始 error 透传，**不压成笼统的"生成失败"**（否则前端排障瞎）。

### 7.5.3 鉴权（key 真相源不变）

- `/api/relay` **不做本地鉴权拦截**（它只服务前端本地画布，与现有 `/api/proxy` 一致，本地服务免鉴权）
- key 仍走 `readProviderKey(provider.id)`（`.env` 红线，**绝不落 json/绝不进日志**）
- 上游鉴权由 kit 注入（协议声明的 `auth` 或 bridge 层传 `apiKey`）

### 7.5.4 超时（三层，缺一不可）

| 层 | 默认 | 说明 |
|---|---|---|
| 整体请求 | 同现有 `PROXY_TIMEOUT`（5min） | `/api/relay` 外层，防挂死 |
| kit 轮询 | 协议声明的 `poll.maxDurationMs` / `maxAttempts` | 异步任务上限 |
| 单次 fetch | kit `core/transport` 内部 | 网络层 |

**流式 chat 特殊**：流式连接不能按"整体 5min"掐——要允许长流，但要有**空闲超时**（N 秒无数据即断，防僵尸连接）。

### 7.5.5 进度（生图/视频，先按"等完成返回"，方案预留）

- 当前设计：`/api/relay` 等 kit 全部完成才返回（非流式），**无实时进度**。
- **预留方案**（§7 风险3 待定）：需要进度时，`/api/relay` 改两种形态之一——
  - (a) 先返回 `taskId`，前端自己轮询 `GET /api/relay/status/{taskId}`（后端查 kit 轮询进度）
  - (b) `/api/relay` 也走 SSE，逐块吐 `{progress}`（对齐现有同步 SSE 形态）
- **判定**：前端生图/视频**是否真的必须实时进度条**。若现在能接受"等完成"，先不做；若不能，检查点⑤前必须先定。

---

## 8. 一句话总结

**A 步（统一语言）→ B 步（拷 kit）→ C 步（薄端点）→ D 步（9004 协议声明）→ E 步（前端删旧链路）。** 全程唯一新增代码 = 一个 `/api/relay` 端点 + 三份协议声明 + 一段 chat 流式解析（约 40 行）。加新平台 = 加声明。chat 流式：支持流式的模型走流式、不支持自动退化非流式。image/video 完整走 kit。
