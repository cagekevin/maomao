# 剧本盒子原型 vs 官方差距清单与修复计划

> 基于精读官方源码 `src/bundle/httpClient-BknZwXjG_components/c_.jsx`（UI，2806 行）与 `H_.jsx`（引擎），对照 `prototypes/react-nodes` 现有原型。
> 阶段 A（数据契约 + 引擎注入上移）已完成。本文是阶段 B/C 的执行依据。
> 符号说明：✅ 已对齐 / ⚠️ 差异（可接受或需改）/ ❌ 缺失（必须补）/ 🔲 待接真引擎

---

## 一、数据模型差距（node.data 字段）

| # | 字段 | 官方 | 原型现状 | 结论 |
|---|---|---|---|---|
| 1 | 选中资产集合 | `picked`（Set 序列化）+ `pickedCount` | 无 | ❌ 步骤2批量生成/步骤3连线要读 |
| 2 | 全局约束集合 | `globalConstraints[]` | 只有 `customGlobalConstraint` 字符串 | ❌ Ir 引擎要读集合 |
| 3 | 生图模型设置 | `assetModelSettings = {globalModel, globalAspectRatio, globalSize}` | ✅ 已补（阶段A） | ✅ |
| 4 | 视频状态 | `videoUploadedAssets` / `videoAssetUploadStatus` / `videoAssetUploadErrors` | ✅ 已补（阶段A） | ✅ |
| 5 | 视图模式 | localStorage `script-box-view-${id}` | useState 不持久化 | ⚠️ |
| 6 | 宫格字段 | `gridMode`（0/4/9） | `grid` | ❌ 命名对齐 |

---

## 二、UI 差距

### 步骤1「确认镜头」

| # | 官方 | 原型现状 | 结论 |
|---|---|---|---|
| 1 | 左栏有**生图/文本模型下拉**（模型调度/内置/第三方，写 `assetModelSettings.globalModel` 与 `textModel`） | 无模型下拉 | ❌ |
| 2 | 风格 chips 8 个预设（`$g`） | 4 个 | ⚠️ |
| 3 | 表格**分页**（每页 10 镜 `s_=10`）+ **列宽拖拽**（`ke`） | 无分页、固定列宽 | ❌ |
| 4 | 表格普通模式 6 列可拖拽、detail 展开态 9 列 | 固定 9 列 | ⚠️ 以源码为准 |
| 5 | 对白编辑器**富文本**：每行 kind 下拉（台词/旁白）+ role + text + 删除 + 加行 | 纯 textarea | ❌ |
| 6 | `at()/ot()` 对白双态（string ⇄ 数组） | 只支持数组 | ❌ |

### 步骤2「准备资产」

| # | 官方 | 原型现状 | 结论 |
|---|---|---|---|
| 1 | 三栏按 character/scene/prop 分组，每类 `grid-cols-5`（全屏 8） | ✅ 已有分组 | ✅ |
| 2 | 资产卡含：选中 checkbox、缩略图双击放大、loading 遮罩、视频状态徽标（上传中/重试上传/已上传）、more 菜单（重新生成/上传/删除）、名称+描述 | 原型部分有 | ⚠️ 需补徽标字段对齐 |
| 3 | 顶部工具栏：生图模型下拉 + 上传全部素材 + 批量生成（选中集）+ 统一风格输入 | 原型部分有 | ⚠️ |
| 4 | 抽屉编辑：名称/主体描述/完整生图提示词 + 从资源选择 + 用此提示词生成 | 原型部分有 | ⚠️ |
| 5 | **改名联动** `J`：改 asset 名时全局替换所有镜头的 description/prompt/videoPrompt/dialogue 旧名 | 无 | ❌ |

### 步骤3「合成提示词」

| # | 官方 | 原型现状 | 结论 |
|---|---|---|---|
| 1 | 列表/单镜头**双视图**，localStorage 持久化 | 无 | ❌ |
| 2 | 生图宫格（gridMode 0/4/9）**真实渲染 4/9 格** | 只显示单张 | ❌ |
| 3 | 每镜卡片：宫格选择 + 生图 prompt + 生视频 prompt + 生成 + 连线 | 部分 | ⚠️ |
| 4 | 批量操作区分**连接生图 / 连接视频** | 混连 image+video | ❌ |
| 5 | `videoPrompt` 以 `【时长 N秒】` 开头 | 无此格式 | ⚠️ |

