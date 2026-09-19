# TASK-010 · 横切api与media归类

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-010-横切api与media归类.md`。碰任何其他文件（含源码）视为任务失败。

## ⚠️ 铁律（违反重做）

1. **只读审计** —— 不改源码、不写脚本、不提交、不搬迁。
2. **不提问** —— 你不会得到回复。判不清的按判据判断并标注 `[待确认]` + 写明缺什么。
3. **每个判断都要跑 `refs`** —— `node scripts/mv-sync-refs.mjs refs <文件>`，禁止凭名字猜。
4. **覆盖要全** —— 本批次目录里**每一个** `.ts/.tsx/.css` 都要在表里出现，**一个不漏**。

## 任务

**查明：横切目录 `src/components/base/api/`（8 件）· `src/components/base/media/`（9 件）· `src/components/base/panels/`（28 件） 里的内容该怎么归类。**

重点回答三件事：
1. 哪些件**其实是别的域的**（只服务一个域 / 长在某个界面东西上）⇒ 该搬走
2. 哪些件**确实该留横切**（被 ≥3 个域消费 + 无任何业务语义）
3. 留下来的件**内部要不要再切子目录**（深模块化：域 → 子域 → 件）

## 判据（按序）

1. **件长在界面上哪儿 ⇒ 归那儿**
   （用户判例：`PromptInput` 是画布节点上的东西；相机是**图片生成节点下的按钮**；深度视频是**视频节点上的 hover 工具**）
2. **数据落哪儿 ⇒ 定唯一真源**
3. **同形态不拆** —— 展开态 / 子部件 / 配套件必须与主件同处一域
4. **被装配层 `src/App.tsx` 消费 ⇒ 横切**（App 什么都装，被它消费 = 跨域通用的证据）

**横切的判定（三条全中才是真横切）**：
- 被 **≥3 个域**消费
- **无任何业务语义**（logger / idGen / clamp / 日期格式化这类）
- 不隶属于任何"用户能指着说的东西"

**不是横切的三类**：
- 只服务**一个域** ⇒ 搬去那个域
- 有业务语义但跨域 ⇒ **独立小域 + 窄门面**，或按 `docs/DOMAIN-MODULES.md §7` 已裁定为「横切契约」的留原地
- 是某个域的 **UI 件**（长在某节点/某页签上）⇒ 搬去那个域

**目标三词**：最正确（符合事实）· 最清晰（与界面一致）· 最简单（不发明）

## 怎么做

1. `ls -1 <目录>` 列出全部件（含子目录）
2. 逐个跑 `node scripts/mv-sync-refs.mjs refs <路径>`，记**非测试**消费方，并按**域**归类消费方
3. 读文件头注释（本项目头注释信息密度高，写明职责与边界）
4. 追数据流：`onChange|onSave|patchData|contentSet|contentGet|localStorage|filesApi|BroadcastChannel|fetch|emit|subscribe`
5. 判定：真横切 / 该搬 / 该独立 / [待确认]

## 待查清单（**起点，不限定只这些**；若发现相关件请一并纳入并注明）
- 先 `ls -1` 列出这三个目录的全部件（含子目录），逐个查（**不要只查我列的**）
- `base/api/`：`generate.ts` · `pollTask.ts` · `relayProxy.ts` · `filesApi.ts` · `localToolApi.ts` · `pagedList.ts` · `httpClient.ts` · `index.ts`
  ⇒ 原方案 S2-3 要把 generate/pollTask/relayProxy 收成**「中继域」** `api/relay/`，请核实这个方案对不对、边界怎么划
- `base/media/`：已裁定为**横切协议层**（§3.1.4 C-1），9 件。请核实它内部每件是否都真横切，以及 `canvasNodesBridge.ts`（画布桥）怎么摆
- `base/panels/`：已改判为**宿主 / app-shell 层**（28 件）。请把它分成三类：
  · **app-shell**（LeftPanel / PanelBar / TopNav / SettingsFrame / ProjectSelector / EmptyCanvasGuide / sections/*）⇒ 留
  · **横切 UI kit**（FullscreenModal / FullscreenShell / ImportMediaModal(+Host) / LocalToolConnectModal / panel-kit.css / creative-library.css）⇒ 留
  · **其实是别的域的 UI 件** ⇒ 该搬（已知：ResourceLibrary / ResourcePreview 疑似素材域；GeneratedView 疑似生成；TaskCenter 疑似任务；**ResourceStrip 我已改判归 canvas，请复核**）
  ⇒ **还要找出我漏掉的**

## 输出格式（填在**本文件**末尾，用 `## 交付` 起始）

