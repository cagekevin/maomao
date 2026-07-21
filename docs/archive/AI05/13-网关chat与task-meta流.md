# 深六度：网关 chat/SSE 链路 + mutiwindow-update-task-meta 完整数据流（AI05）

> 对象：`apimart-gateway/main.py` chat 路由(L434-574) + App.js `mutiwindow-update-task-meta` 发送/监听两端(L41032/L43734-43764) + `J_` 写库函数(L41611)。
> 红线：只读，不修改。

---

## 1. 网关 `/v1/chat/completions` SSE 链路（main.py L434-574）

### 1.1 入口与鉴权
- L434 `chat_completions` → `resolve_client(request)`(L436) 鉴权；失败返回 401 信封。
- L440 解析 JSON；L444-469 把 messages 拍平为 `prompt`：user 消息直接拼，其他 role 包 `[{role}] {content}`；多模态 `image_url` 提为 `vision_urls`(L458-461)。
- L470 校验：无 user 消息或无 prompt → 400 `no user message found`。
- L473-474：`model` → `resolve_prefer_models(_model,"IMAGE"/"VIDEO")` 决定生成偏好；文本模型不强制 prefer。

### 1.2 同步轮询核（run_and_get L477-541）
- L478 `_resolve_attachments` 把 vision_urls 转 Lovart 附件。
- L483 `_send_with_project` 派发到 Lovart thread，`mode=CHAT_THREAD_MODE`(默认 thinking)。
- L488 `CHAT_SYNC_TIMEOUT`(默认 300s) 为硬 deadline。
- **轮询状态机**（L491-539）：
  - `done` → 等 5s 二次确认(L497-498)；若翻转成 `abort` 抛 400(L502)；否则 `get_result`(L506)。
  - `pending_confirmation`：AUTO_CONFIRM(默认 true) 自动 `confirm`(L509/L524)，否则抛 `_pending_confirmation_error`(L512/L526)。
  - `abort` → 抛 400(L521)，**不再吞结果**。
  - 轮询 `running` 超过 7 次且每 3 次尝试取结果(L528-537)，同样处理 pending_confirmation。
  - 每轮 `await asyncio.sleep(3)`(L539)。
  - 超时抛 504 `同步等待生成结果超时`(L541)——**明确错误而非静默空返回**（代码注释标「核心修复」）。

### 1.3 SSE 输出（L543-574）
- stream=true(L475 默认)：`gen()` 用 `asyncio.create_task(run_and_get())`，每 2s 发 `: heartbeat\n\n`(L549)。
- 完成后单 chunk：`chat.completion.chunk` 格式(L561-567)，`delta.content`=`_chat_content(result)`(L560)，`finish_reason:"stop"`。
- 终帧 `data: [DONE]\n\n`(L569)。
- 异常：LovartError → `data:{error:{message}}` + DONE(L553-554)；其他 Exception 同构(L557-558)。
- `media_type="text/event-stream"`(L574)。
- 非 stream 路径(L576-579)：`run_and_get()` 直接拿结果，`_chat_content` 包成完整 chat completion（非 chunk）。

> **关键事实**：chat 路由**同步阻塞轮询 Lovart** 直到 done/abort/超时，再整体以 SSE 吐出——前端拿到的是「一次 heartbeat 流 + 单条 content chunk + DONE」。这与 04 节 `Jn`(L32490) 在前端**异步轮询 `GET /v1/tasks/{id}`**(L33005) 是**两套独立机制**：
> - chat 路由：网关内同步轮询 + SSE 包装（OpenAI 风格）。
> - 生图节点 `Jn`：前端直接轮询 `GET /v1/tasks/{id}`，落盘 18080。
> 二者都最终落到 `GET /v1/tasks/{id}`(L873 `_check_and_fire_task`) 取结果，但入口与轮询主体不同。

### 1.4 任务查询 `GET /v1/tasks/{id}`（L873-879）
- 走 `_check_and_fire_task` → 含 webhook 触发(L864/L869 `_fire_webhook`)。
- `confirm_task`(L882) 提供外部确认渠道（消灭 AUTO_CONFIRM=false 卡死），校验 `task_` 前缀(L888)。

---

