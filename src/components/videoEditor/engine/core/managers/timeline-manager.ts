import type { EditorCore } from '@videoEditor/engine/core';
import type {
  TrackType,
  TimelineTrack,
  TimelineElement,
  ClipboardItem,
  TransitionType,
  TrackTransition,
  VideoTrack,
} from '@videoEditor/types/timeline';
import { calculateTotalDuration } from '@videoEditor/engine/timeline';
import {
  areElementsAdjacent,
  findAdjacentPairs,
} from '@videoEditor/engine/timeline/transition-utils';
import {
  AddTrackCommand,
  RemoveTrackCommand,
  ReorderTracksCommand,
  ToggleTrackMuteCommand,
  ToggleTrackVisibilityCommand,
  BatchMoveElementsCommand,
  InsertElementCommand,
  UpdateElementTrimCommand,
  UpdateElementDurationCommand,
  DeleteElementsCommand,
  DuplicateElementsCommand,
  ToggleElementsVisibilityCommand,
  ToggleElementsMutedCommand,
  UpdateElementCommand,
  SplitElementsCommand,
  PasteCommand,
  UpdateElementStartTimeCommand,
  MoveElementCommand,
  DetachAudioCommand,
  AddTransitionCommand,
  RemoveTransitionCommand,
  UpdateTransitionCommand,
} from '@videoEditor/engine/commands/timeline';
import type { InsertElementParams } from '@videoEditor/engine/commands/timeline/element/insert-element';

export class TimelineManager {
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

  addTrack({ type, index }: { type: TrackType; index?: number }): string {
    const command = new AddTrackCommand(type, index);
    this.editor.command.execute({ command });
    return command.getTrackId();
  }

  removeTrack({ trackId }: { trackId: string }): void {
    const command = new RemoveTrackCommand(trackId);
    this.editor.command.execute({ command });
  }

  reorderTracks({ trackIds }: { trackIds: string[] }): void {
    const command = new ReorderTracksCommand(trackIds);
    this.editor.command.execute({ command });
  }

  insertElement({ element, placement }: InsertElementParams): void {
    const command = new InsertElementCommand({ element, placement });
    this.editor.command.execute({ command });
  }

  /**
   * 改片段的「源入点 + 可见时长」。
   *
   * 【TD-22-21】去掉了 `trimEnd` 参数 —— 它已不是真源：片段形态由 `trimStart + duration` 唯一确定。
   * 原实现只提交 `trimStart`/`trimEnd` 而**从不提交 `duration`**，于是「拖右边缘改时长」松手后不落库。
   */
  updateElementTrim({
    elementId,
    trimStart,
    duration,
    pushHistory = true,
  }: {
    elementId: string;
    trimStart: number;
    duration?: number;
    pushHistory?: boolean;
  }): void {
    const command = new UpdateElementTrimCommand(elementId, trimStart, undefined, duration);
    if (pushHistory) {
      this.editor.command.execute({ command });
    } else {
      command.execute();
    }
  }

  updateElementDuration({
    trackId,
    elementId,
    duration,
    pushHistory = true,
  }: {
    trackId: string;
    elementId: string;
    duration: number;
    pushHistory?: boolean;
  }): void {
    const command = new UpdateElementDurationCommand(trackId, elementId, duration);
    if (pushHistory) {
      this.editor.command.execute({ command });
    } else {
      command.execute();
    }
  }

  updateElementStartTime({
    elements,
    startTime,
  }: {
    elements: { trackId: string; elementId: string }[];
    startTime: number;
  }): void {
    const command = new UpdateElementStartTimeCommand(elements, startTime);
    this.editor.command.execute({ command });
  }

  moveElementsByDelta({
    elements,
    timeDelta,
  }: {
    elements: { trackId: string; elementId: string }[];
    timeDelta: number;
  }): void {
    const command = new BatchMoveElementsCommand(elements, timeDelta);
    this.editor.command.execute({ command });
  }

  moveElement({
    sourceTrackId,
    targetTrackId,
    elementId,
    newStartTime,
    createTrack,
  }: {
    sourceTrackId: string;
    targetTrackId: string;
    elementId: string;
    newStartTime: number;
    createTrack?: { type: TrackType; index: number };
  }): void {
    const command = new MoveElementCommand(
      sourceTrackId,
      targetTrackId,
      elementId,
      newStartTime,
      createTrack,
    );
    this.editor.command.execute({ command });
  }

  toggleTrackMute({ trackId }: { trackId: string }): void {
    const command = new ToggleTrackMuteCommand(trackId);
    this.editor.command.execute({ command });
  }

  toggleTrackVisibility({ trackId }: { trackId: string }): void {
    const command = new ToggleTrackVisibilityCommand(trackId);
    this.editor.command.execute({ command });
  }

