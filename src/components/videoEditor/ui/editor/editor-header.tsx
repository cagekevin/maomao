'use client';

import { useState } from 'react';
import { RenameProjectDialog } from './dialogs/rename-project-dialog';
import { DeleteProjectDialog } from './dialogs/delete-project-dialog';
import { ExportButton } from './export-button';
import { DEFAULT_LOGO_URL } from '@/components/videoEditor/constants/site-constants';
import { toast } from '@/components/videoEditor/lib/toast';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { ShortcutsDialog } from './dialogs/shortcuts-dialog';
import { cn } from '@/components/videoEditor/utils/ui';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import { Plus, Command, ArrowLeft, Pencil, AlertTriangle } from 'lucide-react';

// 更新(2026-09-14)：agent-store 已随 AI 域删除。

export function EditorHeader({ onExit }: { onExit?: () => void }) {
  return (
    <header className="bg-background flex h-10 items-center justify-between px-3">
      {/* 更新(2026-09-14)：顶栏 3.4rem→h-10（40px）——「返回画布 + 导出」这一行占地太大，整体压扁。 */}
      <div className="flex items-center gap-1">
        {/* 更新(2026-09-14 T5-C)：原为「logo 下拉 + 独立可编辑名字」两块并列。
				    现合并为**一个触发器**（logo + 作品名 + 下拉箭头），点它出作品列表（含重命名）。
				    原因：原 UV 里独立 input 与下拉抢同一块位置，且宿主关闭按钮浮在左上角。 */}
        <ProjectDropdown onExit={onExit} />
      </div>
      <nav className="flex items-center gap-2">
        {/* 更新(2026-09-14)：FeedbackTrigger 属整站壳已移除；
				    AgentToggle 随 AI 域（agent-store）一并移除（docs/130-cutia搬迁计划书）。 */}
        <ExportButton />
      </nav>
    </header>
  );
}

