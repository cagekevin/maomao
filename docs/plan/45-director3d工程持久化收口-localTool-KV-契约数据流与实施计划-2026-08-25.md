# 45 · director3d 工程持久化收口到 localTool KV + uploads 目录收口（无 rename）

> 状态：**规划中**（未实施）
> 日期：2026-08-25
> 范围：两部分——(A) uploads/ 子目录**中央收口**（**保留现有目录名不 rename**，仅新增 `director3d`）；(B) director3d 工程持久化从 localStorage **收口到 localTool KV**。
> 关联 deps：`src/components/base/filesApi.js`、`src/components/base/localToolApi.js`、`src/components/base/assetStore.js`、`src/components/base/videoEngine.js`、`src/components/nodes/VideoProcessNode.jsx`、`src/components/base/uploadDirs.js`(新)、`src/components/director3d/{storage,project}.js`、`src/components/director3d/App.jsx`、`localTool/src/routes/{files,kv}.ts`、`localTool/src/utils/fileStore.ts`

---

## 1. 背景与目标

### 1.1 背景
- director3d 工程整体存**浏览器 localStorage**（`storage.js` 的 `readJson/writeJson/removeKey`）。工程 JSON 塞了背景参考图（1600px JPEG base64）+ 每镜头缩略图（最多 30 张 240×135 JPEG base64），超约 5MB 配额时 `writeJson` 抛 `QuotaExceededError` → toast「自动保存空间不足」。
- uploads/ 子目录**无中央定义，纯字符串散落**，命名不统一（单层 `tasks`/`web`/`migrated` 与嵌套 `canvas/drop`、`canvas/video-process` 混用），且**后端不校验子目录**（files.ts:67 只 `subfolder || 'canvas'`）。

### 1.2 目标
1. uploads/ 子目录**中央收口**：所有 subfolder 引用进中央常量表（`uploadDirs.js`），**保留现有目录名、不做 rename**，仅新增 `director3d`；后端 optional 加白名单校验（含现有嵌套项）。
2. director3d 工程持久化**收口到 localTool KV**：base64 写前先显式落盘为本地文件 URL，工程瘦身到 KB 级，根除配额问题，并白拿文件管理 / 缩略图 / 跨刷新保留。

### 1.3 边界
director3d 是第三方开源模块（CLAUDE.md §二「最小集成、不主动重构、不纳入测试」）。收口**只动持久化层 + 读取时序**，不重构其内部业务，不改缩略图生成逻辑。

---

## 2. uploads 目录收口（无 rename，仅新增 director3d）

### 2.1 中央常量表
新增 `src/components/base/uploadDirs.js`：`UPLOAD_DIRS` 常象表，**保留现有值**并新增 `director3d`：

```js
export const UPLOAD_DIRS = {
  tasks:         'tasks',              // 生成结果
  web:           'web',                // 网页拖图本地化
  canvas:        'canvas',             // 主画布内部图 / 外部化 base64 通用落盘
  canvasDrop:    'canvas/drop',        // 拖放上传（嵌套，保持）
  videoProcess:  'canvas/video-process', // 视频帧处理（嵌套，保持）
  migrated:      'migrated',           // 迁移 / 导入
  director3d:    'director3d',         // 新增：director3d 工程素材
};
```

**此处一律不改名**：`tasks`/`web`/`canvas`/`migrated` 与嵌套 `canvas/drop`、`canvas/video-process` 全部沿用——避免任何存量 `/files/...` URL 与物理目录的破链接。仅多一个 `director3d`。

### 2.2 前端散落点改引常量
- `filesApi.js`：`SUBFOLDER`（tasks:17）、`WEB_DROP_SUBFOLDER`（web:19）、`saveInlineToLocal` 默认 `canvas`（:50）、`uploadFileToLocal` 默认 `canvas/drop`（:79）、saveResultToTasks 用 `tasks`。
- `videoEngine.js:458` 与 `VideoProcessNode.jsx:920`：`canvas/video-process`。
- `localToolApi.js:203`：`migrated`。
- `assetStore.js`：`folder` 参数透传（调用方改引常量）。

### 2.3 后端白名单（可选，需放行嵌套）
`resolveUploadTarget`（fileStore.ts:35）用 `path.join(getUploadDir(), subfolder)`，**天然支持多段**（`canvas/drop` 能拼成 `uploads/canvas/drop`），这正是现有嵌套生效的底层原因。
- 若要加白名单校验，**必须显式包含现有六个值，尤其两个嵌套项**（`canvas/drop`、`canvas/video-process`），否则一上线即打爆拖图/视频帧落盘。白名单 = `UPLOAD_DIRS` 六值 + `director3d`。
- 若不想引入拒绝分支风险，本项**可不做**，仅靠前端常量表约定即达收口目的（与现状后端不校验一致，风险同现状）。

