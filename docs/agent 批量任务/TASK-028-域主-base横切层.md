# TASK-028 · 域主：`base`（**横切层 · 非域**）—— 域籍台账（第一波 · 只登记不搬）

> 已先读 `TASK-022-总纲`。本轮**只写本文件**，未改 `src/**`、未 `git mv`、未新建脚本。
> 领地：`src/components/base/**`，`find` 实测 **96 件**（源码 84 + 非代码 12），**逐件**跑过 `refs`（84/84 均有 ① 段输出，无零输出件）。

---

## 0. 先声明口径（再给结论）

**业务域计数**：只数 `src/components/<域>/**`；按 TASK-028 §4.1，`src/App.tsx` · `src/main.tsx` · `src/hooks/**` · `tests/**` · `base/**` **不计入**。

**判定触发规则（全表统一适用）**：

| 规则 | 条件 | 判定 |
| --- | --- | --- |
| R1 | ≥3 业务域消费 **+ 零业务语义** | `本域·合规（真横切）` |
| R2 | 消费方里有落在 `base/{core,utils,ui,api,storage}` 的**真横切件**（该件自身 ≥3 域） | `待核（被真横切件锁死）` |
| R2′ | **锁链**：`X ← A ← 真横切桶`（如 `relayProxy ← generate.ts ← api/index.ts`） | 同上（锁链根是真横切件） |
| R3 | 仅 1 个业务域消费且未锁 | `非横切件·应属 X`（L4） |
| R4 | `base/panels/**` | `本域·合规（宿主层）`（`check-arch.mjs:404` 已把 panels 移出横切集合） |
| R5 | 0 业务域消费 + App/main 装配 + 零业务语义 | `本域·合规（真横切）`（L4 只禁"被单域消费"，0 域不触发） |
| R6 | 2 域 + 零业务语义 + 多宿主 | `本域·合规（真横切）`（先例：`captureFrame` 由 `video/index.ts:11` 裁定"跨 scriptbox+video，真横切，不得重审"） |

**barrel 修正（本片最关键的一条）**：`base/api/index.ts` 是 re-export 桶，**桶下件的实际消费域数必须经桶计算** —— 直连 `refs` 会系统性少报（实测 `generate.ts` 直连仅 1 处且为 type-only，经桶实际被 6 个业务域调用）。已列入 §判据缺口 2。

**反证检查口径**：本片把"本域仍有消费"限缩为**横切 5 目录内的真横切件消费**（即 R2）；宿主层（`panels/`）、域容器（`media/`·`store/`）、App 的消费**不构成反证** —— 它们在 `check-arch.mjs:403-404` 下本来就被允许依赖业务域。

---

## 1. 主表 · 域籍台账（96 行）

