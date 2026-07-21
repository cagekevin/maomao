# 模块2 · 本地数据层与 Rescan（T2.2）

> 审计对象：前端 ↔ localTool(:18080) 的 KV/文件/资源交互、rescan、缩略图、扩展名→类型映射。
> 方法：每条事实带 `file:line`，经 grep 坐实（2026-07-21 快照，行号会漂移）。
> 信任链：实际代码 > 映射表 > 文档。与权威文档冲突时以代码为准。

---

## 1. 运转图景

本模块是「前端 ↔ 本地数据层」的桥梁：
- **上传落盘**：画布拖入/粘贴/AI 结果/采集 → `ii()` → `Xr()`/`Zr()` → `POST /api/files/upload`(:18080)
- **资源入库**：资源面板"发送到资源" → `Sv()` → `POST /api/resources/save`
- **资源删除**：`wv()` → `POST /api/resources/delete`（只删 DB）
- **Rescan**：`Ev()` → `POST /api/resources/rescan` → localTool 扫盘 → 入库 + 孤儿清理
- **缩略图**：前端 `ri()` 内存缓存 + localTool `/api/files/thumbnail` 伪复制

> ⚠️ **关键纠偏（二次）**：`Xr`/`Zr` 各有**两处重名定义**（模块级上传函数 + 组件内 `openInTab`/`logout`），旧文档（ARCHITECTURE/TASKS/AI02/AI05）只看到一处就下定论，导致纠正也不完全对。详见 §6。

---

## 2. 核心混淆字典（前端侧，grep 坐实）

| 混淆名 | 实测位置 | 可读语义 | 备注 |
|--------|----------|----------|------|
| `ri` | `App.js` **L1856** `async function ri(e,t={})` | **缩略图内存缓存**：仅对含 `/files/` 的 url，TTL=300s(`ni`)，并发锁 `ti` | 调 `Hr/api/files/thumbnail` |
| `Xr` | `App.js` **L1802** `async function Xr(e,t={})` | **uploadToLocalTool**：blob → FormData → `POST ${Hr}/api/files/upload` | 模块级上传函数（非 openInTab！） |
| `Zr` | `App.js` **L1827** `async function Zr(e,t={})` | **uploadRemoteUrlToLocalTool**：`fileUrl` → 同上传端点 | 模块级远程 URL 上传（非 logout！） |
| `ii` | `App.js` **L1888** `async function ii(e,t={})` | **统一上传入口**：远程 http 直返；否则调 `Xr()`(blob) 或 `Zr()`(url) | 各落盘入口汇聚点 |
| `Sv` | `App.js` **L42838** `async function Sv(e)` | **资源入库 upsert**：`POST ${vv}/api/resources/save` | `Cv`(@L42851) 切换收藏复用它 |
| `wv` | `App.js` **L42857** `async function wv(e)` | **资源删除**：`POST ${vv}/api/resources/delete?id=` | **只删 DB，不删磁盘**（P2） |
| `Tv` | `App.js` **L42866** `async function Tv(e,t)` | **资源清空**：`POST /api/resources/clear`，`deleteFiles` 可选删磁盘 | |
| `Ev` | `App.js` **L42883** `async function Ev()` | **rescan**：`POST ${vv}/api/resources/rescan` | 返回 count |
| `we` | `App.js` **L43015** `we = Y.useCallback(async()=>{await Ev(); xv()})` | **rescanResources 主函数**（组件内）：rescan + 查询 | 资源面板"同步"按钮 |
| `xv` | 资源查询（见 ARCHITECTURE L1.4 @L42742） | `GET /api/resources` | |
| `Hr` | `App.js` L1732 `var Hr=localEngineBase()` | localTool 状态/base URL（18080） | |
| `vv` | `App.js` L42808 `var vv=LOCAL_ENGINE.base` | localTool base URL（18080） | |

