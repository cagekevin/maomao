import { logger } from '@/components/videoEditor/lib/logger';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import type {
  AddMediaAssetOutcome,
  LoadProjectMediaOutcome,
  MediaAsset,
} from '@/components/videoEditor/types/assets';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { videoCache } from '@/components/videoEditor/engine/services/video-cache/service';
import { collectElementsByMediaId } from '@/components/videoEditor/engine/timeline/element-utils';
import { toast } from '@/components/videoEditor/lib/toast';
import { reportDegrade } from '@/components/base/core/degrade.ts';

/**
 * 释放素材的运行期 URL（`blob:` objectURL）。
 *
 * 【TD-22-52 收口】只 revoke `url` —— 原三处（移除单素材 / 清空工程媒体 / 重载媒体）各抄了一遍，
 * 且**都多 revoke 了 `thumbnailUrl`**：它是 **dataURL**（canvas 绘制 / `<video>` 抽帧产物），
 * 而 `URL.revokeObjectURL` 只对 `blob:` 生效 ⇒ 那三行是**无效操作**（看着像在回收，实际什么也没做）。
 * 收口为一处，三处调用点共用，避免再各写一遍。
 */
function releaseAssetObjectUrls(asset: MediaAsset): void {
  if (asset.url) URL.revokeObjectURL(asset.url);
}

export class MediaManager {
  private assets: MediaAsset[] = [];
  private isLoading = false;
  /** 上次加载失败的原因（`null` = 无失败）。持续状态 → 由素材面板渲染错误态（非 toast，见 TD-22-43）。 */
  private loadError: string | null = null;
  /**
   * 加载请求序号：只有**最新一次**请求允许写回 `assets`。
   * 原实现无重入守卫（`isLoading` 只写不判）→ 快速切工程时「先发起、后完成」的旧加载
   * 会覆盖新工程的素材（跨工程素材串门，TD-22-43①）。
   */
  private loadToken = 0;
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

  async addMediaAsset({
    projectId,
    asset,
  }: {
    projectId: string;
    asset: Omit<MediaAsset, 'id'>;
  }): Promise<AddMediaAssetOutcome> {
    const newAsset: MediaAsset = {
      ...asset,
      id: generateUUID(),
    };

    this.assets = [...this.assets, newAsset];
    this.notify();

    try {
      // 【TD-22-52】`saveMediaAsset` 落盘后**就地回填** `newAsset.persistentUrl`（见其注释）。
      // 这里只需通知订阅者重渲染 —— 网格随即从 blob: 全分辨率切到 `/files/` 服务端出小图。
      await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
      this.notify();
      return { ok: true, id: newAsset.id, asset: newAsset };
    } catch (error) {
      // ── 修复(2026-09-14 · 假成功)：保存失败必须**回滚 + 用户可见**。
      // 回滚：本地 assets 里刚加的那条要撤回，否则 UI 显示"素材在"但刷新后消失（假成功）。
      // 可见：拖入素材是用户瞬时动作 → 失败给 toast（与 409 提示同reader）。
      this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
      this.notify();
      logger.error('Failed to save media asset:', error);
      const message = error instanceof Error ? error.message : '本地服务可能未启动，素材未能落盘。';
      toast.error('素材保存失败', {
        description: message,
        duration: 8000,
      });
      // ── 修复(2026-09-15 · TD-22-37)：原此处仍 `return newAsset.id` ——
      // 调用方拿到一个**不存在的素材 id**，只能二次探测（drag-drop）或直接插幽灵片段（TTS）。
      return { ok: false, reason: 'save-failed', message };
    }
  }

