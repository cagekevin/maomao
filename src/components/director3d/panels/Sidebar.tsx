import { useState } from 'react'
import { Box, Camera, Lock, ScanLine, Sparkles, Unlock, UserRound } from 'lucide-react'
import { ShotsPanel } from './ShotsPanel.tsx'
import { CAMERA_ID } from '../project.ts'

export function SceneList({ objects, selectedId, onSelect, onToggleVisible, onToggleLock }) {
  return (
    <div className="scene-list">
      <div className={`scene-row ${selectedId === CAMERA_ID ? 'is-selected' : ''}`} onClick={() => onSelect(CAMERA_ID)}>
        <Camera size={14} className="scene-row-icon" />
        <span className="scene-row-name">主摄像机</span>
        <i className="status-dot live scene-row-trailing" />
      </div>
      {objects.map(object => (
        <div key={object.id} className={`scene-row ${selectedId === object.id ? 'is-selected' : ''}`} onClick={() => onSelect(object.id)}>
          {object.type === 'person' ? <UserRound size={14} className="scene-row-icon" /> : object.type === 'model' ? <Sparkles size={14} className="scene-row-icon" /> : object.type === 'depthMesh' ? <ScanLine size={14} className="scene-row-icon" /> : <Box size={14} className="scene-row-icon" />}
          <span className="scene-row-name">{object.name}</span>
          <span className="scene-row-actions">
            <button className="scene-row-action" title={object.locked ? '解除锁定' : '锁定物体'} onClick={event => { event.stopPropagation(); onToggleLock(object.id) }}>{object.locked ? <Lock size={11} /> : <Unlock size={11} />}</button>
            <button className="scene-row-action visibility-action" title={object.visible === false ? '显示物体' : '隐藏物体'} onClick={event => { event.stopPropagation(); onToggleVisible(object.id) }}><i className={`status-dot ${object.visible === false ? '' : 'on'}`} /></button>
          </span>
        </div>
      ))}
    </div>
  )
}

export function LeftSidebar({ objects, selectedId, onSelect, onToggleVisible, onToggleLock, shots, activeShotId, onSelectShot, onAddShot, onDuplicateShot, onDeleteShot, onRenameShot, onCaptureShot }) {
  const [tab, setTab] = useState('scene')
  return (
    <aside className="left-sidebar panel">
      <div className="panel-tabs">
        <button className={tab === 'scene' ? 'is-active' : ''} onClick={() => setTab('scene')}>场景层级</button>
        <button className={tab === 'shots' ? 'is-active' : ''} onClick={() => setTab('shots')}>镜头</button>
      </div>
      {tab === 'scene' ? (
        <SceneList objects={objects} selectedId={selectedId} onSelect={onSelect} onToggleVisible={onToggleVisible} onToggleLock={onToggleLock} />
      ) : <ShotsPanel shots={shots} activeShotId={activeShotId} onSelect={onSelectShot} onAdd={onAddShot} onDuplicate={onDuplicateShot} onDelete={onDeleteShot} onRename={onRenameShot} onCapture={onCaptureShot} />}
    </aside>
  )
}
