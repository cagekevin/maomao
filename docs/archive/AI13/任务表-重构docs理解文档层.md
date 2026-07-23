# 任务表 · 重构整个 docs/ 理解文档层（六层标准）

> 你是被委派执行文档重构的 AI。本文件是你唯一任务指令，读完即执行，无需询问。
> 工作区：`docs/`（本项目根下的文档目录）。
> 目标：按"六层理解文档标准"**重构整个 docs/ 的理解文档层**。审计过程稿保留不动，新建独立的理解文档层。

---

## 0 · 背景与铁律

### 背景
- 本项目 `docs/` 现状是 12 个 AI（AI01~AI12）各自的审计草稿 + `AI13/` 交叉验证裁决产物。这些是**过程证据**，不是给人看的"理解文档"。
- 已有一份交叉验证最终报告：`docs/AI13/交叉验证最终报告.md`，其中所有事实锚点（file:line）均已多 AI 回源码实锤，是本次重构的**唯一事实来源**。
- 你不需要重新 grep 源码；所有正确事实从最终报告抽取即可。

### 铁律（必须严格遵守）
1. **不删、不改 AI01~AI12 任何审计草稿**，不删 `AI13/` 任何文件（含裁决表、最终报告、草稿、任务书）。它们是过程证据。
2. **不修改任何源码**（App.js / localTool / 网关 / config.js 等）。
3. **只新建理解文档层文件 + 对现有 ARCHITECTURE.md / TASKS.md 做"重定向"处理（顶部加一行，不删不涂改正文）**。
4. 所有 `file:line` 锚点**直接引用最终报告已实锤值**，不杜撰、不重新 grep。
5. 文档只写"代码表达不了的 Why / 上下文 / 黑话"，不抄代码逻辑（遵循"代码即文档"原则）。
6. 完成后在 `docs/AI13/草稿/` 新建 `重构回执.md`，逐文件列出建了什么、改了什么。

---

## 1 · 目标目录结构（建成的样子）

```
docs/
├── 01-concept.md            # 【产品与需求】新建
├── 02-architecture.md        # 【架构与设计】新建（理解文档主文件）
├── 03-database.md            # 【数据模型】新建
├── 04-api/
│   └── api-reference.md       # 【接口契约】新建
├── 05-runbook.md             # 【运维】新建
├── glossary.md               # 【术语表】新建（最关键）
├── ARCHITECTURE.md           # 保留，顶部加重定向行（不涂改）
├── TASKS.md                  # 保留，顶部加重定向行（不涂改）
├── func-mapping.txt          # 保留不动
├── var-mapping.txt           # 保留不动
├── FUNCTION_MAP.md           # 保留不动
├── PROJECT_LOG.md            # 保留不动
├── PROJECT_ORIGIN.md         # 保留不动
├── 猫猫AI画布使用教程合集.md  # 保留不动
├── audit/                    # 保留不动
├── AI01/ ~ AI12/             # 保留不动（审计过程稿）
└── AI13/                     # 保留不动（裁决产物）
```

---

## 2 · 各文件任务细则

### 文件 1：`docs/glossary.md`（术语表，最高优先级，先做）
记录交叉验证实锤的"同名遮蔽 + 真身锚点 + 已证伪项"。直接抄以下已实锤内容（来源：最终报告第二节 + 裁决表）：

- **同名遮蔽全集**（每个都标"绑定A @行 / 绑定B @行"）：
  - `ei`：`L1853 var ei = new Map()` 缩略图缓存 / `L36784 ei=Y.useCallback` 节点打组 / `L43950 ei=async` GAS pushToCloud
  - `ti`：`L36822 ti=Y.useCallback` 清缓存 / `L43974 ti=async` GAS pullFromCloud
  - `Jn`：`L89 function Jn` LogoIcon 组件 / `L32490 let Jn=Y.useCallback` 生图主回调
  - `Zr`：`L1827 async function Zr` 下载/URL上传（resourceAdded@L43539 调用）/ `L43893` logout（`Q.remove(Z.AUTH_TOKEN)`）
  - `we`：`L4176 we=(t,n=false)=>{}` insertMention / `L43015 we=Y.useCallback` 资源 rescan（rescan 真身 `Ev`@L42883）
  - `R`：`L29149` 文件预览回调 / `L33005` 网关 base（轮询 `${R}/v1/tasks/{id}`）
  - `Th`：`varL187` Director3DNode 声明 / `L31141 director3dNode: Th` 注册（非失效）
