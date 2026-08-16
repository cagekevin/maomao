# TASK-015 — 图像处理与本地工具(localTool)网关转发薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不写批量改码脚本。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 未覆盖「图像本地处理」与「localTool 网关转发」两条链路。图像压缩、dataURL↔Blob 转换、以及 localTool（Node 服务）转发官方 API 的超时/404/任务清理/DB 持久化，都有薄弱点。本任务探查这两条链路。

## 二、硬约束

- 读 `src/components/base/`（`imageCompress.js`、`imageUrl.js`、`imageApi.js`、`filesApi.js` 等）+ `localTool/`（`src/index.ts`、`src/routes/system.ts`、`src/routes/files.ts`、`src/db/database.ts`）。
- 不修改任何 `src/` 或 `localTool/` 源码。
- 不参考现有文档作为结论来源。
- 每条结论附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位）

- `src/components/base/imageCompress.js`（91 行，已读）：`compressImage`、`loadImage`（仅 `onerror` 拒绝，无超时）、`dataUrlToBlob`。注释：PNG/GIF 转 JPEG 白底；blob: 原图体积获取失败静默。
- `src/components/base/imageUrl.js`、`src/components/base/filesApi.js`：`toAbsoluteFileUrl` 路径补全逻辑。
- `localTool/src/routes/system.ts`（已探）：`PROXY_TIMEOUT_MS` 默认 300000（5min，L17），`AbortController`+`setTimeout` 超时（FormData 分支 L204-287，其中超时 L205；JSON 分支 L384-465，其中超时 L386；GatewayTask 分支 L65-102，其中超时 L66）；catch-all 透传在 `index.ts:451`（`handlePassthrough`），`system.ts` 内的 `handleGatewayTask`（L54-102，正则路由注册在 `index.ts:323`）是本地已接管的特例而非透传；`persistThreadId` fire-and-forget（L299-318 `.catch` 吞错，L314）。
- `localTool/src/routes/files.ts`：文件上传/读取，`execSync` 开目录超时 5000ms（两处：`handleOpen` L313、`handleOpenDir` L341）。
- `localTool/src/db/database.ts`：sqlite 持久化、备份定时器（L174-249）、`ALTER TABLE` 列迁移（L307-314 catch 忽略列已存在）、防抖落盘 `debouncedSaveDb`（L286-292，500ms 节流）。

## 四、覆盖清单（按维度）

1. **图片加载无超时**：`imageCompress.js L69-77` `loadImage` 仅 `onload/onerror`，跨域/网络挂起永不 reject → `compressImage` 永久挂起（无超时兜底）。触发场景：引用了已失效的 `/files/` 图片。
2. **跨域污染**：`imageCompress.js L72` `crossOrigin='anonymous'`；若服务器未返回 CORS 头，`toDataURL`（`L52`）抛 SecurityError 被外层吞 → 压缩静默失败。
3. **dataURL 体积爆炸**：`imageCompress.js L52` `toDataURL` 返回 dataURL（未用 blob 压缩后上传）；若上游已压缩仍走 dataURL 回写节点 → 与 TASK-006 §4.3 localStorage 配额同源放大。
4. **网关超时 5min 过长**：`system.ts PROXY_TIMEOUT_MS=300000`；生图/视频若官方挂起，前端要等 5min 才 504 → 用户长时间无反馈（对比视频引擎自身 `loadVideoElement` 超时 15s）。是否应分级超时。
5. **404 透传无本地兜底**：`system.ts` catch-all 把未命中本地路由的请求透传官方（`index.ts:451` 具名路由之后的兜底层，404 在 `index.ts:456`）。若用户未配官方 key，透传官方 401 → 前端只看到官方错，不知是 localTool 未覆盖该路由。**结论：设计权衡**（详见表格 #5）。
6. **persistThreadId 吞错**：`system.ts L313-318` fire-and-forget `.catch` 吞错；thread_id 持久化失败无重试 → 前端「任务ID→thread」关联查询断链，刷新后任务无法恢复状态（与 `pollTask.js` 任务恢复联动）。
7. **DB 列迁移静默**：`database.ts L307-314` `ALTER TABLE ... ADD COLUMN` 全部 catch 忽略；若迁移逻辑本身错（如类型不符），无日志 → 表结构 silently 不一致。
8. **files 路由 execSync 阻塞**：`files.ts L313/341` `execSync` 开目录同步阻塞事件循环 5s；高并发时阻塞 Node 服务。

