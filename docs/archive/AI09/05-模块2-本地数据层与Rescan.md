# AI09 · 模块2 本地数据层与 Rescan（T2.2）

> 门2 强制引用：每条事实带 `文件:L行号`（本次 2026-07-21 grep 实测）。
> 排雷重点：TASKS P1（拖入 URL 不落盘 / 上传不自动入库）/ P2（删除不删磁盘 / 孤儿清理只清 local-tool）。红线：只读审计。

---

## 1. 运转图景

模块2 负责：资源列表查询、资源 upsert 入库、资源删除、rescan 扫盘入库、缩略图缓存、统一上传落盘、资源面板「同步」按钮。数据落 localTool（:18080）SQLite + 磁盘，前端经 HTTP 调用。

资源面板 UI 组件 `Qn`(App.js L169)。

---

## 2. 核心混淆字典（实测行号）

| 混淆名 | 实测位置 | 真实语义 | 与 ARCHITECTURE 差异 |
|--------|------|------|------|
| `Qn` | **L169** `function Qn({...})` | 资源面板组件 | ✅ 一致 |
| `xv` | **L42821** `async function xv(e={})` | 查询资源列表 GET /api/resources | ⚠️ ARCHITECTURE L1.4 写 L42742，实测 L42821 |
| `Sv`(大写) | **L42838** `async function Sv(e)` | 资源 upsert 入库 POST /api/resources/save | ⚠️ 附录写 L42759，实测 L42838 |
| `Cv` | **L42851** `async function Cv(e,t)` | 切换收藏（Sv({...isFavorite})）| ⚠️ ARCHITECTURE 写 L42772，实测 L42851 |
| `wv` | **L42857** `async function wv(e)` | 资源删除 POST /api/resources/delete | ⚠️ ARCHITECTURE 写 L42778，实测 L42857 |
| `Ev` | **L42883** `async function Ev()` | rescan 触发 POST /api/resources/rescan | ⚠️ ARCHITECTURE 写 L42804，实测 L42883 |
| `we`(局部) | **L43015** `we = Y.useCallback(async()=>{...})` | 资源面板「同步」主函数（Ev()+xv()）| ✅ 与 AI05 一致；注意 L4176 的 `we` 是 PromptNode @mention 不同物 |
| `ii` | **L1888** `async function ii(e,t={})` | 统一上传落盘 POST /api/files/upload，返回绝对路径 | ✅ 一致 |
| `ri` | **L1856** `async function ri(e,t={})` | 缩略图缓存（内存 Map TTL=300s + 并发锁）| ✅ 一致 |
| `sv`(小写) | var-mapping（nodeCallbackFieldSet）| ⚠️ 与 `Sv`(大写) 不同物 | 注意大小写 |
| `Oi`(同步到本地) | **L44426** `let Oi = Y.useCallback(async(e=false)=>{...})` | 调 `await we()` 刷新面板 | ARCHITECTURE 写 L44322，实测 L44426（且另 L3154 `function Oi()` 是不同物）|

> localTool 侧 handler（见 01 §一）：
> - 入库 `handleResourcesSave` resources.ts L181 ← POST /api/resources/save (index.ts L184)
> - 删除 `handleResourcesDelete` resources.ts L202 ← POST /api/resources/delete (index.ts L190)
> - rescan `handleResourcesRescan` resources.ts L37 ← POST /api/resources/rescan (index.ts L196)
> - 上传 `handleUpload` files.ts L14 ← POST /api/files/upload (index.ts L135)

---

## 3. 关键数据流

### 3.1 入库链路
```
Sv(e) (L42838) → fetch(`${vv}/api/resources/save`, POST) (App.js L42840)
  → localTool POST /api/resources/save (index.ts L184) → handleResourcesSave (resources.ts L181) → INSERT/UPDATE
```

### 3.2 删除链路（P2：只删 DB）
```
wv(e) (L42857) → fetch(`${vv}/api/resources/delete?id=...`, POST)
  → localTool POST /api/resources/delete (index.ts L190) → handleResourcesDelete (resources.ts L202)
  → 仅 run(db, 'DELETE FROM resources WHERE id=?', [id]) (resources.ts L207)，**不删磁盘文件**
  → 长期产生孤儿文件（磁盘 uploads/ 下残留）
```
> 排雷 P2（TASKS #6）：`wv()` 加可选 `deleteFiles` 参数联动删磁盘；`handleResourcesClear` 已支持 `deleteFiles`(resources.ts L211)，但单删 `wv` 不走该路径。

