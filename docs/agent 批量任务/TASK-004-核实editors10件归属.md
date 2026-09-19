# TASK-004 · 核实editors10件归属

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-004-核实editors10件归属.md`。碰任何其他文件（含源码）视为任务失败。

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
- `src/components/editors/ImageEditor.tsx`
- `src/components/editors/InlineImageCropper.tsx`
- `src/components/editors/OverlayEditor.tsx`
- `src/components/editors/FaceMosaicEditor.tsx`
- `src/components/editors/PanoViewer.tsx`
- `src/components/editors/CameraStudioPanel.tsx`
- `src/components/editors/cameraStudio.ts`
- `src/components/editors/cameraParams/CameraSettingsSelector.tsx`
- `src/components/editors/cameraParams/cameraPrompt.ts`
- `src/components/editors/cameraParams/types.ts`

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `src/components/editors/ImageEditor.tsx` |  |  |  |  |  |  |
| 2 | `src/components/editors/InlineImageCropper.tsx` |  |  |  |  |  |  |
| 3 | `src/components/editors/OverlayEditor.tsx` |  |  |  |  |  |  |
| 4 | `src/components/editors/FaceMosaicEditor.tsx` |  |  |  |  |  |  |
| 5 | `src/components/editors/PanoViewer.tsx` |  |  |  |  |  |  |
| 6 | `src/components/editors/CameraStudioPanel.tsx` |  |  |  |  |  |  |
| 7 | `src/components/editors/cameraStudio.ts` |  |  |  |  |  |  |
| 8 | `src/components/editors/cameraParams/CameraSettingsSelector.tsx` |  |  |  |  |  |  |
| 9 | `src/components/editors/cameraParams/cameraPrompt.ts` |  |  |  |  |  |  |
| 10 | `src/components/editors/cameraParams/types.ts` |  |  |  |  |  |  |

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

- 我已实测：这些件的消费者**全在 `canvas/nodes/`**（图片类节点：ImageGenerate / GridMerge / FaceMosaic / AssetNode）。用户判定：**相机是图片生成节点下面的一个按钮**，不是独立能力。
- 我的结论：**全部并入「图片能力域」**（将来的 `components/image/editors/`），并删掉 `components/editors/` 这个目录。
- **请逐件独立验证**：
  1. 它挂在哪个节点上？（注意：因为已经收口到门面，`refs` 可能只显示 `index.ts`；请**打开 `src/components/editors/index.ts` 看它 re-export 了谁**，再顺着找真正的消费方，或直接 grep 组件名）
  2. 它的结果**落到哪**？（图片编辑结果通常走 `filesApi.showThenPersistInline` 写回节点）
  3. **有没有任何一件其实不属于图片能力**（例如被视频/文本节点也用了）？
- 若你发现某件其实该归别处，**明确说出来并给证据** —— 这正是我要的。

---

# 审计结论（独立逐件验证 · 只读）

> 验证手法：`node scripts/mv-sync-refs.mjs refs <文件>` 取「① 模块引用（非测试）」；读 `editors/index.ts` 门面 re-export 顺藤找真实消费方；grep 组件名确认 `canvas/nodes/*` 的挂载点；对照 `DOMAIN-MODULES.md §3.1.3.2` 节点能力归属表（`cat` 真源）。`cat` 真源：ImageGenerate/GridMerge/FaceMosaic/Panorama/AssetNode 均 = **image**；video 能力节点为 VideoGenerate/VideoExtract/VideoProcess。

## 逐件结果表

| # | 件（当前路径） | 非测试消费方（refs 实测） | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|--------|------------|
| 1 | `src/components/editors/ImageEditor.tsx` | `canvas/nodes/ImageGenerate.tsx` 经 `nodes/useImageHoverActions.tsx:3`（`import { ImageEditor } from '@/components/editors'`）挂载 render`<ImageEditor`；refs① = ImageGenerate.tsx + index.ts | 受控 UI（`assetUrl` 入 / `onSave({dataUrl,width,height})` 出）；结果由 `useImageHoverActions` 经 `filesApi.showThenPersistInline` 写回图像节点 `node.data`（useImageHoverActions.tsx:88/99/113/135） | 图片生成节点（全屏编辑台：涂鸦/裁剪/扩图） | `components/image/editors/ImageEditor.tsx` | 高 | 唯一生产消费方 = ImageGenerate（cat:image）；结果写回该图像节点 |
| 2 | `src/components/editors/InlineImageCropper.tsx` | `canvas/nodes/useImageHoverActions.tsx:198` `<InlineImageCropper`（ImageGenerate 节点装配的 hover 裁剪浮层）；refs① 仅 index.ts（经门面） | 受控 UI（`assetUrl`/`onSave`/`onClose`）；结果同上经 `showThenPersistInline` 写回图像节点 | 图片生成节点（就地裁剪浮层） | `components/image/editors/InlineImageCropper.tsx` | 高 | 仅被图片生成节点 hover 动作挂载；数据流同 ImageEditor |
| 3 | `src/components/editors/OverlayEditor.tsx` | `canvas/nodes/GridMergeNode.tsx:13,932`（import + `<OverlayEditor`）；refs① = GridMergeNode.tsx + index.ts | 受控 UI（`state`/`onChange`/`upstreamUrls`）；图层状态由 GridMergeNode 持有，PNG 导出经上游回写节点 | 图片拼图节点（图层叠加编辑器，含 `renderOverlayCanvas` 纯函数） | `components/image/editors/OverlayEditor.tsx` | 高 | 唯一消费方 = GridMergeNode（cat:image） |
| 4 | `src/components/editors/FaceMosaicEditor.tsx` | `canvas/nodes/FaceMosaicNode.tsx:23,415`；refs① = FaceMosaicNode.tsx + index.ts | 受控 UI（`assetUrl`/`onSave`/`onClose`）；结果经 filesApi 写回打码节点 | 人脸打码节点 | `components/image/editors/FaceMosaicEditor.tsx` | 高 | 唯一消费方 = FaceMosaicNode（cat:image） |
| 5 | `src/components/editors/PanoViewer.tsx` | `canvas/nodes/PanoramaNode.tsx:26,27,711`；refs① = PanoramaNode.tsx + index.ts | 受控 UI（`PanoViewerHandle.capture` 出球图）；视角/纹理由 PanoramaNode 持有，出图回写节点 | 全景图节点 | `components/image/editors/PanoViewer.tsx`（`+PanoViewerHandle` 类型同走） | 高 | 唯一消费方 = PanoramaNode（cat:image） |
| 6 | `src/components/editors/CameraStudioPanel.tsx` | `canvas/nodes/ImageGenerate.tsx:51,895` **+** `canvas/nodes/AssetNode.tsx:38,550`（均 `import { CameraStudioPanel } from '@/components/editors'`）；refs① 仅 index.ts（经门面） | 受控 UI（`isOpen`/`assetUrl`/`onGenerate`）；`onGenerate(result: CameraStudioResult)` 把机位/打光/提示词拼进 ImageGenerate 的生成提示词（ImageGenerate.tsx:448-499），是生图参数、非独立落盘 | 图片生成节点 + 图片视频素材节点（二者均 cat:image） | `components/image/editors/CameraStudioPanel.tsx` | 高 | 2 个消费方同属图片能力（cat:image）；与「相机是图片生成节点下的按钮」相符 |
| 7 | `src/components/editors/cameraStudio.ts` | `editors/CameraStudioPanel.tsx:24`（`import … from './cameraStudio.ts'`）；refs① = CameraStudioPanel.tsx + index.ts | 纯逻辑层（`CameraStudioResult`/状态/预设/提示词转换），无 UI、无存储；仅被 CameraStudioPanel 装配 | 无独立界面，是 CameraStudioPanel（图片生成/素材节点上的 3D 摄影棚）的状态层 | `components/image/editors/cameraStudio.ts` | 高 | 域内部件，随 CameraStudioPanel 同归图片能力 |
| 8 | `src/components/editors/cameraParams/CameraSettingsSelector.tsx` | `canvas/nodes/ImageGenerate.tsx:52,806` `<CameraSettingsSelector`；refs① = CameraSettingsSelector + index（+ 域内 cameraPrompt/types） | 受控 UI（收集 `CameraGenerationSettings`）；选中值经 `applyCameraSettingsToPrompt` 转提示词片段，拼进 ImageGenerate 生图提示词 | 图片生成节点（右下角摄影参数面板） | `components/image/editors/cameraParams/CameraSettingsSelector.tsx` | 高 | 唯一生产消费方 = ImageGenerate（cat:image） |
| 9 | `src/components/editors/cameraParams/cameraPrompt.ts` | 经 `cameraParams/CameraSettingsSelector.tsx` 调用 `applyCameraSettingsToPrompt`（refs① = CameraSettingsSelector + index + 自身）；无域外直接消费 | 纯函数（`CameraGenerationSettings` → 英文提示词片段），汇入 ImageGenerate 生图提示词，无独立存储 | 无独立界面，挂在 CameraSettingsSelector（图片生成节点） | `components/image/editors/cameraParams/cameraPrompt.ts` | 高 | 仅服务图片生成节点的摄影参数面板 |
| 10 | `src/components/editors/cameraParams/types.ts` | `CameraSettingsSelector.tsx` + `cameraPrompt.ts` + `CameraStudioPanel.tsx` 引用其类型（refs① = CameraSettingsSelector + cameraPrompt + index） | 纯类型（`CameraLens`/`CameraGenerationSettings`/`CameraAperture`…），无运行时存储 | 类型契约，服务图片生成节点摄影参数面板 | `components/image/editors/cameraParams/types.ts` | 高 | 仅被图片生成节点相机链路引用 |

## 三段汇总

### 1. 该搬的（按目标目录分组）

**目标域根：`components/image/editors/`**（图片能力域，并入而非独立域）

- `components/image/editors/ImageEditor.tsx`（原 `editors/ImageEditor.tsx`）
- `components/image/editors/InlineImageCropper.tsx`
- `components/image/editors/OverlayEditor.tsx`（含 `renderOverlayCanvas` 纯函数一并跟走）
- `components/image/editors/FaceMosaicEditor.tsx`
- `components/image/editors/PanoViewer.tsx`（含 `PanoViewerHandle`）
- `components/image/editors/CameraStudioPanel.tsx`
- `components/image/editors/cameraStudio.ts`
- `components/image/editors/cameraParams/CameraSettingsSelector.tsx`
- `components/image/editors/cameraParams/cameraPrompt.ts`
- `components/image/editors/cameraParams/types.ts`

**并删除 `components/editors/` 这一独立目录**（与 `DOMAIN-MODULES.md` §7 修订记录「§2.3 P2『base/editors=独立域图像编辑域』已被用户推翻，components/editors/ 落点错误，需改落 components/image/」一致；S2-8 已把 editors 迁到 components/editors/，但落点判错）。

### 2. 不该搬的

**无。** 清单 10 件全部归图片能力域，没有可保留在 `editors/` 下的横切件（`ImageZoomDialog` 已在 D18 裁定迁出至 `base/ui/`，不在此清单内）。

**特别标出「被 App.tsx 消费 ⇒ 横切」的情形：不存在。** `App.tsx` 未出现在任何一件的 `refs`「① 模块引用」里（App 只消费 `canvas/index.ts` 门面与 videoEditor 等装配点）。本批 10 件均只经 `editors/index.ts` 门面被 `canvas/nodes/*` 消费，属图片能力内部 UI 件，不是横切。

### 3. 新发现的问题

- **（a）注释超前于代码（低危）**：`cameraParams/types.ts:5` 头注释写「生图/**生视频**节点右下角的轻量参数面板」，但实测 `CameraGenerationSettings` / `CameraSettingsSelector` / `applyCameraSettingsToPrompt` **全仓只有 `ImageGenerate.tsx` 一个消费方**；`VideoGenerate` 节点零引用（grep `CameraGenerationSettings|CameraSettingsSelector|…` 命中仅 editors 内部 + ImageGenerate）。即相机参数当前**只服务图片生成**，所谓「生视频」是注释预留、未落地。建议回改注释或将来视频复用需另立裁定。**不影响本批归属结论**（仍属图片能力）。
- **（b）跨域消费判定（回答验收标准）**：本清单 **没有任何一件被 ≥2 个不同能力域消费**。
  - `CameraStudioPanel` 有 2 个消费方（`ImageGenerate` + `AssetNode`），但二者 `cat` 均为 **image**（图片能力），不构成跨域；符合「相机是图片生成节点下的按钮、素材节点也挂同一个图片能力工具」的用户判例。
  - 其余 8 件均为**单消费方**（各自仅 1 个图片类节点）。
  - ⇒ 与任务书「特别提示」的假设**一致**：全部归图片能力域，无一需判归别处。
- **（c）落地前置（不阻塞结论）**：`components/image/` 目标域根当前是否已建，本审计**未查目录树（只读范围仅限取证）**。若尚不存在，落地时需新建域根 + `index.ts` 门面（参考 creative / depthVideo 迁出手法：搬移 → 后置工序 → 门面 → 收口）。归属结论本身不受此影响。
- **（d）与既有裁定互为佐证**：本逐件实证可回填 `DOMAIN-MODULES.md` §7 修订记录那行「§2.3 P2 被推翻、editors 落点应改落 components/image/」——10 件各自只有 1 个（或同属 image 的 2 个）图片类节点消费方，正是「全是图片类节点上的工具 ⇒ 归图片能力、非独立域」的机械事实证据。
- **（e）同形态扩展件**：任务书提示「若发现同形态配套件一并纳入」。本批经 `editors/index.ts` 门面穷举，10 件即门面全部 13 个符号对应的源文件（另 3 个符号 = `PanoViewerHandle`/`OverlayState`/`CameraStudioResult` 类型，已随各自主件计入 #5/#3/#7），**无遗漏的相关件**。

---

## 自测（验收标准对照）

- [x] 清单 10 件 7 列全填，无空格。
- [x] 每条「建议归属」附 refs 实测消费方 + 数据落点（ImageEditor/InlineImageCropper/OverlayEditor/FaceMosaic/PanoViewer 的消费方与写回链路均带 `file:line`）。
- [x] 置信度无「中/低」，故无需补「缺什么信息」（10 件均高；仅 (c) 落地前置为实施细节、非归属不确定）。
- [x] 明确回答跨域问题：无件被 ≥2 个不同能力域消费（CameraStudioPanel 的 2 消费方同属 image，已说明）。
- [x] 末尾三段汇总齐全（该搬 / 不该搬 / 新发现问题）。
- [x] 仅改动本文件，未碰任何其他文件（含源码）。
