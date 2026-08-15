# 地基拆解：照抄 Infinite-Canvas 的多供应商接入

> **定位**：你要的"地基" = 把 Infinite-Canvas 的多供应商接入逻辑**原封不动搬过来**，逻辑照抄，UI 配色用我们原型。
> **第一个 provider** = 你们自己的 `apimart-gateway:9004`（Lovart）。它不是"第一个要接的新供应商"，而是**默认地基供应商**。
>
> 来源：`/Users/kevin/Documents/画布/Infinite-Canvas/`（真实源码，已逐行定位）。

---

## 一、Infinite-Canvas 多供应商地基 = 4 层

```
┌─────────────────────────────────────────────────────────────┐
│ ① 数据层  data/api_providers.json（3311 行，真实注册表）      │
│    N 个 provider，每个含 protocol/base_url/key/models/平台特定  │
├─────────────────────────────────────────────────────────────┤
│ ② 后端层  main.py                                            │
│    注册表读写 + 协议分派器 + 各协议 client + 管理 API          │
│    normalize_provider(1254) / get_api_provider(1381)         │
│    generate_ai_image(10482) / wait_for_image_task(6173)      │
│    GET/PUT /api/providers(12457/12461)                       │
│    test-connection(12768) / fetch-models(13157/13164)        │
├─────────────────────────────────────────────────────────────┤
│ ③ 前端层  static/js/api-settings.js（200KB）                  │
│    provider 列表 + 动态表单 + 推荐站点 + CLI 面板 + 测试连接   │
│    RECOMMENDED_APIS / CLI_PROTOCOLS / applyCliProtocolDefaults│
├─────────────────────────────────────────────────────────────┤
│ ④ 静态资源  static/api-settings.html（表单结构）              │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、每个 provider 的完整数据契约（照抄 api_providers.json）

```json
{
  "id": "modelscope",
  "name": "ModelScope",
  "base_url": "https://api-inference.modelscope.cn/v1",
  "protocol": "openai",                 // 8 选 1：openai/apimart/gemini/gemini-cli/volcengine/runninghub/jimeng/codex
  "image_request_mode": "openai",       // 4 选 1：openai/openai-json/openai-video-proxy/openai-responses
  "image_generation_endpoint": "",
  "image_edit_endpoint": "",
  "enabled": true,
  "primary": false,                     // 最多 1 个
  "image_models": [...], "chat_models": [...], "video_models": [...],
  "model_names": {},                    // 单模型显示名覆盖
  "model_protocols": {},                // 单模型协议覆盖（仅 openai/gemini 可）
  "ms_loras": [...], "ms_defaults_version": 0,   // ModelScope 专属
  "rh_apps": [...], "rh_workflows": [...],       // RunningHub 专属
  "volcengine_project_name": "", "volcengine_region": ""   // 火山专属
}
```

**协议两类**：
- HTTP 远程：openai / apimart / gemini / volcengine / runninghub
- 本地 CLI（`base_url` 留空，靠登录态）：jimeng / codex / gemini-cli（`CLI_PROTOCOLS`，api-settings.js:95）

---

## 三、后端要搬的 9 个核心函数（main.py）

| 函数 | 行号 | 作用 | 抄到我们哪 |
|---|---|---|---|
| `SUPPORTED_PROVIDER_PROTOCOLS` | 317 | 8 种协议白名单 | `providers.py` |
| `SUPPORTED_IMAGE_REQUEST_MODES` | 318 | 4 种请求形态 | `providers.py` |
| `normalize_provider` | 1254 | 清洗+校验+锁协议 | `providers.py` |
| `load_api_providers` | 1313 | 读 json+归一 | `providers.py` |
| `get_api_provider` | 1381 | 按 id 取，回退 primary | `providers.py` |
| `get_api_provider_exact` | 1394 | 严格取（未保存表单用） | `providers.py` |
| `effective_protocol` | 4316 | 单模型协议覆盖 | `providers.py` |
| `generate_ai_image` | 10482 | 生图总分发器 | `main.py` 分派 |
| `wait_for_image_task` | 6173 | 统一异步轮询 | 复用现有 TaskService |

**管理 API 路由（要抄到我们网关）**：
| 路由 | 行号 | 作用 |
|---|---|---|
| `GET /api/providers` | 12457 | 列表（key 脱敏） |
| `PUT /api/providers` | 12461 | 整表保存（primary 唯一化） |
| `POST /api/providers/test-connection` | 12768 | 探测 + 嗅探协议 |
| `POST /api/providers/probe-async` | 12881 | 探测异步任务端点 |
| `POST /api/providers/fetch-models` | 13157 | 拉上游模型分类 |
| `GET /api/providers/{id}/fetch-models` | 13164 | 同上，按 id |

---

## 四、前端要抄的（api-settings.js）

| 东西 | 位置 | 作用 |
|---|---|---|
| `RECOMMENDED_APIS` | 155 起 | 预置推荐站点（一键填 base_url/protocol/models） |
| `CLI_PROTOCOLS` / `API_PROTOCOLS` | 95/96 | 协议分类 |
| `applyCliProtocolDefaults` | 130 | CLI 协议自动填默认模型 |
| `ONBOARDING_GUIDES` | 102 | 引导注册链接 |
| 表单字段 | 头部 DOM 引用 | name/id/base/protocol/imageRequestMode/key |
| CLI 专属面板 | jimengCliPanel/codexCliPanel/geminiCliPanel | 本机登录态 |
| 方舟专属 | volcAk/volcSk/volcProject/volcRegion | 双凭证 |
| RunningHub 专属 | rhAppsList/rhWorkflowsList | 工作流编辑器 |

---

## 五、落地到我们项目（逻辑照抄，配色用原型）

### 关键结论（之前打转的根源在此）
- **我们的 `localTool /api/proxy` 已是协议无关转发**（system.ts 只透传+剥信封+SSE+wait），所以接入重心 100% 在 `apimart-gateway`。
- **第一个 provider = 我们自己的 9004 网关**（Lovart，`protocol:apimart`），作为默认地基，零回归。
- Infinite-Canvas 的管理 API 路径是 `/api/providers`（在它自己的后端）；我们要抄的是**逻辑**，路径放我们网关用 `/v1/providers`，localTool 加 `/api/providers` 透传。

### 落点
| 层 | 抄 Infinite-Canvas 什么 | 放我们哪 |
|---|---|---|
| 后端注册表 | `api_providers.json` + `normalize_provider`/`load_api_providers`/`get_api_provider`/`effective_protocol` | `apimart-gateway/providers.py` + `providers.json` |
| 后端分派 | `generate_ai_image` 按 protocol 分发 | `apimart-gateway/main.py` 各生成路由 |
| 后端管理 API | `GET/PUT /api/providers`、`test-connection`、`fetch-models` | 网关 `/v1/providers*` + localTool `/api/providers` 透传 |
| 前端面板 | `api-settings.js` 表单逻辑 + `api-settings.html` 结构 | `prototypes/react-nodes/src/components/base/ProviderSettings.jsx`（配色用原型） |
| 前端数据 | `RECOMMENDED_APIS` | 原型 `providerStore.js` 内 seed |
| 异步轮询 | `wait_for_image_task` | 复用现有 `TaskService.check_and_fire_task`（main.py:731） |
| 产物归一 | `extract_image`（3882） | `openai_client.py` / 各 client |

---

## 六、执行顺序（地基搭建）

| 步骤 | 做什么 | 产出 | 验证 |
|---|---|---|---|
| 1 | 抄 `providers.py`（注册表+归一+effective_protocol）到网关 | provider 数据结构就绪 | 导入不报错 |
| 2 | 抄 `GET/PUT /v1/providers` 到网关；seed 默认 = 我们 9004(Lovart) | 网关可存 N 个供应商 | curl 存取 |
| 3 | 抄 `generate_ai_image` 分派骨架：先只接 `apimart`(Lovart) 分支 | 老功能零回归 | 现有出图正常 |
| 4 | 加 `test-connection` + `fetch-models`（探测+分类） | 能测连通、拉模型 | curl 实测 |
| 5 | localTool 加 `/api/providers` 透传（读网关 `/v1/providers`） | 前端能取供应商 | `npm test` |
| 6 | 前端照抄 `api-settings.js` 逻辑做 `ProviderSettings.jsx`（配色用原型） | 能配/切换供应商 | `npm run build` + 真机 |

> **注**：步骤 2 的默认 seed 用我们自己的 9004（`protocol:apimart`），而不是 Infinite-Canvas 的 modelscope/runninghub。之后每接一个新供应商，就在注册表加一条 + 加一个协议 client（openai→volcengine→runninghub→gemini→CLI）。

---

## 七、需要你确认的 2 点

1. **管理 API 路径**：Infinite-Canvas 后端直接暴露 `/api/providers`；我们网关是 `/v1/providers`，localTool 再透传 `/api/providers`。这个分层 OK 吗？
2. **第一个"非地基"供应商**：地基搭好后，第二个供应商你希望先接谁？（openai 兼容站 / 火山方舟 / RunningHub / 其它）