### 3.3 Rescan 链路
```
Ev() (L42883) → fetch(`${vv}/api/resources/rescan`, POST) (App.js L42885)
  → localTool POST /api/resources/rescan (index.ts L196) → handleResourcesRescan (resources.ts L37)
  · 扫 uploadDir 子目录（排除 .thumbnails）
  · 目录→type=folder；文件→extToFileType 扩展名映射
  · id = local-{folder}-{name}，已存在跳过
  · 孤儿清理：仅删 source='local-tool' 且磁盘不存在的记录 (resources.ts L123, DELETE L127/L164)
  → 注意 source='extension' 记录不被清理（采集入库的资源，本地删文件后 rescan 不清理）
```

### 3.4 面板同步
```
「同步」按钮 → Oi() (L44426) → await we() (L43015)
  we = Y.useCallback(async()=>{ await Ev(); ... xv() }) (L43015)
  → Ev() rescan + xv() 刷新列表
  → 节流：rescanThrottledSync（3s 节流防循环，见 AI05 记录 L43028 一带）
```

### 3.5 上传落盘
```
ii() (L1888) → fetch(`${Hr}/api/files/upload`, ...) → POST /api/files/upload (index.ts L135)
  → 返回绝对路径 http://127.0.0.1:${Bc}/files/...（已 d5d48dd 修复前缀）
```
> 端点 base：ii 用 `Hr`（=localEngineBase()），Sv/Ev/wv/xv 用 `vv`（=LOCAL_ENGINE.base），二者当前均指向 18080（见 01 §四 / ARCHITECTURE X3.3）。

---

## 4. 边界契约（本模块接缝）

| 类型 | 接缝 | 位置 | 收发 |
|------|------|------|------|
| HTTP | GET /api/resources | index.ts L181 | 收（前端 xv→后端）|
| HTTP | POST /api/resources/save | index.ts L184 | 收（前端 Sv→后端）|
| HTTP | POST /api/resources/delete | index.ts L190 | 收（前端 wv→后端）|
| HTTP | POST /api/resources/rescan | index.ts L196 | 收（前端 Ev→后端）|
| HTTP | POST /api/files/upload | index.ts L135 | 收（前端 ii→后端）|
| HTTP | GET /api/files/thumbnail | index.ts L141 | 收（前端 ri→后端）|
| CustomEvent | `mutiwindow-task-completed` → 触发 Ev | 监听 L31428 | 收（来自模块3/统一同步）|
| config | `vv`/`Hr` base URL | config L12/L42 | 决定请求地址 |

---

## 5. 存疑 Bug / 排雷（实测对照 TASKS）

| TASKS 项 | 实测结论 | 锚点 |
|------|------|------|
| P1 拖入 URL 不落盘 | 真身是 paste text/plain 分支只写内存 `O([{url:r}])`，未调 ii()/Sv()；TASKS 旧文符号 `B`/`R` 为组件内局部重名，非模块级（AI05 已厘清）| 待 T2.3 深挖组件内局部回调 |
| P1 上传不自动入库 | 上传回调只 `ii()` 落盘写内存 transitItems，未调 Sv() 入库，需手动 rescan（we）| transitItems vs resources 双数据源（ARCHITECTURE X3.1）|
| P2 删除不删磁盘 | ✅ 确认：wv() 只删 DB（resources.ts L207）| wv L42857 / resources.ts L202 |
| P2 孤儿清理只清 local-tool | ✅ 确认：source='extension' 不被清理（resources.ts L123）| resources.ts L123 |
| P2 缩略图伪复制 | ✅ 确认：files.ts tryGenerateThumbnail 仅 copyFileSync（files.ts L137），无真实缩放 | files.ts L121–L137 |
| P0 host 硬编码 18080 | ✅ 残留：LOCAL_ENGINE.host 写死 config L13；中文路径 Latin1 待修 | config L13 |

> 排雷结论：P2 三项均**实测坐实**，与 TASKS 描述一致，非误报。P1 两项符号名需回填（见 03 纠错清单）。
