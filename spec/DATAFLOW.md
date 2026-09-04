# spec/DATAFLOW\.md · 数据流链路索引

> **目的**：让 AI 能**在一处读完一整条数据流链路**，不必在 core/api/store/utils/nodes/panels/hooks 之间乱猜、乱跳。
> **依据**：每条链路的「边」由 `scripts/mv-sync-refs.mjs refs <file>` 机械实证（2026-09-04），非凭文件名猜测。
> **物理归属**见 `src/components/base/README.md`；本文件只画链路与流向，**不决定文件位置**。查「文件实际被谁 import / 实际在哪」→ 跑 `refs <file>`。
> **省消耗铁律**：改某条链路时，照本文件该链路的文件清单走 + 读对应文件头注释即可，**不需要**为搞清楚「这条链路在哪几个文件」启动子代理全库乱搜——这张图就是答案。真拿不准单文件归属时才跑 `refs` 一锤定音。

***

## 生成链路（意图 → 出站 → 任务 → 结果 → 回填）★主链路

数据从画布节点发起，经统一生成入口，结果以「任务中心」为权威源回填节点。**结果权威源 = 任务中心，node.data 是渲染缓存副本**（红线，见 CONTEXT §五）。
> 更新(2026-09-05, refs 实证)：下述结构为 2026-09-04 L3 收口后现状。`genIntent.ts` 已零引用退役；`chatApi/imageApi/videoApi` 三门面已并入单文件 `api/generate.ts`（内部 generate() + 具名导出）——**不再存在**，勿回找。画布节点实际入口为上层 hook `useGenerateNode`（它委托 `useNodeGeneration`）；另有**第二生成入口** `scriptbox/scriptBoxEngine.ts` 不经过 useGenerateNode、直接消费 generate 门面 + 自拼 reportGenerate 契约（旧版文档只画了一条节点链，漏此支线）。

```
─ 画布节点生成（主范式：经 useGenerateNode 委托契约）
nodes/{PromptNode,TextNode,TemplateNode,DiscountVideoNode}
  → hooks/useGenerateNode         (provider/模型管理 + useSyncNodeData + 委托 useNodeGeneration)
      → hooks/useNodeGeneration   (统一契约：reportGenerate→progress→run→成败→retry + 落盘 + node.data 回填)
          → base/api/generate.ts   (单门面：generateImage / generateVideo / chatCompletions / chatStream)
              → base/api/relayProxy.ts (relaySubmit / relayAttachUntilDone / relayChat / relayChatStream)
                  → POST :18080 /api/generate（chat→同步快路径 / image/video→relay-poll 异步句柄）
  → store/taskStore.reportGenerate / progress / done / fail    （任务中心权威源）
  → 落盘唯一出口 filesApi.saveResultToTasks（useNodeGeneration 单点调，杜绝双落盘）
  → 刷新恢复 base/api/pollTask.ts ─→ 复用 relayProxy.relayAttachUntilDone（只 attach 不 cancel）
      → taskStore.patchTask + taskCompletionBus.publishTaskCompleted（唯一发布入口）
          → 广播 agent:task-completed → useNodeGeneration 精准回填 node.data（detail.nodeId===本节点）
   回填 node.data ◄── hooks/useNodeGeneration ◄── taskCompletionBus 广播

─ 剧本盒子生成（第二入口：不经过 useGenerateNode，直接消费 generate 门面）
scriptbox/scriptBoxEngine.ts（ScriptBoxNode 挂载）
  ① asset 生图（generateImage）→ 走 store/taskStore.reportGenerate（每张 asset 用独立伪 nodeId
     `nodeId-asset-<id>` 对齐节点契约，防批量互顶）→ 回填节点 data.assets[].imageUrl
     → 生成后本地化落盘 assetStore.localizeAndStoreToLibrary（migrated/ 目录）+ saveResultToTasks 副本
     → 注：不声明 useNodeGeneration 的 retry 注册
  ② 文本类 chatCompletions（写剧本/生图提示词/审计/合并视频提示词）→ 直接回填画布节点 data
     （写剧本 / data.shots[].prompt 等），**不经过任务中心 reportGenerate**

─ 其它直接消费 generate 门面（非「节点生成→任务中心回填」范式，仅供 trace chat 链路）
  agent/runtime/agentRuntime.ts  → chatStream（AI 助手 SSE 对话，未消费 body 原样返回给 agent）
  agent/runtime/contextCompression.ts → chatCompletions（上下文压缩，会话级，不经任务中心）
  下游取上游 URL：utils/resultUrlExtractor ◄── hooks/useConnectedInputs
  错误分类：utils/genErrors.classifyError（判定 abort/timeout/network/http/business）
  展示：panels/TaskCenter、panels/GeneratedView
```

