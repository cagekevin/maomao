import { useDirectorStore } from "../store/directorStore";
import type { CameraShotSnapshot } from "../store/directorStore";

/**
 * 动画视频导出（captureStream + MediaRecorder）。
 *
 * 由 DirectorCanvas 内的录制驱动（有 R3F 渲染循环）注册 captureStream 源，
 * 本模块负责：接管播放 → 逐帧推进 currentTime → MediaRecorder 录制 → Blob 下载。
 * 优先 MP4(H.264)，不支持回退 WebM(VP8/VP9)。
 */

export type AnimationExportFormat = "mp4" | "webm";

export interface AnimationExportOptions {
  fps?: number;
  width?: number;
  height?: number;
  view?: "director" | "camera";
  format?: AnimationExportFormat;
  onProgress?: (progress: number) => void;
}

export interface AnimationExportHandler {
  (
    options: Required<Pick<AnimationExportOptions, "fps" | "width" | "height" | "view">> & {
      format: AnimationExportFormat;
      onProgress?: (progress: number) => void;
    }
  ): Promise<{ blob: Blob; format: AnimationExportFormat; fileBase: string }>;
}

let animationExportHandler: AnimationExportHandler | null = null;

export function setAnimationExportHandler(handler: AnimationExportHandler | null) {
  animationExportHandler = handler;
}

export function isAnimationExportSupported() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
}

function pickSupportedMime(format: AnimationExportFormat) {
  const candidates =
    format === "mp4"
      ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((mime) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) ?? null;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportAnimation(options: AnimationExportOptions): Promise<void> {
  if (!isAnimationExportSupported()) {
    throw new Error("当前浏览器不支持视频录制（MediaRecorder）");
  }
  if (!animationExportHandler) {
    throw new Error("动画录制源未注册，请先进入导演台视口");
  }

  const fps = Math.min(60, Math.max(1, Math.round(options.fps ?? 30)));
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const view = options.view ?? "director";
  const requestedFormat = options.format ?? "mp4";
  const mime = pickSupportedMime(requestedFormat);
  const format: AnimationExportFormat = mime ? requestedFormat : "webm";
  const resolvedMime = mime ?? pickSupportedMime("webm");

  const result = await animationExportHandler({
    fps,
    width,
    height,
    view,
    format,
    onProgress: options.onProgress,
  });

  // 编码兜底：若驱动侧未产出可用 Blob，交给浏览器能力回退
  const blob = result.blob.size > 0 ? result.blob : new Blob([result.blob], { type: resolvedMime ?? "video/webm" });
  const duration = useDirectorStore.getState().project.timeline?.duration ?? 0;
  const fileBase = `storyai-animation-${duration.toFixed(1)}s-${fps}fps`;
  const ext = format === "mp4" ? "mp4" : "webm";
  triggerBlobDownload(blob, `${fileBase}.${ext}`);
}

export type { CameraShotSnapshot };
