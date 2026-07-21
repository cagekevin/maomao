# AI12 · 审计模块草稿 T2.2 — 本地数据层与 Rescan

> 状态：🟡 DRAFT（待门3校验 + 门4对抗审计）
> 行号快照：2026-07-21，grep `src/_engine/App.js` 坐实
> 方法学：四段式（运转图景 / 核心混淆字典 / 关键数据流 / 存疑 Bug）+ 边界契约
> 依赖映射：本文混淆名锚点优先 `docs/AI12/01-映射表缺口坐实与修正.md`，其次根 `func/var-mapping.txt`

---

## 一、运转图景（Module 2：本地数据层与 Rescan）

前端把资源/文件交给 `localTool`（:18080）持久化，并通过 `rescan` 把磁盘文件反向同步进 `resources` 表。核心职责：
1. **落盘**：AI 生成结果、采集素材、拖入/粘贴文件 → `POST /api/files/upload` → 磁盘 `uploads/`。
2. **入库**：资源元数据（url/type/source/folder/...）写 `resources` 表（`POST /api/resources/save`）。
3. **查询/刷新**：`GET /api/resources` + `rescan`（扫磁盘 → 补录缺失记录）。
4. **删除/清空**：`/api/resources/delete`（只删 DB）/ `/clear`（可选删磁盘）。

---

## 二、核心混淆字典（本模块涉及符号 · 带行号）

| 混淆名 | 真身 | 行号 | 证据 |
|--------|------|------|------|
| `ii` | `uploadFile`（统一落盘入口：URL直返/File→落盘/缩略图） | `App.js:L1888` | `async function ii(e,t={})`；调 `Xr`(L1802)/`ri`(L1856) |
| `Xr`(上传) | `uploadFileToLocalTool`（`POST /api/files/upload`，带 subfolder） | `App.js:L1802` | `async function Xr(e,t={})`；FormData→`${Hr}/api/files/upload` |
| `Zr`(下载) | `uploadRemoteUrlToLocalTool`（下载远程 http URL 到本地） | `App.js:L1827` | `async function Zr(e,t={})`；`fileUrl`+`subfolder`→upload；log `[uploadHelper]` |
| `ri` | `getThumbnailUrl`（缩略图缓存读取） | `App.js:L1856` | `async function ri(e,t={})`；`ei`(Map TTL)+`ti`(在途锁) |
| `xv` | `listResources`（查询资源列表） | `App.js:L42821` | `async function xv(e={})`；`GET ${vv}/api/resources` |
| `Sv` | `saveResource`（入库 upsert） | `App.js:L42838` | `async function Sv(e)`；`POST ${vv}/api/resources/save` |
| `wv` | `deleteResource`（只删 DB） | `App.js:L42857` | `async function wv(e)`；`POST ${vv}/api/resources/delete?id=` |
| `Ev` | `rescanResourcesApi`（触发后端 rescan） | `App.js:L42883` | `async function Ev()`；`POST ${vv}/api/resources/rescan` |
| `we`(rescan) | `loadResourcesAfterRescan`（组件内：Ev()+xv() 刷新） | `App.js:L43015` | `we=Y.useCallback(async()=>{await Ev();xv(...)})` |
| `Cv` | `toggleFavorite`（收藏切换） | `App.js:L42851` | `Sv({...e,isFavorite:t})` |
| `Tv` | `clearResources`（清空，可选删磁盘） | `App.js:L42866` | `POST ${vv}/api/resources/clear` |
| `Zr`(logout) | `logout`（"重置配置"，⚠️ 与 L1827 同名） | `App.js:L43893` | `Zr=async()=>`；func-mapping 标注 |

> ⚠️ **同名遮蔽双坑**（AI12 新发现）：
> - `Xr`：L1802(上传) vs L43881(`openInTab`) — 引用必带行号。
> - `Zr`：L1827(下载远程URL落盘) vs L43893(logout) — 根 `var-mapping.txt:L48` 只录了 logout，**导致所有"下载"语义被误读为 logout**，是历史文档反复错锚的根因。本文一律标注 `Zr`(下载)@L1827 / `Zr`(logout)@L43893。

