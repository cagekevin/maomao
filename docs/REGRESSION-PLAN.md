# 猫猫画布 · 全站功能回归测试策划（REGRESSION-PLAN）

> 状态：规划中（测试点全景 + 项目设计）。尚未落地自动化用例。
> 读者：下一个 AI / 测试执行者。本文是「测什么、怎么测、怎么组织」的总纲。
> 关联：`docs/TESTING.md`（现有测试地基权威）、`CLAUDE.md`（工程红线）。
> 最后更新：2026-08-16

---

## 〇、为什么需要这份策划

现有测试地基（`scripts/`）只覆盖「能编译 / 4 个节点能 SSR 渲染 / Agent 工具能调」的**冒烟级**门槛，远不够回归整站功能。

猫猫画布是一个**节点式 AI 创作画布**：用户在画布上拖入节点（生图/生视频/文本/切图/拼图/剧本盒子…），连线表达数据流，配参数后一键生成，结果存任务中心 + 本地磁盘。功能面极广：

- **17 种节点**（14 `paletteNodes` + 3 QWE 隐藏节点；GhostTarget/ConnectionLine/CustomEdge 非节点），每种节点有 3~12 个独立参数（模型/比例/分辨率/时长/切分模式…）→ 参数组合爆炸。
- **画布交互**：拖拽/连线/编组/锁定/折叠/快捷键/右键菜单/AI 助手驱动。
- **管线契约**：连线自动把「上游产出」传给「下游参考输入」（图片/文本/视频/音频四类聚合）。
- **生成链路**：节点生成 → localTool 异步转同步 → 网关 → Lovart，结果落盘 + 任务中心。
- **设置面板 / 素材库 / 任务中心 / AI 助手 / 多项目 / 云端同步** 等横切模块。

朴素枚举「每个节点的每个参数 × 每个交互」即可达**数千个测试点**。本文把它们整理成**可穷举、可分层、可自动化**的结构，作为后续写自动化用例（Playwright / Vitest / Node 工具层）的总入口。