### 2.4 明确不做（无 rename 故无迁移）
- ❌ 不重命名任何现有物理目录。
- ❌ 无 `resources/tasks/kv` URL 改写（不改建脚本），因此**无 DB 迁移、无停机窗口、无 R1/R11 类风险**——这是本方案相较「改目录名」的核心收益。

---

## 3. director3d 收口契约数据流

### 3.1 写入（自动保存 / 手动保存 / 姿势库）
```
同步调用点（现状，不变）           storage.js 适配层（改后端分支）              localTool 后端
─────────────────────────────    ───────────────────────────────         ──────────────────────
writeJson(key, currentProject) ─► ① base64 显式落盘 subfolder='director3d' ─► POST /api/files/upload?subfolder=director3d
                                   → /files/director3d/<sha1>.<ext>            （file 模式）→ 落盘
                                  ② 替换工程内 base64 为 URL                
                                  ③ JSON.stringify → POST /api/kv {key,value} ─► handleKvSet：value 已无 base64 → 不再 externalize
writeJson(CUSTOM_POSE, poses) ─► 幂等 fetch（失败静默，保内存态）               → DELETE+INSERT kv 表，debouncedSaveDb()
```
- **写契约**：`POST /api/files/upload`（复用现有端点，前端同目录名 `director3d`）；`POST /api/kv` body `{ key, value }` → `{ code: 0, data: { ok: true } }`。
- **写策略**：保留现有 900ms 防抖；适配层内同步写改**异步 fire-and-forget + 失败静默**；业务侧返回语义向后兼容（后端写失败**不抛、不阻塞编辑**，内存态为权威）。
- zero 双写：**不双写 localStorage**；同 key 要么走后端，要么后端不可达时降级 localStorage（见 R2）。

### 3.2 读取（启动 hydrate）
```
App 挂载 → 适配层 readCache(key)                          localTool
   ① 有 nodeId → key = director3d-project-<nodeId>
   ② GET /api/kv?key=...  ──► handleKvGet → {code:0, data:<工程JSON 或 null>}
   ③ data 非空 → JSON.parse → normalizeProjectData → startupProject
   ④ data 空 → 回退 localStorage → 有则写回 KV 触发迁移
```
- **读契约**：`GET /api/kv?key=...` → `{ code: 0, data: <解析后工程 JSON 或 null> }`。
- 因读变异步，`App.jsx:158 startupProject = useMemo(readCachedProject(...))` 改为**挂载后一次性 fetch hydrate**（存 state），fetch 完成前不触发 `applyProjectSnapshot` 重置；降级路径保持同步。

### 3.3 隔离与目录
- director3d 显式落盘子目录**统一小写 `director3d`**；工程写入 KV 前已无 base64，**不触发 externalize**，目录隔离干净（不混入 `assets/`）。
- 孤儿 GC（`extractFilesUrls`）仅匹配 `/files/...`，与文件夹无关 → `uploads/director3d` 落盘文件自动受引用保护。
- maomao 缩略图体系 `ensureThumbnailTarget` 会在 `director3d/.thumbnails/` 内生缩略图，rescan 自动跳过 → 对接「自带缩略图管理」。

### 3.4 迁移 & 降级
- 本地→后端：读取时后端空、localStorage 有 → 写回 KV 再用；旧 localStorage **暂不清**，观测稳定后再清。
- 不可达降级：读/写回退 localStorage；降级态跳过 base64 落盘（本地无后端目录），保留原 dataURL。

---

## 4. 翻车点（风险清单）

| # | 翻车点 | 严重度 | 核实结论 / 规避 |
|---|--------|--------|----------------|
| R1 | **后端未起 / fetch 失败 → 自动保存静默丢失** | 高 | 适配层失败**回退 localStorage**；logger.warn 区分「走后端 / 已降级」。 |
| R2 | **同步读→异步读，启动时序崩 / startupProject 空导致重置工程** | 高 | 挂载 fetch hydrate，fetch 前不触发重置；降级路径保持同步。 |
| R3 | **chrome-extension:// 页面 fetch http://127.0.0.1:18080 的 CORS/CSP，及 `<img>` 加载外链** | 中 | 主画布已走通（filesApi / `toAbsoluteFileUrl`）；落地用 DevTools 验证扩展页 fetch + img 加载绝对 URL 无 404。 |
| R4 | **kv.value 长 TEXT 存 sql.js，全量 export 卡死**（docs/41 旧痛） | 中 | 依赖 base64 已前端落盘（KV 内近无 base64）；写前断言 `data:` 残留为 0。 |
| R5 | **多 Director3DNode 并发 / 双击多开覆盖** | 低 | KV 无版本保护（projects.version 只套项目表）。每节点独立 key + 常单实例，风险低；记录为已知限制，不加锁。 |
| R6 | **缩略图 dataURL→http URL，渲染组件是否可用** | 低 | 现状缩略图即 `<img src={shot.thumbnail}>`/canvas drawImage，http 绝对 URL 可直接访问；不改生成逻辑。 |
| R7 | **localStorage 旧数据迁移中途丢** | 中 | 迁移后**先不删** localStorage，观测 1 批后再清。 |
| R8 | **外部 CDN/TLS 断链破图（daily-08-14 类）** | 中 | 收口后图走本地文件，不依赖外网，天然规避（附带收益）。 |
| R9 | **rescan 把 `director3d/` 扫成素材文件夹** → director3d 背景图/缩略图会被 rescan 收进主素材库（resources.ts:79 遍历非 `.thumbnails` 子目录） | 中 | 需拍板：接受（主画布复用）/ 排除。默认按**接受**实现，反转成本低。 |
| R10 | **后端白名单误拒嵌套目录**（若实施 §2.3） | 中 | 白名单必须显式含 `canvas/drop`、`canvas/video-process`，否则一上线打爆拖图/视频帧；不透传时本项不触发。 |

