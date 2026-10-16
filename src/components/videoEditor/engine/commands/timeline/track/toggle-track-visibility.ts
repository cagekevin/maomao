import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import { canTrackBeHidden } from '@/components/videoEditor/engine/timeline';

export class ToggleTrackVisibilityCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private trackId: string) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const targetTrack = this.savedState.find((track) => track.id === this.trackId);
    // 【不可隐藏 ⇒ 提前返回】音频轨没有 `hidden` 语义（「只关声音」走 `muted`）。
    // 不在此返回 ⇒ 压一条**空历史记录**（内容逐项未变，却照样 notify 并入栈）。
    if (!targetTrack || !canTrackBeHidden(targetTrack)) {
      this.markNotApplied();
      return;
    }

    // 谓词同时承担"类型收窄"（只有带 `hidden` 的轨才允许读它）—— 与上面的提前返回**同一判据**。
    const updatedTracks = this.savedState.map((track) =>
      track.id === this.trackId && canTrackBeHidden(track)
        ? { ...track, hidden: !track.hidden }
        : track,
    );

    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
