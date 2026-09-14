/* ════════════════════════════════════════════════════════════════
 * 视频剪辑器存储键的**唯一真源**（docs/133 §2.2 收口）
 * ────────────────────────────────────────────────────────────────
 * 【为什么存在】与 agentKeys.ts 同因：前缀硬编码在多处 → 一旦漂移 →
 *   备份静默漏备/错备剪辑工程，且零报错（SSOT 第二份）。
 * 【纪律】禁任何模块再拼 `video_editor_` 字面量（X4）。
 * 存储键形状与 contracts.ts 的 STORAGE_KEYS 登记一致
 *   （那份是键名清单，本文件是键值构造器，二者同源描述同一真相）。
 * ════════════════════════════════════════════════════════════════ */
import {
  VIDEO_EDITOR_PROJECTS_PREFIX,
  VIDEO_EDITOR_ACTIVE_PREFIX,
  VIDEO_EDITOR_PROJECT_PREFIX,
} from './contracts.ts';

/** 画布项目 → 剪辑工程列表键。 */
export function videoEditorProjectsKey(projectId: string): string {
  return `${VIDEO_EDITOR_PROJECTS_PREFIX}${projectId || 'default'}`;
}

/** 画布项目 → 当前活跃剪辑工程 id 键。 */
export function videoEditorActiveProjectKey(projectId: string): string {
  return `${VIDEO_EDITOR_ACTIVE_PREFIX}${projectId || 'default'}`;
}

/** （画布项目, 剪辑工程 id）→ 单个工程本体键。 */
export function videoEditorProjectKey(projectId: string, editorId: string): string {
  return `${VIDEO_EDITOR_PROJECT_PREFIX}${projectId || 'default'}_${editorId}`;
}
