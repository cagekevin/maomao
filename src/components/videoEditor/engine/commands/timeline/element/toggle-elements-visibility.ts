import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import {
  canElementBeHidden,
  findElementInTracks,
  isElementHidden,
} from '@/components/videoEditor/engine/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';

export class ToggleElementsVisibilityCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private elements: { trackId: string; elementId: string }[]) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    // 【可隐藏集合（唯一判据）】音频元素没有 `hidden` 语义（「只关声音」走 `muted`）。
    // 不过滤的后果不只是空转：会给音频元素**写上 `hidden: true` 脏数据**（类型上它没有这个字段），
    // 而输出投影（`getOutputTracks`）会据此把它滤掉 ⇒ **音频被动不发声**（隐藏 ≠ 静音，语义混乱）。
    const hideable = this.elements.filter(({ trackId, elementId }) => {
      const element = findElementInTracks({
        tracks: this.savedState ?? [],
        trackId,
        elementId,
      });
      return element !== null && canElementBeHidden(element);
    });

    if (hideable.length === 0) {
      this.markNotApplied();
      return;
    }

    const shouldHide = hideable.some(({ trackId, elementId }) => {
      const element = findElementInTracks({
        tracks: this.savedState ?? [],
        trackId,
        elementId,
      });
      return element !== null && !isElementHidden(element);
    });

    const updatedTracks = this.savedState.map((track) => {
      const newElements = track.elements.map((element) => {
        const shouldUpdate = hideable.some(
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
