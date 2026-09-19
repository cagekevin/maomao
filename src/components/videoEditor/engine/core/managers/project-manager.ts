import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import type {
  SaveOutcome,
  TProject,
  TProjectMetadata,
  TProjectSortKey,
  TProjectSortOption,
  TProjectSettings,
  TTimelineViewState,
} from '@/components/videoEditor/types/project';
import type { ExportOptions, ExportResult } from '@/components/videoEditor/types/export';
// 更新(2026-09-14)：agent-store 已随 AI 域删除，agentMessages 相关读写一并移除。
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
// 409 判别（T3 验收②）：版本冲突必须如实分类（saveCurrentProject 的 catch）。
import { HttpError } from '../../../../base/api/httpClient.ts';
import { toast } from '@/components/videoEditor/lib/toast';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { canvasToImageDataUrl } from '../../../../base/core/utils.ts';
import { UpdateProjectSettingsCommand } from '@/components/videoEditor/engine/commands/project';
import {
  DEFAULT_FPS,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_COLOR,
} from '@/components/videoEditor/constants/project-constants';
import {
  buildDefaultScene,
  getProjectDurationFromScenes,
} from '@/components/videoEditor/engine/lib/scenes';
import { buildScene } from '@/components/videoEditor/engine/services/renderer/scene-builder';
import { CanvasRenderer } from '@/components/videoEditor/engine/services/renderer/canvas-renderer';
import { DEFAULT_TIMELINE_VIEW_STATE } from '@/components/videoEditor/constants/timeline-constants';

/**
 * 新建工程的格式版本号（写入 `TProject.version`，随包进 KV）。
 * 【2026-09-16 · TD-02-35】原定义在已删除的 `storage/migrations/index.ts`（`CURRENT_PROJECT_VERSION`）。
 * 迁移器整层删除后本常量**无迁移消费者**，仅作为「包内格式标记」由 `TProject.version` 携带。
 */
const CURRENT_PROJECT_VERSION = 3;

export class ProjectManager {
  private active: TProject | null = null;
  private savedProjects: TProjectMetadata[] = [];
  private isLoading = true;
  private isInitialized = false;
  private invalidProjectIds = new Set<string>();
  private listeners = new Set<() => void>();
  /**
   * 上次「作品列表」加载失败的原因（`null` = 无失败）。
   *
   * 【2026-09-17 TD-22-63】原 `loadAllProjects` 的 catch **只 logger** ⇒ 读列表失败时
   * `savedProjects` 停留在 `[]`，切换器的「我的作品」**静默空白**（用户以为"我的作品都没了"），
   * 与"本画布确实还没有作品"**完全无法区分**。持续状态给对读者 —— 参照 `MediaManager.loadError`
   * （TD-22-43②）的既定范式：错误态由列表 UI 渲染，不是 toast（列表是持续可见的面板）。
   */
  private projectsLoadError: string | null = null;

  constructor(private editor: EditorCore) {}

  // 【2026-09-16 · TD-02-35 已删】原 `ensureStorageMigrations()` —— 这是**第二套**迁移编排
  // （与 storageService 内部同名逻辑重复，同一件事两个入口）；连同 `MigrationState` 接口、
  // `migrationState` 进度态、`getMigrationState()` 一并删除：迁移器整层已移除，且进度态从未被 UI 消费。

