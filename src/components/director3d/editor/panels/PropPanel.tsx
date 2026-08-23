import { useMemo } from "react";
import { InspectorColorField, InspectorPanel, InspectorTextField } from "./InspectorControls";
import { useDirectorStore } from "../store/directorStore";
import { TransformKeyframeRows, buildVecAxisRows, hasFieldAtPlayhead, replaceAxis, type TransformRowDef } from "./TransformKeyframeRows";
import { buildAxisKeyframeFields } from "../runtime/timelineInterpolation";

/**
 * 模型/道具面板（自包含）：
 * 名称/颜色 + 统一打帧行（位置/旋转/缩放 XYZ + 统一缩放）。
 */

export function PropPanel() {
  const prop = useDirectorStore((state) => {
    const selected = state.project.objects.find((item) => item.id === state.selectedObjectId);
    const selectedAsset = selected?.assetRefId
      ? state.project.assets.find((asset) => asset.id === selected.assetRefId)
      : undefined;

    if (!selected) return undefined;
    if (selected.kind === "prop") return selected;
    if (selectedAsset?.sourceType === "model") return selected;

    return undefined;
  });
  const timeline = useDirectorStore((state) => state.project.timeline);
  const currentTime = useDirectorStore((state) => state.currentTime);
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const setKeyframeGroupAtPlayhead = useDirectorStore((state) => state.setKeyframeGroupAtPlayhead);

  const transformRows = useMemo(() => {
    if (!prop) return [];
    const track = timeline?.tracks?.[prop.id] ?? [];
    const transform = prop.transform;

    const updateVec = (field: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => {
      updateObjectTransform(prop.id, { [field]: replaceAxis(transform[field], axis, value) });
    };
    const keyframeVec = (field: "position" | "rotation" | "scale", axis: 0 | 1 | 2, vec: [number, number, number]) => {
      setKeyframeGroupAtPlayhead(prop.id, buildAxisKeyframeFields(track, currentTime, field, axis, vec));
    };

    const rows: TransformRowDef[] = [
      ...buildVecAxisRows({
        field: "position",
        vec: transform.position,
        track,
        currentTime,
        update: (axis, value) => updateVec("position", axis, value),
        keyframe: (axis, vec) => keyframeVec("position", axis, vec),
      }),
      ...buildVecAxisRows({
        field: "rotation",
        vec: transform.rotation,
        track,
        currentTime,
        update: (axis, value) => updateVec("rotation", axis, value),
        keyframe: (axis, vec) => keyframeVec("rotation", axis, vec),
      }),
      ...buildVecAxisRows({
        field: "scale",
        vec: transform.scale,
        track,
        currentTime,
        update: (axis, value) => updateVec("scale", axis, value),
        keyframe: (axis, vec) => keyframeVec("scale", axis, vec),
      }),
      {
        key: "uniform-scale",
        label: "统一缩放",
        value: transform.scale[0],
        hasKey: hasFieldAtPlayhead(track, currentTime, "scale"),
        onValueChange: (value) => updateUniformScale(prop.id, value),
        onKeyframe: () => {
          const s = transform.scale[0];
          setKeyframeGroupAtPlayhead(prop.id, { scale: [s, s, s] });
        },
      },
    ];
    return rows;
  }, [currentTime, prop, setKeyframeGroupAtPlayhead, timeline, updateObjectTransform, updateUniformScale]);

  if (!prop) return null;

  const propColor = prop.color ?? "#d7e7ff";

  return (
    <InspectorPanel title="模型" ariaLabel="模型右侧属性面板" className="prop-inspector">
      <InspectorTextField label="名称" ariaLabel="模型名称" value={prop.name} onChange={(value) => updateObjectName(prop.id, value)} />
      <InspectorColorField
        label="颜色"
        colorAriaLabel="模型颜色"
        hexAriaLabel="模型颜色 HEX"
        value={propColor}
        onColorChange={(value) => updateObjectColor(prop.id, value)}
        onHexChange={(value) => updateObjectColor(prop.id, value)}
      />
      <TransformKeyframeRows rows={transformRows} />
    </InspectorPanel>
  );
}
