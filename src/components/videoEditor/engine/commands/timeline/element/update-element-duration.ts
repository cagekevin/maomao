import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';

export class UpdateElementDurationCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(
    private trackId: string,
    private elementId: string,
    private duration: number,
  ) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const updatedTracks = this.savedState.map((t) => {
      if (t.id !== this.trackId) return t;
      const newElements = t.elements.map((el) =>
        el.id === this.elementId ? { ...el, duration: this.duration } : el,
      );
      return { ...t, elements: newElements } as typeof t;
    });

    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
