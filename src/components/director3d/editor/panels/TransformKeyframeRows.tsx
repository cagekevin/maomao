import { AnimNumberInput } from "./AnimationEditorControls";
import type { DirectorKeyframe } from "../schema/directorProject";
import { TIME_EPSILON, type Vec3Field } from "../runtime/timelineInterpolation";

/**
 * 统一「属性行」：一行 = ◆打帧 + 标签 + 数值输入（单一真相，避免属性输入与打帧触点重复）。
 * 由 TransformKeyframeRows 渲染；buildVecAxisRows / replaceAxis / hasFieldAtPlayhead
 * 是各属性面板（角色/道具/摄像机）共享的公共构建逻辑。
 */

/** 替换三维元组的指定轴 */
export function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

/** 当前播放头该字段是否已有关键帧（菱形亮/灰） */
export function hasFieldAtPlayhead(
  track: DirectorKeyframe[],
  time: number,
  field: Vec3Field | "fov"
): boolean {
  return track.some((frame) => Math.abs(frame.time - time) < TIME_EPSILON && frame[field] != null);
}

export interface TransformRowDef {
  key: string;
  label: string;
  value: number;
  /** 当前播放头该属性是否已有关键帧（菱形亮/灰） */
  hasKey: boolean;
  /** 数值输入：改值（Auto Key 感知在 store action 层） */
  onValueChange: (value: number) => void;
  /** 点菱形：在当前播放头给该属性打关键帧 */
  onKeyframe: () => void;
  /** false = 该行无打帧菱形（如群众整体） */
  keyframable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const AXIS_LABELS = ["X", "Y", "Z"] as const;

export const VEC_FIELD_LABELS: Record<string, string> = {
  position: "位置",
  rotation: "旋转",
  scale: "缩放",
  target: "注视",
};

export function TransformKeyframeRows({ rows }: { rows: TransformRowDef[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="transform-keyframe-rows">
      {rows.map((row) => (
        <div key={row.key} className={`transform-keyframe-row${row.disabled ? " is-disabled" : ""}`}>
          {row.keyframable === false ? null : (
            <button
              type="button"
              className={`transform-keyframe-key${row.hasKey ? " has-key" : ""}`}
              aria-label={`给「${row.label}」打关键帧`}
              aria-pressed={row.hasKey}
              disabled={row.disabled || undefined}
              title={
                row.disabled
                  ? row.disabledReason ?? "该参数不可打帧"
                  : row.hasKey
                    ? "当前时间已有关键帧"
                    : `在当前时间给「${row.label}」打关键帧`
              }
              onClick={row.onKeyframe}
            >
              <span className="transform-keyframe-diamond" />
            </button>
          )}
          <span className="transform-keyframe-label">{row.label}</span>
          <AnimNumberInput
            ariaLabel={row.label}
            value={row.value}
            step={row.label.startsWith("旋转") ? 0.05 : row.label.includes("缩放") ? 0.01 : 0.1}
            disabled={row.disabled || undefined}
            onChange={(raw) => {
              const next = Number(raw);
              if (Number.isFinite(next)) row.onValueChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 构建三维字段（位置/旋转/缩放/注视）的 X/Y/Z 三行。
 */
export function buildVecAxisRows(opts: {
  field: "position" | "rotation" | "scale" | "target";
  vec: [number, number, number];
  track: DirectorKeyframe[];
  currentTime: number;
  update: (axis: 0 | 1 | 2, value: number) => void;
  keyframe: (axis: 0 | 1 | 2, currentVec: [number, number, number]) => void;
  keyframable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}): TransformRowDef[] {
  return AXIS_LABELS.map((label, index) => {
    const axis = index as 0 | 1 | 2;
    return {
      key: `${opts.field}-${label}`,
      label: `${VEC_FIELD_LABELS[opts.field]} ${label}`,
      value: opts.vec[axis],
      hasKey: opts.track.some(
        (frame) => Math.abs(frame.time - opts.currentTime) < TIME_EPSILON && frame[opts.field] != null
      ),
      onValueChange: (value) => opts.update(axis, value),
      onKeyframe: () => opts.keyframe(axis, opts.vec),
      keyframable: opts.keyframable,
      disabled: opts.disabled,
      disabledReason: opts.disabledReason,
    };
  });
}
