import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { useDirectorStore } from "../store/directorStore";
import { sampleKeyframeCurve } from "../runtime/timelineInterpolation";
import type { DirectorKeyframe, KeyframeEasing } from "../schema/directorProject";

/**
 * 曲线编辑器弹窗（F-Curve 基础版）：
 * - 选对象 → 选属性/轴 → SVG 折线显示插值曲线（线性/缓入缓出/台阶对应 ease/hold）
 * - 关键帧为控制点，可拖动改时间/改值；选中可改插值、删除
 * 只读 store 数据，通过 updateKeyframe/removeKeyframe 落库（唯一入口）。
 */

const SVG_WIDTH = 360;
const SVG_HEIGHT = 200;
const PAD_X = 28;
const PAD_Y = 22;

type CurveField = "position" | "rotation" | "scale" | "target" | "fov";
const FIELD_OPTIONS: Array<{ id: CurveField; label: string }> = [
  { id: "position", label: "位置" },
  { id: "rotation", label: "旋转" },
  { id: "scale", label: "缩放" },
  { id: "target", label: "看向" },
  { id: "fov", label: "视野 FOV" },
];
const AXIS_LABELS = ["X", "Y", "Z"] as const;

const EASING_OPTIONS: Array<{ id: KeyframeEasing; label: string }> = [
  { id: "linear", label: "线性" },
  { id: "hold", label: "台阶" },
  { id: "ease", label: "缓入缓出" },
];

