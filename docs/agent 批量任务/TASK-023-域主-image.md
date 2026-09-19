# TASK-023 · 域主：`image`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-023-域主-image.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

## 1. 领地（逐件，不许抽样）

```
src/components/image/**        # 约 27 件，递归全部
```

含：`nodes/` · `editors/`（含 `cameraParams/` · `cameraStudio*`）· `lib/` · `index.ts` · 域根散件。
**不含**（不是你扫，别越界）：`src/components/base/**`（那是 TASK-029 的地）、`src/hooks/**`（TASK-030）。

## 2. 本域计划内结构（判「域内错位」的比对基准）

来自 `docs/plan/域归位-最终执行计划.md` §3（**目标**，不是现状）：

```
image/
├── nodes/    ImageGenerate · ImageBoxNode · GridSplitNode · GridMergeNode
│             PanoramaNode · FaceMosaicNode · LoopNode · AssetNode
├── editors/  ImageEditor · InlineImageCropper · OverlayEditor · FaceMosaicEditor
│             PanoViewer · CameraStudioPanel · cameraStudio · cameraParams/
├── lib/      imageUpscale · faceMosaic · nodeImage      ← 纯能力，禁 JSX
└── useImageHoverActions.tsx                             ← 计划指定「留域根」（D1 例外）
```

**留域根的例外（除 D1 三类外，只此一件）**：`useImageHoverActions.tsx`。

## 3. 本域特有事项（必须逐条给结论）

1. **双门面**：计划裁定 `image/editors/index.ts` **应删**（并入 `image/index.ts`，不留两份门面）。请核实现状 + 判是否仍成立。
2. **`lib/` 是否混入视图件**（D3）：`lib/` 里若出现 JSX 组件 / 依赖 React 的 hook ⇒ 假子域，逐件给去处。
3. **域内分层方向**（D4）：对 `nodes/`、`editors/`、`lib/` 各抽 3 件跑 `refs`，看是否有 `lib/ → nodes/` 或 `lib/ → editors/` 的反向依赖。
4. **`editors/` 与 `nodes/` 的边界**：`FaceMosaicEditor`（编辑器）与 `FaceMosaicNode`（节点）分属两个子目录是对的；但若发现**同一能力**的 UI 被拆到两处（编辑器在一处、节点里又内联一份）⇒ 登记「假子域 / 重复实现」，成因为 C 或 H。
5. **`cameraParams/` / `cameraStudio` 是否是独立子域**（≥3 件？职责？）：按 D2/D3 给结论；不足 3 件要说明并进哪里。
6. **域根散件清单**（D1）：除 `useImageHoverActions.tsx` 与 `index.ts` 外，域根出现任何件都要给出应入子目录。

## 4. 线索（只是线索 · 不是结论 · 可能已过期）

> **不要照抄**。每条用 `refs`/`ls`/`grep` 现场复核；对不上就按实测记录，并标进「描述过期」。

- `TD-25-11`：`faceMosaic.ts` 应在本域（`image/lib/`）；与 `image/editors/FaceMosaicEditor.tsx` **分家**是"打码逻辑与打码界面不同域"的原始说法 —— 请核实**现在到底在哪**。
- `TD-18-37`：同一件事的另一笔债（`base/utils/faceMosaic.ts` ↔ `image/editors/FaceMosaicEditor.tsx` 分家）。
- `TD-18-35`：图片媒体处理约 **9 件 / 约 1400 行**散在 `base/utils` —— 这是一片**能力成片**，属 `base`（TASK-029）报送范围；你若发现 image 侧缺了对应子目录（计划是 `image/lib/`），在「判据缺口」里说明，但**不要**去扫 `base/**`。
- **已知不属于你、你会被点名收件的**：`imageCompress` **计划裁定留 `base/utils/`**（`base/utils/assetUrl.ts:32` 实 import，§0.5 已裁）—— 若 TASK-029 把它送到你域，你的复核结论应是 **`不认`**（附 `assetUrl.ts:32` 反证）。
- `TASK-025/026` 的地（`video/` · `agent/`）里若出现 render/render 图片相关件，**不是你的活**，别越界。

## 5. 输出

按 **TASK-022 §7** 的格式（主表 + 8 个末尾小节）。**域籍判定列只许四种**。

## 6. 验收补充（除 TASK-022 §9 外）

