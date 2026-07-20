# 文件系统数据流审计报告

> 审计日期：2026-07-20
> 审计范围：前端(App.js) → localTool(Node/TS) → 磁盘 的完整文件数据流

---

## 一、物理存储路径

```
数据根目录:  ~/.yimao-localtool/   (YIMAO_DATA_DIR 环境变量可覆盖)
上传目录:    ~/.yimao-localtool/uploads/
数据库:      ~/.yimao-localtool/localtool.db

uploads/ 子目录:
  ├── tasks/        生成产物 (AI 生成结果)
  ├── migrated/     采集素材 (右键"发送到资源")
  ├── canvas/
  │   ├── drop/     画布拖入文件
  │   └── paste/    剪贴板粘贴文件
  ├── .thumbnails/  缩略图缓存 (各子目录内)
  └── (其他)        用户自定义
```

---

## 二、文件写入入口（7 个源头）

### 入口 1：右键"发送到资源" → uploads/migrated/
```javascript
// 触发: background.ts L65 → chrome.runtime.sendMessage({action:'resourceAdded'})
// 前端接收: App.js L43436 → chrome.runtime.onMessage 监听
// 代码: Zr() → POST /api/files/upload (FormData: fileUrl=远程URL)
// localTool: handleUploadFormData L48-68 → fetch(远程URL) → saveFile(data, 'migrated', name)
// 结果: uploads/migrated/{timestamp}-{filename}
// 元数据: Sv() → POST /api/resources/save → resources 表
// 入口文件: App.js  L43436-L43467
// 读取/展示: 资源面板 → xv() → GET /api/resources?  → resources 表
```

### 入口 2：AI 生成结果 → uploads/tasks/
```javascript
// 触发: 统一同步 effect (L44208-L44283)
// 代码: uploadFile(CDN_url, local_mgr, 'tasks') → 内部调 Xr() 或 Zr()
// localTool: handleUploadFormData → saveFile(data, 'tasks', name)
// 结果: uploads/tasks/{timestamp}-{filename}
// 元数据: globalTasks 状态 + 后续 Sv() 保存
// 入口文件: App.js  L44287
```

### 入口 3：画布拖入文件 → uploads/canvas/drop/
```javascript
// 触发: 画布 onDrop (Lr, L36215-L36299)
// 代码: ii(e, {subfolder: 'canvas/drop'}) → Xr() → FormData(file) → POST /api/files/upload
// localTool: handleUploadFormData L35-45 → saveFile(fileData, 'canvas/drop', name)
// 结果: uploads/canvas/drop/{timestamp}-{filename}
// 入口文件: App.js  L36285
```

### 入口 4：剪贴板粘贴 → uploads/canvas/paste/
```javascript
// 触发: 画布 paste (L35997-L36028)
// 代码: ii(e, {subfolder: 'canvas/paste'}) → Xr() → FormData(file) → POST /api/files/upload
// localTool: handleUploadFormData → saveFile(fileData, 'canvas/paste', name)
// 结果: uploads/canvas/paste/{timestamp}-{filename}
// 入口文件: App.js  L36003
```

### 入口 5：资源面板文件上传 → uploads/canvas/
```javascript
// 触发: 资源面板 file input (L29140-L29158)
// 代码: R(files) → ii() → Xr() → FormData(file) → POST /api/files/upload
// localTool: handleUploadFormData → saveFile(fileData, 'canvas', name)
// 结果: uploads/canvas/{timestamp}-{filename}
// 入口文件: App.js  L29165-L29166
```

### 入口 6：资源面板 URL 拖入 → 不落盘
```javascript
// 触发: 资源面板 onDrop (B, L29160-L29179)
// 代码: 如果是 URL 文本 → O([{url: text, source: 'drop'}])
// 注意: 不调 ii()/Xr()/Zr()，不下载文件，只存 URL 到状态
// 结果: 资源面板显示，但文件不在 disk 上
// 入口文件: App.js  L29176
```

### 入口 7：剪映素材发送 → 占位
```javascript
// 触发: 资源面板"发送到剪映"按钮
// 代码: POST /api/jianying/send → 只记录日志，不真正发送
// 结果: 不落盘，纯占位
// 入口文件: localTool 路由，无实际实现
```

