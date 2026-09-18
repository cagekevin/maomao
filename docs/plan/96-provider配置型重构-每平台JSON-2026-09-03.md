# provider 配置型重构：每平台一个 JSON 文件（收口 check:api 的白实现）

> 状态：设计中（本文为「check:api 收口」的 provider 侧设计）。relay（ai-relay）未接前端，故前端
> `providerStore`/`providerModels`/`ApiSettings`/`cloudSync` 仍调 `/api/providers*`；relay 迁移删掉了后端
> 这些路由，导致 7 项「白实现」（前端有、后端无）。按架构师理解**不恢复旧路由**，而是**改后端**：
> 把 provider 从「动态多连接 CRUD（providers.json 单文件，历史残留）」改成**配置型 = 一个平台一个 JSON 文件**。

---

## 1. 目标形态

```
localTool/config/providers/
  lovart.json          # 每个平台一个文件（含连接元数据 + 该平台可用模型清单）
  modelscope.json
  apimart.json
  xai.json
  google.json
  ...（与 ai-relay BUILT_IN_PROVIDER_DEFINITIONS 对齐）
```

后端 `/api/providers` 改为**读这些 JSON** 返回给前端；`PUT /api/providers` 改为**写对应平台文件**；
`test-connection` / `fetch-models` 委托 ai-relay（`connection.testConnection` / `providerCatalogFetch`）。

**关键约束（relay 未接前端）**：`GET /api/providers` 返回的每个 provider 必须仍是前端 `providerStore.normalizeProvider` 认的 `Provider` 形状（`id/base_url/protocol/image_request_mode/image_mode/chat_request_mode/enabled/primary/image_models/chat_models/video_models/...`），否则 providerModels/节点下拉/出站层全崩。**前端零改动、字段契约不变**——变的是「数据从哪来 + 落到哪」。

## 2. 每个 JSON 的 schema（前端 Provider 形状 + relay 连接元数据）

一个平台文件 = 前端 Provider（必带，契约硬约束）+ relay 需要的连接元数据（可选，用于测连/拉模型）：

```jsonc
{
  // ── 前端 Provider 契约（providerStore.normalizeProvider 必带，硬约束）──
  "id": "lovart",
  "name": "Lovart",
  "base_url": "http://127.0.0.1:9004",
  "protocol": "apimart",            // 决定出站 target（providerProtocols 消费）
  "image_request_mode": "openai",   // 'openai'|'responses'|...
  "image_mode": "async",            // 'sync'|'async'（relay 下 image 强制 async）
  "chat_request_mode": "chat",
  "enabled": true,
  "primary": false,
  "image_models": [{ "id": "...", "label": "..." }],
  "chat_models":  [{ "id": "...", "label": "..." }],
  "video_models": [{ "id": "...", "label": "..." }],

  // ── relay 连接元数据（ai-relay ProviderDefinition 子集，可选）──
  "_relay": {
    "authType": "api-key",          // 'api-key'|'oauth'
    "catalogAdapter": "local-manifest", // 'openai-compatible'|'local-manifest'
    "defaultBaseUrl": "http://127.0.0.1:9004",
    "modelsPath": "/models",
    "connectionTestPath": undefined,
    "allowCustomBaseUrl": false,
    "catalogId": "lovart"
  }
}
```

> api.config.json（现单文件）按此拆成 config/providers/<id>.json；`_relay` 块若与 ai-relay 内置
> `BUILT_IN_PROVIDER_DEFINITIONS[id]` 一致则可不落文件，运行时合并（防双写漂移）——见 §3 合并策略。

## 3. 合并策略（配置文件的真源 vs ai-relay 内置目录）

- **真源**：`config/providers/<id>.json` 里的前端 Provider 字段（模型清单/协议/模式/base_url）是用户可见可改的配置。
- **内置兜底**：ai-relay `BUILT_IN_PROVIDER_DEFINITIONS` 提供**平台是否出厂存在** + **测连/拉模型的默认 baseUrl/path**。
- **合并规则（读 GET /api/providers 时）**：
  1. 遍历 `BUILT_IN_PROVIDER_DEFINITIONS`（13 平台 = 出厂候选）；
  2. 对每平台：`config/providers/<id>.json` 存在 → 读它，未填的 relay 连接元数据用内置定义补；
  3. 只存在内置定义、无配置文件 → 以「内置定义 + 空模型」生成一个最小 Provider（enabled=false，供 UI 加/启用）——即新增平台 = 加内置目录项 + 可加配置文件，无需动前端。
  4. `api.config.json` 作为「一次迁移源」保留读取兼容：首启时若无 config/providers/ 则从 api.config.json 拆出。

## 4. 端点重建（收口 check:api 6 项 provider 相关 error）

