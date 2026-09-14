# spec/DATAFLOW.md · 数据流链路索引

> **目的**：让 AI 能**在一处读完一整条链路**（谁产生 → 经过谁 → 谁消费 → 落哪），不必在 core/api/store/utils/nodes/panels/hooks 之间乱猜。
> **本文件只写「当前真相」**：现状链路图 + 关键边 + 节点旁一盏灯。物理归属见 `src/components/base/README.md`，本文件不决定文件位置。
> **实证**：边由 `node scripts/mv-sync-refs.mjs refs <file>` 机械验证（"关键边"段给出 fan-in 数），不凭文件名猜。
> **省消耗**：改某条链路时，照本文件该链路的文件清单走 + 读文件头注释即可，**不需要**为搞清楚"这条链路在哪几个文件"启动子代理全库乱搜——这张图就是答案。真拿不准单文件归属时才跑 `refs`。
> **历史**：本文件历次修订的**叙事过程**见 `spec/DATAFLOW-HISTORY.md`（只读留痕）；区域审计明细见 `daily/架构日志/<NN>-<区域>-<日期>.md`。

---

## ⛔ 维护规矩（改本文件前必读 · 全文只有这一份）

> 本文件被塞满历史叙事的根因 = **同一批规矩散抄在 6 处**且互相矛盾（此处禁写日期/说明，另外 5 处却要求写 `更新(<日期>…)`）。
> **本段是唯一出口**，其余文件（`架构师心法.md` §七 · `债务登记5步法.md` · `架构师改码7步法.md` Step 7.4 · `daily/架构日志/index.md` · `_template.md`）一律只指向这里，不再各自复述。

**允许写（只有这三样）**：

| 要素 | 形态 |
| --- | --- |
| ① 现状链路图 | 代码块里的 `→` / `├→` 箭头，**只描述此刻的真相** |
| ② 关键边 | 一行，带 `refs` 实证的 fan-in 数（如 `contentStore ← 41 处`） |
| ③ 灯 | 节点旁一个字符（🟢🟡🔴⚪），一个节点一盏 |

**变更时怎么做**：

| 情况 | 动作 |
| --- | --- |
| 链路漂移（新增 / 删除 / 改道） | **就地改**①现状图，让图重新等于现状（**改，不是追加**） |
| 模块退役 / 改名 | 在 §已退役 · 已改名 表里改一行（旧名 → 新名 / 替代者） |
| 灯变了 | 就地改③灯字符（真源 = 区域文件的覆盖度表，冲突以覆盖度表为准） |
| 有理由 / 日期 / TD 号 / 探针 / 测试结果要留 | 写进 `daily/架构日志/<NN>-<区域>-<日期>.md`，**不写在这里** |

**禁写清单**（出现即违规，须当场回退）：

- ❌ `> 更新(<日期>, refs实证): ...` 这类**追加式叙事段**（变更叙事一律归 HISTORY / 区域日志）
- ❌ 日期、TD 编号、`L123` / `:456` 形式的行号、探针结果、测试例数
- ❌ 债明细（归类 / 利息率 / 爆炸半径 / 偿还计划）、裁定过程、方案比较
- ❌ 同一结论在多个段落重复表述（要复用就写指针）

**灯图例**：🟢 已审·无债 · 🟡 已审·持平待裁定 · 🔴 有债待还 · ⚪ 未审
（判据 / 读灯写灯流程见 `.codebuddy/commands/债务登记5步法.md` §数据流覆盖地图；本文件只放灯的投影。）

---

## 一 · 生成链路（意图 → 出站 → 任务 → 结果 → 回填）★主链路

**一句话**：数据从画布节点发起，经统一生成入口，结果以「任务中心」为权威源回填节点。
**红线**：结果权威源 = 任务中心，`node.data` 是渲染缓存副本（见 CONTEXT §五）。

### 现状

```
─ 画布节点生成（主范式：经 useGenerateNode 委托契约）
nodes/{ImageGenerate,TextGenerate,VideoGenerate}
  → hooks/useGenerateNode         (provider/模型管理 + useSyncNodeData + 委托 useNodeGeneration)
      → hooks/useNodeGeneration   (统一契约：reportGenerate→progress→run→成败→retry + 落盘 + node.data 回填)
          → base/api/generate.ts  (单门面：generateImage / generateVideo / chatCompletions / chatStream)
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
  ② 文本类 chatCompletions（写剧本 / 生图提示词 / 审计 / 合并视频提示词）→ 直接回填画布节点 data
     （写剧本 / data.shots[].prompt 等），**不经过任务中心 reportGenerate**

─ 其它直接消费 generate 门面（非「节点生成→任务中心回填」范式，仅供 trace chat 链路）
  agent/runtime/agentRuntime.ts      → chatStream（AI 助手 SSE 对话）
  agent/runtime/contextCompression.ts → chatCompletions（上下文压缩，会话级，不经任务中心）

判型：utils/mediaType.resolveMediaType ◄── hooks/useConnectedInputs
      （结果 URL 由 localTool 后端落盘 /files/ 直返 / `t.data[0].url` 契约直读，无独立提取器）
错误分类：utils/genErrors.classifyError（abort/timeout/network/http/business）
展示：panels/TaskCenter · panels/GeneratedView
```

**当前约束**：任务中心**无「再来一次」入口**（已删）；剧本盒 asset 生图不接 `useNodeGeneration` 的 retry 注册。

### 关键边

