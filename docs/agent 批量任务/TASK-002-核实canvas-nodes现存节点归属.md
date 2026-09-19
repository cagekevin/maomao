# TASK-002 · 核实canvas-nodes现存节点归属

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-002-核实canvas-nodes现存节点归属.md`。碰任何其他文件（含源码）视为任务失败。

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
- `src/components/canvas/nodes/AssetNode.tsx`（palette 名"图片视频素材节点"，cat=image）
- `src/components/canvas/nodes/ImageGenerate.tsx`（cat=image）
- `src/components/canvas/nodes/ImageBoxNode.tsx`（cat=image）
- `src/components/canvas/nodes/GridSplitNode.tsx`（cat=image）
- `src/components/canvas/nodes/GridMergeNode.tsx`（cat=image）
- `src/components/canvas/nodes/PanoramaNode.tsx`（cat=image）
- `src/components/canvas/nodes/FaceMosaicNode.tsx`（cat=image）
- `src/components/canvas/nodes/LoopNode.tsx`（cat=image）
- `src/components/canvas/nodes/Director3DNode.tsx`（cat=image，但 director3d 是**已登记例外，禁重审**）
- `src/components/canvas/nodes/TextGenerate.tsx`（cat=text）
- `src/components/canvas/nodes/GroupNode.tsx`（cat=other）
- `src/components/canvas/nodes/GhostTargetNode.tsx`（非 palette）
- `src/components/canvas/nodes/ScriptBoxNode.tsx`（cat=other）
- `src/components/canvas/nodes/_template/TemplateNode.tsx`（非活节点？）
- `src/components/canvas/nodes/useImageHoverActions.tsx`（辅助 hook）

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `src/components/canvas/nodes/AssetNode.tsx` |  |  |  |  |  |  |
| 2 | `src/components/canvas/nodes/ImageGenerate.tsx` |  |  |  |  |  |  |
| 3 | `src/components/canvas/nodes/ImageBoxNode.tsx` |  |  |  |  |  |  |
| 4 | `src/components/canvas/nodes/GridSplitNode.tsx` |  |  |  |  |  |  |
| 5 | `src/components/canvas/nodes/GridMergeNode.tsx` |  |  |  |  |  |  |
| 6 | `src/components/canvas/nodes/PanoramaNode.tsx` |  |  |  |  |  |  |
| 7 | `src/components/canvas/nodes/FaceMosaicNode.tsx` |  |  |  |  |  |  |
| 8 | `src/components/canvas/nodes/LoopNode.tsx` |  |  |  |  |  |  |
| 9 | `src/components/canvas/nodes/Director3DNode.tsx` |  |  |  |  |  |  |
| 10 | `src/components/canvas/nodes/TextGenerate.tsx` |  |  |  |  |  |  |
| 11 | `src/components/canvas/nodes/GroupNode.tsx` |  |  |  |  |  |  |
| 12 | `src/components/canvas/nodes/GhostTargetNode.tsx` |  |  |  |  |  |  |
| 13 | `src/components/canvas/nodes/ScriptBoxNode.tsx` |  |  |  |  |  |  |
| 14 | `src/components/canvas/nodes/_template/TemplateNode.tsx` |  |  |  |  |  |  |
| 15 | `src/components/canvas/nodes/useImageHoverActions.tsx` |  |  |  |  |  |  |

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

我的候选映射（请逐条核实）：
- image 类 8 个 → 将来的 `components/image/nodes/`；`TextGenerate` → `components/text/nodes/`
- `GroupNode` / `GhostTargetNode` / `_template` → **留 `canvas/nodes/`**（画布机制）
- `ScriptBoxNode` → `components/scriptbox/`（独立应用入口）
- `useImageHoverActions.tsx` → `components/image/`（图片 hover 能力）
- `Director3DNode` → 留（例外）

**请特别独立回答这三个问题**：
1. `AssetNode`（"图片视频素材节点"，cat=image）到底归**图片能力**还是**素材能力**？看它的数据流：它读写 `assetUrl`/`assetType`/`poster` 等字段，被谁消费、数据从哪来。
2. `useImageHoverActions.tsx` 是只被图片类节点用，还是被别的节点也用？（这决定它归 image 还是留画布机制）
3. `_template/TemplateNode.tsx` 是**活节点**吗？（docs 里 TD-04-5 说它是"参考蓝本，非活节点，不占 registry"，请验证是否属实；若非活，它该留哪、甚至该不该删）

---

# 审计报告（TASK-002 · 只读，未改任何源码）

> 方法：① 对每个件跑 `node scripts/mv-sync-refs.mjs refs <件>` 取「① 模块引用」段（非测试 import 消费方）；② 读头注释 + grep 数据流（`data.`/`patchNodeDataById`/`node.data`/`spawn`/`sendToResourceLibrary`）；③ `cat` 真源查 `NodePalette.ts` `paletteNodes`（产品写死）；④ 跨域消费查 `agent/`、`video/`、`App.tsx` 字符串引用。
> 假设声明：本报告以"用户候选映射"的目标域 `components/image`、`components/text`、`components/scriptbox` 为落点（项目背景称"部分尚未建"，我据此判定"应建"）；`components/canvas` 为画布机制域根（DOMAIN-MODULES §3.1.3.2 裁定）。

## 一、逐件核实表（7 列）

| # | 件（当前路径） | 非测试消费方（模块引用，实测） | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|--------|------------|
| 1 | `src/components/canvas/nodes/AssetNode.tsx` | `NodePalette.ts`(import)；跨域串引 `agent/panels/AgentPanel.tsx`(selectedAssetNodes prop) | `node.data`(`assetUrl`/`assetType`/`poster`/`text`)，写回经 `patchNodeDataById`/`replaceNodeImage`；真源 `useNodeData`(编排层) | 画布节点（palette"图片视频素材节点"，cat=**image**） | `components/image/nodes/` | 高 | 界面为画布图片节点、cat=image；"素材"二字是内容类型非素材库域；它向素材库推(`sendToResourceLibrary`)而非属素材库 |
| 2 | `src/components/canvas/nodes/ImageGenerate.tsx` | `NodePalette.ts` | `node.data`(`prompt`/`images`/`aspectRatio`/`imageSize`)；生成结果 spawn assetNode | 画布节点 cat=**image**（顶部 W 快捷） | `components/image/nodes/` | 高 | cat=image + 头注释"生图节点"；是 image 域主件 |
| 3 | `src/components/canvas/nodes/ImageBoxNode.tsx` | `NodePalette.ts`；被 `GridSplit/GridMerge/FaceMosaic` 经 `useConnectedInputs` 上游取图 | `node.data.images[]`(持久 /files/ URL)；多图容器 | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；头注释"图片盒子节点"，是图片类共同上游 |
| 4 | `src/components/canvas/nodes/GridSplitNode.tsx` | `NodePalette.ts` | `node.data.extractedImages`/`cells`；切出 spawn assetNode | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；头注释"图片切分节点"，下游派生 assetNode |
| 5 | `src/components/canvas/nodes/GridMergeNode.tsx` | `NodePalette.ts` | `node.data`(rows/cols/overlay)；合成 spawn assetNode | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；头注释"图片拼图节点"，图层编辑后导出 assetNode |
| 6 | `src/components/canvas/nodes/PanoramaNode.tsx` | `lazyNode.tsx`(动态 import，避免首屏 +1MB 3D chunk) | `node.data`(aspectRatio/customDim)；截图 spawn assetNode | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；"720全景图节点"，截图落 assetNode |
| 7 | `src/components/canvas/nodes/FaceMosaicNode.tsx` | `NodePalette.ts` | 预览态仅 useState（幽灵字段已于 2026-09-11 删）；结果 spawn assetNode | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；"人脸打码节点"，产物经子节点 assetNode 交付 |
| 8 | `src/components/canvas/nodes/LoopNode.tsx` | `NodePalette.ts` | `node.data`(`splitMethod`)；运行 spawn 多个 imageGenerate 子节点 | 画布节点 cat=**image** | `components/image/nodes/` | 高 | cat=image；"循环生成"，本质是把文案切成 N 个生图节点 |
| 9 | `src/components/canvas/nodes/Director3DNode.tsx` | `lazyNode.tsx`(动态 import) | `node.data`(`assetUrl`/`images`/`directorProject`) | 画布节点 cat=image(登记) | **留 `components/canvas/nodes/`（例外，禁重审）** | 不适用 | 已登记例外（DOMAIN-MODULES §6 / V2 日志 §七），本任务不重审 |
| 10 | `src/components/canvas/nodes/TextGenerate.tsx` | `NodePalette.ts`；跨域串引 `agent/canvas/useCanvasAgentTools.ts` | `node.data`(`prompt`/`text`/`images`)；文本落"生成区"data.text | 画布节点 cat=**text**（顶部 Q 快捷） | `components/text/nodes/` | 高 | cat=text + 头注释"文本节点"；文案型内容能力 |
| 11 | `src/components/canvas/nodes/GroupNode.tsx` | `NodePalette.ts`(cat=other) | `node.data.label/name`；父子用 React Flow `parentId` 承载 | 画布编组容器（被任意节点挂为父） | **留 `components/canvas/nodes/`（画布机制）** | 高 | cat=other；是画布父子容器机制，非内容能力；判据④被 Palette 单源消费仍属画布域 |
| 12 | `src/components/canvas/nodes/GhostTargetNode.tsx` | **`App.tsx`**(import 并注册 `ghostTarget`) | 无 data（仅透明 target Handle 占位） | 连线拖出空白时的不可见占位节点 | **留 `components/canvas/nodes/`（画布机制）** | 高 | 仅被 App.tsx 直接消费（判据④⇒横切机制）；未进 palette（非真实节点） |
| 13 | `src/components/canvas/nodes/ScriptBoxNode.tsx` | `NodePalette.ts`(cat=other)；自身域 `components/scriptbox/*` 全套 | `node.data`(steps/shots/assets，真源 `scriptBoxSchema`)；引擎 `useScriptBoxEngine` 写回 | 画布节点 cat=other；独立三步状态机应用 | `components/scriptbox/nodes/` | 高 | cat=other + 头注释"独立应用入口"；已存在 `components/scriptbox/` 域，整件迁入 |
| 14 | `src/components/canvas/nodes/_template/TemplateNode.tsx` | **无任何非测试模块引用**（未进 NodePalette/App/lazyNode）；仅 `tests/unit/TemplateNode*.test.tsx` | 自身非活，不落盘 | 不存在于画布（非 palette 项） | **留 `components/canvas/nodes/_template/`（非活，参考蓝本）** | 高(非活) / 中(落点) | 验证属实：TD-04-5 `contracts.ts:820`"登记项已删，是新建节点参考蓝本，非活节点不占 registry" |
| 15 | `src/components/canvas/nodes/useImageHoverActions.tsx` | **`AssetNode.tsx` + `ImageGenerate.tsx`**（仅此两图片节点 import） | 产出 dataURL 经调用方 `onImageReplaced` 写回各自 `data.assetUrl` | 图片节点 hover 栏行为（裁剪/编辑/压缩/放大/发送素材库） | `components/image/`（图片 hover 能力） | 高 | 模块引用实证仅被 2 个 image 节点用，非画布通用机制 |

## 二、三段汇总

### 1. 该搬的（件 → 目标目录，按目标目录分组）

- **`components/image/nodes/`**（8 件，cat=image 的内容能力节点，目录应建）
  - `AssetNode.tsx` · `ImageGenerate.tsx` · `ImageBoxNode.tsx` · `GridSplitNode.tsx` · `GridMergeNode.tsx` · `PanoramaNode.tsx` · `FaceMosaicNode.tsx` · `LoopNode.tsx`
- **`components/image/`**（图片域能力辅助 hook）
  - `useImageHoverActions.tsx`（仅被上述 2 个 image 节点用）
- **`components/text/nodes/`**（1 件，目录应建）
  - `TextGenerate.tsx`
- **`components/scriptbox/nodes/`**（1 件，域已存在）
  - `ScriptBoxNode.tsx`（连同其 `StepShots/StepAssets/StepPrompt/StepNav/ScriptBoxFullscreen/GearSettings` 等 `components/scriptbox/*` 已在该域，整组一致）

### 2. 不该搬的（件 + 为什么）

- **`GroupNode.tsx`** → 留 `canvas/nodes/`：cat=other，是画布父子容器机制（React Flow `parentId`），任意域名节点都可被它挂载，属画布通用机制，非内容能力。
- **`GhostTargetNode.tsx`** → 留 `canvas/nodes/`：判据④——唯一非测试消费方是 `App.tsx`（直接 import 并注册 `ghostTarget`）；连线占位不可见节点，未进 palette。=> **被 App.tsx 消费 ⇒ 横切机制，不搬。**
- **`Director3DNode.tsx`** → 留 `canvas/nodes/`：**已登记例外（禁重审）**，本任务不裁决其归属（DOMAIN-MODULES §6 + V2 日志 §七）。
- **`TemplateNode.tsx`**（在 `_template/`）→ 留 `canvas/nodes/_template/`：非活节点（无 registry 项），是开发参考蓝本，不占运行期任何位置；搬去 image/text 域反而不当（它示范所有节点类型）。

### 3. 新发现的问题 / 需你拍板处

- **A. 跨域消费的 2 件（≥2 域消费）已判归属：**
  - `AssetNode` 被 **canvas（NodePalette）+ agent（`agent/panels/AgentPanel.tsx` 的 `selectedAssetNodes` prop）** 双域消费。判：归 **image 域**；agent 经 App 传下来的 `selectedAssetNodes` 字符串 prop 访问，属"跨域消费走门面"（`refs` 规则），**不改归属**。
  - `TextGenerate` 被 **canvas（NodePalette）+ agent（`agent/canvas/useCanvasAgentTools.ts`）** 消费。判：归 **text 域**；同上，agent 以 `node.type` 字符串 + `data.text` 读写，走门面不改归属。
  - （`ScriptBoxNode` 也同时被 canvas 与 scriptbox 域引用，但 scriptbox 本就是它的归属域，不构成冲突。）
- **B. `AssetNode` 的"视频能力"陷阱（提示你可能的误判点）：** 它 palette 名"图片视频素材节点"且头注释支持 image/video/audio/text 五态，还 import `@/components/video` 的 `DepthVideoModal`(深度视频)。**但这不改判**：cat=image 是权威真源；视频预览/深度视频走 `@/components/video` 门面（跨域消费），不能据此归 video 域。若你认为"视频类素材展示"应独立，请拍板，否则维持 image 域。
- **C. `useImageHoverActions.tsx` 归 image 而非 canvas 的判定与 `nodeImage.ts` 现状矛盾：** `nodeImage.ts` 当前住在 `components/canvas/`（DOMAIN-MODULES 待迁出清单里点名 `nodeImage.ts`），而 `useImageHoverActions` 头注释(L23)自称"坐落于 `src/components/base/`"——**实际路径已非 base**。本次只核 nodes，但提示：`useImageHoverActions`(图片专属) 与 `nodeImage.ts`(图片写回唯一入口，被多 image 节点用) 二者皆图片域专属，建议**一并**迁入 `components/image/`，否则会出现 image 节点散落 canvas/ 与 image/ 两处。
- **D. `_template` 落点准确度（中置信）：** 实测确认非活、不占 registry；我保留在 `canvas/nodes/_template/` 因其示范全部节点类型、属画布作者脚手架。但更干净的做法是迁到 `docs/` 或 `scripts/scaffold/`（非运行代码）。若你倾向"删死代码/移文档"，请拍板——本报告不擅自建议删除（怕误伤开发范式）。
- **E. 与 DOMAIN-MODULES 措辞的一致性：** 该文档 §3.1.3.2 把 `nodes/` 描述为"画布域子域混四种东西"，本报告的"把 8 个 image 节点 + 1 个 text 节点搬出 canvas/nodes"恰是消解该混居，与该文档自身结论一致；无实质冲突。但注意"canvas 作为域根含 nodes/"的旧表述需在该文档后续批次里同步更新。
- **F. 遗漏件扫描：** 追查中 `mv-sync-refs` 还暴露 `canvas/nodes/` 之外同形态配套件未在本清单但应一并归位：`deriveNodes.ts`(spawn 机制，判据③同形态展开态，但属画布派生机制留 canvas)、`nodePrefs.ts`/`nodeDefaults.ts`/`nodeDataSchema.ts` 是节点结构/数据契约真源（横切，留 canvas 或 base）。这些不在本任务清单，仅提示"同形态"边界，未纳入搬移动作。

## 三、对三个独立问题的回答

1. **AssetNode 归图片能力还是素材能力？** → **图片能力域（`components/image/nodes/`）**。证据：cat=image（`NodePalette.ts:126`）；它是画布上的图片/视频/音频展示+编辑节点，data(`assetUrl`/`assetType`/`poster`) 落 `node.data`；它与"素材库域"的关系是**主动推送**（`import { sendToResourceLibrary }`，`AssetNode.tsx:36`）与打开素材库，并非属于素材库。名字里的"素材"是内容类型描述（asset），非左栏 `resource` 页签域。
2. **`useImageHoverActions.tsx` 只被图片类用吗？** → **是，仅 `AssetNode` 与 `ImageGenerate`**（两 image 节点，`mv-sync-refs` ① 模块引用实证，无其他 import）。故归 `components/image/`，不留画布机制。
3. **`TemplateNode.tsx` 是活节点吗？** → **不是活节点**。证据：无任何非测试模块引用（`mv-sync-refs` ① 仅测试文件）；`contracts.ts:820` 原文"原 templateNode 登记项已于 2026-09-11 删除（TD-04-5）——TemplateNode 是「新建节点参考蓝本」"。建议留 `canvas/nodes/_template/` 作开发脚手架（见汇总 D，落点中置信，是否移 docs/ 待你拍板）。
