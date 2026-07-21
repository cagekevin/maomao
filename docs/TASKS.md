# 一毛AI画布 · 任务板（Bug + 修复清单 + 排查）

> 从 `ARCHITECTURE.md` 拆出的可行动任务集合：已知 Bug 风险（P0–P2）、对应修复清单、以及专项排查建议。
> 行号快照 2026-07-20，会漂移，动手前重新 grep 确认。

---

## 已知 Bug / 风险（P0–P2）

### P0 — 必然导致问题
1. **资源面板 URL 格式不统一破图**（已 `d5d48dd` 修复，残留: host 硬编码 18080；中文目录/文件名 Latin1 乱码待修）

### P1 — 特定条件触发
2. **资源面板 URL 拖入不落盘**: `B` 回调(L29160–29179) 只存状态不下载，刷新丢失
3. **资源面板 file input 上传不自动入库**: `R` 回调(L29165–29166) 上传后不调 Sv()，需手动 rescan
4. `handleUploadFormData` fileUrl 跨域失败 — **实际不是问题**(Node fetch 不受 CORS 限制)

### P2 — 逻辑/设计缺陷
5. ResourceAdded base URL 不一致（见交叉点 3，仅 `USE_LOCAL_ENGINE=false` 触发）
6. **资源删除不删磁盘文件**: `wv()`(L42778) 只删 DB，长期产生孤儿文件
7. **Rescan 孤儿清理只清 source='local-tool'**: source='extension' 记录不被清理
8. **缩略图伪复制**: 仅 copyFileSync，文件名 `thumb_{maxDim}x{quality}_` 有误导性

### 其他已知限制（无害）
- 音频/音乐生成 501；剪映发送占位；单任务 `pending_confirmation` 卡轮询(AUTO_CONFIRM=false 时)；网关 404 噪音无害；RootErrorBoundary useState null 无害；18080 连不上功能受限不崩；V2 未启用

---

## 建议修复清单（任务）

| 优先级 | 问题 | 修复方案 | 涉及文件 |
|--------|------|---------|---------|
| P0 | URL 格式不统一破图 | Sv() 保存前 `toAbsoluteFileUrl(i.url)` | App.js L43462 |
| P1 | 拖入 URL 不落盘 | 拖入 URL 时调 Zr() 下载或提示 | App.js L29176 |
| P1 | 文件上传不入库 | R(files) 成功后调 we()/Sv() | App.js L29133 |
| P2 | 删除不删磁盘 | wv() 加 deleteFiles 参数可选联动 | App.js L42778 |
| P2 | 缩略图伪复制 | 接入 sharp 做真实缩放 | localTool files.ts L136 |
| P2 | 统一 base URL | Hr 和 vv 用同一配置源 | App.js L1732/L42729 |

---

## 排查建议（"发送到资源"不落盘）
1. 查 localTool 日志: 是否有 `POST /api/files/upload` + fetch 下载日志
2. 查端口: localTool 是否在 18080
3. 查 `~/.yimao-localtool/uploads/migrated/` 是否真没写
4. 查 DevTools 网络: resourceAdded 是否被前端接收
5. 查数据源: 资源在 transitItems(内存) 还是 resources(持久)
6. 查 `YIMAO_DATA_DIR` 是否指向不同目录

---

# 架构审计计划（模块化理解文档 · 终极重构指南）

> **目标**：用「切香肠」法（一次一个模块，四段式输出）让 AI 逐模块啃下 4 万行反编译巨兽，产出《一毛AI画布-权威重构指南》。
> **铁律**：任何模块锚定的混淆名必须先过映射表；映射表没收录的，先解码再写 prompt，禁止让 AI 基于猜测名推理（会幻觉）。
> **当前阻塞**：映射表缺口未补（见 T0），阶段二 prompt 不能直接用原版（原版 `Jn`/`Ev`/`Xr`/`Sv`/`Zr` 锚点有误）。

## 审计工作流（防错与校验门 · 统领各阶段）

> **核心原则**：映射表 + 代码是唯一权威；AI 写的模块文档只是「派生草稿」，默认不可信，必须过校验门才能转正。单 AI 单遍写必错（已抓 `Jn`/`Zr` 误锚），故强制五关 + 防污染。

### 五关流水线
1. **门1 锚点门（写前）**：只允许用 `func-mapping.txt`/`var-mapping.txt` 已收录名 + 自 grep 确认行号；新发现函数**先入映射表**再写，禁止边写边猜。
2. **门2 强制引用（写中）**：每条事实带 `App.js:Lnnnn` 或 `localTool/...:Lnnn`，禁止无出处断言。
3. **门3 机器校验（写后·脚本）**：跑 `scripts/check-doc-citations.cjs`，正则抽文档内 `App.js:L\d+` / `函数名()`，去源码 grep 确认符号与行为字符串存在 → 输出 `校验报告.md` 逐条 ✅/❌。**不依赖 AI 判断，专治幻觉。**
4. **门4 对抗审计（写后·逻辑质询）**：门3 只查名字/行号存在，查不了逻辑对错。对「存疑 Bug / 数据流」做反向质询（"A 调 B，B 返回在哪被消费？grep 给我看"），由**不带写手上下文**的会话或同会话切「审计模式」执行，避免自我辩护。
5. **门5 入库门**：校验报告全绿 + 审计无阻断项 → 模块从 `_DRAFT` 标「已验证」并入终极文档；否则打回重写。