> 证据③ 写法：`总处数 / 业务域数：域名(文件数) / base 内 N / tests N`。送出件与待核件给完整①段原文。
> 合规件的 证据①界面位置 / ②数据落点 记 `—（零业务界面）/ —（无域数据落点，纯原语）`。

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段 | 反证检查 | 成因 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | `base/api/filesApi.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 45 / 6 域：resource(3) image(3) video(2) videoEditor(1) generate(1) director3d(1) / base 1 / tests 33 | n/a（自身即横切） | — | 高 |
| 002 | `base/api/generate.ts` | 待核（被真横切件锁死） | `generate`（承载域） | `generate/lib/` | 经桶被 6 域调用：`text/TextGenerate.tsx:215` `chatCompletions` · `scriptbox/scriptBoxEngine.ts:565` `generateImage` · image/video 节点经 `hooks/useNodeGeneration.ts:255` | `base/store/taskStore.ts`（task_id / reportGenerate 写任务行）· `base/api/index.ts` `saveResultToTasks` 落 tasks 目录 | 直连 2 处：`src/components/agent/runtime/agentRuntime.ts`（**仅 type import**）· `src/components/base/api/index.ts`（桶）；tests 14 | 锁它的是桶 `base/api/index.ts`（**6 域**）⇒ 见 §被锁死清单 | D | 高 |
| 003 | `base/api/httpClient.ts` | 待核（被真横切件锁死） | —（若解锁则留/并案） | — | — | — | 17 / 2 域：prompt(1) videoEditor(2) / base 8 / tests 6；base 消费方：filesApi·api/index·localToolApi·relayProxy·store/projectStore·utils/imageCompress·utils/media/assetUrl·utils/net/clipboard | 锁它的真横切件 5 个：filesApi(6 域)·localToolApi(6)·assetUrl(7)·clipboard(8)·api/index(6) | D | 高 |
| 004 | `base/api/index.ts` | 本域·合规（真横切） | base | 现位置（唯一出口契约） | — | — | 27 / 6 域：image(5) agent(4) video(3) scriptbox(2) canvas(2) text(1) / base 1 / tests 3 | n/a | — | 高 |
| 005 | `base/api/localToolApi.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 47 / 6 域：resource(3) settings(2) videoEditor(1) scriptbox(1) generate(1) canvas(1) / base 8 / tests 30 | n/a | — | 高 |
| 006 | `base/api/pagedList.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 11 / 4 域：resource(2) scriptbox(1) image(1) generate(1) / base 3 / tests 3 | n/a | — | 高 |
| 007 | `base/api/pollTask.ts` | 待核（被真横切件锁死） | `generate`（随片 1） | `generate/lib/` | — | — | 1 处：`src/components/base/api/index.ts`；tests 0 | 锁它的桶 `base/api/index.ts`（**6 域**） | D | 高 |
| 008 | `base/api/relayProxy.ts` | 待核（被真横切件锁死·锁链） | `generate`（随片 1） | `generate/lib/` | — | — | 4 处：`src/components/base/api/generate.ts` · `src/components/base/api/pollTask.ts`；tests 2 | 锁链：`relayProxy ← generate.ts ← api/index.ts`（桶 **6 域**） | D | 高 |
| 009 | `base/core/agentKeys.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 7 / 1 域：agent(5) + App.tsx / tests 1 | 横切 5 目录零消费；**§0.5 已裁非债，实测与裁定一致（不翻案）**，L4 冲突见判据缺口 3 | — | 高 |
| 010 | `base/core/canvasSyncBus.ts` | 非横切件·应属 `canvas` | canvas | `canvas/lib/` | `src/App.tsx:491` `broadcastCanvasSaved(projectId)`（画布保存成功后广播）；监听侧 `src/hooks/useCanvasSync.ts:20` | `base/store/projectStore.ts:561`（画布快照落盘 `res.success` 后触发，键属 contracts 的 project 类） | 3 处：`src/App.tsx` · `src/components/base/store/projectStore.ts` · `src/hooks/useCanvasSync.ts`；tests 0 | 横切 5 目录**零**消费（唯一 base 消费方 projectStore 在 `store/` 域容器，不在闸管集合）；画布域无 UI 可指（该件无渲染）⇒ 反证不成立 | A | 中 |
| 011 | `base/core/config.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 47 / 8 域：agent(5) image(4) director3d(3) videoEditor(2) video(2) canvas(2) scriptbox(1) resource(1) / base 17 / tests 7 | n/a | — | 高 |
| 012 | `base/core/contentStore.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 53 / 10 域：agent(8) videoEditor(2) settings(2) director3d(2) canvas(2) video(1) scriptbox(1) resource(1) prompt(1) creative(1) / base 4 / tests 27 | n/a | — | 高 |
| 013 | `base/core/contracts.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 41 / 10 域：agent(8) director3d(4) scriptbox(3) canvas(3) videoEditor(2) settings(2) video(1) resource(1) prompt(1) creative(1) / base 7 / tests 5 | n/a | — | 高 |
| 014 | `base/core/event/confirmStore.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 11 / 2 域：agent(3) settings(2) + App.tsx / base 3 / tests 2 | base 消费方在 `panels/`（宿主层）·`store/`（域容器）·`ui/`（ConfirmContainer，0 域）⇒ 均不锁 | —（R6） | 中 |
| 015 | `base/core/event/eventBus.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 23 / 7 域：videoEditor(2) creative(2) canvas(2) agent(2) scriptbox(1) resource(1) generate(1) / base 2 / tests 9 | n/a | — | 高 |
| 016 | `base/core/event/toastStore.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 77 / 12 域：image(14) settings(6) agent(5) scriptbox(4) video(3) canvas(3) videoEditor(2) task(1) resource(1) prompt(1) generate(1) director3d(1) / base 8 / tests 24 | n/a | — | 高 |
| 017 | `base/core/idGen.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 48 / 10 域：videoEditor(13) image(9) agent(8) scriptbox(4) canvas(3) video(1) settings(1) resource(1) director3d(1) creative(1) / base 4 / tests 1 | n/a | — | 高 |
| 018 | `base/core/interaction/editorSession.ts` | 待核（被真横切件锁死） | — | — | — | — | 4 处：`src/App.tsx` · `src/components/base/core/interaction/modalLayer.ts`；tests 2 | 锁它的是 `base/core/interaction/modalLayer.ts`（**3 域**：agent·canvas·image），在横切目录 `core/` 内 | D | 高 |
| 019 | `base/core/interaction/modalLayer.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 10 / 3 域：image(1) canvas(1) agent(1) / base 2 / tests 3 | n/a | — | 高 |
| 020 | `base/core/interaction/uiHooks.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 54 / 8 域：image(9) canvas(5) agent(5) scriptbox(4) video(3) text(1) task(1) creative(1) / base 3 / tests 19 | n/a | — | 高 |
| 021 | `base/core/log/backendLogStream.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 1 处：`src/main.tsx`；0 业务域 | R5（0 域 + main 装配） | — | 中 |
| 022 | `base/core/log/degrade.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 37 / 11 域：videoEditor(6) agent(5) settings(2) director3d(2) canvas(2) video(1) text(1) scriptbox(1) resource(1) prompt(1) creative(1) / base 7 / tests 5 | n/a | — | 高 |
| 023 | `base/core/log/logger.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 119 / 13 域：agent(17) image(9) canvas(7) video(6) scriptbox(4) director3d(4) videoEditor(3) settings(3) resource(2) text(1) task(1) generate(1) creative(1) / base 26 / tests 26 | n/a | — | 高 |
| 024 | `base/core/nodeSizePatch.ts` | 待核（被真横切件锁死） | — | — | — | — | 4 处：`src/components/base/core/interaction/uiHooks.ts` · `src/components/canvas/structure/groupNodes.ts` · `src/hooks/useArrangeCanvas.ts`；tests 1 | 锁它的是 `base/core/interaction/uiHooks.ts`（**8 域**）⇒ **TD-25-20「疑似锁死」复核属实** | D | 高 |
| 025 | `base/core/utils.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 69 / 11 域：image(14) videoEditor(10) canvas(7) video(5) director3d(4) settings(2) text(1) task(1) scriptbox(1) resource(1) agent(1) / base 13 / tests 6 | n/a | — | 高 |
| 026 | `base/core/videoEditorKeys.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`src/components/videoEditor/engine/services/storage/service.ts`；tests 1 / 1 域 videoEditor | 横切 5 目录零消费；`video/index.ts:12` 已裁「键构造 SSOT，TD-25-7 非债，**不得重审**」⇒ 与 agentKeys 同形同判，不翻案 | — | 高 |
| 027 | `base/media/canvasNodesBridge.ts` | 非横切件·应属 `canvas` | canvas | `canvas/lib/` | `src/App.tsx:445` `setCanvasNodesSnapshot(nodes)`（App 持有画布 nodes 真源并单向写入） | 数据 = 画布 nodes 快照（内存投影，**不落盘**；真源是 App 的 nodes state） | 3 处：`src/App.tsx` · `src/components/base/media/providers/canvasSource.ts`；tests 1 | 唯一 base 消费方 `canvasSource.ts` 在 `media/`（**域容器**，不在 `BASE_CROSS_CUTTING`）⇒ 允许反向依赖；横切 5 目录零消费 | A | 中高 |
| 028 | `base/media/index.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 3 处：`src/App.tsx` · `src/components/base/panels/ImportMediaModal.tsx`；tests 1 / 0 业务域 | R5（0 域 + App 装配，副作用注册入口） | — | 中 |
| 029 | `base/media/libraryBrowse.ts` | 非横切件·应属 `resource` | resource | `resource/lib/`（单件不足 D2 ⇒ 备选 `resource/` 域根） | `resource/ResourceLibrary.tsx:194` `libraryBrowseArgs(currentFolder)` · `:201` `libraryUpFolder`（素材库侧栏目录浏览 UI） | 数据 = `UPLOAD_DIRS.migrated`（`base/utils/uploadDirs.ts`）→ `/api/resources` 的 folder 查询参数 | 3 处：`src/components/base/media/providers/librarySource.ts` · `src/components/base/panels/ImportMediaModal.tsx(:95)` · `src/components/resource/ResourceLibrary.tsx(:42)`；tests 1 | 两个 base 消费方分别在 `media/`（域容器）与 `panels/`（宿主层）⇒ 迁移后二者→resource 均合法；横切 5 目录**零**消费 | A | 高 |
| 030 | `base/media/mediaRefRegistry.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 3 处：`src/components/base/media/index.ts` · `src/components/base/media/providers/index.ts`；tests 1 / 0 业务域 | R5（域容器核心注册表） | — | 中 |
| 031 | `base/media/mediaRefTypes.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 13 / 1 域：videoEditor(2) + App.tsx / base 7 / tests 3 | base 内 7 处消费全部在 `media/` 域容器（不在闸管集合）；`DOMAIN-MODULES §7-5` 认定 media/ 为「媒体引用域 ✅范本」 | — | 中 |
| 032 | `base/media/providers/canvasSource.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`src/components/base/media/providers/index.ts`；tests 1 / 0 业务域 | R5 | — | 中 |
| 033 | `base/media/providers/generatedSource.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`src/components/base/media/providers/index.ts`；tests 1 / 0 业务域 | R5 | — | 中 |
| 034 | `base/media/providers/index.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 1 处：`src/components/base/media/index.ts` | R5 | — | 中 |
| 035 | `base/media/providers/librarySource.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 3 处：`src/components/base/media/providers/index.ts` · `src/components/base/media/providers/generatedSource.ts`；tests 1 / 0 业务域 | R5 | — | 中 |
| 036 | `base/panels/FullscreenModal.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 13 / 3 域：canvas(2) videoEditor(1) creative(1) / tests 9 | panels = 宿主层（R4） | — | 高 |
| 037 | `base/panels/FullscreenShell.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 11 / 5 域：image(5) video(1) scriptbox(1) director3d(1) agent(1) / base 1 / tests 1 | R4 | — | 高 |
| 038 | `base/panels/ImportMediaModal.tsx` | 本域·合规（宿主层） | base | 现位置 | 两入口**都经** `videoEditor/ImportMediaModalHost.tsx` 装配：`src/App.tsx:1604`（画布右键上传）· `videoEditor/ui/editor/panels/assets/views/media.tsx:434`（剪辑器素材导入） | 不落盘：`onPick` 由宿主注入（画布建 assetNode / 剪辑器 linkMediaRefs） | 2 处：`src/components/videoEditor/ImportMediaModalHost.tsx`；tests 1 | R4（计划 §3 明列 panels = 宿主层）；头注声称"两入口"**实测成立**。⚠ 宿主壳 `ImportMediaModalHost.tsx` 反而住在 videoEditor 域（非我领地）⇒ 见判据缺口 6 | — | 高 |
| 039 | `base/panels/LeftPanel.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R4 | — | 高 |
| 040 | `base/panels/LocalToolConnectModal.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R4 | — | 高 |
| 041 | `base/panels/PanelBar.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 5 / 4 域：task(1) resource(1) prompt(1) generate(1) / tests 1 | R4 | — | 高 |
| 042 | `base/panels/ProjectSelector.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 1 处：`src/components/base/panels/TopNav.tsx` | R4 | — | 高 |
| 043 | `base/panels/TopNav.tsx` | 本域·合规（宿主层） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R4 | — | 高 |
| 044 | `base/panels/creative-library.css` | 非横切件·应属 `creative` | creative | `creative/`（与 `CreativeLibrary.tsx` 同级） | `src/components/creative/CreativeLibrary.tsx:24` `import '../base/panels/creative-library.css'`（另 `creative/views/MjStyleBrowser.tsx:10` 明写 `.cl-*` 视觉） | 无（纯样式表，990 行 `.cl-*` 视觉语言） | 2 处：`src/components/base/panels/ImportMediaModal.tsx(:82)` · `src/components/creative/CreativeLibrary.tsx(:24)` | base/panels 是**宿主层**（`check-arch.mjs:404` `BASE_HOST_LAYER`）⇒ 允许 import 业务域，ImportMediaModal 借用**不构成反证** | G | 高 |
| 045 | `base/panels/panel-kit.css` | 本域·合规（宿主层） | base | 现位置 | — | — | 3 处：`base/panels/LeftPanel.tsx` · `base/panels/PanelBar.tsx` · `creative/CreativeLibrary.tsx` | R4 + 计划 §3 明列「横切 UI kit · panel-kit.css」 | — | 高 |
| 046 | `base/storage/index.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 11 / 5 域：director3d(3) videoEditor(1) settings(1) resource(1) agent(1) + main.tsx / base 3 | n/a | — | 高 |
| 047 | `base/storage/legacyRawKey.ts` | 待核（被真横切件锁死） | — | — | — | — | 1 处：`src/components/base/storage/index.ts` | 锁它的 `base/storage/index.ts`（**5 域**）在横切目录 `storage/` 内 | D | 高 |
| 048 | `base/storage/storageAdapter.ts` | 待核（被真横切件锁死） | — | — | — | — | 8 处：`base/core/contentStore.ts` · `base/core/log/degrade.ts` · `base/storage/index.ts` · `base/storage/storageQuota.ts`；tests 4 | 锁它的真横切件：contentStore(**10 域**)·degrade(**11 域**)·storage/index(**5 域**) | D | 高 |
| 049 | `base/storage/storageQuota.ts` | 待核（被真横切件锁死） | — | — | — | — | 2 处：`src/components/base/storage/index.ts`；tests 1 | 锁它的 `base/storage/index.ts`（**5 域**） | D | 高 |
| 050 | `base/store/appSettings.ts` | 待核（被真横切件锁死） | — | — | `src/components/settings/sections/OtherSettings.tsx` 消费 | 设置项（cloudSync 读 getSetting） | 10 处：`src/App.tsx` · `base/store/autoSync.ts` · `base/store/cloudSync.ts` · `base/utils/media/assetUrl.ts` · `src/components/settings/sections/OtherSettings.tsx`；tests 5 | 锁它的 `base/utils/media/assetUrl.ts`（**7 域**）⇒ **§0.5 已裁留原地，实测与裁定一致（不翻案）** | D | 高 |
| 051 | `base/store/autoSync.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`src/App.tsx`；tests 1 / 0 业务域 | R5（0 域 + App 装配）；成片 4 备登记 | — | 中 |
| 052 | `base/store/cloudSync.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 5 处：`src/App.tsx` · `base/store/autoSync.ts`；tests 3 / 0 业务域 | R5；成片 4 备登记（`DOMAIN-MODULES §7-16` 曾拟「云同步域」，若补立则送 settings） | — | 中 |
| 053 | `base/store/generationOrchestration.ts` | 非横切件·应属 `generate` | generate | `generate/lib/` | `scriptbox/scriptBoxEngine.ts:34`（剧本盒资产图/尾帧图生成）· `hooks/useNodeGeneration.ts:255` `runGenerationOrchestration`（节点生成 UI 的执行器） | `base/store/taskStore.ts` 的 `reportGenerate` / `done`（任务行）+ `base/api/index.ts` `saveResultToTasks`（tasks 目录落盘） | 2 处：`src/components/scriptbox/scriptBoxEngine.ts` · `src/hooks/useNodeGeneration.ts`；tests 1 | 横切 5 目录**零**消费；base 内**零**消费 ⇒ 可搬 | H | 中 |
| 054 | `base/store/nodeRuntimeStore.ts` | 待核（口径缺口） | `generate` / `canvas`（候选） | `generate/lib/` 或 `canvas/lib/` | `video/nodes/VideoProcessNode.tsx` 直连消费；`hooks/useNodeGeneration.ts:9`（生成节点 loading/error/progress） | **无落点**：内存 Map，刻意不进画布快照、不落盘 | 3 处：`src/components/video/nodes/VideoProcessNode.tsx` · `src/hooks/useNodeGeneration.ts`；tests 1 | 未锁（消费方均在域外/hooks）；但 L1 两判据只中"界面"一条（无数据落点）⇒ F | F | 中 |
| 055 | `base/store/projectStore.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 11 / 4 域：resource(2) scriptbox(1) generate(1) canvas(1) / base 2 / tests 2 | n/a | — | 高 |
| 056 | `base/store/taskCompletionBus.ts` | 待核（口径缺口） | `task` / `generate`（候选） | — | 无 UI（事件发布器） | `base/store/taskStore.ts:26,358` `publishTaskCompleted({...})` → `eventBus` `agent:task-completed` | 1 处：`src/components/base/store/taskStore.ts`；tests 0 | 唯一消费方 taskStore 在 `store/`（域容器）⇒ **不锁**；但 taskStore 已被 §0.5 裁定留原地，单独送出会拆散"真源 + 出口" ⇒ F，请裁判裁定 | F | 中 |
| 057 | `base/store/taskStore.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 26 / 4 域：agent(3) image(2) task(1) canvas(1) / base 3 / tests 14 | **§0.5 已裁非债，实测与裁定一致**（4 域 ⇒ 真横切成立，不翻案） | — | 高 |
| 058 | `base/ui/display/ImageZoomDialog.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 15 / 6 域：image(5) video(1) task(1) scriptbox(1) resource(1) agent(1) / tests 5 | n/a | — | 高 |
| 059 | `base/ui/display/LazyImage.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 21 / 10 域：agent(3) creative(2) canvas(2) videoEditor(1) video(1) resource(1) prompt(1) image(1) generate(1) director3d(1) / base 1 / tests 6 | n/a | — | 高 |
| 060 | `base/ui/display/VideoThumbnail.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 8 / 4 域：video(1) task(1) image(1) generate(1) / tests 4 | `video/index.ts:12` 已裁「真横切，不得重审」，实测 4 域与裁定一致 | — | 高 |
| 061 | `base/ui/feedback/ConfirmContainer.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R5（App 根装配 confirmStore） | — | 中 |
| 062 | `base/ui/feedback/ErrorBoundary.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 5 处：`canvas/parts/NodeShell.tsx` · `canvas/shell/lazyNode.tsx` · `src/main.tsx`；tests 2 | R5（main.tsx 根挂载 + canvas 借用；零业务语义） | — | 中 |
| 063 | `base/ui/feedback/RenameDialog.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R5 | — | 中 |
| 064 | `base/ui/feedback/ToastContainer.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 1 处：`src/App.tsx` | R5 | — | 中 |
| 065 | `base/ui/form/DropdownPanel.tsx` | 待核（被真横切件锁死） | — | — | — | — | 3 处：`base/ui/form/ModelSelect.tsx` · `scriptbox/Select.tsx`；tests 1 | 锁它的 `base/ui/form/ModelSelect.tsx`（**6 域**）在横切目录 `ui/` 内 | D | 高 |
| 066 | `base/ui/form/DropdownRow.tsx` | 待核（被真横切件锁死） | — | — | — | — | 3 处：`base/ui/form/ModelSelect.tsx` · `scriptbox/Select.tsx`；tests 1 | 锁它的 `ModelSelect.tsx`（**6 域**） | D | 高 |
| 067 | `base/ui/form/InlineNameInput.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`generate/GeneratedView.tsx` · `resource/ResourceLibrary.tsx`；2 域 / tests 0 | R6（2 域 + 零业务语义 UI kit + 多宿主） | — | 中 |
| 068 | `base/ui/form/ModelSelect.tsx` | 本域·合规（真横切） | base | 现位置 | — | — | 14 / 6 域：video(1) text(1) scriptbox(1) image(1) canvas(1) agent(1) / tests 8 | n/a | — | 高 |
| 069 | `base/ui/form/Toggle.tsx` | 非横切件·应属 `settings` | settings | `settings/sections/`（单件不足 D2，不新建 ui/） | `settings/sections/OtherSettings.tsx:24` `<Toggle/>` · `settings/sections/SkillSettings.tsx:364,393` `<Toggle/>` | 设置项开关（`skill.enabled` 等，经 sections 写回 settings store） | 2 处：`src/components/settings/sections/OtherSettings.tsx` · `src/components/settings/sections/SkillSettings.tsx`；tests 0 | base 内**零**消费（连 `ui/form/ModelSelect.tsx` 都不用它）⇒ 反证不成立 | C | 高 |
| 070 | `base/utils/captureFrame.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 8 / 2 域：video(4) scriptbox(1) + `hooks/useVideoPoster.ts`；tests 2 | `video/index.ts:11` 已裁「跨 scriptbox+video，真横切，**不得重审**」；实测 2 域与裁定一致 | — | 高 |
| 071 | `base/utils/genErrors.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 7 / 3 域：video(3) scriptbox(1) image(1) / base 1 / tests 1 | n/a | — | 高 |
| 072 | `base/utils/imageCompress.ts` | 待核（被真横切件锁死） | — | — | — | — | 9 处：`base/utils/media/assetUrl.ts(:32 实 import)` · `image/editors/ImageEditor.tsx` · `image/editors/InlineImageCropper.tsx` · `image/useImageHoverActions.tsx`；tests 5 / 1 域 | 锁它的 `base/utils/media/assetUrl.ts`（**7 域**）⇒ **§0.5 已裁留原地，实测与裁定一致（不翻案）** | D | 高 |
| 073 | `base/utils/imagePixel.ts` | 待核（被真横切件锁死·锁链） | `generate`（随片 1） | `generate/lib/` | — | — | 2 处：`src/components/base/api/generate.ts(:22)`；tests 1 | 锁链：`imagePixel ← generate.ts ← api/index.ts`（桶 **6 域**） | D | 高 |
| 074 | `base/utils/media/assetType.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 23 / 9 域：resource(3) videoEditor(2) image(2) agent(2) video(1) scriptbox(1) generate(1) director3d(1) creative(1) / base 5 / tests 2 | n/a | — | 高 |
| 075 | `base/utils/media/assetUrl.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 38 / 7 域：image(9) agent(5) scriptbox(4) videoEditor(2) canvas(2) video(1) task(1) / base 6 / tests 7 | n/a | — | 高 |
| 076 | `base/utils/media/nodeMedia.ts` | 非横切件·应属 `canvas` | canvas | `canvas/lib/` | `src/App.tsx:43` import（选中派生给 agent/App 引用带图节点）· `base/media/providers/canvasSource.ts:22` `getNodeMedia` | 数据 = `Node` 数据形态（`data.assetUrl` / `data.images` / `data.assetUrls`） | 5 处：`src/App.tsx` · `src/components/base/media/providers/canvasSource.ts`；tests 3 / 0 业务域 | 唯一 base 消费方 `canvasSource.ts` 在 `media/`（域容器）⇒ 允许反向；横切 5 目录零消费 | G | 中高 |
| 077 | `base/utils/media/previewUrl.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 9 / 3 域：video(2) image(1) agent(1) / tests 4 | n/a | — | 高 |
| 078 | `base/utils/media/useImageFallbackSrc.ts` | 待核（被真横切件锁死） | — | — | — | — | 3 处：`agent/panels/ChatMarkdown.tsx` · `image/nodes/AssetNode.tsx` · `base/ui/display/LazyImage.tsx`；2 域 | 锁它的 `base/ui/display/LazyImage.tsx`（**10 域**）在横切目录 `ui/` 内 | D | 高 |
| 079 | `base/utils/media/useMediaLoadFailed.ts` | 待核（被真横切件锁死） | — | — | — | — | 4 处：`base/ui/display/VideoThumbnail.tsx` · `videoEditor/ui/editor/panels/preview/index.tsx` · `videoEditor/ui/editor/panels/timeline/timeline-element.tsx`；tests 1 | 锁它的 `base/ui/display/VideoThumbnail.tsx`（**4 域**）⇒ **TD-25-14「很可能属被锁死」复核属实** | D | 高 |
| 080 | `base/utils/net/asyncGuard.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 50 / 7 域：image(9) videoEditor(6) agent(5) video(3) scriptbox(2) director3d(2) settings(1) / base 11 / tests 8 | n/a | — | 高 |
| 081 | `base/utils/net/clipboard.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 27 / 8 域：image(5) agent(4) videoEditor(2) video(2) task(1) settings(1) scriptbox(1) canvas(1) / base 1 / tests 7 | n/a | — | 高 |
| 082 | `base/utils/net/externalizeInline.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 2 处：`src/App.tsx`；tests 1 / 0 业务域 | R5（纯函数编排 + `save` 注入，零业务语义，App 装配） | — | 中 |
| 083 | `base/utils/providerModels.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 24 / 7 域：settings(3) scriptbox(2) video(1) text(1) image(1) canvas(1) agent(1) / tests 13 | n/a | — | 高 |
| 084 | `base/utils/uploadDirs.ts` | 本域·合规（真横切） | base | 现位置 | — | — | 15 / 6 域：video(3) image(3) videoEditor(1) scriptbox(1) resource(1) director3d(1) / base 2 / tests 2 | n/a | — | 高 |
| 085 | `base/.DS_Store` | 非代码件（不判域籍） | — | — | — | — | — | — | — | — |
| 086 | `base/README.md` | 非代码件（不判域籍）· **文档过期 G** | — | — | — | — | —（README:43 仍列 `backupStore.ts`/`skillStore.ts`/`resourceStore.ts` 在 store/，实测已分别迁 `canvas/`·`agent/runtime/`·`resource/`） | — | G | 高 |
| 087 | `base/core/.DS_Store` | 非代码件（不判域籍） | — | — | — | — | — | — | — | — |
| 088 | `base/core/event/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 3 件） | — | — | — |
| 089 | `base/core/interaction/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 3 件） | — | — | — |
| 090 | `base/core/log/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 3 件） | — | — | — |
| 091 | `base/ui/display/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 3 件） | — | — | — |
| 092 | `base/ui/feedback/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 4 件） | — | — | — |
| 093 | `base/ui/form/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 5 件） | — | — | — |
| 094 | `base/utils/.DS_Store` | 非代码件（不判域籍） | — | — | — | — | — | — | — | — |
| 095 | `base/utils/media/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 6 件） | — | — | — |
| 096 | `base/utils/net/.gitkeep` | 非代码件（不判域籍） | — | — | — | — | 占位（该子目录实有 3 件） | — | — | — |

