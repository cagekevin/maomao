/**
 * 图片能力域 · **编辑器子域门面** —— `src/components/image/editors/` 的对外出口。
 *
 * 【为什么在这里】§7 已判「`components/editors/` 不是独立域」—— 这 11 件**全挂在图片类节点上**
 * （`refs` 实测），是**图片能力的工具**；用户判例：相机是「图片生成节点下面的一个按钮」。
 * ⇒ 原 `components/editors/` 目录已删除，不留同名目录。
 *
 * 【层级】`image/index.ts`（域门面）→ **本文件（子域门面）** → 各编辑器实现件。
 * 本子域 11 件 ≥3 ⇒ 子域成立。
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
export type { CameraStudioResult } from './cameraStudio.ts';

/* 打码 */
export { default as FaceMosaicEditor } from './FaceMosaicEditor.tsx';
