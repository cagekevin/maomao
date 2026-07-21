# AI03 · 一毛AI画布 架构审计整理（V1）

> 本轮审计全部产出**仅存放于 `docs/AI03/`**，不向项目其他目录写入任何文件。
> 审计对象：当前运行的 **V1 引擎**（`src/_engine/App.js` + `config.js` + `localTool/` + `apimart-gateway/`）。
> **V2 永久暂停，只读归档，不碰、不接、不写。**

---

## 0. 审计依据（信任链，从高到低）

1. **实际代码 + grep 实敲**：唯一权威。行号会漂移，引用必须先 grep 确认当前行号。
2. **映射表**：`docs/func-mapping.txt` + `docs/var-mapping.txt`（混淆名→可读名）。
3. **项目文档**：`CLAUDE.md`(红线) / `PROJECT_ORIGIN.md` / `ARCHITECTURE.md` / `TASKS.md` / `FUNCTION_MAP.md`。
4. **历史笔记** `docs/reference/`：可能过时，仅作线索，引用前以代码/git 为准（CLAUDE.md §6 / PROJECT_ORIGIN §8.5）。

> ⚠️ 文档里的行号是 2026-07-20 快照，已漂移。本目录所有审计事实都以「grep 实敲当前行号」为准，文档行号只作搜索起点。

---

## 1. 红线（动手前必读，来自 CLAUDE.md §3）

- **修改范围**：只改 `App.js`(核心) / `config.js`(配置)。**本审计不修改任何源码**，纯产出文档。
- **禁止触碰**：`dist/`、vendor / runtime / `*.css`、`App.original.js`、`reference/App.original.js`。
- **版本锁定**：严格 V1；V2 当只读归档。
- **命名**：混淆名(`ii`/`Xr`/`U_`/`W_`/`G_`)无稳定语义，**引用必须带行号**；新增变量用语义化命名(本审计不新增代码)。
- **已知噪音不修**：9004 的 404、`RootErrorBoundary` null、`18080` 连不上。

---

## 2. 本轮范围与产出清单

