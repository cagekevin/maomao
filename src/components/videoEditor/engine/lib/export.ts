import { EXPORT_MIME_TYPES } from '@/components/videoEditor/constants/export-constants';
import type { ExportFormat } from '@/components/videoEditor/types/export';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { formatTimeCode } from '@/components/videoEditor/engine/lib/time';

/**
 * 「导出**选中**片段」的入参：把选中元素拆成一条**自足**的单轨时间轴。
 *
 * 【判据：显式选中优先于 `hidden`】单条导出的语义是"把**这一条**导出来"，
 * 而 `hidden` 的语义是"在**整片输出**里不出现"—— 两者冲突时以显式动作为准，
 * 故此处把该轨与该元素的 `hidden` 清成 `false`（与"重置 `startTime`、丢弃 `transitions`"
 * 同属"脱离整片语境单独出这一条"）。
 *
 * ⚠️ **不清的后果是「假成功」**：`buildScene` 经 `getOutputTracks` 把 hidden 项当
 * "不参与输出"滤掉 ⇒ 渲染树 0 个子节点 ⇒ 导出**全黑**却报「片段已导出」（用户拿到黑片、
 * 且 toast 说成功）。清掉即不再有这条路径。
 */
export function getSelectedVideoClip({
  tracks,
  selection,
}: {
  tracks: TimelineTrack[];
  selection: { trackId: string; elementId: string };
}): { tracks: TimelineTrack[]; duration: number } | null {
  const track = tracks.find(({ id }) => id === selection.trackId);
  if (track?.type !== 'video') return null;

  const element = track.elements.find(({ id }) => id === selection.elementId);
  if (element?.type !== 'video') return null;

  return {
    duration: element.duration,
    tracks: [
      {
        ...track,
        hidden: false,
        transitions: [],
        elements: [{ ...element, startTime: 0, hidden: false }],
      },
    ],
  };
}

export function getExportMimeType({ format }: { format: ExportFormat }): string {
  return EXPORT_MIME_TYPES[format];
}

export function getExportFileExtension({ format }: { format: ExportFormat }): string {
  return `.${format}`;
}

export function getSelectedClipExportFilename({
  startTime,
  duration,
  fps,
  format,
}: {
  startTime: number;
  duration: number;
  fps: number;
  format: ExportFormat;
}): string {
  const filenameTime = (timeInSeconds: number) =>
    formatTimeCode({
      timeInSeconds,
      format: 'HH:MM:SS:FF',
      fps,
    }).replaceAll(':', '-');

  return `${filenameTime(startTime)}_to_${filenameTime(startTime + duration)}${getExportFileExtension({ format })}`;
}
