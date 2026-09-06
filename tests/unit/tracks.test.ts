// 3D 导演台·轨道写操作领域（tracks.js）纯逻辑测试
// 覆盖从 App.jsx 解耦抽出的复合操作（原内联逻辑迁移后行为不变）：
//   - bakeObjectPath：路径烘焙批处理（先删旧路径帧再整批插新 = 原子 batch），路径帧只留 position，
//     手动帧与动作/骨骼通道不被触碰
//   - bakeCameraPath：相机路径烘焙（先删旧帧再按曲线写 transform/lens）
//   - duplicateObjectTrack：复制轨道（仅 transform.position 偏移，动作/骨骼原样；空轨不建副本）
//   - clearObjectTrack：删除对象时随对象清空整条轨道
//   - 薄封装冒烟：upsert/remove/move/interpolation（对象轨 + 相机轨）
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest';
import {
  bakeObjectPath,
  bakeCameraPath,
  clearObjectTrack,
  duplicateObjectTrack,
  moveCameraFrame,
  moveCameraFrames,
  moveObjectFrame,
  moveObjectFrames,
  removeCameraFrames,
  removeObjectFrames,
  setCameraInterpolation,
  setObjectInterpolation,
  upsertCameraSnapshot,
  upsertObjectSnapshot,
} from '../../src/components/director3d/tracks.ts';
import { normalizeCameraPath } from '../../src/components/director3d/project.ts';

// ---- 样本（与 channelWrite.test.js 一致，保证可比） ----
const runJoints = { mixamorigHips: [0.2, 0.18, 0.25], mixamorigRightUpLeg: [0.45, 0.05, 0.1] };

const manualSnapshot = (frame, position, pose = 'run') => ({
  frame,
  interpolation: 'smooth',
  position,
  rotation: [0, 0.5, 0],
  scale: [1.2, 1, 1],
  pose,
  poseTime: 0.6,
  continuousMotion: true,
  rigRoot: [0, 0, 0],
  joints: runJoints,
});

const straightPath = normalizeCameraPath({
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ],
  startFrame: 0,
  endFrame: 240,
  keyframeCount: 5,
  sourceKeyframeFrames: [0, 60, 120, 180, 240],
});

const camSnapshot = (frame, position, focalLength = 42) => ({
  frame,
  interpolation: 'linear',
  position,
  rotation: [0.3, 0, 0],
  focalLength,
});

// ---- bakeObjectPath：路径烘焙批处理 ----

describe('bakeObjectPath 对象路径烘焙', () => {
  const seedTracks = () => {
    let tracks = {};
    tracks = upsertObjectSnapshot(
      tracks,
      'actor-lead',
      'person',
      manualSnapshot(24, [100, 0, 100]),
    );
    tracks = upsertObjectSnapshot(tracks, 'actor-lead', 'person', {
      frame: 0,
      interpolation: 'linear',
      position: [0, 0, 0],
    });
    tracks = upsertObjectSnapshot(tracks, 'actor-lead', 'person', {
      frame: 60,
      interpolation: 'linear',
      position: [2.5, 0, 0],
    });
    return tracks;
  };

  it('先删旧路径帧再整批插新（原子 batch），手动帧保留、路径帧只落 transform.position', () => {
    const tracks = seedTracks();
    const next = bakeObjectPath(
      tracks,
      'actor-lead',
      'person',
      [
        { frame: 0, position: [0, 0, 0] },
        { frame: 120, position: [5, 0, 0] },
        { frame: 240, position: [10, 0, 0] },
      ],
      [0, 60],
    );

    const transform = next['actor-lead'].transform.map((key) => key.frame).sort((a, b) => a - b);
    expect(transform).toEqual([0, 24, 120, 240]); // 旧路径帧 0/60 被删，新增 120/240，手动帧 24 保留
    // 路径帧只留 position 来源标识（M3-C2/C5），绝无姿态/动作/骨骼残留
    for (const frame of [0, 120, 240]) {
      const key = next['actor-lead'].transform.find((k) => k.frame === frame);
      expect(Object.keys(key.fields)).toEqual(['position']);
    }
    // 手动帧完整拆进 transform/action/skeleton，动作/骨骼通道不被路径帧触碰
    expect(next['actor-lead'].action).toHaveLength(1);
    expect(next['actor-lead'].action[0].fields.pose).toBe('run');
    expect(next['actor-lead'].skeleton[0].fields.joints).toEqual(runJoints); // 写入口保留快照 joints 原值
  });

  it('空 removeFrames 时仅插新帧（首次烘焙无旧路径帧）', () => {
    const tracks = {};
    const next = bakeObjectPath(
      tracks,
      'actor-lead',
      'person',
      [{ frame: 0, position: [0, 0, 0] }],
      [],
    );
    expect(next['actor-lead'].transform).toHaveLength(1);
  });
});

// ---- bakeCameraPath：相机路径烘焙 ----

describe('bakeCameraPath 相机路径烘焙', () => {
  it('先删旧路径帧、再按曲线逐帧写 transform.position/rotation + lens.focalLength', () => {
    let tracks = {};
    tracks = upsertCameraSnapshot(tracks, camSnapshot(0, [0, 0, 0], 42));
    tracks = upsertCameraSnapshot(tracks, camSnapshot(60, [2.5, 0, 0], 42));
    tracks = upsertCameraSnapshot(tracks, camSnapshot(24, [3, 4, 5], 50)); // 手动帧

    const camera = { focalLength: 42 };
    const next = bakeCameraPath(
      tracks,
      straightPath,
      camera,
      [
        { frame: 0, position: [0, 0, 0] },
        { frame: 120, position: [5, 0, 0] },
      ],
      [0, 60],
    );

    const transformFrames = next.transform.map((key) => key.frame).sort((a, b) => a - b);
    expect(transformFrames).toEqual([0, 24, 120]); // 旧路径帧 0/60 被删，新增 0/120，手动帧 24 保留
    const baked = next.transform.find((k) => k.frame === 120);
    expect(baked.fields.position).toEqual([5, 0, 0]);
    expect(Array.isArray(baked.fields.rotation)).toBe(true); // 视线朝切线方向
    expect(next.lens.find((k) => k.frame === 120).fields.focalLength).toBe(42);
  });
});

