import { useMemo, useState } from "react";
import {
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
  InspectorSection,
} from "./InspectorControls";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { getCrowdAnchorTransform, useDirectorStore } from "../store/directorStore";
import { TransformKeyframeRows, buildVecAxisRows, hasFieldAtPlayhead, replaceAxis, type TransformRowDef } from "./TransformKeyframeRows";
import { buildAxisKeyframeFields } from "../runtime/timelineInterpolation";

/**
 * 角色面板（自包含）：
 * 名称/颜色 + 统一打帧行（位置/旋转/缩放 XYZ + 统一缩放）+ 动画开关 + 姿势。
 * 变换输入与打帧合一行（单一真相）。
 */

export function CharacterPanel() {
  const [activeTab, setActiveTab] = useState<"properties" | "pose">("properties");
  const selectedCrowdId = useDirectorStore((state) => state.selectedCrowdId);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const timeline = useDirectorStore((state) => state.project.timeline);
  const currentTime = useDirectorStore((state) => state.currentTime);
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateCrowdLabel = useDirectorStore((state) => state.updateCrowdLabel);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);
  const updateCrowdColor = useDirectorStore((state) => state.updateCrowdColor);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateCrowdTransform = useDirectorStore((state) => state.updateCrowdTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateCrowdUniformScale = useDirectorStore((state) => state.updateCrowdUniformScale);
  const setKeyframeGroupAtPlayhead = useDirectorStore((state) => state.setKeyframeGroupAtPlayhead);
  const setObjectFaceMovement = useDirectorStore((state) => state.setObjectFaceMovement);
  const setObjectWalkAnimation = useDirectorStore((state) => state.setObjectWalkAnimation);
  const applyPosePreset = useDirectorStore((state) => state.applyPosePreset);
  const applyCrowdPosePreset = useDirectorStore((state) => state.applyCrowdPosePreset);
  const updatePoseControl = useDirectorStore((state) => state.updatePoseControl);
  const updateCrowdPoseControl = useDirectorStore((state) => state.updateCrowdPoseControl);

  const selection = useMemo(() => {
    const role = objects.find((item) => item.id === selectedObjectId && item.kind === "character");

    if (selectedCrowdId) {
      const crowdMembers = objects.filter((item) => item.kind === "character" && item.crowdId === selectedCrowdId);
      const crowdAnchor = getCrowdAnchorTransform(objects, selectedCrowdId);

      if (crowdMembers.length && crowdAnchor) {
        return {
          mode: "crowd" as const,
          crowdId: selectedCrowdId,
          crowdMembers,
          crowdAnchor,
          role: crowdMembers[crowdMembers.length - 1] ?? crowdMembers[0],
          name: crowdMembers[0]?.crowdLabel ?? "群众",
          color: crowdMembers[0]?.color ?? "#4F8EF7",
        };
      }
    }

    if (!role) return null;

    return {
      mode: "single" as const,
      crowdId: null,
      crowdMembers: [role],
      crowdAnchor: role.transform,
      role,
      name: role.name,
      color: role.color ?? "#4F8EF7",
    };
  }, [objects, selectedCrowdId, selectedObjectId]);

  const transformRows = useMemo(() => {
    if (!selection) return [];
    const isCrowd = selection.mode === "crowd";
    const id = isCrowd ? (selection.crowdId as string) : selection.role.id;
    const transform = selection.crowdAnchor;
    const track = isCrowd ? [] : (timeline?.tracks?.[id] ?? []);
    const keyframable = !isCrowd;

    const updateVec = (field: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => {
      if (isCrowd) {
        updateCrowdTransform(id, { [field]: replaceAxis(transform[field], axis, value) });
        return;
      }
      updateObjectTransform(id, { [field]: replaceAxis(transform[field], axis, value) });
    };
    const keyframeVec = (field: "position" | "rotation" | "scale", axis: 0 | 1 | 2, vec: [number, number, number]) => {
      if (isCrowd) return;
      setKeyframeGroupAtPlayhead(id, buildAxisKeyframeFields(track, currentTime, field, axis, vec));
    };

    const rows: TransformRowDef[] = [
      ...buildVecAxisRows({
        field: "position",
        vec: transform.position,
        track,
        currentTime,
        update: (axis, value) => updateVec("position", axis, value),
        keyframe: (axis, vec) => keyframeVec("position", axis, vec),
        keyframable,
      }),
      ...buildVecAxisRows({
        field: "rotation",
        vec: transform.rotation,
        track,
        currentTime,
        update: (axis, value) => updateVec("rotation", axis, value),
        keyframe: (axis, vec) => keyframeVec("rotation", axis, vec),
        keyframable,
      }),
      ...buildVecAxisRows({
        field: "scale",
        vec: transform.scale,
        track,
        currentTime,
        update: (axis, value) => updateVec("scale", axis, value),
        keyframe: (axis, vec) => keyframeVec("scale", axis, vec),
        keyframable,
      }),
      {
        key: "uniform-scale",
        label: "统一缩放",
        value: transform.scale[0],
        hasKey: hasFieldAtPlayhead(track, currentTime, "scale"),
        onValueChange: (value) => (isCrowd ? updateCrowdUniformScale(id, value) : updateUniformScale(id, value)),
        onKeyframe: () => {
          if (isCrowd) return;
          const s = transform.scale[0];
          setKeyframeGroupAtPlayhead(id, { scale: [s, s, s] });
        },
        keyframable,
      },
    ];
    return rows;
  }, [
    currentTime,
    selection,
    setKeyframeGroupAtPlayhead,
    timeline,
    updateCrowdTransform,
    updateCrowdUniformScale,
    updateObjectTransform,
    updateUniformScale,
  ]);

  if (!selection) return null;

  const role = selection.role;
  const roleColor = selection.color;
  const isCrowd = selection.mode === "crowd";
  const poseGroups = [
    {
      title: "身体",
      controls: [
        { key: "body.pitch", label: "前倾" },
        { key: "body.yaw", label: "转身" },
        { key: "body.roll", label: "侧倾" },
      ],
    },
    {
      title: "躯干",
      controls: [
        { key: "torso.pitch", label: "前倾" },
        { key: "torso.yaw", label: "扭转" },
        { key: "torso.roll", label: "侧倾" },
      ],
    },
    {
      title: "头部",
      controls: [
        { key: "head.pitch", label: "点头" },
        { key: "head.yaw", label: "转头" },
        { key: "head.roll", label: "歪头" },
      ],
    },
    {
      title: "左肩",
      controls: [
        { key: "leftShoulder.pitch", label: "前举" },
        { key: "leftShoulder.spread", label: "外展" },
        { key: "leftShoulder.twist", label: "扭转" },
      ],
    },
    {
      title: "右肩",
      controls: [
        { key: "rightShoulder.pitch", label: "前举" },
        { key: "rightShoulder.spread", label: "外展" },
        { key: "rightShoulder.twist", label: "扭转" },
      ],
    },
    {
      title: "左肘",
      controls: [{ key: "leftElbow.bend", label: "弯曲" }],
    },
    {
      title: "右肘",
      controls: [{ key: "rightElbow.bend", label: "弯曲" }],
    },
    {
      title: "左髋",
      controls: [
        { key: "leftHip.pitch", label: "前抬" },
        { key: "leftHip.spread", label: "外展" },
        { key: "leftHip.twist", label: "扭转" },
      ],
    },
    {
      title: "右髋",
      controls: [
        { key: "rightHip.pitch", label: "前抬" },
        { key: "rightHip.spread", label: "外展" },
        { key: "rightHip.twist", label: "扭转" },
      ],
    },
    {
      title: "左膝",
      controls: [{ key: "leftKnee.bend", label: "弯曲" }],
    },
    {
      title: "右膝",
      controls: [{ key: "rightKnee.bend", label: "弯曲" }],
    },
  ] as const;

  return (
    <InspectorPanel
      title="角色"
      ariaLabel="角色右侧属性面板"
      className="character-inspector"
      tabs={[
        { label: "属性", active: activeTab === "properties", onClick: () => setActiveTab("properties") },
        { label: "姿势", active: activeTab === "pose", onClick: () => setActiveTab("pose") },
      ]}
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label="名称"
            ariaLabel="角色名称"
            value={selection.name}
            onChange={(value) => {
              if (isCrowd && selection.crowdId) {
                updateCrowdLabel(selection.crowdId, value);
                return;
              }

              updateObjectName(role.id, value);
            }}
          />
          <InspectorColorField
            label="颜色"
            colorAriaLabel="角色颜色"
            hexAriaLabel="角色颜色 HEX"
            value={roleColor}
            onColorChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
            onHexChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
          />
          <TransformKeyframeRows rows={transformRows} />
          <InspectorSection title="动画" className="character-anim-section">
            <div className="anim-ed-toggle-row">
              <button
                type="button"
                className={`anim-ed-toggle${role.faceMovement !== false ? " is-active" : ""}`}
                aria-pressed={role.faceMovement !== false}
                onClick={() => setObjectFaceMovement(role.id, role.faceMovement === false)}
              >
                自动朝向
              </button>
              <button
                type="button"
                className={`anim-ed-toggle${role.walkAnimation === true ? " is-active" : ""}`}
                aria-pressed={role.walkAnimation === true}
                onClick={() => setObjectWalkAnimation(role.id, role.walkAnimation !== true)}
              >
                走路
              </button>
            </div>
          </InspectorSection>
        </>
      ) : (
        <InspectorSection title="姿势预设" className="pose-preset-section">
          {role.characterRig ? (
            <>
              <div className="preset-grid">
                {MANNEQUIN_POSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={role.characterRig?.posePresetId === preset.id ? "is-active" : undefined}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? applyCrowdPosePreset(selection.crowdId, preset.id)
                        : applyPosePreset(role.id, preset.id)
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <InspectorSection title="姿势调节" className="pose-adjust-section">
                <div className="pose-groups">
                  {poseGroups.map((group) => (
                    <section key={group.title} className="pose-group">
                      <h4>{group.title}</h4>
                      {group.controls.map((control) => (
                        <InspectorRangeNumberField
                          key={control.key}
                          label={control.label}
                          rangeAriaLabel={`${group.title} · ${control.label} 滑杆`}
                          numberAriaLabel={`${group.title} · ${control.label}`}
                          max="90"
                          min="-90"
                          step="1"
                          value={role.characterRig?.controls[control.key] ?? 0}
                          onValueChange={(value) =>
                            isCrowd && selection.crowdId
                              ? updateCrowdPoseControl(selection.crowdId, control.key, Number(value))
                              : updatePoseControl(role.id, control.key, Number(value))
                          }
                        />
                      ))}
                    </section>
                  ))}
                </div>
              </InspectorSection>
            </>
          ) : (
            <p>该模型未识别到标准 humanoid 骨骼，暂不支持姿势编辑。</p>
          )}
        </InspectorSection>
      )}
    </InspectorPanel>
  );
}
