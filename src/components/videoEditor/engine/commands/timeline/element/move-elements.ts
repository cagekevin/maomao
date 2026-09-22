import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type {
  TimelineTrack,
  TimelineElement,
  TrackType,
  VideoTrack,
} from '@/components/videoEditor/types/timeline';
import {
  buildEmptyTrack,
  isMainTrack,
  validateElementTrackCompatibility,
  enforceMainTrackStart,
} from '@/components/videoEditor/engine/timeline/track-utils';
import { cleanupTransitionsForTrack } from '@/components/videoEditor/engine/timeline/transition-utils';

export class MoveElementCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(
    private sourceTrackId: string,
    private targetTrackId: string,
    private elementId: string,
    private newStartTime: number,
    private createTrack?: { type: TrackType; index: number },
  ) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const sourceTrack = this.savedState.find((t) => t.id === this.sourceTrackId);
    const element = sourceTrack?.elements.find((el) => el.id === this.elementId);

    // ── 以下三处守卫为**内部不变量防御**（2026-09-17 TD-22-63 取证后证伪，非"漏加提示"）：
    // ① 源轨/元素缺失：drop 目标由 `computeDropTarget`（drop-utils）在 mousemove 时从同一 tracks
    //    快照算出，且 mouseup 侧 hook（use-element-interaction）先做存在性检查才调用本命令；
    //    能走到这里 = 拖拽期间状态被并发改掉（如拖拽中撤销删轨）—— 非用户可达的正常路径。
    // ② 类型不兼容：`computeDropTarget` 内置 `canElementGoOnTrack`（`track-utils`，TD-22-70 起为
    //    **唯一实现**）过滤 + `findBestCompatibleTrack` 回退 + 新建同型轨道，UI 给不出不兼容目标；
    //    `validateElementTrackCompatibility` 是第二道闸。
    // ⇒ 失败若发生是**内部状态漂移的 bug**，读者是开发者（logger.error）；对用户弹 toast
    //   无可行动作（"重试拖拽"解决不了状态漂移），且拖拽是高频操作 —— 弹窗即噪音。保留 logger。
    if (!sourceTrack || !element) {
      videoEditorLogger.error('Source track or element not found');
      return;
    }

    let targetTrack = this.savedState.find((t) => t.id === this.targetTrackId);
    let tracksToUpdate = this.savedState;
    if (!targetTrack && this.createTrack) {
      const newTrack = buildEmptyTrack({
        id: this.targetTrackId,
        type: this.createTrack.type,
      });
      tracksToUpdate = [...this.savedState];
      tracksToUpdate.splice(this.createTrack.index, 0, newTrack);
      targetTrack = newTrack;
    }
    if (!targetTrack) {
      videoEditorLogger.error('Target track not found');
      return;
    }

    const validation = validateElementTrackCompatibility({
      element,
      track: targetTrack,
    });

    if (!validation.isValid) {
      videoEditorLogger.error(validation.errorMessage);
      return;
    }

    const adjustedStartTime = enforceMainTrackStart({
      tracks: tracksToUpdate,
      targetTrackId: this.targetTrackId,
      requestedStartTime: this.newStartTime,
      excludeElementId: this.elementId,
    });

    const movedElement: TimelineElement = {
      ...element,
      startTime: adjustedStartTime,
    };

    const isSameTrack = this.sourceTrackId === this.targetTrackId;

    let updatedTracks = tracksToUpdate.map((track) => {
      if (isSameTrack && track.id === this.sourceTrackId) {
        return {
          ...track,
          elements: track.elements.map((el) => (el.id === this.elementId ? movedElement : el)),
        };
      }

      if (track.id === this.sourceTrackId) {
        return {
          ...track,
          elements: track.elements.filter((el) => el.id !== this.elementId),
        };
      }

      if (track.id === this.targetTrackId) {
        return {
          ...track,
          elements: [...track.elements, movedElement],
        };
      }

      return track;
    }) as TimelineTrack[];

    if (!isSameTrack) {
      const sourceTrackAfterMove = updatedTracks.find((track) => track.id === this.sourceTrackId);
      if (
        sourceTrackAfterMove &&
        sourceTrackAfterMove.elements.length === 0 &&
        !isMainTrack(sourceTrackAfterMove)
      ) {
        updatedTracks = updatedTracks.filter((track) => track.id !== this.sourceTrackId);
      }
    }

    // remove stale transitions after element move
    updatedTracks = updatedTracks.map((track) => {
      if (track.type !== 'video') return track;
      return cleanupTransitionsForTrack({ track: track as VideoTrack });
    }) as TimelineTrack[];

    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
