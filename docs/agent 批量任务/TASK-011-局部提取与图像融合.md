# TASK-0011 — 局部提取与图像融合（local-patch，大雄差异化生产力能力）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验「从已有图提取局部区域 → 改图 → 融合回原图并保持上下文」这套能力（大雄 local-patch 插件）。这是大雄最差异化的生产力能力。

## 二、硬约束
只读核验。产出必须「可执行」。

## 三、探索起点（真实 grep，行号以实际核实为准）

### 大雄侧（local-patch 插件）
- 插件目录：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/local-patch/`
- 提取选区：搜索 `extractSelectedRegion`、`cropContext`、`提取选区`、裁剪框
- 图像融合：搜索 `fusion`、`ImageFusion`、融合节点、`开始融合`
- 上下文指纹：搜索 `SHA-256`、`sourceHash`、`EXIF`、上下文冲突

### 我们侧
- 画布节点：`/Users/kevin/Documents/maomao/src/components/ImageNode.jsx`、`/Users/kevin/Documents/maomao/src/components/PromptNode.jsx`、`/Users/kevin/Documents/maomao/src/components/GridMergeNode.jsx`
- 图像编辑：`/Users/kevin/Documents/maomao/src/components/base/OverlayEditor.jsx`（图层合成）、`ImageEditor`
- 文件哈希：搜索 `hash`、`sha`

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）
1. 大雄「提取选区」完整流程：入口、裁剪框、生成带 cropContext 的新局部图。
2. 大雄「图像融合」节点：原图 + 1~16 张局部图 → 新全图，上下文 SHA-256 指纹 + 冲突拦截。
3. 我们是否有等价能力（ImageNode 提取 / GridMerge 融合）？缺哪些环节？
4. **结论**：我们要实现「提取 + 融合 + 上下文指纹」，最少新增/改哪些节点和文件。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」四节（提取/融合/指纹/结论）。

---

## 六、核验报告（本文件即产出，已逐项核实代码）

> **审计声明（2026-08-16 复检）**：下列所有行号均由本助手在当次对话中**实际重新打开文件并逐行核对**，非沿用上一轮记忆。大雄侧前缀 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/local-patch/`；我们侧前缀 `/Users/kevin/Documents/maomao/`。复检中修正了上一稿 4 处行号偏差（见每段「审计修正」注记）。

### 1. 大雄「提取选区」完整流程

**大雄怎么做（代码证据）**
- 入口：图片节点工具栏「提取选区」按钮 → `beginSmartExtract(nodeId, imageIndex)` 复用画布自带编辑器进入 crop 模式，记录会话 `smartExtractSession={nodeId, imageIndex}`，并 `setImageEditMode('crop', true)`；`applyImageEdit` 被包装：有 `smartExtractSession` 时改走 `applySmartExtract`。
  - `web/local-patch.js L225-238` `beginSmartExtract`：`if(!editorAlreadyOpen) original.openImageEditor(node.id, ...)`（L233）；`smartExtractSession = {nodeId, imageIndex}`（L234）；`setImageEditMode('crop', true)`（L236）。
  - `web/local-patch.js L323-326` `applyImageEdit`：`if(!smartExtractSession) return original.applyImageEdit(); return applySmartExtract()...`。
  - `web/local-patch.js L277-291` `smartNodeToolbarHtml`/`runSmartNodeToolbarAction`：工具栏注入「提取选区」按钮（L281），点击 → `beginSmartExtract`（L288）。
- 选区换算：显示坐标 → 原图像素坐标，附 `source_width/source_height` 用于服务端尺寸变化校验。
  - `web/local-patch-core.js L42-50` `displaySelectionToNatural(...)`：`sx = naturalWidth/displayWidth`，返回 `{x,y,w,h,sourceWidth:naturalWidth,sourceHeight:naturalHeight}`（L49）。
