# API 中转架构：原仓库解剖 + 猫猫重建设计

> **给未来 AI 的说明**：本文是「API 中转层」的单一事实源。上一份 `00-猫猫项目架构总览.md` 讲猫猫全景；
> 本文专讲**原仓库（AI-Canvas-tauri）的 API 中转骨架怎么设计**，以及**猫猫推倒重来时该怎么搭**。
> 调用协议引擎（`modelProtocol*`）在本文只索引，细节见第 5 节与 `download/ai-relay/`。
> 最后更新：2026-09-02。

---

## 0. 一句话：原仓库的「API 中转」不是单个 relay 对象，而是一组协作模块

它没有 `createRelay` 这种大对象，而是把「中转」拆成 6 个职责单一的层，前端按需调用：

```
                 ┌─────────────────────────────────────────────────────┐
 用户配置/UI ──▶ │ ① 目录定义层  ProviderDefinition[] (声明式元数据)       │
                 │      providerCatalogService.ts                       │
                 └───────────────┬─────────────────────────────────────┘
                                 │ 查定义
              ┌──────────────────┼──────────────────────────────────────┐
              ▼                  ▼                                       ▼
  ② 地址规范层        ③ 模型目录层            ④ 连接测试层
  providerBaseUrl     providerCatalogService   testConnection.ts
  normalize+candidates fetchProviderModelCatalog  testProviderConnection
              │                  │                                       │
              └──────────────────┴───────────────────────────────────────┘
                                 │ 都依赖底层 fetch
                                 ▼
              ⑤ 传输层  httpTransport.corsSafeFetch
                 （Tauri proxy_fetch 绕 CORS + 脱敏日志）
                                 │
                                 ▼
              ⑥ 调用引擎层  modelProtocol*  +  MediaProviderRegistry
                 （真正发请求/解析返回/流式/异步轮询/图生图参考素材）
```

猫猫当前的「老生成链」是 `proxyGenerate → /api/proxy → handleProxy → resolveProviderTarget → fetchWithProxy`，**只有第 ⑤⑥ 层的简陋版，缺①②③④**。这就是要推倒重来的根。

---

## 1. ① 目录定义层：`ProviderDefinition`（声明式元数据契约）

文件：`src/services/ai/providerCatalogService.ts`（行 48-71）

```ts
export interface ProviderDefinition {
  id: string;                 // 'apimart' | 'xai' | 'google' | 'sora2u' | 'volcengine' |
                              //   'runninghub-model' | 'grsai' | 'dreamina' | 'tavily' | ... | 'custom-openai'
  name: string;
  description: string;
  badgeText: string;
  authType: 'api-key' | 'oauth';
  catalogAdapter: 'openai-compatible' | 'local-manifest' | 'web-search';  // ★三类目录适配
  defaultBaseUrl?: string;
  modelsPath?: string;        // openai-compatible 的 /models 路径
  allowCustomBaseUrl?: boolean;
  externalUrl?: string;       // 注册/充值页（绝不作 Base URL）
  connectionTestPath?: string;// 无生成副作用的验证端点
  requestQuery?: Record<string,string>;  // 固定查询参数（如 sora2u）
  hiddenModelIds?: readonly string[];
  credentials: ProviderCredentialField[]; // 表单字段定义（key/label/required/secret）
  models?: readonly ProviderModelSelection[];  // 内置厂商随包发布的模型清单
  kind?: 'model' | 'web-search';
}
```

**关键设计**：
- 12 个内置厂商 = `BUILT_IN_PROVIDER_DEFINITIONS: ProviderDefinition[]`（行 109-280），纯声明式数组。
- `catalogAdapter` 三态决定「模型从哪来」：`openai-compatible`（拉 `/models`）/ `local-manifest`（内置写死）/ `web-search`（无模型，给 Agent 能力）。
- `getProviderDefinition(id)` 用 Map 查；`createConnectionId` 内置厂商 1 条/自定义多条（加随机后缀）。

**猫猫重建映射**：这整张表应搬成 `relay/catalog.ts`（Node 侧），猫猫当前 `providers.json` 只存用户连接实例，不存厂商元数据——重建时把「厂商元数据」与「用户连接」分离，正对应原仓库 `ProviderDefinition` vs `ApiProviderConfig`。

---

## 2. ② 地址规范层：`providerBaseUrl`

文件：`src/services/ai/providerBaseUrl.ts`（全 47 行，极简）

- `normalizeBaseUrl(raw)`：去空白 → 缺协议补 `https://` → 剥 hash/search → 剥误贴的完整端点后缀
  （`/chat/completions|/models|/images/generations|/videos|/audio/...`）→ 去尾斜杠。
