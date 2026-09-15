import { Command } from '@videoEditor/engine/commands/base-command';
import { EditorCore } from '@videoEditor/engine/core';
import type { TimelineTrack, VideoTrack } from '@videoEditor/types/timeline';
import { removeTransitionFromTrack } from '@videoEditor/engine/timeline/transition-utils';

export interface RemoveTransitionParams {
  trackId: string;
  transitionId: string;
}

/**
 * 删除转场（可撤销）。
 *
 * 【为什么重要】转场此前删了**无法恢复**（`TimelineManager` 直改 tracks，不进栈）；
 * `timeline-transition-overlay` 的删除入口是用户误点概率最高的地方之一，
 * 误删不可逆 = 数据损失。本命令自捕 `savedState`，undo 整轨还原。
 */
export class RemoveTransitionCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private params: RemoveTransitionParams) {
    super();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    this.savedState = editor.timeline.getTracks();

    const track = this.savedState.find((item) => item.id === this.params.trackId);
    if (!track || track.type !== 'video') return;

    const updatedTrack = removeTransitionFromTrack({
      track: track as VideoTrack,
      transitionId: this.params.transitionId,
    });

    editor.timeline.updateTracks(
      this.savedState.map((item) => (item.id === track.id ? updatedTrack : item)),
    );
  }

  undo(): void {
    if (!this.savedState) return;
    const editor = EditorCore.getInstance();
    editor.timeline.updateTracks(this.savedState);
  }
}
