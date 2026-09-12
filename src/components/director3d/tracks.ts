// 3D 导演台·轨道写操作领域（M4.1 解耦收口）
// 职责：所有关键帧轨道的写变更（对象轨 + 相机轨）统一收口在此模块；
//       全部为纯函数 updater `(tracks, ...) => newTracks`，App.tsx 只做 setState 接线，
//       不再直接拼装底层写原语，避免 UI 层与通道数据结构耦合。
// 约定（契约 C6）：
//   - 唯一 op 语义：所有写操作（增/删/移/改插值/清空/批处理）都表达为
//     project.ts 的 operation 对象，经 **applyTrackOperation** 执行。
//   - 对象轨：经 writeObjectTrack(tracks, id, op)——带「写空自动移除条目」语义。
//   - 相机轨：经 applyTrackOperation(channels, op)——相机轨是裸通道结构，无条目字典。
//   - 禁止在本模块手写「先 remove 再 upsert」拼装——那是重造 batch 语义，
//     两条轨道会各自实现一份，语义漂移后只在一条轨道上复现（历史坑）。
//   - 路径烘焙只产出 position 来源标识（M3-C2/C5），路径帧绝不写姿态/动作/骨骼；
//     「先删旧路径帧、再整批插新帧」= 一个原子 batch（M4-C5），保证撤销/重做整体回退。
// 依赖均为纯函数，node 环境可跑（tests/unit/tracks.test.ts）。
import {
  applyTrackOperation,
  cameraRotationToward,
  countChannelKeyframes,
  pathTangentAtFraction,
  snapshotToChannelKeys,
  writeObjectTrack,
  type ChannelTracks,
  type ChannelKey,
  type EntityType,
  type CameraPath,
} from './project.ts';

// ---- 对象轨 ----

// 路径烘焙批处理（M3 路径帧语义）：bakedFrames 为 bakePathKeyframes 产出的帧列表（含 position），
// 先删旧路径帧 removeFrames 再整批 upsert 新路径帧 = 单次原子 batch（M4-C5）。
// 路径帧只落 transform.position（M3-C2/C5），不触碰 action/skeleton 通道。
export function bakeObjectPath(
  tracks: Record<string, ChannelTracks>,
  target: string,
  sourceType: EntityType,
  bakedFrames: Array<{ frame: number; position: number[] }>,
  removeFrames: number[] = [],
) {
  const pathKeys: ChannelTracks = {};
  for (const frame of bakedFrames) {
    const snapshot: ChannelKey = {
      frame: frame.frame,
      interpolation: 'linear',
      position: frame.position,
    };
    const keys = snapshotToChannelKeys(
      sourceType,
      snapshot,
      snapshot.frame,
      snapshot.interpolation,
    );
    for (const [channel, list] of Object.entries(keys)) {
      pathKeys[channel] = [...(pathKeys[channel] || []), ...list];
    }
  }
  return writeObjectTrack(tracks, target, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: [...removeFrames] },
      { op: 'upsert', keys: pathKeys },
    ],
  });
}

// 增/改一帧：整快照 snapshot 按实体类型拆进对应通道后写入（手动 K、单属性 K、粘贴共用）。
export const upsertObjectSnapshot = (
  tracks: Record<string, ChannelTracks>,
  target: string,
  entityType: EntityType,
  snapshot: ChannelKey,
) =>
  writeObjectTrack(tracks, target, {
    op: 'upsert',
    keys: snapshotToChannelKeys(entityType, snapshot, snapshot.frame, snapshot.interpolation),
  });

// 删除一帧或一批帧；轨道写空后自动移除该对象条目（writeObjectTrack 内部语义）。
export const removeObjectFrames = (
  tracks: Record<string, ChannelTracks>,
  target: string,
  frames: number | number[],
) =>
  writeObjectTrack(tracks, target, {
    op: 'remove',
    frames: Array.isArray(frames) ? frames : [frames],
  });

// 整帧平移（各通道同帧一致）。
export const moveObjectFrame = (
  tracks: Record<string, ChannelTracks>,
  target: string,
  fromFrame: number,
  toFrame: number,
) => writeObjectTrack(tracks, target, { op: 'move', from: fromFrame, to: toFrame });

// 改某帧插值（各通道同插值，M1 全通道同插值约定）。
export const setObjectInterpolation = (
  tracks: Record<string, ChannelTracks>,
  target: string,
  frame: number,
  value: string,
) => writeObjectTrack(tracks, target, { op: 'interpolation', frame, value });

// 清空整条轨道（删除对象时随对象移除）。
export const clearObjectTrack = (tracks: Record<string, ChannelTracks>, target: string) =>
  writeObjectTrack(tracks, target, { op: 'clear' });

// 复制轨道到新对象（duplicateSelected 用）：逐通道复制；
// 仅 transform 通道的 position 按 offset 偏移（副本与原件错开站位），动作/骨骼原样复制。
export function duplicateObjectTrack(
  tracks: Record<string, ChannelTracks>,
  target: string,
  newId: string,
  offset: number = 0,
): Record<string, ChannelTracks> {
  const sourceTrack = tracks[target];
  if (!countChannelKeyframes(sourceTrack)) return tracks;
  const duplicateTrack: ChannelTracks = {};
  for (const [channel, keys] of Object.entries(sourceTrack)) {
    duplicateTrack[channel] = (Array.isArray(keys) ? keys : []).map((key: ChannelKey) =>
      channel === 'transform'
        ? {
            ...key,
            fields: {
              ...key.fields,
              position: offset
                ? [
                    (key.fields.position as number[])[0] + offset,
                    (key.fields.position as number[])[1],
                    (key.fields.position as number[])[2] + offset,
                  ]
                : (key.fields.position as number[]),
            },
          }
        : key,
    );
  }
  return { ...tracks, [newId]: duplicateTrack };
}

