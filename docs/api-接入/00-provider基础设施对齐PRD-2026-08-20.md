# Provider 基础设施对齐 PRD（需求级契约基线）

> **定位**：把 maomao 画布的 provider 基础设施改造成与 **Infinite-Canvas 完全一致**的可插拔架构。
> **价值**：加任意第三方平台（OpenAI 兼容 / apimart / 即梦 / 豆包 / 方舟 / RunningHub / CLI）= 加一个适配器，不动主体；自动探测协议/形态/模型分类，用户少配置。
> **当前痛点**：解决 APM 的 gpt-5.6 系在聊天工具调用上的报错（`/v1/chat/completions` 不支持 tools+reasoning_effort）。
>
> **上游契约**：`docs/api-接入/02-provider字段契约.md`（字段唯一真相）+ `docs/api-接入/01-地基拆解-抄Infinite-Canvas.md`（落地路径）。
> **本文档** = 需求级契约基线，后续模块细化追加到本文件。

---

## 第 1 层：全局骨架

### 一、项目定位（State 1）

- **做什么**：provider 基础设施对齐 Infinite-Canvas，可插拔、可探测、能力感知。
- **给谁用**：
  - 最终用户：配置化接入任意平台，无需改代码。
  - 开发团队：加新平台 = 新增适配器，零侵入主体。
- **核心价值**：可插拔 / 自动探测 / 能力差异路由（如 gpt-5.6 聊天走 responses）/ 解决当前 gpt-5.6 工具报错。

### 二、核心模块拆解（State 2）

1. **协议适配层** — 统一"前端 rawUrl → 真实转发目标"，每种协议一个 adapter（openai/apimart/gemini/volcengine/runninghub/jimeng/codex/gemini-cli）。
2. **请求形态层** — 同协议内的请求端点/格式差异（`image_request_mode` 4 形态；聊天 chat/completions vs responses），自动探测 + 配置覆盖。
3. **模型分类与能力层** — 拉取模型分类（video/image/chat）；单模型能力标记（`model_protocols`、端点覆盖）。
4. **平台专属配置层** — 各平台私有字段（方舟 AK/SK、RH 双 key、即梦 CLI、魔搭 Lora）及密钥管理。
5. **前端设置面** — 协议下拉、形态选择、平台专属面板、自动探测结果反馈。

**依赖关系**：1→2→3 为请求链路上下游；4 是 1/2/3 的数据供给；5 消费 1-4。无重叠（3 管"归哪类/能力标签"，2 管"该类走哪个端点"，正交）。

### 三、翻车点（State 3）

1. **死字段**：已有 `image_request_mode`/`model_protocols`/`image_generation_endpoint` 等字段但没生效。必须让字段真正驱动请求路由，否则白做。
2. **协议扩张破坏现有链路**：2→8 种协议若分派疏漏，会误路由现有 Lovart(apimart)/魔搭(openai)/APM(openai)。必须向后兼容。
3. **responses 格式差异**：请求体（`input` 数组、`tools[{type}]`）与响应体（`output`）和 chat/completions 完全不同，SSE/非流式/轮询三套都要适配。

### 四、约束清单（State 4）

**模块约束：**

| 模块 | 核心约束 |
|------|---------|
| 1. 协议适配层 | 每种协议一个 adapter，注册表分派；`resolveProviderTarget`/`buildTargetUrl` 只查注册表；未知协议兜底不报错 |
| 2. 请求形态层 | `image_request_mode` 4 形态真正驱动生图端点/格式；聊天新增形态（chat/completions vs responses）；支持自动探测 + 配置覆盖 |
| 3. 模型分类与能力层 | `classify_upstream_model`（video→image→chat）；`model_protocols`/端点覆盖生效；不同协议可挂不同分类策略 |
| 4. 平台专属配置层 | 方舟 AK/SK、RH 双 key、即梦 CLI、魔搭 Lora 等字段完整；密钥脱敏，明文只进 env/json 真相源 |
| 5. 前端设置面 | 协议下拉 8 项；形态选择；平台专属面板；自动探测反馈；向后兼容现有 2 协议配置 |

**跨模块约束：**
- **C1 向后兼容**：现有 Lovart(apimart)、魔搭(openai)、APM(openai) 改造后零改动、请求照常。
- **C2 单一真相**：协议判断只看 `protocol` 字段，不做域名嗅探；字段必须真正驱动请求，禁止死字段。
- **C3 可插拔**：加新平台 = 新增 adapter + 注册表 + 前端下拉，不动主体。
- **C4 密钥安全**：所有密钥脱敏回传，明文只进 env/json 真相源。