### 防污染规则
- 模块草稿文件名带 `_DRAFT`；终极文档只收「已验证」模块。
- **后续模块审计不许把前序模块 doc 当真理**，只能当线索，最终仍回代码核对（防错传错）。
- 映射表是唯一可信锚层；文档是派生，错了改文档，别改代码迁就文档。

### 角色执行
- 单会话两轮：先「写手模式」产出 → 跑门3脚本拿硬报告 → 切「审计模式」质询逻辑，中间用脚本切断自我辩护链。
- 双会话：A 写、B 审；**B 只拿代码 + 映射表 + 模块 doc，不拿 A 的推理过程**。

### 工作流配套任务
- **T0.4** 写 `scripts/check-doc-citations.cjs`（门3 机器校验脚本）：输入模块 md，输出 `校验报告.md`（❌ 项列出），作为后续每模块必过审计关。
- **T5.1** 每模块写完跑门3 → 出校验报告 → 有 ❌ 打回（挂在本模块任务下，如 `T2.1` 完成后须附 `校验报告.md`）。

## 阶段 0：补映射表（前置阻塞项，未补不能审计）

**根因**：原版「终极架构师」prompt 的多个锚点在 `func-mapping.txt`(52个) / `var-mapping.txt` 中不存在或错误，导致 AI 会基于错名瞎编。

### T0.1 解码并补入 `func-mapping.txt`（App.js 已反查到位置，待回函数体坐实语义）
| 混淆名 | 已定位证据 | 疑似语义 | 状态 |
|--------|-----------|---------|------|
| `Ev` | App.js L31426 `Ev().then(...)` 生成完成触发后端 rescan | rescan 触发器 | ⬜ 待补 |
| `we` | App.js L42834 `fetch(${vv}/api/resources/rescan)`；L42980 `rescanThrottledSync→await we()` | rescanResources 主函数 | ⬜ 待补 |
| AI 生成 N 分支派发 | App.js L32957 `task_id 检测 + 分流`；L32975 `pollUrl=${R}/v1/tasks/${taskId}` | 异步轮询派发函数（**非 `Jn`**） | ⬜ 待补（找函数名） |
| 资源入库 | App.js L43465 `resourceAdded` 事件处理 | 资源写库函数（疑似 `Sv` 大写，待定） | ⬜ 待补 |
| 资源删除 | App.js L42778 `wv()` | 删 DB 不删磁盘（P2） | ⬜ 待补 |
| 上传/下载 | App.js L1812/L1832 `fetch(${Hr}/api/files/upload)`；L19098 `uploadFile` useCallback | 落盘上传函数（疑似 `ii`/`R`） | ⬜ 待补 |
| 缩略图缓存 | 前端 `ri()`（ARCHITECTURE L2.4 引用） | 内存缓存 Map | ⬜ 待补 |

### T0.2 核对 `var-mapping.txt` 易混项
| 项 | 现状 | 动作 |
|----|------|------|
| `Zr = logout`（L48） | 被旧文档当「下载函数」误用（TASKS 行34 / ARCHITECTURE L2.5） | ❗ 纠正：下载非 Zr |
| `sv = nodeCallbackFieldSet`（L178） | 与「资源入库 `Sv`(大写)」易混 | 厘清大小写，补 `Sv` 真身 |
| `Hr` / `vv` | base URL 两处（ARCHITECTURE L42729/L1732） | 补入并标注来源 |
| `B` / `R` / `ii` / `wv` / `ri` | 模块2 回调/函数，未收录 | 解码补入 |

### T0.3 产出《映射表补全记录》
- 把 T0.1/T0.2 坐实结果回写 `func-mapping.txt` + `var-mapping.txt`，并标注行号。

## 阶段 1：全局初始化（阶段一握手 prompt）
- **T1.1** 写「系统指令：反编译巨兽架构审计计划」prompt（角色=首席反编译架构师；规约=模块化逐步审计+禁捏造+排雷导向；模块划分=4 块），**不立即写内容**，等 AI 回「架构审计计划已就绪」。
- **T1.2** 校验 prompt 引用的文档路径存在：`ARCHITECTURE.md` / `func-mapping.txt` / `var-mapping.txt` / `TASKS.md`（均存在 ✅）。

