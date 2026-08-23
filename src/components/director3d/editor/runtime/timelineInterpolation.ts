import { generateId } from "../../../base/idGen.js";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import type {
  DirectorCameraShot,
  DirectorKeyframe,
  DirectorObject,
  DirectorTimeline,
  DirectorTransform,
  KeyframeEasing,
} from "../schema/directorProject";

/**
 * 时间轴关键帧插值引擎（纯函数层）。
 *
 * 全部无副作用、不触 store、不依赖 React，可脱离环境单测。
 * 对应外部 Storyai3d-lv 还原出的 f1/_w/BF/N0/Il/Cy/mC/f0/h0 等函数。
 */

/** 同帧覆盖时间容差（秒） */
export const TIME_EPSILON = 0.0001;
export const DEFAULT_TIMELINE_DURATION = 5;
export const DEFAULT_TIMELINE_FPS = 30;

export type Vec3Field = "position" | "rotation" | "target" | "scale";
export type ScalarField = "fov" | "near" | "far";

export function createDefaultTimeline(): DirectorTimeline {
  return {
    duration: DEFAULT_TIMELINE_DURATION,
    fps: DEFAULT_TIMELINE_FPS,
    tracks: {},
  };
}

export function lerpVec(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function toFrameT(
  a: DirectorKeyframe,
  b: DirectorKeyframe,
  t: number,
  defaultEasing: KeyframeEasing
): { t: number; easing: KeyframeEasing } {
  const interval = b.time - a.time;
  const ratio = interval === 0 ? 0 : (t - a.time) / interval;
  const easing = a.easing ?? defaultEasing;

  if (easing === "hold") {
    return { t: 0, easing };
  }
  if (easing === "ease") {
    return { t: smoothstep(ratio), easing };
  }
  return { t: ratio, easing };
}

function clampT(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sortByTime(keyframes: DirectorKeyframe[]): DirectorKeyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

/**
 * 在已过滤出「含指定字段」的关键帧里找 t 所在区间下标。
 * 假设 keyframes 已按 time 升序。
 */
function findIntervalIndex(keyframes: DirectorKeyframe[], t: number): number {
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (t >= current.time && t <= next.time) return index;
  }
  return keyframes.length - 2;
}

/**
 * 三维向量插值（position/rotation/target）。边界取首/末帧，区间内按 easing 插值。
 */
export function interpolateVec(
  base: [number, number, number],
  keyframes: DirectorKeyframe[],
  t: number,
  field: Vec3Field
): [number, number, number] {
  const frames = sortByTime(keyframes.filter((item) => item[field] !== undefined && item[field] !== null));
  if (frames.length === 0) return base;

  const first = frames[0];
  const last = frames[frames.length - 1];

  if (t <= first.time + TIME_EPSILON) return first[field] as [number, number, number];
  if (t >= last.time - TIME_EPSILON) return last[field] as [number, number, number];

  const index = findIntervalIndex(frames, t);
  const a = frames[index];
  const b = frames[index + 1];
  const aValue = a[field] as [number, number, number];
  const bValue = b[field] as [number, number, number];
  const { t: frameT } = toFrameT(a, b, t, "linear");

  return lerpVec(aValue, bValue, clampT(frameT));
}

/**
 * 标量插值（fov/near/far）。逻辑同 interpolateVec。
 */
export function interpolateScalar(
  base: number,
  keyframes: DirectorKeyframe[],
  t: number,
  field: ScalarField
): number {
  const frames = sortByTime(
    keyframes.filter((item): item is DirectorKeyframe => typeof item[field] === "number")
  );
  if (frames.length === 0) return base;

  const first = frames[0];
  const last = frames[frames.length - 1];

  if (t <= first.time + TIME_EPSILON) return first[field] as number;
  if (t >= last.time - TIME_EPSILON) return last[field] as number;

  const index = findIntervalIndex(frames, t);
  const a = frames[index];
  const b = frames[index + 1];
  const aValue = a[field] as number;
  const bValue = b[field] as number;
  const { t: frameT } = toFrameT(a, b, t, "linear");

  return lerpScalar(aValue, bValue, clampT(frameT));
}

/**
 * 骨骼 controls 逐 key 混合（并集补 0）。
 */
export function blendControls(
  a: Record<string, number>,
  b: Record<string, number>,
  t: number
): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const result: Record<string, number> = {};

  keys.forEach((key) => {
    result[key] = lerpScalar(a[key] ?? 0, b[key] ?? 0, clampT(t));
  });

  return result;
}

