# PRD 骨架：一毛画布 V1 生图/生视频回调接入 lovart-chat 异步 Task 轮询

> 本文档用 PRD5步法撰写。网关（apimart-gateway / lovart-chat）不改动，仅画布侧改造。第 1 层为骨架，第 2 层起逐模块细化并追加到本文档。
>
> **基线版本**：2+1（提交侧归一）。提交端点 `generations`/`edits`/`videos` 的差异仅是"带不带图 + 走哪个 URL"，属提交层参数，**不进本 PRD 模块划分**；轮询+取图这套下游逻辑对三者零差异。

## 1. 项目定位（State 1）
- **做什么**：在 V1 画布生成回调里实现对 `lovart-chat`（用户自有 OpenAI 风格第三方网关）异步 task 的轮询取媒资——提交拿到 `task_id` → 轮询 `GET /v1/tasks/{id}` 至终态 → 从 `data.result` 取图/取视频。
- **给谁用**：一毛画布 V1 的使用者（Kevin 及用其画布的人），通过画布界面生图/生视频。
- **核心价值**：屏蔽第三方网关的异步状态机，让画布像调同步 API 一样稳定出图/出视频；同时向后兼容直接返回 `url`/`b64` 的同步 API。
- **媒资无关性**：文生图（`/v1/images/generations`）、图生图（`/v1/images/edits`）、视频（`/v1/videos/generations`）三个端点均返回 `task_id`，共用同一轮询契约；差异只在提交参数与结果字段。

## 2. 模块拆解（State 2，2+1 基线）
| # | 模块 | 职责（对应真实代码） |
|---|------|----------------------|
| 1 | **异步轮询主循环** | 检测 `task_id` → 轮询 `GET /v1/tasks/{id}` → status 判定 → 终态分发。**完全 media-agnostic**，文生图/图生图/视频共用一套，不关心提交走哪个 endpoint。 |
| 2 | **结果提取与归一** | 成功终态后从 `data.result` 防御提取：`images[].url` / `videos[].url`；兼容 string/array、多路径、审核无结果抛错。唯一区分媒资类型的地方，只是"取字段"。 |
| 3 | **现有生命周期复用（横切约定）** | 轮询接入既有 `ht.current`（重注册）、`catch`（33032 兜底）、`z(...)`（进度回写）、自建 15min deadline。**非新建，是"接入约定"**。 |

**依赖方向**：主循环(1) 终态时调用 提取(2)；复用约定(3) 是横切约定，供 (1) 接入（取消/超时/错误/进度）。
**互不重叠**：主循环负责"轮询+判定"、提取负责"取字段"、复用约定负责"接既有生命周期"，边界清晰，且 (3) 明确是复用既有而非新模块，契合 X1/X2/X3。✅

**范围说明**：提交端点选择（generations / edits / videos）是 N 分支**构造请求时**的参数差异（带不带 `image`、URL 不同），属"提交层"，不在本 PRD 的轮询模块内。但模块 2 必须**现在就覆盖 `videos`**，不能等视频接通才补。

## 3. 翻车点（State 3，Top 3）
1. **终态误判 / 轮询空窗**：网关 `status` 变终态瞬间 `result` 可能尚未就绪（或被 `abort`）。若把 `submitted` 当终态、或轮询间隔过短触发限流，会拿到空 result / 卡死。
2. **取消信号丢失**：初始 fetch 后 `ht.current.delete(n)` 立即执行（~32821），轮询循环内不能依赖 `ht.current.has(n)` 判断取消——必须重新注册全新 `AbortController` 到 `ht.current`，否则全局取消命中不了轮询请求。
3. **结果字段形状不确定（图/视频双形状 + `.url` 是数组 + envelope 是 `data.result`）**：网关 `lovart_to_apimart` 返回的 `result.images[].url` 与 `result.videos[].url` **都是数组 `[url]`**（不是 string！），真实 URL 在 `[0]`；且整个 `result` 嵌在轮询响应 `data` 下（`{code:200, data:{status,progress,result,error?}}`，main.py 117/353），提取路径是 `data.result.images[0].url[0]` 而非顶层 `result.images`。若按旧同步逻辑 `e.url` 直接当 string 用、或漏掉 `data.` 前缀，会拿到数组/undefined 导致 `Image.src`/下载失败。图片在 `data.result.images`、视频在 `data.result.videos`，两者可独立出现；审核拒绝时终态但 `data.result` 为空（网关给 `data.error.code:"no_artifact"`）。提取不防御会取不到 / 误判失败。

