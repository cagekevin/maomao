import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { reportDegrade } from '@/components/base/core/log/degrade';
import { Command } from '@/components/videoEditor/engine/commands/base-command';
import { getEditor } from '@/components/videoEditor/engine/core/editorInstance';
import type {
  CreateTimelineElement,
  TimelineTrack,
  TimelineElement,
  TrackType,
  ElementType,
} from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import {
  requiresMediaId,
  wouldElementOverlap,
} from '@/components/videoEditor/engine/timeline/element-utils';
import {
  buildEmptyTrack,
  canElementGoOnTrack,
  getDefaultInsertIndexForTrack,
  validateElementTrackCompatibility,
  enforceMainTrackStart,
} from '@/components/videoEditor/engine/timeline/track-utils';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import type { TProjectSettings } from '@/components/videoEditor/types/project';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';

type InsertElementPlacement =
  | { mode: 'explicit'; trackId: string }
  | { mode: 'auto'; trackType?: TrackType; insertIndex?: number };

export interface InsertElementParams {
  element: CreateTimelineElement;
  placement: InsertElementPlacement;
}

export class InsertElementCommand extends Command {
  private elementId: string;
  private savedState: TimelineTrack[] | null = null;
  private targetTrackId: string | null = null;
  // 插入首个可视元素时会**顺带**改 project.settings（画布尺寸 / 帧率，见 execute 内注释）。
  // 那次改动以 `pushHistory:false` 提交、不产生独立命令，故必须由本命令自捕并回滚（TD-22-34）。
  private savedSettings: TProjectSettings | null = null;
  private savedSettingsUpdatedAt: Date | null = null;

  constructor({ element, placement }: InsertElementParams) {
    super();
    this.elementId = generateUUID();
    this.element = element;
    this.placement = placement;
  }

  private element: CreateTimelineElement;
  private placement: InsertElementPlacement;

  execute(): void {
    const editor = getEditor();
    this.savedState = editor.timeline.getTracks();

    // 【2026-09-17 TD-16-27】原实现三处 `return` **静默放弃**：用户把元素拖进时间轴失败时
    // 界面**零反馈**（`logger.error` 只给开发者；`:64` 与 `:80` 连日志都没有）——
    // 「拖上去什么都没发生」与「拖上去成功」在 UI 上无法区分。失败必须可见，
    // 且读者要分离：开发者 → logger（reportDegrade 内部已留痕）；用户 → toast。
    if (!this.savedState) {
      reportDegrade({
        layer: '剪辑器·插入时间轴元素',
        key: this.elementId,
        e: new Error('时间轴轨道不可用（tracks 未就绪）'),
        toast: '插入失败：时间轴尚未就绪',
      });
      return;
    }

    if (!this.validateElementBasics({ element: this.element })) {
      reportDegrade({
        layer: '剪辑器·插入时间轴元素',
        key: this.elementId,
        e: new Error('元素基础校验未通过（必要字段缺失或时长非法）'),
        toast: '插入失败：素材信息不完整',
      });
      return;
    }

    const totalElementsInTimeline = this.savedState.reduce(
      (total, t) => total + t.elements.length,
      0,
    );
    const isFirstElement = totalElementsInTimeline === 0;

    const newElement = this.buildElement({ element: this.element });
    const updateResult = this.resolveTracksWithElement({
      tracks: this.savedState,
      element: newElement,
    });

    if (!updateResult) {
      reportDegrade({
        layer: '剪辑器·插入时间轴元素',
        key: this.elementId,
        e: new Error('resolveTracksWithElement 无可用轨道（无匹配轨道类型或插入位置非法）'),
        toast: '插入失败：找不到合适的时间轴轨道',
      });
      return;
    }

    const { updatedTracks, targetTrackId } = updateResult;
    this.targetTrackId = targetTrackId;

    const isVisualMedia = newElement.type === 'video' || newElement.type === 'image';

    if (isFirstElement && isVisualMedia) {
      const mediaAssets = editor.media.getAssets();
      const activeProject = editor.project.getActive();
      const asset = mediaAssets.find((item: MediaAsset) => item.id === newElement.mediaId);

      // 首次插入可视元素 = 用素材尺寸/帧率初始化画布：改 settings 但 `pushHistory:false`
      //（不需要独立撤销步 —— 用户撤销"插入"时应当一起回滚，而不是留下被改过的画布）。
      // 故这里先捕获，交给本命令的 undo 还原（TD-22-34）。
      const willChangeCanvasSize = !!(asset?.width && asset?.height);
      const willChangeFps = asset?.type === 'video' && !!asset?.fps;
      if (willChangeCanvasSize || willChangeFps) {
        this.savedSettings = activeProject.settings;
        this.savedSettingsUpdatedAt = activeProject.metadata.updatedAt;
      }

      if (asset?.width && asset?.height) {
        const nextCanvasSize = { width: asset.width, height: asset.height };
        const shouldSetOriginalCanvasSize = !activeProject?.settings.originalCanvasSize;
        editor.project.updateSettings({
          settings: {
            canvasSize: nextCanvasSize,
            ...(shouldSetOriginalCanvasSize ? { originalCanvasSize: nextCanvasSize } : {}),
          },
          pushHistory: false,
        });
      }

      if (asset?.type === 'video' && asset?.fps) {
        editor.project.updateSettings({
          settings: { fps: asset.fps },
          pushHistory: false,
        });
      }
    }

    editor.timeline.updateTracks(updatedTracks);
  }

