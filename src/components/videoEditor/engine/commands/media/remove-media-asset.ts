import { logger } from '@/components/videoEditor/lib/logger';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { EditorCore } from '@/components/videoEditor/engine/core';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import { videoCache } from '@/components/videoEditor/engine/services/video-cache/service';
import { collectElementsByMediaId } from '@/components/videoEditor/engine/timeline/element-utils';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';

export class RemoveMediaAssetCommand extends Command {
  private savedAssets: MediaAsset[] | null = null;
  private savedTracks: TimelineTrack[] | null = null;
  private removedAsset: MediaAsset | null = null;

  constructor(
    private projectId: string,
    private assetId: string,
  ) {
    super();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    const assets = editor.media.getAssets();

    this.savedAssets = [...assets];
    this.savedTracks = editor.timeline.getTracks();

    this.removedAsset = assets.find((media) => media.id === this.assetId) ?? null;

    if (!this.removedAsset) {
      logger.error('Media asset not found:', this.assetId);
      return;
    }

    videoCache.clearVideo({ mediaId: this.assetId });

    editor.media.setAssets({
      assets: assets.filter((media) => media.id !== this.assetId),
    });

    const elementsToRemove = collectElementsByMediaId({
      tracks: this.savedTracks,
      mediaId: this.assetId,
    });

    if (elementsToRemove.length > 0) {
      editor.timeline.deleteElements({ elements: elementsToRemove });
    }

    storageService
      .deleteMediaAsset({ projectId: this.projectId, id: this.assetId })
      .catch((error) => {
        logger.error('Failed to delete media item:', error);
      });
  }

  undo(): void {
    const editor = EditorCore.getInstance();

    if (this.savedAssets) {
      editor.media.setAssets({ assets: this.savedAssets });
    }

    if (this.savedTracks) {
      editor.timeline.updateTracks(this.savedTracks);
    }

    if (this.removedAsset) {
      storageService
        .saveMediaAsset({
          projectId: this.projectId,
          mediaAsset: this.removedAsset,
        })
        .catch((error) => {
          logger.error('Failed to restore media item on undo:', error);
        });
    }
  }
}
