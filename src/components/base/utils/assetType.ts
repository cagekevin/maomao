/**
 * 媒体类型判断工具（复刻官方 xi.jsx:30-48 的类型判定 / H_.jsx onDrop 的文件类型判定）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【唯一真值源】全库「扩展名 / mime → 媒体类别」判定只有下面 EXT_KIND 一张表 + 一组 data: 前缀。
 *  · 消费方：AssetNode.detectAssetType（节点内容态）、useAssetDropPaste.detectFileType（拖入/粘贴建节点）、
 *    assetStore.detectAssetType（素材库分类）、classifyUrl / resolveAssetType（产出类型，含
 *    useConnectedInputs 连线判型）、isAudio（素材库/生成面板）、VideoProcessNode 上游视频筛选。
 *  · 禁止再就地手写 `\.(mp4|webm…)$` 正则：此前 5 处各写一份，已漂移出三类不一致
 *    （ogg 归属相反 / ogv·oga·opus 等漏认 / a.mp4?token=1 因未剥查询串被误判 image）。
 * ════════════════════════════════════════════════════════════════
 *
 * 类型约定（对齐官方 xi.jsx / AssetNode）：
 *  - image / video / audio / text：本模块判定的四类（AssetType）
 *  - other：非以上类型的文件（如压缩包）；empty：无 URL/文件
 */
import type { AssetType } from '@/types';

/**
 * 扩展名 → 媒体类别（唯一真值源；新增媒体格式只改这张表）。
 *
 * 两处历史漂移的取舍（已统一，不再各写一套）：
 *  · ogg 归 audio：ogg 容器最常见的是音频（Ogg Vorbis），视频 ogg 用 ogv 区分。
 *    此前 resultUrlExtractor.classifyUrl / VideoProcessNode.VIDEO_EXT 把 ogg 当 video，
 *    而 assetType 当 audio —— 现统一为 audio；显式 `data:video/ogg` 前缀仍判 video。
 *  · 带查询串/锚点的 URL 先剥 `?` `#` 再比扩展名：此前 detectAssetType 不剥，导致
 *    `a.mp4?token=1` 落到「默认 image」。
 */
const EXT_KIND: ReadonlyArray<readonly [AssetType, readonly string[]]> = [
  ['video', ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv']],
  ['audio', ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus', 'wma', 'aiff']],
  ['image', ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']],
  ['text', ['txt', 'md', 'markdown', 'json', 'log', 'csv', 'srt']],
];

/** 扩展名 → 类别 查表（由 EXT_KIND 派生，勿另建） */
const EXT_MAP: ReadonlyMap<string, AssetType> = new Map(
  EXT_KIND.flatMap(([kind, exts]) => exts.map((e) => [e, kind] as const)),
);

/** data: 前缀 → 类别（mime 大类比扩展名权威：data:video/ogg 仍是 video） */
const DATA_PREFIX: ReadonlyArray<readonly [string, AssetType]> = [
  ['data:video/', 'video'],
  ['data:audio/', 'audio'],
  ['data:image/', 'image'],
  ['data:text/', 'text'],
];

/**
 * URL / 文件名 → 媒体类别；无扩展名或未收录返回 null（不猜）。
 * 判定顺序：data: 前缀 → 剥 `?`/`#` → 扩展名表。
 * 未知 data: URI 直接返回 null（避免对超长 base64 做正则扫描），由调用方兜底。
 */
export function classifyAssetUrlKind(url: string | null | undefined): AssetType | null {
  if (!url) return null;
  const lower = String(url).toLowerCase();
  if (lower.startsWith('data:')) {
    for (const [prefix, kind] of DATA_PREFIX) if (lower.startsWith(prefix)) return kind;
    return null;
  }
  const clean = lower.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_MAP.get(clean.slice(dot + 1)) ?? null;
}

/**
 * 判断一个 URL（dataURL / http / 文件名）的媒体类型。
 * 优先看 dataURL 前缀（如 data:video/），其次看扩展名；未识别按 image 兜底。
 */
export function detectAssetType(url: string | null | undefined): AssetType {
  if (!url) return 'empty';
  return classifyAssetUrlKind(url) ?? 'image'; // data:image / http 图片 / 其它 URL 默认按图片
}

/** detectFileType 入参最小契约：只需 name / type（真 File 天然满足；assetStore.TypeProbe 亦满足） */
export interface TypeProbeLike {
  name?: string;
  type?: string;
}

/**
 * 判断一个 File / 文件描述（拖入、上传、素材分类）的媒体类型。
 * mime 优先（比文件名权威），其次按文件名扩展名查表；都未识别 → other。
 */
export function detectFileType(file: TypeProbeLike | null | undefined): AssetType {
  if (!file) return 'other';
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'text';
  return classifyAssetUrlKind(file.name) ?? 'other';
}

/**
 * 产出类型判定：产出方声明的 assetType 优先（blob/无扩展名的产出会被扩展名表漏判，
 * 见 VideoProcessNode extractAudio spawn 的 assetNode），否则按 URL 判型；
 * text / 未识别归 image（产出结果只有图/视频/音频三种）。
 */
export function classifyUrl(url: string | null | undefined): AssetType {
  const kind = classifyAssetUrlKind(url);
  return kind === 'video' || kind === 'audio' ? kind : 'image';
}

/** resolveAssetType：classifyUrl + 产出方声明优先（useConnectedInputs 连线判型同源） */
export function resolveAssetType(
  url: string | null | undefined,
  assetType: AssetType | null | undefined,
): AssetType {
  if (assetType === 'image' || assetType === 'video' || assetType === 'audio') return assetType;
  return classifyUrl(url);
}

/**
 * 判断一个 URL 是否「可作图片源显示」：dataURL / http(s) / blob。
 * 用于拖入 URL 文本时决定建 assetNode 还是 textGenerateNode。
 */
export function isAssetUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
  );
}

/**
 * 判断是否为音频素材（type 字段或 URL 扩展名）。
 * 收敛 AssetLibrary / GeneratedView 各自重复的实现，统一放这里。
 * @param type 素材 type（如 'audio'）
 * @param url 素材 URL（按统一扩展名表兜底，含 ?#/大小写处理）
 */
export function isAudio(type: string | null | undefined, url: string | null | undefined): boolean {
  return (
    type === 'audio' ||
    (!!type && type.startsWith('audio')) ||
    classifyAssetUrlKind(url) === 'audio'
  );
}
