// 3D 导演台 · 摄像机单入口求值护栏（docs/115 §P2-1）
//
// 【这份测试是干什么的】
// 摄像机求值原先在 App.tsx 里有**两处独立的三分支实现**：
//   · animatedCamera（渲染用：路径 → 关键帧 → 基线）
//   · setCameraAtFrame（播放/拖帧时写回 camera state 用）
// 二者回答同一个问题（这一帧摄像机位置/朝向是什么），是「位置谁说了算」没有唯一答案点的典型。
// 本次收敛为 project.ts 的单一函数 `cameraAtFrameWithPath`。
//
// 【为什么必须有它】求值路径改动**只能靠逐帧比对证明等价**——
// 任何肉眼审查都覆盖不到「合并顺序」「基线来源」「路径未启用时的回退」这些细节。
// 本测试把「收口前的三分支语义」逐字固化为基准断言，改后被它兜住。
//
// 【覆盖的分支】
//   1. 路径启用      → 位置来自曲线（弧长匀速），rotation 沿切线（非 object 模式）
//   2. 路径启用 + targetMode='object' → 不给 rotation（交由 L2/外部目标约束接管）
//   3. 有关键帧无路径 → 走 cameraAtFrame（initialCamera 打底）
//   4. 无路径无关键帧 → 原样返回基线 camera
//   5. 关键帧与路径同时存在 → **路径优先**（来源优先级）
import { describe, it, expect } from 'vitest';
import {
  cameraAtFrame,
  cameraAtFrameWithPath,
  countChannelKeyframes,
  initialCamera,
  normalizeCameraPath,
  pathPositionAtFraction,
  pathTangentAtFraction,
  cameraRotationToward,
  clamp,
  normalizeCameraKeyframes,
  snapshotToChannelKeys,
  upsertChannelKeys,
} from '../../src/components/director3d/project.ts';

// ---- 样本构造 ----

/** 基线摄像机：非 initialCamera，用来验证「路径分支用当前基线打底」而非 initialCamera */
const baseCamera = {
  ...initialCamera,
  position: [3, 2, 5],
  rotation: [0.1, -0.4, 0.02],
  focalLength: 85,
  aspectRatio: '9:16',
};

/** 一条从原点向 +X 延伸的直线路径 */
const buildPath = (startFrame = 0, endFrame = 100) =>
  normalizeCameraPath({
    points: [
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 1, z: 0 },
    ],
    startFrame,
    endFrame,
    keyframeCount: 2,
  });

/** 相机关键帧轨（通道结构）：3 帧，位置沿 X 递增 */
const buildCameraTrack = () => {
  const snapshots = [
    {
      frame: 0,
      interpolation: 'linear',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      focalLength: 24,
    },
    {
      frame: 50,
      interpolation: 'linear',
      position: [5, 0, 0],
      rotation: [0, 1, 0],
      focalLength: 50,
    },
    {
      frame: 100,
      interpolation: 'linear',
      position: [10, 0, 0],
      rotation: [0, 2, 0],
      focalLength: 120,
    },
  ];
  return snapshots.reduce(
    (merged, snap) =>
      upsertChannelKeys(
        merged,
        snapshotToChannelKeys('camera', snap, snap.frame, snap.interpolation),
      ),
    {},
  );
};

// ---- 基准：收口前的三分支语义（逐字复刻）----

/**
 * 「收口前」的摄像机求值——从 App.tsx 的两个实现点还原。
 * 保留它作为**对照组**：新单入口的输出必须与它逐帧完全一致。
 */
function legacyCameraAtFrame(camera, keyframes, path, frame, totalFrames) {
  // 分支1：路径
  if (path && Array.isArray(path.points) && path.points.length >= 2) {
    const start = Math.max(0, Math.round(Number(path.startFrame) || 0));
    const end = Math.max(start + 1, Math.round(Number(path.endFrame) || totalFrames));
    const u = clamp((frame - start) / Math.max(1, end - start), 0, 1);
    const pos = pathPositionAtFraction(path, u);
    if (pos) {
      const tangent = pathTangentAtFraction(path, u) || [0, 0, -1];
      const position = [pos.x, pos.y, pos.z];
      const snapshot: { position: number[]; rotation?: number[] } = { position };
      if (camera.targetMode !== 'object') {
        snapshot.rotation = cameraRotationToward(position, [
          pos.x + tangent[0],
          pos.y + tangent[1],
          pos.z + tangent[2],
        ]);
      }
      return { ...camera, ...snapshot };
    }
  }
  // 分支2：关键帧
  if (countChannelKeyframes(keyframes)) {
    return cameraAtFrame(keyframes, frame, camera.aspectRatio);
  }
  // 分支3：基线
  return camera;
}

