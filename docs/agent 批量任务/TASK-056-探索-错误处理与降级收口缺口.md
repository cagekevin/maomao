# TASK-056｜探索：错误处理与降级收口缺口

- **状态**：已审计定稿（探索性产出，本文档为唯一交付物）
- **日期**：2026-08-17
- **范围**：`src/` 下的错误处理、降级、边界防御现状梳理
- **目标**：摸清「错误有没有被统一收口」「降级有没有统一兜底」，而非直接改代码
- **审计说明**：本文档经二次核实，所有行号/文件名/结论均对照源码校验，已剔除初稿中失实论断（详见 §6 修订记录）。

---

## 0. 结论速览

当前项目**已建立两套体系化的收口**：

1. **渲染崩溃收口**：`ErrorBoundary` 已覆盖「应用级（main.jsx full 变体）+ 节点级（NodeShell node 变体）」两级，单节点崩溃不拖垮画布。
2. **生成链路收口**：`useNodeGeneration` 统一了「提交 → 进度 → 成功双写 / 失败」全链路，含 abort 区分、retry、logger、toast。

但整体仍有**明显缺口**：

- **日志不统一**：22 处 `console.error/warn` 绕过 `logger`（集中在 `filesApi`、`taskStore`、`App`、`projectStore` 等），无聚合错误面板。
- **加载失败降级缺位**：`useMediaDegrade` 仅做「性能模式隐藏媒体」，媒体**加载失败**（`onError`）由各节点自管，无统一的 URL/质量回退中枢。
- **外部数据校验薄弱**：JSON 解析、连接关系多靠静默降级或 `?.`，问题不暴露给用户。
- **离线/弱网兜底不连贯**：`chatApi` 有网络异常分支但无离线态 UI；`localTool` 状态未驱动生成前置拦截。

**建议优先项**：① 收敛 console.* 到 logger ② 建立媒体加载失败的统一回退 ③ 外部数据入参校验层 ④ 离线前置拦截。

---

## 1. 已建立的收口体系（做得好的地方）

### 1.1 `ErrorBoundary` —— 两级崩溃边界（P0 已覆盖）
文件：`src/components/base/ErrorBoundary.jsx`，在 `src/main.jsx:14` 包裹 `<App/>`。

- `variant="full"`（默认）：根级全屏崩溃页，含「重新载入 / 强制刷新」与错误详情展开（27-103 行）。
- `variant="node"`：节点内局部错误框，`NodeShell` 包每个节点内容，单节点崩溃只在该节点内降级，不影响画布与其它节点（注释 9-10 行、42-55 行）。
- `onError` 回调：node 粒度默认传 `logger`（注释 11 行），具备上报能力。

> 这是「分级兜底」的范本，比「仅包一层 App」更稳健。

### 1.2 `useNodeGeneration` —— 统一生成契约
文件：`src/components/base/useNodeGeneration.js`

- 统一 `try/catch`，区分 `AbortError`（用户停止，不报错）与普通异常（109-110 行走 `logger.error` + 全局 toast）。
- `reportGenerate` 双写 `taskStore + node.data`，避免「任务中心有结果、卡片没结果」不一致。
- `doneUrl` 曾因上游返回对象触发 `.startsWith` 崩 → 已加 `typeof rawUrl === 'string'` 防御。
- 上游返回对象偶发触发类型错误 → 已加固（93-94 行）。

> 这是「生成链路统一收口」的范本，其它手写生成逻辑应参考收敛。

### 1.3 性能模式媒体降级（已覆盖）
文件：`src/components/base/useMediaDegrade.js`，被 **11 个节点引用**：

`ImageNode`、`VideoProcessNode`、`GridSplitNode`、`GridMergeNode`、`VideoExtractNode`、`TemplateNode`、`FaceMosaicNode`、`DiscountVideoNode`、`PromptNode`、`ImageBoxNode` 等（grep `useMediaDegrade` 命中 11 文件 + `index.css`）。