---

## 三、文件读取入口（3 个源头）

### 读取 1：静态文件服务
```javascript
// 触发: 浏览器 <img src="http://127.0.0.1:18080/files/tasks/xxx.png">
// 路由: GET /files/{subfolder}/{filename}
// 代码: handleStaticFile (index.ts L43-95)
//   → path.join(getUploadDir(), relativePath)
//   → 路径遍历安全检查
//   → fs.existsSync + fs.statSync
//   → MIME 映射 + Cache-Control: max-age=31536000
//   → fs.createReadStream → pipe(res)
// 安全: 有路径遍历防护 (L51-55)
// 入口文件: localTool/src/index.ts L43
```

### 读取 2：API 文件读取
```javascript
// 触发: 前端调 GET /api/files/read?path=...
// 代码: handleRead (files.ts L145-187)
//   → 支持 X-Proxy-* 头做代理读
//   → fs.existsSync + fs.statSync
//   → MIME 映射 + fs.createReadStream
// 入口文件: localTool/src/routes/files.ts L145
```

### 读取 3：缩略图 API
```javascript
// 触发: 前端调 GET /api/files/thumbnail?url=/files/...&maxDim=200&quality=80
// 代码: handleThumbnail (files.ts L224-258)
//   → 映射到磁盘路径
//   → 生成 .thumbnails/ 目录下的缩略图 (简单 copy)
//   → 返回 JSON {thumbnailUrl: string}
// 注意: 返回 JSON 不是直接返回图片二进制
// 前端: ri() (App.js L1856) 有 300s 内存缓存
// 入口文件: localTool/src/routes/files.ts L224
```

---

## 四、资源元数据持久化

### 4.1 前端资源操作函数 (App.js)

| 函数 | 行号 | 作用 | API 端点 |
|------|------|------|----------|
| `xv()` | L42742 | 查询资源列表 | GET /api/resources? |
| `Sv()` | L42759 | 保存资源 (upsert) | POST /api/resources/save |
| `Cv()` | L42772 | 切换收藏 | Sv({...isFavorite}) |
| `wv()` | L42778 | 删除资源 | POST /api/resources/delete?id= |
| `Ev()` | L42804 | 触发 rescan | POST /api/resources/rescan |
| `we()` | L42936 | 加载资源 (rescan + 查询) | Ev() → xv() |
| `yv()` | L42730 | 响应行转换 (蛇形→驼峰) | — |

### 4.2 localTool 资源路由 (resources.ts)

| 路由 | 方法 | 行号 | 作用 |
|------|------|------|------|
| `/api/resources` | GET | L168 | 分页查询 (支持搜索/排序) |
| `/api/resources/save` | POST | L181 | 单条 upsert (DELETE + INSERT) |
| `/api/resources/batch-save` | POST | L190 | 批量 upsert |
| `/api/resources/delete` | POST | L202 | 按 id 删除 |
| `/api/resources/clear` | POST | L211 | 按 folder 清空 / 全部清空 |
| `/api/resources/rescan` | POST | L37 | 扫描磁盘 → 同步到库 |

### 4.3 resources 表结构

```sql
CREATE TABLE resources (
  id TEXT PRIMARY KEY,      -- 格式: "local-{folder}-{name}" 或 "{timestamp}"
  url TEXT,                 -- 完整 URL (http://127.0.0.1:18080/files/...)
  type TEXT,                -- image/video/audio/text/folder
  source TEXT,              -- local-tool / extension
  folder TEXT,              -- 子目录名 (tasks/migrated/canvas/...)
  name TEXT,                -- 文件名
  page_url TEXT,            -- 来源页面 URL (仅采集)
  page_title TEXT,          -- 来源页面标题 (仅采集)
  is_favorite INTEGER,      -- 0/1
  timestamp INTEGER         -- Unix 毫秒时间戳
);
```

---

## 五、Rescan 同步机制 (resources.ts L37)

