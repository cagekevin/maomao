import type { MediaAsset, MediaType } from '@/components/videoEditor/types/assets';
import { detectFileType } from '@/components/base/utils/assetType';

export const SUPPORTS_AUDIO: readonly MediaType[] = ['audio', 'video'];

export function mediaSupportsAudio({ media }: { media: MediaAsset | null | undefined }): boolean {
  if (!media) return false;
  return SUPPORTS_AUDIO.includes(media.type);
}

/**
 * File → 剪辑器媒体类型（image/video/audio）；非媒体 → null。
 *
 * 【TD-16-9 收口 2026-09-16】原为内联 `type.startsWith('image/'|'video/'|'audio/')` 三分支，
 * 与 `base/utils/assetType.detectFileType` 同语义第二份（且漏扩展名兜底）。
 * 现委托真值源：mime 优先、无 mime 时按 EXT_KIND 扩展名表兜底，只保留剪辑器的三值投影。
 */
export const getMediaTypeFromFile = ({ file }: { file: File }): MediaType | null => {
  const kind = detectFileType(file);
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null;
};
