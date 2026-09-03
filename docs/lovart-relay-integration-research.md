# Lovart 直连集成进 ai-relay 研究报告

> 只做研究，不改代码。目标：把 Lovart 直连进 `localTool` 的 `ai-relay`（**仅方案 B**），
> 去掉 9004 网关中间层；并**保证 Lovart 的 chat + image + video 三项功能**稳定可用。

---

## 0. 范围与边界（用户明确）

**目标**：relay 自己完成 HMAC 签名 / project 管理 / 参考图上传 / chat 轮询 / confirm，直连 Lovart 上游，
不再依赖独立 Python 9004 进程。实现方式 = 把 `main.py` 行为 **1:1 翻译成 TS**，不在 relay 里发明 main.py 没有的能力。

**范围边界**：

| 项 | 结论 |
|----|------|
| 保证的功能 | 仅 **聊天 chat + 生图 image + 生视频 video**（严格照 `main.py` 现有设置） |
| 不实现 | music / audio / speech / TTS / voice / 3D(Tripo) / upscale / 海报 / 轮播 / 横幅（上游全量清单，不是我们要的） |
| 不续聊 | 每次请求作为独立新 project/chat，不持久化 `thread_id`、不做多轮会话 |
| 不暴露推理模式 | 推理轴写死：chat = `thinking`，image/video = 不传（默认 `fast`） |
| 模型清单 | 沿用 `main.py` 精选子集，**不扩到官方 20+ 全量**（稳定优先） |

> 上游能做的远不止这三项（见 §1），但那些不在本集成范围：功能越多越不稳、用户越麻烦。

**研究对象（API 层）**：
- `apimart-gateway/main.py` —— 9004 网关，Lovart 适配逻辑（**最权威的"我们要什么"来源**）
- `apimart-gateway/lovart_client.py` —— 9004 对 Lovart 上游的真实客户端（HMAC + chat）
- `.codebuddy/skills/lovart/agent_skill.py` —— 官方零依赖客户端（**最权威的"上游契约"参考**，建议 port）
- `localTool/src/ai-relay/*` —— relay 当前集成状态

---

## 1. Lovart 上游契约（背景，仅理解用）

> 本节描述上游**能做的**，不等于本集成范围。本集成只取 chat + image + video。

**本质**：线程式智能体平台，所有能力经单一 `chat` 入口 + `tool_config` 驱动。没有独立的"生图/生视频 REST 端点"。

**鉴权**：AK/SK **HMAC-SHA256** 动态签名（`agent_skill.py:56-69` 与 `lovart_client.py:129-147` 一致）：

```
ts   = str(int(time.time()))
sig  = HMAC-SHA256(secret, f"{method}\n{path}\n{ts}")   # path 含 /v1/openapi 前缀
headers = { X-Access-Key, X-Timestamp: ts, X-Signature: sig,
            X-Signed-Method: method, X-Signed-Path: path }
```
- 每次重试必须**重新签名**（时间戳刷新）；base_url `https://lgw.lovart.ai`，path_prefix `/v1/openapi`。
- 重试仅对 `404/429/502/503`（`lovart_client.py:26`）。

**核心端点**（均 `/v1/openapi` 下，`agent_skill.py`）：

| 方法 | 路径 | 作用 |
|------|------|------|
| POST | `/project/save` | 建/更新 project（`project_type=3`） |
| GET | `/project/validate` | 校验 project 是否失效（重建依据） |
| POST | `/mode/set` | `{unlimited:bool}` 配额轴 |
| POST | `/mode/query` | 查询当前模式 |
| POST | `/chat` | 唯一生成入口，body 含 `tool_config` |
| GET | `/chat/status` | `?thread_id=` 任务状态 |
| GET | `/chat/result` | `?thread_id=`（含 `pending_confirmation` / `items[].artifacts[]`） |
| POST | `/chat/confirm` | `{thread_id}` 高成本确认 |
| POST | `/file/upload` | 参考素材上传 CDN，返回 `data.url` |