```
触发: 前端 Ev() → POST /api/resources/rescan
      节流: 3 秒内不重复

流程:
  1. 扫描 getUploadDir() 所有子目录 (排除 .thumbnails)
  2. 遍历每个子目录:
     ├─ 子目录 → 作为 type=folder 录入, id = "local-{folder}-{name}"
     └─ 文件 → 扩展名映射类型:
       ├─ .png/.jpg/.webp/... → image
       ├─ .mp4/.webm/.mov/... → video
       ├─ .mp3/.wav/.flac/... → audio
       ├─ .md/.markdown/.txt  → text
       └─ 其他 → 跳过
  3. 已存在同 id (local-{folder}-{name})? → 跳过 (保留收藏等元数据)
  4. 不存在? → INSERT
  5. 孤儿清理: source='local-tool' 但磁盘路径不存在的 → DELETE
  
返回: {count, scanned, added, skipped, orphanDeleted}
```

---

## 六、缩略图生成 (files.ts L104-142, L224-258)

### 6.1 上传时自动生成 (tryGenerateThumbnail)
```
saveFile() 返回后 → tryGenerateThumbnail(savedPath, urlPath)
  → 扩展名在 imageExts 白名单? (png/jpg/jpeg/webp/gif/bmp/svg)
  → 创建 .thumbnails/ 子目录
  → fs.copyFileSync(原图, 缩略图)  ← 没有 sharp 依赖，只是复制
  → 返回 thumbUrl
```

### 6.2 按需生成 (handleThumbnail)
```
GET /api/files/thumbnail?url=/files/...&maxDim=200&quality=80
  → 映射到磁盘路径
  → 文件名: thumb_{maxDim}x{quality}_{basename}
  → 已存在? 跳过 (缓存)
  → 不存在? fs.copyFileSync
  → 返回 JSON {thumbnailUrl: "..."}
```

### 6.3 前端缓存 (ri, App.js L1856)
```
ri(localUrl, {maxDim, quality})
  → 内存缓存: Map<key, {value, expireAt}>, TTL=300s
  → 并发锁: 第二个相同请求等待第一个完成
  → 返回: thumbnailUrl 字符串
```

---

## 七、文件删除/清理路径

### 7.1 资源面板删除
```
前端 wv(id) → POST /api/resources/delete?id=
  → localTool: DELETE FROM resources WHERE id = ?
  → 注意: 只删数据库记录，不删磁盘文件
```

### 7.2 资源面板清空
```
前端 → POST /api/resources/clear (可选 body: {folder, deleteFiles})
  → 无 folder: DELETE FROM resources
  → 有 folder: DELETE FROM resources WHERE folder = ?
  → deleteFiles=true: 额外删除磁盘文件
```

### 7.3 Rescan 孤儿清理
```
handleResourcesRescan (L122-130)
  → 查询所有 source='local-tool' 的记录
  → 检查磁盘文件是否存在
  → 不存在? DELETE FROM resources WHERE id = ?
  → 注意: 只清理 source='local-tool' 的记录
  → 注意: source='extension' 的记录不会被孤儿清理
```

---

## 八、关键交叉点分析

### 交叉点 1：资源面板显示的数据来源

```
资源面板显示数据有两个来源：
  A. transitItems (D 状态) — 由 resourceAdded handler 直接追加
  B. resources 数据库表 — 由 we() → Ev()(rescan) + xv()(查询) 加载

"发送到资源" 流程：
  resourceAdded → 追加到 D (transitItems) → 用户立即看到 ✅
                → Zr() 下载文件 → Sv() 存库 → we() 加载到 resources ✅
                
问题：transitItems 和 resources 是两个独立的数据源。
  - transitItems 只在内存中，刷新页面后丢失
  - resources 从数据库加载，持久化
  - 资源面板的"素材"Tab 显示的是 resources，不是 transitItems
```

### 交叉点 2：资源 ID 格式冲突

```
写入来源不同，ID 格式不同：
  - resourceAdded handler:  id = Date.now().toString()  →  "1740000000"
  - Rescan:                id = "local-{folder}-{name}"  →  "local-tasks-xxx.png"
  - Sv() 通过 upsert 方式:  DELETE + INSERT，同 id 覆盖

这意味着：
  - 同一个文件如果通过 resourceAdded 写入，再通过 rescan 发现，会产生两条记录 (id 不同)
  - 通过导出/导入的文件，rescan 会创建 "local-..." 格式的 id
  - 这不是 Bug，只是需要注意两个 ID 体系共存
```

