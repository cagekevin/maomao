import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { EditorCore } from '@/components/videoEditor/engine/core';
import type {
  TimelineTrack,
  TrackTransition,
  VideoTrack,
} from '@/components/videoEditor/types/timeline';

export interface UpdateTransitionParams {
  trackId: string;
  transitionId: string;
  updates: Partial<Pick<TrackTransition, 'type' | 'duration'>>;
}

/**
 * 修改转场（类型 / 时长，可撤销）。
 *
 * 【用户路径】`timeline-transition-overlay` 拖动转场边缘改时长：拖动中只更新本地预览态，
 * **松手时提交这一条命令** —— 与元素拖拽（`use-preview-interaction`）同款：
 * 过程中的中间态不入栈，一次用户动作 = 一条命令。
 */
export class UpdateTransitionCommand extends Command {
  private savedState: TimelineTrack[] | null = null;

  constructor(private params: UpdateTransitionParams) {
    super();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    this.savedState = editor.timeline.getTracks();

    const track = this.savedState.find((item) => item.id === this.params.trackId);
    if (!track || track.type !== 'video') return;

    const videoTrack = track as VideoTrack;
    const updatedTrack: VideoTrack = {
      ...videoTrack,
      transitions: (videoTrack.transitions ?? []).map((transition) =>
        transition.id === this.params.transitionId
          ? { ...transition, ...this.params.updates }
          : transition,
      ),
    };

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
