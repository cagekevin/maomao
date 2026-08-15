# localTool scripts 工具清单

localTool 运维/调试脚本。统一入口：`cd localTool && npm run <脚本名>`（见 `package.json`）。

## 数据库维护（db-query.mjs，统一入口 `npm run db`）

`localTool/scripts/db-query.mjs` —— 查库 + 查日志 + 压缩三合一（只读查库/日志；`--vacuum` 压缩需先停 localTool）。

| 命令 | 作用 |
|---|---|
| `npm run db -- --tables` | 列出所有表及行数 |
| `npm run db -- --table tasks --limit 5` | 查看指定表列 + 前 N 行 |
| `npm run db -- --sql "SELECT * FROM kv"` | 直接执行任意只读 SQL |
| `npm run db -- --sql "..." --arg v` | 带参数查询（? 占位符） |
| `npm run db -- --kv 键名` | 模糊查 kv 表（值截断 200 字） |
| `npm run db -- --search 关键词` | 在 kv/tasks/resources 全局模糊搜索 |
| `npm run db -- --table tasks --json` | 结果以 JSON 数组输出（接 jq/AI） |
| `npm run db -- --logs [download\|upload\|proxy\|error\|official\|passthrough]` | 查 localTool 日志，支持按前缀/关键词过滤 |
| `npm run db -- --task <node_id>` | 同一节点的所有任务进度/status/结果URL形态比对（丢图定位） |
| `npm run db -- --lost-check` | **丢图体检**：tasks 远程URL未落盘 / 失败任务 / 磁盘↔资源一致性 / 日志下载失败与上传400 |
| `npm run db -- --vacuum` | 压缩数据库（自动备份 + 完整性检查 + 端口冲突检测） |

库位置：`~/.maomao-localtool/localtool.db`（sql.js SQLite，schema 见 `localTool/src/db/database.ts`）。
日志位置：`localTool/logs/*.log`。
可用 `MAOMAO_DATA_DIR` 指定数据目录（隔离/测试环境）。

> **丢图排查主入口**：`npm run db -- --lost-check`。生图链路已补 `[download]`/`[upload]` 留痕日志（`localTool/src/routes/files.ts`，见 daily/2026-08-14 §一），下载成败、上传状态码均可从日志追溯。

## 其他脚本

- `vacuum-localtool-db.mjs` —— 独立的 VACUUM 压缩脚本（`--vacuum` 的能力来源，保留供无 npm 场景直接 `node scripts/vacuum-localtool-db.mjs` 调用；功能已并入 `npm run db -- --vacuum`）。

## 约定

- 新增工具：放 `localTool/scripts/`，语义化命名，在本清单登记，并在 `package.json` 加 `npm run` 脚本。
- 只读工具应不写库、不触发落盘，服务运行时也可安全调用；写库/压缩工具须做端口冲突检测。
