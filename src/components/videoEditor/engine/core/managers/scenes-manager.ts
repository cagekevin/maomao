import { logger } from '@/components/videoEditor/lib/logger';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import type { TimelineTrack, TScene } from '@/components/videoEditor/types/timeline';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import {
  getMainScene,
  ensureMainScene,
  canDeleteScene,
  findCurrentScene,
} from '@/components/videoEditor/engine/lib/scenes';
import { getFrameTime, isBookmarkAtTime } from '@/components/videoEditor/engine/timeline/bookmarks';
import { ensureMainTrack } from '@/components/videoEditor/engine/timeline/track-utils';
import {
  CreateSceneCommand,
  DeleteSceneCommand,
  RemoveBookmarkCommand,
  RenameSceneCommand,
  ToggleBookmarkCommand,
} from '@/components/videoEditor/engine/commands/scene';

export class ScenesManager {
  private active: TScene | null = null;
  private list: TScene[] = [];
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

  async createScene({ name, isMain = false }: { name: string; isMain: boolean }): Promise<string> {
    if (!this.editor.project.getActive()) {
      throw new Error('No active project');
    }

    const command = new CreateSceneCommand(name, isMain);
    this.editor.command.execute({ command });
    return command.getSceneId();
  }

  async deleteScene({ sceneId }: { sceneId: string }): Promise<void> {
    const sceneToDelete = this.list.find((s) => s.id === sceneId);

    if (!sceneToDelete) {
      throw new Error('Scene not found');
    }

    const { canDelete, reason } = canDeleteScene({ scene: sceneToDelete });
    if (!canDelete) {
      throw new Error(reason);
    }

    if (!this.editor.project.getActive()) {
      throw new Error('No active project');
    }

    const command = new DeleteSceneCommand(sceneId);
    this.editor.command.execute({ command });
  }

  async renameScene({ sceneId, name }: { sceneId: string; name: string }): Promise<void> {
    if (!this.editor.project.getActive()) {
      throw new Error('No active project');
    }

    const command = new RenameSceneCommand(sceneId, name);
    this.editor.command.execute({ command });
  }

  async switchToScene({ sceneId }: { sceneId: string }): Promise<void> {
    const targetScene = this.list.find((s) => s.id === sceneId);

    if (!targetScene) {
      throw new Error('Scene not found');
    }

    // 切场景 = 切编辑上下文（与切项目同根，TD-22-32/45）。
    // 命令栈里的 `savedState` 快照属于**上一个场景**的 tracks；撤销时不区分场景，
    // 会把 A 场景的快照整体写进 B 场景。全局单栈无法表达「跨场景撤销」，
    // 故清栈是唯一正确解（而不是让每个命令去猜自己属于哪个场景）。
    // 选择同理：`{trackId, elementId}` 在新场景里已无对应元素 → 幽灵选择。
    this.editor.command.clear();
    this.editor.selection.clearSelection();

    const activeProject = this.editor.project.getActive();

    if (activeProject) {
      const updatedProject = {
        ...activeProject,
        currentSceneId: sceneId,
        metadata: {
          ...activeProject.metadata,
          updatedAt: new Date(),
        },
      };

      this.editor.project.setActiveProject({ project: updatedProject });
    }

    this.active = targetScene;
    this.notify();
  }

  async toggleBookmark({ time }: { time: number }): Promise<void> {
    const command = new ToggleBookmarkCommand(time);
    this.editor.command.execute({ command });
  }

  isBookmarked({ time }: { time: number }): boolean {
    const activeScene = this.getActiveScene();
    const activeProject = this.editor.project.getActive();

    if (!activeScene || !this.active || !activeProject) return false;

    const frameTime = getFrameTime({
      time,
      fps: activeProject.settings.fps,
    });

    return isBookmarkAtTime({ bookmarks: activeScene.bookmarks, frameTime });
  }

  async removeBookmark({ time }: { time: number }): Promise<void> {
    const command = new RemoveBookmarkCommand(time);
    this.editor.command.execute({ command });
  }

