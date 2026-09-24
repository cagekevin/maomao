/**
 * 图片能力域 · **编辑器子域门面** —— `src/components/image/editors/` 的对外出口。
 *
 * 【为什么在这里】§7 已判「`components/editors/` 不是独立域」—— 这 11 件**全挂在图片类节点上**
 * （`refs` 实测），是**图片能力的工具**；用户判例：相机是「图片生成节点下面的一个按钮」。
 * ⇒ 原 `components/editors/` 目录已删除，不留同名目录。
 *
 * 【层级】`image/index.ts`（域门面）→ **本文件（子域门面）** → 各编辑器实现件。
 * 本子域 ≥3 件 ⇒ 子域成立。
 *
 * 【本子域的语义（2026-09-25 明确）】**多宿主共享的编辑器** ——
 * 判据不是"它是不是编辑器"，而是"**同一份能力被 ≥2 个宿主消费吗**"：
 *  - `ImageEditor` / `InlineImageCropper` → `AssetNode` + `ImageGenerate` ✅
 *  - `CameraStudioPanel` → `AssetNode` + `ImageGenerate` ✅
 *  - `PanoViewer` / `OverlayEditor` / `FaceMosaicEditor` → 单宿主 ⚠️（前两者待重审）
 * ⛔ 单宿主能力的编辑器**不该在这里**，该与它的宿主节点同处一个**能力片**目录
 * （范本 `video/depthVideo/`：编辑器 + engine + loader 同居）。
 * 首个试点：`image/faceMosaic/`（2026-09-25，见 `docs/plan/148` §十一）。
 *
 * 【宽窄红线】只露域外真实需要的符号；域内件（`cameraParams.css` 等）不暴露。
 */

/* 查看 / 裁剪 / 全景 */
export { default as ImageEditor } from './ImageEditor.tsx';
export { default as InlineImageCropper } from './InlineImageCropper.tsx';
export { default as PanoViewer } from './PanoViewer.tsx';
export type { PanoViewerHandle } from './PanoViewer.tsx';

/* 图层编辑 */
export { default as OverlayEditor, renderOverlayCanvas } from './OverlayEditor.tsx';
export type { OverlayState } from './OverlayEditor.tsx';

/* 相机（面板 + 参数选择器 + 提示词装配 + 类型） */
export { default as CameraStudioPanel } from './CameraStudioPanel.tsx';
export { default as CameraSettingsSelector } from './cameraParams/CameraSettingsSelector.tsx';
export { applyCameraSettingsToPrompt } from './cameraParams/cameraPrompt.ts';
export type { CameraGenerationSettings } from './cameraParams/types.ts';
export type { CameraStudioResult } from './cameraParams/cameraStudio.ts';

/* ⛔ 人像打码（FaceMosaicEditor）已于 2026-09-25 **迁出本子域**，故此处不再导出：
 *  它是**能力片**（节点 + 编辑器 + 算法同处），落 `image/faceMosaic/`。
 *  唯一消费者 `FaceMosaicNode` 现在与它**同目录** ⇒ 直连，不经本子域门面
 *  （`ADR-0044` §8②：无用例可承载 ⇒ 消费者直连能力片）。
 *  【判据】`editors/` 的语义 = **多宿主共享的编辑器**（如 `ImageEditor` 被 AssetNode +
 *  ImageGenerate 共用）。打码编辑器只有 1 个宿主 ⇒ 按 `ADR-0042` D6
 *  「按**能力**聚，不按**形态**聚」重组，见 `docs/plan/148` §十一。 */

/* AI 抠图（交互式分割，SAM-HQ；能力片见 image/lib/matting/） */
export { default as MattingEditor } from './MattingEditor.tsx';
