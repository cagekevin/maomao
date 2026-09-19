# TASK-025 · 域主：`canvas`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-025-域主-canvas.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

---

## 0. 实测前提（跑过的取证命令）

| 命令 | 用途 |
| --- | --- |
| `find src/components/canvas -type f ! -name '.DS_Store' \| sort` | 领地清单 ⇒ **50 件**（不含 `.DS_Store`） |
| `node scripts/mv-sync-refs.mjs refs <件>` ×50 | 主表「证据③」= ① 段原文（脚本一次只吃一个参数，逐件跑） |
| `grep -rn "components/canvas/" src --include='*.ts' --include='*.tsx'` | 域外直连 / 域内互引（D4 分层 + 成环检查） |
| `grep -rn "^import" src/components/canvas --include='*.ts'` `--include='*.tsx'` | 域内出向 import 全量（判 D4 / 环） |
| `grep -rn "canvas/nodes" src scripts tests docs --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.cjs' --include='*.json' --include='*.md'` | 「旧路径残留」（§4 指定） |

**件数口径**：本域实测 **50 件**（`backupStore.ts` ×1 · `contract/` ×4 · `edges/` ×4 · `index.ts` ×1 · `nodes/` ×4 · `parts/` ×9 · `shell/` ×15 · `structure/` ×8 · `toolRegistry.ts` ×1 · `topology/` ×3）。
**成因代号只描述「为什么错位」**，合规件填 `—`。

---

