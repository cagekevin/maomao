# CONTRACTS.md · 跨端字符串契约分布表

> 自动生成（scripts/contract_scan.cjs --md）。改任一契约前先查此表，确认要动几个文件、哪个端；改完跑 `npm run contracts` 校验全端同步。
> 当前快照基线时间见 scripts/contract_snapshot.json。

| 契约 | 严重度 | 总命中 | 文件分布（文件:次数） |
|---|---|---|---|
| `proxy_mode_local_tool` | critical | 31 | src/bundle/App-BX6o9fW5_components/Vr.jsx(3) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(16) · src/bundle/httpClient-BknZwXjG_components/shared.js(3) · src/bundle/httpClient-BknZwXjG_components/Un.jsx(4) · src/bundle/ShareAppPage-C4RerI9i.js(1) · localTool/src/routes/resources.ts(4) |
| `port_18080` | critical | 46 | src/bundle/App-BX6o9fW5_components/Tr.jsx(1) · src/bundle/endpointConfig-Bt85xi8d.js(5) · localTool/src/db/database.ts(2) · localTool/src/index.ts(5) · localTool/src/routes/files.ts(1) · localTool/src/routes/official.ts(17) · localTool/src/routes/passthrough.ts(3) · localTool/src/routes/resources.ts(2) · localTool/src/routes/system.ts(8) · public/background.js(2) |
| `port_9004` | critical | 5 | localTool/src/routes/system.ts(4) · localTool/src/utils/netProxy.ts(1) |
| `api_proxy_path` | critical | 12 | src/bundle/httpClient-BknZwXjG_components/shared.js(4) · localTool/src/index.ts(3) · localTool/src/routes/official.ts(1) · localTool/src/routes/system.ts(3) · localTool/src/utils/netProxy.ts(1) |
| `x_proxy_url_header` | high | 2 | localTool/src/routes/files.ts(1) · localTool/src/routes/system.ts(1) |
| `public_platform` | high | 14 | src/bundle/httpClient-BknZwXjG_components/shared.js(2) · localTool/src/index.ts(6) · localTool/src/routes/passthrough.ts(1) · localTool/src/routes/platform.ts(5) |
| `envelope_code_data` | critical | 7 | src/bundle/App-BX6o9fW5_components/shared.js(1) · src/bundle/App-BX6o9fW5_components/Vr.jsx(1) · localTool/src/routes/system.ts(5) |
| `kv_canvas_state_v1` | medium | 6 | src/bundle/App-BX6o9fW5_components/Vr.jsx(2) · src/bundle/httpClient-BknZwXjG_components/shared.js(2) · localTool/src/routes/admin.ts(2) |
| `kv_active_api_endpoint` | medium | 9 | src/bundle/endpointConfig-Bt85xi8d.js(1) · localTool/src/routes/admin.ts(1) · localTool/src/routes/official.ts(6) · localTool/src/routes/passthrough.ts(1) |
| `kv_transit_resources` | medium | 24 | src/bundle/App-BX6o9fW5_components/Vr.jsx(7) · src/bundle/httpClient-BknZwXjG_components/Co.jsx(1) · src/bundle/httpClient-BknZwXjG_components/c_.jsx(2) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(6) · src/bundle/httpClient-BknZwXjG_components/shared.js(1) · src/bundle/httpClient-BknZwXjG_components/Un.jsx(2) · src/bundle/httpClient-BknZwXjG_components/Zo.jsx(1) · src/bundle/httpClient-BknZwXjG_components/_Component118.jsx(2) · src/bundle/ShareAppPage-C4RerI9i.js(2) |
| `kv_api_configs` | medium | 4 | src/bundle/App-BX6o9fW5_components/Vr.jsx(3) · src/bundle/httpClient-BknZwXjG_components/shared.js(1) |
| `local_tool_label` | low | 15 | src/bundle/App-BX6o9fW5_components/Vr.jsx(3) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(2) · src/bundle/httpClient-BknZwXjG_components/shared.js(2) · src/bundle/httpClient-BknZwXjG_components/Un.jsx(4) · localTool/src/routes/resources.ts(4) |
| `scriptbox_node_type` | critical | 28 | src/bundle/httpClient-BknZwXjG_components/As.jsx(1) · src/bundle/httpClient-BknZwXjG_components/bo.jsx(2) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(22) · src/bundle/httpClient-BknZwXjG_components/shared.js(3) |
| `scriptbox_callbacks` | critical | 77 | src/bundle/httpClient-BknZwXjG_components/c_.jsx(12) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(65) |
| `scriptbox_downstream` | high | 101 | src/bundle/App-BX6o9fW5_components/shared.js(10) · src/bundle/httpClient-BknZwXjG_components/bo.jsx(2) · src/bundle/httpClient-BknZwXjG_components/Co.jsx(2) · src/bundle/httpClient-BknZwXjG_components/c_.jsx(2) · src/bundle/httpClient-BknZwXjG_components/es.jsx(2) · src/bundle/httpClient-BknZwXjG_components/H_.jsx(78) · src/bundle/httpClient-BknZwXjG_components/shared.js(3) · src/bundle/httpClient-BknZwXjG_components/Zo.jsx(2) |

