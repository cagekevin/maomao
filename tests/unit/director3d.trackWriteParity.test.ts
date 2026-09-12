// 3D 导演台 · 轨道写入口对等性护栏（docs/115 · 契约 C6）
//
// 【这份测试是干什么的】
// 轨道写操作此前有**两套实现**：
//   · 对象轨：经 writeObjectTrack(tracks, id, op)——带 batch 语义（M4-C5）
//   · 相机轨：`moveCameraFrames` / `bakeCameraPath` 各自**手写**
//             `removeChannelFrames(...)` + `upsertChannelKeys(...)`
//             即重造了 batch 语义，与对象轨同名操作是两份实现。
// 两份实现一旦漂移（例如某处忘了先删旧帧），就会出现
// 「只在相机轨留下幽灵帧、对象轨不会」这类单轨道复现的怪问题。
//
// 【收口后的契约 C6】
// 两条轨道共用 project.ts 的 `applyTrackOperation(channels, operation)`；
// tracks.ts 禁止手写「先 remove 再 upsert」拼装。
//
// 【本测试锁住什么】
//  1. 相机轨每个操作与「旧手写实现」逐字等价（回归护栏）
//  2. 两条轨道在**同一语义场景**下产出**同构**结果（对等性护栏）
//     例：批量平移「目标帧被另一待移动帧占据」时，两条轨道都必须不丢帧。
//     这条最能暴露「某条轨道忘了先删旧帧」的漂移。
import { describe, it, expect } from 'vitest';
import {
  bakeCameraPath,
  bakeObjectPath,
  moveCameraFrame,
  moveCameraFrames,
  moveObjectFrames,
  removeCameraFrames,
  setCameraInterpolation,
  upsertCameraSnapshot,
} from '../../src/components/director3d/tracks.ts';
import {
  applyTrackOperation,
  countChannelKeyframes,
  moveChannelFrames,
  normalizeCameraPath,
  pathTangentAtFraction,
  cameraRotationToward,
  removeChannelFrames,
  setChannelInterpolation,
  snapshotToChannelKeys,
  upsertChannelKeys,
} from '../../src/components/director3d/project.ts';

// ---- 相机轨「收口前」的手写实现（逐字复刻，作为对照组）----

const legacyUpsertCameraSnapshot = (tracks, snapshot) =>
  upsertChannelKeys(
    tracks,
    snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation),
  );

const legacyRemoveCameraFrames = (tracks, frames) =>
  removeChannelFrames(tracks, Array.isArray(frames) ? frames : [frames]);

const legacyMoveCameraFrame = (tracks, from, to) => moveChannelFrames(tracks, from, to);

const legacySetCameraInterpolation = (tracks, frame, value) =>
  setChannelInterpolation(tracks, frame, value);

function legacyMoveCameraFrames(channels, frameMap) {
  const entries = Object.entries(frameMap);
  if (!entries.length) return channels;
  const fromFrames = entries.map(([from]) => Number(from));
  const toFrames = new Map(entries.map(([from, to]) => [Number(from), Number(to)]));
  const next = removeChannelFrames(channels, fromFrames);
  const keys = {};
  for (const [channel, list] of Object.entries(channels)) {
    const moved = (Array.isArray(list) ? list : [])
      .filter((key) => toFrames.has(key.frame))
      .map((key) => ({ ...key, frame: toFrames.get(key.frame) }));
    if (moved.length) keys[channel] = moved;
  }
  return upsertChannelKeys(next, keys);
}

function legacyBakeCameraPath(tracks, path, camera, bakedFrames, removeFrames = []) {
  let next = removeChannelFrames(tracks, [...removeFrames]);
  for (const frame of bakedFrames) {
    const u = (frame.frame - path.startFrame) / Math.max(1, path.endFrame - path.startFrame);
    const tangent = pathTangentAtFraction(path, u) || [0, 0, -1];
    const targetPoint = [
      frame.position[0] + tangent[0],
      frame.position[1] + tangent[1],
      frame.position[2] + tangent[2],
    ];
    const snapshot = {
      frame: frame.frame,
      interpolation: 'linear',
      position: frame.position,
      rotation: cameraRotationToward(frame.position, targetPoint),
      focalLength: camera.focalLength,
    };
    next = upsertChannelKeys(
      next,
      snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation),
    );
  }
  return next;
}

