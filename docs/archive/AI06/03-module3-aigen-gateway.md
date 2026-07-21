# AI06 · 模块3：AI 生成与网关层

> 审计日期：2026-07-21 ｜ 行号快照会漂移，动手前重 grep。
> ⚠️ 生图主回调是**局部 useCallback `Jn`@L32490**，非模块级 `Jn`(LogoIcon@L89)。引用必带行号。

## 1. 运转图景
节点生成 → 局部 `Jn`(L32490) 提交 → 网关 `/v1/images|videos/generations` → 返回 `task_id` → 轮询 `GET /v1/tasks/{id}`(网关) → 解析结果 URL → `ii`(L1888) 落盘 18080 → 更新节点 → `mutiwindow-task-completed` → Ev rescan → 资源面板刷新。

## 2. 核心混淆字典（已坐实）
| 混淆名 | 可读名 | 行号 | 作用 | 注意 |
|--------|--------|------|------|------|
| `Jn`(局部) | generateImage 主回调 | **L32490** | 图片生成提交+轮询编排 | 局部useCallback，非模块级LogoIcon |
| `zc` | apiFetch(内部) | 多处 | 带鉴权fetch封装 | 轮询用它 |
| `R`/`_`/`g`(局部) | gatewayBase | L33005/L33525/L34197 | =9004 网关base | 局部变量，随回调作用域 |
| `pending_confirmation` 处理 | — | L32958/L33058/L33545/L34217 | 退出轮询，节点置等待确认 | `AUTO_CONFIRM=false`时卡死 |

## 3. 关键数据流（生图轮询，坐实）
- task_id 检测分流：`Jn`@L32987-32991 `task_id = t.data?.[0]?.task_id || ...`
- 轮询 URL：`pollUrl = ${R}/v1/tasks/${taskId}` @L33005（`R`=网关9004）
- 轮询节奏：≥3s、退避15s、15min deadline（见 FUNCTION_MAP §2.1 七陷阱）
- `pending_confirmation`：@L32958 返回 taskId 退出轮询；节点置"等待确认"（AUTO_CONFIRM=false 时卡死，TASKS 已知限制）
- 视频轮询：另有两处 @L33525(Lovart视频) / @L34197(另一视频分支)，结构同生图
- 结果落盘：解析 `images[].url`（数组[0]）→ `ii()`(L1888) 下载 → `uploads/tasks/` → 更新 `data.imageUrl/videoUrl`

## 4. 存疑 Bug / 雷（红线§3.2 + 七陷阱）
- **CDN 直链违规风险**：若 `ii` 收到 https CDN URL 直返不下载（L1889），刷新/离线即丢，违反本地模式闭环（红线§3.2.6）。当前 `ii` 逻辑确实对远程URL直返——属已知设计弱点。
- **pending_confirmation 卡死**：`AUTO_CONFIRM=false` 时轮询退出后节点永久等待（网关env）。
- **七陷阱**：轮询退避/并发去重/超时/重试/数组[0]解析/confirm 分支/结果落盘，详见 `FUNCTION_MAP.md` §2.1。**前端代码级逐条坐实见 `11-module3-seven-traps.md`**：6 条已在 `Jn` 轮询主链路实现（A-C* 注释），仅陷阱#5（URL 过期）在 `ii`@L1888 通用入口仍裸存远程 URL，属 P3 观察项（不动代码）。
- **端口坑**：网关必须 9004 启动，README 写 8000 会全 404（PROJECT_ORIGIN §4）。

## 5. 边界契约
| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | POST /v1/images/generations | 网关 main.py L591 | 图片生成 |
| HTTP | POST /v1/videos/generations | 网关 main.py L641 | 视频生成 |
| HTTP | GET /v1/tasks/{id} | 网关 main.py L873 | 轮询 |
| HTTP | POST /v1/tasks/{id}/confirm | 网关 main.py L882 | 手动确认 |
| config | `DEFAULT_ENDPOINT`='http://127.0.0.1:9004' | **config.js L30**（非 App.js；`R`/`_`/`g` 局部闭包捕获） | 网关地址 |
| CustomEvent | `mutiwindow-task-completed` | 触发@L38481/L43640/L43676/L43697/L44406 | 生成完成→rescan |
| 落盘 | `ii`(L1888)→Xr(L1802) | — | 结果落18080 |

## 6. 校验门
行号 grep 坐实 ✅。`Jn` 局部性已在阶段0厘清 ✅。