---

## 第 2 层 · 模块 1：协议适配层

> 已确认（State 1-4），追加为契约。

### 职责（边界对齐）

统一"前端 rawUrl → 真实转发目标"，每种协议一个 adapter，注册表分派。只负责 URL 拼装 + 鉴权头注入，**不碰请求体/响应体**（归模块 2）。

### 子模块

1. 适配器注册表（`adapters[]`，按 protocol 命中）
2. HTTP 远程适配器（openai/apimart/gemini/volcengine/runninghub）
3. CLI 本地适配器（jimeng/codex/gemini-cli）
4. 协议归一化（白名单 8 选 1 + 平台 id 锁协议）
5. 前端 buildTargetUrl（可插拔，与后端一一对应）

### 约束

| # | 约束 | 验证标准 |
|---|------|---------|
| M1-1 | 注册表分派，零散落 if/else | 加协议=只加数组元素，主体函数不变 |
| M1-2 | 协议白名单 8 选 1 + 平台 id 锁协议 + 非法回退 openai | normalize 后 protocol 必在白名单 |
| M1-3 | HTTP vs CLI 两类区分；CLI 不走 proxy 转发 | CLI 适配器不拼 URL、不注入 key |
| M1-4 | 未知协议兜底：原样透传 + 不注入 key | 白名单外 → `{url: rawUrl}`，不崩溃 |
| M1-5 | 前后端适配器注册表一一对应 | 前端 8 协议下拉 = 后端 adapters 的 protocol 集合 |

**支撑跨模块约束**：M1-1/3/5→C3 可插拔；M1-2→C2 单一真相；M1-4→C1 向后兼容。

---

## 第 2 层 · 模块 2：请求形态层

> 已确认（State 1-4），追加为契约。

### 职责（边界对齐）

同协议内的请求端点/格式差异。生图 4 形态（openai/openai-json/openai-video-proxy/openai-responses）+ 聊天形态（chat/completions vs responses）。自动探测 + 配置覆盖。**依赖模块 1 的 base_url 解析结果，不重叠（模块 1 管 host/协议，模块 2 管端点/格式）。**

### 子模块

1. 生图形态分派（image_request_mode 4 形态 → 端点+body）
2. 聊天形态分派（chat/completions vs responses → 端点+body+响应解析）
3. 形态自动探测（detect：按 base_url/models 自动选）
4. 形态配置覆盖（手动 > 探测 > 默认 openai）

### 约束

| # | 约束 | 验证标准 |
|---|------|---------|
| M2-1 | 生图 4 形态真正驱动端点/格式 | 切形态→请求走对应端点+body，实测成功 |
| M2-2 | 聊天新增形态：默认 chat/completions，可选 responses | gpt-5.6 用 responses 能带 tools 返回结果 |
| M2-3 | responses 请求构造+响应解析（含工具）+SSE/非流式各自适配 | responses 聊天/生图带 tools 全流程可用 |
| M2-4 | 工具循环解析兼容 responses 的 function_call 格式 | 画布工具在 responses 模式下能执行 |
| M2-5 | 形态探测默认保守：手动 > 探测 > 默认 openai | 未配置时走 openai，不误判 |

**支撑跨模块约束**：M2-1→C2 单一真相；M2-2→C1+解痛点；M2-3/4→C3 可插拔；M2-5→C1 向后兼容。

---

## 第 2 层 · 模块 3：模型分类与能力层

> 已确认（State 1-4），追加为契约。

### 职责（边界对齐）

拉取模型时分类（video/image/chat）+ 单模型能力标记（`model_protocols`、端点覆盖）。`model_protocols` 决定某模型用哪协议（供模块 1 命中），模块 3 管"归哪类+能力标签"，模块 2 管"该类走哪端点"，正交。

### 子模块

1. 拉取模型分类（classify_upstream_model：video→image→chat 兜底）
2. 单模型协议覆盖（model_protocols）
3. 单模型端点覆盖（image_generation/edit_endpoint）
4. 分类策略注册表（不同协议可挂不同分类）

### 约束

| # | 约束 | 验证标准 |
|---|------|---------|
| M3-1 | 拉取模型分类 video→image→chat 兜底 | 混台模型分类正确 |
| M3-2 | `model_protocols` 单模型覆盖穿透到协议分派 | 某模型强制协议→走对应 adapter |
| M3-3 | 分类策略注册表：不同协议可挂不同分类 | 切协议→用对应分类规则 |
| M3-4 | 官方 category 校正覆盖关键字结果（不丢失） | 官方 image+关键字兜底 chat → 归 image |
| M3-5 | 端点覆盖格式校验（/v1/ 开头或完整 http） | 非法端点→回退默认，不 404/SSRF |

