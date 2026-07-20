# AI 上下文参考

> 专为 AI 阅读优化的结构化数据流参考。格式：结构化列表 + 关键代码位置。
> 阅读前务必先读完 `CLAUDE.md` + `PROJECT_ORIGIN.md` 了解项目背景。

---

## 1. 三个进程

| 进程 | 语言 | 端口 | 路径 | 职责 |
|------|------|------|------|------|
| 前端扩展 | JS (混淆) | — | `src/_engine/App.js` (46252行) | 画布引擎 + 资源面板 + 配置管理 |
| localTool | Node/TS | 18080 | `localTool/src/index.ts` | 文件/KV/任务/资源的本地 SQLite 服务 |
| apimart-gateway | Python FastAPI | 9004 | `apimart-gateway/main.py` | OpenAI 风格 → Lovart AI 翻译 |

- 前端的入口: `src/main.tsx` → React.lazy import `src/_engine/App.js`
- 前端配置: `src/_engine/config.js` (`LOCAL_ENGINE.host=127.0.0.1:18080`, `DEFAULT_ENDPOINT=127.0.0.1:9004`)
- V2 代码: `src/v2/` 为新版前端，当前未启用。AppShell 在 `src/v2/AppShell.tsx` 但未对接

---

## 2. 关键函数速查 (App.js)

| 函数名 | 行号 | 作用 |
|--------|------|------|
| `Oa` | L3511 | 登录/鉴权 |
| `Jn` | ~L32731 | AI 生图/生视频/生音频 主回调 |
| `Ev` | L42804 | rescan: 扫描磁盘文件 → resources 表 |
| `we` | L42820 | 加载资源 (rescan + 查询) |
| `Oi` | L44322 | "同步到本地": 调 we() 刷新资源列表 |
| `Sv` | L42759 | 保存资源元数据到 localTool |
| `xv` | L42742 | 从 localTool 查询资源列表 |
| `Qn` | L169 | 资源面板组件 |
| `Ir` | L36212 | 画布 onDragOver |
| `Lr` | L36215 | 画布 onDrop |
| `Z` | ~L36215 | 创建节点并添加到画布 |
| `ii` | ~L36284 | uploadFile 统一入口 |

---

## 3. 存储层

### 3.1 存储管理器 Q
- 位置: `App.js` ~L1260
- 接口: `Q.get(key)`, `Q.set(key, value)`, `Q.setObject(key, value)`, `Q.getObject(key)`, `Q.syncToLocalTool(key)`, `Q.syncAllToLocalTool()`
- 后端选择: 支持 `localToolEngine` (wr), `chromeStorageEngine` (Mr), `localStorageEngine` (Nr), `localforageEngine` (Pr)

### 3.2 存储键
- `app_settings` → 默认模型/端口/网格配置
- `api_configs` → API 端点/密钥
- `users` → 账号列表
- `membership` → 会员信息
- `projects` → 项目列表
- `presetPrompts` → 预设提示词
- `customNodeTemplates` → 自定义节点模板
- `modelSchedules` → 模型调度
- `cloud_storage_config` → 云存储配置
- `transitResources` → 右键采集素材 (chrome.storage.local, 最多 5 条)
- `transit_grid_cols` → 网格列数
- `globalTasks` → 全局任务列表
- `canvas-state-v1-{projectId}` → 画布数据 (localforage)
- `auth_token` → 鉴权 token (localStorage)

### 3.3 SQLite 表 (localTool)
- `kv (key TEXT PK, value TEXT, updated_at INTEGER)` → 键值配置
- `tasks (task_id TEXT PK, node_id, prompt, result_url, ...)` → 任务记录
- `resources (id TEXT PK, url TEXT, type TEXT, source, folder, name, ...)` → 资源文件索引