### 齿轮设置 / 双击编辑器

| # | 官方 | 原型现状 | 结论 |
|---|---|---|---|
| 1 | 设置弹窗：画面比例/生图约束/生视频约束/剧本提示词/分镜提示词/角色/场景/道具模板 | GearSettings 已有部分 | ⚠️ |
| 2 | **@资产插入按钮** + **加粗/斜体排版**（双击编辑器） | 无 | ❌ |
| 3 | 标题栏「生成中 X 字 · Ns」 | 只有「生成中 Ns」 | ⚠️ |

---

## 三、引擎差距（假实现，签名已对齐）

| # | 官方回调 | 官方行为 | 原型现状 | 结论 |
|---|---|---|---|---|
| 1 | `onGenerateScript(e, story, 触发者)` | `/v1/chat/completions` SSE，流式写回 shots+assets | `buildShots/buildAssets` 假数据 | 🔲 |
| 2 | `onGenerateShotPrompts(e, shotIds?)` | 每镜 `assembleShotUser + unoverrideRule + image/video 约束`，真实请求 | `buildShotPrompts` 假拼 | 🔲 |
| 3 | `onGenerateAssetImage(e, assetId, noProxy?)` | 图生图（OpenAI/Gemini 双分支）+ 本地化 + 缩略图 | picsum 占位 | 🔲 |
| 4 | `onStopScriptItem(e, kind?, id?)` | AbortController（`abortMap`）真中止 + 清 loading | 空 | ❌ |
| 5 | `onUploadAllVideoAssets(e)` / `onRetryVideoAssetUpload(e, assetId)` | 真实上传网关 + 回填状态 | 假标记 | 🔲 |
| 6 | `onConnectShot(s, k, options)` / `onConnectShots(...)` | `createDownstreamNode`（di）建下游 + `uploadVideoAssets`（ii）传素材 + 位置计算 + 预填宽高比/时长/模型 | `addNodes` 位置固定、混连 | ❌ |

---

## 四、修复计划（阶段 B/C，按依赖排序）

### 阶段 B：纯函数 + 引擎（对齐官方契约，地基）

**B1 纯函数层 `scriptBoxPrompts.js`**：
1. `at(dialogue)` / `ot(lines)`：对白 string⇄数组 双态解析/序列化（格式 `[${kind}|${role}] ${text}`）。
2. `matchAsset`/`collectAssets`（Fa/Ra）：按 `@资产名` 收集有 `imageUrl` 的资产为参考图。
3. `wrapGlobalStyle`（Yg）：风格包装。
4. 字段 `grid → gridMode` 命名统一。

**B2 引擎层 `scriptBoxEngine.js`**：
1. 回调签名对齐官方（`onGenerateShotPrompts(e, shotIds?)` 支持单镜/批量）。
2. `stopScriptItem` 用 `abortMap` Map 真中止（AbortController）。
3. `onConnectShot/onConnectShots`：区分生图/生视频，`createDownstreamNode` 算位置 + 预填宽高比/时长/模型，生视频触发上传素材。
4. 假实现全部标注真链路。

### 阶段 C：UI 对齐

**C1 步骤1**：模型下拉（写 `assetModelSettings.globalModel` + `textModel`）、分页、列宽拖拽（可选）。
**C2 步骤2**：视频状态徽标字段对齐、改名联动（`J` 全局替换 shots 旧名）、选中集 `picked/pickedCount`。
**C3 步骤3**：宫格真实渲染 4/9 格、单镜头视图、连接生图/生视频区分、localStorage 持久化、`videoPrompt` 加 `【时长 N秒】`。
**C4 齿轮/编辑器**：@资产插入按钮 + 加粗/斜体排版、标题栏「生成中 X 字 · Ns」。

### 每个任务验证
`npm run build` + `npm run test:smoke` + `npm run test:regression` 三道门全绿，每阶段 commit 一次。

---

## 五、优先级建议

先做 **B1+B2**（纯函数 + 引擎，数据契约的地基，C 依赖它），再做 **C1→C2→C3→C4**。B 与 C 相互依赖的字段（picked/gridMode/视图持久化）在 B 里先定义好，C 直接用。
