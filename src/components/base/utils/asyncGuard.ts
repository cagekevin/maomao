/**
 * 统一异步 / 资源边界守卫（R2 系统性根因治理 · 2026-09-14 扩入「静默释放」原语）。
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
 *  - loadImageOrNull(url, opts?)：宽容版图片加载（坏图降级 null，绝不抛），供批量加载。
 *  - releaseQuietly(act) / releaseQuietlyAsync(act)：**静默释放原语** —— `RELEASE_FAIL` 豁免码的
 *    **唯一实现**（释放 / 停止 / 取消 / 断开失败一律不阻断主流程）。调用点因此**不再需要贴 `catch-ok`**。
 *  - tryParse(parser, fallback?)：**解析兜底原语** —— `PARSE_FALLBACK` 豁免码的**唯一实现**
 *    （JSON / DOMParser / URL / 正则编译失败 → 落默认分支 / 默认文案）。调用点因此**不再需要贴 `catch-ok`**。
 *
 * 【归属说明（2026-09-14）】本文件 = 「**边界守卫原语**」集合：超时边界（withTimeout）+ 宽容加载
 *   （loadImageOrNull）+ 静默释放（releaseQuietly）+ 解析兜底（tryParse）。后者的消费方含 `base/core/**`（core → utils
 *   已有先例：`contentStore.ts` 引本文件的 `withTimeout`），故未下沉 core/utils.ts。
 */

import { IMAGE_LOAD_TIMEOUT } from '../core/config.ts';
import type { AssetLoadOptions } from '@/types';

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
        // catch-ok: NON_BLOCKING
        /* 取消回调失败不阻断 */
      }
      // 中止底层信号：优先标准 abort()，跨环境（jsdom/老浏览器）用 dispatchEvent fallback
      // 注：AbortSignal 原生无 abort()（AbortController 才有），此分支本为兜底旧实现，故窄化类型后保持运行时语义
      const sig = signal as (AbortSignal & { abort?: () => void }) | undefined;
      releaseQuietly(() => {
        if (sig?.abort) sig.abort();
        else sig?.dispatchEvent?.(new Event('abort'));
      });
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
  opts: AssetLoadOptions = {},
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
  opts: AssetLoadOptions = {},
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await loadImageWithTimeout(url, opts);
  } catch {
    // catch-ok: NON_BLOCKING
    /* 落到无 crossOrigin 重试：跨域图无 CORS 头的兜底 */
  }
  try {
    return await loadImageWithTimeout(url, { ...opts, crossOrigin: null });
  } catch {
    return null;
  }
}

/**
 * 「静默释放」原语 —— `RELEASE_FAIL` 豁免码的**唯一实现**（2026-09-14 · TD-02-26 成本层收口）。
 *
 * 【为什么是原语，而不是逐处手写豁免标记】同一语义曾**手写 13 遍**
 *   （`close` / `stop` / `abort` / `cancel` / `video.load()` 释源），每处贴一个理由码 ——
 *   豁免面大、理由可绕、写法重复。收口后「允许吞」的理由与边界收敛到本函数一处，
 *   调用点**不再需要任何豁免标记**（本仓判据：同一语义手写 ≥3 次即应收口为原语）。
 *
 * 【语义】`act` 抛错即吞 —— 这类调用**不影响主流程**（资源已在销毁路径 / 已终态 / 浏览器拒绝）。
 * 【何时不该用】act 的失败**需要可见**（落盘 / 网络 / 用户操作）→ 用 `reportDegrade` / `logger.warn`；
 *   契约违约需要 fail-fast → 直接抛（守卫），别用本原语。
 */
export function releaseQuietly(act: () => unknown): void {
  try {
    act();
  } catch {
    // catch-ok: RELEASE_FAIL —— 本处即该码的唯一实现：释放 / 停止 / 取消 / 断开失败不阻断主流程
  }
}

