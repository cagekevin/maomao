import type { TProject, TProjectMetadata } from '@/components/videoEditor/types/project';
import { getProjectDurationFromScenes } from '@/components/videoEditor/engine/lib/scenes';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
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
import type {
  SavedSoundsData,
  SavedSound,
  SoundEffect,
} from '@/components/videoEditor/types/sounds';
import {
  migrations,
  runStorageMigrations,
} from '@/components/videoEditor/engine/services/storage/migrations';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
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
  contentKvReadWithVersion,
  contentKvSetCas,
  contentSetAsync,
  contentDeleteAsync,
} from '../../../../base/core/contentStore.ts';
// ── 2026-09-16 M7 收口（TD-02-34/40）：收藏音效由「仅 IndexedDB」改走 contentStore（键已登记 backend:'local'）。
import { KEY_VIDEO_EDITOR_SAVED_SOUNDS } from '../../../../base/core/contracts.ts';
import { deleteDatabase } from './indexeddb-adapter';
import { HttpError } from '../../../../base/api/httpClient.ts';
import { logger } from '../../../../base/core/logger.ts';
// ── T4（docs/134）：素材二进制改走 localTool /files/（docs/133 §3.2 D-3），元数据留 IndexedDB。
import { uploadFileToLocal } from '../../../../base/api/filesApi.ts';
import { deleteResource, fetchResources } from '../../../../base/api/localToolApi.ts';
import { UPLOAD_DIRS } from '../../../../base/utils/uploadDirs.ts';

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
 * 由 EditorProvider 挂载时调 `setEditorContext` 注入当前**画布 projectId**。
 * 之后键构造一律用它。未设置时拒绝工程读写（fail-fast，而非落到 default 键错配）。
 *
 * 【为什么这里**只有** canvasProjectId（2026-09-15 修正）】判据只有一条：**谁拥有这份真相**。
 *   · `canvasProjectId` —— 引擎**不携带**（`TProject` 里没有它），只有"编辑器挂载在哪个画布项目上"
 *     这一层知道 ⇒ 必须由外部注入。
 *   · `editorId` —— **工程实体自带**（`TProject.metadata.id`，`ProjectManager.createNewProject` 生成）
 *     ⇒ 存储层再存一格 = 同一真相的第二份，必然漂移。
 *
 * 原实现多存了这一格 `editorId`，并加守卫「上下文 editorId ≠ project.metadata.id → 抛『张冠李戴』」。
 * 那是**假守卫**：它拦的是**合法操作**，两个实测症状——
 *   ① 用户报「新建作品失败」：新建 = 生成新 uuid ⇒ 必然 ≠ 旧上下文 ⇒ **必抛**；
 *   ② `duplicateProjects` 一次落 N 个新 id，而上下文只有一格 ⇒ **结构上就表达不了**。
 * 于是守卫强制各调用点"补一次上下文"，而调用点是手写清单（编辑器挂载 / 新建 / 复制 / 未来入口…）
 * ⇒ 必漂移。正解是**删掉第二份真相与这条守卫**，写盘槽位由实体自带 id 决定。
 */
interface EditorContext {
  canvasProjectId: string;
}
let editorContext: EditorContext | null = null;

/**
 * 由 EditorProvider 在挂载时调用（docs/134 T5）。
 * 【为什么只注入一次】它只需要一个值（画布 id）——挂载即已知，无先后依赖。
 * （原为"两段式"：先注入画布 id、读出 active 键后再补 editorId。editorId 已不在此层，故两步并一步。）
 */
export function setEditorContext(ctx: { canvasProjectId: string }): void {
  if (!ctx.canvasProjectId) {
    throw new Error(
      `[StorageService] setEditorContext 至少需要 canvasProjectId，收到: ${JSON.stringify(ctx)}`,
    );
  }
  editorContext = { canvasProjectId: ctx.canvasProjectId };
}

