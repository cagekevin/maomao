# spec/DATAFLOW\.md · 数据流链路索引

> **目的**：让 AI 能**在一处读完一整条数据流链路**，不必在 core/api/store/utils/nodes/panels/hooks 之间乱猜、乱跳。
> **依据**：每条链路的「边」由 `scripts/mv-sync-refs.mjs refs <file>` 机械实证（2026-09-04），非凭文件名猜测。
> **物理归属**见 `src/components/base/README.md`；本文件只画链路与流向，**不决定文件位置**。查「文件实际被谁 import / 实际在哪」→ 跑 `refs <file>`。
> **省消耗铁律**：改某条链路时，照本文件该链路的文件清单走 + 读对应文件头注释即可，**不需要**为搞清楚「这条链路在哪几个文件」启动子代理全库乱搜——这张图就是答案。真拿不准单文件归属时才跑 `refs` 一锤定音。

***

## 生成链路（意图 → 出站 → 任务 → 结果 → 回填）★主链路

数据从画布节点发起，经统一生成入口，结果以「任务中心」为权威源回填节点。**结果权威源 = 任务中心，node.data 是渲染缓存副本**（红线，见 CONTEXT §五）。

```
nodes/*Node ─→ hooks/useNodeGeneration ─→ api/genIntent(意图定型) ─→ api/relayProxy
                                                                    │  作 POST /api/generate
                                                                    │  (chat→relayChat / image/video→relayGenerate)
                                          ┌── api/chatApi / imageApi / videoApi（门面收口）
                       store/taskStore ◄──┤
                       store/taskCompletionBus ── 完成事件
                       api/pollTask ─→ relayProxy.relayAttachUntilDone（恢复/防丢）
   回填 node.data ◄── hooks/useNodeGeneration ◄── store/taskStore
   结果 URL 解析：utils/resultUrlExtractor ◄── hooks/useConnectedInputs
   降级/错误：utils/degrade（useNodeGeneration/kvStore/TextNode）、utils/genErrors
   展示：panels/TaskCenter、panels/GeneratedView
```

关键边（refs 实证）：`relayProxy` ← chatApi/imageApi/videoApi/pollTask；`taskStore` ← pollTask/useNodeGeneration/ImageNode/PromptNode/TaskCenter/LeftPanel；`taskCompletionBus` ← pollTask/taskStore；`resultUrlExtractor` ← useConnectedInputs；`degrade` ← useNodeGeneration/TextNode/kvStore。

## 存储 / 持久化链路

所有状态的落盘/恢复都走唯一入口，再路由到 KV/本地底层，备份与云同步在上层编排。

```
core/contentStore（STORAGE_KEYS 路由，dev 校验裸 key）
   ├→ storage/kvStore · storage/storageAdapter · storage/storageQuota · storage/persistFailureBus
   └→ 上层：store/projectStore · store/backupStore · store/cloudSync
fan-in：几乎全部 store（task/asset/project/backup/cloudSync/skill/appSettings/accounts/agentModel/provider…）
        + canvas/nodePrefs + prompt/* + agent/*
```

关键边（refs 实证）：`contentStore` 被 \~20 处 import（见 base/README §一红线说明，它是横切唯一入口）。

## 资产 / 素材链路

素材库数据 → 类型识别/URL 归一 → 卡片展示 → 拖拽进节点。

```
api/filesApi · api/localToolApi（取数据/上传/刮削）
   └→ store/assetStore ← panels/AssetLibrary · panels/LeftPanel · nodes/ImageNode · scriptbox/StepAssets
        ├→ utils/mediaType（类型判断）· utils/previewUrl（预览）+ utils/imageUrl（URL 归一）
        └→ 展示：panels/MaterialStrip · ui/LazyImage
```

关键边（refs 实证）：`assetStore` ← AssetLibrary/LeftPanel/ImageNode/PromptNode/StepAssets/scriptBoxEngine。

## 画布 / 节点链路

节点注册/默认/编组/派生/历史/懒加载/拓扑触发，是「节点怎么上画布、怎么联动」的骨架。

