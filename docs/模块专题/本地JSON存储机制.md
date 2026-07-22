# 本地 JSON 存储机制（模块专题 · 按需查阅）

> 事实锚点：grep `src/App.js`（行号快照 2026-07-22）、`src/utils/storage/index.js`、`localTool/src` 坐实。
> 行号随构建漂移，主引用用函数语义名 + 真实路径；动手前回源码复核当前行号。
> 本文只写代码里已存在的机制，不写方案、不写待决策。

---

## 一、这是什么

应用绝大多数配置（用户、项目、模板、预设、画布状态……）以 **JSON 字符串**形式存 KV。这是一套**本地**存储方案，不是云端机制。

---

## 二、存储层级

- **StorageManager `Q`**（`src/utils/storage/index.js`）：`setObject/getObject/setConfig/getConfig`。
- **写入优先级**：`wr`（localTool KV `:18080`）→ `Mr`（chrome.storage.local）→ `Nr`（localStorage）→ `Pr`（localforage）。但 `Q.setObject`（≈238）**只调 `wr.setObject`**，localTool 不可用就直接返回 false（不降级到 chrome/localStorage）。
- **localTool KV 接口**：`window.localTool.saveKV(key, value)` → `POST http://127.0.0.1:{port}/api/kv/set`（`src/hooks/useLocalTool.js` ≈79）；读 `GET /api/kv/get?key=`（≈96）。同样 endpoint 也出现在 `src/entry.js`（≈71/79）。
- **localTool 进程**：Node 进程，监听 `:18080`，内部用 sql.js（WASM SQLite）内存数据库。
- **数据文件位置**：`~/.yimao-localtool/localtool.db`（`getDataDir`，可用 `YIMAO_DATA_DIR` 环境变量覆盖）。

---

## 三、落盘行为（已验证事实）

- **写入只改内存**：`localTool/src/routes/kv.ts` 的 `handleKvSet`（≈22-34）执行 `run(db, DELETE...)` + `run(db, INSERT...)` 后只 `return json(res,{ok:true})`，**不调用任何落盘函数**。即每次 `Q.setObject` 保存只是把数据写进进程内存，磁盘上的 `localtool.db` 没变。
- **落盘只在优雅退出**：`localTool/src/db/database.ts` 里 `saveDb()`（≈51-57）做 `db.export()` + `fs.writeFileSync(dbPath)`，但 `grep` 确认 **`saveDb()` 仅被 `closeDb()`（≈71-77）调用**；而 `closeDb()` 只在 `src/index.ts` 的 `shutdown`（≈271-278，绑定 `process.on('SIGINT'/'SIGTERM', shutdown)`）里触发。
- **触发丢数据的路径（事实）**：
  - localTool 正常 `Ctrl+C` 退出 → `SIGINT` → `shutdown` → `closeDb` → `saveDb` → 内存落盘 → 下次能读到。
  - 被关终端窗口 / 任务管理器杀掉 / 电脑睡眠后进程消失 / 崩溃 → **没走 `shutdown`** → 内存里的 KV 数据永远没写进磁盘 → 下次启动读到的是旧的 `localtool.db` → 数据消失。

---

## 四、一句话

`Q.setObject → localTool /api/kv/set → 只改进程内存 → 仅在 SIGINT/SIGTERM 优雅退出时 saveDb 落盘到 localtool.db；非优雅退出则内存数据丢失`。

---

## 五、改码前必查

1. **不能假设「保存返回 ok 就持久化了」**：`handleKvSet` 返回 ok 仅代表写进内存，磁盘落盘依赖进程优雅退出。
2. **`Q.setObject` 拒绝空值**：对空 `{}`/`[]`/空串直接 warn 拒写（`storage/index.js` ≈239-248）。
3. **localTool 不可用则写入直接失败**：`Q.setObject` 不降级到 chrome.storage/localStorage，返回 false。
