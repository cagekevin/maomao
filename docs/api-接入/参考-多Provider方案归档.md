# 多 Provider 接入 · 计划表

> **本文档包含两份 plan，均保留：**
> - **第一份**：早期「UI 优先」版本（完整恢复，是你让多个 AI 探索的成果基础上的初稿）。
> - **第二份**：修订「接入够格版」（基于自研代码真实接缝，前后端配套、一个协议一个协议打通）。
>
> 两份不冲突：第一份是 UI 形态与组件清单，第二份是保证接入能落地的后端分派与实施顺序。**第二份为核心，第一份作为 UI 参考。**
>
> **范围铁律**：只看自研 `localTool/src/**`、`apimart-gateway/*`、用户文档、以及文档提到的 Nomi / Infinite-Canvas。**不碰 1mao 官方混淆代码、不碰 `src/bundle/`、不碰官方 `dist/`。**

---

# 第一份 · 多 Provider 接入（UI 优先版）

## 目标
让画布原型可配置 / 切换多个上游站点（Lovart / OpenAI 兼容 / 火山方舟 / RunningHub / 本地 CLI…），而非只认 Lovart 单上游。

## 现状（自研代码核查）
| 维度 | 现状 | 落点 |
|---|---|---|
| 前端多 provider 容器 | `apiConfigs` 已是数组，按能力类型用独立 `*ApiConfigId` 关联 | 画布前端 |
| 模型下拉 | `ModelSelect.jsx` 接收写死 `models` 数组，无 provider 概念 | `src/components/base/ModelSelect.jsx` |
| 后端单上游 | `localTool/data/apiConfigs.baseline.json` 只有 1 个 provider（id `tehuishipin`），模型全挂其下 | localTool |
| 平台接口兜底 | `routes/platform.ts` 返回静态 `BUILTIN_MODELS` | `localTool/src/routes/platform.ts:44-93` |
| 网关 | `apimart-gateway` 只认 Lovart | apimart-gateway |
| 异步转同步底座 | `routes/system.ts` `/api/proxy` 已做 wait 注入 + SSE 透传 + 剥信封 | `localTool/src/routes/system.ts` |

## 核心设计（吸收文档共识 + Nomi/IC 范式）
每个 provider 是一份声明式对象：
```
provider = {
  id, name, base_url, protocol,          // protocol 决定「怎么说话」
  image_request_mode,                    // 同一 openai 协议下的请求体形态
  api_key,                               // 密钥（只存本机，列表绝不回显明文）
  enabled, primary,                      // 启用开关 + 首选站点
  image_models[], chat_models[], video_models[],
  model_protocols{},                     // 单模型协议覆盖
  // 平台特定：volcengine_region / rh_workflows / rh_apps ...
}
```

### 协议（8 类）
`openai` / `apimart` / `gemini` / `gemini-cli` / `volcengine` / `runninghub` / `jimeng` / `codex`
- 远程 HTTP：openai / apimart / gemini / volcengine / runninghub
- 本地 CLI（无 base_url，靠登录态）：jimeng / codex / gemini-cli
- ComfyUI（局域网）：独立入口

### 图片请求形态（4 种）
`openai` / `openai-json` / `openai-video-proxy` / `openai-responses` —— 管「怎么读回结果」，与协议正交。

### 同步/异步三范式
| 范式 | 判定 | 代表 |
|---|---|---|
| 同步 | 一次往返拿结果 | gemini / volcengine / openai 同步分支 |
| 异步任务 | 拿 task_id → 轮询 → 终态 | apimart / runninghub / modelscope / lovart |
| 本地进程 | spawn CLI → 等退出 → 回收产物 | codex / gemini-cli / jimeng |

## UI 组件清单
| 组件 | 职责 | 复用/新建 |
|---|---|---|
| `ProviderSettings.jsx` | 面板容器：列表 + 表单 + 操作栏 | 新建 |
| `ProviderCard.jsx` | 单卡片（name/badge/开关/首选/key 掩码） | 新建 |
| `ProviderForm.jsx` | 动态表单（按 protocol 显隐字段） | 新建 |
| `ModelSelect.jsx` | 模型下拉 | 复用（改读 providerStore） |
| `CanvasToolbar.jsx` / `LeftPanel.jsx` | 入口 | 加按钮/加 Tab |
| `providerStore.js` | provider 列表状态 | 新建 |

---

# 第二份 · 多 Provider 接入（够格版：保证接入落地）

> **本文档目标是"接入真的落地"，不是画 UI。** 依据仓库自研代码真实接缝，讲清每个供应商从「UI 配置 → localTool → 网关 → 上游」每一跳怎么落、缺口在哪、按什么顺序打通。

## 一、你现在的接入链路（自研代码事实）

