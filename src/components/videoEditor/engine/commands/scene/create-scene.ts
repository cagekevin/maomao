import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { EditorCore } from '@/components/videoEditor/engine/core';
import type { TScene } from '@/components/videoEditor/types/timeline';
import { buildDefaultScene } from '@/components/videoEditor/engine/lib/scenes';

export class CreateSceneCommand extends Command {
  private savedScenes: TScene[] | null = null;
  private createdScene: TScene | null = null;

  constructor(
    private name: string,
    private isMain: boolean = false,
  ) {
    super();
  }

  execute(): void {
    const editor = EditorCore.getInstance();
    this.savedScenes = [...editor.scenes.getScenes()];

    this.createdScene = buildDefaultScene({
      name: this.name,
      isMain: this.isMain,
    });

    const updatedScenes = [...this.savedScenes, this.createdScene];
    editor.scenes.setScenes({ scenes: updatedScenes });
  }

  undo(): void {
    if (this.savedScenes) {
      const editor = EditorCore.getInstance();
      editor.scenes.setScenes({ scenes: this.savedScenes });
    }
  }

  getSceneId(): string {
    return this.createdScene?.id ?? '';
  }
}
