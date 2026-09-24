# spec/DATAFLOW.md · 数据流链路索引

> **目的**：让 AI 能**在一处读完一整条链路**（谁产生 → 经过谁 → 谁消费 → 落哪），不必在 core/api/store/utils/nodes/panels/hooks 之间乱猜。
> **本文件只写「当前真相」**：现状链路图 + 关键边。**不放灯**（灯 = 审计进度，见 `daily/架构日志/index.md`）。物理归属见 `src/components/base/README.md`，本文件不决定文件位置。
> **实证**：边由 `node scripts/mv-sync-refs.mjs refs <file>` 机械验证（"关键边"段给出 fan-in 数），不凭文件名猜。
> **省消耗**：改某条链路时，照本文件该链路的文件清单走 + 读文件头注释即可，**不需要**为搞清楚"这条链路在哪几个文件"启动子代理全库乱搜——这张图就是答案。真拿不准单文件归属时才跑 `refs`。
> **历史**：本文件历次修订的**叙事过程**见 `spec/DATAFLOW-HISTORY.md`（只读留痕）；区域审计明细见 `daily/架构日志/<NN>-<区域>-<日期>.md`。
> **一体两面**：本文件与 `spec/判据登记表.md` 是一对，**禁只看一张 / 禁只更新一张**（规矩的定义、对账动作与冲突处理见 `.codebuddy/commands/债务登记5步法.md`、`.codebuddy/commands/架构师改码7步法.md`）。本行只作指针，不复述。

---

## ⛔ 维护规矩（改本文件前必读 · 全文只有这一份）

> 本文件被塞满历史叙事的根因 = **同一批规矩散抄在 6 处**且互相矛盾（此处禁写日期/说明，另外 5 处却要求写 `更新(<日期>…)`）。
> **本段是唯一出口**，其余文件（`架构师心法.md` §七 · `债务登记5步法.md` · `架构师改码7步法.md` Step 7.4 · `daily/架构日志/index.md` · `_template.md`）一律只指向这里，不再各自复述。

**允许写（只有这两样）**：

| 要素 | 形态 |
| --- | --- |
| ① 现状链路图 | 代码块里的 `→` / `├→` 箭头，**只描述此刻的真相** |
| ② 关键边 | 一行，带 `refs` 实证的 fan-in 数（如 `contentStore ← 53 处`；**数字随代码漂移，写时现跑 `refs`**，勿抄旧值、勿凭印象） |

> **③ 灯已移除（2026-09-16）**：灯是「审计进度」而非「数据流」。此前 **146 处**灯散落本文件，而其声称的真源（区域文件 §六 覆盖度表）只有 **9/23 区**存在 → **146 个同步点对 39% 的真源，必然系统性失效**。
> 现收口为：**细粒度**（文件 → 灯）进轮次文件 §六 覆盖度表（真源）；**粗粒度**（区域 → 灯）由 `daily/架构日志/index.md` **机器生成**。本文件**不再持有任何灯**。

**变更时怎么做**：

| 情况 | 动作 |
| --- | --- |
| 链路漂移（新增 / 删除 / 改道） | **就地改**①现状图，让图重新等于现状（**改，不是追加**） |
| 模块退役 / 改名 | 在 §已退役 · 已改名 表里改一行（旧名 → 新名 / 替代者） |
| 有理由 / 日期 / TD 号 / 探针 / 测试结果要留 | 写进 `daily/架构日志/<NN>-<区域>-<日期>.md`，**不写在这里** |

**禁写清单**（出现即违规，须当场回退）：

- ❌ `> 更新(<日期>, refs实证): ...` 这类**追加式叙事段**（变更叙事一律归 HISTORY / 区域日志）
- ❌ 日期、TD 编号、`L123` / `:456` 形式的行号、探针结果、测试例数
- ❌ 债明细（归类 / 利息率 / 爆炸半径 / 偿还计划）、裁定过程、方案比较
- ❌ **灯（🟢🟡🔴⚪）** —— 审计进度不属数据流，见下方「灯不在这里」
- ❌ 同一结论在多个段落重复表述（要复用就写指针）

**灯不在这里（2026-09-16 收口）**：本文件**禁写** 🟢🟡🔴⚪ ——
**细粒度**（文件 → 灯）看轮次文件 §六 覆盖度表；**粗粒度**（区域 → 灯）看 `daily/架构日志/index.md`（机器生成）。
判据 / 读灯写灯流程见 `.codebuddy/commands/债务登记5步法.md` §数据流覆盖地图。

---

## 一 · 生成链路（意图 → 出站 → 任务 → 结果 → 回填）★主链路

**一句话**：数据从画布节点发起，经统一生成入口，结果以**后端 `tasks` 表**为真源、经「任务中心」（前端镜像）回填节点。
**红线**：结果权威源 = **后端 `tasks` 表**（前端「任务中心」是它的**镜像**，只反映不筛除）；`node.data` 是渲染缓存副本（见 CONTEXT §五 · ADR-0059）。
**任务行真源（ADR-0059）**：任务行的真源是**后端 `tasks` 表**；「任务中心」是它的**前端镜像**（`taskStore.tasks`），
镜像**只反映、不筛除** —— 后端有几条就几条（同一 nodeId 可出现多条：任务中心是扁平列表、不按节点分组）。
节点是**单结果槽**：末次广播胜出，「被旧结果覆盖」属正常性质，**不加新旧判据**。

### 现状

```
─ 画布节点生成（主范式：经 useGenerateNode 委托契约）
{image/nodes/ImageGenerate · text/TextGenerate · video/nodes/VideoGenerate}
  → src/hooks/useGenerateNode         (provider/模型管理 + useSyncNodeData + 委托 useNodeGeneration)
      → src/hooks/useNodeGeneration   (统一契约：reportGenerate→progress→run→成败→retry + 落盘 + node.data 回填)
          → generate/lib/generate.ts  (单门面：generateImage / generateVideo / chatCompletions / chatStream)
              → generate/lib/relayProxy.ts (relaySubmit / relayAttachUntilDone / relayChat / relayChatStream)
                  → POST :18080 /api/generate（chat→同步快路径 / image/video→relay-poll 异步句柄）
  → store/taskStore.reportGenerate / progress / done / fail    （前端镜像；真源 = 后端 tasks 表）
  → 落盘唯一出口 filesApi.saveResultToTasks（**唯一调用点 = generationOrchestration.ts**，契约内无条件一步；节点与剧本盒**共用同一次**，故不存在双落盘）
    live 顺序：`settle`(节点先显示) → 落盘 → `onPersisted`(持久 URL 覆盖) → `done`(任务行最后落)
      ⇒ 「权威源最后才落」；`done` = 终态原语 `completeTask`，其广播在 `!cur` 守卫**之后**
  → 刷新恢复 generate/lib/pollTask.ts ─→ 复用 relayProxy.relayAttachUntilDone（只 attach；**无中止入口**，ADR-0061）
      → taskStore.patchTask（进度）+ 终态原语 completeTask/failTask（唯一发布入口就在原语内）
          → 广播 agent:task-completed → useNodeGeneration 精准回填 node.data（detail.nodeId===本节点）
   回填 node.data ◄── src/hooks/useNodeGeneration ◄── taskCompletionBus 广播
  ⚠️ **回填的前提**：该任务行**当时在镜像里**（广播在 `!cur` 守卫之后）。行不在一律不写回、不广播
      ⇒ 镜像**不得筛除**真源（ADR-0059）；万一缺行也必须 warn 可见（不许静默丢弃）。

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

判型：base/utils/media/assetType.resolveAssetType ◄── src/hooks/useConnectedInputs
      （结果 URL 由 localTool 后端落盘 /files/ 直返 / `t.data[0].url` 契约直读，无独立提取器）
错误分类：utils/genErrors.classifyError（abort/timeout/network/http/business）
展示：task/TaskCenter · generate/GeneratedView
```

**当前约束**：任务中心**无「再来一次」入口**（已删）；剧本盒 asset 生图不接 `useNodeGeneration` 的 retry 注册。
生成链路**不提供中止入口**（ADR-0061）：节点生成中**无任何按钮**（无「停止」/「刷新」）、任务中心**无「取消」**；
「不再等待」由编排的 `pending` 分支承担（预算耗尽 ⇒ 清 loading，行留 `running` ⇒ `pollTask` 续 attach ⇒ 后端终态回填），
「不再显示」用任务中心的**删除任务**。后端 `cancelGenerateTask` 保留但**无生产调用方**（仅测试观测点）。
幽灵行（前端建行但后端从未持有）由后端 `not-found`／`unknown` 收敛，不靠前端判死。