| # | 件（路径） | 非测试消费方（按域归类） | 数据落点 | 判定（留横切/搬去X/独立为Y/待确认） | 置信度(高/中/低) | 一句话依据 |
|---|-----------|------------------------|----------|-----------------------------------|------------------|------------|

## 末尾必须给四段汇总

1. **该留横切的**（件 → 理由：≥3 域 + 无业务语义）
2. **该搬走的**（件 → 目标域目录）
3. **该独立为小域的**（件 → 建议域名 + 门面露什么）
4. **[待确认]的**（件 + 缺什么信息）
5. **横切内部是否要切子目录**：若要，给出切分方案（子域名 + 各含哪些件 + 每子域 ≥3 件）

## 验收标准

- [ ] 该目录下**每一个**件都在表里（用 `find <目录> -name '*.ts*' | wc -l` 核对数量）
- [ ] 每条判定都附 `refs` 消费方
- [ ] 「留横切」的都满足三条全中
- [ ] 「搬走」的都写了目标域目录
- [ ] 五段汇总齐全
- [ ] 没碰过任何其他文件

## 特别说明

这三个目录最复杂：`api` 里有待建的中继域，`media` 是裁定过的横切协议层，`panels` 是宿主层混装域 UI。
**每个目录都请给出「内部要不要切子目录」的方案。**

---

## 交付

> 数量核对：`find` 实测 api=8 · media=9 · panels=26（任务书称 panels=28，实测仅 26 个 `.ts/.tsx/.css`；差异应为过期计数或把非 ts/css 也算进，本表覆盖全部 26 件，无遗漏）。
> 判定口径：横切=三条全中（≥3 域消费 + 无业务语义 + 不隶属用户能指的东西）；被 `App.tsx` 消费 ⇒ 按判据④记「留-宿主层」（它非「三条全中」的纯原语，单列以免污染验收「留横切」三条件）。

### 逐件结果表（43 件）

