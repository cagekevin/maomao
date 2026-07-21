# AI06 · 模块2：本地数据层与 Rescan

> 审计日期：2026-07-21 ｜ 行号快照会漂移，动手前重 grep。
> ⚠️ 本模块大量使用重名符号（`Xr`/`Zr`），引用必带行号+模块级/局部标注（见 `00-mapping-audit.md` §1.6/1.7）。

## 1. 运转图景
资源入库链路：AI 结果落盘 / 右键采集 / 画布拖入 → `ii`(统一入口) 或 `Xr`(blob上传) / `Zr`(url上传) → POST `/api/files/upload`(localTool) → `Sv`(资源入库) → 事件总线刷新面板。Rescan：`Ev` 触发 localTool 扫磁盘 → resources 表。

## 2. 核心混淆字典（已坐实，阶段0修正后）
| 混淆名 | 可读名 | 行号 | 作用 | 注意 |
|--------|--------|------|------|------|
| `ii` | uploadFile(统一入口) | L1888 | 远程URL直返/blob调Xr | ✅ |
| `Xr` | uploadToLocalTool | **L1802** | blob→FormData→POST /api/files/upload | 模块级=上传（非openInTab） |
| `Zr` | uploadFromUrl | **L1827** | fileUrl→POST /api/files/upload | 模块级=上传（logout是局部L43893） |
| `ri` | getThumbnail | L1856 | 缩略图内存缓存Map(TTL300s) | ✅ |
| `Sv` | saveResource | L42838 | POST /api/resources/save | 资源入库 |
| `Cv` | toggleFavorite | L42851 | Sv({...isFavorite}) | 收藏切换 |
| `wv` | deleteResource | **L42857** | POST /api/resources/delete | 只删DB不删磁盘(P2) |
| `Ev` | rescanResources | L42883 | POST /api/resources/rescan | 扫磁盘→resources |
| `xv` | listResources | **L42821**（含 `fetch(${vv}/api/resources?` @L42827） | GET /api/resources | 查列表 |
| `we` | insertMention | L4176 | prompt @提及插入 | ❌ **非rescan**（TASKS错锚已纠正） |

## 3. 关键数据流
- **上传落盘**：`ii`(L1888) 判断：https URL 直返不下载（红线§3.2 破本地闭环风险点）；blob/File 走 `Xr`(L1802)→`Hr`/api/files/upload。
- **资源入库**：`Sv`(L42838)→`vv`(L42808=`LOCAL_ENGINE.base`，写死18080)/api/resources/save（upsert）。
- **删除**：`wv`(L42857)→`vv`/api/resources/delete，**只删DB**，磁盘孤儿文件累积（P2）。
- **Rescan**：`Ev`(L42883)→`vv`/api/resources/rescan；孤儿清理只清 `source='local-tool'`，`source='extension'` 不清理（P2）。

## 4. 存疑 Bug / 雷（P1/P2 坐实）
| 优先级 | 问题 | 代码位置 | 现状 |
|--------|------|---------|------|
| P1 | 拖入URL不落盘 | `B`回调≈L29160 | 只存状态不下载，刷新丢失 |
| P1 | 文件上传不入库 | `R`回调≈L29165 | 上传后不调 Sv()，需手动rescan |
| P2 | 删除不删磁盘 | `wv` L42857 | 只删DB，长期孤儿文件 |
| P2 | 缩略图伪复制 | localTool files.ts L104-142 | copyFileSync无真实缩放 |
| P2 | Rescan孤儿清理局限 | Ev L42883相关 | 只清 source='local-tool' |
| P0 | 破图(host硬编码18080/中文Latin1) | `vv`@L42808(写死18080) / `Hr`@L1732(动态, false模式死路) | 已d5d48dd修部分，残留待修 |

## 5. 边界契约
| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | POST /api/files/upload | localTool files.ts | 返回绝对 url（前端兜底补前缀） |
| HTTP | POST /api/resources/save | localTool resources.ts L181 | 资源入库 |
| HTTP | POST /api/resources/delete | localTool resources.ts L202 | 删DB |
| HTTP | POST /api/resources/rescan | localTool resources.ts L37 | 扫磁盘 |
| CustomEvent | `resourceAdded` | 监听@L43527（来自background.ts） | 触发 transitItems→入库 |
| CustomEvent | `mutiwindow-task-completed` | 触发@L43640等→Ev rescan | 生成完成刷新 |
| 存储键 | `transitResources`(≤5,内存易失) | Z.TRANSIT_RESOURCES | 采集中转 |

## 6. 校验门
行号均由 grep 坐实 ✅。`Xr`/`Zr` 重名已在阶段0厘清，本模块引用均带行号 ✅。