| 文件 | 内容 | 状态 |
|------|------|------|
| `README.md`（本文件） | 导航 + 红线 + 信任链 | ✅ |
| `映射表补全记录.md` | 落实 TASKS T0 阻塞项：核对 `Jn`/`Xr`/`Zr`/`Ev`/`we`/`ii`/`wv`/`B`/`R` 真实身份与行号，修正旧文档错锚 | ✅ |
| `校验方案.md` | 门3 机器校验思路（grep 回源码交叉验证，防幻觉） | ✅ |
| `模块1-初始化与配置层.md` | 系统初始化 / 鉴权 / 配置层审计 | ✅ |
| `模块2-本地数据层与Rescan.md` | localTool 交互 / 资源入库 / rescan / 缩略图 | ✅ |
| `模块3-AI生成与网关层.md` | 生图/视频/聊天 派发 + 轮询 + 落盘 | ✅ |
| `模块4-画布引擎与节点.md` | ReactFlow 交互 / 节点组件 / 3D 导演台 | ✅ |
| `交叉流审计.md` | 端到端缝合（AI生成→落盘→资源面板 等） | ✅ |
| `审计问题清单.md` | 发现的可疑 Bug 回填，对照 TASKS P0–P2 | ✅ |
| `audit-check.cjs` | 门3 机器校验脚本（遍历 AI03/*.md 抽 `file:Lnnnn` 回源码 grep） | ✅ |
| `校验报告.md` | 脚本输出（当前 158/158 ✅，0 阻断项） | ✅ |

> 图例：✅ 已完成 · 🔜 进行中/待做 · ⏳ 未开始
> 全部模块已通过门3 机器校验（TASKS 门5 条件满足）；门4 对抗审计已对核心结论反向质询验证（见下「门4 对抗结论」）。

---

## 3. 审计方法（四段式 + 校验门）

每个模块文档采用四段式结构：
1. **运转图景**：本模块负责什么、在系统里什么位置。
2. **核心混淆字典**：本模块涉及的混淆名→可读名（先查映射表，未收录的 grep 坐实后补入 `映射表补全记录.md`）。
3. **关键数据流**：带 `file:line` 的调用链。
4. **存疑 Bug**：对照 `TASKS.md` 的 P0–P2，标出本模块相关的风险与证据。

每条事实必须带 `file:line`；写完用 grep 回源码交叉验证（见 `校验方案.md`）。

---

## 4. 已知阻塞项（来自 TASKS T0，本轮先解）

旧文档存在错锚，必须先纠正再审计：
- `Jn` 实为 `LogoIcon`（品牌图标组件），**非** AI 生图回调 → 生图派发函数需重新定位。
- `Xr = openInTab`（活动标签打开 URL），**非**上传函数。
- `Zr = logout`（重置配置），**非**下载函数。
- `Ev`/`we`(rescan) / `ii`/`R`(上传) / `wv`(删) / `B`/`R`(资源面板回调) 真实行号待 grep 坐实。

→ 详见 `映射表补全记录.md`。

---

## 5. 门4 对抗审计结论（反向质询 · 防自我辩护）

对三条核心负面结论做「A 调 B，B 返回在哪被消费？」反向质询，grep 调用点消费方验证：

1. **流C 画布落盘不触发面板**（P1-交叉-01）
   - 质询：grep 全部 `Di.current()`/`we()`/`rescanThrottledSync()` 调用点（共 8 处：L31426/L43031/L44123/L44350/L44420/L44429/L44435），无一来自 `onDrop: Lr`(L36293) 调用链。L44420 属同步函数 finally，L44435 属 transit 面板 tab 切换，均与画布 onDrop 无关。
   - 结论：**成立**。落盘 `canvas/drop/`(L36363) 后无 rescan 路径，面板不可见。

2. **节点内 onDrop 不落盘**（P1-1）
   - 质询：读 `B`(L29188) 全函数——文件拖入走 `R(files)`(L29194) 后存 `O([...source:'drop'])` 内存态；URL 拖入存 `O([{url:t}])`(L29204)。全程无 `ii`(uploadFile) 调用。
   - 结论：**成立**。

3. **流A 生成完成自动入库**（对照验证）
   - 质询：`mutiwindow-task-completed` listen(L31428) → `i==='completed'` 时 `Ev().then(()=>Di.current())`(L31426)。`Di.current=we`(L44350)，`we`(L43015) 内 `await Ev(); D((await xv(...)).items)` 刷面板。
   - 结论：**链路闭合成立**，与流B/C 断裂形成对比。

> 门4 三结论均经反向 grep 取证，无自我辩护漏洞。

### 5.1 门4 补充：模块1-2 核心 P0/P2 反向质询

4. **P0 双 base URL 两处独立源**（模块1）
   - 质询：`Hr = localEngineBase()`(L1732) 来自 `localEngineBase()` 函数计算；`vv = LOCAL_ENGINE.base`(L42808) 来自 `LOCAL_ENGINE.base` 对象属性。grep 确认两定义点独立、无共享单一配置源。
   - 结论：**成立**（跨 `USE_LOCAL_ENGINE` 切换 18080/9004 时易漂移）。

5. **P2 删除不删磁盘**（模块2）
   - 质询：读 `wv`(L42857) 全函数——仅 `fetch(\`${vv}/api/resources/delete?id=...\`, {method:'POST'})`(L42859)，无磁盘删除参数；对比 `Tv`(L42866) `fetch(\`${vv}/api/resources/clear\`)` 带 `t=true` 开关支持删磁盘。
   - 结论：**成立**（`wv` 单删无 deleteFiles 联动，长期产孤儿文件）。

6. **P2 缩略图伪复制**（模块2 / localTool）
   - 质询：读 localTool `files.ts`——L131 `thumb_${basename}` + L134 注释「简单复制原图（无 sharp 依赖时）」+ L137 `fs.copyFileSync(filePath, thumbPath)`；L248 `thumb_${maxDim}x${quality}_` 同样 L253 `copyFileSync`。文件名含 maxDim/quality 但仅复制。
   - 结论：**成立**（无真实缩放，文件名误导）。

> 门4 现覆盖交叉流3条 + 模块1-2 共3条核心结论，全部反向 grep 取证成立。

### 5.2 门4 补充：模块3 核心结论反向质询

7. **生图 N 分支轮询真实存在**（模块3）
   - 质询：读 `Jn`(L32490) 内 `N` 分支——L32987「A-C1: task_id 检测 + 分流」→ L32990 异步轮询分支 → L33001 `while(true)` 轮询 → L33005 `pollUrl=\`${R}/v1/tasks/${taskId}\``。
   - 结论：**成立**（N 分支轮询链路坐实，模块3 锚点无误）。

8. **pending_confirmation 置 await_confirm，无自动 confirm**（模块3 / TASKS 已知限制）
   - 质询：grep `confirmTaskId`/`await_confirm`/`AUTO_CONFIRM` 仅 3 处——L32983(`markNeedsConfirm` 写入)、L11194/L12706(`onConfirm` prop)。`makeConfirmAdapter`(L32960) 是手动 confirm POST 适配器，`resolveNeedsConfirm`(L32957) 仅返回 id。轮询循环(L33001) 检测到 pending_confirmation 时只 `markNeedsConfirm`(L33059) 退出，**无自动 confirm 路径**。
   - 结论：**成立**，与 TASKS「pending_confirmation 卡轮询(AUTO_CONFIRM=false)属无害限制」一致，非审计新 Bug。

9. **事件总线 dispatch↔listen 配对**（模块3 / 交叉流）
   - 质询：`mutiwindow-task-completed` dispatch(L38481 等5点) 与 listen(L31428 `window.addEventListener`) 配对；listen 内 `i==='completed'` 触发 `Ev()`+`Di.current`(L31426)。
   - 结论：**成立**（详见 §5 质询3）。

> 门4 现覆盖 **9 条核心结论**（交叉流3 + 模块1-2 的3 + 模块3 的3），全部反向 grep 取证成立，无自我辩护漏洞。

### 5.3 门4 补充：模块4 核心结论反向质询

10. **批量连线依赖 selected 无 UI 引导**（模块4 / P2-画布-02）
   - 质询：读 `xn`(L31883) 内 L31905 `t.find(t=>t.id===e.source)?.selected` → L31906 `n=t.filter(e=>e.selected)` → L31907 `if(n.length>1)` 才批量；`kn`(L31980) 另支持多选点目标批量。两路径均依赖选择集，无 UI 提示。
   - 结论：**成立**（非 Bug，体验风险）。

11. **节点生成统一入口 Z 注入的 onGenerate 被消费**（模块4核心）
   - 质询：`Z`(L35536) 注入 `onGenerate: e==='promptNode'?sr:undefined`(L35572)；消费方 L5034 `n.onGenerate && n.onGenerate(e,u,'1024x1024',...)`（promptNode 节点内生成按钮），且 L36564 强制 `t.onGenerate!==sr && (t.onGenerate=sr)` 同步。
   - 结论：**链路闭合成立**（Z 注入 → promptNode.data.onGenerate → sr 实际派发，呼应模块3 Jn）。

12. **spawnable 集合两处重复定义**（模块4 / P2-画布-03）
   - 质询：对比 `App.js:L4141` 与 `App.js:L5446`，两者均为 `new Set([promptNode, imageNode, imageBoxNode, videoNode, sd2VideoNode, discountVideoNode, gridSplitNode, gridMergeNode, cropNode, urlToImageNode, fileToUrlNode, panoramaNode, videoExtractNode])`，内容完全一致。
   - 结论：**成立**（合并为单一常量即可）。

> 门4 现覆盖 **12 条核心结论**（交叉流3 + 模块1-2 的3 + 模块3 的3 + 模块4 的3），全部反向 grep 取证成立，无自我辩护漏洞。四大模块 + 交叉流审计结论均经对抗验证。

---

## 6. 后续建议（需用户授权方可执行，超出 AI03 范围）

- **T4.1 修 `ARCHITECTURE.md`**：`Jn` 实为 `LogoIcon`、`Xr=openInTab`、`Zr=logout`、spawnable 误读等错锚纠正（文件在 `docs/`，非 AI03）。
- **T4.2 修 `TASKS.md`**：`Zr()` 下载表述、Sv/sv 厘清、wv/R/B/ii 行号回填（文件在 `docs/`，非 AI03）。
- **T3.1 合并终极文档**：拼 `docs/audit/一毛AI画布-权威重构指南.md`（目录在 `docs/audit/`，非 AI03）。

以上三项均**写入 AI03 以外目录**，按本轮约束须用户明确同意后执行。当前 AI03 内审计任务已全部完成并通过门3/门4。
