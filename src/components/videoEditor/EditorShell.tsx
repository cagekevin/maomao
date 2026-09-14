/**
 * cutia 视频编辑器 · 宿主外壳（EditorShell）
 *
 * 来源：cutia `app/[locale]/editor/[project_id]/page.tsx`（2026-09-14 搬入，
 * docs/130-cutia搬迁计划书 §S5）。改动：
 *   · 去 Next 路由（`useParams`）—— `projectId` 改由 props 传入；
 *   · 去 `"use client"` / `lazy` / `Suspense`（Vite 不需要）；
 *   · 去 mobile 分支（子目录已移除）；
 *   · 去 MigrationDialog（依赖 storage 迁移 UI，已随范围外移除）。
 *
 * 布局照抄 cutia 原版（ResizablePanelGroup 五面板）——这是 cutia 最值钱的部分，
 * 一期先**全屏**挂载，接画布是后续任务（§S6）。
 *
 * 依赖方向：`EditorShell`（改造区）→ `ui/` → `engine/`（引擎区）。不得反向。
 */

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@videoEditor/ui/ui/resizable';
import { AssetsPanel } from '@videoEditor/ui/editor/panels/assets';
import { PropertiesPanel } from '@videoEditor/ui/editor/panels/properties';
import { Timeline } from '@videoEditor/ui/editor/panels/timeline';
import { PreviewPanel } from '@videoEditor/ui/editor/panels/preview';
import { EditorHeader } from '@videoEditor/ui/editor/editor-header';
import { EditorProvider } from '@videoEditor/ui/providers/editor-provider';
import { X } from 'lucide-react';
import { TooltipProvider } from '@videoEditor/ui/ui/tooltip';
import { Toaster } from '@videoEditor/ui/ui/sonner';
import { usePanelStore } from '@videoEditor/stores/panel-store';
// 更新(2026-09-14)：agent 侧栏未搬入，useAgentStore 依赖已移除（见 EditorLayout）。
import { cn } from '@videoEditor/utils/ui';

export interface EditorShellProps {
  /** 工程 id（对应存储键 video-editor-project-{projectId}）。 */
  projectId: string;
  /** 关闭编辑器（返回画布）。宿主传入；缺省时不渲染关闭按钮。 */
  onClose?: () => void;
  className?: string;
}

export function EditorShell({ projectId, onClose, className }: EditorShellProps) {
  return (
    <EditorProvider projectId={projectId}>
      {/* TooltipProvider：cutia 原在整站 layout 提供（app/[locale]/layout.tsx:35）；
			    我们无整站壳 → 由编辑器自己的根提供（否则 TabBar 等 Tooltip 抛错）。 */}
      <TooltipProvider>
        {/* Toaster：cutia 原在整站 layout 提供；编辑器大量用 toast() 报错/提示，必须存在。 */}
        <Toaster />
        {/* 关闭按钮（左上角）：cutia 原无此交互（它是整站路由页面），
				    本仓编辑器是**画布内的全屏层**，需要显式出口。见 docs/130-cutia搬迁计划书。 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="关闭编辑器（返回画布）"
            aria-label="关闭编辑器"
            className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-3 left-3 z-[60] flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
        <EditorLayout className={className} />
      </TooltipProvider>
    </EditorProvider>
  );
}

function EditorLayout({ className }: { className?: string }) {
  const { panels, setPanel } = usePanelStore();
  // 更新(2026-09-14)：agent 侧栏未搬入（见下方槽位说明），故移除 useAgentStore 依赖。

  return (
    <div className={cn('bg-background flex h-full w-full flex-col overflow-hidden', className)}>
      <EditorHeader />
      <div className="min-h-0 min-w-0 flex-1 px-3 pb-3">
        <ResizablePanelGroup direction="horizontal" className="size-full gap-[0.19rem]">
          <ResizablePanel defaultSize={100} minSize={50} className="min-w-0">
            <ResizablePanelGroup
              direction="vertical"
              className="size-full gap-[0.18rem]"
              onLayout={(sizes) => {
                setPanel('mainContent', sizes[0] ?? panels.mainContent);
                setPanel('timeline', sizes[1] ?? panels.timeline);
              }}
            >
              <ResizablePanel
                defaultSize={panels.mainContent}
                minSize={30}
                maxSize={85}
                className="min-h-0"
              >
                <ResizablePanelGroup
                  direction="horizontal"
                  className="size-full gap-[0.19rem]"
                  onLayout={(sizes) => {
                    setPanel('tools', sizes[0] ?? panels.tools);
                    setPanel('preview', sizes[1] ?? panels.preview);
                    setPanel('properties', sizes[2] ?? panels.properties);
                  }}
                >
                  <ResizablePanel
                    defaultSize={panels.tools}
                    minSize={15}
                    maxSize={40}
                    className="min-w-0"
                  >
                    <AssetsPanel />
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel
                    defaultSize={panels.preview}
                    minSize={30}
                    className="min-h-0 min-w-0 flex-1"
                  >
                    <PreviewPanel />
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel
                    defaultSize={panels.properties}
                    minSize={15}
                    maxSize={40}
                    className="min-w-0"
                  >
                    <PropertiesPanel />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize={panels.timeline}
                minSize={15}
                maxSize={70}
                className="min-h-0"
              >
                <Timeline />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* 更新(2026-09-14)：cutia 的 AgentPanel 未搬入（AI 依赖 @cutia/env，本仓不可解析），
					    故此槽位整体移除。原初稿误用 <AssetsPanel /> 占位 → 界面出现两个素材库。
					    待 AI 域迁入后再接回（docs/130-cutia搬迁计划书）。 */}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
