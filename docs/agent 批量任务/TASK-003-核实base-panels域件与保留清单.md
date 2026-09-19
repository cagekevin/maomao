# TASK-003 · 核实base-panels域件与保留清单

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-003-核实base-panels域件与保留清单.md`。碰任何其他文件（含源码）视为任务失败。

## ⚠️ 铁律（违反重做）

1. **只读审计** —— 不改任何源码、不写脚本、不提交、不建新文件。
2. **不提问** —— 你不会得到回复。任务书没写清的，按判据自行判断并**显式注明你的假设**。
3. **结论必须有证据** —— 每条结论必须附 `refs` 实测的消费方 + 数据落点。**禁止凭文件/目录名猜归属**（本项目已多次因"按名字分类"判错）。

## 项目背景

本项目（React 画布应用）正在做**域模块化**：把每个文件放到它**事实上该在**的域目录里，目标是让 AI 和人都能一眼找到东西。

现状的目标域目录（`src/components/` 下）：`canvas`（画布/节点机制）· `video`（视频能力，已建）· `agent` · `videoEditor` · `scriptbox` · `director3d`（例外，禁重审）；`src/components/base/` 下：`core` `utils` `ui`（横切原语）· `panels`（宿主/app-shell 层）· `media`（横切协议层）· `api` `storage`（横切）· `store`（待拆，一个目录住 8 个域）· `prompt`（待拆）· `creative`。

**已裁定的域清单（用户定）**：内容能力域 `image` / `video` / `text`；左栏页签域 `resource`（素材）/ `generate`（生成）/ `task`（任务）/ `prompt`（提示词）。这些域目录**部分尚未建**，你可以建议"应建某目录"。

## 你要回答的问题

**对每一件：它该放在哪个目录？** —— 依据**数据流**与**界面位置**，不是依据名字。

## 判据（四条，冲突时按序优先）

1. **件长在界面上哪儿 ⇒ 归那儿**
   （用户判例：`PromptInput` 是画布节点上面的东西；相机是**图片生成节点下面的一个按钮**；深度视频是**视频节点上的 hover 工具**）
2. **数据落哪儿 ⇒ 定「唯一真源」**
3. **同形态不拆** —— 一个 UI 形态的**展开态 / 子部件 / 配套件必须与主件同处一域**
   （判例：`FullscreenEditor` 是 `PromptInput` 的全屏展开态；`ResourceStrip` 是输入区里的素材条 ⇒ 都跟 `PromptInput` 走，不能因"素材"二字归素材域）
4. **被装配层 `src/App.tsx` 消费 ⇒ 横切，不搬**
   （App 什么都装 ⇒ "被 App 消费"是跨域通用的证据）

**补充规则**：
- **跨域消费不改归属**：A 域的件被 B 域消费 ⇒ 走 A 的门面，**不因此搬到 B**。
- **已裁定为「横切契约」的**（docs/DOMAIN-MODULES.md §7 有留痕）不搬。
- **消费者是横切编排层 `src/hooks/`**（本身无域语义）⇒ 不能据此判"归某域"，要看**它服务谁**。

## 怎么做（探索式，不限定范围）

1. 跑 `node scripts/mv-sync-refs.mjs refs <文件路径>` → 记下**非测试**消费方（看输出的「① 模块引用」段）。
2. 读该文件的**头注释**（本项目头注释写明职责/边界/唯一入口，信息密度高）。
3. **追数据流**：grep 该文件的 `onChange|onSave|patchData|patchNodeData|contentSet|contentGet|localStorage|sessionStorage|filesApi|BroadcastChannel|emit|subscribe` 等，回答三件事：**数据从哪来 · 谁写它 · 最终落到哪**（`node.data`？自己的存储键？别人传进来的参？网络？）。
4. **判断界面位置**：它长在哪个节点/哪个 UI 区域？若消费方是节点组件，去 `src/components/canvas/NodePalette.ts` 的 `paletteNodes` 查它的 `cat`（只有 image/video/text/other 四种，**产品写死的权威真源**）。
5. 给结论 + 置信度。

## 待核实清单（**这是起点，不限定只这些**）

**重要：以下清单只是起点。** 你若在追查中发现**同形态的配套件 / 展开态 / 被遗漏的相关件**，请**一并纳入并在报告中说明你扩展了什么**。
- `src/components/base/panels/ResourceStrip.tsx`
- `src/components/base/panels/ResourceLibrary.tsx`
- `src/components/base/panels/ResourcePreview.tsx`
- `src/components/base/panels/GeneratedView.tsx`
- `src/components/base/panels/TaskCenter.tsx`
- `src/components/base/panels/LeftPanel.tsx`
- `src/components/base/panels/PanelBar.tsx`
- `src/components/base/panels/TopNav.tsx`
- `src/components/base/panels/SettingsFrame.tsx`
- `src/components/base/panels/ProjectSelector.tsx`
- `src/components/base/panels/EmptyCanvasGuide.tsx`
- `src/components/base/panels/FullscreenModal.tsx`
- `src/components/base/panels/FullscreenShell.tsx`
- `src/components/base/panels/ImportMediaModal.tsx`
- `src/components/base/panels/ImportMediaModalHost.tsx`
- `src/components/base/panels/LocalToolConnectModal.tsx`
- `src/components/base/panels/sections/`（整个目录）

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `src/components/base/panels/ResourceStrip.tsx` |  |  |  |  |  |  |
| 2 | `src/components/base/panels/ResourceLibrary.tsx` |  |  |  |  |  |  |
| 3 | `src/components/base/panels/ResourcePreview.tsx` |  |  |  |  |  |  |
| 4 | `src/components/base/panels/GeneratedView.tsx` |  |  |  |  |  |  |
| 5 | `src/components/base/panels/TaskCenter.tsx` |  |  |  |  |  |  |
| 6 | `src/components/base/panels/LeftPanel.tsx` |  |  |  |  |  |  |
| 7 | `src/components/base/panels/PanelBar.tsx` |  |  |  |  |  |  |
| 8 | `src/components/base/panels/TopNav.tsx` |  |  |  |  |  |  |
| 9 | `src/components/base/panels/SettingsFrame.tsx` |  |  |  |  |  |  |
| 10 | `src/components/base/panels/ProjectSelector.tsx` |  |  |  |  |  |  |
| 11 | `src/components/base/panels/EmptyCanvasGuide.tsx` |  |  |  |  |  |  |
| 12 | `src/components/base/panels/FullscreenModal.tsx` |  |  |  |  |  |  |
| 13 | `src/components/base/panels/FullscreenShell.tsx` |  |  |  |  |  |  |
| 14 | `src/components/base/panels/ImportMediaModal.tsx` |  |  |  |  |  |  |
| 15 | `src/components/base/panels/ImportMediaModalHost.tsx` |  |  |  |  |  |  |
| 16 | `src/components/base/panels/LocalToolConnectModal.tsx` |  |  |  |  |  |  |
| 17 | `src/components/base/panels/sections/` |  |  |  |  |  |  |

## 报告末尾必须给三段汇总

1. **该搬的**（件 → 目标目录），按目标目录分组
2. **不该搬的**（件 + 为什么），特别标出"被 App.tsx 消费 ⇒ 横切"的
3. **你新发现的问题**：清单外的相关件、自相矛盾之处、我可能判错的地方

## 验收标准（自测）

- [ ] 清单里**每一件**都填完了 7 列，没有空格
- [ ] 每条"建议归属"都附了 `refs` 实测消费方 + 数据落点（不能只有结论）
- [ ] 置信度为「中/低」的，写明了**缺什么信息**
- [ ] 明确回答了：有没有件**同时**被 ≥2 个不同域消费？若有，判它归哪、为什么
- [ ] 末尾三段汇总齐全
- [ ] 没碰过任何其他文件

## 特别提示（供你验证，不要盲信）

- `base/panels` 已被裁定为**「宿主 / 挂载层」（app-shell）**：它里面的 app-shell 件（LeftPanel/PanelBar/TopNav/SettingsFrame/ProjectSelector/EmptyCanvasGuide/sections/*）**合法地**依赖各域，是要留下的；横切 UI kit（FullscreenModal/FullscreenShell/ImportMediaModal/LocalToolConnectModal/panel-kit.css/creative-library.css）也倾向留下。
- **要判断的是**：哪些件其实是**别的域的 UI**，被错放在面板层？我怀疑：`ResourceLibrary`/`ResourcePreview`（素材域）· `GeneratedView`（生成域）· `TaskCenter`（任务域）。
- **`ResourceStrip` 我已经改过一次判断**：原先判"素材域"（因名字带 Resource），后按**判据 3「同形态不拆」改为 canvas**（它是 prompt 输入区里的素材条，`FullscreenEditor` 里就嵌着它）。**请独立验证这个改判对不对** —— 跑 refs 看它的消费方是否集中在 prompt 输入区那一组。
- `ImportMediaModalHost` 的消费方是 `App.tsx` + `videoEditor` ⇒ 按判据 4 可能**不该搬**，请验证。
- 请回答：**`base/panels` 里还有没有我漏掉的「其实是别的域的件」？**

---

# 审计报告（独立核实，2026-09-19）

> 方法：对每个件跑 `node scripts/mv-sync-refs.mjs refs <文件>` 取**非测试模块引用**作为消费方证据；读头注释 + grep 数据流（resourceStore / taskStore / localToolApi / filesApi / generatedSource / contentSet / eventBus）确定数据落点；界面位置以 `LeftPanel.tsx` 的 `TABS` 与 `App.tsx` 装配为准。
> 关键实测：`LeftPanel` 的 `TABS = ['tasks'·任务, 'generated'·生成, 'assets'·素材, 'prompts'·提示词]`，并 `import TaskCenter / GeneratedView / ResourceLibrary / PromptHub` 四个域的面板——即 `base/panels` 是「装配四域 tab 的宿主」（scripts/check-arch.mjs:392 亦坐实）。
> **假设**：`resource` / `generate` / `task` 三个左栏页签域目录当前 `src/components/` 下**均不存在**（已 `list_dir` 核实），故下列「应建」为本审计的结论性建议。

## 审计表

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|--------|------------|
| 1 | `base/panels/ResourceStrip.tsx` | `canvas/FullscreenEditor`、`canvas/nodes/ImageGenerate`、`canvas/nodes/TextGenerate`、`canvas/nodes/_template/TemplateNode`、`scriptbox/StepShots`、`video/nodes/VideoGenerate` | 纯展示，props 注入（`images`/`texts`/`onInsert`/`onDisconnect`）；上游素材来自各节点 `useConnectedInputs` 连线；自身不落盘 | 生图/文本/视频/剧本盒/模板节点的「下方素材参考区」+ PromptInput 全屏态（仅 FullscreenEditor 1/6） | **`base/ui`（横切展示原语，反向改判，非 canvas）** | 中 | 6 个消费方横跨 canvas 节点(image/text/template)、video 节点、scriptbox、canvas 全屏编辑 **≥3 域**；`PromptInput` 自身**并不 import 它**，原「随 PromptInput 走 canvas」前提不成立；归任一内容域都会让其它域跨域 import，故作横切原语 |
| 2 | `base/panels/ResourceLibrary.tsx` | `LeftPanel.tsx`（仅；`ResourcePreview` 反身 import） | 真源 = `localToolApi`/`filesApi` 落盘（素材库根 `LIBRARY_ROOT`）+ `resourceStore` 前端索引（`onResourceSent`/`mergeResourcesFromBackend`/`libraryFoldersOf`）；`pagedList` 分页唯一实现 | LeftPanel「素材」tab（assets） | **`resource`（应建 `resource/`）** | 高 | 素材库主面板，数据真源是素材落盘+resourceStore；仅被 app-shell 的 LeftPanel 装配为 tab，按「跨域消费不改归属」不改其素材域 |
| 3 | `base/panels/ResourcePreview.tsx` | `ResourceLibrary.tsx` + `GeneratedView.tsx`（两面板共用唯一实现） | props 注入 `item: ResourceItem`；依赖 `ImageZoomDialog`/`filesApi.toAbsoluteFileUrl`/`useAssetDragToCanvas`；自身不落盘 | 素材库 + 生成 两面板的大图/视频/文字预览 overlay | **不搬（横切预览原语，留 panels 或 `base/ui`）** | 高 | 同时被 `resource` 域(ResourceLibrary) 与 `generate` 域(GeneratedView) 消费，是双域共享 overlay；归任一域都会令另一域跨域 import，故横切保留（此点与任务提示「疑为素材域」冲突，实测被生成面板共用） |
| 4 | `base/panels/GeneratedView.tsx` | `LeftPanel.tsx`（+ test） | 真源 = `base/media/providers/generatedSource`（`tasks` 目录硬编码，生成结果落盘）+ `pagedList` + `taskCompletionBus` 刷新；类型中文名取 `ASSET_TYPE_META` | LeftPanel「生成」tab（generated） | **`generate`（应建 `generate/`）** | 高 | 生成结果浏览面板，数据真源是 generatedSource(tasks 目录)；被 LeftPanel 装配为 tab 不改其生成域 |
| 5 | `base/panels/TaskCenter.tsx` | `LeftPanel.tsx`（+ test）；`taskStore.openTaskCenter` 控制其展开 | 真源 = `taskStore`（`useTasks`；`statusLabel`/`typeLabel`/`taskMediaKind` 唯一判据） | LeftPanel「任务」tab（tasks） | **`task`（应建 `task/`）** | 高 | 任务中心面板，数据真源 taskStore；`reportGenerate→openTaskCenter` 控制 LeftPanel 展开，但面板本身属任务域 |
| 6 | `base/panels/LeftPanel.tsx` | `App.tsx`（仅） | `taskStore.usePanel`/`useTasks`（展开态+角标）；装配 TaskCenter/GeneratedView/ResourceLibrary/PromptHub 四域 tab | 左侧滑出面板（app-shell 宿主） | **不搬（app-shell 宿主层）** | 高 | 仅被 App 装配，是 app-shell 的 tab 容器，合法依赖各域；判据4「App 消费⇒横切」 |
| 7 | `base/panels/PanelBar.tsx` | `GeneratedView`、`ResourceLibrary`、`TaskCenter`、`prompt/PromptHub` | 纯展示（`PanelSubBar`/`PanelPills`/`PanelMoreMenu`/`PanelListFoot`），无自有存储 | 各左侧面板的「外壳 chrome」（标题栏/过滤 pill/更多菜单/底栏） | **不搬（横切面板 chrome 原语；可归 `base/ui`）** | 高 | 面板外壳通用件，被 panels 内三面板 + `prompt` 域 PromptHub 共用，是跨域面板 chrome 原语 |
| 8 | `base/panels/TopNav.tsx` | `App.tsx`（仅） | `cloudSync`（上传/下载文案）、`ProjectSelector`（子件）；导航入口 props 由 App 注入 | 顶部导航（app-shell） | **不搬（app-shell）** | 高 | 仅 App 装配，顶部导航宿主 |
| 9 | `base/panels/SettingsFrame.tsx` | `App.tsx`（仅；`view==='settings'`） | 装配 `sections/*`（api/agent/other/storage）；本身不落盘 | 设置页（app-shell） | **不搬（app-shell 设置宿主）** | 高 | App 装配，设置页外壳 |
| 10 | `base/panels/ProjectSelector.tsx` | `TopNav.tsx`（仅） | props 注入 `onSwitch`/`onCreate`；导入/导出走 `eventBus`；无自有存储 | TopNav 内的「项目切换」菜单（顶栏子件） | **不搬（随 TopNav 留 app-shell；同形态不拆）** | 高 | 仅 TopNav 消费，是顶栏项目菜单子件，随宿主留 panels |
| 11 | `base/panels/EmptyCanvasGuide.tsx` | `App.tsx`（仅） | props 注入 `onAdd`；无存储 | 空画布引导（app-shell 空态） | **不搬（app-shell）** | 高 | 仅 App 装配，空画布引导 |
| 12 | `base/panels/FullscreenModal.tsx` | `ImportMediaModalHost`、`canvas/FullscreenEditor`、`canvas/nodes/_template/TemplateNode`、`creative/CreativeLibraryButton`（+ tests） | 通用全屏弹窗外壳，props 注入 children；无自有存储 | 全屏弹窗层（canvas 全屏编辑/模板节点/创意库/导入弹窗复用） | **不搬（横切 UI kit）** | 高 | 跨 canvas/creative/template/import 多域复用的全屏弹窗壳，横切保留 |
| 13 | `base/panels/FullscreenShell.tsx` | `agent/assistantTable/FindReplaceDialog`、`panels/FullscreenModal`、`canvas/nodes/GridSplitNode`、`PanoramaNode`、`director3d/Director3DOverlay`、`editors/*`(CameraStudioPanel/FaceMosaicEditor/ImageEditor)、`scriptbox/ScriptBoxFullscreen`、`video/depthVideo/DepthVideoModal`（+ test） | 通用全屏层壳（backdrop/anim），props 注入；无存储 | 全仓最通用的全屏层（agent/editor/canvas/director3d/video/scriptbox 都在用） | **不搬（横切 UI kit，最通用）** | 高 | 被 7+ 域复用的最底层全屏壳，横切保留 |
| 14 | `base/panels/ImportMediaModal.tsx` | `ImportMediaModalHost`（仅；+ test） | 导入媒体对话框内容；`libraryBrowse`（与素材库/弹窗宿主共用目录浏览规则）；`localToolApi`/`filesApi` 取媒体 | 导入媒体弹窗主体（被 Host 承载） | **不搬（随 Host 横切）** | 高 | 是 Host 的内容体，Host 被 App+videoEditor 双消费；导入动作跨全局与剪辑器，横切保留 |
| 15 | `base/panels/ImportMediaModalHost.tsx` | `App.tsx` + `videoEditor/ui/editor/panels/assets/views/media.tsx` | 「开关+全屏层」薄壳，落地动作 `onPick`/`onLocalFiles` 由宿主注入；不落盘 | 导入媒体弹窗宿主（全局导入 + 剪辑器导入共用） | **不搬（判据4：App 消费⇒横切）** | 高 | 被 App 与 videoEditor 双消费，全局/剪辑器共用，横切保留（与任务提示一致） |
| 16 | `base/panels/LocalToolConnectModal.tsx` | `App.tsx`（仅） | 本地引擎连接弹窗；连接态由 App 注入 / `useLocalToolStatus` | 本地引擎连接弹窗（app-shell 全局） | **不搬（app-shell 全局弹窗）** | 高 | 仅 App 装配，全局本地引擎连接弹窗 |
| 17 | `base/panels/sections/`（整目录 7 文件） | `App.tsx`(`AccountsSettings`, `view==='accounts'`)；`SettingsFrame`(ApiSettings/AgentChatSettings/OtherSettings/StorageMonitor)；`ApiSettings`(FetchModelsModal)；`AgentChatSettings`(SkillSettings) | 各设置分区读写各自配置（`contentSet`/`contentSubscribe`、`skillStore`、`cloudSync`、存储监控等），不统一落盘 | 设置页内分区（app-shell 设置） | **不搬（app-shell 设置分区；随 SettingsFrame）** | 高（AgentChatSettings/SkillSettings 主题涉 agent 域，见问题3） | 全部由 SettingsFrame/app-shell 装配，是设置页分区 chrome；其中 AgentChatSettings/SkillSettings 主题虽为 agent，但是「设置子页」而非 agent 运行 UI，留 app-shell 设置分区合理 |
| (扩) | `base/panels/CanvasToolbar.tsx`（清单外新增） | `App.tsx`（仅） | props 注入（`minimapOn`/`onArrange`/`onFitView`/`zoomPercentNode`/`performanceMode`/`localToolConnected`）；canvas 操作回调由 App 注入 | 画布工具条（小地图/整理/适合视图/缩放%/性能模式/清缓存/本地引擎态），画布边缘 | **`canvas`（建议搬入 `canvas/`）** | 中 | 语义是画布工具条，与已迁入 canvas/ 的 FullscreenEditor/HoverToolbar/PromptInput 同类；但唯一消费方是 App（判据4 字面会判横切），且 App 已大量 import canvas/*，故建议 canvas，标注判据4 张力 |
| (扩) | `base/panels/panel-kit.css` · `creative-library.css`（清单外新增） | 各 panels 件 / creative 件引用 | 横切样式 | 面板/创意库视觉 | **不搬（横切 UI kit 样式，随 panels 横切层保留）** | 高 | 任务提示已列明此二项倾向留下；属横切样式，无域语义 |

## 三段汇总

### 1. 该搬的（件 → 目标目录，按目标目录分组）

- **`resource/`（应建）**
  - `ResourceLibrary.tsx` → `resource/`（素材库主面板，真源 localToolApi/filesApi + resourceStore）
- **`generate/`（应建）**
  - `GeneratedView.tsx` → `generate/`（生成结果浏览，真源 generatedSource/tasks 目录）
- **`task/`（应建）**
  - `TaskCenter.tsx` → `task/`（任务中心，真源 taskStore）
- **`canvas/`**
  - `CanvasToolbar.tsx` → `canvas/`（画布工具条；**置信度中**，见问题4 判据4 张力）
- **`base/ui`（横切原语收口，反向改判）**
  - `ResourceStrip.tsx` → `base/ui`（跨 ≥3 域共享的「素材参考区」展示件；现状已在 panels，若不改判 ui 则等同「不搬」，核心是**不归 canvas**）

> 注：`ResourcePreview`、`PanelBar` 虽被多域共用，但属于「主件的配套件 / 横切 chrome」，按判据3/4 **不随上述主件强行拆到域外**，留横切层（见汇总2）。

### 2. 不该搬的（件 + 为什么；标出「被 App 消费 ⇒ 横切」）

**app-shell 宿主 / 全局件（判据4：被 `App.tsx` 消费 ⇒ 横切，不搬）：**
- `LeftPanel.tsx`（App）— 装配四域 tab 的宿主
- `TopNav.tsx`（App）— 顶部导航
- `SettingsFrame.tsx`（App）— 设置页外壳
- `ProjectSelector.tsx`（TopNav 子件，同形态不拆随宿主）
- `EmptyCanvasGuide.tsx`（App）— 空画布引导
- `LocalToolConnectModal.tsx`（App）— 全局本地引擎连接弹窗
- `CanvasToolbar.tsx`（App）— ⚠️ 按判据4 字面应留横切，但语义属 canvas，本审计建议搬 canvas（置信度中，见上/问题4）

**横切 UI kit / 跨域复用原语（多域共用，不搬）：**
- `FullscreenShell.tsx` — 被 7+ 域复用的最底层全屏壳
- `FullscreenModal.tsx` — canvas/creative/template/import 多域复用全屏弹窗壳
- `ImportMediaModalHost.tsx` + `ImportMediaModal.tsx` — 被 App + videoEditor 双消费（全局/剪辑器共用导入）
- `PanelBar.tsx` — 面板 chrome 原语，被 panels 三面板 + `prompt` 域 PromptHub 共用
- `ResourcePreview.tsx` — **resource 域 + generate 域双消费**的共享 overlay（与任务提示「疑为素材域」冲突）
- `panel-kit.css` · `creative-library.css` — 横切样式

**app-shell 设置分区（随 SettingsFrame 不搬）：**
- `sections/` 整目录 7 文件（AccountsSettings / ApiSettings / AgentChatSettings / FetchModelsModal / OtherSettings / SkillSettings / StorageMonitor）

### 3. 新发现的问题

1. **`ResourceStrip` 反向改判（重要）**：任务提示先验「随 PromptInput 走 canvas」。实测 `PromptInput` **并不 import 它**，6 个消费方里仅 `FullscreenEditor`(canvas 全屏) 1 个与 canvas-prompt 相关，其余 5 个是 `ImageGenerate`/`TextGenerate`/`TemplateNode`(canvas 节点)、`VideoGenerate`(video 域)、`StepShots`(scriptbox 域) —— 横跨 **≥3 个内容域**。它是节点「下方素材参考区」的跨域共享展示件。归 canvas 会让 video/scriptbox 跨域 import，故建议作横切原语（`base/ui`），**请复核原 canvas 改判**。

2. **`ResourcePreview` 与任务提示冲突**：提示疑为「素材域」，但实测它被 `GeneratedView`(生成域) 与 `ResourceLibrary`(素材域) **共同 import**（头注释亦写明「共用的唯一实现」）。属双域共享 overlay，归任一域都会造成另一域跨域依赖，故横切保留。

3. **`AgentChatSettings` / `SkillSettings` 主题涉 agent 域**：二者是 agent 配置子页（`saveAgentChatModel→contentSet`、`skillStore`），但作为 `SettingsFrame` 的「设置子页」而非 agent 运行 UI，留 app-shell 设置分区合理。若未来 agent 域要自带设置页，再议迁移。

4. **清单外扩展件（已纳入审计）**：`CanvasToolbar.tsx`（画布工具条，仅 App 消费）、`panel-kit.css`、`creative-library.css`（横切样式）。任务提示「起点不限定」，已一并核实。

5. **应建目录**：`resource/` `generate/` `task/` 当前 `src/components/` 下均不存在（已核实），需新建以接收 `ResourceLibrary`/`GeneratedView`/`TaskCenter`；这与其余批量任务（TASK-006 store 分域、TASK-007 归位计划）衔接。

6. **≥2 个不同域消费的件**（验收要求）：
   - `ResourceStrip`：canvas 节点 + video 域 + scriptbox 域 + canvas 全屏（≥3 域）→ 判 **横切原语（base/ui）**
   - `ResourcePreview`：resource 域 + generate 域 → 判 **横切保留**
   - `FullscreenModal`：canvas + creative + template（≥2 域）→ 判 **横切 UI kit**
   - `FullscreenShell`：agent + canvas + director3d + editors + scriptbox + video（≥2 域，最通用）→ 判 **横切 UI kit**
   - `PanelBar`：panels 三面板 + prompt 域 → 判 **横切 chrome**
   - `ImportMediaModalHost`：App(全局) + videoEditor 域 → 判 **横切（判据4）**
   判则统一：凡被 ≥2 域共用且为通用壳/原语者，**不搬、留横切层**；唯一对原提示的修正即 `ResourceStrip`（不该归 canvas）。

7. **中/低置信度缺的信息**：
   - `CanvasToolbar`（中）：是否应严格按判据4 留横切（无 in-canvas 消费方），还是按语义归 canvas——取决于项目对「App 装配的画布叶子」的归类口径，需您拍板。
   - `ResourceStrip`（中）：`base/ui` 与「保留 panels 横切层」二选一的最终裁定；以及 video/scriptbox 当前已跨域 import 它，是否接受该现状（现状已在跑，无回归风险）。
