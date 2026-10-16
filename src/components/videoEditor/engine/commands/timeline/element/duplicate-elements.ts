import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineElement, TimelineTrack } from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import {
  buildEmptyTrack,
  getHighestInsertIndexForTrack,
} from '@/components/videoEditor/engine/timeline/track-utils';

interface DuplicateElementsParams {
  elements: { trackId: string; elementId: string }[];
}

export class DuplicateElementsCommand extends Command {
  private duplicatedElements: { trackId: string; elementId: string }[] = [];
  private savedState: TimelineTrack[] | null = null;
  private previousSelection: { trackId: string; elementId: string }[] = [];
  private elements: DuplicateElementsParams['elements'];

  constructor({ elements }: DuplicateElementsParams) {
    super();
    this.elements = elements;
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();
    this.previousSelection = editor.selection.getSelectedElements();
    this.duplicatedElements = [];

    // 【空入参 ⇒ 什么都不做】没有可复制的元素时若继续，`updatedTracks` 会是一个
    // **内容完全未变的新数组**：`updateTracks` 照样 notify，并在历史栈里压一条**空记录**
    // （用户按撤销时"什么都没变"）。工具栏「复制元素」在无选中时正会走到这里。
    if (this.elements.length === 0) {
      this.markNotApplied();
      return;
    }

    const updatedTracks = [...this.savedState];

    for (const track of this.savedState) {
      const elementsToDuplicate = this.elements.filter((el) => el.trackId === track.id);

      if (elementsToDuplicate.length === 0) {
        continue;
      }

      const elementIdsToDuplicate = new Set(
        elementsToDuplicate.map((element) => element.elementId),
      );
      const newTrackElements: TimelineElement[] = [];

      const newTrackId = generateUUID();
      const newTrackBase = buildEmptyTrack({
        id: newTrackId,
        type: track.type,
      });

      for (const element of track.elements) {
        if (!elementIdsToDuplicate.has(element.id)) {
          continue;
        }

        const newId = generateUUID();
        this.duplicatedElements.push({
          trackId: newTrackId,
          elementId: newId,
        });
        newTrackElements.push(
          buildDuplicateElement({
            element,
            id: newId,
            startTime: element.startTime,
          }),
        );
      }

      const newTrack = {
        ...newTrackBase,
        elements: newTrackElements,
      } as TimelineTrack;

      const insertIndex = getHighestInsertIndexForTrack({
        tracks: updatedTracks,
        trackType: track.type,
      });
      updatedTracks.splice(insertIndex, 0, newTrack);
    }

    editor.timeline.updateTracks(updatedTracks);

    if (this.duplicatedElements.length > 0) {
      editor.selection.setSelectedElements({ elements: this.duplicatedElements });
    }
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
      editor.selection.setSelectedElements({ elements: this.previousSelection });
    }
  }

  getDuplicatedElements(): { trackId: string; elementId: string }[] {
    return this.duplicatedElements;
  }
}

function buildDuplicateElement({
  element,
  id,
  startTime,
}: {
  element: TimelineElement;
  id: string;
  startTime: number;
}): TimelineElement {
  return { ...element, id, name: `${element.name} (copy)`, startTime };
}
