# 03 · 模块2 本地数据层与 Rescan（四段式审计）

> 锚点：Ev/we/Sv/wv/Tv/xv/ii/Xr/Zr/ri + 7 个落盘入口 + localTool 路由。全部 grep 坐实（2026-07-21）。
> 重点：排雷 TASKS P1/P2；修正 ARCHITECTURE L2.5 错锚点（右键采集实为 `Zr` 非 `ii`）。

---

## 一、运转图景

前端通过 `ii`/`Xr`/`Zr` 三类上传函数把文件/URL 落盘到 localTool(:18080)，localTool 写 SQLite(`resources`/`kv`/`tasks`) + 磁盘(`uploads/`)。资源面板用 `Sv`(upsert)/`wv`(删)/`Tv`(清空)/`xv`(查)/`Ev`(rescan) 管理；`we`(组件局部 loadResources) 经 `rescanThrottledSync` 触发 `Ev`+`xv` 刷新面板。

## 二、核心混淆字典（grep 坐实）

| 混淆名 | 行号 | 可读名 | 作用 |
|--------|------|--------|------|
| `ii` | L1888 | uploadFile（统一入口） | 远程 URL 直返；否则调 `Xr` 落盘 |
| `Xr`(模块级) | L1802 | uploadToLocalTool | fetch `/api/files/upload`（Blob 表单） |
| `Zr`(模块级) | L1827 | uploadRemoteUrlToLocalTool | fetch `/api/files/upload`（fileUrl 表单） |
| `ri` | L1856 | thumbnailCache | 缩略图内存缓存 Map+TTL300s |
| `Sv` | L42838 | saveResource | POST `/api/resources/save` |
| `Cv` | L42851 | toggleFavorite | `Sv({...e,isFavorite})` |
| `wv` | L42857 | deleteResource | POST `/api/resources/delete`（**只删DB**） |
| `Tv` | L42866 | clearResources | POST `/api/resources/clear`（可删磁盘） |
| `Ev` | L42883 | rescanResources | POST `/api/resources/rescan` |
| `xv` | L42821 | listResources | 资源列表查询 |
| `we`(组件局部) | L43015 | loadResources | `Ev()`+`xv()` 刷新；`rescanThrottledSync`@L43028 调它 |
| `Sv`(大写) vs `sv`(小写) | L42838 / var-mapping L178 | saveResource vs nodeCallbackFieldSet | **大小写不同，不可混** |

## 三、7 个落盘入口（grep 坐实，修正 ARCHITECTURE L2.5）

| # | 入口 | 落盘函数 | 位置 | subfolder |
|---|------|---------|------|-----------|
| 1 | 右键"发送到资源"/resourceAdded | **`Zr`**(模块级 uploadRemoteUrlToLocalTool) | L5364/L8772/L43104/L43539 | `migrated` |
| 2 | AI 生成结果 | `ii({subfolder:'tasks'})` | L33049/L28439/L35105/L15202 | `tasks` |
| 3 | 画布拖入文件 | `ii({subfolder:'canvas/drop'})` | L36364 | `canvas/drop` |
| 4 | 剪贴板粘贴 | `ii({subfolder:'canvas/paste'})` | L36082 | `canvas/paste` |
| 5 | 资源面板文件上传 | `ii({subfolder:'canvas/upload'})` | L2111/L4246/L8915/... | `canvas/upload` |
| 6 | 资源面板 URL 拖入 | **不落盘** | L29176 区域（TASKS P1-2） | — |
| 7 | 剪映素材发送 | 占位（POST `/api/jianying/send` 仅记日志） | `Kn`@var-mapping L134 | — |

> ⚠️ **修正 ARCHITECTURE L2.5**：原表称入口1「`ii()`→POST」实为 `Zr`(模块级 uploadRemoteUrlToLocalTool)；`ii` 对 http(s) URL **直接返回不落盘**（见 `ii`@L1889），故"外部URL落盘"必须走 `Zr`（或传 subfolder 的 `ii`）。原表把 `ii`/`Xr`/`Zr` 混为一谈是错的。

## 四、关键数据流

```
resourceAdded 事件 (background.ts → 前端 L43527)
  → if source!=='local-tool': Zr(url,{subfolder:'migrated'}) 落盘 (@L43539)
  → url 补全绝对路径 `${Hr}${url}` (@L43548，红线 §3.2 合规；注意此行仅字符串拼接，真正的 `toAbsoluteFileUrl` 定义在 `localTool/src/routes/resources.ts#L31`)
  → Sv({...folder:'migrated'}) 入库 (@L43552)
  → dispatch 进 transitItems + 切 materials Tab