- **动态配置**：`Hr` = `localEngineBase()`@L1732，随 USE_LOCAL_ENGINE 开关取 18080/9004；`vv`@L42808 字面值写死 18080。
- **已证伪（红字警示"勿再引用"）**：
  - `canvas-state-change` —— 源码 grep 0 命中，画布持久化走 `Q.saveCanvasState`(L1642) 直接写
  - `mutiwindow-sync-local` —— 源码 grep 0 命中，实为 `handleSyncLocal`@L44426 函数
- **跨包真身**：`toAbsoluteFileUrl` 真身 = `localTool/src/routes/resources.ts#L31`（App.js 内 0 命中；L43548 仅 `${Hr}${url}` 拼接）
- **3D 系统**：`$d`=DirectorShell@L24391（布局壳），`Th`=Director3DNode@L31141（节点壳），同属 3D 两层封装。

文件头加：`> 术语表经 AI13 交叉验证实锤（2026-07-21），锚点来源 docs/AI13/交叉验证最终报告.md`

### 文件 2：`docs/01-concept.md`（产品与需求，轻量）
- 一段话核心价值：本地画布 + AI 生图 + 本地工具链（localTool）+ 网关 + GAS 云同步闭环的 Chrome 扩展/本地应用。
- 2~3 个用户故事（从最终报告反推，例）："作为用户，我拖入图片 URL，系统经 resourceAdded 跨进程落盘并刷新资源面板"；"作为用户，我触发 AI 生图，结果经 mutiwindow-task-completed 广播回填节点并 rescan 资源"。
- 边界（不做什么）：不做云端协作编辑、不内置模型推理、不做多用户权限系统。

### 文件 3：`docs/02-architecture.md`（架构主文件，核心）
- **系统拓扑**（Mermaid 或文本图）：`前端 App.js(18080)` ↔ `localTool(18080 文件/资源)` ↔ `网关(9004 AI 任务)` ↔ `GAS(云同步)`；Chrome 扩展 background 经 chrome.runtime 跨进程注入 resourceAdded。
- **技术选型 ADR（Why）**：为什么 localTool 独立进程（文件落盘/缩略图）；为什么双 base（USE_LOCAL_ENGINE=true→18080 本地，false→9004 网关，Hr 动态切换）；为什么事件总线用 mutiwindow-* CustomEvent + chrome.runtime 双轨。
- **已裁决事实段**（直接写正确版，不带"冲突"叙事，全部引自最终报告）：
  - 画布持久化：`Q.saveCanvasState`(L1642) 直接写 localforage，**无 canvas-state-change 事件**。
  - 事件总线真实事件：`mutiwindow-task-completed`(L38481) / `mutiwindow-update-task-meta`(L41032)；`canvas-state-change`、`mutiwindow-sync-local` **已证伪（源码 0 命中，勿引用）**。
  - 资源落盘：拖入 / `resourceAdded`(跨进程 L43527) 触发 `Zr`@L1827 下载落盘；`toAbsoluteFileUrl` 真身 `localTool/resources.ts#L31`。
  - 3D：`Th`=Director3DNode(L31141 注册)、`$d`=DirectorShell(L24391)。
  - 撤销重做：store.r 接管（非经 onChange）。
  - AI 生图：Jn@L32490 生图主回调，内部轮询 GET /v1/tasks/{id}@L33005，completed→images[].url[0]→ii 落盘@L33049。
