import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { toast } from '@/components/videoEditor/lib/toast';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import { getMediaTypeFromFile } from '@/components/videoEditor/engine/lib/media/media-utils';
import { detectFileType } from '@/components/base/utils/assetType';
import { canvasToBlob, canvasToImageDataUrl } from '@/components/base/core/utils';
import { getVideoInfo } from './mediabunny';
import { Input, ALL_FORMATS, BlobSource, VideoSampleSink } from 'mediabunny';

export interface ProcessedMediaAsset extends Omit<MediaAsset, 'id'> {}

const THUMBNAIL_MAX_WIDTH = 1280;
const THUMBNAIL_MAX_HEIGHT = 720;

const getThumbnailSize = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): { width: number; height: number } => {
  const aspectRatio = width / height;
  let targetWidth = width;
  let targetHeight = height;

  if (targetWidth > THUMBNAIL_MAX_WIDTH) {
    targetWidth = THUMBNAIL_MAX_WIDTH;
    targetHeight = Math.round(targetWidth / aspectRatio);
  }
  if (targetHeight > THUMBNAIL_MAX_HEIGHT) {
    targetHeight = THUMBNAIL_MAX_HEIGHT;
    targetWidth = Math.round(targetHeight * aspectRatio);
  }

  return { width: targetWidth, height: targetHeight };
};

const renderToThumbnailDataUrl = ({
  width,
  height,
  draw,
}: {
  width: number;
  height: number;
  draw: ({
    context,
    width,
    height,
  }: {
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
  }) => void;
}): string => {
  const size = getThumbnailSize({ width, height });
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas context');
  }

  draw({ context, width: size.width, height: size.height });
  // 唯一出口（产出即校验）：失败抛错 → 由 processMediaAssets 的 catch 留痕（logger.warn）
  return canvasToImageDataUrl(canvas, 'image/jpeg', 0.8);
};

export async function generateThumbnail({
  videoFile,
  timeInSeconds,
}: {
  videoFile: File;
  timeInSeconds: number;
}): Promise<string> {
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error('No video track found in the file');
  }

  const canDecode = await videoTrack.canDecode();
  if (!canDecode) {
    throw new Error('Video codec not supported for decoding');
  }

  const sink = new VideoSampleSink(videoTrack);

  const frame = await sink.getSample(timeInSeconds);

  if (!frame) {
    throw new Error('Could not get frame at specified time');
  }

  try {
    return renderToThumbnailDataUrl({
      width: videoTrack.displayWidth,
      height: videoTrack.displayHeight,
      draw: ({ context, width, height }) => {
        frame.draw(context, 0, 0, width, height);
      },
    });
  } finally {
    frame.close();
  }
}

export async function extractVideoFrame({
  videoFile,
  timeInSeconds,
  fileName,
}: {
  videoFile: File;
  timeInSeconds: number;
  fileName: string;
}): Promise<{ file: File; width: number; height: number }> {
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  });
  const videoTrack = await input.getPrimaryVideoTrack();

  if (!videoTrack) throw new Error('No video track found in the file');
  if (!(await videoTrack.canDecode())) {
    throw new Error('Video codec not supported for decoding');
  }

  const frame = await new VideoSampleSink(videoTrack).getSample(timeInSeconds);
  if (!frame) throw new Error('Could not get frame at specified time');

  try {
    const width = videoTrack.displayWidth;
    const height = videoTrack.displayHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    frame.draw(context, 0, 0, width, height);
    // 【TD-06-14】走唯一出口（原自写 Promise + `reject(Could not encode PNG)` = 第二份判据）
    const blob = await canvasToBlob(canvas, 'image/png');

    return {
      file: new File([blob], fileName, { type: 'image/png' }),
      width,
      height,
    };
  } finally {
    frame.close();
  }
}

// 【TD-22-52 已删】原 `generateImageThumbnail`（新窗口 Image → canvas → dataURL）——
// 图片不再生成客户端 base64 缩略图（显示改走统一出口的服务端出图端点），删后**零消费者**。
// 视频侧的 `generateThumbnail`（`<video>` seek 抽帧）**保留**：服务端出图端点是 Jimp，只处理图片。