**`tool_config` 三键**（`agent_skill.py:278-286`）：`prefer_tool_categories`（软偏好）/ `include_tools`（硬约束）/ `exclude_tools`（硬排除）。选模型官方首选结构化路（`prefer_tool_categories`）。

**两条 mode 轴（澄清"生图 fast / 聊天 thinking"指代）**：
- **配额轴** `set_mode(unlimited=True/False)`：服务端持久设置，与推理质量无关；`False`=fast（耗额度）。
- **推理轴** `send(mode="thinking"|"fast")`：按 thread 锁首条；`fast` 默认、`thinking`=深度推理。**用户说的"生图 fast / 聊天 thinking"指这一轴。**

---

## 2. main.py 现有行为（relay 须 1:1 复刻的权威来源）

### 2.1 模型清单（精选子集）

`main.py` 实测（非文档臆测）：

| 类别 | 条数 | 模型（`_IMAGE_RULES` / `_VIDEO_RULES`） | 工具 | prompt_only |
|------|------|------------------------------------------|------|-------------|
| IMAGE | **6** | gpt-image-2-low / gpt-image-2-medium / gpt-image-2 / nano-bn-pro / nano-bn-2 / nano-bn-2-lite | 前 5 个有 | nano-bn-2-lite |
| VIDEO | **5** | seedance-2.0-fast / seedance-2 / kling-v3-omni / seedance-2.0-mini / minimax-h3 | 前 3 个有 | seedance-2.0-mini, minimax-h3 |
| CHAT | 1 | lovart-chat（thinking） | — | — |

- `prompt_only` = 工具名为空，`resolve_prefer_models` 返 `None`，只走自然语言路（`main.py:354-366`）。
- 可读模型名映射 `_PROMPT_MODEL_NAMES`（`main.py:180-186`）：内部代号（如 `nano-bn-2-lite`）→ 官方可读名（`Nano Banana 2 Lite`）。
- **relay 现状偏差**：当前 `LOVART_MODEL_MANIFEST` 是 image 4 / video 5 / text 1（共 10），缺 `gpt-image-2` 与 `nano-bn-2-lite`。直连时应补齐为 main.py 的 **6 / 5 / 1**。

### 2.2 提示词工程（正确性硬约束，Lovart 是 Agent 不是 REST）

必须复刻 `build_gen_prefix`（`main.py:513-547`）+ `<user_prompt>` 包裹（`main.py:1258-1259`）。
生图/生视频的最终 prompt = `gen_prefix` + 包裹后的用户原文：

```
{target_size / aspect_ratio / duration / resolution}        # 结构化尺寸约束
Generate exactly ONE image using the {可读模型名} model.     # 生成意图（有参考图加 "Reference image attached. "）
<user_prompt>
{用户原提示词}
</user_prompt>
以上为用户提示词原文，直接使用，请勿修改
```
- 图片只传像素 `target_size`（不传 1K/1080p 档位文字，避免与比例冲突）；视频传 `aspect_ratio`+`duration`+`resolution`（`main.py:1237-1247`）。
- ⚠️ 绝不写 "Use reference and edit"——那会引导 Lovart 走 `edit_media` 改图；本集成每次都是生成新图（`main.py:535`）。
- `_PROMPT_MODEL_NAMES` 把内部代号翻可读名写进 instruction，让 Agent 读懂用哪个模型。

**双路选模型（两路都要）**：
1. 自然语言路：`{可读模型名}` 写进 instruction（见上）。
2. 结构化路：`resolve_prefer_models(model, category)` 映射成 `{IMAGE:[tool]}`/`{VIDEO:[tool]}`，作为 `tool_config.prefer_tool_categories` 下发（`lovart_client.py:242-250`）。
3. `prompt_only` 模型（tool 为空）→ 只走自然语言路，不下发 `prefer_tool_categories`。

### 2.3 参考图上传（`resolve_attachments`，`main.py:671-777`）

统一把 `image_urls`/`images`/`attachments`/`reference_images`/`videos`(or `reference_videos`)/`audios`(or `reference_audios`)/`files` 抽成 Lovart CDN URL；
支持 http(s)/data:base64/裸 base64(魔数识别)/本机回环(网关自下载再传 CDN)/blob 丢弃。
**任一真实上传失败即阻断**（不发出不齐的参考图）。