function resolveBuiltinPoseControls(poseId: string | null): Record<string, number> | null {
  if (!poseId) return null;
  return MANNEQUIN_POSE_PRESETS.find((item) => item.id === poseId)?.controls ?? null;
}

function resolvePoseControls(keyframe: DirectorKeyframe): Record<string, number> | null {
  if (keyframe.controls && Object.keys(keyframe.controls).length > 0) return keyframe.controls;

  if (keyframe.posePresetId) {
    return resolveBuiltinPoseControls(keyframe.posePresetId);
  }

  return null;
}

export interface InterpolatedPose {
  posePresetId: string | null;
  controls: Record<string, number>;
}

/**
 * 姿势插值：只取有 posePresetId/controls 的帧；controls 优先于 posePresetId 解析；
 * 区间内 ease 用 blendControls 混合，hold 取前帧。无姿势帧返回 null。
 */
export function interpolatePose(
  _rig: { posePresetId: string | null; controls: Record<string, number> } | undefined,
  keyframes: DirectorKeyframe[],
  t: number
): InterpolatedPose | null {
  const frames = sortByTime(
    keyframes.filter((item) => item.posePresetId != null || (item.controls && Object.keys(item.controls).length > 0))
  );
  if (frames.length === 0) return null;

  const first = frames[0];
  const last = frames[frames.length - 1];

  if (t <= first.time + TIME_EPSILON) {
    const controls = resolvePoseControls(first);
    return { posePresetId: first.posePresetId ?? null, controls: controls ?? {} };
  }
  if (t >= last.time - TIME_EPSILON) {
    const controls = resolvePoseControls(last);
    return { posePresetId: last.posePresetId ?? null, controls: controls ?? {} };
  }

  const index = findIntervalIndex(frames, t);
  const a = frames[index];
  const b = frames[index + 1];
  const aControls = resolvePoseControls(a);
  const bControls = resolvePoseControls(b);

  if (!aControls && !bControls) {
    return { posePresetId: a.posePresetId ?? null, controls: {} };
  }

  const { t: frameT, easing } = toFrameT(a, b, t, "ease");

  if (easing === "hold") {
    return { posePresetId: a.posePresetId ?? null, controls: aControls ?? {} };
  }

  return {
    posePresetId: a.posePresetId ?? null,
    controls: blendControls(aControls ?? {}, bControls ?? {}, frameT),
  };
}

/** 行走循环的摆动幅度常量 */
const WALK_SWING_HIP = 28;
const WALK_SWING_KNEE = 42;
const WALK_SWING_ARM = 12;
const WALK_BODY_BOUNCE = 3;

/**
 * 行走循环动画：基于内置 walk 姿势预设 + 时间相位，做腿部/手臂周期性摆动。
 * 播放时对使用 walk 姿态的角色调用，得到会走路的动态骨骼控制值。
 * @param time 播放头时间（秒）
 * @param speed 步频（步/秒）
 */
export function applyWalkCycle(time: number, speed = 2): Record<string, number> {
  const base: Record<string, number> = {
    "leftShoulder.pitch": 20,
    "rightShoulder.pitch": -20,
    "leftHip.pitch": -20,
    "rightHip.pitch": 20,
    "leftKnee.bend": 12,
    "rightKnee.bend": 4,
  };
  // 每步为一个 sin 半周期：speed 步/秒 → 完整周期 = speed/2 次/秒
  const phase = time * Math.PI * 2 * (speed / 2);
  const swing = Math.sin(phase);
  const kneeLeft = Math.max(0, Math.sin(phase));
  const kneeRight = Math.max(0, -Math.sin(phase));

  return {
    ...base,
    "leftHip.pitch": base["leftHip.pitch"] - swing * WALK_SWING_HIP,
    "rightHip.pitch": base["rightHip.pitch"] + swing * WALK_SWING_HIP,
    "leftKnee.bend": base["leftKnee.bend"] + kneeLeft * WALK_SWING_KNEE,
    "rightKnee.bend": base["rightKnee.bend"] + kneeRight * WALK_SWING_KNEE,
    "leftShoulder.pitch": base["leftShoulder.pitch"] + swing * WALK_SWING_ARM,
    "rightShoulder.pitch": base["rightShoulder.pitch"] - swing * WALK_SWING_ARM,
    "body.pitch": swing * WALK_BODY_BOUNCE,
    "body.offsetY": -Math.abs(swing) * 0.03,
  };
}