  async createNewProject({ name }: { name: string }): Promise<string> {
    const mainScene = buildDefaultScene({ name: 'Main scene', isMain: true });
    const newProject: TProject = {
      metadata: {
        id: generateUUID(),
        name,
        duration: getProjectDurationFromScenes({ scenes: [mainScene] }),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      scenes: [mainScene],
      currentSceneId: mainScene.id,
      settings: {
        fps: DEFAULT_FPS,
        canvasSize: DEFAULT_CANVAS_SIZE,
        originalCanvasSize: null,
        background: {
          type: 'color',
          color: DEFAULT_COLOR,
        },
      },
      version: CURRENT_PROJECT_VERSION,
    };

    // 新建 = 换到一份空上下文：先释放旧项目的一切（走唯一入口），再落新项目。
    this.editor.releaseProjectContext();

    this.active = newProject;
    this.notify();

    this.editor.scenes.initializeScenes({
      scenes: newProject.scenes,
      currentSceneId: newProject.currentSceneId,
    });

    try {
      await storageService.saveProject({ project: newProject });
      this.updateMetadata(newProject);

      return newProject.metadata.id;
    } catch (error) {
      toast.error('Failed to save new project');
      throw error;
    }
  }

  async loadProject({ id }: { id: string }): Promise<void> {
    if (!this.isInitialized) {
      this.isLoading = true;
      this.notify();
    }

    if (this.active) {
      // 切工程前必须**真正**落盘 —— flush 现在先等掉在途保存、再保存一次并返回真实结果（TD-22-33）。
      // 失败不阻断切换（用户已通过 SaveManager 的提示知道"本次改动没保存"），但要留痕。
      const saveOutcome = await this.editor.save.flush();
      if (!saveOutcome.ok) {
        videoEditorLogger.warn('视频剪辑器：切工程前保存未成功，旧工程可能丢失最后一次改动', {
          reason: saveOutcome.reason,
        });
      }
    }
    this.editor.save.pause();

    try {
      const result = await storageService.loadProject({ id });
      if (!result) {
        throw new Error(`Project with id ${id} not found`);
      }

      const project = result.project;

      // 加载成功之后才释放旧上下文 —— 加载失败时保留当前项目（见下方 catch）。
      // 释放走唯一入口（原为手写的 media+scenes 两行，漏了命令栈/选择/音频 → TD-22-45/46）。
      this.editor.releaseProjectContext();

      this.active = project;
      this.notify();

      if (project.scenes && project.scenes.length > 0) {
        this.editor.scenes.initializeScenes({
          scenes: project.scenes,
          currentSceneId: project.currentSceneId,
        });
      }

      // 素材加载失败**不阻断**工程加载（场景/时间轴仍可用），但必须对用户可见：
      // 可见性真源 = `media.loadError`（持续状态 → 素材面板渲染错误态，TD-22-43②）；
      // `superseded` 是正常并发丢弃（更新的加载已接手），**不**提示。
      const mediaOutcome = await this.editor.media.loadProjectMedia({ projectId: id });
      if (!mediaOutcome.ok && mediaOutcome.reason === 'load-failed') {
        videoEditorLogger.warn(
          '视频剪辑器：素材加载失败，素材面板将显示错误态',
          mediaOutcome.message,
        );
      }

      if (!project.metadata.thumbnail) {
        const didUpdateThumbnail = await this.updateThumbnailFromTimeline();
        if (didUpdateThumbnail) {
          // 缩略图落盘失败不阻断工程加载（附属信息）；失败已由 saveCurrentProject 留痕。
          await this.saveCurrentProject();
        }
      }
    } catch (error) {
      videoEditorLogger.error('Failed to load project:', error);
      throw error;
    } finally {
      this.isLoading = false;
      this.notify();
      this.editor.save.resume();
    }
  }

  /**
   * 保存当前工程。
   *
   * 【为什么返回判别、且失败**不再吞**（TD-22-33 根因的另一半）】原实现在此 `catch` 里吞掉失败
   * （非 409 只 `logger.error`、**不 rethrow**、`return` void）→ `SaveManager.saveNow` 的 `await`
   * 无论成败都"成功返回" → **脏数据被当作已保存**（`hasPendingSave` 被清、`beforeunload` 也不再拦），
   * 用户零感知。现在如实返回判别；**可见性由唯一读者 `SaveManager` 给**（它知道"自动保存失败"这件事）。
   */
  async saveCurrentProject(): Promise<SaveOutcome> {
    if (!this.active) return { ok: false, reason: 'no-project', message: '没有活跃工程' };

    try {
      const scenes = this.editor.scenes.getScenes();
      // 更新(2026-09-14)：agentMessages 随 AI 域删除，不再写入（docs/130-cutia搬迁计划书）。
      const updatedProject = {
        ...this.active,
        scenes,
        metadata: {
          ...this.active.metadata,
          duration: getProjectDurationFromScenes({ scenes }),
          updatedAt: new Date(),
        },
      };

      await storageService.saveProject({ project: updatedProject });
      this.active = updatedProject;
      this.updateMetadata(updatedProject);
      return { ok: true };
    } catch (error) {
      // ── 409（版本冲突）：服务端拒收 = 本次一个字节都没写 —— 单独一类（docs/134 T3 验收② /
      // docs/133 §3.5 D-4）。此处只**如实分类 + 留痕**，用户提示交给 SaveManager（同一读者层）。
      if (error instanceof HttpError && error.status === 409) {
        videoEditorLogger.warn('视频剪辑器：工程保存被拒（版本冲突，本次未写入）', error);
        return { ok: false, reason: 'conflict', message: '本次改动未保存，请刷新后重试' };
      }
      videoEditorLogger.error('Failed to save project:', error);
      return {
        ok: false,
        reason: 'save-failed',
        message: error instanceof Error ? error.message : '保存失败',
      };
    }
  }

  async export({ options }: { options: ExportOptions }): Promise<ExportResult> {
    return this.editor.renderer.exportProject({ options });
  }

  async loadAllProjects(): Promise<void> {
    if (!this.isInitialized) {
      this.isLoading = true;
      this.notify();
    }

    try {
      const metadata = await storageService.loadAllProjectsMetadata();
      this.savedProjects = metadata;
      this.projectsLoadError = null;
      this.notify();
    } catch (error) {
      // 【2026-09-17 TD-22-63】原实现**只 logger** ⇒ 列表静默空白（"作品都没了" vs "确实还没有作品"
      // 无法区分）。改为持续错误态（读 `getProjectsLoadError()`）—— 与 MediaManager.loadError 同范式。
      // 为什么不 rethrow：读列表失败**不该**阻断整个剪辑器加载（当前作品可能好着呢）。
      videoEditorLogger.error('Failed to load projects:', error);
      this.projectsLoadError =
        error instanceof Error ? error.message : '作品列表加载失败，请稍后重试';
    } finally {
      this.isLoading = false;
      this.isInitialized = true;
      this.notify();
    }
  }

  async deleteProjects({ ids }: { ids: string[] }): Promise<void> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return;

    try {
      await Promise.all(
        uniqueIds.map((id) =>
          Promise.all([
            storageService.deleteProjectMedia({ projectId: id }),
            storageService.deleteProject({ id }),
          ]),
        ),
      );

      const idSet = new Set(uniqueIds);
      this.savedProjects = this.savedProjects.filter((project) => !idSet.has(project.id));

      const shouldClearActive = this.active && idSet.has(this.active.metadata.id);

      // 删掉的正是当前项目 → 释放整个上下文（唯一入口）。
      // 删的是别的项目时**不动**当前会话 —— 它没被影响。
      if (shouldClearActive) {
        this.editor.releaseProjectContext();
      }

      this.notify();
    } catch (error) {
      // 【2026-09-17 TD-16-27】原实现只 logger **不 rethrow** ⇒ 调用方（`editor-header.tsx`
      // `handleDeleteProject`）已经写好的 `catch → toast.error('删除项目失败')` **永不触发**
      // = 死代码，用户删项目失败**零提示**。库不替调用方决定错误怎么呈现：
      // 留痕（开发者）+ 原样上抛（由拥有 UI 的那层提示）。
      // 注：`Promise.all` 抛在 `savedProjects.filter` 之前 ⇒ 失败时列表未被改动，无脏状态可回滚。
      videoEditorLogger.error('Failed to delete projects:', error);
      throw error;
    }
  }