### 2.4 轮询与 confirm（`check_and_fire_task`，`main.py:792-895`）

- `done` → 等 **5s** 再查一次（防子 Agent 未启动的竞态，`main.py:822` / `agent_skill.py:306`）。
- **`pending_confirmation` 从 `get_result().pending_confirmation` 读**（`main.py:832,869` 已正确处理，非盲区）→ `AUTO_CONFIRM` 自动 `confirm` 或转 `pending_confirmation` 错误。
- **`done` 但无 artifact**（`main.py:885-890`）：`status==done` 但 `items[].artifacts` 全空 = Agent 仅回文本（审核拒绝/超时/不选工具）→ 返回 `failed` + `no_artifact` 原因，**不冒充成功出图**（官方 `agent_skill.py:414-433` 同逻辑）。
- `abort` → 失败终态（`presets.ts` 把 abort→failed、running→processing 须保留，`presets.ts:108-109`）。

### 2.5 聊天端点（thinking + SSE 流式 / 同步）

`set_mode(unlimited=False)` + `mode=Config.CHAT_THREAD_MODE`（默认 `thinking`，`main.py:1066,1072`）。
> ⚠️ `set_mode(unlimited=False)` **必须显式调用，不可依赖上游默认**：若某账号默认 unlimited，额度会哗哗扣。image 端点同样（`main.py:1271-1275` 读 `Config.DEFAULT_MODE` 后显式 `set_mode`）。奥卡姆剃刀的反例——这步"看似可省"实则直接关系到钱，绝不能砍。

**轮询**：`run_and_get` 自循环（`main.py:1062-1127`）——`get_status` 轮询（非 `check_and_fire_task`），`CHAT_SYNC_TIMEOUT`（默认 300s）内未完成 → 抛 **504**（L1127）。含 **done→abort 翻转**处理（L1087：二次确认期间任务在 done/abort 间翻转，abort 必须作失败终态抛出，绝不能吞结果返 200）。

**SSE 流式（默认开启）**：`stream` 默认 `True`（`main.py:1060`）。流式走 `StreamingResponse` `gen()`（L1130-1160）：每 2s 发 `: heartbeat` → 取到结果发 `chat.completion.chunk`（含 `content=chat_content`）→ `data: [DONE]`；异常发 `data: {error}` + `[DONE]`。非流式则同步返 `chat.completion`（L1162-1175）。
> relay 必须**合成 SSE**（上游 Lovart 本身不推流）。已核对官方 `agent_skill.py`：全程 `urllib` 阻塞 HTTP，`send`/`get_status`/`get_result`/`poll` 均为请求-响应轮询，无 SSE/分块流；其 `watch` 子命令仅向 stdout 输出 NDJSON（非 HTTP SSE，`agent_skill.py:89-90, 258-344, 881-936`）。故 relay 须把轮询结果包成 OpenAI `chat.completion.chunk` 流，画布聊天节点依赖流式。

响应 `chat_content` = `assistant_text`（多 text 拼接）+ 媒体 markdown 链接（`![image](url)` / `[video](url)` / `[audio](url)`，`main.py:388-400`）。
`usage` 字段返回全 0（`main.py:1174`，上游不提供 token 计数）。

### 2.6 尺寸 / 参数

`parse_size`（`main.py:435-478`）把「比例 × 档位」算成固定像素 `target_size`，**4 分支**逻辑：
1. 精确像素（`1024x1024`）→ 原样返回，档位按长边推导。
2. 纯比例（`16:9`）+ 档位 → 按目标长边算固定像素（横图宽对齐、竖图高对齐）。
3. 只有档位（`1K`）→ 仅给档位，不算像素。
4. `auto` / 空 / 无法解析 → 不指定尺寸，兜底档位。