- [ ] `find src/components/image -type f | sort` 的**每一件**都在主表出现。
- [ ] 「双门面」「`lib/` 是否混视图件」「`cameraParams/` 是否独立子域」「域根散件」四问**各有明确结论**（不许写"待定"而不给依据）。
- [ ] 对 `lib/` 每件都跑了 `refs`（`lib/` 是"纯能力"声明，必须逐件验它没反向依赖视图层）。

---
---

# 产出 · 域主 `image`（第一波 · 只登记不搬）

**取证时间**：2026-09-19 · **工具**：`node scripts/mv-sync-refs.mjs refs <件>`（① 段）+ `grep -rn "from '"`（出向 import，用于 D4）+ `ls`/`wc -l`
**领地实测**：`find src/components/image -type f | sort` = **27 件**（主表 27 行，不多不少；含 `cameraParams/cameraParams.css`）
**本轮动作**：零搬迁、零源码改动。仅写本文件。

## 一、本域特有事项 · 四问结论（先行，供裁判速览）

1. **双门面 —— 现状两份 index，但「重复导出」不成立；计划 §A5「应删」已过期（G）。**
   实测 `image/index.ts`（27 行）只导出 **7 个节点**（`ImageGenerate·ImageBoxNode·GridSplitNode·GridMergeNode·FaceMosaicNode·LoopNode·AssetNode`），
   **一个 editors 符号都不导出**（该文件 :16-17 明写"本门面不重复导出，避免宽门面"）；
   `image/editors/index.ts` 的 6 个消费方**全在域内**（`nodes/*.tsx` ×5 + `useImageHoverActions.tsx`），**域外 0 处**（`grep -rn "image/editors" src --include=*.ts*` 域外命中 0）。
   ⇒ 二者是「域门面 + **子域门面**」的层级关系（`editors/index.ts:8` 自述），不是两份域门面。
   **结论：`editors/index.ts` 建议保留**；若照计划删，须把 6 处域内 import 改深路径，或把 editors 符号收进 `image/index.ts`（= 宽门面，违反 ADR-0039「宽门面 = 假收口」）。→ 见 §判据缺口 F-3。
2. **`lib/` 未混视图件（假子域不成立），且 D4 零反向依赖。**
   3 件：`faceMosaic.ts`(412) · `imageUpscale.ts`(164) · `nodeImage.ts`(53)；`grep -rn "react\|React\|<"` 命中 **0 处 import / 0 处 JSX**（仅注释与比较符）。
   出向 import 实测：`base/core/utils` · `base/core/config` · `base/utils/net/asyncGuard` · `base/utils/media/assetUrl` · `@mediapipe/tasks-vision` · `@xyflow/react`（仅 `import type { Node }`）· `src/hooks/useNodeData` —— **0 处指向本域 `nodes/` 或 `editors/`**。
3. **`cameraParams/` 是独立子域（4 件 ≥ 3，D2 过）；但 `cameraStudio.ts` 被留在 `editors/` 根，同一能力拆两处（登记错位）。**
   `CameraSettingsSelector.tsx`(713) · `cameraParams.css`(27) · `cameraPrompt.ts`(80) · `types.ts`(38)；职责 = 摄影参数「选择器 UI + 参数→提示词映射 + 契约 + 样式」；唯一业务消费方 `ImageGenerate`（`ImageGenerate.tsx:806`）。
   附带：`editors/cameraStudio.ts`(189，头注"纯逻辑层，无 UI 依赖")与 `cameraParams/{cameraPrompt,types}.ts` 是同一条「相机参数 → 提示词」链路，却被拆在两级目录 → 记「域内错位」。
4. **域根散件：现状 4 件（目标 0）。**
   `index.ts` = D1 例外①（门面）；`useImageHoverActions.tsx` = 计划 §A4 #57 指定留域根（D1 例外）；
   **`useCopyNode.ts` · `useFitNodeRatio.ts` = 无任何例外，应入子目录**（但 D3 无 `hooks/`，见 F-1）。

## 二、主表 · 域籍台账（每件一行 · 27 件）