  async loadProjectScenes({ projectId }: { projectId: string }): Promise<void> {
    try {
      const result = await storageService.loadProject({ id: projectId });
      if (result?.project.scenes) {
        const { scenes: ensuredScenes, hasAddedMainTrack } = this.ensureScenesHaveMainTrack({
          scenes: result.project.scenes ?? [],
        });
        const currentScene = findCurrentScene({
          scenes: ensuredScenes,
          currentSceneId: result.project.currentSceneId,
        });

        this.list = ensuredScenes;
        this.active = currentScene;
        this.notify();

        if (hasAddedMainTrack) {
          const activeProject = this.editor.project.getActive();
          if (activeProject) {
            const updatedProject = {
              ...activeProject,
              scenes: ensuredScenes,
              metadata: {
                ...activeProject.metadata,
                updatedAt: new Date(),
              },
            };
            this.editor.project.setActiveProject({ project: updatedProject });
            this.editor.save.markDirty({ force: true });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load project scenes:', error);
      this.list = [];
      this.active = null;
      this.notify();
    }
  }

  initializeScenes({
    scenes,
    currentSceneId,
  }: {
    scenes: TScene[];
    currentSceneId?: string;
  }): void {
    const ensuredScenes = ensureMainScene({ scenes });
    const { scenes: scenesWithMainTracks, hasAddedMainTrack } = this.ensureScenesHaveMainTrack({
      scenes: ensuredScenes,
    });
    const currentScene = currentSceneId
      ? scenesWithMainTracks.find((s) => s.id === currentSceneId)
      : null;

    const fallbackScene = getMainScene({ scenes: scenesWithMainTracks });

    this.list = scenesWithMainTracks;
    this.active = currentScene || fallbackScene;
    this.notify();

    const hasAddedMainScene = ensuredScenes.length > scenes.length;
    if (hasAddedMainScene || hasAddedMainTrack) {
      const activeProject = this.editor.project.getActive();

      if (activeProject) {
        const updatedProject = {
          ...activeProject,
          scenes: scenesWithMainTracks,
          metadata: {
            ...activeProject.metadata,
            updatedAt: new Date(),
          },
        };

        this.editor.project.setActiveProject({ project: updatedProject });
        this.editor.save.markDirty({ force: true });
      }
    }
  }

  clearScenes(): void {
    this.list = [];
    this.active = null;
    this.notify();
  }

  /**
   * 活跃场景（**可能为空**）。与 `ProjectManager.getActiveOrNull()` 同惯例。
   * 「选择有效性」等**只读派生**用它（无活跃场景 = 没有有效选择），不要用会抛错的版本。
   */
  getActiveSceneOrNull(): TScene | null {
    return this.active;
  }

  getActiveScene(): TScene {
    const scene = this.getActiveSceneOrNull();
    if (!scene) {
      throw new Error('No active scene.');
    }
    return scene;
  }

  getScenes(): TScene[] {
    return this.list;
  }

  setScenes({ scenes, activeSceneId }: { scenes: TScene[]; activeSceneId?: string }): void {
    this.list = scenes;
    const nextActiveSceneId = activeSceneId ?? this.active?.id ?? null;
    this.active = nextActiveSceneId
      ? (scenes.find((scene) => scene.id === nextActiveSceneId) ?? null)
      : null;
    this.notify();

    const activeProject = this.editor.project.getActive();
    if (activeProject) {
      const updatedProject = {
        ...activeProject,
        scenes,
        metadata: {
          ...activeProject.metadata,
          updatedAt: new Date(),
        },
      };
      this.editor.project.setActiveProject({ project: updatedProject });
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  updateSceneTracks({ tracks }: { tracks: TimelineTrack[] }): void {
    if (!this.active) return;

    const updatedScene: TScene = {
      ...this.active,
      tracks,
      updatedAt: new Date(),
    };

    this.list = this.list.map((s) => (s.id === this.active?.id ? updatedScene : s));
    this.active = updatedScene;
    this.notify();

    const activeProject = this.editor.project.getActive();
    if (activeProject) {
      const updatedProject = {
        ...activeProject,
        scenes: this.list,
        metadata: {
          ...activeProject.metadata,
          updatedAt: new Date(),
        },
      };
      this.editor.project.setActiveProject({ project: updatedProject });
    }
  }

  private ensureScenesHaveMainTrack({ scenes }: { scenes: TScene[] }): {
    scenes: TScene[];
    hasAddedMainTrack: boolean;
  } {
    let hasAddedMainTrack = false;
    const ensuredScenes: TScene[] = [];

    for (const scene of scenes) {
      const existingTracks = scene.tracks ?? [];
      const updatedTracks = ensureMainTrack({ tracks: existingTracks });
      if (updatedTracks !== existingTracks) {
        hasAddedMainTrack = true;
        ensuredScenes.push({
          ...scene,
          tracks: updatedTracks,
          updatedAt: new Date(),
        });
      } else {
        ensuredScenes.push(scene);
      }
    }

    return { scenes: ensuredScenes, hasAddedMainTrack };
  }
}
