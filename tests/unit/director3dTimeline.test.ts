// 回归测试：director3d 时间轴插值引擎（timelineInterpolation.ts）
import { describe, it, expect } from "vitest";
import {
  TIME_EPSILON,
  appendKeyframes,
  applyTransformAt,
  blendControls,
  buildAxisKeyframeFields,
  createDefaultTimeline,
  facingYaw,
  findFrameAtTime,
  interpolatePose,
  interpolateScalar,
  interpolateTarget,
  interpolateVec,
  lerpVec,
  resolveCameraFollowTarget,
  sampleKeyframeCurve,
  upsertPoseKeyframe,
  upsertTransformKeyframe,
} from "../../src/components/director3d/editor/runtime/timelineInterpolation";
import type { DirectorCameraShot, DirectorKeyframe, DirectorObject, DirectorTimeline, DirectorTransform } from "../../src/components/director3d/editor/schema/directorProject";

function makeFrame(time: number, patch: Partial<DirectorKeyframe> = {}): DirectorKeyframe {
  return { id: `kf_${time}`, time, ...patch };
}

const BASE_POS: [number, number, number] = [0, 0, 0];
const BASE_ROT: [number, number, number] = [0, 0, 0];

describe("lerpVec", () => {
  it("t=0 返回起点，t=1 返回终点", () => {
    expect(lerpVec([0, 0, 0], [10, 20, 30], 0)).toEqual([0, 0, 0]);
    expect(lerpVec([0, 0, 0], [10, 20, 30], 1)).toEqual([10, 20, 30]);
  });

  it("t=0.5 逐分量取中", () => {
    expect(lerpVec([0, 2, 4], [10, 8, 6], 0.5)).toEqual([5, 5, 5]);
  });
});

describe("interpolateVec", () => {
  const frames = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [10, 0, 0] })];

  it("边界：t≤首帧取首帧，t≥末帧取末帧", () => {
    expect(interpolateVec(BASE_POS, frames, -1, "position")).toEqual([0, 0, 0]);
    expect(interpolateVec(BASE_POS, frames, 0, "position")).toEqual([0, 0, 0]);
    expect(interpolateVec(BASE_POS, frames, 2, "position")).toEqual([10, 0, 0]);
    expect(interpolateVec(BASE_POS, frames, 99, "position")).toEqual([10, 0, 0]);
  });

  it("区间中：linear 按原比例", () => {
    expect(interpolateVec(BASE_POS, frames, 1, "position")).toEqual([5, 0, 0]);
  });

  it("easing=hold 取前帧值", () => {
    const holdFrames = [makeFrame(0, { position: [1, 0, 0], easing: "hold" }), makeFrame(2, { position: [9, 0, 0] })];
    expect(interpolateVec(BASE_POS, holdFrames, 1, "position")).toEqual([1, 0, 0]);
  });

  it("easing=ease 在 3/4 处大于 linear（smoothstep 加速段）", () => {
    const easeFrames = [makeFrame(0, { position: [0, 0, 0], easing: "ease" }), makeFrame(2, { position: [10, 0, 0] })];
    const linearValue = interpolateVec(BASE_POS, easeFrames, 1.5, "position")[0];
    const easeFramesLinear = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [10, 0, 0] })];
    const linearOnly = interpolateVec(BASE_POS, easeFramesLinear, 1.5, "position")[0];
    expect(linearValue).toBeGreaterThan(linearOnly);
  });

  it("0 长区间不产生 NaN", () => {
    const zeroFrames = [makeFrame(1, { position: [3, 0, 0] }), makeFrame(1, { position: [7, 0, 0] })];
    const result = interpolateVec(BASE_POS, zeroFrames, 1, "position");
    expect(Number.isNaN(result[0])).toBe(false);
  });
});