`relayProxy` ← `generate.ts` / `pollTask.ts`（无节点/agent/scriptBox 直连，门面收口）；
`generate.ts` 直接消费方 = 4 生成节点（经 `useGenerateNode`）+ `scriptBoxEngine` + `agentRuntime` + `contextCompression`；
`taskCompletionBus` ← `pollTask.ts` / `taskStore.ts`（均发布方）；
`useNodeGeneration` ← `useGenerateNode` + 节点测试；
`degrade` ← `useNodeGeneration` / `TextGenerate` / `conversationState` / `contentStore`。

---

## 二 · AI 助手（Agent）链路 ★会话 / 工具 / 表格子系统

### A0 · 会话数据（SSOT 唯一可写源）

```
panels/AgentPanel.tsx（UI 壳，0 模块 import 的叶节点）
  ⇅ agent/index.ts（聚合 re-export 单一入口）
agent/runtime/useAgentChat.ts（唯一发送入口）
  ⇅ agent/conversation/conversationStore.ts（聚合 re-export）
      └→ conversationState（底座：states[agentKey] + commit 唯一写漏斗 + 归一 + KV 水化）
          ├→ conversationSnapshot（快照/workflow/pending/memory）
          ├→ conversationAiState（global_contract/artifacts/undo/refImages + 表格 tabs）
          ├→ conversationSkillState（Skill 三阶段 + creditGate）
          └→ conversationImageMap（跨轮图「图N」编号）

落盘：contentSet(convKey) / contentSetAsync（KV 键 agent_conversations_<agentKey>）
      落盘前 → validateConversationState（dev 下 error 级 warn）
读入口：useConversationStore / useStoreSelector（禁止裸 normalizeConversation 当读时复制）
```

### A1 · 发送 → 工具循环（唯一 LLM 出站）

```
useAgentChat.send(text, attachments)
  → inputStateMachine（idle/planning/running/steer/retry 按钮语义；与 store.sending 分工）
  → agentMessages（appendMsg/setHistory/updateLastStreaming/endStreaming，消息写唯一入口）
  → agentAttachments（normalizeAttachmentsForSend / buildRefCatalog 参考图编号）
  → agentCore.buildRequestMessages(…, historyTurns, projectMemoryContext, mode)（纯函数组装，fresh-task）
      + memoryRetrieval.buildProjectMemoryContextFromStore（长期记忆 MMR 排序注入）
      + tokenBudget.decideContextCompression / contextCompression.compressToSummary（预算→摘要）
  → agentRuntime.roundTrip → 前端门面 base/api/generate.ts chatStream → POST :18080 /api/generate
  → agentRuntime.runToolCalls(await callTool) → canvas/useCanvasAgentTools（工具注册表）
      → canvas/canvasHost（画布写操作唯一入口，禁裸 useReactFlow）
      → canvas/canvasPlanExecutor（Wave1 并行 + Wave2 依赖）
      → conversation/*（状态回写）+ taskStore（生成落点）
  → workflowState（wfStart/wfSteer/wfFinish/wfAwaitConfirm/wfNextSteer 纯函数）
```

### A2 · 表格协作（第二入口：左表右对话）

```
panels/TableWorkspacePanel.tsx ⇄ assistantTable/AssistantTablePanel.tsx
  ⇅ assistantTable/tableWorkspaceState（运行态枢纽：open/width/selectedRowIds/preview/选区，不落盘）
      → buildPreviewResult（assistantTable.ts，预览=确认唯一推导，C5）
      → conversationStore.setCurrentAssistantTabs（写回 memory.assistantTables，写前 validateTabs）
  AgentPanel.handleSend → buildTableSnapshotText + buildRefineRowsUser（表格现状注入，mode='table'）
```

### A3 · 长期记忆（独立真源，跨域经桥接）

```
memory_suggest 工具 → conversationSkillState.setActivePendingMemorySuggest（暂存 + awaiting 门禁）
  → UI 确认 → useAgentChat.confirmPendingMemorySuggest → runtime/projectMemoryStore.saveProjectMemory
      → KV 键 agent_project_memory_v1_<agentKey>（按 agentKey 全局，不分项目；写入前 sanitizeMemoryContent）
  → 下轮注入：memoryRetrieval.buildProjectMemoryContextFromStore → buildRequestMessages
（⚠️ 长期记忆 ≠ 对话 memory；桥接只经 pendingMemorySuggest，禁止直写）
```

### 关键边

`conversationStore` ← 18 处（assistantTable 4 / canvas 2 / runtime 3 / index + 8 测试）；`conversationState` ← 13 处；
`useAgentChat` ← 8 处；`projectMemoryStore` ← 5 处；`canvasHost` ← 3 处。

**三条"唯一"**：出站唯一（LLM 一律经 `base/api/generate.ts`，无第二直连）· 画布写唯一（一律经 `canvasHost`）· 消息写唯一（一律经 `agentMessages`）。

---

## 三 · 存储 / 持久化链路

**一句话**：所有状态的落盘 / 恢复都走唯一入口 `core/contentStore`，再由它路由到 KV / 本地底层；备份与云同步在上层编排。
**红线**：业务侧禁绕过 `contentStore` 直调 `kv*` / `s*` 底层（`check:arch` 规则 6 拦截，白名单 4 类）。

### 现状

