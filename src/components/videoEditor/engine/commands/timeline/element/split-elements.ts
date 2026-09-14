import { Command } from '@videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@videoEditor/types/timeline';
import { generateUUID } from '@videoEditor/utils/id';
import { EditorCore } from '@videoEditor/engine/core';

export class SplitElementsCommand extends Command {
  private savedState: TimelineTrack[] | null = null;
  private rightSideElements: { trackId: string; elementId: string }[] = [];
  private previousSelection: { trackId: string; elementId: string }[] = [];

  constructor(
    private elements: { trackId: string; elementId: string }[],
    private splitTime: number,
    private retainSide: 'both' | 'left' | 'right' = 'both',
  ) {
    super();
  }

  getRightSideElements(): { trackId: string; elementId: string }[] {
    return this.rightSideElements;
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    this.savedState = editor.timeline.getTracks();
    this.previousSelection = editor.selection.getSelectedElements();
    this.rightSideElements = [];

    const updatedTracks = this.savedState.map((track) => {
      const elementsToSplit = this.elements.filter((el) => el.trackId === track.id);

      if (elementsToSplit.length === 0) {
        return track;
      }

      return {
        ...track,
        elements: track.elements.flatMap((element) => {
          const shouldSplit = elementsToSplit.some((el) => el.elementId === element.id);

          if (!shouldSplit) {
            return [element];
          }

          const effectiveStart = element.startTime;
          const effectiveEnd = element.startTime + element.duration;

          if (this.splitTime <= effectiveStart || this.splitTime >= effectiveEnd) {
            return [element];
          }

          const relativeTime = this.splitTime - element.startTime;
          const leftVisibleDuration = relativeTime;
          const rightVisibleDuration = element.duration - relativeTime;

          // ⚠️ trim 换算必须过 playbackRate（与渲染判据同源，见 `getVisualSourceTime`）：
          //   源时间 = trimStart + (时间轴时间 - startTime) × rate
          //   → 时间轴上的切开偏移 Δ 在**源素材域**对应 Δ × rate。
          //   变速后按 1:1 算 trim 偏移，右半的源入点就错位（画面从错的位置继续播）。
          // 【trimEnd 不变式】trimEnd = trimStart + duration × rate（渲染与导出解码
          //   `mediabunny` 都按这个式子自算上界，从不直接读 trimEnd —— 写者必须维持它一致，
          //   否则就是给未来"按源出点直觉消费 trimEnd"的人埋雷）。
          //   故左半 trimEnd 显式按不变式重算，而不是在旧 trimEnd 上加减。
          const rate =
            'playbackRate' in element && typeof element.playbackRate === 'number'
              ? element.playbackRate
              : 1;
          const leftSourceDuration = leftVisibleDuration * rate;

          if (this.retainSide === 'left') {
            return [
              {
                ...element,
                duration: leftVisibleDuration,
                trimEnd: element.trimStart + leftSourceDuration,
                name: `${element.name} (left)`,
              },
            ];
          }

          if (this.retainSide === 'right') {
            const newId = generateUUID();
            this.rightSideElements.push({
              trackId: track.id,
              elementId: newId,
            });
            return [
              {
                ...element,
                id: newId,
                startTime: this.splitTime,
                duration: rightVisibleDuration,
                trimStart: element.trimStart + leftSourceDuration,
                name: `${element.name} (right)`,
              },
            ];
          }

          // "both" - split into two pieces
          const secondElementId = generateUUID();
          this.rightSideElements.push({
            trackId: track.id,
            elementId: secondElementId,
          });

          return [
            {
              ...element,
              duration: leftVisibleDuration,
              trimEnd: element.trimStart + leftSourceDuration,
              name: `${element.name} (left)`,
            },
            {
              ...element,
              id: secondElementId,
              startTime: this.splitTime,
              duration: rightVisibleDuration,
              trimStart: element.trimStart + leftSourceDuration,
              name: `${element.name} (right)`,
            },
          ];
        }),
      } as typeof track;
    });

    editor.timeline.updateTracks(updatedTracks);

    if (this.rightSideElements.length > 0) {
      editor.selection.setSelectedElements({ elements: this.rightSideElements });
    }
  }

  undo(): void {
    if (this.savedState) {
      const editor = EditorCore.getInstance();
      editor.timeline.updateTracks(this.savedState);
      editor.selection.setSelectedElements({ elements: this.previousSelection });
    }
  }
}