/**
 * 相机看向点插值。
 */
export function interpolateTarget(
  target: [number, number, number],
  keyframes: DirectorKeyframe[],
  t: number
): [number, number, number] {
  return interpolateVec(target, keyframes, t, "target");
}

/**
 * XZ 平面朝向角（atan2(dx, dz)），取 t 时刻前后两帧位置差，用于角色面向运动方向。
 */
export function facingYaw(keyframes: DirectorKeyframe[], t: number): number {
  const frames = sortByTime(
    keyframes.filter((item): item is DirectorKeyframe => item.position !== undefined && item.position !== null)
  );
  if (frames.length < 2) return 0;

  let from = frames[0];
  let to = frames[frames.length - 1];

  for (let index = 0; index < frames.length - 1; index += 1) {
    const current = frames[index];
    const next = frames[index + 1];
    if (t >= current.time && t <= next.time) {
      from = current;
      to = next;
      break;
    }
  }

  if (t <= frames[0].time + TIME_EPSILON) {
    const useFrom = frames[0];
    const useTo = frames[1];
    from = useFrom;
    to = useTo;
  }

  const aPos = from.position as [number, number, number];
  const bPos = to.position as [number, number, number];
  const dx = bPos[0] - aPos[0];
  const dz = bPos[2] - aPos[2];

  return Math.atan2(dx, dz);
}

/**
 * 封装 position/rotation 插值 + 可选朝向角（isFace 为 true 时用 XZ 平面朝向覆写 rotation.y）。
 */
export function applyTransformAt(
  transform: DirectorTransform,
  keyframes: DirectorKeyframe[],
  t: number,
  isFace = false
): DirectorTransform {
  const position = interpolateVec(transform.position, keyframes, t, "position");
  const rotation = interpolateVec(transform.rotation, keyframes, t, "rotation");
  const scale = interpolateVec(transform.scale, keyframes, t, "scale");

  if (isFace) {
    rotation[1] = facingYaw(keyframes, t);
  }

  return {
    ...transform,
    position,
    rotation,
    scale,
  };
}

function extendDuration(timeline: DirectorTimeline, trackId: string): DirectorTimeline {
  const track = timeline.tracks[trackId];
  if (!track || track.length === 0) return timeline;

  const maxTime = Math.max(...track.map((frame) => frame.time));
  return {
    ...timeline,
    duration: Math.max(timeline.duration ?? 0, maxTime + 0.001),
  };
}

function withUpdatedTrack(timeline: DirectorTimeline, trackId: string, track: DirectorKeyframe[]): DirectorTimeline {
  const nextTimeline: DirectorTimeline = {
    ...timeline,
    tracks: {
      ...timeline.tracks,
      [trackId]: sortByTime(track),
    },
  };
  return extendDuration(nextTimeline, trackId);
}

/**
 * 写轨（f0）：把关键帧 append/replace 进轨道，按 time 排序并扩 duration。纯函数返回新对象。
 */
export function appendKeyframes(
  timeline: DirectorTimeline,
  trackId: string,
  keyframes: DirectorKeyframe[],
  mode: "append" | "replace" = "append"
): DirectorTimeline {
  const existing = timeline.tracks[trackId] ?? [];
  const base = mode === "replace" ? [] : existing;
  return withUpdatedTrack(timeline, trackId, [...base, ...keyframes]);
}

/**
 * 播放头覆盖/插入位移-旋转关键帧（用于视口拖动写回；相机帧可带 target/fov）。
 */
