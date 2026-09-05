# base/ · 通用能力地基（目录地图）

> 定位：全项目「通用地基」，所有层（nodes/panels/agent/scriptbox/hooks）都可依赖它；**业务域反向依赖它 = 架构违规**（`npm run check:arch` 拦截）。
> **更新(2026-09-04)**：base/ 已按语义子目录物理分组，并经另一子代理「按文件头+导出+依赖」复核（17 移/115 保持）后执行。目录归属以本索引为准；发现架构不合理要移位置/改名，一律走 `scripts/mv-sync-refs.mjs`（见 CLAUDE §5.4·8）。

## 目录结构（2026-09-04）

| 子目录           | 语义                                        |
| ------------- | ----------------------------------------- |
| `core/`       | 横切唯一入口（P0 红线）+ 通用地基工具                     |
| `api/`        | 发网络请求的模块                                  |
| `storage/`    | 持久化底层（深模块）                                |
| `store/`      | 业务独立状态库                                   |
| `canvas/`     | 画布编排（节点注册/默认值/编组/派生/lazy/历史栈/工作流触发/工具注册表） |
| `ui/`         | 真·通用展示基座（被多节点/多页复用）                       |
| `panels/`     | 应用壳/大面板（含 `sections/` 设置分区）               |
| `editors/`    | 内容编辑/查看器                                  |
| `prompt/`     | 提示词域（输入/提示词库/纯函数/store）                   |
| `depthVideo/` | 深度视频域                                     |

> 专项归位（2026-09-04 复核执行）：`d3dPersistence` → `director3d/`、`useImageHoverActions` → `nodes/`（业务域专属件回收）；`upstreamLink`/`toolRegistry` → `canvas/`；`settings/` 已拆分清空删除（组件→ui/、框架→panels/、store→store/、sections→panels/sections/）。`promptFlow.ts`（prompts 逐条确认通道死代码）已于 2026-09-05 奥卡姆精简删除。

## 一、core/ （横切唯一入口 P0 红线 + 通用地基）

* **红线（多个** **`scripts/`** **校验按字面路径引用，改名/移动须同步 scripts）**：`contracts.ts`（apiRegistry/EVENTS/STORAGE\_KEYS/NODE\_TYPES）、`config.ts`（环境变量/常量）、`contentStore.ts`（存储唯一入口）、`eventBus.ts`、`logger.ts`

* 其余：`confirmStore.ts`（统一确认弹窗 store）、`toastStore.ts`（统一通知 store）、`degrade.ts`（降级收口：reportDegrade 统一日志 + toast 节流；随 toastStore/logger 归 core，2026-09-05 自 utils/ 移入）、`backendLogStream.ts`（启动级 SSE 镜像 localTool 日志到 console；刻意用 EventSource 直连、不归 api/ 深模块，故留在 core）、`idGen.ts`、`uiHooks.ts`（通用 UI 小 hook：useOutsideClick/isEditableTarget/useSizeSync，区别于顶层 `src/hooks/` 领域业务 hooks）、`utils.ts`（通用纯工具：deepClone/debounce/throttle…）

## 二、api/ （发网络请求）

`generate.ts` `filesApi.ts` `localToolApi.ts` `httpClient.ts` `relayProxy.ts` `pollTask.ts` `index.ts`

> **深模块**：外部统一 `import from 'base/api'`（index.ts 入口）。**统一生成入口收口（2026-09-04 L3）**：chat/image/video 门面已并入 `generate.ts` 单一门面（内部 `generate()` + 具名导出），`imageApi/videoApi/chatApi/genIntent` 已删；`relayProxy` 为唯一 relay 客户端。

## 三、storage/ （持久化底层，深模块）

`storageAdapter.ts` `kvStore.ts` `storageQuota.ts` `persistFailureBus.ts` `index.ts`

> **深模块**：外部统一 `import from 'base/storage'`。`contentStore`（core/ 横切）为唯一路由入口，`backupStore`（store/）负责上层备份编排。

## 四、store/ （业务独立状态库）

