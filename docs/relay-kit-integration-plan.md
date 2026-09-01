# 方案文档：API 中转站改造 —— 统一前后端语言 + 引入声明式协议引擎

> 状态：待审计（v3，目标重写为"统一语言"主线；含 §10 反黑盒架构可见性要求）
> 日期：2026-09-01
> 关联：`localTool/src/routes/*`（现有中转）、`src/components/base/*`（前端生成层）、`/Users/kevin/Downloads/ai-relay-kit`（参考实现）、根 `tsconfig.json` / `localTool/tsconfig.json`（语言规则）

---

## 0. 核心目标（一眼看完）

**第一目标（最高优先级，长期主义）：前端 `src/` 与 `localTool` 用同一种 TypeScript、同一套编译规则。**

- 不是"引入 ai-relay-kit"、不是"补 `.js` 后缀"、不是"零改源码"——这些是手段，不是目标。
- 目标定义：仓库内所有 `.ts` 走**同一份 `module` / `moduleResolution` / `target` / `lib` 规则**。新人接手、加平台、升依赖都只记一条规则；一年后回看不返工。
- 引入 ai-relay-kit 是为了补"声明式协议层"短板，**但它必须服从于"统一语言"这个目标**。若它的写法逼我们分裂语言规则，则改造方式让步于目标，而非目标妥协。

**第二目标（业务价值）：前端只发"意图"，localTool 独占平台知识。**

- 前端：`providerId + capability + model + prompt` → 调统一 `relayProxy`。
- localTool：拼 URL、注 key、序列化 body、发请求、轮询、按路径取结果，全在后端。
- 加新平台：后端加一份协议声明数据，前端零改动、零重启感知。

**不破的红线**：`18080`/`9004` 端口不动、`proxyMode=local-tool` 唯一出口、key 只进 `.env`、老 `/api/proxy` + `passthrough` 双轨保留。**chat 流式永久走老 `/api/proxy`**（kit 的 `executeModelProtocol` 不吐流，见 §8.4），kit 仅接管 image/video/async。

**收口边界按"知识归属"划，不按"代码位置"划**：平台知识（URL 拼装、端点选择、响应字段路径、异步轮询）下沉后端；UI 展示知识（`PROVIDER_PROTOCOL_LABELS` 等下拉文案）、媒体渲染知识（`resolveMediaType`）、流式增量解析（`parseResponsesSSEChunk`）属前端、保留。整体"删除文件"会混淆职责、一年后更难修——一律改为"拆分"。

---

## 1. 语言现状审计（决定第一目标怎么落地）

> 本节是整套方案的根。所有改造以"对齐到同一套规则"为判据。字段均来自仓库现有 tsconfig 实测。

### 1.1 三份 tsconfig 对比

| 字段 | 根 `tsconfig.json`（管前端 `src/`） | `tests/tsconfig.json` | `localTool/tsconfig.json` |
|---|---|---|---|
| `target` | ES2022 | ES2022 | ES2022 |
| `lib` | ES2022 + DOM | ES2022 + DOM | ES2022 |
| `module` | **ESNext** | **ESNext** | **Node16** ❌ |
| `moduleResolution` | **bundler** | **bundler** | **Node16** ❌ |
| `strict` | false | false | true |
| `paths`(`@/*`) | 有 | 有 | 无（localTool 不用别名，无影响） |
| `include` | `src/**` + `localTool/src/**` + vite/vitest 配置 | `./unit/**` | `src/**`（独立） |

**结论**：前端与测试早已是 `ESNext` + `bundler` 同一套；唯独 `localTool` 因历史上要 `node dist/index.js` 裸跑 ESM，单独设了 `Node16` 强制 `.js`。**根 tsconfig 的 `include` 已含 `localTool/src/**`，即前端与 localTool 本就在同一类型检查下，只差 `moduleResolution` 这一处。**

### 1.2 为什么"统一语言"才是根治，而非补 `.js`

- 若给 ai-relay-kit 的 300+ 处裸引用补 `.js`（改工具库）：工具库每次升级都需 re-merge，把别人的演进成本转嫁给自己——**一年后债务最重，最不根治**。
- 若把 localTool 改成 `bundler`：工具库零改、前端与 localTool **解析规则完全同一套**、升级 = `cp -r` 覆盖。**一年后零额外成本。**
- "补 `.js`"是把问题归咎于工具库；"统一成 bundler"是把仓库拉回既有规范（前端/测试早就是）。**统一规范 = 最小长期维护成本。**