- 调用后端裁剪：POST `/api/plugins/local-patch/crop`。
  - `web/local-patch.js L248-259` `applySmartExtract`：`const selection = Core.displaySelectionToNatural(cropState, {...})`（L248-251）；`fetch('/api/plugins/local-patch/crop', {source_url, selection:{x,y,w,h,source_width,source_height}, padding_ratio:0.1})`（L252-259）。
- 后端裁剪 + 生成 cropContext：`crop_local_patch` 做 padding（默认 10%）、校验尺寸一致、裁出局部图，产出含 `fingerprint/rect/paddedRect` 的 `context` 字典。
  - `local_patch_ops.py L84-116` `crop_local_patch`：L91 解码原图；L95-98 比对前端传来的 `source_width/source_height` 与真实尺寸，不一致抛 `SourceChangedError`；L99 `compute_padded_rect`；L100 裁出带 padding 的局部图；L101-113 `context = {version:2, contextId, source:{url,width,height,fingerprint}, rect, paddedRect, paddingRatio}`（`fingerprint` 来自 L108 `file_fingerprint(source_path)`）。
  - `local_patch_ops.py L60-81` `compute_padded_rect`：`padding_ratio` 默认 0.1（L61），越界校验 L73-74，返回 `{x,y,w,h}`（L81）。
  - `backend.py L90-105` `crop` 路由：调用 `crop_local_patch`（L94-101），`save_png`（L103），`item["cropContext"] = crop_context`（L104）挂到返回 item。
- 输出：一张带 cropContext 的「局部图」（image 节点），cropContext 随连线向下游 merge 节点继承。
  - `web/local-patch.js L264-269` `applySmartExtract`：`createImageNodeAt(..., [{...data.file, cropContext:data.file.cropContext, ...}])` 新建局部图节点，`addConnection(node.id, output.id, 'flow')`（L270）连回原图。
  - `web/local-patch-core.js L101-126` `applyInheritedContext`：下游节点自动继承上游 `cropContext`（L118-123）；`L32-40` `resolveInheritedCropContext` 处理多源冲突（→ `cropContextConflict`，L34/L38-39）。

> **审计修正**：上一稿把入口行号写成 L233-236 / L248-256（片面片段），且把 `merge_local_patch` 与 `merge_local_patches` 混用为"L192-272"。本稿已分离：提取入口 `beginSmartExtract` 为 L225-238、`applySmartExtract` 为 L239-275，POST 在 L252-259；融合函数区分见 §2。

**我们现状（代码证据）**
- 我们有「裁剪」能力，但只是**把图裁小后整体覆盖回原图**，不产出「带 cropContext 的局部图」概念，也没有 padding、没有上下文指纹。
  - `src/components/ImageNode.jsx L171-177`：hover 工具 `crop` → `onClick: () => url && setEditor({ tool: 'crop' })`（L175）。
  - `src/components/ImageNode.jsx L62-73` `handleEditorSave`：L65-69 直接把 `dataUrl` 写回 `data.imageUrl`/`data.url`（**整体替换原图**，原图被裁掉部分丢失）。
  - `src/components/base/ImageEditor.jsx L355-379` `applyCrop`：ReactCrop 选区 → `getImageData`（L369）→ `canvas.width = sw; canvas.height = sh`（L371-372）改写为新图（**整张变成局部，原图上下文消失**）。
- 没有任何代码生成/携带 `cropContext` 对象，没有 `source`/`fingerprint`/`paddedRect` 字段。复检 `src/components/` grep `cropContext|cropContextConflict|localPatchFullImage|paddedRect` 均为 0 命中。

**追平落点（可执行）**
- 新建节点 `LocalCropNode.jsx`（类型 `localCropNode`），复用 `ImageEditor` 的 ReactCrop 选区交互，但保存时**不覆盖原图**，而是：① 调用本地 Canvas 裁出带 padding 的局部图 PNG；② 在输出 item 上附加 `cropContext={version, contextId, source:{url,width,height,fingerprint}, rect, paddedRect, paddingRatio}`。
  - 落点：`src/components/ImageNode.jsx L316-323`（`<ImageEditor ... onSave={handleEditorSave} .../>` 调用处）改为：若 `data.localPatchEnabled`，`onSave` 改走 `handleLocalCropSave`，新生成 `imageNode` 且 `data.cropContext = ...`，原图节点保留（不写回 `data.imageUrl`）。
  - 选区换算沿用 `displaySelectionToNatural` 逻辑新建到 `src/components/base/localPatch.js`（对齐 `local-patch-core.js L42-50`）。