关键常量（轮询一致性依赖，必须 1:1 复刻）：
- `DEFAULT_LONG_EDGE = 1920`（`main.py:405`，比例兜底长边）。
- `DEFAULT_RESOLUTION = "1080p"`（`main.py:407`，兜底档位名）。
- `AUTO_KEYS = ("auto","自动","any","随机")`（`main.py:409`）。
- `_RES_LONG_EDGE`（`main.py:413-418`）：档位→目标长边，`1k/1080p/fhd→1920`、`2k/1440p/qhd→2560`、`4k/2160p/uhd→3840`、`hd/720p→1280`。

> 不补档位映射：前端传 `1K`/`2K` 时输出像素每次漂移（576×1344 / 768×1376…），不崩但质量不一致。
结果 `lovart_to_apimart` 给每个 URL 打 `expires_at`（TTL=86400，`main.py:371`）——**不可砍（§2.8 #13）**。

### 2.7 已裁剪 / 奥卡姆剃刀剔掉的边角（本集成不实现，且对功能、请求、轮询无影响）

- 501 端点：`/v1/music/generations`、`/v1/audio/generations`、`/v1/audio/speech`、`/v1/audio/transcriptions`（`main.py:1511-1516`）。
- `GET /v1/balance` 桩：砍掉（上游不暴露余额，返回 -1 无调用方依赖）。
- `POST /v1/images/edits` 独立端点：砍掉；**带参考图生成新图的能力并入 `/v1/images/generations`**（main.py `_do_submit` 本就读取 `reference_images`，图生图不受影响）。
- `POST /v1/draw/completions` 别名：砍掉，复用 `images/generations`。
- webhook 异步回调：砍掉（非 chat/image/video 必需，relay 走 presets 轮询，不依赖 webhook）。
- 配额轴：image 端点读 `body.get("mode")`（main.py:1265）可覆盖 `set_mode(unlimited)`，默认 fast；推理轴不传（默认 fast）。

### 2.8 必须保留（奥卡姆剃刀的反例，不可砍 —— 用户确认）

砍掉下面三项**会出问题**，已确认不剃：

| # | 部件 | 砍掉后的实际后果 | 结论 |
|---|------|------------------|------|
| 6 | **ProjectManager 缓存层**（按 accessKey 缓存 + 失效重建，`§4.3 project.ts`） | 每次请求都新建 project → 前端/上游堆积大量零散 project（project 数爆炸），管理成本与混乱上升 | ❌ 不可砍；project 实体本身也不可砍 |
| 7 | **`set_mode(unlimited=False)` 配额轴显式调用**（chat `main.py:1066` / image `main.py:1271-1275`） | 依赖上游默认 → 若账号默认 unlimited，额度哗哗扣；即"不指定模型/配额就扣钱" | ❌ 不可砍（见 §2.5 警示） |
| 13 | **结果 TTL `expires_at`**（main.py:371，TTL=86400） | 调用方无法判断结果 URL 是否过期，前端可能展示失效链接 | ❌ 不可砍（保留打戳行为） |

> 与 §2.7 对比：§2.7 的 `balance` / `images/edits` / `draw/completions` / `webhook` 是**真·无调用方依赖的边角**可剃；本节的 #6/#7/#13 是**看似冗余实则影响钱/资源/可用性**的硬约束，必须 1:1 复刻。

### 2.9 补充行为（落地易漏项，全部须 1:1 复刻）

#### 2.9.1 Project 失效自愈重建（`send_with_project` + `_is_project_invalid`，`main.py:780-790, 594-602`）
- `_PROJECT_INVALID_HINTS` 关键词集（`main.py:589-592`）：`not found` / `expired` / `已删除` / `失效` / `不存在` 等 + `http 400/404/409` 且 message 含 `project` → 判定 project 失效。
- 命中即 `ProjectManager.clear_project(access_key)` → `ensure_project` 重建 → **重试 `send` 一次**（不无限循环，`main.py:786-789`）。
> 不补：上游某 project 一旦失效，该 AK 下所有请求全挂。与 §2.8 #6 的缓存层配套，是鲁棒性自愈闭环。

