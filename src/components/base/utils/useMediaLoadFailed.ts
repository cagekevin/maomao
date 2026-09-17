/**
 * 「媒体元素加载失败」唯一实现 —— `<img>` / `<video>` / `<audio>` 失败可见化的单一出处。
 *
 * 【为什么存在 · 2026-09-17 TD-16-29② 收口】
 * 「裸媒体元素无 onError」此前在**每个显示出口各写一份**（或干脆没写）：
 *   · 预览播放器 `AssetPreviewPlayer` 的 img/video/audio —— 全裸，失败只剩黑框/裂图/静音；
 *   · `VideoThumbnail` 的 `<video>` —— 裸；
 *   · 时间轴贴纸 `<img>` —— 裸。
 * 于是同一次故障（素材文件缺失 / 4xx / 解码失败）在各处**行为不同**、且多数**完全不可见**：
 * 浏览器对失败媒体只给空白或黑框，**用户与开发者都无法区分**「还没加载」与「已损坏」。
 *
 * 【契约】
 *  - `failed` 一旦为 true 即**粘住**（媒体元素不会自愈；重试由上层换 `key`/地址触发，见 `resetKey`）；
 *  - `onError` 只负责置位 + 留痕（`logger.warn`），**不**在 hook 内弹 toast（避免 N 个元素同时失败刷屏）；
 *    用户可见的呈现由调用方按 `failed` 渲染**显式占位**（见 `MissingMediaIndicator` / `LazyImage`）。
 *  - `resetKey` 变化即复位（换素材 / 重新上传后必须重新尝试；否则上一张的 failed 会粘住新图）。
 *
 * 【与图片专用的关系】
 * 图片有更强的两段回退语义（小图 → 原图 → 占位）——那是 `useImageFallbackSrc`。
 * 本 hook 是**通用兜底**：video/audio/贴纸 SVG 这类**没有回退段**的媒体用它；
 * 图片能走 `LazyImage` / `useImageFallbackSrc` 的**仍应走那边**（那里有回退原图这一步）。
 *
 * 【禁止】
 *  - `onError={() => {}}`（把"没处理"写成"处理了"）；
 *  - `onError` 里**只** `logger` 而调用方不用 `failed` 渲染占位（用户看不见 ⇒ 等于没做）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../core/logger.ts';

export interface MediaLoadFailedState {
  /** 元素已报错（粘住，直到 `resetKey` 变化） */
  failed: boolean;
  /** 透传给媒体元素的 `onError` */
  onError: () => void;
}

/**
 * @param resetKey 变化即复位失败态（通常传媒体地址或素材 id）
 * @param label    留痕用：失败的媒体种类（如 'video' / 'audio' / 'image'）
 * @param detail   留痕用：补充上下文（如 { id, url }）
 */
export function useMediaLoadFailed(
  resetKey: unknown,
  label: string,
  detail?: Record<string, unknown>,
): MediaLoadFailedState {
  const [failed, setFailed] = useState(false);

  // resetKey 变化 → 复位（换素材后必须重新尝试，否则旧 failed 粘住新素材）
  useEffect(() => setFailed(false), [resetKey]);

  // detail 收进 ref：调用方多传内联对象字面量（每次渲染新引用），若进 deps 会让 onError
  // 每帧换引用；而它**只用于日志**，不参与语义。ref 保证 onError 引用稳定（不触发元素重挂）。
  const detailRef = useRef(detail);
  detailRef.current = detail;

  const onError = useCallback(() => {
    setFailed(true);
    const message = `${label} 加载失败`;
    if (detailRef.current) logger.warn('媒体', message, detailRef.current);
    else logger.warn('媒体', message);
  }, [label]);

  return { failed, onError };
}