// ---- 样本 ----

const camSnapshot = (frame, position, focalLength = 42) => ({
  frame,
  interpolation: 'linear',
  position,
  rotation: [0.3, 0, 0],
  focalLength,
});

const straightPath = normalizeCameraPath({
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ],
  startFrame: 0,
  endFrame: 240,
  keyframeCount: 3,
  sourceKeyframeFrames: [0, 120, 240],
});

const buildCamTrack = (frames) =>
  frames.reduce(
    (acc, [f, pos, focal]) => legacyUpsertCameraSnapshot(acc, camSnapshot(f, pos, focal)),
    {},
  );

describe('相机轨 · 收口后与旧手写实现逐字等价（回归护栏）', () => {
  it('upsertCameraSnapshot', () => {
    for (const [f, pos, focal] of [
      [0, [0, 0, 0], 42],
      [60, [2.5, 0, 0], 35],
      [24, [3, 4, 5], 50],
    ] as [number, number[], number][]) {
      const snap = camSnapshot(f, pos, focal);
      let a = {};
      let b = {};
      a = upsertCameraSnapshot(a, snap);
      b = legacyUpsertCameraSnapshot(b, snap);
      expect(a).toEqual(b);
    }
  });

  it('removeCameraFrames（单帧与批量）', () => {
    const track = buildCamTrack([
      [0, [0, 0, 0]],
      [24, [3, 4, 5]],
      [60, [2.5, 0, 0]],
    ]);
    expect(removeCameraFrames(track, 24)).toEqual(legacyRemoveCameraFrames(track, 24));
    expect(removeCameraFrames(track, [0, 60])).toEqual(legacyRemoveCameraFrames(track, [0, 60]));
    // 单帧传标量（非数组）也要归一化成数组
    expect(removeCameraFrames(track, 60)).toEqual(legacyRemoveCameraFrames(track, 60));
  });

  it('moveCameraFrame', () => {
    const track = buildCamTrack([
      [0, [0, 0, 0]],
      [60, [2.5, 0, 0]],
    ]);
    expect(moveCameraFrame(track, 0, 30)).toEqual(legacyMoveCameraFrame(track, 0, 30));
  });

  it('setCameraInterpolation', () => {
    const track = buildCamTrack([[0, [0, 0, 0]]]);
    expect(setCameraInterpolation(track, 0, 'hold')).toEqual(
      legacySetCameraInterpolation(track, 0, 'hold'),
    );
  });

  it('moveCameraFrames（含「目标帧被另一待移动帧占据」的丢帧场景）', () => {
    const track = buildCamTrack([
      [5, [1, 0, 0]],
      [9, [2, 0, 0]],
    ]);
    expect(moveCameraFrames(track, { 5: 9, 9: 13 })).toEqual(
      legacyMoveCameraFrames(track, { 5: 9, 9: 13 }),
    );
  });

  it('bakeCameraPath（含旧帧删除 + 多帧烘焙）', () => {
    const track = buildCamTrack([
      [0, [0, 0, 0], 42],
      [60, [2.5, 0, 0], 42],
      [24, [3, 4, 5], 50],
    ]);
    const camera = { focalLength: 42 };
    const baked = [
      { frame: 0, position: [0, 0, 0] },
      { frame: 120, position: [5, 0, 0] },
      { frame: 240, position: [10, 0, 0] },
    ];
    expect(bakeCameraPath(track, straightPath, camera, baked, [0, 60])).toEqual(
      legacyBakeCameraPath(track, straightPath, camera, baked, [0, 60]),
    );
  });

  it('bakeCameraPath：空 removeFrames（首次烘焙）', () => {
    const camera = { focalLength: 42 };
    const baked = [{ frame: 0, position: [0, 0, 0] }];
    expect(bakeCameraPath({}, straightPath, camera, baked, [])).toEqual(
      legacyBakeCameraPath({}, straightPath, camera, baked, []),
    );
  });
});

