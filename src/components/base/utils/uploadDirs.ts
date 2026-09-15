/**
 * uploads/ 子目录中央常量表（docs/45 收口）。
 *
 * 目标：把散落在 filesApi / localToolApi / videoEngine / VideoProcessNode 的下挂在
 * 各落盘调用的 subfolder 字面量，统一收口到本表单一来源，杜绝「目录名不统一、后端不校验」。
 *
 * 硬约束：**一律不改名**——tasks/web/canvas/migrated 与嵌套 canvas/drop、canvas/video-process
 * 全部沿用现有值，避免任何存量 /files/... URL 与物理目录破链接。仅新增 director3d 一项。
 *
 * 后端白名单（可选）若实施，必须显式含上述六个值（尤其两个嵌套项），否则一上线即打爆拖图/视频帧。
 *
 * ⚠️ **改这里之前先读**：后端 `localTool/src/utils/fileStore.ts::UPLOAD_ROOT_ALLOW` 是**执行校验的一方**
 * （真源），它只认【顶层根】。新增/删除一个**顶层根**时**必须同时改两处** ——
 * 前端加了后端没加 ⇒ 落盘被后端拒（静默失败）；后端加了前端没加 ⇒ 该根永远传不出去（功能死）。
 * 嵌套子目录（`canvas/drop`）只影响本文件，后端不校验。
 *
 * 更新(2026-09-15)：原先这条"两端必须一致"由闸 `scripts/check-upload-dirs.mjs` 守。
 * 该闸已按用户裁定**删除**（实测常绿：两端各 5 个手写根，一年最多动一次，性价比不合格）。
 * 它的判据（集合对账）没有搬到别处 —— 换来的是**本注释 + 后端同款注释**：提醒放在"真正要动手的那一行旁边"，
 * 比一道几乎不会红的闸更贴近使用现场。若将来 uploads 顶层根开始频繁增删，应恢复该闸而不是靠注释。
 */
export const UPLOAD_DIRS = {
  tasks: 'tasks', // 生成结果（生成面板读 uploads/tasks）
  web: 'web', // 网页拖图本地化
  canvas: 'canvas', // 主画布内部图 / 外部化 base64 通用落盘
  canvasDrop: 'canvas/drop', // 拖放上传（嵌套，保持）
  videoProcess: 'canvas/video-process', // 视频帧处理（嵌套，保持）
  migrated: 'migrated', // 迁移 / 导入
  director3d: 'director3d', // 新增：director3d 工程素材（docs/45 批次A）
  videoEditor: 'canvas/video-editor', // 视频剪辑器（影片编辑）产物：与 videoProcess（帧处理）语义不同，故不复用；混目录后无法按目录清理/迁移
};
