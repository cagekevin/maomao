# spec/DATAFLOW-HISTORY.md · 数据流索引的修订留痕（只读归档）

> **这是什么**：`spec/DATAFLOW.md` 从 2026-09-04 到 2026-09-14 之间累积的 `> 更新(<日期>, refs实证): ...` 叙事段，**原文机械搬迁**到此，零信息丢失。
> **为什么搬**：DATAFLOW 的定位是「**当前真相**的一页图」。历史叙事长在同一文件里，会让读者必须自己做考古才能分辨哪句已作废（同一段里同时存在作废结论与现行结论）。现状与历史分离后，DATAFLOW 只剩现状。
> **怎么用**：只想改代码 → 读 `spec/DATAFLOW.md`（现状）+ 文件头注释。想知道"这条链路为什么变成现在这样 / 某结论被推翻的过程" → 查本文件，或去看**真正的真源** `daily/架构日志/<NN>-<区域>-<日期>.md`（那里的覆盖度表是灯的唯一真源）。
> **性质**：**只读**。后续任何链路变更**不再往这里追加** —— 写进 `daily/架构日志/`，`spec/DATAFLOW.md` 就地把现状图改对即可。
> **效力**：本文件内容**不具有现行效力**。与 `spec/DATAFLOW.md` 冲突时，**一律以 `spec/DATAFLOW.md` 为准**。

---

## 一、生成链路

> 更新(2026-09-05, refs 实证)：下述结构为 2026-09-04 L3 收口后现状。`genIntent.ts` 已零引用退役；`chatApi/imageApi/videoApi` 三门面已并入单文件 `api/generate.ts`（内部 generate() + 具名导出）——**不再存在**，勿回找。画布节点实际入口为上层 hook `useGenerateNode`（它委托 `useNodeGeneration`）；另有**第二生成入口** `scriptbox/scriptBoxEngine.ts` 不经过 useGenerateNode、直接消费 generate 门面 + 自拼 reportGenerate 契约（旧版文档只画了一条节点链，漏此支线）。

- 注：不接 useNodeGeneration 的 retry 注册（任务中心「再来一次」入口已于 2026-09-12 删除）

> 更新(2026-09-11, refs实证): 原「utils/resultUrlExtractor ◄── useConnectedInputs」已删——该模块 0 生产引用，判型已收口 mediaType.ts，rendering URL 走后端 /files/ 直返契约。useConnectedInputs 实际 import mediaType.resolveMediaType。

---

## 二、AI 助手（Agent）链路

> 更新(2026-09-11, refs 实证)：**新增本段**。此前 AI 助手仅在上方生成链路段以两行脚注出现（`agentRuntime → chatStream` / `contextCompression → chatCompletions`，**均仍真，未删**），但缺整个会话状态层 / 工具层 / 表格子系统的数据流描述，此处补齐。审计视角见 `daily/架构日志/11-AI助手-2026-09-11.md`。

> 更新(2026-09-11, refs 实证)：`agent/runtime/runModeRegistry.ts`（三态执行模型注册表）**已整模块删除**（`ls` 实测不存在），执行模型收敛恒 `auto`，全仓 `runMode|workMode` 仅剩 6 条历史注释（属留痕，禁因注释恢复模块）。

---

## 三、存储 / 持久化链路

> 更新(2026-09-05, refs 实证)：下述为 2026-09-04「存储中间层折叠」(commit 5afe1f3) 后现状。`kvStore.ts` 的 `storageGet/Set/Delete + isKvKey + tryParse` 已折叠进 `contentStore`（src 侧唯一消费者即它，是纯转发中间层），`kvStore.ts` 现为 **re-export 壳**（仅 `CANVAS_STATE_PREFIX` + `kvGet/kvSet/kvDelete` 转发，不再参与读写链路）。KV 路由判定唯一收口到 `contentStore.resolveBackend`（三段式：登记键 → pattern → 启发式兜底），KV 降级策略（写失败落本地副本 + reportDegrade / 成功清副本）内联为 `writeKvWithFallback`/`readKvWithFallback`/`deleteKvWithFallback`。有意不收口保留裸调 sGet/sSet 的 2 处例外：`conversationState.ts`（KV 迁移回读旧 local）、`d3dPersistence.ts`（KV 主通道+本地副本双通道）。

