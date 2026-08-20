# 画布 debug 法（前端消费层专属调试方法）

> **适用场景**：后端测试已绿（localTool / gateway 单测通过），但**前端 `src/` 用起来有 bug**——问题出在前端怎么消费后端：生成链路、契约字段、状态回填、刷新恢复、流式消费、节点 data 写回、管线与状态管理。
> **核心思路**：debug 的本质是**先画出链路全景，再标清每一跳的契约（数据结构）与边界**；链路清楚了，断点自然一眼可定位。本文件给出本项目主要链路的"地图 + 契约 + 断点",均来自真实代码取证（标注 `文件:行`）。
> **通用思考底座**：步进式、防绕圈、无日志不推演见 `排查5步法.md`（管"怎么想"）；本文件管"这个项目**链路长什么样、契约是什么**"。
> **最高优先铁律（CLAUDE §3.2 / §六.0）**：改前端 bug **第一步先开 debug 日志复现**,拿真实链路日志再定位,禁止没日志就翻代码猜根因改逻辑。

---

## 〇、第一步：开 debug 开关拿证据（所有 bug 都先这步）

- 全开：`.env` 加 `VITE_DEBUG_ALL=1`,或运行时 `window.__DEBUG_ALL = true`
- 单模块：`.env` 加 `VITE_DEBUG_<MODULE>=1`（`asset`/`agent`/`image`/`text`）,或 `window.__DEBUG_<MODULE>`
- 模块位集中在 `config.js` 的 `DEBUG_MODULES`（`config.js:37-49`）；新增模块在此登记,禁起散开关
- 日志默认只 console + 前端上报（带 `[frontend]` 前缀）,不上报后端（`logger.js:108`）

> 拿日志后若怀疑"后端到底返回了啥",用 `task-inspect` 对账（见末节）,**不要直接改后端逻辑**——本文件假定后端已绿。

---

## 一、链路地图 ①：节点生成结果链路（最高频，后端绿前端错都在这）

从「点生成」到「刷新还在」,共 6 跳。每跳标【入】输入契约、【出】输出契约、【断】常见断点（均基于 `src/components/base/` 真实代码）。

