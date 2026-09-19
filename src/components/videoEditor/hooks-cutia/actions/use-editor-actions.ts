'use client';
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';

import { useRef } from 'react';
import { useTimelineStore } from '@/components/videoEditor/stores/timeline-store';
import { useMediaPreviewStore } from '@/components/videoEditor/stores/media-preview-store';
import { useActionHandler } from '@/components/videoEditor/hooks-cutia/actions/use-action-handler';
import { useEditor } from '../use-editor';
import { useElementSelection } from '../timeline/element/use-element-selection';
import { getElementsAtTime } from '@/components/videoEditor/engine/timeline';
// 更新(2026-09-14)：TTS 域已删，占位为诚实失败。
const generateAndInsertSpeech = async (): Promise<never> => {
  throw new Error('语音生成未移植（tts 域已移除）');
};
import { toast } from '@/components/videoEditor/lib/toast';
import { DEFAULT_EXPORT_OPTIONS } from '@/components/videoEditor/constants/export-constants';
import {
  getExportMimeType,
  getSelectedClipExportFilename,
} from '@/components/videoEditor/engine/lib/export';
import { extractVideoFrame } from '@/components/videoEditor/engine/lib/media/processing';
import {
  buildImageElement,
  findAvailableVideoTrackAbove,
  getVisualSourceTime,
} from '@/components/videoEditor/engine/timeline/element-utils';
import {
  AddMediaAssetCommand,
  AddTrackCommand,
  type Command,
  InsertElementCommand,
} from '@/components/videoEditor/engine/commands';
import { storageService } from '@/components/videoEditor/engine/services/storage/service';
import { releaseQuietlyAsync } from '@/components/base/utils/net/asyncGuard';

