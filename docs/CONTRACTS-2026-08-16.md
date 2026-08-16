# 猫猫画布 · 契约全集（以代码为准）

> 本文档是猫猫画布全部「契约」的唯一权威来源，所有内容以当前代码（`src/`、`localTool/`、`apimart-gateway/`）落点为准。
> 旧文档（`docs/1mao-docs/CONTRACTS.md`、`scripts/1mao-scripts/contracts.json`、`localTool/CONTRACT.md` 等）基于已弃用的 `src/bundle` 逆向产物，已删除，以本文为准。
> 最后核对时间：2026-08-16。

---

## 0. 系统拓扑与端口铁律

```
┌──────────────────────────┐         ┌────────────────────────────┐         ┌─────────────────────────┐
│  前端（React 画布）        │         │  localTool（本机后端）       │         │  apimart-gateway        │
│  原型 dev server :5180    │  fetch   │  :18080（API_BASE 写死）     │  proxy   │  :9004（Lovart 海关）    │
│  正式部署也跑在 :18080     │ ──────► │  /api/proxy /api/kv ...     │ ──────► │  /v1/images/generations │
│  所有 API 走 API_BASE     │ ◄────── │  SQLite 落盘                │ ◄────── │  /v1/videos/generations │
└──────────────────────────┘         └────────────────────────────┘         └─────────────────────────┘
```

**端口铁律（CLAUDE.md 约定，不可改）**
- 前端原型 dev server：`5180`
- localTool 后端：`18080`（环境变量 `PORT`，默认 18080）
- apimart-gateway：`9004`（环境变量 `APIMART_PORT`，默认 9004）

**为什么 `API_BASE` 写死 `http://127.0.0.1:18080`（`src/components/base/apiBase.js`）**
- 原型阶段：前端 5180 与后端 18080 跨端口，无法用相对路径，必须绝对地址。
- 正式发布：前端页面直接部署到 18080（`http://127.0.0.1:18080` 打开），与 localTool 同源，该地址无需改动即可工作。
- 所有 API 层（`imageApi`/`videoApi`/`filesApi`/`kvStore`/`tasksApi`/`chatApi`）统一从 `apiBase.js` import `API_BASE`，**禁止各自硬编码地址**。

---

## 1. 后端路由契约（localTool `:18080`）

### 1.1 代理转发 `/api/proxy`（生图/生视频/聊天的统一出口）
前端不直接连供应商，一律经此转发。两种请求形态：

**形态① FormData/Blob body + 头**（X-Proxy-* 头携带目标与鉴权）
- `X-Proxy-Url`: 目标 URL
- `X-Proxy-Provider`: providerId（供应商分派）
- `X-Proxy-Method`: GET/POST（默认 POST）
- `X-Proxy-Headers`: JSON 字符串（额外头）
- `X-Proxy-Cookie`: Cookie 字符串
- `X-Task-Id`: 前端自造任务 id（贯穿链路，关联 Lovart thread_id）

**形态② JSON body**（当前前端主用）
```json
{ "url": "供应商端点", "method": "POST", "body": "请求体JSON字符串",
  "headers": {}, "cookie": "可选", "providerId": "供应商id",
  "taskId": "前端自造任务id" }
```

行为契约：
- 供应商分派（`resolveProviderTarget`）：
  - 无 providerId → url 原样透传；
  - `openai` 协议 + `openai://<path>` → 拼成 `${base}/v1/<path>` 并注入 Bearer key；
  - `apimart`(Lovart) → url 原样透传（网关自身鉴权）。
- **自指重写（特惠视频 fix）**：若 `body.url` 的 host 是 localTool 自身 18080 且路径以 `/api/v1/gateway/` 开头 → 重写到 `127.0.0.1:9004` 并去掉 `/api` 前缀（apimart 路由无 `/api`）。
- **协议翻译**：响应若为 `{code, data}` 信封（且不含 `error`）→ 剥信封，前端直接拿 `data`。
- **SSE 流式**：`content-type: text/event-stream` 的响应不缓冲，逐块 pipe（解析 `data:` 行，丢弃 `: heartbeat` 注释）。
- **贯穿 ID 落库**：异步提交响应中提取 `task_id`（=`task_`+Lovart thread_id），调 `persistThreadId` 落库，把前端 `taskId` 与 Lovart `thread_id` 关联。
- 超时：`PROXY_TIMEOUT` 环境变量，默认 300000ms（5min）。