**支撑跨模块约束**：M3-1/4→C2 单一真相；M3-2/3→C3 可插拔；M3-5→C4 密钥安全。

---

## 第 2 层 · 模块 4：平台专属配置层

> 已确认（State 1-4，**密钥按用户要求简化**），追加为契约。

### 职责（边界对齐）

平台专属字段（ms_loras / rh_apps / rh_workflows / volcengine_*）+ **简化密钥管理**。

**简化原则（个人项目）**：
- 密钥只保留**单一 `api_key`**，不做 wallet_key / volc AK+SK 分离 / 多 key。
- 密钥只进 env 真相源 + 脱敏回传（`has_key`/`key_preview`）。

### 子模块

1. 平台专属字段归一（ms_* / rh_* / volcengine_*）
2. 单一密钥管理（api_key：env 真相源 + 脱敏回传 + 清 key 单一标志）

### 约束

| # | 约束 | 验证标准 |
|---|------|---------|
| M4-1 | 平台专属字段完整归一 | 保存后结构完整，前端渲染正常 |
| M4-2 | 单一 api_key 只进 env，绝落 json | providers.json 无明文 key |
| M4-3 | 清 key 单一标志：先清后写，防回显 | clear+新key 并存 → 最终为新 key |
| M4-4 | 密钥脱敏视图（has_key / key_preview） | GET 返回脱敏，无明文 |
| M4-5 | 前端平台面板与后端字段对应 | 填 key→存对 env；切平台→面板正确 |

**删除**：多 key（wallet/volc AK/SK）、多 clear 标志（用户要求简化）。

**支撑跨模块约束**：M4-1→C2 单一真相；M4-2/3/4→C4 密钥安全；M4-5→C3 可插拔。

---

## 第 2 层 · 模块 5：前端设置面

> 已确认（State 1-4），追加为契约。

### 职责（边界对齐）

前端配置界面——协议下拉（8 项）、形态选择、平台专属面板、自动探测反馈。纯 UI 层，调后端 API，不直接改协议分派逻辑。消费模块 1-4，无重叠。

### 子模块

1. 协议下拉 + 形态选择（8 协议 / 4 生图形态）
2. 平台专属面板（按 protocol 条件渲染：CLI/方舟/魔搭 Lora 等）
3. 自动探测反馈（test-connection 结果 + 建议切换）
4. 密钥输入（password 型 + 清 key 按钮）

### 约束

| # | 约束 | 验证标准 |
|---|------|---------|
| M5-1 | 协议下拉 8 项、生图形态 4 项，由与后端同源常量驱动 | 加协议→下拉自动出选项 |
| M5-2 | 平台专属面板按 protocol 条件渲染 | 切协议→对应面板正确显隐 |
| M5-3 | 自动探测结果作为建议，用户确认才覆盖 | 探测不自动改用户已填配置 |
| M5-4 | 密钥输入 password 型 + 清 key 按钮 | key 不明文；清 key 走标志 |
| M5-5 | 现有 provider 配置在界面零丢失 | Lovart/魔搭/APM 渲染后字段完整 |

**支撑跨模块约束**：M5-1/2→C3 可插拔；M5-3/5→C1 向后兼容；M5-4→C4 密钥安全。

---

## 第 2 层完成

5 大模块约束已全部追加。进入第 3 层递归判断——各模块约束 ≤5 条、均有可验证标准、可独立执行 → **无需再递归细化，PRD 完成**。

---

## 补充细节（深挖 Infinite-Canvas 实测，PRD 初稿未覆盖）

> 来源：Infinite-Canvas `main.py`（generate_ai_image:10482 / test_connection:12768 / effective_protocol:4316 / parse_upstream_models:12729 等）。

### A. 协议适配层（模块 1 补充）

| # | 细节 | 依据 |
|---|------|------|
| A1 | **各协议 models 端点不同**：gemini→`/v1beta/models`、volcengine→`/api/v3/models`、runninghub→`/openapi/v2/models`、其它→`/v1/models` | main.py:12834 |
| A2 | **is_apimart_provider 保留域名嗅探**（`"apimart.ai" in base_url`）——参考实现自己也有域名嗅探，是有意为之；需评估"protocol 字段优先 + 域名兜底"双判 | main.py:4331 |

### B. 请求形态层（模块 2 补充）

