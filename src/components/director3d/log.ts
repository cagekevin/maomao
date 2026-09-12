// 统一日志层（director3d）。
// 纪律：
//  - 所有关键链路/重要错误的记录统一走本模块，禁止散写 console.*（本地调试除外）。
//  - error / warn 经 base/core/logger 落盘 localTool POST /api/logs（[frontend] 前缀，与后端同文件），
//    与主仓其他链路同一份日志，全链路可 grep；不再各自 console 了事（那会让 3D 故障在系统日志中不可见）。
//  - 不提供 info 级别：logger 只收「高价值、不可还原」日志，结构/交互噪音禁入（见 base/core/logger.ts 头注）。
//  - debug 由 DIRECTOR3D_DEBUG 开关控制（收口到 config.ts），默认安静、不落盘。
//  - DEBUG 开关收口到 config.ts（DIRECTOR3D_DEBUG），本模块不再裸读 import.meta（见 base/config.ts 注释）。

import { logger } from '../base/core/logger.ts';
import { DIRECTOR3D_DEBUG } from '../base/core/config.ts';

const DEBUG_ENABLED = DIRECTOR3D_DEBUG;

/** 提取可读的错误描述（保留原始 message / stack 供排查）。 */
function describe(args: unknown[]) {
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
  /** 错误：console + 落盘/上报 localTool（统一走 base/core/logger）。推荐在所有 catch 处调用。 */
  error(...args: unknown[]) {
    logger.error('director3d', describe(args));
  },
  /** 警告：console + 落盘/上报 localTool。 */
  warn(...args: unknown[]) {
    logger.warn('director3d', describe(args));
  },
  /** 调试：由 DEBUG_ENABLED 开关控制，默认安静、不落盘。 */
  debug(...args: unknown[]) {
    if (DEBUG_ENABLED) console.log(`[director3d][debug] ${describe(args)}`);
  },
};
