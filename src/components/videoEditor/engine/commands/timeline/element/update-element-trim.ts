import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';

export class UpdateElementTrimCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(
    private elementId: string,
    private trimStart: number,
    private startTime?: number,
    private duration?: number,
  ) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const updatedTracks = this.savedState.map((track) => {
      const newElements = track.elements.map((element) => {
        if (element.id !== this.elementId) {
          return element;
        }

        return {
          ...element,
          trimStart: this.trimStart,
          startTime: this.startTime ?? element.startTime,
          duration: this.duration ?? element.duration,
        };
      });
      return { ...track, elements: newElements } as typeof track;
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
