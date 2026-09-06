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
 */
export const UPLOAD_DIRS = {
  tasks: 'tasks', // 生成结果（生成面板读 uploads/tasks）
  web: 'web', // 网页拖图本地化
  canvas: 'canvas', // 主画布内部图 / 外部化 base64 通用落盘
  canvasDrop: 'canvas/drop', // 拖放上传（嵌套，保持）
  videoProcess: 'canvas/video-process', // 视频帧处理（嵌套，保持）
  migrated: 'migrated', // 迁移 / 导入
  director3d: 'director3d', // 新增：director3d 工程素材（docs/45 批次A）
};