## 2. `mutiwindow-update-task-meta` 完整数据流（App.js）

### 2.1 发送端（媒体卡片组件，L41026-41039）
- 组件内 `v = Y.useCallback`(L41026)：更新 `mediaMeta` 后 `window.dispatchEvent(new CustomEvent('mutiwindow-update-task-meta', {detail:{taskId:e.id, meta:r}}))`(L41032-41037)。
- 触发场景：媒体卡片拿到 width/duration 等元数据时（video/audio 时长、图宽高）回写。

### 2.2 监听端（全局任务 store effect，L43734-43764）
```43734:43764:src/_engine/App.js
let e = e => {
  let { taskId: t, meta: n } = e.detail;
  !t || !n || a(e => {
    let r = e.findIndex(e => e.id === t);
    if (r === -1) return e;
    let i = e[r], a = i.mediaMeta || {}, o = false;
    for (let e in n) if (n[e] !== a[e]) { o = true; break; }
    if (!o) return e;                       // 无变化则跳过
    let s = [...e];
    s[r] = { ...i, mediaMeta: { ...a, ...n } };
    let c = s[r];
    return setTimeout(() => {
      J_(c).catch(e => console.error(`Failed to save task meta:`, e));
    }, 1e3), s;                             // 1s 后落库
  });
};
return window.addEventListener(`mutiwindow-update-task-meta`, e), ...
```

### 2.3 `J_` 写库真身（L41611-41615）
```41611:41615:src/_engine/App.js
async function J_(e) {
  try {
    return (await fetch(`${U_}/api/tasks/save`, {
      method: `POST`,
      headers: { ... },
      body: JSON.stringify(e)
    }))
  ...
```
- `U_` = localTool base URL（host 硬编码 18080 兜底，呼应 P0）。
- 写入端点 `POST /api/tasks/save`（localTool，未在本次审计的 resources.ts/files.ts 内，属 tasks 路由，未读源码——标记为待实证项）。

### 2.4 数据流闭合
```
媒体卡片 v()  [L41032 发 CustomEvent]
   │  detail={taskId, meta}
   ▼
全局 store effect  [L43734 监听]
   │  找到任务 → 合并 mediaMeta → 去重(o flag)
   ▼
setTimeout 1s  [L43759]
   │
   ▼
J_(task)  [L41611 → POST /api/tasks/save @18080]
```
- **纯前端 window CustomEvent**（非 chrome.runtime），同窗口内跨组件同步；与 08 节 `resourceAdded`(chrome.runtime 跨进程) 机制不同。
- **1s 防抖 + 变更检测**：`o` flag 跳过无变化，避免冗余写库。
- 这是 08 节 X2 事件总线表**漏列**的事件（已在 07 §2.2 建议补入）。

---

## 3. 新发现与待实证项

### 3.1 待实证（未读源码，不臆断）
- `POST /api/tasks/save` 的 localTool handler（tasks 路由文件）未读，仅确认前端 `J_` 调它。需在 localTool 侧补一轮实证。
- `Y_`(批量 save, L41696) / `Z_`(批量删, L41696) 两个 task store 兄弟函数未展开。

### 3.2 与既有审计的衔接
- chat 网关同步轮询 vs 生图前端异步轮询：两套机制，共同汇于 `GET /v1/tasks/{id}`。
- `mutiwindow-update-task-meta` 写入 localTool → 与 03/11 节资源入库(Ev/Sv) 并列的另一条落库路径（task 元数据，非资源文件）。
- 全部引用带 `文件:L行号`，grep 复核通过。

---

## 4. 校验（门3）

| 引用 | 文件:行 | 命中 |
|------|---------|------|
| chat SSE 路由 | main.py L434 / L574 | ✅ |
| 轮询 abort 抛 400 | main.py L502/L521 | ✅ |
| 超时 504 | main.py L541 | ✅ |
| heartbeat | main.py L549 | ✅ |
| mutiwindow 发送端 | App.js L41032 | ✅ |
| mutiwindow 监听端 | App.js L43734-43764 | ✅ |
| J_ 写库 | App.js L41611 / L43760 | ✅ POST /api/tasks/save |
| GET /v1/tasks/{id} | main.py L873 | ✅ |