export function upsertTransformKeyframe(
  timeline: DirectorTimeline,
  trackId: string,
  keyframe: Pick<DirectorKeyframe, "position" | "rotation"> & {
    scale?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
  },
  time: number
): DirectorTimeline {
  const existing = timeline.tracks[trackId] ?? [];
  const matchIndex = existing.findIndex((item) => Math.abs(item.time - time) < TIME_EPSILON);
  const nextFrame: DirectorKeyframe = {
    id: generateId("kf"),
    time,
    position: keyframe.position,
    rotation: keyframe.rotation,
    scale: keyframe.scale,
    target: keyframe.target,
    fov: keyframe.fov,
    easing: "linear",
  };

  if (matchIndex >= 0) {
    const updated = existing.map((item, index) => {
      if (index !== matchIndex) return item;
      return { ...item, ...nextFrame, id: item.id };
    });
    return withUpdatedTrack(timeline, trackId, updated);
  }

  return withUpdatedTrack(timeline, trackId, [...existing, nextFrame]);
}

/**
 * 按属性组打帧：把传入字段合并进同 time 关键帧，缺省字段保留不覆盖。
 * 对应 AE/C4D 的"按属性打帧" —— 同一时间点上位置/旋转/姿态可各自独立记录。
 */
export function upsertKeyframeFields(
  timeline: DirectorTimeline,
  trackId: string,
  fields: Partial<Omit<DirectorKeyframe, "id" | "time">>,
  time: number
): DirectorTimeline {
  const existing = timeline.tracks[trackId] ?? [];
  const matchIndex = existing.findIndex((item) => Math.abs(item.time - time) < TIME_EPSILON);

  if (matchIndex >= 0) {
    const updated = existing.map((item, index) => {
      if (index !== matchIndex) return item;
      return { ...item, ...fields };
    });
    return withUpdatedTrack(timeline, trackId, updated);
  }

  const nextFrame: DirectorKeyframe = {
    id: generateId("kf"),
    time,
    ...fields,
    easing: "linear",
  };
  return withUpdatedTrack(timeline, trackId, [...existing, nextFrame]);
}

/**
 * 播放头覆盖/插入姿态关键帧（h0：同 time 容差内覆盖）。
 */
export function upsertPoseKeyframe(
  timeline: DirectorTimeline,
  trackId: string,
  _object: { posePresetId: string | null; controls: Record<string, number> },
  time: number,
  poseId: string | null,
  controls: Record<string, number>
): DirectorTimeline {
  const existing = timeline.tracks[trackId] ?? [];
  const matchIndex = existing.findIndex((item) => Math.abs(item.time - time) < TIME_EPSILON);
  const nextFrame: DirectorKeyframe = {
    id: generateId("kf"),
    time,
    posePresetId: poseId,
    controls,
    easing: "ease",
  };

  if (matchIndex >= 0) {
    const updated = existing.map((item, index) => {
      if (index !== matchIndex) return item;
      return { ...item, ...nextFrame, id: item.id };
    });
    return withUpdatedTrack(timeline, trackId, updated);
  }

  return withUpdatedTrack(timeline, trackId, [...existing, nextFrame]);
}

/* ══════════════════════════════════════════════════════════════════
 * 运镜 / 路径 关键帧生成（纯函数）
 * ══════════════════════════════════════════════════════════════════ */

export type CameraShotPresetId =
  | "dollyIn"
  | "dollyOut"
  | "truck"
  | "pan"
  | "orbit"
  | "crane"
  | "pedestal"
  | "handheld";

export interface CameraShotBase {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}
export interface CameraShotOptions {
  /** 起点时间（秒），默认取播放头 currentTime */
  startTime?: number;
  /** 运镜时长（秒） */
  segmentDuration: number;
  amount: number;
  angleDeg: number;
  /** 手持抖动随机种子 */
  seed: number;
}

class Vector3Like {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() {
    return new Vector3Like(this.x, this.y, this.z);
  }
  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  sub(o: Vector3Like) {
    this.x -= o.x;
    this.y -= o.y;
    this.z -= o.z;
    return this;
  }
  add(o: Vector3Like) {
    this.x += o.x;
    this.y += o.y;
    this.z += o.z;
    return this;
  }
  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  normalize() {
    const len = this.length();
    if (len === 0) return this;
    return this.multiplyScalar(1 / len);
  }
  cross(o: Vector3Like) {
    return new Vector3Like(
      this.y * o.z - this.z * o.y,
      this.z * o.x - this.x * o.z,
      this.x * o.y - this.y * o.x
    );
  }
  rotateAround(axis: Vector3Like, angle: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const u = axis.clone().normalize();
    const dot = this.x * u.x + this.y * u.y + this.z * u.z;
    const cross = u.clone().cross(this);
    const rx = this.x * cos + cross.x * sin + u.x * dot * (1 - cos);
    const ry = this.y * cos + cross.y * sin + u.y * dot * (1 - cos);
    const rz = this.z * cos + cross.z * sin + u.z * dot * (1 - cos);
    this.x = rx;
    this.y = ry;
    this.z = rz;
    return this;
  }
  toTuple(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
}

const US = new Vector3Like(0, 1, 0);

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timespan(end: number, start: number, count: number) {
  if (count <= 1) return [start];
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(start + (index / (count - 1)) * (end - start));
  }
  return values;
}