## 阶段 2：逐模块审计（四段式：运转图景 / 核心混淆字典 / 关键数据流 / 存疑 Bug）
> **边界契约硬要求**：每个模块 doc 须额外含「边界契约」子节，记录本模块**接收/发出的接缝**——HTTP 路由（如 `POST /api/files/upload`）、`window` CustomEvent（如 `resourceAdded`/`mutiwindow-task-completed`/`canvas-state-change`）、依赖的 config 开关（`USE_LOCAL_ENGINE` 等）。这些是横向切片（阶段 2.5）的缝合点，须带 `file:line`。
- **T2.1 模块1 系统初始化与配置层**：锚 `Oa`(getAuthToken)/`Jh`(authHeaders)/`Ba`(hasAuthToken)/`ar`(resolveApiUrl)/`tr`(withApiSuffix)/`Nr`(localStorageBackend)/`Pr`(localforageBackend)/`jr`(cachedGet)/`Cr`(canvasStateKey) + config.js 加载与降级兜底。
- **T2.2 模块2 本地数据层与 Rescan**：锚 `Ev`/`we` + 资源入库 + `wv`(删) + `ii`/`R`(上传) + `ri`(缩略图) + 扩展名→类型映射；排雷重点盘 `TASKS.md` P1/P2（删不删磁盘、拖入 URL 不落盘）。
- **T2.3 模块3 AI 生成与网关层**：锚 **真实 AI 生成派发函数（T0.1 解码，非 `Jn`）** + L32957 轮询(task_id) + `uploadFile`(L19098) 落盘 18080 + 事件总线通知；排雷重点：轮询 7 陷阱、`pending_confirmation` 卡死、CDN 直链违规（红线 §3.2）。
- **T2.4 模块4 画布引擎与节点**：锚 `Lr`(onDrop)/`xn`(onConnect)/`kn`(onNodeClick)/`Fr`(onConnectEnd)/`Th`(Director3DNode)/`Cn`(onPaneContextMenu)/`wn`(onNodeContextMenu) + ReactFlow 魔改点 + 3D 导演台接入；排雷重点：新增自定义节点/连线规则与现有混淆逻辑冲突面。

## 阶段 2.5：交叉流审计（横向切片 · 缝合模块接缝）
> 在 T2.1–T2.4 完成后跑。逐个端到端流**沿边界契约的接缝追踪**（路由/CustomEvent/config 名均可 grep 核对），产出完整叙事；模块 doc 只留「此流续见阶段 2.5」指针，避免重复 authorship。对照 `ARCHITECTURE.md` X1(端到端流)/X2(事件总线)/X3(跨层风险) 修正或补全。
- **T2.5.1 AI 生成→落盘→资源面板 全流程**：模块3 派发 → 轮询 9004 `/v1/tasks/{id}` → `uploadFile` 落 18080 `/api/files/upload` → 发 `resourceAdded` → 资源面板刷新（缝合 T2.3+T2.2+T2.4）。
- **T2.5.2 Rescan 孤儿清理与资源入库一致性**：模块2 `Ev`/`we` 触发 `/api/resources/rescan` → 孤儿清理逻辑（TASKS P2：只清 `source='local-tool'`）→ 与「拖入 URL 不落盘」割裂面归因。
- **T2.5.3 配置加载与双服务 base URL 桥接**：模块1 `ar`/`tr`/`Hr`/`vv` + `USE_LOCAL_ENGINE` 切换 18080(localTool)/9004(gateway)；排雷：host 硬编码 18080、中文路径 Latin1（TASKS P0）。
- **T2.5.4 画布事件总线跨模块通知**：`window` CustomEvent 全集（`mutiwindow-task-completed`/`resourceAdded`/`canvas-state-change`/`mutiwindow-sync-local`/`mutiwindow-update-task-meta`）在各模块的收发点梳理，验证状态同步不绕过 `StorageManager`(混淆名 `Q`，红线 §3.3)。
- 每项产出均须过门3脚本校验接缝 `file:line`。

## 阶段 3：合并与总结
- **T3.1** 合并 4 模块输出为 `docs/audit/一毛AI画布-权威重构指南.md`（或分散 `docs/audit/module-N.md` 再拼）。
- **T3.2** 与 `TASKS.md` Bug 表联动：审计中发现的存疑 Bug 回填到上方 P0–P2。

## 附带：修正现有文档错误锚点（与 T0 同步做）
- **T4.1** 修 `ARCHITECTURE.md`：① `Jn` 实为 `LogoIcon`，非 AI 生成，删/改相关表述；② `Xr = openInTab`（L43479），非上传函数，改 L2.5 上传锚点；③ L2.5 的 `Sv()`/`Zr()`/`Xr()` 上传表述按 T0 真名回填。
- **T4.2** 修 `TASKS.md`：① 行34 `Zr()` 下载 → 改用 T0 真名；② `Sv`(大写,资源入库) 与 `sv`(nodeCallbackFieldSet) 厘清；③ `wv`/`R`/`B`/`ii` 待 T0 坐实后回填行号与真名。
