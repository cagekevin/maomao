/**
 * 图像编辑域门面 —— `src/components/editors/` 的**唯一对外出口**。
 *
 * 【域边界】域根 = `components/editors/`（与 `agent/` · `canvas/` · `creative/` · `video/` ·
 * `videoEditor/` 同级）。按 `docs/DOMAIN-MODULES.md §2.3 P2`：**域边界由「关注点」定，不由
 * 「消费者」定** —— 本域是「图像查看/裁剪/全景/图层/相机/打码」这一坨能力，
 * 画布节点只是它的 **UI 入口**，不是它的归属。
 *   · 查看/裁剪：`ImageEditor` · `InlineImageCropper` · `PanoViewer`
 *   · 图层编辑：`OverlayEditor`（含 `renderOverlayCanvas` 纯函数）
 *   · 相机：`CameraStudioPanel` · `cameraStudio.ts` · `cameraParams/`（选择器 + 提示词 + 类型）
 *   · 打码：`FaceMosaicEditor`
 *
 * 【🔴 前置剥离（D18 裁定 · 本批执行）】`ImageZoomDialog` 已**移出本域** ⇒ `base/ui/`
 * （`base/editors/ImageZoomDialog.tsx` → `base/ui/ImageZoomDialog.tsx`）。
 * 判据：它有 **10 个消费方横跨 canvas/agent/scriptbox/base-panels**，是**横切件**而非本域私有物；
 * 留在域内会让 `base/panels`（横切）反向依赖本域 ⇒ 违反规则 2。
 *
 * 【建面判据（§2.7 二级判据）】域外消费点直连的是**实现件**（`cameraStudio` · `cameraParams/types`
 * 这类），不是天然入口 ⇒ **必建**。域外消费者（`refs` 实测 6 个文件 · 12 处 import）：
 * `canvas/nodes/{AssetNode,FaceMosaicNode,GridMergeNode,PanoramaNode,ImageGenerate,useImageHoverActions}`。
 *
 * 【宽窄红线】只露域外**真实需要**的 13 个符号；域内件（`cameraParams.css` 等）不暴露。
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
export type { CameraStudioResult } from './cameraStudio.ts';

/* 打码 */
export { default as FaceMosaicEditor } from './FaceMosaicEditor.tsx';