## 五、输出规范

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | 图片加载无超时 | `src/components/base/imageCompress.js:69-77` | `function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片加载失败'));img.src=src})}`（仅 onload/onerror，无 `setTimeout` 兜底） | 引用了已失效的 `/files/xxx.png`（localTool 已删除或路径遍历被拒返回 404/403），或跨域请求网络挂起。浏览器不触发 onerror（挂起）也不触发 onload | `compressImage` 的 `await loadImage(src)` 永久 pending → 调用方（写回节点的"原位压缩"）永远转圈，无超时兜底，用户只能强制刷新。前端 `imageApi.js` 的同步/异步生图虽带 AbortSignal，但此处图片加载本身不受该信号控制 | **已确认缺陷** |
| 2 | 跨域污染 | `src/components/base/imageCompress.js:72` + `:52` | `img.crossOrigin='anonymous'`（L72）；`const dataUrl=canvas.toDataURL(format,quality)`（L52） | 服务器未返回 `Access-Control-Allow-Origin` 头时，`crossOrigin='anonymous'` 让 `img.onerror` 触发（L74 reject）；若某些情况 canvas 被污染，L52 `toDataURL` 抛 `SecurityError` | L52 的 `toDataURL` 外层（`compressImage` 内）无 try/catch，SecurityError 直接冒泡到调用方被吞（见 imageApi 的 catch 仅转成 `fail` 文案），压缩静默失败、节点无图；与 L69-77 缺陷叠加时还可能由挂起变为异常 | **已确认缺陷** |
| 3 | dataURL 体积 | `src/components/base/imageCompress.js:52-53` + `:65` | `const dataUrl=canvas.toDataURL(format,quality);const blob=dataUrlToBlob(dataUrl);...return {dataUrl,blob,...}`（返回 dataUrl 与 blob 两份） | 上游已压缩仍走 `compressImage` 回写节点，调用方若用 `dataUrl` 字段存节点/落盘（如 `filesApi.saveInlineToLocal` 走 dataURL），而非 blob | 大图 `toDataURL` 生成 base64 体积约为原像素 1.33~1.5 倍；与 TASK-006 §4.3 localStorage 配额同源放大——节点 data 内嵌大 dataURL 撑爆配额、画布状态写不进 localStorage。本模块默认 quality 0.8 只减体积不解决 base64 编码膨胀本身 | **设计权衡**（有 blob 出口，但调用方倾向用 dataUrl，需规范引导用 blob） |
| 4 | 网关超时过长 | `localTool/src/routes/system.ts:17` + `:205`/`:386` | `const PROXY_TIMEOUT_MS=Number(process.env.PROXY_TIMEOUT)||300000;`（L17）；`const timeout=setTimeout(()=>controller.abort(),PROXY_TIMEOUT_MS)`（L205 FormData 分支、L386 JSON 分支） | 生图/视频官方向上挂起（Lovart 队列堆积、网络黑洞） | 前端要等满 5min（300000ms）才收到 504（`system.ts:282/460` `Proxy request timed out (300s)`）；而 `imageApi.js:232` 前端异步轮询 `timeoutMs:300000` 与之同量级，用户长时间无反馈。此处 5min 显著过长，且无分级（生图/视频/普通 API 共用同一超时） | **设计权衡**（源码注释 L17 称"原硬编码 15s 升到 5min"是为兼容 Lovart 长任务，但应分级：短平快 API 用短超时、长任务用长超时） |
| 5 | 404 透传 | `localTool/src/index.ts:451` + `:456` | `if(await handlePassthrough(req,res,url))return;`（L451，catch-all）；`sendError(res,'Not Found',404)`（L456，本地专属路径未命中） | 用户未配官方 key（apimart-gateway/.env 占位符）时，未命中本地具名路由的请求经 L451 透传官方 → 官方返回 401/400 | 前端只看到官方错误（如 `Proxy request failed` 502 或官方 401），不知是 localTool 未覆盖该路由；区分困难——究竟是"本地未实现该路由"还是"官方真错"。L451 前置注释（index.ts:435-450）已说明这是"唯一出口网关"的有意设计 | **设计权衡**（catch-all 是改 dist base→18080 的硬前置，收益大于风险；但缺少"路由未接管"标记，排障成本高） |
| 6 | 持久化吞错 | `localTool/src/routes/system.ts:299-318` + `:314` | `persistThreadId(threadId,taskId,{},frontTaskId).catch((e)=>console.error('[persistThreadId] 落库失败: '+e?.message))`（L314，fire-and-forget + catch 吞错；注释 L313 自承"fire-and-forget + catch 吞错"） | Lovart 上游 thread_id 提取成功，但 `persistThreadId` 落库因 DB 繁忙/损坏失败 | 前端"任务ID→thread"关联（`tasks.thread_id` 列，database.ts:296/310）写入失败，`pollTask.js`/`handleGatewayTask`（system.ts:54）按 task_id 恢复查询断链；刷新后异步任务无法恢复状态。catch 仅 console.error，无重试、无降级 | **已确认缺陷**（注释已自我标注，且吞错级别仅 error 日志，用户无感） |
| 7 | DB 迁移静默 | `localTool/src/db/database.ts:307-314` | `try{db.run('ALTER TABLE tasks ADD COLUMN type TEXT')}catch{/* 列已存在 */}`（L307）；L308 status、L309 error_message、L310 thread_id、L314 poll_task_id 同构，全部 `catch{}` 空忽略 | 迁移逻辑本身写错（如列类型不符、ADD 多列冲突），或 sql.js 在非"列已存在"场景抛其他错 | 全部 catch 空忽略，无日志；若迁移失败，表结构 silently 不一致，后续 `INSERT` 带该列字段时静默丢字段或报错，排查无迹可循（对比 database.ts:65-85 损坏重建有完整日志，此处完全静默） | **设计权衡偏缺陷**（"列已存在"忽略合理，但应区分 `duplicate column` 与其他错误，至少 console.warn 一处） |
| 8 | execSync 阻塞 | `localTool/src/routes/files.ts:313` + `:341` | `execSync('open "'+dirPath+'"',{timeout:5000})`（L313 handleOpen）；`execSync('open "'+dirToOpen+'"',{timeout:5000})`（L341 handleOpenDir） | 用户在"打开文件夹"面板触发 `/api/files/open` 或 `/api/files/open-dir`；macOS `open` 在某些挂载目录上挂起 | `execSync` 同步阻塞 Node 事件循环最多 5s（timeout:5000 到时抛错被 catch 吞）；高并发时（多个面板同时 open、或 open 叠加上传轮询）阻塞整个 18080 服务，其他请求排队。且命令用字符串拼接 `dirPath` 未转义，路径含引号/空格有注入与执行失败风险 | **已确认缺陷**（同步阻塞 + 命令注入隐患，应改用 `child_process.execFile` 异步或 `spawn`） |

