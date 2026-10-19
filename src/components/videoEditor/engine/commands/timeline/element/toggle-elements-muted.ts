import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import {
  canElementHaveAudio,
  findElementInTracks,
  isElementMuted,
} from '@/components/videoEditor/engine/timeline/element-utils';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';

export class ToggleElementsMutedCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private elements: { trackId: string; elementId: string }[]) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    // 【可静音集合（唯一判据）】只有能出声的元素（video / audio）才谈静音；
    // 集合为空 ⇒ 提前返回（否则压一条**空历史记录**，用户按撤销时"什么都没变"）。
    const mutableElements = this.elements.filter(({ trackId, elementId }) => {
      const element = findElementInTracks({
        tracks: this.savedState ?? [],
        trackId,
        elementId,
      });
      return element !== null && canElementHaveAudio(element);
    });

    if (mutableElements.length === 0) {
      this.markNotApplied();
      return;
    }

    const shouldMute = mutableElements.some(({ trackId, elementId }) => {
      const element = findElementInTracks({
        tracks: this.savedState ?? [],
        trackId,
        elementId,
      });
      // `mutableElements` 已按 `canElementHaveAudio` 过滤 ⇒ 这里只问"当前是否已静音"。
      return element !== null && !isElementMuted(element);
    });

    const updatedTracks = this.savedState.map((track) => {
      const newElements = track.elements.map((element) => {
        const shouldUpdate = mutableElements.some(
          ({ trackId, elementId }) => track.id === trackId && element.id === elementId,
        );
        return shouldUpdate && isElementMuted(element) !== shouldMute
          ? { ...element, muted: shouldMute }
          : element;
      });
      return { ...track, elements: newElements } as typeof track;
    });

    editor.timeline.updateTracks(updatedTracks);
  }

  override undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }
  }
}
