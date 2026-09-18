# PRD：图片 URL 统一出口收口

> 状态：细化稿 v2（已核对代码真实行号）
> 关联修复：`226d20f` —— 缩略图端点由返回 JSON 改为返回图片二进制（破图致命根因已修）
> 范围：排除所有 director3d 相关目录与组件（用户标注不常用）

---

## 1. 背景与问题

猫猫 AI 画布中图片 URL 存在两条使用场景，但此前各组件各自拼 URL、各自判断
`data:/blob:/相对路径`，未统一收口，导致：

1. 缩略图开关打开后破图（已修致命一处：缩略图端点返回 JSON → 改为返回二进制）。
2. 面板侧、部分节点仍裸用 `resultUrl` / `imageUrl` / `toAbsoluteFileUrl`，**缩略图开关不生效**。
3. 画布环境（chrome-extension / 跨端口 localhost）下相对 `/files/` 路径被错误解析 → 破图。
4. 发送侧参考图未归一，blob: 临时地址喂网关 → 丢参考图。

## 2. 核心原则（两条路径，铁律）

| 路径 | scope | 行为 | 唯一出口 |
|---|---|---|---|
| **显示** | `render` | 一律走**缩略图**（按需出图端点，已修复为返回二进制） | `resolveImageUrl(url, {scope:'render'})` / `useRenderImageResolver()` |
| **发送** | `send` | 一律走**原图**（blob→dataURL、相对 `/files/`→绝对 http 原图地址，**绝不发送缩略图**） | `normalizeImageUrlForSend` / `normalizeImageUrlsForSend` |

铁律：
- 显示侧任何 `<img src>` / `<video src>` / `background-image` 不得裸用节点或后端原始 URL，必须经过 `render` 出口。
- 发送侧任何喂给 AI/网关的图片数组，必须经过 `send` 出口，**禁止发送缩略图端点 URL**。
- 不得硬编码 `http://127.0.0.1:18080/files/` 或 `/api/files/thumbnail` 字面量。
- `resolveImageUrl` / `useRenderImageResolver` 实现于 `src/components/base/imageUrl.js`（hook 在第 104 行，函数第 89 行）；`normalizeImageUrl(s)ForSend` 同文件（第 187 / 204 行）。**统一从这里 import，不要再 import `filesApi.js` 的 `toAbsoluteFileUrl` 当显示出口**（`toAbsoluteFileUrl` 只补绝对路径、不走缩略图，仅用于下载/复制等非显示场景）。

## 3. 模块拆解与改动点（已核对真实行号）

### M1 显示链路·基础设施收口（覆盖最广，优先做）

**M1.1 `src/components/base/LazyImage.jsx`**（全画布复用组件）
- 现状：第 2 行 `import { toAbsoluteFileUrl } from './filesApi.js'`；第 21 行 `const resolvedSrc = toAbsoluteFileUrl(src || '')`。
- 改动：改用 `resolveImageUrl` 走缩略图。新增可选 prop `thumbnail`（默认读取设置），内部 `resolvedSrc = resolveImageUrl(src || '', { scope: 'render', thumbnail })`。
  - 注意：LazyImage 是纯展示组件，不能直接调用 hook `useRenderImageResolver`（避免调用方在循环里用）。改为从 `imageUrl.js` import `resolveImageUrl` 并读 `useAppSettings().thumbnailOn`，或在组件内用 `useRenderImageResolver()`（LazyImage 本身是组件，可用 hook）。**推荐：组件内 `const resolve = useRenderImageResolver()`，第 21 行改为 `resolve(src || '')`**。
- 影响面：素材库 / 生成视图 / 任务中心缩略图 / 素材条 全部经此自动收口 + 缩略图生效。需回归这些面板。

**M1.2 `src/components/base/TaskCenter.jsx`**
- 现状：第 319 行 `<img src={task.resultUrl} ... />`（图片结果裸用，相对 `/files/` 在画布环境必破）。
- 改动：第 319 行 `src={task.resultUrl}` → `src={resolveImageUrl(task.resultUrl, { scope: 'render' })}`（import `resolveImageUrl` 自 `imageUrl.js`）。视频走 VideoThumbnail（M1.3），不在此改。

**M1.3 `src/components/base/VideoThumbnail.jsx`**
- 现状：第 31 行 `<video src={src} ...>`（完全没补 URL，相对路径破视频）。
- 改动：视频不缩略，仅补绝对路径：`src={toAbsoluteFileUrl(src)}`、`poster={poster ? toAbsoluteFileUrl(poster) : poster}`。import 自 `imageUrl.js` 的 `toAbsoluteFileUrl`（保持原语义，不套缩略图）。

### M2 显示链路·节点侧补全

