# base/ · 通用能力地基（目录地图）

> 定位：全项目「通用地基」，所有层都可依赖它；**业务域反向依赖它 = 架构违规**（`npm run check:arch` 拦截）。
> **更新(2026-11-06 · 152 第六批)**：业务域物已按域迁出为 `src/components/<域>/`（canvas/agent/videoEditor/image/video/text/scriptbox/resource/task/settings/creative/prompt/generate 等）——本 README **只列现状**（以目录现测为准），历史迁移记录见 git log 与 `spec/DATAFLOW.md §十六`；发现架构不合理要移位置/改名，一律走 `scripts/mv-sync-refs.mjs`（见 CLAUDE §5.4·8）。

## 目录结构（2026-11-06 现测）

| 子目录        | 语义                                       |
| ----------- | ---------------------------------------- |
| `core/`     | 横切唯一入口（P0 红线）+ 通用地基工具（含 `event/` `interaction/` `log/` 三个子包） |
| `api/`      | 发网络请求的模块                                 |
| `storage/`  | 持久化底层（深模块）                               |
| `store/`    | 业务独立状态库                                  |
| `media/`    | 媒体引用域（mediaRef 注册表/类型，门面 `index.ts`）     |
| `ui/`       | 通用展示基座（现仅 `JianyingIcon.tsx`；其余展示件已随域迁出）  |
| `panels/`   | 应用壳/大面板（TopNav/LeftPanel/ProjectSelector 等） |
| `utils/`    | 无副作用纯函数工具                                |

> **已不存在的子目录**（勿再引用）：`canvas/`（画布机制件 → `components/canvas/`）、`editors/`（编辑器 → 各业务域，如 `image/editors/`）、`prompt/`（提示词域 → `components/prompt/` 与 `canvas/shell/PromptInput.tsx`）、`depthVideo/`（→ `components/video/depthVideo/`）、`settings/`（2026-09-04 拆分，件归 ui/panels/store；后随域重组迁出）。

## 一、core/ （横切唯一入口 P0 红线 + 通用地基）

* **根**：`contracts.ts`（apiRegistry/EVENTS/STORAGE_KEYS/NODE_TYPES，**多个 scripts/ 校验按字面路径引用，改名/移动须同步 scripts**）、`config.ts`（环境变量/常量）、`contentStore.ts`（存储唯一入口）、`idGen.ts`、`nodeSizePatch.ts`（节点尺寸读原语/withNodeSize，二写收口唯一实现）、`runtimeModelUrl.ts`、`utils.ts`（deepClone/debounce/throttle…）、`videoEditorKeys.ts`
* `event/`：`eventBus.ts`（唯一事件通道）、`toastStore.ts`（统一通知 store）、`confirmStore.ts`（统一确认弹窗）
* `interaction/`：`uiHooks.ts`（useSizeSync/useNodeResize/useContentHeightSync 等）、`modalLayer.ts`、`editorSession.ts`
* `log/`：`logger.ts`（唯一日志出口）、`degrade.ts`（reportDegrade 统一日志 + toast 节流）、`backendLogStream.ts`（启动级 SSE 镜像 localTool 日志）

## 二、api/ （发网络请求）

`generate 相关门面与请求件`：`localToolApi.ts` `filesApi.ts` `httpClient.ts` `pagedList.ts` `index.ts`
（清单以目录现测为准；生成/relay 编排件已随域重组迁出 base/）

> **深模块**：外部统一 `import from 'base/api'`（index.ts 入口）。

## 三、storage/ （持久化底层，深模块）

`storageAdapter.ts` `storageQuota.ts` `legacyRawKey.ts`（历史裸键迁移原语）`contentPersistStorage.ts`（zustand persist × contentStore 唯一适配，152-V3）`index.ts`

> **深模块**：外部统一 `import from 'base/storage'`。`contentStore`（core/ 横切）为唯一路由入口，`backupStore`（store/）负责上层备份编排。

## 四、store/ （业务独立状态库）

`projectStore.ts` `taskStore.ts` `backupStore.ts` `cloudSync.ts` `appSettings.ts` `autoSync.ts`
（resourceStore/skillStore/accountsStore/providerStore/settingRegistry 等已迁出为对应域模块）

## 五、media/ （媒体引用域）

`index.ts`（门面）`mediaRefRegistry.ts` `mediaRefTypes.ts`

## 六、utils/ （无副作用纯函数工具，可单测）

`captureFrame.ts` `genErrors.ts` `imageCompress.ts` `providerModels.ts` `uploadDirs.ts`
（media 判型/URL 族已迁 `base/media/` 与各业务域）

## 七、ui/ （通用展示基座）

`JianyingIcon.tsx`（其余展示件——NodeShell/Toast/Confirm 等——已随域迁出，NodeShell 在 `components/canvas/parts/`）

## 八、panels/ （应用壳/大面板）

`TopNav.tsx` `LeftPanel.tsx` `ProjectSelector.tsx` `PanelBar.tsx` `FullscreenModal.tsx` `FullscreenShell.tsx` `ImportMediaModal.tsx` `LocalToolConnectModal.tsx` `panel-kit.css`
（TaskCenter/ResourceLibrary/Settings 等已迁出为对应域模块）

## 找文件速查

* 想发请求 → `api/`
* 想存数据 → `core/contentStore` 或 `store/`；存储键登记 → `core/contracts.ts` STORAGE_KEYS
* 想改画布节点行为 → `components/canvas/` + `spec/NEW-NODE-GUIDE.md`
* 想加通用函数 → `core/` 或 `utils/`
* 想复用 UI / 改应用壳 → `ui/` / `panels/`；业务域件 → `components/<域>/`
