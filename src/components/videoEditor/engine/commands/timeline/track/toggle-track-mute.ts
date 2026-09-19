import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import { canTracktHaveAudio } from '@/components/videoEditor/engine/timeline';

export class ToggleTrackMuteCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private trackId: string) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const targetTrack = this.savedState.find((track) => track.id === this.trackId);
    if (!targetTrack) {
      return;
    }

    const updatedTracks = this.savedState.map((track) =>
      track.id === this.trackId && canTracktHaveAudio(track)
        ? { ...track, muted: !track.muted }
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
