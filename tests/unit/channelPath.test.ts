// 对象动画「通道化」M3 路径独立化 纯逻辑测试
// 覆盖：
//   M3-C1 路径存在且启用时 position 唯一由路径提供，位置关键帧被忽略（显式二选一）
//   M3-C2 路径时空绝不写 pose/joints/rigRoot/rotation/scale，只产出 position
//   M3-C3 「有路径」即视为位置来源存在；变换轨为空时 position 也走路径，不回落基线
//   M3-C4 曲线几何/匀速/平滑沿用既有采样函数（与 pathPositionAtFraction 输出一致）
//   M3-C5 Timeline 不把路径设为「生成动作/骨骼关键帧」：路径时空不新增动作/骨骼 key
//   M3-C6 仅路径、无手动 pose 帧时，动作/骨骼通道仍按状态段规则插值，不锁死 source 当前值
// 依赖均为纯函数，node 环境可跑（npm run test:unit:logic）。
import { describe, it, expect } from 'vitest';
import { cloneJointPose } from '../../src/components/director3d/rig.ts';
import {
  objectAtFrame,
  objectsAtFrame,
  pathActive,
  pathPositionAtFrame,
  normalizeCameraPath,
  bakePathKeyframes,
  snapshotToChannelKeys,
  upsertChannelKeys,
  type ChannelTracks,
} from '../../src/components/director3d/project.ts';

const FPS = 24;

// ---- 样本 ----
// 关节键带 `mixamorig` 前缀（cloneJointPose 只拷贝 JOINT_DEFINITIONS 登记的关节，无前缀会被过滤）。
const walkJoints = { mixamorigHips: [0.02, 0.01, 0.03], mixamorigLeftUpLeg: [0.12, 0.02, 0.05] };
const runJoints = { mixamorigHips: [0.2, 0.18, 0.25], mixamorigRightUpLeg: [0.45, 0.05, 0.1] };

const person = {
  id: 'actor-lead',
  type: 'person',
  pose: 'walk',
  poseTime: 0.4,
  continuousMotion: true,
  position: [-1.25, 0, 0.3],
  rotation: [0, 0.25, 0],
  scale: [1, 1, 1],
  rigRoot: [0, 0, 0],
  joints: walkJoints,
};

// 直线路径：从 (0,·,0) 平移到 (10,·,0)，[0, 240] 帧，frame 120（u=0.5）应在 x≈5。
const straightPath = normalizeCameraPath({
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ],
  startFrame: 0,
  endFrame: 240,
  keyframeCount: 5,
});

// 位置关键帧（与路径明显不同：x 从 +100 线性走到 -100），frame 120 处应为 [0,0,0]。
const transformTrack = {
  transform: [
    { frame: 0, interpolation: 'smooth', fields: { position: [100, 0, 100] } },
    { frame: 240, interpolation: 'smooth', fields: { position: [-100, 0, -100] } },
  ],
};

describe('pathActive / pathPositionAtFrame（M3-C3 判定入口）', () => {
  it('≥2 个控制点视为路径启用；空/单点/非数组不启用', () => {
    expect(pathActive(straightPath)).toBe(true);
    expect(pathActive({ ...straightPath, points: [] })).toBe(false);
    expect(pathActive({ ...straightPath, points: [straightPath.points[0]] })).toBe(false);
    expect(pathActive(null)).toBe(false);
    expect(pathActive({})).toBe(false);
  });

  it('frame → 弧长进度取位，与 pathPositionAtFraction 输出一致（M3-C4 不重写）', () => {
    const pos = pathPositionAtFrame(straightPath, 120);
    expect(pos).not.toBeNull();
    expect(pos[0]).toBeCloseTo(5, 1); // u=0.5 直线中点
    expect(pos[1]).toBeCloseTo(0, 3);
    expect(pos[2]).toBeCloseTo(0, 3);
    // 端点钳制：越界仍由路径接管（有路径恒为位置来源存在）
    const head = pathPositionAtFrame(straightPath, -50);
    const tail = pathPositionAtFrame(straightPath, 9999);
    expect(head[0]).toBeCloseTo(0, 2);
    expect(tail[0]).toBeCloseTo(10, 2);
  });

  it('未启用路径返回 null', () => {
    expect(pathPositionAtFrame(null, 0)).toBeNull();
    expect(pathPositionAtFrame({ ...straightPath, points: [] }, 0)).toBeNull();
  });
});

describe('M3-C1 路径启用时 position 唯一由路径提供，位置关键帧被忽略', () => {
  it('路径+位置关键帧均在 → position=路径位，而非关键帧插值', () => {
    const at = objectAtFrame(person, transformTrack, 120, FPS, straightPath);
    // 关键帧在 frame 120 处插值为 [0,0,0]；路径为 [5,0,0] → 显式二选一，路径胜
    expect(at.position[0]).toBeCloseTo(5, 1);
    expect(at.position[0]).not.toBeCloseTo(0, 3);
    // rotation/scale 仍走变换通道关键帧（路径不接管非 position 字段）
    expect(at.rotation).toEqual(person.rotation);
    expect(at.scale).toEqual(person.scale);
  });

  it('路径不启用时 position 回落关键帧/基线', () => {
    const at = objectAtFrame(person, transformTrack, 120, FPS, null);
    expect(at.position[0]).toBeCloseTo(0, 3);
  });
});

