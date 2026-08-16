# TASK-025 — 智能编辑能力核验（大雄 Outpaint/局部重绘/图片编辑器 vs 我们 ImageEditor）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
大雄 Infinite-Canvas 有图片**智能编辑**能力：Outpaint 扩展（向外扩图）、遮罩重绘（mask inpaint）、图片编辑器（裁剪/画笔/缩放/网格拼接）、360 全景、视频帧抽取。我们（maomao）有 `ImageEditor.jsx`（裁剪/画笔）、`FaceMosaicNode.jsx`（人脸打码）、`PanoramaNode.jsx`（全景）、`VideoExtractNode.jsx`（帧抽取）、`OverlayEditor.jsx`（图层合成）。本任务核验大雄的智能编辑与我们的差距，尤其是 **Outpaint（外扩）** 这类我们可能缺失的能力。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）
### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`）
- **Outpaint 外扩**：`validOutpaintSize` @ L1041、`withOutpaintDisplaySettings` @ L1068、`stripOutpaintDisplaySettings` @ L1095、`nearestFourKSizeFor` @ L1050、`exceedsFourKStandard` @ L1063、`parseSizePair` @ L1046、`outpaintResolutionLocked` @ L950-957、`outpaintNaturalSize` @ L10656、`clampOutpaint` @ L10676、`resetOutpaintBox` @ L10684、`updateOutpaintResolutionLabel` @ L10667
- **图片编辑器总模式**：`imageEditMode` 枚举 `['preview','crop','outpaint','mask','brush','resize','grid']` @ L9019；`setImageEditMode` 切换逻辑 @ L9011-9110；`outpaint-mode` 类切换 @ L9049；`outpaintFrame` 元素定位 @ L10648-10653
- **编辑器入口/开关**：`smartImageEditorIsOpen` @ L563、`loadSmartOriginalImageDimensions` @ L476；节点浮动菜单 `actions` 含 `crop/outpaint/mask/brush/grid` @ L7249-7257；`modeMap` 映射 @ L7304
- **遮罩重绘（mask inpaint）**：`applyImageMask` @ L11137、`maskCanvasFromDrawCanvas` @ L11151、`normalizeMaskPreviewCanvas` @ L9938、`mask-mode` 类 @ L9045、`imageMaskTools` @ L9054；inpaint 提示词预设 `setPromptDraftForNode(node, 'Remove white area and fill the scene')` @ L11130
- **360 全景 / 视频帧抽取**：`smartVideoPreviewHtml` @ L486、`smartVideoFallbackHtml` @ L491、`smartVideoPlayerHtml` @ L496
- **缩放(resize) / 网格(grid)**：`resize` 模式 `applyBtn` 文案「应用缩放」@ L9076-9079；`grid` 拼接/切分 `gridOperationMode` @ L9058/L9078

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/ImageEditor.jsx`（裁剪/画笔编辑器，由 `ImageNode.jsx` L10/L317 调用，hover 工具栏「裁剪」「编辑」打开）
- `/Users/kevin/Documents/maomao/src/components/FaceMosaicNode.jsx`（人脸打码）
- `/Users/kevin/Documents/maomao/src/components/PanoramaNode.jsx`（360 全景）
- `/Users/kevin/Documents/maomao/src/components/VideoExtractNode.jsx`（视频帧抽取）
- `/Users/kevin/Documents/maomao/src/components/base/OverlayEditor.jsx`（图层合成/拼接）
- `/Users/kevin/Documents/maomao/src/components/base/imageApi.js`（`generateImage` 生图接口，L216-234）

## 四、覆盖清单（核验结论）

### 核验点 1：大雄智能编辑能力（代码证据）
- **Outpaint 外扩（核心缺口能力）**：
  - 节点挂 `outpaintSize` 字段，`validOutpaintSize(node)` @ L1041 校验 `node.outpaintSize.width/height>0`。
  - 生成请求时 `withOutpaintDisplaySettings(node, baseSettings)` @ L1068 把外扩尺寸写进生图参数（`resolution:'custom'`、`customWidth/customHeight/customSize`、`outpaintResolutionLocked:true`），并对 comfy/modelscope 引擎做字段映射（L1082-1092）。即 outpaint 本质是「输入原图 + 输出更大尺寸」的一次生图。
  - 反序列化/落库时 `stripOutpaintDisplaySettings(settingsObj, node)` @ L1095 把外扩尺寸还原成 1K 占位（`outpaintResolutionLocked` 在 L957/L1118 删除），避免超大尺寸入库。
  - 4K 上限守护：`nearestFourKSizeFor` @ L1050 按 `SIZE_MAP` 找最近 4K 档；`exceedsFourKStandard` @ L1063 判超；`clampOutpaint` @ L10676 把扩展框钳制在不小于原图；`updateOutpaintResolutionLabel` @ L10667 给 UI 警告（`outpaint-warning` 类 L10673）。
  - 编辑器内 outpaint 交互：`setImageEditMode('outpaint')` @ L9019，`outpaint-mode` 类 @ L9049；进入时 `resetOutpaintBox` @ L10684 把原图绝对定位到扩展画布左上角（`img.style.left/top=0` L10615-10617），右侧/下方留白由 `outpaintFrame` 标示（L10648-10653），`applyBtn` 文案 `applyOutpaint`/`outpaintImage` L9082-9084。
  - 工具栏入口：`{key:'outpaint', icon:'expand', label:'扩图', enabled:canEditImage}` @ L7252；`modeMap` 把 `outpaint` 映射到编辑器（L7304）。
- **遮罩重绘（mask inpaint）**：编辑器 `mask` 模式（L9019/L9045/L9054）用遮罩笔刷涂出重绘区（`MASK_BRUSH_COLOR` @ L9929）；`applyImageMask` @ L11137 把涂鸦 canvas 二值化为 mask PNG（`maskCanvasFromDrawCanvas` L11151：`srcData.data[i+3]>8` 判定已涂 → 255，否则 0），上传为 `role:'mask'` 资产 push 回 `node.images`（L11146），并预设 inpaint 提示词 `setPromptDraftForNode(node, 'Remove white area and fill the scene')` @ L11130。**真正的 AI 重绘由下游生图节点消费该 mask 完成**（大雄生图链路支持 mask 输入，本文件未展开其生图 API）。
- **图片编辑器（裁剪/画笔/缩放/网格）**：
  - 模式枚举 `preview/crop/outpaint/mask/brush/resize/grid` @ L9019；`smartImageEditorIsOpen` @ L563 开关。
  - `crop` 裁剪、`brush` 画笔、`grid` 宫格拼接/切分（`gridOperationMode` join/split @ L9058/L9078）、`resize` 缩放图片（`applyBtn`「应用缩放」@ L9076-9079）。
  - preview 模式还带对比 `compareToggleBtn` 与全景 `panoramaToggleBtn`（L9063-9065）。
- **360 全景 / 视频帧抽取**：属媒体浏览+抽帧，`smartVideoPreviewHtml` @ L486、`smartVideoPlayerHtml` @ L496 等。

### 核验点 2：我们现状（代码证据）
- **裁剪 / 画笔编辑器（已有）**：`ImageEditor.jsx` 全屏编辑器，`DRAW_TOOLS` = pencil/eraser/text/line/arrow/square/circle/number/eyedropper（L45），`applyCrop` 用 ReactCrop 选区换算 canvas 像素裁切（L355-379），撤销栈 `history`/`undo`（L196-214）、视图缩放/平移（L137-184，注：此"缩放"是画布视图缩放，非图片 resize）。由 `ImageNode.jsx` L10/L317 调用。**无 outpaint 入口、无 mask 重绘模式、无 resize 图片、无 grid 拼接、无对比视图**。
- **人脸打码（已有，前端局部处理）**：`FaceMosaicNode.jsx` MediaPipe 检测人脸后按 mosaic/bar/grid/blur 打码（L107 `applyMosaic`），`FaceMosaicEditor` 手动框选（L307-313）。是「检测框 + 前端涂鸦」式局部处理，**非 AI mask 重绘**。
- **360 全景（已有）**：`PanoramaNode.jsx` react-three-fiber 球体全景 + OrbitControls 漫游（L197-204），当前/四大/12 大视角截图输出 `imageBoxNode`（L57-120）。
- **视频帧抽取（已有）**：`VideoExtractNode.jsx` 5 模式（固定数量/等距/智能转场/首尾帧/手动），canvas.drawImage 抽帧（L102-141、`smartCapture` 16×16 像素差 L144-173），输出网格 + 复制/下载（L301-318）。
- **图层合成/拼接（已有，大雄无对应独立节点）**：`OverlayEditor.jsx` 多图层叠加，导入/排序/显隐/锁定/拖动缩放旋转/涂抹擦除（L322-523）、画布尺寸 64-4096（L575-587）、`renderOverlayCanvas` 合成（L65-92）。此能力反向领先大雄。
- **生图 API 是否透传外扩/蒙版参数（关键判断依据）**：`imageApi.js` `generateImage({ provider, prompt, model, size, n, aspectRatio, quality, images })` @ L216，函数体至 L234 结束，`genBody` 仅含 `prompt/model/n/size/resolution/image_size/quality/image_urls`（L217-227）。**无任何 outpaint / customWidth / mask 字段** —— 即我们生图后端链（imageApi → apimart/Lovart 网关）**没有外扩与蒙版重绘参数通路**。

### 核验点 3：结论 —— 值不值得对齐
能力矩阵（我们现状 / 缺口 / 落点 / 成本 / 价值）：

| 能力 | 我们现状 | 缺口 | 落点 | 成本 | 价值 |
|---|---|---|---|---|---|
| **Outpaint 外扩** | 无 | 完全缺失；生图 API 无字段 | 落点 A | 高 | **高** |
| **遮罩重绘(inpaint)** | 仅前端打码，无 AI 重绘 | 缺 mask→生图链路 | 落点 B | 中高 | 中高 |
| **裁剪** | `ImageEditor` L355 已有 | 无 | 维持 | — | 已具备 |
| **画笔/涂鸦** | `ImageEditor` L45 已有 | 无 | 维持 | — | 已具备 |
| **缩放图片(resize)** | 无独立 resize | 缺 | 落点 C | 低 | 低-中 |
| **宫格拼接/切分(grid)** | 无独立 grid，但有 OverlayEditor 拼接 | 部分 | 维持/视需 | — | 已具备(替代) |
| **对比视图** | 无 | 缺 | 不追 | 低 | 低 |
| **人脸打码** | `FaceMosaicNode` 已有 | 无 | 维持 | — | 已具备 |
| **360 全景** | `PanoramaNode` 已有 | 无 | 维持 | — | 已具备 |
| **视频帧抽取** | `VideoExtractNode` 已有 | 无 | 维持 | — | 已具备 |
| **图层合成** | `OverlayEditor` 已有（大雄无对应） | 反向领先 | 维持/增强 | — | 领先 |

**关键判断**：
1. Outpaint 是否高频刚需？**是** —— 最高频图片编辑需求之一（放大画布、补全构图、纵向延伸），大雄把它放在节点浮动菜单第 3 位（L7252，仅次于预览/裁剪）。
2. 它依赖生图 API 支持吗？**是，纯前端无法完成**。Outpaint 本质是「输入原图 + 输出更大尺寸」的一次生图（大雄 `withOutpaintDisplaySettings` L1068 把外扩尺寸塞进生图请求，且 `outpaintResolutionLocked` 锁住分辨率防误用）。我们 `imageApi.js` 当前无此字段（L216-234），故必须先打通后端外扩参数，前端才能落地。
3. 利大于弊？**利大于弊**，但落地前提是生图网关支持 outpaint（如 Lovart/即梦部分模型支持）。若后端不支持，前端做纯 canvas 扩空白无意义（AI 不补全）。

## 五、输出规范（三节贯通）

### A. 大雄怎么做（代码证据）
- **Outpaint**：`validOutpaintSize` L1041 取 `node.outpaintSize` → `withOutpaintDisplaySettings` L1068 写入生图参数 `{resolution:'custom', customWidth, customHeight, customSize, outpaintResolutionLocked:true}` 并按引擎映射（L1082-1092）→ 生成后 `stripOutpaintDisplaySettings` L1095 还原 1K 占位落库。4K 上限由 `nearestFourKSizeFor` L1050 + `exceedsFourKStandard` L1063 + `clampOutpaint` L10676 守护。编辑器内 `setImageEditMode('outpaint')` L9019，`resetOutpaintBox` L10684 把原图定位到扩展画布左上、留白区由 `outpaintFrame` 标示（L10648-10653），UI 文案 `applyOutpaint` L9082。
- **遮罩重绘**：`mask` 模式涂遮罩（L9045/L9929）→ `applyImageMask` L11137 二值化为 mask PNG（`maskCanvasFromDrawCanvas` L11151）→ 作为 `role:'mask'` 资产 push 回节点（L11146）+ 预设 inpaint 提示词（L11130）→ **下游生图节点消费 mask 完成 AI 重绘**。
- **编辑器总谱**：模式 `preview/crop/outpaint/mask/brush/resize/grid` L9019；`resize` 缩放图片（L9076-9079）、`grid` 拼接/切分（L9058/L9078）、preview 带对比/全景 toggle（L9063-9065）。入口 `smartImageEditorIsOpen` L563；节点浮动菜单 L7249-7257。

### B. 我们现状（代码证据）
- 已有：裁剪 `ImageEditor.jsx` L355、画笔 L45、人脸打码 `FaceMosaicNode.jsx` L107、360 全景 `PanoramaNode.jsx` L197、视频抽帧 `VideoExtractNode.jsx` L102、图层合成/拼接 `OverlayEditor.jsx` L65。ImageEditor 由 `ImageNode.jsx` L10/L317 在 hover 工具栏「裁剪/编辑」打开。
- 缺失（已全局搜索 `src/` 核实：outpaint/inpaint/局部重绘/mask inpaint 仅命中 `GeneratingOverlay.jsx` L62 提示词文案，无实现）：
  1. **Outpaint 外扩**：`ImageEditor.jsx` 无入口；`imageApi.js` `generateImage` L216-234 无 outpaint/customWidth 字段 → 生图链不通。
  2. **AI 遮罩重绘(inpaint)**：仅有 `FaceMosaicNode` 前端打码，无「涂蒙版→AI 重绘」链路。
  3. **缩放图片(resize)/对比视图**：ImageEditor 无对应模式。

### C. 追平落点（可执行）+ 价值判断
**落点 A — Outpaint 外扩（价值高，P1）**：
1. 后端：`imageApi.js` `generateImage`（L216）增加 `outpaint` 选项 —— 接收 `{ outpaint:{width,height}, baseImage }`，拼到 `genBody`（如 `genBody.outpaint_size`、`genBody.image_urls=[baseImage]`），由 apimart/Lovart 网关透传（需先确认网关是否支持 outpaint 参数）。
2. 前端：`ImageEditor.jsx` 增加 `outpaint` 工具按钮，进入后允许向四周拖出扩展区（仿大雄 `outpaintFrame` L10648 思路），计算扩展后 `customWidth/customHeight`，保存时调 `generateImage({ outpaint, baseImage: 当前图 })` 而非 `toDataURL` 直出。
3. 4K 上限守护：仿 `nearestFourKSizeFor` L1050 / `exceedsFourKStandard` L1063 在前端做尺寸校验。
- 成本：高（前端交互 + 后端参数 + 网关联调）。价值：高。
- 风险：若生图网关不支持 outpaint，则 A 不可落地，需降级为「纯前端扩空白 + 用户自行生图填充」或推动网关支持。

**落点 B — AI 遮罩重绘 inpaint（价值中高，P2）**：
1. 复用 `OverlayEditor.jsx` 已有 mask 涂抹能力（L322-523 的 `paintLayerId`/mask 笔画）作蒙版来源。
2. `imageApi.generateImage` 增加 `mask` 字段透传（仿大雄把 mask 作为 `role:'mask'` 资产 L11146 交由生图消费），新增生图节点/工具发起 inpaint。
- 成本：中高（后端 inpaint 支持 + 前端蒙版导出）。价值：中高（角色换装/去物/局部改图高频）。

**落点 C — 缩放图片 resize（价值低-中，P3，可选）**：
- 大雄 `resize` 是「选择缩小倍数替换原图」（L9076-9079）。我们可用 `ImageEditor` 的 canvas 直接 `drawImage` 缩放另存，纯前端即可，成本低。优先级低于 A/B。

**不值得追的**：裁剪/画笔/打码/全景/抽帧/图层合成已具备或领先；对比视图价值低，不追。

## 六、验收标准（自检）
1. ✅ 三节贯通，带文件+行号+片段（第五、四节）。
2. ✅ 明确列出「已有」与「缺失」编辑能力（第四、五节 B 段）。
   - 已有：裁剪、画笔、人脸打码、360 全景、视频帧抽取、图层合成/拼接。
   - 缺失：Outpaint 外扩、AI 遮罩重绘(inpaint)、缩放图片(resize)、对比视图。
3. ✅ 每项有成本与价值评级（第四节矩阵 + 第五节落点标注）。
4. ✅ 亲自核实代码（本次实际打开 smart-canvas.js 多区段 / ImageEditor.jsx / FaceMosaicNode.jsx / PanoramaNode.jsx / VideoExtractNode.jsx / OverlayEditor.jsx / imageApi.js / ImageNode.jsx / GeneratingOverlay.jsx 核实行号）。

## 七、铁律文件名
本文件即唯一产出。写满后结束。
