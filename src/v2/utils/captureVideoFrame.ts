// ============================================================
// 一毛AI画布 - 视频帧捕获工具
// 从视频 URL 中捕获指定时间点的帧，返回 Blob
// ============================================================

export interface CaptureOptions {
  /** 捕获时间点（秒），默认 0.1 */
  atTime?: number;
  /** JPEG 质量，默认 0.85 */
  quality?: number;
  /** 超时时间（毫秒），默认 15000 */
  timeoutMs?: number;
}

/**
 * 从视频 URL 捕获一帧画面
 * @param videoUrl 视频 URL
 * @param options 捕获选项
 * @returns Blob (image/jpeg)
 */
export function captureVideoFrameBlob(
  videoUrl: string,
  options: CaptureOptions = {}
): Promise<Blob> {
  const { atTime = 0.1, quality = 0.85, timeoutMs = 15000 } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    let resolved = false;
    const timeout = window.setTimeout(() => {
      cleanup(Error(`captureVideoFrame: timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup(error?: Error) {
      window.clearTimeout(timeout);
      video.removeAttribute('src');
      try { video.load(); } catch {}
      if (error && !resolved) {
        resolved = true;
        reject(error);
      }
    }

    function done(blob: Blob) {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(blob);
      }
    }

    function fail(error: Error) {
      cleanup(error);
    }

    function onLoadedData() {
      const seekTime = Math.min(
        atTime,
        Math.max(0, (video.duration || atTime) - 0.01)
      );

      if (Math.abs(video.currentTime - seekTime) < 0.001) {
        captureFrame();
      } else {
        video.onseeked = captureFrame;
        try {
          video.currentTime = seekTime;
        } catch {
          captureFrame();
        }
      }
    }

    function captureFrame() {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          fail(Error('captureVideoFrame: zero video dimensions'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fail(Error('captureVideoFrame: no 2d context'));
          return;
        }

        ctx.drawImage(video, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            blob
              ? done(blob)
              : fail(Error('captureVideoFrame: toBlob returned null (tainted canvas?)'));
          },
          'image/jpeg',
          quality
        );
      } catch (e) {
        fail(e instanceof Error ? e : Error(String(e)));
      }
    }

    video.onerror = () => fail(Error('captureVideoFrame: video load/decode error'));
    video.onloadeddata = onLoadedData;

    // 如果视频已经加载完成
    if (video.readyState >= 2) {
      onLoadedData();
    }
  });
}