## 1. 主表 · 域籍台账（逐件 · 50 行 · 不许抽样）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/components/canvas/backupStore.ts` | **非本域·应属 `base`** | `base` | `base/store/` | `src/App.tsx:72` 经 `canvas/topology/useCanvasEventSubscriptions.ts:20` 提供备份/导入 IO（App 层工具栏按钮） | `backupStore.ts:60` `LS_KEYS = getLocalKeys()`（全量 localStorage 键）·`:197` `kvKeys()`∩模板（剪辑/3D/会话 KV）·`:170-182` 各项目画布快照 ·`:186` 账号环境 —— **三段皆非 canvas 私有** | `canvas/topology/useCanvasEventSubscriptions.ts` · `tests/unit/backupStore.test.ts` | 本域 **0 处渲染**；本域 schema **0 处**声明其字段（唯一域内引用 = `topology/useCanvasEventSubscriptions.ts:20` 的**调用**，非渲染） | C | 中 |
| 2 | `src/components/canvas/contract/canvasSnapshotSchema.ts` | 本域·合规 | `canvas` | `canvas/contract/` | 落盘保留白名单，无 UI（被 `base/store/projectStore.ts:34-36` 经门面消费） | `canvas-state-v1-*` 快照 sanitize 白名单 | `canvas/index.ts` · `tests/unit/groupNodes.test.ts` | 本域 1 处（`index.ts:40`） | — | 高 |
| 3 | `src/components/canvas/contract/nodeDataSchema.ts` | 本域·合规 | `canvas` | `canvas/contract/` | 新建节点 `data` 初值真源，无 UI | `node.data` 初值（`defaultNodeData`） | `src/App.tsx` · `canvas/index.ts` · `tests/unit/nodeDataSchema.test.ts` · `nodeDataSchemaDeepCloneEntry.test.ts` · `tests/unit/nodes/ssrRegression.test.ts` | 本域 1 处（`index.ts:23`） | — | 高 |
| 4 | `src/components/canvas/contract/nodeDefaults.ts` | 本域·合规 | `canvas` | `canvas/contract/` | 节点结构默认（尺寸/输入面板），无 UI | 节点类型默认值（`INPUT_PANEL_NODE_TYPES`/`ASSET_NODE_SIZE`） | `src/App.tsx` · `canvas/contract/nodeDataSchema.ts` · `canvas/index.ts` · `canvas/nodes/Director3DNode.tsx` · `canvas/structure/deriveNodes.ts` · `image/nodes/{FaceMosaic,GridMerge,GridSplit,Panorama}Node.tsx` · `video/nodes/VideoProcessNode.tsx` · `tests/unit/nodeDefaults.test.ts` | 本域 5 处（含 `index.ts:24-28`） | — | 高 |
| 5 | `src/components/canvas/contract/nodePrefs.ts` | 本域·合规 | `canvas` | `canvas/contract/` | 节点参数记忆（节点内输入区），无独立 UI | KV `yimao_node_prefs`（`contentGet/Set`，`nodePrefs.ts:35-36`） | `src/App.tsx` · `canvas/index.ts` · `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/{AssetNode,ImageGenerate}.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×11 | 本域 3 处（`index.ts:29`·`TemplateNode:22`） | — | 高 |
| 6 | `src/components/canvas/edges/Comet.tsx` | 本域·合规 | `canvas` | `canvas/edges/` | 连线彗星特效（画布边），宿主 `edges/CustomEdge.tsx` | 无（纯 SVG/CSS 动画） | `canvas/edges/CustomEdge.tsx` · `tests/unit/Comet.test.tsx` · `CustomEdge.test.tsx` | 本域 1 处（`CustomEdge.tsx:9`） | — | 高 |
| 7 | `src/components/canvas/edges/CometParticles.tsx` | 本域·合规 | `canvas` | `canvas/edges/` | 连线粒子（画布边），宿主 `edges/{Comet,ConnectionLine}` | 无 | `canvas/edges/Comet.tsx` · `canvas/edges/ConnectionLine.tsx` · tests ×2 | 本域 2 处 | — | 高 |
| 8 | `src/components/canvas/edges/ConnectionLine.tsx` | 本域·合规 | `canvas` | `canvas/edges/`（ⓐ 装配入口） | `src/App.tsx:76` → ReactFlow `connectionLineComponent` | 无（拖线预览） | `src/App.tsx` · `tests/unit/ConnectionLine.test.tsx` | 本域 1 处（`index` 无，`edges/` 内互引） | — | 高 |
| 9 | `src/components/canvas/edges/CustomEdge.tsx` | 本域·合规 | `canvas` | `canvas/edges/`（ⓐ 装配入口） | `src/App.tsx:75` → 建 `edgeTypes` | 无 | `src/App.tsx` · `tests/unit/CustomEdge.test.tsx` | 本域 1 处（`Comet` 反向） | — | 高 |
| 10 | `src/components/canvas/index.ts` | 本域·合规 | `canvas` | `canvas/index.ts`（门面） | 域门面，无 UI | 无 | `agent/canvas/agentCanvasHost.ts` · `agent/canvas/useCanvasAgentTools.ts` · `base/store/projectStore.ts` · `canvas/structure/useCanvasHistory.ts` · `scriptbox/useScriptBoxEngine.ts` · `video/depthVideo/spawn.ts` · `src/hooks/useArrangeCanvas.ts` · `src/hooks/useAssetDegrade.ts` | 本域 1 处（`structure/useCanvasHistory.ts:3` 经 `'..'`） | — | 高 |
| 11 | `src/components/canvas/nodes/Director3DNode.tsx` | 本域·合规（**已登记例外·禁重审**） | `canvas` | `canvas/nodes/` | `canvas/shell/lazyNode.tsx:127` 动态 import ⇒ 画布上的 director3d 挂载点 | director3d 工程 KV（经 `director3d/Director3DOverlay`，`Director3DNode.tsx:14`） | `canvas/shell/lazyNode.tsx` | 本域 1 处（`lazyNode.tsx:127`） | — | 高 |
| 12 | `src/components/canvas/nodes/GhostTargetNode.tsx` | 本域·合规（例外已登记） | `canvas` | `canvas/nodes/` | `src/App.tsx:36` → ReactFlow `nodeTypes` | 无（连线占位，非真实节点） | `src/App.tsx` · `tests/unit/GhostTargetNode.test.tsx` | 本域 1 处（App 装配 + `index` 登记） | — | 高 |
| 13 | `src/components/canvas/nodes/GroupNode.tsx` | 本域·合规 | `canvas` | `canvas/nodes/` | `canvas/shell/NodePalette.ts:30` 注册 ⇒ 画布编组容器 | 编组关系写 `node.parentId`（`structure/groupNodes.ts`） | `canvas/shell/NodePalette.ts` · `tests/unit/GroupNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 本域 1 处（`NodePalette.ts:30`） | — | 高 |
| 14 | `src/components/canvas/nodes/_template/TemplateNode.tsx` | 本域·合规（**非活蓝本**，计划 §C-435 登记） | `canvas` | `canvas/nodes/_template/` | 无生产界面（不占 registry，`NodePalette` 无此类型） | 无（零生产写入） | `tests/unit/TemplateNode.test.tsx` · `tests/unit/TemplateNode.upstream.test.tsx` | 本域 0 处生产渲染（仅测试） | F | 中 |
| 15 | `src/components/canvas/parts/CustomHandle.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/parts/NodeShell.tsx:4` 渲染（节点连接柄） | 无 | `canvas/parts/NodeShell.tsx` · `scriptbox/ScriptBoxNode.tsx` · tests ×8 | 本域 1 处（`NodeShell.tsx:4`） | — | 高 |
| 16 | `src/components/canvas/parts/ExpandablePanel.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/nodes/_template/TemplateNode.tsx:7` **（唯一本域渲染点=非活蓝本）** | 无 | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×10 | 本域 1 处（`TemplateNode:7`，非活）⇒ 风险见「交叉验证请求」 | F | 中 |
| 17 | `src/components/canvas/parts/GenerateButton.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/nodes/_template/TemplateNode.tsx:8` **（唯一本域渲染点=非活蓝本）** | 无 | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/{VideoExtract,VideoGenerate}Node.tsx`（含 `VideoGenerate`）· tests ×10 | 本域 1 处（`TemplateNode:8`，非活）⇒ 风险同上 | F | 中 |
| 18 | `src/components/canvas/parts/GeneratingOverlay.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/nodes/_template/TemplateNode.tsx:16` **（唯一本域渲染点=非活蓝本）** | 无 | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×9 | 本域 1 处（`TemplateNode:16`，非活）⇒ 风险同上 | F | 中 |
| 19 | `src/components/canvas/parts/JianyingIcon.tsx` | **非本域·应属 `并案（共享件）`** | `并案（共享件）` | 建议 `base/ui/`（2 域共享图标；若不并案，候选 `video/`——「发送到剪映素材库」属视频编辑能力） | `image/nodes/ImageGenerate.tsx:571` `<JianyingIcon size={14}/>`（菜单项 `jianying`，`:570-574`）· `video/nodes/VideoGenerate.tsx:289` 同 | **无数据落点**（`JianyingIcon.tsx:1` 仅 `import React`，零 store 写入；纯 SVG 图标） | `image/nodes/ImageGenerate.tsx` · `video/nodes/VideoGenerate.tsx`（+ tests ×5） | **本域 0 处渲染**（`grep -rn "JianyingIcon" src/components/canvas` 仅命中自身 4 行 4/11/19）；本域 0 处 schema 引用 ⇒ 零处成立 | C（依据「canvas×1」已过期，叠加 G） | 中 |
| 20 | `src/components/canvas/parts/NodeShell.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/nodes/{GroupNode.tsx:3,Director3DNode.tsx:7,_template/TemplateNode.tsx:5}` 渲染（节点外壳） | 无（外壳容器） | `canvas/nodes/Director3DNode.tsx` · `canvas/nodes/GroupNode.tsx` · `canvas/nodes/_template/TemplateNode.tsx` · `canvas/shell/lazyNode.tsx` · `image/nodes/`×8 · `video/nodes/`×3 · `text/TextGenerate.tsx` · `scriptbox/ScriptBoxNode.tsx` · tests ×18 | 本域 3 处（含 2 个活节点 `GroupNode`/`Director3DNode`） | — | 高 |
| 21 | `src/components/canvas/parts/NodeTitle.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/parts/NodeShell.tsx:3` 渲染（节点标题） | 无 | `canvas/parts/NodeShell.tsx` · tests ×3 | 本域 1 处（`NodeShell.tsx:3`） | — | 高 |
| 22 | `src/components/canvas/parts/ResizeFullscreenHandle.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/nodes/_template/TemplateNode.tsx:13` **（唯一本域渲染点=非活蓝本）** | 无 | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×8 | 本域 1 处（`TemplateNode:13`，非活）⇒ 风险同上 | F | 中 |
| 23 | `src/components/canvas/parts/ToolbarButton.tsx` | 本域·合规 | `canvas` | `canvas/parts/` | `canvas/shell/HoverToolbar.tsx:2` 渲染 | 无 | `canvas/shell/HoverToolbar.tsx` | 本域 1 处（`HoverToolbar.tsx:2`，活链路：App→节点 hover 条） | — | 高 |
| 24 | `src/components/canvas/shell/CanvasToolbar.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `src/App.tsx:29` 渲染（画布顶栏，纯 props 驱动） | 无（回调上抛） | `src/App.tsx` | 本域 1 处（App 装配） | — | 高 |
| 25 | `src/components/canvas/shell/ContextMenu.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `src/App.tsx:77` 渲染（挂画布外层，App:1583 注释） | 无 | `src/App.tsx` · `canvas/shell/canvasContextMenu.tsx` · `tests/unit/canvasContextMenu.test.ts` | 本域 2 处（App + `canvasContextMenu`） | — | 高 |
| 26 | `src/components/canvas/shell/EmptyCanvasGuide.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `src/App.tsx:115` 渲染（空画布引导） | 无 | `src/App.tsx` | 本域 1 处（App 装配） | — | 高 |
| 27 | `src/components/canvas/shell/FullscreenEditor.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `canvas/nodes/_template/TemplateNode.tsx:15` **（唯一本域渲染点=非活蓝本）** | 无（编辑器态） | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · `tests/unit/ImageGenerate.saveRatioSync.test.tsx` | 本域 1 处（`TemplateNode:15`，非活）⇒ 风险同上 | F | 中 |
| 28 | `src/components/canvas/shell/HoverToolbar.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `canvas/nodes/_template/TemplateNode.tsx:6` **（唯一本域渲染点=非活蓝本）** | 无 | `canvas/nodes/_template/TemplateNode.tsx` · `image/nodes/{AssetNode,FaceMosaicNode,ImageGenerate,PanoramaNode}` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×12 | 本域 1 处（`TemplateNode:6`，非活）⇒ 风险同上 | F | 中 |
| 29 | `src/components/canvas/shell/NodePalette.ts` | 本域·合规（ⓐ 装配入口 `buildNodeTypeComponents`） | `canvas` | `canvas/shell/`（职责=节点类型注册表，见「假子域」行 2） | `src/App.tsx:97` 建 `nodeTypes` | 无（含 `cat` 静态表） | `src/App.tsx` · `canvas/shell/canvasContextMenu.tsx` · `tests/unit/nodeTypes.test.ts` | 本域 1 处（App 装配） | — | 高 |
| 30 | `src/components/canvas/shell/PromptInput.tsx` | 本域·合规（`docs/DOMAIN-MODULES.md:1431` ⑥ 裁定「画布域控件组 4 件」） | `canvas` | `canvas/shell/` | `canvas/nodes/_template/TemplateNode.tsx:10` + `canvas/shell/FullscreenEditor.tsx:5` | 无 store；产出 prompt 字符串交宿主 | `canvas/nodes/_template/TemplateNode.tsx` · `canvas/shell/FullscreenEditor.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×11 | 本域 2 处（`TemplateNode:10`·`FullscreenEditor:5`，均非活链） | F | 中 |
| 31 | `src/components/canvas/shell/ResourceStrip.tsx` | 本域·合规（计划 §A4-14 → `canvas/shell/`） | `canvas` | `canvas/shell/` | `canvas/nodes/_template/TemplateNode.tsx:12` · `canvas/shell/FullscreenEditor.tsx:4` | 无 store（引用条 UI） | `canvas/nodes/_template/TemplateNode.tsx` · `canvas/shell/FullscreenEditor.tsx` · `image/nodes/ImageGenerate.tsx` · `scriptbox/StepShots.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · tests ×10 | 本域 2 处（`TemplateNode:12`·`FullscreenEditor:4`，均非活链） | F | 中 |
| 32 | `src/components/canvas/shell/canvasContextMenu.tsx` | 本域·合规 | `canvas` | `canvas/shell/` | `src/App.tsx:73` 取 `menuForState`（`App.tsx:1076` 注释：右键菜单已收口到本件） | 无 | `src/App.tsx` · `tests/unit/canvasContextMenu.test.ts` | 本域 2 处（App + `ContextMenu`） | — | 高 |
| 33 | `src/components/canvas/shell/lazyNode.tsx` | 本域·合规（ⓐ 装配入口 `prefetchHeavyNode` 待收 ⓑ） | `canvas` | `canvas/shell/` | `src/App.tsx:142` · `canvas/shell/NodePalette.ts:36` | 无（动态 import 表） | `src/App.tsx` · `canvas/shell/NodePalette.ts` · `tests/unit/lazyNode.test.tsx` | 本域 2 处 | — | 高 |
| 34 | `src/components/canvas/shell/lod.tsx` | 本域·合规（门面外泄 `useLod`；`LodProvider`=ⓐ） | `canvas` | `canvas/shell/` | `src/App.tsx:99`（`LodProvider`）· `canvas/edges/ConnectionLine.tsx:4`（`useLod`） | 无 | `src/App.tsx` · `canvas/edges/ConnectionLine.tsx` · `canvas/index.ts` · `src/hooks/useAssetDegrade.ts` · tests ×4 | 本域 2 处（`index.ts:54`·`ConnectionLine:4`） | — | 高 |
| 35 | `src/components/canvas/shell/promptChips.ts` | 本域·合规（⑥ 裁定） | `canvas` | `canvas/shell/`（D3 迹象见「假子域」行 4） | `canvas/shell/PromptInput.tsx:17` · `canvas/nodes/_template/TemplateNode.tsx:11` | 无 store；`@{id:label}` 芯片 ↔ DOM（`promptChips.ts` 头注：`document.createElement`） | `canvas/nodes/_template/TemplateNode.tsx` · `canvas/shell/PromptInput.tsx` · `creative/creativePresets.ts` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` · `tests/unit/promptChips.test.ts` | 本域 2 处 | — | 中 |
| 36 | `src/components/canvas/shell/promptLayout.ts` | 本域·合规（⑥ 裁定） | `canvas` | `canvas/shell/`（D3 迹象见「假子域」行 4） | `canvas/shell/FullscreenEditor.tsx:6` · `canvas/nodes/_template/TemplateNode.tsx:32` | 无（15 行纯常量 `PROMPT_PANEL_PAD_X`） | `canvas/nodes/_template/TemplateNode.tsx` · `canvas/shell/FullscreenEditor.tsx` · `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` | 本域 2 处 | — | 中 |
| 37 | `src/components/canvas/shell/promptMention.ts` | 本域·合规（⑥ 裁定） | `canvas` | `canvas/shell/`（D3 迹象见「假子域」行 4） | `canvas/shell/PromptInput.tsx:23` · `canvas/shell/promptChips.ts:29` | 无（`@提及` 逻辑，无 store） | `canvas/shell/PromptInput.tsx` · `canvas/shell/promptChips.ts` · `tests/unit/promptMention.test.ts` | 本域 2 处 | — | 中 |
| 38 | `src/components/canvas/shell/useContextMenu.ts` | 本域·合规（**计划未登记**，见「判据缺口」） | `canvas` | `canvas/shell/` | `src/App.tsx:78` → `App.tsx:607` `const menu = useContextMenu()`，挂到 ReactFlow `on*ContextMenu`（`App.tsx:1474-1476`） | 无（React state） | `src/App.tsx` · `canvas/shell/ContextMenu.tsx` · `canvas/shell/canvasContextMenu.tsx` · `tests/unit/useContextMenu.test.ts` | 本域 3 处 | F | 高 |
| 39 | `src/components/canvas/structure/ArrangeConfirm.tsx` | 本域·合规（ⓐ） | `canvas` | `canvas/structure/` | `src/App.tsx:30` 渲染（画布「整理」确认 UI） | 无 | `src/App.tsx` | 本域 1 处（App 装配） | — | 高 |
| 40 | `src/components/canvas/structure/CanvasEdgesContext.tsx` | 本域·合规 | `canvas` | `canvas/structure/` | 节点用 `useCanvasEdges()`（`App.tsx:81` 提供 Provider） | 无（history 注入通道） | `src/App.tsx` · `canvas/nodes/Director3DNode.tsx` · `image/nodes/`×6 · `text/TextGenerate.tsx` · `video/nodes/{VideoGenerate,VideoProcess}Node.tsx` | 本域 2 处（App + `Director3DNode`） | — | 高 |
| 41 | `src/components/canvas/structure/arrangePack.ts` | 本域·合规（**与 DATAFLOW §15.1 冲突，计划 §D-450 裁定留 canvas**） | `canvas` | `canvas/structure/` | `src/App.tsx:418` `useArrangeCanvas().arrange`（画布「整理」按钮）→ `src/hooks/useArrangeCanvas.ts:6` | 无（纯函数，写回由调用方 `setNodes/setEdges`） | `src/hooks/useArrangeCanvas.ts` · `tests/unit/arrangePack.test.ts` | 本域 **0 处**（域内无消费）⇒ 见「判据缺口」 | F | 中 |
| 42 | `src/components/canvas/structure/deriveNodes.ts` | 本域·合规 | `canvas` | `canvas/structure/` | 建子节点+连线的原子提交；宿主节点遍布各域 | `canvas/index.ts:39` `CanvasCommitHandles`；写 `node.data`/`edges` | `canvas/index.ts` · `canvas/nodes/Director3DNode.tsx` · `image/nodes/`×6 · `text/TextGenerate.tsx` · `video/nodes/VideoProcessNode.tsx` · `tests/unit/deriveNodes.test.ts` | 本域 3 处（`index.ts:33-39`·`Director3DNode:17`） | — | 高 |
| 43 | `src/components/canvas/structure/groupNodes.ts` | 本域·合规 | `canvas` | `canvas/structure/` | `src/App.tsx:118,127` 编组/级联删；`agent/canvas/useCanvasAgentTools.ts:13` 副作用 import 注册工具 | `node.parentId` / 级联删节点树 | `src/App.tsx` · `agent/canvas/useCanvasAgentTools.ts` · `canvas/index.ts` · `tests/unit/groupNodes.test.ts` | 本域 2 处（`index.ts:32` + agent 副作用） | — | 高 |
| 44 | `src/components/canvas/structure/historyStack.ts` | 本域·合规（**门面敞口**：域外消费 0） | `canvas` | `canvas/structure/` | 撤销纯类，无 UI；唯一取用方在域内（经门面） | 无（内存栈） | `canvas/index.ts` · `tests/unit/historyStack.test.ts` | 本域 1 处（`index.ts:41`） | — | 高 |
| 45 | `src/components/canvas/structure/structuralSnapshot.ts` | 本域·合规（**门面敞口**：域外消费 0） | `canvas` | `canvas/structure/` | 结构快照，无 UI；唯一取用方在域内（经门面） | 无（结构摘要） | `canvas/index.ts` · `tests/unit/structuralSnapshot.test.ts` | 本域 1 处（`index.ts:42-47`） | — | 高 |
| 46 | `src/components/canvas/structure/useCanvasHistory.ts` | 本域·合规（**计划未登记** + **D4 反向依赖**） | `canvas` | `canvas/structure/` | `src/App.tsx:79` → 画布撤销/重做；`structure/CanvasEdgesContext.tsx:2` 取 `CanvasHistoryApi` | 无（history 状态） | `src/App.tsx` · `canvas/structure/CanvasEdgesContext.tsx` · `tests/unit/canvasHooks.test.ts` · `tests/unit/useCanvasHistory.test.ts` | 本域 2 处 | F（+ D4 违规登记） | 高 |
| 47 | `src/components/canvas/toolRegistry.ts` | 本域·合规（**计划指定留域根**） | `canvas` | `canvas/`（域根，计划 §3-99/§D-472） | 无 UI；`agent/canvas/useCanvasAgentTools.ts:3-10` 经门面 `registerTool/getTools` | 无（模块级数组） | `canvas/index.ts` · `tests/unit/toolRegistry.test.ts` | 本域 1 处（`index.ts:50`） | — | 高 |
| 48 | `src/components/canvas/topology/canvasHotkeys.ts` | 本域·合规 | `canvas` | `canvas/topology/` | `video/nodes/VideoProcessNode.tsx:32`（画布上的节点，`:753` 调 `useCanvasKeydown`）—— 本件是「画布内组件注册 window keydown 的唯一入口」（`canvasHotkeys.ts:14`） | 无 | `video/nodes/VideoProcessNode.tsx` · `tests/unit/editorOwnership.test.tsx` · `tests/unit/modalLayer.test.ts` | 本域 0 处直接渲染 ⇒ 但它是画布级不变量入口（压制让位），见「交叉验证请求」 | — | 中 |
| 49 | `src/components/canvas/topology/upstreamLink.ts` | 本域·合规 | `canvas` | `canvas/topology/` | `src/App.tsx:113` `useUpstreamAutoTrigger`（画布上游自动触发） | `base/core/event/eventBus` 订阅 + `base/store/taskStore.runNodeGeneration` | `src/App.tsx` · `tests/unit/upstreamLink.test.ts` | 本域 1 处（App 装配） | — | 高 |
| 50 | `src/components/canvas/topology/useCanvasEventSubscriptions.ts` | 本域·合规 | `canvas` | `canvas/topology/` | `src/App.tsx:72` `useProjectBackupIO`（备份/导入按钮 IO） | 无自有数据；调 `canvas/backupStore`（域根散件，见 #1） | `src/App.tsx` | 本域 1 处（App 装配） | — | 高 |

---

## 2. 本域特有事项 · 逐条结论（TASK-025 §3）

### §3.1 域根散件（D1）—— 结论：**1 件，且判非本域**

域根实测 3 件：`index.ts`（门面，D1 例外①）· `toolRegistry.ts`（计划写明留域根，D1 例外②）· **`backupStore.ts`（无例外）**。

`backupStore.ts` 判 **非本域 ⇒ 应回 `base/store/`**。四件证据见主表 #1；另有一条**计划书证**：

```
docs/plan/域归位-最终执行计划.md:422
| `base/store/` | 6 | `autoSync.ts` `backupStore.ts` `cloudSync.ts` `generationOrchestration.ts` `nodeRuntimeStore.ts` `projectStore.ts` |
  | **只剩「无用户可指界面」的基础设施真源**：云同步/备份/项目 = 机制不是界面 …
