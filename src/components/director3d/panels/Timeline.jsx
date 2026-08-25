import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Camera, Copy, Magnet, Pause, Play, Plus, SkipBack, SkipForward, Trash2, UserRound } from 'lucide-react'
import { clamp, normalizeInterpolation, poseLabel } from '../project.js'

// 时间轴水平缩放（每帧像素）与吸附（整数帧/播放头）的默认/边界
const PX_PER_FRAME_DEFAULT = 6
const PX_PER_FRAME_MAX = 40
const PX_PER_FRAME_HARD_MIN = 0.2 // 下限兜底；实际滑块最小值 = 可视宽度/总帧数（拖到最左即全片可见）
const MARQUEE_THRESHOLD = 4 // 空白按下后拖动超过该像素才视为框选（否则视为 seek 移动播放头）
const SNAP_PLAYHEAD_RADIUS = 3 // 吸附开启时，关键帧拖动到播放头 ±3 帧内吸附到播放头

// 关键帧右键菜单：插值（不常用操作下沉到右键）+ 删除（也可用 Delete 键）。
export function Timeline({ currentFrame, fps, totalFrames, onSeek, playing, onTogglePlay, keyframes, onAddKeyframe, onDeleteKeyframe, objectTrack, onAddObjectKeyframe, onDeleteObjectKeyframe, selectedKeyframe, onSelectKeyframe, onMoveKeyframe, onMoveKeyframes, onDeleteSelectedKeyframe, onDeleteKeyframes, onCopyKeyframe, onChangeInterpolationAt }) {
  const [pxPerFrame, setPxPerFrame] = useState(PX_PER_FRAME_DEFAULT)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [dragging, setDragging] = useState(null) // {kind, trackId, fromFrame, toFrame}
  const [selection, setSelection] = useState([]) // [{kind, trackId, frame}] 框选/多选集合
  const [marquee, setMarquee] = useState(null) // {x0,y0,x1,y1} 相对轨道内部像素
  // 标尺与轨道共用同一个横向滚动容器（.timeline-scroll），天然共享滚动位置与内容宽度，刻度精确对齐轨道
  const scrollRef = useRef(null)

  const contentWidth = Math.max(1, totalFrames * pxPerFrame)

  // 缩放滑块最小值 = 可视宽度 / 总帧数：拖到最左即「适应窗口」——整段内容（如 15 秒全部）无需滚动即可见。
  // 可视宽度随容器 resize 更新；minPxPerFrame 变化时把当前缩放夹到有效区间。
  const [viewportWidth, setViewportWidth] = useState(0)
  useEffect(() => {
    const measure = () => { if (scrollRef.current) setViewportWidth(scrollRef.current.clientWidth) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const minPxPerFrame = Math.max(PX_PER_FRAME_HARD_MIN, viewportWidth / Math.max(1, totalFrames))
  useEffect(() => {
    setPxPerFrame(value => clamp(value, minPxPerFrame, PX_PER_FRAME_MAX))
  }, [minPxPerFrame])

  // 标尺刻度步长随缩放自适应（保证刻度间距约 60-100px，不会糊成一团）
  const rulerStep = useMemo(() => {
    if (pxPerFrame >= 20) return 1
    if (pxPerFrame >= 10) return 2
    if (pxPerFrame >= 5) return 4
    if (pxPerFrame >= 3) return 8
    if (pxPerFrame >= 1.8) return 16
    return 24
  }, [pxPerFrame])
  const rulerFrames = useMemo(() => {
    const list = []
    for (let frame = 0; frame <= totalFrames; frame += rulerStep) list.push(frame)
    if (list.at(-1) !== totalFrames) list.push(totalFrames)
    return list
  }, [rulerStep, totalFrames])

  // 吸附：开启时吸附到整数帧，且靠近播放头（±3 帧）时吸附到播放头
  const snapFrame = useCallback(frame => {
    const rounded = Math.round(frame)
    if (!snapEnabled) return clamp(rounded, 0, totalFrames)
    const towardPlayhead = Math.abs(rounded - currentFrame) <= SNAP_PLAYHEAD_RADIUS ? currentFrame : rounded
    return clamp(towardPlayhead, 0, totalFrames)
  }, [currentFrame, snapEnabled, totalFrames])

  // Ctrl+滚轮缩放：React onWheel 是 passive（preventDefault 无效），需原生 non-passive 监听阻止页面缩放
  const bodyRef = useRef(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return undefined
    const onWheel = event => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setPxPerFrame(value => clamp(value * (event.deltaY < 0 ? 1.1 : 1 / 1.1), minPxPerFrame, PX_PER_FRAME_MAX))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPxPerFrame])

  // 单条轨道内所有关键帧（框选命中用）：相机轨 / 对象轨
  const allTrackFrames = (kind, trackId) => kind === 'camera'
    ? keyframes.map(key => ({ kind: 'camera', trackId: null, frame: key.frame }))
    : (objectTrack?.keyframes || []).map(key => ({ kind: 'object', trackId, frame: key.frame }))

  // 单击/拖动轨道空白：拖动超阈值 → 框选该轨道关键帧；否则移动播放头（seek）
  const beginTrackScrub = (kind, trackId) => event => {
    if (event.button !== 0) return
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const x0 = event.clientX - rect.left
    const y0 = event.clientY - rect.top
    let dragged = false
    setMarquee(null)
    const move = moveEvent => {
      const x = moveEvent.clientX - rect.left
      const y = moveEvent.clientY - rect.top
      if (!dragged && Math.hypot(x - x0, y - y0) > MARQUEE_THRESHOLD) dragged = true
      if (dragged) setMarquee({ x0, y0, x1: x, y1: y })
    }
    const up = upEvent => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (dragged) {
        setMarquee(null)
        // 命中：该轨道内关键帧中心 x 落在选框内（框在当前轨道内拖，y 恒在轨道范围）
        const left = Math.min(x0, upEvent.clientX - rect.left)
        const right = Math.max(x0, upEvent.clientX - rect.left)
        const hit = allTrackFrames(kind, trackId).filter(item => {
          const x = item.frame * pxPerFrame
          return x >= left && x <= right
        })
        setSelection(hit)
        if (hit.length) onSelectKeyframe(null)
      } else {
        // 未拖动：视为点击轨道空白，seek 到点击处，并取消关键帧选择
        onSeek(clamp(Math.round((event.clientX - rect.left) / pxPerFrame), 0, totalFrames))
        onSelectKeyframe(null)
        setSelection([])
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 播放头拖动 seek：按住竖线（或顶部菱形把手）左右拖动实时移动播放头（rAF 节流避免高频 setState 卡顿）
  const beginPlayheadDrag = event => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.parentElement.getBoundingClientRect() // .track
    const frameAt = clientX => clamp(Math.round((clientX - rect.left) / pxPerFrame), 0, totalFrames)
    let raf = null
    const seekTo = clientX => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        onSeek(frameAt(clientX))
      })
    }
    seekTo(event.clientX)
    const move = moveEvent => seekTo(moveEvent.clientX)
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
    const isSelected = selection.some(item => item.kind === kind && item.trackId === trackId && item.frame === key.frame)
    const group = isSelected && selection.length > 1
      ? selection.filter(item => item.kind === kind && item.trackId === trackId)
      : null
    // 选中：单选替换，多选时点选中的帧保持整组（按住元键可加减选）
    if (event.shiftKey || event.metaKey) {
      setSelection(list => toggleFrameSelection(list, { kind, trackId, frame: key.frame }))
    } else if (!isSelected) {
      setSelection([{ kind, trackId, frame: key.frame }])
    }
    let toFrame = key.frame
    const downX = event.clientX
    const downY = event.clientY
    onSeek(key.frame)
    onSelectKeyframe({ kind, frame: key.frame, trackId })
    setDragging({ kind, trackId, fromFrame: key.frame, toFrame })
    const move = moveEvent => {
      toFrame = snapFrame((moveEvent.clientX - rect.left) / pxPerFrame)
      setDragging({ kind, trackId, fromFrame: key.frame, toFrame })
    }
    const up = upEvent => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(null)
      // 用「实际拖动位移」判定单击：位移 < 阈值 = 单击 → 仅选中（悬浮工具栏随 selectedKeyframe 出现），不移动；
      // 不能用 toFrame===key.frame（像素→帧取整有 ±1 偏差，会把点击误判成移动）
      const moved = Math.hypot(upEvent.clientX - downX, upEvent.clientY - downY) > MARQUEE_THRESHOLD
      if (!moved) return
      if (group && group.length > 1) {
        const delta = toFrame - key.frame
        onMoveKeyframes(group.map(item => ({
          kind, trackId,
          fromFrame: item.frame,
          toFrame: clamp(item.frame + delta, 0, totalFrames),
        })))
      } else {
        onMoveKeyframe({ kind, trackId, fromFrame: key.frame, toFrame })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const toggleFrameSelection = (list, item) => {
    const index = list.findIndex(candidate => candidate.kind === item.kind && candidate.trackId === item.trackId && candidate.frame === item.frame)
    if (index >= 0) return list.filter((_, i) => i !== index)
    return [...list, item]
  }

  // 删除：优先删选中集（框选/多选/右键单帧），否则走单选删除
  const handleDelete = () => {
    if (selection.length) {
      onDeleteKeyframes(selection)
      setSelection([])
      onSelectKeyframe(null)
    } else {
      onDeleteSelectedKeyframe()
    }
  }

  // Delete/Backspace 删除选中关键帧（快捷键）；输入框聚焦时不拦截
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (!selection.length && !selectedKeyframe) return
      handleDelete()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Esc 取消关键帧选择（清除悬浮工具栏与框选）
  useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Escape') return
      if (selectedKeyframe || selection.length) {
        onSelectKeyframe(null)
        setSelection([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const renderTrack = (frames, kind, onDelete, trackId = null) => (
    <div className={`track ${kind}-track`} style={{ width: contentWidth }} onPointerDown={beginTrackScrub(kind, trackId)}>
      <div className="track-fill" style={{ width: `${currentFrame * pxPerFrame}px` }} />
      {!frames.length && <span className="empty-track-note">暂无关键帧</span>}
      {frames.map(key => {
        const isDragged = dragging?.kind === kind && dragging?.trackId === trackId && dragging?.fromFrame === key.frame
        const displayFrame = isDragged ? dragging.toFrame : key.frame
        const isSelected = selection.some(item => item.kind === kind && item.trackId === trackId && item.frame === key.frame)
        const stateCopy = kind === 'object' && objectTrack?.type === 'person' ? ` · ${poseLabel(key.pose)}${key.continuousMotion ? '（持续）' : ''}` : ''
        const title = `第 ${key.frame} 帧${stateCopy} · ${normalizeInterpolation(key.interpolation) === 'smooth' ? '平滑' : normalizeInterpolation(key.interpolation) === 'linear' ? '线性' : '保持'} · 拖动可移动，单击改插值/删除`
        return <button key={key.frame} className={`keyframe ${kind} ${key.frame === currentFrame ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}`} data-interpolation={normalizeInterpolation(key.interpolation)} style={{ left: `${displayFrame * pxPerFrame}px` }} title={title} aria-label={title} onPointerDown={event => beginKeyDrag(event, key, kind, trackId)} onDoubleClick={event => { event.stopPropagation(); onDelete(key.frame); onSelectKeyframe(null) }} />
      })}
      {marquee && (
        <div className="timeline-marquee" style={{
          left: Math.min(marquee.x0, marquee.x1),
          top: Math.min(marquee.y0, marquee.y1),
          width: Math.abs(marquee.x1 - marquee.x0),
          height: Math.abs(marquee.y1 - marquee.y0),
        }} />
      )}
      <div className="playhead" style={{ left: `${currentFrame * pxPerFrame}px` }} onPointerDown={beginPlayheadDrag}><i /></div>
    </div>
  )

  const isMulti = selection.length > 1
  return (
    <section className="timeline panel">
      {/* 悬浮工具栏：完全对齐上次提交——插值选择在播放键左侧，复制/粘贴/删除在右侧，播放键圆形居中 */}
      <div className="timeline-key-toolbar">
        {selectedKeyframe && !isMulti && (
          <>
            <span className="timeline-key-toolbar-label">{selectedKeyframe.frame} 帧</span>
            <select value={selectedKeyframe.interpolation} onChange={event => onChangeInterpolationAt(selectedKeyframe.kind, selectedKeyframe.trackId, selectedKeyframe.frame, event.target.value)} title="插值方式">
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
        {selectedKeyframe && !isMulti && (
          <>
            <span className="timeline-key-toolbar-divider" />
            <button onClick={onCopyKeyframe} title="复制关键帧"><Copy size={12} /></button>
            <button onClick={onDeleteSelectedKeyframe} title="删除关键帧"><Trash2 size={12} /></button>
          </>
        )}
        {isMulti && <span className="timeline-key-toolbar-label">已选 {selection.length} 帧</span>}
      </div>
      <div className="timeline-body" ref={bodyRef}>
        {/* 左列（第一列）：轨道标签 */}
        <div className="timeline-labels">
          <div className="timeline-align-spacer" />
          <div className="track-label camera-track-label"><Camera size={13} /><span>主摄像机</span></div>
          {objectTrack && <div className="track-label object-track-label">{objectTrack.type === 'person' ? <UserRound size={13} /> : <Box size={13} />}<span>{objectTrack.name}</span></div>}
        </div>
        {/* 中列：标尺与轨道共用同一滚动容器（刻度线与轨道关键帧/播放头天然对齐） */}
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-ruler-row">
            <div className="ruler timeline-ruler" style={{ width: contentWidth }}>{rulerFrames.map(frame => <span key={frame} style={{ left: `${frame * pxPerFrame}px` }}>{frame}</span>)}</div>
          </div>
          {renderTrack(keyframes, 'camera', onDeleteKeyframe)}
          {objectTrack && renderTrack(objectTrack.keyframes, 'object', onDeleteObjectKeyframe, objectTrack.id)}
        </div>
        {/* 右列（第三列）：吸附 + 缩放 + keyframe 按钮 */}
        <div className="timeline-actions">
          <div className="timeline-view-tools">
            <button className={`timeline-toolbar-toggle ${snapEnabled ? 'is-on' : ''}`} onClick={() => setSnapEnabled(value => !value)} title="吸附：拖动关键帧时贴齐整数帧/播放头（开/关）"><Magnet size={13} /></button>
            <input type="range" className="timeline-zoom-slider" min={minPxPerFrame} max={PX_PER_FRAME_MAX} step={0.5} value={pxPerFrame} onChange={event => setPxPerFrame(clamp(Number(event.target.value), minPxPerFrame, PX_PER_FRAME_MAX))} title="时间轴缩放" aria-label="时间轴缩放" />
          </div>
          <button className="keyframe-button camera-keyframe-button" onClick={onAddKeyframe}><Plus size={13} /> 镜头关键帧</button>
          {objectTrack && <button className="keyframe-button object-keyframe-button" onClick={onAddObjectKeyframe}><Plus size={13} /> {objectTrack.type === 'person' ? '角色状态关键帧' : '物体关键帧'}</button>}
        </div>
      </div>
    </section>
  )
}
