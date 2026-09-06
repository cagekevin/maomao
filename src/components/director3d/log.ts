// 统一日志层（director3d）。
// 纪律：
//  - 所有关键链路/重要错误的记录统一走本模块，禁止散写 console.*（本地调试除外）。
//  - 默认「安静」：仅 error 级别实际输出；debug 级由 DEBUG 开关控制，默认关闭，不上报。
//  - 支持挂接可选上报函数（configureErrorReporting），供接线真实上报通道；未挂接时仅 console。
//  - DEBUG 开关收口到 config.ts（DIRECTOR3D_DEBUG），本模块不再裸读 import.meta（见 base/config.ts 注释）。

import { DIRECTOR3D_DEBUG } from '../base/core/config.ts';

const DEBUG_ENABLED = DIRECTOR3D_DEBUG;

// 可选错误上报通道（外部挂接，例如接入 apimart gateway 或飞书）。
let errorReporter = null;

/** 挂接错误上报函数；返回旧值便于恢复。 */
export function configureErrorReporting(fn) {
  const prev = errorReporter;
  errorReporter = fn;
  return prev;
}

/** 提取可读的错误描述（保留原始 message / stack 供排查）。 */
function describe(args) {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

export const log = {
  /** 错误：总是输出 + 上报。推荐在所有 catch 处调用。 */
  error(...args) {
    const text = describe(args);
    console.error(`[director3d] ${text}`);
    if (errorReporter) {
      try {
        errorReporter({ level: 'error', message: text, raw: args });
      } catch {
        /* 上报失败不阻塞原流程 */
      }
    }
  },
  /** 警告：总是输出。 */
  warn(...args) {
    console.warn(`[director3d] ${describe(args)}`);
  },
  /** 信息：总是输出。 */
  info(...args) {
    console.info(`[director3d] ${describe(args)}`);
  },
  /** 调试：由 DEBUG_ENABLED 开关控制，默认安静。 */
  debug(...args) {
    if (DEBUG_ENABLED) console.log(`[director3d][debug] ${describe(args)}`);
  },
};
