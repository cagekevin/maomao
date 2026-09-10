/**
 * 【共享 helper】对象动画「通道化」迁移验证锚 —— 旧整快照求值参考实现。
 *
 * 背景：M2/M4 把「整快照关键帧」重构成「通道轨」，需要证明「换内构、行为不变」。
 * 做法是把迁移前的现网 `objectAtFrame` 逐字复刻成参考实现，再用「新引擎逐帧输出
 * == 参考实现逐帧输出」作为迁移锚。
 *
 * 为何抽到此处：该函数此前在
 *   - tests/unit/channelEvaluation.test.ts
 *   - tests/unit/channelWrite.test.ts
 * 中被**逐字复制两份（约 74 行）**。两份若发生漂移，迁移锚的语义就不再等价，
 * 且改一处漏一处不会报错。故收敛到本文件（`_` 前缀，不会被 vitest include 误收）。
 *
 * 注意：本文件是**测试专用基准**，刻意与 src 解耦程度最低——它必须复刻历史实现，
 * 不能跟随 src 演进。改它 = 改迁移锚的语义，务必谨慎并同步所有引用方。
 */
import {
  normalizePoseId,
  presetPhase,
  poseCanLoop,
  poseForObject,
  interpolateJointPose,
  cloneJointPose,
} from '../../src/components/director3d/rig.ts';
import { lerp, segmentAmount } from '../../src/components/director3d/project.ts';

/** 旧整快照求值（复刻现网 objectAtFrame，仅作对照基准，M4-C4 / M2-C3）。 */
export function legacyObjectAtFrame(object, keyframes, frame, fps) {
  if (!object) return object;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (!sorted.length) return object;
  const motionEnabled = (key) =>
    poseCanLoop(key.pose || object.pose) &&
    (key.continuousMotion === undefined
      ? Boolean(object.continuousMotion)
      : Boolean(key.continuousMotion));
  const sameState = (leftKey, rightKey) =>
    normalizePoseId(leftKey.pose || object.pose) ===
      normalizePoseId(rightKey.pose || object.pose) &&
    motionEnabled(leftKey) === motionEnabled(rightKey);
  const stateStartFrame = (key) => {
    let index = sorted.indexOf(key);
    while (index > 0 && sameState(sorted[index - 1], sorted[index])) index -= 1;
    return sorted[index]?.frame ?? key.frame;
  };
  const applyKey = (key) => ({
    ...object,
    position: [...key.position],
    rotation: [...key.rotation],
    scale: [...key.scale],
    pose: normalizePoseId(key.pose || object.pose),
    poseTime: Number.isFinite(key.poseTime) ? key.poseTime : presetPhase(key.pose || object.pose),
    continuousMotion: motionEnabled(key),
    motionStartTime: stateStartFrame(key) / fps,
    rigRoot: [...(key.rigRoot || poseForObject({ ...object, pose: key.pose || object.pose }).root)],
    joints: cloneJointPose(
      key.joints || poseForObject({ ...object, pose: key.pose || object.pose }).joints,
    ),
  });
  const exact = sorted.find((key) => key.frame === frame);
  if (exact) return applyKey(exact);
  if (frame <= sorted[0].frame) return applyKey(sorted[0]);
  if (frame >= sorted.at(-1).frame) return applyKey(sorted.at(-1));
  const rightIndex = sorted.findIndex((key) => key.frame >= frame);
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];
  const t = segmentAmount(left, (frame - left.frame) / Math.max(1, right.frame - left.frame));
  const leftRoot =
    left.rigRoot || poseForObject({ ...object, pose: left.pose || object.pose }).root;
  const rightRoot =
    right.rigRoot || poseForObject({ ...object, pose: right.pose || object.pose }).root;
  const leftPoseTime = Number.isFinite(left.poseTime)
    ? left.poseTime
    : presetPhase(left.pose || object.pose);
  const rightPoseTime = Number.isFinite(right.poseTime)
    ? right.poseTime
    : presetPhase(right.pose || object.pose);
  const interpolateState = sameState(left, right);
  return {
    ...object,
    position: left.position.map((value, index) => lerp(value, right.position[index], t)),
    rotation: left.rotation.map((value, index) => lerp(value, right.rotation[index], t)),
    scale: left.scale.map((value, index) => lerp(value, right.scale[index], t)),
    pose: normalizePoseId(left.pose || object.pose),
    poseTime: interpolateState ? lerp(leftPoseTime, rightPoseTime, t) : leftPoseTime,
    continuousMotion: motionEnabled(left),
    motionStartTime: stateStartFrame(left) / fps,
    rigRoot: interpolateState
      ? leftRoot.map((value, index) => lerp(value, rightRoot[index], t))
      : [...leftRoot],
    joints: interpolateState
      ? interpolateJointPose(
          left.joints || poseForObject({ ...object, pose: left.pose || object.pose }).joints,
          right.joints || poseForObject({ ...object, pose: right.pose || object.pose }).joints,
          t,
        )
      : cloneJointPose(
          left.joints || poseForObject({ ...object, pose: left.pose || object.pose }).joints,
        ),
  };
}