describe("interpolateScalar", () => {
  it("标量插值同语义", () => {
    const frames = [makeFrame(0, { fov: 50 }), makeFrame(4, { fov: 80 })];
    expect(interpolateScalar(50, frames, 0, "fov")).toBe(50);
    expect(interpolateScalar(50, frames, 4, "fov")).toBe(80);
    expect(interpolateScalar(50, frames, 2, "fov")).toBe(65);
  });

  it("无对应字段的帧被忽略", () => {
    const frames = [makeFrame(0, { position: [1, 0, 0] }), makeFrame(4, { near: 0.1 })];
    expect(interpolateScalar(50, frames, 2, "fov")).toBe(50);
  });
});

describe("blendControls", () => {
  it("逐 key lerp", () => {
    expect(blendControls({ a: 0, b: 10 }, { a: 100, b: 20 }, 0.5)).toEqual({ a: 50, b: 15 });
  });

  it("key 集不一致时并集补 0", () => {
    const result = blendControls({ a: 0 }, { b: 10 }, 0.5);
    expect(result).toHaveProperty("a", 0);
    expect(result).toHaveProperty("b", 5);
  });
});

describe("interpolatePose", () => {
  const rig = { posePresetId: "stand" as const, controls: {} };

  it("无姿势帧返回 null", () => {
    const frames = [makeFrame(0, { position: [0, 0, 0] })];
    expect(interpolatePose(rig, frames, 0.5)).toBeNull();
  });

  it("边界取首/末帧", () => {
    const frames = [makeFrame(0, { posePresetId: "t-pose" }), makeFrame(2, { posePresetId: "run" })];
    expect(interpolatePose(rig, frames, 0)?.posePresetId).toBe("t-pose");
    expect(interpolatePose(rig, frames, 2)?.posePresetId).toBe("run");
  });

  it("ease 中间帧各 key 在两者值之间", () => {
    const frames = [
      makeFrame(0, { controls: { leftKnee: 0, rightKnee: 0 } }),
      makeFrame(2, { controls: { leftKnee: 100, rightKnee: 100 } }),
    ];
    const result = interpolatePose(rig, frames, 1);
    expect(result?.controls.leftKnee).toBeGreaterThan(0);
    expect(result?.controls.leftKnee).toBeLessThan(100);
    expect(result?.controls.leftKnee).toBe(50);
  });

  it("controls 优先于 posePresetId", () => {
    const frames = [makeFrame(0, { posePresetId: "stand", controls: { leftKnee: 42 } })];
    expect(interpolatePose(rig, frames, 0)?.controls).toEqual({ leftKnee: 42 });
  });
});

describe("interpolateTarget", () => {
  it("看向点插值", () => {
    const frames = [makeFrame(0, { target: [0, 0, 0] }), makeFrame(2, { target: [0, 2, 0] })];
    expect(interpolateTarget([0, 0, 0], frames, 1)).toEqual([0, 1, 0]);
  });
});

describe("facingYaw", () => {
  it("XZ 平面朝向角 = atan2(dx, dz)", () => {
    const frames = [
      makeFrame(0, { position: [0, 0, 0] }),
      makeFrame(2, { position: [1, 0, 0] }),
    ];
    expect(facingYaw(frames, 1)).toBeCloseTo(Math.PI / 2, 5);
  });

  it("帧数不足返回 0", () => {
    expect(facingYaw([makeFrame(0, { position: [0, 0, 0] })], 0.5)).toBe(0);
  });
});

describe("applyTransformAt", () => {
  const transform: DirectorTransform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

  it("无轨道帧时返回原 transform", () => {
    expect(applyTransformAt(transform, [], 0)).toEqual(transform);
  });

  it("isFace 时用朝向角覆写 rotation.y", () => {
    const frames = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [0, 0, 2] })];
    const result = applyTransformAt(transform, frames, 1, true);
    expect(result.rotation[1]).toBeCloseTo(0, 5);
    expect(result.position[2]).toBeGreaterThan(0);
  });

  it("返回新对象，不改入参", () => {
    const frames = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [2, 0, 0] })];
    const result = applyTransformAt(transform, frames, 1);
    expect(result).not.toBe(transform);
    expect(result.scale).toEqual([1, 1, 1]);
    expect(transform.position).toEqual([0, 0, 0]);
  });
});

