/**
 * 图片能力域门面 —— `src/components/image/` 的唯一对外出口（ADR-0039 N5：域目录必须有门面，跨域只准走门面）。
 *
 * 【域边界】`cat = 'image'`（产品 `NodePalette.paletteNodes` 写死的权威真源）的 8 个节点，
 * 加上它们专用的编辑器与 hover 动作：
 *   · `nodes/`     8 个图片类节点（ImageGenerate · ImageBoxNode · GridSplitNode · GridMergeNode
 *                  PanoramaNode · FaceMosaicNode · LoopNode · AssetNode）
 *   · `editors/`   11 件编辑器（ImageEditor · InlineImageCropper · OverlayEditor · FaceMosaicEditor
 *                  PanoViewer · CameraStudioPanel · cameraStudio · cameraParams/）—— 子域门面见 `editors/index.ts`
 *   · `useImageHoverActions.tsx`  图片 hover 动作入口（裁剪 / 标记 / 压缩），**域内件，不对外**
 *
 * 【为什么 `canvas/editors/` 没了】§7 已判它**不是独立域** —— 那 11 件全挂在图片类节点上，
 * 是图片能力的工具（用户判例：相机是「图片生成节点下面的一个按钮」）。旧目录 `components/editors/`
 * 已删除，**不留同名目录**。
 *
 * 【对外只露什么】**节点组件本身**（供 `canvas/NodePalette` 注册用）。编辑器子域的符号属域内实现，
 * 域外需要时走 `editors/index.ts`；本门面不重复导出，避免宽门面（ADR-0039「宽门面 = 假收口」）。
 *
 * 【例外 · 装配期配置（ADR-0039 N5 允许）】`canvas/lazyNode.tsx` 里的
 * `import('@/components/image/nodes/PanoramaNode')` 是**动态 import**（代码分割需要字面路径），
 * 无法走门面 —— 已在 `lazyNode.tsx` 处按装配期配置处理，不受本门面约束。
 */

/* 图片类节点（供画布注册） */
export { default as ImageGenerate } from './nodes/ImageGenerate.tsx';
export { default as ImageBoxNode } from './nodes/ImageBoxNode.tsx';
export { default as GridSplitNode } from './nodes/GridSplitNode.tsx';
export { default as GridMergeNode } from './nodes/GridMergeNode.tsx';
export { default as FaceMosaicNode } from './nodes/FaceMosaicNode.tsx';
export { default as LoopNode } from './nodes/LoopNode.tsx';
export { default as AssetNode } from './nodes/AssetNode.tsx';
