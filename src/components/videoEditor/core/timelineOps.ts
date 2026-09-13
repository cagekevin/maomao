/**
 * A 组（时间/几何查询，只读）+ B 组（编辑：输入 → 新数组）—— `docs/123` §一.4 A/B 组。
 *
 * ── 三条全局纪律（每次改动都要过一遍）──
 *  **I4 无变化不落盘**（`docs/120` C14.1）：任何操作「算完发现没变」必须返回**入参同一个引用**，
 *      让上层能靠 `===` 判定「要不要落盘 / 要不要入撤销栈」。本文件每个函数都遵守。
 *  **I2 顺序 = 入轨先后**：库内**不存在任何排序函数**。拖序只按用户指定的目标序号重排，
 *      且重排后主轨立即压实（`relayoutSequential`）——顺序真相只有「数组顺序」一份。
 *  **纯函数**：不 import React / 存储 / 网络；失败要么返回 `null`（调用处转「置灰 + tooltip」，§一.5 O3），
 *      要么返回原数组。**不给它们套 `OpResult`**（§一.5 O4：宽接口 + 薄实现 = 泄漏）。
 *
 * ── 跨域部分在共用层，不在本文件 ──
 *  `sourceTimeAt` / `timelineTimeAt`（时间轴↔源媒体）已由前置收口下沉到
 *  `base/utils/timeline/sourceTime.ts`，**直接复用、严禁在此重写**
 *  （`Clip` 结构上就是它的 `ClipTimeWindow`，可直接传入）。
 *
 * ── 恢复磁吸（「闭合空隙」按钮）为什么不另立 `closeGaps` ──
 *  `docs/123` §一.4 自己写明它的「语义入口 = `relayoutSequential`」。两者是**同一件事**，
 *  另立别名 = 两名指一物（7 步法 Step 6 明禁）。UI 的空隙提示按钮直接调 `relayoutSequential`。
 */
import { generateId } from '../../base/core/idGen.ts';
import { EPS } from './constants.ts';
import type { Clip, Track } from './types.ts';

/* ════════════════════════════════════════════════════════════════
 * A 组 · 查询（只读）
 * ════════════════════════════════════════════════════════════════ */

/**
 * 片段时长（秒）= `max(0, sourceEnd - sourceStart)`。
 *
 * **派生量，不落盘**（T2）：存了就会与 `sourceStart/sourceEnd` 漂移。
 * 夹 `max(0, …)` 是兜脏数据（出点倒挂），不是业务判据。
 */
export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.sourceEnd - clip.sourceStart);
}

/** 片段在时间轴上的结束时刻（秒）= `timelineStart + clipDuration`。派生量，不落盘（T2）。 */
export function clipEnd(clip: Clip): number {
  return clip.timelineStart + clipDuration(clip);
}

/**
 * 找 `t` 时刻所在片段。
 *
 * 区间约定：**普通片段用半开 `[start, end)`，末片段用闭区间 `[start, end]`**
 * （`docs/123` §一.4 A 组）。理由：播放头走到片子最末尾时，用户期望仍看到最后一帧，
 * 而不是「掉出了所有片段」的黑屏。
 */
export function findClipAt(clips: Clip[], t: number): { clip: Clip; index: number } | null {
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const end = clipEnd(clip);
    const isLast = i === clips.length - 1;
    const hit = t >= clip.timelineStart - EPS && (isLast ? t <= end + EPS : t < end - EPS);
    if (hit) return { clip, index: i };
  }
  return null;
}

/**
 * 该时刻在轨上**显示/发声**的片段（可多条：自由轨允许重叠）。
 *
 * 与 `findClipAt` 同一套区间约定（末片段闭区间），保证「播放头在末尾仍算激活」。
 */
export function activeClipsAt(track: Track, t: number): Clip[] {
  return track.clips.filter((clip, i) => {
    const end = clipEnd(clip);
    const isLast = i === track.clips.length - 1;
    return t >= clip.timelineStart - EPS && (isLast ? t <= end + EPS : t < end - EPS);
  });
}

/** 全轨最大 `clipEnd` = 工程时长（秒）。空工程 → 0。 */
export function timelineDuration(tracks: Track[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clipEnd(clip);
      if (end > max) max = end;
    }
  }
  return max;
}

