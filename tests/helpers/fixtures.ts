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
  ImageElement,
  StickerElement,
  TextElement,
  TextTrack,
  TScene,
  UploadAudioElement,
  VideoElement,
  VideoTrack,
} from '../../src/components/videoEditor/types/timeline';
import { defaultScriptBoxTop } from '../../src/components/scriptbox/scriptBoxSchema';
import type { ScriptBoxData } from '../../src/components/scriptbox/scriptBoxSchema';

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

/* ── 时间轴元素 / 场景（T1-4：元素形状不再靠断言）──────────────────────── */

const IDENTITY_TRANSFORM = { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };

function elementBase(init: {
  id?: string | undefined;
  name?: string | undefined;
  duration?: number | undefined;
  startTime?: number | undefined;
  trimStart?: number | undefined;
}) {
  const id = init.id ?? 'el';
  return {
    id,
    name: init.name ?? id,
    duration: init.duration ?? 1,
    startTime: init.startTime ?? 0,
    trimStart: init.trimStart ?? 0,
  };
}

/** 视频元素：补 mediaId / transform / opacity。 */
export function videoElementOf(init: Partial<VideoElement> & { id?: string } = {}): VideoElement {
  const { id, name, ...rest } = init;
  return {
    ...elementBase({ id, name }),
    type: 'video',
    mediaId: 'media-1',
    transform: IDENTITY_TRANSFORM,
    opacity: 1,
    ...rest,
  };
}

/** 图片元素。 */
export function imageElementOf(init: Partial<ImageElement> & { id?: string } = {}): ImageElement {
  const { id, name, ...rest } = init;
  return {
    ...elementBase({ id, name }),
    type: 'image',
    mediaId: 'media-1',
    transform: IDENTITY_TRANSFORM,
    opacity: 1,
    ...rest,
  };
}

/** 文本元素：补样式默认值（容器只断言内容/时间时用）。 */
export function textElementOf(init: Partial<TextElement> & { id?: string } = {}): TextElement {
  const { id, name, ...rest } = init;
  return {
    ...elementBase({ id, name }),
    type: 'text',
    content: '文本',
    fontSize: 48,
    fontFamily: 'sans-serif',
    color: '#ffffff',
    backgroundColor: 'transparent',
    textAlign: 'center',
    fontWeight: 400,
    fontStyle: 'normal',
    textDecoration: 'none',
    transform: IDENTITY_TRANSFORM,
    opacity: 1,
    ...rest,
  };
}

/** 音频元素（缺省是 upload 变体）。 */
export function audioElementOf(
  init: Partial<UploadAudioElement> & { id?: string } = {},
): UploadAudioElement {
  const { id, name, ...rest } = init;
  return {
    ...elementBase({ id, name }),
    type: 'audio',
    sourceType: 'upload',
    mediaId: 'media-1',
    volume: 1,
    ...rest,
  };
}

/** 贴纸元素。 */
export function stickerElementOf(
  init: Partial<StickerElement> & { id?: string } = {},
): StickerElement {
  const { id, name, ...rest } = init;
  return {
    ...elementBase({ id, name }),
    type: 'sticker',
    iconName: 'star',
    transform: IDENTITY_TRANSFORM,
    opacity: 1,
    ...rest,
  };
}

/** 场景：补 tracks / bookmarks / 时间戳。 */
export function sceneOf(init: Partial<TScene> = {}): TScene {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const id = init.id ?? 'scene-1';
  return {
    id,
    name: init.name ?? id,
    isMain: init.isMain ?? true,
    tracks: [],
    bookmarks: [],
    createdAt: now,
    updatedAt: now,
    ...init,
  };
}

/** 剧本盒 node.data：默认值取 schema 基线，只覆盖差异。 */
export function scriptBoxDataOf(init: Partial<ScriptBoxData> = {}): ScriptBoxData {
  return { ...defaultScriptBoxTop(), shots: [], assets: [], ...init };
}