> **覆盖核对（2026-08-16 第五轮）**：前四轮后继续深挖横切/纯逻辑层，发现大量遗漏并已补入：§2.17 横切纯逻辑（mediaType/useSizeSync/useSyncNodeData/scriptBoxPrompts 全纯函数/providerModels/imageUrl）、§2.18 素材库数据层（assetStore FOLDERS/CRUD/seed）、§2.19 Skill 系统（skillStore builtin/custom/usage + 三阶段注入）、§2.20 Provider 系统（providerStore CRUD/test/fetchModels/configBasePut/refFormat）。计数更新为 **~1250+ 基础用例**。至此已通读 `src/components/**`（17 节点 + base/* 全部 hooks/store + director3d/* + scriptbox/*）、`localTool/src/**`（50+ handler）、`apimart-gateway/*`，覆盖已较完整。

---

## 一、测试分层（金字塔，从快到慢）

| 层 | 范围 | 工具 | 速度 | 现状 |
|---|---|---|---|---|
| **L0 冒烟** | 编译/契约/React 单实例/chunk | `npm run test:smoke` + `npm run build` | 秒 | ✅ 已有 |
| **L1 节点静态回归** | 每个节点 SSR 渲染不崩 + 关键结构 class | `npm run test:regression` | 秒 | ✅ 13 节点已覆盖（director3dNode 依赖 WebGL 由 L4 覆盖） |
| **L2 纯逻辑单测** | 管线契约 / 编组算法 / URL 归一 / 模型解析 / 历史栈 / 比例像素表 / 剧本盒纯函数 | Vitest（`npm run test:unit`） | 秒 | ✅ 13 文件 102 测试 + L3 共 130 测试全过 |
| **L3 工具层单测** | 24 个画布 Agent 工具（建/删/改/连/读/生成/编排） | Vitest 调 `buildCanvasAgentTools` | 秒 | ✅ 28 测试全过 |
| **L4 画布 E2E** | 真实浏览器：拖拽/连线/编组/折叠/快捷键/右键/全局操作 | Playwright（`npm run test:e2e`，已配骨架） | 分 | 🔶 骨架已建（nodes.render/canvas.interactions/settings/scriptBox 4 spec，需 `playwright install` 后本地跑） |
| **L5 生成链路 E2E** | 真生成：节点生成→任务中心→落盘→刷新不破图 | Playwright + 后端（需 VPN） | 分~分钟 | 🔲 待建（需 Lovart，CI 缺失） |
| **L6 后端契约** | localTool 路由 / 网关别名 / 三层一致性 | `localTool` 自身测试 + `task-inspect` | 秒 | ✅ localTool 有，网关部分 |

> **原则**：能落 L1~L3 的绝不依赖 L4（浏览器慢、易碎）；L5 仅在开 VPN + 有 Lovart key 时跑，CI 跳过，本地手动。

---

## 二、测试点全景（按模块枚举，目标穷举）

### 2.1 节点体系（核心，约 60% 测试点）

**节点注册表**（来自 `NodePalette.jsx` + `App.jsx nodeTypes`）：

- **真实节点共 17 型** = `paletteNodes`（14 型，见下表）+ `HIDDEN_TOP_LEVEL_NODES`（QWE 3 型：textNode/promptNode/discountVideoNode，从子分类隐藏但可创建、AI 工具校验依赖）。
- ⚠️ GhostTarget / ConnectionLine / CustomEdge **不是节点**，是连线/交互组件，已在 §2.11 单列，勿算进节点数。
- `director3dNode` 实为 `director3d/` 子工程入口（见 §2.13）。

| # | type | 中文 | 分类 | 关键参数（需逐参数覆盖） |
|---|---|---|---|---|
| 1 | `textNode` | 文本 | 文本 | text、字体/对齐（如有）、锁定（Q 快捷建） |
| 2 | `promptNode` | 图片/生图 | 图片 | prompt、selectedModel、aspectRatio、resolution、参考图(images)、negPrompt、quality（W 快捷建） |
| 3 | `discountVideoNode` | 特惠视频 | 视频 | prompt、model、ratio、seconds、resolution、refImages（E 快捷建） |
| 4 | `imageNode` | 图片视频素材 | 图片 | images[]、mediaType、拖入/粘贴/上传 |
| 5 | `imageBoxNode` | 图片盒子 | 图片 | images[]、activeIndex、expanded、多图切换、复制/下载 |
| 6 | `gridSplitNode` | 图片切分 | 图片 | rows、cols、splitMode(grid/lasso/custom)、hLines、vLines、lassoShapes、titlePattern、sendToImageBox |
| 7 | `gridMergeNode` | 图片拼图 | 图片 | mergeMode(grid/long)、rows、cols、cellSize、aspectRatio、longDirection、longGap、longTargetSize、autoSize、bgColor、overlayState |
| 8 | `panoramaNode` | 全景图 | 图片 | panoType(sphere/cylinder)、highQuality、aspectRatio、imageUrl |
| 9 | `director3dNode` | 3D 导演台 | 图片 | 3D 场景工程（director3d/，见 §2.13） |
| 10 | `faceMosaicNode` | 人脸打码 | 图片 | mode(mosaic/blur)、strength、color、imageUrls[] |
| 11 | `videoExtractNode` | 视频抽帧 | 视频 | videoUrl、videoName、抽帧数/间隔 |
| 12 | `videoProcessNode` | 视频处理 | 视频 | mode(trim/resize/extractAudio)、sourceOrder、timelineTracks、trimStart、trimEnd、resizeWidth、resizeHeight、targetFps、audioFormat |
| 13 | `group` | 编组 | 其他 | 子节点聚合、锁定、折叠、作为连线出口 |
| 14 | `scriptBoxNode` | 剧本盒子 | 其他 | step（三步状态机）、story、globalStyle、shotCount、shots[]、assets[]（has 字段）、资产模型设置、镜头端口、4 种 IMAGE_GEN_TYPES |

**每个节点的测试矩阵**（L1/L2/L4 共用）：
- [ ] 创建后 SSR 渲染不崩（L1 结构 class：`group/node`、`bg-surface-raised`、`rounded-xl`、`border-edge`、`cust-handle`）
- [ ] 每个**独立参数**改值 → `setNodes` 不可变写回、下游 `useSyncNodeData` 收到（`data.xxx` 变更）
- [ ] 比例 `aspectRatio` 切换 → 节点尺寸按 `useSizeSync` 同步（width-fixed / area-fixed）
- [ ] 选中态 → 边框 `border-edge-strong`、显示 NodeResizer、标题右侧操作组
- [ ] 端口数/位置正确（`showHandles` 默认左右；剧本盒子每镜头/输出口）
- [ ] 删除 → 连带边清理、撤销栈记录
- [ ] 锁定 → `draggable/selectable=false` + 渲染锁图标（走 `lockNode` 工具或右键）
- [ ] **默认尺寸契约**（`App.addNode` 分支）：promptNode 420×420、gridSplitNode 280px、videoProcessNode 520×620、panoramaNode 640×360、director3dNode 420×300

### 2.2 画布全局操作（App.jsx 能力区，L4 为主）

- [ ] **addNode(type,pos,data,connection)**：普通建节点；从端口拖出建节点时自动建边；**脚本盒 shot- 端口预填**（promptNode 填 aspectRatio、discountVideoNode 填 size/seconds/durationFromScript）
- [ ] **deleteNode** / 连带边清理 / 入历史栈
- [ ] **selectAll**（Ctrl+A，节点+边 selected）
- [ ] **duplicateSelected**（Ctrl+D，克隆节点偏移 40px）
- [ ] **copySelectedNodes**（Ctrl+C，`mutiwindow-nodes` JSON 写入剪贴板，剥离函数/运行时字段、只连内部边）
- [ ] **copyNodeImage**（复制节点图片为 image/png 到系统剪贴板）
- [ ] **pasteNodeGroup**（Ctrl+V 解析 `mutiwindow-nodes` 重建节点+边、整体居中包含点落下、原 id→新 id 映射）
- [ ] **groupSelected**（Ctrl+G）/ **ungroupSelected**（Ctrl+Shift+G，见 §2.2 快捷键）
- [ ] **arrangeCanvas**（Ctrl+L）：排列前快照 → dagre 写回 → fitView → 弹「保留/还原」确认（`ArrangeConfirm`）
- [ ] **handleClearCache**：把节点 data 内联 `data:` 资源外置为 `/files/` URL（`saveInlineToLocal`，失败保留原图不丢）
- [ ] **节点拖拽移动**（drag-handle）

### 2.3 画布交互 / 快捷键（L4 E2E 为主）

**快捷键**（`useCanvasShortcuts` + `useCanvasHistory`），覆盖每个 handler 与守卫：
- [ ] Q/W/E 快捷建 textNode/promptNode/discountVideoNode（无修饰键）
- [ ] Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做（MAX=15 栈、分支截断、600ms 抑制窗口）
- [ ] Ctrl+A 全选 / Ctrl+D 克隆 / Ctrl+L 自动排版
- [ ] **Ctrl+G 编组 / Ctrl+Shift+G 取消编组**（首版遗漏）
- [ ] **守卫逻辑**：输入框/可编辑元素内按键跳过；有文本选中时纯文本类快捷键跳过
- [ ] **右键菜单**（4 类触发，`useContextMenu` + `ContextMenu`）：
  - [ ] onPaneContextMenu（空白处右键→建节点/粘贴/整理）
  - [ ] onNodeContextMenu（节点右键→复制/克隆/锁定/删除/编组）
  - [ ] onSelectionContextMenu / onSelectionEnd（多选框右键，选中>1 弹）
  - [ ] openConnection（端口拖到空白→弹连接菜单，选下游类型自动连线）
  - [ ] 坐标换算：client→container 相对坐标（防溢出）

**连线 / 视图交互**：
- [ ] **连线**：端口拖出→目标节点→建 edge（`onConnect` 补唯一 id，无 id 边红线）
- [ ] **从端口拖到空白**→ ghost-target + ghost-edge + 连接菜单（`onConnectEnd`，id 时间戳唯一、按前缀 `ghost-edge-` 清理）
- [ ] **删除连线**（CustomEdge ✕ 按钮 / `delete_edge` 工具，删除后入撤销栈）
- [ ] **缩放/平移/适配视口**（zoomIn/zoomOut/fitView/focusNode、CanvasToolbar 缩放%点击回 100%）
- [ ] **小地图开关** / **性能模式开关**（performanceMode，Zap 黄高亮）
- [ ] **空画布引导**（EmptyCanvasGuide 添加）

### 2.4 管线契约（L2 纯逻辑，最高价值，最易回归）

来自 `useConnectedInputs.js` 的 `getNodeOutput` + `NODE_OUTPUTS` + `useConnectedInputs`：

- [ ] **只接一层**上游（edge.target === 本节点，不递归）
- [ ] **四类聚合** `{images, texts, videos, audios}` 正确分类（`classifyUrl` / `resolveKind` 按 mime/扩展名/mediaType）
- [ ] **各节点产出声明**（NODE_OUTPUTS）：
  - `imageBoxNode.images[]`（对象数组 {id,url,label}）
  - `videoExtractNode.extractedImages[]` → 帧
  - `gridSplitNode.extractedImages[]` → 切片
  - `gridMergeNode.extractedImages[]` → 图
- [ ] **通用单产出兜底**（`genericOutput`）：imageUrl > videoUrl > **resultUrl** + 尊重 mediaType
- [ ] **剧本盒子**按 `sourceHandle=shot-${id}` 只取对应镜头资产（`collectAssets` 资产名匹配）
- [ ] **文本节点**→ texts（{id,label,text}）
- [ ] **编组作为出口**→ 聚合组内非隐藏子节点产出
- [ ] **URL 绝对化**→ `toAbsoluteFileUrl` 把相对 `/files/` 补成绝对，刷新不破图
- [ ] **sourceNodeId 溯源**→ 每个上游产出带来源节点 id（断连线/溯源用）
- [ ] **图生图参考图解析**（`refImage.js`）：`resolveRefImages`（blob:→base64、refFormat:'base64' 偏好）、`toImageContentBlocks`（chat content 数组注入）

### 2.5 画布 Agent 工具层（L3，24 工具）

来自 `useCanvasAgentTools.js` 的 `AGENT_TOOLS`：

| 类别 | 工具 | 关键断言 |
|---|---|---|
| 建 | create_node / batch_create_nodes | type 校验、`defaultNodeData` 兜底、promptNode 420×420、connectFrom 建边 |
| 删 | delete_node / batch_delete_nodes / delete_edge | 连带边清理、不存在报错 |
| 改 | update_node（白名单）/ update_node_raw | 只改目标、白名单过滤、非目标引用不变 |
| 连 | connect_nodes / batch_connect_nodes | 重复边去重、端点不存在报错 |
| 读 | list_nodes / list_edges / get_node_details / read_canvas | 快照结构含 imageUrl/videoUrl 等产出 |
| 生成 | trigger_generation | 走 `runNodeGeneration`、等 resultUrl |
| 编排 | present_plan / execute_plan | 阶段1暂存→阶段2执行、依赖批/独立批、workflow 状态机 |
| 视图 | fit_view / zoom_in / zoom_out / focus_node | 调 `useReactFlow` 对应 API |
| 其他 | move_node / group_nodes / lock_node / undo_ai | undo_ai 分组事务栈（MAX_AI_UNDO=20） |

每个工具断言：成功 `{ok:true,data}` / 失败 `{ok:false,error}` / 异常被 catch 包成 ok:false。

**MUTATING_TOOLS（13 个，写前入 AI 撤销栈，决定 undo_ai 断言范围）**：`create_node`、`batch_create_nodes`、`delete_node`、`batch_delete_nodes`、`update_node`、`update_node_raw`、`connect_nodes`、`batch_connect_nodes`、`delete_edge`、`move_node`、`group_nodes`、`lock_node`、`execute_plan`。其余 11 个为只读/视图/撤回工具，不入栈。
**create_node 的 type 枚举校验**：仅 `textNode/promptNode/imageNode/discountVideoNode/scriptBoxNode/group` 合法（与 §2.1 注册表对齐）；`update_node` 白名单仅 prompt/label/selectedModel/aspectRatio/resolution/seconds/text。

### 2.6 生成 / 任务链路（L2/L5，核心后端化）

**统一生成契约**（`useNodeGeneration`）：
- [ ] 前置校验 `validate` 失败 → setError 不提交
- [ ] start → `reportGenerate` 上报任务（自动弹任务中心 `openTaskCenter`）
- [ ] 进度 `taskCtl.progress` / 成功 `onSuccess` 回写 node.data + 双写任务中心
- [ ] `doneUrl` 优先作为 resultUrl（`saveResultToTasks` 落盘）
- [ ] AbortController 真取消（`stop`/用户停止 → `taskCtl.fail('已停止')`）
- [ ] `mutiwindow-task-completed` 广播精准回填本节点（刷新后恢复显示）

**生图/生视频/聊天 API**（`imageApi`/`videoApi`/`chatApi`）：
- [ ] **sync/async 双模**：image 按 `provider.image_mode`；video 强制 async
- [ ] **比例×档位像素表**（`resolveImagePixel`：14 比例 × 1K/2K/4K 查表；Auto→不指定 size；查不到回退 1K/默认）
- [ ] SSE 解析（`readSseImageUrl`：`results[].url`/`result.images[].url`、progress、succeeded/failed）
- [ ] 异步轮询 `tasks/{id}` 到 completed；`setTaskPollId` 回填可查 task_id（刷新后 `pollTask.js` 恢复）
- [ ] 参考图 `image_urls` 注入；`buildTargetUrl`（openai:// 伪协议 vs apimart base_url）
- [ ] 贯穿链路 `X-Task-Id`（getCurrentTaskId → proxyRequest payload.taskId）

**任务中心**（`taskStore`）：
- [ ] `statusDotClass`/`statusLabel`/`typeLabel` 映射（pending/running/completed/failed → 颜色/文案）
- [ ] 提交即结束同 nodeId 未完成旧任务（防并发）
- [ ] `removeTask`/`clearTasksBy`/`clearAllTasks`、重试 `retryTask`（触发注册回调）
- [ ] 快照过滤无 nodeId 的网关占位行（getSnapshot）
- [ ] 后端持久化（fetchTasks/saveTask/deleteTask，fire-and-forget 降级）

### 2.7 剧本盒子引擎（L2/L5，最复杂单模块）

来自 `scriptBoxEngine.js` 的 9 个回调 + 纯函数：
- [ ] `onGenerateScript`：剧情→分镜(shots)+资产(assets)归一化、全局风格、镜头数约束、JSON 解析容错
- [ ] `onGenerateAssetImage`/`onGenerateAllAssetImages`：资产参考图、loading 态、批量并发
- [ ] `onGenerateShotPrompts`：分镜生图/生视频提示词、@资产名匹配（`matchAsset`）、约束注入、QG_RULES 硬规则
- [ ] `onGenerateShotImage`：4 种 `IMAGE_GEN_TYPES`（关键帧/四宫格/九宫格/俯视调度）、`getImageGenSys`/`buildShotImageUser`
- [ ] `onStopScriptItem`：AbortController 单停/全停、清 loading
- [ ] `onRetryVideoAssetUpload`/`onUploadAllVideoAssets`：资产视频上传状态机
- [ ] `onConnectShot`/`onConnectShots`：建下游 promptNode/discountVideoNode + 自动连线（shot- 端口）+ 资产参考图
- [ ] 纯函数单测：`parseJsonText`（去 ```json 围栏）、`useJsonObject`（deepseek/claude 排除）、`assembleShotUser`、`dialogueLines`（对白→「说话者：完整原句」格式）、`matchAsset`（@名称后一位合法判定）

### 2.8 项目系统（L2/L4）

来自 `projectStore.js`：
- [ ] 多项目 CRUD：`createProject`/`switchProject`/`deleteProject`(至少保留 1)/`renameProject`
- [ ] 双写持久化：localStorage + localTool `/api/projects`（以后端为准）
- [ ] **画布快照保存** `saveCanvasState`：sanitizeNodes/Edges 白名单（id/type/position/data/width/height）、**空画布跳过保存**、**版本冲突检测**（远程版本更高拒绝覆盖）
- [ ] **画布快照加载** `loadCanvasState`：无 id 边补唯一 id（防重复 key 警告）
- [ ] 云端同步（`cloudSync`）：上传配置/下载配置（providers+预设）

### 2.9 素材库（L4，需后端）

来自 `AssetLibrary.jsx`：
- [ ] 目录 pill（migrated/人物/场景/道具/素材池）切换、子目录返回上一级
- [ ] 无限滚动分页（PAGE_SIZE=20、hasMore、去重）
- [ ] 上传文件落盘 `/api/files/upload`、rescan 收录
- [ ] 卡片操作：打开所在目录/复制链接/重命名/删除
- [ ] 新建文件夹 `/api/files/mkdir`
- [ ] 拖入画布建节点（`useAssetDragToCanvas`，application/x-yimao-asset）
- [ ] 预览：图片/视频/音频/文字四类、`toAbsoluteFileUrl` 绝对化
- [ ] 类型角标（image/video/audio/text）、文件夹识别

### 2.10 设置 / 顶部导航 / AI 助手（L4）

- [ ] **设置面板**（`SettingsFrame` + sections）：仅 3 区实际挂载 = `api`(ApiSettings) / `agent`(AgentChatSettings) / `shortcut`(ShortcutSettings)；`accounts` 实际在 TopNav「多开」里（文档需澄清，勿误测 SettingsFrame 内 AccountsSettings）
- [ ] **ApiSettings**：provider/model 增删、modelKey 解析（providerModels）
- [ ] **TopNav**：画布/多开 tab 切换、项目选择器、用户菜单（上传云端/从云端下载 `cloudSync`）、设置按钮、AI 助手按钮
- [ ] **AI 助手**（AgentPanel/useAgentChat）：演示模式（`VITE_AGENT_DEMO=1` 规则引擎）、真实 LLM function calling、生图参数区 setGenParams
- [ ] **Toast / 错误边界**（toastStore/ErrorBoundary）
- [ ] **性能降级**（performanceMode/CanvasToolbar、LodProvider/useLod、useMediaDegrade 缩略图降级）

### 2.11 连线特效 / 视觉（L1/L4）

- [ ] `CustomEdge`：三层 path + comet 流光 + 删除按钮（选中高亮/蓝晕）
- [ ] `ConnectionLine`：拖拽中临时连线带流动光点
- [ ] 端口 hover/连接时变大 + 十字 + 跟随鼠标；连接目标节点旋转跑马灯边框（`cust-marquee`）
- [ ] 节点外壳视觉（NodeShell）：bg-surface-raised/rounded-xl/border/shadow、选中边框、标题栏

### 2.12 拖入 / 粘贴（L4）

来自 `useAssetDropPaste`：
- [ ] 文件拖入：image/video/audio→imageNode、text→textNode、上传失败 fallback dataURL
- [ ] 拖入 URL 文本：图片类→imageNode、其它→textNode
- [ ] 素材库拖入（application/x-yimao-asset）：文字/图片/视频/音频分支
- [ ] 粘贴：文件→imageNode；`mutiwindow-nodes`→重建节点组；`mutiwindow-images`→建 imageNode 网格；普通文本→textNode（sanitizePastedText 清洗）
- [ ] 守卫：可编辑元素内粘贴走原生（不建节点）

### 2.13 3D 导演台（L4/L5，子工程）

来自 `director3d/*`（Director3DOverlay + editor/ + app/）：
- [ ] 双击节点全屏打开；顶栏 viewMode 切「导演/机位」；截图返回画布（`requestViewportCapture`）
- [ ] 上游全景图导入（`addImportedAsset` kind=panorama，`toAbsoluteFileUrl` 归一）
- [ ] `directorStore`：replaceProject/createDefaultDirectorProject/viewMode/removePanoramaAsset/setViewportPanelsCollapsed
- [ ] editor 子模块：canvas（3D 视口 + ViewportToolbar 导入 model/panorama/prop）、panels（RightPanel 4 切换：CharacterPanel/PropPanel/CameraPanel/ScenePanel + ObjectTreePanel + CapturePanel + AssetImportPanel）、runtime（渲染 + mannequin 人型）、loaders（本地模型/全景图导入）、presets、schema（directorProject/cameraGeometry）、io（captureBridge/screenshotExport/hostBridge）、modelLibrary
- [ ] CameraPanel：properties/captures 双 Tab、VIEWER_ZOOM 0.25~5 步长 0.25、截图下载/上传主机（postDirectorDeskCapturesToHost）
- [ ] 退出回传 `{project, thumbnailDataUrl, captures}` 写回节点 data
- [ ] 每条线索纯函数（`parseJsonText`/`assembleShotUser` 类）可下沉 L2

### 2.14 后端契约（L6，已有部分）

> ⚠️ localTool 是 **13 个路由文件、约 50+ 个 handler**（`index.ts` 精确分发 ~40 条路由），不是"13 个路由"。每个 handler 都是独立回归点。

**localTool 路由 handler 清单**（改对应文件必跑 `cd localTool && npm test`）：
- `files.ts`（8）：upload / read / thumbnail / mkdir / move / open / openDir / list
- `system.ts`（4）：gatewayTask / status / proxy / jianyingSend
- `tasks.ts`（6）：get / save / batchSave / delete / batchDelete / clear（+ persistThreadId 内部）
- `agentChat.ts`（1）：agentChat（SSE function calling 中转）
- `kv.ts`（3）：get / set / delete
- `platform.ts`（4）：pluginManifest / workflowAppsByProject / builtin / models
- `providers.ts`（5）：get / put / test / fetchModels / configBasePut
- `logs.ts`（1）：logsPost
- `admin.ts`（6）：stats / kvList / clearCache / cleanup / export / import
- `official.ts`（4）：user / entitlements / vipCheck / invalidate
- `passthrough.ts`（1）：passthrough（兜底转发）
- `resources.ts`（7）：rescan / get / save / batchSave / delete / batchDelete / clear / rename（共 8，rename 见 index 分发）
- `projects.ts`（2）：get / save

**断言维度**：
- [ ] **字符串契约零损伤**（§五.5）：`proxyMode=local-tool`、`127.0.0.1:18080/9004`、`/api/proxy`、`x-proxy-url`、`t.data[0].url`、`{code,data}` 信封、SSE 格式
- [ ] **每个 handler 成功/失败/边界**：参数缺失报错、越权（official invalidate）、文件不存在（read/open 404）、并发写（tasks save vs clear）
- [ ] **网关**（apimart-gateway）：`lovart_client.py` 工具名↔Lovart 工具名别名映射、`verify_gateway.py`、`contract.py`
- [ ] **三层一致性**：`task-inspect.mjs --consistency` 画布↔任务中心↔磁盘
- [ ] **不丢图增强**：`saveRemoteUrl` 基于 `sha1(url)` 幂等转存；下载失败返回 CDN+WARN 不抛 500
- [ ] **文件安全**：`/files/` 路径穿越防护（index.ts resolveUploadDir 白名单校验，越界 403）

### 2.15 AI 助手状态层（L2/L4，纯逻辑可下沉，文档首版/二版均遗漏）

来自 `conversationStore.js` / `useAgentChat.js` / `inputStateMachine.js` / `canvasPlanExecutor.js` / `demoPlan`（useAgentChat 内）：

- [ ] **conversationStore（多对话数据层，纯逻辑可单测）**：
  - `ensureActiveConversation` / `newConversation` / `switchConversation` / `deleteConversation`（至少留 1 个）→ 自动落盘
  - `importLegacy` 旧单会话迁移（hist→1 对话，幂等）
  - `captureActiveConversation` / `applyConversation`；`hydrated` 守卫：未恢复前 `_commit` 不落盘（防挂载早期空数据覆盖真实记录）
  - `patchCurrentWorkflow`（status/steerQueue/startedAt）、`setCurrentPending`（刷新恢复）、`getCurrentMemory`/`setCurrentMemory`（summary/facts/lastPlan/lastSharedStyle/notes）
  - `AGENT_MSG_MAX=60` 消息上限截断（防无限膨胀）
- [ ] **inputStateMachine（8 状态机，纯逻辑单测）**：status ∈ {idle,planning,creating_nodes,ready,running,stopping,failed,completed}；`action()` 推导 send/stop/steer/retry/idle/stopping（RUNNING 集合 + hasContent）；`load(conversationId)` 每对话隔离；completed/stopped 归一 idle
- [ ] **useAgentChat.send**：`MAX_TOOL_ROUNDS=8` 多轮工具循环硬上限（走满仍未收敛→提示防死循环）；`sendingRef` 同步防护防并发双发；`steerQueue` 任务中补充指令排队（per-conversation 不串）；SSE 解析 `parseSSEChunk`（content/reasoning/tool_calls 增量）；proxy/agent 双路径（provider 存在走 `/api/proxy`，否则 localTool `/api/agent/:id/chat`）；`buildRequestMessages`（注入 CANVAS_AGENT_RULES + Skill 原文 + memory.lastPlan）
- [ ] **sendImageMode（图像模式）**：提示词+参考图直连生图，复用 `execute_plan`（auto_run=true + referenceImages），不过 LLM
- [ ] **stop / clear**：`AbortController` 中止；clear 只清当前对话（workflow/pending/memory 一并重置）
- [ ] **demoPlan 规则引擎**（VITE_AGENT_DEMO=1）：自然语言→工具调用（建节点/连接/删除/查看/适配关键词识别、`「」`引号提 prompt）；不认识返回 []
- [ ] **canvasPlanExecutor.executePlan**（L2 纯逻辑）：
  - `dependsOnPrevious`（depends_on_previous / use_previous_results / depends_on_steps）
  - `normalizeRatio`（square→1:1、story→9:16、landscape→16:9、portrait→3:4、空→Auto）
  - `normalizeResolution`（1k/2k/4k→1K/2K/4K、空→1K）
  - **Wave1/Wave2 分批**：独立批并行建 promptNode+触发+await resultUrl；依赖批仅当独立批全部成功才执行，用「前序节点连线」让下游自动读参考图（非运行时注入）
  - `nextAnchor` 就近排版（perRow=3，col*480/row*520）；`autoRun=false` 只建节点不触发（ready 态）
  - 空计划（无 prompt/title）→ `{status:'failed',error:'计划为空'}`

### 2.16 剧本盒子节点 UI 状态机（L4，补 §2.7 节点侧）

来自 `ScriptBoxNode.jsx` + `scriptbox/` 子组件：
- [ ] **三步状态机**：step ∈ {1 确认镜头, 2 准备资产, 3 合成提示词}，点击切换不自动连跑
- [ ] **StepNav 进度环**：镜头数 / 资产 i/n 完成度 / 有 prompt 镜头数 实时算进度
- [ ] **StepShots（步骤1）**：8 列分镜表格（镜号/时长/画面描述@资产高亮/景别/光影/对白弹窗/音效/运镜）+ 增删 + dialogueText/hlAt 对白编辑（dlgToText/textToDlg 双向）
- [ ] **StepAssets（步骤2）**：资产 has 勾选 / 上传参考图 / 批量生图 loading
- [ ] **StepPrompt（步骤3）**：提示词合成区（@资产名解析展示）
- [ ] **GearSettings 齿轮弹窗（5 Tab，节点内 absolute 定位，非 portal 全屏）**：
  - 基础：aspectRatio（6 预设+自定义）/ 文本模型 / 资产生图模型 / 全局约束（图片/视频/自定义）
  - 剧本：customScriptPrompt（覆盖 SCRIPT_WRITER_SYSTEM）
  - 分镜：customShotPrompt（覆盖 SHOT_DIRECTOR_SYSTEM）
  - 生图类型：4 种 IMAGE_GEN_TYPES 模板可覆盖
  - 资产：角色/场景/道具 3 类参考图模板（ASSET_TEMPLATES 覆盖）
  - 保存：一次性 updateData 写回（aspectRatio/customAspectRatio/*ModelSettings/assetModelSettings 等）
- [ ] 资产 `has` 字段 + 镜头 `prompt`/`videoPrompt` 驱动进度环与提示词步

### 2.17 横切纯逻辑工具（L2，纯函数可独立单测，文档前轮均遗漏）

来自 `base/mediaType.js` / `hooks.js` / `useSyncNodeData.js` / `scriptBoxPrompts.js` / `providerModels.js` / `imageUrl.js`：
- [ ] **mediaType.js**：`detectMediaType(url)`（按扩展名/mime 分类 image/video/audio/text）、`detectFileType(file)`、`isAssetUrl`、`isAudio`
- [ ] **hooks.js**：`useSizeSync(id, ratio, opts)`（width-fixed：高度=宽÷比例；area-fixed：width=√ratio×base、height=base/√ratio；比例切换不可变写回）、`parseAspect`（"16:9"→{w,h}）、`useNodeResize`/`useNodePosition`/`useOutsideClick`/`isEditableTarget`（快捷键守卫复用）
- [ ] **useSyncNodeData**：下游节点订阅上游 `data.xxx` 变更（管线契约接收侧）
- [ ] **scriptBoxPrompts.js**：`ZgPrompt`(category,desc,style,customTpl)、`dialogueText`(把对白数组→「角色：文本」)、`hlAt`(@资产高亮)、`buildShots(n)`（无副作用生成 n 分镜）、`buildAssets`(style,customTpl)、`IMAGE_GEN_TYPES`(keyframe/grid9/quadgrid/topdown)、`getImageGenSys`/`buildShotImageUser`
- [ ] **providerModels.js**：`modelKey(providerId,modelId)`、`buildAllModels(providers,type)`（聚合多 provider chat/image/video）、`resolveProviderModel`（"providerId::modelId"→{provider,modelId} 解析回）
- [ ] **imageUrl.js**：`toAbsoluteFileUrl`（相对→绝对）、`normalizeImageUrl`（刷新不破图）

### 2.18 素材库数据层（L2，补 §2.9 底层，前轮只测 UI）

来自 `base/assetStore.js`：
- [ ] `FOLDERS` 目录 pill 配置（all/generated/character/scene/prop/material，含 `migrated/人物` 等子目录前缀匹配）
- [ ] `detectAssetType(file)`（image/video/audio 判定）、`filterByFolder(list, folder)`（前缀匹配）
- [ ] `addAssets(items, folder)` / `removeAsset(id)` / `clearAssets` / `loadAssets`（localStorage 持久化 + 首次 seed 演示素材）
- [ ] `useAssets()`（useSyncExternalStore 订阅）

### 2.19 Skill 系统（L4，AI 助手 Skill 三阶段核心，前轮遗漏）

来自 `base/skillStore.js`：
- [ ] `getBuiltinSkills` / `getCustomSkills` / `getAllSkills`（builtin + custom 合并）
- [ ] `upsertCustomSkill`(skill) / `deleteCustomSkill`(id)（localStorage key=agent_skills）
- [ ] `markSkillUsed`(id) / `getSkillUsage`(id)（使用计数，UI 排序）
- [ ] Skill 三阶段注入：启用 Skill → `useAgentChat` 把 content 无损注入 system（SKILL_EXECUTION_RULES），驱动 present_plan→execute_plan
- [ ] Skill content 解析：LLM 按 content 的"阶段1 策划→阶段2 等待→阶段3 执行"约束执行

### 2.20 Provider 系统（L2/L4，补 §2.10 ApiSettings 底层）

来自 `base/settings/providerStore.js`：
- [ ] provider CRUD：`useProviders`/`load`/`save`（增删 provider、protocol=apimart/openai）
- [ ] `handleProviderTest`（连通性测试）、`handleProviderFetchModels`（拉模型列表）
- [ ] model 增删（providerModels 聚合）、`configBasePut`（全局 base_url 配置）
- [ ] refFormat 字段（base64 偏好，影响 refImage 解析与 useAgentChat 附件归一）

---

## 三、项目设计（如何组织自动化，目标可落地）

### 3.1 目录与文件

```
tests/
├── unit/                      # L2 纯逻辑（Vitest）
│   ├── useConnectedInputs.test.js   # 管线契约（§2.4，含 genericOutput/resultUrl/collectAssets）
│   ├── groupNodes.test.js           # 编组/解组算法（§2.2）
│   ├── providerModels.test.js       # 模型解析（§2.10）
│   ├── imageUrl.test.js             # URL 绝对化 + 比例像素表 resolveImagePixel（§2.4/2.6）
│   ├── useCanvasHistory.test.js     # 撤销/重做栈 + 分支截断（§2.3）
│   ├── scriptBox.test.js            # parseJsonText/useJsonObject/assembleShotUser/matchAsset/dialogueLines（§2.7）
│   ├── projectStore.test.js         # 项目 CRUD + 快照 sanitize + 版本冲突（§2.8）
│   ├── refImage.test.js             # resolveRefImages/toImageContentBlocks（§2.4）
│   ├── conversationStore.test.js    # 多对话 CRUD + hydrated 守卫 + pending 恢复 + 60 上限（§2.15）
│   ├── inputStateMachine.test.js    # 8 状态 + action() 推导（§2.15）
│   ├── canvasPlanExecutor.test.js   # executePlan Wave1/Wave2 + normalizeRatio/Resolution（§2.15）
│   ├── mediaType.test.js            # detectMediaType/isAudio/detectFileType（§2.17）
│   ├── sizeSync.test.js             # useSizeSync width/area-fixed + parseAspect（§2.17）
│   ├── scriptBoxPrompts.test.js     # ZgPrompt/dialogueText/buildShots/buildAssets/IMAGE_GEN_TYPES（§2.17）
│   ├── providerModels.test.js       # modelKey/buildAllModels/resolveProviderModel（§2.17/2.20）
│   ├── assetStore.test.js           # FOLDERS/detectAssetType/filterByFolder/addAssets（§2.18）
│   └── skillStore.test.js           # builtin/custom/upsert/delete/usage（§2.19）
├── tools/                     # L3 Agent 工具（Node 直调）
│   └── canvasAgentTools.test.js     # 24 工具逐测（§2.5）
├── e2e/                       # L4 Playwright
│   ├── canvas.interactions.spec.js  # 拖拽/连线/编组/快捷键/右键/全局操作（§2.2/2.3）
│   ├── nodes.render.spec.js         # 每节点 E2E 渲染+参数（数据驱动，§2.1）
│   ├── settings.spec.js             # 设置/TopNav/素材库（§2.9/2.10）
│   ├── generation.spec.js           # 生成链路 mock + 真生成（§2.6）
│   └── scriptBox.spec.js            # 剧本盒子 9 端点（§2.7）
├── fixtures/                  # 测试数据（节点快照/示例图/示例视频/脚本盒 JSON）
└── utils/                     # 共用：mock useReactFlow ctx、构造画布快照、assert 工具
```

### 3.2 关键设计决策

1. **L2/L3 用真实模块 + mock ctx**：`buildCanvasAgentTools(ctx)` 已设计为脱离 React（`ctx` 可传 mock 的 `getNodes/setNodes/...`），直接喂内存画布做断言，零浏览器依赖。这是最高 ROI 的回归层，优先建。
2. **管线契约单测必建**：`getNodeOutput` / `useConnectedInputs` 是「连线上游→下游参考」的核心，参数组合多、回归代价高，纯函数易测。
3. **L1 扩到 17 节点**：把 `regression_test.cjs` 的 cases 数组扩到全部 14 个 `paletteNodes` + 3 个 QWE 隐藏节点，每节点加自身独有结构断言（如 ImageBox 的 activeIndex 切换、GridSplit 的 rows/cols、videoProcess 的 timeline）。
4. **L4 用例用数据驱动**：节点参数矩阵写成 JSON，`nodes.render.spec.js` 循环生成用例，避免手写 18×N 个 spec。
5. **剧本盒/3D 纯函数下沉 L2**：`scriptBoxEngine` 的 `parseJsonText`/`matchAsset` 与 `director3d` 纯函数单测独立于浏览器，提速。
6. **L5 网关隔离**：真生成用例标注 `@requires-lovart`，CI 默认跳过；本地开 VPN 手动跑，用 `task-inspect.mjs` 断言三层一致性。
7. **回归报告**：每个层独立 `npm run test:unit|tools|e2e`，聚合进 `npm test`；产出 JUnit XML 供 CI。

### 3.3 落地顺序（建议）

1. **先扩 L1**：`regression_test.cjs` cases → 17 节点（半小时内，立刻涨覆盖）。 ✅ 已实现（13 节点 SSR，director3dNode 因 WebGL 移至 L4）
2. **建 L2 纯逻辑**：管线契约 + 编组 + URL/像素表 + 历史栈 + 剧本盒纯函数 + 项目系统 + **AI 助手状态层**（§2.15）+ **横切纯逻辑**（mediaType/sizeSync/scriptBoxPrompts/providerModels/imageUrl，§2.17）+ **数据层**（assetStore/skillStore，§2.18/§2.19）+ Provider（§2.20，最高价值，1~2 天）。 ✅ 已建 13 文件（tests/unit/*），`npm run test:unit`
3. **建 L3 工具层**：24 工具逐测（复用现有 `test_agent_tools.cjs` 骨架扩写）。 ✅ 已建 `tests/unit/canvasAgentTools.test.js`（28 测试）
4. **建 L4 E2E**：Playwright 配置 + 画布交互 + 节点参数数据驱动 + 素材库 + 设置 + **剧本盒三步状态机 + AI 助手多轮工具循环**（§2.15/§2.16，2~3 天）。 🔶 骨架已建（`playwright.config.js` + `tests/e2e/*` 4 spec），待 `npx playwright install` 后本地验证
5. **L5/L6**：按需，依赖后端环境。

---

## 四、测试点计数（粗估，说明"几千"的来由）

- 节点参数：17 节点 × 平均 6 参数 ×（合法值/边界/非法）≈ 17×6×3 ≈ **306**
- 节点交互矩阵：17 × 8 项（渲染/写回/比例/选中/端口/删除/锁定/默认尺寸）≈ **136**
- 管线契约：4 类聚合 × 9 产出分支 × 2（sourceHandle 有无）≈ **72**
- Agent 工具：24 × 平均 4 场景（成功/失败/异常/边界）+ MUTATING_TOOLS 13 断言 ≈ **109**
- 画布交互/快捷键：12 交互 × 平均 5 场景 + 5 快捷键守卫 ≈ **85**
- 全局操作：11 项（addNode 分支/复制组/粘贴组/清理缓存/整理…）× 3 ≈ **33**
- 生成/任务链路：sync/async × 14 比例 × 3 档位 + 任务映射 3 + 落盘 2 ≈ **89**
- 剧本盒子引擎：9 端点 × 3 + 6 纯函数 × 3 ≈ **45**
- 剧本盒子 UI 状态机：3 步切换 + StepNav 进度环 + StepShots 8 列 + GearSettings 5 Tab ≈ **12**（§2.16）
- **AI 助手状态层**：conversationStore 7 + inputStateMachine 8 状态/action + useAgentChat 5（send 8 轮/双路径/steer/stop/clear）+ demoPlan 5 + canvasPlanExecutor 6 ≈ **31**（§2.15）
- 项目系统：4 CRUD + 快照 3 + 云端 2 ≈ **9**
- 素材库：6 操作 + 4 类型预览 ≈ **10**
- 设置/TopNav/AI：3 section + 4 TopNav + 演示/真实 ≈ **9**
- 连线特效/拖入粘贴：4 特效 + 5 拖入分支 ≈ **9**
- 3D 导演台：5 主路径 + store + viewportToolbar + RightPanel 4 面板 + CapturePanel/ObjectTreePanel ≈ **12**
- 后端契约：字符串契约 10×3 + **localTool 50+ handler + 网关别名** ≈ **90**
- 横切纯逻辑（§2.17）：mediaType 4 + sizeSync 3 + useSyncNodeData + scriptBoxPrompts 6 + providerModels 3 + imageUrl 2 ≈ **19**
- 素材库数据层（§2.18）：FOLDERS 6 + detect/filter 3 + CRUD 4 ≈ **13**
- Skill 系统（§2.19）：builtin/custom 2 + upsert/delete 2 + usage 2 + 注入 1 ≈ **7**
- Provider 系统（§2.20）：CRUD 2 + test/fetchModels 2 + configBasePut + refFormat ≈ **6**

合计约 **1250+ 基础用例**，再叠加：组合场景（连线+生成、编组+锁定+删除、脚本盒镜头端口×N 镜头、3D 全景导入）、E2E 跨节点工作流（剧本→分镜→生图→拼图）、AI 助手多轮工具循环+steer 队列+Skill 三阶段、后端 handler 边界组合，轻松突破 **数千测试点**。本文档即这些点的**注册表与组织规范**。

---

## 五、下一步

1. 确认本文档的模块拆分与落地顺序无误（尤其 §2.1~2.14 是否还有某节点/某能力漏测）。
2. 从 §3.3 第 1 步开始：扩 `regression_test.cjs` 到 17 节点。
3. 新建 `tests/` 工程，按 L2→L3→L4 填充自动化用例。

> 文档状态标记：本文为**规划中**。落地后把对应小节标「✅ 已建 + 用例数」。禁止把规划当现状写回代码注释。
