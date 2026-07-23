# 一毛AI画布 · 数据模型（Database）

> 实体来自 localTool（来源 `docs/AI08/33_模块6_localTool服务端.md` + `docs/AI11/09-localTool与网关路由全量核对.md` + AI13 最终报告 + AI05-03/11 实证）。
> 本文只记录"代码表达不了的字段语义 / 已知债务 / 修复解法"，不贴全 DDL（遵循"代码即文档"）。对外调用见 `06-integration.md` §四。

---

## 一、存储总览

| 层 | 技术 | 位置 | 内容 |
|----|------|------|------|
| 本地持久 | sql.js(WASM) SQLite | `~/.yimao-localtool/localtool.db` | resources / tasks / kv 三表 |
| 磁盘文件 | 文件系统 | `~/.yimao-localtool/uploads/` | 生成 / 采集 / 拖入 / 粘贴 / 缩略图 |
| 浏览器内 | chrome.storage / localStorage / localforage | 扩展沙箱 | 设置 / 鉴权 / 画布状态(易失/半持久) |

> `YIMAO_DATA_DIR` 可覆盖 `~/.yimao-localtool/`。

---

## 二、核心实体（localTool SQLite）

### 2.1 `resources` 表（resources.ts）
资源面板的数据源。

| 字段 | 含义 |
|------|------|
| `id` | 主键，rescan 用 `local-{folder}-{name}`；`resourceAdded` 用 `Date.now()`（两源可能重复，见债务） |
| `url` | 资源地址；经 `toAbsoluteFileUrl` 补全为 `http://127.0.0.1:18080/...` |
| `type` | image / video / audio / text / folder（扩展名映射见下「资源类型识别规则」） |
| `source` | `local-tool` / `extension` —— **孤儿清理只清 `source='local-tool'`**（resources.ts L120-130） |
| `folder` | 嵌套浏览目录 |
| `name` / `page_url` / `page_title` | 采集元数据 |
| `is_favorite` | 收藏标记（Cv 切换） |
| `timestamp` | 时间戳 |

### 2.2 资源类型识别规则（rescan 入库，实证有效）
`localTool/src/routes/resources.ts` 的 `RESCAN_FILE_TYPE`(L12-L21) 按扩展名映射：

| 扩展名 | 入库 type |
|--------|-----------|
| `.png .jpg .jpeg .webp .gif .bmp .svg` | `image` |
| `.mp4 .webm .mov .avi .mkv .flv .m4v` | `video` |
| `.mp3 .wav .flac .ogg .m4a` | `audio` |
| `.md .markdown .txt` | `text` |
| 目录项 | `folder` |

- 未登记扩展名被 `extToFileType` 直接跳过，不进资源表。
- rescan 仅扫 `uploadDir` 子目录，跳过 `.thumbnails` 与 `.` 开头项；`id = local-{folder}-{name}`，已有 id 直接 `skipped`（保留收藏/元数据）。

### 2.3 破图真因 & 已知残留（防复发）
- **真凶**（已在 `d5d48dd` 修复）：rescan 把 `url` 存成相对路径，在 `chrome-extension://` 下解析成 `chrome-extension://xxx/files/...` → 404 破图；修复为补全 `http://127.0.0.1:18080/files/...`。
- **残留风险**：① 入库 `url` host 硬编码 `127.0.0.1:18080`，改 host/port 或跨设备需同步；② **中文目录/文件名 Latin1 乱码**（如"新建文件夹"→`æ°å»ºæä»¶å¤±`），疑似 sql.js 以 Latin1 存中文，**待修**。

### 2.3 `tasks` 表（tasks.ts）
AI 生成任务记录。

| 字段 | 含义 |
|------|------|
| `task_id` | 主键（对应网关 `/v1/tasks/{id}`） |
| `node_id` | 关联画布节点 |
| `prompt` | 提示词 |
| `result_url` | 生成结果地址 |
| `media_meta` | 由 `taskToRow` 序列化（tasks.ts L19/L36），由 `mutiwindow-update-task-meta` 事件回填 |

### 2.4 `kv` 表（kv.ts）
通用键值，含播种幂等锁（`Ov`=tasks_seeded、`resources_seeded_to_sqlite`）。

| 字段 | 含义 |
|------|------|
| `key` | 主键 |
| `value` | 文本值 |
| `updated_at` | 时间戳 |

---

## 三、upsert 实现特征

所有 upsert 为 **DELETE + INSERT**（无 `ON CONFLICT`），非真正 upsert（AI08/AI11 实证）。批量接口（`/batch-save`）body 为数组。

---

## 四、已知债务与已存在的修复解法（接接口时必读）

1. **单删 `wv`@L42857 只删 DB 不删盘** → 孤儿磁盘文件。
   - ✅ **解法已存在**：localTool `handleResourcesClear`@L211 已支持 `deleteFiles` 参数（删文件夹+磁盘）；修复路径是让 `wv` 改用 clear 带 `deleteFiles`，或给 delete 端点加 `deleteFiles` 参数（AI05-11 实证）。
2. **tasks clear 无删盘路径**（tasks.ts L102，比 P2#6 更深）。
3. **rescan 孤儿清理只清 `source='local-tool'`** → `source='extension'` 记录不被清理。
4. **缩略图伪复制**：`tryGenerateThumbnail` 仅 `copyFileSync` 原图到 `.thumbnails/`，无真实缩放（文件名 `thumb_{maxDim}x{quality}_` 有误导性）。
5. **资源 ID 双源冲突**：`resourceAdded` 用 `Date.now()` vs rescan 用 `local-{folder}-{name}` → 同一文件可能两条记录。
6. **网关任务库内存态**：网关 `_TASK_META` 重启即丢（非 bug，已知限制）。

---

## 五、落盘路径（uploads/ 子目录）

| 子目录 | 写入来源 |
|--------|---------|
| `uploads/tasks/` | AI 生成结果（统一同步 effect → uploadFile） |
| `uploads/migrated/` | 右键采集（`resourceAdded` → `Zr`（真身 `src/services/localToolClient.js` L67）） |
| `uploads/canvas/drop/` | 画布拖入文件 |
| `uploads/canvas/paste/` | 剪贴板粘贴 |
| `uploads/.thumbnails/` | 缩略图（伪复制） |

> URL 拖入（资源面板）**不落盘**（仅存状态，刷新丢失，P1#2）。文件上传不自动入库（需手动 rescan，P1#3）。