### 1.3 目标态的语言规则（前端 / localTool / tests 三处对齐）

```
target: ES2023          ← 对齐工具库（其用 findLastIndex，需 ES2023）
lib:    ES2022 + DOM    ← 与现状一致
module: ESNext          ← 与前端/测试一致
moduleResolution: bundler  ← 与前端/测试一致
```
`strict` 差异（localTool 保持 true）是加分项，不影响兼容性，保留。

### 1.4 统一带来的唯一代价与接受理由

`bundler` 模式 `tsc` 不再输出可直接 `node` 跑的裸 ESM，故 `localTool` 启动方式从：
```
tsc && node dist/index.js
```
变为加一步打包（esbuild，毫秒级）：
```
tsc --noEmit && esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js --sourcemap && node --enable-source-maps dist/index.js
```
代价极小；打包后依赖打平、无裸 ESM 解析坑，反而更稳。仓库已有 vite/esbuild 生态，非新负担。`--sourcemap` + `--enable-source-maps` 保证打包后堆栈仍指向源码（见 §10.5，反黑盒硬约束）。

---

## 2. 业务现状与痛点（第二目标的事实基础）

### 2.1 现有架构（已具备）

- `localTool` `:18080` 是唯一出口网关，本地具名路由优先命中，未命中走 `passthrough.ts` 原样透传。
- 多平台分发在 `routes/providers.ts` + `routes/protocolAdapters.ts`：
  - 协议白名单 `PROVIDER_PROTOCOLS`：8 种（`openai`/`apimart`/`gemini`/`volcengine`/`runninghub` + CLI 类 `jimeng`/`codex`/`gemini-cli`）。
  - 适配器 `resolveProviderTarget()`：`rawUrl`(伪协议 `openai://<path>`) → 真实 URL + 注入 `Bearer key`。
  - 连接测试 / 异步嗅探 / 模型分类已表驱动；key 隔离进 `.env`（`API_PROVIDER_{ID}_KEY`）。

### 2.2 核心短板

1. **无声明式协议层**：现在"URL + Bearer 头"级转发；每个平台的请求体结构、响应字段路径、异步轮询逻辑散落前端与网关。加新平台要改前端 + 后端 + 网关 3 处。
2. **异步任务协议不可声明、不可复用**：kit 用 `ModelExecutionProtocol`（submit/response/poll/result 四段 + 变量模板 + 点号路径取值）把"提交→轮询→取结果"完全数据化；现有异步只靠 apimart 一种固定形态。
3. **响应取值硬编码**：`t.data[0].url`、`{code,data}` 信封是写死字符串契约，换站要改码。
4. **零自动适配能力**：对方 API 未知时无探测/推导手段。

### 2.3 前端越权（改造要回收的知识 —— 经代码核对的具体文件）

| 文件 | 越权内容 | 改造动作 |
|---|---|---|
| `src/components/base/providerProtocols.ts` | 按 `protocol` 拼 `openai://`、`/v1beta`、`/api/v3` 等 URL（平台知识）；UI 文案 `PROVIDER_PROTOCOL_LABELS` 等（前端展示知识） | **拆分**：平台知识移后端，UI 文案留前端（见 §5.2） |
| `src/components/base/requestModes.ts` | 自建 responses 请求体、判断 `gpt-5.6` 走哪个端点（平台+模型知识）；`parseResponsesSSEChunk` 聊流式解析（留前端） | **拆分**：平台/模型知识移后端，流式解析留前端 |
| `src/components/base/resultUrlExtractor.ts` | `extractResultUrl` 按 type 取 `result.images[].url`（响应字段映射）；`resolveMediaType` 媒体判断（渲染知识） | **拆分**：字段映射移后端信封，媒体判断留前端 |
| `src/components/base/api/proxyGenerate.ts` | `__proxyFetch`/`buildTargetUrl`/SSE 解析/轮询循环/`ok()/fail()` 信封 | **重写**为只调 `/api/relay` 的薄壳 |
| `src/components/base/api/chatApi.ts` / `imageApi.ts` / `videoApi.ts` | 组 body 后调 `chatProxy`/`imageProxy`/`videoProxy` | 改为调 `relayProxy(...)` 薄壳 |
| `src/components/base/api/index.ts` | re-export 上述模块 | 改 export `relayProxy` |
| `src/components/base/settings/sections/ProviderForm.tsx` | 前端手填协议/图片请求形态/生图方式（契约字段） | 保留"配置/选择"UI，去掉平台专属字段（改由后端协议声明驱动） |
| `src/types/provider.ts` | `GenerationProvider` 含 `protocol`/`image_request_mode` 等前端需知的字段 | 收窄，仅留 `id`/`name`/`capability` |