### 关键边

**taskStore 的两条合法入口（不是"一深一浅"，勿把任一条当绕过；详表见 taskStore.ts 文件头）**：
  ① **产结果** —— 经 `useNodeGeneration` / `runGenerationOrchestration`（内部 `reportGenerate` → `TaskController.{progress,done,fail}`）；
  ② **刷新恢复** —— `pollTask.ts` 用终态原语 `completeTask`/`failTask`（+ `patchTask` 报进度）。
  终态**只能**经 `completeTask`/`failTask`（TD-01-20 唯一原语：含非字符串防御/排障埋点/取消未落进度写）；
  自己 `patchTask(id,{status:'completed'})` 会漏掉这三项。存量实测：src 侧仅上述 2 处调用，零绕过。

`relayProxy` ← `generate.ts` / `pollTask.ts`（无节点/agent · scriptbox 直连，门面收口）；
`generate.ts` 直接消费方 = 4 生成节点（经 `useGenerateNode`）+ `scriptBoxEngine` + `agentRuntime` + `contextCompression`；
`taskCompletionBus` ← 唯一发布点 = `taskStore.ts` 的 `completeTask`/`failTask` 内（`pollTask.ts` 只是**调用原语**，不是发布方）；
`useNodeGeneration` ← `useGenerateNode` + 节点测试；
`degrade` ← `useNodeGeneration` / `TextGenerate` / `conversationState` / `contentStore`。

---

## 二 · AI 助手（Agent）链路 ★会话 / 工具 / 表格子系统

### A0 · 会话数据（SSOT 唯一可写源）

```
agent/panels/AgentPanel.tsx（UI 壳，0 模块 import 的叶节点）
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
  → agentRuntime.roundTrip → 前端门面 generate/lib/generate.ts chatStream → POST :18080 /api/generate
  → agentRuntime.runToolCalls(await callTool) → agent/canvas/useCanvasAgentTools（工具注册表）
      → agent/canvas/agentCanvasHost（**写画布的两条路，判据＝目录**：在 agent/canvas/ 内一律经本 host；其余目录［nodes/ shell/ hooks/ 等人工/UI 侧］直接 useReactFlow().setNodes。判据可机械判定，勿凭"算不算 AI 侧"推断 —— check-arch 规则 3 按目录守）
      → agent/canvas/canvasPlanExecutor（Wave1 并行 + Wave2 依赖）
      → conversation/*（状态回写）+ taskStore（生成落点）
  → workflowState（wfStart/wfSteer/wfFinish/wfAwaitConfirm/wfNextSteer 纯函数）
```

### A2 · 表格协作（第二入口：左表右对话）

