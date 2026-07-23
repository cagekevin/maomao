# 节点体系与 AI 生成流水线（模块专题 · 按需查阅）

> 事实锚点：grep `src/App.js`、`src/services/gatewayProxy.js`、`src/services/localToolClient.js`、`src/config.js`、`src/config/storageKeys.js`（行号快照 2026-07-23）坐实。
> 行号随构建漂移，主引用用函数语义名 + 真实路径；动手前回源码复核当前行号。
> 本文只写代码里已存在的机制，不写方案、不写待决策。
> 相关：`全局任务与AI生成轮询机制.md`（rhWebapp / 全局任务路径）、`中转资源本地落盘机制.md`（18080 落盘）、`资源上传机制.md`（云端 asset）。

---

## 〇、这是什么

画布上的每一个方块都是一个 **节点（node）**。节点类型由 `nodeTypes: lg`（`App.js:35014`，即传给 ReactFlow 的 `nodeTypes` 属性）注册，渲染组件在 `lg` 映射表里（`App.js:29004`）。其中带「生成」能力的节点（image / video / text / custom / rhWebapp 等）会把请求发往网关 `:9004`，拿到结果后**落本地 18080 再回写节点 `data`**。

本文做两件事：

1. 列出全部节点类型与文件:行号；
2. 讲清「触发生成 → 网关请求 → 轮询 task_id → 结果落盘(18080) → 回写节点」这条流水线，并给出 ImageNode/PromptNode 的完整时序。

---

## 一、节点体系（全部类型 + 组件文件:行号）

节点类型映射表 `lg`（`App.js:29004-29032`），逐个组件定义位置 grep 验证如下：

| 画布 `type` | 渲染组件（压缩名） | 组件定义（file:line） | 是否 AI 生成类 |
|---|---|---|---|
| `group` | `Eh` | — | 否（容器） |
| `imageNode` | `li` | `src/App.js:1264` | 是（显示 + 生图结果） |
| `promptNode` | `Ya` | `src/App.js:2376` | 是（文生图触发） |
| `textNode` | `Qa` | `src/App.js:3705` | 是（文生文） |
| `cropNode` | `eo` | — | 否（裁剪） |
| `gridSplitNode` | `po` | — | 否（切图） |
| `gridMergeNode` | `To` | — | 否（拼图） |
| `videoNode` | `Do` | `src/App.js:7005` | 是（文生视频） |
| `sd2VideoNode` | `Ao` | — | 是（图生视频） |
| `discountVideoNode` | `os` | — | 是（特价视频） |
| `audioNode` | `cs` | — | 是（文生音频） |
| `audioPlayerNode` | `ps` | — | 否（播放） |
| `customNode` | `ms` | `src/App.js:11947` | 是（自定义模板生图） |
| `rhWebappNode` | `Ms` | `src/App.js:13002` | 是（/run 全局任务） |
| `videoExtractNode` | `Ns` | — | 是（抽帧） |
| `videoToGifNode` | `Gs` | — | 否（转 GIF） |
| `imageCompressNode` | `nc` | — | 否（压缩） |
| `faceMosaicNode` | `Cc` | — | 否（打码） |
| `compareNode` | `Lc` | — | 否（对比） |
| `textConcatNode` | `Rc` | — | 否（拼文本） |
| `urlToImageNode` | `Wc` | — | 否（URL→图） |
| `fileToUrlNode` | `qc` | — | 否（文件→URL） |
| `panoramaNode` | `Yc` | — | 是（全景图） |
| `director3dNode` | `Th` | — | 是（3D 导演） |
| `imageBoxNode` | `Ih` | — | 否（图集容器） |
| `stickyNoteNode` | `Uh` | — | 否（便签） |
| `ghostTarget` | `Nh` | — | 否（拖拽占位） |

> 行号未单独列出的组件，按 `lg` 映射在 `App.js:29004-29032` 同文件内以 `Y.memo(({...}) => ...)` 形式存在；本文聚焦 AI 生成类节点，故只给关键组件的精确行号。

注册点（verbatim）：