---

## 三、关键数据流（本模块内部 + 跨层）

### 3.1 资源采集入库（background → 前端 → localTool）
```
background.ts handleSaveToTransit()
  → chrome.storage.local 'transitResources'(≤5)
  → sendMessage({action:'resourceAdded', resource})
前端 onMessage (App.js L43527):
  if source==='extension'(网页直链/data:/http):
      localized = await Zr(i.url,{subfolder:'migrated'})   # ← Zr(下载)@L1827
      if !localized → 丢弃整条 (download_failed)
      i.url = `${Hr}${localized.url}`                       # 绝对路径化
  D(资源列表 state) 前插 i ; G(计数+1)
  if !local-tool来源: await Sv({...i, id:String(i.id)})     # 入库@L42838
  Te('transit') ; j('materials')                            # 切 Tab
```

### 3.2 Rescan 孤儿清理（localTool 侧，见 ARCHITECTURE L2.4）
```
Ev()(App.js L42883) → POST /api/resources/rescan
  localTool 扫 uploadDir 子目录(排除 .thumbnails / '.'开头)
  → 目录=type 'folder'，文件=扩展名映射
  → id=`local-{folder}-{name}`，已存在跳过
  → 孤儿清理只清 source='local-tool' 且磁盘不存在者；source='extension' 不被清理
we()(App.js L43015) = Ev() + xv() 刷新资源面板
```

### 3.3 统一同步（防死循环，见 ARCHITECTURE X1.4）
```
遍历 globalTasks(status=completed):
  已本地化(startsWith('/files/') OR 127.0.0.1/files/tasks) → 跳过
  否则 uploadFile()(=ii@L1888) 下载 → 更新节点 data
  → dispatchEvent('mutiwindow-task-completed') → Ev() rescan
```

---

## 四、存疑 Bug（对照 TASKS P0–P2，门4 对抗质询点）

| # | 存疑点 | 证据 | 门4 质询 |
|---|--------|------|---------|
| P0-1 | host 硬编码 18080：`Hr`/`vv` 均写死 `http://127.0.0.1:18080`（`var-mapping.txt:L117/L118`），`USE_LOCAL_ENGINE=false` 时文件走 9004 无上传路由 → 失败 | `Hr`/`vv` 常量 | "false 分支谁消费 `REMOTE_BASE`？grep `REMOTE_BASE` 看是否真有上传走 9004 的路径" |
| P0-2 | 中文目录/文件名 Latin1 乱码（待修，非本次坐实范围） | TASKS P0 | 略 |
| P1-1 | 资源面板 URL 拖入只存状态不落盘（TASKS 假设 `B` 回调@L29176 不下载） | `B`(L29188) 是粘贴/拖入处理回调，写 transitItems(`O`)；**未调 `Zr`(下载)@L1827** | "拖入 http URL 时 `O` 收到的 source 是什么？若 'extension' 却未走 Zr 下载 → 刷新即丢，坐实 P1" |
| P1-2 | file input 上传不自动入库（TASKS 假设 `R` 回调@L29165） | `R`(L29149)=readFilesAsDataUrl，转 dataURL 进 transitItems；**未调 `Sv`(入库)@L42838** | "transitItems 何时转正为 resources？是否仅依赖 rescan？grep `Sv` 调用点确认" |
| P2-1 | `wv()`(L42857) 只删 DB 不删磁盘 → 孤儿文件累积 | `wv` 仅 `POST /api/resources/delete` | "清空 `Tv`(L42866) 传 `deleteFiles:true` 是否真删磁盘？grep localTool resources.ts 看 clear 实现" |
| P2-2 | Rescan 孤儿清理只清 `source='local-tool'`，`source='extension'` 不清理 | ARCHITECTURE L2.4 / 3.2 节 | "extension 来源的磁盘文件谁负责删？若只 DB 删(wv) → 孤儿累积，与 P2-1 同源" |
| P2-3 | 缩略图伪复制：`ri`(L1856) 调 `/api/files/thumbnail`，但 localTool 仅 `copyFileSync` 无真实缩放 | ARCHITECTURE L2.4 | "thumb_ 文件名有 maxDim/quality 却无缩放 → 误导，建议接 sharp" |