- `baseUrlCandidates(raw)`：地址已含 `/v\d` 则只返回 `[base]`；否则补一个 `[base, base+'/v1']` 候选。

**为什么重要**：下游十几处 `${base}${path}` 拼接，统一在写配置前收敛一次，避免「漏写 /v1」「把端点当 baseUrl 贴」两类高频错误。

**猫猫重建映射**：直接复用，放 `relay/baseUrl.ts`。猫猫 `resolveProviderTarget` 现在的拼接是散的，应统一收敛到这一层。

---

## 3. ③ 模型目录层：`fetchProviderModelCatalog`（三源策略）

文件：`src/services/ai/providerCatalogService.ts`（`fetchProviderModelCatalog` 行 560-594）

返回值 `ProviderCatalogResult { models, source: 'remote'|'local-manifest'|'local-fallback', warning?, resolvedBaseUrl? }`

**三源优先级**：
1. `local-manifest` 厂商（xai/google/sora2u/runninghub/grsai/dreamina）→ 直接返回内置 `models`，`source:'local-manifest'`。
2. `openai-compatible` 厂商 → 按 `baseUrlCandidates` 逐个探测 `GET {base}{modelsPath}?requestQuery`，
   成功则 `source:'remote'`，并把真实地址回写 `resolvedBaseUrl`（调用方应写回配置）。
3. 远程失败但有 `fallbackModels`（或 local-manifest 兜底）→ `source:'local-fallback'`，带 `warning`。
4. 全失败 → 抛「无法连接模型目录」。

**配套机制**：
- `readCatalogItems` 兼容 `/models`、`{data}`、`{models}` 三种包络；`parseCatalogItem` 从 `{id|model|model_id}` 解析。
- `inferModelCategory(id)` 用正则猜类别（tts/whisper→audio；seedance/sora/veo→video；flux/banana→image；默认 text）。
- `parseVideoCapability` 抽 `durations/ratios/resolutions/maxImageReferences` 等视频专属能力。
- `capCatalogModels(models, selectedIds)`：`MAX_CACHED_CATALOG_MODELS=300`，已勾选模型永不被截断，超出只截断未选的（避免 `/models` 上千模型撑爆 config 序列化）。
- `mergeRemoteCatalogMetadata`：远程目录 + 本地兜底按 id 合并元数据（远程优先，兜底补 executionProfile/imageReferenceRequestMode）。

**猫猫重建映射**：`relay/catalogFetch.ts`。猫猫当前无模型目录拉取（生图全靠 apimart-gateway 网关），重建时应让每个中转商能独立拉自己的 `/models`。

---

## 4. ④ 连接测试层：`testConnection`

文件：`src/services/testConnection.ts`（`testProviderConnection` 行 172-199）

**原则**：只调用**无生成副作用**的端点（目录/鉴权/账户），绝不发真实生成请求。

- `testFns: Record<ProviderTestKey, fn>` 特例表：apimart/volcengine→`testModelCatalog`(GET /models)；
  runninghub→账户余额接口；grsai→`unsupported`(不发请求)；web-search→Tauri 搜索一次。
- 未在表登记的 api-key 厂商 → 走 `connectionTestPath`（如 sora2u `/api/v1/credits`）或兜底 `testModelCatalog`。
- `testModelCatalog`：按 candidates 探测，401/403 **短路**（凭据错换地址没用），否则试下一个候选；返回 `baseUrl` 回写。
- 返回 `TestResult { success, balance?, error?, unsupported?, baseUrl? }` —— 余额文本也一并带回 UI。

**猫猫重建映射**：`relay/connection.ts`。猫猫 `routes/system.ts handleProxy` 当前无连接测试概念；重建时连接测试应独立于生成，单独 `/api/relay/test` 端点。

---

## 5. ⑤ 传输层：`httpTransport.corsSafeFetch`（绕 CORS + 脱敏）

文件：`src/services/ai/httpTransport.ts`

- 非 Tauri 环境 → 直接 `fetch`（web 版）。
- Tauri 环境 → 请求体 base64 编码后 `invoke('proxy_stream_fetch', {req, onEvent: Channel})`，
  把 Rust 推来的 `meta/chunk/done` 事件在前端重建为 `ReadableStream<Uint8Array>`，**伪装成标准 `Response`** 对外。
  → 远程 http(s) 一律走 Rust 代理彻底绕开 WebView 同源策略；`asset/blob/data/file` 本地 scheme 仍用前端 fetch。
- **脱敏日志** `sanitizeValue/sanitizeHeaders/sanitizeBody`：dev 环境打印请求，但 `authorization|api_key|token|secret|cookie` 全 `[REDACTED]`，
  本地绝对路径 `[REDACTED_TEXT_WITH_LOCAL_PATH]`，长字符串截断 1000。