AI 生成完成 (模块3 @L33049)
  → ii(u,{subfolder:'tasks'}) 落盘 → u=持久化绝对路径
  → mutiwindow-task-completed 事件 → 模块2 we()/rescan 刷新
```

## 五、边界契约（接缝）

| 接缝 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | POST `/api/files/upload` | localTool `routes/files.ts`（Xr@L1802/Zr@L1827 调） | 落盘 |
| HTTP | GET `/api/files/read` | files.ts L145（ARCHITECTURE L223） | 读文件 |
| HTTP | GET `/api/files/thumbnail` | files.ts L224 | 缩略图 |
| HTTP | POST `/api/resources/save` | Sv@L42840 | 入库 |
| HTTP | POST `/api/resources/delete` | wv@L42859 | 删（只DB） |
| HTTP | POST `/api/resources/rescan` | Ev@L42885 | rescan |
| HTTP | POST `/api/resources/clear` | Tv@L42868 | 清空（可删磁盘） |
| CustomEvent | `resourceAdded` | background.ts→前端 L43527 | 采集入库触发 |
| CustomEvent | `mutiwindow-task-completed` | 派发 L38481 → 监听 L31428(we) | 生成完成刷新 |

## 六、排雷（对照 TASKS P1/P2，grep 坐实）

| Bug | TASKS | 本次复核 |
|-----|-------|---------|
| P0 资源面板 URL 破图 | host硬编码18080/中文Latin1 | `Hr`等字面量 18080（var-mapping L117）；中文乱码在 localTool 落盘，前端 L43548 仅字符串拼接补全绝对路径（`toAbsoluteFileUrl` 真身在 `localTool/src/routes/resources.ts#L31`，硬编码 18080） |
| P1 URL拖入不落盘 | `B`回调 L29160–79 | 仅存状态不下载，刷新丢（未 grep 到落盘调用）✅ 属实 |
| P1 文件上传不入库 | `R`回调 L29165 | `ii` 上传后需手动 rescan（we()）；grep 显示上传走 `ii` 但未见自动 `Sv()` 在上传点 ✅ 属实 |
| P2 删除不删磁盘 | wv@L42857 | `POST /api/resources/delete` 只删DB，无 deleteFiles ✅ 属实 |
| P2 孤儿清理只清 local-tool | resources.ts L120 | `source='local-tool'` 才清，`extension` 不清 ✅ 属实 |

[2026-07-21 据 AI13 裁决表修订：toAbsoluteFileUrl 真身 localTool resources.ts L31，删 App.js L43462/L43548 旧锚]
| P2 缩略图伪复制 | files.ts L137/L253 | `fs.copyFileSync` 原图复制，无真实缩放 ✅ 属实 |

## 七、存疑 Bug（门4 留痕）

- **`we` 是组件局部非模块级**：ARCHITECTURE L2.4 称 `we`@L42936 模块级 loadResources，实际 grep `function we` 无模块级声明，`we`@L43015 是 `Y.useCallback`（组件内）。引用须带 @L43015 并注明局部。
- **`Sv` 大写 vs `sv` 小写**：`sv`=nodeCallbackFieldSet（var-mapping L178，节点序列化白名单），与 `Sv`(saveResource) 完全不同的两个符号，文档须严格区分大小写。
- **base URL 双源**：`Hr`/`vv`/`U_` 均字面量 18080（var-mapping L117/118/233），未读 `config.LOCAL_ENGINE.base`；改 config 端口不生效（P0 残留）。

## 八、对抗审计质询

- Q：resourceAdded 的 `Zr` 是哪个？A：模块级 `Zr`@L1827（uploadRemoteUrlToLocalTool），非组件局部 logout@L43893（作用域不在此）。证据：L43539 调 `Zr(i.url,{subfolder:'migrated'})` 语义为"下载远程URL落盘"，与 L1827 一致。
- Q：删除资源会留下孤儿文件吗？A：会。`wv`@L42857 只 POST delete（DB），磁盘文件保留；`Tv`(clear) 传 `deleteFiles:true` 才删（L42874）。TASKS P2-6 ✅。
