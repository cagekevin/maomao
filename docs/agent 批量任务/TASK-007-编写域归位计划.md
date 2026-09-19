> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-007-编写域归位计划.md`。
> 碰任何其他文件（含源码、`spec/DATAFLOW.md`、`docs/DOMAIN-MODULES.md`）视为任务失败。

## ⚠️ 铁律（违反重做）

1. **只写计划，不动代码** —— 不改任何源码、不写脚本、不提交、不搬迁。
2. **不提问** —— 你不会得到回复。信息不足时按判据判断并**显式标注 [待确认]**。
3. **覆盖必须全** —— `src/components/` 下**每一个** `.ts/.tsx/.css` 都要在计划里有归宿，**一个都不能漏**（这是上一版计划最大的洞）。
4. **结论必须有 `refs`** —— 每个归属判断都要跑 `node scripts/mv-sync-refs.mjs refs <文件>` 并引用结果。

---

## 一、你要交付什么

一份**完整的《域归位计划》**，写在本文件里。包含四部分：

### 1. 最终嵌套目录树
`src/components/` 的完整结构，形如：
```
components/
├── <域>/
│   ├── <子域>/
│   │   ├── 件1.ts
│   │   └── 件2.tsx
│   └── index.ts        ← 域门面
└── base/（横切层）
```

### 2. 件级映射表（**核心，必须全**）
| 当前路径 | 目标路径 | 依据（refs 消费方 + 数据落点） |
一行一件，**`src/components/` 下所有件都要出现**。没有搬迁的也写「目标 = 原地（横切/宿主层/例外）」并说明。

### 3. 分批计划
- 每批有：**批次名 · 前置依赖 · 件级清单 · 验收标准**
- 批次要排好**依赖顺序**（例如某域的真源还在 `base/store`，则拆 store 是它的前置）

### 4. 深模块的验收指标
怎么判断"做成了深模块"？给**可机器验证**的指标（可复用 `refs` 与 grep）

---

## 二、判据（按序，冲突时前者优先）

1. **件长在界面上哪儿 ⇒ 归那儿**
   - 用户判例：`PromptInput` 是画布节点上的东西；相机是**图片生成节点下面的按钮**；深度视频是**视频节点上的 hover 工具**
2. **数据落哪儿 ⇒ 定「唯一真源」**
3. **同形态不拆** —— 展开态 / 子部件 / 配套件必须与主件同处一域
   - 判例：`FullscreenEditor` 是 `PromptInput` 的全屏展开态；`ResourceStrip` 是输入区里的素材条 ⇒ 都跟 `PromptInput` 走，**不因名字带 Resource 就归素材域**
4. **被装配层 `src/App.tsx` 消费 ⇒ 横切，不搬**
5. **已裁定为「横切契约」的**（`docs/DOMAIN-MODULES.md` §7 有留痕）不搬

**目标三词**：**最正确（符合事实）· 最清晰（与界面一致，AI 一眼找到）· 最简单（不发明，照产品与界面）**

**禁止**用「名字/目录名」判归属 —— 本项目已多次因此判错。

---

## 三、可用的真源（**都要读**）

| 文件 | 它给你什么 | 怎么用 |
| --- | --- | --- |
| `spec/DATAFLOW.md` | 17 条链路的**件清单**（事实） | **链路的内容可信，链路的标题名不可信** —— 用件清单定归属，别被"§七 提示词链路""§八 编辑/查看链路"这类名字带偏 |
| `docs/DOMAIN-MODULES.md` | 判据真源（§2.0 按事实归属 · §2.0-bis 域 = 用户能指着说的东西 · §3.0 界面位置地图） | 判据以它为准 |
| `docs/DOMAIN-RELOCATION-PLAN.md` | 我的草稿（**有洞，别照抄**） | 可参考结构与批次命名，**但要批判性检查**，发现它有矛盾/遗漏就改 |
| `src/components/canvas/NodePalette.ts` | `paletteNodes` 的 `cat` 字段（image/video/text/other） | **产品写死的权威真源**，节点归属以它为准 |
| `node scripts/mv-sync-refs.mjs refs <文件>` | 该文件被谁 import | 每个判断都要跑 |

## 四、已知结论（**已是事实，直接用，不用再推**）

- **域 = 用户能指着说的东西**。已裁定的域清单：
  `canvas` · `image` · `video` · `text`（内容能力）· `resource`（素材）· `generate`（左栏生成页签=产出物列表）· `task`（任务中心）· `prompt`（左栏提示词页签）· `creative`（创作库）· `agent` · `videoEditor` · `scriptbox` · `director3d`（**已登记例外，禁重审**）
- `base/panels` = **宿主 / app-shell 层**（§7 已改判，它合法地依赖各域）
- `base/media` = **横切协议层**（§3.1.4 C-1 裁定），不搬
- `director3d` 是例外，**不施工**
- **生成链路**（`base/api/{generate,pollTask,relayProxy}` → 回填）是**跨域流程，不是域**；但**左栏「生成」页签**是域（`GeneratedView` 这类列表件）。两者同名不同物，计划里必须区分清楚。
- 已完成的搬迁（**不要重复规划**）：
  `canvas/` 已含 `PromptInput` `promptChips` `promptLayout` `promptMention` `FullscreenEditor` `HoverToolbar` `nodeImage` `canvasHotkeys` `canvasSyncBus` `arrangePack`；`components/creative/` 已建；`video/nodes/` 已含 `VideoGenerate` `VideoExtractNode` `VideoProcessNode`；`video/depthVideo/` 已建。
- **我的两个已知错误**（如果你复核后确认，就按正确方案写；如果复核后发现我改错了，以你的实证为准）：
  ① `canvasSyncBus.ts` 消费方是 `App.tsx` + `base/store/projectStore` + `hooks/useCanvasSync` ⇒ 可能该回 `base/core`（横切）
  ② `base/panels/ResourceStrip.tsx` 按「同形态不拆」应归 `canvas/`（不是素材域）

## 五、必须回答的难点（**别回避**）

1. **`base/store` 15 件住在 8 个域** —— 先拆它，还是跟着各域一起搬？给出带依赖顺序的方案。
2. **小域问题**：`text`(1 件) · `generate`(1 件) · `prompt`(2 件) 都不足 3 件 —— 是建域还是合并？给出明确结论与理由（记住目标三词）。
3. **同名冲突**：`base/prompt/` 与 `components/prompt/`、`components/editors/` 与 `image/editors/` 不能同时存在 —— 计划里必须写明**旧目录删除**。
4. **`tests/unit/` 平铺** 与 **`scripts/` 里硬编码路径的闸**（搬移后会"假绿"）—— 要不要批次同步？给结论。
5. **`_template/TemplateNode`（非活节点？）· `GhostTargetNode`（例外）· `ScriptBoxNode`（应用入口）** 各自归宿。

## 六、输出规范

直接在**本文件**末尾追加你的计划（用 `## 交付` 起始）。表格用 markdown，目录树用代码块。
保持**简洁** —— 不要长篇论证，不要列"心路历程"，只给结论 + 一行依据。

## 七、验收标准（交回前自测）

- [ ] `src/components/` 下**每一个** `.ts/.tsx/.css` 都在映射表里出现（**一个不漏** —— 用 `find src/components -name '*.ts*' | wc -l` 核对数量）
- [ ] 每个归属判断都附了 `refs` 实测消费方
- [ ] 目录树里**没有同名目录并存**（如两个 `prompt`、两个 `editors`）
- [ ] 批次排好了**依赖顺序**，且每批有可测的验收标准
- [ ] 五个"必须回答的难点"都给了明确结论
- [ ] 深模块验收指标**可机器验证**
- [ ] 没碰过任何其他文件

---

# 交付

## 0 · 先答你的两个「已知错误」

| # | 你的怀疑 | 复核结论 | 实证 |
| --- | --- | --- | --- |
| **①** | `canvasSyncBus.ts` 该回 `base/core` | ✅ **你对，我改回来** | `refs src/components/canvas/canvasSyncBus.ts` = **3 处**：`src/App.tsx` · `src/components/base/store/projectStore.ts` · `src/hooks/useCanvasSync.ts` —— **canvas 域内零消费者**；且 `spec/DATAFLOW.md:601` §15.2 原文把它登记在「base/core 横切基础设施」。<br>**附带硬伤**：现状 `base/store/projectStore.ts` import `components/canvas/*` = **违反 check-arch 规则 2（base 禁 import 非 base）**，搬回去顺手修掉 |
| **②** | `base/panels/ResourceStrip.tsx` 应归 `canvas/` | ✅ **你对** | `refs` = **17 处**：`canvas/FullscreenEditor` · `canvas/nodes/{ImageGenerate,TextGenerate,_template/TemplateNode}` · `video/nodes/VideoGenerate` · `scriptbox/StepShots` + tests×10 ⇒ 按「同形态不拆」跟 `PromptInput` 走 ⇒ `canvas/shell/`。**`scriptbox/StepShots` 是域外消费 ⇒ 走 `canvas` 门面，不改归属** |

