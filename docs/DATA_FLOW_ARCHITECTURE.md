# 一毛AI画布 · 数据流架构图集

> 本文档用 Mermaid 流程图全面展示系统的数据流、状态流转和架构设计。
> 所有图形均为文本描述，可在支持 Mermaid 的 Markdown 渲染器中查看。

---

## 目录

1. [系统运行时架构](#1-系统运行时架构)
2. [数据存储分层架构](#2-数据存储分层架构)
3. [资源素材完整生命周期](#3-资源素材完整生命周期)
4. [右键采集"发送到资源"流程](#4-右键采集发送到资源流程)
5. [Rescan 磁盘同步机制](#5-rescan-磁盘同步机制)
6. [AI 生成端到端流程](#6-ai-生成端到端流程)
7. [网关 AI 请求翻译流程](#7-网关-ai-请求翻译流程)
8. [任务异步轮询机制](#8-任务异步轮询机制)
9. [统一同步 Effect 流程](#9-统一同步-effect-流程)
10. [画布节点数据流](#10-画布节点数据流)
11. [文件操作服务](#11-文件操作服务)
12. [资源面板 UI 交互流](#12-资源面板-ui-交互流)
13. [配置同步与持久化](#13-配置同步与持久化)
14. [GAS 云同步流程](#14-gas-云同步流程)

---

## 1. 系统运行时架构

三个独立进程协同工作，构成完整的本地化运行环境。

```mermaid
flowchart TB
    subgraph Browser["Chrome 浏览器"]
        subgraph Extension["Chrome 扩展 (MV3)"]
            F[前端画布引擎<br/>src/_engine/App.js<br/>46252行混淆JS]
            B[Service Worker<br/>src/background.ts<br/>右键菜单/资源采集]
            S[Side Panel<br/>侧边栏入口]
        end
        subgraph Storage["浏览器存储"]
            CS[chrome.storage.local<br/>transitResources 等]
            LF[localforage<br/>IndexedDB 兜底]
        end
    end

    subgraph Local["本地服务 (127.0.0.1)"]
        LT[localTool 本地工具服务<br/>Node/TS :18080<br/>文件/KV/任务/资源/代理]
        GW[apimart-gateway AI 网关<br/>Python FastAPI :9004<br/>OpenAI→Lovart 翻译]
    end

    subgraph Remote["远程"]
        LV[Lovart AI 后端<br/>lgw.lovart.ai]
        GAS[Google Apps Script<br/>云端同步]
    end

    F -->|"npm run build → dist/"| CS
    F -->|"fetch /api/..."| LT
    F -->|"fetch /v1/..."| GW
    B -->|"右键菜单采集"| CS
    B -->|"chrome.runtime.sendMessage"| F
    S -->|"chrome.sidePanel"| F
    LT -->|"sql.js WASM"| DB[(SQLite<br/>~/.yimao-localtool/)]
    LT -->|"fs"| DISK[(磁盘文件<br/>uploads/)]
    GW -->|"httpx"| LV
    F -->|"GAS CloudSync"| GAS

    style F fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style LT fill:#0f3460,stroke:#53d8fb,color:#fff
    style GW fill:#16213e,stroke:#f5a623,color:#fff
```

---

## 2. 数据存储分层架构

不同数据使用不同的存储策略，按优先级和持久性分层。

```mermaid
flowchart LR
    subgraph Layer1["Layer 1: 运行时内存 (最快)"]
        direction TB
        Z1[Zustand Stores<br/>canvasStore / resourceStore / taskStore<br/>uiStore / projectStore / accountStore]
        RC1[React State<br/>组件内 useState]
    end

    subgraph Layer2["Layer 2: 浏览器存储 (离线)"]
        direction TB
        CS2[chrome.storage.local<br/>transitResources<br/>右键采集素材]
        LF2[localforage (IndexedDB)<br/>canvas-state-v1-{projectId}<br/>画布节点/连线数据]
    end

    subgraph Layer3["Layer 3: localTool 持久化 (重启不丢)"]
        direction TB
        KV3[KV 表<br/>app_settings / api_configs<br/>projects / users / presetPrompts]
        TS3[Tasks 表<br/>task_id / node_id / result_url<br/>生成的完整任务记录]
        RS3[Resources 表<br/>id / url / type / folder<br/>资源索引元数据]
        DISK3[磁盘文件系统<br/>uploads/tasks/<br/>uploads/migrated/<br/>uploads/canvas/]
    end

    Z1 -->|"Q.setObject()"| KV3
    Z1 -->|"Sr.default.setItem()"| LF2
    RC1 -->|"保存画布"| LF2
    CS2 -->|"syncToLocalTool"| KV3
    DISK3 -->|"rescan → 扫描"| RS3
    KV3 -->|"wr.get()"| Z1
    LF2 -->|"Sr.default.getItem()"| RC1

    style Layer1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style Layer2 fill:#0f3460,stroke:#53d8fb,color:#fff
    style Layer3 fill:#16213e,stroke:#f5a623,color:#fff
```

### 存储键对照表

```mermaid
flowchart TB
    subgraph KV["KV 存储键 (localTool KV 表)"]
        KV1[app_settings]
        KV2[api_configs]
        KV3[users]
        KV4[membership]
        KV5[projects]
        KV6[presetPrompts]
        KV7[customNodeTemplates]
        KV8[modelSchedules]
        KV9[cloud_storage_config]
        KV10[transitResources]
        KV11[transit_grid_cols]
        KV12[globalTasks]
        KV13[canvas-state-v1-{projectId}]
    end

    subgraph CS["chrome.storage.local"]
        CST[transitResources<br/>右键采集的素材<br/>最多5条]
    end

    subgraph LF["localforage (IndexedDB)"]
        LFC[canvas-state-v1-{projectId}<br/>画布节点/连线完整数据<br/>img_ / img_thumb_ / video_thumb_]
    end

    subgraph SQL["SQLite 表"]
        S1[kv 表<br/>key-value pairs]
        S2[tasks 表<br/>任务记录含结果]
        S3[resources 表<br/>资源索引]
    end

    subgraph DISK["磁盘文件"]
        D1[uploads/tasks/<br/>生成产物]
        D2[uploads/migrated/<br/>采集素材]
        D3[uploads/canvas/<br/>画布文件]
        D4[uploads/.thumbnails/<br/>缩略图缓存]
    end
```

---

## 3. 资源素材完整生命周期

从创建/采集到入库、复用、最终删除的全链路。

```mermaid
flowchart TB
    subgraph Create["① 创建 / 采集"]
        GEN[画布节点生成<br/>生图/生视频]
        RCLICK[网页右键采集<br/>图片/视频/音频/文本]
        PASTE[剪贴板粘贴<br/>图片/文本]
        IMPORT[文件导入<br/>从本地选择]
    end

    subgraph Persist["② 持久化"]
        UPLOAD["uploadFile()<br/>→ localTool /api/files/upload<br/>文件存到 uploads/"]
        RESCAN["rescan 扫描<br/>磁盘文件 → resources 表"]
        SV["Sv() saveResource<br/>写入 resources 表"]
        CS2["chrome.storage.local<br/>transitResources"]
    end

    subgraph Display["③ 展示"]
        RP_RESOURCES["资源面板 (Qn)<br/>生成 Tab: folder=tasks<br/>素材 Tab: folder=migrated"]
        RP_GRID["网格视图<br/>2-8 列可调<br/>图片/视频/音频/文本/文件夹"]
        RP_FOLDER["文件夹嵌套<br/>前端可浏览"]
    end

    subgraph Reuse["④ 复用"]
        DRAG["拖入画布<br/>→ 创建新节点<br/>或作为节点输入"]
        SEND_CANVAS["发送到画布<br/>→ 添加为节点素材"]
        SEND_WEB["发送到网页<br/>→ 注入当前页面"]
        COPY["复制 URL<br/>/ 下载文件"]
    end

    subgraph Manage["⑤ 管理"]
        FAV[收藏/取消收藏<br/>isFavorite 字段]
        DELETE[删除<br/>从 resources 表移除]
        CLEAR["清空<br/>按文件夹删除<br/>可选删除文件"]
        MOVE[移动<br/>跨文件夹拖拽]
        NEW_FOLDER[新建文件夹<br/>mkdir 创建子目录]
    end

    subgraph Destroy["⑥ 销毁"]
        ORPHAN["孤儿清理<br/>rescan 自动删除<br/>磁盘已不存在的记录"]
        CLEAR_ALL["清空全部<br/>DELETE FROM resources"]
    end

    GEN -->|"完成事件 → Ev()"| RESCAN
    RCLICK --> CS2
    CS2 -->|"resourceAdded 消息"| SV
    PASTE -->|"gi() → paste 来源"| SV
    IMPORT --> UPLOAD
    UPLOAD --> RESCAN
    SV --> RP_RESOURCES
    RESCAN --> RP_RESOURCES
    RP_RESOURCES --> DRAG
    RP_RESOURCES --> SEND_CANVAS
    RP_RESOURCES --> SEND_WEB
    RP_RESOURCES --> COPY
    RP_RESOURCES --> FAV
    RP_RESOURCES --> DELETE
    RP_RESOURCES --> CLEAR
    RP_RESOURCES --> MOVE
    RP_RESOURCES --> NEW_FOLDER
    RESCAN -.->|"自动清理"| ORPHAN

    style Create fill:#1a1a2e,stroke:#e94560,color:#fff
    style Persist fill:#0f3460,stroke:#53d8fb,color:#fff
    style Display fill:#16213e,stroke:#f5a623,color:#fff
    style Reuse fill:#1a1a2e,stroke:#45b7d1,color:#fff
    style Manage fill:#0f3460,stroke:#96ceb4,color:#fff
    style Destroy fill:#16213e,stroke:#ff6b6b,color:#fff
```

---

## 4. 右键采集"发送到资源"流程

Chrome 扩展右键菜单采集网页素材的完整数据流。

```mermaid
flowchart TB
    USER([用户在网页上右键<br/>图片/视频/音频/文本])

    USER -->|"选择「发送到资源」"| BG

    subgraph BG["background.ts Service Worker"]
        DIR[chrome.contextMenus<br/>注册 save-to-transit]
        HANDLE["handleSaveToTransit()<br/>获取 srcUrl / selectionText"]
        BUILD["构建 TransitResource<br/>id: Date.now()<br/>url: 原始URL/文本<br/>type: image/video/audio/text<br/>source: extension"]
        SAVE["存 chrome.storage.local<br/>key: transitResources<br/>最多保留5条"]
        NOTIFY["chrome.runtime.sendMessage<br/>{action: 'resourceAdded', resource}"]
        OPEN_SIDEBAR["尝试打开侧边栏<br/>chrome.sidePanel.open()"]
    end

    HANDLE --> BUILD
    BUILD --> SAVE
    SAVE --> NOTIFY
    NOTIFY --> OPEN_SIDEBAR

    NOTIFY -->|"消息传递"| FRONT

    subgraph FRONT["前端 App.js"]
        MSG["chrome.runtime.onMessage 监听<br/>L43436"]
        CHECK{"action === 'resourceAdded'?"}
        ADD_TO_LIST["添加到 D 状态<br/>folder: 'migrated'"]
        CHECK_SOURCE{"source === 'local-tool'?"}
        SAVE_META["Sv() → POST /api/resources/save<br/>保存元数据到 resources 表"]
        SWITCH_TAB["切换到 transit Tab<br/>选中 materials"]
        REFRESH["G(e => e + 1)<br/>刷新资源面板"]
    end

    MSG --> CHECK
    CHECK -->|"是"| ADD_TO_LIST
    ADD_TO_LIST --> CHECK_SOURCE
    CHECK_SOURCE -->|"否 (extension)"| SAVE_META
    CHECK_SOURCE -->|"是 (local-tool)"| REFRESH
    SAVE_META --> SWITCH_TAB
    SWITCH_TAB --> REFRESH

    subgraph LOCAL["localTool 接收"]
        SV["Sv() → POST /api/resources/save"]
        SV_DB["写入 resources 表<br/>{id, url, type, source:extension,<br/>folder:migrated, name, timestamp}"]
    end

    SAVE_META --> SV
    SV --> SV_DB

    subgraph ISSUE["※ 已知设计限制"]
        NOTE1["只存了元数据 (URL)<br/>实际文件未下载到 uploads/"]
        NOTE2["图片/视频 URL 是原始网页地址<br/>可能有过期时间"]
        NOTE3["文本类型: url 字段直接存文本内容<br/>不需要下载，文本正常显示"]
        NOTE4["用户需自行修复添加下载逻辑<br/>在 resourceAdded 处理中调用 uploadFile"]
    end

    SV_DB -.-> NOTE1
    NOTE1 -.-> NOTE2
    NOTE1 -.-> NOTE3
    NOTE1 -.-> NOTE4
```

---

## 5. Rescan 磁盘同步机制

rescan 是资源系统的核心同步机制，把磁盘文件同步到 resources 表。

```mermaid
flowchart TB
    TRIGGER{{"rescan 触发条件"}}
    TRIGGER -->|"打开资源面板"| AUTO["自动触发一次<br/>清理孤儿记录"]
    TRIGGER -->|"手动点击刷新按钮"| MANUAL["用户手动触发"]
    TRIGGER -->|"生成完成事件"| GEN["mutiwindow-task-completed<br/>完成后自动触发"]
    TRIGGER -->|"3秒节流"| THROTTLE["rescanThrottledSync<br/>3秒内重复调用被跳过"]

    AUTO --> EV
    MANUAL --> EV
    GEN --> EV
    THROTTLE --> EV

    subgraph EV["Ev() 函数 (L42804)"]
        FETCH["fetch POST /api/resources/rescan"]
        JSON["返回 {count, scanned, added, skipped, orphanDeleted}"]
        ERR["失败 → 返回 0"]
    end

    FETCH --> LT_RESCAN

    subgraph LT_RESCAN["localTool handleResourcesRescan()"]
        LIST_DIR["列出 upload 子目录<br/>tasks/ migrated/ canvas/ 等<br/>排除 .thumbnails"]
        LOOP["遍历每个子目录"]
        FILTER["跳过 . 开头项"]
        CHECK_FOLDER{"是目录?"}
        MAP_TYPE{"按扩展名映射类型"}
        CHECK_ID{"id 已存在?"}
        INSERT["INSERT INTO resources<br/>id = local-{folder}-{name}"]
        SKIP["跳过 (保留收藏/元数据)"]
        ORPHAN_CLEAN["孤儿清理<br/>删除磁盘已不存在的记录"]
    end

    LIST_DIR --> LOOP
    LOOP --> FILTER
    FILTER --> CHECK_FOLDER
    CHECK_FOLDER -->|"是"| FOLDER_INSERT["INSERT type=folder<br/>url: /files/{folder}/{name}"]
    CHECK_FOLDER -->|"否"| MAP_TYPE
    MAP_TYPE -->|"有映射"| CHECK_ID
    MAP_TYPE -->|"无映射"| SKIP
    CHECK_ID -->|"存在"| SKIP
    CHECK_ID -->|"不存在"| INSERT
    LOOP -->|"遍历结束"| ORPHAN_CLEAN

    LT_RESCAN --> RESPONSE["返回 JSON 结果"]
    RESPONSE --> JSON

    subgraph TYPE_MAP["扩展名 → 类型映射"]
        IMG[".png .jpg .jpeg .webp .gif .bmp .svg → image"]
        VID[".mp4 .webm .mov .avi .mkv .flv .m4v → video"]
        AUD[".mp3 .wav .flac .ogg .m4a → audio"]
        TXT[".md .markdown .txt → text"]
    end

    MAP_TYPE -.-> TYPE_MAP
```

---

## 6. AI 生成端到端流程

从用户在画布上触发生成到结果展示的完整链路。

```mermaid
flowchart TB
    USER([用户在 PromptNode / ImageNode 等<br/>点击生成按钮])

    subgraph FRONT["前端 App.js"]
        JN["Jn 生图主回调<br/>生图/视频/音频入口"]
        PREP["准备请求参数<br/>prompt, model, size,<br/>reference_images 等"]
        CHECK_GATEWAY{"有 task_id 返回?"}
        SYNC["同步解析<br/>直接提取 b64_json/url"]
        ASYNC["异步轮询<br/>GET /v1/tasks/{task_id}"]
        PARSE["解析结果<br/>images[].url / videos[].url<br/>※ 注意: .url 是数组"]
        CHECK_LOCAL{"是否需要本地化?"}
        UPLOAD_FILE["uploadFile()<br/>下载到 localTool<br/>存到 uploads/tasks/"]
        NOTIFY_COMPLETE["dispatchEvent<br/>mutiwindow-task-completed"]
        TRIGGER_RESCAN["Ev() rescan + 刷新资源面板"]
        UPDATE_NODE["更新节点状态<br/>loading=false<br/>progress=100<br/>设置 imageUrl/videoUrl"]
    end

    subgraph GATEWAY["apimart-gateway :9004"]
        POST_GEN["POST /v1/images/generations<br/>或 /v1/videos/generations"]
        FIELD_MAP["字段兼容映射<br/>ratio→aspect_ratio<br/>seconds→duration<br/>input_reference→reference_images"]
        SUBMIT["_do_submit()<br/>调用 LovartClient"]
        LOVART["Lovart AI 后端<br/>lgw.lovart.ai"]
        CREATE_TASK["创建异步任务<br/>返回 task_id"]
        STATUS_POLL["GET /v1/tasks/{id}<br/>轮询任务状态"]
        CHECK_DONE{"status === done?"}
        RETURN_RESULT["返回 {code:200, data:[{<br/>status:'completed',<br/>images[{url}],<br/>videos[{url}]}]}"]
    end

    subgraph LOCAL["localTool :18080"]
        FILE_UPLOAD["/api/files/upload<br/>保存文件到 uploads/tasks/"]
        RESCAN["rescan 扫描入库"]
    end

    subgraph TIMELINE["超时机制"]
        DEADLINE["15min deadline<br/>自建 AbortController"]
        INTERVAL["轮询间隔: ≥3s<br/>退避上限: 15s"]
        TIMEOUT["超时 → 报错退出"]
    end

    JN --> PREP
    PREP --> POST_GEN
    POST_GEN --> FIELD_MAP
    FIELD_MAP --> SUBMIT
    SUBMIT --> LOVART
    LOVART --> CREATE_TASK
    CREATE_TASK -->|"返回 task_id"| CHECK_GATEWAY
    CHECK_GATEWAY -->|"有 task_id"| ASYNC
    CHECK_GATEWAY -->|"无 task_id"| SYNC
    ASYNC --> STATUS_POLL
    STATUS_POLL --> CHECK_DONE
    CHECK_DONE -->|"processing"| STATUS_POLL
    CHECK_DONE -->|"completed"| RETURN_RESULT
    SYNC --> PARSE
    RETURN_RESULT --> PARSE
    PARSE --> CHECK_LOCAL
    CHECK_LOCAL -->|"需要"| UPLOAD_FILE
    CHECK_LOCAL -->|"不需要"| UPDATE_NODE
    UPLOAD_FILE --> FILE_UPLOAD
    FILE_UPLOAD --> TRIGGER_RESCAN
    TRIGGER_RESCAN --> RESCAN
    UPLOAD_FILE --> UPDATE_NODE
    UPDATE_NODE --> NOTIFY_COMPLETE
    NOTIFY_COMPLETE --> TRIGGER_RESCAN

    ASYNC -.-> TIMELINE
    STATUS_POLL -.->|"pending_confirmation<br/>AUTO_CONFIRM=false"| STUCK["卡住! 需手动 confirm"]
```

---

## 7. 网关 AI 请求翻译流程

网关把 OpenAI 风格接口翻译成 Lovart 后端调用。

```mermaid
flowchart TB
    subgraph CLIENT["前端请求 (OpenAI 风格)"]
        CHAT["POST /v1/chat/completions<br/>流式 SSE"]
        IMAGE["POST /v1/images/generations<br/>{prompt, model, size, n}"]
        VIDEO["POST /v1/videos/generations<br/>{prompt, model, duration}"]
        EDIT["POST /v1/images/edits<br/>{image, mask, prompt}"]
        MUSIC["POST /v1/music/generations"]
        BALANCE["GET /v1/balance"]
    end

    subgraph GATEWAY["apimart-gateway main.py"]
        RESOLVE["resolve_client()<br/>解析 Lovart 密钥"]
        FIELD_MAP["字段兼容映射<br/>ratio→aspect_ratio<br/>seconds→duration<br/>input_reference→reference_images<br/>metadata 字段展开"]
        EXTRACT_URL["_extract_raw_urls()<br/>提取附件 URL"]
        RESOLVE_ATTACH["_resolve_attachments()<br/>上传附件到 Lovart"]
        BUILD_PROMPT["_build_gen_prefix()<br/>构建生成前缀<br/>size / resolution 等"]
        SUBMIT["_do_submit()<br/>调用 LovartClient"]
        RESULT["解析 Lovart 返回<br/>提取 images[] / videos[] URL"]
        TASK_POLL["_check_and_fire_task()<br/>轮询线程状态"]
        CONFIRM["POST /v1/tasks/{id}/confirm<br/>手动确认 pending_confirmation"]
    end

    subgraph LOVART["Lovart AI 后端"]
        LG["lgw.lovart.ai"]
        THREAD["Thread 异步线程<br/>生成图片/视频"]
        STATUS["get_status()<br/>running / done / failed"]
        MEDIA["CDN 媒体 URL<br/>expires_at 24h 过期"]
    end

    CHAT --> RESOLVE
    IMAGE --> RESOLVE
    VIDEO --> RESOLVE
    EDIT --> RESOLVE
    MUSIC --> RESOLVE
    RESOLVE --> FIELD_MAP
    FIELD_MAP --> EXTRACT_URL
    EXTRACT_URL --> RESOLVE_ATTACH
    RESOLVE_ATTACH --> BUILD_PROMPT
    BUILD_PROMPT --> SUBMIT
    SUBMIT --> LG
    LG -->|"创建异步任务"| THREAD
    THREAD -->|"返回 thread_id"| SUBMIT
    SUBMIT -->|"task_ + thread_id"| TASK_POLL
    TASK_POLL -->|"GET status"| STATUS
    STATUS -->|"done"| MEDIA
    MEDIA -->|"URL 列表"| RESULT

    subgraph ENV["环境变量"]
        ENV1["LOVART_ACCESS_KEY"]
        ENV2["LOVART_SECRET_KEY"]
        ENV3["AUTO_CONFIRM (默认 true)"]
        ENV4["LOVART_MODE (fast/unlimited)"]
        ENV5["TASK_RESULT_TTL (默认 86400s)"]
    end

    RESOLVE -.-> ENV1
    RESOLVE -.-> ENV2
    TASK_POLL -.-> ENV3
```

---

## 8. 任务异步轮询机制

前端轮询网关获取异步任务状态，包含 7 个必踩陷阱。

```mermaid
flowchart TB
    TRIGGER([提交生成请求后<br/>收到 task_id])

    INIT["新建 AbortController<br/>ht.current.set(n, ac)<br/>※ 旧 controller 已被删除"]

    LOOP{"while(true) 轮询循环"}

    GET_STATUS["GET /v1/tasks/{task_id}"]
    RESP{"检查响应状态码"}

    PROCESSING{"status === processing?"}
    COMPLETED{"status === completed?"}
    FAILED{"status === failed?"}

    PARSE_RESULT["解析 data.result<br/>提取 images[].url / videos[].url<br/>※ 注意: .url 是数组"]
    CHECK_EMPTY{"images / videos 独立判空<br/>两者不一定同时存在"}

    ERR_NO_ARTIFACT{"error.code === 'no_artifact'?"}
    MSG_REJECT["优先透传 error.message<br/>不笼统报"生成失败""]

    CHECK_URL_EXPIRY{"URL 是 CDN 地址?"}
    DOWNLOAD_LOCAL["ii(u, ...) 下载到本地<br/>不裸存 CDN url<br/>防止 24h 后 404"]
    LOCALIZED["url 替换为本地路径"]

    UPDATE_NODE["更新节点数据<br/>loading=false<br/>设置 imageUrl/videoUrl"]

    DEADLINE{"自建 deadline<br/>15min 超时?"}
    SLEEP["等待 ≥3s<br/>退避上限 15s"]
    ABORT{"用户取消?"}

    TRIGGER --> INIT
    INIT --> LOOP

    LOOP -->|"每次迭代"| DEADLINE
    DEADLINE -->|"未超时"| GET_STATUS
    DEADLINE -->|"超时"| TIMEOUT_EXIT(["超时退出<br/>报错"])

    GET_STATUS --> RESP
    RESP -->|"200"| PROCESSING
    RESP -->|"其他"| ERROR_EXIT(["报错退出"])

    PROCESSING -->|"processing"| SLEEP
    SLEEP --> LOOP

    PROCESSING -->|"completed"| COMPLETED
    COMPLETED --> PARSE_RESULT
    PARSE_RESULT --> CHECK_EMPTY
    CHECK_EMPTY -->|"有结果"| CHECK_URL_EXPIRY
    CHECK_EMPTY -->|"空"| EMPTY_EXIT(["报错: 无生成结果"])

    CHECK_URL_EXPIRY -->|"是 CDN URL"| DOWNLOAD_LOCAL
    CHECK_URL_EXPIRY -->|"已是本地 URL"| UPDATE_NODE
    DOWNLOAD_LOCAL --> LOCALIZED
    LOCALIZED --> UPDATE_NODE

    PROCESSING -->|"failed"| FAILED
    FAILED --> ERR_NO_ARTIFACT
    ERR_NO_ARTIFACT -->|"是"| MSG_REJECT
    ERR_NO_ARTIFACT -->|"否"| GEN_FAIL_EXIT(["报错: 生成失败"])
    MSG_REJECT --> REJECT_EXIT(["透传审核拒绝消息"])

    ABORT -->|"用户取消"| ABORT_EXIT(["AbortError<br/>停止轮询"])

    subgraph TRAPS["7 个必踩陷阱"]
        T1["1. 响应格式错位<br/>检测 task_id 走轮询，<br/>不是同步读 b64_json"]
        T2["2. AbortController 已删除<br/>轮询须新建 Controller"]
        T3["3. oe 超时已失效<br/>轮询自建 15min deadline"]
        T4["4. .url 是数组不是 string<br/>必须 .url[0]"]
        T5["5. CDN URL 过期<br/>下载到本地持久化"]
        T6["6. 审核拒绝 ≠ 普通失败<br/>优先透传 error.message"]
        T7["7. 图/视频可独立出现<br/>分别判空"]
    end

    TRAPS -.->|"所有陷阱<br/>在 Jn N 分支处理"| LOOP
```

---

## 9. 统一同步 Effect 流程

修复后的"统一同步"effect，防止死循环。

```mermaid
flowchart TB
    TRIGGER_EFFECT{{"Effect 依赖变更触发<br/>[i(globalTasks), n.status.isConnected, n.status.port]"}}

    CHECK_SYNCING{"Se.current === true?"}
    SET_SYNCING["Se.current = true<br/>锁定同步中"]

    ITERATE["遍历 globalTasks"]
    CHECK_COMPLETED{"status === 'completed'?"}

    LOCALIZE["检查 resultUrl 是否需要本地化"]
    CHECK_LOCAL{"e.startsWith('/files/')<br/>OR (e.startsWith('http://127.0.0.1')<br/>AND /\/files\/tasks/)"}

    DOWNLOAD["uploadFile()<br/>下载到 localTool<br/>返回新 url"]
    URL_CHANGED{"新 url !== 旧 url?"}
    SET_CHANGED["r.resultUrl = 新 url<br/>i = true"]

    CHECK_CUSTOM{"type === 'custom'<br/>AND customResultData?"}
    LOCALIZE_CUSTOM["customResultData 也走本地化检测"]

    CHECK_DISPATCH{"有变更?"}
    DISPATCH["dispatchEvent<br/>mutiwindow-task-completed<br/>→ 触发 Ev() rescan<br/>→ 刷新资源面板"]
    PERSIST["ev(i, t) 持久化 globalTasks"]

    TRIGGER_EFFECT --> CHECK_SYNCING
    CHECK_SYNCING -->|"是"| SKIP(["跳过这次触发<br/>console.log 提示"])
    CHECK_SYNCING -->|"否"| SET_SYNCING
    SET_SYNCING --> ITERATE

    ITERATE -->|"每个任务"| CHECK_COMPLETED
    CHECK_COMPLETED -->|"是"| LOCALIZE
    CHECK_COMPLETED -->|"否"| NEXT_TASK(["下一个任务"])

    LOCALIZE --> CHECK_LOCAL
    CHECK_LOCAL -->|"已本地化"| SKIP_UPLOAD(["跳过上传<br/>return e"])
    CHECK_LOCAL -->|"未本地化"| DOWNLOAD
    DOWNLOAD --> URL_CHANGED
    URL_CHANGED -->|"变了"| SET_CHANGED
    URL_CHANGED -->|"没变"| CHECK_CUSTOM

    CHECK_CUSTOM -->|"是"| LOCALIZE_CUSTOM
    CHECK_CUSTOM -->|"否"| CHECK_DISPATCH
    LOCALIZE_CUSTOM --> CHECK_DISPATCH

    SET_CHANGED --> CHECK_DISPATCH
    CHECK_DISPATCH -->|"有变更"| DISPATCH
    CHECK_DISPATCH -->|"无变更"| PERSIST
    DISPATCH --> PERSIST

    DISPATCH -->|"注意: 修复前"| INFINITE_LOOP
    DISPATCH -->|"修复后: 跳过上传"| NO_LOOP

    subgraph INFINITE_LOOP["修复前: 死循环 (已修复)"]
        LOOP1["新 url ≠ 旧 url<br/>→ dispatchEvent"]
        LOOP2["Ev() rescan + 刷新面板"]
        LOOP3["ev(i,t) 持久化<br/>i 引用变"]
        LOOP4["Effect 重跑<br/>→ 回到 ITERATE"]
        LOOP1 --> LOOP2 --> LOOP3 --> LOOP4 -->|"无限循环"| LOOP1
    end

    subgraph NO_LOOP["修复后: 正常终止"]
        SAFE1["url 已是 /files/... 相对路径"]
        SAFE2["CHECK_LOCAL 命中 → 跳过上传"]
        SAFE3["i 不变 → 不 dispatch"]
        SAFE4["Effect 正常结束"]
        SAFE1 --> SAFE2 --> SAFE3 --> SAFE4
    end

    style INFINITE_LOOP fill:#3d0000,stroke:#ff4444,color:#fff
    style NO_LOOP fill:#003d00,stroke:#44ff44,color:#fff
```

---

## 10. 画布节点数据流

画布上节点之间的数据连接与状态更新。

```mermaid
flowchart TB
    subgraph CANVAS["React Flow 画布"]
        NODES["节点列表<br/>nodes: Node[]"]
        EDGES["连线列表<br/>edges: Edge[]"]
        VIEWPORT["视口状态<br/>pan / zoom / selection"]
    end

    subgraph NODE_TYPES["27 种节点类型"]
        PROMPT["PromptNode<br/>提示词 → 生成"]
        IMAGE["ImageNode<br/>显示图片<br/>自动判类型"]
        VIDEO["VideoNode<br/>视频播放/渲染"]
        TEXT["TextNode<br/>文本输入/输出"]
        AUDIO["AudioNode<br/>音频播放"]
        GROUP["GroupNode<br/>节点分组容器"]
        CUSTOM["CustomNode<br/>自定义处理"]
        MORE["... 20 种更多"]
    end

    subgraph DATA_FLOW["节点数据流"]
        CONNECT["连线连接<br/>source → target"]
        HANDLE["Handle 匹配<br/>sourceHandle / targetHandle"]
        PASS_DATA["传递数据<br/>imageUrl / videoUrl / text"]
        CHAIN["链式处理<br/>A → B → C"]
    end

    subgraph EVENTS["事件系统"]
        CHANGE["onNodesChange<br/>onEdgesChange<br/>位置/选择/删除"]
        CONNECT_EVENT["onConnect<br/>建立新连线"]
        DRAG_DROP["onDrop<br/>从资源面板拖入"]
        KEYBOARD["快捷键<br/>Ctrl+Z / Ctrl+D<br/>Delete / Backspace"]
    end

    subgraph STATE["状态同步"]
        SET_NODES["setNodes<br/>更新节点"]
        SET_EDGES["setEdges<br/>更新连线"]
        REACT_FLOW["React Flow 内部<br/>状态管理"]
        PERSIST_CANVAS["持久化<br/>localforage<br/>canvas-state-v1-{id}"]
    end

    subgraph GENERATION["生成触发"]
        PROMPT_GEN["PromptNode<br/>@ 调出素材引用<br/>输入描述"]
        SUBMIT_GEN["生成按钮<br/>触发 Jn"]
        RESULT_BACK["结果回填<br/>更新节点 data"]
        CHAIN_TRIGGER["链式触发<br/>下游节点自动更新"]
    end

    NODES --> |"节点类型"| NODE_TYPES
    EDGES --> DATA_FLOW
    EVENTS --> CHANGE
    EVENTS --> CONNECT_EVENT
    EVENTS --> DRAG_DROP
    EVENTS --> KEYBOARD
    CHANGE --> SET_NODES
    CHANGE --> SET_EDGES
    CONNECT_EVENT --> SET_EDGES
    DRAG_DROP --> SET_NODES
    SET_NODES --> REACT_FLOW
    SET_EDGES --> REACT_FLOW
    REACT_FLOW --> PERSIST_CANVAS
    PROMPT --> PROMPT_GEN
    PROMPT_GEN --> SUBMIT_GEN
    SUBMIT_GEN --> RESULT_BACK
    RESULT_BACK --> CHAIN_TRIGGER
    PASS_DATA --> PROMPT_GEN
    CHAIN --> PROMPT_GEN

    style CANVAS fill:#1a1a2e,stroke:#e94560,color:#fff
    style NODE_TYPES fill:#0f3460,stroke:#53d8fb,color:#fff
    style DATA_FLOW fill:#16213e,stroke:#f5a623,color:#fff
    style EVENTS fill:#1a1a2e,stroke:#45b7d1,color:#fff
    style STATE fill:#0f3460,stroke:#96ceb4,color:#fff
    style GENERATION fill:#16213e,stroke:#ff6b6b,color:#fff
```

---

## 11. 文件操作服务

localTool 提供的完整文件操作 API。

```mermaid
flowchart TB
    subgraph FILE_API["文件操作 API :18080"]
        UPLOAD["POST /api/files/upload"]
        READ["GET /api/files/read?path=xxx"]
        THUMBNAIL["GET /api/files/thumbnail?url=xxx"]
        MKDIR["POST /api/files/mkdir"]
        MOVE["POST /api/files/move"]
        OPEN["GET /api/files/open?subfolder=xxx"]
        OPEN_DIR["GET /api/files/open-dir?filepath=xxx"]
        LIST["GET /api/files/list?subfolder=xxx"]
    end

    subgraph UPLOAD_FLOW["上传文件流程"]
        RECEIVE["接收请求<br/>FormData 或 JSON"]
        CHECK_FORM{"Content-Type?"}
        FORM_DATA["FormData 模式<br/>fields: subfolder, filename<br/>files: file"]
        JSON_BODY["JSON 模式<br/>body: {fileUrl, subfolder, filename}"]
        DOWNLOAD_REMOTE["下载远程文件<br/>fetch(fileUrl)"]
        SAVE_FILE["saveFile()<br/>生成文件名: {Date.now()}-{safeName}<br/>存到 uploads/{subfolder}/"]
        THUMB_GEN["tryGenerateThumbnail()<br/>图片类生成缩略图<br/>存到 .thumbnails/"]
        RETURN["返回 JSON<br/>{url: /files/{subfolder}/{name},<br/>path: 绝对路径,<br/>thumbnailUrl}"]
    end

    subgraph STATIC["静态文件服务"]
        MATCH{"URL 以 /files/ 开头?"}
        SAFETY["路径安全检查<br/>防止遍历攻击"]
        EXIST{"文件存在?"}
        MIME["MIME 类型映射<br/>.png .jpg .mp4 .mp3 ..."]
        CACHE["Cache-Control<br/>public, max-age=31536000"]
        STREAM["fs.createReadStream<br/>pipe 返回"]
    end

    UPLOAD --> UPLOAD_FLOW
    RECEIVE --> CHECK_FORM
    CHECK_FORM -->|"multipart"| FORM_DATA
    CHECK_FORM -->|"application/json"| JSON_BODY
    FORM_DATA --> SAVE_FILE
    JSON_BODY --> DOWNLOAD_REMOTE
    DOWNLOAD_REMOTE --> SAVE_FILE
    SAVE_FILE --> THUMB_GEN
    THUMB_GEN --> RETURN

    READ --> STATIC
    THUMBNAIL -->|"生成缩略图 JSON"| THUMB_RETURN["返回 {thumbnailUrl}"]
    MKDIR -->|"创建目录"| DIR_RETURN["返回 {ok:true}"]
    MOVE -->|"rename"| MOVE_RETURN["返回 {ok:true}"]
    OPEN -->|"explorer/open"| OPEN_RETURN["返回 {path}"]
    OPEN_DIR -->|"explorer/open"| DIR_OPEN_RETURN["返回 {path}"]
    LIST -->|"readdir"| LIST_RETURN["返回 {files[], folders[]}"]

    MATCH -->|"是"| SAFETY
    SAFETY -->|"通过"| EXIST
    EXIST -->|"是"| MIME
    MIME --> CACHE
    CACHE --> STREAM
    EXIST -->|"否"| 404(["404 Not Found"])
    SAFETY -->|"不通过"| 403(["403 Forbidden"])
```

---

## 12. 资源面板 UI 交互流

资源面板（Qn 组件）中用户操作对应的数据流。

```mermaid
flowchart TB
    subgraph PANEL["资源面板 (Qn 组件)"]
        TAB["Tab 切换<br/>生成 / 素材"]
        FILTER["类型过滤<br/>全部 / 图片 / 视频 / 文本"]
        FAV_FILTER["收藏过滤<br/>只看收藏"]
        GRID["网格大小<br/>2-8 列可调"]
        FOLDER["文件夹导航<br/>后退 / 进入"]
    end

    subgraph ACTIONS["资源操作"]
        DRAG["拖入画布"]
        SEND_WEB["发送到网页"]
        SEND_CANVAS["发送到画布"]
        COPY_URL["复制 URL"]
        DOWNLOAD["下载文件"]
        SYNC_LOCAL["同步到本地引擎"]
        FAV_TOGGLE["收藏/取消收藏"]
        DELETE["删除"]
        CLEAR["清空 (按文件夹)"]
        NEW_FOLDER["新建文件夹"]
        OPEN_DIR["打开本地目录"]
        FULLSCREEN["全屏预览"]
        SEND_JIANYING["发送到剪映"]
    end

    subgraph DATA_SOURCE["数据来源"]
        LT_RESOURCES["localTool /api/resources<br/>SQLite resources 表<br/>E 状态"]
        TRANSIT["chrome.storage.local<br/>transitResources<br/>le 状态"]
        COMBINED["t = (当前 Tab 决定)<br/>生成 Tab → LT_RESOURCES<br/>素材 Tab → TRANSIT"]
    end

    subgraph EFFECTS["操作影响"]
        REFRESH["刷新列表<br/>G(e → e+1)"]
        RESCAN["Ev() rescan<br/>重新扫描磁盘"]
        API_CALL["调用 localTool API"]
        STORAGE["更新 chrome.storage"]
        TOAST["Toast 提示消息"]
    end

    TAB --> COMBINED
    FILTER -->|"f 状态"| COMBINED
    FAV_FILTER -->|"m 状态"| COMBINED
    COMBINED -->|"渲染"| GRID_VIEW["网格渲染<br/>图片/视频/音频/文本/文件夹"]

    DRAG -->|"dragStart"| DRAG_DATA["设置 dataTransfer<br/>text/plain: id<br/>application/json: resource"]
    SEND_WEB -->|"_i()"| SEND_WEB_API["chrome.scripting<br/>executeScript 注入"]
    SEND_CANVAS -->|"dispatchEvent"| CANVAS_EVENT["自定义事件<br/>Zn → 画布接收"]
    COPY_URL -->|"clipboard"| CLIPBOARD["navigator.clipboard"]
    DOWNLOAD -->|"a.click()"| DOWNLOAD_FILE["创建临时 a 标签下载"]
    SYNC_LOCAL -->|"Oi()"| RESCAN
    FAV_TOGGLE -->|"mi()"| API_CALL
    FAV_TOGGLE --> REFRESH
    DELETE -->|"wv()"| API_CALL
    DELETE --> REFRESH
    CLEAR -->|"hi()"| CLEAR_API["POST /api/resources/clear<br/>deleteFiles: true"]
    CLEAR --> REFRESH
    NEW_FOLDER -->|"mkdir"| API_CALL
    NEW_FOLDER --> REFRESH
    OPEN_DIR -->|"explorer"| SHELL_CMD["execSync explorer"]
    FULLSCREEN -->|"setFullscreenResource"| FULLSCREEN_VIEW["全屏遮罩层<br/>图片/视频预览"]
    SEND_JIANYING -->|"Yn()"| JIANYING_API["/api/jianying/send"]
```

---

## 13. 配置同步与持久化

配置项的保存、加载、同步链。

```mermaid
flowchart TB
    subgraph STORAGE["存储管理器 Q"]
        Q_GET["get(key)"]
        Q_SET["set(key, value)"]
        Q_SET_OBJECT["setObject(key, value)"]
        Q_GET_OBJECT["getObject(key)"]
        SYNC["syncToLocalTool(key)"]
        SYNC_ALL["syncAllToLocalTool()"]
        HAS["hasLocalData()"]
    end

    subgraph BACKENDS["后端存储"]
        WR["localToolEngine<br/>window.localTool<br/>getKV / saveKV"]
        MR["chromeStorageEngine<br/>chrome.storage.local<br/>get / set"]
        NR["localStorageEngine<br/>localStorage<br/>getItem / setItem"]
        PR["localforageEngine<br/>localforage (IndexedDB)<br/>getItem / setItem"]
    end

    subgraph STRATEGY["读取策略"]
        S1["1. chrome.storage.local 优先<br/>for 实时同步数据"]
        S2["2. localforage (IndexedDB)<br/>for 大体积画布数据"]
        S3["3. localStorage 兜底<br/>for 旧版兼容"]
        S4["4. localTool KV 优先<br/>for 持久化配置"]
    end

    subgraph CONFIG_ITEMS["配置项"]
        C1["app_settings<br/>默认模型/端口/网格"]
        C2["api_configs<br/>API 端点/密钥"]
        C3["users<br/>用户列表"]
        C4["projects<br/>项目列表"]
        C5["presetPrompts<br/>预设提示词"]
        C6["customNodeTemplates<br/>自定义节点模板"]
        C7["modelSchedules<br/>模型调度"]
        C8["cloud_storage_config<br/>云存储配置"]
        C9["canvas-state-v1-{id}<br/>画布完整数据"]
    end

    subgraph SYNC_FLOW["同步到本地引擎流程"]
        INIT["页面加载后<br/>setTimeout 1s"]
        SAVE["逐个保存到 KV<br/>Q.setObject(key, value)"]
        CHECK["验证保存结果"]
        DONE["完成"]
    end

    Q_GET --> WR
    Q_GET --> MR
    Q_GET --> NR
    Q_GET --> PR
    Q_SET --> WR
    Q_SET_OBJECT --> WR
    Q_GET_OBJECT --> WR
    SYNC -->|"检查优先级"| S1
    SYNC -->|"检查优先级"| S2
    SYNC -->|"检查优先级"| S3
    SYNC --> WR
    SYNC_ALL --> INIT
    INIT --> SAVE
    SAVE --> CHECK
    CHECK --> DONE

    WR -.->|"优先"| CONFIG_ITEMS
    MR -.->|"transitResources"| CONFIG_ITEMS
    PR -.->|"canvas-state"| CONFIG_ITEMS
```

---

## 14. GAS 云同步流程

通过 Google Apps Script 实现的云端同步机制。

```mermaid
flowchart TB
    subgraph UI["用户操作"]
        PUSH_BTN["「推送到云端」按钮"]
        PULL_BTN["「从云端拉取」按钮"]
    end

    subgraph SYNC_ENGINE["CloudSyncEngine (L43760)"]
        INIT_ENGINE["new CloudSyncEngine(gasUrl)"]
        PUSH["push(dataObj, onProgress, onSuccess, onError)"]
        PULL["pull(onProgress, onSuccess, onError)"]
        CALL_GW["callGateway(action, data)"]
        BUSY_LOCK["isSyncing 锁<br/>防止并发"]
    end

    subgraph DATA["同步的数据"]
        D1["app_settings"]
        D2["api_configs"]
        D3["users"]
        D4["membership"]
        D5["projects"]
        D6["presetPrompts"]
        D7["customNodeTemplates"]
        D8["modelSchedules"]
        D9["cloud_storage_config"]
    end

    subgraph NETWORK["网络请求"]
        URL["GAS 部署 URL<br/>config.js 配置"]
        POST["POST 请求<br/>Content-Type: text/plain"]
        BODY["JSON 编码<br/>{action, data}"]
        CHECK_HTML{"返回含 <html>?"}
        PARSE["JSON.parse(text)"]
    end

    subgraph ERRORS["错误处理"]
        ERR1["权限拦截<br/>GAS 未设「所有人」访问"]
        ERR2["网络错误<br/>fetch 失败"]
        ERR3["解析错误<br/>JSON 格式异常"]
        ERR4["业务错误<br/>GAS 返回 error 字段"]
    end

    PUSH_BTN -->|"点击"| ei["ei() 函数"]
    PULL_BTN -->|"点击"| ti["ti() 函数"]

    ei --> COLLECT["收集所有配置数据<br/>for 循环 getObject"]
    COLLECT -->|"有数据"| PUSH
    COLLECT -->|"无数据"| EMPTY["Toast: 无可同步数据"]

    PUSH --> CALL_GW
    CALL_GW --> POST
    POST --> BODY
    BODY --> URL
    URL --> CHECK_HTML
    CHECK_HTML -->|"是"| ERR1
    CHECK_HTML -->|"否"| PARSE

    ti --> CALL_GW_CALL["callGateway('pull_data')"]
    CALL_GW_CALL --> POST
    POST --> PARSE
    PARSE -->|"成功"| RESTORE["恢复数据到本地<br/>逐个 setObject"]
    PARSE -->|"GAS 返回 error"| ERR4

    RESTORE -->|"完成"| DONE_MSG["Toast: 同步成功"]
    ERR1 --> ERR_MSG["Toast: 权限拦截"]
    ERR2 --> ERR_MSG2["Toast: 网络错误"]
    ERR4 --> ERR_MSG3["Toast: 同步失败"]

    style SYNC_ENGINE fill:#1a1a2e,stroke:#e94560,color:#fff
    style DATA fill:#0f3460,stroke:#53d8fb,color:#fff
    style NETWORK fill:#16213e,stroke:#f5a623,color:#fff
    style ERRORS fill:#3d0000,stroke:#ff4444,color:#fff
```

---

## 附录：关键代码位置速查

| 功能 | 文件 | 行号 |
|------|------|------|
| 资源面板组件 Qn | App.js | L169 |
| Rescan 函数 Ev() | App.js | L42804 |
| 同步到本地 Oi() | App.js | L44322 |
| 统一同步 effect | App.js | L44246 |
| 资源数据加载 xv() | App.js | L42742 |
| 资源保存 Sv() | App.js | L42759 |
| 右键采集消息处理 | App.js | L43436 |
| 生图主回调 Jn | App.js | ~L32731 |
| 生图任务轮询 | App.js | L32910 |
| 存储键 Z | App.js | L1260 |
| 本地存储引擎 wr | App.js | L1297 |
| Chrome 存储引擎 Mr | App.js | L1364 |
| GAS 云同步引擎 | App.js | L43760 |
| localTool 入口 | localTool/src/index.ts | L1 |
| 文件操作路由 | localTool/src/routes/files.ts | L1 |
| 资源路由 | localTool/src/routes/resources.ts | L1 |
| 任务路由 | localTool/src/routes/tasks.ts | L1 |
| 数据库初始化 | localTool/src/db/database.ts | L1 |
| 网关入口 | apimart-gateway/main.py | L1 |
| 字段兼容映射 | apimart-gateway/main.py | L687 |
| 任务轮询 | apimart-gateway/main.py | L783 |
| 配置层 | src/_engine/config.js | L1 |
| Service Worker | src/background.ts | L1 |
| 扩展入口 | src/main.tsx | L1 |
| 画布节点渲染 | App.js | ~L37050 |
| 画布 onDrop | App.js | L36215 |
| 画布 onDragOver | App.js | L36212 |
| 图片编辑 (inpaint/outpaint) | App.js | ~L32731 |
| 用户余额/积分检查 | App.js | L15323 |
| 错误消息分类 | App.js | L31127 |
| 剪映发送 route | localTool/src/routes/system.ts | L159 |
| 网关编辑路由 | apimart-gateway/main.py | L595 |
| 网关音乐路由 (501) | apimart-gateway/main.py | L655 |
| 网关余额查询 | apimart-gateway/main.py | L922 |
| 数据库 initTables | localTool/src/db/database.ts | L59 |
| 应用入口 | src/main.tsx | L1 |
| AppShell 外壳 | src/v2/AppShell.tsx | L1 |
| canvasStore | src/v2/stores/canvasStore.ts | L1 |
| resourceStore | src/v2/stores/resourceStore.ts | L1 |
| taskStore | src/v2/stores/taskStore.ts | L1 |
| uiStore | src/v2/stores/uiStore.ts | L1 |
| projectStore | src/v2/stores/projectStore.ts | L1 |
| accountStore | src/v2/stores/accountStore.ts | L1 |

---

## 15. 画布拖放交互流（交叉点）

从资源面板/任务清单/外部文件拖入画布的数据流，这是**资源→画布**的核心交叉点。

```mermaid
flowchart TB
    DRAG_SOURCE{{"拖拽来源"}}

    DRAG_SOURCE --> PANEL["资源面板<br/>拖拽资源项"]
    DRAG_SOURCE --> TASK_CENTER["任务清单<br/>拖拽历史任务"]
    DRAG_SOURCE --> FILE_SYSTEM["外部文件<br/>从系统拖入"]
    DRAG_SOURCE --> TEMPLATE["模板节点<br/>从模板库拖入"]

    subgraph CANVAS_DROP["画布 onDrop (Lr, L36215)"]
        PREVENT["preventDefault()"]
        GET_POS["screenToFlowPosition<br/>we({clientX, clientY})"]
        READ_DATA["read dataTransfer"]
        CHECK_TEMPLATE{"application/x-yimao-template<br/>包含 graphData?"}
        CHECK_TASK{"application/x-mutiwindow-task<br/>存在 url?"}
        CHECK_FILES{"dataTransfer.files.length > 0?"}
        CHECK_TYPE{"文件类型?"}
        TEXT_AS_TEXT["text/plain → textNode<br/>readAsText()"]
        FILE_UPLOAD["ii() uploadFile<br/>subfolder: canvas/drop<br/>preferThumbnail: true"]
        CREATE_NODE["Z(type, pos, data)<br/>创建节点并添加到画布"]
    end

    subgraph NODE_CREATION["节点创建 (Z)"]
        GEN_ID["生成唯一 id<br/>Date.now() + random"]
        NEW_NODE["{id, type, position, data}"]
        ADD_TO_NODES["setNodes(prev => [...prev, newNode])"]
        SAVE_CANVAS["localforage 持久化"]
    end

    subgraph TYPE_DISPATCH["节点类型分发"]
        IMAGE["imageNode<br/>imageUrl: 本地路径"]
        VIDEO["discountVideoNode<br/>videoUrl"]
        AUDIO["audioPlayerNode<br/>audioUrl"]
        TEXT["textNode<br/>text: 内容"]
        TEMPLATE_NODE["sn.current()<br/>批量导入模板节点"]
    end

    PANEL -->|"dragStart 设置 dataTransfer"| CANVAS_DROP
    TASK_CENTER -->|"拖动任务"| CANVAS_DROP
    FILE_SYSTEM -->|"拖动文件"| CANVAS_DROP
    TEMPLATE -->|"拖动模板"| CANVAS_DROP

    READ_DATA --> CHECK_TEMPLATE
    CHECK_TEMPLATE -->|"是"| TEMPLATE_NODE
    CHECK_TEMPLATE -->|"否"| CHECK_TASK
    CHECK_TASK -->|"是"| TYPE_DISPATCH
    CHECK_TASK -->|"否"| CHECK_FILES
    CHECK_FILES -->|"是"| CHECK_TYPE
    CHECK_FILES -->|"否"| END(["无处理"])

    CHECK_TYPE -->|"文本"| TEXT_AS_TEXT
    CHECK_TYPE -->|"图片/视频/音频"| FILE_UPLOAD
    TEXT_AS_TEXT --> CREATE_NODE
    FILE_UPLOAD -->|"返回 url"| TYPE_DISPATCH
    TYPE_DISPATCH --> CREATE_NODE
    TEMPLATE_NODE --> CREATE_NODE

    CREATE_NODE --> GEN_ID
    GEN_ID --> NEW_NODE
    NEW_NODE --> ADD_TO_NODES
    ADD_TO_NODES --> SAVE_CANVAS
```

---

## 16. 启动初始化流程（交叉点）

页面加载时涉及**存储引擎→配置同步→状态恢复→画布渲染**的完整启动链。

```mermaid
flowchart TB
    START(["用户打开侧边栏/扩展<br/>https://yimao.ai/"])

    subgraph BOOTSTRAP["bootstrap() (main.tsx)"]
        ROOT["获取 #root 元素"]
        C_ROOT["createRoot(root)"]
        RENDER["render(<ErrorBoundary><App />)"]
        LAZY["React.lazy import App.js"]
    end

    subgraph INIT["App.js 初始化"]
        INIT_ENGINE["初始化存储管理器 Q<br/>选择后端引擎"]
        CHECK_LOCAL{"localTool 在线?"}
        CONNECT_WS["建立 WebSocket 连接<br/>n.status.port"]
        LOAD_CONFIG["Q.getObject()<br/>加载 app_settings<br/>api_configs / users"]
        SYNC_CONFIG["setTimeout 1s<br/>syncAllToLocalTool()<br/>把所有配置推送到 KV"]
        LOAD_PROJECT["加载项目列表<br/>切换当前项目"]
        LOAD_CANVAS["localforage.getItem()<br/>canvas-state-v1-{id}<br/>恢复节点/连线"]
        LOAD_TASKS["加载 globalTasks<br/>恢复未完成的任务"]
        LOAD_RESOURCES["xv() 加载资源列表<br/>we() rescan"]
        INIT_WS["onMessage/message 监听<br/>注册事件处理"]
    end

    subgraph ERROR_SUPPRESS["错误抑制"]
        RESIZE_OBSERVER["抑制<br/>ResizeObserver loop 错误"]
        CONSOLE_FILTER["console.error 过滤<br/>Non-Error promise rejection"]
        ERROR_EVENT["window.addEventListener<br/>error 事件拦截"]
    end

    subgraph READY["就绪状态"]
        SET_LOADING["loading = false"]
        RENDER_CANVAS["ReactFlow 画布渲染"]
        SHOW_UI["显示导航栏 + 面板"]
        STATUS_INDICATOR["引擎状态指示器<br/>绿色/红色"]
    end

    START --> BOOTSTRAP
    BOOTSTRAP --> ERROR_SUPPRESS
    ERROR_SUPPRESS --> RENDER

    RENDER --> LAZY
    LAZY --> INIT_ENGINE
    INIT_ENGINE --> CHECK_LOCAL
    CHECK_LOCAL -->|"在线"| CONNECT_WS
    CHECK_LOCAL -->|"离线"| OFFLINE(["离线模式<br/>功能受限"])
    CONNECT_WS --> LOAD_CONFIG
    LOAD_CONFIG --> SYNC_CONFIG
    SYNC_CONFIG --> LOAD_PROJECT
    LOAD_PROJECT --> LOAD_CANVAS
    LOAD_CANVAS --> LOAD_TASKS
    LOAD_TASKS --> LOAD_RESOURCES
    LOAD_RESOURCES --> INIT_WS

    INIT_WS --> READY
    READY --> SET_LOADING
    SET_LOADING --> RENDER_CANVAS
    RENDER_CANVAS --> SHOW_UI
    SHOW_UI --> STATUS_INDICATOR
```

---

## 17. 前端 Zustand 状态管理关系

V2 前端六个 store 之间的关系和依赖链。

```mermaid
flowchart TB
    subgraph STORES["Zustand Stores (src/v2/stores/)"]
        CS[canvasStore<br/>节点 / 边 / 视口<br/>onNodesChange / onEdgesChange / onConnect]
        RS[resourceStore<br/>资源列表 / 过滤 / 加载状态]
        TS[taskStore<br/>任务列表 / 状态 / 轮询]
        US[uiStore<br/>Tab 切换 / 菜单 / 对话框]
        PS[projectStore<br/>项目列表 / 切换 / CRUD]
        AS[accountStore<br/>多开账号 / 加载状态]
    end

    subgraph DEPENDENCIES["依赖关系"]
        CANVAS_NEEDS_RESOURCE["画布从资源面板拖入<br/>→ canvasStore.addNode"]
        RESOURCE_NEEDS_TASK["生成完成 → 写入资源<br/>→ resourceStore.refresh"]
        UI_NEEDS_CANVAS["Tab 切换: canvas/transit/settings<br/>→ canvasStore 显示/隐藏"]
        PROJECT_NEEDS_TASK["切换项目 → 加载画布<br/>→ taskStore.reset"]
        PROJECT_NEEDS_RESOURCE["切换项目 → 加载资源<br/>→ resourceStore.load"]
        ACCOUNT_NEEDS_CONFIG["多开账号 → 配置同步<br/>→ 存储管理器 Q"]
    end

    subgraph COMPONENTS["消费组件"]
        C1[CanvasPanel<br/>画布主体]
        C2[ResourcePanel<br/>资源面板]
        C3[TaskCenter<br/>任务中心]
        C4[AppShell<br/>应用外壳]
        C5[SettingsPanel<br/>设置面板]
        C6[AccountManager<br/>多开管理]
    end

    C1 --> CS
    C1 --> US
    C2 --> RS
    C2 --> US
    C3 --> TS
    C4 --> US
    C4 --> PS
    C5 --> PS
    C6 --> AS

    CS -.-> CANVAS_NEEDS_RESOURCE
    RS -.-> RESOURCE_NEEDS_TASK
    US -.-> UI_NEEDS_CANVAS
    PS -.-> PROJECT_NEEDS_TASK
    PS -.-> PROJECT_NEEDS_RESOURCE
    AS -.-> ACCOUNT_NEEDS_CONFIG

    CANVAS_NEEDS_RESOURCE -.-> RS
    RESOURCE_NEEDS_TASK -.-> TS
    UI_NEEDS_CANVAS -.-> CS
    PROJECT_NEEDS_TASK -.-> TS
    PROJECT_NEEDS_RESOURCE -.-> RS
```

---

## 18. 图片编辑流程 (Inpaint/Outpaint)

与普通 AI 生成不同的特殊流程——需要上传额外图片数据。

```mermaid
flowchart TB
    USER([用户选择图片编辑<br/>橡皮擦 / 裁切 / 扩图])

    subgraph FRONT["前端 App.js"]
        EDIT_NODE["编辑节点<br/>传递 image + mask"]
        FORM_DATA["j = new FormData()<br/>append image + mask<br/>+ prompt + model"]
        POST_EDIT["POST /v1/images/edits<br/>multipart/form-data"]
    end

    subgraph GATEWAY["apimart-gateway"]
        RECV_EDIT["接收 FormData"]
        READ_FILES["读取 image 文件<br/>读取 mask 文件"]
        UPLOAD_REF["client.upload_file()<br/>上传到 Lovart"]
        BODY["构建 body<br/>{prompt, model, size, images: [urls]}"]
        SUBMIT_EDIT["_do_submit(body, IMAGE)"]
    end

    subgraph LOVART["Lovart AI"]
        RECV_IMAGES["接收参考图片"]
        PROCESS["AI 编辑处理<br/>inpaint/outpaint"]
        RETURN["返回结果图片"]
    end

    subgraph RESULT["结果处理"]
        SYNC_EDIT["同步解析/轮询"]
        PARSE_EDIT["解析 images[]"]
        LOCALIZE_EDIT["下载到本地"]
        UPDATE_NODE_EDIT["回填节点"]
    end

    EDIT_NODE --> FORM_DATA
    FORM_DATA --> POST_EDIT
    POST_EDIT --> RECV_EDIT
    RECV_EDIT --> READ_FILES
    READ_FILES --> UPLOAD_REF
    UPLOAD_REF --> BODY
    BODY --> SUBMIT_EDIT
    SUBMIT_EDIT --> RECV_IMAGES
    RECV_IMAGES --> PROCESS
    PROCESS --> RETURN
    RETURN --> SYNC_EDIT
    SYNC_EDIT --> PARSE_EDIT
    PARSE_EDIT --> LOCALIZE_EDIT
    LOCALIZE_EDIT --> UPDATE_NODE_EDIT
```

---

## 19. 用户余额/积分检查流程

AI 生成前的配额检查，以及错误响应中的余额处理。

```mermaid
flowchart TB
    USER_GEN([用户点击生成按钮])

    CHECK_QUOTA{"检查余额"}

    subgraph GATEWAY_CHECK["网关余额检查"]
        GET_BALANCE["GET /v1/balance"]
        QUERY_MODE["client.query_mode()"]
        CHECK_UNLIMITED{"unlimited?"}
        RETURN_BALANCE["返回 {balance, unlimited}"]
    end

    subgraph FRONT_CHECK["前端余额检查"]
        PRE_DEDUCT["检查 preDeducted<br/>预扣费金额"]
        CHECK_402{"HTTP 402?"}
        CHECK_403{"HTTP 403?"}
        SHOW_BALANCE["Toast: 特惠币余额不足"]
        SHOW_VIP["Toast: 需要 VIP 会员"]
        BLOCK_GEN["阻止生成流程"]
    end

    subgraph GEN_FLOW["正常生成流程"]
        SUBMIT["提交生成请求"]
        POLL["轮询任务"]
        HANDLE_ERROR{"错误消息匹配?"}
        CLASSIFY["分类错误<br/>余额/算力/额度/审核"]
        SHOW_ERROR["Toast: 具体错误消息"]
    end

    USER_GEN --> CHECK_QUOTA
    CHECK_QUOTA -->|"前端预检"| GET_BALANCE
    GET_BALANCE --> QUERY_MODE
    QUERY_MODE --> CHECK_UNLIMITED
    CHECK_UNLIMITED -->|"是"| RETURN_BALANCE
    CHECK_UNLIMITED -->|"否"| RETURN_BALANCE
    RETURN_BALANCE -->|"余额不足"| SHOW_BALANCE
    RETURN_BALANCE -->|"需要VIP"| SHOW_VIP
    SHOW_BALANCE --> BLOCK_GEN
    SHOW_VIP --> BLOCK_GEN

    CHECK_QUOTA -->|"通过"| GEN_FLOW
    SUBMIT -->|"响应 402/403"| CHECK_402
    SUBMIT -->|"响应 402/403"| CHECK_403
    CHECK_402 -->|"是"| SHOW_BALANCE
    CHECK_403 -->|"是"| SHOW_VIP

    POLL --> HANDLE_ERROR
    HANDLE_ERROR -->|"匹配余额/审核"| CLASSIFY
    CLASSIFY --> SHOW_ERROR
    HANDLE_ERROR -->|"不匹配"| GENERIC_ERROR(["通用错误处理"])
```

---

## 20. 错误处理与分级回退

系统中各层级的错误处理机制和回退策略。

```mermaid
flowchart TB
    subgraph LAYER1["L1: React 错误边界"]
        EB[ErrorBoundary 组件<br/>src/v2/components/ErrorBoundary.tsx]
        CATCH["catch(error, errorInfo)"]
        SHOW_FALLBACK["显示降级 UI<br/>错误信息 + 重试按钮"]
        RECOVER["点击重试 → remount"]
    end

    subgraph LAYER2["L2: fetch/网络错误"]
        FETCH_ERR["fetch 调用失败"]
        RETRY{"重试策略?"}
        RETRY_3["重试 3 次<br/>每次间隔递增"]
        TIMEOUT["15min deadline 超时"]
        ABORT["AbortController 取消"]
        FALLBACK["回退到备用方案<br/>如 base64 兜底"]
    end

    subgraph LAYER3["L3: 业务逻辑错误"]
        ERR_402["HTTP 402 余额不足"]
        ERR_403["HTTP 403 权限不足"]
        ERR_404["网关 404<br/>＝ 无害噪音"]
        ERR_500["网关 500 服务器错误"]
        WS_ERR["WebSocket 断连"]
        LOCAL_ERR["localTool 离线"]
    end

    subgraph LAYER4["L4: 控制台噪音抑制"]
        RESIZE["ResizeObserver loop<br/>→ silent ignore"]
        ROOT_ERR["RootErrorBoundary<br/>useState null → 无害噪音"]
        PORT_ERR["18080 连不上<br/>→ 状态指示器变红"]
        PROMISE["Non-Error promise rejection<br/>→ silent ignore"]
    end

    subgraph RECOVERY["恢复策略"]
        AUTO_RECONNECT["WebSocket 自动重连"]
        RELOAD["手动刷新页面"]
        RETRY_GEN["重新生成"]
        SWITCH_ENGINE["切换引擎<br/>localTool ↔ 远程"]
        CONSOLE_WARN["console.warn 记录"]
        TOAST["Toast 提示用户"]
    end

    LAYER1 --> CATCH
    CATCH --> SHOW_FALLBACK
    SHOW_FALLBACK --> RECOVER

    LAYER2 --> FETCH_ERR
    FETCH_ERR --> RETRY
    RETRY -->|"超时"| TIMEOUT
    RETRY -->|"取消"| ABORT
    TIMEOUT --> TOAST
    ABORT --> TOAST

    LAYER3 --> ERR_402
    LAYER3 --> ERR_403
    LAYER3 --> ERR_404
    LAYER3 --> ERR_500
    LAYER3 --> WS_ERR
    LAYER3 --> LOCAL_ERR
    ERR_402 --> TOAST
    ERR_403 --> TOAST
    ERR_404 --> CONSOLE_WARN
    ERR_500 --> RETRY
    WS_ERR --> AUTO_RECONNECT
    LOCAL_ERR --> STATUS_IND["状态指示器变红"]

    LAYER4 --> RESIZE
    LAYER4 --> ROOT_ERR
    LAYER4 --> PORT_ERR
    LAYER4 --> PROMISE
    RESIZE -->|"silent"| SKIP(["跳过"])
    ROOT_ERR -->|"silent"| SKIP
    PORT_ERR --> STATUS_IND
    PROMISE -->|"silent"| SKIP
```

---

## 21. 剪映素材发送流程（交叉点）

资源面板 → 剪映的跨应用数据流。

```mermaid
flowchart TB
    USER_SEND([用户在资源面板<br/>选择「发送到剪映」])

    subgraph FRONT["前端 App.js"]
        YN["Yn 组件<br/>显示发送按钮"]
        SELECT["选择资源项<br/>勾选或单资源"]
        CLICK_SEND["点击发送"]
        BUILD_REQ["构建请求体<br/>{fileUrl, localPath, fileName}<br/>或 {items: [...]}"]
        POST_JY["POST /api/jianying/send"]
    end

    subgraph LOCAL["localTool"]
        RECV_JY["handleJianyingSend()"]
        PARSE_BODY["解析 JSON body"]
        CHECK_FORM{"items 数组?"}
        BATCH_MODE["批量模式<br/>遍历 items 逐个处理"]
        SINGLE_MODE["单文件模式<br/>{fileUrl, localPath, fileName}"]
        LOG_SEND["console.log 记录日志"]
        RETURN_OK["返回 {status: 'ok', count, message}"]
    end

    USER_SEND --> YN
    YN --> SELECT
    SELECT --> CLICK_SEND
    CLICK_SEND --> BUILD_REQ
    BUILD_REQ --> POST_JY
    POST_JY --> RECV_JY
    RECV_JY --> PARSE_BODY
    PARSE_BODY --> CHECK_FORM
    CHECK_FORM -->|"是"| BATCH_MODE
    CHECK_FORM -->|"否"| SINGLE_MODE
    BATCH_MODE --> LOG_SEND
    SINGLE_MODE --> LOG_SEND
    LOG_SEND --> RETURN_OK

    subgraph LIMITATION["当前限制"]
        NOTE1["剪映集成是占位实现<br/>实际需要剪映插件 API"]
        NOTE2["仅记录日志，不真正发送"]
        NOTE3["剪映草稿目录对接<br/>需后续实现"]
    end

    RETURN_OK -.-> NOTE1
    NOTE1 -.-> NOTE2
    NOTE1 -.-> NOTE3
```

---

## 22. 文件拖拽/粘贴/导入全流程

外部文件进入系统的所有入口，以及各自的数据流路径。

```mermaid
flowchart TB
    ENTRY{{"文件进入方式"}}

    ENTRY --> RIGHT_CLICK["右键「发送到资源」<br/>→ chrome.storage.local<br/>→ 资源面板素材"]
    ENTRY --> DRAG_CANVAS["拖入画布<br/>→ ii() uploadFile<br/>→ canvas/drop/ 目录"]
    ENTRY --> DRAG_PANEL["拖入资源面板文件夹<br/>→ S.moveFile()<br/>→ 移动文件"]
    ENTRY --> PASTE["剪贴板粘贴<br/>→ gi() 处理<br/>→ 资源面板"]
    ENTRY --> IMPORT["文件选择对话框<br/>→ Or() onChange<br/>→ 上传到画布"]
    ENTRY --> GENERATED["AI 生成完成<br/>→ uploadFile()<br/>→ uploads/tasks/"]

    subgraph UPLOAD["ii() uploadFile 统一入口"]
        CHECK_TYPE_FILE{"是 File 对象?"}
        FORM_FILE["FormData 模式<br/>subfolder + filename + file"]
        URL_FILE["JSON 模式<br/>fetch 远程 URL<br/>下载到本地"]
        GEN_FILENAME["生成文件名<br/>{Date.now()}-{safeName}"]
        POST["POST /api/files/upload"]
        GET_RESP["返回 {url, path, thumbnailUrl}"]
        TRY_THUMB["tryGenerateThumbnail()<br/>图片类生成缩略图"]
    end

    subgraph DEST["文件去向"]
        TASKS["uploads/tasks/<br/>→ 生成产物"]
        MIGRATED["uploads/migrated/<br/>→ 采集素材"]
        CANVAS_DROP["uploads/canvas/drop/<br/>→ 拖入画布"]
        CANVAS_PASTE["uploads/canvas/paste/<br/>→ 粘贴导入"]
    end

    DRAG_CANVAS --> UPLOAD
    PASTE --> UPLOAD
    IMPORT --> UPLOAD
    GENERATED --> UPLOAD

    CHECK_TYPE_FILE -->|"File"| FORM_FILE
    CHECK_TYPE_FILE -->|"URL"| URL_FILE
    FORM_FILE --> GEN_FILENAME
    URL_FILE --> GEN_FILENAME
    GEN_FILENAME --> POST
    POST --> GET_RESP
    GET_RESP --> TRY_THUMB

    TRY_THUMB --> DEST
    RIGHT_CLICK -.->|"(只存元数据)"| MIGRATED
    DRAG_PANEL -.->|"移动文件"| MIGRATED
    GENERATED -->|"subfolder: tasks"| TASKS
    RIGHT_CLICK -.->|"实际文件未下载"| PENDING["(设计限制)"]
    DRAG_CANVAS -->|"subfolder: canvas/drop"| CANVAS_DROP
    PASTE -->|"subfolder: canvas/paste"| CANVAS_PASTE
    IMPORT -->|"subfolder: canvas/drop"| CANVAS_DROP
```

---

## 23. 节点类型注册与渲染分发

画布上 27 种节点类型的注册、渲染、数据流分发。

```mermaid
flowchart TB
    subgraph REGISTRATION["节点类型注册"]
        NODE_TYPES["nodeTypes (lg, ~L37055)"]
        TYPE_MAP["nodeTypes 映射表<br/>type → React Component"]
        DEFAULT_NODE["default: ImageNode<br/>作为默认回退类型"]
    end

    subgraph NODES["节点类型清单"]
        N1["imageNode<br/>图片显示/自动判类型"]
        N2["discountVideoNode<br/>视频播放"]
        N3["audioPlayerNode<br/>音频播放器"]
        N4["textNode<br/>文本编辑/显示"]
        N5["promptNode<br/>提示词输入"]
        N6["customNode<br/>自定义处理"]
        N7["groupNode<br/>节点分组容器"]
        N8["canvasNode<br/>画布嵌套"]
        N9["... 更多类型"]
    end

    subgraph RENDER["渲染管线"]
        RF_LOAD["ReactFlow 加载节点"]
        LOOKUP["根据 node.type 查找组件"]
        PASS_DATA["传递 node.data<br/>imageUrl / videoUrl / text"]
        FALLBACK["未匹配 → 默认 ImageNode"]
    end

    subgraph DATA_UPDATE["数据更新"]
        CHANGE_NODE["onNodesChange<br/>位置/选择/删除"]
        UPD_DATA["setNodes(nds =><br/>nds.map(n => ...))"]
        RE_RENDER["React 重渲染"]
        PERSIST["localforage 持久化<br/>全量保存"]
    end

    subgraph SPECIAL["特殊处理"]
        IMAGE_AUTO["ImageNode 自动判断类型<br/>根据 url 后缀<br/>.mp4 → 视频<br/>.mp3 → 音频<br/>图片 → 图片"]
        PROMPT_GEN["PromptNode 生成触发<br/>→ Jn 回调"]
        CUSTOM_IO["自定义节点输入/输出<br/>Handle 连接处理"]
    end

    NODE_TYPES --> TYPE_MAP
    TYPE_MAP --> N1
    TYPE_MAP --> N2
    TYPE_MAP --> N3
    TYPE_MAP --> N4
    TYPE_MAP --> N5
    TYPE_MAP --> N6
    TYPE_MAP --> N7
    TYPE_MAP --> N8

    RF_LOAD --> LOOKUP
    LOOKUP -->|"匹配"| PASS_DATA
    LOOKUP -->|"不匹配"| FALLBACK
    PASS_DATA --> RENDER_NODE(["渲染节点组件"])
    FALLBACK --> RENDER_NODE

    RENDER_NODE --> CHANGE_NODE
    CHANGE_NODE --> UPD_DATA
    UPD_DATA --> RE_RENDER
    RE_RENDER --> PERSIST

    N1 --> IMAGE_AUTO
    N5 --> PROMPT_GEN
    N6 --> CUSTOM_IO
```

---

## 24. localTool 内部路由分发

localTool 服务的完整请求处理链路。

```mermaid
flowchart TB
    REQ(["HTTP 请求 :18080"])

    SUB_CORS["CORS 预检<br/>OPTIONS → 204"]

    ROUTE{"路由匹配"}

    REQ --> CORS["Access-Control-Allow-Origin: *"]
    CORS --> ROUTE

    ROUTE -->|"GET /api/status"| SYS_STATUS["handleStatus<br/>返回 {version, uptime, dbSize, uploadCount}"]
    ROUTE -->|"GET /api/kv/get"| KV_GET["handleKvGet<br/>SELECT key, value FROM kv"]
    ROUTE -->|"POST /api/kv/set"| KV_SET["handleKvSet<br/>INSERT OR REPLACE INTO kv"]
    ROUTE -->|"POST /api/files/upload"| FILE_UPLOAD["handleUpload<br/>saveFile + tryGenerateThumbnail"]
    ROUTE -->|"GET /api/files/read"| FILE_READ["handleRead<br/>fs.readFileSync"]
    ROUTE -->|"GET /api/files/thumbnail"| FILE_THUMB["handleThumbnail<br/>生成缩略图 JSON"]
    ROUTE -->|"POST /api/files/mkdir"| FILE_MKDIR["handleMkdir<br/>fs.mkdirSync"]
    ROUTE -->|"POST /api/files/move"| FILE_MOVE["handleMove<br/>fs.renameSync"]
    ROUTE -->|"GET /api/files/open"| FILE_OPEN["handleOpen<br/>execSync explorer"]
    ROUTE -->|"GET /api/files/open-dir"| FILE_OPEN_DIR["handleOpenDir<br/>打开目录"]
    ROUTE -->|"GET /api/files/list"| FILE_LIST["handleList<br/>readdir"]
    ROUTE -->|"GET /api/tasks"| TASKS_GET["handleTasksGet<br/>SELECT FROM tasks"]
    ROUTE -->|"POST /api/tasks/save"| TASKS_SAVE["handleTasksSave<br/>INSERT OR REPLACE"]
    ROUTE -->|"POST /api/tasks/delete"| TASKS_DEL["handleTasksDelete<br/>DELETE"]
    ROUTE -->|"POST /api/tasks/clear"| TASKS_CLEAR["handleTasksClear<br/>DELETE FROM tasks"]
    ROUTE -->|"GET /api/resources"| RES_GET["handleResourcesGet<br/>SQL 查询 + 过滤"]
    ROUTE -->|"POST /api/resources/save"| RES_SAVE["handleResourcesSave<br/>INSERT OR REPLACE"]
    ROUTE -->|"POST /api/resources/delete"| RES_DEL["handleResourcesDelete<br/>DELETE"]
    ROUTE -->|"POST /api/resources/clear"| RES_CLEAR["handleResourcesClear<br/>可选删除文件"]
    ROUTE -->|"POST /api/resources/rescan"| RES_RESCAN["handleResourcesRescan<br/>扫描磁盘→入库"]
    ROUTE -->|"POST /api/proxy"| PROXY["handleProxy<br/>代理转发 HTTP"]
    ROUTE -->|"POST /api/jianying/send"| JY_SEND["handleJianyingSend<br/>剪映发送"]
    ROUTE -->|"GET /files/*"| STATIC["handleStaticFile<br/>静态文件服务<br/>MIME + Cache-Control"]
    ROUTE -->|"未匹配"| NOT_FOUND["sendError 404"]

    subgraph DB["SQLite 操作"]
        SAVE_DB["saveDb()<br/>导出 buffer → 写文件"]
        CLOSE_DB["closeDb()<br/>saveDb + close"]
    end

    KV_SET --> SAVE_DB
    TASKS_SAVE --> SAVE_DB
    TASKS_DEL --> SAVE_DB
    RES_SAVE --> SAVE_DB
    RES_DEL --> SAVE_DB
    RES_CLEAR --> SAVE_DB
```

---

## 25. 前端事件总线

前端自定义事件的分发网络，用于模块间解耦通信。

```mermaid
flowchart TB
    subgraph EVENTS["自定义事件 (dispatchEvent / addEventListener)"]
        E1["mutiwindow-task-completed<br/>任务完成 → 资源面板刷新"]
        E2["mutiwindow-sync-local<br/>同步到本地引擎"]
        E3["import-project<br/>导入项目文件"]
        E4["export-project<br/>导出项目文件"]
        E5["resourceAdded<br/>新资源采集通知"]
        E6["canvas-state-change<br/>画布状态变更"]
    end

    subgraph SOURCE["事件源"]
        S1["统一同步 effect<br/>上传完成后触发"]
        S2["资源面板<br/>同步到本地按钮"]
        S3["AppShell 项目选择器<br/>导入/导出按钮"]
        S4["background.ts<br/>右键采集发送"]
        S5["ReactFlow 状态变更<br/>onNodesChange"]
    end

    subgraph HANDLER["事件处理"]
        H1["Ev() rescan<br/>+ 刷新资源面板"]
        H2["we() rescanSync<br/>+ 刷新列表"]
        H3["window.dispatchEvent<br/>→ 触发文件选择器"]
        H4["ue() 更新 transitItems<br/>+ 刷新面板"]
        H5["localforage 自动保存<br/>→ 持久化画布"]
    end

    subgraph CHAIN["连锁反应"]
        C1["E1 → H1 → 资源面板刷新 → 用户看到新资源"]
        C2["E2 → H2 → 扫描磁盘 → 资源列表更新"]
        C3["E3 → 文件选择 → 导入 → 画布加载"]
        C4["E4 → 文件保存 → 导出 → 下载文件"]
        C5["E5 → H4 → 素材 Tab 更新 → 显示新素材"]
        C6["E6 → H5 → 持久化 → 下次启动恢复"]
    end

    S1 --> E1
    S2 --> E2
    S3 --> E3
    S3 --> E4
    S4 --> E5
    S5 --> E6
    E1 --> H1
    E2 --> H2
    E3 --> H3
    E4 --> FILE_EXPORT["文件保存对话框"]
    E5 --> H4
    E6 --> H5

    H1 --> C1
    H2 --> C2
    H3 --> C3
    FILE_EXPORT --> C4
    H4 --> C5
    H5 --> C6
```

---

## 26. 多开账号管理流程

原版多账号登录、切换、使用的数据流。

```mermaid
flowchart TB
    subgraph UI["账号管理面板"]
        ADD_BTN["添加账号按钮"]
        ACCOUNT_LIST["账号列表<br/>头像/名称/状态"]
        SWITCH_BTN["切换账号"]
        DELETE_BTN["删除账号"]
        LOGIN_FORM["登录表单<br/>邮箱/密码"]
    end

    subgraph LOGIC["登录逻辑"]
        Oa["Oa() 登录函数<br/>L3511"]
        POST_LOGIN["POST 登录接口<br/>到网关/远程"]
        GET_TOKEN["获取 auth_token"]
        SAVE_ACCOUNT["保存到 users KV<br/>{id, name, email, token}"]
        SET_ACTIVE["设置当前活跃账号"]
        REFRESH["刷新界面状态"]
    end

    subgraph STORAGE["存储"]
        KV_USERS["KV users<br/>账号列表 JSON"]
        KV_MEMBERSHIP["KV membership<br/>会员信息"]
        LOCAL_TOKEN["localStorage<br/>auth_token"]
    end

    subgraph SWITCH["切换流程"]
        CLICK_SWITCH["点击切换账号"]
        SET_TOKEN["更新 localStorage<br/>auth_token"]
        NOTIFY["通知各模块<br/>账号已变更"]
        RELOAD["刷新 API 调用<br/>携带新 token"]
    end

    subgraph MULTI_ACCOUNT["账号复用"]
        API_GATEWAY["网关识别用户<br/>USER_KEYS 环境变量"]
        KEY_MAP["{email: {ak, sk}}<br/>映射到 Lovart 密钥"]
        DIRECT["每个账号独立请求<br/>独立计费"]
    end

    ADD_BTN --> LOGIN_FORM
    LOGIN_FORM --> Oa
    Oa --> POST_LOGIN
    POST_LOGIN --> GET_TOKEN
    GET_TOKEN --> SAVE_ACCOUNT
    SAVE_ACCOUNT --> KV_USERS
    SAVE_ACCOUNT --> LOCAL_TOKEN
    SAVE_ACCOUNT --> SET_ACTIVE
    SET_ACTIVE --> REFRESH
    ACCOUNT_LIST --> SWITCH_BTN
    SWITCH_BTN --> CLICK_SWITCH
    CLICK_SWITCH --> SET_TOKEN
    SET_TOKEN --> NOTIFY
    NOTIFY --> RELOAD
    DELETE_BTN --> REMOVE["从 KV 删除"]
    KV_USERS -.->|"网关读取"| API_GATEWAY
    API_GATEWAY --> KEY_MAP
    KEY_MAP --> DIRECT
```

---

## 27. 性能优化策略

系统在不同场景下的性能优化手段。

```mermaid
flowchart TB
    subgraph CANVAS_PERF["画布性能优化"]
        P1["onlyRenderVisibleElements<br/>节点 > 20 时启用"]
        P2["viewport-moving.pan-performance-mode<br/>移动时隐藏边动画"]
        P3["is-large-canvas 样式<br/>节点 > 300 时降低透明度"]
        P4["节点懒加载<br/>loading='lazy' / decoding='async'"]
        P5["缩略图代替原图<br/>480px 缩略图显示"]
        P6["图片/视频隐藏<br/>低缩放级别隐藏大图"]
    end

    subgraph STORAGE_PERF["存储性能优化"]
        S1["transitResources 最多 5 条<br/>防 OOM"]
        S2["TASK_RESULT_TTL 86400s<br/>自动清理过期任务"]
        S3["_TASK_META 500 条上限<br/>_cleanup_task_meta()"]
        S4["localforage 异步<br/>不阻塞主线程"]
        S5["缩略图缓存<br/>uploads/.thumbnails/"]
    end

    subgraph NETWORK_PERF["网络性能优化"]
        N1["rescanThrottledSync<br/>3 秒节流防重复"]
        N2["轮询间隔 ≥ 3s<br/>退避上限 15s"]
        N3["Cache-Control<br/>max-age=31536000"]
        N4["WebSocket 长连接<br/>替代短轮询"]
        N5["AbortController<br/>及时取消无用请求"]
    end

    subgraph RENDER_PERF["渲染性能优化"]
        R1["React.memo 组件<br/>减少不必要的重渲染"]
        R2["Zustand selector<br/>精确订阅状态"]
        R3["zustand 自动 batching<br/>合并状态更新"]
        R4["CSS 动画 GPU 加速<br/>transform + opacity"]
    end

    CANVAS_PERF --- STORAGE_PERF
    STORAGE_PERF --- NETWORK_PERF
    NETWORK_PERF --- RENDER_PERF
```