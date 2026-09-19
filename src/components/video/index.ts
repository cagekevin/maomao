/**
 * 视频域门面 —— `src/components/video/` 的唯一对外出口。
 *
 * 【域边界 · 当前为**部分成型**】域根 = `components/video/`（与 `agent/` · `canvas/` ·
 * `creative/` · `videoEditor/` 同级）。按 `docs/DOMAIN-MODULES.md §3.1.1 / §3.1.3.5`：
 *   · 已入驻：`depthVideo/`（深度视频子域 · 5 件：`DepthVideoModal` · `spawn` · `engine` ·
 *     `loader` · `depthUrls`）
 *   · **待迁入**（§3.1.3.5 实测「视频零件散 7 处」，后续批次补）：`base/utils/{videoEngine,captureFrame}` ·
 *     `base/utils/timeline/{sourceTime,timeScale}` · `base/ui/VideoThumbnail` ·
 *     `hooks/useVideoPoster` · `base/core/videoEditorKeys` · `canvas/nodes/{VideoGenerate,VideoExtract,VideoProcess}`
 *
 * 【建面判据（§2.7 二级判据）】域外消费点直连的是**实现件**（`DepthVideoModal` · `spawn`），
 * 不是天然入口 ⇒ **必建**。域外消费者（`refs` 实测 2 处）：`canvas/nodes/AssetNode` ·
 * `canvas/nodes/VideoGenerate` —— 同一「深度视频」能力被 **2 个不同宿主**消费，
 * 正是 §2.3.1 P4 判据（≥2 宿主消费 ⇒ 必是独立能力，不是某宿主的私有物）。
 *
 * 【宽窄红线】只露域外**真实需要**的 2 个符号；域内件（`engine` · `loader` · `depthUrls`）不暴露。
 */
export { DepthVideoModal } from './depthVideo/DepthVideoModal.tsx';
export { spawnDepthVideoNode } from './depthVideo/spawn.ts';
