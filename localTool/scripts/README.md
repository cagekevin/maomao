# localTool scripts 工具清单

localTool 运维/调试脚本。统一入口：`cd localTool && npm run <脚本名>`（见 `package.json`）。

## 图片/视频生命周期排查 + 数据库维护（task-inspect.mjs）

**AI 用途速记**：遇到"图/视频不见了、刷新丢图、任务中心错位"这类 bug，先跑它断言断点在哪层。

`localTool/scripts/task-inspect.mjs` —— 媒体生命周期排查 + 查库 + 查日志 + 压缩（只读；`--vacuum` 压缩需先停 localTool）。
命令别名：`npm run inspect`（新）＝ `npm run db`（旧名保留）。

| 命令 | 作用 |
|---|---|
| `npm run inspect -- --lifecycle <id>` | **完整生命周期一键查**：数据库完整记录 + 后端日志 + 前端日志全链路。id 可为 **task_id** / **thread_id**（Lovart 上游"室外 ID"，即 task_id 去掉 `task_` 前缀）/ **node_id**。thread_id 模式自动转 `task_id="task_"+thread_id` 查库，并同时按 `thread_id` 与 `task_id` 双键 grep 日志，实现"上游 ID → 本地任务 → 全链路日志"打通 |
| `npm run inspect -- --task <node_id>` | 同一节点的所有任务进度/status/结果URL形态比对（丢图定位） |
| `npm run inspect -- --consistency [proj]` | **三层一致性断言**：画布快照节点URL ↔ 任务中心 result_url ↔ 磁盘文件 是否对得上，定位"刷新丢图/错位"根因（缺省取最近画布快照） |
| `npm run inspect -- --lost-check` | **丢图体检**：tasks 远程URL未落盘 / 失败任务 / 磁盘↔资源一致性 / 日志下载失败与上传400 |
| `npm run inspect -- --canvas-health [proj]` | 画布数据结构体检（节点/边统计 + 无id边/重复id边/悬空边） |
| `npm run inspect -- --lovart-status <thread_id>` | 拿 Lovart 上游 thread_id 直接向 Lovart 查任务状态（HMAC 签名，凭据 `LOVART_ACCESS_KEY/SECRET_KEY`，自动走代理） |
| `npm run inspect -- --lovart-result <thread_id>` | 同上，查任务**结果**（出图 URL / 生成文本），连 `/chat/result` |
| `npm run inspect -- --tables / --table tasks / --sql "..." / --search k / --kv k` | 通用只读查库 |
| `npm run inspect -- --logs [download\|upload\|proxy\|error\|official\|passthrough]` | 查 localTool 日志，支持按前缀/关键词过滤 |
| `npm run inspect -- --vacuum` | 压缩数据库（自动备份 + 完整性检查 + 端口冲突检测） |

库位置：`~/.maomao-localtool/localtool.db`（sql.js SQLite，schema 见 `localTool/src/db/database.ts`）。
日志位置：`localTool/logs/*.log`。
可用 `MAOMAO_DATA_DIR` 指定数据目录（隔离/测试环境）。

> **丢图排查主入口**：`npm run inspect -- --lost-check`（全库体检）＋ `--consistency <proj>`（单项目三层一致性）。生图链路已补 `[download]`/`[upload]` 留痕日志，下载成败、上传状态码均可从日志追溯。

## 其他脚本

- `vacuum-localtool-db.mjs` —— 独立的 VACUUM 压缩脚本（`--vacuum` 的能力来源，保留供无 npm 场景直接 `node scripts/vacuum-localtool-db.mjs` 调用；功能已并入 `npm run db -- --vacuum`）。

## 约定

- 新增工具：放 `localTool/scripts/`，语义化命名，在本清单登记，并在 `package.json` 加 `npm run` 脚本。
- 只读工具应不写库、不触发落盘，服务运行时也可安全调用；写库/压缩工具须做端口冲突检测。