```
[1] 节点 start()
    useNodeGeneration.start (useNodeGeneration.js:93)
    【入】type={type,prompt,modelName}、validate() 返回错误文案或空串
    【出】reportGenerate→taskCtl{taskId,progress,done,fail}；setCurrentTaskId 贯穿前端 task_id
    【断】validate 误返回非空串→假失败；未 setCurrentTaskId→链路 task_id 丢失
          runningRef/loading 双防重 (useNodeGeneration.js:78-80)，破坏 runningRef 复位(:166)→永久卡死
        ↓
[2] reportGenerate（任务中心上报）
    taskStore.js:157 → 返回 taskCtl
    【出】任务记录 {id,nodeId,type,prompt,modelName,status,progress,resultUrl,...}
          内存 tasks 唯一源；持久化 fire-and-forget（失败仅降级内存 :171）
    【断】done(resultUrl) 内防御：resultUrl 非字符串强制置空(:192)（历史 bug：上游偶发对象/undefined
          触发 .startsWith 崩溃）→ 若 r.url 是对象且未走 doneUrl，结果静默丢失
        ↓
[3] run 执行器 → proxyGenerate（三 facade 差异）
    runRef.current({progress,signal}) (useNodeGeneration.js:116) → proxyGenerate.js
    - imageProxy (:252)：SSE 同步(?wait=1) 默认；provider.image_mode==='async' 走轮询
    - videoProxy (:285)：强制 async 轮询（VIDEO_TIMEOUT/VIDEO_POLL_INTERVAL）
    - chatProxy (:213)：信封模式，永不抛错
    【出】image/video {ok:true,url}|{ok:false,error}；chat {ok,content,error,aborted}
    【断】🔴 SSE 三件套必须走 proxyGenerate，禁迁 httpClient.js（其「非2xx抛错+自动重试」
            破坏流式增量，proxyGenerate.js:51-54）→ 流式没增量/中断异常先查是否误走 httpClient
          envelope 取 url：evt.results[0].url ?? evt.result.images[0].url (readSseUrl :113)
            前端若另写解析易错
          run 没把 signal 透传 → stop 不能真取消；run 返回结构不符 → onSuccess 拿 undefined
        ↓
[4] useNodeGeneration 收结果
    r.ok → ① 若 resultKey 声明：自动 patchData({[resultKey]:r.url||r.doneUrl}) 写 node.data
           ② onSuccessRef(r,taskCtl)（节点 UI state 回写）
           ③ taskCtl.done(rawUrl) ④ saveResultToTasks(rawUrl,type) 落盘拿持久 URL
    【断】🔴 onSuccess 只 setXxx 不写 node.data（也没声明 resultKey）→ 刷新丢结果（数据只在任务中心）
          doneUrl/url 偶发对象→taskCtl.done 内 .startsWith 崩（已有防御转 ''）
        ↓
[5] 异步完成恢复（刷新后 / 后台完成）
    pollTask.js 轮询网关 → 完成发 eventBus 'agent:task-completed'
    {taskId,nodeId,resultUrl,type,status:'completed'}
    useNodeGeneration 订阅：d.nodeId===本节点 && completed && resultUrl
        → 若 recoverable：自动 patchData({[resultKey]:resultUrl})；再调 onRecover(d)
    【断】🔴 异步可恢复节点没传 onRecover/recoverable → 后台完成刷新不恢复
           文本类节点（结果在 data.text、任务中心 resultUrl 为空）误套 onRecover → 静默无效，
           应靠 data.text 随画布快照落盘恢复（不套 recoverable）
           nodeId 对不上（detail.nodeId≠本节点）→ 精准过滤误吞
        ↓
[6] 持久化与重定向
    saveResultToTasks：上游 url → 落盘 uploads/tasks/* → 返回持久 URL（失败回退上游 url）
    画布快照 {nodes,edges} 经 storageAdapter → KV（canvas-state-v1-{projectId}）
    node.data.imageUrl = 持久 URL → 刷新后从快照恢复显示
    【断】落盘失败但回退上游 url（可能过期）→ 刷新图裂；快照未含该字段→恢复缺图
```

**真相源契约（红线，整条链路守此，useNodeGeneration.js:29-37）**：任务中心（`taskStore`）为结果**权威源**，`node.data` 为**渲染缓存副本**;方向单向(写只走本契约,刷新后任务中心→节点回填,节点不回写任务中心);文本类节点不适用 `onRecover`。

**debug 落点口诀**：刷新丢图→查 [4] 是否写 data / [6] 快照;后台完成不恢复→查 [5] onRecover;流式中断→查 [3] 是否误走 httpClient;点生成假失败→查 [1] validate / [2] run 返回。

---

## 二、链路地图 ②：AI 聊天 / 流式链路

从「用户输入」到「消息渲染 + 工具执行」,共 7 跳（基于 `useAgentChat.js`/`agentCore.js`/`agentRuntime.js`/`proxyGenerate.js`/`useCanvasAgentTools.js`）。