**口径说明**：下表的 `refs` 一律用 `node scripts/mv-sync-refs.mjs refs <文件>` 的「① 模块引用」段实测；测试文件单列，不计为消费域。

---

## 1 · 最终嵌套目录树

```
src/components/
├── canvas/                     48 件 · 一级视图「画布」= 宿主/机制（不是内容能力）
│   ├── contract/      (5)  nodeDataSchema · nodeDefaults · nodePrefs · canvasSnapshotSchema · nodeImage
│   ├── structure/     (7)  groupNodes · deriveNodes · historyStack · structuralSnapshot · arrangePack
│   │                       ArrangeConfirm · CanvasEdgesContext
│   ├── shell/        (14)  NodePalette · lazyNode · lod · canvasContextMenu · ContextMenu
│   │                       CanvasToolbar · EmptyCanvasGuide · HoverToolbar
│   │                       PromptInput · promptChips · promptLayout · promptMention
│   │                       FullscreenEditor · ResourceStrip        ← 同一 UI 形态，不拆
│   ├── parts/         (9)  NodeShell · NodeTitle · CustomHandle · ToolbarButton · GenerateButton
│   │                       GeneratingOverlay · ExpandablePanel · ResizeFullscreenHandle
│   │                       JianyingIcon   （`ContextMenu` 归 shell，不在此列）
│   ├── topology/      (3)  upstreamLink · useCanvasEventSubscriptions · canvasHotkeys
│   ├── nodes/         (4)  GroupNode · GhostTargetNode · Director3DNode · _template/TemplateNode
│   ├── edges/         (4)  Comet · ConnectionLine · CustomEdge · CometParticles
│   └── index.ts           域门面 + toolRegistry（1 件，不足子域门槛 ⇒ 挂域根）
│
├── image/                      23 件 · 产品 cat=image（8 节点 + 节点上的工具）
│   ├── nodes/         (8)  ImageGenerate · ImageBoxNode · GridSplitNode · GridMergeNode
│   │                       PanoramaNode · FaceMosaicNode · LoopNode · AssetNode
│   ├── editors/      (11)  ImageEditor · InlineImageCropper · OverlayEditor · FaceMosaicEditor
│   │                       PanoViewer · CameraStudioPanel · cameraStudio.ts · cameraParams/*(4)
│   └── imageUpscale.ts · faceMosaic.ts · useImageHoverActions.tsx + index.ts
│       ← 3 件不足子域门槛 ⇒ 挂域根；`imageCompress` 因规则 2 **留 base/utils**（见 §7 A1）
│
├── video/                      12 件 · 产品 cat=video
│   ├── nodes/         (3)  VideoGenerate · VideoExtractNode · VideoProcessNode   ✅ 已建
│   ├── depthVideo/    (5)  DepthVideoModal · depthUrls · engine · loader · spawn  ✅ 已建
│   ├── lib/           (3)  videoEngine · captureFrame · timeScale      ← 本批迁入
│   └── index.ts
│
├── text/                        1 件 · 产品 cat=text
│   └── TextGenerate.tsx + index.ts       ← 1 件 ⇒ 不建 nodes/ 子域
│
├── resource/                    3 件 · 左栏「素材」页签
│   └── resourceStore.ts · ResourceLibrary.tsx · ResourcePreview.tsx + index.ts
│
├── generate/                    1 件 · 左栏「生成」页签 = **产出物列表**（≠ 生成链路）
│   └── GeneratedView.tsx + index.ts
│
├── task/                        2 件 · 左栏「任务」页签
│   └── taskCompletionBus.ts · TaskCenter.tsx + index.ts
│       ⚠️ `taskStore.ts` **留 base/store**（被 `base/api/pollTask` 实质消费 ⇒ 规则 2，见 §7 A1）
│
├── prompt/                      2 件 · 左栏「提示词」页签
│   └── PromptHub.tsx · promptHubStore.ts + index.ts
│   ⚠️ base/prompt/ 必须删空消失
│
├── settings/                   11 件 · 设置页（用户能指着「设置」）
│   ├── sections/      (7)  AccountsSettings · AgentChatSettings · ApiSettings · FetchModelsModal
│   │                       OtherSettings · SkillSettings · StorageMonitor
│   └── SettingsFrame.tsx · settingRegistry.ts · providerStore.ts · accountsStore.ts + index.ts
│       ⚠️ `appSettings.ts` **留 base/store**（被 `base/utils/assetUrl` 消费 ⇒ 规则 2，见 §7 A1）
│
├── creative/                    9 件 ✅ 已建，原地
├── scriptbox/                  19 件（17 + ScriptBoxNode + Select）
├── agent/                      60 件（56 + attachmentCover + volumePolicy + agentModelStore + skillStore）
├── videoEditor/               259 件（258 + videoEditorKeys）
└── director3d/                 28 件（已登记例外 · 禁重审 · 不施工）

src/components/base/            83 件 · 目标形态 = **只留横切**
├── api/       (8)  横切出站层（含生成链路 generate/pollTask/relayProxy —— 跨域流程，不建域）
├── core/     (17)  横切基础设施（含 canvasSyncBus 回迁）
├── media/     (9)  媒体引用协议层（§3.1.4 C-1 裁定，不搬）
├── panels/   (11)  宿主 / app-shell 层（§7 改判）
├── storage/   (4)  横切存储
├── store/     (6)  只剩「无用户可指界面」的基础设施真源
├── ui/       (12)  横切叶组件库
└── utils/    (16)  横切纯函数
```

**计数核对**：`48+23+12+1+3+1+3+2+12+9+19+60+259+28+83 = 563` = `find src/components -name '*.ts*' | wc -l` 的 **564** − **1**（`components/editors/index.ts` 删除）。
新建 8 个 `index.ts`（image·text·resource·generate·task·prompt·settings·scriptbox）⇒ 完工后 **571**。

---

## 2 · 件级映射表

### 2.1 搬移件（**70 件逐件** · `refs` 实测）

