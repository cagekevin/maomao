import { useMemo, useState } from "react";
import {
  AnimButton,
  AnimEmpty,
  AnimField,
  AnimHint,
  AnimNumberInput,
  AnimSection,
  AnimSelectField,
  AnimSliderField,
} from "./AnimationEditorControls";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { useDirectorStore } from "../store/directorStore";
import { selectRightPanelKind } from "../store/directorSelectors";
import { CharacterPanel } from "./CharacterPanel";
import { PropPanel } from "./PropPanel";
import { CameraPanel } from "./CameraPanel";
import { ScenePanel } from "./ScenePanel";
import type { CameraShotPresetId } from "../runtime/timelineInterpolation";
import type { DirectorKeyframe, KeyframeEasing } from "../schema/directorProject";

const SHOT_PRESET_OPTIONS: Array<{ id: CameraShotPresetId; label: string }> = [
  { id: "dollyIn", label: "推镜（推近）" },
  { id: "dollyOut", label: "拉镜（拉远）" },
  { id: "truck", label: "横移" },
  { id: "pan", label: "摇镜" },
  { id: "orbit", label: "环绕" },
  { id: "crane", label: "升降" },
  { id: "pedestal", label: "俯仰" },
  { id: "handheld", label: "手持" },
];

const EASING_OPTIONS: Array<{ id: KeyframeEasing; label: string }> = [
  { id: "linear", label: "线性" },
  { id: "hold", label: "保持" },
  { id: "ease", label: "缓动" },
];

function formatTime(value: number) {
  return Number(value).toFixed(2);
}

/** 关键帧类型判定 */
function classifyKeyframe(frame: DirectorKeyframe): "pose" | "shot" | "move" {
  if (frame.posePresetId != null || (frame.controls && Object.keys(frame.controls).length > 0)) return "pose";
  if (frame.target != null) return "shot";
  return "move";
}

const TRACK_LABEL: Record<string, string> = {
  pose: "姿态",
  shot: "运镜",
  move: "位移动画",
};

/**
 * 右栏唯一动画面板。
 *
 * 职责分工（单一真相）：
 * - 属性编辑 + 打帧行（◆ 标签 数值）→ 由 CharacterPanel / PropPanel / CameraPanel / ScenePanel
 *   各自自包含渲染（共享 TransformKeyframeRows 组件与 buildVecAxisRows / replaceAxis 等公共逻辑）。
 * - 本面板只负责：按选中对象类型渲染对应面板 + 关键帧工具/列表/精修 + 运镜（仅摄像机）。
 * - 打帧触点写入统一走 setKeyframeGroupAtPlayhead；数值输入在 store action 层做 Auto Key 感知。
 */
