import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getMainTrack } from '@/components/videoEditor/engine/timeline';

export class RemoveTrackCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private trackId: string) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();
    const targetTrack = this.savedState.find((track) => track.id === this.trackId);
    const mainTrack = getMainTrack({ tracks: this.savedState });
    if (mainTrack?.id === targetTrack?.id) {
      return;
    }
    const updatedTracks = this.savedState.filter((track) => track.id !== this.trackId);
    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