/**
 * 异步形态（同一 `RELEASE_FAIL` 语义）：`await act()`，失败吞掉 —— 用于返回 Promise 的释放
 * （如 mediabunny `output.cancel()`）。
 *
 * 【为什么不与同步版合成一个函数】await 与否会**改变调用点时序**（导出 / 卸载路径必须等释放完成）；
 * 而用 `Promise.resolve(act())` 把同步调用也裹进微任务同样是语义变化 —— 故两态各一函数、各一处豁免。
 */
export async function releaseQuietlyAsync(act: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await act();
  } catch {
    // catch-ok: RELEASE_FAIL —— 同 releaseQuietly（异步形态），唯一实现处
  }
}

/**
 * 「解析兜底」原语 —— `PARSE_FALLBACK` 豁免码的**唯一实现**（2026-09-14 · TD-02-26 成本层收口）。
 *
 * 【为什么是原语，而不是逐处手写豁免标记】同一语义曾**手写 8+ 遍**
 *   （`JSON.parse` / `DOMParser` / URL 解析 / 正则编译，失败一律落默认分支），每处贴一个理由码 ——
 *   豁免面大、理由可绕、写法重复。收口后「允许吞」的理由与边界收敛到本函数一处，
 *   调用点**不再需要任何豁免标记**（本仓判据：同一语义手写 ≥3 次即应收口为原语）。
 *
 * 【语义】`parser()` 抛错即返回 `fallback`（默认分支 / 默认文案 / 空值）。
 *   - 不传 `fallback` → 返回 `undefined`（调用方用 `?.` / 判空继续）。
 *   - 传 `fallback` → 返回该兜底值（如 `''`）。
 * 【何时不该用】解析失败**需要可见**（用户配置损坏 / 网络响应体错误 → 应 toast / logger）→
 *   用 `reportDegrade` / `logger.warn`；契约违约需要 fail-fast → 直接抛（守卫），别用本原语。
 */
export function tryParse<T>(parser: () => T, fallback?: T): T | undefined {
  try {
    return parser();
  } catch {
    // catch-ok: PARSE_FALLBACK —— 本处即该码的唯一实现：解析失败兜底（JSON/DOM/URL/正则 失败 → 落默认分支）
    return fallback;
  }
}

/**
 * 「尽力而为·非阻塞」原语 —— `NON_BLOCKING` 豁免码的**主实现**（2026-09-14 · TD-02-26 成本层收口）。
 *
 * 【为什么是原语】同一语义（fire-and-forget / 批量单步失败不阻断主链路）曾**手写 13+ 遍**
 *   （`accountsStore` 10 处 chrome API 调用 + `useAgentChat` 3 处会话落盘），每处贴一个 `NON_BLOCKING` 标记 ——
 *   豁免面大、理由可绕。收口后「允许吞」的理由与边界收敛到本函数一处，调用点**不再需要手写豁免标记**
 *   （本仓判据：同一语义手写 ≥3 次即应收口为原语）。
 *
 * 【语义】`act()` 抛错即静默吞掉（`NON_BLOCKING`：有意的非阻塞副作用，失败确属无关主链路 / 幂等 / 已有留痕）。
 * 【何时不该用】失败**需要可见**（用户动作结果 / 账号同步局部失败应提示）→ 用 `reportDegrade` / `logger.warn`；
 *   或该语义实为非解析 / 非释放 → 改用 `tryParse` / `releaseQuietly`。其余**语义性非阻塞**（轮询 / 跨标签页广播 /
 *   可选增强 / 落盘回退）因形态各异，仍手写标记并注明原因，不强行收口。
 */
export function attemptQuietly(act: () => void): void {
  try {
    act();
  } catch {
    // catch-ok: NON_BLOCKING —— 本处即该码的主实现：fire-and-forget / 批量单步失败不阻断主链路
  }
}

export async function attemptQuietlyAsync(act: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await act();
  } catch {
    // catch-ok: NON_BLOCKING —— 同 attemptQuietly（异步形态），主实现处
  }
}