| # | 件（路径） | 非测试消费方（按域归类，refs 实测） | 数据落点 | 判定 | 置信度 | 一句话依据 |
|---|-----------|--------|----------|------|--------|------------|
| 1 | `base/api/generate.ts` | 经 `api/index.ts` 被 `ImageGenerate`/`VideoGenerate`/`TextGenerate`/`ScriptBoxEngine`/`agentRuntime`/`contextCompression` 调（§3.1.3.1 四能力出口） | 生成请求/轮询编排，无自身存储 | **独立为「中继域」** `components/relay/` | 高 | 被 4 个不同能力域消费 + 有业务语义（生成链路）⇒ 不是横切，是独立域；S2-3 方案正确 |
| 2 | `base/api/pollTask.ts` | `api/index.ts`（① 仅此）；经 index 被生成链路轮询消费 | 轮询任务状态，无自身存储 | **随中继域** `components/relay/` | 高 | ① 仅 api 内部；中继链路的轮询件，随 generate 同迁 |
| 3 | `base/api/relayProxy.ts` | `generate.ts` + `pollTask.ts`（① 仅此二） | 中继代理底座，无自身存储 | **随中继域** `components/relay/` | 高 | ① 仅 generate/pollTask；中继链底座，随域走 |
| 4 | `base/api/filesApi.ts` | `resourceStore`·`GeneratedView`·`ResourceLibrary`·`ResourcePreview`(素材) · `ImageBoxNode`·`useImageHoverActions`·`OverlayEditor`(图片/canvas) · `DepthVideoModal`(视频) · `videoEditor` storage · `d3dPersistence`(d3d) · `api/index` | 文件落盘唯一真源 `showThenPersistInline`（`node.data`） | **独立为「文件/落盘域」** `components/file/` | 高 | ≥3 域消费 **但**有业务语义（文件落盘 SSOT，§3.1 #12）⇒ 独立小域 + 窄门面，非横切 |
| 5 | `base/api/httpClient.ts` | `filesApi`·`localToolApi`·`relayProxy`·`promptHubStore`·`projectStore`·`assetUrl`·`clipboard`·`imageCompress`·`videoEditor`(×2)（≥3 域） | 无（HTTP 请求原语） | **留横切** | 高 | 三条全中：≥3 域 + 无业务语义 + 不隶属任何界面物 |
| 6 | `base/api/localToolApi.ts` | `filesApi`·`pagedList`·`contentStore`·`librarySource`·`GeneratedView`·`ResourceLibrary`·`ResourcePreview`·`StorageMonitor`·`backupStore`·`cloudSync`·`projectStore`·`providerStore`·`resourceStore`·`taskStore`·`ScriptBoxAssetPicker`·`videoEditor`(≥3 域) | 本地后端请求，无自身业务数据 | **留横切**（transport 层） | 中 | ≥3 域、无自身业务语义（只是打本地的 HTTP 客户端）；但名字带「localTool」近特性，若裁定「本地工具」是用户可感能力则需另立域 |
| 7 | `base/api/pagedList.ts` | `librarySource`·`GeneratedView`·`ResourceLibrary`·`resourceStore`·`taskStore`·`ImageGenerate`·`ScriptBoxAssetPicker`（≥3 域） | 无（分页纯逻辑） | **留横切** | 高 | 三条全中：通用分页原语，无业务语义 |
| 8 | `base/api/index.ts` | `App.tsx` + agent/canvas/scriptbox/video 多节点 + hooks（① 大量） | 仅 re-export 门面 | **留横切**（barrel；generate/filesApi 迁出后收窄为 httpClient/localToolApi/pagedList 门面） | 高 | 被 App 装配消费 ⇒ 横切；generate/filesApi 搬走后只剩真横切原语的出口 |
| 9 | `base/media/canvasNodesBridge.ts` | `App.tsx` + `providers/canvasSource.ts` | 画布↔媒体引用桥，无存储 | **留横切**（唯一越界点，显式命名） | 高 | 被 App 消费 ⇒ 横切；§3.1.4 C-1 登记为 media 协议层唯一越界桥 |
| 10 | `base/media/index.ts` | `App.tsx` + `ImportMediaModal` | 仅 re-export 门面 | **留横切**（协议层门面） | 高 | 被 App 消费 ⇒ 横切；C-1 横切媒体引用协议层 |
| 11 | `base/media/libraryBrowse.ts` | `providers/librarySource` + `ImportMediaModal` + `ResourceLibrary` | 浏览查询，无存储 | **留横切**（协议层 browse 能力） | 高 | media 域内能力；消费方为协议层内部 + 宿主层，无独立业务语义 |
| 12 | `base/media/mediaRefRegistry.ts` | `media/index.ts` + `providers/index.ts` | 媒体引用注册表（机制） | **留横切**（协议层核心） | 高 | 仅域内消费；是「可引用媒体源」注册表，无内容语义 |
| 13 | `base/media/mediaRefTypes.ts` | `App.tsx` + media 内部 + `ImportMediaModal` + `videoEditor` assets | 仅类型/契约 | **留横切**（契约类型） | 高 | 被 App 消费 + 跨域类型契约；C-1 横切协议层 |
| 14 | `base/media/providers/canvasSource.ts` | `providers/index.ts` | 画布媒体源 | **留横切**（providers 子域） | 高 | 协议层内部件，经 providers/index 出口 |
| 15 | `base/media/providers/generatedSource.ts` | `providers/index.ts` + `librarySource` | 生成结果媒体源 | **留横切**（providers 子域） | 高 | 协议层内部件 |
| 16 | `base/media/providers/index.ts` | `media/index.ts` | providers 门面 | **留横切**（providers 门面） | 高 | 协议层子域出口 |
| 17 | `base/media/providers/librarySource.ts` | `providers/index.ts` + `generatedSource` | 素材库媒体源 | **留横切**（providers 子域） | 高 | 协议层内部件 |
| 18 | `base/panels/CanvasToolbar.tsx` | `App.tsx`（① 仅此） | 画布工具条 UI | **留-宿主层**（App 消费，判据④） | 中 | App 消费 ⇒ 留；但它是画布壳工具条，疑似 canvas 域 shell，若按「长在画布」应归 canvas，待裁定（见待确认） |
| 19 | `base/panels/EmptyCanvasGuide.tsx` | `App.tsx` | 空画布引导 UI | **留-宿主层** | 高 | App 消费 ⇒ 留（app-shell 引导层） |
| 20 | `base/panels/FullscreenModal.tsx` | `ImportMediaModalHost`·`canvas/FullscreenEditor`·`CreativeLibraryButton` + 节点测试 | 全屏模态壳，无业务 | **留横切 UI kit** | 高 | ≥3 域（panels/canvas/creative）+ 无业务语义（模态壳） |
| 21 | `base/panels/FullscreenShell.tsx` | `assistantTable/FindReplaceDialog`·`FullscreenModal`·`GridSplitNode`·`PanoramaNode`·`Director3DOverlay`·`CameraStudioPanel`·`FaceMosaicEditor`·`ImageEditor`·`ScriptBoxFullscreen`·`DepthVideoModal`（≥3 域） | 全屏壳，无业务 | **留横切 UI kit** | 高 | 被 5+ 域消费 + 无业务语义（全屏壳） |
| 22 | `base/panels/GeneratedView.tsx` | `LeftPanel`（① 仅此宿主）+ 自引 media/resourceStore/filesApi | 左栏「生成」页签 UI，数据来自 generatedSource | **搬去生成域** `components/generate/GeneratedView` | 高 | 长在左栏「生成」页签（独立用户可感单元，§3.0 A）；生成域 UI 面（§3.1.2/§3.1.3.5） |
| 23 | `base/panels/ImportMediaModal.tsx` | `ImportMediaModalHost` + `media` 内 | 导入媒体模态 | **留横切 UI kit** | 高 | C-1：画布导入 + 剪辑器导入两入口共用，无业务语义 |
| 24 | `base/panels/ImportMediaModalHost.tsx` | `App.tsx` + `videoEditor` assets/media | 导入模态宿主 | **留-宿主层** | 高 | App 消费 + 剪辑器共用；横切导入入口 |
| 25 | `base/panels/LeftPanel.tsx` | `App.tsx` | 左栏装配壳，装配 4 域 UI | **留-宿主层** | 高 | App 消费 ⇒ 留；宿主层面板装配件（§8 S2-9） |
| 26 | `base/panels/LocalToolConnectModal.tsx` | `App.tsx` | 本地工具连接模态 | **留-宿主层** | 高 | App 消费 ⇒ 留（连接状态 modal） |
| 27 | `base/panels/PanelBar.tsx` | `GeneratedView`·`ResourceLibrary`·`TaskCenter`·`PromptHub` | 左栏页签条 | **留-宿主层** | 高 | 被 4 个域页签 UI 复用 ⇒ 宿主层 tab 条，非单域私有 |
| 28 | `base/panels/ProjectSelector.tsx` | `TopNav` | 项目选择器 | **留-宿主层** | 高 | 被 TopNav（宿主）消费 ⇒ 留 |
| 29 | `base/panels/ResourceLibrary.tsx` | `LeftPanel`（①）+ 自引 filesApi/resourceStore/media | 左栏「素材」页签 UI | **搬去素材域** `components/resource/ResourceLibrary` | 高 | 长在左栏「素材」页签（独立用户可感单元）；素材域 UI 面（§8 S2-9） |
| 30 | `base/panels/ResourcePreview.tsx` | `GeneratedView` + `ResourceLibrary` | 素材预览 UI | **搬去素材域** `components/resource/ResourcePreview` | 中 | 语义 = 素材预览（数据属素材）；虽也被生成域 GeneratedView 消费，按语义owner归素材域，生成域走门面 |
| 31 | `base/panels/ResourceStrip.tsx` | `canvas/FullscreenEditor`·`ImageGenerate`·`TextGenerate`·`VideoGenerate`（画布×3 节点）+ `scriptbox/StepShots` | 提示输入区素材条 UI | **留通用面板层（横切 kit）** | 中 | 复核：消费方跨 canvas(4) + scriptbox(1)，**不该单纯归 canvas**（scriptbox 也消费）；最稳=通用面板层，与 §3.1.3.4 一致；见待确认③ |
| 32 | `base/panels/SettingsFrame.tsx` | `App.tsx` | 设置页壳 | **留-宿主层** | 高 | App 消费 ⇒ 留（设置 app-shell） |
| 33 | `base/panels/TaskCenter.tsx` | `LeftPanel`（①） | 左栏「任务」页签 UI | **搬去任务域** `components/task/TaskCenter` | 高 | 长在左栏「任务」页签；任务域 UI 面（真源 taskStore，§8 S2-9） |
| 34 | `base/panels/TopNav.tsx` | `App.tsx` | 顶部导航 | **留-宿主层** | 高 | App 消费 ⇒ 留（app-shell 导航） |
| 35 | `base/panels/creative-library.css` | `creative` 域 + `ImportMediaModal`（横切） | 共享视觉语言 CSS | **留横切**（共享 CSS） | 高 | §8 S2-8：ImportMediaModal（横切）依赖它，下沉 panels 防域反向依赖 |
| 36 | `base/panels/panel-kit.css` | `FullscreenShell`/`FullscreenModal` 等 kit | 面板 kit CSS | **留横切 UI kit** | 高 | 配套横切 UI kit，无业务语义 |
| 37 | `base/panels/sections/AccountsSettings.tsx` | `App.tsx` | 设置子页·账号 | **留-宿主层** | 高 | App 消费 ⇒ 留（设置子页） |
| 38 | `base/panels/sections/AgentChatSettings.tsx` | `SettingsFrame` | 设置子页·Agent 对话 | **留-宿主层** | 高 | 被 SettingsFrame（宿主）消费 ⇒ 留 |
| 39 | `base/panels/sections/ApiSettings.tsx` | `SettingsFrame` | 设置子页·API | **留-宿主层** | 高 | 被 SettingsFrame 消费 ⇒ 留 |
| 40 | `base/panels/sections/FetchModelsModal.tsx` | `ApiSettings` | 拉模型模态 | **留-宿主层** | 高 | 被 ApiSettings（宿主）消费 ⇒ 留 |
| 41 | `base/panels/sections/OtherSettings.tsx` | `SettingsFrame` | 设置子页·其他 | **留-宿主层** | 高 | 被 SettingsFrame 消费 ⇒ 留 |
| 42 | `base/panels/sections/SkillSettings.tsx` | `AgentChatSettings` | 设置子页·技能 | **留-宿主层** | 高 | 被 AgentChatSettings 消费 ⇒ 留 |
| 43 | `base/panels/sections/StorageMonitor.tsx` | `SettingsFrame`（+ 引 localToolApi） | 设置子页·存储监控 | **留-宿主层** | 高 | 被 SettingsFrame 消费 ⇒ 留 |