## 各契约 scope 与含义

- **proxy_mode_local_tool**：画布请求唯一出口标识：proxyMode=local-tool
  - scope: src/bundle, localTool/src
  - 模式: "proxyMode" | "local-tool"
- **port_18080**：localTool 固定端口 127.0.0.1:18080
  - scope: src/bundle, localTool/src, public/background.js
  - 模式: "18080"
- **port_9004**：apimart-gateway 固定端口 9004（前端经变量拼接，故 bundle 内无字面量）
  - scope: localTool/src, apimart-gateway
  - 模式: "9004"
- **api_proxy_path**：代理转发唯一入口 /api/proxy；localTool 负责剥信封/异步转同步
  - scope: src/bundle, localTool/src
  - 模式: "/api/proxy"
- **x_proxy_url_header**：代理上游地址头 x-proxy-url（常态指向 :9004）
  - scope: src/bundle, localTool/src
  - 模式: "x-proxy-url"
- **public_platform**：localTool 自研平台接口前缀 /public/platform（替代官方 1mao）
  - scope: src/bundle, localTool/src
  - 模式: "/public/platform"
- **envelope_code_data**：前后端信封结构 {code,data}：localTool 剥信封对齐画布硬编码
  - scope: src/bundle, localTool/src, apimart-gateway
  - 模式: /[^a-zA-Z0-9_]code[^a-zA-Z0-9_].{0,12}[^a-zA-Z0-9_]data[^a-zA-Z0-9_]/ | "t.data[0].url"
- **kv_canvas_state_v1**：画布状态持久化 KV 键 canvas-state-v1
  - scope: src/bundle, localTool/src, public/background.js
  - 模式: "canvas-state-v1"
- **kv_active_api_endpoint**：当前 API endpoint 持久化 KV 键 active_api_endpoint
  - scope: src/bundle, localTool/src
  - 模式: "active_api_endpoint"
- **kv_transit_resources**：转场资源持久化 KV 键 transitResources（高频 24 处，改名务必全同步）
  - scope: src/bundle, localTool/src
  - 模式: "transitResources"
- **kv_api_configs**：API 配置持久化 KV 键 api_configs
  - scope: src/bundle, localTool/src
  - 模式: "api_configs"
- **local_tool_label**：模式标签 local-tool（与 proxyMode 关联，但区分独立字符串）
  - scope: src/bundle, localTool/src
  - 模式: "local-tool"
- **scriptbox_node_type**：剧本盒子节点类型 scriptBoxNode（引擎拆分时该字符串是 UI 挂载关键，不可变）
  - scope: src/bundle
  - 模式: "scriptBoxNode"
- **scriptbox_callbacks**：剧本盒子 9 个引擎回调名（挂到 node.data.onXxx，组件只调不实现；改名必须组件/引擎/注入三方同步）
  - scope: src/bundle
  - 模式: "onGenerateScript" | "onGenerateAssetImage" | "onGenerateAllAssetImages" | "onGenerateShotPrompts" | "onStopScriptItem" | "onRetryVideoAssetUpload" | "onUploadAllVideoAssets" | "onConnectShot" | "onConnectShots"
- **scriptbox_downstream**：剧本盒子连线下游节点类型 promptNode/discountVideoNode（scriptbox 只连这两种）
  - scope: src/bundle
  - 模式: "promptNode" | "discountVideoNode"