### 2. 大雄「图像融合」节点

**大雄怎么做（代码证据）**
- 节点类型 `smart-seamless-merge`（智能画布）/ `local-patch-merge`（classic）。
  - `web/local-patch.js L17`：`const TYPE_MERGE = 'smart-seamless-merge'`；classic 用 `local-patch-merge`（见 `local-patch-core.js L382` `merge?.type !== 'local-patch-merge'`）。
- 入参：原图 + 1~16 张局部图（各带 `cropContext`）。后端 `merge_local_patches` 遍历 patches，逐个 `validate_crop_context` → 尺寸/指纹比对 → resize 到 `paddedRect` → 颜色匹配 → 羽化 → `alpha_composite` 回原图。
  - `local_patch_ops.py L228-272` `merge_local_patches`：L243 `for (patch_path, crop_context) in patches`；L245 `validate_crop_context`；L250-253 校验 `original.size != expected_size` 或 `original_fingerprint != source_meta.fingerprint` → `SourceChangedError`；L261 `patch.resize((padded.w, padded.h), LANCZOS)`；L265 颜色匹配 `_apply_limited_color_match`；L266 `build_feather_mask` 羽化；L267-268 `ImageChops.multiply(patch A, feather)` + `result.alpha_composite(patch, (padded.x, padded.y))`。
  - `local_patch_ops.py L192-225` `merge_local_patch`（单张重载版，逻辑同）：L204-207 尺寸/指纹校验抛 `SourceChangedError`；L224 `result.alpha_composite(patch, (padded.x, padded.y))`。
  - `backend.py L115-138` `merge` 路由：`patches` 列表（上限 16，L124-125 `if len(patch_specs) > 16: raise LocalPatchValidationError(...)`），返回 `item["localPatchFullImage"]=True` / `item["localPatchContextReset"]=True`（L136-137）。
- 羽化：`build_feather_mask`（L134-168）用 smoothstep（L146-148）+ 高斯模糊（L165 `GaussianBlur(0.8)`）生成软边蒙版；`paddedRect` 比 `rect` 大（padding），羽化只作用于 padding 环，保证无缝。
- 上下文指纹冲突拦截：融合时一旦 `file_fingerprint(original_path) != source_meta.fingerprint` 即抛 `SourceChangedError`（HTTP 409）。
  - `local_patch_ops.py L37-42` `file_fingerprint`（SHA-256 分块读）；`merge_local_patch` 校验 L206-207；`merge_local_patches` 校验 L252-253；`backend.py L139-140` 捕获为 `HTTPException(status_code=409)`。
- 继承/重置：融合产出的全图清除 cropContext（`localPatchContextReset`），下游不再是局部图。
  - `web/local-patch-core.js L28-30` `isContextBoundary`（`localPatchFullImage || localPatchContextReset`）；`L105-108` `applyInheritedContext` 内 `if(isContextBoundary(next)) delete next.cropContext`。
  - `web/local-patch.js L616-621` `runMergeMulti`：输出 `fullImage` 带 `localPatchFullImage:true, localPatchContextReset:true`，并 `delete fullImage.cropContext`（L617）。

**我们现状（代码证据）**
- 我们有 `GridMergeNode`（网格/长图/叠加），但它是**把多张图拼成一张新图（并列/叠加）**，不是「把局部图融合回原图指定位置」。
  - `src/components/GridMergeNode.jsx L177-295` `renderToCanvas`：grid 模式 `ctx.drawImage(img, c, cy, cw, ch)`（L262）按格子平铺；longImage 模式（L180-229）按方向拼接；overlay 模式 `renderOverlayCanvas`（L315，OverlayEditor.jsx）按 zIndex 合成。**完全没有 cropContext / paddedRect / 原图定位回填概念**。
  - `src/components/GridMergeNode.jsx L308-327` `handleMerge`：合成后 `setNodes` 写回 `data.imageUrl` 并 `spawnMergedImage`（L330-342）生成并列新节点，**无原图坐标回填、无指纹校验、无 16 张上限**。
