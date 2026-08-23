// ============================================================
// Nomi 完整界面预览壳（假数据版）
// 用假 Scene3DState 驱动 Nomi 的顶栏/左栏/右栏/底部工具栏/时间轴。
// 中央 3D 画布暂用占位（Nomi 的 r3f 场景后续再搬）。
// 目的：先让你看到 Nomi 整套 UI 的效果。
// ============================================================
import React from 'react'
import './nomi-tokens.css'
import { Scene3DFullscreenHeader } from './Scene3DFullscreenHeader'
import { SceneObjectList } from './scene3dInspector'
import { Scene3DViewportToolPill, SceneAddToolbar } from './scene3dToolbar'
import { TrajectoryTimeline } from './trajectory/TrajectoryTimeline'
import {
  useScene3DTrajectoryRuntimeStore,
  setScene3DTrajectorySnapshot,
  setScene3DPlayheadSeconds,
} from './trajectory/trajectoryRuntimeStore'
import { useScene3DTrajectoryEditing } from './useScene3DTrajectoryEditing'
import type { Scene3DState, Scene3DSelection } from './scene3dTypes'
import type { Scene3DTaskMode } from './scene3dTaskMode'

// 假数据：一个默认 Scene3DState（含假人/灯光/相机 + 轨迹）
function buildFakeState(): Scene3DState {
  return {
    objects: [
      { id: 'obj-mannequin-1', name: '主角', type: 'mannequin', visible: true, position: [0, 1.25, 0], rotation: [0, 0, 0], scale: [2.5, 2.5, 2.5], color: '#3b82f6' },
      { id: 'obj-box-1', name: '立方体', type: 'mesh', visible: true, position: [3, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#7c8ea0', geometry: 'box' },
      { id: 'obj-light-1', name: '点光源', type: 'light', visible: true, position: [2.5, 3.5, 2.5], rotation: [0, 0, 0], scale: [1, 1, 1], lightType: 'point', lightColor: '#ffffff', lightIntensity: 2.4 },
      { id: 'obj-tree-1', name: '树木', type: 'prop', visible: true, position: [-3, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#5c9457', propKind: 'tree' },
    ],
    cameras: [
      { id: 'cam-1', name: '主相机', visible: true, position: [4, 2.4, 5], rotation: [0, 0, 0], target: [0, 1, 0], fov: 45, aspectRatio: '16:9', lensDepth: 0, near: 0.1, far: 200 },
      { id: 'cam-2', name: '特写', visible: true, position: [-3, 2, 4], rotation: [0, 0, 0], target: [0, 1, 0], fov: 60, aspectRatio: '16:9', lensDepth: 0, near: 0.1, far: 200 },
    ],
    trajectories: [
      { id: 'traj-1', name: '主线运镜', points: [
        { id: 'p1', position: [4, 2.4, 5], timeRatio: 0 },
        { id: 'p2', position: [0, 1.6, 2], timeRatio: 0.5 },
        { id: 'p3', position: [-4, 2, 0], timeRatio: 1 },
      ], tension: 0.5, closed: false, color: '#3b82f6' },
    ],
    trajectoryBindings: [
      { id: 'b1', trajectoryId: 'traj-1', objects: [{ objectId: 'cam-1', offsetRatio: 0 }], startTime: 0, endTime: 6, direction: 'forward' },
    ],
    trajectoryGroups: [],
    sceneTimeline: { totalDuration: 8 },
    environment: {
      preset: '', showGrid: true, showAxes: true, showSky: true, darkMode: true,
      backgroundColor: '#111827', panoramaRotation: 0, environmentMode: 'panorama', sphereRadius: 50,
    },
    editorCamera: { position: [5, 3, 6], target: [0, 1, 0], rotation: [0, 0, 0], mode: 'fly' },
  }
}

export function NomiUIOverlay({ onClose }: { onClose?: () => void }) {
  const [state, setState] = React.useState<Scene3DState>(buildFakeState)
  const [selection, setSelection] = React.useState<Scene3DSelection>(null)
  const [task, setTask] = React.useState<Scene3DTaskMode>('compose')
  const [refineOpen, setRefineOpen] = React.useState(true)
  const [leftOpen, setLeftOpen] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)
  const [transformMode, setTransformMode] = React.useState<'translate' | 'rotate' | 'scale'>('translate')
  const [isPlaying, setIsPlaying] = React.useState(false)
  const playheadRef = React.useRef(0)

  const trajectory = useScene3DTrajectoryEditing({ state, setState, readOnly: false })
  const { t } = { t: (k: string) => k }

  // 同步轨迹数据到运行时 store
  React.useEffect(() => {
    setScene3DTrajectorySnapshot({
      trajectories: state.trajectories,
      trajectoryBindings: state.trajectoryBindings,
      trajectoryGroups: state.trajectoryGroups,
      sceneTimeline: state.sceneTimeline,
    })
  }, [state.trajectories, state.trajectoryBindings, state.trajectoryGroups, state.sceneTimeline])

  // 播放推进
  React.useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = (now - last) / 1000
      last = now
      const duration = state.sceneTimeline.totalDuration
      playheadRef.current += dt
      if (playheadRef.current >= duration) playheadRef.current = 0
      setScene3DPlayheadSeconds(playheadRef.current)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, state.sceneTimeline.totalDuration])

  const patchObject = React.useCallback((id: string, patch: Partial<typeof state.objects[number]>) => {
    setState((s) => ({ ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  }, [])

  return (
    <div className="nomi-preview-shell" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--nomi-bg)', color: 'var(--nomi-ink)', fontFamily: 'Inter, system-ui, sans-serif', zIndex: 9999 }}>
      {/* 顶栏 */}
      <Scene3DFullscreenHeader
        nodeTitle="3D 导演台"
        task={task}
        ctaLabel={task === 'compose' ? '使用这张构图' : task === 'act' ? '开始录制' : '生成参考视频'}
        ctaTitle="任务 CTA"
        refineOpen={refineOpen}
        onTaskChange={setTask}
        onCta={() => {}}
        onToggleRefine={() => setRefineOpen((v) => !v)}
        onReplayCoach={() => {}}
        onClose={() => onClose?.()}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左栏：场景树 */}
        {leftOpen ? (
          <aside style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--nomi-line)', background: 'var(--nomi-paper)', overflow: 'auto' }}>
            <SceneObjectList
              objects={state.objects}
              cameras={state.cameras}
              selection={selection}
              readOnly={false}
              onSelect={setSelection}
              onFocus={() => {}}
              onObjectPatch={patchObject}
              onCameraPatch={(id, patch) => setState((s) => ({ ...s, cameras: s.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))}
              onDelete={() => {}}
            />
          </aside>
        ) : null}

        {/* 中央画布占位 */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, background: 'var(--nomi-ink-05)' }}>
          <Scene3DViewportToolPill
            readOnly={false}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onFitView={() => {}}
          />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--nomi-ink-40)', fontSize: 12 }}>
            3D 画布（Nomi 场景后续接入）
          </div>
          <SceneAddToolbar
            onAddObject={() => {}}
            onAddProp={() => {}}
            onAddCrowd={() => {}}
            onAddCamera={() => {}}
            onApplySceneTemplate={() => {}}
            canvasFocusMode={false}
            onToggleCanvasFocusMode={() => {}}
          />
          {/* 时间轴 */}
          <TrajectoryTimeline
            visible
            isPlaying={isPlaying}
            readOnly={false}
            activeGroupId={null}
            playheadRef={playheadRef}
            onPlayChange={setIsPlaying}
            onSelectGroup={() => {}}
            onSelectTrajectory={() => {}}
            onClose={() => {}}
            onAddGroup={() => {}}
            onRenameGroup={() => {}}
            onPatchBinding={() => {}}
            onCommitTimeline={() => {}}
            onPatchTrajectoryPoint={() => {}}
          />
        </div>
      </div>
    </div>
  )
}
