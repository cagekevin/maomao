# spec/DATAFLOW\.md · 数据流链路索引

> **目的**：让 AI 能**在一处读完一整条数据流链路**，不必在 core/api/store/utils/nodes/panels/hooks 之间乱猜、乱跳。
> **依据**：每条链路的「边」由 `scripts/mv-sync-refs.mjs refs <file>` 机械实证（2026-09-04），非凭文件名猜测。
> **物理归属**见 `src/components/base/README.md`；本文件只画链路与流向，**不决定文件位置**。查「文件实际被谁 import / 实际在哪」→ 跑 `refs <file>`。
> **省消耗铁律**：改某条链路时，照本文件该链路的文件清单走 + 读对应文件头注释即可，**不需要**为搞清楚「这条链路在哪几个文件」启动子代理全库乱搜——这张图就是答案。真拿不准单文件归属时才跑 `refs` 一锤定音。
> **审计灯图例**（2026-09-13 立）：🟢 已审·无债 · 🟡 已审·持平待裁定 · 🔴 有债待还 · ⚪ 未审。
> 灯只标在**链路 / 文件节点旁**（一个节点一盏），**禁止在本文件写债明细 / 日期 / 说明**（会臃肿）；真源 = `daily/架构日志/<NN>-<区域>-<日期>.md` 的**覆盖度表**，本文件只放灯的投影，冲突以覆盖度表为准。
> 灯的读/写流程见 `/.codebuddy/commands/债务登记5步法.md`（Step 1 读灯定位、Step 5 定点改灯）。

***

## 生成链路（意图 → 出站 → 任务 → 结果 → 回填）★主链路

数据从画布节点发起，经统一生成入口，结果以「任务中心」为权威源回填节点。**结果权威源 = 任务中心，node.data 是渲染缓存副本**（红线，见 CONTEXT §五）。
> 更新(2026-09-05, refs 实证)：下述结构为 2026-09-04 L3 收口后现状。`genIntent.ts` 已零引用退役；`chatApi/imageApi/videoApi` 三门面已并入单文件 `api/generate.ts`（内部 generate() + 具名导出）——**不再存在**，勿回找。画布节点实际入口为上层 hook `useGenerateNode`（它委托 `useNodeGeneration`）；另有**第二生成入口** `scriptbox/scriptBoxEngine.ts` 不经过 useGenerateNode、直接消费 generate 门面 + 自拼 reportGenerate 契约（旧版文档只画了一条节点链，漏此支线）。

```
─ 画布节点生成（主范式：经 useGenerateNode 委托契约）
nodes/{ImageGenerate,TextGenerate,VideoGenerate}（原 PromptNode/TextNode/DiscountVideoNode 已改名）
  → hooks/useGenerateNode         (provider/模型管理 + useSyncNodeData + 委托 useNodeGeneration)
      → hooks/useNodeGeneration   (统一契约：reportGenerate→progress→run→成败→retry + 落盘 + node.data 回填)
          → base/api/generate.ts   (单门面：generateImage / generateVideo / chatCompletions / chatStream)
              → base/api/relayProxy.ts (relaySubmit / relayAttachUntilDone / relayChat / relayChatStream)
                  → POST :18080 /api/generate（chat→同步快路径 / image/video→relay-poll 异步句柄）
  → store/taskStore.reportGenerate / progress / done / fail    （任务中心权威源）
  → 落盘唯一出口 filesApi.saveResultToTasks（节点侧 useNodeGeneration + 剧本盒 scriptBoxEngine 各 1 处调用，杜绝双落盘）
  → 刷新恢复 base/api/pollTask.ts ─→ 复用 relayProxy.relayAttachUntilDone（只 attach 不 cancel）
      → taskStore.patchTask + taskCompletionBus.publishTaskCompleted（唯一发布入口）
          → 广播 agent:task-completed → useNodeGeneration 精准回填 node.data（detail.nodeId===本节点）
   回填 node.data ◄── hooks/useNodeGeneration ◄── taskCompletionBus 广播

─ 剧本盒子生成（第二入口：不经过 useGenerateNode，直接消费 generate 门面）
scriptbox/scriptBoxEngine.ts（ScriptBoxNode 挂载）
  ① asset 生图（generateImage）→ 走 store/taskStore.reportGenerate（每张 asset 用独立伪 nodeId
     `nodeId-asset-<id>` 对齐节点契约，防批量互顶）→ 回填节点 data.assets[].imageUrl
     → 生成后本地化落盘 resourceStore.localizeAndStoreToResourceLibrary（migrated/ 目录）+ saveResultToTasks 副本
     → 注：不接 useNodeGeneration 的 retry 注册（任务中心「再来一次」入口已于 2026-09-12 删除）
  ② 文本类 chatCompletions（写剧本/生图提示词/审计/合并视频提示词）→ 直接回填画布节点 data
     （写剧本 / data.shots[].prompt 等），**不经过任务中心 reportGenerate**

─ 其它直接消费 generate 门面（非「节点生成→任务中心回填」范式，仅供 trace chat 链路）
  agent/runtime/agentRuntime.ts  → chatStream（AI 助手 SSE 对话，未消费 body 原样返回给 agent）
  agent/runtime/contextCompression.ts → chatCompletions（上下文压缩，会话级，不经任务中心）
  下游取上游 URL：utils/mediaType（判型）◄── hooks/useConnectedInputs；结果 URL 由 localTool 后端落盘 /files/ 直返 / `t.data[0].url` 契约直读，无独立提取器（resultUrlExtractor 已删，见更新注）
    更新(2026-09-11, refs实证): 原「utils/resultUrlExtractor ◄── useConnectedInputs」已删——该模块 0 生产引用，判型已收口 mediaType.ts，rendering URL 走后端 /files/ 直返契约。useConnectedInputs 实际 import mediaType.resolveMediaType。
  错误分类：utils/genErrors.classifyError（判定 abort/timeout/network/http/business）
  展示：panels/TaskCenter、panels/GeneratedView
```

