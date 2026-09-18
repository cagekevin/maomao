# PRD：monoform 白膜预演改造为画布 overlay 导演台

> 编号：37 · 日期：2026-08-23 · 状态：PRD 已完成（M1/M2/M3/M4/M5 全部细化）
> 本 PRD 即「写码 3 步法 State1 的需求级契约基线」：写码时逐条对照本文件约束。

## 1. 全局定位

- **做什么**：把开源独立 App `monoform-previs-studio` 改造成可嵌入无限画布（`@xyflow/react`）的 overlay 组件，替换现有 `src/components/director3d`（复刻版 storyai 导演台）。
- **给谁用**：maomao 画布使用者——放置"3D 导演台"节点，双击弹出全屏白膜预演界面，搭建场景、摆人物骨骼、打关键帧。
- **核心价值**：将功能更强的 monoform（67 骨骼、多镜头、双轨关键帧、真实 MP4 编码）无缝接入现有节点流，PNG/MP4 导出回写到画布图片盒子。

## 2. 核心模块

| # | 模块 | 职责 |
|---|------|------|
| M1 | Overlay 外壳 | 把 `App.jsx` 改造成受控 overlay 组件，暴露 `initialProject/initialPanoramaUrl/onExit` |
| M2 | 节点接入层 | 改造 `Director3DNode.jsx`：双击打开 → 渲染 overlay；退出回写画布 |
| M3 | 导出捕获桥 | 把 PNG/MP4 从"下载 Blob"改为"回传 dataUrl/Blob 给宿主" |
| M4 | 图片盒子回写 | 把截图/视频落盘为 `/files/` 绝对 URL，写入下游 `imageBoxNode` |
| M5 | 依赖与构建接入 | 把 monoform 源码并入 maomao，复用依赖，`npm run dev` 可跑 |

依赖链：`M5 → M1 → M3 → M2 → M4`（职责不重叠，边界清晰）。

## 3. 风险陷阱

- **T1** monoform 是自挂载独立 App（localStorage 存工程、自身管导出/退出），需大手术改造为受控组件，不能简单包裹。
- **T2** 旧 `directorProject` 与 monoform `.monoform.json` 数据格式不相容，旧节点数据必然丢弃。
- **T3** MP4 是大二进制 Blob，现有 `onCaptureToBox` 只处理 base64 图片；视频回写需独立落盘路径，避免爆 localStorage/快照。

## 4. 约束清单

### 4.1 M1 Overlay 外壳

| 约束 | 内容 | 支撑 | 验证标准 |
|------|------|------|----------|
| C1.1 | 导出受控组件 `MonoformOverlay({ nodeId?, onExport?, onExit? })`，命名导出；与 `main.jsx` 自挂载解耦 | X1 | 可被 `createPortal` 挂载，无自建 React root |
| C1.2 | 工程按节点独立存储：localStorage key = `monoform-project-<nodeId>`；空节点新建空工程，不读全局 `monoform-project` | X1/X4 | 多节点各自独立工程，互不串 |
| C1.3 | 退出唯一通道 `onExit({ thumbnailDataUrl?, captures? })`；顶部加"返回画布"按钮，关闭只调 `onExit`，无副作用下载/导航 | X1/X2 | 关闭只调 `onExit`，无副作用下载 |
| C1.4 | 独立于导出的"当前帧抓取"，退出时自动生成 `thumbnailDataUrl` | X2 | 未导出即关闭，缩略图仍有值 |
| C1.5 | **受控导出通道**：`App.jsx` 接受 `onExport` prop，`handleCaptureImage`/`handleExportMp4` 在下载前先把 `{ type, blob, fileName }` 交 `onExport`；宿主决定落盘/回写，浏览器可下载可不下载 | X2/X3 | 导出时宿主拿到 Blob，可回写画布 |

### 4.2 M2 节点接入层

| 约束 | 内容 | 支撑 | 验证标准 |
|------|------|------|----------|
| C2.1 | 双击/按钮 → `createPortal` 挂载 `MonoformOverlay` 到 body，`z-[9999]` 全屏；`initialProject` 不传 | X1/X4 | 双击后 overlay 全屏出现，无旧 director3d 痕迹 |
| C2.2 | `initialPanoramaUrl` 仅在 monoform 支持参考图注入时才传，否则置空 | X1 | 上游图连接不再静默失效 |
| C2.3 | 退出：`onExit` → 缩略图落盘 `/files/` 写 `data.imageUrl`；**彻底删除** `data.directorProject` | X2/X4 | 退出后节点 data 无 `directorProject` 键 |
| C2.4 | 关闭"先 await 落盘缩略图 → 再 setOpen(false)"，避免空图竞态 | X2 | 多次快速开关，缩略图始终非空 |
| C2.5 | `captures` 交 M4 落盘，M2 只转发不做存储决策 | X3 | M2 不直接存视频 base64/Blob |

