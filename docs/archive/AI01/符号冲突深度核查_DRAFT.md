# 符号冲突深度核查（_DRAFT · 未验证）

> 针对 `README_审计索引.md` 列出的高优先开放问题，逐一回函数体坐实。
> 行号快照 2026-07-21，会漂移，以 grep 为准。归属 V1。未改任何源码。

---

## 问题1：`Z` 到底是 StorageKeys 还是创建节点？

**结论：`Z` = StorageKeys（func-mapping L21 正确，L113 误记）。**

坐实证据：
- `App.js:L1268` `Z = {` 对象字面量，内含 `CANVAS_STATE_PREFIX: 'canvas-state-v1-'`(L1283)
- `Cr`(L1294) 用 `Z.CANVAS_STATE_PREFIX` 构造画布键
- `Z.AUTH_TOKEN` 在 L43894(`Zr=logout` 内 `Q.remove(Z.AUTH_TOKEN)`) 被引用
- 函数内用法全是存储键枚举，无任何"创建节点"逻辑

**func-mapping.txt L113 记 `Z`=创建节点(L36215) 是错误的**（疑似把某创建节点函数误标为 Z）。创建节点的真实函数名需另查（ARCHITECTURE L1.2 引 L36215 同错）。后续审计以 `Z`=StorageKeys 为准，创建节点另 grep（建议查 `screenToFlowPosition`/`addNode` 类调用）。

---

## 问题2：`Xr` L1802 与 L43479/43881 是否同一函数？

**结论：不是同一函数。两处 `Xr` 是不同作用域的不同函数。**

| 位置 | 真实语义 | 证据 |
|------|----------|------|
| `App.js:L1802` `async function Xr(e,t={})` | **uploadToLocalTool（上传落盘核心）** | L1803 `if(!(await Kr()))return null`；L1808 `await qr(e)` 取 blob；L1811 `a.append('file',n,i)`；L1812 `fetch(${Hr}/api/files/upload)`；日志 `[uploadHelper] uploadToLocalTool failed`(L1824)。`ii`(L1888) 内部调用它落盘 |
| `App.js:L43881` `Xr = async e => {...}`（组件内局部赋值） | **openInTab（打开标签页）** | L43882 `if(await qr(e), y&&e.siteUrl)`；L43883 `chrome.tabs.query({active:true})`；L43887 `chrome.tabs.update(t.id,{url:e.siteUrl})`；L43891 `He(e)` |

**func-mapping.txt L173 记 `Xr=openInTab @43479` 是错锚**：真实 openInTab 在 **L43881**（非 43479），且它是组件内局部赋值而非模块级 `function Xr`。模块级 `function Xr`(L1802) 实为 uploadToLocalTool。

**修正建议（回写映射表时）**：
- `Xr`(L1802) = uploadToLocalTool（上传落盘，ii 内部用）
- openInTab 真实锚点 = L43881（局部 `Xr = async e =>`），func-mapping 行号改 43881

---

## 问题3：`we` 三处重名确认

**结论：三处 `we` 是不同作用域的不同函数，grep 必带行号+作用域。**

| 位置 | 语义 | 上下文 |
|------|------|--------|
| `App.js:L4176` `we=(t,n=false)=>{...}` | PromptNode 内插入 `@mention` 文本 | 组件局部，操作 textareaRef |
| `App.js:L43015` `we=Y.useCallback(async()=>{ await Ev(); D(await xv(...)) })` | 资源面板 rescan+查询主函数 | 资源面板组件局部 |
| `App.js:L36253` `we({x,y})` | ReactFlow `screenToFlowPosition` 坐标转换 | 画布 onDrop/Fr 内局部（来自 `xe.current`） |

三者无任何共享逻辑，纯重名。模块2 用的 `we`(L43015) 与模块4 用的 `we`(L36253) 不同物。

---

## 问题4：`pending_confirmation` 卡死根因

**结论：前端检测逻辑独立于网关 AUTO_CONFIRM 开关，存在「无自动确认 UI 触发」的卡死风险。**