> `Xr`/`Zr` 的**另一处**定义（组件内）：`Xr`@L43881(`openInTab`)、`Zr`@L43893(`logout`/重置配置)。与模块级 L1802/L1827 **同名不同物**，引用必须带行号。

---

## 3. 关键数据流（带 file:line）

### 3.1 上传落盘（前端 → localTool）
```
ii(e, {subfolder})  @L1888
  ├─ 远程 http 字符串 → 直接返回 {url:e}（L1889）
  └─ blob/File → Xr(e, {subfolder})  @L1802
                   → fetch(`${Hr}/api/files/upload`, POST)  @L1812
                   → 返回 {url, thumbnailUrl, path}
  └─ 远程 URL 字符串 → Zr(e, {subfolder})  @L1827（走 fileUrl 分支）
```
> `Hr` = `localEngineBase()`（18080）；落盘目录 `uploads/{subfolder}/`。

### 3.2 资源入库 / 删除 / Rescan（前端 → localTool）
```
Sv(e)  @L42838  → POST /api/resources/save         // 入库 upsert
wv(id) @L42857  → POST /api/resources/delete?id=   // 只删 DB（P2）
Ev()   @L42883  → POST /api/resources/rescan        // 扫盘入库
we()   @L43015  → await Ev(); xv()                  // 同步按钮：rescan+查询
```

### 3.3 localTool 后端关键实现（已读源码）

**`localTool/src/routes/files.ts`**：
- `handleUpload` @L14：multipart → `handleUploadFormData`(@L25) / JSON → `handleUploadJson`(@L74)
- **返回相对路径**：`url: '/files/${subfolder}/${basename}'`（L42/L91/L98）—— ⚠️ 仍为相对路径，前端需兜底补 `http://127.0.0.1:18080`
- `saveFile` @L104：落盘 `uploads/{subfolder}/{Date.now()}-{safeName}`
- `tryGenerateThumbnail` @L121：**伪复制** `fs.copyFileSync(filePath, thumbPath)`（L137），无真实缩放
- `handleThumbnail` @L224：返回 JSON `{thumbnailUrl}`，`thumb_{maxDim}x{quality}_{basename}`（L248）

**`localTool/src/routes/resources.ts`**：
- `RESCAN_FILE_TYPE` @L12：扩展名→类型映射（image/video/audio/text）
- `extToFileType` @L23
- `toAbsoluteFileUrl` @L31：补 `http://127.0.0.1:18080` 绝对路径 ✅（**后端已做绝对化**）
- `handleResourcesRescan` @L37：扫 `uploadDir` 子目录（跳过 `.thumbnails`、`.` 开头）→ 目录 `type=folder`、文件按扩展名映射；`id=local-{folder}-{name}`；已存在跳过
- **孤儿清理** @L120–130：删 `source='local-tool'` 且磁盘不存在的记录 ✅（**后端已实现**）
- `handleResourcesSave` @L181 / `handleResourcesDelete` @L202（仅 `DELETE FROM resources`）/ `handleResourcesClear` @L211（`deleteFiles` 可控删磁盘）

---

## 4. 边界契约（接缝 · 供阶段2.5 缝合）

| 接缝 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | `POST /api/files/upload` | `files.ts` L14 | 上传落盘，返回相对 `url` |
| HTTP | `POST /api/files/thumbnail` | `files.ts` L224 | 缩略图 JSON |
| HTTP | `POST /api/resources/save` | `resources.ts` L181 | 入库 |
| HTTP | `POST /api/resources/delete` | `resources.ts` L202 | 只删 DB |
| HTTP | `POST /api/resources/rescan` | `resources.ts` L37 | 扫盘 + 孤儿清理 |
| config | `LOCAL_ENGINE.base`(18080) | `config.js` L16 | `Hr`/`vv` 来源 |
| CustomEvent | `mutiwindow-task-completed` | 见模块3/交叉流 | rescan 触发资源刷新 |

---

## 5. 存疑 Bug / 风险（对照 TASKS P0–P2，附审计新发现）

