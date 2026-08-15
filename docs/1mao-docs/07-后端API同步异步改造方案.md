# 后端 API 同步异步改造方案（网关原生双模）

> **目的**：将 `apimart-gateway` 改造为「同时原生支持同步与异步」的生成接口（图片 / 视频 / 对话），把当前 localTool P0-4 的**临时兜底轮询**上移到网关，复用网关已有的轮询器，让 localTool 回归纯代理角色。
>
> **背景**：当前 P0-4 在 localTool `handleAsyncPoll`（`system.ts:309`）用 Node 重复实现了网关早已具备的轮询逻辑，且**缺失** `pending_confirmation` / `webhook` / `abort` 的完善处理。详见 `05-断点修复方案.md`（P0-4）、`02-断点三域梳理.md`（C 域·API 网关）。
>
> **方法**：回到 `apimart-gateway/main.py`、`localTool/src/routes/system.ts`、`localTool/src/routes/files.ts` 源码实证，标注 `文件:行号`。
>
> **状态图例**：`[待实施]` = 设计完成待编码；`[已落地]` = 代码中已完成；`[待联调]` = 代码改完需前端联调。

---

## 〇、核心结论（先给判断）

1. **网关已具备同步 + 异步两套基础设施**，只是图片 / 视频生成没接上「同步」那头：
   - 异步已完整：`_do_submit`（main.py:719）提交后返回 `ok([{status:"submitted","task_id"}])`；`GET /v1/tasks/{task_id}` + `_check_and_fire_task`（main.py:783）是封装好的完整轮询器（含状态判定、`pending_confirmation` 自动确认、`abort` 终态、`webhook` 触发、结果转换 `lovart_to_apimart`）。
   - 同步已完整（仅 chat 在用）：`run_and_get`（main.py:477）已实现「提交 → 内部轮询到完成 → 返回」，且逻辑很完善（done 后 sleep 5s 二次确认防翻转、超时抛 504）。
2. **改造量很小**：在 `_do_submit` 加一个 `wait` 开关，同步分支复用 `_check_and_fire_task` 写个循环即可，无需重写轮询逻辑。
3. **localTool P0-4 可整体删除 / 退化为「注入 wait + 透传」**：`handleAsyncPoll`（system.ts:309，约 70 行轮询 + 超时 + 重试）不再需要。

---

## 一、图片会不会丢失（前置风险澄清）

> 与同步 / 异步改造**无关**，但必须说清，避免误判。

- **当前结果形态**：生图结果 = Lovart CDN 外链，`expires_at = now + TASK_RESULT_TTL`（默认 `86400s = 24h`）——见 `main.py:37`（环境变量）、`main.py:145-154`（`lovart_to_apimart` 写入 `expires_at`）。
- **当前无自动转存**：localTool 已有 `saveRemoteUrl`（`files.ts:95`，唯一下载归属点，幂等 sha1 命名 + 缩略图），但**生图路径未调用**，P0-4 直接把 Lovart 外链返回前端。
- **结论**：图片「容易丢失」的主因是 **CDN 链接 24h 过期失效**，与同步 / 异步改造无因果关系。要做到「不丢失」，应在生图完成时调用 `saveRemoteUrl` 落盘、返回本地 url（**独立增强项**，可纳入本次或单列，不阻塞双模改造）。
- **其他「丢失」场景盘点**：
  - `handleAsyncPoll` 5min 超时返 504：图片在 Lovart 仍在，前端本次拿不到，可重试（非真丢失）。
  - 多图只取第一张：`url = images[0]?.url?.[0]`（system.ts:360），前端按需求只渲染一张，可接受。
  - 网关进程重启：不影响，`get_result` 实时从 Lovart 拉，且 `task_id = "task_" + thread_id` 可重建（`_check_and_fire_task` 内部即如此）。
  - 同步 / 异步两种模式下，前端拿到的都是 Lovart 外链，丢失风险一致。

---

## 二、改造方案（网关原生双模）

### 2.1 网关侧改动（`apimart-gateway/main.py`）

在 `_do_submit` 增加 `wait` 开关，复用现有轮询器：

