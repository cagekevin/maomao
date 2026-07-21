# HANDOFF4 — 画布疯狂刷新 / 生成停不下来（2026-07-20 已解决 ✅）

> 跨 session 交接：仅沉淀已用代码证实的事实与待查方向，不下未证实的结论。

## 现象
- 画布里节点反复生成、资源面板反复 rescan。
- localTool 日志可见循环序列：`proxy → /v1/images/edits → tasks/save → rescan → resources → 又 proxy`。

## 已用代码证实（App.js）
- 生图主流程 `Jn` 单次失败是 `throw`，**无自动重试循环**（约 L32821 `if(!l.ok){...throw Error(e)}`，`Jn` 内无 while/setInterval/递归重调自身）。
- 全文件搜 `retry`/`rerun`：均为「多模型按序重试」或「用户手动点重试按钮」，**无失败自动重发**逻辑。
- `Failed to fetch` 在生图路径是连接错误文案（L34-38 / L38155），不是循环证据。

## 已确认事实
- 排查当时网关 9004 是死的（`Failed to fetch`），但「网关死是否等于前端死循环」**未用代码证实，勿当定论**。

## 已查实根因（2026-07-20 本轮，代码+日志双重证实）

### 死循环主因：`src/_engine/App.js` L44208-44283 的「统一同步」effect 自我触发
1. 该 effect 依赖 `[i(globalTasks), n.status.isConnected, n.status.port]`。
2. 它对每个 `completed` 任务把 `resultUrl` 调 `uploadFile` 上传到 localTool（L44235），localTool `files.ts` 的 `saveFile` **每次都加 `Date.now()` 前缀**（`saveFile` L112：`${Date.now()}-${safeName}`），故每次上传返回**全新 url**。
3. 上传返回的 url 是**相对路径 `/files/tasks/xxx.png`**：`saveFile` 落盘为绝对路径 `savedPath`，但 `handleUpload` 把它转成 `/files/{subfolder}/{basename}` 相对 url 返回（`files.ts` L38/L42、L58/L62、L91/L95；本调用 `subfolder='tasks'`，见 L44235），**不含 host**。
4. 但 L44227 的本地化判定写的是 `e.startsWith('http://127.0.0.1') && /\/files\/tasks/`，**对相对路径 `/files/...` 永远为 false**（相对路径不以 `http://127.0.0.1` 开头）→ 已本地化的任务被判定为"未本地化" → 每次都重新上传。
5. 新 url ≠ 旧 url → L44251 `r.resultUrl = n, i = true` → L44260-44276 因 `e.resultUrl !== n.resultUrl` 又 `dispatchEvent('mutiwindow-task-completed')` → L31361 监听（completed）再 `Ev()` rescan + `Di.current()` 刷新资源面板 → `ev(i,t)` 持久化改 globalTasks → `i` 引用变 → **effect 立即重跑** → 回到第 2 步 → 无限循环。
6. 表现即 HANDOFF4 现象：`rescan → resources → 又 proxy(资源刷新) → 又 rescan`。每次循环都向 localTool 写新文件、刷新资源面板、更新所有节点 = "画布疯狂刷新/资源面板反复 rescan"。

### 修复方向（低风险，待用户拍板）
- **核心一行**：把 L44227 的本地 url 判定扩展为也匹配相对路径，已本地化的任务直接 `return e` 跳过上传：
  `if (!e || typeof e != 'string' || e.startsWith('/files/') || e.startsWith('http://127.0.0.1') && /\/files\/tasks(\/|$)/.test(e)) return e;`
- 这一行即可断开死循环：二次及以后 effect 跑时 `resultUrl` 已是 `/files/tasks/...`，命中 `e.startsWith('/files/')` → 跳过上传 → `i` 不变 → 不再 dispatch → 循环终止。
- 注意：死循环根因是 L44227 判定与 actual url 格式（`/files/...` 相对路径）不匹配，**与 `createdAt` 无关**。即使 `createdAt` 正常为数字，`saveFile` 的 `Date.now()` 前缀（L112）也会让每次上传 url 不同，循环照样发生。L44233 的 `createdAt` 回退 `Date.now()` 不是触发条件，无需为此改动。

### 与「单任务轮询停不下来」的关系（另一独立问题）
- 网关日志（`apimart_9004.log`）显示：同一 task `task_286e...` 被前端 `GET /v1/tasks/{id}` 轮询 **85 次** 未终态，而 `POST /v1/images/generations` 仅 1 次。
- 说明"生成停不下来"的表现一部分是**单任务卡在 processing 前端不停轮询**（L32906 `while(true)`，有 15min deadline 才停），并非反复新建任务。
- 网关 `_check_and_fire_task` 在 `pending_confirmation` 且 `AUTO_CONFIRM=false` 时返回 `processing`（main.py L854），会令前端永远轮询。需确认 Lovart 后端对该任务是否处于 `pending_confirmation` / 真未完成。此问题与上面的 rescan 死循环**相互独立**，应分开修。

## 待查（仅剩单任务轮询那一处）
- 网关侧该 task 的真实状态：是否被 `pending_confirmation` 卡住（`AUTO_CONFIRM` 当前值见 `main.py`）。若是，要么开 `AUTO_CONFIRM`，要么前端在收到 `pending_confirmation` 错误码（409 + code）时停止轮询并提示用户确认。

## 与破图的关系
- 破图已修复（`d5d48dd`，rescan 入库 url 补全为完整地址，资源面板图片已能显示）。
- 疯狂刷新是**独立问题**，不要和破图混为一谈（上一个 AI 曾误把两者归因到一起）。

---

## ✅ 修复记录（2026-07-20，`cd3c0aa`）

### 修复内容
两处修改，均在 `App.js`：

1. **`uploadFile` 返回补全绝对路径**（原 L19044 附近）：`a.json()` 之后，如果返回的 `url` 或 `thumbnailUrl` 以 `/` 开头，统一补 `http://127.0.0.1:${Bc}` 前缀。防止 Chrome 扩展环境把相对路径解析为 `chrome-extension://` 前缀导致加载失败。

2. **统一同步 effect 的本地化判定补上相对路径检测**（L44265）：原判定 `e.startsWith('http://127.0.0.1') && /\/files\/tasks/` 不匹配 `/files/...` 相对路径，导致已本地化的任务被反复重新上传。加上 `e.startsWith('/files/')` 条件后，相对路径也被识别为"已本地化"，跳过上传 → 不再触发新 url → 死循环断开。

### 验证
- 实际提交 `cd3c0aa`，commit message：`fix(engine): 修复生图后图片相对路径导致扩展环境疯狂刷新 + rescan死循环 + 网关venv自愈`
- 改动后画布不再疯狂刷新，资源面板 rescan 不再循环触发
- 单任务轮询卡住（`pending_confirmation`）是独立问题，不在本次修复范围内