describe("appendKeyframes / upsert", () => {
  it("f0 返回新对象，不改入参 timeline", () => {
    const timeline = createDefaultTimeline();
    const next = appendKeyframes(timeline, "obj1", [makeFrame(1, { position: [1, 0, 0] })]);
    expect(next).not.toBe(timeline);
    expect(timeline.tracks).toEqual({});
    expect(next.tracks.obj1).toHaveLength(1);
  });

  it("f0 追加后按 time 排序", () => {
    const timeline = appendKeyframes(createDefaultTimeline(), "obj1", [
      makeFrame(3, { position: [3, 0, 0] }),
      makeFrame(1, { position: [1, 0, 0] }),
    ]);
    expect(timeline.tracks.obj1.map((frame) => frame.time)).toEqual([1, 3]);
  });

  it("f0 打帧后 duration 扩到 max(time)+0.001", () => {
    const timeline = appendKeyframes(createDefaultTimeline(), "obj1", [makeFrame(8, { position: [8, 0, 0] })]);
    expect(timeline.duration).toBeCloseTo(8.001, 5);
  });

  it("h0 同帧覆盖（time 容差内）", () => {
    let timeline = appendKeyframes(createDefaultTimeline(), "obj1", [
      makeFrame(1, { position: [1, 0, 0], posePresetId: "stand" }),
    ]);
    const beforeCount = timeline.tracks.obj1.length;
    timeline = upsertPoseKeyframe(timeline, "obj1", { posePresetId: "stand", controls: {} }, 1, "run", {
      leftKnee: 60,
    });
    expect(timeline.tracks.obj1).toHaveLength(beforeCount);
    expect(timeline.tracks.obj1[0].posePresetId).toBe("run");
  });

  it("h0 不同帧则插入", () => {
    let timeline = upsertPoseKeyframe(createDefaultTimeline(), "obj1", { posePresetId: "stand", controls: {} }, 1, "run", {});
    timeline = upsertPoseKeyframe(timeline, "obj1", { posePresetId: "stand", controls: {} }, 3, "run", {});
    expect(timeline.tracks.obj1).toHaveLength(2);
  });

  it("upsertTransformKeyframe 同帧覆盖位移帧", () => {
    let timeline = upsertTransformKeyframe(createDefaultTimeline(), "obj1", { position: [1, 0, 0], rotation: [0, 0, 0] }, 2);
    const count = timeline.tracks.obj1.length;
    timeline = upsertTransformKeyframe(timeline, "obj1", { position: [9, 0, 0], rotation: [0, 0, 0] }, 2 + TIME_EPSILON / 2);
    expect(timeline.tracks.obj1).toHaveLength(count);
    expect(timeline.tracks.obj1[0].position).toEqual([9, 0, 0]);
  });
});

describe("findFrameAtTime", () => {
  it("命中同帧（含容差）返回该帧", () => {
    const track = [makeFrame(1, { position: [1, 0, 0] }), makeFrame(3, { position: [3, 0, 0] })];
    expect(findFrameAtTime(track, 1)?.id).toBe("kf_1");
    expect(findFrameAtTime(track, 1 + TIME_EPSILON / 2)?.id).toBe("kf_1");
  });

  it("无同帧返回 null", () => {
    expect(findFrameAtTime([makeFrame(1, {})], 2)).toBeNull();
  });
});