### 3.4 磁盘目录
- `~/.yimao-localtool/` → 数据根目录 (环境变量 `YIMAO_DATA_DIR` 可覆盖)
- `uploads/tasks/` → 生成产物
- `uploads/migrated/` → 采集素材
- `uploads/canvas/drop/` → 拖入画布
- `uploads/canvas/paste/` → 粘贴导入
- `uploads/.thumbnails/` → 缩略图缓存

---

## 4. 核心数据流

### 4.1 AI 生成
```
用户点击生成 → Jn() → POST /v1/images/generations (或 /v1/videos/generations)
  → 网关接收 → 字段兼容映射 (ratio→aspect_ratio, seconds→duration)
  → _do_submit() → LovartClient → 创建异步任务 → 返回 task_id
  → 前端: 有 task_id? 异步轮询 : 同步解析
  → 异步轮询: GET /v1/tasks/{id} → 每 ≥3s (退避上限 15s) → 15min deadline
  → 解析结果: images[].url / videos[].url (注意 .url 是数组!)
  → CDN URL? 下载到本地: ii() → uploadFile → uploads/tasks/
  → 更新节点 data.imageUrl/videoUrl
  → dispatchEvent('mutiwindow-task-completed')
  → 统一同步 effect 触发 → Ev() rescan → 资源面板刷新
```

### 4.2 右键采集
```
background.ts handleSaveToTransit()
  → 获取 srcUrl / selectionText
  → 构建 resource {id, url, type, source:'extension'}
  → chrome.storage.local.set('transitResources', [...]) (最多 5 条)
  → chrome.runtime.sendMessage({action:'resourceAdded', resource})
  → 前端 onMessage 监听 (L43436)
  → 添加到列表 + Sv() POST /api/resources/save
  → 已知限制: 只存元数据(URL)，不下载文件到 uploads/migrated/
  → 文本类型: url 字段直接存文本内容，不需要下载
```

### 4.3 统一同步 Effect (修复后)
```
依赖: [i(globalTasks), n.status.isConnected, n.status.port]
锁定: Se.current = true (防止并发)
遍历 globalTasks → 检查 status === 'completed'
  → 检查 resultUrl 是否需要本地化:
    - 条件: e.startsWith('/files/') OR (e.startsWith('http://127.0.0.1') AND /\/files\/tasks/)
    - 命中 → 跳过上传 (已本地化)
    - 未命中 → uploadFile() → 下载到本地 → 更新 url
  → 有变更? dispatchEvent('mutiwindow-task-completed') → Ev() rescan
  → ev(i, t) 持久化 globalTasks
注意: 修复前缺少 e.startsWith('/files/') 条件，导致已本地化任务被反复上传 → 死循环
```

### 4.4 画布拖放 (onDrop, L36215)
```
e.dataTransfer 读取:
  1. application/x-yimao-template → 有 graphData? → sn.current() 批量导入模板节点
  2. application/x-mutiwindow-task → 有 url? → 创建节点 (image/video/audio/text)
  3. dataTransfer.files → 有文件? → 判断类型:
     - text/plain → readAsText() → textNode
     - image/video/audio → ii() uploadFile (subfolder: canvas/drop) → 创建对应节点
  4. 无匹配 → 忽略
```

### 4.5 Rescan 同步
```
触发条件: 打开资源面板 / 手动刷新 / 生成完成 / 3秒节流
Ev() → POST /api/resources/rescan
  → localTool 扫描 uploads/ 子目录 (tasks/, migrated/, canvas/, 排除 .thumbnails/)
  → 遍历每个文件:
    - 是目录? → INSERT type=folder
    - 文件 → 扩展名映射类型 (image/video/audio/text) → id 已存在? 跳过 : INSERT
    - 无映射 → 跳过
  → 孤儿清理: 删除磁盘已不存在的 resources 记录
  → 返回 {count, scanned, added, skipped, orphanDeleted}
```

---

## 5. 网关 API 路由 (apimart-gateway/main.py)

