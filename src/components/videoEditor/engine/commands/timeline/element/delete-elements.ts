import { reportDegrade } from '@/components/base/core/log/degrade';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import { isMainTrack, hasMediaId } from '@/components/videoEditor/engine/timeline';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import type { MediaAsset } from '@/components/videoEditor/types/assets';

export class DeleteElementsCommand extends Command {
  private savedState: TimelineTrack[] | null = null;
  private removedEphemeralAssets: MediaAsset[] = [];

  constructor(private elements: { trackId: string; elementId: string }[]) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    const deletedMediaIds = new Set<string>();
    for (const track of this.savedState) {
      for (const element of track.elements) {
        const isDeleted = this.elements.some(
          (el) => el.trackId === track.id && el.elementId === element.id,
        );
        if (isDeleted && hasMediaId(element)) {
          deletedMediaIds.add(element.mediaId);
        }
      }
    }

    const updatedTracks = this.savedState
      .map((track) => {
        const hasElementsToDelete = this.elements.some((el) => el.trackId === track.id);

        if (!hasElementsToDelete) {
          return track;
        }

        return {
          ...track,
          elements: track.elements.filter(
            (element) =>
              !this.elements.some((el) => el.trackId === track.id && el.elementId === element.id),
          ),
        } as typeof track;
      })
      .filter((track) => track.elements.length > 0 || isMainTrack(track));

    editor.timeline.updateTracks(updatedTracks);

    this.cleanupEphemeralAssets({ editor, deletedMediaIds });
  }

  private cleanupEphemeralAssets({
    editor,
    deletedMediaIds,
  }: {
    editor: EditorCore;
    deletedMediaIds: Set<string>;
  }): void {
    if (deletedMediaIds.size === 0) return;

    const projectId = editor.project.getActiveOrNull()?.metadata.id;
    if (!projectId) return;

    const assets = editor.media.getAssets();
    const ephemeralToRemove = assets.filter(
      (asset) => asset.ephemeral && deletedMediaIds.has(asset.id),
    );

    if (ephemeralToRemove.length === 0) return;

    this.removedEphemeralAssets = ephemeralToRemove;

    const remainingAssets = assets.filter(
      (asset) => !ephemeralToRemove.some((removed) => removed.id === asset.id),
    );
    editor.media.setAssets({ assets: remainingAssets });

    for (const asset of ephemeralToRemove) {
      storageService.deleteMediaAsset({ projectId, id: asset.id }).catch((error) => {
        // 【2026-09-17 TD-22-63】原只 logger：元素已删、UI 素材列表已移除（乐观），
        // 持久层删除失败 ⇒ 刷新后素材"复活"且无关联元素（假删除零提示）——
        // 与 RemoveMediaAssetCommand.execute 的同形失败同读者。
        reportDegrade({
          layer: '剪辑器·清理临时素材',
          key: asset.id,
          e: error as Error,
          toast: '临时素材清理失败，刷新后可能出现无主素材',
        });
      });
    }
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);

      if (this.removedEphemeralAssets.length > 0) {
        const assets = editor.media.getAssets();
        editor.media.setAssets({
          assets: [...assets, ...this.removedEphemeralAssets],
        });

        const projectId = editor.project.getActiveOrNull()?.metadata.id;
        if (projectId) {
          for (const asset of this.removedEphemeralAssets) {
            storageService.saveMediaAsset({ projectId, mediaAsset: asset }).catch((error) => {
              // 【2026-09-17 TD-22-63】原只 logger：撤销恢复失败 ⇒ UI 显示已恢复、刷新后消失。
              // 与 RemoveMediaAssetCommand.undo 的同形失败同读者。
              reportDegrade({
                layer: '剪辑器·撤销删除元素',
                key: asset.id,
                e: error as Error,
                toast: '撤销删除失败，关联素材刷新后可能缺失',
              });
            });
          }
        }
      }
    }
  }
}
