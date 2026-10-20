/**
 * 剪辑器侧领域对象工厂（MediaAsset / TimelineTrack）。
 *
 * 【为什么要有】此前测试只写"本用例关心的几个字段"，其余必填字段缺失，于是只能
 * `{…} as unknown as MediaAsset` 硬转成完整类型 —— 一旦真类型加必填字段，测试不会红，
 * 生产却可能拿到缺字段的对象（断言把缺口藏了）。
 * 现在由工厂**补齐默认值**，调用点只描述差异，类型由编译器核对（plan 150 §11.1 簇 C）。
 */
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';
import type {
  AudioTrack,
  TextTrack,
  VideoTrack,
} from '../../src/components/videoEditor/types/timeline';

/** 素材：补 `name` / `type` / `file` 默认值（`file` 必填，测试用空 File 即可）。 */
export function mediaAssetOf(init: Partial<MediaAsset> & { id: string }): MediaAsset {
  const { id, name, type, file, ...rest } = init;
  return {
    id,
    name: name ?? id,
    type: type ?? 'video',
    file: file ?? new File([], id, { type: 'video/mp4' }),
    ...rest,
  };
}

/** 视频轨：补 `name` / `elements` / `isMain` / `muted` / `hidden`。 */
export function videoTrackOf(init: Partial<VideoTrack> = {}): VideoTrack {
  return {
    id: 'track-video',
    name: '视频轨',
    type: 'video',
    elements: [],
    isMain: false,
    muted: false,
    hidden: false,
    ...init,
  };
}

/** 文本轨：补 `name` / `elements` / `hidden`。 */
export function textTrackOf(init: Partial<TextTrack> = {}): TextTrack {
  return {
    id: 'track-text',
    name: '文本轨',
    type: 'text',
    elements: [],
    hidden: false,
    ...init,
  };
}

/** 音频轨：补 `name` / `elements` / `muted`。 */
export function audioTrackOf(init: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'track-audio',
    name: '音频轨',
    type: 'audio',
    elements: [],
    muted: false,
    ...init,
  };
}