```
core/contentStore 🔴（STORAGE_KEYS 路由 + resolveBackend 唯一判定 + 失败分类 isEngineUnavailable，dev 校验裸 key）
   ├→ storage/storageAdapter（sGet/sSet/sRemove，local/native 落地 + isStorageReady/onStorageReady 就绪度原语）
   ├→ api/localToolApi（kvGet/kvSet/kvDelete，KV 云端；不经 kvStore 中间层）
   ├→ storage/storageQuota · storage/persistFailureBus（旁路工具，不参与读写主链）
   └→ 上层：store/projectStore · store/backupStore · store/cloudSync（云同步见 §四）

两个族（真分叉在失败语义，不在后端）：
  尽力而为族 contentSet/Get/Delete(+Async)  配置类，引擎不可用 → 落本地副本 + reportDegrade（成功清副本）
  严格族     contentKvGetVersion/contentKvSetCas  用户主数据，fail-closed 绝不写副本
  共用失败分类：isEngineUnavailable（4xx = 请求被拒 → 上抛 / 其余 = 引擎不可用 → 降级）

画布快照 CAS 链路：projectStore（CAS 基线 / 单飞 / 冲突提示，L3 编排）
  → contentStore 严格族 → localToolApi.kv*（L1）；useCanvasSync 版本轮询同经 contentKvGetVersion

就绪度：storageAdapter.isStorageReady() / onStorageReady(cb)（非插件环境恒就绪）
  loadFromLocal 未就绪 → 返回 undefined 且不写缓存（杜绝「未加载＝不存在」的粘性假真相）
  projectStore / resourceStore / appSettings 就绪后重读一次

kvStore.ts = re-export 壳（仅 CANVAS_STATE_PREFIX + kvGet/kvSet/kvDelete 转发，不参与读写链路）
唯一例外：conversationState.ts 的 1 处裸 sGet（KV 迁移回读旧 local）
```