---

## 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| `canvas` | 3 | `core/canvasSyncBus.ts` · `media/canvasNodesBridge.ts` · `utils/media/nodeMedia.ts`（同批建 `canvas/lib/`，3 件达 D2 门槛） |
| `generate` | 5 | `store/generationOrchestration.ts`（主表送出）+ 成片 1 四件 `api/generate.ts` · `api/relayProxy.ts` · `api/pollTask.ts` · `utils/imagePixel.ts`（**判为锁死，需整片搬 + 摘桶 re-export**） |
| `resource` | 1 | `media/libraryBrowse.ts` |
| `creative` | 1 | `panels/creative-library.css` |
| `settings` | 1 | `ui/form/Toggle.tsx` |
| **合计** | **11** | （其中 4 件判定为 `待核（被真横切件锁死）`，属"应属但搬不动"，交裁判裁定） |

## 域内错位表（属 base · 子目录/层级不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `store/taskStore.ts` · `store/projectStore.ts` | `base/store/`（**域容器**） | 若裁判认定"真横切件应住横切 5 目录" ⇒ `base/core/` | 二者实测 4 域，属真横切，却住在允许反向依赖的域容器里（层级与性质不符） |
| `core/agentKeys.ts` | `base/core/` | 严格 L4 应属 `agent/` | 实测单域 agent 5 处；**§0.5 / TD-15-1 已裁非债留原地，不翻案**（列此仅登记冲突） |
| `core/videoEditorKeys.ts` | `base/core/` | 严格 L4 应属 `videoEditor/` | 实测单域 videoEditor；**`video/index.ts:12` TD-25-7 已裁非债不得重审**（同上） |
| `panels/creative-library.css` | `base/panels/`（宿主层） | `creative/` | 见主表 #044（已在送出表登记，此处记层级错位） |

