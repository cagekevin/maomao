# 深七度：localTool Tasks 落库与批量删实证（AI05）

> 对象：`localTool/src/routes/tasks.ts`（全文 107 行，首读）+ `localTool/src/index.ts` L160-178 路由接线。
> 承接 `13` 节：`J_`(App.js L41611) → `POST /api/tasks/save`；`Y_`(L41696) → batch-save；`Z_`(L41696) → batch-delete。
> 红线：只读，不修改。

---

## 1. 路由接线（index.ts L160-178）

| 路径 | method | handler | 用途 |
|------|--------|---------|------|
| `/api/tasks` | GET | `handleTasksGet` L50 | 分页列表（按 created_at DESC） |
| `/api/tasks/save` | POST | `handleTasksSave` L63 | 单条 upsert ← `J_` |
| `/api/tasks/batch-save` | POST | `handleTasksBatchSave` L72 | 批量 upsert ← `Y_` |
| `/api/tasks/delete?id=` | POST | `handleTasksDelete` L84 | 单条删 ← `wv`?（待查 App.js 调用方） |
| `/api/tasks/batch-delete` | POST | `handleTasksBatchDelete` L93 | 批量删 ← `Z_` |
| `/api/tasks/clear` | POST | `handleTasksClear` L102 | 整表清空 |

---

## 2. upsert 机制（核心：DELETE + INSERT，非 SQL UPSERT）

```42:48:localTool/src/routes/tasks.ts
function upsertTask(db: any, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = keys.map(() => '?').join(', ');
  run(db, `DELETE FROM tasks WHERE task_id = ?`, [row.task_id]);
  run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals);
}
```

- **先 `DELETE FROM tasks WHERE task_id=?` 再 `INSERT`**——伪 upsert（read-modify-write）。
- 风险点：**并发同 task_id 的两次 save 会竞态**（非事务、非 INSERT OR REPLACE）。13 节已坐实前端用 1s 防抖(L43759)+变更检测缓解，故实际并发低。
- `task_id` 必填（L65 `if(!body.taskId) 400`）；`batch-save` 跳过缺 taskId 的项(L78 `continue`)。

---

## 3. 字段映射（蛇形↔驼峰 + JSON 字段）

- `SNAKE_TO_CAMEL`(L9-15)：task_id/node_id/result_url/thumbnail_url/error_msg/custom_output_type/channel_name/model_name/created_at/not_found_count/custom_result_data/custom_raw_response/request_data/response_data/media_meta/extra_fields。
- `JSON_FIELDS`(L19)：`customResultData`/`customRawResponse`/`requestData`/`responseData`/`mediaMeta`/`extraFields` 六字段以 JSON 字符串存（L36 `JSON.stringify`，读取 L26 `JSON.parse`）。
- **直接对应 13 节 `mutiwindow-update-task-meta` 写入的 `mediaMeta`**：经 `taskToRow` 序列化为 `media_meta` 列，读取时 `rowToTask` 反序列化——闭环成立。

---

## 4. 删除行为（与 P2 #6 呼应）

| handler | 行为 | 是否删盘 |
|---------|------|---------|
| `handleTasksDelete` L84 | `DELETE FROM tasks WHERE task_id=?` | ❌ 仅 DB，不碰文件 |
| `handleTasksBatchDelete` L93 | 逐条 `DELETE` | ❌ 仅 DB |
| `handleTasksClear` L102 | `DELETE FROM tasks`（整表） | ❌ 仅 DB |

> **与 11 节 `handleResourcesClear`(resources.ts L211) 对比**：resources 侧 `clear` 已支持 `deleteFiles` 参数（可真删盘），**tasks 侧 `clear` 无此参数——删任务永不删关联文件**。即任务记录清空后，其 `result_url` 指向的 `uploads/` 文件成孤儿（需 rescan 才能发现，但 rescan 仅清 `source='local-tool'`，见 11 节——任务产物 `source` 大概率非 local-tool，**孤儿可能永久滞留**）。
> 这是比 P2 #6（resources 删不删盘）更深一层的残留：`clear tasks` 无任何删盘路径。

---

## 5. 与 App.js 调用方衔接（13 节延伸）

| App.js | 调用 | 对应 handler |
|--------|------|-------------|
| `J_` L41611 | `POST /api/tasks/save` | `handleTasksSave` L63 |
| `Y_`(批量,L41696) | `POST /api/tasks/batch-save` | `handleTasksBatchSave` L72 |
| `Z_`(批量,L41696) | `POST /api/tasks/batch-delete` | `handleTasksBatchDelete` L93 |

- `J_` 写库 = 13 节 `mutiwindow-update-task-meta` 落库终点，全链路闭合：`L41032 发 → L43734 监听 → L41611 J_ → /api/tasks/save → upsertTask(DELETE+INSERT) → media_meta 列`。

---

## 6. 新发现（文档缺陷/风险）

### 6.1 tasks clear 无删盘路径（新增残留债务）
- `handleTasksClear`(L102) 整表清空不删文件，且**无 `deleteFiles` 参数**（resources 侧有但 tasks 侧无）。
- rescan 孤儿清理仅清 `source='local-tool'`(11 节)，任务产物若标其他 source 则清不掉。
- 建议（仅记录）：tasks clear 增加 `deleteFiles` 选项，或在 rescan 补「tasks 表无对应记录的文件」清理分支。

### 6.2 upsert 竞态（低危）
- `upsertTask` 非事务 DELETE+INSERT，理论并发竞态；前端 1s 防抖缓解，实际风险低。

---

## 7. 校验（门3）

| 引用 | 文件:行 | 命中 |
|------|---------|------|
| tasks 路由接线 | index.ts L164/L167/L170/L173/L176 | ✅ |
| handleTasksSave | tasks.ts L63 | ✅ |
| upsert DELETE+INSERT | tasks.ts L46/L47 | ✅ |
| mediaMeta JSON 字段 | tasks.ts L19/L36/L26 | ✅ |
| handleTasksClear 无删盘 | tasks.ts L102-105 | ✅ |
| J_ → /api/tasks/save | App.js L41611 | ✅（13 节已坐实） |
