import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type { TProject, TProjectSettings } from '@/components/videoEditor/types/project';

export class UpdateProjectSettingsCommand extends Command {
  private savedSettings: TProjectSettings | null = null;
  private savedUpdatedAt: Date | null = null;

  constructor(private updates: Partial<TProjectSettings>) {
    super();
  }

  execute(): void {
    const editor = getEditor();
    const activeProject = editor.project.getActive();
    if (!activeProject) return;

    this.savedSettings = activeProject.settings;
    this.savedUpdatedAt = activeProject.metadata.updatedAt;

    const updatedProject: TProject = {
      ...activeProject,
      settings: { ...activeProject.settings, ...this.updates },
      metadata: { ...activeProject.metadata, updatedAt: new Date() },
    };

    editor.project.setActiveProject({ project: updatedProject });
    editor.save.markDirty();
  }

  undo(): void {
    if (!this.savedSettings || !this.savedUpdatedAt) return;
    const editor = getEditor();
    const activeProject = editor.project.getActive();
    if (!activeProject) return;

    const updatedProject: TProject = {
      ...activeProject,
      settings: this.savedSettings,
      metadata: { ...activeProject.metadata, updatedAt: this.savedUpdatedAt },
    };

    editor.project.setActiveProject({ project: updatedProject });
    editor.save.markDirty();
  }
}
