# 模块3 · AI 生成与网关层（V1 审计）

> 审计日期：2026-07-21。所有行号 grep 实敲于 `src/_engine/App.js` 与 `apimart-gateway/main.py`。
> 结构：① 运转图景 ② 核心混淆字典 ③ 关键数据流（带 file:line）④ 存疑 Bug（对照 TASKS P0–P2）。

---

## ① 运转图景

AI 生成链路：前端节点发起生成请求 → 网关 `:9004`（OpenAI 风格 → Lovart 翻译）→ 异步 task_id → 前端轮询 `GET /v1/tasks/{id}` → 拿到结果 URL → `ii()` 下载落盘到 localTool `:18080` → 事件总线通知资源面板刷新。

边界契约：
- **HTTP**：`POST /v1/images/generations`(网关 L592) / `/v1/videos/generations`(L642) / `GET /v1/tasks/{id}`(L874) / `POST /v1/tasks/{id}/confirm`(L883)。
- **事件总线**：生成完成 → `dispatchEvent('mutiwindow-task-completed')` → `Ev()` rescan。
- **config**：`R` = 网关注式 base（`${R}/v1/...`，`R` 在生图块内 `R = m.replace(/\/$/,'')` 即 DEFAULT_ENDPOINT 9004）。

> ⚠️ 旧文档称「`Jn` 是生图主回调(L32731)」——已证伪（`Jn` 是 LogoIcon @ L89）。生图派发逻辑在 **L32779 起的异步块**（含 `N`/`B`/`k`/`v`/`E` 局部变量，外层是某节点 handleGenerate，反编译未暴露稳定函数名）。审计中以 `App.js:L32779 生图派发块` 描述。

---

## ② 核心混淆字典（本模块）

| 前端符号 | 行号(App.js) | 语义 |
|----------|--------------|------|
| `ii` | L1888 | uploadFile 统一入口（落盘 uploads/，data:/http 均处理） |
| `Xr` | L1802 | blob 上传 localTool |
| `Ev` | L42883 | rescan 真函数（生成完成触发） |
| `R`(生图块内) | L32709 | 网关注式 base = `m.replace(/\/$/,'')`（m=选中 endpoint URL） |
| `B`(生图块内) | L32710 | `N && k.includes('*')` 通配标志 |
| `ht` | L33094 附近 | 节点 AbortController Map（轮询取消） |
| `zc` | L19001（定义）/ L32963（调用） | fetch 封装（带 localPort 代理） |

> 网关侧（`apimart-gateway/main.py`）：
| 路由/函数 | 行号 | 语义 |
|-----------|------|------|
| `images_generations` | L592 | 图片生成提交 |
| `videos_generations` | L642 | 视频生成提交 |
| `get_task` | L874 | 任务状态轮询 |
| `confirm_task` | L883 | 手动确认（消 AUTO_CONFIRM=false 卡死） |
| `_background_webhook_watcher` | L672 | 后台轮询触发 webhook（防纯异步方不主动 GET） |
| `_check_and_fire_task` | L783 | 核心轮询逻辑 |

---

## ③ 关键数据流（带 file:line）

### 3.1 生图提交 + 异步轮询 + 落盘
```
节点 handleGenerate（L32779 起生图派发块）
  → I = `${R}/v1/images/generations`   L32796   (R=网关 base, L32709)
  → fetch POST，拿到 t.data[0].task_id  L32988
  → 进入异步轮询分支：
      while(true):
        pollUrl = `${R}/v1/tasks/${taskId}`   L33005
        GET，headers Bearer h
        deadline = now+15min   L32997
        pollInterval = (ie||3)*1000   L32998
        429 → backoff=min(backoff*1.5, 15s)   L33067
        status==='completed':
          imgUrl = result.images[0].url[0]   L33031
          A-C6: ii(u, {subfolder:'tasks', preferThumbnail:true})   L33049  ← 落盘 18080
        status==='failed' → throw
        pending_confirmation → markNeedsConfirm + return   L33058-33063
  → 更新节点 data.imageUrl/videoUrl
  → dispatchEvent('mutiwindow-task-completed')   （见 L38481/L43640 等监听点）
  → Ev()(L42883) rescan → 资源面板刷新
```
→ 与 ARCHITECTURE X1.1 端到端流一致 ✅；轮询 7 陷阱（A-C1~A-C9 注释）已在代码内标注。

### 3.2 落盘合规修正（对照红线 §3.2）
- **A-C6(L33047)**：`if (u && !u.startsWith('data:'))` 对非 data URL **强制过 `ii()` 下载落盘**，直接遵守「严禁直接使用 CDN URL」红线 → **代码已合规**（旧文档仅陈述规则，未确认代码已落实）。
- data: URL 也走 `ii`(L33098) → base64 转 blob 上传。

### 3.3 网关 confirm 机制（新发现）
```
网关 confirm_task   main.py L883
  → 外部确认 pending_confirmation 任务
背景 _background_webhook_watcher   L672
  → 每 5s 后台轮询最多 15min，触发 webhook，防止 AUTO_CONFIRM=false 时纯异步方永久卡死
```
→ **修正 TASKS「其他已知限制」**：原称「单任务 pending_confirmation 卡轮询(AUTO_CONFIRM=false 时)」为无害限制；现网关已加 confirm 路由 + 后台 watcher 兜底，属**已缓解**（旧文档未记录该修复）。

---

## ④ 存疑 Bug（对照 TASKS P0–P2）

| # | 问题 | 证据 | 结论 |
|---|------|------|------|
| P(网) | 网关 404 噪音 | `main.py` 未实现 API 返回 404（如 `/v1/music` 501、其它 404） | 无害噪音，CLAUDE.md 红线 §3.3 已声明，不修 ✅ |
| P(轮询) | pending_confirmation 卡死 | 前端 L33058 退出轮询置 await_confirm；网关 L883 confirm + L672 watcher 兜底 | 已缓解（旧 TASKS 标注为限制，现网关已修复，文档待更新） |
| R(A-C6) | CDN 直链违规 | 前端 L33047 已强制 ii() 落盘 | **已合规**，旧文档红线仅规则未确认落实 |

### 跨层一致性（ARCHITECTURE X3）
- **X3.4**：rescan 侧已补全绝对路径；生图落盘经 `ii`→`Xr`→localTool，URL 由后端 `toAbsoluteFileUrl` 补全 ✅。

---

## ⑤ 对旧文档的修正点
1. `ARCHITECTURE.md` L1.3 / `FUNCTION_MAP.md` §2：`Jn` 生图主回调 → 改为「`Jn`(L89) 是 LogoIcon；生图派发见 L32779 块」。
2. `TASKS.md`「其他已知限制」：`pending_confirmation` 卡轮询 → 注明网关已加 `confirm_task`(L883)+watcher(L672) 兜底，已缓解。
3. `ARCHITECTURE.md` X1.1：「CDN? ii() 下载」表述已确认代码落地（L33047 A-C6），可标 ✅ 已合规。