- **开关判定**（优先级）：请求体 `"wait": true` > 查询参数 `?wait=1` > 环境变量 `DEFAULT_SYNC_GENERATION=true`（新增，默认 `false`）。
- **异步分支（默认 / 无 wait）**：保持现有 `ok([{status:"submitted","task_id":task_id}])` 返回，**不动**。调用方仍可 `GET /v1/tasks/{task_id}` 轮询。
- **同步分支**：提交拿到 `task_id` 后，循环调用**已有的** `_check_and_fire_task(task_id, client)` 直到 `is_done=True`，直接返回该 response（超时 / 兜底逻辑仿 `run_and_get` 的 `done` 后 sleep 5s 二次确认 + `max(LOVART_TIMEOUT, PROXY_TIMEOUT)` 截止，超时返 504，不挂死）。
- **输出格式对齐（关键）**：同步分支需特制输出 `{code:200, data:[{url, status:"completed"}]}`，与 P0-4 当前给前端的格式（system.ts:364）**完全一致**，这样 localTool 只需「透传 + 剥信封（P0-3）」即可，前端无需改动。
  - 注意：网关 `_check_and_fire_task` 的 completed 原始输出是 `_task_view(..., result=lovart_to_apimart(result))` = `{images:[{url:[...]}]}`，**不是** `data:[{url}]`，同步分支要二次重组。
- **复用已有处理**：`pending_confirmation` 自动确认、`abort` 终态、`webhook` 触发，全部复用 `_check_and_fire_task` 已有逻辑——比 localTool P0-4 版更全。

### 2.2 localTool 侧改动（`localTool/src/routes/system.ts`）

- 删除 / 退化 P0-4 的 `handleAsyncPoll`（system.ts:309）：检测到图片 / 视频生成请求（`/v1/images/generations`、`/v1/videos`、`/v1/video/generations`、`/v1/draw/completions`）时，向请求 body 注入 `"wait": true` 后直接 `fetch` 网关，仅做**「剥信封 `{code,data}` + 错误透传」**（沿用 P0-3 的剥离逻辑）。
- 约 70 行轮询代码移除，localTool 回归纯代理，关注点分离更干净。

---

## 三、收益与风险

**收益**
- 关注点分离：协议 / 同步逻辑集中在网关（Python，已有 `LovartClient` + 轮询器），localTool 只做转发。
- 补齐 localTool 当前缺失的 `pending_confirmation` / `webhook` / `abort` 完善处理（网关版已具备）。
- 画布未来若想做异步进度条，网关 `task_id` 原生支持，无需 localTool 介入。

**风险 / 注意点**
- 同步 = 长连接：网关需 hold 住 HTTP 几十秒 ~ 几分钟。`FastAPI(async) + httpx(async)` 下 `await` 不阻塞事件循环（chat 同步已验证），但需确认 `LOVART_TIMEOUT=600` 上限下的并发长连接不卡事件循环——不算新风险。
- 同步分支需自有 deadline，超时返 504 而非挂死（复用 `run_and_get` 模式）。
- 改动需本地联调验证：先确保 VPN 已开、能连 `lgw.lovart.ai:443`（见 `daily/2026-07-31.md` 502 排查）。

---

## 四、实施步骤与验证

| # | 步骤 | 落点 | 产出 |
|---|---|---|---|
| 1 | 网关 `_do_submit` 加 `wait` 开关 + 同步循环（复用 `_check_and_fire_task`） | `main.py:719` 附近 | 图片 / 视频支持 `?wait=1` 同步返回 |
| 2 | 网关同步分支输出格式对齐 `{code:200,data:[{url,status:"completed"}]}` | `main.py` 同步分支 | 与 P0-4 当前输出一致 |
| 3 | localTool 注入 `wait` + 退化 P0-4 为透传 | `system.ts:309` | P0-4 轮询代码删除 |

**验证点**
- 文生图 / 带参考图编辑 / 视频，分别走同步（`wait=1`），前端侧边栏「请求数据」仍显示正常（注意：带参考图走 FormData 仍显示 `{}`，见 `daily/2026-07-31.md` 图片请求数据排查，与此改造无关）。
- localTool 日志不再出现 `[async-poll]` 即说明轮询已上移到网关，改造成功。

---

## 附：与既有文档的关系

- 本文是 `05-断点修复方案.md` P0-4「异步转同步」的**上游优化版**：把临时兜底从 localTool 上移到网关原生支持。
- 图片「不丢失」增强（落盘转存）独立于本改造，可参考 `04-调试基建与探针说明.md` 的下载能力 `saveRemoteUrl`（`files.ts:95`）单独排期。
