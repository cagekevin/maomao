import type { MediaAssetData } from '@videoEditor/engine/services/storage/types';
import type { OperationFailure } from './outcome';

export type MediaType = 'image' | 'video' | 'audio';

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
