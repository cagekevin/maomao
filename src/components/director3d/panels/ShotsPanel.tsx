import { Camera, Copy, FileImage, Plus, Trash2 } from 'lucide-react'

/** 镜头卡片所需的最小形状（来自 normalizeShot 产出的完整 shot） */
interface ShotCard {
  id: string
  name: string
  thumbnail?: string
  fps: number
  durationSeconds: number
  keyframes?: unknown
  objectKeyframes?: Record<string, unknown>
}
interface ShotsPanelProps {
  shots: ShotCard[]
  activeShotId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string, commit?: boolean) => void
  onCapture: (id: string) => void
}

/** 统计镜头关键帧数：keyframes 兼容通道结构或旧整快照数组，objectKeyframes 按各轨道累计 */
function shotKeyframeCount(shot: ShotCard): number {
  const cameraKeys = Array.isArray(shot.keyframes)
    ? shot.keyframes.length
    : Object.values(shot.keyframes || {}).reduce<number>((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
  const objectKeys = Object.values(shot.objectKeyframes || {}).reduce<number>((sum, track) => sum + (Array.isArray(track) ? track.length : 0), 0)
  return cameraKeys + objectKeys
}

export function ShotsPanel({ shots, activeShotId, onSelect, onAdd, onDuplicate, onDelete, onRename, onCapture }: ShotsPanelProps) {
  return (
    <div className="shots-panel">
      <div className="shots-panel-head">
        <div><strong>镜头列表</strong></div>
        <button type="button" onClick={onAdd} disabled={shots.length >= 30}><Plus size={13} /> 新建镜头</button>
      </div>
      <div className="shots-list">
        {shots.map((shot, index) => {
          const active = shot.id === activeShotId
          return (
            <article className={`shot-card ${active ? 'is-active' : ''}`} key={shot.id}>
              <button type="button" className="shot-card-select" onClick={() => onSelect(shot.id)} aria-label={`切换到${shot.name}`}>
                <span className="shot-thumbnail">
                  {shot.thumbnail ? <img src={shot.thumbnail} alt={`${shot.name} 摄像机缩略图`} /> : <span><Camera size={18} /><i>等待截图</i></span>}
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  {active && <em>当前</em>}
                </span>
              </button>
              <div className="shot-card-copy">
                <div className="shot-card-copy-head">
                  <input
                    value={shot.name}
                    maxLength={30}
                    onChange={event => onRename(shot.id, event.currentTarget.value)}
                    onBlur={event => onRename(shot.id, event.target.value, true)}
                    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    aria-label={`镜头 ${index + 1} 名称`}
                  />
                  <div className="shot-card-actions">
                    <button type="button" title="更新当前镜头缩略图" aria-label="更新当前镜头缩略图" onClick={() => onCapture(shot.id)} disabled={!active}><FileImage size={12} /></button>
                    <button type="button" title="复制镜头" aria-label={`复制${shot.name}`} onClick={() => onDuplicate(shot.id)} disabled={shots.length >= 30}><Copy size={12} /></button>
                    <button type="button" title="删除镜头" aria-label={`删除${shot.name}`} onClick={() => onDelete(shot.id)} disabled={shots.length === 1}><Trash2 size={12} /></button>
                  </div>
                </div>
                <span>{shot.durationSeconds} 秒 · {shot.fps} FPS · {shotKeyframeCount(shot)} 个关键帧</span>
              </div>
            </article>
          )
        })}
      </div>
      <p className="shots-panel-note">每个镜头独立保存场景、人物骨骼、摄像机、参考图和关键帧。切换镜头前会自动更新当前缩略图。</p>
    </div>
  )
}
