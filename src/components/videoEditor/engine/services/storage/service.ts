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
  contentKvReadWithVersion,
  contentKvSetCas,
  contentSetAsync,
  contentDeleteAsync,
} from '../../../../base/core/contentStore.ts';
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
 * 由 EditorProvider 挂载时调 `setEditorContext` 注入当前（画布 projectId, editorId）。
 * 之后键构造一律用这两个值。未设置时拒绝工程读写（fail-fast，而非落到 default 键错配）。
 */
interface EditorContext {
  canvasProjectId: string;
  editorId: string | null;
}
let editorContext: EditorContext | null = null;

/**
 * 由 EditorProvider 在挂载时调用（docs/134 T5 ②）。
 *
 * 【两段式（T5-A）】挂载时 editorId 尚不可知（它要从 KV 的 active 键读出来，而读键本身
 * 就需要先有 canvasProjectId）。故：
 *   ① 先 `setEditorContext({ canvasProjectId, editorId: null })` —— 允许只为读列表/active 键；
 *   ② 定出 editorId 后再次调用补全 —— 此后工程本体读写才放行。
 * `editorId` 为 null 时，**列表/active 键**读写可用（它们只依赖 canvasProjectId），
 * 但**工程本体**（videoEditorProjectKey 需双占位）会被 requireEditorContext 拦下。
 */
export function setEditorContext(ctx: EditorContext): void {
  if (!ctx.canvasProjectId) {
    throw new Error(
      `[StorageService] setEditorContext 至少需要 canvasProjectId，收到: ${JSON.stringify(ctx)}`,
    );
  }
  editorContext = { canvasProjectId: ctx.canvasProjectId, editorId: ctx.editorId ?? null };
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
 * 写工程本体用的 editorId 解析（T5-A 关键）：
 *   · 上下文已有 editorId（补全后）→ 用它；
 *   · 否则用 `project.metadata.id` 兜底并**顺手补全上下文**。
 *
 * 【为什么允许兜底】`createNewProject` 的流程是「生成 id → 立刻 saveProject」，
 * 而 id 是它自己生成的——注入上下文必然发生在 save 之后。若此处死等上下文补全，
 * 首开流程必崩（先有鸡还是先有蛋）。而 `project.metadata.id` **就是 editorId**
 * （docs/133 §2.1 M-4：editorId = TProject.metadata.id），用它兜底语义等价、无歧义；
 * 且补全后，后续写入自愈为上下文驱动，不残留隐式状态。
 * 冲突保护：上下文已有 editorId 且与 project.metadata.id **不一致** → 说明张冠李戴，直接抛错。
 */
function resolveEditorIdFor(projectMetadataId: string): string {
  const ctx = requireEditorContext();
  if (!ctx.editorId) {
    editorContext = { canvasProjectId: ctx.canvasProjectId, editorId: projectMetadataId };
    return projectMetadataId;
  }
  if (ctx.editorId !== projectMetadataId) {
    throw new Error(
      `[StorageService] 工程本体写入 editorId 冲突：上下文=${ctx.editorId}，project.metadata.id=${projectMetadataId}`,
    );
  }
  return ctx.editorId;
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
    };

    // ── T3：写单工程本体走 KV 严格族 CAS（docs/133 §3.5 D-4，禁静默覆盖）。
    // 键 = (canvasProjectId, editorId)；editorId 即 project.metadata.id（两者必一致，见 resolveEditorIdFor）。
    const { canvasProjectId } = requireEditorContext();
    const editorId = resolveEditorIdFor(project.metadata.id);
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
    // 注：此处 `id` 即 editorId，**来自调用方**（EditorProvider 已定出 editorId 后才调），
    // 故不再要求上下文 editorId 已补全（首次载入时它正是本次 loadProject 之后才补全）。
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
   * 【同时同步上下文】—— 切工程后，后续工程本体读写（saveProject 等）必须指向**新** editorId，
   * 否则会写回旧片子（键双占位里的 editorId 仍是旧的）。此处把"写 active 键"与"切上下文"
   * 收拢为一个原子动作，杜绝两处各写一次造成的不一致。
   */
  async saveActiveEditorId({ editorId }: { editorId: string }): Promise<void> {
    const { canvasProjectId } = requireEditorContext();
    await contentSetAsync(videoEditorActiveProjectKey(canvasProjectId), editorId);
    editorContext = { canvasProjectId, editorId };
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
      logger.error('videoEditor', 'load-sounds', (error as { message?: string })?.message);
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

      await this.savedSoundsAdapter.set('user-sounds', updatedData);
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
      await this.savedSoundsAdapter.remove('user-sounds');
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