---

## 5. 实施计划（安全增量、可回退、逐批验证）

> 每批结束跑 `npm run build`；涉及 `localTool/src/**` 的批次跑 `cd localTool && npm test`。**批次 0 必须最先做**（director3d 要写进新增的 `director3d` 目录）。

### 批次 0 —— uploads 目录中央收口（无 rename）
1. 新增 `uploadDirs.js` 中央常量表（含 `director3d`，保留现有值）；`filesApi.js / localToolApi.js / assetStore.js / videoEngine.js / VideoProcessNode.jsx` 的 subfolder 散落点改引常量。
2. 【可选】后端 `resolveUploadTarget` 加白名单（必须含 `canvas/drop`、`canvas/video-process` 两个嵌套项）。
3. `npm run build`（+如做后端 `cd localTool && npm test`）；人工：生成 / 拖图 / 视频帧 / 素材库 / GC 均正常（目录名未变，行为应完全等价）。

### 批次 A —— director3d base64 落盘到 `director3d` 目录
4. director3d 保存前预处理：`reference.image` / `shots[].thumbnail` 用 `saveInlineToLocal(url, 'director3d')` 落盘替换为 `/files/director3d/<sha1>.<ext>`；失败保留原 dataURL（写前断言 `data:` 残留为 0）。
5. 扩展 `storage.js`：后端 KV + localStorage 双通道，fetch 失败/不可达回退本地；保留同步表面 API（写异步 fire-and-forget，读仍同步）。
6. 新增 KV client（`/api/kv` get/set/delete，走与主画布一致的 18080 绝对地址）。
7. 校验：`npm run build`；关/开 18080 两态各写一笔确认降级不破；`uploads/director3d/` 出现文件、KV 无 `data:` 残留。

### 批次 B —— 读取 hydrate 异步化 + 迁移
8. `App.jsx` 挂载 fetch `startupProject` 存 state；fetch 前不触发 `applyProjectSnapshot`。
9. 本地→后端迁移：后端空 + localStorage 有 → 写回 KV。
10. 校验：`npm run build`；刷新后工程/背景/缩略图完整还原（URL 指向 `/files/director3d/`）；`director3d/.thumbnails/` 自动补齐。

### 批次 C —— 登记与决策落位
11. KV 三个端点 / files 新目录登记 `contracts.js apiRegistry`（若未登记）；跑 `npm run check:api`。
12. 本期两部分决策记入 `spec/CONTEXT.md`（存储 / 横切章节），不新建 ADR。

---

## 6. 明确不做（避免越界）
- ❌ 不重构 director3d 内部（scene/schema/组件），不为它写测试、不纳入 `tests/`。
- ❌ 不改 director3d 缩略图**生成**逻辑（仍自绘），仅享受「落盘为文件 + maomao 缩略图体系可识别」。
- ❌ 不接入主画布 `contentStore`（跨第三方边界耦合）。
- ❌ 本次不做多开并发锁 / 版本冲突保护（见 R6）。

---

## 7. 验收标准
1. uploads 目录收口后：生成 / 拖图 / 视频帧 / 素材库 / GC / rescan 全部正常（目录名未变，行为与改前等价）；新增 `uploads/director3d/` 正常建出。
2. 关 18080 时 director3d 照常保存（降级 localStorage，无 toast 报错）；开 18080 后无感切回后端。
3. 大背景图 + 30 镜头工程保存**不再触发**「自动保存空间不足」；KV 内工程值 `data:` 残留为 0。
4. 刷新 / 换浏览器（同一 localTool）后工程、背景图、缩略图完整还原（`/files/director3d/`）。
5. `npm run build` 通过；后端批次（如做白名单）`cd localTool && npm test` 通过。