```
[1] useAgentChat.send (useAgentChat.js:431)
    【入】userMsg{role,content,attachments?[{type,url,label,name,nodeId,x,y}]}
    【出】经 isAgentBusy 保护 / steerQueue 压补充指令；buildRequestMessages(messagesRef,...)
    【断】循环中途异常残留 streaming:true 占位→靠 stripStreaming()(:557)清理
         走满 MAX_TOOL_ROUNDS=8 不收敛→提示用户(:543)
        ↓
[2] buildRequestMessages (agentCore.js:242) + roundTrip (agentRuntime.js:50)
    【出】OpenAI 格式 messages[]；双模式 streamMode(默认 SSE)/non-stream
    【断】🔴 roundTrip 不走 httpClient（SSE 逐块+多轮工具循环语义冲突，agentRuntime.js:76-80）
          历史 system 一律不回传(:394)避免覆盖新准则；图片绝不进历史上下文（防反推撞号）
        ↓
[3] chatProxy 信封消费 (proxyGenerate.js:213)
    【出】信封 {ok,content,error,aborted}；取 content=(json.data??json).choices[0].message.content (:239)
    【断】🔴 chatProxy 不走 __proxyFetch：HTTP 非2xx 属业务错误取嵌套 message，不抛；
          若误走 __proxyFetch 会误加「网络错误」前缀（chatProxy 头注释 :207-211）
        ↓
[4] 前端逐块渲染 (updateLastStreaming useAgentChat.js:277)
    【断】流式中断(done 提前)→本轮 content 不完整→残句；endStreaming 须在回调外同步 messagesRef
          (:308-314)否则 finally 落盘读空占位→AI 回复丢失
        ↓
[5] 工具循环 runToolCalls (agentRuntime.js:275) → callTool (useCanvasAgentTools.js:1203)
    - generate_node (:695)：runNodeGeneration(id)→信封{ok,data:{completed,resultUrl}}；
          completed:true 明确「已生成勿重复」，false 表示「异步后台中勿重复触发」(收敛防重复建节点)
    - execute_plan (:832)→canvasPlanExecutor.executePlan (:212)：确认态门禁 / 单飞锁 executingPlan
    【断】🔴 工具循环竞态：runToolCalls 必须 await 异步工具，否则回填 Promise 被序列化→
          误判失败→撞 8 轮死循环+重复建节点(TASK-006 #1)
          generate_node 不等节点挂载注册(5s 超时 :295)→「未注册生成契约」
        ↓
[6] 错误分类 classifyError (genErrors.js:22)
    【出】type: abort/timeout(network可重试)/network(可重试)/http(否)/business(否)
    【断】禁止再自写 if(/网络错误/)（genErrors.js:10-11）；chatProxy 不调 classifyError（业务不重试）
        ↓
[7] 生图/视频走 imageApi/videoApi → imageProxy/videoProxy（SSE/轮询，禁迁 httpClient）
```

**字符串契约（红线常量）**：端点 `/api/proxy`、`proxyMode=local-tool`、`openai://chat/completions`、端口 `18080`（useAgentChat.js:93 / 各 *Api 文件头）。三件套 SSE 豁免红线见 chatApi.js:14-18 / imageApi.js:14-17 / videoApi.js:16-19。

---

## 三、链路地图 ③：节点体系与管线链路

### 3.1 节点创建链路
- **类型注册表单源**：`contracts.js:370-393` `NODE_TYPES`（登记 imageNode/imageBoxNode/gridSplitNode/.../textNode/...；`director3dNode`/`ghostTarget` 例外）。漏登记仅 `check:node-types` 编译期兜底。
- **palette 单源**：`NodePalette.jsx:51-80` `paletteNodes` + `HIDDEN_TOP_LEVEL_NODES`；`buildNodeTypeComponents()`(:113) 遍历有 component 项 → `{type→组件}`（`director3dNode` 无 component 被跳过）。
- **App 唯一注册**：`App.jsx:65-69` `nodeTypes={...buildNodeTypeComponents(), director3dNode, ghostTarget}`（常规节点只改 palette，双维护平行表会漂移）。
- **程序化建节点原子入口**：`App.jsx:476-517` `addNode`（读 nodesRef 最新快照→generateId→connection 自动建边→history.record 显式快照）；下游 spawn 子节点走 `deriveNodes.js:34-71` `buildSpawnNodes`（先算 next 再 setNodes+record，否则 undo 丢新增）。
- **手连**：`onConnect`(:1063) 补唯一边 id；`onConnectEnd`(:1078) 无效连接建 `ghostTarget`+`ghost-edge-<时间戳>`(id 必须唯一，固定串会重复 key)。

