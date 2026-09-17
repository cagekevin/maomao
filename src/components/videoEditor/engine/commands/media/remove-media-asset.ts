import { logger } from '@/components/videoEditor/lib/logger';
import { reportDegrade } from '@/components/base/core/degrade.ts';
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

    // 【2026-09-17 TD-16-27】原实现删除失败**只 logger**：而 UI 已在上面乐观移除
    // （`editor.media.setAssets` 已过滤掉该项）⇒ 用户看到"删掉了"，刷新后素材复活（假删除）。
    // "不阻断"（乐观移除是对的，不该等 IO）≠「不可见」—— 失败必须让用户知道。
    void storageService
      .deleteMediaAsset({ projectId: this.projectId, id: this.assetId })
      .catch((error: unknown) => {
        reportDegrade({
          layer: '剪辑器·素材删除',
          key: this.assetId,
          e: error as Error,
          toast: '素材删除失败，刷新后可能仍在，请重试',
        });
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
          // 【2026-09-17 TD-22-63】原只 logger：撤销删除失败 ⇒ UI 显示素材已恢复、
          // 刷新后素材消失（假恢复零提示）。与 execute 内 deleteMediaAsset 的失败同读者
          // （reportDegrade：开发者留痕 + 用户 toast，一次搞定两者）。
          reportDegrade({
            layer: '剪辑器·撤销删除素材',
            key: this.assetId,
            e: error as Error,
            toast: '撤销删除失败，素材刷新后可能仍缺失，请重新导入',
          });
        });
    }
  }
}