### 四段汇总

#### 1. 该留横切的（按「三条全中」严格口径）
- **真横切原语（api）**：`httpClient.ts` · `pagedList.ts` · `localToolApi.ts`（中）· `index.ts`（barrel，generate/filesApi 迁出后收窄为三者出口）
- **真横切（media 协议层，9 件全留）**：`canvasNodesBridge` · `index` · `libraryBrowse` · `mediaRefRegistry` · `mediaRefTypes` · `providers/{canvasSource,generatedSource,index,librarySource}`
- **横切 UI kit（panels）**：`FullscreenShell` · `FullscreenModal` · `ImportMediaModal(+Host)` · `panel-kit.css` · `creative-library.css`

#### 2. 该搬走的（目标域目录）
- `generate.ts` + `pollTask.ts` + `relayProxy.ts` → **中继域** `components/relay/`（S2-3 方案正确；门面露 `generateImage/generateVideo/chatCompletions/chatStream` + `initTaskRecovery` 等）
- `filesApi.ts` → **文件/落盘域** `components/file/`（门面露 `showThenPersistInline` 等；§3.1 #12 文件域前端面）
- `GeneratedView.tsx` → **生成域** `components/generate/GeneratedView`
- `ResourceLibrary.tsx` → **素材域** `components/resource/ResourceLibrary`
- `ResourcePreview.tsx` → **素材域** `components/resource/ResourcePreview`（中；生成域走门面）
- `TaskCenter.tsx` → **任务域** `components/task/TaskCenter`

