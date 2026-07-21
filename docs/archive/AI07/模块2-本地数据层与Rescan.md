# 模块2 · 本地数据层与 Rescan（V1 审计）

> 审计日期：2026-07-21。所有行号 grep 实敲于 `src/_engine/App.js` 与 `localTool/src/`。
> 结构：① 运转图景 ② 核心混淆字典 ③ 关键数据流（带 file:line）④ 存疑 Bug（对照 TASKS P0–P2）。

---

## ① 运转图景

本地数据层由 **localTool**（`:18080`，Node/TS，sql.js WASM SQLite）承担，负责文件的落盘、KV、任务、资源的持久化。前端 `App.js` 通过一组语义化封装函数（`ii`/`Xr`/`Zr`/`Ev`/`xv`/`Sv`/`wv`）与之交互。资源面板（ResourcePanel）的展示数据来自 `resources` 表，刷新靠 `rescan`（扫磁盘→入库）。

边界契约：
- **HTTP**：`POST /api/files/upload`（落盘）、`GET /api/resources`（列表）、`POST /api/resources/save`（入库）、`POST /api/resources/rescan`（扫盘同步）、`POST /api/resources/delete`（删 DB）。
- **事件总线**：`mutiwindow-task-completed` → 触发 `Ev()` rescan。
- **config**：`USE_LOCAL_ENGINE` 决定走 localTool(`vv='http://127.0.0.1:18080'`)；`Hr=localEngineBase()`、`Bc=LOCAL_ENGINE.port`。

---

## ② 核心混淆字典（本模块）

| 前端符号 | 行号(App.js) | 语义 | 后端对应 |
|----------|--------------|------|----------|
| `Xr` | L1802 | blob 上传 localTool | `handleUpload`(files.ts L14) |
| `Zr` | L1827 | URL 上传 localTool | `handleUpload`(files.ts L14) |
| `ii` | L1888 | uploadFile 统一入口（字符串透传 / File 调 Xr） | — |
| `Ev` | L42883 | **rescan 真函数**（POST /api/resources/rescan） | `handleResourcesRescan`(resources.ts L37) |
| `we`(①) | L4176 | prompt @提及插入（**非** rescan） | — |
| `we`(②) | L43015 | 组件层 rescan 主函数（调 Ev+xv） | — |
| `xv` | L42821 | 资源列表查询 | `handleResourcesGet`(resources.ts L168) |
| `Sv` | L42838 | 资源入库 upsert | `handleResourcesSave`(resources.ts L181) |
| `Cv` | L42851 | 切换收藏（调 Sv） | same |
| `wv` | L42857 | 资源删除（**只删 DB**） | `handleResourcesDelete`(resources.ts L202) |
| `Tv` | L42866 | 资源清空 | `handleResourcesClear`(resources.ts L211) |
| `uploadFile`(hook) | L19098 | useLocalTool hook 内落盘回调 | `handleUpload` |

> 注：`vv='http://127.0.0.1:18080'`（硬编码残留，实际定义 **L42808** `var vv = LOCAL_ENGINE.base`）；`Hr=localEngineBase()`(L1732)。

---

## ③ 关键数据流（带 file:line）

### 3.1 文件上传落盘
```
ii(file, {subfolder})        App.js L1888
  → 字符串 URL? 直接透传（⚠️ CDN 直链风险，见 §④）
  → File/Blob? Xr(file)      App.js L1802
      → POST ${Hr}/api/files/upload   (Hr=localEngineBase L1700)
      → 后端 handleUploadFormData     localTool files.ts L25
      → saveFile → uploads/{subfolder}/{Date.now()}-{safe}   files.ts L104/L112
      → 返回 {url:'/files/...'(相对!), thumbnailUrl}         files.ts L42
```
**证据**：`files.ts` L42 返回 `url: fileUrlPath`（相对路径 `/files/...`）；前端 `ii`/`Xr` 未补全绝对前缀（除非走 `subfolder` 兜底，旧文档称前端 L19049 兜底——本轮未逐行坐实该兜底，标记待核）。

