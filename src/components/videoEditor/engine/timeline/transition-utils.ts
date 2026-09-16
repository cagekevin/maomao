import type {
  VideoTrack,
  TrackTransition,
  VideoElement,
  ImageElement,
} from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import type { TransitionType } from '@/components/videoEditor/types/timeline';

type VisualElement = VideoElement | ImageElement;

// element.duration is already the visible duration on the timeline
function getElementEndTime({ element }: { element: VisualElement }): number {
  return element.startTime + element.duration;
}

/**
 * 「相邻」的容差（秒）。
 *
 * 【为什么是 0.05，而不是"为了点得上转场就放宽"】
 * 片段的 `startTime` 一律**帧对齐**（`snapTimeToFrame`），且拖动片段走 `snapElementEdge`
 * （吸附 ±10px 内的元素边界）⇒ 真正"相接"时 gap 恒为 **0**；最坏情况（吸附差一帧）也只有
 * `1/fps`（30fps ≈ 0.033s）。0.05 同时覆盖两者，又不会把"用户故意留出的间隔"误判成相接。
 *
 * ⚠️ **不要为了"转场点不亮"而放宽它**（TD-22-49 曾把症状误判为"阈值过严"）。间距是有意义的：
 * 转场是「A 淡出、B 淡入」，中间留了黑场就不叫转场，放宽只会产出视觉上错的转场。
 * 让用户点得上转场的正确做法是**把判据变成可见的**（`TransitionsView` 实时显示可用交界数），
 * 让他知道要拖多近 —— 而不是偷偷降低"算相接"的标准。
 */
const ADJACENCY_EPSILON = 0.05;

export function areElementsAdjacent({
  elementA,
  elementB,
}: {
  elementA: VisualElement;
  elementB: VisualElement;
}): boolean {
  const endA = getElementEndTime({ element: elementA });
  const gap = Math.abs(elementB.startTime - endA);
  return gap < ADJACENCY_EPSILON;
}

export function findAdjacentPairs({
  track,
}: {
  track: VideoTrack;
}): Array<{ from: VisualElement; to: VisualElement }> {
  const sorted = [...track.elements].sort((a, b) => a.startTime - b.startTime);
  const pairs: Array<{ from: VisualElement; to: VisualElement }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (areElementsAdjacent({ elementA: current, elementB: next })) {
      pairs.push({ from: current, to: next });
    }
  }

  return pairs;
}

export function getTransitionForPair({
  track,
  fromElementId,
  toElementId,
}: {
  track: VideoTrack;
  fromElementId: string;
  toElementId: string;
}): TrackTransition | null {
  const transitions = track.transitions ?? [];
  return (
    transitions.find(
      (transition) =>
        transition.fromElementId === fromElementId && transition.toElementId === toElementId,
    ) ?? null
  );
}

export function buildTrackTransition({
  type,
  duration,
  fromElementId,
  toElementId,
}: {
  type: TransitionType;
  duration: number;
  fromElementId: string;
  toElementId: string;
}): TrackTransition {
  return {
    id: generateUUID(),
    type,
    duration,
    fromElementId,
    toElementId,
  };
}

export function addTransitionToTrack({
  track,
  transition,
}: {
  track: VideoTrack;
  transition: TrackTransition;
}): VideoTrack {
  const transitions = track.transitions ?? [];
  const existing = transitions.find(
    (t) => t.fromElementId === transition.fromElementId && t.toElementId === transition.toElementId,
  );
  if (existing) {
    return {
      ...track,
      transitions: transitions.map((t) => (t.id === existing.id ? transition : t)),
    };
  }
  return {
    ...track,
    transitions: [...transitions, transition],
  };
}

export function removeTransitionFromTrack({
  track,
  transitionId,
}: {
  track: VideoTrack;
  transitionId: string;
}): VideoTrack {
  const transitions = track.transitions ?? [];
  return {
    ...track,
    transitions: transitions.filter((t) => t.id !== transitionId),
  };
}

export function cleanupTransitionsForTrack({ track }: { track: VideoTrack }): VideoTrack {
  const transitions = track.transitions ?? [];
  const elementIds = new Set(track.elements.map((element) => element.id));
  const pairs = findAdjacentPairs({ track });
  const validPairKeys = new Set(pairs.map((p) => `${p.from.id}:${p.to.id}`));

  const validTransitions = transitions.filter((transition) => {
    const bothExist =
      elementIds.has(transition.fromElementId) && elementIds.has(transition.toElementId);
    const stillAdjacent = validPairKeys.has(
      `${transition.fromElementId}:${transition.toElementId}`,
    );
    return bothExist && stillAdjacent;
  });

  if (validTransitions.length === transitions.length) {
    return track;
  }

  return { ...track, transitions: validTransitions };
}