- `cancel_proxy_fetch`：AbortSignal 串联，取消原生请求。

**猫猫重建映射（关键差异）**：猫猫**没有 Tauri**，localTool 本身就是 Node 服务，所有出站请求**天然在 Node 侧、不受浏览器 CORS 限制**。所以猫猫的传输层就是 `node-fetch`（我们 `download/ai-relay/src/transport.js` 的 `corsSafeFetch` 已搬好），**不需要 proxy_fetch 那层 IPC**。这是猫猫比原仓库简单的地方——中转逻辑应整体下沉到 localTool（Node），前端只发「用 provider X model Y 生成」的指令。

---

## 6. ⑥ 调用引擎层（索引，详情见 `download/ai-relay`）

上轮已搬进 `download/ai-relay/src/protocol/` + `generate/`，13/13 测试通过。要点：
- 声明式 `NormalizedModelExecutionProtocol`（version1→2 自动升级）。
- 请求体序列化 json/form-urlencoded/multipart；模板 `$whenPresent`/`$forEach`；白名单变量；同源校验。
- 同步响应（text/binary/json 按点号路径抽 url/text/base64）+ 异步轮询（提交拿 taskId→轮询，429/瞬时错误退避重试）。
- 流式 SSE 解析 `stream.js`；各模态 `generate/index.js`：`chat/streamChat/generateImage/generateVideo/generateAudio`。
- **图生图/图生视频的参考素材**：原仓库 `imageUtils.resolveImageUrlArray`（图床 URL）/ `resolveImageDataUrlArray`（base64），
  `generateImage` 按 `imageReferenceRequestMode`（generation-json-image-urls / generation-json-image-data-urls / edits-multipart）分流。
  **猫猫对应物**：`localTool/src/utils/resolveLocalImages.ts`（出站前把 `/files/` 图读盘压缩≤1920 内联 base64）——已是 base64 路径，等价于 `generation-json-image-data-urls`，但**缺图床 publicUrl 路径**。

---

## 7. 媒体适配器层：`MediaProviderRegistry`

文件：`src/services/ai/mediaProviderRegistry.ts`

- `MediaProviderAdapter { providerId, capabilities:('image'|'video'|'audio')[], generateImage?, generateVideo?, generateAudio? }`。
- `MediaProviderRegistry` 注册表：`register`/`supports`/`getImageAdapter`/`getVideoAdapter`/`getAudioAdapter`。
- 当前只注册了 `apimartMediaProviderAdapter`（`providers/apimartMedia.ts`）—— 即图/视频/音频的具体厂商实现收口在 adapter 里。
- `validateAdapter` 校验 capability 与 handler 一致，重复 ID 报错。

**猫猫重建映射**：`relay/registry.ts`。猫猫当前图/视频生成直接散在 `routes/system.ts` + `apimart-gateway`；重建时应把每个厂商的媒体生成收口到 adapter，与协议引擎解耦。

---

## 8. 原仓库值得在重建中保留的 9 条设计决策

1. **声明式 `ProviderDefinition` 表**：厂商元数据与用户连接实例分离（猫猫当前混在 `providers.json`）。
2. **`catalogAdapter` 三态**：openai-compatible / local-manifest / web-search，目录来源一目了然。
3. **地址规范化 + 候选探测**：统一在写配置前收敛，补 `/v1`，避免散拼接。
4. **模型目录三源**：remote > local-manifest > local-fallback，断网/无 Key 也有兜底，`resolvedBaseUrl` 回写。
5. **目录缓存上限 300 + 已选模型不截断**：防 config 膨胀。
6. **连接测试只打无副作用端点 + 401/403 短路**：绝不误发计费请求。
7. **凭据不随配置流转**：导出/分享连接 JSON 永远不含 apiKey（猫猫 `providerConnectionTransfer.ts` 同设计）。
8. **脱敏日志**：Key/路径打印即抹掉，防落盘泄露。
9. **声明式调用协议 `modelProtocol`**：请求体/模板/同源/同步异步/轮询全声明式，新增厂商零改引擎。

---

## 9. 猫猫重建建议（推倒重来怎么搭）

### 9.1 顶层决策：中转逻辑整体下沉到 localTool（Node）

原仓库把 ①②③④ 放前端、⑤⑥ 跨前端+Rust。猫猫没有 Tauri，localTool 已是网关，**所有中转逻辑应住在 localTool 的 `relay/` 子系统**，前端只发高层指令：