关键边（refs 实证 2026-09-05）：`relayProxy` ← generate.ts / pollTask.ts（无节点/agent/scriptBox 直连，门面收口）；`generate.ts` 直接消费方 = 4 生成节点（经 useGenerateNode）+ scriptBoxEngine + agentRuntime + contextCompression（见上）；`taskCompletionBus` ← pollTask.ts / taskStore.ts（均发布方）；`useNodeGeneration` ← useGenerateNode + 节点测试；`degrade` ← useNodeGeneration/TextNode/conversationState/contentStore（kvStore 折叠后已不再消费 degrade）。

## AI 助手（Agent）链路 ★会话/工具/表格子系统

> 更新(2026-09-11, refs 实证)：**新增本段**。此前 AI 助手仅在上方生成链路段以两行脚注出现（`agentRuntime → chatStream` / `contextCompression → chatCompletions`，**均仍真，未删**），但缺整个会话状态层 / 工具层 / 表格子系统的数据流描述，此处补齐。审计视角见 `daily/架构日志/11-AI助手-2026-09-11.md`。

**A0 · 会话数据（SSOT 唯一可写源）**
```
panels/AgentPanel.tsx（1899 行，UI 壳，0 模块 import 的叶节点）
  ⇅ agent/index.ts（聚合 re-export 单一入口）
agent/runtime/useAgentChat.ts（唯一发送入口，1103 行）
  ⇅ agent/conversation/conversationStore.ts（聚合 re-export，18 处 import）
      └→ conversationState（底座：states[agentKey] + commit 唯一写漏斗 + 归一 + KV 水化）
          ├→ conversationSnapshot（D：快照/workflow/pending/memory）
          ├→ conversationAiState（F：global_contract/artifacts/undo/refImages + 表格 tabs）
          ├→ conversationSkillState（Skill 三阶段 + creditGate）
          └→ conversationImageMap（E：跨轮图「图N」编号）

落盘：contentSet(convKey) / contentSetAsync（KV 键 agent_conversations_<agentKey>）
      落盘前 → validateConversationState（dev 下 error 级 warn）
读入口：useConversationStore / useStoreSelector（禁止裸 normalizeConversation 当读时复制）
```

**A1 · 发送 → 工具循环（唯一 LLM 出站）**
```
useAgentChat.send(text, attachments)
  → inputStateMachine（idle/planning/running/steer/retry 按钮语义；与 store.sending 分工）
  → agentMessages（appendMsg/setHistory/updateLastStreaming/endStreaming，消息写唯一入口）
  → agentAttachments（normalizeAttachmentsForSend / buildRefCatalog 参考图编号）
  → agentCore.buildRequestMessages(…, historyTurns, projectMemoryContext, mode)（纯函数组装，fresh-task）
      + memoryRetrieval.buildProjectMemoryContextFromStore（长期记忆 MMR 排序注入）
      + tokenBudget.decideContextCompression / contextCompression.compressToSummary（预算→摘要）
  → agentRuntime.roundTrip → 前端门面 base/api/generate.ts chatStream → POST :18080 /api/generate
  → agentRuntime.runToolCalls(await callTool) → canvas/useCanvasAgentTools（工具注册表，1817 行）
      → canvas/canvasHost（画布写操作唯一入口，禁裸 useReactFlow）
      → canvas/canvasPlanExecutor（Wave1 并行 + Wave2 依赖）
      → conversation/*（状态回写）+ taskStore/assetStore（生成落点）
  → workflowState（wfStart/wfSteer/wfFinish/wfAwaitConfirm/wfNextSteer 纯函数）
```