/**
 * 8 种运镜关键帧生成。返回按 time 排序的关键帧数组（含 position/target/fov）。
 */
export function buildCameraShotKeyframes(
  camera: CameraShotBase,
  preset: CameraShotPresetId,
  options: CameraShotOptions
): DirectorKeyframe[] {
  const startTime = options.startTime ?? 0;
  const { segmentDuration: duration, amount, angleDeg, seed: handheldSeed, fov } = (() => ({
    segmentDuration: options.segmentDuration,
    amount: options.amount,
    angleDeg: options.angleDeg,
    seed: options.seed,
    fov: camera.fov,
  }))();
  const position = new Vector3Like(...camera.position);
  const target = new Vector3Like(...camera.target);
  const end = startTime + duration;
  const angleRad = (angleDeg * Math.PI) / 180;

  const frame = (time: number, pos: Vector3Like, tgt: Vector3Like, easing: KeyframeEasing = "linear") => ({
    id: generateId("kf"),
    time,
    position: pos.toTuple(),
    target: tgt.toTuple(),
    fov,
    easing,
  });

  switch (preset) {
    case "dollyIn": {
      const dir = target.clone().sub(position).normalize();
      const pFrom = position.clone();
      const pTo = position.clone().add(dir.multiplyScalar(amount));
      return [frame(startTime, pFrom, target.clone()), frame(end, pTo, target.clone())];
    }
    case "dollyOut": {
      const dir = target.clone().sub(position).normalize();
      const pFrom = position.clone();
      const pTo = position.clone().sub(dir.multiplyScalar(amount));
      return [frame(startTime, pFrom, target.clone()), frame(end, pTo, target.clone())];
    }
    case "truck": {
      const forward = target.clone().sub(position).normalize();
      const lateral = forward.cross(US);
      if (lateral.length() === 0) lateral.set(1, 0, 0);
      lateral.normalize();
      const pFrom = position.clone();
      const pTo = position.clone().add(lateral.multiplyScalar(amount));
      return [frame(startTime, pFrom, target.clone()), frame(end, pTo, target.clone())];
    }
    case "crane": {
      const pFrom = position.clone();
      const pTo = position.clone().add(new Vector3Like(0, amount, 0));
      const tFrom = target.clone();
      const tTo = target.clone().add(new Vector3Like(0, amount * 0.6, 0));
      return [frame(startTime, pFrom, tFrom), frame(end, pTo, tTo)];
    }
    case "pedestal": {
      const tFrom = target.clone();
      const tTo = target.clone().add(new Vector3Like(0, amount, 0));
      return [frame(startTime, position.clone(), tFrom), frame(end, position.clone(), tTo)];
    }
    case "pan": {
      const offset = target.clone().sub(position);
      const pFrom = position.clone();
      const tTo = position.clone().add(offset.rotateAround(US, angleRad));
      return [frame(startTime, pFrom, target.clone()), frame(end, pFrom, tTo)];
    }
    case "orbit": {
      const safety = 12;
      const totalDeg = Math.abs(angleDeg);
      const count = Math.max(2, Math.min(360 / safety, Math.round(totalDeg / safety)));
      const offset = position.clone().sub(target);
      const times = timespan(end, startTime, count);
      return times.map((time, index) => {
        const t = count <= 1 ? 0 : index / (count - 1);
        const rotated = offset.clone().rotateAround(US, angleRad * t);
        return frame(time, target.clone().add(rotated), target.clone());
      });
    }
    case "handheld": {
      const rand = mulberry32(handheldSeed);
      const jitter = (scale: number) => (rand() - 0.5) * 2 * scale;
      const pFrom = position.clone();
      const pTo = position
        .clone()
        .add(new Vector3Like(jitter(amount), jitter(amount), jitter(amount)));
      const tTo = target
        .clone()
        .add(new Vector3Like(jitter(amount), jitter(amount), jitter(amount)));
      return [frame(startTime, pFrom, target.clone()), frame(end, pTo, tTo, "ease")];
    }
    default:
      return [frame(startTime, position.clone(), target.clone())];
  }
}