/** 清空上下文（EditorProvider 卸载时调用；避免切画布后残留旧 id 造成错键）。 */
export function clearEditorContext(): void {
  editorContext = null;
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

/**
 * 取「画布 projectId」（媒体域用）。
 *
 * 【为什么单独一个读取器（T5-B）】媒体域的 `projectId` 有两层语义：
 *   · 引擎/媒体管理器传入的 `projectId` = **editorId**（同一片子内媒体即片子资产，粒度对齐片子）；
 *   · 后端 `resource.project_id` 要的是 **画布项目 id**（项目隔离写入链，TD-12-5）。
 * 二者在「一个画布项目挂多个片子」时**不再相等**，故此处显式暴露画布 id 供落盘链使用，
 * 禁止下游再拿 editorId 冒充画布 id（docs/133 §3.2 D-3）。
 */
function canvasProjectIdOrNull(): string | null {
  return editorContext?.canvasProjectId ?? null;
}

class StorageService {
  private config: StorageConfig;
  private migrationsPromise: Promise<void> | null = null;
  /** 收藏音效「旧 IndexedDB → contentStore」一次性迁移是否已尝试（本会话只试一次；失败不反复读旧库）。 */
  private savedSoundsMigrationAttempted = false;

  constructor() {
    this.config = {
      projectsDb: 'video-editor-projects',
      mediaDb: 'video-editor-media',
      // 【2026-09-16 收口后仅作迁移用】旧收藏音效 IndexedDB 库名（新键名沿用同名字符串，
      // 见 contracts.KEY_VIDEO_EDITOR_SAVED_SOUNDS）；迁移完成、确认无存量后可随 TD-02-35 四期一并清。
      savedSoundsDb: 'video-editor-saved-sounds',
      version: 1,
    };
    // savedSoundsAdapter 已删（TD-02-34/40）：收藏音效不再走 IndexedDB，改 contentStore。
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
    };

    // ── T3：写单工程本体走 KV 严格族 CAS（docs/133 §3.5 D-4，禁静默覆盖）。
    // 键 = (canvasProjectId, editorId)，其中 editorId **就是** `project.metadata.id`
    // （docs/133 §2.1 M-4）—— 取自实体自带真相，不经任何"当前活跃"缓存裁决（2026-09-15 修正，见 EditorContext 头注）。
    const { canvasProjectId } = requireEditorContext();
    const editorId = project.metadata.id;
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
    // ── T3：读单工程本体走 KV（严格族 · 读内容+配对版本）。
    // 读法收口到 contentKvReadWithVersion（2026-09-14）：本处原为第 3 份手写副本（TD-02-29）。
    // 重试 2 次是**本域判据**（单次加载），协议本身在原语里。
    // 注：此处 `id` 即 editorId，**由调用方给出**（读/写/删同源：目标槽位一律取自实参或实体自带 id，
    // 不经任何"当前活跃"缓存）；本方法只问上下文要 `canvasProjectId`（它才是这一层独有的真相）。
    const { canvasProjectId } = requireEditorContext();
    const key = videoEditorProjectKey(canvasProjectId, id);

    const { value: raw } = await contentKvReadWithVersion<SerializedProject>(key, { retries: 2 });

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
    // 删单工程本体（KV 严格族，禁静默降级）。`id` 即 editorId（调用方明确给出）。
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

  /**
   * 写当前活跃剪辑工程 id（T5 切换器调用；刷新后恢复）。
   * 【只写这一格】它只服务「刷新后恢复该开哪部」；**不再兼职切存储上下文**
   * （2026-09-15 修正：原实现顺带把上下文 editorId 改掉，是为了喂 saveProject 的冲突守卫——
   * 守卫已删，兼职也随之取消；工程本体的写盘槽位由 `project.metadata.id` 自带决定）。
   */
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
    const { mediaMetadataAdapter } = this.getProjectMediaAdapters({ projectId });

    // ── T5-B①：ephemeral（临时预览素材）**不落盘**——它本就随会话生灭，上传只会留孤儿文件。
    // 仅在元数据里留一条记录（无 url），loadMediaAsset 见无 url 即返回 null（不误导下游以为是持久素材）。
    // ── T4/T5-B②：持久素材的二进制改走 localTool /files/（docs/133 §3.2 D-3）。
    // 第 4 参必须传**画布 projectId**（后端写 resource 行 project_id；传 editorId 会让项目隔离错位）。
    const canvasProjectId = canvasProjectIdOrNull();
    const fileUrl = mediaAsset.ephemeral
      ? null
      : await uploadFileToLocal(
          mediaAsset.file,
          UPLOAD_DIRS.videoEditor,
          mediaAsset.name,
          canvasProjectId ?? undefined,
        );

    // ── 修复(2026-09-14 · 假成功)：持久素材上传失败 = **本次没存住**，必须炸开，
    // 不能"写一条无 url 的元数据"假装成功（那会：刷新后素材变空壳、且 /files/ 无对应文件）。
    // 【为什么与 ephemeral 分开判】ephemeral 的 fileUrl 是**故意** null（合法状态），
    // 不能用 `!fileUrl` 一刀切——那会把正常的临时素材也当失败。故只在"本应上传"的分支判。
    if (!mediaAsset.ephemeral && !fileUrl) {
      throw new Error(
        `[StorageService] 素材上传失败（本地服务不可用？）：${mediaAsset.name}（id=${mediaAsset.id}）`,
      );
    }

    const metadata: MediaAssetData = {
      id: mediaAsset.id,
      name: mediaAsset.name,
      type: mediaAsset.type,
      size: mediaAsset.file.size,
      lastModified: mediaAsset.file.lastModified,
      width: mediaAsset.width,
      height: mediaAsset.height,
      duration: mediaAsset.duration,
      fps: mediaAsset.fps,
      // TD-21-17：音轨存在性随素材落盘（否则刷新后 🔊 角标失效）。
      hasAudio: mediaAsset.hasAudio,
      thumbnailUrl: mediaAsset.thumbnailUrl,
      ephemeral: mediaAsset.ephemeral,
      url: fileUrl ?? undefined,
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
    const { mediaMetadataAdapter } = this.getProjectMediaAdapters({ projectId });

    const metadata = await mediaMetadataAdapter.get(id);
    if (!metadata) return null;

    // ── T4：从 /files/ URL 拉回 Blob（上传失败致 url 缺失 → 无法还原，返回 null）。
    if (!metadata.url) return null;
    let file: File;
    try {
      const res = await fetch(metadata.url);
      if (!res.ok) return null;
      const blob = await res.blob();
      // fetch 回的是 Blob，MediaAsset.file 要求 File（保留 name/type 供下游使用）。
      file = new File([blob], metadata.name || id, {
        type: blob.type || String(metadata.type),
      });
    } catch {
      return null;
    }

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
      fps: metadata.fps,
      // TD-21-17：音轨存在性随素材还原（🔊 角标在刷新后仍有效）。
      hasAudio: metadata.hasAudio,
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

  /**
   * 解除一批 /files/ 素材对后端 resources 表的引用（T5-B③）。
   *
   * 【为什么不是直接删文件】后端 delete-file 明确**只删「全库无引用」的文件**，
   * 被引用即 `skipped:'referenced'` 不删；而我们的素材上传时带了 projectId → 必然登记了 resource 行
   * → 直接删文件**永远失败**（已实测确认）。后端既定纪律是「只删记录，删盘交给引用感知 GC
   * （runReferenceGc 查 resources + tasks + **KV** 三处引用）」。故正确姿势：
   *   ① 按 url 反查该素材的 resource 行 → ② 删记录（deleteResource 内部触发 GC 裁决回收）。
   *
   * 反查用 `fetchResources({ folder, projectId })`（folder 取素材落盘目录、projectId 取画布 id），
   * 再按 url 精确匹配（资源列表是分页的，故按落盘目录 + 本项目过滤把候选压到最小）。
   * 任一步失败**不阻断**元数据清理：残留的 resource 行会被后续 GC 兜底，比"删不掉就卡死"更安全。
   */
  private async releaseResourceRefs(
    urls: string[],
    { folder, projectId }: { folder: string; projectId: string | null },
  ): Promise<void> {
    const targets = new Set(urls.filter(Boolean));
    if (targets.size === 0) return;

    try {
      // 资源可能跨多页（素材多了以后），逐页扫到没有再停；通常一页足够。
      for (let page = 1; page <= 20; page++) {
        const res = await fetchResources({
          folder,
          page,
          pageSize: 200,
          projectId: projectId ?? undefined,
        });
        const items = res?.data?.items ?? [];
        if (items.length === 0) break;

        const hits = items.filter((it) => it.url && targets.has(it.url));
        await Promise.all(hits.map((hit) => deleteResource(String(hit.id))));

        if (items.length < 200) break; // 最后一页
      }
    } catch (e) {
      logger.warn('视频剪辑器', '素材资源引用解除失败（交后续 GC 兜底）', {
        count: targets.size,
        error: String(e),
      });
    }
  }

  async deleteMediaAsset({ projectId, id }: { projectId: string; id: string }): Promise<void> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    // ── T5-B③：先解除 /files/ 素材的后端资源引用（否则删一次素材留一个孤儿文件）。
    const metadata = await mediaMetadataAdapter.get(id);
    if (metadata?.url) {
      await this.releaseResourceRefs([metadata.url], {
        folder: UPLOAD_DIRS.videoEditor,
        projectId: canvasProjectIdOrNull(),
      });
    }

    await Promise.all([mediaAssetsAdapter.remove(id), mediaMetadataAdapter.remove(id)]);
  }

  async deleteProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    const { mediaMetadataAdapter, mediaAssetsAdapter } = this.getProjectMediaAdapters({
      projectId,
    });

    // ── T5-B③：整个工程的媒体一起删时，批量解除资源引用后再 clear 元数据。
    const allMedia = await mediaMetadataAdapter.getAll();
    await this.releaseResourceRefs(
      allMedia.map((m) => m.url).filter((u): u is string => Boolean(u)),
      { folder: UPLOAD_DIRS.videoEditor, projectId: canvasProjectIdOrNull() },
    );

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

  /**
   * 读收藏音效（含一次性迁移）。
   *
   * 【TD-02-40 正确性修复】原实现 `catch → 返回空数组`，把「读不到」伪装成「没有收藏」；
   * 而 `saveSoundEffect` 是**读-改-写**：读失败 → 基于空数组写回 → **抹掉用户全部已收藏音效**（真数据丢失）。
   * 现契约：**读失败一律上抛**（消费方 sounds-store 落 `savedSoundsError` + toast），
   * 只有「确实为空」（新键无值）才返回空集合 —— 区分「未知」与「不存在」。
   */
  async loadSavedSounds(): Promise<SavedSoundsData> {
    await this.migrateSavedSoundsFromIndexedDbOnce();
    const value = await contentGetAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS);
    if (value === null || value === undefined) {
      return { sounds: [], lastModified: new Date().toISOString() };
    }
    const data = value as Partial<SavedSoundsData> | null;
    if (!data || !Array.isArray(data.sounds)) {
      // 形态异常 ≠ 空：不静默当空（会掩盖损坏），留痕后按空处理（用户可重新收藏）
      logger.warn('videoEditor', 'saved-sounds-shape', '收藏音效数据形态异常，按空处理');
      return { sounds: [], lastModified: new Date().toISOString() };
    }
    return {
      sounds: data.sounds,
      lastModified: data.lastModified || new Date().toISOString(),
    };
  }

  /**
   * 一次性迁移：旧 IndexedDB 库（`video-editor-saved-sounds`）→ contentStore 新键。
   * 幂等（新键有值即返回）；**新键写成功才删旧库**（写失败保留 = 数据不丢，下次启动再试）；
   * 迁移自身失败只留痕、不阻断（读侧照常按新键处理，旧数据仍在）。
   */
  private async migrateSavedSoundsFromIndexedDbOnce(): Promise<void> {
    if (this.savedSoundsMigrationAttempted) return;
    this.savedSoundsMigrationAttempted = true;
    try {
      const existing = await contentGetAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS);
      if (existing !== null && existing !== undefined) return;
      const legacyAdapter = new IndexedDBAdapter<SavedSoundsData>(
        this.config.savedSoundsDb,
        'saved-sounds',
        this.config.version,
      );
      const legacy = await legacyAdapter.get('user-sounds');
      if (!legacy) return; // 无存量（新用户）
      await contentSetAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS, legacy);
      try {
        await deleteDatabase({ dbName: this.config.savedSoundsDb });
      } catch (error) {
        // 旧库没删掉不影响正确性（读侧只看新键）；留痕，下次启动重试
        logger.warn(
          'videoEditor',
          'saved-sounds-migrate-cleanup',
          (error as { message?: string })?.message,
        );
      }
    } catch (error) {
      logger.warn('videoEditor', 'saved-sounds-migrate', (error as { message?: string })?.message);
    }
  }

  async saveSoundEffect({ soundEffect }: { soundEffect: SoundEffect }): Promise<void> {
    try {
      // 读失败会抛（见 loadSavedSounds）→ 绝不会用「空数组 + 1 条」覆盖用户既有收藏
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

      await contentSetAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS, updatedData);
    } catch (error) {
      logger.error('videoEditor', 'save-sound', (error as { message?: string })?.message);
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

      await contentSetAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS, updatedData);
    } catch (error) {
      logger.error('videoEditor', 'remove-sound', (error as { message?: string })?.message);
      throw error;
    }
  }

  async isSoundSaved({ soundId }: { soundId: number }): Promise<boolean> {
    try {
      const currentData = await this.loadSavedSounds();
      return currentData.sounds.some((sound) => sound.id === soundId);
    } catch (error) {
      logger.error('videoEditor', 'check-sound', (error as { message?: string })?.message);
      return false;
    }
  }

  async clearSavedSounds(): Promise<void> {
    try {
      await contentDeleteAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS);
    } catch (error) {
      logger.error('videoEditor', 'clear-sounds', (error as { message?: string })?.message);
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
