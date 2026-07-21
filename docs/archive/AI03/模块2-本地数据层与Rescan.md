# AI03 · 模块2 — 本地数据层与 Rescan

> 四段式：① 运转图景 ② 核心混淆字典 ③ 关键数据流 ④ 存疑 Bug
> 行号 grep 实敲于 2026-07-21，会漂移。锚点见 `映射表补全记录.md` + `模块1`。

---

## 1. 运转图景

模块2 是**前端 ↔ localTool(:18080)** 的本地数据层：资源 CRUD、rescan(扫盘入库)、文件上传落盘、缩略图。所有落盘最终走 `POST /api/files/upload` 或 `/api/resources/*`。
- 资源面板 `Qn`(TransitPanel) 显示 `resources`(持久) + `transitItems`(内存易失)。
- 生成完成 / 同步到本地 → 触发 `Ev`(rescan封装) → `we`(rescan调度) → `POST /api/resources/rescan` → localTool 扫盘补库。
- 缩略图 `ri` 内存缓存，按需调 `/api/files/thumbnail`。

---

## 2. 核心混淆字典（已 grep 坐实）

| 混淆名 | 行号 | 可读身份 | 证据 |
|--------|------|---------|------|
| `Ev` | L42883 | rescan 前端封装 | `fetch(${vv}/api/resources/rescan)` |
| `we` | L43015 | rescan 调度主函数 | `we = Y.useCallback(async () => { ... await Ev() ... })` |
| `rescanThrottledSync` | L43028 | rescan 节流包装 | 内部 `await we()`(L43031)，3s 节流 |
| `xv` | L42821 | 资源列表读取 | `fetch(${vv}/api/resources?...)` |
| `Sv` | L42838 | 资源 upsert | `POST ${vv}/api/resources/save` |
| `Cv` | L42851 | 切换收藏 | `Sv({...e, isFavorite:t})` |
| `wv` | L42857 | 资源删除（**只删 DB**） | `POST ${vv}/api/resources/delete?id=` |
| `Tv` | L42866 | 资源清空 | `POST ${vv}/api/resources/clear` + `deleteFiles` |
| `ri` | L1856 | 缩略图内存缓存 | `ei`(Map) + `ti`(在途) + TTL `ni`；调 `/api/files/thumbnail` |
| `ii` | L1888 | `uploadFile` 统一入口 | 非 URL → `Xr`(L1802 上传)；URL → 直返 |
| `Xr`(L1802) | L1802 | `uploadToLocalTool` | `POST ${Hr}/api/files/upload`（`[uploadHelper]`） |
| `Zr`(L1827) | L1827 | `uploadFromUrl` | `POST ${Hr}/api/files/upload` + `fileUrl` |
| `Oi` | L44426 | "同步到本地" | `await we(), e || Br('同步成功')` |
| `yv` | L42809 | 资源行 → 前端对象映射 | `function yv(e) {` 邻近 xv(L42821) |

> `we` 旧写 L42834/L42980，实测 **L43015**（漂移 ~200 行）。`Ev` 旧写 L42804，实测 **L42883**。

---

## 3. 关键数据流

### 3.1 Rescan 主链路（边界契约：HTTP `POST /api/resources/rescan`）
```
前端: we(L43015) → await Ev()(L42883) → fetch(${vv}/api/resources/rescan, POST)
localTool: handleResourcesRescan(localTool/src/routes/resources.ts L37)
  → 遍历 uploadDir 子目录（排除 .thumbnails, .开头）
  → 目录 → type='folder', id='local-{folder}-{name}', source='local-tool'
  → 文件 → extToFileType 映射, url=toAbsoluteFileUrl('/files/...')
  → 已存在 id → skipped（保留收藏/元数据）
  → 孤儿清理：仅删 source='local-tool' 且磁盘不存在的记录（L120-128）
返回 {ok,count,scanned,added,skipped,orphanDeleted}
```
- 已修复点：rescan 入库用 `toAbsoluteFileUrl`（破图修复 `d5d48dd`），不再相对路径。
- 触发点：`rescanThrottledSync`(L43028，3s 节流防抖) / `Oi`(L44426 同步到本地) / transit Tab 切换(L44435)。

### 3.2 文件上传落盘（边界契约：HTTP `POST /api/files/upload`）
```
ii(L1888, uploadFile):
  - 字符串 http(s) URL 且非 data: → 直返 {url}（不下载！红线 §3.2 严禁 CDN 直链，但此处对"已是 /files/ 的本地URL"放行）
  - 非 URL（Blob/File）→ Xr(L1802, uploadToLocalTool) → POST /api/files/upload → {url,thumbnailUrl,path}
  - URL 含 /files/ 且 preferThumbnail → 调 ri() 补 thumbnailUrl
```
- `Zr`(L1827, uploadFromUrl) 按 `fileUrl` 让 localTool 服务端下载落盘（前端不发文件流）。