> 更新(2026-09-11, refs 实证)：① `contentStore` 实证 import 数 **41 处**（原写 38，+3，随 8 月末后新增 store 接入而涨，属健康增长、非泄漏）；② `taskStore` 真实路径为 `src/components/base/store/taskStore.ts`（本文件 line 23/64/65 的 `store/taskStore` 为相对简写，勿回找 `src/store/`）；③ 存储「有意不收口保留裸调」的 2 处例外中，**`d3dPersistence.ts` 例外已失效**——2026-09-11 方案A（TD-7）已把它收编进 `contentStore`（`contentSetKvWithFallback`/`contentGetKvWithFallback`），不再裸调 `kvGet/kvSet/sGet/sSet`；现仅剩 `conversationState.ts`（KV 迁移回读旧 local）1 处例外。

> 更新(2026-09-12, refs 实证, 二轮深扫)：**修正上述「KV 裸 import 仅存在于 contentStore 内部」的表述——不成立**。`grep kvSet|kvGetVersion` 实测另有 2 处业务侧直调 transport：`store/projectStore.ts:458` 的 `kvSet(key, value, {ifVersion})`（画布快照 CAS 写）+ `projectStore.ts:306/308/312`、`hooks/useCanvasSync.ts:82` 的 `kvGetVersion`（版本读/3s 冲突轮询）。即**画布快照「写」绕过 contentStore 唯一入口（读仍走 `contentGetAsync`、删走 `contentDeleteAsync`）**，导致该键的 KV 降级链（写本地副本 + reportDegrade）从未生效，而读端仍会去读一个永远为空的本地副本（半截降级链）。根因：contentStore 缺「CAS 条件写 + 版本读」原语（`writeKvWithFallback` 会把 409 冲突误当引擎不可用降级，语义错）。TD-02-1。`conversationState.ts` 的 1 处裸 `sGet` 例外仍有效（另见区域 02 二轮深扫文件 §一）；`contentStore` import 数 41 复核不变（22 src + 19 tests）。

> 更新(2026-09-12, refs 实证, TD-02-1 已收口)：上述旁路**同日已消除**，现数据流为
> `projectStore`（CAS 基线/单飞/冲突提示，L3 编排）→ `contentStore` 严格族 `contentKvGetVersion` / `contentKvSetCas`（L2：失败分类 + 不降级）→ `localToolApi.kv*`（L1）；`useCanvasSync` 版本轮询同经 `contentKvGetVersion`。
> `contentStore` 现分两族：**尽力而为族** `contentSet/Get/Delete(+Async)`（配置类，引擎不可用才降级本地副本）与**严格族** `contentKvGetVersion/contentKvSetCas`（用户主数据，fail-closed 绝不写副本）；两族共用「失败分类唯一实现 `isEngineUnavailable`（4xx=请求被拒→上抛 / 其余=引擎不可用→降级）」。**真分叉在失败语义，不在后端。** 防回潮：`check:arch` 规则 6（禁绕过 contentStore 直调 kv\*/s\* 底层，白名单 4 类）。