### 1.2 KV 存储 `/api/kv/*`（SQLite，跨端共享）
| 方法 | 路径 | 入参 | 返回 |
|------|------|------|------|
| GET | `/api/kv/get?key=<key>` | query.key | 解析后的值；key 不存在返回 JSON `null` |
| POST | `/api/kv/set` | `{key, value}` | `{ ok: true }` |
| POST | `/api/kv/delete?key=<key>` | query.key | `{ ok: true }`（删不存在也 ok） |

- 错误体：`{ error: "<英文message>" }`
- `value` 为对象/数组自动 `JSON.stringify` 入库；读取时自动 `JSON.parse`。
- **base64 外置**：`set` 时把 value 内 base64 图片外置为 `uploads/` 磁盘文件，用 `/files/` URL 替换后入库（避免 KV 库被撑大卡死）。失败自动回退保留原 base64。

**前端分流规则（`src/components/base/kvStore.js`）**
- key 以 `canvas-state-v1-`（`CANVAS_STATE_PREFIX`）开头 → 走 localTool KV；
- 其余 key（`projects`/`users`/`app_settings`/`api_configs` 等）→ 浏览器 `localStorage`（经 `storageAdapter`）。
- 统一入口：`storageGet/storageSet/storageDelete`；底层：`kvGet/kvSet/kvDelete`。

### 1.3 文件操作 `/api/files/*`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/files/upload` | 落盘（生成结果/上传）。FormData：`file`+`subfolder`+`filename`；或 JSON：`{fileUrl, subfolder, filename}` |
| GET | `/api/files/read?path=<绝对路径>` | 读文件（支持 `X-Proxy-*` 代理读外部 CDN） |
| GET | `/api/files/thumbnail?url=/files/...&maxDim=200&quality=80` | 生成缩略图，返回 `{thumbnailUrl}` |
| POST | `/api/files/mkdir` | `{folder}` |
| POST | `/api/files/move` | `{src, dst}` |
| GET | `/api/files/open?subfolder=...` | 系统打开目录 |
| GET | `/api/files/open-dir?filepath=...` | 系统打开文件所在目录 |
| GET | `/api/files/list?subfolder=...` | `{files:[], folders:[]}` |

`/api/files/upload` 返回契约：
```json
{   "url": "http://127.0.0.1:18080/files/<subfolder>/<name>",
  "path": "<磁盘绝对路径>",
  "thumbnailUrl": "http://127.0.0.1:18080/files/<subfolder>/.thumbnails/<name>"  // 仅当成功生成缩略图时存在，否则字段缺省 }
```
- `fileUrl` 模式（远程下载）：文件名 = `sha1(fileUrl)前16位 + 原basename` → **幂等**，同一远程地址永远同一文件名，已存在跳过下载。
- 每次成功落盘产出「1 原图 + 1 缩略图」（`.thumbnails/` 下），是正常设计。

### 1.4 任务中心 `/api/tasks/*`（SQLite 落盘）
| 方法 | 路径 | 入参 | 返回 |
|------|------|------|------|
| GET | `/api/tasks?page&pageSize&sortBy&sortDir&keyword` | query | `{items, total, page, pageSize}` |
| POST | `/api/tasks/save` | `{taskId 或 id, ...}` | `{ ok: true }`（单条 upsert） |
| POST | `/api/tasks/batch-save` | `[task, ...]` | `{ ok: true }` |
| POST | `/api/tasks/delete?id=...` | query.id | `{ ok: true }`（同时删本地 result/thumbnail 文件） |
| POST | `/api/tasks/batch-delete` | `{ids:[...]}` | `{ deleted: n }` |
| POST | `/api/tasks/clear` | 无 | `{ deleted: n }` |

