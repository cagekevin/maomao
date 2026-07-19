# localTool API 契约

> 基于 PRD 附录 A 反推结果，每个字段均经 App.js 源码交叉验证。
> 本契约同时作为自研 localTool 服务的实现与验收标准。

## A.1 KV 存储

### POST /api/kv/set
- **请求**: `{key: string, value: string}`（value 已由客户端 JSON.stringify）
- **响应**: `{ok: boolean}`
- **调用点**: `App.js:19034`
- **curl**:
```bash
curl -X POST http://127.0.0.1:18080/api/kv/set \
  -H 'Content-Type: application/json' \
  -d '{"key":"test-key","value":"\"hello world\""}'
```

### GET /api/kv/get?key=
- **请求**: query `key`
- **响应**: value（JSON 反序列化后）；不存在返回 `null`（HTTP 200）
- **调用点**: `App.js:19049`
- **curl**:
```bash
curl 'http://127.0.0.1:18080/api/kv/get?key=test-key'
```

## A.2 文件操作

### POST /api/files/upload
- **请求**: FormData
  - `file`(File/Blob) 或 `fileUrl`(string) 二选一，`file` 优先
  - `subfolder`(默认 `canvas`) + `filename`(可选)
- **响应**: `{url: string, thumbnailUrl?: string, path: string}`
- **调用点**: `App.js:1778,1798,19022-19024`
- **curl**:
```bash
curl -X POST http://127.0.0.1:18080/api/files/upload \
  -F 'file=@test.png' \
  -F 'subfolder=canvas' \
  -F 'filename=my-image.png'
```

### GET /api/files/read?path=
- **请求**: query `path`；支持 `X-Proxy-*` 头做代理读
- **响应**: 文件内容（二进制流）
- **调用点**: `App.js:18928`

### GET /api/files/thumbnail?url=&maxDim=&quality=
- **请求**: query `url`(必填) + `maxDim`(可选) + `quality`(可选)
- **响应**: `{thumbnailUrl: string}`（JSON，不是直接返回 JPEG 二进制）
- **调用点**: `App.js:1837-1838`
- **curl**:
```bash
curl 'http://127.0.0.1:18080/api/files/thumbnail?url=/files/canvas/123-test.png&maxDim=200&quality=80'
```

### GET /api/files/open?subfolder=
- **请求**: query `subfolder`
- **响应**: `{path: string}`
- **调用点**: `App.js:328`

### GET /api/files/open-dir?filepath=
- **请求**: query `filepath`（URL pathname 去 `/files/` 前缀）
- **响应**: —
- **调用点**: `App.js:589,685`

### POST /api/files/mkdir
- **请求**: `{folder: string}`
- **响应**: —
- **调用点**: `App.js:19061-19069`

### POST /api/files/move
- **请求**: `{src: string, dst: string}`
- **响应**: —
- **调用点**: `App.js:19076-19084`

### GET /api/files/list
- **请求**: —
- **响应**: 文件列表
- **来源**: strings 发现（选做）

## A.3 Tasks

### GET /api/tasks
- **请求**: query `page`/`pageSize`(默认20)/`sortBy`(默认`createdAt`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串)
- **响应**: `{items: Task[], total, page, pageSize, totalPages}`
- **调用点**: `App.js:41227-41236`

### POST /api/tasks/save
- **请求**: `Task` 对象（camelCase）
- **响应**: `{ok: boolean}`
- **调用点**: `App.js:41240-41246`

### POST /api/tasks/batch-save
- **请求**: `Task[]`
- **响应**: `{ok: boolean}`
- **调用点**: `App.js:41254-41260`

### POST /api/tasks/delete?id=
- **请求**: query `id`
- **响应**: —
- **调用点**: `App.js:41267-41269`

### POST /api/tasks/batch-delete
- **请求**: `{ids: string[]}`
- **响应**: `{deleted: number}`
- **调用点**: `App.js:41277-41286`

### POST /api/tasks/clear
- **请求**: `{statuses: string[]}`
- **响应**: `{deleted: number}`
- **调用点**: `App.js:41293-41303`

## A.4 Resources

### GET /api/resources
- **请求**: query `page`/`pageSize`(默认20)/`sortBy`(默认`timestamp`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串)
- **响应**: `{items: Resource[], total, page, pageSize, totalPages}`
- **调用点**: `App.js:42454-42463`

### POST /api/resources/save
- **请求**: `Resource` 对象
- **响应**: `{ok: boolean}`
- **调用点**: `App.js:42467-42473`

### POST /api/resources/batch-save
- **请求**: `Resource[]`
- **响应**: `{ok: boolean}`

### POST /api/resources/delete?id=
- **请求**: query `id`
- **响应**: —
- **调用点**: `App.js:42486-42488`

### POST /api/resources/clear
- **请求**: `{folder?: string, deleteFiles?: boolean}`
- **响应**: `{deleted: number}`
- **调用点**: `App.js:42495-42505`

## A.5 系统/代理/外部

### GET /api/status
- **响应**: `{status: "ok", version, message, ffmpeg?: boolean, port}`
- **调用点**: `App.js:1708,18981`

### POST /api/proxy
- **形态①** FormData/Blob body + `X-Proxy-Url`/`X-Proxy-Method`/`X-Proxy-Headers`(JSON)/`X-Proxy-Cookie` 头
- **形态②** JSON `{url, method, headers, body, cookie}`
- **响应**: 透传目标响应
- **调用点**: `App.js:18936-18955`

### POST /api/jianying/send
- **形态①** 单个 `{fileUrl, localPath, fileName}`
- **形态②** 批量 `{items: [{fileUrl, localPath}]}`
- **响应**: `{status: 'ok', message}` 或 `{status: 'ok', count, message}`
- **调用点**: `App.js:14,60`