## 六、验收标准

- [x] 8 维度覆盖，附行号+片段。
- [x] 缺陷给触发场景→后果。
- [x] 区分缺陷/权衡/健康。
- [x] 末尾 Top 3。

## 七、铁律文件名

`docs/agent 批量任务/TASK-015-图像处理与本地工具网关转发.md`

## 八、Top 3 最严重薄弱点（按"用户可感知 + 难自愈"排序）

1. **#1 图片加载无超时（`imageCompress.js:69-77`）+ #2 跨域污染（`:72`/`:52`）—— 前端压缩死锁风险最高**
   二者叠加：挂起则永久 pending（无超时兜底，AbortSignal 不覆盖 `loadImage`），跨域失败则 `SecurityError` 被吞。直接影响"原位压缩写回节点"交互，用户只能强制刷新，且无法自愈。优先补 `loadImage` 超时（`setTimeout` 包裹 + 复用上游 AbortSignal）与 `toDataURL` 的 try/catch 降级。

2. **#6 持久化吞错（`system.ts:314`）—— 异步任务恢复链路断点**
   `persistThreadId` fire-and-forget + catch 仅 console.error，无重试；`tasks.thread_id`/`poll_task_id` 落库失败 → 刷新后 `pollTask.js`/网关任务恢复查询断链，异步生图/视频结果可能"做完了但页面恢复不出来"。虽注释自承，但属用户强可感知的数据丢失类缺陷。建议加一次重试 + 失败计数，并在前端给出"任务状态可能未保存"的弱提示。

3. **#8 execSync 阻塞（`files.ts:313`/`:341`）—— 服务级可用性隐患 + 命令注入**
   同步阻塞事件循环最多 5s 且命令字符串拼接未转义；高并发或目录挂载异常时整服务卡顿，路径含特殊字符还可能执行异常。虽非高频路径，但一旦触发即影响全部 18080 请求。建议改用 `execFile`（异步，参数数组，天然防注入）或 `spawn`。

> 补充观察（非 Top3 但值得记）：#4 网关 5min 超时与视频引擎 15s 超时严重不对齐，建议按接口分级（普通 API 30s / 生图 120s / 长视频 300s）；#7 DB 迁移应区分"列已存在"与其他错误并至少 `console.warn`；#3 dataURL 膨胀应在调用侧强制优先用 blob 出口避免 localStorage 配额放大。

