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
import { LayerRoot } from '@videoEditor/ui/ui/layer/layer-root';
import { usePanelStore } from '@videoEditor/stores/panel-store';
// 更新(2026-09-14)：agent 侧栏未搬入，useAgentStore 依赖已移除（见 EditorLayout）。
import { cn } from '@videoEditor/utils/ui';
import { EditorCore } from '@videoEditor/engine/core';

/**
 * 退出编辑器（返回画布）——**唯一协议**，所有退出入口（右上角 X、header 菜单「退出项目」）共用。
 *
 * 顺序死约定（不可颠倒）：
 *   ① prepareExit            — **无条件** flush 落盘（脏数据不丢；TD-22-33 已修：原来只在更新了
 *                              缩略图时才 flush，退出时会丢掉队列里的最后变更）。flush 不抛，
 *                              失败已由 SaveManager 给用户可见提示，故不阻断退出（退出是用户意志）；
 *   ② releaseProjectContext  — 重置引擎内存态（命令栈/选择/音频/播放/媒体/场景/活跃项目，**唯一入口**）；
 *   ③ onExit                 — 宿主关层 → 卸载本组件（unmount cleanup 清存储上下文）。
 *
 * ② 之后必须立刻卸载——不存在「退出了还挂着」的停留态。
 * （反例：header 里旧的 handleExit 做完 ①② 就停，active=null 触发 Provider 的
 *  「正在退出工程…」分支且无人接力关层 → 永久卡死。已删。）
 */
let isExiting = false;
async function exitEditorToCanvas(onExit: () => void): Promise<void> {
  if (isExiting) return;
  isExiting = true;
  try {
    const editor = EditorCore.getInstance();
    await editor.project.prepareExit();
    editor.releaseProjectContext();
  } finally {
    isExiting = false;
    onExit();
  }
}

export interface EditorShellProps {
  /**
   * 画布项目 id（`useCurrentProjectId()`）。
   *
   * 【T5-A 语义修正】此 prop 旧名 `projectId` 且注释指向已废弃的存储键
   * `video-editor-project-{projectId}`（单工程时代的化石）。实际它一直是**画布项目 id**；
   * 剪辑工程（片子）的 id = **editorId**，由 EditorProvider 从画布项目的 active 键读出
   * （docs/133 §2：一个画布项目可挂多个片子）。
   */
  canvasProjectId: string;
  /** 关闭编辑器（返回画布）。宿主传入；缺省时不渲染关闭按钮。 */
  onClose?: () => void;
  className?: string;
}

export function EditorShell({ canvasProjectId, onClose, className }: EditorShellProps) {
  /* 更新(2026-09-15 · docs/135 自研弹层)：这里原有一段补丁 ——
     `document.body.classList.add('ve-scope', 'dark')`。
     【它当初为什么存在】弹层（菜单/对话框/Popover/Tooltip）Portal 到 `document.body`，
     落在编辑器根节点的 `.ve-scope` **之外** ⇒ 拿不到 `--ve-*` token（背景/文字回落宿主值，色调错乱）。
     挂主题类到 body 是**用附随复杂度补，而不是源头收敛**：宿主 body 被编辑器改了类，
     且每个弹层都活在"靠 body 上有类"的隐式前提里。
     【现在为什么能删】所有弹层改为渲染进**编辑器自己的层根**（`<LayerRoot />`，见下），
     层根是 `.ve-scope` 的后代 ⇒ 弹层天生拿得到全部 token。补丁的前提消失，补丁删除。 */
  return (
    <EditorProvider canvasProjectId={canvasProjectId}>
      {/* TooltipProvider：cutia 原在整站 layout 提供（app/[locale]/layout.tsx:35）；
			    我们无整站壳 → 由编辑器自己的根提供（否则 TabBar 等 Tooltip 抛错）。 */}
      <TooltipProvider>
        {/* 统一 toast：编辑器 toast 现统一走 base/core/toastStore，由 App 根的 ToastContainer 顶部渲染，
            不再自带 Toaster（ui/ui/sonner.tsx 已删除）。 */}
        {/* 关闭按钮（**右上角**）：cutia 原无此交互（它是整站路由页面），
				    本仓编辑器是**画布内的全屏层**，需要显式出口。见 docs/130-cutia搬迁计划书。
				    更新(2026-09-14)：原在 `left-3` 且 `z-[60]` 浮在最上层，把 header 左上角的
				    「作品切换」触发器盖住（用户反馈"左上角第一个按钮是返回画布"）→ 移到 `right-3`。 */}
        {onClose && (
          <button
            type="button"
            onClick={() => void exitEditorToCanvas(onClose)}
            title="关闭编辑器（返回画布）"
            aria-label="关闭编辑器"
            className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-3 right-3 z-[60] flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
        <EditorLayout
          className={className}
          // 统一走同一份退出协议；onClose 缺省时 header 不渲染退出入口（消灭断头退出）。
          onExit={onClose ? () => void exitEditorToCanvas(onClose) : undefined}
        />
        {/* 层根（**全编辑器唯一一个**）：自研弹层（Popover/菜单/对话框/Tooltip）都渲染进这里，
            见 ui/ui/layer/layer-root.tsx 头注。 */}
        <LayerRoot />
      </TooltipProvider>
    </EditorProvider>
  );
}

function EditorLayout({ className, onExit }: { className?: string; onExit?: () => void }) {
  const { panels, setPanel } = usePanelStore();
  // 更新(2026-09-14)：agent 侧栏未搬入（见下方槽位说明），故移除 useAgentStore 依赖。

  return (
    <div className={cn('bg-background flex h-full w-full flex-col overflow-hidden', className)}>
      <EditorHeader onExit={onExit} />
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