画布真正出图走这条链，**全程不碰官方 1mao**：

```
画布前端节点
  → localTool:18080 /api/proxy            ← 唯一入口（system.ts）
       ├─ 请求体带 body.url / X-Proxy-Url 指到网关
       ├─ rewriteSelfGatewayUrl() 把打回自身 18080 的 /api/v1/gateway/* 改写去 9004
       └─ 剥 {code,data} 信封、SSE 透传、wait 注入
  → apimart-gateway:9004 /v1/images|videos|chat   ← 网关（main.py）
       ├─ get_lovart_client(): 读 Bearer <user_key> → 映射成 Lovart AK/SK
       ├─ _IMAGE_RULES/_VIDEO_RULES: model 名 → Lovart 工具名（generate_image_*）
       └─ lovart_client.py: HMAC-SHA256 签名 → lgw.lovart.ai/v1/openapi/*
  → Lovart 上游
```

**接不上的根源（代码事实）**：
- 网关鉴权 = 把 `Bearer user_key` 换成 Lovart AK/SK（`main.py:245-260`）
- 网关模型 = 写死的 Lovart 工具名（`main.py:97-149`）
- 网关协议 = **只有 Lovart HMAC 一种**（`lovart_client.py` 全程走 `/v1/openapi`）
- **所以现在没有地方填第二个供应商的 `base_url+key`，也没有代码按 `protocol` 去请求别的站。** UI 里配 openai/volcengine/runninghub 一律配了也接不上。

## 二、正确结论：前后端必须配套，一个协议一个协议打通

不是"先做完整后端再做前端"，也不是"只做前端"。**必须前端 + 后端一起搭骨架，然后每打通一个协议，就真实多一个可切换的供应商。**

关键红线：**UI 开放哪些协议，由后端已实现的协议决定。** 后端做到哪个，UI 才放哪个；没实现的在 UI 标「即将支持」，绝不开放让用户配了白配。

## 三、打通"接入"的最小组件（按真实落点）

| # | 新增 | 落点 | 作用 |
|---|---|---|---|
| 1 | provider 注册表 + 管理 API | `apimart-gateway/providers.py`（新建）+ `main.py` 加 `/v1/providers` 系列 | 存 N 个供应商（id/name/base_url/protocol/key） |
| 2 | 协议分派器 | `main.py` 各生成路由入口，按 `provider_id` 选 client | 不同供应商走各自的请求逻辑 |
| 3 | 各协议 client | 第一个非 Lovart：`openai_client.py`（新建） | 真正按 OpenAI 协议发请求、读结果 |
| 4 | 前端 provider 面板 | `prototypes/react-nodes/src/components/base/ProviderSettings.jsx` + `providerStore.js`（新建） | 画布里配 / 切换供应商 |

> **顺序**：1+3+2（后端把"Lovart + 1 个 OpenAI 兼容站"两条协议都跑通）→ 4（前端 UI 配这两个）→ 验证真实切换出图。然后第 2 个新协议再重复一遍。

## 四、分阶段实施（每阶段可验证，Lovart 零回归）

### M1 · 后端协议分派骨架 + 第一条非 Lovart 协议（openai 兼容站）
**目标：后端能按 `provider_id` 同时接 Lovart 和任意 OpenAI 兼容站。**

- 新建 `apimart-gateway/providers.py`：
  - `SUPPORTED_PROTOCOLS = {openai, apimart, gemini, volcengine, runninghub, jimeng, codex, gemini-cli}`
  - `normalize_provider(item)`：id 合法性、base_url 以 http 开头、protocol 非法回退 openai
  - `load_api_providers()/save_api_providers()`：读写 `apimart-gateway/providers.json`
  - `get_api_provider(provider_id)`：不存在回退 primary / 默认 lovart
  - `effective_protocol(provider, model)`：单模型覆盖（`model_protocols`）
- `main.py`：
  - 新增 `dispatch_by_protocol()`：读请求的 `provider_id` / `X-Provider-Protocol`，选 client
  - `apimart` → 现有 `lovart_client.py` 路径（**零回归**）
  - `openai` → 新 `OpenAIProvider`（见下）
  - 新增 `/v1/providers`（GET 脱敏列表 / PUT 整表保存 / POST test-connection / GET :id/fetch-models）
- 新建 `apimart-gateway/openai_client.py`（`OpenAIProvider`）：
  - 4 种 `image_request_mode`：openai（`/images/generations`）、openai-json（`extra_body.image`）、openai-responses（`/v1/responses`+image_generation tool）、openai-video-proxy（伪装 `/v1/videos`）
  - 同步站直接取 `data[0].url`；异步站拿 `task_id` → 复用现有 `TaskService.check_and_fire_task` 轮询（`main.py:731`）
  - `extract_image`：兼容 `data[].url` / `b64_json` / `result.images` 多格式
  - key 走 `Bearer`，gemini 走 `x-goog-api-key`（`api_headers`）