describe("buildAxisKeyframeFields（每轴独立打帧·按轴合并）", () => {
  it("无同帧时目标轴取当前值，其余轴取当前值", () => {
    const fields = buildAxisKeyframeFields([], 0, "position", 0, [5, 6, 7]);
    expect(fields.position).toEqual([5, 6, 7]);
  });

  it("有同帧时其余轴保留同帧值，目标轴取当前值", () => {
    const track = [makeFrame(0, { position: [100, 200, 300] })];
    const fields = buildAxisKeyframeFields(track, 0, "position", 1, [5, 6, 7]);
    expect(fields.position).toEqual([100, 6, 300]);
  });

  it("rotation 同样按轴合并", () => {
    const track = [makeFrame(0, { rotation: [0.1, 0.2, 0.3] })];
    const fields = buildAxisKeyframeFields(track, 0, "rotation", 2, [1, 2, 3]);
    expect(fields.rotation).toEqual([0.1, 0.2, 3]);
  });
});

describe("resolveCameraFollowTarget（C4D 目标约束实时跟随）", () => {
  const camera: DirectorCameraShot = {
    id: "cam_1",
    name: "机位 1",
    fov: 60,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    targetMode: "manual",
    target: [0, 0, 0],
  };
  const role: DirectorObject = {
    id: "char_1",
    name: "角色",
    kind: "character",
    visible: true,
    locked: false,
    transform: { position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    characterRig: { rigType: "ue4-mannequin", posePresetId: "stand", controls: {} },
  };

  it("手动模式返回 null（不走跟随）", () => {
    expect(resolveCameraFollowTarget(camera, [role], undefined, 0)).toBeNull();
  });

  it("目标对象模式且目标对象无轨道 → 返回实时 transform", () => {
    const follow: DirectorCameraShot = { ...camera, targetMode: "object", targetObjectId: "char_1" };
    expect(resolveCameraFollowTarget(follow, [role], undefined, 0)).toEqual([1, 0, 0]);
  });

  it("目标对象模式且目标对象有位移轨道 → 返回插值位置", () => {
    const timeline: DirectorTimeline = createDefaultTimeline();
    timeline.tracks.char_1 = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [10, 0, 0] })];
    const follow: DirectorCameraShot = { ...camera, targetMode: "object", targetObjectId: "char_1" };
    expect(resolveCameraFollowTarget(follow, [role], timeline, 1)).toEqual([5, 0, 0]);
  });

  it("目标对象不存在 → 返回 null", () => {
    const follow: DirectorCameraShot = { ...camera, targetMode: "object", targetObjectId: "missing" };
    expect(resolveCameraFollowTarget(follow, [role], undefined, 0)).toBeNull();
  });
});

describe("sampleKeyframeCurve", () => {
  it("无该字段帧返回空数组", () => {
    expect(sampleKeyframeCurve([makeFrame(0, { position: [1, 0, 0] })], "fov", null)).toEqual([]);
  });

  it("position 轴采样两端对齐关键帧值", () => {
    const track = [makeFrame(0, { position: [0, 0, 0] }), makeFrame(2, { position: [10, 0, 0] })];
    const points = sampleKeyframeCurve(track, "position", 0, 20);
    expect(points.length).toBe(21);
    expect(points[0]).toEqual({ time: 0, value: 0 });
    expect(points[20]).toEqual({ time: 2, value: 10 });
    expect(points[10].value).toBeCloseTo(5, 5);
  });

  it("fov 标量采样", () => {
    const track = [makeFrame(0, { fov: 50 }), makeFrame(4, { fov: 80 })];
    const points = sampleKeyframeCurve(track, "fov", null, 4);
    expect(points[0].value).toBe(50);
    expect(points[4].value).toBe(80);
    expect(points[2].value).toBeCloseTo(65, 5);
  });

  it("hold 插值呈台阶（中段取前帧值）", () => {
    const track = [makeFrame(0, { position: [0, 0, 0], easing: "hold" }), makeFrame(2, { position: [10, 0, 0] })];
    const points = sampleKeyframeCurve(track, "position", 0, 4);
    expect(points[1].value).toBeCloseTo(0, 5);
  });
});