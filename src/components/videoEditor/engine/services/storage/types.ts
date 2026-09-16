import type {
  TProject,
  TProjectMetadata,
  TTimelineViewState,
} from '@/components/videoEditor/types/project';
import type { TScene } from '@/components/videoEditor/types/timeline';
// 【2026-09-16 · TD-02-35 已删】原 `StorageAdapter<T>` 接口 —— 唯二实现者
// （IndexedDBAdapter / OPFSAdapter）已随载体收口删除，接口随之零消费者。

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

// 【2026-09-16 · TD-02-35 已删】原 `StorageConfig`（projectsDb/mediaDb/savedSoundsDb/version ——
// 全部是 IndexedDB 库名与版本号，已无载体使用）、`ProjectStorageStats` / `StorageStats`
// （只服务幽灵 API `getDetailedStorageStats`）、以及 `FileSystemDirectoryHandle` 的
// async-iterator 类型增强（只服务已删的 OPFSAdapter）。
