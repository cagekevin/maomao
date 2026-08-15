# Provider 字段契约（定稿 · 对齐 Infinite-Canvas 市场通用）

> **这份是唯一真相**。所有 provider 代码（后端 `providers.py`、前端 `ProviderSettings.jsx`、注册表 `providers.json`）**字段名一律照此定稿**，与 Infinite-Canvas `ApiProviderPayload`（main.py:2595-2623）+ `api_providers.json` 一字不差。
>
> **为什么要定稿**：现在就把字段名钉死成市场通用的，以后加字段直接加，**不用加翻译层、不增加复杂度**。这就是打地基的意义。
>
> 来源：`/Users/kevin/Documents/画布/Infinite-Canvas/main.py:2595-2623` + `data/api_providers.json`。

---

## 一、provider 对象字段（全部字段，一字不差）

| 字段 | 类型 | 默认 | 含义 | 存放 |
|---|---|---|---|---|
| `id` | str | "" | 唯一标识，路由键（`^[a-zA-Z0-9_-]{2,40}$`） | json |
| `name` | str | "" | 展示名（≤60 字，空白归一） | json |
| `base_url` | str | "" | API 基地址，必须以 http(s) 开头；CLI 类留空 | json |
| `protocol` | str | "openai" | 协议身份（8 选 1），非法回退 openai | json |
| `image_request_mode` | str | "openai" | 图像请求形态（4 选 1），非法回退 openai | json |
| `image_generation_endpoint` | str | "" | 可覆盖文生图端口（`/v1/images/generations`） | json |
| `image_edit_endpoint` | str | "" | 可覆盖图生图/编辑端口（`/v1/images/edits`） | json |
| `enabled` | bool | true | 启用开关 | json |
| `primary` | bool | false | 首选标记（**全表最多 1 个 true**） | json |
| `image_models` | List[str] | [] | 文生图模型清单 | json |
| `chat_models` | List[str] | [] | 聊天模型清单 | json |
| `video_models` | List[str] | [] | 视频模型清单 | json |
| `model_names` | Dict[str,str] | {} | 单模型显示名覆盖 | json |
| `model_protocols` | Dict[str,str] | {} | 单模型协议覆盖（仅 openai/gemini 可） | json |
| `ms_loras` | List[Dict] | [] | ModelScope Lora 清单（专属） | json |
| `ms_defaults_version` | int | 0 | ModelScope 默认版本（专属，灰度升级用） | json |
| `rh_apps` | List[Dict] | [] | RunningHub AI 应用（专属） | json |
| `rh_workflows` | List[Dict] | [] | RunningHub 工作流（专属） | json |
| `volcengine_project_name` | str | "default" | 火山方舟项目名（专属） | json |
| `volcengine_region` | str | "cn-beijing" | 火山方舟区域（专属） | json |

## 二、只在环境变量、绝不落 json 的字段（key 类）

| 字段 | 含义 | 存放 | env 名 |
|---|---|---|---|
| `api_key` | 主 key | env | `provider_key_env(id)`：`comfly→COMFLY_API_KEY`；自定义→`API_PROVIDER_{ID大写}_KEY` |
| `wallet_api_key` | RunningHub 钱包 key（专属） | env | `RUNNINGHUB_WALLET_API_KEY` |
| `volcengine_access_key_id` | 火山 AK（专属） | env | `VOLCENGINE_ACCESS_KEY_ID` |
| `volcengine_secret_access_key` | 火山 SK（专属） | env | `VOLCENGINE_SECRET_ACCESS_KEY` |

## 三、列表脱敏只读字段（GET /api/providers 返回，key 不回明文）

| 字段 | 含义 |
|---|---|
| `has_key` | 是否已配 key |
| `key_preview` | key 掩码 |
| `key_env` | key 所在 env 名 |
| `has_wallet_key` / `wallet_key_preview` / `wallet_key_env` | RunningHub 钱包 key（专属） |
| `has_volcengine_access_key` / `..._preview` / `..._env` | 火山 AK（专属） |
| `has_volcengine_secret_key` / `..._preview` / `..._env` | 火山 SK（专属） |

## 四、PUT /api/providers 的「清 key」标志位（防回显）

| 字段 | 类型 | 作用 |
|---|---|---|
| `clear_key` | bool | 清掉主 key 不重设 |
| `clear_wallet_key` | bool | 清掉钱包 key |
| `clear_volcengine_access_key_id` | bool | 清掉火山 AK |
| `clear_volcengine_secret_access_key` | bool | 清掉火山 SK |

---

## 五、两个正交枚举（不可改）

### protocol（8 选 1）`SUPPORTED_PROVIDER_PROTOCOLS`
`openai` / `apimart` / `gemini` / `gemini-cli` / `volcengine` / `runninghub` / `jimeng` / `codex`

### image_request_mode（4 选 1）`SUPPORTED_IMAGE_REQUEST_MODES`
`openai` / `openai-json` / `openai-video-proxy` / `openai-responses`

### 协议锁死规则（normalize 时强制）
- `volcengine` id → 锁 `protocol=volcengine`，base 补默认 `ark.cn-beijing.volces.com/api/v3`
- `jimeng` → 锁 `protocol=jimeng`，base 置空
- `codex` / `gemini-cli` → base 置空（CLI）
- `runninghub` id → 锁 `protocol=runninghub`，base 补默认 `www.runninghub.cn`
- `locked_recommended_provider_rule`：按 id/name/base_url 域名匹配已知站（fhl/exellome）→ 锁 protocol + request_mode

---

## 六、我们默认 seed（第一个 provider = 我们 9004）

```json
[{
  "id": "lovart",
  "name": "Lovart(自托管)",
  "base_url": "http://127.0.0.1:9004",
  "protocol": "apimart",
  "image_request_mode": "openai",
  "image_generation_endpoint": "",
  "image_edit_endpoint": "",
  "enabled": true,
  "primary": true,
  "image_models": ["gpt-image-2-low", "gpt-image-2-medium", "gpt-image-2", "nano-bn-pro", "nano-bn-2"],
  "chat_models": ["lovart-chat"],
  "video_models": ["seedance-2.0-fast", "seedance-2", "kling-v3-omni"],
  "model_names": {},
  "model_protocols": {},
  "ms_loras": [],
  "ms_defaults_version": 0,
  "rh_apps": [],
  "rh_workflows": [],
  "volcengine_project_name": "",
  "volcengine_region": ""
}]
```

---

## 七、铁律

1. **字段名永远照本表**，绝不发明新名（避免加翻译层）。`id` 不叫 `provider_id`，`base_url` 不叫 `api_base`，`protocol` 不叫 `type`。
2. **key 类字段永远只进 env，绝落 json**；列表接口一律 `has_key`+`key_preview` 脱敏。
3. **primary 唯一化**：PUT 时多个标记取最后，其余置 false（main.py:12511-12515）。
4. **id 重复 → 400**；至少保留 1 个 provider（main.py:12508-12509）。
5. **协议锁死**在 normalize 里强制，用户填错也会被纠正。
6. 每个平台专属字段（`ms_*`/`rh_*`/`volcengine_*`）在 `normalize_provider` 里归一，未用到的默认空。