### 3.2 节点「上次参数」记忆链路
- `useNodePrefs(type,defaults)` (`nodePrefs.js:54`)：首参 `type` 必须 = `NODE_TYPES` 命名空间(`contracts.js:363` 要求登记;注意 `check:node-types` 只校验 NODE_TYPES 注册表本身,**不扫 useNodePrefs 首参**,故拼错不会被编译期拦截)。
- **断点**：拼错 / 用变量动态拼接命名空间 → 未登记进表、静态扫描跳过、运行时**静默失效**(该节点跨窗口「上次参数」不记忆,无报错,也**不会编译报错**)。

### 3.3 上游→下游数据管线链路（最易漏）
- `getNodeOutput`(`useConnectedInputs.js:107`) 是下游取上游产出的**唯一调度入口**,三分支:① 脚本盒子特判(按 shot-${id} 镜头匹配资产) → ② `NODE_OUTPUTS` 声明表(`useConnectedInputs.js:72`,imageBoxNode→d.images[]、videoExtractNode/gridSplitNode/gridMergeNode→d.extractedImages[]) → ③ `genericOutput` 兜底(:85,按 imageUrl>videoUrl>resultUrl 自动取)。
- `useConnectedInputs(nodeId)`(:139) 只取 `e.target===nodeId` 一层；用 `useStore` 订阅(**不用 `getNodes()`**,否则连线界面不更新 :31-33)。
- **断点**：🔴 新增有**自定义产出结构**(如数组型 extractedImages、多图 images[])的节点,漏登记 NODE_OUTPUTS → 下游连线**静默拿不到数据**(最易漏一处);普通节点(imageUrl/videoUrl/resultUrl)有 genericOutput 兜底,不登记也能拿到,但数组型/特殊结构必须登记。数组型用 `arrayImages` 归一。

### 3.4 画布状态管理链路（非生成类 bug）
- **最新快照 ref**：`App.jsx:245-248` `nodesRef/edgesRef`（规避闭包旧值，FINAL-057 风险）。用 `nodes` state 而非 `nodesRef.current` 取快照 → 旧闭包错位、undo/保存取旧值。
- **历史栈**：`useCanvasHistory.record(snapshot)`(:28) 优先显式传入快照，否则 getSnapshot()；「先 setNodes 再 record」必须显式传 `{nodes,edges}`(:26-27)，否则 undo 丢新增。
- **自动保存**：`App.jsx:264-277` `persistCanvas` 600ms 防抖 + BroadcastChannel 多窗口同步。
- **落盘冲突**：`projectStore.js:154-185` `saveCanvasState` 版本冲突检测，若 `remoteVer>version` 拒绝覆盖（`conflictVersion`）→ 当前窗口变更被静默丢弃（多窗口/设备冲突）。
- **NodeShell 范式**（`NodeShell.jsx:112-123`）：读 `useState(data.xxx)`；写 `setNodes(ns=>ns.map(...不可变))`；外部写回用 `useNodeData.patchData`(:27)。

### 3.5 新增节点必做同步（注册收口）
1. `NodePalette.jsx` `paletteNodes` 加一行
2. `App.jsx:65` `nodeTypes` 加 `type→组件`（常规节点自动派生，仅不可 SSR/占位需显式补）
3. `useConnectedInputs.js:72` `NODE_OUTPUTS` 加一行（有产出节点必须，最易漏）
4. 文档登记数据契约

---

## 四、链路地图 ④：存储 / 持久化 / 横切契约红线