> 注：`scriptbox/scriptBoxEngine.ts`、`agent/runtime/agentCore.ts`、`useAgentChat.ts`、`agentRuntime.ts` 也引用了 `providerProtocols`/`proxyGenerate`。生成调用入口替换为 `relayProxy` 薄壳（见 §5.2）；但 `agentRuntime.ts` 同时引用 `requestModes.ts` 的 `parseResponsesSSEChunk` 做 chat 流式解析，**该引用保留**（chat 流式走老路由，见 §8.4）。`requestModes.ts` 按 §5.2 拆分，不整体删除。

---

## 3. 为什么"抄"而非"重写"（服从于统一语言目标）

经代码核对，kit 已为"被宿主集成"预留接缝；但**关键前提是 kit 自身用 `bundler` 规则（裸相对引用），与我们要统一的语言规则一致**，所以 vendoring 进 localTool 后**源码零改即可共存**。

| 接缝 | kit 现状（已支持） | 我们的适配（薄层） |
|---|---|---|
| **出站 HTTP** | `core/transport.ts` 的 `relayFetch` 走可注入 `RelayTransport`，`setRelayTransport()` 替换全局传输层 | 初始化时 `setRelayTransport({ fetch: fetchWithProxy })` 接代理 |
| **key 真相源** | `generate/*` 门面假设调用方传 `{apiKey, baseUrl}` | 走"逃生舱" `executeModelProtocol`，由 `bridge` 层用 `readProviderKey(providerId)` 注入 key |
| **返回信封** | `executeModelProtocol` 返回原始 `{urls,text,taskId}` | 在 `/api/relay` 端点包一层 `{code,data}`，kit 内部不动 |
| **Node 兼容** | 锁定 `node>=18`；核心引擎只用标准 `fetch`/`Response`/`AbortSignal` | `btoa`/`Blob`/`DOMException` 等浏览器全局在 `rust/`、`upstream/` 部分文件，见 §3.1 剔除策略 |

**vendoring 后语言一致性**：kit 源码在 `bundler` + `ES2023` 下与 localTool 同源，升级可 `cp -r` 覆盖 `relay-kit/`，适配层 `relay/` 不受影响。

### 3.1 vendoring 剔除策略（已修正）

> v2 文档称"剔除 `docs/`/`share/`/`stations/`/`upstream/`/`tauri-transport.ts` 不影响核心"——**经核对这是错的**。`index.ts`（门面）、`relay.ts`、`generate/*` 这些核心入口**真实 import** 了 `docs/`/`share/`/`stations/`/`upstream/`，裸剔会导致核心编不过。

**实测正确的剔除面**：仅 `rust/`（浏览器媒体处理，无核心引用，可安全剔除）。其余模块（`docs`/`share`/`stations`/`upstream`/`core/tauri-transport.ts`）被核心引用，**必须保留**或改为桩接入。

- `core/tauri-transport.ts`：Tauri 原生通道，我们是 Node。但它被 `core/transport.ts` 引用 → 不能删，需在 localTool 侧提供 Node 版 `RelayTransport` 桩替换其导出，或保留文件但让 `setRelayTransport` 始终覆盖它。
- `docs/`/`share/`/`stations/`：探测/分享/中转站解析，前端生成层用不到，但 `index.ts` re-export 了它们 → 若只 vendoring 核心（`core`/`protocol`/`generate`/`relay` 门面可不用），**只拷我们用到的子集**即可避免牵连。推荐：vendoring 时只引入 `core/` `protocol/` `types/` `generate/`（逃生舱底层）+ `providers/base-urls.ts`，**不引入 `index.ts`/`relay.ts`/`docs`/`share`/`stations`/`upstream`/`deps`**，从 `protocol/executor.js` 直接调 `executeModelProtocol`。

