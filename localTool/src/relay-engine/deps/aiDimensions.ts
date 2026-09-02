/** 视频画面比例选项；'adaptive' 由模型自行决定，不参与像素换算。 */
export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const;

export const VIDEO_DURATION_MIN_SECONDS = 2;
export const VIDEO_DURATION_MAX_SECONDS = 15;
export const DEFAULT_VIDEO_DURATION_SECONDS = 5;
export const DEFAULT_VIDEO_FPS = 24;

/** 统一视频帧率，避免非法值进入秒数/帧数换算。 */
export function normalizeVideoFps(fps: number | undefined): number {
  return Number.isFinite(fps) && Number(fps) > 0
    ? Math.max(1, Math.round(Number(fps)))
    : DEFAULT_VIDEO_FPS;
}

/**
 * 将用户可理解的秒数限制到指定上限范围。
 * maxSeconds 缺省时使用通用视频设置的 15s 上限；Seedance 2.5 等长时长模型可显式传入更大上限。
 */
export function normalizeVideoDurationSeconds(
  durationSeconds: number | undefined,
  maxSeconds: number = VIDEO_DURATION_MAX_SECONDS,
): number {
  const duration = Number.isFinite(durationSeconds)
    ? Math.round(Number(durationSeconds))
    : DEFAULT_VIDEO_DURATION_SECONDS;
  return Math.min(maxSeconds, Math.max(VIDEO_DURATION_MIN_SECONDS, duration));
}

/** 按多数视频工作流的首帧语义，将秒数换算为总帧数。 */
export function videoFramesFromDuration(
  durationSeconds: number | undefined,
  fps: number | undefined,
): number {
  return normalizeVideoDurationSeconds(durationSeconds) * normalizeVideoFps(fps) + 1;
}

/** 将旧节点保存的总帧数反算为最接近的整数秒。 */
export function videoDurationFromFrames(
  frameCount: number | undefined,
  fps: number | undefined,
): number {
  if (!Number.isFinite(frameCount) || Number(frameCount) <= 0) {
    return DEFAULT_VIDEO_DURATION_SECONDS;
  }
  const duration = (Math.round(Number(frameCount)) - 1) / normalizeVideoFps(fps);
  return normalizeVideoDurationSeconds(duration);
}

/** 优先使用新秒数字段；旧节点缺失该字段时由总帧数兼容反算。maxSeconds 可覆盖通用 15s 上限。 */
export function resolveVideoDurationSeconds(
  durationSeconds: number | undefined,
  frameCount: number | undefined,
  fps: number | undefined,
  maxSeconds: number = VIDEO_DURATION_MAX_SECONDS,
): number {
  return Number.isFinite(durationSeconds)
    ? normalizeVideoDurationSeconds(durationSeconds, maxSeconds)
    : videoDurationFromFrames(frameCount, fps);
}

/** 把 480p/720p 这类档位换算成长边像素，供只认数字长边的本地工作流使用。 */
export function videoLongSideFromLabel(label: string | undefined): number | undefined {
  const longSideByLabel: Record<string, number> = {
    '480p': 854, '720p': 1280, '1080p': 1920, '4k': 3840,
  };
  return label ? longSideByLabel[label.toLowerCase()] : undefined;
}

/** 视频尺寸按 8 对齐：ComfyUI latent 与多数视频模型都要求边长是 8 的倍数。 */
function alignTo8(value: number): number {
  return Math.max(64, Math.round(value / 8) * 8);
}

/**
 * 将视频分辨率 + 比例映射为像素尺寸。
 *
 * 与图片不同，这里的分辨率数值是**长边**：1280 + 16:9 得到 1280×720，
 * 与常见视频档位一致；若按短边解释会得到 1280×2276 这种不可用尺寸。
 */
export function mapVideoDimensions(
  baseResolution: number,
  aspectRatio: string | undefined,
): { width: number; height: number } {
  const longSide = Number.isFinite(baseResolution) && baseResolution > 0
    ? Math.round(baseResolution)
    : 832;

  const [w, h] = (aspectRatio ?? '').split(':').map(Number);
  if (!w || !h || w <= 0 || h <= 0) {
    return { width: alignTo8(longSide), height: alignTo8(longSide) };
  }

  return w >= h
    ? { width: alignTo8(longSide), height: alignTo8(longSide * (h / w)) }
    : { width: alignTo8(longSide * (w / h)), height: alignTo8(longSide) };
}

/** 将画质 + 比例映射为像素尺寸 */
export function mapImageDimensions(
  imageSize: string,
  aspectRatio: string,
): { width: number; height: number } {
  const shortSideMap: Record<string, number> = { '720p': 720, '1K': 1024, '2K': 2048, '4K': 4096 };
  const shortSide = shortSideMap[imageSize] || 1024;

  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return { width: shortSide, height: shortSide };

  if (w >= h) {
    return { width: Math.round(shortSide * (w / h)), height: shortSide };
  }
  return { width: shortSide, height: Math.round(shortSide * (h / w)) };
}