> 判定列只取四种。合规行的「成因代号」写 `—`；带 `G` 的行指"计划/注释描述过期"，非搬迁成因。
> 证据③列按 TASK-022 §4.3 要求粘贴 `refs` ① 段原文（`tests/` 前缀省略为相对 `tests/`）。

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/components/image/index.ts` | 本域·合规 | `image` | `image/`（门面，D1 例外①） | 域外唯一消费方 `canvas/shell/NodePalette.ts:20-26`（导入 7 节点供 palettes 注册） | 节点数据落 `node.data`（`image/nodes/*` → `src/hooks/useNodeData` 的 `patchNodeDataById`，经 `image/lib/nodeImage.ts:51`） | `src/components/canvas/shell/NodePalette.ts` | 本域节点全经此门面外出；域外无深路径取本域节点（仅 `lazyNode` 装配例外） | — | 高 |
| 2 | `src/components/image/editors/index.ts` | 本域·合规 | `image` | `image/editors/`（子域门面；建议保留） | 6 处域内消费：`nodes/AssetNode.tsx:38` · `nodes/FaceMosaicNode.tsx:23` · `nodes/GridMergeNode.tsx:13-14` · `nodes/ImageGenerate.tsx:54` · `nodes/PanoramaNode.tsx:26-27` · `useImageHoverActions.tsx:3` | 不落数据（纯 re-export 门面） | `components/image/nodes/AssetNode.tsx` · `FaceMosaicNode.tsx` · `GridMergeNode.tsx` · `ImageGenerate.tsx` · `PanoramaNode.tsx` · `components/image/useImageHoverActions.tsx` | 域外 0 处（全仓 grep `image/editors` 域外命中 0）⇒ 非第二份**域**门面 | G | 高 |
| 3 | `src/components/image/editors/CameraStudioPanel.tsx` | 本域·合规 | `image` | `image/editors/` | `nodes/ImageGenerate.tsx:895 <CameraStudioPanel/>` · `nodes/AssetNode.tsx:550 <CameraStudioPanel/>` | `onGenerate` 结果写节点 `data`：`ImageGenerate.tsx:287`/`:318` `applyCameraSettingsToPrompt(prompt, cameraSettings)` | `components/image/editors/index.ts` | 本域 2 处渲染；`video/depthVideo/DepthVideoModal.tsx:113,482` 只是**注释对齐交互**，非 import | — | 高 |
| 4 | `src/components/image/editors/FaceMosaicEditor.tsx` | 本域·合规 | `image` | `image/editors/` | `nodes/FaceMosaicNode.tsx:415 <FaceMosaicEditor/>` | `onSave → useImageHoverActions/节点 → image/lib/nodeImage.ts:51 patchNodeDataById`（`data.assetUrl`） | `components/image/editors/index.ts` · `tests/unit/FaceMosaicNode.test.tsx` | 本域 1 处渲染；`lib/faceMosaic.ts` 与本件分居 lib/editors 是**能力/界面分层**（同域内），非分家 | — | 高 |
| 5 | `src/components/image/editors/ImageEditor.tsx` | 本域·合规 | `image` | `image/editors/` | `useImageHoverActions.tsx:187 <ImageEditor/>`（另 `nodes/ImageGenerate.tsx:16` 副作用 import） | `handleEditorSave` → `showThenPersistInline` → `onImageReplaced` → `patchNodeDataById`（`useImageHoverActions.tsx:83-91`） | `components/image/editors/index.ts` · `components/image/nodes/ImageGenerate.tsx` · `tests/unit/AssetNode.test.tsx` · `tests/unit/ImageEditor.outpaint.test.ts` · `tests/unit/ImageGenerate.hoverToolbar.test.tsx` · `tests/unit/ImageGenerate.saveRatioSync.test.tsx` · `tests/unit/useImageHoverActions.test.tsx` | 本域渲染；域外仅测试 mock | — | 高 |
| 6 | `src/components/image/editors/InlineImageCropper.tsx` | 本域·合规 | `image` | `image/editors/` | `useImageHoverActions.tsx:198 <InlineImageCropper/>` | `handleCropSave` → `showThenPersistInline` → `patchNodeDataById`（`useImageHoverActions.tsx:95-102`） | `components/image/editors/index.ts` · `tests/unit/ImageGenerate.hoverToolbar.test.tsx` · `tests/unit/ImageGenerate.saveRatioSync.test.tsx` · `tests/unit/InlineImageCropper.cropRect.test.ts` | 本域 1 处渲染 | — | 高 |
| 7 | `src/components/image/editors/OverlayEditor.tsx` | 本域·合规 | `image` | `image/editors/` | `nodes/GridMergeNode.tsx:932 <OverlayEditor/>`（`renderOverlayCanvas` 由 `:432` 调用） | 合成 PNG → `GridMergeNode` 落 `assetNode` 节点 `data.assetUrl` | `components/image/editors/index.ts` · `tests/unit/GridMergeNode.test.tsx` · `tests/unit/GridSplitNode.test.tsx` · `tests/unit/OverlayEditor.upstreamSync.test.tsx` | 本域 1 处渲染；`GridSplitNode.tsx` 实测 0 处 overlay 引用（其测试 mock 属过期桩，见假子域表） | — | 高 |
| 8 | `src/components/image/editors/PanoViewer.tsx` | 本域·合规 | `image` | `image/editors/` | `nodes/PanoramaNode.tsx:711 <PanoViewer/>`（`PanoViewerHandle` 供 `:294` viewerRef 截图） | 截图 → `PanoramaNode` 出图写节点 `data` | `components/image/editors/index.ts` | 本域 1 处渲染（`PanoramaNode`）；域外 0 | — | 高 |
| 9 | `src/components/image/editors/cameraParams/CameraSettingsSelector.tsx` | 本域·合规 | `image` | `image/editors/cameraParams/` | `nodes/ImageGenerate.tsx:806 <CameraSettingsSelector/>` | `cameraSettings` 状态 → `applyCameraSettingsToPrompt` → 生成请求 prompt（`ImageGenerate.tsx:287`） | `components/image/editors/index.ts` | 本域 1 处渲染 | — | 高 |
| 10 | `src/components/image/editors/cameraParams/cameraParams.css` | 本域·合规 | `image` | `image/editors/cameraParams/` | 由 `CameraSettingsSelector.tsx` 侧效应 import（样式挂在该选择器上） | —（无数据） | `components/image/editors/cameraParams/CameraSettingsSelector.tsx` | 本域 1 处引用 | — | 高 |
| 11 | `src/components/image/editors/cameraParams/cameraPrompt.ts` | 本域·合规 | `image` | `image/editors/cameraParams/`（按 D3 字面亦可入 `lib/`，见 F-4） | `ImageGenerate.tsx:287`/`:318` 调用 `applyCameraSettingsToPrompt`（经 `editors/index.ts:27` 转出） | 生成请求 prompt 字符串（`ImageGenerate.tsx:287` `prompt:` 字段） | `components/image/editors/index.ts` | **反证 prompt 域**：全仓消费方只有 `ImageGenerate`（图片节点），video/text 节点 0 处 ⇒ 属 image | — | 高 |
| 12 | `src/components/image/editors/cameraParams/types.ts` | 本域·合规 | `image` | `image/editors/cameraParams/` | 类型契约，挂 `CameraSettingsSelector` / `cameraPrompt` / `editors/index.ts` 三处 | 契约字段承载 `cameraSettings`（`ImageGenerate` 节点 data 侧配置） | `components/image/editors/cameraParams/CameraSettingsSelector.tsx` · `components/image/editors/cameraParams/cameraPrompt.ts` · `components/image/editors/index.ts` | 本域 3 处引用，域外 0 | — | 高 |
| 13 | `src/components/image/editors/cameraStudio.ts` | **本域·域内错位** | `image` | `image/editors/cameraParams/`（与 `cameraPrompt.ts`/`types.ts` 同链路收拢；备选 `image/lib/`，见 F-4） | 消费方 `editors/CameraStudioPanel.tsx:24`（同目录），面板再挂 `ImageGenerate.tsx:895` / `AssetNode.tsx:550` | `CameraStudioResult` → `onGenerate` → 节点 `data`（prompt/尺寸） | `components/image/editors/CameraStudioPanel.tsx` · `components/image/editors/index.ts` | 本域 2 处；件头注自述"纯逻辑层，无 UI 依赖" ⇒ 不符合 `editors/`(编辑器) 职责 | A | 中 |
| 14 | `src/components/image/lib/faceMosaic.ts` | 本域·合规 | `image` | `image/lib/` | `editors/FaceMosaicEditor.tsx:20`（打码界面）· `nodes/FaceMosaicNode.tsx:22`（节点自动打码） | 打码后 dataURL → `nodeImage.replaceNodeImage` → `data.assetUrl` | `components/image/editors/FaceMosaicEditor.tsx` · `components/image/nodes/FaceMosaicNode.tsx` · `tests/unit/FaceMosaicNode.test.tsx` · `tests/unit/faceMosaic.test.ts` | 本域 2 处消费（界面 + 节点）；出向 import 0 处指向 `nodes/`/`editors/` | G（TD-25-11 已偿） | 高 |
| 15 | `src/components/image/lib/imageUpscale.ts` | 本域·合规 | `image` | `image/lib/` | `useImageHoverActions.tsx:6`（hover 栏「超分放大」，渲染于 AssetNode/ImageGenerate） | `upscaleImage` → `showThenPersistInline` → `data.assetUrl`（`useImageHoverActions.tsx:133`） | `components/image/useImageHoverActions.tsx` · `tests/unit/imageUpscale.test.ts` · `tests/unit/useImageHoverActions.test.tsx` | 本域 1 处消费 + 测试；出向 import 全落 `base/**` | — | 高 |
| 16 | `src/components/image/lib/nodeImage.ts` | 本域·合规 | `image` | `image/lib/` | `nodes/AssetNode.tsx:20` · `nodes/ImageGenerate.tsx`（`replaceNodeImage` 调用） | 唯一写入口：`nodeImage.ts:51 patchNodeDataById(setNodes, id, { assetUrl })` | `components/image/nodes/AssetNode.tsx` · `components/image/nodes/ImageGenerate.tsx` · `tests/unit/nodeImageWrite.test.ts` | 本域 2 处消费（计划判据同：`nodeImage` 消费者全 image）；**头注 :4「物理位置：base/」已过期**（`src/components/base/nodeImage.ts` 实测不存在） | G | 高 |
| 17 | `src/components/image/nodes/AssetNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:129` 注册（经 `image/index.ts:31`） | `useNodeData` → `data.assetUrl`/`assetType` | `components/image/index.ts` · `tests/unit/AssetNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 产品 `cat='image'`（`NodePalette` 权威真源） | — | 高 |
| 18 | `src/components/image/nodes/FaceMosaicNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:185` 注册（经 `image/index.ts:29`） | `useNodeData` → `data.assetUrl`（打码结果） | `components/image/index.ts` · `tests/unit/FaceMosaicNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 同上；编辑器 UI 走 `editors/FaceMosaicEditor`（无内联重复实现） | — | 高 |
| 19 | `src/components/image/nodes/GridMergeNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:157` 注册（经 `image/index.ts:28`） | `persistInlineOrKeep` → 派生 `assetNode` 节点 data | `components/image/index.ts` · `tests/unit/GridMergeNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 同上 | — | 高 |
| 20 | `src/components/image/nodes/GridSplitNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:149` 注册（经 `image/index.ts:27`） | `spawnAndCommit` 派生节点 + `data` | `components/image/index.ts` · `tests/unit/GridSplitNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 同上；本件实测无 overlay 逻辑（与 #7 无重复实现） | — | 高 |
| 21 | `src/components/image/nodes/ImageBoxNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:141` 注册（经 `image/index.ts:26`） | `useNodeData` → `data.url`/`assetUrl`（粘贴图/URL） | `components/image/index.ts` · `tests/unit/ImageBoxNode.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 同上 | — | 高 |
| 22 | `src/components/image/nodes/ImageGenerate.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:252` 注册（经 `image/index.ts:25`） | 生成结果 → `nodeImage.replaceNodeImage` → `data.assetUrl`；相机 prompt 由 `:287`/`:318` 写入请求 | `components/image/index.ts` · `tests/unit/ImageGenerate.hoverToolbar.test.tsx` · `tests/unit/ImageGenerate.imgMenu.test.tsx` · `tests/unit/ImageGenerate.saveRatioSync.test.tsx` · `tests/unit/ImageGenerate.upstream.test.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 同上；`PanoramaNode` 除外，7/8 节点经门面 | — | 高 |
| 23 | `src/components/image/nodes/LoopNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/NodePalette.ts:193` 注册（经 `image/index.ts:30`） | `useNodeData` → 循环生成的 `data.assetUrl` | `components/image/index.ts` · `tests/unit/LoopNode.test.tsx` | 同上 | — | 高 |
| 24 | `src/components/image/nodes/PanoramaNode.tsx` | 本域·合规 | `image` | `image/nodes/` | `canvas/shell/lazyNode.tsx:128` `panoramaNode: () => import('@/components/image/nodes/PanoramaNode')`（**装配期动态 import 例外**，`image/index.ts:19-21` 有背书） | `PanoViewer.capture` → 全景出图 → 节点 `data`（`AssetNode` 派生） | `src/components/canvas/shell/lazyNode.tsx` · `tests/unit/nodes/ssrRegression.test.ts` | 本域件；域外引用是代码分割所需字面路径（ADR-0039 N5 允许），非绕门面私取 | — | 高 |
| 25 | `src/components/image/useCopyNode.ts` | **本域·域内错位** | `image` | `image/hooks/`（建议新增；无则留域根须 D1 扩列 —— 见 F-1） | `nodes/ImageBoxNode.tsx:30`,`:118`；hover 栏「复制节点」按钮 `useImageHoverActions.tsx:179` | 序列化节点到系统剪贴板（`base/utils/net/clipboard.copyNodesToClipboard`），不写节点 data | `components/image/nodes/ImageBoxNode.tsx` · `components/image/useImageHoverActions.tsx` | 本域 2 处消费、域外 0 ⇒ 非横切（L4：单域消费不许留横切层）；但语义零 image 色彩（见 F-2） | A / F | 中 |
| 26 | `src/components/image/useFitNodeRatio.ts` | **本域·域内错位** | `image` | `image/hooks/`（同上，见 F-1） | `nodes/ImageGenerate.tsx:37`,`:198`（`fitFromImage` 绑 `img.onLoad`） | 改节点 `style.width/height`（`useNodeResize.onMainBoxResize`），不写业务字段 | `components/image/nodes/ImageGenerate.tsx` · `tests/unit/AssetNode.test.tsx` · `tests/unit/useFitNodeRatio.test.ts` | 本域 2 处（1 生产 + 1 测试 mock）；`canvas/nodes/_template/TemplateNode.tsx:92` 仅注释提及可复用 | A / F | 中 |
| 27 | `src/components/image/useImageHoverActions.tsx` | 本域·合规 | `image` | `image/`（**计划 §A4 #57 指定留域根**，D1 例外） | `nodes/AssetNode.tsx:33`,`:142` · `nodes/ImageGenerate.tsx:17`,`:509` | 产出新 dataURL → `onImageReplaced` → `nodeImage.replaceNodeImage` → `data.assetUrl` | `components/image/nodes/AssetNode.tsx` · `components/image/nodes/ImageGenerate.tsx` · `tests/unit/useImageHoverActions.test.tsx` | 本域 2 处消费 | — | 高 |

## 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| （无） | **0** | — |

**说明**：27/27 每件都能指出**本域界面渲染点**（或本域门面注册点）与**本域数据落点**（`node.data` / `patchNodeDataById`），
故不存在可送出件；「反证检查」在每行已做（本域渲染点均 ≥1）。
⚠️ 若按 TASK-022 §4「有一处 ⇒ 降级待核」口径，本域**没有任何件够格报"非本域"** —— 送出 0 是实测结论，不是漏扫。

## 域内错位表（属本域 · 子目录不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `useCopyNode.ts` | `image/`（域根） | `image/hooks/`（需先立 D3 条，见 F-1） | D1：域根只许门面 + 指定例外；本件无例外（`image/` 顶层的第三件） |
| `useFitNodeRatio.ts` | `image/`（域根） | `image/hooks/`（同上） | 同上 |
| `editors/cameraStudio.ts` | `image/editors/`（根） | `image/editors/cameraParams/` | D3：`editors/` = 编辑器；本件头注"纯逻辑层，无 UI 依赖"，与 `cameraParams/{cameraPrompt,types}.ts` 同属「相机参数→提示词」链路却分居两级 |

## 域根散件清单（现状 4 件 · 目标 0）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外（无则"无例外"） |
| --- | --- | --- | --- |
| `index.ts` | `image/` | 不动 | D1 例外①（域门面） |
| `useImageHoverActions.tsx` | `image/` | 不动 | D1 例外③（计划 §A4 #57 明写「留 `image/`」） |
| `useCopyNode.ts` | `image/` | `image/hooks/` | **无例外** |
| `useFitNodeRatio.ts` | `image/` | `image/hooks/` | **无例外** |

## 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| 子域职责混装（轻）+ 同能力拆两处 | `editors/cameraParams/*`（view+契约+纯映射+css）与 `editors/cameraStudio.ts`（纯逻辑） | D2 通过（4 件 ≥3）；D3 无一条职责名覆盖 `cameraParams/`；`cameraStudio.ts` 被隔离在同功能契约件之外 |
| 无反向依赖（D4 正面结论） | `lib/faceMosaic.ts` · `lib/imageUpscale.ts` · `lib/nodeImage.ts` | 3/3 出向 import 实测 0 处指向 `nodes/`、`editors/`（命中 `base/**`、`src/hooks/useNodeData`、`@mediapipe/tasks-vision`、`import type {Node} from '@xyflow/react'`） |
| 无成环 | 本域全 27 件 | `nodes/ → editors/`（5 处）· `nodes/ → lib/`（2 处）· `editors/ → lib/`（1 处）单向；`editors/ → nodes/` 0 处（`grep "from '\.\./nodes"` 无命中） |
| 测试桩过期（非域籍问题，提示裁判） | `tests/unit/GridSplitNode.test.tsx:18` mock `OverlayEditor` | `GridSplitNode.tsx` 实测 `grep -n "overlay"` **0 命中** ⇒ 桩对不上被测件 |
| 域外深路径依赖（本域**出向**，供 canvas 域主交叉） | `image/nodes/*.tsx` 直取 `@/components/canvas/{parts/NodeShell, shell/HoverToolbar, contract/nodeDefaults, structure/deriveNodes, structure/CanvasEdgesContext}` | 未经 `canvas/` 门面（若 canvas 有门面）；属「跨域只准走门面」完整性事项，非本域内部问题 |
| 装配期例外（有背书，非漏网） | `nodes/PanoramaNode.tsx` 未列入 `image/index.ts`，由 `canvas/shell/lazyNode.tsx:128` 动态 import | `image/index.ts:19-21` 明写「动态 import 无法走门面」；且 `tests/unit/nodeDefaults.test.ts:164` 也按此路径断言 |
| 门面内一致性提示 | `nodes/ImageGenerate.tsx:16` `import '@/components/image/editors/ImageEditor'`（副作用 import，深路径） | 域内件，不违门面；但与其余 5 处「走 `../editors`」写法不一致，登记备查 |

## 判据缺口（无据可依处 · 供裁判裁定）

- **F-1「域根 hook 无处可去」** → 建议补：D3 增 `hooks/`（域内共享 hook），或 D1 明确「域内共享 hook 可留域根（`use*.ts(x)`）」。现状：D1 只留门面 + 指定例外；D3 的 12 个职责名里**没有 hooks 类**。本域 `useCopyNode.ts` · `useFitNodeRatio.ts` 因此既不能留根也无处可去（`useImageHoverActions.tsx` 靠"计划指定"豁免，其余 hook 无此待遇）。
- **F-2「零业务语义 + 单域消费」的落点** → 建议补 ADR-0040 一条口径（如「通用机制件仅 1 域消费 ⇒ 留在消费域；出现第 2 域消费时迁横切」）。现状：`useCopyNode.ts` 是画布节点通用机制（与 `App.copySelectedNodes` / `base/utils/net/clipboard` 同族、零 image 语义），但 L1（界面位置）判它属 image、L4 只说"不许留横切层"未说"归谁" ⇒ 每次都会被重新质疑。
- **F-3「子域门面」是否算 ADR-0039 N5 意义上的第二份门面** → 建议补：N5 明确「域门面唯一；子域可各有一份子域门面，但不得暴露域外未消费符号」。现状：计划 §A5 判 `editors/index.ts`「应删」，与实测冲突（它 6 个消费方全在域内，且 `image/index.ts` 明确不导出 editors 符号）。
- **F-4「cameraParams 的职责归类」** → 建议裁定 D2 与 D3 的优先级：`cameraPrompt.ts`(80 行纯函数) / `cameraStudio.ts`(189 行纯逻辑) 按 D3 字面属 `lib/`（纯能力），按 D2 属「并进职责最近的现成子目录 = `cameraParams/`」。两条判据在本例给出不同落点，缺陷源在 D3 的职责名表未覆盖「某功能的能力件与其 UI/契约同居一子域」这一常见形态。
- **F-5「无 `node.data` 落点件的证据②怎么写」** → 建议补：`cameraParams.css`（纯样式）、`editors/index.ts`（纯 re-export）这类件无数据落点，§4 证据②要求"必须给 `文件:行`"在此不可满足。本轮按"—（无数据）"处理。

## 交叉验证请求（要下列域复核我的送出项）

| 送出的件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| （无） | — | 本域第一波送出 0 件 |

**预防性复核（若第二波被点名收件，本域立场已定）**：

| 可能被送来的件 | 我的复核结论 | 反证 |
| --- | --- | --- |
| `base/utils/imageCompress.ts` | **不认**（应留 `base/utils/`） | `base/utils/media/assetUrl.ts:32` 实 import `compressImage`；本域 3 处消费（`editors/ImageEditor.tsx:29` · `editors/InlineImageCropper.tsx:6` · `useImageHoverActions.tsx:5`）均**经 `base/utils` 横切入口**取得 ⇒ 被 base 自身与 image 同时消费，符合计划 §0.5 裁定 |
| `faceMosaic` / `nodeImage` / `imageUpscale`（若被他域送来） | **认领** | 实测已在 `image/lib/`（见主表 #14-16 的 refs） |

## 描述过期（线索 vs 实测）

| 线索/文档 | 说法 | 实测（2026-09-19） | 处置 |
| --- | --- | --- | --- |
| `TD-25-11` | `faceMosaic.ts` 应迁 `image/lib/` | 已在 `image/lib/faceMosaic.ts`（412 行；refs = `FaceMosaicEditor` + `FaceMosaicNode` + 2 测试） | 债已偿 ⇒ **G**（债描述过期） |
| `TD-18-37` | `base/utils/faceMosaic.ts` ↔ `image/editors/FaceMosaicEditor.tsx` 分家 | `src/components/base/utils/faceMosaic.ts` **不存在**（`ls` 报 No such file） | 分家已消除 ⇒ **G** |
| 其它旧路径 | — | `src/components/base/nodeImage.ts` · `base/utils/imageUpscale.ts` · `base/canvas/` 三者实测**均不存在** | 搬迁已完成 ⇒ **G**（债/文档仍在旧路径） |
| `image/lib/nodeImage.ts` 自身头注 `:4` | 「**物理位置**：坐落于 `src/components/base/`（通用地基）」 | 文件在 `image/lib/`，`base/nodeImage.ts` 不存在 | **文件内注释过期**（G）；建议按计划附录 A9「`base/nodeImage` 相关表述同步到 `image/lib/`」就地改 |
| 计划 §A4 行 57 | `useImageHoverActions.tsx` 留 `image/` | 在位，3 处消费全 image | 一致，无需改 |
| 计划 §A5 | `editors/index.ts` 「→ **删**」 | 仍在且被 6 处域内消费（0 域外） | 与实测冲突 ⇒ 见 F-3 |
| `TD-18-35` | 图片媒体处理约 9 件 / 约 1400 行散在 `base/utils` | **属 TASK-029 领地，本轮未扫**（未越界）；image 侧对应子目录 `image/lib/` 已存在且职责正确 | 仅登记，不裁定 |

## 计数

- 本域扫描件数：**27**（`find src/components/image -type f | sort` = 27，含 1 个 `.css`）
- 本域·合规：**24**
- 本域·域内错位：**3**（`useCopyNode.ts` · `useFitNodeRatio.ts` · `editors/cameraStudio.ts`）
- 非本域：**0**
- 待核：**0**
- 成因分布：A **3** / B **0** / C **0** / D **0** / E **0** / F **2**（与 A 并记在同一 2 行）/ G **2**（`editors/index.ts` 与计划冲突 · `nodeImage.ts` 头注过期）；其余 21 行合规件不归因（写 `—`）
- 无 `refs` 输出的件：**0 件**（27/27 均有 ① 段输出，含 `cameraParams.css` → 1 处 `CameraSettingsSelector.tsx`）

## 验收自测（TASK-022 §9 + TASK-023 §6）

- [x] 领地每个文件出现在主表**一次**（27 行 = `find` 27 件，不多不少）
- [x] 四问各有明确结论（见「一、四问结论」，均附实测依据）
- [x] 对 `lib/` **每件**跑了 `refs`（3/3）+ 追加出向 import 复核（0 处反向依赖）
- [x] 「非本域」结论 0 条 —— 无需凑四件证据；但对 3 个高概率被误送件（`imageCompress`/`faceMosaic`/`nodeImage`）主动给出**反证**
- [x] 无一条依据是"名字叫 xxx / 目录在 xxx"（全部落在 `文件:行` + `refs` 原文 + 出向 import 实测）
- [x] 成因代号全部取自 TASK-022 §6 表，无自造
- [x] **未改本文件以外的任何文件**（见下方 `git status` 自检）

### `git status` 自检摘要（2026-09-19 本轮作业）

```
$ git status --short | wc -l
349          # 会话开始前既存的工作区改动（他人/前轮作业），本轮未增删
$ git status --short -- "docs/agent 批量任务/TASK-023-域主-image.md"
?? "docs/agent 批量任务/TASK-023-域主-image.md"      # 本轮唯一被写的文件（原先未跟踪）
$ node scripts/mv-sync-refs.mjs refs <件>            # 只读命令，未产生 write
```

> 本轮**未**执行任何 `git mv` / `move` / `move-dir` / `convert`，**未**改 `src/**`、**未**改 `docs/plan/**`、**未**改其它 `TASK-*`，**未**新建脚本。
