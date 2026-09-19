# TASK-005 · 核实base横切三目录放错件

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-005-核实base横切三目录放错件.md`。碰任何其他文件（含源码）视为任务失败。

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
- `src/components/base/ui/NodeShell.tsx`（refs 显示消费方全在 canvas，约 35 处）
- `src/components/base/ui/CometParticles.tsx`（消费方在 canvas/edges）
- `src/components/base/ui/attachmentCover.tsx`（消费方全在 agent）
- `src/components/base/ui/Select.tsx`（消费方在 scriptbox）
- `src/components/base/utils/volumePolicy.ts`（消费方在 agent）
- `src/components/base/core/videoEditorKeys.ts`（消费方在 videoEditor）
- `src/components/base/core/agentKeys.ts`（消费方 = App.tsx + agent 5 处；**我已判它是横切契约，不搬**）
- `src/components/base/utils/imageUpscale.ts`（消费者在 canvas/nodes，但可能是图片能力）
- `src/components/base/utils/videoEngine.ts`（消费者在 canvas/nodes，但可能是视频能力）
- `src/components/base/utils/timeline/sourceTime.ts` 与 `timeScale.ts`（可能是视频能力）
- `src/components/base/utils/useMediaLoadFailed.ts`（消费者含 videoEditor）

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `src/components/base/ui/NodeShell.tsx` |  |  |  |  |  |  |
| 2 | `src/components/base/ui/CometParticles.tsx` |  |  |  |  |  |  |
| 3 | `src/components/base/ui/attachmentCover.tsx` |  |  |  |  |  |  |
| 4 | `src/components/base/ui/Select.tsx` |  |  |  |  |  |  |
| 5 | `src/components/base/utils/volumePolicy.ts` |  |  |  |  |  |  |
| 6 | `src/components/base/core/videoEditorKeys.ts` |  |  |  |  |  |  |
| 7 | `src/components/base/core/agentKeys.ts` |  |  |  |  |  |  |
| 8 | `src/components/base/utils/imageUpscale.ts` |  |  |  |  |  |  |
| 9 | `src/components/base/utils/videoEngine.ts` |  |  |  |  |  |  |
| 10 | `src/components/base/utils/timeline/sourceTime.ts` |  |  |  |  |  |  |
| 11 | `src/components/base/utils/useMediaLoadFailed.ts` |  |  |  |  |  |  |

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

- 这三个目录是**横切层**：被 ≥3 域消费且**无业务语义**的件**应该留在这里，不要搬**。判断重点是：**它是不是其实只服务一个域？**
- 我已查证的（请复核）：`NodeShell`/`CometParticles` → canvas；`attachmentCover`/`volumePolicy` → agent；`videoEditorKeys` → videoEditor；`Select` → scriptbox。
- **我判为不搬的**：`agentKeys`（跨 App + agent，§7 已裁定横切契约）。
- **请特别处理这三件，它们可能是"内容能力"的件，但因 `canvas/nodes/` 现在混装所有节点而判不准**：`imageUpscale`（图片？）· `videoEngine`（视频？）· `timeline/*`（视频时间轴？）。请追它们的数据流与界面位置，给出你的判断；若确实判不准，写明"需等 canvas/nodes 拆开后才能定"。
- **请另外自行扫一遍**这三个目录，找出**我清单里没有的**"其实只服务一个域"的件（这才是探索的重点）。

---

# 审计结果（AI 填）

> 方法：对每件跑 `node scripts/mv-sync-refs.mjs refs`，取「① 模块引用」段的非测试消费方（字符串残留段多为 `Select`/`selected` 子串误命中，已忽略）；再读头注释追数据流；界面位置以 NodePalette `paletteNodes` 的 `cat` 为权威。所有结论均附实测 `refs`。

## 一、清单 11 件判定表

| # | 件（当前路径） | 非测试消费方（实测 refs） | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|--------|------------|
| 1 | `src/components/base/ui/NodeShell.tsx` | canvas/nodes/*（Asset/Grid*/Group/Image*/Text/ScriptBox/Loop/Panorama/Director3D/Template 等）、video/nodes/*（VideoGenerate/Extract/Process）、agent/canvas/agentCanvasHost、director3d（共 35 处非测试） | 自身不持数据；frame 渲染，尺寸经 `setNodes` 写回 ReactFlow store；由消费方传 id/sizeMode/children | 所有画布节点的外壳（标题栏/端口/缩放/锁定） | **canvas** | 中 | 消费方全是节点渲染组件，且 canvas 域职责明含「节点机制」；⚠️ 但此件被 ≥3 域（canvas/video/agent/director3d/scriptbox）消费且零业务语义，按 §横切特别提示亦可留 base/ui——**这是需用户拍板的矛盾点**（见汇总③） |
| 2 | `src/components/base/ui/CometParticles.tsx` | canvas/edges/Comet.tsx、canvas/edges/ConnectionLine.tsx（4 处含测试） | 纯 SVG 视觉，props(pathId/uid) 传入，无存储 | 画布连线/拖拽时的粒子流光 | **canvas** | 高 | 唯一真实消费方是 canvas/edges（1 域），纯展示无业务语义 → 随边机制归 canvas |
| 3 | `src/components/base/ui/attachmentCover.tsx` | agent/panels/AgentMessage.tsx、agent/panels/AgentPanel.tsx | props(type/url) 传入；视频封面经 `useVideoPoster` 抓帧（blob 临时，不持久） | Agent 面板内发送前 chip 与发送后气泡的媒体封面 | **agent** | 高 | 唯一真实消费方全在 agent/panels（1 域），无自身存储 |
| 4 | `src/components/base/ui/Select.tsx` | scriptbox/GearSettings.tsx（唯一真实 import，已用 grep 复核无其他方） | props(value/onChange/options)；选中值由 GearSettings 持有，无自身存储 | 剧本盒子「少数固定选项」下拉（如齿轮设置） | **scriptbox** | 中 | 实测唯一消费方只有 scriptbox/GearSettings；但它是通用下拉原语、未来多域可能复用——若届时复用到 ≥2 域则应留 base/ui |
| 5 | `src/components/base/utils/volumePolicy.ts` | agent/conversation/conversationSnapshot.ts、agent/conversation/conversationState.ts（4 处含测试） | 落盘投影前对整包序列化体积治理，最终写 `localStorage: agent_conversations_{agentKey}`（经 conversationState.contentSet） | Agent 会话写盘/序列化路径（体积护栏） | **agent** | 高 | 唯一真实消费方全在 agent/conversation（1 域），头注释明写「AI 助手会话整包」 |
| 6 | `src/components/base/core/videoEditorKeys.ts` | videoEditor/engine/services/storage/service.ts（2 处含测试） | 键构造器真源；写入 videoEditor 各 storage 键（video_editor_*） | 视频剪辑器工程读写 | **videoEditor** | 高 | 唯一真实消费方是 videoEditor/engine（1 域），头注释自陈「视频剪辑器存储键唯一真源」 |
| 7 | `src/components/base/core/agentKeys.ts` | App.tsx、agent/conversation/conversationState.ts、agent/panels/AgentPanel.tsx、agent/runtime/agentCore.ts、agent/runtime/projectMemoryStore.ts、agent/runtime/useAgentChat.ts（7 处含测试） | 键构造器真源；写入 agent 各 localStorage 键 | App 装配层 + Agent 运行时/面板 | **不搬（留 base/core）** | 高 | 判据④：被 App.tsx 直接消费 ⇒ 横切；且 §7 已裁定横切契约（与用户一致） |
| 8 | `src/components/base/utils/imageUpscale.ts` | canvas/nodes/useImageHoverActions.tsx（3 处含测试） | 纯浏览器 canvas 放大；产物经 `onImageReplaced + saveInlineToLocal` 原位覆盖 `node.data`，blob 落 /files/ | 画布图片节点 hover 工具条的「放大」动作 | **canvas**（当前）；待 canvas/nodes 拆出 image 域后应随 ImageGenerate 走 | 中 | 当前唯一真实消费方是 canvas/nodes 的 image hover 动作，数据回写 node.data ⇒ canvas；但本质是「图片能力」，等 ImageGenerate 节点归位到 image 域时该件应一并迁（用户已预警此件判不准） |
| 9 | `src/components/base/utils/videoEngine.ts` | video/nodes/VideoProcessNode.tsx（3 处含测试） | 视频处理引擎；产物经 `uploadFileToLocal` 持久落 /files/ | 视频处理节点（trim/拼接/抽帧/GIF） | **video** | 高 | 唯一真实消费方 video/nodes/VideoProcessNode；且 `src/components/video/index.ts` §3.1.3.5 已登记为「待迁入」video 域 |
| 10 | `src/components/base/utils/timeline/sourceTime.ts` | video/nodes/VideoProcessNode.tsx（2 处含测试） | 纯函数，无存储 | 视频处理节点的「源媒体时间↔时间轴时间」换算 | **不搬（留 base/utils/timeline）** | 高 | 头注释明写 docs/124 裁决②：时间轴运算层为 nodes+director3d+videoEditor「三域共用」，刻意留 base 以避免 base→域反向依赖；当前仅 VideoProcessNode 消费，但设计即横切 |
| 11 | `src/components/base/utils/useMediaLoadFailed.ts` | base/ui/VideoThumbnail.tsx、videoEditor/ui/editor/panels/preview/index.tsx、videoEditor/ui/editor/panels/timeline/timeline-element.tsx（4 处含测试） | hook 内部 `failed` 状态（粘住），仅 `logger.warn` 留痕，无持久化 | 任意媒体(img/video/audio)加载失败的可见化兜底 | **不搬（留 base/utils）** | 高 | 消费方之一 base/ui/VideoThumbnail 本身是横切媒体出口；被「横切组件 + videoEditor」共用 ⇒ 通用兜底，留 base |

## 二、三段汇总

### 1. 该搬的（件 → 目标目录，按目标目录分组）

- **canvas**
  - `base/ui/NodeShell.tsx` → `canvas/`（置信度中；矛盾点见③）
  - `base/ui/CometParticles.tsx` → `canvas/edges/`（高）
  - `base/utils/imageUpscale.ts` → `canvas/`（中；将来随 image 域再迁）
- **agent**
  - `base/ui/attachmentCover.tsx` → `agent/`（高）
  - `base/utils/volumePolicy.ts` → `agent/`（高）
- **scriptbox**
  - `base/ui/Select.tsx` → `scriptbox/`（中）
- **videoEditor**
  - `base/core/videoEditorKeys.ts` → `videoEditor/`（高）
- **video**
  - `base/utils/videoEngine.ts` → `video/`（高；index.ts 已登记待迁入）

### 2. 不该搬的（留 base，附理由）

- `base/core/agentKeys.ts` —— 判据④：被 App.tsx 直接消费 ⇒ 横切；§7 已裁定横切契约（与用户一致）。
- `base/utils/timeline/sourceTime.ts` —— docs/124 裁决②：三域共用时间轴运算层，留 base 防反向依赖。
- `base/utils/timeline/timeScale.ts` —— 同上（头注释自陈 nodes+director3d+videoEditor 三域共用），留 base。
- `base/utils/useMediaLoadFailed.ts` —— 被横切组件 VideoThumbnail + videoEditor 共用，通用媒体失败兜底，留 base。
- `base/utils/previewUrl.ts`（清单外，见③）—— 被 App.tsx 直接消费 ⇒ 判据④横切，留 base。
- `base/ui/GenerateButton.tsx` / `GeneratingOverlay.tsx` / `JianyingIcon.tsx` / `ResizeFullscreenHandle.tsx`（清单外）—— 真实消费方均为 `canvas/nodes` 生成类节点 + `video/nodes` 生成类节点（跨 canvas+video 两域），属生成类节点共用 chrome，留 base/ui。
- `base/ui/ModelSelect.tsx`（清单外）—— 消费方 agent + canvas + scriptbox + video 四域，通用模型下拉，留 base/ui。
- `base/ui/ImageZoomDialog.tsx`（清单外）—— 消费方 agent/panels + base/panels + canvas/nodes×5 + scriptbox + video（≥4 域），通用图片放大查看，留 base/ui。
- `base/utils/providerModels.ts`（清单外）—— 24 处消费方跨 agent/base-panels/store/canvas/scriptbox/video/hooks，通用模型配置，留 base。
- `base/utils/faceMosaic.ts`（清单外）—— 消费方 canvas/nodes/FaceMosaicNode + editors/FaceMosaicEditor（同一「人脸马赛克」特性的节点+编辑器），跨 canvas+editors，留 base。
- `base/utils/captureFrame.ts`（清单外）—— 消费方 videoEngine + video/depthVideo + video/nodes×2 + scriptbox + hooks/useVideoPoster（video+scriptbox+hooks），跨域，留 base。
- `base/utils/imageCompress.ts`（清单外）—— 消费方 canvas/nodes/useImageHoverActions + editors/ImageEditor + editors/InlineImageCropper（cross+editors），通用图片压缩，留 base。
- `base/utils/imagePixel.ts`（清单外，见③）—— 唯一真实消费方 base/api/generate.ts（横切 api），留 base。

### 3. 新发现的问题 / 需用户拍板

- **NodeShell 的归属矛盾（最重要）**：它被 ≥3 业务域（canvas/video/agent/director3d/scriptbox）的节点组件消费且零业务语义，严格按 §横切特别提示「被 ≥3 域消费且无业务语义的件应留 base」应**留 base/ui**；但 canvas 域职责明含「节点机制」，且用户已预判 canvas。二者冲突。个人倾向：**canvas**（因 canvas 拥有节点渲染机制，跨域消费按补充规则走 canvas 门面不改归属），但请用户确认。
- **`encoderProbe.ts`（清单外，base/utils）**：实测唯一真实消费方是 `director3d/App.tsx`（1 域），属单域件；但用户背景写明 director3d 为「例外，禁重审」，故本次不提议搬移，仅标出——它事实上是 director3d 的编码器探针，将来若要收口应入 director3d。
- **`imagePixel.ts`（清单外，base/utils）**：唯一真实消费方 `base/api/generate.ts`（横切 api），本质「图片比例×清晰度→像素」查表，是 image 能力；当前因仅被横切 api 消费而留 base。若未来建 image 域，此件与 imageUpscale/imageCompress 应一并归入。
- **video 域「待迁入」登记与本次核实出入**：`src/components/video/index.ts` §3.1.3.5 登记 `base/utils/{videoEngine,captureFrame}`、`base/utils/timeline/{sourceTime,timeScale}`、`base/ui/VideoThumbnail` 为待迁入；本次核实 videoEngine 确属 video 域（已列入「该搬」），但 captureFrame/timeScale/sourceTime/VideoThumbnail 因跨域（含 videoEditor/director3d/scriptbox/hooks）应**留 base**，与该 index.ts 的「待迁入」登记存在出入，建议更新 video/index.ts 的登记说明。
- **≥2 域消费的交叉件**：列表内真正被 ≥2 不同业务域消费的是 `NodeShell`（canvas/video/agent/director3d/scriptbox，已讨论）与 `useMediaLoadFailed`（base 横切 + videoEditor，留 base）；其余均为单域（应搬）或被 App 横切（agentKeys/previewUrl，留 base）。无「因被 B 域消费而误搬」的情形——跨域消费按补充规则走门面，不改变上述单域件归属。

## 三、验收自测

- [x] 清单 11 件 7 列全填，无空格
- [x] 每条归属均附 refs 实测消费方 + 数据落点
- [x] 中/低置信度件（NodeShell/Select/imageUpscale）已写明缺什么/矛盾点
- [x] 已回答 ≥2 域消费件（NodeShell、useMediaLoadFailed）及其判法
- [x] 三段汇总齐全（该搬/不该搬/新发现）
- [x] 未碰任何其他文件（仅追加本文件）
