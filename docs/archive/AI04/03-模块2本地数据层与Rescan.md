# 03 · 模块2 — 本地数据层与 Rescan

> **四段式**：① 运转图景 ② 核心混淆字典 ③ 关键数据流 ④ 存疑 Bug（P1/P2 排雷）
> **边界契约**：接收 `POST /api/files/upload` / `/api/resources/*` / `/api/files/thumbnail`；发出 `mutiwindow-task-completed` / `resourceAdded`。

---

## ① 运转图景

资源/文件全走 `localTool`(:18080)。前端侧封装在 `App.js`：上传 `ii`(L1888)→`Zr`(L1827远程)/`Xr`(L1802文件)；缩略图 `ri`(L1856)；资源 CRUD `Sv`(L42838)/`wv`(L42857)/`xv`(L42821)/`Ev`(L42883)。`uploadFile` useCallback(L19098) 是组件级统一落盘入口，内部补绝对路径（`Bc=LOCAL_ENGINE.port` L19049）。

后端 `localTool/src/routes/resources.ts` 实现 rescan（L37）、save(L181)、delete(L202)、clear(L211)、get(L168)。rescan 孤儿清理只清 `source='local-tool'`(L123)。

## ② 核心混淆字典（grep 坐实）

| 混淆名 | 行号 | 真身 | 证据 |
|--------|------|------|------|
| `ii` | `App.js:L1888` | 统一上传入口 | L1888；L1898 `Xr`/L1891 `ri` |
| `Zr` | `App.js:L1827` | `uploadRemoteUrlToLocalTool`（远程URL落盘） | L1827；L1832 `/api/files/upload` |
| `Xr` | `App.js:L1802` | 文件上传落盘封装 | L1802 |
| `ri` | `App.js:L1856` | 缩略图内存缓存 | L1856；L1871 `/api/files/thumbnail` |
| `Sv` | `App.js:L42838` | `saveResource` | L42840 `/api/resources/save` |
| `wv` | `App.js:L42857` | `deleteResource`（只删DB） | L42859 `/api/resources/delete` |
| `xv` | `App.js:L42821` | `getResources`（分页查询） | L42821 |
| `Ev` | `App.js:L42883` | `rescanResources` | L42885 `/api/resources/rescan` |
| `we` | `App.js:L43015` | rescan闭包（`Ev`+`xv`刷新） | L43017 `await Ev(),D(await xv(...))` |
| `uploadFile` | `App.js:L19098` | 组件级落盘 useCallback（补绝对路径） | L19098；L19111 `s.url=prefix+s.url` |
| `Cv` | `App.js:L42851` | `toggleFavorite`（`Sv({...isFavorite})`） | L42851 |
| `Tv` | `App.js:L42866` | `clearResources`（`deleteFiles`可选） | L42868 `/api/resources/clear` |

## ③ 关键数据流

- **AI结果落盘**：统一同步 effect（ARCH L44246）调 `uploadFile`(L19098) → `POST /api/files/upload`（端口 `Bc`=18080, L19049-L19102）→ 返回绝对路径。
- **rescan 孤儿清理**：`resources.ts` L123 `WHERE source='local-tool'` 只清本地源；`source='extension'`(右键采集) 不被清（TASKS P2-7）。
- **缩略图伪复制**：`localTool/files.ts` `tryGenerateThumbnail` 仅 `copyFileSync`（ARCH L2.4），`ri`(L1856) 是前端缓存层，二者协同。

## ④ 存疑 Bug（P1/P2 排雷，grep 坐实）

| 优先级 | 问题 | grep 证据 | 现状 |
|--------|------|-----------|------|
| P0 | URL格式不统一破图 | `uploadFile` L19108-19112 已补绝对路径（`cd3c0aa`）；rescan 仍 `toAbsoluteFileUrl`(resources.ts L31) 但 host 硬编码 18080 | 已修复，残留：host硬编码 |
| P1 | 拖入URL不落盘 | 资源面板 L29182 `url:r` 只存 state `O([...])`，无 `Zr()`/`Sv()` | 证实；刷新丢失 |
| P1 | 文件上传不入库 | L29160 `R(e)` 后只 `O(t.map(...))` 存 state，无 `Sv()` | 证实；需手动 rescan |
| P2 | 删除不删磁盘 | `wv`(L42857) 只 `POST /api/resources/delete`；`Tv`(L42866) `deleteFiles` 可选 | 证实；孤儿文件累积 |
| P2 | rescan孤儿只清local-tool | `resources.ts` L123 | 证实 |
| P2 | 缩略图伪复制 | `ri`(L1856) 缓存+`localTool/files.ts` copyFileSync | 证实（设计缺陷非bug） |

## 边界契约

- **入（HTTP）**：`POST /api/files/upload`(L19102/L1832) · `POST /api/resources/save`(L42840) · `POST /api/resources/delete`(L42859) · `POST /api/resources/rescan`(L42885) · `GET /api/files/thumbnail`(L1871)
- **出（事件）**：`mutiwindow-task-completed`(L38481/L43640) · `resourceAdded`(L43527)
- **config 开关**：`LOCAL_ENGINE.port`(config L14) → `Bc`(L19049)；`USE_LOCAL_ENGINE` → `Hr`/`vv`

## 对抗审计（门4）

**Q：拖入URL不落盘，那「右键发送到资源」落盘吗？** A：grep `resourceAdded`(L43527) → `Zr()`(L43479区域)下载落盘 + `Sv()`入库；与面板拖入(L29182) 是两条不同链路，前者落盘后者不落。✅（归因：面板 `B`/`R` 回调只存 state，未接 `Sv`）

**Q：删除不删磁盘，rescan 能清孤儿吗？** A：能，但只清 `source='local-tool'`(L123)；右键采集的 `source='extension'` 孤儿不被清（P2-7）。✅
