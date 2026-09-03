# base/ · 通用能力地基（目录地图）

> 定位：全项目「通用地基」，所有层（nodes/panels/agent/scriptbox/hooks）都可依赖它；**业务域反向依赖它 = 架构违规**（`npm run check:arch` 拦截）。
> 更新(2026-08-31)：本目录不按子目录物理重排（NodeShell/ModelSelect 等是真通用基座，整层搬 = churn + 高风险，决策见 `spec/CONTEXT.md` §六·B）。改文件前先看本索引定位归属。

## 一、横切唯一入口（P0 红线，别绕道）

| 文件                | 职责                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `contracts.js`    | 契约真源（apiRegistry/EVENTS/STORAGE\_KEYS/NODE\_TYPES），`check:api`/`check:events`/`check:keys` 依赖 |
| `config.js`       | 环境变量/常量唯一入口（端口/超时/魔法数字）                                                                       |
| `contentStore.ts` | 存储横切唯一入口（按 STORAGE\_KEYS 路由底层，dev 校验裸 key）                                                    |
| `eventBus.ts`     | 事件广播唯一入口                                                                                      |
| `logger.ts`       | 日志/上报唯一入口                                                                                     |
| `toastStore.ts`   | 提示唯一入口                                                                                        |
| `confirmStore.ts` | 确认弹窗唯一入口（`askConfirm` → `Promise<boolean>`，与 toastStore 同形：模块级 store + 全局容器渲染） |
| `idGen.ts`        | ID 生成唯一入口                                                                                     |
| `utils.ts`        | 通用纯工具集合（deepClone/debounce/throttle…）                                                         |

## 二、网络/API 层（深模块 `api/`，2026-08-31）

`api/` 内：`chatApi` `imageApi` `videoApi` `httpClient` `localToolApi` `filesApi` `relayProxy` `genIntent` `pollTask`

> **深模块**：外部统一 `import from 'base/api'`（index.ts 入口），内部互引走 `./` 相对。
> **relay 收口（2026-09-03）**：chat/image/video 门面直连 relay（`chatApi→/api/relay`；`imageApi/videoApi→/api/generate`），旧 `proxyGenerate`（/api/proxy 出站）已整文件退役。SSE 三件套不再走 proxyGenerate；`relayProxy` 为唯一 relay 客户端。

## 三、存储层（深模块 `storage/`，2026-08-31）

`storage/` 内：`storageAdapter` `kvStore` `storageQuota` `persistFailureBus`

> **深模块**：外部统一 `import from 'base/storage'`（index.ts 入口）。`contentStore`（横切唯一入口）与 `backupStore`（上层备份编排，依赖 contentStore/projectStore）留在 base/ 根。

## 四、store（各业务/领域独立状态）

`assetStore` `projectStore` `skillStore` `taskStore` `promptHubStore` `appSettings` `accountsStore`(settings/) `agentModelStore`(settings/) `providerStore`(settings/)

## 五、画布编排（核心链路，勿轻动）

`NodePalette` `nodeDefaults` `nodePrefs` `groupNodes` `deriveNodes` `lazyNode` `CanvasEdgesContext` `historyStack` `workflowRuntime` `ArrangeConfirm` `lod`

## 六、纯函数/工具（无副作用，可单测）

`asyncGuard` `clipboard` `imageCompress` `imageUpscale` `imageUrl` `mediaType` `previewUrl` `refToken` `requestModes` `volumePolicy` `uploadDirs` `resultUrlExtractor` `externalizeInline` `faceMosaic` `genErrors` `degrade` `providerModels` `providerProtocols` `promptChips` `promptFlow` `promptManager` `promptMention` `nodeDefaults`(与画布共用) `upstreamLink` `d3dPersistence`(director3d 持久化协议) `videoEngine`

## 七、纯 UI 组件（通用展示基座，被多节点/App 复用）

`NodeShell` `ModelSelect` `LazyImage` `NodeTitle` `ToolbarButton` `Select` `ToastContainer` `ConfirmContainer` `ErrorBoundary` `ExpandablePanel` `ContextMenu` `CometParticles` `JianyingIcon` `VideoThumbnail` `ResizeFullscreenHandle` `GeneratingOverlay` `GenerateButton`

## 八、应用壳/大面板组件（只被 App.jsx 或单入口用）

`TopNav` `LeftPanel` `TaskCenter` `AssetLibrary` `MaterialStrip` `GeneratedView` `PromptHub` `PromptLibrary` `PromptLibraryButton` `PromptInput` `ProjectSelector` `FullscreenEditor` `FullscreenModal` `LocalToolConnectModal` `ImageEditor` `OverlayEditor` `ImageZoomDialog` `InlineImageCropper` `FaceMosaicEditor` `EmptyCanvasGuide` `CanvasToolbar` `HoverToolbar` `PanoViewer` `ScriptBoxSchema`(已移 scriptbox/) `useImageHoverActions`

> ⚠️ 已迁出 base/ 的脚本盒专属件：`scriptBoxEngine/Prompts/PromptResolver/Schema` → `scriptbox/`（见 CONTEXT §六·B）。

## 找文件速查

- 想发请求 → 看「二 网络/API 层」

- 想存数据 → 看「一 contentStore」或「四 store」

- 想改画布节点行为 → 看「五 画布编排」+ `spec/NEW-NODE-GUIDE.md`

- 想加通用函数 → 看「一 utils.ts」优先，再「六 纯函数」

- 想复用 UI → 看「七 纯 UI」