### 交叉点 3：base URL 不一致隐患

```
Hr = localEngineBase()  →  根据 USE_LOCAL_ENGINE 决定
vv = LOCAL_ENGINE.base  →  固定 http://127.0.0.1:18080

使用 Hr 的函数:  Zr(), Xr(), Kr(), ri()
使用 vv 的函数:  Sv(), xv(), Ev(), wv()

当 USE_LOCAL_ENGINE=true 时，Hr === vv === "http://127.0.0.1:18080"
当 USE_LOCAL_ENGINE=false 时，Hr = "http://127.0.0.1:9004"，vv = "http://127.0.0.1:18080"
  → 此时文件操作走 Hr (9004)，资源操作走 vv (18080)
  → 9004 没有文件上传路由，文件操作会失败
```

### 交叉点 4：rescan 返回的 URL 格式

```
rescan 入库时，toAbsoluteFileUrl() 把相对路径补全为绝对 URL:
  "/files/migrated/xxx.png" → "http://127.0.0.1:18080/files/migrated/xxx.png"

而 Zr() 返回的 url 是相对路径:
  "/files/migrated/xxx.png"

两者都通过 LOCAL_TOOL_BASE 拼接，但 Sv() 保存的是 Zr() 返回的值。
资源面板显示时，URL 格式不一致:
  - 采集来的:  "/files/migrated/xxx.png"  (相对路径)
  - rescan 来的: "http://127.0.0.1:18080/files/migrated/xxx.png"  (绝对路径)
  
这在静态文件服务中不影响，因为 handleStaticFile 处理的是 pathname 部分。
但在 <img> 标签中，相对路径可能被解析为 chrome-extension:// 协议，导致破图。
```

### 交叉点 5：缩略图路径映射

```
缩略图 URL 格式: "/files/{subfolder}/.thumbnails/thumb_{basename}"
但 handleStaticFile 映射 "/files/" 后的路径到 uploadDir:
  path.join(uploadDir, ".thumbnails/thumb_xxx.png")
  
.thumbnails 是子目录，不是上传目录的子目录名，而是 uploads 下的隐藏目录。
实际上，.thumbnails 目录创建在每个子目录内:
  uploads/tasks/.thumbnails/
  uploads/migrated/.thumbnails/
  
但缩略图 URL 是: "/files/{subfolder}/.thumbnails/thumb_xxx.png"
handleStaticFile 解析为: uploadDir + "/" + "{subfolder}/.thumbnails/thumb_xxx.png"
  = uploads/{subfolder}/.thumbnails/thumb_xxx.png  ✅ 正确！
```

### 交叉点 6：rescan 遍历子目录时跳过 .thumbnails

```
resources.ts L49: .filter(e => e.name !== '.thumbnails')
→ 缩略图不会被 rescan 录入 resources 表 ✅
→ 但缩略图文件本身可以通过 handleStaticFile 直接访问 ✅
```

---

## 九、"发送到资源" 完整数据流审计

### 9.1 正向路径（代码层面）