  splitElements({
    elements,
    splitTime,
    retainSide = 'both',
  }: {
    elements: { trackId: string; elementId: string }[];
    splitTime: number;
    retainSide?: 'both' | 'left' | 'right';
  }): { trackId: string; elementId: string }[] {
    const command = new SplitElementsCommand(elements, splitTime, retainSide);
    this.editor.command.execute({ command });
    return command.getRightSideElements();
  }

  getTotalDuration(): number {
    return calculateTotalDuration({ tracks: this.getTracks() });
  }

  getTrackById({ trackId }: { trackId: string }): TimelineTrack | null {
    return this.getTracks().find((track) => track.id === trackId) ?? null;
  }

  getElementsWithTracks({
    elements,
  }: {
    elements: { trackId: string; elementId: string }[];
  }): Array<{ track: TimelineTrack; element: TimelineElement }> {
    const result: Array<{ track: TimelineTrack; element: TimelineElement }> = [];

    for (const { trackId, elementId } of elements) {
      const track = this.getTrackById({ trackId });
      const element = track?.elements.find((trackElement) => trackElement.id === elementId);

      if (track && element) {
        result.push({ track, element });
      }
    }

    return result;
  }

  pasteAtTime({
    time,
    clipboardItems,
  }: {
    time: number;
    clipboardItems: ClipboardItem[];
  }): { trackId: string; elementId: string }[] {
    const command = new PasteCommand(time, clipboardItems);
    this.editor.command.execute({ command });
    return command.getPastedElements();
  }

  deleteElements({ elements }: { elements: { trackId: string; elementId: string }[] }): void {
    const command = new DeleteElementsCommand(elements);
    this.editor.command.execute({ command });
  }

  updateElements({
    updates,
    pushHistory = true,
  }: {
    updates: Array<{
      trackId: string;
      elementId: string;
      updates: Partial<Record<string, unknown>>;
    }>;
    pushHistory?: boolean;
  }): void {
    const commands = updates.map(
      ({ trackId, elementId, updates: elementUpdates }) =>
        new UpdateElementCommand(trackId, elementId, elementUpdates),
    );
    // 「0/1/N 条怎么进场」的判据收口在 CommandManager.executeBatch（TD-22-51），本处只声明意图。
    this.editor.command.executeBatch({ commands, pushHistory });
  }

  duplicateElements({
    elements,
  }: {
    elements: { trackId: string; elementId: string }[];
  }): { trackId: string; elementId: string }[] {
    const command = new DuplicateElementsCommand({ elements });
    this.editor.command.execute({ command });
    return command.getDuplicatedElements();
  }

  toggleElementsVisibility({
    elements,
  }: {
    elements: { trackId: string; elementId: string }[];
  }): void {
    const command = new ToggleElementsVisibilityCommand(elements);
    this.editor.command.execute({ command });
  }

  toggleElementsMuted({ elements }: { elements: { trackId: string; elementId: string }[] }): void {
    const command = new ToggleElementsMutedCommand(elements);
    this.editor.command.execute({ command });
  }

  detachAudio({ elements }: { elements: { trackId: string; elementId: string }[] }): void {
    const command = new DetachAudioCommand(elements);
    this.editor.command.execute({ command });
  }

  // ---- Transition management ----
  // 转场的增 / 删 / 改与元素、轨道**同级**：一律走命令栈（可撤销）。见 TD-22-40。
  // 【判据归属】「能不能做」（轨道是不是 video / 元素在不在 / 是否相邻 / 转场在不在）
  // 在本层裁决 —— 它同时决定**是否发起命令**：无效操作直接返回、不入栈
  // （否则撤销历史里会多出一条按下去没反应的命令，用户以为撤销坏了）。
  // 【转场失效清理】不在这里：`MoveElementCommand` 执行时随主命令调
  // `cleanupTransitionsForTrack`，由该命令的 `savedState` 一并兜回；原先这里那个
  // `cleanupTransitions` 全库 0 调用（死方法）已删。

  addTransition({
    trackId,
    fromElementId,
    toElementId,
    type,
    duration,
  }: {
    trackId: string;
    fromElementId: string;
    toElementId: string;
    type: TransitionType;
    duration: number;
  }): TrackTransition | null {
    const command = this.buildAddTransitionCommand({
      trackId,
      fromElementId,
      toElementId,
      type,
      duration,
    });
    if (!command) return null;

    this.editor.command.execute({ command });
    return command.getTransition();
  }

