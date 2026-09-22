/**
 * 视频域门面 —— `src/components/video/` 的唯一对外出口。
 *
 * 【域边界 · 当前为**部分成型**】域根 = `components/video/`（与 `agent/` · `canvas/` ·
 * `creative/` · `videoEditor/` 同级）。按 `docs/DOMAIN-MODULES.md §3.1.1 / §3.1.3.5`：
 *   · 已入驻：`depthVideo/`（深度视频子域 · 5 件：`DepthVideoModal` · `spawn` · `engine` ·
 *     `loader` · `depthUrls`）
 *   · 已入驻：`lib/`（4 件：`videoEngine` · `sourceTime` · `timeScale`，2026-09-19 域归位迁入；
 *     `resolutionPresets`，2026-09-22 TD-22-71 收口新建 —— 均 video 单域消费，ADR-0040 L4）
 *   · 已入驻：`nodes/`（3 件：`VideoGenerate` · `VideoExtractNode` · `VideoProcessNode`）
 *   · **已裁定留原处（不得重审）**：`base/utils/captureFrame`（跨 scriptbox+video，真横切）·
 *     `base/ui/VideoThumbnail`（真横切）· `base/core/videoEditorKeys`（键构造 SSOT，TD-25-7 非债）·
 *     `src/hooks/useVideoPoster`（跨 agent/image/video/videoEditor ≥3 域，真横切）
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