## 域根散件清单（现状 N 件 · 目标 0）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外 |
| --- | --- | --- | --- |
| `base/README.md` | `base/` 一层 | 留（文档） | 无例外，但**非代码件**，不占域根散件指标 |
| `base/.DS_Store` | `base/` 一层 | 应删（macOS 垃圾文件） | 无例外 |

⇒ **代码件域根散件 = 0**，D1 达标。计划 §3 要求消失的 `base/prompt/` · `base/canvas/` **实测均已不存在**（`base/` 下一级子目录现为 api/core/media/panels/storage/store/ui/utils）。

## 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| **同名双层的 `media` 易混**（假子域风险） | `base/media/`（**域容器**，不在闸管集合）vs `base/utils/media/`（**横切子目录**，受规则 2 管） | 同名不同层、性质相反；`nodeMedia.ts:11-13` 的头注正是因误认为"media/ 是横切协议层"而错判下沉 ⇒ 建议改名其一（如 `base/utils/media/` → `base/utils/asset/`） |
| 子目录门槛复核 | `ui/display`3 · `ui/feedback`4 · `ui/form`5 · `core/event`3 · `core/interaction`3 · `core/log`3 · `utils/net`3 · `utils/media`6 · `media/providers`4 | **全部 ≥3**，无 D2 违例 |
| 分层方向 | `base/**` 横切 5 目录 → 业务域 | `check-arch.mjs` 规则 2 当前**全绿**（已实跑：架构校验通过，无反向依赖） |