  /**
   * 把转场**一次**应用到所有 video 轨上的相邻片段对（批量）。
   *
   * 【为什么在 manager 层而不是 UI 层（TD-22-51）】
   *   ① 判据（轨道是不是 video / 元素在不在 / 是否相邻）归 `addTransition` 这层裁决，
   *      UI 不该重复它 —— 否则「什么算能加」会出现第二份判据（本项目已吃过多次 SSOT 第二份的亏）；
   *   ② 一次用户点击必须 = **一条历史条目**：原实现（`transitions.tsx` 里循环调 N 次
   *      `addTransition`）会入栈 N 条，**撤销要按 N 次**；现统一走 `CommandManager.executeBatch`。
   *
   * @returns `applied` = 实际加上的转场数；`0` 表示没有相邻片段对（调用方据此提示用户）。
   */
  /**
   * 当前有多少个「可加转场的交界」—— 与 `addTransitionsToAdjacentPairs` **同源**的只读查询。
   *
   * 【为什么需要"能问"（TD-22-49 的真根因）】原实现只有"写"（点了就试着加）没有"问"：
   * 用户点转场 → 失败 → 只从一句英文得知「没有相邻片段」，既不知道为什么、
   * 也不知道该把片段拖到多近才算"相接"。判据**对用户完全不透明**。
   * 面板现在实时显示这个数：拖片段时能看见 `0 → 1` 的变化，那一步就是"贴好了"。
   *
   * 【为什么不下沉到 UI 自己数】"哪些轨道参与转场"（`type === 'video'`）本身就是判据，
   * UI 再算一遍 = **第二份判据**（本项目已多次栽在这上面）⇒ 必须与写路径同源。
   */
  countAdjacentJunctions(): number {
    let total = 0;
    for (const track of this.getTracks()) {
      if (track.type !== 'video') continue;
      total += findAdjacentPairs({ track: track as VideoTrack }).length;
    }
    return total;
  }

  addTransitionsToAdjacentPairs({ type, duration }: { type: TransitionType; duration: number }): {
    applied: number;
  } {
    const commands: AddTransitionCommand[] = [];

    for (const track of this.getTracks()) {
      if (track.type !== 'video') continue;

      // `TimelineTrack` 非判别联合（type 是宽枚举），TS 收窄不到 `VideoTrack` → 显式断言，
      // 安全前提是上面那行 `track.type !== 'video'` 的守卫。
      for (const pair of findAdjacentPairs({ track: track as VideoTrack })) {
        const command = this.buildAddTransitionCommand({
          trackId: track.id,
          fromElementId: pair.from.id,
          toElementId: pair.to.id,
          type,
          duration,
        });
        if (command) commands.push(command);
      }
    }

    this.editor.command.executeBatch({ commands });
    return { applied: commands.length };
  }

  /**
   * 「能不能加转场」的判据 + 命令构造 —— **单点**（`addTransition` 与批量应用共用）。
   * 返回 `null` = 无效操作（**不入栈**：否则撤销历史里会多一条按下去没反应的命令）。
   */
  private buildAddTransitionCommand({
    trackId,
    fromElementId,
    toElementId,
    type,
    duration,
  }: {
    trackId: string;
    fromElementId: string;
    toElementId: string;
    type: TransitionType;
    duration: number;
  }): AddTransitionCommand | null {
    const track = this.getTrackById({ trackId });
    if (!track || track.type !== 'video') return null;

    const fromElement = track.elements.find((el) => el.id === fromElementId);
    const toElement = track.elements.find((el) => el.id === toElementId);
    if (!fromElement || !toElement) return null;

    if (!areElementsAdjacent({ elementA: fromElement, elementB: toElement })) {
      return null;
    }

    return new AddTransitionCommand({ trackId, fromElementId, toElementId, type, duration });
  }

  removeTransition({ trackId, transitionId }: { trackId: string; transitionId: string }): void {
    const track = this.getTrackById({ trackId });
    if (!track || track.type !== 'video') return;

    const exists = (track.transitions ?? []).some((item) => item.id === transitionId);
    if (!exists) return;

    const command = new RemoveTransitionCommand({ trackId, transitionId });
    this.editor.command.execute({ command });
  }

  updateTransition({
    trackId,
    transitionId,
    updates,
  }: {
    trackId: string;
    transitionId: string;
    updates: Partial<Pick<TrackTransition, 'type' | 'duration'>>;
  }): void {
    const track = this.getTrackById({ trackId });
    if (!track || track.type !== 'video') return;

    const exists = (track.transitions ?? []).some((item) => item.id === transitionId);
    if (!exists) return;

    const command = new UpdateTransitionCommand({ trackId, transitionId, updates });
    this.editor.command.execute({ command });
  }

  getTracks(): TimelineTrack[] {
    return this.editor.scenes.getActiveScene()?.tracks ?? [];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  updateTracks(newTracks: TimelineTrack[]): void {
    this.editor.scenes.updateSceneTracks({ tracks: newTracks });
    this.notify();
  }
}