  async removeMediaAsset({ projectId, id }: { projectId: string; id: string }): Promise<void> {
    const asset = this.assets.find((asset) => asset.id === id);

    videoCache.clearVideo({ mediaId: id });

    if (asset) releaseAssetObjectUrls(asset);

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
      // ── 失败可见性(2026-09-15 · 同母体「结果契约/失败读者」)：原本只记 logger ——
      // 内存与 UI 已移除、持久层还在 → 刷新后素材"复活"（用户看到的是**假删除**，且零提示）。
      logger.error('Failed to delete media asset:', error);
      toast.error('素材删除失败', {
        description: error instanceof Error ? error.message : '本地服务可能未启动，素材未能删除。',
        duration: 8000,
      });
    }
  }

  async loadProjectMedia({ projectId }: { projectId: string }): Promise<LoadProjectMediaOutcome> {
    const token = ++this.loadToken;
    this.isLoading = true;
    this.loadError = null;
    this.notify();

    try {
      const {
        items: mediaAssets,
        missing,
        shapeError,
      } = await storageService.loadAllMediaAssets({
        projectId,
      });
      // 已被更新的加载取代 → 丢弃本次结果（防旧请求覆盖新工程素材，TD-22-43①）。
      if (token !== this.loadToken) return { ok: false, reason: 'superseded' };
      this.assets = mediaAssets;
      this.loadError = null;
      this.notify();
      // 【2026-09-17 TD-16-27】在册但读不出的素材必须可见：`loadAllMediaAssets` 不再静默丢项，
      // 这里留痕并把 `missing` 交给调用方（素材数变少而零解释 = 用户困惑的真正来源）。
      // 【2026-09-17 裁定：消费者只转发】`missing`（少了几条）与 `shapeError`（**整表读坏**）都来自
      // storage 层（生产者）—— 这里只**转发**：留痕给开发者，并把事实原样带进返回结构，
      // 由最终呈现层决定怎么告诉用户。**不在此自行解释/编文案**。
      if (missing.length > 0 || shapeError) {
        logger.warn('工程素材读取不完整（未计入列表）', { projectId, missing, shapeError });
      }
      return { ok: true, missing, shapeError };
    } catch (error) {
      if (token !== this.loadToken) return { ok: false, reason: 'superseded' };
      logger.error('Failed to load media assets:', error);
      // ── 修复(2026-09-15 · TD-22-43②)：失败原来只记 logger → 用户看到**静默空面板**
      // （以为"这个工程没素材"）。持续状态给对读者 = 面板错误态（读 getLoadError），不是 toast。
      const message = error instanceof Error ? error.message : '素材加载失败';
      this.loadError = message;
      this.notify();
      return { ok: false, reason: 'load-failed', message };
    } finally {
      // 只在「本次仍是最新请求」时复位加载态 —— 被取代的请求不该动新请求的 isLoading。
      if (token === this.loadToken) {
        this.isLoading = false;
        this.notify();
      }
    }
  }

  async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    this.assets.forEach(releaseAssetObjectUrls);

    const mediaIds = this.assets.map((asset) => asset.id);
    this.assets = [];
    this.notify();

    try {
      await Promise.all(mediaIds.map((id) => storageService.deleteMediaAsset({ projectId, id })));
    } catch (error) {
      // 【2026-09-17 TD-22-63】原实现**只 logger**：内存与 UI 已清空，持久层却还留着 ——
      // 用户看到"素材清空了"，刷新后**全部复活**（假清空，且零提示）。破坏性操作失败必须让用户知道。
      // 走 `reportDegrade`（一次搞定"开发者留痕 + 用户 toast"），与同文件 `removeMediaAsset` 同读者。
      reportDegrade({
        layer: '剪辑器·清空工程素材',
        key: projectId,
        e: error as Error,
        toast: '素材清空失败，刷新后可能仍在，请重试',
      });
    }
  }

  clearAllAssets(): void {
    videoCache.clearAll();
    // 作废在途加载（它完成时不得再把旧工程的素材写回，TD-22-43①）。
    this.loadToken += 1;
    this.loadError = null;

    this.assets.forEach(releaseAssetObjectUrls);

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

  /** 上次素材加载的失败原因；`null` = 无失败（TD-22-43② 的错误态真源）。 */
  getLoadError(): string | null {
    return this.loadError;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
