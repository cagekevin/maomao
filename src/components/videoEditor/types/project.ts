import type { TScene } from './timeline';
// 更新(2026-09-14)：AI 域已删。
type AgentMessage = unknown;

export type TBackground =
  | {
      type: 'color';
      color: string;
    }
  | {
      type: 'blur';
      blurIntensity: number;
    };

export interface TCanvasSize {
  width: number;
  height: number;
}

export interface TProjectMetadata {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TProjectSettings {
  fps: number;
  canvasSize: TCanvasSize;
  originalCanvasSize?: TCanvasSize | null;
  background: TBackground;
}

export interface TTimelineViewState {
  zoomLevel: number;
  scrollLeft: number;
  playheadTime: number;
}

export interface TProject {
  metadata: TProjectMetadata;
  scenes: TScene[];
  currentSceneId: string;
  settings: TProjectSettings;
  version: number;
  timelineViewState?: TTimelineViewState;
  agentMessages?: AgentMessage[];
}

export type TProjectSortKey = 'createdAt' | 'updatedAt' | 'name' | 'duration';
export type TSortOrder = 'asc' | 'desc';
export type TProjectSortOption = `${TProjectSortKey}-${TSortOrder}`;