关键边（refs 实证 2026-09-05）：`relayProxy` ← generate.ts / pollTask.ts（无节点/agent/scriptBox 直连，门面收口）；`generate.ts` 直接消费方 = 4 生成节点（经 useGenerateNode）+ scriptBoxEngine + agentRuntime + contextCompression（见上）；`taskCompletionBus` ← pollTask.ts / taskStore.ts（均发布方）；`useNodeGeneration` ← useGenerateNode + 节点测试；`degrade` ← useNodeGeneration/TextNode/conversationState/contentStore（kvStore 折叠后已不再消费 degrade）。

## 存储 / 持久化链路

所有状态的落盘/恢复都走唯一入口（contentStore），再路由到 KV/本地底层，备份与云同步在上层编排。
> 更新(2026-09-05, refs 实证)：下述为 2026-09-04「存储中间层折叠」(commit 5afe1f3) 后现状。`kvStore.ts` 的
> `storageGet/Set/Delete + isKvKey + tryParse` 已折叠进 `contentStore`（src 侧唯一消费者即它，是纯转发中间层），
> `kvStore.ts` 现为 **re-export 壳**（仅 `CANVAS_STATE_PREFIX` + `kvGet/kvSet/kvDelete` 转发，不再参与读写链路）。
> KV 路由判定唯一收口到 `contentStore.resolveBackend`（三段式：登记键 → pattern → 启发式兜底），
> KV 降级策略（写失败落本地副本 + reportDegrade / 成功清副本）内联为 `writeKvWithFallback`/`readKvWithFallback`/`deleteKvWithFallback`。
> 有意不收口保留裸调 sGet/sSet 的 2 处例外：`conversationState.ts`（KV 迁移回读旧 local）、`d3dPersistence.ts`（KV 主通道+本地副本双通道）。

```
core/contentStore（STORAGE_KEYS 路由 + resolveBackend 唯一判定 + 内联 KV 降级，dev 校验裸 key）
   ├→ storage/storageAdapter（sGet/sSet/sRemove，local/native 落地）
   ├→ api/localToolApi（kvGet/kvSet/kvDelete，KV 云端；不再经 kvStore 中间层）
   ├→ storage/storageQuota · storage/persistFailureBus（旁路工具，不参与读写主链）
   └→ 上层：store/projectStore · store/backupStore · store/cloudSync
fan-in（refs 实证 38 处 import）：几乎全部 store（task/asset/project/backup/cloudSync/skill/appSettings/
        accounts/agentModel/provider…）+ canvas/nodePrefs + prompt/* + agent/* + panels/AgentPanel
```

关键边（refs 实证 2026-09-05）：`contentStore` 被 **38 处** import（约 20 个 src 业务模块 + 18 个测试，见 base/README §一红线说明，它是横切唯一入口）；`kvStore` 现仅 3 处引用（storage/index + projectStore/providerStore 测试的 re-export 兼容），src 业务侧无直读。

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
生成触发入口：hooks/useGenerateNode（节点编排 start/模型，委托 hooks/useNodeGeneration，见上方「生成链路」）
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