**A2 · 表格协作（第二入口：左表右对话）**
```
panels/TableWorkspacePanel.tsx ⇄ assistantTable/AssistantTablePanel.tsx
  ⇅ assistantTable/tableWorkspaceState（运行态枢纽：open/width/selectedRowIds/preview/选区，不落盘）
      → buildPreviewResult（assistantTable.ts，预览=确认唯一推导，C5）
      → conversationStore.setCurrentAssistantTabs（写回 memory.assistantTables，写前 validateTabs）
  AgentPanel.handleSend → buildTableSnapshotText + buildRefineRowsUser（表格现状注入，mode='table'）
```

**A3 · 长期记忆（独立真源，跨域经桥接）**
```
memory_suggest 工具 → conversationSkillState.setActivePendingMemorySuggest（暂存 + awaiting 门禁）
  → UI 确认 → useAgentChat.confirmPendingMemorySuggest → runtime/projectMemoryStore.saveProjectMemory
      → KV 键 agent_project_memory_v1_<agentKey>（按 agentKey 全局，不分项目；写入前 sanitizeMemoryContent）
  → 下轮注入：memoryRetrieval.buildProjectMemoryContextFromStore → buildRequestMessages
（⚠️ 长期记忆 ≠ 对话 memory；桥接只经 pendingMemorySuggest，禁止直写）
```

> 关键边（refs 实证 2026-09-11）：`conversationStore` ← 18 处（assistantTable 4 / canvas 2 / runtime 3 / index + 8 测试）；`conversationState` ← 13 处；`useAgentChat` ← 8 处；`projectMemoryStore` ← 5 处；`canvasHost` ← 3 处。**出站唯一**：LLM 一律经 `base/api/generate.ts`（无第二直连）；**画布写唯一**：一律经 `canvasHost`；**消息写唯一**：一律经 `agentMessages`。
> 更新(2026-09-11, refs 实证)：`agent/runtime/runModeRegistry.ts`（三态执行模型注册表）**已整模块删除**（`ls` 实测不存在），执行模型收敛恒 `auto`，全仓 `runMode|workMode` 仅剩 6 条历史注释（属留痕，禁因注释恢复模块）。


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
   └→ 上层：store/projectStore · store/backupStore · store/cloudSync（云同步数据流详见下述独立段）
fan-in（refs 实证 38 处 import）：几乎全部 store（task/asset/project/backup/cloudSync/skill/appSettings/
        accounts/agentModel/provider…）+ canvas/nodePrefs + prompt/* + agent/* + panels/AgentPanel
```

关键边（refs 实证 2026-09-05）：`contentStore` 被 **38 处** import（约 20 个 src 业务模块 + 18 个测试，见 base/README §一红线说明，它是横切唯一入口）；`kvStore` 现仅 3 处引用（storage/index + projectStore/providerStore 测试的 re-export 兼容），src 业务侧无直读。

> 更新(2026-09-11, refs 实证)：① `contentStore` 实证 import 数 **41 处**（原写 38，+3，随 8 月末后新增 store 接入而涨，属健康增长、非泄漏）；② `taskStore` 真实路径为 `src/components/base/store/taskStore.ts`（本文件 line 23/64/65 的 `store/taskStore` 为相对简写，勿回找 `src/store/`）；③ 存储「有意不收口保留裸调」的 2 处例外中，**`d3dPersistence.ts` 例外已失效**——2026-09-11 方案A（TD-7）已把它收编进 `contentStore`（`contentSetKvWithFallback`/`contentGetKvWithFallback`），不再裸调 `kvGet/kvSet/sGet/sSet`；现仅剩 `conversationState.ts`（KV 迁移回读旧 local）1 处例外。

> 更新(2026-09-12, refs 实证, 二轮深扫)：**修正上述「KV 裸 import 仅存在于 contentStore 内部」的表述——不成立**。`grep kvSet|kvGetVersion` 实测另有 2 处业务侧直调 transport：`store/projectStore.ts:458` 的 `kvSet(key, value, {ifVersion})`（画布快照 CAS 写）+ `projectStore.ts:306/308/312`、`hooks/useCanvasSync.ts:82` 的 `kvGetVersion`（版本读/3s 冲突轮询）。即**画布快照「写」绕过 contentStore 唯一入口（读仍走 `contentGetAsync`、删走 `contentDeleteAsync`）**，导致该键的 KV 降级链（写本地副本 + reportDegrade）从未生效，而读端仍会去读一个永远为空的本地副本（半截降级链）。根因：contentStore 缺「CAS 条件写 + 版本读」原语（`writeKvWithFallback` 会把 409 冲突误当引擎不可用降级，语义错）。TD-02-1。`conversationState.ts` 的 1 处裸 `sGet` 例外仍有效（另见区域 02 二轮深扫文件 §一）；`contentStore` import 数 41 复核不变（22 src + 19 tests）。

> 更新(2026-09-12, refs 实证, TD-02-1 已收口)：上述旁路**同日已消除**，现数据流为
> `projectStore`（CAS 基线/单飞/冲突提示，L3 编排）→ `contentStore` 严格族 `contentKvGetVersion` / `contentKvSetCas`（L2：失败分类 + 不降级）→ `localToolApi.kv*`（L1）；`useCanvasSync` 版本轮询同经 `contentKvGetVersion`。
> `contentStore` 现分两族：**尽力而为族** `contentSet/Get/Delete(+Async)`（配置类，引擎不可用才降级本地副本）与**严格族** `contentKvGetVersion/contentKvSetCas`（用户主数据，fail-closed 绝不写副本）；两族共用「失败分类唯一实现 `isEngineUnavailable`（4xx=请求被拒→上抛 / 其余=引擎不可用→降级）」。**真分叉在失败语义，不在后端。** 防回潮：`check:arch` 规则 6（禁绕过 contentStore 直调 kv\*/s\* 底层，白名单 4 类）。

