import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type { TScene } from '@/components/videoEditor/types/timeline';
import { updateSceneInArray } from '@/components/videoEditor/engine/lib/scenes';
import {
  getFrameTime,
  toggleBookmarkInArray,
} from '@/components/videoEditor/engine/timeline/bookmarks';

export class ToggleBookmarkCommand extends Command {
  private savedScenes: TScene[] | null = null;
  private frameTime: number = 0;

  constructor(private time: number) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    const activeScene = editor.scenes.getActiveScene();
    const activeProject = editor.project.getActive();

    if (!activeScene || !activeProject) {
      return;
    }

    const scenes = editor.scenes.getScenes();
    this.savedScenes = [...scenes];

    this.frameTime = getFrameTime({
      time: this.time,
      fps: activeProject.settings.fps,
    });

    const updatedBookmarks = toggleBookmarkInArray({
      bookmarks: activeScene.bookmarks,
      frameTime: this.frameTime,
    });

    const updatedScenes = updateSceneInArray({
      scenes,
      sceneId: activeScene.id,
      updates: { bookmarks: updatedBookmarks },
    });

    editor.scenes.setScenes({ scenes: updatedScenes });
  }

  undo(): void {
    if (this.savedScenes) {
      const editor = getEditor();
      editor.scenes.setScenes({ scenes: this.savedScenes });
    }
  }
}