describe('两条轨道 · 语义对等性（契约 C6 核心）', () => {
  it('批量平移：「目标帧被另一待移动帧占据」时，两条轨道都不丢帧', () => {
    // 场景：连续两帧 10、15 同量平移到 15、20。
    // 若某条轨道忘了「先删全部旧帧」，逐帧 move 会让 10→15 覆盖原 15、随后 15→20 把 15 移走，
    // 最终只剩 20（丢帧）。两条轨道都必须保住 [15, 20]。
    const map = { 10: 15, 15: 20 };

    // 相机轨
    const camTrack = buildCamTrack([
      [10, [1, 0, 0]],
      [15, [2, 0, 0]],
    ]);
    const camFrames = moveCameraFrames(camTrack, map)
      .transform.map((k) => k.frame)
      .sort((a, b) => a - b);

    // 对象轨（同帧结构）
    const objTrack = {
      obj: {
        transform: [
          { frame: 10, interpolation: 'linear', fields: { position: [1, 0, 0] } },
          { frame: 15, interpolation: 'linear', fields: { position: [2, 0, 0] } },
        ],
      },
    };
    const objFrames = moveObjectFrames(objTrack, 'obj', map)
      .obj.transform.map((k) => k.frame)
      .sort((a, b) => a - b);

    expect(camFrames).toEqual([15, 20]);
    expect(objFrames).toEqual([15, 20]); // 两条轨道结果同构
  });

  it('路径烘焙：两条轨道都「先删旧帧再整批插新」，旧路径帧不留幽灵', () => {
    const removeFrames = [0, 60];
    const baked = [
      { frame: 0, position: [0, 0, 0] },
      { frame: 120, position: [5, 0, 0] },
    ];

    // 相机轨：旧帧 0/60 应被删，新增 0/120，手动帧 24 保留
    const camTrack = buildCamTrack([
      [0, [9, 9, 9], 42],
      [60, [8, 8, 8], 42],
      [24, [3, 4, 5], 50],
    ]);
    const camNext = bakeCameraPath(
      camTrack,
      straightPath,
      { focalLength: 42 },
      baked,
      removeFrames,
    );
    const camFrames = camNext.transform.map((k) => k.frame).sort((a, b) => a - b);
    expect(camFrames).toEqual([0, 24, 120]); // 60 已删，不留幽灵

    // 对象轨：同样语义
    const objNext = bakeObjectPath(
      {
        obj: {
          transform: [{ frame: 60, interpolation: 'linear', fields: { position: [8, 8, 8] } }],
        },
      },
      'obj',
      'object',
      baked,
      removeFrames,
    ) as { obj: { transform: Array<{ frame: number }> } };
    expect(objNext.obj.transform.map((k) => k.frame)).toEqual([0, 120]); // 旧 60 已删
  });

  it('applyTrackOperation 是两条轨道共用的唯一执行器', () => {
    // 直接验证底层：同一 operation 作用于裸通道结构，结果确定且幂等
    const channels = {
      transform: [{ frame: 0, interpolation: 'linear', fields: { position: [0, 0, 0] } }],
    };
    const op = { op: 'move', from: 0, to: 10 } as const;
    const once = applyTrackOperation(channels, op);
    expect(once.transform[0].frame).toBe(10);
    // 无变化的操作应返回等价结构（move 同帧直接返回原对象）
    expect(applyTrackOperation(channels, { op: 'move', from: 5, to: 5 })).toBe(channels);
    // clear 清空所有通道
    expect(applyTrackOperation(channels, { op: 'clear' })).toEqual({});
    expect(countChannelKeyframes(applyTrackOperation(channels, { op: 'clear' }))).toBe(0);
  });

  it('batch 是原子的：多步按顺序执行（先删后插）', () => {
    const channels = {
      transform: [
        { frame: 0, interpolation: 'linear', fields: { position: [0, 0, 0] } },
        { frame: 60, interpolation: 'linear', fields: { position: [6, 6, 6] } },
      ],
    };
    const result = applyTrackOperation(channels, {
      op: 'batch',
      steps: [
        { op: 'remove', frames: [0, 60] },
        {
          op: 'upsert',
          keys: {
            transform: [{ frame: 30, interpolation: 'linear', fields: { position: [3, 3, 3] } }],
          },
        },
      ],
    });
    expect(result.transform.map((k) => k.frame)).toEqual([30]);
  });
});