| 路由 | 方法 | 行号 | 说明 |
|------|------|------|------|
| `/v1/images/generations` | POST | L591 | 图片生成 |
| `/v1/images/edits` | POST | L595 | 图片编辑 (inpaint/outpaint, multipart/form-data) |
| `/v1/videos/generations` | POST | L641 | 视频生成 |
| `/v1/video/generations` | POST | L646 | 别名 (兼容 sd2Video 节点) |
| `/v1/videos` | POST | L651 | 别名 (兼容 video 节点) |
| `/v1/music/generations` | POST | L655 | **501 不支持** |
| `/v1/audio/generations` | POST | L659 | **501 不支持** |
| `/v1/audio/speech` | POST | L663 | **501 不支持 (TTS)** |
| `/v1/tasks/{task_id}` | GET | L873 | 查询任务状态 |
| `/v1/tasks/{task_id}/confirm` | POST | L882 | 手动确认任务 (AUTO_CONFIRM=false 时) |
| `/v1/balance` | GET | L922 | 查询余额/模式 |
| `/v1/chat/completions` | POST | — | 流式 SSE 聊天 |

### 字段兼容映射 (L687)
- `metadata.reference_images` → `reference_images`
- `metadata.ratio` → `aspect_ratio`
- `metadata.seconds` → `duration`
- `input_reference` → `reference_images`
- `input_video` → `videos`

---

## 6. localTool 路由 (localTool/src/index.ts)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 服务状态 |
| `/api/kv/get` | GET | KV 读取 |
| `/api/kv/set` | POST | KV 写入 |
| `/api/files/upload` | POST | 文件上传 (FormData 或 JSON URL) |
| `/api/files/read` | GET | 文件读取 |
| `/api/files/thumbnail` | GET | 缩略图生成 |
| `/api/files/mkdir` | POST | 创建目录 |
| `/api/files/move` | POST | 移动文件 |
| `/api/files/open` | GET | 打开文件 (explorer) |
| `/api/files/open-dir` | GET | 打开目录 (explorer) |
| `/api/files/list` | GET | 列出目录内容 |
| `/api/tasks` | GET | 查询任务 |
| `/api/tasks/save` | POST | 保存任务 |
| `/api/tasks/delete` | POST | 删除任务 |
| `/api/tasks/clear` | POST | 清空任务 |
| `/api/resources` | GET | 查询资源 (支持过滤) |
| `/api/resources/save` | POST | 保存资源 |
| `/api/resources/delete` | POST | 删除资源 |
| `/api/resources/clear` | POST | 清空资源 (可选删除文件) |
| `/api/resources/rescan` | POST | 扫描磁盘 → 入库 |
| `/api/proxy` | POST | HTTP 代理转发 |
| `/api/jianying/send` | POST | 剪映发送 (占位) |
| `/files/*` | GET | 静态文件服务 (MIME + Cache-Control) |

---

## 7. 资源类型映射

| 类型 | 扩展名 | 说明 |
|------|--------|------|
| image | png/jpg/webp/gif/bmp/svg/avif | 图片 |
| video | mp4/webm/mov/avi/mkv/flv/m4v | 视频 |
| audio | mp3/wav/flac/ogg/m4a/aac/opus/wma/aiff | 音频 |
| text | md/markdown/txt | 文本 |
| folder | — | 目录 (资源面板可嵌套浏览) |

---

## 8. 前端 Stores (src/v2/stores/)

| Store | 文件 | 关键状态 |
|-------|------|---------|
| canvasStore | `canvasStore.ts` | nodes, edges, viewport, onNodesChange, onEdgesChange, onConnect |
| resourceStore | `resourceStore.ts` | resources, loading, filter |
| taskStore | `taskStore.ts` | tasks, currentTask, loading |
| uiStore | `uiStore.ts` | activeTab, showTaskCenter, menuVisibility |
| projectStore | `projectStore.ts` | projects, currentProjectId, loading |
| accountStore | `accountStore.ts` | accounts, loaded |