describe('cameraAtFrameWithPath · 摄像机单入口求值护栏', () => {
  const TOTAL = 100;

  describe('分支1 · 路径启用', () => {
    it('位置来自曲线（弧长匀速），且在起止帧上钳制', () => {
      const path = buildPath(0, 100);
      const at = (f) => cameraAtFrameWithPath(baseCamera, null, path, f, TOTAL);

      // 起点：控制点 (0,1,0)；终点：(10,1,0)
      const start = at(0);
      expect(start.position[0]).toBeCloseTo(0, 6);
      expect(start.position[1]).toBeCloseTo(1, 6);
      const end = at(100);
      expect(end.position[0]).toBeCloseTo(10, 6);

      // 帧越界按端点钳制（与旧行为一致）
      expect(at(-50).position[0]).toBeCloseTo(0, 6);
      expect(at(999).position[0]).toBeCloseTo(10, 6);
    });

    it('非 object 模式：rotation 沿切线朝前（+X 方向 → yaw 约 -PI/2）', () => {
      const path = buildPath(0, 100);
      const result = cameraAtFrameWithPath(
        { ...baseCamera, targetMode: 'manual' },
        null,
        path,
        50,
        TOTAL,
      );
      // 沿 +X 前进：cameraRotationToward 给出 atan2(-dx, -dz) = atan2(-1, 0) = -PI/2
      expect(result.rotation[1]).toBeCloseTo(-Math.PI / 2, 4);
    });

    it('object 模式：不给 rotation（保持基线 rotation，交由目标约束接管）', () => {
      const path = buildPath(0, 100);
      const result = cameraAtFrameWithPath(
        { ...baseCamera, targetMode: 'object', targetId: 'actor-1' },
        null,
        path,
        50,
        TOTAL,
      );
      expect(result.rotation).toEqual(baseCamera.rotation);
    });

    it('用**当前基线**打底：非位置/旋转字段（如 focalLength）保持当前值', () => {
      const path = buildPath(0, 100);
      const result = cameraAtFrameWithPath(baseCamera, null, path, 50, TOTAL);
      // 路径只覆盖 position/rotation，focalLength 应仍是基线的 85（不是 initialCamera 的 42）
      expect(result.focalLength).toBe(85);
      expect(result.aspectRatio).toBe('9:16');
    });

    it('控制点不足 2 个 → 不视为启用路径，回退到关键帧/基线', () => {
      const degenerate = normalizeCameraPath({ points: [{ x: 0, y: 0, z: 0 }] });
      const result = cameraAtFrameWithPath(baseCamera, null, degenerate, 50, TOTAL);
      expect(result).toBe(baseCamera);
    });
  });

  describe('分支2 · 有关键帧、无路径', () => {
    it('走 cameraAtFrame，且以 initialCamera 打底（非当前基线）', () => {
      const track = buildCameraTrack();
      const result = cameraAtFrameWithPath(baseCamera, track, null, 0, TOTAL);
      // 帧 0 命中关键帧：position/rotation/focalLength 均来自关键帧
      expect(result.position).toEqual([0, 0, 0]);
      expect(result.focalLength).toBe(24);
      // aspectRatio 来自当前 camera（cameraAtFrame 第二参传入）
      expect(result.aspectRatio).toBe('9:16');
    });

    it('段内插值：帧 25 的位置应为 0→5 的中点附近', () => {
      const track = buildCameraTrack();
      const result = cameraAtFrameWithPath(baseCamera, track, null, 25, TOTAL);
      const viaLegacy = cameraAtFrame(track, 25, baseCamera.aspectRatio);
      expect(result.position[0]).toBeCloseTo(viaLegacy.position[0], 10);
      expect(result.position[0]).toBeGreaterThan(0);
      expect(result.position[0]).toBeLessThan(5);
    });
  });

  describe('分支3 · 无路径、无关键帧', () => {
    it('原样返回基线 camera（引用相等，保证 memo 不误触发）', () => {
      expect(cameraAtFrameWithPath(baseCamera, null, null, 50, TOTAL)).toBe(baseCamera);
      expect(cameraAtFrameWithPath(baseCamera, {}, undefined, 50, TOTAL)).toBe(baseCamera);
      // 空轨道结构（各通道为空数组）也算「无关键帧」
      expect(cameraAtFrameWithPath(baseCamera, { transform: [], lens: [] }, null, 50, TOTAL)).toBe(
        baseCamera,
      );
    });
  });

  describe('来源优先级 · 路径与关键帧同时存在', () => {
    it('路径优先（与道具侧 pathActive 二选一语义一致）', () => {
      const path = buildPath(0, 100);
      const track = buildCameraTrack();
      const result = cameraAtFrameWithPath(baseCamera, track, path, 0, TOTAL);
      // 关键帧帧 0 是 [0,0,0]，路径帧 0 是 [0,1,0]（y=1）→ 取路径
      expect(result.position[1]).toBeCloseTo(1, 6);
      // focalLength 保持基线（路径只覆盖位置/旋转）
      expect(result.focalLength).toBe(85);
    });
  });

  describe('逐帧等价性 · 与收口前的三分支逐字比对', () => {
    const scenarios = [
      { name: '仅路径', path: buildPath(0, 100), track: null },
      { name: '仅关键帧', path: null, track: buildCameraTrack() },
      { name: '路径+关键帧', path: buildPath(0, 100), track: buildCameraTrack() },
      { name: '都无', path: null, track: null },
      {
        name: '路径(非零起点)',
        path: buildPath(20, 70),
        track: null,
      },
    ];

    for (const scenario of scenarios) {
      for (const targetMode of ['manual', 'object'] as const) {
        it(`${scenario.name} · targetMode=${targetMode} · 全帧 0..100 完全一致`, () => {
          const camera = {
            ...baseCamera,
            targetMode,
            targetId: targetMode === 'object' ? 'x' : '',
          };
          for (let frame = -5; frame <= 105; frame += 1) {
            const next = cameraAtFrameWithPath(camera, scenario.track, scenario.path, frame, TOTAL);
            const legacy = legacyCameraAtFrame(camera, scenario.track, scenario.path, frame, TOTAL);
            // 逐字段比对（避免浮点误差误报，用 toEqual 对纯数据足够；引用相同则直接通过）
            expect(next, `frame=${frame}`).toEqual(legacy);
          }
        });
      }
    }
  });
});