**fan-in**：`contentStore` ← **45 处**（src 业务模块 + 测试，`refs` 实测）——几乎全部 store（task/asset/project/backup/cloudSync/skill/appSettings/accounts/agentModel/provider…）+ canvas/nodePrefs + prompt/* + agent/* + panels/AgentPanel。它是横切唯一入口，见 `base/README` §一红线说明。
**防回潮闸**：`check:arch` 规则 6（禁绕过 contentStore 直调底层）· 规则 7（KV 键同步读无守卫）· 规则 9（projects 唯一 module 写点 + 禁外部直读 cache）。

---

## 四 · 云同步（Cloud）链路

**一句话**：`cloudSync` 是**编排层**，不持有真相（真相在各域 store / contentStore）。

### 现状

```
主文件：src/components/base/store/cloudSync.ts
        （CloudSyncEngine 引擎 + uploadConfig/downloadConfig + normalizeCloudPayload / diffWithLocal / decideUpload 纯函数）
fan-in（refs 实证 4 处 import）：App.tsx（手动按钮 handlePushToCloud/handlePullFromCloud）
                                  · autoSync.ts（45min 定时调度，失败告警）
                                  · tests/unit/cloudSync.test.ts · tests/unit/autoSync.test.ts（隔离 mock）

源 collectLocalData() → { ls, skipped }
  ├─ LS_KEYS = getLocalKeys() − SYNC_EXCLUDE → contentStore 读 localStorage 全量用户键（再按 domainSwitchEnabled 过滤）
  ├─ providerApi.getProviders()             → localTool /api/providers（网络，key 已脱敏）
  └─ contentGetAsync('yimao_accounts')       → KV（backend:'kv'，网络）
  → contentFingerprint(ls) 算本地指纹
传输 CloudSyncEngine.callGateway('push_data' / 'pull_data') → GAS（CLOUD_SYNC_GAS_URL，config.ts 配置，第三方黑盒，无鉴权/加密）
汇 downloadConfig → normalizeCloudPayload → diffWithLocal → restoreLocal() → { written, failed }（失败域结构化上抛）
  ├─ LS_KEYS + domainSwitchEnabled → writeLS（contentStore）
  ├─ providerApi.saveProviders()            → localTool backend
  └─ contentSetAsync('yimao_accounts')      → KV
冲突判定 decideUpload（rev 单调 + 内容指纹，纯函数）；台账 writeLedger
消费者：App.tsx（手动）/ autoSync.ts（自动 45min）
```

### 关键边

`cloudSync` ← `App.tsx`（手动）+ `autoSync.ts`（自动），无其它生产代码隐式依赖；
`projects` **不进**云同步清单（`SYNC_EXCLUDE`），其跨端真通道 = `projectStore` → localTool `/api/projects` backend + KV 画布快照。

---

## 五 · 资产 / 素材链路

**一句话**：落盘唯一域 = `filesApi`；素材库 SSOT = `resourceStore`（主审区域 12）。

### 现状

```
api/filesApi 🟢（全站文件域单点：upload[FormData/JSON 双模式] / move[context-only] / mkdir / open / open-dir + 3 纯函数）
   ├→ store/resourceStore 🟢（素材库 SSOT：saveInlineToLocal/uploadFileToLocal/EXT_BY_TYPE）
   ├→ api/localToolApi 🟢（fetchResources?projectId / saveResource / renameResource / deleteResource / rescan）
   ├→ panels/ResourceLibrary 🟢 · panels/GeneratedView 🟢（openLocalFolder/openFileDir/relativePathFromUrl/createFolder；
   │     前者「落盘完成 → 刷新」含同目录重拉，后者订阅 agent:task-completed 重拉生成列表）
   ├→ hooks/useAssetDropPaste · hooks/useResourceMoveToFolder 🟢 · hooks/useAssetDragToCanvas 🟢
   ├→ nodes/ImageBoxNode（resolveNodeAssetUrl）· nodes/useImageHoverActions（showThenPersistInline）· nodes/AssetNode 🟢
   ├→ scriptbox/scriptBoxEngine（uploadFileToLocal/saveResultToTasks）· hooks/useNodeGeneration（saveResultToTasks）
   ├→ depthVideo/DepthVideoModal · utils/videoEngine（uploadFileToLocal → videoProcess 桶）· director3d/d3dPersistence（saveInlineToLocal）
   └→ 地基：utils/uploadDirs 🟢（subfolder 中央表）· utils/mediaType（判型）· utils/previewUrl · utils/imageUrl（URL 归一）

后端落盘 / 资源表（localTool，主审见区域 12 / 08）：
  routes/files.ts 🔴（upload→writeUploadDedup 内容寻址去重 / move→context-only / read·thumbnail·mkdir·open·list）
    → utils/fileStore.ts 🔴（落盘真源：contentHashName(sha1(bytes)) / writeUploadDedup / UPLOAD_ROOT_ALLOW）
  routes/resources.ts 🟢（resources 表：rescan 1:1 映射 / GET ?projectId / rename·move 走 context-only）
    → db/database.ts 🟢（resources 表含 project_id；rescan 行保持 NULL 不分裂）· utils/orphanGc.ts（引用感知 GC）
```

**唯一端点**：`POST /api/files/upload`（multipart `filename` 字段优先于 part 名；contentId=sha1(字节) 全局查重）。
**磁盘定位真源**：不可变 `resources.url` 派生（后端 `relativePathFromFileUrl` / 前端 `relativePathFromUrl`，口径一致）。
**改名 / 移动**：一律 context-only（只 `UPDATE name/folder`，不碰磁盘 / 不改 url / contentId）；无 row → 404 明确失败（不假成功）。
**项目隔离**：上传落盘即写 resource 行 `project_id`（`recordUploadedFileRow`，四分支均接 projectId）。
**上传「成功」的含义（2026-09-14 十轮裁决）**：= **「这份内容现在可在请求的 subfolder 下被看到」** —— 命中去重（内容已存在）时**也要**刷新既有行的 context；物理 `url` / `contentId` / `id` 一律不动。
**context 三列的不变式（十一轮收敛 · 唯一真源）**：

| 列 | 随什么变 | 为什么 |
| --- | --- | --- |
| `folder`（UI 分类） | **最近声明** | 上传/归类到哪它就在哪（「点了却库里没有」的解药） |
| `name`（显示名） | **显式/先到者优先** | 已命名（非空且 ≠ 磁盘哈希名）→ 不被再次上传覆盖（`resolveDisplayName`）；未命名 → 采用本次声明名 |
| `project_id`（归属） | **首次声明，不随最近声明漂移** | 否则「在项目 B 再上传项目 A 已有的同内容图」会把素材搬走 → 回 A 时直接不可见 |

`id` / `url` 由磁盘 `rel` 派生（`id` 跟磁盘、context 跟声明）；磁盘名仍是内容寻址 `sha1.<ext>`，改名/归类一律不碰磁盘。

**上传/扫描的失败语义（十二轮）**：非法输入 → `400`（`Invalid dataUri`）· **写盘系统故障 → `500`**（`Failed to persist dataUri`）——两者**不得压成同一响应**（错误归因）；`POST /api/resources/rescan` 读不到 uploads 目录 → `500`（不再假报 `ok:0` 条）；`POST /api/files/mkdir` 过**越根守卫**（复用 `resolveUploadFile`，与其它目录入口同源）。
**发送到素材库 = 三段顺序（2026-09-14 九轮收口）**：① 落盘 `filesApi.persistUrlToUploads`（**判据唯一**：data: / blob: / http(s) / 已是本机 `/files/`——后者 `already-local` **不重传**）→ ② `rescanResources`（resource 行由后端建）→ ③ **归位** `filesApi.moveFile`（context-only 改行 `folder` 到目标目录；**缺这一步 = 只落盘不入库**，素材库目录下拉不到）→ ④ 广播 `emitResourceSent`。返回 `PersistOutcome`（判别联合，失败词表含 `relocate-failed`），调用方按 `ok` 决定 toast 时机与真伪。

### 关键边

`filesApi` 模块引用 32（resourceStore/ResourceLibrary/GeneratedView/OverlayEditor/DepthVideoModal/videoEngine/d3dPersistence/ImageBoxNode/useImageHoverActions + api barrel + 21 测试）；
`sendToResourceLibrary` 全仓**仅 2 个调用点**（`AssetNode` / `ImageGenerate`）——`VideoGenerate` / `TextGenerate` **无发送按钮**（剧本盒走另一函数 `localizeAndStoreToResourceLibrary`）。

---

## 六 · 画布 / 节点链路

**一句话**：节点注册 / 默认 / 编组 / 派生 / 历史 / 懒加载 / 拓扑触发，是「节点怎么上画布、怎么联动」的骨架。

### 现状

```
canvas/NodePalette（**纯 UI 目录**：type/label/icon/cat/component，buildNodeTypeComponents 单源派生 nodeTypes）
canvas/nodeDataSchema（**新建 data 初值真源** NODE_DATA_DEFAULTS + defaultNodeData）
canvas/nodeDefaults（**结构默认**单源 + INPUT_PANEL_NODE_TYPES）
canvas/canvasSnapshotSchema（**落盘保留白名单** NODE_KEEP/EDGE_KEEP + sanitizeSnapshotNodes/Edges）
canvas/nodePrefs（参数记忆，KV yimao_node_prefs）
canvas/groupNodes（编组/拖拽落组/级联删/克隆）· canvas/deriveNodes（建子节点+连线原子快照 spawnAndCommit）
canvas/historyStack（撤销纯类）· canvas/CanvasEdgesContext（history 注入通道）
canvas/lazyNode（重节点懒加载 + 端口占位契约）· canvas/upstreamLink（拓扑自动触发）· canvas/toolRegistry（画布 AI 工具）
canvas/canvasContextMenu（右键三态纯配置）· canvas/ArrangeConfirm（整理确认 UI）· canvas/lod（LOD 性能降级）
canvas/useCanvasEventSubscriptions（3 全局订阅收拢）
生成触发入口：hooks/useGenerateNode（节点编排 start/模型，委托 hooks/useNodeGeneration，见 §一）
```

**三张表别混**：`NodePalette` = 纯 UI 目录 · `nodeDataSchema.NODE_DATA_DEFAULTS` = 新建 data 初值 · `nodeDefaults.NODE_TYPE_DEFAULTS` = 结构默认（新建与快照还原都补）。落盘保留白名单见 `canvasSnapshotSchema`。`interface XxxData` 与 `NODE_OUTPUTS` **不派生自** data 表，由 `check:node-data --strict` 机器对账。
**唯一入口**：`node.data` 写回 = `useNodeData.patchNodeDataById` · 节点 id = `idGen.generateId` · 端口真源 = `contracts.NODE_HANDLE_CONTRACT`（一致性由 `scripts/check-node-handles.mjs` 对账）。
**上画布**：素材 / 文本 / 图片 / 节点组统一收口 `hooks/useAssetDropPaste.ts`（+ `useGlobalPaste`），全部经注入的 `App.addNode` 建节点，无旁路。
**写语义**：`yimao_node_prefs` = 以存储最新为基准合并 patch（`mergeNodePrefs`），defaults 不落盘；KV 删除 = 键与版本同删。
**group 显示名**：唯一字段 `data.label`（建组与加载迁移双向收敛）。

### 关键边

`nodePrefs` ← App / AssetNode / ImageGenerate / TextGenerate / VideoGenerate / useScriptBoxEngine；
`CanvasEdgesContext` ← App + 8 节点；`deriveNodes` ← 8 节点 + `depthVideo/spawn.ts`；
`NODE_HANDLE_CONTRACT` ← `App.tsx`（补存量坏边 handle + addNode connection）+ `lazyNode.tsx`（占位骨架端口）。

### 上游产出（读侧）三张表 + 特判集

`hooks/useConnectedInputs.ts`：
① `SINGLE_OUTPUT_FIELDS`（单 URL 产出，**字段名由写侧显式声明**：assetNode/imageGenerateNode→`assetUrl`、videoGenerateNode→`videoUrl`、panoramaNode/director3dNode→`assetUrl`）；
② `NODE_OUTPUTS`（复合产出：scriptBoxNode 多端口 / imageBoxNode 多图 / videoExtract·gridSplit·gridMerge 的 `extractedImages[]` 归一）；
③ `NO_OUTPUT_NODE_TYPES`（group / ghostTarget / faceMosaicNode / loopNode / videoProcessNode —— 无自有产出，结果经 spawn 子节点交付）；
④ `SPECIAL_OUTPUT_TYPES`（textGenerateNode 读 node.id 特判）。
调度序 = 无产出 → 单 URL → 复合 → 特判 → **安全网**；`genericOutput` 只服务未登记类型，不承担契约。覆盖性 = `uncoveredOutputNodeTypes()`（纯函数 + 单测 + dev 告警）。

---

## 七 · 提示词链路

```
prompt/PromptInput · PromptLibrary · PromptLibraryButton · PromptHub（UI）
prompt/promptManager · prompt/promptHubStore（数据层）
prompt/promptChips · prompt/promptMention（纯函数）
```

**关键边**：`promptManager` ← `prompt/PromptLibrary`。

---

## 八 · 编辑 / 查看链路

```
动作入口：nodes/useImageHoverActions（← nodes/AssetNode · nodes/ImageGenerate）
编辑器/工具：editors/ImageEditor · editors/InlineImageCropper · editors/FaceMosaicEditor · editors/OverlayEditor
            + utils/imageCompress · utils/imageUpscale · utils/faceMosaic · utils/previewUrl（预览 URL 生命周期唯一出口）
查看器：editors/ImageZoomDialog（命令式 showModal）· editors/PanoViewer（← PanoramaNode）· ui/VideoThumbnail · ui/LazyImage
摄影参数：editors/cameraParams/*（← ImageGenerate）
产出落盘：编辑器结果统一经 filesApi.showThenPersistInline（唯一「图像入节点落盘」出口）→ 写回节点
```

**⚠️ 别混用**：`editors/cameraParams/*` 与 3D 摄影棚 `editors/cameraStudio.ts · CameraStudioPanel` 是**两套独立功能**（后者见 §九）。
**已知未纳入**：合成节点 `GridMergeNode` 尚未接 `showThenPersistInline`（TD-06-6）。

---

## 九 · 3D / 深度视频链路

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
        └→ storage.ts ─ d3dPersistence.ts（工程持久化；contentStore KV + localStorage 回退 + BroadcastChannel）

深度视频（两宿主共用一个 spawn，防漂移）：
  nodes/AssetNode · nodes/VideoGenerate ──→ depthVideo/DepthVideoModal.tsx ─→ depthVideo/spawn.ts（唯一派生出口）
  DepthVideoModal ← RUNTIME_MODELS = depthVideo/depthUrls.ts（运行时资源 URL 单源）
                    · engine.ts（纯逻辑） · loader.ts（运行时装载）

3D 摄影棚（实体在 base/editors/）：editors/cameraStudio.ts · CameraStudioPanel（← nodes/AssetNode · nodes/ImageGenerate）
  ※ editors/PanoViewer 属 2D 全景查看器（← nodes/PanoramaNode），归 §八，不在本段
```

---

## 十 · 视频（全量重审）链路

> 本段是**消费 / 契约层**的全量清单（含灯）；`base/depthVideo/*` 刻意用 `filesApi.uploadFileToLocal` 避开 `uploadResult` 坑。

```
base/utils/videoEngine.ts 🟢（uploadResult 失败返 null；crossOrigin 走 setCrossOriginForReadable）
base/utils/captureFrame.ts 🟢（跨源读取策略 setCrossOriginForReadable 收口于此且已导出供全树复用）
base/utils/encoderProbe.ts 🟢 · base/utils/audioPeaks.ts 🟢
hooks/useVideoPoster.ts 🟢（crossOrigin 接回单点原语，删第二判据）
base/ui/VideoThumbnail.tsx 🟢（显示组件，preload=metadata 取首帧，不抽帧）
nodes/VideoGenerate.tsx 🟢（videoUrl 落盘受 01/02 守护，非债）
nodes/VideoProcessNode.tsx 🟢（uploadResult null → fail 显式报错；GIF 分支走 uploadFileToLocal 落盘）
nodes/VideoExtractNode.tsx 🟢（crossOrigin 接回单点原语）
videoEditor/export/pipeline.ts 🟢（单入口 + 判别联合 OpResult/AudioOutcome）
videoEditor/data/projectRepository.ts 🟢（CAS + 判别联合 SaveProjectResult，版本冲突暴露 UI）
videoEditor/panels/dock/useEditorExport.ts 🟢（uploadResult null → toast「导出失败」不 spawn）
base/depthVideo/* 🟢（上传落盘走 filesApi.uploadFileToLocal）
director3d/App.tsx · director3d/panels/Timeline.tsx 🟢（MP4 导出走 uploadFileToLocal）
```

---

## 十一 · 配置 / 账户 / 事件总线（横切契约域）

```
contracts.ts（EVENTS/STORAGE_KEYS/NODE_TYPES/apiRegistry 单一事实来源） 🔴
settingRegistry.ts（设置声明表·app_settings 默认值/UI/云同步三派生 SSOT） 🟢
eventBus.ts（subscribe/publish 唯一通道） 🟢
appSettings.ts（KEY=app_settings, backend:local） 🟢
accountsStore.ts（KEY=yimao_accounts, backend:kv，仍进云同步） 🟡
providerStore.ts（save 后回写 active_api_endpoint KV 供后端路由） 🟢
agentModelStore.ts（agent_chat_model / agent_history_turns, backend:local） 🟢
skillStore.ts（agent_skills / agent_skill_usage / agent_skill_enabled） ⚪（抽审，欠深审）
nodeRuntimeStore.ts（纯内存瞬态 map，不落盘） ⚪（抽审，欠深审）
```

**关键边**：`contracts.ts` EVENTS 被全仓 `publish/subscribe('` 配对消费（无第二套广播通道）；
`providerStore` ← 21 处；`active_api_endpoint` 已在 STORAGE_KEYS 登记（backend:kv），前端 save 写、后端 `official.ts`/`passthrough.ts` 读做路由（派生缓存，设计权衡非债）。

---

## 十二 · localTool 后端（服务端 `localTool/`）职责与数据流

**一句话**：前端（base/core/api）只是薄壳，真正的协议执行 / 落盘 / 任务常驻在 localTool 服务端（`:18080`），再直连上游（Lovart 需 VPN）。
**契约互检**：前端 `contracts.ts apiRegistry` ↔ 后端 `router.ts`，由 `check:api` 双向校验。

### 文件分层

- 入口/路由：`src/index.ts`、`src/router.ts`、`src/routes/*`（HTTP 端点层）
- 生成引擎：`src/generateEngine.ts`（relayGenerate / relayChat / relayChatStream）
- 异步任务句柄：`src/relay-poll.ts`（attach + 落库 + 重启恢复；红线：**chat 绝不进 poller**）
- provider 框架：`src/ai-relay/`（protocol/engine 协议注入、generate.ts 各模态能力、providerCatalog/baseUrl/Endpoints、manifests 模型目录）
- 配置/路径：`src/providerConfigStore.ts`（每平台一 JSON）、`src/paths.ts`（文件路径单源）、`src/version.ts`
- 持久化：`src/db/database.ts`（tasks）、`src/utils/fileStore.ts` + `/files/` 落盘、`routes/kv.ts`

### 生成数据流（服务端）

```
前端 base/api/relayProxy ─→ POST :18080 /api/generate
   → routes/generate.ts（capability 分流，端点无 fetch/落盘，只透传）
       ├─ chat：generateEngine.relayChatStream(SSE 打字机) / relayChat（同步）
       └─ image/video：relay-poll 注册句柄（submit 即返 taskId，GET attach 收结果）
   → generateEngine → ai-relay/（protocol kit + providerCatalog + generate.ts 能力）
   → 出站：厂商直连 lgw.lovart.ai（Lovart 需 VPN，经 fetchWithProxy 代理）
   → 结果：saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端
```

> ⚠️ 旧网关（`:9004`）已随 lovart-old 旧轨退役，**不再存在**该环节。

---

## 十三 · hooks 编排层（横切 · 节点 / 画布 / store 写回归口）

```
写回唯一入口：hooks/useNodeData.ts 🟢（patchNodeDataById/patchNodeById/computePatch*；24 fan-in）
订阅基座：    hooks/useStoreSelector.ts 🟢（selector+shallowEqual 记忆化，防连坐重渲）
跨窗口冲突：  hooks/useCanvasSync.ts 🟢（BroadcastChannel + 3s 版本轮询）
画布快捷键：  hooks/useCanvasShortcuts.ts 🟢 · hooks/useCanvasHistory.ts 🟢（逻辑下沉纯类）
工具：        hooks/useVideoPoster.ts 🟢 · hooks/useAssetDegrade.ts 🟢 · hooks/useLocalToolStatus.ts 🟢（ensurePoll 幂等）
产出契约：    hooks/useConnectedInputs.ts 🟢（33 fan-in，写侧声明，见 §六）
建边/改名：    hooks/useDisconnectSource.ts 🟢 · hooks/useEdgeData.ts 🟢
生成链路：    hooks/useGenerateNode.ts 🟢 · hooks/useNodeGeneration.ts 🟢（见 §一）· hooks/useScriptBoxEngine.ts 🟢
素材落画布：  hooks/useAssetDropPaste.ts 🟢 · hooks/useAssetDragToCanvas.ts 🟢 · hooks/useResourceMoveToFolder.ts 🟢
改名/重命名： hooks/useNodeRename.ts 🟢
欠深审：      hooks/useNodeField.ts ⚪ · hooks/useNodeExpanded.ts ⚪ · hooks/useFitNodeRatio.ts ⚪
              · hooks/useArrangeCanvas.ts ⚪ · hooks/useContextMenu.ts ⚪
```

**关键边**：`useNodeData` ← 24 处；`useConnectedInputs` ← 33 处；`useStoreSelector` ← 全 store 原子订阅基座；`useCanvasSync` ← App 单点。
`useNodeData.patchData` 是 `node.data` 写回唯一真源，绕行者由 `check:arch` 规则 5（覆盖全 src、豁免 agent/）拦截。

---

## 十四 · 导出 / 备份（项目文件导入导出）

```
backupStore.exportAll/importAll/backupToBlob 🟢（agentKey 前缀收口 base/core/agentKeys.ts 单源；
    项目枚举走 projectStore.getAllProjects() 内存真源；importAll 有 type/version 守卫 + failed 明细，不再恒返 ok:true）
  → useCanvasEventSubscriptions（project:export/import 事件接线）🟢（区分预检拒绝 / 部分失败）
  → ProjectSelector（纯触发壳）🟢 · contracts.getLocalKeys（LS_KEYS 备份清单单源）🟢 · projectStore I/O 🟢 · contentStore 🟢
```

---

## 十五 · 横切登记（无独立数据流，只有文件 + 灯）

> 以下四段**没有自己的数据流**，是横切工具 / 地基的覆盖度登记。链路视角看它们时，只把它们当"节点"。

### 15.1 utils 工具层（横切纯函数）

```
volumePolicy.ts 🟢 · asyncGuard.ts 🟢（loadImageOrNull 收口私有实现）· clipboard.ts 🟢（复制/清洗/下载统一出口）
providerModels.ts 🟢（buildAllModels/resolveProviderModel 单源）· providerUrlAdapters.ts 🟢（展示名映射，非债）
refToken.ts 🟢（编解码纯函数）· arrangePack.ts 🟢（packComponents 单消费方）
assetType.ts 🟢（EXT_KIND 单源）· imagePixel.ts 🟢（RATIO_PIXEL_TABLE 单源）
```

### 15.2 base/core 横切基础设施

```
config.ts 🟢 · degrade.ts 🟢（reportDegrade 11 处调用全对象形态）· logger.ts 🟢（87 fan-in 唯一日志出口）
backendLogStream.ts 🟢 · canvasSyncBus.ts 🟢 · confirmStore.ts 🟢 · toastStore.ts 🟢
modalLayer.ts 🟢 · idGen.ts 🟢 · uiHooks.ts 🟢 · utils.ts 🟢
contentStore.ts / contracts.ts / eventBus.ts → 属 §三 / §十一 深审，此处不重复
```

### 15.3 base/ui 叶组件库

```
Select.tsx 🟢 · ModelSelect.tsx 🟢（共用 DropdownPanel/DropdownRow 窄原语，单一真源）
ContextMenu.tsx 🟢 · RenameDialog.tsx 🟢 · ErrorBoundary.tsx 🟢 · LazyImage.tsx 🟢
Toggle.tsx 🟢（已从两处抽公共）· attachmentCover.tsx 🟢 · NodeShell.tsx 🟢
ConfirmContainer.tsx 🟢 · ToastContainer.tsx 🟢
NodeTitle · ToolbarButton · GenerateButton · GeneratingOverlay · ExpandablePanel · VideoThumbnail
  · ResizeFullscreenHandle · CometParticles · JianyingIcon ⚪（抽审，欠深审）
```

### 15.4 审计工具链治理（元层）

```
knip（死代码检测）→ 并进主工程 🟢
  ├→ package.json devDependency `knip`（随 npm ci 可装） 🟢
  ├→ 根 knip.json 🟢 · scripts/check-dead-code.mjs（基线「永不复涨」） 🟢
  ├→ scripts/dead-code-baseline.json（存量基线 · knip 6.33.0） 🟢
  ├→ scripts/gates.manifest.json::dead-code（phase=push → 本地 pre-push 自动跑） 🟢
  └→ .github/workflows/ci.yml `npm run check:push` 🟢（本地 pre-push 与 CI 跑同一份清单、各一次）
scripts/check-arch.mjs 🟢（架构规则**唯一落点**：循环依赖/分层/唯一入口/裸写 node 字段/KV 同步读/深路径）
scripts/check-silent-catch.mjs 🟢（静默吞闸 · 豁免通道收口为 catchOk.ts 登记表白名单）
scripts/debt.mjs 🟢（债务账本读写唯一入口）
scripts/probe.mjs 🟢（先红后绿探针执行器：注入 → 跑 → 断言 → 自动还原）
scripts/check-gates.mjs 🟢（元层闸：在册闸脚本必须带【申诉口】三问）
scripts/check-node-handles.mjs 🔴（端口豁免 · 与真源重复表述且半漂移）
scripts/check-node-data.mjs 🟢（闸内豁免表 1 条 · 带原因 + 过期自检）
docs/audit-archive/*.md ⚪（历史报告归档保留，非活配置）
```

> 退役边界：depcruise / madge 的能力已被 `check-arch.mjs` 覆盖 → 不并；oxlint 与 eslint 重叠 → 不并；jscpd 无迫切性 → 不并；ast-grep 是重写执行器非闸 → 不并。

---

## 十六 · 已退役 · 已改名（全文唯一一份）

> 读到旧名 / 找不到某模块时先查这张表。**只写"旧 → 新"，不写日期与原因**（原因在 `daily/架构日志/`）。

### 已改名 / 已迁移

| 旧 | 新 |
| --- | --- |
| `nodes/PromptNode` | `nodes/ImageGenerate` |
| `nodes/TextNode` | `nodes/TextGenerate` |
| `nodes/DiscountVideoNode` | `nodes/VideoGenerate` |
| `nodes/ImageNode` | `nodes/ImageGenerate` |
| `panels/AssetLibrary` | `panels/ResourceLibrary` |
| `panels/MaterialStrip` | `panels/ResourceStrip` |
| `nodes/TemplateNode.tsx` | `nodes/_template/`（参考蓝本，非活节点，不占 registry） |
| `localTool/src/relay.ts` | `localTool/src/generateEngine.ts` |
| `localTool/src/providerConfig.ts` | `localTool/src/providerConfigStore.ts` |
| `localTool/src/ai-relay/generate/index.ts` | `localTool/src/ai-relay/generate.ts` |

### 已删除 / 已并入

| 已删 | 现状 |
| --- | --- |
| `genIntent.ts` | 0 引用退役 |
| `chatApi.ts` / `imageApi.ts` / `videoApi.ts` | 并入 `base/api/generate.ts` 单门面 |
| `store/assetStore.ts` | 已删除；素材库域由 `store/resourceStore.ts` 承接 |
| `utils/resultUrlExtractor.ts` | 0 生产引用删除；判型收口 `utils/mediaType.ts` |
| `agent/runtime/runModeRegistry.ts` | 整模块删除；执行模型恒 `auto`（`runMode`/`workMode` 仅剩历史注释，**禁因注释恢复**） |
| `agent/runtime/workflowRuntime.ts` | 删除（第二真相） |
| `store/kvStore.ts` 的读写实现 | 折叠进 `core/contentStore`；`kvStore.ts` 现为 re-export 壳 |
| 旧网关 `:9004` | 随 lovart-old 旧轨退役；localTool 只直连 `lgw.lovart.ai` |
| `api/localToolApi` 的文件域成员 | 迁入 `api/filesApi`（文件域唯一单点）；`localToolApi` 回归纯 CRUD + kv + providers |
| `applyResourceIdentityChange` / `rewriteUrlReferences` | 全仓无定义（仅注释残留）；改名/移动改 context-only |
| `EVENTS['resource:renamed']` | 已删 |
| `yimao:remove-edge` 事件 | 死事件删除（删边实走 `deleteElements`→`onDelete`） |
| `audit/` 沙盒 | 退役；唯一未覆盖能力（knip）已并进主工程闸体系 |
| 任务中心「再来一次」入口 | 已删（不接 retry 注册） |
| `uploadResult` 的 blob 伪造 | 失败返 `null`（错误透传） |
| `spec/TECH-DEBT.md` | 已废弃（只读、禁追加） |

---

## 十七 · 怎么用

- 想 trace「一条链路从哪来、走哪、落哪」 → 本文件
- 想确认「某文件实际被谁 import / 依赖谁」 → `node scripts/mv-sync-refs.mjs refs <file>`
- 想改某个域的行为（生成 / 存储 / 资产 / 画布 / 提示词 / 编辑 / 3D / 视频） → 按本索引该链路的文件清单逐个看**文件头注释**再动
- 想知道「这条链路为什么变成现在这样 / 某结论被推翻的过程」 → `spec/DATAFLOW-HISTORY.md`，或真源 `daily/架构日志/<NN>-<区域>-<日期>.md`
- 想改**本文件** → 先读 §维护规矩（禁写清单）
