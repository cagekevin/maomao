import { useCallback, useMemo, useState } from 'react'
import { Box, Camera, Copy, Pause, Play, Plus, SkipBack, SkipForward, Trash2, UserRound } from 'lucide-react'
import { clamp, normalizeInterpolation, poseLabel } from '../project.js'

export function Timeline({ currentFrame, fps, totalFrames, onSeek, playing, onTogglePlay, keyframes, onAddKeyframe, onDeleteKeyframe, objectTrack, onAddObjectKeyframe, onDeleteObjectKeyframe, selectedKeyframe, onSelectKeyframe, onMoveKeyframe, onCopyKeyframe, onPasteKeyframe, onDeleteSelectedKeyframe, onChangeInterpolation, hasClipboard }) {
  const [dragging, setDragging] = useState(null)
  const rulerFrames = useMemo(() => [...new Set(Array.from({ length: 6 }, (_, index) => Math.round(totalFrames * index / 5)))], [totalFrames])
  const scrub = useCallback((event, rect) => {
    onSeek(Math.round(clamp((event.clientX - rect.left) / rect.width, 0, 1) * totalFrames))
  }, [onSeek, totalFrames])
  const onPointerDown = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    scrub(event, rect)
    // 拖动画轨道时 pointermove 每事件都会触发 onSeek（进而重算/重渲染 3D 场景）。
    // 用 rAF 把「拖动期间多次 move」合并到「每动画帧最多一次」，避免高刷屏/快速移动时
    // 一帧内连续多次 setState 造成的时间轴卡顿，拖起来更跟手。
    let raf = null
    const move = moveEvent => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        scrub(moveEvent, rect)
      })
    }
    const up = () => {
      if (raf) { cancelAnimationFrame(raf); raf = null }
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const beginKeyDrag = (event, key, kind, trackId) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.parentElement.getBoundingClientRect()
    let toFrame = key.frame
    onSeek(key.frame)
    onSelectKeyframe({ kind, frame: key.frame, trackId })
    setDragging({ kind, trackId, fromFrame: key.frame, toFrame })
    const move = moveEvent => {
      toFrame = Math.round(clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1) * totalFrames)
      setDragging({ kind, trackId, fromFrame: key.frame, toFrame })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(null)
      if (toFrame !== key.frame) onMoveKeyframe({ kind, trackId, fromFrame: key.frame, toFrame })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const renderTrack = (frames, kind, onDelete, trackId = null) => (
    <div className={`track ${kind}-track`} onPointerDown={onPointerDown}>
      <div className="track-fill" style={{ width: `${currentFrame / totalFrames * 100}%` }} />
      {!frames.length && <span className="empty-track-note">暂无关键帧</span>}
      {frames.map(key => {
        const isDragged = dragging?.kind === kind && dragging?.trackId === trackId && dragging?.fromFrame === key.frame
        const displayFrame = isDragged ? dragging.toFrame : key.frame
        const isSelected = selectedKeyframe?.kind === kind && selectedKeyframe?.trackId === trackId && selectedKeyframe?.frame === key.frame
        const stateCopy = kind === 'object' && objectTrack?.type === 'person' ? ` · ${poseLabel(key.pose)}${key.continuousMotion ? '（持续）' : ''}` : ''
        const title = `第 ${key.frame} 帧${stateCopy} · ${normalizeInterpolation(key.interpolation) === 'smooth' ? '平滑' : normalizeInterpolation(key.interpolation) === 'linear' ? '线性' : '保持'} · 拖动可移动`
        return <button key={key.frame} className={`keyframe ${kind} ${key.frame === currentFrame ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}`} data-interpolation={normalizeInterpolation(key.interpolation)} style={{ left: `${displayFrame / totalFrames * 100}%` }} title={title} aria-label={title} onPointerDown={event => beginKeyDrag(event, key, kind, trackId)} onDoubleClick={event => { event.stopPropagation(); onDelete(key.frame); onSelectKeyframe(null) }} />
      })}
      <div className="playhead" style={{ left: `${currentFrame / totalFrames * 100}%` }}><i /></div>
    </div>
  )
  return (
    <section className="timeline panel">
      <div className="timeline-key-toolbar">
        {selectedKeyframe && (
          <>
            <span className="timeline-key-toolbar-label">{selectedKeyframe.kind === 'camera' ? '镜头' : objectTrack?.type === 'person' ? '角色状态' : '物体'} · {selectedKeyframe.frame} 帧</span>
            <select value={selectedKeyframe.interpolation} onChange={event => onChangeInterpolation(event.target.value)} title="插值方式">
              <option value="smooth">平滑</option>
              <option value="linear">线性</option>
              <option value="hold">保持</option>
            </select>
            <span className="timeline-key-toolbar-divider" />
          </>
        )}
        <button className="timeline-toolbar-skip" onClick={() => onSeek(0)} title="回到开头"><SkipBack size={13} /></button>
        <button className={`play-button timeline-toolbar-play ${playing ? 'is-playing' : ''}`} onClick={onTogglePlay}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
        <button className="timeline-toolbar-skip" onClick={() => onSeek(totalFrames)} title="跳到结尾"><SkipForward size={13} /></button>
        {selectedKeyframe && (
          <>
            <span className="timeline-key-toolbar-divider" />
            <button onClick={onCopyKeyframe} title="复制关键帧"><Copy size={12} /></button>
            <button onClick={onPasteKeyframe} disabled={!hasClipboard} title="粘贴到当前帧"><Plus size={12} /></button>
            <button onClick={onDeleteSelectedKeyframe} title="删除关键帧"><Trash2 size={12} /></button>
          </>
        )}
      </div>
      <div className="timeline-body">
        <div className="ruler timeline-ruler">{rulerFrames.map(frame => <span key={frame} style={{ left: `${frame / totalFrames * 100}%` }}>{frame}</span>)}</div>
        <div className="timeline-readout"><span>{String(currentFrame).padStart(3, '0')} / {totalFrames} 帧 · {fps} FPS</span></div>
        <div className="track-label camera-track-label"><Camera size={13} /><span>主摄像机</span></div>
        <div className="camera-track-slot">{renderTrack(keyframes, 'camera', onDeleteKeyframe)}</div>
        <button className="keyframe-button camera-keyframe-button" onClick={onAddKeyframe}><Plus size={13} /> 镜头关键帧</button>
        {objectTrack && (
          <>
            <div className="track-label object-track-label">{objectTrack.type === 'person' ? <UserRound size={13} /> : <Box size={13} />}<span>{objectTrack.name}</span></div>
            <div className="object-track-slot">{renderTrack(objectTrack.keyframes, 'object', onDeleteObjectKeyframe, objectTrack.id)}</div>
            <button className="keyframe-button object-keyframe-button" onClick={onAddObjectKeyframe}><Plus size={13} /> {objectTrack.type === 'person' ? '角色状态关键帧' : '物体关键帧'}</button>
          </>
        )}
      </div>
    </section>
  )
}
