# TASK-023 — AI 提供商与生图执行核验（大雄多引擎 vs 我们 provider 体系）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
大雄 Infinite-Canvas 支持**多生图引擎**：ComfyUI（本地）、RunningHub（工作流）、火山引擎、ModelScope、即梦 CLI（文生图/图生图/文生视频/图生视频），还有扩展图（Outpaint）、360 全景、视频帧抽取。我们（maomao）有 `providerStore`（image/video provider）+ `imageApi`/`videoApi`。本任务核验大雄的生图执行与多引擎能力，判断我们要不要对齐（如 ComfyUI 本地调用 / RunningHub 工作流 / 即梦）。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）
### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`）
- **提供商枚举**：`imageProviders` @ L2206、`volcengineProvider` @ L2209、`runningHubProvider` @ L2218、`modelscopeProvider` @ L2466、`chatApiProviders` @ L2329、`videoApiProviders` @ L2473
- **ComfyUI**：`ensureComfyWorkflow` @ L2628、`currentComfyFields` @ L2635、`renderComfyParams` @ L2916、`comfyParamValue` @ L2638
- **RunningHub 工作流**：`ensureRunningHubWorkflow` @ L3487、`rhBuildWorkflowRequestExtras` @ L3713、`rhBuildNodeInfoList` @ L3749、`rhWorkflowJsonFromSources` @ L2269
- **即梦**：`jimengImageEditMode` @ L2374、`jimengVideoCommand` @ L2407
- **请求构造**：`buildPromptRequest` @ L13011、`buildPromptRequestForNode` @ L13860
- **大小/比例解析**：`parseSizeValue` @ L2589、`parseRatioValue` @ L2593、`apiImageSize` @ L2601

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/settings/providerStore.js`（provider 配置）
- `/Users/kevin/Documents/maomao/src/components/base/imageApi.js`（图生图 API）
- `/Users/kevin/Documents/maomao/src/components/base/videoApi.js`（视频 API）
- `/Users/kevin/Documents/maomao/src/components/base/useNodeGeneration.js`（节点执行）
- `/Users/kevin/Documents/maomao/src/components/base/settings/sections/ApiSettings.jsx` / `ModelSection.jsx`

## 四、覆盖清单

### 核验点 1：大雄生图执行与多引擎
- **多引擎路由**：不同 provider 怎么按类型（image/video）分发生成请求？
- **ComfyUI 本地调用**：`ensureComfyWorkflow`（L2628）怎么跑本地 ComfyUI 工作流？
- **RunningHub 工作流**：`rhBuildWorkflowRequestExtras`（L3713）怎么把节点参数映射到工作流输入？
- **即梦 CLI**：`jimengImageEditMode`/`jimengVideoCommand`（L2374/L2407）调本地 CLI。
- **请求构造**：`buildPromptRequest`（L13011）怎么组图生图/参考图/多图请求体？

### 核验点 2：我们现状（代码证据）
- `providerStore.js`：支持哪些 provider（image/video）？有没有 ComfyUI / RunningHub / 即梦？
- `imageApi.js` / `videoApi.js`：请求构造能力（图生图/参考图/多图）？分辨率/比例解析（中文）？
- `useNodeGeneration.js`：节点执行怎么调 provider？
- 结论：我们是"HTTP provider 抽象"，大雄额外有"本地 ComfyUI + RunningHub 工作流 + 即梦 CLI"，这几类是否我们缺？

### 核验点 3：结论 —— 值不值得对齐
- 能力矩阵：多 image provider / 多 video provider / ComfyUI 本地 / RunningHub 工作流 / 即梦 CLI / 参考图 / 分辨率比例解析。
- 每项：我们现状、缺口、落点、成本、价值。
- **关键判断**：我们已有 provider 抽象，补"新 provider 类型"（ComfyUI/RunningHub）是加配置还是动架构？哪些是高频刚需（如参考图/比例）？
- 明确"利大于弊 / 弊大于利"倾向。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）+ 价值判断」三节。

## 六、验收标准
1. 三节贯通，带文件+行号+片段。
2. 明确区分"已有能力补强"与"全新 provider 接入"。
3. 每项有成本与价值评级。
4. 亲自核实代码。

## 八、核验结论（本次实际核实）

> 所有行号均来自本次 `read_file` 实际打开的文件与行。大雄侧：`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`；我们侧：`/Users/kevin/Documents/maomao/src/...`、`localTool/src/...`。

### 核验点 1：大雄生图执行与多引擎

#### （1）多引擎路由
引擎由 `settings.engine` 决定，分发在 `generateUrlsForCurrentSettings`：

**提供商枚举（多引擎集合的来源）**：`imageProviders`（L2206，过滤 enabled 且排除 modelscope/volcengine 且有 image_models）、`volcengineProvider`（L2209，硬编码火山引擎兜底）、`runningHubProvider`（L2218，按 id=`runninghub` 查）、`modelscopeProvider`（L2466，按 id=`modelscope`）、`chatApiProviders`（L2329，聊天类）、`videoApiProviders`（L2473，视频类，兜底 `comfly`）。即大雄的「多引擎」是把 `apiProviders` 配置按 `id`/`engine` 分桶后，由各 `xxxProvider()` getter 派发，前端 `renderDynamicParams`（L2725）把 `engine` 规整为 `['api','volcengine','modelscope','comfy','runninghub']` 五选一。

```13869:13903:static/js/smart-canvas.js
async function generateUrlsForCurrentSettings(node, prompt, refs, runSettings=settings){
    const activeSettings = runSettings || settings;
    if(activeSettings.engine === 'comfy') return generateComfyUrlsWithSettings(activeSettings, prompt, refs);
    if(activeSettings.engine === 'runninghub' && runningHubSelectedModel(activeSettings)){
        const taskResult = await runApiGeneration(prompt, refs, runningHubModelApiSettings(activeSettings));
        ...
    }
    if(isApiLikeEngine(activeSettings.engine) && activeSettings.apiKind === 'video'){
        return {urls:await runApiVideoGeneration(prompt, refs, activeSettings), kind:'video'};
    }
    if(isApiLikeEngine(activeSettings.engine)){
        const taskResult = await runApiGeneration(prompt, refs, activeSettings);
        ...
    }
    const urls = activeSettings.engine === 'runninghub'
        ? await runRunningHubGeneration(prompt, refs, activeSettings)
        : activeSettings.engine === 'modelscope'
            ? await runModelscopeGeneration(prompt, refs, activeSettings)
            : [];
    return {urls, kind:mediaKindForUrls(urls, 'image')};
}
```

`engine` 取值集合在 `renderDynamicParams` 中被规整：`['api','volcengine','modelscope','comfy','runninghub']`（L2725）。`isApiLikeEngine` 仅认 `'api'`/`'volcengine'`（L661）。**结论**：大雄是「5 引擎并行」：`api`（HTTP）、`volcengine`（火山）、`modelscope`（魔搭）、`comfy`（本地 ComfyUI）、`runninghub`（工作流云）。

#### （2）ComfyUI 本地调用
`ensureComfyWorkflow`（L2628）从本地后端 `/api/workflows/{name}` 拉取工作流 JSON 缓存；`generateComfyUrlsWithSettings`（L13904）按 `comfyMode` 分 `text`/`enhance`/`edit`/自定义工作流，调 `runQueuedSmartComfyGenerate`。

```13836:13839:static/js/smart-canvas.js
async function runQueuedSmartComfyGenerate(payload){
    const task = await createSmartComfyTask(payload);
    return waitSmartComfyTaskResult(task.task_id);
}
```

`createSmartComfyTask`（L13814）实际 POST `/api/canvas-comfy-tasks`。即 ComfyUI 是「后端代理本地 ComfyUI 服务（127.0.0.1:8188 类）」，前端只发工作流 JSON + 参数映射，由后端队列化执行并轮询 `waitSmartComfyTaskResult`（L13823，每 1600ms 拉一次）。`comfyParamsFromWorkflowValues`（L13840）把 field 的 `node`/`input` 映射到工作流节点参数。

**两条入口、同一出口**：`generateComfyUrlsWithSettings`（L13904）是节点内联生成入口；另有 `runComfyGeneration`（L14841）→ `runComfyText`（L14892）/ `runComfyEnhance`（L14906）/ `runComfyEdit`（L14921）三条预置模式（Z-Image / Z-Image-Enhance / Flux2-Klein 工作流），三者最终都调 `runQueuedSmartComfyGenerate`（L13836），即**全部经后端代理本地 ComfyUI，前端绝不直接连 8188**。参考图进入 ComfyUI 前需先 `comfyNameForRef`（L14938）：`fetch(ref.url)` 取 blob → `FormData` POST `/api/upload`（L14945）→ 后端把图落地并返回 ComfyUI 内部名，再填入工作流 `params` 节点。这是我们侧没有的「本地工作流 + 参考图上传到本地后端」链路。

#### （3）RunningHub 工作流
`ensureRunningHubWorkflow`（L3487）从 `/api/runninghub/workflows/{id}` 取工作流定义；`rhBuildNodeInfoList`（L3749）把激活字段映射成 `[{nodeId, fieldName, fieldValue}]`；`rhBuildWorkflowRequestExtras`（L3713）在 `prune-workflow` 模式下剪掉缺图的可选 field 并把裁剪后的 workflow 回传。

```3713:3735:static/js/smart-canvas.js
async function rhBuildWorkflowRequestExtras(media, nodeInfoList, sourceSettings=settings){
    const config = await currentRunningHubWorkflowConfig(sourceSettings);
    if(!config || (config.optionalImageMode || 'prune-workflow') !== 'prune-workflow') return {};
    const fields = rhActiveFields(sourceSettings);
    const indexes = rhFieldIndexes(fields);
    ...
    const workflow = rhPruneWorkflowForMissingFields(config.workflowJson || {}, missingOptional);
    return workflow ? {workflow} : {};
}
```

`runRunningHubGeneration`（L14697）提交到 `/api/runninghub/submit`（webapp）或 `/api/runninghub/workflow-submit`（workflow），然后每 2500ms 轮询 `/api/runninghub/query`（最多 720 次≈30min）。

#### （4）即梦（核实纠正：非 CLI，是网关 HTTP）
即梦并非本地 CLI，走 HTTP 网关。`runApiVideoGeneration`（L14739）POST `/api/canvas-video`。`videoProviderPlatform`（L2360）对 `jimeng` 的判定：

```2360:2367:static/js/smart-canvas.js
function videoProviderPlatform(providerId){
    const p = (apiProviders || []).find(x => x.id === providerId);
    const proto = String(p?.protocol || '').toLowerCase();
    const base = String(p?.base_url || '').toLowerCase();
    if(proto === 'apimart' || base.includes('apimart.ai')) return 'apimart';
    if(proto === 'volcengine' || providerId === 'volcengineturn') return 'volcengine';
    return '';
}
```

注意：`jimeng` 既非 `apimart` 也非 `volcengine`，故 `videoProviderPlatform('jimeng')` 返回 `''` → 在 `runApiVideoGeneration`（L14747 `targetPlatform` 为 `''`）走默认 apimart 网关分支（L14752 `if(targetPlatform && uris[targetPlatform])` 不命中，回退 `ref.url`）。即**即梦在后端经 apimart 网关出图，前端不做 CLI 调用**。`jimengVideoCommand`（L2407）按参考图数量推断 `text2video`/`image2video`/`multiframe2video`/`frames2video` 等指令；`jimengImageEditMode`（L2374）按参考图存在与否切文生图/图生图（图生图时隐藏 3.0/3.1 模型，见 `JIMENG_IMAGE2IMAGE_UNSUPPORTED` L2373）。轮询 `/api/jimeng/query-media`（L15070）。`runApiVideoGeneration` 还支持视频**帧角色**：`videoUseFrameRoles` 时第 1 张参考图标 `first_frame`、第 2 张标 `last_frame`（L14760-14763）。

#### （5）请求构造 `buildPromptRequest` / `buildPromptRequestForNode`
`buildPromptRequest`（L13011）把提示词片段 + 参考图拼成 `{prompt, refs:[{url,name,kind,role}], mentioned}`。参考图带 `role:image_N`，且支持 `@图N` mention token、blockedRefs 过滤、`SMART_REFERENCE_IMAGE_MAX` 上限（L13037，`SMART_REFERENCE_IMAGE_MAX = 20`，见 L20）。`runApiGeneration`（L14687）把 refs 转 `reference_images` 进 body（L14690）。

另有一个 DOM 依赖封装 `buildPromptRequestForNode`（L13860）：

```13860:13868:static/js/smart-canvas.js
function buildPromptRequestForNode(node, defaultImages, ctx=smartLoopContext){
    const oldHtml = promptInput.innerHTML;
    loadNodePromptDraftToInput(node);
    try {
        return buildPromptRequest(node, defaultImages, false, ctx);
    } finally {
        promptInput.innerHTML = oldHtml;
    }
}
```

它临时把 node 的提示词草稿灌入全局 `promptInput` DOM 再调 `buildPromptRequest`，依赖 DOM，不适合无头/服务化环境。这也解释了为何我们侧把「提示词+参考图收集」做成纯数据函数逻辑（节点 data 直接驱动 `generateImage`），不依赖 DOM 草稿——架构取向不同，但能力等价。

#### （6）大小/比例解析
`apiImageSize`（L2601）用 `SIZE_MAP`（L366，square/portrait/landscape/story/wide/ultrawide 等 9 档）×`RES_LONG_SIDE`（L377：1k=1536/2k=2048/4k=3840）查表；`parseSizeValue`（L2589）/`parseRatioValue`（L2593）解析自由尺寸。注意：大雄表中无 `source` 原图比时按 custom 算；比例非 16 对齐（如 story=720x1280）直接命中枚举。我们侧用 `RATIO_PIXEL_TABLE`（L172，14 档）做同样的「比例×档位→精确像素」查表（L197 `resolveImagePixel`），方向一致、命名档不同。

---

### 核验点 2：我们现状（代码证据）

#### （1）providerStore.js —— provider 抽象
`emptyProvider`（L47）字段：`protocol: 'openai'`、`image_request_mode: 'openai'`、`image_mode: 'sync'`，含 `image_models`/`chat_models`/`video_models`。`load`（L66）从 `providerApi.getProviders()` 取，`save`（L150）只持久化 `protocol/image_request_mode/image_mode/...models`。`protocol` 仅 `apimart`/`openai`（见下文 ProviderForm）。**无 ComfyUI/RunningHub/即梦/volcengine/modelscope 的 provider 类型**——`modelscope` 仅被 `AgentPanel.jsx L89` 作为聊天 provider 回退引用，未接入生图链。

#### （2）imageApi.js / videoApi.js —— 请求构造
- 多图/参考图：`generateImage`（L216）用 `resolveRefImages(images)`（L226）把参考图转 `image_urls` 进 body（L227）；支持 `refFormat:'base64'` 走 base64，否则走 URL。
- 比例×清晰度→精确像素：`resolveImagePixel`（L197）+ `RATIO_PIXEL_TABLE`（L172）查表（1:1/16:9/9:16/3:2/2:1/4:3 等 14 档 ×1K/2K/4K）。比大雄多覆盖超宽/超长比例（21:9、9:21、1:3、3:1、1:2），但**无 story/portrait 命名档**（命名体系不同，本质等价）。
- 同步/异步：`generateSync`（L86，?wait=1 读 SSE）/ `generateAsync`（L110，提交拿 task_id 轮询 `/v1/tasks/{id}`）。视频 `generateVideo`（L116）强制异步。
- 视频参考图：`image_urls` 支持图生视频（L122-123）；`size` 给比例、`resolution` 给清晰度、`duration` 给秒数。

#### （3）useNodeGeneration.js —— 节点执行
`start`（L64）统一「校验→reportGenerate→setCurrentTaskId→run→双写(node.data+taskStore)→registerTaskRetry」。各节点把 `run` 写成 `generateImage(...)`/`generateVideo(...)` 调用（`useNodeGeneration` 注释 L33）。**结论**：我们已有「provider 抽象 + HTTP 转发 + 统一节点生成契约」，但 provider 仅 HTTP（`apimart`/`openai`），无本地 ComfyUI、无 RunningHub 工作流、无火山/即梦专属引擎。

#### （4）后端 localTool —— 明确为扩展点
`localTool/src/routes/providers.ts`：
```25:25:localTool/src/routes/providers.ts
// 扩展点：将来可加 gemini / volcengine / runninghub / CLI，前端协议下拉与 test 探测随之扩展。
```
```388:388:localTool/src/routes/providers.ts
// 将来加新协议（gemini → /v1beta、volcengine → /api/v3、runninghub → /openapi/v2）只需
```
`PROTOCOLS`（ProviderForm L16）仅 `apimart`/`openai`；`REQUEST_MODES`（L25）4 选 1（`openai`/`openai-json`/`openai-video-proxy`/`openai-responses`）。**即：我们当前架构把 provider 当「HTTP 网关 + 协议适配」，本地引擎/工作流引擎均未落地。**

---

### 核验点 3：结论 —— 值不值得对齐

能力矩阵（**已有能力补强** vs **全新 provider 接入** 已区分）：

| 能力 | 我们现状 | 缺口 | 落点 | 成本 | 价值 | 倾向 |
|---|---|---|---|---|---|---|
| 多 image HTTP provider | ✅ protocol+models | — | — | 低 | 高（已有） | 已具备 |
| 多 video HTTP provider | ✅ videoApi + models | — | — | 低 | 高 | 已具备 |
| 参考图（图生图/图生视频） | ✅ `image_urls`+resolveRefImages | 缺「mention token / role 多图定位」 | 补强：参考图 role 映射 | 低 | 高（刚需） | **利大于弊（补强）** |
| 参考图数量上限 | ⚠️ 无上限（全量发 `image_urls`） | 大雄有 `SMART_REFERENCE_IMAGE_MAX=20`（L20）裁剪 | 补强：前端截断到 20 | 极低 | 中 | **利大于弊（补强）** |
| 视频帧角色（首/尾帧） | ❌ `generateVideo` 无 first/last_frame | 大雄 `videoUseFrameRoles` 标 `first_frame`/`last_frame`（L14760） | 补强：参考图加 role 字段 | 低 | 中（图生视频高频） | **利大于弊（补强）** |
| 比例×清晰度→精确像素 | ✅ RATIO_PIXEL_TABLE（14 档） | 命名档与大雄不同（等价） | 无需对齐 | 0 | 中 | 已具备 |
| 同步/异步 + 任务恢复 | ✅ generateSync/Async + pollTask | — | — | 低 | 高 | 已具备 |
| ComfyUI 本地引擎 | ❌ | 需后端代理本地 ComfyUI + 工作流字段映射 + 参考图上传后端 | **全新接入** | 高（后端队列+节点参数 schema+upload） | 中（本地部署用户才用） | **弊大于利（非刚需，按需）** |
| RunningHub 工作流 | ❌ | 需工作流字段/节点映射 + 裁剪逻辑 | **全新接入** | 高（字段 schema+prune 逻辑） | 中 | **弊大于利（按需）** |
| 火山引擎 volcengine | ❌ | 需新协议 `/api/v3` + video 模型集 | **新协议接入**（后端已留扩展点） | 中 | 中 | 利大于弊（网关类，低成本） |
| 即梦 jimeng | ⚠️ 走 apimart 网关已可生图 | 缺「文/图生视频指令自动推断、图生图模型过滤、帧角色」 | 补强：指令推断 + 模型过滤逻辑 | 低（纯前端逻辑） | 高（高频） | **利大于弊（补强）** |
| 魔搭 modelscope | ⚠️ 仅聊天回退 | 未接生图链（大雄有完整 `runModelscopeGeneration` L14799：zimage/qwen_edit/custom，参考图转 base64） | 补强：按 image_models 接 imageApi | 低 | 中 | 利大于弊（补强） |

**关键判断**：
1. 我们已有 provider 抽象，补「新 HTTP 协议 provider」（volcengine/即梦经网关）是**加配置 + 后端加一个协议分支**，**不动架构**；补 ComfyUI/RunningHub 是**全新 provider 类型**（本地/工作流引擎），需后端队列化 + 节点字段 schema + 裁剪逻辑，**动架构**。
2. 高频刚需集中在**纯前端/配置层补强**：参考图 role 定位、视频首/尾帧角色、参考图数量上限截断、即梦指令推断 + 模型过滤、modelscope 生图接入。这五类成本低（低~极低）、价值高，且无需动架构。
3. ComfyUI/RunningHub 属「本地部署/工作流高级用户」场景，当前本地 Tool 网关未代理本地 ComfyUI，投入产出比低，**建议暂不追平，仅保留扩展点**。

**最终倾向**：
- **利大于弊（应立即补强，纯前端/配置，不动架构）**：
  1. 参考图 role 多图定位（`image_urls` 加 `role:image_N`）
  2. 视频首/尾帧角色（`first_frame`/`last_frame`，图生视频高频）
  3. 参考图数量上限截断到 20（对齐 `SMART_REFERENCE_IMAGE_MAX`）
  4. 即梦指令自动推断 + 图生图模型过滤（纯前端逻辑）
  5. modelscope 生图接入（按 `image_models` 接 `imageApi`）
  6. volcengine 协议接入（后端已留扩展点，网关类低成本）
- **弊大于利（按需/暂缓，动架构）**：ComfyUI 本地引擎、RunningHub 工作流引擎——需后端队列化 + 节点字段 schema + 裁剪逻辑，架构改动大、受众窄，保持「协议扩展点」待后续。
- **已具备无需动**：多 image/video HTTP provider、比例像素查表（方向一致命名不同）、同步异步+任务恢复、参考图 base64/URL 双模。

---

## 七、铁律文件名
本文件即唯一产出。写满后结束。