- **验证**：`python -m uvicorn main:app --port 9004`；Lovart 老功能零回归；用 curl 对 OpenAI 兼容站（填 base_url+key）实测出图。

### M2 · localTool provider 管理 API
**目标：前端能通过 localTool 存/取多个供应商。**

- `localTool/src/routes/` 新建 `providers.ts`（自研语义名，走新建 SOP）：
  - `GET /api/providers` → 列表（key 脱敏 `has_key`/`key_preview`，绝不回传明文）
  - `PUT /api/providers` → 整表保存（id 去重、primary 唯一化、写 key 到 env）
  - `POST /api/providers/test-connection` → 探测 + 嗅探协议
  - `GET /api/providers/:id/fetch-models` → 拉上游模型按关键词分类 image/chat/video
- 存储：`localTool/data/api_providers.json`；key 不落 json，走 env（按 provider_id 隔离，如 `PROVIDER_{ID}_KEY`）
- 转发：`system.ts` 在 `/api/proxy` 转发时把当前 provider 的 `protocol` 注入 header（`X-Provider-Protocol`），网关据此分派
- **红线**：`platform.ts` 的 `BUILTIN_MODELS` 保留兜底；模型下拉改为「按当前选中 provider 动态合并」
- **验证**：`cd localTool && npm test`（73 项）

### M3 · 前端 provider 面板 + 模型下拉感知 provider
**目标：画布里能配/切换多个供应商，并真实影响请求。**

- 新建 `ProviderSettings.jsx`（面板：列表 + 动态表单 + 测试连接 + 拉取模型）+ `ProviderCard.jsx` + `ProviderForm.jsx`
- 新建 `providerStore.js`（localStorage 起，接 M2 后调 `/api/providers`）；初始 seed Lovart（零配置可跑）
- 入口：`CanvasToolbar.jsx` 加「Provider」按钮，或 `LeftPanel.jsx` 加 Tab
- 表单按 `protocol` 动态显隐：HTTP 类（base_url+key+image_request_mode+模型）/ CLI 类（无 key，显本机登录态）/ 方舟专属（region/project）
- **协议可用性从后端拉**（`/v1/providers` 返回 `supported_protocols`），未实现协议 UI 标「即将支持」禁用
- `ModelSelect.jsx` 改为读「当前节点所属 provider」的模型列表，不再传死数组
- **验证**：`npm run build` + `npm run test:smoke` + `npm run test:regression`

### M4 · 扩展更多供应商（每加一个协议重复一遍 M1 的 client 环节）
- `volcengine`（方舟 `/api/v3`，region+project，`X-Volc-*` 头）
- `runninghub`（工作流 `/openapi/v2` 提交 + 轮询）
- `gemini`（`/v1beta/models/:generateContent`，`x-goog-api-key`，参考图 inlineData）
- 本地 CLI（`jimeng`/`codex`/`gemini-cli`）：`localTool/src/routes/localCli.ts` spawn 子进程，产物走 `/files/` 落盘
- ComfyUI 局域网：独立入口，`/prompt` + `/history` 轮询

---

## 验收自检（接入能否落地，不是界面漂不漂亮）

- [ ] 后端能同时接 Lovart + 至少 1 个 OpenAI 兼容站，真实出图？（M1 最核心）
- [ ] UI 开放的协议 = 后端已实现的协议；未实现的一律禁用不误导？
- [ ] 配好 2 个供应商后，同一画布能切换、不同节点用不同供应商？
- [ ] 换供应商后模型下拉跟着变，且请求真实打到该供应商？
- [ ] Lovart 老功能零回归，端口/入口铁律不破？
- [ ] 三道门全绿：`npm run build` + `npm run test:smoke` + `npm run test:regression`；localTool 改动过则 `cd localTool && npm test`

---

## 参考来源（本次允许范围）
- 用户文档：`用所选项目新建的文件夹 3/多Provider接入改造方案.md`、`API接入机制最终版.md`（Nomi 三层 + 勘误）、`Infinite-Canvas多Provider机制全解析.md`、`吸取Infinite-Canvas经验强化一毛画布多端合一API接入方案.md`
- 自研代码：`apimart-gateway/main.py`（路由/鉴权/轮询/TaskService）、`lovart_client.py`（HMAC 客户端）、`contract.py`（字段契约）、`localTool/src/routes/system.ts`（/api/proxy 转发）、`routes/platform.ts`（静态兜底）
- 范式来源：Nomi `catalog` 声明式 Vendor/Model/Mapping；Infinite-Canvas `api_providers.json` + `generate_ai_image` 分派 + `api-settings.js` 前端驱动表