```

即**同一份计划**要求 `backupStore.ts` 留 `base/store/`（§3 的 canvas 树里也从未出现它）—— 现落在 `canvas/` 域根既违反 D1，也与计划 §422 冲突。
**风险已如实标注**：域内唯一引用是 `topology/useCanvasEventSubscriptions.ts:20`（`App.tsx:72` 消费 `useProjectBackupIO` 的备份 IO），它是**调用**不是渲染、本域 schema 零引用 ⇒ 按 §4 第 4 条「零处 ⇒ 成立」判非本域；若裁判认为「装配层 hook 的调用算本域在用」，则降级 `待核`（此为 §4 第 4 条唯一可争议点，已在交叉验证请求中点名）。

### §3.2 `edges/` 不在计划树（判据缺口 · 必答）—— 结论：**① 计划漏写，应补进 §3 树**

`edges/` **不并入 `structure/`**。依据（三条实测/书证）：

1. **计划自己两处写了 `canvas/edges/`**：
   - `docs/plan/域归位-最终执行计划.md:231`（§A4 第 28 行）`| 28 | CometParticles | canvas/edges/ |`
   - 同文件 `:455-457`（§D 表）`canvas/edges/{Comet,ConnectionLine,CustomEdge}.tsx → canvas/edges/`
2. **域登记也写 `edges/`**：`docs/DOMAIN-MODULES.md:211`「**画布域**(38) … `canvas/edges/`（边 3）」·`:775`「`nodes/` · `edges/`」。唯一没写它的是 §3 的**目录树块**（`:87-100`）⇒ 定性 = **计划 §3 树漏写**（书证缺口，不是归属争议）。
3. **形态不同，不该并**：`edges/` 4 件是**连线视觉**（`Comet` · `CometParticles` · `ConnectionLine` · `CustomEdge`，出向 import 只有彼此 + `shell/lod`）；`CanvasEdgesContext` 是**history 注入上下文**（机制）。计划把后者放 `structure/`、前者放 `edges/`，二者《形态》本不同 —— 并入 `structure/` 会把"画布上的连线"与"结构算法"混成一类（违 D3）。
4. **门槛满足**：4 件 ≥3 件门槛（D2）。

⇒ **不自行认定**，请裁判在 §3 树补 `edges/`（4 件）。本轮按现状登记为**合规落点**（计划 §A4/§D 已指定）。

### §3.3 `nodes/` 分居复核（本域最重要的一问）

**A. 现在留在 `canvas/nodes/` 的每一件（4 件）是否都该留** —— 逐件判定（主表 #11-#14），判据只用 L1 两条：

| 件 | 界面长在哪（证据①） | 数据落哪（证据②） | 结论 |
| --- | --- | --- | --- |
| `GroupNode.tsx` | `canvas/shell/NodePalette.ts:30` 注册为画布节点 | `node.parentId` 由 `structure/groupNodes.ts` 维护（画布结构，非任何能力域数据） | **该留**（画布编组机制） |
| `GhostTargetNode.tsx` | `src/App.tsx:36` 进 `nodeTypes`（拖线落点占位） | 无 | **该留**（画布交互机制，非真实节点） |
| `_template/TemplateNode.tsx` | 无生产界面（不占 registry，`NodePalette` 无此类型；refs 仅 tests×2） | 无 | **该留但需标注**：它是**非活参考蓝本**，本身零生产消费 ⇒ 「留」的正当性来自"画布节点的官方蓝本"，非"它在被用"（见「判据缺口」F-3） |
| `Director3DNode.tsx` | `canvas/shell/lazyNode.tsx:127` 动态 import ⇒ 画布挂载点 | director3d 工程 KV（经 `director3d/Director3DOverlay`） | **该留**（已登记例外·禁重审） |

**B. 域内其余地方是否还藏着本该在别的能力域的节点** —— **0 处**。
取证：领地 50 件里，除 `canvas/nodes/` 4 件外，**再无任何节点组件**（`parts/` 9 件是零件：`NodeShell`/`NodeTitle`/`CustomHandle`/`GenerateButton`/`GeneratingOverlay`/`ExpandablePanel`/`ResizeFullscreenHandle`/`JianyingIcon`/`ToolbarButton`；`shell/`/`structure/`/`topology/`/`contract/` 无 `*Node` 命名件）；A2 的 11 件节点（`ImageGenerate`/`TextGenerate`/`ScriptBoxNode`/`VideoGenerate`/`VideoExtractNode`/`VideoProcessNode`/`ImageBoxNode`/`GridSplitNode`/`GridMergeNode`/`PanoramaNode`/`FaceMosaicNode`/`LoopNode`/`AssetNode`/`useImageHoverActions`）**已全部搬离**，域内 `grep -rn "components/canvas/nodes/"` 只剩 4 件自引 + `NodePalette`/`lazyNode`/`App`（指向仍在的那 3 件）。

### §3.4 `App.tsx` 直连收口 —— 结论：**未完成。21 行命中 = 7 行合规（ⓐ）+ 15 处违规**

实测命令：`grep -n "components/canvas" src/App.tsx`。

**ⓐ 合规（计划 §A3-206 显式装配入口，7 行）**：`30` ArrangeConfirm · `36` GhostTargetNode · `75` CustomEdge · `76` ConnectionLine · `81` CanvasEdgesProvider · `97` buildNodeTypeComponents · `99` LodProvider。

**仍直连本域内部件（15 处 · `文件:行` → 符号）**：

| 行 | 符号 | 计划归属 |
| --- | --- | --- |
| `src/App.tsx:29` | `CanvasToolbar` | **计划未列**（§A3 只列 ⓐ7 + ⓑ11） |
| `src/App.tsx:72` | `useProjectBackupIO` | ⓑ 未收 |
| `src/App.tsx:73` | `menuForState` | ⓑ 未收 |
| `src/App.tsx:77` | `ContextMenu` | **计划未列** |
| `src/App.tsx:78` | `useContextMenu` | **计划未列** |
| `src/App.tsx:79` | `useCanvasHistory` | **计划未列** |
| `src/App.tsx:98` | `defaultNodeData` | ⓑ 未收 |
| `src/App.tsx:99` | `useLod`（同行的 `LodProvider` 合规） | ⓑ 未收 |
| `src/App.tsx:113` | `useUpstreamAutoTrigger` | ⓑ 未收 |
| `src/App.tsx:115` | `EmptyCanvasGuide` | **计划未列** |
| `src/App.tsx:118-123` | `createGroupFromNodes`/`ungroupNodes`/`deleteNodesWithCascade`/`duplicateSelectedWithEdges` | ⓑ「`groupNodes` 系列」未收 |
| `src/App.tsx:127-130` | `resolveDragGrouping`/`normalizeNodeParents` | ⓑ「`groupNodes` 系列」未收 |
| `src/App.tsx:135-138` | `applyNodeTypeDefaults`/`INPUT_PANEL_NODE_TYPES` | ⓑ 未收 |
| `src/App.tsx:139` | `injectNodePrefs` | ⓑ 未收 |
| `src/App.tsx:142` | `prefetchHeavyNode` | ⓑ 未收 |

**计划 ⓑ 清单本身缺 5 件**：`CanvasToolbar` · `ContextMenu` · `useContextMenu` · `useCanvasHistory` · `EmptyCanvasGuide`（App 直连但 §A3 未列 ⇒ 判据缺口 F-2）。
`broadcastCanvasSaved`（计划 ⓑ 点名）实测**不在 App.tsx**：`canvasSyncBus.ts` 已于 A6 回 `base/core/`（`docs/plan/域归位-最终执行计划.md:70`）⇒ 该项自然消解。

### §3.5 `index.ts` 门面 —— 结论：**基本收口，但仍有 2 件敞口 + topology 该收没收**

| 子域 | 件数 | 门面外泄 | 结论 |
| --- | --- | --- | --- |
| `contract/` | 4 | **4/4**（`nodeDataSchema:23`·`nodeDefaults:24-28`·`nodePrefs:29`·`canvasSnapshotSchema:40`） | **非敞口**：4 件均有域外真实消费者（`projectStore` 要 `sanitize*`；agent 要 `defaultNodeData`/`applyNodeTypeDefaults`；scriptbox 要 `injectNodePrefs`；`hooks/useArrangeCanvas` 要 `INPUT_PANEL_NODE_TYPES`）⇒ 宽 = 最小集 |
| `structure/` | 8 | 4（`groupNodes:32`·`deriveNodes:33-39`·`historyStack:41`·`structuralSnapshot:42-47`） | **敞口 2 件**：`HistoryStack` 与 `structuralSnapshot` 三函数的**域外消费 = 0**（refs ① 仅 `canvas/index.ts` + tests）⇒ 应撤出（唯一取用方是本域 `structure/useCanvasHistory.ts`，改域内相对导入即可，同时消除 §3.7 的反向依赖） |
| `topology/` | 3 | **0/3** | **不是敞口，是「该收没收」**：`upstreamLink`（App:113）· `useCanvasEventSubscriptions`（App:72）被 App 直连；`canvasHotkeys` 被 `video/nodes/VideoProcessNode.tsx:32` 直连 3 件均未走门面 ⇒ 与 §3.4 同一笔账 |

**附**：门面「宽窄」的真正问题不在 contract/structure/topology，而在**域外绕过门面直连内部件**（15 个文件 · 49 条 import），见「假子域 / 域内分层违规 / 成环」行 5。

### §3.6 `parts/` 是否混职责（D3）—— 结论：**非假子域**

逐件 import 实测（`grep "^import"`）：`NodeShell`→`parts/{NodeTitle,CustomHandle}`；`NodeTitle`→仅 react；`CustomHandle`→`@xyflow` + `base/core/utils`；`GenerateButton`/`GeneratingOverlay`/`ExpandablePanel`/`ToolbarButton`→仅 react/lucide；`ResizeFullscreenHandle`→`base/core/utils`；`JianyingIcon`→仅 react。
**9 件全是零件**：**零 store**、**零算法**、**零域内反向依赖**（出向 import 落在 `parts/` 自身、`base/*`、`@xyflow`）⇒ 无假子域。
（唯一"非零件"件是 `JianyingIcon`，且问题不是职责而是**域籍** —— 见主表 #19。）

### §3.7 域内分层方向（D4）—— 抽 9 件跑 `refs`，**命中 1 条反向依赖**

按 D4 分层（视图 `nodes/edges/shell/ui` → 机制 `parts/structure/topology` → 能力 `contract`）逐件看**出向 import 落点**：

| 抽查件 | 出向 import 落点 | 方向 |
| --- | --- | --- |
| `structure/groupNodes.ts:1-3` | `base/core/{idGen,nodeSizePatch}` + `@xyflow` | 无域内依赖 ✓ |
| `structure/deriveNodes.ts:2` | `contract/nodeDefaults` | 机制→能力 ✓ |
| `structure/CanvasEdgesContext.tsx:2` | `structure/useCanvasHistory` | 机制→机制 ✓ |
| `parts/NodeShell.tsx:3-4` | `parts/{NodeTitle,CustomHandle}` | 零件→零件 ✓ |
| `parts/CustomHandle.tsx:3` | `base/core/utils` | 无域内依赖 ✓ |
| `parts/GenerateButton.tsx:2` | `lucide-react` | 无域内依赖 ✓ |
| `topology/canvasHotkeys.ts:2-3` | `base/core/interaction/*` | 无域内依赖 ✓ |
| `topology/upstreamLink.ts:18-21` | `base/core/*`、`base/store/taskStore` | 无域内依赖 ✓ |
| **`structure/useCanvasHistory.ts:3-9`** | **`'..'`（= `canvas/index.ts`）** | 🔴 **机制层→门面；门面含视图件** |

```3:9:src/components/canvas/structure/useCanvasHistory.ts
import {
  HistoryStack,
  applyStructuralSnapshot,
  extractStructuralSnapshot,
  isSameStructure,
} from '..';
```

而 `index.ts:54` 是 `export { useLod } from './shell/lod.tsx';`（视图件）⇒ **`structure/` 经门面传递依赖到 `shell/`（视图层）= D4 反向依赖**。修法（本轮不搬）：改域内相对导入 `../{structure/historyStack,structure/structuralSnapshot}` 并撤门面敞口（与 §3.5 同一处修复）。

### §3.8 域内成环 —— 结论：**0 环**（逐边核对）

按 `grep -rn "^import" src/components/canvas` 的**全量出向边**逐条核对，域内边只有：

```
index.ts → contract/{nodeDataSchema,nodeDefaults,nodePrefs,canvasSnapshotSchema}
          · structure/{groupNodes,deriveNodes,historyStack,structuralSnapshot} · toolRegistry · shell/lod
contract/nodeDataSchema → contract/nodeDefaults        structure/deriveNodes → contract/nodeDefaults
structure/useCanvasHistory → index.ts（↑§3.7 违规边）   structure/CanvasEdgesContext → structure/useCanvasHistory
nodes/* → parts/* · shell/* · contract/* · structure/*
shell/NodePalette → nodes/GroupNode · shell/lazyNode    shell/lazyNode → parts/NodeShell · nodes/Director3DNode
shell/HoverToolbar → parts/ToolbarButton               shell/FullscreenEditor → shell/{PromptInput,ResourceStrip,promptLayout}
shell/PromptInput → shell/{promptChips,promptMention}   shell/promptChips → shell/promptMention
shell/{ContextMenu,canvasContextMenu} → shell/{useContextMenu,NodePalette,ContextMenu}
parts/NodeShell → parts/{NodeTitle,CustomHandle}       edges/{CustomEdge→Comet→CometParticles, ConnectionLine→CometParticles,shell/lod}
topology/useCanvasEventSubscriptions → backupStore（域根散件）
```

无任何回路 ⇒ **0 环**。但 `structure/useCanvasHistory → index.ts → structure/*` 是**经门面的自指边**（今日不成环，只因 `index.ts` 恰未 export `useCanvasHistory`）⇒ **潜在成环风险**，与 §3.7 同一处修复。

### §4 旧路径残留（`canvas/nodes` 专项）

按任务书给的 `grep` 跑完（含 `src scripts tests docs`）。**区分三类**：

**① 活代码仍指旧路径（命中成因 B · 必须修）—— 1 处**

| 位置 | 旧路径 | 影响 |
| --- | --- | --- |
| `scripts/_smoke_checks.cjs:212` | `return flat \|\| path.join(ROOT, 'src/components/canvas/nodes', comp + '.jsx')` | `resolveCompFile` 的**兜底行**仍拼 `canvas/nodes/*.jsx`（`.jsx` 扩展名本身也是旧的）。同文件 `:202-203` 注释自称「已改为按候选域顺序查找」，**兜底行未同步** ⇒ 前两级命中时看不出来，一旦走到兜底就返回不存在路径。**与 A2 后 `check-node-handles` 豁免失灵同类母体** |

**② 注释级 stale（成因 G · 逐条列出）—— 4 处**

| 位置 | 旧表述 | 现状 |
| --- | --- | --- |
| `src/components/video/index.ts:16-17` | 「域外消费者（`refs` 实测 2 处）：`canvas/nodes/AssetNode` · `canvas/nodes/VideoGenerate`」 | 实为 `image/nodes/AssetNode.tsx` · `video/nodes/VideoGenerate.tsx` |
| `src/components/creative/index.ts:15` | 「`canvas/nodes/{Image,Text,Video}Generate`」 | 实为 `image/nodes/ImageGenerate.tsx` · `text/TextGenerate.tsx` · `video/nodes/VideoGenerate.tsx` |
| `scripts/test-affected.cjs:11` | 示例 `src/components/canvas/nodes/TextNode.tsx → …` | 该件早已不在 `canvas/nodes` |
| `scripts/check-node-handles.mjs:38,50,175` | 「原先自己拼 `src/components/canvas/nodes/${Pascal}.tsx`」 | 说明性历史注释（已改为走 `node-file-resolver.cjs`）⇒ 保留可，无需改 |

**③ 正确保留（**不是**残留，勿误删）**

- `scripts/node-file-resolver.cjs:38` 候选目录真源含 `'src/components/canvas/nodes'` ⇒ **该目录仍存在**（`GroupNode`/`GhostTargetNode`/`Director3DNode`/`_template`）。
- `scripts/check-node-data.mjs:72,77,82` 三行（`director3dNode`/`group`/`ghostTarget`）指向的正是**仍留在** `canvas/nodes/` 的 3 件 ⇒ 路径正确（**任务书 §4 提到的「check-node-data 3 条 stale」现已修好**，该闸 `:55-56` 头注已说明走 resolver）。
- `scripts/strict-src-whitelist.json:14` `"src/components/canvas/nodes/"` ⇒ 目录存在，白名单正确（`:2` 注释已记 A2 教训「原 15 件掉到 4 件」）。
- `tests/unit/{GroupNode,GhostTargetNode}.test.tsx`、`tests/unit/nodes/ssrRegression.test.ts`、`tests/unit/TemplateNode*.test.tsx`、`tests/unit/nodeImageWrite.test.ts:139`、`tests/unit/nodeDefaults.test.ts:163`（`Director3DNode`）⇒ 指向仍存在的件。
- `tests/unit/timelineShared.test.ts:48-53` · `tests/unit/utils.test.ts:287`：把旧路径放**多候选数组**（`HOST_CANDIDATES = ['video/nodes/VideoProcessNode.tsx', 'canvas/nodes/VideoProcessNode.tsx']`）作为**搬迁容错**，注释明确「写死路径会让本测试 ENOENT 假红」⇒ **刻意保留**，非残留。
- `docs/DOMAIN-RELOCATION-PLAN.md:91-103,112-113,187-188,480`：搬迁**历史记录**（`~~canvas/nodes/~~` 删除线）⇒ 文档，非内存路径。
- `.DS_Store`：非源码。

---

## 3. 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| `base` | 1 | `src/components/canvas/backupStore.ts`（→ `base/store/`） |
| `并案（共享件）` | 1 | `src/components/canvas/parts/JianyingIcon.tsx`（image×1 + video×1，零业务语义） |
| 其余域 | 0 | — |

## 4. 域内错位表（属本域 · 子目录不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| — | — | — | **0 件**。逐件比对计划 §3 树（`:87-100`）：`contract/` 4/4 ✓ · `structure/` 7/7 ✓（+1 计划外）· `shell/` 14/14 ✓（+1 计划外）· `parts/` 9/9 ✓ · `topology/` 3/3 ✓ · `nodes/` 4/4 ✓ · `edges/` 4/4 ✓（树漏写，见 §3.2）· `toolRegistry.ts` 域根例外 ✓。**无一件「属本域但子目录错」**；2 件计划外（`structure/useCanvasHistory.ts` · `shell/useContextMenu.ts`）落点本身合理，仅缺计划登记 ⇒ 进「判据缺口」 |

## 5. 域根散件清单（现状 **1** 件 · 目标 0）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外（无则"无例外"） |
| --- | --- | --- | --- |
| `backupStore.ts` | `src/components/canvas/`（域根） | **无**（判非本域 ⇒ 应回 `base/store/`，见主表 #1） | **无例外** |
| `index.ts` | 域根 | 留域根 | D1 例外①（门面） |
| `toolRegistry.ts` | 域根 | 留域根 | D1 例外②（计划 §3-99 / §D-472 写明「留域根」，1 件 < 3 件门槛，不建 `registry/`） |

## 6. 假子域 / 域内分层违规 / 成环

| # | 现象 | 涉及件 | 依据 |
| --- | --- | --- | --- |
| 1 | **D4 反向依赖（机制层→视图层）** | `structure/useCanvasHistory.ts:3-9` | 经 `'..'` 引门面，门面 `index.ts:54` 含 `shell/lod.tsx`（视图件）⇒ `structure/` 传递依赖 `shell/` |
| 2 | **职责混入 shell/（假子域迹象 · 轻度）** | `shell/NodePalette.ts` | 它是**节点类型注册表 + 跨域装配**（`NodePalette.ts:18-31` 直连 `text/TextGenerate` · `components/image` · `video/nodes/{VideoGenerate,VideoExtractNode}` · `scriptbox/ScriptBoxNode` · `canvas/nodes/GroupNode`），而 D3 定义 `shell/` = 外壳/工具栏 ⇒ 「注册表」不属于外壳职责（计划 `:371` 曾想建 `registry/`，因 <3 件作罢） |
| 3 | **职责混入 shell/（假子域迹象 · 轻度）** | `shell/lod.tsx` · `shell/lazyNode.tsx` | 二者是**机制件**（LOD 降级 / 重节点懒加载，出向 import 含 `@xyflow`、动态 import 表），非"外壳"；计划 §3 指定 `shell/` ⇒ 与 D3 定义有张力 |
| 4 | **D3 纯逻辑件落 shell/** | `shell/promptChips.ts`（DOM 工具层，542 行）· `shell/promptLayout.ts`（15 行纯常量）· `shell/promptMention.ts`（123 行纯逻辑） | 三件**零 JSX**（`grep -c "<[A-Z]\|<div\|createElement"`：`promptLayout`=0、`promptMention`=0、`promptChips` 仅 DOM API 无组件），D3 的 `lib/`=「纯能力，禁 JSX」形态与之最接近；计划 §3-91 指定 `shell/` |
| 5 | **域外绕过门面直连内部件（收口违规 · 15 文件 / 49 条）** | `image/nodes/{ImageGenerate 15,PanoramaNode 5,AssetNode 5,GridSplitNode 4,GridMergeNode 4,LoopNode 3,FaceMosaicNode 3,ImageBoxNode 1}` · `video/nodes/{VideoGenerate 14,VideoProcessNode 5,VideoExtractNode 2}` · `text/TextGenerate 14` · `scriptbox/ScriptBoxNode 2` · `agent/canvas/useCanvasAgentTools.ts:13`（副作用 import `structure/groupNodes`）· `src/hooks/useArrangeCanvas.ts:6`（直连 `structure/arrangePack`） | 实测 `grep -rn "components/canvas/" src \| grep -v "^src/components/canvas/\|^src/App.tsx"`。门面存在的唯一理由（域内重排不波及域外）在**节点域侧完全失效** —— 这 15 个文件在 A2/A3 之后仍指向 `parts/*` · `shell/*` · `contract/*` · `structure/*` 的**内部件路径** |
| 6 | **成环** | — | **0 环**（逐边核对见 §3.8）；`structure/useCanvasHistory → index.ts → structure/*` 为经门面的自指边（今日不成环，潜在风险，与行 1 同修） |

## 7. 判据缺口（无据可依处 · 供裁判裁定）

| # | 现象 | 建议补什么 |
| --- | --- | --- |
| F-1 | **计划 §3 树漏写 `edges/`**（同计划 §A4-231 / §D-455-457 与 `DOMAIN-MODULES:211/775` 都写 `canvas/edges/`） | 补计划 §3 树 4 行（非 ADR）：把 `edges/` 写进 canvas 树，否则后续批次会按"计划没有它"误并/误删 |
| F-2 | **计划 §A3 的 ⓐ/ⓑ 清单不全**：App 直连的 `CanvasToolbar` · `ContextMenu` · `useContextMenu` · `useCanvasHistory` · `EmptyCanvasGuide` 五件**计划两处都没列** | 补 ADR-0040 一条「收口验收以**实测直连集**为准，不以清单为准；清单缺项按同形态就近归类」（否则"收口完成"永远可被清单缺项伪造） |
| F-3 | **「非活蓝本是否算渲染点」无据**：`nodes/_template/TemplateNode.tsx` 计 0 生产消费（计划 §C-435），却是 `parts/{GenerateButton,GeneratingOverlay,ExpandablePanel,ResizeFullscreenHandle}` 与 `shell/{HoverToolbar,PromptInput,ResourceStrip,FullscreenEditor,promptChips,promptLayout}` 的**唯一本域渲染点** | 补 ADR-0040 一条：反证检查里「本域渲染点」**是否包含非活蓝本**。答"含"⇒ 10 件维持本域；答"不含"⇒ 这 10 件满足「≥3 业务域消费 + 零业务语义」（L3）⇒ 应判 `base/ui` 真横切。**本轮按"含"登记为本域·合规（`F` 标注），请裁判落判** |
| F-4 | **`structure/arrangePack.ts` 与 DATAFLOW §15.1 登记冲突，且本域 0 消费**（唯一消费者 = `src/hooks/useArrangeCanvas.ts`，横切 hooks） | 计划 §D-450 已裁定「按界面落点（画布整理按钮，`App.tsx:418`）+ 与 `ArrangeConfirm` 同形态留 canvas」，但判据 4「只被横切消费的件住业务域」无明文 ⇒ 建议补 ADR-0040：「界面落点优先于消费方目录」（并同步改 DATAFLOW §15.1，计划已写明 A9 回改） |
| F-5 | **`base/` 收留的边界无据**：`backupStore` 的三段数据（LS/KV/canvas）+ 唯一消费者在画布，落 `base/store/` 是否违 L4「只被一个业务域消费的件不许留横切层」 | 建议补 ADR-0042 一条：**L4 的"消费"以「业务语义宿主」计，不以 import 数计** —— 备份/导入导出是 App 级基础设施（无用户可指界面，计划 §422 原文），不因唯一调用点在画布而变域件 |
| F-6 | **`shell/` 里住机制件与纯逻辑件（本文 §6 行 2-4）**：D3 定义 `shell/`=外壳，但 `NodePalette`（注册表）· `lod`/`lazyNode`（机制）· `prompt*`（纯逻辑）都在里面，计划 §3 又指定 shell/ | 建议补 D3 一条「不足 3 件的机制/逻辑件，随其宿主外壳同居；达 3 件才立 `lib/`」，避免每件都开子目录或反复判"假子域" |
| F-7 | **计划未登记 2 件**：`structure/useCanvasHistory.ts`（TD-25-27）· `shell/useContextMenu.ts`（TD-25-28）—— 均**已在 canvas 域内且落点合理** | 不必补 ADR；请裁判在计划 §D 表补 2 行（避免后续批次按"计划里没有"再次搬动）。**同时：TD-25-27/28 的债描述仍写 `src/hooks/...` ⇒ 成因 G，由裁判改债描述，不由我改** |

## 8. 交叉验证请求（要下列域复核我的送出项）

| 送出的件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `canvas/backupStore.ts`（→ `base/store/`） | **TASK-028（base 域主）** | ① 是否认领放 `base/store/`（计划 §422 原文支持）；② `backupStore` 的**唯一调用点**是本域 `topology/useCanvasEventSubscriptions.ts:20`（非渲染）⇒ 请确认这不构成 L4 反证；③ 若 base 不认，请给反证（它为什么属 canvas） |
| `canvas/parts/JianyingIcon.tsx`（→ 并案） | **TASK-028** + **TASK-023（image）** + **TASK-024（video）** | ① 028：是否收 `base/ui/`（L3 要求 ≥3 域才横切，本例仅 2 域 ⇒ 需裁判裁定）；② 023/024：两域是否各自认领（把它留在本方 `parts/`/`ui/`）；③ 计划 §A4-76 的依据「实测 canvas×1 + video×1」在 A2 后已不成立（原 `canvas×1` = 当时还在 `canvas/nodes` 的 `ImageGenerate`）⇒ 请确认计划该行需回改 |
| `parts/{GenerateButton,GeneratingOverlay,ExpandablePanel,ResizeFullscreenHandle}` + `shell/{HoverToolbar,PromptInput,ResourceStrip,FullscreenEditor,promptChips,promptLayout}`（**本域渲染点只剩非活蓝本**） | **TASK-028** | 按 L3（≥3 业务域消费 image/text/video + 零业务语义）是否应判 `base/ui` 真横切；还是按「长在画布节点上」（用户判例，`DOMAIN-MODULES:1431` ⑥）维持 canvas ⇒ **依赖 F-3 落判** |
| `topology/canvasHotkeys.ts`（本域 0 处直接渲染，唯一生产消费者 = `video/nodes/VideoProcessNode.tsx:32`） | **TASK-024（video）** | video 是否认领它（"画布内组件键盘注册入口"到底是画布不变量还是 video 节点私有 hook）；本域主张它是**画布级让位不变量**（`canvasHotkeys.ts:14-38` 头注） |
| `structure/arrangePack.ts`（唯一消费者 = `src/hooks/useArrangeCanvas.ts`） | **TASK-029（小域与 hooks）** | `hooks/useArrangeCanvas` 是否判为画布件；若不是，则 `arrangePack` 的"界面落点"无宿主 ⇒ 触发 F-4 落判 |

## 9. 计数

- 本域扫描件数：**50**（`find src/components/canvas -type f ! -name '.DS_Store'`；另含 `.DS_Store` 非源码，不计）
- 本域·合规：**48**
- 本域·域内错位：**0**
- 非本域：**2**（`backupStore.ts` → `base/store/`；`parts/JianyingIcon.tsx` → 并案）
- 待核：**0**（`backupStore` 的「v 装配层调用是否算反证」已在 #1 与 §8 显式标注，按 §4 第 4 条判非本域；若裁判改判则降级待核）
- 成因分布：A **0** / B **1**（`_smoke_checks.cjs:212` 活代码旧路径）/ C **2**（`backupStore` 就近放 · `JianyingIcon` 按形态就近放且依据过期）/ D **0** / E **0** / F **7**（F-1~F-7）/ G **4**（`video/index.ts:16` · `creative/index.ts:15` · `scripts/test-affected.cjs:11` · TD-25-27/28 债描述）/ H **0**
- 无 `refs` 输出的件（附清单）：**0 件** —— 50 件全部有 ① 段输出（其中 `parts/{GenerateButton,ExpandablePanel,GeneratingOverlay,ToolbarButton}` · `shell/promptLayout` 等仅被域外消费，但 ① 段均非空，无"零引用"件）

---

## 10. 自检（TASK-022 §9 + TASK-025 §6）

- [x] 领地内**每个文件**在主表出现一次（50 行 / 50 件，`find` 与表逐一比对）
- [x] 每条「非本域」凑齐四件证据（#1 · #19：界面位置 + 数据落点 + `refs` ① 段原文 + 反证检查）
- [x] 每条「非本域」做了反证检查并写明「本域 N 处渲染 / N 处 schema」（#1 = 0/0 · #19 = 0/0）
- [x] 每条填了成因代号（合规件填 `—`，成因代号只描述"为什么错位"）
- [x] 无一条依据是「名字叫 xxx」或「目录在 xxx」（唯一"书证"用法是**指出计划自相矛盾**，且均已附实测）
- [x] `nodes/` 现存每一件有独立判定 + L1 证据（§3.3 表 4 行）
- [x] 「`edges/` 不在计划树」「域根散件」「`App.tsx` 直连」「门面外泄」四问各有明确结论（§3.1 / §3.2 / §3.4 / §3.5）
- [x] 跑过 §4 指定的 `grep` 并把旧路径残留列全（§4 三类 1+4+正确保留清单）
- [x] 未改本文件以外的任何文件 —— 见文末 `git status` 摘要