### 3.2 真实调用签名（v2 §3.3 有误，已修正）

kit 真实签名（`protocol/contract.ts` / `executor.ts` 实测）：
```ts
// executeModelProtocol 是单对象入参，非 (protocol, {...}) 二元
executeModelProtocol(options: ExecuteModelProtocolOptions): Promise<ExecuteModelProtocolResult>
// ExecuteModelProtocolOptions = SubmitModelProtocolOptions & { signal? }
// SubmitModelProtocolOptions = { apiKey, baseUrl, protocol, variables, signal? }
```
v2 写的 `executeModelProtocol(protocol, {...})` 是错误的，落地时以本签名重写。

---

## 4. 后端改造（薄适配层 `localTool/src/relay/`）

### 4.1 入库布局（仅拷核心子集，见 §3.1）

```
localTool/src/
├── relay-kit/                      ← vendoring 核心子集，源码零改
│   ├── core/  protocol/  types/  generate/  providers/base-urls.ts
├── relay/                          ← 我们新增薄适配层
│   ├── transport.ts                setRelayTransport({ fetch: fetchWithProxy })
│   ├── bridge.ts                   providerId → {apiKey, baseUrl} 注入
│   ├── envelope.ts                 {code,data} 统一信封
│   ├── presets.ts                  厂商协议声明总表（数据）
│   └── route.ts                    POST /api/relay 端点
└── routes/                         现有路由，不动（双轨并行）
```

### 4.2 逐文件说明

- `relay/transport.ts`：`setRelayTransport({ fetch: (u,i) => fetchWithProxy(u,i) })`。kit 内所有 `relayFetch` 走代理重试，解决公网域直连超时。
- `relay/bridge.ts`：`resolveConnection(providerId)` → `{ apiKey: readProviderKey(id), baseUrl: getProvider(id)?.base_url ?? '' }`。key 真相源仍走现有 `.env` 红线。
- `relay/envelope.ts`：`ExecuteModelProtocolResult`(`{urls,text,taskId}`) → `{code:0, data:{url|content|taskId}}`。
- `relay/presets.ts`：厂商协议声明数据（见 §6）。
- `relay/route.ts`：`POST /api/relay`，入参 `{providerId, capability, model, prompt, ...rest}`，出参 `{code,data}`。按 §3.2 真实签名调用 `executeModelProtocol`。

### 4.3 `routes/providers.ts` schema 变更

`ApiProvider` 新增可选字段（向后兼容，旧 provider 无此字段 → 退化走老 `resolveProviderTarget`）：
```ts
execution_protocol_ref?: string;  // 'apimart-async' | 'openai-image' | 'openai-chat' | ...
```
`normalizeProvider()` 与 `CONFIG_SYNC_FIELDS` 同步追加一行。

---

## 5. 前端改造（收口：逐文件清单）

### 5.1 目标形态

前端只做两件事：① 配置/选择 provider（保留 `ProviderForm.tsx`）；② 发意图：调统一 `relayProxy({providerId, capability, model, prompt, ...})`。

### 5.2 删除 / 改写文件

