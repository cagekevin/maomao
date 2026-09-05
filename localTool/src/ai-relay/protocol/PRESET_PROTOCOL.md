# 声明式异步 Preset 接入协议（PRESET_PROTOCOL）

> **用途**：本规范定义 ai-relay 里「声明式 preset」这一接入范式的**字段字典、双信封抽值规则、状态机铁律、现成活示例**。
> 任何后续 AI 只要照本文件，就能为「OpenAI 兼容 + 提交 task_id → 轮询 → 取 url/text」形态的上游平台，纯声明式接入，**无需改 relay 主逻辑**。
> 本文件是范式真源，与 `presets.ts` 同目录、互为印证；`presets.ts` 内注释只做摘要，细节以此为准。
>
> **历史注记（理解用，非运行依赖）**：本范式最早由一批「本地异步任务网关」（提交后返回 `{code, data:{task_id}}`，再轮询 `{code, data:{...}}`）沉淀而来。网关进程已退役，但**字段规则与网关无关——它们描述的是上游 HTTP 返回结构的普适规律**，因此本规范完全不依赖任何已退役进程。

---

## 0. 何时用声明式 preset（vs 命令式适配器）

| 平台形态 | 归属 |
|---|---|
| 请求/响应可用「提交 task_id → 轮询 → 取 url/text」**声明式**描述 | **本规范（preset）** |
| chat-thread / 多产物 / confirm 门 / pre-flight 等**表达不进声明式**的原生协议 | 命令式适配器 `providers/<id>/`（见 `../providers/ADAPTER_SPEC.md`） |

> 新平台默认优先考虑声明式 preset；只有协议表达不进「提交-轮询-取结果」三段式时，才写适配器。

---

## 1. 一个 preset 的完整字段

定义在 `presets.ts` 的 `ModelProtocolPreset` 接口，关键字段：

| 字段 | 含义 | 必填 | 说明 |
|---|---|---|---|
| `taskIdPath` | 提交响应里抽取任务 id 的 JSONPath | 是 | image 用 `data.0.task_id`；video 用 `data.task_id`（见 §3 差异） |
| `poll.urlTemplate` | 轮询 URL 模板，含 `{taskId}` 占位 | 是 | e.g. `/v1/gateway/task/{taskId}` |
| `poll.method` | 轮询 HTTP 方法 | 是 | 通常 `GET` |
| `poll.statusPath` | 轮询响应里抽状态的 JSONPath | 是 | 通常 `data.status` 或 `data.0.status` |
| `poll.statusEnum` | 状态枚举映射（**铁律见 §2**） | 是 | `{completed,failed,processing,...}` |
| `poll.successValues` | 视为「完成」的状态值数组 | 是 | `["completed","succeeded","success"]` |
| `poll.failureValues` | 视为「失败」的状态值数组 | 是 | `["failed","aborted","error"]` |
| `poll.urlPath` | 完成后抽产物 URL 的 JSONPath | 图片/视频必填 | image `data.0.url`；video `data.video_url` |
| `poll.textPath` | 完成后抽文本/choices 的 JSONPath | chat 必填 | chat `data.choices.0.message.content` |
| `poll.progressPath` | （可选）进度抽值 JSONPath | 否 | `data.progress` |
| `poll.timeoutMs` | 总轮询超时 | 否 | 默认见轮询器 |
| `submit` | 提交请求定义（url/method/headers/body 模板） | 是 | — |
| `file_fields` / `reference_fields` | 上传/参考素材字段映射 | 否 | 见各平台 |

> **JSONPath 前缀铁律**：凡指向「双信封内层 `data`」的字段，路径**必须带 `data.` 前缀**（如 `data.0.task_id`、`data.status`）；指向根或 `choices` 的，按实际结构写。漏写 `data.` 是最常见的接入 bug。

---

## 2. 状态枚举铁律（poll.statusEnum）

上游异步网关常把内部状态做归一。`statusEnum` 必须覆盖以下语义映射：

- **完成**：`completed` / `succeeded` / `success` → 进 `successValues`
- **失败**：`failed` / `aborted` / `error` → 进 `failureValues`
  - 上游常把「用户取消 **abort**」映射为 `failed`（属正常失败，不要再当 in-progress）
- **进行中**：`processing` / `running` / `in_progress` / `pending` → 既不成功也不失败，继续轮询
  - 上游常把 `running` 归一为 `processing`

> **为什么重要**：若把 `aborted`/`error` 漏进「进行中」，轮询器会无限等待直到超时；若把 `running` 漏进「完成/失败」，任务会瞬间误判。务必显式列出全量枚举。

---

## 3. 三种模态的抽值差异（image / video / chat）

同是「双信封 `{code, data:{...}}`」，但内层字段命名不同，preset 必须区分：

| 模态 | task_id 抽取 | 状态抽取 | 产物抽取 | 示例 preset |
|---|---|---|---|---|
| **image** | `data.0.task_id`（数组第 0 项） | `data.0.status` | `data.0.url` | `lovart-image`（见 `presets.ts` L104-130） |
| **video** | `data.task_id`（对象直取，非数组） | `data.status` | `data.video_url` | `lovart-video`（L132-160） |
| **chat** | `data.task_id` | `data.status` | `data.choices.0.message.content`（含 `choices` 嵌套） | `lovart-chat`（L162-190） |

> **差异根源**：image 端点返回「任务数组」（`data` 是数组，`task_id` 在 `data[0]`）；video/chat 端点返回「单任务对象」（`data` 是对象）。这不是某个平台独有，是上游两种返回结构的客观差异，照抄即可。

---

## 4. 现成活示例（无需 9004 即可对照）

以下平台**当前**在 `api.config.json` 中使用本范式，可直接 `src/ai-relay/protocol/presets.ts` 对照：

| 平台 id | 使用的 preset | 备注 |
|---|---|---|
| `apimart` | `lovart-image` / `lovart-video` / `lovart-chat` | `image_mode: async` |
| `modelscope` | `lovart-image` / `lovart-video` / `lovart-chat` | `image_mode: async` |
| `p_mt1h4ycb_sfr3gu` | `lovart-image` / `lovart-video` / `lovart-chat` | `image_mode: async` |
| `lovart`（直连） | `lovart-image` / `lovart-video` / `lovart-chat` | 直连 `lgw.lovart.ai`，不经由任何本地网关 |

> 新增一个「异步生图/生视频」平台时：复制 `lovart-image`/`lovart-video` 结构，按 §3 改 JSONPath，把 preset 名加进 `presetMap`（或 `getPresetFor`），再在 `api.config.json` 把该平台 `image_mode` 设为 `async` 并引用对应 preset 即可，**不用碰 relay 主路代码**。

---

## 5. 路由与执行链路（速查）

- 提交：`generateEngine.ts` 对 `image_mode === 'async'` 的平台调用 `presetNameFor(capability)` 取 preset → `executeModelProtocol`（见 `ai-relay/index.ts`）。
- 轮询：`relay-poll.ts` 的 `initRelayPoller` 用 preset 的 `poll.*` 字段轮询，按 `statusEnum` 判定终态，按 `urlPath`/`textPath` 抽产物，落盘到 `/files/`。
- 协议选择：`getPresetFor`（`presets.ts`）按 `providerId` + `capability` 返回 preset 名。

> **红线**：preset 只描述「提交-轮询-抽值」的 JSON 路径，**不持有任何凭证/密钥**（密钥走 `.env` + `API_PROVIDER_{ID}_KEY`）。新增平台严禁在 preset 里写死 token。