| registry key | 端点 | 新实现 |
|---|---|---|
| getProviders | GET /api/providers | 读 config/providers/*.json × 合并内置目录 → `{providers:[...]}`（前端形状不变） |
| saveProviders | PUT /api/providers | 前端保存整组 → 逐平台 diff，写 config/providers/<id>.json（仅落用户覆盖字段）；删文件=移除自定义 |
| syncConfigBase | PUT /api/config/base | 兼容：落「当前生效 base/连接」到 config（供基线同步） |
| testConnection | POST /api/providers/test-connection | 委托 ai-relay `testConnection(providerId, {apiKey,baseUrl})` |
| probeAsync | POST /api/providers/probe-async | lovart/apimart 异步嗅探：复用 relay（mock task_id 探异步端点） |
| fetchModels | POST /api/providers/{id}/fetch-models | 委托 ai-relay `listModels`（openai-compatible 远程拉 / local-manifest 本地）→ `{image_models,chat_models,video_models}` |

## 5. 相关：`/api/proxy`（第 7 项）不属于 provider 配置层

`/api/proxy` 是**生成出站**，不是配置管理。relay 的生成收口到 `/api/relay`(+`/api/generate`)。此项收口依赖**前端生成链路切 relay**（`RELAY_ASYNC_SUBMIT` 等，见 96 号姊妹文档 / docs/90 R5-R7），与本文档的 provider 配置重构解耦。relay 未接前端前 `/api/proxy` 是过渡期矛盾，另行推进（不在本文 provider 层内恢复）。

## 6. 落点清单（localTool）

- **新增** `localTool/config/providers/*.json`（首拆自 api.config.json 的三个平台：lovart/modelscope/apimart；其余平台由内置目录兜底生成）。
- **新增** `localTool/src/providerConfig.ts`：读/写/合并 per-platform JSON（唯一读写 provider 配置的模块，禁止散落 fs 读写）。
- **新增** `localTool/src/routes/providers.ts`：重建 6 个 handler，全部经 providerConfig.ts + ai-relay。
- **改动** `localTool/src/router.ts`：登记 providers 路由（补回，但 handler 是新的配置型实现，非旧 CRUD）。
- **改动** `src/components/base/contracts.ts apiRegistry`：providers 各项改回 ACTIVE（后端就绪）。
- **清理**：`api.config.json` 迁移完成后标注 deprecated（保留读取兼容一段时间）。

## 7. 边界与红线

- **前端 Provider 契约不变**：GET 返回必须过 `normalizeProvider` 不崩（id/模型数组必带）。
- **key 不入 providers JSON**：配置只存连接元数据 + 模型清单；key 只进 .env `API_PROVIDER_{ID}_KEY`（对齐 ai-relay key 红线）。前端 `_apiKey`/api_key 上送 → 后端写 .env，不回读 key 给前端（脱敏）。
- **一个平台一个文件**：写 PUT 时按 id 拆，禁止整组回写单文件导致跨平台覆盖。
- **check:api**：重建后 6 项 provider 白实现消失；/api/proxy 单独按生成迁移处理。
- **真源唯一**：模型清单/模式字段以 config/providers/<id>.json 为准；ai-relay manifest 是「出厂默认」，写配置后才落盘，避免双写漂移。

---

## 施工进度实录（2026-09-03）

### 已落地（后端 provider 配置层重建，前端契约不变）
1. **`localTool/src/providerConfig.ts`（新增）**：per-platform JSON 唯一读写模块。
   - `readProviderConfigFile / listProviderConfigFiles / writeProviderConfigFile / deleteProviderConfigFile`（白名单字段落盘，key 不入盘）。
   - `readAllProviders()`：内置目录 ∪ 配置文件合并；内置兜底最小 Provider（enabled=false）+ 从 `ProviderDefinition` 归类 image/chat/video 模型。
   - `migrateFromApiConfigFile()`：首启从 `api.config.json` 幂等拆分为每平台文件。
2. **`localTool/src/routes/providers.ts`（新增）**：重建 6 个 handler（GET/PUT providers、config/base、test-connection、probe-async、fetch-models）——读 config/providers/ + 委托 ai-relay `testConnection`/`fetchProviderModelCatalog`。
3. **`localTool/src/router.ts`**：登记 providers 6 路由。
4. **`src/components/base/contracts.ts apiRegistry`**：providers 6 项从 RESERVED → ACTIVE（后端就绪）。

### 验证
- `localTool` + 前端 `npx tsc --noEmit` 全过。
- 实测（tsx，MAOMAO_DATA_DIR=/tmp）：`api.config.json` 拆出 3 个平台文件（lovart/modelscope/p_mt1h4ycb_sfr3gu）；`readAllProviders()` 返回 16 平台（13 内置 + 3 迁移），模型数组正确归类（lovart img=4/chat=1/video=5；内置 xai/google 从 manifest 归类）。
- `npm run check:api`：6 项 provider 白实现已消除，**剩 1 项 `/api/proxy`**（属生成出站，依赖前端切 relay，不属本文档范围，见 §5）。
