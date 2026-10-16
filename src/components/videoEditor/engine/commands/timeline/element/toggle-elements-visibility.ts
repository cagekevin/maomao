import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { isElementHidden } from '@/components/videoEditor/engine/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';

export class ToggleElementsVisibilityCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private elements: { trackId: string; elementId: string }[]) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const shouldHide = this.elements.some(({ trackId, elementId }) => {
      const track = this.savedState?.find((t) => t.id === trackId);
      const element = track?.elements.find((e) => e.id === elementId);
      return element ? !isElementHidden(element) : false;
    });

    const updatedTracks = this.savedState.map((track) => {
      const newElements = track.elements.map((element) => {
        const shouldUpdate = this.elements.some(
          ({ trackId, elementId }) => track.id === trackId && element.id === elementId,
        );
        return shouldUpdate && isElementHidden(element) !== shouldHide
          ? { ...element, hidden: shouldHide }
          : element;
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
