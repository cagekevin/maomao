# AI08 · 门4 对抗审计与 localTool 跨审（补完待查项）

> 门4 = 对抗审计（逻辑质询，不依赖写手上下文）；本轮同时补完前几轮标记的待查项，含 **localTool 侧跨审**（前几轮仅审前端 App.js）。
> 全部行号 grep 复核 `src/_engine/App.js` + `src/background.ts` + `localTool/src/routes/*.ts`（2026-07-21）。
> 红线对齐：§3.2（路径绝对化、轮询落盘）、§3.3（事件总线、不绕过 StorageManager）。
> **本文件为审计文档，不修改 localTool/App.js 任何源码。**

---

## A. 待查项回访（前几轮标记 → 本轮坐实）

### A.1 `resourceAdded` 派发源（交叉流1 门4 提问）
- **Q**：L43527 监听 `resourceAdded`，但前端 App.js grep 未捕获派发 → 谁派发？
- **A**：派发在 **Service Worker `src/background.ts:L102`**：`{ action: 'resourceAdded', resource: newResource }`。前端 `window.addEventListener`（L43527）跨进程接收。
- ✅ 闭环：生成完成 → rescan(`Ev`) 入库 → background 派发 `resourceAdded` → 前端面板刷新（L43527→`Sv` L43552）。**通道正确，未绕过 StorageManager**。

### A.2 `Zn`(canvasAddResourceEvent) 真身（交叉流4 提问）
- `var Zn = 'canvas-add-resource-request'`（App.js:L168）—— 画布添加资源请求事件名（与 var-mapping 一致）。
- ⚠️ 同名陷阱：L43357 另有 `Zn = (e,t)=>{...}` 局部变量（配置加载用），**非事件名**。引用须带行号。

### A.3 `Ba`(L3637) 真身
- `function Ba(){ return !!Oa(); }`（L3637）= `hasAuthToken`，本地模式恒 true（因 `Oa` 永远返回 `local-mode-token`）。TASKS 标注正确，**无 bug**，仅语义上恒 true。

### A.4 `openInTab` / `logout` 全仓搜索（01_快照 §3 提问）
- grep 全 `src/`：`openInTab` 与 `logout` **均不存在**（仅 L44907 文案"重置配置"）。
- ⇒ var-mapping `Zr=logout` 与 AI02 `Xr=openInTab` 为**错误映射**；`Xr`(L1802)/`Zr`(L1827) 实为上传函数（见 `01_已坐实锚点快照.md` §3）。

### A.5 TASKS T0.1 `we` 是否 rescan 主函数（01_快照 §4 提问）
- grep App.js 无模块级 `function we`；rescan 实为 `Ev`(L42883)。`we` 在代码中不存 → **建议废弃 `we` 锚点**。

---

## B. localTool 侧跨审（前几轮 P2 三项落地）

### B.1 删除不删磁盘（TASKS P2 #6，双向坐实）
- 前端：`wv`(App.js:L42857) POST `/api/resources/delete?id=` 仅传 id。
- localTool：`handleResourcesClear` 单条删除 `run(db,'DELETE FROM resources WHERE id = ?',[id])`（resources.ts:L207）—— **只删 DB，无 `deleteFiles` 参数**。
- 对照 `handleResourcesClear`(L211)：带 `deleteFiles` 时可 `fs.rmSync` 删磁盘（L219/L224-234）。
- ✅ 结论：单条删除 `wv` ↔ localTool 删除 均不删磁盘 → 孤儿文件产生（P2 #6 坐实）。修复：前端 `wv` 加 `deleteFiles` 可选 + localTool `delete` 路由支持该参数。

### B.2 Rescan 孤儿清理只清 local-tool（TASKS P2 #7，坐实）
- `resources.ts:L120-130`：孤儿清理 `WHERE source = 'local-tool'`，磁盘不存在则 `DELETE`。
- ⚠️ `source='extension'` 的记录（扩展采集的资源）**不被此清理** → 磁盘删了但 DB 残留陈旧条目。
- 归因：rescan 只扫 localTool 目录（L49-118 仅遍历 uploadDir + source='local-tool'），extension 来源未纳入。P2 #7 坐实。

### B.3 缩略图伪复制（TASKS P2 #8，坐实）
- `files.ts:L121-142` `tryGenerateThumbnail`：仅 `fs.copyFileSync(filePath, thumbPath)`（L137），**复制原图**；文件名 `thumb_${basename}` 不含 maxDim/quality（与前端 `ri` 传参 `{maxDim,quality}` 不对应）。
- 代码注释明说：「简单复制原图作为缩略图（无 sharp 依赖时）后续可接入 sharp 做真正的缩放」。
- ✅ P2 #8 坐实：前端 `ri`(L1856) 调 `/api/files/thumbnail` 拿到的是**原图复制 URL 非真缩放图**；大图作缩略图徒增流量。修复：接入 sharp 真实缩放（注释已预留）。

### B.4 localTool 端点契约核对（CONTRACT.md 一致性）
- `localTool/CONTRACT.md` 声明的端点（`/api/files/upload`/`/api/files/thumbnail`/`/api/resources/*`/`/api/resources/clear` 带 `deleteFiles`）与 `index.ts` 路由注册（L141 thumbnail、L246 列示）一致。
- 注：`index.ts` 路由注册中 **`/api/files/thumbnail` 仅 GET（L141）**，与前端 `ri`(L1871 GET) 一致 ✅。

---

## C. 对抗审计质询（逻辑反向，门4 核心）

| 质询 | 回答（grep 证据） | 判定 |
|------|-------------------|------|
| 生图落盘失败时是否破坏本地闭环？ | L33051 catch 兜底用 CDN 直链 `u` | 🔴 红线冲突（模块3 §④） |
| `resourceAdded` 是否绕过 StorageManager？ | 由 background.ts 派发、前端 event 消费、最终 `Sv`→`Q` | ✅ 合规 |
| 单条删除能否清磁盘？ | 前端 `wv` + localTool L207 均无 deleteFiles | 🟡 P2 缺陷 |
| rescan 能否清理 extension 孤儿？ | 仅 `source='local-tool'`(L123) | 🟡 P2 缺陷 |
| 缩略图是否真缩放？ | copyFileSync 原图(L137) | 🟡 P2 缺陷 |

---

## D. 门4 结论与回填建议更新

对 `99_审计总报告.md` 第三节的增补：
- P2 #6 删除不删磁盘：**已双向坐实**（前端 + localTool），建议两端联改。
- P2 #7 rescan 孤儿只清 local-tool：**已坐实**，建议 rescan 纳入 extension 源或放宽清理条件。
- P2 #8 缩略图伪复制：**已坐实**，建议 localTool 接 sharp。
- 新发现：localTool `delete` 单条路由(L207) 不支持 `deleteFiles`，是 P2 #6 的根因之一（不仅是前端 `wv`）。

> 本文件为「已验证草稿」待门3 校验报告（见 `30_门4对抗审计与localTool跨审_校验报告.md`）。
