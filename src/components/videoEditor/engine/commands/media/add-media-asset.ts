import { logger } from '@/components/videoEditor/lib/logger';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { EditorCore } from '@/components/videoEditor/engine/core';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';

export class AddMediaAssetCommand extends Command {
  private assetId: string;
  private createdAsset: MediaAsset | null = null;
  private storageOperation = Promise.resolve();

  constructor(
    private projectId: string,
    private asset: Omit<MediaAsset, 'id'>,
    private skipNextSave = false,
  ) {
    super();
    this.assetId = generateUUID();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    if (!this.createdAsset) {
      this.createdAsset = { ...this.asset, id: this.assetId };
    }
    const createdAsset = this.createdAsset;

    editor.media.setAssets({
      assets: [...editor.media.getAssets().filter(({ id }) => id !== this.assetId), createdAsset],
    });

    if (this.skipNextSave) {
      this.skipNextSave = false;
      return;
    }

    this.storageOperation = this.storageOperation
      .then(async () => {
        // await 而不 return：`storageOperation` 的契约是 `Promise<void>`
        // （返回 { url } 会让链上的类型变成 Promise<{url}>）。持久地址由 `saveMediaAsset` 就地回填。
        await storageService.saveMediaAsset({
          projectId: this.projectId,
          mediaAsset: createdAsset,
        });
      })
      .catch((error) => {
        logger.error('Failed to save media item:', error);
      });
  }

  undo(): void {
    if (!this.createdAsset) return;

    const editor = EditorCore.getInstance();
    editor.media.setAssets({
      assets: editor.media.getAssets().filter(({ id }) => id !== this.assetId),
    });

    this.storageOperation = this.storageOperation
      .then(() =>
        storageService.deleteMediaAsset({
          projectId: this.projectId,
          id: this.assetId,
        }),
      )
      .catch((error) => {
        logger.error('Failed to delete media item on undo:', error);
      });
  }

  getAssetId(): string {
    return this.assetId;
  }
}