- 基于 `useLod` 的 `lodLevel`：≥2 隐藏图片、≥3 隐藏音视频（22-27 行）。
- 设计意图明确：接 localTool 缩略图服务后，「隐藏占位」可改为「换 thumbnailUrl」，本 hook 只算降级级别（注释 17-18 行）。
- `VideoProcessNode:157` 用 `isHidden` 控制渲染；`ImageNode:52` 用 `hideMedia` 控制图片显示。

### 1.4 网络异常分支（点状）
- `chatApi.post()`：区分 `AbortError` 与网络错误，返回统一信封 `{ ok, error, aborted }`（52-56 行）。
- `ImageNode.downloadImage`：blob→objectURL 失败有 `catch` 兜底。

---

## 2. 缺口清单（按严重度）

### 2.1 日志不统一（P1）
grep `console.(error|warn)` 命中 **22 处**（已逐文件核实），分布：

| 文件 | 处数 | 说明 |
|---|---|---|
| `base/filesApi.js` | 9 | 文件读写失败，多为根因日志 |
| `base/taskStore.js` | 6 | 任务状态异常 |
| `App.jsx` | 5 | 顶层运行告警 |
| `base/projectStore.js` | 4 | 工程持久化异常 |
| `AgentPanel.jsx` | 3 | 对话失败 |
| `base/videoEngine.js` / `GeneratedView.jsx` / `clipboard.js` / `imageUrl.js` | 各 2 | 媒体/剪贴板/URL |
| `TextNode` / `GridSplit` / `GridMerge` / `VideoExtract` / `eventBus` / `ErrorBoundary` / `useAgentChat` / `AssetLibrary` / `TaskCenter` / `ImageEditor` / `chatApi` / `logger` / `useNodeGeneration` | 各 1 | 散点 |

**问题**：
- 生产环境无法统一开关/上报；无「错误面板」聚合展示全局健康度。
- `ErrorBoundary.componentDidCatch`（27 行）仍 `console.error('[ErrorBoundary]', ...)` 而非 `logger`，崩溃上报与统一日志脱节。
- `useNodeGeneration.js:120` 的 `console.error('[useNodeGeneration] 生成异常:', e?.message)` 在其已用 `logger.error`（109 行）之外又打一行 console，冗余。

**建议**：
- 业务错误一律走 `logger`，`console` 仅开发期调试；给 `logger` 加 `console` 透传开关。
- 增加轻量「错误/降级面板」聚合 `logger.error/warn`（复用现有 toast 或 taskStore）。

### 2.2 媒体加载失败降级缺位（P1）
- `useMediaDegrade` 解决的是**性能模式隐藏**（lod 缩小），**不是加载失败回退**。
- 加载失败（`onError`）目前各节点自管：
  - `PanoramaNode`：`imgError` 状态 + `onError` 占位，换图重置（33、57-64 行）。
  - `ImageNode`：本地下载失败 `catch` 兜底（120-129 行）。
- **无统一的「加载失败后 URL/质量回退」中枢**（如 WebP→原图、超时回退）。`useMediaDegrade` 注释提到未来可接缩略图，但当前未实现加载失败回退路径。

**建议**：在 `useMediaDegrade` 之上补 `degradeOnLoadFail(url, type)` 统一入口，让 Panorama/Image/Gif/Video 的 `onError` 统一调用，并暴露「已降级」徽标。

### 2.3 外部数据校验薄弱（P1）
- **JSON 解析**：`TextNode` 自动拆分把 LLM 返回 JSON 解析失败降级为「普通文本」，但**仅 `console.warn`，未提示用户**「拆分失败，已展示原文」（`TextNode.jsx:162-169`）。
- **连接关系**：各节点用 `connected?.images?.find(...)` 等 `?.` 链静默，上游未连/空输出时**无明确提示**，仅空白。
- **节点 data 形态**：`useNodeGeneration` 的 `doneUrl` 曾因上游返回对象触发 `.startsWith` 崩（已修），说明**跨模块数据契约未强校验**。

**建议**：
- 入参校验层：节点接收 `connected`/上游 data 时做 `shape` 校验，校验失败显示「上游数据异常」占位而非空白。
- `TextNode` 解析失败时显式标注「拆分失败，已展示原文」。