#### 2.9.2 字段别名兼容（`normalize_body` / `contract.py`）
前端实际发送别名 / 嵌 `metadata` 子对象，网关须翻译（`contract.py:49-79`）：
- `FIELD_ALIASES`（`contract.py:21-26`）：`ratio→aspect_ratio`、`seconds→duration`、`input_reference→reference_images`、`input_video→videos`（仅当标准字段缺失时转换）。
- `METADATA_LIFT_KEYS`（`contract.py:33-36`）：把 `metadata.reference_images/reference_videos/reference_audios/ratio/duration/...` 提升到顶层。
- `_submit_generation_flow` 入口统一调 `normalize_body`（`main.py:1186`）。
> 不补：画布发的 `ratio` / `metadata.reference_images` 全丢失 → 尺寸/参考图失效。

#### 2.9.3 同步流式 `?wait=1`（image / video，`main.py:1191, 1299-1335`）
- `?wait=1` 走 `sse_gen()`：每 3s 推 `{"progress":N}` → 终态推 `{"status":"succeeded","results":[{"url":...}]}` 或 `{"status":"failed","error":...}` → `[DONE]`。
- 这是画布**图片/视频节点读进度**的通道（OpenAI 兼容 SSE）。relay 对 `?wait=1` 须合成 SSE 进度流。

#### 2.9.4 模型列表端点 `GET /v1/models`（`main.py:1013-1016`）
返回 OpenAI 风格 `{object:"list", data:[{id, object:"model", category:"image|video|chat"}]}`。
> relay 必须把 manifest（§4.5）挂到 `/v1/models`，否则前端拿不到模型清单。

#### 2.9.5 错误响应信封 `_LOVART_ERR_TYPES`（`main.py:338-349`）
`lovart_err_response` 统一成 `{error:{code, type, message}}`，type 按 `http_status` 映射：
`400→invalid_request_error` / `401→authentication_error` / `402→payment_required` / `403→permission_error` / `404→not_found_error` / `409→conflict_error` / `429→rate_limit_error` / `500→server_error` / `502→bad_gateway`。
> 前端按 `error.type` 判错；信封形状须与上游一致（子码映射见文末备注）。

#### 2.9.6 `AUTO_CONFIRM` 配置开关（relay 必配项，默认 true）
控制两处 confirm：`check_and_fire_task`（L843、L871）+ chat 循环（L1094、L1109）。
- `true`：自动 `confirm`，轮询继续。
- `false`：返回 `pending_confirmation_error`（L573-580，HTTP 409 + `task_id`，提示调 `POST /v1/tasks/{id}/confirm`）。

#### 2.9.7 轮询响应形状 `task_view`（`main.py:550-570`）
`GET /v1/tasks/{id}` 返回：`{id, status, progress, result, video_url?, error?, ...}`。前端解析路径：
- 图片：`result.images[0].url[0]`；视频：`result.videos[0].url[0]` 或 `video_url`。
- 状态枚举：`pending/queued/submitted/processing/running/completed/failed/abort`（与 `presets.ts:108-109` 一致）。

#### 2.9.8 路由别名（画布节点兼容，`main.py`）
主端点外还挂：`/v1/video/generations`、`/v1/videos`、`/v1/gateway/generate`、`/v1/gateway/task/{id}`、`/v1/gateway/upload`、`/v1/uploads/images`（`main.py:1368-1465`）。relay 至少保留 `/v1/uploads/images` 与任务别名，老画布节点才不 404。

#### 2.9.9 `/health` 探针 + `X-Trace-Id` 可观测（`main.py:933-936, 1197, 811`）
- `/health` 返回 `{status, backend, auto_confirm, mode}`，供存活检测。
- `X-Trace-Id` 头贯穿「提交 → 轮询」日志（`[submit]`/`[poll]` 打同 traceId），便于排障。relay 须在 `logWriter` 落 `source=relay-lovart` 并透传 traceId。

---

## 3. 当前 relay 集成现状（为什么必须改）

