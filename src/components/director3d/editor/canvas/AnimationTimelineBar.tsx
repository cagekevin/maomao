import { useLayoutEffect, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  Rewind,
  SkipForward,
  Video,
} from "lucide-react";
import { useDirectorStore } from "../store/directorStore";
import { exportAnimation, isAnimationExportSupported, type AnimationExportFormat } from "../io/animationExport";
import type { DirectorKeyframe } from "../schema/directorProject";

const TIMELINE_MIN_DURATION = 0.1;
const TIMELINE_MAX_DURATION = 600;
const TIMELINE_MIN_FPS = 1;
const TIMELINE_MAX_FPS = 120;

export function AnimationTimelineBar() {
  const duration = useDirectorStore((state) => state.project.timeline?.duration ?? 5);
  const fps = useDirectorStore((state) => state.project.timeline?.fps ?? 30);
  const currentTime = useDirectorStore((state) => state.currentTime);
  const isPlaying = useDirectorStore((state) => state.isPlaying);
  const animationViewportMode = useDirectorStore((state) => state.animationViewportMode);
  const setCurrentTime = useDirectorStore((state) => state.setCurrentTime);
  const setTimelineDuration = useDirectorStore((state) => state.setTimelineDuration);
  const setTimelineFps = useDirectorStore((state) => state.setTimelineFps);
  const updateKeyframe = useDirectorStore((state) => state.updateKeyframe);
  const removeKeyframe = useDirectorStore((state) => state.removeKeyframe);
  const clearTrack = useDirectorStore((state) => state.clearTrack);
  const play = useDirectorStore((state) => state.play);
  const pause = useDirectorStore((state) => state.pause);
  const togglePlay = useDirectorStore((state) => state.togglePlay);
  const setAnimationModuleCollapsed = useDirectorStore((state) => state.setAnimationModuleCollapsed);

  const [draggingFrame, setDraggingFrame] = useState<{ trackKey: string; id: string; offsetX: number; baseTime: number } | null>(null);
  const [dragTimeById, setDragTimeById] = useState<Record<string, number>>({});
  const [selectedKf, setSelectedKf] = useState<{ trackKey: string; id: string } | null>(null);

  const [durationDraft, setDurationDraft] = useState(String(duration));
  const [fpsDraft, setFpsDraft] = useState(String(fps));
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDraft, setExportDraft] = useState({
    view: animationViewportMode,
    resolution: "720p",
    fps: String(fps),
  });
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const cameras = useDirectorStore((state) => state.project.cameras);
  const timeline = useDirectorStore((state) => state.project.timeline);
  const supportsExport = isAnimationExportSupported();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [editorWidth, setEditorWidth] = useState(0);
  const draggingRef = useRef(false);

  useLayoutEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    const update = () => setEditorWidth(element.clientWidth);
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  // 多轨时间轴：每个有轨道数据的对象/相机一行
  const tracks = timeline?.tracks ?? {};
  const selectedObject = objects.find((item) => item.id === selectedObjectId);

  // 轨道列表：角色/道具用对象 id，机位用 linkedCameraId
  const trackList: Array<{ trackKey: string; name: string; kind: string; frames: DirectorKeyframe[] }> = [];
  objects
    .filter((item) => item.kind !== "panorama")
    .forEach((item) => {
      const trackKey = item.kind === "camera" && item.linkedCameraId ? item.linkedCameraId : item.id;
      const frames = tracks[trackKey];
      if (frames && frames.length > 0) {
        trackList.push({ trackKey, name: item.name, kind: item.kind === "camera" ? "机位" : item.kind === "character" ? "角色" : "道具", frames });
      }
    });
  cameras.forEach((camera) => {
    const frames = tracks[camera.id];
    if (frames && frames.length > 0 && !trackList.some((item) => item.trackKey === camera.id)) {
      trackList.push({ trackKey: camera.id, name: camera.name, kind: "机位", frames });
    }
  });

  // 当前选中的轨道（供右栏联动编辑）：优先选中对象对应轨道，否则第一轨
  const activeTrackKey =
    (selectedObject?.kind === "camera" && selectedObject.linkedCameraId && tracks[selectedObject.linkedCameraId]
      ? selectedObject.linkedCameraId
      : selectedObjectId && tracks[selectedObjectId]
        ? selectedObjectId
        : null) ?? trackList[0]?.trackKey ?? null;
  // 每像素秒数：始终让时间轴铺满容器、右端固定 = 总时长
  const PIXELS_PER_SECOND = Math.max(24, editorWidth > 0 ? editorWidth / Math.max(duration, 0.1) : 64);

  function handleDurationBlur() {
    const next = Number(durationDraft);
    setTimelineDuration(Number.isFinite(next) ? next : duration);
    setDurationDraft(String(Number.isFinite(next) ? next : duration));
  }

  function handleFpsBlur() {
    const next = Number(fpsDraft);
    setTimelineFps(Number.isFinite(next) ? next : fps);
    setFpsDraft(String(Number.isFinite(next) ? next : fps));
  }

  function handleTogglePlay() {
    togglePlay();
  }

  function handleJumpStart() {
    pause();
    setCurrentTime(0);
  }

  function handleJumpEnd() {
    pause();
    setCurrentTime(duration);
  }

  /** 按指针 X 换算播放头时间 */
  function seekFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const time = Math.min(duration, Math.max(0, (event.clientX - rect.left) / PIXELS_PER_SECOND));
    setCurrentTime(time);
  }

  /** 点按 / 拖动标尺轨道 → 定位播放头（不自动播放） */
  function handleSeekDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    seekFromEvent(event);
  }

  function handleSeekMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRef.current) seekFromEvent(event);
  }

  function handleSeekUp() {
    draggingRef.current = false;
  }

  /** 关键帧菱块拖动：按下记录起点，移动实时预览，松开提交新时间 */
  function handleKfDown(event: ReactPointerEvent<HTMLSpanElement>, trackKey: string, frame: { id: string; time: number }) {
    event.stopPropagation();
    draggingRef.current = false;
    setDraggingFrame({ trackKey, id: frame.id, offsetX: event.clientX, baseTime: frame.time });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleKfMove(event: ReactPointerEvent<HTMLSpanElement>, frame: { id: string }) {
    if (!draggingFrame || draggingFrame.id !== frame.id) return;
    const dx = event.clientX - draggingFrame.offsetX;
    const time = Math.max(0, Math.min(duration, draggingFrame.baseTime + dx / PIXELS_PER_SECOND));
    setDragTimeById((current) => ({ ...current, [frame.id]: time }));
  }

  function handleKfUp(event: ReactPointerEvent<HTMLSpanElement>, trackKey: string, frame: { id: string; time: number }) {
    if (!draggingFrame || draggingFrame.id !== frame.id || draggingFrame.trackKey !== trackKey) return;
    const time = dragTimeById?.[frame.id] ?? frame.time;
    setDraggingFrame(null);
    setDragTimeById({});
    if (Math.abs(time - frame.time) > 0.0001) {
      updateKeyframe(trackKey, frame.id, { time });
    }
    pause();
  }

  /** 点击关键帧 → 选中（用于删除），记录所属轨道 */
  function handleKfClick(event: ReactMouseEvent<HTMLSpanElement>, trackKey: string, frame: { id: string }) {
    event.stopPropagation();
    setSelectedKf((current) => (current && current.trackKey === trackKey && current.id === frame.id ? null : { trackKey, id: frame.id }));
  }

  /** 删除当前选中的关键帧 */
  function deleteSelectedKeyframe() {
    if (!selectedKf) return;
    removeKeyframe(selectedKf.trackKey, selectedKf.id);
    setSelectedKf(null);
  }

  // 选中关键帧后，按 Delete / Backspace 删除
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedKf) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedKeyframe();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKf]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    setExportProgress(0);
    try {
      const resolution = exportDraft.resolution === "1080p" ? "1920x1080" : "1280x720";
      await exportAnimation({
        fps: Number(exportDraft.fps) || 30,
        width: Number(resolution.split("x")[0]) || 1280,
        height: Number(resolution.split("x")[1]) || 720,
        view: exportDraft.view,
        format: (exportDraft.fps === "60" ? "webm" : "mp4") as AnimationExportFormat,
        onProgress: setExportProgress,
      });
      setExportProgress(1);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animation-module" aria-label="动画模块">
      <div className="animation-module-body">
        <div className="animation-module-content">
          <div className="timeline-transport">
            <button
              aria-label="回到开头"
              className="timeline-transport-button"
              type="button"
              onClick={handleJumpStart}
            >
              <Rewind aria-hidden="true" size={15} strokeWidth={1.9} />
            </button>
            <button
              aria-label={isPlaying ? "暂停" : "播放"}
              className="timeline-transport-button timeline-play"
              type="button"
              onClick={handleTogglePlay}
            >
              {isPlaying ? <Pause aria-hidden="true" size={16} strokeWidth={2} /> : <Play aria-hidden="true" size={16} strokeWidth={2} />}
            </button>
            <button
              aria-label="跳到结尾"
              className="timeline-transport-button"
              type="button"
              onClick={handleJumpEnd}
            >
              <SkipForward aria-hidden="true" size={15} strokeWidth={1.9} />
            </button>
            <label className="timeline-readout" title="当前时间（秒）">
              <input
                aria-label="当前时间（秒）"
                max={Math.max(duration, 0)}
                min={0}
                step={0.01}
                type="number"
                value={Number(currentTime.toFixed(2))}
                onChange={(event) => {
                  pause();
                  setCurrentTime(Math.max(0, Math.min(duration, Number(event.currentTarget.value) || 0)));
                }}
              />
            </label>

            <label className="timeline-duration-inline" title="总时长（秒）">
              <span>总时长</span>
              <input
                min={0.1}
                step={0.1}
                type="number"
                value={Math.round((durationDraft === "" ? 0 : Number(durationDraft) || duration) * 100) / 100}
                onChange={(event) => setDurationDraft(event.currentTarget.value)}
                onBlur={handleDurationBlur}
              />
            </label>
            <label className="timeline-duration-inline" title="帧率（fps）">
              <span>帧率</span>
              <input
                max={TIMELINE_MAX_FPS}
                min={TIMELINE_MIN_FPS}
                step={1}
                type="number"
                value={fpsDraft}
                onChange={(event) => setFpsDraft(event.currentTarget.value)}
                onBlur={handleFpsBlur}
              />
            </label>

            <button
              aria-expanded={exportOpen}
              aria-label="导出视频"
              className={`timeline-transport-button timeline-export${exportOpen ? " timeline-export-active" : ""}`}
              type="button"
              title="导出动画为视频（优先 MP4，不支持时回退 WebM）"
              onClick={() => setExportOpen((current) => !current)}
            >
              <Video aria-hidden="true" size={15} strokeWidth={1.9} />
              <span>导出</span>
            </button>
            <button
              aria-label="折叠动画栏"
              className="timeline-transport-button"
              type="button"
              title="折叠动画栏（露出下方视口工具栏）"
              onClick={() => setAnimationModuleCollapsed(true)}
            >
              <ChevronDown aria-hidden="true" size={15} strokeWidth={1.9} />
            </button>
          </div>

          <div className="timeline-editor" aria-label="多轨时间轴编辑器" ref={editorRef}>
            {selectedKf ? (
              <button
                type="button"
                className="timeline-kf-delete-btn"
                aria-label="删除选中的关键帧"
                title="删除选中的关键帧（Delete）"
                onClick={deleteSelectedKeyframe}
              >
                ✕ 删除选中帧
              </button>
            ) : null}

            {trackList.length === 0 ? (
              <div className="timeline-editor-empty">暂无轨道。选中角色或机位后打关键帧。</div>
            ) : (
              <div
                className="timeline-editor-trackwrap"
                style={{ height: 20 + trackList.length * 28 + 8 }}
                onPointerDown={handleSeekDown}
                onPointerMove={handleSeekMove}
                onPointerUp={handleSeekUp}
                onPointerCancel={handleSeekUp}
              >
                {/* 标尺（顶部） */}
                <div className="timeline-editor-ruler">
                  {Array.from({ length: Math.floor(duration) + 1 }, (_, second) => {
                    const left = second * PIXELS_PER_SECOND;
                    return (
                      <span key={second} className="timeline-editor-tick" style={{ left: `${left}px` }}>
                        <span className="timeline-editor-tick-mark" />
                        <span className="timeline-editor-tick-label">{second}s</span>
                      </span>
                    );
                  })}
                </div>

                {/* 多行轨道 */}
                {trackList.map((track, rowIndex) => {
                  const rowTop = 20 + rowIndex * 28;
                  const isActiveRow = track.trackKey === activeTrackKey;
                  return (
                    <div
                      key={track.trackKey}
                      className={`timeline-editor-track-row${isActiveRow ? " is-active" : ""}`}
                      style={{ top: `${rowTop}px` }}
                      onClick={() => {
                        // 点击行 → 选中该轨道（联动右栏编辑）
                        useDirectorStore.getState().selectObject(track.trackKey);
                      }}
                    >
                      <span className="timeline-editor-track-row-name" title={track.name}>{track.name}</span>
                      <button
                        type="button"
                        className="timeline-editor-track-row-clear"
                        aria-label={`清除轨道 ${track.name}`}
                        title={`清除轨道 ${track.name}（删除全部关键帧）`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.confirm(`确定清除「${track.name}」整条轨道？`)) {
                            clearTrack(track.trackKey);
                            setSelectedKf(null);
                          }
                        }}
                      >
                        ✕
                      </button>
                      {track.frames.map((frame) => {
                        const previewTime =
                          draggingFrame?.id === frame.id && draggingFrame.trackKey === track.trackKey
                            ? (dragTimeById[frame.id] ?? frame.time)
                            : frame.time;
                        const isActive =
                          (draggingFrame?.id === frame.id && draggingFrame.trackKey === track.trackKey) ||
                          Math.abs(previewTime - currentTime) < 0.0001;
                        const isSelected = selectedKf?.trackKey === track.trackKey && selectedKf.id === frame.id;
                        return (
                          <span
                            key={frame.id}
                            className={`timeline-editor-kf${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}${draggingFrame?.id === frame.id ? " is-dragging" : ""}`}
                            style={{ left: `${previewTime * PIXELS_PER_SECOND}px` }}
                            title={`${previewTime.toFixed(2)}s（拖动可改时间，点击选中后可删除）`}
                            onPointerDown={(event) => handleKfDown(event, track.trackKey, frame)}
                            onPointerMove={(event) => handleKfMove(event, frame)}
                            onPointerUp={(event) => handleKfUp(event, track.trackKey, frame)}
                            onPointerCancel={(event) => handleKfUp(event, track.trackKey, frame)}
                            onClick={(event) => handleKfClick(event, track.trackKey, frame)}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* 播放头（贯穿所有行） */}
                <div
                  className="timeline-editor-playhead"
                  style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
                >
                  <span className="timeline-editor-playhead-cap" />
                </div>
              </div>
            )}
          </div>
        </div>

        {exportOpen ? (
          <div className="timeline-export-panel">
            <div className="timeline-export-row">
              <span className="timeline-export-label">录制视角</span>
              <div className="ui-segmented" role="group" aria-label="录制视角">
                <button
                  aria-pressed={exportDraft.view === "director"}
                  className={`ui-segmented-item${exportDraft.view === "director" ? " ui-segmented-item-active" : ""}`}
                  type="button"
                  onClick={() => setExportDraft((draft) => ({ ...draft, view: "director" }))}
                >
                  导演
                </button>
                <button
                  aria-pressed={exportDraft.view === "camera"}
                  className={`ui-segmented-item${exportDraft.view === "camera" ? " ui-segmented-item-active" : ""}`}
                  type="button"
                  onClick={() => setExportDraft((draft) => ({ ...draft, view: "camera" }))}
                >
                  相机
                </button>
              </div>
            </div>
            <div className="timeline-export-row">
              <label className="timeline-export-label" htmlFor="export-resolution">分辨率</label>
              <select id="export-resolution" className="ui-field" value={exportDraft.resolution} onChange={(event) => setExportDraft((draft) => ({ ...draft, resolution: event.currentTarget.value }))}>
                <option value="720p">1280×720 (720p)</option>
                <option value="1080p">1920×1080 (1080p)</option>
              </select>
            </div>
            <div className="timeline-export-row">
              <label className="timeline-export-label">帧率</label>
              <input
                className="ui-field timeline-export-fps"
                max={60}
                min={1}
                step={1}
                type="number"
                value={exportDraft.fps}
                onChange={(event) => setExportDraft((draft) => ({ ...draft, fps: event.currentTarget.value }))}
              />
              <span>fps</span>
            </div>
            <div className="timeline-export-row">
              <button
                className="timeline-export-start"
                disabled={exporting || !supportsExport}
                type="button"
                onClick={() => void handleExport()}
              >
                {exporting ? "导出中…" : "开始导出"}
              </button>
            </div>
            {exporting ? (
              <div className="timeline-export-progress">
                <div className="timeline-export-progress-bar" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                <span className="timeline-export-progress-text">{Math.round(exportProgress * 100)}%</span>
              </div>
            ) : null}
            {exportError ? <p className="timeline-export-error">{exportError}</p> : null}
            {!exporting && !exportError ? (
              <p className="timeline-export-hint">
                {supportsExport
                  ? "导出为视频（优先 MP4，浏览器 / VLC / 剪辑软件可直接播放）。"
                  : "当前浏览器不支持视频录制（MediaRecorder）。"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}