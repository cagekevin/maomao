import { ChevronUp, SlidersHorizontal } from 'lucide-react';

export function CameraAnglePanel({ camera, onChange, onClose, onLevel }) {
  const rotation = Array.isArray(camera.rotation) ? camera.rotation : [0, 0, 0];
  const updateAxis = (axis, degrees) => {
    const next = [...rotation];
    next[axis] = (Number(degrees) * Math.PI) / 180;
    onChange({ rotation: next });
  };
  const range = (label, axis, minimum, maximum) => {
    const degrees = Math.round(((rotation[axis] || 0) * 180) / Math.PI);
    return (
      <label className="camera-angle-range" key={label}>
        <span>{label}</span>
        <input
          type="range"
          aria-label={`摄像机${label}`}
          min={minimum}
          max={maximum}
          step="1"
          value={degrees}
          onChange={(event) => updateAxis(axis, event.target.value)}
        />
        <output>{degrees}°</output>
      </label>
    );
  };
  return (
    <div className="camera-angle-panel floating-panel" role="dialog" aria-label="摄像机角度调整">
      <div className="camera-angle-head">
        <div>
          <SlidersHorizontal size={14} />
          <span>
            <strong>镜头角度</strong>
            <small>参考图地面与水平线校正</small>
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="收起镜头角度面板">
          <ChevronUp size={13} />
        </button>
      </div>
      <div className="camera-angle-body">
        {range('俯仰', 0, -89, 89)}
        {range('水平', 1, -180, 180)}
        {range('翻滚', 2, -45, 45)}
      </div>
      <div className="camera-angle-foot">
        <span>先用“翻滚”校正倾斜，再用俯仰和水平匹配参考图透视。</span>
        <button type="button" onClick={onLevel}>
          水平归正
        </button>
      </div>
    </div>
  );
}