## 4. 约束清单（State 4，第 1 层）
### 模块 1 · 异步轮询主循环
- C1：仅当响应含 `task_id`（`data[0].task_id` / `task_id` / `id`）才进轮询分支；否则走原同步解析。→ 支撑 X（不破坏同步 API 兼容）
- C2：轮询间隔 `(ie || 3) * 1e3` ms（`ie` = 全局 `globalPollingInterval`，默认 3，App.js 31244）；连续 429 或空响应时退避 ×1.5、上限 15s。→ 封堵陷阱 1（限流/空窗）
- C3：终态判定严格按网关契约（main.py 758 `_check_and_fire_task` 状态映射）——成功 `completed`、失败 `failed`、进行中 `pending`/`processing`（Lovart 的 `submitted`/`queued`/`pending_confirmation`/`running` 均被网关归一为 `pending`/`processing`）。失败终态判定：① 任务级 `data.error`（如 `no_artifact`、`pending_confirmation`）或 ② HTTP 级顶层 `error`（如 401/400，main.py 120 `err()`）；两者皆作失败，绝不与成功混淆。（注：既有视频节点用 `success`/`succeeded`，那是另一套 API 词汇，网关不返回，本 PRD 不兼容。）→ 封堵陷阱 1

### 模块 2 · 结果提取与归一
- C5：终态提取严格按网关 `lovart_to_apimart` 形状——注意轮询响应 envelope 是 `{code:200, data:{status,progress,result,error?}}`（main.py 117 `ok()` + 353 `_task_view`），`result` 在 `data` 下，**不是顶层**！图片取 `data.result.images?.[0]?.url?.[0]`（**`.url` 是数组，必须取 `[0]`**），视频取 `data.result.videos?.[0]?.url?.[0]`；URL 缺失/空数组时抛明确错误（审核拒绝：`data.error.code==='no_artifact'` 时 message 提示"内容审核拒绝或未产出"）。历史同步 shape（`data[].url`/`b64_json`）仅作兜底，不依赖。→ 封堵陷阱 3

### 模块 3 · 现有生命周期复用（横切约定）
- C4：若响应含 `progress`，复用现有 `z(...)` 更新任务面板——`z(e => e.map(e => e.id === r || e.taskId === r ? {...e, status:'running', progress: data.progress || progress} : e))`（参考对方 A-C8），不新增 UI 组件/状态。→ 支撑 X
- C6：轮询期用新 `AbortController` 注册到 `ht.current`，`finally` 中 `ht.current.delete(n)` 清理，支持全局取消。→ 封堵陷阱 2
- C7：总超时 15min（9e5 ms），超时抛明确错误，不卡死。→ 封堵陷阱 1

### 跨模块约束
- **X1**：复用现有 `zc(...)`（GET + localPort 代理）、`R`/`h`/`n`/`z`/`ht.current`，禁止为轮询新建独立 fetch 层或全局状态。
- **X2**：所有错误统一 `throw Error(...)` 走现有 `catch`（标记失败、显示 message、附 `rawResp`），不新增错误格式。
- **X3**：仅改 `Jn` 的 N 分支（~32891），不动 B 分支（SSE）及其他分支，避免回归。

---

## 5. 第 2 层细化进度
- [x] 模块 1 · 异步轮询主循环（原「模块 2 · Task 轮询引擎」细化内容重挂于此）
- [x] 模块 2 · 结果提取与归一（含 images/videos 双形状 + `.url` 数组修正）
- [ ] 模块 3 · 现有生命周期复用（横切约定）
- [x] 附录 §8 · 视频接入说明：仅提交侧 JSON 参数需对齐（D-P1~P6 已代码核实，轮询/提取已 media-agnostic 覆盖）

---

## 6. 第 2 层：模块 1 · 异步轮询主循环（已细化）

> 本节内容原为旧「模块 2 · Task 轮询引擎」的第 2 层细化，重基线后对应新**模块 1**，原样重挂。全部基于真实 `App.js` 代码实证（32821 / 32780 / 31457 / 18941 / 32813 / 32881 / 33032）。