```
canvas/NodePalette（节点注册表）+ canvas/nodeDefaults + canvas/nodePrefs（← App/各 nodes）
canvas/groupNodes · canvas/deriveNodes · canvas/historyStack · canvas/CanvasEdgesContext
canvas/lazyNode（重节点懒加载）· canvas/upstreamLink（拓扑自动触发）· canvas/toolRegistry（画布 AI 工具）
生成触发入口：hooks/useNodeGeneration
```

关键边（refs 实证）：`nodePrefs` ← App/ImageNode/PromptNode/TextNode/DiscountVideoNode/TemplateNode/useScriptBoxEngine。

## 提示词链路

```
prompt/PromptInput · PromptLibrary · PromptLibraryButton · PromptHub（UI）
prompt/promptManager · prompt/promptHubStore（数据层）
prompt/promptChips · prompt/promptMention（纯函数）
```

关键边（refs 实证）：`promptManager` ← prompt/PromptLibrary。

## 编辑 / 查看链路

```
动作入口：nodes/useImageHoverActions（← nodes/ImageNode · nodes/PromptNode）
编辑器/工具：editors/ImageEditor · editors/InlineImageCropper
            + utils/imageCompress · utils/imageUpscale · utils/faceMosaic
查看器：editors/ImageZoomDialog · editors/PanoViewer · ui/VideoThumbnail·ui/LazyImage
```

## 3D / 深度视频链路

```
director3d/* + director3d/d3dPersistence（工程持久化，回收自 base）
depthVideo/engine · loader · depthUrls · spawn · DepthVideoModal
editors/cameraStudio · CameraStudioPanel · PanoViewer
```

***

## localTool 后端（服务端 `localTool/`）职责与数据流

前端（base/core/api）只是薄壳，真正的协议执行/落盘/任务常驻在 localTool 服务端（`:18080`），再经网关（`:9004`）到上游（Lovart 需 VPN）。前端 `contracts.ts apiRegistry` ↔ 后端 `router.ts` 双向互检（`check:api`）。

**文件分层**

- 入口/路由：`src/index.ts`、`src/router.ts`、`src/routes/*`（HTTP 端点层）

- 生成引擎：`src/generateEngine.ts`(relayGenerate/relayChat/relayChatStream)

- 异步任务句柄：`src/relay-poll.ts`（attach + 落库 + 重启恢复；red line：chat 绝不进 poller）

- provider 框架：`src/ai-relay/`（protocol/engine 协议注入、generate.ts 各模态能力、providerCatalog/baseUrl/Endpoints、manifests 模型目录）

- 配置/路径：`src/providerConfigStore.ts`(每平台一 JSON)、`src/paths.ts`(文件路径单源)、`src/version.ts`

- 持久化：`src/db/database.ts`(tasks)、`src/utils/fileStore.ts` + `/files/` 落盘、`routes/kv.ts`

**生成数据流（服务端）**

```
前端 base/api/relayProxy ─→ POST :18080 /api/generate
   → routes/generate.ts（capability 分流，端点无 fetch/落盘，只透传）
       ├─ chat：generateEngine.relayChatStream(SSE 打字机) / relayChat（同步）
       └─ image/video：relay-poll 注册句柄（submit 即返 taskId，GET attach 收结果）
   → generateEngine → ai-relay/（protocol kit + providerCatalog + generate.ts 能力）
   → 出站：厂商直连 / 网关 :9004 → Lovart（需 VPN）
   → 结果：saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端
```

> 后端改名记录（2026-09-04）：`relay.ts`→`generateEngine.ts`(生成引擎，与 ai-relay 框架/relay-poll 区分)、`providerConfig.ts`→`providerConfigStore.ts`(用户配置存储，与 ai-relay/providerCatalog 内置目录区分)、`ai-relay/generate/index.ts`→`ai-relay/generate.ts`(摊平单文件目录)。

***

## 怎么用

- 想 trace「一条链路从哪来、走哪、落哪」→ 本文件

- 想确认「某文件实际被谁 import / 依赖谁」→ `node scripts/mv-sync-refs.mjs refs <file>`

- 想改某个域的行为（生成/存储/资产/画布/提示词/编辑/3D）→ 按本索引该链路的文件清单逐个看文件头注释再动