```
Step 1: background.ts L65-116
  info.srcUrl / info.selectionText → TransitResource {source:'extension'}
  → chrome.storage.local.set('transitResources', [newResource, ...old].slice(0,5))
  → chrome.runtime.sendMessage({action:'resourceAdded', resource: newResource})
  → chrome.runtime.lastError 忽略 (侧边栏未打开时正常)

Step 2: App.js L43436-43467 (chrome.runtime.onMessage 注册于 L43474)
  r = async (msg, sender, sendResponse) => {
    if (msg.action === 'resourceAdded' && msg.resource) {
      → 检查 source === 'local-tool'?  false (source='extension')
      → Zr(i.url, {subfolder: 'migrated'})  ← 下载远程文件
        → Kr() 检查 localTool 连接状态
        → FormData: fileUrl=远程URL, subfolder=migrated
        → POST http://127.0.0.1:18080/api/files/upload
        → localTool 下载文件 → saveFile → uploads/migrated/{ts}-{name}
        → 返回 {url: '/files/migrated/{ts}-{name}'}
      → i.url = localized.url  (替换为本地路径)
      → D() 追加到 transitItems 状态
      → G() 触发刷新
      → Sv({...i, id: String(i.id)})  ← 保存元数据
        → POST http://127.0.0.1:18080/api/resources/save
        → resources 表 upsert
      → Te('transit') 切到 transit tab
      → j('materials') 切到 materials tab
      → sendResponse({success: true})
      → return false
    }
  }

Step 3: 用户查看资源面板
  → 资源面板显示 transitItems (D 状态) 中的内容
  → 切换到"素材"Tab 时，调 we() → Ev()(rescan) + xv()(查询)
  → 如果 Sv() 已成功，资源会在"素材"Tab 中显示
```

### 9.2 潜在断点分析

| # | 断点位置 | 条件 | 后果 |
|---|---------|------|------|
| 1 | L43400: `typeof chrome < 'u'` | 非扩展环境 | handler 不注册，resourceAdded 不处理 |
| 2 | L43448: `if (!r)` | source='local-tool' 时跳过下载 | 本地来源直接入库，不下载 |
| 3 | L43449: `Zr()` 调用 | 远程文件不可达/CORS/超时 | Zr() 返回 null → handler 返回 download_failed |
| 4 | L43452: `!localized || !localized.url` | Zr() 返回 null 或空 url | 资源丢弃，不存库 |
| 5 | L43462: `Sv()` 调用 | localTool 未连接/超时 | 资源在 transitItems 中，但不在 resources 表中 |
| 6 | L43465: `sendResponse({success: true})` | async handler 返回 false | Chrome 可能关闭消息通道 |
| 7 | L43474: `chrome.runtime.onMessage.addListener(r)` | 组件卸载 | listener 被移除 (cleanup 有 removeListener) |

### 9.3 跨流程交叉影响

```
交叉 A: 资源面板显示 ≠ 本地文件存在
  → transitItems 中的资源显示，不保证文件在 disk 上
  → 机制: 资源显示依赖 Sv() (存库)，文件存在依赖 Zr() (下载)
  → 两者在同一个 async 函数中顺序执行，一荣俱荣一损俱损

交叉 B: 资源面板 URL 格式不统一
  → 采集来的:  "/files/migrated/{ts}-{name}"  (相对路径)
  → rescan 来的: "http://127.0.0.1:18080/files/migrated/{ts}-{name}"  (绝对路径)
  → 如果在非 localTool 页面显示 (<img> 在 chrome-extension:// 页面中):
    相对路径 → 解析为 chrome-extension://.../files/... → 404 破图
    绝对路径 → 正常加载

交叉 C: 资源写作（收藏/删除/清空）与文件系统不同步
  → 收藏: 只改 is_favorite 字段，不影响文件
  → 删除: 只删 resources 记录，不删磁盘文件
  → 清空 deleteFiles=true: 删记录 + 删文件
  → 这种"软删除"策略有好处也有风险
```

---

## 十、所有已识别的 Bug / 风险

### P0 — 必然导致问题的

**1. 资源面板 URL 格式不统一导致破图**
- `resourceAdded` 保存的 URL 是相对路径 `/files/migrated/xxx.png`
- `rescan` 保存的 URL 是绝对路径 `http://127.0.0.1:18080/files/migrated/xxx.png`
- 在 `chrome-extension://` 页面中，`<img src="/files/migrated/xxx.png">` 会被解析为 `chrome-extension://xxx/files/migrated/xxx.png` → 404
- 修复: `Sv()` 保存前，调用 `toAbsoluteFileUrl()` 补全为绝对路径

### P1 — 特定条件下触发

**2. 资源面板 URL 拖入不落盘**
- `B` 回调 (L29160-29179) 处理拖入的 URL 文本时，只存到状态，不下载文件
- 这意味着拖入的 URL 资源在刷新页面后丢失
- 影响: 资源面板的"拖入 URL"功能只做临时展示