| # | 细节 | 依据 |
|---|------|------|
| B1 | **生图分发按 `effective_protocol(provider, model)`（含单模型覆盖）分派**，非只看 provider.protocol | main.py:10494 |
| B2 | **参考图区分 mask/image**：`role=mask` 或 `_mask.png` 后缀是蒙版，不进 image_refs | main.py:10511 |
| B3 | **超时按模型/形态动态调整**：gpt2/apimart/openai-json/video-proxy/responses 用更长超时 | main.py:10514 |
| B4 | **端点覆盖真正生效**：`image_generation_endpoint`/`image_edit_endpoint` 拼进生图 URL（`provider_endpoint_url`） | main.py:10508 |

### C. 模型分类层（模块 3 补充）

| # | 细节 | 依据 |
|---|------|------|
| C1 | **单模型协议覆盖只限 `{openai, gemini}`**（`PER_MODEL_PROTOCOL_OPTIONS`），其余丢弃 | main.py:4290 |
| C2 | **协议锁死平台**：`FIXED_PROTOCOL_PROVIDER_IDS={modelscope,volcengine,jimeng,runninghub}` 不支持单模型覆盖 | main.py:4292 |
| C3 | **`normalize_model_name_map`**：`label==model` 时不存显示名（省空间） | main.py:4305 |

### D. 前端/探测（模块 5 补充）

| # | 细节 | 依据 |
|---|------|------|
| D1 | **test-connection 按协议分派**：codex/gemini-cli 查本机、jimeng 查登录、runninghub 拉注册表、其它拉 /v1/models | main.py:12772 |
| D2 | **test-connection 顺带返回模型分类**（image/chat/video/all），省一次 fetch-models | main.py:12859 |
| D3 | **跳转/HTML 探测**：301/302/307/308 提示"填 API Base URL 不是网页"；HTML 响应提示 | main.py:12831 |
| D4 | **方舟自动探测兜底**：openai 但 /v1/models 失败时自动探测方舟并切换 | main.py:12846 |

> 上述细节纳入对应模块约束实现时的**验收标准**，不新增模块（已含在 M1/M2/M3/M5 的边界内）。

### E. 补充细节（第二批：视频分派 / 端点 / 异步 / 锁平台）

| # | 细节 | 依据 |
|---|------|------|
| E1 | **视频端点按平台多候选探测**：灵境`/v1/videos`、apimart`/videos/generations`、方舟`/api/v3/contents/generations/tasks`、玉玉`/v1/video/create`、通用`/v1/videos/generations`+`/v2/...` | main.py:13663 |
| E2 | **视频任务查询 URL 也按平台多候选**（v1/v2/generic 都试，谁成功用谁） | main.py:13676 |
| E3 | **端点 404/405 继续试下一个候选**，不直接抛错（v1 失败轮不到 v2 的 bug 已修） | main.py:14438 |
| E4 | **`LOCKED_RECOMMENDED_PROVIDER_RULES` 锁平台**：按 id/name/域名识别已知站（fhl/exellome）→ 锁死 protocol + image_request_mode | main.py:1180 |
| E5 | **异步轮询 apimart 用不同超时/间隔**（APIMART_IMAGE_TASK_TIMEOUT vs IMAGE_TASK_TIMEOUT） | main.py:6173 |
| E6 | **尺寸对齐 16 倍数**（snap_size_to_multiple）；GPT 有像素上限校验（8.29M） | main.py:8900 |
| E7 | **图片参考只收 image**（image_references 过滤）；支持 mask 蒙版区分 | main.py:7566 |
| E8 | **`normalize_endpoint_override` 校验**：>300 字符或含空白→400；http(s)→原样；`/`→路径；否则→400 | main.py:1164 |
| E9 | **`provider_endpoint_url`**：override 有则用，否则拼默认路径；用 base 的 scheme://netloc | main.py:1221 |
| E10 | **前端模型三类分开展示**（renderModels image/chat/video）；模型重命名时同步清理 model_names/model_protocols 旧键 | api-settings.js:3407 |

> 视频分派（E1-E3）是独立于生图的分派树，目前我们视频硬编码 `/v1/videos/generations`，需按协议多候选探测补齐。E4 是"推荐平台锁配置"机制，纳入 M2/M5 验收。

### F. 补充细节（第三批：协议自动识别 / 平台识别 / 密钥映射）