> 更新(2026-09-12, refs 实证, 三轮)：① **就绪度链路（TD-02-2）**：`storageAdapter.isStorageReady()` / `onStorageReady(cb)` 为 L1 新增就绪度原语（非插件环境恒就绪）；`contentStore.loadFromLocal` 未就绪时**返回 undefined 且不写缓存**（杜绝「未加载＝不存在」的粘性假真相）；`projectStore`/`resourceStore`/`appSettings` 三个模块级 eager 读改为「未就绪不回写种子 + 就绪后重读一次」。② **快照 schema 真源（TD-02-7 第一步）**：`base/canvas/canvasSnapshotSchema.ts`（`NODE_KEEP`/`EDGE_KEEP` + `sanitizeSnapshotNodes/Edges`）成为「画布快照保留哪些字段」的唯一物理位置，`projectStore` 只消费；原白名单及其「为什么必须保留 parentId/extent/style/initialWidth/initialHeight」的决策理由一并迁入该模块（projectStore 留指针）。③ 对账工具 `scripts/check-node-data.mjs` 修复三处静默失效（类型标注打断「名 = [」、类型注解里的 `[]` 被 `indexOf` 抢先命中、抹白把字符串字面量抹空导致取不到 `type`）并新增**解析器自检**（任一解析源为空 → 告警且 `--strict` exit 1），`check:node-data --strict` 由「假绿」恢复为可信门禁。

## 云同步（Cloud）链路

> 更新(2026-09-11, refs 实证)：新增本段。原「存储/持久化」段把 `cloudSync` 列为 contentStore 上层消费者（仍真，未删），但缺独立数据流描述，此处补齐。
> 收敛现状（2026-09-11 审计）：`cloudSync` 是**编排层**，不持有真相（真相在各域 store / contentStore）。
> - [F-云B] `projects` 已入 `SYNC_EXCLUDE`（源头既不传也不收）；删 `restoreLocal` 内 `saveProjects(ls.projects)` 死路径 + `getCurrentProjectId` + `project` 领域开关。projects 跨端真通道仅剩 `projectStore` → localTool `/api/projects` backend + KV 画布快照。
> - [F-云A] `collectLocalData`→`{ls, skipped}`、`restoreLocal`→`{written, failed}`，失败域结构化上抛；`uploadConfig`/`downloadConfig` 不再以 `ok:true` 掩盖（部分失败带 `partial`，全失败 `ok:false`）。
> - [F-云C] `CloudSyncEngine.callGateway` 抛错保留原错误类型/`cause`，不再压平成 message 字符串。

```
主文件：src/components/base/store/cloudSync.ts（CloudSyncEngine 引擎 + uploadConfig/downloadConfig + normalizeCloudPayload / diffWithLocal / decideUpload 纯函数）
fan-in（refs 实证 4 处 import）：App.tsx（手动按钮 handlePushToCloud/handlePullFromCloud）
                                  · autoSync.ts（45min 定时调度，失败全静默→[F-云A]后已告警）
                                  · tests/unit/cloudSync.test.ts · tests/unit/autoSync.test.ts（隔离 mock）

源 collectLocalData() → { ls, skipped }
  ├─ LS_KEYS = getLocalKeys() − SYNC_EXCLUDE → contentStore 读 localStorage 全量用户键（再按 domainSwitchEnabled 过滤）
  ├─ providerApi.getProviders()             → localTool /api/providers（网络，key 已脱敏）
  └─ contentGetAsync('yimao_accounts')       → KV（backend:'kv'，网络）
  → contentFingerprint(ls) 算本地指纹
传输 CloudSyncEngine.callGateway('push_data' / 'pull_data') → GAS（CLOUD_SYNC_GAS_URL，config.ts 配置，第三方黑盒，无鉴权/加密）
汇 downloadConfig → normalizeCloudPayload → diffWithLocal → restoreLocal() → { written, failed }
  ├─ LS_KEYS + domainSwitchEnabled → writeLS（contentStore）
  ├─ providerApi.saveProviders()            → localTool backend
  └─ contentSetAsync('yimao_accounts')      → KV
冲突判定 decideUpload（rev 单调 + 内容指纹，纯函数）；台账 writeLedger
消费者：App.tsx（手动）/ autoSync.ts（自动 45min）
```

关键边（refs 实证 2026-09-11）：`cloudSync` ← App.tsx（手动）+ autoSync.ts（自动），无其它生产代码隐式依赖；`projects` 已不进云同步清单（SYNC_EXCLUDE），其跨端真通道见「存储/持久化」段 projectStore 行 + `localTool /api/projects`。

## 资产 / 素材链路

素材/文件落盘与引用（落盘唯一域 = filesApi；素材库 SSOT = resourceStore，主审区域 12）。

```
api/filesApi（全站文件域单点：upload[FormData/JSON 双模式] / move[context-only] / mkdir / open / open-dir + 3 纯函数）
   ├→ store/resourceStore（素材库 SSOT：saveInlineToLocal/uploadFileToLocal/EXT_BY_TYPE —— 主审见区域 12）
   ├→ panels/ResourceLibrary · panels/GeneratedView（openLocalFolder/openFileDir/relativePathFromUrl/createFolder）
   ├→ hooks/useAssetDropPaste（resolveNodeAssetUrl/downloadRemoteToLocal/WEB_DROP_SUBFOLDER）
   ├→ nodes/ImageBoxNode（resolveNodeAssetUrl）· nodes/useImageHoverActions（showThenPersistInline）
   ├→ scriptbox/scriptBoxEngine（uploadFileToLocal/saveResultToTasks）· hooks/useNodeGeneration（saveResultToTasks）
   ├→ depthVideo/DepthVideoModal · utils/videoEngine（uploadFileToLocal → videoProcess 桶）· director3d/d3dPersistence（saveInlineToLocal）
   └→ 地基：utils/uploadDirs（subfolder 中央表）· utils/mediaType（判型）· utils/previewUrl · utils/imageUrl（URL 归一）
```

关键边（refs 实证 2026-09-12）：`filesApi` 模块引用 32（resourceStore/ResourceLibrary/GeneratedView/OverlayEditor/DepthVideoModal/videoEngine/d3dPersistence/ImageBoxNode/useImageHoverActions + api barrel + 21 测试）；后端唯一落盘端点 = `POST /api/files/upload`（multipart `filename` 字段优先于 part 名；contentId=sha1(字节) 全局查重）。

> 更新(2026-09-12, refs 实证, 区域 03 二轮)：资产段整体刷新。① `store/assetStore` 已删除（全仓 0 文件 0 import），素材库域由 `resourceStore` 承接（区域 12 主审）——旧链路 `store/assetStore ← AssetLibrary/LeftPanel/ImageNode/PromptNode/StepAssets` 已删；② 旧展示实体更名：`panels/AssetLibrary`→`ResourceLibrary`、`panels/MaterialStrip`→`ResourceStrip`、`nodes/ImageNode`→`ImageGenerate`（展示层不逐一点名，见区域 12 续审）；③ `api/localToolApi` 候选 C 后已无文件域成员（仅余迁移注释），文件域唯一单点 = `filesApi`；④ 生成链路段「saveResultToTasks（useNodeGeneration 单点调）」更正——scriptBoxEngine:578 为第二调用方（同一唯一出口，双落盘防线不变）。

## 画布 / 节点链路

节点注册/默认/编组/派生/历史/懒加载/拓扑触发，是「节点怎么上画布、怎么联动」的骨架。

```
canvas/NodePalette（**纯 UI 目录**：type/label/icon/cat/component，buildNodeTypeComponents 单源派生 nodeTypes）+ canvas/nodeDataSchema（**新建 data 初值真源** NODE_DATA_DEFAULTS + defaultNodeData；2026-09-12 自 NodePalette.data 迁出）+ canvas/nodeDefaults（**结构默认**单源 + INPUT_PANEL_NODE_TYPES）+ canvas/canvasSnapshotSchema（**落盘保留白名单** NODE_KEEP/EDGE_KEEP）+ canvas/nodePrefs（参数记忆，KV yimao_node_prefs）
canvas/groupNodes（编组/拖拽落组/级联删/克隆）· canvas/deriveNodes（建子节点+连线原子快照 spawnAndCommit）· canvas/historyStack（撤销纯类）· canvas/CanvasEdgesContext（history 注入通道）
canvas/lazyNode（重节点懒加载 + 端口占位契约）· canvas/upstreamLink（拓扑自动触发）· canvas/toolRegistry（画布 AI 工具）
canvas/canvasContextMenu（右键三态纯配置）· canvas/ArrangeConfirm（整理确认 UI）· canvas/lod（LOD 性能降级）· canvas/useCanvasEventSubscriptions（3 全局订阅收拢）
生成触发入口：hooks/useGenerateNode（节点编排 start/模型，委托 hooks/useNodeGeneration，见上方「生成链路」）
```

> 更新(2026-09-11, refs 实证)：画布段刷新。① 修正 `nodePrefs` 消费方——真实 fan-in = `App` + `AssetNode`/`ImageGenerate`/`TemplateNode`/`TextGenerate`/`VideoGenerate` + `useScriptBoxEngine`（原写的 `ImageNode`/`PromptNode`/`DiscountVideoNode` **实际 0 import**，已删旧链路）。② 补漏 fan-in：`CanvasEdgesContext` ← `App` + 8 节点（AssetNode/Director3DNode/GridMerge/GridSplit/Loop/Panorama/TextGenerate/VideoGenerate/VideoProcess）；`deriveNodes` ← 8 节点 + `depthVideo/spawn.ts`。③ 端口契约（target/source handle）**已收口为单一真源 `contracts.NODE_HANDLE_CONTRACT`**（2026-09-11 TD-04-1）：节点文件 `NodeShell` prop 声明端口、该表集中登记、`App.tsx` 补边与 `lazyNode` 占位骨架均从它派生；一致性由 `scripts/check-node-handles.mjs`（挂 prebuild/pretest + check:health）对账「节点声明 ⊆ 契约表」，漏登记即红。
　　关键边（refs 实证）：`nodePrefs` ← App/AssetNode/ImageGenerate/TextGenerate/VideoGenerate/useScriptBoxEngine（TemplateNode 蓝本亦用 useNodePrefs，但已迁 `nodes/_template/`，非活节点、不占 registry，见 TD-04-5）。

> 更新(2026-09-11, refs 实证, 三轮底层)：① `TemplateNode` 已迁 `src/components/nodes/_template/` 并从 NODE_TYPES/nodePrefs/INPUT_PANEL/NODE_OUTPUTS 摘除（参考蓝本非活节点，TD-04-5）。② 删死事件 `yimao:remove-edge`（App window 监听 + EVENTS 登记，0 发布方；CustomEdge 删边实走 deleteElements→onDelete，TD-04-8）。③ 画布节点生成入口名义已更新为 ImageGenerate/TextGenerate/VideoGenerate（原 PromptNode/TextNode/DiscountVideoNode 为旧名）。④ node.data 写回唯一入口 = `useNodeData.patchNodeDataById`；节点 id 唯一入口 = `idGen.generateId`；端口真源 = `contracts.NODE_HANDLE_CONTRACT`。
　　端口契约消费（refs 实证）：`NODE_HANDLE_CONTRACT` ← `App.tsx`（补存量坏边 handle + addNode connection 路径）+ `lazyNode.tsx`（chunk 未到达的占位骨架端口）。

> 更新(2026-09-12, refs 实证, 九轮)：group 显示名唯一字段 = `data.label`（建组源头 `groupNodes.createGroupFromNodes` + 加载迁移 `nodeDefaults.applyNodeTypeDefaults` 双向收敛；旧 `data.name` 在加载时迁移进 label 并清除，不再保留）。整理 `useArrangeCanvas` 对 group 尺寸写回补 `width/height`（与 `style` 同写，对齐 `useNodeResize` 的「width+height+style 三写」不变量，TD-04-16/19）。

> 更新(2026-09-12, refs 实证, 十一轮)：补「素材/文本/图片/节点组**上画布**」入口链路——统一收口在 `hooks/useAssetDropPaste.ts`（`App.tsx` 经 `onDragOver`/`onDrop`/`onPaste` + `useGlobalPaste`（window paste）挂载；`createNodeFromFile` 供右键「上传」复用），**全部经注入的 `App.addNode`（结构默认 + history）建节点，无旁路**（6+ 条路径皆 addNode 调用点，非独立实现）。

> 更新(2026-09-12, refs 实证, 四轮)：画布「数据契约」拆成三张**职责单一**的表，别再混：① `NodePalette` = **纯 UI 目录**（type/label/icon/cat/component/badge；`data` 字段已移出）；② `nodeDataSchema.NODE_DATA_DEFAULTS` = **新建 data 初值唯一真源**（+ `defaultNodeData(type)` 注入 `expanded`，值深拷贝）；③ `nodeDefaults.NODE_TYPE_DEFAULTS` = **结构默认**（新建与快照还原**都**补）。落盘保留白名单见 `canvasSnapshotSchema`（三轮）。`interface XxxData` 与 `NODE_OUTPUTS` **不派生自** data 表（丢类型/关注点不同），由 `npm run check:node-data --strict` 机器对账。

> 更新(2026-09-12, 六轮低息清偿)：① **KV 删除语义** = 键与版本同删（后端 `handleKvDelete` 删 `<key>` + `<key>_version`；`projectStore.deleteProject` 不再手工补删，删除后重建不带旧 CAS 基线）。② **`yimao_node_prefs` 写语义** = 「以存储最新为基准合并 patch」（`mergeNodePrefs`），且**defaults 不落盘**（只存用户改过的字段；defaults 由 `getNodePrefs`/`injectNodePrefs` 读取时补）。③ `director3d` 跨窗口广播通道（`d3dPersistence` BroadcastChannel）**已真正建立**（原恒真守卫使提示静默失效）——同 key 被其他窗口更晚保存时，保存前一次红色 toast + 日志（同 tab 按 tabId 忽略）。④ `backupStore` 的「当前项目」改委托 `projectStore.getCurrentProject()`（内存真相，不再从存储重推导）。

> 更新(2026-09-12, refs 实证, 五轮)：**上游产出（读侧）拆三张表 + 特判集**（TD-02-11，`hooks/useConnectedInputs.ts`）：① `SINGLE_OUTPUT_FIELDS`（单 URL 产出，**字段名由写侧显式声明**：assetNode/imageGenerateNode→`assetUrl`、videoGenerateNode→`videoUrl`、panoramaNode/director3dNode→`assetUrl`）；② `NODE_OUTPUTS`（复合产出：scriptBoxNode 多端口 / imageBoxNode 多图 / videoExtract·gridSplit·gridMerge 的 `extractedImages[]` 归一）；③ `NO_OUTPUT_NODE_TYPES`（group / ghostTarget / faceMosaicNode / loopNode / videoProcessNode —— 无自有产出，结果经 spawn 子节点交付）；④ `SPECIAL_OUTPUT_TYPES`（textGenerateNode 读 node.id 特判）。`getNodeOutput` 调度序 = 无产出 → 单 URL → 复合 → 特判 → **安全网**；`genericOutput`（`assetUrl>videoUrl>resultUrl` 三字段猜测）**降级为只服务未登记类型（存量退役节点快照）的安全网**，不再承担任何契约。覆盖性 = `uncoveredOutputNodeTypes()`（导出纯函数 + 单测 + dev 告警）；`check-node-data.mjs` 的读侧字段解析随之改指向 `SINGLE_OUTPUT_FIELDS`。

## 提示词链路

```
prompt/PromptInput · PromptLibrary · PromptLibraryButton · PromptHub（UI）
prompt/promptManager · prompt/promptHubStore（数据层）
prompt/promptChips · prompt/promptMention（纯函数）
```

关键边（refs 实证）：`promptManager` ← prompt/PromptLibrary。

## 编辑 / 查看链路

```
动作入口：nodes/useImageHoverActions（← nodes/AssetNode · nodes/ImageGenerate）
编辑器/工具：editors/ImageEditor · editors/InlineImageCropper · editors/FaceMosaicEditor · editors/OverlayEditor
            + utils/imageCompress · utils/imageUpscale · utils/faceMosaic · utils/previewUrl（预览 URL 生命周期唯一出口）
查看器：editors/ImageZoomDialog（11 消费方，命令式 showModal）· editors/PanoViewer（← PanoramaNode）· ui/VideoThumbnail·ui/LazyImage
摄影参数：editors/cameraParams/*（← ImageGenerate；与 3D 摄影棚 editors/cameraStudio.ts·CameraStudioPanel 是【两套独立功能】，后者见 3D 段）
产出落盘：编辑器结果统一经 filesApi.showThenPersistInline（唯一「图像入节点落盘」出口）→ 写回节点
```

> 更新(2026-09-12, refs实证/区域06首轮): 补 `FaceMosaicEditor`/`OverlayEditor`/`cameraParams/*`/`previewUrl` 四边（原段漏列）；标注 cameraParams 与 cameraStudio 为两套独立功能（勿混用）；标注编辑器结果唯一落盘出口 `showThenPersistInline`（合成节点 GridMergeNode 尚未纳入，见 TD-06-6）。

## 3D / 深度视频链路

```
入区边（唯一宿主）：nodes/Director3DNode ──→ director3d/Director3DOverlay.tsx
  （storageKey = `director3d-project-${nodeId}`；capture 拦指针/滚轮 + `#root pointer-events:none`；出区契约 onExport/onExit/onThumbnail）
   └→ App.tsx（Director3DApp，唯一 export，编排全部状态）
        ├→ Viewport.tsx（Canvas/useFrame）─ models.tsx · primitives.tsx · SceneGizmo.tsx · depth.tsx
        ├→ panels/*（9 文件，单向 fan-in 进 App：Inspector·Timeline·Sidebar→ShotsPanel·GlobalSettingsPanel
        │            ·AssetMenu·CameraAnglePanel·ReferenceOverlay·controls）
        ├→ project.ts（领域真源：常量/归一化/插值 cameraAtFrame/序列化/路径/宽高比）+ tracks.ts · history.ts
        ├→ rig.ts（骨架/关节定义单源）
        ├→ log.ts（console 日志，⚠ 未接 base/core/logger 的 /api/logs，见 TD-07-1）
        └→ storage.ts ─ d3dPersistence.ts（工程持久化，回收自 base；contentStore KV + localStorage 回退 + BroadcastChannel）

深度视频（两宿主共用一个 spawn，防漂移）：
  nodes/AssetNode · nodes/VideoGenerate ──→ depthVideo/DepthVideoModal.tsx ─→ depthVideo/spawn.ts（唯一派生出口）
  DepthVideoModal ← RUNTIME_MODELS = depthVideo/depthUrls.ts（运行时资源 URL 单源）
                    · engine.ts（纯逻辑） · loader.ts（运行时装载）

3D 摄影棚（实体在 base/editors/）：editors/cameraStudio.ts · CameraStudioPanel（← nodes/AssetNode · nodes/ImageGenerate）
  ※ editors/PanoViewer 属 2D 全景查看器（← nodes/PanoramaNode），归「编辑/查看链路」，不在本段
```

> 更新(2026-09-12, refs实证/区域07首轮): 原段仅列 3 个文件名、无边，本轮补关键边并更正归属——① 入区边唯一：`nodes/Director3DNode`──→`Director3DOverlay.tsx`（`storageKey=director3d-project-${nodeId}`，出区契约三回调）──→`App.tsx`（唯一 export）；② `App`→`Viewport`（消费 `models/primitives/SceneGizmo/depth`）+ `panels/*` 9 文件单向汇入 + `project.ts`(20 fan-in)/`tracks.ts`/`history.ts` + `rig.ts` 地基；③ 工程持久化 `storage.ts`→`d3dPersistence.ts`（contentStore KV + localStorage 回退 = TD-7 方案A；BroadcastChannel 跨窗口提示 @见 TD-02-3）；④ `depthVideo/*` 两宿主 `nodes/AssetNode`·`nodes/VideoGenerate` 共用 `DepthVideoModal`+`spawnDepthVideoNode`，`RUNTIME_MODELS`(`depthUrls.ts`) 为 URL 单源；⑤ `editors/cameraStudio.ts`·`CameraStudioPanel` 消费方为 `AssetNode`/`ImageGenerate`（@见区域 06）。**更正**：`editors/PanoViewer` 原误列入本段，实为 2D 全景查看器（← `PanoramaNode`），归「编辑/查看链路」。

***

## localTool 后端（服务端 `localTool/`）职责与数据流

前端（base/core/api）只是薄壳，真正的协议执行/落盘/任务常驻在 localTool 服务端（`:18080`），再直连上游（Lovart 需 VPN）。前端 `contracts.ts apiRegistry` ↔ 后端 `router.ts` 双向互检（`check:api`）。
> 更新(2026-09-11, refs 实证)：原「经网关（:9004）到上游」已随 lovart-old 旧轨退役（2026-09-05）删除——localTool 只走直连上游 `lgw.lovart.ai`（relay-poll 常驻轮询 + 落盘 /files/），不再有 9004 网关环节。

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
   → 出站：厂商直连 lgw.lovart.ai（Lovart 需 VPN，经 fetchWithProxy 代理）
   → 结果：saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端
```

> 后端改名记录（2026-09-04）：`relay.ts`→`generateEngine.ts`(生成引擎，与 ai-relay 框架/relay-poll 区分)、`providerConfig.ts`→`providerConfigStore.ts`(用户配置存储，与 ai-relay/providerCatalog 内置目录区分)、`ai-relay/generate/index.ts`→`ai-relay/generate.ts`(摊平单文件目录)。

***

## 怎么用

- 想 trace「一条链路从哪来、走哪、落哪」→ 本文件

- 想确认「某文件实际被谁 import / 依赖谁」→ `node scripts/mv-sync-refs.mjs refs <file>`

- 想改某个域的行为（生成/存储/资产/画布/提示词/编辑/3D）→ 按本索引该链路的文件清单逐个看文件头注释再动