/**
 * 吸附候选时刻（秒）：**含 0**，去重升序。
 *
 * 候选 = 每个片段的 `timelineStart` 与 `clipEnd`。含 0 是刻意的：
 * 「拖回最开头」是最高频的一次吸附，而空轨时该候选只剩 0。
 * 去重走 `EPS`（T3）：浮点算出来的两个「同一个时刻」不应变成两个候选。
 */
export function clipEdges(clips: Clip[]): number[] {
  const out: number[] = [0];
  for (const clip of clips) {
    out.push(clip.timelineStart, clipEnd(clip));
  }
  out.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const v of out) {
    const last = deduped[deduped.length - 1];
    if (last === undefined || Math.abs(v - last) > EPS) deduped.push(v);
  }
  return deduped;
}

/**
 * 该轨的追加位置（秒）= 轨上最大 `clipEnd`。
 *
 * 用 max 而不是「最后一个片段的末尾」：主轨被「留洞删除」后顺序不再是位置真源，
 * 取 max 才能保证新片段不会盖在既有内容上（自由轨同样成立）。
 */
export function appendTime(track: Track): number {
  let max = 0;
  for (const clip of track.clips) {
    const end = clipEnd(clip);
    if (end > max) max = end;
  }
  return max;
}

/** 两个片段时间窗是否重叠（边界接触不算）。 */
function windowsOverlap(a: Clip, b: Clip): boolean {
  return a.timelineStart < clipEnd(b) - EPS && b.timelineStart < clipEnd(a) - EPS;
}

/** 轨内是否存在任意两片段重叠（直通可行性 / 自由轨碰撞判据）。 */
export function hasOverlap(clips: Clip[]): boolean {
  for (let i = 0; i < clips.length; i++) {
    for (let j = i + 1; j < clips.length; j++) {
      if (windowsOverlap(clips[i], clips[j])) return true;
    }
  }
  return false;
}

/**
 * 指定片段是否与该轨上**其它**片段重叠（自由轨落位判据，`docs/123` §一.4 A 组）。
 * 未知 id → `false`（不猜）。
 */
export function clipOverlaps(track: Track, clipId: string): boolean {
  const self = track.clips.find((c) => c.id === clipId);
  if (!self) return false;
  return track.clips.some((other) => other.id !== self.id && windowsOverlap(self, other));
}

/* ════════════════════════════════════════════════════════════════
 * B 组 · 编辑（输入 → 新数组；未变返回原引用）
 * ════════════════════════════════════════════════════════════════ */

/** 逐元素引用比较：全等则视为「没变」，用于兑现 I4（返回入参本身）。 */
function unchanged<T>(next: T[], prev: T[]): boolean {
  return next.length === prev.length && next.every((v, i) => v === prev[i]);
}

/**
 * 主轨压实（磁吸）—— **I1/I2 的实现**，也是「闭合空隙」按钮的语义入口。
 *
 * 「保相对顺序、只合空隙」：按数组顺序把每个片段推到前一个的 `clipEnd`。
 * 不排序、不重排、不改任何时间窗字段（只动 `timelineStart`）。
 * 已是磁吸态 → 返回**原数组引用**（I4）。
 *
 * ⚠️ 只对**主轨**调用。自由轨（`overlay: true`）可留空，压实会毁掉用户摆好的位置。
 */
export function relayoutSequential(clips: Clip[]): Clip[] {
  let cursor = 0;
  let changed = false;
  const next = clips.map((clip) => {
    if (Math.abs(clip.timelineStart - cursor) <= EPS) {
      cursor = clipEnd(clip);
      return clip;
    }
    changed = true;
    const moved = { ...clip, timelineStart: cursor };
    cursor = clipEnd(moved);
    return moved;
  });
  return changed ? next : clips;
}

/**
 * 拖序：把 `id` 片段挪到 `index` 位置（`index` 夹取到合法范围），随后压实。
 *
 * 未发生变化（同位置 / 找不到 id）→ 返回**原数组引用**（I4）。
 */