describe('M3-C3 仅路径、无关键帧 → position=路径位置，不回落基线', () => {
  it('变换轨为空时 position 也走路径', () => {
    const at = objectAtFrame(person, {}, 120, FPS, straightPath);
    expect(at.position[0]).toBeCloseTo(5, 1);
    // 其它字段保持基线，不被臆造接管
    expect(at.rotation).toEqual(person.rotation);
    expect(at.pose).toBe('walk');
    expect(at.joints).toEqual(person.joints);
  });

  it('objectsAtFrame 传 paths 映射逐对象生效（无路径对象保持原样）', () => {
    const box = {
      id: 'block-stage',
      type: 'box',
      position: [1.4, 0.45, -0.8],
      rotation: [0, -0.18, 0],
      scale: [2.8, 0.9, 2.1],
    };
    const [lead, stage] = objectsAtFrame([person, box], {}, 120, FPS, {
      'actor-lead': straightPath,
    });
    expect(lead.position[0]).toBeCloseTo(5, 1);
    expect(stage.position).toEqual([1.4, 0.45, -0.8]);
  });
});

describe('M3-C2/C5 路径烘焙只产出 position，绝不写姿态快照 / 不新增动作/骨骼 key', () => {
  // 复刻 applyPathBake 对象分支的纯函数链路：bake → 逐帧 position-only snapshot → 拆通道落轨
  const bakeTrackFromPath = (path, entityType = 'person') => {
    const { frames } = bakePathKeyframes(path, FPS);
    let track: ChannelTracks = {};
    for (const frame of frames) {
      const snapshot = { frame: frame.frame, interpolation: 'linear', position: frame.position };
      track = upsertChannelKeys(
        track,
        snapshotToChannelKeys(entityType, snapshot, snapshot.frame, snapshot.interpolation),
      );
    }
    return track;
  };

  it('烘焙产物只有 transform 通道，无 action/skeleton（M3-C5）', () => {
    const track = bakeTrackFromPath(straightPath);
    expect(Object.keys(track)).toEqual(['transform']);
  });

  it('transform 每个 key 的 fields 只有 position，无 pose/joints/rigRoot/rotation/scale（M3-C2）', () => {
    const track = bakeTrackFromPath(straightPath);
    expect(track.transform).toHaveLength(5);
    for (const key of track.transform) {
      expect(Object.keys(key.fields)).toEqual(['position']);
      expect(key.fields.position).toHaveLength(3);
      expect(key.interpolation).toBe('linear');
    }
  });

  it('普通物体（box）烘焙同样只产出 position', () => {
    const track = bakeTrackFromPath(straightPath, 'box');
    expect(Object.keys(track)).toEqual(['transform']);
    expect(Object.keys(track.transform[0].fields)).toEqual(['position']);
  });
});

describe('M3-C6 仅路径、无手动 pose 帧 → 动作/骨骼仍按状态段规则求值，不锁死 source', () => {
  // 只有 action/skeleton 通道（walk 段 → run 段），配一条路径；source 基线 pose 与通道无关也要被通道接管
  const walkJoints2 = { mixamorigHips: [0.06, 0.04, 0.09], mixamorigLeftUpLeg: [0.3, 0.06, 0.12] };
  const actionSkeletonTrack = {
    action: [
      {
        frame: 0,
        interpolation: 'smooth',
        fields: { pose: 'walk', poseTime: 0.2, continuousMotion: true },
      },
      {
        frame: 24,
        interpolation: 'smooth',
        fields: { pose: 'walk', poseTime: 0.6, continuousMotion: true },
      },
      {
        frame: 48,
        interpolation: 'smooth',
        fields: { pose: 'run', poseTime: 0.1, continuousMotion: true },
      },
    ],
    skeleton: [
      { frame: 0, interpolation: 'smooth', fields: { joints: walkJoints } },
      { frame: 24, interpolation: 'smooth', fields: { joints: walkJoints2 } },
      { frame: 48, interpolation: 'smooth', fields: { joints: runJoints } },
    ],
  };

  it('状态段边界后（帧60）：骨骼 hard 切到 run，不随路径锁死 source', () => {
    const at = objectAtFrame(person, actionSkeletonTrack, 60, FPS, straightPath);
    expect(at.pose).toBe('run');
    expect(at.poseTime).toBeCloseTo(0.1, 5);
    expect(at.joints).toEqual(cloneJointPose(runJoints)); // 边界后保持左状态，不做插值
    expect(at.position[0]).toBeCloseTo(2.5, 1); // u=60/240=0.25 → x≈2.5，位置仍由路径提供
  });

  it('同状态段内（帧12，walk→walk）：poseTime/关节正常插值，位置走路径', () => {
    const at = objectAtFrame(person, actionSkeletonTrack, 12, FPS, straightPath);
    expect(at.pose).toBe('walk');
    expect(at.poseTime).toBeCloseTo(0.4, 5); // lerp(0.2, 0.6, 0.5)
    expect(at.joints).not.toEqual(cloneJointPose(walkJoints)); // 段内插值，非锁死
    expect(at.joints).not.toEqual(cloneJointPose(runJoints));
    expect(at.position[0]).toBeCloseTo(0.5, 1); // u=12/240=0.05 → x≈0.5
  });

  it('无路径同帧对比：动作/骨骼结果一致，仅 position 不同（路径不改变动作/骨骼语义）', () => {
    const withPath = objectAtFrame(person, actionSkeletonTrack, 12, FPS, straightPath);
    const withoutPath = objectAtFrame(person, actionSkeletonTrack, 12, FPS, null);
    expect(withPath.pose).toBe(withoutPath.pose);
    expect(withPath.poseTime).toBeCloseTo(withoutPath.poseTime, 5);
    expect(withPath.joints).toEqual(withoutPath.joints);
    expect(withPath.position[0]).not.toBeCloseTo(withoutPath.position[0], 3);
  });
});
