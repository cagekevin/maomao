/**
 * 「图片显示地址 + 两段失败回退」唯一实现 —— 本地图显示策略的单一出处。
 *
 * 【为什么存在 · 2026-09-17 收口】
 * 「本地图先走按需小图（缩略图端点）、失败回退原图」这条策略，此前在**每个显示出口各写一份**：
 *   · `AssetNode` 自己写 `<img>` + 自持回退态；
 *   · `LazyImage` 只做「失败 → 破图占位」，**没有回退原图**；
 *   · `ChatMarkdown` 干脆是裸 `<img>`，什么失败处理都没有。
 * 于是同一次故障（缩略图端点对 Jimp 不可编码的源返回 415/500）在画布上被回退兜住、
 * 在 AI 助手待发送区却直接显示「图片加载失败」—— **同一能力三套失败行为**。
 *
 * 【契约（与后端对称）】
 *  - 地址：本地 `/files/` 文件 → 按需小图端点（`resolveAssetUrl`，见 assetUrl.ts）；
 *    外部 http/data/blob → 原图（出图端点无法服务）。
 *  - 失败：小图失败 → **回退原图**（浏览器多能直接渲染，如 webp）；
 *    原图也失败 → `failed=true`，由调用方呈现**显式**失败态（不许静默裂图）。
 *  - 复位：`url` 变化即回退到初始段（否则上一张的 failed 会粘住新图）。
 *
 * 后端侧对应契约见 `localTool/src/routes/files.ts` `handleThumbnail`：
 * 「缩略图失败是显式 4xx/5xx，由前端回退原图」——本 hook 就是那条契约的前端半边。
 *
 * 消费方：`LazyImage`（通用图片）、`AssetNode`（节点主图，需 onLoad 取比例故自持 `<img>`）。
 * **新增显示图片一律用本 hook 或 LazyImage，禁止再各写一段失败处理。**
 */
import { useCallback, useEffect, useState } from 'react';
import { useRenderAssetResolver } from './assetUrl.ts';

/** 回退段：render=按需小图（首次）；original=回退原图；failed=两次都失败 */
type ImageStage = 'render' | 'original' | 'failed';

export interface ImageFallbackSrc {
  /** 当前应加载的地址 */
  src: string;
  /** 小图与原图都失败（调用方应呈现显式失败态，而非默认裂图） */
  failed: boolean;
  /** 透传给 `<img onError>` —— 内部按段推进，不会回退到同一地址（杜绝 onError 循环） */
  onError: () => void;
}

/**
 * @param url 原始图片地址（可能与 `src` 不同：本地文件会被解析成按需小图端点）
 */
export function useImageFallbackSrc(url: string): ImageFallbackSrc {
  const resolve = useRenderAssetResolver();
  const renderSrc = resolve(url || '');
  const [stage, setStage] = useState<ImageStage>('render');

  // 地址变化 → 回退段复位（换图/编辑/重新生成后必须重新尝试小图）
  useEffect(() => setStage('render'), [url]);

  const onError = useCallback(
    () => setStage((s) => (s === 'render' && renderSrc !== url ? 'original' : 'failed')),
    [renderSrc, url],
  );

  return {
    src: stage === 'original' ? url : renderSrc,
    failed: stage === 'failed',
    onError,
  };
}