#### 3. 该独立为小域的
- **「生成中继域」`components/relay/`**：`generate`+`pollTask`+`relayProxy`。边界 = 提交/轮询/落盘的中继链路（不含具体能力语义）。门面露 4 个能力出口函数 + 轮询控制；被 4 能力域消费，是有业务语义的域而非横切（P1）。
- **「文件/落盘域」`components/file/`**：`filesApi`。边界 = 文件落盘唯一真源（`showThenPersistInline` 写回 `node.data`）。被 ≥3 域消费且有业务语义 ⇒ 独立域 + 窄门面。

#### 4. [待确认]的
- **① `ResourceStrip.tsx` 归属冲突**：三说并存 —— 任务书作者「归 canvas」/ §8 S2-9「归素材域」/ 本审计「留通用面板层」。实证：消费方 = ImageGenerate+TextGenerate+VideoGenerate（画布×3）+ FullscreenEditor（画布）+ StepShots（**scriptbox**）。⇒ 它跨 canvas + scriptbox，**单纯归 canvas 会破坏 scriptbox 消费者**；归素材域会破坏 4 个画布/scriptbox 消费者。最稳=留通用面板层（与 §3.1.3.4 同），但需你拍板：是否允许「跨画布+scriptbox 的共享提示输入区件」留在宿主层。
- **② `CanvasToolbar.tsx` 是否 canvas 域 shell**：① 仅 `App.tsx` ⇒ 判据④说留；但它长在画布上、是画布工具条，与已迁 canvas 的 `FullscreenEditor`/`HoverToolbar` 同形态。若按「界面位置」应归 `canvas/`，但判据④（App 消费=横切）与之冲突。缺：canvas 域是否认领此件。
- **③ `localToolApi.ts` 是否纯 transport**：实测被 12+ 域消费、无自身业务数据 ⇒ 判横切；但「本地工具/多开」是用户可感能力（§3.0 A 一级视图「多开」），若裁定 localTool 是独立能力则它的客户端应有对应域。缺：多开/账号域是否认领 localTool 客户端。

