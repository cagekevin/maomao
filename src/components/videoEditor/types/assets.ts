import type { MediaAssetData } from '@videoEditor/engine/services/storage/types';

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaAsset extends Omit<MediaAssetData, 'size' | 'lastModified'> {
  file: File;
  url?: string;
}