### 2.4 离线/弱网兜底不连贯（P2）
- `chatApi` 网络异常仅返回错误文案，无「离线模式」感知；`useLocalToolStatus` 有 localTool 在线态但**未驱动 UI 降级提示**。
- 生成类节点（走 `useNodeGeneration`）在 localTool 离线时应提前拦截并提示，而非等到 fetch 失败。

**建议**：`useNodeGeneration.start` 校验 `useLocalToolStatus` 在线态，离线直接 `validate` 失败提示「本地服务未启动」。

### 2.5 重试收口覆盖不全（P2）
- `useNodeGeneration` 统一 `registerTaskRetry`（「再来一次」），但**手写生成逻辑的节点**（如 `VideoProcessNode` 用 `controller` 自管、部分节点未接 `useNodeGeneration`）无统一重试入口。

---

## 3. 现状分布速查（grep 实证）

| 维度 | 现状 | 证据 |
|---|---|---|
| ErrorBoundary 覆盖 | full（main.jsx）+ node（NodeShell）两级 | `main.jsx:14`、`ErrorBoundary.jsx` 注释 9-10 |
| 生成统一收口 | 完整 | `useNodeGeneration.js` |
| 性能模式降级 | 已覆盖 11 节点 | grep `useMediaDegrade` 11 文件 |
| 加载失败降级 | 点状自管（Panorama/Image） | `PanoramaNode.jsx:33`、`ImageNode.jsx` |
| console.* 散落 | 22 处 | grep `console.(error|warn)` |
| 外部 JSON 校验 | 弱（静默降级） | `TextNode.jsx:162-169` |
| 离线态 UI | 无 | `useLocalToolStatus` 未驱动降级 |

---

## 4. 建议的收口路线图（供后续 TASK 拆解）

1. **TASK-056-A（P1）**：收敛全仓 `console.*` → `logger`；`ErrorBoundary`/`useNodeGeneration` 冗余 console 清理；新增「错误/降级面板」聚合。
2. **TASK-056-B（P1）**：补媒体加载失败的统一回退中枢（在 `useMediaDegrade` 上加 `degradeOnLoadFail`），接入 Panorama/Image/Gif/Video 的 `onError` + 降级徽标。
3. **TASK-056-C（P1）**：外部数据入参校验层（连接关系 / 节点 data shape / JSON 解析提示）。
4. **TASK-056-D（P2）**：localTool 离线态驱动生成前置拦截 + 全局弱网提示。
5. **TASK-056-E（P2）**：未接 `useNodeGeneration` 的手写节点逐步迁移，统一重试入口。

---

## 5. 不在本任务范围
- 不修改任何业务代码（探索性文档）。
- 不实施 §4 路线图（待评审后拆 TASK）。
- 性能、权限、国际化相关错误处理未深入（本次聚焦「收口缺口」）。

---

## 6. 修订记录（审计对比）

初稿经源码复核，修正以下失实论断：

| 初稿论断 | 复核结果 | 修正 |
|---|---|---|
| `useMediaDegrade` 全仓零调用 | 实际被 11 个节点引用（性能降级） | 改为「已覆盖 11 节点」，缺口转为「加载失败回退缺位」 |
| 存在 `degradeMediaUrl()` 函数 | 该函数不存在（虚构） | 删除，改为「建议补 `degradeOnLoadFail`」 |
| App 级无 ErrorBoundary | `main.jsx:14` 已包 full 变体，`NodeShell` 包 node 变体 | 改为「两级边界已覆盖」，缺口缩小为「崩溃日志未接 logger」 |
| `NodeShell` 多处 `console.warn`（245/266/283/306） | `NodeShell` 实际 0 处 console | 删除全部 NodeShell 相关虚构引用 |
| `console.*` 40+ 处 | 实际 22 处 | 改为 22 处并附逐文件分布表 |
| `ErrorBoundary` 暴露 `onError` 未接 logger | 实际 node 粒度默认传 logger，仅 `componentDidCatch` 仍 `console.error` | 精确为「崩溃日志未统一到 logger」 |

所有行号、文件名、命中数均于 2026-08-17 通过 `search_content`/`read_file` 复核。