## 判据缺口（无据可依处 · 供裁判裁定）

1. **L3「≥3 域」是充分条件还是必要条件？** 本片有 **13 件 0 域**（`backendLogStream`·`media/index`·`mediaRefRegistry`·`providers/*`3 件·`autoSync`·`cloudSync`·`ConfirmContainer`·`RenameDialog`·`ToastContainer`·`externalizeInline`）与 **3 件 2 域零业务语义**（`confirmStore`·`InlineNameInput`·`captureFrame`）。L3/L4 均未覆盖 ⇒ 本报告按 R5/R6 判"留"，请确认。
2. **barrel 中介导致 `refs` 系统性少报 fan-in**：`api/generate.ts` 直连 1 处（且仅 type import），经 `base/api/index.ts` 实际被 6 个业务域调用（image/text/video/scriptbox/canvas/agent）。⇒ 建议补口径条：**经桶的消费计入域数**。
3. **同形件处置冲突**：`agentKeys`（agent 单域）+ `videoEditorKeys`（videoEditor 单域）都是"键构造 SSOT"，分别被 §0.5 与 TD-25-7 裁定留原地；但 L4 明写"单域件不许留横切层"。⇒ 建议 ADR-0040 补「契约原语 / 键构造 SSOT 例外」。
4. **`media` 不在目标域全集**：`DOMAIN-MODULES §7-5` 认定 `base/media/` 是「媒体引用域 ✅范本」，但目标域全集无 `media`。⇒ 是否允许新立域名？（本片按"域容器留原地"处理）
5. **宿主层可否依赖业务域样式**：panels 已于 2026-09-19 改判宿主层（`check-arch.mjs:390-404`），本片据此判 `creative-library.css` 应属 creative（迁移后 `base/panels/ImportMediaModal → creative/` 合法）。请确认该读法。
6. **`videoEditor` 域本批跳过 ⇒ 3 件相关件无人认领**：`mediaRefTypes.ts`（1 域 videoEditor，本片判留）、`useMediaLoadFailed.ts`（被 VideoThumbnail 锁死）、`ImportMediaModal.tsx` 的**宿主壳 `videoEditor/ImportMediaModalHost.tsx`**（实测被 App.tsx:1604 当画布上传入口用 ⇒ 宿主壳住在业务域，属 videoEditor 内部错位，非我领地）。
7. **D2 门槛下的单件落点**：`Toggle → settings`（1 件）、`libraryBrowse → resource`（1 件）均不足 3 件不得新建 `ui/`·`lib/`，本片给出"并入 `sections/` / 域根"的备选，请裁定。