### 3.3 缩略图（前端 `ri` L1856 ↔ localTool `/api/files/thumbnail`）
- `ri` 内存缓存：`ei`(Map, TTL `ni` 毫秒) + `ti`(在途 Promise 防并发)；仅处理含 `/files/` 的 URL（L1857 `if(!e.includes('/files/')) return null`）。
- 后端 `files.ts` 的 `handleThumbnail`：文件名 `thumb_{maxDim}x{quality}_{basename}`，已存在则缓存返回。

---

## 4. 存疑 Bug（对照 TASKS P0–P2，全部坐实）

### P0 — 必然问题
1. **中文目录/文件名 Latin1 乱码**（TASKS P0 残留）：rescan 经 `toAbsoluteFileUrl` 入库，中文名传入 SQLite(sql.js WASM)。`PROJECT_ORIGIN.md` §8.6 / FUNCTION_MAP §3.2 指疑似 sql.js 以 Latin1 存中文（如"新建文件夹"→`æ°å»ºæä»¶å¤±`）。**前端 rescan 用 `entry.name`(UTF-8) 入库，乱码根因在 sql.js 编码层，非前端**。待修。

### P1 — 特定条件触发
2. **资源面板拖入 URL 不落盘**（TASKS P1，已坐实）：图片节点 `B`(onDrop, L29188) 拖入 `text/plain` URL 只 `O([{url,source:'drop'}])` 存内存(L29204-29207)，**不调 `Zr`(L1827) 下载、不调 `Sv`(L42838) 入库** → 刷新即丢。
3. **资源面板文件上传不自动入库**（TASKS P1，已坐实）：`R`(文件上传回调, 多处局部) 成功后只 `O(...setTransitItems)`(L29160-29165)，**不调 `Sv`**，需手动 rescan 才进 resources 表。
4. **L19158 内联 save 疑点**：图片节点 L19158 直接 `fetch('http://127.0.0.1:${Bc}/api/resources/save',...)`，绕开 `Sv`(L42838)，且 `Bc`(端口字符串) 硬编码、host 硬编码 127.0.0.1 → 与 `vv`/`Sv` 双源不一致（TASKS X3.3）。属"落库点不统一"风险。

### P2 — 逻辑/设计缺陷
5. **资源删除不删磁盘**（TASKS P2，已坐实）：`wv`(L42857) 只 `POST /api/resources/delete` 删 DB 记录，**不删磁盘文件**（localTool 侧 `handleResourcesRescan` 孤儿清理才补删，但仅清 `source='local-tool'`）。长期产生孤儿文件。
6. **Rescan 孤儿清理只清 `source='local-tool'`**（TASKS P2，已坐实）：`resources.ts` L123 `WHERE source='local-tool'`，`source='extension'`(右键采集入库) 的记录删了磁盘也不清 → 陈旧条目残留。
7. **缩略图伪复制**（TASKS P2）：localTool `files.ts` 缩略图仅 `copyFileSync` 原图（无真实缩放），文件名 `thumb_{maxDim}x{quality}_` 有误导性。前端 `ri`(L1856) 调 `/api/files/thumbnail` 返回的是复制件 URL，非真缩放图。

### 其他
- `Tv`(L42866 清空) 支持 `deleteFiles:true` 额外删磁盘，但 `wv`(单删) 无此开关（P2 #5 的根因）。

---

## 5. 边界契约（缝合点）

| 接缝 | 名称 | 位置 |
|------|------|------|
| HTTP POST | `/api/resources/rescan` | App.js L42885 / localTool/src/routes/resources.ts L37 |
| HTTP POST | `/api/resources/save` | App.js L42840(`Sv`) / L19158(内联) |
| HTTP POST | `/api/resources/delete` | App.js L42859(`wv`) |
| HTTP POST | `/api/files/upload` | App.js L1812(`Xr`) / L1832(`Zr`) |
| HTTP GET | `/api/files/thumbnail` | App.js L1871(`ri`) |
| config | `USE_LOCAL_ENGINE` / `LOCAL_ENGINE` | config.js |
| 硬编码残留 | `vv`(L42808) / `U_`(L41570) / `Bc`(L19049) / `ot`(L43212) | 见模块1 §4（均实测 grep，旧 var-mapping/FUNCTION_MAP 行号已漂移） |
| CustomEvent | `mutiwindow-task-completed`(触发 Ev, App.js L38481) / `resourceAdded`(跨进程, chrome.runtime App.js L43527) | 见交叉流审计 |
| 持久化 | `Q.saveCanvasState`(App.js L1642) 直接写 localforage | **无 `canvas-state-change` / `mutiwindow-sync-local` 事件**（源码 0 命中；`mutiwindow-sync-local` 实为 `handleSyncLocal` 函数 App.js L44426） |

> 修复建议（不在此改，仅记录）：P1 #2/#3 在 `B`/`R` 成功后补 `Zr`/`Sv`；P2 #5 给 `wv` 加 `deleteFiles` 参数联动 `Tv`；P0 中文乱码需在 sql.js 层统一 UTF-8 或 rescan 做 encodeURIComponent。

[2026-07-21 据 AI13 裁决表修订：删 canvas-state-change/mutiwindow-sync-local 假事件]