- **字段映射**：snake_case ↔ camelCase（见下表）。返回时 `id === taskId`（前端去重键依赖 `id`，否则 reload 后重复累加）。
- **白名单过滤**：后端只落 `task_id/node_id/prompt/result_url/thumbnail_url/error_msg/error_message/custom_output_type/channel_name/model_name/progress/created_at/not_found_count/custom_result_data/custom_raw_response/request_data/response_data/media_meta/extra_fields/type/status/thread_id/poll_task_id`。前端运行时字段（`loading` 等）被过滤。
- `status` 是运行时态，每次 upsert 传最新值；前端内存以 `useTasks` 为准，后端只保「刷新/重启后历史还在」。

**字段名映射表（前端 camelCase ↔ 后端 snake_case）**
```
taskId↔task_id   nodeId↔node_id   resultUrl↔result_url   thumbnailUrl↔thumbnail_url
errorMsg↔error_msg   errorMessage↔error_message   channelName↔channel_name
modelName↔model_name   createdAt↔created_at   notFoundCount↔not_found_count
customOutputType↔custom_output_type   customResultData↔custom_result_data
customRawResponse↔custom_raw_response   requestData↔request_data   responseData↔response_data
mediaMeta↔media_meta   extraFields↔extra_fields   threadId↔thread_id   pollTaskId↔poll_task_id
```
JSON 字段（入库转 JSON 字符串）：`customResultData/customRawResponse/requestData/responseData/mediaMeta/extraFields`。

### 1.5 系统 `/api/status` 与剪映 `/api/jianying/send`
- `GET /api/status` → `{status:'ok', version, message, ffmpeg:false, port}`。
- `POST /api/jianying/send` → 剪映发送（**当前 stub**：仅记录请求返回成功，未真正实现），`{status:'ok', _meta:{stub:true}}`。

### 1.6 特惠视频任务查询（前端全局轮询直连）
`GET /api/v1/gateway/task/:taskId`：把前端 App 全局 `setInterval` 的直连查询转发到 `127.0.0.1:9004/v1/gateway/task/{id}`。
- 网关返回 `{code:200, data}` → 改写为 `{code:1, data}`（前端特惠轮询以 `code===1` 识别）。
- 网关 400（任务已清理）→ 归一为 404，让前端正确停止轮询。

---

## 2. 网关契约（apimart-gateway `:9004`）

### 2.1 端点清单（main.py）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/llms.txt` | 网关能力说明 |
| GET | `/v1/models` | 模型列表 |
| POST | `/v1/chat/completions` | 聊天/文本生成 |
| POST | `/v1/images/generations` | 文生图/图生图 |
| POST | `/v1/images/edits` | 图像编辑 |
| POST | `/v1/videos/generations` | 文生视频/图生视频 |
| POST | `/v1/video/generations` | 同上别名 |
| POST | `/v1/videos` | 同上别名 |
| POST | `/v1/gateway/generate` | 特惠视频生成（自指重写目标） |
| GET | `/v1/tasks/{task_id}` | 任务轮询 |
| GET | `/v1/videos/{task_id}` | 同上式别名 |
| GET | `/v1/gateway/task/{task_id}` | 特惠任务查询（网关侧） |
| POST | `/v1/tasks/{task_id}/confirm` | 确认任务（待确认场景） |
| POST | `/v1/draw/completions` | 绘图补全 |
| POST | `/v1/uploads/images` | 图片上传（网关侧） |
| POST | `/v1/gateway/upload` | 网关上传 |
| GET | `/v1/balance` | 余额查询 |
| POST | `/v1/music/generations` | 音乐生成 |
| POST | `/v1/audio/generations` | 音频生成 |
| POST | `/v1/audio/speech` | 语音合成 |
| POST | `/v1/audio/transcriptions` | 语音转写 |

> 注：上表为生成相关核心端点（main.py 实际注册约 20+ 个，含音乐/音频/上传等），**非穷举**；新增调用前以 `main.py` 路由为准。

### 2.2 提交响应契约（`_do_submit`）
- 图片能力：返回数组 `[{status:'submitted', task_id:'task_xxx'}]`。
- 视频能力：返回对象 `{id:'task_xxx', status:'submitted', task_id:'task_xxx'}`。
- 聊天/同步：无 `task_id`（不落库）。
- `task_id = "task_" + Lovart上游thread_id`。

