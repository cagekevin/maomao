import { logger } from '@videoEditor/lib/logger';
import type { EditorCore } from '@videoEditor/engine/core';
import type { MediaAsset } from '@videoEditor/types/assets';
import { storageService } from '@videoEditor/engine/services/storage/service';
import { generateUUID } from '@videoEditor/utils/id';
import { videoCache } from '@videoEditor/engine/services/video-cache/service';
import { collectElementsByMediaId } from '@videoEditor/engine/timeline/element-utils';
import { toast } from '@videoEditor/lib/toast';

export class MediaManager {
  private assets: MediaAsset[] = [];
  private isLoading = false;
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

  async addMediaAsset({
    projectId,
    asset,
  }: {
    projectId: string;
    asset: Omit<MediaAsset, 'id'>;
  }): Promise<string> {
    const newAsset: MediaAsset = {
      ...asset,
      id: generateUUID(),
    };

    this.assets = [...this.assets, newAsset];
    this.notify();

    try {
      await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
    } catch (error) {
      // ── 修复(2026-09-14 · 假成功)：保存失败必须**回滚 + 用户可见**。
      // 回滚：本地 assets 里刚加的那条要撤回，否则 UI 显示"素材在"但刷新后消失（假成功）。
      // 可见：拖入素材是用户瞬时动作 → 失败给 toast（与 409 提示同reader）。
      this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
      this.notify();
      logger.error('Failed to save media asset:', error);
      toast.error('素材保存失败', {
        description: error instanceof Error ? error.message : '本地服务可能未启动，素材未能落盘。',
        duration: 8000,
      });
    }

    return newAsset.id;
  }

  async removeMediaAsset({ projectId, id }: { projectId: string; id: string }): Promise<void> {
    const asset = this.assets.find((asset) => asset.id === id);

    videoCache.clearVideo({ mediaId: id });

    if (asset?.url) {
      URL.revokeObjectURL(asset.url);
      if (asset.thumbnailUrl) {
        URL.revokeObjectURL(asset.thumbnailUrl);
      }
    }

    this.assets = this.assets.filter((asset) => asset.id !== id);
    this.notify();

    const elementsToRemove = collectElementsByMediaId({
      tracks: this.editor.timeline.getTracks(),
      mediaId: id,
    });

    if (elementsToRemove.length > 0) {
      this.editor.timeline.deleteElements({ elements: elementsToRemove });
    }

    try {
      await storageService.deleteMediaAsset({ projectId, id });
    } catch (error) {
      logger.error('Failed to delete media asset:', error);
    }
  }

  async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    this.isLoading = true;
    this.notify();

    try {
      const mediaAssets = await storageService.loadAllMediaAssets({
        projectId,
      });
      this.assets = mediaAssets;
      this.notify();
    } catch (error) {
      logger.error('Failed to load media assets:', error);
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    this.assets.forEach((asset) => {
      if (asset.url) {
        URL.revokeObjectURL(asset.url);
      }
      if (asset.thumbnailUrl) {
        URL.revokeObjectURL(asset.thumbnailUrl);
      }
    });

    const mediaIds = this.assets.map((asset) => asset.id);
    this.assets = [];
    this.notify();

    try {
      await Promise.all(mediaIds.map((id) => storageService.deleteMediaAsset({ projectId, id })));
    } catch (error) {
      logger.error('Failed to clear media assets from storage:', error);
    }
  }

  clearAllAssets(): void {
    videoCache.clearAll();

    this.assets.forEach((asset) => {
      if (asset.url) {
        URL.revokeObjectURL(asset.url);
      }
      if (asset.thumbnailUrl) {
        URL.revokeObjectURL(asset.thumbnailUrl);
      }
    });

    this.assets = [];
    this.notify();
  }

  getAssets(): MediaAsset[] {
    return this.assets;
  }

  setAssets({ assets }: { assets: MediaAsset[] }): void {
    this.assets = assets;
    this.notify();
  }

  isLoadingMedia(): boolean {
    return this.isLoading;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