| 文件 | 改造内容 |
|---|---|
| `src/components/base/providerProtocols.ts` | **拆分**：平台知识（`buildTargetUrl`/`PROVIDER_PROTOCOLS` 拼 `openai://`/`/v1beta`）移后端；UI 文案/选项（`PROVIDER_PROTOCOL_LABELS`/`GENERAL_PROTOCOLS`/`CLI_PROTOCOLS`/`FIXED_PROTOCOL_PROVIDER_IDS`，被 `ApiSettings.tsx`/`ProviderForm.tsx`/`ModelSection.tsx` 三处用）属前端展示知识，**保留**到设置层 |
| `src/components/base/requestModes.ts` | **拆分**：平台+模型知识（`buildResponsesChatBody`/`buildResponsesImageBody`/`resolveChatMode` 等，被 chatApi/imageApi 引用）移后端；聊天流式解析（`parseResponsesSSEChunk`，被 `agentRuntime.ts:32` 用，因第 4 点 chat 流式走老路由而**必须留前端**）+ `friendlyRequestError` 留前端 |
| `src/components/base/resultUrlExtractor.ts` | **拆分**：响应字段映射（`extractResultUrl` 按 type 取 `result.images[].url` 等，移后端信封）；媒体类型判断（`resolveMediaType`，被 `useConnectedInputs.ts:5` 用于渲染，前端知识）**保留** |
| `src/components/base/api/relayProxy.ts` | **新增**统一意图入口，调 `POST /api/relay`，返回 `{ok, url\|content, error}`（复用现有 `GenerationResult` 形状，调用方零改） |
| `src/components/base/api/proxyGenerate.ts` | **重写**为薄壳，内部调 `relayProxy`，保留 `onProgress` 与 `AbortSignal` 透传；`chatProxy`/`imageProxy`/`videoProxy` 签名保留、内部转调 |
| `src/components/base/api/chatApi.ts` / `imageApi.ts` / `videoApi.ts` | 改用 `relayProxy({capability:'chat'|'image'|'video', ...})` |
| `src/components/base/api/index.ts` | re-export 改为 `export * from './relayProxy'` + 保留旧同名导出以便渐进迁移 |
| `src/components/base/settings/sections/ProviderForm.tsx` | 保留配置分区，删 `image_request_mode`/`chat_request_mode` 等平台专属下拉 |
| `src/types/provider.ts` | `GenerationProvider` 收窄为 `{id, name, capability}` |
| `scriptbox/scriptBoxEngine.ts` / `agent/runtime/agentCore.ts` / `useAgentChat.ts` / `agentRuntime.ts` | 替换生成调用入口为 `relayProxy` 薄壳 |

---

## 6. 厂商预置（澄清"40 个"之说）

kit 实际未内置 40 个独立协议。经核对 `providers/catalog.ts`：
- `BUILT_IN_PROVIDER_DEFINITIONS` 仅 **12 个厂商定义**（含 4 个 web-search）。
- `providers/manifests/` 仅 **3 个真实清单文件**（`google.ts`/`sora2u.ts`/`xai.ts`）。
- 多数厂商定义标 `catalogAdapter: 'openai-compatible'`，复用同一套 OpenAI 协议。

kit 内置 3 个协议预设（`protocol/schema.ts`）：`openai-chat` / `openai-image` / `agnes-video`。**其余（lovart/apimart 异步、gemini、volcengine、kling 等）都需自写声明数据**，kit 帮不了——这部分工作量全在我们。

**存储策略（二选一，待拍板）**：
- A（推荐）：预置存 `relay/presets.ts` 数据表 + provider 在 `providers.json` 加 `execution_protocol_ref` 引用。加平台只改数据，前端零感知。
- B：协议声明内联进 `providers.json`，用户更灵活但 JSON 变重。

---

## 7. 落地步骤 + 验收（每步独立可验证）

