import { getDropLineY } from '@/components/videoEditor/engine/timeline/drop-utils';
import type { TimelineTrack, DropTarget } from '@/components/videoEditor/types/timeline';

interface DragLineProps {
  dropTarget: DropTarget | null;
  tracks: TimelineTrack[];
  isVisible: boolean;
  headerHeight?: number;
  /** 轨道高度倍率（TD-21-16）——落点线 Y 必须与渲染同口径。缺省 = 1。 */
  trackHeightScale?: number;
}

export function DragLine({
  dropTarget,
  tracks,
  isVisible,
  headerHeight = 0,
  trackHeightScale,
}: DragLineProps) {
  if (!isVisible || !dropTarget) return null;

  const y = getDropLineY({ dropTarget, tracks, scale: trackHeightScale });
  const lineTop = y + headerHeight;

  return (
    <div
      className="bg-primary pointer-events-none absolute right-0 left-0 z-50 h-0.5"
      style={{ top: `${lineTop}px` }}
    />
  );
}
