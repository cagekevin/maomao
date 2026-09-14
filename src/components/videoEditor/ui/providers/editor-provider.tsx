'use client';

/**
 * 编辑器运行时 Provider —— 挂载时加载工程、卸载时释放。
 *
 * 来源：cutia `components/providers/editor-provider.tsx`（2026-09-14 搬入）。
 * 改动（docs/130-cutia搬迁计划书）：
 *   · 去 `useRouter`（Next 路由）—— 原「工程不存在 → 新建并 replace 路由」在宿主内无意义，
 *     改为**就地新建工程**，路由跳转交给宿主（画布）决定。
 *   · 其余逻辑（加载态 / 错误态 / 键盘绑定开关 / beforeunload 脏检查）原样保留。
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import {
  useKeybindingsListener,
  useKeybindingDisabler,
} from '@videoEditor/hooks-cutia/use-keybindings';
import { useEditorActions } from '@videoEditor/hooks-cutia/actions/use-editor-actions';

interface EditorProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export function EditorProvider({ projectId, children }: EditorProviderProps) {
  const editor = useEditor();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { disableKeybindings, enableKeybindings } = useKeybindingDisabler();
  const activeProject = editor.project.getActiveOrNull();

  useEffect(() => {
    if (isLoading) {
      disableKeybindings();
    } else {
      enableKeybindings();
    }
  }, [isLoading, disableKeybindings, enableKeybindings]);

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      try {
        setIsLoading(true);
        await editor.project.loadProject({ id: projectId });

        if (cancelled) return;
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;

        const isNotFound =
          err instanceof Error &&
          (err.message.includes('not found') || err.message.includes('does not exist'));

        if (isNotFound) {
          try {
            // 更新(2026-09-14)：原为 router.replace(`/editor/${newProjectId}`)；
            // 宿主内无路由，改为就地新建（工程 id 由引擎生成并持久化）。
            await editor.project.createNewProject({
              name: '未命名项目',
            });
            setIsLoading(false);
          } catch (_createErr) {
            setError('创建工程失败');
            setIsLoading(false);
          }
        } else {
          setError(err instanceof Error ? err.message : '加载工程失败');
          setIsLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId, editor]);

  if (error) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">正在加载工程…</p>
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">正在退出工程…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <EditorRuntimeBindings />
      {children}
    </>
  );
}

function EditorRuntimeBindings() {
  const editor = useEditor();

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editor.save.getIsDirty()) return;
      event.preventDefault();
      (event as unknown as { returnValue: string }).returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editor]);

  useEditorActions();
  useKeybindingsListener();
  return null;
}