### 2.3 字段契约（contract.py 海关）
**别名映射（前端字段 → 网关标准字段，仅当标准字段不存在时转换）**
```
ratio → aspect_ratio
seconds → duration
input_reference → reference_images
input_video → videos
```
**metadata 子对象提升**（以下字段若在 `metadata` 内则提升到顶层）
```
reference_images, reference_videos, reference_audios,
ratio, duration, watermark, generate_audio
```
**多候选 URL 合并**（按媒体类型 or 短路，取第一个有值）
```
image: image_urls / images / attachments / reference_images / files
video: videos / reference_videos / files
audio: audios / reference_audios / files
```
**网关实际消费的提交体字段**（`_do_submit`）
```
prompt（或 input）      必需
image_urls / images / attachments / reference_images / videos / audios / files   参考素材
model                   模型名
size                    像素尺寸（如 880x1776，由前端查表转精确像素）
resolution              清晰度（视频：720p/1080p 等）
duration / aspect_ratio 视频时长/比例
wait                    true→同步SSE模式；false/缺省→异步提交返回task_id
mode                    fast / unlimited
webhook                 可选回调地址
```

### 2.4 同步 SSE 输出契约（wait=true）
逐块 `data: {json}\n\n`：
- 生成中：`{"progress": <0-100>}`
- 成功：`{"status":"succeeded","results":[{"url":"..."}]}` 而后 `data: [DONE]`
- 失败：`{"status":"failed","error":"..."}`
- 前端 `readSseImageUrl` 兼容 `results[].url` 与 `result.images[].url`（数组取 `[0]`）。

### 2.5 异步轮询返回契约（`GET /v1/tasks/{task_id}`）
- 图片：取 `result.images[0].url`（数组 `[0]`）或 `results[0].url`。
- 视频：取 `result.videos[0].url`（数组 `[0]`）或 `results[0].url`。
- `status: 'failed'|'error'` → 任务失败。
- 网关 `result.images[0].url`/`videos[0].url` 是 **数组**（`{url:[...]}` 规范），前端统一取 `[0]`。

---

## 3. 前端 API 层契约

### 3.1 图片 URL 归一化（唯一出口 `src/components/base/imageUrl.js`）
四种图片形式：绝对 `http(s)` / `data:` base64 / `blob:` / 相对 `/files/`。
- `normalizeImageUrl(url)`：渲染用，`/files/` 相对 → 补全绝对，其余原样。
- `normalizeImageUrlForSend(url, {preferBase64})`：发送用。
  - 默认：`/files/`→绝对；`blob:`→转 `data:`；`data:`/`http`/裸 base64 原样。
  - `preferBase64=true`（只认 base64 的后端，provider `refFormat:'base64'`）：任何形式统一转 `data:` base64。
- `toAbsoluteFileUrl(url)`：`/files/` → `${API_BASE}/files/...`。

### 3.2 参考图解析（统一入口 `src/components/base/refImage.js`）
- `resolveRefImages(images, {preferBase64})` → 经 `normalizeImageUrlsForSend` 过滤空值+逐个归一化。
- `toImageContentBlocks(urls)` → 聊天 messages 内容块 `[{type:'image_url', image_url:{url}}]`。

### 3.3 生图 `generateImage`（`imageApi.js`）
- 链路：`imageApi` → `/api/proxy` → 供应商 `/v1/images/generations`。
- 同步/异步由 **provider.image_mode** 决定（API 设置页「图片生成模式」）：
  - `sync`：URL 带 `?wait=1` → 网关同步 SSE 返回；
  - `async`：提交返回 `[{status:'submitted', task_id}]` → 轮询 `GET /v1/tasks/{id}`。
- **比例×清晰度 → 精确像素查表**（`resolveImagePixel`）：把「比例+档位」转固定像素（如 `9:16+1K → 880x1776`），避免不同 AI 理解错位。`Auto`/空 → 不指定 size。
- 请求体：除 `prompt/model/n` 外，同时带 `size`(像素)、`image_size`(档位大写)、`resolution`(档位)、`quality`(非auto)、`image_urls`(参考图)。
- 返回信封：`{ok:true, url}` 或 `{ok:false, error}`。