---

## 9. 事件总线

| 事件名 | 触发源 | 处理 | 连锁反应 |
|--------|--------|------|---------|
| `mutiwindow-task-completed` | 统一同步 effect | → Ev() rescan | 资源面板刷新 |
| `mutiwindow-sync-local` | 资源面板按钮 | → we() rescanSync | 资源列表更新 |
| `import-project` | AppShell 项目菜单 | → 文件选择器 | 画布加载 |
| `export-project` | AppShell 项目菜单 | → 文件保存 | 下载文件 |
| `resourceAdded` | background.ts | → 更新 transitItems | 素材 Tab 显示 |
| `canvas-state-change` | ReactFlow onChange | → localforage 保存 | 持久化 |

---

## 10. 已知问题/限制

| 问题 | 说明 |
|------|------|
| 右键采集不下载文件 | 只存元数据 (URL) 到 resources 表，不下载到 uploads/migrated/ |
| 音频/音乐生成 501 | 网关 `/v1/music/generations` 返回 501 不支持 |
| 剪映发送占位 | `/api/jianying/send` 只记录日志，不真正发送到剪映 |
| 单任务轮询卡住 | 独立问题: `pending_confirmation` 状态下前端不停轮询 |
| 网关 404 无害噪音 | 9004 端口 `/api/...` 404 是正常现象 (网关只有 /v1/ 路由) |
| RootErrorBoundary | `useState null` 报错无害，可忽略 |
| 18080 连不上 | 状态指示器变红，功能受限但页面不崩溃 |
| V2 代码未启用 | `src/v2/` 代码当前未对接，实际运行的是 `src/_engine/App.js` |

---

## 11. 关键环境变量 (apimart-gateway)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LOVART_ACCESS_KEY` | "" | Lovart 访问密钥 |
| `LOVART_SECRET_KEY` | "" | Lovart 秘密密钥 |
| `LOVART_BASE_URL` | `https://lgw.lovart.ai` | Lovart 后端地址 |
| `LOVART_TIMEOUT` | 600 | API 超时秒数 |
| `AUTO_CONFIRM` | true | 自动确认 pending_confirmation |
| `LOVART_MODE` | "" | fast / unlimited |
| `TASK_RESULT_TTL` | 86400 | 任务结果缓存时间 |
| `USER_KEYS` | "{}" | 多用户密钥映射 JSON |
| `OPEN_RELAY` | false | 开放中继模式 |

---

## 12. 错误处理层级

- L1 (React 边界): `ErrorBoundary` → 降级 UI + 重试按钮
- L2 (网络): fetch 失败 → 重试 (3次, 递增间隔) / 15min deadline / AbortController
- L3 (业务): 402(余额不足) / 403(权限) / 404(无害噪音) / 500(重试) / WebSocket 断连(自动重连)
- L4 (噪音): ResizeObserver / RootErrorBoundary / Promise rejection → silent ignore

---

## 13. 自定义事件 (App.js)

- `mutiwindow-task-completed`: 任务完成通知 → 触发 rescan
- `mutiwindow-sync-local`: 同步到本地引擎
- `import-project` / `export-project`: 项目导入导出
- `resourceAdded`: background.ts 通知前端新资源
- `canvas-state-change`: 画布状态变更

---

## 14. 性能优化

- 画布: `onlyRenderVisibleElements` (节点 > 20), `pan-performance-mode` (移动时隐藏边动画), `is-large-canvas` (节点 > 300 降低透明度)
- 存储: `transitResources` 最多 5 条, `TASK_RESULT_TTL` 86400s, `_TASK_META` 500 条上限, 缩略图缓存
- 网络: `rescanThrottledSync` 3 秒节流, 轮询间隔 ≥ 3s (退避 15s), `Cache-Control max-age=31536000`, WebSocket 长连接
- 渲染: React.memo, Zustand selector, CSS GPU 加速 (transform + opacity)