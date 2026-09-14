import type { TProject, TProjectMetadata } from '@videoEditor/types/project';
import { getProjectDurationFromScenes } from '@videoEditor/engine/lib/scenes';
import type { MediaAsset } from '@videoEditor/types/assets';
import { IndexedDBAdapter } from './indexeddb-adapter';
import { OPFSAdapter } from './opfs-adapter';
import type {
  MediaAssetData,
  StorageConfig,
  SerializedProject,
  SerializedScene,
  StorageStats,
  ProjectStorageStats,
} from './types';
// 音效域类型（2026-09-14 恢复：原误判为 AI 相关而删，实测零 AI 依赖 —— docs/133 §〇.4）。
import type { SavedSoundsData, SavedSound, SoundEffect } from '@videoEditor/types/sounds';
import { migrations, runStorageMigrations } from '@videoEditor/engine/services/storage/migrations';
import type { TimelineTrack } from '@videoEditor/types/timeline';
// ── T3（docs/134）：工程本体改走 KV 严格族 CAS（docs/133 §3.5 D-4）。
// 键构造唯一真源 = videoEditorKeys.ts（禁手拼前缀字面量，X4）。
import {
  videoEditorProjectKey,
  videoEditorProjectsKey,
  videoEditorActiveProjectKey,
} from '../../../../base/core/videoEditorKeys.ts';
import {
  contentGetAsync,
  contentKvGetVersion,
  contentKvSetCas,
  contentSetAsync,
  contentDeleteAsync,
} from '../../../../base/core/contentStore.ts';
import { HttpError } from '../../../../base/core/httpClient.ts';
import { logger } from '../../../../base/core/logger.ts';

/**
 * 工程列表条目（轻）存于 KV 列表键（videoEditorProjectsKey 构造，docs/133 §2.3）。
 * 与 docs/133 §2.3 体积修正一致：列表只存索引字段，本体另键存重 payload。
 */
export interface ProjectListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模块级编辑上下文（方案 X，docs/134 T3）：StorageService 的方法签名**保持不动**（X2，不牵动引擎），
 * 由 EditorProvider 挂载时调 `setEditorContext` 注入当前（画布 projectId, editorId）。
 * 之后键构造一律用这两个值。未设置时拒绝工程读写（fail-fast，而非落到 default 键错配）。
 */
interface EditorContext {
  canvasProjectId: string;
  editorId: string;
}
let editorContext: EditorContext | null = null;

/** 由 EditorProvider 在挂载时调用（docs/134 T5 ②）。editorId 必为 UUID（docs/133 §2.1 M-4）。 */
export function setEditorContext(ctx: EditorContext): void {
  if (!ctx.canvasProjectId || !ctx.editorId) {
    throw new Error(
      `[StorageService] setEditorContext 需要完整的 {canvasProjectId, editorId}，收到: ${JSON.stringify(ctx)}`,
    );
  }
  editorContext = ctx;
}

/** 读取并校验上下文已设置（任何工程读写前调用）。 */
function requireEditorContext(): EditorContext {
  if (!editorContext) {
    throw new Error(
      '[StorageService] 工程读写前必须先调用 setEditorContext（EditorProvider 挂载时注入）',
    );
  }
  return editorContext;
}

class StorageService {
  private savedSoundsAdapter: IndexedDBAdapter<SavedSoundsData>;
  private config: StorageConfig;
  private migrationsPromise: Promise<void> | null = null;

  constructor() {
    this.config = {
      projectsDb: 'video-editor-projects',
      mediaDb: 'video-editor-media',
      savedSoundsDb: 'video-editor-saved-sounds',
      version: 1,
    };

    this.savedSoundsAdapter = new IndexedDBAdapter<SavedSoundsData>(
      this.config.savedSoundsDb,
      'saved-sounds',
      this.config.version,
    );
  }

  private async ensureMigrations(): Promise<void> {
    if (this.migrationsPromise) {
      await this.migrationsPromise;
      return;
    }

    this.migrationsPromise = runStorageMigrations({ migrations }).then(() => undefined);
    await this.migrationsPromise;
  }

