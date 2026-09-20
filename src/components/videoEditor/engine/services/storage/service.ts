import type { TProject, TProjectMetadata } from '@/components/videoEditor/types/project';
import { getProjectDurationFromScenes } from '@/components/videoEditor/engine/lib/scenes';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import type { MediaAssetData, SerializedProject, SerializedScene } from './types';
// 音效域类型（2026-09-14 恢复：原误判为 AI 相关而删，实测零 AI 依赖 —— docs/133 §〇.4）。
import type {
  SavedSoundsData,
  SavedSound,
  SoundEffect,
} from '@/components/videoEditor/types/sounds';
import type { TimelineTrack } from '@/components/videoEditor/types/timeline';
// ── T3（docs/134）：工程本体改走 KV 严格族 CAS（docs/133 §3.5 D-4）。
// 键构造唯一真源 = videoEditorKeys.ts（禁手拼前缀字面量，X4）。
import {
  videoEditorProjectKey,
  videoEditorProjectsKey,
  videoEditorActiveProjectKey,
  videoEditorMediaMetaKey,
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
import { HttpError } from '../../../../base/api/httpClient.ts';
import { logger } from '@/components/base/core/log/logger';
// ── T4（docs/134）：素材二进制改走 localTool /files/（docs/133 §3.2 D-3）。
// 更新(2026-09-16 · TD-02-35)：素材**元数据**载体同时收口 —— 原浏览器 IndexedDB → KV（见 readMediaMetaMap）。
import { uploadFileToLocal, type UploadOutcome } from '../../../../base/api/filesApi.ts';
// 【2026-09-17 · docs/136 §9.2 A3】原 `deleteResource`/`fetchResources` 随 releaseResourceRefs 删除后
// 已无消费者（剪辑器不再触碰 resources 行）—— 一并移除，避免"幽灵 import"（M6）。
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
  /**
   * ═══ 载体收口（2026-09-16 · TD-02-35）═══
   * 本类原持**四类浏览器载体** + 一整套 IndexedDB schema 迁移器：
   *   KV（工程本体/列表/活跃 id）· IndexedDB（素材元数据）· OPFS（素材二进制）· localStorage（偏好）。
   * 现收敛为**单一 contentStore**（+ localTool /files/ 磁盘）：
   *   - 素材二进制 → localTool `/files/`（T4 起；磁盘，非浏览器存储）
   *   - 素材元数据 → KV（`readMediaMetaMap`，本轮）
   *   - 工程本体/列表/活跃 id → KV（T3 起）· 收藏音效/字幕偏好 → contentStore local（M7 收口轮）
   * 随之删除：`IndexedDBAdapter` / `OPFSAdapter` 两个适配器、`migrations/` 整套迁移器、
   *   `StorageConfig` 与 5 个零消费者 API。
   * 【依据】用户裁定「不为老用户留兼容，只管正确性」—— 老用户机器上残留的旧 IndexedDB/OPFS
   *   数据不再清理（不影响使用），换取剪辑器存储层**零**浏览器 IDB/OPFS 依赖。
   */

  /**
   * 读素材元数据表（整表一键，`{ [assetId]: MediaAssetData }`）。
   *
   * 【形态】与工程本体同粒度：整表存一个 KV 键（键构造唯一真源 = `videoEditorMediaMetaKey`）。
   *   之所以不"每素材一键"：本表只是**元数据索引**（几十条 × 每条数百字节），整表读写与工程本体
   *   的整包 CAS 同规格；拆键会引入「列键 + N 次读」，复杂度不换收益。
   * 【语义等价（行为零变化）】沿用原 IndexedDB 表的 last-write-wins，**未**升级为 CAS ——
   *   并发保护不是本次收口目标，升级会改变调用方的失败语义（409 需 UI 显式消费，见 D-4）。
   *   将来若需多窗口并发保护，按工程本体同法升级（`contentKvReadWithVersion` + `contentKvSetCas`）。
   */
  private async readMediaMetaMap(
    projectId: string,
  ): Promise<{ map: Record<string, MediaAssetData>; shapeError: string | null }> {
    const value = await contentGetAsync(videoEditorMediaMetaKey(projectId));
    // 【2026-09-17 TD-22-62① + 用户裁定「判别联合透传」】三态必须分开，且**形状违约要透传给调用方**：
    //  · KV 真空（null/undefined）= 正常「还没有素材表」（新工程）→ `{}`，**无日志**；
    //  · 形状违约（有值、但不是记录表）= **存储被写坏** → 旧实现静默 `{}` ⇒
    //    **全部素材一键蒸发且零日志**（用户看到媒体面板变空，排查时毫无线索）；
    //  · 读取抛错 = 真失败 → **不吞**，原样上抛（contentStore 的失败契约）。
    // 不 throw（一条坏记录不该让整个工程打不开）——但**必须透传**：调用方（`loadAllMediaAssets`）
    // 据此把"表整体读坏"并进它自己的 `missing` 通道，最终由 `loadProjectMedia` 呈现。
    if (value == null) return { map: {}, shapeError: null };
    if (typeof value !== 'object' || Array.isArray(value)) {
      logger.warn('videoEditor', '素材元数据表形状异常，按空处理（media-meta-shape）', {
        projectId,
        got: Array.isArray(value) ? 'array' : typeof value,
      });
      return {
        map: {},
        // **可展示信息由本层给全**（消费者只转发）：这是"素材整体丢失"的真相，不能让上层猜。
        shapeError: '素材元数据表已损坏（形状异常），本工程的素材列表可能不完整',
      };
    }
    return { map: value as Record<string, MediaAssetData>, shapeError: null };
  }

  private async writeMediaMetaMap(
    projectId: string,
    map: Record<string, MediaAssetData>,
  ): Promise<void> {
    await contentSetAsync(videoEditorMediaMetaKey(projectId), map);
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
    const value: unknown = await contentGetAsync(videoEditorProjectsKey(canvasProjectId));
    // 【2026-09-17 TD-22-62②】同 readMediaMetaMap：原实现 `Array.isArray(list) ? list : []`
    // 把「空列表」与「形状违约」压成同一个 `[]` ⇒ 列表键被写坏时**工程库整列消失且零日志**
    //（用户看到"我的工程全没了"，排查时无从下手）。三态分开：真空 → `[]`；
    //  形状违约 → **留痕** + `[]`；读取抛错 → 原样上抛（不吞）。
    if (value == null) return [];
    if (!Array.isArray(value)) {
      logger.warn('videoEditor', '工程列表形状异常，按空处理（project-list-shape）', {
        canvasProjectId,
        got: typeof value,
      });
      return [];
    }
    return value as ProjectListItem[];
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
  }): Promise<{ url: string | null }> {
    // ── T5-B①：ephemeral（临时预览素材）**不落盘**——它本就随会话生灭，上传只会留孤儿文件。
    // 仅在元数据里留一条记录（无 url），loadMediaAsset 见无 url 即返回 null（不误导下游以为是持久素材）。
    // ── T4/T5-B②：持久素材的二进制改走 localTool /files/（docs/133 §3.2 D-3）。
    // 第 4 参必须传**画布 projectId**（后端写 resource 行 project_id；传 editorId 会让项目隔离错位）。
    // ── 引用分支（docs/136 §9.2 · P0-2 · 2026-09-17）：来自「画布/素材库/生成」的素材**二进制已在
    //    /files/**，只需登记引用，**绝不再上传一份**（消费者持引用态，不为自保持副本 —— 心法铁律 7）。
    //    判据：调用方已显式声明 `persistentUrl`（= 素材已在 /files/ 的持久地址）。
    const canvasProjectId = canvasProjectIdOrNull();
    // 【2026-09-17 判据】三分支**各自携带结果**，不再共用一个 `string|null` ——
    // `null` 同时兼表"ephemeral 故意不传（合法状态）"与"上传失败"，正是本段注释在治的病。
    const uploadOutcome: UploadOutcome | null = mediaAsset.ephemeral
      ? null // ephemeral：**故意**不落盘（合法状态，不是失败）
      : mediaAsset.persistentUrl
        ? { ok: true, url: mediaAsset.persistentUrl } // 引用：二进制已在 /files/，跳过上传（不复制、不落盘）
        : await uploadFileToLocal(
            mediaAsset.file,
            UPLOAD_DIRS.videoEditor,
            mediaAsset.name,
            canvasProjectId ?? undefined,
          );

    // ── 修复(2026-09-14 · 假成功)：持久素材上传失败 = **本次没存住**，必须炸开，
    // 不能"写一条无 url 的元数据"假装成功（那会：刷新后素材变空壳、且 /files/ 无对应文件）。
    // 【为什么与 ephemeral 分开判】ephemeral 的是**故意**不传（合法状态），
    // 不能用一刀切——那会把正常的临时素材也当失败。故只判"本应上传"的分支（非 null）。
    // 【2026-09-17 消费者只转发】错误里带**生产者判词** —— 原实现自己编"本地服务不可用？"。
    if (uploadOutcome && !uploadOutcome.ok) {
      throw new Error(
        `[StorageService] 素材上传失败：${uploadOutcome.message}（${mediaAsset.name}，id=${mediaAsset.id}）`,
      );
    }
    const fileUrl = uploadOutcome?.ok ? uploadOutcome.url : null;

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
      // docs/136 P0-3：稳定内容身份随素材落盘 —— 否则刷新后去重只能靠 url，改名即失效。
      contentId: mediaAsset.contentId,
    };

    const { map } = await this.readMediaMetaMap(projectId);
    map[mediaAsset.id] = metadata;
    await this.writeMediaMetaMap(projectId, map);

    // 【TD-22-52】**就地回填**持久地址到调用方传入的素材对象上。
    // 为什么在这里回填、而不是让每个调用点自己接返回值：调用点分散在命令 / 管理器里
    // （add-media-asset · remove-media-asset · delete-elements · project-manager · use-editor-actions），
    // 逐处回填必然漏掉几个 ⇒ 表现为"同一批素材有的出小图、有的全分辨率解码"。
    // 回填后 `persistentUrl` 有值，显示侧（mediaDisplayUrl）即走统一出口出小图。
    if (fileUrl) mediaAsset.persistentUrl = fileUrl;

    // 同时回传（供需要显式取值的调用方；不取也不影响 —— 对象已被就地回填）
    return { url: fileUrl };
  }

  async loadMediaAsset({
    projectId,
    id,
  }: {
    projectId: string;
    id: string;
  }): Promise<MediaAsset | null> {
    const { map } = await this.readMediaMetaMap(projectId);
    const metadata = map[id];
    if (!metadata) return null;

    // ── T4：从 /files/ URL 拉回 Blob（上传失败致 url 缺失 → 无法还原，返回 null）。
    if (!metadata.url) return null;
    let file: File;
    try {
      const res = await fetch(metadata.url);
      if (!res.ok) {
        // 【2026-09-17 TD-22-62 收尾】原 `return null` 是**零日志**：素材还原失败只由下游
        // `missing[]` 呈现给用户，开发者侧查不到"哪条、为什么"（非 2xx 与网络错误也分不开）。
        logger.warn('videoEditor', 'media-fetch-non-2xx', {
          id,
          url: metadata.url,
          status: res.status,
        });
        return null;
      }
      const blob = await res.blob();
      // fetch 回的是 Blob，MediaAsset.file 要求 File（保留 name/type 供下游使用）。
      file = new File([blob], metadata.name || id, {
        type: blob.type || String(metadata.type),
      });
    } catch (e) {
      // 从 /files/ 拉回 Blob 失败（网络 / 非 2xx）→ null，调用方按「无法还原」处理。
      // 【2026-09-17 TD-22-62 收尾】原用 `logger.debug` —— debug 是「仅模块位开启才输出、且
      // **不上报后端**」⇒ 生产环境等于静默（排查时 grep 不到）。升为 warn（上报 /api/logs）。
      logger.warn('videoEditor', 'media-fetch-fail', {
        id,
        url: metadata.url,
        error: (e as { message?: string })?.message || String(e),
      });
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
      // 【TD-22-52】持久地址（`/files/…`）= "显示"的唯一输入（过统一 render 出口出小图）；
      // `url`（blob: 全分辨率）保留给渲染引擎（`scene-builder` 喂 Image/VideoNode，导出要原图）。
      persistentUrl: metadata.url,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      fps: metadata.fps,
      // TD-21-17：音轨存在性随素材还原（🔊 角标在刷新后仍有效）。
      hasAudio: metadata.hasAudio,
      thumbnailUrl: metadata.thumbnailUrl,
      ephemeral: metadata.ephemeral,
      // docs/136 P0-3：还原稳定内容身份（刷新后去重仍可按 contentId，不依赖 url）。
      contentId: metadata.contentId,
    };
  }

  /**
   * 批量读工程全部素材。
   *
   * 【2026-09-17 TD-16-27】原实现逐条 `if (item) push` —— `loadMediaAsset` 返回 null
   * （元数据在册、但文件/记录读不出）时**既不报错也不计数** ⇒ 调用方拿到"少了几条"的数组
   * 却当成完整，正是「素材莫名少了、毫无提示」。
   * 现回传 `missing`（在册但读不出的 id）：**不抛**（一条坏记录不该让整个工程打不开 ——
   * "不阻断"是对的），但**必须可见**（"不阻断"≠"不可见"）。
   */
  async loadAllMediaAssets({
    projectId,
  }: {
    projectId: string;
  }): Promise<{ items: MediaAsset[]; missing: string[]; shapeError: string | null }> {
    const { map, shapeError } = await this.readMediaMetaMap(projectId);
    const mediaIds = Object.keys(map);
    const items: MediaAsset[] = [];
    const missing: string[] = [];

    for (const id of mediaIds) {
      const item = await this.loadMediaAsset({ projectId, id });
      if (item) items.push(item);
      else missing.push(id);
    }

    // 【2026-09-17 裁定】把「元数据表整体读坏」的真相**一并透传**（不是只在 storage 层留痕）——
    // 它比"少了几条"严重（**整表消失**），必须让最终呈现层能说出这句话。
    return { items, missing, shapeError };
  }

  // ── 【2026-09-17 · docs/136 §9.2 推论 A3 · 已删 `releaseResourceRefs` + 2 处调用】
  //
  // 【删它的判据 —— 职责归属，心法铁律 7：消费者不约束所有方】
  //  #resources 行是**全库共享的"这个文件存在过"的登记**，其所有方是**素材库（本源）**；
  //  剪辑器只是**消费者**。消费者删自己工程里的一条引用，**凭什么去删别人的登记行？**
  //  那是把"从我的工程里移除它"错误地实现成了"销毁这个文件"—— 归属越界。
  //
  // 【修正后的语义（三行都对）】
  //  磁盘实体     `/files/` 里的文件        → 不碰（回收归引用感知 GC 裁决）
  //  resources 行 文件的全局登记            → **不碰**（本轮删掉的就是这处越界）
  //  工程元数据   KV `video_editor_media_meta_*` → 删（这才是剪辑器自己的）
  //  工程素材数组 `editor.media.getAssets()`     → 删（剪辑器自己的）
  //
  // 【代价（唯一一条，已知且正确）】素材库会**保留**剪辑器用过的素材（哪怕已无人引用）。
  //  这不是脏数据：用户在剪辑器里用过的图本来就是素材；真正的清理归**引用感知 GC**
  //  （"全库无引用才回收"）；素材库面板本身有删除按钮，用户想清就显式删。
  //
  // ⚠️ 上面这条对本剪辑器**自己上传**的素材（本地导入）也同样适用 ——
  //  即"上传时登记了 resources 行、删除却不撤销登记"。这是**有意的一致语义**：
  //  统一由本源 GC 裁决，而不是"我传的我就有权删登记"（那会退化成"看谁传的"的双标）。

  async deleteMediaAsset({ projectId, id }: { projectId: string; id: string }): Promise<void> {
    const { map } = await this.readMediaMetaMap(projectId);
    // 只删自己那两行（工程元数据 + 工程素材数组），不碰 resources 行、不碰磁盘文件。
    delete map[id];
    await this.writeMediaMetaMap(projectId, map);
  }

  async deleteProjectMedia({ projectId }: { projectId: string }): Promise<void> {
    // 清表 = 删键（原 IndexedDB `clear()` 的等价语义）；resources 行同样不碰（见上）。
    await contentDeleteAsync(videoEditorMediaMetaKey(projectId));
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

  // 【2026-09-16 · TD-02-35 已删】原 `getStorageInfo` / `getProjectStorageInfo` /
  // `getDetailedStorageStats` 三个方法 —— 全库零消费者（幽灵 API，M6），且它们的返回形状
  // （含 `isOPFSSupported` / `isIndexedDBSupported`）描述的是**已不存在的多载体形态**。
  // 统计需求若将来真出现，应从 contentStore / KV 侧重新设计，不要复活 IDB/OPFS 语义。

  /**
   * 读收藏音效。
   *
   * 【TD-02-40 正确性修复】原实现 `catch → 返回空数组`，把「读不到」伪装成「没有收藏」；
   * 而 `saveSoundEffect` 是**读-改-写**：读失败 → 基于空数组写回 → **抹掉用户全部已收藏音效**（真数据丢失）。
   * 现契约：**读失败一律上抛**（消费方 sounds-store 落 `savedSoundsError` + toast），
   * 只有「确实为空」（新键无值）才返回空集合 —— 区分「未知」与「不存在」。
   * 【2026-09-16 · TD-02-35】原「旧 IndexedDB 库一次性迁移读」已删（用户裁定不为老用户留兼容）。
   */
  async loadSavedSounds(): Promise<SavedSoundsData> {
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

  // 【2026-09-16 · TD-02-35 已删】原 `migrateSavedSoundsFromIndexedDbOnce()` —— 把老用户机器上
  // 旧 IndexedDB 库（`video-editor-saved-sounds`）的收藏音效搬到新键。用户裁定「不为老用户留兼容，
  // 只管正确性」⇒ 删除：剪辑器**零**浏览器 IndexedDB 依赖，不再有任何存量迁移路径。

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

  // ── 【2026-09-17 TD-22-62④ · 已删 `isSoundSaved`】──
  // 原实现 `catch { logger.error; return false }`：把「读不出来」伪装成「没收藏」（Step 4 兜底形态
  // 「失败归一 boolean」），与本文件另 3 处（save／remove／clear）的 throw 契约不对称
  //（TD-02-35 修了那 3 处、漏了这第 4 处）。
  // **但取证发现它零消费者**（全仓 grep `isSoundSaved` 只命中：本定义 · `sounds-store.ts` 里
  // 同名**同步内存态**版本 · UI `sounds.tsx` 用的是 **store 那个**）⇒ 它是 M6 幽灵预留，
  // 不该"改成 throw"给死代码续命 —— 按 Step 6「删旧先证死」直接删（复杂度实减）。
  // 若将来真需要"从存储直查收藏态"，应复用 `loadSavedSounds()` + 调用方自行判定，勿恢复本方法。

  async clearSavedSounds(): Promise<void> {
    try {
      await contentDeleteAsync(KEY_VIDEO_EDITOR_SAVED_SOUNDS);
    } catch (error) {
      logger.error('videoEditor', 'clear-sounds', (error as { message?: string })?.message);
      throw error;
    }
  }

  // 【2026-09-16 · TD-02-35 已删】原 `isOPFSSupported()` / `isIndexedDBSupported()` /
  // `isFullySupported()` —— 三者构成一条**只在内部自环**的幽灵链（全库零外部消费者），
  // 且语义是"本应用依赖 IndexedDB/OPFS"（已不成立）。剪辑器现在只依赖 contentStore。
}

export const storageService = new StorageService();
export { StorageService };
