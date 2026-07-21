# AI06 · 深化审计：模块3 生图轮询「七陷阱」代码级坐实

> 阶段：门4 对抗审计延伸 ｜ 方法：源码 grep + read_file 逐条坐实
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist（红线§3.1）。
> 配套：强化 `03-module3-aigen-gateway.md` 七陷阱章节（原仅引 FUNCTION_MAP，未落代码行）。
> 权威清单源：`docs/FUNCTION_MAP.md` §2.1（七陷阱定义）；`docs/reference/PRD_TASK_POLLING.md`（设计真源）。

## 0. 前置事实坐实（边界契约修正）
- 网关基址：`DEFAULT_ENDPOINT = 'http://127.0.0.1:9004'` @`config.js` L30（非 App.js）。`R`/`_`/`g` 局部变量为闭包捕获该基址（生图 `R`@L33005、视频 `_`@L33525/`g`@L34197）。
- 网关路由（`apimart-gateway/main.py`）：`POST /v1/images/generations`@L591、`POST /v1/videos/generations`@L641、`GET /v1/tasks/{task_id}`@L873、`POST /v1/tasks/{task_id}/confirm`@L882 —— 全部命中 ✅。
- 生图主回调：局部 `Jn`@L32490（useCallback），N 分支即网关异步轮询实现 @L32987-33061（生图）/L33504-33548（视频1）/L33848-34220（视频2）。

## 1. 七陷阱逐条代码级坐实

### 陷阱1 · 响应格式错位（task_id 检测分流）
- 定义：网关返回 `{code,data:[{status,task_id}]}`，须检测 `task_id` 改走轮询，否则同步读 `url` 报"未生成"。
- 代码：`Jn`@L32987-32991 `let taskId = t.data?.[0]?.task_id || t.data?.[0]?.id || t.task_id || t.id;` → L32990 注释「异步轮询分支（网关 task_id）」。**已实现 ✅**。

### 陷阱2 · AbortController 初始 fetch 后已删除
- 定义：`ht.current.delete(n)` 在 POST 返回后执行，轮询须新建 `AbortController` 重注册。
- 代码：@L32992-32994 `let ac = new AbortController(); ht.current.set(n, ac);`。**已实现 ✅**（A-C3 注释）。

### 陷阱3 · oe 超时不 abort 且轮询前已失效
- 定义：`oe` 只翻 UI 旗标、`.finally` 里 `clearTimeout` 已清，轮询须自建 deadline。
- 代码：@L32996-32997 `let deadline = Date.now() + 9e5;`（`9e5`ms = 15min）；@L33003 `if (Date.now() > deadline) throw Error('生成超时（15分钟）')`。视频分支同：`9e5`@L33521/L34193。**已实现 ✅**（A-C8 注释）。

### 陷阱4 · `.url` 是数组不是 string
- 定义：网关 `images[].url`/`videos[].url` 为 `[url]`，须 `.url[0]`，旧逻辑 `e.url` 当 string 致 `Image.src` 失败。
- 代码：@L33031-33032 `let imgUrl = result?.images?.[0]?.url?.[0]; let vidUrl = result?.videos?.[0]?.url?.[0];`；兜底同步 @L33037 `syncItem.url?.[0]`。**已实现 ✅**（严格数组[0]解析）。

### 陷阱5 · URL 过期（CDN 24h 后 404）
- 定义：取到 HTTP URL 须经 `ii(u)` 下载持久化到本地，**不裸存 CDN url**。
- 代码：@L33046-33052 轮询成功分支 `if (u && !u.startsWith('data:')) { let persisted = await ii(u, {subfolder:'tasks',...}); ... }` —— 轮询结果**已正确持久化 ✅**。
- ⚠️ **残留弱点**：`ii`@L1888-1897 对 `https?://` 远程 URL **直返不下载**（`if (/^https?:\/\//i.test(e) && !e.startsWith('data:')) return {url:e}`）。即：凡是绕过轮询、直接把远程 URL 传入 `ii` 的路径（如 `resourceAdded`@L43527 的 `Zr` 本地化失败兜底、或自定义节点同步分支），都会**裸存 CDN url**，离线/刷新即丢。属已知设计弱点，违反本地模式闭环（红线§3.2.6）。**结论：陷阱5 在轮询主链路已修复，在 `ii` 通用入口仍是敞口**。

### 陷阱6 · 审核拒绝 ≠ 普通失败
- 定义：终态 `failed` + `data.error.code:"no_artifact"` 优先透传 `message`，别笼统报"生成失败"。
- 代码：@L33043 `if (taskInfo.error?.code === 'no_artifact') throw Error(taskInfo.error.message || '生成完成但未产出媒资');`。**已实现 ✅**。

### 陷阱7 · 图/视频可独立出现
- 定义：`data.result` 只含实际存在的 `images`/`videos`，分别判空。
- 代码：@L33031-33033 `imgUrl = result?.images?.[0]?.url?.[0]; vidUrl = result?.videos?.[0]?.url?.[0]; u = imgUrl || vidUrl;` —— 分别提取、OR 兜底。**已实现 ✅**。

## 2. 坐实汇总
| 陷阱 | 实现状态 | 代码锚点 |
|------|----------|----------|
| 1 响应格式错位 | ✅ 已实现 | `Jn`@L32987-32991 |
| 2 AbortController 重注册 | ✅ 已实现 | @L32992-32994 |
| 3 自建 deadline 15min | ✅ 已实现 | @L32996-32997/L33003（视频 L33521/L34193） |
| 4 数组[0]解析 | ✅ 已实现 | @L33031-33032/L33037 |
| 5 URL 过期持久化 | ⚠️ 轮询链已修 / `ii` 通用入口敞口 | 轮询@L33046-33052；`ii`@L1888-1897 |
| 6 审核拒绝透传 | ✅ 已实现 | @L33043 |
| 7 图/视频独立判空 | ✅ 已实现 | @L33031-33033 |

## 3. 门4 对抗结论
- 七陷阱中 6 条在 `Jn` 轮询主链路已正确实现（A-C* 注释体系完整），1 条（#5）在**主链路已修复但在 `ii` 通用入口仍裸存远程 URL**，是模块3 唯一未闭环的设计弱点，建议列为 P3 观察项（不动代码，仅记录）。
- 边界契约修正：`DEFAULT_ENDPOINT` 实际位于 `config.js` L30（原 03 文档误归 App.js，行号 L30 正确但文件归属错），已在 `03-module3-aigen-gateway.md` 更正。

## 4. 门3 校验增量
新增引用（`config.js` L30、main.py L591/L641/L873/L882、`Jn`@L32490、L32987-33061/L33521/L34193/L33031-33052、`ii`@L1888-1897）均经 grep/read_file 坐实 ✅。