export function AnimationPanel() {
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [shotDraft, setShotDraft] = useState({
    preset: "dollyIn" as CameraShotPresetId,
    startTime: "0",
    segmentDuration: "3",
    amount: "2",
    angleDeg: "180",
    seed: "1",
  });
  const objects = useDirectorStore((state) => state.project.objects);
  const cameras = useDirectorStore((state) => state.project.cameras);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const panelKind = useDirectorStore(selectRightPanelKind);
  const timeline = useDirectorStore((state) => state.project.timeline);
  const currentTime = useDirectorStore((state) => state.currentTime);
  const setCurrentTime = useDirectorStore((state) => state.setCurrentTime);
  const updateKeyframe = useDirectorStore((state) => state.updateKeyframe);
  const removeKeyframe = useDirectorStore((state) => state.removeKeyframe);
  const removeKeyframes = useDirectorStore((state) => state.removeKeyframes);
  const applyCameraShotPreset = useDirectorStore((state) => state.applyCameraShotPreset);

  const selectedObject = objects.find((item) => item.id === selectedObjectId);

  const tracks = useMemo(() => {
    const result: Array<{ id: string; name: string; kind: "character" | "camera" | "prop"; frames: DirectorKeyframe[] }> = [];
    const framesById: Record<string, DirectorKeyframe[]> = timeline?.tracks ?? {};

    objects
      .filter((item) => item.kind !== "panorama")
      .forEach((item) => {
        const frames = framesById[item.id];
        if (frames && frames.length > 0) {
          result.push({ id: item.id, name: item.name, kind: item.kind === "camera" ? "camera" : item.kind === "character" ? "character" : "prop", frames });
        }
      });
    cameras.forEach((camera) => {
      const frames = framesById[camera.id];
      if (frames && frames.length > 0) {
        result.push({ id: camera.id, name: camera.name, kind: "camera", frames });
      }
    });
    return result;
  }, [cameras, objects, timeline]);

  // 选中相机对象 → 用其 linkedCameraId 定位轨道（统一映射：相机 track key = 机位 id）
  const activeTrack =
    tracks.find((track) => track.id === (selectedObject?.kind === "camera" && selectedObject.linkedCameraId ? selectedObject.linkedCameraId : selectedObject?.id ?? cameras[0]?.id)) ?? tracks[0] ?? null;
  const activeTrackId = activeTrack?.id ?? null;
  const activeTrackFrames = activeTrack?.frames ?? [];

  const activeFrame = activeTrackFrames.find((frame) => frame.id === selectedKeyframeId) ?? null;

  const kfTarget = selectedObject && (selectedObject.kind === "character" || selectedObject.kind === "camera") ? selectedObject : null;
  // 运镜面板仅对摄像机有意义（选中人物/道具时隐藏该 tab）
  const isCamera = kfTarget?.kind === "camera";

  function handleGenerateShot() {
    if (!kfTarget || kfTarget.kind !== "camera") return;
    const cameraId = kfTarget.linkedCameraId;
    if (!cameraId) return;
    applyCameraShotPreset(cameraId, shotDraft.preset, {
      startTime: Number(shotDraft.startTime) || 0,
      segmentDuration: Math.max(0.1, Number(shotDraft.segmentDuration) || 1),
      amount: Number(shotDraft.amount) || 0,
      angleDeg: Number(shotDraft.angleDeg) || 0,
      seed: Number(shotDraft.seed) || 1,
    });
  }

  function handleUpdateActiveFrame(patch: Partial<DirectorKeyframe>) {
    if (!activeTrackId || !activeFrame) return;
    updateKeyframe(activeTrackId, activeFrame.id, patch);
  }

  return (
    <section className="anim-ed-panel" aria-label="动画面板">
      <div className="anim-ed-body">
        <>
          {/* 属性编辑：按选中对象类型渲染对应自包含面板（含打帧行） */}
          <div className="anim-ed-props-host" key={panelKind}>
              {panelKind === "character" ? <CharacterPanel /> : null}
              {panelKind === "prop" ? <PropPanel /> : null}
              {panelKind === "camera" ? <CameraPanel /> : null}
              {panelKind === "scene" ? <ScenePanel /> : null}
            </div>

            {panelKind !== "scene" ? (
              <>
                <AnimSection title="关键帧工具">
                  <div className="anim-ed-actions">
                    <AnimButton
                      disabled={!activeTrackId || activeTrackFrames.length <= 2}
                      onClick={() => {
                        if (!activeTrackId || !activeTrackFrames.length) return;
                        const times = activeTrackFrames.map((frame) => frame.time);
                        const min = Math.min(...times);
                        const max = Math.max(...times);
                        const removed = activeTrackFrames.length - 2;
                        if (removed > 0 && window.confirm(`保留首尾关键帧，删除中间 ${removed} 帧？`)) {
                          removeKeyframes(activeTrackId, (frame) => frame.time !== min && frame.time !== max);
                          setSelectedKeyframeId(null);
                        }
                      }}
                    >
                      保留首尾
                    </AnimButton>
                    <AnimButton
                      variant="danger"
                      disabled={!activeTrackId || activeTrackFrames.length === 0}
                      onClick={() => {
                        if (!activeTrackId) return;
                        if (window.confirm(`确定删除当前轨道全部 ${activeTrackFrames.length} 个关键帧？`)) {
                          removeKeyframes(activeTrackId);
                          setSelectedKeyframeId(null);
                        }
                      }}
                    >
                      删除全部
                    </AnimButton>
                  </div>
                </AnimSection>

                <AnimSection title="关键帧列表">
                  {activeTrackFrames.length === 0 ? (
                    <AnimEmpty>当前轨道暂无关键帧。</AnimEmpty>
                  ) : (
                    <div className="anim-ed-kflist">
                      {activeTrackFrames.map((frame) => (
                        <div
                          key={frame.id}
                          className={`anim-ed-kf${frame.id === selectedKeyframeId ? " is-active" : ""}`}
                        >
                          <button
                            type="button"
                            className="anim-ed-kf-main"
                            aria-label={`定位关键帧 ${frame.time}`}
                            onClick={() => {
                              setSelectedKeyframeId(frame.id);
                              setCurrentTime(frame.time);
                            }}
                          >
                            <span className="anim-ed-kf-time">{formatTime(frame.time)}s</span>
                            <span className="anim-ed-kf-type">{TRACK_LABEL[classifyKeyframe(frame)]}</span>
                            <span className="anim-ed-kf-ease">{frame.easing ?? "linear"}</span>
                          </button>
                          <button
                            type="button"
                            className="anim-ed-kf-del"
                            aria-label="删除关键帧"
                            onClick={() => {
                              if (activeTrackId) removeKeyframe(activeTrackId, frame.id);
                              if (frame.id === selectedKeyframeId) setSelectedKeyframeId(null);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </AnimSection>

                {activeFrame ? (
                  <AnimSection title="精修当前帧">
                    <AnimField label="时间 (s)">
                      <AnimNumberInput
                        ariaLabel="关键帧时间"
                        value={Number(activeFrame.time.toFixed(3))}
                        step={0.01}
                        min={0}
                        onChange={(value) => {
                          const next = Number(value);
                          if (Number.isFinite(next) && next >= 0) {
                            handleUpdateActiveFrame({ time: next });
                            setCurrentTime(next);
                          }
                        }}
                      />
                    </AnimField>
                    <AnimSelectField
                      label="插值"
                      ariaLabel="引出段插值"
                      value={activeFrame.easing ?? "linear"}
                      onChange={(value) => handleUpdateActiveFrame({ easing: value as KeyframeEasing })}
                      options={EASING_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                    />
                    {kfTarget && kfTarget.kind === "camera" && kfTarget.linkedCameraId ? (
                      <div className="anim-ed-actions">
                        <AnimButton onClick={() => handleUpdateActiveFrame({ target: [0, 0, 0] })}>看向原点</AnimButton>
                        <AnimButton
                          onClick={() => {
                            const camera = cameras.find((item) => item.id === kfTarget.linkedCameraId);
                            if (!camera) return;
                            handleUpdateActiveFrame({
                              position: camera.transform.position,
                              target: camera.target,
                              fov: camera.fov,
                            });
                          }}
                        >
                          匹配当前机位
                        </AnimButton>
                      </div>
                    ) : null}
                    {activeFrame.posePresetId != null || (activeFrame.controls && Object.keys(activeFrame.controls).length > 0) ? (
                      <AnimSelectField
                        label="姿态预设"
                        ariaLabel="姿态预设"
                        value={activeFrame.posePresetId ?? ""}
                        onChange={(value) =>
                          handleUpdateActiveFrame({ posePresetId: value || null, controls: activeFrame.controls ?? {} })
                        }
                        options={[
                          { value: "", label: "无（保持插值）" },
                          ...MANNEQUIN_POSE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
                        ]}
                      />
                    ) : null}
                  </AnimSection>
                ) : null}
              </>
            ) : null}
        </>

        {isCamera ? (
          <AnimSection title="运镜生成" hint="选中相机对象（机位）后，选择预设并生成一段运镜动画。">
            {!kfTarget || kfTarget.kind !== "camera" ? (
              <AnimEmpty>请先在场景树选中一个相机对象（机位）再生成运镜。</AnimEmpty>
            ) : (
              <>
                <AnimHint>当前相机：{kfTarget.name}</AnimHint>
                <AnimSelectField
                  label="运镜预设"
                  ariaLabel="运镜预设"
                  value={shotDraft.preset}
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, preset: value as CameraShotPresetId }))}
                  options={SHOT_PRESET_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                />
                <AnimSliderField
                  label="起点 (s)"
                  value={shotDraft.startTime}
                  min={0}
                  max={60}
                  step={0.1}
                  rangeAriaLabel="起点时间"
                  numberAriaLabel="起点时间数值"
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, startTime: value }))}
                />
                <AnimSliderField
                  label="时长 (s)"
                  value={shotDraft.segmentDuration}
                  min={0.1}
                  max={30}
                  step={0.1}
                  rangeAriaLabel="时长"
                  numberAriaLabel="时长数值"
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, segmentDuration: value }))}
                />
                <AnimSliderField
                  label="幅度"
                  value={shotDraft.amount}
                  min={-20}
                  max={20}
                  step={0.1}
                  rangeAriaLabel="幅度"
                  numberAriaLabel="幅度数值"
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, amount: value }))}
                />
                <AnimSliderField
                  label="角度 (°)"
                  value={shotDraft.angleDeg}
                  min={-360}
                  max={360}
                  step={5}
                  rangeAriaLabel="角度"
                  numberAriaLabel="角度数值"
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, angleDeg: value }))}
                />
                <AnimSliderField
                  label="手持种子"
                  value={shotDraft.seed}
                  min={0}
                  max={999}
                  step={1}
                  rangeAriaLabel="手持种子"
                  numberAriaLabel="手持种子数值"
                  onChange={(value) => setShotDraft((draft) => ({ ...draft, seed: value }))}
                />
                <AnimButton variant="primary" onClick={handleGenerateShot}>生成运镜</AnimButton>
              </>
            )}
          </AnimSection>
        ) : null}
      </div>
    </section>
  );
}
