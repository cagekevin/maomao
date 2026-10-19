import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import { canTracktHaveAudio, isTrackMuted } from '@/components/videoEditor/engine/timeline';

export class ToggleTrackMuteCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private trackId: string) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const targetTrack = this.savedState.find((track) => track.id === this.trackId);
    // 【不可静音 ⇒ 提前返回】文本 / 贴纸轨没有 `muted` 语义。若不在此返回，
    // `updatedTracks` 会是一个**内容逐项未变的新数组**：`updateTracks` 照样 notify，
    // 并在历史栈里压一条**空记录**（用户按撤销时"什么都没变"）。
    if (!targetTrack || !canTracktHaveAudio(targetTrack)) {
      this.markNotApplied();
      return;
    }

    const updatedTracks = this.savedState.map((track) =>
      track.id === this.trackId ? { ...track, muted: !isTrackMuted(track) } : track,
    );

    editor.timeline.updateTracks(updatedTracks);
  }

  override undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