### 3.2 Rescan（扫盘→入库→孤儿清理）
```
事件: mutiwindow-task-completed   App.js L31428 监听
  → Ev()                          App.js L42883
  → POST ${vv}/api/resources/rescan   (vv=L42808 硬编码 18080)
  → 后端 handleResourcesRescan    resources.ts L37
      ├─ 遍历 uploadDir 子目录（排除 .thumbnails）        L46-53
      ├─ 文件: extToFileType 映射类型 → id=`local-{folder}-{name}`  L89-96
      ├─ 已存在 id 跳过（保留收藏）                      L99-103
      ├─ 孤儿清理: source='local-tool' 且磁盘不存在 → DELETE   L123-130
      └─ 返回 {added, skipped, orphanDeleted}           L132
  → 组件层 we()(L43015) 再调 xv()(L42821) 刷新列表
```
**节流**：`rescanThrottledSync`(L43028) 3s 节流（与 ARCHITECTURE X5 一致 ✅）。

### 3.3 资源删除（只删 DB）
```
wv(id)            App.js L42857 → POST ${vv}/api/resources/delete?id=
后端 handleResourcesDelete   resources.ts L202 → 仅 DELETE FROM resources（无 fs.unlink）
```
→ **确认 TASKS P2 第6条**：删除不删磁盘文件，长期产生孤儿文件。

### 3.4 缩略图（伪复制）
```
tryGenerateThumbnail   files.ts L121
  → 仅图片扩展名；thumbPath = .thumbnails/thumb_{basename}   L131
  → fs.copyFileSync(filePath, thumbPath)   L137  （⚠️ 复制原图，无真实缩放）
```
→ **确认 TASKS P2 第8条**：缩略图伪复制。

---

## ④ 存疑 Bug（对照 TASKS P0–P2）

| # | 问题 | 证据（file:line） | 结论 |
|---|------|-------------------|------|
| P0-1 | URL 格式不统一破图（host 硬编码 18080） | rescan 已补全绝对路径 `toAbsoluteFileUrl`(resources.ts L31)；但 `/api/files/upload` 返回相对路径(files.ts L42)，前端 `ii` 对 blob 结果未显式补全 | 部分已修（rescan 侧），上传侧仍依赖前端兜底 |
| P0-2 | 中文目录/文件名 Latin1 乱码 | `sanitizeFilename`(files.ts L117) 把非 ASCII 替换为 `_`，中文名被吞；读盘用 `path` 模块，Windows 下中文目录 `readdirSync` 可能乱码 | 待修（本轮未跑实机验证，标记待核） |
| P1-2 | 资源面板 URL 拖入不落盘 | 资源面板 onDrop `B`(L29188) 调 `R`(L29149, FileReader 读 base64)；纯 URL 文本走 paste 分支 `O([{url:r, source:'paste'}])`(L29181) ——仅存 state，刷新丢 | 确认（TASKS P1-2） |
| P1-3 | file input 上传不自动入库 | `R`(L29149) 只读 base64；`z`(L29159)→`O`(资源 setter) 入库 state；但**未调 `Sv()` 写后端 DB**，需手动 rescan 才持久化 | 与旧 TASKS 描述一致，但机制是 `z/O` 而非直接 `R` 上传（旧文档措辞需修正） |
| P2-6 | 删除不删磁盘 | `wv`(L42857) + 后端 L202 仅删 DB | 确认 |
| P2-8 | 缩略图伪复制 | files.ts L137 copyFileSync | 确认 |

### 跨层一致性（ARCHITECTURE X3）
- **X3.4 rescan URL 格式**：后端 `toAbsoluteFileUrl`(resources.ts L31) 已补全绝对路径 ✅；`Zr`(L1827)/`Xr`(L1802) 上传返回相对路径，前端兜底（`ii` L1888 透传字符串、blob 结果未补）——与旧文档"已 d5d48dd 修复，host 硬编码待改"相符。

---

## ⑤ 对旧文档的修正点
1. `ARCHITECTURE.md` L2.4/L2.5 中 `we` 当 rescan 的表述：应区分 `we`(① L4176 @提及) 与 `we`(② L43015 rescan 封装)，rescan 真函数是 `Ev`(L42883)。
2. `ARCHITECTURE.md` L2.5 上传入口表：真实上传函数是 `Xr`(L1802 blob)/`Zr`(L1827 URL)/`ii`(L1888 入口)，非旧注的 `Sv`/`Zr`/`Xr` 混写。
3. TASKS P1-3 措辞：上传路径是 `R`(读)→`z`(L29159)→`O`(state)，非"R(files) 上传后不调 Sv()"。
