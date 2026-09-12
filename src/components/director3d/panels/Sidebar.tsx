import { useState } from 'react';
import { Box, Camera, Lock, ScanLine, Sparkles, Unlock, UserRound } from 'lucide-react';
import { ShotsPanel } from './ShotsPanel.tsx';
import { CAMERA_ID, ProjectObject } from '../project.ts';

/** 场景对象在渲染侧需要的字段（ProjectObject 的索引签名不强制 locked/visible，这里显式收窄） */
interface SceneObject extends ProjectObject {
  locked?: boolean;
  visible?: boolean;
}

/** 镜头卡片摘要（与 ShotsPanel.ShotCard 同形，供左侧栏透传） */
interface ShotSummary {
  id: string;
  name: string;
  thumbnail?: string;
  fps: number;
  durationSeconds: number;
  keyframes?: unknown;
  objectKeyframes?: Record<string, unknown>;
}

interface SceneListProps {
  objects: SceneObject[];
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
}

export function SceneList({
  objects,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
}: SceneListProps) {
  return (
    <div className="scene-list">
      <div
        className={`scene-row ${selectedId === CAMERA_ID ? 'is-selected' : ''}`}
        onClick={() => onSelect(CAMERA_ID)}
      >
        <Camera size={14} className="scene-row-icon" />
        <span className="scene-row-name">主摄像机</span>
        <i className="status-dot live scene-row-trailing" />
      </div>
      {objects.map((object) => (
        <div
          key={object.id}
          className={`scene-row ${selectedId === object.id ? 'is-selected' : ''}`}
          onClick={() => onSelect(object.id)}
        >
          {object.type === 'person' ? (
            <UserRound size={14} className="scene-row-icon" />
          ) : object.type === 'model' ? (
            <Sparkles size={14} className="scene-row-icon" />
          ) : object.type === 'depthMesh' ? (
            <ScanLine size={14} className="scene-row-icon" />
          ) : (
            <Box size={14} className="scene-row-icon" />
          )}
          <span className="scene-row-name">{object.name}</span>
          <span className="scene-row-actions">
            <button
              className="scene-row-action"
              title={object.locked ? '解除锁定' : '锁定物体'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleLock(object.id);
              }}
            >
              {object.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>
            <button
              className="scene-row-action visibility-action"
              title={object.visible === false ? '显示物体' : '隐藏物体'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleVisible(object.id);
              }}
            >
              <i className={`status-dot ${object.visible === false ? '' : 'on'}`} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

interface LeftSidebarProps {
  objects: SceneObject[];
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  shots: ShotSummary[];
  activeShotId: string | null;
  onSelectShot: (id: string) => void;
  onAddShot: () => void;
  onDuplicateShot: (id: string) => void;
  onDeleteShot: (id: string) => void;
  onRenameShot: (id: string, name: string, commit?: boolean) => void;
  onCaptureShot: (id: string) => void;
}

export function LeftSidebar({
  objects,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  shots,
  activeShotId,
  onSelectShot,
  onAddShot,
  onDuplicateShot,
  onDeleteShot,
  onRenameShot,
  onCaptureShot,
}: LeftSidebarProps) {
  const [tab, setTab] = useState('scene');
  return (
    <aside className="left-sidebar panel">
      <div className="panel-tabs">
        <button className={tab === 'scene' ? 'is-active' : ''} onClick={() => setTab('scene')}>
          场景层级
        </button>
        <button className={tab === 'shots' ? 'is-active' : ''} onClick={() => setTab('shots')}>
          镜头
        </button>
      </div>
      {tab === 'scene' ? (
        <SceneList
          objects={objects}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggleVisible={onToggleVisible}
          onToggleLock={onToggleLock}
        />
      ) : (
        <ShotsPanel
          shots={shots}
          activeShotId={activeShotId}
          onSelect={onSelectShot}
          onAdd={onAddShot}
          onDuplicate={onDuplicateShot}
          onDelete={onDeleteShot}
          onRename={onRenameShot}
          onCapture={onCaptureShot}
        />
      )}
    </aside>
  );
}