| 步骤 | 内容 | 碰前端？ | 验收标准 |
|---|---|---|---|
| **A** | 统一语言：`localTool/tsconfig.json` 改 `module:ESNext` + `moduleResolution:bundler` + `target:ES2023`；启动加 esbuild 打包；**同步收敛 4 处 `import.meta.url` 运行时路径为单一 `src/utils/paths.ts`**；**重写 7 个 `.test.js` 改跑 `src/*.ts`** | 否 | ① `localTool` 现有代码 + 工具库核心子集 `tsc --noEmit` 0 错误；② `node dist/index.js` 起服务后**真实读到的 `.env`/`api.config.json` 路径正确（key 不丢）**；③ `npm test` 全绿（已摆脱 dist 耦合）；④ `npm run check:api` 通过；⑤ **§10.5：`dist/index.js` 伴生 `.map`，`--enable-source-maps` 起服务堆栈指向源码** |
| **B** | vendoring 核心子集 `relay-kit/`（§3.1 子集）+ 写 `relay/transport.ts` 接 `fetchWithProxy` | 否 | ① 临时脚本跑通 `executeModelProtocol(getModelProtocolPreset('openai-image'), {apiKey, baseUrl, variables:{prompt,model}})` 走代理返回 url；② **§10.1：`relay-kit/VENDOR.md` + `BEHAVIOR.md` 存在且含清单；`relay/` 各文件顶部注释块齐** |
| **C** | 写 `relay/bridge.ts`/`envelope.ts`/`route.ts` + `providers.ts` 加 `execution_protocol_ref` | 否 | ① `curl POST /api/relay` 返回 `{code:0,data:{content|url}}`；lovart 异步返回 `{code:0,data:{url}}`；② **§10.3：`envelope.ts` 含 `stage`/错误分类；`/api/relay` 日志为 `[relay]` 词根并入现有体系**；③ **§10.4：响应带 `_via`；启动打路由决策表；决策流程图进 docs** |
| **D** | 铺 `relay/presets.ts`（7-8 个核心形态） | 否 | ① curl 验证所有预置厂商端到端；`execution_protocol_ref` 缺失时退老路由；② **§10.2：每个 preset 有来源注释；变量表单一真源文档存在** |
| **E** | 前端瘦身：删 `providerProtocols.ts`/`requestModes.ts`/`resultUrlExtractor.ts`；新增 `relayProxy.ts`；改 `proxyGenerate`/`*Api`/`ProviderForm`/`provider.ts`/agent 与 scriptbox 引用 | **是** | 生成/聊天/视频仍正常；前端源码搜不到 `buildTargetUrl`/`extractResultUrl`/`openai://`；加新平台前端零改动 |
| **F** | 老路由清理（可选，验证稳定后） | 否 | 双轨并行期间无功能回归 |

> A 步是"统一语言"的落地，必须在任何业务改造前完成——它决定了整套方案是否成立。E 步可用渐进迁移降低风险（`proxyGenerate` 保留旧签名、内部转调 `relayProxy`）。

---

## 8. 风险与待决项

1. **vendoring 子集界定**：§3.1 已修正——不能裸剔 `docs/share/stations/upstream`，只能剔 `rust/`。稳妥做法是只拷 `core`/`protocol`/`types`/`generate` 子集，从 `protocol/executor` 直接调，绕开门面 `index.ts` 对无用模块的 re-export。
2. **协议声明存储 A vs B**（§6）：建议 A，待拍板。
3. **专属字段**：ComfyUI `workflowId`、ms_loras 等我们专属字段需确认能否用 kit 变量模板表达，或需扩展变量表（纯数据扩展，低风险）。
4. **流式（SSE）已可判定，非待 spike**：经核对 `protocol/executor.ts`（`executeModelProtocol` 全文仅 `submitted.urls/submitted.text/poll` 三分支，全文件 grep `stream` 仅命中 `application/octet-stream`），**它只吐聚合结果、不吐流**。`streamFormat:'openai-sse'` 仅是供宿主自行流式消费的**声明字段**（`types/protocol.ts:139/164`），kit 自己 `contract.ts:59` 写明"非流式"。前端确有真流式（`agentRuntime.ts:32` 的 `parseResponsesSSEChunk`、`proxyGenerate.ts:120/346` 的 `readSseUrl`/`readSseChatContent`）。**结论：chat 流式必须永久走老 `/api/proxy`，kit 只接管 image/video/async。此结论直接进 §0 红线，不再作为 E 步前的待验证项。**
5. **esbuild 打包引入 + 运行时路径收敛（A 步必带，不可后补）**：`tsc --noEmit` 不再产可裸跑 ESM，`localTool` 启动加 esbuild 打包步（毫秒级，仓库已有 esbuild 0.21.5）。但 `--bundle` 把所有模块塌进单文件 `dist/index.js` 后，**4 处 `import.meta.url` 构造的 `__dirname` 相对层数变化**：`src/index.ts:54`、`./routes/providers.ts:137`(读 `.env`/`api.config.json` 的 key 真相源)、`./router.ts:88`(baseline JSON)、`./utils/logWriter.ts:25`(logs 目录)。当前靠 `dist/routes/../../.env` 恰好命中 `localTool/.env`；塌缩后变 `dist/../../.env` = **项目根 `/.env`，key 全丢**。修法：A 步同步把 4 处重复的 `fileURLToPath(import.meta.url)` 收敛为单一 `src/utils/paths.ts`(基于 `process.cwd()` 或注入 `APP_ROOT`)。**这恰好是"统一语言"主线的净收益**——把散落的运行时环境假设收成单一真源。同时确认 `package.json` scripts 与 `launch-all.ps1:282`(`node dist/index.js`)同步；打包必须带 `--sourcemap` 否则堆栈指向打包产物（见 §10.5）。
6. **`check:api` 契约门禁（每步验收必过）**：`scripts/check-api-contract.cjs` 挂在 `prebuild`+`pretest`，强制"改端点 = 加函数 + 登记 `apiRegistry` + 登记 `router.ts` 的 `routes` 表 + 更新薄壳白名单(脚本 L44-48)"四件套，否则 `npm run build`/`npm test` 直接挂。新增 `/api/relay` 必须走这套；信封 `{code,data}` 标 `code-data`，若第 4 点例外透传 SSE 则标豁免 `sse`。**新端点形态必须先定，否则 `--api/relay` 的 `code-data` 与 chat 透传 `sse` 互斥。** 新增 `src/components/base/api/relayProxy.ts` 薄壳需加进白名单;`proxyGenerate.ts` 改写需同步改脚本登记。
7. **测试依赖 dist 是过渡债，按统一目标重写**：`localTool` 7 个 `.test.js` 当前 import 编译产物 `dist/**`（`providers.test.js:6` 自警告只跑 `tsc --noEmit` 会测到旧逻辑）。切 esbuild 后 `dist/` 改为单文件打包，`dist/routes/*.js` 等路径不再存在。**按长期目标，测试直接改跑 `src/*.ts`**（`tsx` 或 Node `--experimental-strip-types`），`tsc --noEmit` 纯做类型门禁、esbuild 只服务运行时，彻底摆脱 dist 耦合。**这是重写、不是约束**——A 步验收须含 `npm test` 全绿，而非仅"起服务"。

