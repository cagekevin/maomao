# AI03 · 模块3 — AI 生成与网关层

> 四段式：① 运转图景 ② 核心混淆字典 ③ 关键数据流 ④ 存疑 Bug
> 行号 grep 实敲于 2026-07-21，会漂移。锚点见 `映射表补全记录.md` + 模块1/2。

---

## 1. 运转图景

模块3 是**前端 ↔ 网关(:9004) ↔ Lovart ↔ localTool(:18080)** 的 AI 生成全链路：
- 用户在节点(图片/视频/音频)触发生成 → `Jn`(L32490,真正的生图派发 useCallback)提交到网关 `/v1/.../generations`。
- 网关返回 `task_id` → 前端**异步轮询** `GET /v1/tasks/{task_id}`(N 分支)。
- 终态 `completed` → 取 `images[].url[0]` → `ii()`(L1888) 下载持久化到 `uploads/tasks/`(localTool,红线 §3.2 严禁 CDN 直链)。
- 落盘后更新节点 `data.imageUrl` → dispatch `mutiwindow-task-completed` → 触发 rescan(模块2 `Ev`)。

> ⚠️ 旧文档把生图回调误标为 `Jn`(L89,实为 `LogoIcon`)。**真正的派发函数是 `Jn`(L32490) 这个 useCallback**(见映射表补全记录 §1.1)。

---

## 2. 核心混淆字典（已 grep 坐实）

| 混淆名 | 行号 | 可读身份 | 证据 |
|--------|------|---------|------|
| `Jn`(L32490) | L32490 | **生图/视频派发 useCallback**（N 分支走网关轮询） | `let Jn = Y.useCallback(async (e,r,o='1024x1024'...)=>{...}`；内部 L32987 分流 |
| `Jn`(L89) | L89 | `LogoIcon` 品牌图标（**非生图**，旧文档误标） | `function Jn({size})` 返回 SVG |
| `zc` | 多处 | fetch 封装（带 `localPort` 代理） | 轮询调用 `zc(pollUrl,...)`(L33007) |
| `R` | var-mapping/常量 | 网关 base（`DEFAULT_GATEWAY_URL`=9004） | `pollUrl=${R}/v1/tasks/${taskId}`(L33005) |
| `h` | 局部 | 网关 auth token（Bearer） | `headers:{Authorization:'Bearer '+h}`(L33009) |
| `ht` | 局部 | AbortController 注册表（按节点 id） | `ht.current.set(n, ac)`(L33094) |
| `ii` | L1888 | `uploadFile` 落盘入口 | 轮询成功 `ii(u,{subfolder:'tasks',...})`(L33049) |
| `H` | 局部 | localTool 连接状态对象 | `H.status.isConnected` / `H.status.port` |
| `resolveNeedsConfirm` | L32957 | 检测 `pending_confirmation` | `taskInfo.error.code==='pending_confirmation'` |
| `markNeedsConfirm` | L32980 | 节点置 `await_confirm` | 退出轮询（卡死根因） |

> 视频分支另有轮询点：L33504(`k=D.task_id`)/L33848(`N.task_id`)/L34197，结构同 N 分支。

---

## 3. 关键数据流

### 3.1 生图异步轮询主链路（边界契约：HTTP 网关 + localTool 落盘）
```
Jn(L32490, 图片节点回调)
  → POST ${R}/v1/images/generations（R=网关9004）
  → 响应 t.data[0].task_id 检测（L32988，A-C1）
  → 进入异步轮询分支：
      ac = new AbortController(); ht.current.set(n, ac)   // A-C3 重注册
      deadline = now + 9e5 (15min)                        // A-C8 自建 deadline
      while(true):
        pollUrl = `${R}/v1/tasks/${taskId}`               // L33005
        pollResp = await zc(pollUrl, GET, Bearer h)       // A-C2
        taskInfo = pollData.data || pollData
        if status==='completed':                          // A-C4 终态
            u = result.images[0].url[0] || videos[0].url[0]  // A-C5，.url 是数组 [0]
            if u && !data: → await ii(u,{subfolder:'tasks',...})  // A-C6 落盘，红线§3.2
            break
        if status==='failed': throw Error(taskInfo.error.message)  // A-C5 审核拒绝透传
        if pending_confirmation: markNeedsConfirm(...); return  // 退出轮询（卡死风险）
        backoff = 429 ? min(*1.5,15e3) : pollInterval(≥3s)  // A-C7 退避
        await sleep(backoff)
  → 更新节点 data.imageUrl = u
  → dispatch mutiwindow-task-completed（L43640 等）→ Ev() rescan（模块2）
```
> 9 陷阱(A-C1~A-C9)与 `FUNCTION_MAP.md` §2.1 完全吻合，已实码坐实。