```29004:29032:src/App.js
  lg = {
    group: Eh,
    imageNode: li,
    promptNode: Ya,
    textNode: Qa,
    cropNode: eo,
    gridSplitNode: po,
    gridMergeNode: To,
    videoNode: Do,
    sd2VideoNode: Ao,
    discountVideoNode: os,
    audioNode: cs,
    audioPlayerNode: ps,
    customNode: ms,
    rhWebappNode: Ms,
    videoExtractNode: Ns,
    videoToGifNode: Gs,
    imageCompressNode: nc,
    faceMosaicNode: Cc,
    compareNode: Lc,
    textConcatNode: Rc,
    urlToImageNode: Wc,
    fileToUrlNode: qc,
    panoramaNode: Yc,
    director3dNode: Th,
    imageBoxNode: Ih,
    stickyNoteNode: Uh,
    ghostTarget: Nh
  },
```

---

## 二、AI 生成触发点（节点如何调网关 :9004）

### 2.1 生成回调分发

新建/挂载节点时，按 `type` 把对应的生成函数作为 prop 注入（`App.js:33459-33464`）：

```33459:33464:src/App.js
          onGenerate: e === `promptNode` ? sr : undefined,
          onGenerateText: e === `textNode` ? cr : undefined,
          onGenerateVideo: e === `videoNode` ? ur : undefined,
          onGenerateSD2Video: e === `sd2VideoNode` ? dr : undefined,
          onGenerateDiscountVideo: e === `discountVideoNode` ? pr : undefined,
          onGenerateCustom: e === `customNode` ? _r : undefined,
```

- `sr`（promptNode 生图）→ 内部调用 `Jn`（图像生成，`App.js:30377`）。`sr` 定义（`App.js:32673`）：

```32673:32678:src/App.js
    sr = Y.useCallback((e, t, n = `1024x1024`, r, i = `auto`, a = 1) => {
      let o = or(r);
      if (o) {
        ar(e, o, r => Jn(e, t, n, r, i, 1));
        return;
      }
      return Jn(e, t, n, r, i, a);
```

- `ur`（videoNode 生视频）→ 内部调用 `er`（视频生成，`App.js:31883`）。`ur` 定义（`App.js:32754`）：

```32754:32760:src/App.js
  let ur = Y.useCallback((e, t, n = `16:9`, r = `1280x720`, i, a, o = `auto`) => {
      let s = or(i);
      if (s) {
        ar(e, s, i => er(e, t, n, r, i, a, o));
        return;
      }
      return er(e, t, n, r, i, a, o);
```

> 压缩变量语义：`e`=nodeId、`t`=prompt、`n`=尺寸/比例、`r`=分辨率、`i`/`s`=模型名、`a`/`o`=数量/策略。`or`=取节点所选模型配置，`ar`=按模型分流（多模型并行）。

### 2.2 网关基址与 fetch 包装

- 网关基址（节点内联生成路径）：`Jn` 内 `R = m.replace(/\/$/, '')`（`App.js:30596`），`m` 为**运行时网关基址**——默认 `http://127.0.0.1:9004`，但可被用户「API 配置」里的 `url` 覆盖（详见《API 配置机制》），**不是**写死的 `DEFAULT_ENDPOINT` 常量（`App.js` 并未引入 `DEFAULT_ENDPOINT`）。⚠️ 注意：`Jn` 里的 `p`（如 `p = Xi(f)`，`App.js:30380`）是「模型是否可用」的布尔判定结果，**不是**网关基址；网关基址在 rhWebapp 全局任务路径才叫 `p`（见 §3.2 的 `rr(p,'/run')`）。
- 所有请求走 `zc`（来自 `src/services/gatewayProxy.js:3`，`App.js:24` 导入）。`zc` 在扩展连接态（`H.status.isConnected`）时把请求经 `localPort` 代理到 `http://127.0.0.1:<localPort>/api/proxy`，否则直接 `fetch`（verbatim 核心分支）：

