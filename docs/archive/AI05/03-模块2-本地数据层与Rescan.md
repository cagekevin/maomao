# 模块2 · 本地数据层与 Rescan（AI05 / T2.2）

> 边界：前端 ↔ localTool(:18080) 的资源持久化、rescan、上传/下载、缩略图。
> 锚点：T0 已坐实的 6 个模块级函数（`Ev`/`we`/`Sv`/`wv`/`ii`/`ri`）+ 映射表。

---

## 1. 运转图景

资源从"内存态（transitItems / 拖放预览）"到"持久态（localTool resources 表）"的全链路：
1. 用户拖入/粘贴/采集 → 前端 `O([{url, source}])` 入内存（**仅预览，不落盘**）。
2. 需持久化时：`Sv(e)` → `POST /api/resources/save`（upsert）。
3. 生成完成/同步触发：`Ev()` → `POST /api/resources/rescan`（扫磁盘 → 入库）。
4. 上传文件：`ii(e,t)` → `POST /api/files/upload` → 落盘 `uploads/{subfolder}/`。
5. 缩略图：`ri(e,t)` → 内存缓存 Map(TTL 300s) + 并发锁，未命中回 localTool `/api/files/thumbnail`。

## 2. 核心混淆字典（模块2，带行号，T0 坐实）

| 混淆名 | 可读名 | 行号 | 证据 | 映射表状态 |
|--------|--------|------|------|-----------|
| `Ev` | rescan 触发器 | @L42883 | `fetch(${vv}/api/resources/rescan)` | ⚠️ func-mapping 漏收，建议补 |
| `we` | rescanResources 主函数 | @L43015 | `await Ev()` + `xv()` 查询 | ⚠️ 漏收，建议补 |
| `Sv` | 资源 upsert/入库 | @L42838 | `POST /api/resources/save` | ⚠️ 漏收，建议补 |
| `Cv` | 切换收藏 | @L42851 | `Sv({...e, isFavorite:t})` | ⚠️ 漏收，建议补 |
| `wv` | 资源删除 | @L42857 | `POST /api/resources/delete?id=` | ⚠️ 漏收，建议补 |
| `ii` | uploadFile 统一上传 | @L1888 | `fetch(${Hr}/api/files/upload)` | ⚠️ 漏收，建议补 |
| `ri` | 缩略图内存缓存 | @L1856 | Map + TTL + 并发锁 | ⚠️ 漏收，建议补 |
| `xv` | 查询资源列表 | ARCH L1.4 | `GET /api/resources` | 已引（行号漂） |
| `R`(L29149) | 文件→dataURL 预览 | @L29149 | 局部回调，**非上传函数** | 跳过（局部） |
| `B`(L29188) | 拖放处理回调 | @L29188 | 局部回调，URL 拖入只入内存 | 跳过（局部） |

> ⚠️ 注：TASKS.md T0.1 称以上"待补"，实际 2026-07-19 映射表更新时漏收这 6 个模块级函数；本次 grep 坐实身份，建议在 func-mapping 补录（详见 `07-文档纠错建议.md`）。

## 3. 关键数据流（带边界）

### 3.1 Rescan（`Ev` → localTool）
```
Ev() @L42883
  → POST `${vv}/api/resources/rescan`   (vv=http://127.0.0.1:18080, var L118)
  → localTool routes/resources.ts L37  扫 uploadDir 子目录(排除 .thumbnails)
  → 目录→type=folder，文件→extToFileType 映射
  → id=`local-{folder}-{name}`，已存在跳过
  → 孤儿清理只清 source='local-tool'（TASKS P2 #7）
  → 返回 count
we() @L43015 → await Ev() + xv() 刷新资源面板
```

### 3.2 资源入库（`Sv`）
```
Sv(e) @L42838 → POST `${vv}/api/resources/save` → localTool resources.ts L181 upsert
Cv() @L42851 → Sv({...e, isFavorite:t}) 切收藏
```

### 3.3 资源删除（`wv` — P2 已知缺陷）
```
wv(e) @L42857 → POST `${vv}/api/resources/delete?id=${e}`
  → localTool 只删 DB 记录，不删磁盘文件（TASKS P2 #6）
  → 长期产生孤儿文件
```

### 3.4 上传落盘（`ii`）
```
ii(e,t={}) @L1888 → fetch(`${Hr}/api/files/upload`, FormData)
  → 落盘 uploads/{subfolder}/  (Hr=http://127.0.0.1:18080, var L117)
  → 返回 url（相对路径，前端兜底补 host，见 ARCHITECTURE L2.5）
```

### 3.5 缩略图（`ri`）
```
ri(e,t={}) @L1856 → 内存 Map<TTL=300s> + 并发锁
  → 未命中 → GET /api/files/thumbnail?url=&maxDim=&quality= (localTool files.ts L224)
  → 返回 thumbnailUrl 字符串
```

## 4. 边界契约（缝合点）

| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | `POST /api/resources/rescan` | localTool resources.ts L37 | Ev 触发 |
| HTTP | `POST /api/resources/save` | localTool resources.ts L181 | Sv 入库 |
| HTTP | `POST /api/resources/delete` | localTool resources.ts L202 | wv 删除（只删DB） |
| HTTP | `GET /api/resources` | localTool resources.ts L168 | xv 查询 |
| HTTP | `POST /api/files/upload` | localTool files.ts | ii 落盘 |
| HTTP | `GET /api/files/thumbnail` | localTool files.ts L224 | ri 缩略图 |
| config | `vv` / `Hr` / `U_` | var-mapping L118/L117/L233 | 均 `http://127.0.0.1:18080` |
| CustomEvent | `mutiwindow-task-completed` | 交叉流 X2 | 生成完成 → Ev rescan → 刷新 |

## 5. 存疑 Bug（TASKS P1/P2 排雷，已代码坐实）

| Bug | 行号证据 | 结论 |
|-----|---------|------|
| P1 #2 URL 拖入不落盘 | `B`@L29188：拖入 URL 只 `O([{url, source:'drop'}])` 入内存，不调 `ii`/`Sv` | ✅ 属实。刷新后丢失（仅 transitItems 内存态） |
| P1 #3 文件上传不入库 | `R`@L29149 仅转 dataURL 预览；`B`@L29193 调 `R` 后 `O(...source:'drop')` 入内存，不调 `Sv` | ✅ 属实。需手动 rescan 才进 resources 表 |
| P2 #6 删除不删磁盘 | `wv`@L42857 只 `POST /api/resources/delete` | ✅ 属实。localTool 侧只删 DB |
| P2 #7 孤儿清理只清 local-tool | localTool resources.ts rescan 孤儿清理 `source='local-tool'` | ✅ 属实。`source='extension'` 不被清理 |
| P2 #8 缩略图伪复制 | localTool files.ts `copyFileSync` 无真实缩放 | ✅ 属实（代码在 localTool，非 App.js） |

## 6. 校验（门3 式）

- `Ev`@L42883 ✅ `/ `we`@L43015 ✅ `/ `Sv`@L42838 ✅ `/ `Cv`@L42851 ✅ `/ `wv`@L42857 ✅ `/ `ii`@L1888 ✅ `/ `ri`@L1856 ✅
- `B`@L29188（URL 不落盘）✅ `/ `R`@L29149（文件预览）✅
- rescan 路由 `POST /api/resources/rescan` 字符串存在于 localTool resources.ts（需回 localTool 核，本会话只读 App.js；localTool 侧见 `ARCHITECTURE.md` L2.2）⚠️ 跨包待核