```
前端（瘦）                          localTool（relay 子系统，Node）
proxyGenerate.chat/                  POST /api/relay/chat
  image/video                       POST /api/relay/{image,video,audio}
                                    POST /api/relay/test        （连接测试，独立）
                                    GET  /api/relay/catalog     （拉模型目录）
  只传 { providerId, model, prompt,  relay/catalog.ts  → ProviderDefinition[]
          references, signal }       relay/baseUrl.ts   → normalize+candidates
                                     relay/connection.ts→ testProviderConnection
                                     relay/catalogFetch.ts → fetchProviderModelCatalog
                                     relay/transport.ts → corsSafeFetch (Node fetch)
                                     relay/protocol/*   → modelProtocol 引擎（已搬）
                                     relay/registry.ts → MediaProviderRegistry
                                     utils/resolveLocalImages → 图生图参考内联
                                     routes/files.ts   → 结果落盘（已存在，复用）
```

前端不再持有 `ProviderDefinition`、不再拼 URL、不再直连——比原仓库更干净（原仓库前端重、Rust 只管代理；猫猫前端轻、Node 全包）。

### 9.2 目录结构（建议）

```
localTool/src/relay/
  catalog.ts          # ProviderDefinition[]（12 厂商声明式元数据）
  baseUrl.ts          # normalizeBaseUrl / baseUrlCandidates
  connection.ts       # testProviderConnection（无副作用端点）
  catalogFetch.ts     # fetchProviderModelCatalog（三源）
  transport.ts        # corsSafeFetch（Node fetch + 脱敏 + 超时/取消）
  protocol/           # 从 download/ai-relay/src/protocol 搬入（已验证）
  registry.ts         # MediaProviderRegistry（图/视频/音频 adapter）
  generate.ts         # chat/image/video/audio 高层入口（接 protocol + registry）
  manifests/          # xai/google/sora2u/runninghub 内置模型清单
```

### 9.3 老链退役顺序

1. `relay/` 子系统就位（从第 9.2 节文件）。
2. `routes/system.ts handleProxy` 改为薄壳：识别 `catalogId` → 调 `relay/generate.ts`，旧 `resolveProviderTarget` 的 apimart/openai 分支逐步迁到 `ProviderDefinition`。
3. 前端 `proxyGenerate.ts` 三个函数改打 `/api/relay/*`，body 只传高层语义（不再拼 URL/Header）。
4. `apimart-gateway`（Python 9004）保留为其中一个 catalogAdapter（apimart），不再是唯一出口。
5. CLI 协议、剪映 stub 在 `registry` 里补 adapter 或保留 stub，明确标注。

### 9.4 你之前关心的三件事如何在重建里闭环

- **图生图 / 图生视频**：`relay/protocol` 的 `imageReferenceRequestMode` 三态 + `utils/resolveLocalImages`（出站内联 base64）。补图床 publicUrl 路径可选（参考原 `uploadToRemote`，但猫猫无图床依赖，base64 内联已够，注意体积上限）。
- **文件落盘**：复用 `routes/files.ts`（已存在），生成结果经 `generate.ts` 拿到 `url` 后调 `filesApi.saveResultToTasks` 落 `uploads/tasks`，与现状一致。
- **流式 / 异步轮询**：`relay/stream.js`（SSE）+ `relay/protocol/poll.js`（提交+轮询），已在 `download/ai-relay` 验证。

---

## 10. 关键文件速查（原仓库）

| 层 | 文件 |
|---|---|
| ① 目录定义 | `AI-Canvas-tauri/src/services/ai/providerCatalogService.ts` |
| ② 地址规范 | `AI-Canvas-tauri/src/services/ai/providerBaseUrl.ts` |
| ③ 模型目录 | 同 ①（`fetchProviderModelCatalog`） |
| ④ 连接测试 | `AI-Canvas-tauri/src/services/testConnection.ts` |
| ⑤ 传输 | `AI-Canvas-tauri/src/services/ai/httpTransport.ts` |
| ⑥ 调用引擎 | `AI-Canvas-tauri/src/services/ai/modelProtocol*.ts` + `generate{Text,Image,Video,Audio}.ts` + `streamParsers.ts` |
| ⑦ 媒体适配 | `AI-Canvas-tauri/src/services/ai/mediaProviderRegistry.ts` + `providers/*.ts` |
| 凭据不流转 | `AI-Canvas-tauri/src/services/ai/providerConnectionTransfer.ts` |
| 能力推断 | `AI-Canvas-tauri/src/services/ai/mediaModelCapabilities.ts` |
| 内置清单 | `AI-Canvas-tauri/src/services/ai/providers/*ModelManifest.ts` |

猫猫侧已具备：`localTool/src/utils/resolveLocalImages.ts`（图生图参考）、`localTool/src/routes/files.ts`（落盘）、`download/ai-relay/`（协议引擎 PoC）。