### 3.4 生视频 `generateVideo`（`videoApi.js`）
- 链路同上，端点 `/v1/videos/generations`。
- **视频强制异步**（不走 image_mode，不 sync）：提交拿 `task_id` → 轮询 `GET /v1/tasks/{id}` 到 completed。
- 请求体：`prompt/model/size(比例如16:9)/resolution(如1080p)/duration(秒，转字符串)/image_urls`(参考图)。
- 轮询取 `result.videos[0].url`（兼容 `result.images[0].url`、`results[0].url`）。

### 3.5 任务贯穿 ID（`taskStore.js` 模块级 `currentTaskId`）
- 前端自造 `task_id`（`task_`+时间戳+随机）是任务主键，但**旧逻辑从不传给网关导致与 Lovart thread_id 断链**。
- 生成前 `setCurrentTaskId(id)`，imageApi/videoApi 的 `proxyRequest` 读它并加 `taskId` 字段（JSON 形态）/`X-Task-Id` 头（FormData 形态），localTool/网关据此把前端 `task_id ↔ thread_id` 关联落库。
- 异步任务提交后，`setTaskPollId(frontTaskId, gatewayTaskId)` 把可轮询的网关 `task_id` 回填到任务记录，供刷新后 `pollTask.js` 恢复轮询。

---

## 4. 任务状态机契约（`taskStore.js`）

**任务字段**
```
{ id(=taskId), nodeId, type, prompt, modelName, channelName,
  status:'pending'|'running'|'completed'|'failed', progress, errorMsg,
  resultUrl, stageLabel, createdAt, threadId?, pollTaskId? }
```

**状态 → 展示**
- `completed` → 绿点「已完成」
- `failed` → 红点「失败」
- `pending`/`running` → 蓝点「生成中」（running 带 `progress%`）

**类型 → 文案**（`typeLabel`）
```
text→文本  image→生图  video→视频  sd2Video→SD2视频
discountVideo→特惠视频  custom→万能  rhWebapp→AI应用
```

**生成上报流程**（`reportGenerate(nodeId, type, prompt, meta)`）
1. `openTaskCenter()` 自动弹出任务中心（对齐官方 setShowTaskList）。
2. 结束同 `nodeId` 未完成任务。
3. 建 `running` 任务并 `persist` 到后端。
4. 返回 `{taskId, progress(p,stage), done(url), fail(msg)}` 更新函数。
5. 完成后落盘：`saveResultToTasks(url, type)` → 持久化 URL 广播 `mutiwindow-task-completed` 事件给节点写回 `data.imageUrl`（避免画布丢图、任务中心有图的错位）。

**展示过滤**：任务中心 UI 用快照 `getSnapshot()` 过滤掉 `nodeId` 为空的行（网关占位垃圾行，无归属节点不展示）。轮询用 `getTasks()` 仍返回完整数组。

---

## 5. 节点类型契约（`NodePalette.jsx`）

**四大分类 tab**：`text`(文本工具) / `image`(图片工具) / `video`(视频工具) / `other`(其他工具)。

**节点目录（type → 默认 data）**
```js
// 文本工具（顶部 Q 快捷，不进子分类）
{ type:'textNode',          data:{ text:'' } }
// 图片工具
{ type:'promptNode',        data:{ prompt:'' } }                       // 顶部 W 快捷
{ type:'imageNode',         data:{ images:[] } }
{ type:'imageBoxNode',      data:{ images:[], activeIndex:0, expanded:false } }
{ type:'gridSplitNode',     data:{ imageUrl:'', extractedImages:[], rows:3, cols:3, splitMode:'grid', hLines:[0.5], vLines:[0.5], lassoShapes:[], titlePattern:'#{num}', sendToImageBox:false } }
{ type:'gridMergeNode',     data:{ mergeMode:'grid', rows:3, cols:3, cellSize:512, aspectRatio:'1:1', autoSize:true, titlePattern:'', longDirection:'vertical', longGap:0, longTargetSize:1024, longAutoSize:true, bgColor:'transparent', overlayState:{layers:[], canvasWidth:1024, canvasHeight:1024, bgColor:'transparent'} } }
{ type:'panoramaNode',      data:{ panoType:'sphere', highQuality:false, aspectRatio:'16:9', imageUrl:'' } }
{ type:'director3dNode',    data: 无（palette 未登记 data 字段，defaultNodeData 仅兜底 expanded:false） }
{ type:'faceMosaicNode',    data:{ mode:'mosaic', strength:0.5, color:'#000000', imageUrls:[] } }
// 视频工具
{ type:'discountVideoNode', data:{ prompt:'' } }                       // 顶部 E 快捷
{ type:'videoExtractNode',  data:{ videoUrl:'', videoName:'' } }
{ type:'videoProcessNode',  data:{ mode:'trim', sourceOrder:[], timelineTracks:[], audioFormat:'m4a', trimStart:0, trimEnd:4, resizeWidth:1280, resizeHeight:720, targetFps:30 } }
// 其他工具
{ type:'group',             data:{} }
{ type:'scriptBoxNode',     data:{ step:1, story:'', globalStyle:'', shots:[], assets:[] } }
```

