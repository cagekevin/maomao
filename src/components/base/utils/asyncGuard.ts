/**
 * 统一异步边界守卫（R2 系统性根因治理）。
 *
 * 【为什么存在】项目大量异步操作（图片加载 / 视频生成 / 全景解码 / 网关请求）没有统一
 * 超时兜底：有的有（faceMosaic 私有 loadImage 20s）、有的没有（imageCompress / OverlayEditor /
 * GridMergeNode 的 loadImage 永久挂起），
 * 导致「loading 永不结束 / 用户无感卡死」。本模块提供统一的超时 + 失败语义，消灭这类 bug。
 *
 * 【用法】
 *  - withTimeout(promise, ms, msg?)：给任意 Promise 加超时，超时抛 TimeoutError。
 *  - isTimeoutError(e)：判断是否超时（调用方可据此决定"重试/降级/提示"）。
 *  - loadImageWithTimeout(url, ms?, opts?)：图片加载 + 超时 + crossOrigin + 取消，统一图片入口。
 */

import { IMAGE_LOAD_TIMEOUT } from '../core/config.ts';
import type { ImageLoadOptions } from '@/types';

/** 超时错误（统一类型，便于调用方用 isTimeoutError 区分"超时"与"真实失败"） */
export class TimeoutError extends Error {
  isTimeout = true;
  override name = 'TimeoutError';
  constructor(message = '操作超时') {
    super(message);
  }
}

/** 判断是否为超时错误 */
export function isTimeoutError(e: unknown): boolean {
  const err = e as { isTimeout?: boolean; name?: string } | null;
  return !!(
    err &&
    (err instanceof TimeoutError || err?.isTimeout === true || err?.name === 'TimeoutError')
  );
}

/**
 * 给 Promise 加超时。超时后 reject TimeoutError。
 * @param promise 要加超时的 Promise
 * @param ms 超时毫秒
 * @param message 超时文案
 * @param signal 可选，超时时 abort 它（供底层真正取消，避免资源泄漏）
 * @param onTimeout 可选，超时时回调（在 reject 前调用，供调用方主动 cancel 底层任务）
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = '操作超时',
  signal?: AbortSignal,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!(ms > 0)) return resolve(promise);
    const timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* 取消回调失败不阻断 */
      }
      // 中止底层信号：优先标准 abort()，跨环境（jsdom/老浏览器）用 dispatchEvent fallback
      // 注：AbortSignal 原生无 abort()（AbortController 才有），此分支本为兜底旧实现，故窄化类型后保持运行时语义
      const sig = signal as (AbortSignal & { abort?: () => void }) | undefined;
      try {
        if (sig?.abort) sig.abort();
        else sig?.dispatchEvent?.(new Event('abort'));
      } catch {
        /* 忽略 */
      }
      reject(new TimeoutError(message));
    }, ms);
    const done = () => clearTimeout(timer);
    Promise.resolve(promise)
      .then((v) => {
        done();
        resolve(v);
      })
      .catch((e) => {
        done();
        reject(e);
      });
  });
}

/**
 * 统一图片加载入口：HTMLImageElement + 超时 + crossOrigin + 可取消。
 * 已替代各模块私有实现：imageCompress / faceMosaic / OverlayEditor / GridMergeNode（原先均无统一超时）。
 * 批量加载请改用 loadImageOrNull（坏图降级 null，不抛错）。
 */
export function loadImageWithTimeout(
  url: string,
  opts: ImageLoadOptions = {},
): Promise<HTMLImageElement> {
  const { timeoutMs = IMAGE_LOAD_TIMEOUT, crossOrigin = 'anonymous' } = opts;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = crossOrigin;
    const timer = setTimeout(() => {
      img.src = ''; // 打断挂起加载
      reject(new TimeoutError('图片加载超时'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('图片加载失败（可能跨域或格式不支持）'));
    };
    img.src = String(url || '');
  });
}

/**
 * 宽容版图片加载：失败（超时 / 跨域 / 格式错误 / 空 url）一律返回 null，绝不抛错。
 * 供「批量加载、跳过坏图」场景（宫格合成 / 图层叠加）使用——这类场景用 Promise.all，
 * 若沿用 loadImageWithTimeout 的 reject 语义，单张坏图会让整批失败。
 *
 * 两级尝试（收口自原先散落各模块的私有实现，保留其兼容语义）：
 *   1) 带 crossOrigin（canvas 不被污染，可导出）；
 *   2) 失败则去掉 crossOrigin 再试一次（跨域图无 CORS 头时的兜底，代价是 canvas 被污染）。
 * 两级都受 IMAGE_LOAD_TIMEOUT 保护——原先的私有实现**没有超时**，图片挂起会让导出/合成永久卡死。
 */
export async function loadImageOrNull(
  url: string,
  opts: ImageLoadOptions = {},
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await loadImageWithTimeout(url, opts);
  } catch {
    /* 落到无 crossOrigin 重试：跨域图无 CORS 头的兜底 */
  }
  try {
    return await loadImageWithTimeout(url, { ...opts, crossOrigin: null });
  } catch {
    return null;
  }
}