/**
 * ⚠️ **本函数（及 `duplicateClip` / `trimLeftAt` / `trimRightAt` / `freezeFrameAt`）内嵌了
 * 「压实」动作，因此只适用于磁吸轨（主视频轨）。** 对自由轨（`overlay: true`）调用会**错误地
 * 合掉用户摆好的空隙**。判据（这条轨是不是磁吸轨）在**宿主**手里 —— 只有 `updateClip` 接收
 * `tracks`、能自己判 `overlay`；clips 级原语拿不到这个信息，故这里不做判断、由调用方保证。
 * （`docs/123` §一.4：`relayoutSequential` 的语义就是「**主轨**压实」。）
 */
export function moveClipTo(clips: Clip[], id: string, index: number): Clip[] {
  const from = clips.findIndex((c) => c.id === id);
  if (from < 0) return clips;
  const to = Math.max(0, Math.min(clips.length - 1, Math.trunc(index)));
  if (to === from) return clips;
  const next = clips.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return relayoutSequential(next);
}

/**
 * 复制片段：副本**紧随其后**，复用已修剪物料（`docs/120` C15.2 —— 不重新 trim）。
 * id 一律 `generateId()`；**禁时间基后缀**（`docs/123` §二.5：那正是 N 仓库串改事故的根因）。
 */
export function duplicateClip(clips: Clip[], id: string): Clip[] {
  const index = clips.findIndex((c) => c.id === id);
  if (index < 0) return clips;
  const source = clips[index];
  const copy: Clip = { ...source, id: generateId('clip') };
  const next = clips.slice();
  next.splice(index + 1, 0, copy);
  return relayoutSequential(next);
}

/** 删除模式：`lift` = 留洞（保留其它片段位置）；`ripple` = 波纹前移（删后压实）。 */
export type RemoveMode = 'lift' | 'ripple';

/**
 * 删除片段（**二态**）—— `docs/123` §一.4 B 组 / §二.5。
 *
 *  - `lift`：**唯一允许产生空隙的显式动作**（`docs/120` C15）；时段变空，其它片段不动；
 *  - `ripple`：删后立刻压实，后续片段前移。
 *
 * ⚠️ **不引入「至少保留一个片段」**（`docs/120` C11.9）：空工程是合法状态。
 * 参考实现那句「强制保留一个」已按拒绝清单剔除。
 * 无命中 → 返回**原数组引用**（I4）。
 */
export function removeClips(clips: Clip[], ids: readonly string[], mode: RemoveMode): Clip[] {
  const kill = new Set(ids);
  const kept = clips.filter((c) => !kill.has(c.id));
  if (kept.length === clips.length) return clips;
  return mode === 'ripple' ? relayoutSequential(kept) : kept;
}

/**
 * 在 `t` 处切开片段 —— 返回新数组，或 `null`（**不可切**，调用处置灰 + tooltip，§一.5 O3）。
 *
 * 【判据：严格内部】（`docs/123` §二.9 第 4 行「弱化」）
 * 不再要求两侧各留一个魔法秒数（A 的 0.05s×2）。地基解是「播放头吸附到离散候选 `clipEdges`」——
 * 于是「落在片段边界」变成一个**明确状态**（UI 直接置灰），本函数只需判「严格内部」。
 * 故本仓**不设** `MIN_SPLIT_MARGIN` 魔法常量：容差只剩浮点意义。
 */
export function splitAt(clips: Clip[], t: number): Clip[] | null {
  const hit = findClipAt(clips, t);
  if (!hit) return null;
  const { clip, index } = hit;
  const end = clipEnd(clip);
  if (t <= clip.timelineStart + EPS || t >= end - EPS) return null;

  // 源时间 = 入点 + 已播放时长（共用映射原语的同一条公式；此处直接算，避免为了一个减法再绕一层）
  const cutSource = clip.sourceStart + (t - clip.timelineStart);
  const left: Clip = { ...clip, sourceEnd: cutSource };
  const right: Clip = {
    ...clip,
    id: generateId('clip'),
    sourceStart: cutSource,
    timelineStart: t,
  };
  const next = clips.slice();
  next.splice(index, 1, left, right);
  return next;
}

/** 裁掉播放头**左侧**、保留右半（片段的左边界移到 `t`）。不可裁 → `null`。 */
export function trimLeftAt(clips: Clip[], t: number): Clip[] | null {
  const hit = findClipAt(clips, t);
  if (!hit) return null;
  const { clip } = hit;
  if (t <= clip.timelineStart + EPS || t >= clipEnd(clip) - EPS) return null;
  const cutSource = clip.sourceStart + (t - clip.timelineStart);
  return relayoutSequential(
    clips.map((c) => (c.id === clip.id ? { ...c, sourceStart: cutSource, timelineStart: t } : c)),
  );
}

