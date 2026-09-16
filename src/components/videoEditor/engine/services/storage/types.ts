import type { MediaType } from '@/components/videoEditor/types/assets';
import type {
  TProject,
  TProjectMetadata,
  TTimelineViewState,
} from '@/components/videoEditor/types/project';
import type { TScene } from '@/components/videoEditor/types/timeline';
export interface StorageAdapter<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * `MediaAssetData` 已**下沉到 `@/components/videoEditor/types/assets`**（TD-22-31：斩断 types→engine 反向边）。
 * 此处 re-export 是为让既有消费方（`engine/services/storage/*` 等）**零改动**。
 */
export type { MediaAssetData } from '@/components/videoEditor/types/assets';

export type SerializedScene = Omit<TScene, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedProjectMetadata = Omit<TProjectMetadata, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedProject = Omit<TProject, 'metadata' | 'scenes'> & {
  metadata: SerializedProjectMetadata;
  scenes: SerializedScene[];
  timelineViewState?: TTimelineViewState;
};

export interface StorageConfig {
  projectsDb: string;
  mediaDb: string;
  savedSoundsDb: string;
  version: number;
}

export interface ProjectStorageStats {
  projectId: string;
  projectName: string;
  mediaSize: number;
  mediaCount: number;
  byType: Partial<Record<MediaType, { size: number; count: number }>>;
}

export interface StorageStats {
  quota: number;
  usage: number;
  projects: ProjectStorageStats[];
}

// TypeScript type augmentation to add async iterator methods to FileSystemDirectoryHandle
// These methods are part of the File System Access API spec but may not be in all type definitions
declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}
