import { logger } from '@videoEditor/lib/logger';
import type { EditorCore } from '@videoEditor/engine/core';
import type { RootNode } from '@videoEditor/engine/services/renderer/nodes/root-node';
import type { ExportOptions, ExportResult } from '@videoEditor/types/export';
import { SceneExporter } from '@videoEditor/engine/services/renderer/scene-exporter';
import { buildScene } from '@videoEditor/engine/services/renderer/scene-builder';
import { createTimelineAudioBuffer } from '@videoEditor/engine/lib/media/audio';
import { getSelectedVideoClip } from '@videoEditor/engine/lib/export';
import type { TimelineTrack } from '@videoEditor/types/timeline';

export class RendererManager {
  private renderTree: RootNode | null = null;
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {}

  setRenderTree({ renderTree }: { renderTree: RootNode | null }): void {
    this.renderTree = renderTree;
    this.notify();
  }

  getRenderTree(): RootNode | null {
    return this.renderTree;
  }

  async exportProject({ options }: { options: ExportOptions }): Promise<ExportResult> {
    return this.exportTracks({
      tracks: this.editor.timeline.getTracks(),
      duration: this.editor.timeline.getTotalDuration(),
      emptyError: 'Project is empty',
      options,
    });
  }

  async exportSelectedClip({
    selection,
    options,
  }: {
    selection: { trackId: string; elementId: string };
    options: ExportOptions;
  }): Promise<ExportResult> {
    const clip = getSelectedVideoClip({
      tracks: this.editor.timeline.getTracks(),
      selection,
    });
    if (!clip) {
      return { ok: false, reason: 'not-video', message: 'Selected element is not a video' };
    }

    return this.exportTracks({
      tracks: clip.tracks,
      duration: clip.duration,
      emptyError: 'Selected clip is empty',
      options,
    });
  }

  private async exportTracks({
    tracks,
    duration,
    emptyError,
    options,
  }: {
    tracks: TimelineTrack[];
    duration: number;
    emptyError: string;
    options: ExportOptions;
  }): Promise<ExportResult> {
    const { format, quality, fps, includeAudio, onProgress, onCancel } = options;

    try {
      const mediaAssets = this.editor.media.getAssets();
      // ── 修复(2026-09-15 · 假守卫)：原用 `getActive()`（**无项目时 throw**）再判 `!activeProject`
      // —— 该分支永远不成立、真正兜住它的是外层 catch（把「没项目」误报成 unknown 导出错误）。
      // 改用 `getActiveOrNull()` 让**判据成立且结果诚实**（明确的 no-active-project）。
      const activeProject = this.editor.project.getActiveOrNull();

      if (!activeProject) {
        return { ok: false, reason: 'no-active-project', message: 'No active project' };
      }

      if (duration === 0) {
        return { ok: false, reason: 'empty-timeline', message: emptyError };
      }

      const exportFps = fps || activeProject.settings.fps;
      const canvasSize = activeProject.settings.canvasSize;

      let audioBuffer: AudioBuffer | null = null;
      if (includeAudio) {
        onProgress?.({ progress: 0.05 });
        audioBuffer = await createTimelineAudioBuffer({
          tracks,
          mediaAssets,
          duration,
        });
      }

      const scene = buildScene({
        tracks,
        mediaAssets,
        duration,
        canvasSize,
        fitCanvasSize: activeProject.settings.originalCanvasSize ?? canvasSize,
        background: activeProject.settings.background,
      });

      const exporter = new SceneExporter({
        width: canvasSize.width,
        height: canvasSize.height,
        fps: exportFps,
        format,
        quality,
        shouldIncludeAudio: !!includeAudio,
        audioBuffer: audioBuffer || undefined,
      });

      exporter.on('progress', (progress) => {
        const adjustedProgress = includeAudio ? 0.05 + progress * 0.95 : progress;
        onProgress?.({ progress: adjustedProgress });
      });

      let cancelled = false;
      const checkCancel = () => {
        if (onCancel?.()) {
          cancelled = true;
          exporter.cancel();
        }
      };

      const cancelInterval = setInterval(checkCancel, 100);

      try {
        const buffer = await exporter.export({ rootNode: scene });
        clearInterval(cancelInterval);

        if (cancelled) {
          return { ok: false, reason: 'cancelled' };
        }

        if (!buffer) {
          return { ok: false, reason: 'no-buffer', message: 'Export failed to produce buffer' };
        }

        return {
          ok: true,
          buffer,
        };
      } finally {
        clearInterval(cancelInterval);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      return {
        ok: false,
        reason: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
