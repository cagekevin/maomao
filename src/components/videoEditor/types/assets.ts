import type { OperationFailure } from './outcome';

export type MediaType = 'image' | 'video' | 'audio';

/**
 * 素材的**持久化形态**（真正落存储的那些字段）。
 *
 * 【为什么定义在本文件（2026-09-15 · TD-22-31）】它原先住在
 * `engine/services/storage/types.ts`，而 `MediaAsset`（类型层）要 `Omit` 它
 * ⇒ **types 层反向 import engine 层**（层位倒置、埋循环依赖隐患）。
 * 它本身**零 engine 依赖**（只用到同层的 `MediaType`）⇒ 移到这里是把层位摆正，
 * 而 `engine/services/storage/types.ts` 改为 re-export，既有消费方零改动。
 * ⚠️ 本文件**不得** import `@videoEditor/engine*`（见同目录 `archLayering` 守卫）。
 */
export interface MediaAssetData {
  id: string;
  name: string;
  type: MediaType;
  size: number;
  lastModified: number;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  ephemeral?: boolean;
  thumbnailUrl?: string;
  /** T4（docs/134）：素材二进制落 localTool /files/ 后的可访问 URL（替代 OPFS 二进制存储）。 */
  url?: string;
}

export interface MediaAsset extends Omit<MediaAssetData, 'size' | 'lastModified'> {
  file: File;
  url?: string;
}

/**
 * `MediaManager.addMediaAsset` 结果（判别联合）。
 *
 * 【收口（TD-22-37 · 母体 M1 结果契约缺位）】原返回 `Promise<string>`：**保存失败也返回新 id**，
 * 调用方无法从返回值判成败 —— `use-timeline-drag-drop.ts` 只能靠
 * `getAssets().find(name && url)` **二次探测**确认素材真的在，TTS 路径更直接拿这个 id
 * 去插时间轴 → 产生**指向不存在素材的幽灵片段**。
 *
 * 成功支返回 `asset` 本体：调用方**不再需要**回数组里二次查对象（原二次探测的第二个成因）。
 */
export type AddMediaAssetOutcome =
  { ok: true; id: string; asset: MediaAsset } | OperationFailure<'save-failed'>;

/**
 * `MediaManager.loadProjectMedia` 结果（判别联合）。
 *
 * 【收口（TD-22-43）】原返回 `Promise<void>`：失败只记 logger → 用户看到**静默空面板**
 * （以为"这个工程没素材"）。`superseded` = 本次加载已被更新的加载取代
 * （正常的并发丢弃，**不是错误**，调用方不得据此提示用户）。
 */
export type LoadProjectMediaOutcome = { ok: true } | OperationFailure<'load-failed' | 'superseded'>;
