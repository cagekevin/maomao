import type { OperationFailure } from './outcome';
import type { TScene } from './timeline';

export type TBackground =
  | {
      type: 'color';
      color: string;
    }
  | {
      type: 'blur';
      blurIntensity: number;
    };

export interface TCanvasSize {
  width: number;
  height: number;
}

export interface TProjectMetadata {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TProjectSettings {
  fps: number;
  canvasSize: TCanvasSize;
  originalCanvasSize?: TCanvasSize | null;
  background: TBackground;
}

export interface TTimelineViewState {
  zoomLevel: number;
  scrollLeft: number;
  playheadTime: number;
}

/**
 * 剪辑工程（持久化根对象）。
 *
 * 【已删字段：`agentMessages`（TD-22-28）】它随 AI 域于 2026-09-14 删除而失效：
 * `ProjectManager.saveCurrentProject` 早已不写它，值**恒为 `[]`**，类型被退化成 `unknown` 占位；
 * 但 storage 层仍在 序列化/反序列化 时**永久往返**它（等于给一个不存在的功能留了回声）。
 * 【为什么删得掉、无需迁移】旧存储里即使残留该键，反序列化只是**忽略多余键**（不会报错），
 * 新写入的工程不再带它 —— 读旧数据/写新数据都安全，故不写迁移。
 */
export interface TProject {
  metadata: TProjectMetadata;
  scenes: TScene[];
  currentSceneId: string;
  settings: TProjectSettings;
  version: number;
  timelineViewState?: TTimelineViewState;
}

export type TProjectSortKey = 'createdAt' | 'updatedAt' | 'name' | 'duration';
export type TSortOrder = 'asc' | 'desc';
export type TProjectSortOption = `${TProjectSortKey}-${TSortOrder}`;

/**
 * 保存失败原因词表（机器可判）。
 *   · `conflict`     —— 服务端版本冲突（409），**本次一个字节未写**
 *   · `save-failed`  —— 存储 / 网络 / 代码异常
 *   · `paused` / `no-project` / `loading` / `migrating` —— 前置条件不满足，**保存未被执行**
 *     （这些原本是 `SaveManager` 里的静默 `return`：`await flush()` 返回了，但什么都没发生 —— TD-22-33）
 */
export const SAVE_FAIL_REASONS = [
  'conflict',
  'save-failed',
  'paused',
  'no-project',
  'loading',
  'migrating',
] as const;
export type SaveFailReason = (typeof SAVE_FAIL_REASONS)[number];

export type SaveFailure = OperationFailure<SaveFailReason>;

/**
 * 保存结果（判别联合）。
 *
 * 【收口（TD-22-33）】`flush()` 原返回 `Promise<void>`：`isSaving` 期间调用会**静默空转**
 * （`saveNow` 开头 `if (this.isSaving) return`），而 `saveCurrentProject` 又把失败吞掉 ——
 * 于是 `await flush()` 返回**既不代表执行了、也不代表成功了**。退出协议 / 切工程都靠它，
 * 结果是「退出前最后一次改动丢失」。现在成败由本类型表达。
 */
export type SaveOutcome = { ok: true } | SaveFailure;