| 文件 | 行号 | 现状 | 改动 |
|---|---|---|---|
| `nodes/ImageBoxNode.jsx` | 483 | `<img src={toAbsoluteFileUrl(current.url)}>` 单图裸用，缩略图失效 | → `resolveImageUrl(current.url, {scope:'render'})`；import 改自 `imageUrl.js` |
| `nodes/ImageBoxNode.jsx` | 560 | `<LazyImage src={toAbsoluteFileUrl(img.thumb \|\| img.url)}>` 网格 | `toAbsoluteFileUrl` → 去掉，直接 `src={img.thumb \|\| img.url}`（LazyImage 内部已走缩略图，M1.1 改完后自动生效） |
| `nodes/PanoramaNode.jsx` | 283 | `<img src={panoUrl}>` 全景图裸用，相对路径直接破图 | → `resolveImageUrl(panoUrl, {scope:'render'})`；import 自 `imageUrl.js` |
| `nodes/GridSplitNode.jsx` | 947 | 全屏切刀弹层裸 `imageUrl` | → `resolveImageUrl(imageUrl, {scope:'render'})` |
| `nodes/TemplateNode.jsx` | 356 | 弹层裸 `imageUrl` | → `resolveImageUrl(imageUrl, {scope:'render'})` |
| `nodes/PromptNode.jsx` | 321, 455 | 弹层裸 `imageUrl` / `data.poster` | → `resolveImageUrl(...)` |
| `nodes/ImageNode.jsx` | 164, 341 | 弹层裸 `imageUrl` | → `resolveImageUrl(...)` |
| `nodes/GridMergeNode.jsx` | 419 | 弹层裸 `imageUrl` | → `resolveImageUrl(...)` |

> 注：节点主显示区若已用 `useRenderImageResolver()` 则不动；仅「弹层 / 放大 / 全屏」分支裸用需补。改动前先 grep 确认该文件是否已在别处 import `useRenderImageResolver`。

### M3 发送链路·参考图归一

| 文件 | 行号 | 现状 | 改动 |
|---|---|---|---|
| `base/useConnectedInputs.js` | 177 | 注入下游生图的参考图未走 send 出口 | 参考图数组过 `normalizeImageUrlsForSend` |
| `canvasPlanExecutor.js` | 281 | 同上 | 同上 |
| `scriptBoxEngine.js` | 639, 724 | 同上 | 同上 |

- 调用形式：发送前 `const refs = await normalizeImageUrlsForSend(rawRefs)`，再喂网关。
- 原则：**发送一律原图**，即使缩略图开关开着，也绝不把 `buildThumbnailUrl` 产物发过去。`normalizeImageUrlForSend` 当前实现（imageUrl.js 第 187 行）原本就走原图绝对地址 / blob→dataURL，不碰缩略图，天然正确，只需确保调用点统一收口。

### M4 复制/导出微调（低风险，可缓，不阻塞本次）

- `base/clipboard.js`：复制图片前 `toAbsoluteFileUrl` 补全（复制走原图绝对路径，正确）。
- `nodes/ImageBoxNode.jsx:212`：上游取图 `startsWith('http') || startsWith('data:image')` 过滤过严，可放宽以兼容 `/files/` 上游。
- `AgentPanel` 散写 `FileReader` 转 base64 → 收口到 `imageUrl.js` 的 `urlToDataUrl` / `blobToDataUrl`。

## 4. 验收标准

- [ ] 打开缩略图开关：画布节点、素材库、生成视图、任务中心、素材条、ImageBox 网格全部显示缩略图，无破图。
- [ ] 关闭缩略图开关：上述所有位置显示原图，无破图。
- [ ] 画布环境（extension / 跨端口）下显示正常（相对 `/files/` 已补全为绝对）。
- [ ] 发送给 AI/网关的参考图为原图绝对地址 / dataURL，**不含任何 `/api/files/thumbnail` 端点 URL**。
- [ ] 视频在 TaskCenter / VideoThumbnail 正常播放（绝对路径补全）。
- [ ] 全景图正常显示（缩略图端点对全景大图生效，或回退原图不破）。

## 5. 风险与陷阱

- **LazyImage（M1.1）改动影响面极大**：它是素材库/生成/任务中心/素材条共用的展示组件，改后必须回归这四个面板，确认缩略图端点返回二进制能正常被 `<img>` 解码（端点在 `226d20f` 已修）。
- **发送侧误发缩略图**：M3 重点防。若某处把 `resolveImageUrl(scope:'render')` 的结果当参考图发出去，网关拿到的会是按需出图端点 URL（可能 404 或拿到小图），参考图丢失。M3 所有调用点必须用 `normalizeImageUrlsForSend`，绝不用 `resolveImageUrl`。
- **视频不缩略**：M1.3 仅补绝对路径，勿误套 `resolveImageUrl(scope:'render')`（会把视频 src 改成图片缩略图端点 → 破）。
- **`toAbsoluteFileUrl` 两处来源**：`filesApi.js` 与 `imageUrl.js` 都有同名函数，语义相同但 `imageUrl.js` 是统一出口。显示场景一律从 `imageUrl.js` import，避免后期又分裂。
- **hook 不能进循环**：网格格元里不要调用 `useRenderImageResolver()`（hook 规则），应调用 `resolveImageUrl(url, {scope:'render', thumbnail})` 并手动传 `thumbnail` 值，或用 `LazyImage` 包裹（LazyImage 内部用 hook，调用方在循环里只传 prop 即可）。

## 6. 实施顺序建议

1. **M1（基础设施）** → 一次性覆盖最大面，先验证缩略图端点修复在面板侧真的生效。
2. **M2（节点侧）** → 逐个节点补 `render` 出口，消除破图。
3. **M3（发送侧）** → 参考图归一，防网关丢图。
4. **M4（复制/导出）** → 低风险，可后续单独 PR。

每个模块改完跑一次 `npm run build` + 单测；M1/M2 完成后手动在画布里开关缩略图验证显示。