| # | 当前路径 | 目标路径 | 依据（`refs` ①段消费方 + 界面/数据落点） |
| --- | --- | --- | --- |
| 1 | `base/store/taskStore.ts` | **`task/taskStore.ts`** | 26 处：App · LeftPanel · TaskCenter · `base/api/pollTask` · agent×3 · `generationOrchestration` · canvas/{AssetNode,ImageGenerate} · `canvas/upstreamLink` · `hooks/useNodeGeneration` + tests×15 ⇒ 左栏「任务」页签的数据真源 |
| 2 | `base/store/taskCompletionBus.ts` | **`task/taskCompletionBus.ts`** | 1 处：`base/store` 域内 ⇒ 与 `taskStore` 同域（不同形态不拆的反面：同域真源必须同址） |
| 3 | `base/store/resourceStore.ts` | **`resource/resourceStore.ts`** | 17 处：`media/providers/{canvasSource,librarySource}` · `ResourceLibrary` · canvas/{AssetNode,ImageGenerate} · scriptbox×3 · hooks×2 + tests×7 ⇒ DATAFLOW §五 素材域真源 |
| 4 | `base/store/agentModelStore.ts` | **`agent/stores/agentModelStore.ts`** | 4 处：agent×2 + base×1 + tests×1 ⇒ agent 模型配置，界面落点=AI 助手 |
| 5 | `base/store/skillStore.ts` | **`agent/stores/skillStore.ts`** | 3 处：agent×1 + base + tests ⇒ 技能库，落点=AI 助手/设置里的技能区 |
| 6 | `base/store/appSettings.ts` | **`settings/appSettings.ts`** | 8 处：base×4 · App · tests×3 ⇒ `app_settings` KV = 设置页真源 |
| 7 | `base/store/settingRegistry.ts` | **`settings/settingRegistry.ts`** | 2 处：base×2 ⇒ 设置声明表，落点=设置页 |
| 8 | `base/store/providerStore.ts` | **`settings/providerStore.ts`** | 8 处：base×3 · hooks×2 · agent · scriptbox · tests ⇒ 界面落点=设置页「第三方API配置」 |
| 9 | `base/store/accountsStore.ts` | **`settings/accountsStore.ts`** | 3 处：base×2 + tests ⇒ 界面落点=设置页「账号」（`SettingsFrame.tsx:25-30`）；顺带消掉「多开域」这个 1 件伪域 |
| 10 | `base/panels/GeneratedView.tsx` | **`generate/GeneratedView.tsx`** | 2 处：`LeftPanel` + test ⇒ 左栏「生成」页签专用视图 |
| 11 | `base/panels/TaskCenter.tsx` | **`task/TaskCenter.tsx`** | 2 处：`LeftPanel` + test ⇒ 左栏「任务」页签 |
| 12 | `base/panels/ResourceLibrary.tsx` | **`resource/ResourceLibrary.tsx`** | 1 处：`LeftPanel` ⇒ 左栏「素材」页签 |
| 13 | `base/panels/ResourcePreview.tsx` | **`resource/ResourcePreview.tsx`** | 3 处：`GeneratedView` · `ResourceLibrary` + test ⇒ 素材预览（其消费方两个都归素材/生成，就地同迁） |
| 14 | `base/panels/ResourceStrip.tsx` | **`canvas/shell/ResourceStrip.tsx`** | 17 处：canvas×4 + video/VideoGenerate + scriptbox/StepShots + tests×10 ⇒ **同形态不拆**，跟 `PromptInput` |
| 15 | `base/panels/SettingsFrame.tsx` | **`settings/SettingsFrame.tsx`** | 1 处：App ⇒ 设置页壳 |
| 16 | `base/panels/sections/AccountsSettings.tsx` | **`settings/sections/`** | 1 处：App ⇒ 设置页分区 |
| 17 | `base/panels/sections/AgentChatSettings.tsx` | **`settings/sections/`** | 1 处：base（SettingsFrame）⇒ 同上 |
| 18 | `base/panels/sections/ApiSettings.tsx` | **`settings/sections/`** | 1 处：base ⇒ 同上 |
| 19 | `base/panels/sections/FetchModelsModal.tsx` | **`settings/sections/`** | 1 处：base ⇒ 同上 |
| 20 | `base/panels/sections/OtherSettings.tsx` | **`settings/sections/`** | 1 处：base ⇒ 同上 |
| 21 | `base/panels/sections/SkillSettings.tsx` | **`settings/sections/`** | 1 处：base ⇒ 同上 |
| 22 | `base/panels/sections/StorageMonitor.tsx` | **`settings/sections/`** | 1 处：base ⇒ 同上 |
| 23 | `base/panels/CanvasToolbar.tsx` | **`canvas/shell/CanvasToolbar.tsx`** | 1 处：App ⇒ **长在画布上**（小地图/整理/fitView/缩放/性能模式，App.tsx:1563）；判据 1 优先于判据 4 |
| 24 | `base/panels/EmptyCanvasGuide.tsx` | **`canvas/shell/EmptyCanvasGuide.tsx`** | 1 处：App ⇒ **长在画布中央**（节点数=0 时的引导，App.tsx:1545）；同上 |
| 25 | `base/prompt/PromptHub.tsx` | **`prompt/PromptHub.tsx`** | 1 处：`LeftPanel` ⇒ 左栏「提示词」页签 |
| 26 | `base/prompt/promptHubStore.ts` | **`prompt/promptHubStore.ts`** | 2 处：`PromptHub` + test ⇒ 同上，真源同址 |
| 27 | `base/ui/NodeShell.tsx` | **`canvas/parts/NodeShell.tsx`** | **35 处**：canvas×31（`lazyNode` + nodes×13）+ video/nodes×3 + tests ⇒ 节点通用外壳，长在节点上 |
| 28 | `base/ui/CometParticles.tsx` | **`canvas/edges/CometParticles.tsx`** | 2 处：`canvas/edges/{Comet,ConnectionLine}` ⇒ 只长在连线上 |
| 29 | `base/ui/ContextMenu.tsx` | **`canvas/shell/ContextMenu.tsx`** | 3 处：App · `canvas/canvasContextMenu` + test ⇒ 画布右键菜单 |
| 30 | `base/ui/CustomHandle.tsx` | **`canvas/parts/CustomHandle.tsx`** | 3 处：base · canvas + test ⇒ 节点端口把手 |
| 31 | `base/ui/NodeTitle.tsx` | **`canvas/parts/NodeTitle.tsx`** | 2 处：base + test ⇒ 节点标题栏 |
| 32 | `base/ui/ToolbarButton.tsx` | **`canvas/parts/ToolbarButton.tsx`** | 1 处：canvas ⇒ 节点工具条按钮 |
| 33 | `base/ui/GenerateButton.tsx` | **`canvas/parts/GenerateButton.tsx`** | 5 处：canvas×3 · video×2 ⇒ 节点上的「生成」按钮 |
| 34 | `base/ui/GeneratingOverlay.tsx` | **`canvas/parts/GeneratingOverlay.tsx`** | 4 处：canvas×3 · video×1 ⇒ 节点生成中遮罩 |
| 35 | `base/ui/ExpandablePanel.tsx` | **`canvas/parts/ExpandablePanel.tsx`** | 4 处：canvas×3 · video×1 ⇒ 节点可展开面板 |
| 36 | `base/ui/ResizeFullscreenHandle.tsx` | **`canvas/parts/ResizeFullscreenHandle.tsx`** | 4 处：canvas×3 · video×1 ⇒ 节点全屏/缩放把手 |
| 37 | `base/ui/JianyingIcon.tsx` | **`canvas/parts/JianyingIcon.tsx`** ⚠️[待确认] | 3 处：canvas×1 · video×1 + test ⇒ 按「节点部件」归 canvas；若实测它只出现在视频节点徽标上则改归 `video/`（开工前 `refs` + 看调用点 JSX 上下文定） |
| 38 | `base/ui/attachmentCover.tsx` | **`agent/panels/attachmentCover.tsx`** | 2 处：agent×2（`AgentMessage` · `AgentPanel`）⇒ 只长在 AI 助手里 |
| 39 | `base/ui/Select.tsx` | **`scriptbox/Select.tsx`** | 1 处：`scriptbox/GearSettings` ⇒ 单消费者，就地归位 |
| 40 | `base/utils/volumePolicy.ts` | **`agent/runtime/volumePolicy.ts`** | 4 处：agent×2（`conversationSnapshot` · `conversationState`）+ tests×2 ⇒ §1.5 已裁定 |
| 41 | `base/utils/captureFrame.ts` | **`video/lib/captureFrame.ts`** | 8 处：video×3 · `scriptbox/scriptBoxEngine` · `hooks/useVideoPoster` · `base/utils/videoEngine` + tests ⇒ 抽帧 = 视频能力（DATAFLOW §十） |
| 42 | `base/utils/videoEngine.ts` | **`video/lib/videoEngine.ts`** | 3 处：`video/nodes/VideoProcessNode` + tests×2 ⇒ 单生产消费者，视频能力 |
| 43 | `base/utils/timeline/timeScale.ts` | **`video/lib/timeScale.ts`** | 2 处：video×1 + test ⇒ 时间轴缩放，落点视频 |
| 44 | `base/utils/imageCompress.ts` | **`image/lib/imageCompress.ts`** | 7 处：`editors/{ImageEditor,InlineImageCropper}` · `canvas/nodes/useImageHoverActions` · base + tests×3 ⇒ §3.1.3.3 已判图片能力 |
| 45 | `base/utils/imageUpscale.ts` | **`image/lib/imageUpscale.ts`** | 2 处：`canvas/nodes/useImageHoverActions` + test ⇒ 同上（P1 阻塞已由 A1 解除） |
| 46 | `base/utils/faceMosaic.ts` | **`image/lib/faceMosaic.ts`** | 3 处：`canvas/nodes/FaceMosaicNode` · `editors/FaceMosaicEditor` + test ⇒ DATAFLOW §八 图片链路 |
| 47 | `base/core/videoEditorKeys.ts` | **`videoEditor/data/videoEditorKeys.ts`** | 2 处：`videoEditor/engine/services/storage/service` + test ⇒ 唯一生产消费者在剪辑器；§7⑤「与 agentKeys 同族」是按**形态**判，归属按**落点**判 ⇒ 归 videoEditor |
| 48 | `canvas/canvasSyncBus.ts` | **`base/core/canvasSyncBus.ts`** | 3 处：App · `base/store/projectStore` · `hooks/useCanvasSync` ⇒ canvas 域内**零**消费者 + DATAFLOW §15.2 登记横切 ⇒ **回迁**（你的错误①） |
| 49 | `canvas/nodes/ImageGenerate.tsx` | **`image/nodes/`** | `NodePalette` `cat:'image'`（产品权威真源）+ 6 处 refs：tests×5 + canvas×1 |
| 50 | `canvas/nodes/ImageBoxNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 3：tests×2 + canvas×1 |
| 51 | `canvas/nodes/GridSplitNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 3 |
| 52 | `canvas/nodes/GridMergeNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 3 |
| 53 | `canvas/nodes/PanoramaNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 2 |
| 54 | `canvas/nodes/FaceMosaicNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 3 |
| 55 | `canvas/nodes/LoopNode.tsx` | **`image/nodes/`** | `cat:'image'`；refs 2（依赖图偏机制，但**以产品 cat 为准**） |
| 56 | `canvas/nodes/AssetNode.tsx` | **`image/nodes/`** | `cat:'image'`（图片视频素材节点）；refs 3 |
| 57 | `canvas/nodes/useImageHoverActions.tsx` | **`image/useImageHoverActions.tsx`** | refs 3：canvas×2 + test；§3.1.3.2 判「图片能力辅助 hook，住 nodes/ 是游离物」 |
| 58 | `canvas/nodes/TextGenerate.tsx` | **`text/TextGenerate.tsx`** | `cat:'text'`；refs 4：tests×3 + canvas×1 ⇒ 文本能力唯一节点 |
| 59 | `canvas/nodes/ScriptBoxNode.tsx` | **`scriptbox/ScriptBoxNode.tsx`** | refs 3：`canvas/NodePalette` + tests×2 ⇒ 独立应用入口（§3.1.3.2） |
| 60 | `editors/ImageEditor.tsx` | **`image/editors/`** | refs 3：`canvas/nodes/ImageGenerate` · `editors/index` + test ⇒ 图片生成节点上的工具 |
| 61 | `editors/InlineImageCropper.tsx` | **`image/editors/`** | refs 2：`editors/index` + test ⇒ 同上 |
| 62 | `editors/OverlayEditor.tsx` | **`image/editors/`** | refs 2 ⇒ 图片拼图节点上的工具（§3.0 表 C） |
| 63 | `editors/FaceMosaicEditor.tsx` | **`image/editors/`** | refs 1：`editors/index` ⇒ 人脸打码节点上的工具 |
| 64 | `editors/PanoViewer.tsx` | **`image/editors/`** | refs 1 ⇒ 全景节点上的查看器（DATAFLOW §八） |
| 65 | `editors/CameraStudioPanel.tsx` | **`image/editors/`** | refs 1：`editors/index` ⇒ **相机是图片生成节点下面的按钮**（§2.0-bis 用户判例），不是独立域 |
| 66 | `editors/cameraStudio.ts` | **`image/editors/`** | refs 2：editors×2 ⇒ 同上 |
| 67 | `editors/cameraParams/CameraSettingsSelector.tsx` | **`image/editors/cameraParams/`** | refs 1：editors ⇒ 同上 |
| 68 | `editors/cameraParams/cameraPrompt.ts` | **`image/editors/cameraParams/`** | refs 1：editors ⇒ 同上 |
| 69 | `editors/cameraParams/types.ts` | **`image/editors/cameraParams/`** | refs 3：editors×3 ⇒ 同上 |
| 70 | `editors/cameraParams/cameraParams.css` | **`image/editors/cameraParams/`** | refs 1：editors ⇒ 同上 |

**`editors/index.ts` → 删**（并入 `image/index.ts`，不留双门面）。
**`base/prompt/` → 删**（搬空即删，不建空目录）。

---

### 2.2 原地件（**逐件列出** · 目标 = 原地）

> **计数口径**：原地净数 **493** = 563 − 70（搬移）。下表各行给的是该目录**最终件数**（含标「**+ 迁入**」的件），
> 便于核对「完工后每个目录里到底有什么」；净数与最终数差的就是那 70 件搬移件。

> 判据：① 消费方跨 ≥3 个域 ⇒ 横切；② 已裁定横切契约（§7 / DATAFLOW §15）⇒ 不搬；③ 已登记例外（director3d）⇒ 不施工；④ 冻结整树（已达范本形态）。

#### A · 冻结整树（**不施工**）

| 目录（原地） | 件数 | 件（逐件） | 依据 |
| --- | --- | --- | --- |
| `agent/` | 3 | `agentConfig.ts` `agentTypes.ts` `index.ts` | 已建域 + 门面；本批只**收** 4 件、不内部重构 |
| `agent/assistantTable/` | 23 | `AssistantTablePanel.tsx` `AssistantTablePreviewCard.tsx` `CellEditor.tsx` `FindReplaceDialog.tsx` `RowOpsMenu.tsx` `TabTargetMenu.tsx` `TableGrid.tsx` `TableTabsBar.tsx` `assistant-table.css` `assistantTable.ts` `assistantTablePrompt.ts` `icons.tsx` `tableHistory.ts` `tableIds.ts` `tableInvariants.ts` `tableWorkspaceState.ts` `tableWorkspaceTypes.ts` `useActiveAssistantTable.ts` `useColumnResize.ts` `usePreviewResize.ts` `useTabDragSort.ts` `useTableDrafts.ts` `useTableSelection.ts` | 表格子系统，域内聚 |
| `agent/canvas/` | 3 | `agentCanvasHost.ts` `canvasPlanExecutor.ts` `useCanvasAgentTools.ts` | 域内聚 |
| `agent/conversation/` | 8 | `conversationAiState.ts` `conversationImageMap.ts` `conversationInvariants.ts` `conversationSkillState.ts` `conversationSnapshot.ts` `conversationState.ts` `conversationStore.ts` `conversationTypes.ts` | 域内聚 |
| `agent/panels/` | 8 | `AgentConfirmCard.tsx` `AgentMessage.tsx` `AgentPanel.tsx` `ChatMarkdown.tsx` `TableWorkspacePanel.tsx` `agent-panel.css` `markdownImages.ts` **+ 迁入 `attachmentCover.tsx`** | 域内聚 |
| `agent/runtime/` | 15 | `agentAttachments.ts` `agentCore.ts` `agentMessages.ts` `agentRuntime.ts` `contextCompression.ts` `inputStateMachine.ts` `memoryRetrieval.ts` `pendingRecovery.ts` `projectMemoryStore.ts` `tokenBudget.ts` `useAgentChat.ts` `workflowState.ts` **+ 迁入 `volumePolicy.ts` `agentModelStore.ts` `skillStore.ts`** | 域内聚 |
| ~~`agent/stores/`~~ | **0** | — | ⚠️ **撤销**：`agentModelStore`+`skillStore` 只有 2 件 <3 ⇒ 按 §2.5 是**假子域** ⇒ 并进 `agent/runtime/`（落点 `agent/runtime/agentModelStore.ts` · `agent/runtime/skillStore.ts`） |
| `director3d/` | 19 | `App.tsx` `ConfirmDialog.tsx` `Director3DOverlay.tsx` `ErrorBoundary.tsx` `SceneGizmo.tsx` `Viewport.tsx` `d3dPersistence.ts` `depth.tsx` `history.ts` `log.ts` `models.tsx` `primitives.tsx` `project.ts` `rig.ts` `storage.ts` `styles.css` `thumbnails.ts` `tracks.ts` `useToast.ts` | **已登记例外，禁重审** |
| `director3d/panels/` | 9 | `AssetMenu.tsx` `CameraAnglePanel.tsx` `GlobalSettingsPanel.tsx` `Inspector.tsx` `ReferenceOverlay.tsx` `ShotsPanel.tsx` `Sidebar.tsx` `Timeline.tsx` `controls.tsx` | 同上 |
| `creative/` | 6 | `CreativeLibrary.tsx` `CreativeLibraryButton.tsx` `creativeCatalog.ts` `creativePresets.ts` `index.ts` `promptManager.ts` | ✅ 已建域（S2-8 试点完成），跨 3 内容能力共享 ⇒ 独立域不合并 |
| `creative/views/` | 3 | `MjStyleBrowser.tsx` `PresetGridView.tsx` `PromptPresetView.tsx` | 同上 |
| `video/depthVideo/` | 5 | `DepthVideoModal.tsx` `depthUrls.ts` `engine.ts` `loader.ts` `spawn.ts` | ✅ 已建；视频节点上的 hover 工具 |
| `video/nodes/` | 3 | `VideoExtractNode.tsx` `VideoGenerate.tsx` `VideoProcessNode.tsx` | ✅ 已建 |
| `video/index.ts` | 1 | `index.ts` | ✅ 已建域门面 |
| `scriptbox/` | 18 | `GearSettings.tsx` `ScriptBoxAssetPicker.tsx` `ScriptBoxFullscreen.tsx` `ScriptBoxModal.tsx` `StepAssets.tsx` `StepNav.tsx` `StepPrompt.tsx` `StepShots.tsx` `scriptBoxEngine.ts` `scriptBoxPlaybookIO.ts` `scriptBoxPlaybookManager.tsx` `scriptBoxPlaybookStore.ts` `scriptBoxPromptResolver.ts` `scriptBoxPrompts.ts` `scriptBoxSchema.ts` `scriptBoxTypes.ts` `scriptBoxWorkflows.ts` **+ 迁入 `ScriptBoxNode.tsx` `Select.tsx`** | 独立应用域，整树原地 |
| `videoEditor/`（整树 258 件） | 258 | `EditorShell.tsx` `index.ts` `videoEditorTailwindColors.ts` `videoEditorTheme.css`<br>`constants/`: `editor-constants.ts` `export-constants.ts` `font-constants.ts` `language-constants.ts` `project-constants.ts` `site-constants.ts` `stickers-constants.ts` `subtitle-constants.ts` `text-constants.ts` `text-style-presets.ts` `timeline-constants.tsx` `transcription-constants.ts` `transition-constants.ts` `tts-constants.ts`<br>`data/colors/`: `pattern-craft.ts` `solid.ts` `syntax-ui.tsx`<br>`engine/commands/`: `base-command.ts` `batch-command.ts` `index.ts`<br>`engine/commands/media/`: `add-media-asset.ts` `index.ts` `remove-media-asset.ts`<br>`engine/commands/project/`: `index.ts` `update-project-settings.ts`<br>`engine/commands/scene/`: `index.ts` `remove-bookmark.ts` `toggle-bookmark.ts`<br>`engine/commands/timeline/`: `index.ts`<br>`…/clipboard/`: `index.ts` `paste.ts`<br>`…/element/`: `batch-move-elements.ts` `delete-elements.ts` `detach-audio.ts` `duplicate-elements.ts` `index.ts` `insert-element.ts` `move-elements.ts` `split-elements.ts` `toggle-elements-muted.ts` `toggle-elements-visibility.ts` `update-element-duration.ts` `update-element-start-time.ts` `update-element-trim.ts` `update-element.ts`<br>`…/track/`: `add-track.ts` `index.ts` `remove-track.ts` `reorder-tracks.ts` `toggle-track-mute.ts` `toggle-track-visibility.ts`<br>`…/transition/`: `add-transition.ts` `index.ts` `remove-transition.ts` `update-transition.ts`<br>`engine/core/`: `index.ts`<br>`engine/core/managers/`: `audio-manager.ts` `commands.ts` `media-manager.ts` `playback-manager.ts` `project-manager.ts` `renderer-manager.ts` `save-manager.ts` `scenes-manager.ts` `selection-manager.ts` `timeline-manager.ts`<br>`engine/lib/`: `drag-data.ts` `export.ts` `iconify-api.ts` `scenes.ts` `time.ts`<br>`engine/lib/actions/`: `definitions.ts` `index.ts` `registry.ts` `types.ts`<br>`engine/lib/gradients/`: `canvas.ts` `index.ts` `parser.ts`<br>`engine/lib/media/`: `audio.ts` `media-utils.ts` `mediabunny.ts` `processing.ts`<br>`engine/lib/preview/`: `element-bounds.ts` `hit-test.ts` `snap.ts`<br>`engine/lib/transcription/`: `caption.ts`<br>`engine/lib/tts/`: `service.ts`<br>`engine/services/renderer/`: `canvas-renderer.ts` `font-stack.ts` `scene-builder.ts` `scene-exporter.ts`<br>`…/nodes/`: `base-node.ts` `blur-background-node.ts` `color-node.ts` `image-node.ts` `root-node.ts` `sticker-node.ts` `text-node.ts` `transition-node.ts` `video-node.ts` `visual-node.ts`<br>`engine/services/storage/`: `service.ts` `types.ts`<br>`engine/services/timeline-thumbnail/`: `service.ts`<br>`engine/services/transcription/`: `hf-proxy.ts` `service.ts` `worker.ts`<br>`engine/services/video-cache/`: `service.ts`<br>`engine/timeline/`: `bookmarks.ts` `drop-utils.ts` `element-utils.ts` `index.ts` `ruler-utils.ts` `speed-utils.ts` `text-utils.ts` `track-utils.ts` `transition-utils.ts` `zoom-utils.ts`<br>`hooks-cutia/`: `use-container-size.ts` `use-editor.ts` `use-file-upload.ts` `use-fullscreen.ts` `use-infinite-scroll.ts` `use-keybindings.ts` `use-keyboard-shortcuts-help.ts` `use-preview-interaction.ts` `use-raf-loop.ts` `use-reveal-item.ts` `use-sound-library.ts` `use-sound-preview.ts`<br>`hooks-cutia/actions/`: `use-action-handler.ts` `use-editor-actions.ts`<br>`hooks-cutia/storage/`: `use-local-storage.ts`<br>`hooks-cutia/timeline/`: `use-edge-auto-scroll.ts` `use-scroll-position.ts` `use-scroll-sync.ts` `use-selection-box.ts` `use-snap-indicator-position.ts` `use-timeline-drag-drop.ts` `use-timeline-playhead.ts` `use-timeline-seek.ts` `use-timeline-snapping.ts` `use-timeline-zoom.ts` `use-track-reorder.ts`<br>`…/timeline/element/`: `use-element-interaction.ts` `use-element-resize.ts` `use-element-selection.ts`<br>`lib/`: `mediaDisplayUrl.ts` `toast.ts` `videoEditorLogger.ts`<br>`stores/`: `assets-panel-store.tsx` `keybindings-store.ts` `media-preview-store.ts` `panel-store.ts` `sounds-store.ts` `stickers-store.ts` `timeline-store.ts`<br>`stores/keybindings/migrations/`: `index.ts` `v2-to-v3.ts`<br>`types/`: `assets.ts` `drag.ts` `export.ts` `keybinding.ts` `language.ts` `outcome.ts` `project.ts` `sounds.ts` `stickers.ts` `time.ts` `timeline.ts` `transcription.ts`<br>`ui/`: `editable-timecode.tsx`<br>`ui/editor/`: `editor-header.tsx` `export-button.tsx` `selection-box.tsx`<br>`ui/editor/dialogs/`: `delete-project-dialog.tsx` `rename-project-dialog.tsx` `shortcuts-dialog.tsx`<br>`ui/editor/panels/`: `panel-base-view.tsx`<br>`ui/editor/panels/assets/`: `drag-overlay.tsx` `draggable-item.tsx` `index.tsx` `link-media-refs.ts` `tabbar.tsx`<br>`…/assets/views/`: `captions.tsx` `media.tsx` `settings.tsx` `sounds.tsx` `stickers.tsx` `text.tsx` `transitions.tsx`<br>`ui/editor/panels/preview/`: `guide-lines.tsx` `index.tsx` `preview-interaction-overlay.tsx` `selection-overlay.tsx`<br>`ui/editor/panels/properties/`: `audio-properties.tsx` `empty-view.tsx` `index.tsx` `property-item.tsx` `sticker-properties.tsx` `text-properties.tsx` `text-speech-panel.tsx` `use-draft-commit.ts` `video-properties.tsx`<br>`ui/editor/panels/timeline/`: `audio-waveform.tsx` `bookmarks.tsx` `drag-line.tsx` `index.tsx` `missing-media-indicator.tsx` `snap-indicator.tsx` `timeline-element.tsx` `timeline-playhead.tsx` `timeline-ruler.tsx` `timeline-tick.tsx` `timeline-toolbar.tsx` `timeline-track.tsx` `timeline-transition-overlay.tsx` `video-thumbnail-strip.tsx`<br>`ui/providers/`: `editor-provider.tsx`<br>`ui/ui/`: `alert.tsx` `aspect-ratio.tsx` `button.tsx` `checkbox.tsx` `color-picker.tsx` `context-menu.tsx` `dialog.tsx` `dropdown-menu.tsx` `font-picker.tsx` `input-with-back.tsx` `input.tsx` `label.tsx` `popover.tsx` `progress.tsx` `radio-group.tsx` `resizable.tsx` `scroll-area.tsx` `select.tsx` `separator.tsx` `slider.tsx` `slot.tsx` `spinner.tsx` `switch.tsx` `tabs.tsx` `textarea.tsx` `tooltip.tsx`<br>`ui/ui/layer/`: `compose-refs.ts` `layer-root.tsx` `use-anchored-position.ts` `use-dismissable.ts`<br>`ui/ui/menu/`: `menu.tsx`<br>`utils/`: `browser.ts` `platform.ts` `string.ts` `ui.ts`<br>**+ 迁入 `data/videoEditorKeys.ts`** | 独立应用（剪辑器），§3.1.3.7 三个深模块范本之一；内部重构属 S2-5，另计 |

#### B · `base/` 横切层（**83 件逐件**）

| 目录（原地） | 件数 | 件（逐件） | 依据 |
| --- | --- | --- | --- |
| `base/api/` | 8 | `filesApi.ts` `generate.ts` `httpClient.ts` `index.ts` `localToolApi.ts` `pagedList.ts` `pollTask.ts` `relayProxy.ts` | 横切出站层。`generate/pollTask/relayProxy` = **生成链路（跨域流程，不是域）** ⇒ 不建 `api/relay/`：域清单里没有它，「最简单=不发明」 |
| `base/core/` | 17 | `agentKeys.ts` `backendLogStream.ts` `config.ts` `confirmStore.ts` `contentStore.ts` `contracts.ts` `degrade.ts` `editorSession.ts` `eventBus.ts` `idGen.ts` `logger.ts` `modalLayer.ts` `nodeSizePatch.ts` `toastStore.ts` `uiHooks.ts` `utils.ts` **+ 回迁 `canvasSyncBus.ts`** | 横切基础设施（DATAFLOW §15.2）。`agentKeys` refs 7：agent×5+App+test ⇒ §7 已裁定**横切契约，不搬**；`editorSession` refs 4：消费者含 `base/ui/VideoThumbnail`（base 内）⇒ 迁出即违反规则 2 |
| `base/media/` | 5 | `canvasNodesBridge.ts` `index.ts` `libraryBrowse.ts` `mediaRefRegistry.ts` `mediaRefTypes.ts` | **横切协议层**（§3.1.4 C-1 裁定），名不副实但已裁定不搬 |
| `base/media/providers/` | 4 | `canvasSource.ts` `generatedSource.ts` `index.ts` `librarySource.ts` | 同上：它们是「媒体引用协议」的**实现插件**，`providers/index.ts` 静态注册 ⇒ 搬出会让 `base/media` 反向 import 域 = 违规 |
| `base/panels/` | 11 | `FullscreenModal.tsx` `FullscreenShell.tsx` `ImportMediaModal.tsx` `ImportMediaModalHost.tsx` `LeftPanel.tsx` `LocalToolConnectModal.tsx` `PanelBar.tsx` `ProjectSelector.tsx` `TopNav.tsx` `creative-library.css` `panel-kit.css` | **宿主 / app-shell 层**（§7 改判）。`LeftPanel` 装配 4 个域的 UI、`PanelBar` 被 4 个域 UI 用、`TopNav`/`ProjectSelector` 顶部导航 ⇒ 判据 4 的**真正适用对象** |
| `base/storage/` | 4 | `index.ts` `legacyRawKey.ts` `storageAdapter.ts` `storageQuota.ts` | 横切存储；`legacyRawKey` 消费者只有 `base/storage/index`（base 自有，§7③） |
| `base/store/` | 6 | `autoSync.ts` `backupStore.ts` `cloudSync.ts` `generationOrchestration.ts` `nodeRuntimeStore.ts` `projectStore.ts` | **只剩「无用户可指界面」的基础设施真源**：云同步/备份/项目 = 机制不是界面；`generationOrchestration` = 跨域生成流程编排（**不进 `generate/`**，那是左栏页签）；`nodeRuntimeStore` = 纯内存瞬态（DATAFLOW §十一） |
| `base/ui/` | 12 | `ConfirmContainer.tsx` `DropdownPanel.tsx` `DropdownRow.tsx` `ErrorBoundary.tsx` `ImageZoomDialog.tsx` `InlineNameInput.tsx` `LazyImage.tsx` `ModelSelect.tsx` `RenameDialog.tsx` `ToastContainer.tsx` `Toggle.tsx` `VideoThumbnail.tsx` | 横切叶组件库（DATAFLOW §15.3）。`ImageZoomDialog` 10 处跨 canvas/agent/scriptbox/base（D18 已裁定横切）· `VideoThumbnail` 8 处跨 generate/task/image/video · `LazyImage` 16 处跨 7 域 · `ModelSelect` 跨 canvas/agent/scriptbox/video |
| `base/utils/` | 15 | `assetType.ts` `assetUrl.ts` `asyncGuard.ts` `clipboard.ts` `encoderProbe.ts` `externalizeInline.ts` `genErrors.ts` `imagePixel.ts` `nodeMedia.ts` `previewUrl.ts` `providerModels.ts` `providerUrlAdapters.ts` `uploadDirs.ts` `useImageFallbackSrc.ts` `useMediaLoadFailed.ts` | 横切纯函数（DATAFLOW §15.1）。`imagePixel` 是 `RATIO_PIXEL_TABLE` 单源、被 `base/api/generate` 消费 ⇒ 横切；`encoderProbe` 唯一消费者是 `director3d`（例外）⇒ 不搬（§7⑨）；`useMediaLoadFailed` 消费者含 `base/ui/VideoThumbnail` ⇒ 不搬（§7⑦） |
| `base/utils/timeline/` | 1 | `sourceTime.ts` | DATAFLOW §十 原文「**跨域唯一映射原语**」⇒ 横切（与 `timeScale` 拆开是判据优先，不是形态优先） |
| `base/prompt/` | **0** | — | **搬空即删**，不留空目录 |
| `components/editors/` | **0** | — | **搬空即删**，不留空目录 |

#### C · 例外登记（**不施工**）

| 件 | 原地 | 依据 |
| --- | --- | --- |
| `canvas/nodes/Director3DNode.tsx` | `canvas/nodes/` | director3d 是**已登记例外，禁重审**（§9 A3）；它是画布上的挂载点，留在 `canvas/nodes/` |
| `canvas/nodes/GhostTargetNode.tsx` | `canvas/nodes/` | 连线占位，**非真实节点**（§3.1.3.2）；refs 2：App + test |
| `canvas/nodes/_template/TemplateNode.tsx` | `canvas/nodes/_template/` | **非活节点 / 参考蓝本**（DATAFLOW §十六 已登记「→ `_template/`」**已完成**）；refs 2：tests×2，零生产消费 ⇒ 不占 registry、不再迁出 `src/`（D6 就此明确） |

#### D · `canvas/` 原地件（**34 件** · 目标 = 原地，B1 阶段再切子域）

> 这一组是**上一版计划最大的洞**：它们已在 `canvas/` 内、不跨目录搬，但按验收标准仍须逐件写明「目标 = 原地」与依据。
> 「B1 落点」= B1 批切子域后的最终路径；A 阶段它们**不动**。

| 当前路径 | 目标（= 原地） | B1 落点 | 依据（`refs` ①段消费方） |
| --- | --- | --- | --- |
| `canvas/ArrangeConfirm.tsx` | 原地 | `canvas/structure/` | 1 处：App ⇒ 画布「整理」确认 UI（App 装配入口，ⓐ类） |
| `canvas/CanvasEdgesContext.tsx` | 原地 | `canvas/structure/` | 11 处：canvas×8 · video×2 · App ⇒ history 注入通道，节点机制 |
| `canvas/FullscreenEditor.tsx` | ✅ 已搬入 | `canvas/shell/` | 4 处：canvas×3 · video×1 ⇒ `PromptInput` 的全屏展开态（同形态不拆） |
| `canvas/HoverToolbar.tsx` | ✅ 已搬入 | `canvas/shell/` | 7 处：canvas×6 · video×1 ⇒ 节点 hover 工具条 |
| `canvas/NodePalette.ts` | 原地 | `canvas/shell/` | 3 处：App · canvas · tests ⇒ 节点面板（`cat` 权威真源，产品写死） |
| `canvas/PromptInput.tsx` | ✅ 已搬入 | `canvas/shell/` | 9 处：canvas×4 · video×1 · tests×4 ⇒ 节点输入控件（三类节点共用） |
| `canvas/arrangePack.ts` | 原地 | `canvas/structure/` | 2 处：`src/hooks` · tests ⇒ ⚠️ 与 DATAFLOW §15.1「横切 utils」登记冲突：**按界面落点（画布整理按钮）+ 与 `ArrangeConfirm` 同形态**留 canvas，A9 回改 DATAFLOW §15.1，不回搬代码 |
| `canvas/canvasContextMenu.tsx` | 原地 | `canvas/shell/` | 2 处：App · tests ⇒ 画布右键三态配置 |
| `canvas/canvasHotkeys.ts` | 原地 | `canvas/topology/` | 3 处：video×1 · tests×2 ⇒ 画布快捷键（§7⑩ 落点由 S2-1 定，已在 canvas） |
| `canvas/canvasSnapshotSchema.ts` | 原地 | `canvas/contract/` | 2 处：canvas · tests ⇒ 落盘保留白名单 |
| `canvas/deriveNodes.ts` | 原地 | `canvas/structure/` | 11 处：canvas×9 · video×1 · tests ⇒ 建子节点+连线原子快照 |
| `canvas/edges/Comet.tsx` | 原地 | `canvas/edges/` | 2 处：canvas · tests ⇒ 连线特效 |
| `canvas/edges/ConnectionLine.tsx` | 原地 | `canvas/edges/` | 2 处：App · tests ⇒ 连线（App 装配入口，ⓐ类） |
| `canvas/edges/CustomEdge.tsx` | 原地 | `canvas/edges/` | 2 处：App · tests ⇒ 同上（建 edgeTypes） |
| `canvas/groupNodes.ts` | 原地 | `canvas/structure/` | 4 处：App · agent · canvas · tests ⇒ 编组/级联删/克隆 |
| `canvas/historyStack.ts` | 原地 | `canvas/structure/` | 2 处：canvas · tests ⇒ 撤销纯类 |
| `canvas/index.ts` | 原地（**域门面**） | `canvas/index.ts` | 8 处：`src/hooks`×4 · agent×2 · base×1 · video×1 ⇒ 门面已被真走 |
| `canvas/lazyNode.tsx` | 原地 | `canvas/shell/` | 4 处：canvas×2 · App · tests ⇒ 重节点懒加载（App 装配入口，ⓐ类） |
| `canvas/lod.tsx` | 原地 | `canvas/shell/` | 6 处：tests×3 · canvas×2 · App ⇒ LOD 性能降级（`LodProvider` 装配入口） |
| `canvas/nodeDataSchema.ts` | 原地 | `canvas/contract/` | 5 处：tests×3 · App · canvas ⇒ 新建 data 初值真源 |
| `canvas/nodeDefaults.ts` | 原地 | `canvas/contract/` | 11 处：canvas×8 · App · video×1 · tests ⇒ 结构默认单源 |
| `canvas/nodeImage.ts` | 原地 | `canvas/contract/` | 3 处：canvas×2 · tests ⇒ 节点图片契约 |
| `canvas/nodePrefs.ts` | 原地 | `canvas/contract/` | 19 处：tests×12 · canvas×5 · App · video×1 ⇒ 参数记忆（KV `yimao_node_prefs`） |
| `canvas/nodes/GroupNode.tsx` | 原地 | `canvas/nodes/` | 3 处：canvas×1（`NodePalette` 注册） · tests×2 ⇒ 画布机制节点（cat=other） |
| `canvas/promptChips.ts` | ✅ 已搬入 | `canvas/shell/` | 7 处：canvas×4 · creative×1 · video×1 · tests ⇒ `@{id:label}` 芯片序列化唯一入口 |
| `canvas/promptLayout.ts` | ✅ 已搬入 | `canvas/shell/` | 5 处：canvas×4 · video×1 ⇒ 输入区对齐基准（与 `PromptInput` 同形态） |
| `canvas/promptMention.ts` | ✅ 已搬入 | `canvas/shell/` | 3 处：canvas×2 · tests ⇒ `@提及` 输入控件逻辑 |
| `canvas/structuralSnapshot.ts` | 原地 | `canvas/structure/` | 2 处：canvas · tests ⇒ 结构快照 |
| `canvas/toolRegistry.ts` | 原地 | **域根**（1 件，不足子域门槛） | 2 处：canvas · tests ⇒ 画布 AI 工具注册表，由门面直接导出 |
| `canvas/upstreamLink.ts` | 原地 | `canvas/topology/` | 2 处：App · tests ⇒ 拓扑自动触发（App 装配入口） |
| `canvas/useCanvasEventSubscriptions.ts` | 原地 | `canvas/topology/` | 1 处：App ⇒ 3 个全局订阅收拢 |
| `canvas/nodes/Director3DNode.tsx` | 原地 | `canvas/nodes/` | 1 处：canvas（`NodePalette` 注册）⇒ **例外：director3d 禁重审**，挂载点留画布 |
| `canvas/nodes/GhostTargetNode.tsx` | 原地 | `canvas/nodes/` | 2 处：App · tests ⇒ 连线占位，非真实节点（例外已登记） |
| `canvas/nodes/_template/TemplateNode.tsx` | 原地 | `canvas/nodes/_template/` | 2 处：tests×2 ⇒ 非活参考蓝本，零生产消费 |

**小计核对**：`canvas/` = 34（原地）+ 14（A2/A5 迁入）= **48 件** ✓

---

## 3 · 分批计划（依赖已排序）

| 批 | 批次名 | 前置依赖 | 件级清单 | 验收标准（可测） |
| --- | --- | --- | --- | --- |
| **A0** | **拆 `base/store`** | 无（**全盘前置**） | 表 #1–#9（9 件）→ `task/`·`resource/`·`settings/`·`agent/runtime/` | ① `base/store` 只剩 6 件；② `task/`、`resource/`、`settings/` 三个目录**存在且含真源**；③ `npm run check:arch` 绿；④ `tsc` + `vite build` 绿 |
| **A1** | **拆 `canvas/nodes/`** | 无（但必须先于 A4/A5/A6） | 表 #49–#59（11 件）→ `image/nodes/`(8) · `image/`(1) · `text/`(1) · `scriptbox/`(1) | ① `canvas/nodes/` 只剩 4 件（`GroupNode`·`GhostTargetNode`·`Director3DNode`·`_template/`）；② `image/`、`text/` 目录已建；③ 复测 `refs base/utils/{imageUpscale,videoEngine}` 的消费者**不再落在 `canvas/nodes/`** |
| **A2** | **`base/panels` 域 UI 出** | **A0**（task/resource/generate/settings 目录已建） | 表 #10–#24（15 件） | ① `base/panels` 只剩 11 件（宿主层 + 横切 kit）；② `LeftPanel` 出现「宿主→4 域」的 import（这是**预期**，不是违规）；③ `FullscreenEditor`/`HoverToolbar`/`ResourceStrip` 六件形态组同处 `canvas/shell/` |
| **A3** | **拆 `base/prompt` + 删目录** | 无 | 表 #25–#26（2 件）→ `prompt/` | ① `find src/components -type d -name prompt` = **1**（只有 `components/prompt/`）；② `base/prompt/` 不存在 |
| **A4** | **`editors/` → `image/editors/` + 删目录** | **A1**（`image/` 已建） | 表 #60–#70（11 件）+ 删 `editors/index.ts` | ① `find src/components -type d -name editors` = **1**（只有 `image/editors/`）；② `components/editors/` 不存在；③ `image/editors/` 承接 11 件 |
| **A5** | **`base/ui` 节点部件归位** | **A1**（`canvas/` 已定形） | 表 #27–#39（13 件）→ `canvas/parts/`(9) · `canvas/shell/`(1) · `canvas/edges/`(1) · `agent/panels/`(1) · `scriptbox/`(1) | ① `base/ui` 只剩 12 件；② `refs canvas/parts/NodeShell.tsx` 的消费者不再含 `base/`；③ 搬前先解 #37 `JianyingIcon` 的 [待确认] |
| **A6** | **`base/utils` 域物归位** | **A1**（video/image 落点已建） | 表 #40–#46（7 件） | ① `base/utils` 只剩 16 件；② `refs video/lib/captureFrame.ts` 的 `base/` 消费者只剩 `videoEngine` 待 A6 一并处理（搬完应为 0） |
| **A7** | **横切回迁 + 键构造器归位** | 无 | 表 #47（videoEditorKeys→videoEditor）、#48（canvasSyncBus→base/core） | ① **`base/` 到 `components/canvas/` 的 import = 0**（修掉 `projectStore→canvasSyncBus` 这条规则 2 违规）；② `check:arch` 负例探针双向绿 |
| **A8** | **建门面 + 收口域外消费点** | **A0–A7 全完成** | 新建 8 个 `index.ts`；收口 `ResourceStrip←scriptbox/StepShots` 等域外直连 | ① 指标②（门面遵守率）= 100%；② 指标①（域外直连内部件）= 0 |
| **A9** | **DATAFLOW 回改** | **每批必做**（不是独立批） | `spec/DATAFLOW.md` §五/六/八/十/十五 + §十六 已改名表 | ① 搬过的件在 DATAFLOW 里的路径全部更新；② §十六 登记旧→新 |
| **A10** | **测试与闸同步** | **每批必做** | `tests/unit/` 镜像 + `scripts/` 硬编码路径 | 见「难点 4」结论；① `scan-outside-refs` 改前清单里旧路径片段改后 = 0；② 无假绿 |
| **B1** | **`canvas` 切子域** | A1·A2·A5 | 域根 27 件 → `contract/`(5)`structure/`(7)`shell/`(14)`topology/`(3) + 域根 2 | ① 域根散件 = 2（`index.ts` + `toolRegistry`）；② 每个子域 ≥3 件 |
| **B2** | **其余新域切子域** | A0–A7 | `image/` `video/` `settings/` 各自切 | ① 各域根散件 ≤2；② 子域 ≥3 件，否则并入相邻子域 |
| **B3** | **门面补齐 + 收口** | B1·B2 | 所有域 `index.ts`；`videoEditor`/`agent` 补遵守率 | 指标①②③④ 全绿 |

**每批收工三件事**：① 一笔提交；② 回改 `docs/DOMAIN-MODULES.md` 与 `spec/DATAFLOW.md`；③ 跑 §4 指标复测。

---

## 4 · 深模块的验收指标（**全部可机器验证**）

| # | 指标 | 命令 | 达标线 |
| --- | --- | --- | --- |
| **①** | **域外不直连内部件** | 对域内每个非 `index.ts` 件跑 `node scripts/mv-sync-refs.mjs refs <件>`，①段里「不属于本域且不属于 `base/`·`src/App.tsx`·`src/hooks/`·`tests/`」的条数 | **= 0** |
| **②** | **门面遵守率** | `refs <域>/index.ts` 的①段条数 ÷ 该域域外消费点总数 | **= 100%** |
| **③** | **域内有分层** | `find src/components/<域> -mindepth 1 -type d \| wc -l` | **≥ 1**（大域 ≥3） |
| **④** | **域根散件** | `find src/components/<域> -maxdepth 1 -type f -name '*.ts*' \| wc -l` | **≤ 2**（只剩 `index.ts` + 1 件不足门槛的） |
| **⑤** | **子域不是假子域** | `find src/components/<域>/<子域> -maxdepth 1 -type f \| wc -l` | **≥ 3**（<3 则并入相邻子域） |
| **⑥** | **无同名目录并存** | `find src/components -type d -name prompt` 与 `-name editors` | 各 **= 1** |
| **⑦** | **base 不反向依赖域** | `npm run check:arch`（规则 2） | **绿**（负例探针双向验） |
| **⑧** | **无外部引用断链** | `node scripts/scan-outside-refs.mjs --all`（改前记清单 → 改后旧片段必须 0） | **旧路径片段 = 0** |
| **⑨** | **无假绿（vi.mock 失效）** | `grep -rn "vi.mock" tests/unit` 命中「本批被搬走的路径」 | **= 0**（有则逐条核对 mock 是否仍生效） |

---

## 5 · 五个必须回答的难点（**结论**）

### 难点 1 · `base/store` 15 件住 8 个域 —— 先拆还是跟着域一起搬？

**结论：先拆，A0 单独一批，且它是 A2/A3 的前置。**
- **理由**：`resource`/`task`/`settings` 三个域的**数据真源**都在 `base/store`。若 UI 件先归位而真源不动，得到的是"半个域"（UI 在域里、数据在 base 里），门面无从建起（指标②必然不达标）。
- **拆法**：搬出 9 件（#1–#9），留下 6 件（`projectStore`·`backupStore`·`cloudSync`·`autoSync`·`generationOrchestration`·`nodeRuntimeStore`）。
- **留下 6 件的判据**：它们**没有用户能指着说的界面**——云同步/备份/项目是机制不是页面；`generationOrchestration` 是跨域生成流程编排（**不是**左栏「生成」页签，两者同名不同物）；`nodeRuntimeStore` 是纯内存瞬态（DATAFLOW §十一）。
- **依赖序**：`A0(store) → A2(panels 域 UI) / A3(prompt)`；`A1(nodes) → A4(editors) / A5(ui 部件) / A6(utils 域物)`；`A0–A7 → A8(门面) → B1/B2(切子域) → B3`。

### 难点 2 · 小域问题：`text`(1) · `generate`(1) · `prompt`(2) 建域还是合并？

**结论：全部建域，一个都不合并。**
1. **最正确**：`text` 是产品 `NodePalette.ts` 写死的 `cat:'text'`；`generate`/`prompt` 是 `LeftPanel.tsx:21-24` 写死的两个左栏页签 ⇒ 三个都是「用户能指着说的东西」（§2.0-bis）。合并它们就是**按代码省事、按事实说谎**。
2. **最清晰**：目录名 = 界面上看到的名字（`generate/`=生成页签、`prompt/`=提示词页签），AI 一眼找到。
3. **最简单**：不合并 = **不发明新分类**。`prompt` 合进 `creative` 会直接违反 §3.1.3.1 已裁定的「二者是两个东西、被三内容能力共用」。
4. **规则已支持**：§2.5 原文「**子域 ≥3 件**……⚠️ 此条只约束『子域』，**不约束『域』** —— 域由『用户能指着说的东西』定，可以只有 1~2 件」。
5. **配套**：件数 <3 ⇒ **不建子目录**（`text/` 直接放 `TextGenerate.tsx`，不建 `text/nodes/`），避免"假子域"。

> 反向应用同一条规则：`agentModelStore`+`skillStore` 只有 2 件 ⇒ **不建 `agent/stores/` 子域**，直接并进 `agent/runtime/`（已在 §2.2 A 表更正落点）。

### 难点 3 · 同名冲突（`base/prompt` vs `components/prompt`、`components/editors` vs `image/editors`）

**结论：旧目录必须删空消失，且验收用机器命令卡死。**
| 旧目录 | 处置 | 机器验收 |
| --- | --- | --- |
| `base/prompt/`（2 件） | A3 搬空即删 | `find src/components -type d -name prompt \| wc -l` = **1** |
| `components/editors/`（12 件） | A4 搬 11 件 + **删 `index.ts`**（并入 `image/index.ts`，不留双门面） | `find src/components -type d -name editors \| wc -l` = **1** |
- **顺带查出的第三个**：`base/panels/sections/` → `settings/sections/`，`base/panels/` 不再有 `sections/` ⇒ 无同名。
- **`canvas/nodes/` · `image/nodes/` · `video/nodes/` 不算冲突**：它们分属三个域（不同父目录），正是「域 = 用户能指着说的东西」的自然结果，不合并。

### 难点 4 · `tests/unit/` 平铺 + `scripts/` 硬编码路径的闸（会假绿）——要不要批次同步？

**结论：必须同步，且是每批的收工条件之一（不是"以后再说"）。**
- **为什么不做就假绿**：`mv-sync-refs.mjs` 只改 `src/` 的 import；`tests/unit/` 平铺 + `scripts/` 里 17 个文件硬编码 `components/...` 路径（`dead-code-baseline.json` 76 行 · `check-arch.mjs` 42 · `check-node-data.mjs` 20 · `strict-src-whitelist.json` 14 · `_smoke_checks.cjs` 7 · `check-node-handles.mjs` 6 · `mv-sync-refs.mjs` 4 · `check-storage-keys.mjs` 4 · `check-events.mjs` 4 · `check-api-contract.cjs` 4 · `health-check.cjs` 3 · `check-node-types.mjs` 3 …）⇒ 搬移后这些闸**扫的是已经不存在的路径**，全绿但什么都没查。
- **每批必做三步**：
  1. 改前：`node scripts/scan-outside-refs.mjs` 记一份旧路径清单；
  2. 改后：复跑，**旧路径片段命中必须 = 0**；
  3. `grep -rn "vi.mock" tests/unit` 命中本批被搬路径者逐条核对（Handoff 硬坑 #1：建门面会让 `vi.mock` 静默失效 = 假绿）。
- **`tests/unit/` 是否镜像域结构**：**是，但放在 B 阶段（B3）一次性做**，理由：A 阶段每批都镜像会造成测试文件二次 churn；A 阶段只保证「路径不断」，B 阶段再保证「结构与域对齐」。⏰ 这是本计划唯一的**已知延后项**，必须在 B3 结清。

### 难点 5 · `_template/TemplateNode` · `GhostTargetNode` · `ScriptBoxNode` 各自归宿

| 件 | 归宿 | 结论与依据 |
| --- | --- | --- |
| **`_template/TemplateNode`** | **留 `canvas/nodes/_template/`** | **非活节点 / 参考蓝本**，不占 registry（DATAFLOW §十六 已登记「`nodes/TemplateNode.tsx` → `nodes/_template/`」**该动作已完成**）。`refs` = 2 处，全是 tests ⇒ 零生产消费。**明确回答 D6/B1：不再迁出 `src/`**，就此结清，避免被当成未做动作重做 |
| **`GhostTargetNode`** | **留 `canvas/nodes/`** | 连线占位，**非真实节点**（§3.1.3.2「仅通用层」）；`refs` = 2（App + test）⇒ 属画布机制，例外已登记 |
| **`ScriptBoxNode`** | **`scriptbox/ScriptBoxNode.tsx`** | 独立应用入口（§3.1.3.2）；`refs` = 3（`canvas/NodePalette` + tests×2）⇒ `NodePalette` 是注册表，不算域消费；它是剧本盒子在画布上的挂载点，归应用域 |
| （附）**`Director3DNode`** | **留 `canvas/nodes/`** | 例外优先：director3d **已登记例外，禁重审**（§9 A3）⇒ 不施工 |

---

## 6 · 与草稿 `DOMAIN-RELOCATION-PLAN.md` 的差异（批判性检查）

| # | 草稿 | 本计划 | 为什么改 |
| --- | --- | --- | --- |
| 1 | §6 树没有 `settings/` | **加 `settings/`（12 件）** | 草稿按「`SettingsFrame` 1 件」判"不足 3 件不建域"，**漏算了它的真源**（`appSettings`·`settingRegistry`·`providerStore`·`accountsStore`）+ 7 个 `sections/` ⇒ 实为 12 件，且设置页是用户能指着说的东西。顺带消掉「多开/账号」这个 1 件伪域 |
| 2 | `ResourceStrip` → 素材域（§5 Q2） | **改 `canvas/shell/`** | 你的错误②，已复核确认 |
| 3 | `canvas/canvasSyncBus` 在 canvas 拓扑子域 | **回 `base/core/`** | 你的错误①，已复核确认（且现状违反规则 2） |
| 4 | A7 建 `api/relay/` 域 | **不建，3 件留 `base/api`** | 已知结论「生成链路是跨域流程，不是域」+ 域清单里没有 relay ⇒ 建它就是发明新分类 |
| 5 | `base/panels/CanvasToolbar`/`EmptyCanvasGuide` 留在宿主层 | **归 `canvas/shell/`** | 两者**长在画布上**（工具条/空画布中央引导）；判据 1（界面位置）优先于判据 4（被 App 消费）。判据 4 的真正适用对象只有 `LeftPanel`/`TopNav`/`ProjectSelector`/`PanelBar`/`SettingsFrame` |
| 6 | 只搬 2 件 UI kit 到 canvas | **再搬 11 件节点部件**（`NodeShell`·`NodeTitle`·`CustomHandle`·`GenerateButton`…） | 与已裁定的 `NodeShell→canvas` 同判例：它们**长在节点上** ⇒ 画布机制。不搬则"找节点部件要去 base/ui"，AI 必然找错 |
| 7 | 覆盖不全（最大漏洞） | **563 件逐件列全**（搬 70 + 原地 493） | 本文件 §2.1 + §2.2 每行都落到具体文件名 |
| 8 | `agent/stores/` 子域（本计划初稿） | **撤销，并进 `agent/runtime/`** | 2 件 <3 ⇒ 假子域（§2.5） |
| 9 | 未处置 `arrangePack` 的 DATAFLOW §15.1 冲突 | **留 `canvas/structure/`**，A9 回改 DATAFLOW §15.1 | DATAFLOW §15.1 把它登记为横切 utils，但它的界面落点是画布「整理」按钮、且 `ArrangeConfirm` 已同处 canvas ⇒ 按「同形态不拆」留 canvas，回改 DATAFLOW 而不是回搬代码（避免 D20 二次 churn） |
| 10 | `sourceTime`/`timeScale` 未分开判 | `sourceTime` **留** `base/utils/timeline/`；`timeScale` **归** `video/lib/` | DATAFLOW §十 原文：sourceTime 是「跨域唯一映射原语」⇒ 横切；timeScale 只有 video 一个消费者 ⇒ 归视频。形态相同但判据不同，不硬凑 |