### 门4 对抗审计结论（本会话自审）
- **P1-1/P1-2 坐实**：资源面板 `R`/`B`/`z` 三个回调（L29149/L29188/L29159）只把资源写进**内存 transitItems(`O`)**，不调 `Zr`(下载) 也不调 `Sv`(入库)；持久化依赖后续 `Ev()` rescan 扫磁盘或 `resourceAdded` 事件链。TASKS 把"上传"归给 `R`/`B` 是**误锚**（见 `01` 修正 A）。
- **同名遮蔽是最大噪音源**：`Xr`(L1802 vs L43881)、`Zr`(L1827 下载 vs L43893 logout)。任何引用不带行号都会幻觉。强烈建议上游在根映射表补 `Xr(upload)`@L1802、`Zr(download)`@L1827 两条，并把现有 `Zr=logout` 改标 `Zr(logout)`@L43893。

---

## 五、边界契约（模块接缝 · 缝合阶段 2.5 用）

### 5.1 接收的 HTTP 路由（localTool :18080）
| 路由 | 方法 | 调用方(行号) | 说明 |
|------|------|-------------|------|
| `/api/files/upload` | POST | `Xr`@L1802 / `Zr`@L1827 | 落盘入口（File 或远程 URL） |
| `/api/files/thumbnail` | GET | `ri`@L1856 | 缩略图（localTool 伪缩放） |
| `/api/resources` | GET | `xv`@L42821 | 资源列表 |
| `/api/resources/save` | POST | `Sv`@L42838 | 入库 upsert |
| `/api/resources/delete` | POST | `wv`@L42857 | 只删 DB |
| `/api/resources/clear` | POST | `Tv`@L42866 | 清空(deleteFiles 可选) |
| `/api/resources/rescan` | POST | `Ev`@L42883 | 扫磁盘补录 |

### 5.2 发出的 window CustomEvent
| 事件 | 触发(行号) | 消费方 |
|------|-----------|--------|
| `mutiwindow-task-completed` | L38481 / L43640 / L43676 / L43697 / L44406 | 资源面板 rescan 刷新（L31428 监听） |
| `resourceAdded` | background.ts `sendMessage` → 前端 L43527 接收 | 本模块处理（非 window 事件，是 chrome.runtime 消息） |

### 5.3 依赖的 config 开关
| 配置 | 来源 | 影响 |
|------|------|------|
| `USE_LOCAL_ENGINE` | `config.js` | true→`Hr`/`vv` 指向 18080；false→文件请求可能走 9004（无上传路由，P0-1） |
| `Hr` / `vv` | `var-mapping.txt` 写死 `127.0.0.1:18080` | host 硬编码，违反路径绝对化弹性（红线 §3.2-7 待修） |

---

## 六、结论与建议回填
1. 本模块符号已全部 grep 坐实，行号较 `ARCHITECTURE.md` 标注有漂移（`xv` L42742→L42821，`Sv`/`wv`/`Ev` 一致，`we` 明确为组件内 L43015）。
2. **修正 TASKS 两处误锚**：`R`/`B` 非上传回调（修正 A）；`Xr`/`Zr` 同名遮蔽（修正 B + 新增 `Zr`(下载)@L1827 实锤）。
3. 建议上游在根 `func/var-mapping.txt` 补：`Xr(upload)`@L1802、`Zr(download)`@L1827，并把 `Zr=logout` 改标行号 L43893。