  /**
   * 清空「活跃项目」这一项（**只动 active**）。
   *
   * 【为什么只有这一项】项目列表 / 无效 id 集 / 初始化标记都是**跨项目**状态，
   * 不属于「当前项目上下文」，不能连坐清掉。
   * 【调用方】`EditorCore.releaseProjectContext()` —— 上下文释放的唯一编排点，
   * 本方法只是它在 ProjectManager 上的一格。
   * 【历史】原方法名 `closeProject()` 且顺手清了 media+scenes —— 那种「一个方法清一半」
   * 正是 4 处散写、处处漏记的来源（命令栈/选择/音频无人清 → TD-22-45/46）。已删名。
   */
  clearActive(): void {
    this.active = null;
    this.notify();
  }

  async renameProject({ id, name }: { id: string; name: string }): Promise<void> {
    try {
      const result = await storageService.loadProject({ id });
      if (!result) {
        toast.error('Project not found', {
          description: 'Please try again',
        });
        return;
      }

      const updatedProject: TProject = {
        ...result.project,
        metadata: {
          ...result.project.metadata,
          name,
          updatedAt: new Date(),
        },
      };

      await storageService.saveProject({ project: updatedProject });

      if (this.active?.metadata.id === id) {
        this.active = updatedProject;
        this.notify();
      }

      this.updateMetadata(updatedProject);
    } catch (error) {
      videoEditorLogger.error('Failed to rename project:', error);
      toast.error('Failed to rename project', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  }

  async duplicateProjects({ ids }: { ids: string[] }): Promise<string[]> {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return [];

    try {
      const getDuplicateBaseName = ({ name }: { name: string }) => {
        const match = name.match(/^\((\d+)\)\s+(.+)$/);
        const number = match ? Number.parseInt(match[1], 10) : null;
        const baseName = match ? match[2] : name;
        return { baseName, number };
      };

      const loadResults = await Promise.all(
        uniqueIds.map(async (projectId) => {
          const result = await storageService.loadProject({ id: projectId });
          return { projectId, project: result?.project ?? null };
        }),
      );

      const missingProjectIds = loadResults
        .filter((result) => !result.project)
        .map((result) => result.projectId);

      if (missingProjectIds.length > 0) {
        toast.error(missingProjectIds.length === 1 ? 'Project not found' : 'Projects not found', {
          description:
            missingProjectIds.length === 1
              ? 'Please try again'
              : 'Some projects could not be found',
        });
        throw new Error(`Projects not found: ${missingProjectIds.join(', ')}`);
      }

      const projectsToDuplicate = loadResults.flatMap((result) =>
        result.project ? [result.project] : [],
      );

      const maxNumberByBaseName = new Map<string, number>();

      for (const project of this.savedProjects) {
        const { baseName, number } = getDuplicateBaseName({
          name: project.name,
        });

        if (number === null) continue;

        const currentMax = maxNumberByBaseName.get(baseName);
        if (currentMax === undefined || number > currentMax) {
          maxNumberByBaseName.set(baseName, number);
        }
      }

      const nextNumberByBaseName = new Map<string, number>();
      for (const [baseName, maxNumber] of maxNumberByBaseName) {
        nextNumberByBaseName.set(baseName, maxNumber + 1);
      }

      const duplicationPlans = projectsToDuplicate.map((project) => {
        const { baseName } = getDuplicateBaseName({
          name: project.metadata.name,
        });
        const nextNumber = nextNumberByBaseName.get(baseName) ?? 1;
        nextNumberByBaseName.set(baseName, nextNumber + 1);

        const newProjectId = generateUUID();
        const newProject: TProject = {
          ...project,
          metadata: {
            ...project.metadata,
            id: newProjectId,
            name: `(${nextNumber}) ${baseName}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };

        return {
          newProjectId,
          newProject,
          sourceProjectId: project.metadata.id,
        };
      });

      await Promise.all(
        duplicationPlans.map(({ newProject }) =>
          storageService.saveProject({ project: newProject }),
        ),
      );

      await Promise.all(
        duplicationPlans.map(async ({ sourceProjectId, newProjectId }) => {
          const {
            items: sourceMediaAssets,
            missing: sourceMissing,
            shapeError: sourceShapeError,
          } = await storageService.loadAllMediaAssets({
            projectId: sourceProjectId,
          });
          if (sourceMissing.length > 0 || sourceShapeError) {
            // 复制工程时源工程有读不出的素材（或元数据表整体读坏）⇒ 副本同样会缺，
            // 必须可见（TD-16-27 + 2026-09-17「判别联合透传」）。此处只转发事实，不加工文案。
            videoEditorLogger.warn('复制工程：源工程素材读取不完整，未被复制', {
              sourceProjectId,
              missing: sourceMissing,
              shapeError: sourceShapeError,
            });
          }

          await Promise.all(
            sourceMediaAssets.map((mediaAsset) =>
              storageService.saveMediaAsset({
                projectId: newProjectId,
                mediaAsset,
              }),
            ),
          );
        }),
      );

      for (const { newProject } of duplicationPlans) {
        this.updateMetadata(newProject);
      }

      return duplicationPlans.map((plan) => plan.newProjectId);
    } catch (error) {
      videoEditorLogger.error('Failed to duplicate projects:', error);
      toast.error('Failed to duplicate projects', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      throw error;
    }
  }

  async updateSettings({
    settings,
    pushHistory = true,
  }: {
    settings: Partial<TProjectSettings>;
    pushHistory?: boolean;
  }): Promise<void> {
    if (!this.active) return;

    const command = new UpdateProjectSettingsCommand(settings);
    if (pushHistory) {
      this.editor.command.execute({ command });
      return;
    }

    command.execute();
  }

  async updateThumbnail({ thumbnail }: { thumbnail: string }): Promise<void> {
    if (!this.active) return;

    const updatedProject: TProject = {
      ...this.active,
      metadata: { ...this.active.metadata, thumbnail, updatedAt: new Date() },
    };
    this.active = updatedProject;
    this.notify();
    this.updateMetadata(updatedProject);
    this.editor.save.markDirty();
  }

  async prepareExit(): Promise<void> {
    if (!this.active) return;

    try {
      await this.updateThumbnailFromTimeline();
    } catch (error) {
      // 缩略图是附属信息：失败不阻断退出（退出是用户意志），留痕后继续落盘。
      videoEditorLogger.error('Failed to generate project thumbnail on exit:', error);
    }

    // 【为什么**无条件** flush（TD-22-33）】原实现把 flush 放在 `if (didUpdateThumbnail)` 里 ——
    // 退出时若没有更新缩略图，防抖队列里的**最后变更根本不落盘**（退出 = 丢改动）。
    // flush 现在返回真实结果（先等掉在途保存、再真正保存一次），失败也已由 SaveManager
    // 给用户可见提示（自动保存的唯一读者），故此处的失败不阻断退出。
    await this.editor.save.flush();
  }

  getFilteredAndSortedProjects({
    searchQuery,
    sortOption,
  }: {
    searchQuery: string;
    sortOption: TProjectSortOption;
  }): TProjectMetadata[] {
    const filteredProjects = this.savedProjects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const [key, order] = sortOption.split('-') as [TProjectSortKey, 'asc' | 'desc'];

    const sortedProjects = [...filteredProjects].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      if (order === 'asc') {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      }
      if (aValue > bValue) return -1;
      if (aValue < bValue) return 1;
      return 0;
    });

    return sortedProjects;
  }

  isInvalidProjectId({ id }: { id: string }): boolean {
    return this.invalidProjectIds.has(id);
  }

  markProjectIdAsInvalid({ id }: { id: string }): void {
    this.invalidProjectIds.add(id);
    this.notify();
  }

  clearInvalidProjectIds(): void {
    this.invalidProjectIds.clear();
    this.notify();
  }

  getActive(): TProject {
    if (!this.active) {
      throw new Error('No active project');
    }
    return this.active;
  }

  /**
   * for agents:
   * in most cases, the project is guaranteed to be active, in which getActive() should be used instead.
   * for very rare cases, this function may be used.
   */
  getActiveOrNull(): TProject | null {
    return this.active;
  }

  getTimelineViewState(): TTimelineViewState {
    return this.active?.timelineViewState ?? DEFAULT_TIMELINE_VIEW_STATE;
  }

  setTimelineViewState({ viewState }: { viewState: TTimelineViewState }): void {
    if (!this.active) return;
    this.active = {
      ...this.active,
      timelineViewState: viewState ?? undefined,
    };
    this.editor.save.markDirty();
  }

  getSavedProjects(): TProjectMetadata[] {
    return this.savedProjects;
  }

  /** 上次「作品列表」加载的失败原因；`null` = 无失败（TD-22-63 的错误态真源）。 */
  getProjectsLoadError(): string | null {
    return this.projectsLoadError;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  // 【2026-09-16 · TD-02-35 已删】原 `getMigrationState()` —— 全库零调用（与迁移器一同移除）。

  setActiveProject({ project }: { project: TProject }): void {
    this.active = project;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static readonly THUMBNAIL_MAX_WIDTH = 320;
  private static readonly THUMBNAIL_JPEG_QUALITY = 0.7;
  private static readonly THUMBNAIL_TIME_RATIO = 1 / 3;

  private async updateThumbnailFromTimeline(): Promise<boolean> {
    if (!this.active) return false;

    const tracks = this.editor.timeline.getTracks();
    const mediaAssets = this.editor.media.getAssets();
    const duration = this.editor.timeline.getTotalDuration();

    if (duration === 0) return false;

    const { canvasSize, originalCanvasSize, background } = this.active.settings;

    const aspectRatio = canvasSize.height / canvasSize.width;
    const thumbWidth = Math.min(canvasSize.width, ProjectManager.THUMBNAIL_MAX_WIDTH);
    const thumbHeight = Math.round(thumbWidth * aspectRatio);

    const scene = buildScene({
      tracks,
      mediaAssets,
      duration,
      canvasSize,
      fitCanvasSize: originalCanvasSize ?? canvasSize,
      background,
    });

    const renderer = new CanvasRenderer({
      width: canvasSize.width,
      height: canvasSize.height,
      fps: this.active.settings.fps,
    });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = thumbWidth;
    tempCanvas.height = thumbHeight;

    const representativeTime = duration * ProjectManager.THUMBNAIL_TIME_RATIO;

    await renderer.renderToCanvas({
      node: scene,
      time: representativeTime,
      targetCanvas: tempCanvas,
    });

    // 唯一出口（产出即校验）：失败抛错 → 两处调用方（加载 / prepareExit）均有 try/catch 留痕
    const thumbnailDataUrl = canvasToImageDataUrl(
      tempCanvas,
      'image/jpeg',
      ProjectManager.THUMBNAIL_JPEG_QUALITY,
    );

    await this.updateThumbnail({ thumbnail: thumbnailDataUrl });
    return true;
  }

  private updateMetadata(project: TProject): void {
    const index = this.savedProjects.findIndex((p) => p.id === project.metadata.id);

    if (index !== -1) {
      this.savedProjects[index] = project.metadata;
    } else {
      this.savedProjects = [project.metadata, ...this.savedProjects];
    }

    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