// 批量平移若干帧（时间轴框选/多选拖动用）：frameMap = { 旧帧号: 新帧号 }。
// 先删全部旧帧、再整批插入新帧（内容不变、仅 frame 平移）为单个原子 batch，
// 避免逐帧 move 在「目标帧被另一待移动帧占据」时顺序执行丢帧（M4-C5 原子语义）。
export function moveObjectFrames(
  tracks: Record<string, ChannelTracks>,
  target: string,
  frameMap: Record<string, number>,
): Record<string, ChannelTracks> {
  const entries = Object.entries(frameMap);
  if (!entries.length) return tracks;
  const fromFrames = entries.map(([from]) => Number(from));
  const keys: ChannelTracks = {};
  const track = tracks[target] || {};
  for (const [channel, list] of Object.entries(track)) {
    const moved = (Array.isArray(list) ? list : [])
      .filter((key: ChannelKey) => frameMap[key.frame] !== undefined)
      .map((key: ChannelKey) => ({ ...key, frame: frameMap[key.frame] }));
    if (moved.length) keys[channel] = moved;
  }
  return writeObjectTrack(tracks, target, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: fromFrames },
      { op: 'upsert', keys },
    ],
  });
}

// 相机轨批量平移（先删旧帧再整批插新帧的原子 batch，transform/lens 同时处理）。
// 与对象轨 moveObjectFrames 走**同一个** applyTrackOperation batch 语义。
export function moveCameraFrames(
  channels: ChannelTracks,
  frameMap: Record<string, number>,
): ChannelTracks {
  const entries = Object.entries(frameMap);
  if (!entries.length) return channels;
  const fromFrames = entries.map(([from]) => Number(from));
  const toFrames = new Map(entries.map(([from, to]) => [Number(from), Number(to)]));
  const keys: ChannelTracks = {};
  for (const [channel, list] of Object.entries(channels)) {
    const moved = (Array.isArray(list) ? list : [])
      .filter((key: ChannelKey) => toFrames.has(key.frame))
      .map((key: ChannelKey) => ({ ...key, frame: toFrames.get(key.frame) }));
    if (moved.length) keys[channel] = moved;
  }
  return applyTrackOperation(channels, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: fromFrames },
      { op: 'upsert', keys },
    ],
  });
}

// ---- 相机轨 ----

// 相机路径烘焙：先删旧路径帧、再按曲线逐帧写 transform.position/rotation + lens.focalLength。
// 相机沿曲线匀速（linear 插值），视线朝切线方向，无需用户手动改插值。
// 「先删旧帧再整批插新帧」= 单个原子 batch，与对象轨 bakeObjectPath 同构（M4-C5）。
export function bakeCameraPath(
  tracks: ChannelTracks,
  path: CameraPath,
  camera: { focalLength: number },
  bakedFrames: Array<{ frame: number; position: number[] }>,
  removeFrames: number[] = [],
): ChannelTracks {
  // 先把所有路径帧摊成通道 key 映射（同帧多字段合并），再一次性 upsert —— 单次原子 batch。
  const pathKeys: ChannelTracks = {};
  for (const frame of bakedFrames) {
    const u = (frame.frame - path.startFrame) / Math.max(1, path.endFrame - path.startFrame);
    const tangent = pathTangentAtFraction(path, u) || [0, 0, -1];
    const targetPoint = [
      frame.position[0] + tangent[0],
      frame.position[1] + tangent[1],
      frame.position[2] + tangent[2],
    ];
    const snapshot: ChannelKey = {
      frame: frame.frame,
      interpolation: 'linear',
      position: frame.position,
      rotation: cameraRotationToward(frame.position, targetPoint),
      focalLength: camera.focalLength,
    };
    const keys = snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation);
    for (const [channel, list] of Object.entries(keys)) {
      pathKeys[channel] = [...(pathKeys[channel] || []), ...list];
    }
  }
  return applyTrackOperation(tracks, {
    op: 'batch',
    steps: [
      { op: 'remove', frames: [...removeFrames] },
      { op: 'upsert', keys: pathKeys },
    ],
  });
}

// 增/改一帧（整快照拆进 transform/lens）。
export const upsertCameraSnapshot = (tracks: ChannelTracks, snapshot: ChannelKey) =>
  applyTrackOperation(tracks, {
    op: 'upsert',
    keys: snapshotToChannelKeys('camera', snapshot, snapshot.frame, snapshot.interpolation),
  });

// 删除一帧或一批帧（transform/lens 同时删，避免漏删幽灵 key）。
export const removeCameraFrames = (tracks: ChannelTracks, frames: number | number[]) =>
  applyTrackOperation(tracks, {
    op: 'remove',
    frames: Array.isArray(frames) ? frames : [frames],
  });

// 整帧平移。
export const moveCameraFrame = (tracks: ChannelTracks, fromFrame: number, toFrame: number) =>
  applyTrackOperation(tracks, { op: 'move', from: fromFrame, to: toFrame });

// 改某帧插值。
export const setCameraInterpolation = (tracks: ChannelTracks, frame: number, value: string) =>
  applyTrackOperation(tracks, { op: 'interpolation', frame, value });
