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