## 交叉验证请求（要下列域复核我的送出项）

| 送出的件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `core/canvasSyncBus.ts` · `media/canvasNodesBridge.ts` · `utils/media/nodeMedia.ts` | **TASK-025 canvas 域主** | 是否认领为画布域；落点 `canvas/lib/`（纯能力禁 JSX，3 件达 D2）是否合 D3 |
| `media/libraryBrowse.ts` | **TASK-029（小域）resource** | 是否认领；落点 `resource/lib/` vs `resource/` 域根 |
| `panels/creative-library.css` | **TASK-027 creative** | 是否认领；迁移后 `base/panels/ImportMediaModal.tsx:82` 仍 import 它是否接受 |
| `ui/form/Toggle.tsx` | **TASK-027 settings** | 是否认领；落点 `settings/sections/` vs 新建 `settings/ui/` |
| `store/generationOrchestration.ts` + 成片 1 四件 | **TASK-029 generate** | 是否认领并补立 generate 域；"整片搬 + 桶摘 re-export + 消费方 import 改指"是否接受 |
| `store/nodeRuntimeStore.ts` · `store/taskCompletionBus.ts` | **裁判直判** | `generate` / `canvas` / `task` 三候选域归属 |

## 成片清单（成因 H）

| 片名 | 现散落位置 | 件数 | 约行数 | 应属域/子域 | 依据 |
| --- | --- | --- | --- | --- | --- |
| ① 生成链路 / AI 中继（提交·轮询·代理转发） | `base/api/{generate,relayProxy,pollTask}.ts` + `base/utils/imagePixel.ts` | 4 | 960（334+421+164+41） | `generate/lib/`（承载域） | 三件合计 919 行，与线索 TD-18-38「前端 AI 中继约 919 行」**完全对上**；`DOMAIN-MODULES §7-11`「AI 中继域」+ §491「生成链路（提交/轮询/落盘）属生成能力/中继域」；业务编排三要素齐备（请求组装 generate.ts · 轮询 pollTask.ts · 代理转发 relayProxy.ts）。⚠ **整片被 `base/api/index.ts`（6 域桶）连锁锁死**：只能"整片搬 + 桶摘 `export * from './generate.ts'` + 约 20 处 src 消费方改指新路径"；`check-api-contract.cjs:175` 按**模块名**查导出，不受路径影响 |
| ② 生成编排与完成信号 | `base/store/{generationOrchestration,nodeRuntimeStore,taskCompletionBus}.ts` | 3 | 342 | `generate/lib/`（承载域）| `DOMAIN-MODULES §7-18`「生成编排域 = {generationContract, nodeRuntimeStore}」+ §7-14「任务中心域 = {taskStore, taskCompletionBus}」；三件语义同族（提交→瞬态→完成广播），均无业务域直连消费（0–1 域） |
| ③ 画布节点—媒体/同步 | `base/core/canvasSyncBus.ts` + `base/media/canvasNodesBridge.ts` + `base/utils/media/nodeMedia.ts` | 3 | 264 | `canvas/lib/` | 三者数据都落在**画布 nodes**（快照 / 节点 data / 落盘广播）；`DOMAIN-MODULES §7-3` 已列 `base/core/canvasSyncBus` 属画布域；3 件达 D2 门槛 |
| ④ 云同步（本地↔云端） | `base/store/{cloudSync,autoSync}.ts` | 2 | 1124 | 留原地（**现状 0 业务域消费**，仅 App.tsx 装配）；若补立域则 `settings`（`accountsStore` 已迁 settings/） | `DOMAIN-MODULES §7-16` 曾拟「云同步域 = {cloudSync, autoSync, accountsStore}」；实测二者 src 消费方 = App.tsx + 彼此，无业务域 ⇒ 不触发 L4 |
| ⑤ 可引用媒体源注册表（mediaRef） | `base/media/**` | 9 | 990 | 留（`base/media/` 域容器） | `DOMAIN-MODULES §7-5`「媒体引用域 ✅**范本**」+ 计划 §3 明列 `media/` 为横切协议层；域名 `media` 不在目标域全集 ⇒ 若裁定成域属缺口 4 |
| ⑥【**已解散**】图片媒体处理组 | 线索 TD-18-35 称「约 9 件 / 1400 行」 | — | — | **不成立** | 实测：`faceMosaic` / `imageUpscale` **已迁** `image/lib/`（`config.ts` refs 实测坐实）；剩余件中 `assetType`(9 域)·`assetUrl`(7 域)·`previewUrl`(3 域) **已是真横切**，`imageCompress`·`useImageFallbackSrc`·`useMediaLoadFailed` **三件全被真横切件锁死** ⇒ 无可送成片。登记为**描述过期 G** |