- 文件头加：`> 事实锚点经 AI13 交叉验证实锤（2026-07-21），详见 docs/AI13/交叉验证最终报告.md`

### 文件 4：`docs/03-database.md`（数据模型）
- 核心实体（来自 localTool，来源 AI08/11 审计 + 最终报告）：`resources` 表（resources.ts）、`tasks` 表（tasks.ts）。
- 特殊字段枚举：`source` ∈ {`local-tool`, `extension`} —— 孤儿清理只清 `local-tool`（resources.ts L120-130）；`media_meta` 由 taskToRow 序列化（tasks.ts L19/L36）。
- 已知债务：tasks clear 无删盘路径（tasks.ts L102，比 P2#6 更深）；单删 wv@L42857 只删 DB 不删盘。
- 附关键字段说明即可，不贴全 DDL。

### 文件 5：`docs/04-api/api-reference.md`（接口契约）
- localTool 端点：`POST /api/files/upload`（ii@L1888→Xr@L1802）、`POST /api/resources/rescan`（Ev@L42883）、`POST /api/resources/save` upsert（Sv@L42838）、`POST /api/resources/delete` 只删 DB（wv@L42857）。
- 网关端点：`GET /v1/tasks/{id}` 轮询（9004）、chat SSE（main.py L434-574，abort→400 L502/L521，超时→504 L541，heartbeat L549）。
- **已知偏差记录**：网关 README 与 main.py 矛盾（music/audio 写 chat 实 501，main.py L655/L659/L663）——记此处作"待修项"。
- 跨进程消息（非 HTTP）：`resourceAdded`（chrome.runtime，background.ts L102→App.js L43527）。

### 文件 6：`docs/05-runbook.md`（运维，抽自启动项目.ps1）
- 环境依赖：Node / Python 版本（读 `启动项目.ps1` / `package.json` 抽取，不猜）。
- 启动步骤：第 1 步启动 localTool、第 2 步启动网关、第 3 步启动前端（照 `启动项目.ps1` 抽，目标重装系统后 5 分钟跑起来）。
- 配置：建议指向 `.env.example`；若项目无 `.env.example`，在本文注明"配置项见 config.js（USE_LOCAL_ENGINE / LOCAL_ENGINE.base 等）"。

---

## 3 · 对现有文件的处理（仅重定向，不涂改）

- `docs/ARCHITECTURE.md`：在**文件最顶部**插入一行（不删不改原有内容）：
  `> ⚠️ 本文为旧版架构描述，已迁移至 docs/02-architecture.md（理解文档主文件，含交叉验证实锤事实）。旧版保留仅供追溯。`
- `docs/TASKS.md`：在**文件最顶部**插入一行：
  `> ⚠️ 本文为旧版任务/审计计划，审计结论已汇总至 docs/AI13/交叉验证最终报告.md；理解文档见 docs/02-architecture.md。旧版保留仅供追溯。`
- **不得**删除、不得改写 ARCHITECTURE.md / TASKS.md 任何原有正文。

---

## 4 · 执行顺序建议
1. `glossary.md`（先做，统一黑话）
2. `01-concept.md` → `05-runbook.md`（轻量新建）
3. `02-architecture.md`（核心）
4. `03-database.md` → `04-api/api-reference.md`
5. 给 ARCHITECTURE.md / TASKS.md 加重定向行
6. 写 `docs/AI13/草稿/重构回执.md`

---

## 5 · 验收标准
- [ ] 六层文件全部新建，内容来自最终报告实锤锚点，无杜撰行号。
- [ ] glossary.md 含全部同名遮蔽 + 已证伪项。
- [ ] ARCHITECTURE.md / TASKS.md 仅顶部加重定向行，正文未动。
- [ ] AI01~AI12 / AI13 / 源码 均未触碰。
- [ ] 重构回执写毕，列明每个文件改动。

> 本任务表由 AI13 生成（2026-07-21），作为"重构整个 docs/ 理解文档层"的执行指令。事实源唯一：`docs/AI13/交叉验证最终报告.md`。
