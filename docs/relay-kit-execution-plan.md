# 可执行方案：彻底替换生成链路为 ai-relay-kit

> 状态：A 步（统一语言）✅ 已落地并提交；B~E 步待执行
> 日期：2026-09-01（A 步落地 2026-09-01 提交 54278c4）
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

同步确认（2026-09-01 核实）：`launch-all.command`（macOS）两处已加 `--enable-source-maps`（L199/L206）；**`launch-all.ps1:282`（Windows）仍是 `node dist/index.js`，缺 `--enable-source-maps`——未同步，待补**。注意：`--enable-source-maps` 只影响运行时堆栈定位，**不影响功能**，Windows 端可后补。

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

**不要做"子集筛选"**（旧方案 §3.1 那种按需挑模块）——既然彻底引用、不包装，就整包拷。多了的文件编译时不引用就不进产物，esbuild 会 tree-shake。

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

3. **消除前后端重复适配器**：现有 `providerProtocols.ts` ↔ `protocolAdapters.ts` 两套镜像适配器，其**「端点半断言 + apimart/openai URL 拼装」**下沉为 §4 声明数据（同类平台复用同一份声明）；但**协议清单/CLI 分支（jimeng/codex/gemini-cli，不走 /api/proxy）/前缀吸收工具 `joinWithPrefixAbsorb`** 是前端仍要的通用能力，按 §5.0 **保留**，不是一刀切全删。

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
import { resolveLocalImages } from './utils/resolveLocalImages.js';   // 复用：/files/ → base64
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

  // 参考图归一：对 body 跑 resolveLocalImages，把本机 /files/ URL 内联成 base64（data: 幂等透传）。
  // 复用现有后端实现（架构红线：唯一出站口），禁止另写一套。见 §3.5.4 / §5.0.5。
  const resolvedBody = await resolveLocalImages(body);

  const conn = { apiKey: readProviderKey(provider.id), baseUrl: provider.base_url, protocol };
  const variables = { model: resolvedBody.model, prompt: resolvedBody.prompt, ...resolvedBody.rest };

  // ── chat 流式分流（见 §4.3）──
  const wantStream = body.capability === 'chat' && body.stream !== false;
  const modelStreaming = provider.chat_models?.find((m) => m.id === body.model)?.streaming ?? false;
  if (wantStream && modelStreaming) {
    // 支持流式：submitModelProtocol 只提交，不读完整响应 → 拿原始 Response 逐块读 SSE 回写
    // ⚠️ 必须带 variables（SubmitModelProtocolOptions 要求 {apiKey, baseUrl, protocol, variables}），否则模板变量取不到值
    const submitted = await submitModelProtocol({ ...conn, variables });
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
- **参考图归一**：先 `resolveLocalImages(body)` 把本机 `/files/` → base64（复用现有后端实现，`data:` 幂等透传），再喂 kit——否则本机图到不了 9004/外部平台（§3.5.4 / §5.0.5）
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
| `images` | `imageUrls` | image 参考图（§7.2 验证）；**⚠️ 必须经后端 `resolveLocalImages` 把 `/files/` 内联成 base64 再喂 kit**（见下） |
| `stream` | `stream` | chat |

**契约原则**：`/api/relay` 只做「body 字段 → kit 变量」的**平坦映射**，不解析平台语义。平台字段差异全在 §4 协议声明里吸收（如 9004 的 `image_urls` 由声明写死，前端不用知道）。

> ⚠️ **`images` 变量是唯一的非平坦点——必须挂后端 `resolveLocalImages`**（§5.0.5）：
> - 前端 `normalizeImageUrlsForSend` 只归一了 `blob:/data:`（浏览器内存态）；**本机已落盘的 `/files/` URL 由后端 `localTool/src/utils/resolveLocalImages.ts` 负责**（读 uploads → Jimp 压缩≤1920 → base64，`data:` 幂等透传不二次压）。
> - `/api/relay` 在 `executeModelProtocol`/`submitModelProtocol` 之前，**必须对 `body.images`（或整份 body）跑一次 `resolveLocalImages`**，否则本机图 → 9004/外部平台读不到 → 图生图静默退化成文生图。
> - **禁止在 `/api/relay` 里另写一套**——直接复用 `resolveLocalImages`（架构红线：唯一出站口，见 `resolveLocalImages.ts:19`「消费方禁止各写一份」）。

---

## 4. 9004 协议声明（`relay-presets.ts`，纯数据）

> **本节字段不是"从零抓包猜的"，而是直接复用现有跑通链路里已经沉淀的真实响应知识反填的。** 9004 三层代码（网关 `apimart-gateway/main.py` / localTool `system.ts` / 前端 `proxyGenerate.ts`+`pollTask.ts`+`resultUrlExtractor.ts`）就是"真实响应信封"的单一真相源，字段路径与状态枚举均已实测跑通过，比 curl 再抓一次更权威。**凡是本节声明的字段，都能在上述代码里找到对应出处**（已逐条标注）。

**9004 出图/出视频/chat 全部走异步 poll 形态**——实测确认 9004 的 `?wait=1` 同步 SSE 本质就是"异步提交 + 网关内部轮询 + SSE 包装"，直接用 kit 异步 poll 声明即可覆盖，不需要特判 SSE。

> ⚠️ **状态枚举铁律（网关 `main.py` 对外改写，声明必须照此填）**：
> - 网关对**外部**返回的状态只有 4 种：`completed` / `failed` / `processing` / `pending`（`main.py:838/850/853/856/892`）。
> - Lovart 原始 `running` 被网关**改写为 `processing`**（`main.py:852`），**对外不返回 `running`**。
> - Lovart 原始 `abort` 被网关**改写为 `failed`**（`main.py:855`，error.message="生成被中止"），**对外不返回 `abort`**。
> - 所以声明里 `successValues=['completed']`、`failureValues=['failed']`，**绝不能再写 `abort`/`running`**（写了永远匹配不到）。

### 4.1 image（`/v1/images/generations`）

9004 异步返回 `{ code:200, data:[{ status:'submitted', task_id }] }`（**数组形态**，`main.py:1345` + `system.ts:312`），轮询 `GET /v1/tasks/{id}` 到 `completed`，结果 `data.result.images[0].url[0]`。

```ts
const LOVART_IMAGE = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST', path: '/images/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  // taskIdPath：图片 data 是数组 [{status,task_id}] → 下标 0 取 task_id（网关 main.py:1345 / localTool system.ts:312）
  response: { type: 'json', taskIdPath: 'data.0.task_id' },
  poll: {
    method: 'GET', path: '/v1/tasks/{{submit.data.0.task_id}}',
    response: {
      // statusPath 走网关 {code,data} 信封的 data.status；对外只出现 completed/failed/processing/pending
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed'],   // 网关把 abort 改写为 failed，不能写 abort
      result: { urlPath: 'data.result.images.0.url.0' },   // 对应 resultUrlExtractor.ts image 分支
      errorPath: 'data.error.message',                     // 对应 pollTask.ts:82
    },
    intervalMs: 3000,
  },
};
```

### 4.2 video（`/v1/videos/generations`）

9004 异步返回 `{ code:200, data:{ id, status:'submitted', task_id } }`（**对象形态，非数组**，`main.py:1345` + `system.ts:313`）。轮询结果 `data.result.videos[0].url[0]`。

```ts
const LOVART_VIDEO = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST', path: '/videos/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  // taskIdPath：视频 data 是对象 {id,status,task_id} → 直接用 task_id（网关 main.py:1345 / localTool system.ts:313）
  response: { type: 'json', taskIdPath: 'task_id' },   // 对象形态，直接用 task_id
  poll: {
    method: 'GET', path: '/v1/tasks/{{submit.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed'],   // 网关把 abort 改写为 failed，不能写 abort
      result: { urlPath: 'data.result.videos.0.url.0' },   // 对应 resultUrlExtractor.ts video 分支
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
  // textPath：choices.0.message.content 对应前端 proxyGenerate.ts:340 chat 分支（读 {code,data} 信封内 data.choices）
  response: { type: 'json', result: { textPath: 'choices.0.message.content' }, errorPath: 'error.message' },
};
```

> ⚠️ **chat 响应信封待实测确认（见 §6 前置③ 唯二缺口之一）**：现有 `chatProxy` 经 localTool `/api/proxy` 转发后读 `(json?.data ?? json)?.choices[0].message.content`（`proxyGenerate.ts:340`），说明网关 chat 大概率也走 `{code,data}` 信封。但**网关 chat 是否像 image 一样支持 `?wait=1` 同步 SSE** 未在现有代码确认（chatProxy 是直读完整 JSON/SSE，没走网关 wait 分支）——这是声明里 `textPath` 是否要带 `data.` 前缀的关键，D 步连 9004 实测一次确认。

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

### 5.0 删之前先盘点：这些文件里的"通用能力"不能随 9004 平台知识一起删

> **核心原则：本方案删的是「9004 平台协议知识」（URL 拼装 / 请求形态 / 响应字段映射），但同文件里混着的「通用能力」（尺寸表 / 类型判定 / 工具调用 / 错误降级 / 参考图归一）是跨平台、跨协议都要用的，删了就丢能力，还得在后端重新实现一遍——那就违背了"复用沉淀不推倒重来"的初衷。** 逐一盘点：

| 文件 | 9004 平台知识（可下沉/删） | 通用能力（**必须保留/迁移**） | 去留 |
|---|---|---|---|
| `resultUrlExtractor.ts` | §4 已沉淀的字段映射（`result.images[0].url` 等） | `classifyUrl`/`resolveMediaType`（按扩展名/mime 判图片/视频/音频）——**画布节点渲染、`useConnectedInputs` 同源依赖**，与"走不走 relay"无关 | **⚠️ 保留**，别删。§4 只是把字段映射**抄一份**进后端声明，前端类型判定仍要它 |
| `imageApi.ts` | `image_request_mode` 4 形态 → 端点 | `resolveImagePixel` + `RATIO_PIXEL_TABLE`（比例×档位→精确像素查表，复刻官方）——**relay 的 `size` 变量要它把 `16:9`+`2K` 转 `2048x1152`** | **保留 `resolveImagePixel`**，改壳为调 `relayProxy`；平台形态分支删 |
| `requestModes.ts` | `imageModePath`/`resolveChatMode`（responses vs chat 端点半断言） | `buildResponsesChatBody`/`buildResponsesInput`/`buildResponsesImageBody`/`parseResponsesChatJson`/`parseResponsesSSEChunk`/`normalizeToolCalls`/`friendlyRequestError`（responses 协议完整实现 + 工具调用归一 + 错误中文降级提示）——**这些是 OpenAI responses 协议的通用实现，9004/魔搭/新平台都可能有** | **⚠️ 保留 responses 协议部分**，端点半断言下沉后端；`friendlyRequestError` 错误降级是前端 UX，别删 |
| `proxyGenerate.ts` | `buildTargetUrl`/`pollUntilDone` 的 9004 轮询 / SSE 字段读取 | **错误分类**（`classifyError`/`parseNestedError`）、**超时治理**（`withTimeout`/`GEN_TIMEOUT`/`CHAT_TIMEOUT`）、**进度映射**（`30+progress*0.6` 单调递增）、`readSseChatContent`（chat SSE 解析）——**这些正是 §7.5 横切关注点要重新定义的，删了等于先扔掉再重造** | **⚠️ 迁移到 `/api/relay` 后端**（错误/超时/进度/SSE 解析正是 §3 的 `pipeSseToResponse` + §7.5 要的），不是"删" |
| `providerProtocols.ts` | `buildTargetUrl`/`joinWithPrefixAbsorb` 的 URL 拼装 | **`joinWithPrefixAbsorb`（前缀吸收工具）**、`PROVIDER_PROTOCOLS`/`GENERAL_PROTOCOLS`/`SPECIAL_PROTOCOLS`/`CLI_PROTOCOLS`/`FIXED_PROTOCOL_PROVIDER_IDS`/`PROVIDER_PROTOCOL_LABELS`、CLI 协议分支（`cli://` jimeng/codex/gemini-cli）——**CLI 协议不走 `/api/proxy`，本方案"意图化"根本没覆盖** | **⚠️ 保留协议清单 + CLI 分支 + `joinWithPrefixAbsorb`**；`buildTargetUrl` 的 apimart/openai 拼装可下沉 |
| `chatApi.ts` | `resolveChatMode` 端点半断言 | `attachImages`/`toImageContentBlocks`（把参考图附加到最后一条 user 消息、转 `image_url` 块）、`ChatMessage`/`ChatContentBlock` 类型——**relay 的 `images` 变量映射要它** | **保留 `attachImages`/`toImageContentBlocks`**，改壳调 `relayProxy` |
| `videoApi.ts` | `videos/generations` 提交 | `generateVideo` 的 genBody 组装（`size`/`resolution`/`duration`/`image_urls`）——**relay video 声明的变量来源** | **保留 genBody 组装**，改壳调 `relayProxy` |

**一句话**：真正该"删/下沉"的只有——各文件的**端点半断言**（image/video/chat 走哪个 path）、**URL 拼装**（apimart/openai base_url 拼接）、**9004 响应字段映射**（已抄进 §4）。其余全是通用能力，**要么保留要么迁移到后端 `/api/relay`，不是删除**。

### 5.0.5 能力不退化映射表（铁律：删任何能力前，必须确认 relay 化后有人兜住它）

> **最高原则：删文件没问题，但能力零退化。** 下面把每个现有能力按「现在谁做 → relay 化后谁兜住」逐条钉死。**凡映射为"待设计/❌ 缺失"的，E 步切换前必须先补上，否则不许删。** 这张表就是 E 步验收（§6 E 验收 ③④）的唯一依据。

| 能力 | 现在谁做 | relay 化后谁兜住 | 状态 |
|---|---|---|---|
| 尺寸换算（比例×档位→像素） | `imageApi.resolveImagePixel` | **保留**在前端，`relayProxy` 先把换算好的 `size` 传给 `/api/relay` | ✅ 保留 |
| 参考图发送归一（blob→base64 / 压缩） | **前后端各做一套（非冗余，刻意分工，`MAX_SEND_DIM=1920` 契约双写）**：① 前端 `imageUrl.normalizeImageUrlsForSend` 压 **`blob:`/`data:`**（浏览器内存态，canvas/FileReader，**只能在浏览器跑**）；② 后端 `localTool/src/utils/resolveLocalImages.ts` `resolveLocalImages` 读 **`/files/`** 磁盘图 → Jimp 压缩 ≤1920 → base64 内联（**只能在 Node 跑**，因为 /files/ 浏览器读不到、必经 localTool 唯一出站口） | **两套都保留**：前端 `normalizeImageUrlsForSend` 归 `blob/data`；**新增 `/api/relay` 必须复用后端 `resolveLocalImages` 对 body 做 `/files/`→base64**（`data:` 幂等透传不二次压，`resolveLocalImages.ts:9-13`） | ✅ 保留（**双套缺一不可**，relay 薄端点必须挂上后端 `resolveLocalImages`，否则 9004/外部平台收不到本机 `/files/` 图） |
| 参考图附加到 user 消息 | `chatApi.attachImages`/`toImageContentBlocks` | **保留**在前端，或 relay 化后后端按 `images` 变量重新组装 | ✅ 保留 |
| 结果类型判定（图/视频/音频） | `resultUrlExtractor.classifyUrl`/`resolveMediaType` | **保留**在前端（画布节点依赖） | ✅ 保留 |
| responses 协议（body 构造/解析/SSE/工具调用） | `requestModes.*` | **保留**（responses 是通用协议，非 9004 专属） | ✅ 保留 |
| 错误中文降级提示 | `requestModes.friendlyRequestError` + `genErrors.classifyError` | **保留** `friendlyRequestError` 在前端；`/api/relay` 透传 kit 原始 error，前端再降级 | ✅ 保留（§7.5.2 需补：透传后仍走 `friendlyRequestError`） |
| 错误分类（abort/timeout/network/http/business） | `genErrors.classifyError` | **保留** `classifyError` 在前端，对 `/api/relay` 返回的 `{code:-1,data.error}` 再分类 | ⚠️ 待设计（§7.5.2 需补一句"前端沿用 classifyError"） |
| 超时（image 5min / chat 2min / 总超时） | `proxyGenerate` 的 `withTimeout`/`GEN_TIMEOUT`/`CHAT_TIMEOUT` | `/api/relay` 后端三层超时（§7.5.4）；**前端仍要等超时兜底** | ⚠️ 待设计（§7.5.4 需确认前端保留 withTimeout） |
| 生图/视频**实时进度**（0-100 单调递增 + 阶段文案） | `proxyGenerate` 的 `30+progress*0.6` + SSE 逐块推 | **现状 `/api/relay` 是等完成返回，无实时进度**（§7 风险3 已承认） | ❌ **真退化点**：若前端要进度，E 步前必须先定（§7.5.5 方案 a/b），否则切了就没进度条 |
| **取消（AbortSignal）** | image/video/chat 都透传 `signal` 支持中途取消 | **§3.5 契约里根本没提取消**——`/api/relay` 没有 AbortController 透传 | ❌ **真退化点**：E 步前必须在 `/api/relay` 契约加"前端 abort → 后端中断"（SSE 关闭/连接断开即中断 + 前端 AbortController），否则用户没法取消生成 |
| 视频强制异步 + 刷新恢复 | `videoApi` + `pollTask`（`pollTaskId` 落库恢复） | **保留** `pollTask`（它查 `/api/v1/gateway/task`，与 relay 无关）；relay 化后**提交需返回 taskId 落 `pollTaskId`**（§3.5.2 已有 taskId 字段） | ⚠️ 待设计（确认 relay 异步提交必返 taskId 并落库） |
| CLI 协议（jimeng/codex/gemini-cli） | `providerProtocols` CLI 分支 + 前端 CLI 通道 | **本方案"意图化"未覆盖 CLI**（CLI 不走 `/api/proxy`） | ⚠️ 待设计（要么保留 CLI 老链路，要么 relay 加 CLI capability，**不能静默丢**） |

> **判据**：表中任何一行是"❌ 真退化"或"⚠️ 待设计"且未解决 → **该能力不可删/不可切**，E 步 No-Go。只有整表全部 ✅ 或已补设计，才允许按 §5.1 去留清单执行。

### 5.1 去留清单（按 §5.0 盘点修正）

| 文件 | 动作 |
|---|---|
| `src/components/base/resultUrlExtractor.ts` | **保留**（`classifyUrl`/`resolveMediaType` 类型判定是画布节点依赖）；仅字段映射在 §4 后端声明里冗余 |
| `src/components/base/api/imageApi.ts` | 保留 `resolveImagePixel`/`RATIO_PIXEL_TABLE`；改写为调 `relayProxy`，删平台形态分支 |
| `src/components/base/api/videoApi.ts` | 保留 genBody 组装；改写为调 `relayProxy` |
| `src/components/base/api/chatApi.ts` | 保留 `attachImages`/`toImageContentBlocks`/类型；改写为调 `relayProxy` |
| `src/components/base/api/proxyGenerate.ts` | **不删**，错误/超时/进度/SSE 逻辑**迁移到后端** `/api/relay`（§3 `pipeSseToResponse` + §7.5）；前端调用方改走 `relayProxy` |
| `src/components/base/providerProtocols.ts` | 保留协议清单 + CLI 分支 + `joinWithPrefixAbsorb`；`buildTargetUrl` 的 apimart/openai 拼装下沉后端 |
| `src/components/base/requestModes.ts` | 保留 responses 协议部分（`buildResponsesChatBody` 等）+ `friendlyRequestError`；端点半断言下沉后端 |

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

> **顺序定案**：统一语言（A）是地基、第一步，**已落地并提交（2026-09-01，commit 54278c4）**，不再列入待执行表。① `submitModelProtocol` 返回形态、② vendoring import 图**依赖 A 的 bundler/打包环境**，作为 B 的前置排雷；③ 9004 响应信封**不依赖语言、也不依赖 curl**——直接复用现有跑通链路里已沉淀的字段知识（见 §4 开头）。

| 步骤 | 内容 | 验收标准 |
|---|---|---|
| **前置（③）** | **读三层代码反填 §4 声明**（不再 curl 从零抓包）：`apimart-gateway/main.py`（提交形态 1341-1346 / 状态枚举 980-995 / 终态结果 982-988）+ `localTool/src/routes/system.ts`（extractAndPersistThreadId 311-317）+ 前端 `proxyGenerate.ts`/`pollTask.ts`/`resultUrlExtractor.ts`（消费端字段）。**仅两处代码里没有、需连 9004 实测**：① 网关 chat 是否走 `{code,data}` 信封 / 是否支持 `?wait=1`（决定 §4.3 textPath 是否带 `data.`）；② kit `submitModelProtocol` 对 sync+流式返回形态（见 B 步排雷①） | §4 三份协议声明的字段/状态枚举（successValues/urlPath）**已逐条对照现有代码标注出处**；仅剩的两处待实测缺口单独列明 |
| **A（✅ 已完成）** | 统一语言（§1）：tsconfig 改 bundler + ES2023，启动加 esbuild，收敛 4 处路径 → **已在 commit 54278c4 落地并验收** | ✅ 通过：`tsc --noEmit` 0 错 / key 不丢 / `npm test` 190 绿。**遗留**：`launch-all.ps1:282` 缺 `--enable-source-maps`（Windows，不影响功能） |
| **B** | vendor kit（§2）：拷 `src/` 进 `localTool/src/relay-kit/`；**前置排雷 ①②**：① 确认 `submitModelProtocol` 对 sync+流式返回什么（是否保留可消费原始 `Response`）；② esbuild 打包后实际 import 图里是否浏览器 API（`window/document/FileReader`）被拉入 | ① esbuild 打包后能 import `executeModelProtocol`，且 ① 结果决定 §4.3 chat 流式实现；② 与 localTool 同 tsc 0 错；③ vendoring 整包 vs 子集边界定死 |
| **C** | 薄端点 `/api/relay`（§3）+ 注册路由 | ① `curl POST /api/relay` 返回 `{code:0,data:{url}}`（连 9004 真跑一次 image）；② **参考图归一生效**：传一张本机 `/files/` 图做图生图，日志出现 `[resolve:inline-img]`（复用 `resolveLocalImages`），9004 收到的是 base64 而非 `/files/` 路径 |
| **D** | 9004 协议声明（§4）：image/video/chat 三份 | ① curl 验证 image 出图、video 出视频、chat 出文本（连 9004 端到端）——注意这里 curl 是**验证 kit 引擎跑通**，不是"反推字段"（字段已在 §4 反填完毕）；② 若某能力失败，对照 §4 标注的现有代码出处核对，优先怀疑 kit 变量替换/信封剥壳 |
| **E** | 前端切意图（§5）：改 `relayProxy`、替换调用方；**按 §5.0/§5.1 去留清单走**（保留通用能力，只把端点半断言/URL 拼装/9004 字段映射下沉） | ① 生成/聊天/视频正常；② 前端生成请求统一走 `relayProxy`（旧 `__proxyFetch`/`pollUntilDone`/chat 直连不再被生成节点调用）；③ **通用能力仍在**：`resolveImagePixel`/`classifyUrl`/`attachImages`/responses 协议/`friendlyRequestError`/`normalizeImageUrlsForSend` 正常被引用；④ **能力零退化（§5.0.5 全表 ✅）**：进度条在、取消可用、参考图归一在、错误中文降级在、CLI 平台没丢、视频刷新恢复在；⑤ 加新平台前端零改动 |

> **回退策略（对应"跑不通再加回"）**：C/D 步若 kit 跑不通 9004，按能力回退——image/video 若跑不通则整体回老 `proxyGenerate`；chat 流式已按 §4.3 在 `/api/relay` 路由层自实现，若某模型流式消费异常，自动退化非流式（无需回老路由）。**回退是"加回某个能力"，不是推翻方案。**

---

## 6.1 执行检查点（Go / No-Go）——每个岔路必须停下来重规划

> 这是本方案最重要的补充：**A→E 是方向，中间有几个岔路，走到必须停下、把细节重新规划好再继续**，否则闷头做到 E 才发现方向错，返工成本爆炸。下面按执行顺序列出每个"必须停下来"的检查点，以及停下后要重新规划什么。

### 检查点 ①：A 步完成（统一语言）—— 最危险，一步错全盘错 —— **✅ 已通过（commit 54278c4）**

**（A 步已落地并验收通过，本检查点历史性通过，不再阻塞后续。）** 留档当时验证项供复检：
- `tsc --noEmit` 0 错（现有 localTool 全部代码在 bundler 下编译过）
- 起服务后 **key 真的没丢**（`.env`/`api.config.json` 读对）
- `npm test` 全绿（190 tests）

**唯一遗留**：`launch-all.ps1:282` 缺 `--enable-source-maps`（Windows 启动器，不影响功能，可后补）。

> **为什么当时必须停**：A 是地基。A 没打牢，B-E 全在流沙上。现已通过，可继续 B。

### 检查点 ②：B 步完成（vendor kit 编译通过）—— 暴露 kit 的隐藏依赖

**停下来验证：**
- kit 与 localTool **同一份 tsconfig 编译 0 错**（不是各自 tsconfig）
- esbuild 打包 `executeModelProtocol` 入口能加载运行（临时脚本跑通）

**No-Go 触发（停下重规划）：**
- kit 里有**浏览器专属 API**（`btoa/atob`/`DOMException` 在 Node 有的能用，但若出现 `window`/`document`/`FileReader` 等 Node 没有的）在打包时拉到 → 停下，决定：**剔该模块 / 加 Node polyfill / 换入口**（§7 风险 5）。
- kit 依赖的某个子模块（如 `docs/`、`upstream/`）被核心链 import 拉到且无法在 Node 跑 → 停下，**重新划定 vendoring 边界**（§7 风险 5：子集 vs 整包）。

> **为什么必须停**：这一步决定"kit 能不能在 localTool 里用"。**跑不通，后面 C/D/E 全是白做，必须先解决依赖再继续。**

### 检查点 ③：C 步完成（/api/relay 真跑一次 image）—— 协议引擎第一次被验证

**停下来验证（这是全案最关键的一次真实验证）：**
- `curl POST /api/relay`，连 9004，真出一张图，返回 `{code:0, data:{url}}`
- **key 注入正确**（`readProviderKey` 拿到 9004 的 key，网关鉴权通过）

**No-Go 触发（停下重规划）：**
- 9004 异步返回的**信封形态**与 §4.1 声明的 `taskIdPath: 'data.0.task_id'` / `result: data.result.images.0.url.0` **对不上** → 停下，**对照现有代码已确认的字段核对**（`main.py:1345` 提交数组形态 / `system.ts:312` / `resultUrlExtractor.ts:57` image 分支），**这些不是猜的，是产品代码跑通过的**；只可能是 kit 的变量替换（`{{...}}`）拼错了 path，优先查这层。
- 9004 异步轮询返回的**状态枚举**与声明里的 `successValues` 不匹配 → 停下，**按铁律核对**：对外只有 `completed`/`failed`/`processing`/`pending` 四种（`main.py:838/850/853/856/892`），**`abort`/`running` 是网关内部词、永不对外返回**，声明里绝不能出现。
- **`?wait=1` 同步 SSE 那条路**：如果决定同步也要，这里就得重新规划"同步 SSE 怎么进 kit"（§4.3 已选异步 poll，此处确认不再需要同步）。

> **为什么必须停**：C 是"kit 引擎 + 协议声明"第一次真机对撞。**协议声明写错，跑不通，是这里最可能发生的失败点。** 但注意：§4 的字段已对照现有跑通代码反填（非猜测），真出错**优先怀疑 kit 的变量替换/信封剥壳**，而不是又回去 curl 重抓 9004。

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
- 决定 `GenerationProvider` **能否收窄**——注意按 §5.0，前端仍需要 `refFormat`（参考图 base64 与否）、`image_request_mode`/`chat_request_mode`（通用能力分支用）等字段，**不能一刀切收窄到 `{id,name,capability}`**；先盘点哪些字段还被通用能力引用、哪些可安全下沉

**No-Go 触发（停下重规划）：**
- 发现**遗漏的调用方**（某节点/某流程还在用旧链路的内部函数）→ 停下，补进替换清单，**不能靠 grep 一次就删**。
- `ProviderForm.tsx` 上**平台专属字段**（`image_request_mode`/`chat_request_mode`/`image_mode`）如果还依赖前端知识 → 停下，**先想清这些字段在"意图化"后谁负责**，再删前端逻辑。
- **生图进度**（§7.3）：如果前端必须要实时进度，而当前 `/api/relay` 是等完成返回 → 停下，**先设计进度方案**（先返 taskId 前端轮询 / `/api/relay` 走 SSE）再切前端，不能切完才发现没进度。
- **能力零退化（§5.0.5 全表）**：进度条、取消（AbortSignal）、参考图归一、错误中文降级、CLI 平台、视频刷新恢复任一被 §5.1 删除或切后失效 → 停下，**先补"谁兜住"再切**。**表里有 ❌/⚠️ 未解决，绝不进切前端。**

> **为什么必须停**：E 是**唯一会碰前端、影响用户可见行为**的一步。**切前端前必须把所有细节定死，否则就是拿整个画布界面去赌。** **删文件可以，能力不能退化——这是最高原则，违反即 No-Go。**

### 检查点 ⑥：E 步之后（灰度期）—— 观察，不急着删干净

**停下来观察：**
- 生成/聊天/视频在**真实使用**下正常（不是只 curl 通）
- **日志**能定位"这次走了 kit 还是老路"（若有双轨残留）

**No-Go 触发：**
- 某能力真实使用异常 → 停下，按 §6 回退策略**单独加回该能力**，不推翻整个方案
- 灰度稳定后，再按 §5.1 清理死代码——**但只清已通过 §5.0.5"能力零退化"验证的部分**；任何仍被通用能力引用/迁移未完成的代码一律保留，**宁可留"看着多余"的代码，不可删掉仍在兜底能力的函数**

---

## 7. 风险与待决项

1. **chat 流式（已拍板）**：支持流式的模型走流式，不支持的自动退化非流式。实现落在 `/api/relay` 路由层——用 `submitModelProtocol` 拿原始 `Response` 自行读 SSE；模型 `streaming=false` 或流式消费异常时退化 `executeModelProtocol` 读完整 JSON。**待验证**：`submitModelProtocol` 对 sync+流式协议实际返回什么（是否保留原始 `Response` 可消费），需 D 步连 9004 实测确认。
2. **参考图 / 专属字段**：`image_urls`（图生图）、`size`/`resolution` 等变量能否被 kit 的 `PROTOCOL_VARIABLES` 表达——kit `variables.ts` 已支持 `imageUrls`/`size`/`resolution`，应在 D 步连 9004 验证。
3. **进度回调**：现有前端生图有 progress（SSE 逐块推）。kit 异步 poll 能取 `data.progress`，但 `/api/relay` 当前设计是等全部完成才返回。**若前端要实时进度，`/api/relay` 需改成先返回 taskId 让前端轮询，或 /api/relay 也走 SSE。** 这是待定项，先按"等完成返回"跑通，进度后再补。（§5.0.5 已列为 ❌ 真退化点，E 步前必须先定。）
4. **取消（AbortSignal）**：现有 image/video/chat 均支持中途取消。`/api/relay` 契约（§3.5）**未定义取消**——E 步前必须补"前端 abort → 后端中断"：前端 `AbortController` 中断连接，后端检测连接断开/SSE 关闭即中断上游请求并停轮询（可参考 `asyncGuard`/`withTimeout` 现有 abort 链）。**这是真退化点，不做则用户无法取消生成。**
5. **vendoring 整包 vs 子集**：按"彻底引用"整包拷；若 esbuild 打包发现 `rust/`/`tauri-transport` 等带浏览器 API 的模块被核心 import 链拉到，报错再剔。实测核心链只用 `protocol/` `core/` `types/`。

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

> **前端错误分类不退化（§5.0.5）**：前端 `relayProxy` 拿到 `{code:-1, data:{error}}` 后，**仍沿用现有 `genErrors.classifyError`**（把 `abort/timeout/network/http/business` 分类、决定可重试）+ **`requestModes.friendlyRequestError`**（对 `reasoning_effort`/`401`/`429`/`not found` 给中文降级提示）。kit 英文原始 error 透传**只作兜底显示**，用户常见错误仍走中文。**切前端时这些前端分类函数必须保留并被 relayProxy 调用，否则错误体验退化。**

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

> **前端超时兜底不退化（§5.0.5）**：后端三层超时是"防挂死"底线，但前端**仍应保留现有 `withTimeout` + `GEN_TIMEOUT`/`CHAT_TIMEOUT` 兜底**（对齐 `chatProxy` 的"超时 abort 内部 controller + 复位 loading"逻辑），确保后端异常挂起时前端能及时复位 loading/停止动画，不永久转圈。切前端时 `relayProxy` 需包一层同样的超时 + abort 链。

### 7.5.5 进度（生图/视频，先按"等完成返回"，方案预留）

- 当前设计：`/api/relay` 等 kit 全部完成才返回（非流式），**无实时进度**。
- **预留方案**（§7 风险3 待定）：需要进度时，`/api/relay` 改两种形态之一——
  - (a) 先返回 `taskId`，前端自己轮询 `GET /api/relay/status/{taskId}`（后端查 kit 轮询进度）
  - (b) `/api/relay` 也走 SSE，逐块吐 `{progress}`（对齐现有同步 SSE 形态）
- **判定（升级为能力零退化硬闸门，§5.0.5）**：**前端当前是否有"进度条"是用户可见能力**（现有 `imageProxy`/`videoProxy` 的 `onProgress` 驱动任务中心进度 + 阶段文案）。**切前端前必须先回答"进度条还保不保"**：
  - 若保 → E 步前必须选 (a) 或 (b) 落地，且 `/api/relay` 需返 `taskId` 或走 SSE；**不许切完才发现没进度**。
  - 若不保（接受"等完成"）→ 必须**明确废弃进度条 UI**（连同 `onProgress` 调用链、任务中心进度渲染一起评估），不能留下"任务中心有进度区但永远停在 30%"的半死 UI。
  - **两条都不选 → No-Go**。

---

## 8. 一句话总结

**A 步（统一语言）→ B 步（拷 kit）→ C 步（薄端点）→ D 步（9004 协议声明，字段直接复用现有三层代码沉淀，非 curl 抓包）→ E 步（前端切意图，按 §5.0 去留清单：下沉端点半断言/URL 拼装/9004 字段映射，保留尺寸表/类型判定/工具调用/参考图归一/错误降级等通用能力）。** 全程唯一新增代码 = 一个 `/api/relay` 端点 + 三份协议声明 + 一段 chat 流式解析（约 40 行）。加新平台 = 加声明。chat 流式：支持流式的模型走流式、不支持自动退化非流式。image/video 完整走 kit。**不做"推倒重来"——9004 已跑通的字段知识直接复用，前端通用能力就地保留或迁后端，只把平台协议知识收敛为声明数据。** **铁律：删文件可以，能力不能退化（§5.0.5 全表 ✅ 才允许切 E）——进度条、取消、参考图归一、错误中文降级、CLI 平台、视频刷新恢复，逐条有人兜住才能删。**