`assetStore.ts` `projectStore.ts` `skillStore.ts` `taskStore.ts` `taskCompletionBus.ts` `backupStore.ts` `cloudSync.ts` `appSettings.ts`
（自 `settings/` 并入）`accountsStore.ts` `agentModelStore.ts` `providerStore.ts` `settingRegistry.ts`

## 五、canvas/ （画布编排，核心链路勿轻动）

`NodePalette.ts` `nodeDefaults.ts` `nodePrefs.ts` `groupNodes.ts` `deriveNodes.ts` `lazyNode.tsx` `CanvasEdgesContext.tsx` `historyStack.ts` `workflowRuntime.ts` `ArrangeConfirm.tsx` `lod.tsx`
（复核并入）`upstreamLink.ts`（拓扑触发安全网）`toolRegistry.ts`（画布 AI 工具注册表）

## 六、utils/ （无副作用纯函数工具，可单测）

`asyncGuard.ts` `clipboard.ts` `externalizeInline.ts` `faceMosaic.ts` `genErrors.ts` `imageCompress.ts` `imagePixel.ts` `imageUpscale.ts` `imageUrl.ts` `mediaType.ts` `previewUrl.ts` `providerModels.ts` `providerUrlAdapters.ts` `refToken.ts` `resultUrlExtractor.ts` `uploadDirs.ts` `videoEngine.ts` `volumePolicy.ts`

## 七、ui/ （真·通用展示基座）

`NodeShell.tsx` `ModelSelect.tsx` `LazyImage.tsx` `NodeTitle.tsx` `ToolbarButton.tsx` `Select.tsx` `ToastContainer.tsx` `ConfirmContainer.tsx` `ErrorBoundary.tsx` `ExpandablePanel.tsx` `ContextMenu.tsx` `CometParticles.tsx` `JianyingIcon.tsx` `VideoThumbnail.tsx` `ResizeFullscreenHandle.tsx` `GeneratingOverlay.tsx` `GenerateButton.tsx`
（自 `settings/` 并入）`Toggle.tsx`

## 八、panels/ （应用壳/大面板 + sections/ 设置分区）

`TopNav.tsx` `LeftPanel.tsx` `TaskCenter.tsx` `AssetLibrary.tsx` `MaterialStrip.tsx` `GeneratedView.tsx` `CanvasToolbar.tsx` `HoverToolbar.tsx` `ProjectSelector.tsx` `FullscreenEditor.tsx` `FullscreenModal.tsx` `LocalToolConnectModal.tsx` `EmptyCanvasGuide.tsx`
（自 `settings/` 并入）`SettingsFrame.tsx` + `sections/`{`AccountsSettings` `AgentChatSettings` `ApiSettings` `FetchModelsModal` `OtherSettings` `SkillSettings` `StorageMonitor`}

## 九、editors/ （内容编辑/查看器）

`ImageEditor.tsx` `OverlayEditor.tsx` `ImageZoomDialog.tsx` `InlineImageCropper.tsx` `FaceMosaicEditor.tsx` `PanoViewer.tsx` `CameraStudioPanel.tsx` `cameraStudio.ts`

## 十、prompt/ （提示词域）

UI：`PromptInput.tsx` `PromptLibrary.tsx` `PromptLibraryButton.tsx` `PromptHub.tsx`
纯函数：`promptChips.ts` `promptMention.ts`
数据层：`promptHubStore.ts` `promptManager.ts`
（`promptFlow.ts` 已于 2026-09-05 奥卡姆精简删除，prompts 逐条确认通道不再保留）

## 十一、depthVideo/ （深度视频域）

`engine.ts` `loader.ts` `path.ts` `spawn.ts` `DepthVideoModal.tsx`

## 找文件速查

* 想发请求 → `api/`

* 想存数据 → `core/contentStore` 或 `store/`

* 想改画布节点行为 → `canvas/` + `spec/NEW-NODE-GUIDE.md`

* 想加通用函数 → `core/utils` 优先，再 `utils/`

* 想复用 UI → `ui/`

* 想改编辑/查看器 → `editors/`；改提示词 → `prompt/`；改设置 → `panels/sections/` + `store/`