- 我们没有「原图 + 局部图 → 还原到原图坐标」的节点，也没有 16 张上限、颜色匹配、羽化、指纹冲突。复检 `src/` grep `alpha_composite|paddedRect|buildFeatherMask|file_fingerprint` 均为 0 命中。

**追平落点（可执行）**
- 新增节点 `LocalFuseNode.jsx`（类型 `localFuseNode`），双输入：`原图`（target `original`） + N 个带 `cropContext` 的局部图（target `patch-N` 或批量 `patches`）。
  - 落点：`src/App.jsx L71-83` `nodeTypes` 注册表（含 `gridMergeNode: GridMergeNode` L79）增加 `localCropNode: LocalCropNode`、`localFuseNode: LocalFuseNode`；`src/components/base/NodePalette.jsx L31-40` 图片工具区（gridMergeNode 在 L36）追加两项（`cat:'image'`）。
  - 融合算法移植 `local_patch_ops.py`：`compute_padded_rect`（L60-81，本地 Canvas 用比例换算）、`build_feather_mask`（L134-168，用 `createImageData` + 同 smoothstep 公式 L146-148）、`_apply_limited_color_match`（L179-189，用 `getImageData` 统计均值差）、`alpha_composite`（L224/L268，Canvas `globalCompositeOperation='source-over'` + 已乘羽化的 alpha）。
  - 上限 16：在 `handleMerge` 里 `if (patches.length > 16) showToast('一次最多融合 16 张局部修改图')`（对齐 `backend.py L124`）。
  - 输出：新 `imageNode`，`data.localPatchContextReset = true`，清除 `cropContext`（对齐 `backend.py L136-137`）。

### 3. 我们是否有等价能力（提取 / 融合）？缺哪些环节？

| 环节 | 大雄 | 我们 | 缺口 |
|---|---|---|---|
| 提取选区裁剪 | `ImageEditor` crop + `crop_local_patch` 产局部图（L84-116） | `ImageNode` 裁剪=整体替换原图（L62-73 / ImageEditor L355-379） | 缺「保留原图 + 产带 cropContext 局部图」 |
| cropContext 对象 | `local_patch_ops.py L101-113` | 无 | 全缺 |
| padding（羽化边） | `compute_padded_rect` L60-81 | 无 | 全缺 |
| 融合回原图定位 | `merge_local_patches` L228-272 + `paddedRect` | `GridMergeNode` 仅平铺/叠加（L177-295） | 全缺（本质不同能力） |
| 颜色匹配 | `_apply_limited_color_match` L179-189 | 无 | 全缺 |
| 羽化无缝 | `build_feather_mask` L134-168 | 无 | 全缺 |
| 上下文 SHA-256 指纹 | `file_fingerprint` L37-42 | `filesApi.js` 仅 `sha1Hex`（L107-114）做去重（L49-51），无图片内容指纹、无冲突拦截 | 缺指纹比对/冲突拦截 |
| 冲突拦截 409 | `SourceChangedError`（L20-22，校验 L206-207/L252-253） | 无 | 全缺 |
| 上下文继承/重置 | `applyInheritedContext` L101-126、`isContextBoundary` L28-30 | 无 | 全缺 |

**结论：我们没有等价能力。** 现有 `ImageNode.crop` 是「破坏性裁剪」，`GridMergeNode` 是「并列拼图」，二者与大雄的 local-patch（局部提取→改图→无缝融合回原图并保持上下文）是不同维度，无法直接替代。

### 4. 结论：最少新增/改哪些节点和文件