export function CurveEditorDialog() {
  const curveEditorTrackId = useDirectorStore((state) => state.curveEditorTrackId);
  const closeCurveEditor = useDirectorStore((state) => state.closeCurveEditor);
  const timeline = useDirectorStore((state) => state.project.timeline);
  const objects = useDirectorStore((state) => state.project.objects);
  const cameras = useDirectorStore((state) => state.project.cameras);
  const duration = timeline?.duration ?? 5;
  const updateKeyframe = useDirectorStore((state) => state.updateKeyframe);
  const removeKeyframe = useDirectorStore((state) => state.removeKeyframe);

  const [field, setField] = useState<CurveField>("position");
  const [axis, setAxis] = useState<0 | 1 | 2>(0);
  const [selectedKfId, setSelectedKfId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    startTime: number;
    startValue: number;
    previewTime: number;
    previewValue: number;
  } | null>(null);

  const trackId = curveEditorTrackId;
  const track = useMemo(() => {
    if (!trackId) return [];
    return timeline?.tracks?.[trackId] ?? [];
  }, [timeline, trackId]);

  const trackName = useMemo(() => {
    if (!trackId) return "";
    const object = objects.find((item) => item.id === trackId || item.linkedCameraId === trackId);
    if (object) return object.name;
    const camera = cameras.find((item) => item.id === trackId);
    return camera?.name ?? trackId;
  }, [cameras, objects, trackId]);

  const isScalar = field === "fov";
  const curveKeyframes = useMemo(() => {
    return track
      .filter((frame) => (isScalar ? typeof frame.fov === "number" : frame[field] != null))
      .sort((a, b) => a.time - b.time);
  }, [field, isScalar, track]);

  // 采样折线 + 值域
  const curve = useMemo(() => {
    const points = sampleKeyframeCurve(track, field, isScalar ? null : axis, 64);
    if (points.length === 0) return { points, min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    points.forEach((p) => {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    });
    curveKeyframes.forEach((frame) => {
      const v = isScalar ? frame.fov ?? 0 : ((frame[field] as [number, number, number])?.[axis] ?? 0);
      if (v < min) min = v;
      if (v > max) max = v;
    });
    if (Math.abs(max - min) < 1e-6) {
      const pad = Math.abs(max) * 0.1 + 1;
      min -= pad;
      max += pad;
    }
    return { points, min, max };
  }, [axis, curveKeyframes, field, isScalar, track]);

  const t0 = curveKeyframes.length > 0 ? curveKeyframes[0].time : 0;
  const t1 = curveKeyframes.length > 1 ? curveKeyframes[curveKeyframes.length - 1].time : Math.max(t0 + 1, duration);

  const scaleX = (time: number) => PAD_X + ((time - t0) / Math.max(t1 - t0, 0.0001)) * (SVG_WIDTH - PAD_X * 2);
  const scaleY = (value: number) =>
    SVG_HEIGHT - PAD_Y - ((value - curve.min) / Math.max(curve.max - curve.min, 0.0001)) * (SVG_HEIGHT - PAD_Y * 2);
  const invX = (x: number) => t0 + ((x - PAD_X) / Math.max(SVG_WIDTH - PAD_X * 2, 1)) * (t1 - t0);
  const invY = (y: number) => curve.max - ((y - PAD_Y) / Math.max(SVG_HEIGHT - PAD_Y * 2, 1)) * (curve.max - curve.min);

  const frameValue = (frame: DirectorKeyframe): number =>
    isScalar ? frame.fov ?? 0 : ((frame[field] as [number, number, number])?.[axis] ?? 0);

  const pathD = useMemo(() => {
    if (curve.points.length < 2) return "";
    return curve.points
      .map((p, index) => `${index === 0 ? "M" : "L"} ${scaleX(p.time).toFixed(2)} ${scaleY(p.value).toFixed(2)}`)
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, scaleX, scaleY]);

  function handlePointDown(event: ReactPointerEvent<SVGCircleElement>, frame: DirectorKeyframe) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedKfId(frame.id);
    setDrag({
      id: frame.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTime: frame.time,
      startValue: frameValue(frame),
      previewTime: frame.time,
      previewValue: frameValue(frame),
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointMove(event: ReactPointerEvent<SVGCircleElement>) {
    if (!drag || drag.id !== event.currentTarget.dataset.kfid) return;
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    const sx = (dx / rect.width) * SVG_WIDTH;
    const sy = (dy / rect.height) * SVG_HEIGHT;
    const nextTime = Math.max(0, Math.min(duration, invX(scaleX(drag.startTime) + sx)));
    const nextValue = invY(scaleY(drag.startValue) + sy);
    setDrag((current) => (current && current.id === drag.id ? { ...current, previewTime: nextTime, previewValue: nextValue } : current));
  }

  function handlePointUp(event: ReactPointerEvent<SVGCircleElement>) {
    if (!drag) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const timeChanged = Math.abs(drag.previewTime - drag.startTime) > 0.0001;
    const valueChanged = Math.abs(drag.previewValue - drag.startValue) > 1e-6;
    if (timeChanged || valueChanged) {
      const patch: Partial<DirectorKeyframe> = {};
      if (timeChanged) patch.time = Math.max(0, Math.min(duration, drag.previewTime));
      if (valueChanged) {
        if (isScalar) {
          patch.fov = drag.previewValue;
        } else {
          const frame = curveKeyframes.find((item) => item.id === drag.id);
          const vec = frame?.[field] ? [...(frame[field] as [number, number, number])] : [0, 0, 0];
          vec[axis] = drag.previewValue;
          patch[field] = vec as [number, number, number];
        }
      }
      updateKeyframe(trackId!, drag.id, patch);
    }
    setDrag(null);
  }

  const selectedFrame = selectedKfId ? curveKeyframes.find((frame) => frame.id === selectedKfId) ?? null : null;

  if (!trackId) return null;

  return (
    <div className="curve-editor-overlay" role="dialog" aria-modal="true" aria-label="曲线编辑器" onPointerDown={() => closeCurveEditor()}>
      <div className="curve-editor-dialog" onPointerDown={(event) => event.stopPropagation()}>
        <div className="curve-editor-header">
          <h3>曲线编辑器 · {trackName}</h3>
          <button className="curve-editor-close" type="button" aria-label="关闭曲线编辑器" onClick={closeCurveEditor}>
            <X aria-hidden="true" size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="curve-editor-controls">
          <label className="curve-editor-control">
            <span>属性</span>
            <select
              className="ui-field"
              aria-label="曲线属性"
              value={field}
              onChange={(event) => {
                setField(event.currentTarget.value as CurveField);
                setSelectedKfId(null);
              }}
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!isScalar ? (
            <label className="curve-editor-control">
              <span>轴</span>
              <select
                className="ui-field"
                aria-label="曲线轴"
                value={String(axis)}
                onChange={(event) => {
                  setAxis(Number(event.currentTarget.value) as 0 | 1 | 2);
                  setSelectedKfId(null);
                }}
              >
                {AXIS_LABELS.map((label, index) => (
                  <option key={label} value={String(index)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {curveKeyframes.length === 0 ? (
          <div className="curve-editor-empty">该属性暂无关键帧，先在「关键帧」面板用菱形触点打帧。</div>
        ) : (
          <svg
            className="curve-editor-svg"
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            aria-label="关键帧曲线"
          >
            {/* 网格 */}
            {[0.25, 0.5, 0.75].map((ratio) => {
              const x = PAD_X + ratio * (SVG_WIDTH - PAD_X * 2);
              const y = PAD_Y + ratio * (SVG_HEIGHT - PAD_Y * 2);
              return (
                <g key={ratio}>
                  <line x1={PAD_X} x2={SVG_WIDTH - PAD_X} y1={y} y2={y} className="curve-editor-grid" />
                  <line x1={x} x2={x} y1={PAD_Y} y2={SVG_HEIGHT - PAD_Y} className="curve-editor-grid" />
                </g>
              );
            })}
            <path d={pathD} className="curve-editor-path" />
            {curveKeyframes.map((frame) => {
              const time = drag?.id === frame.id ? drag.previewTime : frame.time;
              const value = drag?.id === frame.id ? drag.previewValue : frameValue(frame);
              return (
                <circle
                  key={frame.id}
                  data-kfid={frame.id}
                  className={`curve-editor-point${selectedKfId === frame.id ? " is-selected" : ""}`}
                  cx={scaleX(time)}
                  cy={scaleY(value)}
                  r={5}
                  onPointerDown={(event) => handlePointDown(event, frame)}
                  onPointerMove={handlePointMove}
                  onPointerUp={handlePointUp}
                  onPointerCancel={handlePointUp}
                >
                  <title>{`${time.toFixed(2)}s · ${value.toFixed(2)}`}</title>
                </circle>
              );
            })}
          </svg>
        )}

        {selectedFrame ? (
          <div className="curve-editor-frame-edit">
            <label className="curve-editor-control">
              <span>插值</span>
              <select
                className="ui-field"
                aria-label="关键帧插值"
                value={selectedFrame.easing ?? "linear"}
                onChange={(event) => updateKeyframe(trackId, selectedFrame.id, { easing: event.currentTarget.value as KeyframeEasing })}
              >
                {EASING_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ui-icon-button curve-editor-delete"
              type="button"
              onClick={() => {
                removeKeyframe(trackId, selectedFrame.id);
                setSelectedKfId(null);
              }}
            >
              删除帧
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