## 被真横切件锁死清单（物理约束）

> 复核命令模板：`node scripts/mv-sync-refs.mjs refs <锁方的文件路径>`（第二次 refs 数它的业务域）。

| 件 | 锁它的横切消费方 | 该消费方的业务域数 | 复核命令 |
| --- | --- | --- | --- |
| `api/generate.ts` | `base/api/index.ts`（re-export 桶） | **6**（image·agent·video·scriptbox·canvas·text） | `node scripts/mv-sync-refs.mjs refs src/components/base/api/index.ts` |
| `api/httpClient.ts` | `api/filesApi.ts`·`api/localToolApi.ts`·`utils/media/assetUrl.ts`·`utils/net/clipboard.ts`·`api/index.ts` | **6 / 6 / 7 / 8 / 6** | `refs …/filesApi.ts`、`…/localToolApi.ts`、`…/assetUrl.ts`、`…/clipboard.ts` |
| `api/pollTask.ts` | `base/api/index.ts` | **6** | 同上第一条 |
| `api/relayProxy.ts` | 锁链 `relayProxy ← api/generate.ts ← api/index.ts` | 桶 **6** | `refs …/api/generate.ts` 后再 `refs …/api/index.ts` |
| `core/interaction/editorSession.ts` | `base/core/interaction/modalLayer.ts` | **3**（agent·canvas·image） | `refs src/components/base/core/interaction/modalLayer.ts` |
| `core/nodeSizePatch.ts` | `base/core/interaction/uiHooks.ts` | **8** | `refs src/components/base/core/interaction/uiHooks.ts` |
| `storage/legacyRawKey.ts` | `base/storage/index.ts` | **5** | `refs src/components/base/storage/index.ts` |
| `storage/storageAdapter.ts` | `core/contentStore.ts` · `core/log/degrade.ts` · `storage/index.ts` | **10 / 11 / 5** | `refs …/contentStore.ts`、`…/degrade.ts`、`…/storage/index.ts` |
| `storage/storageQuota.ts` | `base/storage/index.ts` | **5** | 同上 |
| `store/appSettings.ts` | `base/utils/media/assetUrl.ts` | **7** | `refs src/components/base/utils/media/assetUrl.ts` |
| `ui/form/DropdownPanel.tsx` | `base/ui/form/ModelSelect.tsx` | **6** | `refs src/components/base/ui/form/ModelSelect.tsx` |
| `ui/form/DropdownRow.tsx` | `base/ui/form/ModelSelect.tsx` | **6** | 同上 |
| `utils/imageCompress.ts` | `base/utils/media/assetUrl.ts`（`assetUrl.ts:32` 实 import） | **7** | 同上 |
| `utils/imagePixel.ts` | 锁链 `imagePixel ← api/generate.ts ← api/index.ts` | 桶 **6** | 同第二条 |
| `utils/media/useImageFallbackSrc.ts` | `base/ui/display/LazyImage.tsx` | **10** | `refs src/components/base/ui/display/LazyImage.tsx` |
| `utils/media/useMediaLoadFailed.ts` | `base/ui/display/VideoThumbnail.tsx` | **4** | `refs src/components/base/ui/display/VideoThumbnail.tsx` |

**合计 16 件**。另：`base/api/index.ts` 桶把旗下 6 个 re-export 件整体焊死 —— 这是本片最大的单一物理约束。

## 注释谎称跨域（TD-25-18 类）