### 4.3 M3 导出捕获桥

| 约束 | 内容 | 支撑 | 验证标准 |
|------|------|------|----------|
| C3.1 | PNG 导出改为生成 `dataUrl`（image/png）存入 `captures[]`，不再触发 `link.download` | X2 | 截图后浏览器无下载弹窗，`captures` 含该 dataUrl |
| C3.2 | MP4 导出（Mediabunny）完成时生成 `Blob` + `fileName`（`monoform-*.mp4`）存入 `captures[]`，不触发下载 | X3 | 编码完成浏览器无下载，`captures` 含 Blob |
| C3.3 | "编码中退出"保护：`onExit` 若检测到导出/编码进行中，阻断退出并提示"导出完成后返回" | X1 | 编码中返回按钮不可用或有明确提示 |
| C3.4 | 导出任务生命周期绑定 overlay：卸载时编码未完成则优雅取消并丢弃该次产物 | X3 | 编码中强关 overlay，不残留半成品 Blob |
| C3.5 | 每次导出前重置录制/离屏 canvas 状态，支持同一会话多次 PNG+MP4 导出 | X2 | 连续 PNG→MP4 导出，产物不串帧 |

### 4.4 M4 图片/视频回写

> 现状确认：`ImageNode`（图片节点）支持 image/video/audio/text 五种内容态，`data.mediaType` + `detectMediaType(url)` 判断类型，视频用 `<video>` + 首帧封面渲染。`ImageBoxNode` 仅支持图片。视频落盘用 `uploadFileToLocal`（File/Blob 直传，避免 dataUrl 大内存拷贝）。

| 约束 | 内容 | 支撑 | 验证标准 |
|------|------|------|----------|
| C4.1 | 图片：PNG dataUrl → `saveInlineToLocal` → `/files/` URL，写入下游 `imageBoxNode.images[]` | X2 | 截图出现于图片盒子，刷新不破图 |
| C4.2 | 视频：MP4 Blob → `uploadFileToLocal(blob)` → `/files/*.mp4` URL（不转 dataUrl） | X3 | MP4 落盘为可访问 `/files/` URL |
| C4.3 | 视频目标 = `ImageNode`：写入 `data.imageUrl` + `data.mediaType='video'`；下游无 ImageNode 则新建并连线 | X1/X3 | 退出后 ImageNode 可播放 MP4 |
| C4.4 | 每次落盘文件名带随机戳，避免同帧 sha1 去重合并 | X2 | 多次导出，画布可见全部独立产物 |
| C4.5 | 视频走 `uploadFileToLocal` 旁路，不改 `saveInlineToLocal` 签名 | X3 | 视频落盘走旁路成功，旧图片路径不变 |

### 4.5 M5 依赖与构建接入

| 约束 | 内容 | 支撑 | 验证标准 |
|------|------|------|----------|
| C5.1 | monoform 源码搬入 maomao 独立目录（如 `src/components/monoform/`），不混入现有 `App.jsx` | X1 | 目录隔离，现有画布组件不受影响 |
| C5.2 | 无需前缀隔离：`.app-shell` 等类名仅在待删除的 `director3d/styles/index.css` 中出现，删除旧 director3d 后 monoform 样式类名与 maomao 无冲突 | — | 删除旧目录后无重名类，样式互不污染 |
| C5.3 | branding 资源（图/model）搬入 maomao `public/`，BASE_URL 路径改写或资源内联 | X2 | 无 404 破图 |
| C5.4 | 依赖核对：three/r3f/drei/react/lucide/mediabunny 全部复用 maomao，无新增安装 | — | `npm ls` 确认全部存在且可 import |
| C5.5 | `npm run dev` 无编译错误，overlay 双击可渲染；`npm run build` 可出 production | — | 两端均通过 |

## 5. 跨模块约束

- **X1** 数据流单向：节点 → overlay(空工程) → 编辑 → 退出 onExit → 节点落缩略图 + 回写图片盒子
- **X2** 回写对象全部落盘 `/files/` 绝对 URL，禁止长 base64 进节点 data
- **X3** 视频走 Blob 落盘，绝不进 localStorage/快照
- **X4（修订）** 旧 `directorProject` 数据**整体删除**，从节点 data 彻底移除，不留占位、无兼容逻辑

## 6. 执行协议（写码阶段对照）

写码时按模块分批，每完成一个模块输出约束对照表：

```text
模块：[XXX]
✅ 约束 [C#]：[约束原文] → 已满足（[实现方式]）
❌ 约束 [C#]：[约束原文] → 未实现（[原因]）
```

全部模块打勾后交付完整代码。
