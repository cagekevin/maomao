import type { TTimeCode } from '@/components/videoEditor/types/time';
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';

export function roundToFrame({ time, fps }: { time: number; fps: number }): number {
  return Math.round(time * fps) / fps;
}

export function formatTimeCode({
  timeInSeconds,
  format = 'HH:MM:SS:CS',
  fps,
}: {
  timeInSeconds: number;
  format?: TTimeCode;
  fps?: number;
}): string {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);
  const frames = fps ? Math.floor((timeInSeconds % 1) * fps) : 0;

  switch (format) {
    case 'MM:SS':
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    case 'HH:MM:SS':
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    case 'HH:MM:SS:CS':
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
    case 'HH:MM:SS:FF':
      if (!fps) throw new Error('FPS is required for HH:MM:SS:FF format');
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }
}

export function parseTimeCode({
  timeCode,
  format = 'HH:MM:SS:CS',
  fps,
}: {
  timeCode: string;
  format?: TTimeCode;
  fps: number;
}): number | null {
  if (!timeCode || typeof timeCode !== 'string') return null;

  const cleanTimeCode = timeCode.trim();

  try {
    switch (format) {
      case 'MM:SS': {
        const parts = cleanTimeCode.split(':');
        if (parts.length !== 2) return null;
        const [minutes, seconds] = parts.map((part) => parseInt(part, 10));
        if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
        if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
        return minutes * 60 + seconds;
      }

      case 'HH:MM:SS': {
        const parts = cleanTimeCode.split(':');
        if (parts.length !== 3) return null;
        const [hours, minutes, seconds] = parts.map((part) => parseInt(part, 10));
        if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
        if (hours < 0 || minutes < 0 || seconds < 0 || minutes >= 60 || seconds >= 60) return null;
        return hours * 3600 + minutes * 60 + seconds;
      }

      case 'HH:MM:SS:CS': {
        const parts = cleanTimeCode.split(':');
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, centiseconds] = parts.map((part) => parseInt(part, 10));
        if (
          Number.isNaN(hours) ||
          Number.isNaN(minutes) ||
          Number.isNaN(seconds) ||
          Number.isNaN(centiseconds)
        )
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          centiseconds < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          centiseconds >= 100
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }

      case 'HH:MM:SS:FF': {
        const parts = cleanTimeCode.split(':');
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, frames] = parts.map((part) => parseInt(part, 10));
        if (
          Number.isNaN(hours) ||
          Number.isNaN(minutes) ||
          Number.isNaN(seconds) ||
          Number.isNaN(frames)
        )
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          frames < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          frames >= fps
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + frames / fps;
      }
    }
  } catch (e) {
    // 时间串解析失败 → null（调用方按「非法输入」处理）；另留痕给开发者（2026-09-17 拆静默）。
    videoEditorLogger.debug('剪辑器', '时间串解析失败（已由 null 呈现）', e);
    return null;
  }
}

export function timeToFrame({ time, fps }: { time: number; fps: number }): number {
  return Math.round(time * fps);
}

export function frameToTime({ frame, fps }: { frame: number; fps: number }): number {
  return frame / fps;
}

export function snapTimeToFrame({ time, fps }: { time: number; fps: number }): number {
  if (fps <= 0) return time;
  const frame = timeToFrame({ time, fps });
  return frameToTime({ frame, fps });
}

export function getSnappedSeekTime({
  rawTime,
  duration,
  fps,
}: {
  rawTime: number;
  duration: number;
  fps: number;
}): number {
  const snappedTime = snapTimeToFrame({ time: rawTime, fps });
  return Math.max(0, Math.min(duration, snappedTime));
}

/**
 * 作品**总帧数**（唯一实现）。
 *
 * 【为什么必须唯一】预览与导出必须数出**一样的帧**：导出按它循环渲染，
 * 预览按它夹取末帧时刻（`getLastFrameTime` 派生自它）。
 * 各写一份（`Math.ceil(duration * fps)` vs `duration - 1/fps`）时，时长非帧整数倍的
 * 作品会**多出/少掉末帧** —— 成片与预览差一帧，且只在特定时长上显形。
 */
export function getFrameCount({ duration, fps }: { duration: number; fps: number }): number {
  if (duration <= 0 || fps <= 0) return 0;
  return Math.ceil(duration * fps);
}

/** 末帧的渲染时刻 = 第 `getFrameCount() - 1` 帧（与导出最后一帧**同一刻**）。 */
export function getLastFrameTime({ duration, fps }: { duration: number; fps: number }): number {
  const frameCount = getFrameCount({ duration, fps });
  if (frameCount === 0) return 0;
  return frameToTime({ frame: frameCount - 1, fps });
}