// ---- 批量平移（moveObjectFrames / moveCameraFrames） ----

describe('批量平移（先删旧帧再整批插新，防丢帧）', () => {
  it('对象轨相邻帧同量平移不丢帧（目标被另一移动帧占据时也完整）', () => {
    let tracks = {};
    tracks = upsertObjectSnapshot(tracks, 'actor-lead', 'person', manualSnapshot(10, [1, 0, 0]));
    tracks = upsertObjectSnapshot(tracks, 'actor-lead', 'person', manualSnapshot(15, [2, 0, 0]));
    const next = moveObjectFrames(tracks, 'actor-lead', { 10: 15, 15: 20 });
    const frames = next['actor-lead'].transform.map((key) => key.frame).sort((a, b) => a - b);
    expect(frames).toEqual([15, 20]); // 10→15（覆盖原 15）、15→20 都保留，不丢帧
    expect(next['actor-lead'].action).toHaveLength(2);
  });

  it('相机轨批量平移：transform/lens 同帧一致', () => {
    let tracks = upsertCameraSnapshot({}, camSnapshot(5, [1, 0, 0], 42));
    tracks = upsertCameraSnapshot(tracks, camSnapshot(9, [2, 0, 0], 35));
    const next = moveCameraFrames(tracks, { 5: 9, 9: 13 });
    expect(next.transform.map((key) => key.frame).sort((a, b) => a - b)).toEqual([9, 13]);
    expect(next.lens.map((key) => key.frame).sort((a, b) => a - b)).toEqual([9, 13]);
  });

  it('空 frameMap 返回原轨不变', () => {
    const tracks = {};
    expect(moveObjectFrames(tracks, 'actor-lead', {})).toBe(tracks);
    expect(moveCameraFrames({}, {})).toEqual({});
  });
});

// ---- duplicateObjectTrack / clearObjectTrack ----

describe('duplicateObjectTrack / clearObjectTrack', () => {
  const sampleTracks = () => {
    let tracks = {};
    tracks = upsertObjectSnapshot(
      tracks,
      'actor-lead',
      'person',
      manualSnapshot(0, [0, 0, 0], 'walk'),
    );
    tracks = upsertObjectSnapshot(tracks, 'actor-lead', 'person', manualSnapshot(24, [1, 0, 0]));
    return tracks;
  };

  it('复制轨道：仅 transform.position 偏移，动作/骨骼原样，原轨不变', () => {
    const tracks = sampleTracks();
    const next = duplicateObjectTrack(tracks, 'actor-lead', 'actor-copy', 0.6);
    expect(next['actor-copy'].transform[0].fields.position).toEqual([0.6, 0, 0.6]);
    expect(next['actor-copy'].transform[1].fields.position).toEqual([1.6, 0, 0.6]);
    expect(next['actor-copy'].action).toEqual(tracks['actor-lead'].action);
    expect(next['actor-copy'].skeleton).toEqual(tracks['actor-lead'].skeleton);
    expect(next['actor-lead']).toEqual(tracks['actor-lead']); // 原轨不被改动
  });

  it('源轨为空时不建副本', () => {
    const next = duplicateObjectTrack({}, 'actor-lead', 'actor-copy', 0.6);
    expect(next['actor-copy']).toBeUndefined();
  });

  it('clearObjectTrack 清空整条轨道后移除该对象条目', () => {
    const next = clearObjectTrack(sampleTracks(), 'actor-lead');
    expect(next['actor-lead']).toBeUndefined();
  });
});

// ---- 薄封装冒烟：对象轨 + 相机轨增删移改插值 ----

describe('薄封装写操作冒烟', () => {
  it('对象轨：upsert → move → interpolation → remove', () => {
    let tracks = upsertObjectSnapshot({}, 'actor-lead', 'person', manualSnapshot(10, [1, 0, 0]));
    expect(tracks['actor-lead'].transform[0].frame).toBe(10);

    tracks = moveObjectFrame(tracks, 'actor-lead', 10, 20);
    expect(tracks['actor-lead'].transform[0].frame).toBe(20);

    tracks = setObjectInterpolation(tracks, 'actor-lead', 20, 'hold');
    expect(tracks['actor-lead'].transform[0].interpolation).toBe('hold');

    tracks = removeObjectFrames(tracks, 'actor-lead', 20);
    expect(tracks['actor-lead']).toBeUndefined(); // 轨道写空自动移除条目
  });

  it('相机轨：upsert → move → interpolation → remove', () => {
    let tracks = upsertCameraSnapshot({}, camSnapshot(10, [1, 0, 0], 35));
    expect(tracks.transform[0].frame).toBe(10);
    expect(tracks.lens[0].fields.focalLength).toBe(35);

    tracks = moveCameraFrame(tracks, 10, 30);
    expect(tracks.transform[0].frame).toBe(30);
    expect(tracks.lens[0].frame).toBe(30);

    tracks = setCameraInterpolation(tracks, 30, 'linear');
    expect(tracks.transform[0].interpolation).toBe('linear');

    tracks = removeCameraFrames(tracks, [30]);
    expect(tracks.transform).toBeUndefined();
    expect(tracks.lens).toBeUndefined();
  });
});
