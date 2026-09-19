'use client';
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { copyText } from '@/components/base/utils/net/clipboard';
import { mediaDisplayUrl } from '@/components/videoEditor/lib/mediaDisplayUrl';
import { useRenderAssetResolver } from '@/components/base/utils/media/assetUrl';
// 【2026-09-17 TD-16-29②】图片失败态的唯一实现（两段回退 + 显式占位），替代裸 <img>
import LazyImage from '@/components/base/ui/display/LazyImage';
// 【2026-09-19】视频封面运行时抽帧 —— **唯一原语**（与画布 AssetNode 同源）：
// 内部走 `captureFrame.ts` 的 `drawVideoFrame`（seek + drawImage 的唯一实现），不新造第二份抽帧判据。
import { useVideoPoster } from '@/hooks/useVideoPoster.ts';
// 【TD-22-64 · 2026-09-18】时长显示唯一实现（此前本文件自持一份 `formatDuration`，与
// nodes/VideoProcessNode 的同名实现重复；落 base/core 是两域唯一可共用的层）
import { formatDuration } from '@/components/base/core/utils.ts';

import { useMemo, useState } from 'react';
import { toast } from '@/components/videoEditor/lib/toast';
import { MediaDragOverlay } from '@/components/videoEditor/ui/editor/panels/assets/drag-overlay';
import { DraggableItem } from '@/components/videoEditor/ui/editor/panels/assets/draggable-item';
import {
  PanelBaseView as BaseView,
  VideoEditorPanelState,
} from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import { Button } from '@/components/videoEditor/ui/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/videoEditor/ui/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/videoEditor/ui/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/videoEditor/ui/ui/tooltip';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useFileUpload } from '@/components/videoEditor/hooks-cutia/use-file-upload';
import { useRevealItem } from '@/components/videoEditor/hooks-cutia/use-reveal-item';
import { processMediaAssets } from '@/components/videoEditor/engine/lib/media/processing';
import {
  buildImageElement,
  buildUploadAudioElement,
  buildVideoElement,
} from '@/components/videoEditor/engine/timeline/element-utils';
import { RemoveMediaAssetCommand } from '@/components/videoEditor/engine/commands';
import { useAssetsPanelStore } from '@/components/videoEditor/stores/assets-panel-store';
import { useMediaPreviewStore } from '@/components/videoEditor/stores/media-preview-store';
// 可复用「导入媒体」弹窗（docs/136 地基 · 入口 B）—— 与画布右键菜单共用**同一个组件**。
// 落地动作走本文件的 `linkMediaRefsToProject`（登记引用，不上传）。
import ImportMediaModalHost from '@/components/videoEditor/ImportMediaModalHost';
import type { ImportPickOutcome } from '@/components/videoEditor/ImportMediaModalHost';
import { linkMediaRefsToProject } from '@/components/videoEditor/ui/editor/panels/assets/link-media-refs';
import type { MediaRef } from '@/components/base/media/mediaRefTypes.ts';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import type { CreateTimelineElement } from '@/components/videoEditor/types/timeline';
import { cn } from '@/components/videoEditor/utils/ui';
import {
  Image,
  Music,
  Video,
  List,
  LayoutGrid,
  ListOrdered,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';

export function MediaView() {
  const editor = useEditor();
  const mediaFiles = editor.media.getAssets();
  const activeProject = editor.project.getActive();
  // TD-22-43②：加载失败的持续状态真源（重渲染由 use-editor 对 media.subscribe 驱动）。
  const loadError = editor.media.getLoadError();

  const { mediaViewMode, setMediaViewMode, highlightMediaId, clearHighlight } =
    useAssetsPanelStore();
  const { highlightedId, registerElement } = useRevealItem(highlightMediaId, clearHighlight);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'duration' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // 「导入媒体」弹窗开关（复用 base/panels 的同一组件；落地动作见 linkRefsToProject）。
  const [importOpen, setImportOpen] = useState(false);

  const processFiles = async ({ files }: { files: FileList | File[] }) => {
    if (!files || files.length === 0) return;
    if (!activeProject) {
      toast.error('没有活跃项目');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    try {
      const processedAssets = await processMediaAssets({
        files,
        onProgress: (progress: { progress: number }) => setProgress(progress.progress),
      });
      for (const asset of processedAssets) {
        // 判别联合：失败时 MediaManager 已回滚该条并已逐条 toast（TD-22-37），此处无需二次判。
        await editor.media.addMediaAsset({
          projectId: activeProject.metadata.id,
          asset,
        });
      }
    } catch (error) {
      videoEditorLogger.error('Error processing files:', error);
      toast.error('处理文件失败');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const { isDragOver, dragProps, openFilePicker, fileInputProps } = useFileUpload({
    accept: 'image/*,video/*,audio/*',
    multiple: true,
    onFilesSelected: (files) => processFiles({ files }),
  });

  /**
   * 「导入媒体」弹窗的落地动作（docs/136 §9.3 · 路线 A）。
   * 从「生成/素材库/画布」选中的素材，二进制已在 `/files/` → **登记引用，不上传**。
   *
   * 【本函数 = 该入口的**生产端**】它把「实际落了什么」变成结果契约交给弹窗：
   *  · 成功判据 = 结果事实（`linked.length`），不是「调用没报错」——`res.ok` 的语义只是
   *    「没有 failures」，全部被去重跳过时它**也是 true**（旧写法据此弹 success「已导入 0 个素材」，
   *    用户看到"成功"而列表一条没多 = 界面撒谎）；
   *  · 用户可见文案**由这里给**（它才知道），弹窗只转发 —— 两侧不再各说一句。
   * 【为什么不再在此 toast】弹窗是 `onPick` 的消费方，显示职责收在一处（避免重复/先后不一）。
   */
  const linkRefsToProject = async (items: MediaRef[]): Promise<ImportPickOutcome> => {
    if (!activeProject) return { ok: false, message: '没有活跃项目' };
    if (items.length === 0) return { ok: true }; // 空选择：无事发生，也不播报
    const res = await linkMediaRefsToProject({
      items,
      projectId: activeProject.metadata.id,
      media: editor.media,
    });
    if (!res.ok) {
      // 失败提示同时交代**成功了多少** —— 否则用户只知道"有几个没成"，不知"到底进去几个"
      return {
        ok: false,
        message: `${res.failures.length} 个素材未能登记${res.linked.length > 0 ? `（${res.linked.length} 个已成功）` : ''}`,
      };
    }

    // 真实新增 = 0：不是"导入成功"，说清「没新增」及其原因（已存在 / 全被去重命中）
    if (res.linked.length === 0) {
      return {
        ok: true,
        message:
          res.skipped.length > 0
            ? `所选 ${res.skipped.length} 个素材在当前工程里已存在，未新增`
            : '所选素材未能新增',
      };
    }

    return {
      ok: true,
      message:
        res.skipped.length > 0
          ? `已导入 ${res.linked.length} 个素材（${res.skipped.length} 个已存在）`
          : `已导入 ${res.linked.length} 个素材`,
    };
  };

  const handleRemove = async ({ event, id }: { event: React.MouseEvent; id: string }) => {
    event.stopPropagation();

    if (!activeProject) {
      toast.error('没有活跃项目');
      return;
    }

    editor.command.execute({
      command: new RemoveMediaAssetCommand(activeProject.metadata.id, id),
    });
  };

  const handleExportClip = ({ item }: { item: MediaAsset }) => {
    try {
      const downloadUrl = URL.createObjectURL(item.file);
      const linkElement = document.createElement('a');
      linkElement.href = downloadUrl;
      linkElement.download = item.file.name || item.name;
      document.body.append(linkElement);
      linkElement.click();
      linkElement.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      toast.success('片段已下载');
    } catch (error) {
      videoEditorLogger.error('Failed to export clip:', error);
      toast.error('下载片段失败');
    }
  };

  const addElementAtTime = ({
    asset,
    startTime,
  }: {
    asset: MediaAsset;
    startTime: number;
  }): boolean => {
    const element = createElementFromMedia({ asset, startTime });
    editor.timeline.insertElement({
      element,
      placement: { mode: 'auto' },
    });
    return true;
  };

  const filteredMediaItems = useMemo(() => {
    const filtered = mediaFiles.filter((item) => !item.ephemeral);

    filtered.sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'type':
          valueA = a.type;
          valueB = b.type;
          break;
        case 'duration':
          valueA = a.duration || 0;
          valueB = b.duration || 0;
          break;
        case 'size':
          valueA = a.file.size;
          valueB = b.file.size;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [mediaFiles, sortBy, sortOrder]);

  const previewComponents = useMemo(() => {
    const previews = new Map<string, React.ReactNode>();

    filteredMediaItems.forEach((item) => {
      previews.set(item.id, <MediaPreview item={item} />);
      previews.set(`compact-${item.id}`, <MediaPreview item={item} variant="compact" />);
    });

    return previews;
  }, [filteredMediaItems]);

  const renderPreview = (item: MediaAsset) => previewComponents.get(item.id);
  const renderCompactPreview = (item: MediaAsset) => previewComponents.get(`compact-${item.id}`);

  const selectedMediaId = useMediaPreviewStore((state) => state.selectedMediaId);

  const handleSelectMedia = ({ asset }: { asset: MediaAsset }) => {
    const store = useMediaPreviewStore.getState();
    if (store.selectedMediaId === asset.id) {
      store.clearSelection();
    } else {
      store.selectMedia({ mediaId: asset.id });
    }
  };

  const handleClearSelection = () => {
    useMediaPreviewStore.getState().clearSelection();
  };

  return (
    <>
      <input {...fileInputProps} />

      {/* 拖放是**宿主行为**（面板要接住落下的文件并给高亮），不属于分区语言 ——
          这一层只透传拖放属性与高亮底色，高度链原样交给 `BaseView`。 */}
      <div className={cn('h-full min-h-0', isDragOver && 've-drop-active')} {...dragProps}>
        <BaseView>
          <PropertyGroup>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{'素材'}</span>
              <div className="flex items-center gap-0">
                <TooltipProvider>
                  {/* 【结构修正 2026-09-15】原先「排序」的 Tooltip 被**嵌在**「切换视图」Tooltip 的
                  children 里（`<Tooltip><TooltipTrigger/><TooltipContent/><Tooltip>…</Tooltip></Tooltip>`）。
                  Radix `Tooltip` 的 children 只接受 Trigger / Content —— 多余的嵌套属于非法结构，
                  其内部子树（排序 DropdownMenu）渲染行为未定义。此处改为**两个并列的独立 Tooltip**。 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="text"
                        onClick={() => setMediaViewMode(mediaViewMode === 'grid' ? 'list' : 'grid')}
                        className="items-center justify-center"
                      >
                        {mediaViewMode === 'grid' ? <List /> : <LayoutGrid />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{mediaViewMode === 'grid' ? '切换到列表视图' : '切换到网格视图'}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <DropdownMenu>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          {/* 同「导入」按钮：菜单 trigger **不得** disabled（disabled → pointer-events:none
                          → 指针穿透 → Radix 收不到 pointerdown → 菜单打不开）。排序项随时可点。 */}
                          <Button
                            size="icon"
                            variant="text"
                            className="items-center justify-center"
                          >
                            <ListOrdered />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <DropdownMenuContent align="end">
                        <SortMenuItem
                          label={'名称'}
                          sortKey="name"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                          onSort={({ key }) => {
                            if (sortBy === key) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(key);
                              setSortOrder('asc');
                            }
                          }}
                        />
                        <SortMenuItem
                          label={'类型'}
                          sortKey="type"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                          onSort={({ key }) => {
                            if (sortBy === key) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(key);
                              setSortOrder('asc');
                            }
                          }}
                        />
                        <SortMenuItem
                          label={'时长'}
                          sortKey="duration"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                          onSort={({ key }) => {
                            if (sortBy === key) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(key);
                              setSortOrder('asc');
                            }
                          }}
                        />
                        <SortMenuItem
                          label={'文件大小'}
                          sortKey="size"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                          onSort={({ key }) => {
                            if (sortBy === key) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(key);
                              setSortOrder('asc');
                            }
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <TooltipContent>
                      <p>{`按 ${sortBy} 排序（${sortOrder === 'asc' ? '升序' : '降序'}）`}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/*
              【设计修正 2026-09-15】**「导入」直连 `openFilePicker()`，不经任何菜单。**

              `openFilePicker()` 内部是 `input.click()`，属**需要用户手势的命令式动作**。
              若挂在 Radix 菜单项上，Radix 在选中时会**同步**执行「关层 + FocusScope 归还焦点」，
              该动作随即被判为不在手势栈内 → 浏览器**静默丢弃**（正是本轮缺陷根因）。
              直连后链路只剩「按钮 click → input.click()」两步，无中介。

              ⚠️ 另一个必须避开的坑：`Button` 基类含 `disabled:pointer-events-none` ——
              入口按钮**一律不得加 `disabled`**（禁用即指针穿透，连 pointerdown 都收不到，
              而 `opacity-50` 在深色主题下又几乎看不出 → 表现为「点了毫无变化」）。

              【「URL」入口已删（2026-09-15）】原 URL 导入走
              `fetchRemoteMediaAsFile` → `fetchWithProxyFallback`，其代理回退打的是
              `/api/proxy/download` —— **该后端端点在搬迁到本仓时就不存在**（cutia/Next 路由，
              本仓多处注释已记「旧 /api/proxy 已退役」）→ 跨域场景**必然 404**，是个死功能。
              本仓「远程 URL → 本地」的正确入口是 `localTool` 后端代下载
              （`filesApi.uploadFileToLocal` 的 fileUrl 模式 → `saveRemoteUrl` + `fetchWithProxy`，
              绕 CORS + sha1 幂等）；将来若真需要 URL 导入，**按那条路重做**，
              不要复活这份依赖已退役端点的实现。
            */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                  className="items-center justify-center gap-1.5 ml-1.5 px-3"
                >
                  <UploadCloud />
                  {'导入'}
                </Button>
                {/* 「导入媒体」弹窗（与画布右键菜单**同一组件**）：
                    本地 tab → processFiles（走既有上传）；生成/素材库/画布 → linkRefsToProject（登记引用）。
                    ⚠️ 不挂在 Radix 菜单项上（`openFilePicker` 的时序事故见上方长注释）；
                    本弹窗由按钮 state 驱动，无该问题。 */}
                <ImportMediaModalHost
                  open={importOpen}
                  onClose={() => setImportOpen(false)}
                  projectId={activeProject?.metadata.id}
                  onPick={linkRefsToProject}
                  onLocalFiles={(files) => processFiles({ files })}
                />
              </div>
            </div>
          </PropertyGroup>

          {/* 内容区 = 一个 grow 分区（高度链由契约钉死）；"点空白取消选择"挂在这一层。 */}
          <PropertyGroup grow>
            <div
              className="flex min-h-0 flex-1 flex-col"
              onClick={(event) => {
                if (event.target === event.currentTarget) handleClearSelection();
              }}
            >
              {loadError && filteredMediaItems.length === 0 ? (
                /* ── 失败可见性（TD-22-43②）：素材加载失败原来只记 logger →
                用户看到的是**静默空面板**（以为"这个工程没素材"）。持续状态给对读者 = 面板错误态
                （不是 toast——toast 逝去即失明，而"面板是空的"是持续状态）。 */
                <VideoEditorPanelState
                  tone="error"
                  text={'素材加载失败'}
                  hint={loadError}
                  action={{
                    label: '重试',
                    onClick: () => {
                      void editor.media.loadProjectMedia({
                        projectId: activeProject.metadata.id,
                      });
                    },
                  }}
                />
              ) : isDragOver || filteredMediaItems.length === 0 ? (
                <MediaDragOverlay
                  isVisible={true}
                  isProcessing={isProcessing}
                  progress={progress}
                  onClick={openFilePicker}
                />
              ) : mediaViewMode === 'grid' ? (
                <GridView
                  items={filteredMediaItems}
                  renderPreview={renderPreview}
                  onRemove={handleRemove}
                  onExportClip={handleExportClip}
                  onAddToTimeline={addElementAtTime}
                  onSelect={handleSelectMedia}
                  selectedMediaId={selectedMediaId}
                  highlightedId={highlightedId}
                  registerElement={registerElement}
                />
              ) : (
                <ListView
                  items={filteredMediaItems}
                  renderPreview={renderCompactPreview}
                  onRemove={handleRemove}
                  onExportClip={handleExportClip}
                  onAddToTimeline={addElementAtTime}
                  onSelect={handleSelectMedia}
                  selectedMediaId={selectedMediaId}
                  highlightedId={highlightedId}
                  registerElement={registerElement}
                />
              )}
            </div>
          </PropertyGroup>
        </BaseView>
      </div>
    </>
  );
}

function MediaItemWithContextMenu({
  item,
  children,
  onRemove,
  onExportClip,
}: {
  item: MediaAsset;
  children: React.ReactNode;
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
  onExportClip: ({ item }: { item: MediaAsset }) => void;
}) {
  return (
    <ContextMenu>
      {/* 【2026-09-19 结构性缺陷修复 · 一个根因造成三个症状】
          原为 `<ContextMenuTrigger>{children}</ContextMenuTrigger>`（**缺 `asChild`**）。
          本仓的 `MenuTrigger`（自研，非 Radix）在不传 `asChild` 时会渲染一个
          **`<button type="button">`** 包裹 children —— 实测取证：
            `<button type="button"><div class="w-full">CARD</div></button>`
          于是每个网格格的子节点成了一个**收缩包裹（shrink-to-fit）的 button**，
          `DraggableItem` 的 `containerClassName="w-full"` 参照的是这个 button 的宽度
          （而非网格格的宽度）⇒ **宽度链塌陷**，同一根因同时产生三个症状：
            ① 网格列失效：卡片撑成整宽 / 相互压盖（截图实测）；
            ② 卡片态加减号不在右下角（`absolute` 相对塌陷的盒子定位，挤到中间）；
            ③ 名称显示完整超长串（`truncate` 失去可裁的约束宽）。
          另外它还是**非法嵌套**：`DraggableItem` 内部含真实 `<button>`（加/减号），
          按钮嵌按钮属非法 HTML。
          修法 = `asChild`：触发器把事件挂到 children 自身（`MenuTrigger` 走 `<Slot>` 分支），
          **不再注入包裹元素** ⇒ 宽度链恢复，三个症状一次消除。 */}
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onExportClip({ item })}>{'导出片段'}</ContextMenuItem>
        <ContextMenuItem
          onClick={async () => {
            // 【2026-09-17 TD-16-27】原实现不 `await` 也不 `catch`，且**无条件**报成功（假成功）。
            // 现委托 copyText（判别联合），成功/失败均如实转发，不再产生 unhandled rejection。
            const r = await copyText(item.id);
            if (r.ok) toast.success('素材 ID 已复制');
            else {
              videoEditorLogger.warn('剪辑器', '复制素材 ID 失败', r.msg);
              toast.error(r.msg);
            }
          }}
        >
          {'复制素材 ID'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={(event) => onRemove({ event, id: item.id })}
        >
          {'删除'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function GridView({
  items,
  renderPreview,
  onRemove,
  onExportClip,
  onAddToTimeline,
  onSelect,
  selectedMediaId,
  highlightedId,
  registerElement,
}: {
  items: MediaAsset[];
  renderPreview: (item: MediaAsset) => React.ReactNode;
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
  onExportClip: ({ item }: { item: MediaAsset }) => void;
  onAddToTimeline: ({ asset, startTime }: { asset: MediaAsset; startTime: number }) => boolean;
  onSelect: ({ asset }: { asset: MediaAsset }) => void;
  selectedMediaId: string | null;
  highlightedId: string | null;
  registerElement: (id: string, element: HTMLElement | null) => void;
}) {
  return (
    // 【2026-09-19】固定**一排 2 个**（原为 `repeat(auto-fill, minmax(150px, 1fr))` 自适应列数：
    // 面板一宽就变 3~4 列，卡片忽大忽小，且与"图片/视频卡片一致"的诉求相冲）。
    // 列数由用户口径定死 ⇒ 卡片宽度随面板等比、**比例恒定**，图片与视频天然同尺寸。
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item.id} ref={(el) => registerElement(item.id, el)}>
          <MediaItemWithContextMenu item={item} onRemove={onRemove} onExportClip={onExportClip}>
            <DraggableItem
              name={item.name}
              preview={renderPreview(item)}
              dragData={{
                id: item.id,
                type: 'media',
                mediaType: item.type,
                name: item.name,
              }}
              shouldShowPlusOnDrag={false}
              onAddToTimeline={({ currentTime }) =>
                onAddToTimeline({ asset: item, startTime: currentTime })
              }
              // 减号 = 删除该素材（连带移除它在时间轴上的片段，见 handleRemove）。
              onRemoveFromTimeline={({ event }) => onRemove({ event, id: item.id })}
              removeTooltipText={'删除素材（同时从时间轴移除）'}
              onClick={() => onSelect({ asset: item })}
              isRounded={false}
              variant="card"
              containerClassName="w-full"
              isHighlighted={highlightedId === item.id}
              isSelected={selectedMediaId === item.id}
            />
          </MediaItemWithContextMenu>
        </div>
      ))}
    </div>
  );
}

function ListView({
  items,
  renderPreview,
  onRemove,
  onExportClip,
  onAddToTimeline,
  onSelect,
  selectedMediaId,
  highlightedId,
  registerElement,
}: {
  items: MediaAsset[];
  renderPreview: (item: MediaAsset) => React.ReactNode;
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void;
  onExportClip: ({ item }: { item: MediaAsset }) => void;
  onAddToTimeline: ({ asset, startTime }: { asset: MediaAsset; startTime: number }) => boolean;
  onSelect: ({ asset }: { asset: MediaAsset }) => void;
  selectedMediaId: string | null;
  highlightedId: string | null;
  registerElement: (id: string, element: HTMLElement | null) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} ref={(el) => registerElement(item.id, el)}>
          <MediaItemWithContextMenu item={item} onRemove={onRemove} onExportClip={onExportClip}>
            <DraggableItem
              name={item.name}
              preview={renderPreview(item)}
              dragData={{
                id: item.id,
                type: 'media',
                mediaType: item.type,
                name: item.name,
              }}
              shouldShowPlusOnDrag={false}
              onAddToTimeline={({ currentTime }) =>
                onAddToTimeline({ asset: item, startTime: currentTime })
              }
              // 减号 = 删除该素材（连带移除它在时间轴上的片段，见 handleRemove）。
              onRemoveFromTimeline={({ event }) => onRemove({ event, id: item.id })}
              removeTooltipText={'删除素材（同时从时间轴移除）'}
              onClick={() => onSelect({ asset: item })}
              variant="compact"
              isHighlighted={highlightedId === item.id}
              isSelected={selectedMediaId === item.id}
            />
          </MediaItemWithContextMenu>
        </div>
      ))}
    </div>
  );
}

