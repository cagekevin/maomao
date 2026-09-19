import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import { getElementPlaybackRate } from '@/components/videoEditor/engine/timeline/element-utils';

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
    const editor = getEditor();
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
          // 【2026-09-15 · TD-22-21】此处原有「trimEnd 不变式」重算，及其一段**自相矛盾**的注释
          //   （声称 `trimEnd = trimStart + duration × rate`，而真正读它的 `use-element-resize`
          //    是按 `素材总长 = trimStart + duration×rate + trimEnd` 反推的 —— 一字段两义）。
          //   该字段已删：源素材总长改问 media asset 的 duration，切开只需给出
          //   `trimStart + duration`，不再需要任何派生副本。
          const rate = getElementPlaybackRate({ element });
          // 右半段的**源入点** = 原入点 + 左半占用的源长度（源域换算）。
          // 注意：它只用于右半的 `trimStart`；原实现还把同一个值写进了左半的 `trimEnd`（已随字段删除）。
          const leftSourceDuration = leftVisibleDuration * rate;

          if (this.retainSide === 'left') {
            return [
              {
                ...element,
                duration: leftVisibleDuration,
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
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
      editor.selection.setSelectedElements({ elements: this.previousSelection });
    }
  }
}