  undo(): void {
    if (this.savedState) {
      const editor = getEditor();
      editor.timeline.updateTracks(this.savedState);
    }

    // 回滚 execute 里那次 `pushHistory:false` 的 settings 变更（TD-22-34）。
    // 与上一段顺序无关：tracks 与 project.settings 是两处独立状态。
    if (this.savedSettings) {
      const editor = getEditor();
      const activeProject = editor.project.getActiveOrNull();
      if (activeProject) {
        editor.project.setActiveProject({
          project: {
            ...activeProject,
            settings: this.savedSettings,
            metadata: {
              ...activeProject.metadata,
              updatedAt: this.savedSettingsUpdatedAt ?? activeProject.metadata.updatedAt,
            },
          },
        });
        editor.save.markDirty();
      }
    }
  }

  getElementId(): string {
    return this.elementId;
  }

  getTrackId(): string | null {
    return this.targetTrackId;
  }

  private buildElement({ element }: { element: CreateTimelineElement }): TimelineElement {
    return {
      ...element,
      id: this.elementId,
      startTime: element.startTime,
      trimStart: element.trimStart ?? 0,
      duration: element.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
    } as TimelineElement;
  }

  private validateElementBasics({ element }: { element: CreateTimelineElement }): boolean {
    if (requiresMediaId({ element }) && !('mediaId' in element)) {
      videoEditorLogger.error('Element requires mediaId');
      return false;
    }

    if (element.type === 'audio' && element.sourceType === 'library' && !element.sourceUrl) {
      videoEditorLogger.error('Library audio element must have sourceUrl');
      return false;
    }

    if (element.type === 'sticker' && !element.iconName) {
      videoEditorLogger.error('Sticker element must have iconName');
      return false;
    }

    if (element.type === 'text' && !element.content) {
      videoEditorLogger.error('Text element must have content');
      return false;
    }

    return true;
  }

  private resolveTracksWithElement({
    tracks,
    element,
  }: {
    tracks: TimelineTrack[];
    element: TimelineElement;
  }): { updatedTracks: TimelineTrack[]; targetTrackId: string } | null {
    const placement = this.placement;

    if (placement.mode === 'explicit') {
      const targetTrack = tracks.find((track) => track.id === placement.trackId);

      if (!targetTrack) {
        videoEditorLogger.error('Track not found:', placement.trackId);
        return null;
      }

      const validation = validateElementTrackCompatibility({
        element,
        track: targetTrack,
      });

      if (!validation.isValid) {
        videoEditorLogger.error(validation.errorMessage);
        return null;
      }

      const adjustedElement = this.adjustElementForMainTrack({
        tracks,
        targetTrackId: targetTrack.id,
        element,
      });

      const updatedTracks = tracks.map((track) =>
        track.id === targetTrack.id
          ? {
              ...track,
              elements: [...track.elements, adjustedElement],
            }
          : track,
      ) as TimelineTrack[];

      return { updatedTracks, targetTrackId: targetTrack.id };
    }

    const trackType = placement.trackType ?? this.getTrackTypeForElement({ element });

    if (
      placement.trackType &&
      !canElementGoOnTrack({
        elementType: element.type,
        trackType,
      })
    ) {
      videoEditorLogger.error(`${element.type} elements cannot be placed on ${trackType} tracks`);
      return null;
    }

    const elementEndTime = element.startTime + element.duration;
    const existingTrack = tracks.find((track) => {
      if (
        !canElementGoOnTrack({
          elementType: element.type,
          trackType: track.type,
        })
      ) {
        return false;
      }

      return !wouldElementOverlap({
        elements: track.elements,
        startTime: element.startTime,
        endTime: elementEndTime,
      });
    });

    if (existingTrack) {
      const adjustedElement = this.adjustElementForMainTrack({
        tracks,
        targetTrackId: existingTrack.id,
        element,
      });

      const updatedTracks = tracks.map((track) =>
        track.id === existingTrack.id
          ? {
              ...track,
              elements: [...track.elements, adjustedElement],
            }
          : track,
      ) as TimelineTrack[];

      return { updatedTracks, targetTrackId: existingTrack.id };
    }

    const newTrackId = generateUUID();
    const newTrack = buildEmptyTrack({
      id: newTrackId,
      type: trackType,
    });
    const newTrackWithElement = {
      ...newTrack,
      elements: [...newTrack.elements, element],
    } as TimelineTrack;

    const updatedTracks = [...tracks];
    const insertIndex =
      placement.insertIndex ?? this.getAutoInsertIndex({ tracks: updatedTracks, trackType });
    updatedTracks.splice(insertIndex, 0, newTrackWithElement);

    return { updatedTracks, targetTrackId: newTrackId };
  }

  private getAutoInsertIndex({
    tracks,
    trackType,
  }: {
    tracks: TimelineTrack[];
    trackType: TrackType;
  }): number {
    if (trackType === 'text') {
      const firstVideoTrackIndex = tracks.findIndex((track) => track.type === 'video');
      if (firstVideoTrackIndex >= 0) {
        return firstVideoTrackIndex;
      }
    }

    return getDefaultInsertIndexForTrack({
      tracks,
      trackType,
    });
  }

  private adjustElementForMainTrack({
    tracks,
    targetTrackId,
    element,
  }: {
    tracks: TimelineTrack[];
    targetTrackId: string;
    element: TimelineElement;
  }): TimelineElement {
    const adjustedStartTime = enforceMainTrackStart({
      tracks,
      targetTrackId,
      requestedStartTime: element.startTime,
    });
    return { ...element, startTime: adjustedStartTime };
  }

  private getTrackTypeForElement({ element }: { element: { type: ElementType } }): TrackType {
    if (element.type === 'video' || element.type === 'image') {
      return 'video';
    }
    return element.type;
  }
}