前端侧（`App.js`）：
- `resolveNeedsConfirm`(L32957)：`return taskInfo?.error?.code === 'pending_confirmation' ? taskInfo.id : null`
- `markNeedsConfirm`(L32980)：节点置 `await_confirm`，`return` 终止轮询（不落盘）
- 触发点：L33059(图)/L33546(视频)/L34218(视频) —— `cid = resolveNeedsConfirm(taskInfo); if(cid){ markNeedsConfirm(...); return }`
- 已有确认适配器：`makeConfirmAdapter`(L32960) → `POST ${gatewayBase}/v1/tasks/${taskId}/confirm`；`requestConfirm`(L32976)。**但谁调用 requestConfirm / 是否暴露确认按钮 UI 待查**（疑似仅定义未接线，或依赖某 confirm UI 组件）。

网关侧（`apimart-gateway/main.py`）：
- `AUTO_CONFIRM = os.getenv("AUTO_CONFIRM","true").lower()=="true"`(L34) —— **默认 true**
- L177 注释：「AUTO_CONFIRM=false 时，把待确认状态转成结构化错误，附带 task_id 让调用方去确认」
- L508/523/532/824/848 多处 `if AUTO_CONFIRM:` 分支处理
- L884 注释：「【核心修复】：消灭 AUTO_CONFIRM=false 永久卡死的脚枪，提供外部确认渠道」

**根因分析**：
- 网关默认 AUTO_CONFIRM=true，正常不会返回 pending_confirmation，前端不会卡。
- 但若 Lovart 侧强制要求确认（网关 L177 路径），网关转成 `error.code='pending_confirmation'` 返回 → 前端 `resolveNeedsConfirm` 命中 → 轮询终止、节点 await_confirm。
- 此时若前端**未提供确认按钮触发 `requestConfirm`**，任务永久卡在 await_confirm（PROJECT_LOG 记「单任务轮询卡 pending_confirmation 仍是独立问题，未修」）。
- 即：**卡死与否取决于「前端是否暴露确认 UI 并调用 requestConfirm」**，与网关 AUTO_CONFIRM env 无直接耦合（网关 true 只是减少触发概率）。

**待后续审计确认**：搜索 `requestConfirm` / `makeConfirmAdapter` 的调用点，确认是否存在确认 UI 组件接线；若无，则为真实卡死 bug，修复需在 await_confirm 节点上加「确认」按钮调 `requestConfirm(cid)`。

---

## 问题5：`Zr` 也双身（补充发现）

| 位置 | 语义 |
|------|------|
| `App.js:L1827` `async function Zr(e,t={})` | uploadHelper 姐妹函数（与 Xr=L1802 同组，疑似下载/处理） |
| `App.js:L43893` `Zr = async () => {...}` | **logout/重置配置**：`Pe(false); Le(null); ka(''); Mi(); Q.remove(Z.AUTH_TOKEN)` |

**func-mapping / var-mapping 记的 `Zr=logout` 是 L43893 这个**（正确语义），但 L1827 还有一个同名上传组函数。grep `Zr` 需带行号区分。

---

## 汇总：需回写映射表的修正（待后续审计确认后执行，本会话未改）

1. `Z`：删除 func-mapping L113「创建节点」误记；保留 L21 StorageKeys
2. `Xr`：func-mapping L173 行号 43479→43881，语义 openInTab（局部）；新增 `Xr`(L1802)=uploadToLocalTool
3. `we`：func-mapping 补注「三处重名局部，L4176/L43015/L36253，非模块级」
4. `Zr`：var-mapping L48 logout 标注为 L43893；新增 L1827 uploadHelper 姐妹函数
5. `R`/`B`：var-mapping 补注资源面板区(L29159 z 调 R、L29188 B)与 3D导演台区(L23247/L23258)重名

> 以上均为文档级核查，未修改 `App.js`/映射表文件。修复/回写须经用户确认。
