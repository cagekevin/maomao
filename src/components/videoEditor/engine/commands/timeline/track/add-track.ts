import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TrackType, TimelineTrack } from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import {
  buildEmptyTrack,
  getDefaultInsertIndexForTrack,
} from '@/components/videoEditor/engine/timeline/track-utils';

export class AddTrackCommand extends Command {
  private trackId: string;
  private savedState: TimelineTrack[] | null = null;

  constructor(
    private type: TrackType,
    private index?: number,
  ) {
    super();
    this.trackId = generateUUID();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const newTrack: TimelineTrack = buildEmptyTrack({
      id: this.trackId,
      type: this.type,
    });

    const updatedTracks = [...(this.savedState || [])];
    const insertIndex =
      this.index ??
      getDefaultInsertIndexForTrack({
        tracks: updatedTracks,
        trackType: this.type,
      });
    updatedTracks.splice(insertIndex, 0, newTrack);

    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }

  getTrackId(): string {
    return this.trackId;
  }
}