  private getProjectMediaAdapters({ projectId }: { projectId: string }) {
    const mediaMetadataAdapter = new IndexedDBAdapter<MediaAssetData>(
      `${this.config.mediaDb}-${projectId}`,
      'media-metadata',
      this.config.version,
    );

    const mediaAssetsAdapter = new OPFSAdapter(`media-files-${projectId}`);

    return { mediaMetadataAdapter, mediaAssetsAdapter };
  }

  private stripAudioBuffers({ tracks }: { tracks: TimelineTrack[] }): TimelineTrack[] {
    return tracks.map((track) => {
      if (track.type !== 'audio') return track;
      return {
        ...track,
        elements: track.elements.map((element) => {
          const { buffer: _buffer, ...rest } = element;
          return rest;
        }),
      };
    });
  }

  async saveProject({ project }: { project: TProject }): Promise<void> {
    const duration =
      project.metadata.duration ?? getProjectDurationFromScenes({ scenes: project.scenes });
    const serializedScenes: SerializedScene[] = project.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      isMain: scene.isMain,
      tracks: this.stripAudioBuffers({ tracks: scene.tracks }),
      bookmarks: scene.bookmarks,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    }));

    const serializedProject: SerializedProject = {
      metadata: {
        id: project.metadata.id,
        name: project.metadata.name,
        thumbnail: project.metadata.thumbnail,
        duration,
        createdAt: project.metadata.createdAt.toISOString(),
        updatedAt: project.metadata.updatedAt.toISOString(),
      },
      scenes: serializedScenes,
      currentSceneId: project.currentSceneId,
      settings: project.settings,
      version: project.version,
      timelineViewState: project.timelineViewState,
      agentMessages: project.agentMessages,
    };

    // ── T3：写单工程本体走 KV 严格族 CAS（docs/133 §3.5 D-4，禁静默覆盖）。
    // 键 = (canvasProjectId, editorId)；editorId 即 project.metadata.id。
    const { canvasProjectId, editorId } = requireEditorContext();
    const key = videoEditorProjectKey(canvasProjectId, editorId);
    const baseline = await contentKvGetVersion(key);
    try {
      await contentKvSetCas(key, serializedProject, { ifVersion: baseline });
    } catch (e) {
      // 409 = 版本冲突（别人已改），**原样上抛**让 UI 可见提示（T5 ④），禁静默重试。
      const httpErr = e instanceof HttpError ? e : null;
      if (httpErr && httpErr.status === 409) {
        logger.warn('视频剪辑器', '工程写入被服务端拒绝：版本冲突（一个字节未写）', {
          key,
          expected: baseline,
        });
      }
      throw e;
    }

    // U-3：每次保存成功同步更新列表 updatedAt（列表轻量，顺手维护，docs/134 U-3）。
    await this.touchProjectList({
      id: project.metadata.id,
      name: project.metadata.name,
      createdAt: project.metadata.createdAt.toISOString(),
      updatedAt: project.metadata.updatedAt.toISOString(),
    });
  }

  async loadProject({ id }: { id: string }): Promise<{ project: TProject } | null> {
    await this.ensureMigrations();
    // ── T3：读单工程本体走 KV（读前后各取一次版本，不一致重读 —— 照 _legacy/projectRepository.ts）。
    const { canvasProjectId } = requireEditorContext();
    const key = videoEditorProjectKey(canvasProjectId, id);

    let version = await contentKvGetVersion(key);
    let raw = (await contentGetAsync(key)) as SerializedProject | null;
    // 最多重试 2 次：期间被别人改过 → 版本不一致 → 重读，避免「配错对」的 (内容,版本) 致后续 CAS 假冲突。
    for (let attempt = 0; attempt < 2; attempt++) {
      const after = await contentKvGetVersion(key);
      if (after === version) break;
      version = after;
      raw = (await contentGetAsync(key)) as SerializedProject | null;
    }

    if (raw === undefined || raw === null) return null;

    const serializedProject = raw;

    const scenes =
      serializedProject.scenes?.map((scene) => ({
        id: scene.id,
        name: scene.name,
        isMain: scene.isMain,
        tracks: (scene.tracks ?? []).map((track) =>
          track.type === 'video'
            ? { ...track, isMain: track.isMain ?? false, transitions: track.transitions ?? [] }
            : track,
        ),
        bookmarks: scene.bookmarks ?? [],
        createdAt: new Date(scene.createdAt),
        updatedAt: new Date(scene.updatedAt),
      })) ?? [];

    const project: TProject = {
      metadata: {
        id: serializedProject.metadata.id,
        name: serializedProject.metadata.name,
        thumbnail: serializedProject.metadata.thumbnail,
        duration: serializedProject.metadata.duration ?? getProjectDurationFromScenes({ scenes }),
        createdAt: new Date(serializedProject.metadata.createdAt),
        updatedAt: new Date(serializedProject.metadata.updatedAt),
      },
      scenes,
      currentSceneId: serializedProject.currentSceneId || '',
      settings: serializedProject.settings,
      version: serializedProject.version,
      timelineViewState: serializedProject.timelineViewState,
      agentMessages: serializedProject.agentMessages ?? [],
    };

    return { project };
  }

  async loadAllProjects(): Promise<TProject[]> {
    const items = await this.readProjectList();
    const projects: TProject[] = [];

    for (const item of items) {
      const result = await this.loadProject({ id: item.id });
      if (result?.project) {
        projects.push(result.project);
      }
    }

    return projects.sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());
  }

  async loadAllProjectsMetadata(): Promise<TProjectMetadata[]> {
    await this.ensureMigrations();
    // ── T3：列表走 KV 列表键（videoEditorProjectsKey 构造，轻量索引，docs/133 §2.3）。
    const items = await this.readProjectList();

    const metadata = items.map((item) => ({
      id: item.id,
      name: item.name,
      thumbnail: undefined,
      duration: 0,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }));

    return metadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async deleteProject({ id }: { id: string }): Promise<void> {
    // 删单工程本体（KV 严格族，禁静默降级）。
    const { canvasProjectId } = requireEditorContext();
    await contentDeleteAsync(videoEditorProjectKey(canvasProjectId, id));
    // 从列表移除该项。
    await this.removeFromProjectList(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // 工程列表（轻）/ 活跃键（docs/134 T3 + T5）—— 全部 KV，键构造走 videoEditorKeys.ts
  // ─────────────────────────────────────────────────────────────────

  /** 读当前画布项目的工程列表（KV）。空列表返回 []。 */
  private async readProjectList(): Promise<ProjectListItem[]> {
    const { canvasProjectId } = requireEditorContext();
    const list = (await contentGetAsync(videoEditorProjectsKey(canvasProjectId))) as
      ProjectListItem[] | null;
    return Array.isArray(list) ? list : [];
  }

  /** Upsert 一个工程到列表（按 id；存在则更新 name/时间戳，不存在则头插）。 */
  private async touchProjectList(item: ProjectListItem): Promise<void> {
    const items = await this.readProjectList();
    const idx = items.findIndex((p) => p.id === item.id);
    if (idx !== -1) {
      items[idx] = item;
    } else {
      items.unshift(item);
    }
    const { canvasProjectId } = requireEditorContext();
    await contentSetAsync(videoEditorProjectsKey(canvasProjectId), items);
  }

  /** 从列表移除一个工程（deleteProject 同步清理）。 */
  private async removeFromProjectList(id: string): Promise<void> {
    const items = await this.readProjectList();
    const next = items.filter((p) => p.id !== id);
    if (next.length === items.length) return; // 无变化不写
    const { canvasProjectId } = requireEditorContext();
    await contentSetAsync(videoEditorProjectsKey(canvasProjectId), next);
  }

  /** 写当前活跃剪辑工程 id（T5 切换器调用；刷新后恢复）。 */
  async saveActiveEditorId({ editorId }: { editorId: string }): Promise<void> {
    const { canvasProjectId } = requireEditorContext();
    await contentSetAsync(videoEditorActiveProjectKey(canvasProjectId), editorId);
  }

  /** 读当前活跃剪辑工程 id；无则返回 null。 */
  async loadActiveEditorId(): Promise<string | null> {
    const { canvasProjectId } = requireEditorContext();
    const id = (await contentGetAsync(videoEditorActiveProjectKey(canvasProjectId))) as
      string | null;
    return typeof id === 'string' ? id : null;
  }

  async saveMediaAsset({
    projectId,
    mediaAsset,
  }: {
    projectId: string;
    mediaAsset: MediaAsset;
  }): Promise<void> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    await mediaAssetsAdapter.set(mediaAsset.id, mediaAsset.file);

    const metadata: MediaAssetData = {
      id: mediaAsset.id,
      name: mediaAsset.name,
      type: mediaAsset.type,
      size: mediaAsset.file.size,
      lastModified: mediaAsset.file.lastModified,
      width: mediaAsset.width,
      height: mediaAsset.height,
      duration: mediaAsset.duration,
      thumbnailUrl: mediaAsset.thumbnailUrl,
      ephemeral: mediaAsset.ephemeral,
    };

    await mediaMetadataAdapter.set(mediaAsset.id, metadata);
  }

  async loadMediaAsset({
    projectId,
    id,
  }: {
    projectId: string;
    id: string;
  }): Promise<MediaAsset | null> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    const [file, metadata] = await Promise.all([
      mediaAssetsAdapter.get(id),
      mediaMetadataAdapter.get(id),
    ]);

    if (!file || !metadata) return null;

    let url: string;
    if (metadata.type === 'image' && (!file.type || file.type === '')) {
      try {
        const text = await file.text();
        if (text.trim().startsWith('<svg')) {
          const svgBlob = new Blob([text], { type: 'image/svg+xml' });
          url = URL.createObjectURL(svgBlob);
        } else {
          url = URL.createObjectURL(file);
        }
      } catch {
        url = URL.createObjectURL(file);
      }
    } else {
      url = URL.createObjectURL(file);
    }

    return {
      id: metadata.id,
      name: metadata.name,
      type: metadata.type,
      file,
      url,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl,
      ephemeral: metadata.ephemeral,
    };
  }

  async loadAllMediaAssets({ projectId }: { projectId: string }): Promise<MediaAsset[]> {
    const { mediaMetadataAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    const mediaIds = await mediaMetadataAdapter.list();
    const mediaItems: MediaAsset[] = [];

    for (const id of mediaIds) {
      const item = await this.loadMediaAsset({ projectId, id });
      if (item) {
        mediaItems.push(item);
      }
    }

    return mediaItems;
  }

  async deleteMediaAsset({ projectId, id }: { projectId: string; id: string }): Promise<void> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    await Promise.all([mediaAssetsAdapter.remove(id), mediaMetadataAdapter.remove(id)]);
  }

  async deleteProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    await Promise.all([mediaMetadataAdapter.clear(), mediaAssetsAdapter.clear()]);
  }

  async clearAllData(): Promise<void> {
    // ── T3：列表 + 所有工程本体走 KV，逐个删除（媒体随 T4 仍在 localTool，删除工程媒体另走 deleteProjectMedia）。
    const items = await this.readProjectList();
    const { canvasProjectId } = requireEditorContext();
    await Promise.all(
      items.map((item) => contentDeleteAsync(videoEditorProjectKey(canvasProjectId, item.id))),
    );
    await contentDeleteAsync(videoEditorProjectsKey(canvasProjectId));
    await contentDeleteAsync(videoEditorActiveProjectKey(canvasProjectId));
    // project-specific media and timelines cleaned up when projects are deleted
  }

  async getStorageInfo(): Promise<{
    projects: number;
    isOPFSSupported: boolean;
    isIndexedDBSupported: boolean;
  }> {
    const items = await this.readProjectList();

    return {
      projects: items.length,
      isOPFSSupported: this.isOPFSSupported(),
      isIndexedDBSupported: this.isIndexedDBSupported(),
    };
  }

  async getProjectStorageInfo({ projectId }: { projectId: string }): Promise<{
    mediaItems: number;
  }> {
    const { mediaMetadataAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    const mediaIds = await mediaMetadataAdapter.list();

    return {
      mediaItems: mediaIds.length,
    };
  }

  async getDetailedStorageStats(): Promise<StorageStats> {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;

    const items = await this.readProjectList();
    const projects: ProjectStorageStats[] = [];

    for (const item of items) {
      const projectId = item.id;
      const { mediaMetadataAdapter } = this.getProjectMediaAdapters({
        projectId,
      });

      try {
        const allMedia = await mediaMetadataAdapter.getAll();
        const byType: ProjectStorageStats['byType'] = {};
        let mediaSize = 0;

        for (const media of allMedia) {
          mediaSize += media.size ?? 0;
          const existing = byType[media.type];
          if (existing) {
            existing.size += media.size ?? 0;
            existing.count += 1;
          } else {
            byType[media.type] = { size: media.size ?? 0, count: 1 };
          }
        }

        projects.push({
          projectId,
          projectName: item.name,
          mediaSize,
          mediaCount: allMedia.length,
          byType,
        });
      } catch {
        projects.push({
          projectId,
          projectName: item.name,
          mediaSize: 0,
          mediaCount: 0,
          byType: {},
        });
      }
    }

    projects.sort((a, b) => b.mediaSize - a.mediaSize);

    return { quota, usage, projects };
  }

  async loadSavedSounds(): Promise<SavedSoundsData> {
    try {
      const savedSoundsData = await this.savedSoundsAdapter.get('user-sounds');
      return (
        savedSoundsData || {
          sounds: [],
          lastModified: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('Failed to load saved sounds:', error);
      return { sounds: [], lastModified: new Date().toISOString() };
    }
  }

  async saveSoundEffect({ soundEffect }: { soundEffect: SoundEffect }): Promise<void> {
    try {
      const currentData = await this.loadSavedSounds();

      if (currentData.sounds.some((sound) => sound.id === soundEffect.id)) {
        return; // Already saved
      }

      const savedSound: SavedSound = {
        id: soundEffect.id,
        name: soundEffect.name,
        username: soundEffect.username,
        previewUrl: soundEffect.previewUrl,
        downloadUrl: soundEffect.downloadUrl,
        duration: soundEffect.duration,
        tags: soundEffect.tags,
        license: soundEffect.license,
        savedAt: new Date().toISOString(),
      };

      const updatedData: SavedSoundsData = {
        sounds: [...currentData.sounds, savedSound],
        lastModified: new Date().toISOString(),
      };

      await this.savedSoundsAdapter.set('user-sounds', updatedData);
    } catch (error) {
      console.error('Failed to save sound effect:', error);
      throw error;
    }
  }

  async removeSavedSound({ soundId }: { soundId: number }): Promise<void> {
    try {
      const currentData = await this.loadSavedSounds();

      const updatedData: SavedSoundsData = {
        sounds: currentData.sounds.filter((sound) => sound.id !== soundId),
        lastModified: new Date().toISOString(),
      };

      await this.savedSoundsAdapter.set('user-sounds', updatedData);
    } catch (error) {
      console.error('Failed to remove saved sound:', error);
      throw error;
    }
  }

  async isSoundSaved({ soundId }: { soundId: number }): Promise<boolean> {
    try {
      const currentData = await this.loadSavedSounds();
      return currentData.sounds.some((sound) => sound.id === soundId);
    } catch (error) {
      console.error('Failed to check if sound is saved:', error);
      return false;
    }
  }

  async clearSavedSounds(): Promise<void> {
    try {
      await this.savedSoundsAdapter.remove('user-sounds');
    } catch (error) {
      console.error('Failed to clear saved sounds:', error);
      throw error;
    }
  }

  isOPFSSupported(): boolean {
    return OPFSAdapter.isSupported();
  }

  isIndexedDBSupported(): boolean {
    return 'indexedDB' in window;
  }

  isFullySupported(): boolean {
    return this.isIndexedDBSupported() && this.isOPFSSupported();
  }
}

export const storageService = new StorageService();
export { StorageService };