| # | 细节 | 依据 |
|---|------|------|
| F1 | **test-connection 探测序列**：apimart→假 task_id 探测 `/v1/tasks/`（400+invalid task id=可用）；openai→`/v1/models`→失败再探 `/v1/chat/completions`（网关常不暴露 models）→再探方舟 | main.py:12910 |
| F2 | **平台识别混用多信号**：protocol + id + 域名 + 模型名前缀（如 is_agnes 看域名或模型名 agnes-video- 前缀；is_lingjing 看 id 或 apistudio.vip） | main.py:4360/5289/5294 |
| F3 | **key env 映射按平台**：comfly→COMFLY_API_KEY、modelscope→MODELSCOPE_API_KEY、volcengine→ARK_API_KEY、自定义→API_PROVIDER_{ID}_KEY | main.py:702 |
| F4 | **probe-async 探测**：假 task_id 探测异步端点，区分"端点存在+key有效(400)" / "key无效(401/403)" / "不支持(404)" | main.py:12882 |
| F5 | **协议锁 id**：protocol_from_payload 里 volcengine/runninghub id → 锁死协议 | main.py:12548 |
| F6 | **CLI 协议不走 key**：api_headers 对 codex/gemini-cli 直接 400"用本机登录态"，不走 API Key | main.py:3586 |

> F2 是平台识别的核心——**不是只看 protocol**，而是"protocol + id + 域名 + 模型名"多信号。我们目前只认 protocol（C2 单一真相），需评估是否引入"域名/id 识别"（用于平台专属行为）。F4 的 probe-async 我们已有雏形，需对齐探测判断细节。

### G. 补充细节（第四批：错误提示 / 前端单模型协议 / 数据一致性 / CLI）

| # | 细节 | 依据 |
|---|------|------|
| G1 | **错误友好提示体系**：`friendly_chat_error_detail` / `friendly_image_error_detail` 把上游原始错误翻译成中文可操作提示（401→"Key 无效"、429→"限流"、方舟→"改用 ep- 接入点"、GPT 尺寸超限等） | main.py:9093/9143 |
| G2 | **单模型协议选择器（前端）**：只对 image/chat 模型显示（video 不显示）；只有非锁死平台能选；可选"默认/openai/gemini"；选非 openai/gemini 则删键 | api-settings.js:3396 |
| G3 | **模型重命名数据一致性**：重命名时迁移 model_protocols/model_names 键到新名；旧名在其它列表仍用时保留旧键 | api-settings.js:3646 |
| G4 | **模型删除清理**：删除时清理不再使用的 model_protocols/model_names 键 | api-settings.js:3687 |
| G5 | **CLI 深度适配**：即梦支持 WSL、codex/gemini-cli 查二进制、超时、stdout 解析、输出图片文件扫描 | main.py:4375 起 |
| G6 | **前端模型三类分开展示**（canvas.js）：生图/LLM/视频节点各自 provider+model 下拉；魔搭专属模型/Lora 按模型过滤 | canvas.js:716 |
| G7 | **默认平台不可删**（modelscope/volcengine/runninghub 等内置平台 readonly，可改不可删） | api-settings.js:777 |

> G1 是**错误降级提示**基础设施，我们完全没有；它能把 gpt-5.6 这类"Function tools..."错误翻译成可操作提示。G2/G3/G4 是前端 model_protocols/model_names 的完整数据一致性逻辑，纳入 M5 验收。G5 是 CLI 平台接入时的深度适配（个人项目可后置）。

### H. 补充细节（第五批：responses 流式 / video 多候选 / agent 意图路由）

| # | 细节 | 依据 |
|---|------|------|
| H1 | **responses 生图流式解析**：处理 `response.completed`/`response.incomplete`/`response.failed`/`error` 事件；**流被掐断时用最后一张图兜底** | main.py:4221 |
| H2 | **responses 生图结果兜底解析**：某些中转不返回标准 image_generation_call，把图片 URL 写在 output_text 的 markdown/裸 URL 里 | main.py:4071 |
| H3 | **video 提交多候选重试**：404/405 或 HTML 响应→继续试下一个候选端点；其它错误（模型/额度）直接抛（端点在） | main.py:14429 |
| H4 | **agent 意图路由而非 function tools**：先让 LLM 返回 JSON action（chat/generate_image/edit_image），后端再分发调生图/聊天接口——**绕开"chat/completions 传 tools"限制** | main.py:16045 |
| H5 | **video 参数按协议透传**：不同平台视频参数集不同（enhance_prompt/upsample/camerafixed/seed/generate_audio 等按需带） | main.py:14410 |
| H6 | **video HTML 响应友好报错**：Base URL 指到网页入口而非 API 时，给明确提示 | main.py:14460 |

> H1/H2 是 responses 适配的核心容错（流式兜底 + 结果兜底），纳入 M2-3 验收。H4 是 agent 的备选思路——若 function tools 在特定平台不可用，可降级为"意图路由 + 后端分发"。H3 印证 E3（video 多候选端点）。
