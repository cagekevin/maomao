import { memo } from 'react';
import { Video, Music } from 'lucide-react';
import { useVideoPoster } from '../../../hooks/useVideoPoster.ts';
import { toAbsoluteFileUrl } from '../utils/assetUrl.ts';
import LazyImage from './LazyImage.tsx';

/**
 * 附件媒体封面（按类型渲染，纯展示、不含点击/移除交互）。
 *
 * 共享给「发送前 chip（AttMediaChip）」与「发送后气泡（AgentMessage）」，
 * 避免视频首帧 / 音频图标逻辑两处分叉（此前各写一份，改样式易漏改）。
 *  - video：useVideoPoster 抓首帧作封面（走统一出口 LazyImage，带破图兜底）；抓帧失败回退 Video 图标。
 *  - audio：Music 图标占位（音频无视觉帧）。
 *  - image / 其它：返回 null，由调用方自行渲染
 *    （气泡用 LazyImage 带破图兜底，chip 用直接 img，差异各自保留）。
 *
 * 返回元素自带 w-full h-full 充满类，调用方外层只需有一个固定尺寸的容器即可铺满。
 */
const AttachmentCover = memo(function AttachmentCover({
  type,
  url,
}: {
  type?: string;
  url?: string;
}) {
  const isVideo = type === 'video';
  const isAudio = type === 'audio';
  const abs = toAbsoluteFileUrl(String(url || ''));
  // hook 必须无条件调用：非视频时 url 为空串且 enabled=false，直接返回空封面
  const poster = useVideoPoster(isVideo ? abs : '', isVideo);
  if (isAudio) {
    return (
      <span className="w-full h-full flex items-center justify-center bg-black/5 text-faint">
        <Music size={20} strokeWidth={1.8} />
      </span>
    );
  }
  if (isVideo) {
    return poster ? (
      // TD-19-2：封面走统一图片出口 LazyImage（与气泡图片一致）——破图兜底 + 契约一致性。
      // poster 是 blob:（useVideoPoster 抓的首帧），经 useRenderAssetResolver 按原样透传（不劣化），
      // 但获得统一的 onError 破图占位，不再裸 <img> 分叉。
      <LazyImage
        src={poster}
        alt=""
        className="w-full h-full"
        imgClassName="w-full h-full object-cover"
      />
    ) : (
      <span className="w-full h-full flex items-center justify-center bg-black/5 text-faint">
        <Video size={22} strokeWidth={1.8} />
      </span>
    );
  }
  return null;
});

export default AttachmentCover;