/** 裁掉播放头**右侧**、保留左半（片段的右边界移到 `t`）。不可裁 → `null`。 */
export function trimRightAt(clips: Clip[], t: number): Clip[] | null {
  const hit = findClipAt(clips, t);
  if (!hit) return null;
  const { clip } = hit;
  if (t <= clip.timelineStart + EPS || t >= clipEnd(clip) - EPS) return null;
  const cutSource = clip.sourceStart + (t - clip.timelineStart);
  return relayoutSequential(
    clips.map((c) => (c.id === clip.id ? { ...c, sourceEnd: cutSource } : c)),
  );
}

/**
 * 定格：在 `t` 处切开并插入一个**静止片段**（`docs/123` §一.4 B 组 / §一.9 Q4）。
 *
 * 产物是**图片片段**（`kind: 'image'`），且**不新增 clip 类型** ——
 * 定格就是「一张等于该帧的图片」，走图片片段同一条渲染/合成路径，导出自然正确。
 * 默认时长 = `DEFAULT_IMAGE_CLIP_DURATION`（调用方可传 `dur`）。
 * 不可切（`t` 不在严格内部）→ `null`。
 */
export function freezeFrameAt(
  clips: Clip[],
  t: number,
  dur: number,
): { clips: Clip[]; frameAt: number } | null {
  const hit = findClipAt(clips, t);
  if (!hit) return null;
  const { clip, index } = hit;
  if (t <= clip.timelineStart + EPS || t >= clipEnd(clip) - EPS) return null;

  const cutSource = clip.sourceStart + (t - clip.timelineStart);
  const left: Clip = { ...clip, sourceEnd: cutSource };
  // 定格帧继承被切片的素材身份（sourceUrl/assetId/nodeId 指同一个源），
  // 但只取用该时刻的**一帧** —— 故它是 `kind: 'image'`，走图片片段同一条渲染/合成路径。
  const frame: Clip = {
    ...clip,
    id: generateId('clip'),
    kind: 'image',
    sourceStart: cutSource,
    sourceEnd: cutSource + Math.max(0, dur),
    timelineStart: t,
  };
  const right: Clip = { ...clip, id: generateId('clip'), sourceStart: cutSource, timelineStart: t };

  const next = clips.slice();
  next.splice(index, 1, left, frame, right);
  // 主轨压实：右半自动被推到定格帧之后（`frameAt` 也因此是**压实后**的时刻，
  // 轨上有空隙时它会与入参 `t` 不同 —— 这正是返回值存在的意义）。
  const settled = relayoutSequential(next);
  return { clips: settled, frameAt: t };
}

/**
 * 按 id 更新片段所属轨（`docs/120` C1.1 的唯一改写路径）。
 *
 * 主轨更新后**压实**（磁吸不变量 I1）；自由轨保留位置。
 * `fn` 返回**同一个片段引用**（或整个 tracks 没有任何引用变化）→ 返回入参 `tracks`（I4）。
 */
export function updateClip(tracks: Track[], clipId: string, fn: (clip: Clip) => Clip): Track[] {
  let touched = false;
  const next = tracks.map((track) => {
    if (!track.clips.some((c) => c.id === clipId)) return track;
    touched = true;
    const clips = track.clips.map((c) => (c.id === clipId ? fn(c) : c));
    const settled = track.overlay ? clips : relayoutSequential(clips);
    return unchanged(settled, track.clips) ? track : { ...track, clips: settled };
  });
  if (!touched) return tracks;
  return unchanged(next, tracks) ? tracks : next;
}

/**
 * 自由轨定位（**不压实**）：把片段起点挪到 `t`（夹 `>= 0`）。
 * 未变 → 原引用（I4）。
 */
export function placeClipAt(clips: Clip[], id: string, t: number): Clip[] {
  const start = Math.max(0, t);
  let changed = false;
  const next = clips.map((clip) => {
    if (clip.id !== id || Math.abs(clip.timelineStart - start) <= EPS) return clip;
    changed = true;
    return { ...clip, timelineStart: start };
  });
  return changed ? next : clips;
}
