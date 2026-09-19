import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type {
  TimelineTrack,
  TrackTransition,
  TransitionType,
  VideoTrack,
} from '@/components/videoEditor/types/timeline';
import {
  addTransitionToTrack,
  buildTrackTransition,
} from '@/components/videoEditor/engine/timeline/transition-utils';

export interface AddTransitionParams {
  trackId: string;
  fromElementId: string;
  toElementId: string;
  type: TransitionType;
  duration: number;
}

/**
 * 添加转场（可撤销）。
 *
 * 【为什么要有命令类】此前 `TimelineManager.addTransition` 直接 `updateTracks()` 写回、
 * **不进命令栈** → 用户加了转场无法撤销（TD-22-40）。转场的增/删/改是**与元素、轨道同级
 * 的编辑操作**，必须走同一条命令栈，否则「哪些操作可撤销」变成一张需要人记的清单。
 *
 * 【判据归属】「能不能加」（轨道是不是 video / 元素在不在 / 是否相邻）由
 * `TimelineManager.addTransition` 前置裁决 —— 它同时决定**是否发起命令**（无效操作不入栈，
 * 不污染撤销历史）。本命令只负责「执行 + 撤销」，故不再重复校验。
 *
 * 【transition id 在构造期生成】不在 `execute()` 里生成 —— 否则 `redo()`（缺省 = 再次 execute）
 * 会换一个新 id，撤销后重做的就不再是同一条转场。
 */
export class AddTransitionCommand extends Command {
  private savedState: TimelineTrack[] | null = null;
  private readonly transition: TrackTransition;

  constructor(private params: AddTransitionParams) {
    super();
    this.transition = buildTrackTransition({
      type: params.type,
      duration: params.duration,
      fromElementId: params.fromElementId,
      toElementId: params.toElementId,
    });
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const track = this.savedState.find((item) => item.id === this.params.trackId);
    if (!track || track.type !== 'video') return;

    const updatedTrack = addTransitionToTrack({
      track: track as VideoTrack,
      transition: this.transition,
    });

    editor.timeline.updateTracks(
      this.savedState.map((item) => (item.id === track.id ? updatedTrack : item)),
    );
  }

  undo(): void {
    if (!this.savedState) return;
    const editor = getEditor();
    editor.timeline.updateTracks(this.savedState);
  }

  getTransition(): TrackTransition {
    return this.transition;
  }
}