- 顶部 Q/W/E 快捷：`textNode`/`promptNode`/`discountVideoNode`（已复刻，仍合法可创建）。
- `defaultNodeData(type)` = `{expanded:false, ...palette.data}`。
- 新增节点：在 `paletteNodes`（或 `HIDDEN_TOP_LEVEL_NODES`）登记一行即可被右键菜单/面板/AI `create_node` 校验接入。

---

## 6. 画布存储链路契约

- **画布状态 key 前缀**：`canvas-state-v1-`（`CANVAS_STATE_PREFIX`）→ 走 localTool KV（`/api/kv/*`）。
- **非画布配置**（projects/users/app_settings/api_configs）→ 浏览器 localStorage。
- 画布图片来源与保存完整链路见 `docs/AI助手开发历史/06-画布图片来源与保存完整链路-2026-08-16.md`。
- 任务 ID 全链路见 `docs/03-任务ID全链路-2026-08-16.md`。
- KV 存储设计见 `docs/05-KV存储设计-2026-08-16.md`。

---

## 7. 易错断点/契约陷阱（AI 改代码必读）

1. **`API_BASE` 写死 18080 是刻意为之**，不是漏配置；要支持局域网/远程再改。
2. **图片 URL 四种形式必须过 `imageUrl.js`**，否则画布破图（`/files/` 相对）或后端丢图（`blob:`/`/files/` 网关访问不到）。
3. **网关 `result.images[0].url` / `videos[0].url` 是数组** `{url:[...]}`，前端统一取 `[0]`，不可直接当字符串。
4. **特惠视频** 的 `discountVideoApiUrl` 经前端处理成 `http://127.0.0.1:18080/api`，提交 `/v1/gateway/generate` 会打回 localTool 自身 → 被 `rewriteSelfGatewayUrl` 重写到 9004 去掉 `/api` 前缀。少这步 → 官方 400「Unknown model」。
5. **任务中心重复任务 bug**：`persistThreadId` 绝不为网关 `task_id` 单独建行（那是 `nodeId=null` 垃圾来源），只为前端 `frontTaskId` 行补 `thread_id`。
6. **`/api/tasks` 返回 `id===taskId`**；前端去重键用 `id`，否则 reload 后重复累加。
7. **视频强制异步**，不读 `image_mode`，不 sync；提交即返回 `task_id` 必须回填 `pollTaskId` 否则刷新断链。
8. **比例必须查表转精确像素**（如 `9:16+1K→880x1776`），不要原样传「9:16 + 1K」给上游。
9. **`localTool` 进程 fetch 不继承浏览器代理**；下载 Lovart CDN 图用 `fetchWithProxy`（直连优先，失败走本机代理端口）避免 400 超时。
10. **KV `set` 会外置 base64 为磁盘文件**，契约返回仍是 `{ok:true}`，失败字段自动回退保留原 base64，不破坏契约。

---

## 8. 相关文档索引
- `docs/03-任务ID全链路-2026-08-16.md` — 任务 ID 贯穿全链路详解
- `docs/05-KV存储设计-2026-08-16.md` — KV 存储设计
- `docs/AI助手开发历史/06-画布图片来源与保存完整链路-2026-08-16.md` — 图片 URL 机制
- `docs/04-API设置设计-2026-08-16.md` — Provider 字段契约
- `apimart-gateway/contract.py` — 网关字段海关（可执行映射）
- `localTool/src/routes/*.ts` — 后端路由实现（契约代码落点）