| 项 | TASKS 描述 | 实测结论（2026-07-21） | 状态 |
|----|-----------|----------------------|------|
| **P0 URL 格式破图** | host 硬编码 18080、中文路径 Latin1 待修 | `resources.ts` 已实现 `toAbsoluteFileUrl`(L31) 后端绝对化；前端 `ii` 仍依赖兜底。host 硬编码 18080 属实（待参数化） | ⚠️ 后端已缓解，文档未更新 |
| **P1 拖入 URL 不落盘** | `B` 回调只存状态不下载 | 真实锚点在资源面板局部回调（paste text/plain 分支只写内存 transitItems）；`Zr`(L1827) 实为远程 URL 上传函数，可用但未在拖入分支调用 | ⚠️ 待修（见交叉流 T2.5.2） |
| **P1 文件上传不入库** | `R` 回调上传后不调 `Sv()` | 资源面板局部 `z` 上传只写内存，未调 `Sv`/`Ev` | ⚠️ 待修 |
| **P2 删除不删磁盘** | `wv()` 只删 DB | ✅ 坐实：`wv`@L42857 仅 `POST /api/resources/delete`；后端 `handleResourcesDelete`@L202 仅 `DELETE FROM resources`。**磁盘孤儿文件长期累积** | 🔴 真实风险 |
| **P2 Rescan 孤儿清理只清 local-tool** | source='extension' 不被清理 | ✅ 坐实：后端 `@L120-130` 仅清 `source='local-tool'`；`source='extension'` 记录（采集类）磁盘删了仍残留 | 🔴 真实风险 |
| **P2 缩略图伪复制** | 仅 copyFileSync 无缩放 | ✅ 坐实：`files.ts` L137 `fs.copyFileSync`（两处：L137/L253）；`ARCHITECTURE` 提议接 sharp | 🟡 设计缺陷（不影响功能） |

> **审计新发现（重要）**：TASKS.md P0「URL 格式不统一破图」的修复（`toAbsoluteFileUrl`）**已在 localTool 后端落地**（resources.ts L31），但 `TASKS.md` 行33 仍将 `Sv()` 保存前 `toAbsoluteFileUrl` 列为「待修复任务」且锚 `App.js L43462`（已漂移）。建议文档维护者：**后端已修复，前端兜底保留即可，该行任务可关闭**。

---

## 6. 与旧文档差异（二次纠偏，仅记录）

1. **`Xr` 双重身份**：
   - 旧文档（AI02/AI05）纠正"`Xr`@L1802 = openInTab，非上传函数"→ **实测错误**。`Xr`@L1802 是 `uploadToLocalTool`（`fetch /api/files/upload`）；`openInTab` 是**组件内另一处 `Xr`@L43881**。两处同名不同物。
   - 修正：`Xr`@L1802 = uploadToLocalTool（上传）；`Xr`@L43881 = openInTab（组件内）。
2. **`Zr` 双重身份**：
   - 旧文档纠正"`Zr` = logout，非下载"→ 部分对。`Zr`@L1827 是 `uploadRemoteUrlToLocalTool`（远程 URL 上传）；`Zr`@L43893 才是 logout/重置配置（组件内）。两处同名不同物。
   - 修正：`Zr`@L1827 = uploadRemoteUrlToLocalTool；`Zr`@L43893 = logout。
3. **`Sv`/`wv`/`Ev`/`ii`/`ri`/`we`** 行号与 AI05 一致（L42838/L42857/L42883/L1888/L1856/L43015），本次复核通过。
4. **`uploadFile` 落盘链路**：ARCHITECTURE L2.5 写「`ii`→`Xr`/`Zr`」但把 `Xr` 标为 openInTab——应改为「`ii`@L1888→`Xr`@L1802(uploadToLocalTool) / `Zr`@L1827(uploadRemoteUrl)」。

> 结论：`Xr`/`Zr` 的"非上传函数"结论是旧文档只看了一处定义导致的二次误判。映射表/文档回写时必须区分两处行号。