**3. 资源面板 file input 上传不自动入库**
- `R` 回调 (L29165-29166) 上传文件后，只更新状态，不调 `Sv()` 存库
- 需要手动触发 rescan 才能在 resources 表中看到
- 但 `z` (L29131) 中的 `R(files)` 后续调 `O()` 更新状态，但未调 `Sv()`

**4. `handleUploadFormData` 的 `fileUrl` 分支在跨域场景可能失败**
- localTool 使用 `fetch(fileUrl)` 下载远程文件
- 如果远程 URL 的 CORS 头不允许 localTool 的域访问，fetch 会失败
- 但 localTool 运行在 Node.js 环境，`fetch` 是 Node 内置的 undici，不受浏览器 CORS 限制 ✅
- 实际上这个不是问题，Node 的 fetch 没有 CORS

### P2 — 逻辑问题/设计缺陷

**5. ResourceAdded 处理中 base URL 不一致**
- `Zr()` 使用 `Hr` (localEngineBase，可能指向 9004)
- `Sv()` 使用 `vv` (LOCAL_ENGINE.base，固定 18080)
- 当 `USE_LOCAL_ENGINE=false` 时，文件上传到 9004，资源保存到 18080
- 但 9004 (apimart-gateway) 没有文件上传路由，`Zr()` 会失败
- 影响: 仅在 `USE_LOCAL_ENGINE=false` 时触发，目前默认 true

**6. 资源删除不删磁盘文件**
- `wv()` (L42778) 只调 `DELETE FROM resources`，不删磁盘文件
- 长期使用会导致磁盘上有大量"孤儿文件"
- 只有 `clear` 带 `deleteFiles=true` 才清理磁盘

**7. Rescan 孤儿清理只针对 source='local-tool'**
- `handleResourcesRescan` L123: `WHERE source = 'local-tool'`
- 通过 `resourceAdded` 创建的记录 (source='extension') 不会被孤儿清理
- 如果用户手动删除了磁盘文件，`resources` 表中仍保留 source='extension' 的记录

**8. 缩略图生成是简单复制，无实际缩放**
- `tryGenerateThumbnail` (L136-137): `fs.copyFileSync(filePath, thumbPath)`
- 不是真正的"缩略图"，只是原图复制到 `.thumbnails/` 目录
- 文件名中的 `thumb_{maxDim}x{quality}_` 前缀有误导性

---

## 十一、建议修复清单

| 优先级 | 问题 | 修复方案 | 涉及文件 |
|--------|------|---------|---------|
| **P0** | 资源面板 URL 格式不统一破图 | `Sv()` 保存前补全为绝对路径: `toAbsoluteFileUrl(i.url)` | App.js L43462 附近 |
| P1 | 资源面板拖入 URL 不落盘 | 拖入 URL 时调 `Zr()` 下载，或至少提示用户 | App.js L29176 附近 |
| P1 | 文件上传不自动入库 | `R(files)` 上传成功后调 `we()` 或 `Sv()` | App.js L29133 附近 |
| P2 | 资源删除不删磁盘文件 | `wv()` 中增加 `deleteFiles` 参数，可选联动 | App.js L42778 |
| P2 | 缩略图伪复制 | 接入 sharp 库做真正的缩放 | localTool files.ts L136 |
| P2 | 统一 base URL | 让 `Hr` 和 `vv` 使用同一个配置源 | App.js L1732/L42729 |

---

## 十二、排查建议

如果遇到"发送到资源"文件不落盘，按以下顺序排查：

1. **检查 localTool 日志** — 是否有 `POST /api/files/upload` 请求？是否有 `fetch` 下载日志？
2. **检查端口** — localTool 是否在 18080 端口运行？
3. **检查 ~/.yimao-localtool/uploads/migrated/** — 文件是否真的没写到这个目录？
4. **检查浏览器 DevTools 网络** — `resourceAdded` 消息是否被前端接收？
5. **检查资源面板数据源** — 资源显示在 transitItems 还是 resources？前者只在内存，后者才持久化
6. **检查 `YIMAO_DATA_DIR` 环境变量** — 是否设置了不同的数据目录？