> 更新(2026-09-12, refs 实证, 三轮)：① **就绪度链路（TD-02-2）**：`storageAdapter.isStorageReady()` / `onStorageReady(cb)` 为 L1 新增就绪度原语（非插件环境恒就绪）；`contentStore.loadFromLocal` 未就绪时**返回 undefined 且不写缓存**（杜绝「未加载＝不存在」的粘性假真相）；`projectStore`/`resourceStore`/`appSettings` 三个模块级 eager 读改为「未就绪不回写种子 + 就绪后重读一次」。② **快照 schema 真源（TD-02-7 第一步）**：`base/canvas/canvasSnapshotSchema.ts`（`NODE_KEEP`/`EDGE_KEEP` + `sanitizeSnapshotNodes/Edges`）成为「画布快照保留哪些字段」的唯一物理位置，`projectStore` 只消费；原白名单及其「为什么必须保留 parentId/extent/style/initialWidth/initialHeight」的决策理由一并迁入该模块（projectStore 留指针）。③ 对账工具 `scripts/check-node-data.mjs` 修复三处静默失效（类型标注打断「名 = [」、类型注解里的 `[]` 被 `indexOf` 抢先命中、抹白把字符串字面量抹空导致取不到 `type`）并新增**解析器自检**（任一解析源为空 → 告警且 `--strict` exit 1），`check:node-data --strict` 由「假绿」恢复为可信门禁。

---

## 四、云同步（Cloud）链路

> 更新(2026-09-11, refs 实证)：新增本段。原「存储/持久化」段把 `cloudSync` 列为 contentStore 上层消费者（仍真，未删），但缺独立数据流描述，此处补齐。
> 收敛现状（2026-09-11 审计）：`cloudSync` 是**编排层**，不持有真相（真相在各域 store / contentStore）。
> - [F-云B] `projects` 已入 `SYNC_EXCLUDE`（源头既不传也不收）；删 `restoreLocal` 内 `saveProjects(ls.projects)` 死路径 + `getCurrentProjectId` + `project` 领域开关。projects 跨端真通道仅剩 `projectStore` → localTool `/api/projects` backend + KV 画布快照。
> - [F-云A] `collectLocalData`→`{ls, skipped}`、`restoreLocal`→`{written, failed}`，失败域结构化上抛；`uploadConfig`/`downloadConfig` 不再以 `ok:true` 掩盖（部分失败带 `partial`，全失败 `ok:false`）。
> - [F-云C] `CloudSyncEngine.callGateway` 抛错保留原错误类型/`cause`，不再压平成 message 字符串。

---

## 五、资产 / 素材链路

> 更新(2026-09-12, refs 实证, 区域 03 二轮)：资产段整体刷新。① `store/assetStore` 已删除（全仓 0 文件 0 import），素材库域由 `resourceStore` 承接（区域 12 主审）——旧链路 `store/assetStore ← AssetLibrary/LeftPanel/ImageNode/PromptNode/StepAssets` 已删；② 旧展示实体更名：`panels/AssetLibrary`→`ResourceLibrary`、`panels/MaterialStrip`→`ResourceStrip`、`nodes/ImageNode`→`ImageGenerate`（展示层不逐一点名，见区域 12 续审）；③ `api/localToolApi` 候选 C 后已无文件域成员（仅余迁移注释），文件域唯一单点 = `filesApi`；④ 生成链路段「saveResultToTasks（useNodeGeneration 单点调）」更正——scriptBoxEngine:578 为第二调用方（同一唯一出口，双落盘防线不变）。

> 更新(2026-09-13, refs实证, 区域 12 二轮·实施后复核)：**本段是「实施后」现状，首轮的「设计态」表述作废（未删旧文，仅更正）**。① **落地已实证**：`fileStore.writeUploadBuffer` 由 `Date.now()` 前缀改为内容寻址 `contentHashName(sha1(bytes))`(`fileStore.ts:133/151-152`)；multipart 落盘走 `writeUploadDedup` 按 contentId 全局去重(`files.ts:108-116`)、远程下载按解码字节算 contentId 复用(`files.ts:291-303`)、`upsertResource` 落实「同内容→同行」(`resources.ts:303-340`)；`resources` 表已含 `project_id`(`database.ts:307/323-324`)；`handleResourcesGet` 接 `?projectId`(`resources.ts:376-379`，nullOrEqCols `helpers.ts:227`)。② **改名/移动已改 context-only**：`handleResourcesRename`(`resources.ts:582`)→`applyResourceContextChange`、`handleMove`(`files.ts:466`)→`applyResourceContextMove`，只 `UPDATE name/folder`、**不碰磁盘/不改 url/contentId**；原「物理改名 + 引用改写」入口 `applyResourceIdentityChange` 与 `rewriteUrlReferences` **全仓已无定义**（仅 4 处注释残留），`resource:renamed` 事件已删（`contracts.ts:106-107`）→ **TD-02-13/14 前提消失（改判已解决）**。③ **新缺口（见区域 12 二轮 TD-12-5/6/7）**：`buildResourceRecord`(`resourceStore.ts:261-272`) 静默丢 `projectId` → `resourcesOfProject`(:223) 恒判 legacy、项目隔离**写入链断裂**（`Resource` 未声明 `projectId`、靠 `[key:string]:unknown` 兜底）；`handleResourcesSave`(`resources.ts:426`) 为**第二落盘入口**（`clip-${Date.now()}` 时间戳命名、绕过 `writeUploadDedup`）。灯已按区域 12 覆盖度表就地更新（🟢/🟡/🔴/⚪），**未塞明细**。

> 更新(2026-09-13, refs实证, 区域 12 三轮·深探)：**补一条此前未画的关键相互作用——「context-only 变更」× 「rescan 孤儿判定」冲突（TD-12-8）**。链路：素材卡片拖到文件夹 → `useResourceMoveToFolder`(`src/hooks/useResourceMoveToFolder.ts:114-125`) → `resolveMovePaths`（src 由 **UI `folder`/`name`** 拼，`filesApi.ts:119-127`）→ `moveFile` → `handleMove`(`files.ts:466`) → `applyResourceContextMove`（只 `UPDATE resources SET folder`，`resources.ts:572`；**行定位用 `resourceIdOf(oldRel)`(:563)、无行则静默 return 但回 `ok:true`**）→ `onRefreshed` → `ResourceLibrary.reset(true)`(`ResourceLibrary.tsx:363/188`) → `POST /api/resources/rescan` → **孤儿清理 `path.join(uploadDir, row.folder, row.name)`(`resources.ts:252`) 按已脱钩的 `folder/name` 定位磁盘 → 行被 DELETE**。物理真源仍是不可变 `resources.url`(`resources.ts:190/222`)，落点唯一真源是 `resolveUploadTarget`(`fileStore.ts:80-89`) → `:252` 属**第二份磁盘定位实现**。后果：归类/改名刷新即回弹、`is_favorite` 归零、第二次移动「假成功」。灯已随区域 12 三轮覆盖度表改：`routes/resources.ts 🟡→🔴`、`panels/ResourceLibrary ⚪→🔴`、`hooks/useResourceMoveToFolder ⚪→🔴`、`hooks/useAssetDragToCanvas ⚪→🟢`（**只改灯，未塞明细**）。

> 更新(2026-09-13, refs实证, 区域 12 五轮·TD-12-8 清偿)：**磁盘定位真源改由不可变 `url` 派生（一处真源替换清 3 症状）**。① 后端新增 `relativePathFromFileUrl(url)`（`resources.ts`，非 `/files/` → null）；rescan 孤儿判定改用它（`path.join(uploadDir, relFromUrl)`，folder 型行不参与、url 非本地跳过不误删）。② `resolveMovePaths`(`filesApi.ts`) 改由 `item.url` 派生 src/dst 磁盘路径（payload 携 `url`）；`relativePathFromUrl` 收紧为「必须命中 `/files/`」，与后端同口径。③ `applyResourceContextMove` 无 row → 抛 `HttpStatusError(404)「资源未同步，请刷新后重试」`（不再假成功；用户裁定）。灯：`routes/resources.ts 🔴→🟢`、`useResourceMoveToFolder 🔴→🟢`。先红后绿 probe1（orphan 回退）/probe2（resolveMovePaths 回退）精确红；localTool +4 回归、前端 +5 用例全绿。

> 更新(2026-09-13, refs实证, 区域 12 六轮·TD-12-5 清偿)：**上传落盘即写 resource 行 project_id（项目隔离写入链闭环）**。此前上传只写文件、行由 **rescan** 建 → `project_id` 恒 NULL → 新素材跨项目可见。现：后端新增 `resources.recordUploadedFileRow(rel,{projectId})`（按 contentId 幂等走 `upsertResource`，仅真落盘/显式 projectId 时写），`files.handleUpload` 的 multipart/JSON × file/fileUrl/dataUri 四分支均接 `projectId`；前端 `uploadFileToLocal`/`saveInlineToLocal` 加参、`resourceStore` 三处 + `localizeAndStoreToResourceLibrary` 传 `currentProjectId()`；`ScriptBoxAssetPicker` fetchResources 补 `projectId`。`Resource` 显式声明 `projectId`。

> 更新(2026-09-14, refs实证, 区域 12 八轮·TD-12-10)：**「发送结果」真相归属错位 = 本次排查困难的根（用户归因「复杂度放错位置」）**。`store/resourceStore 🔴` 与 `panels/ResourceLibrary 🔴` 的红灯，现精确指向此：① UI 按钮（`AssetNode.tsx:337`/`ImageGenerate.tsx:533`）在异步落盘完成前同步弹「已发送到素材库」成功 toast；② `sendToResourceLibrary` 当时 `void` 掉落盘 Promise、签名返回 `Resource[]` → 调用方拿不到真相；③ `emitResourceSent`(`resourceStore.ts:417`) 在**落盘前**同步广播 → 面板 rescan 时后端还没有该文件；④ 面板 `onResourceSent` 只 `setFolder`(`ResourceLibrary.tsx:225`)、folder 不变则 effect 不重跑。后果：任何落盘失败（含前后端优化回归）只见成功、库空、零报错。与本仓区域 02「诚实结果契约」/ TD-22-2「错误透传」同母体、本链路未落地。
>
> ⚠️ **本条已被九轮施工就地更正一处读码偏差**：首轮把 `persistUrlToBackend` 读成「为护短而刻意静默」**不实** —— 实测它**早已**返回判别联合 `PersistOutcome`（TD-12-2 落地），失败时 `logger.error('resourceStore','发送到素材库落盘失败',msg)` 留痕；真缺口是**它的结果没被回传调用方**（上面的②），不在它本身。
>
> 更新(2026-09-14, refs实证, 区域 12 九轮·TD-12-10 清偿)：**「反馈权」移回唯一知道真相的那层 + 同母体一并收口**。① `sendToResourceLibrary` 改 `async` 返回 **`PersistOutcome`**（复用 TD-12-2 既有契约，未新造第二份），调用方按 `ok` 决定 toast 时机与真伪；② `emitResourceSent` 移到**落盘成功之后**（面板 rescan 时后端已有该文件）；③ 面板补 `reloadTick`，兜住「已在目标目录 → `setFolder` 同值 → effect 不重跑」的盲区；④ `filesApi` 不动（15 消费方、失败均有 `logger.warn` 留痕，用户可见性由①的判别联合承担）；⑤ **同母体**：「结果就绪信号须被当前可见消费方收到」——`panels/GeneratedView`（生成 tab）此前**零订阅** → 补订阅 `agent:task-completed` 重拉（该广播由 `taskCtl.done` 发出，而 `done` 排在 `saveResultToTasks` **之后**，故触发时结果确已落盘）。灯：`store/resourceStore 🔴→🟢`、`panels/ResourceLibrary 🔴→🟢`、`panels/GeneratedView ⚪→🟢`。先红后绿探针 4 组（返回值契约 / 失败不广播 / 广播晚于落盘 / 生成面板订阅），均精确命中；受影响 8 测试文件 **93 用例全绿**，`tsc` / `check:events` / `check:catch` / `check:any` 全过。
>
> 全库同类普查（本轮 Step 0）：`grep` 全 src 的 success-toast（44 处）逐一核验 → **除上述 2 处外，其余均为「结果驱动」**（在 `await`/`.then` 之后或按返回码分支），无一提前宣告；`generate` 链路（`useNodeGeneration`→`runGenerationContract`）本就无提前声明（失败 `taskCtl.fail` + error toast + 节点 error 态），非同类。⚠️ 另修正八轮一处事实错误：`sendToResourceLibrary` 全仓**仅 2 个调用点**（AssetNode/ImageGenerate），**VideoGenerate / TextGenerate 并无发送按钮**（ScriptBoxEngine 走的是另一函数 `localizeAndStoreToResourceLibrary`）。

---

## 六、画布 / 节点链路

> 更新(2026-09-11, refs 实证)：画布段刷新。① 修正 `nodePrefs` 消费方——真实 fan-in = `App` + `AssetNode`/`ImageGenerate`/`TemplateNode`/`TextGenerate`/`VideoGenerate` + `useScriptBoxEngine`（原写的 `ImageNode`/`PromptNode`/`DiscountVideoNode` **实际 0 import**，已删旧链路）。② 补漏 fan-in：`CanvasEdgesContext` ← `App` + 8 节点（AssetNode/Director3DNode/GridMerge/GridSplit/Loop/Panorama/TextGenerate/VideoGenerate/VideoProcess）；`deriveNodes` ← 8 节点 + `depthVideo/spawn.ts`。③ 端口契约（target/source handle）**已收口为单一真源 `contracts.NODE_HANDLE_CONTRACT`**（2026-09-11 TD-04-1）：节点文件 `NodeShell` prop 声明端口、该表集中登记、`App.tsx` 补边与 `lazyNode` 占位骨架均从它派生；一致性由 `scripts/check-node-handles.mjs`（挂 prebuild/pretest + check:health）对账「节点声明 ⊆ 契约表」，漏登记即红。
> 　　关键边（refs 实证）：`nodePrefs` ← App/AssetNode/ImageGenerate/TextGenerate/VideoGenerate/useScriptBoxEngine（TemplateNode 蓝本亦用 useNodePrefs，但已迁 `nodes/_template/`，非活节点、不占 registry，见 TD-04-5）。

> 更新(2026-09-11, refs 实证, 三轮底层)：① `TemplateNode` 已迁 `src/components/nodes/_template/` 并从 NODE_TYPES/nodePrefs/INPUT_PANEL/NODE_OUTPUTS 摘除（参考蓝本非活节点，TD-04-5）。② 删死事件 `yimao:remove-edge`（App window 监听 + EVENTS 登记，0 发布方；CustomEdge 删边实走 deleteElements→onDelete，TD-04-8）。③ 画布节点生成入口名义已更新为 ImageGenerate/TextGenerate/VideoGenerate（原 PromptNode/TextNode/DiscountVideoNode 为旧名）。④ node.data 写回唯一入口 = `useNodeData.patchNodeDataById`；节点 id 唯一入口 = `idGen.generateId`；端口真源 = `contracts.NODE_HANDLE_CONTRACT`。
> 　　端口契约消费（refs 实证）：`NODE_HANDLE_CONTRACT` ← `App.tsx`（补存量坏边 handle + addNode connection 路径）+ `lazyNode.tsx`（chunk 未到达的占位骨架端口）。

> 更新(2026-09-12, refs 实证, 九轮)：group 显示名唯一字段 = `data.label`（建组源头 `groupNodes.createGroupFromNodes` + 加载迁移 `nodeDefaults.applyNodeTypeDefaults` 双向收敛；旧 `data.name` 在加载时迁移进 label 并清除，不再保留）。整理 `useArrangeCanvas` 对 group 尺寸写回补 `width/height`（与 `style` 同写，对齐 `useNodeResize` 的「width+height+style 三写」不变量，TD-04-16/19）。

> 更新(2026-09-12, refs 实证, 十一轮)：补「素材/文本/图片/节点组**上画布**」入口链路——统一收口在 `hooks/useAssetDropPaste.ts`（`App.tsx` 经 `onDragOver`/`onDrop`/`onPaste` + `useGlobalPaste`（window paste）挂载；`createNodeFromFile` 供右键「上传」复用），**全部经注入的 `App.addNode`（结构默认 + history）建节点，无旁路**（6+ 条路径皆 addNode 调用点，非独立实现）。

> 更新(2026-09-12, refs 实证, 四轮)：画布「数据契约」拆成三张**职责单一**的表，别再混：① `NodePalette` = **纯 UI 目录**（type/label/icon/cat/component/badge；`data` 字段已移出）；② `nodeDataSchema.NODE_DATA_DEFAULTS` = **新建 data 初值唯一真源**（+ `defaultNodeData(type)` 注入 `expanded`，值深拷贝）；③ `nodeDefaults.NODE_TYPE_DEFAULTS` = **结构默认**（新建与快照还原**都**补）。落盘保留白名单见 `canvasSnapshotSchema`（三轮）。`interface XxxData` 与 `NODE_OUTPUTS` **不派生自** data 表（丢类型/关注点不同），由 `npm run check:node-data --strict` 机器对账。

> 更新(2026-09-12, 六轮低息清偿)：① **KV 删除语义** = 键与版本同删（后端 `handleKvDelete` 删 `<key>` + `<key>_version`；`projectStore.deleteProject` 不再手工补删，删除后重建不带旧 CAS 基线）。② **`yimao_node_prefs` 写语义** = 「以存储最新为基准合并 patch」（`mergeNodePrefs`），且**defaults 不落盘**（只存用户改过的字段；defaults 由 `getNodePrefs`/`injectNodePrefs` 读取时补）。③ `director3d` 跨窗口广播通道（`d3dPersistence` BroadcastChannel）**已真正建立**（原恒真守卫使提示静默失效）——同 key 被其他窗口更晚保存时，保存前一次红色 toast + 日志（同 tab 按 tabId 忽略）。④ `backupStore` 的「当前项目」改委托 `projectStore.getCurrentProject()`（内存真相，不再从存储重推导）。

> 更新(2026-09-12, refs 实证, 五轮)：**上游产出（读侧）拆三张表 + 特判集**（TD-02-11，`hooks/useConnectedInputs.ts`）：① `SINGLE_OUTPUT_FIELDS`（单 URL 产出，**字段名由写侧显式声明**：assetNode/imageGenerateNode→`assetUrl`、videoGenerateNode→`videoUrl`、panoramaNode/director3dNode→`assetUrl`）；② `NODE_OUTPUTS`（复合产出：scriptBoxNode 多端口 / imageBoxNode 多图 / videoExtract·gridSplit·gridMerge 的 `extractedImages[]` 归一）；③ `NO_OUTPUT_NODE_TYPES`（group / ghostTarget / faceMosaicNode / loopNode / videoProcessNode —— 无自有产出，结果经 spawn 子节点交付）；④ `SPECIAL_OUTPUT_TYPES`（textGenerateNode 读 node.id 特判）。`getNodeOutput` 调度序 = 无产出 → 单 URL → 复合 → 特判 → **安全网**；`genericOutput`（`assetUrl>videoUrl>resultUrl` 三字段猜测）**降级为只服务未登记类型（存量退役节点快照）的安全网**，不再承担任何契约。覆盖性 = `uncoveredOutputNodeTypes()`（导出纯函数 + 单测 + dev 告警）；`check-node-data.mjs` 的读侧字段解析随之改指向 `SINGLE_OUTPUT_FIELDS`。

---

## 七、编辑 / 查看链路

> 更新(2026-09-12, refs实证/区域06首轮): 补 `FaceMosaicEditor`/`OverlayEditor`/`cameraParams/*`/`previewUrl` 四边（原段漏列）；标注 cameraParams 与 cameraStudio 为两套独立功能（勿混用）；标注编辑器结果唯一落盘出口 `showThenPersistInline`（合成节点 GridMergeNode 尚未纳入，见 TD-06-6）。

---

## 八、3D / 深度视频链路

> 更新(2026-09-12, refs实证/区域07首轮): 原段仅列 3 个文件名、无边，本轮补关键边并更正归属——① 入区边唯一：`nodes/Director3DNode`──→`Director3DOverlay.tsx`（`storageKey=director3d-project-${nodeId}`，出区契约三回调）──→`App.tsx`（唯一 export）；② `App`→`Viewport`（消费 `models/primitives/SceneGizmo/depth`）+ `panels/*` 9 文件单向汇入 + `project.ts`(20 fan-in)/`tracks.ts`/`history.ts` + `rig.ts` 地基；③ 工程持久化 `storage.ts`→`d3dPersistence.ts`（contentStore KV + localStorage 回退 = TD-7 方案A；BroadcastChannel 跨窗口提示 @见 TD-02-3）；④ `depthVideo/*` 两宿主 `nodes/AssetNode`·`nodes/VideoGenerate` 共用 `DepthVideoModal`+`spawnDepthVideoNode`，`RUNTIME_MODELS`(`depthUrls.ts`) 为 URL 单源；⑤ `editors/cameraStudio.ts`·`CameraStudioPanel` 消费方为 `AssetNode`/`ImageGenerate`（@见区域 06）。**更正**：`editors/PanoViewer` 原误列入本段，实为 2D 全景查看器（← `PanoramaNode`），归「编辑/查看链路」。

---

## 九、视频（全量重审）链路

> 更新(2026-09-13, refs实证)：第三轮**全量重审**（区域 22）。前两轮把 Process/Extract/Editor 标「借 21/07 不重审」已推翻——消费/契约层债（跨源、落盘 `persisted`）在 21 引擎内部收口范围之外，须本区独立登记；`base/depthVideo/*`（07）实查健康（刻意用 `filesApi.uploadFileToLocal` 避开 `uploadResult` 坑）。审计视角 `daily/架构日志/22-视频-横切全量-2026-09-13.md`。
> 更新(2026-09-13, 清偿轮·§十四)：TD-22-1/2/3/5 四债结清。`setCrossOriginForReadable` 已导出（crossOrigin 判据 5→1）；`uploadResult` 失败返 **null**（错误透传，删 blob 伪造），消费方 null → 显式报错不 spawn；GIF 产物走 `uploadFileToLocal` 落盘；`data.poster` 死字段已删。全链路灯转绿。

---

## 十、配置 / 账户 / 事件总线（横切契约域）

> 更新(2026-09-13, refs+grep实证)：新增本段。此前配置/账户类 store + 横切契约登记表（EVENTS/STORAGE_KEYS）+ eventBus 不在这张进度地图上（属「其他领域」，区域 13 首审）。审计视角见 `daily/架构日志/13-配置账户与事件总线-2026-09-13.md`。

---

## 十一、localTool 后端（服务端 `localTool/`）

> 更新(2026-09-11, refs 实证)：原「经网关（:9004）到上游」已随 lovart-old 旧轨退役（2026-09-05）删除——localTool 只走直连上游 `lgw.lovart.ai`（relay-poll 常驻轮询 + 落盘 /files/），不再有 9004 网关环节。

> 后端改名记录（2026-09-04）：`relay.ts`→`generateEngine.ts`(生成引擎，与 ai-relay 框架/relay-poll 区分)、`providerConfig.ts`→`providerConfigStore.ts`(用户配置存储，与 ai-relay/providerCatalog 内置目录区分)、`ai-relay/generate/index.ts`→`ai-relay/generate.ts`(摊平单文件目录)。

---

## 十二、hooks 编排层（横切 · 节点/画布/store 写回归口）

> 更新(2026-09-13, refs实证, 14 区首轮)：新增本段。此前 hooks 层散落各业务段（useNodeData 在「画布/节点」、useConnectedInputs 在「画布/资产」），无独立进度节点。审计视角 `daily/架构日志/14-hooks编排层-2026-09-13.md`。

---

## 十三、导出/备份（项目文件导入导出）

> 更新(2026-09-13, refs实证, 区域 15 首轮)：新增本段。此前备份/还原只作 storage 段脚注，从未作主区域审计（数据正确性直接关系用户数据存亡）。审计视角 `daily/架构日志/15-导出备份-项目文件导入导出-2026-09-13.md`。

---

## 十四、工具层（横切纯函数）

> 更新(2026-09-13, refs实证, 区域 16 首轮)：新增本段。横切纯函数工具此前散落各业务段未作主域审计。审计视角 `daily/架构日志/16-utils工具层-横切纯函数-2026-09-13.md`。

---

## 十五、审计工具链治理（元层·其他领域）

> 更新(2026-09-13, refs+grep实证, 区域 17 首轮)：新增本段。审计/腐化检测工具链自身（`audit/` 的 knip/jscpd/oxlint/depcruise/madge）此前不在任何进度节点上（属"其他领域"，区域 17 首审）。
> 更新(2026-09-13, 二轮·TD-17-1 收口)：**audit/ 沙盒已退役**——把**唯一主工程未覆盖**的能力（死代码 knip）**并进主工程闸体系**；其余四件经取证不并。审计视角 `daily/架构日志/17-审计工具链治理-二轮-TD17-1并进主工程-2026-09-13.md`。

> 退役边界（TD-17-1 二轮取证，逐件判必要性）：depcruise / madge 的架构能力**已被 `scripts/check-arch.mjs` 覆盖** → 不并；oxlint 实测仅 4 条且与既有 eslint 重叠 → 不并；jscpd 重复率 1.7%（137 块）无迫切性 → 不并；ast-grep 是**批量重写执行器**（重构工具）非闸 → 不并。

---

## 十六、core 横切基础设施（base/core 地基层）

> 更新(2026-09-13, refs+grep实证, 区域 18 首轮)：新增本段。base/core 横切地基此前只作各业务段脚注，从未作主域审计（区域 18 首审）。审计视角 `daily/架构日志/18-core横切基础设施-2026-09-13.md`。

> 更新(2026-09-13, 清偿轮 20)：TD-18-1/TD-18-2 已清（见 `daily/架构日志/20-跨区-幽灵预留清偿轮-2026-09-13.md`）。原「`DEBUG_ASSET` 在 src 业务侧 0 消费方（仅 config.test.ts）」经取证修正——`config.test.ts` 引的是运行时 `window.__DEBUG_ASSET`（仍有效），**导出常量**才是真死（已删）。级联更正 `spec/CONTEXT.md`/`docs/调试日志总览.md`/`logger.ts` 三处「DEBUG_ASSET 别名」失实注释。

---

## 十七、UI 基础组件层（base/ui 叶组件库）

> 更新(2026-09-13, refs实证, 区域 19 首轮)：新增本段。base/ui 通用 UI 原语库此前散落各业务段，从未作主域审计（区域 19 首审）。审计视角 `daily/架构日志/19-ui基础组件层-2026-09-13.md`。