### 3.2 同步分支（无 task_id）
- L33076：无 `task_id` 时走原同步解析（`b64_json`/`url`/`image_url.url` 兼容）。
- 同步结果也经 `ii(u,...)`(L33098) 落盘。

### 3.3 事件总线（边界契约：CustomEvent `mutiwindow-task-completed`）
- **dispatch 点**：L38481 / L43640 / L43676 / L43697 / L44406（生成完成/资源就位后发）。
- **监听点**：L31428（`window.addEventListener('mutiwindow-task-completed',...)`）→ 触发 `Ev()` rescan → 资源面板刷新。
- 横线：`mutiwindow-task-completed` 是前端进程内事件总线，**不跨进程**（前端↔网关/localTool 靠 HTTP）。

### 3.4 网关侧对应（apimart-gateway/main.py）
| 端点 | 行号 | 说明 |
|------|------|------|
| `POST /v1/images/generations` | L591 | 图片生成，返回 `{status:'submitted', task_id}` |
| `POST /v1/videos/generations` | L641 | 视频生成 |
| `GET /v1/tasks/{task_id}` | L873 | 轮询状态（前端 N 分支调） |
| `POST /v1/tasks/{task_id}/confirm` | L882 | 手动确认（AUTO_CONFIRM=false 时） |
| `pending_confirmation` 生成 | L177-182 | AUTO_CONFIRM=false 时返回结构化错误带 task_id |

---

## 4. 存疑 Bug（对照 TASKS P0–P2 + 已知限制）

| 优先级 | 问题 | 本模块证据 | 状态 |
|--------|------|-----------|------|
| 已知限制 | 单任务 `pending_confirmation` 卡轮询 | `markNeedsConfirm`(L32980) 置 `await_confirm` 退出轮询；网关 `AUTO_CONFIRM=false`(main.py L177) 时返回该态，无人确认即永久卡 | 待修（需确认按钮或默认 AUTO_CONFIRM=true） |
| 已知限制 | 音频/音乐生成 501 | main.py `/v1/music/generations`/`/v1/audio/generations` 返回 501（见 ARCHITECTURE L3.2） | 非 bug，未实现 |
| 红线§3.2 | CDN 直链违规风险 | A-C6(L33049) 已要求 `ii()` 落盘；若 `ii` 失败 catch 后 `使用原始 URL`(L33051) 仍可能裸存 CDN → 破图/刷新丢 | 低概率，catch 兜底需评估 |
| P2(关联) | 统一 base URL | `R`=网关9004、`H`=localTool 状态；`USE_LOCAL_ENGINE=false` 时文件落盘路由缺失（见模块1 §4） | 待观察 |

> 无新增阻断项。轮询 7 陷阱已在 `FUNCTION_MAP §2.1` 记录，本模块以实码坐实其落地位置（L32987-33100）。

---

## 5. 边界契约（缝合点）

| 接缝 | 名称 | 位置 |
|------|------|------|
| HTTP POST | `/v1/images/generations` / `/v1/videos/generations` | apimart-gateway/main.py L591 / L641 |
| HTTP GET | `/v1/tasks/{task_id}` | apimart-gateway/main.py L873 |
| HTTP POST | `/v1/tasks/{task_id}/confirm` | apimart-gateway/main.py L882 |
| HTTP POST | `/api/files/upload`（落盘） | App.js L1812(`Xr`) / 经 `ii` L1888 |
| CustomEvent | `mutiwindow-task-completed` | dispatch L43640 等 / listen L31428 |
| config | `DEFAULT_ENDPOINT`(9004) / `USE_LOCAL_ENGINE` | config.js 第30/36行 |
| 混淆名 | `Jn`(L32490 生图) vs `Jn`(L89 LogoIcon) | 引必须带行号 |
