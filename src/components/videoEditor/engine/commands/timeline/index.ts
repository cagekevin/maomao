// 【2026-09-20 收口】原经 4 个子域门面（`track/` · `element/` · `clipboard/` · `transition/` 各自的 `index.ts`）转发，
// 而那 4 个门面的**唯一消费者就是本文件** ⇒ 纯中转、零收口价值（用户裁定：「门面都是转发的，
// 让架构变的更复杂，并没有真的变成深模块，都是假的」）⇒ **删掉那一层**，本文件直连具体件。
// 导出面与删除前**逐字一致**（不因去壳而放宽/收窄对外契约）。
export { AddTrackCommand } from './track/add-track';
export { RemoveTrackCommand } from './track/remove-track';
export { ReorderTracksCommand } from './track/reorder-tracks';
export { ToggleTrackMuteCommand } from './track/toggle-track-mute';
export { ToggleTrackVisibilityCommand } from './track/toggle-track-visibility';

export { BatchMoveElementsCommand } from './element/batch-move-elements';
export { InsertElementCommand } from './element/insert-element';
export { DeleteElementsCommand } from './element/delete-elements';
export { DuplicateElementsCommand } from './element/duplicate-elements';
export { UpdateElementTrimCommand } from './element/update-element-trim';
export { UpdateElementDurationCommand } from './element/update-element-duration';
export { UpdateElementStartTimeCommand } from './element/update-element-start-time';
export { SplitElementsCommand } from './element/split-elements';
export { UpdateElementCommand } from './element/update-element';
export { ToggleElementsVisibilityCommand } from './element/toggle-elements-visibility';
export { ToggleElementsMutedCommand } from './element/toggle-elements-muted';
export { MoveElementCommand } from './element/move-elements';
export { DetachAudioCommand } from './element/detach-audio';

export { PasteCommand } from './clipboard/paste';

export * from './transition/add-transition';
export * from './transition/remove-transition';
export * from './transition/update-transition';