export async function processMediaAssets({
  files,
  onProgress,
}: {
  files: FileList | File[];
  onProgress?: ({ progress }: { progress: number }) => void;
}): Promise<ProcessedMediaAsset[]> {
  const fileArray = Array.from(files);
  const processedAssets: ProcessedMediaAsset[] = [];

  const total = fileArray.length;
  let completed = 0;

  for (const file of fileArray) {
    const fileType = getMediaTypeFromFile({ file });

    if (!fileType) {
      toast.error(`Unsupported file type: ${file.name}`);
      continue;
    }

    const url = URL.createObjectURL(file);
    let thumbnailUrl: string | undefined;
    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let fps: number | undefined;
    let hasAudio: boolean | undefined;

    try {
      if (fileType === 'image') {
        const dimensions = await getImageDimensions({ file });
        width = dimensions.width;
        height = dimensions.height;
        // 【TD-22-52 收口】图片**不再**生成客户端 base64 缩略图：显示走统一出口的服务端出图端点
        // （`/api/files/thumbnail`，见 MediaAsset.persistentUrl）。两条收益：
        //  ① 治"网格解码全分辨率原图"；
        //  ② 止住 **base64 缩略图落 KV** —— 与 `baseUrl/assetUrl.ts` 的公开契约一致
        //     （「base64 只是出站编码，**永不落盘**」）。
        // 视频仍必须客户端抽帧（服务端出图端点是 Jimp，只处理图片），故其 thumbnailUrl 保留。
      } else if (fileType === 'video') {
        try {
          const videoInfo = await getVideoInfo({ videoFile: file });
          duration = videoInfo.duration;
          width = videoInfo.width;
          height = videoInfo.height;
          fps = Number.isFinite(videoInfo.fps) ? Math.round(videoInfo.fps) : undefined;
          hasAudio = videoInfo.hasAudio; // TD-21-17：带原声视频 🔊 角标的数据源

          thumbnailUrl = await generateThumbnail({
            videoFile: file,
            timeInSeconds: 1,
          });
        } catch (error) {
          videoEditorLogger.warn('Video processing failed', error);
        }
      } else if (fileType === 'audio') {
        // For audio, we don't set width/height/fps (they'll be undefined)
        duration = await getMediaDuration({ file });
      }

      processedAssets.push({
        name: file.name,
        type: fileType,
        file,
        url,
        thumbnailUrl,
        duration,
        width,
        height,
        fps,
        hasAudio,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      completed += 1;
      if (onProgress) {
        const percent = Math.round((completed / total) * 100);
        onProgress({ progress: percent });
      }
    } catch (error) {
      videoEditorLogger.error('Error processing file:', file.name, error);
      toast.error(`Failed to process ${file.name}`);
      URL.revokeObjectURL(url); // Clean up on error
    }
  }

  return processedAssets;
}

const getImageDimensions = ({
  file,
}: {
  file: File;
}): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.addEventListener('load', () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      resolve({ width, height });
      URL.revokeObjectURL(objectUrl);
      img.remove();
    });

    img.addEventListener('error', () => {
      reject(new Error('Could not load image'));
      URL.revokeObjectURL(objectUrl);
      img.remove();
    });

    img.src = objectUrl;
  });
};

const getMediaDuration = ({ file }: { file: File }): Promise<number> => {
  return new Promise((resolve, reject) => {
    // 【TD-16-10 收口 2026-09-16】原 `file.type.startsWith('video/') ? 'video' : 'audio'` 是
    // **静默二分兜底** —— 非音视频文件（如 .txt）被当 audio 建元素、静默走 loadedmetadata 失败路径，
    // 掩盖了「这不是媒体文件」这一事实。现按真值源判定：只接受 video/audio，其余显式拒绝。
    const kind = detectFileType(file);
    if (kind !== 'video' && kind !== 'audio') {
      reject(new Error(`Not a media file: ${kind}`));
      return;
    }
    const element = document.createElement(kind) as HTMLVideoElement;
    const objectUrl = URL.createObjectURL(file);

    element.addEventListener('loadedmetadata', () => {
      resolve(element.duration);
      URL.revokeObjectURL(objectUrl);
      element.remove();
    });

    element.addEventListener('error', () => {
      reject(new Error('Could not load media'));
      URL.revokeObjectURL(objectUrl);
      element.remove();
    });

    element.src = objectUrl;
    element.load();
  });
};