function MediaDurationBadge({ duration }: { duration?: number }) {
  if (!duration) return null;

  return <div className="ve-card-badge">{formatDuration(duration)}</div>;
}

function MediaDurationLabel({ duration }: { duration?: number }) {
  if (!duration) return null;

  return <span className="text-xs opacity-70">{formatDuration(duration)}</span>;
}

function MediaTypePlaceholder({
  icon,
  label,
  duration,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  duration?: number;
  variant: 'muted' | 'bordered';
}) {
  const Icon = icon;
  const iconClassName = cn('size-6', variant === 'bordered' && 'mb-1');

  return (
    <div
      className={cn(
        'text-muted-foreground flex size-full flex-col items-center justify-center rounded',
        variant === 'muted' ? 'bg-muted/30' : 'border',
      )}
    >
      <Icon className={iconClassName} />
      <span className="text-xs">{label}</span>
      <MediaDurationLabel duration={duration} />
    </div>
  );
}

function MediaPreview({
  item,
  variant = 'grid',
}: {
  item: MediaAsset;
  variant?: 'grid' | 'compact';
}) {
  // TD-22-52：显示走 maomao 统一图片出口（服务端按需出小图 + 尊重「显示缩略图」开关）
  const resolveThumb = useRenderAssetResolver();
  const shouldShowDurationBadge = variant === 'grid';
  // 【2026-09-19 收口】视频封面 = 运行时按需抽帧，与画布 AssetNode **同一原语**
  // （`useVideoPoster` → `captureFrame.drawVideoFrame`，seek + drawImage 的唯一实现）。
  //
  // 【为什么 hook 必须提到所有 early return 之前】本组件按 `item.type` 早返回（image/audio/未知），
  // 若把 hook 写在 video 分支里，它就是**条件调用** —— 同一条目 type 变化（或同位置换条目）即触发
  // React 「Rendered fewer hooks than expected」崩溃。故一律无条件置顶，非视频传 `enabled:false`
  // （hook 内部对 `!enabled` 直接短路，不做任何抽帧）。
  const posterInput = mediaDisplayUrl({ asset: item, resolve: resolveThumb }) || item.url || '';
  const videoPoster = useVideoPoster(posterInput, item.type === 'video');

  if (item.type === 'image') {
    return (
      <div className="relative flex size-full items-center justify-center">
        {/* 【2026-09-17 TD-16-29②】原为**裸 `<img>`（无 onError）**：素材文件缺失 / 4xx 时
            只剩浏览器默认破图或空白，与"这张图本来就有问题"无从区分。收口到唯一实现
            `LazyImage`（两段回退：小图 → 原图 → 显式「图片加载失败」占位）。
            `eager`：网格缩略图解码成本≈0，而懒加载一旦不触发会**永久空白**。 */}
        <LazyImage
          src={mediaDisplayUrl({ asset: item, resolve: resolveThumb })}
          alt={item.name}
          className="size-full"
          // 【2026-09-19】补 `rounded`：原先图片无圆角、视频有 ⇒ 同一网格里两种外观（用户报"尺寸和比例不一样"）。
          // 现与视频分支逐字一致（`size-full rounded object-cover`），比例同由外层 AspectRatio(16:9) 钉死。
          imgClassName="size-full rounded object-cover"
          eager
        />
      </div>
    );
  }

  if (item.type === 'video') {
    // 封面 = 运行时抽帧（`videoPoster` 已在组件顶层无条件取得，见上方 hook 说明）。
    // 抽帧失败/未就绪 → `videoPoster` 为空串 → 落到下方诚实占位（不冒充有封面）。
    if (videoPoster) {
      return (
        <div className="relative size-full">
          {/* 同上：视频封面失败必须显式，不留给浏览器裂图 */}
          <LazyImage
            src={videoPoster}
            alt={item.name}
            className="size-full"
            imgClassName="size-full rounded object-cover"
            eager
          />
          {shouldShowDurationBadge ? <MediaDurationBadge duration={item.duration} /> : null}
        </div>
      );
    }

    // 封面尚未抽出 / 抽帧失败：仍给时长角标（诚实告知"这是视频、多长"，不冒充有封面）
    return (
      <MediaTypePlaceholder icon={Video} label={'视频'} duration={item.duration} variant="muted" />
    );
  }

  if (item.type === 'audio') {
    return (
      <MediaTypePlaceholder
        icon={Music}
        label={'音频'}
        duration={item.duration}
        variant="bordered"
      />
    );
  }

  return <MediaTypePlaceholder icon={Image} label={'未知'} variant="muted" />;
}

function SortMenuItem({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
}: {
  label: string;
  sortKey: 'name' | 'type' | 'duration' | 'size';
  currentSortBy: string;
  currentSortOrder: 'asc' | 'desc';
  onSort: ({ key }: { key: 'name' | 'type' | 'duration' | 'size' }) => void;
}) {
  const isActive = currentSortBy === sortKey;
  const arrow = isActive ? (currentSortOrder === 'asc' ? '↑' : '↓') : '';

  return (
    <DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
      {label} {arrow}
    </DropdownMenuItem>
  );
}

function createElementFromMedia({
  asset,
  startTime,
}: {
  asset: MediaAsset;
  startTime: number;
}): CreateTimelineElement {
  const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

  switch (asset.type) {
    case 'video':
      return buildVideoElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
        hasAudio: asset.hasAudio, // TD-21-17：🔊 角标数据源
      });
    case 'image':
      return buildImageElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
      });
    case 'audio':
      return buildUploadAudioElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
      });
    default:
      throw new Error(`Unsupported media type: ${asset.type}`);
  }
}
