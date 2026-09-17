import type { EditorCore } from '@/components/videoEditor/engine/core';
import type { TimelineTrack, TScene } from '@/components/videoEditor/types/timeline';
import { getMainScene, ensureMainScene } from '@/components/videoEditor/engine/lib/scenes';
import { getFrameTime, isBookmarkAtTime } from '@/components/videoEditor/engine/timeline/bookmarks';
import { ensureMainTrack } from '@/components/videoEditor/engine/timeline/track-utils';
import {
  RemoveBookmarkCommand,
  ToggleBookmarkCommand,
} from '@/components/videoEditor/engine/commands/scene';

export class ScenesManager {
  /**
   * 【2026-09-17 TD-22-63 · 已删场景层幽灵预留（弯路留痕 · 必读）】
   * 本类曾有 5 个零消费者方法：`loadProjectScenes` / `createScene` / `deleteScene` /
   * `renameScene` / `switchToScene`，以及仅被它们使用的 `CreateSceneCommand` /
   * `DeleteSceneCommand` / `RenameSceneCommand`（文件已删，命令桶只余书签两命令）。
   *
   * 【为什么是删而不是补】取证链（每步都有 grep 硬证据）：
   *  ① 五方法全仓 **0 消费者** —— 多场景是引擎层半成品：命令/manager 全建好，UI 从未接线；
   *  ② 没有任何入口能建第二个场景 ⇒ 运行期每部作品恒只有一个主场景（`ensureMainScene` 兜底）；
   *  ③ 多场景产品语义本身不完整：预览/导出只渲染**活跃场景**（renderer-manager → getTracks），
   *     作品时长只算**主场景**（getProjectDurationFromScenes）—— 第二个场景建出来就是孤岛；
   *  ④ "作品"层的完整生命周期 UI 已存在（editor-header：新建/切换/重命名/删除）——
   *     用户概念里的"新建/重命名/删除"在**作品**层全部有着落，场景层无从对应。
   * ⇒ 2026-09-17 用户裁定「删」。将来真要多幕/多分镜：**整层重做**（含导出语义：多场景
   *    拼接还是只出活跃场景——这是产品决策），不要在本类上复活单个方法。
   *
   * 【差点踩的坑】`switchToScene` 有一个行为锁（TD-22-32「切场景清命令栈与选择」，
   * 原在 veProjectContextRelease.test.ts）—— 有测试≠有消费者，测试锁的是
   * "如果切场景，必须清上下文"这个**条件不变式**；触发条件本身不存在时，锁的是空集。
   * 判据：先证消费（运行时调用链），再看测试；"测试在锁它"不构成保留理由。
   */
  private active: TScene | null = null;
  private list: TScene[] = [];
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

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