---

## 10. 架构可见性要求（反黑盒，每项可验收）

> 目标：每个盒子都可打开、可追踪、可定位。封装（边界清晰、内部可读、出错可定位）允许；黑盒（边界模糊、内部不可读、出错只能猜）禁止。
> 本条是**硬约束**，不是愿望——下面每条都挂 §7 验收，能被门禁卡住。

### 10.1 vendoring 的 kit：必须有来源与行为文档（否则 30+ 文件就是黑盒）

方案说"源码零改、升级 `cp -r` 覆盖"，意味着仓库会多一坨不修改、也不真正读过的代码，但它承载所有出站请求。**必须把它的隐式行为显式化：**

1. **`relay-kit/VENDOR.md`**：来源路径、vendoring 日期、commit（若有）、**实际保留文件清单**、剔除清单及理由、"禁止手改此目录"声明。半年后没人知道这坨代码从哪来、能不能改。
2. **`relay-kit/BEHAVIOR.md`**：读一遍 `protocol/executor.ts` + `core/polling.ts` 整理出隐式行为——重试几次、间隔多少、轮询上限（`maxAttempts`/`maxDurationMs`）、超时怎么抛、哪些 HTTP 码会重试（`retryHttpStatuses`）、base64 何时触发（`btoa/atob`）、结果同源下载逻辑、`normalizeStatus` 状态归一规则。**这些是运维时最需要、最容易变黑盒的东西。**
3. **`relay/` 适配层每个文件必须有顶部注释块**说明"我为什么存在、我的上下游是谁"——与现有 `providers.ts:126`、`router.ts:86`、`providers.test.js:6` 的注释风格保持一致。

### 10.2 presets 协议声明：数据驱动必须防"玄学配置"

加平台 = 加数据是优点，但一张表里 `{{prompt}}`/`taskIdPath:'video_id'`/`resultUrlPath:'data.*.url'` 新人看不出为什么、改错会怎样。要求：

1. **每份声明必须带来源注释**：`// 依据 <平台名> 官方文档 <URL>，验证日期 YYYY-MM-DD，验证方式：curl 见 docs/xxx`。没有来源的声明就是玄学配置。
2. **变量表单一真源**：kit 的 `PROTOCOL_VARIABLES` 支持哪些变量（`prompt`/`model`/`size`/`messages`/`images`/`frames8n1`/`fps`…）必须列成表，放 `relay/presets.ts` 顶部或同目录 `VARIABLES.md`。否则写新声明只能去翻 kit 源码猜——那就是黑盒。
3. **专属字段扩展点登记**：§8.3 的 ComfyUI `workflowId`、ms_loras 若需扩展变量表，扩展点也要登记在同一份文档，不能散落。

