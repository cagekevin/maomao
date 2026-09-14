'use client';

import { Button } from '../ui/button';
import { useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { RenameProjectDialog } from './dialogs/rename-project-dialog';
import { DeleteProjectDialog } from './dialogs/delete-project-dialog';
import { ExportButton } from './export-button';
import { DEFAULT_LOGO_URL } from '@videoEditor/constants/site-constants';
import { toast } from 'sonner';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import { ArrowLeft02Icon, CommandIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { ShortcutsDialog } from './dialogs/shortcuts-dialog';
import { cn } from '@videoEditor/utils/ui';

// 更新(2026-09-14)：agent-store 已随 AI 域删除。

export function EditorHeader() {
  return (
    <header className="bg-background flex h-[3.4rem] items-center justify-between px-3 pt-0.5">
      <div className="flex items-center gap-1">
        <ProjectDropdown />
        <EditableProjectName />
      </div>
      <nav className="flex items-center gap-2">
        {/* 更新(2026-09-14)：FeedbackTrigger 属整站壳已移除；
				    AgentToggle 随 AI 域（agent-store）一并移除（docs/130-cutia搬迁计划书）。 */}
        <ExportButton />
      </nav>
    </header>
  );
}

function ProjectDropdown() {
  const [openDialog, setOpenDialog] = useState<'delete' | 'rename' | 'shortcuts' | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  // 更新(2026-09-14)：Next router 已移除；退出项目改为由宿主（画布）决定。
  const editor = useEditor();
  const activeProject = editor.project.getActive();

  const handleExit = async () => {
    if (isExiting) return;
    setIsExiting(true);

    try {
      await editor.project.prepareExit();
      editor.project.closeProject();
    } catch (error) {
      console.error('Failed to prepare project exit:', error);
    } finally {
      editor.project.closeProject();
      // 退出目标由宿主控制（原为 next router.push("/projects")）
    }
  };

  const handleSaveProjectName = async (newName: string) => {
    if (activeProject && newName.trim() && newName !== activeProject.metadata.name) {
      try {
        await editor.project.renameProject({
          id: activeProject.metadata.id,
          name: newName.trim(),
        });
      } catch (error) {
        toast.error('重命名项目失败', {
          description: error instanceof Error ? error.message : '请重试',
        });
      } finally {
        setOpenDialog(null);
      }
    }
  };

  const handleDeleteProject = async () => {
    if (activeProject) {
      try {
        await editor.project.deleteProjects({
          ids: [activeProject.metadata.id],
        });
        // 退出目标由宿主控制（原为 next router.push("/projects")）
      } catch (error) {
        toast.error('删除项目失败', {
          description: error instanceof Error ? error.message : '请重试',
        });
      } finally {
        setOpenDialog(null);
      }
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="p-1 rounded-sm size-8">
            {/* 更新(2026-09-14)：原为 next/image 的 <Image>，改原生 <img>
						    （next 依赖已全清，见 docs/130-cutia搬迁计划书）。 */}
            <img
              src={DEFAULT_LOGO_URL}
              alt="Project thumbnail"
              width={32}
              height={32}
              className="dark:invert size-5"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-100 w-52">
          <DropdownMenuItem
            className="flex items-center gap-1.5"
            onClick={handleExit}
            disabled={isExiting}
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
            {'退出项目'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-1.5"
            onClick={() => setOpenDialog('shortcuts')}
          >
            <HugeiconsIcon icon={CommandIcon} className="size-4" />
            {'键盘快捷键'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameProjectDialog
        isOpen={openDialog === 'rename'}
        onOpenChange={(isOpen) => setOpenDialog(isOpen ? 'rename' : null)}
        onConfirm={(newName) => handleSaveProjectName(newName)}
        projectName={activeProject?.metadata.name || ''}
      />
      <DeleteProjectDialog
        isOpen={openDialog === 'delete'}
        onOpenChange={(isOpen) => setOpenDialog(isOpen ? 'delete' : null)}
        onConfirm={handleDeleteProject}
        projectNames={[activeProject?.metadata.name || '']}
      />
      <ShortcutsDialog
        isOpen={openDialog === 'shortcuts'}
        onOpenChange={(isOpen) => setOpenDialog(isOpen ? 'shortcuts' : null)}
      />
    </>
  );
}

function EditableProjectName() {
  const editor = useEditor();
  const activeProject = editor.project.getActive();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalNameRef = useRef('');

  const projectName = activeProject?.metadata.name || '';

  const startEditing = () => {
    if (isEditing) return;
    originalNameRef.current = projectName;
    setIsEditing(true);

    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  };

  const saveEdit = async () => {
    if (!inputRef.current || !activeProject) return;
    const newName = inputRef.current.value.trim();
    setIsEditing(false);

    if (!newName) {
      inputRef.current.value = originalNameRef.current;
      return;
    }

    if (newName !== originalNameRef.current) {
      try {
        await editor.project.renameProject({
          id: activeProject.metadata.id,
          name: newName,
        });
      } catch (error) {
        toast.error('重命名项目失败', {
          description: error instanceof Error ? error.message : '请重试',
        });
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (inputRef.current) {
        inputRef.current.value = originalNameRef.current;
      }
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={projectName}
      readOnly={!isEditing}
      onClick={startEditing}
      onBlur={saveEdit}
      onKeyDown={handleKeyDown}
      style={{ fieldSizing: 'content' }}
      className={cn(
        'text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground',
        isEditing && 'ring-1 ring-ring cursor-text hover:bg-transparent',
      )}
    />
  );
}

/* 更新(2026-09-14)：AgentToggle 已移除 —— 它依赖 agent-store，
   该 store 随 AI 域（docs/130-cutia搬迁计划书）一并删除。 */