| 现状 | 位置 | 问题 |
|------|------|------|
| lovart provider 走 9004 | `providerCatalog.ts:186` baseUrl `http://127.0.0.1:9004` | 未直连上游 |
| 无 HMAC 动态签名 | `types.ts:16` AuthType 仅 bearer/header/query/oauth/none；`httpTransport.ts:52` 无 HMAC 分支 | 无法直接连 Lovart |
| 模型清单陈旧 | `lovartModelManifest.ts` image 4 / video 5 / text 1 | 缺 `gpt-image-2`、`nano-bn-2-lite` |
| 代理 | `netProxy.ts:85,274` resolveProxy/fetchWithProxy | 直连时复用即可 |

---

## 4. 集成方案（仅方案 B：relay 内直连）

把 `agent_skill.py` 的 `AgentSkill` 类 port 成 TS，再叠 main.py 适配层。

### 4.1 新增 HMAC 鉴权
扩展 `AuthType` 增加 `'hmac-sha256'`，在 `buildAuthHeaders`（`httpTransport.ts:52`）加分支；或直接给 lovart 专用 `signer` 钩子。签名算法见 §1。**每次重试重签。**

### 4.2 port 官方 `AgentSkill` → `ai-relay/providers/lovart/client.ts`
直接搬运 `agent_skill.py` 的 HMAC / 端点 / `chat`+`poll` / `upload` / `set_mode`（零依赖、经官方验证），避免自造签名/轮询 bug。

### 4.3 叠加 main.py 适配层
- `prompt.ts`：复刻 `build_gen_prefix` + `<user_prompt>` 包裹 + 双路选模型 + `parse_size` 档位映射（§2.2 / §2.6）。
- `attachments.ts`：复刻 `resolve_attachments`（§2.3，失败即阻断）。
- `contract.ts`：复刻 `normalize_body` 字段别名 + `metadata` 提升（§2.9.2），前置在入口。
- `project.ts`：复刻 `ProjectManager`（按 accessKey 缓存 project）+ **失效自愈重建**（`_is_project_invalid` + `clear_project` + 重试一次，§2.9.1）——**必须保留缓存层，否则前端会建一大堆零散 project（§2.8 #6）**。
- `task.ts`：复刻 `check_and_fire_task`（§2.4：done 5s、pending_confirmation 从 result 读、done-but-no-artifact）+ `task_view` 响应形状（§2.9.7）。
- `stream.ts`：合成 SSE——chat 默认流式 `chat.completion.chunk`（§2.5）+ image/video `?wait=1` 进度流（§2.9.3）。
- `errors.ts`：复刻 `lovart_err_response` + `_LOVART_ERR_TYPES` 信封（§2.9.5）。
- `config.ts`：`AUTO_CONFIRM`（默认 true）、`CHAT_THREAD_MODE=thinking`、`DEFAULT_MODE=fast`、`CHAT_SYNC_TIMEOUT`、`LOVART_TIMEOUT`、`TASK_RESULT_TTL`（§2.9.6 / §2.5 / §2.8 #13）。

### 4.4 端点映射（REST → chat Agent）

| 端点 | category | 复刻要点 |
|------|----------|----------|
| `POST /v1/images/generations` | IMAGE | gen_prefix + 双路选模型（6 精选）；参考图生成新图也走此端点（不单独建 `images/edits`）；支持 `?wait=1` SSE（§2.9.3） |
| `POST /v1/videos/generations` | VIDEO | gen_prefix + 双路选模型（5 精选）；支持 `?wait=1` SSE |
| `POST /v1/chat/completions` | chat | thinking + SSE 流式（默认）/ 同步（超 504）；usage 返 0（§2.5） |
| `GET /v1/tasks/{id}` + `confirm` | — | 复刻轮询/confirm；返回 `task_view` 形状（§2.9.7） |
| `POST /v1/uploads/*` | — | 复刻上传 CDN |
| `GET /v1/models` | — | OpenAI 风格模型列表，挂 manifest（§2.9.4 / §4.5） |
| `GET /health` | — | 存活探针，返 auto_confirm/mode（§2.9.9） |

> 不单独建端点（已剔掉）：`images/edits`、`draw/completions`（并入 `images/generations`）、`balance`（上游不暴露）；webhook 回调不实现。
> 保留别名兼容（画布老节点）：`/v1/video/generations`、`/v1/videos`、`/v1/gateway/generate`、`/v1/gateway/task/{id}`、`/v1/uploads/images`（§2.9.8）。