### 10.3 `{code,data}` 信封的错误路径：必须分层、带 stage（不可只写成功路径）

§4.2 `envelope.ts` 示意代码只处理成功；kit 会抛 `ModelProtocolHttpError`（带 `status`/`retryAfterMs`）、"轮询超时"、"完成但未返回配置结果"、"异步协议未生成轮询配置"等错误。若压成 `{code:-1,error:'生成失败'}`，前端排障完全瞎。要求：

1. `envelope.ts` 定义**错误分类枚举 + 层次标识**：配置错（缺 key/缺 preset）/ 上游 4xx（参数、鉴权）/ 上游 5xx / 轮询超时 / 结果路径取不到。每类稳定 `code` + 可读 `message` + **`stage` 字段**（`submit`/`poll`/`extract`）标明死在哪一段。
2. **`/api/relay` 打结构化日志**：`[relay] providerId=x capability=image stage=poll attempt=3 status=running`。必须并入仓库现有 `[proxy]`/`[upload]`/`[agent-chat]` 域前缀词根体系（`docs/26-...PRD`），**不能另起一套**——否则日志体系分裂又是黑盒。
3. 前端 `relayProxy` 保留原始 error 透传，不压成"生成失败"。

### 10.4 双轨期路由可见性：必须能说清"这次走了哪条路"

双轨期三条路径共存（有 `execution_protocol_ref` 走新 `/api/relay`、无则退老 `resolveProviderTarget`、chat 流式永久走老 `/api/proxy`），没有任何机制告诉你某次请求实际走了哪条——排障致命（"改了 preset 怎么没生效"= 退回老路由而看不见）。要求：

1. **响应带路由标识**：`{code:0, data:{...}, _via:'relay'|'legacy-proxy'}`。需过 `check:api` 信封校验并登记。
2. **启动时打一次路由决策表**：哪些 provider 有 `execution_protocol_ref`、将走新路；哪些退老路。一眼看清当前系统形态。
3. **`docs/` 放一张决策流程图（文字版）**：请求进来 → 判 capability 是否 chat 且流式 → 判有无 `execution_protocol_ref` → 走哪条。**三条路径的分叉点必须画出来。**

### 10.5 esbuild 打包必须带 sourcemap（否则堆栈不可读）

`--bundle` 把 30+ 文件塌成一个 `dist/index.js`，堆栈行号指向打包产物而非源码——运行时黑盒。要求：

- esbuild 加 `--sourcemap`，启动用 `node --enable-source-maps dist/index.js`。
- **直接写进 §1.4 启动命令**，当前方案没有。一行参数成本换回可读堆栈。

### 10.6 验收挂点（对应 §7）

| 条目 | 验收 |
|---|---|
| 10.1 | B 步验收加：`relay-kit/VENDOR.md` + `BEHAVIOR.md` 存在且含上述清单；`relay/` 各文件顶部注释块齐 |
| 10.2 | D 步验收加：每个 preset 有来源注释；变量表单一真源文档存在 |
| 10.3 | C 步验收加：`envelope.ts` 含 `stage`/错误分类；`/api/relay` 日志为 `[relay]` 词根并入现有体系 |
| 10.4 | C 步验收加：响应带 `_via`；启动打路由决策表；决策流程图进 docs |
| 10.5 | A 步验收加：`dist/index.js` 伴生 `.map`，`node --enable-source-maps` 起服务堆栈指向源码 |

---

## 9. 给审计者的确认问题

1. **统一语言目标是否认可**？即 localTool 改 `bundler` + `ES2023`、加 esbuild 打包，放弃 `Node16` 裸 ESM 启动。
2. 协议声明存 `presets.ts`（A）还是内联 `providers.json`（B）？
3. §8 风险项 3/4（专属字段、流式对接）是否先做 spike 再进步骤 B/E？
4. vendoring 子集按 §3.1 的子集方案（只拷 core/protocol/types/generate）是否认可？
