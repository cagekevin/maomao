// ============================================================
// Nomi 时间轴预览（假数据版）
// 目的：先让你看到 Nomi TrajectoryTimeline 的真实效果。
// 用假轨迹/绑定/组数据喂给 runtime store，驱动 TrajectoryTimeline 显示。
// 数据后期再接入你的 DirectorProject。
// ============================================================
import React from 'react'
import './nomi-tokens.css'
import { useScene3DTrajectoryRuntimeStore, setScene3DTrajectorySnapshot, setScene3DPlayheadSeconds } from './trajectory/trajectoryRuntimeStore'
import { TrajectoryTimeline } from './trajectory/TrajectoryTimeline'

// 假数据：两条轨迹 + 绑定 + 一组
function buildFakeData() {
  const colors = ['#3b82f6', '#ef4444', '#22c55e']
  const trajectories = Array.from({ length: 3 }, (_, i) => ({
    id: `traj-${i + 1}`,
    name: ['主线运镜', '角色走位', '环绕机位'][i],
    points: Array.from({ length: 4 }, (_, p) => ({
      id: `traj-${i + 1}-p${p + 1}`,
      position: [p * 1.5, 0, i * 2] as [number, number, number],
      timeRatio: p / 3,
    })),
    curveControls: undefined,
    tension: 0.5,
    closed: false,
    color: colors[i],
  }))

  const trajectoryBindings = [
    {
      id: 'binding-1',
      trajectoryId: 'traj-1',
      objects: [{ objectId: 'camera-1', offsetRatio: 0 }],
      startTime: 0,
      endTime: 4,
      direction: 'forward' as const,
    },
    {
      id: 'binding-2',
      trajectoryId: 'traj-2',
      objects: [{ objectId: 'char-1', offsetRatio: 0.1 }],
      startTime: 1,
      endTime: 5,
      direction: 'forward' as const,
    },
    {
      id: 'binding-3',
      trajectoryId: 'traj-3',
      objects: [{ objectId: 'camera-2', offsetRatio: 0 }],
      startTime: 2,
      endTime: 7,
      direction: 'reverse' as const,
    },
  ]

  const trajectoryGroups = [
    { id: 'group-1', name: '运镜', trajectoryIds: ['traj-1', 'traj-3'] },
  ]

  return { trajectories, trajectoryBindings, trajectoryGroups, sceneTimeline: { totalDuration: 8 } }
}

export function NomiTimelinePreview() {
  const [visible, setVisible] = React.useState(true)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>('group-1')
  const playheadRef = React.useRef(0)

  // 挂载时塞假数据
  React.useEffect(() => {
    setScene3DTrajectorySnapshot(buildFakeData())
  }, [])

  // 播放推进：rAF 驱动播放头
  React.useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = (now - last) / 1000
      last = now
      const duration = useScene3DTrajectoryRuntimeStore.getState().sceneTimeline.totalDuration
      playheadRef.current += dt
      if (playheadRef.current >= duration) playheadRef.current = 0
      setScene3DPlayheadSeconds(playheadRef.current)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  return (
    <TrajectoryTimeline
      visible={visible}
      isPlaying={isPlaying}
      readOnly={false}
      activeGroupId={activeGroupId}
      playheadRef={playheadRef}
      onPlayChange={setIsPlaying}
      onSelectGroup={setActiveGroupId}
      onSelectTrajectory={() => {}}
      onClose={() => setVisible(false)}
      onAddGroup={() => {}}
      onRenameGroup={() => {}}
      onPatchBinding={() => {}}
      onCommitTimeline={() => {}}
      onPatchTrajectoryPoint={() => {}}
    />
  )
}