```6:23:src/services/gatewayProxy.js
  if (t.localPort) {
    if (!e.startsWith(`http`) && !e.startsWith(`data:`) && !e.startsWith(`blob:`)) {
      let n = `http://127.0.0.1:${t.localPort}/api/files/read?path=${encodeURIComponent(e)}`;
      return fetch(n, { method: t.method || `GET`, headers: t.headers || {} });
    }
    try {
      let i;
      if (n || r) {
        let n = new Headers();
        n.set(`X-Proxy-Url`, e), n.set(`X-Proxy-Method`, t.method || `POST`), ...
        i = await fetch(`http://127.0.0.1:${t.localPort}/api/proxy`, { method: `POST`, headers: n, body: t.body });
```

### 2.3 图像生成请求体关键字段（`Jn`，`App.js:30583-30689`）

`Jn` 根据模型厂商选不同端点（`R`=网关基址，`N`=是否 OpenAI 系，`l`=参考图列表，`B`=模型含 `*` 走 draw）：

```30670:30689:src/App.js
          if (B) I = `${R}/v1/draw/completions`, L = {
            model: k,
            prompt: v,
            aspectRatio: t === `Auto` ? undefined : t
          }, x.length > 0 && (L.urls = x);
          else if (l.length > 0) {
            I = `${R}/v1/images/edits`, ee = true, L = new FormData(), L.append(`model`, k), L.append(`prompt`, v || ` `), L.append(`n`, `1`), n !== `Auto` && L.append(`size`, n), L.append(`image_size`, String(E).toUpperCase());
            for (let e = 0; e < l.length; e++) ...
          } else I = `${R}/v1/images/generations`, L = {
            model: k,
            prompt: v,
            n: 1,
            image_size: String(E).toUpperCase()
          }, n !== `Auto` && (L.size = n);
        } else I = `${R}/v1beta/models/${k}:generateContent?key=${h}`, L = F;
```

- 非 OpenAI（Gemini）路径：`I` = `${R}/v1beta/models/<model>:generateContent`，`L = F`，其中 `F`（定义 `App.js:30583`）：

```30583:30592:src/App.js
        let F = {
          contents: [{
            role: `user`,
            parts: y
          }],
          generationConfig: {
            responseModalities: [`IMAGE`]
          }
        };
        Object.keys(P).length > 0 && (P.aspectRatio ||= `1:1`, F.generationConfig.imageConfig = P);
```

- 关键请求体字段语义：`prompt`/`parts`=提示词、`model`=模型名、`aspectRatio`/`size`/`image_size`=画幅、`n`=张数、`urls`=参考图 URL 列表、`image`（FormData）=参考图二进制。
- 实际发出（verbatim，`App.js:30765`）：

```30765:30769:src/App.js
            let l = await zc(I, {
              method: `POST`,
              headers: s,
              body: ee ? L : c,
              localPort: H.status.isConnected ? H.status.port : undefined
            }).finally(() => { clearTimeout(o); });
```

> 视频/文本/自定义节点的请求体结构同构：`er`（`App.js:31883`）、`cr`、`_r` 都经 `zc(<端点>, {method:'POST', ...})` 发出，端点形如 `${R}/v1/...`，请求体含 `prompt`/`model`/`size` 等字段。

---

## 三、结果轮询（task_id → 轮询 → 落 18080 → 回写）

AI 生成有**两条**结果回流路径，都收敛到「落 18080 + 回写节点」：

### 3.1 路径 A：图像/视频/文本/自定义节点（节点内联轮询，`Jn`/`er`/…）

`Jn` 在拿到首个响应后判断是否带 `task_id`（`App.js:30873-30875`）：

```30873:30875:src/App.js
              if (N) {
                // A-C1: task_id 检测 + 分流
                let taskId = t.data?.[0]?.task_id || t.data?.[0]?.id || t.task_id || t.id;
```

**带 task_id → 进入轮询分支**（verbatim 核心，`App.js:30888-30921`）：

```30888:30921:src/App.js
                    while (true) {
                      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                      if (Date.now() > deadline) throw Error('生成超时（15分钟）');
                      let pollUrl = `${R}/v1/tasks/${taskId}`;
                      let pollResp = await zc(pollUrl, { method: 'GET', headers: { Authorization: `Bearer ${h}` }, localPort: ..., signal: ac.signal });
                      ...
                      let taskInfo = pollData.data || pollData;
                      if (z && taskInfo.progress != null) { /* 进度回写全局任务 */ }
                      if (taskInfo.status === 'completed') {
                        let result = taskInfo.result;
                        let imgUrl = result?.images?.[0]?.url?.[0];
                        let vidUrl = result?.videos?.[0]?.url?.[0];
                        u = imgUrl || vidUrl;   // u = 结果 URL
```

- 轮询 URL：`GET ${R}/v1/tasks/${taskId}`（`R`=网关 `:9004`）。
- 终态：网关归一化 `completed`/`failed`/`pending_confirmation`；`pending_confirmation` 走 `markNeedsConfirm`（`App.js:30867`）把节点置 `await_confirm`。
- deadline 15 分钟（`9e5` ms）、间隔 `(ie||3)*1e3` ms，429 退避（`App.js:30854`）。
- **不带 task_id → 同步解析分支**（`App.js:30962-30970`）：直接取 `t.data[0].url` / `b64_json` / `image_url.url`。

### 3.2 路径 B：rhWebappNode（提交全局任务，递归轮询，见 `全局任务与AI生成轮询机制.md`）

- 发起：`POST rr(p, '/run')`（`App.js:13627`），`p`=网关 `:9004`；取 `taskId`（`App.js:13637`）。
- 入队：先写一条 `{status:'running'}` 全局任务（`App.js:13654`）。
- 递归轮询：`fetch rr(p, '/task/'+taskId)`（`App.js:13450`），递归 `setTimeout`（`App.js:13435` 起），超时 600s（`6e5`，`App.js:13437`）。
- `SUCCESS` → 逐个结果经 `Xr(t, {subfolder:'tasks', generateThumb:...})` 落 18080（`App.js:13486`）→ `addTransitResource(url, type, 'generated')`（`App.js:13522`）→ 回写节点 `data`（`App.js:13514`）。

### 3.3 结果「资源 → URL」转换（`ii` = urlifyAsset 本地变体）

无论路径 A/B，结果 URL 都要先经 `ii`（来自 `src/services/localToolClient.js:128`，`App.js:23` 导入）做本地化：

```128:152:src/services/localToolClient.js
async function ii(e, t = {}) {
  if (typeof e == `string` && /^https?:\/\//i.test(e) && !e.startsWith(`data:`)) return t.preferThumbnail && e.includes(`/files/`) ? {
    url: e,
    thumbnailUrl: (await ri(e, { maxDim: t.thumbMaxDim, quality: t.thumbQuality })) || undefined
  } : { url: e };
  let n = await Xr(e, { subfolder: t.subfolder ?? `canvas`, generateThumb: !!t.preferThumbnail, thumbMaxDim: t.thumbMaxDim, thumbQuality: t.thumbQuality });
  return n ? { url: n.url, thumbnailUrl: n.thumbnailUrl } : ...;
}
```

- `data:` 结果 → 走 `Xr`（blob 上传 18080）返回 `{url, thumbnailUrl}`。
- 已是 `/files/` 的本地 URL → 仅补缩略图。
- 远程 https（且非 `/files/`）→ 原样返回（注：网关若返回 18080 托管地址则自然已是本地 URL；否则按红线要求，长链路资源经路径 B 的 `Xr` 强制落盘）。
- `ii` 在 `Jn` 中的调用（verbatim，`App.js:30983-30991`）：

```30983:30991:src/App.js
            let f;
            if (u.startsWith(`data:`)) try {
              let e = await ii(u, { subfolder: `tasks`, preferThumbnail: true, thumbMaxDim: 480, thumbQuality: 75 });
              e.url && /^https?:\/\//i.test(e.url) && (u = e.url, f = e.thumbnailUrl);
            } catch (e) { console.warn(`[handleGenerate] urlifyAsset failed for generated image, keep base64:`, e); }
```

> `ii` 即「资源 → 可显示 URL」的本地转换层，与 `Zh`（云端 `upload/asset`，`App.js:28612`）对立互补：外传第三方走 `Zh`，自用落盘走 `ii`→`Xr`/`Zr`（见 §五）。

### 3.4 回写节点 `data`

`ii` 后，`Jn` 用 `W`（setNodes）把结果写回节点 `data`（`App.js:31026-31047`），并调 `Gn` 登记中转资源：

```31026:31047:src/App.js
                })), Gn(e, u), d === 1 && M(`生成成功！`)) : (W(t => t.map(t => {
                  if (t.id === e) {
                    let { imageUrlRef: e, imageUrlThumbRef: n, ...r } = t.data;
                    return {
                      ...t,
                      style: { ...t.style, width: i, height: a },
                      data: {
                        ...r,
                        imageUrl: u,
                        thumbnailUrl: f,
                        loading: false,
                        errorMsg: undefined
                      }
                    };
                  }
                  return t;
                })), Kt.current.delete(e), ...
```

- `Gn` = `addTransitResource`（`App.js:30222`），把 `url` 登记进 `transitResources` 索引（KV 键 `Z.TRANSIT_RESOURCES`，`storageKeys.js:13`）。
- 视频节点回写字段为 `videoUrl`/`imageUrl`/`thumbnailUrl`（`App.js:32787-32791` 的 `mr` 恢复分支可见）。

---

## 四、代表节点完整时序（以 PromptNode/ImageNode 图像生成为例）

以用户在一个图像类节点点「生成」为例，端到端一条线：

```
用户操作                节点 / 函数                              动作
─────────────────────────────────────────────────────────────────────────
[点「生成」按钮]
  │
  ▼
PromptNode( Ya, App.js:2376 )
  └─ onGenerate = sr (App.js:33459)
        │
        ▼
sr (App.js:32673) ──调用──▶ Jn (图像生成, App.js:30377)
        │                        │ 1. 收集上游上下文(参考图/文本) gs()
        │                        │ 2. 选模型 + 算画幅(aspectRatio/imageSize)
        │                        │ 3. 置 loading=true, 写全局任务(running)
        │                        ▼
        │              zc( `${R}/v1/images/generations` 或 /edits 或 /draw/completions
        │                  或 /v1beta/models/<m>:generateContent`,
        │                  { method:'POST', body, localPort } )   ← 网关 :9004
        │                        │
        │          ┌─────────────┴───────────────┐
        │     响应带 task_id                  响应同步返回(url/b64)
        │          │                                │
        │          ▼                                ▼
        │   A-C 轮询分支                      同步解析分支
        │   GET ${R}/v1/tasks/${taskId}       直接取 result url
        │   (zc, Bearer, 间隔3s, 15min超时)      │
        │          │  status=completed           │
        │          ▼                              │
        │   提取 result.images[0].url ───────────┘
        │          │  u = 结果 URL
        │          ▼
        │   ii(u, {subfolder:'tasks', preferThumbnail:true,
        │         thumbMaxDim:480, thumbQuality:75 })   ← localToolClient.js:128
        │          │  data: → Xr 上传 18080 返回本地 url+thumbnail
        │          │  远程 https(非/files/) → 原样返回
        │          ▼
        │   Gn(nodeId, u)  → addTransitResource 登记 transitResources
        │          ▼
        │   W(setNodes): node.data = { imageUrl:u, thumbnailUrl:f,
        │                              loading:false }   ← App.js:31026
        ▼
节点显示生成图 + 任务清单标记 completed
```

> 视频节点（`ur`→`er`，`App.js:32754`/`31883`）与文本（`cr`）、自定义（`_r`）走同一套 `zc` 网关请求 + `ii` 落盘 + `Gn`/`W` 回写；区别仅在端点（`/v1/videos/...` 等）与回写字段（`videoUrl` vs `imageUrl` vs `text`）。
> rhWebapp 节点走路径 B（`/run` → 全局任务 → 递归轮询 `/task/:id` → `Xr` 落盘），详见 `全局任务与AI生成轮询机制.md`。

---

## 五、各节点共享的「资源 → URL」转换逻辑（与 18080 落盘机制的关系）

所有 AI 生成类节点共用同一套「结果 → 可显示 URL」转换与落盘约定，不重复实现：

| 符号 | 位置 | 作用 | 关联文档 |
|---|---|---|---|
| `zc` | gatewayProxy.js:3 | 网关 fetch 包装（经扩展 `localPort` 代理 `:9004`） | — |
| `ii`（urlifyAsset 本地变体） | localToolClient.js:128 | `data:`/本地 URL → 18080 url+thumbnail | 本篇 §3.3 |
| `Xr`（uploadToLocalTool） | localToolClient.js:42 | blob → `POST 18080 /api/files/upload` | `中转资源本地落盘机制.md` §二 |
| `Zr`（uploadRemoteUrlToLocalTool） | localToolClient.js:67 | 远程 URL → 18080 落盘 | `中转资源本地落盘机制.md` §二 |
| `Zh`（云端 urlifyAsset） | App.js:28612 | 上传云端 `upload/asset` 返回公网 URL | `资源上传机制.md` |
| `Gn`（addTransitResource） | App.js:30222 | 登记 `transitResources` 索引 | `中转资源本地落盘机制.md` §四 |
| 全局任务轮询 | App.js:13435 / 13486 | rhWebapp：`/task/:id` 递归轮询 + `Xr` 落 `tasks` | `全局任务与AI生成轮询机制.md` |

与 `中转资源本地落盘机制.md` 的关系：

- `ii` 内部对 `data:` 结果正是调用 `Xr`（`localToolClient.js:138`）→ `POST http://127.0.0.1:18080/api/files/upload`（subfolder 用 `tasks`），即「AI 结果落 18080」在节点内联路径里的实现。
- 路径 B（rhWebapp）在 `SUCCESS` 分支直接调 `Xr(t,{subfolder:'tasks'})`（`App.js:13486`），与节点内联路径殊途同归。
- 两条路径都遵循同一红线（CLAUDE.md §3.2）：节点 `data` 里不留 CDN/远程裸 URL，先经 `ii`/`Xr`/`Zr` 落 18080（subfolder 语义：`tasks`=AI 结果、`canvas`/`canvas/template`=模板与画布资源），再回贴本地 URL 并 `Gn` 登记索引。

---

## 六、一句话

`节点点生成 → sr/ur/cr/_r → Jn/er/... → zc(POST :9004/...) → 响应带 task_id 则内联轮询 GET /v1/tasks/:id（或 rhWebapp 走全局任务递归轮询 /task/:id）→ 结果经 ii→Xr 落 18080(tasks) → Gn 登记 + W 回写节点 data（imageUrl/videoUrl/text + thumbnailUrl）`。

---

## 七、改码前必查

1. **别绕过 `zc`**：所有网关请求必须经 `zc`（带 `localPort`），否则 Chrome 扩展环境直连会被 CORS/网络层拦截。
2. **结果必须先落 18080**：`data:`/远程结果经 `ii`→`Xr` 落盘后再回写节点；严禁把网关 CDN URL 直接写节点 `data`（CLAUDE.md §3.2）。
3. **轮询是 `task_id` 驱动**：节点内联轮询（`Jn` A-C 分支）与全局任务轮询（`App.js:13435`）是两套独立循环；新增生成类节点要么接 `sr/ur/...` 复用 `zc`+`ii`，要么走 `/run` 全局任务，不要混写。
4. **超时硬上限**：内联轮询 15 分钟（`9e5`），全局任务 600 秒（`6e5`）；长任务需确认网关侧不超时。
5. **`Gn` 必调**：回写节点后务必 `Gn(nodeId, url)` 登记 `transitResources`，否则资源索引丢失、导出/同步会断链。

---

## 八、真实路径速查

| 符号 | 位置（≈行） | 作用 |
|------|------------|------|
| `lg` / `nodeTypes` | App.js:29004 / 35014 | 节点类型映射 / 注册 |
| `li`(image) / `Ya`(prompt) / `Qa`(text) / `Do`(video) / `ms`(custom) / `Ms`(rhWebapp) | App.js:1264 / 2376 / 3705 / 7005 / 11947 / 13002 | 各节点组件 |
| `sr` / `Jn` | App.js:32673 / 30377 | 生图触发 / 生图实现 |
| `ur` / `er` | App.js:32754 / 31883 | 生视频触发 / 生视频实现 |
| `zc` | gatewayProxy.js:3 | 网关 fetch 包装 |
| `ii` | localToolClient.js:128 | 结果本地 URL 转换 |
| `Xr` / `Zr` | localToolClient.js:42 / 67 | 18080 落盘 |
| `Gn`(addTransitResource) | App.js:30222 | 登记中转资源 |
| 内联轮询 / 全局轮询 | App.js:30888 / 13435 | task_id 轮询循环 |
| 全局任务 SUCCESS 落盘 | App.js:13486 / 13522 | Xr(tasks) + addTransitResource |
| `DEFAULT_ENDPOINT`(:9004) | config.js:30 | 网关基址 |
