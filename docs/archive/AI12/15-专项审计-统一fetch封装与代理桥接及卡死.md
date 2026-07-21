# AI12 · 专项审计 — 统一 fetch 封装(zc)·代理桥接·pending_confirmation 卡死

> 方法学：阶段 2.5 横向切片 + 门4 对抗质询；门3 校验；只写 AI12，不读他人 AIxx。
> 动机：T2.3 提及 `zc`@L19001 但未坐实其代理机制；T2.5.3 提 18080 硬编码但未走通 fetch 代理；TASKS 把 `pending_confirmation` 卡轮询列为「已知限制（无害）」，本专项确认其根因。
> 配套：修正补丁见 `12` 文档 C14（新增）。

---

## 一、统一 fetch 封装 `zc`（L19001）真身

`async function zc(e, t)` —— 全应用**唯一的 HTTP 出口**（Jn 轮询 L33007、各类资源请求均经此）。`t` 含 `{method, headers, body, localPort, cookie}`。

### 代理决策树（按 `t.localPort` 与 body 类型）
```
zc(url, opts):
  if (opts.localPort) {
    // 本地文件路径（非 http/data/blob）→ 经 localTool 读文件
    if (!url.startsWith('http'|'data:'|'blob:')) {
      return fetch(`http://127.0.0.1:${localPort}/api/files/read?path=${url}`)
    }
    // FormData / Blob → 走 X-Proxy-* 头透传
    if (body instanceof FormData || Blob) {
      headers.set('X-Proxy-Url', url)
      headers.set('X-Proxy-Method', method)
      return fetch(`http://127.0.0.1:${localPort}/api/proxy`, {headers, body})
    }
    // 普通 JSON → POST /api/proxy {url, method, headers, body, cookie}
    return fetch(`http://127.0.0.1:${localPort}/api/proxy`, {body: JSON.stringify({...})})
    // 代理失败 → catch → fall through 到直连（L19039-19042）
  }
  // 无 localPort → 直接 fetch(url, opts)
  return fetch(url, opts)
```

### 关键结论
1. **localTool 是三重角色**：① 18080 文件 API（`/api/files/upload`/`/api/files/read`/`/api/resources/*`）；② 9004 网关请求的**代理跳板**（`/api/proxy`，穿透本地网络隔离）；③ 本地文件读取器（`/api/files/read`）。
2. **网关轮询也走代理**：Jn 轮询 L33007 `localPort: H.status.isConnected ? H.status.port : undefined` —— localTool 连着时，9004 网关请求经 localTool `/api/proxy` 转发；断开时 `zc` 直连 9004。`zc` 是三层隔离的统一桥接点。
3. **代理降级安全**：`/api/proxy` 失败时 `catch` 后 fall through 直连（L19039），不抛死——但仅当 url 本身可达（如 9004 在本机）才有效；跨网络隔离场景代理失败即真失败。

---

## 二、`H`(useLocalTool) 连接状态结构（L19052 `Uc`）

- `H` = import `On as H`（L3），`On` = `useLocalTool` hook，实现 `Uc` @**L19052**。
- `status = { isConnected, port, version, message }`：
  - 初始 `{isConnected:false, port: Bc}`（`Bc = LOCAL_ENGINE.port` = 18080，L19049）。
  - 探活：`fetch(http://127.0.0.1:{Bc}/api/status)`（L19059），`status==='ok'||ok===true` → `isConnected:true`。
- Jn 轮询用 `H.status.isConnected` 决定是否带 `localPort`，即是否经代理打网关——**桥接决策源于此状态**。

> 边界契约：`H` 经 React Context 下发（import `On` 应为 `useLocalTool` 的 Provider/hook）；`zc` 的 `localPort` 参数由调用方从 `H.status.port` 注入。

---

## 三、`pending_confirmation` 卡死根因（TASKS 已知限制坐实）

### 写入端（半截实现）
- `markNeedsConfirm(updateNode, taskId, kind, gatewayBase, authToken)` @**L32980**：把节点置 `status:'await_confirm'`，挂载 `confirmTaskId` / `confirmKind` / `confirmGatewayBase` / `confirmToken`（L32983）。
- 触发：轮询中 `resolveNeedsConfirm(taskInfo)` 检测 `error.code==='pending_confirmation'` → 取 `taskInfo.id` → `markNeedsConfirm(...)` → **`return` 退出轮询**（L33058-33062 图像、L33545-33548 视频、L34217-34220 另一视频流，共 3 处）。

### 消费端（缺失）
- 全 App.js grep `confirmTaskId` / `confirmGatewayBase` / `confirmToken` / `await_confirm`：
  - **仅 L32983 一处写入，零处读取**。
  - `onConfirm`(L11194/L12706) 是通用模态框回调，与 `await_confirm` 节点确认流无关。
- **结论**：节点进入 `await_confirm` 后，没有任何代码读取 `confirmTaskId` 重新发起确认请求或续轮询。`AUTO_CONFIRM=false` 时，生成任务**永久停留 `await_confirm`**，用户在前端无入口确认 → 卡死。

### 与 TASKS 的对照
- TASKS 行25：「单任务 `pending_confirmation` 卡轮询(AUTO_CONFIRM=false 时)……无害」。
- **修正**：非「无害」——是真实功能缺口（确认 UI/续轮询逻辑未实现）。`markNeedsConfirm` 写了状态字段却无消费端，属「半截实现」Bug。若网关启用人工确认（AUTO_CONFIRM=false），该路径必卡。

---

## 四、边界契约汇总（本专项）

| 接缝 | 位置 | 说明 |
|------|------|------|
| 统一 fetch 出口 | `zc` @L19001 | 全应用 HTTP 唯一出口，含 localTool 代理桥接 |
| 代理端点 | `/api/proxy`(L19016/L19021) | localTool 转发 9004 网关请求 |
| 本地文件读 | `/api/files/read`(L19006) | localTool 读本地路径 |
| 连接状态 | `Uc`(useLocalTool) @L19052 | `status={isConnected,port,version,message}` |
| 代理决策 | Jn L33007 `localPort: H.status.isConnected?H.status.port:undefined` | 连则代理，断则直连 |
| 卡死写入 | `markNeedsConfirm` @L32980 | `await_confirm` 状态，无消费端 |

---

## 五、门3 校验

- 引用行号：L19001 / L19006 / L19016 / L19021 / L19049 / L19052 / L19059 / L32980 / L32983 / L33007 / L33058 / L33061 / L33545 / L34217 / L11194 / L12706。
- 全经 `check-doc-citations.cjs` 校验（见 `校验报告.md`）。