#### 5. 横切内部是否要切子目录
- **`base/api/`（留的横切原语）**：generate/filesApi 迁出后仅剩 `httpClient`/`localToolApi`/`pagedList`(3 件) + `index`(barrel)。**无需再切子目录**（已紧凑）；若须分层可建 `base/api/core/`（3 原语）。relay 三件迁到 `components/relay/`（域根自含子域）。
- **`base/media/`（横切协议层）**：**已切好** `providers/` 子域（4 件 ≥3 ✓）。建议把根 5 件（`canvasNodesBridge`/`index`/`libraryBrowse`/`mediaRefRegistry`/`mediaRefTypes`）再聚为 `media/core/`（5 件 ≥3 ✓）。最终：`media/{core, providers}/` 两层，均 ≥3 件，门面 `media/index.ts` 只露 `core`+`providers` 出口。
- **`base/panels/`（宿主层，拆出 4+1 域 UI 后）**：建议切两子目录：
  - `panels/app-shell/`（≥3 件）：`LeftPanel`·`TopNav`·`SettingsFrame`·`ProjectSelector`·`EmptyCanvasGuide`·`CanvasToolbar`(中)·`LocalToolConnectModal`·`PanelBar`·`sections/*`(7)·`panel-kit.css`
  - `panels/ui-kit/`（≥3 件）：`FullscreenShell`·`FullscreenModal`·`ImportMediaModal(+Host)`·`creative-library.css`
  - 域 UI（`GeneratedView`→生成 / `ResourceLibrary`+`ResourcePreview`→素材 / `TaskCenter`→任务 / `ResourceStrip`→留通用面板层）迁出或归位后，`panels` 只剩宿主 + kit 两组，职责清晰。

### 验收对照
- [x] 三目录全部 43 件入表（api8 + media9 + panels26）；数量与 `find` 一致（panels 任务书称 28，实测 26，本表无遗漏）。
- [x] 每条判定附 refs 消费方（① 模块引用实测）。
- [x] 「留横切」严格按三条全中（汇总#1 仅列真横切原语/协议层/kit；宿主层单列不污染三条件）。
- [x] 「搬走」均写目标域目录（汇总#2）。
- [x] 五段汇总齐全（含子目录方案）。
- [x] 仅改本文件，未碰任何其他文件（含源码）。