### 6.1 边界对齐
- **职责**：定时 `GET /v1/tasks/{id}` 轮询，解析 `status`，处理终态/未终态、限流退避。media-agnostic，图/视频共用。
- **冲突校验**：与全局定位一致（屏蔽异步状态机，稳定出图/出视频）；不违反 **X1**（复用 `zc`）、**X2**（错误走现有 `catch`）、**X3**（仅 N 分支）。✅ 本模块只负责"轮询 + 状态判定"，不负责结果提取（模块 2）、进度回写/取消注册（模块 3 横切）——边界清晰。

### 6.2 子模块
| # | 子模块 | 一句话职责 |
|---|--------|-----------|
| 1.1 | 轮询调度器 | 控制间隔（≥3s）、退避策略、循环退出条件（终态/超时）。 |
| 1.2 | 单次请求执行 | 用 `zc(...)` 发 `GET /v1/tasks/{id}`，处理网络异常（重试/跳过不阻断）。 |
| 1.3 | 响应解析与状态判定 | 解析 `status`，区分 未终态 / 成功终态 / 失败终态。 |
| 1.4 | 终态分发 | 成功→交模块 2 提取；失败→抛错；未终态→继续循环。 |

**依赖方向**：调度(1.1) → 请求(1.2) → 判定(1.3) → 分发(1.4)。**互不重叠**：调度/请求/判定/分发 职责清晰。✅

### 6.3 翻车点（代码实证，基于 `App.js`）
1. **取消信号在初始 fetch 后即失效**：初始 `POST` 时 `ht.current.set(n, i)`（32780），但 `await zc(...)` 一返回就 `ht.current.delete(n)`（32821）。轮询循环若复用原 `n` 判断取消会失效——必须重新 `new AbortController()` 并 `ht.current.set(n, ...)`，否则全局取消（31457 `ht.current.forEach(e=>e.abort())`）命中不了轮询请求。
2. **`zc` 走 localPort 代理时 GET 的 method 透传**：`zc`（18941）在 `localPort` 分支把 `method: t.method || 'GET'` 透传给 `/api/proxy`（18948/18968）。轮询若漏传 `method:'GET'` 或误带 body，代理行为不可控。需与初始 `POST` 的 `zc` 调用（32813）同形、仅改 method 与去 body。
3. **`oe` 后台超时 ≠ 轮询超时（且轮询前已失效）**：现有 `oe` 超时（默认 600s，32781）回调只翻 UI 旗标"转入后台运行"、**从不 abort**，且其 `setTimeout` 在初始 `POST` 的 `zc` `.finally` 里已被 `clearTimeout(o)` 清除（32818）——轮询循环尚未开始 `o` 就已失效。若轮询复用 `oe` 作阈值则与其 600s 强耦合且偏短。必须轮询内自建 deadline（15min）解耦。

### 6.4 约束清单（含验证标准 + 显式支撑跨模块约束）
- **C2（间隔与退避）**：轮询间隔 `≥3s`（`setTimeout(res,3e3)`），连续 429/空响应时轻微退避（×1.5，上限 15s）。*验证*：日志 `[生图调试] 轮询响应` 相邻间隔 ≥3s。→ 封堵陷阱 1（限流）；间接支撑 **X1**（复用 `zc`，不新建 fetch 层）。
- **C3（终态判定）**：严格按网关契约——成功 `completed`、失败 `failed`、进行中 `pending`/`processing`；响应含顶层 `error` 字段立即 `throw Error(...)` 交现有 `catch`（33032–33071，已带 `rawResp`）。（`success`/`succeeded`/`done` 是既有视频节点那套 API 的词汇，网关不返回，不兼容。）*验证*：抓一次真实轮询响应确认 `status` 取值。→ 封堵陷阱 1（误判）；支撑 **X2**（错误统一走现有 catch）。
- **C8（轮询请求同形）**：必须用 `zc(url,{method:'GET',headers:{Authorization:`Bearer ${h}`},localPort:H.status.isConnected?H.status.port:undefined})`，**不带 body**，与初始 `POST` 的 `zc` 调用（32813）同形。*验证*：localPort 连接时轮询走 `/api/proxy` 且 method=GET。→ 支撑 **X1**（复用 `zc` + localPort 代理一致）。
- **C9（AbortController 重注册）**：轮询内 `new AbortController()` 并 `ht.current.set(n, ac)`（`n` 沿用 `\`${e}_${t}\``），`finally` 中 `ht.current.delete(n)`（同 32780/32821 形态）。*验证*：轮询中点取消，`catch` 命中 `AbortError` 且面板标"已取消"。→ 封堵陷阱 2；支撑 **X1**（沿用 `ht.current` 注册表）。
- **C10（自建 deadline）**：轮询内 `deadline=Date.now()+9e5`（15min，比 `oe` 默认 600s 更宽松、适配异步生成），每轮 `if(Date.now()>deadline) throw Error('轮询超时（15分钟）')`；**不耦合** `oe` 配置（`oe` 的"转入后台" UI 超时在初始 POST 的 `.finally` 已被 `clearTimeout(o)` 清除，32818，轮询开始前即失效，且仅翻 UI 旗标、从不 abort）。*验证*：构造长任务，15min 后抛错不卡死。→ 封堵陷阱 3；支撑 **X2**（超时 throw 走 catch）。