function ProjectDropdown({ onExit }: { onExit?: () => void }) {
  const [openDialog, setOpenDialog] = useState<'delete' | 'rename' | 'shortcuts' | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  // 受控面板开关（替代 Radix DropdownMenu，见下方注释）。
  const [menuOpen, setMenuOpen] = useState(false);
  // 更新(2026-09-14)：Next router 已移除；退出项目改为由宿主（画布）决定。
  const editor = useEditor();
  const activeProject = editor.project.getActive();
  // T5-C：本画布的片子列表（EditorProvider 挂载时已 loadAllProjects 填充）。
  const savedProjects = editor.project.getSavedProjects();
  // TD-22-63：列表加载失败的持续错误态真源（重渲染由 use-editor 对 project.subscribe 驱动）。
  const projectsLoadError = editor.project.getProjectsLoadError();

  /**
   * 切换到另一部片子（T5-C）。
   *
   * 【顺序不可颠倒】release → 写 active 键 → load。
   *  · 先 releaseProjectContext 放弃引擎旧态（命令栈/选择/音频/播放/媒体/场景一并重置）——
   *    必须在写 active 键之前：此后若 load 失败，旧项目已被显式放弃，界面是诚实的空态，
   *    而不是「留着 A 的画面、active 键却指向 B」的错位；
   *  · 再 saveActiveEditorId —— **必须在 load 之前**：它的语义是"这部片子是我当前要开的"，
   *    load 失败时 active 键已如实指向 B（刷新会再试 B），而不是留在 A 上撒谎。
   *    【2026-09-15 修正】原注释称"否则 loadProject 仍按旧 editorId 组键，读回的还是上一部" ——
   *    该机制**不存在**：loadProject 一直按传入 `id` 组键（见 storage/service.ts 的 loadProject）。
   *  · 最后 loadProject，引擎重新填充媒体/场景（其内部会再收口一次，幂等）。
   */
  const handleSwitchProject = async (editorId: string) => {
    if (isSwitching || editorId === activeProject?.metadata.id) return;
    setIsSwitching(true);
    try {
      await editor.project.prepareExit();
      editor.releaseProjectContext();
      await storageService.saveActiveEditorId({ editorId });
      await editor.project.loadProject({ id: editorId });
      await editor.project.loadAllProjects();
    } catch (error) {
      toast.error('切换作品失败', {
        description: error instanceof Error ? error.message : '请重试',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  /** 新建一部片子（T5-C）：建 → 记为活跃 → 刷新列表。 */
  const handleCreateProject = async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      await editor.project.prepareExit();
      editor.releaseProjectContext();
      const newId = await editor.project.createNewProject({ name: '未命名作品' });
      await storageService.saveActiveEditorId({ editorId: newId });
      await editor.project.loadAllProjects();
    } catch (error) {
      toast.error('新建作品失败', {
        description: error instanceof Error ? error.message : '请重试',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  // 退出善后（prepareExit + releaseProjectContext）已收口到 EditorShell 的 exitEditorToCanvas，
  // 此处只触发宿主回调；onExit 缺省时整个入口不渲染（下方按钮条件）。

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
      {/* 更新(2026-09-14 T5-C)：原用 Radix DropdownMenu，其在 ve-scope 覆盖层内点击不展开
          （aria-expanded 恒 false）。改用**受控面板**：button + 绝对定位 div，行为完全可控。 */}
      <div className="relative">
        {/* 触发器：logo + 作品名 + 下拉箭头（整块可点）。 */}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="hover:bg-accent/50 flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors"
        >
          <img
            src={DEFAULT_LOGO_URL}
            alt="项目缩略图"
            width={32}
            height={32}
            className="dark:invert size-5"
          />
          <span className="max-w-[14rem] truncate text-[0.9rem]">
            {activeProject?.metadata.name || '未命名作品'}
          </span>
          <svg
            viewBox="0 0 24 24"
            className={cn('size-3.5 opacity-60 transition-transform', menuOpen && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <>
            {/* 点击外部关闭：透明遮罩铺满视口 */}
            <div className="fixed inset-0 z-[99]" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="bg-popover text-popover-foreground border-border absolute top-9 left-0 z-[100] w-56 overflow-hidden rounded-lg border p-2 shadow-lg"
            >
              {/* ── T5-C：本画布的作品（片子）列表 ── */}
              <div className="text-muted-foreground px-2 py-1 text-[0.7rem]">我的作品</div>
              {/* 【2026-09-17 TD-22-63】列表读取失败必须可见：原来失败静默 → 列表空白，
                  用户以为"我的作品都没了"。持续错误态（读 getProjectsLoadError），与素材面板同范式。 */}
              {projectsLoadError ? (
                <div className="text-destructive flex items-start gap-1.5 px-2.5 py-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">作品列表加载失败：{projectsLoadError}</span>
                </div>
              ) : null}
              {savedProjects.map((project) => {
                const isActive = project.id === activeProject?.metadata.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => {
                      setMenuOpen(false);
                      void handleSwitchProject(project.id);
                    }}
                    className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        isActive ? 'bg-primary' : 'bg-transparent',
                      )}
                    />
                    <span className="truncate">{project.name || '未命名作品'}</span>
                  </button>
                );
              })}

              <div className="bg-border/60 mx-1 my-2 h-px" />
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => {
                  setMenuOpen(false);
                  void handleCreateProject();
                }}
                className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-4" />
                {'新建作品'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOpenDialog('rename');
                }}
                className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-sm"
              >
                <Pencil className="size-4" />
                {'重命名作品'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOpenDialog('shortcuts');
                }}
                className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-sm"
              >
                <Command className="size-4" />
                {'键盘快捷键'}
              </button>

              <div className="bg-border/60 mx-1 my-2 h-px" />
              {onExit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onExit();
                  }}
                  className="hover:bg-accent/50 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" />
                  {'退出作品'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
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

/* 更新(2026-09-14 T5-C)：`EditableProjectName`（header 内联可编辑名字输入框）已移除——
   它与「作品切换」触发器抢同一块位置。重命名改由下拉菜单的「重命名作品」项
   打开 RenameProjectDialog 完成，交互更清晰。

   更新(2026-09-14)：AgentToggle 已移除 —— 它依赖 agent-store，
   该 store 随 AI 域（docs/130-cutia搬迁计划书）一并删除。 */
