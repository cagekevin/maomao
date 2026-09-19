/**
 * 视频编辑器（cutia 外部接入）logger 兼容壳。
 *
 * 【为什么存在】
 * cutia 原裸用 `console.error/warn/log/debug`，绕过统一 `base/core/logger`
 * （不上报后端、无法全链路 grep）。接入后应统一走统一 logger。
 * 这里做一层**纯转发适配**：实现 100% 落在 base/core/logger，保留 console 风格签名
 * (msg, ...args)，让原有 ~85 处调用点只把 `console.` 换成 `logger.` 即可，零行为回归。
 *
 * 末位若是 Error 对象，转成 message（防 JSON.stringify(Error) = '{}' 丢信息）。
 * category 固定 'videoEditor'，便于后端按域 grep；detail 为合并后的原文。
 */
import { logger as baseLogger } from '../../base/core/logger.ts';

function detail(args: unknown[]): unknown {
  if (args.length === 0) return undefined;
  return args
    .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeStringify(a)))
    .join(' ');
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const videoEditorLogger = {
  error: (...args: unknown[]) => baseLogger.error('videoEditor', 'log', detail(args)),
  warn: (...args: unknown[]) => baseLogger.warn('videoEditor', 'log', detail(args)),
  info: (...args: unknown[]) => baseLogger.info('videoEditor', 'log', detail(args)),
  // console.log 语义等同 info
  log: (...args: unknown[]) => baseLogger.info('videoEditor', 'log', detail(args)),
  // debug 默认按 unified logger 的 DEBUG_MODULES 门控（module: 'videoEditor'）静默，
  // 需排查时打开该模块位即可；保留 gated 行为避免噪音刷爆后端日志。
  debug: (...args: unknown[]) =>
    baseLogger.debug('videoEditor', 'log', detail(args), { module: 'videoEditor' }),
};