export function useEditorActions() {
  const editor = useEditor();
  const activeProject = editor.project.getActive();
  const { selectedElements, setElementSelection } = useElementSelection();
  const { clipboard, setClipboard, toggleSnapping } = useTimelineStore();
  const freezeFrameInFlight = useRef(false);

  useActionHandler(
    'toggle-play',
    () => {
      useMediaPreviewStore.getState().clearSelection();
      editor.playback.toggle();
    },
    undefined,
  );

  useActionHandler(
    'stop-playback',
    () => {
      if (editor.playback.getIsPlaying()) {
        editor.playback.toggle();
      }
      editor.playback.seek({ time: 0 });
    },
    undefined,
  );

  useActionHandler(
    'seek-forward',
    (args) => {
      const seconds = args?.seconds ?? 1;
      editor.playback.seek({
        time: Math.min(
          editor.timeline.getTotalDuration(),
          editor.playback.getCurrentTime() + seconds,
        ),
      });
    },
    undefined,
  );

  useActionHandler(
    'seek-backward',
    (args) => {
      const seconds = args?.seconds ?? 1;
      editor.playback.seek({
        time: Math.max(0, editor.playback.getCurrentTime() - seconds),
      });
    },
    undefined,
  );

  useActionHandler(
    'frame-step-forward',
    () => {
      const fps = activeProject.settings.fps;
      editor.playback.seek({
        time: Math.min(
          editor.timeline.getTotalDuration(),
          editor.playback.getCurrentTime() + 1 / fps,
        ),
      });
    },
    undefined,
  );

  useActionHandler(
    'frame-step-backward',
    () => {
      const fps = activeProject.settings.fps;
      editor.playback.seek({
        time: Math.max(0, editor.playback.getCurrentTime() - 1 / fps),
      });
    },
    undefined,
  );

  useActionHandler(
    'jump-forward',
    (args) => {
      const seconds = args?.seconds ?? 5;
      editor.playback.seek({
        time: Math.min(
          editor.timeline.getTotalDuration(),
          editor.playback.getCurrentTime() + seconds,
        ),
      });
    },
    undefined,
  );

  useActionHandler(
    'jump-backward',
    (args) => {
      const seconds = args?.seconds ?? 5;
      editor.playback.seek({
        time: Math.max(0, editor.playback.getCurrentTime() - seconds),
      });
    },
    undefined,
  );

  useActionHandler(
    'goto-start',
    () => {
      editor.playback.seek({ time: 0 });
    },
    undefined,
  );

  useActionHandler(
    'goto-end',
    () => {
      editor.playback.seek({ time: editor.timeline.getTotalDuration() });
    },
    undefined,
  );

  useActionHandler(
    'split',
    () => {
      const currentTime = editor.playback.getCurrentTime();
      const elementsToSplit =
        selectedElements.length > 0
          ? selectedElements
          : getElementsAtTime({
              tracks: editor.timeline.getTracks(),
              time: currentTime,
            });

      if (elementsToSplit.length === 0) return;

      editor.timeline.splitElements({
        elements: elementsToSplit,
        splitTime: currentTime,
      });
    },
    undefined,
  );

  useActionHandler(
    'split-left',
    () => {
      const currentTime = editor.playback.getCurrentTime();
      const elementsToSplit =
        selectedElements.length > 0
          ? selectedElements
          : getElementsAtTime({
              tracks: editor.timeline.getTracks(),
              time: currentTime,
            });

      if (elementsToSplit.length === 0) return;

      editor.timeline.splitElements({
        elements: elementsToSplit,
        splitTime: currentTime,
        retainSide: 'right',
      });
    },
    undefined,
  );

  useActionHandler(
    'split-right',
    () => {
      const currentTime = editor.playback.getCurrentTime();
      const elementsToSplit =
        selectedElements.length > 0
          ? selectedElements
          : getElementsAtTime({
              tracks: editor.timeline.getTracks(),
              time: currentTime,
            });

      if (elementsToSplit.length === 0) return;

      editor.timeline.splitElements({
        elements: elementsToSplit,
        splitTime: currentTime,
        retainSide: 'left',
      });
    },
    undefined,
  );

  useActionHandler(
    'delete-selected',
    () => {
      if (selectedElements.length === 0) {
        return;
      }
      editor.timeline.deleteElements({
        elements: selectedElements,
      });
      // 【此处原有一句 `selection.clearSelection()`，已删】选择的有效性由
      // SelectionManager 读取侧与 tracks 求交决定 —— 被删元素自动失效，
      // 撤销后元素回来选择也自动恢复。手写清理是「谁删除谁记得清」的散落判据，
      // 且它恰好漏掉了素材连带删除 / 删轨道 / 删场景三条路径（TD-22-26）。
    },
    undefined,
  );

  useActionHandler(
    'select-all',
    () => {
      const allElements = editor.timeline.getTracks().flatMap((track) =>
        track.elements.map((element) => ({
          trackId: track.id,
          elementId: element.id,
        })),
      );
      setElementSelection({ elements: allElements });
    },
    undefined,
  );

  useActionHandler(
    'duplicate-selected',
    () => {
      editor.timeline.duplicateElements({
        elements: selectedElements,
      });
    },
    undefined,
  );

  useActionHandler(
    'toggle-elements-muted-selected',
    () => {
      editor.timeline.toggleElementsMuted({ elements: selectedElements });
    },
    undefined,
  );

  useActionHandler(
    'toggle-elements-visibility-selected',
    () => {
      editor.timeline.toggleElementsVisibility({ elements: selectedElements });
    },
    undefined,
  );

  useActionHandler(
    'detach-audio',
    () => {
      if (selectedElements.length === 0) return;
      editor.timeline.detachAudio({ elements: selectedElements });
    },
    undefined,
  );

  useActionHandler(
    'toggle-bookmark',
    () => {
      editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
    },
    undefined,
  );

  useActionHandler(
    'copy-selected',
    () => {
      if (selectedElements.length === 0) return;

      const results = editor.timeline.getElementsWithTracks({
        elements: selectedElements,
      });
      const items = results.map(({ track, element }) => {
        const { ...elementWithoutId } = element;
        return {
          trackId: track.id,
          trackType: track.type,
          element: elementWithoutId,
        };
      });

      setClipboard({ items });
    },
    undefined,
  );

  useActionHandler(
    'export-selected-clip',
    () => {
      if (selectedElements.length !== 1) return;

      const [{ element } = { element: null }] = editor.timeline.getElementsWithTracks({
        elements: selectedElements,
      });
      if (element?.type !== 'video') return;

      const toastId = 'export-selected-clip';
      toast.loading('正在导出所选片段…', { id: toastId });

      (async () => {
        const result = await editor.renderer.exportSelectedClip({
          selection: selectedElements[0],
          options: DEFAULT_EXPORT_OPTIONS,
        });

        // 判别联合：单判 `ok` 即可（原 `!success || !buffer` 双检已消除，TD-22-38②）。
        // 注：本调用未传 `onCancel`（DEFAULT_EXPORT_OPTIONS 无它），故 cancelled 分支实际不可达。
        if (!result.ok) {
          toast.error('导出片段失败', {
            id: toastId,
            description: result.reason === 'cancelled' ? undefined : result.message,
          });
          return;
        }

        const blob = new Blob([result.buffer], {
          type: getExportMimeType({ format: DEFAULT_EXPORT_OPTIONS.format }),
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getSelectedClipExportFilename({
          startTime: element.startTime,
          duration: element.duration,
          fps: activeProject.settings.fps,
          format: DEFAULT_EXPORT_OPTIONS.format,
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        toast.success('片段已导出', { id: toastId });
      })().catch((error) => {
        videoEditorLogger.error('Failed to export selected clip:', error);
        toast.error('导出片段失败', { id: toastId });
      });
    },
    undefined,
  );

  useActionHandler(
    'freeze-frame',
    (args) => {
      if (freezeFrameInFlight.current) return;

      const sourceRef = args ?? (selectedElements.length === 1 ? selectedElements[0] : undefined);
      if (!sourceRef) {
        toast.warning('请选中一个视频片段再冻结');
        return;
      }

      const [source] = editor.timeline.getElementsWithTracks({
        elements: [sourceRef],
      });
      if (!source || source.element.type !== 'video' || source.track.type !== 'video') {
        toast.warning('请选中一个视频片段再冻结');
        return;
      }
      const sourceElement = source.element;
      const sourceTrack = source.track;

      const currentTime = editor.playback.getCurrentTime();
      if (
        currentTime < sourceElement.startTime ||
        currentTime >= sourceElement.startTime + sourceElement.duration
      ) {
        toast.warning('请把播放头移到视频范围内');
        return;
      }

      const sourceAsset = editor.media
        .getAssets()
        .find((asset) => asset.id === sourceElement.mediaId);
      if (!sourceAsset) {
        toast.error('源视频不可用');
        return;
      }

      freezeFrameInFlight.current = true;
      const toastId = 'freeze-frame';
      toast.loading('正在创建冻结帧…', { id: toastId });

      (async () => {
        let assetId: string | undefined;
        let objectUrl: string | undefined;
        let batchCommand: Command | null = null;
        let commandStarted = false;
        let committed = false;

        try {
          const sourceTime = getVisualSourceTime({
            timelineTime: currentTime,
            startTime: sourceElement.startTime,
            duration: sourceElement.duration,
            trimStart: sourceElement.trimStart,
            playbackRate: sourceElement.playbackRate,
            reversed: sourceElement.reversed,
          });
          const sourceName = sourceElement.name.replace(/\.[^/.]+$/, '');
          const { file, width, height } = await extractVideoFrame({
            videoFile: sourceAsset.file,
            timeInSeconds: sourceTime,
            fileName: `${sourceName}-freeze-${currentTime.toFixed(3)}.png`,
          });

          objectUrl = URL.createObjectURL(file);
          const asset = {
            name: file.name,
            type: 'image' as const,
            file,
            url: objectUrl,
            width,
            height,
          };
          const addMediaCommand = new AddMediaAssetCommand(activeProject.metadata.id, asset, true);
          assetId = addMediaCommand.getAssetId();
          await storageService.saveMediaAsset({
            projectId: activeProject.metadata.id,
            mediaAsset: { ...asset, id: assetId },
          });

          const tracks = editor.timeline.getTracks();
          const sourceTrackIndex = tracks.findIndex((track) => track.id === sourceTrack.id);
          if (sourceTrackIndex < 0) throw new Error('Source track is unavailable');

          const duration = 3;
          let targetTrackId = findAvailableVideoTrackAbove({
            tracks,
            sourceTrackId: sourceTrack.id,
            startTime: currentTime,
            endTime: currentTime + duration,
          });
          const commands: Command[] = [addMediaCommand];

          if (!targetTrackId) {
            const addTrackCommand = new AddTrackCommand('video', sourceTrackIndex);
            targetTrackId = addTrackCommand.getTrackId();
            commands.push(addTrackCommand);
          }

          const imageElement = buildImageElement({
            mediaId: assetId,
            name: file.name,
            duration,
            startTime: currentTime,
          });
          imageElement.transform = {
            ...sourceElement.transform,
            position: { ...sourceElement.transform.position },
          };
          imageElement.opacity = sourceElement.opacity;

          const insertCommand = new InsertElementCommand({
            element: imageElement,
            placement: { mode: 'explicit', trackId: targetTrackId },
          });
          commands.push(insertCommand);
          // 一次动作 = 一条历史条目；0/1/N 的打包判据收口在 executeBatch（TD-22-51）。
          batchCommand = editor.command.executeBatch({ commands });
          commandStarted = batchCommand !== null;
          committed = true;

          setElementSelection({
            elements: [
              {
                trackId: targetTrackId,
                elementId: insertCommand.getElementId(),
              },
            ],
          });
          toast.success('冻结帧已创建', { id: toastId });
        } catch (error) {
          videoEditorLogger.error('Failed to create freeze frame:', error);
          if (commandStarted && !committed) batchCommand?.undo();
          if (!committed && assetId) {
            // TD-16-3：回滚清理失败走 `RELEASE_FAIL` 唯一实现（原语自带理由），不再手写 catch-ok 标记。
            // 收窄后的 id 先提为 const：跨函数边界后 TS 不再保留 `assetId` 的类型收窄。
            const rollbackAssetId = assetId;
            const projectId = activeProject.metadata.id;
            await releaseQuietlyAsync(() =>
              storageService.deleteMediaAsset({ projectId, id: rollbackAssetId }),
            );
          }
          if (!committed && objectUrl) URL.revokeObjectURL(objectUrl);
          toast.error('创建冻结帧失败', {
            id: toastId,
          });
        } finally {
          freezeFrameInFlight.current = false;
        }
      })();
    },
    undefined,
  );

  useActionHandler(
    'paste-copied',
    () => {
      if (!clipboard?.items.length) return;

      editor.timeline.pasteAtTime({
        time: editor.playback.getCurrentTime(),
        clipboardItems: clipboard.items,
      });
    },
    undefined,
  );

  useActionHandler(
    'toggle-snapping',
    () => {
      toggleSnapping();
    },
    undefined,
  );

  useActionHandler(
    'convert-to-speech',
    () => {
      const results = editor.timeline.getElementsWithTracks({
        elements: selectedElements,
      });
      const textElements = results.filter(({ element }) => element.type === 'text');

      if (textElements.length === 0) return;

      const toastId = 'convert-to-speech';
      toast.loading(`正在把 ${textElements.length} 段文本转语音…`, { id: toastId });

      (async () => {
        let successCount = 0;
        let failCount = 0;

        for (const { element } of textElements) {
          if (element.type !== 'text') continue;
          try {
            await generateAndInsertSpeech();
            successCount++;
          } catch (error) {
            videoEditorLogger.error('TTS conversion failed for element:', error);
            failCount++;
          }
        }

        if (failCount === 0) {
          toast.success(`已转换 ${successCount} 段文本为语音`, { id: toastId });
        } else {
          toast.warning(`成功 ${successCount} 段，失败 ${failCount} 段`, { id: toastId });
        }
      })();
    },
    undefined,
  );

  useActionHandler(
    'undo',
    () => {
      editor.command.undo();
    },
    undefined,
  );

  useActionHandler(
    'redo',
    () => {
      editor.command.redo();
    },
    undefined,
  );
}
