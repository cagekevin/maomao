'use client';

/**
 * 编辑器运行时 Provider —— 挂载时加载工程、卸载时释放。
 *
 * 来源：cutia `components/providers/editor-provider.tsx`（2026-09-14 搬入）。
 * 改动（docs/130-cutia搬迁计划书 + docs/134 T5-A）：
 *   · 去 `useRouter`（Next 路由）—— 原「工程不存在 → 新建并 replace 路由」在宿主内无意义，
 *     改为**就地新建工程**，路由跳转交给宿主（画布）决定。
 *   · props `projectId` → `canvasProjectId`（语义修正）：它一直是**画布项目 id**，
 *     而引擎/存储层的工程 id 是 **editorId**（一个画布项目可挂多个片子，docs/133 §2）。
 *     旧代码把画布 id 直接当 editorId 传给 loadProject → 多工程模型退化成单工程。
 *   · 新增**三段式载入**（docs/133 §2.3 三键）：注入画布上下文 → 读 active 键定 editorId
 *     → 补全上下文 → 载入该片子（无则创建首个）。见下方 loadProject 注释。
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import {
  useKeybindingsListener,
  useKeybindingDisabler,
} from '@videoEditor/hooks-cutia/use-keybindings';
import { useEditorActions } from '@videoEditor/hooks-cutia/actions/use-editor-actions';
// ── T5-A：上下文注入（docs/134）+ active 键读取（storageService 已封装为领域方法）。
import { setEditorContext, clearEditorContext } from '@videoEditor/engine/services/storage/service';
import { storageService } from '@videoEditor/engine/services/storage/service';

interface EditorProviderProps {
  /** 画布项目 id（`useCurrentProjectId()`）——非 editorId。 */
  canvasProjectId: string;
  children: React.ReactNode;
}

export function EditorProvider({ canvasProjectId, children }: EditorProviderProps) {
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

        // ── ① 注入画布上下文（editorId 暂缺）：让 storage 能读「列表 / active」键（它们只依赖画布 id）。
        setEditorContext({ canvasProjectId, editorId: null });

        // ── ② 读 active 键定出本画布当前该开哪个片子。
        const activeEditorId = await storageService.loadActiveEditorId();
        if (cancelled) return;

        // ── ②′ 载入本画布的**片子列表**（T5-C）：切换器（EditorHeader 的 ProjectDropdown）读它渲染。
        // 原 cutia 由 StorageProvider 在整站 layout 里做；搬入时该 Provider 未挂载（无人调用），
        // 故收拢到此处——它是"挂载期一次性拉列表"，与 EditorProvider 生命周期天然一致。
        await editor.project.loadAllProjects();
        if (cancelled) return;

        if (activeEditorId) {
          // ── ③ 有活跃片子 → 补全上下文 → 载入它。
          setEditorContext({ canvasProjectId, editorId: activeEditorId });
          await editor.project.loadProject({ id: activeEditorId });
          if (cancelled) return;
          setIsLoading(false);
          return;
        }

        // ── ③′ 无活跃片子（首开）→ 就地新建首个片子。
        // 顺序死结：createNewProject 内部 saveProject 需要 editorId，而 id 由它自己生成。
        // 解法在存储层：saveProject 以 `project.metadata.id` 兜底补全上下文（语义等价，
        // editorId 本就等于 TProject.metadata.id，docs/133 §2.1 M-4），故此处可直接建。
        const createdId = await editor.project.createNewProject({ name: '未命名项目' });
        if (cancelled) return;
        // 补全上下文 + 记为活跃（saveActiveEditorId 内部同步上下文，原子完成）。
        setEditorContext({ canvasProjectId, editorId: createdId });
        await storageService.saveActiveEditorId({ editorId: createdId });
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载工程失败');
        setIsLoading(false);
      }
    };

    loadProject();

    return () => {
      cancelled = true;
      // 卸载清空上下文：避免画布切换/关闭后残留旧 (画布, 片子) 造成错键写入。
      clearEditorContext();
    };
  }, [canvasProjectId, editor]);

  if (error) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // 「无活跃工程」只有一种真实形态：切换/新建作品瞬态（closeProject → loadProject 之间）。
  // 与「载入中」同属一个占位（一份渲染，不写两份分支）；退出路径（exitEditorToCanvas）
  // closeProject 与宿主卸载同批提交，不会停留在此。
  if (isLoading || !activeProject) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">正在加载工程…</p>
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