### 4.5 模型清单与 manifest
直连时把 main.py 的 **image 6 / video 5 / chat 1** 搬进 `LOVART_MODEL_MANIFEST`（补齐当前缺的 `gpt-image-2`、`nano-bn-2-lite`），不扩全量；并挂到 `GET /v1/models` 供前端列模型（§2.9.4）。

### 4.6 复用 localTool 既有
`netProxy.ts`（代理）、`sql.js`（落库）、`presets.ts`（状态枚举）、`logWriter`（source=relay-lovart，透传 `X-Trace-Id`，§2.9.9）。

---

## 5. 风险

1. **HMAC 签名**：relay 需新增动态签名（§4.1），当前最大架构缺口。
2. **提示词工程**：漏做 = 不出图 / 当聊天 / 选错工具 / 尺寸乱跳 / 误入 `edit_media`。
3. **轮询边角**：done 5s 防抖、pending_confirmation 从 result 读、done-but-no-artifact 失败返回——任一处漏复刻都会卡死/结果错乱。
4. **代理/VPN 硬依赖**：直连需开代理，无 VPN 必败。
5. **多用户凭据**：9004 用 `USER_KEYS` 多 AK/SK；直连需重新设计多租户凭据（providerConfig 存每连接 AK/SK）。
6. **port 而非从零写**：直接 port `agent_skill.py`，避免自造签名/轮询 bug。
7. **SSE 合成**：上游 Lovart 是轮询式，relay 须把轮询结果合成 OpenAI 流式（chat `chat.completion.chunk` + image/video `?wait=1` 进度流），漏了画布聊天/图片节点跑不起来（§2.5 / §2.9.3）。
8. **字段别名 / metadata 提升**：漏 `normalize_body`（§2.9.2）→ 前端 `ratio` / `metadata.reference_images` 丢失，尺寸/参考图失效。
9. **project 失效自愈**：漏 `_is_project_invalid` + 重建重试（§2.9.1）→ 单 project 失效拖垮整 AK。
10. **错误信封 / `AUTO_CONFIRM`**：漏 `_LOVART_ERR_TYPES`（§2.9.5）或 `AUTO_CONFIRM` 配置（§2.9.6）→ 前端按 type 判错失配 / 高成本操作卡死。

---

## 6. 落地步骤（方案 B）

1. ai-relay 新增 `hmac-sha256` 鉴权类型 + `buildAuthHeaders` 分支（§4.1）。
2. 新增 `lovart-direct` provider（baseUrl `https://lgw.lovart.ai`，凭据 accessKey/secretKey，复用 `netProxy.ts`）。
3. **port `agent_skill.py` 的 `AgentSkill` → `ai-relay/providers/lovart/client.ts`**（§4.2）。
4. 叠 main.py 适配层（§4.3）：`contract`(别名) / `prompt`(含 parse_size 档位) / `attachments` / `project`(含失效自愈) / `task`(含 task_view) / `stream`(SSE) / `errors`(信封) / `config`(AUTO_CONFIRM 等)。
5. 把 main.py 精选模型（**image 6 / video 5 / chat 1**）搬进 manifest，并挂 `GET /v1/models`（§4.5）。
6. 路由层：主端点 + 别名（`/v1/video/generations` 等）+ `/health`；保留 9004 作回退开关。
7. 自测：用 `task-inspect --poll-status` 思路验证直连链路；并验证 chat 流式、`?wait=1` 进度流、`?wait=1` 终态取 URL、`/v1/models` 列表、project 失效重建。

> 备注：本文档基于 `main.py` / `lovart_client.py` / 官方 `lovart-api` skill / `ai-relay/*` 实测。
> 错误子码（如 `1200000136` 额度不足、`1200000200` 并发上限、`1200000146` 免费用尽）出自 `vendor/SKILL.md`，
> 其 HTTP 映射 `2011→409 / 2012→402 / 1429→429` 在 `lovart_client.py:326-331` 已验证。