## 九、其他审计发现（8 维度之外，补全探查完整性）

以下条目不在任务书第四章 8 维度清单内，但属于本任务探查范围（`src/components/base/` 与 `localTool/` 两条链路），审计中一并记录，避免遗漏。均附真实行号。

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定 |
|---|------|---------|--------------|----------|------|------|
| 9 | 网关整块缓冲大响应 | `localTool/src/routes/system.ts:249` + `:430` | `const resBody=Buffer.from(await fetchRes.arrayBuffer())`（L249 FormData 非 SSE 分支；L430 JSON 非 SSE 分支） | 上游返回大视频/大图（非 SSE 流式）响应 | 整个响应体一次性读入 Node 内存（`arrayBuffer()`），大文件（数十~数百 MB）可能撑爆 18080 进程内存导致 OOM 崩溃；SSE 流式分支（L218-246/L401-427）虽逐块 pipe，但非 SSE 的二进制/大 JSON 响应无流式保护 | **设计权衡偏缺陷**（SSE 已流式，但普通大响应未流式；建议对大 content-length 响应改用 pipe 而非 arrayBuffer） |
| 10 | CORS 失败静默丢图 | `src/components/base/imageUrl.js:41-55` + `:64-82` | `blobToDataUrl`/`urlToDataUrl` 在 `catch` 中 `return ''`（L53/L80）；`normalizeImageUrlsForSend`（L116-124）过滤空值 `if(resolved)out.push` | 参考图为外网 http(s) URL 且服务器无 CORS 头，`fetch` 失败 → 返回 `''` 被过滤 | 图生图场景下参考图被无声丢弃，前端无报错、节点生成结果错乱（缺参考图），用户难察觉是"图丢了"而非"模型生成差" | **已确认缺陷**（失败仅 `console.warn`，调用链无错误上抛；应至少回调告警或标记该图失败） |
| 11 | 落盘非幂等重复 | `src/components/base/filesApi.js:136-173` | `saveResultToTasks` 中 `fd.append('file',blob,\`result_${Date.now()}.${ext}\`)`（L145，用 Date.now 命名） | 同一生成结果多次调用 `saveResultToTasks`（如重试/重复保存） | 与 `saveInlineToLocal` 的 sha1 去重（L50）不一致，重复生成会重复落盘、磁盘堆积重复文件；生成面板可能出现重复条目 | **设计权衡偏缺陷**（应统一用内容哈希命名保证幂等，与 saveInlineToLocal 对齐） |
| 12 | 防抖落盘丢数据窗口 | `localTool/src/db/database.ts:286-292` | `debouncedSaveDb`：`_saveTimer=setTimeout(()=>{...saveDb()},500)`（500ms 节流） | 进程被 `SIGKILL`/断电（非 SIGINT/SIGTERM，shutdown 钩子 L572-582 只监听前两者） | 最近 500ms 内的写操作（KV/tasks/resources）未落盘即丢失；优雅退出（SIGINT/SIGTERM）会先 `closeDb→saveDb`（L317-323）故安全，但强杀不安全 | **设计权衡**（500ms 窗口是性能/安全平衡，已用原子写 rename 防主库损坏；属可接受范围，记此备查） |
| 13 | SSE 流式中途失败无错误帧 | `localTool/src/routes/system.ts:237-242` + `:418-421` | `bodyStream.on('error',(err)=>{...if(!res.writableEnded)res.destroy()})`（L237/L418） | 网关 SSE 流在生成中途断流（上游崩溃/网络断） | 仅 `res.destroy()` 终止连接，不向前端发送任何错误/终止帧；前端 `readSseImageUrl`（imageApi.js:48-83）卡在最后进度无终态，用户持续转圈直到前端自身超时 | **设计权衡偏缺陷**（应在 on('error') 时写入一条 `data: {status:'failed',error:...}` 终止帧再 end，便于前端即时感知失败） |

> 上述 9-13 为审计补充项，不影响 8 维度验收；其中 #10（静默丢图）、#9（大响应 OOM）建议优先于 #7/#5 等权衡项纳入后续修复排期。

## 十、行号真实性声明

本文档所有行号均来自本次会话实际读取的源文件（`src/components/base/imageCompress.js`、`imageUrl.js`、`filesApi.js`、`imageApi.js`；`localTool/src/index.ts`、`src/routes/system.ts`、`src/routes/files.ts`、`src/db/database.ts`），未套用历史行号，未以其他文档作为结论来源。表格中 L 引用与"探索起点/覆盖清单"章节描述已互相校准一致。