---

## 7. 第 2 层：模块 2 · 结果提取与归一（已细化）

> 本节基于网关 `apimart-gateway/main.py` 真实 `result` 形状（`lovart_to_apimart` 142–166 行）与 N 分支旧同步提取（App.js 32891–32897）对照撰写。**核心修正**：网关异步 `result` 的 `.url` 是**数组**，与旧同步逻辑假定 string 冲突，必须按网关 shape 重写。

### 7.1 边界对齐
- **职责**：主循环(1) 判定成功终态后，从 `data.result` 防御提取媒资 URL（注意 envelope：`{code,data:{status,progress,result,error?}}`，`result` 在 `data` 下），输出**单个 `u`（string）**交给既有 `ii(u,...)`（32911）持久化。media-agnostic 只体现在"取哪个 key"。
- **冲突校验**：与 §2 定位一致（屏蔽异步状态机、兼容同步）；不违反 **X1**（输出 `u` 后复用既有 `ii` 持久化流，不新建下载层）、**X2**（无结果 `throw` 走现有 `catch` 33032）、**X3**（仅 N 分支）。✅ 本模块只负责"取字段 + 归一成 `u`"，不负责轮询（模块 1）、进度/取消（模块 3）。

### 7.2 子模块
| # | 子模块 | 一句话职责 |
|----|--------|-----------|
| 2.1 | 形状探测 | 判定 `data.result` 是网关异步 shape（`images`/`videos` 数组）还是历史同步 shape（`data[].url`/`b64_json`），走对应分支。 |
| 2.2 | 图片提取 | 从 `data.result.images[0].url[0]` 取首个图片 URL；空则查 `data[].url`/`b64_json` 兜底。 |
| 2.3 | 视频提取 | 从 `data.result.videos[0].url[0]` 取首个视频 URL。 |
| 2.4 | 归一与抛错 | 输出单个 `u`（string）；终态 `data.result` 无媒资（`no_artifact`）或空数组 → `throw Error(...)` 走现有 catch；提示 `expires_at` 临近。 |

**依赖方向**：探测(2.1) → 图片(2.2)/视频(2.3) → 归一(2.4)。**互不重叠**：探测决定走哪条提取分支，图片/视频各自取 key，归一统一输出 `u`。✅

### 7.3 翻车点（代码实证，基于 `main.py`）
1. **`.url` 是数组不是 string**（main.py 154/156）：`images.append({"url": [url], ...})`、`videos.append({"url": [url], ...})` —— 外层 `url` 被包成 `[url]`。旧同步逻辑 `e.url`（App.js 32894）直接当 string 会得到数组，后续 `Image.src`/下载全挂。**必须 `.url[0]`**。
2. **URL 过期**（main.py 37/144/154）：`expires_at = now + TASK_RESULT_TTL`（默认 `86400` = 24h）。异步任务用户可能几小时后才回来，裸 CDN url 已 404。模块 2 只产出 `u`，立即交给既有 `ii(u,...)`（32911）下载并持久化到本地/Obsidian，**不在内存/任务状态长期持有裸 CDN url**。
3. **审核无结果 ≠ 普通失败**（main.py 835–840）：终态 `status:"failed"` + `data.error.code:"no_artifact"` + `data.error.message` = `assistant_text(result)` 或 `"生成完成但未产出任何素材（可能被内容审核拒绝或模型未调用生成工具）"`。必须透传该 message，不能笼统报"生成失败"。
4. **图/视频可独立出现**（main.py 159–165）：`out` 只含实际存在的 key（`images`/`videos`/`music`）。视频任务 `data.result` 无 `images`；图任务无 `videos`。提取需分别判空，不能假设两者都在。

