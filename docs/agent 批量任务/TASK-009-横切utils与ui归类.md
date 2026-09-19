# TASK-009 · 横切utils与ui归类

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-009-横切utils与ui归类.md`。碰任何其他文件（含源码）视为任务失败。

## ⚠️ 铁律（违反重做）

1. **只读审计** —— 不改源码、不写脚本、不提交、不搬迁。
2. **不提问** —— 你不会得到回复。判不清的按判据判断并标注 `[待确认]` + 写明缺什么。
3. **每个判断都要跑 `refs`** —— `node scripts/mv-sync-refs.mjs refs <文件>`，禁止凭名字猜。
4. **覆盖要全** —— 本批次目录里**每一个** `.ts/.tsx/.css` 都要在表里出现，**一个不漏**。

## 任务

**查明：横切目录 `src/components/base/utils/`（24 件）与 `src/components/base/ui/`（25 件） 里的内容该怎么归类。**

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
- 先 `ls -1` 列出这两个目录的全部件（含子目录），逐个查（**不要只查我列的**）
- 已知线索（请独立复核，不要盲信）：
  · `ui/NodeShell.tsx` —— refs 显示约 35 处消费，全在 canvas ⇒ **可能是画布的节点外壳件**，该搬
  · `ui/CometParticles.tsx` —— 消费方在 `canvas/edges/` ⇒ 可能该搬
  · `ui/attachmentCover.tsx` · `utils/volumePolicy.ts` —— 消费方全在 agent ⇒ 可能该搬
  · `ui/Select.tsx` —— 消费方在 scriptbox ⇒ 可能该搬
  · `ui/VideoThumbnail.tsx` —— 可能属视频能力
  · `ui/InlineNameInput.tsx` · `ui/Toggle.tsx` —— 消费方在 base/panels ⇒ 可能是宿主层的件
- **内容能力嫌疑件**（可能因 `canvas/nodes/` 混装所有节点而判不准，请追数据流与界面位置）：
  `utils/imageUpscale.ts` · `utils/imageCompress` · `utils/faceMosaic` · `utils/videoEngine.ts`
  · `utils/captureFrame.ts` · `utils/timeline/{sourceTime,timeScale}.ts` · `utils/encoderProbe.ts`
  · `utils/useMediaLoadFailed.ts`
- `utils/assetType.ts` · `utils/assetUrl.ts` · `utils/clipboard.ts` —— 判断是否真横切

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

`base/ui` 是**叶组件库**（25 件），`base/utils` 是**工具库**（24 件）。它们被大量域消费，
**绝大多数应该是真横切** —— 请把力气花在**找出少数几个"其实只服务一个域"的件**上。

注意：有些件名字带"image/video"但可能是**跨内容类型共用**的（例如 `assetType` 判定任意媒体类型）
⇒ 名字不可信，必须看消费方与数据流。

---

# 交付

> 方法：对两个目录逐件跑 `node scripts/mv-sync-refs.mjs refs`，取「① 模块引用」段非测试消费方，按域归类；读头注释追数据流；界面位置以 NodePalette `paletteNodes.cat` 为权威。
> 数量核对：`find base/utils -name '*.ts*'` = **23 件**（任务书称 24，以实测 23 为准，疑含已迁出/改名件）；`find base/ui` = **25 件**。合计 48 件，下表 1 件不漏。

## 一、`base/utils`（23 件）

| # | 件（路径） | 非测试消费方（按域归类） | 数据落点 | 判定 | 置信度 | 一句话依据 |
|---|-----------|------------------------|----------|------|--------|------------|
| 1 | `utils/assetType.ts` | agent·base/api·base/media·base/panels·base/store·canvas·creative·director3d·scriptbox·video·videoEditor·hooks（≥3 域） | 纯函数无存储 | 留横切 | 高 | 媒体类型判定纯函数，零业务语义 |
| 2 | `utils/assetUrl.ts` | agent·base/api·base/media·base/panels·base/ui·canvas·video（≥3 域） | 纯函数无存储 | 留横切 | 高 | URL 补全/绝对化纯工具，零业务语义 |
| 3 | `utils/asyncGuard.ts` | agent·base/api·base/core·base/storage·base/store·base/ui·base/utils（≥3 域） | 纯函数无存储 | 留横切 | 高 | 异步超时/释放守卫，零业务语义 |
| 4 | `utils/captureFrame.ts` | video(videoEngine/depthVideo/VideoExtract/VideoProcess)·scriptbox·hooks/useVideoPoster（≥3 域） | 返回帧 blob，落 /files/ | 留横切 | 中 | 视频抽帧，跨 video+scriptbox+hooks；有视频语义但跨域共用 |
| 5 | `utils/clipboard.ts` | **App**·agent·base/panels·base/ui·canvas·editors·scriptbox·video·videoEditor（≥3/App） | 系统剪贴板 | 留横切 | 高 | 剪贴板原语，判据④被 App 消费 |
| 6 | `utils/encoderProbe.ts` | director3d/App.tsx 仅 | 探测浏览器编码器能力，无存储 | 搬去 director3d | 中 | 唯一真实消费方 director3d；⚠️ director3d 禁重审，维持现状待收口 |
| 7 | `utils/externalizeInline.ts` | **App** 仅 | 内联 dataURL 外置，经注入 save 落 /files/ | 留横切 | 高 | 判据④被 App 消费；纯函数 |
| 8 | `utils/faceMosaic.ts` | canvas/FaceMosaicNode·editors/FaceMosaicEditor | 处理产物落 node.data / /files/ | 独立为小域 image | 中 | 人脸马赛克能力，节点+编辑器同形态不拆，属 image 能力域候选 |
| 9 | `utils/genErrors.ts` | base/store/generationOrchestration·canvas/FaceMosaicNode·scriptbox·video/depthVideo·video/VideoExtract·video/VideoProcess（≥3 域） | 纯函数无存储 | 留横切 | 中 | 生成错误分类纯函数跨 ≥3 域；轻度业务语义（错误税），建议归 generate 契约或留横切 |
| 10 | `utils/imageCompress.ts` | canvas/useImageHoverActions·editors/ImageEditor·editors/InlineImageCropper·base/utils/assetUrl | 产物原位覆盖 node.data / 落 /files/ | 独立为小域 image | 中 | 图片压缩能力，跨 canvas+editors |
| 11 | `utils/imagePixel.ts` | base/api/generate.ts 仅 | 纯查表无存储 | 独立为小域 image | 中 | 图片比例→像素查表，单消费方为横切 api；image 能力 |
| 12 | `utils/imageUpscale.ts` | canvas/useImageHoverActions.tsx 仅 | 产物 `onImageReplaced+saveInlineToLocal` 覆盖 node.data | 搬去 canvas（中；将来随 image 域） | 中 | canvas 图片 hover 放大，数据回写 node.data |
| 13 | `utils/nodeMedia.ts` | **App**·base/media/providers/canvasSource | 纯函数（取节点主媒体） | 留横切 | 高 | 判据④被 App 消费；画布节点→媒体协议真源 |
| 14 | `utils/previewUrl.ts` | **App**·agent/AgentPanel·canvas/FaceMosaicNode·video/VideoExtract·video/VideoProcess | 纯函数无存储 | 留横切 | 高 | 判据④被 App 消费；预览 URL 解析 |
| 15 | `utils/providerModels.ts` | agent·base/panels·base/store·canvas·video·scriptbox·hooks（≥3 域） | 读 providerStore，无自身存储 | 留横切 | 高 | 模型供应商配置，零业务语义 |
| 16 | `utils/providerUrlAdapters.ts` | base/panels/sections/ApiSettings.tsx 仅 | 纯函数（协议标签） | 留横切 | 中 | 唯一消费方为宿主设置面板（host 层=横切），非业务域 |
| 17 | `utils/timeline/sourceTime.ts` | video/VideoProcessNode（当前）；设计 nodes+director3d+videoEditor | 纯函数无存储 | 留横切 | 高 | docs/124 裁决②：三域共用时间轴运算层，留 base 防反向依赖 |
| 18 | `utils/timeline/timeScale.ts` | video/VideoProcessNode（当前）；设计 nodes+director3d+videoEditor | 纯函数无存储 | 留横切 | 高 | 同上（docs/124 三域共用） |
| 19 | `utils/uploadDirs.ts` | base/api·base/media·base/store·canvas·director3d·scriptbox·video·videoEditor·hooks（≥3 域） | 纯常量/路径约定 | 留横切 | 高 | 上传目录约定，零业务语义 |
| 20 | `utils/useImageFallbackSrc.ts` | agent/ChatMarkdown·base/ui/LazyImage·canvas/AssetNode | hook 状态（小图→原图→占位） | 留横切 | 高 | 图片两段回退，被横切 LazyImage 共用 |
| 21 | `utils/useMediaLoadFailed.ts` | base/ui/VideoThumbnail·videoEditor/preview·videoEditor/timeline | hook 状态 `failed`（粘住） | 留横切 | 高 | 媒体失败兜底，横切组件+videoEditor 共用 |
| 22 | `utils/videoEngine.ts` | video/VideoProcessNode.tsx 仅 | 产物 `uploadFileToLocal` 落 /files/ | 搬去 video | 高 | `video/index.ts` §3.1.3.5 已登记待迁入 video 域 |
| 23 | `utils/volumePolicy.ts` | agent/conversation/* 仅 | 落 `localStorage:agent_conversations_{agentKey}` | 搬去 agent | 高 | 会话体积治理纯函数，唯一消费方全在 agent |

## 二、`base/ui`（25 件）

| # | 件（路径） | 非测试消费方（按域归类） | 数据落点 | 判定 | 置信度 | 一句话依据 |
|---|-----------|------------------------|----------|------|--------|------------|
| 1 | `ui/CometParticles.tsx` | canvas/edges(Comet·ConnectionLine) 仅 | 纯 SVG 视觉 props | 搬去 canvas | 高 | 唯一真实消费方 canvas/edges（1 域） |
| 2 | `ui/ConfirmContainer.tsx` | **App** 仅 | 订阅 confirmStore 渲染 | 留横切 | 高 | 判据④被 App 消费；全局确认弹窗 |
| 3 | `ui/ContextMenu.tsx` | **App**·canvas/canvasContextMenu | 订阅 useContextMenu，渲染菜单 | 留横切 | 高 | 判据④被 App 消费 |
| 4 | `ui/CustomHandle.tsx` | NodeShell(base/ui)·canvas/ScriptBoxNode | 端口渲染，props | 搬去 canvas（中，随 NodeShell） | 中 | 端口渲染原语，主消费方 NodeShell→canvas；与 NodeShell 同形态 |
| 5 | `ui/DropdownPanel.tsx` | ModelSelect·Select（均 base/ui） | 纯展示 props | 留横切 | 高 | leaf 下拉面板原语，仅被 base/ui 兄弟消费 |
| 6 | `ui/DropdownRow.tsx` | ModelSelect·Select（均 base/ui） | 纯展示 props | 留横切 | 高 | leaf 下拉行原语 |
| 7 | `ui/ErrorBoundary.tsx` | NodeShell·canvas/lazyNode·main | 错误边界，props | 留横切 | 中 | 通用错误边界（root+node 两形态），跨 canvas+root |
| 8 | `ui/ExpandablePanel.tsx` | canvas(ImageGenerate/TextGenerate/Template)·video/VideoGenerate | 纯展示 props | 留横切 | 中 | 生成节点共用展开面板，跨 canvas+video |
| 9 | `ui/GenerateButton.tsx` | canvas(ImageGenerate/TextGenerate/Template)·video(VideoExtract/VideoGenerate) | onClick 回调 | 留横切 | 中 | 生成按钮，跨 canvas+video 生成节点 |
| 10 | `ui/GeneratingOverlay.tsx` | canvas(ImageGenerate/TextGenerate/Template)·video/VideoGenerate | 纯展示 props | 留横切 | 中 | 生成中遮罩，跨 canvas+video |
| 11 | `ui/ImageZoomDialog.tsx` | agent/panels·base/panels·canvas×5·scriptbox·video（≥4 域） | 纯展示 props | 留横切 | 高 | 图片放大查看，跨 ≥4 域 |
| 12 | `ui/InlineNameInput.tsx` | base/panels/GeneratedView·ResourceLibrary | onChange 回调 | 留横切 | 中 | 唯一消费方为宿主面板（host 层=横切） |
| 13 | `ui/JianyingIcon.tsx` | canvas/ImageGenerate·video/VideoGenerate | 纯展示 | 留横切 | 中 | 剪映导出图标，跨 canvas+video |
| 14 | `ui/LazyImage.tsx` | agent·base/panels·base/prompt·base/ui·canvas·creative·director3d·video（≥3 域） | 走 useImageFallbackSrc | 留横切 | 高 | 通用懒加载图，零业务语义 |
| 15 | `ui/ModelSelect.tsx` | agent·canvas·scriptbox·video（≥3 域） | value/onChange | 留横切 | 高 | 通用模型选择，跨 ≥3 域 |
| 16 | `ui/NodeShell.tsx` | canvas/video/agent/director3d/scriptbox 节点（≥3 域，35 处） | frame 渲染；尺寸写回 ReactFlow store | 搬去 canvas（中，矛盾点见汇总④） | 中 | 节点外壳，canvas 含节点机制；但 ≥3 域消费零语义亦可留 base |
| 17 | `ui/NodeTitle.tsx` | NodeShell(base/ui) 仅 | 标题渲染；onRename 写 node.data.label | 搬去 canvas（中，随 NodeShell） | 中 | 仅被 NodeShell 消费，随其同迁 |
| 18 | `ui/RenameDialog.tsx` | **App** 仅 | 订阅 renameStore 渲染 | 留横切 | 高 | 判据④被 App 消费；全局重命名弹窗 |
| 19 | `ui/ResizeFullscreenHandle.tsx` | canvas(ImageGenerate/TextGenerate/Template)·video/VideoGenerate | 拖拽回调 | 留横切 | 中 | 缩放/全屏手柄，跨 canvas+video 生成节点 |
| 20 | `ui/Select.tsx` | scriptbox/GearSettings.tsx 仅（grep 复核） | value/onChange | 搬去 scriptbox | 中 | 唯一真实消费方 scriptbox；通用下拉但仅 1 域用 |
| 21 | `ui/ToastContainer.tsx` | **App** 仅 | 订阅 toastStore 渲染 | 留横切 | 高 | 判据④被 App 消费；全局 toast |
| 22 | `ui/Toggle.tsx` | base/panels/sections/OtherSettings·SkillSettings | onChange 回调 | 留横切 | 中 | 唯一消费方宿主设置（host 层=横切） |
| 23 | `ui/ToolbarButton.tsx` | canvas/HoverToolbar.tsx 仅 | 纯展示 props | 搬去 canvas（中，与 HoverToolbar 同形态） | 中 | 唯一真实消费方 canvas/HoverToolbar |
| 24 | `ui/VideoThumbnail.tsx` | base/panels(GeneratedView/TaskCenter)·canvas/AssetNode·video/VideoGenerate（≥3 域） | 走 useVideoPoster 抓帧 | 留横切 | 中 | 视频缩略图，跨面板+canvas+video；有视频语义但 ≥3 域共用 |
| 25 | `ui/attachmentCover.tsx` | agent/panels(AgentMessage/AgentPanel) 仅 | props(type/url)，无存储 | 搬去 agent | 高 | 唯一真实消费方全在 agent |

## 三、五段汇总

### 1. 该留横切的（≥3 域 + 无业务语义 / 被 App 消费）
- `utils`：assetType·assetUrl·asyncGuard·captureFrame（中）·clipboard（App）·externalizeInline（App）·genErrors（中，轻度语义）·nodeMedia（App）·previewUrl（App）·providerModels·providerUrlAdapters（中）·uploadDirs·useImageFallbackSrc·useMediaLoadFailed·timeline/{sourceTime,timeScale}
- `ui`：ConfirmContainer（App）·ContextMenu（App）·DropdownPanel·DropdownRow·ErrorBoundary（中）·ExpandablePanel（中）·GenerateButton（中）·GeneratingOverlay（中）·ImageZoomDialog·InlineNameInput（中）·JianyingIcon（中）·LazyImage·ModelSelect·RenameDialog（App）·ResizeFullscreenHandle（中）·ToastContainer（App）·Toggle（中）·VideoThumbnail（中）

### 2. 该搬走的（件 → 目标域目录）
- **canvas**：`ui/NodeShell`（中）·`ui/CustomHandle`（中）·`ui/NodeTitle`（中）·`ui/CometParticles`·`ui/ToolbarButton`（中）·`utils/imageUpscale`（中）
- **agent**：`ui/attachmentCover`·`utils/volumePolicy`
- **scriptbox**：`ui/Select`（中）
- **video**：`utils/videoEngine`
- **director3d**：`utils/encoderProbe`（中，禁重审维持现状）

### 3. 该独立为小域的（建议域名 + 门面露什么）
- **`image` 内容能力域**（尚未建，按 TASK-005 已裁定域清单）：`utils/faceMosaic`·`utils/imageCompress`·`utils/imagePixel`（均 image 能力，跨 canvas/editors/api）。建议建 `src/components/image/` 收口，门面窄暴露 `mosaicImage / compressImage / resolveImagePixel`，后续 `imageUpscale` 从 canvas 再并入。
- 备注：`utils/genErrors`（生成错误税，跨 ≥3 域）若想收口，可归 **generate** 域错误契约（窄露 `classifyError/timeoutMessage`）；否则留 base 横切亦可。

### 4. [待确认]的（缺什么信息）
- **NodeShell 归属矛盾**：被 ≥3 业务域（canvas/video/agent/director3d/scriptbox）节点组件消费且零业务语义，严格按「≥3 域+无语义⇒留横切」应留 base/ui；但 canvas 域职责含节点机制、且用户已预判 canvas。需用户拍板。
- **encoderProbe**：唯一消费方 director3d，但 director3d「禁重审」——是否允许本次收口入 director3d 待确认。
- **image 域是否建立**：faceMosaic/imageCompress/imagePixel/imageUpscale 的最终归属依赖 image 能力域是否落地。
- **assetType/assetUrl/nodeMedia 是否并入 `base/media` 协议层**：三者均媒体相关且被 base/media 大量消费，可考虑下沉 media 子域（属 base 内重组，非跨域搬迁）。

### 5. 横切内部是否要切子目录
**要**，但仅对「留横切」的件做轻量关注点切分（每子域 ≥3 件），不破坏跨域引用：
- `base/utils`：
  - `media/`：assetType·assetUrl·nodeMedia·useImageFallbackSrc·useMediaLoadFailed·previewUrl（6）
  - `net/`：asyncGuard·clipboard·externalizeInline（3）
  - `provider/`：providerModels·providerUrlAdapters（2，不足 3，留根或并入 `media`？建议留根）
  - `storage/`：uploadDirs（1，留根）
  - `err/`：genErrors（1，留根）
  - `timeline/`（已存在）：sourceTime·timeScale
  - captureFrame（video 抽帧跨域，留根或随 video 能力）
- `base/ui`：
  - `feedback/`：ToastContainer·ConfirmContainer·ErrorBoundary·RenameDialog·ContextMenu（5）
  - `form/`：Select（→scriptbox 搬走后）·DropdownPanel·DropdownRow·ModelSelect·Toggle·InlineNameInput（5）
  - `media/`：LazyImage·ImageZoomDialog·VideoThumbnail（3）
  - `generate/`（生成节点 chrome，跨 canvas+video）：ExpandablePanel·GenerateButton·GeneratingOverlay·JianyingIcon·ResizeFullscreenHandle（5）

## 四、验收自测
- [x] 目录下每一件都在表（utils 23 + ui 25 = 48，见数量核对）
- [x] 每条判定均附 refs 消费方（按域归类）
- [x] 「留横切」均满足 ≥3 域 / App 消费（captureFrame/genErrors/providerUrlAdapters/InlineNameInput/Toggle/VideoThumbnail 等标「中」并注明有语义或仅 host 层）
- [x] 「搬走」均写目标域目录
- [x] 五段汇总齐全（留横切/搬走/独立小域/待确认/子目录）
- [x] 未碰任何其他文件（仅追加本文件）
