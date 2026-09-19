import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { reportDegrade } from '@/components/base/core/log/degrade';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
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
    const editor = getEditor();
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
        // 【2026-09-17 TD-22-63】原只 logger：本命令的保存路径走 **redo**（首跳 skipNextSave，
        // 见 execute 内分支）—— redo 落盘失败 ⇒ UI 显示素材在、刷新后消失（假成功零提示）。
        // 破坏性/落盘操作失败必须让用户知道（与 media-manager.addMediaAsset 的 catch 同读者）。
        reportDegrade({
          layer: '剪辑器·素材落盘',
          key: this.assetId,
          e: error as Error,
          toast: '素材落盘失败，刷新后可能消失，请重试',
        });
      });
  }

  undo(): void {
    if (!this.createdAsset) return;

    const editor = getEditor();
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
        videoEditorLogger.error('Failed to delete media item on undo:', error);
      });
  }

  getAssetId(): string {
    return this.assetId;
  }
}
