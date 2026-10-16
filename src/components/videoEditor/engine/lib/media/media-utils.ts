import type { MediaAsset, MediaType } from '@/components/videoEditor/types/mediaAssets';
import { detectFileType } from '@/components/base/utils/media/assetType';

export const SUPPORTS_AUDIO: readonly MediaType[] = ['audio', 'video'];

export function mediaSupportsAudio({ media }: { media: MediaAsset | null | undefined }): boolean {
  if (!media) return false;
  return SUPPORTS_AUDIO.includes(media.type);
}

/**
 * **素材索引（唯一派生）**：`Map<assetId, MediaAsset>`。
 *
 * 【为什么必须唯一】"按 id 查素材"里**用哪个键就是口径** —— `id` / `persistentUrl` / `contentId`
 * 都有人用（本仓 `link-media-refs` 的双轨去重正是按 `contentId` + 归一化 `url` 判的），
 * 故它不是一个"随便写写都一样"的平凡派生：消费方若自建索引并换成别的键，**它自己那一处**
 * 就查不到素材（表现为画面缺失 / 音频无声，且只在"该键恰好不同"的数据上显形）。
 * ⇒ 一律从这里取索引，别在消费方内联建 Map。
 */
export function indexMediaAssets({
  mediaAssets,
}: {
  mediaAssets: MediaAsset[];
}): Map<string, MediaAsset> {
  return new Map(mediaAssets.map((asset) => [asset.id, asset]));
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