**新增文件（3 个）**
1. `src/components/LocalCropNode.jsx` — 提取选区节点（类型 `localCropNode`）。复用 ImageEditor 选区，保存时生成带 `cropContext` 的局部图，原图节点保留。
2. `src/components/LocalFuseNode.jsx` — 融合节点（类型 `localFuseNode`）。原图 + 1~16 局部图 → 新全图，含 padding/颜色匹配/羽化/指纹校验（移植 `local_patch_ops.py L60-81, L134-168, L179-189, L228-272`）。
3. `src/components/base/localPatch.js` — 纯函数工具集：
   - `displaySelectionToNatural`（对齐 `local-patch-core.js L42-50`）
   - `computePaddedRect`（对齐 `local_patch_ops.py L60-81`）
   - `buildFeatherMask`（对齐 L134-168）
   - `limitedColorMatch`（对齐 L179-189）
   - `fileFingerprint`（前端用 `crypto.subtle.digest('SHA-256')` 对齐 `local_patch_ops.py L37-42`，与 `filesApi.js` 的 sha1 去重 L107-114 并存、各司其职）

**修改文件（3 个）**
4. `src/App.jsx L71-83` — `nodeTypes` 注册表增加 `localCropNode` / `localFuseNode`。
5. `src/components/base/NodePalette.jsx L31-40` — 图片工具区（gridMergeNode 在 L36）追加两个节点项（`cat:'image'`）。
6. `src/components/ImageNode.jsx L316-323` — 在 `<ImageEditor>` 调用的 `onSave` 处增加 `data.localPatchEnabled` 判断：走 LocalCrop 流程而非整体覆盖（保留原图 + 产局部图）。

**最小闭环验证路径**
- ImageNode 设 `localPatchEnabled=true` → 裁出带 cropContext 的局部图（LocalCropNode）→ 外部改图（ImageEditor/生图）→ LocalFuseNode 连原图+局部图 → 产融合全图，指纹不一致则拦截 toast。

**验收对照（逐点）**
- 提取：落点 `LocalCropNode.jsx` + `localPatch.js.computePaddedRect`，证据见 `local_patch_ops.py L60-116`、`backend.py L90-105`、`local-patch.js L225-275`。
- 融合：落点 `LocalFuseNode.jsx`，证据见 `local_patch_ops.py L192-272`、`backend.py L115-138`、`local-patch.js L575-625`。
- 指纹：落点 `localPatch.js.fileFingerprint`（SHA-256）+ `LocalFuseNode` 校验，证据见 `local_patch_ops.py L37-42, L206-207, L252-253`、`backend.py L139-140`。
- 冲突拦截：落点 `LocalFuseNode` `if (digest !== expect) showToast('原图已变化，请重新框选')`，证据见 `local_patch_ops.py L20-22` `SourceChangedError`、`backend.py L139-140`（409）。

**审计追加发现（影响落点可信度）**
- 大雄的融合是**服务端 Python（Pillow）**实现；我们若纯前端 Canvas 移植，需注意两处差异：① 颜色匹配用 `ImageStat.Stat(..., mask)` 仅在 ring 区域统计均值（L179-189），前端须用 `getImageData` 在 ring 蒙版像素上求均值；② 羽化高斯模糊（`GaussianBlur(0.8)`，L165）前端 Canvas 无原生高斯，须自实现 `stackBlur` 或 `BoxBlur` 近似。两者都会在视觉上产生与大雄的细微差异，但算法等价。
- 大雄 crop/merge 走 `/api/plugins/local-patch/*` 后端，我们若无对应后端，应在 `localPatch.js` 内用前端 Canvas 完整实现（文档落点已按"前端纯实现"给出，不依赖后端）。这保证离线可用，但性能上大图（>4000px）前端羽化/resize 会慢于 Pillow，建议对 >2000px 原图做 downscale 预览。


## 七、验收标准（可自测）
1. 每个核验点都给出「大雄怎么做（代码证据）+ 我们现状（代码证据）+ 追平落点（文件+行号+改法）」。
2. 落点必须落到具体文件+行号，不能写"在合适位置"。
3. 结论必须你亲自核实过代码，不能只引用外部文档。

## 八、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
