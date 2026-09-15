import type { OperationFailure } from './outcome';

export const EXPORT_QUALITY_VALUES = ['low', 'medium', 'high', 'very_high'] as const;

export const EXPORT_FORMAT_VALUES = ['mp4', 'webm'] as const;

export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];
export type ExportQuality = (typeof EXPORT_QUALITY_VALUES)[number];

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  fps?: number;
  includeAudio?: boolean;
  onProgress?: ({ progress }: { progress: number }) => void;
  onCancel?: () => boolean;
}

/** 导出失败原因词表（机器可判；消费方按此分支，禁靠 message 猜）。 */
export const EXPORT_FAIL_REASONS = [
  'no-active-project',
  'empty-timeline',
  'not-video',
  'cancelled',
  'no-buffer',
  'unknown',
] as const;
export type ExportFailReason = (typeof EXPORT_FAIL_REASONS)[number];

/**
 * 导出结果（**判别联合**）。
 *
 * 【收窄（TD-22-38②）】原为全可选宽松形状 `{ success?; buffer?; error?; cancelled? }` ——
 * `success:true` 且 `buffer` 缺失的组合在类型上合法，两个消费端
 * （`export-button.tsx` / `use-editor-actions.ts`）因此都写了 `!success || !buffer` 双检，
 * 而双检的 else 分支**静默无反应**（popover 卡在导出完成态）。
 * 实际 `RendererManager.exportTracks` 一直保证「成功必有 buffer」，取消走独立分支 ——
 * 本类型现在把这个**既有不变量写进类型**（实现本就如此，零行为变化），
 * 消费端可以只判一次（先 `!ok`，再按 `reason === 'cancelled'` 区分取消）。
 */
export type ExportResult = { ok: true; buffer: ArrayBuffer } | OperationFailure<ExportFailReason>;