| 件:行 | 注释声称 | 实测域数 | 处置建议 |
| --- | --- | --- | --- |
| `utils/media/nodeMedia.ts:5,11-13` | 「**横切层** · `base/media/providers/canvasSource.ts`（**横切**媒体引用协议层）也要用它 ⇒ 住画布域会违反规则 2」 | **0 业务域**（消费方 = App.tsx + `media/` 域容器） | 前提已失效：`BASE_CROSS_CUTTING = {core,utils,ui,api,storage}`（`check-arch.mjs:403`）**不含 media/** ⇒ 改判 `canvas` 域并重写头注 |
| `panels/creative-library.css:6-12` | 「为什么住横切层 `base/panels/`（2026-09-19 裁定）：若留创作库域 ⇒ 横切面板 import 域 ⇒ 违反规则 2」 | **1 业务域**（creative）+ 宿主层借用 1 处 | 前提已失效：panels 已改判宿主层（`check-arch.mjs:390-404`）⇒ 应属 `creative`，头注改写 |
| `core/nodeSizePatch.ts:5-9` | 「纯数据形态原语、**零画布语义** ⇒ 住横切层」 | **1 业务域**（`canvas/structure/groupNodes.ts`）+ `uiHooks`(8 域) | 结论（留）成立，但**理由写错**：读 `node.style` 的补丁件带画布语义。正确理由 = 被 `uiHooks`（真横切）锁死（成因 D）。头注改写 |
| `media/index.ts:2` · `mediaRefTypes.ts:2` · `mediaRefRegistry.ts:2` · `canvasNodesBridge.ts:2` | 自称「横切地基」 | **0–1 业务域**（videoEditor 2 处 / resource 1 处 / 其余 0） | "横切"未被实测域数支持；建议改为「域容器 / 地基（性质待裁定）」，或由裁判裁定成域后改为域名 |
| `panels/ImportMediaModal.tsx:2-7` | 「可复用弹窗（横切地基）· 入口 A 画布右键 + 入口 B 剪辑器」 | **1 业务域**（videoEditor，经 `ImportMediaModalHost`） | "两入口"实测成立（App.tsx:1604 + videoEditor media.tsx:434），但**宿主壳住在业务域** ⇒ 属 videoEditor 内部错位（判据缺口 6），头注补一句 |
| `api/index.ts:9` | 「已收 **7 件**：httpClient/pollTask/generate/localToolApi/filesApi（+ 内部 consumer）」 | 桶内实为 **6** 个 re-export（httpClient·pollTask·generate·localToolApi·filesApi·pagedList） | 计数过期，改 6 |
| `README.md:43` | 仍列 `backupStore.ts` · `skillStore.ts` · `resourceStore.ts` 在 `store/` | 实测已分别迁 `canvas/backupStore.ts` · `agent/runtime/skillStore.ts` · `resource/resourceStore.ts` | 文档过期 G，随域归位一并更新 |

## 浅壳清单

| 件 | 实际内容 | 真源位置 | 建议 |
| --- | --- | --- | --- |
| （空） | 线索 TD-18-36「`storage/kvStore.ts` 浅壳（仅 re-export 常量）」⇒ **实测 `base/storage/` 现 4 件**（`index`·`legacyRawKey`·`storageAdapter`·`storageQuota`），**无 `kvStore.ts`** | — | 描述过期 **G**，不登记 |
| （附带实测） | `base/api/index.ts` 是纯 re-export 桶，但它是**唯一出口契约**（头注 + `check-api-contract.cjs` 依赖） | — | **不算浅壳**，保留 |

⇒ **浅壳清单：0 件**。

## §5「已裁定留原地」复核（四类 + 附带两类）

| 裁定 | 实测 | 复核结论 |
| --- | --- | --- |
| `imageCompress` 留 `base/utils/`（§0.5：`assetUrl.ts:32` 实 import） | 单域 image(3 处)；`base/utils/media/assetUrl.ts:32` 仍为实 import；assetUrl 域数 **7** | **实测与裁定一致**，判 `待核（被真横切件锁死）`，不翻案 ✓ |
| `taskStore` 已裁非债 | 实测 **4 域**（agent3·image2·task1·canvas1） | **实测与裁定一致**，判 `本域·合规（真横切）` ✓ |
| `appSettings` 已裁非债 | 单域 settings(1)；被 `assetUrl.ts`(7 域)·`cloudSync`·`autoSync` 消费 | **实测与裁定一致**，判 `待核（被真横切件锁死）`，不翻案 ✓ |
| `agentKeys` 已裁非债（键构造器 = 契约原语） | 单域 agent(5 处) + App.tsx；横切 5 目录零消费 | **实测与裁定一致**，判 `本域·合规（真横切）`，不翻案 ✓（L4 冲突见判据缺口 3） |
| 附带：`videoEditorKeys`（同形件） | 单域 videoEditor；`video/index.ts:12`「TD-25-7 非债·**不得重审**」 | 与 agentKeys 同形同判 ⇒ **留**，两件处置自洽 ✓ |
| 附带：`captureFrame` | 实测 2 域（video 4 处 + scriptbox 1 处）；`video/index.ts:11`「跨 scriptbox+video，真横切，**不得重审**」 | **实测与裁定一致** ✓ |

## 线索过期清单（成因 G · 逐条实测复核）

| 线索 | 实测 | 结论 |
| --- | --- | --- |
| TD-25-11 `base/utils/faceMosaic.ts` | 实测在 `image/lib/faceMosaic.ts` | 过期（base/utils 已无） |
| TD-25-14 `base/utils/timeline/{sourceTime,timeScale}.ts` · `videoEngine.ts` | 实测已迁 `video/lib/`（`video/index.ts:8` 明载 2026-09-19 域归位迁入） | 过期 |
| TD-25-15 `base/utils/encoderProbe.ts` | 实测在 `director3d/encoderProbe.ts` | 过期 |
| TD-25-17 `base/utils/providerUrlAdapters.ts` | 实测在 `settings/providerUrlAdapters.ts` | 过期 |
| TD-25-21 `base/store/backupStore.ts` | 实测在 `canvas/backupStore.ts` | 过期 |
| TD-25-22 `base/panels/ImportMediaModalHost.tsx` | 实测在 `videoEditor/ImportMediaModalHost.tsx` | 过期（且它的落点本身就是个错位，见判据缺口 6） |
| TD-18-36 `storage/kvStore.ts` 浅壳 | `base/storage/` 无此件 | 过期 |
| TD-18-35 图片媒体 9 件/1400 行成片 | 已解散（见成片清单 ⑥） | 过期 |
| TD-11-15（母债）摘要 4 件/正文 15 件 | 未按清单使用（按 TASK-028 指示只作线索） | 已忽略 |

## 计数

- 本域扫描件数：**96**（源码 84 + 非代码 12）
- 本域·合规（真横切）：**50**
- 本域·合规（宿主层）：**9**
- 非本域（非横切件·应属 X）：**7**
- 待核：**18**（被真横切件锁死 **16** + 口径缺口 **2**）
- 非代码件（不判域籍）：**12**
- 成因分布：A **3** / B **0** / C **1** / D **16** / E **0** / F **2** / G **2** / H **1**
  - A：`core/canvasSyncBus.ts` · `media/canvasNodesBridge.ts` · `media/libraryBrowse.ts`
  - C：`ui/form/Toggle.tsx`
  - D：16 件锁死件（见上表）
  - F：`store/nodeRuntimeStore.ts` · `store/taskCompletionBus.ts`
  - G：`utils/media/nodeMedia.ts` · `panels/creative-library.css`
  - H：`store/generationOrchestration.ts`
- 无 `refs` 输出的件：**0**（84/84 源码件均有 ① 段输出）

## 验收自测

- [x] `find src/components/base -type f | sort` 的 **96 件全部**出现在主表（84 源码 + 12 非代码，逐件一行）
- [x] 横切 5 目录（`core`·`utils`·`ui`·`api`·`storage`）**逐件**跑过 `refs`（无抽样；84 件全跑，其中 5 目录共 45 件）
- [x] 每条「被锁死」都附了**锁方的业务域数**（第二次 refs，16 条全附）
- [x] §5「已裁定留原地」四类都给了复核结论（imageCompress / taskStore / appSettings / agentKeys **均"实测与裁定一致"**，另附 videoEditorKeys / captureFrame 两条）
- [x] 成片按"一片"整体登记（5 片 + 1 条"已解散"），未拆成零散行
- [x] 每条「非本域」凑齐四件证据（界面位置 / 数据落点 / refs 原文 / 反证检查）—— 7 件全齐
- [x] 无一條依据是"名字叫 xxx"或"目录在 xxx"（全部给 `文件:行` 或 refs 实测）
- [x] 未改本文件以外的任何文件：`git status --short` 显示本工作区仅 `docs/agent 批量任务/TASK-025/027/029`（并行域主所写）与 `.workbuddy-ai/memory/2026-09-19.md` 有改动，**本域主本次只写 `TASK-028-域主-base横切层.md`**；无 `git mv`、无 `src/**` 改动、无新建脚本（取证全部走既有 `node scripts/mv-sync-refs.mjs refs`，输出落在 `/tmp`）
