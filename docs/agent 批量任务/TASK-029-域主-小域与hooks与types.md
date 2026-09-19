# TASK-029 · 域主：小域（`text` `prompt` `task` `resource` `generate`） + `src/hooks/` + `src/types/`

> 本文件为第一波「域籍台账」产出（只登记，不搬）。判据、四件证据、成因代号、输出格式、交叉验证协议见 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`。
> 本轮未改任何 `src/**`、未 `git mv`、未新建脚本。所有结论以 `scripts/mv-sync-refs.mjs refs` + `grep`/`ls` 实测为准（证据③为①段原文）。
> `git status` 自检：`src/**` 零改动；仅本文件被本会话修改（`TASK-025` 的 M 为 22:52 既有，非本会话所为）。

领地：5 个小域 + `src/hooks/`（20）+ `src/types/`（5）= **33 件**。不含 `base/**`（TASK-028）及其它域目录。

---

## 主表 A · 小域（8 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③ refs①段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | `src/components/text/TextGenerate.tsx` | 本域·合规 | `text` | `text/`（域根·计划留域根） | `canvas/shell/NodePalette.ts:18` `import TextGenerate`；`:246` `component: TextGenerate`（画布节点注册表，cat='text'） | `data.text`/`data.prompt`（画布节点 schema，nodeRuntimeStore 瞬态） | `canvas/shell/NodePalette.ts` · `tests/unit/TextGenerate.test.tsx` · `tests/unit/TextGenerate.upstream.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 画布只注册节点、不持有文本语义；无其它业务域直连文本内部件；`text/` 仅此 1 件 | — | 高 |
| A2 | `src/components/prompt/promptHubStore.ts` | 本域·合规 | `prompt` | `prompt/`（域根） | `prompt/PromptHub.tsx:8` `import … from './promptHubStore'` | `confirmPersist(contentSet(CACHE_KEY,all),{layer:'promptHubStore'})`（kvStore 本地缓存） | `prompt/PromptHub.tsx` · `tests/unit/promptHub.test.ts` | 仅 `PromptHub` 消费；全仓 0 其它业务域引用；模块内订阅已于 2026-09-12 删除（TD-05-2 死抽象，非归属问题） | — | 高 |
| A3 | `src/components/prompt/PromptHub.tsx` | 本域·合规 | `prompt` | `prompt/`（域根） | `base/panels/LeftPanel.tsx:8` `import PromptHub`；`:175` `<PromptHub/>`（左栏装配，四类域 UI 之一） | `promptHubStore`（getPromptHubSources/loadPromptHub） | `base/panels/LeftPanel.tsx` | 左栏为装配层非竞争域；无其它业务域引用 `prompt/` 内部件 | — | 高 |
| A4 | `src/components/task/TaskCenter.tsx` | 本域·合规 | `task` | `task/`（域根） | `base/panels/LeftPanel.tsx:5` `import TaskCenter`；`:169` `<TaskCenter/>` | `base/store/taskStore.ts`（`openTaskCenter`/任务列表；`taskStore`+`taskCompletionBus` 按 §0.5 留 `base/store`，规则2 已知缺口） | `base/panels/LeftPanel.tsx` · `tests/unit/TaskCenter.test.tsx` | 左栏装配层；无其它业务域直连；数据真源 `taskStore` 留 `base` 是规则2 红，非 `TaskCenter` 错位 | — | 高 |
| A5 | `src/components/resource/ResourcePreview.tsx` | 本域·合规 | `resource` | `resource/`（域根） | `generate/GeneratedView.tsx:39` `import {ResourcePreviewOverlay}`；`:543` `<ResourcePreviewOverlay>`；`resource/ResourceLibrary.tsx:52` 同引用 | `item` prop 来自 `resourceStore`/后端（`/api/resources`） | `generate/GeneratedView.tsx` · `resource/ResourceLibrary.tsx` · `tests/unit/ResourcePreview.test.tsx` | 仅 `resource`+`generate` 消费（素材/生成共用预览唯一实现）；无第三竞争域 | — | 高 |
| A6 | `src/components/resource/ResourceLibrary.tsx` | 本域·合规 | `resource` | `resource/`（域根） | `base/panels/LeftPanel.tsx:7` `import ResourceLibrary`；`:173` `<ResourceLibrary/>` | `resource/resourceStore.ts`（目录 pill 派生自 `libraryFoldersOf`，唯一判据） | `base/panels/LeftPanel.tsx` | 左栏装配层；`image/nodes/AssetNode.tsx:39` 仅调 `sendToResourceLibrary`（写素材，非读本面板）；无竞争域 | — | 高 |
| A7 | `src/components/resource/resourceStore.ts` | 本域·合规 | `resource` | `resource/`（域根·素材真源） | 被 `image/nodes/AssetNode.tsx`·`image/nodes/ImageGenerate.tsx`·`scriptbox/ScriptBoxAssetPicker.tsx`·`scriptbox/StepAssets.tsx`·`scriptbox/scriptBoxEngine.ts`·`scriptbox/useScriptBoxEngine.ts`·`base/media/providers/canvasSource.ts`·`base/media/providers/librarySource.ts`·`resource/ResourceLibrary.tsx`·`hooks/useConnectedInputs.ts` 引用 | 自身即真源：`STORAGE_KEY` 落盘 + `/api/resources`；`FOLDERS`/`libraryFoldersOf` 为目录唯一判据 | ① 17 处：`base/media/providers/canvasSource.ts`·`base/media/providers/librarySource.ts`·`image/nodes/AssetNode.tsx`·`image/nodes/ImageGenerate.tsx`·`resource/ResourceLibrary.tsx`·`scriptbox/ScriptBoxAssetPicker.tsx`·`scriptbox/StepAssets.tsx`·`scriptbox/scriptBoxEngine.ts`·`scriptbox/useScriptBoxEngine.ts`·`hooks/useConnectedInputs.ts`·（其余为测试） | 被 ≥3 业务域（image·scriptbox·resource 自身）+ base/media 适配器消费 → 素材真源，真横切 store，非错位 | — | 高 |
| A8 | `src/components/generate/GeneratedView.tsx` | 本域·合规 | `generate` | `generate/`（域根） | `base/panels/LeftPanel.tsx:6` `import GeneratedView`；`:171` `<GeneratedView/>` | 生成结果（`taskCompletionBus` 广播回填 + `base/media/providers/generatedSource.ts` 同口径 `tasks` 目录） | `base/panels/LeftPanel.tsx` · `tests/unit/GeneratedView.refresh.test.tsx` | 左栏装配层；`task/TaskCenter.tsx:58` 仅语义对齐注释；无第三竞争域 | — | 高 |

---

## 主表 B · `src/hooks/`（20 件）

判定口径（本片）：① 仅被 `App.tsx` 根装配 / 另一 cross-cutting hook 消费 = 待核（L1① 缺口，见「判据缺口」）；② 被 ≥3 业务域视图消费 = 真横切（本域·合规，L3）；③ 被恰好 2 业务域消费 = 本域·合规（多域，非 L4 单域）；④ 被单业务域消费但被 cross-cutting 锁死 = 待核（成因 D）。

| # | 件 | 判定 | 应属域（候选） | 应属域内落点 | 证据①界面位置（消费方） | 证据②数据落点 | 证据③ refs①段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `useNodeData.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·video·text 节点 + `base/core/interaction/uiHooks.ts` | `@xyflow/react` 节点 `data`（useReactFlow） | ① 23 处：`App.tsx`·`base/core/interaction/uiHooks.ts`·`canvas/nodes/Director3DNode.tsx`·`canvas/nodes/_template/TemplateNode.tsx`·`image/lib/nodeImage.ts`·`image/nodes/{AssetNode,FaceMosaicNode,GridMergeNode,GridSplitNode,ImageBoxNode,ImageGenerate,LoopNode,PanoramaNode}.tsx`·`text/TextGenerate.tsx`·`video/nodes/{VideoExtractNode,VideoGenerate,VideoProcessNode}.tsx`·`hooks/useNodeExpanded.ts`·`hooks/useNodeGeneration.ts`·`hooks/useNodeRename.ts`·（测试×3） | ≥3 业务域，零业务语义 → 真横切 | — | 高 |
| B2 | `useVideoPoster.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | agent·image·video·videoEditor | 首帧封面提取（video/poster） | ① 7 处：`agent/panels/attachmentCover.tsx`·`image/nodes/AssetNode.tsx`·`video/nodes/VideoGenerate.tsx`·`videoEditor/ui/editor/panels/assets/views/media.tsx`·（测试×3） | 4 业务域消费（含被跳过的 videoEditor，合法目标域） | — | 高 |
| B3 | `useResourceMoveToFolder.ts` | 待核（锁死·候选 resource） | `resource`（候选） | `resource/`（若搬） | `resource/ResourceLibrary.tsx`·`resource/ResourcePreview.tsx` | `resource` 行 `folder`（moveFile 经 `base/api`；`RESOURCE_MOVE_MIME`） | ① 8 处：`base/panels/ImportMediaModal.tsx`·`resource/ResourceLibrary.tsx`·`resource/ResourcePreview.tsx`·`hooks/useAssetDragToCanvas.ts`·（测试×4） | **反证命中**：被真横切 `useAssetDragToCanvas` 直连 → 搬出触发规则2（cross-cutting 反向依赖 domain）；唯一业务域消费方确为 `resource`，但锁死不能搬 | D | 中 |
| B4 | `useAssetDragToCanvas.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | generate·resource·task 面板 | `application/x-yimao-asset` 拖拽建节点 | ① 9 处：`generate/GeneratedView.tsx`·`resource/ResourceLibrary.tsx`·`resource/ResourcePreview.tsx`·`task/TaskCenter.tsx`·（测试×5） | ≥3 业务域（generate·resource·task） | — | 高 |
| B5 | `useCanvasShortcuts.ts` | 待核（App 根装配） | `canvas`（候选） | `canvas/`（若搬） | 仅 `App.tsx` | 画布键盘快捷键（`base/core/interaction` 的 `isCanvasSuppressed`/`isEditableTarget`） | ① 2 处：`App.tsx`·`tests/unit/useCanvasShortcuts.test.tsx` | 消费方仅 `App.tsx` 根装配，无业务域视图；L1① 无对应项 | F | 中 |
| B6 | `useStoreSelector.ts` | 本域·合规（多域） | `并案（共享件）` | `src/hooks/` | agent·settings（+base/projectStore） | `useSyncExternalStore` 通用选择器（projectStore/providerStore/conversationStore…） | ① 6 处：`agent/assistantTable/useActiveAssistantTable.ts`·`agent/panels/TableWorkspacePanel.tsx`·`agent/runtime/useAgentChat.ts`·`base/store/projectStore.ts`·`settings/providerStore.ts`·`tests/unit/useStoreSelector.test.tsx` | 2 业务域（agent·settings）+base，非单域 → 不触发 L4 | — | 高 |
| B7 | `useNodeField.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·text·video 节点 | 节点字段读写（@xyflow） | ① 5 处：`canvas/nodes/_template/TemplateNode.tsx`·`image/nodes/ImageGenerate.tsx`·`text/TextGenerate.tsx`·`video/nodes/VideoGenerate.tsx`·`tests/unit/useNodeField.test.ts` | 4 业务域 | — | 高 |
| B8 | `useArrangeCanvas.ts` | 待核（App 根装配） | `canvas`（候选） | `canvas/structure/`（若搬） | 仅 `App.tsx` | 画布布局（dagre + xyflow nodes/edges；`canvas/structure/arrangePack`·`base/core/nodeSizePatch`） | ① 2 处：`App.tsx`·`tests/unit/useArrangeCanvas.test.ts` | 消费方仅 `App.tsx`；数据落点 canvas | F | 中 |
| B9 | `useEdgeData.ts` | 待核（App 根装配） | `canvas`（候选） | `canvas/edges/`（若搬） | 仅 `App.tsx` | xyflow 边 `setEdges` 统一包装 | ① 1 处：`App.tsx`（+测试） | 消费方仅 `App.tsx`；数据落点 canvas 边 | F | 中 |
| B10 | `useNodeExpanded.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·text·video 节点 | 节点展开态 | ① 5 处：`canvas/nodes/_template/TemplateNode.tsx`·`image/nodes/ImageGenerate.tsx`·`text/TextGenerate.tsx`·`video/nodes/VideoGenerate.tsx`·`tests/unit/useNodeExpanded.test.ts` | 4 业务域 | — | 高 |
| B11 | `useConnectedInputs.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·video·scriptbox·text 节点 | `@xyflow/react` 连接 + `resource/resourceStore.getResources` | ① 33 处：`canvas/nodes/Director3DNode.tsx`·`canvas/nodes/_template/TemplateNode.tsx`·`image/nodes/{FaceMosaicNode,GridMergeNode,GridSplitNode,ImageBoxNode,ImageGenerate,LoopNode,PanoramaNode}.tsx`·`scriptbox/ScriptBoxNode.tsx`·`text/TextGenerate.tsx`·`video/nodes/{VideoExtractNode,VideoGenerate,VideoProcessNode}.tsx`·（测试×19） | 5 业务域（canvas·image·video·scriptbox·text） | — | 高 |
| B12 | `useSyncNodeData.ts` | 待核（锁死·候选 image） | `image`（候选） | `image/nodes/`（若搬） | 仅 `image/nodes/LoopNode.tsx`（+ `hooks/useGenerateNode.ts`） | 节点 `data` 同步（`setNodes`） | ① 11 处：`image/nodes/LoopNode.tsx`·`hooks/useGenerateNode.ts`·（测试×9） | **反证命中**：被真横切 `useGenerateNode` 直连（其消费方 canvas·image·text·video）→ 搬出触发规则2；唯一业务域视图确为 `image/LoopNode`，但锁死 | D | 中 |
| B13 | `useDisconnectSource.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | image·scriptbox·text·video 节点 | 断开源连线（`setEdges`/xyflow） | ① 4 处：`image/nodes/ImageGenerate.tsx`·`scriptbox/ScriptBoxNode.tsx`·`text/TextGenerate.tsx`·`video/nodes/VideoGenerate.tsx` | 4 业务域 | — | 高 |
| B14 | `useLocalToolStatus.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | generate·resource·scriptbox（+base/panels·App） | 本地引擎连接态（`base/api/localToolApi`） | ① 8 处：`App.tsx`·`base/panels/ImportMediaModal.tsx`·`generate/GeneratedView.tsx`·`resource/ResourceLibrary.tsx`·`scriptbox/ScriptBoxAssetPicker.tsx`·（测试×3） | 3 业务域（generate·resource·scriptbox） | — | 高 |
| B15 | `useAssetDropPaste.ts` | 待核（App 根装配） | `canvas`（候选） | `canvas/`（若搬） | 仅 `App.tsx` | 资源拖放/粘贴建节点（`detectFileType`/`isAssetUrl`/`UPLOAD_DIRS`） | ① 3 处：`App.tsx`·`tests/unit/editorOwnership.test.tsx`·`tests/unit/useAssetDropPaste.test.tsx` | 消费方仅 `App.tsx`；数据落点 canvas（建节点） | F | 中 |
| B16 | `useGenerateNode.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·text·video 节点 | `settings/providerStore`（useProviders）+ 生成编排 | ① 5 处：`canvas/nodes/_template/TemplateNode.tsx`·`image/nodes/ImageGenerate.tsx`·`text/TextGenerate.tsx`·`video/nodes/VideoGenerate.tsx`·`tests/unit/ImageGenerate.saveRatioSync.test.tsx` | 4 业务域（canvas·image·text·video） | — | 高 |
| B17 | `useNodeRename.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·text·video 节点 | 节点重命名（节点 `data`/`title`） | ① 15 处：`canvas/nodes/Director3DNode.tsx`·`canvas/nodes/GroupNode.tsx`·`image/nodes/{AssetNode,FaceMosaicNode,GridMergeNode,GridSplitNode,ImageBoxNode,ImageGenerate,LoopNode,PanoramaNode}.tsx`·`text/TextGenerate.tsx`·`video/nodes/{VideoExtractNode,VideoGenerate,VideoProcessNode}.tsx`·（测试×1） | 4 业务域（canvas·image·text·video） | — | 高 |
| B18 | `useNodeGeneration.ts` | 待核（锁死·cross-cutting 构件） | `canvas`（候选） | `src/hooks/`/`canvas/`（待裁） | 仅 `hooks/useGenerateNode.ts`（+测试） | `base/store/nodeRuntimeStore`·`base/store/taskStore`·`base/store/generationOrchestration` | ① 12 处：`hooks/useGenerateNode.ts`·（测试×11） | 无业务域视图直连，仅被真横切 `useGenerateNode` 内部调用 → 属 cross-cutting 生成管线构件；数据落 base；按 L4「仅被单 hook 消费」严格读为待核 | D | 中 |
| B19 | `useCanvasSync.ts` | 待核（App 根装配） | `canvas`（候选） | `canvas/`（若搬） | 仅 `App.tsx` | `base/core/canvasSyncBus`（CANVAS_SYNC_CHANNEL）·`base/core/contentStore`·`base/store/projectStore` | ① 2 处：`App.tsx`·`tests/unit/useCanvasSync.test.ts` | 消费方仅 `App.tsx`；数据落点 canvas 跨标签页同步 | F | 中 |
| B20 | `useAssetDegrade.ts` | 本域·合规（真横切） | `并案（共享件）` | `src/hooks/` | canvas·image·video 节点 | 素材降级（`assetType`/降级分支） | ① 26 处：`canvas/nodes/_template/TemplateNode.tsx`·`image/nodes/{AssetNode,GridSplitNode,ImageBoxNode,ImageGenerate}.tsx`·`video/nodes/{VideoExtractNode,VideoGenerate,VideoProcessNode}.tsx`·（测试×20） | 3 业务域（canvas·image·video） | — | 高 |

---

## 主表 C · `src/types/`（5 件）

| # | 件 | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③ refs①段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `src/types/errors.ts` | 本域·合规（集中） | `base`（集中·非域） | `src/types/` | `base/core/genErrors.ts`（`classifyError`）·`base/core/contracts.ts`（GEN_ERRORS） | `ErrorKind` 枚举（与 contracts 对齐） | ① 多处：`base/core/genErrors.ts`·`base/core/contracts.ts`·`tests/unit/genErrors.test.ts` 等 | 集中共享错误分类，全仓复用无单域独占 | — | 高 |
| C2 | `src/types/asset.ts` | 本域·合规（集中） | `base`（集中·非域） | `src/types/` | `base/utils/media/assetType.ts`·`base/utils/net/asyncGuard.ts`·`hooks/useAssetDropPaste.ts`（`assetTypeLabel`） | `ASSET_TYPE_META` 资产类型目录唯一真源（TD-02-49 收口） | ① 多处：`base/utils/media/assetType.ts`·`base/utils/net/asyncGuard.ts`·`hooks/useAssetDropPaste.ts` 等 | 集中共享资产类型真源；`videoEditor/types/assets.ts`（带 s）为被跳过域内部件，不冲突（见§10） | — | 高 |
| C3 | `src/types/index.ts` | 本域·合规（集中·barrel） | `base`（集中·非域） | `src/types/` | 各 `src/types/*.ts` + 全仓 `import … from '@/types'` | barrel 再导出 | ① 全仓 barrel 引用 | barrel 本身无归属问题 | — | 高 |
| C4 | `src/types/provider.ts` | 本域·合规（集中） | `base`（集中·非域） | `src/types/` | `settings/providerStore.ts`·`hooks/useGenerateNode.ts`（Provider）·`base/store/generationOrchestration`（GenerationResult） | `GenerationProvider`/`GenerationResult`（L3 收口，relayProxy 别名） | ① 多处：`settings/providerStore.ts`·`hooks/useGenerateNode.ts`·`base/store/generationOrchestration.ts` 等 | 生成管线共享契约，多域复用 | — | 高 |
| C5 | `src/types/gifenc.d.ts` | 本域·合规（集中） | `base`（集中·非域） | `src/types/` | `gifenc` 第三方库 ambient 声明 | 库类型垫片 | ① 仅类型声明引用 | 第三方库 .d.ts 必居中 | — | 高 |

---

## 小域结构方案（每域一条）

| 域 | 件数 | 是否达标建子目录（D2 ≥3） | 建议结构 | 是否建议撤域 | 依据 |
| --- | --- | --- | --- | --- | --- |
| `text` | 1（TextGenerate） | 否（<3） | 留域根 `text/TextGenerate.tsx`（补 `index.ts` 门面） | 否 | `TextGenerate` 是画布 `cat='text'` 节点（计划 §3:181），与 image/video 节点平级成域；单件域无 D2 拆分必要 |
| `prompt` | 2（PromptHub·promptHubStore） | 否（<3） | 留域根（UI + store 平铺）；补 `index.ts` | 否 | 提示词社区库（联网 GitHub 源），职责独立；`promptHubStore` 模块内订阅已删（TD-05-2 死抽象）属清理项，非撤域理由 |
| `task` | 1（TaskCenter） | 否（<3） | 留域根 `task/TaskCenter.tsx`（补 `index.ts`） | 否 | `TaskCenter` 是任务中心面板，独立职责；其数据真源 `taskStore`+`taskCompletionBus` 按 §0.5 留 `base/store`（规则2 红，已知缺口），非域撤并理由 |
| `resource` | 3（resourceStore·ResourceLibrary·ResourcePreview） | **是（=3 达门槛）** | 留域根 + 可选拆 `resource/store/`（resourceStore）与 `resource/ui/`（ResourceLibrary·ResourcePreview）；建议先留域根补 `index.ts` | 否 | 三件职责分明（store/列表/预览）；达 D2 门槛但体量极小，拆分收益低；`resourceStore` 为素材真源（真横切 store） |
| `generate` | 1（GeneratedView） | 否（<3） | 留域根 `generate/GeneratedView.tsx`（补 `index.ts`） | 否 | 生成结果面板，独立职责；单件域无 D2 必要 |

> **A1 结论（成因 F）**：`text`(1)·`prompt`(2)·`task`(1)·`generate`(1) 全部未达 D2 建子目录门槛 → 一律留域根 + 门面；`resource`(3) 达门槛但建议先留域根。**五域均不建议撤并**——各自对应独立节点类型 / 面板职责，且计划 §3 已显式成域（cat 维度）。**缺的判据**：ADR 无「域存在性门槛」条款——"单件/双件域（单节点·单面板）凭什么成域"当前仅由计划约定（cat='text' 等），无 ADR-0040/0042 显式条目。建议补 ADR 条款：节点类型维度（`cat`）即成域，与件数解耦。

---

## hooks 域籍分布

| 应属 | 件数 | 件清单 |
| --- | --- | --- |
| `并案（共享件）`＝留 `src/hooks/` | 12 | `useNodeData`·`useVideoPoster`·`useAssetDragToCanvas`·`useNodeField`·`useNodeExpanded`·`useConnectedInputs`·`useDisconnectSource`·`useLocalToolStatus`·`useGenerateNode`·`useNodeRename`·`useAssetDegrade`·`useStoreSelector` |
| `src/hooks/`（待核·App 根装配，候选 canvas） | 5 | `useArrangeCanvas`·`useCanvasShortcuts`·`useEdgeData`·`useCanvasSync`·`useAssetDropPaste` |
| `src/hooks/`（待核·被 cross-cutting 锁死，候选 resource/image/canvas） | 3 | `useResourceMoveToFolder`（候选 resource）·`useSyncNodeData`（候选 image）·`useNodeGeneration`（候选 canvas·cross-cutting 构件） |
| **合计** | **20** | — |

---

## 跨域（真横切）hook 清单

| hook | 业务域数 | 域清单 | 复核命令 |
| --- | --- | --- | --- |
| `useConnectedInputs` | 5 | canvas·image·video·scriptbox·text | `node scripts/mv-sync-refs.mjs refs src/hooks/useConnectedInputs.ts` |
| `useNodeData` | 4 | canvas·image·video·text | `node scripts/mv-sync-refs.mjs refs src/hooks/useNodeData.ts` |
| `useNodeField` | 4 | canvas·image·text·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useNodeField.ts` |
| `useNodeExpanded` | 4 | canvas·image·text·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useNodeExpanded.ts` |
| `useDisconnectSource` | 4 | image·scriptbox·text·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useDisconnectSource.ts` |
| `useGenerateNode` | 4 | canvas·image·text·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useGenerateNode.ts` |
| `useNodeRename` | 4 | canvas·image·text·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useNodeRename.ts` |
| `useVideoPoster` | 4 | agent·image·video·videoEditor | `node scripts/mv-sync-refs.mjs refs src/hooks/useVideoPoster.ts` |
| `useAssetDragToCanvas` | 3 | generate·resource·task | `node scripts/mv-sync-refs.mjs refs src/hooks/useAssetDragToCanvas.ts` |
| `useLocalToolStatus` | 3 | generate·resource·scriptbox | `node scripts/mv-sync-refs.mjs refs src/hooks/useLocalToolStatus.ts` |
| `useAssetDegrade` | 3 | canvas·image·video | `node scripts/mv-sync-refs.mjs refs src/hooks/useAssetDegrade.ts` |

---

## 白名单同步提醒（若提出搬迁方案）

- 本轮**未提出任何 hook 搬迁方案**（全部 `本域·合规` 或 `待核`）。`src/hooks/` 当前在 `scripts/strict-src-whitelist.json`（第 13 行）白名单内。
- **若裁判裁定**将任一 `待核` hook 搬出 `src/hooks/`（如 `useResourceMoveToFolder`→`resource/`、`useSyncNodeData`→`image/`、`useArrangeCanvas` 等→`canvas/`），**必须同步**：
  - 收窄或移除 `scripts/strict-src-whitelist.json` 的 `"src/hooks/"` 前缀（否则保护范围静默缩水，复现 2026-09-19「15→4」事故）；
  - 同步在白名单补该域新落点（参考同文件注释：canvas/nodes 迁出后补 `image/nodes`·`video/nodes`·`text`）。

---

## 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无干净送出） | 0 | 本轮 `src/hooks/` 无「非本域·应属 X」判定；8 件 `待核` 为候选送出，待裁判裁定（见交叉验证请求） |

---

## 域内错位表（属本域·子目录不对·本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| （无） | — | — | 小域全部为域根平铺（计划 §3 明示留域根，D1 例外②），无子目录错位；`src/hooks/`·`src/types/` 本为扁平收口目录 |

---

## 域根散件清单（现状 N 件·目标 0）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外 |
| --- | --- | --- | --- |
| `TextGenerate.tsx` | `text/`（根） | — | D1② 计划写明留域根（`text/ TextGenerate`） |
| `promptHubStore.ts`·`PromptHub.tsx` | `prompt/`（根） | — | D1② 计划写明留域根（`prompt/ …`） |
| `TaskCenter.tsx` | `task/`（根） | — | D1② 计划写明留域根（`task/ …`） |
| `resourceStore.ts`·`ResourceLibrary.tsx`·`ResourcePreview.tsx` | `resource/`（根） | 可选 `store/`+`ui/`（达 D2） | D1② 计划写明留域根（`resource/ …`） |
| `GeneratedView.tsx` | `generate/`（根） | — | D1② 计划写明留域根（`generate/ …`） |

> 全部域根散件均命中 D1②（计划明示留域根）→ **非违规**。但五小域**均无 `index.ts` 门面**：`text`(`NodePalette.ts:18` 直连 `TextGenerate`)、`prompt`(`LeftPanel.tsx:8` 直连 `PromptHub`)、`task`(`LeftPanel.tsx:5` 直连 `TaskCenter`)、`resource`(`LeftPanel.tsx:7` 直连 `ResourceLibrary`；`GeneratedView.tsx:39` 直连 `ResourcePreviewOverlay`；`ResourceLibrary.tsx:35` 直连 `resourceStore`)、`generate`(`LeftPanel.tsx:6` 直连 `GeneratedView`)。建议补各域 `index.ts` 门面收敛内部件直连（非本轮强制）。

---

## 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| （无） | — | 小域均为域根平铺无子目录；`src/hooks/`·`src/types/` 为扁平收口目录；未检出假子域或分层反向依赖 |

---

## 判据缺口（无据可依处·供裁判裁定）

- **G1（🔴 Q6 · `src/hooks/` 是否属 L4）**：`src/hooks/` **受 ADR-0040 L4 管辖，但本轮无法干净执行搬出**。实证：20 件中 11 件为 ≥3 业务域真横切（L3 合规），9 件为 `待核`——其中 5 件消费方仅 `App.tsx` 根装配（L1①「界面位置=哪域视图消费」无对应项：根装配层既非业务域也非 cross-cutting 同级），4 件被 cross-cutting hook / `App.tsx` 锁死（搬出触发规则2 反依赖）。**缺的判据**：① L1① 缺「消费方 = `App.tsx` 根装配」归属约定（建议增条款：根装配消费视同 cross-cutting 装配层 → 留 `src/hooks/`，或按数据落点判业务域）；② L4 缺「被 cross-cutting 件锁死的单域 hook → 成因 D，留横切层」显式例外。**结论**：按现行判据**能判单 hook 的直接业务域消费数**，但 L4 的「搬出」动作在 `src/hooks/` 受规则2 反制，故本轮不搬，交裁判裁定。
- **G2（Q9 · 类型件随域还是集中）**：5 件 `src/types/*` 均为「收口于 src/types/」（文件注释 + `index.ts` barrel），但**无 ADR 条款**界定「何时随域（`<域>/types/`）vs 集中 `src/types/`」。建议补 ADR-0042 判据：跨 ≥2 业务域共享的契约类型集中 `src/types/`；仅单域内部类型随域。本轮 5 件均属跨域共享 → 集中合规。
- **G3（Q1 · 小域存在性）**：ADR 缺「域存在性门槛」——单件/双件域（单节点·单面板）凭什么成域。当前仅由计划约定（cat 维度）。建议补条款：节点类型（`cat`）即成域，与件数解耦。
- **G4（TD-05-2 回声）**：`prompt/promptHubStore.ts` 模块内订阅已删（2026-09-12，全仓 0 消费方），属域内核死抽象，非归属问题；登记供债务清理（不在本轮搬迁范围）。
- **G5（TD-13-9 回声）**：未发现 `SYNC_ALLOW`/`SYNC_LABELS` 残留键名（`base/core/contracts.ts` 已改 `sync`/`label` 字段派生），本片无残留回声，登记「未见」。

---

## 交叉验证请求（要下列域复核我的送出/候选项）

| 送出的件 / 候选项 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `useResourceMoveToFolder`（待核·候选 resource） | `resource` | 是否认领：唯一业务域消费方确为 `resource`（ResourceLibrary·ResourcePreview）；但被真横切 `useAssetDragToCanvas` 锁死，搬出需先解耦 |
| `useSyncNodeData`（待核·候选 image） | `image` | 是否认领：唯一业务域视图为 `image/LoopNode`；被真横切 `useGenerateNode` 锁死 |
| `useArrangeCanvas`·`useCanvasShortcuts`·`useEdgeData`·`useCanvasSync`·`useAssetDropPaste`（待核·候选 canvas） | `canvas` | 是否认领：5 件数据落点均为 canvas（节点/边/布局/跨标签页同步），消费方仅 `App.tsx` 根装配 |
| `useNodeGeneration`（待核·候选 canvas） | `canvas` | cross-cutting 生成管线构件（数据落 base），是否留 `src/hooks/` 或并入 `canvas/` |
| `resourceStore`（A7） | `image`·`scriptbox`·`base/media` | 反向确认：素材真源归属 `resource` 无异议（它们均为消费方，非独占方） |

---

## 计数

- 本域扫描件数：**33**
- 本域·合规：**25**（小域 8 + hooks 12[11 真横切 +1 多域] + types 5）
- 本域·域内错位：**0**
- 非本域：**0**（无干净「应属 X」送出；见交叉验证请求之候选项）
- 待核：**8**（hooks：B3·B5·B8·B9·B12·B15·B18·B19）
- 成因分布：A _0_ / B _0_ / C _0_ / D _3_（B3·B12·B18）/ E _0_ / F _5_（B5·B8·B9·B15·B19）/ G _0_（回声见 G5 未见）/ H _0_
- 无 `refs` 输出的件：**0**（33 件全部跑了 `refs`，输出见 `/tmp/refs029/` 佐证，①段已原样入表）

---

## 验收三问结论（§6 必答）

1. **`src/hooks/` 是否属 ADR-0040 L4 管辖？（Q6）** → **属，但本轮不能干净搬出**。11 件为 ≥3 业务域真横切（L3 合规，留）；9 件待核：5 件 App 根装配（L1① 缺口）、4 件被 cross-cutting 锁死（成因 D/规则2）。缺口在 L1①「App 根装配消费」与 L4「cross-cutting 锁死单域 hook」两条，已写入「判据缺口 G1」，未自造口径。
2. **小域该不该建子目录？（Q1/A1）** → `text`(1)`prompt`(2)`task`(1)`generate`(1) 未达 D2（<3）一律**留域根 + 门面**；`resource`(3) 达门槛但体量小**建议先留域根**。**五域均不建议撤并**（各自对应独立节点/面板职责，计划 §3 已显式成域）。缺「域存在性门槛」判据（G3）。
3. **类型件该随域还是集中？（Q9/C）** → 本轮 5 件均为**跨 ≥2 业务域共享契约 → 集中 `src/types/` 合规**（文件注释 + `index.ts` barrel 佐证）。缺 ADR-0042 显式判据（G2）。
