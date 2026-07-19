# APIMart 兼容中转站（后端驱动 Lovart）

把 **APIMart 风格的外向接口** 翻译成 **Lovart OpenAPI** 调用。原本用 APIMart 协议的客户端，
只需把 `base_url` 换成你的域名、Key 换成你发的 Key，协议零改动即可经本中转站调用 Lovart。

## 架构

```
APIMart 客户端
   │  (OpenAI 风格 chat / 异步 image·video·music 任务 / 上传 / 任务查询)
   ▼
本中转站 (FastAPI)   ← 鉴权替换：用户 Key → Lovart AK/SK
   │  (协议翻译)
   ▼
Lovart OpenAPI (HMAC-SHA256, /v1/openapi/chat 异步 agent)
```

## 运行

```bash
pip install -r requirements.txt

# 单上游凭据
export LOVART_ACCESS_KEY=ak_xxx
export LOVART_SECRET_KEY=sk_xxx

# 多用户（可选）：用户Key -> "ak|sk"
# export USER_KEYS='{"sk-user-1":"ak_1|sk_1","sk-user-2":"ak_2|sk_2"}'

uvicorn main:app --host 0.0.0.0 --port 8000
```

生产环境务必 `OPEN_RELAY=false`（默认即 false）并配置 `USER_KEYS` 或 `LOVART_ACCESS_KEY/SECRET_KEY`。

## 端点映射

| 外向（APIMart 兼容） | 内部（Lovart） |
|---|---|
| `POST /v1/chat/completions` | `chat`（取最后一条 user 消息为 prompt，poll 后取 assistant 文本） |
| `POST /v1/images/generations` | `chat` + `IMAGE` 模型偏好（异步 task） |
| `POST /v1/videos/generations` | `chat` + `VIDEO` 模型偏好（异步 task） |
| `POST /v1/music/generations` | `chat`（agent 处理音乐，异步 task） |
| `GET /v1/tasks/{id}` | `chat/result`（任务完成后的 result 映射） |
| `POST /v1/uploads/images` | `file/upload`（multipart → CDN URL） |
| `GET /v1/balance` | `mode/query`（Lovart 无余额，返回占位） |
| `POST /v1/audio/generations` | `chat`（音乐 agent，别名，方便老调用方） |
| `POST /v1/audio/speech` | **诚实 501**：Lovart 后端无 TTS 能力，不编造接口 |
| `POST /v1/audio/transcriptions` | **诚实 501**：Lovart 后端无语音转写能力，不编造接口 |
| `POST /v1/images/edits` | 图生图（multipart）：参考图上传 CDN → 当 attachment → IMAGE 生成 |

## 兼容性说明

- 异步提交返回数组 `[{status:"submitted", task_id}]`（对齐 APIMart 文档）。
- 任务结果 `result.images[].url` 为数组、`expires_at` 为整数（Lovart CDN 持久，故给远未来值）。
- 错误体：`{"error":{"code","type","message"}}`。
- 成功体：`{"code":200,"data":{...}}`。
- `webhook` 字段：提交时传入基础 URL，任务终态会 POST 到 `<webhook>/callback`。
- chat 多模态：messages 里的 `image_url`（支持 `data:` base64 内联图）会上传 CDN 当附件；chat 走 `thinking` 线程级推理（`LOVART_CHAT_MODE` 可配）。
- 生图/视频支持 `size` 像素尺寸（如 `1008x1344`）自动换算为 Lovart 比例+分辨率，并强制单图/单视频输出。

## 测试

单一离线回归测试，无需 Lovart 凭据即可运行，覆盖 **42 项断言**，分三段打印：

```bash
python3 verify_gateway.py
#   ── ① 契约自验证（17 项）：端点映射 / result 形状 / 契约字段，逐条对齐 APIMart 文档
#   ── ② webhook 重试（3 项）：钉死 §十 重试策略
#   ── ③ 路由行为（22 项）：鉴权矩阵 / chat 上下文 / mode / SSE / 信封 / audio 501
```

各段要点：

- **① 契约自验证**：纯函数 `lovart_to_apimart` / `assistant_text` / `resolve_prefer_models` 的形状断言。
- **② webhook 重试策略**（§十）：
  - 4xx 终态 → 立即放弃，不再重试；
  - 5xx 终态 → 最多重试 3 次后标记 `webhook_sent=True` 放弃；
  - 200 终态 → 标记完成，不再轮询。
- **③ 路由行为**（离线 mock `LovartClient`）：
  - 鉴权矩阵：`OPEN_RELAY` / `USER_KEYS` / 默认凭据 fallback 不降级；
  - chat 多轮：`system`/`assistant` 带 `[role]` 前缀、user 直拼、无 user → 400；
  - mode 语义：`unlimited`→`set_mode(True)`、`fast`→`set_mode(False)`、非法→不调；
  - SSE：`stream:true` 吐 chunk + `[DONE]`、`stream:false` 同步 JSON；
  - 信封/错误形状：`ok()` / `err()` / `auth_error()`；
  - audio 端点：诚实 501 `not_supported_error`；
  - 异步提交信封：`{code:200,data:[{status:submitted,task_id}]}`。

> ② 的 webhook 契约测试最初从 relay 侧移植而来（relay 早期曾因缺此测试漏掉 webhook
> 无限重试 bug）。移植时已按 gateway 的真实键名（`webhook_sent` / `webhook_retries`）与
> `WEBHOOK_RETRY_INTERVAL` 退避语义适配。relay 现已归档，gateway 为唯一真源。

## 配置

参考 `./.env.example`（gateway 实际读取的变量清单，含 gateway 特有的 `CF_BM` /
`LOVART_INSECURE_SSL`）。注意以下与 relay 的差异，请勿照搬 relay 的 `.env.example`：

- `USER_KEYS` 为字符串格式：`"sk-user-1":"ak_1|sk_1"`，**非**嵌套字典。
- 不读取 `LOVART_PATH_PREFIX`（gateway 写死 `/v1/openapi`）。
- 无 `WRAP_RESPONSE` 开关（gateway 定位即带 `{code,data}` 信封）。

## 已知限制（v1）

- 任务库为内存字典，重启即丢、多 worker 不共享 → 生产换 Redis/DB。
- chat 为无状态：每次调用新建 Lovart project/thread，不保留多轮上下文（OpenAI 风格需自行在 messages 里带历史）。
- 模型映射为常见子集，未命中的 model 走 Lovart agent 自动路由。
- 流式 chat 为最小实现：生成完成后一次性吐完整内容 + `[DONE]`（非逐字增量）。
- `/v1/balance` 为占位（Lovart 未提供余额接口）。