```
agent/panels/TableWorkspacePanel.tsx ⇄ agent/assistantTable/AssistantTablePanel.tsx
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

`conversationStore` ← 19 处；`conversationState` ← 14 处；
`useAgentChat` ← 5 处；`projectMemoryStore` ← 5 处；`agentCanvasHost` ← 4 处。

**三条"唯一"**：出站唯一（LLM 一律经 `generate/lib/generate.ts`，无第二直连）· **画布写按目录分路**（`agent/canvas/**` 内一律经 `agent/canvas/agentCanvasHost`；其余目录＝人工/UI 侧，直接 `setNodes`。判据＝目录，可机械判定 —— 勿按"算不算 AI 侧"推断）· 消息写唯一（一律经 `agentMessages`）。

---

## 三 · 存储 / 持久化链路

**一句话**：所有状态的落盘 / 恢复都走唯一入口 `core/contentStore`，再由它路由到 KV / 本地底层；备份与云同步在上层编排。
**红线**：业务侧禁绕过 `contentStore` 直调 `kv*` / `s*` 底层（`check:arch` 规则 6 拦截，白名单 4 类）。

### 现状

```
core/contentStore（STORAGE_KEYS 路由 + resolveBackend 唯一判定 + 失败分类 isEngineUnavailable，dev 校验裸 key）
   ├→ storage/storageAdapter（sGet/sSet/sRemove，local/native 落地 + isStorageReady/onStorageReady 就绪度原语）
   ├→ api/localToolApi（kvGet/kvSet/kvDelete，KV 云端；不经 kvStore 中间层）
   ├→ storage/storageQuota（旁路工具，不参与读写主链）
   └→ 上层：store/projectStore · store/backupStore · store/cloudSync（云同步见 §四）

两个族（真分叉在失败语义，不在后端）：
  尽力而为族 contentSet/Get/Delete(+Async)  配置类，引擎不可用 → 落本地副本 + reportDegrade（成功清副本）
  严格族     contentKvGetVersion/contentKvSetCas  用户主数据，fail-closed 绝不写副本
  共用失败分类：isEngineUnavailable（4xx = 请求被拒 → 上抛 / 其余 = 引擎不可用 → 降级）

入口怎么选（**唯一前置 = 看该键在 STORAGE_KEYS 登记的 backend**；详表见 contentStore.ts 文件头）：
  读/写/删：local 键用同步族 contentGet/Set/Delete；KV 键用 contentGetAsync/SetAsync/DeleteAsync + await
  两条铁律：① KV 键一律走 Async（同步 API 对 KV：读取到 undefined、写/删直接抛）
            ② 失败该不该上传由"族"定（尽力而为族降级不阻断 / 严格族 fail-closed）

画布快照 CAS 链路：projectStore（CAS 基线 / 单飞 / 冲突提示，L3 编排）
  → contentStore 严格族 → localToolApi.kv*（L1）；useCanvasSync 版本轮询同经 contentKvGetVersion

就绪度：storageAdapter.isStorageReady() / onStorageReady(cb)（非插件环境恒就绪）
  loadFromLocal 未就绪 → 返回 undefined 且不写缓存（杜绝「未加载＝不存在」的粘性假真相）
  projectStore / resourceStore / appSettings 就绪后重读一次
  resourceStore 另在此时**从后端刷新镜像一次**（refreshFromBackend：全量 fetchResources → mergeResourcesFromBackend；
    镜像填充归 store 自身 —— 契约层 base/media **不写 store**，只读映射）

kvStore.ts（re-export 壳）已删除；CANVAS_STATE_PREFIX 由 core/contracts.ts 直供，不参与读写链路
唯一例外：conversationState.ts 的 1 处裸 sGet（KV 迁移回读旧 local）
```

**fan-in**：`contentStore` ← **53 处**（`refs` 实测）——几乎全部 store（task/asset/project/backup/cloudSync/skill/appSettings/accounts/agentModel/provider…）+ canvas/contract/nodePrefs + prompt/promptHubStore + creative/promptManager + agent/* + agent/panels/AgentPanel。它是横切唯一入口，见 `base/README` §一红线说明。
**防回潮闸**：`check:arch` 规则 6（禁绕过 contentStore 直调底层）· 规则 7（KV 键同步读无守卫）· 规则 9（projects 唯一 module 写点 + 禁外部直读 cache）。

---

## 三′ · 可引用媒体源链路（横切地基 · `base/media/`）

**一句话**：把「有哪些媒体可以被引用」从各消费方里抽出，收口为**一处注册表 + 一种形状**（`MediaRef`）；本层只做映射，数据仍取自既有真源。
**来源展示面由来源自己声明**（`MediaRefProvider.label` / `.order` / 契约条款「`categories()[0]` = 默认分类」）：消费方派生 tab 序列（`listMediaRefSources()` 已按 `order` 排好），**不自持清单** ⇒ 新增来源 = 消费方改 0 行。
**红线**：`base/media/` **禁** import 任何非 base 目录（`check:arch` 规则 2 反向判据）；本层**不持久化、不广播**。

```
消费方（两个入口共用同一弹窗）：
  ├→ 画布右键菜单「导入」（canvas/shell/canvasContextMenu → src/App.tsx）
  │     → videoEditor/ImportMediaModalHost（FullscreenModal 薄壳）
  │         → base/panels/ImportMediaModal（来源 tab（本地伪来源 + **注册表按 order 派生**）+ 卡片网格 + 底栏；**只认 MediaRef**）
  │             落地动作由宿主注入：onPick → App 建 assetNode；onLocalFiles → App createNodeFromFile
  └→ 剪辑器素材面板「导入」（videoEditor/ui/editor/panels/assets/views/media.tsx）
        → 同一个 ImportMediaModalHost
             onPick → linkMediaRefsToProject（登记引用：fetch→File **不上传** + 双轨去重）
             onLocalFiles → processFiles（走既有上传链路）

  → base/media/index.ts（唯一出口，import 即完成内置来源自注册）
      ├→ mediaRefRegistry（queryMediaRefs 单来源）
      │    └→ providers/index.ts（唯一 import 点 · 模块副作用自注册）
      │         ├→ providers/canvasSource     source='canvas'    ← canvas/lib/nodeMedia.getNodeMedia（只取主媒体）
      │         │                                      + base/utils/media/assetUrl.resolveAssetDisplayUrl（contentId→url）
      │         │                                      + base/core/utils.toAbsoluteFileUrl（url 归一）
      │         │                                      ← canvas/lib/canvasNodesBridge（画布节点只读快照）
      │         │                                      （**无 categories** = 无第二层筛选）
      │         ├→ providers/librarySource    source='library'   ← base/api/pagedList.fetchAllResourcePages（取全量：按 totalPages 取齐）
      │         │                                      「全部」= folderExact:'migrated'（**精确** = 未归类）
      │         │                                      人物/场景/道具 = folder:'migrated/…'（**前缀**，含更深子目录）
      │         │                                      + base/utils/media/assetType.detectAssetType
      │         │                                      folder 条目（type:'folder'）→ isFolder 卡片（**拖拽落点**）
      │         │                                      categories() ← resource/resourceStore.FOLDERS（**唯一真源**；白名单 all/character/scene/prop）
      │         └→ providers/generatedSource  source='generated' ← **委托 librarySource**（注入 folder:'tasks'，M3 不抄第二份）
      │                                                             categories() = 按类型（全部/图片/视频/音频）；剔除 isFolder
      └→ canvasNodesBridge（写/读；**单向**：只有 App.tsx 写）
           ← src/App.tsx 的 nodes 变化 effect（引用赋值）

真源（**不重实现，只复用**）：nodeMedia(①) · resolveAssetDisplayUrl(②) · fetchResources(③) ·
  resourceStore(④) · toAbsoluteFileUrl(⑥) · assetType/detectAssetType(⑦)
```

**fan-in**：`base/media/index.ts` ← **3 处**；`videoEditor/ImportMediaModalHost.tsx` ← **2 处**。
**分类层（`MediaRefProvider.categories`）**：由 provider **声明**，消费方 0 行接入（弹窗第二排 pill）。
**「全部」= 精确 `migrated` 根（未归类区）**；其下子文件夹 = `isFolder` 卡片作**拖拽落点**
（`useResourceMoveToFolder.folderDropProps`，弹窗与素材库面板同一收敛点）。
**素材库目录清单真源 = `resourceStore.FOLDERS`**（`ResourceLibrary` 与 library provider 均派生自它，无第二份）。
**关键边界**：`canvasNodesBridge` 是**投影不是状态**（真源永远是 App 的 `nodes`）；多窗口下只反映本窗口 nodes（既有架构边界，非 bug）。
**引用语义**：剪辑器从「生成/素材库/画布」导入 = 登记引用（`saveMediaAsset` 见 `persistentUrl` 即跳过上传）；从「本地导入」= 既有上传。
**防回潮闸**：`check:arch` 规则 2（base 禁反向依赖业务域 —— 弹窗只认 MediaRef，不碰 videoEditor）· 规则 6（禁绕过 contentStore 直调底层 —— 本层零存储依赖）。

---

## 四 · 云同步（Cloud）链路

**一句话**：`cloudSync` 是**编排层**，不持有真相（真相在各域 store / contentStore）。

### 现状

```
主文件：src/components/base/store/cloudSync.ts
        （CloudSyncEngine 引擎 + uploadConfig/downloadConfig + normalizeCloudPayload / diffWithLocal / decideUpload 纯函数）
fan-in（refs 实证 5 处 import）：App.tsx（手动按钮 handlePushToCloud/handlePullFromCloud）
                                  · autoSync.ts（45min 定时调度，失败告警）
                                  · tests/unit/cloudSync.test.ts · tests/unit/autoSync.test.ts · tests/unit/cloudSync.rehydrate.test.ts（隔离 mock）

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
api/filesApi（全站文件域单点：upload[FormData/JSON 双模式] / move[context-only] / mkdir / open / open-dir + 3 纯函数）
   ├→ resource/resourceStore（素材库 SSOT：saveInlineToLocal/uploadFileToLocal/EXT_BY_TYPE）
   ├→ api/localToolApi（fetchResources?projectId / saveResource / renameResource / deleteResource / rescan）
   ├→ resource/ResourceLibrary · generate/GeneratedView（openLocalFolder/openFileDir/relativePathFromUrl/createFolder；
   │     前者「落盘完成 → 刷新」含同目录重拉，后者订阅 agent:task-completed 重拉生成列表）
   ├→ src/hooks/useAssetDropPaste · src/hooks/useResourceMoveToFolder · src/hooks/useAssetDragToCanvas
   ├→ image/nodes/ImageBoxNode（resolveNodeAssetUrl）· image/useImageHoverActions（showThenPersistInline）· image/nodes/AssetNode
   ├→ scriptbox/scriptBoxEngine（uploadFileToLocal/saveResultToTasks）· src/hooks/useNodeGeneration（saveResultToTasks）
   ├→ video/depthVideo/DepthVideoModal · video/lib/videoEngine（uploadFileToLocal → videoProcess 桶）· director3d/d3dPersistence（saveInlineToLocal）
   └→ 地基：utils/uploadDirs（subfolder 中央表）· utils/mediaType（判型）· utils/previewUrl · utils/imageUrl（URL 归一）

后端落盘 / 资源表（localTool，主审见区域 12 / 08）：
  routes/files.ts（upload→writeUploadDedup 内容寻址去重 / move→context-only / read·thumbnail·mkdir·open·list）
    → utils/fileStore.ts（落盘真源：contentHashName(sha1(bytes)) / writeUploadDedup / UPLOAD_ROOT_ALLOW）
  routes/resources.ts（resources 表：rescan 1:1 映射 / GET ?projectId / rename·move 走 context-only）
    → db/database.ts（resources 表含 project_id；rescan 行保持 NULL 不分裂）· utils/orphanGc.ts（引用感知 GC）
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

**图片显示出口 + 失败回退（唯一实现）**：`base/utils/media/useImageFallbackSrc.ts` —— 小图 → 原图 → 显式占位，源变化自动复位。`LazyImage` / `AssetNode` / `ChatMarkdown` 全部接入。配套后端语义：`handleThumbnail` 对「源格式不可缩」（webp/avif——Jimp 能读不能写）**302 回原图**（语义 = 本优化不适用，不是错误），只有 resize 真失败才 500。

**contentId 计算入口（前端）**：`contentIdOfBytes` 算 `sha1:<hex>`，与后端 `contentHashName` 同源；文件导入 / 上传替换 / 素材库拖入三入口经它给 `node.data` 写 `contentId`（内联 dataURL/blob 互斥只持 `url`）。落盘结果信封回传 `SaveRemoteResult.contentId` ⇒ **前端不得再自行 fetch 整图重算 sha1**（待收口项见 TD-08-28）。

### 关键边

`filesApi` 模块引用 45（**生产 12**：`api/index` barrel · `resource/{resourceStore,ResourceLibrary,ResourcePreview}` · `generate/GeneratedView` · `image/{editors/OverlayEditor,nodes/ImageBoxNode,useImageHoverActions}` · `video/{lib/videoEngine,depthVideo/DepthVideoModal}` · `videoEditor/engine/services/storage/service` · `director3d/d3dPersistence`；**测试 33**）；
`sendToResourceLibrary` 全仓**仅 2 个调用点**（`AssetNode` / `ImageGenerate`）——`VideoGenerate` / `TextGenerate` **无发送按钮**（剧本盒走另一函数 `localizeAndStoreToResourceLibrary`）。

---

## 六 · 画布 / 节点链路

**一句话**：节点注册 / 默认 / 编组 / 派生 / 历史 / 懒加载 / 拓扑触发，是「节点怎么上画布、怎么联动」的骨架。

### 现状

```
canvas/shell/NodePalette（**纯 UI 目录**：type/label/icon/cat/component，buildNodeTypeComponents 单源派生 nodeTypes）
canvas/contract/nodeDataSchema（**新建 data 初值真源** NODE_DATA_DEFAULTS + defaultNodeData）
canvas/contract/nodeDefaults（**结构默认**单源 + INPUT_PANEL_NODE_TYPES）
canvas/contract/canvasSnapshotSchema（**落盘保留白名单** NODE_KEEP/EDGE_KEEP + sanitizeSnapshotNodes/Edges）
canvas/contract/nodePrefs（参数记忆，KV yimao_node_prefs）
canvas/structure/groupNodes（编组/拖拽落组/级联删/克隆）· canvas/structure/deriveNodes（建子节点+连线原子快照 spawnAndCommit）
canvas/structure/historyStack（撤销纯类）· canvas/structure/CanvasEdgesContext（history 注入通道）
canvas/shell/lazyNode（重节点懒加载 + 端口占位契约）· canvas/topology/upstreamLink（拓扑自动触发）· canvas/toolRegistry（画布 AI 工具）
canvas/shell/canvasContextMenu（右键三态纯配置）· canvas/structure/ArrangeConfirm（整理确认 UI）· canvas/shell/lod（LOD 性能降级）
canvas/topology/useCanvasEventSubscriptions（3 全局订阅收拢）
生成触发入口：src/hooks/useGenerateNode（节点编排 start/模型，委托 src/hooks/useNodeGeneration，见 §一）
```

**三张表别混**：`NodePalette` = 纯 UI 目录 · `nodeDataSchema.NODE_DATA_DEFAULTS` = 新建 data 初值 · `nodeDefaults.NODE_TYPE_DEFAULTS` = 结构默认（新建与快照还原都补）。落盘保留白名单见 `canvasSnapshotSchema`。`interface XxxData` 与 `NODE_OUTPUTS` **不派生自** data 表，由 `check:node-data --strict` 机器对账。
**唯一入口**：`node.data` 写回 = `useNodeData.patchNodeDataById` · 节点 id = `idGen.generateId` · 端口真源 = `contracts.NODE_HANDLE_CONTRACT`（一致性由 `scripts/check-node-handles.mjs` 对账）。
**上画布**：素材 / 文本 / 图片 / 节点组统一收口 `src/hooks/useAssetDropPaste.ts`（+ `useGlobalPaste`），全部经注入的 `App.addNode` 建节点，无旁路。
**写语义**：`yimao_node_prefs` = 以存储最新为基准合并 patch（`mergeNodePrefs`），defaults 不落盘；KV 删除 = 键与版本同删。
**group 显示名**：唯一字段 `data.label`（建组与加载迁移双向收敛）。

### 关键边

`nodePrefs` ← App / AssetNode / ImageGenerate / TextGenerate / VideoGenerate / useScriptBoxEngine；
`CanvasEdgesContext` ← App + 8 节点；`deriveNodes` ← 8 节点 + `video/depthVideo/spawn.ts`；
`NODE_HANDLE_CONTRACT` ← `App.tsx`（补存量坏边 handle + addNode connection）+ `lazyNode.tsx`（占位骨架端口）。

### 上游产出（读侧）三张表 + 特判集

`src/hooks/useConnectedInputs.ts`：
① `SINGLE_OUTPUT_FIELDS`（单 URL 产出，**字段名由写侧显式声明**：assetNode/imageGenerateNode→`assetUrl`、videoGenerateNode→`videoUrl`、panoramaNode/director3dNode→`assetUrl`）；
② `NODE_OUTPUTS`（复合产出：scriptBoxNode 多端口 / imageBoxNode 多图 / videoExtract·gridSplit·gridMerge 的 `extractedImages[]` 归一；gridSplit 的切片值已物化为 `/files/` 持久 URL，不再进快照）；
③ `NO_OUTPUT_NODE_TYPES`（group / ghostTarget / faceMosaicNode / loopNode / videoProcessNode —— 无自有产出，结果经 spawn 子节点交付）；
④ `SPECIAL_OUTPUT_TYPES`（textGenerateNode 读 node.id 特判）。
调度序 = 无产出 → 单 URL → 复合 → 特判 → **安全网**；`genericOutput` 只服务未登记类型，不承担契约。覆盖性 = `uncoveredOutputNodeTypes()`（纯函数 + 单测 + dev 告警）。

---

## 七 · 提示词链路

```
提示词输入/引用：canvas/shell/PromptInput（画布节点输入控件）· canvas/shell/promptMention（纯函数）
  · prompt/PromptHub + prompt/promptHubStore（**左栏提示词页签 = 独立域** · 唯一可写源）
  canvas/shell/promptChips（芯片序列化唯一入口；生成端 resolvePromptChips 把 @{id:label} 解析回纯文本+参考图）
创作库（5 分区：风格/滤镜/运镜/MJ码图/我的提示词）：
  creative/CreativeLibrary.tsx（半屏壳 + 分区切换）· CreativeLibraryButton.tsx（节点薄入口）
  creative/views/PresetGridView.tsx · MjStyleBrowser.tsx · PromptPresetView.tsx
  creative/creativePresets.ts（纯逻辑：命名空间/字典GC/裁剪） · creative/creativeCatalog.ts（catalog 归一化）
  creative/data/creativeCatalog.json · creative/data/mjStyleCatalog.json（数据真值，随包只读）
  creative/promptManager.ts（「我的提示词」本地库，可增删）
```

**关键边**：
- `canvas/shell/PromptInput` ← 节点（PromptInput.onReady 上抛 `handleExternalInsert`，创作库胶囊经它在**光标处**插入）。
- `creative/creativePresets.ts` ← `creative/creativeCatalog.ts`（catalog JSON → `CreativePreset`，补 `cp_` 前缀）。
- catalog 取用唯一入口：`catalogByKind(kind)`（返回模块级常量引用，可作 memo deps；`CatalogKind` 联合保证穷尽）← `CreativeLibrary`（分类 pills + grid 过滤）· `MjStyleBrowser`。禁再手写等价 `Record<kind, presets>`。
- `creative/promptManager` ← `creative/views/PromptPresetView`（第 5 分区，复用既有存储键 `yimao_preset_prompts`）。
- 合成替换：生成端 `resolvePromptChips(raw, refImages, refTexts, data.creativePresets)`——胶囊 `@{cp_id:name}` → 命中替换为该条 `prompt` 片段；未命中置空但留 `⚠缺失预设「名」` + 红日志（I1/I2，禁静默吞）。
- 落字典：节点 `handleCreativeApply(item: CreativePreset)` → `insertMention`（落胶囊）+ `addCreativePreset(id, toDictEntry(item))`（写 node.data，entry 形态唯一真源 = `creativePresets.CreativePresetEntry`）
- 字典 GC：`normalizeChipFieldWrite(data, patch)`（`creativePresets.ts` 纯函数，内部走 `syncCreativePresets`）只留被 `cp_*` 胶囊引用的键 —— 接在写 data 的**两条**路径（界面 `useNodeData.patchData` / Agent `canvasHost.updateNodeData`）

**⚠️ 边界**：
- 「我的提示词」唯一可写源是 `creative/promptManager`（localStorage）；4 类 catalog 只读、UI 不暴露增删。
- 胶囊序列化复用 `promptChipRe`（`@{id:label}`）；创作库 id 统一 `cp_` 前缀（下划线，非冒号），与既有素材芯片共用同一正则、零改动。
- 跨模块决策见 `spec/CONTEXT.md` §创作库。

---

## 八 · 编辑 / 查看链路

```
动作入口：image/useImageHoverActions（← image/nodes/AssetNode · image/nodes/ImageGenerate）
编辑器/工具：image/editors/ImageEditor · image/editors/InlineImageCropper · image/editors/FaceMosaicEditor · image/editors/OverlayEditor
            + base/utils/imageCompress · image/lib/imageUpscale · image/lib/faceMosaic · base/utils/media/previewUrl（预览 URL 生命周期唯一出口）
查看器：base/ui/display/ImageZoomDialog（命令式 showModal）· image/editors/PanoViewer（← image/nodes/PanoramaNode）· base/ui/display/VideoThumbnail · base/ui/display/LazyImage
摄影参数：image/editors/cameraParams/*（← image/nodes/ImageGenerate）
产出落盘：编辑器结果统一经 filesApi.showThenPersistInline（唯一「图像入节点落盘」出口）→ 写回节点
canvas 产出：全库 canvas → 图像 dataURL 统一经 core/utils.canvasToImageDataUrl（唯一出口，**产出即校验**）
            ⚠️ 该约束**只有注释与调用方纪律，无机器守卫**（曾加 check-canvas-to-dataurl 闸，同日按用户裁定删除）
```

**⚠️ 别混用**：`image/editors/cameraParams/*`（2D 摄影参数）与 3D 摄影棚 `image/editors/CameraStudioPanel.tsx` + `image/editors/cameraParams/cameraStudio.ts` 是**两套独立功能**（后者见 §九）。

---

## 九 · 3D / 深度视频链路

```
入区边（唯一宿主）：canvas/nodes/Director3DNode ──→ director3d/Director3DOverlay.tsx
  （storageKey = `director3d-project-${nodeId}`；capture 拦指针/滚轮 + `#root pointer-events:none`；出区契约 onExport/onExit/onThumbnail）
   └→ App.tsx（Director3DApp，唯一 export，编排全部状态）
        ├→ Viewport.tsx（Canvas/useFrame）─ models.tsx · primitives.tsx · SceneGizmo.tsx · depth.tsx
        ├→ panels/*（9 文件，单向 fan-in 进 App：Inspector·Timeline·Sidebar→ShotsPanel·GlobalSettingsPanel
        │            ·AssetMenu·CameraAnglePanel·ReferenceOverlay·controls）
        ├→ project.ts（领域真源：常量/归一化/插值 cameraAtFrame/序列化/路径/宽高比）+ tracks.ts · history.ts
        ├→ rig.ts（骨架/关节定义单源）
        ├→ log.ts（base/core/log/logger 薄封装：error/warn 落 /api/logs，debug 受 DIRECTOR3D_DEBUG 门控）
        └→ storage.ts ─ d3dPersistence.ts（工程持久化；contentStore KV + localStorage 回退 + BroadcastChannel）
           · 姿势库 `director3d-custom-poses` → contentStore（backend:local ⇒ 进备份清单；键名真源 = contracts.ts 命名 const；
             原裸 localStorage 直写已收口 2026-09-16，含旧裸键一次性迁移读 · TD-02-36/38/39 已结清）
           · 工程键的**同步启动种子读** = `contentGetLocalMirror`（读 `yimao:` 前缀那份本地镜像；不是 KV 真值）；
             旧 `stageframe-project` 迁移读经 `readLegacyRawKey` ⇒ 本域 storage.ts **零裸 localStorage 访问**（TD-02-42 已结清 2026-09-16）

深度视频（两宿主共用一个 spawn，防漂移）：
  image/nodes/AssetNode · video/nodes/VideoGenerate ──→ video/depthVideo/DepthVideoModal.tsx ─→ video/depthVideo/spawn.ts（唯一派生出口）
  DepthVideoModal ← RUNTIME_MODELS = video/depthVideo/depthUrls.ts（运行时资源 URL 单源 · `/depth-video/*` 历史前缀）
                    · engine.ts（纯逻辑） · loader.ts（运行时装载）

本机模型资产（一模型一目录 localTool/runtime-models/<modelId>/：depth-video · mediapipe · three）：
  localTool/src/paths.ts（getRuntimeModelDir = **物理落点唯一真源**；DEPTH_VIDEO_MODEL_ID = `/depth-video` 别名源）
    ← localTool/src/index.ts::handleRuntimeModelResource（URL→物理根唯一映射；纯 GET；403/400/404 如实）
        ↑ PREFIX_MODELS（`/models/<modelId>/*`）· PREFIX_DEPTH_VIDEO（别名）← utils/localOnlyPaths.ts（本地专属前缀唯一真源，不转发外网）
  base/core/runtimeModelUrl.ts（runtimeModelUrl = **前端取件 URL 唯一出口**，根相对同源）
    ← image/lib/faceMosaic.ts（mediapipe：wasm + blaze_face_short_range.tflite）
    ← director3d/models.tsx（three：xbot-animated-lod.glb，BUILT_IN_MODEL_URL）
  vite.config.ts server.proxy（dev 5180 → 127.0.0.1:18080，使 dev 与 prod 同为根相对同源）
  取件 CLI：localTool/scripts/runtime-model.mjs（list·init·doctor；doctor 委托 fetch-runtime-models.mjs --check）
             · scripts/aliyun-models.py（网盘镜像，<modelId>.zip ↔ /runtime-models/<modelId>.zip）

3D 摄影棚（实体在 image/editors/）：image/editors/CameraStudioPanel.tsx + image/editors/cameraParams/cameraStudio.ts（← image/nodes/AssetNode · image/nodes/ImageGenerate）
  ※ image/editors/PanoViewer 属 2D 全景查看器（← image/nodes/PanoramaNode），归 §八，不在本段
```

---

## 十 · 视频（全量重审）链路

> 本段是**消费 / 契约层**的全量清单；`video/depthVideo/*` 刻意用 `filesApi.uploadFileToLocal` 避开 `uploadResult` 坑。

```
video/lib/videoEngine.ts（uploadResult 失败返 null；crossOrigin 走 setCrossOriginForReadable）
base/utils/captureFrame.ts（跨源读取策略 setCrossOriginForReadable 已下沉 asyncGuard 并 re-export，供全树复用）
director3d/encoderProbe.ts
video/lib/sourceTime.ts（跨域唯一映射原语：时间轴 ↔ 源时刻；剪辑器 8 处采纳、内联 0 处）
src/hooks/useVideoPoster.ts（crossOrigin 接回单点原语，删第二判据）
base/ui/display/VideoThumbnail.tsx（显示组件，preload=metadata 取首帧，不抽帧）
video/nodes/VideoGenerate.tsx（videoUrl 落盘受 01/02 守护，非债）
video/nodes/VideoProcessNode.tsx（uploadResult null → fail 显式报错；GIF 分支走 uploadFileToLocal 落盘；TD-22-19 键盘门）
video/nodes/VideoExtractNode.tsx（crossOrigin 接回单点原语）
videoEditor/engine/core/index.ts（**项目上下文生命周期唯一入口** `releaseProjectContext()`：切/关/新建项目、切场景、退出编辑器、编辑器卸载一律走它，一次重置命令栈/选择/音频/播放/渲染树/媒体/场景/活跃项目）
videoEditor/ui/editor/panels/assets/views/captions.tsx（字幕转写面板：captions → transcriptionService.transcribe → worker）
videoEditor/engine/services/transcription/{service,worker}.ts（transformers.js 浏览器内转写；**模型已落地本机** ⇒ `modelEnv.ts` 指 `/models/whisper-tiny/` 且禁远端）
videoEditor/engine/lib/transcription/caption.ts（字幕分块纯函数）
videoEditor/engine/lib/export.ts（导出单入口）
videoEditor/engine/core/managers/project-manager.ts（工程 CAS + 版本冲突暴露 UI）
videoEditor/ui/editor/export-button.tsx（uploadResult null → toast「导出失败」不 spawn）
videoEditor/ui/editor/panels/assets/views/{stickers,sounds}.tsx（素材数据源已收口：iconify → localTool `/api/iconify/*` 代理（3 处手拼直连收为唯一构造函数 `buildIconSvgUrl`）；音效/音乐 = **自建本地库** `GET /api/sounds/library` 扫 `uploads/sounds/{effects,music}`）
videoEditor/engine/commands/timeline/transition/{add,remove,update}-transition.ts（转场增/删/改走命令栈可 undo/redo；判据单点在 TimelineManager，无效操作不入栈）
videoEditor/engine/timeline/transition-utils.ts · ui/editor/panels/assets/views/transitions.tsx（转场应用失败：邻接阈值 ADJACENCY_EPSILON=0.05s 过严 + 英文提示未本地化；TD-22-49 待用户拍板。批量应用粒度 TD-22-51）
video/depthVideo/*（上传落盘走 filesApi.uploadFileToLocal）
director3d/App.tsx · director3d/panels/Timeline.tsx（MP4 导出走 uploadFileToLocal；TD-22-19 键盘门）
videoEditor/ui/editor/panels/timeline/timeline-element.tsx
videoEditor/ui/editor/panels/timeline/video-thumbnail-strip.tsx
videoEditor/engine/services/storage/service.ts（**载体已收口为单载体** 2026-09-16 · TD-02-35：
  工程本体/列表/活跃 id/素材元数据 = KV 键（键构造唯一真源 base/core/videoEditorKeys.ts，
  素材元数据键 = video_editor_media_meta_{projectId}）· 素材二进制 = localTool /files/ · 偏好/收藏 = contentStore local。
  IndexedDBAdapter / OPFSAdapter / migrations/**（13 文件）与迁移编排已删 —— 剪辑器零浏览器 IDB/OPFS 依赖）
```

---

## 十一 · 配置 / 账户 / 事件总线（横切契约域）

```
base/core/contracts.ts（EVENTS/STORAGE_KEYS/NODE_TYPES/apiRegistry 单一事实来源）
base/core/event/eventBus.ts（subscribe/publish 唯一通道）
base/core/event/toastStore.ts（提示唯一 store）—— 入口分两层，勿混：
  业务代码 → toastSuccess/Error/Warning/Info（语义档，分级默认时长自动生效）
  showToast（底层出口）→ 仅两处：log/degrade.ts（coalesceMs 合并窗口防刷屏）· videoEditor/lib/toast.ts（sonner 适配壳转手 duration）
base/store/appSettings.ts（KEY=app_settings, backend:local）
settings/store/settingRegistry.ts（设置声明表·app_settings 默认值/UI/云同步三派生 SSOT）
settings/store/accountsStore.ts（KEY=yimao_accounts, backend:kv，仍进云同步）
settings/store/providerStore.ts（save 后回写 active_api_endpoint KV 供后端路由）
agent/runtime/agentModelStore.ts（agent_chat_model / agent_history_turns, backend:local）
agent/skill/store/skillRepository.ts（三个键的唯一读写口：agent_skills / agent_skill_enabled / agent_skill_config；
  经门面 `@/components/agent/skill` 对外。**`agent/runtime/skillStore.ts` 转发壳已于 2026-09-22 删除**
  —— 它最后只剩两个订阅键与两个便利函数，面板改走门面后"域外只走门面"这条纪律再无例外）
task/nodeRuntimeStore.ts（纯内存瞬态 map，不落盘）
```

**关键边**：`contracts.ts` EVENTS 被全仓消费（事件名**一律经 `<语义>_EVENT` 常量引用**，TD-08-69；无第二套广播通道）；
`providerStore` ← 22 处；`active_api_endpoint` 已在 STORAGE_KEYS 登记（backend:kv），前端 save 写、后端 `official.ts`/`passthrough.ts` 读做路由（派生缓存，设计权衡非债）。

---

## 十二 · localTool 后端（服务端 `localTool/`）职责与数据流

**一句话**：前端（base/api）只是薄壳，真正的协议执行 / 落盘 / 任务常驻在 localTool 服务端（`:18080`），再直连上游（Lovart 需 VPN）。
**契约互检**：前端 `contracts.ts apiRegistry` ↔ 后端 `router.ts`，由 `check:api` 双向校验。

### 文件分层

- 入口/路由：`localTool/src/index.ts`、`localTool/src/router.ts`、`localTool/src/routes/*`（HTTP 端点层）
- 生成引擎：`src/generateEngine.ts`（relayGenerate / relayChat / relayChatStream）
- 异步任务句柄：`src/relay-poll.ts`（attach + 落库 + 重启恢复；红线：**chat 绝不进 poller**）
- provider 框架：`src/ai-relay/`（protocol/engine 协议注入、generate.ts 各模态能力、providerCatalog/baseUrl/Endpoints、manifests 模型目录）
- 配置/路径：`src/providerConfigStore.ts`（每平台一 JSON）、`src/paths.ts`（文件路径单源）、`src/version.ts`
- 持久化：`src/db/database.ts`（tasks）、`src/db/relaySnapshot.ts`（「有无 relay 快照」唯一实现，供 tasks ↔ relay-poll 共同消费）、`src/utils/fileStore.ts` + `/files/` 落盘、`routes/kv.ts`

### 生成数据流（服务端）

```
前端 generate/lib/relayProxy ─→ POST :18080 /api/generate
   → routes/generate.ts（capability 分流，端点无 fetch/落盘，只透传）
       ├─ chat：generateEngine.relayChatStream(SSE 打字机) / relayChat（同步）
       └─ image/video：relay-poll 注册句柄（submit 即返 taskId，GET attach 收结果；**无取消端点** — ADR-0061）
   → generateEngine → ai-relay/（protocol kit + providerCatalog + generate.ts 能力）
   → 出站：厂商直连 lgw.lovart.ai（Lovart 需 VPN，经 fetchWithProxy 代理）
   → 结果：saveRemoteUrl 落盘成本地 /files/ url（内容寻址 sha1(字节) + contentId 去重，contentId 随 {code,data} 信封回传）→ 统一 {code,data} 回前端
```

> ⚠️ 旧网关（`:9004`）已随 lovart-old 旧轨退役，**不再存在**该环节。

---

## 十三 · hooks 编排层（横切 · 节点 / 画布 / store 写回归口）

```
写回唯一入口：src/hooks/useNodeData.ts（patchNodeDataById/patchNodeById/computePatch*；23 fan-in）
订阅基座：    src/hooks/useStoreSelector.ts（selector+shallowEqual 记忆化，防连坐重渲）
跨窗口冲突：  src/hooks/useCanvasSync.ts（BroadcastChannel + 3s 版本轮询）
画布快捷键：  src/hooks/useCanvasShortcuts.ts · canvas/structure/useCanvasHistory.ts（逻辑下沉纯类）
工具：        src/hooks/useVideoPoster.ts · src/hooks/useAssetDegrade.ts · src/hooks/useLocalToolStatus.ts（ensurePoll 幂等）
产出契约：    src/hooks/useConnectedInputs.ts（33 fan-in，写侧声明，见 §六）
建边/改名：    src/hooks/useDisconnectSource.ts · src/hooks/useEdgeData.ts
生成链路：    src/hooks/useGenerateNode.ts · src/hooks/useNodeGeneration.ts（见 §一）· scriptbox/useScriptBoxEngine.ts
素材落画布：  src/hooks/useAssetDropPaste.ts · src/hooks/useAssetDragToCanvas.ts · src/hooks/useResourceMoveToFolder.ts
改名/重命名： src/hooks/useNodeRename.ts
欠深审：      src/hooks/useNodeField.ts · src/hooks/useNodeExpanded.ts
有债待还：    src/hooks/useArrangeCanvas.ts（TD-04-28 已收口：三写走 withNodeSize）· src/hooks/useFitNodeRatio.ts（非债）· canvas/shell/useContextMenu.ts（非债）
```

**关键边**：`useNodeData` ← 23 处；`useConnectedInputs` ← 33 处；`useStoreSelector` ← 全 store 原子订阅基座；`useCanvasSync` ← App 单点。
`useNodeData.patchData` 是 `node.data` 写回唯一真源，绕行者由 `check:arch` 规则 5（覆盖全 src、豁免 agent/）拦截。

---

## 十四 · 导出 / 备份（项目文件导入导出）

```
backupStore.exportAll/importAll/backupToBlob（**v3 · 三段全部派生，不手写清单**：
    ls     = contracts.getLocalKeys()（登记即进备份）
    canvas = 各项目快照，走 projectStore 写路径（保 sanitize / 空画布跳过不变量）
    kv     = 「localTool GET /api/kv/keys 实际存在的键」∩「contracts.getKvKeyPatterns() 模板」
             ⇒ **新工程域登记即自动进备份（0 行接入）**；后端默认已排除 CAS 元数据 `<key>_version`
    kvKeys 失败**上抛**（不降级成空）＝ 禁产出"看似成功"的残缺包；importAll 有 type/version 守卫 + failed 明细）
  → useCanvasEventSubscriptions（project:export/import 事件接线）（区分预检拒绝 / 部分失败）
  → ProjectSelector（纯触发壳） · contracts.getLocalKeys/getKvKeyPatterns · localToolApi.kvKeys（→ localTool /api/kv/keys）
    · projectStore I/O · contentStore                                    【TD-02-30 结清 2026-09-16】
```

---

## 十五 · 横切登记（无独立数据流，只有文件清单）

### 15.0 「唯一」的两档 —— 哪些撞了会红、哪些只是纪律（**读上文任何「唯一」前先看这里**）

本文档有 **60 处「唯一」**。它们**不等价**，分两档（2026-09-20 建此表，纠「唯一疲劳」：
喊了 60 遍之后，读者无法分辨哪条是红线、哪条只是约定）：

**A 档 · 有闸守（撞了当场红，可放心依赖）**

| 唯一对象 | 守它的闸 |
| --- | --- |
| `core/contentStore`（存储唯一入口）· KV 键禁同步读 · 存储键禁裸字面量 | `check:arch` 规则 6 / 7 / 15 |
| `core/event/eventBus`（广播唯一通道） | `check:arch` 规则 10 |
| `agent/canvas/agentCanvasHost`（AI 写画布唯一入口） | `check:arch` 规则 3 |
| `hooks/useNodeData` 的 `patchNodeById`/`patchNodeDataById`（node 写回唯一） | `check:arch` 规则 5 |
| `base/storage` 唯一入口（禁深路径）· `projects` 键唯一写点 | `check:arch` 规则 8 / 9 |
| `EVENTS` / `STORAGE_KEYS` / `NODE_TYPES` / `apiRegistry`（登记表唯一真源） | `check:events` · `check:keys` · `check:node-types` · `check:api` |
| `NODE_HANDLE_CONTRACT`（端口真源）· node data 形状 | `check:node-handles` · `check:node-data` |
| `base/utils/assetType` EXT_KIND · `core/utils.fileNameFromUrl`（媒体类型/URL 解析真值源） | `check:arch` 规则 13 |
| `base/utils/net/asyncGuard` · `genErrors`（异步超时 / 错误分类唯一入口） | 类型层（`HttpRequestOptions.timeoutMs` 必填，见 ADR-0035） |
| uploads 落盘目录 ⊆ 登记表 | `check:upload-dirs` |

**B 档 · 只有注释与调用方纪律（撞了**不会**红 —— 改这些地方要格外小心）**

| 唯一对象 | 为什么没有闸 |
| --- | --- |
| `core/utils.canvasToImageDataUrl`（canvas 产出唯一出口） | 曾加 `check-canvas-to-dataurl`，同日按用户裁定删除（判据可靠性不足）⇒ 现靠纪律 |
| `filesApi.showThenPersistInline`（图像入节点落盘） | 消费者仅 1 文件（4 处），未达建闸门槛 |
| `filesApi.saveResultToTasks`（生成结果落盘） | 调用点在 `generationOrchestration` 契约内一步（结构上已难绕过，无需闸） |

> **怎么用**：本文档某处标「唯一入口」时 —— 先在上表 A 档找它；**找不到 ⇒ 它在 B 档**（纪律，不是红线）。
> 新增「唯一」时**顺带在本表登记**：有闸的写闸名，没闸的写进 B 档并说明为何不建闸。

> 以下四段**没有自己的数据流**，是横切工具 / 地基的覆盖度登记。链路视角看它们时，只把它们当"节点"。

### 15.1 utils 工具层（横切纯函数 · `base/utils/`）

```
net/asyncGuard.ts（loadImageOrNull 收口私有实现 + **跨源裁决单点** setCrossOriginForReadable）· net/clipboard.ts（复制/清洗/下载统一出口）· net/externalizeInline.ts
providerModels.ts（buildAllModels/resolveProviderModel 单源）
media/assetType.ts（EXT_KIND 单源 · resolveAssetType/classifyAssetUrlKind/detectFileType）· media/assetUrl.ts（URL 归一）· media/previewUrl.ts（预览 URL 生命周期唯一出口）· media/useImageFallbackSrc.ts（小图→原图→占位）· media/useMediaLoadFailed.ts
captureFrame.ts（跨源读取策略 re-export）· imageCompress.ts · genErrors.ts（错误分类）· uploadDirs.ts（subfolder 中央表）
（本层已按域归位：搬走的件一律查 §十六）
```

### 15.2 base/core 横切基础设施

```
config.ts · idGen.ts · utils.ts · nodeSizePatch.ts · videoEditorKeys.ts（键构造唯一真源，见 §十）
log/logger.ts（唯一日志出口）· log/degrade.ts（reportDegrade 全对象形态）· log/backendLogStream.ts
event/eventBus.ts（唯一通道，见 §十一）· event/confirmStore.ts · event/toastStore.ts
interaction/modalLayer.ts · interaction/uiHooks.ts（TD-04-28 已收口：三写走 withNodeSize）· interaction/editorSession.ts
contentStore.ts / contracts.ts → 属 §三 / §十一 深审，此处不重复
（本层已按域归位：搬走的件一律查 §十六）
```

### 15.3 base/ui 叶组件库（`base/ui/` 三分：form · feedback · display）

```
form/ModelSelect.tsx（共用 DropdownPanel/DropdownRow 窄原语，单一真源）· form/DropdownPanel.tsx · form/DropdownRow.tsx
form/Toggle.tsx · form/InlineNameInput.tsx（面板内联改名/建夹输入条）
feedback/RenameDialog.tsx · feedback/ErrorBoundary.tsx · feedback/ConfirmContainer.tsx · feedback/ToastContainer.tsx
display/LazyImage.tsx · display/ImageZoomDialog.tsx（命令式 showModal）· display/VideoThumbnail.tsx
JianyingIcon.tsx（域内共用图标）
（本层已按域归位：搬走的件一律查 §十六）
```

### 15.4 审计工具链治理（元层）

```
knip（死代码检测）→ 并进主工程
  ├→ package.json devDependency `knip`（随 npm ci 可装）
  ├→ 根 knip.json · scripts/check-dead-code.mjs（基线「永不复涨」）
  ├→ scripts/dead-code-baseline.json（存量基线 · knip 6.35.1）
  ├→ scripts/gates.manifest.json::dead-code（phase=push → 本地 pre-push 自动跑）
  └→ .github/workflows/ci.yml `npm run check:push`（本地 pre-push 与 CI 跑同一份清单、各一次）
scripts/check-arch.mjs（架构规则**唯一落点**：循环依赖/分层/唯一入口/裸写 node 字段/KV 同步读/深路径）
~~scripts/check-silent-catch.mjs（静默吞闸 · 豁免通道收口为 catchOk.ts 登记表白名单）~~ → **已删除 2026-09-17**（含 `catchOk.ts` · 见 `docs/adr/ADR-0011`；禁静默吞退回判据层，无机器闸）
scripts/debt.mjs（债务账本读写唯一入口）
scripts/probe.mjs（先红后绿探针执行器：注入 → 跑 → 断言 → 自动还原）
scripts/check-gate-vitals.mjs（元层闸：扫描根存在性 + 基数自检 + 在册闸脚本必带【申诉口】三问 · 2026-09-24 合并原 check-gates.mjs）
scripts/check-node-handles.mjs（端口契约单源 + 规则 3 扫**全部**节点落点；豁免按契约派生，不按路径清单）
scripts/check-node-data.mjs（node data 形状对账 + 未登记件自检；落点经 node-file-resolver）
scripts/node-file-resolver.cjs（**节点组件落点唯一真源** · .mjs/.cjs 共用）
scripts/symbol-defs.cjs（**符号定义处解析**：架构闸豁免按定义关系推 · 定义数 ≠ 1 即红灯）
docs/audit-archive/*.md（历史报告归档保留，非活配置）
```

> 退役边界：depcruise / madge 的能力已被 `check-arch.mjs` 覆盖 → 不并；oxlint 与 eslint 重叠 → 不并；jscpd 无迫切性 → 不并；ast-grep 是重写执行器非闸 → 不并。

---

## 十六 · 已退役 · 已改名（全文唯一一份）

> 读到旧名 / 找不到某模块时先查这张表。**只写"旧 → 新"，不写日期与原因**（原因在 `daily/架构日志/`）。

### 已改名 / 已迁移

| 旧 | 新 |
| --- | --- |
| `nodes/PromptNode` | `image/nodes/ImageGenerate.tsx` |
| `nodes/TextNode` | `text/TextGenerate.tsx` |
| `nodes/DiscountVideoNode` | `video/nodes/VideoGenerate.tsx` |
| `prompt/PromptLibrary` | `creative/views/PromptPresetView` |
| `prompt/PromptLibraryButton` | `creative/CreativeLibraryButton` |
| `prompt/promptManager` | `creative/promptManager` |
| `nodes/ImageNode` | `image/nodes/ImageGenerate.tsx` |
| `panels/AssetLibrary` | `resource/ResourceLibrary.tsx` |
| `panels/MaterialStrip` | `canvas/shell/ResourceStrip.tsx` |
| `nodes/TemplateNode.tsx` | `canvas/nodes/_template/`（参考蓝本，非活节点，不占 registry） |
| `nodes/{ImageGenerate,TextGenerate,VideoGenerate}` | `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` |
| `base/prompt/{PromptInput,promptChips,promptLayout,promptMention}` | `canvas/shell/`（画布节点输入控件） |
| `base/prompt/{PromptHub,promptHubStore}` | `prompt/`（左栏提示词页签 = 独立域） |
| `base/panels/{ResourceStrip,NodePalette,lazyNode,lod,canvasContextMenu}` | `canvas/shell/` |
| `base/{panels,utils}/*` 画布部件（NodeShell · NodeTitle · ToolbarButton · GenerateButton · GeneratingOverlay · ExpandablePanel · ResizeFullscreenHandle） | `canvas/parts/` |
| `base/ui/attachmentCover.tsx` | `agent/panels/attachmentCover.tsx` |
| `base/editors/*`（10 件） | `image/editors/`（图片能力的工具，非独立域） |
| `base/api/{generate,pollTask,relayProxy}.ts` · `base/store/generationOrchestration.ts` · `base/utils/imagePixel.ts` | `generate/lib/` |
| `base/media/canvasNodesBridge.ts` · `base/utils/media/nodeMedia.ts` · `base/core/canvasSyncBus.ts` | `canvas/lib/` |
| `base/media/libraryBrowse.ts` | `resource/libraryBrowse.ts` |
| `base/store/{nodeRuntimeStore,taskCompletionBus}.ts` | `task/` |
| `base/core/agentKeys.ts` | `agent/runtime/agentKeys.ts` |
| `base/store/{agentModelStore,skillStore}.ts` · `base/utils/volumePolicy.ts` | `agent/runtime/` |
| `base/{store,utils}/*` 设置类（settingRegistry · accountsStore · providerStore · providerUrlAdapters） | `settings/` |
| `base/utils/{videoEngine,sourceTime}.ts` | `video/lib/` |
| `base/depthVideo/*` | `video/depthVideo/*` |
| `base/utils/{imageUpscale,faceMosaic}.ts` | `image/lib/` |
| `base/utils/{asyncGuard,clipboard}.ts` | `base/utils/net/` |
| `base/core/{degrade,logger,backendLogStream}.ts` | `base/core/log/` |
| `base/core/{confirmStore,toastStore,eventBus}.ts` | `base/core/event/` |
| `base/core/{modalLayer,uiHooks}.ts` | `base/core/interaction/` |
| `base/utils/arrangePack.ts` | `canvas/structure/arrangePack.ts` |
| `canvas/backupStore.ts` | `base/store/backupStore.ts`（回迁） |
| `canvas/parts/JianyingIcon.tsx` | `base/ui/JianyingIcon.tsx` |
| `base/panels/creative-library.css` | `creative/creative-library.css` |
| `base/panels/ImportMediaModalHost.tsx` | `videoEditor/ImportMediaModalHost.tsx` |
| `base/ui/Select.tsx` · `base/ui/ContextMenu.tsx` · `base/ui/CometParticles.tsx` | `scriptbox/Select.tsx` · `canvas/shell/ContextMenu.tsx` · `canvas/edges/CometParticles.tsx` |
| `base/ui/*.tsx`（select 类叶件） | `base/ui/form/` · `base/ui/feedback/` · `base/ui/display/`（三分） |
| `localTool/src/relay.ts` | `localTool/src/generateEngine.ts` |
| `localTool/src/providerConfig.ts` | `localTool/src/providerConfigStore.ts` |
| `localTool/src/ai-relay/generate/index.ts` | `localTool/src/ai-relay/generate.ts` |
| `base/utils/assetUrl.ts · base/utils/assetType.ts` | `base/utils/media/`（判型 / URL 收敛） |
| `base/core/api` | `base/api` |
| `canvas/nodeDataSchema · canvas/nodeDefaults · canvas/canvasSnapshotSchema · canvas/nodePrefs` | `canvas/contract/`（画布数据契约） |
| `canvas/groupNodes · canvas/deriveNodes · canvas/historyStack · canvas/CanvasEdgesContext · canvas/ArrangeConfirm` | `canvas/structure/` |
| `canvas/upstreamLink · canvas/useCanvasEventSubscriptions` | `canvas/topology/` |
| `hooks/`（整体 → `src/hooks/`，移出 components；特例：`useCanvasHistory`→`canvas/structure/`、`useScriptBoxEngine`→`scriptbox/`、`useContextMenu`→`canvas/shell/`） | `src/hooks/` |

### 已删除 / 已并入

| 已删 | 现状 |
| --- | --- |
| `genIntent.ts` | 0 引用退役 |
| `chatApi.ts` / `imageApi.ts` / `videoApi.ts` | 并入 `generate/lib/generate.ts` 单门面 |
| `store/assetStore.ts` | 已删除；素材库域由 `resource/resourceStore.ts` 承接 |
| `utils/resultUrlExtractor.ts` · `utils/mediaType.ts` · `utils/refToken.ts` | 0 生产引用 / 0 定义；判型收口 `base/utils/media/assetType.ts` |
| `agent/runtime/runModeRegistry.ts` | 整模块删除；执行模型恒 `auto`（`runMode`/`workMode` 仅剩历史注释，**禁因注释恢复**） |
| `agent/runtime/workflowRuntime.ts` | 删除（第二真相） |
| `store/kvStore.ts` 的读写实现 | 折叠进 `core/contentStore`；re-export 壳随后亦删除（CANVAS_STATE_PREFIX 改由 `core/contracts.ts` 直供） |
| 旧网关 `:9004` | 随 lovart-old 旧轨退役；localTool 只直连 `lgw.lovart.ai` |
| `api/localToolApi` 的文件域成员 | 迁入 `api/filesApi`（文件域唯一单点）；`localToolApi` 回归纯 CRUD + kv + providers |
| `applyResourceIdentityChange` / `rewriteUrlReferences` | 全仓无定义（仅注释残留）；改名/移动改 context-only |
| `EVENTS['resource:renamed']` | 已删 |
| `yimao:remove-edge` 事件 | 死事件删除（删边实走 `deleteElements`→`onDelete`） |
| `audit/` 沙盒 | 退役；唯一未覆盖能力（knip）已并进主工程闸体系 |
| 任务中心「再来一次」入口 | 已删（不接 retry 注册） |
| `uploadResult` 的 blob 伪造 | 失败返 `null`（错误透传） |
| `spec/TECH-DEBT.md` | 已废弃（只读、禁追加） |
| `videoEditor/export/pipeline.ts` | 分解进 `videoEditor/engine/lib/export.ts` 等（导出单入口；判别联合 `OpResult`/`AudioOutcome` 已撤销） |
| `videoEditor/data/projectRepository.ts` | 并入 `videoEditor/engine/core/managers/project-manager.ts`（工程 CAS） |
| `videoEditor/panels/dock/useEditorExport.ts` | 并入 `videoEditor/ui/editor/export-button.tsx`（失败返 `null` → toast「导出失败」） |
| `POST /api/generate/:id/cancel` · 前端 `relayCancel` · 契约登记 `generateCancel` · 剧本盒 `onStopScriptItem` | 全链已删（ADR-0061：生成链路不提供中止入口）；后端 `cancelGenerateTask` 保留但**无生产调用方**（仅测试观测点） |

---

## 十七 · 怎么用

- 想 trace「一条链路从哪来、走哪、落哪」 → 本文件
- 想确认「某文件实际被谁 import / 依赖谁」 → `node scripts/mv-sync-refs.mjs refs <file>`
- 想改某个域的行为（生成 / 存储 / 资产 / 画布 / 提示词 / 编辑 / 3D / 视频） → 按本索引该链路的文件清单逐个看**文件头注释**再动
- 想知道「这条链路为什么变成现在这样 / 某结论被推翻的过程」 → `spec/DATAFLOW-HISTORY.md`，或真源 `daily/架构日志/<NN>-<区域>-<日期>.md`
- 想改**本文件** → 先读 §维护规矩（禁写清单）