/* ══════════════════════════════════════════════════════════════════
 * C4D 式打帧触点 / 摄像机目标约束（纯函数）
 * ══════════════════════════════════════════════════════════════════ */

/** 在轨道里找当前播放头（含 TIME_EPSILON 容差）处的关键帧，无则 null */
export function findFrameAtTime(track: DirectorKeyframe[], time: number): DirectorKeyframe | null {
  return track.find((item) => Math.abs(item.time - time) < TIME_EPSILON) ?? null;
}

/**
 * 按轴合并打帧字段：点击某轴时，其余轴保留「同帧已有值」，缺省取对象当前值；
 * 目标轴取对象当前值。返回可传给 setKeyframeGroupAtPlayhead 的字段子集。
 * 对应 C4D「位置/旋转 X/Y/Z 每轴独立打帧点」。
 */
export function buildAxisKeyframeFields(
  track: DirectorKeyframe[],
  time: number,
  field: "position" | "rotation" | "target" | "scale",
  axisIndex: 0 | 1 | 2,
  currentVec: [number, number, number]
): Partial<Omit<DirectorKeyframe, "id" | "time">> {
  const frame = findFrameAtTime(track, time);
  const base = (frame?.[field] ?? currentVec) as [number, number, number];
  const next: [number, number, number] = [base[0], base[1], base[2]];
  next[axisIndex] = currentVec[axisIndex];
  return { [field]: next };
}

/**
 * 摄像机目标约束实时跟随（C4D Target）：
 * - targetMode === "object" 且有目标对象 → 返回目标对象的（动画）世界位置，实现注视点跟随
 * - 否则返回 null（手动模式，注视点由 target 关键帧驱动）
 * 目标对象若有位移轨道则取当前时间插值位置，否则取实时 transform。
 */
export function resolveCameraFollowTarget(
  camera: DirectorCameraShot,
  objects: DirectorObject[],
  timeline: DirectorTimeline | undefined,
  currentTime: number
): [number, number, number] | null {
  if (camera.targetMode !== "object" || !camera.targetObjectId) return null;
  const target = objects.find((item) => item.id === camera.targetObjectId);
  if (!target) return null;
  const track = timeline?.tracks?.[target.id];
  if (track && track.length > 0) {
    return applyTransformAt(target.transform, track, currentTime).position;
  }
  return target.transform.position;
}

/**
 * 采样一维 F-Curve：按 easing 插值生成折线点列 [time, value][]，供曲线编辑器绘制。
 * - 标量字段（fov）axis 传 null
 * - 向量字段（position/rotation/target）需指定 axis（0/1/2）
 * 无该字段关键帧时返回空数组。
 */
export function sampleKeyframeCurve(
  track: DirectorKeyframe[],
  field: "position" | "rotation" | "target" | "scale" | "fov",
  axis: 0 | 1 | 2 | null,
  samples = 48
): Array<{ time: number; value: number }> {
  const frames = sortByTime(
    track.filter((item) => (field === "fov" ? typeof item.fov === "number" : item[field] != null))
  );
  if (frames.length === 0) return [];

  const t0 = frames[0].time;
  const t1 = frames[frames.length - 1].time;
  const span = Math.max(t1 - t0, TIME_EPSILON);
  const points: Array<{ time: number; value: number }> = [];

  for (let index = 0; index <= samples; index += 1) {
    const t = t0 + (span * index) / samples;
    let value: number;
    if (field === "fov") {
      value = interpolateScalar(frames[0].fov ?? 0, frames, t, "fov");
    } else {
      const vec = interpolateVec([0, 0, 0], frames, t, field);
      value = vec[axis ?? 0];
    }
    points.push({ time: t, value });
  }
  return points;
}