### 7.4 约束清单（含验证标准 + 显式支撑跨模块约束）
- **C5（字段路径，见 §4，已据网关 shape 重写）**：图片 `data.result.images?.[0]?.url?.[0]`、视频 `data.result.videos?.[0]?.url?.[0]`，`.url` 必取 `[0]`。*验证*：抓一次真实 `GET /v1/tasks/{id}` 完成的 `data.result`，确认 `images[0].url` 为数组、`[0]` 取到真实 URL。
- **C11（双形状兜底）**：优先网关 shape（`data.result.images/videos[0].url[0]`）；若命中历史同步 shape（`data[].url` / `data[].b64_json` / `image_url.url`，见 App.js 32892–32897）则按原逻辑兜底，保证同步 API 兼容。*验证*：分别用网关异步结果与直连 OpenAI 同步结果各跑一次，均取出 `u`。→ 支撑 **X1**（兼容既有同步路径）。
- **C12（不过期持有）**：模块 2 仅产出 `u` 字符串交给既有 `ii(u,...)`（32911）持久化，不把 CDN url 写入任务状态长期保存。*验证*：异步任务完成后任务状态里是 `ii` 返回的本地/Obsidian url，而非 `*.lovartcdn*` 裸链。→ 封堵陷阱 2（过期）；支撑 **X1**。
- **C13（无结果明确抛错）**：`data.result` 既无 `images` 也无 `videos`（或对应数组空）→ `throw Error(data.error?.message || '生成完成但未产出媒资')`，走现有 catch（33032）显示 message；若 `data.error.code==='no_artifact'` 优先用其 message（含审核拒绝提示）。*验证*：构造审核拒绝任务，catch 显示"内容审核拒绝/未产出"而非笼统"生成失败"。→ 封堵陷阱 3；支撑 **X2**。

---

## 8. 附录：视频接入说明（提交侧 JSON 参数对齐记录，已代码核实）

> **视频在本 PRD 范围内，不是"不做"。** 澄清：视频与图片的差异**只在提交侧 JSON 参数**（endpoint + body 字段映射），下游的轮询（模块 1）与结果提取（模块 2，已覆盖 `data.result.videos`）对视频**完全 media-agnostic、零差异**。因此视频的轮询/提取/生命周期复用与图片一并解决、先做；唯一待对齐的是"提交时把视频节点的参数翻译成网关期望的 JSON"。
>
> 来源：对比文档 `docs/PRD_TASK_POLLING.md` 的模块 D。下列为代码核实所得的真实参数差异，作为提交侧适配清单，不是"范围外"。

代码核实（App.js）：
- **D-P1 端点单复数**：sd2Video 提交 `POST /v1/video/generations`（单数，33247）；网关为 `/v1/videos/generations`（复数）。→ **提交侧需对齐端点**。
- **D-P2 body 结构**：sd2Video body `{model,prompt,metadata:{reference_images,reference_videos,generate_audio,ratio,duration,watermark}}`（33270–33282，字段嵌套在 `metadata`）；网关要求顶层 `{model,prompt,size,aspect_ratio,duration,reference_images,videos}`。→ **提交侧需把 `metadata.*` 提平到顶层**。
- **D-P3 body 字段名**：video 节点 body `{model,prompt,size,aspect_ratio,seconds,input_reference,input_video}`（33883–33890）；网关用 `duration`/`reference_images`/`videos`。→ **提交侧需做字段名映射**（`seconds`→`duration`、`input_reference`→`reference_images`、`input_video`→`videos`）。
- **D-P4 轮询端点（已统一，无需改造）**：网关对图文视频统一 `GET /v1/tasks/{id}`，模块 1 已覆盖，视频轮询零差异。
- **D-P5 结果格式（已统一，无需改造）**：网关返回 `data.result.videos[0].url[0]`（envelope `{code,data:{...,result}}`），模块 2 已覆盖 `videos` 提取，零差异。
- **D-P6 状态词表（已统一，无需改造）**：既有视频节点用自己的 `success`/`succeeded`（33337/33639），但走网关后状态由 `_check_and_fire_task` 归一为 `completed`/`failed`（见 §4 C3），模块 1 已按网关契约判定，不复用旧词表。

**结论**：视频**纳入本次 `Jn` N 分支 PRD**。轮询/提取/生命周期（模块 1/2/3）图文视频共用一套，先行解决；唯一独立任务是**提交侧 JSON 参数对齐**（D-P1 端点 + D-P2/P3 body 字段映射），作为"提交层适配"子任务与轮询改造同期完成，不另起 PRD。