### 4.1 横切唯一入口（严禁越层，数据仅走入口）
| 层 | 唯一入口 | 严禁行为 |
|---|---|---|
| ① 通信 eventBus | eventBus.js:32/43 | 禁 `window.dispatchEvent` 裸事件 |
| ② 表现 toastStore | toastStore.js:41/82 | 仅用户无法从界面感知才弹 |
| ③ 观测 logger | logger.js:78/108 | 禁在本文件调 logger 自身（递归） |
| ④ 持久化 contentStore | contentStore.js:181/197 | 禁直调 storageAdapter/localStorage |
| ⑤ 能力 mediaType/clipboard/filesApi | 各模块 | — |
| ⑥ 工具 idGen/utils | utils.js | — |
| ⑦ 下载 clipboard.downloadUrl | clipboard.js:93 | 禁裸 `navigator.clipboard.writeText` |

**断点**：`persist:failed` 若 App 未真订阅 → 持久化失败**静默无 toast**（eventBus.js:12-20 注册表 `to:[] 待核对`）；KV 降级→跨端同步失效（画布换设备"失踪"）。

### 4.2 持久化路由与契约
- `contentStore` 按 `STORAGE_KEYS`(`contracts.js`) 自动路由 local/kv/native（`getBackend` :136-145）；调用方不感知。
- `STORAGE_KEYS` 登记表分 `backend: local/kv/native`；遗漏登记键 → dev 环境 `checkRegistered` 直接 throw，prod 仅 warning 一次→漏登记键静默 `undefined`。
- 编译期 `npm run check:keys` 拦截裸字符串 key；`npm run check:node-types` 拦截裸 NODE_TYPES 命名空间；`npm run check:events` 拦截裸 EVENTS 事件名。
- **字符串契约零损伤（红线）**：`/api/proxy`、`proxyMode=local-tool`、`openai://chat/completions`、端口、画布硬编码 `t.data[0].url`、`{code,data}` 信封。改必全量 grep。
- **后端地址单源**：`config.js` 的 `LOCAL_TOOL_PORT`，禁裸写 18080；`API_BASE` 经 `VITE_API_BASE` 覆盖；`background.js` 独立声明。
- **画布快照 schema 版本化**：`saveCanvasState` 落 `schemaVersion`，`loadCanvasState` 兼容旧版（`projectStore.js` + `degrade.js` 降级透明度）。

---

## 五、对账武器：task-inspect（确认断在后端还是前端）

当日志显示"前端没拿到预期结果",用 `localTool/scripts/task-inspect.mjs` 对账**后端真实落库与返回**,区分断点层：

- `--lifecycle <id>`：任务全链路（DB + 后端 + 前端日志）,看 `result_url` 是否真有、字段是否对。
- `--consistency [proj]`：画布 URL ↔ 任务中心 `result_url` ↔ 磁盘文件 三方对齐 → 定位"前端读了错字段 / 没回填"。
- `--canvas-health [proj]`：画布节点/边结构快照,看 `data.imageUrl` 等是否真写了（验证链路 [4][6]）。
- `--logs [关键词]`：查后端日志交叉验证（前端上报带 `[frontend]`）。

> 若对账证明后端返回完全正确、只是前端读错 → 回到第二节修字段对齐,勿动后端。

---

## 六、与通用排查5步法的衔接

- **State 1（现象对齐）**：走通用引擎,复述痛点。
- **State 2（提取证据）**：先开 debug 开关（〇）拿前端日志;疑后端返回用第五节 task-inspect 对账。
- **State 3（物理断点）**：**对照第一~四节链路地图,指"第几跳、哪个契约没守"**(均带 `文件:行` 定位)。
- **State 4（靶向修复）**：守红线（SSE 走 proxyGenerate / 字符串契约零损伤 / NODE_OUTPUTS 必登记 / 不碰 director3d）,最小改动。
- **State 5（闭环验证）**：呼应 State 1,跑前端门禁（CONTEXT §三）：`npm run test:smoke` → `npm run check:health`;改生成节点顺带 `npm run check:node-types` / `check:events`。
